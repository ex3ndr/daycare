import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useAuthStore } from "@/modules/auth/authContext";
import { useConfigStore } from "@/modules/config/configContext";
import { configUpdate } from "@/modules/config/configUpdate";
import { supervisorBootstrap } from "@/modules/supervisor/supervisorBootstrap";
import { useWorkspace } from "@/modules/workspaces/workspaceProvider";

/**
 * Onboarding view shown when homeReady is false.
 * If bootstrap hasn't started, shows a mission input.
 * If bootstrap has started, shows a working indicator.
 */
export function OnboardingView() {
    const { theme } = useUnistyles();
    const { workspaceId } = useWorkspace();
    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);
    const bootstrapStarted = useConfigStore((s) => s.configFor(workspaceId).bootstrapStarted);

    const [mission, setMission] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = useCallback(async () => {
        const text = mission.trim();
        if (!text || !baseUrl || !token) return;

        setSubmitting(true);
        setError(null);
        try {
            await supervisorBootstrap(baseUrl, token, workspaceId, text);
            await configUpdate(baseUrl, token, { bootstrapStarted: true });
        } catch (e) {
            setError(e instanceof Error ? e.message : "Something went wrong");
            setSubmitting(false);
        }
    }, [mission, baseUrl, token, workspaceId]);

    if (bootstrapStarted) {
        return (
            <View style={styles.root}>
                <View style={styles.content}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text style={[styles.title, { color: theme.colors.onSurface }]}>Working on your mission</Text>
                    <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                        Your agent is researching and preparing tasks. This page will update automatically once
                        everything is ready.
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.root}>
            <View style={styles.content}>
                <Text style={[styles.title, { color: theme.colors.onSurface }]}>What is your mission?</Text>
                <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                    Describe what you want to accomplish. Your supervisor agent will research the landscape and create
                    an action plan.
                </Text>
                <TextInput
                    style={[
                        styles.input,
                        {
                            color: theme.colors.onSurface,
                            borderColor: theme.colors.outline,
                            backgroundColor: theme.colors.surfaceContainerLow
                        }
                    ]}
                    placeholder="e.g. Build a SaaS product for..."
                    placeholderTextColor={theme.colors.onSurfaceVariant}
                    value={mission}
                    onChangeText={setMission}
                    multiline
                    textAlignVertical="top"
                />
                {error ? <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text> : null}
                <Pressable
                    style={[
                        styles.button,
                        {
                            backgroundColor: mission.trim()
                                ? theme.colors.primary
                                : theme.colors.surfaceContainerHighest,
                            opacity: submitting ? 0.6 : 1
                        }
                    ]}
                    onPress={handleSubmit}
                    disabled={!mission.trim() || submitting}
                >
                    {submitting ? (
                        <ActivityIndicator size="small" color={theme.colors.onPrimary} />
                    ) : (
                        <Text
                            style={[
                                styles.buttonText,
                                {
                                    color: mission.trim() ? theme.colors.onPrimary : theme.colors.onSurfaceVariant
                                }
                            ]}
                        >
                            Start
                        </Text>
                    )}
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24
    },
    content: {
        alignItems: "center",
        gap: 16,
        maxWidth: 480,
        width: "100%"
    },
    title: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 22,
        textAlign: "center"
    },
    subtitle: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14,
        lineHeight: 20,
        textAlign: "center"
    },
    input: {
        width: "100%",
        minHeight: 120,
        borderWidth: 1,
        borderRadius: 12,
        padding: 16,
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 15,
        lineHeight: 22
    },
    error: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13
    },
    button: {
        paddingHorizontal: 32,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        minWidth: 120,
        minHeight: 44
    },
    buttonText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15
    }
});
