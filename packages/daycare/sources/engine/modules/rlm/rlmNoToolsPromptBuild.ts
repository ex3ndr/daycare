import type { Tool } from "@mariozechner/pi-ai";
import Handlebars from "handlebars";
import { agentPromptBundledRead } from "../../agents/ops/agentPromptBundledRead.js";
import { bundledExamplesDirResolve } from "../../agents/ops/bundledExamplesDirResolve.js";
import { montyPreambleBuild } from "../monty/montyPreambleBuild.js";

type RlmNoToolsPromptTemplateContext = {
    preamble: string;
    pythonTools: string;
    isForeground: boolean;
};

export type RlmNoToolsPromptBuildOptions = {
    isForeground?: boolean;
    examplesDir?: string;
};

let rlmNoToolsPromptTemplatePromise: Promise<HandlebarsTemplateDelegate<RlmNoToolsPromptTemplateContext>> | null = null;

type PythonToolsTemplateContext = {
    examplesDir: string;
};

let pythonToolsTemplatePromise: Promise<HandlebarsTemplateDelegate<PythonToolsTemplateContext>> | null = null;

/** Reads and caches the shared TOOLS_PYTHON.md Python execution instructions. */
async function toolsPythonRead(examplesDir: string): Promise<string> {
    const template = await toolsPythonTemplateCompile();
    return template({ examplesDir }).trim();
}

async function toolsPythonTemplateCompile(): Promise<HandlebarsTemplateDelegate<PythonToolsTemplateContext>> {
    if (!pythonToolsTemplatePromise) {
        pythonToolsTemplatePromise = agentPromptBundledRead("TOOLS_PYTHON.md").then((source) =>
            Handlebars.compile<PythonToolsTemplateContext>(source)
        );
    }
    return pythonToolsTemplatePromise;
}

/**
 * Builds run_python tool-calling instructions for the system prompt.
 * Expects: tools contains the full runtime tool list used for Monty dispatch.
 */
export async function rlmNoToolsPromptBuild(
    tools: Tool[],
    options: RlmNoToolsPromptBuildOptions = {}
): Promise<string> {
    const isForeground = options.isForeground ?? true;
    const examplesDir = options.examplesDir ?? bundledExamplesDirResolve();
    const preamble = montyPreambleBuild(tools);
    const pythonTools = await toolsPythonRead(examplesDir);
    const template = await rlmNoToolsPromptTemplateCompile();
    return template({ preamble, pythonTools, isForeground }).trim();
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
