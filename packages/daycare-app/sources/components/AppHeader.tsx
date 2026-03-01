import { Octicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Avatar } from "@/components/Avatar";

export type AppMode = "home" | "agents" | "people" | "email" | "inbox" | "todos" | "routines" | "costs" | "documents";

export const appModes: AppMode[] = [
    "home",
    "agents",
    "people",
    "email",
    "inbox",
    "todos",
    "routines",
    "costs",
    "documents"
];

const segments: Array<{ mode: AppMode; icon: React.ComponentProps<typeof Octicons>["name"]; label: string }> = [
    { mode: "agents", icon: "device-desktop", label: "Agents" },
    { mode: "people", icon: "people", label: "People" },
    { mode: "email", icon: "mail", label: "Email" },
    { mode: "inbox", icon: "inbox", label: "Inbox" },
    { mode: "todos", icon: "checklist", label: "Todos" },
    { mode: "routines", icon: "clock", label: "Routines" },
    { mode: "costs", icon: "credit-card", label: "Costs" },
    { mode: "documents", icon: "file", label: "Documents" }
];

/**
 * Extracts the current AppMode from the pathname.
 * E.g. "/agents" -> "agents", "/agents/a1" -> "agents".
 */
function extractModeFromPath(pathname: string): AppMode {
    const segment = pathname.split("/").filter(Boolean)[0];
    if (segment && appModes.includes(segment as AppMode)) {
        return segment as AppMode;
    }
    return "agents";
}

export const AppHeader = React.memo(() => {
    const { theme } = useUnistyles();
    const safeAreaInsets = useSafeAreaInsets();
    const pathname = usePathname();
    const router = useRouter();

    const selectedMode = extractModeFromPath(pathname);

    const handleModeChange = React.useCallback(
        (mode: AppMode) => {
            router.replace(`/${mode}` as `/${string}`);
        },
        [router]
    );

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

                <View style={styles.segmentedControlContainer}>
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
                                    onPress={() => handleModeChange(seg.mode)}
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
    segmentedControlContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center"
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
