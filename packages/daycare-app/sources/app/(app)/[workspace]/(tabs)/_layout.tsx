import { Slot } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useUnistyles } from "react-native-unistyles";

/**
 * Tab layout for workspace screens. On mobile phones, renders native bottom tabs.
 * On desktop/iPad, renders a transparent Slot (sidebar handles nav).
 */
export default function TabsLayout() {
    const { theme } = useUnistyles();
    const isMobile = theme.layout.isMobileLayout;

    if (!isMobile) {
        return <Slot />;
    }

    return (
        <NativeTabs
            backgroundColor={theme.colors.surface}
            tintColor={theme.colors.primary}
            iconColor={{ default: theme.colors.onSurfaceVariant, selected: theme.colors.primary }}
        >
            <NativeTabs.Trigger name="index">
                <NativeTabs.Trigger.Icon
                    sf={{ default: "square.and.pencil", selected: "square.and.pencil" }}
                    md="edit_note"
                />
                <NativeTabs.Trigger.Label>New task</NativeTabs.Trigger.Label>
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="settings">
                <NativeTabs.Trigger.Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} md="settings" />
                <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
            </NativeTabs.Trigger>
        </NativeTabs>
    );
}
