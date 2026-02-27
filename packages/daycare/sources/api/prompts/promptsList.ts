import type { AgentPromptFilesPaths } from "../../engine/agents/ops/agentPromptFilesEnsure.js";

export const PROMPT_FILES = ["SOUL.md", "USER.md", "AGENTS.md", "TOOLS.md"] as const;
export type PromptFileName = (typeof PROMPT_FILES)[number];

// Maps prompt filenames to UserHome knowledge path keys
export const PROMPT_PATH_KEY: Record<PromptFileName, keyof AgentPromptFilesPaths> = {
    "SOUL.md": "soulPath",
    "USER.md": "userPath",
    "AGENTS.md": "agentsPath",
    "TOOLS.md": "toolsPath"
};

/**
 * Returns the list of editable prompt file names.
 * Expects: no arguments; returns a static whitelist.
 */
export function promptsList(): { ok: true; files: readonly string[] } {
    return { ok: true, files: PROMPT_FILES };
}

/**
 * Checks whether a filename is a valid prompt file.
 * Expects: filename is a non-empty string.
 */
export function promptsFilenameValidate(filename: string): filename is PromptFileName {
    return (PROMPT_FILES as readonly string[]).includes(filename);
}
