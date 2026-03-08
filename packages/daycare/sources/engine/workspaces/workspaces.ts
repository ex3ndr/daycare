import type { Storage } from "../../storage/storage.js";
import type { UserHome } from "../users/userHome.js";
import { workspaceCreate } from "./workspaceCreate.js";
import { workspaceDiscover } from "./workspaceDiscover.js";
import { workspaceSystemEnsure } from "./workspaceSystemEnsure.js";
import type { WorkspaceConfig, WorkspaceRecord } from "./workspaceTypes.js";

type WorkspacesOptions = {
    storage: Pick<Storage, "documents" | "users">;
    userHomeForUserId: (userId: string) => UserHome;
};

/**
 * Facade for workspace discovery, creation, and dynamic tool registration.
 * Expects: owner discovery runs before registerTools.
 */
export class Workspaces {
    private readonly storage: Pick<Storage, "documents" | "users">;
    private readonly userHomeForUserId: (userId: string) => UserHome;
    private ownerUserId: string | null = null;
    private records: WorkspaceRecord[] = [];

    constructor(options: WorkspacesOptions) {
        this.storage = options.storage;
        this.userHomeForUserId = options.userHomeForUserId;
    }

    async ensureSystem(): Promise<void> {
        await workspaceSystemEnsure({ storage: this.storage });
    }

    async discover(ownerUserId: string): Promise<WorkspaceRecord[]> {
        this.ownerUserId = ownerUserId;
        this.records = await workspaceDiscover({
            ownerUserId,
            storage: this.storage
        });
        return this.list();
    }

    async create(ownerUserId: string, config: WorkspaceConfig): Promise<WorkspaceRecord> {
        const created = await workspaceCreate({
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

    get(nametag: string): WorkspaceRecord | null {
        const normalized = nametag.trim();
        if (!normalized) {
            return null;
        }
        return this.records.find((record) => record.nametag === normalized) ?? null;
    }

    list(): WorkspaceRecord[] {
        return [...this.records].sort((left, right) => left.nametag.localeCompare(right.nametag));
    }

    mountsForOwner(ownerUserId: string): Array<{ hostPath: string; mappedPath: string }> {
        if (this.ownerUserId !== ownerUserId) {
            return [];
        }
        return this.records.map((record) => ({
            hostPath: this.userHomeForUserId(record.userId).home,
            mappedPath: `/share/workspace/${record.nametag}`
        }));
    }
}
