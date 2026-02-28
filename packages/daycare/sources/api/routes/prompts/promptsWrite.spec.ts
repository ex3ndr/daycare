import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { promptsRead } from "./promptsRead.js";
import { promptsWrite } from "./promptsWrite.js";

let tmpDir: string;

afterEach(async () => {
    if (tmpDir) {
        await fs.rm(tmpDir, { recursive: true, force: true });
    }
});

describe("promptsWrite", () => {
    it("writes a prompt file and reads it back", async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "prompts-write-"));
        const usersDir = path.join(tmpDir, "users");
        const ctx = contextForUser({ userId: "test-user" });

        const writeResult = await promptsWrite({
            ctx,
            usersDir,
            filename: "SOUL.md",
            content: "# Custom Soul\n\nBe awesome."
        });

        expect(writeResult).toEqual({ ok: true, filename: "SOUL.md" });

        const readResult = await promptsRead({
            ctx,
            usersDir,
            filename: "SOUL.md"
        });

        expect(readResult).toEqual({
            ok: true,
            filename: "SOUL.md",
            content: "# Custom Soul\n\nBe awesome."
        });
    });

    it("rejects unknown filenames", async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "prompts-write-"));
        const usersDir = path.join(tmpDir, "users");
        const ctx = contextForUser({ userId: "test-user" });

        const result = await promptsWrite({
            ctx,
            usersDir,
            filename: "EVIL.md",
            content: "bad"
        });

        expect(result).toEqual({ ok: false, error: "Unknown prompt file: EVIL.md" });
    });

    it("overwrites existing content", async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "prompts-write-"));
        const usersDir = path.join(tmpDir, "users");
        const ctx = contextForUser({ userId: "test-user" });

        await promptsWrite({
            ctx,
            usersDir,
            filename: "USER.md",
            content: "Original"
        });

        await promptsWrite({
            ctx,
            usersDir,
            filename: "USER.md",
            content: "Updated"
        });

        const result = await promptsRead({
            ctx,
            usersDir,
            filename: "USER.md"
        });

        expect(result).toEqual({ ok: true, filename: "USER.md", content: "Updated" });
    });
});
