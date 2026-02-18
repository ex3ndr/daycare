import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { toolExecutionResultText, toolReturnText } from "../modules/tools/toolReturnText.js";
import { Type, type Static } from "@sinclair/typebox";

import type { ToolDefinition } from "@/types";
import type { AppDescriptor } from "./appTypes.js";
import { appExecute } from "./appExecute.js";
import { appToolNameFormat } from "./appToolNameFormat.js";

const schema = Type.Object(
  {
    prompt: Type.String({ minLength: 1 }),
    wait: Type.Optional(Type.Boolean())
  },
  { additionalProperties: false }
);

type AppToolBuildArgs = Static<typeof schema>;

/**
 * Builds the per-app `app_<name>` tool definition.
 * Expects: descriptor is a validated discovered app.
 */
export function appToolBuild(app: AppDescriptor): ToolDefinition {
  const toolName = appToolNameFormat(app.id);
  return {
    tool: {
      name: toolName,
      description: app.manifest.description,
      parameters: schema
    },
    returns: toolReturnText,
    execute: async (args, context, toolCall) => {
      const payload = args as AppToolBuildArgs;
      const prompt = payload.prompt.trim();
      const waitForResponse = payload.wait ?? false;
      if (!prompt) {
        throw new Error("App prompt is required.");
      }
      const result = await appExecute({
        app,
        prompt,
        context,
        waitForResponse
      });
      const responseText = result.responseText;
      const text = waitForResponse
        ? (responseText && responseText.trim().length > 0
          ? `${responseText}\n\nApp agent id: ${result.agentId}`
          : `App "${app.manifest.title}" completed without a text response. App agent id: ${result.agentId}`)
        : `App "${app.manifest.title}" started asynchronously. App agent id: ${result.agentId}`;
      const toolMessage: ToolResultMessage = {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: "text", text }],
        details: { agentId: result.agentId, appId: app.id, waitForResponse },
        isError: false,
        timestamp: Date.now()
      };
      return toolExecutionResultText(toolMessage);
    }
  };
}
