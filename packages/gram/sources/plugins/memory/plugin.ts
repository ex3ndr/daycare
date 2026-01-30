import path from "node:path";

import { z } from "zod";

import { definePlugin } from "../../engine/plugins/types.js";
import type { EngineEvent } from "../../engine/ipc/events.js";
import type { FileReference } from "../../files/types.js";
import { MemoryEngine } from "./engine.js";
import { buildMemoryTool } from "./tool.js";

const settingsSchema = z
  .object({
    basePath: z.string().optional(),
    maxEntries: z.number().optional()
  })
  .passthrough();

type MemorySettings = z.infer<typeof settingsSchema>;

type IncomingPayload = {
  sessionId: string;
  source: string;
  entry?: {
    id: string;
    message: {
      text?: string | null;
      files?: FileReference[] | undefined;
    };
  };
};

type OutgoingPayload = {
  sessionId: string;
  source: string;
  message?: {
    text?: string | null;
    files?: FileReference[] | undefined;
  };
};

export const plugin = definePlugin({
  settingsSchema,
  create: (api) => {
    const settings = api.settings as MemorySettings;
    const engineMemory = api.engineSettings.memory;
    const basePath =
      resolvePluginPath(api.dataDir, settings.basePath) ??
      path.join(api.dataDir, "memory");
    const memory = new MemoryEngine({
      basePath,
      dataDir: api.dataDir,
      maxEntries: settings.maxEntries ?? engineMemory?.maxEntries
    });
    let unsubscribe: (() => void) | null = null;

    const handleEvent = (event: EngineEvent) => {
      if (event.type === "session.updated") {
        const payload = event.payload as IncomingPayload | null;
        if (!payload?.entry?.message) {
          return;
        }
        const message = payload.entry.message;
        const text = typeof message.text === "string" ? message.text : null;
        const files = message.files ?? [];
        if (!text && files.length === 0) {
          return;
        }
        void memory.record({
          sessionId: payload.sessionId,
          source: payload.source,
          role: "user",
          text,
          files: files.length > 0 ? files : undefined
        });
        return;
      }

      if (event.type === "session.outgoing") {
        const payload = event.payload as OutgoingPayload | null;
        if (!payload?.message) {
          return;
        }
        const message = payload.message;
        const text = typeof message.text === "string" ? message.text : null;
        const files = message.files ?? [];
        if (!text && files.length === 0) {
          return;
        }
        void memory.record({
          sessionId: payload.sessionId,
          source: payload.source,
          role: "assistant",
          text,
          files: files.length > 0 ? files : undefined
        });
      }
    };

    return {
      load: async () => {
        api.registrar.registerTool(buildMemoryTool(memory));
        if (api.engineEvents) {
          unsubscribe = api.engineEvents.onEvent(handleEvent);
        }
      },
      unload: async () => {
        unsubscribe?.();
        unsubscribe = null;
        api.registrar.unregisterTool("memory_search");
      }
    };
  }
});

function resolvePluginPath(baseDir: string, target?: string): string | undefined {
  if (!target) {
    return undefined;
  }
  return path.isAbsolute(target) ? target : path.join(baseDir, target);
}
