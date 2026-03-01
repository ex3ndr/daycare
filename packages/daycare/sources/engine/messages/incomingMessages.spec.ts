import { describe, expect, it, vi } from "vitest";

import { agentPathConnector } from "../agents/ops/agentPathBuild.js";
import type { IncomingMessageBatch } from "./incomingMessages.js";
import { IncomingMessages } from "./incomingMessages.js";

const userPath = (channelId: string) => agentPathConnector(channelId, "telegram");

describe("IncomingMessages", () => {
    it("debounces and combines messages for the same path", async () => {
        vi.useFakeTimers();
        const records: IncomingMessageBatch[][] = [];
        const incoming = new IncomingMessages({
            delayMs: 100,
            onFlush: async (items) => {
                records.push(items);
            }
        });

        try {
            incoming.post({
                path: userPath("channel-1"),
                message: { text: "hello" },
                context: { messageId: "1", timezone: "UTC" }
            });
            await vi.advanceTimersByTimeAsync(50);
            incoming.post({
                path: userPath("channel-1"),
                message: { text: "world" },
                context: { messageId: "2", timezone: "America/New_York" }
            });

            await vi.advanceTimersByTimeAsync(99);
            expect(records).toHaveLength(0);

            await vi.advanceTimersByTimeAsync(1);
            expect(records).toHaveLength(1);
            const batch = records[0] ?? [];
            expect(batch).toHaveLength(1);
            expect(batch[0]?.count).toBe(2);
            expect(batch[0]?.path).toBe(userPath("channel-1"));
            expect(batch[0]?.message.text).toBe("hello\nworld");
            expect(batch[0]?.context).toEqual({
                messageId: "2",
                timezone: "America/New_York"
            });
        } finally {
            await incoming.flush();
            vi.useRealTimers();
        }
    });

    it("keeps different paths as separate batched items", async () => {
        vi.useFakeTimers();
        const records: Array<Array<{ path: string; count: number }>> = [];
        const incoming = new IncomingMessages({
            delayMs: 100,
            onFlush: async (items) => {
                records.push(items.map((item) => ({ path: item.path, count: item.count })));
            }
        });

        try {
            incoming.post({
                path: userPath("channel-1"),
                message: { text: "first" },
                context: {}
            });
            incoming.post({
                path: userPath("channel-2"),
                message: { text: "second" },
                context: {}
            });
            await vi.advanceTimersByTimeAsync(100);

            expect(records).toHaveLength(1);
            const batch = records[0];
            if (!batch) {
                throw new Error("Expected batch record");
            }
            expect(batch).toHaveLength(2);
            expect(batch[0]?.count).toBe(1);
            expect(batch[1]?.count).toBe(1);
            expect(batch[0]?.path).toBe(userPath("channel-1"));
            expect(batch[1]?.path).toBe(userPath("channel-2"));
        } finally {
            await incoming.flush();
            vi.useRealTimers();
        }
    });

    it("drops queued messages for one path", async () => {
        vi.useFakeTimers();
        const records: IncomingMessageBatch[][] = [];
        const incoming = new IncomingMessages({
            delayMs: 100,
            onFlush: async (items) => {
                records.push(items);
            }
        });

        try {
            incoming.post({
                path: userPath("channel-1"),
                message: { text: "old" },
                context: {}
            });
            incoming.post({
                path: userPath("channel-2"),
                message: { text: "keep" },
                context: {}
            });

            const dropped = incoming.dropForPath(userPath("channel-1"));
            expect(dropped).toBe(1);

            await vi.advanceTimersByTimeAsync(100);
            expect(records).toHaveLength(1);
            expect(records[0]).toHaveLength(1);
            expect(records[0]?.[0]?.path).toBe(userPath("channel-2"));
            expect(records[0]?.[0]?.message.text).toBe("keep");
        } finally {
            await incoming.flush();
            vi.useRealTimers();
        }
    });

    it("ignores empty connector messages", async () => {
        vi.useFakeTimers();
        const records: IncomingMessageBatch[][] = [];
        const incoming = new IncomingMessages({
            delayMs: 100,
            onFlush: async (items) => {
                records.push(items);
            }
        });

        try {
            incoming.post({
                path: userPath("channel-1"),
                message: { text: "   " },
                context: {}
            });
            incoming.post({
                path: userPath("channel-1"),
                message: { text: null, rawText: "  " },
                context: {}
            });
            await vi.advanceTimersByTimeAsync(100);

            expect(records).toHaveLength(0);
        } finally {
            await incoming.flush();
            vi.useRealTimers();
        }
    });

    it("merges context enrichments without duplicates", async () => {
        vi.useFakeTimers();
        const records: IncomingMessageBatch[][] = [];
        const incoming = new IncomingMessages({
            delayMs: 100,
            onFlush: async (items) => {
                records.push(items);
            }
        });

        try {
            incoming.post({
                path: userPath("channel-1"),
                message: { text: "a" },
                context: {
                    enrichments: [{ key: "profile_name_notice", value: "Set profile name." }]
                }
            });
            incoming.post({
                path: userPath("channel-1"),
                message: { text: "b" },
                context: {
                    enrichments: [
                        { key: "profile_name_notice", value: "Set profile name." },
                        { key: "timezone_change_notice", value: "Timezone updated automatically." }
                    ]
                }
            });

            await vi.advanceTimersByTimeAsync(100);
            expect(records).toHaveLength(1);
            const batch = records[0]?.[0];
            expect(batch?.context.enrichments).toEqual([
                { key: "profile_name_notice", value: "Set profile name." },
                { key: "timezone_change_notice", value: "Timezone updated automatically." }
            ]);
        } finally {
            await incoming.flush();
            vi.useRealTimers();
        }
    });
});
