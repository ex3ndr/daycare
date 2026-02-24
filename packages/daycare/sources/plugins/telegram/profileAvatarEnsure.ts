import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Ensures stable avatar copies exist in the user's downloads directory.
 * Expects: cachedAvatarPaths point to plugin-owned avatar files.
 */
export async function profileAvatarEnsure(
    cachedAvatarPaths: string[],
    userDownloadsDir: string,
    telegramUserId: string
): Promise<string[]> {
    await fs.mkdir(userDownloadsDir, { recursive: true });
    const keepPaths: string[] = [];
    const keepSet = new Set<string>();
    for (const cachedAvatarPath of cachedAvatarPaths) {
        const sourceStats = await statOrNull(cachedAvatarPath);
        if (!sourceStats) {
            continue;
        }
        const targetPath = path.join(
            userDownloadsDir,
            `profile-telegram-${telegramUserId}-${path.basename(cachedAvatarPath)}`
        );
        const targetStats = await statOrNull(targetPath);
        if (!targetStats || targetStats.size !== sourceStats.size || targetStats.mtimeMs < sourceStats.mtimeMs) {
            await fs.copyFile(cachedAvatarPath, targetPath);
        }
        keepPaths.push(targetPath);
        keepSet.add(path.resolve(targetPath));
    }

    const existingEntries = await fs.readdir(userDownloadsDir);
    const userPrefix = `profile-telegram-${telegramUserId}-`;
    for (const entry of existingEntries) {
        if (!entry.startsWith(userPrefix)) {
            continue;
        }
        const existingPath = path.resolve(path.join(userDownloadsDir, entry));
        if (keepSet.has(existingPath)) {
            continue;
        }
        await fs.rm(existingPath, { force: true });
    }
    return keepPaths;
}

async function statOrNull(filePath: string): Promise<Awaited<ReturnType<typeof fs.stat>> | null> {
    try {
        return await fs.stat(filePath);
    } catch {
        return null;
    }
}
