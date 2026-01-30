import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { pluginDescriptorSchema, type PluginDescriptor } from "./descriptor.js";

export type PluginDefinition = {
  descriptor: PluginDescriptor;
  entryPath: string;
};

const descriptorFiles = [
  new URL("./descriptors/telegram.json", import.meta.url),
  new URL("./descriptors/openai-codex.json", import.meta.url),
  new URL("./descriptors/anthropic.json", import.meta.url),
  new URL("./descriptors/brave-search.json", import.meta.url),
  new URL("./descriptors/gpt-image.json", import.meta.url),
  new URL("./descriptors/nanobanana.json", import.meta.url)
];

export function buildPluginCatalog(): Map<string, PluginDefinition> {
  const catalog = new Map<string, PluginDefinition>();

  for (const descriptorUrl of descriptorFiles) {
    const descriptorPath = fileURLToPath(descriptorUrl);
    const raw = fs.readFileSync(descriptorPath, "utf8");
    const parsed = pluginDescriptorSchema.parse(JSON.parse(raw));
    const entryPath = path.resolve(path.dirname(descriptorPath), parsed.entry);
    catalog.set(parsed.id, { descriptor: parsed, entryPath });
  }

  return catalog;
}
