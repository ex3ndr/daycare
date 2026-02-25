import { Octicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Avatar } from "@/components/Avatar";

export type AppMode = "agents" | "chat" | "settings";

type AppHeaderProps = {
    selectedMode: AppMode;
    onModeChange: (mode: AppMode) => void;
};

export const AppHeader = React.memo<AppHeaderProps>(({ selectedMode, onModeChange }) => {
    const { theme } = useUnistyles();
    const safeAreaInsets = useSafeAreaInsets();

    return (
        <View
            style={[
                styles.appHeader,
                {
                    height: 56 + safeAreaInsets.top,
                    paddingTop: safeAreaInsets.top,
                    backgroundColor: theme.colors.surface
                }
            ]}
        >
            <View style={styles.appHeaderContent}>
                <View style={styles.appHeaderLogoContainer}>
                    <Octicons name="hubot" size={20} color={theme.colors.onSurface} />
                    <Text style={[styles.appHeaderTitle, { color: theme.colors.onSurface }]}>Daycare</Text>
                </View>

                <View style={[styles.segmentedControl, { backgroundColor: theme.colors.surfaceContainerHighest }]}>
                    <Pressable
                        testID="segment-agents"
                        onPress={() => onModeChange("agents")}
                        style={[
                            styles.segmentButton,
                            selectedMode === "agents" && { backgroundColor: theme.colors.surfaceContainer }
                        ]}
                    >
                        <Octicons
                            name="device-desktop"
                            size={16}
                            color={selectedMode === "agents" ? theme.colors.onSurface : theme.colors.onSurfaceVariant}
                        />
                        <Text
                            style={[
                                styles.segmentButtonText,
                                {
                                    color:
                                        selectedMode === "agents"
                                            ? theme.colors.onSurface
                                            : theme.colors.onSurfaceVariant
                                }
                            ]}
                        >
                            Agents
                        </Text>
                    </Pressable>

                    <Pressable
                        testID="segment-chat"
                        onPress={() => onModeChange("chat")}
                        style={[
                            styles.segmentButton,
                            selectedMode === "chat" && { backgroundColor: theme.colors.surfaceContainer }
                        ]}
                    >
                        <Octicons
                            name="comment-discussion"
                            size={16}
                            color={selectedMode === "chat" ? theme.colors.onSurface : theme.colors.onSurfaceVariant}
                        />
                        <Text
                            style={[
                                styles.segmentButtonText,
                                {
                                    color:
                                        selectedMode === "chat" ? theme.colors.onSurface : theme.colors.onSurfaceVariant
                                }
                            ]}
                        >
                            Chat
                        </Text>
                    </Pressable>

                    <Pressable
                        testID="segment-settings"
                        onPress={() => onModeChange("settings")}
                        style={[
                            styles.segmentButton,
                            selectedMode === "settings" && { backgroundColor: theme.colors.surfaceContainer }
                        ]}
                    >
                        <Octicons
                            name="gear"
                            size={16}
                            color={selectedMode === "settings" ? theme.colors.onSurface : theme.colors.onSurfaceVariant}
                        />
                        <Text
                            style={[
                                styles.segmentButtonText,
                                {
                                    color:
                                        selectedMode === "settings"
                                            ? theme.colors.onSurface
                                            : theme.colors.onSurfaceVariant
                                }
                            ]}
                        >
                            Settings
                        </Text>
                    </Pressable>
                </View>

                <View style={styles.rightSide}>
                    <Avatar id="daycare-user" size={32} />
                </View>
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    appHeader: {
        width: "100%"
    },
    appHeaderContent: {
        height: 56,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingLeft: 24,
        paddingRight: 24
    },
    appHeaderLogoContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        width: 180
    },
    appHeaderTitle: {
        fontSize: 18,
        fontWeight: "600"
    },
    segmentedControl: {
        flexDirection: "row",
        alignItems: "center",
        height: 40,
        borderRadius: 20,
        padding: 4,
        gap: 4
    },
    segmentButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 16,
        gap: 6
    },
    segmentButtonText: {
        fontSize: 14,
        fontWeight: "500"
    },
    rightSide: {
        width: 180,
        alignItems: "flex-end",
        justifyContent: "center"
    }
});
