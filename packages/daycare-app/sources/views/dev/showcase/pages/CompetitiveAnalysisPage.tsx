import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { ShowcasePage } from "../components/ShowcasePage";

// --- Types ---

type CompetitorKey = "acme" | "nebula" | "vertex";

type Competitor = {
    key: CompetitorKey;
    name: string;
    logo: keyof typeof Ionicons.glyphMap;
    tagline: string;
    revenue: string;
    headcount: string;
    funding: string;
    revenueGrowth: string;
    founded: string;
};

type TimelineEvent = {
    id: string;
    date: string;
    title: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
    type: "product" | "funding" | "hiring" | "partnership";
};

type FeatureComparison = {
    feature: string;
    us: boolean;
    acme: boolean;
    nebula: boolean;
    vertex: boolean;
};

type SwotItem = {
    text: string;
};

type SwotData = {
    strengths: SwotItem[];
    weaknesses: SwotItem[];
    opportunities: SwotItem[];
    threats: SwotItem[];
};

// --- Mock Data ---

const COMPETITORS: Record<CompetitorKey, Competitor> = {
    acme: {
        key: "acme",
        name: "Acme Corp",
        logo: "rocket-outline",
        tagline: "Enterprise automation platform",
        revenue: "$142M",
        headcount: "1,240",
        funding: "$280M",
        revenueGrowth: "+34%",
        founded: "2018"
    },
    nebula: {
        key: "nebula",
        name: "Nebula AI",
        logo: "planet-outline",
        tagline: "AI-first workflow engine",
        revenue: "$89M",
        headcount: "620",
        funding: "$175M",
        revenueGrowth: "+52%",
        founded: "2020"
    },
    vertex: {
        key: "vertex",
        name: "Vertex Labs",
        logo: "prism-outline",
        tagline: "Developer collaboration suite",
        revenue: "$210M",
        headcount: "1,850",
        funding: "$410M",
        revenueGrowth: "+21%",
        founded: "2016"
    }
};

const COMPETITOR_KEYS: CompetitorKey[] = ["acme", "nebula", "vertex"];

const TIMELINE_EVENTS: Record<CompetitorKey, TimelineEvent[]> = {
    acme: [
        {
            id: "a1",
            date: "Feb 2026",
            title: "Launched Acme Autopilot",
            description: "AI-powered workflow automation targeting mid-market",
            icon: "flash-outline",
            type: "product"
        },
        {
            id: "a2",
            date: "Jan 2026",
            title: "Series D at $2.1B valuation",
            description: "Led by Sequoia, $85M raised for international expansion",
            icon: "cash-outline",
            type: "funding"
        },
        {
            id: "a3",
            date: "Dec 2025",
            title: "Acquired DataSync Inc.",
            description: "Integration play to bolster ETL and data pipeline capabilities",
            icon: "git-merge-outline",
            type: "partnership"
        },
        {
            id: "a4",
            date: "Nov 2025",
            title: "Hired ex-Stripe CTO",
            description: "Signaling move into fintech automation vertical",
            icon: "person-add-outline",
            type: "hiring"
        },
        {
            id: "a5",
            date: "Oct 2025",
            title: "SOC 2 Type II certified",
            description: "Enterprise compliance milestone achieved ahead of schedule",
            icon: "shield-checkmark-outline",
            type: "product"
        }
    ],
    nebula: [
        {
            id: "n1",
            date: "Feb 2026",
            title: "Open-sourced Nebula Core",
            description: "Community edition released to drive developer adoption",
            icon: "code-slash-outline",
            type: "product"
        },
        {
            id: "n2",
            date: "Jan 2026",
            title: "Partnership with AWS",
            description: "Native integration in AWS Marketplace, co-sell agreement",
            icon: "cloud-outline",
            type: "partnership"
        },
        {
            id: "n3",
            date: "Dec 2025",
            title: "Launched multi-agent orchestration",
            description: "First to market with autonomous agent coordination feature",
            icon: "people-outline",
            type: "product"
        },
        {
            id: "n4",
            date: "Nov 2025",
            title: "Series C - $75M raised",
            description: "Valuation at $1.2B, Andreessen Horowitz led the round",
            icon: "cash-outline",
            type: "funding"
        }
    ],
    vertex: [
        {
            id: "v1",
            date: "Mar 2026",
            title: "Vertex 4.0 GA release",
            description: "Major platform overhaul with real-time collaboration engine",
            icon: "flash-outline",
            type: "product"
        },
        {
            id: "v2",
            date: "Feb 2026",
            title: "Expanded to APAC region",
            description: "Opened offices in Singapore and Tokyo, 200 new hires planned",
            icon: "globe-outline",
            type: "hiring"
        },
        {
            id: "v3",
            date: "Jan 2026",
            title: "Acquired CodeReview.io",
            description: "Strengthening code review and CI/CD pipeline offering",
            icon: "git-merge-outline",
            type: "partnership"
        },
        {
            id: "v4",
            date: "Dec 2025",
            title: "IPO rumors - $4B target",
            description: "Multiple sources report S-1 filing expected Q2 2026",
            icon: "trending-up-outline",
            type: "funding"
        },
        {
            id: "v5",
            date: "Nov 2025",
            title: "GitHub Copilot integration",
            description: "Deep integration bringing AI pair programming to Vertex IDE",
            icon: "code-slash-outline",
            type: "product"
        },
        {
            id: "v6",
            date: "Oct 2025",
            title: "Enterprise plan launched",
            description: "SSO, audit logs, and dedicated support for Fortune 500",
            icon: "briefcase-outline",
            type: "product"
        }
    ]
};

const FEATURES: FeatureComparison[] = [
    { feature: "AI Workflow Builder", us: true, acme: true, nebula: true, vertex: false },
    { feature: "Real-time Collaboration", us: true, acme: false, nebula: false, vertex: true },
    { feature: "Self-hosted Option", us: true, acme: false, nebula: true, vertex: false },
    { feature: "API-first Architecture", us: true, acme: true, nebula: true, vertex: true },
    { feature: "Multi-agent Orchestration", us: true, acme: false, nebula: true, vertex: false },
    { feature: "SOC 2 Compliance", us: true, acme: true, nebula: false, vertex: true },
    { feature: "White-label Support", us: false, acme: true, nebula: false, vertex: false },
    { feature: "Mobile SDK", us: true, acme: false, nebula: false, vertex: true },
    { feature: "Custom Plugin System", us: true, acme: true, nebula: true, vertex: false },
    { feature: "Offline Mode", us: true, acme: false, nebula: false, vertex: false }
];

const SWOT_DATA: Record<CompetitorKey, SwotData> = {
    acme: {
        strengths: [
            { text: "Strong enterprise sales team and brand recognition" },
            { text: "Deep integrations with legacy ERP systems" },
            { text: "Proven SOC 2 and HIPAA compliance track record" }
        ],
        weaknesses: [
            { text: "Slow product iteration cycle (quarterly releases)" },
            { text: "No self-hosted deployment option" },
            { text: "High churn in SMB segment" }
        ],
        opportunities: [
            { text: "Fintech vertical expansion with new CTO hire" },
            { text: "International markets largely untapped" },
            { text: "Growing demand for AI automation in healthcare" }
        ],
        threats: [
            { text: "Nebula AI gaining developer mindshare rapidly" },
            { text: "Pricing pressure from open-source alternatives" },
            { text: "Key customer concentration risk (top 5 = 40% revenue)" }
        ]
    },
    nebula: {
        strengths: [
            { text: "Fastest product velocity in the market" },
            { text: "Strong developer community and open-source presence" },
            { text: "First-mover advantage in multi-agent orchestration" }
        ],
        weaknesses: [
            { text: "Limited enterprise sales infrastructure" },
            { text: "No compliance certifications yet" },
            { text: "Revenue still heavily dependent on self-serve" }
        ],
        opportunities: [
            { text: "AWS partnership opens massive distribution channel" },
            { text: "Enterprise customers seeking AI-native solutions" },
            { text: "Potential to become the de facto open-source standard" }
        ],
        threats: [
            { text: "Well-funded competitors (Acme, Vertex) can copy features" },
            { text: "Open-source model creates monetization challenges" },
            { text: "Talent retention difficult at current burn rate" }
        ]
    },
    vertex: {
        strengths: [
            { text: "Largest installed base among developer teams" },
            { text: "Mature platform with 8+ years of development" },
            { text: "Strong revenue and path to profitability / IPO" }
        ],
        weaknesses: [
            { text: "Legacy architecture limits AI feature velocity" },
            { text: "No AI workflow builder or agent capabilities" },
            { text: "Developer perception shifting to 'old guard'" }
        ],
        opportunities: [
            { text: "IPO capital could fund aggressive AI R&D" },
            { text: "APAC expansion into underpenetrated markets" },
            { text: "Acquisitions to fill AI and automation gaps" }
        ],
        threats: [
            { text: "AI-native startups disrupting core collaboration use case" },
            { text: "GitHub Copilot dependency creates platform risk" },
            { text: "APAC expansion execution risk with local competitors" }
        ]
    }
};

const EVENT_TYPE_COLORS: Record<TimelineEvent["type"], string> = {
    product: "#3B82F6",
    funding: "#10B981",
    hiring: "#8B5CF6",
    partnership: "#F59E0B"
};

// --- Competitor Selector Tabs ---

function CompetitorTabs({ selected, onSelect }: { selected: CompetitorKey; onSelect: (key: CompetitorKey) => void }) {
    const { theme } = useUnistyles();

    return (
        <View style={s.tabsContainer}>
            <View style={[s.tabsTrack, { backgroundColor: theme.colors.surfaceContainer }]}>
                {COMPETITOR_KEYS.map((key) => {
                    const competitor = COMPETITORS[key];
                    const isActive = selected === key;
                    return (
                        <Pressable
                            key={key}
                            onPress={() => onSelect(key)}
                            style={[
                                s.tab,
                                {
                                    backgroundColor: isActive ? theme.colors.primary : "transparent"
                                }
                            ]}
                        >
                            <Ionicons
                                name={competitor.logo}
                                size={16}
                                color={isActive ? theme.colors.onPrimary : theme.colors.onSurfaceVariant}
                            />
                            <Text
                                style={[
                                    s.tabText,
                                    {
                                        color: isActive ? theme.colors.onPrimary : theme.colors.onSurfaceVariant
                                    }
                                ]}
                            >
                                {competitor.name}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

// --- Overview Section ---

function OverviewSection({ competitor }: { competitor: Competitor }) {
    const { theme } = useUnistyles();

    const metrics = [
        {
            label: "Revenue",
            value: competitor.revenue,
            sub: competitor.revenueGrowth,
            icon: "trending-up-outline" as keyof typeof Ionicons.glyphMap,
            color: "#10B981"
        },
        {
            label: "Headcount",
            value: competitor.headcount,
            sub: "employees",
            icon: "people-outline" as keyof typeof Ionicons.glyphMap,
            color: "#3B82F6"
        },
        {
            label: "Funding",
            value: competitor.funding,
            sub: `since ${competitor.founded}`,
            icon: "cash-outline" as keyof typeof Ionicons.glyphMap,
            color: "#8B5CF6"
        }
    ];

    return (
        <View style={s.section}>
            <View style={s.sectionHeader}>
                <Ionicons name="analytics-outline" size={18} color={theme.colors.primary} />
                <Text style={[s.sectionTitle, { color: theme.colors.onSurface }]}>Overview</Text>
            </View>

            {/* Competitor banner */}
            <View style={[s.banner, { backgroundColor: theme.colors.surfaceContainer }]}>
                <View style={[s.bannerIconCircle, { backgroundColor: `${theme.colors.primary}18` }]}>
                    <Ionicons name={competitor.logo} size={24} color={theme.colors.primary} />
                </View>
                <View style={s.bannerText}>
                    <Text style={[s.bannerName, { color: theme.colors.onSurface }]}>{competitor.name}</Text>
                    <Text style={[s.bannerTagline, { color: theme.colors.onSurfaceVariant }]}>
                        {competitor.tagline}
                    </Text>
                </View>
            </View>

            {/* Metric cards */}
            <View style={s.metricsRow}>
                {metrics.map((m) => (
                    <View key={m.label} style={[s.metricCard, { backgroundColor: theme.colors.surfaceContainer }]}>
                        <View style={[s.metricIconCircle, { backgroundColor: `${m.color}18` }]}>
                            <Ionicons name={m.icon} size={16} color={m.color} />
                        </View>
                        <Text style={[s.metricValue, { color: theme.colors.onSurface }]}>{m.value}</Text>
                        <Text style={[s.metricSub, { color: m.color }]}>{m.sub}</Text>
                        <Text style={[s.metricLabel, { color: theme.colors.onSurfaceVariant }]}>{m.label}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

// --- Timeline Section ---

function TimelineSection({ events }: { events: TimelineEvent[] }) {
    const { theme } = useUnistyles();

    return (
        <View style={s.section}>
            <View style={s.sectionHeader}>
                <Ionicons name="time-outline" size={18} color={theme.colors.primary} />
                <Text style={[s.sectionTitle, { color: theme.colors.onSurface }]}>Recent Moves</Text>
            </View>

            <View style={[s.timelineContainer, { backgroundColor: theme.colors.surfaceContainer }]}>
                {events.map((event, index) => {
                    const color = EVENT_TYPE_COLORS[event.type];
                    const isLast = index === events.length - 1;

                    return (
                        <View key={event.id} style={s.timelineRow}>
                            {/* Timeline track: dot + connector line */}
                            <View style={s.timelineTrack}>
                                <View style={[s.timelineDotOuter, { backgroundColor: `${color}25` }]}>
                                    <View style={[s.timelineDotInner, { backgroundColor: color }]} />
                                </View>
                                {!isLast && (
                                    <View
                                        style={[s.timelineConnector, { backgroundColor: theme.colors.outlineVariant }]}
                                    />
                                )}
                            </View>

                            {/* Event content */}
                            <View style={s.timelineContent}>
                                <Text style={[s.timelineDate, { color: theme.colors.onSurfaceVariant }]}>
                                    {event.date}
                                </Text>
                                <View style={s.timelineTitleRow}>
                                    <Ionicons name={event.icon} size={14} color={color} />
                                    <Text style={[s.timelineTitle, { color: theme.colors.onSurface }]}>
                                        {event.title}
                                    </Text>
                                </View>
                                <Text style={[s.timelineDescription, { color: theme.colors.onSurfaceVariant }]}>
                                    {event.description}
                                </Text>
                                <View style={[s.timelineTypeBadge, { backgroundColor: `${color}18` }]}>
                                    <Text style={[s.timelineTypeText, { color }]}>
                                        {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

// --- Product Comparison Table ---

function ComparisonSection({ selected }: { selected: CompetitorKey }) {
    const { theme } = useUnistyles();
    const columnHeaders = ["Us", COMPETITORS[selected].name];

    return (
        <View style={s.section}>
            <View style={s.sectionHeader}>
                <Ionicons name="git-compare-outline" size={18} color={theme.colors.primary} />
                <Text style={[s.sectionTitle, { color: theme.colors.onSurface }]}>Product Comparison</Text>
            </View>

            <View style={[s.comparisonCard, { backgroundColor: theme.colors.surfaceContainer }]}>
                {/* Table header */}
                <View style={[s.comparisonHeaderRow, { borderBottomColor: theme.colors.outlineVariant }]}>
                    <View style={s.comparisonFeatureCol}>
                        <Text style={[s.comparisonHeaderText, { color: theme.colors.onSurfaceVariant }]}>Feature</Text>
                    </View>
                    {columnHeaders.map((header) => (
                        <View key={header} style={s.comparisonCheckCol}>
                            <Text
                                style={[s.comparisonHeaderText, { color: theme.colors.onSurfaceVariant }]}
                                numberOfLines={1}
                            >
                                {header}
                            </Text>
                        </View>
                    ))}
                </View>

                {/* Table rows */}
                {FEATURES.map((row, index) => {
                    const usHas = row.us;
                    const competitorHas = row[selected];
                    const isEven = index % 2 === 0;

                    return (
                        <View
                            key={row.feature}
                            style={[
                                s.comparisonRow,
                                {
                                    backgroundColor: isEven ? "transparent" : `${theme.colors.surface}60`
                                }
                            ]}
                        >
                            <View style={s.comparisonFeatureCol}>
                                <Text
                                    style={[s.comparisonFeatureText, { color: theme.colors.onSurface }]}
                                    numberOfLines={1}
                                >
                                    {row.feature}
                                </Text>
                            </View>
                            <View style={s.comparisonCheckCol}>
                                <Ionicons
                                    name={usHas ? "checkmark-circle" : "close-circle"}
                                    size={20}
                                    color={usHas ? "#10B981" : theme.colors.outlineVariant}
                                />
                            </View>
                            <View style={s.comparisonCheckCol}>
                                <Ionicons
                                    name={competitorHas ? "checkmark-circle" : "close-circle"}
                                    size={20}
                                    color={competitorHas ? "#10B981" : theme.colors.outlineVariant}
                                />
                            </View>
                        </View>
                    );
                })}

                {/* Score summary */}
                <View style={[s.comparisonSummaryRow, { borderTopColor: theme.colors.outlineVariant }]}>
                    <View style={s.comparisonFeatureCol}>
                        <Text style={[s.comparisonSummaryLabel, { color: theme.colors.onSurfaceVariant }]}>Score</Text>
                    </View>
                    <View style={s.comparisonCheckCol}>
                        <Text style={[s.comparisonScore, { color: "#10B981" }]}>
                            {FEATURES.filter((f) => f.us).length}/{FEATURES.length}
                        </Text>
                    </View>
                    <View style={s.comparisonCheckCol}>
                        <Text style={[s.comparisonScore, { color: theme.colors.onSurfaceVariant }]}>
                            {FEATURES.filter((f) => f[selected]).length}/{FEATURES.length}
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );
}

// --- SWOT Section ---

const SWOT_CONFIG = [
    {
        key: "strengths" as const,
        title: "Strengths",
        icon: "shield-checkmark-outline" as keyof typeof Ionicons.glyphMap,
        color: "#10B981",
        bgAlpha: "12"
    },
    {
        key: "weaknesses" as const,
        title: "Weaknesses",
        icon: "alert-circle-outline" as keyof typeof Ionicons.glyphMap,
        color: "#F59E0B",
        bgAlpha: "12"
    },
    {
        key: "opportunities" as const,
        title: "Opportunities",
        icon: "bulb-outline" as keyof typeof Ionicons.glyphMap,
        color: "#3B82F6",
        bgAlpha: "12"
    },
    {
        key: "threats" as const,
        title: "Threats",
        icon: "warning-outline" as keyof typeof Ionicons.glyphMap,
        color: "#EF4444",
        bgAlpha: "12"
    }
];

function SwotSection({ data }: { data: SwotData }) {
    const { theme } = useUnistyles();

    return (
        <View style={s.section}>
            <View style={s.sectionHeader}>
                <Ionicons name="grid-outline" size={18} color={theme.colors.primary} />
                <Text style={[s.sectionTitle, { color: theme.colors.onSurface }]}>SWOT Analysis</Text>
            </View>

            <View style={s.swotGrid}>
                {SWOT_CONFIG.map((config) => {
                    const items = data[config.key];
                    return (
                        <View
                            key={config.key}
                            style={[
                                s.swotQuadrant,
                                {
                                    backgroundColor: config.color + config.bgAlpha,
                                    borderColor: `${config.color}30`
                                }
                            ]}
                        >
                            {/* Quadrant header */}
                            <View style={s.swotQuadrantHeader}>
                                <View style={[s.swotIconCircle, { backgroundColor: `${config.color}25` }]}>
                                    <Ionicons name={config.icon} size={14} color={config.color} />
                                </View>
                                <Text style={[s.swotQuadrantTitle, { color: config.color }]}>{config.title}</Text>
                            </View>

                            {/* Bullet items */}
                            {items.map((item) => (
                                <View key={item.text} style={s.swotBulletRow}>
                                    <View style={[s.swotBulletDot, { backgroundColor: config.color }]} />
                                    <Text style={[s.swotBulletText, { color: theme.colors.onSurface }]}>
                                        {item.text}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

// --- Main Component ---

export function CompetitiveAnalysisPage() {
    const { theme } = useUnistyles();
    const [selected, setSelected] = React.useState<CompetitorKey>("acme");

    const competitor = COMPETITORS[selected];
    const events = TIMELINE_EVENTS[selected];
    const swot = SWOT_DATA[selected];

    return (
        <ShowcasePage style={{ flex: 1, backgroundColor: theme.colors.surface }} contentContainerStyle={s.root}>
            {/* Page title */}
            <View style={s.pageHeader}>
                <View style={[s.pageIconCircle, { backgroundColor: `${theme.colors.primary}18` }]}>
                    <Ionicons name="telescope-outline" size={22} color={theme.colors.primary} />
                </View>
                <View>
                    <Text style={[s.pageTitle, { color: theme.colors.onSurface }]}>Competitive Intelligence</Text>
                    <Text style={[s.pageSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                        Track and analyze competitor activity
                    </Text>
                </View>
            </View>

            {/* Competitor selector */}
            <CompetitorTabs selected={selected} onSelect={setSelected} />

            {/* Overview */}
            <OverviewSection competitor={competitor} />

            {/* Recent Moves */}
            <TimelineSection events={events} />

            {/* Product Comparison */}
            <ComparisonSection selected={selected} />

            {/* SWOT */}
            <SwotSection data={swot} />
        </ShowcasePage>
    );
}

// --- Styles ---

const s = StyleSheet.create((theme) => ({
    root: {
        padding: 16,
        gap: 20
    },

    // Page header
    pageHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12
    },
    pageIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center"
    },
    pageTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 22,
        lineHeight: 28
    },
    pageSubtitle: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 18,
        marginTop: 1
    },

    // Tabs
    tabsContainer: {
        marginTop: -4
    },
    tabsTrack: {
        flexDirection: "row",
        borderRadius: 14,
        padding: 4,
        gap: 4
    },
    tab: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 10,
        borderRadius: 11
    },
    tabText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13,
        lineHeight: 18
    },

    // Sections
    section: {
        gap: 12
    },
    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    sectionTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 17,
        lineHeight: 22
    },

    // Overview banner
    banner: {
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        padding: 16,
        borderRadius: 14
    },
    bannerIconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center"
    },
    bannerText: {
        flex: 1,
        gap: 2
    },
    bannerName: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 18,
        lineHeight: 24
    },
    bannerTagline: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 18
    },

    // Metric cards
    metricsRow: {
        flexDirection: "row",
        gap: 8
    },
    metricCard: {
        flex: 1,
        alignItems: "center",
        padding: 14,
        borderRadius: 14,
        gap: 4
    },
    metricIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 4
    },
    metricValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 20,
        lineHeight: 26
    },
    metricSub: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11,
        lineHeight: 14
    },
    metricLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11,
        lineHeight: 14
    },

    // Timeline
    timelineContainer: {
        borderRadius: 14,
        padding: 16
    },
    timelineRow: {
        flexDirection: "row",
        gap: 14
    },
    timelineTrack: {
        alignItems: "center",
        width: 24
    },
    timelineDotOuter: {
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 2
    },
    timelineDotInner: {
        width: 10,
        height: 10,
        borderRadius: 5
    },
    timelineConnector: {
        width: 2,
        flex: 1,
        marginTop: 4,
        marginBottom: 4,
        borderRadius: 1
    },
    timelineContent: {
        flex: 1,
        paddingBottom: 20,
        gap: 4
    },
    timelineDate: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11,
        lineHeight: 14
    },
    timelineTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginTop: 2
    },
    timelineTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 14,
        lineHeight: 20,
        flex: 1
    },
    timelineDescription: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 18,
        marginTop: 2
    },
    timelineTypeBadge: {
        alignSelf: "flex-start",
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        marginTop: 4
    },
    timelineTypeText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 10,
        lineHeight: 14
    },

    // Comparison table
    comparisonCard: {
        borderRadius: 14,
        overflow: "hidden"
    },
    comparisonHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1
    },
    comparisonHeaderText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 12,
        lineHeight: 16
    },
    comparisonRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 10
    },
    comparisonFeatureCol: {
        flex: 1
    },
    comparisonFeatureText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 18
    },
    comparisonCheckCol: {
        width: 64,
        alignItems: "center"
    },
    comparisonSummaryRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1
    },
    comparisonSummaryLabel: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13,
        lineHeight: 18
    },
    comparisonScore: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 14,
        lineHeight: 20
    },

    // SWOT grid
    swotGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10
    },
    swotQuadrant: {
        width: "48%" as unknown as number,
        flexGrow: 1,
        borderRadius: 14,
        borderWidth: 1,
        padding: 14,
        gap: 10
    },
    swotQuadrantHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    swotIconCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center"
    },
    swotQuadrantTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 14,
        lineHeight: 20
    },
    swotBulletRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8
    },
    swotBulletDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginTop: 6
    },
    swotBulletText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        lineHeight: 18,
        flex: 1
    }
}));
