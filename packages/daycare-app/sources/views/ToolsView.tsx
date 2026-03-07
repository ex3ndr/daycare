import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Item } from "@/components/Item";
import { ItemGroup } from "@/components/ItemGroup";
import { ItemList } from "@/components/ItemList";
import { PageHeader } from "@/components/PageHeader";
import { useAuthStore } from "@/modules/auth/authContext";
import { useToolsStore } from "@/modules/tools/toolsContext";
import { useWorkspace } from "@/modules/workspaces/workspaceProvider";

/** Counts the number of top-level parameters in a JSON Schema. */
function parameterCount(parameters: unknown): number {
    if (typeof parameters !== "object" || parameters === null) return 0;
    const props = (parameters as Record<string, unknown>).properties;
    if (typeof props !== "object" || props === null) return 0;
    return Object.keys(props).length;
}

export function ToolsView() {
    const { theme } = useUnistyles();

    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);
    const { workspaceId } = useWorkspace();

    const tools = useToolsStore((s) => s.tools);
    const loading = useToolsStore((s) => s.loading);
    const error = useToolsStore((s) => s.error);
    const fetchTools = useToolsStore((s) => s.fetch);

    useEffect(() => {
        if (baseUrl && token) {
            void fetchTools(baseUrl, token, workspaceId);
        }
    }, [baseUrl, token, workspaceId, fetchTools]);

    if (loading && tools.length === 0) {
        return (
            <View style={{ flex: 1 }}>
                <View style={[styles.centered, { flex: 1 }]}>
                    <ActivityIndicator color={theme.colors.primary} />
                </View>
            </View>
        );
    }

    if (error && tools.length === 0) {
        return (
            <View style={{ flex: 1 }}>
                <View style={[styles.centered, { flex: 1 }]}>
                    <Text style={[styles.stateText, { color: theme.colors.error }]}>{error}</Text>
                </View>
            </View>
        );
    }

    if (tools.length === 0) {
        return (
            <View style={{ flex: 1 }}>
                <View style={[styles.centered, { flex: 1 }]}>
                    <Text style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>No tools</Text>
                </View>
            </View>
        );
    }

    const sorted = [...tools].sort((a, b) => a.name.localeCompare(b.name));

    return (
        <View style={{ flex: 1 }}>
            <PageHeader title="Tools" icon="tools" />
            <ItemList>
                <ItemGroup title={`${tools.length} tools`}>
                    {sorted.map((tool, index) => {
                        const count = parameterCount(tool.parameters);
                        return (
                            <Item
                                key={tool.name}
                                title={tool.name}
                                subtitle={tool.description ?? undefined}
                                detail={count > 0 ? `${count} params` : undefined}
                                showChevron={false}
                                showDivider={index < sorted.length - 1}
                            />
                        );
                    })}
                </ItemGroup>
            </ItemList>
        </View>
    );
}

const styles = StyleSheet.create({
    centered: {
        alignItems: "center",
        justifyContent: "center",
        padding: 32
    },
    stateText: {
        fontSize: 14,
        fontFamily: "IBMPlexSans-Regular",
        textAlign: "center"
    }
});
