import http from "node:http";
import type { AgentPath, Channel, ChannelMessage, MessageContext, SignalSource } from "@/types";

import { resolveEngineSocketPath } from "./socket.js";

export type SocketResponse = {
    statusCode: number;
    body: string;
};

export type SocketRequestOptions = {
    socketPath: string;
    path: string;
    method?: "GET" | "POST";
    body?: string;
    headers?: Record<string, string>;
};

export function requestSocket(options: SocketRequestOptions): Promise<SocketResponse> {
    return new Promise((resolve, reject) => {
        const request = http.request(
            {
                socketPath: options.socketPath,
                path: options.path,
                method: options.method ?? "GET",
                headers: options.headers
            },
            (response) => {
                const chunks: Buffer[] = [];
                response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
                response.on("end", () => {
                    resolve({
                        statusCode: response.statusCode ?? 0,
                        body: Buffer.concat(chunks).toString("utf8")
                    });
                });
            }
        );

        request.on("error", (error) => {
            reject(error);
        });

        if (options.body) {
            request.write(options.body);
        }

        request.end();
    });
}

type LoadPluginOptions = {
    pluginId?: string;
    instanceId?: string;
    settings?: Record<string, unknown>;
};

export async function setAuth(id: string, key: string, value: string): Promise<void> {
    const socketPath = resolveEngineSocketPath();
    const response = await requestSocket({
        socketPath,
        path: "/v1/engine/auth",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, key, value })
    });
    if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error(response.body);
    }
}

export async function loadPlugin(options: LoadPluginOptions): Promise<void> {
    const socketPath = resolveEngineSocketPath();
    const response = await requestSocket({
        socketPath,
        path: "/v1/engine/plugins/load",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options)
    });
    if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error(response.body);
    }
}

export async function unloadPlugin(instanceId: string): Promise<void> {
    const socketPath = resolveEngineSocketPath();
    const response = await requestSocket({
        socketPath,
        path: "/v1/engine/plugins/unload",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId })
    });
    if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error(response.body);
    }
}

export async function reloadEngine(socketPathOverride?: string): Promise<void> {
    const socketPath = resolveEngineSocketPath(socketPathOverride);
    const response = await requestSocket({
        socketPath,
        path: "/v1/engine/reload",
        method: "POST"
    });
    if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error(response.body || "Engine reload failed.");
    }
}

export async function sendEngineEvent(type: string, payload?: unknown, socketPathOverride?: string): Promise<void> {
    const socketPath = resolveEngineSocketPath(socketPathOverride);
    const response = await requestSocket({
        socketPath,
        path: "/v1/engine/events",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, payload })
    });
    if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error(response.body || "Engine event send failed.");
    }
}

export async function sendEngineSignal(
    type: string,
    data?: unknown,
    source?: SignalSource,
    socketPathOverride?: string
): Promise<void> {
    const socketPath = resolveEngineSocketPath(socketPathOverride);
    const response = await requestSocket({
        socketPath,
        path: "/v1/engine/signals/generate",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, data, source })
    });
    if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error(response.body || "Signal send failed.");
    }
}

export async function sendEngineAgentMessage(
    input: {
        text: string;
        userId?: string;
        agentId?: string;
        path?: AgentPath;
        context?: MessageContext;
        awaitResponse?: boolean;
    },
    socketPathOverride?: string
): Promise<{ agentId: string; responseText?: string | null }> {
    const socketPath = resolveEngineSocketPath(socketPathOverride);
    const response = await requestSocket({
        socketPath,
        path: "/v1/engine/agents/message",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
    });
    if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error(response.body || "Agent message send failed.");
    }
    const payload = JSON.parse(response.body) as { agentId?: string; responseText?: string | null };
    if (!payload.agentId) {
        throw new Error("Agent message send failed.");
    }
    return {
        agentId: payload.agentId,
        responseText: payload.responseText
    };
}

export async function triggerEngineCronTask(triggerId: string, socketPathOverride?: string): Promise<void> {
    const socketPath = resolveEngineSocketPath(socketPathOverride);
    const response = await requestSocket({
        socketPath,
        path: `/v1/engine/cron/tasks/${encodeURIComponent(triggerId)}/trigger`,
        method: "POST"
    });
    if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error(response.body || "Cron trigger failed.");
    }
}

export async function listEngineChannels(socketPathOverride?: string): Promise<Channel[]> {
    const socketPath = resolveEngineSocketPath(socketPathOverride);
    const response = await requestSocket({
        socketPath,
        path: "/v1/engine/channels"
    });
    if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error(response.body || "Channel list failed.");
    }
    const payload = JSON.parse(response.body) as { channels?: Channel[] };
    return payload.channels ?? [];
}

export async function createEngineChannel(
    name: string,
    leaderAgentId: string,
    socketPathOverride?: string
): Promise<Channel> {
    const socketPath = resolveEngineSocketPath(socketPathOverride);
    const response = await requestSocket({
        socketPath,
        path: "/v1/engine/channels",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, leaderAgentId })
    });
    if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error(response.body || "Channel create failed.");
    }
    const payload = JSON.parse(response.body) as { channel?: Channel };
    if (!payload.channel) {
        throw new Error("Channel create failed.");
    }
    return payload.channel;
}

export async function addEngineChannelMember(
    channelName: string,
    agentId: string,
    username: string,
    socketPathOverride?: string
): Promise<Channel> {
    const socketPath = resolveEngineSocketPath(socketPathOverride);
    const response = await requestSocket({
        socketPath,
        path: `/v1/engine/channels/${encodeURIComponent(channelName)}/members`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, username })
    });
    if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error(response.body || "Channel add member failed.");
    }
    const payload = JSON.parse(response.body) as { channel?: Channel };
    if (!payload.channel) {
        throw new Error("Channel add member failed.");
    }
    return payload.channel;
}

export async function removeEngineChannelMember(
    channelName: string,
    agentId: string,
    socketPathOverride?: string
): Promise<boolean> {
    const socketPath = resolveEngineSocketPath(socketPathOverride);
    const response = await requestSocket({
        socketPath,
        path: `/v1/engine/channels/${encodeURIComponent(channelName)}/members/remove`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId })
    });
    if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error(response.body || "Channel remove member failed.");
    }
    const payload = JSON.parse(response.body) as { removed?: boolean };
    return payload.removed === true;
}

export async function sendEngineChannelMessage(
    channelName: string,
    senderUsername: string,
    text: string,
    mentions: string[] = [],
    socketPathOverride?: string
): Promise<{ message: ChannelMessage; deliveredAgentIds: string[] }> {
    const socketPath = resolveEngineSocketPath(socketPathOverride);
    const response = await requestSocket({
        socketPath,
        path: `/v1/engine/channels/${encodeURIComponent(channelName)}/send`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderUsername, text, mentions })
    });
    if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error(response.body || "Channel send failed.");
    }
    const payload = JSON.parse(response.body) as {
        message?: ChannelMessage;
        deliveredAgentIds?: string[];
    };
    if (!payload.message) {
        throw new Error("Channel send failed.");
    }
    return {
        message: payload.message,
        deliveredAgentIds: payload.deliveredAgentIds ?? []
    };
}
