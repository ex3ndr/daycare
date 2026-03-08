import { describe, expect, it } from "vitest";

import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { workspaceSystemEnsure } from "./workspaceSystemEnsure.js";

describe("workspaceSystemEnsure", () => {
    it("creates the reserved ownerless system workspace with ready defaults", async () => {
        const storage = await storageOpenTest();
        try {
            await workspaceSystemEnsure({ storage });

            const workspace = await storage.users.findByNametag("##system##");
            expect(workspace).toMatchObject({
                id: "system",
                isWorkspace: true,
                workspaceOwnerId: null,
                firstName: "System",
                lastName: "Workspace",
                emoji: "❌",
                systemPrompt: null,
                configuration: {
                    homeReady: true,
                    appReady: true
                }
            });
        } finally {
            storage.connection.close();
        }
    });

    it("is idempotent when the system workspace already exists", async () => {
        const storage = await storageOpenTest();
        try {
            await workspaceSystemEnsure({ storage });
            const first = await storage.users.findByNametag("##system##");

            await workspaceSystemEnsure({ storage });

            const second = await storage.users.findByNametag("##system##");
            const systemUsers = (await storage.users.findMany()).filter((user) => user.nametag === "##system##");
            expect(second?.id).toBe(first?.id);
            expect(systemUsers).toHaveLength(1);
        } finally {
            storage.connection.close();
        }
    });

    it('rejects a reserved nametag record that does not use id "system"', async () => {
        const storage = await storageOpenTest();
        try {
            await storage.users.create({
                id: "workspace-system-1",
                isWorkspace: true,
                nametag: "##system##"
            });

            await expect(workspaceSystemEnsure({ storage })).rejects.toThrow(
                'The reserved system workspace must use id "system".'
            );
        } finally {
            storage.connection.close();
        }
    });
});
