import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Item } from "@/components/Item";
import { ItemGroup } from "@/components/ItemGroup";
import { ItemListStatic } from "@/components/ItemList";

function StockBadge({ count, low }: { count: number; low?: boolean }) {
    const { theme } = useUnistyles();
    const color = low ? theme.colors.error : theme.colors.onSurfaceVariant;
    return (
        <View style={stockStyles.container}>
            <Text style={[stockStyles.count, { color }]}>{count}</Text>
            {low && <View style={[stockStyles.dot, { backgroundColor: theme.colors.error }]} />}
        </View>
    );
}

const stockStyles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6
    },
    count: {
        fontSize: 14,
        fontFamily: "IBMPlexSans-SemiBold"
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4
    }
});

export function InventoryView() {
    return (
        <ItemListStatic>
            <ItemGroup title="API Keys & Tokens">
                <Item
                    title="OpenAI API Key"
                    subtitle="gpt-4o · Expires Apr 2026"
                    rightElement={<StockBadge count={3} />}
                    showChevron={false}
                />
                <Item
                    title="Anthropic API Key"
                    subtitle="claude-opus · No expiry"
                    rightElement={<StockBadge count={2} />}
                    showChevron={false}
                />
                <Item
                    title="Telegram Bot Token"
                    subtitle="daycare-bot · Expires Mar 2026"
                    rightElement={<StockBadge count={1} low />}
                    showChevron={false}
                />
            </ItemGroup>
            <ItemGroup title="Compute">
                <Item
                    title="Vercel Functions"
                    subtitle="Pro plan · 1M invocations/mo"
                    detail="840K used"
                    showChevron={false}
                />
                <Item title="Worker Slots" subtitle="8 available · 3 regions" detail="5 active" showChevron={false} />
                <Item title="GPU Instances" subtitle="A100 · us-east-1" detail="0 active" showChevron={false} />
            </ItemGroup>
            <ItemGroup title="Storage">
                <Item title="Postgres Database" subtitle="Neon · 2 branches" detail="4.2 GB" showChevron={false} />
                <Item title="S3 Bucket" subtitle="daycare-files · us-east-1" detail="18.7 GB" showChevron={false} />
                <Item title="Redis Cache" subtitle="Upstash · 256 MB plan" detail="112 MB" showChevron={false} />
            </ItemGroup>
            <ItemGroup title="Integrations">
                <Item title="GitHub" subtitle="ex3ndr/daycare · Connected" detail="Active" showChevron={false} />
                <Item title="Slack" subtitle="daycare-workspace · 4 channels" detail="Active" showChevron={false} />
                <Item title="Linear" subtitle="Daycare project · Synced" detail="Active" showChevron={false} />
                <Item title="Stripe" subtitle="Live mode · 2 products" detail="Active" showChevron={false} />
            </ItemGroup>
        </ItemListStatic>
    );
}
