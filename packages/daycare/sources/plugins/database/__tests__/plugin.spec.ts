import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ToolCall } from "@mariozechner/pi-ai";
import { createId } from "@paralleldrive/cuid2";
import { beforeEach, describe, expect, it } from "vitest";
import type { AgentState, SessionPermissions } from "@/types";
import { AuthStore } from "../../../auth/store.js";
import { configResolve } from "../../../config/configResolve.js";
import { Agent } from "../../../engine/agents/agent.js";
import { contextForAgent } from "../../../engine/agents/context.js";
import { AgentInbox } from "../../../engine/agents/ops/agentInbox.js";
import { FileFolder } from "../../../engine/files/fileFolder.js";
import { ModuleRegistry } from "../../../engine/modules/moduleRegistry.js";
import { PluginRegistry } from "../../../engine/plugins/registry.js";
import { Processes } from "../../../engine/processes/processes.js";
import { UserHome } from "../../../engine/users/userHome.js";
import { getLogger } from "../../../log.js";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { plugin } from "../plugin.js";

describe("database plugin", () => {
    let baseDir: string;

    beforeEach(async () => {
        baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-db-plugin-"));
    });

    it("creates db files, runs SQL, and updates db.md", async () => {
        const config = configResolve({ engine: { dataDir: baseDir } }, path.join(baseDir, "settings.json"));
        const auth = new AuthStore(config);
        const fileStore = new FileFolder(path.join(config.dataDir, "files"));
        const modules = new ModuleRegistry({ onMessage: async () => undefined });
        const pluginRegistry = new PluginRegistry(modules);
        const storage = await storageOpenTest();

        const instanceId = "database-1";
        const registrar = pluginRegistry.createRegistrar(instanceId);
        const now = new Date();
        const agentId = createId();
        const permissions: SessionPermissions = {
            workingDir: baseDir,
            writeDirs: []
        };
        const messageContext = {};
        const descriptor = {
            type: "subagent",
            id: agentId,
            parentAgentId: "system",
            name: "system"
        } as const;
        const ctxUser1 = contextForAgent({ userId: "user-1", agentId });
        const state: AgentState = {
            context: { messages: [] },
            permissions,
            tokens: null,
            stats: {},
            createdAt: now.getTime(),
            updatedAt: now.getTime(),
            state: "active"
        };
        const agent = Agent.restore(
            ctxUser1,
            descriptor,
            state,
            new AgentInbox(agentId),
            {} as unknown as Parameters<typeof Agent.restore>[4],
            new UserHome(path.join(baseDir, "users"), "user-1")
        );
        const api = {
            instance: { instanceId, pluginId: "database" },
            settings: {},
            engineSettings: {},
            logger: getLogger("test.database"),
            auth,
            dataDir: baseDir,
            tmpDir: path.join(baseDir, "tmp"),
            registrar,
            exposes: {
                registerProvider: async () => undefined,
                unregisterProvider: async () => undefined,
                listProviders: () => []
            },
            fileStore,
            inference: {
                complete: async () => {
                    throw new Error("Inference not available in test.");
                }
            },
            processes: new Processes(baseDir, getLogger("test.processes.database"), {
                repository: storage.processes
            }),
            mode: "runtime" as const,
            events: {
                emit: () => undefined
            }
        };

        const instance = await plugin.create(api);
        await instance.load?.();

        const dbPath = path.join(baseDir, "users", "user-1", "db.pglite");
        const docPath = path.join(baseDir, "users", "user-1", "db.md");

        const toolCall: ToolCall = {
            type: "toolCall",
            id: "tool-1",
            name: "db_sql",
            arguments: {
                sql: "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL)",
                description: "Create users table"
            }
        };

        const result = await modules.tools.execute(toolCall, {
            connectorRegistry: modules.connectors,
            sandbox: {
                permissions,
                workingDir: permissions.workingDir
            } as unknown as Parameters<typeof modules.tools.execute>[1]["sandbox"],
            auth,
            logger: getLogger("test.database.tool"),
            assistant: null,
            agent,
            ctx: ctxUser1,
            source: "test",
            messageContext,
            agentSystem: null as unknown as Parameters<typeof modules.tools.execute>[1]["agentSystem"],
            heartbeats: null as unknown as Parameters<typeof modules.tools.execute>[1]["heartbeats"]
        });

        expect(result.toolMessage.isError).toBe(false);
        await expect(fs.stat(dbPath)).resolves.toBeTruthy();
        await expect(fs.stat(docPath)).resolves.toBeTruthy();

        const doc = await fs.readFile(docPath, "utf8");
        expect(doc).toContain("### users");
        expect(doc).toContain("id: integer");
        expect(doc).toContain("name: text");
        expect(doc).toContain("Create users table");

        const prompt =
            typeof instance.systemPrompt === "function"
                ? await instance.systemPrompt({ ctx: ctxUser1 })
                : (instance.systemPrompt ?? "");
        expect(prompt).toContain("Database plugin is active.");
        expect(prompt).toContain(doc.trim());

        const user2AgentId = createId();
        const ctxUser2 = contextForAgent({ userId: "user-2", agentId: user2AgentId });
        const user2Agent = Agent.restore(
            ctxUser2,
            descriptor,
            state,
            new AgentInbox(user2AgentId),
            {} as unknown as Parameters<typeof Agent.restore>[4],
            new UserHome(path.join(baseDir, "users"), "user-2")
        );
        const selectToolCall: ToolCall = {
            type: "toolCall",
            id: "tool-2",
            name: "db_sql",
            arguments: {
                sql: "SELECT * FROM users"
            }
        };
        const user2Result = await modules.tools.execute(selectToolCall, {
            connectorRegistry: modules.connectors,
            sandbox: {
                permissions,
                workingDir: permissions.workingDir
            } as unknown as Parameters<typeof modules.tools.execute>[1]["sandbox"],
            auth,
            logger: getLogger("test.database.tool.user2"),
            assistant: null,
            agent: user2Agent,
            ctx: ctxUser2,
            source: "test",
            messageContext,
            agentSystem: null as unknown as Parameters<typeof modules.tools.execute>[1]["agentSystem"],
            heartbeats: null as unknown as Parameters<typeof modules.tools.execute>[1]["heartbeats"]
        });
        expect(user2Result.toolMessage.isError).toBe(true);
        expect(user2Result.toolMessage.content).toEqual([
            expect.objectContaining({
                text: expect.stringContaining('relation "users" does not exist')
            })
        ]);

        await instance.unload?.();
    });
});
