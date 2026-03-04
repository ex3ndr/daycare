import type { Ionicons } from "@expo/vector-icons";
import type * as React from "react";
import { Text, View, type ViewStyle } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import { Badge } from "@/components/Badge";
import { IconCircle } from "@/components/IconCircle";

type SectionProps = {
    title: string;
    icon?: keyof typeof Ionicons.glyphMap;
    count?: number;
    action?: React.ReactNode;
    gap?: number;
    spacing?: number;
    children?: React.ReactNode;
    style?: ViewStyle;
};

/**
 * Titled content section with optional icon, count badge, and action slot.
 * Use spacing to control vertical separation between consecutive sections.
 */
export function Section({ title, icon, count, action, gap = 8, spacing = 24, children, style }: SectionProps) {
    const { theme } = useUnistyles();

    return (
        <View style={[{ marginTop: spacing, gap }, style]}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}>
                    {icon && <IconCircle icon={icon} color={theme.colors.primary} size={32} />}
                    <Text
                        numberOfLines={1}
                        style={{
                            color: theme.colors.onSurface,
                            fontFamily: "IBMPlexSans-SemiBold",
                            fontSize: 17,
                            flexShrink: 1
                        }}
                    >
                        {title}
                    </Text>
                    {count !== undefined && <Badge color={theme.colors.primary}>{count}</Badge>}
                </View>
                {action}
            </View>
            <View style={{ gap }}>{children}</View>
        </View>
    );
}
