import { Ionicons } from "@expo/vector-icons";
import { Text, TextInput, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Card } from "@/components/Card";
import { Row } from "@/components/Row";
import { ShowcasePage } from "@/views/dev/showcase/components/ShowcasePage";

// --- Types ---

type MeetingType = "standup" | "1:1" | "planning" | "retro";

type Meeting = {
    id: string;
    title: string;
    dateLabel: string;
    attendeeInitials: string[];
    attendeeOverflow: number;
    type: MeetingType;
    actionItems: number;
};

type MeetingGroup = {
    title: string;
    meetings: Meeting[];
};

// --- Mock data ---

const meetingGroups: MeetingGroup[] = [
    {
        title: "This Week",
        meetings: [
            {
                id: "1",
                title: "Daily Standup",
                dateLabel: "Tue, Mar 3 \u00B7 9:00 AM",
                attendeeInitials: ["JK", "SM", "AL"],
                attendeeOverflow: 4,
                type: "standup",
                actionItems: 2
            },
            {
                id: "2",
                title: "1:1 with Sarah",
                dateLabel: "Tue, Mar 3 \u00B7 11:00 AM",
                attendeeInitials: ["SM"],
                attendeeOverflow: 0,
                type: "1:1",
                actionItems: 3
            },
            {
                id: "3",
                title: "Product Planning Q2",
                dateLabel: "Mon, Mar 2 \u00B7 2:00 PM",
                attendeeInitials: ["JK", "RB", "NT"],
                attendeeOverflow: 5,
                type: "planning",
                actionItems: 7
            },
            {
                id: "4",
                title: "Daily Standup",
                dateLabel: "Mon, Mar 2 \u00B7 9:00 AM",
                attendeeInitials: ["JK", "SM", "AL"],
                attendeeOverflow: 4,
                type: "standup",
                actionItems: 1
            }
        ]
    },
    {
        title: "Last Week",
        meetings: [
            {
                id: "5",
                title: "Sprint 23 Retrospective",
                dateLabel: "Fri, Feb 27 \u00B7 3:00 PM",
                attendeeInitials: ["JK", "SM", "RB"],
                attendeeOverflow: 3,
                type: "retro",
                actionItems: 5
            },
            {
                id: "6",
                title: "1:1 with Marcus",
                dateLabel: "Thu, Feb 26 \u00B7 10:00 AM",
                attendeeInitials: ["ML"],
                attendeeOverflow: 0,
                type: "1:1",
                actionItems: 2
            },
            {
                id: "7",
                title: "Daily Standup",
                dateLabel: "Wed, Feb 25 \u00B7 9:00 AM",
                attendeeInitials: ["JK", "AL", "NT"],
                attendeeOverflow: 4,
                type: "standup",
                actionItems: 0
            },
            {
                id: "8",
                title: "Design Review: Onboarding",
                dateLabel: "Tue, Feb 24 \u00B7 1:00 PM",
                attendeeInitials: ["RB", "SM", "KP"],
                attendeeOverflow: 2,
                type: "planning",
                actionItems: 4
            }
        ]
    },
    {
        title: "February 2026",
        meetings: [
            {
                id: "9",
                title: "Sprint 22 Retrospective",
                dateLabel: "Fri, Feb 13 \u00B7 3:00 PM",
                attendeeInitials: ["JK", "SM", "RB"],
                attendeeOverflow: 3,
                type: "retro",
                actionItems: 6
            },
            {
                id: "10",
                title: "Roadmap Planning H1",
                dateLabel: "Wed, Feb 11 \u00B7 10:00 AM",
                attendeeInitials: ["JK", "NT", "ML"],
                attendeeOverflow: 8,
                type: "planning",
                actionItems: 12
            },
            {
                id: "11",
                title: "1:1 with Sarah",
                dateLabel: "Tue, Feb 10 \u00B7 11:00 AM",
                attendeeInitials: ["SM"],
                attendeeOverflow: 0,
                type: "1:1",
                actionItems: 1
            },
            {
                id: "12",
                title: "Daily Standup",
                dateLabel: "Mon, Feb 9 \u00B7 9:00 AM",
                attendeeInitials: ["JK", "SM", "AL"],
                attendeeOverflow: 4,
                type: "standup",
                actionItems: 0
            }
        ]
    }
];

// --- Meeting type colors ---

const TIMELINE_LEFT = 32;
const DOT_SIZE = 12;
const CONNECTOR_LENGTH = 20;
const typeColors: Record<MeetingType, string> = {
    standup: "#3B82F6",
    "1:1": "#22C55E",
    planning: "#8B5CF6",
    retro: "#F59E0B"
};

const typeLabels: Record<MeetingType, string> = {
    standup: "Standup",
    "1:1": "1:1",
    planning: "Planning",
    retro: "Retro"
};

// --- Inline components ---

function SearchBar() {
    const { theme } = useUnistyles();
    return (
        <View style={styles.searchContainer}>
            <View style={styles.searchInputWrapper(theme.colors.surfaceContainerHighest)}>
                <Ionicons name="search" size={18} color={theme.colors.onSurfaceVariant} style={styles.searchIcon} />
                <TextInput
                    placeholder="Search meetings..."
                    style={styles.searchInput(theme.colors.onSurface)}
                    placeholderTextColor={theme.colors.onSurfaceVariant}
                />
            </View>
        </View>
    );
}

function WeekSeparator({ label }: { label: string }) {
    const { theme } = useUnistyles();
    return (
        <View style={styles.separatorContainer}>
            <View style={styles.separatorLine(theme.colors.outlineVariant)} />
            <View style={styles.separatorLabelBox(theme.colors.surfaceContainer)}>
                <Text style={styles.separatorLabel(theme.colors.onSurfaceVariant)}>{label}</Text>
            </View>
            <View style={styles.separatorLine(theme.colors.outlineVariant)} />
        </View>
    );
}

function AttendeeAvatars({ initials, overflow }: { initials: string[]; overflow: number }) {
    const { theme } = useUnistyles();
    return (
        <View style={styles.avatarsRow}>
            {initials.map((initial, idx) => (
                <View key={`${initial}-avatar`} style={styles.avatar(idx, theme.colors.surface, theme.colors.primary)}>
                    <Text style={styles.avatarText(theme.colors.primary)}>{initial}</Text>
                </View>
            ))}
            {overflow > 0 && (
                <View style={styles.avatarOverflow(initials.length, theme.colors.surface)}>
                    <Text style={styles.avatarOverflowText}>+{overflow}</Text>
                </View>
            )}
        </View>
    );
}

function MeetingTypeChip({ type }: { type: MeetingType }) {
    const color = typeColors[type];
    return (
        <View style={styles.chip(color)}>
            <Text style={styles.chipText(color)}>{typeLabels[type]}</Text>
        </View>
    );
}

function ActionBadge({ count }: { count: number }) {
    const { theme } = useUnistyles();
    if (count === 0) return null;
    return (
        <View style={styles.actionBadge(theme.colors.tertiary)}>
            <Text style={styles.actionBadgeText(theme.colors.tertiary)}>
                {"\u2713"} {count} actions
            </Text>
        </View>
    );
}

function TimelineDot({ type }: { type: MeetingType }) {
    const color = typeColors[type];
    return <View style={styles.dot(color)} />;
}

function ConnectorLine() {
    const { theme } = useUnistyles();
    return <View style={styles.connector(theme.colors.outlineVariant)} />;
}

function MeetingCard({ meeting }: { meeting: Meeting }) {
    const { theme } = useUnistyles();
    return (
        <Card style={styles.card(theme.colors.surfaceContainer, theme.colors.outlineVariant)}>
            {/* Top row: title and type chip */}
            <Row trailing={<MeetingTypeChip type={meeting.type} />} style={styles.cardTopRow}>
                <Text style={styles.cardTitle(theme.colors.onSurface)} numberOfLines={1}>
                    {meeting.title}
                </Text>
            </Row>

            {/* Date */}
            <Text style={styles.cardDate(theme.colors.onSurfaceVariant)}>{meeting.dateLabel}</Text>

            {/* Bottom row: avatars and action badge */}
            <View style={styles.cardBottomRow}>
                <AttendeeAvatars initials={meeting.attendeeInitials} overflow={meeting.attendeeOverflow} />
                <ActionBadge count={meeting.actionItems} />
            </View>
        </Card>
    );
}

function TimelineEntry({ meeting, isLast }: { meeting: Meeting; isLast: boolean }) {
    const { theme } = useUnistyles();
    return (
        <View style={styles.entryContainer}>
            {/* Vertical timeline segment */}
            <View style={styles.timelineColumn}>
                <TimelineDot type={meeting.type} />
                {!isLast && <View style={styles.timelineSegment(theme.colors.outlineVariant)} />}
            </View>

            {/* Connector + Card */}
            <View style={styles.cardColumn}>
                <ConnectorLine />
                <View style={styles.cardWrapper}>
                    <MeetingCard meeting={meeting} />
                </View>
            </View>
        </View>
    );
}

// --- Main component ---

export function MeetingNotesPage() {
    const { theme } = useUnistyles();

    return (
        <ShowcasePage style={styles.root(theme.colors.surface)} edgeToEdge>
            <SearchBar />

            {meetingGroups.map((group, groupIdx) => (
                <View key={group.title}>
                    <WeekSeparator label={group.title} />

                    {group.meetings.map((meeting, meetingIdx) => {
                        // isLast means last meeting in this group AND last group
                        const isLastInGroup = meetingIdx === group.meetings.length - 1;
                        const isLastGroup = groupIdx === meetingGroups.length - 1;
                        const isLast = isLastInGroup && isLastGroup;

                        return <TimelineEntry key={meeting.id} meeting={meeting} isLast={isLast} />;
                    })}
                </View>
            ))}

            {/* Bottom spacing */}
            <View style={styles.bottomSpacer} />
        </ShowcasePage>
    );
}

// --- Styles ---

const styles = StyleSheet.create((_theme) => ({
    root: (bg: string) => ({
        flex: 1,
        backgroundColor: bg
    }),
    // Search
    searchContainer: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8
    },
    searchInputWrapper: (bg: string) => ({
        flexDirection: "row" as const,
        alignItems: "center" as const,
        backgroundColor: bg,
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 42
    }),
    searchIcon: {
        marginRight: 8
    },
    searchInput: (color: string) => ({
        flex: 1,
        fontFamily: "IBMPlexSans-Regular" as const,
        fontSize: 15,
        color: color,
        paddingVertical: 0
    }),

    // Week separator
    separatorContainer: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        paddingHorizontal: 16,
        marginTop: 20,
        marginBottom: 16
    },
    separatorLine: (color: string) => ({
        flex: 1,
        height: 1,
        backgroundColor: color
    }),
    separatorLabelBox: (bg: string) => ({
        paddingHorizontal: 12,
        paddingVertical: 4,
        backgroundColor: bg,
        borderRadius: 12
    }),
    separatorLabel: (color: string) => ({
        fontFamily: "IBMPlexSans-SemiBold" as const,
        fontSize: 12,
        color: color,
        textTransform: "uppercase" as const,
        letterSpacing: 0.8
    }),

    // Timeline entry
    entryContainer: {
        flexDirection: "row" as const,
        paddingLeft: 16,
        minHeight: 100
    },
    timelineColumn: {
        width: TIMELINE_LEFT,
        alignItems: "center" as const,
        paddingTop: 14
    },
    dot: (color: string) => ({
        width: DOT_SIZE,
        height: DOT_SIZE,
        borderRadius: DOT_SIZE / 2,
        backgroundColor: color,
        zIndex: 2
    }),
    timelineSegment: (color: string) => ({
        width: 2,
        flex: 1,
        backgroundColor: color,
        marginTop: -1
    }),
    cardColumn: {
        flex: 1,
        flexDirection: "row" as const,
        alignItems: "flex-start" as const,
        paddingTop: 16,
        paddingBottom: 8,
        paddingRight: 16
    },
    connector: (color: string) => ({
        width: CONNECTOR_LENGTH,
        height: 2,
        backgroundColor: color,
        marginTop: 4
    }),
    cardWrapper: {
        flex: 1
    },

    // Card
    card: (bg: string, border: string) => ({
        backgroundColor: bg,
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: border
    }),
    cardTopRow: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "space-between" as const,
        marginBottom: 4
    },
    cardTitle: (color: string) => ({
        fontFamily: "IBMPlexSans-SemiBold" as const,
        fontSize: 15,
        color: color,
        flex: 1,
        marginRight: 8
    }),
    cardDate: (color: string) => ({
        fontFamily: "IBMPlexSans-Regular" as const,
        fontSize: 13,
        color: color,
        marginBottom: 10
    }),
    cardBottomRow: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "space-between" as const
    },

    // Attendee avatars
    avatarsRow: {
        flexDirection: "row" as const,
        alignItems: "center" as const
    },
    avatar: (idx: number, borderColor: string, bgBase: string) => ({
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: `${bgBase}20`,
        alignItems: "center" as const,
        justifyContent: "center" as const,
        marginLeft: idx > 0 ? -8 : 0,
        borderWidth: 2,
        borderColor: borderColor,
        zIndex: 10 - idx
    }),
    avatarText: (color: string) => ({
        fontSize: 9,
        fontFamily: "IBMPlexSans-SemiBold" as const,
        color: color
    }),
    avatarOverflow: (count: number, borderColor: string) => ({
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: "#94a3b8",
        alignItems: "center" as const,
        justifyContent: "center" as const,
        marginLeft: count > 0 ? -8 : 0,
        borderWidth: 2,
        borderColor: borderColor,
        zIndex: 0
    }),
    avatarOverflowText: {
        fontSize: 9,
        fontFamily: "IBMPlexSans-SemiBold" as const,
        color: "white"
    },

    // Chips
    chip: (color: string) => ({
        backgroundColor: `${color}18`,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12
    }),
    chipText: (color: string) => ({
        fontFamily: "IBMPlexSans-Medium" as const,
        fontSize: 11,
        color: color
    }),

    // Action badge
    actionBadge: (color: string) => ({
        flexDirection: "row" as const,
        alignItems: "center" as const,
        backgroundColor: `${color}15`,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10
    }),
    actionBadgeText: (color: string) => ({
        fontFamily: "IBMPlexSans-Medium" as const,
        fontSize: 11,
        color: color
    }),

    // Bottom spacer
    bottomSpacer: {
        height: 40
    }
}));
