import * as React from "react";
import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import type {
    AgentHistoryAssistantMessage,
    AgentHistoryNote,
    AgentHistoryRecord,
    AgentHistoryRlmToolCall,
    AgentHistoryUserMessage
} from "./agentHistoryTypes";
import { extractText } from "./agentMessageItemHelpers";

/** Formats a unix-ms timestamp as HH:MM. */
function formatTime(at: number): string {
    const d = new Date(at);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export const AgentMessageItem = React.memo(({ record }: { record: AgentHistoryRecord }) => {
    switch (record.type) {
        case "user_message":
            return <UserMessageItem record={record} />;
        case "assistant_message":
            return <AssistantMessageItem record={record} />;
        case "rlm_tool_call":
            return <ToolCallItem record={record} />;
        case "note":
            return <NoteItem record={record} />;
        default:
            // rlm_start, rlm_complete, rlm_tool_result, assistant_rewrite — skip
            return null;
    }
});

function UserMessageItem({ record }: { record: AgentHistoryUserMessage }) {
    const { theme } = useUnistyles();
    return (
        <View style={styles.userContainer}>
            <View style={[styles.userBubble, { backgroundColor: theme.colors.surfaceContainerHighest }]}>
                <Text style={[styles.messageText, { color: theme.colors.onSurface }]}>{record.text}</Text>
                <Text style={[styles.timestamp, { color: theme.colors.onSurfaceVariant }]}>
                    {formatTime(record.at)}
                </Text>
            </View>
        </View>
    );
}

function AssistantMessageItem({ record }: { record: AgentHistoryAssistantMessage }) {
    const { theme } = useUnistyles();
    const text = extractText(record.content);
    if (!text) return null;
    return (
        <View style={styles.assistantContainer}>
            <Text style={[styles.messageText, { color: theme.colors.onSurface }]}>{text}</Text>
            <Text style={[styles.timestamp, { color: theme.colors.onSurfaceVariant }]}>{formatTime(record.at)}</Text>
        </View>
    );
}

function ToolCallItem({ record }: { record: AgentHistoryRlmToolCall }) {
    const { theme } = useUnistyles();
    return (
        <View style={styles.toolContainer}>
            <Text style={[styles.toolText, { color: theme.colors.onSurfaceVariant }]}>
                {record.toolName} #{record.toolCallCount}
            </Text>
        </View>
    );
}

function NoteItem({ record }: { record: AgentHistoryNote }) {
    const { theme } = useUnistyles();
    return (
        <View style={styles.noteContainer}>
            <Text style={[styles.noteText, { color: theme.colors.onSurfaceVariant }]}>{record.text}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    userContainer: {
        flexDirection: "row",
        justifyContent: "flex-end",
        paddingHorizontal: 16,
        marginBottom: 8
    },
    userBubble: {
        maxWidth: "80%",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12
    },
    assistantContainer: {
        paddingHorizontal: 16,
        marginBottom: 8,
        maxWidth: "80%"
    },
    messageText: {
        fontSize: 15,
        fontFamily: "IBMPlexSans-Regular",
        lineHeight: 22
    },
    timestamp: {
        fontSize: 11,
        fontFamily: "IBMPlexSans-Regular",
        marginTop: 4
    },
    toolContainer: {
        alignItems: "center",
        paddingVertical: 4,
        marginBottom: 4
    },
    toolText: {
        fontSize: 13,
        fontFamily: "IBMPlexMono-Regular"
    },
    noteContainer: {
        alignItems: "center",
        paddingVertical: 4,
        paddingHorizontal: 16,
        marginBottom: 4
    },
    noteText: {
        fontSize: 13,
        fontFamily: "IBMPlexSans-Regular",
        fontStyle: "italic"
    }
});
