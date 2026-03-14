import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

export default function NotFoundScreen() {
    const { theme } = useUnistyles();
    const router = useRouter();

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.code, { color: theme.colors.onSurfaceVariant }]}>404</Text>
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>Page Not Found</Text>
            <Text style={[styles.message, { color: theme.colors.onSurfaceVariant }]}>This page doesn't exist.</Text>
            <Pressable
                accessibilityRole="button"
                onPress={() => router.replace("/")}
                style={({ pressed }) => [
                    styles.button,
                    { backgroundColor: theme.colors.primary },
                    pressed && styles.buttonPressed
                ]}
            >
                <Text style={[styles.buttonText, { color: theme.colors.onPrimary }]}>Go Home</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 28,
        gap: 18
    },
    code: {
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
