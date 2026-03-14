import { afterEach, describe, expect, it, vi } from "vitest";
import type { EmailMessage } from "../../email/emailSend.js";
import type { Storage } from "../../storage/storage.js";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { userConnectorKeyCreate } from "../../storage/userConnectorKeyCreate.js";
import { AppEmailAuth } from "./appEmailAuth.js";

const activeStorages: Storage[] = [];

describe("AppEmailAuth", () => {
    afterEach(async () => {
        vi.restoreAllMocks();
        await Promise.all(activeStorages.splice(0).map((storage) => storage.connection.close()));
    });

    it("sends a six-digit code email", async () => {
        const sent: EmailMessage[] = [];
        const storage = await storageOpenTest();
        activeStorages.push(storage);
        const auth = new AppEmailAuth({
            users: storage.users,
            secret: "12345678901234567890123456789012",
            mailSend: async (message) => {
                sent.push(message);
            }
        });

        const result = await auth.request("person@example.com");

        expect(typeof result.expiresAt).toBe("number");
        expect(result.retryAfterMs).toBe(30_000);
        expect(sent).toHaveLength(1);
        expect(sent[0]?.to).toBe("person@example.com");
        expect(appEmailCodeExtract(sent[0]?.text ?? "")).toMatch(/^[1-9][0-9]{5}$/);
    });

    it("verifies a code and creates an email-scoped Daycare user", async () => {
        const sent: EmailMessage[] = [];
        const storage = await storageOpenTest();
        activeStorages.push(storage);
        const auth = new AppEmailAuth({
            users: storage.users,
            secret: "12345678901234567890123456789012",
            mailSend: async (message) => {
                sent.push(message);
            }
        });

        await auth.request("person@example.com");
        const code = appEmailCodeExtract(sent[0]?.text ?? "");
        const verified = await auth.verify("person@example.com", code);
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
            connector: { name: "email", key: "person@example.com" }
        });
        const auth = new AppEmailAuth({
            users: storage.users,
            secret: "12345678901234567890123456789012",
            mailSend: async (message) => {
                sent.push(message);
            }
        });

        await auth.request("person@example.com");
        const code = appEmailCodeExtract(sent[0]?.text ?? "");
        const verified = await auth.verify("person@example.com", code);

        expect(verified.userId).toBe(existing.id);
    });

    it("throttles repeated code requests", async () => {
        const sent: EmailMessage[] = [];
        const storage = await storageOpenTest();
        activeStorages.push(storage);
        const auth = new AppEmailAuth({
            users: storage.users,
            secret: "12345678901234567890123456789012",
            mailSend: async (message) => {
                sent.push(message);
            }
        });

        await auth.request("person@example.com");

        await expect(auth.request("person@example.com")).rejects.toThrow(
            "Please wait 30 seconds before requesting another sign-in code."
        );
        expect(sent).toHaveLength(1);
    });

    it("invalidates the code after repeated failures", async () => {
        const sent: EmailMessage[] = [];
        const storage = await storageOpenTest();
        activeStorages.push(storage);
        const auth = new AppEmailAuth({
            users: storage.users,
            secret: "12345678901234567890123456789012",
            mailSend: async (message) => {
                sent.push(message);
            }
        });

        const nowSpy = vi.spyOn(Date, "now");
        nowSpy.mockReturnValue(10);
        await auth.request("person@example.com");

        nowSpy.mockReturnValue(40_000);
        for (let attempt = 0; attempt < 4; attempt += 1) {
            await expect(auth.verify("person@example.com", "123456")).rejects.toThrow(
                "Invalid or expired sign-in code."
            );
        }
        await expect(auth.verify("person@example.com", "123456")).rejects.toThrow(
            "Too many failed attempts. Request a new sign-in code."
        );

        const code = appEmailCodeExtract(sent[0]?.text ?? "");
        await expect(auth.verify("person@example.com", code)).rejects.toThrow("Invalid or expired sign-in code.");
    });
});

function appEmailCodeExtract(text: string): string {
    const match = text.match(/\b([1-9][0-9]{5})\b/);
    if (!match?.[1]) {
        throw new Error("Expected sign-in code in email body.");
    }
    return match[1];
}
