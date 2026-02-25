import { describe, expect, it } from "vitest";
import type { Signal } from "@/types";
import type { AgentInboxItem } from "./agentTypes.js";
import { inboxItemDeserialize } from "./inboxItemDeserialize.js";
import { inboxItemSerialize } from "./inboxItemSerialize.js";

describe("inboxItemSerialize", () => {
    it("round-trips all durable inbox item types", () => {
        const signal: Signal = {
            id: "signal-1",
            type: "build:done",
            source: { type: "system", userId: "user-1" },
            data: { ok: true },
            createdAt: 123
        };
        const cases: AgentInboxItem[] = [
            {
                type: "message",
                message: { text: "hello" },
                context: { messageId: "m-1" }
            },
            {
                type: "system_message",
                text: "sync now",
                origin: "cron",
                silent: true,
                execute: true,
                code: ["print('hello')"],
                context: { messageId: "m-2" }
            },
            {
                type: "signal",
                signal,
                subscriptionPattern: "build:*"
            },
            {
                type: "reset",
                message: "start over",
                context: { messageId: "m-3" }
            },
            {
                type: "compact",
                context: { messageId: "m-4" }
            },
            {
                type: "restore"
            }
        ];

        for (const item of cases) {
            const roundTrip = inboxItemDeserialize(inboxItemSerialize(item));
            expect(roundTrip).toEqual(item);
        }
    });
});
