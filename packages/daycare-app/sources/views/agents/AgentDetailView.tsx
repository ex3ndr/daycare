import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { PageHeader } from "@/components/PageHeader";
import { AgentTurnsView } from "@/modules/turns/AgentTurnsView";

/** Derives a display name from an agent id. */
function agentDisplayName(agentId: string): string {
    return `Agent ${agentId.slice(0, 8)}`;
}

export type AgentDetailViewProps = {
    agentId: string;
};

/**
 * Full-screen agent detail view: header + turn-based history.
 */
export function AgentDetailView({ agentId }: AgentDetailViewProps) {
    return (
        <View style={styles.root}>
            <PageHeader title={agentDisplayName(agentId)} icon="terminal" />
            <View style={styles.turnsContainer}>
                <AgentTurnsView agentId={agentId} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1
    },
    turnsContainer: {
        flex: 1
    }
});
