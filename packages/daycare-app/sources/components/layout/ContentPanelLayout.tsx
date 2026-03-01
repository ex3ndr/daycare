import * as React from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";

const ANIMATION_DURATION = 300;

export type ContentPanelLayoutProps = {
    panel2: React.ReactNode;
    panel3?: React.ReactNode;
};

/**
 * Simplified 2-panel layout for use with AppSidebar.
 * Content fills the space without card styling — the sidebar is the card.
 */
export const ContentPanelLayout = React.memo<ContentPanelLayoutProps>(({ panel2, panel3 }) => {
    const hasPanel3 = !!panel3;

    const panel3Flex = useSharedValue(hasPanel3 ? 1 : 0);
    const panel3Opacity = useSharedValue(hasPanel3 ? 1 : 0);

    React.useEffect(() => {
        if (hasPanel3) {
            panel3Flex.value = withTiming(1, { duration: ANIMATION_DURATION });
            panel3Opacity.value = withTiming(1, { duration: ANIMATION_DURATION });
        } else {
            panel3Flex.value = withTiming(0, { duration: ANIMATION_DURATION });
            panel3Opacity.value = withTiming(0, { duration: ANIMATION_DURATION });
        }
    }, [hasPanel3, panel3Flex, panel3Opacity]);

    const panel3AnimatedStyle = useAnimatedStyle(() => ({
        flex: panel3Flex.value,
        opacity: panel3Opacity.value
    }));

    return (
        <View style={styles.container}>
            <View style={styles.panel2}>{panel2}</View>
            {hasPanel3 && <Animated.View style={[styles.panel3, panel3AnimatedStyle]}>{panel3}</Animated.View>}
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: "row"
    },
    panel2: {
        flex: 1,
        overflow: "hidden"
    },
    panel3: {
        overflow: "hidden",
        flexBasis: 0
    }
});
