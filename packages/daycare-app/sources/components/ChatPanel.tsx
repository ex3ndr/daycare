import { Octicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { type SharedValue, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useAuthStore } from "@/modules/auth/authContext";
import { Chat } from "@/modules/chat/Chat";
import { chatDirectResolve } from "@/modules/chat/chatApi";

export const CHAT_PANEL_WIDTH = 320;
export const CHAT_COLLAPSED_WIDTH = 56;

type ChatPanelProps = {
    /** Called when the user toggles the collapsed state. */
    onToggleCollapse?: () => void;
    /** Animated opacity for labels/text (fades out when collapsing). */
    labelsOpacity?: SharedValue<number>;
    /** Animated panel width (used for collapse button positioning). */
    panelWidth?: SharedValue<number>;
};

/**
 * Chat panel — renders the direct messaging channel.
 * Always renders at full CHAT_PANEL_WIDTH; parent clips via overflow: hidden + animated width.
 */
export const ChatPanel = React.memo<ChatPanelProps>(({ onToggleCollapse, labelsOpacity, panelWidth }) => {
    const { theme } = useUnistyles();
    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);
    const authState = useAuthStore((s) => s.state);

    const [directAgentId, setDirectAgentId] = React.useState<string | null>(null);
    const resolvingRef = React.useRef(false);

    React.useEffect(() => {
        if (authState !== "authenticated" || !baseUrl || !token || resolvingRef.current) return;
        resolvingRef.current = true;
        void chatDirectResolve(baseUrl, token)
            .then(setDirectAgentId)
            .finally(() => {
                resolvingRef.current = false;
            });
    }, [authState, baseUrl, token]);

    const labelsAnimatedStyle = useAnimatedStyle(() => ({
        opacity: labelsOpacity ? labelsOpacity.value : 1
    }));

    // Collapse button: right-aligned, animates position with panel width
    const headerHovered = useSharedValue(0);
    const collapseButtonStyle = useAnimatedStyle(() => {
        const labels = labelsOpacity ? labelsOpacity.value : 1;
        const pw = panelWidth ? panelWidth.value : CHAT_PANEL_WIDTH;
        return {
            left: pw - 40,
            opacity: Math.max(labels, headerHovered.value)
        };
    });
    const expandedIconStyle = useAnimatedStyle(() => ({
        opacity: labelsOpacity ? labelsOpacity.value : 1
    }));
    const collapsedIconStyle = useAnimatedStyle(() => ({
        opacity: labelsOpacity ? 1 - labelsOpacity.value : 0
    }));

    return (
        <View style={[styles.panel, { backgroundColor: theme.colors.surface }]}>
            <Pressable
                onPress={onToggleCollapse}
                style={styles.header}
                onHoverIn={() => (headerHovered.value = withTiming(1, { duration: 150 }))}
                onHoverOut={() => (headerHovered.value = withTiming(0, { duration: 150 }))}
            >
                <Octicons name="comment-discussion" size={20} color={theme.colors.onSurfaceVariant} />
                <Animated.View style={[styles.headerLabels, labelsAnimatedStyle]}>
                    <Text style={[styles.title, { color: theme.colors.onSurface }]}>Direct</Text>
                </Animated.View>
                <Animated.View
                    style={[styles.collapseButton, { backgroundColor: theme.colors.surface }, collapseButtonStyle]}
                    pointerEvents="none"
                >
                    <Animated.View style={[styles.collapseIcon, expandedIconStyle]}>
                        <Octicons name="sidebar-collapse" size={16} color={theme.colors.onSurfaceVariant} />
                    </Animated.View>
                    <Animated.View style={[styles.collapseIcon, collapsedIconStyle]}>
                        <Octicons name="sidebar-expand" size={16} color={theme.colors.onSurfaceVariant} />
                    </Animated.View>
                </Animated.View>
            </Pressable>
            <View style={styles.content}>{directAgentId ? <Chat agentId={directAgentId} /> : null}</View>
        </View>
    );
});

const styles = StyleSheet.create({
    panel: {
        flex: 1,
        width: CHAT_PANEL_WIDTH
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingLeft: 20,
        paddingRight: 8,
        height: 56
    },
    title: {
        fontSize: 18,
        fontWeight: "600",
        flex: 1
    },
    headerLabels: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 10
    },
    collapseButton: {
        position: "absolute",
        top: 12,
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center"
    },
    collapseIcon: {
        position: "absolute",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32
    },
    content: {
        flex: 1
    }
});
