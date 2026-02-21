import { describe, expect, it, vi } from "vitest";

import type { AgentDescriptor } from "@/types";
import type { IncomingMessageBatch } from "./incomingMessages.js";
import { IncomingMessages } from "./incomingMessages.js";

const userDescriptor = (channelId: string): AgentDescriptor => ({
    type: "user",
    connector: "telegram",
    userId: "user-1",
    channelId
});

describe("IncomingMessages", () => {
    it("debounces and combines messages for the same descriptor", async () => {
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
                descriptor: userDescriptor("channel-1"),
                message: { text: "hello" },
                context: { messageId: "1" }
            });
            await vi.advanceTimersByTimeAsync(50);
            incoming.post({
                descriptor: userDescriptor("channel-1"),
                message: { text: "world" },
                context: { messageId: "2" }
            });

            await vi.advanceTimersByTimeAsync(99);
            expect(records).toHaveLength(0);

            await vi.advanceTimersByTimeAsync(1);
            expect(records).toHaveLength(1);
            const batch = records[0] ?? [];
            expect(batch).toHaveLength(1);
            expect(batch[0]?.count).toBe(2);
            expect(batch[0]?.message.text).toBe("hello\nworld");
            expect(batch[0]?.context).toEqual({
                messageId: "2"
            });
        } finally {
            await incoming.flush();
            vi.useRealTimers();
        }
    });

    it("keeps different descriptors as separate batched items", async () => {
        vi.useFakeTimers();
        const records: Array<Array<{ descriptor: AgentDescriptor; count: number }>> = [];
        const incoming = new IncomingMessages({
            delayMs: 100,
            onFlush: async (items) => {
                records.push(items.map((item) => ({ descriptor: item.descriptor, count: item.count })));
            }
        });

        try {
            incoming.post({
                descriptor: userDescriptor("channel-1"),
                message: { text: "first" },
                context: {}
            });
            incoming.post({
                descriptor: userDescriptor("channel-2"),
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
            expect(batch[0]?.descriptor).toEqual(userDescriptor("channel-1"));
            expect(batch[1]?.descriptor).toEqual(userDescriptor("channel-2"));
        } finally {
            await incoming.flush();
            vi.useRealTimers();
        }
    });

    it("drops queued messages for one descriptor", async () => {
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
                descriptor: userDescriptor("channel-1"),
                message: { text: "old" },
                context: {}
            });
            incoming.post({
                descriptor: userDescriptor("channel-2"),
                message: { text: "keep" },
                context: {}
            });

            const dropped = incoming.dropForDescriptor(userDescriptor("channel-1"));
            expect(dropped).toBe(1);

            await vi.advanceTimersByTimeAsync(100);
            expect(records).toHaveLength(1);
            expect(records[0]).toHaveLength(1);
            expect(records[0]?.[0]?.descriptor).toEqual(userDescriptor("channel-2"));
            expect(records[0]?.[0]?.message.text).toBe("keep");
        } finally {
            await incoming.flush();
            vi.useRealTimers();
        }
    });
});
