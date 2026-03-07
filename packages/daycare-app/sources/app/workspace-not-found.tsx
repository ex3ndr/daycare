import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { SinglePanelLayout } from "@/components/layout/SinglePanelLayout";

export default function WorkspaceNotFoundScreen() {
    const { theme } = useUnistyles();

    return (
        <SinglePanelLayout>
            <View style={styles.content}>
                <Text style={styles.icon}>404</Text>
                <Text style={[styles.title, { color: theme.colors.onSurface }]}>Workspace Not Found</Text>
                <Text style={[styles.message, { color: theme.colors.onSurfaceVariant }]}>
                    This workspace does not exist or you no longer have access to it.
                </Text>
                <Pressable
                    accessibilityRole="button"
                    onPress={() => router.replace("/" as never)}
                    style={({ pressed }) => [
                        styles.button,
                        { backgroundColor: theme.colors.primary },
                        pressed ? styles.buttonPressed : null
                    ]}
                >
                    <Text style={[styles.buttonText, { color: theme.colors.onPrimary }]}>Back To Daycare</Text>
                </Pressable>
            </View>
        </SinglePanelLayout>
    );
}

const styles = StyleSheet.create({
    content: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 28,
        gap: 18
    },
    icon: {
        fontFamily: "IBMPlexMono-SemiBold",
        fontSize: 56
    },
    title: {
        fontFamily: "IBMPlexSans-Bold",
        fontSize: 30,
        textAlign: "center"
    },
    message: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 16,
        lineHeight: 24,
        textAlign: "center",
        maxWidth: 360
    },
    button: {
        minHeight: 46,
        paddingHorizontal: 20,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center"
    },
    buttonText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15
    },
    buttonPressed: {
        opacity: 0.85
    }
});
