import type { Context, UserConfiguration } from "@/types";
import { userConfigurationNormalize } from "../../../engine/users/userConfigurationNormalize.js";

export type ConfigReadInput = {
    ctx: Context;
    users: {
        findById: (id: string) => Promise<{ configuration: UserConfiguration } | null>;
    };
};

/**
 * Reads the workspace user's configuration flags.
 * Expects: ctx.userId is the workspace user id (resolved from /w/{id} prefix).
 */
export async function configRead(input: ConfigReadInput): Promise<{ ok: true; configuration: UserConfiguration }> {
    const user = await input.users.findById(input.ctx.userId);
    const configuration = user ? userConfigurationNormalize(user.configuration) : userConfigurationNormalize(null);
    return { ok: true, configuration };
}
