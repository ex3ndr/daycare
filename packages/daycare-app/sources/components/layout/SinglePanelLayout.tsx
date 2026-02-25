import * as React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";

interface SinglePanelLayoutProps {
    children: React.ReactNode;
}

/**
 * A layout component that displays content in a centered panel.
 * On mobile (xs, sm): fills the screen
 * On larger screens (md+): limited width (480px) and height (700px), centered
 */
export const SinglePanelLayout = React.memo(function SinglePanelLayout({ children }: SinglePanelLayoutProps) {
    const insets = useSafeAreaInsets();

    return (
        <View
            style={[
                styles.container,
                {
                    paddingTop: insets.top,
                    paddingBottom: insets.bottom
                }
            ]}
        >
            <View style={styles.panel}>{children}</View>
        </View>
    );
});

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        backgroundColor: theme.colors.surface,
        alignItems: "center",
        justifyContent: {
            xs: "flex-start",
            sm: "flex-start",
            md: "center"
        }
    },
    panel: {
        width: "100%",
        maxWidth: {
            xs: "100%",
            sm: "100%",
            md: 480
        },
        height: {
            xs: "100%",
            sm: "100%",
            md: 700
        }
    }
}));
