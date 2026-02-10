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

interface FactoryPiAgentPromptRunDependencies {
  createAgentSessionUse?: typeof createAgentSession;
}

/**
 * Runs a Pi coding agent prompt from TASK.md using an in-memory session.
 * Expects: ~/.pi is mounted in container at /root/.pi with readable auth files.
 */
export async function factoryPiAgentPromptRun(
  taskPath: string,
  outDirectory: string,
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
  const authStorage = new AuthStorage(authPath);
  const modelRegistry = new ModelRegistry(authStorage, join(agentDir, "models.json"));

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
  }

  session.subscribe((event) => {
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

  await session.prompt(`Use this task to prepare the build workspace.

Task file path: ${taskPath}
Output directory: ${outDirectory}

TASK.md contents:
${taskContents}

Requirements:
- Read and follow TASK.md.
- Prepare files needed for the build.
- Keep outputs scoped to the output directory when possible.
- Reply with a short completion summary when done.`);

  process.stdout.write("\n");
}
