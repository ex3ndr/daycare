import { Octicons } from "@expo/vector-icons";
import * as React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Item } from "@/components/Item";
import { ItemGroup } from "@/components/ItemGroup";
import { ItemList } from "@/components/ItemList";
import { PageHeader } from "@/components/PageHeader";
import { useAuthStore } from "@/modules/auth/authContext";
import { useFilesStore } from "@/modules/files/filesContext";
import { FilesBreadcrumb } from "./FilesBreadcrumb";
import { filesFormatSize } from "./filesFormatSize";

/**
 * Main file browser view. Shows base directory roots when no path is selected,
 * or directory listing with breadcrumb navigation when browsing.
 */
export const FilesView = React.memo(() => {
    const { theme } = useUnistyles();
    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);

    const roots = useFilesStore((s) => s.roots);
    const currentPath = useFilesStore((s) => s.currentPath);
    const entries = useFilesStore((s) => s.entries);
    const loading = useFilesStore((s) => s.loading);
    const error = useFilesStore((s) => s.error);
    const fetchRoots = useFilesStore((s) => s.fetchRoots);
    const navigateTo = useFilesStore((s) => s.navigateTo);
    const selectFile = useFilesStore((s) => s.selectFile);
    const goHome = useFilesStore((s) => s.goHome);

    // Fetch roots on mount
    React.useEffect(() => {
        if (baseUrl && token) {
            void fetchRoots(baseUrl, token);
        }
    }, [baseUrl, token, fetchRoots]);

    const handleRootPress = React.useCallback(
        (rootPath: string) => {
            if (!baseUrl || !token) return;
            void navigateTo(baseUrl, token, rootPath);
        },
        [baseUrl, token, navigateTo]
    );

    const handleEntryPress = React.useCallback(
        (entryName: string, entryType: string) => {
            if (!baseUrl || !token || !currentPath) return;
            const newPath = `${currentPath}/${entryName}`;
            if (entryType === "directory") {
                void navigateTo(baseUrl, token, newPath);
            } else {
                void selectFile(baseUrl, token, newPath);
            }
        },
        [baseUrl, token, currentPath, navigateTo, selectFile]
    );

    const handleBreadcrumbNavigate = React.useCallback(
        (segmentPath: string | null) => {
            if (segmentPath === null) {
                goHome();
                return;
            }
            if (!baseUrl || !token) return;
            void navigateTo(baseUrl, token, segmentPath);
        },
        [baseUrl, token, navigateTo, goHome]
    );

    // Roots view (no path selected)
    if (!currentPath) {
        return (
            <View style={styles.root}>
                <PageHeader title="Files" icon="file-directory" />
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
            </View>
        );
    }

    // Directory listing view
    return (
        <View style={styles.root}>
            <PageHeader title="Files" icon="file-directory" />
            <FilesBreadcrumb path={currentPath} onNavigate={handleBreadcrumbNavigate} />
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
