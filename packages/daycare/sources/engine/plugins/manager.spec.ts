import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthStore } from "../../auth/store.js";
import { configResolve } from "../../config/configResolve.js";
import { getLogger } from "../../log.js";
import type { PluginInstanceSettings } from "../../settings.js";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { contextForUser } from "../agents/context.js";
import { ConfigModule } from "../config/configModule.js";
import { FileFolder } from "../files/fileFolder.js";
import { InferenceRouter } from "../modules/inference/router.js";
import { ModuleRegistry } from "../modules/moduleRegistry.js";
import { Processes } from "../processes/processes.js";
import type { PluginEvent } from "./events.js";
import { PluginManager } from "./manager.js";
import { PluginRegistry } from "./registry.js";

const tempRoots: string[] = [];

async function createTempDir(): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-plugin-test-"));
    tempRoots.push(dir);
    return dir;
}

async function writePluginFile(dir: string, source: string): Promise<string> {
    const pluginPath = path.join(dir, "plugin.js");
    await fs.writeFile(pluginPath, source, "utf8");
    return pluginPath;
}

async function createManager(
    entryPath: string,
    pluginId: string,
    rootDir: string,
    onEvent?: (event: PluginEvent) => void,
    processes?: Processes
): Promise<{ manager: PluginManager; modules: ModuleRegistry; config: ConfigModule }> {
    const modules = new ModuleRegistry({ onMessage: () => {} });
    const pluginRegistry = new PluginRegistry(modules);
    const config = configResolve({ engine: { dataDir: rootDir } }, path.join(rootDir, "settings.json"));
    const configModule = new ConfigModule(config);
    const auth = new AuthStore(config);
    const fileStore = new FileFolder(path.join(config.dataDir, "files"));
    const inferenceRouter = new InferenceRouter({
        registry: modules.inference,
        auth,
        config: configModule
    });
    const catalog = new Map([
        [
            pluginId,
            {
                descriptor: {
                    id: pluginId,
                    name: "Test Plugin",
                    description: "Test plugin",
                    entry: entryPath
                },
                entryPath,
                descriptorPath: path.join(rootDir, "plugin.json"),
                pluginDir: path.dirname(entryPath)
            }
        ]
    ]);
    const storage = await storageOpenTest();
    const processesRuntime =
        processes ??
        new Processes(rootDir, getLogger("test.processes"), {
            repository: storage.processes
        });
    return {
        modules,
        config: configModule,
        manager: new PluginManager({
            config: configModule,
            registry: pluginRegistry,
            auth,
            fileStore,
            pluginCatalog: catalog,
            inferenceRouter,
            processes: processesRuntime,
            exposes: {
                registerProvider: async () => undefined,
                unregisterProvider: async () => undefined,
                listProviders: () => []
            },
            onEvent
        })
    };
}

describe("PluginManager", () => {
    afterEach(async () => {
        const pending = tempRoots.splice(0, tempRoots.length);
        await Promise.all(
            pending.map(async (dir) => {
                await fs.rm(dir, { recursive: true, force: true });
            })
        );
    });

    it("runs plugin instances without isolation across loads", async () => {
        const dir = await createTempDir();
        const pluginSource = `import { z } from "zod";

export const plugin = {
  settingsSchema: z.object({}).passthrough(),
  create: (api) => ({
    load: async () => {
      const globalRef = globalThis;
      globalRef.__counter = (globalRef.__counter ?? 0) + 1;
      api.events.emit({
        type: "test",
        payload: {
          count: globalRef.__counter,
          instance: api.instance.instanceId
        }
      });
    }
  })
};
`;
        const entryPath = await writePluginFile(dir, pluginSource);
        const events: PluginEvent[] = [];
        const { manager } = await createManager(entryPath, "isolated", dir, (event) => {
            events.push(event);
        });

        const alpha: PluginInstanceSettings = {
            instanceId: "alpha",
            pluginId: "isolated",
            enabled: true,
            settings: {}
        };
        const beta: PluginInstanceSettings = {
            instanceId: "beta",
            pluginId: "isolated",
            enabled: true,
            settings: {}
        };

        await manager.load(alpha);
        await manager.load(beta);

        expect(events).toHaveLength(2);
        const counts = events.map((event) => (event.payload as { count: number }).count);
        expect(counts).toEqual([1, 2]);
    });

    it("syncs load/unload from settings changes", async () => {
        const dir = await createTempDir();
        const pluginSource = `import { z } from "zod";

export const plugin = {
  settingsSchema: z.object({}).passthrough(),
  create: () => ({
    load: async () => {},
    unload: async () => {}
  })
};
`;
        const entryPath = await writePluginFile(dir, pluginSource);
        const { manager, config } = await createManager(entryPath, "sync", dir);

        config.configSet(
            configResolve(
                {
                    engine: { dataDir: dir },
                    plugins: [
                        {
                            instanceId: "sync-one",
                            pluginId: "sync",
                            enabled: true,
                            settings: {}
                        }
                    ]
                },
                path.join(dir, "settings.json")
            )
        );
        await manager.reload();
        expect(manager.listLoaded()).toEqual(["sync-one"]);

        config.configSet(
            configResolve(
                {
                    engine: { dataDir: dir },
                    plugins: [
                        {
                            instanceId: "sync-one",
                            pluginId: "sync",
                            enabled: false
                        }
                    ]
                },
                path.join(dir, "settings.json")
            )
        );
        await manager.reload();
        expect(manager.listLoaded()).toEqual([]);
    });

    it("does not reload when plugin settings are deep-equal", async () => {
        const dir = await createTempDir();
        const pluginSource = `import { z } from "zod";

export const plugin = {
  settingsSchema: z.object({
    nested: z.object({
      alpha: z.number(),
      bravo: z.number()
    })
  }),
  create: (api) => ({
    load: async () => {
      api.events.emit({ type: "loaded", payload: { settings: api.settings } });
    },
    unload: async () => {
      api.events.emit({ type: "unloaded", payload: {} });
    }
  })
};
`;
        const entryPath = await writePluginFile(dir, pluginSource);
        const events: PluginEvent[] = [];
        const { manager, config } = await createManager(entryPath, "equal", dir, (event) => {
            events.push(event);
        });

        config.configSet(
            configResolve(
                {
                    engine: { dataDir: dir },
                    plugins: [
                        {
                            instanceId: "equal-one",
                            pluginId: "equal",
                            enabled: true,
                            settings: {
                                nested: {
                                    alpha: 1,
                                    bravo: 2
                                }
                            }
                        }
                    ]
                },
                path.join(dir, "settings.json")
            )
        );
        await manager.reload();

        config.configSet(
            configResolve(
                {
                    engine: { dataDir: dir },
                    plugins: [
                        {
                            instanceId: "equal-one",
                            pluginId: "equal",
                            enabled: true,
                            settings: {
                                nested: {
                                    bravo: 2,
                                    alpha: 1
                                }
                            }
                        }
                    ]
                },
                path.join(dir, "settings.json")
            )
        );
        await manager.reload();

        expect(events.map((event) => event.type)).toEqual(["loaded"]);

        config.configSet(
            configResolve(
                {
                    engine: { dataDir: dir },
                    plugins: [
                        {
                            instanceId: "equal-one",
                            pluginId: "equal",
                            enabled: true,
                            settings: {
                                nested: {
                                    alpha: 1,
                                    bravo: 3
                                }
                            }
                        }
                    ]
                },
                path.join(dir, "settings.json")
            )
        );
        await manager.reload();

        expect(events.map((event) => event.type)).toEqual(["loaded", "unloaded", "loaded"]);
    });

    it("calls unload before registrar cleanup and removes registrations automatically", async () => {
        const dir = await createTempDir();
        const pluginSource = `import { z } from "zod";

let connectorShutdownCalled = false;
const connector = {
  capabilities: { sendText: true },
  onMessage: () => () => {},
  sendMessage: async () => {},
  shutdown: async () => {
    connectorShutdownCalled = true;
  }
};

export const plugin = {
  settingsSchema: z.object({}).passthrough(),
  create: (api) => ({
    load: async () => {
      api.registrar.registerConnector("probe-connector", connector);
    },
    unload: async () => {
      api.events.emit({
        type: "unload-order",
        payload: { connectorShutdownCalled }
      });
    }
  })
};
`;
        const entryPath = await writePluginFile(dir, pluginSource);
        const events: PluginEvent[] = [];
        const { manager, modules } = await createManager(entryPath, "probe", dir, (event) => {
            events.push(event);
        });

        await manager.load({
            instanceId: "probe",
            pluginId: "probe",
            enabled: true,
            settings: {}
        });

        expect(modules.connectors.has("probe-connector")).toBe(true);

        await manager.unload("probe");

        expect(events.find((event) => event.type === "unload-order")?.payload).toEqual({
            connectorShutdownCalled: false
        });
        expect(modules.connectors.has("probe-connector")).toBe(false);
    });

    it("unloads previous registrations when reloading the same instance id", async () => {
        const dir = await createTempDir();
        const pluginSource = `import { z } from "zod";

export const plugin = {
  settingsSchema: z.object({
    toolName: z.string()
  }),
  create: (api) => ({
    load: async () => {
      api.registrar.registerTool({
        tool: {
          name: api.settings.toolName,
          description: "dynamic tool",
          parameters: z.object({})
        },
        returns: {
          schema: {
            type: "object",
            properties: {
              text: { type: "string" }
            },
            required: ["text"],
            additionalProperties: false
          },
          toLLMText: (result) => result.text
        },
        execute: async () => ({
          toolMessage: {
            role: "toolResult",
            toolCallId: "test-call",
            toolName: api.settings.toolName,
            content: [{ type: "text", text: "ok" }],
            isError: false,
            timestamp: Date.now()
          },
          typedResult: { text: "ok" }
        })
      });
    }
  })
};
`;
        const entryPath = await writePluginFile(dir, pluginSource);
        const { manager, modules } = await createManager(entryPath, "reload", dir);

        await manager.load({
            instanceId: "reload-one",
            pluginId: "reload",
            enabled: true,
            settings: { toolName: "reload_tool_a" }
        });
        expect(modules.tools.listTools().map((tool) => tool.name)).toEqual(["reload_tool_a"]);

        await manager.load({
            instanceId: "reload-one",
            pluginId: "reload",
            enabled: true,
            settings: { toolName: "reload_tool_b" }
        });
        expect(modules.tools.listTools().map((tool) => tool.name)).toEqual(["reload_tool_b"]);

        await manager.unload("reload-one");
        expect(modules.tools.listTools()).toEqual([]);
    });

    it("runs preStart/postStart hooks in load order and isolates errors", async () => {
        const dir = await createTempDir();
        const pluginSource = `import { z } from "zod";

export const plugin = {
  settingsSchema: z.object({
    label: z.string(),
    failPreStart: z.boolean().optional(),
    failPostStart: z.boolean().optional()
  }),
  create: (api) => ({
    preStart: async () => {
      api.events.emit({
        type: "preStart",
        payload: { label: api.settings.label }
      });
      if (api.settings.failPreStart) {
        throw new Error("preStart failed");
      }
    },
    postStart: async () => {
      api.events.emit({
        type: "postStart",
        payload: { label: api.settings.label }
      });
      if (api.settings.failPostStart) {
        throw new Error("postStart failed");
      }
    }
  })
};
`;
        const entryPath = await writePluginFile(dir, pluginSource);
        const events: PluginEvent[] = [];
        const { manager } = await createManager(entryPath, "hooks", dir, (event) => {
            events.push(event);
        });

        await manager.load({
            instanceId: "hooks-a",
            pluginId: "hooks",
            enabled: true,
            settings: { label: "A", failPreStart: true }
        });
        await manager.load({
            instanceId: "hooks-b",
            pluginId: "hooks",
            enabled: true,
            settings: { label: "B", failPostStart: true }
        });

        await manager.preStartAll();
        await manager.postStartAll();

        expect(events.filter((event) => event.type === "preStart").map((event) => event.payload)).toEqual([
            { label: "A" },
            { label: "B" }
        ]);
        expect(events.filter((event) => event.type === "postStart").map((event) => event.payload)).toEqual([
            { label: "A" },
            { label: "B" }
        ]);
    });

    it("removes plugin-owned processes when unloading a plugin", async () => {
        const dir = await createTempDir();
        const pluginSource = `import { z } from "zod";

export const plugin = {
  settingsSchema: z.object({}).passthrough(),
  create: () => ({
    load: async () => {},
    unload: async () => {}
  })
};
	`;
        const entryPath = await writePluginFile(dir, pluginSource);
        const removeByOwnerSpy = vi.fn(async () => 1);
        const processes = {
            removeByOwner: removeByOwnerSpy
        } as unknown as Processes;
        const { manager } = await createManager(entryPath, "cleanup", dir, undefined, processes);

        await manager.load({
            instanceId: "cleanup-one",
            pluginId: "cleanup",
            enabled: true,
            settings: {}
        });
        await manager.unload("cleanup-one");

        expect(removeByOwnerSpy).toHaveBeenCalledWith({
            type: "plugin",
            id: "cleanup-one"
        });
    });

    it("exposes a shared .daycare/tmp directory to plugin api", async () => {
        const dir = await createTempDir();
        const pluginSource = `import { promises as fs } from "node:fs";
import { z } from "zod";

export const plugin = {
  settingsSchema: z.object({}).passthrough(),
  create: (api) => ({
    load: async () => {
      const stats = await fs.stat(api.tmpDir);
      api.events.emit({
        type: "tmp-dir",
        payload: {
          tmpDir: api.tmpDir,
          isDirectory: stats.isDirectory()
        }
      });
    }
  })
};
`;
        const entryPath = await writePluginFile(dir, pluginSource);
        const events: PluginEvent[] = [];
        const { manager } = await createManager(entryPath, "tmp-dir", dir, (event) => {
            events.push(event);
        });

        await manager.load({
            instanceId: "tmp-dir-one",
            pluginId: "tmp-dir",
            enabled: true,
            settings: {}
        });

        expect(events).toHaveLength(1);
        expect(events[0]?.payload).toEqual({
            tmpDir: path.join(dir, "tmp"),
            isDirectory: true
        });
    });

    it("always provides webhooks api to plugins", async () => {
        const dir = await createTempDir();
        const pluginSource = `import { z } from "zod";

export const plugin = {
  settingsSchema: z.object({}).passthrough(),
  create: (api) => ({
    load: async () => {
      let unavailable = null;
      try {
        await api.webhooks.trigger("missing");
      } catch (error) {
        unavailable = error instanceof Error ? error.message : String(error);
      }
      api.events.emit({
        type: "webhooks-api",
        payload: {
          hasTrigger: typeof api.webhooks.trigger === "function",
          unavailable
        }
      });
    }
  })
};
`;
        const entryPath = await writePluginFile(dir, pluginSource);
        const events: PluginEvent[] = [];
        const { manager } = await createManager(entryPath, "webhooks-api", dir, (event) => {
            events.push(event);
        });

        await manager.load({
            instanceId: "webhooks-api-one",
            pluginId: "webhooks-api",
            enabled: true,
            settings: {}
        });

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual(
            expect.objectContaining({
                pluginId: "webhooks-api",
                instanceId: "webhooks-api-one",
                type: "webhooks-api",
                payload: {
                    hasTrigger: true,
                    unavailable: "Webhook runtime unavailable."
                }
            })
        );
    });

    it("normalizes plugin system prompts from strings and structured return values", async () => {
        const dir = await createTempDir();
        const pluginSource = `import { z } from "zod";

export const plugin = {
  settingsSchema: z.object({
    mode: z.enum(["literal", "dynamic", "structured"])
  }),
  create: (api) => {
    if (api.settings.mode === "literal") {
      return {
        systemPrompt: "  Literal prompt  "
      };
    }
    if (api.settings.mode === "dynamic") {
      return {
        systemPrompt: async (context) => "  Dynamic for " + context.ctx.userId + "  "
      };
    }
    return {
      systemPrompt: async (context) => ({
        text: "  Structured prompt  ",
        images: [
          context.userDownloadsDir + "/avatar.jpg",
          "  ",
          100
        ]
      })
    };
  }
};
`;
        const entryPath = await writePluginFile(dir, pluginSource);
        const { manager } = await createManager(entryPath, "prompt-types", dir);

        await manager.load({
            instanceId: "prompt-literal",
            pluginId: "prompt-types",
            enabled: true,
            settings: { mode: "literal" }
        });
        await manager.load({
            instanceId: "prompt-dynamic",
            pluginId: "prompt-types",
            enabled: true,
            settings: { mode: "dynamic" }
        });
        await manager.load({
            instanceId: "prompt-structured",
            pluginId: "prompt-types",
            enabled: true,
            settings: { mode: "structured" }
        });

        const prompts = await manager.getSystemPrompts({
            ctx: contextForUser({ userId: "user-77" }),
            userDownloadsDir: "/tmp/user-downloads"
        });

        expect(prompts).toEqual([
            { text: "Literal prompt" },
            { text: "Dynamic for user-77" },
            { text: "Structured prompt", images: ["/tmp/user-downloads/avatar.jpg"] }
        ]);
    });
});
