import * as React from "react";
import { Platform, View, type ViewStyle } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import WebView from "react-native-webview";
import { vaultMarkdownHtml } from "./vaultMarkdownHtml";

type VaultMarkdownViewProps = {
    markdown: string;
    style?: ViewStyle;
};

/**
 * Renders markdown as themed HTML.
 * Web: uses iframe with srcDoc. Native: uses WebView.
 */
export const VaultMarkdownView = React.memo<VaultMarkdownViewProps>(({ markdown, style }) => {
    const { theme } = useUnistyles();

    const html = React.useMemo(
        () =>
            vaultMarkdownHtml(markdown, {
                onSurface: theme.colors.onSurface,
                surface: theme.colors.surface,
                onSurfaceVariant: theme.colors.onSurfaceVariant,
                outlineVariant: theme.colors.outlineVariant,
                surfaceContainerHigh: theme.colors.surfaceContainerHigh,
                primary: theme.colors.primary
            }),
        [markdown, theme]
    );

    if (Platform.OS === "web") {
        return (
            <View style={[{ flex: 1, overflow: "hidden" }, style]}>
                <iframe
                    title="Vault entry content"
                    srcDoc={html}
                    sandbox="allow-same-origin"
                    style={{
                        width: "100%",
                        height: "100%",
                        border: "none"
                    }}
                />
            </View>
        );
    }

    return (
        <WebView
            originWhitelist={["*"]}
            source={{ html }}
            style={[{ flex: 1, backgroundColor: theme.colors.surface }, style]}
            javaScriptEnabled={true}
            scrollEnabled={true}
            showsVerticalScrollIndicator={true}
            onShouldStartLoadWithRequest={(request) => {
                // Allow the initial HTML load, block external navigation
                return request.url.startsWith("about:");
            }}
        />
    );
});
