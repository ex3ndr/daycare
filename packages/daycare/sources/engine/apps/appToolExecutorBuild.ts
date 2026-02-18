import type { Tool, ToolCall, ToolResultMessage } from "@mariozechner/pi-ai";
import type { Logger } from "pino";
import type { ProviderSettings } from "../../settings.js";

import { getLogger } from "../../log.js";
import type { ToolExecutionContext, ToolExecutionResult } from "@/types";
import type { ToolResolverApi } from "../modules/toolResolver.js";
import { toolExecutionResultText } from "../modules/tools/toolReturnText.js";
import type { InferenceRouter } from "../modules/inference/router.js";
import { RLM_TOOL_NAME } from "../modules/rlm/rlmConstants.js";
import type { AppRuleSet } from "./appTypes.js";
import { appToolReview } from "./appToolReview.js";

type AppToolExecutorBuildInput = {
  appId: string;
  appName: string;
  appSystemPrompt: string;
  reviewerEnabled: boolean;
  rlmEnabled: boolean;
  sourceIntent: string;
  rules: AppRuleSet;
  inferenceRouter: InferenceRouter;
  toolResolver: ToolResolverApi;
  providersOverride?: ProviderSettings[];
  allowedToolNames?: string[];
  logger?: Logger;
};

type AppToolExecutor = {
  listTools: () => Tool[];
  execute: (toolCall: ToolCall, context: ToolExecutionContext) => Promise<ToolExecutionResult>;
};

const DEFAULT_ALLOWED_TOOLS = ["read", "write", "edit", "exec", "request_permission", RLM_TOOL_NAME];

/**
 * Wraps a tool resolver with app-review middleware for each tool call.
 * Expects: input.toolResolver is the runtime resolver used by agent execution.
 */
export function appToolExecutorBuild(input: AppToolExecutorBuildInput): AppToolExecutor {
  const appLogger = input.logger ?? getLogger("engine.apps.executor");
  const allowedToolNames = new Set(input.allowedToolNames ?? DEFAULT_ALLOWED_TOOLS);

  return {
    listTools: () => input.toolResolver.listTools().filter((tool) => allowedToolNames.has(tool.name)),
    execute: async (toolCall, context) => {
      if (!allowedToolNames.has(toolCall.name)) {
        appLogger.warn(
          { appId: input.appId, tool: toolCall.name },
          "deny: App tool denied because tool is outside the app allowlist"
        );
        return toolExecutionResultText(
          appToolErrorBuild(
            toolCall,
            `Tool "${toolCall.name}" is not available in app sandbox.`
          )
        );
      }

      const availableTools = input.toolResolver
        .listTools()
        .filter((tool) => allowedToolNames.has(tool.name))
        .map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }));

      if (!input.reviewerEnabled) {
        appLogger.info(
          { appId: input.appId, tool: toolCall.name, allowed: true },
          "review: App tool review disabled by security config"
        );
        return input.toolResolver.execute(toolCall, context);
      }

      const decision = await appToolReview({
        appId: input.appId,
        appName: input.appName,
        appSystemPrompt: input.appSystemPrompt,
        rlmEnabled: input.rlmEnabled,
        sourceIntent: input.sourceIntent,
        toolCall,
        rules: input.rules,
        availableTools,
        inferenceRouter: input.inferenceRouter,
        providersOverride: input.providersOverride
      });
      if (!decision.allowed) {
        const reason = decision.reason ?? "Denied by app review rules.";
        appLogger.info(
          { appId: input.appId, tool: toolCall.name, allowed: false, reason },
          "review: App tool call denied"
        );
        return toolExecutionResultText(
          appToolErrorBuild(toolCall, `App review denied this tool call: ${reason}`)
        );
      }

      appLogger.info(
        { appId: input.appId, tool: toolCall.name, allowed: true },
        "review: App tool call allowed"
      );
      return input.toolResolver.execute(toolCall, context);
    }
  };
}

function appToolErrorBuild(toolCall: ToolCall, text: string): ToolResultMessage {
  return {
    role: "toolResult",
    toolCallId: toolCall.id,
    toolName: toolCall.name,
    content: [{ type: "text", text }],
    isError: true,
    timestamp: Date.now()
  };
}
