import { Octicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import { documentDiffCompute } from "@/modules/documents/documentDiffCompute";
import type { DocumentVersion } from "@/modules/documents/documentsTypes";

type DocumentHistoryPanelProps = {
    versions: DocumentVersion[];
    loading: boolean;
};

/**
 * Displays document version history with dates and inline diffs.
 * Each version shows its timestamp and can be expanded to see the diff against the previous version.
 *
 * Expects: versions are sorted by version descending (newest first).
 */
export const DocumentHistoryPanel = React.memo<DocumentHistoryPanelProps>(({ versions, loading }) => {
    const { theme } = useUnistyles();
    const [expandedVersion, setExpandedVersion] = React.useState<number | null>(null);

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
                <Text style={{ fontSize: 14, color: theme.colors.onSurfaceVariant }}>Loading history...</Text>
            </View>
        );
    }

    if (versions.length === 0) {
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
                <Text style={{ fontSize: 14, color: theme.colors.onSurfaceVariant }}>No history available.</Text>
            </View>
        );
    }

    return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
            {versions.map((version, index) => {
                const prevVersion = index < versions.length - 1 ? versions[index + 1] : null;
                const isExpanded = expandedVersion === version.version;
                const isFirst = index === versions.length - 1;

                return (
                    <View
                        key={version.version}
                        style={{
                            marginBottom: 12,
                            borderWidth: 1,
                            borderColor: theme.colors.outlineVariant,
                            borderRadius: 8,
                            overflow: "hidden"
                        }}
                    >
                        <Pressable
                            onPress={() => setExpandedVersion(isExpanded ? null : version.version)}
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                padding: 12,
                                backgroundColor: isExpanded ? theme.colors.surfaceContainerHigh : theme.colors.surface
                            }}
                        >
                            <Octicons
                                name={isExpanded ? "chevron-down" : "chevron-right"}
                                size={14}
                                color={theme.colors.onSurfaceVariant}
                            />
                            <View style={{ flex: 1, marginLeft: 8 }}>
                                <Text
                                    style={{
                                        fontSize: 14,
                                        fontWeight: "600",
                                        color: theme.colors.onSurface
                                    }}
                                >
                                    Version {version.version}
                                    {index === 0 ? " (current)" : ""}
                                </Text>
                                <Text
                                    style={{
                                        fontSize: 12,
                                        color: theme.colors.onSurfaceVariant,
                                        marginTop: 2
                                    }}
                                >
                                    {new Date(version.validFrom).toLocaleString()}
                                </Text>
                            </View>
                            {version.title !== prevVersion?.title && prevVersion && (
                                <View
                                    style={{
                                        backgroundColor: `${theme.colors.primary}20`,
                                        paddingHorizontal: 6,
                                        paddingVertical: 2,
                                        borderRadius: 4,
                                        marginLeft: 8
                                    }}
                                >
                                    <Text style={{ fontSize: 11, color: theme.colors.primary }}>title changed</Text>
                                </View>
                            )}
                        </Pressable>

                        {isExpanded && (
                            <View
                                style={{
                                    borderTopWidth: 1,
                                    borderTopColor: theme.colors.outlineVariant,
                                    padding: 12
                                }}
                            >
                                {isFirst ? (
                                    <Text style={{ fontSize: 13, color: theme.colors.onSurfaceVariant }}>
                                        Initial version created.
                                    </Text>
                                ) : (
                                    <DiffView
                                        oldBody={prevVersion?.body ?? ""}
                                        newBody={version.body}
                                        oldTitle={prevVersion?.title ?? ""}
                                        newTitle={version.title}
                                    />
                                )}
                            </View>
                        )}
                    </View>
                );
            })}
        </ScrollView>
    );
});

type DiffViewProps = {
    oldBody: string;
    newBody: string;
    oldTitle: string;
    newTitle: string;
};

/**
 * Renders a side-by-side diff of title and body changes between versions.
 */
const DiffView = React.memo<DiffViewProps>(({ oldBody, newBody, oldTitle, newTitle }) => {
    const { theme } = useUnistyles();

    const titleChanged = oldTitle !== newTitle;
    const bodyDiff = React.useMemo(() => documentDiffCompute(oldBody, newBody), [oldBody, newBody]);
    const hasBodyChanges = bodyDiff.some((line) => line.type !== "unchanged");

    return (
        <View>
            {titleChanged && (
                <View style={{ marginBottom: 12 }}>
                    <Text
                        style={{
                            fontSize: 12,
                            fontWeight: "600",
                            color: theme.colors.onSurfaceVariant,
                            marginBottom: 4
                        }}
                    >
                        TITLE
                    </Text>
                    <View
                        style={{
                            backgroundColor: "#ffebe9",
                            padding: 6,
                            borderRadius: 4,
                            marginBottom: 2
                        }}
                    >
                        <Text style={{ fontSize: 13, fontFamily: "monospace", color: "#82071e" }}>- {oldTitle}</Text>
                    </View>
                    <View
                        style={{
                            backgroundColor: "#dafbe1",
                            padding: 6,
                            borderRadius: 4
                        }}
                    >
                        <Text style={{ fontSize: 13, fontFamily: "monospace", color: "#116329" }}>+ {newTitle}</Text>
                    </View>
                </View>
            )}

            {hasBodyChanges ? (
                <View>
                    <Text
                        style={{
                            fontSize: 12,
                            fontWeight: "600",
                            color: theme.colors.onSurfaceVariant,
                            marginBottom: 4
                        }}
                    >
                        BODY
                    </Text>
                    <View
                        style={{
                            borderWidth: 1,
                            borderColor: theme.colors.outlineVariant,
                            borderRadius: 4,
                            overflow: "hidden"
                        }}
                    >
                        {bodyDiff.map((line, i) => {
                            if (line.type === "unchanged") return null;
                            const isAdded = line.type === "added";
                            return (
                                <View
                                    key={`${i}-${line.type}`}
                                    style={{
                                        backgroundColor: isAdded ? "#dafbe1" : "#ffebe9",
                                        paddingHorizontal: 8,
                                        paddingVertical: 2,
                                        borderBottomWidth: 1,
                                        borderBottomColor: theme.colors.outlineVariant
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 12,
                                            fontFamily: "monospace",
                                            color: isAdded ? "#116329" : "#82071e"
                                        }}
                                    >
                                        {isAdded ? "+" : "-"} {line.text}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                </View>
            ) : (
                <Text style={{ fontSize: 13, color: theme.colors.onSurfaceVariant }}>
                    No body changes in this version.
                </Text>
            )}
        </View>
    );
});
