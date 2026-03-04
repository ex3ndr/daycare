import { Octicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Chat } from "@/modules/chat/Chat";

/** Derives a display name from an agent id. */
function agentDisplayName(agentId: string): string {
    return `Agent ${agentId.slice(0, 8)}`;
}

export type AgentDetailViewProps = {
    agentId: string;
};

/**
 * Full-screen agent detail view: header + embedded chat session.
 */
export function AgentDetailView({ agentId }: AgentDetailViewProps) {
    const { theme } = useUnistyles();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const handleBack = React.useCallback(() => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace("/agents");
        }
    }, [router]);

    return (
        <View style={[styles.root, { backgroundColor: theme.colors.surfaceContainerLowest }]}>
            {/* Header */}
            <View
                style={[
                    styles.header,
                    {
                        paddingTop: insets.top + 8,
                        borderBottomColor: theme.colors.outlineVariant,
                        backgroundColor: theme.colors.surfaceContainerLowest
                    }
                ]}
            >
                <Pressable onPress={handleBack} style={styles.backButton} hitSlop={12}>
                    <Octicons name="chevron-left" size={20} color={theme.colors.onSurface} />
                </Pressable>
                <Text style={[styles.title, { color: theme.colors.onSurface }]} numberOfLines={1}>
                    {agentDisplayName(agentId)}
                </Text>
                <View style={styles.headerSpacer} />
            </View>

            <View style={[styles.listContainer, { paddingBottom: insets.bottom }]}>
                <Chat agentId={agentId} />
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
        borderBottomWidth: StyleSheet.hairlineWidth,
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
        fontSize: 14,
        fontFamily: "IBMPlexMono-SemiBold"
    },
    headerSpacer: {
        width: 32
    },
    listContainer: {
        flex: 1
    }
});
