import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { ShowcasePage } from "@/views/dev/showcase/components/ShowcasePage";

// --- Types ---

type QueueEpisode = {
    id: string;
    title: string;
    podcastName: string;
    duration: number; // minutes
    progress: number; // 0-100, 0 = unplayed
    color: string;
};

type NewEpisode = {
    id: string;
    title: string;
    podcastName: string;
    duration: number;
    publishDate: string;
    color: string;
};

type Subscription = {
    id: string;
    name: string;
    frequency: "Daily" | "Weekly" | "Biweekly" | "Monthly";
    lastEpisodeDate: string;
    color: string;
    episodeCount: number;
};

// --- Mock Data ---

const initialQueue: QueueEpisode[] = [
    {
        id: "q1",
        title: "The Future of AI Regulation",
        podcastName: "Hard Fork",
        duration: 52,
        progress: 63,
        color: "#6366f1"
    },
    {
        id: "q2",
        title: "Why Sleep Matters More Than You Think",
        podcastName: "Huberman Lab",
        duration: 127,
        progress: 0,
        color: "#059669"
    },
    {
        id: "q3",
        title: "The Rise and Fall of WeWork",
        podcastName: "Business Wars",
        duration: 38,
        progress: 22,
        color: "#dc2626"
    },
    {
        id: "q4",
        title: "Deep Dive: Quantum Computing",
        podcastName: "Lex Fridman Podcast",
        duration: 185,
        progress: 0,
        color: "#7c3aed"
    },
    {
        id: "q5",
        title: "Building a Second Brain",
        podcastName: "The Knowledge Project",
        duration: 64,
        progress: 0,
        color: "#0891b2"
    }
];

const newEpisodes: NewEpisode[] = [
    {
        id: "n1",
        title: "Can Startups Still Compete?",
        podcastName: "Hard Fork",
        duration: 48,
        publishDate: "Today",
        color: "#6366f1"
    },
    {
        id: "n2",
        title: "Optimizing Your Morning Routine",
        podcastName: "Huberman Lab",
        duration: 95,
        publishDate: "Yesterday",
        color: "#059669"
    },
    {
        id: "n3",
        title: "The Psychology of Money",
        podcastName: "The Knowledge Project",
        duration: 72,
        publishDate: "2 days ago",
        color: "#0891b2"
    },
    {
        id: "n4",
        title: "Inside the Twitter Files",
        podcastName: "The Daily",
        duration: 28,
        publishDate: "3 days ago",
        color: "#d97706"
    }
];

const subscriptions: Subscription[] = [
    {
        id: "s1",
        name: "Hard Fork",
        frequency: "Weekly",
        lastEpisodeDate: "Mar 3",
        color: "#6366f1",
        episodeCount: 142
    },
    {
        id: "s2",
        name: "Huberman Lab",
        frequency: "Weekly",
        lastEpisodeDate: "Mar 2",
        color: "#059669",
        episodeCount: 218
    },
    {
        id: "s3",
        name: "Lex Fridman Podcast",
        frequency: "Biweekly",
        lastEpisodeDate: "Feb 28",
        color: "#7c3aed",
        episodeCount: 415
    },
    {
        id: "s4",
        name: "The Knowledge Project",
        frequency: "Biweekly",
        lastEpisodeDate: "Feb 26",
        color: "#0891b2",
        episodeCount: 196
    },
    {
        id: "s5",
        name: "Business Wars",
        frequency: "Weekly",
        lastEpisodeDate: "Mar 1",
        color: "#dc2626",
        episodeCount: 310
    },
    {
        id: "s6",
        name: "The Daily",
        frequency: "Daily",
        lastEpisodeDate: "Mar 3",
        color: "#d97706",
        episodeCount: 1842
    }
];

// --- Helpers ---

function formatDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) {
        return `${h}h ${m}m`;
    }
    return `${m}m`;
}

function getInitials(name: string): string {
    return name
        .split(" ")
        .map((w) => w.charAt(0))
        .join("")
        .slice(0, 2)
        .toUpperCase();
}

// --- Podcast Artwork Placeholder ---

function PodcastArtwork({ name, color, size }: { name: string; color: string; size: number }) {
    return (
        <View
            style={{
                width: size,
                height: size,
                borderRadius: 10,
                backgroundColor: color,
                alignItems: "center",
                justifyContent: "center"
            }}
        >
            <Text
                style={{
                    fontFamily: "IBMPlexSans-SemiBold",
                    fontSize: size * 0.35,
                    color: "#ffffffdd"
                }}
            >
                {getInitials(name)}
            </Text>
        </View>
    );
}

// --- Stat Card ---

function StatCard({
    icon,
    value,
    label,
    accentColor
}: {
    icon: keyof typeof Ionicons.glyphMap;
    value: string;
    label: string;
    accentColor: string;
}) {
    const { theme } = useUnistyles();
    return (
        <View style={[styles.statCard, { backgroundColor: theme.colors.surfaceContainer }]}>
            <View style={[styles.statIconCircle, { backgroundColor: `${accentColor}18` }]}>
                <Ionicons name={icon} size={20} color={accentColor} />
            </View>
            <Text style={[styles.statValue, { color: theme.colors.onSurface }]}>{value}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
        </View>
    );
}

// --- Section Header ---

function SectionHeader({
    title,
    icon,
    count
}: {
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
    count?: number;
}) {
    const { theme } = useUnistyles();
    return (
        <View style={styles.sectionHeader}>
            <Ionicons name={icon} size={20} color={theme.colors.onSurface} />
            <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>{title}</Text>
            {count !== undefined && (
                <View style={[styles.countBadge, { backgroundColor: `${theme.colors.primary}18` }]}>
                    <Text style={[styles.countBadgeText, { color: theme.colors.primary }]}>{count}</Text>
                </View>
            )}
        </View>
    );
}

// --- Progress Bar ---

function ProgressBar({ progress, color, trackColor }: { progress: number; color: string; trackColor: string }) {
    return (
        <View style={[styles.progressTrack, { backgroundColor: trackColor }]}>
            <View
                style={[
                    styles.progressFill,
                    {
                        width: `${progress}%`,
                        backgroundColor: color
                    }
                ]}
            />
        </View>
    );
}

// --- Queue Item ---

function QueueItem({
    episode,
    index,
    isFirst,
    isLast,
    onMoveUp,
    onMoveDown
}: {
    episode: QueueEpisode;
    index: number;
    isFirst: boolean;
    isLast: boolean;
    onMoveUp: () => void;
    onMoveDown: () => void;
}) {
    const { theme } = useUnistyles();
    const isPartiallyPlayed = episode.progress > 0;
    const remainingMinutes = Math.round(episode.duration * (1 - episode.progress / 100));

    return (
        <View style={[styles.queueCard, { backgroundColor: theme.colors.surfaceContainer }]}>
            <View style={styles.queueCardContent}>
                {/* Order number */}
                <View style={[styles.orderBadge, { backgroundColor: `${theme.colors.primary}15` }]}>
                    <Text style={[styles.orderNumber, { color: theme.colors.primary }]}>{index + 1}</Text>
                </View>

                {/* Artwork */}
                <PodcastArtwork name={episode.podcastName} color={episode.color} size={48} />

                {/* Info */}
                <View style={styles.queueInfo}>
                    <Text style={[styles.episodeTitle, { color: theme.colors.onSurface }]} numberOfLines={1}>
                        {episode.title}
                    </Text>
                    <Text style={[styles.podcastName, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
                        {episode.podcastName}
                    </Text>
                    <View style={styles.queueMeta}>
                        <Text style={[styles.durationText, { color: theme.colors.onSurfaceVariant }]}>
                            {isPartiallyPlayed
                                ? `${formatDuration(remainingMinutes)} left`
                                : formatDuration(episode.duration)}
                        </Text>
                        {isPartiallyPlayed && (
                            <View style={[styles.playingBadge, { backgroundColor: `${theme.colors.primary}18` }]}>
                                <Ionicons name="play" size={8} color={theme.colors.primary} />
                                <Text style={[styles.playingBadgeText, { color: theme.colors.primary }]}>
                                    In Progress
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Reorder buttons */}
                <View style={styles.reorderButtons}>
                    <Pressable
                        onPress={onMoveUp}
                        disabled={isFirst}
                        style={({ pressed }) => [
                            styles.reorderButton,
                            {
                                backgroundColor: theme.colors.surfaceContainerHighest,
                                opacity: isFirst ? 0.3 : pressed ? 0.6 : 1
                            }
                        ]}
                    >
                        <Ionicons name="chevron-up" size={16} color={theme.colors.onSurfaceVariant} />
                    </Pressable>
                    <Pressable
                        onPress={onMoveDown}
                        disabled={isLast}
                        style={({ pressed }) => [
                            styles.reorderButton,
                            {
                                backgroundColor: theme.colors.surfaceContainerHighest,
                                opacity: isLast ? 0.3 : pressed ? 0.6 : 1
                            }
                        ]}
                    >
                        <Ionicons name="chevron-down" size={16} color={theme.colors.onSurfaceVariant} />
                    </Pressable>
                </View>
            </View>

            {/* Progress bar for partially played */}
            {isPartiallyPlayed && (
                <View style={styles.queueProgressContainer}>
                    <ProgressBar
                        progress={episode.progress}
                        color={episode.color}
                        trackColor={`${theme.colors.outlineVariant}40`}
                    />
                </View>
            )}
        </View>
    );
}

// --- New Episode Item ---

function NewEpisodeItem({ episode }: { episode: NewEpisode }) {
    const { theme } = useUnistyles();
    const isToday = episode.publishDate === "Today";

    return (
        <View style={[styles.newEpisodeCard, { backgroundColor: theme.colors.surfaceContainer }]}>
            <PodcastArtwork name={episode.podcastName} color={episode.color} size={44} />
            <View style={styles.newEpisodeInfo}>
                <View style={styles.newEpisodeTitleRow}>
                    <Text style={[styles.episodeTitle, { color: theme.colors.onSurface, flex: 1 }]} numberOfLines={1}>
                        {episode.title}
                    </Text>
                    {isToday && (
                        <View style={[styles.newBadge, { backgroundColor: theme.colors.primary }]}>
                            <Text style={[styles.newBadgeText, { color: theme.colors.onPrimary }]}>NEW</Text>
                        </View>
                    )}
                </View>
                <Text style={[styles.podcastName, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
                    {episode.podcastName}
                </Text>
                <View style={styles.newEpisodeMeta}>
                    <Text style={[styles.metaText, { color: theme.colors.onSurfaceVariant }]}>
                        {episode.publishDate}
                    </Text>
                    <View style={[styles.metaDot, { backgroundColor: theme.colors.outlineVariant }]} />
                    <Text style={[styles.durationText, { color: theme.colors.onSurfaceVariant }]}>
                        {formatDuration(episode.duration)}
                    </Text>
                </View>
            </View>
        </View>
    );
}

// --- Subscription Item ---

function SubscriptionItem({ subscription }: { subscription: Subscription }) {
    const { theme } = useUnistyles();

    const frequencyColors: Record<string, string> = {
        Daily: "#d97706",
        Weekly: "#059669",
        Biweekly: "#6366f1",
        Monthly: "#7c3aed"
    };
    const freqColor = frequencyColors[subscription.frequency] || theme.colors.primary;

    return (
        <View style={[styles.subscriptionCard, { backgroundColor: theme.colors.surfaceContainer }]}>
            <PodcastArtwork name={subscription.name} color={subscription.color} size={44} />
            <View style={styles.subscriptionInfo}>
                <Text style={[styles.subscriptionName, { color: theme.colors.onSurface }]} numberOfLines={1}>
                    {subscription.name}
                </Text>
                <View style={styles.subscriptionMeta}>
                    <View style={[styles.frequencyChip, { backgroundColor: `${freqColor}18` }]}>
                        <Text style={[styles.frequencyChipText, { color: freqColor }]}>{subscription.frequency}</Text>
                    </View>
                    <Text style={[styles.metaText, { color: theme.colors.onSurfaceVariant }]}>
                        {subscription.episodeCount} eps
                    </Text>
                </View>
            </View>
            <View style={styles.subscriptionRight}>
                <Text style={[styles.lastEpisodeLabel, { color: theme.colors.onSurfaceVariant }]}>Last ep</Text>
                <Text style={[styles.lastEpisodeDate, { color: theme.colors.onSurface }]}>
                    {subscription.lastEpisodeDate}
                </Text>
            </View>
        </View>
    );
}

// --- Main Component ---

export function PodcastQueuePage() {
    const { theme } = useUnistyles();
    const [queue, setQueue] = React.useState(initialQueue);

    const moveUp = React.useCallback((index: number) => {
        if (index <= 0) return;
        setQueue((prev) => {
            const next = [...prev];
            const item = next[index];
            next[index] = next[index - 1];
            next[index - 1] = item;
            return next;
        });
    }, []);

    const moveDown = React.useCallback((index: number) => {
        setQueue((prev) => {
            if (index >= prev.length - 1) return prev;
            const next = [...prev];
            const item = next[index];
            next[index] = next[index + 1];
            next[index + 1] = item;
            return next;
        });
    }, []);

    // Computed stats
    const totalQueueMinutes = queue.reduce((sum, ep) => {
        const remaining = Math.round(ep.duration * (1 - ep.progress / 100));
        return sum + remaining;
    }, 0);
    const totalQueueHours = (totalQueueMinutes / 60).toFixed(1);

    return (
        <ShowcasePage
            style={{ flex: 1, backgroundColor: theme.colors.surface }}
            contentContainerStyle={styles.scrollContent}
        >
            {/* Listening Stats */}
            <View style={styles.statsRow}>
                <StatCard icon="headset-outline" value="12" label="This Week" accentColor={theme.colors.primary} />
                <StatCard
                    icon="time-outline"
                    value={totalQueueHours}
                    label="Queue Hours"
                    accentColor={theme.colors.tertiary}
                />
                <StatCard
                    icon="radio-outline"
                    value={`${subscriptions.length}`}
                    label="Subscribed"
                    accentColor="#d97706"
                />
            </View>

            {/* Up Next */}
            <View style={styles.section}>
                <SectionHeader title="Up Next" icon="list-outline" count={queue.length} />
                <View style={styles.sectionCards}>
                    {queue.map((episode, index) => (
                        <QueueItem
                            key={episode.id}
                            episode={episode}
                            index={index}
                            isFirst={index === 0}
                            isLast={index === queue.length - 1}
                            onMoveUp={() => moveUp(index)}
                            onMoveDown={() => moveDown(index)}
                        />
                    ))}
                </View>
            </View>

            {/* New Episodes */}
            <View style={styles.section}>
                <SectionHeader title="New Episodes" icon="sparkles-outline" count={newEpisodes.length} />
                <View style={styles.sectionCards}>
                    {newEpisodes.map((episode) => (
                        <NewEpisodeItem key={episode.id} episode={episode} />
                    ))}
                </View>
            </View>

            {/* Subscriptions */}
            <View style={styles.section}>
                <SectionHeader title="Subscriptions" icon="radio-outline" count={subscriptions.length} />
                <View style={styles.sectionCards}>
                    {subscriptions.map((sub) => (
                        <SubscriptionItem key={sub.id} subscription={sub} />
                    ))}
                </View>
            </View>
        </ShowcasePage>
    );
}

// --- Styles ---

const styles = StyleSheet.create((theme) => ({
    scrollContent: {
        paddingHorizontal: 16,
        paddingVertical: 20,
        paddingBottom: 48,
        gap: 28
    },

    // Stats
    statsRow: {
        flexDirection: "row",
        gap: 10
    },
    statCard: {
        flex: 1,
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 10,
        alignItems: "center",
        gap: 4
    },
    statIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center"
    },
    statValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 22
    },
    statLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },

    // Section
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
        fontSize: 18,
        flex: 1
    },
    sectionCards: {
        gap: 10
    },
    countBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10
    },
    countBadgeText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 12
    },

    // Queue card
    queueCard: {
        borderRadius: 14,
        padding: 12,
        gap: 10
    },
    queueCardContent: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10
    },
    orderBadge: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: "center",
        justifyContent: "center"
    },
    orderNumber: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 13
    },
    queueInfo: {
        flex: 1,
        gap: 2
    },
    episodeTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 14
    },
    podcastName: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    queueMeta: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginTop: 2
    },
    durationText: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11
    },
    playingBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6
    },
    playingBadgeText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 10
    },
    reorderButtons: {
        gap: 4
    },
    reorderButton: {
        width: 28,
        height: 28,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center"
    },
    queueProgressContainer: {
        paddingHorizontal: 4
    },

    // Progress bar
    progressTrack: {
        height: 4,
        borderRadius: 2,
        overflow: "hidden"
    },
    progressFill: {
        height: "100%",
        borderRadius: 2
    },

    // New episode card
    newEpisodeCard: {
        borderRadius: 14,
        padding: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 10
    },
    newEpisodeInfo: {
        flex: 1,
        gap: 2
    },
    newEpisodeTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    newBadge: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6
    },
    newBadgeText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 9,
        letterSpacing: 0.5
    },
    newEpisodeMeta: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginTop: 2
    },
    metaText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },
    metaDot: {
        width: 3,
        height: 3,
        borderRadius: 1.5
    },

    // Subscription card
    subscriptionCard: {
        borderRadius: 14,
        padding: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 10
    },
    subscriptionInfo: {
        flex: 1,
        gap: 4
    },
    subscriptionName: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 14
    },
    subscriptionMeta: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    frequencyChip: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8
    },
    frequencyChipText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11
    },
    subscriptionRight: {
        alignItems: "flex-end",
        gap: 2
    },
    lastEpisodeLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 10
    },
    lastEpisodeDate: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13
    }
}));
