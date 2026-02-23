import { promises as fs } from "node:fs";
import path from "node:path";

import Handlebars from "handlebars";

import { agentPromptBundledRead } from "./agentPromptBundledRead.js";
import { agentPromptPathsResolve } from "./agentPromptPathsResolve.js";
import type { AgentSystemPromptContext } from "./agentSystemPromptContext.js";

/**
 * Renders memory guidance using prompt-memory files.
 * Expects: context matches agentSystemPrompt input shape.
 */
export async function agentSystemPromptSectionMemory(context: AgentSystemPromptContext): Promise<string> {
    const descriptor = context.descriptor;
    const isForeground = descriptor?.type === "user";
    if (!context.userHome) {
        throw new Error("User home is required to render memory section.");
    }
    const promptPaths = agentPromptPathsResolve(context.userHome);
    const readPromptFile = async (filePath: string, fallbackPrompt: string): Promise<string> => {
        const resolvedPath = path.resolve(filePath);
        try {
            const content = await fs.readFile(resolvedPath, "utf8");
            const trimmed = content.trim();
            if (trimmed.length > 0) {
                return trimmed;
            }
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
                throw error;
            }
        }
        return (await agentPromptBundledRead(fallbackPrompt)).trim();
    };

    const [soul, user, agents, tools] = await Promise.all([
        readPromptFile(promptPaths.soulPath, "SOUL.md"),
        readPromptFile(promptPaths.userPath, "USER.md"),
        readPromptFile(promptPaths.agentsPath, "AGENTS.md"),
        readPromptFile(promptPaths.toolsPath, "TOOLS.md")
    ]);

    const template = await agentPromptBundledRead("SYSTEM_MEMORY.md");
    const section = Handlebars.compile(template)({
        isForeground,
        workspace: context.permissions?.workingDir ?? "unknown",
        configDir: context.agentSystem?.config?.current.configDir ?? "",
        soulPath: promptPaths.soulPath,
        userPath: promptPaths.userPath,
        agentsPath: promptPaths.agentsPath,
        toolsPath: promptPaths.toolsPath,
        soul,
        user,
        agents,
        tools
    });
    return section.trim();
}
