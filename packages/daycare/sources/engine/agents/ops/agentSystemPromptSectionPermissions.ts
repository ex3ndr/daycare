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

    const dockerEnabled = context.agentSystem?.config?.current?.docker?.enabled ?? false;
    const examplesDir = dockerEnabled ? "/shared/examples" : bundledExamplesDirResolve();
    const template = await agentPromptBundledRead("SYSTEM_PERMISSIONS.md");
    const section = Handlebars.compile(template)({ homeDirs, examplesDir });
    return section.trim();
}
