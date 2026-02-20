import path from "node:path";

import Handlebars from "handlebars";

import { permissionWorkspaceGranted } from "../../permissions/permissionWorkspaceGranted.js";
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
    const config = context.agentSystem?.config?.current;
    const descriptor = context.descriptor;
    const workspace = permissions?.workingDir ?? "unknown";
    const writeDirs = permissions?.writeDirs ?? [];
    const promptPaths = agentPromptPathsResolve(config?.dataDir);
    const appFolderPath =
        config && descriptor ? (agentAppFolderPathResolve(descriptor, config.workspaceDir) ?? "") : "";
    const excluded = new Set(
        [
            workspace,
            promptPaths.soulPath,
            promptPaths.userPath,
            promptPaths.agentsPath,
            promptPaths.toolsPath,
            promptPaths.memoryPath
        ]
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
        workspacePermissionGranted: permissions ? permissionWorkspaceGranted(permissions) : false,
        soulPath: promptPaths.soulPath,
        userPath: promptPaths.userPath,
        agentsPath: promptPaths.agentsPath,
        toolsPath: promptPaths.toolsPath,
        memoryPath: promptPaths.memoryPath,
        isForeground: descriptor?.type === "user",
        skillsPath: config?.configDir ? path.join(config.configDir, "skills") : "",
        additionalWriteDirs,
        network: permissions?.network ?? false,
        events: permissions?.events ?? false
    });
    return section.trim();
}
