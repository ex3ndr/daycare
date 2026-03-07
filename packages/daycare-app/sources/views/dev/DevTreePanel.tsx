import { Octicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useWorkspacesStore } from "@/modules/workspaces/workspacesContext";
import { devPathSegmentResolve } from "@/views/dev/devPathSegmentResolve";
import { showcasePages, showcasePagesMap } from "@/views/dev/showcase/_showcasePages";

type DevSection = "components" | "examples" | "showcase" | "lottie" | "monty";

type DevNavItem = {
    id: DevSection;
    label: string;
    icon: React.ComponentProps<typeof Octicons>["name"];
};

const devNavItems: DevNavItem[] = [
    { id: "components", label: "Components", icon: "apps" },
    { id: "examples", label: "Examples", icon: "list-unordered" },
    { id: "showcase", label: "Showcase", icon: "beaker" },
    { id: "lottie", label: "Lottie", icon: "play" },
    { id: "monty", label: "Monty", icon: "code" }
];

function devSelectionResolve(pathname: string): { section: DevSection; showcaseId: string | null } {
    const segment = devPathSegmentResolve(pathname);
    if (segment && showcasePagesMap.has(segment)) {
        return { section: "showcase", showcaseId: segment };
    }
    if (segment === "examples" || segment === "showcase" || segment === "lottie" || segment === "monty") {
        return { section: segment, showcaseId: null };
    }
    return { section: "components", showcaseId: null };
}

/**
 * Left-side navigation tree for the dev workspace.
 * Keeps dev-specific navigation inside the dev screen instead of the global app sidebar.
 */
export const DevTreePanel = React.memo(() => {
    const { theme } = useUnistyles();
    const router = useRouter();
    const pathname = usePathname();
    const activeId = useWorkspacesStore((s) => s.activeId);
    const selection = React.useMemo(() => devSelectionResolve(pathname), [pathname]);
    const showcaseExpanded = selection.section === "showcase";

    const navigateToSection = React.useCallback(
        (section: DevSection) => {
            if (!activeId) return;
            router.replace({
                pathname: "/[workspace]/dev/[item]",
                params: { workspace: activeId, item: section }
            });
        },
        [activeId, router]
    );

    const navigateToShowcase = React.useCallback(
        (showcaseId: string) => {
            if (!activeId) return;
            router.replace({
                pathname: "/[workspace]/dev/[item]",
                params: { workspace: activeId, item: showcaseId }
            });
        },
        [activeId, router]
    );

    return (
        <View style={styles.root}>
            <View style={styles.header}>
                <Text style={[styles.headerLabel, { color: theme.colors.onSurfaceVariant }]}>DEV</Text>
            </View>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                {devNavItems.map((item) => {
                    const isActive = selection.section === item.id;
                    const isShowcase = item.id === "showcase";

                    return (
                        <View key={item.id}>
                            <Pressable
                                onPress={() => navigateToSection(item.id)}
                                style={[styles.row, isActive && { backgroundColor: theme.colors.primaryContainer }]}
                            >
                                <Octicons
                                    name={item.icon}
                                    size={15}
                                    color={isActive ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant}
                                />
                                <Text
                                    style={[
                                        styles.rowLabel,
                                        {
                                            color: isActive
                                                ? theme.colors.onPrimaryContainer
                                                : theme.colors.onSurfaceVariant
                                        }
                                    ]}
                                >
                                    {item.label}
                                </Text>
                                {isShowcase && (
                                    <Octicons
                                        name={showcaseExpanded ? "chevron-down" : "chevron-right"}
                                        size={12}
                                        color={
                                            isActive ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant
                                        }
                                    />
                                )}
                            </Pressable>
                            {isShowcase && showcaseExpanded && (
                                <View style={styles.children}>
                                    {showcasePages.map((page) => {
                                        const selected = selection.showcaseId === page.id;
                                        return (
                                            <Pressable
                                                key={page.id}
                                                onPress={() => navigateToShowcase(page.id)}
                                                style={[
                                                    styles.childRow,
                                                    selected && {
                                                        backgroundColor: theme.colors.surfaceContainerHigh
                                                    }
                                                ]}
                                            >
                                                <Text
                                                    numberOfLines={1}
                                                    style={[
                                                        styles.childLabel,
                                                        {
                                                            color: selected
                                                                ? theme.colors.onSurface
                                                                : theme.colors.onSurfaceVariant
                                                        }
                                                    ]}
                                                >
                                                    {page.title}
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
        </View>
    );
});

const styles = StyleSheet.create({
    root: {
        flex: 1
    },
    header: {
        paddingHorizontal: 16,
        paddingVertical: 12
    },
    headerLabel: {
        fontSize: 13,
        fontWeight: "600"
    },
    scroll: {
        flex: 1
    },
    scrollContent: {
        paddingHorizontal: 8,
        paddingBottom: 16
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 12,
        height: 36,
        borderRadius: 8
    },
    rowLabel: {
        flex: 1,
        fontSize: 14,
        fontFamily: "IBMPlexSans-Medium"
    },
    children: {
        marginTop: 2,
        marginBottom: 8
    },
    childRow: {
        marginLeft: 18,
        paddingLeft: 14,
        paddingRight: 10,
        height: 32,
        justifyContent: "center",
        borderRadius: 8
    },
    childLabel: {
        fontSize: 13
    }
});
