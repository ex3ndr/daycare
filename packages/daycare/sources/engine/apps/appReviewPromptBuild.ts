import type { AppRuleSet } from "./appTypes.js";

type AppReviewPromptBuildInput = {
  appName: string;
  appSystemPrompt: string;
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
export function appReviewPromptBuild(input: AppReviewPromptBuildInput): string {
  const argsText = argsSerialize(input.args);
  const availableTools = toolsSerialize(input.availableTools);
  const appSystemPrompt = systemPromptSerialize(input.appSystemPrompt);
  const allowRules =
    input.rules.allow.length > 0
      ? input.rules.allow.map((rule) => `- ${rule.text}`).join("\n")
      : "- (none)";
  const denyRules =
    input.rules.deny.length > 0
      ? input.rules.deny.map((rule) => `- ${rule.text}`).join("\n")
      : "- (none)";

  return [
    `You are a security reviewer for the app "${input.appName}".`,
    "A tool call is being made. Decide if it should be ALLOWED or DENIED based on the rules below.",
    "",
    "## Tool Call",
    `- Tool: ${input.toolName}`,
    `- Arguments: ${argsText}`,
    "",
    "## Available Tools In This Sandbox",
    availableTools,
    "",
    "Interpret the tool call strictly against this tool list and descriptions.",
    "Do not reinterpret tool names using unrelated language/runtime built-ins.",
    `For example: tool "exec" is the Daycare exec tool from this list, not Python exec().`,
    "",
    "## App System Prompt",
    appSystemPrompt,
    "",
    "## Source Intent",
    input.sourceIntent,
    "",
    "## Allow Rules",
    allowRules,
    "",
    "## Deny Rules",
    denyRules,
    "",
    "Respond with exactly one of:",
    "- ALLOW",
    "- DENY: <reason>"
  ].join("\n");
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
