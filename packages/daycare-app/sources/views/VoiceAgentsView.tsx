import { type Href, useRouter } from "expo-router";
import * as React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { ItemGroup } from "@/components/ItemGroup";
import { ItemList } from "@/components/ItemList";
import { PageHeader } from "@/components/PageHeader";
import { useAuthStore } from "@/modules/auth/authContext";
import { useVoiceAgentsStore } from "@/modules/voice/voiceAgentsContext";
import { useWorkspace } from "@/modules/workspaces/workspaceProvider";

export function VoiceAgentsView() {
    const { theme } = useUnistyles();
    const router = useRouter();
    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);
    const { workspaceId } = useWorkspace();
    const voiceAgents = useVoiceAgentsStore((s) => s.voiceAgents);
    const loading = useVoiceAgentsStore((s) => s.loading);
    const error = useVoiceAgentsStore((s) => s.error);
    const fetchVoiceAgents = useVoiceAgentsStore((s) => s.fetch);

    React.useEffect(() => {
        if (baseUrl && token) {
            void fetchVoiceAgents(baseUrl, token, workspaceId);
        }
    }, [baseUrl, token, workspaceId, fetchVoiceAgents]);

    const handlePress = React.useCallback(
        (voiceAgentId: string) => {
            router.push(`/${workspaceId}/voice/${voiceAgentId}` as Href);
        },
        [router, workspaceId]
    );

    if (loading && voiceAgents.length === 0) {
        return (
            <View style={{ flex: 1 }}>
                <PageHeader title="Voice" icon="unmute" />
                <View style={[styles.centered, { flex: 1 }]}>
                    <ActivityIndicator color={theme.colors.primary} />
                </View>
            </View>
        );
    }

    if (error && voiceAgents.length === 0) {
        return (
            <View style={{ flex: 1 }}>
                <PageHeader title="Voice" icon="unmute" />
                <View style={[styles.centered, { flex: 1 }]}>
                    <Text style={[styles.messageText, { color: theme.colors.error }]}>{error}</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            <PageHeader title="Voice" icon="unmute" subtitle={`${voiceAgents.length} voice agent(s)`} />
            <ItemList containerStyle={styles.listContent}>
                <ItemGroup title="Voice Agents" footer="Tap any agent to start a live voice call.">
                    {voiceAgents.length > 0 ? (
                        voiceAgents.map((voiceAgent) => (
                            <Pressable
                                key={voiceAgent.id}
                                style={({ pressed }) => [
                                    styles.row,
                                    {
                                        backgroundColor: pressed
                                            ? theme.colors.surfaceContainer
                                            : theme.colors.surfaceContainerLow
                                    }
                                ]}
                                onPress={() => handlePress(voiceAgent.id)}
                            >
                                <View style={styles.rowText}>
                                    <Text style={[styles.title, { color: theme.colors.onSurface }]} numberOfLines={1}>
                                        {voiceAgent.name}
                                    </Text>
                                    <Text
                                        style={[styles.description, { color: theme.colors.onSurfaceVariant }]}
                                        numberOfLines={2}
                                    >
                                        {voiceAgent.description?.trim() || "No description"}
                                    </Text>
                                </View>
                                <Text style={[styles.chevron, { color: theme.colors.onSurfaceVariant }]}>Open</Text>
                            </Pressable>
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={[styles.messageText, { color: theme.colors.onSurfaceVariant }]}>
                                No voice agents yet.
                            </Text>
                        </View>
                    )}
                </ItemGroup>
            </ItemList>
        </View>
    );
}

const styles = StyleSheet.create({
    centered: {
        alignItems: "center",
        justifyContent: "center",
        padding: 32
    },
    messageText: {
        fontSize: 14,
        fontFamily: "IBMPlexSans-Regular",
        textAlign: "center"
    },
    listContent: {
        paddingBottom: 24
    },
    row: {
        minHeight: 72,
        paddingHorizontal: 18,
        paddingVertical: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16
    },
    rowText: {
        flex: 1,
        gap: 4
    },
    title: {
        fontSize: 16,
        fontFamily: "IBMPlexSans-SemiBold"
    },
    description: {
        fontSize: 13,
        lineHeight: 18,
        fontFamily: "IBMPlexSans-Regular"
    },
    chevron: {
        fontSize: 12,
        fontFamily: "IBMPlexMono-Regular",
        textTransform: "uppercase"
    },
    emptyState: {
        padding: 20
    }
});
