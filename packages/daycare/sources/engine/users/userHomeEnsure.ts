import { promises as fs } from "node:fs";

import { agentPromptFilesEnsure } from "../agents/ops/agentPromptFilesEnsure.js";
import type { UserHome } from "./userHome.js";

/**
 * Ensures the full per-user directory tree and seeded knowledge files exist.
 * Expects: userHome points to a concrete user root under config.usersDir.
 */
export async function userHomeEnsure(userHome: UserHome): Promise<void> {
    await Promise.all([
        fs.mkdir(userHome.skills, { recursive: true }),
        fs.mkdir(userHome.apps, { recursive: true }),
        fs.mkdir(userHome.desktop, { recursive: true }),
        fs.mkdir(userHome.downloads, { recursive: true }),
        fs.mkdir(userHome.documents, { recursive: true }),
        fs.mkdir(userHome.developer, { recursive: true }),
        fs.mkdir(userHome.knowledge, { recursive: true }),
        fs.mkdir(userHome.memory, { recursive: true }),
        fs.mkdir(userHome.tmp, { recursive: true })
    ]);
    await agentPromptFilesEnsure(userHome.knowledgePaths());
}
