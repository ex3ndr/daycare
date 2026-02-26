import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getLogger } from "../../log.js";
import { storageOpen } from "../../storage/storageOpen.js";
import { Processes } from "../processes/processes.js";
import { PluginModuleLoader } from "./loader.js";

const tempRoots: string[] = [];

async function createTempDir(): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-plugin-loader-"));
    tempRoots.push(dir);
    return dir;
}

async function writeFile(target: string, contents: string): Promise<void> {
    await fs.writeFile(target, contents, "utf8");
}

describe("PluginModuleLoader", () => {
    afterEach(async () => {
        const pending = tempRoots.splice(0, tempRoots.length);
        await Promise.all(
            pending.map(async (dir) => {
                await fs.rm(dir, { recursive: true, force: true });
            })
        );
    });

    it("loads a plugin module with local dependencies", async () => {
        const dir = await createTempDir();
        const helperPath = path.join(dir, "helper.js");
        const pluginPath = path.join(dir, "plugin.js");

        await writeFile(helperPath, `export function label(value) { return \`helper:\${value}\`; }\n`);
        await writeFile(
            pluginPath,
            `import { z } from "zod";
import { label } from "./helper.js";

export const plugin = {
  settingsSchema: z.object({ name: z.string() }),
  create: (api) => ({
    load: async () => {
      api.events.emit({ type: "loaded", payload: { label: label(api.settings.name) } });
    }
  })
};
`
        );

        const loader = new PluginModuleLoader("test-plugin");
        const { module } = await loader.load(pluginPath);
        const settings = module.settingsSchema.parse({ name: "demo" });
        const storage = storageOpen(path.join(dir, "daycare.db"));
        const instance = await module.create({
            instance: { instanceId: "demo", pluginId: "demo" },
            settings,
            engineSettings: {},
            logger: getLogger("test.loader"),
            auth: {} as never,
            dataDir: dir,
            tmpDir: path.join(dir, "tmp"),
            registrar: {} as never,
            exposes: {
                registerProvider: async () => undefined,
                unregisterProvider: async () => undefined,
                listProviders: () => []
            },
            fileStore: {} as never,
            inference: {
                complete: async () => {
                    throw new Error("Inference not available in test.");
                }
            },
            processes: new Processes(dir, getLogger("test.processes.loader"), {
                repository: storage.processes
            }),
            mode: "runtime",
            events: {
                emit: () => undefined
            }
        });

        expect(instance).toBeTruthy();
        expect(typeof instance.load).toBe("function");
    });
});
