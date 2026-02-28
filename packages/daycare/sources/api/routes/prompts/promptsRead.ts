import { promises as fs } from "node:fs";
import type { Context } from "@/types";
import { agentPromptBundledRead } from "../../../engine/agents/ops/agentPromptBundledRead.js";
import { UserHome } from "../../../engine/users/userHome.js";
import { PROMPT_PATH_KEY, promptsFilenameValidate } from "./promptsList.js";

export type PromptsReadInput = {
    ctx: Context;
    usersDir: string;
    filename: string;
};

export type PromptsReadResult = { ok: true; filename: string; content: string } | { ok: false; error: string };

/**
 * Reads a user's prompt file content, falling back to the bundled default.
 * Expects: ctx carries authenticated userId; filename is from the whitelist.
 */
export async function promptsRead(input: PromptsReadInput): Promise<PromptsReadResult> {
    if (!promptsFilenameValidate(input.filename)) {
        return { ok: false, error: `Unknown prompt file: ${input.filename}` };
    }

    const userHome = new UserHome(input.usersDir, input.ctx.userId);
    const paths = userHome.knowledgePaths();
    const filePath = paths[PROMPT_PATH_KEY[input.filename]];

    try {
        const content = await fs.readFile(filePath, "utf8");
        if (content.trim().length > 0) {
            return { ok: true, filename: input.filename, content };
        }
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            throw error;
        }
    }

    // Fall back to bundled default
    const content = await agentPromptBundledRead(input.filename);
    return { ok: true, filename: input.filename, content };
}
