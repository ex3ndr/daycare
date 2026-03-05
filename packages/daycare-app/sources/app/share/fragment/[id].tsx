import { createStateStore, JSONUIProvider, Renderer, type Spec } from "@json-render/react-native";
import { useLocalSearchParams } from "expo-router";
import * as React from "react";
import { ScrollView, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { fragmentsRegistry } from "@/fragments/registry";
import { useFragmentsStore } from "@/modules/fragments/fragmentsContext";

export default function ShareFragmentScreen() {
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
            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
                <JSONUIProvider store={stateStore} handlers={{}} registry={fragmentsRegistry}>
                    <Renderer spec={fragment.spec as Spec} registry={fragmentsRegistry} />
                </JSONUIProvider>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1
    },
    body: {
        flex: 1
    },
    bodyContent: {
        padding: 20
    }
});
