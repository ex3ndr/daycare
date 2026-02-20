import path from "node:path";

import {
    DEFAULT_AGENTS_PATH,
    DEFAULT_MEMORY_PATH,
    DEFAULT_SOUL_PATH,
    DEFAULT_TOOLS_PATH,
    DEFAULT_USER_PATH
} from "../../../paths.js";
import type { AgentPromptFilesPaths } from "./agentPromptFilesEnsure.js";

/**
 * Resolves prompt memory file paths from config data dir with default fallbacks.
 * Expects: dataDir is optional and, when present, points to the Daycare data root.
 */
export function agentPromptPathsResolve(dataDir?: string): AgentPromptFilesPaths {
    const resolvedDataDir = dataDir?.trim() ? path.resolve(dataDir) : "";
    if (resolvedDataDir) {
        return {
            soulPath: path.join(resolvedDataDir, "SOUL.md"),
            userPath: path.join(resolvedDataDir, "USER.md"),
            agentsPath: path.join(resolvedDataDir, "AGENTS.md"),
            toolsPath: path.join(resolvedDataDir, "TOOLS.md"),
            memoryPath: path.join(resolvedDataDir, "MEMORY.md")
        };
    }
    return {
        soulPath: DEFAULT_SOUL_PATH,
        userPath: DEFAULT_USER_PATH,
        agentsPath: DEFAULT_AGENTS_PATH,
        toolsPath: DEFAULT_TOOLS_PATH,
        memoryPath: DEFAULT_MEMORY_PATH
    };
}
