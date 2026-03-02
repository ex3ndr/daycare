import { Octicons } from "@expo/vector-icons";
import { Slot } from "expo-router";
import * as React from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { AppSidebar, SIDEBAR_WIDTH } from "@/components/AppSidebar";
import { Drawer } from "@/components/Drawer";

export default function AppLayout() {
    const { theme } = useUnistyles();
    const isMobile = theme.layout.isMobileLayout;

    if (isMobile) {
        return <MobileLayout />;
    }

    return <DesktopLayout />;
}

/** Desktop: sidebar card on the left, content fills the rest. */
function DesktopLayout() {
    const { theme } = useUnistyles();
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.root, { backgroundColor: theme.colors.surface }]}>
            <View
                style={[
                    styles.sidebarCard,
                    {
                        marginTop: 12 + insets.top,
                        marginBottom: 12 + insets.bottom,
                        backgroundColor: theme.colors.surface,
                        boxShadow: theme.elevation.level1
                    }
                ]}
            >
                <AppSidebar />
            </View>
            <View style={styles.content}>
                <Slot />
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
        <View style={[styles.mobileRoot, { backgroundColor: theme.colors.surface }]}>
            <Drawer
                isOpen={drawerOpen}
                onClose={closeDrawer}
                renderDrawer={renderDrawerContent}
                width={SIDEBAR_WIDTH + 32}
                position="left"
            >
                <View style={styles.content}>
                    <Slot />
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
        flexDirection: "row"
    },
    sidebarCard: {
        width: SIDEBAR_WIDTH,
        marginLeft: 12,
        borderRadius: 16,
        overflow: "hidden",
        flexShrink: 0
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
