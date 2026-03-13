import * as React from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useAuthStore } from "@/modules/auth/authContext";
import { useWorkspace } from "@/modules/workspaces/workspaceProvider";
import { TurnDetail } from "./TurnDetail";
import { TurnListItem } from "./TurnListItem";
import { useTurns, useTurnsStore } from "./turnsContext";
import type { AgentTurn } from "./turnTypes";

const TURNS_POLL_INTERVAL_MS = 3000;

export type AgentTurnsViewProps = {
    agentId: string;
};

/**
 * Two-panel turn-based history view for an agent.
 * Left panel: list of turns (most recent first).
 * Right panel: selected turn detail (records in reverse order).
 */
export function AgentTurnsView({ agentId }: AgentTurnsViewProps) {
    const { theme } = useUnistyles();
    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);
    const { workspaceId } = useWorkspace();

    const open = useTurnsStore((s) => s.open);
    const poll = useTurnsStore((s) => s.poll);
    const selectTurn = useTurnsStore((s) => s.selectTurn);

    const session = useTurns(agentId);

    // Load turns on mount
    React.useEffect(() => {
        if (baseUrl && token) {
            void open(baseUrl, token, workspaceId, agentId);
        }
    }, [baseUrl, token, workspaceId, agentId, open]);

    // Poll for updates
    React.useEffect(() => {
        if (!baseUrl || !token) return;
        const interval = setInterval(() => {
            void poll(baseUrl, token, workspaceId, agentId);
        }, TURNS_POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [baseUrl, token, workspaceId, agentId, poll]);

    const handleTurnPress = React.useCallback(
        (turnIndex: number) => {
            selectTurn(agentId, turnIndex);
        },
        [agentId, selectTurn]
    );

    // Turns reversed: most recent first
    const turnsReversed = React.useMemo(() => [...session.turns].reverse(), [session.turns]);

    const selectedTurn = React.useMemo(() => {
        if (session.selectedTurnIndex === null) return null;
        return session.turns.find((t) => t.index === session.selectedTurnIndex) ?? null;
    }, [session.turns, session.selectedTurnIndex]);

    const keyExtractor = React.useCallback((item: AgentTurn) => String(item.index), []);
    const renderItem = React.useCallback(
        ({ item }: { item: AgentTurn }) => (
            <TurnListItem turn={item} selected={item.index === session.selectedTurnIndex} onPress={handleTurnPress} />
        ),
        [session.selectedTurnIndex, handleTurnPress]
    );

    if (session.loading && session.turns.length === 0) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator color={theme.colors.primary} />
            </View>
        );
    }

    if (session.error && session.turns.length === 0) {
        return (
            <View style={styles.centered}>
                <Text style={[styles.emptyText, { color: theme.colors.error }]}>{session.error}</Text>
            </View>
        );
    }

    if (session.turns.length === 0) {
        return (
            <View style={styles.centered}>
                <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>no history yet</Text>
            </View>
        );
    }

    return (
        <View style={styles.root}>
            <View style={[styles.listPanel, { borderRightColor: theme.colors.outlineVariant }]}>
                <FlatList data={turnsReversed} keyExtractor={keyExtractor} renderItem={renderItem} />
            </View>
            <View style={styles.detailPanel}>
                {selectedTurn ? (
                    <TurnDetail turn={selectedTurn} />
                ) : (
                    <View style={styles.centered}>
                        <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>select a turn</Text>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        flexDirection: "row"
    },
    listPanel: {
        width: 280,
        borderRightWidth: 0.5
    },
    detailPanel: {
        flex: 1
    },
    centered: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 32
    },
    emptyText: {
        fontSize: 13,
        fontFamily: "IBMPlexMono-Regular"
    }
});
