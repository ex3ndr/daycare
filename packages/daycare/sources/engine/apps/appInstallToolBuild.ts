import path from "node:path";

import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { Type, type Static } from "@sinclair/typebox";

import type { ToolDefinition } from "@/types";
import { appInstall } from "./appInstall.js";
import type { Apps } from "./appManager.js";

const schema = Type.Object(
  {
    source: Type.String({ minLength: 1 })
  },
  { additionalProperties: false }
);

type AppInstallArgs = Static<typeof schema>;

/**
 * Builds the install_app tool for filesystem-based app installation.
 * Expects: source points to a directory containing APP.md and PERMISSIONS.md.
 */
export function appInstallToolBuild(apps: Apps): ToolDefinition {
  return {
    tool: {
      name: "install_app",
      description: "Install an app from a local directory containing APP.md and PERMISSIONS.md.",
      parameters: schema
    },
    execute: async (args, context, toolCall) => {
      const payload = args as AppInstallArgs;
      const source = payload.source.trim();
      if (!source) {
        throw new Error("source is required.");
      }
      const resolvedSource = path.isAbsolute(source)
        ? path.resolve(source)
        : path.resolve(context.permissions.workingDir, source);

      const descriptor = await appInstall(context.agentSystem.config.current.workspaceDir, resolvedSource);
      await apps.discover();
      apps.registerTools(context.agentSystem.toolResolver);

      const toolMessage: ToolResultMessage = {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: "text", text: `Installed app "${descriptor.id}" from ${resolvedSource}.` }],
        isError: false,
        timestamp: Date.now()
      };
      return { toolMessage };
    }
  };
}
