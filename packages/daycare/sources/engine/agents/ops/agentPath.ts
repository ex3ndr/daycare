import path from "node:path";

import type { Config, Context } from "@/types";

/**
 * Builds the filesystem path for an agent folder.
 * Expects: config.agentsDir is absolute.
 */
export function agentPath(config: Config, ctx: Context): string {
    return path.join(config.agentsDir, ctx.agentId);
}
