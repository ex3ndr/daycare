import * as React from "react";
import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { SinglePanelLayout } from "@/components/layout/SinglePanelLayout";

export default React.memo(function Welcome() {
    const { theme } = useUnistyles();

    return (
        <SinglePanelLayout>
            <View style={styles.content}>
                <Text style={[styles.title, { color: theme.colors.onSurface }]}>Daycare</Text>
                <Text style={[styles.slogan, { color: theme.colors.onSurfaceVariant }]}>
                    Use /app in chat to get your magic link.
                </Text>
            </View>
        </SinglePanelLayout>
    );
});

const styles = StyleSheet.create({
    content: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center"
    },
    title: {
        fontSize: 32,
        fontWeight: "bold"
    },
    slogan: {
        marginTop: 12,
        fontSize: 16
    }
});
