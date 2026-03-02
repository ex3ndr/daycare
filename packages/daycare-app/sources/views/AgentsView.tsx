import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Item } from "@/components/Item";
import { ItemGroup } from "@/components/ItemGroup";
import { ItemListStatic } from "@/components/ItemList";
import { useAgentsStore } from "@/modules/agents/agentsContext";
import type { AgentLifecycleState, AgentListItem } from "@/modules/agents/agentsTypes";
import { useAuthStore } from "@/modules/auth/authContext";

/** Derives a display name from an agent id. */
function agentDisplayName(agentId: string): string {
    return `Agent ${agentId.slice(0, 8)}`;
}

/** Derives a subtitle from an agent id. */
function agentSubtitle(agentId: string): string {
    return `ID: ${agentId}`;
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
    if (active.length > 0) groups["Active"] = active;
    if (sleeping.length > 0) groups["Sleeping"] = sleeping;
    if (dead.length > 0) groups["Dead"] = dead;
    return groups;
}

export function AgentsView() {
    const { theme } = useUnistyles();

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
                            title={agentDisplayName(agent.agentId)}
                            subtitle={agentSubtitle(agent.agentId)}
                            rightElement={<AgentStatus lifecycle={agent.lifecycle} />}
                            showChevron={false}
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
