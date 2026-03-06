import * as React from "react";
import { Platform, View, type ViewStyle } from "react-native";
import WebView from "react-native-webview";

interface HtmlViewProps {
    html: string;
    style?: ViewStyle;
    backgroundColor?: string;
}

/**
 * Renders arbitrary HTML in a sandboxed WebView.
 * JavaScript is disabled by default for security. No navigation allowed.
 *
 * Expects: `html` is a complete HTML string (with <html>/<body> or fragment).
 */
export const HtmlView = React.memo(({ html, style, backgroundColor = "transparent" }: HtmlViewProps) => {
    const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 100%; height: 100%; overflow: hidden; background: ${backgroundColor}; }
</style>
</head>
<body>${html}</body>
</html>`;

    if (Platform.OS === "web") {
        return (
            <View style={[{ overflow: "hidden" }, style]}>
                <iframe
                    title="Embedded content"
                    srcDoc={fullHtml}
                    sandbox="allow-same-origin"
                    style={{
                        width: "100%",
                        height: "100%",
                        border: "none",
                        pointerEvents: "none"
                    }}
                />
            </View>
        );
    }

    return (
        <WebView
            originWhitelist={["*"]}
            source={{ html: fullHtml }}
            style={[{ backgroundColor }, style]}
            javaScriptEnabled={false}
            scrollEnabled={false}
            bounces={false}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            overScrollMode="never"
            scalesPageToFit={false}
            onShouldStartLoadWithRequest={() => false}
        />
    );
});
