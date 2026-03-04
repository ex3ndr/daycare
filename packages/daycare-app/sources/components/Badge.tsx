import type * as React from "react";
import { Text, type TextStyle, View, type ViewStyle } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import { colorWithOpacity } from "@/components/colorWithOpacity";

type BadgeVariant = "filled" | "outlined";

type BadgeProps = {
    color: string;
    children?: React.ReactNode;
    variant?: BadgeVariant;
    style?: ViewStyle;
    textStyle?: TextStyle;
};

/**
 * Compact status/value badge.
 * Expects a color value used for text and either background fill or outline.
 */
export function Badge({ color, children, variant = "filled", style, textStyle }: BadgeProps) {
    const { theme } = useUnistyles();

    const containerStyle: ViewStyle = {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        alignSelf: "flex-start",
        borderWidth: variant === "outlined" ? 1 : 0,
        borderColor: color,
        backgroundColor: variant === "outlined" ? "transparent" : colorWithOpacity(color, 0.15)
    };

    return (
        <View style={[containerStyle, style]}>
            <Text
                style={[
                    {
                        color,
                        fontFamily: "IBMPlexSans-Medium",
                        fontSize: 11,
                        lineHeight: 14
                    },
                    textStyle,
                    // Keep native text color fallback if custom textStyle clears color.
                    !textStyle?.color && { color: color || theme.colors.onSurface }
                ]}
            >
                {children}
            </Text>
        </View>
    );
}
