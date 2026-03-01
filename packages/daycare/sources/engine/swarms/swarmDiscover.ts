import type { Storage } from "../../storage/storage.js";
import type { SwarmRecord } from "./swarmTypes.js";

type SwarmDiscoverInput = {
    ownerUserId: string;
    storage: Pick<Storage, "users">;
};

/**
 * Discovers all swarms owned by a user from user records.
 * Expects: ownerUserId is non-empty.
 */
export async function swarmDiscover(input: SwarmDiscoverInput): Promise<SwarmRecord[]> {
    const ownerUserId = input.ownerUserId.trim();
    if (!ownerUserId) {
        throw new Error("ownerUserId is required.");
    }

    const records: SwarmRecord[] = [];
    const users = await input.storage.users.findByParentUserId(ownerUserId);

    for (const user of users) {
        if (!user.isSwarm) {
            continue;
        }

        records.push({
            userId: user.id,
            ownerUserId,
            nametag: user.nametag,
            firstName: user.firstName ?? user.nametag,
            lastName: user.lastName,
            bio: user.bio ?? "",
            about: user.about,
            systemPrompt: user.systemPrompt ?? "",
            memory: user.memory,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        });
    }

    return records.sort((left, right) => left.nametag.localeCompare(right.nametag));
}
