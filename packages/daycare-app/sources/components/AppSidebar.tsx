import { Octicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { type AppMode, appModes } from "@/components/AppHeader";
import { Avatar } from "@/components/Avatar";

export const SIDEBAR_WIDTH = 240;

const segments: Array<{ mode: AppMode; icon: React.ComponentProps<typeof Octicons>["name"]; label: string }> = [
    { mode: "home", icon: "home", label: "Home" },
    { mode: "agents", icon: "device-desktop", label: "Agents" },
    { mode: "people", icon: "people", label: "People" },
    { mode: "email", icon: "mail", label: "Email" },
    { mode: "inbox", icon: "inbox", label: "Inbox" },
    { mode: "todos", icon: "checklist", label: "Todos" },
    { mode: "routines", icon: "clock", label: "Routines" },
    { mode: "inventory", icon: "package", label: "Inventory" },
    { mode: "workflows", icon: "workflow", label: "Workflows" },
    { mode: "coaching", icon: "mortar-board", label: "Coaching" },
    { mode: "costs", icon: "credit-card", label: "Costs" },
    { mode: "documents", icon: "file", label: "Documents" }
];

/** Sub-items for each mode that expand when the mode is active. */
const modeItems: Record<AppMode, Array<{ id: string; title: string }>> = {
    home: [],
    agents: [
        { id: "a1", title: "Scout" },
        { id: "a2", title: "Builder" },
        { id: "a3", title: "Operator" }
    ],
    people: [
        { id: "p1", title: "Team" },
        { id: "p2", title: "External" }
    ],
    email: [
        { id: "e1", title: "Inbox" },
        { id: "e2", title: "Sent" },
        { id: "e3", title: "Archive" }
    ],
    inbox: [
        { id: "i1", title: "Action Required" },
        { id: "i2", title: "Notifications" }
    ],
    todos: [
        { id: "t1", title: "Today" },
        { id: "t2", title: "This Week" },
        { id: "t3", title: "Completed" }
    ],
    routines: [
        { id: "r1", title: "Active" },
        { id: "r2", title: "Disabled" }
    ],
    inventory: [
        { id: "inv1", title: "API Keys" },
        { id: "inv2", title: "Compute" },
        { id: "inv3", title: "Storage" },
        { id: "inv4", title: "Integrations" }
    ],
    workflows: [
        { id: "wf1", title: "Recent" },
        { id: "wf2", title: "Completed" }
    ],
    coaching: [
        { id: "ch1", title: "Training" },
        { id: "ch2", title: "Feedback" },
        { id: "ch3", title: "Completed" }
    ],
    costs: [
        { id: "co1", title: "This Month" },
        { id: "co2", title: "Last Month" }
    ],
    documents: []
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
};

/**
 * Tree-style sidebar navigation.
 * Shows all modes as expandable tree nodes with sub-items.
 * Parent controls sizing and safe area margins.
 */
export const AppSidebar = React.memo<AppSidebarProps>(({ onNavigate }) => {
    const { theme } = useUnistyles();
    const pathname = usePathname();
    const router = useRouter();

    const activeMode = extractModeFromPath(pathname);
    const selectedItem = extractItemFromPath(pathname);

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

    return (
        <View style={[styles.sidebar, { backgroundColor: theme.colors.surface }]}>
            {/* Logo header */}
            <View style={styles.header}>
                <Octicons name="hubot" size={20} color={theme.colors.onSurface} />
                <Text style={[styles.title, { color: theme.colors.onSurface }]}>Daycare</Text>
            </View>

            {/* Tree navigation */}
            <ScrollView style={styles.treeContainer} showsVerticalScrollIndicator={false}>
                {segments.map((seg) => {
                    const isActive = activeMode === seg.mode;
                    const items = modeItems[seg.mode];
                    const hasItems = items.length > 0;

                    return (
                        <View key={seg.mode}>
                            <Pressable
                                testID={`sidebar-${seg.mode}`}
                                onPress={() => handleModePress(seg.mode)}
                                style={[styles.modeRow, isActive && { backgroundColor: theme.colors.primaryContainer }]}
                            >
                                <Octicons
                                    name={seg.icon}
                                    size={16}
                                    color={isActive ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant}
                                />
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
                                            isActive ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant
                                        }
                                    />
                                )}
                            </Pressable>

                            {/* Expanded sub-items */}
                            {isActive && hasItems && (
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
            </ScrollView>

            {/* Footer with avatar */}
            <View style={[styles.footer, { borderTopColor: theme.colors.outlineVariant }]}>
                <Avatar id="daycare-user" size={32} />
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    sidebar: {
        flex: 1
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 20,
        height: 56
    },
    title: {
        fontSize: 18,
        fontWeight: "600"
    },
    treeContainer: {
        flex: 1,
        paddingHorizontal: 8
    },
    modeRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 12,
        height: 36,
        borderRadius: 8,
        marginVertical: 1
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
        paddingHorizontal: 12,
        paddingLeft: 22,
        height: 32,
        borderRadius: 6,
        justifyContent: "center",
        marginVertical: 1
    },
    subItemLabel: {
        fontSize: 13,
        fontWeight: "400"
    },
    footer: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        alignItems: "flex-start"
    }
});
