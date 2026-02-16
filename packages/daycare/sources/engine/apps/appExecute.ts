import { createId } from "@paralleldrive/cuid2";

import type { ToolExecutionContext } from "@/types";
import { agentStateRead } from "../agents/ops/agentStateRead.js";
import { agentStateWrite } from "../agents/ops/agentStateWrite.js";
import type { AppDescriptor } from "./appTypes.js";
import { appPermissionBuild } from "./appPermissionBuild.js";
import { appReviewProvidersResolve } from "./appReviewProvidersResolve.js";
import { appToolExecutorBuild } from "./appToolExecutorBuild.js";

type AppExecuteInput = {
  app: AppDescriptor;
  prompt: string;
  context: ToolExecutionContext;
};

export type AppExecuteResult = {
  agentId: string;
  responseText: string | null;
};

/**
 * Executes an app in a dedicated app agent with reviewed tool access.
 * Expects: app descriptor is discovered/validated; prompt is non-empty.
 */
export async function appExecute(input: AppExecuteInput): Promise<AppExecuteResult> {
  const agentSystem = input.context.agentSystem;
  const config = agentSystem.config.current;
  const appPermissions = await appPermissionBuild(config.workspaceDir, input.app.id);

  const descriptor = {
    type: "app" as const,
    id: createId(),
    parentAgentId: input.context.agent.id,
    name: input.app.manifest.title,
    systemPrompt: input.app.manifest.systemPrompt,
    appId: input.app.id
  };

  const agentId = await agentSystem.agentIdForTarget({ descriptor });
  const state = await agentStateRead(config, agentId);
  if (!state) {
    throw new Error(`App agent state not found: ${agentId}`);
  }
  const updatedAt = Date.now();
  const nextState = {
    ...state,
    permissions: appPermissions,
    updatedAt
  };
  await agentStateWrite(config, agentId, nextState);
  agentSystem.updateAgentPermissions(agentId, appPermissions, updatedAt);

  const reviewProviders = appReviewProvidersResolve(config, input.app.manifest.model);
  const reviewedExecutor = appToolExecutorBuild({
    appId: input.app.id,
    appName: input.app.manifest.title,
    appSystemPrompt: input.app.manifest.systemPrompt,
    reviewerEnabled: config.settings.security.appReviewerEnabled,
    rlmEnabled: config.rlm,
    sourceIntent: input.app.permissions.sourceIntent,
    rules: input.app.permissions.rules,
    inferenceRouter: agentSystem.inferenceRouter,
    toolResolver: agentSystem.toolResolver,
    providersOverride: reviewProviders
  });

  const result = await agentSystem.postAndAwait(
    { agentId },
    {
      type: "message",
      message: { text: appTaskPromptBuild(input.app, input.prompt) },
      context: {},
      toolResolverOverride: reviewedExecutor
    }
  );
  if (result.type !== "message") {
    return { agentId, responseText: null };
  }
  return { agentId, responseText: result.responseText };
}

function appTaskPromptBuild(app: AppDescriptor, prompt: string): string {
  return [
    `You are running app "${app.manifest.title}" (${app.id}).`,
    app.manifest.description,
    "",
    "Task:",
    prompt
  ].join("\n");
}
