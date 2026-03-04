import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

// --- Types ---

type SortTab = "popular" | "recent" | "planned";
type RequestStatus = "under_review" | "planned" | "in_progress" | "shipped";
type Category = "UI/UX" | "Performance" | "Integrations" | "API" | "Mobile" | "Security";

interface Voter {
    name: string;
    avatarColor: string;
}

interface FeatureRequest {
    id: string;
    title: string;
    description: string;
    votes: number;
    requester: string;
    status: RequestStatus;
    category: Category;
    daysAgo: number;
    voters: Voter[];
    roadmapItem: string | null;
}

// --- Mock data ---

const REQUESTS: FeatureRequest[] = [
    {
        id: "FR-201",
        title: "Dark mode for mobile app",
        description:
            "Implement a full dark mode theme across the mobile application. This should respect system preferences and allow manual toggle. All screens, modals, and components need to be themed consistently with proper contrast ratios for accessibility compliance.",
        votes: 342,
        requester: "Sarah Mitchell",
        status: "in_progress",
        category: "UI/UX",
        daysAgo: 3,
        voters: [
            { name: "Sarah Mitchell", avatarColor: "#6366f1" },
            { name: "James Rivera", avatarColor: "#0ea5e9" },
            { name: "Priya Sharma", avatarColor: "#ec4899" },
            { name: "Leo Chen", avatarColor: "#f59e0b" },
            { name: "Anna Koch", avatarColor: "#22c55e" }
        ],
        roadmapItem: "Q2 2026 - Mobile Polish"
    },
    {
        id: "FR-187",
        title: "Webhook support for third-party services",
        description:
            "Allow users to configure outgoing webhooks that fire on key events (task created, status changed, comment added). Should support custom headers, retry logic, and a delivery log for debugging failed payloads.",
        votes: 289,
        requester: "Marcus Chen",
        status: "planned",
        category: "Integrations",
        daysAgo: 12,
        voters: [
            { name: "Marcus Chen", avatarColor: "#8b5cf6" },
            { name: "Elena Volkov", avatarColor: "#14b8a6" },
            { name: "Derek Owens", avatarColor: "#f97316" }
        ],
        roadmapItem: "Q3 2026 - Platform APIs"
    },
    {
        id: "FR-215",
        title: "Bulk import/export via CSV",
        description:
            "Support importing and exporting data in CSV format. Users should be able to map columns during import, preview changes before applying, and handle duplicates gracefully. Export should support filtered views and custom field selection.",
        votes: 234,
        requester: "Diana Park",
        status: "under_review",
        category: "API",
        daysAgo: 1,
        voters: [
            { name: "Diana Park", avatarColor: "#ec4899" },
            { name: "Tom Walsh", avatarColor: "#6366f1" },
            { name: "Yuki Tanaka", avatarColor: "#0ea5e9" },
            { name: "Raj Patel", avatarColor: "#f59e0b" }
        ],
        roadmapItem: null
    },
    {
        id: "FR-198",
        title: "Real-time collaboration cursors",
        description:
            "Show other users' cursors and selections in real-time when editing shared documents or boards. Include presence indicators, user avatars near cursors, and smooth interpolation for cursor movement.",
        votes: 198,
        requester: "Alex Novak",
        status: "planned",
        category: "UI/UX",
        daysAgo: 8,
        voters: [
            { name: "Alex Novak", avatarColor: "#14b8a6" },
            { name: "Mia Torres", avatarColor: "#f97316" }
        ],
        roadmapItem: "Q2 2026 - Collaboration"
    },
    {
        id: "FR-222",
        title: "Push notification customization",
        description:
            "Let users choose which events trigger push notifications, set quiet hours, and configure per-project notification preferences. Include a notification preview before saving and batch digest options.",
        votes: 176,
        requester: "Jordan Blake",
        status: "under_review",
        category: "Mobile",
        daysAgo: 2,
        voters: [
            { name: "Jordan Blake", avatarColor: "#8b5cf6" },
            { name: "Chloe Martin", avatarColor: "#22c55e" },
            { name: "Kevin Zhao", avatarColor: "#ef4444" }
        ],
        roadmapItem: null
    },
    {
        id: "FR-173",
        title: "Two-factor authentication via TOTP",
        description:
            "Add support for time-based one-time passwords (TOTP) as a second factor. Users should be able to enroll via QR code, store backup codes, and manage their 2FA settings from the security panel.",
        votes: 156,
        requester: "Emily Sato",
        status: "shipped",
        category: "Security",
        daysAgo: 45,
        voters: [
            { name: "Emily Sato", avatarColor: "#6366f1" },
            { name: "Nils Bergman", avatarColor: "#0ea5e9" },
            { name: "Rosa Diaz", avatarColor: "#ec4899" },
            { name: "Felix Reuter", avatarColor: "#f59e0b" },
            { name: "Hana Kim", avatarColor: "#14b8a6" },
            { name: "David Chen", avatarColor: "#f97316" }
        ],
        roadmapItem: "Q1 2026 - Security"
    },
    {
        id: "FR-209",
        title: "GraphQL API endpoint",
        description:
            "Expose a GraphQL API alongside the existing REST API. Should support queries, mutations, subscriptions for real-time updates, and include comprehensive schema documentation with introspection enabled.",
        votes: 145,
        requester: "Ryan Kowalski",
        status: "under_review",
        category: "API",
        daysAgo: 5,
        voters: [
            { name: "Ryan Kowalski", avatarColor: "#8b5cf6" },
            { name: "Lena Fischer", avatarColor: "#22c55e" }
        ],
        roadmapItem: null
    },
    {
        id: "FR-231",
        title: "Offline mode with sync",
        description:
            "Enable the app to work offline with local data caching. Changes made offline should queue and sync automatically when connectivity is restored, with conflict resolution UI for simultaneous edits.",
        votes: 128,
        requester: "Nina Johansson",
        status: "planned",
        category: "Mobile",
        daysAgo: 6,
        voters: [
            { name: "Nina Johansson", avatarColor: "#ec4899" },
            { name: "Omar Hassan", avatarColor: "#6366f1" },
            { name: "Tara Singh", avatarColor: "#f59e0b" }
        ],
        roadmapItem: "Q4 2026 - Mobile Offline"
    },
    {
        id: "FR-244",
        title: "Page load performance dashboard",
        description:
            "Build an internal dashboard showing key performance metrics: page load times, time to interactive, bundle sizes, and API latency percentiles. Include historical trend charts and alerting thresholds.",
        votes: 112,
        requester: "Carlos Vega",
        status: "in_progress",
        category: "Performance",
        daysAgo: 10,
        voters: [
            { name: "Carlos Vega", avatarColor: "#14b8a6" },
            { name: "Jess Wu", avatarColor: "#f97316" }
        ],
        roadmapItem: "Q2 2026 - Observability"
    },
    {
        id: "FR-250",
        title: "Keyboard shortcuts cheat sheet",
        description:
            "Add a discoverable keyboard shortcuts overlay (Cmd+/) that lists all available shortcuts grouped by context. Allow users to customize bindings and show inline hints in menus.",
        votes: 95,
        requester: "Hugo Lindqvist",
        status: "shipped",
        category: "UI/UX",
        daysAgo: 30,
        voters: [
            { name: "Hugo Lindqvist", avatarColor: "#8b5cf6" },
            { name: "Grace Halloway", avatarColor: "#22c55e" }
        ],
        roadmapItem: "Q1 2026 - DX Improvements"
    }
];

const STATUS_CONFIG: Record<RequestStatus, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
    under_review: { label: "Under Review", color: "#d97706", icon: "eye-outline" },
    planned: { label: "Planned", color: "#6366f1", icon: "calendar-outline" },
    in_progress: { label: "In Progress", color: "#0ea5e9", icon: "code-slash-outline" },
    shipped: { label: "Shipped", color: "#22c55e", icon: "checkmark-circle-outline" }
};

const CATEGORY_COLORS: Record<Category, string> = {
    "UI/UX": "#8b5cf6",
    Performance: "#f97316",
    Integrations: "#0ea5e9",
    API: "#14b8a6",
    Mobile: "#ec4899",
    Security: "#ef4444"
};

const SORT_TABS: { key: SortTab; label: string }[] = [
    { key: "popular", label: "Popular" },
    { key: "recent", label: "Recent" },
    { key: "planned", label: "Planned" }
];

// --- Helpers ---

function getInitials(name: string): string {
    return name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

function formatVoteCount(count: number): string {
    if (count >= 1000) {
        return `${(count / 1000).toFixed(1)}k`;
    }
    return String(count);
}

function sortRequests(requests: FeatureRequest[], tab: SortTab): FeatureRequest[] {
    const sorted = [...requests];
    switch (tab) {
        case "popular":
            sorted.sort((a, b) => b.votes - a.votes);
            break;
        case "recent":
            sorted.sort((a, b) => a.daysAgo - b.daysAgo);
            break;
        case "planned":
            return sorted.filter((r) => r.status === "planned" || r.status === "in_progress");
    }
    return sorted;
}

// --- Segmented Control ---

function SegmentedControl({ active, onSelect }: { active: SortTab; onSelect: (tab: SortTab) => void }) {
    const { theme } = useUnistyles();

    return (
        <View style={[segStyles.container, { backgroundColor: theme.colors.surfaceContainerHighest }]}>
            {SORT_TABS.map(({ key, label }) => {
                const isActive = key === active;
                return (
                    <Pressable
                        key={key}
                        onPress={() => onSelect(key)}
                        style={[
                            segStyles.tab,
                            {
                                backgroundColor: isActive ? theme.colors.surface : "transparent"
                            }
                        ]}
                    >
                        <Text
                            style={[
                                segStyles.tabText,
                                {
                                    color: isActive ? theme.colors.onSurface : theme.colors.onSurfaceVariant,
                                    fontFamily: isActive ? "IBMPlexSans-SemiBold" : "IBMPlexSans-Regular"
                                }
                            ]}
                        >
                            {label}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

const segStyles = StyleSheet.create((theme) => ({
    container: {
        flexDirection: "row",
        borderRadius: 12,
        padding: 3,
        gap: 2
    },
    tab: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center"
    },
    tabText: {
        fontSize: 13,
        lineHeight: 18
    }
}));

// --- Summary Metrics ---

function SummaryMetrics({ requests }: { requests: FeatureRequest[] }) {
    const { theme } = useUnistyles();
    const totalVotes = requests.reduce((sum, r) => sum + r.votes, 0);
    const shipped = requests.filter((r) => r.status === "shipped").length;
    const inProgress = requests.filter((r) => r.status === "in_progress").length;

    const metrics = [
        { value: String(requests.length), label: "Requests", color: theme.colors.primary },
        { value: formatVoteCount(totalVotes), label: "Total Votes", color: "#8b5cf6" },
        { value: String(inProgress), label: "In Progress", color: "#0ea5e9" },
        { value: String(shipped), label: "Shipped", color: "#22c55e" }
    ];

    return (
        <View style={metricStyles.row}>
            {metrics.map(({ value, label, color }) => (
                <View key={label} style={[metricStyles.tile, { backgroundColor: theme.colors.surfaceContainer }]}>
                    <Text style={[metricStyles.value, { color }]}>{value}</Text>
                    <Text style={[metricStyles.label, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
                </View>
            ))}
        </View>
    );
}

const metricStyles = StyleSheet.create((theme) => ({
    row: {
        flexDirection: "row",
        gap: 8
    },
    tile: {
        flex: 1,
        borderRadius: 12,
        padding: 12,
        alignItems: "center",
        gap: 2
    },
    value: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 20,
        lineHeight: 26
    },
    label: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 10,
        lineHeight: 14
    }
}));

// --- Vote Button ---

function VoteButton({ votes, voted, onPress }: { votes: number; voted: boolean; onPress: () => void }) {
    const { theme } = useUnistyles();

    return (
        <Pressable
            onPress={onPress}
            style={[
                voteStyles.container,
                {
                    backgroundColor: voted ? `${theme.colors.primary}15` : theme.colors.surfaceContainerHighest,
                    borderColor: voted ? theme.colors.primary : "transparent",
                    borderWidth: 1
                }
            ]}
        >
            <Ionicons
                name={voted ? "caret-up" : "caret-up-outline"}
                size={18}
                color={voted ? theme.colors.primary : theme.colors.onSurfaceVariant}
            />
            <Text style={[voteStyles.count, { color: voted ? theme.colors.primary : theme.colors.onSurface }]}>
                {formatVoteCount(votes)}
            </Text>
        </Pressable>
    );
}

const voteStyles = StyleSheet.create((theme) => ({
    container: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 10,
        minWidth: 52,
        gap: 1
    },
    count: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 13,
        lineHeight: 18
    }
}));

// --- Status Chip ---

function StatusChip({ status }: { status: RequestStatus }) {
    const config = STATUS_CONFIG[status];

    return (
        <View style={[chipStyles.container, { backgroundColor: `${config.color}15` }]}>
            <Ionicons name={config.icon} size={12} color={config.color} />
            <Text style={[chipStyles.text, { color: config.color }]}>{config.label}</Text>
        </View>
    );
}

const chipStyles = StyleSheet.create((theme) => ({
    container: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10
    },
    text: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11,
        lineHeight: 16
    }
}));

// --- Category Badge ---

function CategoryBadge({ category }: { category: Category }) {
    const color = CATEGORY_COLORS[category];

    return (
        <View style={[badgeStyles.container, { borderColor: `${color}40` }]}>
            <View style={[badgeStyles.dot, { backgroundColor: color }]} />
            <Text style={[badgeStyles.text, { color }]}>{category}</Text>
        </View>
    );
}

const badgeStyles = StyleSheet.create((theme) => ({
    container: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        borderWidth: 1
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3
    },
    text: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 10,
        lineHeight: 14
    }
}));

// --- Feature Request Card ---

function FeatureRequestCard({
    request,
    voted,
    onVote,
    onPress
}: {
    request: FeatureRequest;
    voted: boolean;
    onVote: () => void;
    onPress: () => void;
}) {
    const { theme } = useUnistyles();

    return (
        <Pressable onPress={onPress} style={[cardStyles.container, { backgroundColor: theme.colors.surfaceContainer }]}>
            {/* Left: Vote button */}
            <VoteButton votes={request.votes} voted={voted} onPress={onVote} />

            {/* Right: Content */}
            <View style={cardStyles.content}>
                {/* Title row */}
                <Text style={[cardStyles.title, { color: theme.colors.onSurface }]} numberOfLines={2}>
                    {request.title}
                </Text>

                {/* Description preview */}
                <Text style={[cardStyles.desc, { color: theme.colors.onSurfaceVariant }]} numberOfLines={2}>
                    {request.description}
                </Text>

                {/* Tags row: status + category */}
                <View style={cardStyles.tagsRow}>
                    <StatusChip status={request.status} />
                    <CategoryBadge category={request.category} />
                </View>

                {/* Footer: requester + time */}
                <View style={cardStyles.footer}>
                    <View style={cardStyles.requesterRow}>
                        <View style={[cardStyles.requesterAvatar, { backgroundColor: `${theme.colors.primary}20` }]}>
                            <Text style={[cardStyles.requesterInitials, { color: theme.colors.primary }]}>
                                {getInitials(request.requester)}
                            </Text>
                        </View>
                        <Text style={[cardStyles.requesterName, { color: theme.colors.onSurfaceVariant }]}>
                            {request.requester}
                        </Text>
                    </View>
                    <Text style={[cardStyles.timeAgo, { color: theme.colors.onSurfaceVariant }]}>
                        {request.daysAgo === 0 ? "today" : request.daysAgo === 1 ? "1d ago" : `${request.daysAgo}d ago`}
                    </Text>
                </View>
            </View>
        </Pressable>
    );
}

const cardStyles = StyleSheet.create((theme) => ({
    container: {
        flexDirection: "row",
        borderRadius: 14,
        padding: 14,
        gap: 12
    },
    content: {
        flex: 1,
        gap: 8
    },
    title: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15,
        lineHeight: 20
    },
    desc: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 18
    },
    tagsRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap"
    },
    footer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 2
    },
    requesterRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6
    },
    requesterAvatar: {
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: "center",
        justifyContent: "center"
    },
    requesterInitials: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 9,
        lineHeight: 12
    },
    requesterName: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        lineHeight: 16
    },
    timeAgo: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11,
        lineHeight: 16
    }
}));

// --- Detail Panel (Modal) ---

function DetailPanel({
    request,
    visible,
    voted,
    onVote,
    onClose
}: {
    request: FeatureRequest | null;
    visible: boolean;
    voted: boolean;
    onVote: () => void;
    onClose: () => void;
}) {
    const { theme } = useUnistyles();

    if (!request) return null;

    const statusConfig = STATUS_CONFIG[request.status];

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={detailStyles.overlay}>
                <View style={[detailStyles.panel, { backgroundColor: theme.colors.surface }]}>
                    {/* Handle bar */}
                    <View style={detailStyles.handleRow}>
                        <View style={[detailStyles.handle, { backgroundColor: theme.colors.outlineVariant }]} />
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={detailStyles.scrollContent}>
                        {/* Header */}
                        <View style={detailStyles.header}>
                            <Text style={[detailStyles.idLabel, { color: theme.colors.onSurfaceVariant }]}>
                                {request.id}
                            </Text>
                            <Pressable onPress={onClose} hitSlop={12}>
                                <Ionicons name="close" size={24} color={theme.colors.onSurfaceVariant} />
                            </Pressable>
                        </View>

                        {/* Title */}
                        <Text style={[detailStyles.title, { color: theme.colors.onSurface }]}>{request.title}</Text>

                        {/* Vote bar */}
                        <View style={[detailStyles.voteBar, { backgroundColor: theme.colors.surfaceContainer }]}>
                            <Pressable
                                onPress={onVote}
                                style={[
                                    detailStyles.voteBtn,
                                    {
                                        backgroundColor: voted
                                            ? theme.colors.primary
                                            : theme.colors.surfaceContainerHighest
                                    }
                                ]}
                            >
                                <Ionicons
                                    name={voted ? "arrow-up" : "arrow-up-outline"}
                                    size={16}
                                    color={voted ? "#ffffff" : theme.colors.onSurface}
                                />
                                <Text
                                    style={[
                                        detailStyles.voteBtnText,
                                        { color: voted ? "#ffffff" : theme.colors.onSurface }
                                    ]}
                                >
                                    {voted ? "Voted" : "Upvote"}
                                </Text>
                            </Pressable>
                            <Text style={[detailStyles.voteCount, { color: theme.colors.onSurface }]}>
                                {request.votes} votes
                            </Text>
                        </View>

                        {/* Status + Category */}
                        <View style={detailStyles.metaRow}>
                            <View style={[detailStyles.statusPill, { backgroundColor: `${statusConfig.color}15` }]}>
                                <Ionicons name={statusConfig.icon} size={14} color={statusConfig.color} />
                                <Text style={[detailStyles.statusText, { color: statusConfig.color }]}>
                                    {statusConfig.label}
                                </Text>
                            </View>
                            <CategoryBadge category={request.category} />
                        </View>

                        {/* Description */}
                        <View style={detailStyles.section}>
                            <Text style={[detailStyles.sectionTitle, { color: theme.colors.onSurface }]}>
                                Description
                            </Text>
                            <Text style={[detailStyles.descriptionText, { color: theme.colors.onSurfaceVariant }]}>
                                {request.description}
                            </Text>
                        </View>

                        {/* Voters */}
                        <View style={detailStyles.section}>
                            <Text style={[detailStyles.sectionTitle, { color: theme.colors.onSurface }]}>
                                Voters ({request.voters.length})
                            </Text>
                            <View style={detailStyles.voterList}>
                                {request.voters.map((voter) => (
                                    <View key={voter.name} style={detailStyles.voterRow}>
                                        <View
                                            style={[
                                                detailStyles.voterAvatar,
                                                { backgroundColor: `${voter.avatarColor}20` }
                                            ]}
                                        >
                                            <Text style={[detailStyles.voterInitials, { color: voter.avatarColor }]}>
                                                {getInitials(voter.name)}
                                            </Text>
                                        </View>
                                        <Text style={[detailStyles.voterName, { color: theme.colors.onSurface }]}>
                                            {voter.name}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </View>

                        {/* Roadmap Link */}
                        {request.roadmapItem && (
                            <View style={detailStyles.section}>
                                <Text style={[detailStyles.sectionTitle, { color: theme.colors.onSurface }]}>
                                    Roadmap
                                </Text>
                                <View
                                    style={[
                                        detailStyles.roadmapCard,
                                        { backgroundColor: theme.colors.surfaceContainer }
                                    ]}
                                >
                                    <Ionicons name="map-outline" size={18} color={theme.colors.primary} />
                                    <Text style={[detailStyles.roadmapText, { color: theme.colors.onSurface }]}>
                                        {request.roadmapItem}
                                    </Text>
                                    <Ionicons
                                        name="open-outline"
                                        size={14}
                                        color={theme.colors.onSurfaceVariant}
                                        style={{ marginLeft: "auto" }}
                                    />
                                </View>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const detailStyles = StyleSheet.create((theme) => ({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.4)",
        justifyContent: "flex-end"
    },
    panel: {
        maxHeight: "85%",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: 32
    },
    handleRow: {
        alignItems: "center",
        paddingVertical: 10
    },
    handle: {
        width: 36,
        height: 4,
        borderRadius: 2
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 20,
        gap: 16
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    idLabel: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 13,
        lineHeight: 18
    },
    title: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 20,
        lineHeight: 26
    },
    voteBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderRadius: 12,
        padding: 10
    },
    voteBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 10
    },
    voteBtnText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 13,
        lineHeight: 18
    },
    voteCount: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 14,
        lineHeight: 20,
        marginRight: 6
    },
    metaRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10
    },
    statusPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12
    },
    statusText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 12,
        lineHeight: 16
    },
    section: {
        gap: 8
    },
    sectionTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 14,
        lineHeight: 20
    },
    descriptionText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14,
        lineHeight: 22
    },
    voterList: {
        gap: 8
    },
    voterRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10
    },
    voterAvatar: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: "center",
        justifyContent: "center"
    },
    voterInitials: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 11,
        lineHeight: 14
    },
    voterName: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 18
    },
    roadmapCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: 12,
        borderRadius: 12
    },
    roadmapText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13,
        lineHeight: 18
    }
}));

// --- Status Distribution Bar ---

function StatusDistributionBar() {
    const { theme } = useUnistyles();
    const total = REQUESTS.length;
    const statusOrder: RequestStatus[] = ["under_review", "planned", "in_progress", "shipped"];
    const counts = statusOrder.map((s) => ({
        status: s,
        count: REQUESTS.filter((r) => r.status === s).length
    }));

    return (
        <View style={[distStyles.container, { backgroundColor: theme.colors.surfaceContainer }]}>
            <Text style={[distStyles.title, { color: theme.colors.onSurface }]}>Status Overview</Text>
            <View style={distStyles.bar}>
                {counts.map(({ status, count }) => {
                    const pct = (count / total) * 100;
                    if (pct === 0) return null;
                    return (
                        <View
                            key={status}
                            style={{
                                backgroundColor: STATUS_CONFIG[status].color,
                                width: `${pct}%` as unknown as number,
                                height: "100%"
                            }}
                        />
                    );
                })}
            </View>
            <View style={distStyles.legend}>
                {counts.map(({ status, count }) => (
                    <View key={status} style={distStyles.legendItem}>
                        <View style={[distStyles.legendDot, { backgroundColor: STATUS_CONFIG[status].color }]} />
                        <Text style={[distStyles.legendText, { color: theme.colors.onSurfaceVariant }]}>
                            {STATUS_CONFIG[status].label} ({count})
                        </Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

const distStyles = StyleSheet.create((theme) => ({
    container: {
        borderRadius: 12,
        padding: 14,
        gap: 10
    },
    title: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13,
        lineHeight: 18
    },
    bar: {
        flexDirection: "row",
        height: 10,
        borderRadius: 5,
        overflow: "hidden"
    },
    legend: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12
    },
    legendItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5
    },
    legendDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5
    },
    legendText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11,
        lineHeight: 14
    }
}));

// --- Main Component ---

export function FeatureRequestsPage() {
    const { theme } = useUnistyles();
    const [activeTab, setActiveTab] = React.useState<SortTab>("popular");
    const [votedIds, setVotedIds] = React.useState<Set<string>>(new Set());
    const [selectedRequest, setSelectedRequest] = React.useState<FeatureRequest | null>(null);

    const toggleVote = React.useCallback((id: string) => {
        setVotedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    const sortedRequests = React.useMemo(() => sortRequests(REQUESTS, activeTab), [activeTab]);

    return (
        <View style={pageStyles.root}>
            <ScrollView
                style={{ flex: 1, backgroundColor: theme.colors.surface }}
                contentContainerStyle={pageStyles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Page title + icon */}
                <View style={pageStyles.titleRow}>
                    <View style={[pageStyles.titleIcon, { backgroundColor: `${theme.colors.primary}15` }]}>
                        <Ionicons name="bulb-outline" size={22} color={theme.colors.primary} />
                    </View>
                    <View style={pageStyles.titleTextCol}>
                        <Text style={[pageStyles.title, { color: theme.colors.onSurface }]}>Feature Requests</Text>
                        <Text style={[pageStyles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                            Vote on what gets built next
                        </Text>
                    </View>
                </View>

                {/* Summary metrics */}
                <SummaryMetrics requests={REQUESTS} />

                {/* Status distribution */}
                <StatusDistributionBar />

                {/* Segmented control */}
                <SegmentedControl active={activeTab} onSelect={setActiveTab} />

                {/* Request cards */}
                <View style={pageStyles.cardList}>
                    {sortedRequests.map((request) => (
                        <FeatureRequestCard
                            key={request.id}
                            request={request}
                            voted={votedIds.has(request.id)}
                            onVote={() => toggleVote(request.id)}
                            onPress={() => setSelectedRequest(request)}
                        />
                    ))}
                </View>

                {/* Empty state for planned tab */}
                {sortedRequests.length === 0 && (
                    <View style={pageStyles.emptyState}>
                        <Ionicons name="telescope-outline" size={44} color={theme.colors.onSurfaceVariant} />
                        <Text style={[pageStyles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                            No planned items yet
                        </Text>
                    </View>
                )}
            </ScrollView>

            {/* Detail panel modal */}
            <DetailPanel
                request={selectedRequest}
                visible={selectedRequest !== null}
                voted={selectedRequest ? votedIds.has(selectedRequest.id) : false}
                onVote={() => {
                    if (selectedRequest) toggleVote(selectedRequest.id);
                }}
                onClose={() => setSelectedRequest(null)}
            />
        </View>
    );
}

const pageStyles = StyleSheet.create((theme) => ({
    root: {
        flex: 1
    },
    scrollContent: {
        maxWidth: theme.layout.maxWidth,
        width: "100%",
        alignSelf: "center",
        padding: 16,
        gap: 16,
        paddingBottom: 40
    },
    titleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        marginBottom: 4
    },
    titleIcon: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center"
    },
    titleTextCol: {
        flex: 1,
        gap: 2
    },
    title: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 22,
        lineHeight: 28
    },
    subtitle: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 18
    },
    cardList: {
        gap: 10
    },
    emptyState: {
        alignItems: "center",
        paddingVertical: 48,
        gap: 12
    },
    emptyText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 15,
        lineHeight: 20
    }
}));
