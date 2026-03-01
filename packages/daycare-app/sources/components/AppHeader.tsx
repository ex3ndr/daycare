import { Octicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Avatar } from "@/components/Avatar";

export type AppMode =
    | "agents"
    | "people"
    | "email"
    | "inbox"
    | "todos"
    | "routines"
    | "inventory"
    | "workflows"
    | "coaching"
    | "costs"
    | "documents";

const segments: Array<{ mode: AppMode; icon: React.ComponentProps<typeof Octicons>["name"]; label: string }> = [
    { mode: "agents", icon: "device-desktop", label: "Agents" },
    { mode: "people", icon: "people", label: "People" },
    { mode: "email", icon: "mail", label: "Email" },
    { mode: "inbox", icon: "inbox", label: "Inbox" },
    { mode: "todos", icon: "checklist", label: "Todos" },
    { mode: "routines", icon: "clock", label: "Routines" },
    { mode: "inventory", icon: "package", label: "Inventory" },
    { mode: "workflows", icon: "workflow", label: "Workflows" },
    { mode: "coaching", icon: "mortar-board", label: "Coaching" },
    { mode: "costs", icon: "credit-card", label: "Costs" },
    { mode: "documents", icon: "file", label: "Documents" }
];

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

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={[
                        styles.segmentedControl,
                        { backgroundColor: theme.colors.surfaceContainerHighest }
                    ]}
                >
                    {segments.map((seg) => {
                        const isSelected = selectedMode === seg.mode;
                        const color = isSelected ? theme.colors.onSurface : theme.colors.onSurfaceVariant;
                        return (
                            <Pressable
                                key={seg.mode}
                                testID={`segment-${seg.mode}`}
                                onPress={() => onModeChange(seg.mode)}
                                style={[
                                    styles.segmentButton,
                                    isSelected && { backgroundColor: theme.colors.surfaceContainer }
                                ]}
                            >
                                <Octicons name={seg.icon} size={16} color={color} />
                                <Text style={[styles.segmentButtonText, { color }]}>{seg.label}</Text>
                            </Pressable>
                        );
                    })}
                </ScrollView>

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
        paddingHorizontal: 12,
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
