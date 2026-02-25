import { router, useLocalSearchParams } from "expo-router";
import * as React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { SinglePanelLayout } from "@/components/layout/SinglePanelLayout";
import { useAuthStore } from "@/modules/auth/authContext";

export default function AuthMagicLinkScreen() {
    const { theme } = useUnistyles();
    const login = useAuthStore((state) => state.login);
    const params = useLocalSearchParams<{ token?: string }>();
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        const token = typeof params.token === "string" ? params.token.trim() : "";
        if (!token) {
            setError("Missing token. Request a new /app link.");
            return;
        }

        let canceled = false;
        void (async () => {
            try {
                await login(token);
                if (!canceled) {
                    router.replace("/(app)" as never);
                }
            } catch {
                if (!canceled) {
                    setError("Magic link expired or invalid. Request a new /app link.");
                }
            }
        })();

        return () => {
            canceled = true;
        };
    }, [login, params.token]);

    return (
        <SinglePanelLayout>
            <View style={styles.content}>
                {error ? (
                    <Text style={[styles.message, { color: theme.colors.error }]}>{error}</Text>
                ) : (
                    <>
                        <ActivityIndicator size="large" color={theme.colors.primary} />
                        <Text style={[styles.message, { color: theme.colors.onSurface }]}>Validating your link...</Text>
                    </>
                )}
            </View>
        </SinglePanelLayout>
    );
}

const styles = StyleSheet.create({
    content: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        paddingHorizontal: 24
    },
    message: {
        fontSize: 16,
        textAlign: "center"
    }
});
