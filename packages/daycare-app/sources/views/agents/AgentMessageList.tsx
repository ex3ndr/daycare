import * as React from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { AgentMessageItem } from "./AgentMessageItem";
import type { AgentHistoryRecord } from "./agentHistoryTypes";

export type AgentMessageListProps = {
    records: AgentHistoryRecord[];
    loading: boolean;
};

/** Inverted FlatList showing agent history records (newest at bottom). */
export const AgentMessageList = React.memo(({ records, loading }: AgentMessageListProps) => {
    const { theme } = useUnistyles();

    // Sort descending by `at` for inverted list (newest first in data = bottom visually)
    const sorted = React.useMemo(() => [...records].sort((a, b) => b.at - a.at), [records]);

    const keyExtractor = React.useCallback((_item: AgentHistoryRecord, index: number) => String(index), []);
    const renderItem = React.useCallback(
        ({ item }: { item: AgentHistoryRecord }) => <AgentMessageItem record={item} />,
        []
    );

    const bg = { backgroundColor: theme.colors.surfaceContainerLowest };

    if (loading && records.length === 0) {
        return (
            <View style={[styles.centered, bg]}>
                <ActivityIndicator color={theme.colors.primary} />
            </View>
        );
    }

    if (records.length === 0) {
        return (
            <View style={[styles.centered, bg]}>
                <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>waiting for input...</Text>
            </View>
        );
    }

    return (
        <FlatList
            style={bg}
            data={sorted}
            inverted
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
        />
    );
});

const styles = StyleSheet.create({
    centered: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 32
    },
    emptyText: {
        fontSize: 13,
        fontFamily: "IBMPlexMono-Regular"
    },
    listContent: {
        paddingVertical: 8
    }
});
