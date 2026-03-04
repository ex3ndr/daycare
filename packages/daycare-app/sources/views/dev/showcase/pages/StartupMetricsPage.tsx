import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { ShowcasePage } from "@/views/dev/showcase/components/ShowcasePage";

// --- Types ---

type TrendDirection = "up" | "down" | "flat";

type MetricDef = {
    id: string;
    label: string;
    value: string;
    subValue?: string;
    trend: TrendDirection;
    trendLabel: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
};

type PlanTier = {
    id: string;
    name: string;
    subscribers: number;
    revenue: number;
    color: string;
};

type RecentSignup = {
    id: string;
    name: string;
    plan: string;
    planColor: string;
    signupDate: string;
    source: string;
    sourceColor: string;
};

type ChurnReason = "price" | "competitor" | "no longer needed" | "other";

type ChurnEntry = {
    id: string;
    company: string;
    plan: string;
    churnDate: string;
    mrr: number;
    reason: ChurnReason;
};

// --- Mock Data ---

const keyMetrics: MetricDef[] = [
    {
        id: "mrr",
        label: "MRR",
        value: "$84.2k",
        subValue: "Monthly Recurring",
        trend: "up",
        trendLabel: "+12.3%",
        icon: "cash-outline",
        color: "#10B981"
    },
    {
        id: "arr",
        label: "ARR",
        value: "$1.01M",
        subValue: "Annual Run Rate",
        trend: "up",
        trendLabel: "+18.7%",
        icon: "trending-up-outline",
        color: "#6366F1"
    },
    {
        id: "churn",
        label: "Churn Rate",
        value: "2.4%",
        subValue: "Monthly",
        trend: "down",
        trendLabel: "-0.3%",
        icon: "exit-outline",
        color: "#EF4444"
    },
    {
        id: "ltv",
        label: "LTV",
        value: "$14.8k",
        subValue: "Lifetime Value",
        trend: "up",
        trendLabel: "+8.1%",
        icon: "diamond-outline",
        color: "#8B5CF6"
    },
    {
        id: "cac",
        label: "CAC",
        value: "$1,240",
        subValue: "Acquisition Cost",
        trend: "down",
        trendLabel: "-5.2%",
        icon: "megaphone-outline",
        color: "#F59E0B"
    },
    {
        id: "runway",
        label: "Runway",
        value: "18 mo",
        subValue: "$2.7M remaining",
        trend: "flat",
        trendLabel: "Stable",
        icon: "hourglass-outline",
        color: "#3B82F6"
    }
];

const planTiers: PlanTier[] = [
    { id: "enterprise", name: "Enterprise", subscribers: 24, revenue: 43200, color: "#6366F1" },
    { id: "pro", name: "Pro", subscribers: 186, revenue: 27900, color: "#3B82F6" },
    { id: "starter", name: "Starter", subscribers: 412, revenue: 10300, color: "#10B981" },
    { id: "free", name: "Free", subscribers: 1840, revenue: 0, color: "#9CA3AF" }
];

const recentSignups: RecentSignup[] = [
    {
        id: "s1",
        name: "Meridian Labs",
        plan: "Enterprise",
        planColor: "#6366F1",
        signupDate: "Mar 3, 2026",
        source: "Referral",
        sourceColor: "#10B981"
    },
    {
        id: "s2",
        name: "Sarah Mitchell",
        plan: "Pro",
        planColor: "#3B82F6",
        signupDate: "Mar 3, 2026",
        source: "Google Ads",
        sourceColor: "#F59E0B"
    },
    {
        id: "s3",
        name: "Northwind Corp",
        plan: "Enterprise",
        planColor: "#6366F1",
        signupDate: "Mar 2, 2026",
        source: "Sales",
        sourceColor: "#8B5CF6"
    },
    {
        id: "s4",
        name: "James Park",
        plan: "Starter",
        planColor: "#10B981",
        signupDate: "Mar 2, 2026",
        source: "Organic",
        sourceColor: "#3B82F6"
    },
    {
        id: "s5",
        name: "CloudByte Inc",
        plan: "Pro",
        planColor: "#3B82F6",
        signupDate: "Mar 1, 2026",
        source: "Product Hunt",
        sourceColor: "#EC4899"
    },
    {
        id: "s6",
        name: "Lisa Nguyen",
        plan: "Starter",
        planColor: "#10B981",
        signupDate: "Mar 1, 2026",
        source: "Twitter",
        sourceColor: "#14B8A6"
    },
    {
        id: "s7",
        name: "Apex Solutions",
        plan: "Pro",
        planColor: "#3B82F6",
        signupDate: "Feb 28, 2026",
        source: "Referral",
        sourceColor: "#10B981"
    }
];

const churnLog: ChurnEntry[] = [
    {
        id: "c1",
        company: "DataPulse LLC",
        plan: "Pro",
        churnDate: "Mar 2, 2026",
        mrr: 150,
        reason: "competitor"
    },
    {
        id: "c2",
        company: "Vintage Media",
        plan: "Starter",
        churnDate: "Mar 1, 2026",
        mrr: 25,
        reason: "no longer needed"
    },
    {
        id: "c3",
        company: "Greenleaf Co",
        plan: "Enterprise",
        churnDate: "Feb 28, 2026",
        mrr: 1800,
        reason: "price"
    },
    {
        id: "c4",
        company: "PixelForge",
        plan: "Pro",
        churnDate: "Feb 27, 2026",
        mrr: 150,
        reason: "other"
    },
    {
        id: "c5",
        company: "SwiftShip",
        plan: "Starter",
        churnDate: "Feb 25, 2026",
        mrr: 25,
        reason: "competitor"
    }
];

// --- Helpers ---

function formatCurrency(n: number): string {
    if (n >= 1000) {
        return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
    }
    return `$${n.toLocaleString()}`;
}

function trendIcon(direction: TrendDirection): keyof typeof Ionicons.glyphMap {
    switch (direction) {
        case "up":
            return "arrow-up";
        case "down":
            return "arrow-down";
        case "flat":
            return "remove-outline";
    }
}

/** For churn, "down" trend is good (green). For revenue metrics, "up" is good. */
function trendColor(direction: TrendDirection, metricId: string): string {
    if (direction === "flat") return "#9CA3AF";
    const isChurnOrCac = metricId === "churn" || metricId === "cac";
    if (isChurnOrCac) {
        return direction === "down" ? "#10B981" : "#EF4444";
    }
    return direction === "up" ? "#10B981" : "#EF4444";
}

const churnReasonColors: Record<ChurnReason, { bg: string; text: string }> = {
    price: { bg: "#FEE2E2", text: "#DC2626" },
    competitor: { bg: "#FEF3C7", text: "#D97706" },
    "no longer needed": { bg: "#E0E7FF", text: "#4F46E5" },
    other: { bg: "#F3F4F6", text: "#6B7280" }
};

const churnReasonLabels: Record<ChurnReason, string> = {
    price: "Price",
    competitor: "Competitor",
    "no longer needed": "No Longer Needed",
    other: "Other"
};

// --- Sub-components ---

/** Single metric card in the 2x3 grid */
function MetricCard({
    metric,
    isSelected,
    onPress,
    surfaceColor,
    textColor,
    subtextColor,
    borderColor
}: {
    metric: MetricDef;
    isSelected: boolean;
    onPress: () => void;
    surfaceColor: string;
    textColor: string;
    subtextColor: string;
    borderColor: string;
}) {
    const tc = trendColor(metric.trend, metric.id);

    return (
        <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
            <View
                style={[
                    styles.metricCard,
                    {
                        backgroundColor: surfaceColor,
                        borderColor: isSelected ? metric.color : borderColor,
                        borderWidth: isSelected ? 2 : 1
                    }
                ]}
            >
                <View style={styles.metricCardHeader}>
                    <View style={[styles.metricIconBadge, { backgroundColor: `${metric.color}18` }]}>
                        <Ionicons name={metric.icon} size={18} color={metric.color} />
                    </View>
                    <View style={[styles.trendBadge, { backgroundColor: `${tc}14` }]}>
                        <Ionicons name={trendIcon(metric.trend)} size={10} color={tc} />
                        <Text style={[styles.trendText, { color: tc }]}>{metric.trendLabel}</Text>
                    </View>
                </View>
                <Text style={[styles.metricValue, { color: textColor }]}>{metric.value}</Text>
                <Text style={[styles.metricLabel, { color: subtextColor }]}>{metric.label}</Text>
            </View>
        </Pressable>
    );
}

/** Metric detail popover shown when a metric card is tapped */
function MetricDetail({
    metric,
    surfaceColor,
    textColor,
    subtextColor,
    borderColor
}: {
    metric: MetricDef;
    surfaceColor: string;
    textColor: string;
    subtextColor: string;
    borderColor: string;
}) {
    const tc = trendColor(metric.trend, metric.id);

    return (
        <View style={[styles.metricDetail, { backgroundColor: surfaceColor, borderColor }]}>
            <View style={styles.metricDetailHeader}>
                <View style={[styles.metricDetailIcon, { backgroundColor: `${metric.color}18` }]}>
                    <Ionicons name={metric.icon} size={22} color={metric.color} />
                </View>
                <View style={styles.metricDetailTitleCol}>
                    <Text style={[styles.metricDetailTitle, { color: textColor }]}>{metric.label}</Text>
                    {metric.subValue && (
                        <Text style={[styles.metricDetailSub, { color: subtextColor }]}>{metric.subValue}</Text>
                    )}
                </View>
            </View>
            <View style={styles.metricDetailValueRow}>
                <Text style={[styles.metricDetailValue, { color: textColor }]}>{metric.value}</Text>
                <View style={[styles.trendBadgeLarge, { backgroundColor: `${tc}14` }]}>
                    <Ionicons name={trendIcon(metric.trend)} size={14} color={tc} />
                    <Text style={[styles.trendTextLarge, { color: tc }]}>{metric.trendLabel}</Text>
                </View>
            </View>
            {/* Mini sparkline placeholder */}
            <View style={styles.sparklineRow}>
                {[38, 42, 40, 48, 52, 55, 50, 58, 62, 68, 72, 78].map((h) => (
                    <View
                        key={`sp-${h}`}
                        style={[
                            styles.sparklineBar,
                            {
                                height: h,
                                backgroundColor: h === 78 ? metric.color : `${metric.color}40`
                            }
                        ]}
                    />
                ))}
            </View>
            <View style={styles.sparklineLabels}>
                <Text style={[styles.sparklineLabel, { color: subtextColor }]}>Apr</Text>
                <Text style={[styles.sparklineLabel, { color: subtextColor }]}>Aug</Text>
                <Text style={[styles.sparklineLabel, { color: subtextColor }]}>Dec</Text>
                <Text style={[styles.sparklineLabel, { color: subtextColor }]}>Mar</Text>
            </View>
        </View>
    );
}

/** Horizontal bar for revenue breakdown per tier */
function TierBar({
    tier,
    maxRevenue,
    textColor,
    subtextColor
}: {
    tier: PlanTier;
    maxRevenue: number;
    textColor: string;
    subtextColor: string;
}) {
    const barPct = maxRevenue > 0 ? Math.max((tier.revenue / maxRevenue) * 100, tier.revenue > 0 ? 8 : 2) : 2;

    return (
        <View style={styles.tierRow}>
            <View style={styles.tierLabelCol}>
                <View style={[styles.tierDot, { backgroundColor: tier.color }]} />
                <Text style={[styles.tierName, { color: textColor }]}>{tier.name}</Text>
            </View>
            <View style={styles.tierBarCol}>
                <View style={styles.tierBarTrack}>
                    <View style={[styles.tierBarFill, { width: `${barPct}%`, backgroundColor: tier.color }]} />
                </View>
            </View>
            <View style={styles.tierStatsCol}>
                <Text style={[styles.tierRevenue, { color: textColor }]}>
                    {tier.revenue > 0 ? formatCurrency(tier.revenue) : "$0"}
                </Text>
                <Text style={[styles.tierSubs, { color: subtextColor }]}>{tier.subscribers.toLocaleString()} subs</Text>
            </View>
        </View>
    );
}

/** Signup row with plan badge and source chip */
function SignupRow({
    signup,
    textColor,
    subtextColor,
    surfaceColor
}: {
    signup: RecentSignup;
    textColor: string;
    subtextColor: string;
    surfaceColor: string;
}) {
    return (
        <View style={[styles.signupRow, { backgroundColor: surfaceColor }]}>
            <View style={styles.signupInfo}>
                <Text style={[styles.signupName, { color: textColor }]} numberOfLines={1}>
                    {signup.name}
                </Text>
                <View style={styles.signupChipRow}>
                    <View style={[styles.planBadge, { backgroundColor: `${signup.planColor}18` }]}>
                        <View style={[styles.planDot, { backgroundColor: signup.planColor }]} />
                        <Text style={[styles.planBadgeText, { color: signup.planColor }]}>{signup.plan}</Text>
                    </View>
                    <View style={[styles.sourceChip, { backgroundColor: `${signup.sourceColor}14` }]}>
                        <Text style={[styles.sourceChipText, { color: signup.sourceColor }]}>{signup.source}</Text>
                    </View>
                </View>
            </View>
            <Text style={[styles.signupDate, { color: subtextColor }]}>{signup.signupDate}</Text>
        </View>
    );
}

/** Churn log entry with red-tinted reason chip */
function ChurnRow({
    entry,
    textColor,
    subtextColor,
    borderColor
}: {
    entry: ChurnEntry;
    textColor: string;
    subtextColor: string;
    borderColor: string;
}) {
    const reasonStyle = churnReasonColors[entry.reason];

    return (
        <View style={[styles.churnRow, { borderBottomColor: borderColor }]}>
            <View style={styles.churnRowLeft}>
                <View style={styles.churnCompanyRow}>
                    <Ionicons name="remove-circle-outline" size={16} color="#EF4444" />
                    <Text style={[styles.churnCompany, { color: textColor }]} numberOfLines={1}>
                        {entry.company}
                    </Text>
                </View>
                <View style={styles.churnMetaRow}>
                    <Text style={[styles.churnPlan, { color: subtextColor }]}>{entry.plan}</Text>
                    <Text style={[styles.churnDot, { color: subtextColor }]}>*</Text>
                    <Text style={[styles.churnDate, { color: subtextColor }]}>{entry.churnDate}</Text>
                </View>
            </View>
            <View style={styles.churnRowRight}>
                <View style={[styles.reasonChip, { backgroundColor: reasonStyle.bg }]}>
                    <Text style={[styles.reasonChipText, { color: reasonStyle.text }]}>
                        {churnReasonLabels[entry.reason]}
                    </Text>
                </View>
                <Text style={[styles.churnMrr, { color: "#EF4444" }]}>-${entry.mrr}/mo</Text>
            </View>
        </View>
    );
}

// --- Section Header ---

function SectionHeader({
    title,
    icon,
    iconColor,
    isExpanded,
    onToggle,
    textColor,
    subtextColor,
    count
}: {
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    isExpanded: boolean;
    onToggle: () => void;
    textColor: string;
    subtextColor: string;
    count?: number;
}) {
    return (
        <Pressable onPress={onToggle} style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
                <Ionicons name={icon} size={18} color={iconColor} />
                <Text style={[styles.sectionTitle, { color: textColor }]}>{title}</Text>
                {count !== undefined && (
                    <View style={[styles.sectionCount, { backgroundColor: `${iconColor}18` }]}>
                        <Text style={[styles.sectionCountText, { color: iconColor }]}>{count}</Text>
                    </View>
                )}
            </View>
            <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={subtextColor} />
        </Pressable>
    );
}

// --- Main Component ---

/**
 * SaaS startup metrics dashboard showcasing key metrics (MRR, ARR, churn, LTV, CAC, runway),
 * revenue breakdown by plan tier, recent signups list, and churn log with reason chips.
 */
export function StartupMetricsPage() {
    const { theme } = useUnistyles();
    const [selectedMetricId, setSelectedMetricId] = React.useState<string | null>(null);
    const [revenueExpanded, setRevenueExpanded] = React.useState(true);
    const [signupsExpanded, setSignupsExpanded] = React.useState(true);
    const [churnExpanded, setChurnExpanded] = React.useState(true);

    const selectedMetric = selectedMetricId ? (keyMetrics.find((m) => m.id === selectedMetricId) ?? null) : null;
    const maxRevenue = Math.max(...planTiers.map((t) => t.revenue));
    const totalRevenue = planTiers.reduce((s, t) => s + t.revenue, 0);
    const totalSubscribers = planTiers.reduce((s, t) => s + t.subscribers, 0);
    const totalChurnMrr = churnLog.reduce((s, e) => s + e.mrr, 0);

    const handleMetricPress = React.useCallback((id: string) => {
        setSelectedMetricId((prev) => (prev === id ? null : id));
    }, []);

    return (
        <ShowcasePage bottomInset={60} contentContainerStyle={{ backgroundColor: theme.colors.surface }}>
            {/* Hero summary */}
            <View style={styles.heroSection}>
                <Text style={[styles.heroLabel, { color: theme.colors.onSurfaceVariant }]}>TOTAL MRR</Text>
                <Text style={[styles.heroValue, { color: theme.colors.onSurface }]}>$84,200</Text>
                <View style={styles.heroBadgeRow}>
                    <View style={[styles.heroBadge, { backgroundColor: "#10B98118" }]}>
                        <Ionicons name="arrow-up" size={14} color="#10B981" />
                        <Text style={[styles.heroBadgeText, { color: "#10B981" }]}>+12.3% vs last month</Text>
                    </View>
                </View>
            </View>

            {/* 2x3 Metric Card Grid */}
            <View style={styles.metricsGrid}>
                {keyMetrics.map((metric) => (
                    <MetricCard
                        key={metric.id}
                        metric={metric}
                        isSelected={selectedMetricId === metric.id}
                        onPress={() => handleMetricPress(metric.id)}
                        surfaceColor={theme.colors.surfaceContainer}
                        textColor={theme.colors.onSurface}
                        subtextColor={theme.colors.onSurfaceVariant}
                        borderColor={theme.colors.outlineVariant}
                    />
                ))}
            </View>

            {/* Metric detail popover */}
            {selectedMetric && (
                <MetricDetail
                    metric={selectedMetric}
                    surfaceColor={theme.colors.surfaceContainer}
                    textColor={theme.colors.onSurface}
                    subtextColor={theme.colors.onSurfaceVariant}
                    borderColor={theme.colors.outlineVariant}
                />
            )}

            {/* Revenue Breakdown */}
            <SectionHeader
                title="Revenue Breakdown"
                icon="bar-chart-outline"
                iconColor={theme.colors.primary}
                isExpanded={revenueExpanded}
                onToggle={() => setRevenueExpanded((p) => !p)}
                textColor={theme.colors.onSurface}
                subtextColor={theme.colors.onSurfaceVariant}
            />
            {revenueExpanded && (
                <View style={[styles.sectionCard, { backgroundColor: theme.colors.surfaceContainer }]}>
                    {/* Revenue summary row */}
                    <View style={styles.revenueSummaryRow}>
                        <View style={styles.revenueSumItem}>
                            <Text style={[styles.revenueSumValue, { color: theme.colors.onSurface }]}>
                                {formatCurrency(totalRevenue)}
                            </Text>
                            <Text style={[styles.revenueSumLabel, { color: theme.colors.onSurfaceVariant }]}>
                                Total MRR
                            </Text>
                        </View>
                        <View style={[styles.revenueSumDivider, { backgroundColor: theme.colors.outlineVariant }]} />
                        <View style={styles.revenueSumItem}>
                            <Text style={[styles.revenueSumValue, { color: theme.colors.onSurface }]}>
                                {totalSubscribers.toLocaleString()}
                            </Text>
                            <Text style={[styles.revenueSumLabel, { color: theme.colors.onSurfaceVariant }]}>
                                Total Subscribers
                            </Text>
                        </View>
                        <View style={[styles.revenueSumDivider, { backgroundColor: theme.colors.outlineVariant }]} />
                        <View style={styles.revenueSumItem}>
                            <Text style={[styles.revenueSumValue, { color: theme.colors.onSurface }]}>
                                ${(totalRevenue / totalSubscribers).toFixed(0)}
                            </Text>
                            <Text style={[styles.revenueSumLabel, { color: theme.colors.onSurfaceVariant }]}>ARPU</Text>
                        </View>
                    </View>

                    <View style={[styles.sectionDivider, { borderColor: theme.colors.outlineVariant }]} />

                    {/* Tier bars */}
                    <View style={styles.tiersContainer}>
                        {planTiers.map((tier) => (
                            <TierBar
                                key={tier.id}
                                tier={tier}
                                maxRevenue={maxRevenue}
                                textColor={theme.colors.onSurface}
                                subtextColor={theme.colors.onSurfaceVariant}
                            />
                        ))}
                    </View>
                </View>
            )}

            {/* Recent Signups */}
            <SectionHeader
                title="Recent Signups"
                icon="person-add-outline"
                iconColor="#10B981"
                isExpanded={signupsExpanded}
                onToggle={() => setSignupsExpanded((p) => !p)}
                textColor={theme.colors.onSurface}
                subtextColor={theme.colors.onSurfaceVariant}
                count={recentSignups.length}
            />
            {signupsExpanded && (
                <View style={[styles.sectionCard, { backgroundColor: theme.colors.surfaceContainer }]}>
                    {recentSignups.map((signup, idx) => (
                        <React.Fragment key={signup.id}>
                            {idx > 0 && (
                                <View style={[styles.signupDivider, { borderColor: theme.colors.outlineVariant }]} />
                            )}
                            <SignupRow
                                signup={signup}
                                textColor={theme.colors.onSurface}
                                subtextColor={theme.colors.onSurfaceVariant}
                                surfaceColor="transparent"
                            />
                        </React.Fragment>
                    ))}
                </View>
            )}

            {/* Churn Log */}
            <SectionHeader
                title="Churn Log"
                icon="trending-down-outline"
                iconColor="#EF4444"
                isExpanded={churnExpanded}
                onToggle={() => setChurnExpanded((p) => !p)}
                textColor={theme.colors.onSurface}
                subtextColor={theme.colors.onSurfaceVariant}
                count={churnLog.length}
            />
            {churnExpanded && (
                <View style={[styles.sectionCard, { backgroundColor: theme.colors.surfaceContainer }]}>
                    {/* Churn summary */}
                    <View style={styles.churnSummary}>
                        <View style={[styles.churnSummaryIcon, { backgroundColor: "#FEE2E220" }]}>
                            <Ionicons name="warning-outline" size={18} color="#EF4444" />
                        </View>
                        <View style={styles.churnSummaryInfo}>
                            <Text style={[styles.churnSummaryValue, { color: "#EF4444" }]}>
                                -${totalChurnMrr.toLocaleString()}/mo
                            </Text>
                            <Text style={[styles.churnSummaryLabel, { color: theme.colors.onSurfaceVariant }]}>
                                Lost MRR this period ({churnLog.length} customers)
                            </Text>
                        </View>
                    </View>

                    <View style={[styles.sectionDivider, { borderColor: theme.colors.outlineVariant }]} />

                    {churnLog.map((entry) => (
                        <ChurnRow
                            key={entry.id}
                            entry={entry}
                            textColor={theme.colors.onSurface}
                            subtextColor={theme.colors.onSurfaceVariant}
                            borderColor={theme.colors.outlineVariant}
                        />
                    ))}
                </View>
            )}
        </ShowcasePage>
    );
}

// --- Styles ---

const styles = StyleSheet.create((theme) => ({
    // Hero
    heroSection: {
        alignItems: "center",
        paddingTop: 12,
        paddingBottom: 20,
        gap: 4
    },
    heroLabel: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11,
        letterSpacing: 1.2,
        textTransform: "uppercase"
    },
    heroValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 42,
        lineHeight: 52,
        letterSpacing: -1
    },
    heroBadgeRow: {
        flexDirection: "row",
        marginTop: 4
    },
    heroBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12
    },
    heroBadgeText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13
    },

    // 2x3 metric card grid
    metricsGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
        marginBottom: 12
    },
    metricCard: {
        width: "48%",
        flexGrow: 1,
        flexBasis: "45%",
        borderRadius: 14,
        padding: 14,
        gap: 6
    },
    metricCardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    metricIconBadge: {
        width: 32,
        height: 32,
        borderRadius: 9,
        alignItems: "center",
        justifyContent: "center"
    },
    trendBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 8
    },
    trendText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 10
    },
    metricValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 22,
        letterSpacing: -0.5,
        marginTop: 2
    },
    metricLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },

    // Metric detail
    metricDetail: {
        borderRadius: 14,
        borderWidth: 1,
        padding: 16,
        marginBottom: 16,
        gap: 12
    },
    metricDetailHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12
    },
    metricDetailIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center"
    },
    metricDetailTitleCol: {
        flex: 1,
        gap: 2
    },
    metricDetailTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 16
    },
    metricDetailSub: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    metricDetailValueRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between"
    },
    metricDetailValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 32,
        letterSpacing: -1
    },
    trendBadgeLarge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10
    },
    trendTextLarge: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 13
    },
    sparklineRow: {
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 4,
        height: 80,
        paddingTop: 4
    },
    sparklineBar: {
        flex: 1,
        borderRadius: 3,
        minWidth: 6
    },
    sparklineLabels: {
        flexDirection: "row",
        justifyContent: "space-between"
    },
    sparklineLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 10
    },

    // Section header
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 14,
        marginTop: 8
    },
    sectionTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    sectionTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 17
    },
    sectionCount: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center"
    },
    sectionCountText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 11
    },
    sectionCard: {
        borderRadius: 16,
        overflow: "hidden",
        paddingVertical: 8
    },
    sectionDivider: {
        borderTopWidth: 1,
        marginHorizontal: 14,
        marginVertical: 8
    },

    // Revenue summary
    revenueSummaryRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 8
    },
    revenueSumItem: {
        flex: 1,
        alignItems: "center",
        gap: 2
    },
    revenueSumValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 16,
        letterSpacing: -0.3
    },
    revenueSumLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 10,
        textAlign: "center"
    },
    revenueSumDivider: {
        width: 1,
        height: 32,
        marginHorizontal: 4
    },

    // Tier bars
    tiersContainer: {
        paddingHorizontal: 14,
        gap: 12,
        paddingVertical: 4
    },
    tierRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10
    },
    tierLabelCol: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        width: 90
    },
    tierDot: {
        width: 8,
        height: 8,
        borderRadius: 4
    },
    tierName: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13
    },
    tierBarCol: {
        flex: 1
    },
    tierBarTrack: {
        height: 20,
        borderRadius: 5,
        overflow: "hidden"
    },
    tierBarFill: {
        height: "100%",
        borderRadius: 5,
        opacity: 0.8
    },
    tierStatsCol: {
        alignItems: "flex-end",
        width: 72
    },
    tierRevenue: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 13
    },
    tierSubs: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 10
    },

    // Signup rows
    signupRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 11,
        paddingHorizontal: 14,
        gap: 12
    },
    signupDivider: {
        borderTopWidth: 1,
        marginHorizontal: 14
    },
    signupInfo: {
        flex: 1,
        gap: 5
    },
    signupName: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 15
    },
    signupChipRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6
    },
    planBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8
    },
    planDot: {
        width: 6,
        height: 6,
        borderRadius: 3
    },
    planBadgeText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11
    },
    sourceChip: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8
    },
    sourceChipText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11
    },
    signupDate: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },

    // Churn log
    churnSummary: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 8,
        gap: 12
    },
    churnSummaryIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FEE2E220"
    },
    churnSummaryInfo: {
        flex: 1,
        gap: 2
    },
    churnSummaryValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 18,
        letterSpacing: -0.3
    },
    churnSummaryLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    churnRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 14,
        paddingVertical: 11,
        borderBottomWidth: 0.5
    },
    churnRowLeft: {
        flex: 1,
        gap: 3
    },
    churnCompanyRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6
    },
    churnCompany: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 14,
        flex: 1
    },
    churnMetaRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingLeft: 22
    },
    churnPlan: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },
    churnDot: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 8
    },
    churnDate: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },
    churnRowRight: {
        alignItems: "flex-end",
        gap: 4
    },
    reasonChip: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8
    },
    reasonChipText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11
    },
    churnMrr: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 12
    }
}));
