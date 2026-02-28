import * as React from "react";
import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import type { CostsTimeBucket } from "@/modules/costs/costsTypes";

const CHART_HEIGHT = 160;
const MAX_BARS = 60;

export function CostsBarChart({ buckets }: { buckets: CostsTimeBucket[] }) {
    const { theme } = useUnistyles();

    if (buckets.length === 0) {
        return (
            <View style={[styles.emptyContainer, { height: CHART_HEIGHT }]}>
                <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                    No data
                </Text>
            </View>
        );
    }

    // Downsample if too many buckets
    const bars = buckets.length > MAX_BARS ? barsDownsample(buckets, MAX_BARS) : buckets;
    const maxCost = Math.max(...bars.map((b) => b.cost), 0);

    // X-axis labels: start, middle, end
    const labelStart = formatTimestamp(bars[0].timestamp);
    const labelEnd = formatTimestamp(bars[bars.length - 1].timestamp);
    const midIndex = Math.floor(bars.length / 2);
    const labelMid = formatTimestamp(bars[midIndex].timestamp);

    return (
        <View style={styles.container}>
            <View
                style={[
                    styles.chartArea,
                    { height: CHART_HEIGHT, backgroundColor: theme.colors.surfaceContainerLow }
                ]}
            >
                {bars.map((bar, index) => {
                    const height = maxCost > 0 ? (bar.cost / maxCost) * (CHART_HEIGHT - 8) : 0;
                    return (
                        <View key={index} style={styles.barWrapper}>
                            <View
                                style={[
                                    styles.bar,
                                    {
                                        height: Math.max(height, bar.cost > 0 ? 2 : 0),
                                        backgroundColor: theme.colors.primary
                                    }
                                ]}
                            />
                        </View>
                    );
                })}
            </View>
            <View style={styles.xAxis}>
                <Text style={[styles.xLabel, { color: theme.colors.onSurfaceVariant }]}>
                    {labelStart}
                </Text>
                <Text style={[styles.xLabel, { color: theme.colors.onSurfaceVariant }]}>
                    {labelMid}
                </Text>
                <Text style={[styles.xLabel, { color: theme.colors.onSurfaceVariant }]}>
                    {labelEnd}
                </Text>
            </View>
        </View>
    );
}

/** Groups buckets into fewer bars by summing costs within each group. */
function barsDownsample(buckets: CostsTimeBucket[], target: number): CostsTimeBucket[] {
    const groupSize = Math.ceil(buckets.length / target);
    const result: CostsTimeBucket[] = [];
    for (let i = 0; i < buckets.length; i += groupSize) {
        const group = buckets.slice(i, i + groupSize);
        const cost = group.reduce((sum, b) => sum + b.cost, 0);
        result.push({ timestamp: group[0].timestamp, cost });
    }
    return result;
}

function formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    const month = date.toLocaleDateString(undefined, { month: "short" });
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${month} ${day} ${hours}:${minutes}`;
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingVertical: 8
    },
    chartArea: {
        flexDirection: "row",
        alignItems: "flex-end",
        borderRadius: 8,
        paddingHorizontal: 4,
        paddingBottom: 4,
        paddingTop: 4,
        gap: 1
    },
    barWrapper: {
        flex: 1,
        alignItems: "center",
        justifyContent: "flex-end"
    },
    bar: {
        width: "100%",
        borderRadius: 1,
        minWidth: 1
    },
    emptyContainer: {
        marginHorizontal: 16,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center"
    },
    emptyText: {
        fontSize: 14,
        fontFamily: "IBMPlexSans-Regular"
    },
    xAxis: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 4,
        paddingHorizontal: 2
    },
    xLabel: {
        fontSize: 10,
        fontFamily: "IBMPlexSans-Regular"
    }
});
