import { afterEach, describe, expect, it } from "vitest";
import type { EmailMessage } from "../../email/emailSend.js";
import type { Storage } from "../../storage/storage.js";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { userConnectorKeyCreate } from "../../storage/userConnectorKeyCreate.js";
import { AppEmailAuth } from "./appEmailAuth.js";

const activeStorages: Storage[] = [];

describe("AppEmailAuth", () => {
    afterEach(async () => {
        await Promise.all(activeStorages.splice(0).map((storage) => storage.connection.close()));
    });

    it("sends an email payload that targets the app auth screen", async () => {
        const sent: EmailMessage[] = [];
        const storage = await storageOpenTest();
        activeStorages.push(storage);
        const auth = new AppEmailAuth({
            db: storage.db,
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

        await auth.request("person@example.com");

        expect(sent).toHaveLength(1);
        expect(sent[0]?.to).toBe("person@example.com");

        const payload = appEmailPayloadDecode(sent[0]?.text ?? "");
        expect(payload.backendUrl).toBe("https://api.example.com");
        expect(payload.kind).toBe("email");
        expect(typeof payload.token).toBe("string");
        expect(payload.token.length).toBeGreaterThan(0);
    });

    it("verifies a magic-link token and creates an email-scoped Daycare user", async () => {
        const sent: EmailMessage[] = [];
        const storage = await storageOpenTest();
        activeStorages.push(storage);
        const auth = new AppEmailAuth({
            db: storage.db,
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

        await auth.request("person@example.com");
        const payload = appEmailPayloadDecode(sent[0]?.text ?? "");
        const verified = await auth.verify(payload.token);
        const user = await storage.users.findById(verified.userId);

        expect(verified.email).toBe("person@example.com");
        expect(user?.connectorKeys.map((entry) => entry.connectorKey)).toContain(
            userConnectorKeyCreate("email", "person@example.com")
        );
    });

    it("maps a verified email onto an existing Daycare user", async () => {
        const sent: EmailMessage[] = [];
        const storage = await storageOpenTest();
        activeStorages.push(storage);
        const existing = await storage.users.create({
            connectorKey: userConnectorKeyCreate("email", "person@example.com")
        });
        const auth = new AppEmailAuth({
            db: storage.db,
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

        await auth.request("person@example.com");
        const payload = appEmailPayloadDecode(sent[0]?.text ?? "");
        const verified = await auth.verify(payload.token);

        expect(verified.userId).toBe(existing.id);
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
