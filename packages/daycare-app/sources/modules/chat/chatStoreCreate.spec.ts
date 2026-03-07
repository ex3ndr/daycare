import { afterEach, describe, expect, it, vi } from "vitest";
import { chatCreate, chatHistoryFetch, chatMessageSend, chatMessagesPoll } from "./chatApi";
import { chatStoreCreate } from "./chatStoreCreate";

vi.mock("./chatApi", () => ({
    chatCreate: vi.fn(),
    chatHistoryFetch: vi.fn(),
    chatMessageSend: vi.fn(),
    chatMessagesPoll: vi.fn()
}));

describe("chatStoreCreate", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it("open loads full history for an existing agent", async () => {
        vi.mocked(chatHistoryFetch).mockResolvedValueOnce([
            { type: "note", at: 1000, text: "loaded" },
            { type: "user_message", at: 1002, text: "hi" }
        ]);

        const store = chatStoreCreate();
        await store.getState().open("http://localhost", "tok", null, "agent-1");

        expect(chatHistoryFetch).toHaveBeenCalledWith("http://localhost", "tok", null, "agent-1");
        expect(store.getState().sessions["agent-1"]).toEqual({
            agentId: "agent-1",
            history: [
                { type: "note", at: 1000, text: "loaded" },
                { type: "user_message", at: 1002, text: "hi" }
            ],
            loading: false,
            sending: false,
            error: null,
            lastPollAt: 1002
        });
    });

    it("create creates and initializes a new chat session", async () => {
        vi.mocked(chatCreate).mockResolvedValueOnce({
            agentId: "app-agent-2",
            initializedAt: 1700
        });
        vi.mocked(chatHistoryFetch).mockResolvedValueOnce([{ type: "assistant_message", at: 2000, content: [] }]);

        const store = chatStoreCreate();
        const agentId = await store.getState().create("http://localhost", "tok", null, {
            systemPrompt: "You are helpful.",
            name: "Helper",
            description: "Task support"
        });

        expect(agentId).toBe("app-agent-2");
        expect(chatCreate).toHaveBeenCalledWith(
            "http://localhost",
            "tok",
            null,
            "You are helpful.",
            "Helper",
            "Task support"
        );
        expect(chatHistoryFetch).toHaveBeenCalledWith("http://localhost", "tok", null, "app-agent-2");
        expect(store.getState().sessions["app-agent-2"]?.history).toEqual([
            { type: "assistant_message", at: 2000, content: [] }
        ]);
    });

    it("send posts a message then polls incrementally", async () => {
        vi.mocked(chatMessageSend).mockResolvedValueOnce();
        vi.mocked(chatMessagesPoll).mockResolvedValueOnce([
            { type: "user_message", at: 2001, text: "hello" },
            { type: "assistant_message", at: 2002, content: [{ type: "text", text: "Hi" }] }
        ]);

        const store = chatStoreCreate();
        store.setState({
            sessions: {
                "agent-1": {
                    agentId: "agent-1",
                    history: [{ type: "note", at: 1000, text: "start" }],
                    loading: false,
                    sending: false,
                    error: null,
                    lastPollAt: 1000
                }
            }
        });

        await store.getState().send("http://localhost", "tok", null, "agent-1", "hello");

        expect(chatMessageSend).toHaveBeenCalledWith("http://localhost", "tok", null, "agent-1", "hello");
        expect(chatMessagesPoll).toHaveBeenCalledWith("http://localhost", "tok", null, "agent-1", 1000);
        expect(store.getState().sessions["agent-1"]?.history).toEqual([
            { type: "note", at: 1000, text: "start" },
            { type: "user_message", at: 2001, text: "hello" },
            { type: "assistant_message", at: 2002, content: [{ type: "text", text: "Hi" }] }
        ]);
        expect(store.getState().sessions["agent-1"]?.lastPollAt).toBe(2002);
        expect(store.getState().sessions["agent-1"]?.sending).toBe(false);
    });

    it("poll appends new records and updates lastPollAt", async () => {
        vi.mocked(chatMessagesPoll).mockResolvedValueOnce([
            { type: "assistant_message", at: 3000, content: [{ type: "text", text: "done" }] }
        ]);

        const store = chatStoreCreate();
        store.setState({
            sessions: {
                "agent-1": {
                    agentId: "agent-1",
                    history: [{ type: "user_message", at: 2500, text: "status?" }],
                    loading: false,
                    sending: false,
                    error: null,
                    lastPollAt: 2500
                }
            }
        });

        await store.getState().poll("http://localhost", "tok", null, "agent-1");

        expect(chatMessagesPoll).toHaveBeenCalledWith("http://localhost", "tok", null, "agent-1", 2500);
        expect(store.getState().sessions["agent-1"]?.history).toEqual([
            { type: "user_message", at: 2500, text: "status?" },
            { type: "assistant_message", at: 3000, content: [{ type: "text", text: "done" }] }
        ]);
        expect(store.getState().sessions["agent-1"]?.lastPollAt).toBe(3000);
    });

    it("keeps session state isolated per agentId", async () => {
        vi.mocked(chatHistoryFetch)
            .mockResolvedValueOnce([{ type: "note", at: 1000, text: "agent-1" }])
            .mockResolvedValueOnce([{ type: "note", at: 2000, text: "agent-2" }]);

        const store = chatStoreCreate();
        await store.getState().open("http://localhost", "tok", null, "agent-1");
        await store.getState().open("http://localhost", "tok", null, "agent-2");

        expect(store.getState().sessions["agent-1"]?.history).toEqual([{ type: "note", at: 1000, text: "agent-1" }]);
        expect(store.getState().sessions["agent-2"]?.history).toEqual([{ type: "note", at: 2000, text: "agent-2" }]);
    });
});
