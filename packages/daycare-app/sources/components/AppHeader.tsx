import { Octicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as React from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

type AppHeaderProps = {
    title?: string;
    canGoBack?: boolean;
};

/**
 * Custom app header replacing native navigation bar.
 * Handles safe area insets and renders a back button when navigation history exists.
 * Use as Stack.Screen `header` option to replace the native header.
 */
export const AppHeader = React.memo(function AppHeader({ title, canGoBack }: AppHeaderProps) {
    const { theme } = useUnistyles();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    return (
        <View
            style={[
                styles.container,
                {
                    paddingTop: insets.top,
                    backgroundColor: theme.colors.surface
                }
            ]}
        >
            <View style={styles.row}>
                {canGoBack ? (
                    <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
                        <Octicons
                            name={Platform.OS === "android" ? "arrow-left" : "chevron-left"}
                            size={28}
                            color={theme.colors.onSurface}
                        />
                    </Pressable>
                ) : (
                    <View style={styles.backButton} />
                )}
                {title ? (
                    <View style={styles.titleContainer}>
                        <Text style={[styles.title, { color: theme.colors.onSurface }]} numberOfLines={1}>
                            {title}
                        </Text>
                    </View>
                ) : (
                    <View style={styles.titleContainer} />
                )}
                <View style={styles.backButton} />
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        width: "100%"
    },
    row: {
        height: 56,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12
    },
    backButton: {
        width: 40,
        height: 40,
        alignItems: "center",
        justifyContent: "center"
    },
    titleContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center"
    },
    title: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 18
    }
});
