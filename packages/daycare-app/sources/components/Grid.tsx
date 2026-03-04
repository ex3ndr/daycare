import * as React from "react";
import { ScrollView, type ScrollViewProps, type StyleProp, View, type ViewProps, type ViewStyle } from "react-native";

type GridProps = Omit<ViewProps, "style"> & {
    columns?: number;
    columnWidth?: number;
    gap?: number;
    horizontal?: boolean;
    children?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    scrollViewProps?: Omit<ScrollViewProps, "horizontal" | "contentContainerStyle">;
};

/**
 * Reusable grid layout for wrapped or horizontally scrollable content.
 * Expects child items and optional column rules for responsive/fixed-width layouts.
 */
export function Grid({
    columns,
    columnWidth,
    gap = 12,
    horizontal = false,
    children,
    style,
    scrollViewProps,
    ...rest
}: GridProps) {
    const childStyle = React.useMemo<StyleProp<ViewStyle>>(() => {
        if (columnWidth !== undefined) {
            return {
                width: columnWidth,
                maxWidth: columnWidth,
                flexGrow: 0,
                flexShrink: 0
            };
        }

        if (columns !== undefined && columns > 0) {
            const width = `${100 / columns}%` as const;
            return {
                flexBasis: width,
                maxWidth: width,
                flexGrow: 1
            };
        }

        return undefined;
    }, [columnWidth, columns]);

    let fallbackKeyCounter = 0;
    const items = React.Children.toArray(children).map((child) => {
        let itemKey: React.Key;
        if (React.isValidElement(child) && child.key !== null) {
            itemKey = child.key;
        } else {
            fallbackKeyCounter += 1;
            itemKey = `grid-item-${fallbackKeyCounter}`;
        }

        return (
            <View key={itemKey} style={childStyle}>
                {child}
            </View>
        );
    });

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
                {items}
            </ScrollView>
        );
    }

    return (
        <View style={[containerStyle, style]} {...rest}>
            {items}
        </View>
    );
}
