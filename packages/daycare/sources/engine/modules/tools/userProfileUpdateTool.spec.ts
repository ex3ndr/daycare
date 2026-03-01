import { describe, expect, it } from "vitest";

import type { ToolExecutionContext } from "@/types";
import type { Storage } from "../../../storage/storage.js";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { userProfileUpdateTool } from "./userProfileUpdateTool.js";

const toolCall = { id: "tool-1", name: "user_profile_update" };

describe("userProfileUpdateTool", () => {
    it("updates structured profile fields for current user", async () => {
        const storage = await storageOpenTest();
        try {
            const created = await storage.users.create({
                id: "user-1",
                nametag: "swift-fox-42"
            });
            const tool = userProfileUpdateTool();

            const result = await tool.execute(
                {
                    firstName: "  Steve  ",
                    lastName: "  Jobs  ",
                    country: " us ",
                    timezone: " America/Los_Angeles "
                },
                contextBuild(created.id, storage),
                toolCall
            );

            expect(result.toolMessage.isError).toBe(false);
            expect(result.typedResult).toMatchObject({
                userId: created.id,
                firstName: "Steve",
                lastName: "Jobs",
                country: "US",
                timezone: "America/Los_Angeles",
                nametag: "swift-fox-42"
            });
        } finally {
            storage.connection.close();
        }
    });

    it("supports clearing optional fields with null", async () => {
        const storage = await storageOpenTest();
        try {
            const created = await storage.users.create({
                id: "user-2",
                nametag: "happy-penguin-55",
                firstName: "Taylor",
                lastName: "Swift",
                country: "US"
            });
            const tool = userProfileUpdateTool();

            const result = await tool.execute(
                {
                    lastName: null,
                    country: null,
                    timezone: null
                },
                contextBuild(created.id, storage),
                toolCall
            );

            expect(result.typedResult.firstName).toBe("Taylor");
            expect(result.typedResult.lastName).toBeNull();
            expect(result.typedResult.country).toBeNull();
            expect(result.typedResult.timezone).toBeNull();
        } finally {
            storage.connection.close();
        }
    });

    it("rejects invalid timezone values", async () => {
        const storage = await storageOpenTest();
        try {
            const created = await storage.users.create({
                id: "user-4",
                nametag: "calm-bird-12"
            });
            const tool = userProfileUpdateTool();

            await expect(
                tool.execute(
                    {
                        timezone: "Mars/Base"
                    },
                    contextBuild(created.id, storage),
                    toolCall
                )
            ).rejects.toThrow("Invalid timezone: Mars/Base");
        } finally {
            storage.connection.close();
        }
    });

    it("requires at least one field", async () => {
        const storage = await storageOpenTest();
        try {
            const created = await storage.users.create({
                id: "user-3",
                nametag: "lazy-dog-90"
            });
            const tool = userProfileUpdateTool();

            await expect(tool.execute({}, contextBuild(created.id, storage), toolCall)).rejects.toThrow(
                "At least one profile field must be provided."
            );
        } finally {
            storage.connection.close();
        }
    });
});

function contextBuild(userId: string, storage: Storage): ToolExecutionContext {
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox: null as unknown as ToolExecutionContext["sandbox"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: {
            id: "caller-agent",
            descriptor: { type: "user", connector: "test", userId, channelId: "channel-1" }
        } as unknown as ToolExecutionContext["agent"],
        ctx: { agentId: "caller-agent", userId } as unknown as ToolExecutionContext["ctx"],
        source: "test",
        messageContext: {},
        agentSystem: {
            storage
        } as unknown as ToolExecutionContext["agentSystem"]
    };
}
