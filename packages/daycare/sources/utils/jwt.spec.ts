import { describe, expect, it } from "vitest";
import { JWT_SERVICE_WEBHOOK, jwtSign, jwtVerify } from "./jwt.js";

describe("jwtSign", () => {
    it("generates a jwt token string", async () => {
        const token = await jwtSign({ userId: "user-1" }, "test-secret", 3600);

        expect(typeof token).toBe("string");
        expect(token.split(".")).toHaveLength(3);
    });
});

describe("jwtVerify", () => {
    it("returns payload for valid token", async () => {
        const token = await jwtSign({ userId: "user-1" }, "test-secret", 3600);

        await expect(jwtVerify(token, "test-secret")).resolves.toMatchObject({
            userId: "user-1"
        });
    });

    it("throws for expired token", async () => {
        const token = await jwtSign({ userId: "user-1" }, "test-secret", -10);

        await expect(jwtVerify(token, "test-secret")).rejects.toThrow();
    });

    it("throws for tampered token", async () => {
        const token = await jwtSign({ userId: "user-1" }, "test-secret", 3600);
        const [header, payload, signature] = token.split(".");
        if (!header || !payload || !signature) {
            throw new Error("Expected token to contain three segments.");
        }
        const replacement = signature[0] === "A" ? "B" : "A";
        const tampered = [header, payload, `${replacement}${signature.slice(1)}`].join(".");

        await expect(jwtVerify(tampered, "test-secret")).rejects.toThrow();
    });

    it("derives independent signatures per service from the same seed", async () => {
        const token = await jwtSign({ userId: "user-1" }, "test-seed", 3600, {
            service: JWT_SERVICE_WEBHOOK
        });

        await expect(jwtVerify(token, "test-seed")).rejects.toThrow();
        await expect(
            jwtVerify(token, "test-seed", {
                service: JWT_SERVICE_WEBHOOK
            })
        ).resolves.toMatchObject({
            userId: "user-1"
        });
    });
});
