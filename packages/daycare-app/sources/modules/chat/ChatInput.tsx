import { Octicons } from "@expo/vector-icons";
import * as React from "react";
import { Platform, Pressable, TextInput, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

export type ChatInputProps = {
    onSend: (text: string) => void;
    placeholder?: string;
};

/**
 * Chat input with toolbar row — styled after Manus.
 * Rounded container with text area, plus button, and send button.
 */
export function ChatInput({ onSend, placeholder }: ChatInputProps) {
    const { theme } = useUnistyles();
    const [text, setText] = React.useState("");
    const hasText = text.trim().length > 0;

    const handleSend = React.useCallback(() => {
        const trimmed = text.trim();
        if (!trimmed) return;
        onSend(trimmed);
        setText("");
    }, [text, onSend]);

    const handleKeyPress = React.useCallback(
        (e: { nativeEvent: { key: string; shiftKey?: boolean } }) => {
            if (Platform.OS === "web" && e.nativeEvent.key === "Enter" && !e.nativeEvent.shiftKey) {
                e.nativeEvent = { ...e.nativeEvent };
                (e as { preventDefault?: () => void }).preventDefault?.();
                handleSend();
            }
        },
        [handleSend]
    );

    return (
        <View style={styles.wrapper}>
            <View
                style={[
                    styles.panel,
                    {
                        backgroundColor: theme.colors.surfaceContainerLowest,
                        borderColor: "rgba(0, 0, 0, 0.08)"
                    }
                ]}
            >
                <TextInput
                    style={[styles.input, { color: theme.colors.onSurface }]}
                    placeholder={placeholder ?? "Ask anything..."}
                    placeholderTextColor={theme.colors.onSurfaceVariant}
                    value={text}
                    onChangeText={setText}
                    onKeyPress={handleKeyPress}
                    multiline
                    maxLength={10000}
                    submitBehavior="newline"
                />
                <View style={styles.toolbar}>
                    <View style={styles.toolbarLeft}>
                        <Pressable style={styles.toolButton}>
                            <Octicons name="plus" size={18} color={theme.colors.onSurfaceVariant} />
                        </Pressable>
                    </View>
                    <Pressable
                        onPress={handleSend}
                        disabled={!hasText}
                        style={[
                            styles.sendButton,
                            {
                                backgroundColor: hasText ? theme.colors.onSurface : theme.colors.surfaceContainerHigh,
                                opacity: hasText ? 1 : 0.5
                            }
                        ]}
                    >
                        <Octicons
                            name="arrow-up"
                            size={14}
                            color={hasText ? theme.colors.surface : theme.colors.onSurfaceVariant}
                        />
                    </Pressable>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create((theme) => ({
    wrapper: {
        maxWidth: 720,
        width: "100%",
        alignSelf: "center",
        paddingHorizontal: 24
    },
    panel: {
        borderRadius: 22,
        borderWidth: 1,
        paddingTop: 14,
        ...Platform.select({
            web: {
                boxShadow: "0px 12px 32px 0px rgba(0, 0, 0, 0.02)"
            }
        })
    },
    input: {
        fontSize: 15,
        lineHeight: 24,
        minHeight: 48,
        maxHeight: 216,
        paddingHorizontal: 20,
        paddingTop: 0,
        paddingBottom: 0
    },
    toolbar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: 12
    },
    toolbarLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    toolButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center"
    },
    sendButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center"
    }
}));
