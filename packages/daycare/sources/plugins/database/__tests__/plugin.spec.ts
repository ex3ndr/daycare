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
import { AgentContext } from "../../../engine/agents/agentContext.js";
import { AgentInbox } from "../../../engine/agents/ops/agentInbox.js";
import { ModuleRegistry } from "../../../engine/modules/moduleRegistry.js";
import { PluginRegistry } from "../../../engine/plugins/registry.js";
import { Processes } from "../../../engine/processes/processes.js";
import { FileStore } from "../../../files/store.js";
import { getLogger } from "../../../log.js";
import { plugin } from "../plugin.js";

describe("database plugin", () => {
    let baseDir: string;

    beforeEach(async () => {
        baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-db-plugin-"));
    });

    it("creates db files, runs SQL, and updates db.md", async () => {
        const config = configResolve({ engine: { dataDir: baseDir } }, path.join(baseDir, "settings.json"));
        const auth = new AuthStore(config);
        const fileStore = new FileStore(config);
        const modules = new ModuleRegistry({ onMessage: async () => undefined });
        const pluginRegistry = new PluginRegistry(modules);

        const instanceId = "database-1";
        const registrar = pluginRegistry.createRegistrar(instanceId);
        const now = new Date();
        const agentId = createId();
        const permissions: SessionPermissions = {
            workingDir: baseDir,
            writeDirs: [],
            readDirs: [],
            network: false,
            events: false
        };
        const messageContext = {};
        const descriptor = {
            type: "subagent",
            id: agentId,
            parentAgentId: "system",
            name: "system"
        } as const;
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
            agentId,
            "user-1",
            descriptor,
            state,
            new AgentInbox(agentId),
            {} as unknown as Parameters<typeof Agent.restore>[5]
        );
        const api = {
            instance: { instanceId, pluginId: "database" },
            settings: {},
            engineSettings: {},
            logger: getLogger("test.database"),
            auth,
            dataDir: baseDir,
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
            processes: new Processes(baseDir, getLogger("test.processes.database")),
            mode: "runtime" as const,
            events: { emit: () => undefined }
        };

        const instance = await plugin.create(api);
        await instance.load?.();

        const dbPath = path.join(baseDir, "db.pglite");
        const docPath = path.join(baseDir, "db.md");
        await expect(fs.stat(dbPath)).resolves.toBeTruthy();
        await expect(fs.stat(docPath)).resolves.toBeTruthy();

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
            fileStore,
            auth,
            logger: getLogger("test.database.tool"),
            assistant: null,
            permissions,
            agent,
            agentContext: new AgentContext(agent.id, agent.userId),
            source: "test",
            messageContext,
            agentSystem: null as unknown as Parameters<typeof modules.tools.execute>[1]["agentSystem"],
            heartbeats: null as unknown as Parameters<typeof modules.tools.execute>[1]["heartbeats"]
        });

        expect(result.toolMessage.isError).toBe(false);

        const doc = await fs.readFile(docPath, "utf8");
        expect(doc).toContain("### users");
        expect(doc).toContain("id: integer");
        expect(doc).toContain("name: text");
        expect(doc).toContain("Create users table");

        const prompt =
            typeof instance.systemPrompt === "function" ? await instance.systemPrompt() : (instance.systemPrompt ?? "");
        expect(prompt).toContain("Database plugin is active.");
        expect(prompt).toContain(doc.trim());

        await instance.unload?.();
    });
});
