import { Octicons } from "@expo/vector-icons";
import { createStateStore, JSONUIProvider, Renderer, type Spec } from "@json-render/react-native";
import { useRouter } from "expo-router";
import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useFragmentsStore } from "@/modules/fragments/fragmentsContext";
import { widgetsRegistry } from "@/widgets/widgetsComponents";

/**
 * Route-based modal screen that renders the selected fragment.
 * Reads the selected fragment from the fragments store.
 */
export default function FragmentModalScreen() {
    const { theme } = useUnistyles();
    const router = useRouter();
    const fragment = useFragmentsStore((s) => s.selectedFragment);

    const stateStore = React.useMemo(() => createStateStore({}), []);

    const handleClose = React.useCallback(() => {
        router.back();
    }, [router]);

    if (!fragment) {
        return (
            <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
                <View style={styles.centered}>
                    <Text style={[styles.messageText, { color: theme.colors.onSurfaceVariant }]}>
                        No fragment selected
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.header, { borderBottomColor: theme.colors.outlineVariant }]}>
                <Text style={[styles.title, { color: theme.colors.onSurface }]} numberOfLines={1}>
                    {fragment.title}
                </Text>
                <Pressable onPress={handleClose} style={styles.closeButton}>
                    <Octicons name="x" size={20} color={theme.colors.onSurfaceVariant} />
                </Pressable>
            </View>
            <ScrollView style={styles.body}>
                <JSONUIProvider store={stateStore} handlers={{}} registry={widgetsRegistry}>
                    <Renderer spec={fragment.spec as Spec} registry={widgetsRegistry} />
                </JSONUIProvider>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    centered: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 32
    },
    messageText: {
        fontSize: 14,
        fontFamily: "IBMPlexSans-Regular",
        textAlign: "center"
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth
    },
    title: {
        fontSize: 18,
        fontFamily: "IBMPlexSans-SemiBold",
        fontWeight: "600",
        flex: 1,
        marginRight: 12
    },
    closeButton: {
        padding: 4
    },
    body: {
        padding: 20
    }
});
