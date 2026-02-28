import { promises as fs } from "node:fs";
import path from "node:path";
import type { Context } from "@/types";
import { UserHome } from "../../../engine/users/userHome.js";
import { PROMPT_PATH_KEY, promptsFilenameValidate } from "./promptsList.js";

export type PromptsWriteInput = {
    ctx: Context;
    usersDir: string;
    filename: string;
    content: string;
};

export type PromptsWriteResult = { ok: true; filename: string } | { ok: false; error: string };

/**
 * Writes content to a user's prompt file, creating directories as needed.
 * Expects: ctx carries authenticated userId; filename is from the whitelist; content is a string.
 */
export async function promptsWrite(input: PromptsWriteInput): Promise<PromptsWriteResult> {
    if (!promptsFilenameValidate(input.filename)) {
        return { ok: false, error: `Unknown prompt file: ${input.filename}` };
    }

    const userHome = new UserHome(input.usersDir, input.ctx.userId);
    const paths = userHome.knowledgePaths();
    const filePath = paths[PROMPT_PATH_KEY[input.filename]];

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, input.content, "utf8");

    return { ok: true, filename: input.filename };
}
