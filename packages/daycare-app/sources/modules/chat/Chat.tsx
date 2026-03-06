import * as React from "react";
import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useAuthStore } from "@/modules/auth/authContext";
import { ChatInput } from "./ChatInput";
import { ChatMessageList } from "./ChatMessageList";
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

    React.useEffect(() => {
        if (agentId) {
            setCreatedAgentId(null);
            creatingRef.current = false;
        }
    }, [agentId]);

    React.useEffect(() => {
        if (!baseUrl || !token) {
            return;
        }

        if (agentId) {
            setInitializationError(null);
            void open(baseUrl, token, agentId);
            return;
        }

        if (!systemPrompt || createdAgentId || creatingRef.current) {
            return;
        }

        creatingRef.current = true;
        setInitializationError(null);
        setInitializing(true);
        void create(baseUrl, token, { systemPrompt, name, description })
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
    }, [baseUrl, token, agentId, systemPrompt, name, description, createdAgentId, open, create]);

    React.useEffect(() => {
        if (!baseUrl || !token || !resolvedAgentId) {
            return;
        }

        const interval = setInterval(() => {
            void poll(baseUrl, token, resolvedAgentId);
        }, CHAT_POLL_INTERVAL_MS);

        return () => {
            clearInterval(interval);
        };
    }, [baseUrl, token, resolvedAgentId, poll]);

    const onSend = React.useCallback(
        async (text: string) => {
            if (!baseUrl || !token || !resolvedAgentId) {
                return;
            }
            await send(baseUrl, token, resolvedAgentId, text);
        },
        [baseUrl, token, resolvedAgentId, send]
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
