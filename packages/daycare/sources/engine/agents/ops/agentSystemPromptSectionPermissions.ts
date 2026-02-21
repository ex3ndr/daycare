import path from "node:path";

import Handlebars from "handlebars";

import { agentAppFolderPathResolve } from "./agentAppFolderPathResolve.js";
import { agentPromptBundledRead } from "./agentPromptBundledRead.js";
import { agentPromptPathsResolve } from "./agentPromptPathsResolve.js";
import type { AgentSystemPromptContext } from "./agentSystemPromptContext.js";

/**
 * Renders permissions details from current session permissions and config paths.
 * Expects: context matches agentSystemPrompt input shape.
 */
export async function agentSystemPromptSectionPermissions(context: AgentSystemPromptContext = {}): Promise<string> {
    const permissions = context.permissions;
    const descriptor = context.descriptor;
    const workspace = permissions?.workingDir ?? "unknown";
    const writeDirs = permissions?.writeDirs ?? [];
    if (!context.userHome) {
        throw new Error("User home is required to render permissions section.");
    }
    const promptPaths = agentPromptPathsResolve(context.userHome);
    const appFolderPath =
        descriptor && context.userHome ? (agentAppFolderPathResolve(descriptor, context.userHome.apps) ?? "") : "";
    const excluded = new Set(
        [workspace, promptPaths.soulPath, promptPaths.userPath, promptPaths.agentsPath, promptPaths.toolsPath]
            .filter((entry) => entry && entry.trim().length > 0)
            .map((entry) => path.resolve(entry))
    );
    const additionalWriteDirs = Array.from(
        new Set(
            writeDirs
                .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
                .map((entry) => path.resolve(entry))
                .filter((entry) => !excluded.has(entry))
        )
    ).sort();

    const template = await agentPromptBundledRead("SYSTEM_PERMISSIONS.md");
    const section = Handlebars.compile(template)({
        workspace,
        appFolderPath,
        workspacePermissionGranted: false,
        soulPath: promptPaths.soulPath,
        userPath: promptPaths.userPath,
        agentsPath: promptPaths.agentsPath,
        toolsPath: promptPaths.toolsPath,
        isForeground: descriptor?.type === "user",
        skillsPath: context.userHome.skills,
        additionalWriteDirs,
        network: true,
        events: false
    });
    return section.trim();
}
