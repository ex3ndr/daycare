import { Octicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { PageHeader } from "@/components/PageHeader";
import { useAgentsStore } from "@/modules/agents/agentsContext";
import type { AgentListItem } from "@/modules/agents/agentsTypes";
import { useAuthStore } from "@/modules/auth/authContext";

const CARD_SIZE = 120;

/** Capitalizes the first letter of a string. */
function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Well-known connector display names. */
const CONNECTOR_NAMES: Record<string, string> = {
    whatsapp: "WhatsApp",
    telegram: "Telegram",
    discord: "Discord",
    slack: "Slack",
    web: "Web Chat",
    sms: "SMS",
    email: "Email"
};

/** Derives a display name from agent metadata. */
function agentDisplayName(agent: AgentListItem): string {
    if (agent.name?.trim()) {
        return capitalize(agent.name.trim());
    }

    const path = agent.path?.trim();
    if (path) {
        const segments = path.split("/").filter((s) => s.length > 0);

        if (agent.kind === "connector" && segments.length >= 2) {
            const connector = segments[1];
            return CONNECTOR_NAMES[connector] ?? capitalize(connector);
        }
        if (agent.kind === "agent" && segments.length >= 3) {
            return capitalize(segments[2]);
        }
        if (agent.kind === "app" && segments.length >= 3) {
            return `App ${capitalize(segments[2])}`;
        }
        if (agent.kind === "cron") return "Cron Task";
        if (agent.kind === "task") return "Task";
        if (agent.kind === "memory") return "Memory Worker";
        if (agent.kind === "search") {
            return `Memory Search #${segments[segments.length - 1]}`;
        }
        if (agent.kind === "sub") {
            return `Subagent #${segments[segments.length - 1]}`;
        }
        if (agent.kind === "subuser") return "Subuser";
        if (agent.kind === "swarm") return "Swarm";
    }

    if (agent.kind === "connector") return "Connection";
    if (agent.kind === "app") return "App Agent";
    if (agent.kind === "cron") return "Cron Task";
    if (agent.kind === "task") return "Task";
    if (agent.kind === "memory") return "Memory Worker";
    if (agent.kind === "search") return "Memory Search";
    if (agent.kind === "sub") return "Subagent";

    return `Agent ${agent.agentId.slice(0, 8)}`;
}

type KindMeta = {
    icon: React.ComponentProps<typeof Octicons>["name"];
    label: string;
    lightBg: string;
    darkBg: string;
    lightIcon: string;
    darkIcon: string;
    order: number;
};

/** Visual config per agent kind. */
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
    connector: {
        icon: "plug",
        label: "Connectors",
        lightBg: "#C8DAEF",
        darkBg: "#0E2B48",
        lightIcon: "#2A4666",
        darkIcon: "#A8C4E0",
        order: 2
    },
    cron: {
        icon: "clock",
        label: "Cron Tasks",
        lightBg: "#C6DBB6",
        darkBg: "#1C3210",
        lightIcon: "#4A5F3A",
        darkIcon: "#AACA98",
        order: 3
    },
    task: {
        icon: "tasklist",
        label: "Tasks",
        lightBg: "#FFDAD6",
        darkBg: "#690005",
        lightIcon: "#BA1A1A",
        darkIcon: "#FFB4AB",
        order: 4
    },
    memory: {
        icon: "database",
        label: "Memory",
        lightBg: "#E7E1D7",
        darkBg: "#2B2822",
        lightIcon: "#4B4639",
        darkIcon: "#D0C7B4",
        order: 5
    },
    search: {
        icon: "search",
        label: "Search",
        lightBg: "#EDE7DD",
        darkBg: "#36332D",
        lightIcon: "#7D7668",
        darkIcon: "#D0C7B4",
        order: 6
    },
    sub: {
        icon: "git-branch",
        label: "Subagents",
        lightBg: "#C8DAEF",
        darkBg: "#0E2B48",
        lightIcon: "#2A4666",
        darkIcon: "#A8C4E0",
        order: 7
    },
    subuser: {
        icon: "person",
        label: "Subusers",
        lightBg: "#F0DFB4",
        darkBg: "#3C2D00",
        lightIcon: "#6B4F12",
        darkIcon: "#DFC070",
        order: 8
    },
    swarm: {
        icon: "iterations",
        label: "Swarms",
        lightBg: "#C6DBB6",
        darkBg: "#1C3210",
        lightIcon: "#4A5F3A",
        darkIcon: "#AACA98",
        order: 9
    }
};

/** Color for the lifecycle status dot. */
const LIFECYCLE_COLOR: Record<string, string> = {
    active: "#4CAF50",
    sleeping: "#FFC107",
    dead: "#9E9E9E"
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

function kindMeta(kind: string): KindMeta {
    return KIND_META[kind] ?? DEFAULT_KIND_META;
}

/** Groups agents by kind, sorted by display order. */
function groupByKind(agents: AgentListItem[]): Array<{ kind: string; meta: KindMeta; items: AgentListItem[] }> {
    const map = new Map<string, AgentListItem[]>();
    for (const agent of agents) {
        const list = map.get(agent.kind);
        if (list) {
            list.push(agent);
        } else {
            map.set(agent.kind, [agent]);
        }
    }

    return Array.from(map.entries())
        .map(([kind, items]) => ({ kind, meta: kindMeta(kind), items }))
        .sort((a, b) => a.meta.order - b.meta.order);
}

export function AgentsView() {
    const { theme } = useUnistyles();
    const router = useRouter();
    const isDark = theme.dark;

    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);

    const agents = useAgentsStore((s) => s.agents);
    const loading = useAgentsStore((s) => s.loading);
    const error = useAgentsStore((s) => s.error);
    const fetchAgents = useAgentsStore((s) => s.fetch);

    useEffect(() => {
        if (baseUrl && token) {
            void fetchAgents(baseUrl, token);
        }
    }, [baseUrl, token, fetchAgents]);

    const handleAgentPress = useCallback(
        (agentId: string) => {
            router.push(`/agents/${agentId}`);
        },
        [router]
    );

    if (loading && agents.length === 0) {
        return (
            <View style={{ flex: 1 }}>
                <PageHeader title="Agents" icon="hubot" />
                <View style={[styles.centered, { flex: 1 }]}>
                    <ActivityIndicator color={theme.colors.primary} />
                </View>
            </View>
        );
    }

    if (error && agents.length === 0) {
        return (
            <View style={{ flex: 1 }}>
                <PageHeader title="Agents" icon="hubot" />
                <View style={[styles.centered, { flex: 1 }]}>
                    <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
                </View>
            </View>
        );
    }

    if (agents.length === 0) {
        return (
            <View style={{ flex: 1 }}>
                <PageHeader title="Agents" icon="hubot" />
                <View style={[styles.centered, { flex: 1 }]}>
                    <Text style={[styles.errorText, { color: theme.colors.onSurfaceVariant }]}>No agents</Text>
                </View>
            </View>
        );
    }

    const groups = groupByKind(agents);

    return (
        <View style={{ flex: 1 }}>
            <PageHeader title="Agents" icon="hubot" />
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                {groups.map((group) => (
                    <View key={group.kind} style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
                            {group.meta.label}
                        </Text>
                        <View style={styles.grid}>
                            {group.items.map((agent) => {
                                const meta = group.meta;
                                const cardBg = isDark ? meta.darkBg : meta.lightBg;
                                const iconColor = isDark ? meta.darkIcon : meta.lightIcon;

                                const dotColor = LIFECYCLE_COLOR[agent.lifecycle] ?? LIFECYCLE_COLOR.dead;

                                return (
                                    <Pressable
                                        key={agent.agentId}
                                        style={[styles.card, { backgroundColor: cardBg }]}
                                        onPress={() => handleAgentPress(agent.agentId)}
                                    >
                                        <View style={styles.cardTopRow}>
                                            <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
                                            <Octicons name={meta.icon} size={18} color={iconColor} />
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
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create((theme) => ({
    centered: {
        alignItems: "center",
        justifyContent: "center",
        padding: 32
    },
    errorText: {
        fontSize: 14,
        fontFamily: "IBMPlexSans-Regular",
        textAlign: "center"
    },
    scroll: {
        flex: 1
    },
    scrollContent: {
        padding: 20,
        maxWidth: theme.layout.maxWidth,
        width: "100%",
        alignSelf: "center"
    },
    section: {
        marginBottom: 24
    },
    sectionTitle: {
        fontSize: 13,
        fontFamily: "IBMPlexSans-SemiBold",
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: 12
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
        lineHeight: 18
    }
}));
