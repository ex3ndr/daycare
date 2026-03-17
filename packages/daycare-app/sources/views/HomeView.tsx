import * as React from "react";
import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { ChatInput } from "@/modules/chat/ChatInput";

/**
 * Home view with a centered chat input.
 * Not wired to a real chat backend yet — sends are no-ops.
 */
export function HomeView() {
    const { theme } = useUnistyles();

    const handleSend = React.useCallback((_text: string) => {
        // Not wired yet
    }, []);

    return (
        <View style={styles.root}>
            {/* Push content to ~40% from top */}
            <View style={styles.topSpacer} />
            <View style={styles.center}>
                <Text style={[styles.greeting, { color: theme.colors.onSurface }]}>What can I do for you?</Text>
            </View>
            <View style={styles.inputArea}>
                <ChatInput onSend={handleSend} />
            </View>
            {/* Remaining space below */}
            <View style={styles.bottomSpacer} />
        </View>
    );
}

const styles = StyleSheet.create((theme) => ({
    root: {
        flex: 1,
        width: "100%"
    },
    topSpacer: {
        flex: 3
    },
    center: {
        alignItems: "center",
        paddingHorizontal: 24,
        paddingBottom: 16
    },
    greeting: {
        fontSize: 24,
        fontWeight: "700"
    },
    inputArea: {},
    bottomSpacer: {
        flex: 5
    }
}));
