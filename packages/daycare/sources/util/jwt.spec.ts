import { describe, expect, it } from "vitest";
import { jwtSign, jwtVerify } from "./jwt.js";

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
        const suffix = token.at(-1) === "a" ? "b" : "a";
        const tampered = `${token.slice(0, -1)}${suffix}`;

        await expect(jwtVerify(tampered, "test-secret")).rejects.toThrow();
    });
});
