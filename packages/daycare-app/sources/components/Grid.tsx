import type * as React from "react";
import { ScrollView, type ScrollViewProps, type StyleProp, View, type ViewProps, type ViewStyle } from "react-native";

type GridProps = Omit<ViewProps, "style"> & {
    gap?: number;
    horizontal?: boolean;
    children?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    scrollViewProps?: Omit<ScrollViewProps, "horizontal" | "contentContainerStyle">;
};

/**
 * Container for row-based layouts with gap and optional wrapping.
 * Children are rendered directly — they control their own sizing
 * (e.g. flex: 1, minWidth, flexBasis, width).
 */
export function Grid({ gap = 12, horizontal = false, children, style, scrollViewProps, ...rest }: GridProps) {
    const containerStyle: ViewStyle = {
        flexDirection: "row",
        gap
    };

    if (!horizontal) {
        containerStyle.flexWrap = "wrap";
    }

    if (horizontal) {
        return (
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[containerStyle, style]}
                {...scrollViewProps}
            >
                {children}
            </ScrollView>
        );
    }

    return (
        <View style={[containerStyle, style]} {...rest}>
            {children}
        </View>
    );
}
