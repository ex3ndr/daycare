import { MaterialCommunityIcons, Octicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as React from "react";
import { Platform, Pressable, Text, View } from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

type HeaderProps = {
    title?: string;
    onBack: () => void;
    onMenuPress?: () => void;
    onFavoritePress?: () => void;
    isFavorite?: boolean;
    rightComponent?: React.ReactNode;
    safeAreaInsets: EdgeInsets;
};

export const Header = React.memo((props: HeaderProps) => {
    const { theme } = useUnistyles();

    // Convert hex color to rgba for gradient
    const headerColor = theme.colors.surfaceContainerLow;
    const rgbaColor = React.useMemo(() => {
        let hex = headerColor.replace("#", "");
        if (hex.length === 3) {
            hex = hex
                .split("")
                .map((char) => char + char)
                .join("");
        }
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return { r, g, b };
    }, [headerColor]);

    return (
        <>
            {/* Custom Header */}
            <View
                style={[
                    styles.header,
                    {
                        height: 56 + props.safeAreaInsets.top,
                        paddingTop: props.safeAreaInsets.top
                    }
                ]}
            >
                <Pressable onPress={props.onBack} hitSlop={8} style={styles.backButton}>
                    <Octicons
                        name={Platform.OS === "android" ? "arrow-left" : "chevron-left"}
                        size={28}
                        color={theme.colors.onSurface}
                    />
                </Pressable>
                {props.title && (
                    <View style={styles.titleContainer}>
                        <Text style={[styles.title, { color: theme.colors.onSurface }]} numberOfLines={1}>
                            {props.title}
                        </Text>
                    </View>
                )}
                {!props.title && <View style={{ flex: 1 }} />}
                {props.onMenuPress && (
                    <Pressable onPress={props.onMenuPress} hitSlop={8} style={styles.menuButton}>
                        <MaterialCommunityIcons
                            name="dots-horizontal-circle-outline"
                            size={32}
                            color={theme.colors.onSurfaceVariant}
                        />
                    </Pressable>
                )}
                {props.onFavoritePress && (
                    <Pressable onPress={props.onFavoritePress} hitSlop={8} style={styles.favoriteButton}>
                        <Octicons
                            name={props.isFavorite ? "star-fill" : "star"}
                            size={24}
                            color={props.isFavorite ? theme.colors.tertiary : theme.colors.onSurfaceVariant}
                        />
                    </Pressable>
                )}
                {props.rightComponent}
                {/* Empty view to balance the title when there's no menu/favorite/right button */}
                {!props.onMenuPress && !props.onFavoritePress && !props.rightComponent && (
                    <View style={styles.menuButton} />
                )}
            </View>

            {/* Header Gradient Overlay */}
            <View
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: props.safeAreaInsets.top + 56,
                    zIndex: 10,
                    flexDirection: "column",
                    alignItems: "stretch"
                }}
            >
                <View style={{ height: props.safeAreaInsets.top, backgroundColor: theme.colors.surfaceContainerLow }} />
                <LinearGradient
                    colors={[
                        `rgba(${rgbaColor.r}, ${rgbaColor.g}, ${rgbaColor.b}, 1)`,
                        `rgba(${rgbaColor.r}, ${rgbaColor.g}, ${rgbaColor.b}, 0)`
                    ]}
                    style={{ height: 56 }}
                    pointerEvents="none"
                />
            </View>
        </>
    );
});

const styles = StyleSheet.create({
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingBottom: 8,
        gap: 8,
        zIndex: 20,
        position: "absolute",
        top: 0,
        left: 0,
        right: 0
    },
    backButton: {
        width: 40,
        height: 40,
        alignItems: "center",
        justifyContent: "center"
    },
    titleContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center"
    },
    title: {
        fontSize: 20,
        fontWeight: "500"
    },
    menuButton: {
        width: 40,
        height: 40,
        alignItems: "center",
        justifyContent: "center"
    },
    favoriteButton: {
        width: 40,
        height: 40,
        alignItems: "center",
        justifyContent: "center"
    }
});
