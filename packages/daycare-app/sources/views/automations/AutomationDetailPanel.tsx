import * as React from "react";
import { ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTasksStore } from "@/modules/tasks/tasksContext";
import { tasksFormatLastRun } from "@/modules/tasks/tasksFormatLastRun";

/**
 * Automation detail content.
 * Shows task code, description, parameters, triggers, and timestamps.
 * Expects the task to be selected via the tasks store before rendering.
 */
export const AutomationDetailPanel = React.memo(() => {
    const { theme } = useUnistyles();

    const detail = useTasksStore((s) => s.selectedDetail);

    // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally recompute when detail loads
    const now = React.useMemo(() => Date.now(), [detail]);

    if (!detail) {
        return null;
    }

    const { task, triggers } = detail;

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: theme.colors.surface }}
            contentContainerStyle={panelStyles.content}
        >
            {/* Description */}
            {task.description && (
                <View style={panelStyles.section}>
                    <Text style={[panelStyles.label, { color: theme.colors.onSurfaceVariant }]}>Description</Text>
                    <Text style={[panelStyles.value, { color: theme.colors.onSurface }]}>{task.description}</Text>
                </View>
            )}

            {/* Code */}
            <View style={panelStyles.section}>
                <Text style={[panelStyles.label, { color: theme.colors.onSurfaceVariant }]}>Code</Text>
                <View
                    style={[
                        panelStyles.codeBlock,
                        {
                            backgroundColor: theme.colors.surfaceContainerHighest,
                            borderColor: theme.colors.outlineVariant
                        }
                    ]}
                >
                    <Text style={[panelStyles.code, { color: theme.colors.onSurface }]}>{task.code}</Text>
                </View>
            </View>

            {/* Parameters */}
            {task.parameters && task.parameters.length > 0 && (
                <View style={panelStyles.section}>
                    <Text style={[panelStyles.label, { color: theme.colors.onSurfaceVariant }]}>Parameters</Text>
                    {task.parameters.map((param) => (
                        <View
                            key={param.name}
                            style={[panelStyles.paramRow, { borderColor: theme.colors.outlineVariant }]}
                        >
                            <Text style={[panelStyles.paramName, { color: theme.colors.onSurface }]}>{param.name}</Text>
                            <Text style={[panelStyles.paramType, { color: theme.colors.onSurfaceVariant }]}>
                                {param.type}
                                {param.required ? " (required)" : ""}
                            </Text>
                            {param.description && (
                                <Text style={[panelStyles.paramDesc, { color: theme.colors.onSurfaceVariant }]}>
                                    {param.description}
                                </Text>
                            )}
                        </View>
                    ))}
                </View>
            )}

            {/* Cron Triggers */}
            {triggers.cron.length > 0 && (
                <View style={panelStyles.section}>
                    <Text style={[panelStyles.label, { color: theme.colors.onSurfaceVariant }]}>Cron Triggers</Text>
                    {triggers.cron.map((trigger) => (
                        <View
                            key={trigger.id}
                            style={[panelStyles.triggerCard, { borderColor: theme.colors.outlineVariant }]}
                        >
                            <View style={panelStyles.triggerRow}>
                                <Text style={[panelStyles.triggerSchedule, { color: theme.colors.onSurface }]}>
                                    {trigger.schedule}
                                </Text>
                                <View
                                    style={[
                                        panelStyles.badge,
                                        { backgroundColor: trigger.enabled ? "#2e7d3220" : "#ed6c0220" }
                                    ]}
                                >
                                    <Text
                                        style={[
                                            panelStyles.badgeText,
                                            { color: trigger.enabled ? "#2e7d32" : "#ed6c02" }
                                        ]}
                                    >
                                        {trigger.enabled ? "enabled" : "disabled"}
                                    </Text>
                                </View>
                            </View>
                            <Text style={[panelStyles.triggerMeta, { color: theme.colors.onSurfaceVariant }]}>
                                {trigger.timezone}
                                {trigger.agentId ? ` · ${trigger.agentId}` : ""}
                            </Text>
                            <Text style={[panelStyles.triggerMeta, { color: theme.colors.onSurfaceVariant }]}>
                                Last run: {tasksFormatLastRun(trigger.lastRunAt, now)}
                            </Text>
                        </View>
                    ))}
                </View>
            )}

            {/* Webhook Triggers */}
            {triggers.webhook.length > 0 && (
                <View style={panelStyles.section}>
                    <Text style={[panelStyles.label, { color: theme.colors.onSurfaceVariant }]}>Webhook Triggers</Text>
                    {triggers.webhook.map((trigger) => (
                        <View
                            key={trigger.id}
                            style={[panelStyles.triggerCard, { borderColor: theme.colors.outlineVariant }]}
                        >
                            <Text style={[panelStyles.triggerMono, { color: theme.colors.onSurface }]}>
                                {trigger.id}
                            </Text>
                            {trigger.agentId && (
                                <Text style={[panelStyles.triggerMeta, { color: theme.colors.onSurfaceVariant }]}>
                                    Agent: {trigger.agentId}
                                </Text>
                            )}
                            <Text style={[panelStyles.triggerMeta, { color: theme.colors.onSurfaceVariant }]}>
                                Last run: {tasksFormatLastRun(trigger.lastRunAt, now)}
                            </Text>
                        </View>
                    ))}
                </View>
            )}

            {/* No triggers */}
            {triggers.cron.length === 0 && triggers.webhook.length === 0 && (
                <View style={panelStyles.section}>
                    <Text style={[panelStyles.label, { color: theme.colors.onSurfaceVariant }]}>Triggers</Text>
                    <Text style={[panelStyles.value, { color: theme.colors.onSurfaceVariant }]}>No triggers</Text>
                </View>
            )}

            {/* Timestamps */}
            <View style={[panelStyles.section, { borderTopWidth: 1, borderTopColor: theme.colors.outlineVariant }]}>
                <View style={panelStyles.metaRow}>
                    <Text style={[panelStyles.metaLabel, { color: theme.colors.onSurfaceVariant }]}>ID</Text>
                    <Text style={[panelStyles.metaMono, { color: theme.colors.onSurface }]}>{task.id}</Text>
                </View>
                <View style={panelStyles.metaRow}>
                    <Text style={[panelStyles.metaLabel, { color: theme.colors.onSurfaceVariant }]}>Created</Text>
                    <Text style={[panelStyles.metaValue, { color: theme.colors.onSurface }]}>
                        {new Date(task.createdAt).toLocaleString()}
                    </Text>
                </View>
                <View style={panelStyles.metaRow}>
                    <Text style={[panelStyles.metaLabel, { color: theme.colors.onSurfaceVariant }]}>Updated</Text>
                    <Text style={[panelStyles.metaValue, { color: theme.colors.onSurface }]}>
                        {new Date(task.updatedAt).toLocaleString()}
                    </Text>
                </View>
            </View>
        </ScrollView>
    );
});

const panelStyles = StyleSheet.create({
    content: {
        padding: 20,
        paddingBottom: 40
    },
    section: {
        marginBottom: 20
    },
    label: {
        fontSize: 11,
        fontFamily: "IBMPlexSans-SemiBold",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: 6
    },
    value: {
        fontSize: 14,
        fontFamily: "IBMPlexSans-Regular",
        lineHeight: 20
    },
    codeBlock: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12
    },
    code: {
        fontSize: 12,
        fontFamily: "monospace",
        lineHeight: 18
    },
    paramRow: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        marginBottom: 6
    },
    paramName: {
        fontSize: 13,
        fontFamily: "IBMPlexSans-SemiBold"
    },
    paramType: {
        fontSize: 12,
        fontFamily: "IBMPlexSans-Regular",
        marginTop: 2
    },
    paramDesc: {
        fontSize: 12,
        fontFamily: "IBMPlexSans-Regular",
        marginTop: 4
    },
    triggerCard: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        marginBottom: 6
    },
    triggerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8
    },
    triggerSchedule: {
        fontSize: 13,
        fontFamily: "IBMPlexSans-SemiBold"
    },
    triggerMono: {
        fontSize: 11,
        fontFamily: "monospace"
    },
    triggerMeta: {
        fontSize: 12,
        fontFamily: "IBMPlexSans-Regular",
        marginTop: 4
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4
    },
    badgeText: {
        fontSize: 11,
        fontFamily: "IBMPlexSans-SemiBold"
    },
    metaRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 6
    },
    metaLabel: {
        fontSize: 12,
        fontFamily: "IBMPlexSans-Regular"
    },
    metaValue: {
        fontSize: 12,
        fontFamily: "IBMPlexSans-Regular"
    },
    metaMono: {
        fontSize: 11,
        fontFamily: "monospace"
    }
});
