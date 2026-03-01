import { promises as fs } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { plugin } from "./plugin.js";

describe("system-feedback plugin onboarding", () => {
    it("stores targetAgentId when provided", async () => {
        const prompt = {
            input: vi.fn().mockResolvedValueOnce("feedback-agent-1")
        };

        const result = await plugin.onboarding?.({ prompt } as never);

        expect(result).toEqual({
            settings: {
                targetAgentId: "feedback-agent-1"
            }
        });
    });

    it("stores empty settings when target agent input is blank", async () => {
        const prompt = {
            input: vi.fn().mockResolvedValueOnce("   ")
        };

        const result = await plugin.onboarding?.({ prompt } as never);

        expect(result).toEqual({
            settings: {}
        });
    });
});

describe("system-feedback plugin tool", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("registers and unregisters system_feedback tool", async () => {
        const api = createPluginApi({ targetAgentId: "feedback-agent" });
        const instance = await plugin.create(api as never);

        await instance.load?.();
        expect(api.registrar.registerTool).toHaveBeenCalledTimes(1);
        expect(api.registrar.registerTool).toHaveBeenCalledWith(
            expect.objectContaining({
                tool: expect.objectContaining({
                    name: "system_feedback"
                })
            })
        );

        await instance.unload?.();
        expect(api.registrar.unregisterTool).toHaveBeenCalledWith("system_feedback");
    });

    it("logs feedback and delivers system message when target agent is configured", async () => {
        const appendSpy = vi.spyOn(fs, "appendFile").mockResolvedValue(undefined);
        const usersFindById = vi.fn(async () => ({
            id: "user-1",
            firstName: "Steve",
            lastName: null,
            nametag: "steve"
        }));
        const post = vi.fn(async () => undefined);

        const api = createPluginApi({ targetAgentId: "feedback-agent" });
        const execute = await registerToolAndGetExecute(api);

        const result = await execute(
            {
                prompt: "The search tool times out on large queries"
            },
            {
                ctx: { userId: "user-1" },
                agent: { id: "sender-agent" },
                agentSystem: {
                    storage: {
                        users: {
                            findById: usersFindById
                        }
                    },
                    post
                }
            },
            {
                id: "tool-1",
                name: "system_feedback"
            }
        );

        expect(result.toolMessage.isError).toBe(false);
        expect(result.typedResult).toEqual({
            success: true,
            message: "Feedback logged and delivered to agent feedback-agent.",
            delivered: true,
            targetAgentId: "feedback-agent",
            feedbackLogPath: "/tmp/daycare/plugins/system-feedback-1/feedback.log"
        });

        expect(post).toHaveBeenCalledWith(
            { userId: "user-1" },
            { agentId: "feedback-agent" },
            {
                type: "system_message",
                text: [
                    "## System Feedback",
                    "",
                    "**From agent:** sender-agent",
                    "**From user:** Steve (@steve, id: user-1)",
                    "",
                    "### Feedback",
                    "The search tool times out on large queries"
                ].join("\n"),
                origin: "plugin:system-feedback",
                silent: false
            }
        );

        expect(appendSpy).toHaveBeenCalledWith(
            "/tmp/daycare/plugins/system-feedback-1/feedback.log",
            expect.any(String),
            "utf8"
        );
        const appendedLine = appendSpy.mock.calls[0]?.[1];
        if (!appendedLine || typeof appendedLine !== "string") {
            throw new Error("Expected appendFile payload to be a string.");
        }
        const entry = JSON.parse(appendedLine.trim()) as {
            agentId: string;
            userId: string;
            nametag: string;
            name: string;
            prompt: string;
            timestamp: number;
        };
        expect(entry).toMatchObject({
            agentId: "sender-agent",
            userId: "user-1",
            nametag: "steve",
            name: "Steve",
            prompt: "The search tool times out on large queries"
        });
        expect(typeof entry.timestamp).toBe("number");
    });

    it("works in log-only mode when target agent is not configured", async () => {
        const appendSpy = vi.spyOn(fs, "appendFile").mockResolvedValue(undefined);
        const usersFindById = vi.fn(async () => ({
            id: "user-1",
            firstName: "Steve",
            lastName: null,
            nametag: "steve"
        }));
        const post = vi.fn(async () => undefined);

        const api = createPluginApi({});
        const execute = await registerToolAndGetExecute(api);

        const result = await execute(
            {
                prompt: "Need a capability to inspect plugin state"
            },
            {
                ctx: { userId: "user-1" },
                agent: { id: "sender-agent" },
                agentSystem: {
                    storage: {
                        users: {
                            findById: usersFindById
                        }
                    },
                    post
                }
            },
            {
                id: "tool-1",
                name: "system_feedback"
            }
        );

        expect(result.toolMessage.isError).toBe(false);
        expect(result.typedResult).toEqual({
            success: true,
            message: "Feedback logged in log-only mode (no target agent configured).",
            delivered: false,
            targetAgentId: undefined,
            feedbackLogPath: "/tmp/daycare/plugins/system-feedback-1/feedback.log"
        });
        expect(post).not.toHaveBeenCalled();
        expect(appendSpy).toHaveBeenCalledTimes(1);
    });

    it("returns an error result when sender user cannot be found", async () => {
        const appendSpy = vi.spyOn(fs, "appendFile").mockResolvedValue(undefined);
        const usersFindById = vi.fn(async () => null);
        const post = vi.fn(async () => undefined);

        const api = createPluginApi({ targetAgentId: "feedback-agent" });
        const execute = await registerToolAndGetExecute(api);

        const result = await execute(
            {
                prompt: "Something is broken"
            },
            {
                ctx: { userId: "missing-user" },
                agent: { id: "sender-agent" },
                agentSystem: {
                    storage: {
                        users: {
                            findById: usersFindById
                        }
                    },
                    post
                }
            },
            {
                id: "tool-1",
                name: "system_feedback"
            }
        );

        expect(result.toolMessage.isError).toBe(true);
        expect(result.typedResult).toEqual({
            success: false,
            message: "User not found for id missing-user.",
            delivered: false,
            targetAgentId: "feedback-agent",
            feedbackLogPath: "/tmp/daycare/plugins/system-feedback-1/feedback.log"
        });
        expect(post).not.toHaveBeenCalled();
        expect(appendSpy).not.toHaveBeenCalled();
    });

    it("returns an error result when delivery fails", async () => {
        const appendSpy = vi.spyOn(fs, "appendFile").mockResolvedValue(undefined);
        const usersFindById = vi.fn(async () => ({
            id: "user-1",
            firstName: "Steve",
            lastName: null,
            nametag: "steve"
        }));
        const post = vi.fn(async () => {
            throw new Error("post failed");
        });

        const api = createPluginApi({ targetAgentId: "feedback-agent" });
        const execute = await registerToolAndGetExecute(api);

        const result = await execute(
            {
                prompt: "Please add retry support"
            },
            {
                ctx: { userId: "user-1" },
                agent: { id: "sender-agent" },
                agentSystem: {
                    storage: {
                        users: {
                            findById: usersFindById
                        }
                    },
                    post
                }
            },
            {
                id: "tool-1",
                name: "system_feedback"
            }
        );

        expect(result.toolMessage.isError).toBe(true);
        expect(result.typedResult).toEqual({
            success: false,
            message: "Failed to submit system feedback: post failed",
            delivered: false,
            targetAgentId: "feedback-agent",
            feedbackLogPath: "/tmp/daycare/plugins/system-feedback-1/feedback.log"
        });
        expect(appendSpy).toHaveBeenCalledTimes(1);
        expect(post).toHaveBeenCalledTimes(1);
    });
});

type SystemFeedbackSettings = {
    targetAgentId?: string;
};

type SystemFeedbackToolResult = {
    toolMessage: {
        isError: boolean;
    };
    typedResult: {
        success: boolean;
        message: string;
        delivered: boolean;
        targetAgentId?: string;
        feedbackLogPath: string;
    };
};

function createPluginApi(settings: SystemFeedbackSettings): {
    dataDir: string;
    settings: SystemFeedbackSettings;
    registrar: {
        registerTool: ReturnType<typeof vi.fn>;
        unregisterTool: ReturnType<typeof vi.fn>;
    };
} {
    return {
        instance: { instanceId: "system-feedback-1", pluginId: "system-feedback", enabled: true },
        settings,
        engineSettings: {},
        logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
        auth: {},
        dataDir: path.join("/tmp/daycare/plugins", "system-feedback-1"),
        tmpDir: "/tmp/daycare/tmp",
        registrar: {
            registerTool: vi.fn(),
            unregisterTool: vi.fn()
        },
        exposes: {
            registerProvider: vi.fn(async () => undefined),
            unregisterProvider: vi.fn(async () => undefined),
            listProviders: () => []
        },
        fileStore: {},
        inference: {
            complete: async () => {
                throw new Error("Inference not available in test.");
            }
        },
        processes: {},
        mode: "runtime",
        events: {
            emit: () => undefined
        }
    } as never;
}

async function registerToolAndGetExecute(
    api: ReturnType<typeof createPluginApi>
): Promise<
    (args: unknown, context: unknown, toolCall: { id: string; name: string }) => Promise<SystemFeedbackToolResult>
> {
    const instance = await plugin.create(api as never);
    await instance.load?.();

    const entry = api.registrar.registerTool.mock.calls[0]?.[0] as {
        execute?: (
            args: unknown,
            context: unknown,
            toolCall: { id: string; name: string }
        ) => Promise<SystemFeedbackToolResult>;
    };
    if (!entry?.execute) {
        throw new Error("Expected system_feedback tool to be registered.");
    }
    return entry.execute;
}
