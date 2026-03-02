import { Octicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useAgentsStore } from "@/modules/agents/agentsContext";
import { useAuthStore } from "@/modules/auth/authContext";
import { AgentInput } from "./AgentInput";
import { AgentMessageList } from "./AgentMessageList";

/** Derives a display name from an agent id. */
function agentDisplayName(agentId: string): string {
    return `Agent ${agentId.slice(0, 8)}`;
}

export type AgentDetailViewProps = {
    agentId: string;
};

/**
 * Full-screen agent detail view: header + message list + input.
 * Fetches history on mount and refreshes after sending a message.
 */
export function AgentDetailView({ agentId }: AgentDetailViewProps) {
    const { theme } = useUnistyles();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);

    const history = useAgentsStore((s) => s.history);
    const historyLoading = useAgentsStore((s) => s.historyLoading);
    const fetchHistory = useAgentsStore((s) => s.fetchHistory);
    const sendMessage = useAgentsStore((s) => s.sendMessage);

    React.useEffect(() => {
        if (baseUrl && token && agentId) {
            void fetchHistory(baseUrl, token, agentId);
        }
    }, [baseUrl, token, agentId, fetchHistory]);

    const handleSend = React.useCallback(
        async (text: string) => {
            if (!baseUrl || !token) return;
            await sendMessage(baseUrl, token, agentId, text);
            // Refresh history after sending
            void fetchHistory(baseUrl, token, agentId);
        },
        [baseUrl, token, agentId, sendMessage, fetchHistory]
    );

    const handleBack = React.useCallback(() => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace("/agents");
        }
    }, [router]);

    return (
        <View style={[styles.root, { backgroundColor: theme.colors.surface }]}>
            {/* Header */}
            <View
                style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: theme.colors.outlineVariant }]}
            >
                <Pressable onPress={handleBack} style={styles.backButton} hitSlop={12}>
                    <Octicons name="chevron-left" size={20} color={theme.colors.onSurface} />
                </Pressable>
                <Text style={[styles.title, { color: theme.colors.onSurface }]} numberOfLines={1}>
                    {agentDisplayName(agentId)}
                </Text>
                <View style={styles.headerSpacer} />
            </View>

            {/* Message list */}
            <View style={styles.listContainer}>
                <AgentMessageList records={history} loading={historyLoading} />
            </View>

            {/* Input */}
            <View style={{ paddingBottom: insets.bottom }}>
                <AgentInput onSend={handleSend} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        gap: 8
    },
    backButton: {
        width: 32,
        height: 32,
        alignItems: "center",
        justifyContent: "center"
    },
    title: {
        flex: 1,
        fontSize: 17,
        fontFamily: "IBMPlexSans-SemiBold"
    },
    headerSpacer: {
        width: 32
    },
    listContainer: {
        flex: 1
    }
});
