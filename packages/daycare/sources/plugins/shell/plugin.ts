import { z } from "zod";

import { definePlugin } from "../../engine/plugins/types.js";
import {
    buildProcessGetTool,
    buildProcessListTool,
    buildProcessStartTool,
    buildProcessStopAllTool,
    buildProcessStopTool
} from "./processTools.js";
import {
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
                    unsubscribeEngineEvents = api.engineEvents.onEvent((event) => {
                        if (event.type === "agent.session.ended") {
                            const payload = event.payload as { sessionId?: string | null };
                            if (payload.sessionId) {
                                void processes.killSessionExecs(payload.sessionId);
                            }
                            return;
                        }
                        if (event.type !== "agent.dead") {
                            return;
                        }
                        const payload = event.payload as { sessionId?: string | null; agentId?: string };
                        if (payload.sessionId) {
                            void processes.killSessionExecs(payload.sessionId);
                            return;
                        }
                        if (payload.agentId) {
                            void processes.killAgentExecs(payload.agentId);
                        }
                    });
                }
                api.registrar.registerTool(buildWorkspaceReadTool());
                api.registrar.registerTool(buildWorkspaceReadJsonTool());
                api.registrar.registerTool(buildWorkspaceWriteTool());
                api.registrar.registerTool(buildWorkspaceEditTool());
                api.registrar.registerTool(buildWriteOutputTool());
                api.registrar.registerTool(buildExecTool(processes));
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
