import * as React from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { ItemGroup } from "@/components/ItemGroup";
import { ItemList } from "@/components/ItemList";
import { PageHeader } from "@/components/PageHeader";
import { useAuthStore } from "@/modules/auth/authContext";
import { voiceAgentRead, voiceSessionStart } from "@/modules/voice/voiceAgentsFetch";
import { voiceSessionClientToolsBuild } from "@/modules/voice/voiceSession";
import { voiceTranscriptApply } from "@/modules/voice/voiceTranscriptApply";
import type { VoiceAgentRecord, VoiceConversationEvent, VoiceTranscriptEntry } from "@/modules/voice/voiceTypes";
import { useWorkspace } from "@/modules/workspaces/workspaceProvider";

export function VoiceCallView(props: { voiceAgentId: string }) {
    if (Platform.OS === "web") {
        return <VoiceCallWebView voiceAgentId={props.voiceAgentId} />;
    }

    return <VoiceCallNativeView voiceAgentId={props.voiceAgentId} />;
}

function VoiceCallWebView(props: { voiceAgentId: string }) {
    const { theme } = useUnistyles();
    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);
    const { workspaceId } = useWorkspace();
    const [voiceAgent, setVoiceAgent] = React.useState<VoiceAgentRecord | null>(null);
    const [status, setStatus] = React.useState<string>("disconnected");
    const [bootstrapping, setBootstrapping] = React.useState(false);
    const [muted, setMuted] = React.useState(false);
    const [transcript, setTranscript] = React.useState<VoiceTranscriptEntry[]>([]);
    const [error, setError] = React.useState<string | null>(null);
    const elevenLabs = require("@elevenlabs/react") as typeof import("@elevenlabs/react");
    const clientTools = React.useMemo(() => voiceSessionClientToolsBuild(voiceAgent?.tools ?? []), [voiceAgent?.tools]);
    const conversation = elevenLabs.useConversation({
        clientTools,
        micMuted: muted,
        onError: (message) => {
            setError(message);
        },
        onMessage: ({ message }) => {
            setTranscript((current) => voiceTranscriptApply(current, message as VoiceConversationEvent));
        },
        onStatusChange: ({ status: nextStatus }) => {
            setStatus(nextStatus);
        }
    });
    const mode = conversation.isSpeaking ? "speaking" : "listening";
    const conversationRef = React.useRef(conversation);
    conversationRef.current = conversation;

    React.useEffect(() => {
        if (!baseUrl || !token) {
            return;
        }
        voiceAgentRead(baseUrl, token, workspaceId, props.voiceAgentId)
            .then((record) => {
                setVoiceAgent(record);
                setError(null);
            })
            .catch((nextError) => {
                setError(nextError instanceof Error ? nextError.message : "Failed to load voice agent");
            });
    }, [baseUrl, token, workspaceId, props.voiceAgentId]);

    React.useEffect(() => {
        return () => {
            void conversationRef.current.endSession().catch(() => undefined);
        };
    }, []);

    const handleStart = React.useCallback(() => {
        if (!baseUrl || !token) {
            setError("Authentication is required to start a voice call.");
            return;
        }

        setBootstrapping(true);
        setError(null);

        void (async () => {
            try {
                if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
                    throw new Error("Browser microphone access is unavailable.");
                }
                const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                for (const track of permissionStream.getTracks()) {
                    track.stop();
                }

                const started = await voiceSessionStart(baseUrl, token, workspaceId, props.voiceAgentId);
                setVoiceAgent(started.voiceAgent);
                await conversation.startSession({
                    agentId: started.session.agentId,
                    overrides: started.session.overrides,
                    userId: workspaceId ?? undefined,
                    connectionType: "webrtc"
                });
            } catch (nextError) {
                setError(nextError instanceof Error ? nextError.message : "Failed to start voice call");
                setStatus("disconnected");
            } finally {
                setBootstrapping(false);
            }
        })();
    }, [baseUrl, token, workspaceId, props.voiceAgentId, conversation]);

    const handleMuteToggle = React.useCallback(() => {
        setMuted((current) => !current);
    }, []);

    const handleHangup = React.useCallback(() => {
        void conversation.endSession().catch((nextError: unknown) => {
            setError(nextError instanceof Error ? nextError.message : "Failed to end voice call");
        });
    }, [conversation]);

    return (
        <View style={{ flex: 1 }}>
            <PageHeader
                title={voiceAgent?.name ?? "Voice Call"}
                icon="unmute"
                subtitle={voiceCallSubtitle(status, mode)}
            />
            {bootstrapping ? (
                <View style={[styles.centered, { flex: 1 }]}>
                    <ActivityIndicator color={theme.colors.primary} />
                </View>
            ) : (
                <ItemList containerStyle={styles.listContent}>
                    <ItemGroup
                        title="Call Controls"
                        footer={
                            voiceAgent?.description ??
                            "Browser calls use the ElevenLabs web SDK and browser mic access."
                        }
                    >
                        <View style={styles.controls}>
                            {status === "connected" || status === "connecting" ? (
                                <>
                                    <VoiceCallButton
                                        label={muted ? "Unmute" : "Mute"}
                                        tone={muted ? "muted" : "neutral"}
                                        onPress={handleMuteToggle}
                                    />
                                    <VoiceCallButton label="Hang Up" tone="danger" onPress={handleHangup} />
                                </>
                            ) : (
                                <VoiceCallButton label="Start Call" tone="neutral" onPress={handleStart} />
                            )}
                        </View>
                        <View style={styles.statusGrid}>
                            <VoiceStat label="Status" value={status} />
                            <VoiceStat label="Mode" value={mode} />
                            <VoiceStat label="Mic" value={muted ? "muted" : "live"} />
                        </View>
                        <Text style={[styles.errorText, { color: theme.colors.onSurfaceVariant }]}>
                            Browser calls need microphone permission and a user gesture to start.
                        </Text>
                        {error ? <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text> : null}
                    </ItemGroup>
                    <ItemGroup title="Transcript" footer="Realtime transcript events from the active voice session.">
                        {transcript.length > 0 ? (
                            transcript.map((entry) => (
                                <View key={entry.id} style={styles.transcriptRow}>
                                    <Text style={[styles.transcriptRole, { color: theme.colors.onSurfaceVariant }]}>
                                        {entry.role === "agent" ? "Agent" : "You"}
                                    </Text>
                                    <Text style={[styles.transcriptText, { color: theme.colors.onSurface }]}>
                                        {entry.text}
                                    </Text>
                                </View>
                            ))
                        ) : (
                            <View style={styles.centerBlock}>
                                <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                                    No transcript yet.
                                </Text>
                            </View>
                        )}
                    </ItemGroup>
                </ItemList>
            )}
        </View>
    );
}

function VoiceCallNativeView(props: { voiceAgentId: string }) {
    const { theme } = useUnistyles();
    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);
    const { workspaceId } = useWorkspace();
    const [voiceAgent, setVoiceAgent] = React.useState<VoiceAgentRecord | null>(null);
    const [status, setStatus] = React.useState<"connecting" | "connected" | "disconnected">("disconnected");
    const [mode, setMode] = React.useState<"speaking" | "listening">("listening");
    const [error, setError] = React.useState<string | null>(null);
    const [transcript, setTranscript] = React.useState<VoiceTranscriptEntry[]>([]);
    const [bootstrapping, setBootstrapping] = React.useState(true);
    const [muted, setMuted] = React.useState(false);
    const startedRef = React.useRef(false);

    const elevenLabs = require("@elevenlabs/react-native") as typeof import("@elevenlabs/react-native");
    const liveKit = require("@livekit/react-native") as typeof import("@livekit/react-native");
    const { localParticipant, isMicrophoneEnabled } = liveKit.useLocalParticipant();

    const clientTools = React.useMemo(() => voiceSessionClientToolsBuild(voiceAgent?.tools ?? []), [voiceAgent?.tools]);

    const conversation = elevenLabs.useConversation({
        clientTools,
        onConnect: () => {
            setStatus("connected");
            setError(null);
        },
        onDisconnect: () => {
            setStatus("disconnected");
        },
        onError: (message) => {
            setError(message);
        },
        onModeChange: ({ mode: nextMode }) => {
            setMode(nextMode);
        },
        onStatusChange: ({ status: nextStatus }) => {
            setStatus(nextStatus);
        },
        onMessage: ({ message }) => {
            setTranscript((current) => voiceTranscriptApply(current, message as VoiceConversationEvent));
        }
    });
    const conversationRef = React.useRef(conversation);
    conversationRef.current = conversation;

    React.useEffect(() => {
        if (!baseUrl || !token || startedRef.current) {
            return;
        }

        let cancelled = false;
        startedRef.current = true;
        setBootstrapping(true);

        void (async () => {
            try {
                const started = await voiceSessionStart(baseUrl, token, workspaceId, props.voiceAgentId);
                if (cancelled) {
                    return;
                }
                setVoiceAgent(started.voiceAgent);
                await conversationRef.current.startSession({
                    agentId: started.session.agentId,
                    overrides: started.session.overrides,
                    userId: workspaceId ?? undefined
                });
            } catch (nextError) {
                if (!cancelled) {
                    setError(nextError instanceof Error ? nextError.message : "Failed to start voice call");
                    setStatus("disconnected");
                }
            } finally {
                if (!cancelled) {
                    setBootstrapping(false);
                }
            }
        })();

        return () => {
            cancelled = true;
            void conversationRef.current.endSession().catch(() => undefined);
        };
    }, [baseUrl, token, workspaceId, props.voiceAgentId]);

    React.useEffect(() => {
        if (!localParticipant) {
            return;
        }
        void localParticipant.setMicrophoneEnabled(!muted).catch((nextError: unknown) => {
            setError(nextError instanceof Error ? nextError.message : "Failed to update microphone state");
        });
    }, [localParticipant, muted]);

    const handleMuteToggle = React.useCallback(() => {
        setMuted((current) => !current);
    }, []);

    const handleHangup = React.useCallback(() => {
        void conversation.endSession().catch((nextError: unknown) => {
            setError(nextError instanceof Error ? nextError.message : "Failed to end voice call");
        });
    }, [conversation]);

    return (
        <View style={{ flex: 1 }}>
            <PageHeader
                title={voiceAgent?.name ?? "Voice Call"}
                icon="unmute"
                subtitle={voiceCallSubtitle(status, mode)}
            />
            {bootstrapping ? (
                <View style={[styles.centered, { flex: 1 }]}>
                    <ActivityIndicator color={theme.colors.primary} />
                </View>
            ) : (
                <ItemList containerStyle={styles.listContent}>
                    <ItemGroup title="Call Controls" footer={voiceAgent?.description ?? undefined}>
                        <View style={styles.controls}>
                            <VoiceCallButton
                                label={muted || isMicrophoneEnabled === false ? "Unmute" : "Mute"}
                                tone={muted || isMicrophoneEnabled === false ? "muted" : "neutral"}
                                onPress={handleMuteToggle}
                            />
                            <VoiceCallButton label="Hang Up" tone="danger" onPress={handleHangup} />
                        </View>
                        <View style={styles.statusGrid}>
                            <VoiceStat label="Status" value={status} />
                            <VoiceStat label="Mode" value={mode} />
                            <VoiceStat label="Mic" value={muted || isMicrophoneEnabled === false ? "muted" : "live"} />
                        </View>
                        {error ? <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text> : null}
                    </ItemGroup>
                    <ItemGroup title="Transcript" footer="Realtime transcript events from the active voice session.">
                        {transcript.length > 0 ? (
                            transcript.map((entry) => (
                                <View key={entry.id} style={styles.transcriptRow}>
                                    <Text style={[styles.transcriptRole, { color: theme.colors.onSurfaceVariant }]}>
                                        {entry.role === "agent" ? "Agent" : "You"}
                                    </Text>
                                    <Text style={[styles.transcriptText, { color: theme.colors.onSurface }]}>
                                        {entry.text}
                                    </Text>
                                </View>
                            ))
                        ) : (
                            <View style={styles.centerBlock}>
                                <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                                    No transcript yet.
                                </Text>
                            </View>
                        )}
                    </ItemGroup>
                </ItemList>
            )}
        </View>
    );
}

const VoiceCallButton = React.memo(
    (props: { label: string; tone: "neutral" | "danger" | "muted"; onPress: () => void }) => {
        const { theme } = useUnistyles();
        const backgroundColor =
            props.tone === "danger"
                ? theme.colors.error
                : props.tone === "muted"
                  ? theme.colors.primaryContainer
                  : theme.colors.surfaceContainerHigh;
        const color =
            props.tone === "danger"
                ? theme.colors.onError
                : props.tone === "muted"
                  ? theme.colors.onPrimaryContainer
                  : theme.colors.onSurface;

        return (
            <Pressable style={[styles.controlButton, { backgroundColor }]} onPress={props.onPress}>
                <Text style={[styles.controlButtonText, { color }]}>{props.label}</Text>
            </Pressable>
        );
    }
);

function VoiceStat(props: { label: string; value: string }) {
    const { theme } = useUnistyles();
    return (
        <View style={[styles.statCard, { backgroundColor: theme.colors.surfaceContainerHigh }]}>
            <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>{props.label}</Text>
            <Text style={[styles.statValue, { color: theme.colors.onSurface }]}>{props.value}</Text>
        </View>
    );
}

function voiceCallSubtitle(status: string, mode: "speaking" | "listening") {
    return `${status} · ${mode}`;
}

const styles = StyleSheet.create({
    centered: {
        alignItems: "center",
        justifyContent: "center",
        padding: 32
    },
    listContent: {
        paddingBottom: 24
    },
    controls: {
        flexDirection: "row",
        gap: 12,
        padding: 16
    },
    controlButton: {
        flex: 1,
        minHeight: 52,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 16
    },
    controlButtonText: {
        fontSize: 15,
        fontFamily: "IBMPlexSans-SemiBold"
    },
    statusGrid: {
        flexDirection: "row",
        gap: 12,
        paddingHorizontal: 16,
        paddingBottom: 16
    },
    statCard: {
        flex: 1,
        minHeight: 76,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 6
    },
    statLabel: {
        fontSize: 12,
        fontFamily: "IBMPlexMono-Regular",
        textTransform: "uppercase"
    },
    statValue: {
        fontSize: 16,
        fontFamily: "IBMPlexSans-SemiBold"
    },
    errorText: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        fontSize: 13,
        lineHeight: 18,
        fontFamily: "IBMPlexSans-Regular"
    },
    transcriptRow: {
        paddingHorizontal: 18,
        paddingVertical: 14,
        gap: 6
    },
    transcriptRole: {
        fontSize: 11,
        fontFamily: "IBMPlexMono-Regular",
        textTransform: "uppercase"
    },
    transcriptText: {
        fontSize: 14,
        lineHeight: 20,
        fontFamily: "IBMPlexSans-Regular"
    },
    centerBlock: {
        padding: 20,
        gap: 12
    },
    emptyText: {
        fontSize: 14,
        fontFamily: "IBMPlexSans-Regular"
    }
});
