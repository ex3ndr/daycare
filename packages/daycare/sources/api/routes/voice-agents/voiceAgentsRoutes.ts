import type http from "node:http";
import { createId } from "@paralleldrive/cuid2";
import type { Context, VoiceAgentToolDefinition } from "@/types";
import type { VoiceAgentRegistry } from "../../../engine/modules/voiceAgentRegistry.js";
import { getLogger } from "../../../log.js";
import type { VoiceAgentsRepository } from "../../../storage/voiceAgentsRepository.js";

export type VoiceAgentsRouteContext = {
    ctx: Context;
    sendJson: (response: http.ServerResponse, statusCode: number, payload: Record<string, unknown>) => void;
    readJsonBody: (request: http.IncomingMessage) => Promise<Record<string, unknown>>;
    voiceAgents: VoiceAgentsRepository | null;
    voiceRegistry: VoiceAgentRegistry | null;
};

/**
 * Routes authenticated voice-agent APIs for CRUD and session bootstrap.
 * Returns true when a /voice-agents endpoint is matched and handled.
 */
export async function voiceAgentsRouteHandle(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    pathname: string,
    context: VoiceAgentsRouteContext
): Promise<boolean> {
    if (!pathname.startsWith("/voice-agents")) {
        return false;
    }

    if (!context.voiceAgents) {
        context.sendJson(response, 503, { ok: false, error: "Voice agents unavailable." });
        return true;
    }

    try {
        if (pathname === "/voice-agents" && request.method === "GET") {
            const voiceAgents = await context.voiceAgents.findMany(context.ctx);
            context.sendJson(response, 200, { ok: true, voiceAgents });
            return true;
        }

        if (pathname === "/voice-agents/create" && request.method === "POST") {
            const body = await context.readJsonBody(request);
            const now = Date.now();
            const voiceAgent = await context.voiceAgents.create(context.ctx, {
                id: stringValue(body.id) || createId(),
                name: requiredStringValue(body.name, "Voice agent name is required."),
                description: optionalStringValue(body.description),
                systemPrompt: requiredStringValue(body.systemPrompt, "Voice agent systemPrompt is required."),
                tools: toolsValue(body.tools),
                settings: objectValue(body.settings),
                createdAt: numberValue(body.createdAt) ?? now,
                updatedAt: numberValue(body.updatedAt) ?? now
            });
            context.sendJson(response, 200, { ok: true, voiceAgent });
            return true;
        }

        const readMatch = pathname.match(/^\/voice-agents\/([^/]+)$/);
        if (readMatch?.[1] && request.method === "GET") {
            const voiceAgent = await context.voiceAgents.findById(context.ctx, decodeURIComponent(readMatch[1]));
            if (!voiceAgent) {
                context.sendJson(response, 404, { ok: false, error: "Voice agent not found." });
                return true;
            }
            context.sendJson(response, 200, { ok: true, voiceAgent });
            return true;
        }

        const updateMatch = pathname.match(/^\/voice-agents\/([^/]+)\/update$/);
        if (updateMatch?.[1] && request.method === "POST") {
            const body = await context.readJsonBody(request);
            const voiceAgent = await context.voiceAgents.update(context.ctx, decodeURIComponent(updateMatch[1]), {
                name: optionalStringValue(body.name),
                description: optionalNullableStringValue(body.description),
                systemPrompt: optionalStringValue(body.systemPrompt),
                tools: body.tools !== undefined ? toolsValue(body.tools) : undefined,
                settings: body.settings !== undefined ? objectValue(body.settings) : undefined,
                updatedAt: numberValue(body.updatedAt) ?? Date.now()
            });
            context.sendJson(response, 200, { ok: true, voiceAgent });
            return true;
        }

        const deleteMatch = pathname.match(/^\/voice-agents\/([^/]+)\/delete$/);
        if (deleteMatch?.[1] && request.method === "POST") {
            const voiceAgent = await context.voiceAgents.delete(context.ctx, decodeURIComponent(deleteMatch[1]));
            context.sendJson(response, 200, { ok: true, voiceAgent });
            return true;
        }

        const startMatch = pathname.match(/^\/voice-agents\/([^/]+)\/session\/start$/);
        if (startMatch?.[1] && request.method === "POST") {
            if (!context.voiceRegistry) {
                context.sendJson(response, 503, { ok: false, error: "Voice session providers unavailable." });
                return true;
            }

            const voiceAgent = await context.voiceAgents.findById(context.ctx, decodeURIComponent(startMatch[1]));
            if (!voiceAgent) {
                context.sendJson(response, 404, { ok: false, error: "Voice agent not found." });
                return true;
            }
            const provider = voiceProviderResolve(context.voiceRegistry, voiceAgent.settings);
            const session = await provider.startSession(
                {
                    voiceAgentId: voiceAgent.id,
                    systemPrompt: voiceAgent.systemPrompt,
                    tools: voiceAgent.tools,
                    settings: voiceAgent.settings
                },
                {
                    ctx: context.ctx,
                    logger: getLogger("api.voice.session")
                }
            );
            context.sendJson(response, 200, {
                ok: true,
                providerId: provider.id,
                voiceAgent,
                session
            });
            return true;
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : "Voice agent request failed.";
        const statusCode = message.toLowerCase().includes("not found")
            ? 404
            : message.toLowerCase().includes("unavailable")
              ? 503
              : 400;
        context.sendJson(response, statusCode, { ok: false, error: message });
        return true;
    }

    return false;
}

function requiredStringValue(value: unknown, errorMessage: string): string {
    const normalized = typeof value === "string" ? value.trim() : "";
    if (!normalized) {
        throw new Error(errorMessage);
    }
    return normalized;
}

function stringValue(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function optionalStringValue(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
}

function optionalNullableStringValue(value: unknown): string | null | undefined {
    if (value === null) {
        return null;
    }
    return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function objectValue(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }
    return { ...value };
}

function toolsValue(value: unknown): VoiceAgentToolDefinition[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
        .map((entry) => ({
            name: stringValue(entry.name),
            description: stringValue(entry.description),
            parameters:
                typeof entry.parameters === "object" && entry.parameters !== null && !Array.isArray(entry.parameters)
                    ? Object.fromEntries(
                          Object.entries(entry.parameters).map(([key, parameter]) => [
                              key,
                              {
                                  type:
                                      typeof parameter === "object" &&
                                      parameter !== null &&
                                      typeof parameter.type === "string"
                                          ? parameter.type.trim()
                                          : "string",
                                  description:
                                      typeof parameter === "object" &&
                                      parameter !== null &&
                                      typeof parameter.description === "string"
                                          ? parameter.description.trim()
                                          : "",
                                  required:
                                      typeof parameter === "object" && parameter !== null && parameter.required === true
                                          ? true
                                          : undefined
                              }
                          ])
                      )
                    : {}
        }))
        .filter((entry) => entry.name.length > 0 && entry.description.length > 0);
}

function voiceProviderResolve(voiceRegistry: VoiceAgentRegistry, settings: Record<string, unknown>) {
    const configuredProviderId =
        typeof settings.providerId === "string" && settings.providerId.trim().length > 0
            ? settings.providerId.trim()
            : null;
    if (configuredProviderId) {
        const provider = voiceRegistry.get(configuredProviderId);
        if (!provider) {
            throw new Error(`Unknown voice provider: ${configuredProviderId}`);
        }
        return provider;
    }

    const providers = voiceRegistry.list();
    if (providers.length === 0) {
        throw new Error("No voice session providers available.");
    }
    if (providers.length > 1) {
        throw new Error("Multiple voice providers available; specify settings.providerId.");
    }
    return providers[0]!;
}
