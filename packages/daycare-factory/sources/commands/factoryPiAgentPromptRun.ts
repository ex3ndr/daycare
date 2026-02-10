import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  AuthStorage,
  createAgentSession,
  ModelRegistry,
  SessionManager,
  SettingsManager
} from "@mariozechner/pi-coding-agent";
import { FACTORY_PI_DIR_MOUNT_PATH } from "../constants.js";
import { factoryBuildHistoryAppend } from "../history/factoryBuildHistoryAppend.js";

export interface FactoryPiAgentPromptRunInput {
  attempt: number;
  feedback?: string;
  historyPath?: string;
}

interface FactoryPiAgentPromptRunDependencies {
  createAgentSessionUse?: typeof createAgentSession;
}

/**
 * Runs a Pi coding agent prompt from TASK.md and template-provided AGENTS.md.
 * Expects: ~/.pi is mounted in container at /root/.pi with readable auth files.
 */
export async function factoryPiAgentPromptRun(
  taskPath: string,
  outDirectory: string,
  input: FactoryPiAgentPromptRunInput = {
    attempt: 1
  },
  dependencies: FactoryPiAgentPromptRunDependencies = {}
): Promise<void> {
  const createAgentSessionUse =
    dependencies.createAgentSessionUse ?? createAgentSession;
  const agentDir = join(FACTORY_PI_DIR_MOUNT_PATH, "agent");
  const authPath = join(agentDir, "auth.json");

  await access(authPath, constants.R_OK).catch(() => {
    throw new Error(
      `Pi auth file is required in container: ${authPath}. Mount host ~/.pi as readonly.`
    );
  });

  const taskContents = await readFile(taskPath, "utf-8");
  const agentsPath = join(outDirectory, "AGENTS.md");
  const agentsContents = await readFile(agentsPath, "utf-8");
  const historyPath = input.historyPath;
  const authStorage = new AuthStorage(authPath);
  const modelRegistry = new ModelRegistry(authStorage, join(agentDir, "models.json"));

  if (historyPath) {
    await factoryBuildHistoryAppend(historyPath, {
      type: "pi.session.start",
      attempt: input.attempt
    });
  }

  const { session, modelFallbackMessage } = await createAgentSessionUse({
    cwd: dirname(taskPath),
    agentDir,
    authStorage,
    modelRegistry,
    sessionManager: SessionManager.inMemory(),
    settingsManager: SettingsManager.inMemory()
  });

  if (modelFallbackMessage) {
    console.log(modelFallbackMessage);
    if (historyPath) {
      await factoryBuildHistoryAppend(historyPath, {
        type: "pi.model_fallback",
        attempt: input.attempt,
        message: modelFallbackMessage
      });
    }
  }

  session.subscribe((event) => {
    if (historyPath) {
      void factoryBuildHistoryAppend(historyPath, {
        type: "pi.event",
        attempt: input.attempt,
        event
      }).catch((error: unknown) => {
        const details =
          error instanceof Error ? error.message : "failed to write pi event";
        console.error(`[pi] history write error: ${details}`);
      });
    }

    if (
      event.type === "message_update" &&
      event.assistantMessageEvent.type === "text_delta"
    ) {
      process.stdout.write(event.assistantMessageEvent.delta);
      return;
    }
    if (event.type === "tool_execution_start") {
      console.log(`\n[pi] tool start: ${event.toolName}`);
      return;
    }
    if (event.type === "tool_execution_end") {
      console.log(`[pi] tool end: ${event.toolName}`);
    }
  });

  const promptText = factoryPiPromptBuild(
    taskPath,
    outDirectory,
    taskContents,
    agentsContents,
    input
  );
  if (historyPath) {
    await factoryBuildHistoryAppend(historyPath, {
      type: "pi.prompt.start",
      attempt: input.attempt
    });
  }

  await session.prompt(promptText);

  if (historyPath) {
    await factoryBuildHistoryAppend(historyPath, {
      type: "pi.prompt.end",
      attempt: input.attempt
    });
  }

  process.stdout.write("\n");
}

function factoryPiPromptBuild(
  taskPath: string,
  outDirectory: string,
  taskContents: string,
  agentsContents: string,
  input: FactoryPiAgentPromptRunInput
): string {
  const feedback = input.feedback
    ? `Previous attempt feedback:
${input.feedback}
`
    : "No previous attempt feedback yet.";

  return `Use this task to prepare the build workspace.

Task file path: ${taskPath}
Output directory: ${outDirectory}
Attempt: ${input.attempt}

TASK.md contents:
${taskContents}

AGENTS.md contents:
${agentsContents}

${feedback}

Requirements:
- Read and follow TASK.md.
- Prepare files needed for the build.
- You do not have direct access to the test implementation.
- If previous attempt feedback exists, use it to fix output files for the next run.
- Keep outputs scoped to the output directory when possible.
- Reply with a short completion summary when done.`;
}
