import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
// --- Types ---
import { Card } from "@/components/Card";
import { ShowcasePage } from "@/views/dev/showcase/components/ShowcasePage";

type DealStage = "Prospecting" | "Qualification" | "Proposal" | "Negotiation" | "Closed Won" | "Closed Lost";
interface Deal {
    id: string;
    company: string;
    value: number;
    expectedClose: string;
    probability: number;
    owner: string;
    stage: DealStage;
    contactName: string;
    contactRole: string;
    lastActivity: string;
    notes: string;
}

// --- Mock Data ---

const allStages: DealStage[] = ["Prospecting", "Qualification", "Proposal", "Negotiation", "Closed Won", "Closed Lost"];
const monthlyTarget = 250000;
const mockDeals: Deal[] = [
    {
        id: "d1",
        company: "Meridian Technologies",
        value: 45000,
        expectedClose: "Mar 15, 2026",
        probability: 20,
        owner: "Sarah Chen",
        stage: "Prospecting",
        contactName: "James Rodriguez",
        contactRole: "VP Engineering",
        lastActivity: "Initial outreach email sent",
        notes: "Interested in enterprise plan. Needs custom SSO integration."
    },
    {
        id: "d2",
        company: "Pinnacle Health Group",
        value: 32000,
        expectedClose: "Mar 22, 2026",
        probability: 15,
        owner: "Marcus Ali",
        stage: "Prospecting",
        contactName: "Dr. Rachel Kim",
        contactRole: "CTO",
        lastActivity: "LinkedIn connection accepted",
        notes: "Referred by Coastal Realty. HIPAA compliance required."
    },
    {
        id: "d3",
        company: "Northwind Logistics",
        value: 67000,
        expectedClose: "Mar 28, 2026",
        probability: 25,
        owner: "Sarah Chen",
        stage: "Prospecting",
        contactName: "Tom Fischer",
        contactRole: "Director of Operations",
        lastActivity: "Cold call - left voicemail",
        notes: "Fleet management use case. 200+ drivers."
    },
    {
        id: "d4",
        company: "Atlas Cloud Services",
        value: 120000,
        expectedClose: "Mar 20, 2026",
        probability: 45,
        owner: "Emily Tran",
        stage: "Qualification",
        contactName: "Derek Patel",
        contactRole: "Head of Infrastructure",
        lastActivity: "Discovery call completed",
        notes: "Budget approved for Q1. Decision committee of 3."
    },
    {
        id: "d5",
        company: "Verdant Agriculture",
        value: 38000,
        expectedClose: "Apr 5, 2026",
        probability: 40,
        owner: "Marcus Ali",
        stage: "Qualification",
        contactName: "Lisa Johansson",
        contactRole: "CEO",
        lastActivity: "Needs assessment meeting scheduled",
        notes: "Small team but high growth. May expand to 50 seats."
    },
    {
        id: "d6",
        company: "Brightpath Education",
        value: 85000,
        expectedClose: "Mar 18, 2026",
        probability: 65,
        owner: "Sarah Chen",
        stage: "Proposal",
        contactName: "Michael Torres",
        contactRole: "VP Product",
        lastActivity: "Proposal sent - awaiting feedback",
        notes: "Competing with two other vendors. Price sensitive."
    },
    {
        id: "d7",
        company: "Ember Creative Studio",
        value: 52000,
        expectedClose: "Mar 25, 2026",
        probability: 70,
        owner: "Emily Tran",
        stage: "Proposal",
        contactName: "Yuki Tanaka",
        contactRole: "Creative Director",
        lastActivity: "Demo completed - very positive",
        notes: "Loved the collaboration features. Wants annual billing discount."
    },
    {
        id: "d8",
        company: "Summit Financial",
        value: 155000,
        expectedClose: "Mar 10, 2026",
        probability: 80,
        owner: "Marcus Ali",
        stage: "Negotiation",
        contactName: "Catherine Blackwell",
        contactRole: "CFO",
        lastActivity: "Contract redline in progress",
        notes: "Legal reviewing MSA. Pushing for 15% volume discount."
    },
    {
        id: "d9",
        company: "Clearview Analytics",
        value: 73000,
        expectedClose: "Mar 12, 2026",
        probability: 85,
        owner: "Sarah Chen",
        stage: "Negotiation",
        contactName: "Andrew Ng",
        contactRole: "Head of Data",
        lastActivity: "Final pricing discussion",
        notes: "Verbal commitment received. Waiting on PO."
    },
    {
        id: "d10",
        company: "Coastal Realty Group",
        value: 41000,
        expectedClose: "Feb 28, 2026",
        probability: 100,
        owner: "Emily Tran",
        stage: "Closed Won",
        contactName: "Patricia Silva",
        contactRole: "Managing Director",
        lastActivity: "Contract signed",
        notes: "3-year deal. Onboarding starts next week."
    },
    {
        id: "d11",
        company: "Nimbus SaaS Inc.",
        value: 96000,
        expectedClose: "Feb 25, 2026",
        probability: 100,
        owner: "Marcus Ali",
        stage: "Closed Won",
        contactName: "Henrik Larsson",
        contactRole: "CRO",
        lastActivity: "Payment received",
        notes: "Upsold from starter to enterprise. Great champion."
    },
    {
        id: "d12",
        company: "Drift Coffee Roasters",
        value: 18000,
        expectedClose: "Mar 1, 2026",
        probability: 100,
        owner: "Sarah Chen",
        stage: "Closed Won",
        contactName: "Maria Santos",
        contactRole: "Owner",
        lastActivity: "Contract signed",
        notes: "Small deal but strong referral potential."
    },
    {
        id: "d13",
        company: "Quantum Dynamics",
        value: 62000,
        expectedClose: "Feb 20, 2026",
        probability: 0,
        owner: "Emily Tran",
        stage: "Closed Lost",
        contactName: "Robert Chang",
        contactRole: "VP Technology",
        lastActivity: "Went with competitor",
        notes: "Lost to incumbent. Price was not the issue - integration depth."
    },
    {
        id: "d14",
        company: "Redwood Manufacturing",
        value: 28000,
        expectedClose: "Feb 15, 2026",
        probability: 0,
        owner: "Marcus Ali",
        stage: "Closed Lost",
        contactName: "Steve Kowalski",
        contactRole: "Plant Manager",
        lastActivity: "Budget frozen",
        notes: "Project shelved due to budget cuts. Revisit in Q3."
    }
];

// --- Helpers ---

function formatCurrency(amount: number): string {
    if (amount >= 1000) {
        return `$${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}k`;
    }
    return `$${amount.toLocaleString()}`;
}
function formatCurrencyFull(amount: number): string {
    return `$${amount.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    })}`;
}
function initialsFrom(name: string): string {
    const parts = name.split(" ");
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
}
const avatarHues = ["#6366F1", "#EC4899", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EF4444", "#14B8A6"];
function colorForName(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return avatarHues[Math.abs(hash) % avatarHues.length];
}

/** Returns a color for a probability value: red < 30, orange < 50, yellow < 70, green >= 70 */
function probabilityColor(prob: number): string {
    if (prob === 0) return "#9CA3AF";
    if (prob < 30) return "#EF4444";
    if (prob < 50) return "#F59E0B";
    if (prob < 70) return "#3B82F6";
    return "#10B981";
}

/** Icon name for each stage */
function stageIcon(stage: DealStage): keyof typeof Ionicons.glyphMap {
    switch (stage) {
        case "Prospecting":
            return "search-outline";
        case "Qualification":
            return "checkmark-circle-outline";
        case "Proposal":
            return "document-text-outline";
        case "Negotiation":
            return "chatbubbles-outline";
        case "Closed Won":
            return "trophy-outline";
        case "Closed Lost":
            return "close-circle-outline";
    }
}

// --- Sub-components ---

/** Revenue progress bar with target indicator */
function RevenueProgressBar({
    current,
    target,
    barColor,
    trackColor
}: {
    current: number;
    target: number;
    barColor: string;
    trackColor: string;
}) {
    const pct = Math.min(current / target, 1);
    return (
        <View style={styles.progressBarContainer}>
            <View
                style={[
                    styles.progressBarTrack,
                    {
                        backgroundColor: trackColor
                    }
                ]}
            >
                <View
                    style={[
                        styles.progressBarFill,
                        {
                            backgroundColor: barColor,
                            width: `${pct * 100}%`
                        }
                    ]}
                />
            </View>
            <View style={styles.progressBarLabels}>
                <Text
                    style={[
                        styles.progressBarPct,
                        {
                            color: barColor
                        }
                    ]}
                >
                    {Math.round(pct * 100)}%
                </Text>
                <Text
                    style={[
                        styles.progressBarTarget,
                        {
                            color: trackColor
                        }
                    ]}
                >
                    {formatCurrencyFull(current)} / {formatCurrencyFull(target)}
                </Text>
            </View>
        </View>
    );
}

/** Funnel visualization showing deal count and value per stage */
function PipelineFunnel({
    dealsByStage,
    activeStage,
    onStagePress,
    primaryColor,
    textColor,
    subtextColor
}: {
    dealsByStage: Map<DealStage, Deal[]>;
    activeStage: DealStage | null;
    onStagePress: (stage: DealStage | null) => void;
    primaryColor: string;
    textColor: string;
    subtextColor: string;
}) {
    // Only show active pipeline stages in funnel (not closed)
    const funnelStages: DealStage[] = ["Prospecting", "Qualification", "Proposal", "Negotiation"];
    const maxCount = Math.max(...funnelStages.map((s) => dealsByStage.get(s)?.length ?? 0), 1);
    return (
        <View style={styles.funnelContainer}>
            {funnelStages.map((stage, idx) => {
                const deals = dealsByStage.get(stage) ?? [];
                const count = deals.length;
                const totalValue = deals.reduce((s, d) => s + d.value, 0);
                const barWidth = Math.max((count / maxCount) * 100, 20);
                const isActive = activeStage === stage;
                const funnelColors = ["#93C5FD", "#60A5FA", "#3B82F6", "#1D4ED8"];
                return (
                    <Pressable
                        key={stage}
                        onPress={() => onStagePress(isActive ? null : stage)}
                        style={styles.funnelRow}
                    >
                        <View style={styles.funnelLabelCol}>
                            <Text
                                style={[
                                    styles.funnelStageLabel,
                                    {
                                        color: isActive ? primaryColor : textColor
                                    }
                                ]}
                                numberOfLines={1}
                            >
                                {stage}
                            </Text>
                            <Text
                                style={[
                                    styles.funnelStageCount,
                                    {
                                        color: subtextColor
                                    }
                                ]}
                            >
                                {count} deal{count !== 1 ? "s" : ""}
                            </Text>
                        </View>
                        <View style={styles.funnelBarCol}>
                            <View
                                style={[
                                    styles.funnelBar,
                                    {
                                        width: `${barWidth}%`,
                                        backgroundColor: isActive ? primaryColor : funnelColors[idx],
                                        opacity: isActive ? 1 : 0.8
                                    }
                                ]}
                            >
                                <Text style={styles.funnelBarValue}>{formatCurrency(totalValue)}</Text>
                            </View>
                        </View>
                    </Pressable>
                );
            })}
        </View>
    );
}

/** Stage filter pill tabs including All + Closed stages */
function StageFilterPills({
    stages,
    activeStage,
    onSelect,
    dealsByStage,
    primaryColor,
    surfaceColor,
    textColor
}: {
    stages: DealStage[];
    activeStage: DealStage | null;
    onSelect: (stage: DealStage | null) => void;
    dealsByStage: Map<DealStage, Deal[]>;
    primaryColor: string;
    surfaceColor: string;
    textColor: string;
}) {
    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsScroll}>
            <Pressable
                onPress={() => onSelect(null)}
                style={[
                    styles.pill,
                    {
                        backgroundColor: activeStage === null ? primaryColor : surfaceColor
                    }
                ]}
            >
                <Text
                    style={[
                        styles.pillText,
                        {
                            color: activeStage === null ? "#FFFFFF" : textColor
                        }
                    ]}
                >
                    All
                </Text>
            </Pressable>
            {stages.map((stage) => {
                const isActive = activeStage === stage;
                const count = dealsByStage.get(stage)?.length ?? 0;
                return (
                    <Pressable
                        key={stage}
                        onPress={() => onSelect(stage)}
                        style={[
                            styles.pill,
                            {
                                backgroundColor: isActive ? primaryColor : surfaceColor
                            }
                        ]}
                    >
                        <Text
                            style={[
                                styles.pillText,
                                {
                                    color: isActive ? "#FFFFFF" : textColor
                                }
                            ]}
                        >
                            {stage}
                        </Text>
                        <View
                            style={[
                                styles.pillBadge,
                                {
                                    backgroundColor: isActive ? "rgba(255,255,255,0.25)" : `${primaryColor}20`
                                }
                            ]}
                        >
                            <Text
                                style={[
                                    styles.pillBadgeText,
                                    {
                                        color: isActive ? "#FFFFFF" : primaryColor
                                    }
                                ]}
                            >
                                {count}
                            </Text>
                        </View>
                    </Pressable>
                );
            })}
        </ScrollView>
    );
}

/** Individual deal card with expandable details */
function DealCard({
    deal,
    isExpanded,
    onToggle,
    surfaceColor,
    textColor,
    subtextColor,
    borderColor,
    primaryColor,
    errorColor
}: {
    deal: Deal;
    isExpanded: boolean;
    onToggle: () => void;
    surfaceColor: string;
    textColor: string;
    subtextColor: string;
    borderColor: string;
    primaryColor: string;
    errorColor: string;
}) {
    const probColor = probabilityColor(deal.probability);
    const ownerColor = colorForName(deal.owner);
    const ownerInitials = initialsFrom(deal.owner);
    const isLost = deal.stage === "Closed Lost";
    const isWon = deal.stage === "Closed Won";
    return (
        <Pressable
            onPress={onToggle}
            style={({ pressed }) => [
                pressed && {
                    opacity: 0.92
                }
            ]}
        >
            <Card
                style={[
                    styles.dealCard,
                    {
                        backgroundColor: surfaceColor,
                        borderColor: isExpanded ? primaryColor : borderColor
                    }
                ]}
            >
                {/* Left accent stripe */}
                <View
                    style={[
                        styles.dealCardStripe,
                        {
                            backgroundColor: isWon ? "#10B981" : isLost ? errorColor : probColor
                        }
                    ]}
                />

                <View style={styles.dealCardContent}>
                    {/* Top row: company + value */}
                    <View style={styles.dealTopRow}>
                        <View style={styles.dealCompanyCol}>
                            <Text
                                style={[
                                    styles.dealCompany,
                                    {
                                        color: textColor
                                    },
                                    isLost && {
                                        textDecorationLine: "line-through",
                                        opacity: 0.6
                                    }
                                ]}
                                numberOfLines={1}
                            >
                                {deal.company}
                            </Text>
                            <Text
                                style={[
                                    styles.dealCloseDate,
                                    {
                                        color: subtextColor
                                    }
                                ]}
                            >
                                {deal.expectedClose}
                            </Text>
                        </View>
                        <Text
                            style={[
                                styles.dealValue,
                                {
                                    color: isWon ? "#10B981" : isLost ? subtextColor : textColor
                                }
                            ]}
                        >
                            {formatCurrencyFull(deal.value)}
                        </Text>
                    </View>

                    {/* Bottom row: probability chip + owner avatar */}
                    <View style={styles.dealBottomRow}>
                        <View
                            style={[
                                styles.probChip,
                                {
                                    backgroundColor: `${probColor}18`
                                }
                            ]}
                        >
                            <View
                                style={[
                                    styles.probDot,
                                    {
                                        backgroundColor: probColor
                                    }
                                ]}
                            />
                            <Text
                                style={[
                                    styles.probText,
                                    {
                                        color: probColor
                                    }
                                ]}
                            >
                                {deal.probability}%
                            </Text>
                        </View>

                        <View style={styles.dealOwnerRow}>
                            <Text
                                style={[
                                    styles.dealOwnerName,
                                    {
                                        color: subtextColor
                                    }
                                ]}
                                numberOfLines={1}
                            >
                                {deal.owner}
                            </Text>
                            <View
                                style={[
                                    styles.ownerAvatar,
                                    {
                                        backgroundColor: `${ownerColor}20`
                                    }
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.ownerAvatarText,
                                        {
                                            color: ownerColor
                                        }
                                    ]}
                                >
                                    {ownerInitials}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Expanded details */}
                    {isExpanded && (
                        <View
                            style={[
                                styles.dealExpanded,
                                {
                                    borderTopColor: borderColor
                                }
                            ]}
                        >
                            <View style={styles.dealExpandedRow}>
                                <Ionicons name="person-outline" size={14} color={subtextColor} />
                                <Text
                                    style={[
                                        styles.dealExpandedLabel,
                                        {
                                            color: subtextColor
                                        }
                                    ]}
                                >
                                    Contact
                                </Text>
                                <Text
                                    style={[
                                        styles.dealExpandedValue,
                                        {
                                            color: textColor
                                        }
                                    ]}
                                >
                                    {deal.contactName}, {deal.contactRole}
                                </Text>
                            </View>
                            <View style={styles.dealExpandedRow}>
                                <Ionicons name="time-outline" size={14} color={subtextColor} />
                                <Text
                                    style={[
                                        styles.dealExpandedLabel,
                                        {
                                            color: subtextColor
                                        }
                                    ]}
                                >
                                    Last Activity
                                </Text>
                                <Text
                                    style={[
                                        styles.dealExpandedValue,
                                        {
                                            color: textColor
                                        }
                                    ]}
                                >
                                    {deal.lastActivity}
                                </Text>
                            </View>
                            {deal.notes ? (
                                <View style={styles.dealExpandedRow}>
                                    <Ionicons name="document-text-outline" size={14} color={subtextColor} />
                                    <Text
                                        style={[
                                            styles.dealExpandedLabel,
                                            {
                                                color: subtextColor
                                            }
                                        ]}
                                    >
                                        Notes
                                    </Text>
                                    <Text
                                        style={[
                                            styles.dealExpandedValue,
                                            {
                                                color: textColor
                                            }
                                        ]}
                                    >
                                        {deal.notes}
                                    </Text>
                                </View>
                            ) : null}
                        </View>
                    )}
                </View>
            </Card>
        </Pressable>
    );
}

/** Stage group header with icon, count, and total value */
function StageHeader({
    stage,
    count,
    totalValue,
    textColor,
    subtextColor,
    primaryColor
}: {
    stage: DealStage;
    count: number;
    totalValue: number;
    textColor: string;
    subtextColor: string;
    primaryColor: string;
}) {
    const icon = stageIcon(stage);
    const isWon = stage === "Closed Won";
    const isLost = stage === "Closed Lost";
    const iconColor = isWon ? "#10B981" : isLost ? "#EF4444" : primaryColor;
    return (
        <View style={styles.stageHeader}>
            <Ionicons name={icon} size={18} color={iconColor} />
            <Text
                style={[
                    styles.stageHeaderLabel,
                    {
                        color: textColor
                    }
                ]}
            >
                {stage}
            </Text>
            <View
                style={[
                    styles.stageCountBadge,
                    {
                        backgroundColor: `${iconColor}18`
                    }
                ]}
            >
                <Text
                    style={[
                        styles.stageCountText,
                        {
                            color: iconColor
                        }
                    ]}
                >
                    {count}
                </Text>
            </View>
            <View
                style={{
                    flex: 1
                }}
            />
            <Text
                style={[
                    styles.stageTotal,
                    {
                        color: subtextColor
                    }
                ]}
            >
                {formatCurrencyFull(totalValue)}
            </Text>
        </View>
    );
}

// --- Main Component ---

/**
 * Sales pipeline tracker showcase page with revenue metrics, funnel visualization,
 * stage-grouped deal cards, and expandable deal details.
 */
export function SalesPipelinePage() {
    const { theme } = useUnistyles();
    const [stageFilter, setStageFilter] = React.useState<DealStage | null>(null);
    const [expandedDealId, setExpandedDealId] = React.useState<string | null>(null);

    // Group deals by stage
    const dealsByStage = React.useMemo(() => {
        const map = new Map<DealStage, Deal[]>();
        for (const stage of allStages) {
            map.set(stage, []);
        }
        for (const deal of mockDeals) {
            map.get(deal.stage)!.push(deal);
        }
        return map;
    }, []);

    // Computed metrics
    const closedWonDeals = dealsByStage.get("Closed Won") ?? [];
    const closedThisMonth = closedWonDeals.reduce((s, d) => s + d.value, 0);
    const pipelineDeals = mockDeals.filter((d) => d.stage !== "Closed Won" && d.stage !== "Closed Lost");
    const pipelineValue = pipelineDeals.reduce((s, d) => s + d.value, 0);
    const totalDeals = mockDeals.filter((d) => d.stage !== "Closed Lost").length;
    const wonDeals = closedWonDeals.length;
    const winRate = totalDeals > 0 ? Math.round((wonDeals / totalDeals) * 100) : 0;

    // Filter stages to display
    const stagesToShow = stageFilter ? [stageFilter] : allStages;
    const handleToggleDeal = React.useCallback((dealId: string) => {
        setExpandedDealId((prev) => (prev === dealId ? null : dealId));
    }, []);
    return (
        <ShowcasePage edgeToEdge bottomInset={48} contentBackgroundColor={theme.colors.surface}>
            {/* Revenue Metrics Hero */}
            <View
                style={[
                    styles.metricsHero,
                    {
                        backgroundColor: theme.colors.surfaceContainer
                    }
                ]}
            >
                <Text
                    style={[
                        styles.metricsLabel,
                        {
                            color: theme.colors.onSurfaceVariant
                        }
                    ]}
                >
                    MONTHLY TARGET
                </Text>
                <Text
                    style={[
                        styles.metricsAmount,
                        {
                            color: theme.colors.onSurface
                        }
                    ]}
                >
                    {formatCurrencyFull(monthlyTarget)}
                </Text>
                <RevenueProgressBar
                    current={closedThisMonth}
                    target={monthlyTarget}
                    barColor={theme.colors.primary}
                    trackColor={theme.colors.outlineVariant}
                />
            </View>

            {/* KPI Cards Row */}
            <View style={styles.kpiRow}>
                <Card
                    style={[
                        styles.kpiCard,
                        {
                            backgroundColor: theme.colors.surfaceContainer
                        }
                    ]}
                >
                    <Ionicons name="checkmark-done-outline" size={20} color="#10B981" />
                    <Text
                        style={[
                            styles.kpiValue,
                            {
                                color: theme.colors.onSurface
                            }
                        ]}
                    >
                        {formatCurrencyFull(closedThisMonth)}
                    </Text>
                    <Text
                        style={[
                            styles.kpiLabel,
                            {
                                color: theme.colors.onSurfaceVariant
                            }
                        ]}
                    >
                        Closed
                    </Text>
                </Card>
                <Card
                    style={[
                        styles.kpiCard,
                        {
                            backgroundColor: theme.colors.surfaceContainer
                        }
                    ]}
                >
                    <Ionicons name="layers-outline" size={20} color={theme.colors.primary} />
                    <Text
                        style={[
                            styles.kpiValue,
                            {
                                color: theme.colors.onSurface
                            }
                        ]}
                    >
                        {formatCurrencyFull(pipelineValue)}
                    </Text>
                    <Text
                        style={[
                            styles.kpiLabel,
                            {
                                color: theme.colors.onSurfaceVariant
                            }
                        ]}
                    >
                        Pipeline
                    </Text>
                </Card>
                <Card
                    style={[
                        styles.kpiCard,
                        {
                            backgroundColor: theme.colors.surfaceContainer
                        }
                    ]}
                >
                    <Ionicons name="trending-up-outline" size={20} color="#F59E0B" />
                    <Text
                        style={[
                            styles.kpiValue,
                            {
                                color: theme.colors.onSurface
                            }
                        ]}
                    >
                        {winRate}%
                    </Text>
                    <Text
                        style={[
                            styles.kpiLabel,
                            {
                                color: theme.colors.onSurfaceVariant
                            }
                        ]}
                    >
                        Win Rate
                    </Text>
                </Card>
            </View>

            {/* Pipeline Funnel */}
            <View style={styles.sectionContainer}>
                <Text
                    style={[
                        styles.sectionTitle,
                        {
                            color: theme.colors.onSurface
                        }
                    ]}
                >
                    Pipeline Funnel
                </Text>
                <PipelineFunnel
                    dealsByStage={dealsByStage}
                    activeStage={stageFilter}
                    onStagePress={setStageFilter}
                    primaryColor={theme.colors.primary}
                    textColor={theme.colors.onSurface}
                    subtextColor={theme.colors.onSurfaceVariant}
                />
            </View>

            {/* Stage Filter Tabs */}
            <StageFilterPills
                stages={allStages}
                activeStage={stageFilter}
                onSelect={setStageFilter}
                dealsByStage={dealsByStage}
                primaryColor={theme.colors.primary}
                surfaceColor={theme.colors.surfaceContainerHighest}
                textColor={theme.colors.onSurfaceVariant}
            />

            {/* Deals grouped by stage */}
            <View style={styles.dealsContainer}>
                {stagesToShow.map((stage) => {
                    const deals = dealsByStage.get(stage) ?? [];
                    if (deals.length === 0 && stageFilter === null) return null;
                    const totalValue = deals.reduce((s, d) => s + d.value, 0);
                    return (
                        <View key={stage} style={styles.stageGroup}>
                            <StageHeader
                                stage={stage}
                                count={deals.length}
                                totalValue={totalValue}
                                textColor={theme.colors.onSurface}
                                subtextColor={theme.colors.onSurfaceVariant}
                                primaryColor={theme.colors.primary}
                            />
                            {deals.length === 0 ? (
                                <View style={styles.emptyStage}>
                                    <Text
                                        style={[
                                            styles.emptyStageText,
                                            {
                                                color: theme.colors.onSurfaceVariant
                                            }
                                        ]}
                                    >
                                        No deals in this stage
                                    </Text>
                                </View>
                            ) : (
                                <View style={styles.dealsList}>
                                    {deals.map((deal) => (
                                        <DealCard
                                            key={deal.id}
                                            deal={deal}
                                            isExpanded={expandedDealId === deal.id}
                                            onToggle={() => handleToggleDeal(deal.id)}
                                            surfaceColor={theme.colors.surfaceContainer}
                                            textColor={theme.colors.onSurface}
                                            subtextColor={theme.colors.onSurfaceVariant}
                                            borderColor={theme.colors.outlineVariant}
                                            primaryColor={theme.colors.primary}
                                            errorColor={theme.colors.error}
                                        />
                                    ))}
                                </View>
                            )}
                        </View>
                    );
                })}
            </View>
        </ShowcasePage>
    );
}

// --- Styles ---

const styles = StyleSheet.create((_theme) => ({
    // Revenue metrics hero
    metricsHero: {
        marginHorizontal: 16,
        marginTop: 20,
        borderRadius: 16,
        padding: 24,
        alignItems: "center",
        gap: 4
    },
    metricsLabel: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11,
        letterSpacing: 1,
        textTransform: "uppercase"
    },
    metricsAmount: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 34,
        letterSpacing: -1,
        marginBottom: 12
    },
    // Progress bar
    progressBarContainer: {
        width: "100%",
        gap: 6
    },
    progressBarTrack: {
        height: 10,
        borderRadius: 5,
        width: "100%",
        overflow: "hidden"
    },
    progressBarFill: {
        height: 10,
        borderRadius: 5
    },
    progressBarLabels: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    progressBarPct: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 14
    },
    progressBarTarget: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11
    },
    // KPI cards
    kpiRow: {
        flexDirection: "row",
        gap: 10,
        paddingHorizontal: 16,
        marginTop: 12,
        marginBottom: 20
    },
    kpiCard: {
        flex: 1,
        borderRadius: 12,
        padding: 14,
        alignItems: "center",
        gap: 4
    },
    kpiValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 17,
        letterSpacing: -0.3
    },
    kpiLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11,
        letterSpacing: 0.3,
        textTransform: "uppercase"
    },
    // Funnel
    sectionContainer: {
        paddingHorizontal: 16,
        marginBottom: 16,
        gap: 10
    },
    sectionTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 16,
        letterSpacing: -0.2
    },
    funnelContainer: {
        gap: 6
    },
    funnelRow: {
        flexDirection: "row",
        alignItems: "center",
        height: 38
    },
    funnelLabelCol: {
        width: 110,
        paddingRight: 8
    },
    funnelStageLabel: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 12
    },
    funnelStageCount: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 10
    },
    funnelBarCol: {
        flex: 1
    },
    funnelBar: {
        height: 28,
        borderRadius: 6,
        justifyContent: "center",
        paddingHorizontal: 10,
        minWidth: 60
    },
    funnelBarValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 12,
        color: "#FFFFFF"
    },
    // Filter pills
    pillsScroll: {
        paddingHorizontal: 16,
        gap: 8,
        paddingBottom: 16
    },
    pill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20
    },
    pillText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 12
    },
    pillBadge: {
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center"
    },
    pillBadgeText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 10
    },
    // Deals container
    dealsContainer: {
        paddingHorizontal: 16,
        gap: 20
    },
    stageGroup: {
        gap: 8
    },
    // Stage header
    stageHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingBottom: 4
    },
    stageHeaderLabel: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15
    },
    stageCountBadge: {
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: "center",
        justifyContent: "center"
    },
    stageCountText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 11
    },
    stageTotal: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 13
    },
    // Deal card
    dealsList: {
        gap: 8
    },
    dealCard: {
        borderRadius: 12,
        borderWidth: 1,
        overflow: "hidden",
        flexDirection: "row"
    },
    dealCardStripe: {
        width: 4
    },
    dealCardContent: {
        flex: 1,
        padding: 14,
        gap: 10
    },
    dealTopRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 12
    },
    dealCompanyCol: {
        flex: 1,
        gap: 2
    },
    dealCompany: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15
    },
    dealCloseDate: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    dealValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 16,
        letterSpacing: -0.3
    },
    dealBottomRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    probChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12
    },
    probDot: {
        width: 6,
        height: 6,
        borderRadius: 3
    },
    probText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 12
    },
    dealOwnerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    dealOwnerName: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    ownerAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center"
    },
    ownerAvatarText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 11
    },
    // Expanded deal details
    dealExpanded: {
        borderTopWidth: 1,
        paddingTop: 10,
        gap: 8
    },
    dealExpandedRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8
    },
    dealExpandedLabel: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 12,
        width: 80
    },
    dealExpandedValue: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        flex: 1,
        lineHeight: 18
    },
    // Empty stage
    emptyStage: {
        paddingVertical: 20,
        alignItems: "center"
    },
    emptyStageText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13
    }
}));
