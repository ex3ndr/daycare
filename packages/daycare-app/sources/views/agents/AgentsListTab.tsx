import { Octicons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { ItemGroup } from "@/components/ItemGroup";
import { agentDisplayName } from "@/modules/agents/agentDisplayName";
import type { AgentListItem } from "@/modules/agents/agentsTypes";

const CARD_SIZE = 120;

type AgentsListTabProps = {
    agents: AgentListItem[];
    onAgentPress: (href: Href) => void;
    workspaceId: string | null;
};

type KindMeta = {
    icon: React.ComponentProps<typeof Octicons>["name"];
    label: string;
    lightBg: string;
    darkBg: string;
    lightIcon: string;
    darkIcon: string;
    order: number;
};

const KIND_META: Record<string, KindMeta> = {
    agent: {
        icon: "hubot",
        label: "Agents",
        lightBg: "#F0DFB4",
        darkBg: "#3C2D00",
        lightIcon: "#6B4F12",
        darkIcon: "#DFC070",
        order: 0
    },
    app: {
        icon: "browser",
        label: "App Agents",
        lightBg: "#FAD8B8",
        darkBg: "#4A2508",
        lightIcon: "#874100",
        darkIcon: "#F6C28B",
        order: 1
    },
    supervisor: {
        icon: "command-palette",
        label: "Supervisors",
        lightBg: "#D6D5F5",
        darkBg: "#25245A",
        lightIcon: "#47469A",
        darkIcon: "#C7C6FF",
        order: 2
    },
    connector: {
        icon: "plug",
        label: "Connectors",
        lightBg: "#C8DAEF",
        darkBg: "#0E2B48",
        lightIcon: "#2A4666",
        darkIcon: "#A8C4E0",
        order: 3
    },
    cron: {
        icon: "clock",
        label: "Cron Tasks",
        lightBg: "#C6DBB6",
        darkBg: "#1C3210",
        lightIcon: "#4A5F3A",
        darkIcon: "#AACA98",
        order: 4
    },
    task: {
        icon: "tasklist",
        label: "Tasks",
        lightBg: "#FFDAD6",
        darkBg: "#690005",
        lightIcon: "#BA1A1A",
        darkIcon: "#FFB4AB",
        order: 5
    },
    memory: {
        icon: "database",
        label: "Memory",
        lightBg: "#E7E1D7",
        darkBg: "#2B2822",
        lightIcon: "#4B4639",
        darkIcon: "#D0C7B4",
        order: 6
    },
    search: {
        icon: "search",
        label: "Search",
        lightBg: "#EDE7DD",
        darkBg: "#36332D",
        lightIcon: "#7D7668",
        darkIcon: "#D0C7B4",
        order: 7
    },
    sub: {
        icon: "git-branch",
        label: "Subagents",
        lightBg: "#C8DAEF",
        darkBg: "#0E2B48",
        lightIcon: "#2A4666",
        darkIcon: "#A8C4E0",
        order: 8
    },
    subuser: {
        icon: "person",
        label: "Subusers",
        lightBg: "#F0DFB4",
        darkBg: "#3C2D00",
        lightIcon: "#6B4F12",
        darkIcon: "#DFC070",
        order: 9
    },
    workspace: {
        icon: "iterations",
        label: "Workspaces",
        lightBg: "#C6DBB6",
        darkBg: "#1C3210",
        lightIcon: "#4A5F3A",
        darkIcon: "#AACA98",
        order: 10
    }
};

const DEFAULT_KIND_META: KindMeta = {
    icon: "question",
    label: "Other",
    lightBg: "#E7E1D7",
    darkBg: "#2B2822",
    lightIcon: "#4B4639",
    darkIcon: "#D0C7B4",
    order: 99
};

const LIFECYCLE_COLOR: Record<string, string> = {
    active: "#4CAF50",
    sleeping: "#FFC107",
    dead: "#9E9E9E"
};

function kindMeta(kind: string): KindMeta {
    return KIND_META[kind] ?? DEFAULT_KIND_META;
}

function agentsGroupByKind(agents: AgentListItem[]): Array<{ kind: string; meta: KindMeta; items: AgentListItem[] }> {
    const map = new Map<string, AgentListItem[]>();

    for (const agent of agents) {
        const items = map.get(agent.kind);
        if (items) {
            items.push(agent);
            continue;
        }

        map.set(agent.kind, [agent]);
    }

    return Array.from(map.entries())
        .map(([kind, items]) => ({ kind, meta: kindMeta(kind), items }))
        .sort((left, right) => left.meta.order - right.meta.order);
}

/**
 * Renders the existing agent cards grouped by agent kind.
 * Expects: agents are already loaded; navigation stays workspace-scoped.
 */
export function AgentsListTab({ agents, onAgentPress, workspaceId }: AgentsListTabProps) {
    const { theme } = useUnistyles();
    const isDark = theme.dark;
    const groups = React.useMemo(() => agentsGroupByKind(agents), [agents]);

    return (
        <>
            {groups.map((group) => (
                <ItemGroup key={group.kind} title={group.meta.label}>
                    <View style={styles.groupBody}>
                        <View style={styles.grid}>
                            {group.items.map((agent) => {
                                const cardBg = isDark ? group.meta.darkBg : group.meta.lightBg;
                                const iconColor = isDark ? group.meta.darkIcon : group.meta.lightIcon;
                                const dotColor = LIFECYCLE_COLOR[agent.lifecycle] ?? LIFECYCLE_COLOR.dead;
                                const prefix = workspaceId ? `/${workspaceId}` : "";

                                return (
                                    <Pressable
                                        key={agent.agentId}
                                        style={[styles.card, { backgroundColor: cardBg }]}
                                        onPress={() => onAgentPress(`${prefix}/agents/${agent.agentId}` as Href)}
                                    >
                                        <View style={styles.cardTopRow}>
                                            <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
                                            <Octicons name={group.meta.icon} size={18} color={iconColor} />
                                        </View>
                                        <Text
                                            style={[styles.cardTitle, { color: theme.colors.onSurface }]}
                                            numberOfLines={2}
                                        >
                                            {agentDisplayName(agent)}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                </ItemGroup>
            ))}
        </>
    );
}

const styles = StyleSheet.create((theme) => ({
    groupBody: {
        padding: 12
    },
    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8
    },
    card: {
        width: CARD_SIZE,
        height: CARD_SIZE,
        borderRadius: 12,
        padding: 12,
        justifyContent: "space-between"
    },
    cardTopRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4
    },
    cardTitle: {
        fontSize: 14,
        fontFamily: "IBMPlexSans-SemiBold",
        fontWeight: "600",
        lineHeight: 18,
        color: theme.colors.onSurface
    }
}));
