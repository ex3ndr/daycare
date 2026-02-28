import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Item } from "@/components/Item";
import { ItemGroup } from "@/components/ItemGroup";
import { ItemListStatic } from "@/components/ItemList";

function RoutineStatus({ status, nextRun }: { status: "ok" | "warning" | "disabled"; nextRun?: string }) {
    const { theme } = useUnistyles();
    const colors: Record<string, string> = {
        ok: "#2e7d32",
        warning: "#ed6c02",
        disabled: theme.colors.onSurfaceVariant
    };
    return (
        <View style={routineStyles.container}>
            {nextRun && <Text style={[routineStyles.nextRun, { color: theme.colors.onSurfaceVariant }]}>{nextRun}</Text>}
            <View style={[routineStyles.dot, { backgroundColor: colors[status] }]} />
        </View>
    );
}

const routineStyles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4
    },
    nextRun: {
        fontSize: 13,
        fontFamily: "IBMPlexSans-Regular"
    }
});

export function RoutinesView() {
    return (
        <ItemListStatic>
            <ItemGroup title="Active">
                <Item
                    title="Agent Heartbeat"
                    subtitle="*/5 * * * * — every 5 minutes"
                    rightElement={<RoutineStatus status="ok" nextRun="in 3m" />}
                    showChevron={false}
                />
                <Item
                    title="Cost Aggregation"
                    subtitle="0 */6 * * * — every 6 hours"
                    rightElement={<RoutineStatus status="ok" nextRun="in 2h" />}
                    showChevron={false}
                />
                <Item
                    title="Email Digest"
                    subtitle="0 9 * * 1-5 — weekdays at 9am"
                    rightElement={<RoutineStatus status="ok" nextRun="Mon 9:00" />}
                    showChevron={false}
                />
                <Item
                    title="Log Rotation"
                    subtitle="0 0 * * * — daily at midnight"
                    rightElement={<RoutineStatus status="warning" nextRun="00:00" />}
                    showChevron={false}
                />
            </ItemGroup>
            <ItemGroup title="Disabled">
                <Item
                    title="Weekly Report"
                    subtitle="0 8 * * 1 — Mondays at 8am"
                    rightElement={<RoutineStatus status="disabled" />}
                    showChevron={false}
                />
                <Item
                    title="DB Backup"
                    subtitle="0 3 * * * — daily at 3am"
                    rightElement={<RoutineStatus status="disabled" />}
                    showChevron={false}
                />
            </ItemGroup>
        </ItemListStatic>
    );
}
