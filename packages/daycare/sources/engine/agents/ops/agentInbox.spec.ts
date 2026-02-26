import { describe, expect, it, vi } from "vitest";

import { AgentInbox } from "./agentInbox.js";

const buildReset = () => ({ type: "reset" as const });
const buildRestore = () => ({ type: "restore" as const });
const buildMessage = (text: string, messageId: string) => ({
    type: "message" as const,
    message: { text },
    context: {
        messageId
    }
});

describe("AgentInbox", () => {
    it("delivers queued entries in order", async () => {
        const inbox = new AgentInbox("agent-1");
        const first = inbox.post(buildReset());
        const second = inbox.post(buildReset());

        const entry1 = await inbox.next();
        const entry2 = await inbox.next();

        expect(entry1.id).toBe(first.id);
        expect(entry2.id).toBe(second.id);
    });

    it("awaits until an entry is posted", async () => {
        const inbox = new AgentInbox("agent-2");
        const pending = inbox.next();
        const posted = inbox.post(buildReset());
        const entry = await pending;

        expect(entry.id).toBe(posted.id);
    });

    it("allows reattach after detach", () => {
        const inbox = new AgentInbox("agent-3");
        inbox.attach();
        inbox.detach();
        expect(() => inbox.attach()).not.toThrow();
    });

    it("combines queued message items into one inbox entry", async () => {
        const inbox = new AgentInbox("agent-4");
        inbox.post(buildMessage("first", "1"));
        const second = inbox.post(buildMessage("second", "2"));

        expect(inbox.size()).toBe(1);
        const entry = await inbox.next();
        expect(entry.id).toBe(second.id);
        expect(entry.item.type).toBe("message");
        if (entry.item.type !== "message") {
            throw new Error("Expected merged message entry");
        }
        expect(entry.item.message.text).toBe("first\nsecond");
        expect(entry.item.context).toEqual({
            messageId: "2"
        });
    });

    it("resolves completion handlers for all merged messages", async () => {
        const inbox = new AgentInbox("agent-5");
        const resolveFirst = vi.fn();
        const resolveSecond = vi.fn();
        const rejectFirst = vi.fn();
        const rejectSecond = vi.fn();
        inbox.post(buildMessage("one", "1"), {
            resolve: resolveFirst,
            reject: rejectFirst
        });
        inbox.post(buildMessage("two", "2"), {
            resolve: resolveSecond,
            reject: rejectSecond
        });

        const entry = await inbox.next();
        entry.completion?.resolve({ type: "message", responseText: "ok" });

        expect(resolveFirst).toHaveBeenCalledWith({ type: "message", responseText: "ok" });
        expect(resolveSecond).toHaveBeenCalledWith({ type: "message", responseText: "ok" });
        expect(rejectFirst).not.toHaveBeenCalled();
        expect(rejectSecond).not.toHaveBeenCalled();
    });

    it("can disable merge for replayed message entries", async () => {
        const inbox = new AgentInbox("agent-10");
        const first = inbox.post(buildMessage("first", "1"), null, {
            id: "persisted-1",
            postedAt: 10,
            merge: false
        });
        const second = inbox.post(buildMessage("second", "2"), null, {
            id: "persisted-2",
            postedAt: 20,
            merge: false
        });

        expect(inbox.size()).toBe(2);
        expect(first.id).toBe("persisted-1");
        expect(second.id).toBe("persisted-2");
    });

    it("can prioritize restore entry to the front of the queue", async () => {
        const inbox = new AgentInbox("agent-11");
        inbox.post(buildReset());
        inbox.post(buildRestore(), null, { front: true });

        const first = await inbox.next();
        expect(first.item.type).toBe("restore");
    });

    describe("steering", () => {
        it("steer() stores a steering message", () => {
            const inbox = new AgentInbox("agent-6");
            inbox.steer({ type: "steering", text: "stop what you are doing" });

            expect(inbox.hasSteering()).toBe(true);
        });

        it("consumeSteering() returns and clears the steering message", () => {
            const inbox = new AgentInbox("agent-7");
            inbox.steer({ type: "steering", text: "redirect", origin: "user-123" });

            const steering = inbox.consumeSteering();

            expect(steering).toEqual({
                type: "steering",
                text: "redirect",
                origin: "user-123"
            });
            expect(inbox.hasSteering()).toBe(false);
            expect(inbox.consumeSteering()).toBeNull();
        });

        it("hasSteering() returns false when no steering is pending", () => {
            const inbox = new AgentInbox("agent-8");

            expect(inbox.hasSteering()).toBe(false);
        });

        it("multiple steer() calls keep only the last one", () => {
            const inbox = new AgentInbox("agent-9");
            inbox.steer({ type: "steering", text: "first" });
            inbox.steer({ type: "steering", text: "second" });
            inbox.steer({ type: "steering", text: "third", cancelReason: "user cancelled" });

            const steering = inbox.consumeSteering();

            expect(steering).toEqual({
                type: "steering",
                text: "third",
                cancelReason: "user cancelled"
            });
            expect(inbox.hasSteering()).toBe(false);
        });
    });
});
