import * as React from "react";
import { FlatList, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { ChatMessageItem } from "../chat/ChatMessageItem";
import type { AgentHistoryRecord } from "../chat/chatHistoryTypes";
import type { AgentTurn } from "./turnTypes";

export type TurnDetailProps = {
    turn: AgentTurn;
};

/**
 * Shows all records in a turn, newest first (reverse chronological).
 */
export const TurnDetail = React.memo(({ turn }: TurnDetailProps) => {
    const { theme } = useUnistyles();

    // Reverse: newest records at top
    const reversed = React.useMemo(() => [...turn.records].reverse(), [turn.records]);

    const keyExtractor = React.useCallback((_item: AgentHistoryRecord, index: number) => String(index), []);
    const renderItem = React.useCallback(
        ({ item }: { item: AgentHistoryRecord }) => <ChatMessageItem record={item} />,
        []
    );

    return (
        <View style={styles.root}>
            <View style={styles.header}>
                <Text style={[styles.headerText, { color: theme.colors.onSurfaceVariant }]}>Turn {turn.index + 1}</Text>
            </View>
            <FlatList
                data={reversed}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
            />
        </View>
    );
});

const styles = StyleSheet.create({
    root: {
        flex: 1
    },
    header: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 0.5,
        borderBottomColor: "rgba(128,128,128,0.15)"
    },
    headerText: {
        fontSize: 12,
        fontFamily: "IBMPlexMono-Regular"
    },
    listContent: {
        paddingVertical: 12,
        gap: 2
    }
});
