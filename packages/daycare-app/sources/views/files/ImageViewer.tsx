import { Image } from "expo-image";
import * as React from "react";
import { type LayoutChangeEvent, Platform, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

type ImageViewerProps = {
    uri: string;
};

/**
 * Interactive image viewer with pinch-to-zoom, pan, double-tap zoom, and wheel zoom.
 * Uses Gesture Handler for touch interactions and Reanimated for smooth transforms.
 */
export const ImageViewer = React.memo<ImageViewerProps>(({ uri }) => {
    const { theme } = useUnistyles();

    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const savedTranslateX = useSharedValue(0);
    const savedTranslateY = useSharedValue(0);

    // Container dimensions for clamping
    const containerWidth = useSharedValue(0);
    const containerHeight = useSharedValue(0);

    const onLayout = React.useCallback(
        (e: LayoutChangeEvent) => {
            containerWidth.value = e.nativeEvent.layout.width;
            containerHeight.value = e.nativeEvent.layout.height;
        },
        [containerWidth, containerHeight]
    );

    const resetTransform = React.useCallback(() => {
        scale.value = withTiming(1, { duration: 200 });
        translateX.value = withTiming(0, { duration: 200 });
        translateY.value = withTiming(0, { duration: 200 });
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
    }, [scale, translateX, translateY, savedScale, savedTranslateX, savedTranslateY]);

    // Pinch gesture
    const pinchGesture = Gesture.Pinch()
        .onUpdate((e) => {
            const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, savedScale.value * e.scale));
            scale.value = newScale;
        })
        .onEnd(() => {
            savedScale.value = scale.value;
            if (scale.value <= 1) {
                scale.value = withTiming(1, { duration: 200 });
                translateX.value = withTiming(0, { duration: 200 });
                translateY.value = withTiming(0, { duration: 200 });
                savedScale.value = 1;
                savedTranslateX.value = 0;
                savedTranslateY.value = 0;
            }
        });

    // Pan gesture — only active when zoomed in
    const panGesture = Gesture.Pan()
        .minPointers(1)
        .maxPointers(2)
        .onUpdate((e) => {
            if (scale.value <= 1) return;
            const maxX = ((scale.value - 1) * containerWidth.value) / 2;
            const maxY = ((scale.value - 1) * containerHeight.value) / 2;
            translateX.value = Math.min(maxX, Math.max(-maxX, savedTranslateX.value + e.translationX));
            translateY.value = Math.min(maxY, Math.max(-maxY, savedTranslateY.value + e.translationY));
        })
        .onEnd(() => {
            savedTranslateX.value = translateX.value;
            savedTranslateY.value = translateY.value;
        });

    // Double-tap to toggle zoom
    const doubleTapGesture = Gesture.Tap()
        .numberOfTaps(2)
        .onEnd(() => {
            if (scale.value > 1) {
                scale.value = withTiming(1, { duration: 200 });
                translateX.value = withTiming(0, { duration: 200 });
                translateY.value = withTiming(0, { duration: 200 });
                savedScale.value = 1;
                savedTranslateX.value = 0;
                savedTranslateY.value = 0;
            } else {
                scale.value = withTiming(DOUBLE_TAP_SCALE, { duration: 200 });
                savedScale.value = DOUBLE_TAP_SCALE;
            }
        });

    const composed = Gesture.Simultaneous(pinchGesture, panGesture, doubleTapGesture);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }, { translateX: translateX.value }, { translateY: translateY.value }]
    }));

    // Web: wheel zoom
    const handleWheel = React.useCallback(
        (e: WheelEvent) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale.value * delta));
            scale.value = newScale;
            savedScale.value = newScale;
            if (newScale <= 1) {
                translateX.value = withTiming(0, { duration: 100 });
                translateY.value = withTiming(0, { duration: 100 });
                savedTranslateX.value = 0;
                savedTranslateY.value = 0;
            }
        },
        [scale, savedScale, translateX, translateY, savedTranslateX, savedTranslateY]
    );

    const viewRef = React.useRef<View>(null);

    React.useEffect(() => {
        if (Platform.OS !== "web" || !viewRef.current) return;
        const el = viewRef.current as unknown as HTMLElement;
        el.addEventListener("wheel", handleWheel, { passive: false });
        return () => el.removeEventListener("wheel", handleWheel);
    }, [handleWheel]);

    // Reset zoom when URI changes
    // biome-ignore lint/correctness/useExhaustiveDependencies: uri is a prop that triggers reset
    React.useEffect(() => {
        resetTransform();
    }, [uri, resetTransform]);

    return (
        <View
            ref={viewRef}
            style={[styles.container, { backgroundColor: theme.colors.surfaceDim }]}
            onLayout={onLayout}
        >
            <GestureDetector gesture={composed}>
                <Animated.View style={[styles.imageWrapper, animatedStyle]}>
                    <Image source={{ uri }} style={styles.image} contentFit="contain" />
                </Animated.View>
            </GestureDetector>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        overflow: "hidden"
    },
    imageWrapper: {
        flex: 1
    },
    image: {
        flex: 1
    }
});
