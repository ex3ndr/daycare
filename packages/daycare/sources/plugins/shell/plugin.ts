import { z } from "zod";

import type { EngineEvent } from "../../engine/ipc/events.js";
import { definePlugin } from "../../engine/plugins/types.js";
import type { Processes } from "../../engine/processes/processes.js";
import {
    buildProcessGetTool,
    buildProcessListTool,
    buildProcessStartTool,
    buildProcessStopAllTool,
    buildProcessStopTool
} from "./processTools.js";
import {
    buildExecBackgroundTool,
    buildExecKillTool,
    buildExecPollTool,
    buildExecTool,
    buildWorkspaceEditTool,
    buildWorkspaceReadJsonTool,
    buildWorkspaceReadTool,
    buildWorkspaceWriteTool
} from "./tool.js";
import { buildWriteOutputTool } from "./writeOutputTool.js";

const settingsSchema = z.object({}).passthrough();

export const plugin = definePlugin({
    settingsSchema,
    create: (api) => {
        const processes = api.processes;
        let unsubscribeEngineEvents: (() => void) | null = null;
        return {
            load: async () => {
                if (api.engineEvents) {
                    unsubscribeEngineEvents = api.engineEvents.onEvent((event) =>
                        shellEngineEventHandle(processes, event)
                    );
                }
                api.registrar.registerTool(buildWorkspaceReadTool());
                api.registrar.registerTool(buildWorkspaceReadJsonTool());
                api.registrar.registerTool(buildWorkspaceWriteTool());
                api.registrar.registerTool(buildWorkspaceEditTool());
                api.registrar.registerTool(buildWriteOutputTool());
                api.registrar.registerTool(buildExecTool(processes));
                api.registrar.registerTool(buildExecBackgroundTool(processes));
                api.registrar.registerTool(buildExecPollTool(processes));
                api.registrar.registerTool(buildExecKillTool(processes));
                api.registrar.registerTool(buildProcessStartTool(processes));
                api.registrar.registerTool(buildProcessListTool(processes));
                api.registrar.registerTool(buildProcessGetTool(processes));
                api.registrar.registerTool(buildProcessStopTool(processes));
                api.registrar.registerTool(buildProcessStopAllTool(processes));
            },
            unload: async () => {
                unsubscribeEngineEvents?.();
                unsubscribeEngineEvents = null;
                await processes.killAllSessionExecs();
                api.registrar.unregisterTool("read");
                api.registrar.unregisterTool("read_json");
                api.registrar.unregisterTool("write");
                api.registrar.unregisterTool("edit");
                api.registrar.unregisterTool("write_output");
                api.registrar.unregisterTool("exec");
                api.registrar.unregisterTool("exec_background");
                api.registrar.unregisterTool("exec_poll");
                api.registrar.unregisterTool("exec_kill");
                api.registrar.unregisterTool("process_start");
                api.registrar.unregisterTool("process_list");
                api.registrar.unregisterTool("process_get");
                api.registrar.unregisterTool("process_stop");
                api.registrar.unregisterTool("process_stop_all");
            }
        };
    }
});

function shellEngineEventHandle(processes: Processes, event: EngineEvent): void {
    switch (event.type) {
        case "agent.session.ended": {
            const sessionId = eventSessionIdGet(event.payload);
            if (sessionId) {
                void processes.killSessionExecs(sessionId);
            }
            return;
        }
        case "agent.dead": {
            const sessionId = eventSessionIdGet(event.payload);
            if (sessionId) {
                void processes.killSessionExecs(sessionId);
                return;
            }
            const agentId = eventAgentIdGet(event.payload);
            if (agentId) {
                void processes.killAgentExecs(agentId);
            }
            return;
        }
        default:
            return;
    }
}

function eventSessionIdGet(payload: unknown): string | null {
    const value = eventPayloadGet(payload).sessionId;
    return typeof value === "string" && value.length > 0 ? value : null;
}

function eventAgentIdGet(payload: unknown): string | null {
    const value = eventPayloadGet(payload).agentId;
    return typeof value === "string" && value.length > 0 ? value : null;
}

function eventPayloadGet(payload: unknown): Record<string, unknown> {
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
        return {};
    }
    return payload as Record<string, unknown>;
}
