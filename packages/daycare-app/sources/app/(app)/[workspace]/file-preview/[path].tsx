import { Octicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import * as React from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { PageHeader } from "@/components/PageHeader";
import { WorkspaceModalWrapper } from "@/components/WorkspaceModalWrapper";
import { useAuthStore } from "@/modules/auth/authContext";
import { filesFetchPreview } from "@/modules/files/filesFetchPreview";
import { filesPathDecode } from "@/modules/files/filesPathEncode";
import type { FilePreview } from "@/modules/files/filesTypes";
import { useWorkspace } from "@/modules/workspaces/workspaceProvider";
import { filesFormatSize } from "@/views/files/filesFormatSize";
import { ImageViewer } from "@/views/files/ImageViewer";

export default function FilePreviewScreen() {
    return (
        <WorkspaceModalWrapper>
            <FilePreviewContent />
        </WorkspaceModalWrapper>
    );
}

function FilePreviewContent() {
    const { theme } = useUnistyles();
    const { path: encodedPath } = useLocalSearchParams<{ path: string }>();
    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);
    const { workspaceId } = useWorkspace();

    const filePath = encodedPath ? filesPathDecode(encodedPath) : null;
    const fileName = filePath?.split("/").pop() ?? "File";

    const [preview, setPreview] = React.useState<FilePreview | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!filePath || !baseUrl || !token) return;
        setLoading(true);
        setError(null);
        filesFetchPreview(baseUrl, token, workspaceId, filePath)
            .then((result) => {
                setPreview(result);
                setLoading(false);
            })
            .catch((err) => {
                setError(err instanceof Error ? err.message : "Failed to read file.");
                setLoading(false);
            });
    }, [filePath, baseUrl, token, workspaceId]);

    if (!filePath) return null;

    return (
        <View style={[styles.root, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.inner}>
                <PageHeader title={fileName} icon="file" />
                {loading ? (
                    <View style={styles.centered}>
                        <ActivityIndicator color={theme.colors.primary} />
                    </View>
                ) : error ? (
                    <View style={styles.centered}>
                        <Octicons name="alert" size={24} color={theme.colors.error} />
                        <Text style={[styles.stateText, { color: theme.colors.error }]}>{error}</Text>
                    </View>
                ) : !preview ? (
                    <View style={styles.centered}>
                        <Octicons name="alert" size={24} color={theme.colors.onSurfaceVariant} />
                        <Text style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
                            Unable to preview
                        </Text>
                    </View>
                ) : preview.mimeType.startsWith("image/") ? (
                    <View style={styles.body}>
                        <View style={styles.fileMeta}>
                            <Text style={[styles.metaText, { color: theme.colors.onSurfaceVariant }]}>
                                {filesFormatSize(preview.size)} &middot; {preview.mimeType}
                            </Text>
                        </View>
                        <ImageViewer uri={`data:${preview.mimeType};base64,${preview.content}`} />
                    </View>
                ) : preview.encoding === "utf8" ? (
                    <View style={styles.body}>
                        <View style={styles.fileMeta}>
                            <Text style={[styles.metaText, { color: theme.colors.onSurfaceVariant }]}>
                                {filesFormatSize(preview.size)} &middot; {preview.mimeType}
                            </Text>
                        </View>
                        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.textContent}>
                            <Text style={[styles.codeText, { color: theme.colors.onSurface }]} selectable>
                                {preview.content}
                            </Text>
                        </ScrollView>
                    </View>
                ) : (
                    <View style={styles.centered}>
                        <Octicons name="file" size={32} color={theme.colors.onSurfaceVariant} />
                        <Text style={[styles.stateText, { color: theme.colors.onSurface, marginTop: 12 }]}>
                            {preview.name}
                        </Text>
                        <Text style={[styles.metaText, { color: theme.colors.onSurfaceVariant }]}>
                            {preview.mimeType} &middot; {filesFormatSize(preview.size)}
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create((theme) => ({
    root: {
        flex: 1,
        alignItems: "center"
    },
    inner: {
        flex: 1,
        width: "100%",
        maxWidth: theme.layout.maxWidth
    },
    body: {
        flex: 1
    },
    centered: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        gap: 8
    },
    fileMeta: {
        paddingHorizontal: 20,
        paddingVertical: 8
    },
    stateText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14,
        textAlign: "center"
    },
    metaText: {
        fontSize: 13
    },
    textContent: {
        padding: 20
    },
    codeText: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 13,
        lineHeight: 20
    }
}));
