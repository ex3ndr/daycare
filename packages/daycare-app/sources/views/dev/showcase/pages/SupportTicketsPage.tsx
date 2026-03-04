import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

// --- Types ---

type Priority = "urgent" | "high" | "normal" | "low";
type Channel = "email" | "chat" | "phone";
type SlaStatus = "within" | "approaching" | "breached";

type Ticket = {
    id: string;
    ticketNumber: string;
    subject: string;
    customer: string;
    channel: Channel;
    priority: Priority;
    ageMins: number;
    sla: SlaStatus;
    unread: boolean;
    assignee: string;
    preview: string;
};

// --- Mock data ---

const TICKETS: Ticket[] = [
    {
        id: "1",
        ticketNumber: "TKT-4091",
        subject: "Payment gateway timeout on checkout",
        customer: "Sarah Mitchell",
        channel: "chat",
        priority: "urgent",
        ageMins: 12,
        sla: "breached",
        unread: true,
        assignee: "Alex R.",
        preview: "I keep getting a timeout error when I try to complete my purchase. Already tried three times..."
    },
    {
        id: "2",
        ticketNumber: "TKT-4088",
        subject: "Unable to reset password after email change",
        customer: "James Chen",
        channel: "email",
        priority: "urgent",
        ageMins: 45,
        sla: "breached",
        unread: true,
        assignee: "Maria L.",
        preview: "Changed my email last week and now the reset link goes to the old address. Locked out of account."
    },
    {
        id: "3",
        ticketNumber: "TKT-4095",
        subject: "API rate limit exceeded unexpectedly",
        customer: "DevCorp Inc.",
        channel: "email",
        priority: "urgent",
        ageMins: 8,
        sla: "approaching",
        unread: true,
        assignee: "Alex R.",
        preview: "Our integration hit the rate limit at only 500 req/min, well below our 2000 tier."
    },
    {
        id: "4",
        ticketNumber: "TKT-4082",
        subject: "Billing discrepancy on annual plan renewal",
        customer: "Lisa Fernandez",
        channel: "phone",
        priority: "high",
        ageMins: 120,
        sla: "approaching",
        unread: false,
        assignee: "Tom K.",
        preview: "Was charged $299 instead of $249 annual rate. Need immediate refund of the difference."
    },
    {
        id: "5",
        ticketNumber: "TKT-4093",
        subject: "Dashboard widgets not loading after update",
        customer: "Robert Nakamura",
        channel: "chat",
        priority: "high",
        ageMins: 35,
        sla: "within",
        unread: true,
        assignee: "Maria L.",
        preview: "Since the update yesterday none of my custom dashboard widgets render. Blank cards everywhere."
    },
    {
        id: "6",
        ticketNumber: "TKT-4087",
        subject: "Export CSV generates corrupt file",
        customer: "Amanda Torres",
        channel: "email",
        priority: "high",
        ageMins: 180,
        sla: "within",
        unread: false,
        assignee: "Alex R.",
        preview: "The CSV export for the orders report has garbled characters in the product name column."
    },
    {
        id: "7",
        ticketNumber: "TKT-4079",
        subject: "SSO login redirect loop on Firefox",
        customer: "Pinnacle Systems",
        channel: "email",
        priority: "high",
        ageMins: 300,
        sla: "approaching",
        unread: false,
        assignee: "Tom K.",
        preview: "Our team on Firefox gets stuck in a redirect loop when attempting SSO login."
    },
    {
        id: "8",
        ticketNumber: "TKT-4096",
        subject: "Feature request: bulk tag assignment",
        customer: "Diana Okafor",
        channel: "chat",
        priority: "normal",
        ageMins: 15,
        sla: "within",
        unread: true,
        assignee: "Maria L.",
        preview: "Would love the ability to select multiple contacts and assign tags in bulk."
    },
    {
        id: "9",
        ticketNumber: "TKT-4085",
        subject: "Notification preferences not saving",
        customer: "Kevin Park",
        channel: "email",
        priority: "normal",
        ageMins: 240,
        sla: "within",
        unread: false,
        assignee: "Alex R.",
        preview: "Every time I toggle off email notifications and save, it reverts back to enabled."
    },
    {
        id: "10",
        ticketNumber: "TKT-4090",
        subject: "Mobile app crashes on image upload",
        customer: "Priya Gupta",
        channel: "phone",
        priority: "normal",
        ageMins: 90,
        sla: "within",
        unread: false,
        assignee: "Tom K.",
        preview: "App force-closes whenever I try to attach a photo from the gallery on my Android."
    },
    {
        id: "11",
        ticketNumber: "TKT-4094",
        subject: "Search doesn't match partial terms",
        customer: "Marco Rossi",
        channel: "chat",
        priority: "normal",
        ageMins: 20,
        sla: "within",
        unread: true,
        assignee: "Maria L.",
        preview: "Searching for 'inv' does not return 'invoice' results. Only exact matches seem to work."
    },
    {
        id: "12",
        ticketNumber: "TKT-4076",
        subject: "Typo in onboarding wizard step 3",
        customer: "Emma Johansson",
        channel: "email",
        priority: "low",
        ageMins: 1440,
        sla: "within",
        unread: false,
        assignee: "Alex R.",
        preview: "There's a typo that reads 'Confrim' instead of 'Confirm' in the third onboarding step."
    },
    {
        id: "13",
        ticketNumber: "TKT-4080",
        subject: "Color contrast issue on disabled buttons",
        customer: "Andre Williams",
        channel: "chat",
        priority: "low",
        ageMins: 720,
        sla: "within",
        unread: false,
        assignee: "Tom K.",
        preview: "Disabled buttons are almost invisible in dark mode. The text is nearly the same shade."
    },
    {
        id: "14",
        ticketNumber: "TKT-4073",
        subject: "Tooltip overlaps dropdown on narrow screens",
        customer: "Yuki Tanaka",
        channel: "email",
        priority: "low",
        ageMins: 2880,
        sla: "within",
        unread: false,
        assignee: "Maria L.",
        preview: "When the browser is narrow, the helper tooltip covers the dropdown menu completely."
    }
];

const PRIORITY_ORDER: Priority[] = ["urgent", "high", "normal", "low"];

const PRIORITY_COLORS: Record<Priority, string> = {
    urgent: "#dc2626",
    high: "#ea580c",
    normal: "#2563eb",
    low: "#6b7280"
};

const PRIORITY_ICONS: Record<Priority, keyof typeof Ionicons.glyphMap> = {
    urgent: "flash-outline",
    high: "arrow-up-circle-outline",
    normal: "remove-circle-outline",
    low: "arrow-down-circle-outline"
};

const CHANNEL_ICONS: Record<Channel, keyof typeof Ionicons.glyphMap> = {
    email: "mail-outline",
    chat: "chatbubble-outline",
    phone: "call-outline"
};

const CHANNEL_LABELS: Record<Channel, string> = {
    email: "Email",
    chat: "Chat",
    phone: "Phone"
};

const SLA_LABELS: Record<SlaStatus, string> = {
    within: "Within SLA",
    approaching: "Approaching",
    breached: "Breached"
};

// --- Helpers ---

function formatAge(mins: number): string {
    if (mins < 60) return `${mins}m`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h`;
    return `${Math.floor(mins / 1440)}d`;
}

function getInitials(name: string): string {
    return name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

// --- Metric Card ---

function MetricCard({
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
        <View style={[metricStyles.card, { backgroundColor: theme.colors.surfaceContainer }]}>
            <View style={[metricStyles.iconWrap, { backgroundColor: `${accentColor}18` }]}>
                <Ionicons name={icon} size={18} color={accentColor} />
            </View>
            <Text style={[metricStyles.value, { color: theme.colors.onSurface }]}>{value}</Text>
            <Text style={[metricStyles.label, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
        </View>
    );
}

const metricStyles = StyleSheet.create((theme) => ({
    card: {
        flex: 1,
        borderRadius: 12,
        padding: 12,
        gap: 6,
        alignItems: "flex-start"
    },
    iconWrap: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center"
    },
    value: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 22,
        lineHeight: 26
    },
    label: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11,
        lineHeight: 14,
        letterSpacing: 0.3
    }
}));

// --- SLA Badge ---

function SlaBadge({ status }: { status: SlaStatus }) {
    const { theme } = useUnistyles();

    const colorMap: Record<SlaStatus, { bg: string; fg: string }> = {
        within: { bg: "#16a34a20", fg: "#16a34a" },
        approaching: { bg: "#d9770620", fg: "#d97706" },
        breached: { bg: `${theme.colors.error}20`, fg: theme.colors.error }
    };
    const c = colorMap[status];

    return (
        <View style={[slaStyles.badge, { backgroundColor: c.bg }]}>
            <View style={[slaStyles.dot, { backgroundColor: c.fg }]} />
            <Text style={[slaStyles.text, { color: c.fg }]}>{SLA_LABELS[status]}</Text>
        </View>
    );
}

const slaStyles = StyleSheet.create((theme) => ({
    badge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3
    },
    text: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 10,
        lineHeight: 14,
        letterSpacing: 0.2
    }
}));

// --- Channel Chip ---

function ChannelChip({ channel }: { channel: Channel }) {
    const { theme } = useUnistyles();

    return (
        <View style={[channelStyles.chip, { backgroundColor: theme.colors.surfaceContainerHighest }]}>
            <Ionicons name={CHANNEL_ICONS[channel]} size={12} color={theme.colors.onSurfaceVariant} />
            <Text style={[channelStyles.text, { color: theme.colors.onSurfaceVariant }]}>
                {CHANNEL_LABELS[channel]}
            </Text>
        </View>
    );
}

const channelStyles = StyleSheet.create((theme) => ({
    chip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 8
    },
    text: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11,
        lineHeight: 14
    }
}));

// --- Priority Group Header ---

function PriorityGroupHeader({ priority, count }: { priority: Priority; count: number }) {
    const { theme } = useUnistyles();
    const color = PRIORITY_COLORS[priority];
    const icon = PRIORITY_ICONS[priority];
    const label = priority.charAt(0).toUpperCase() + priority.slice(1);

    return (
        <View style={groupStyles.header}>
            <View style={[groupStyles.iconWrap, { backgroundColor: `${color}18` }]}>
                <Ionicons name={icon} size={16} color={color} />
            </View>
            <Text style={[groupStyles.label, { color: theme.colors.onSurface }]}>{label}</Text>
            <View style={[groupStyles.countBadge, { backgroundColor: `${color}22` }]}>
                <Text style={[groupStyles.countText, { color }]}>{count}</Text>
            </View>
            <View style={[groupStyles.line, { backgroundColor: `${color}30` }]} />
        </View>
    );
}

const groupStyles = StyleSheet.create((theme) => ({
    header: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginTop: 8
    },
    iconWrap: {
        width: 28,
        height: 28,
        borderRadius: 7,
        alignItems: "center",
        justifyContent: "center"
    },
    label: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 14,
        lineHeight: 20
    },
    countBadge: {
        paddingHorizontal: 7,
        paddingVertical: 1,
        borderRadius: 8,
        minWidth: 22,
        alignItems: "center"
    },
    countText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11,
        lineHeight: 16
    },
    line: {
        flex: 1,
        height: 1,
        marginLeft: 4
    }
}));

// --- Ticket Row ---

function TicketRow({
    ticket,
    isExpanded,
    onPress,
    onMarkRead,
    priorityColor
}: {
    ticket: Ticket;
    isExpanded: boolean;
    onPress: () => void;
    onMarkRead: () => void;
    priorityColor: string;
}) {
    const { theme } = useUnistyles();

    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                rowStyles.container,
                { backgroundColor: theme.colors.surfaceContainer },
                pressed && { opacity: 0.85 }
            ]}
        >
            {/* Left priority accent */}
            <View style={[rowStyles.accentBar, { backgroundColor: priorityColor }]} />

            <View style={rowStyles.content}>
                {/* Top row: unread dot, ticket number, SLA badge */}
                <View style={rowStyles.topRow}>
                    <View style={rowStyles.topLeft}>
                        {ticket.unread && (
                            <View style={[rowStyles.unreadDot, { backgroundColor: theme.colors.primary }]} />
                        )}
                        <Text style={[rowStyles.ticketNumber, { color: theme.colors.onSurfaceVariant }]}>
                            {ticket.ticketNumber}
                        </Text>
                        <ChannelChip channel={ticket.channel} />
                    </View>
                    <SlaBadge status={ticket.sla} />
                </View>

                {/* Subject */}
                <Text
                    style={[
                        rowStyles.subject,
                        { color: theme.colors.onSurface },
                        ticket.unread && rowStyles.subjectUnread
                    ]}
                    numberOfLines={isExpanded ? undefined : 1}
                >
                    {ticket.subject}
                </Text>

                {/* Bottom row: customer, age */}
                <View style={rowStyles.bottomRow}>
                    <View style={rowStyles.customerRow}>
                        <View style={[rowStyles.avatar, { backgroundColor: `${priorityColor}20` }]}>
                            <Text style={[rowStyles.avatarText, { color: priorityColor }]}>
                                {getInitials(ticket.customer)}
                            </Text>
                        </View>
                        <Text
                            style={[rowStyles.customerName, { color: theme.colors.onSurfaceVariant }]}
                            numberOfLines={1}
                        >
                            {ticket.customer}
                        </Text>
                    </View>
                    <View style={rowStyles.ageWrap}>
                        <Ionicons name="time-outline" size={12} color={theme.colors.onSurfaceVariant} />
                        <Text style={[rowStyles.ageText, { color: theme.colors.onSurfaceVariant }]}>
                            {formatAge(ticket.ageMins)}
                        </Text>
                    </View>
                </View>

                {/* Expanded detail */}
                {isExpanded && (
                    <View style={[rowStyles.expandedArea, { borderTopColor: theme.colors.outlineVariant }]}>
                        <Text style={[rowStyles.previewText, { color: theme.colors.onSurfaceVariant }]}>
                            {ticket.preview}
                        </Text>
                        <View style={rowStyles.expandedMeta}>
                            <View style={rowStyles.assigneeRow}>
                                <Ionicons name="person-outline" size={13} color={theme.colors.onSurfaceVariant} />
                                <Text style={[rowStyles.assigneeText, { color: theme.colors.onSurfaceVariant }]}>
                                    {ticket.assignee}
                                </Text>
                            </View>
                            {ticket.unread && (
                                <Pressable
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        onMarkRead();
                                    }}
                                    style={({ pressed }) => [
                                        rowStyles.markReadBtn,
                                        { backgroundColor: theme.colors.primary },
                                        pressed && { opacity: 0.8 }
                                    ]}
                                >
                                    <Ionicons name="checkmark-outline" size={13} color="#ffffff" />
                                    <Text style={rowStyles.markReadText}>Mark Read</Text>
                                </Pressable>
                            )}
                        </View>
                    </View>
                )}
            </View>
        </Pressable>
    );
}

const rowStyles = StyleSheet.create((theme) => ({
    container: {
        borderRadius: 12,
        overflow: "hidden",
        flexDirection: "row"
    },
    accentBar: {
        width: 4
    },
    content: {
        flex: 1,
        padding: 12,
        gap: 6
    },
    topRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    topLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4
    },
    ticketNumber: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 12,
        lineHeight: 16
    },
    subject: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14,
        lineHeight: 20
    },
    subjectUnread: {
        fontFamily: "IBMPlexSans-SemiBold"
    },
    bottomRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    customerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        flex: 1,
        marginRight: 8
    },
    avatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center"
    },
    avatarText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 9,
        lineHeight: 12
    },
    customerName: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        lineHeight: 16,
        flex: 1
    },
    ageWrap: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4
    },
    ageText: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11,
        lineHeight: 14
    },
    expandedArea: {
        borderTopWidth: 1,
        marginTop: 6,
        paddingTop: 10,
        gap: 10
    },
    previewText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 19
    },
    expandedMeta: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    assigneeRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5
    },
    assigneeText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        lineHeight: 16
    },
    markReadBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8
    },
    markReadText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        lineHeight: 16,
        color: "#ffffff"
    }
}));

// --- Filter Pills ---

function FilterPills({ active, onSelect }: { active: Priority | "all"; onSelect: (tab: Priority | "all") => void }) {
    const { theme } = useUnistyles();
    const tabs: { key: Priority | "all"; label: string; count: number }[] = [
        { key: "all", label: "All", count: TICKETS.length },
        ...PRIORITY_ORDER.map((p) => ({
            key: p as Priority | "all",
            label: p.charAt(0).toUpperCase() + p.slice(1),
            count: TICKETS.filter((t) => t.priority === p).length
        }))
    ];

    return (
        <View style={filterStyles.row}>
            {tabs.map(({ key, label, count }) => {
                const isActive = active === key;
                const accentColor = key === "all" ? theme.colors.primary : PRIORITY_COLORS[key as Priority];
                return (
                    <Pressable
                        key={key}
                        onPress={() => onSelect(key)}
                        style={[
                            filterStyles.pill,
                            {
                                backgroundColor: isActive ? accentColor : theme.colors.surfaceContainer,
                                borderColor: isActive ? accentColor : theme.colors.outlineVariant,
                                borderWidth: 1
                            }
                        ]}
                    >
                        <Text
                            style={[
                                filterStyles.pillText,
                                { color: isActive ? "#ffffff" : theme.colors.onSurfaceVariant }
                            ]}
                        >
                            {label}
                        </Text>
                        <View
                            style={[
                                filterStyles.pillCount,
                                {
                                    backgroundColor: isActive ? "rgba(255,255,255,0.25)" : `${accentColor}18`
                                }
                            ]}
                        >
                            <Text style={[filterStyles.pillCountText, { color: isActive ? "#ffffff" : accentColor }]}>
                                {count}
                            </Text>
                        </View>
                    </Pressable>
                );
            })}
        </View>
    );
}

const filterStyles = StyleSheet.create((theme) => ({
    row: {
        flexDirection: "row",
        gap: 6,
        flexWrap: "wrap"
    },
    pill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingLeft: 12,
        paddingRight: 6,
        paddingVertical: 6,
        borderRadius: 20
    },
    pillText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        lineHeight: 16
    },
    pillCount: {
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 10,
        minWidth: 20,
        alignItems: "center"
    },
    pillCountText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 10,
        lineHeight: 14
    }
}));

// --- Summary Bar ---

function SummaryBar({ tickets }: { tickets: Ticket[] }) {
    const { theme } = useUnistyles();

    const unreadCount = tickets.filter((t) => t.unread).length;
    const breachedCount = tickets.filter((t) => t.sla === "breached").length;
    const approachingCount = tickets.filter((t) => t.sla === "approaching").length;

    return (
        <View style={[summaryStyles.container, { backgroundColor: theme.colors.surfaceContainer }]}>
            <View style={summaryStyles.item}>
                <View style={[summaryStyles.dot, { backgroundColor: theme.colors.primary }]} />
                <Text style={[summaryStyles.text, { color: theme.colors.onSurfaceVariant }]}>{unreadCount} unread</Text>
            </View>
            <View style={[summaryStyles.divider, { backgroundColor: theme.colors.outlineVariant }]} />
            <View style={summaryStyles.item}>
                <View style={[summaryStyles.dot, { backgroundColor: theme.colors.error }]} />
                <Text style={[summaryStyles.text, { color: theme.colors.onSurfaceVariant }]}>
                    {breachedCount} breached
                </Text>
            </View>
            <View style={[summaryStyles.divider, { backgroundColor: theme.colors.outlineVariant }]} />
            <View style={summaryStyles.item}>
                <View style={[summaryStyles.dot, { backgroundColor: "#d97706" }]} />
                <Text style={[summaryStyles.text, { color: theme.colors.onSurfaceVariant }]}>
                    {approachingCount} approaching
                </Text>
            </View>
        </View>
    );
}

const summaryStyles = StyleSheet.create((theme) => ({
    container: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 14
    },
    item: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6
    },
    dot: {
        width: 7,
        height: 7,
        borderRadius: 3.5
    },
    text: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        lineHeight: 16
    },
    divider: {
        width: 1,
        height: 14
    }
}));

// --- Main Component ---

export function SupportTicketsPage() {
    const { theme } = useUnistyles();
    const [tickets, setTickets] = React.useState<Ticket[]>(TICKETS);
    const [activeFilter, setActiveFilter] = React.useState<Priority | "all">("all");
    const [expandedId, setExpandedId] = React.useState<string | null>(null);

    const openCount = tickets.length;
    const avgResponseMins = Math.round(tickets.reduce((sum, t) => sum + t.ageMins, 0) / tickets.length);
    const closedToday = 18;
    const csat = "4.6";

    const filteredTickets = activeFilter === "all" ? tickets : tickets.filter((t) => t.priority === activeFilter);

    const handleMarkRead = React.useCallback((id: string) => {
        setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, unread: false } : t)));
    }, []);

    const handleToggleExpand = React.useCallback((id: string) => {
        setExpandedId((prev) => (prev === id ? null : id));
    }, []);

    // Group by priority for "all" view
    const grouped = React.useMemo(() => {
        if (activeFilter !== "all") return null;
        const groups: { priority: Priority; tickets: Ticket[] }[] = [];
        for (const priority of PRIORITY_ORDER) {
            const group = tickets.filter((t) => t.priority === priority);
            if (group.length > 0) {
                groups.push({ priority, tickets: group });
            }
        }
        return groups;
    }, [activeFilter, tickets]);

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: theme.colors.surface }}
            contentContainerStyle={pageStyles.scrollContent}
            showsVerticalScrollIndicator={false}
        >
            {/* Metrics Row */}
            <View style={pageStyles.metricsRow}>
                <MetricCard
                    icon="ticket-outline"
                    value={String(openCount)}
                    label="Open Tickets"
                    accentColor={theme.colors.primary}
                />
                <MetricCard
                    icon="timer-outline"
                    value={formatAge(avgResponseMins)}
                    label="Avg Response"
                    accentColor="#d97706"
                />
                <MetricCard icon="star-outline" value={csat} label="CSAT Score" accentColor="#16a34a" />
                <MetricCard
                    icon="checkmark-circle-outline"
                    value={String(closedToday)}
                    label="Closed Today"
                    accentColor={theme.colors.tertiary}
                />
            </View>

            {/* SLA Summary Bar */}
            <SummaryBar tickets={tickets} />

            {/* Filter Pills */}
            <FilterPills active={activeFilter} onSelect={setActiveFilter} />

            {/* Grouped Ticket List */}
            {activeFilter === "all" && grouped
                ? grouped.map((group) => (
                      <View key={group.priority} style={pageStyles.group}>
                          <PriorityGroupHeader priority={group.priority} count={group.tickets.length} />
                          <View style={pageStyles.ticketList}>
                              {group.tickets.map((ticket) => (
                                  <TicketRow
                                      key={ticket.id}
                                      ticket={ticket}
                                      isExpanded={expandedId === ticket.id}
                                      onPress={() => handleToggleExpand(ticket.id)}
                                      onMarkRead={() => handleMarkRead(ticket.id)}
                                      priorityColor={PRIORITY_COLORS[ticket.priority]}
                                  />
                              ))}
                          </View>
                      </View>
                  ))
                : activeFilter !== "all" && (
                      <View style={pageStyles.ticketList}>
                          {filteredTickets.map((ticket) => (
                              <TicketRow
                                  key={ticket.id}
                                  ticket={ticket}
                                  isExpanded={expandedId === ticket.id}
                                  onPress={() => handleToggleExpand(ticket.id)}
                                  onMarkRead={() => handleMarkRead(ticket.id)}
                                  priorityColor={PRIORITY_COLORS[ticket.priority]}
                              />
                          ))}
                      </View>
                  )}
        </ScrollView>
    );
}

const pageStyles = StyleSheet.create((theme) => ({
    scrollContent: {
        maxWidth: theme.layout.maxWidth,
        width: "100%",
        alignSelf: "center",
        padding: 16,
        gap: 16,
        paddingBottom: 40
    },
    metricsRow: {
        flexDirection: "row",
        gap: 8
    },
    group: {
        gap: 10
    },
    ticketList: {
        gap: 8
    }
}));
