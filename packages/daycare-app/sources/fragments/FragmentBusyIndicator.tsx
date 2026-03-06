import { ActivityIndicator, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

/**
 * Renders a compact fragment runtime loader anchored to the top-right corner.
 * Expects: parent layout provides a stable rectangular area for absolute positioning.
 */
export function FragmentBusyIndicator() {
    const { theme } = useUnistyles();

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.surfaceContainerHigh }]}>
            <ActivityIndicator color={theme.colors.primary} size="small" />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        top: 16,
        right: 16,
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1
    }
});
