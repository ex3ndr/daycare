import { Octicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import * as React from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { AppSidebar, SIDEBAR_WIDTH } from "@/components/AppSidebar";
import { Drawer } from "@/components/Drawer";

export const unstable_settings = {
    anchor: "index"
};

export default function AppLayout() {
    const { theme } = useUnistyles();
    const isMobile = theme.layout.isMobileLayout;

    if (isMobile) {
        return <MobileLayout />;
    }

    return <DesktopLayout />;
}

/** Shared Stack navigator used by both layouts. */
function AppStack() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="[mode]" />
            <Stack.Screen
                name="fragment-modal"
                options={{
                    presentation: "modal",
                    headerShown: false
                }}
            />
        </Stack>
    );
}

/** Desktop: sidebar card on the left, content fills the rest. */
function DesktopLayout() {
    const { theme } = useUnistyles();
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.root, { backgroundColor: theme.colors.surfaceContainerLow }]}>
            <View
                style={[
                    styles.sidebarCard,
                    {
                        marginTop: 8 + insets.top,
                        marginBottom: 8 + insets.bottom,
                        backgroundColor: theme.colors.surface,
                        boxShadow: `0px 1px 2px ${theme.colors.shadow}0D, 0px 1px 3px ${theme.colors.shadow}14`
                    }
                ]}
            >
                <AppSidebar />
            </View>
            <View
                style={[
                    styles.contentCard,
                    {
                        marginTop: 8 + insets.top,
                        marginBottom: 8 + insets.bottom,
                        backgroundColor: theme.colors.surface,
                        boxShadow: `0px 1px 2px ${theme.colors.shadow}0D, 0px 1px 3px ${theme.colors.shadow}14`
                    }
                ]}
            >
                <AppStack />
            </View>
        </View>
    );
}

/** Mobile: full-screen content with a floating hamburger that opens a drawer. */
function MobileLayout() {
    const { theme } = useUnistyles();
    const insets = useSafeAreaInsets();
    const [drawerOpen, setDrawerOpen] = React.useState(false);

    const openDrawer = React.useCallback(() => setDrawerOpen(true), []);
    const closeDrawer = React.useCallback(() => setDrawerOpen(false), []);

    const renderDrawerContent = React.useCallback(() => <AppSidebar onNavigate={closeDrawer} />, [closeDrawer]);

    return (
        <View style={[styles.mobileRoot, { backgroundColor: theme.colors.surfaceContainerLow }]}>
            <Drawer
                isOpen={drawerOpen}
                onClose={closeDrawer}
                renderDrawer={renderDrawerContent}
                width={SIDEBAR_WIDTH + 32}
                position="left"
            >
                <View style={styles.content}>
                    <AppStack />
                </View>
            </Drawer>

            {/* Floating hamburger button — flies above everything */}
            {!drawerOpen && (
                <Pressable
                    onPress={openDrawer}
                    style={[
                        styles.hamburger,
                        {
                            top: 12 + insets.top,
                            backgroundColor: theme.colors.surface,
                            boxShadow: theme.elevation.level2
                        }
                    ]}
                >
                    <Octicons name="three-bars" size={18} color={theme.colors.onSurface} />
                </Pressable>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    // Desktop
    root: {
        flexGrow: 1,
        flexBasis: 0,
        flexDirection: "row",
        gap: 6,
        paddingHorizontal: 8
    },
    sidebarCard: {
        width: SIDEBAR_WIDTH,
        borderTopLeftRadius: 16,
        borderBottomLeftRadius: 16,
        borderTopRightRadius: 8,
        borderBottomRightRadius: 8,
        overflow: "hidden",
        flexShrink: 0
    },
    contentCard: {
        flex: 1,
        borderTopLeftRadius: 8,
        borderBottomLeftRadius: 8,
        borderTopRightRadius: 16,
        borderBottomRightRadius: 16,
        overflow: "hidden"
    },
    content: {
        flex: 1
    },

    // Mobile
    mobileRoot: {
        flex: 1
    },
    hamburger: {
        position: "absolute",
        left: 16,
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100
    }
});
