import type * as React from "react";
import { Pressable, type PressableProps, type StyleProp, View, type ViewProps, type ViewStyle } from "react-native";
import { useUnistyles } from "react-native-unistyles";

type CardVariant = "filled" | "outlined";
type CardSize = "sm" | "md" | "lg";

type CardProps = Omit<ViewProps, "style"> & {
    variant?: CardVariant;
    accent?: string;
    size?: CardSize;
    gap?: number;
    children?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    onPress?: PressableProps["onPress"];
};

const SIZE_STYLES: Record<CardSize, { padding: number; borderRadius: number }> = {
    sm: { padding: 12, borderRadius: 12 },
    md: { padding: 16, borderRadius: 16 },
    lg: { padding: 20, borderRadius: 16 }
};

/**
 * Surface container for grouped content.
 * Supports filled/outlined variants, optional accent stripe, and content spacing.
 */
export function Card({ variant = "filled", accent, size = "md", gap, children, style, onPress, ...rest }: CardProps) {
    const { theme } = useUnistyles();
    const sizeStyle = SIZE_STYLES[size];

    const containerStyle: ViewStyle = {
        ...sizeStyle,
        backgroundColor: variant === "filled" ? theme.colors.surfaceContainer : theme.colors.surface,
        borderWidth: variant === "outlined" ? 1 : 0,
        borderColor: variant === "outlined" ? theme.colors.outlineVariant : "transparent",
        borderLeftWidth: accent ? 4 : variant === "outlined" ? 1 : 0,
        borderLeftColor: accent ?? (variant === "outlined" ? theme.colors.outlineVariant : "transparent")
    };

    if (gap !== undefined) {
        containerStyle.gap = gap;
    }

    if (onPress) {
        return (
            <Pressable
                onPress={onPress}
                style={({ pressed }) => [containerStyle, style, pressed && { opacity: 0.9 }]}
                {...rest}
            >
                {children}
            </Pressable>
        );
    }

    return (
        <View style={[containerStyle, style]} {...rest}>
            {children}
        </View>
    );
}
