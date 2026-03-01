import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { contextForUser } from "../agents/context.js";
import { Secrets } from "./secrets.js";

describe("Secrets", () => {
    const dirs: string[] = [];
    const storages: Array<{ connection: { close: () => void } }> = [];

    afterEach(async () => {
        await Promise.all(dirs.map((entry) => fs.rm(entry, { recursive: true, force: true })));
        dirs.length = 0;
        for (const storage of storages) {
            storage.connection.close();
        }
        storages.length = 0;
    });

    it("adds a new secret", async () => {
        const usersDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-secrets-facade-"));
        dirs.push(usersDir);
        const storage = await storageOpenTest();
        storages.push(storage);
        const secrets = new Secrets({ usersDir, observationLog: storage.observationLog });
        const ctx = contextForUser({ userId: "user-1" });

        await secrets.add(ctx, {
            name: "openai-key",
            displayName: "OpenAI Key",
            description: "OpenAI API credentials",
            variables: { OPENAI_API_KEY: "sk-1" }
        });

        await expect(secrets.list(ctx)).resolves.toEqual([
            {
                name: "openai-key",
                displayName: "OpenAI Key",
                description: "OpenAI API credentials",
                variables: { OPENAI_API_KEY: "sk-1" }
            }
        ]);
        const observations = await storage.observationLog.findMany({ userId: "user-1", agentId: "agent-1" });
        expect(observations.map((entry) => entry.type)).toEqual(expect.arrayContaining(["secret:added"]));
    });

    it("updates an existing secret by name", async () => {
        const usersDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-secrets-facade-"));
        dirs.push(usersDir);
        const storage = await storageOpenTest();
        storages.push(storage);
        const secrets = new Secrets({ usersDir, observationLog: storage.observationLog });
        const ctx = contextForUser({ userId: "user-1" });
        await secrets.add(ctx, {
            name: "openai-key",
            displayName: "OpenAI Key",
            description: "Old",
            variables: { OPENAI_API_KEY: "sk-old" }
        });

        await secrets.add(ctx, {
            name: "openai-key",
            displayName: "OpenAI API Key",
            description: "New",
            variables: { OPENAI_API_KEY: "sk-new", OPENAI_ORG_ID: "org-1" }
        });

        const listed = await secrets.list(ctx);
        expect(listed).toHaveLength(1);
        expect(listed[0]).toEqual({
            name: "openai-key",
            displayName: "OpenAI API Key",
            description: "New",
            variables: { OPENAI_API_KEY: "sk-new", OPENAI_ORG_ID: "org-1" }
        });
    });

    it("removes an existing secret and reports missing names", async () => {
        const usersDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-secrets-facade-"));
        dirs.push(usersDir);
        const storage = await storageOpenTest();
        storages.push(storage);
        const secrets = new Secrets({ usersDir, observationLog: storage.observationLog });
        const ctx = contextForUser({ userId: "user-1" });
        await secrets.add(ctx, {
            name: "aws-prod",
            displayName: "AWS",
            description: "prod",
            variables: { AWS_ACCESS_KEY_ID: "abc" }
        });

        await expect(secrets.remove(ctx, "aws-prod")).resolves.toBe(true);
        await expect(secrets.remove(ctx, "missing")).resolves.toBe(false);
        await expect(secrets.list(ctx)).resolves.toEqual([]);
        const observations = await storage.observationLog.findMany({ userId: "user-1", agentId: "agent-1" });
        expect(observations.map((entry) => entry.type)).toEqual(expect.arrayContaining(["secret:removed"]));
    });

    it("resolves and merges variables in requested order", async () => {
        const usersDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-secrets-facade-"));
        dirs.push(usersDir);
        const storage = await storageOpenTest();
        storages.push(storage);
        const secrets = new Secrets({ usersDir, observationLog: storage.observationLog });
        const ctx = contextForUser({ userId: "user-1" });
        await secrets.add(ctx, {
            name: "first",
            displayName: "first",
            description: "first",
            variables: { SHARED: "one", FIRST_ONLY: "a" }
        });
        await secrets.add(ctx, {
            name: "second",
            displayName: "second",
            description: "second",
            variables: { SHARED: "two", SECOND_ONLY: "b" }
        });

        await expect(secrets.resolve(ctx, ["first", "second"])).resolves.toEqual({
            SHARED: "two",
            FIRST_ONLY: "a",
            SECOND_ONLY: "b"
        });
    });

    it("throws when resolving an unknown secret name", async () => {
        const usersDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-secrets-facade-"));
        dirs.push(usersDir);
        const storage = await storageOpenTest();
        storages.push(storage);
        const secrets = new Secrets({ usersDir, observationLog: storage.observationLog });
        const ctx = contextForUser({ userId: "user-1" });

        await expect(secrets.resolve(ctx, ["missing"])).rejects.toThrow('Unknown secret: "missing".');
    });
});
