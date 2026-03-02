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
    streak: 12,
    coins: 48_620
};

const QUESTS = [
    {
        id: "q1",
        emoji: "\u2694\uFE0F",
        title: "Launch Spring Campaign",
        reward: "+500 XP",
        progress: 0.8,
        status: "active"
    },
    {
        id: "q2",
        emoji: "\uD83D\uDCE7",
        title: "Send 50 Outreach Emails",
        reward: "+300 XP",
        progress: 0.62,
        status: "active"
    },
    {
        id: "q3",
        emoji: "\uD83D\uDC26",
        title: "Get 1K Twitter Impressions",
        reward: "+200 XP",
        progress: 0.95,
        status: "active"
    },
    {
        id: "q4",
        emoji: "\uD83D\uDCB0",
        title: "Hit $10K Monthly Revenue",
        reward: "Golden Badge",
        progress: 1,
        status: "done"
    }
];

const ACHIEVEMENTS = [
    { id: "a1", emoji: "\uD83C\uDF1F", title: "First Dollar", when: "Day 1" },
    { id: "a2", emoji: "\uD83D\uDE80", title: "10 Users Onboarded", when: "Week 2" },
    { id: "a3", emoji: "\uD83D\uDD25", title: "7-Day Streak", when: "Week 3" },
    { id: "a4", emoji: "\uD83D\uDC51", title: "$10K Revenue", when: "Month 2" },
    { id: "a5", emoji: "\uD83C\uDFAF", title: "CTR > 5%", when: "Month 2" },
    { id: "a6", emoji: "\u26A1", title: "100 Emails Sent", when: "Month 3" }
];

const ADS = [
    { id: "ad1", network: "Meta", campaign: "Spring promo", spend: "$1,240", impressions: "48.2K", ctr: "3.1%" },
    { id: "ad2", network: "Google", campaign: "Brand search", spend: "$860", impressions: "31.5K", ctr: "4.7%" },
    { id: "ad3", network: "TikTok", campaign: "UGC push", spend: "$520", impressions: "112K", ctr: "1.8%" },
    { id: "ad4", network: "LinkedIn", campaign: "B2B retarget", spend: "$340", impressions: "8.1K", ctr: "2.4%" }
];

const TASKS = [
    { id: "t1", emoji: "\uD83C\uDFA8", title: "Review campaign creatives", agent: "Scout", due: "Today", xp: 50 },
    { id: "t2", emoji: "\uD83D\uDD27", title: "Fix tracking pixel", agent: "Builder", due: "Today", xp: 80 },
    { id: "t3", emoji: "\uD83D\uDCE8", title: "Send weekly digest", agent: "Operator", due: "Tomorrow", xp: 30 },
    { id: "t4", emoji: "\uD83C\uDFAF", title: "Update audience segments", agent: "Scout", due: "Mar 4", xp: 60 }
];

const EMAILS = [
    { id: "e1", to: "partners@acme.co", subject: "Partnership proposal follow-up", sent: "11:30 AM", status: "opened" },
    { id: "e2", to: "team@company.io", subject: "Weekly metrics report", sent: "9:00 AM", status: "delivered" },
    { id: "e3", to: "lisa@agency.com", subject: "Creative assets handoff", sent: "Yesterday", status: "replied" }
];

const TWEETS = [
    { id: "tw1", text: "Just shipped our new onboarding flow!", likes: 42, retweets: 12, status: "live" },
    { id: "tw2", text: "Thread: 5 things we learned scaling to 10K users", likes: 128, retweets: 47, status: "viral" },
    { id: "tw3", text: "Announcing partnerships with three new agencies", likes: 0, retweets: 0, status: "queued" }
];

const DOCUMENTS = [
    { id: "d1", title: "Q1 Campaign Brief", updated: "2h ago" },
    { id: "d2", title: "Brand Guidelines v3", updated: "Yesterday" },
    { id: "d3", title: "Competitor Analysis", updated: "3d ago" }
];

const LEADERBOARD = [
    { id: "l1", name: "Scout", role: "Recon Agent", xp: 1_240, streak: 8 },
    { id: "l2", name: "Builder", role: "Code Agent", xp: 980, streak: 12 },
    { id: "l3", name: "Operator", role: "Ops Agent", xp: 620, streak: 5 }
];

/**
 * Home dashboard — gamified business sim HQ with XP, quests, achievements, and agent leaderboard.
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
            {/* Player HUD */}
            <View style={[styles.hud, { backgroundColor: theme.colors.surfaceContainer }]}>
                <View style={styles.hudLeft}>
                    <View style={styles.hudLevel}>
                        <View style={[styles.levelBadge, { backgroundColor: theme.colors.primaryContainer }]}>
                            <Text style={[styles.levelText, { color: theme.colors.onPrimaryContainer }]}>
                                {PLAYER.level}
                            </Text>
                        </View>
                        <View style={styles.hudInfo}>
                            <Text style={[styles.hudTitle, { color: theme.colors.onSurface }]}>{PLAYER.title}</Text>
                            <View style={styles.xpBar}>
                                <View style={[styles.xpTrack, { backgroundColor: theme.colors.surfaceContainerHigh }]}>
                                    <View
                                        style={[
                                            styles.xpFill,
                                            { width: `${xpPct}%`, backgroundColor: theme.colors.primary }
                                        ]}
                                    />
                                </View>
                                <Text style={[styles.xpLabel, { color: theme.colors.onSurfaceVariant }]}>
                                    {PLAYER.xp} / {PLAYER.xpNext} XP
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>
                <View style={styles.hudRight}>
                    <View style={styles.hudStat}>
                        <Text style={styles.hudStatEmoji}>{"\uD83D\uDD25"}</Text>
                        <Text style={[styles.hudStatValue, { color: theme.colors.onSurface }]}>{PLAYER.streak}</Text>
                        <Text style={[styles.hudStatLabel, { color: theme.colors.onSurfaceVariant }]}>day streak</Text>
                    </View>
                    <View style={styles.hudStat}>
                        <Text style={styles.hudStatEmoji}>{"\uD83E\uDE99"}</Text>
                        <Text style={[styles.hudStatValue, { color: theme.colors.onSurface }]}>
                            {PLAYER.coins.toLocaleString()}
                        </Text>
                        <Text style={[styles.hudStatLabel, { color: theme.colors.onSurfaceVariant }]}>coins</Text>
                    </View>
                </View>
            </View>

            {/* Revenue — big shiny banner */}
            <View style={[styles.revenueBanner, { backgroundColor: theme.colors.primaryContainer }]}>
                <Text style={[styles.revenueEyebrow, { color: theme.colors.onPrimaryContainer }]}>
                    {"\uD83C\uDFC6"} BUSINESS
                </Text>
                <Text style={[styles.revenueValue, { color: theme.colors.onPrimaryContainer }]}>$12,840</Text>
                <Text style={[styles.revenueSub, { color: theme.colors.onPrimaryContainer }]}>
                    revenue this month {"\u00B7"} +18% {"\u2191"}
                </Text>
                <View style={styles.revenueStats}>
                    <MiniStat label="ad spend" value="$2.6K" theme={theme} />
                    <MiniStat label="ROAS" value="4.9x" theme={theme} />
                    <MiniStat label="customers" value="847" theme={theme} />
                    <MiniStat label="LTV" value="$38" theme={theme} />
                </View>
            </View>

            {/* Grid */}
            <View style={styles.grid}>
                {/* Left column */}
                <View style={styles.col}>
                    {/* Quests */}
                    <Section title={"\u2694\uFE0F Active Quests"} theme={theme}>
                        {QUESTS.map((q) => {
                            const pct = Math.round(q.progress * 100);
                            const done = q.status === "done";
                            return (
                                <View
                                    key={q.id}
                                    style={[
                                        styles.questCard,
                                        {
                                            backgroundColor: done
                                                ? theme.colors.tertiaryContainer
                                                : theme.colors.surfaceContainer
                                        }
                                    ]}
                                >
                                    <Text style={styles.questEmoji}>{q.emoji}</Text>
                                    <View style={styles.questMain}>
                                        <View style={styles.questHeader}>
                                            <Text
                                                style={[
                                                    styles.questTitle,
                                                    {
                                                        color: done
                                                            ? theme.colors.onTertiaryContainer
                                                            : theme.colors.onSurface
                                                    }
                                                ]}
                                            >
                                                {q.title}
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.questReward,
                                                    {
                                                        color: done
                                                            ? theme.colors.onTertiaryContainer
                                                            : theme.colors.primary
                                                    }
                                                ]}
                                            >
                                                {done ? "\u2705" : q.reward}
                                            </Text>
                                        </View>
                                        <View
                                            style={[
                                                styles.questTrack,
                                                { backgroundColor: theme.colors.surfaceContainerHigh }
                                            ]}
                                        >
                                            <View
                                                style={[
                                                    styles.questFill,
                                                    {
                                                        width: `${pct}%`,
                                                        backgroundColor: done
                                                            ? theme.colors.tertiary
                                                            : theme.colors.primary
                                                    }
                                                ]}
                                            />
                                        </View>
                                    </View>
                                </View>
                            );
                        })}
                    </Section>

                    {/* Ads */}
                    <Section title={"\uD83D\uDCE1 Ad Networks"} theme={theme}>
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
                                <View style={styles.rowStats}>
                                    <Text style={[styles.rowStat, { color: theme.colors.onSurfaceVariant }]}>
                                        {ad.impressions}
                                    </Text>
                                    <Text style={[styles.rowStat, { color: theme.colors.primary }]}>{ad.ctr}</Text>
                                    <Text style={[styles.rowStat, { color: theme.colors.onSurface }]}>{ad.spend}</Text>
                                </View>
                            </View>
                        ))}
                    </Section>

                    {/* Emails */}
                    <Section title={"\uD83D\uDCE7 Outreach Log"} theme={theme}>
                        {EMAILS.map((email) => {
                            const statusEmoji =
                                email.status === "replied"
                                    ? "\uD83D\uDCAC"
                                    : email.status === "opened"
                                      ? "\uD83D\uDC40"
                                      : "\u2709\uFE0F";
                            return (
                                <View
                                    key={email.id}
                                    style={[styles.row, { backgroundColor: theme.colors.surfaceContainer }]}
                                >
                                    <Text style={styles.emailStatusEmoji}>{statusEmoji}</Text>
                                    <View style={styles.rowMain}>
                                        <Text style={[styles.rowTitle, { color: theme.colors.onSurface }]}>
                                            {email.subject}
                                        </Text>
                                        <Text style={[styles.rowSub, { color: theme.colors.onSurfaceVariant }]}>
                                            {email.to}
                                        </Text>
                                    </View>
                                    <Text style={[styles.rowDetail, { color: theme.colors.onSurfaceVariant }]}>
                                        {email.sent}
                                    </Text>
                                </View>
                            );
                        })}
                    </Section>
                </View>

                {/* Right column */}
                <View style={styles.col}>
                    {/* Agent Leaderboard */}
                    <Section title={"\uD83C\uDFC5 Agent Leaderboard"} theme={theme}>
                        {LEADERBOARD.map((agent, i) => {
                            const medals = ["\uD83E\uDD47", "\uD83E\uDD48", "\uD83E\uDD49"];
                            return (
                                <View
                                    key={agent.id}
                                    style={[styles.leaderRow, { backgroundColor: theme.colors.surfaceContainer }]}
                                >
                                    <Text style={styles.leaderMedal}>{medals[i]}</Text>
                                    <View style={styles.rowMain}>
                                        <Text style={[styles.rowTitle, { color: theme.colors.onSurface }]}>
                                            {agent.name}
                                        </Text>
                                        <Text style={[styles.rowSub, { color: theme.colors.onSurfaceVariant }]}>
                                            {agent.role}
                                        </Text>
                                    </View>
                                    <View style={styles.leaderStats}>
                                        <Text style={[styles.leaderXp, { color: theme.colors.primary }]}>
                                            {agent.xp} XP
                                        </Text>
                                        <Text style={[styles.rowSub, { color: theme.colors.onSurfaceVariant }]}>
                                            {"\uD83D\uDD25"} {agent.streak}d
                                        </Text>
                                    </View>
                                </View>
                            );
                        })}
                    </Section>

                    {/* Tasks as bounty board */}
                    <Section title={"\uD83D\uDCCB Bounty Board"} theme={theme}>
                        {TASKS.map((task) => (
                            <View
                                key={task.id}
                                style={[styles.row, { backgroundColor: theme.colors.surfaceContainer }]}
                            >
                                <Text style={styles.taskEmoji}>{task.emoji}</Text>
                                <View style={styles.rowMain}>
                                    <Text style={[styles.rowTitle, { color: theme.colors.onSurface }]}>
                                        {task.title}
                                    </Text>
                                    <Text style={[styles.rowSub, { color: theme.colors.onSurfaceVariant }]}>
                                        {task.agent} {"\u00B7"} {task.due}
                                    </Text>
                                </View>
                                <Text style={[styles.bountyXp, { color: theme.colors.primary }]}>+{task.xp} XP</Text>
                            </View>
                        ))}
                    </Section>

                    {/* Twitter */}
                    <Section title={"\uD83D\uDC26 Twitter Ops"} theme={theme}>
                        {TWEETS.map((tw) => {
                            const badge =
                                tw.status === "viral"
                                    ? "\uD83D\uDD25"
                                    : tw.status === "live"
                                      ? "\uD83D\uDFE2"
                                      : "\u23F3";
                            return (
                                <View
                                    key={tw.id}
                                    style={[styles.row, { backgroundColor: theme.colors.surfaceContainer }]}
                                >
                                    <Text style={styles.tweetBadge}>{badge}</Text>
                                    <View style={styles.rowMain}>
                                        <Text
                                            style={[styles.rowTitle, { color: theme.colors.onSurface }]}
                                            numberOfLines={1}
                                        >
                                            {tw.text}
                                        </Text>
                                        {tw.status === "queued" ? (
                                            <Text style={[styles.rowSub, { color: theme.colors.outline }]}>
                                                Queued for tomorrow
                                            </Text>
                                        ) : (
                                            <Text style={[styles.rowSub, { color: theme.colors.onSurfaceVariant }]}>
                                                {tw.likes} {"\u2764\uFE0F"} {tw.retweets} {"\uD83D\uDD01"}
                                                {tw.status === "viral" ? " \u2014 GOING VIRAL" : ""}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            );
                        })}
                    </Section>

                    {/* Docs */}
                    <Section title={"\uD83D\uDCDA Intel Files"} theme={theme}>
                        {DOCUMENTS.map((doc) => (
                            <View key={doc.id} style={[styles.row, { backgroundColor: theme.colors.surfaceContainer }]}>
                                <Octicons name="file" size={14} color={theme.colors.onSurfaceVariant} />
                                <View style={styles.rowMain}>
                                    <Text style={[styles.rowTitle, { color: theme.colors.onSurface }]}>
                                        {doc.title}
                                    </Text>
                                </View>
                                <Text style={[styles.rowDetail, { color: theme.colors.onSurfaceVariant }]}>
                                    {doc.updated}
                                </Text>
                            </View>
                        ))}
                    </Section>
                </View>
            </View>

            {/* Achievements ribbon */}
            <Section title={"\uD83C\uDFC6 Achievements Unlocked"} theme={theme}>
                <View style={styles.achievementsGrid}>
                    {ACHIEVEMENTS.map((a) => (
                        <View
                            key={a.id}
                            style={[styles.achievementCard, { backgroundColor: theme.colors.surfaceContainer }]}
                        >
                            <Text style={styles.achievementEmoji}>{a.emoji}</Text>
                            <Text style={[styles.achievementTitle, { color: theme.colors.onSurface }]}>{a.title}</Text>
                            <Text style={[styles.achievementWhen, { color: theme.colors.onSurfaceVariant }]}>
                                {a.when}
                            </Text>
                        </View>
                    ))}
                </View>
            </Section>

            {/* Motivational footer */}
            <View style={[styles.footer, { backgroundColor: theme.colors.surfaceContainerHigh }]}>
                <Text style={styles.footerEmoji}>{"\uD83D\uDE80"}</Text>
                <Text style={[styles.footerTitle, { color: theme.colors.onSurface }]}>Keep grinding, CEO!</Text>
                <Text style={[styles.footerSub, { color: theme.colors.onSurfaceVariant }]}>
                    You're in the top 3% of players this week. Next level unlocks the "Viral Machine" perk.
                </Text>
            </View>
        </ScrollView>
    );
}

// -- Sub-components --

function Section({ title, theme, children }: { title: string; theme: Theme; children: React.ReactNode }) {
    return (
        <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>{title}</Text>
            <View style={styles.sectionBody}>{children}</View>
        </View>
    );
}

function MiniStat({ label, value, theme }: { label: string; value: string; theme: Theme }) {
    return (
        <View style={styles.miniStat}>
            <Text style={[styles.miniStatValue, { color: theme.colors.onPrimaryContainer }]}>{value}</Text>
            <Text style={[styles.miniStatLabel, { color: theme.colors.onPrimaryContainer }]}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    scroll: { flex: 1 },
    scrollContent: { padding: 24, paddingBottom: 48 },

    // HUD
    hud: { flexDirection: "row", borderRadius: 16, padding: 20, marginBottom: 20, alignItems: "center" },
    hudLeft: { flex: 1 },
    hudLevel: { flexDirection: "row", alignItems: "center", gap: 14 },
    levelBadge: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: "center",
        justifyContent: "center"
    },
    levelText: { fontSize: 22, fontWeight: "800" },
    hudInfo: { flex: 1, gap: 6 },
    hudTitle: { fontSize: 18, fontWeight: "700" },
    xpBar: { gap: 4 },
    xpTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
    xpFill: { height: "100%", borderRadius: 4 },
    xpLabel: { fontSize: 11 },
    hudRight: { flexDirection: "row", gap: 28 },
    hudStat: { alignItems: "center", gap: 2 },
    hudStatEmoji: { fontSize: 20 },
    hudStatValue: { fontSize: 18, fontWeight: "700" },
    hudStatLabel: { fontSize: 11 },

    // Revenue
    revenueBanner: { borderRadius: 16, padding: 28, marginBottom: 24, alignItems: "center", gap: 4 },
    revenueEyebrow: { fontSize: 13, fontWeight: "700", letterSpacing: 2 },
    revenueValue: { fontSize: 52, fontWeight: "800" },
    revenueSub: { fontSize: 14, opacity: 0.8 },
    revenueStats: { flexDirection: "row", gap: 32, marginTop: 12 },
    miniStat: { alignItems: "center", gap: 2 },
    miniStatValue: { fontSize: 18, fontWeight: "700" },
    miniStatLabel: { fontSize: 11, opacity: 0.7 },

    // Grid
    grid: { flexDirection: "row", gap: 24, marginBottom: 24 },
    col: { flex: 1 },

    // Sections
    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 14, fontWeight: "700", marginBottom: 10 },
    sectionBody: { gap: 6 },

    // Quests
    questCard: { flexDirection: "row", borderRadius: 12, padding: 14, gap: 12, alignItems: "center" },
    questEmoji: { fontSize: 22 },
    questMain: { flex: 1, gap: 6 },
    questHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    questTitle: { fontSize: 14, fontWeight: "600", flex: 1 },
    questReward: { fontSize: 12, fontWeight: "600" },
    questTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
    questFill: { height: "100%", borderRadius: 3 },

    // Rows
    row: { flexDirection: "row", alignItems: "center", borderRadius: 10, padding: 12, gap: 10 },
    rowMain: { flex: 1, gap: 2 },
    rowTitle: { fontSize: 14, fontWeight: "500" },
    rowSub: { fontSize: 12 },
    rowStats: { flexDirection: "row", gap: 12, alignItems: "center" },
    rowStat: { fontSize: 12, fontWeight: "500", minWidth: 44, textAlign: "right" },
    rowDetail: { fontSize: 12 },

    // Task / Email / Tweet specifics
    taskEmoji: { fontSize: 18 },
    bountyXp: { fontSize: 13, fontWeight: "700" },
    emailStatusEmoji: { fontSize: 16 },
    tweetBadge: { fontSize: 16 },

    // Leaderboard
    leaderRow: { flexDirection: "row", alignItems: "center", borderRadius: 10, padding: 12, gap: 10 },
    leaderMedal: { fontSize: 22 },
    leaderStats: { alignItems: "flex-end", gap: 2 },
    leaderXp: { fontSize: 13, fontWeight: "700" },

    // Achievements
    achievementsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    achievementCard: { borderRadius: 12, padding: 14, alignItems: "center", gap: 4, minWidth: 120, flex: 1 },
    achievementEmoji: { fontSize: 28 },
    achievementTitle: { fontSize: 13, fontWeight: "600", textAlign: "center" },
    achievementWhen: { fontSize: 11 },

    // Footer
    footer: { borderRadius: 16, padding: 28, alignItems: "center", gap: 8, marginBottom: 24 },
    footerEmoji: { fontSize: 40 },
    footerTitle: { fontSize: 20, fontWeight: "700" },
    footerSub: { fontSize: 13, textAlign: "center", lineHeight: 19 }
});
