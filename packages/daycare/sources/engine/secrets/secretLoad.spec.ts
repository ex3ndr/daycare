import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { contextForUser } from "../agents/context.js";
import { secretLoad } from "./secretLoad.js";

describe("secretLoad", () => {
    const dirs: string[] = [];

    afterEach(async () => {
        await Promise.all(dirs.map((entry) => fs.rm(entry, { recursive: true, force: true })));
        dirs.length = 0;
    });

    it("loads secrets when file exists", async () => {
        const usersDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-secret-load-"));
        dirs.push(usersDir);
        const ctx = contextForUser({ userId: "user-1" });
        const filePath = path.join(usersDir, "user-1", "secrets.json");
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(
            filePath,
            JSON.stringify(
                [
                    {
                        name: "openai-key",
                        displayName: "OpenAI",
                        description: "API key",
                        variables: { OPENAI_API_KEY: "sk-test" }
                    }
                ],
                null,
                4
            ),
            "utf8"
        );

        const loaded = await secretLoad(usersDir, ctx);
        expect(loaded).toEqual([
            {
                name: "openai-key",
                displayName: "OpenAI",
                description: "API key",
                variables: { OPENAI_API_KEY: "sk-test" }
            }
        ]);
    });

    it("returns empty array when file does not exist", async () => {
        const usersDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-secret-load-"));
        dirs.push(usersDir);
        const ctx = contextForUser({ userId: "user-2" });

        await expect(secretLoad(usersDir, ctx)).resolves.toEqual([]);
    });

    it("throws for malformed JSON", async () => {
        const usersDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-secret-load-"));
        dirs.push(usersDir);
        const ctx = contextForUser({ userId: "user-3" });
        const filePath = path.join(usersDir, "user-3", "secrets.json");
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, "{bad-json", "utf8");

        await expect(secretLoad(usersDir, ctx)).rejects.toThrow("Invalid secrets file");
    });
});
