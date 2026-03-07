import { router } from "expo-router";
import * as React from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { SinglePanelLayout } from "@/components/layout/SinglePanelLayout";
import { authEmailConnectVerify, authEmailVerify, authTelegramExchange } from "@/modules/auth/authApi";
import { useAuthStore } from "@/modules/auth/authContext";
import { authLinkPayloadFromUrl } from "@/modules/auth/authLinkPayloadFromUrl";
import { authTelegramWebAppContextParse } from "@/modules/auth/authTelegramWebAppContextParse";
import { useAuthLinkUrl } from "@/modules/auth/useAuthLinkUrl";
import { useProfileStore } from "@/modules/profile/profileContext";
import { isTMA } from "@/modules/tma/isTMA";
import { tmaInitData } from "@/modules/tma/tmaInitData";
import { tmaLaunchParams } from "@/modules/tma/tmaLaunchParams";
import { tmaReady } from "@/modules/tma/tmaReady";

export default function AuthMagicLinkScreen() {
    const { theme } = useUnistyles();
    const authBaseUrl = useAuthStore((state) => state.baseUrl);
    const authToken = useAuthStore((state) => state.token);
    const authUserId = useAuthStore((state) => state.userId);
    const login = useAuthStore((state) => state.login);
    const fetchProfile = useProfileStore((state) => state.fetch);
    const { url: authUrl, pending: isAuthUrlPending } = useAuthLinkUrl();

    const magicPayload = React.useMemo(() => {
        return authLinkPayloadFromUrl(authUrl);
    }, [authUrl]);

    const telegramWebAppContext = React.useMemo(() => {
        if (Platform.OS !== "web" || typeof window === "undefined") {
            return null;
        }
        if (!isTMA()) {
            console.info("[daycare-app] auth-screen: not TMA environment");
            return null;
        }
        const initData = tmaInitData();
        console.info(
            `[daycare-app] auth-screen: TMA detected, initData=${initData ? `present (${initData.length} chars)` : "missing"}`
        );
        const rawLaunchParams = tmaLaunchParams();
        console.info(
            `[daycare-app] auth-screen: rawLaunchParams=${rawLaunchParams ? `present (${rawLaunchParams.length} chars)` : "missing"}`
        );
        const ctx = authTelegramWebAppContextParse(window.location.href, initData, rawLaunchParams);
        console.info(`[daycare-app] auth-screen: context=${ctx ? "parsed" : "failed"} href=${window.location.href}`);
        return ctx;
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
    const [success, setSuccess] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!telegramWebAppContext) {
            return;
        }
        tmaReady();
    }, [telegramWebAppContext]);

    React.useEffect(() => {
        if (isAuthUrlPending) {
            return;
        }
        console.info(`[daycare-app] auth incoming-link url=${authUrl ?? "none"}`);
    }, [authUrl, isAuthUrlPending]);

    React.useEffect(() => {
        if (isAuthUrlPending) {
            return;
        }
        if (magicPayload || telegramWebAppContext) {
            return;
        }
        console.warn(`[daycare-app] auth invalid-link fullUrl=${authUrl ?? "none"}`);
    }, [authUrl, isAuthUrlPending, magicPayload, telegramWebAppContext]);

    const enterMagic = React.useCallback(async () => {
        if (!magicPayload || isSubmitting) {
            return;
        }

        setIsSubmitting(true);
        setError(null);
        setSuccess(null);
        try {
            if (magicPayload.kind === "email") {
                const result = await authEmailVerify(magicPayload.backendUrl, magicPayload.token);
                if (!result.ok) {
                    throw new Error(result.error);
                }
                await login(magicPayload.backendUrl, result.token);
            } else if (magicPayload.kind === "connect-email") {
                const result = await authEmailConnectVerify(magicPayload.backendUrl, magicPayload.token);
                if (!result.ok) {
                    throw new Error(result.error);
                }
                if (
                    authBaseUrl === magicPayload.backendUrl &&
                    authToken &&
                    (!authUserId || authUserId === result.userId)
                ) {
                    await fetchProfile(authBaseUrl, authToken);
                    router.replace("/(app)" as never);
                    return;
                }
                setSuccess(`Email ${result.email} is now connected to your Daycare account.`);
            } else {
                await login(magicPayload.backendUrl, magicPayload.token);
                router.replace("/(app)" as never);
                return;
            }
            if (magicPayload.kind === "email") {
                router.replace("/(app)" as never);
            }
        } catch {
            setError(
                magicPayload.kind === "email"
                    ? "Email sign-in link expired or invalid. Request a new link."
                    : magicPayload.kind === "connect-email"
                      ? "Email connection link expired or invalid. Request a new link from Settings."
                      : "Magic link expired or invalid. Request a new /app link."
            );
        } finally {
            setIsSubmitting(false);
        }
    }, [authBaseUrl, authToken, authUserId, fetchProfile, isSubmitting, login, magicPayload]);
    const enterTelegram = React.useCallback(async () => {
        if (!telegramWebAppContext || isSubmitting) {
            return;
        }

        console.info("[daycare-app] auth-screen: entering telegram auth");
        setIsSubmitting(true);
        setError(null);
        try {
            const result = await authTelegramExchange(
                telegramWebAppContext.backendUrl,
                telegramWebAppContext.initData,
                telegramWebAppContext.telegramInstanceId
            );
            if (!result.ok) {
                console.warn(`[daycare-app] auth-screen: telegram exchange failed - ${result.error}`);
                throw new Error(result.error);
            }
            console.info(`[daycare-app] auth-screen: telegram exchange succeeded userId=${result.userId}`);
            await login(telegramWebAppContext.backendUrl, result.token);
            router.replace("/(app)" as never);
        } catch (e) {
            console.warn(
                `[daycare-app] auth-screen: telegram login error - ${e instanceof Error ? e.message : String(e)}`
            );
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
                            {magicPayload.kind === "email"
                                ? "Verifying email sign-in with "
                                : magicPayload.kind === "connect-email"
                                  ? "Connecting email for "
                                  : "Connecting to "}
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
                ) : isAuthUrlPending ? (
                    <Text style={[styles.message, { color: theme.colors.onSurfaceVariant }]}>
                        Resolving login link...
                    </Text>
                ) : (
                    <Text style={[styles.message, { color: theme.colors.error }]}>
                        Invalid login link. Request a new /app link or open this page from Telegram WebApp menu.
                    </Text>
                )}
                {error ? <Text style={[styles.message, { color: theme.colors.error }]}>{error}</Text> : null}
                {success ? <Text style={[styles.message, { color: theme.colors.primary }]}>{success}</Text> : null}
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
