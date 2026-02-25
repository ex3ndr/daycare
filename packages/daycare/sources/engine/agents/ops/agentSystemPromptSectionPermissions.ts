import Handlebars from "handlebars";

import { agentPromptBundledRead } from "./agentPromptBundledRead.js";
import type { AgentSystemPromptContext } from "./agentSystemPromptContext.js";
import { bundledExamplesDirResolve } from "./bundledExamplesDirResolve.js";

/**
 * Renders permissions details using ~/relative paths for home subdirectories.
 * Expects: context.userHome is set.
 */
export async function agentSystemPromptSectionPermissions(context: AgentSystemPromptContext): Promise<string> {
    if (!context.userHome) {
        throw new Error("User home is required to render permissions section.");
    }

    const homeDirs = [
        { name: "desktop", label: "workspace" },
        { name: "downloads" },
        { name: "documents" },
        { name: "developer" },
        { name: "knowledge" },
        { name: "memory" },
        { name: "tmp" }
    ];
    const examplesHostDir = bundledExamplesDirResolve();
    const examplesDockerDir = "/shared/examples";

    const template = await agentPromptBundledRead("SYSTEM_PERMISSIONS.md");
    const section = Handlebars.compile(template)({
        homeDirs,
        examplesHostDir,
        examplesDockerDir
    });
    return section.trim();
}
