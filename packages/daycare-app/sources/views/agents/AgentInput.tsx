import { Octicons } from "@expo/vector-icons";
import * as React from "react";
import { Platform, Pressable, TextInput, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

export type AgentInputProps = {
    onSend: (text: string) => void;
};

/**
 * Minimal message input — multi-line text field + send button.
 * Ported from happy's AgentInput, stripped to essentials.
 */
export function AgentInput({ onSend }: AgentInputProps) {
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
                e.nativeEvent = { ...e.nativeEvent }; // prevent default newline
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
                { backgroundColor: theme.colors.surfaceContainerHighest, borderTopColor: theme.colors.outlineVariant }
            ]}
        >
            <TextInput
                style={[styles.input, { color: theme.colors.onSurface }]}
                placeholder="Message..."
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
                    size={18}
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
        paddingVertical: 8,
        gap: 8,
        borderTopWidth: 1
    },
    input: {
        flex: 1,
        fontSize: 15,
        fontFamily: "IBMPlexSans-Regular",
        maxHeight: 120,
        paddingVertical: 8,
        paddingHorizontal: 12,
        lineHeight: 22
    },
    sendButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 4
    }
});
