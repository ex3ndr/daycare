import Handlebars from "handlebars";

import { agentPromptBundledRead } from "../agents/ops/agentPromptBundledRead.js";
import type { AppRuleSet } from "./appTypes.js";

type AppReviewPromptBuildInput = {
  appName: string;
  appSystemPrompt: string;
  rlmEnabled: boolean;
  sourceIntent: string;
  toolName: string;
  args: unknown;
  rules: AppRuleSet;
  availableTools: Array<{
    name: string;
    description: string;
    parameters: unknown;
  }>;
};

/**
 * Builds the review-model prompt for a pending app tool call.
 * Expects: tool metadata and app rules are already normalized.
 */
export async function appReviewPromptBuild(input: AppReviewPromptBuildInput): Promise<string> {
  const template = await reviewerTemplateCompile();
  const allowRules =
    input.rules.allow.length > 0
      ? input.rules.allow.map((rule) => `- ${rule.text}`).join("\n")
      : "- (none)";
  const denyRules =
    input.rules.deny.length > 0
      ? input.rules.deny.map((rule) => `- ${rule.text}`).join("\n")
      : "- (none)";

  return template({
    appName: input.appName,
    toolName: input.toolName,
    argsText: argsSerialize(input.args),
    availableToolsText: toolsSerialize(input.availableTools),
    appSystemPrompt: systemPromptSerialize(input.appSystemPrompt),
    rlmEnabled: input.rlmEnabled,
    sourceIntent: systemPromptSerialize(input.sourceIntent),
    allowRules,
    denyRules
  }).trim();
}

function systemPromptSerialize(systemPrompt: string): string {
  const trimmed = systemPrompt.trim();
  if (trimmed.length === 0) {
    return "(none)";
  }
  return trimmed;
}

function argsSerialize(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? "null";
  } catch {
    return "<unserializable>";
  }
}

function toolsSerialize(
  tools: Array<{ name: string; description: string; parameters: unknown }>
): string {
  if (tools.length === 0) {
    return "- (none)";
  }
  return tools
    .map((tool) => {
      const parameters = argsSerialize(tool.parameters);
      return [
        `- Name: ${tool.name}`,
        `  Description: ${tool.description || "(none)"}`,
        `  Parameters: ${parameters}`
      ].join("\n");
    })
    .join("\n");
}

type ReviewerTemplateContext = {
  appName: string;
  toolName: string;
  argsText: string;
  availableToolsText: string;
  appSystemPrompt: string;
  rlmEnabled: boolean;
  sourceIntent: string;
  allowRules: string;
  denyRules: string;
};

let reviewerTemplate: HandlebarsTemplateDelegate<ReviewerTemplateContext> | null = null;

async function reviewerTemplateCompile(): Promise<HandlebarsTemplateDelegate<ReviewerTemplateContext>> {
  if (reviewerTemplate) {
    return reviewerTemplate;
  }
  const source = (await agentPromptBundledRead("REVIEWER.md")).trim();
  reviewerTemplate = Handlebars.compile<ReviewerTemplateContext>(source);
  return reviewerTemplate;
}
