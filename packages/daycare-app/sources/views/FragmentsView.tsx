import { Octicons } from "@expo/vector-icons";
import { createStateStore, JSONUIProvider, Renderer, type Spec, type StateStore } from "@json-render/react-native";
import * as React from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { PageHeader } from "@/components/PageHeader";
import { fragmentsRegistry } from "@/fragments/registry";
import { useAuthStore } from "@/modules/auth/authContext";
import { useFragmentsStore } from "@/modules/fragments/fragmentsContext";
import type { FragmentListItem } from "@/modules/fragments/fragmentsTypes";

export function FragmentsView() {
    const { theme } = useUnistyles();

    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);

    const fragments = useFragmentsStore((s) => s.fragments);
    const loading = useFragmentsStore((s) => s.loading);
    const error = useFragmentsStore((s) => s.error);
    const fetchFragments = useFragmentsStore((s) => s.fetch);

    const [selectedFragment, setSelectedFragment] = React.useState<FragmentListItem | null>(null);

    React.useEffect(() => {
        if (baseUrl && token) {
            void fetchFragments(baseUrl, token);
        }
    }, [baseUrl, token, fetchFragments]);

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
                        onPress={() => setSelectedFragment(fragment)}
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

            <FragmentDetailModal fragment={selectedFragment} onClose={() => setSelectedFragment(null)} />
        </View>
    );
}

type FragmentDetailModalProps = {
    fragment: FragmentListItem | null;
    onClose: () => void;
};

function FragmentDetailModal({ fragment, onClose }: FragmentDetailModalProps) {
    const { theme } = useUnistyles();

    // Create a fresh state store for each fragment
    const stateStore = React.useMemo<StateStore | null>(() => {
        if (!fragment) return null;
        return createStateStore({});
    }, [fragment]);

    if (!fragment || !stateStore) return null;

    return (
        <Modal visible transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View
                    style={[
                        styles.modalContent,
                        {
                            backgroundColor: theme.colors.surface,
                            boxShadow: theme.elevation.level3
                        }
                    ]}
                >
                    <View style={[styles.modalHeader, { borderBottomColor: theme.colors.outlineVariant }]}>
                        <Text style={[styles.modalTitle, { color: theme.colors.onSurface }]} numberOfLines={1}>
                            {fragment.title}
                        </Text>
                        <Pressable onPress={onClose} style={styles.closeButton}>
                            <Octicons name="x" size={20} color={theme.colors.onSurfaceVariant} />
                        </Pressable>
                    </View>
                    <ScrollView style={styles.modalBody}>
                        <JSONUIProvider store={stateStore} handlers={{}} registry={fragmentsRegistry}>
                            <Renderer spec={fragment.spec as Spec} registry={fragmentsRegistry} />
                        </JSONUIProvider>
                    </ScrollView>
                </View>
            </View>
        </Modal>
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
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.4)",
        justifyContent: "center",
        alignItems: "center",
        padding: 24
    },
    modalContent: {
        width: "100%",
        maxWidth: 640,
        maxHeight: "80%",
        borderRadius: 16,
        overflow: "hidden"
    },
    modalHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth
    },
    modalTitle: {
        fontSize: 18,
        fontFamily: "IBMPlexSans-SemiBold",
        fontWeight: "600",
        flex: 1,
        marginRight: 12
    },
    closeButton: {
        padding: 4
    },
    modalBody: {
        padding: 20
    }
}));
