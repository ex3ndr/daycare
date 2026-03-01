import { describe, expect, it } from "vitest";

import type { Storage } from "../../../storage/storage.js";
import { agentPathTargetResolve } from "./agentPathTargetResolve.js";

describe("agentPathTargetResolve", () => {
    it("prefers exact connector target from path hint", async () => {
        const storage = storageBuild(["telegram:channel-1/user-1", "telegram:channel-1/user-2"]);

        const resolved = await agentPathTargetResolve(
            storage,
            "owner-1",
            { connectorName: "telegram" },
            "/owner-1/telegram/channel-1/user-2"
        );

        expect(resolved).toEqual({ connector: "telegram", targetId: "channel-1/user-2" });
    });

    it("falls back to legacy channel key for private channel/user hints", async () => {
        const storage = storageBuild(["telegram:123"]);

        const resolved = await agentPathTargetResolve(
            storage,
            "owner-1",
            { connectorName: "telegram" },
            "/owner-1/telegram/123/123"
        );

        expect(resolved).toEqual({ connector: "telegram", targetId: "123" });
    });

    it("uses connector prefix fallback when no path hint is provided", async () => {
        const storage = storageBuild(["telegram:channel-3/user-9"]);

        const resolved = await agentPathTargetResolve(storage, "owner-1", { connectorName: "telegram" });

        expect(resolved).toEqual({ connector: "telegram", targetId: "channel-3/user-9" });
    });
});

function storageBuild(keys: string[]): Storage {
    return {
        users: {
            findById: async () => ({
                id: "owner-1",
                connectorKeys: keys.map((connectorKey) => ({ connectorKey }))
            })
        }
    } as unknown as Storage;
}
