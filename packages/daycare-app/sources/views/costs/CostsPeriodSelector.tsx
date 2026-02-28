import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { SegmentedControl, type SegmentedControlOption } from "@/components/SegmentedControl";
import type { CostsPeriod } from "@/modules/costs/costsTypes";

const PERIOD_OPTIONS: SegmentedControlOption<CostsPeriod>[] = [
    { value: "24h", label: "24h" },
    { value: "7d", label: "7d" },
    { value: "30d", label: "30d" }
];

export function CostsPeriodSelector({
    value,
    onChange
}: {
    value: CostsPeriod;
    onChange: (period: CostsPeriod) => void;
}) {
    return (
        <View style={styles.container}>
            <SegmentedControl options={PERIOD_OPTIONS} value={value} onChange={onChange} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        alignItems: "center"
    }
});
