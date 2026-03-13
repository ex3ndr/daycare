import { type Href, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { ItemList } from "@/components/ItemList";
import { PageHeader } from "@/components/PageHeader";
import { SegmentedControl, type SegmentedControlOption } from "@/components/SegmentedControl";
import { useAgentsStore } from "@/modules/agents/agentsContext";
import { useAuthStore } from "@/modules/auth/authContext";
import { useWorkspace } from "@/modules/workspaces/workspaceProvider";
import { AgentsListTab } from "@/views/agents/AgentsListTab";
import { AgentsTreeTab } from "@/views/agents/AgentsTreeTab";

type AgentsTab = "list" | "tree";

const TAB_OPTIONS: SegmentedControlOption<AgentsTab>[] = [
    { value: "list", label: "List" },
    { value: "tree", label: "Tree" }
];

export function AgentsView() {
    const { theme } = useUnistyles();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<AgentsTab>("list");

    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);

    const { workspaceId } = useWorkspace();

    const agents = useAgentsStore((s) => s.agents);
    const loading = useAgentsStore((s) => s.loading);
    const error = useAgentsStore((s) => s.error);
    const fetchAgents = useAgentsStore((s) => s.fetch);

    useEffect(() => {
        if (baseUrl && token) {
            void fetchAgents(baseUrl, token, workspaceId);
        }
    }, [baseUrl, token, workspaceId, fetchAgents]);

    const handleAgentPress = useCallback(
        (href: Href) => {
            router.push(href);
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

    return (
        <View style={{ flex: 1 }}>
            <PageHeader title="Agents" icon="hubot" subtitle={`${agents.length} total`} />
            <ItemList containerStyle={styles.scrollContent}>
                <View style={styles.toolbar}>
                    <SegmentedControl options={TAB_OPTIONS} value={activeTab} onChange={setActiveTab} />
                    <Text style={[styles.toolbarHint, { color: theme.colors.onSurfaceVariant }]}>
                        {activeTab === "list" ? "Card inventory" : "Path-derived file tree"}
                    </Text>
                </View>
                {activeTab === "list" ? (
                    <AgentsListTab agents={agents} onAgentPress={handleAgentPress} workspaceId={workspaceId} />
                ) : (
                    <AgentsTreeTab agents={agents} />
                )}
            </ItemList>
        </View>
    );
}

const styles = StyleSheet.create((_theme) => ({
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
    scrollContent: {
        paddingTop: 16,
        paddingBottom: 24
    },
    toolbar: {
        paddingHorizontal: 16,
        gap: 10
    },
    toolbarHint: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 12,
        lineHeight: 16
    }
}));
