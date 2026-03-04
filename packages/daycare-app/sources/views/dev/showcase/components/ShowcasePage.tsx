import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { ItemList, type ItemListProps } from "@/components/ItemList";

type ShowcasePageDensity = "compact" | "default" | "spacious";

type ShowcasePageProps = Omit<ItemListProps, "containerStyle"> & {
    contentContainerStyle?: StyleProp<ViewStyle>;
    density?: ShowcasePageDensity;
    edgeToEdge?: boolean;
};

/**
 * Scroll container for showcase pages.
 * Applies maxWidth centering, horizontal padding, and bottom padding.
 * Pass contentContainerStyle to override defaults per-page.
 */
export function ShowcasePage({
    children,
    contentContainerStyle,
    density = "default",
    edgeToEdge = false,
    ...rest
}: ShowcasePageProps) {
    const densityStyle =
        density === "compact"
            ? styles.contentCompact
            : density === "spacious"
              ? styles.contentSpacious
              : styles.content;

    return (
        <ItemList
            containerStyle={[densityStyle, edgeToEdge && styles.contentEdgeToEdge, contentContainerStyle]}
            showsVerticalScrollIndicator={false}
            {...rest}
        >
            {children}
        </ItemList>
    );
}

const styles = StyleSheet.create({
    content: {
        paddingHorizontal: 16,
        paddingBottom: 40
    },
    contentCompact: {
        paddingHorizontal: 12,
        paddingBottom: 24
    },
    contentSpacious: {
        paddingHorizontal: 20,
        paddingBottom: 48
    },
    contentEdgeToEdge: {
        paddingHorizontal: 0
    }
});
