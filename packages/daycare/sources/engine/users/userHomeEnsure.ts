import { promises as fs } from "node:fs";

import type { UserHome } from "./userHome.js";

/**
 * Ensures the full per-user directory tree exists.
 * Expects: userHome points to a concrete user root under config.usersDir.
 */
export async function userHomeEnsure(userHome: UserHome): Promise<void> {
    await Promise.all([
        fs.mkdir(userHome.apps, { recursive: true }),
        fs.mkdir(userHome.databases, { recursive: true }),
        fs.mkdir(userHome.skillsPersonal, { recursive: true }),
        fs.mkdir(userHome.skillsActive, { recursive: true }),
        fs.mkdir(userHome.skillsHistory, { recursive: true }),
        fs.mkdir(userHome.desktop, { recursive: true }),
        fs.mkdir(userHome.downloads, { recursive: true }),
        fs.mkdir(userHome.documents, { recursive: true }),
        fs.mkdir(userHome.developer, { recursive: true }),
        fs.mkdir(userHome.tmp, { recursive: true })
    ]);
}
