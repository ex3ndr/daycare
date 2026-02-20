import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    addEngineChannelMember,
    createEngineChannel,
    listEngineChannels,
    removeEngineChannelMember,
    sendEngineChannelMessage
} from "../engine/ipc/client.js";
import { channelAddMemberCommand } from "./channelAddMember.js";
import { channelCreateCommand } from "./channelCreate.js";
import { channelListCommand } from "./channelList.js";
import { channelRemoveMemberCommand } from "./channelRemoveMember.js";
import { channelSendCommand } from "./channelSend.js";

vi.mock("../engine/ipc/client.js", () => ({
    createEngineChannel: vi.fn(),
    listEngineChannels: vi.fn(),
    addEngineChannelMember: vi.fn(),
    removeEngineChannelMember: vi.fn(),
    sendEngineChannelMessage: vi.fn()
}));

describe("channel commands", () => {
    const createEngineChannelMock = vi.mocked(createEngineChannel);
    const listEngineChannelsMock = vi.mocked(listEngineChannels);
    const addEngineChannelMemberMock = vi.mocked(addEngineChannelMember);
    const removeEngineChannelMemberMock = vi.mocked(removeEngineChannelMember);
    const sendEngineChannelMessageMock = vi.mocked(sendEngineChannelMessage);

    beforeEach(() => {
        createEngineChannelMock.mockReset();
        listEngineChannelsMock.mockReset();
        addEngineChannelMemberMock.mockReset();
        removeEngineChannelMemberMock.mockReset();
        sendEngineChannelMessageMock.mockReset();
        process.exitCode = undefined;
        vi.spyOn(console, "log").mockImplementation(() => undefined);
        vi.spyOn(console, "error").mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("creates channels with leader option", async () => {
        createEngineChannelMock.mockResolvedValueOnce({
            id: "ch-1",
            name: "dev",
            leader: "agent-leader",
            members: [],
            createdAt: 1,
            updatedAt: 1
        });

        await channelCreateCommand("dev", { leader: "agent-leader" });

        expect(createEngineChannelMock).toHaveBeenCalledWith("dev", "agent-leader");
        expect(process.exitCode).toBeUndefined();
    });

    it("lists channels", async () => {
        listEngineChannelsMock.mockResolvedValueOnce([
            {
                id: "ch-1",
                name: "dev",
                leader: "agent-leader",
                members: [],
                createdAt: 1,
                updatedAt: 1
            }
        ]);

        await channelListCommand();

        expect(listEngineChannelsMock).toHaveBeenCalled();
        expect(process.exitCode).toBeUndefined();
    });

    it("adds and removes channel members", async () => {
        addEngineChannelMemberMock.mockResolvedValueOnce({
            id: "ch-1",
            name: "dev",
            leader: "agent-leader",
            members: [{ agentId: "agent-a", username: "alice", joinedAt: 1 }],
            createdAt: 1,
            updatedAt: 1
        });
        removeEngineChannelMemberMock.mockResolvedValueOnce(true);

        await channelAddMemberCommand("dev", "agent-a", "alice");
        await channelRemoveMemberCommand("dev", "agent-a");

        expect(addEngineChannelMemberMock).toHaveBeenCalledWith("dev", "agent-a", "alice");
        expect(removeEngineChannelMemberMock).toHaveBeenCalledWith("dev", "agent-a");
        expect(process.exitCode).toBeUndefined();
    });

    it("sends a channel message from CLI sender identity", async () => {
        sendEngineChannelMessageMock.mockResolvedValueOnce({
            message: {
                id: "m1",
                channelName: "dev",
                senderUsername: "daycare-cli",
                text: "hello",
                mentions: [],
                createdAt: 1
            },
            deliveredAgentIds: ["agent-leader"]
        });

        await channelSendCommand("dev", "hello");

        expect(sendEngineChannelMessageMock).toHaveBeenCalledWith("dev", "daycare-cli", "hello", []);
        expect(process.exitCode).toBeUndefined();
    });
});
