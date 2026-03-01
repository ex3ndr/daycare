import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { contextForAgent } from "../agents/context.js";
import { UserHome } from "../users/userHome.js";
import { Subusers } from "./subusers.js";

describe("Subusers", () => {
    it("emits subuser create/configure observations", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-subusers-facade-"));
        const storage = await storageOpenTest();
        try {
            const owner = await storage.users.findOwner();
            if (!owner) {
                throw new Error("Expected owner user in test storage.");
            }
            const updateAgentDescriptor = vi.fn();
            const subusers = new Subusers({
                storage,
                userHomeForUserId: (userId) => new UserHome(path.join(dir, "users"), userId),
                updateAgentDescriptor
            });
            const ownerCtx = contextForAgent({ userId: owner.id, agentId: "owner-agent" });

            const created = await subusers.create(ownerCtx, {
                name: "helper",
                systemPrompt: "You are helper."
            });
            await subusers.configure(ownerCtx, {
                subuserId: created.subuserId,
                systemPrompt: "You are better helper."
            });

            const observations = await storage.observationLog.findMany({ userId: owner.id, agentId: "owner-agent" });
            expect(observations.map((entry) => entry.type)).toEqual(
                expect.arrayContaining(["subuser:created", "subuser:configured"])
            );
            expect(updateAgentDescriptor).toHaveBeenCalled();
        } finally {
            storage.connection.close();
            await rm(dir, { recursive: true, force: true });
        }
    });
});
