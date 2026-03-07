import { Octicons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import * as React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Item } from "@/components/Item";
import { ItemGroup } from "@/components/ItemGroup";
import { ItemList } from "@/components/ItemList";
import { PageHeader } from "@/components/PageHeader";
import { useAuthStore } from "@/modules/auth/authContext";
import { useFilesStore } from "@/modules/files/filesContext";
import { filesFetchDir } from "@/modules/files/filesFetchDir";
import { filesPathEncode } from "@/modules/files/filesPathEncode";
import type { FileEntry } from "@/modules/files/filesTypes";
import { useWorkspace } from "@/modules/workspaces/workspaceProvider";
import { FilesBreadcrumb } from "./FilesBreadcrumb";
import { filesFormatSize } from "./filesFormatSize";

type FilesViewProps = {
    dirPath?: string;
};

/**
 * Main file browser view. Shows base directory roots when no dirPath,
 * or directory listing with breadcrumb navigation when browsing.
 * Uses Expo Router for navigation instead of zustand state.
 */
export const FilesView = React.memo<FilesViewProps>(({ dirPath }) => {
    const { theme } = useUnistyles();
    const router = useRouter();
    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);
    const { workspaceId, loaded } = useWorkspace();

    const roots = useFilesStore((s) => s.roots);
    const rootsLoading = useFilesStore((s) => s.loading);
    const rootsError = useFilesStore((s) => s.error);
    const fetchRoots = useFilesStore((s) => s.fetchRoots);

    // Local state for directory listing
    const [entries, setEntries] = React.useState<FileEntry[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    // Fetch roots on mount
    React.useEffect(() => {
        if (baseUrl && token && loaded) {
            void fetchRoots(baseUrl, token, workspaceId);
        }
    }, [baseUrl, token, workspaceId, loaded, fetchRoots]);

    // Fetch directory entries when dirPath changes
    React.useEffect(() => {
        if (!dirPath || !baseUrl || !token || !loaded) return;
        setLoading(true);
        setError(null);
        filesFetchDir(baseUrl, token, workspaceId, dirPath)
            .then((result) => {
                setEntries(result);
                setLoading(false);
            })
            .catch((err) => {
                setError(err instanceof Error ? err.message : "Failed to list directory.");
                setLoading(false);
            });
    }, [dirPath, baseUrl, token, workspaceId, loaded]);

    const wsPrefix = workspaceId ? `/${workspaceId}` : "";

    const handleRootPress = React.useCallback(
        (rootPath: string) => {
            router.push(`${wsPrefix}/files/${filesPathEncode(rootPath)}` as Href);
        },
        [router, wsPrefix]
    );

    const handleEntryPress = React.useCallback(
        (entryName: string, entryType: string) => {
            if (!dirPath) return;
            const newPath = `${dirPath}/${entryName}`;
            if (entryType === "directory") {
                router.push(`${wsPrefix}/files/${filesPathEncode(newPath)}` as Href);
            } else {
                router.push(`${wsPrefix}/file-preview/${filesPathEncode(newPath)}` as Href);
            }
        },
        [dirPath, router, wsPrefix]
    );

    const handleBreadcrumbNavigate = React.useCallback(
        (segmentPath: string | null) => {
            if (segmentPath === null) {
                router.push(`${wsPrefix}/files` as Href);
                return;
            }
            router.push(`${wsPrefix}/files/${filesPathEncode(segmentPath)}` as Href);
        },
        [router, wsPrefix]
    );

    // Roots view (no path selected)
    if (!dirPath) {
        return (
            <View style={styles.root}>
                <PageHeader title="Files" icon="file-directory" />
                {rootsLoading ? (
                    <View style={styles.centered}>
                        <ActivityIndicator color={theme.colors.primary} />
                    </View>
                ) : rootsError ? (
                    <View style={styles.centered}>
                        <Octicons name="alert" size={24} color={theme.colors.error} />
                        <Text style={[styles.errorText, { color: theme.colors.error }]}>{rootsError}</Text>
                    </View>
                ) : (
                    <ItemList>
                        <ItemGroup title="Directories">
                            {roots.map((root) => (
                                <Item
                                    key={root.id}
                                    title={root.label}
                                    icon={<Octicons name="file-directory" size={20} color={theme.colors.primary} />}
                                    onPress={() => handleRootPress(root.path)}
                                />
                            ))}
                        </ItemGroup>
                    </ItemList>
                )}
            </View>
        );
    }

    // Directory listing view
    return (
        <View style={styles.root}>
            <PageHeader title="Files" icon="file-directory" />
            <FilesBreadcrumb path={dirPath} onNavigate={handleBreadcrumbNavigate} />
            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator color={theme.colors.primary} />
                </View>
            ) : error ? (
                <View style={styles.centered}>
                    <Octicons name="alert" size={24} color={theme.colors.error} />
                    <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
                </View>
            ) : entries.length === 0 ? (
                <View style={styles.centered}>
                    <Octicons name="file-directory" size={32} color={theme.colors.onSurfaceVariant} />
                    <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>Empty directory</Text>
                </View>
            ) : (
                <ItemList>
                    <ItemGroup title={`${entries.length} item${entries.length !== 1 ? "s" : ""}`}>
                        {entries.map((entry) => (
                            <Item
                                key={entry.name}
                                title={entry.name}
                                subtitle={entry.type === "file" ? filesFormatSize(entry.size) : undefined}
                                icon={
                                    <Octicons
                                        name={entry.type === "directory" ? "file-directory" : "file"}
                                        size={20}
                                        color={
                                            entry.type === "directory"
                                                ? theme.colors.primary
                                                : theme.colors.onSurfaceVariant
                                        }
                                    />
                                }
                                onPress={() => handleEntryPress(entry.name, entry.type)}
                            />
                        ))}
                    </ItemGroup>
                </ItemList>
            )}
        </View>
    );
});

const styles = StyleSheet.create({
    root: {
        flex: 1
    },
    centered: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 32,
        gap: 8
    },
    errorText: {
        fontSize: 14,
        textAlign: "center"
    },
    emptyText: {
        fontSize: 14
    }
});
