import { Octicons } from "@expo/vector-icons";
import type * as React from "react";
import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

type PageHeaderProps = {
    title: string;
    subtitle?: string;
    icon?: React.ComponentProps<typeof Octicons>["name"];
};

/**
 * Page-level header bar. Height matches the sidebar header (56px)
 * for visual alignment across the layout.
 */
export function PageHeader({ title, subtitle, icon }: PageHeaderProps) {
    const { theme } = useUnistyles();

    return (
        <View style={styles.container}>
            <View style={styles.left}>
                {icon && <Octicons name={icon} size={16} color={theme.colors.primary} />}
                <Text style={[styles.title, { color: theme.colors.onSurface }]}>{title}</Text>
            </View>
            {subtitle && <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>{subtitle}</Text>}
        </View>
    );
}

const styles = StyleSheet.create((theme) => ({
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
