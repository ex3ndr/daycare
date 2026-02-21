import { createId } from "@paralleldrive/cuid2";

import type { ToolExecutionContext } from "@/types";
import { agentStateRead } from "../agents/ops/agentStateRead.js";
import { agentStateWrite } from "../agents/ops/agentStateWrite.js";
import { appDiscover } from "./appDiscover.js";
import { appPermissionBuild } from "./appPermissionBuild.js";
import type { AppDescriptor } from "./appTypes.js";

type AppExecuteInput = {
    app: AppDescriptor;
    prompt: string;
    context: ToolExecutionContext;
    waitForResponse?: boolean;
};

export type AppExecuteResult = {
    agentId: string;
    responseText: string | null;
};

/**
 * Executes an app in a dedicated app agent.
 * Expects: app descriptor is discovered/validated; prompt is non-empty.
 */
export async function appExecute(input: AppExecuteInput): Promise<AppExecuteResult> {
    const agentSystem = input.context.agentSystem;
    const storage = agentSystem.storage;
    const waitForResponse = input.waitForResponse ?? false;
    const appsDir = agentSystem.userHomeForUserId(input.context.ctx.userId).apps;
    const appDescriptor = (await appDiscover(appsDir)).find((entry) => entry.id === input.app.id) ?? null;
    if (!appDescriptor) {
        throw new Error(`Unknown app: ${input.app.id}`);
    }
    const appPermissions = await appPermissionBuild(appsDir, appDescriptor.id);

    const descriptor = {
        type: "app" as const,
        id: createId(),
        parentAgentId: input.context.agent.id,
        name: appDescriptor.manifest.title,
        systemPrompt: appDescriptor.manifest.systemPrompt,
        appId: appDescriptor.id
    };

    const agentId = await agentSystem.agentIdForTarget({ descriptor });
    const state = await agentStateRead(storage, agentId);
    if (!state) {
        throw new Error(`App agent state not found: ${agentId}`);
    }
    const updatedAt = Date.now();
    const nextState = {
        ...state,
        permissions: appPermissions,
        updatedAt
    };
    await agentStateWrite(storage, agentId, nextState);
    agentSystem.updateAgentPermissions(agentId, appPermissions, updatedAt);

    const message = {
        type: "message" as const,
        message: { text: appTaskPromptBuild(appDescriptor, input.prompt) },
        context: {}
    };
    if (!waitForResponse) {
        await agentSystem.post({ agentId }, message);
        return { agentId, responseText: null };
    }

    const result = await agentSystem.postAndAwait({ agentId }, message);
    if (result.type !== "message") {
        return { agentId, responseText: null };
    }
    return { agentId, responseText: result.responseText };
}

function appTaskPromptBuild(app: AppDescriptor, prompt: string): string {
    return [
        `You are running app "${app.manifest.title}" (${app.id}).`,
        app.manifest.description,
        "",
        "Task:",
        prompt
    ].join("\n");
}
