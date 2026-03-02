import { useRouter } from "expo-router";
import { useCallback, useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Item } from "@/components/Item";
import { ItemGroup } from "@/components/ItemGroup";
import { ItemListStatic } from "@/components/ItemList";
import { useAgentsStore } from "@/modules/agents/agentsContext";
import type { AgentLifecycleState, AgentListItem } from "@/modules/agents/agentsTypes";
import { useAuthStore } from "@/modules/auth/authContext";

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
    if (agent.kind === "cron") return "Cron Task";
    if (agent.kind === "task") return "Task";
    if (agent.kind === "memory") return "Memory Worker";
    if (agent.kind === "search") return "Memory Search";
    if (agent.kind === "sub") return "Subagent";

    return `Agent ${agent.agentId.slice(0, 8)}`;
}

/** Derives a subtitle from agent metadata. */
function agentSubtitle(agent: AgentListItem): string {
    if (agent.path?.trim()) {
        return agent.path.trim();
    }
    return `ID: ${agent.agentId}`;
}

const lifecycleColors: Record<AgentLifecycleState, string> = {
    active: "#2e7d32",
    sleeping: "#ed6c02",
    dead: "#d32f2f"
};

const lifecycleLabels: Record<AgentLifecycleState, string> = {
    active: "Active",
    sleeping: "Sleeping",
    dead: "Dead"
};

function AgentStatus({ lifecycle }: { lifecycle: AgentLifecycleState }) {
    const { theme } = useUnistyles();
    return (
        <View style={agentStatusStyles.container}>
            <Text style={[agentStatusStyles.label, { color: theme.colors.onSurfaceVariant }]}>
                {lifecycleLabels[lifecycle]}
            </Text>
            <View style={[agentStatusStyles.dot, { backgroundColor: lifecycleColors[lifecycle] }]} />
        </View>
    );
}

const agentStatusStyles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4
    },
    label: {
        fontSize: 13,
        fontFamily: "IBMPlexSans-Regular"
    }
});

/** Groups agents by lifecycle state for display. */
function groupAgents(agents: AgentListItem[]): Record<string, AgentListItem[]> {
    const active: AgentListItem[] = [];
    const sleeping: AgentListItem[] = [];
    const dead: AgentListItem[] = [];

    for (const agent of agents) {
        switch (agent.lifecycle) {
            case "active":
                active.push(agent);
                break;
            case "sleeping":
                sleeping.push(agent);
                break;
            case "dead":
                dead.push(agent);
                break;
        }
    }

    const groups: Record<string, AgentListItem[]> = {};
    if (active.length > 0) groups.Active = active;
    if (sleeping.length > 0) groups.Sleeping = sleeping;
    if (dead.length > 0) groups.Dead = dead;
    return groups;
}

export function AgentsView() {
    const { theme } = useUnistyles();
    const router = useRouter();

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
            <View style={[styles.centered, { flex: 1 }]}>
                <ActivityIndicator color={theme.colors.primary} />
            </View>
        );
    }

    if (error && agents.length === 0) {
        return (
            <View style={[styles.centered, { flex: 1 }]}>
                <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
            </View>
        );
    }

    if (agents.length === 0) {
        return (
            <View style={[styles.centered, { flex: 1 }]}>
                <Text style={[styles.errorText, { color: theme.colors.onSurfaceVariant }]}>No agents</Text>
            </View>
        );
    }

    const groups = groupAgents(agents);

    return (
        <ItemListStatic>
            {Object.entries(groups).map(([title, groupAgents]) => (
                <ItemGroup key={title} title={title}>
                    {groupAgents.map((agent) => (
                        <Item
                            key={agent.agentId}
                            title={agentDisplayName(agent)}
                            subtitle={agentSubtitle(agent)}
                            rightElement={<AgentStatus lifecycle={agent.lifecycle} />}
                            onPress={() => handleAgentPress(agent.agentId)}
                            showChevron
                        />
                    ))}
                </ItemGroup>
            ))}
        </ItemListStatic>
    );
}

const styles = StyleSheet.create({
    centered: {
        alignItems: "center",
        justifyContent: "center",
        padding: 32
    },
    errorText: {
        fontSize: 14,
        fontFamily: "IBMPlexSans-Regular",
        textAlign: "center"
    }
});
