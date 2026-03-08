import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ToolExecutionContext } from "@/types";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { contextForUser } from "../../agents/context.js";
import { Secrets } from "../../secrets/secrets.js";
import { secretAddToolBuild } from "./secretAddToolBuild.js";

const toolCall = { id: "tool-1", name: "secret_add" };

describe("secretAddToolBuild", () => {
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

    it("creates a secret and hides variable values in response", async () => {
        const usersDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-secret-add-tool-"));
        dirs.push(usersDir);
        const storage = await storageOpenTest();
        storages.push(storage);
        const secrets = new Secrets({ usersDir, observationLog: storage.observationLog });
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
        const storage = await storageOpenTest();
        storages.push(storage);
        const secrets = new Secrets({ usersDir, observationLog: storage.observationLog });
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

    it("creates a secret on a target workspace when userId is provided", async () => {
        const usersDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-secret-add-tool-"));
        dirs.push(usersDir);
        const storage = await storageOpenTest();
        storages.push(storage);
        const secrets = new Secrets({ usersDir, observationLog: storage.observationLog });
        const ownerCtx = contextForUser({ userId: "owner-1" });
        const tool = secretAddToolBuild();

        const result = await tool.execute(
            {
                name: "workspace-key",
                displayName: "Workspace Key",
                description: "For workspace",
                userId: "workspace-1",
                variables: { API_KEY: "secret" }
            },
            contextBuild(ownerCtx, secrets, {
                owner: { id: "owner-1", isWorkspace: false, workspaceOwnerId: null },
                workspace: { id: "workspace-1", isWorkspace: true, workspaceOwnerId: "owner-1" }
            }),
            toolCall
        );

        expect(result.typedResult.status).toBe("created");
        await expect(secrets.list(contextForUser({ userId: "owner-1" }))).resolves.toEqual([]);
        await expect(secrets.list(contextForUser({ userId: "workspace-1" }))).resolves.toEqual([
            {
                name: "workspace-key",
                displayName: "Workspace Key",
                description: "For workspace",
                variables: { API_KEY: "secret" }
            }
        ]);
    });

    it("throws when non-owner tries to add a workspace secret", async () => {
        const usersDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-secret-add-tool-"));
        dirs.push(usersDir);
        const storage = await storageOpenTest();
        storages.push(storage);
        const secrets = new Secrets({ usersDir, observationLog: storage.observationLog });
        const tool = secretAddToolBuild();

        await expect(
            tool.execute(
                {
                    name: "workspace-key",
                    displayName: "Workspace Key",
                    description: "For workspace",
                    userId: "workspace-1",
                    variables: { API_KEY: "secret" }
                },
                contextBuild(contextForUser({ userId: "user-1" }), secrets, {
                    owner: { id: "user-1", isWorkspace: false, workspaceOwnerId: null },
                    workspace: { id: "workspace-1", isWorkspace: true, workspaceOwnerId: "owner-1" }
                }),
                toolCall
            )
        ).rejects.toThrow("Only workspace owners can manage workspace secrets.");
    });

    it("throws when target workspace does not exist", async () => {
        const usersDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-secret-add-tool-"));
        dirs.push(usersDir);
        const storage = await storageOpenTest();
        storages.push(storage);
        const secrets = new Secrets({ usersDir, observationLog: storage.observationLog });
        const tool = secretAddToolBuild();

        await expect(
            tool.execute(
                {
                    name: "workspace-key",
                    displayName: "Workspace Key",
                    description: "For workspace",
                    userId: "missing-workspace",
                    variables: { API_KEY: "secret" }
                },
                contextBuild(contextForUser({ userId: "owner-1" }), secrets, {
                    owner: { id: "owner-1", isWorkspace: false, workspaceOwnerId: null }
                }),
                toolCall
            )
        ).rejects.toThrow("Workspace not found: missing-workspace");
    });
});

function contextBuild(
    ctx: ToolExecutionContext["ctx"],
    secrets: Secrets,
    users?: {
        owner: { id: string; isWorkspace: boolean; workspaceOwnerId: string | null };
        workspace?: { id: string; isWorkspace: boolean; workspaceOwnerId: string | null };
    }
): ToolExecutionContext {
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
        agentSystem: users
            ? ({
                  storage: {
                      users: {
                          findById: async (id: string) => {
                              if (id === users.owner.id) {
                                  return users.owner;
                              }
                              if (users.workspace && id === users.workspace.id) {
                                  return users.workspace;
                              }
                              return null;
                          }
                      }
                  }
              } as unknown as ToolExecutionContext["agentSystem"])
            : ({} as unknown as ToolExecutionContext["agentSystem"]),
        secrets
    };
}
