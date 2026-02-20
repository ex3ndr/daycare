import type { ToolResultMessage } from "@mariozechner/pi-ai";
import type { Static } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";
import { z } from "zod";
import type { AgentDescriptor, MessageContext, ToolDefinition, ToolResultContract } from "@/types";
import { definePlugin } from "../../engine/plugins/types.js";
import { upgradePm2ProcessDetect } from "./upgradePm2ProcessDetect.js";
import { upgradeRestartPendingClear } from "./upgradeRestartPendingClear.js";
import { upgradeRestartPendingSet } from "./upgradeRestartPendingSet.js";
import { upgradeRestartPendingTake } from "./upgradeRestartPendingTake.js";
import { upgradeRestartRun } from "./upgradeRestartRun.js";
import { upgradeRun } from "./upgradeRun.js";
import { upgradeVersionRead } from "./upgradeVersionRead.js";

const UPGRADE_COMMAND = "upgrade";
const RESTART_COMMAND = "restart";
const RESTART_CONFIRM_MAX_AGE_MS = 5 * 60 * 1000;

const settingsSchema = z
    .object({
        strategy: z.literal("pm2"),
        processName: z.string().trim().min(1),
        selfUpgrade: z
            .object({
                enabled: z.boolean().optional().default(false)
            })
            .optional()
            .default({ enabled: false })
    })
    .passthrough();

type UpgradePluginSettings = {
    strategy: "pm2";
    processName: string;
    selfUpgrade?: {
        enabled?: boolean;
    };
};

// Tool schema for self_upgrade
const selfUpgradeToolSchema = Type.Object(
    {
        version: Type.Optional(
            Type.String({
                description: "Specific version to install (e.g. '2026.2.1'). If omitted, installs latest."
            })
        )
    },
    { additionalProperties: false }
);

type SelfUpgradeArgs = Static<typeof selfUpgradeToolSchema>;

const selfUpgradeResultSchema = Type.Object(
    {
        success: Type.Boolean(),
        message: Type.String(),
        previousVersion: Type.Optional(Type.String()),
        requestedVersion: Type.Optional(Type.String())
    },
    { additionalProperties: false }
);

type SelfUpgradeResult = Static<typeof selfUpgradeResultSchema>;

const selfUpgradeReturns: ToolResultContract<SelfUpgradeResult> = {
    schema: selfUpgradeResultSchema,
    toLLMText: (result) => result.message
};

export const plugin = definePlugin({
    settingsSchema,
    onboarding: async (api) => {
        const detection = await upgradePm2ProcessDetect("daycare");
        if (!detection.found) {
            api.note(`Upgrade plugin requires an online PM2 process named "daycare". ${detection.reason}`, "Upgrade");
            return null;
        }
        api.note(`Detected online PM2 process "${detection.processName}". Upgrade plugin configured.`, "Upgrade");

        // Ask if self-upgrade tool should be enabled
        const enableSelfUpgrade = await api.prompt.confirm({
            message: "Enable self_upgrade tool? (allows agent to upgrade Daycare programmatically)",
            default: false
        });

        return {
            settings: {
                strategy: "pm2",
                processName: detection.processName,
                selfUpgrade: {
                    enabled: enableSelfUpgrade ?? false
                }
            }
        };
    },
    create: (api) => {
        const settings = api.settings as UpgradePluginSettings;
        const selfUpgradeEnabled = settings.selfUpgrade?.enabled ?? false;

        const upgradeHandler = async (
            _command: string,
            context: MessageContext,
            descriptor: AgentDescriptor
        ): Promise<void> => {
            if (descriptor.type !== "user") {
                return;
            }

            const sendStatus = async (text: string): Promise<void> => {
                try {
                    await api.registrar.sendMessage(descriptor, context, { text });
                } catch (error) {
                    api.logger.warn({ error }, "error: Failed to send upgrade status message");
                }
            };

            await sendStatus("Upgrading Daycare...");
            const previousVersion = await upgradeVersionRead();
            if (previousVersion) {
                try {
                    await upgradeRestartPendingSet({
                        dataDir: api.dataDir,
                        descriptor,
                        context,
                        requestedAtMs: Date.now(),
                        requesterPid: process.pid,
                        previousVersion
                    });
                } catch (error) {
                    api.logger.warn({ error }, "error: Failed to persist upgrade pending marker");
                }
            }
            try {
                await upgradeRun({
                    strategy: settings.strategy,
                    processName: settings.processName,
                    sendStatus
                });
            } catch (error) {
                await upgradeRestartPendingClear(api.dataDir);
                api.logger.warn({ error }, "error: Upgrade command failed");
            }
        };

        const restartHandler = async (
            _command: string,
            context: MessageContext,
            descriptor: AgentDescriptor
        ): Promise<void> => {
            if (descriptor.type !== "user") {
                return;
            }

            const sendStatus = async (text: string): Promise<void> => {
                try {
                    await api.registrar.sendMessage(descriptor, context, { text });
                } catch (error) {
                    api.logger.warn({ error }, "error: Failed to send restart status message");
                }
            };

            await sendStatus("Restarting Daycare...");
            try {
                await upgradeRestartPendingSet({
                    dataDir: api.dataDir,
                    descriptor,
                    context,
                    requestedAtMs: Date.now(),
                    requesterPid: process.pid
                });
            } catch (error) {
                api.logger.warn({ error }, "error: Failed to persist restart pending marker");
                await sendStatus("Restart failed before scheduling confirmation.");
                return;
            }
            try {
                await upgradeRestartRun({
                    strategy: settings.strategy,
                    processName: settings.processName,
                    sendStatus
                });
            } catch (error) {
                await upgradeRestartPendingClear(api.dataDir);
                api.logger.warn({ error }, "error: Restart command failed");
            }
        };

        // Build the self_upgrade tool
        const buildSelfUpgradeTool = (): ToolDefinition<typeof selfUpgradeToolSchema, SelfUpgradeResult> => ({
            tool: {
                name: "self_upgrade",
                description:
                    "Upgrade the Daycare CLI to a newer version and restart. " +
                    "Only available in foreground sessions (direct user chat) and when enabled in configuration. " +
                    "After upgrade, the process restarts and agent context is reset.",
                parameters: selfUpgradeToolSchema
            },
            returns: selfUpgradeReturns,
            execute: async (args, toolContext, toolCall) => {
                const payload = args as SelfUpgradeArgs;
                const descriptor = toolContext.agent.descriptor;

                // Check if self-upgrade is enabled in configuration
                if (!selfUpgradeEnabled) {
                    const message =
                        "Self-upgrade is disabled in configuration. Enable it in the upgrade plugin settings (selfUpgrade.enabled: true).";
                    const toolMessage: ToolResultMessage = {
                        role: "toolResult",
                        toolCallId: toolCall.id,
                        toolName: toolCall.name,
                        content: [{ type: "text", text: message }],
                        isError: true,
                        timestamp: Date.now()
                    };
                    return {
                        toolMessage,
                        typedResult: {
                            success: false,
                            message
                        }
                    };
                }

                // Only allow in foreground (user) sessions
                if (descriptor.type !== "user") {
                    const message = "Self-upgrade is only available in foreground sessions (direct user chat).";
                    const toolMessage: ToolResultMessage = {
                        role: "toolResult",
                        toolCallId: toolCall.id,
                        toolName: toolCall.name,
                        content: [{ type: "text", text: message }],
                        isError: true,
                        timestamp: Date.now()
                    };
                    return {
                        toolMessage,
                        typedResult: {
                            success: false,
                            message
                        }
                    };
                }

                const previousVersion = await upgradeVersionRead();
                const versionToInstall = payload.version ?? "latest";

                api.logger.info({ previousVersion, versionToInstall }, "self_upgrade: Starting upgrade");

                // Set up pending marker for post-restart confirmation
                if (previousVersion) {
                    try {
                        await upgradeRestartPendingSet({
                            dataDir: api.dataDir,
                            descriptor,
                            context: toolContext.messageContext,
                            requestedAtMs: Date.now(),
                            requesterPid: process.pid,
                            previousVersion
                        });
                    } catch (error) {
                        api.logger.warn({ error }, "self_upgrade: Failed to persist upgrade pending marker");
                    }
                }

                try {
                    // Run the upgrade with version support
                    await upgradeRun({
                        strategy: settings.strategy,
                        processName: settings.processName,
                        version: payload.version,
                        sendStatus: async (text) => {
                            api.logger.info({ text }, "self_upgrade: Status update");
                        }
                    });

                    // If we reach here, the process is about to restart
                    const message = `Upgrade to ${versionToInstall} initiated. The process is restarting.`;
                    const toolMessage: ToolResultMessage = {
                        role: "toolResult",
                        toolCallId: toolCall.id,
                        toolName: toolCall.name,
                        content: [{ type: "text", text: message }],
                        isError: false,
                        timestamp: Date.now()
                    };
                    return {
                        toolMessage,
                        typedResult: {
                            success: true,
                            message,
                            previousVersion: previousVersion ?? undefined,
                            requestedVersion: versionToInstall
                        }
                    };
                } catch (error) {
                    await upgradeRestartPendingClear(api.dataDir);
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    api.logger.error({ error }, "self_upgrade: Upgrade failed");

                    const message = `Upgrade failed: ${errorMessage}`;
                    const toolMessage: ToolResultMessage = {
                        role: "toolResult",
                        toolCallId: toolCall.id,
                        toolName: toolCall.name,
                        content: [{ type: "text", text: message }],
                        isError: true,
                        timestamp: Date.now()
                    };
                    return {
                        toolMessage,
                        typedResult: {
                            success: false,
                            message,
                            previousVersion: previousVersion ?? undefined,
                            requestedVersion: versionToInstall
                        }
                    };
                }
            }
        });

        return {
            load: async () => {
                api.registrar.registerCommand({
                    command: UPGRADE_COMMAND,
                    description: "Upgrade daycare to latest version",
                    handler: upgradeHandler
                });
                api.registrar.registerCommand({
                    command: RESTART_COMMAND,
                    description: "Restart the daycare server process",
                    handler: restartHandler
                });
                // Register the self_upgrade tool (always registered, but checks config at runtime)
                api.registrar.registerTool(buildSelfUpgradeTool());
            },
            unload: async () => {
                api.registrar.unregisterCommand(UPGRADE_COMMAND);
                api.registrar.unregisterCommand(RESTART_COMMAND);
                api.registrar.unregisterTool("self_upgrade");
            },
            postStart: async () => {
                const pending = await upgradeRestartPendingTake(api.dataDir);
                if (!pending) {
                    return;
                }
                if (pending.requesterPid === process.pid) {
                    return;
                }
                if (Date.now() - pending.requestedAtMs > RESTART_CONFIRM_MAX_AGE_MS) {
                    return;
                }
                if (pending.previousVersion) {
                    const currentVersion = await upgradeVersionRead();
                    if (!currentVersion || currentVersion === pending.previousVersion) {
                        return;
                    }
                    try {
                        await api.registrar.sendMessage(pending.descriptor, pending.context, {
                            text: `Upgrade complete: Daycare ${pending.previousVersion} -> ${currentVersion}.`
                        });
                    } catch (error) {
                        api.logger.warn({ error }, "error: Failed to send upgrade completion status message");
                    }
                    return;
                }
                try {
                    await api.registrar.sendMessage(pending.descriptor, pending.context, {
                        text: "Restart complete. Daycare is back online."
                    });
                } catch (error) {
                    api.logger.warn({ error }, "error: Failed to send restart completion status message");
                }
            }
        };
    }
});
