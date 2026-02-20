import { describe, expect, it, vi } from "vitest";

import type {
    AgentDescriptor,
    PermissionDecision,
    PermissionRequest,
    SessionPermissions,
    ToolExecutionContext
} from "@/types";
import { PermissionRequestRegistry } from "./permissionRequestRegistry.js";
import { buildPermissionRequestTool } from "./permissions.js";

const toolCall = { id: "tool-1", name: "request_permission" };

describe("buildPermissionRequestTool", () => {
    it("waits for approval and returns a granted result", async () => {
        const registry = new PermissionRequestRegistry();
        const grantPermission = vi.fn(async () => undefined);
        const requestPermission = vi.fn(
            async (_targetId: string, _request: PermissionRequest, _context: unknown, _descriptor: unknown) => undefined
        );

        const context = contextBuild({
            registry,
            connector: { requestPermission },
            agentSystem: { grantPermission }
        });

        const pending = buildPermissionRequestTool().execute(
            { permissions: ["@network"], reason: "Need web access" },
            context,
            toolCall
        );

        const request = await permissionRequestWait(requestPermission);

        await registryResolveWhenReady(
            registry,
            decisionBuild({
                token: request.token,
                agentId: request.agentId,
                approved: true,
                permissions: request.permissions
            })
        );

        const result = await pending;
        expect(grantPermission).toHaveBeenCalledWith(
            { agentId: "agent-1" },
            { kind: "network" },
            expect.objectContaining({ source: "telegram" })
        );
        expect(result.toolMessage.isError).toBe(false);
        expect(contentText(result.toolMessage.content)).toBe("Permission granted for network access.");
    });

    it("waits for denial and returns a denied result", async () => {
        const registry = new PermissionRequestRegistry();
        const grantPermission = vi.fn(async () => undefined);
        const requestPermission = vi.fn(
            async (_targetId: string, _request: PermissionRequest, _context: unknown, _descriptor: unknown) => undefined
        );

        const context = contextBuild({
            registry,
            connector: { requestPermission },
            agentSystem: { grantPermission }
        });

        const pending = buildPermissionRequestTool().execute(
            { permissions: ["@network"], reason: "Need web access" },
            context,
            toolCall
        );

        const request = await permissionRequestWait(requestPermission);

        await registryResolveWhenReady(
            registry,
            decisionBuild({
                token: request.token,
                agentId: request.agentId,
                approved: false,
                permissions: request.permissions
            })
        );

        const result = await pending;
        expect(grantPermission).not.toHaveBeenCalled();
        expect(result.toolMessage.isError).toBe(false);
        expect(contentText(result.toolMessage.content)).toBe("Permission denied for network access.");
    });

    it("requests and grants multiple permissions in one call", async () => {
        const registry = new PermissionRequestRegistry();
        const grantPermission = vi.fn(async () => undefined);
        const requestPermission = vi.fn(
            async (_targetId: string, _request: PermissionRequest, _context: unknown, _descriptor: unknown) => undefined
        );

        const context = contextBuild({
            registry,
            connector: { requestPermission },
            agentSystem: { grantPermission }
        });

        const pending = buildPermissionRequestTool().execute(
            { permissions: ["@network", "@read:/tmp"], reason: "Need web and files" },
            context,
            toolCall
        );

        const request = await permissionRequestWait(requestPermission);

        await registryResolveWhenReady(
            registry,
            decisionBuild({
                token: request.token,
                agentId: request.agentId,
                approved: true,
                permissions: request.permissions
            })
        );

        const result = await pending;
        expect(grantPermission).toHaveBeenCalledTimes(2);
        expect(grantPermission).toHaveBeenNthCalledWith(
            1,
            { agentId: "agent-1" },
            { kind: "network" },
            expect.objectContaining({ source: "telegram" })
        );
        expect(grantPermission).toHaveBeenNthCalledWith(
            2,
            { agentId: "agent-1" },
            { kind: "read", path: "/tmp" },
            expect.objectContaining({ source: "telegram" })
        );
        expect(contentText(result.toolMessage.content)).toBe(
            "Permissions granted for network access, read access to /tmp."
        );
    });

    it("returns immediately when requested permissions are already granted", async () => {
        const registry = new PermissionRequestRegistry();
        const grantPermission = vi.fn(async () => undefined);
        const requestPermission = vi.fn(
            async (_targetId: string, _request: PermissionRequest, _context: unknown, _descriptor: unknown) => undefined
        );

        const context = contextBuild({
            registry,
            connector: { requestPermission },
            agentSystem: { grantPermission },
            permissions: permissionsBuild({ network: true })
        });

        const result = await buildPermissionRequestTool().execute(
            { permissions: ["@network"], reason: "Need web access" },
            context,
            toolCall
        );

        expect(requestPermission).not.toHaveBeenCalled();
        expect(grantPermission).not.toHaveBeenCalled();
        expect(result.toolMessage.isError).toBe(false);
        expect(contentText(result.toolMessage.content)).toBe("Permission already granted for network access.");
    });

    it("requests approval for protected app policy files", async () => {
        const registry = new PermissionRequestRegistry();
        const grantPermission = vi.fn(async () => undefined);
        const requestPermission = vi.fn(
            async (_targetId: string, _request: PermissionRequest, _context: unknown, _descriptor: unknown) => undefined
        );

        const context = contextBuild({
            registry,
            connector: { requestPermission },
            agentSystem: { grantPermission },
            permissions: permissionsBuild({ writeDirs: ["/workspace"] })
        });

        const pending = buildPermissionRequestTool().execute(
            {
                permissions: ["@write:/workspace/apps/my-app/PERMISSIONS.md"],
                reason: "Confirm app policy change"
            },
            context,
            toolCall
        );

        const request = await permissionRequestWait(requestPermission);
        expect(request.permissions).toEqual([
            {
                permission: "@write:/workspace/apps/my-app/PERMISSIONS.md",
                access: { kind: "write", path: "/workspace/apps/my-app/PERMISSIONS.md" }
            }
        ]);

        await registryResolveWhenReady(
            registry,
            decisionBuild({
                token: request.token,
                agentId: request.agentId,
                approved: true,
                permissions: request.permissions
            })
        );

        const result = await pending;
        expect(grantPermission).toHaveBeenCalledTimes(1);
        expect(grantPermission).toHaveBeenCalledWith(
            { agentId: "agent-1" },
            { kind: "write", path: "/workspace/apps/my-app/PERMISSIONS.md" },
            expect.objectContaining({ source: "telegram" })
        );
        expect(contentText(result.toolMessage.content)).toBe(
            "Permission granted for write access to /workspace/apps/my-app/PERMISSIONS.md."
        );
    });

    it("requests only permissions that are still missing", async () => {
        const registry = new PermissionRequestRegistry();
        const grantPermission = vi.fn(async () => undefined);
        const requestPermission = vi.fn(
            async (_targetId: string, _request: PermissionRequest, _context: unknown, _descriptor: unknown) => undefined
        );

        const context = contextBuild({
            registry,
            connector: { requestPermission },
            agentSystem: { grantPermission },
            permissions: permissionsBuild({ network: true })
        });

        const pending = buildPermissionRequestTool().execute(
            { permissions: ["@network", "@read:/tmp"], reason: "Need web and files" },
            context,
            toolCall
        );

        const request = await permissionRequestWait(requestPermission);
        expect(request.permissions).toEqual([{ permission: "@read:/tmp", access: { kind: "read", path: "/tmp" } }]);

        await registryResolveWhenReady(
            registry,
            decisionBuild({
                token: request.token,
                agentId: request.agentId,
                approved: true,
                permissions: request.permissions
            })
        );

        const result = await pending;
        expect(grantPermission).toHaveBeenCalledTimes(1);
        expect(grantPermission).toHaveBeenCalledWith(
            { agentId: "agent-1" },
            { kind: "read", path: "/tmp" },
            expect.objectContaining({ source: "telegram" })
        );
        expect(contentText(result.toolMessage.content)).toBe("Permission granted for read access to /tmp.");
    });

    it("returns an error result when the permission request times out", async () => {
        vi.useFakeTimers();
        try {
            const registry = new PermissionRequestRegistry();
            const grantPermission = vi.fn(async () => undefined);
            const requestPermission = vi.fn(
                async (_targetId: string, _request: PermissionRequest, _context: unknown, _descriptor: unknown) =>
                    undefined
            );

            const context = contextBuild({
                registry,
                connector: { requestPermission },
                agentSystem: { grantPermission }
            });

            const pending = buildPermissionRequestTool().execute(
                {
                    permissions: ["@network"],
                    reason: "Need web access",
                    timeout_minutes: 1
                },
                context,
                toolCall
            );

            await Promise.resolve();
            await vi.advanceTimersByTimeAsync(60_000);

            const result = await pending;
            expect(grantPermission).not.toHaveBeenCalled();
            expect(result.toolMessage.isError).toBe(true);
            expect(contentText(result.toolMessage.content)).toBe("Permission request timed out after 1 minute.");
        } finally {
            vi.useRealTimers();
        }
    });

    it("notifies foreground agent when background agent requests permission", async () => {
        const registry = new PermissionRequestRegistry();
        const post = vi.fn(async () => undefined);
        const requestPermission = vi.fn(
            async (_targetId: string, _request: PermissionRequest, _context: unknown, _descriptor: unknown) => undefined
        );

        const context = contextBuild({
            descriptor: {
                type: "permanent",
                id: "agent-1",
                name: "worker",
                description: "background worker",
                systemPrompt: "run tasks"
            },
            registry,
            connector: { requestPermission },
            agentSystem: {
                post,
                agentFor: () => "foreground-1",
                getAgentDescriptor: (agentId: string) => {
                    if (agentId === "foreground-1") {
                        return {
                            type: "user",
                            connector: "telegram",
                            userId: "u1",
                            channelId: "c1"
                        };
                    }
                    return null;
                }
            }
        });

        const pending = buildPermissionRequestTool().execute(
            { permissions: ["@network"], reason: "Need web access" },
            context,
            toolCall
        );

        const request = await permissionRequestWait(requestPermission);

        await registryResolveWhenReady(
            registry,
            decisionBuild({
                token: request.token,
                agentId: request.agentId,
                approved: false,
                permissions: request.permissions
            })
        );

        await pending;

        expect(post).toHaveBeenCalledWith(
            { agentId: "foreground-1" },
            {
                type: "system_message",
                text: expect.stringContaining('Permission request from background agent "worker"'),
                origin: "agent-1",
                silent: true
            }
        );
    });

    it("routes app `always` scope grants to shared app permissions", async () => {
        const registry = new PermissionRequestRegistry();
        const grantPermission = vi.fn(async () => undefined);
        const grantAppPermission = vi.fn(async () => undefined);
        const requestPermission = vi.fn(
            async (_targetId: string, _request: PermissionRequest, _context: unknown, _descriptor: unknown) => undefined
        );

        const context = contextBuild({
            descriptor: {
                type: "app",
                id: "agent-1",
                parentAgentId: "parent-1",
                name: "github-reviewer",
                systemPrompt: "review pull requests",
                appId: "github-reviewer"
            },
            registry,
            connector: { requestPermission },
            agentSystem: {
                grantPermission,
                grantAppPermission,
                agentFor: () => "foreground-1",
                getAgentDescriptor: (agentId: string) => {
                    if (agentId === "foreground-1") {
                        return {
                            type: "user",
                            connector: "telegram",
                            userId: "u1",
                            channelId: "c1"
                        };
                    }
                    return null;
                }
            }
        });

        const pending = buildPermissionRequestTool().execute(
            { permissions: ["@network"], reason: "Need web access", scope: "always" },
            context,
            toolCall
        );

        const request = await permissionRequestWait(requestPermission);
        await registryResolveWhenReady(
            registry,
            decisionBuild({
                token: request.token,
                agentId: request.agentId,
                approved: true,
                permissions: request.permissions
            })
        );

        const result = await pending;
        expect(grantAppPermission).toHaveBeenCalledWith(
            "github-reviewer",
            { kind: "network" },
            expect.objectContaining({ source: "telegram" })
        );
        expect(grantPermission).not.toHaveBeenCalled();
        expect(contentText(result.toolMessage.content)).toContain("Scope: Always (all future runs for this app).");
    });

    it("rejects scoped permission requests from non-app agents", async () => {
        const registry = new PermissionRequestRegistry();
        const context = contextBuild({ registry });
        await expect(
            buildPermissionRequestTool().execute(
                { permissions: ["@network"], reason: "Need web access", scope: "always" },
                context,
                toolCall
            )
        ).rejects.toThrow("Permission scope is only supported for app agents.");
    });
});

function contextBuild(options: {
    descriptor?: AgentDescriptor;
    registry: PermissionRequestRegistry;
    connector?: {
        requestPermission?: (
            targetId: string,
            request: PermissionRequest,
            context: unknown,
            descriptor: unknown
        ) => Promise<void>;
    };
    agentSystem?: {
        grantPermission?: (...args: unknown[]) => Promise<void>;
        grantAppPermission?: (...args: unknown[]) => Promise<void>;
        post?: (...args: unknown[]) => Promise<void>;
        agentFor?: (strategy: "most-recent-foreground" | "heartbeat") => string | null;
        getAgentDescriptor?: (agentId: string) => AgentDescriptor | null;
        permissionsForTarget?: (
            target: { agentId: string } | { descriptor: AgentDescriptor }
        ) => Promise<SessionPermissions>;
    };
    permissions?: SessionPermissions;
}): ToolExecutionContext {
    const descriptor: AgentDescriptor = options.descriptor ?? {
        type: "user",
        connector: "telegram",
        userId: "u1",
        channelId: "c1"
    };
    const permissions = options.permissions ?? permissionsBuild();

    const connector = {
        requestPermission: options.connector?.requestPermission,
        sendMessage: vi.fn(async () => undefined)
    };

    return {
        connectorRegistry: {
            get: vi.fn(() => connector)
        } as unknown as ToolExecutionContext["connectorRegistry"],
        fileStore: null as unknown as ToolExecutionContext["fileStore"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        permissions,
        agent: {
            id: "agent-1",
            descriptor,
            state: {
                permissions
            }
        } as unknown as ToolExecutionContext["agent"],
        agentContext: null as unknown as ToolExecutionContext["agentContext"],
        source: "telegram",
        messageContext: { messageId: "m1" },
        agentSystem: {
            grantPermission: options.agentSystem?.grantPermission ?? (async () => undefined),
            grantAppPermission: options.agentSystem?.grantAppPermission ?? (async () => undefined),
            post: options.agentSystem?.post ?? (async () => undefined),
            agentFor: options.agentSystem?.agentFor ?? (() => "agent-1"),
            getAgentDescriptor: options.agentSystem?.getAgentDescriptor ?? (() => descriptor),
            permissionsForTarget: options.agentSystem?.permissionsForTarget ?? (async () => permissions)
        } as unknown as ToolExecutionContext["agentSystem"],
        heartbeats: null as unknown as ToolExecutionContext["heartbeats"],
        permissionRequestRegistry: options.registry
    };
}

function permissionsBuild(overrides: Partial<SessionPermissions> = {}): SessionPermissions {
    return {
        workingDir: "/workspace",
        writeDirs: ["/workspace"],
        readDirs: ["/workspace"],
        network: false,
        events: false,
        ...overrides
    };
}

function decisionBuild(overrides: Partial<PermissionDecision> = {}): PermissionDecision {
    return {
        token: "token-1",
        agentId: "agent-1",
        approved: false,
        permissions: [{ permission: "@network", access: { kind: "network" } }],
        ...overrides
    };
}

async function registryResolveWhenReady(
    registry: PermissionRequestRegistry,
    decision: PermissionDecision
): Promise<void> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
        if (registry.resolve(decision.token, decision)) {
            return;
        }
        await Promise.resolve();
    }
    throw new Error("Permission token was never registered.");
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

function contentText(content: unknown): string {
    if (!Array.isArray(content)) {
        return "";
    }
    return content
        .filter((item) => {
            if (typeof item !== "object" || item === null) {
                return false;
            }
            return (item as { type?: unknown }).type === "text";
        })
        .map((item) => (item as { text?: unknown }).text)
        .filter((value): value is string => typeof value === "string")
        .join("\n");
}
