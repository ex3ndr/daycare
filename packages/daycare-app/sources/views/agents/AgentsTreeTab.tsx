import * as React from "react";
import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { ItemGroup } from "@/components/ItemGroup";
import { agentsTreeBuild } from "@/modules/agents/agentsTreeBuild";
import type { AgentListItem } from "@/modules/agents/agentsTypes";

type AgentsTreeTabProps = {
    agents: AgentListItem[];
};

function statItemsBuild(tree: ReturnType<typeof agentsTreeBuild>) {
    return [
        { label: "Agents", value: String(tree.nodeCount) },
        { label: "Links", value: String(tree.linkCount) },
        { label: "Roots", value: String(tree.rootCount) },
        { label: "Orphans", value: String(tree.orphanCount) }
    ];
}

/**
 * Renders a file-tree style view derived from agent path relationships.
 * Expects: agents are loaded for the active workspace.
 */
export function AgentsTreeTab({ agents }: AgentsTreeTabProps) {
    const { theme } = useUnistyles();
    const tree = React.useMemo(() => agentsTreeBuild(agents), [agents]);
    const stats = React.useMemo(() => statItemsBuild(tree), [tree]);

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
            <ItemGroup title="Tree" footer="Path-derived tree view that reads like a filesystem outline.">
                <View style={[styles.codeBlock, { backgroundColor: theme.colors.surfaceContainerLow }]}>
                    <Text selectable style={[styles.codeText, { color: theme.colors.onSurface }]}>
                        {tree.text}
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
