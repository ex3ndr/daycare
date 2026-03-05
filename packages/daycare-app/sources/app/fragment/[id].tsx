import { createStateStore, JSONUIProvider, Renderer, type Spec } from "@json-render/react-native";
import { useLocalSearchParams } from "expo-router";
import * as React from "react";
import { ScrollView, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { PageHeader } from "@/components/PageHeader";
import { fragmentsRegistry } from "@/fragments/registry";
import { useFragmentsStore } from "@/modules/fragments/fragmentsContext";

export default function FragmentDetailScreen() {
    const { theme } = useUnistyles();
    const { id } = useLocalSearchParams<{ id: string }>();

    const fragment = useFragmentsStore((s) => s.fragments.find((f) => f.id === id) ?? null);

    const stateStore = React.useMemo(() => {
        if (!fragment) return null;
        const spec = fragment.spec as Spec;
        return createStateStore(spec.state ?? {});
    }, [fragment]);

    if (!fragment || !stateStore) return null;

    return (
        <View style={[styles.root, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.inner}>
                <PageHeader title={fragment.title} icon="note" />
                <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
                    <JSONUIProvider store={stateStore} handlers={{}} registry={fragmentsRegistry}>
                        <Renderer spec={fragment.spec as Spec} registry={fragmentsRegistry} />
                    </JSONUIProvider>
                </ScrollView>
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
    }
}));
