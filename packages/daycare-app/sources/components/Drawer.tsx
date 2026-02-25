import * as React from "react";
import { Animated, BackHandler, Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUnistyles } from "react-native-unistyles";

type DrawerProps = {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    renderDrawer: () => React.ReactNode;
    width?: number;
    position?: "left" | "right";
};

export const Drawer = React.memo<DrawerProps>((props) => {
    const { theme } = useUnistyles();
    const insets = useSafeAreaInsets();
    const { isOpen, onClose, children, renderDrawer, width = 400, position = "right" } = props;

    const [isVisible, setIsVisible] = React.useState(false);
    const [cachedContent, setCachedContent] = React.useState<React.ReactNode>(null);
    const translateValue = position === "left" ? -width : width;
    const translateX = React.useRef(new Animated.Value(translateValue)).current;
    const backdropOpacity = React.useRef(new Animated.Value(0)).current;

    // Handle Android back button
    React.useEffect(() => {
        if (Platform.OS !== "android") return;

        const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
            if (isOpen) {
                onClose();
                return true;
            }
            return false;
        });

        return () => backHandler.remove();
    }, [isOpen, onClose]);

    // Animate drawer open/close
    React.useEffect(() => {
        if (isOpen && !isVisible) {
            // Opening - cache content and show drawer
            const content = renderDrawer();
            setCachedContent(content);
            setIsVisible(true);
            Animated.parallel([
                Animated.timing(translateX, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true
                }),
                Animated.timing(backdropOpacity, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true
                })
            ]).start();
        } else if (!isOpen && isVisible) {
            // Closing - keep cached content during animation
            Animated.parallel([
                Animated.timing(translateX, {
                    toValue: translateValue,
                    duration: 250,
                    useNativeDriver: true
                }),
                Animated.timing(backdropOpacity, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true
                })
            ]).start(() => {
                setIsVisible(false);
                setCachedContent(null);
            });
        }
    }, [isOpen, isVisible, translateX, backdropOpacity, translateValue, renderDrawer]);

    return (
        <View style={{ flex: 1 }}>
            {children}

            {isVisible && (
                <>
                    {/* Backdrop */}
                    <Animated.View
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: theme.colors.scrim,
                            opacity: backdropOpacity.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, 0.5]
                            })
                        }}
                        renderToHardwareTextureAndroid={true}
                    >
                        <Pressable style={{ flex: 1 }} onPress={onClose} />
                    </Animated.View>

                    {/* Drawer */}
                    <Animated.View
                        renderToHardwareTextureAndroid={true}
                        style={{
                            position: "absolute",
                            top: 0,
                            ...(position === "left" ? { left: 0 } : { right: 0 }),
                            bottom: 0,
                            width: Platform.OS === "web" ? width : "90%",
                            maxWidth: width,
                            transform: [{ translateX }]
                        }}
                    >
                        <View
                            style={{
                                flex: 1,
                                marginTop: 16 + insets.top,
                                marginBottom: 16 + insets.bottom,
                                marginLeft: 16 + (position === "left" ? insets.left : 0),
                                marginRight: 16 + (position === "right" ? insets.right : 0),
                                backgroundColor: theme.colors.surface,
                                borderRadius: 16,
                                overflow: "hidden",
                                boxShadow: theme.elevation.level1
                            }}
                        >
                            {cachedContent}
                        </View>
                    </Animated.View>
                </>
            )}
        </View>
    );
});
