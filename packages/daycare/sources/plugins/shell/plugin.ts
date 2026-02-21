import { z } from "zod";

import { definePlugin } from "../../engine/plugins/types.js";
import { pdfProcessTool } from "./pdfProcessTool.js";
import {
    buildProcessGetTool,
    buildProcessListTool,
    buildProcessStartTool,
    buildProcessStopAllTool,
    buildProcessStopTool
} from "./processTools.js";
import { buildExecTool, buildWorkspaceEditTool, buildWorkspaceReadTool, buildWorkspaceWriteTool } from "./tool.js";

const settingsSchema = z.object({}).passthrough();

export const plugin = definePlugin({
    settingsSchema,
    create: (api) => {
        const processes = api.processes;
        return {
            load: async () => {
                api.registrar.registerTool(buildWorkspaceReadTool());
                api.registrar.registerTool(buildWorkspaceWriteTool());
                api.registrar.registerTool(buildWorkspaceEditTool());
                api.registrar.registerTool(buildExecTool());
                api.registrar.registerTool(pdfProcessTool());
                api.registrar.registerTool(buildProcessStartTool(processes));
                api.registrar.registerTool(buildProcessListTool(processes));
                api.registrar.registerTool(buildProcessGetTool(processes));
                api.registrar.registerTool(buildProcessStopTool(processes));
                api.registrar.registerTool(buildProcessStopAllTool(processes));
            },
            unload: async () => {
                api.registrar.unregisterTool("read");
                api.registrar.unregisterTool("write");
                api.registrar.unregisterTool("edit");
                api.registrar.unregisterTool("exec");
                api.registrar.unregisterTool("pdf_process");
                api.registrar.unregisterTool("process_start");
                api.registrar.unregisterTool("process_list");
                api.registrar.unregisterTool("process_get");
                api.registrar.unregisterTool("process_stop");
                api.registrar.unregisterTool("process_stop_all");
            }
        };
    }
});
