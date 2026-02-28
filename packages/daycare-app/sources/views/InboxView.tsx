import { View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Item } from "@/components/Item";
import { ItemGroup } from "@/components/ItemGroup";
import { ItemListStatic } from "@/components/ItemList";

function PriorityDot({ priority }: { priority: "high" | "medium" | "low" }) {
    const { theme } = useUnistyles();
    const colors: Record<string, string> = {
        high: theme.colors.error,
        medium: "#ed6c02",
        low: theme.colors.onSurfaceVariant
    };
    return <View style={[dotStyles.dot, { backgroundColor: colors[priority] }]} />;
}

const dotStyles = StyleSheet.create({
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4
    }
});

const boldTitle = { fontFamily: "IBMPlexSans-SemiBold" as const };

export function InboxView() {
    return (
        <ItemListStatic>
            <ItemGroup title="Action Required">
                <Item
                    title="Review PR #156 — agent heartbeat refactor"
                    subtitle="Jordan Chen assigned you · 10m ago"
                    titleStyle={boldTitle}
                    leftElement={<PriorityDot priority="high" />}
                    showChevron={false}
                />
                <Item
                    title="Approve cost report for February"
                    subtitle="Sam Patel requested approval · 1h ago"
                    titleStyle={boldTitle}
                    leftElement={<PriorityDot priority="high" />}
                    showChevron={false}
                />
                <Item
                    title="Operator agent error — needs investigation"
                    subtitle="System alert · 2h ago"
                    titleStyle={boldTitle}
                    leftElement={<PriorityDot priority="medium" />}
                    showChevron={false}
                />
            </ItemGroup>
            <ItemGroup title="Notifications">
                <Item
                    title="Scout completed research task"
                    subtitle="Finished 'Q1 competitor analysis' · 3h ago"
                    leftElement={<PriorityDot priority="low" />}
                    showChevron={false}
                />
                <Item
                    title="Builder deployed v2.4.1"
                    subtitle="Auto-deploy to staging · 5h ago"
                    leftElement={<PriorityDot priority="low" />}
                    showChevron={false}
                />
                <Item
                    title="Weekly digest ready"
                    subtitle="7 agents ran 1,240 tasks this week · Yesterday"
                    leftElement={<PriorityDot priority="low" />}
                    showChevron={false}
                />
                <Item
                    title="Morgan Lee joined the workspace"
                    subtitle="Invited by Alex Rivera · Feb 26"
                    leftElement={<PriorityDot priority="low" />}
                    showChevron={false}
                />
            </ItemGroup>
        </ItemListStatic>
    );
}
