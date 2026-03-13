import * as React from "react";
import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { ItemGroup } from "@/components/ItemGroup";
import { agentsGraphBuild } from "@/modules/agents/agentsGraphBuild";
import type { AgentListItem } from "@/modules/agents/agentsTypes";

type AgentsGraphTabProps = {
    agents: AgentListItem[];
};

function statItemsBuild(graph: ReturnType<typeof agentsGraphBuild>) {
    return [
        { label: "Agents", value: String(graph.nodeCount) },
        { label: "Links", value: String(graph.edgeCount) },
        { label: "Roots", value: String(graph.rootCount) },
        { label: "Orphans", value: String(graph.orphanCount) }
    ];
}

/**
 * Renders a selectable Mermaid text block derived from agent path relationships.
 * Expects: agents are loaded for the active workspace.
 */
export function AgentsGraphTab({ agents }: AgentsGraphTabProps) {
    const { theme } = useUnistyles();
    const graph = React.useMemo(() => agentsGraphBuild(agents), [agents]);
    const stats = React.useMemo(() => statItemsBuild(graph), [graph]);

    return (
        <>
            <ItemGroup
                title="Overview"
                footer="Relationships are inferred from agent paths like /sub/0, /memory, and /search/0."
            >
                <View style={styles.statsGrid}>
                    {stats.map((item) => (
                        <View
                            key={item.label}
                            style={[styles.statCard, { backgroundColor: theme.colors.surfaceContainerLowest }]}
                        >
                            <Text style={[styles.statValue, { color: theme.colors.onSurface }]}>{item.value}</Text>
                            <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>
                                {item.label}
                            </Text>
                        </View>
                    ))}
                </View>
            </ItemGroup>
            <ItemGroup title="Mermaid" footer="Copy this block into a Mermaid renderer if you want a visual diagram.">
                <View style={[styles.codeBlock, { backgroundColor: theme.colors.surfaceContainerLow }]}>
                    <Text selectable style={[styles.codeText, { color: theme.colors.onSurface }]}>
                        {graph.mermaid}
                    </Text>
                </View>
            </ItemGroup>
        </>
    );
}

const styles = StyleSheet.create({
    statsGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
        padding: 12
    },
    statCard: {
        minWidth: 110,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12
    },
    statValue: {
        fontFamily: "IBMPlexMono-SemiBold",
        fontSize: 22,
        lineHeight: 26
    },
    statLabel: {
        marginTop: 4,
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        lineHeight: 16,
        textTransform: "uppercase",
        letterSpacing: 0.4
    },
    codeBlock: {
        margin: 12,
        borderRadius: 12,
        padding: 14
    },
    codeText: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 13,
        lineHeight: 20
    }
});
