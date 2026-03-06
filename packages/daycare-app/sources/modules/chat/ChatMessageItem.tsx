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
            return <ToolCallItem record={record} />;
        case "note":
            return <NoteItem record={record} />;
        default:
            return null;
    }
});

function UserMessageItem({ record }: { record: AgentHistoryUserMessage }) {
    const { theme } = useUnistyles();
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

function ToolCallItem({ record }: { record: AgentHistoryRlmToolCall }) {
    const { theme } = useUnistyles();
    return (
        <View style={styles.row}>
            <Text style={[styles.text, { color: theme.colors.onSurfaceVariant }]}>
                [{record.toolName} #{record.toolCallCount}]
            </Text>
        </View>
    );
}

function RunPythonStartItem({ record }: { record: AgentHistoryRlmStart }) {
    const { theme } = useUnistyles();
    if (!record.description?.trim()) {
        return null;
    }
    return (
        <View style={styles.row}>
            <Text style={[styles.text, { color: theme.colors.onSurfaceVariant }]}>
                [run_python] {record.description}
            </Text>
        </View>
    );
}

function NoteItem({ record }: { record: AgentHistoryNote }) {
    const { theme } = useUnistyles();
    return (
        <View style={styles.row}>
            <Text style={[styles.text, styles.noteText, { color: theme.colors.onSurfaceVariant }]}>
                # {record.text}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        paddingHorizontal: 16,
        paddingVertical: 2
    },
    userRow: {
        flexDirection: "row",
        justifyContent: "flex-end",
        paddingHorizontal: 16,
        paddingVertical: 2
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
    noteText: {
        fontStyle: "italic"
    }
});
