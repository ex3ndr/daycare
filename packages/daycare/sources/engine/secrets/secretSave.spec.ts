import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { contextForUser } from "../agents/context.js";
import { secretLoad } from "./secretLoad.js";
import { secretSave } from "./secretSave.js";

describe("secretSave", () => {
    const dirs: string[] = [];

    afterEach(async () => {
        await Promise.all(dirs.map((entry) => fs.rm(entry, { recursive: true, force: true })));
        dirs.length = 0;
    });

    it("writes valid JSON to secrets.json", async () => {
        const usersDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-secret-save-"));
        dirs.push(usersDir);
        const ctx = contextForUser({ userId: "user-1" });

        await secretSave(usersDir, ctx, [
            {
                name: "aws-prod",
                displayName: "AWS Production",
                description: "Credentials for production account",
                variables: {
                    AWS_ACCESS_KEY_ID: "AKIA...",
                    AWS_SECRET_ACCESS_KEY: "secret..."
                }
            }
        ]);

        const target = path.join(usersDir, "user-1", "secrets.json");
        const raw = await fs.readFile(target, "utf8");
        const parsed = JSON.parse(raw) as unknown;
        expect(Array.isArray(parsed)).toBe(true);
    });

    it("round-trips with secretLoad", async () => {
        const usersDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-secret-save-"));
        dirs.push(usersDir);
        const ctx = contextForUser({ userId: "user/slash" });
        const expected = [
            {
                name: "openai-key",
                displayName: "OpenAI Key",
                description: "OpenAI API credentials",
                variables: {
                    OPENAI_API_KEY: "sk-123"
                }
            }
        ];

        await secretSave(usersDir, ctx, expected);

        const loaded = await secretLoad(usersDir, ctx);
        expect(loaded).toEqual(expected);

        const encodedPath = path.join(usersDir, encodeURIComponent("user/slash"), "secrets.json");
        await expect(fs.access(encodedPath)).resolves.toBeUndefined();
    });
});
