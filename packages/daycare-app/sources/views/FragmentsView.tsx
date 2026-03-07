import { useRouter } from "expo-router";
import * as React from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { PageHeader } from "@/components/PageHeader";
import { useAuthStore } from "@/modules/auth/authContext";
import { useFragmentsStore } from "@/modules/fragments/fragmentsContext";
import { useWorkspacesStore } from "@/modules/workspaces/workspacesContext";

export function FragmentsView() {
    const { theme } = useUnistyles();
    const router = useRouter();

    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);
    const activeId = useWorkspacesStore((s) => s.activeId);

    const fragments = useFragmentsStore((s) => s.fragments);
    const loading = useFragmentsStore((s) => s.loading);
    const error = useFragmentsStore((s) => s.error);
    const fetchFragments = useFragmentsStore((s) => s.fetch);

    React.useEffect(() => {
        if (baseUrl && token) {
            void fetchFragments(baseUrl, token, activeId);
        }
    }, [baseUrl, token, activeId, fetchFragments]);

    if (loading && fragments.length === 0) {
        return (
            <View style={{ flex: 1 }}>
                <PageHeader title="Fragments" icon="note" />
                <View style={[styles.centered, { flex: 1 }]}>
                    <ActivityIndicator color={theme.colors.primary} />
                </View>
            </View>
        );
    }

    if (error && fragments.length === 0) {
        return (
            <View style={{ flex: 1 }}>
                <PageHeader title="Fragments" icon="note" />
                <View style={[styles.centered, { flex: 1 }]}>
                    <Text style={[styles.messageText, { color: theme.colors.error }]}>{error}</Text>
                </View>
            </View>
        );
    }

    if (fragments.length === 0) {
        return (
            <View style={{ flex: 1 }}>
                <PageHeader title="Fragments" icon="note" />
                <View style={[styles.centered, { flex: 1 }]}>
                    <Text style={[styles.messageText, { color: theme.colors.onSurfaceVariant }]}>No fragments</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            <PageHeader title="Fragments" icon="note" />
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                {fragments.map((fragment) => (
                    <Pressable
                        key={fragment.id}
                        style={[styles.card, { backgroundColor: theme.colors.surfaceContainerLow }]}
                        onPress={() => router.push(`/fragment/${fragment.id}`)}
                    >
                        <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]} numberOfLines={1}>
                            {fragment.title}
                        </Text>
                        {fragment.description ? (
                            <Text
                                style={[styles.cardDescription, { color: theme.colors.onSurfaceVariant }]}
                                numberOfLines={2}
                            >
                                {fragment.description}
                            </Text>
                        ) : null}
                        <Text style={[styles.cardMeta, { color: theme.colors.onSurfaceVariant }]}>
                            v{fragment.version} · kit {fragment.kitVersion}
                        </Text>
                    </Pressable>
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
    messageText: {
        fontSize: 14,
        fontFamily: "IBMPlexSans-Regular",
        textAlign: "center"
    },
    scroll: {
        flex: 1
    },
    scrollContent: {
        padding: 20,
        gap: 8,
        maxWidth: theme.layout.maxWidth,
        width: "100%",
        alignSelf: "center"
    },
    card: {
        borderRadius: 12,
        padding: 16,
        gap: 4
    },
    cardTitle: {
        fontSize: 16,
        fontFamily: "IBMPlexSans-SemiBold",
        fontWeight: "600"
    },
    cardDescription: {
        fontSize: 14,
        fontFamily: "IBMPlexSans-Regular",
        lineHeight: 20
    },
    cardMeta: {
        fontSize: 12,
        fontFamily: "IBMPlexSans-Regular",
        marginTop: 4
    }
}));
