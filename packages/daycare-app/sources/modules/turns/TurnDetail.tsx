import * as React from "react";
import { FlatList } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { ChatMessageItem } from "../chat/ChatMessageItem";
import type { AgentHistoryRecord } from "../chat/chatHistoryTypes";
import type { AgentTurn } from "./turnTypes";

export type TurnDetailProps = {
    turn: AgentTurn;
};

/**
 * Shows all records in a turn in chronological order (oldest first).
 */
export const TurnDetail = React.memo(({ turn }: TurnDetailProps) => {
    const keyExtractor = React.useCallback((_item: AgentHistoryRecord, index: number) => String(index), []);
    const renderItem = React.useCallback(
        ({ item }: { item: AgentHistoryRecord }) => <ChatMessageItem record={item} />,
        []
    );

    return (
        <FlatList
            data={turn.records}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
        />
    );
});

const styles = StyleSheet.create({
    listContent: {
        paddingVertical: 12,
        gap: 2
    }
});
