import { Octicons } from "@expo/vector-icons";
import type * as React from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

type PageHeaderProps = {
    title: string;
    subtitle?: string;
    icon?: React.ComponentProps<typeof Octicons>["name"];
};

/**
 * Page-level header bar. Height matches the sidebar header (56px)
 * for visual alignment across the layout.
 * On mobile, adds safe area top inset for status bar clearance.
 */
export function PageHeader({ title, subtitle, icon }: PageHeaderProps) {
    const { theme } = useUnistyles();
    const insets = useSafeAreaInsets();
    const isMobile = theme.layout.isMobileLayout;

    return (
        <View style={[styles.wrapper, isMobile && { paddingTop: insets.top }]}>
            <View style={styles.container}>
                <View style={styles.left}>
                    {icon && <Octicons name={icon} size={16} color={theme.colors.primary} />}
                    <Text style={[styles.title, { color: theme.colors.onSurface }]}>{title}</Text>
                </View>
                {subtitle && (
                    <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>{subtitle}</Text>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create((theme) => ({
    wrapper: {
        backgroundColor: theme.colors.surface
    },
    container: {
        height: 56,
        maxWidth: theme.layout.maxWidth,
        width: "100%",
        alignSelf: "center",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20
    },
    left: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    title: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15
    },
    subtitle: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    }
}));
