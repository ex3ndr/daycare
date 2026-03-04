import type { StyleProp, ViewStyle } from "react-native";
import { ItemList, type ItemListProps } from "@/components/ItemList";

type ShowcasePageDensity = "compact" | "default" | "spacious";

type ShowcasePageProps = Omit<ItemListProps, "containerStyle"> & {
    contentContainerStyle?: StyleProp<ViewStyle>;
    density?: ShowcasePageDensity;
    edgeToEdge?: boolean;
    horizontalInset?: number;
    topInset?: number;
    bottomInset?: number;
    contentGap?: number;
    contentBackgroundColor?: string;
};

const DENSITY_PRESETS: Record<ShowcasePageDensity, { horizontalInset: number; bottomInset: number }> = {
    compact: { horizontalInset: 12, bottomInset: 24 },
    default: { horizontalInset: 16, bottomInset: 40 },
    spacious: { horizontalInset: 20, bottomInset: 48 }
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
    horizontalInset,
    topInset,
    bottomInset,
    contentGap,
    contentBackgroundColor,
    ...rest
}: ShowcasePageProps) {
    const preset = DENSITY_PRESETS[density];
    const containerStyle: ViewStyle = {
        paddingHorizontal: edgeToEdge ? 0 : (horizontalInset ?? preset.horizontalInset),
        paddingTop: topInset ?? 0,
        paddingBottom: bottomInset ?? preset.bottomInset,
        backgroundColor: contentBackgroundColor
    };
    if (contentGap !== undefined) {
        containerStyle.gap = contentGap;
    }

    return (
        <ItemList
            containerStyle={[containerStyle, contentContainerStyle]}
            showsVerticalScrollIndicator={false}
            {...rest}
        >
            {children}
        </ItemList>
    );
}
