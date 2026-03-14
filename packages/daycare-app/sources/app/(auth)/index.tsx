import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as React from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { SinglePanelLayout } from "@/components/layout/SinglePanelLayout";
import { authEmailRequest, authEmailVerify } from "@/modules/auth/authApi";
import { useAuthStore } from "@/modules/auth/authContext";
import { authDefaultsResolve } from "@/modules/auth/authDefaultsResolve";
import { authRedirectTake } from "@/modules/auth/authRedirectStorage";

type RequestedCodeState = {
    email: string;
    expiresAt: number | null;
    resendAvailableAt: number;
};

export default React.memo(function Welcome() {
    const { theme } = useUnistyles();
    const defaults = React.useMemo(() => authDefaultsResolve(), []);
    const login = useAuthStore((state) => state.login);

    const [email, setEmail] = React.useState("");
    const [code, setCode] = React.useState("");
    const [requested, setRequested] = React.useState<RequestedCodeState | null>(null);
    const [submitting, setSubmitting] = React.useState(false);
    const [message, setMessage] = React.useState<string | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [nowMs, setNowMs] = React.useState(() => Date.now());

    React.useEffect(() => {
        if (!requested) {
            return;
        }
        const interval = setInterval(() => {
            setNowMs(Date.now());
        }, 1000);
        return () => {
            clearInterval(interval);
        };
    }, [requested]);

    const normalizedEmail = email.trim().toLowerCase();
    const requestedEmail = requested?.email ?? normalizedEmail;
    const resendRemainingMs = requested ? Math.max(0, requested.resendAvailableAt - nowMs) : 0;
    const expiresRemainingMs = requested?.expiresAt ? Math.max(0, requested.expiresAt - nowMs) : 0;
    const canResend = requested !== null && resendRemainingMs === 0;

    const requestCode = React.useCallback(async () => {
        const targetEmail = requested?.email ?? normalizedEmail;
        if (!targetEmail || submitting) {
            return;
        }

        setSubmitting(true);
        setError(null);
        setMessage(null);
        try {
            const result = await authEmailRequest(defaults.backendUrl, targetEmail);
            if (!result.ok) {
                throw new Error(result.error);
            }

            setRequested({
                email: targetEmail,
                expiresAt: typeof result.expiresAt === "number" ? result.expiresAt : null,
                resendAvailableAt: Date.now() + (result.retryAfterMs ?? 30_000)
            });
            setEmail(targetEmail);
            setCode("");
            setMessage(`We sent a 6-digit code to ${targetEmail}.`);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Failed to send sign-in code.");
        } finally {
            setSubmitting(false);
        }
    }, [defaults.backendUrl, normalizedEmail, requested, submitting]);

    const verifyCode = React.useCallback(async () => {
        const targetEmail = requested?.email;
        const normalizedCode = code.replace(/\D/g, "").slice(0, 6);
        if (!targetEmail || normalizedCode.length !== 6 || submitting) {
            return;
        }

        setSubmitting(true);
        setError(null);
        setMessage(null);
        try {
            const result = await authEmailVerify(defaults.backendUrl, targetEmail, normalizedCode);
            if (!result.ok) {
                throw new Error(result.error);
            }
            await login(defaults.backendUrl, result.token);
            router.replace((authRedirectTake() ?? "/(app)") as never);
        } catch (verifyError) {
            setError(verifyError instanceof Error ? verifyError.message : "Invalid or expired sign-in code.");
        } finally {
            setSubmitting(false);
        }
    }, [code, defaults.backendUrl, login, requested, submitting]);

    const resetEmail = React.useCallback(() => {
        setRequested(null);
        setCode("");
        setMessage(null);
        setError(null);
    }, []);

    return (
        <SinglePanelLayout>
            <View style={styles.content}>
                <View style={[styles.heroIcon, { backgroundColor: theme.colors.primaryContainer }]}>
                    <Ionicons name="sparkles" size={48} color={theme.colors.onPrimaryContainer} />
                </View>
                <Text style={[styles.title, { color: theme.colors.onSurface }]}>Welcome to Daycare</Text>
                <Text style={[styles.slogan, { color: theme.colors.onSurfaceVariant }]}>
                    The AI-powered assistant for your software team.
                </Text>

                <View style={styles.featuresList}>
                    <FeatureItem
                        icon="chatbubbles-outline"
                        title="Collaborative Chat"
                        description="Engage with specialized AI agents tailored for your workflows."
                        theme={theme}
                    />
                    <FeatureItem
                        icon="folder-open-outline"
                        title="Context Aware"
                        description="Daycare understands your codebase and project context natively."
                        theme={theme}
                    />
                    <FeatureItem
                        icon="flash-outline"
                        title="Lightning Fast"
                        description="Get answers and generate code with zero latency impact."
                        theme={theme}
                    />
                </View>

                <View style={[styles.instructionCard, { backgroundColor: theme.colors.surfaceContainerHighest }]}>
                    <View style={styles.instructionHeader}>
                        <Ionicons
                            name={requested ? "keypad-outline" : "mail-unread-outline"}
                            size={24}
                            color={theme.colors.onSurface}
                            style={styles.instructionIcon}
                        />
                        <View style={styles.instructionTextContainer}>
                            <Text style={[styles.instructionTitle, { color: theme.colors.onSurface }]}>
                                {requested ? "Enter sign-in code" : "Sign in with email"}
                            </Text>
                            <Text style={[styles.instructionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                                {requested
                                    ? `Enter the code sent to ${requestedEmail}.`
                                    : "Enter your email and we'll send a 6-digit code to your Daycare workspace."}
                            </Text>
                        </View>
                    </View>

                    {!requested ? (
                        <>
                            <TextInput
                                autoCapitalize="none"
                                autoComplete="email"
                                autoCorrect={false}
                                keyboardType="email-address"
                                onChangeText={setEmail}
                                placeholder="you@company.com"
                                placeholderTextColor={theme.colors.onSurfaceVariant}
                                style={[
                                    styles.input,
                                    {
                                        color: theme.colors.onSurface,
                                        backgroundColor: theme.colors.surface,
                                        borderColor: theme.colors.outlineVariant
                                    }
                                ]}
                                value={email}
                            />
                            <Pressable
                                accessibilityRole="button"
                                disabled={submitting || normalizedEmail.length === 0}
                                onPress={() => void requestCode()}
                                style={({ pressed }) => [
                                    styles.button,
                                    { backgroundColor: theme.colors.primary },
                                    pressed && !submitting ? styles.buttonPressed : null,
                                    submitting || normalizedEmail.length === 0 ? styles.buttonDisabled : null
                                ]}
                            >
                                {submitting ? (
                                    <ActivityIndicator size="small" color={theme.colors.onPrimary} />
                                ) : (
                                    <Text style={[styles.buttonText, { color: theme.colors.onPrimary }]}>
                                        Send Code
                                    </Text>
                                )}
                            </Pressable>
                        </>
                    ) : (
                        <>
                            <TextInput
                                autoCapitalize="none"
                                autoCorrect={false}
                                keyboardType="number-pad"
                                maxLength={6}
                                onChangeText={(value) => {
                                    setCode(value.replace(/\D/g, "").slice(0, 6));
                                }}
                                placeholder="123456"
                                placeholderTextColor={theme.colors.onSurfaceVariant}
                                style={[
                                    styles.input,
                                    styles.codeInput,
                                    {
                                        color: theme.colors.onSurface,
                                        backgroundColor: theme.colors.surface,
                                        borderColor: theme.colors.outlineVariant
                                    }
                                ]}
                                value={code}
                            />
                            {requested.expiresAt ? (
                                <Text style={[styles.metaText, { color: theme.colors.onSurfaceVariant }]}>
                                    Code expires in {durationSecondsText(expiresRemainingMs)}.
                                </Text>
                            ) : null}
                            <Pressable
                                accessibilityRole="button"
                                disabled={submitting || code.length !== 6}
                                onPress={() => void verifyCode()}
                                style={({ pressed }) => [
                                    styles.button,
                                    { backgroundColor: theme.colors.primary },
                                    pressed && !submitting ? styles.buttonPressed : null,
                                    submitting || code.length !== 6 ? styles.buttonDisabled : null
                                ]}
                            >
                                {submitting ? (
                                    <ActivityIndicator size="small" color={theme.colors.onPrimary} />
                                ) : (
                                    <Text style={[styles.buttonText, { color: theme.colors.onPrimary }]}>Sign In</Text>
                                )}
                            </Pressable>
                            <View style={styles.secondaryActions}>
                                <Pressable
                                    accessibilityRole="button"
                                    disabled={submitting}
                                    onPress={resetEmail}
                                    style={({ pressed }) => [
                                        styles.secondaryButton,
                                        pressed ? styles.buttonPressed : null
                                    ]}
                                >
                                    <Text style={[styles.secondaryButtonText, { color: theme.colors.primary }]}>
                                        Change Email
                                    </Text>
                                </Pressable>
                                <Pressable
                                    accessibilityRole="button"
                                    disabled={submitting || !canResend}
                                    onPress={() => void requestCode()}
                                    style={({ pressed }) => [
                                        styles.secondaryButton,
                                        pressed && canResend ? styles.buttonPressed : null,
                                        !canResend ? styles.buttonDisabled : null
                                    ]}
                                >
                                    <Text style={[styles.secondaryButtonText, { color: theme.colors.primary }]}>
                                        {canResend
                                            ? "Resend Code"
                                            : `Resend in ${durationSecondsText(resendRemainingMs)}`}
                                    </Text>
                                </Pressable>
                            </View>
                        </>
                    )}

                    {message ? <Text style={[styles.feedback, { color: theme.colors.primary }]}>{message}</Text> : null}
                    {error ? <Text style={[styles.feedback, { color: theme.colors.error }]}>{error}</Text> : null}
                </View>
            </View>
        </SinglePanelLayout>
    );
});

type FeatureItemProps = {
    icon: React.ComponentProps<typeof Ionicons>["name"];
    title: string;
    description: string;
    theme: {
        colors: {
            primary: string;
            onSurface: string;
            onSurfaceVariant: string;
            surfaceContainerHigh: string;
        };
    };
};

function FeatureItem({ icon, title, description, theme }: FeatureItemProps) {
    return (
        <View style={styles.featureItem}>
            <View style={[styles.featureIconContainer, { backgroundColor: theme.colors.surfaceContainerHigh }]}>
                <Ionicons name={icon} size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.featureTextContainer}>
                <Text style={[styles.featureTitle, { color: theme.colors.onSurface }]}>{title}</Text>
                <Text style={[styles.featureDescription, { color: theme.colors.onSurfaceVariant }]}>{description}</Text>
            </View>
        </View>
    );
}

function durationSecondsText(durationMs: number): string {
    const seconds = Math.max(0, Math.ceil(durationMs / 1000));
    return `${seconds}s`;
}

const styles = StyleSheet.create({
    content: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 32,
        width: "100%"
    },
    heroIcon: {
        width: 88,
        height: 88,
        borderRadius: 44,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 24,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4
        },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5
    },
    title: {
        fontSize: 36,
        fontWeight: "800",
        marginBottom: 12,
        textAlign: "center",
        letterSpacing: -0.5
    },
    slogan: {
        fontSize: 18,
        textAlign: "center",
        marginBottom: 48,
        lineHeight: 26,
        maxWidth: 320
    },
    featuresList: {
        width: "100%",
        maxWidth: 440,
        gap: 24,
        marginBottom: 48
    },
    featureItem: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 16
    },
    featureIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center"
    },
    featureTextContainer: {
        flex: 1
    },
    featureTitle: {
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 4
    },
    featureDescription: {
        fontSize: 14,
        lineHeight: 20
    },
    instructionCard: {
        padding: 24,
        borderRadius: 20,
        width: "100%",
        maxWidth: 440,
        gap: 16
    },
    instructionHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 16
    },
    instructionIcon: {
        opacity: 0.8
    },
    instructionTextContainer: {
        flex: 1
    },
    instructionTitle: {
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 4
    },
    instructionSubtitle: {
        fontSize: 14,
        lineHeight: 20
    },
    input: {
        width: "100%",
        height: 48,
        borderRadius: 14,
        borderWidth: 1,
        paddingHorizontal: 14,
        fontSize: 16
    },
    codeInput: {
        fontSize: 24,
        letterSpacing: 8,
        textAlign: "center"
    },
    button: {
        width: "100%",
        height: 48,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center"
    },
    secondaryActions: {
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 12
    },
    secondaryButton: {
        flex: 1,
        minHeight: 40,
        alignItems: "center",
        justifyContent: "center"
    },
    secondaryButtonText: {
        fontSize: 14,
        fontWeight: "600"
    },
    buttonText: {
        fontSize: 16,
        fontWeight: "700"
    },
    buttonPressed: {
        opacity: 0.9
    },
    buttonDisabled: {
        opacity: 0.5
    },
    metaText: {
        fontSize: 13,
        textAlign: "center"
    },
    feedback: {
        fontSize: 14,
        lineHeight: 20
    }
});
