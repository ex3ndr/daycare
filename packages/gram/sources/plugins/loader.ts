import { promises as fs } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";

import type { PluginModule } from "./types.js";

const jsExtensions = [".js", ".mjs", ".cjs"];
const tsExtensions = [".ts", ".tsx", ".mts", ".cts"];
const moduleExtensions = [...jsExtensions, ...tsExtensions, ".json"];

export type PluginSandbox = {
  context: vm.Context;
  module: PluginModule;
};

export class PluginModuleLoader {
  private context: vm.Context;
  private moduleCache = new Map<string, vm.Module>();
  private linkPromises = new Map<string, Promise<void>>();
  private evaluatePromises = new Map<string, Promise<void>>();

  constructor(contextName: string) {
    this.context = vm.createContext(buildSandbox(), { name: contextName });
  }

  async load(entryPath: string): Promise<PluginSandbox> {
    const resolved = await resolveFile(entryPath, process.cwd());
    if (!resolved) {
      throw new Error(`Plugin entry not found: ${entryPath}`);
    }
    const module = await this.getModule(resolved);
    await this.linkModule(module);
    await this.evaluateModule(module);
    const namespace = module.namespace as unknown as {
      default?: PluginModule;
      plugin?: PluginModule;
    };
    const plugin = namespace.plugin ?? namespace.default;
    if (!plugin) {
      throw new Error(`Plugin module did not export a plugin: ${resolved}`);
    }
    return { context: this.context, module: plugin };
  }

  private async getModule(resolvedPath: string): Promise<vm.Module> {
    const identifier = pathToFileURL(resolvedPath).href;
    const cached = this.moduleCache.get(identifier);
    if (cached) {
      return cached;
    }

    const extension = path.extname(resolvedPath);
    if (extension === ".json") {
      const raw = await fs.readFile(resolvedPath, "utf8");
      const data = JSON.parse(raw) as unknown;
      const jsonModule = new vm.SyntheticModule(["default"], function () {
        this.setExport("default", data);
      }, {
        context: this.context,
        identifier
      });
      this.moduleCache.set(identifier, jsonModule);
      return jsonModule;
    }

    const source = await fs.readFile(resolvedPath, "utf8");
    const code = await maybeTranspile(source, resolvedPath);
    const module = new vm.SourceTextModule(code, {
      context: this.context,
      identifier,
      initializeImportMeta: (meta) => {
        meta.url = identifier;
      },
      importModuleDynamically: async (specifier, referencingModule) => {
        const resolved = await resolveSpecifier(specifier, referencingModule.identifier);
        const child = await this.loadResolved(resolved, referencingModule.identifier);
        await this.linkModule(child);
        await this.evaluateModule(child);
        return child;
      }
    });

    this.moduleCache.set(identifier, module);
    return module;
  }

  private async linkModule(module: vm.Module): Promise<void> {
    const identifier = module.identifier ?? "";
    const cached = this.linkPromises.get(identifier);
    if (cached) {
      await cached;
      return;
    }

    const linking = module.link(async (specifier, referencingModule) => {
      const resolved = await resolveSpecifier(specifier, referencingModule.identifier);
      const child = await this.loadResolved(resolved, referencingModule.identifier);
      await this.linkModule(child);
      return child;
    });

    this.linkPromises.set(identifier, linking);
    await linking;
  }

  private async evaluateModule(module: vm.Module): Promise<void> {
    const identifier = module.identifier ?? "";
    const cached = this.evaluatePromises.get(identifier);
    if (cached) {
      await cached;
      return;
    }
    const evaluating = module.evaluate().then(() => undefined);
    this.evaluatePromises.set(identifier, evaluating);
    await evaluating;
  }

  private async loadResolved(
    resolved: ResolvedSpecifier,
    referringIdentifier: string | null
  ): Promise<vm.Module> {
    if (resolved.type === "external") {
      const key = `external:${resolved.specifier}`;
      const cached = this.moduleCache.get(key);
      if (cached) {
        return cached;
      }
      const external = await import(resolved.specifier);
      const keys = new Set<string>(Reflect.ownKeys(external).map(String));
      keys.add("default");
      const module = new vm.SyntheticModule(Array.from(keys), function () {
        for (const key of keys) {
          this.setExport(key, key === "default" ? external : (external as Record<string, unknown>)[key]);
        }
      }, {
        context: this.context,
        identifier: resolved.specifier
      });
      this.moduleCache.set(key, module);
      return module;
    }

    const module = await this.getModule(resolved.path);
    return module;
  }
}

type ResolvedSpecifier =
  | { type: "external"; specifier: string }
  | { type: "file"; path: string };

async function resolveSpecifier(
  specifier: string,
  referrer: string | null
): Promise<ResolvedSpecifier> {
  if (specifier.startsWith("node:")) {
    return { type: "external", specifier };
  }

  if (!specifier.startsWith(".") && !specifier.startsWith("/") && !specifier.startsWith("file:")) {
    return { type: "external", specifier };
  }

  const basePath = referrer ? path.dirname(fileURLToPath(referrer)) : process.cwd();
  const target = specifier.startsWith("file:")
    ? fileURLToPath(specifier)
    : path.resolve(basePath, specifier);
  const resolved = await resolveFile(target, basePath);
  if (!resolved) {
    throw new Error(`Unable to resolve ${specifier} from ${referrer ?? basePath}`);
  }
  return { type: "file", path: resolved };
}

async function resolveFile(target: string, basePath: string): Promise<string | null> {
  const stats = await statIfExists(target);
  if (stats?.isFile()) {
    return target;
  }

  if (stats?.isDirectory()) {
    for (const ext of moduleExtensions) {
      const candidate = path.join(target, `index${ext}`);
      if (await statIfExists(candidate)) {
        return candidate;
      }
    }
  }

  const ext = path.extname(target);
  if (ext) {
    if (ext === ".js" || ext === ".mjs") {
      for (const replacement of [".ts", ".tsx", ".mts"]) {
        const candidate = target.replace(ext, replacement);
        if (await statIfExists(candidate)) {
          return candidate;
        }
      }
    }
    return null;
  }

  for (const extension of moduleExtensions) {
    const candidate = `${target}${extension}`;
    if (await statIfExists(candidate)) {
      return candidate;
    }
  }

  const require = createRequire(path.join(basePath, "index.js"));
  try {
    const resolved = require.resolve(target);
    return resolved;
  } catch {
    return null;
  }
}

async function statIfExists(target: string): Promise<ReturnType<typeof fs.stat> | null> {
  try {
    return await fs.stat(target);
  } catch {
    return null;
  }
}

async function maybeTranspile(source: string, filename: string): Promise<string> {
  if (!tsExtensions.includes(path.extname(filename))) {
    return source;
  }
  const ts = await import("typescript");
  const result = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      sourceMap: false
    },
    fileName: filename
  });
  return result.outputText;
}

function buildSandbox(): Record<string, unknown> {
  return {
    console,
    setTimeout,
    setInterval,
    clearTimeout,
    clearInterval,
    setImmediate,
    clearImmediate,
    Buffer,
    TextEncoder,
    TextDecoder,
    URL,
    URLSearchParams,
    AbortController,
    AbortSignal,
    fetch,
    Request,
    Response,
    Headers,
    process
  };
}
