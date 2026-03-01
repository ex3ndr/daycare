import { Octicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

/**
 * Home dashboard view — the default landing page.
 */
export function HomeView() {
    const { theme } = useUnistyles();

    return (
        <View style={styles.container}>
            <View style={styles.greeting}>
                <Octicons name="hubot" size={32} color={theme.colors.primary} />
                <Text style={[styles.title, { color: theme.colors.onSurface }]}>Welcome to Daycare</Text>
                <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                    Your agents are ready. Pick a section from the sidebar to get started.
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 32
    },
    greeting: {
        alignItems: "center",
        gap: 12,
        maxWidth: 360
    },
    title: {
        fontSize: 22,
        fontWeight: "600"
    },
    subtitle: {
        fontSize: 15,
        textAlign: "center",
        lineHeight: 22
    }
});
