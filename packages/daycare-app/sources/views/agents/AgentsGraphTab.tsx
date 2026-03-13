import { renderMermaidSVG } from "beautiful-mermaid";
import * as React from "react";
import { Platform, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import WebView from "react-native-webview";
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

function mermaidHeightEstimate(svg: string): number {
    const viewBoxMatch = svg.match(/viewBox="[^"]*?(\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
    const heightMatch = svg.match(/height="(\d+(?:\.\d+)?)"/);

    const rawHeight = Number(viewBoxMatch?.[2] ?? heightMatch?.[1] ?? 360);
    return Math.max(260, Math.min(Math.ceil(rawHeight) + 32, 720));
}

function mermaidHtmlBuild(svg: string, backgroundColor: string): string {
    return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
* { box-sizing: border-box; }
html, body {
    margin: 0;
    min-height: 100%;
    background: ${backgroundColor};
}
body {
    padding: 12px;
    overflow: auto;
}
svg {
    display: block;
    width: max-content;
    max-width: none;
    height: auto;
}
</style>
</head>
<body>${svg}</body>
</html>`;
}

function mermaidSvgRender(source: string, colors: ReturnType<typeof useUnistyles>["theme"]["colors"]) {
    try {
        const svg = renderMermaidSVG(source, {
            bg: colors.surfaceContainerLow,
            fg: colors.onSurface,
            line: colors.outline,
            accent: colors.primary,
            muted: colors.onSurfaceVariant,
            surface: colors.surfaceContainerLowest,
            border: colors.outlineVariant,
            font: "IBMPlexSans-Regular",
            padding: 24
        });

        return {
            error: null,
            html: mermaidHtmlBuild(svg, colors.surfaceContainerLow),
            height: mermaidHeightEstimate(svg)
        };
    } catch (error) {
        return {
            error: error instanceof Error ? error.message : "Failed to render Mermaid graph.",
            html: null,
            height: 0
        };
    }
}

/**
 * Renders a Mermaid diagram and its source, both derived from agent path relationships.
 * Expects: agents are loaded for the active workspace.
 */
export function AgentsGraphTab({ agents }: AgentsGraphTabProps) {
    const { theme } = useUnistyles();
    const graph = React.useMemo(() => agentsGraphBuild(agents), [agents]);
    const stats = React.useMemo(() => statItemsBuild(graph), [graph]);
    const rendered = React.useMemo(() => mermaidSvgRender(graph.mermaid, theme.colors), [graph.mermaid, theme.colors]);

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
            <ItemGroup title="Diagram" footer="Rendered with beautiful-mermaid from the same source shown below.">
                {rendered.html ? (
                    Platform.OS === "web" ? (
                        <View style={styles.diagramShell}>
                            <iframe
                                title="Agents diagram"
                                srcDoc={rendered.html}
                                sandbox="allow-same-origin"
                                style={{
                                    width: "100%",
                                    height: rendered.height,
                                    border: "none",
                                    backgroundColor: theme.colors.surfaceContainerLow
                                }}
                            />
                        </View>
                    ) : (
                        <WebView
                            originWhitelist={["*"]}
                            source={{ html: rendered.html }}
                            style={[
                                styles.diagramFrame,
                                {
                                    height: rendered.height,
                                    backgroundColor: theme.colors.surfaceContainerLow
                                }
                            ]}
                            javaScriptEnabled={false}
                            scrollEnabled={true}
                            bounces={false}
                            showsHorizontalScrollIndicator={true}
                            showsVerticalScrollIndicator={true}
                            onShouldStartLoadWithRequest={(request) => request.url.startsWith("about:")}
                        />
                    )
                ) : (
                    <View style={[styles.errorBlock, { backgroundColor: theme.colors.surfaceContainerLow }]}>
                        <Text style={[styles.errorText, { color: theme.colors.error }]}>{rendered.error}</Text>
                    </View>
                )}
            </ItemGroup>
            <ItemGroup title="Mermaid Source" footer="Path-derived Mermaid source for inspection and copy/paste.">
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
    diagramShell: {
        margin: 12,
        borderRadius: 12,
        overflow: "hidden"
    },
    diagramFrame: {
        margin: 12,
        borderRadius: 12
    },
    errorBlock: {
        margin: 12,
        borderRadius: 12,
        padding: 14
    },
    errorText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 18
    },
    codeText: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 13,
        lineHeight: 20
    }
});
