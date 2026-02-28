import { useCallback, useEffect, useMemo } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Item } from "@/components/Item";
import { ItemGroup } from "@/components/ItemGroup";
import { ItemListStatic } from "@/components/ItemList";
import { useAuthStore } from "@/modules/auth/authContext";
import { costsBreakdownByAgent } from "@/modules/costs/costsBreakdownByAgent";
import { costsBreakdownByModel } from "@/modules/costs/costsBreakdownByModel";
import { useCostsStore } from "@/modules/costs/costsContext";
import { costsFormatCurrency } from "@/modules/costs/costsFormatCurrency";
import { costsPeriodRange } from "@/modules/costs/costsPeriodRange";
import { costsSummarize } from "@/modules/costs/costsSummarize";
import { costsTimeSeries } from "@/modules/costs/costsTimeSeries";
import { CostsBarChart } from "./costs/CostsBarChart";
import { CostsPeriodSelector } from "./costs/CostsPeriodSelector";
import { CostsSummaryCard } from "./costs/CostsSummaryCard";

const styles = StyleSheet.create({
    centered: {
        alignItems: "center",
        justifyContent: "center",
        padding: 32
    },
    errorText: {
        fontSize: 14,
        fontFamily: "IBMPlexSans-Regular",
        textAlign: "center"
    }
});

export function CostsView() {
    const { theme } = useUnistyles();

    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);

    const period = useCostsStore((s) => s.period);
    const rows = useCostsStore((s) => s.rows);
    const loading = useCostsStore((s) => s.loading);
    const error = useCostsStore((s) => s.error);
    const setPeriod = useCostsStore((s) => s.setPeriod);
    const fetchCosts = useCostsStore((s) => s.fetch);

    const doFetch = useCallback(() => {
        if (baseUrl && token) {
            void fetchCosts(baseUrl, token);
        }
    }, [baseUrl, token, fetchCosts]);

    // Fetch on mount and when period changes
    useEffect(() => {
        doFetch();
    }, [doFetch, period]);

    const summary = useMemo(() => costsSummarize(rows), [rows]);
    const agentBreakdown = useMemo(() => costsBreakdownByAgent(rows), [rows]);
    const modelBreakdown = useMemo(() => costsBreakdownByModel(rows), [rows]);
    const timeBuckets = useMemo(() => {
        const range = costsPeriodRange(period);
        return costsTimeSeries(rows, range.from, range.to);
    }, [rows, period]);

    if (loading && rows.length === 0) {
        return (
            <View style={[styles.centered, { flex: 1 }]}>
                <ActivityIndicator color={theme.colors.primary} />
            </View>
        );
    }

    if (error && rows.length === 0) {
        return (
            <View style={[styles.centered, { flex: 1 }]}>
                <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
            </View>
        );
    }

    return (
        <ItemListStatic>
            <ItemGroup>
                <CostsPeriodSelector value={period} onChange={setPeriod} />
            </ItemGroup>
            <ItemGroup>
                <CostsSummaryCard summary={summary} period={period} />
            </ItemGroup>
            <ItemGroup title="Cost Over Time">
                <CostsBarChart buckets={timeBuckets} />
            </ItemGroup>
            {agentBreakdown.length > 0 && (
                <ItemGroup title="By Agent">
                    {agentBreakdown.map((entry) => (
                        <Item
                            key={entry.agentId}
                            title={entry.agentId}
                            subtitle={`${entry.rows} hourly rows`}
                            detail={costsFormatCurrency(entry.cost)}
                            showChevron={false}
                        />
                    ))}
                </ItemGroup>
            )}
            {modelBreakdown.length > 0 && (
                <ItemGroup title="By Model">
                    {modelBreakdown.map((entry) => (
                        <Item
                            key={entry.model}
                            title={entry.model}
                            subtitle={`${entry.rows} hourly rows`}
                            detail={costsFormatCurrency(entry.cost)}
                            showChevron={false}
                        />
                    ))}
                </ItemGroup>
            )}
        </ItemListStatic>
    );
}
