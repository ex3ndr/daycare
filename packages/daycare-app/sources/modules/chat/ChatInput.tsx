import { Octicons } from "@expo/vector-icons";
import * as React from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

export type ChatInputProps = {
    onSend: (text: string) => void;
};

/**
 * Terminal-style message input — monospace prompt with send button.
 */
export function ChatInput({ onSend }: ChatInputProps) {
    const { theme } = useUnistyles();
    const [text, setText] = React.useState("");
    const hasText = text.trim().length > 0;

    const handleSend = React.useCallback(() => {
        const trimmed = text.trim();
        if (!trimmed) return;
        onSend(trimmed);
        setText("");
    }, [text, onSend]);

    // Enter-to-send on web, shift+enter for newline
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
        <View
            style={[
                styles.container,
                {
                    backgroundColor: theme.colors.surfaceContainerLowest,
                    borderTopColor: theme.colors.outlineVariant
                }
            ]}
        >
            <Text style={[styles.prompt, { color: theme.colors.primary }]}>{">"}</Text>
            <TextInput
                style={[styles.input, { color: theme.colors.onSurface }]}
                placeholderTextColor={theme.colors.onSurfaceVariant}
                value={text}
                onChangeText={setText}
                onKeyPress={handleKeyPress}
                multiline
                maxLength={10000}
                submitBehavior="newline"
            />
            <Pressable
                onPress={handleSend}
                disabled={!hasText}
                style={[
                    styles.sendButton,
                    { backgroundColor: hasText ? theme.colors.primary : theme.colors.outlineVariant }
                ]}
            >
                <Octicons
                    name="arrow-up"
                    size={14}
                    color={hasText ? theme.colors.onPrimary : theme.colors.onSurfaceVariant}
                />
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "flex-end",
        paddingHorizontal: 12,
        paddingVertical: 6,
        gap: 8,
        borderTopWidth: StyleSheet.hairlineWidth
    },
    prompt: {
        fontSize: 13,
        fontFamily: "IBMPlexMono-Regular",
        lineHeight: 20,
        marginBottom: 6
    },
    input: {
        flex: 1,
        fontSize: 13,
        fontFamily: "IBMPlexMono-Regular",
        maxHeight: 120,
        paddingVertical: 4,
        lineHeight: 20
    },
    sendButton: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 4
    }
});
