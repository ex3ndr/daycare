import { z } from "zod";

import { definePlugin } from "../../engine/plugins/types.js";
import {
  buildExecTool,
  buildWorkspaceEditTool,
  buildWorkspaceReadTool,
  buildWorkspaceWriteTool
} from "./tool.js";

const settingsSchema = z.object({}).passthrough();

export const plugin = definePlugin({
  settingsSchema,
  create: (api) => {
    return {
      load: async () => {
        api.registrar.registerTool(buildWorkspaceReadTool());
        api.registrar.registerTool(buildWorkspaceWriteTool());
        api.registrar.registerTool(buildWorkspaceEditTool());
        api.registrar.registerTool(buildExecTool());
      },
      unload: async () => {
        api.registrar.unregisterTool("read");
        api.registrar.unregisterTool("write");
        api.registrar.unregisterTool("edit");
        api.registrar.unregisterTool("exec");
      }
    };
  }
});
