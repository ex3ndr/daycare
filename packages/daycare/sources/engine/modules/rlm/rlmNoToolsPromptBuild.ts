import type { Tool } from "@mariozechner/pi-ai";
import Handlebars from "handlebars";

import { agentPromptBundledRead } from "../../agents/ops/agentPromptBundledRead.js";
import { montyPreambleBuild } from "../monty/montyPreambleBuild.js";

type RlmNoToolsPromptTemplateContext = {
    preamble: string;
    pythonTools: string;
    isForeground: boolean;
};

let rlmNoToolsPromptTemplatePromise: Promise<HandlebarsTemplateDelegate<RlmNoToolsPromptTemplateContext>> | null = null;

let pythonToolsPromise: Promise<string> | null = null;

/** Reads and caches the shared TOOLS_PYTHON.md Python execution instructions. */
function toolsPythonRead(): Promise<string> {
    if (!pythonToolsPromise) {
        pythonToolsPromise = agentPromptBundledRead("TOOLS_PYTHON.md");
    }
    return pythonToolsPromise;
}

/**
 * Builds no-tools RLM instructions for the system prompt using <run_python> tags.
 * Expects: tools contains the full runtime tool list used for Monty dispatch.
 */
export async function rlmNoToolsPromptBuild(
    tools: Tool[],
    options: { isForeground: boolean } = { isForeground: true }
): Promise<string> {
    const preamble = montyPreambleBuild(tools);
    const pythonTools = await toolsPythonRead();
    const template = await rlmNoToolsPromptTemplateCompile();
    return template({ preamble, pythonTools, isForeground: options.isForeground }).trim();
}

async function rlmNoToolsPromptTemplateCompile(): Promise<HandlebarsTemplateDelegate<RlmNoToolsPromptTemplateContext>> {
    if (rlmNoToolsPromptTemplatePromise) {
        return rlmNoToolsPromptTemplatePromise;
    }
    rlmNoToolsPromptTemplatePromise = agentPromptBundledRead("SYSTEM_TOOLS_RLM_INLINE.md").then((source) =>
        Handlebars.compile<RlmNoToolsPromptTemplateContext>(source)
    );
    return rlmNoToolsPromptTemplatePromise;
}
