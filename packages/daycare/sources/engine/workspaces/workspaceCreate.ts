import { promises as fs } from "node:fs";

import { createId } from "@paralleldrive/cuid2";
import type { Storage } from "../../storage/storage.js";
import type { UserHome } from "../users/userHome.js";
import { userHomeEnsure } from "../users/userHomeEnsure.js";
import type { WorkspaceConfig, WorkspaceRecord } from "./workspaceTypes.js";

type WorkspaceCreateInput = {
    ownerUserId: string;
    config: WorkspaceConfig;
    storage: Pick<Storage, "users">;
    userHomeForUserId: (userId: string) => UserHome;
};

/**
 * Creates a workspace as a child user with persisted workspace config and home structure.
 * Expects: ownerUserId exists and config fields are non-empty.
 */
export async function workspaceCreate(input: WorkspaceCreateInput): Promise<WorkspaceRecord> {
    const ownerUserId = input.ownerUserId.trim();
    if (!ownerUserId) {
        throw new Error("ownerUserId is required.");
    }

    const firstName = input.config.firstName.trim();
    const lastName = input.config.lastName?.trim() ?? null;
    const bio = input.config.bio.trim();
    const about = input.config.about?.trim() ?? null;
    const systemPrompt = input.config.systemPrompt.trim();
    const emoji = input.config.emoji.trim();
    if (!firstName) {
        throw new Error("Workspace firstName is required.");
    }
    if (!bio) {
        throw new Error("Workspace bio is required.");
    }
    if (!systemPrompt) {
        throw new Error("Workspace systemPrompt is required.");
    }
    if (!emoji) {
        throw new Error("Workspace emoji is required.");
    }

    const now = Date.now();
    const createdUser = await input.storage.users.create({
        id: createId(),
        isOwner: false,
        isWorkspace: true,
        parentUserId: ownerUserId,
        firstName,
        lastName,
        bio,
        about,
        systemPrompt,
        emoji,
        memory: input.config.memory,
        createdAt: now,
        updatedAt: now
    });

    const record: WorkspaceRecord = {
        userId: createdUser.id,
        ownerUserId,
        nametag: createdUser.nametag,
        firstName,
        lastName,
        bio,
        about,
        systemPrompt,
        memory: input.config.memory,
        emoji,
        createdAt: now,
        updatedAt: now
    };

    const userHome = input.userHomeForUserId(record.userId);
    await userHomeEnsure(userHome);
    await fs.writeFile(userHome.knowledgePaths().soulPath, `${systemPrompt}\n`, "utf8");

    return record;
}
