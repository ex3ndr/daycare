import type { Tool } from "@mariozechner/pi-ai";
import Handlebars from "handlebars";

import { agentPromptBundledRead } from "../../agents/ops/agentPromptBundledRead.js";
import { montyPreambleBuild } from "../monty/montyPreambleBuild.js";

type RlmToolDescriptionTemplateContext = {
    preamble: string;
    pythonTools: string;
};

let rlmToolDescriptionTemplatePromise: Promise<HandlebarsTemplateDelegate<RlmToolDescriptionTemplateContext>> | null =
    null;

/**
 * Builds the run_python tool description with the generated Python tool preamble.
 * Expects: tools contains the full current tool list from ToolResolver.
 */
export async function rlmToolDescriptionBuild(tools: Tool[]): Promise<string> {
    const preamble = montyPreambleBuild(tools);
    const pythonTools = await toolsPythonRead();
    const template = await rlmToolDescriptionTemplateCompile();
    return template({ preamble, pythonTools }).trim();
}

let pythonToolsPromise: Promise<string> | null = null;

/** Reads and caches the shared TOOLS_PYTHON.md Python execution instructions. */
function toolsPythonRead(): Promise<string> {
    if (!pythonToolsPromise) {
        pythonToolsPromise = agentPromptBundledRead("TOOLS_PYTHON.md");
    }
    return pythonToolsPromise;
}

async function rlmToolDescriptionTemplateCompile(): Promise<
    HandlebarsTemplateDelegate<RlmToolDescriptionTemplateContext>
> {
    if (rlmToolDescriptionTemplatePromise) {
        return rlmToolDescriptionTemplatePromise;
    }
    rlmToolDescriptionTemplatePromise = agentPromptBundledRead("SYSTEM_TOOLS_RLM.md").then((source) =>
        Handlebars.compile<RlmToolDescriptionTemplateContext>(source)
    );
    return rlmToolDescriptionTemplatePromise;
}
