import { describe, expect, it, vi } from "vitest";

import type { AgentDescriptor, PermissionRequest } from "@/types";
import type { AgentSystem } from "../agents/agentSystem.js";
import type { ConnectorRegistry } from "../modules/connectorRegistry.js";
import { PermissionRequestRegistry } from "../modules/tools/permissionRequestRegistry.js";
import { gatePermissionRequest } from "./gatePermissionRequest.js";

describe("gatePermissionRequest", () => {
    it("requests permission, waits for approval, and grants missing access", async () => {
        const registry = new PermissionRequestRegistry();
        const grantPermission = vi.fn(async () => undefined);
        const requestPermission = vi.fn(async (_targetId: string, _request: PermissionRequest) => undefined);

        const pending = gatePermissionRequest({
            missing: ["@network"],
            taskLabel: "cron task alpha",
            agentId: "agent-1",
            agentSystem: agentSystemBuild({
                grantPermission
            }),
            connectorRegistry: connectorRegistryBuild({ requestPermission }),
            permissionRequestRegistry: registry
        });

        const request = await permissionRequestWait(requestPermission);
        await registryResolveWhenReady(registry, {
            token: request.token,
            agentId: request.agentId,
            approved: true,
            permissions: request.permissions,
            scope: "always"
        });

        const result = await pending;

        expect(result.granted).toBe(true);
        expect(request.scope).toBe("always");
        expect(grantPermission).toHaveBeenCalledTimes(1);
        expect(grantPermission).toHaveBeenCalledWith(
            { agentId: "agent-1" },
            { kind: "network" },
            expect.objectContaining({ source: "telegram" })
        );
    });

    it("returns false when permission is denied", async () => {
        const registry = new PermissionRequestRegistry();
        const grantPermission = vi.fn(async () => undefined);
        const requestPermission = vi.fn(async (_targetId: string, _request: PermissionRequest) => undefined);

        const pending = gatePermissionRequest({
            missing: ["@network"],
            taskLabel: "heartbeat task beta",
            agentId: "agent-1",
            agentSystem: agentSystemBuild({
                grantPermission
            }),
            connectorRegistry: connectorRegistryBuild({ requestPermission }),
            permissionRequestRegistry: registry
        });

        const request = await permissionRequestWait(requestPermission);
        await registryResolveWhenReady(registry, {
            token: request.token,
            agentId: request.agentId,
            approved: false,
            permissions: request.permissions,
            scope: "always"
        });

        const result = await pending;
        expect(result.granted).toBe(false);
        expect(grantPermission).not.toHaveBeenCalled();
    });

    it("returns false on timeout", async () => {
        const result = await gatePermissionRequest({
            missing: ["@network"],
            taskLabel: "cron task gamma",
            agentId: "agent-1",
            agentSystem: agentSystemBuild({}),
            connectorRegistry: connectorRegistryBuild({ requestPermission: vi.fn(async () => undefined) }),
            permissionRequestRegistry: new PermissionRequestRegistry(),
            timeoutMs: 10
        });

        expect(result.granted).toBe(false);
    });
});

function agentSystemBuild(overrides: {
    grantPermission?: (
        target: { agentId: string },
        access: { kind: string; path?: string },
        options?: { source?: string }
    ) => Promise<void>;
}): AgentSystem {
    const descriptors = new Map<string, AgentDescriptor>([
        [
            "foreground-1",
            {
                type: "user",
                connector: "telegram",
                userId: "u1",
                channelId: "c1"
            }
        ],
        [
            "agent-1",
            {
                type: "system",
                tag: "cron"
            }
        ]
    ]);

    return {
        agentFor: vi.fn(() => "foreground-1"),
        getAgentDescriptor: vi.fn((agentId: string) => descriptors.get(agentId) ?? null),
        grantPermission: overrides.grantPermission ?? (async () => undefined)
    } as unknown as AgentSystem;
}

function connectorRegistryBuild(options: {
    requestPermission?: (targetId: string, request: PermissionRequest) => Promise<void>;
}): ConnectorRegistry {
    return {
        get: vi.fn(() => ({
            capabilities: { sendText: true },
            onMessage: vi.fn(() => () => undefined),
            sendMessage: vi.fn(async () => undefined),
            requestPermission: options.requestPermission
        }))
    } as unknown as ConnectorRegistry;
}

async function permissionRequestWait(requestPermission: { mock: { calls: unknown[][] } }): Promise<PermissionRequest> {
    for (let attempt = 0; attempt < 50; attempt += 1) {
        const request = requestPermission.mock.calls[0]?.[1] as PermissionRequest | undefined;
        if (request) {
            return request;
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
    throw new Error("Expected permission request payload");
}

async function registryResolveWhenReady(
    registry: PermissionRequestRegistry,
    decision: {
        token: string;
        agentId: string;
        approved: boolean;
        permissions: PermissionRequest["permissions"];
        scope: "always";
    }
): Promise<void> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
        if (registry.resolve(decision.token, decision)) {
            return;
        }
        await Promise.resolve();
    }
    throw new Error("Permission token was never registered.");
}
