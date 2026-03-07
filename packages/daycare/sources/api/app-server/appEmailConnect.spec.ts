import { afterEach, describe, expect, it } from "vitest";
import type { EmailMessage } from "../../email/emailSend.js";
import type { Storage } from "../../storage/storage.js";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { userConnectorKeyCreate } from "../../storage/userConnectorKeyCreate.js";
import { AppEmailConnect } from "./appEmailConnect.js";

const activeStorages: Storage[] = [];

describe("AppEmailConnect", () => {
    afterEach(async () => {
        await Promise.all(activeStorages.splice(0).map((storage) => storage.connection.close()));
    });

    it("sends a connect-email payload to the app auth screen", async () => {
        const sent: EmailMessage[] = [];
        const storage = await storageOpenTest();
        activeStorages.push(storage);
        const user = await storage.users.create({});
        const connect = new AppEmailConnect({
            users: storage.users,
            host: "127.0.0.1",
            port: 7332,
            serverEndpoint: "https://api.example.com",
            appEndpoint: "https://app.example.com",
            secret: "12345678901234567890123456789012",
            mailSend: async (message) => {
                sent.push(message);
            }
        });

        await connect.request(user.id, "person@example.com");

        expect(sent).toHaveLength(1);
        expect(sent[0]?.to).toBe("person@example.com");
        const payload = appEmailPayloadDecode(sent[0]?.text ?? "");
        expect(payload.backendUrl).toBe("https://api.example.com");
        expect(payload.kind).toBe("connect-email");
        expect(typeof payload.token).toBe("string");
        expect(payload.token.length).toBeGreaterThan(0);
    });

    it("verifies a connect-email token and adds the connector key to the existing user", async () => {
        const sent: EmailMessage[] = [];
        const storage = await storageOpenTest();
        activeStorages.push(storage);
        const user = await storage.users.create({});
        const connect = new AppEmailConnect({
            users: storage.users,
            host: "127.0.0.1",
            port: 7332,
            serverEndpoint: "https://api.example.com",
            appEndpoint: "https://app.example.com",
            secret: "12345678901234567890123456789012",
            mailSend: async (message) => {
                sent.push(message);
            }
        });

        await connect.request(user.id, "person@example.com");
        const payload = appEmailPayloadDecode(sent[0]?.text ?? "");
        const verified = await connect.verify(payload.token);
        const reloaded = await storage.users.findById(user.id);

        expect(verified).toEqual({
            userId: user.id,
            email: "person@example.com"
        });
        expect(reloaded?.connectorKeys.map((entry) => entry.connectorKey)).toContain(
            userConnectorKeyCreate("email", "person@example.com")
        );
    });

    it("rejects emails already connected to another user", async () => {
        const sent: EmailMessage[] = [];
        const storage = await storageOpenTest();
        activeStorages.push(storage);
        await storage.users.create({
            connectorKey: userConnectorKeyCreate("email", "person@example.com")
        });
        const user = await storage.users.create({});
        const connect = new AppEmailConnect({
            users: storage.users,
            host: "127.0.0.1",
            port: 7332,
            secret: "12345678901234567890123456789012",
            mailSend: async (message) => {
                sent.push(message);
            }
        });

        await expect(connect.request(user.id, "person@example.com")).rejects.toThrow(
            "Email is already connected to another account."
        );
    });
});

function appEmailPayloadDecode(text: string): { backendUrl: string; token: string; kind: string } {
    const match = text.match(/https?:\/\/\S+/);
    if (!match?.[0]) {
        throw new Error("Expected auth URL in email body.");
    }

    const url = new URL(match[0]);
    const encoded = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
    if (!encoded) {
        throw new Error("Expected auth hash payload.");
    }

    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as {
        backendUrl: string;
        token: string;
        kind: string;
    };
}
