import { Octicons } from "@expo/vector-icons";
import { createId } from "@paralleldrive/cuid2";
import { Image } from "expo-image";
import { usePathname, useRouter } from "expo-router";
import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { type SharedValue, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { type AppMode, appModes } from "@/components/AppHeader";

import { useAuthStore } from "@/modules/auth/authContext";
import { documentRootIdResolve } from "@/modules/documents/documentRootIdResolve";
import { useDocumentsStore } from "@/modules/documents/documentsContext";
import { DocumentCreateDialog } from "@/views/documents/DocumentCreateDialog";

export const SIDEBAR_WIDTH = 240;
export const SIDEBAR_COLLAPSED_WIDTH = 56;

type Segment = { mode: AppMode; icon: React.ComponentProps<typeof Octicons>["name"]; label: string };

/** Sidebar items grouped with visual spacing between groups. */
const segmentGroups: Segment[][] = [
    [{ mode: "home", icon: "home", label: "Home" }],
    [
        { mode: "todos", icon: "checklist", label: "Todos" },
        { mode: "documents", icon: "file", label: "Documents" }
    ],
    [
        { mode: "agents", icon: "device-desktop", label: "Agents" },
        { mode: "fragments", icon: "note", label: "Fragments" },
        { mode: "routines", icon: "clock", label: "Routines" },
        { mode: "skills", icon: "zap", label: "Skills" },
        { mode: "tools", icon: "tools", label: "Tools" },
        { mode: "costs", icon: "credit-card", label: "Costs" }
    ]
];

/** Bottom-pinned items outside the scrollable area. */
const bottomSegments: Segment[] = [
    { mode: "dev", icon: "code-square", label: "Dev" },
    { mode: "settings", icon: "gear", label: "Settings" }
];

/** Sub-items for each mode that expand when the mode is active. */
const modeItems: Record<AppMode, Array<{ id: string; title: string }>> = {
    home: [],
    agents: [],
    fragments: [],
    todos: [],
    routines: [],
    costs: [],
    documents: [],
    skills: [],
    tools: [],
    dev: [
        { id: "components", title: "Components" },
        { id: "examples", title: "Examples" },
        { id: "showcase", title: "Showcase" },
        { id: "lottie", title: "Lottie" },
        { id: "monty", title: "Monty" }
    ],
    settings: []
};

/**
 * Extracts the current AppMode from the pathname.
 * E.g. "/agents" -> "agents", "/agents/a1" -> "agents".
 */
function extractModeFromPath(pathname: string): AppMode {
    const segment = pathname.split("/").filter(Boolean)[0];
    if (segment && appModes.includes(segment as AppMode)) {
        return segment as AppMode;
    }
    return "home";
}

/**
 * Extracts the selected item id from the pathname.
 * E.g. "/agents/a1" -> "a1", "/agents" -> undefined.
 */
function extractItemFromPath(pathname: string): string | undefined {
    const parts = pathname.split("/").filter(Boolean);
    return parts.length >= 2 ? parts[1] : undefined;
}

type AppSidebarProps = {
    /** Called after any navigation action (e.g. to close a drawer). */
    onNavigate?: () => void;
    /** Called when the user toggles the collapsed state. */
    onToggleCollapse?: () => void;
    /** Animated opacity for labels/text (fades out when collapsing). */
    labelsOpacity?: SharedValue<number>;
    /** Animated sidebar width (used to size active row backgrounds). */
    sidebarWidth?: SharedValue<number>;
    /** Whether the sidebar is currently collapsed. */
    collapsed?: boolean;
};

/**
 * Tree-style sidebar navigation.
 * Always renders at full SIDEBAR_WIDTH; parent clips via overflow: hidden + animated width.
 */
export const AppSidebar = React.memo<AppSidebarProps>(
    ({ onNavigate, onToggleCollapse, labelsOpacity, sidebarWidth, collapsed }) => {
        const { theme } = useUnistyles();

        const labelsAnimatedStyle = useAnimatedStyle(() => ({
            opacity: labelsOpacity ? labelsOpacity.value : 1
        }));
        // Active row background width: sidebar width minus treeContainer horizontal padding (8*2)
        const activeRowBgStyle = useAnimatedStyle(() => ({
            width: sidebarWidth ? sidebarWidth.value - 16 : SIDEBAR_WIDTH - 16
        }));
        // Collapse button: right-aligned, animates position with sidebar width
        const headerHovered = useSharedValue(0);
        const collapseButtonStyle = useAnimatedStyle(() => {
            const labels = labelsOpacity ? labelsOpacity.value : 1;
            const sw = sidebarWidth ? sidebarWidth.value : SIDEBAR_WIDTH;
            return {
                left: sw - 40,
                opacity: Math.max(labels, headerHovered.value)
            };
        });
        const expandedIconStyle = useAnimatedStyle(() => ({
            opacity: labelsOpacity ? labelsOpacity.value : 1
        }));
        const collapsedIconStyle = useAnimatedStyle(() => ({
            opacity: labelsOpacity ? 1 - labelsOpacity.value : 0
        }));

        const pathname = usePathname();
        const router = useRouter();

        const activeMode = extractModeFromPath(pathname);
        const selectedItem = extractItemFromPath(pathname);

        // Documents store
        const baseUrl = useAuthStore((s) => s.baseUrl);
        const token = useAuthStore((s) => s.token);
        const documents = useDocumentsStore((s) => s.items);
        const fetchDocuments = useDocumentsStore((s) => s.fetch);
        const createDocument = useDocumentsStore((s) => s.createDocument);
        const documentsSelected = useDocumentsStore((s) => s.selectedId);
        const selectDocument = useDocumentsStore((s) => s.select);

        const [createDialogVisible, setCreateDialogVisible] = React.useState(false);

        // Fetch documents when the documents mode is active
        React.useEffect(() => {
            if (activeMode === "documents" && baseUrl && token) {
                void fetchDocuments(baseUrl, token);
            }
        }, [activeMode, baseUrl, token, fetchDocuments]);

        // Documents under ~/document (children of the root "document" folder)
        const documentRootId = React.useMemo(() => documentRootIdResolve(documents), [documents]);

        const sidebarDocs = React.useMemo(() => {
            if (!documentRootId) return [];
            return documents
                .filter((d) => d.parentId === documentRootId)
                .sort((a, b) => a.title.localeCompare(b.title));
        }, [documents, documentRootId]);

        const handleModePress = React.useCallback(
            (mode: AppMode) => {
                router.replace(`/${mode}` as `/${string}`);
                onNavigate?.();
            },
            [router, onNavigate]
        );

        const handleItemPress = React.useCallback(
            (mode: AppMode, itemId: string) => {
                router.replace(`/${mode}/${itemId}` as `/${string}`);
                onNavigate?.();
            },
            [router, onNavigate]
        );

        const handleDocumentPress = React.useCallback(
            (docId: string) => {
                selectDocument(docId);
                router.replace("/documents" as `/${string}`);
                onNavigate?.();
            },
            [selectDocument, router, onNavigate]
        );

        const handleCreateDocument = React.useCallback(
            (input: { title: string; slug: string; parentId: string | null }) => {
                if (!baseUrl || !token) return;
                const parentId = input.parentId ?? documentRootId;
                if (!parentId) return;
                void createDocument(baseUrl, token, { id: createId(), title: input.title, slug: input.slug, parentId });
            },
            [baseUrl, token, createDocument, documentRootId]
        );

        return (
            <View style={[styles.sidebar, { backgroundColor: theme.colors.surface }]}>
                {/* Logo header — entire row is pressable to toggle collapse */}
                <Pressable
                    onPress={onToggleCollapse}
                    style={styles.header}
                    onHoverIn={() => (headerHovered.value = withTiming(1, { duration: 150 }))}
                    onHoverOut={() => (headerHovered.value = withTiming(0, { duration: 150 }))}
                >
                    <Image
                        source={
                            theme.dark
                                ? require("@/assets/images/logo-white.png")
                                : require("@/assets/images/logo-black.png")
                        }
                        style={{ width: 20, height: 20 }}
                        contentFit="contain"
                    />
                    <Animated.View style={[styles.headerLabels, labelsAnimatedStyle]}>
                        <Text style={[styles.title, { color: theme.colors.onSurface }]}>Daycare</Text>
                    </Animated.View>
                    <Animated.View
                        style={[styles.collapseButton, { backgroundColor: theme.colors.surface }, collapseButtonStyle]}
                        pointerEvents="none"
                    >
                        <Animated.View style={[styles.collapseIcon, expandedIconStyle]}>
                            <Octicons name="sidebar-expand" size={16} color={theme.colors.onSurfaceVariant} />
                        </Animated.View>
                        <Animated.View style={[styles.collapseIcon, collapsedIconStyle]}>
                            <Octicons name="sidebar-collapse" size={16} color={theme.colors.onSurfaceVariant} />
                        </Animated.View>
                    </Animated.View>
                </Pressable>

                {/* Tree navigation */}
                <ScrollView style={styles.treeContainer} showsVerticalScrollIndicator={false}>
                    {segmentGroups.map((group, groupIndex) => (
                        <View
                            key={group.map((s) => s.mode).join("-")}
                            style={groupIndex > 0 ? styles.groupSpacer : undefined}
                        >
                            {group.map((seg) => {
                                const isActive = activeMode === seg.mode;
                                const isDocumentsMode = seg.mode === "documents";
                                const items = modeItems[seg.mode];
                                const hasStaticItems = items.length > 0;
                                const hasItems = hasStaticItems || (isDocumentsMode && isActive);

                                return (
                                    <View key={seg.mode}>
                                        <Pressable
                                            testID={`sidebar-${seg.mode}`}
                                            onPress={() => handleModePress(seg.mode)}
                                            style={styles.modeRow}
                                        >
                                            {isActive && (
                                                <Animated.View
                                                    style={[
                                                        styles.activeRowBg,
                                                        { backgroundColor: theme.colors.primaryContainer },
                                                        activeRowBgStyle
                                                    ]}
                                                />
                                            )}
                                            <Octicons
                                                name={seg.icon}
                                                size={16}
                                                color={
                                                    isActive
                                                        ? theme.colors.onPrimaryContainer
                                                        : theme.colors.onSurfaceVariant
                                                }
                                            />
                                            <Animated.View style={[styles.modeLabelRow, labelsAnimatedStyle]}>
                                                <Text
                                                    style={[
                                                        styles.modeLabel,
                                                        {
                                                            color: isActive
                                                                ? theme.colors.onPrimaryContainer
                                                                : theme.colors.onSurfaceVariant
                                                        },
                                                        isActive && styles.modeLabelActive
                                                    ]}
                                                >
                                                    {seg.label}
                                                </Text>
                                                {hasItems && (
                                                    <Octicons
                                                        name={isActive ? "chevron-down" : "chevron-right"}
                                                        size={12}
                                                        color={
                                                            isActive
                                                                ? theme.colors.onPrimaryContainer
                                                                : theme.colors.onSurfaceVariant
                                                        }
                                                    />
                                                )}
                                            </Animated.View>
                                        </Pressable>

                                        {/* Documents sub-items (dynamic from store) */}
                                        {!collapsed && isDocumentsMode && isActive && (
                                            <View style={styles.subItems}>
                                                {sidebarDocs.map((doc) => {
                                                    const isSelected = documentsSelected === doc.id;
                                                    return (
                                                        <Pressable
                                                            key={doc.id}
                                                            testID={`sidebar-doc-${doc.id}`}
                                                            onPress={() => handleDocumentPress(doc.id)}
                                                            style={[
                                                                styles.subItemRow,
                                                                isSelected && {
                                                                    backgroundColor: theme.colors.surfaceContainerHigh
                                                                }
                                                            ]}
                                                        >
                                                            <Text
                                                                style={[
                                                                    styles.subItemLabel,
                                                                    {
                                                                        color: isSelected
                                                                            ? theme.colors.onSurface
                                                                            : theme.colors.onSurfaceVariant
                                                                    }
                                                                ]}
                                                                numberOfLines={1}
                                                            >
                                                                {doc.title}
                                                            </Text>
                                                        </Pressable>
                                                    );
                                                })}
                                                <Pressable
                                                    testID="sidebar-doc-create"
                                                    onPress={() => setCreateDialogVisible(true)}
                                                    style={styles.subItemRow}
                                                >
                                                    <Octicons
                                                        name="plus"
                                                        size={14}
                                                        color={theme.colors.onSurfaceVariant}
                                                        style={styles.createIcon}
                                                    />
                                                    <Text
                                                        style={[
                                                            styles.subItemLabel,
                                                            { color: theme.colors.onSurfaceVariant }
                                                        ]}
                                                    >
                                                        New Document
                                                    </Text>
                                                </Pressable>
                                            </View>
                                        )}

                                        {/* Static sub-items for other modes */}
                                        {!collapsed && !isDocumentsMode && isActive && hasStaticItems && (
                                            <View style={styles.subItems}>
                                                {items.map((item) => {
                                                    const isSelected = selectedItem === item.id;
                                                    return (
                                                        <Pressable
                                                            key={item.id}
                                                            testID={`sidebar-item-${item.id}`}
                                                            onPress={() => handleItemPress(seg.mode, item.id)}
                                                            style={[
                                                                styles.subItemRow,
                                                                isSelected && {
                                                                    backgroundColor: theme.colors.surfaceContainerHigh
                                                                }
                                                            ]}
                                                        >
                                                            <Text
                                                                style={[
                                                                    styles.subItemLabel,
                                                                    {
                                                                        color: isSelected
                                                                            ? theme.colors.onSurface
                                                                            : theme.colors.onSurfaceVariant
                                                                    }
                                                                ]}
                                                            >
                                                                {item.title}
                                                            </Text>
                                                        </Pressable>
                                                    );
                                                })}
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    ))}
                </ScrollView>

                {/* Bottom-pinned items */}
                <View style={styles.footer}>
                    {bottomSegments.map((seg) => {
                        const isActive = activeMode === seg.mode;
                        const items = modeItems[seg.mode];
                        const hasStaticItems = items.length > 0;

                        return (
                            <View key={seg.mode}>
                                <Pressable
                                    testID={`sidebar-${seg.mode}`}
                                    onPress={() => handleModePress(seg.mode)}
                                    style={styles.modeRow}
                                >
                                    {isActive && (
                                        <Animated.View
                                            style={[
                                                styles.activeRowBg,
                                                { backgroundColor: theme.colors.primaryContainer },
                                                activeRowBgStyle
                                            ]}
                                        />
                                    )}
                                    <Octicons
                                        name={seg.icon}
                                        size={16}
                                        color={
                                            isActive ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant
                                        }
                                    />
                                    <Animated.View style={[styles.modeLabelRow, labelsAnimatedStyle]}>
                                        <Text
                                            style={[
                                                styles.modeLabel,
                                                {
                                                    color: isActive
                                                        ? theme.colors.onPrimaryContainer
                                                        : theme.colors.onSurfaceVariant
                                                },
                                                isActive && styles.modeLabelActive
                                            ]}
                                        >
                                            {seg.label}
                                        </Text>
                                    </Animated.View>
                                </Pressable>

                                {/* Static sub-items */}
                                {!collapsed && isActive && hasStaticItems && (
                                    <View style={styles.subItems}>
                                        {items.map((item) => {
                                            const isSelected = selectedItem === item.id;
                                            return (
                                                <Pressable
                                                    key={item.id}
                                                    testID={`sidebar-item-${item.id}`}
                                                    onPress={() => handleItemPress(seg.mode, item.id)}
                                                    style={[
                                                        styles.subItemRow,
                                                        isSelected && {
                                                            backgroundColor: theme.colors.surfaceContainerHigh
                                                        }
                                                    ]}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.subItemLabel,
                                                            {
                                                                color: isSelected
                                                                    ? theme.colors.onSurface
                                                                    : theme.colors.onSurfaceVariant
                                                            }
                                                        ]}
                                                    >
                                                        {item.title}
                                                    </Text>
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </View>

                {/* Document create dialog */}
                <DocumentCreateDialog
                    visible={createDialogVisible}
                    parentId={documentRootId}
                    onClose={() => setCreateDialogVisible(false)}
                    onCreate={handleCreateDocument}
                />
            </View>
        );
    }
);

const styles = StyleSheet.create({
    sidebar: {
        flex: 1,
        width: SIDEBAR_WIDTH
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingLeft: 20,
        paddingRight: 8,
        height: 56
    },
    title: {
        fontSize: 18,
        fontWeight: "600",
        flex: 1
    },
    headerLabels: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 10
    },
    collapseButton: {
        position: "absolute",
        top: 12,
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center"
    },
    collapseIcon: {
        position: "absolute",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32
    },
    treeContainer: {
        flex: 1,
        paddingHorizontal: 8
    },
    groupSpacer: {
        marginTop: 12
    },
    modeRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 12,
        height: 36,
        borderRadius: 8,
        marginVertical: 1,
        position: "relative"
    },
    activeRowBg: {
        position: "absolute",
        top: 0,
        left: 0,
        height: 36,
        borderRadius: 8
    },
    modeLabelRow: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 10
    },
    modeLabel: {
        fontSize: 14,
        fontWeight: "400",
        flex: 1
    },
    modeLabelActive: {
        fontWeight: "600"
    },
    subItems: {
        paddingLeft: 16,
        marginBottom: 4
    },
    subItemRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingLeft: 22,
        height: 32,
        borderRadius: 6,
        marginVertical: 1
    },
    subItemLabel: {
        fontSize: 13,
        fontWeight: "400"
    },
    createIcon: {
        marginRight: 6
    },
    footer: {
        paddingHorizontal: 8,
        paddingVertical: 8
    }
});
