import { JSONUIProvider, Renderer, type Spec } from "@json-render/react-native";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { widgetsRegistry } from "@/widgets/widgetsComponents";

/**
 * Static spec showing practical UI patterns built from widgets.
 * No actions or state — purely visual examples of real-world layouts.
 */
const examplesSpec: Spec = {
    root: "root",
    elements: {
        root: {
            type: "ScrollArea",
            props: {},
            children: ["main"]
        },
        main: {
            type: "Column",
            props: { gap: "lg" },
            children: ["sectionProfile", "sectionSettings", "sectionNotifications", "sectionStats"]
        },

        // -- Profile Card --

        sectionProfile: {
            type: "Section",
            props: { title: "Profile Card", padding: "md" },
            children: ["profileCard"]
        },
        profileCard: {
            type: "Card",
            props: { surface: "low", elevation: "low", padding: "md" },
            children: ["profileRow"]
        },
        profileRow: {
            type: "Row",
            props: { gap: "md", alignItems: "center" },
            children: ["profileAvatar", "profileInfo", "profileAction"]
        },
        profileAvatar: { type: "Avatar", props: { initials: "JD", size: "lg" }, children: [] },
        profileInfo: {
            type: "Column",
            props: { flex: 1, gap: "xs" },
            children: ["profileName", "profileRole", "profileBadge"]
        },
        profileName: { type: "Text", props: { text: "Jane Doe", weight: "semibold", size: "lg" }, children: [] },
        profileRole: {
            type: "Text",
            props: { text: "Product Designer", size: "sm", color: "onSurfaceVariant" },
            children: []
        },
        profileBadge: {
            type: "Row",
            props: { gap: "xs" },
            children: ["badgeOnline", "badgeTeam"]
        },
        badgeOnline: { type: "Badge", props: { label: "Online", variant: "primary" }, children: [] },
        badgeTeam: { type: "Badge", props: { label: "Design Team", variant: "secondary" }, children: [] },
        profileAction: {
            type: "IconButton",
            props: { icon: "create-outline", variant: "standard" },
            children: []
        },

        // -- Settings --

        sectionSettings: {
            type: "Section",
            props: { title: "Settings", padding: "md" },
            children: ["settingsCol"]
        },
        settingsCol: {
            type: "Column",
            props: { gap: "sm" },
            children: ["settingNotif", "settingDark", "settingBio", "settingDivider", "settingsActions"]
        },
        settingNotif: { type: "Switch", props: { label: "Push notifications", checked: true }, children: [] },
        settingDark: { type: "Switch", props: { label: "Dark mode", checked: false }, children: [] },
        settingBio: { type: "Checkbox", props: { label: "Biometric login", checked: true }, children: [] },
        settingDivider: { type: "Divider", props: { spacing: "xs" }, children: [] },
        settingsActions: {
            type: "Row",
            props: { gap: "sm" },
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
            type: "ListItem",
            props: { title: "Build completed", subtitle: "v2.4.1 deployed to staging", showDivider: true },
            children: []
        },
        notif2: {
            type: "ListItem",
            props: { title: "New comment", subtitle: "Alex replied to your review", showDivider: true },
            children: []
        },
        notif3: {
            type: "ListItem",
            props: { title: "Scheduled maintenance", subtitle: "Tomorrow 2:00 AM UTC", showDivider: false },
            children: []
        },

        // -- Stats Dashboard --

        sectionStats: {
            type: "Section",
            props: { title: "Dashboard", padding: "md" },
            children: ["statsRow", "statsDivider", "statsFooter"]
        },
        statsRow: {
            type: "Row",
            props: { gap: "sm" },
            children: ["statCard1", "statCard2", "statCard3"]
        },
        statCard1: {
            type: "Card",
            props: { surface: "low", padding: "md", elevation: "low" },
            children: ["statCol1"]
        },
        statCol1: {
            type: "Column",
            props: { gap: "xs", alignItems: "center" },
            children: ["statIcon1", "statValue1", "statLabel1"]
        },
        statIcon1: { type: "Icon", props: { name: "people", set: "Ionicons", color: "primary" }, children: [] },
        statValue1: { type: "Text", props: { text: "1,247", weight: "semibold", size: "lg" }, children: [] },
        statLabel1: {
            type: "Text",
            props: { text: "Users", size: "xs", color: "onSurfaceVariant" },
            children: []
        },
        statCard2: {
            type: "Card",
            props: { surface: "low", padding: "md", elevation: "low" },
            children: ["statCol2"]
        },
        statCol2: {
            type: "Column",
            props: { gap: "xs", alignItems: "center" },
            children: ["statIcon2", "statValue2", "statLabel2"]
        },
        statIcon2: {
            type: "Icon",
            props: { name: "checkmark-circle", set: "Ionicons", color: "tertiary" },
            children: []
        },
        statValue2: { type: "Text", props: { text: "89%", weight: "semibold", size: "lg" }, children: [] },
        statLabel2: {
            type: "Text",
            props: { text: "Uptime", size: "xs", color: "onSurfaceVariant" },
            children: []
        },
        statCard3: {
            type: "Card",
            props: { surface: "low", padding: "md", elevation: "low" },
            children: ["statCol3"]
        },
        statCol3: {
            type: "Column",
            props: { gap: "xs", alignItems: "center" },
            children: ["statIcon3", "statValue3", "statLabel3"]
        },
        statIcon3: { type: "Icon", props: { name: "flash", set: "Ionicons", color: "error" }, children: [] },
        statValue3: { type: "Text", props: { text: "42ms", weight: "semibold", size: "lg" }, children: [] },
        statLabel3: {
            type: "Text",
            props: { text: "Latency", size: "xs", color: "onSurfaceVariant" },
            children: []
        },
        statsDivider: { type: "Divider", props: { spacing: "xs" }, children: [] },
        statsFooter: {
            type: "Banner",
            props: { text: "All systems operational", variant: "success" },
            children: []
        }
    }
};

/**
 * Renders practical UI examples built entirely from widgets.
 * Shows real-world patterns: profile cards, settings, notifications, dashboards.
 */
export function ExamplesView() {
    return (
        <View style={styles.container}>
            <JSONUIProvider registry={widgetsRegistry}>
                <Renderer spec={examplesSpec} registry={widgetsRegistry} includeStandard={false} />
            </JSONUIProvider>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    }
});
