import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { Signal } from "@/types";
import { databaseOpen } from "../../storage/databaseOpen.js";
import { EngineEventBus } from "../ipc/events.js";
import { Signals } from "./signals.js";

describe("Signals", () => {
    it("persists and reads signal events", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-signals-"));
        try {
            const eventBus = new EngineEventBus();
            const signals = new Signals({ eventBus, configDir: dir });
            const events: Array<{ type: string; payload: unknown }> = [];

            const unsubscribe = eventBus.onEvent((event) => {
                events.push({ type: event.type, payload: event.payload });
            });

            const signal = await signals.generate({
                type: "build.completed",
                source: { type: "process", id: "main-runtime", userId: "user-1" },
                data: { ok: true }
            });
            unsubscribe();

            expect(signal.id.length).toBeGreaterThan(0);
            expect(signal.createdAt).toBeGreaterThan(0);
            expect(signal.type).toBe("build.completed");
            expect(signal.source).toEqual({ type: "process", id: "main-runtime", userId: "user-1" });
            expect(signal.data).toEqual({ ok: true });

            const generated = events.find((event) => event.type === "signal.generated");
            expect(generated).toBeDefined();
            expect(generated?.payload as Signal).toEqual(signal);

            const recent = await signals.listRecent(10);
            expect(recent).toHaveLength(1);
            expect(recent[0]?.id).toBe(signal.id);

            const all = await signals.listAll();
            expect(all).toHaveLength(1);
            expect(all[0]?.id).toBe(signal.id);

            const db = databaseOpen(path.join(dir, "daycare.db"));
            try {
                const rows = db.prepare("SELECT type FROM signals_events").all() as Array<{ type: string }>;
                expect(rows.map((row) => row.type)).toEqual(["build.completed"]);
            } finally {
                db.close();
            }
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("returns all persisted events without recent-limit truncation", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-signals-"));
        try {
            const signals = new Signals({
                eventBus: new EngineEventBus(),
                configDir: dir
            });
            await signals.generate({ type: "event.one", source: { type: "system", userId: "user-1" }, data: { n: 1 } });
            await signals.generate({ type: "event.two", source: { type: "system", userId: "user-1" }, data: { n: 2 } });

            const recent = await signals.listRecent(1);
            expect(recent).toHaveLength(1);
            expect(recent[0]?.type).toBe("event.two");

            const all = await signals.listAll();
            expect(all).toHaveLength(2);
            expect(all.map((item) => item.type)).toEqual(["event.one", "event.two"]);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("throws a validation error when source userId is missing at runtime", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-signals-"));
        try {
            const signals = new Signals({
                eventBus: new EngineEventBus(),
                configDir: dir
            });
            await expect(
                signals.generate({
                    type: "event.invalid",
                    source: { type: "system" } as unknown as Signal["source"]
                })
            ).rejects.toThrow("Signal source userId is required");
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("delivers only matching subscriptions", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-signals-"));
        try {
            const delivered: Array<{
                signalType: string;
                subscriptions: Array<{ userId: string; agentId: string; pattern: string; silent: boolean }>;
            }> = [];
            const signals = new Signals({
                eventBus: new EngineEventBus(),
                configDir: dir,
                onDeliver: (signal, subscriptions) => {
                    delivered.push({
                        signalType: signal.type,
                        subscriptions: subscriptions.map((subscription) => ({
                            userId: subscription.ctx.userId,
                            agentId: subscription.ctx.agentId,
                            pattern: subscription.pattern,
                            silent: subscription.silent
                        }))
                    });
                }
            });

            await signals.subscribe({
                ctx: { userId: "user-1", agentId: "agent-a" },
                pattern: "build:*:done",
                silent: true
            });
            await signals.subscribe({
                ctx: { userId: "user-1", agentId: "agent-b" },
                pattern: "build:*:done",
                silent: false
            });
            await signals.subscribe({ ctx: { userId: "user-2", agentId: "agent-c" }, pattern: "other:*" });

            await signals.generate({
                type: "build:alpha:done",
                source: { type: "system", userId: "user-1" }
            });

            expect(delivered).toHaveLength(1);
            expect(delivered[0]?.signalType).toBe("build:alpha:done");
            expect(delivered[0]?.subscriptions).toEqual([
                { userId: "user-1", agentId: "agent-a", pattern: "build:*:done", silent: true },
                { userId: "user-1", agentId: "agent-b", pattern: "build:*:done", silent: false }
            ]);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("stops delivering after unsubscribe", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-signals-"));
        try {
            const delivered: string[] = [];
            const signals = new Signals({
                eventBus: new EngineEventBus(),
                configDir: dir,
                onDeliver: (_signal, subscriptions) => {
                    delivered.push(...subscriptions.map((subscription) => subscription.ctx.agentId));
                }
            });

            await signals.subscribe({
                ctx: { userId: "user-1", agentId: "agent-a" },
                pattern: "build:*:done",
                silent: true
            });
            const removed = await signals.unsubscribe({
                ctx: { userId: "user-1", agentId: "agent-a" },
                pattern: "build:*:done"
            });
            expect(removed).toBe(true);

            await signals.generate({
                type: "build:alpha:done",
                source: { type: "system", userId: "user-1" }
            });

            expect(delivered).toEqual([]);
            await expect(
                signals.unsubscribe({ ctx: { userId: "user-1", agentId: "agent-a" }, pattern: "build:*:done" })
            ).resolves.toBe(false);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("filters matched subscriptions by signal source userId when present", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-signals-"));
        try {
            const delivered: Array<{ userId: string; agentId: string }> = [];
            const signals = new Signals({
                eventBus: new EngineEventBus(),
                configDir: dir,
                onDeliver: (_signal, subscriptions) => {
                    delivered.push(
                        ...subscriptions.map((subscription) => ({
                            userId: subscription.ctx.userId,
                            agentId: subscription.ctx.agentId
                        }))
                    );
                }
            });

            await signals.subscribe({
                ctx: { userId: "user-a", agentId: "agent-a" },
                pattern: "build:*",
                silent: true
            });
            await signals.subscribe({
                ctx: { userId: "user-b", agentId: "agent-b" },
                pattern: "build:*",
                silent: true
            });
            await signals.generate({
                type: "build:alpha",
                source: { type: "agent", id: "agent-origin", userId: "user-a" }
            });

            expect(delivered).toEqual([{ userId: "user-a", agentId: "agent-a" }]);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
