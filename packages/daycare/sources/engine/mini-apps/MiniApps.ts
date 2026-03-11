import { promises as fs } from "node:fs";
import path from "node:path";
import type { Context } from "@/types";
import type { MiniAppsRepository } from "../../storage/miniAppsRepository.js";
import type { Storage } from "../../storage/storage.js";
import { AsyncLock } from "../../utils/lock.js";
import { contextForUser } from "../agents/context.js";
import { miniAppDirectoryResolve } from "./miniAppDirectoryResolve.js";
import { miniAppIdNormalize } from "./miniAppIdNormalize.js";
import { miniAppRecordFromDb } from "./miniAppRecordFromDb.js";
import type { MiniAppCreateInput, MiniAppRecord, MiniAppUpdateInput } from "./miniAppTypes.js";
import { miniAppVersionWrite } from "./miniAppVersionWrite.js";

type MiniAppsOptions = {
    usersDir: string;
    storage: Pick<Storage, "miniApps">;
};

/**
 * Facade for mini-app metadata and versioned static file management.
 * Expects: repository is migrated and usersDir points at the shared user homes root.
 */
export class MiniApps {
    private readonly usersDir: string;
    private readonly repository: MiniAppsRepository;
    private readonly locks = new Map<string, AsyncLock>();

    constructor(options: MiniAppsOptions) {
        this.usersDir = options.usersDir;
        this.repository = options.storage.miniApps;
    }

    async list(ctx: Context): Promise<MiniAppRecord[]> {
        const records = await this.repository.findAll(ctx);
        return records.map((record) => miniAppRecordFromDb(record));
    }

    async find(ctx: Context, id: string): Promise<MiniAppRecord | null> {
        const record = await this.repository.findById(ctx, miniAppIdNormalize(id));
        return record ? miniAppRecordFromDb(record) : null;
    }

    async create(ctx: Context, input: MiniAppCreateInput): Promise<MiniAppRecord> {
        const id = miniAppIdNormalize(input.id);
        const title = input.title.trim();
        const icon = input.icon.trim();
        const html = input.html.trim();
        if (!title) {
            throw new Error("Mini app title is required.");
        }
        if (!icon) {
            throw new Error("Mini app icon is required.");
        }
        if (!html) {
            throw new Error("Mini app html is required.");
        }

        return this.lockFor(ctx.userId, id).inLock(async () => {
            const createdAt = Date.now();
            const versionDir = miniAppDirectoryResolve(this.usersDir, ctx.userId, id, 1);
            await fs.rm(versionDir, { recursive: true, force: true });
            try {
                await miniAppVersionWrite({
                    directory: versionDir,
                    html,
                    files: input.files
                });
                const record = await this.repository.create(ctx, {
                    id,
                    title,
                    icon,
                    createdAt,
                    updatedAt: createdAt
                });
                return miniAppRecordFromDb(record);
            } catch (error) {
                await fs.rm(path.join(versionDir, "..", ".."), { recursive: true, force: true });
                throw error;
            }
        });
    }

    async update(ctx: Context, id: string, input: MiniAppUpdateInput): Promise<MiniAppRecord> {
        const normalizedId = miniAppIdNormalize(id);

        return this.lockFor(ctx.userId, normalizedId).inLock(async () => {
            const current = await this.repository.findById(ctx, normalizedId);
            if (!current) {
                throw new Error(`Mini app not found: ${normalizedId}`);
            }
            const currentVersion = current.version ?? 1;
            const nextVersion = currentVersion + 1;
            const currentDir = miniAppDirectoryResolve(this.usersDir, ctx.userId, normalizedId, currentVersion);
            const nextDir = miniAppDirectoryResolve(this.usersDir, ctx.userId, normalizedId, nextVersion);
            await fs.rm(nextDir, { recursive: true, force: true });
            await fs.mkdir(path.dirname(nextDir), { recursive: true });
            await fs.cp(currentDir, nextDir, { recursive: true });
            try {
                await miniAppVersionWrite({
                    directory: nextDir,
                    html: input.html ?? (await fs.readFile(path.join(currentDir, "index.html"), "utf8")),
                    files: input.files,
                    deletePaths: input.deletePaths
                });
                const record = await this.repository.update(ctx, normalizedId, {
                    title: input.title,
                    icon: input.icon,
                    updatedAt: Date.now()
                });
                return miniAppRecordFromDb(record);
            } catch (error) {
                await fs.rm(nextDir, { recursive: true, force: true });
                throw error;
            }
        });
    }

    async delete(ctx: Context, id: string): Promise<MiniAppRecord> {
        const normalizedId = miniAppIdNormalize(id);
        return this.lockFor(ctx.userId, normalizedId).inLock(async () => {
            const deleted = await this.repository.delete(ctx, normalizedId);
            return miniAppRecordFromDb(deleted);
        });
    }

    async versionDirectory(ctx: Context, id: string): Promise<string | null> {
        const record = await this.repository.findById(ctx, miniAppIdNormalize(id));
        if (!record) {
            return null;
        }
        return miniAppDirectoryResolve(this.usersDir, ctx.userId, record.id, record.version ?? 1);
    }

    async versionDirectoryForUser(userId: string, id: string): Promise<string | null> {
        const record = await this.repository.findById(contextForUser({ userId }), miniAppIdNormalize(id));
        if (!record) {
            return null;
        }
        return miniAppDirectoryResolve(this.usersDir, userId, id, record.version ?? 1);
    }

    private lockFor(userId: string, id: string): AsyncLock {
        const key = `${userId}\u0000${id}`;
        const existing = this.locks.get(key);
        if (existing) {
            return existing;
        }
        const created = new AsyncLock();
        this.locks.set(key, created);
        return created;
    }
}
