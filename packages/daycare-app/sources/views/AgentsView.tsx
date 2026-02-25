import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

export function AgentsView() {
    const { theme } = useUnistyles();

    return (
        <View style={styles.root}>
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>Select an agent</Text>
            <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                Choose an item from the left pane.
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 8
    },
    title: {
        fontSize: 18,
        fontWeight: "600"
    },
    subtitle: {
        fontSize: 14
    }
});
