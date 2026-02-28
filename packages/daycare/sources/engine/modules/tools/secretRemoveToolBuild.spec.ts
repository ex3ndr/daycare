import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ToolExecutionContext } from "@/types";
import { contextForUser } from "../../agents/context.js";
import { Secrets } from "../../secrets/secrets.js";
import { secretRemoveToolBuild } from "./secretRemoveToolBuild.js";

const toolCall = { id: "tool-1", name: "secret_remove" };

describe("secretRemoveToolBuild", () => {
    const dirs: string[] = [];

    afterEach(async () => {
        await Promise.all(dirs.map((entry) => fs.rm(entry, { recursive: true, force: true })));
        dirs.length = 0;
    });

    it("removes an existing secret", async () => {
        const usersDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-secret-remove-tool-"));
        dirs.push(usersDir);
        const secrets = new Secrets(usersDir);
        const ctx = contextForUser({ userId: "user-1" });
        await secrets.add(ctx, {
            name: "aws-prod",
            displayName: "AWS",
            description: "Prod credentials",
            variables: { AWS_ACCESS_KEY_ID: "key" }
        });

        const tool = secretRemoveToolBuild();
        const result = await tool.execute({ name: "aws-prod" }, contextBuild(ctx, secrets), toolCall);

        expect(result.toolMessage.isError).toBe(false);
        expect(result.typedResult.status).toBe("removed");
        await expect(secrets.list(ctx)).resolves.toEqual([]);
    });

    it("returns not_found when secret is missing", async () => {
        const usersDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-secret-remove-tool-"));
        dirs.push(usersDir);
        const secrets = new Secrets(usersDir);
        const ctx = contextForUser({ userId: "user-1" });

        const tool = secretRemoveToolBuild();
        const result = await tool.execute({ name: "missing" }, contextBuild(ctx, secrets), toolCall);

        expect(result.toolMessage.isError).toBe(false);
        expect(result.typedResult.status).toBe("not_found");
    });
});

function contextBuild(ctx: ToolExecutionContext["ctx"], secrets: Secrets): ToolExecutionContext {
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox: null as unknown as ToolExecutionContext["sandbox"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: { id: "agent-1", descriptor: { type: "user" } } as unknown as ToolExecutionContext["agent"],
        ctx,
        source: "test",
        messageContext: {},
        agentSystem: {} as unknown as ToolExecutionContext["agentSystem"],
        heartbeats: null as unknown as ToolExecutionContext["heartbeats"],
        secrets
    };
}
