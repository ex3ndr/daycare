import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ToolExecutionContext } from "@/types";
import { contextForUser } from "../../agents/context.js";
import { Secrets } from "../../secrets/secrets.js";
import { secretAddToolBuild } from "./secretAddToolBuild.js";

const toolCall = { id: "tool-1", name: "secret_add" };

describe("secretAddToolBuild", () => {
    const dirs: string[] = [];

    afterEach(async () => {
        await Promise.all(dirs.map((entry) => fs.rm(entry, { recursive: true, force: true })));
        dirs.length = 0;
    });

    it("creates a secret and hides variable values in response", async () => {
        const usersDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-secret-add-tool-"));
        dirs.push(usersDir);
        const secrets = new Secrets(usersDir);
        const ctx = contextForUser({ userId: "user-1" });
        const tool = secretAddToolBuild();

        const result = await tool.execute(
            {
                name: "openai-key",
                displayName: "OpenAI",
                description: "OpenAI credentials",
                variables: {
                    OPENAI_API_KEY: "sk-secret",
                    OPENAI_TIMEOUT_SECONDS: 30,
                    OPENAI_ENABLED: true
                }
            },
            contextBuild(ctx, secrets),
            toolCall
        );

        expect(result.toolMessage.isError).toBe(false);
        expect(result.typedResult.status).toBe("created");
        expect(result.typedResult.variableNames).toEqual([
            "OPENAI_API_KEY",
            "OPENAI_ENABLED",
            "OPENAI_TIMEOUT_SECONDS"
        ]);

        const listed = await secrets.list(ctx);
        expect(listed).toEqual([
            {
                name: "openai-key",
                displayName: "OpenAI",
                description: "OpenAI credentials",
                variables: {
                    OPENAI_API_KEY: "sk-secret",
                    OPENAI_TIMEOUT_SECONDS: "30",
                    OPENAI_ENABLED: "true"
                }
            }
        ]);

        const responseText = result.toolMessage.content
            .filter((item) => item.type === "text")
            .map((item) => ("text" in item ? item.text : ""))
            .join("\n");
        expect(responseText).not.toContain("sk-secret");
    });

    it("updates an existing secret", async () => {
        const usersDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-secret-add-tool-"));
        dirs.push(usersDir);
        const secrets = new Secrets(usersDir);
        const ctx = contextForUser({ userId: "user-1" });
        await secrets.add(ctx, {
            name: "openai-key",
            displayName: "Old",
            description: "old",
            variables: { OPENAI_API_KEY: "sk-old" }
        });

        const tool = secretAddToolBuild();
        const result = await tool.execute(
            {
                name: "openai-key",
                displayName: "New",
                description: "new",
                variables: { OPENAI_API_KEY: "sk-new" }
            },
            contextBuild(ctx, secrets),
            toolCall
        );

        expect(result.typedResult.status).toBe("updated");
        const listed = await secrets.list(ctx);
        expect(listed[0]?.displayName).toBe("New");
        expect(listed[0]?.variables.OPENAI_API_KEY).toBe("sk-new");
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
