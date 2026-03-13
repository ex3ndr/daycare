import { Octicons } from "@expo/vector-icons";
import { Marked } from "marked";
import * as React from "react";
import { Platform, Pressable, View } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import WebView from "react-native-webview";
import { documentHtmlToMarkdown } from "@/modules/documents/documentHtmlToMarkdown";
import { documentEditorHtml } from "./documentEditorHtml";

type DocumentEditorViewProps = {
    markdown: string;
    onChange: (markdown: string) => void;
};

type ToolbarButton = {
    icon: string;
    label: string;
    action: () => void;
};

/**
 * WYSIWYG markdown editor using contenteditable in an iframe (web) or WebView (native).
 * Provides a formatting toolbar and converts HTML changes back to markdown.
 *
 * Expects: markdown is the current document body; onChange is called with updated markdown.
 */
export const DocumentEditorView = React.memo<DocumentEditorViewProps>(({ markdown, onChange }) => {
    const { theme } = useUnistyles();
    const iframeRef = React.useRef<HTMLIFrameElement>(null);
    const webviewRef = React.useRef<WebView>(null);

    const colors = React.useMemo(
        () => ({
            onSurface: theme.colors.onSurface,
            surface: theme.colors.surface,
            onSurfaceVariant: theme.colors.onSurfaceVariant,
            outlineVariant: theme.colors.outlineVariant,
            surfaceContainerHigh: theme.colors.surfaceContainerHigh,
            primary: theme.colors.primary
        }),
        [theme]
    );

    // Convert markdown to HTML for the editor
    const initialHtml = React.useMemo(() => {
        const marked = new Marked();
        return marked.parse(markdown) as string;
    }, [markdown]);

    const editorHtml = React.useMemo(() => documentEditorHtml(initialHtml, colors), [initialHtml, colors]);

    // Send command to the editor iframe/webview
    const sendCommand = React.useCallback((command: string, value?: string) => {
        const message = JSON.stringify({ type: "command", command, value: value ?? null });
        if (Platform.OS === "web" && iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage({ type: "command", command, value: value ?? null }, "*");
        } else if (webviewRef.current) {
            webviewRef.current.injectJavaScript(`window.postMessage(${message}, "*"); true;`);
        }
    }, []);

    const sendFormatBlock = React.useCallback((tag: string) => {
        const message = JSON.stringify({ type: "formatBlock", tag });
        if (Platform.OS === "web" && iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage({ type: "formatBlock", tag }, "*");
        } else if (webviewRef.current) {
            webviewRef.current.injectJavaScript(`window.postMessage(${message}, "*"); true;`);
        }
    }, []);

    // Handle content changes from the iframe
    React.useEffect(() => {
        if (Platform.OS !== "web") return;

        const handler = (event: MessageEvent) => {
            if (event.data?.type === "content" && typeof event.data.html === "string") {
                const md = documentHtmlToMarkdown(event.data.html);
                onChange(md);
            }
        };
        window.addEventListener("message", handler);
        return () => window.removeEventListener("message", handler);
    }, [onChange]);

    const toolbarButtons: ToolbarButton[] = React.useMemo(
        () => [
            { icon: "bold", label: "Bold", action: () => sendCommand("bold") },
            { icon: "italic", label: "Italic", action: () => sendCommand("italic") },
            { icon: "strikethrough", label: "Strikethrough", action: () => sendCommand("strikethrough") },
            { icon: "heading", label: "Heading 1", action: () => sendFormatBlock("<h1>") },
            { icon: "list-unordered", label: "Bullet List", action: () => sendCommand("insertUnorderedList") },
            { icon: "list-ordered", label: "Numbered List", action: () => sendCommand("insertOrderedList") },
            { icon: "quote", label: "Blockquote", action: () => sendFormatBlock("<blockquote>") },
            { icon: "code", label: "Code", action: () => sendCommand("insertHTML", "<code>code</code>") },
            { icon: "horizontal-rule", label: "Horizontal Rule", action: () => sendCommand("insertHorizontalRule") },
            {
                icon: "link",
                label: "Link",
                action: () => {
                    const url = Platform.OS === "web" ? window.prompt("Enter URL:") : null;
                    if (url) sendCommand("createLink", url);
                }
            }
        ],
        [sendCommand, sendFormatBlock]
    );

    return (
        <View style={{ flex: 1 }}>
            {/* Toolbar */}
            <View
                style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 2,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.colors.outlineVariant,
                    backgroundColor: theme.colors.surfaceContainerHigh
                }}
            >
                {toolbarButtons.map((btn) => (
                    <Pressable
                        key={btn.icon}
                        onPress={btn.action}
                        hitSlop={4}
                        style={({ pressed }) => ({
                            padding: 6,
                            borderRadius: 4,
                            backgroundColor: pressed ? theme.colors.outlineVariant : "transparent"
                        })}
                    >
                        <Octicons name={btn.icon as any} size={16} color={theme.colors.onSurface} />
                    </Pressable>
                ))}
            </View>

            {/* Editor */}
            {Platform.OS === "web" ? (
                <View style={{ flex: 1, overflow: "hidden" }}>
                    <iframe
                        ref={iframeRef}
                        title="Document editor"
                        srcDoc={editorHtml}
                        style={{
                            width: "100%",
                            height: "100%",
                            border: "none"
                        }}
                    />
                </View>
            ) : (
                <WebView
                    ref={webviewRef}
                    originWhitelist={["*"]}
                    source={{ html: editorHtml }}
                    style={{ flex: 1, backgroundColor: theme.colors.surface }}
                    javaScriptEnabled={true}
                    scrollEnabled={true}
                    showsVerticalScrollIndicator={true}
                    onMessage={(event) => {
                        try {
                            const data = JSON.parse(event.nativeEvent.data);
                            if (data.type === "content" && typeof data.html === "string") {
                                const md = documentHtmlToMarkdown(data.html);
                                onChange(md);
                            }
                        } catch {
                            // ignore parse errors
                        }
                    }}
                    onShouldStartLoadWithRequest={(request) => request.url.startsWith("about:")}
                />
            )}
        </View>
    );
});
