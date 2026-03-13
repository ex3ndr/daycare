import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext } from "@/types";
import { nowTool } from "./nowTool.js";

const toolCall = { id: "tool-1", name: "now" };
const fixedNowAt = new Date("2026-03-12T10:11:12.000Z").getTime();

describe("nowTool", () => {
    beforeEach(() => {
        vi.spyOn(Date, "now").mockReturnValue(fixedNowAt);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("uses the profile timezone when available", async () => {
        const result = await nowTool().execute(
            {},
            contextBuild({ id: "user-1", timezone: "America/Los_Angeles" }),
            toolCall
        );

        expect(result.typedResult).toMatchObject({
            unixTimeMs: fixedNowAt,
            unixTimeSeconds: 1773310272,
            isoTimeUtc: "2026-03-12T10:11:12.000Z",
            timezone: "America/Los_Angeles",
            timezoneSource: "profile",
            localDate: "2026-03-12",
            localTime: "03:11:12",
            localDateTime: "2026-03-12 03:11:12"
        });
        expect(result.typedResult.timezoneAbbr).toBe("PDT");
    });

    it("falls back to UTC when profile timezone is missing or invalid", async () => {
        const result = await nowTool().execute({}, contextBuild({ id: "user-2", timezone: "Mars/Base" }), toolCall);

        expect(result.typedResult).toMatchObject({
            timezone: "UTC",
            timezoneSource: "default",
            localDate: "2026-03-12",
            localTime: "10:11:12",
            localDateTime: "2026-03-12 10:11:12"
        });
    });
});

function contextBuild(user: { id: string; timezone?: string | null }): ToolExecutionContext {
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox: null as unknown as ToolExecutionContext["sandbox"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: {
            id: "caller-agent",
            descriptor: { type: "user", connector: "test", userId: user.id, channelId: "channel-1" }
        } as unknown as ToolExecutionContext["agent"],
        ctx: { agentId: "caller-agent", userId: user.id } as unknown as ToolExecutionContext["ctx"],
        source: "test",
        messageContext: {},
        agentSystem: {
            storage: {
                users: {
                    findById: async (userId: string) => ({
                        id: userId,
                        timezone: user.timezone ?? null
                    })
                }
            }
        } as unknown as ToolExecutionContext["agentSystem"]
    };
}
