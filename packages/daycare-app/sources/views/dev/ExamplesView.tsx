import { createStateStore, JSONUIProvider, Renderer, type Spec } from "@json-render/react-native";
import * as React from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { fragmentsRegistry } from "@/fragments/registry";

/**
 * Static spec showing practical UI patterns built from fragment components.
 */
const examplesSpec: Spec = {
    root: "root",
    elements: {
        root: {
            type: "ScrollView",
            props: {},
            children: ["main"]
        },
        main: {
            type: "View",
            props: { direction: "column", gap: "lg" },
            children: ["sectionProfile", "sectionSettings", "sectionNotifications", "sectionStats"]
        },

        // -- Profile Card --

        sectionProfile: {
            type: "Section",
            props: { title: "Profile Card", padding: "md", gap: "sm" },
            children: ["profileCard"]
        },
        profileCard: {
            type: "Card",
            props: { surface: "low", elevation: "low", padding: "md" },
            children: ["profileRow"]
        },
        profileRow: {
            type: "View",
            props: { direction: "row", gap: "md", alignItems: "center" },
            children: ["profileIcon", "profileInfo", "profileAction"]
        },
        profileIcon: {
            type: "Icon",
            props: { name: "person-circle", set: "Ionicons", size: 34, color: "primary" },
            children: []
        },
        profileInfo: {
            type: "View",
            props: { direction: "column", gap: "xs", flexGrow: 1 },
            children: ["profileName", "profileRole"]
        },
        profileName: { type: "Text", props: { text: "Jane Doe", weight: "semibold", size: "lg" }, children: [] },
        profileRole: {
            type: "Text",
            props: { text: "Product Designer", size: "sm", color: "onSurfaceVariant" },
            children: []
        },
        profileAction: {
            type: "IconButton",
            props: { icon: "create-outline", variant: "standard" },
            children: []
        },

        // -- Settings --

        sectionSettings: {
            type: "Section",
            props: { title: "Settings", padding: "md", gap: "sm" },
            children: ["settingNotif", "settingDark", "settingBio", "settingDivider", "settingsActions"]
        },
        settingNotif: { type: "Switch", props: { label: "Push notifications", checked: true }, children: [] },
        settingDark: { type: "Switch", props: { label: "Dark mode", checked: false }, children: [] },
        settingBio: { type: "Checkbox", props: { label: "Biometric login", checked: true }, children: [] },
        settingDivider: { type: "Divider", props: { spacing: "xs" }, children: [] },
        settingsActions: {
            type: "View",
            props: { direction: "row", gap: "sm" },
            children: ["settingSave", "settingReset"]
        },
        settingSave: { type: "Button", props: { label: "Save", variant: "filled", size: "sm" }, children: [] },
        settingReset: { type: "Button", props: { label: "Reset", variant: "outlined", size: "sm" }, children: [] },

        // -- Notifications --

        sectionNotifications: {
            type: "Section",
            props: { title: "Notifications" },
            children: ["notif1", "notif2", "notif3"]
        },
        notif1: {
            type: "Item",
            props: { title: "Build completed", subtitle: "v2.4.1 deployed to staging", showDivider: true },
            children: []
        },
        notif2: {
            type: "Item",
            props: { title: "New comment", subtitle: "Alex replied to your review", showDivider: true },
            children: []
        },
        notif3: {
            type: "Item",
            props: { title: "Scheduled maintenance", subtitle: "Tomorrow 2:00 AM UTC", showDivider: false },
            children: []
        },

        // -- Stats --

        sectionStats: {
            type: "Section",
            props: { title: "Dashboard", padding: "md", gap: "sm" },
            children: ["statsUptimeLabel", "statsUptimeBar", "statsLatency"]
        },
        statsUptimeLabel: {
            type: "Text",
            props: { text: "Uptime: 89%", size: "sm", color: "onSurfaceVariant" },
            children: []
        },
        statsUptimeBar: {
            type: "ProgressBar",
            props: { value: 0.89, color: "tertiary" },
            children: []
        },
        statsLatency: {
            type: "Text",
            props: { text: "Latency: 42ms", size: "sm", color: "onSurfaceVariant" },
            children: []
        }
    }
};

/**
 * Renders practical UI examples built entirely from fragment components.
 */
export function ExamplesView() {
    const store = React.useMemo(() => createStateStore(examplesSpec.state ?? {}), []);

    return (
        <View style={styles.container}>
            <JSONUIProvider registry={fragmentsRegistry} store={store}>
                <Renderer spec={examplesSpec} registry={fragmentsRegistry} includeStandard={false} />
            </JSONUIProvider>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    }
});
