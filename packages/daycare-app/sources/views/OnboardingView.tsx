import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useAgentsStore } from "@/modules/agents/agentsContext";
import { useAuthStore } from "@/modules/auth/authContext";
import { ChatMessageList } from "@/modules/chat/ChatMessageList";
import { ChatThinkingBar } from "@/modules/chat/ChatThinkingBar";
import { chatSupervisorResolve } from "@/modules/chat/chatApi";
import { useChat, useChatStore } from "@/modules/chat/chatContext";
import { useConfigStore } from "@/modules/config/configContext";
import { supervisorBootstrap } from "@/modules/supervisor/supervisorBootstrap";
import { useWorkspace } from "@/modules/workspaces/workspaceProvider";

const POLL_INTERVAL_MS = 3000;

/**
 * Onboarding view shown when homeReady is false.
 * If bootstrap hasn't started, shows a mission input.
 * If bootstrap has started, shows supervisor agent messages (read-only).
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
        } catch (e) {
            setError(e instanceof Error ? e.message : "Something went wrong");
            setSubmitting(false);
        }
    }, [mission, baseUrl, token, workspaceId]);

    if (bootstrapStarted) {
        return <OnboardingSupervisorOutput />;
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

/**
 * Read-only supervisor message output shown during onboarding.
 * Resolves the supervisor agent, polls for messages, and displays them without a text input.
 */
function OnboardingSupervisorOutput() {
    const { theme } = useUnistyles();
    const { workspaceId } = useWorkspace();
    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);

    const open = useChatStore((s) => s.open);
    const poll = useChatStore((s) => s.poll);

    const [supervisorAgentId, setSupervisorAgentId] = useState<string | null>(null);
    const [resolveError, setResolveError] = useState<string | null>(null);

    const session = useChat(supervisorAgentId);

    const agentLifecycle = useAgentsStore((s) => {
        if (!supervisorAgentId) return null;
        return s.agents.find((a) => a.agentId === supervisorAgentId)?.lifecycle ?? null;
    });
    const thinking = agentLifecycle === "active";

    // Resolve supervisor agent id and open its chat session
    useEffect(() => {
        if (!baseUrl || !token) return;
        let cancelled = false;

        chatSupervisorResolve(baseUrl, token, workspaceId)
            .then((agentId) => {
                if (cancelled) return;
                setSupervisorAgentId(agentId);
                void open(baseUrl, token, workspaceId, agentId);
            })
            .catch((e) => {
                if (cancelled) return;
                setResolveError(e instanceof Error ? e.message : "Failed to resolve supervisor");
            });

        return () => {
            cancelled = true;
        };
    }, [baseUrl, token, workspaceId, open]);

    // Poll for new messages
    useEffect(() => {
        if (!baseUrl || !token || !supervisorAgentId) return;

        const interval = setInterval(() => {
            void poll(baseUrl, token, workspaceId, supervisorAgentId);
        }, POLL_INTERVAL_MS);

        return () => {
            clearInterval(interval);
        };
    }, [baseUrl, token, workspaceId, supervisorAgentId, poll]);

    return (
        <View style={styles.outputRoot}>
            <View style={styles.outputHeader}>
                <Text style={[styles.title, { color: theme.colors.onSurface }]}>Working on your mission</Text>
            </View>

            {resolveError ? (
                <View style={styles.outputErrorContainer}>
                    <Text style={[styles.outputErrorText, { color: theme.colors.error }]}>{resolveError}</Text>
                </View>
            ) : null}

            <View style={styles.outputList}>
                <ChatMessageList records={session.history} loading={session.loading} />
            </View>

            <ChatThinkingBar thinking={thinking} />
        </View>
    );
}

const styles = StyleSheet.create((theme) => ({
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
    },
    outputRoot: {
        flex: 1,
        maxWidth: theme.layout.maxWidth,
        width: "100%",
        alignSelf: "center"
    },
    outputHeader: {
        paddingHorizontal: 16,
        paddingTop: 24,
        paddingBottom: 8,
        alignItems: "center"
    },
    outputList: {
        flex: 1
    },
    outputErrorContainer: {
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: 4
    },
    outputErrorText: {
        fontSize: 12,
        fontFamily: "IBMPlexMono-Regular"
    }
}));
