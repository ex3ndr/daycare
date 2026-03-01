import { promises as fs } from "node:fs";

import { createId } from "@paralleldrive/cuid2";
import type { Storage } from "../../storage/storage.js";
import type { UserHome } from "../users/userHome.js";
import { userHomeEnsure } from "../users/userHomeEnsure.js";
import { swarmNameNormalize } from "./swarmNameNormalize.js";
import type { SwarmConfig, SwarmRecord } from "./swarmTypes.js";

type SwarmCreateInput = {
    ownerUserId: string;
    config: SwarmConfig;
    storage: Pick<Storage, "users">;
    userHomeForUserId: (userId: string) => UserHome;
};

/**
 * Creates a swarm as a child user with persisted swarm config and home structure.
 * Expects: ownerUserId exists and config fields are non-empty.
 */
export async function swarmCreate(input: SwarmCreateInput): Promise<SwarmRecord> {
    const ownerUserId = input.ownerUserId.trim();
    if (!ownerUserId) {
        throw new Error("ownerUserId is required.");
    }

    const nametag = swarmNameNormalize(input.config.nametag);
    const firstName = input.config.firstName.trim();
    const lastName = input.config.lastName?.trim() ?? null;
    const bio = input.config.bio.trim();
    const about = input.config.about?.trim() ?? null;
    const systemPrompt = input.config.systemPrompt.trim();
    if (!firstName) {
        throw new Error("Swarm firstName is required.");
    }
    if (!bio) {
        throw new Error("Swarm bio is required.");
    }
    if (!systemPrompt) {
        throw new Error("Swarm systemPrompt is required.");
    }

    const existing = await input.storage.users.findByNametag(nametag);
    if (existing) {
        throw new Error(`Swarm already exists: ${nametag}`);
    }

    const now = Date.now();
    const createdUser = await input.storage.users.create({
        id: createId(),
        isOwner: false,
        isSwarm: true,
        parentUserId: ownerUserId,
        firstName,
        lastName,
        bio,
        about,
        systemPrompt,
        memory: input.config.memory,
        nametag,
        createdAt: now,
        updatedAt: now
    });

    const record: SwarmRecord = {
        userId: createdUser.id,
        ownerUserId,
        nametag,
        firstName,
        lastName,
        bio,
        about,
        systemPrompt,
        memory: input.config.memory,
        createdAt: now,
        updatedAt: now
    };

    const userHome = input.userHomeForUserId(record.userId);
    await userHomeEnsure(userHome);
    await fs.writeFile(userHome.knowledgePaths().soulPath, `${systemPrompt}\n`, "utf8");

    return record;
}
