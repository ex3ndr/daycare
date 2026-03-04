import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

// --- Types ---

type Platform = "twitter" | "linkedin" | "instagram";
type Performance = "viral" | "above average" | "average" | "below average";

type PlatformInfo = {
    name: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    followers: number;
};

type Post = {
    id: string;
    platform: Platform;
    preview: string;
    publishDate: string;
    impressions: number;
    engagement: number;
    performance: Performance;
};

type ScheduledPost = {
    id: string;
    platform: Platform;
    preview: string;
    scheduledDate: string;
    scheduledTime: string;
};

// --- Constants ---

const PLATFORMS: Record<Platform, PlatformInfo> = {
    twitter: { name: "Twitter", icon: "logo-twitter", color: "#1DA1F2", followers: 24800 },
    linkedin: { name: "LinkedIn", icon: "logo-linkedin", color: "#0A66C2", followers: 12350 },
    instagram: { name: "Instagram", icon: "logo-instagram", color: "#E1306C", followers: 31200 }
};

const ALL_PLATFORMS: Platform[] = ["twitter", "linkedin", "instagram"];

const PERFORMANCE_COLORS: Record<Performance, { bg: string; text: string }> = {
    viral: { bg: "#DCFCE7", text: "#16A34A" },
    "above average": { bg: "#DBEAFE", text: "#2563EB" },
    average: { bg: "#FEF3C7", text: "#D97706" },
    "below average": { bg: "#FEE2E2", text: "#DC2626" }
};

const PERFORMANCE_LABELS: Record<Performance, string> = {
    viral: "Viral",
    "above average": "Above Avg",
    average: "Average",
    "below average": "Below Avg"
};

// --- Mock Data ---

const RECENT_POSTS: Post[] = [
    {
        id: "t1",
        platform: "twitter",
        preview: "Excited to announce our new AI-powered analytics dashboard! Real-time insights at your fingertips...",
        publishDate: "Mar 3, 2026",
        impressions: 142300,
        engagement: 8740,
        performance: "viral"
    },
    {
        id: "t2",
        platform: "twitter",
        preview: "Thread: 10 lessons we learned scaling from 0 to 50k users in 6 months. A deep dive into growth...",
        publishDate: "Mar 2, 2026",
        impressions: 67200,
        engagement: 3150,
        performance: "above average"
    },
    {
        id: "t3",
        platform: "twitter",
        preview: "Quick tip: Use keyboard shortcuts to navigate 3x faster. Ctrl+K opens the command palette...",
        publishDate: "Mar 1, 2026",
        impressions: 18400,
        engagement: 920,
        performance: "average"
    },
    {
        id: "t4",
        platform: "twitter",
        preview: "We're hiring! Looking for senior engineers who are passionate about developer tools...",
        publishDate: "Feb 28, 2026",
        impressions: 9200,
        engagement: 310,
        performance: "below average"
    },
    {
        id: "l1",
        platform: "linkedin",
        preview: "Proud to share that our team has grown to 45 people across 12 countries. Remote-first culture...",
        publishDate: "Mar 3, 2026",
        impressions: 34500,
        engagement: 2180,
        performance: "above average"
    },
    {
        id: "l2",
        platform: "linkedin",
        preview: "The future of B2B SaaS is collaborative. Here's why we're betting big on real-time features...",
        publishDate: "Mar 1, 2026",
        impressions: 21700,
        engagement: 1340,
        performance: "average"
    },
    {
        id: "l3",
        platform: "linkedin",
        preview: "Case study: How Meridian Labs reduced onboarding time by 60% using our platform...",
        publishDate: "Feb 27, 2026",
        impressions: 52800,
        engagement: 4210,
        performance: "viral"
    },
    {
        id: "i1",
        platform: "instagram",
        preview: "Behind the scenes at our annual team retreat in Lisbon. Building culture one offsite at a time...",
        publishDate: "Mar 2, 2026",
        impressions: 89300,
        engagement: 7620,
        performance: "viral"
    },
    {
        id: "i2",
        platform: "instagram",
        preview: "New office tour! Check out our redesigned workspace with standing desks and collaboration pods...",
        publishDate: "Feb 28, 2026",
        impressions: 41200,
        engagement: 2890,
        performance: "above average"
    },
    {
        id: "i3",
        platform: "instagram",
        preview: "Meet the team: spotlight on our design crew and the creative process behind our latest UI refresh...",
        publishDate: "Feb 26, 2026",
        impressions: 15600,
        engagement: 780,
        performance: "below average"
    }
];

const SCHEDULED_POSTS: ScheduledPost[] = [
    {
        id: "s1",
        platform: "twitter",
        preview: "Announcing our partnership with CloudSync for seamless data migration...",
        scheduledDate: "Mar 4, 2026",
        scheduledTime: "10:00 AM"
    },
    {
        id: "s2",
        platform: "linkedin",
        preview: "New whitepaper: The State of Developer Productivity in 2026...",
        scheduledDate: "Mar 4, 2026",
        scheduledTime: "2:00 PM"
    },
    {
        id: "s3",
        platform: "instagram",
        preview: "Product launch teaser: Something big is coming next week. Stay tuned...",
        scheduledDate: "Mar 5, 2026",
        scheduledTime: "11:00 AM"
    },
    {
        id: "s4",
        platform: "twitter",
        preview: "We'll be at DevConf 2026 next week! Come say hi at booth #42...",
        scheduledDate: "Mar 6, 2026",
        scheduledTime: "9:00 AM"
    },
    {
        id: "s5",
        platform: "linkedin",
        preview: "Q1 results are in: 3x growth in enterprise customers. Here's what drove it...",
        scheduledDate: "Mar 7, 2026",
        scheduledTime: "8:00 AM"
    }
];

// --- Helpers ---

function formatNumber(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
}

function totalFollowers(): number {
    return ALL_PLATFORMS.reduce((sum, p) => sum + PLATFORMS[p].followers, 0);
}

function topPlatformByEngagement(): Platform {
    const totals: Record<Platform, number> = { twitter: 0, linkedin: 0, instagram: 0 };
    for (const post of RECENT_POSTS) {
        totals[post.platform] += post.engagement;
    }
    return ALL_PLATFORMS.reduce((best, p) => (totals[p] > totals[best] ? p : best), ALL_PLATFORMS[0]);
}

function overallEngagementRate(): number {
    const totalImpressions = RECENT_POSTS.reduce((s, p) => s + p.impressions, 0);
    const totalEngagement = RECENT_POSTS.reduce((s, p) => s + p.engagement, 0);
    return totalImpressions > 0 ? (totalEngagement / totalImpressions) * 100 : 0;
}

function postsThisWeek(): number {
    // Posts from Mar 1-3 (this week range)
    return RECENT_POSTS.filter((p) => {
        return p.publishDate.startsWith("Mar");
    }).length;
}

// --- Sub-components ---

/** Top metrics row: followers, engagement rate, posts this week, top platform */
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
    const total = totalFollowers();
    const engRate = overallEngagementRate();
    const weekPosts = postsThisWeek();
    const topPlat = topPlatformByEngagement();

    const metrics = [
        {
            label: "Total Followers",
            value: formatNumber(total),
            icon: "people-outline" as keyof typeof Ionicons.glyphMap,
            color: "#6366F1"
        },
        {
            label: "Engagement Rate",
            value: `${engRate.toFixed(1)}%`,
            icon: "pulse-outline" as keyof typeof Ionicons.glyphMap,
            color: "#10B981",
            trend: "+0.8%"
        },
        {
            label: "Posts This Week",
            value: weekPosts.toString(),
            icon: "create-outline" as keyof typeof Ionicons.glyphMap,
            color: "#F59E0B"
        },
        {
            label: "Top Platform",
            value: PLATFORMS[topPlat].name,
            icon: PLATFORMS[topPlat].icon,
            color: PLATFORMS[topPlat].color
        }
    ];

    return (
        <View style={styles.metricsGrid}>
            {metrics.map((m) => (
                <View key={m.label} style={[styles.metricCard, { backgroundColor: surfaceColor, borderColor }]}>
                    <View style={styles.metricCardHeader}>
                        <View style={[styles.metricIconBadge, { backgroundColor: `${m.color}18` }]}>
                            <Ionicons name={m.icon} size={18} color={m.color} />
                        </View>
                    </View>
                    <Text style={[styles.metricValue, { color: textColor }]}>{m.value}</Text>
                    <Text style={[styles.metricLabel, { color: subtextColor }]}>{m.label}</Text>
                    {m.trend && (
                        <View style={[styles.trendBadge, { backgroundColor: "#10B98118" }]}>
                            <Ionicons name="arrow-up" size={10} color="#10B981" />
                            <Text style={[styles.trendText, { color: "#10B981" }]}>{m.trend}</Text>
                        </View>
                    )}
                </View>
            ))}
        </View>
    );
}

/** Follower breakdown mini-bar showing proportions per platform */
function FollowerBreakdownBar({ subtextColor, borderColor }: { subtextColor: string; borderColor: string }) {
    const total = totalFollowers();

    return (
        <View style={[styles.breakdownContainer, { borderColor }]}>
            <Text style={[styles.breakdownTitle, { color: subtextColor }]}>FOLLOWER BREAKDOWN</Text>
            <View style={styles.breakdownBar}>
                {ALL_PLATFORMS.map((p) => {
                    const pct = (PLATFORMS[p].followers / total) * 100;
                    return (
                        <View
                            key={p}
                            style={[
                                styles.breakdownSegment,
                                {
                                    width: `${pct}%`,
                                    backgroundColor: PLATFORMS[p].color
                                }
                            ]}
                        />
                    );
                })}
            </View>
            <View style={styles.breakdownLegend}>
                {ALL_PLATFORMS.map((p) => (
                    <View key={p} style={styles.breakdownLegendItem}>
                        <View style={[styles.breakdownDot, { backgroundColor: PLATFORMS[p].color }]} />
                        <Text style={[styles.breakdownLegendText, { color: subtextColor }]}>
                            {PLATFORMS[p].name} {formatNumber(PLATFORMS[p].followers)}
                        </Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

/** Platform section header with brand-colored accent */
function PlatformSectionHeader({
    platform,
    postCount,
    isExpanded,
    onToggle,
    textColor,
    subtextColor
}: {
    platform: Platform;
    postCount: number;
    isExpanded: boolean;
    onToggle: () => void;
    textColor: string;
    subtextColor: string;
}) {
    const info = PLATFORMS[platform];

    return (
        <Pressable onPress={onToggle} style={[styles.platformHeader, { borderLeftColor: info.color }]}>
            <View style={styles.platformHeaderLeft}>
                <View style={[styles.platformIconBadge, { backgroundColor: `${info.color}18` }]}>
                    <Ionicons name={info.icon} size={20} color={info.color} />
                </View>
                <View>
                    <Text style={[styles.platformName, { color: textColor }]}>{info.name}</Text>
                    <Text style={[styles.platformFollowers, { color: subtextColor }]}>
                        {formatNumber(info.followers)} followers
                    </Text>
                </View>
            </View>
            <View style={styles.platformHeaderRight}>
                <View style={[styles.postCountBadge, { backgroundColor: `${info.color}18` }]}>
                    <Text style={[styles.postCountText, { color: info.color }]}>{postCount}</Text>
                </View>
                <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={subtextColor} />
            </View>
        </Pressable>
    );
}

/** Single post row with preview, metrics, and performance chip */
function PostRow({
    post,
    isExpanded,
    onToggle,
    textColor,
    subtextColor,
    borderColor
}: {
    post: Post;
    isExpanded: boolean;
    onToggle: () => void;
    textColor: string;
    subtextColor: string;
    borderColor: string;
}) {
    const perfStyle = PERFORMANCE_COLORS[post.performance];

    return (
        <Pressable onPress={onToggle}>
            <View style={[styles.postRow, { borderBottomColor: borderColor }]}>
                <View style={styles.postMain}>
                    <Text style={[styles.postPreview, { color: textColor }]} numberOfLines={isExpanded ? undefined : 2}>
                        {post.preview}
                    </Text>
                    <View style={styles.postMetaRow}>
                        <Text style={[styles.postDate, { color: subtextColor }]}>{post.publishDate}</Text>
                        <View style={styles.postMetrics}>
                            <View style={styles.postMetricItem}>
                                <Ionicons name="eye-outline" size={12} color={subtextColor} />
                                <Text style={[styles.postMetricValue, { color: textColor }]}>
                                    {formatNumber(post.impressions)}
                                </Text>
                            </View>
                            <View style={styles.postMetricItem}>
                                <Ionicons name="heart-outline" size={12} color={subtextColor} />
                                <Text style={[styles.postMetricValue, { color: textColor }]}>
                                    {formatNumber(post.engagement)}
                                </Text>
                            </View>
                        </View>
                        <View style={[styles.performanceChip, { backgroundColor: perfStyle.bg }]}>
                            <Text style={[styles.performanceChipText, { color: perfStyle.text }]}>
                                {PERFORMANCE_LABELS[post.performance]}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
            {isExpanded && (
                <View style={[styles.postDetailRow, { borderBottomColor: borderColor }]}>
                    <View style={styles.postDetailGrid}>
                        <View style={styles.postDetailItem}>
                            <Text style={[styles.postDetailLabel, { color: subtextColor }]}>Impressions</Text>
                            <Text style={[styles.postDetailValue, { color: textColor }]}>
                                {post.impressions.toLocaleString()}
                            </Text>
                        </View>
                        <View style={styles.postDetailItem}>
                            <Text style={[styles.postDetailLabel, { color: subtextColor }]}>Engagement</Text>
                            <Text style={[styles.postDetailValue, { color: textColor }]}>
                                {post.engagement.toLocaleString()}
                            </Text>
                        </View>
                        <View style={styles.postDetailItem}>
                            <Text style={[styles.postDetailLabel, { color: subtextColor }]}>Eng. Rate</Text>
                            <Text style={[styles.postDetailValue, { color: textColor }]}>
                                {((post.engagement / post.impressions) * 100).toFixed(2)}%
                            </Text>
                        </View>
                    </View>
                </View>
            )}
        </Pressable>
    );
}

/** Scheduled post row */
function ScheduledRow({
    post,
    textColor,
    subtextColor,
    borderColor
}: {
    post: ScheduledPost;
    textColor: string;
    subtextColor: string;
    borderColor: string;
}) {
    const info = PLATFORMS[post.platform];

    return (
        <View style={[styles.scheduledRow, { borderBottomColor: borderColor }]}>
            <View style={styles.scheduledDateCol}>
                <View style={[styles.scheduledDateBadge, { backgroundColor: `${info.color}18` }]}>
                    <Ionicons name="calendar-outline" size={14} color={info.color} />
                </View>
                <View>
                    <Text style={[styles.scheduledDate, { color: textColor }]}>{post.scheduledDate}</Text>
                    <Text style={[styles.scheduledTime, { color: subtextColor }]}>{post.scheduledTime}</Text>
                </View>
            </View>
            <View style={styles.scheduledContent}>
                <View style={styles.scheduledPlatformRow}>
                    <Ionicons name={info.icon} size={14} color={info.color} />
                    <Text style={[styles.scheduledPlatformName, { color: info.color }]}>{info.name}</Text>
                </View>
                <Text style={[styles.scheduledPreview, { color: textColor }]} numberOfLines={2}>
                    {post.preview}
                </Text>
            </View>
        </View>
    );
}

/** Collapsible section header */
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

// --- Platform filter pill ---

function FilterPill({
    label,
    active,
    color,
    onPress,
    inactiveBg,
    inactiveText
}: {
    label: string;
    active: boolean;
    color: string;
    onPress: () => void;
    inactiveBg: string;
    inactiveText: string;
}) {
    return (
        <Pressable onPress={onPress} style={[styles.filterPill, { backgroundColor: active ? color : inactiveBg }]}>
            <Text style={[styles.filterPillText, { color: active ? "#FFFFFF" : inactiveText }]}>{label}</Text>
        </Pressable>
    );
}

// --- Main Component ---

/**
 * Social media performance dashboard showing follower metrics, engagement rates,
 * recent posts grouped by platform with performance chips, and scheduled upcoming posts.
 */
export function SocialMediaPage() {
    const { theme } = useUnistyles();
    const [activePlatformFilter, setActivePlatformFilter] = React.useState<Platform | "all">("all");
    const [expandedPlatforms, setExpandedPlatforms] = React.useState<Record<Platform, boolean>>({
        twitter: true,
        linkedin: true,
        instagram: true
    });
    const [expandedPostId, setExpandedPostId] = React.useState<string | null>(null);
    const [scheduledExpanded, setScheduledExpanded] = React.useState(true);

    const togglePlatform = React.useCallback((p: Platform) => {
        setExpandedPlatforms((prev) => ({ ...prev, [p]: !prev[p] }));
    }, []);

    const togglePost = React.useCallback((id: string) => {
        setExpandedPostId((prev) => (prev === id ? null : id));
    }, []);

    // Filter platforms to show
    const visiblePlatforms = activePlatformFilter === "all" ? ALL_PLATFORMS : [activePlatformFilter];

    // Group posts by platform
    const postsByPlatform = React.useMemo(() => {
        const grouped: Record<Platform, Post[]> = { twitter: [], linkedin: [], instagram: [] };
        for (const post of RECENT_POSTS) {
            grouped[post.platform].push(post);
        }
        return grouped;
    }, []);

    return (
        <ScrollView
            contentContainerStyle={[styles.scrollContent, { backgroundColor: theme.colors.surface }]}
            showsVerticalScrollIndicator={false}
        >
            {/* Hero: total followers */}
            <View style={styles.heroSection}>
                <Text style={[styles.heroLabel, { color: theme.colors.onSurfaceVariant }]}>
                    SOCIAL MEDIA PERFORMANCE
                </Text>
                <Text style={[styles.heroValue, { color: theme.colors.onSurface }]}>
                    {formatNumber(totalFollowers())}
                </Text>
                <Text style={[styles.heroSub, { color: theme.colors.onSurfaceVariant }]}>
                    Total followers across all platforms
                </Text>
            </View>

            {/* Follower breakdown mini-bar */}
            <FollowerBreakdownBar
                subtextColor={theme.colors.onSurfaceVariant}
                borderColor={theme.colors.outlineVariant}
            />

            {/* Top-level metrics grid */}
            <MetricsRow
                surfaceColor={theme.colors.surfaceContainer}
                textColor={theme.colors.onSurface}
                subtextColor={theme.colors.onSurfaceVariant}
                borderColor={theme.colors.outlineVariant}
            />

            {/* Platform filter pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                <FilterPill
                    label="All Platforms"
                    active={activePlatformFilter === "all"}
                    color={theme.colors.primary}
                    onPress={() => setActivePlatformFilter("all")}
                    inactiveBg={theme.colors.surfaceContainerHighest}
                    inactiveText={theme.colors.onSurfaceVariant}
                />
                {ALL_PLATFORMS.map((p) => (
                    <FilterPill
                        key={p}
                        label={PLATFORMS[p].name}
                        active={activePlatformFilter === p}
                        color={PLATFORMS[p].color}
                        onPress={() => setActivePlatformFilter(p)}
                        inactiveBg={theme.colors.surfaceContainerHighest}
                        inactiveText={theme.colors.onSurfaceVariant}
                    />
                ))}
            </ScrollView>

            {/* Recent posts grouped by platform */}
            {visiblePlatforms.map((platform) => {
                const posts = postsByPlatform[platform];
                const isExpanded = expandedPlatforms[platform];

                return (
                    <View key={platform}>
                        <PlatformSectionHeader
                            platform={platform}
                            postCount={posts.length}
                            isExpanded={isExpanded}
                            onToggle={() => togglePlatform(platform)}
                            textColor={theme.colors.onSurface}
                            subtextColor={theme.colors.onSurfaceVariant}
                        />
                        {isExpanded && (
                            <View style={[styles.sectionCard, { backgroundColor: theme.colors.surfaceContainer }]}>
                                {posts.map((post) => (
                                    <PostRow
                                        key={post.id}
                                        post={post}
                                        isExpanded={expandedPostId === post.id}
                                        onToggle={() => togglePost(post.id)}
                                        textColor={theme.colors.onSurface}
                                        subtextColor={theme.colors.onSurfaceVariant}
                                        borderColor={theme.colors.outlineVariant}
                                    />
                                ))}
                            </View>
                        )}
                    </View>
                );
            })}

            {/* Scheduled posts */}
            <SectionHeader
                title="Scheduled"
                icon="time-outline"
                iconColor={theme.colors.primary}
                isExpanded={scheduledExpanded}
                onToggle={() => setScheduledExpanded((p) => !p)}
                textColor={theme.colors.onSurface}
                subtextColor={theme.colors.onSurfaceVariant}
                count={SCHEDULED_POSTS.length}
            />
            {scheduledExpanded && (
                <View style={[styles.sectionCard, { backgroundColor: theme.colors.surfaceContainer }]}>
                    {SCHEDULED_POSTS.map((post) => (
                        <ScheduledRow
                            key={post.id}
                            post={post}
                            textColor={theme.colors.onSurface}
                            subtextColor={theme.colors.onSurfaceVariant}
                            borderColor={theme.colors.outlineVariant}
                        />
                    ))}
                </View>
            )}
        </ScrollView>
    );
}

// --- Styles ---

const styles = StyleSheet.create((theme) => ({
    scrollContent: {
        maxWidth: theme.layout.maxWidth,
        width: "100%",
        alignSelf: "center",
        paddingHorizontal: 16,
        paddingBottom: 60
    },

    // Hero
    heroSection: {
        alignItems: "center",
        paddingTop: 12,
        paddingBottom: 16,
        gap: 4
    },
    heroLabel: {
        fontFamily: "IBMPlexSans-Regular",
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

    // Follower breakdown bar
    breakdownContainer: {
        marginBottom: 16,
        gap: 8
    },
    breakdownTitle: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11,
        letterSpacing: 1,
        textTransform: "uppercase"
    },
    breakdownBar: {
        flexDirection: "row",
        height: 10,
        borderRadius: 5,
        overflow: "hidden"
    },
    breakdownSegment: {
        height: "100%"
    },
    breakdownLegend: {
        flexDirection: "row",
        gap: 16
    },
    breakdownDot: {
        width: 8,
        height: 8,
        borderRadius: 4
    },
    breakdownLegendItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5
    },
    breakdownLegendText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },

    // Metrics grid
    metricsGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
        marginBottom: 16
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

    // Filter pills
    filterRow: {
        flexDirection: "row",
        gap: 8,
        paddingVertical: 4,
        marginBottom: 8
    },
    filterPill: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 16
    },
    filterPillText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13
    },

    // Platform section header
    platformHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 12,
        marginTop: 8,
        borderLeftWidth: 3,
        paddingLeft: 12
    },
    platformHeaderLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10
    },
    platformIconBadge: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center"
    },
    platformName: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 16
    },
    platformFollowers: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    platformHeaderRight: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    postCountBadge: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: "center",
        justifyContent: "center"
    },
    postCountText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 12
    },

    // Section header (for Scheduled)
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 14,
        marginTop: 12
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

    // Post row
    postRow: {
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: 0.5
    },
    postMain: {
        gap: 8
    },
    postPreview: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14,
        lineHeight: 20
    },
    postMetaRow: {
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 10
    },
    postDate: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },
    postMetrics: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10
    },
    postMetricItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4
    },
    postMetricValue: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 12
    },
    performanceChip: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8
    },
    performanceChipText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },

    // Post detail (expanded)
    postDetailRow: {
        paddingHorizontal: 14,
        paddingBottom: 12,
        borderBottomWidth: 0.5
    },
    postDetailGrid: {
        flexDirection: "row",
        gap: 16,
        paddingTop: 4
    },
    postDetailItem: {
        flex: 1,
        gap: 2
    },
    postDetailLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: 0.5
    },
    postDetailValue: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 14
    },

    // Scheduled posts
    scheduledRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: 0.5,
        gap: 12
    },
    scheduledDateCol: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        width: 140
    },
    scheduledDateBadge: {
        width: 32,
        height: 32,
        borderRadius: 9,
        alignItems: "center",
        justifyContent: "center"
    },
    scheduledDate: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    scheduledTime: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },
    scheduledContent: {
        flex: 1,
        gap: 4
    },
    scheduledPlatformRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5
    },
    scheduledPlatformName: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    scheduledPreview: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 18
    }
}));
