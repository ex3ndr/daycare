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

type RlmNoToolsPythonPromptTemplateContext = {
    examplesDockerDir: string;
    examplesHostDir: string;
};

export type RlmNoToolsPromptBuildOptions = {
    isForeground?: boolean;
    examplesDockerDir?: string;
    examplesHostDir?: string;
};

let rlmNoToolsPromptTemplatePromise: Promise<HandlebarsTemplateDelegate<RlmNoToolsPromptTemplateContext>> | null = null;

let pythonToolsTemplatePromise: Promise<HandlebarsTemplateDelegate<RlmNoToolsPythonPromptTemplateContext>> | null =
    null;

/** Reads and caches the shared TOOLS_PYTHON.md Python execution instructions. */
async function toolsPythonRead(context: RlmNoToolsPythonPromptTemplateContext): Promise<string> {
    const template = await toolsPythonTemplateCompile();
    return template(context).trim();
}

async function toolsPythonTemplateCompile(): Promise<
    HandlebarsTemplateDelegate<RlmNoToolsPythonPromptTemplateContext>
> {
    if (!pythonToolsTemplatePromise) {
        pythonToolsTemplatePromise = agentPromptBundledRead("TOOLS_PYTHON.md").then((source) =>
            Handlebars.compile<RlmNoToolsPythonPromptTemplateContext>(source)
        );
    }
    return pythonToolsTemplatePromise;
}

/**
 * Builds no-tools RLM instructions for the system prompt using <run_python> tags.
 * Expects: tools contains the full runtime tool list used for Monty dispatch.
 */
export async function rlmNoToolsPromptBuild(
    tools: Tool[],
    options: RlmNoToolsPromptBuildOptions = {}
): Promise<string> {
    const isForeground = options.isForeground ?? true;
    const examplesDockerDir = options.examplesDockerDir ?? "/shared/examples";
    const examplesHostDir = options.examplesHostDir ?? bundledExamplesDirResolve();
    const preamble = montyPreambleBuild(tools);
    const pythonTools = await toolsPythonRead({
        examplesDockerDir,
        examplesHostDir
    });
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
