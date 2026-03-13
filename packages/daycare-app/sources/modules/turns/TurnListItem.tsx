import { Octicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import type { AgentTurn } from "./turnTypes";

export type TurnListItemProps = {
    turn: AgentTurn;
    selected: boolean;
    onPress: (turnIndex: number) => void;
};

/** Formats a unix timestamp into a short time string. */
function timeFormat(at: number): string {
    const date = new Date(at);
    const now = new Date();
    const isToday =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();

    if (isToday) {
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

/** Truncates preview text to a single line. */
function previewTruncate(text: string): string {
    const firstLine = text.split("\n")[0] ?? "";
    return firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine;
}

export const TurnListItem = React.memo(({ turn, selected, onPress }: TurnListItemProps) => {
    const { theme } = useUnistyles();
    const handlePress = React.useCallback(() => onPress(turn.index), [onPress, turn.index]);

    const preview = turn.preview ? previewTruncate(turn.preview) : "(system)";
    const recordCount = turn.records.length;

    return (
        <Pressable
            onPress={handlePress}
            style={[styles.root, selected && { backgroundColor: theme.colors.surfaceContainerHigh }]}
        >
            <View style={styles.header}>
                <Text style={[styles.time, { color: theme.colors.onSurfaceVariant }]}>
                    {timeFormat(turn.startedAt)}
                </Text>
                <Text style={[styles.badge, { color: theme.colors.onSurfaceVariant }]}>
                    <Octicons name="history" size={10} color={theme.colors.onSurfaceVariant} /> {recordCount}
                </Text>
            </View>
            <Text style={[styles.preview, { color: theme.colors.onSurface }]} numberOfLines={2}>
                {preview}
            </Text>
        </Pressable>
    );
});

const styles = StyleSheet.create({
    root: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: "rgba(128,128,128,0.15)"
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 4
    },
    time: {
        fontSize: 11,
        fontFamily: "IBMPlexMono-Regular"
    },
    badge: {
        fontSize: 11,
        fontFamily: "IBMPlexMono-Regular"
    },
    preview: {
        fontSize: 13,
        fontFamily: "IBMPlexMono-Regular",
        lineHeight: 18
    }
});
