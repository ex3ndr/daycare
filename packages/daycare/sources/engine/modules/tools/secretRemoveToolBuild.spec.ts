import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ToolExecutionContext } from "@/types";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { contextForUser } from "../../agents/context.js";
import { Secrets } from "../../secrets/secrets.js";
import { secretRemoveToolBuild } from "./secretRemoveToolBuild.js";

const toolCall = { id: "tool-1", name: "secret_remove" };

describe("secretRemoveToolBuild", () => {
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

    it("removes an existing secret", async () => {
        const usersDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-secret-remove-tool-"));
        dirs.push(usersDir);
        const storage = await storageOpenTest();
        storages.push(storage);
        const secrets = new Secrets({ usersDir, observationLog: storage.observationLog });
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
        const storage = await storageOpenTest();
        storages.push(storage);
        const secrets = new Secrets({ usersDir, observationLog: storage.observationLog });
        const ctx = contextForUser({ userId: "user-1" });

        const tool = secretRemoveToolBuild();
        const result = await tool.execute({ name: "missing" }, contextBuild(ctx, secrets), toolCall);

        expect(result.toolMessage.isError).toBe(false);
        expect(result.typedResult.status).toBe("not_found");
    });

    it("removes a workspace secret when userId is provided", async () => {
        const usersDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-secret-remove-tool-"));
        dirs.push(usersDir);
        const storage = await storageOpenTest();
        storages.push(storage);
        const secrets = new Secrets({ usersDir, observationLog: storage.observationLog });
        const workspaceCtx = contextForUser({ userId: "workspace-1" });
        await secrets.add(workspaceCtx, {
            name: "workspace-secret",
            displayName: "Workspace Secret",
            description: "desc",
            variables: { KEY: "value" }
        });

        const tool = secretRemoveToolBuild();
        const result = await tool.execute(
            { name: "workspace-secret", userId: "workspace-1" },
            contextBuild(contextForUser({ userId: "owner-1" }), secrets, {
                owner: { id: "owner-1", isOwner: true, isWorkspace: false, parentUserId: null },
                workspace: { id: "workspace-1", isOwner: false, isWorkspace: true, parentUserId: "owner-1" }
            }),
            toolCall
        );

        expect(result.typedResult.status).toBe("removed");
        await expect(secrets.list(workspaceCtx)).resolves.toEqual([]);
    });

    it("throws when non-owner tries to remove a workspace secret", async () => {
        const usersDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-secret-remove-tool-"));
        dirs.push(usersDir);
        const storage = await storageOpenTest();
        storages.push(storage);
        const secrets = new Secrets({ usersDir, observationLog: storage.observationLog });

        const tool = secretRemoveToolBuild();
        await expect(
            tool.execute(
                { name: "workspace-secret", userId: "workspace-1" },
                contextBuild(contextForUser({ userId: "user-1" }), secrets, {
                    owner: { id: "user-1", isOwner: false, isWorkspace: false, parentUserId: null },
                    workspace: { id: "workspace-1", isOwner: false, isWorkspace: true, parentUserId: "owner-1" }
                }),
                toolCall
            )
        ).rejects.toThrow("Only the owner user can manage workspace secrets.");
    });

    it("throws when target workspace does not exist", async () => {
        const usersDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-secret-remove-tool-"));
        dirs.push(usersDir);
        const storage = await storageOpenTest();
        storages.push(storage);
        const secrets = new Secrets({ usersDir, observationLog: storage.observationLog });

        const tool = secretRemoveToolBuild();
        await expect(
            tool.execute(
                { name: "workspace-secret", userId: "missing-workspace" },
                contextBuild(contextForUser({ userId: "owner-1" }), secrets, {
                    owner: { id: "owner-1", isOwner: true, isWorkspace: false, parentUserId: null }
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
        owner: { id: string; isOwner: boolean; isWorkspace: boolean; parentUserId: string | null };
        workspace?: { id: string; isOwner: boolean; isWorkspace: boolean; parentUserId: string | null };
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
