import type { Storage } from "../../storage/storage.js";
import type { UserHome } from "../users/userHome.js";
import { swarmCreate } from "./swarmCreate.js";
import { swarmDiscover } from "./swarmDiscover.js";
import type { SwarmConfig, SwarmRecord } from "./swarmTypes.js";

type SwarmsOptions = {
    storage: Pick<Storage, "users" | "swarmContacts">;
    userHomeForUserId: (userId: string) => UserHome;
};

/**
 * Facade for swarm discovery, creation, and dynamic tool registration.
 * Expects: owner discovery runs before registerTools.
 */
export class Swarms {
    private readonly storage: Pick<Storage, "users" | "swarmContacts">;
    private readonly userHomeForUserId: (userId: string) => UserHome;
    private ownerUserId: string | null = null;
    private records: SwarmRecord[] = [];

    constructor(options: SwarmsOptions) {
        this.storage = options.storage;
        this.userHomeForUserId = options.userHomeForUserId;
    }

    async discover(ownerUserId: string): Promise<SwarmRecord[]> {
        this.ownerUserId = ownerUserId;
        this.records = await swarmDiscover({
            ownerUserId,
            storage: this.storage
        });
        return this.list();
    }

    async create(ownerUserId: string, config: SwarmConfig): Promise<SwarmRecord> {
        const created = await swarmCreate({
            ownerUserId,
            config,
            storage: this.storage,
            userHomeForUserId: this.userHomeForUserId
        });
        this.ownerUserId = ownerUserId;
        const next = this.records.filter((record) => record.userId !== created.userId);
        next.push(created);
        this.records = next.sort((left, right) => left.nametag.localeCompare(right.nametag));
        return created;
    }

    get(nametag: string): SwarmRecord | null {
        const normalized = nametag.trim();
        if (!normalized) {
            return null;
        }
        return this.records.find((record) => record.nametag === normalized) ?? null;
    }

    list(): SwarmRecord[] {
        return [...this.records].sort((left, right) => left.nametag.localeCompare(right.nametag));
    }

    mountsForOwner(ownerUserId: string): Array<{ hostPath: string; mappedPath: string }> {
        if (this.ownerUserId !== ownerUserId) {
            return [];
        }
        return this.records.map((record) => ({
            hostPath: this.userHomeForUserId(record.userId).home,
            mappedPath: `/share/swarm/${record.nametag}`
        }));
    }
}
