import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Item } from "@/components/Item";
import { ItemGroup } from "@/components/ItemGroup";
import { ItemListStatic } from "@/components/ItemList";

function CostSummary() {
    const { theme } = useUnistyles();
    return (
        <View style={summaryStyles.container}>
            <Text style={[summaryStyles.label, { color: theme.colors.onSurfaceVariant }]}>February 2026</Text>
            <Text style={[summaryStyles.total, { color: theme.colors.onSurface }]}>$142.50</Text>
            <Text style={[summaryStyles.change, { color: "#2e7d32" }]}>-12% vs last month</Text>
        </View>
    );
}

const summaryStyles = StyleSheet.create({
    container: {
        alignItems: "center",
        paddingVertical: 24,
        gap: 4
    },
    label: {
        fontSize: 14,
        fontFamily: "IBMPlexSans-Regular"
    },
    total: {
        fontSize: 36,
        fontFamily: "IBMPlexSans-SemiBold"
    },
    change: {
        fontSize: 14,
        fontFamily: "IBMPlexSans-Regular"
    }
});

export function CostsView() {
    return (
        <ItemListStatic>
            <ItemGroup>
                <CostSummary />
            </ItemGroup>
            <ItemGroup title="By Agent">
                <Item title="Scout" subtitle="1,240 requests" detail="$45.20" showChevron={false} />
                <Item title="Builder" subtitle="892 requests" detail="$38.70" showChevron={false} />
                <Item title="Operator" subtitle="2,105 requests" detail="$28.40" showChevron={false} />
                <Item title="Reviewer" subtitle="310 requests" detail="$12.80" showChevron={false} />
                <Item title="Scheduler" subtitle="156 requests" detail="$8.50" showChevron={false} />
                <Item title="Monitor" subtitle="3,420 requests" detail="$4.10" showChevron={false} />
            </ItemGroup>
            <ItemGroup title="By Service">
                <Item title="Claude API" subtitle="Inference tokens" detail="$98.30" showChevron={false} />
                <Item title="Vercel" subtitle="Hosting and edge functions" detail="$22.00" showChevron={false} />
                <Item title="Postgres" subtitle="Database queries and storage" detail="$14.20" showChevron={false} />
                <Item title="S3 Storage" subtitle="File storage and bandwidth" detail="$8.00" showChevron={false} />
            </ItemGroup>
        </ItemListStatic>
    );
}
