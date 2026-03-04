import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

// --- Types ---

type Quarter = "Q1 2026" | "Q2 2026" | "Q3 2026" | "Q4 2026";
type Confidence = "on_track" | "at_risk" | "off_track";

type KeyResult = {
    id: string;
    title: string;
    current: number;
    target: number;
    unit: string;
    confidence: Confidence;
    owner: string;
};

type Objective = {
    id: string;
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
    keyResults: KeyResult[];
};

// --- Mock data ---

const QUARTERS: Quarter[] = ["Q1 2026", "Q2 2026", "Q3 2026", "Q4 2026"];

const objectives: Objective[] = [
    {
        id: "o1",
        title: "Accelerate Revenue Growth",
        icon: "trending-up-outline",
        keyResults: [
            {
                id: "kr1",
                title: "Increase MRR to $250K",
                current: 198,
                target: 250,
                unit: "$K",
                confidence: "on_track",
                owner: "SA"
            },
            {
                id: "kr2",
                title: "Close 15 enterprise deals",
                current: 9,
                target: 15,
                unit: "deals",
                confidence: "at_risk",
                owner: "MJ"
            },
            {
                id: "kr3",
                title: "Reduce churn rate to < 3%",
                current: 4.2,
                target: 3,
                unit: "%",
                confidence: "off_track",
                owner: "LK"
            }
        ]
    },
    {
        id: "o2",
        title: "Ship World-Class Product",
        icon: "rocket-outline",
        keyResults: [
            {
                id: "kr4",
                title: "Launch v3.0 with AI features",
                current: 85,
                target: 100,
                unit: "%",
                confidence: "on_track",
                owner: "TC"
            },
            {
                id: "kr5",
                title: "Achieve 99.95% uptime SLA",
                current: 99.91,
                target: 99.95,
                unit: "%",
                confidence: "at_risk",
                owner: "RD"
            },
            {
                id: "kr6",
                title: "Reduce p95 latency to < 200ms",
                current: 245,
                target: 200,
                unit: "ms",
                confidence: "at_risk",
                owner: "AW"
            },
            {
                id: "kr7",
                title: "Ship mobile app beta",
                current: 60,
                target: 100,
                unit: "%",
                confidence: "on_track",
                owner: "KP"
            }
        ]
    },
    {
        id: "o3",
        title: "Build a High-Performance Team",
        icon: "people-outline",
        keyResults: [
            {
                id: "kr8",
                title: "Hire 8 senior engineers",
                current: 5,
                target: 8,
                unit: "hires",
                confidence: "on_track",
                owner: "HR"
            },
            {
                id: "kr9",
                title: "Employee NPS score > 70",
                current: 62,
                target: 70,
                unit: "pts",
                confidence: "at_risk",
                owner: "JM"
            },
            {
                id: "kr10",
                title: "Complete leadership training for all managers",
                current: 4,
                target: 12,
                unit: "people",
                confidence: "off_track",
                owner: "DP"
            }
        ]
    },
    {
        id: "o4",
        title: "Expand Market Presence",
        icon: "globe-outline",
        keyResults: [
            {
                id: "kr11",
                title: "Launch in 3 new markets",
                current: 2,
                target: 3,
                unit: "markets",
                confidence: "on_track",
                owner: "NL"
            },
            {
                id: "kr12",
                title: "Grow social following to 50K",
                current: 38,
                target: 50,
                unit: "K",
                confidence: "at_risk",
                owner: "EV"
            }
        ]
    }
];

const CONFIDENCE_CONFIG: Record<Confidence, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
    on_track: { label: "On Track", color: "#10B981", icon: "checkmark-circle" },
    at_risk: { label: "At Risk", color: "#F59E0B", icon: "warning" },
    off_track: { label: "Off Track", color: "#EF4444", icon: "close-circle" }
};

const AVATAR_COLORS = [
    "#6366F1",
    "#EC4899",
    "#14B8A6",
    "#F97316",
    "#8B5CF6",
    "#06B6D4",
    "#EF4444",
    "#84CC16",
    "#F59E0B",
    "#3B82F6",
    "#10B981",
    "#E11D48"
];

// Deterministic color from initials
function avatarColor(initials: string): string {
    let hash = 0;
    for (let i = 0; i < initials.length; i++) {
        hash = initials.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// --- Progress Ring (dotted circle) ---

function ProgressRing({
    percentage,
    size,
    strokeWidth,
    color,
    trackColor
}: {
    percentage: number;
    size: number;
    strokeWidth: number;
    color: string;
    trackColor: string;
}) {
    const segmentCount = 72;
    const radius = (size - strokeWidth) / 2;
    const center = size / 2;
    const filledSegments = Math.round((percentage / 100) * segmentCount);
    const segmentSize = strokeWidth * 0.7;
    const gap = 0.6; // gap factor between segments

    const segments = [];
    for (let i = 0; i < segmentCount; i++) {
        const angle = (i / segmentCount) * 2 * Math.PI - Math.PI / 2;
        const x = center + radius * Math.cos(angle) - segmentSize / 2;
        const y = center + radius * Math.sin(angle) - segmentSize / 2;
        const isFilled = i < filledSegments;

        segments.push(
            <View
                key={i}
                style={{
                    position: "absolute",
                    left: x,
                    top: y,
                    width: segmentSize * gap,
                    height: segmentSize * gap,
                    borderRadius: (segmentSize * gap) / 2,
                    backgroundColor: isFilled ? color : trackColor
                }}
            />
        );
    }

    return <View style={{ width: size, height: size }}>{segments}</View>;
}

// --- Inline Progress Bar ---

function ProgressBar({
    progress,
    color,
    trackColor,
    height
}: {
    progress: number;
    color: string;
    trackColor: string;
    height: number;
}) {
    const clampedProgress = Math.min(Math.max(progress, 0), 100);
    return (
        <View
            style={{
                height,
                backgroundColor: trackColor,
                borderRadius: height / 2,
                overflow: "hidden"
            }}
        >
            <View
                style={{
                    width: `${clampedProgress}%`,
                    height: "100%",
                    backgroundColor: color,
                    borderRadius: height / 2
                }}
            />
        </View>
    );
}

// --- Confidence Chip ---

function ConfidenceChip({ confidence }: { confidence: Confidence }) {
    const config = CONFIDENCE_CONFIG[confidence];
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: `${config.color}18`,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 10
            }}
        >
            <Ionicons name={config.icon} size={12} color={config.color} />
            <Text
                style={{
                    fontFamily: "IBMPlexSans-Regular",
                    fontSize: 11,
                    color: config.color
                }}
            >
                {config.label}
            </Text>
        </View>
    );
}

// --- Owner Avatar ---

function OwnerAvatar({ initials }: { initials: string }) {
    const bg = avatarColor(initials);
    return (
        <View
            style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: `${bg}20`,
                alignItems: "center",
                justifyContent: "center"
            }}
        >
            <Text
                style={{
                    fontFamily: "IBMPlexSans-SemiBold",
                    fontSize: 10,
                    color: bg
                }}
            >
                {initials}
            </Text>
        </View>
    );
}

// --- Key Result Row ---

function KeyResultRow({ kr, surfaceColor }: { kr: KeyResult; surfaceColor: string }) {
    const { theme } = useUnistyles();
    const config = CONFIDENCE_CONFIG[kr.confidence];

    // For inverted metrics (like churn % or latency) where lower is better
    const isInvertedMetric = kr.unit === "%" && kr.target < kr.current && kr.id === "kr3";
    const isLatencyMetric = kr.unit === "ms";

    let progress: number;
    if (isInvertedMetric || isLatencyMetric) {
        // For metrics where lower is better, calculate how close we are to the target
        // starting from an assumed baseline
        const baseline = isLatencyMetric ? 400 : 8; // starting latency or starting churn
        const totalReduction = baseline - kr.target;
        const actualReduction = baseline - kr.current;
        progress = totalReduction > 0 ? (actualReduction / totalReduction) * 100 : 0;
    } else {
        progress = kr.target > 0 ? (kr.current / kr.target) * 100 : 0;
    }

    return (
        <View
            style={[
                styles.krRow,
                {
                    backgroundColor: surfaceColor,
                    borderColor: theme.colors.outlineVariant
                }
            ]}
        >
            <View style={styles.krTopRow}>
                <View style={styles.krTitleArea}>
                    <Text style={[styles.krTitle, { color: theme.colors.onSurface }]} numberOfLines={2}>
                        {kr.title}
                    </Text>
                </View>
                <OwnerAvatar initials={kr.owner} />
            </View>

            <View style={styles.krMetricsRow}>
                <View style={styles.krValueContainer}>
                    <Text style={[styles.krCurrentValue, { color: config.color }]}>{kr.current}</Text>
                    <Text style={[styles.krSeparator, { color: theme.colors.onSurfaceVariant }]}>{" / "}</Text>
                    <Text style={[styles.krTargetValue, { color: theme.colors.onSurfaceVariant }]}>{kr.target}</Text>
                    <Text style={[styles.krUnit, { color: theme.colors.onSurfaceVariant }]}> {kr.unit}</Text>
                </View>
                <ConfidenceChip confidence={kr.confidence} />
            </View>

            <ProgressBar
                progress={Math.min(progress, 100)}
                color={config.color}
                trackColor={`${config.color}18`}
                height={6}
            />
        </View>
    );
}

// --- Objective Section ---

function ObjectiveSection({ objective }: { objective: Objective }) {
    const { theme } = useUnistyles();
    const [expanded, setExpanded] = React.useState(true);

    const totalProgress = objective.keyResults.reduce((sum, kr) => {
        const p = kr.target > 0 ? (kr.current / kr.target) * 100 : 0;
        return sum + Math.min(p, 100);
    }, 0);
    const avgProgress = objective.keyResults.length > 0 ? Math.round(totalProgress / objective.keyResults.length) : 0;

    // Determine worst confidence across key results
    const hasOffTrack = objective.keyResults.some((kr) => kr.confidence === "off_track");
    const hasAtRisk = objective.keyResults.some((kr) => kr.confidence === "at_risk");
    const worstConfidence: Confidence = hasOffTrack ? "off_track" : hasAtRisk ? "at_risk" : "on_track";
    const worstColor = CONFIDENCE_CONFIG[worstConfidence].color;

    return (
        <View
            style={[
                styles.objectiveCard,
                {
                    backgroundColor: theme.colors.surfaceContainer,
                    borderColor: theme.colors.outlineVariant
                }
            ]}
        >
            {/* Colored accent strip at left */}
            <View style={[styles.objectiveAccent, { backgroundColor: worstColor }]} />

            <View style={styles.objectiveInner}>
                {/* Objective header */}
                <Pressable
                    onPress={() => setExpanded((prev) => !prev)}
                    style={({ pressed }) => [styles.objectiveHeader, { opacity: pressed ? 0.7 : 1 }]}
                >
                    <View style={[styles.objectiveIconCircle, { backgroundColor: `${worstColor}18` }]}>
                        <Ionicons name={objective.icon} size={20} color={worstColor} />
                    </View>

                    <View style={styles.objectiveTitleArea}>
                        <Text style={[styles.objectiveTitle, { color: theme.colors.onSurface }]} numberOfLines={2}>
                            {objective.title}
                        </Text>
                        <View style={styles.objectiveMetaRow}>
                            <Text style={[styles.objectiveKrCount, { color: theme.colors.onSurfaceVariant }]}>
                                {objective.keyResults.length} key results
                            </Text>
                            <View style={[styles.objectiveProgressPill, { backgroundColor: `${worstColor}18` }]}>
                                <Text style={[styles.objectiveProgressText, { color: worstColor }]}>
                                    {avgProgress}%
                                </Text>
                            </View>
                        </View>
                    </View>

                    <Ionicons
                        name={expanded ? "chevron-up" : "chevron-down"}
                        size={20}
                        color={theme.colors.onSurfaceVariant}
                    />
                </Pressable>

                {/* Progress bar for the objective */}
                <View style={styles.objectiveProgressBarArea}>
                    <ProgressBar progress={avgProgress} color={worstColor} trackColor={`${worstColor}15`} height={8} />
                </View>

                {/* Key results list */}
                {expanded && (
                    <View style={styles.krList}>
                        {objective.keyResults.map((kr) => (
                            <KeyResultRow key={kr.id} kr={kr} surfaceColor={theme.colors.surface} />
                        ))}
                    </View>
                )}
            </View>
        </View>
    );
}

// --- Confidence Summary ---

function ConfidenceSummary({ allKeyResults }: { allKeyResults: KeyResult[] }) {
    const { theme } = useUnistyles();
    const counts: Record<Confidence, number> = { on_track: 0, at_risk: 0, off_track: 0 };
    for (const kr of allKeyResults) {
        counts[kr.confidence]++;
    }

    return (
        <View style={styles.confidenceSummaryRow}>
            {(["on_track", "at_risk", "off_track"] as Confidence[]).map((c) => {
                const config = CONFIDENCE_CONFIG[c];
                return (
                    <View key={c} style={[styles.confidenceSummaryCard, { backgroundColor: `${config.color}12` }]}>
                        <Ionicons name={config.icon} size={18} color={config.color} />
                        <Text style={[styles.confidenceSummaryCount, { color: config.color }]}>{counts[c]}</Text>
                        <Text style={[styles.confidenceSummaryLabel, { color: theme.colors.onSurfaceVariant }]}>
                            {config.label}
                        </Text>
                    </View>
                );
            })}
        </View>
    );
}

// --- Main Component ---

export function OkrTrackerPage() {
    const { theme } = useUnistyles();
    const [selectedQuarter, setSelectedQuarter] = React.useState<Quarter>("Q1 2026");

    const allKeyResults = objectives.flatMap((o) => o.keyResults);
    const totalKRs = allKeyResults.length;
    const totalProgress = allKeyResults.reduce((sum, kr) => {
        const p = kr.target > 0 ? (kr.current / kr.target) * 100 : 0;
        return sum + Math.min(p, 100);
    }, 0);
    const overallPercentage = totalKRs > 0 ? Math.round(totalProgress / totalKRs) : 0;

    return (
        <ScrollView
            contentContainerStyle={{
                maxWidth: theme.layout.maxWidth,
                width: "100%",
                alignSelf: "center",
                paddingHorizontal: 16,
                paddingBottom: 48
            }}
            showsVerticalScrollIndicator={false}
        >
            {/* --- Quarter Selector --- */}
            <View style={styles.quarterSelectorContainer}>
                <View style={[styles.quarterSelector, { backgroundColor: theme.colors.surfaceContainer }]}>
                    {QUARTERS.map((q) => {
                        const isSelected = q === selectedQuarter;
                        return (
                            <Pressable
                                key={q}
                                onPress={() => setSelectedQuarter(q)}
                                style={[
                                    styles.quarterPill,
                                    isSelected && {
                                        backgroundColor: theme.colors.primary
                                    }
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.quarterPillText,
                                        {
                                            color: isSelected ? theme.colors.onPrimary : theme.colors.onSurfaceVariant
                                        }
                                    ]}
                                >
                                    {q}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>
            </View>

            {/* --- Overall Progress Ring --- */}
            <View style={styles.overallSection}>
                <View style={styles.ringContainer}>
                    <ProgressRing
                        percentage={overallPercentage}
                        size={160}
                        strokeWidth={12}
                        color={theme.colors.primary}
                        trackColor={theme.colors.outlineVariant}
                    />
                    <View style={styles.ringCenterLabel}>
                        <Text style={[styles.ringPercentage, { color: theme.colors.primary }]}>
                            {overallPercentage}
                        </Text>
                        <Text style={[styles.ringPercentSign, { color: theme.colors.primary }]}>%</Text>
                    </View>
                </View>
                <Text style={[styles.overallLabel, { color: theme.colors.onSurface }]}>Overall OKR Completion</Text>
                <Text style={[styles.overallSubLabel, { color: theme.colors.onSurfaceVariant }]}>
                    {objectives.length} objectives {"\u00B7"} {totalKRs} key results
                </Text>
            </View>

            {/* --- Confidence Summary --- */}
            <ConfidenceSummary allKeyResults={allKeyResults} />

            {/* --- Objectives --- */}
            <View style={styles.objectivesList}>
                {objectives.map((obj) => (
                    <ObjectiveSection key={obj.id} objective={obj} />
                ))}
            </View>
        </ScrollView>
    );
}

// --- Styles ---

const styles = StyleSheet.create((theme) => ({
    // Quarter selector
    quarterSelectorContainer: {
        alignItems: "center",
        paddingTop: 24,
        paddingBottom: 8
    },
    quarterSelector: {
        flexDirection: "row",
        borderRadius: 12,
        padding: 3,
        gap: 2
    },
    quarterPill: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 10
    },
    quarterPillText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13
    },

    // Overall progress section
    overallSection: {
        alignItems: "center",
        paddingTop: 20,
        paddingBottom: 20,
        gap: 8
    },
    ringContainer: {
        position: "relative",
        alignItems: "center",
        justifyContent: "center"
    },
    ringCenterLabel: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row"
    },
    ringPercentage: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 40,
        lineHeight: 48
    },
    ringPercentSign: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 20,
        lineHeight: 48,
        marginTop: -4
    },
    overallLabel: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 18,
        marginTop: 4
    },
    overallSubLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13
    },

    // Confidence summary
    confidenceSummaryRow: {
        flexDirection: "row",
        gap: 8,
        marginBottom: 20
    },
    confidenceSummaryCard: {
        flex: 1,
        alignItems: "center",
        paddingVertical: 12,
        borderRadius: 12,
        gap: 4
    },
    confidenceSummaryCount: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 22,
        lineHeight: 26
    },
    confidenceSummaryLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },

    // Objectives list
    objectivesList: {
        gap: 14
    },

    // Objective card
    objectiveCard: {
        borderRadius: 14,
        borderWidth: 1,
        flexDirection: "row",
        overflow: "hidden"
    },
    objectiveAccent: {
        width: 4
    },
    objectiveInner: {
        flex: 1,
        padding: 14,
        gap: 12
    },
    objectiveHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10
    },
    objectiveIconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center"
    },
    objectiveTitleArea: {
        flex: 1,
        gap: 3
    },
    objectiveTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15,
        lineHeight: 20
    },
    objectiveMetaRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    objectiveKrCount: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    objectiveProgressPill: {
        paddingHorizontal: 7,
        paddingVertical: 1,
        borderRadius: 8
    },
    objectiveProgressText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 11
    },
    objectiveProgressBarArea: {
        paddingHorizontal: 0
    },

    // Key results
    krList: {
        gap: 8
    },
    krRow: {
        borderRadius: 10,
        borderWidth: 1,
        padding: 12,
        gap: 8
    },
    krTopRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8
    },
    krTitleArea: {
        flex: 1
    },
    krTitle: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 18
    },
    krMetricsRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between"
    },
    krValueContainer: {
        flexDirection: "row",
        alignItems: "baseline"
    },
    krCurrentValue: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 16,
        lineHeight: 20
    },
    krSeparator: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 13
    },
    krTargetValue: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 13
    },
    krUnit: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    }
}));
