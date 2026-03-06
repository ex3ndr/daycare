import { JSONUIProvider, Renderer, type Spec } from "@json-render/react-native";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { ItemList } from "@/components/ItemList";
import { PageHeader } from "@/components/PageHeader";
import { fragmentsRegistry } from "@/fragments/registry";
import { useFragmentPython } from "@/fragments/useFragmentPython";
import { useFragmentsStore } from "@/modules/fragments/fragmentsContext";

export default function FragmentDetailScreen() {
    const { theme } = useUnistyles();
    const { id } = useLocalSearchParams<{ id: string }>();

    const fragment = useFragmentsStore((s) => s.fragments.find((f) => f.id === id) ?? null);
    const fragmentPython = useFragmentPython((fragment?.spec as Spec | null) ?? null);

    if (!fragment) return null;

    return (
        <View style={[styles.root, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.inner}>
                <PageHeader title={fragment.title} icon="note" />
                {fragmentPython.status === "loading" ? (
                    <View style={[styles.centered, styles.body]}>
                        <ActivityIndicator color={theme.colors.primary} />
                    </View>
                ) : fragmentPython.status === "error" ? (
                    <View style={[styles.centered, styles.body]}>
                        <Text style={[styles.stateText, { color: theme.colors.error }]}>{fragmentPython.error}</Text>
                    </View>
                ) : (
                    <ItemList style={styles.body} containerStyle={styles.bodyContent}>
                        <JSONUIProvider
                            store={fragmentPython.store}
                            handlers={fragmentPython.handlers}
                            registry={fragmentsRegistry}
                        >
                            <Renderer spec={fragment.spec as Spec} registry={fragmentsRegistry} />
                        </JSONUIProvider>
                    </ItemList>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create((theme) => ({
    root: {
        flex: 1,
        alignItems: "center"
    },
    inner: {
        flex: 1,
        width: "100%",
        maxWidth: theme.layout.maxWidth
    },
    body: {
        flex: 1
    },
    bodyContent: {
        padding: 20
    },
    centered: {
        alignItems: "center",
        justifyContent: "center",
        padding: 20
    },
    stateText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14,
        textAlign: "center"
    }
}));
