import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

/**
 * Check-email instructions screen shown after a magic link is sent.
 * Tells the user to check their inbox and tap the link.
 */
export default function VerifyScreen() {
    const { theme } = useUnistyles();
    const router = useRouter();
    const { email } = useLocalSearchParams<{ email?: string }>();

    return (
        <View style={styles.content}>
            <View style={[styles.iconContainer, { backgroundColor: theme.colors.primaryContainer }]}>
                <Ionicons name="mail-outline" size={42} color={theme.colors.onPrimaryContainer} />
            </View>
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>Check your email</Text>
            <Text style={[styles.message, { color: theme.colors.onSurfaceVariant }]}>
                We sent a sign-in link to{" "}
                <Text style={[styles.email, { color: theme.colors.onSurface }]}>{email ?? "your email"}</Text>. Tap the
                link in the email to sign in.
            </Text>
            <Text style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
                Didn't receive it? Check your spam folder or try again.
            </Text>
            <Pressable
                accessibilityRole="button"
                onPress={() => router.back()}
                style={({ pressed }) => [
                    styles.button,
                    { backgroundColor: theme.colors.surfaceContainerHighest },
                    pressed && styles.buttonPressed
                ]}
            >
                <Text style={[styles.buttonText, { color: theme.colors.onSurface }]}>Try another email</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    content: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 28,
        paddingBottom: 56,
        gap: 16
    },
    iconContainer: {
        width: 88,
        height: 88,
        borderRadius: 44,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 8
    },
    title: {
        fontFamily: "IBMPlexSans-Bold",
        fontSize: 28,
        textAlign: "center"
    },
    message: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 16,
        lineHeight: 24,
        textAlign: "center",
        maxWidth: 340
    },
    email: {
        fontFamily: "IBMPlexSans-SemiBold"
    },
    hint: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14,
        lineHeight: 20,
        textAlign: "center",
        maxWidth: 320
    },
    button: {
        marginTop: 8,
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
