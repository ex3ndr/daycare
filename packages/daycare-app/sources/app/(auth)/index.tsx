import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { SinglePanelLayout } from "@/components/layout/SinglePanelLayout";
import { authEmailRequest } from "@/modules/auth/authApi";
import { authDefaultsResolve } from "@/modules/auth/authDefaultsResolve";

export default React.memo(function Welcome() {
    const { theme } = useUnistyles();
    const defaults = React.useMemo(() => authDefaultsResolve(), []);
    const [email, setEmail] = React.useState("");
    const [submitting, setSubmitting] = React.useState(false);
    const [message, setMessage] = React.useState<string | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    const requestMagicLink = React.useCallback(async () => {
        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail || submitting) {
            return;
        }

        setSubmitting(true);
        setError(null);
        setMessage(null);
        try {
            const result = await authEmailRequest(defaults.backendUrl, normalizedEmail);
            if (!result.ok) {
                throw new Error(result.error);
            }
            setMessage(`We sent a sign-in link to ${normalizedEmail}.`);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Failed to send sign-in email.");
        } finally {
            setSubmitting(false);
        }
    }, [defaults.backendUrl, email, submitting]);

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
                            name="mail-unread-outline"
                            size={24}
                            color={theme.colors.onSurface}
                            style={styles.instructionIcon}
                        />
                        <View style={styles.instructionTextContainer}>
                            <Text style={[styles.instructionTitle, { color: theme.colors.onSurface }]}>
                                Sign in with email
                            </Text>
                            <Text style={[styles.instructionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                                Enter your email and we'll send a magic link to your Daycare workspace.
                            </Text>
                        </View>
                    </View>
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
                        disabled={submitting || email.trim().length === 0}
                        onPress={() => void requestMagicLink()}
                        style={({ pressed }) => [
                            styles.button,
                            { backgroundColor: theme.colors.primary },
                            pressed && !submitting ? styles.buttonPressed : null,
                            submitting || email.trim().length === 0 ? styles.buttonDisabled : null
                        ]}
                    >
                        {submitting ? (
                            <ActivityIndicator size="small" color={theme.colors.onPrimary} />
                        ) : (
                            <Text style={[styles.buttonText, { color: theme.colors.onPrimary }]}>Send Magic Link</Text>
                        )}
                    </Pressable>
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
    },
    buttonDisabled: {
        opacity: 0.7
    },
    feedback: {
        fontSize: 14,
        lineHeight: 20
    }
});
