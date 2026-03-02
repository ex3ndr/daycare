import { Octicons } from "@expo/vector-icons";
import type * as React from "react";
import { ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

type Theme = ReturnType<typeof useUnistyles>["theme"];

// -- Fonts --
const FONT = {
    display: "BricolageGrotesque-Bold",
    heading: "IBMPlexSans-SemiBold",
    body: "IBMPlexSans-Regular",
    mono: "IBMPlexMono-Regular"
};

// -- Mock data --

const PLAYER = {
    level: 42,
    title: "Growth Overlord",
    xp: 18_720,
    xpNext: 20_000,
    streak: 47
};

const OVERNIGHT = [
    { agent: "Scout", action: "sent 14 outreach emails, booked 3 demos", xp: 320 },
    { agent: "Builder", action: "shipped A/B test variant, +18% conversion lift", xp: 450 },
    { agent: "Operator", action: "auto-scaled campaign budgets across 4 channels", xp: 280 }
];

const NEXT_MOVE = {
    title: "Double down on Google Ads",
    reason: "CTR hit 6.2% — 2x industry avg. Shifting $3K from underperforming TikTok could yield 240 extra signups this month.",
    impact: "+$8,400 projected revenue"
};

const REVENUE_DAILY = [
    { day: "Mon", amount: 2_840 },
    { day: "Tue", amount: 3_120 },
    { day: "Wed", amount: 4_680 },
    { day: "Thu", amount: 5_210 },
    { day: "Fri", amount: 6_930 },
    { day: "Sat", amount: 4_100 },
    { day: "Sun", amount: 3_890 }
];

const FUNNEL = { impressions: "1.8M", clicks: "52,400", signups: "4,180", paying: "623", convRate: "0.035%" };

const MILESTONES = [
    { id: "m1", title: "Hit $100K Monthly Revenue", reward: "+2,000 XP", progress: 0.87, detail: "$87,200/$100K" },
    { id: "m2", title: "Send 500 Outreach Emails", reward: "+800 XP", progress: 0.78, detail: "391/500 sent" },
    { id: "m3", title: "Reach 50K Twitter Followers", reward: "+1,500 XP", progress: 0.92, detail: "46,100/50,000" },
    { id: "m4", title: "Hit $10K Monthly Revenue", reward: "Completed", progress: 1, detail: "$12,840" },
    { id: "m5", title: "Hit $50K Monthly Revenue", reward: "Completed", progress: 1, detail: "$58,400" }
];

const ACHIEVEMENTS_UNLOCKED = [
    { id: "a1", title: "First Dollar", when: "Day 1", icon: "star" as const },
    { id: "a2", title: "1K Users", when: "Week 4", icon: "people" as const },
    { id: "a3", title: "30-Day Streak", when: "Month 2", icon: "flame" as const },
    { id: "a4", title: "$50K Revenue", when: "Month 3", icon: "trophy" as const },
    { id: "a5", title: "CTR > 5%", when: "Month 2", icon: "graph" as const },
    { id: "a6", title: "500 Emails", when: "Month 4", icon: "mail" as const },
    { id: "a7", title: "10K Followers", when: "Month 5", icon: "heart" as const },
    { id: "a8", title: "Viral Post", when: "Month 5", icon: "rocket" as const }
];

const ACHIEVEMENTS_LOCKED = [
    { id: "a9", title: "100K Followers", icon: "eye" as const },
    { id: "a10", title: "$1M Revenue", icon: "diamond" as const },
    { id: "a11", title: "100-Day Streak", icon: "zap" as const },
    { id: "a12", title: "IPO Ready", icon: "briefcase" as const }
];

const ADS = [
    {
        id: "ad1",
        network: "Meta",
        campaign: "Spring promo",
        spend: "$8,400",
        impressions: "420K",
        ctr: "5.8%",
        benchmark: "1.9%"
    },
    {
        id: "ad2",
        network: "Google",
        campaign: "Brand search",
        spend: "$6,200",
        impressions: "285K",
        ctr: "6.2%",
        benchmark: "3.2%"
    },
    {
        id: "ad3",
        network: "TikTok",
        campaign: "UGC push",
        spend: "$4,800",
        impressions: "1.2M",
        ctr: "3.4%",
        benchmark: "2.5%"
    },
    {
        id: "ad4",
        network: "LinkedIn",
        campaign: "B2B retarget",
        spend: "$2,100",
        impressions: "64K",
        ctr: "4.1%",
        benchmark: "0.8%"
    }
];

const TASKS = [
    { id: "t1", title: "Review campaign creatives", agent: "Scout", due: "Today", xp: 250 },
    { id: "t2", title: "Launch retargeting funnel v3", agent: "Builder", due: "Today", xp: 400 },
    { id: "t3", title: "Negotiate $20K enterprise deal", agent: "Operator", due: "Tomorrow", xp: 600 },
    { id: "t4", title: "Scale winning ad set to $5K/day", agent: "Scout", due: "Mar 4", xp: 350 }
];

const EMAILS = [
    {
        id: "e1",
        to: "partners@acme.co",
        subject: "Partnership proposal follow-up",
        sent: "11:30 AM",
        status: "replied"
    },
    { id: "e2", to: "team@company.io", subject: "Weekly metrics report", sent: "9:00 AM", status: "opened" },
    { id: "e3", to: "lisa@agency.com", subject: "Creative assets handoff", sent: "Yesterday", status: "delivered" }
];

const TWITTER = {
    followersGained: 1_842,
    profileVisits: 48_600,
    bestPost: "Thread: How we went from $0 to $87K MRR in 6 months",
    bestLikes: 4_200,
    bestRT: 1_380,
    posts: [
        { id: "tw1", text: "Just crossed 45K followers. Wild.", likes: 890, retweets: 210, trending: false },
        {
            id: "tw2",
            text: "Thread: How we went from $0 to $87K MRR in 6 months",
            likes: 4_200,
            retweets: 1_380,
            trending: true
        },
        { id: "tw3", text: "Announcing our Series A partnership", likes: 620, retweets: 180, trending: false }
    ]
};

const DOCUMENTS = [
    { id: "d1", title: "Q1 Campaign Brief", updated: "2h ago" },
    { id: "d2", title: "Brand Guidelines v3", updated: "Yesterday" },
    { id: "d3", title: "Competitor Analysis", updated: "3d ago" }
];

const AGENTS = [
    { id: "l1", name: "Scout", role: "Recon", xp: 12_400, rank: 1, today: "Booked 3 demos, sent 14 emails" },
    { id: "l2", name: "Builder", role: "Code", xp: 9_800, rank: 2, today: "Shipped A/B test, +18% conversion" },
    { id: "l3", name: "Operator", role: "Ops", xp: 7_620, rank: 3, today: "Auto-scaled 4 campaigns" }
];

/**
 * Home dashboard — business command center with classical styling.
 */
export function HomeView() {
    const { theme } = useUnistyles();
    const xpPct = Math.round((PLAYER.xp / PLAYER.xpNext) * 100);
    const barMax = Math.max(...REVENUE_DAILY.map((d) => d.amount));

    return (
        <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
        >
            {/* Player status bar */}
            <View
                style={[
                    styles.statusBar,
                    {
                        backgroundColor: theme.colors.surfaceContainer,
                        borderColor: theme.colors.outlineVariant,
                        borderBottomColor: theme.colors.primary
                    }
                ]}
            >
                <View
                    style={[
                        styles.levelBadge,
                        {
                            backgroundColor: theme.colors.primaryContainer,
                            borderColor: theme.colors.primary
                        }
                    ]}
                >
                    <Text style={[styles.levelText, { color: theme.colors.onPrimaryContainer }]}>{PLAYER.level}</Text>
                </View>
                <View style={styles.statusInfo}>
                    <Text style={[styles.statusTitle, { color: theme.colors.onSurface }]}>{PLAYER.title}</Text>
                    <View style={styles.xpRow}>
                        <View style={[styles.xpTrack, { backgroundColor: theme.colors.surfaceContainerHigh }]}>
                            <View
                                style={[styles.xpFill, { width: `${xpPct}%`, backgroundColor: theme.colors.primary }]}
                            />
                        </View>
                        <Text style={[styles.xpLabel, { color: theme.colors.onSurfaceVariant }]}>
                            {PLAYER.xp.toLocaleString()} / {PLAYER.xpNext.toLocaleString()} XP
                        </Text>
                    </View>
                </View>
                <View
                    style={[
                        styles.streakPill,
                        {
                            backgroundColor: theme.colors.surfaceContainerHigh,
                            borderColor: theme.colors.outlineVariant
                        }
                    ]}
                >
                    <Octicons name="flame" size={14} color={theme.colors.primary} />
                    <Text style={[styles.streakValue, { color: theme.colors.onSurface }]}>{PLAYER.streak}</Text>
                </View>
            </View>

            {/* Overnight summary */}
            <View
                style={[
                    styles.overnightCard,
                    {
                        backgroundColor: theme.colors.surfaceContainer,
                        borderColor: theme.colors.outlineVariant
                    }
                ]}
            >
                <View style={styles.overnightHeader}>
                    <Octicons name="sun" size={14} color={theme.colors.primary} />
                    <Text style={[styles.overnightTitle, { color: theme.colors.onSurface }]}>While you were away</Text>
                    <Text style={[styles.overnightXp, { color: theme.colors.primary }]}>
                        +{OVERNIGHT.reduce((sum, o) => sum + o.xp, 0)} XP
                    </Text>
                </View>
                {OVERNIGHT.map((o) => (
                    <Text key={o.agent} style={[styles.overnightLine, { color: theme.colors.onSurfaceVariant }]}>
                        <Text style={[styles.overnightAgent, { color: theme.colors.onSurface }]}>{o.agent}</Text>{" "}
                        {o.action}
                    </Text>
                ))}
            </View>

            {/* Next best move */}
            <View
                style={[
                    styles.nextMoveCard,
                    {
                        backgroundColor: theme.colors.tertiaryContainer,
                        borderColor: theme.colors.tertiary
                    }
                ]}
            >
                <View style={styles.nextMoveHeader}>
                    <Octicons name="light-bulb" size={16} color={theme.colors.onTertiaryContainer} />
                    <Text style={[styles.nextMoveTitle, { color: theme.colors.onTertiaryContainer }]}>
                        {NEXT_MOVE.title}
                    </Text>
                </View>
                <Text style={[styles.nextMoveReason, { color: theme.colors.onTertiaryContainer }]}>
                    {NEXT_MOVE.reason}
                </Text>
                <Text style={[styles.nextMoveImpact, { color: theme.colors.onTertiaryContainer }]}>
                    {NEXT_MOVE.impact}
                </Text>
            </View>

            {/* Top row: revenue + milestones | face */}
            <View style={styles.topRow}>
                <View style={styles.topLeft}>
                    {/* Revenue card */}
                    <View
                        style={[
                            styles.revenueCard,
                            {
                                backgroundColor: theme.colors.primaryContainer,
                                borderColor: theme.colors.primary
                            }
                        ]}
                    >
                        <View style={styles.revenueTop}>
                            <Text style={[styles.revenueLabel, { color: theme.colors.onPrimaryContainer }]}>
                                REVENUE
                            </Text>
                            <Text style={[styles.revenueDelta, { color: theme.colors.onPrimaryContainer }]}>+142%</Text>
                        </View>
                        <Text style={[styles.revenueValue, { color: theme.colors.onPrimaryContainer }]}>$87,240</Text>

                        {/* Sparkline */}
                        <View style={styles.sparkRow}>
                            {REVENUE_DAILY.map((d) => (
                                <View key={d.day} style={styles.sparkCol}>
                                    <View style={styles.sparkBarWrap}>
                                        <View
                                            style={[
                                                styles.sparkBar,
                                                {
                                                    height: `${(d.amount / barMax) * 100}%`,
                                                    backgroundColor: theme.colors.onPrimaryContainer,
                                                    opacity: 0.35
                                                }
                                            ]}
                                        />
                                    </View>
                                    <Text style={[styles.sparkLabel, { color: theme.colors.onPrimaryContainer }]}>
                                        {d.day}
                                    </Text>
                                </View>
                            ))}
                        </View>

                        {/* Divider */}
                        <View style={[styles.cardDivider, { backgroundColor: theme.colors.onPrimaryContainer }]} />

                        <View style={styles.revenueMetrics}>
                            <RevenueMetric label="Ad Spend" value="$21.5K" theme={theme} />
                            <RevenueMetric label="ROAS" value="8.2x" theme={theme} />
                            <RevenueMetric label="Customers" value="4,180" theme={theme} />
                            <RevenueMetric label="Avg LTV" value="$142" theme={theme} />
                        </View>
                    </View>

                    {/* Funnel */}
                    <View
                        style={[
                            styles.funnelCard,
                            {
                                backgroundColor: theme.colors.surfaceContainer,
                                borderColor: theme.colors.outlineVariant
                            }
                        ]}
                    >
                        <FunnelStep label="Impressions" value={FUNNEL.impressions} theme={theme} />
                        <Text style={[styles.funnelArrow, { color: theme.colors.outline }]}>{"\u203A"}</Text>
                        <FunnelStep label="Clicks" value={FUNNEL.clicks} theme={theme} />
                        <Text style={[styles.funnelArrow, { color: theme.colors.outline }]}>{"\u203A"}</Text>
                        <FunnelStep label="Signups" value={FUNNEL.signups} theme={theme} />
                        <Text style={[styles.funnelArrow, { color: theme.colors.outline }]}>{"\u203A"}</Text>
                        <FunnelStep label="Paying" value={FUNNEL.paying} theme={theme} />
                    </View>

                    {/* Milestones */}
                    <SectionHeader title="Milestones" icon="milestone" theme={theme} first />
                    <View style={styles.sectionBody}>
                        {MILESTONES.map((m) => {
                            const pct = Math.round(m.progress * 100);
                            const done = m.progress >= 1;
                            return (
                                <View
                                    key={m.id}
                                    style={[
                                        styles.milestoneCard,
                                        {
                                            backgroundColor: theme.colors.surfaceContainer,
                                            borderColor: done ? theme.colors.tertiary : theme.colors.outlineVariant
                                        }
                                    ]}
                                >
                                    <View style={styles.milestoneTop}>
                                        <Octicons
                                            name={done ? "check-circle-fill" : "dot-fill"}
                                            size={14}
                                            color={done ? theme.colors.tertiary : theme.colors.primary}
                                        />
                                        <Text
                                            style={[styles.milestoneTitle, { color: theme.colors.onSurface }]}
                                            numberOfLines={1}
                                        >
                                            {m.title}
                                        </Text>
                                        <Text
                                            style={[styles.milestoneDetail, { color: theme.colors.onSurfaceVariant }]}
                                        >
                                            {m.detail}
                                        </Text>
                                        <Text
                                            style={[
                                                styles.milestoneReward,
                                                { color: done ? theme.colors.tertiary : theme.colors.primary }
                                            ]}
                                        >
                                            {m.reward}
                                        </Text>
                                    </View>
                                    <View
                                        style={[
                                            styles.progressTrack,
                                            { backgroundColor: theme.colors.surfaceContainerHigh }
                                        ]}
                                    >
                                        <View
                                            style={[
                                                styles.progressFill,
                                                {
                                                    width: `${pct}%`,
                                                    backgroundColor: done ? theme.colors.tertiary : theme.colors.primary
                                                }
                                            ]}
                                        />
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                </View>

                {/* Silly face */}
                <View
                    style={[
                        styles.faceCard,
                        {
                            backgroundColor: theme.colors.surfaceContainer,
                            borderColor: theme.colors.outlineVariant
                        }
                    ]}
                >
                    <Text style={[styles.faceText, { transform: [{ scaleX: -1 }] }]}>
                        {"( \u0361\u00B0 \u035C\u0296 \u0361\u00B0)"}
                    </Text>
                    <View style={[styles.faceDivider, { backgroundColor: theme.colors.outlineVariant }]} />
                    <Text style={[styles.faceHint, { color: theme.colors.onSurfaceVariant }]}>
                        Next unlock at Lv.{PLAYER.level + 1}
                    </Text>
                    <Text style={[styles.facePerk, { color: theme.colors.primary }]}>Viral Machine</Text>
                    <Text style={[styles.faceHint, { color: theme.colors.onSurfaceVariant }]}>
                        Auto-boost top tweets
                    </Text>
                </View>
            </View>

            {/* Grid */}
            <View style={styles.grid}>
                {/* Left column */}
                <View style={styles.col}>
                    {/* Ads */}
                    <SectionHeader title="Ad Campaigns" icon="broadcast" theme={theme} first />
                    <View style={styles.sectionBody}>
                        <View style={styles.adHeaderRow}>
                            <View style={styles.rowMain} />
                            <View style={styles.adStats}>
                                <Text style={[styles.adColHeader, { color: theme.colors.outline }]}>Impr</Text>
                                <Text style={[styles.adColHeader, { color: theme.colors.outline }]}>CTR</Text>
                                <Text style={[styles.adColHeader, { color: theme.colors.outline }]}>Spend</Text>
                            </View>
                        </View>
                        {ADS.map((ad) => {
                            const ctrNum = Number.parseFloat(ad.ctr);
                            const benchNum = Number.parseFloat(ad.benchmark);
                            const beating = ctrNum >= benchNum;
                            return (
                                <View
                                    key={ad.id}
                                    style={[
                                        styles.row,
                                        {
                                            backgroundColor: theme.colors.surfaceContainer,
                                            borderColor: theme.colors.outlineVariant
                                        }
                                    ]}
                                >
                                    <View style={styles.rowMain}>
                                        <Text style={[styles.rowTitle, { color: theme.colors.onSurface }]}>
                                            {ad.campaign}
                                        </Text>
                                        <Text style={[styles.rowSub, { color: theme.colors.onSurfaceVariant }]}>
                                            {ad.network} / avg {ad.benchmark}
                                        </Text>
                                    </View>
                                    <View style={styles.adStats}>
                                        <Text style={[styles.adStat, { color: theme.colors.onSurfaceVariant }]}>
                                            {ad.impressions}
                                        </Text>
                                        <Text
                                            style={[
                                                styles.adStat,
                                                { color: beating ? theme.colors.tertiary : theme.colors.error }
                                            ]}
                                        >
                                            {ad.ctr}
                                        </Text>
                                        <Text style={[styles.adStat, { color: theme.colors.onSurface }]}>
                                            {ad.spend}
                                        </Text>
                                    </View>
                                </View>
                            );
                        })}
                    </View>

                    {/* Twitter */}
                    <SectionHeader title="Twitter" icon="megaphone" theme={theme} />
                    <View style={styles.sectionBody}>
                        <View
                            style={[
                                styles.twitterStats,
                                {
                                    backgroundColor: theme.colors.surfaceContainer,
                                    borderColor: theme.colors.outlineVariant
                                }
                            ]}
                        >
                            <View style={styles.twitterStat}>
                                <Text style={[styles.twitterStatValue, { color: theme.colors.onSurface }]}>
                                    +{TWITTER.followersGained}
                                </Text>
                                <Text style={[styles.twitterStatLabel, { color: theme.colors.onSurfaceVariant }]}>
                                    followers
                                </Text>
                            </View>
                            <View style={[styles.twitterDivider, { backgroundColor: theme.colors.outlineVariant }]} />
                            <View style={styles.twitterStat}>
                                <Text style={[styles.twitterStatValue, { color: theme.colors.onSurface }]}>
                                    {TWITTER.profileVisits.toLocaleString()}
                                </Text>
                                <Text style={[styles.twitterStatLabel, { color: theme.colors.onSurfaceVariant }]}>
                                    profile visits
                                </Text>
                            </View>
                            <View style={[styles.twitterDivider, { backgroundColor: theme.colors.outlineVariant }]} />
                            <View style={[styles.twitterStat, { flex: 2 }]}>
                                <Text
                                    style={[styles.twitterStatValue, { color: theme.colors.onSurface }]}
                                    numberOfLines={1}
                                >
                                    {TWITTER.bestLikes} likes / {TWITTER.bestRT} RT
                                </Text>
                                <Text
                                    style={[styles.twitterStatLabel, { color: theme.colors.onSurfaceVariant }]}
                                    numberOfLines={1}
                                >
                                    best: {TWITTER.bestPost}
                                </Text>
                            </View>
                        </View>
                        {TWITTER.posts.map((tw) => (
                            <View
                                key={tw.id}
                                style={[
                                    styles.row,
                                    {
                                        backgroundColor: theme.colors.surfaceContainer,
                                        borderColor: theme.colors.outlineVariant
                                    }
                                ]}
                            >
                                <Octicons
                                    name={tw.trending ? "arrow-up" : "dot-fill"}
                                    size={14}
                                    color={tw.trending ? theme.colors.tertiary : theme.colors.onSurfaceVariant}
                                />
                                <View style={styles.rowMain}>
                                    <Text
                                        style={[styles.rowTitle, { color: theme.colors.onSurface }]}
                                        numberOfLines={1}
                                    >
                                        {tw.text}
                                    </Text>
                                    <Text style={[styles.rowSub, { color: theme.colors.onSurfaceVariant }]}>
                                        {tw.likes} likes / {tw.retweets} RT
                                        {tw.trending ? " — trending" : ""}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>

                    {/* Documents */}
                    <SectionHeader title="Recent Documents" icon="file" theme={theme} />
                    <View style={styles.sectionBody}>
                        {DOCUMENTS.map((doc) => (
                            <View
                                key={doc.id}
                                style={[
                                    styles.row,
                                    {
                                        backgroundColor: theme.colors.surfaceContainer,
                                        borderColor: theme.colors.outlineVariant
                                    }
                                ]}
                            >
                                <Octicons name="file" size={14} color={theme.colors.onSurfaceVariant} />
                                <View style={styles.rowMain}>
                                    <Text style={[styles.rowTitle, { color: theme.colors.onSurface }]}>
                                        {doc.title}
                                    </Text>
                                </View>
                                <Text style={[styles.rowMeta, { color: theme.colors.onSurfaceVariant }]}>
                                    {doc.updated}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Right column */}
                <View style={styles.col}>
                    {/* Agent Rankings */}
                    <SectionHeader title="Agent Rankings" icon="people" theme={theme} first />
                    <View style={styles.sectionBody}>
                        {AGENTS.map((agent) => (
                            <View
                                key={agent.id}
                                style={[
                                    styles.agentRow,
                                    {
                                        backgroundColor: theme.colors.surfaceContainer,
                                        borderColor: theme.colors.outlineVariant
                                    }
                                ]}
                            >
                                <View
                                    style={[
                                        styles.rankBadge,
                                        {
                                            backgroundColor: theme.colors.surfaceContainerHigh,
                                            borderColor: theme.colors.primary
                                        }
                                    ]}
                                >
                                    <Text style={[styles.rankText, { color: theme.colors.primary }]}>
                                        #{agent.rank}
                                    </Text>
                                </View>
                                <View style={styles.rowMain}>
                                    <Text style={[styles.rowTitle, { color: theme.colors.onSurface }]}>
                                        {agent.name}
                                    </Text>
                                    <Text style={[styles.rowSub, { color: theme.colors.onSurfaceVariant }]}>
                                        {agent.today}
                                    </Text>
                                </View>
                                <Text style={[styles.agentXp, { color: theme.colors.primary }]}>
                                    {agent.xp.toLocaleString()} XP
                                </Text>
                            </View>
                        ))}
                    </View>

                    {/* Tasks */}
                    <SectionHeader title="Active Tasks" icon="tasklist" theme={theme} />
                    <View style={styles.sectionBody}>
                        {TASKS.map((task) => (
                            <View
                                key={task.id}
                                style={[
                                    styles.row,
                                    {
                                        backgroundColor: theme.colors.surfaceContainer,
                                        borderColor: theme.colors.outlineVariant
                                    }
                                ]}
                            >
                                <Octicons name="dot-fill" size={12} color={theme.colors.primary} />
                                <View style={styles.rowMain}>
                                    <Text style={[styles.rowTitle, { color: theme.colors.onSurface }]}>
                                        {task.title}
                                    </Text>
                                    <Text style={[styles.rowSub, { color: theme.colors.onSurfaceVariant }]}>
                                        {task.agent} / {task.due}
                                    </Text>
                                </View>
                                <Text style={[styles.taskXp, { color: theme.colors.primary }]}>+{task.xp}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Emails */}
                    <SectionHeader title="Sent Emails" icon="mail" theme={theme} />
                    <View style={styles.sectionBody}>
                        {EMAILS.map((email) => (
                            <View
                                key={email.id}
                                style={[
                                    styles.row,
                                    {
                                        backgroundColor: theme.colors.surfaceContainer,
                                        borderColor: theme.colors.outlineVariant
                                    }
                                ]}
                            >
                                <Octicons
                                    name={
                                        email.status === "replied"
                                            ? "reply"
                                            : email.status === "opened"
                                              ? "eye"
                                              : "check"
                                    }
                                    size={14}
                                    color={
                                        email.status === "replied"
                                            ? theme.colors.tertiary
                                            : theme.colors.onSurfaceVariant
                                    }
                                />
                                <View style={styles.rowMain}>
                                    <Text style={[styles.rowTitle, { color: theme.colors.onSurface }]}>
                                        {email.subject}
                                    </Text>
                                    <Text style={[styles.rowSub, { color: theme.colors.onSurfaceVariant }]}>
                                        {email.to}
                                    </Text>
                                </View>
                                <Text style={[styles.rowMeta, { color: theme.colors.onSurfaceVariant }]}>
                                    {email.sent}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>
            </View>

            {/* Achievements */}
            <SectionHeader title="Achievements" icon="verified" theme={theme} first />
            <View style={styles.achievementsRow}>
                {ACHIEVEMENTS_UNLOCKED.map((a) => (
                    <View
                        key={a.id}
                        style={[
                            styles.achievementCard,
                            {
                                backgroundColor: theme.colors.surfaceContainer,
                                borderColor: theme.colors.primary
                            }
                        ]}
                    >
                        <Octicons name={a.icon} size={20} color={theme.colors.primary} />
                        <Text style={[styles.achievementTitle, { color: theme.colors.onSurface }]}>{a.title}</Text>
                        <Text style={[styles.achievementWhen, { color: theme.colors.onSurfaceVariant }]}>{a.when}</Text>
                    </View>
                ))}
                {ACHIEVEMENTS_LOCKED.map((a) => (
                    <View
                        key={a.id}
                        style={[
                            styles.achievementCard,
                            {
                                backgroundColor: theme.colors.surfaceContainer,
                                borderColor: theme.colors.outlineVariant,
                                opacity: 0.4
                            }
                        ]}
                    >
                        <Octicons name={a.icon} size={20} color={theme.colors.outline} />
                        <Text style={[styles.achievementTitle, { color: theme.colors.outline }]}>{a.title}</Text>
                        <Octicons name="lock" size={10} color={theme.colors.outline} />
                    </View>
                ))}
            </View>

            {/* Footer */}
            <View style={[styles.footer, { borderTopColor: theme.colors.outlineVariant }]}>
                <Text style={[styles.footerText, { color: theme.colors.onSurfaceVariant }]}>Last synced 2 min ago</Text>
            </View>
        </ScrollView>
    );
}

// -- Sub-components --

function SectionHeader({
    title,
    icon,
    theme,
    first
}: {
    title: string;
    icon: React.ComponentProps<typeof Octicons>["name"];
    theme: Theme;
    first?: boolean;
}) {
    return (
        <View style={[styles.sectionHeader, first && { marginTop: 0 }]}>
            <View style={[styles.sectionRule, { backgroundColor: theme.colors.outlineVariant }]} />
            <Octicons name={icon} size={13} color={theme.colors.primary} />
            <Text style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>{title}</Text>
            <View style={[styles.sectionRule, { backgroundColor: theme.colors.outlineVariant }]} />
        </View>
    );
}

function RevenueMetric({ label, value, theme }: { label: string; value: string; theme: Theme }) {
    return (
        <View style={styles.revenueMetric}>
            <Text style={[styles.revenueMetricValue, { color: theme.colors.onPrimaryContainer }]}>{value}</Text>
            <Text style={[styles.revenueMetricLabel, { color: theme.colors.onPrimaryContainer }]}>{label}</Text>
        </View>
    );
}

function FunnelStep({ label, value, theme }: { label: string; value: string; theme: Theme }) {
    return (
        <View style={styles.funnelStep}>
            <Text style={[styles.funnelValue, { color: theme.colors.onSurface }]}>{value}</Text>
            <Text style={[styles.funnelLabel, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    scroll: { flex: 1 },
    scrollContent: { padding: 28, paddingBottom: 56 },

    // Status bar — gold bottom border accent
    statusBar: {
        flexDirection: "row",
        borderRadius: 6,
        borderWidth: StyleSheet.hairlineWidth,
        borderBottomWidth: 2,
        padding: 18,
        marginBottom: 16,
        alignItems: "center",
        gap: 16
    },
    levelBadge: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 2,
        alignItems: "center",
        justifyContent: "center"
    },
    levelText: { fontSize: 20, fontFamily: FONT.display },
    statusInfo: { flex: 1, gap: 8 },
    statusTitle: { fontSize: 17, fontFamily: FONT.heading, letterSpacing: 0.3 },
    xpRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    xpTrack: { flex: 1, height: 5, borderRadius: 3, overflow: "hidden" },
    xpFill: { height: "100%", borderRadius: 3 },
    xpLabel: { fontSize: 11, fontFamily: FONT.mono, minWidth: 100 },
    streakPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 4,
        borderWidth: StyleSheet.hairlineWidth
    },
    streakValue: { fontSize: 16, fontFamily: FONT.heading },

    // Overnight — thin border card
    overnightCard: {
        borderRadius: 6,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 18,
        marginBottom: 14,
        gap: 8
    },
    overnightHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
    overnightTitle: { fontSize: 14, fontFamily: FONT.heading, letterSpacing: 0.3, flex: 1 },
    overnightXp: { fontSize: 13, fontFamily: FONT.heading },
    overnightAgent: { fontFamily: FONT.heading },
    overnightLine: { fontSize: 13, fontFamily: FONT.body, lineHeight: 20, paddingLeft: 24 },

    // Next move — accent border
    nextMoveCard: {
        borderRadius: 6,
        borderWidth: StyleSheet.hairlineWidth,
        borderLeftWidth: 3,
        padding: 18,
        marginBottom: 24,
        gap: 8
    },
    nextMoveHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
    nextMoveTitle: { fontSize: 15, fontFamily: FONT.heading, letterSpacing: 0.2 },
    nextMoveReason: { fontSize: 13, fontFamily: FONT.body, lineHeight: 20 },
    nextMoveImpact: { fontSize: 13, fontFamily: FONT.heading },

    // Top row
    topRow: { flexDirection: "row", gap: 24, marginBottom: 28 },
    topLeft: { flex: 1 },
    faceCard: {
        width: 200,
        borderRadius: 6,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: 20
    },
    faceText: { fontSize: 36 },
    faceDivider: { width: 40, height: StyleSheet.hairlineWidth, marginVertical: 4 },
    faceHint: { fontSize: 11, fontFamily: FONT.body, textAlign: "center" },
    facePerk: { fontSize: 14, fontFamily: FONT.heading },

    // Revenue — gold border, generous spacing
    revenueCard: {
        borderRadius: 6,
        borderWidth: 1,
        padding: 28,
        marginBottom: 14
    },
    revenueTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 4
    },
    revenueLabel: { fontSize: 11, fontFamily: FONT.heading, letterSpacing: 2.5 },
    revenueDelta: { fontSize: 14, fontFamily: FONT.heading },
    revenueValue: { fontSize: 48, fontFamily: FONT.display, marginBottom: 8 },
    sparkRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
    sparkCol: { flex: 1, alignItems: "center", gap: 4 },
    sparkBarWrap: { width: "100%", height: 36, justifyContent: "flex-end" },
    sparkBar: { width: "100%", borderRadius: 2 },
    sparkLabel: { fontSize: 10, fontFamily: FONT.mono, opacity: 0.5 },
    cardDivider: { height: StyleSheet.hairlineWidth, opacity: 0.2, marginBottom: 14 },
    revenueMetrics: { flexDirection: "row", gap: 32 },
    revenueMetric: { gap: 3 },
    revenueMetricValue: { fontSize: 17, fontFamily: FONT.heading },
    revenueMetricLabel: {
        fontSize: 10,
        fontFamily: FONT.body,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        opacity: 0.6
    },

    // Funnel — bordered, wide spacing
    funnelCard: {
        flexDirection: "row",
        borderRadius: 6,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 16,
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 4
    },
    funnelStep: { alignItems: "center", gap: 3 },
    funnelValue: { fontSize: 17, fontFamily: FONT.heading },
    funnelLabel: { fontSize: 10, fontFamily: FONT.body, letterSpacing: 0.3, textTransform: "uppercase" },
    funnelArrow: { fontSize: 20, fontFamily: FONT.body },

    // Grid
    grid: { flexDirection: "row", gap: 28, marginBottom: 28 },
    col: { flex: 1 },

    // Sections — centered rule with icon
    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginBottom: 12,
        marginTop: 24
    },
    sectionRule: { flex: 1, height: StyleSheet.hairlineWidth },
    sectionTitle: {
        fontSize: 11,
        fontFamily: FONT.heading,
        textTransform: "uppercase",
        letterSpacing: 2
    },
    sectionBody: { gap: 6 },

    // Milestones — bordered cards
    milestoneCard: {
        borderRadius: 6,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 14,
        gap: 10
    },
    milestoneTop: { flexDirection: "row", alignItems: "center", gap: 10 },
    milestoneTitle: { fontSize: 14, fontFamily: FONT.body, flex: 1 },
    milestoneDetail: { fontSize: 11, fontFamily: FONT.mono },
    milestoneReward: { fontSize: 12, fontFamily: FONT.heading },
    progressTrack: { height: 3, borderRadius: 2, overflow: "hidden" },
    progressFill: { height: "100%", borderRadius: 2 },

    // Rows — thin borders instead of just bg
    row: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 6,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 14,
        gap: 12
    },
    rowMain: { flex: 1, gap: 3 },
    rowTitle: { fontSize: 14, fontFamily: FONT.body },
    rowSub: { fontSize: 12, fontFamily: FONT.body },
    rowMeta: { fontSize: 12, fontFamily: FONT.mono },

    // Ads
    adHeaderRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 12 },
    adStats: { flexDirection: "row", gap: 14, alignItems: "center" },
    adStat: { fontSize: 12, fontFamily: FONT.mono, minWidth: 48, textAlign: "right" },
    adColHeader: {
        fontSize: 9,
        fontFamily: FONT.heading,
        minWidth: 48,
        textAlign: "right",
        textTransform: "uppercase",
        letterSpacing: 1
    },

    // Twitter — vertical dividers between stats
    twitterStats: {
        flexDirection: "row",
        borderRadius: 6,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 14,
        gap: 16,
        alignItems: "stretch"
    },
    twitterStat: { flex: 1, gap: 3 },
    twitterStatValue: { fontSize: 15, fontFamily: FONT.heading },
    twitterStatLabel: { fontSize: 11, fontFamily: FONT.body },
    twitterDivider: { width: StyleSheet.hairlineWidth },

    // Tasks
    taskXp: { fontSize: 12, fontFamily: FONT.heading },

    // Agents — gold rank badge border
    agentRow: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 6,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 14,
        gap: 12
    },
    rankBadge: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 1.5,
        alignItems: "center",
        justifyContent: "center"
    },
    rankText: { fontSize: 12, fontFamily: FONT.heading },
    agentXp: { fontSize: 13, fontFamily: FONT.heading },

    // Achievements — gold borders for unlocked
    achievementsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 28 },
    achievementCard: {
        borderRadius: 6,
        borderWidth: 1,
        padding: 16,
        alignItems: "center",
        gap: 8,
        minWidth: 100,
        flex: 1
    },
    achievementTitle: { fontSize: 12, fontFamily: FONT.heading, textAlign: "center", letterSpacing: 0.3 },
    achievementWhen: { fontSize: 10, fontFamily: FONT.mono },

    // Footer
    footer: {
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingTop: 20,
        alignItems: "center"
    },
    footerText: { fontSize: 11, fontFamily: FONT.mono, letterSpacing: 0.5 }
});
