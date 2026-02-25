import * as React from "react";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue, withTiming } from "react-native-reanimated";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

const PANEL1_WIDTH = 280;
const ANIMATION_DURATION = 300;

export type TreePanelLayoutSemiWideProps = {
    panel1: React.ReactNode;
    panel2: React.ReactNode;
    panel3?: React.ReactNode;
    onClosePanel3?: () => void;
};

export const TreePanelLayoutSemiWide = React.memo<TreePanelLayoutSemiWideProps>(
    ({ panel1, panel2, panel3, onClosePanel3 }) => {
        const { rt } = useUnistyles();
        const hasPanel3Content = !!panel3;

        // Hover state for left overlay
        const [isOverlayHovered, setIsOverlayHovered] = React.useState(false);

        // Shared value to store the container width
        const containerWidth = useSharedValue(rt.screen.width);

        // Shared values for animations
        const translateX = useSharedValue(hasPanel3Content ? -PANEL1_WIDTH : 0);
        const panel1HoverOffset = useSharedValue(0);
        const animationProgress = useSharedValue(hasPanel3Content ? 1 : 0);

        // Calculate panels 2&3 wrapper width
        const panels23TargetWidth = useDerivedValue(() => {
            "worklet";
            if (containerWidth.value === 0) return 0;
            // Container has 16px padding on each side, so inner width = containerWidth - 32
            // Wrapper width doesn't change based on panel3 - it's always the available space
            // When collapsed: innerWidth - PANEL1_WIDTH - 16 (gap)
            // When expanded: innerWidth - 16 (gap, panel1 shifted off screen)
            const innerWidth = containerWidth.value - 32;
            const collapsedWidth = innerWidth - PANEL1_WIDTH - 16;
            const expandedWidth = innerWidth - 16;
            return collapsedWidth + (expandedWidth - collapsedWidth) * animationProgress.value;
        });

        // Calculate panel3 width - always at fixed target size
        const panel3Width = useDerivedValue(() => {
            "worklet";
            if (containerWidth.value === 0) return 0;
            // Content width is half of the expanded panels23 wrapper (minus gap)
            const innerWidth = containerWidth.value - 32;
            const expandedPanels23Width = innerWidth - 16;
            return (expandedPanels23Width - 16) / 2; // 16 is the gap between panel2 and panel3
        });

        // Calculate panel3 translateX offset to slide off screen
        const panel3TranslateXValue = useDerivedValue(() => {
            "worklet";
            // When animationProgress = 0, panel3 is off screen to the right
            // When animationProgress = 1, panel3 is in position
            // Move it by its width + gap
            return (1 - animationProgress.value) * (panel3Width.value + 16);
        });

        // Calculate panel2 width
        const panel2Width = useDerivedValue(() => {
            "worklet";
            // When animationProgress = 0 (collapsed): full width of panels23Wrapper
            // When animationProgress = 1 (expanded): half of available space (wrapper width - panel3Width - gap)
            return panels23TargetWidth.value - (panel3Width.value + 16) * animationProgress.value;
        });

        // Update container width when screen size changes
        React.useEffect(() => {
            containerWidth.value = rt.screen.width;
        }, [rt.screen.width, containerWidth]);

        // Update animations when panel3 content changes
        React.useEffect(() => {
            if (hasPanel3Content) {
                translateX.value = withTiming(-PANEL1_WIDTH, { duration: ANIMATION_DURATION });
                animationProgress.value = withTiming(1, { duration: ANIMATION_DURATION });
            } else {
                translateX.value = withTiming(0, { duration: ANIMATION_DURATION });
                animationProgress.value = withTiming(0, { duration: ANIMATION_DURATION });
            }
        }, [hasPanel3Content, translateX, animationProgress]);

        // Update hover offset when overlay is hovered (only when panel 3 is open)
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

        const panel2AnimatedStyle = useAnimatedStyle(() => ({
            width: panel2Width.value
        }));

        const panel3AnimatedStyle = useAnimatedStyle(() => ({
            width: panel3Width.value,
            transform: [{ translateX: panel3TranslateXValue.value }]
        }));

        const contentAnimatedStyle = useAnimatedStyle(() => ({
            width: panel3Width.value
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
                        <Animated.View style={[styles.panel2, panel2AnimatedStyle]}>{panel2}</Animated.View>
                        <Animated.View style={[styles.panel3, panel3AnimatedStyle]}>
                            {hasPanel3Content && (
                                <Animated.View style={[styles.panelContent, contentAnimatedStyle]}>
                                    {panel3}
                                </Animated.View>
                            )}
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
        width: PANEL1_WIDTH,
        backgroundColor: theme.colors.surface,
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: theme.elevation.level1,
        flexShrink: 0
    },
    panels23Wrapper: {
        flexDirection: "row",
        gap: 16,
        flexShrink: 0,
        overflow: "hidden"
    },
    panel2: {
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
