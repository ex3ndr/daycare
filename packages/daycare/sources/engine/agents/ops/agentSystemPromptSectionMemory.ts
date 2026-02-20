import { promises as fs } from "node:fs";
import path from "node:path";

import Handlebars from "handlebars";

import { agentDescriptorIsCron } from "./agentDescriptorIsCron.js";
import { agentPromptBundledRead } from "./agentPromptBundledRead.js";
import { agentPromptPathsResolve } from "./agentPromptPathsResolve.js";
import type { AgentSystemPromptContext } from "./agentSystemPromptContext.js";

/**
 * Renders memory guidance using prompt-memory files and cron metadata.
 * Expects: context matches agentSystemPrompt input shape.
 */
export async function agentSystemPromptSectionMemory(context: AgentSystemPromptContext = {}): Promise<string> {
    const descriptor = context.descriptor;
    const isForeground = descriptor?.type === "user";
    const promptPaths = agentPromptPathsResolve(context.agentSystem?.config?.current.dataDir);
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

    const [soul, user, agents, tools, memory, cronData] = await Promise.all([
        readPromptFile(promptPaths.soulPath, "SOUL.md"),
        readPromptFile(promptPaths.userPath, "USER.md"),
        readPromptFile(promptPaths.agentsPath, "AGENTS.md"),
        readPromptFile(promptPaths.toolsPath, "TOOLS.md"),
        readPromptFile(promptPaths.memoryPath, "MEMORY.md"),
        (async () => {
            const tasks = await context.agentSystem?.crons?.listTasks();
            if (!tasks || tasks.length === 0 || !descriptor || !agentDescriptorIsCron(descriptor)) {
                return {
                    cronTaskId: "",
                    cronTaskName: "",
                    cronMemoryPath: "",
                    cronFilesPath: ""
                };
            }
            const task = tasks.find((entry) => entry.taskUid === descriptor.id) ?? null;
            return {
                cronTaskId: task?.id ?? "",
                cronTaskName: task?.name ?? "",
                cronMemoryPath: task?.memoryPath ?? "",
                cronFilesPath: task?.filesPath ?? ""
            };
        })()
    ]);

    const template = await agentPromptBundledRead("SYSTEM_MEMORY.md");
    const section = Handlebars.compile(template)({
        isForeground,
        workspace: context.permissions?.workingDir ?? "unknown",
        configDir: context.agentSystem?.config?.current.configDir ?? "",
        cronTaskId: cronData.cronTaskId,
        cronTaskName: cronData.cronTaskName,
        cronMemoryPath: cronData.cronMemoryPath,
        cronFilesPath: cronData.cronFilesPath,
        soulPath: promptPaths.soulPath,
        userPath: promptPaths.userPath,
        agentsPath: promptPaths.agentsPath,
        toolsPath: promptPaths.toolsPath,
        memoryPath: promptPaths.memoryPath,
        soul,
        user,
        agents,
        tools,
        memory
    });
    return section.trim();
}
