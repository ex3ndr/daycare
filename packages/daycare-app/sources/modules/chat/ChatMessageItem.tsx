import { Octicons } from "@expo/vector-icons";
import * as React from "react";
import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import type {
    AgentHistoryAssistantMessage,
    AgentHistoryNote,
    AgentHistoryRecord,
    AgentHistoryRlmStart,
    AgentHistoryRlmToolCall,
    AgentHistoryUserMessage
} from "./chatHistoryTypes";
import { extractText } from "./chatMessageItemHelpers";

export const ChatMessageItem = React.memo(({ record }: { record: AgentHistoryRecord }) => {
    switch (record.type) {
        case "user_message":
            return <UserMessageItem record={record} />;
        case "assistant_message":
            return <AssistantMessageItem record={record} />;
        case "rlm_start":
            return <RunPythonStartItem record={record} />;
        case "rlm_tool_call":
            return <SayItem record={record} />;
        case "note":
            return <NoteItem record={record} />;
        default:
            return null;
    }
});

/** Detects `<system_message origin="...">content</system_message>` or `<system_message_silent ...>`. */
function systemMessageParse(text: string): { origin: string; body: string } | null {
    const match = text.match(
        /^<system_message(?:_silent)?\s+origin="([^"]*)">([\s\S]*)<\/system_message(?:_silent)?>$/
    );
    if (!match) return null;
    return { origin: match[1], body: match[2].trim() };
}

function UserMessageItem({ record }: { record: AgentHistoryUserMessage }) {
    const { theme } = useUnistyles();
    const systemMsg = React.useMemo(() => systemMessageParse(record.text), [record.text]);

    if (record.text === "NO_MESSAGE") return null;

    if (systemMsg) {
        return (
            <View style={styles.row}>
                <Text style={[styles.dimText, { color: theme.colors.onSurfaceVariant }]}>
                    <Octicons name="hubot" size={11} color={theme.colors.onSurfaceVariant} /> {systemMsg.origin}
                </Text>
                <Text style={[styles.text, { color: theme.colors.onSurfaceVariant }]}>{systemMsg.body}</Text>
            </View>
        );
    }

    return (
        <View style={styles.userRow}>
            <View style={[styles.userBubble, { backgroundColor: theme.colors.surfaceContainerHigh }]}>
                <Text style={[styles.text, { color: theme.colors.onSurface }]}>{record.text}</Text>
            </View>
        </View>
    );
}

function AssistantMessageItem({ record }: { record: AgentHistoryAssistantMessage }) {
    const { theme } = useUnistyles();
    const text = extractText(record.content);
    if (!text) return null;
    return (
        <View style={styles.row}>
            <Text style={[styles.text, { color: theme.colors.onSurface }]}>{text}</Text>
        </View>
    );
}

function RunPythonStartItem({ record }: { record: AgentHistoryRlmStart }) {
    const { theme } = useUnistyles();
    const description = record.description?.trim();
    if (!description) return null;

    return (
        <View style={styles.row}>
            <Text style={[styles.dimText, { color: theme.colors.onSurfaceVariant }]}>
                <Octicons name="cpu" size={11} color={theme.colors.onSurfaceVariant} /> {description}
            </Text>
        </View>
    );
}

/** Extracts text from a "say" tool call's args. */
function sayTextExtract(record: AgentHistoryRlmToolCall): string | null {
    if (record.toolName !== "say") return null;
    const args = record.toolArgs as { text?: string } | undefined;
    return args?.text?.trim() || null;
}

function SayItem({ record }: { record: AgentHistoryRlmToolCall }) {
    const { theme } = useUnistyles();
    const text = sayTextExtract(record);
    if (!text) return null;

    return (
        <View style={styles.sayRow}>
            <Text style={[styles.dimText, { color: theme.colors.onSurfaceVariant }]}>
                <Octicons name="comment" size={11} color={theme.colors.onSurfaceVariant} /> sent
            </Text>
            <Text style={[styles.text, { color: theme.colors.onSurface }]}>{text}</Text>
        </View>
    );
}

function NoteItem({ record }: { record: AgentHistoryNote }) {
    const { theme } = useUnistyles();
    return (
        <View style={styles.row}>
            <Text style={[styles.dimText, { color: theme.colors.onSurfaceVariant }]}># {record.text}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        paddingHorizontal: 16,
        paddingVertical: 4
    },
    userRow: {
        flexDirection: "row",
        justifyContent: "flex-end",
        paddingHorizontal: 16,
        paddingVertical: 4,
        marginTop: 8
    },
    sayRow: {
        paddingHorizontal: 16,
        paddingVertical: 4,
        marginTop: 6
    },
    userBubble: {
        maxWidth: "80%",
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 8
    },
    text: {
        fontSize: 13,
        fontFamily: "IBMPlexMono-Regular",
        lineHeight: 20
    },
    dimText: {
        fontSize: 12,
        fontFamily: "IBMPlexMono-Regular",
        lineHeight: 18,
        opacity: 0.7
    }
});
