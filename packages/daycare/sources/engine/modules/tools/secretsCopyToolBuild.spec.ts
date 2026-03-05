import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ToolExecutionContext } from "@/types";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { contextForUser } from "../../agents/context.js";
import { Secrets } from "../../secrets/secrets.js";
import { secretCopyToolBuild } from "./secretsCopyToolBuild.js";

const toolCall = { id: "tool-1", name: "secret_copy" };

describe("secretCopyToolBuild", () => {
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

    it("copies named secrets from owner to target swarm", async () => {
        const usersDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-secrets-copy-tool-"));
        dirs.push(usersDir);
        const storage = await storageOpenTest();
        storages.push(storage);
        const secrets = new Secrets({ usersDir, observationLog: storage.observationLog });
        const ownerCtx = contextForUser({ userId: "owner-1" });
        await secrets.add(ownerCtx, {
            name: "openai-key",
            displayName: "OpenAI",
            description: "API key",
            variables: { OPENAI_API_KEY: "sk-secret" }
        });

        const tool = secretCopyToolBuild();
        const result = await tool.execute(
            { userId: "swarm-1", secret: "openai-key" },
            contextBuild(ownerCtx, secrets, {
                owner: { id: "owner-1", isOwner: true, isSwarm: false, parentUserId: null },
                swarm: { id: "swarm-1", isOwner: false, isSwarm: true, parentUserId: "owner-1" }
            }),
            toolCall
        );

        expect(result.typedResult.status).toBe("copied");
        expect(result.typedResult.secret).toBe("openai-key");
        await expect(secrets.list(contextForUser({ userId: "swarm-1" }))).resolves.toEqual([
            {
                name: "openai-key",
                displayName: "OpenAI",
                description: "API key",
                variables: { OPENAI_API_KEY: "sk-secret" }
            }
        ]);
    });

    it("throws when caller is not owner", async () => {
        const usersDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-secrets-copy-tool-"));
        dirs.push(usersDir);
        const storage = await storageOpenTest();
        storages.push(storage);
        const secrets = new Secrets({ usersDir, observationLog: storage.observationLog });
        const tool = secretCopyToolBuild();

        await expect(
            tool.execute(
                { userId: "swarm-1", secret: "openai-key" },
                contextBuild(contextForUser({ userId: "user-1" }), secrets, {
                    owner: { id: "user-1", isOwner: false, isSwarm: false, parentUserId: null },
                    swarm: { id: "swarm-1", isOwner: false, isSwarm: true, parentUserId: "owner-1" }
                }),
                toolCall
            )
        ).rejects.toThrow("Only the owner user can copy secrets to swarms.");
    });

    it("throws when target swarm is not found", async () => {
        const usersDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-secrets-copy-tool-"));
        dirs.push(usersDir);
        const storage = await storageOpenTest();
        storages.push(storage);
        const secrets = new Secrets({ usersDir, observationLog: storage.observationLog });
        const tool = secretCopyToolBuild();

        await expect(
            tool.execute(
                { userId: "missing-swarm", secret: "openai-key" },
                contextBuild(contextForUser({ userId: "owner-1" }), secrets, {
                    owner: { id: "owner-1", isOwner: true, isSwarm: false, parentUserId: null }
                }),
                toolCall
            )
        ).rejects.toThrow("Swarm not found: missing-swarm");
    });

    it("throws when a requested secret does not exist on owner", async () => {
        const usersDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-secrets-copy-tool-"));
        dirs.push(usersDir);
        const storage = await storageOpenTest();
        storages.push(storage);
        const secrets = new Secrets({ usersDir, observationLog: storage.observationLog });
        const tool = secretCopyToolBuild();

        await expect(
            tool.execute(
                { userId: "swarm-1", secret: "missing" },
                contextBuild(contextForUser({ userId: "owner-1" }), secrets, {
                    owner: { id: "owner-1", isOwner: true, isSwarm: false, parentUserId: null },
                    swarm: { id: "swarm-1", isOwner: false, isSwarm: true, parentUserId: "owner-1" }
                }),
                toolCall
            )
        ).rejects.toThrow('Secret not found: "missing".');
    });
});

function contextBuild(
    ctx: ToolExecutionContext["ctx"],
    secrets: Secrets,
    users: {
        owner: { id: string; isOwner: boolean; isSwarm: boolean; parentUserId: string | null };
        swarm?: { id: string; isOwner: boolean; isSwarm: boolean; parentUserId: string | null };
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
        agentSystem: {
            storage: {
                users: {
                    findById: async (id: string) => {
                        if (id === users.owner.id) {
                            return users.owner;
                        }
                        if (users.swarm && id === users.swarm.id) {
                            return users.swarm;
                        }
                        return null;
                    }
                }
            }
        } as unknown as ToolExecutionContext["agentSystem"],
        secrets
    };
}
