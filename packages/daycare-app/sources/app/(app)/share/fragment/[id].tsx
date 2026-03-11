import { JSONUIProvider, Renderer, type Spec } from "@json-render/react-native";
import { useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { ItemList } from "@/components/ItemList";
import { FragmentBusyIndicator } from "@/fragments/FragmentBusyIndicator";
import { fragmentsRegistry } from "@/fragments/registry";
import { useFragmentPython } from "@/fragments/useFragmentPython";
import { useFragmentsStore } from "@/modules/fragments/fragmentsContext";
import { useWorkspace } from "@/modules/workspaces/workspaceProvider";

export default function ShareFragmentScreen() {
    const { theme } = useUnistyles();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { workspaceId } = useWorkspace();

    const fragment = useFragmentsStore((s) => s.fragments.find((f) => f.id === id) ?? null);
    const fragmentPython = useFragmentPython((fragment?.spec as Spec | null) ?? null, workspaceId, id);

    if (!fragment) return null;

    return (
        <View style={[styles.root, { backgroundColor: theme.colors.surface }]}>
            {fragmentPython.status === "error" ? (
                <View style={[styles.centered, styles.body]}>
                    <Text style={[styles.stateText, { color: theme.colors.error }]}>{fragmentPython.error}</Text>
                </View>
            ) : (
                <View style={styles.body}>
                    <ItemList style={styles.body} containerStyle={styles.bodyContent}>
                        <JSONUIProvider
                            store={fragmentPython.store}
                            handlers={fragmentPython.handlers}
                            registry={fragmentsRegistry}
                        >
                            <Renderer spec={fragment.spec as Spec} registry={fragmentsRegistry} />
                        </JSONUIProvider>
                    </ItemList>
                    {fragmentPython.busy ? <FragmentBusyIndicator /> : null}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1
    },
    body: {
        flex: 1,
        position: "relative"
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
});
