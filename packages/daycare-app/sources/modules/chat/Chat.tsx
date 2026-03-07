import * as React from "react";
import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useAgentsStore } from "@/modules/agents/agentsContext";
import { useAuthStore } from "@/modules/auth/authContext";
import { useWorkspace } from "@/modules/workspaces/workspaceProvider";
import { ChatInput } from "./ChatInput";
import { ChatMessageList } from "./ChatMessageList";
import { ChatThinkingBar } from "./ChatThinkingBar";
import { useChat, useChatStore } from "./chatContext";

const CHAT_POLL_INTERVAL_MS = 3000;
const CHAT_CONFIGURATION_ERROR = "Chat requires either agentId or systemPrompt.";

export type ChatProps = {
    agentId?: string;
    systemPrompt?: string;
    name?: string;
    description?: string;
};

/**
 * Reusable app chat component.
 * Use controlled mode with `agentId`, or auto-create mode with `systemPrompt`.
 */
export function Chat({ agentId, systemPrompt, name, description }: ChatProps) {
    const { theme } = useUnistyles();
    const baseUrl = useAuthStore((state) => state.baseUrl);
    const token = useAuthStore((state) => state.token);
    const { workspaceId, loaded } = useWorkspace();

    const open = useChatStore((state) => state.open);
    const create = useChatStore((state) => state.create);
    const send = useChatStore((state) => state.send);
    const poll = useChatStore((state) => state.poll);

    const [createdAgentId, setCreatedAgentId] = React.useState<string | null>(null);
    const [initializing, setInitializing] = React.useState(false);
    const [initializationError, setInitializationError] = React.useState<string | null>(null);
    const creatingRef = React.useRef(false);

    const resolvedAgentId = agentId ?? createdAgentId;
    const session = useChat(resolvedAgentId);
    const configurationError = !agentId && !systemPrompt ? CHAT_CONFIGURATION_ERROR : null;

    const agentLifecycle = useAgentsStore((s) => {
        if (!resolvedAgentId) return null;
        return s.agents.find((a) => a.agentId === resolvedAgentId)?.lifecycle ?? null;
    });
    const thinking = agentLifecycle === "active" || session.sending;

    React.useEffect(() => {
        if (agentId) {
            setCreatedAgentId(null);
            creatingRef.current = false;
        }
    }, [agentId]);

    React.useEffect(() => {
        if (!baseUrl || !token || !loaded) {
            return;
        }

        if (agentId) {
            setInitializationError(null);
            void open(baseUrl, token, workspaceId, agentId);
            return;
        }

        if (!systemPrompt || createdAgentId || creatingRef.current) {
            return;
        }

        creatingRef.current = true;
        setInitializationError(null);
        setInitializing(true);
        void create(baseUrl, token, workspaceId, { systemPrompt, name, description })
            .then((newAgentId) => {
                setCreatedAgentId(newAgentId);
            })
            .catch((error) => {
                creatingRef.current = false;
                setInitializationError(error instanceof Error ? error.message : "Failed to create chat session");
            })
            .finally(() => {
                setInitializing(false);
            });
    }, [baseUrl, token, workspaceId, loaded, agentId, systemPrompt, name, description, createdAgentId, open, create]);

    React.useEffect(() => {
        if (!baseUrl || !token || !loaded || !resolvedAgentId) {
            return;
        }

        const interval = setInterval(() => {
            void poll(baseUrl, token, workspaceId, resolvedAgentId);
        }, CHAT_POLL_INTERVAL_MS);

        return () => {
            clearInterval(interval);
        };
    }, [baseUrl, token, workspaceId, loaded, resolvedAgentId, poll]);

    const onSend = React.useCallback(
        async (text: string) => {
            if (!baseUrl || !token || !loaded || !resolvedAgentId) {
                return;
            }
            await send(baseUrl, token, workspaceId, resolvedAgentId, text);
        },
        [baseUrl, token, workspaceId, loaded, resolvedAgentId, send]
    );

    const error = configurationError ?? initializationError ?? session.error;
    const loading = initializing || session.loading;

    return (
        <View style={styles.root}>
            {error ? (
                <View style={styles.errorContainer}>
                    <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
                </View>
            ) : null}

            <View style={styles.listContainer}>
                <ChatMessageList records={session.history} loading={loading} />
            </View>

            <ChatThinkingBar thinking={thinking} />

            {resolvedAgentId ? <ChatInput onSend={onSend} /> : null}
        </View>
    );
}

const styles = StyleSheet.create((theme) => ({
    root: {
        flex: 1,
        maxWidth: theme.layout.maxWidth,
        width: "100%",
        alignSelf: "center"
    },
    listContainer: {
        flex: 1
    },
    errorContainer: {
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: 4
    },
    errorText: {
        fontSize: 12,
        fontFamily: "IBMPlexMono-Regular"
    }
}));
