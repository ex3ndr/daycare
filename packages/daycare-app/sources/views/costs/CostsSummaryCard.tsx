import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { costsFormatCurrency } from "@/modules/costs/costsFormatCurrency";
import type { CostsPeriod, CostsSummary } from "@/modules/costs/costsTypes";

const PERIOD_LABELS: Record<CostsPeriod, string> = {
    "24h": "Last 24 hours",
    "7d": "Last 7 days",
    "30d": "Last 30 days"
};

export function CostsSummaryCard({
    summary,
    period
}: {
    summary: CostsSummary;
    period: CostsPeriod;
}) {
    const { theme } = useUnistyles();

    return (
        <View style={styles.container}>
            <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>
                {PERIOD_LABELS[period]}
            </Text>
            <Text style={[styles.total, { color: theme.colors.onSurface }]}>
                {costsFormatCurrency(summary.totalCost)}
            </Text>
            <View style={styles.statsRow}>
                <View style={styles.statItem}>
                    <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>
                        Input
                    </Text>
                    <Text style={[styles.statValue, { color: theme.colors.onSurface }]}>
                        {formatTokenCount(summary.totalInput)}
                    </Text>
                </View>
                <View style={styles.statItem}>
                    <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>
                        Output
                    </Text>
                    <Text style={[styles.statValue, { color: theme.colors.onSurface }]}>
                        {formatTokenCount(summary.totalOutput)}
                    </Text>
                </View>
                <View style={styles.statItem}>
                    <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>
                        Cache
                    </Text>
                    <Text style={[styles.statValue, { color: theme.colors.onSurface }]}>
                        {formatTokenCount(summary.totalCacheRead + summary.totalCacheWrite)}
                    </Text>
                </View>
            </View>
        </View>
    );
}

function formatTokenCount(value: number): string {
    if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1_000) {
        return `${(value / 1_000).toFixed(1)}K`;
    }
    return String(Math.trunc(value));
}

const styles = StyleSheet.create({
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
    statsRow: {
        flexDirection: "row",
        marginTop: 12,
        gap: 24
    },
    statItem: {
        alignItems: "center",
        gap: 2
    },
    statLabel: {
        fontSize: 12,
        fontFamily: "IBMPlexSans-Regular"
    },
    statValue: {
        fontSize: 14,
        fontFamily: "IBMPlexSans-SemiBold"
    }
});
