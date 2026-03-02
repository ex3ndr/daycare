import { Octicons } from "@expo/vector-icons";
import type * as React from "react";
import { ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

type Theme = ReturnType<typeof useUnistyles>["theme"];

// -- Mock data --

const PLAYER = {
    level: 14,
    title: "Growth Hacker III",
    xp: 2_840,
    xpNext: 4_000,
    streak: 12
};

const MILESTONES = [
    { id: "m1", title: "Launch Spring Campaign", reward: "+500 XP", progress: 0.8 },
    { id: "m2", title: "Send 50 Outreach Emails", reward: "+300 XP", progress: 0.62 },
    { id: "m3", title: "Reach 1K Twitter Impressions", reward: "+200 XP", progress: 0.95 },
    { id: "m4", title: "Hit $10K Monthly Revenue", reward: "Completed", progress: 1 }
];

const ACHIEVEMENTS = [
    { id: "a1", title: "First Dollar", when: "Day 1", icon: "star" as const },
    { id: "a2", title: "10 Users", when: "Week 2", icon: "people" as const },
    { id: "a3", title: "7-Day Streak", when: "Week 3", icon: "flame" as const },
    { id: "a4", title: "$10K Revenue", when: "Month 2", icon: "trophy" as const },
    { id: "a5", title: "CTR > 5%", when: "Month 2", icon: "graph" as const },
    { id: "a6", title: "100 Emails", when: "Month 3", icon: "mail" as const }
];

const ADS = [
    { id: "ad1", network: "Meta", campaign: "Spring promo", spend: "$1,240", impressions: "48.2K", ctr: "3.1%" },
    { id: "ad2", network: "Google", campaign: "Brand search", spend: "$860", impressions: "31.5K", ctr: "4.7%" },
    { id: "ad3", network: "TikTok", campaign: "UGC push", spend: "$520", impressions: "112K", ctr: "1.8%" },
    { id: "ad4", network: "LinkedIn", campaign: "B2B retarget", spend: "$340", impressions: "8.1K", ctr: "2.4%" }
];

const TASKS = [
    { id: "t1", title: "Review campaign creatives", agent: "Scout", due: "Today", xp: 50 },
    { id: "t2", title: "Fix tracking pixel", agent: "Builder", due: "Today", xp: 80 },
    { id: "t3", title: "Send weekly digest", agent: "Operator", due: "Tomorrow", xp: 30 },
    { id: "t4", title: "Update audience segments", agent: "Scout", due: "Mar 4", xp: 60 }
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

const TWEETS = [
    { id: "tw1", text: "Just shipped our new onboarding flow!", likes: 42, retweets: 12, trending: false },
    { id: "tw2", text: "Thread: 5 things we learned scaling to 10K users", likes: 128, retweets: 47, trending: true },
    { id: "tw3", text: "Announcing partnerships with three new agencies", likes: 0, retweets: 0, trending: false }
];

const DOCUMENTS = [
    { id: "d1", title: "Q1 Campaign Brief", updated: "2h ago" },
    { id: "d2", title: "Brand Guidelines v3", updated: "Yesterday" },
    { id: "d3", title: "Competitor Analysis", updated: "3d ago" }
];

const AGENTS = [
    { id: "l1", name: "Scout", role: "Recon", xp: 1_240, rank: 1 },
    { id: "l2", name: "Builder", role: "Code", xp: 980, rank: 2 },
    { id: "l3", name: "Operator", role: "Ops", xp: 620, rank: 3 }
];

/**
 * Home dashboard — business command center with subtle gamification.
 */
export function HomeView() {
    const { theme } = useUnistyles();
    const xpPct = Math.round((PLAYER.xp / PLAYER.xpNext) * 100);

    return (
        <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
        >
            {/* Player status bar */}
            <View style={[styles.statusBar, { backgroundColor: theme.colors.surfaceContainer }]}>
                <View style={[styles.levelBadge, { backgroundColor: theme.colors.primaryContainer }]}>
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
                <View style={[styles.streakPill, { backgroundColor: theme.colors.surfaceContainerHigh }]}>
                    <Octicons name="flame" size={14} color={theme.colors.primary} />
                    <Text style={[styles.streakValue, { color: theme.colors.onSurface }]}>{PLAYER.streak}</Text>
                </View>
            </View>

            {/* Revenue card */}
            <View style={[styles.revenueCard, { backgroundColor: theme.colors.primaryContainer }]}>
                <View style={styles.revenueTop}>
                    <Text style={[styles.revenueLabel, { color: theme.colors.onPrimaryContainer }]}>REVENUE</Text>
                    <Text style={[styles.revenueDelta, { color: theme.colors.onPrimaryContainer }]}>+18%</Text>
                </View>
                <Text style={[styles.revenueValue, { color: theme.colors.onPrimaryContainer }]}>$12,840</Text>
                <View style={styles.revenueMetrics}>
                    <RevenueMetric label="Ad Spend" value="$2.6K" theme={theme} />
                    <RevenueMetric label="ROAS" value="4.9x" theme={theme} />
                    <RevenueMetric label="Customers" value="847" theme={theme} />
                    <RevenueMetric label="Avg LTV" value="$38" theme={theme} />
                </View>
            </View>

            {/* Grid */}
            <View style={styles.grid}>
                {/* Left column */}
                <View style={styles.col}>
                    {/* Milestones */}
                    <SectionHeader title="Milestones" icon="milestone" theme={theme} />
                    <View style={styles.sectionBody}>
                        {MILESTONES.map((m) => {
                            const pct = Math.round(m.progress * 100);
                            const done = m.progress >= 1;
                            return (
                                <View
                                    key={m.id}
                                    style={[styles.milestoneCard, { backgroundColor: theme.colors.surfaceContainer }]}
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

                    {/* Ads */}
                    <SectionHeader title="Ad Campaigns" icon="broadcast" theme={theme} />
                    <View style={styles.sectionBody}>
                        {ADS.map((ad) => (
                            <View key={ad.id} style={[styles.row, { backgroundColor: theme.colors.surfaceContainer }]}>
                                <View style={styles.rowMain}>
                                    <Text style={[styles.rowTitle, { color: theme.colors.onSurface }]}>
                                        {ad.campaign}
                                    </Text>
                                    <Text style={[styles.rowSub, { color: theme.colors.onSurfaceVariant }]}>
                                        {ad.network}
                                    </Text>
                                </View>
                                <View style={styles.adStats}>
                                    <Text style={[styles.adStat, { color: theme.colors.onSurfaceVariant }]}>
                                        {ad.impressions}
                                    </Text>
                                    <Text style={[styles.adStat, { color: theme.colors.primary }]}>{ad.ctr}</Text>
                                    <Text style={[styles.adStat, { color: theme.colors.onSurface }]}>{ad.spend}</Text>
                                </View>
                            </View>
                        ))}
                    </View>

                    {/* Emails */}
                    <SectionHeader title="Sent Emails" icon="mail" theme={theme} />
                    <View style={styles.sectionBody}>
                        {EMAILS.map((email) => (
                            <View
                                key={email.id}
                                style={[styles.row, { backgroundColor: theme.colors.surfaceContainer }]}
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

                {/* Right column */}
                <View style={styles.col}>
                    {/* Agent Rankings */}
                    <SectionHeader title="Agent Rankings" icon="people" theme={theme} />
                    <View style={styles.sectionBody}>
                        {AGENTS.map((agent) => (
                            <View
                                key={agent.id}
                                style={[styles.agentRow, { backgroundColor: theme.colors.surfaceContainer }]}
                            >
                                <View
                                    style={[styles.rankBadge, { backgroundColor: theme.colors.surfaceContainerHigh }]}
                                >
                                    <Text style={[styles.rankText, { color: theme.colors.onSurfaceVariant }]}>
                                        #{agent.rank}
                                    </Text>
                                </View>
                                <View style={styles.rowMain}>
                                    <Text style={[styles.rowTitle, { color: theme.colors.onSurface }]}>
                                        {agent.name}
                                    </Text>
                                    <Text style={[styles.rowSub, { color: theme.colors.onSurfaceVariant }]}>
                                        {agent.role}
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
                                style={[styles.row, { backgroundColor: theme.colors.surfaceContainer }]}
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

                    {/* Twitter */}
                    <SectionHeader title="Twitter" icon="megaphone" theme={theme} />
                    <View style={styles.sectionBody}>
                        {TWEETS.map((tw) => (
                            <View key={tw.id} style={[styles.row, { backgroundColor: theme.colors.surfaceContainer }]}>
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
                            <View key={doc.id} style={[styles.row, { backgroundColor: theme.colors.surfaceContainer }]}>
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
            </View>

            {/* Achievements */}
            <SectionHeader title="Achievements" icon="verified" theme={theme} />
            <View style={styles.achievementsRow}>
                {ACHIEVEMENTS.map((a) => (
                    <View
                        key={a.id}
                        style={[styles.achievementCard, { backgroundColor: theme.colors.surfaceContainer }]}
                    >
                        <Octicons name={a.icon} size={20} color={theme.colors.primary} />
                        <Text style={[styles.achievementTitle, { color: theme.colors.onSurface }]}>{a.title}</Text>
                        <Text style={[styles.achievementWhen, { color: theme.colors.onSurfaceVariant }]}>{a.when}</Text>
                    </View>
                ))}
            </View>

            {/* Status footer */}
            <View style={[styles.footer, { borderTopColor: theme.colors.outlineVariant }]}>
                <Text style={[styles.footerText, { color: theme.colors.onSurfaceVariant }]}>
                    Level {PLAYER.level} / {xpPct}% to next level / {PLAYER.streak}-day streak
                </Text>
            </View>
        </ScrollView>
    );
}

// -- Sub-components --

function SectionHeader({
    title,
    icon,
    theme
}: {
    title: string;
    icon: React.ComponentProps<typeof Octicons>["name"];
    theme: Theme;
}) {
    return (
        <View style={styles.sectionHeader}>
            <Octicons name={icon} size={14} color={theme.colors.onSurfaceVariant} />
            <Text style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>{title}</Text>
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

const styles = StyleSheet.create({
    scroll: { flex: 1 },
    scrollContent: { padding: 24, paddingBottom: 48 },

    // Status bar
    statusBar: {
        flexDirection: "row",
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        alignItems: "center",
        gap: 14
    },
    levelBadge: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center"
    },
    levelText: { fontSize: 18, fontWeight: "800" },
    statusInfo: { flex: 1, gap: 6 },
    statusTitle: { fontSize: 16, fontWeight: "600" },
    xpRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    xpTrack: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
    xpFill: { height: "100%", borderRadius: 3 },
    xpLabel: { fontSize: 11, minWidth: 90 },
    streakPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16
    },
    streakValue: { fontSize: 15, fontWeight: "700" },

    // Revenue
    revenueCard: { borderRadius: 16, padding: 24, marginBottom: 24 },
    revenueTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 4
    },
    revenueLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 1.5 },
    revenueDelta: { fontSize: 14, fontWeight: "700" },
    revenueValue: { fontSize: 44, fontWeight: "800", marginBottom: 8 },
    revenueMetrics: { flexDirection: "row", gap: 28, marginTop: 8 },
    revenueMetric: { gap: 2 },
    revenueMetricValue: { fontSize: 16, fontWeight: "700" },
    revenueMetricLabel: { fontSize: 11, opacity: 0.7 },

    // Grid
    grid: { flexDirection: "row", gap: 24, marginBottom: 24 },
    col: { flex: 1 },

    // Sections
    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 10,
        marginTop: 20
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: 0.5
    },
    sectionBody: { gap: 4 },

    // Milestones
    milestoneCard: { borderRadius: 10, padding: 12, gap: 8 },
    milestoneTop: { flexDirection: "row", alignItems: "center", gap: 8 },
    milestoneTitle: { fontSize: 14, fontWeight: "500", flex: 1 },
    milestoneReward: { fontSize: 12, fontWeight: "600" },
    progressTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
    progressFill: { height: "100%", borderRadius: 2 },

    // Rows
    row: { flexDirection: "row", alignItems: "center", borderRadius: 10, padding: 12, gap: 10 },
    rowMain: { flex: 1, gap: 2 },
    rowTitle: { fontSize: 14, fontWeight: "500" },
    rowSub: { fontSize: 12 },
    rowMeta: { fontSize: 12 },
    adStats: { flexDirection: "row", gap: 12, alignItems: "center" },
    adStat: { fontSize: 12, fontWeight: "500", minWidth: 44, textAlign: "right" },

    // Tasks
    taskXp: { fontSize: 12, fontWeight: "600" },

    // Agents
    agentRow: { flexDirection: "row", alignItems: "center", borderRadius: 10, padding: 12, gap: 10 },
    rankBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center"
    },
    rankText: { fontSize: 12, fontWeight: "700" },
    agentXp: { fontSize: 13, fontWeight: "600" },

    // Achievements
    achievementsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
    achievementCard: {
        borderRadius: 10,
        padding: 14,
        alignItems: "center",
        gap: 6,
        minWidth: 110,
        flex: 1
    },
    achievementTitle: { fontSize: 12, fontWeight: "600", textAlign: "center" },
    achievementWhen: { fontSize: 11 },

    // Footer
    footer: {
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingTop: 16,
        alignItems: "center"
    },
    footerText: { fontSize: 12 }
});
