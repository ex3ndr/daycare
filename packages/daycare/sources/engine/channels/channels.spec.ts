import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { Channels } from "./channels.js";

describe("Channels", () => {
    it("creates channels and manages memberships with signal subscriptions", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-channels-"));
        try {
            const subscribe = vi.fn();
            const unsubscribe = vi.fn();
            const storage = await storageOpenTest();
            const channels = new Channels({
                channels: storage.channels,
                channelMessages: storage.channelMessages,
                signals: { subscribe, unsubscribe },
                agentSystem: {
                    agentExists: async (agentId: string) => agentId !== "missing",
                    contextForAgentId: async (agentId: string) => ({
                        agentId,
                        userId: "user-1"
                    }),
                    post: vi.fn(async () => undefined)
                } as never
            });

            await channels.ensureDir();
            const created = await channels.create({ userId: "user-1", agentId: "agent-caller" }, "dev", "leader-agent");
            expect(created.name).toBe("dev");
            expect(created.leader).toBe("leader-agent");

            await channels.addMember("dev", { agentId: "agent-alice", userId: "user-1" }, "Alice");
            await channels.addMember("dev", { agentId: "agent-bob", userId: "user-1" }, "bob");
            expect(subscribe).toHaveBeenCalledTimes(2);
            expect(subscribe).toHaveBeenCalledWith({
                ctx: expect.objectContaining({ userId: "user-1", agentId: "agent-alice" }),
                pattern: "channel.dev:*",
                silent: false
            });

            const removed = await channels.removeMember("dev", { agentId: "agent-bob", userId: "user-1" });
            expect(removed).toBe(true);
            expect(unsubscribe).toHaveBeenCalledWith({
                ctx: expect.objectContaining({ userId: "user-1", agentId: "agent-bob" }),
                pattern: "channel.dev:*"
            });
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("delivers addressed messages to mentions + leader and unaddressed only to leader", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-channels-"));
        try {
            const post = vi.fn(async () => undefined);
            const storage = await storageOpenTest();
            const channels = new Channels({
                channels: storage.channels,
                channelMessages: storage.channelMessages,
                signals: {
                    subscribe: vi.fn(),
                    unsubscribe: vi.fn()
                } as never,
                agentSystem: {
                    agentExists: async () => true,
                    contextForAgentId: async (agentId: string) => ({
                        agentId,
                        userId: "user-1"
                    }),
                    post
                } as never
            });

            await channels.ensureDir();
            await channels.create({ userId: "user-1", agentId: "agent-caller" }, "dev", "agent-leader");
            await channels.addMember("dev", { agentId: "agent-alice", userId: "user-1" }, "alice");
            await channels.addMember("dev", { agentId: "agent-bob", userId: "user-1" }, "bob");

            const mentioned = await channels.send(
                { userId: "user-1", agentId: "agent-caller" },
                "dev",
                "alice",
                "check this",
                ["bob"]
            );
            expect(mentioned.deliveredAgentIds.sort()).toEqual(["agent-bob", "agent-leader"]);
            expect(post).toHaveBeenCalledTimes(2);

            post.mockClear();
            const unaddressed = await channels.send(
                { userId: "user-1", agentId: "agent-caller" },
                "dev",
                "alice",
                "what next?",
                []
            );
            expect(unaddressed.deliveredAgentIds).toEqual(["agent-leader"]);
            expect(post).toHaveBeenCalledTimes(1);
            expect(post).toHaveBeenCalledWith(
                expect.objectContaining({ userId: "user-1", hasAgentId: false }),
                { agentId: "agent-leader" },
                expect.objectContaining({
                    type: "signal",
                    subscriptionPattern: "channel.dev:message",
                    signal: expect.objectContaining({
                        type: "channel.dev:message",
                        data: expect.objectContaining({
                            channelName: "dev",
                            senderUsername: "alice",
                            text: "what next?",
                            mentions: []
                        })
                    })
                })
            );

            const history = await channels.getHistory({ userId: "user-1", agentId: "agent-caller" }, "dev");
            expect(history).toHaveLength(2);
            expect(history.map((entry) => entry.text).sort()).toEqual(["check this", "what next?"]);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("restores channels from disk and replays member subscriptions", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-channels-"));
        try {
            const storage = await storageOpenTest();
            const first = new Channels({
                channels: storage.channels,
                channelMessages: storage.channelMessages,
                signals: {
                    subscribe: vi.fn(),
                    unsubscribe: vi.fn()
                } as never,
                agentSystem: {
                    agentExists: async () => true,
                    contextForAgentId: async (agentId: string) => ({
                        agentId,
                        userId: "user-1"
                    }),
                    post: vi.fn(async () => undefined)
                } as never
            });
            await first.ensureDir();
            await first.create({ userId: "user-1", agentId: "agent-caller" }, "ops", "agent-leader");
            await first.addMember("ops", { agentId: "agent-a", userId: "user-1" }, "alice");

            const subscribe = vi.fn();
            const second = new Channels({
                channels: storage.channels,
                channelMessages: storage.channelMessages,
                signals: {
                    subscribe,
                    unsubscribe: vi.fn()
                } as never,
                agentSystem: {
                    agentExists: async () => true,
                    contextForAgentId: async (agentId: string) => ({
                        agentId,
                        userId: "user-1"
                    }),
                    post: vi.fn(async () => undefined)
                } as never
            });
            await second.load();

            expect(second.list()).toHaveLength(1);
            expect(subscribe).toHaveBeenCalledWith({
                ctx: expect.objectContaining({ userId: "user-1", agentId: "agent-a" }),
                pattern: "channel.ops:*",
                silent: false
            });
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
