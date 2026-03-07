import * as React from "react";
import { Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

type ChatThinkingBarProps = {
    thinking: boolean;
};

/**
 * Fixed-height status bar showing a thinking indicator when the agent is active.
 * Always occupies the same vertical space to prevent layout shifts.
 */
export const ChatThinkingBar = React.memo(({ thinking }: ChatThinkingBarProps) => {
    const { theme } = useUnistyles();
    const opacity = useSharedValue(0);

    React.useEffect(() => {
        opacity.value = withRepeat(withTiming(thinking ? 1 : 0, { duration: 800 }), -1, true);
    }, [thinking, opacity]);

    const dotStyle = useAnimatedStyle(() => ({
        opacity: opacity.value
    }));

    return (
        <View style={styles.bar}>
            {thinking ? (
                <View style={styles.content}>
                    <Animated.View style={[styles.dot, { backgroundColor: theme.colors.primary }, dotStyle]} />
                    <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>thinking</Text>
                </View>
            ) : null}
        </View>
    );
});

const styles = StyleSheet.create({
    bar: {
        height: 24,
        justifyContent: "center",
        paddingHorizontal: 16
    },
    content: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3
    },
    label: {
        fontSize: 11,
        fontFamily: "IBMPlexMono-Regular",
        lineHeight: 16
    }
});
