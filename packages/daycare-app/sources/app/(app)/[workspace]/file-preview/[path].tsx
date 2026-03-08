import { useLocalSearchParams } from "expo-router";
import * as React from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useAuthStore } from "@/modules/auth/authContext";
import { filesFetchPreview } from "@/modules/files/filesFetchPreview";
import { filesPathDecode } from "@/modules/files/filesPathEncode";
import type { FilePreview } from "@/modules/files/filesTypes";

export default function FilePreviewModalScreen() {
    const { theme } = useUnistyles();
    const { workspace, path: encodedPath } = useLocalSearchParams<{ workspace: string; path: string }>();

    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);

    const filePath = encodedPath ? filesPathDecode(encodedPath) : null;

    const [preview, setPreview] = React.useState<FilePreview | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!filePath || !baseUrl || !token) return;
        setLoading(true);
        setError(null);
        filesFetchPreview(baseUrl, token, workspace, filePath)
            .then((result) => {
                setPreview(result);
                setLoading(false);
            })
            .catch((err) => {
                setError(err instanceof Error ? err.message : "Failed to load file.");
                setLoading(false);
            });
    }, [filePath, baseUrl, token, workspace]);

    return (
        <View style={[styles.root, { backgroundColor: theme.colors.surface }]}>
            {filePath && (
                <View style={[styles.header, { borderBottomColor: theme.colors.outlineVariant }]}>
                    <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]} numberOfLines={1}>
                        {filePath.split("/").pop()}
                    </Text>
                    <Text style={[styles.headerPath, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
                        {filePath}
                    </Text>
                </View>
            )}

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator color={theme.colors.primary} />
                </View>
            ) : error ? (
                <View style={styles.centered}>
                    <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
                </View>
            ) : preview ? (
                <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
                    <View
                        style={[
                            styles.codeBlock,
                            {
                                backgroundColor: theme.colors.surfaceContainerHighest,
                                borderColor: theme.colors.outlineVariant
                            }
                        ]}
                    >
                        <Text style={[styles.code, { color: theme.colors.onSurface }]}>{preview.content}</Text>
                    </View>
                </ScrollView>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1
    },
    header: {
        padding: 16,
        borderBottomWidth: 1
    },
    headerTitle: {
        fontSize: 16,
        fontFamily: "IBMPlexSans-SemiBold",
        fontWeight: "600"
    },
    headerPath: {
        fontSize: 12,
        fontFamily: "IBMPlexSans-Regular",
        marginTop: 2
    },
    centered: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 20
    },
    errorText: {
        fontSize: 14,
        fontFamily: "IBMPlexSans-Regular",
        textAlign: "center"
    },
    body: {
        flex: 1
    },
    bodyContent: {
        padding: 16
    },
    codeBlock: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12
    },
    code: {
        fontSize: 12,
        fontFamily: "monospace",
        lineHeight: 18
    }
});
