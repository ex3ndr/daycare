import { Octicons } from "@expo/vector-icons";
import type * as React from "react";
import { ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

type Theme = ReturnType<typeof useUnistyles>["theme"];

// -- Mock data --

const ADS = [
    { id: "ad1", network: "Meta", campaign: "Spring promo", spend: "$1,240", impressions: "48.2K", ctr: "3.1%" },
    { id: "ad2", network: "Google", campaign: "Brand search", spend: "$860", impressions: "31.5K", ctr: "4.7%" },
    { id: "ad3", network: "TikTok", campaign: "UGC push", spend: "$520", impressions: "112K", ctr: "1.8%" }
];

const TASKS = [
    { id: "t1", title: "Review campaign creatives", assignee: "Scout", due: "Today" },
    { id: "t2", title: "Fix tracking pixel on landing", assignee: "Builder", due: "Today" },
    { id: "t3", title: "Send weekly digest to team", assignee: "Operator", due: "Tomorrow" },
    { id: "t4", title: "Update audience segments", assignee: "Scout", due: "Mar 4" }
];

const DOCUMENTS = [
    { id: "d1", title: "Q1 Campaign Brief", updated: "2 hours ago" },
    { id: "d2", title: "Brand Guidelines v3", updated: "Yesterday" },
    { id: "d3", title: "Competitor Analysis Feb", updated: "3 days ago" }
];

const EMAILS = [
    { id: "e1", to: "partners@acme.co", subject: "Partnership proposal follow-up", sent: "11:30 AM" },
    { id: "e2", to: "team@company.io", subject: "Weekly metrics report", sent: "9:00 AM" },
    { id: "e3", to: "lisa@agency.com", subject: "Creative assets handoff", sent: "Yesterday" }
];

const TWEETS = [
    { id: "tw1", text: "Just shipped our new onboarding flow! Try it out", likes: 42, retweets: 12, status: "live" },
    { id: "tw2", text: "Thread: 5 things we learned scaling to 10K users", likes: 128, retweets: 47, status: "live" },
    { id: "tw3", text: "Announcing partnerships with three new agencies", likes: 0, retweets: 0, status: "scheduled" }
];

/**
 * Home dashboard view — activity feed with ads, tasks, docs, emails, twitter, and revenue.
 */
export function HomeView() {
    const { theme } = useUnistyles();

    return (
        <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
        >
            <Text style={[styles.pageTitle, { color: theme.colors.onSurface }]}>Home</Text>

            {/* Revenue banner */}
            <View style={[styles.revenueBanner, { backgroundColor: theme.colors.primaryContainer }]}>
                <Text style={[styles.revenueLabel, { color: theme.colors.onPrimaryContainer }]}>BUSINESS</Text>
                <Text style={[styles.revenueValue, { color: theme.colors.onPrimaryContainer }]}>$12,840</Text>
                <Text style={[styles.revenueSubtitle, { color: theme.colors.onPrimaryContainer }]}>
                    Revenue this month &middot; +18% vs last
                </Text>
            </View>

            {/* Ads */}
            <Section title="Ads" icon="broadcast" theme={theme}>
                {ADS.map((ad) => (
                    <View key={ad.id} style={[styles.row, { backgroundColor: theme.colors.surfaceContainer }]}>
                        <View style={styles.rowMain}>
                            <Text style={[styles.rowTitle, { color: theme.colors.onSurface }]}>{ad.campaign}</Text>
                            <Text style={[styles.rowSub, { color: theme.colors.onSurfaceVariant }]}>{ad.network}</Text>
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

            {/* Active tasks */}
            <Section title="Active Tasks" icon="tasklist" theme={theme}>
                {TASKS.map((task) => (
                    <View key={task.id} style={[styles.row, { backgroundColor: theme.colors.surfaceContainer }]}>
                        <View style={styles.rowMain}>
                            <Text style={[styles.rowTitle, { color: theme.colors.onSurface }]}>{task.title}</Text>
                            <Text style={[styles.rowSub, { color: theme.colors.onSurfaceVariant }]}>
                                {task.assignee}
                            </Text>
                        </View>
                        <Text style={[styles.rowDetail, { color: theme.colors.onSurfaceVariant }]}>{task.due}</Text>
                    </View>
                ))}
            </Section>

            {/* Recent documents */}
            <Section title="Recent Documents" icon="file" theme={theme}>
                {DOCUMENTS.map((doc) => (
                    <View key={doc.id} style={[styles.row, { backgroundColor: theme.colors.surfaceContainer }]}>
                        <View style={styles.rowMain}>
                            <Text style={[styles.rowTitle, { color: theme.colors.onSurface }]}>{doc.title}</Text>
                        </View>
                        <Text style={[styles.rowDetail, { color: theme.colors.onSurfaceVariant }]}>{doc.updated}</Text>
                    </View>
                ))}
            </Section>

            {/* Sent emails */}
            <Section title="Sent Emails" icon="mail" theme={theme}>
                {EMAILS.map((email) => (
                    <View key={email.id} style={[styles.row, { backgroundColor: theme.colors.surfaceContainer }]}>
                        <View style={styles.rowMain}>
                            <Text style={[styles.rowTitle, { color: theme.colors.onSurface }]}>{email.subject}</Text>
                            <Text style={[styles.rowSub, { color: theme.colors.onSurfaceVariant }]}>{email.to}</Text>
                        </View>
                        <Text style={[styles.rowDetail, { color: theme.colors.onSurfaceVariant }]}>{email.sent}</Text>
                    </View>
                ))}
            </Section>

            {/* Twitter */}
            <Section title="Twitter" icon="megaphone" theme={theme}>
                {TWEETS.map((tw) => (
                    <View key={tw.id} style={[styles.row, { backgroundColor: theme.colors.surfaceContainer }]}>
                        <View style={styles.rowMain}>
                            <Text style={[styles.rowTitle, { color: theme.colors.onSurface }]} numberOfLines={1}>
                                {tw.text}
                            </Text>
                            {tw.status === "scheduled" ? (
                                <Text style={[styles.rowSub, { color: theme.colors.outline }]}>Scheduled</Text>
                            ) : (
                                <Text style={[styles.rowSub, { color: theme.colors.onSurfaceVariant }]}>
                                    {tw.likes} likes &middot; {tw.retweets} RT
                                </Text>
                            )}
                        </View>
                        <Octicons
                            name={tw.status === "live" ? "dot-fill" : "clock"}
                            size={12}
                            color={tw.status === "live" ? theme.colors.tertiary : theme.colors.outline}
                        />
                    </View>
                ))}
            </Section>

            {/* Funny picture placeholder */}
            <View style={[styles.funnyCard, { backgroundColor: theme.colors.surfaceContainerHigh }]}>
                <Text style={{ fontSize: 48 }}>{"( \u0361\u00B0 \u035C\u0296 \u0361\u00B0)"}</Text>
                <Text style={[styles.funnyText, { color: theme.colors.onSurfaceVariant }]}>
                    Everything is running smoothly. Have a nice day.
                </Text>
            </View>
        </ScrollView>
    );
}

// -- Sub-components --

function Section({
    title,
    icon,
    theme,
    children
}: {
    title: string;
    icon: React.ComponentProps<typeof Octicons>["name"];
    theme: Theme;
    children: React.ReactNode;
}) {
    return (
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <Octicons name={icon} size={14} color={theme.colors.onSurfaceVariant} />
                <Text style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>{title}</Text>
            </View>
            <View style={styles.sectionBody}>{children}</View>
        </View>
    );
}

const styles = StyleSheet.create({
    scroll: {
        flex: 1
    },
    scrollContent: {
        padding: 24,
        paddingBottom: 48,
        maxWidth: 640,
        width: "100%",
        alignSelf: "center"
    },
    pageTitle: {
        fontSize: 26,
        fontWeight: "700",
        marginBottom: 20
    },
    revenueBanner: {
        borderRadius: 16,
        padding: 24,
        alignItems: "center",
        marginBottom: 28,
        gap: 4
    },
    revenueLabel: {
        fontSize: 12,
        fontWeight: "700",
        letterSpacing: 2
    },
    revenueValue: {
        fontSize: 40,
        fontWeight: "800"
    },
    revenueSubtitle: {
        fontSize: 13,
        opacity: 0.8
    },
    section: {
        marginBottom: 24
    },
    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 10
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: 0.5
    },
    sectionBody: {
        gap: 6
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 10,
        padding: 12,
        gap: 12
    },
    rowMain: {
        flex: 1,
        gap: 2
    },
    rowTitle: {
        fontSize: 14,
        fontWeight: "500"
    },
    rowSub: {
        fontSize: 12
    },
    rowStats: {
        flexDirection: "row",
        gap: 12,
        alignItems: "center"
    },
    rowStat: {
        fontSize: 12,
        fontWeight: "500",
        minWidth: 44,
        textAlign: "right"
    },
    rowDetail: {
        fontSize: 12
    },
    funnyCard: {
        borderRadius: 16,
        padding: 24,
        alignItems: "center",
        gap: 12,
        marginBottom: 24
    },
    funnyText: {
        fontSize: 13,
        textAlign: "center"
    }
});
