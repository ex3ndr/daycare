import type { Tool } from "@mariozechner/pi-ai";
import Handlebars from "handlebars";

import { agentPromptBundledRead } from "../../agents/ops/agentPromptBundledRead.js";
import { rlmPreambleBuild } from "./rlmPreambleBuild.js";

type RlmToolDescriptionTemplateContext = {
  preamble: string;
};

let rlmToolDescriptionTemplatePromise:
  Promise<HandlebarsTemplateDelegate<RlmToolDescriptionTemplateContext>> | null = null;

/**
 * Builds the run_python tool description with the generated Python tool preamble.
 * Expects: tools contains the full current tool list from ToolResolver.
 */
export async function rlmToolDescriptionBuild(tools: Tool[]): Promise<string> {
  const preamble = rlmPreambleBuild(tools);
  const template = await rlmToolDescriptionTemplateCompile();
  return template({ preamble }).trim();
}

async function rlmToolDescriptionTemplateCompile(): Promise<
  HandlebarsTemplateDelegate<RlmToolDescriptionTemplateContext>
> {
  if (rlmToolDescriptionTemplatePromise) {
    return rlmToolDescriptionTemplatePromise;
  }
  rlmToolDescriptionTemplatePromise = agentPromptBundledRead("SYSTEM_TOOLS_RLM.md")
    .then((source) => Handlebars.compile<RlmToolDescriptionTemplateContext>(source));
  return rlmToolDescriptionTemplatePromise;
}
