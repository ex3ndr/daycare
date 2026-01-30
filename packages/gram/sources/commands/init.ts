import { promises as fs } from "node:fs";

import { getLogger } from "../log.js";
import { DEFAULT_SCOUT_DIR, DEFAULT_SOUL_PATH } from "../paths.js";

const logger = getLogger("command.init");

const DEFAULT_SOUL_CONTENT = `# System Prompt

You are a helpful assistant. Be concise and direct in your responses.

## Guidelines

- Respond in the same language as the user
- Ask clarifying questions when needed
- Be honest about limitations
`;

export type InitOptions = {
  force?: boolean;
};

export async function initCommand(options: InitOptions): Promise<void> {
  logger.info("Initializing gram configuration");

  await fs.mkdir(DEFAULT_SCOUT_DIR, { recursive: true });

  const soulExists = await fileExists(DEFAULT_SOUL_PATH);
  if (soulExists && !options.force) {
    console.log(`SOUL.md already exists at ${DEFAULT_SOUL_PATH}`);
    console.log("Use --force to overwrite");
    return;
  }

  await fs.writeFile(DEFAULT_SOUL_PATH, DEFAULT_SOUL_CONTENT, "utf8");
  console.log(`Created ${DEFAULT_SOUL_PATH}`);
  console.log("Edit this file to customize your assistant's personality.");
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
