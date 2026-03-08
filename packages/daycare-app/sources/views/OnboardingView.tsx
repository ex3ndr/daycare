import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

/**
 * Placeholder view shown on the home route when the workspace's homeReady flag is false.
 * Indicates the workspace is still being set up.
 */
export function OnboardingView() {
    const { theme } = useUnistyles();

    return (
        <View style={styles.root}>
            <View style={styles.content}>
                <Text style={[styles.title, { color: theme.colors.onSurface }]}>Setting up your workspace</Text>
                <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                    Your workspace is being prepared. This page will update automatically once everything is ready.
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24
    },
    content: {
        alignItems: "center",
        gap: 12,
        maxWidth: 400
    },
    title: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 20,
        textAlign: "center"
    },
    subtitle: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14,
        lineHeight: 20,
        textAlign: "center"
    }
});
