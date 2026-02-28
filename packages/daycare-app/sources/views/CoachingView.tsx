import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Item } from "@/components/Item";
import { ItemGroup } from "@/components/ItemGroup";
import { ItemListStatic } from "@/components/ItemList";

function ProgressBar({ progress, color }: { progress: number; color: string }) {
    const { theme } = useUnistyles();
    return (
        <View style={[barStyles.track, { backgroundColor: theme.colors.surfaceContainerHighest }]}>
            <View style={[barStyles.fill, { width: `${progress}%`, backgroundColor: color }]} />
        </View>
    );
}

const barStyles = StyleSheet.create({
    track: {
        height: 6,
        borderRadius: 3,
        width: 80
    },
    fill: {
        height: 6,
        borderRadius: 3
    }
});

function ProgressDetail({ progress, color }: { progress: number; color: string }) {
    return (
        <View style={detailStyles.container}>
            <ProgressBar progress={progress} color={color} />
            <Text style={[detailStyles.pct, { color }]}>{progress}%</Text>
        </View>
    );
}

const detailStyles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    pct: {
        fontSize: 12,
        fontFamily: "IBMPlexMono-Regular"
    }
});

export function CoachingView() {
    return (
        <ItemListStatic>
            <ItemGroup title="Daily Habits">
                <Item
                    title="Review agent outputs before sharing"
                    subtitle="Build a habit of spot-checking before forwarding to clients"
                    rightElement={<ProgressDetail progress={85} color="#4caf50" />}
                    showChevron={false}
                />
                <Item
                    title="Set clear goals for each agent task"
                    subtitle="Specific instructions lead to 3x better results"
                    rightElement={<ProgressDetail progress={60} color="#ffb74d" />}
                    showChevron={false}
                />
                <Item
                    title="Check cost dashboard weekly"
                    subtitle="Stay aware of spend trends before they become surprises"
                    rightElement={<ProgressDetail progress={40} color="#ef5350" />}
                    showChevron={false}
                />
            </ItemGroup>
            <ItemGroup title="Tips from Your Agents">
                <Item
                    title="You often re-run Scout with the same query"
                    subtitle="Try saving frequent searches as routines to save time"
                    detail="Scout"
                    showChevron={false}
                />
                <Item
                    title="Builder works better with example code"
                    subtitle="Tasks with code samples had 40% fewer revision cycles"
                    detail="Builder"
                    showChevron={false}
                />
                <Item
                    title="Operator needs clearer rollback criteria"
                    subtitle="2 recent deploys lacked success/failure definitions"
                    detail="Operator"
                    showChevron={false}
                />
                <Item
                    title="Your email responses peak at 2pm"
                    subtitle="Consider scheduling a focused review block after lunch"
                    detail="Monitor"
                    showChevron={false}
                />
            </ItemGroup>
            <ItemGroup title="Weekly Insights">
                <Item
                    title="Delegation score: 7.2 / 10"
                    subtitle="You delegated 72% of eligible tasks — up from 65% last week"
                    showChevron={false}
                />
                <Item
                    title="Average feedback loop: 12 min"
                    subtitle="Down from 18 min — agents are learning your preferences"
                    showChevron={false}
                />
                <Item
                    title="Most effective agent: Reviewer"
                    subtitle="0 revisions needed on last 8 code reviews"
                    showChevron={false}
                />
            </ItemGroup>
            <ItemGroup title="Completed">
                <Item
                    title="Write effective agent prompts"
                    subtitle="Learned structured prompt patterns for consistent results"
                    rightElement={<ProgressDetail progress={100} color="#1565c0" />}
                    showChevron={false}
                />
                <Item
                    title="Manage agent permissions safely"
                    subtitle="Understood least-privilege access for each agent role"
                    rightElement={<ProgressDetail progress={100} color="#1565c0" />}
                    showChevron={false}
                />
            </ItemGroup>
        </ItemListStatic>
    );
}
