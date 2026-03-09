import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { markdownMermaidRender } from "@/markdown/markdownMermaidRender";
import { chatMarkdownParse } from "./chatMarkdownParse";
import type { ChatMarkdownSpan } from "./chatMarkdownTypes";

type ChatMarkdownViewProps = {
    markdown: string;
};

export const ChatMarkdownView = React.memo<ChatMarkdownViewProps>(({ markdown }) => {
    const blocks = React.useMemo(() => chatMarkdownParse(markdown), [markdown]);
    const blockKeys = React.useMemo(() => renderKeysBuild(blocks, (block) => JSON.stringify(block)), [blocks]);

    return (
        <View style={styles.root}>
            {blocks.map((block, index) => {
                const key = blockKeys[index];
                switch (block.type) {
                    case "text":
                        return <TextBlock key={key} spans={block.content} />;
                    case "header":
                        return <HeaderBlock key={key} level={block.level} spans={block.content} />;
                    case "horizontal-rule":
                        return <View key={key} style={styles.rule} />;
                    case "list":
                        return <ListBlock key={key} items={block.items} />;
                    case "numbered-list":
                        return <NumberedListBlock key={key} items={block.items} />;
                    case "code-block":
                        return <CodeBlock key={key} language={block.language} content={block.content} />;
                    case "mermaid":
                        return <MermaidBlock key={key} content={block.content} />;
                    case "options":
                        return <OptionsBlock key={key} items={block.items} />;
                    case "table":
                        return <TableBlock key={key} headers={block.headers} rows={block.rows} />;
                    default:
                        return null;
                }
            })}
        </View>
    );
});

function TextBlock({ spans }: { spans: ChatMarkdownSpan[] }) {
    return (
        <Text selectable style={styles.text}>
            <SpanRuns spans={spans} />
        </Text>
    );
}

function HeaderBlock({ level, spans }: { level: 1 | 2 | 3 | 4 | 5 | 6; spans: ChatMarkdownSpan[] }) {
    const variant = (styles as Record<string, object>)[`header${level}`];
    return (
        <Text selectable style={[styles.header, variant]}>
            <SpanRuns spans={spans} />
        </Text>
    );
}

function ListBlock({ items }: { items: ChatMarkdownSpan[][] }) {
    const itemKeys = React.useMemo(() => renderKeysBuild(items, (item) => JSON.stringify(item)), [items]);

    return (
        <View style={styles.listContainer}>
            {items.map((item, index) => (
                <View key={itemKeys[index]} style={styles.listRow}>
                    <Text style={styles.listMarker}>-</Text>
                    <Text selectable style={styles.listText}>
                        <SpanRuns spans={item} />
                    </Text>
                </View>
            ))}
        </View>
    );
}

function NumberedListBlock({ items }: { items: { number: number; spans: ChatMarkdownSpan[] }[] }) {
    const itemKeys = React.useMemo(
        () => renderKeysBuild(items, (item) => `${item.number}:${JSON.stringify(item.spans)}`),
        [items]
    );

    return (
        <View style={styles.listContainer}>
            {items.map((item, index) => (
                <View key={itemKeys[index]} style={styles.listRow}>
                    <Text style={styles.listMarker}>{item.number}.</Text>
                    <Text selectable style={styles.listText}>
                        <SpanRuns spans={item.spans} />
                    </Text>
                </View>
            ))}
        </View>
    );
}

function CodeBlock({ content, language }: { content: string; language: string | null }) {
    const copyCode = React.useCallback(() => {
        void Clipboard.setStringAsync(content);
    }, [content]);

    return (
        <View style={styles.codeBlock}>
            <View style={styles.codeHeader}>
                <Text style={styles.codeLanguage}>{language ?? "text"}</Text>
                <Pressable onPress={copyCode} style={styles.copyButton}>
                    <Text style={styles.copyButtonText}>copy</Text>
                </Pressable>
            </View>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.codeScrollContent}
            >
                <Text selectable style={styles.codeText}>
                    {content}
                </Text>
            </ScrollView>
        </View>
    );
}

function MermaidBlock({ content }: { content: string }) {
    const rendered = React.useMemo(() => markdownMermaidRender(content) ?? content, [content]);
    return <CodeBlock content={rendered} language="mermaid" />;
}

function OptionsBlock({ items }: { items: string[] }) {
    const itemKeys = React.useMemo(() => renderKeysBuild(items, (item) => item), [items]);

    return (
        <View style={styles.optionsContainer}>
            {items.map((item, index) => (
                <View key={itemKeys[index]} style={styles.optionItem}>
                    <Text style={styles.optionText}>{item}</Text>
                </View>
            ))}
        </View>
    );
}

function TableBlock({ headers, rows }: { headers: string[]; rows: string[][] }) {
    const columnKeys = React.useMemo(() => renderKeysBuild(headers, (header) => header), [headers]);
    const rowKeys = React.useMemo(() => renderKeysBuild(rows, (row) => JSON.stringify(row)), [rows]);

    return (
        <View style={styles.tableContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tableContent}>
                {headers.map((header, columnIndex) => (
                    <View
                        key={columnKeys[columnIndex]}
                        style={[styles.tableColumn, columnIndex === headers.length - 1 && styles.tableColumnLast]}
                    >
                        <View style={[styles.tableCell, styles.tableHeaderCell]}>
                            <Text style={styles.tableHeaderText}>{header}</Text>
                        </View>
                        {rows.map((row, rowIndex) => (
                            <View
                                key={`${rowKeys[rowIndex]}:${header}`}
                                style={[styles.tableCell, rowIndex === rows.length - 1 && styles.tableCellLast]}
                            >
                                <Text style={styles.tableCellText}>{row[columnIndex] ?? ""}</Text>
                            </View>
                        ))}
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}

function SpanRuns({ spans }: { spans: ChatMarkdownSpan[] }) {
    const { theme } = useUnistyles();

    const openUrl = React.useCallback((url: string) => {
        void Linking.openURL(url);
    }, []);

    return (
        <>
            {spans.map((span, index) => (
                <Text
                    key={`${index}-${span.text}`}
                    selectable
                    onPress={span.url ? () => openUrl(span.url!) : undefined}
                    style={[
                        span.styles.includes("italic") && styles.italic,
                        span.styles.includes("bold") && styles.bold,
                        span.styles.includes("semibold") && styles.semibold,
                        span.styles.includes("code") && styles.inlineCode,
                        span.url && { color: theme.colors.primary, textDecorationLine: "underline" }
                    ]}
                >
                    {span.text}
                </Text>
            ))}
        </>
    );
}

function renderKeysBuild<T>(items: T[], keyOf: (item: T) => string): string[] {
    const seen = new Map<string, number>();

    return items.map((item) => {
        const baseKey = keyOf(item);
        const count = seen.get(baseKey) ?? 0;
        seen.set(baseKey, count + 1);
        return `${baseKey}:${count}`;
    });
}

const styles = StyleSheet.create((theme) => ({
    root: {
        gap: 8
    },
    text: {
        color: theme.colors.onSurface,
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 13,
        lineHeight: 20
    },
    italic: {
        fontFamily: "IBMPlexMono-Italic"
    },
    bold: {
        fontFamily: "IBMPlexMono-SemiBold"
    },
    semibold: {
        fontFamily: "IBMPlexMono-SemiBold"
    },
    inlineCode: {
        backgroundColor: theme.colors.surfaceContainerHigh,
        borderRadius: 4
    },
    header: {
        color: theme.colors.onSurface,
        fontFamily: "IBMPlexMono-SemiBold"
    },
    header1: {
        fontSize: 18,
        lineHeight: 24
    },
    header2: {
        fontSize: 16,
        lineHeight: 22
    },
    header3: {
        fontSize: 14,
        lineHeight: 20
    },
    header4: {
        fontSize: 13,
        lineHeight: 18
    },
    header5: {
        fontSize: 13,
        lineHeight: 18
    },
    header6: {
        fontSize: 13,
        lineHeight: 18
    },
    listContainer: {
        gap: 4
    },
    listRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8
    },
    listMarker: {
        width: 20,
        color: theme.colors.onSurfaceVariant,
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 13,
        lineHeight: 20
    },
    listText: {
        flex: 1,
        color: theme.colors.onSurface,
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 13,
        lineHeight: 20
    },
    rule: {
        height: 1,
        backgroundColor: theme.colors.outlineVariant,
        marginVertical: 4
    },
    codeBlock: {
        backgroundColor: theme.colors.surfaceContainerHigh,
        borderRadius: 12,
        overflow: "hidden"
    },
    codeHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 12,
        paddingTop: 10
    },
    codeLanguage: {
        color: theme.colors.onSurfaceVariant,
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11,
        lineHeight: 16
    },
    copyButton: {
        paddingHorizontal: 8,
        paddingVertical: 4
    },
    copyButtonText: {
        color: theme.colors.primary,
        fontFamily: "IBMPlexMono-SemiBold",
        fontSize: 11,
        lineHeight: 16
    },
    codeScrollContent: {
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: 12
    },
    codeText: {
        color: theme.colors.onSurface,
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 12,
        lineHeight: 18
    },
    optionsContainer: {
        gap: 8
    },
    optionItem: {
        backgroundColor: theme.colors.surfaceContainerHigh,
        borderWidth: 1,
        borderColor: theme.colors.outlineVariant,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10
    },
    optionText: {
        color: theme.colors.onSurface,
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 13,
        lineHeight: 18
    },
    tableContainer: {
        borderWidth: 1,
        borderColor: theme.colors.outlineVariant,
        borderRadius: 12,
        overflow: "hidden",
        alignSelf: "flex-start"
    },
    tableContent: {
        flexDirection: "row"
    },
    tableColumn: {
        borderRightWidth: 1,
        borderRightColor: theme.colors.outlineVariant
    },
    tableColumnLast: {
        borderRightWidth: 0
    },
    tableCell: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.outlineVariant
    },
    tableCellLast: {
        borderBottomWidth: 0
    },
    tableHeaderCell: {
        backgroundColor: theme.colors.surfaceContainerHigh
    },
    tableHeaderText: {
        color: theme.colors.onSurface,
        fontFamily: "IBMPlexMono-SemiBold",
        fontSize: 13,
        lineHeight: 18
    },
    tableCellText: {
        color: theme.colors.onSurface,
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 13,
        lineHeight: 18
    }
}));
