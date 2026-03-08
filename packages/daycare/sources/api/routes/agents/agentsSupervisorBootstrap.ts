import type { Context, UserConfiguration } from "@/types";
import { userConfigurationNormalize } from "../../../engine/users/userConfigurationNormalize.js";
import { USER_CONFIGURATION_SYNC_EVENT } from "../../../engine/users/userConfigurationSyncEventBuild.js";
import type { UpdateUserInput } from "../../../storage/databaseTypes.js";
import { agentsSupervisorBootstrapTextBuild } from "./agentsSupervisorBootstrapTextBuild.js";

export type AgentsSupervisorBootstrapInput = {
    ctx: Context;
    body: Record<string, unknown>;
    agentSupervisorResolve: (ctx: Context) => Promise<string>;
    agentPost: (
        ctx: Context,
        target: { agentId: string },
        item: { type: "message"; message: { text: string; files: [] }; context: Record<string, never> }
    ) => Promise<void>;
    users: {
        findById: (id: string) => Promise<{ configuration: UserConfiguration } | null>;
        update: (id: string, input: UpdateUserInput) => Promise<void>;
    };
    eventBus?: {
        emit: (type: string, payload: unknown, userId?: string) => void;
    } | null;
};

export type AgentsSupervisorBootstrapResult =
    | {
          ok: true;
          agentId: string;
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Sends a client bootstrap message to the user's supervisor agent.
 * Creates the supervisor when missing and merges the user text with bootstrap guidance.
 */
export async function agentsSupervisorBootstrap(
    input: AgentsSupervisorBootstrapInput
): Promise<AgentsSupervisorBootstrapResult> {
    const text = typeof input.body.text === "string" ? input.body.text.trim() : "";
    if (!text) {
        return { ok: false, error: "text is required." };
    }

    try {
        const agentId = await input.agentSupervisorResolve(input.ctx);
        await input.agentPost(
            input.ctx,
            { agentId },
            {
                type: "message",
                message: {
                    text: agentsSupervisorBootstrapTextBuild(text),
                    files: []
                },
                context: {}
            }
        );
        await bootstrapStartedSet(input);
        return { ok: true, agentId };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to bootstrap supervisor agent.";
        return { ok: false, error: message };
    }
}

async function bootstrapStartedSet(input: AgentsSupervisorBootstrapInput): Promise<void> {
    const currentUser = await input.users.findById(input.ctx.userId);
    if (!currentUser) {
        throw new Error("User not found.");
    }

    const currentConfiguration = userConfigurationNormalize(currentUser.configuration);
    if (currentConfiguration.bootstrapStarted) {
        return;
    }

    const configuration: UserConfiguration = {
        ...currentConfiguration,
        bootstrapStarted: true
    };
    await input.users.update(input.ctx.userId, {
        configuration,
        updatedAt: Date.now()
    });
    input.eventBus?.emit(
        USER_CONFIGURATION_SYNC_EVENT,
        {
            configuration
        },
        input.ctx.userId
    );
}
