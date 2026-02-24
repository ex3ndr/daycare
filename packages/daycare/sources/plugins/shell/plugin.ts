import { z } from "zod";

import { definePlugin } from "../../engine/plugins/types.js";
import { buildFindTool } from "./findTool.js";
import { buildGrepTool } from "./grepTool.js";
import { buildLsTool } from "./lsTool.js";
import {
    buildProcessGetTool,
    buildProcessListTool,
    buildProcessStartTool,
    buildProcessStopAllTool,
    buildProcessStopTool
} from "./processTools.js";
import { buildRunTestsTool } from "./runTestsTool.js";
import { buildExecTool, buildWorkspaceEditTool, buildWorkspaceReadTool, buildWorkspaceWriteTool } from "./tool.js";
import { buildWriteOutputTool } from "./writeOutputTool.js";

const settingsSchema = z.object({}).passthrough();

export const plugin = definePlugin({
    settingsSchema,
    create: (api) => {
        const processes = api.processes;
        const includeRunTestsTool = ciEnvironmentIs() === false;
        return {
            load: async () => {
                api.registrar.registerTool(buildWorkspaceReadTool());
                api.registrar.registerTool(buildWorkspaceWriteTool());
                api.registrar.registerTool(buildWorkspaceEditTool());
                api.registrar.registerTool(buildWriteOutputTool());
                api.registrar.registerTool(buildExecTool());
                api.registrar.registerTool(buildGrepTool());
                api.registrar.registerTool(buildFindTool());
                api.registrar.registerTool(buildLsTool());
                if (includeRunTestsTool) {
                    api.registrar.registerTool(buildRunTestsTool());
                }
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
                api.registrar.unregisterTool("write_output");
                api.registrar.unregisterTool("exec");
                api.registrar.unregisterTool("grep");
                api.registrar.unregisterTool("find");
                api.registrar.unregisterTool("ls");
                api.registrar.unregisterTool("run_tests");
                api.registrar.unregisterTool("process_start");
                api.registrar.unregisterTool("process_list");
                api.registrar.unregisterTool("process_get");
                api.registrar.unregisterTool("process_stop");
                api.registrar.unregisterTool("process_stop_all");
            }
        };
    }
});

function ciEnvironmentIs(): boolean {
    const raw = process.env.CI;
    if (!raw) {
        return false;
    }
    const normalized = raw.trim().toLowerCase();
    return normalized.length > 0 && normalized !== "0" && normalized !== "false";
}
