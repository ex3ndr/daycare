import { router } from "expo-router";
import * as React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { SinglePanelLayout } from "@/components/layout/SinglePanelLayout";
import { authLinkPayloadParse } from "@/modules/auth/authLinkPayloadParse";
import { useAuthStore } from "@/modules/auth/authContext";

export default function AuthMagicLinkScreen() {
    const { theme } = useUnistyles();
    const login = useAuthStore((state) => state.login);
    const payload = React.useMemo(() => {
        if (typeof window === "undefined") {
            return null;
        }
        return authLinkPayloadParse(window.location.hash);
    }, []);

    const serverLabel = React.useMemo(() => {
        if (!payload) {
            return null;
        }

        try {
            const url = new URL(payload.backendUrl);
            return `${url.host}${url.pathname === "/" ? "" : url.pathname}`;
        } catch {
            return payload.backendUrl;
        }
    }, [payload]);

    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const enter = React.useCallback(async () => {
        if (!payload || isSubmitting) {
            return;
        }

        setIsSubmitting(true);
        setError(null);
        try {
            await login(payload.backendUrl, payload.token);
            router.replace("/(app)" as never);
        } catch {
            setError("Magic link expired or invalid. Request a new /app link.");
        } finally {
            setIsSubmitting(false);
        }
    }, [isSubmitting, login, payload]);

    return (
        <SinglePanelLayout>
            <View style={styles.content}>
                <View style={[styles.iconContainer, { backgroundColor: theme.colors.primaryContainer }]}>
                    <Text style={{ fontSize: 48 }}>✨</Text>
                </View>
                <Text style={[styles.title, { color: theme.colors.onSurface }]}>You're almost in</Text>
                {payload ? (
                    <>
                        <Text style={[styles.message, { color: theme.colors.onSurfaceVariant }]}>
                            Connecting to <Text style={[styles.value, { color: theme.colors.onSurface }]}>{serverLabel}</Text>
                        </Text>
                        <Pressable
                            accessibilityRole="button"
                            disabled={isSubmitting}
                            onPress={() => void enter()}
                            style={({ pressed }) => [
                                styles.button,
                                { backgroundColor: theme.colors.primary },
                                pressed && !isSubmitting ? styles.buttonPressed : null,
                                isSubmitting ? styles.buttonDisabled : null
                            ]}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator size="small" color={theme.colors.onPrimary} />
                            ) : (
                                <Text style={[styles.buttonText, { color: theme.colors.onPrimary }]}>Enter</Text>
                            )}
                        </Pressable>
                    </>
                ) : (
                    <Text style={[styles.message, { color: theme.colors.error }]}>
                        Invalid link payload. Request a new /app link.
                    </Text>
                )}
                {error ? <Text style={[styles.message, { color: theme.colors.error }]}>{error}</Text> : null}
            </View>
        </SinglePanelLayout>
    );
}

const styles = StyleSheet.create({
    content: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        paddingHorizontal: 24
    },
    iconContainer: {
        width: 96,
        height: 96,
        borderRadius: 48,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 24 // Changed from 8 to 24 for improved spacing
    },
    title: {
        fontSize: 32,
        fontWeight: "bold",
        textAlign: "center"
    },
    message: {
        fontSize: 16,
        textAlign: "center"
    },
    value: {
        fontWeight: "600"
    },
    button: {
        minWidth: 160,
        height: 44,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 18
    },
    buttonText: {
        fontSize: 16,
        fontWeight: "600"
    },
    buttonPressed: {
        opacity: 0.9
    },
    buttonDisabled: {
        opacity: 0.75
    }
});
