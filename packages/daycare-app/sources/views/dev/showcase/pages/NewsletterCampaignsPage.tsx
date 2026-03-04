import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Card } from "@/components/Card";

// --- Types ---
import { Grid } from "@/components/Grid";
import { ShowcasePage } from "@/views/dev/showcase/components/ShowcasePage";

type CampaignStatus = "draft" | "scheduled" | "sent";
type Segment = {
    name: string;
    recipients: number;
    openRate: number;
    clickRate: number;
    color: string;
};
type ABVariant = {
    label: string;
    subjectLine: string;
    openRate: number;
    clickRate: number;
    winner: boolean;
};
type Campaign = {
    id: string;
    name: string;
    subjectLine: string;
    status: CampaignStatus;
    sendDate: string;
    recipients: number;
    openRate?: number;
    clickRate?: number;
    draftCompletion?: number;
    contentPreview: string;
    abVariants?: ABVariant[];
    segments?: Segment[];
};

// --- Constants ---

const STATUS_CONFIG: Record<
    CampaignStatus,
    {
        label: string;
        icon: keyof typeof Ionicons.glyphMap;
        color: string;
    }
> = {
    draft: {
        label: "Draft",
        icon: "create-outline",
        color: "#F59E0B"
    },
    scheduled: {
        label: "Scheduled",
        icon: "time-outline",
        color: "#6366F1"
    },
    sent: {
        label: "Sent",
        icon: "checkmark-circle-outline",
        color: "#10B981"
    }
};

// --- Mock Data ---

const CAMPAIGNS: Campaign[] = [
    {
        id: "c1",
        name: "March Product Update",
        subjectLine: "What's new in March - 3 features you'll love",
        status: "sent",
        sendDate: "Mar 1, 2026",
        recipients: 12480,
        openRate: 42.3,
        clickRate: 8.7,
        contentPreview:
            "Hi there! We've been busy this month building features you've been asking for. Here's a quick rundown of what's new: improved dashboard analytics, team collaboration tools, and our brand new mobile app...",
        abVariants: [
            {
                label: "A",
                subjectLine: "What's new in March - 3 features you'll love",
                openRate: 42.3,
                clickRate: 8.7,
                winner: true
            },
            {
                label: "B",
                subjectLine: "March update: Your dashboard just got smarter",
                openRate: 38.1,
                clickRate: 7.2,
                winner: false
            }
        ],
        segments: [
            {
                name: "Active Users",
                recipients: 5200,
                openRate: 52.1,
                clickRate: 12.4,
                color: "#10B981"
            },
            {
                name: "Free Tier",
                recipients: 4100,
                openRate: 35.8,
                clickRate: 5.2,
                color: "#3B82F6"
            },
            {
                name: "Inactive (30d)",
                recipients: 3180,
                openRate: 28.4,
                clickRate: 3.1,
                color: "#9CA3AF"
            }
        ]
    },
    {
        id: "c2",
        name: "Customer Success Stories",
        subjectLine: "How Meridian Labs grew 3x with our platform",
        status: "sent",
        sendDate: "Feb 22, 2026",
        recipients: 11900,
        openRate: 38.6,
        clickRate: 11.2,
        contentPreview:
            "Every month, we spotlight a customer who's achieved incredible results. This month, meet Meridian Labs - they went from a small team of 5 to a 45-person operation in just 18 months...",
        segments: [
            {
                name: "Enterprise",
                recipients: 2400,
                openRate: 48.2,
                clickRate: 16.8,
                color: "#6366F1"
            },
            {
                name: "Pro Users",
                recipients: 5100,
                openRate: 40.1,
                clickRate: 12.5,
                color: "#3B82F6"
            },
            {
                name: "Free Tier",
                recipients: 4400,
                openRate: 29.3,
                clickRate: 5.8,
                color: "#9CA3AF"
            }
        ]
    },
    {
        id: "c3",
        name: "Weekly Digest #42",
        subjectLine: "Your weekly roundup: top tips & community highlights",
        status: "sent",
        sendDate: "Feb 15, 2026",
        recipients: 13200,
        openRate: 31.2,
        clickRate: 6.4,
        contentPreview:
            "Here's your weekly digest! This week: top 5 productivity hacks from our power users, a community Q&A recap, and an exclusive sneak peek at our upcoming feature...",
        segments: [
            {
                name: "Digest Subscribers",
                recipients: 8900,
                openRate: 34.5,
                clickRate: 7.8,
                color: "#10B981"
            },
            {
                name: "All Others",
                recipients: 4300,
                openRate: 24.1,
                clickRate: 3.5,
                color: "#9CA3AF"
            }
        ]
    },
    {
        id: "c4",
        name: "Spring Promo - 20% Off",
        subjectLine: "Spring into savings - 20% off annual plans",
        status: "scheduled",
        sendDate: "Mar 10, 2026",
        recipients: 14200,
        contentPreview:
            "Spring is here, and so are savings! For a limited time, get 20% off any annual plan. Whether you're on Free or Starter, now's the perfect time to upgrade...",
        abVariants: [
            {
                label: "A",
                subjectLine: "Spring into savings - 20% off annual plans",
                openRate: 0,
                clickRate: 0,
                winner: false
            },
            {
                label: "B",
                subjectLine: "Limited time: save 20% on your upgrade",
                openRate: 0,
                clickRate: 0,
                winner: false
            }
        ]
    },
    {
        id: "c5",
        name: "Webinar Invite: API Deep Dive",
        subjectLine: "You're invited: Live API deep dive this Thursday",
        status: "scheduled",
        sendDate: "Mar 6, 2026",
        recipients: 8400,
        contentPreview:
            "Join our engineering team for a live deep dive into our API. We'll cover new endpoints, best practices, rate limiting, and answer your questions live..."
    },
    {
        id: "c6",
        name: "Q1 Recap & Roadmap",
        subjectLine: "",
        status: "draft",
        sendDate: "TBD",
        recipients: 14200,
        draftCompletion: 65,
        contentPreview:
            "As we close out Q1, we wanted to share what we've accomplished and where we're headed. In the last 3 months, we shipped 47 features, onboarded 1,200 new teams..."
    },
    {
        id: "c7",
        name: "Partner Spotlight Series",
        subjectLine: "",
        status: "draft",
        sendDate: "TBD",
        recipients: 11500,
        draftCompletion: 30,
        contentPreview:
            "Introducing our new Partner Spotlight series! Each month we'll highlight one of our integration partners and show you creative ways to connect your workflow..."
    },
    {
        id: "c8",
        name: "Re-engagement: We Miss You",
        subjectLine: "It's been a while - here's what you've been missing",
        status: "draft",
        sendDate: "TBD",
        recipients: 3200,
        draftCompletion: 85,
        contentPreview:
            "We noticed you haven't logged in recently. We've made some big improvements since you last visited, including a completely redesigned dashboard...",
        abVariants: [
            {
                label: "A",
                subjectLine: "It's been a while - here's what you've been missing",
                openRate: 0,
                clickRate: 0,
                winner: false
            },
            {
                label: "B",
                subjectLine: "Come back and see what's changed",
                openRate: 0,
                clickRate: 0,
                winner: false
            }
        ]
    }
];

// --- Helpers ---

function formatNumber(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
}
function campaignsByStatus(status: CampaignStatus): Campaign[] {
    return CAMPAIGNS.filter((c) => c.status === status);
}
function averageOpenRate(): number {
    const sent = CAMPAIGNS.filter((c) => c.status === "sent" && c.openRate !== undefined);
    if (sent.length === 0) return 0;
    return sent.reduce((sum, c) => sum + (c.openRate ?? 0), 0) / sent.length;
}
function averageClickRate(): number {
    const sent = CAMPAIGNS.filter((c) => c.status === "sent" && c.clickRate !== undefined);
    if (sent.length === 0) return 0;
    return sent.reduce((sum, c) => sum + (c.clickRate ?? 0), 0) / sent.length;
}
function campaignsSentThisMonth(): number {
    return CAMPAIGNS.filter((c) => c.status === "sent" && c.sendDate.startsWith("Mar")).length;
}
const SUBSCRIBER_COUNT = 14200;
const SUBSCRIBER_TREND = "+820";

// --- Sub-components ---

/** Top metrics row: subscriber count, avg open rate, avg click rate, sent this month */
function MetricsRow({
    surfaceColor,
    textColor,
    subtextColor,
    borderColor
}: {
    surfaceColor: string;
    textColor: string;
    subtextColor: string;
    borderColor: string;
}) {
    const avgOpen = averageOpenRate();
    const avgClick = averageClickRate();
    const sentCount = campaignsSentThisMonth();
    const metrics = [
        {
            label: "Subscribers",
            value: formatNumber(SUBSCRIBER_COUNT),
            icon: "people-outline" as keyof typeof Ionicons.glyphMap,
            color: "#6366F1",
            trend: SUBSCRIBER_TREND
        },
        {
            label: "Avg Open Rate",
            value: `${avgOpen.toFixed(1)}%`,
            icon: "mail-open-outline" as keyof typeof Ionicons.glyphMap,
            color: "#10B981",
            gauge: avgOpen
        },
        {
            label: "Avg Click Rate",
            value: `${avgClick.toFixed(1)}%`,
            icon: "hand-left-outline" as keyof typeof Ionicons.glyphMap,
            color: "#3B82F6",
            gauge: avgClick
        },
        {
            label: "Sent This Month",
            value: sentCount.toString(),
            icon: "send-outline" as keyof typeof Ionicons.glyphMap,
            color: "#F59E0B"
        }
    ];
    return (
        <Grid style={styles.metricsGrid}>
            {metrics.map((m) => (
                <Card
                    key={m.label}
                    style={[
                        styles.metricCard,
                        {
                            backgroundColor: surfaceColor,
                            borderColor
                        }
                    ]}
                >
                    <View style={styles.metricCardHeader}>
                        <View
                            style={[
                                styles.metricIconBadge,
                                {
                                    backgroundColor: `${m.color}18`
                                }
                            ]}
                        >
                            <Ionicons name={m.icon} size={18} color={m.color} />
                        </View>
                    </View>
                    <Text
                        style={[
                            styles.metricValue,
                            {
                                color: textColor
                            }
                        ]}
                    >
                        {m.value}
                    </Text>
                    <Text
                        style={[
                            styles.metricLabel,
                            {
                                color: subtextColor
                            }
                        ]}
                    >
                        {m.label}
                    </Text>
                    {m.trend && (
                        <View
                            style={[
                                styles.trendBadge,
                                {
                                    backgroundColor: "#10B98118"
                                }
                            ]}
                        >
                            <Ionicons name="arrow-up" size={10} color="#10B981" />
                            <Text
                                style={[
                                    styles.trendText,
                                    {
                                        color: "#10B981"
                                    }
                                ]}
                            >
                                {m.trend}
                            </Text>
                        </View>
                    )}
                    {m.gauge !== undefined && (
                        <View style={styles.gaugeContainer}>
                            <View
                                style={[
                                    styles.gaugeTrack,
                                    {
                                        backgroundColor: `${m.color}18`
                                    }
                                ]}
                            >
                                <View
                                    style={[
                                        styles.gaugeFill,
                                        {
                                            width: `${Math.min(m.gauge, 100)}%`,
                                            backgroundColor: m.color
                                        }
                                    ]}
                                />
                            </View>
                        </View>
                    )}
                </Card>
            ))}
        </Grid>
    );
}

/** Section header with expand/collapse chevron */
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
                <Text
                    style={[
                        styles.sectionTitle,
                        {
                            color: textColor
                        }
                    ]}
                >
                    {title}
                </Text>
                {count !== undefined && (
                    <View
                        style={[
                            styles.sectionCount,
                            {
                                backgroundColor: `${iconColor}18`
                            }
                        ]}
                    >
                        <Text
                            style={[
                                styles.sectionCountText,
                                {
                                    color: iconColor
                                }
                            ]}
                        >
                            {count}
                        </Text>
                    </View>
                )}
            </View>
            <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={subtextColor} />
        </Pressable>
    );
}

/** Progress bar for draft completion */
function DraftProgressBar({ completion, color }: { completion: number; color: string }) {
    return (
        <View style={styles.progressContainer}>
            <View
                style={[
                    styles.progressTrack,
                    {
                        backgroundColor: `${color}18`
                    }
                ]}
            >
                <View
                    style={[
                        styles.progressFill,
                        {
                            width: `${completion}%`,
                            backgroundColor: color
                        }
                    ]}
                />
            </View>
            <Text
                style={[
                    styles.progressLabel,
                    {
                        color
                    }
                ]}
            >
                {completion}%
            </Text>
        </View>
    );
}

/** Single campaign row */
function CampaignRow({
    campaign,
    isSelected,
    onPress,
    textColor,
    subtextColor,
    borderColor
}: {
    campaign: Campaign;
    isSelected: boolean;
    onPress: () => void;
    textColor: string;
    subtextColor: string;
    borderColor: string;
}) {
    const statusCfg = STATUS_CONFIG[campaign.status];
    return (
        <Pressable onPress={onPress}>
            <View
                style={[
                    styles.campaignRow,
                    {
                        borderBottomColor: borderColor,
                        borderLeftColor: isSelected ? statusCfg.color : "transparent"
                    }
                ]}
            >
                <View style={styles.campaignMain}>
                    <View style={styles.campaignTitleRow}>
                        <Text
                            style={[
                                styles.campaignName,
                                {
                                    color: textColor
                                }
                            ]}
                            numberOfLines={1}
                        >
                            {campaign.name}
                        </Text>
                        <View
                            style={[
                                styles.statusChip,
                                {
                                    backgroundColor: `${statusCfg.color}18`
                                }
                            ]}
                        >
                            <Ionicons name={statusCfg.icon} size={12} color={statusCfg.color} />
                            <Text
                                style={[
                                    styles.statusChipText,
                                    {
                                        color: statusCfg.color
                                    }
                                ]}
                            >
                                {statusCfg.label}
                            </Text>
                        </View>
                    </View>
                    {campaign.subjectLine ? (
                        <Text
                            style={[
                                styles.subjectLine,
                                {
                                    color: subtextColor
                                }
                            ]}
                            numberOfLines={1}
                        >
                            {campaign.subjectLine}
                        </Text>
                    ) : (
                        <Text
                            style={[
                                styles.subjectLineEmpty,
                                {
                                    color: subtextColor
                                }
                            ]}
                        >
                            No subject line yet
                        </Text>
                    )}
                    <View style={styles.campaignMetaRow}>
                        <View style={styles.campaignMetaItem}>
                            <Ionicons name="calendar-outline" size={12} color={subtextColor} />
                            <Text
                                style={[
                                    styles.campaignMetaText,
                                    {
                                        color: subtextColor
                                    }
                                ]}
                            >
                                {campaign.sendDate}
                            </Text>
                        </View>
                        <View style={styles.campaignMetaItem}>
                            <Ionicons name="people-outline" size={12} color={subtextColor} />
                            <Text
                                style={[
                                    styles.campaignMetaText,
                                    {
                                        color: subtextColor
                                    }
                                ]}
                            >
                                {formatNumber(campaign.recipients)}
                            </Text>
                        </View>
                        {campaign.status === "sent" && campaign.openRate !== undefined && (
                            <View style={styles.campaignMetaItem}>
                                <Ionicons name="mail-open-outline" size={12} color="#10B981" />
                                <Text style={styles.monoMetric}>{campaign.openRate.toFixed(1)}%</Text>
                            </View>
                        )}
                        {campaign.status === "sent" && campaign.clickRate !== undefined && (
                            <View style={styles.campaignMetaItem}>
                                <Ionicons name="hand-left-outline" size={12} color="#3B82F6" />
                                <Text style={styles.monoMetric}>{campaign.clickRate.toFixed(1)}%</Text>
                            </View>
                        )}
                    </View>
                    {campaign.status === "draft" && campaign.draftCompletion !== undefined && (
                        <DraftProgressBar completion={campaign.draftCompletion} color={statusCfg.color} />
                    )}
                </View>
            </View>
        </Pressable>
    );
}

/** Detail panel with content preview, A/B variants, segment breakdown */
function CampaignDetail({
    campaign,
    surfaceColor,
    textColor,
    subtextColor,
    borderColor
}: {
    campaign: Campaign;
    surfaceColor: string;
    textColor: string;
    subtextColor: string;
    borderColor: string;
}) {
    return (
        <View
            style={[
                styles.detailPanel,
                {
                    backgroundColor: surfaceColor,
                    borderColor
                }
            ]}
        >
            {/* Content preview */}
            <View style={styles.detailSection}>
                <View style={styles.detailSectionHeader}>
                    <Ionicons name="document-text-outline" size={16} color={subtextColor} />
                    <Text
                        style={[
                            styles.detailSectionTitle,
                            {
                                color: textColor
                            }
                        ]}
                    >
                        Content Preview
                    </Text>
                </View>
                <Text
                    style={[
                        styles.contentPreview,
                        {
                            color: textColor
                        }
                    ]}
                >
                    {campaign.contentPreview}
                </Text>
            </View>

            {/* A/B test variants */}
            {campaign.abVariants && campaign.abVariants.length > 0 && (
                <View style={styles.detailSection}>
                    <View
                        style={[
                            styles.detailDivider,
                            {
                                borderColor
                            }
                        ]}
                    />
                    <View style={styles.detailSectionHeader}>
                        <Ionicons name="git-compare-outline" size={16} color="#8B5CF6" />
                        <Text
                            style={[
                                styles.detailSectionTitle,
                                {
                                    color: textColor
                                }
                            ]}
                        >
                            A/B Test Variants
                        </Text>
                    </View>
                    {campaign.abVariants.map((variant) => (
                        <Card
                            key={variant.label}
                            style={[
                                styles.variantCard,
                                {
                                    borderColor: variant.winner ? "#10B981" : borderColor,
                                    borderWidth: variant.winner ? 1.5 : 1
                                }
                            ]}
                        >
                            <View style={styles.variantHeader}>
                                <View style={styles.variantLabelRow}>
                                    <View
                                        style={[
                                            styles.variantBadge,
                                            {
                                                backgroundColor: variant.winner ? "#10B98118" : `${borderColor}80`
                                            }
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.variantBadgeText,
                                                {
                                                    color: variant.winner ? "#10B981" : subtextColor
                                                }
                                            ]}
                                        >
                                            {variant.label}
                                        </Text>
                                    </View>
                                    {variant.winner && (
                                        <View
                                            style={[
                                                styles.winnerBadge,
                                                {
                                                    backgroundColor: "#10B98118"
                                                }
                                            ]}
                                        >
                                            <Ionicons name="trophy-outline" size={11} color="#10B981" />
                                            <Text style={styles.winnerText}>Winner</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                            <Text
                                style={[
                                    styles.variantSubject,
                                    {
                                        color: textColor
                                    }
                                ]}
                                numberOfLines={2}
                            >
                                {variant.subjectLine}
                            </Text>
                            {campaign.status === "sent" && (
                                <View style={styles.variantMetrics}>
                                    <View style={styles.variantMetricItem}>
                                        <Text
                                            style={[
                                                styles.variantMetricLabel,
                                                {
                                                    color: subtextColor
                                                }
                                            ]}
                                        >
                                            Open
                                        </Text>
                                        <Text style={styles.variantMetricValue}>{variant.openRate.toFixed(1)}%</Text>
                                    </View>
                                    <View style={styles.variantMetricItem}>
                                        <Text
                                            style={[
                                                styles.variantMetricLabel,
                                                {
                                                    color: subtextColor
                                                }
                                            ]}
                                        >
                                            Click
                                        </Text>
                                        <Text style={styles.variantMetricValue}>{variant.clickRate.toFixed(1)}%</Text>
                                    </View>
                                </View>
                            )}
                        </Card>
                    ))}
                </View>
            )}

            {/* Segment performance breakdown */}
            {campaign.segments && campaign.segments.length > 0 && (
                <View style={styles.detailSection}>
                    <View
                        style={[
                            styles.detailDivider,
                            {
                                borderColor
                            }
                        ]}
                    />
                    <View style={styles.detailSectionHeader}>
                        <Ionicons name="pie-chart-outline" size={16} color="#3B82F6" />
                        <Text
                            style={[
                                styles.detailSectionTitle,
                                {
                                    color: textColor
                                }
                            ]}
                        >
                            Segment Breakdown
                        </Text>
                    </View>
                    {campaign.segments.map((seg) => {
                        const recipientPct = (seg.recipients / campaign.recipients) * 100;
                        return (
                            <View key={seg.name} style={styles.segmentRow}>
                                <View style={styles.segmentHeader}>
                                    <View style={styles.segmentNameRow}>
                                        <View
                                            style={[
                                                styles.segmentDot,
                                                {
                                                    backgroundColor: seg.color
                                                }
                                            ]}
                                        />
                                        <Text
                                            style={[
                                                styles.segmentName,
                                                {
                                                    color: textColor
                                                }
                                            ]}
                                        >
                                            {seg.name}
                                        </Text>
                                    </View>
                                    <Text
                                        style={[
                                            styles.segmentRecipients,
                                            {
                                                color: subtextColor
                                            }
                                        ]}
                                    >
                                        {formatNumber(seg.recipients)} ({recipientPct.toFixed(0)}%)
                                    </Text>
                                </View>
                                {/* Recipient proportion bar */}
                                <View style={styles.segmentBarContainer}>
                                    <View
                                        style={[
                                            styles.segmentBarTrack,
                                            {
                                                backgroundColor: `${seg.color}18`
                                            }
                                        ]}
                                    >
                                        <View
                                            style={[
                                                styles.segmentBarFill,
                                                {
                                                    width: `${recipientPct}%`,
                                                    backgroundColor: seg.color
                                                }
                                            ]}
                                        />
                                    </View>
                                </View>
                                <View style={styles.segmentMetrics}>
                                    <View style={styles.segmentMetricItem}>
                                        <Text
                                            style={[
                                                styles.segmentMetricLabel,
                                                {
                                                    color: subtextColor
                                                }
                                            ]}
                                        >
                                            Open Rate
                                        </Text>
                                        <Text style={styles.segmentMetricValue}>{seg.openRate.toFixed(1)}%</Text>
                                    </View>
                                    <View style={styles.segmentMetricItem}>
                                        <Text
                                            style={[
                                                styles.segmentMetricLabel,
                                                {
                                                    color: subtextColor
                                                }
                                            ]}
                                        >
                                            Click Rate
                                        </Text>
                                        <Text style={styles.segmentMetricValue}>{seg.clickRate.toFixed(1)}%</Text>
                                    </View>
                                </View>
                            </View>
                        );
                    })}
                </View>
            )}
        </View>
    );
}

// --- Main Component ---

/**
 * Newsletter campaigns management screen with subscriber metrics, open/click rate gauges,
 * campaigns grouped by status (Draft/Scheduled/Sent), draft progress bars, A/B test
 * variant comparison, and segment performance breakdown in the detail panel.
 */
export function NewsletterCampaignsPage() {
    const { theme } = useUnistyles();
    const [selectedCampaignId, setSelectedCampaignId] = React.useState<string | null>(null);
    const [expandedSections, setExpandedSections] = React.useState<Record<CampaignStatus, boolean>>({
        draft: true,
        scheduled: true,
        sent: true
    });
    const toggleSection = React.useCallback((status: CampaignStatus) => {
        setExpandedSections((prev) => ({
            ...prev,
            [status]: !prev[status]
        }));
    }, []);
    const handleCampaignPress = React.useCallback((id: string) => {
        setSelectedCampaignId((prev) => (prev === id ? null : id));
    }, []);
    const statusOrder: CampaignStatus[] = ["draft", "scheduled", "sent"];
    return (
        <ShowcasePage bottomInset={60} contentBackgroundColor={theme.colors.surface}>
            {/* Hero: subscriber count with trend */}
            <View style={styles.heroSection}>
                <Text
                    style={[
                        styles.heroLabel,
                        {
                            color: theme.colors.onSurfaceVariant
                        }
                    ]}
                >
                    NEWSLETTER
                </Text>
                <Text
                    style={[
                        styles.heroValue,
                        {
                            color: theme.colors.onSurface
                        }
                    ]}
                >
                    {formatNumber(SUBSCRIBER_COUNT)}
                </Text>
                <Text
                    style={[
                        styles.heroSub,
                        {
                            color: theme.colors.onSurfaceVariant
                        }
                    ]}
                >
                    Active subscribers
                </Text>
                <View
                    style={[
                        styles.heroBadge,
                        {
                            backgroundColor: "#10B98118"
                        }
                    ]}
                >
                    <Ionicons name="arrow-up" size={12} color="#10B981" />
                    <Text
                        style={[
                            styles.heroBadgeText,
                            {
                                color: "#10B981"
                            }
                        ]}
                    >
                        {SUBSCRIBER_TREND} this month
                    </Text>
                </View>
            </View>

            {/* Top-level metrics grid */}
            <MetricsRow
                surfaceColor={theme.colors.surfaceContainer}
                textColor={theme.colors.onSurface}
                subtextColor={theme.colors.onSurfaceVariant}
                borderColor={theme.colors.outlineVariant}
            />

            {/* Campaign sections grouped by status */}
            {statusOrder.map((status) => {
                const campaigns = campaignsByStatus(status);
                const cfg = STATUS_CONFIG[status];
                const isExpanded = expandedSections[status];
                return (
                    <View key={status}>
                        <SectionHeader
                            title={cfg.label}
                            icon={cfg.icon}
                            iconColor={cfg.color}
                            isExpanded={isExpanded}
                            onToggle={() => toggleSection(status)}
                            textColor={theme.colors.onSurface}
                            subtextColor={theme.colors.onSurfaceVariant}
                            count={campaigns.length}
                        />
                        {isExpanded && (
                            <Card
                                style={[
                                    styles.sectionCard,
                                    {
                                        backgroundColor: theme.colors.surfaceContainer
                                    }
                                ]}
                            >
                                {campaigns.map((campaign) => (
                                    <React.Fragment key={campaign.id}>
                                        <CampaignRow
                                            campaign={campaign}
                                            isSelected={selectedCampaignId === campaign.id}
                                            onPress={() => handleCampaignPress(campaign.id)}
                                            textColor={theme.colors.onSurface}
                                            subtextColor={theme.colors.onSurfaceVariant}
                                            borderColor={theme.colors.outlineVariant}
                                        />
                                        {selectedCampaignId === campaign.id && (
                                            <CampaignDetail
                                                campaign={campaign}
                                                surfaceColor={theme.colors.surface}
                                                textColor={theme.colors.onSurface}
                                                subtextColor={theme.colors.onSurfaceVariant}
                                                borderColor={theme.colors.outlineVariant}
                                            />
                                        )}
                                    </React.Fragment>
                                ))}
                            </Card>
                        )}
                    </View>
                );
            })}
        </ShowcasePage>
    );
}

// --- Styles ---

const styles = StyleSheet.create((_theme) => ({
    // Hero
    heroSection: {
        alignItems: "center",
        paddingTop: 12,
        paddingBottom: 16,
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
    heroSub: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13
    },
    heroBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginTop: 4
    },
    heroBadgeText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 12
    },
    // Metrics grid
    metricsGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
        marginBottom: 8
    },
    metricCard: {
        flexGrow: 1,
        flexBasis: "45%",
        borderRadius: 14,
        borderWidth: 1,
        padding: 14,
        gap: 4
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
    trendBadge: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 3,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 8
    },
    trendText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 10
    },
    // Gauge (for open/click rate cards)
    gaugeContainer: {
        marginTop: 2
    },
    gaugeTrack: {
        height: 6,
        borderRadius: 3,
        overflow: "hidden"
    },
    gaugeFill: {
        height: "100%",
        borderRadius: 3
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
        overflow: "hidden"
    },
    // Campaign row
    campaignRow: {
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: 0.5,
        borderLeftWidth: 3,
        gap: 6
    },
    campaignMain: {
        gap: 6
    },
    campaignTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8
    },
    campaignName: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15,
        flex: 1
    },
    statusChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8
    },
    statusChipText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11
    },
    subjectLine: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 18
    },
    subjectLineEmpty: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        fontStyle: "italic"
    },
    campaignMetaRow: {
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 12
    },
    campaignMetaItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4
    },
    campaignMetaText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },
    monoMetric: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 12,
        color: "#10B981"
    },
    // Draft progress bar
    progressContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginTop: 2
    },
    progressTrack: {
        flex: 1,
        height: 8,
        borderRadius: 4,
        overflow: "hidden"
    },
    progressFill: {
        height: "100%",
        borderRadius: 4
    },
    progressLabel: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 11,
        width: 32,
        textAlign: "right"
    },
    // Detail panel
    detailPanel: {
        borderRadius: 12,
        borderWidth: 1,
        marginHorizontal: 10,
        marginBottom: 4,
        padding: 14
    },
    detailSection: {
        gap: 10
    },
    detailSectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    detailSectionTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 14
    },
    detailDivider: {
        borderTopWidth: 1,
        marginVertical: 6
    },
    contentPreview: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 20
    },
    // A/B variant cards
    variantCard: {
        borderRadius: 10,
        padding: 12,
        gap: 6
    },
    variantHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between"
    },
    variantLabelRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    variantBadge: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: "center",
        justifyContent: "center"
    },
    variantBadgeText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 12
    },
    winnerBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8
    },
    winnerText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11,
        color: "#10B981"
    },
    variantSubject: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 18
    },
    variantMetrics: {
        flexDirection: "row",
        gap: 16,
        marginTop: 2
    },
    variantMetricItem: {
        gap: 2
    },
    variantMetricLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: 0.5
    },
    variantMetricValue: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 14,
        color: "#10B981"
    },
    // Segment breakdown
    segmentRow: {
        gap: 6,
        marginBottom: 10
    },
    segmentHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between"
    },
    segmentNameRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6
    },
    segmentDot: {
        width: 8,
        height: 8,
        borderRadius: 4
    },
    segmentName: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13
    },
    segmentRecipients: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },
    segmentBarContainer: {
        marginTop: 2
    },
    segmentBarTrack: {
        height: 8,
        borderRadius: 4,
        overflow: "hidden"
    },
    segmentBarFill: {
        height: "100%",
        borderRadius: 4,
        opacity: 0.8
    },
    segmentMetrics: {
        flexDirection: "row",
        gap: 20
    },
    segmentMetricItem: {
        gap: 2
    },
    segmentMetricLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: 0.5
    },
    segmentMetricValue: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 13,
        color: "#10B981"
    }
}));
