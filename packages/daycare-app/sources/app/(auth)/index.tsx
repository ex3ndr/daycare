import { useRouter } from "expo-router";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { SinglePanelLayout } from "@/components/layout/SinglePanelLayout";

export default React.memo(function Welcome() {
    const { theme } = useUnistyles();
    const router = useRouter();

    return (
        <SinglePanelLayout>
            <View style={styles.content}>
                <Text style={[styles.title, { color: theme.colors.onSurface }]}>Daycare</Text>
            </View>
            <View style={styles.buttonContainer}>
                <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push("/signin")}
                    style={({ pressed }) => [
                        styles.button,
                        { backgroundColor: theme.colors.primary },
                        pressed && styles.buttonPressed
                    ]}
                >
                    <Text style={[styles.buttonText, { color: theme.colors.onPrimary }]}>Start</Text>
                </Pressable>
            </View>
        </SinglePanelLayout>
    );
});

const styles = StyleSheet.create({
    content: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 32
    },
    title: {
        fontSize: 36,
        fontWeight: "800",
        textAlign: "center",
        letterSpacing: -0.5
    },
    buttonContainer: {
        paddingHorizontal: 24,
        paddingBottom: 24
    },
    button: {
        width: "100%",
        height: 48,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center"
    },
    buttonText: {
        fontSize: 15,
        fontWeight: "700"
    },
    buttonPressed: {
        opacity: 0.92
    }
});
