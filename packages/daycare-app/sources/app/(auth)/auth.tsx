import { router } from "expo-router";
import * as React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { SinglePanelLayout } from "@/components/layout/SinglePanelLayout";
import { authTelegramExchange } from "@/modules/auth/authApi";
import { useAuthStore } from "@/modules/auth/authContext";
import { authLinkPayloadParse } from "@/modules/auth/authLinkPayloadParse";
import { authTelegramWebAppContextParse } from "@/modules/auth/authTelegramWebAppContextParse";

type TelegramWindow = Window & {
    Telegram?: {
        WebApp?: {
            initData?: string;
            ready?: () => void;
        };
    };
};

export default function AuthMagicLinkScreen() {
    const { theme } = useUnistyles();
    const login = useAuthStore((state) => state.login);
    const magicPayload = React.useMemo(() => {
        if (typeof window === "undefined") {
            return null;
        }
        return authLinkPayloadParse(window.location.hash);
    }, []);
    const telegramWebAppContext = React.useMemo(() => {
        if (typeof window === "undefined") {
            return null;
        }
        const telegramWindow = window as TelegramWindow;
        return authTelegramWebAppContextParse(window.location.search, telegramWindow.Telegram?.WebApp?.initData);
    }, []);

    const serverLabel = React.useMemo(() => {
        const backendUrl = magicPayload?.backendUrl ?? telegramWebAppContext?.backendUrl;
        if (!backendUrl) {
            return null;
        }

        try {
            const url = new URL(backendUrl);
            return `${url.host}${url.pathname === "/" ? "" : url.pathname}`;
        } catch {
            return backendUrl;
        }
    }, [magicPayload, telegramWebAppContext]);

    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!telegramWebAppContext || typeof window === "undefined") {
            return;
        }
        const telegramWindow = window as TelegramWindow;
        telegramWindow.Telegram?.WebApp?.ready?.();
    }, [telegramWebAppContext]);

    const enterMagic = React.useCallback(async () => {
        if (!magicPayload || isSubmitting) {
            return;
        }

        setIsSubmitting(true);
        setError(null);
        try {
            await login(magicPayload.backendUrl, magicPayload.token);
            router.replace("/(app)" as never);
        } catch {
            setError("Magic link expired or invalid. Request a new /app link.");
        } finally {
            setIsSubmitting(false);
        }
    }, [isSubmitting, login, magicPayload]);
    const enterTelegram = React.useCallback(async () => {
        if (!telegramWebAppContext || isSubmitting) {
            return;
        }

        setIsSubmitting(true);
        setError(null);
        try {
            const result = await authTelegramExchange(
                telegramWebAppContext.backendUrl,
                telegramWebAppContext.initData,
                telegramWebAppContext.telegramInstanceId
            );
            if (!result.ok) {
                throw new Error(result.error);
            }
            await login(telegramWebAppContext.backendUrl, result.token);
            router.replace("/(app)" as never);
        } catch {
            setError("Telegram login failed. Re-open the app from the bot menu or try again.");
        } finally {
            setIsSubmitting(false);
        }
    }, [isSubmitting, login, telegramWebAppContext]);

    const telegramAutoAttemptRef = React.useRef(false);
    React.useEffect(() => {
        if (!telegramWebAppContext || telegramAutoAttemptRef.current) {
            return;
        }
        telegramAutoAttemptRef.current = true;
        void enterTelegram();
    }, [enterTelegram, telegramWebAppContext]);

    return (
        <SinglePanelLayout>
            <View style={styles.content}>
                <View style={[styles.iconContainer, { backgroundColor: theme.colors.primaryContainer }]}>
                    <Text style={{ fontSize: 48 }}>✨</Text>
                </View>
                <Text style={[styles.title, { color: theme.colors.onSurface }]}>You're almost in</Text>
                {magicPayload ? (
                    <>
                        <Text style={[styles.message, { color: theme.colors.onSurfaceVariant }]}>
                            Connecting to{" "}
                            <Text style={[styles.value, { color: theme.colors.onSurface }]}>{serverLabel}</Text>
                        </Text>
                        <Pressable
                            accessibilityRole="button"
                            disabled={isSubmitting}
                            onPress={() => void enterMagic()}
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
                ) : telegramWebAppContext ? (
                    <>
                        <Text style={[styles.message, { color: theme.colors.onSurfaceVariant }]}>
                            Connecting Telegram session to{" "}
                            <Text style={[styles.value, { color: theme.colors.onSurface }]}>{serverLabel}</Text>
                        </Text>
                        <Pressable
                            accessibilityRole="button"
                            disabled={isSubmitting}
                            onPress={() => void enterTelegram()}
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
                                <Text style={[styles.buttonText, { color: theme.colors.onPrimary }]}>Continue</Text>
                            )}
                        </Pressable>
                    </>
                ) : (
                    <Text style={[styles.message, { color: theme.colors.error }]}>
                        Invalid login link. Request a new /app link or open this page from Telegram WebApp menu.
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
