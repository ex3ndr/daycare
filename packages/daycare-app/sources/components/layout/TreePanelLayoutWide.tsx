import * as React from "react";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue, withTiming } from "react-native-reanimated";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

const SIDEBAR_WIDTH = 280;
const ANIMATION_DURATION = 300;

export type TreePanelLayoutWideProps = {
    panel1: React.ReactNode;
    panel2: React.ReactNode;
    panel3?: React.ReactNode;
    panel3Placeholder: React.ReactNode;
    onClosePanel3?: () => void;
};

export const TreePanelLayoutWide = React.memo<TreePanelLayoutWideProps>(
    ({ panel1, panel2, panel3, panel3Placeholder, onClosePanel3 }) => {
        const { rt } = useUnistyles();
        const hasPanel3Content = !!panel3;

        // Hover state for left overlay
        const [isOverlayHovered, setIsOverlayHovered] = React.useState(false);

        // Shared value to store the container width
        const containerWidth = useSharedValue(rt.screen.width);

        // Shared values for animations
        const translateX = useSharedValue(hasPanel3Content ? -SIDEBAR_WIDTH : 0);
        const panel1HoverOffset = useSharedValue(0);
        const panel3Flex = useSharedValue(hasPanel3Content ? 1 : 0);
        const panel3Width = useSharedValue(hasPanel3Content ? 0 : SIDEBAR_WIDTH);
        const contentOpacity = useSharedValue(hasPanel3Content ? 1 : 0);
        const placeholderOpacity = useSharedValue(hasPanel3Content ? 0 : 1);

        // Calculate panels 2&3 wrapper width
        const panels23TargetWidth = useDerivedValue(() => {
            "worklet";
            if (containerWidth.value === 0) return 0;
            // Container has 16px padding on each side, so inner width = containerWidth - 32
            // When collapsed: innerWidth - 280 (panel1) - 16 (gap)
            // When expanded: innerWidth - 16 (gap, panel1 shifted off screen but gap remains)
            const innerWidth = containerWidth.value - 32;
            const collapsedWidth = innerWidth - SIDEBAR_WIDTH - 16;
            const expandedWidth = innerWidth - 16;
            return collapsedWidth + (expandedWidth - collapsedWidth) * panel3Flex.value;
        });

        // Calculate panel3 content width - always at expanded size
        const panel3ContentTargetWidth = useDerivedValue(() => {
            "worklet";
            if (containerWidth.value === 0) return 0;
            // Content width is half of the expanded panels23 wrapper (minus gap)
            const innerWidth = containerWidth.value - 32;
            const expandedPanels23Width = innerWidth - 16;
            return (expandedPanels23Width - 16) / 2; // 16 is the gap between panel2 and panel3
        });

        // Calculate placeholder translation to keep it centered
        const placeholderTranslateX = useDerivedValue(() => {
            "worklet";
            if (containerWidth.value === 0) return 0;

            // Calculate panel3's target width when fully expanded
            // panels23TargetWidth when expanded = innerWidth - 16 (just the gap)
            // Panel3 will occupy approximately half the wrapper, accounting for the space
            // that was previously occupied by panel1 which has shifted off-screen
            const expandedPanel3Width = (panels23TargetWidth.value + SIDEBAR_WIDTH) / 2;

            // Interpolate current panel3 width based on animation progress
            const currentPanel3Width = SIDEBAR_WIDTH + (expandedPanel3Width - SIDEBAR_WIDTH) * panel3Flex.value;

            // Center the placeholder (width: SIDEBAR_WIDTH) within the current panel3 width
            // This moves it at half the speed of the panel's growth
            const offset = (currentPanel3Width - SIDEBAR_WIDTH) / 2;
            return offset;
        });

        // Update container width when screen size changes
        React.useEffect(() => {
            containerWidth.value = rt.screen.width;
        }, [rt.screen.width, containerWidth]);

        // Update animations when panel3 content changes
        React.useEffect(() => {
            if (hasPanel3Content) {
                translateX.value = withTiming(-SIDEBAR_WIDTH, { duration: ANIMATION_DURATION });
                panel3Flex.value = withTiming(1, { duration: ANIMATION_DURATION });
                panel3Width.value = withTiming(0, { duration: ANIMATION_DURATION });
                contentOpacity.value = withTiming(1, { duration: ANIMATION_DURATION });
                placeholderOpacity.value = withTiming(0, { duration: ANIMATION_DURATION });
            } else {
                translateX.value = withTiming(0, { duration: ANIMATION_DURATION });
                panel3Flex.value = withTiming(0, { duration: ANIMATION_DURATION });
                panel3Width.value = withTiming(SIDEBAR_WIDTH, { duration: ANIMATION_DURATION });
                contentOpacity.value = withTiming(0, { duration: ANIMATION_DURATION });
                placeholderOpacity.value = withTiming(1, { duration: ANIMATION_DURATION });
            }
        }, [hasPanel3Content, translateX, panel3Flex, panel3Width, contentOpacity, placeholderOpacity]);

        // Update hover offset when overlay is hovered (only when panel 3 is expanded)
        React.useEffect(() => {
            if (hasPanel3Content && isOverlayHovered) {
                panel1HoverOffset.value = withTiming(5, { duration: 200 });
            } else {
                panel1HoverOffset.value = withTiming(0, { duration: 200 });
            }
        }, [isOverlayHovered, hasPanel3Content, panel1HoverOffset]);

        // Animated styles
        const wrapperAnimatedStyle = useAnimatedStyle(() => ({
            transform: [{ translateX: translateX.value }]
        }));

        const panel1AnimatedStyle = useAnimatedStyle(() => ({
            transform: [{ translateX: panel1HoverOffset.value }]
        }));

        const panels23AnimatedStyle = useAnimatedStyle(() => ({
            width: panels23TargetWidth.value
        }));

        const panel3AnimatedStyle = useAnimatedStyle(() => ({
            flexGrow: panel3Flex.value,
            flexBasis: panel3Width.value
        }));

        const contentAnimatedStyle = useAnimatedStyle(() => ({
            opacity: contentOpacity.value,
            width: panel3ContentTargetWidth.value
        }));

        const placeholderAnimatedStyle = useAnimatedStyle(() => ({
            opacity: placeholderOpacity.value,
            transform: [{ translateX: placeholderTranslateX.value }],
            width: SIDEBAR_WIDTH
        }));

        const handleOverlayClick = React.useCallback(() => {
            if (onClosePanel3) {
                onClosePanel3();
            }
        }, [onClosePanel3]);

        const handleOverlayMouseEnter = React.useCallback(() => {
            setIsOverlayHovered(true);
        }, []);

        const handleOverlayMouseLeave = React.useCallback(() => {
            setIsOverlayHovered(false);
        }, []);

        return (
            <View style={styles.container}>
                {hasPanel3Content && (
                    <Pressable
                        style={styles.leftOverlay}
                        onHoverIn={handleOverlayMouseEnter}
                        onHoverOut={handleOverlayMouseLeave}
                        onPress={handleOverlayClick}
                    />
                )}
                <Animated.View style={[styles.panelsWrapper, wrapperAnimatedStyle]}>
                    <Animated.View
                        style={[styles.panel1, panel1AnimatedStyle]}
                        pointerEvents={hasPanel3Content ? "none" : "auto"}
                    >
                        {panel1}
                    </Animated.View>
                    <Animated.View style={[styles.panels23Wrapper, panels23AnimatedStyle]}>
                        <View style={styles.panel2}>{panel2}</View>
                        <Animated.View style={[styles.panel3, panel3AnimatedStyle]}>
                            {hasPanel3Content && (
                                <Animated.View
                                    style={[styles.panelContent, contentAnimatedStyle]}
                                    pointerEvents={hasPanel3Content ? "auto" : "none"}
                                >
                                    {panel3}
                                </Animated.View>
                            )}
                            <Animated.View
                                style={[styles.panelContent, placeholderAnimatedStyle]}
                                pointerEvents={!hasPanel3Content ? "auto" : "none"}
                            >
                                {panel3Placeholder}
                            </Animated.View>
                        </Animated.View>
                    </Animated.View>
                </Animated.View>
            </View>
        );
    }
);

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        padding: 16,
        overflow: "hidden"
    },
    leftOverlay: {
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: 20,
        zIndex: 1000,
        cursor: "pointer"
    },
    panelsWrapper: {
        flex: 1,
        flexDirection: "row",
        gap: 16
    },
    panel1: {
        width: SIDEBAR_WIDTH,
        backgroundColor: theme.colors.surface,
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: theme.elevation.level1,
        flexShrink: 0
    },
    panels23Wrapper: {
        flexDirection: "row",
        gap: 16,
        flexShrink: 0
    },
    panel2: {
        flex: 1,
        backgroundColor: theme.colors.surface,
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: theme.elevation.level1,
        flexShrink: 0
    },
    panel3: {
        backgroundColor: theme.colors.surface,
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: theme.elevation.level1,
        position: "relative",
        flexShrink: 0
    },
    panelContent: {
        position: "absolute",
        top: 0,
        left: 0,
        bottom: 0
    }
}));
