import { Octicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as React from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useFilesStore } from "@/modules/files/filesContext";
import { filesFormatSize } from "./filesFormatSize";

/**
 * Right panel showing file preview content.
 * Renders text for text/* mime types, images for image/* types,
 * or basic file info for unsupported types.
 */
export const FilePreviewPanel = React.memo(() => {
    const { theme } = useUnistyles();
    const preview = useFilesStore((s) => s.preview);
    const previewLoading = useFilesStore((s) => s.previewLoading);
    const selectedFile = useFilesStore((s) => s.selectedFile);

    if (!selectedFile) {
        return null;
    }

    if (previewLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator color={theme.colors.primary} />
            </View>
        );
    }

    if (!preview) {
        return (
            <View style={styles.centered}>
                <Octicons name="alert" size={24} color={theme.colors.onSurfaceVariant} />
                <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>Unable to preview</Text>
            </View>
        );
    }

    // Image preview
    if (preview.mimeType.startsWith("image/")) {
        return (
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                <View style={styles.header}>
                    <Text style={[styles.name, { color: theme.colors.onSurface }]} numberOfLines={1}>
                        {preview.name}
                    </Text>
                    <Text style={[styles.meta, { color: theme.colors.onSurfaceVariant }]}>
                        {filesFormatSize(preview.size)} &middot; {preview.mimeType}
                    </Text>
                </View>
                <Image
                    source={{ uri: `data:${preview.mimeType};base64,${preview.content}` }}
                    style={styles.image}
                    contentFit="contain"
                />
            </ScrollView>
        );
    }

    // Text preview
    if (preview.encoding === "utf8") {
        return (
            <View style={styles.container}>
                <View style={[styles.header, styles.content]}>
                    <Text style={[styles.name, { color: theme.colors.onSurface }]} numberOfLines={1}>
                        {preview.name}
                    </Text>
                    <Text style={[styles.meta, { color: theme.colors.onSurfaceVariant }]}>
                        {filesFormatSize(preview.size)} &middot; {preview.mimeType}
                    </Text>
                </View>
                <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.textContent}>
                    <Text style={[styles.codeText, { color: theme.colors.onSurface }]} selectable>
                        {preview.content}
                    </Text>
                </ScrollView>
            </View>
        );
    }

    // Fallback: file info only
    return (
        <View style={styles.centered}>
            <Octicons name="file" size={32} color={theme.colors.onSurfaceVariant} />
            <Text style={[styles.name, { color: theme.colors.onSurface, marginTop: 12 }]}>{preview.name}</Text>
            <Text style={[styles.meta, { color: theme.colors.onSurfaceVariant }]}>
                {preview.mimeType} &middot; {filesFormatSize(preview.size)}
            </Text>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    content: {
        padding: 16
    },
    centered: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 32,
        gap: 8
    },
    header: {
        gap: 4
    },
    name: {
        fontSize: 16,
        fontWeight: "600"
    },
    meta: {
        fontSize: 13
    },
    emptyText: {
        fontSize: 14
    },
    image: {
        width: "100%",
        aspectRatio: 1,
        marginTop: 16,
        borderRadius: 8
    },
    textContent: {
        padding: 16
    },
    codeText: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 13,
        lineHeight: 20
    }
});
