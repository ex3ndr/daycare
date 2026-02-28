import { promises as fs } from "node:fs";
import path from "node:path";
import type { Context } from "@/types";
import type { Secret } from "./secretTypes.js";

/**
 * Persists user secrets to `<usersDir>/<encodedUserId>/secrets.json` using atomic rename.
 * Expects: secrets are already validated by callers.
 */
export async function secretSave(usersDir: string, ctx: Context, secrets: Secret[]): Promise<void> {
    const filePath = secretPathResolve(usersDir, ctx);
    const directory = path.dirname(filePath);
    await fs.mkdir(directory, { recursive: true });

    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    const json = `${JSON.stringify(secrets, null, 4)}\n`;
    await fs.writeFile(tempPath, json, "utf8");
    await fs.rename(tempPath, filePath);
}

function secretPathResolve(usersDir: string, ctx: Context): string {
    return path.join(path.resolve(usersDir), encodeURIComponent(ctx.userId), "secrets.json");
}
