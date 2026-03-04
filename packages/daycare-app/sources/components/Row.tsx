import type * as React from "react";
import { Pressable, type StyleProp, View, type ViewStyle } from "react-native";

type RowProps = {
    leading?: React.ReactNode;
    trailing?: React.ReactNode;
    gap?: number;
    padding?: number;
    children?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    onPress?: () => void;
};

/**
 * Horizontal layout row with optional leading/trailing slots.
 * Center content receives flex space so trailing content stays aligned.
 */
export function Row({ leading, trailing, gap = 12, padding = 0, children, style, onPress }: RowProps) {
    const containerStyle: ViewStyle = {
        flexDirection: "row",
        alignItems: "center",
        gap,
        padding
    };

    const content = (
        <>
            {leading}
            <View style={{ flex: 1 }}>{children}</View>
            {trailing}
        </>
    );

    if (onPress) {
        return (
            <Pressable onPress={onPress} style={({ pressed }) => [containerStyle, style, pressed && { opacity: 0.85 }]}>
                {content}
            </Pressable>
        );
    }

    return <View style={[containerStyle, style]}>{content}</View>;
}
