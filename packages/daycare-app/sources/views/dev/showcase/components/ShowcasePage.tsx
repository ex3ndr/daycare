import { ScrollView, type ScrollViewProps } from "react-native";
import { StyleSheet } from "react-native-unistyles";

/**
 * Scroll container for showcase pages.
 * Applies maxWidth centering, horizontal padding, and bottom padding.
 * Pass contentContainerStyle to override defaults per-page.
 */
export function ShowcasePage({ children, contentContainerStyle, ...rest }: ScrollViewProps) {
    return (
        <ScrollView
            contentContainerStyle={[styles.content, contentContainerStyle]}
            showsVerticalScrollIndicator={false}
            {...rest}
        >
            {children}
        </ScrollView>
    );
}

const styles = StyleSheet.create((theme) => ({
    content: {
        maxWidth: theme.layout.maxWidth,
        width: "100%",
        alignSelf: "center",
        paddingHorizontal: 16,
        paddingBottom: 40
    }
}));
