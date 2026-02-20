import { z } from "zod";

import { definePlugin } from "../../engine/plugins/types.js";
import { buildMontyPythonTool } from "./tool.js";

const settingsSchema = z
    .object({
        toolName: z.string().min(1).optional()
    })
    .passthrough();

export const plugin = definePlugin({
    settingsSchema,
    create: (api) => {
        const toolName = api.settings.toolName ?? "python";

        return {
            load: async () => {
                api.registrar.registerTool(buildMontyPythonTool(toolName));
            },
            unload: async () => {
                api.registrar.unregisterTool(toolName);
            }
        };
    }
});
