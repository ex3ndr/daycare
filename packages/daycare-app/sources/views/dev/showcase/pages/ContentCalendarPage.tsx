import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { ShowcasePage } from "@/views/dev/showcase/components/ShowcasePage";

// --- Types ---

type Platform = "blog" | "twitter" | "linkedin" | "newsletter";
type Status = "draft" | "scheduled" | "published";

type ContentItem = {
    id: string;
    title: string;
    author: string;
    platform: Platform;
    status: Status;
};

type DayData = {
    dayName: string;
    dateNum: number;
    items: ContentItem[];
};

// --- Constants ---

const PLATFORM_COLORS: Record<Platform, string> = {
    blog: "#3b82f6",
    twitter: "#0ea5e9",
    linkedin: "#1d4ed8",
    newsletter: "#7c3aed"
};

const PLATFORM_LABELS: Record<Platform, string> = {
    blog: "Blog",
    twitter: "Twitter",
    linkedin: "LinkedIn",
    newsletter: "Newsletter"
};

const STATUS_COLORS: Record<Status, string> = {
    draft: "#9ca3af",
    scheduled: "#f59e0b",
    published: "#22c55e"
};

const STATUS_LABELS: Record<Status, string> = {
    draft: "Draft",
    scheduled: "Scheduled",
    published: "Published"
};

const ALL_PLATFORMS: Platform[] = ["blog", "twitter", "linkedin", "newsletter"];

// --- Mock data: 12 items across 5 weekdays ---

const WEEK_DATA: DayData[] = [
    {
        dayName: "Mon",
        dateNum: 3,
        items: [
            {
                id: "1",
                title: "Q1 Product Update Blog Post",
                author: "Sarah Chen",
                platform: "blog",
                status: "published"
            },
            {
                id: "2",
                title: "New Feature Announcement Thread",
                author: "Mark Rivera",
                platform: "twitter",
                status: "published"
            }
        ]
    },
    {
        dayName: "Tue",
        dateNum: 4,
        items: [
            {
                id: "3",
                title: "Engineering Culture Deep Dive",
                author: "Alex Kim",
                platform: "linkedin",
                status: "scheduled"
            },
            {
                id: "4",
                title: "Weekly Product Digest #47",
                author: "Sarah Chen",
                platform: "newsletter",
                status: "scheduled"
            },
            {
                id: "5",
                title: "Customer Success Story: Acme Corp",
                author: "Priya Patel",
                platform: "blog",
                status: "draft"
            }
        ]
    },
    {
        dayName: "Wed",
        dateNum: 5,
        items: [
            {
                id: "6",
                title: "API v2 Migration Guide",
                author: "Mark Rivera",
                platform: "blog",
                status: "draft"
            },
            {
                id: "7",
                title: "Industry Trends Poll",
                author: "Alex Kim",
                platform: "twitter",
                status: "scheduled"
            }
        ]
    },
    {
        dayName: "Thu",
        dateNum: 6,
        items: [
            {
                id: "8",
                title: "Hiring: Senior Engineers Spotlight",
                author: "Priya Patel",
                platform: "linkedin",
                status: "draft"
            },
            {
                id: "9",
                title: "March Community Roundup",
                author: "Sarah Chen",
                platform: "newsletter",
                status: "draft"
            }
        ]
    },
    {
        dayName: "Fri",
        dateNum: 7,
        items: [
            {
                id: "10",
                title: "Behind the Scenes: Design Process",
                author: "Alex Kim",
                platform: "blog",
                status: "scheduled"
            },
            {
                id: "11",
                title: "Weekend Reading Recommendations",
                author: "Mark Rivera",
                platform: "twitter",
                status: "draft"
            },
            {
                id: "12",
                title: "Partner Announcement: CloudSync",
                author: "Priya Patel",
                platform: "linkedin",
                status: "scheduled"
            }
        ]
    }
];

const TODAY_DATE = 3; // March 3

// --- Content card within a day column ---

function ContentCard({ item }: { item: ContentItem }) {
    const platformColor = PLATFORM_COLORS[item.platform];
    const statusColor = STATUS_COLORS[item.status];

    return (
        <View style={cardStyles.container(platformColor)}>
            <View style={cardStyles.statusDot(statusColor)} />
            <Text style={cardStyles.title} numberOfLines={2}>
                {item.title}
            </Text>
            <Text style={cardStyles.author} numberOfLines={1}>
                {item.author}
            </Text>
        </View>
    );
}

const cardStyles = StyleSheet.create((theme) => ({
    container: (borderColor: string) => ({
        backgroundColor: theme.colors.surface,
        borderLeftWidth: 3,
        borderLeftColor: borderColor,
        borderRadius: 6,
        padding: 8,
        marginBottom: 6,
        position: "relative" as const
    }),
    statusDot: (color: string) => ({
        position: "absolute" as const,
        top: 8,
        right: 8,
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: color
    }),
    title: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 12,
        color: theme.colors.onSurface,
        lineHeight: 16,
        paddingRight: 16
    },
    author: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 10,
        color: theme.colors.onSurfaceVariant,
        marginTop: 4
    }
}));

// --- Day column ---

function DayColumn({ day, isToday, filtered }: { day: DayData; isToday: boolean; filtered: ContentItem[] }) {
    const { theme } = useUnistyles();

    return (
        <View style={columnStyles.container}>
            {/* Day header */}
            <View style={columnStyles.header}>
                <Text style={columnStyles.dayName}>{day.dayName}</Text>
                <View style={[columnStyles.dateCircle, isToday && columnStyles.dateCirleToday(theme.colors.primary)]}>
                    <Text style={[columnStyles.dateNum, isToday && columnStyles.dateNumToday(theme.colors.onPrimary)]}>
                        {day.dateNum}
                    </Text>
                </View>
            </View>
            {/* Content cards */}
            <View style={columnStyles.cardArea}>
                {filtered.length === 0 ? (
                    <View style={columnStyles.emptySlot}>
                        <Ionicons name="remove-outline" size={14} color={theme.colors.outlineVariant} />
                    </View>
                ) : (
                    filtered.map((item) => <ContentCard key={item.id} item={item} />)
                )}
            </View>
        </View>
    );
}

const columnStyles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        minWidth: 0
    },
    header: {
        alignItems: "center",
        paddingBottom: 8,
        gap: 4
    },
    dayName: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11,
        color: theme.colors.onSurfaceVariant,
        textTransform: "uppercase",
        letterSpacing: 0.5
    },
    dateCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center"
    },
    dateCirleToday: (color: string) => ({
        backgroundColor: color
    }),
    dateNum: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 13,
        color: theme.colors.onSurface
    },
    dateNumToday: (color: string) => ({
        color: color
    }),
    cardArea: {
        gap: 0
    },
    emptySlot: {
        alignItems: "center",
        paddingVertical: 12
    }
}));

// --- Platform filter pill ---

function PlatformPill({
    platform,
    label,
    active,
    onPress
}: {
    platform: Platform | "all";
    label: string;
    active: boolean;
    onPress: () => void;
}) {
    const { theme } = useUnistyles();
    const pillColor = platform === "all" ? theme.colors.primary : PLATFORM_COLORS[platform];

    return (
        <Pressable
            onPress={onPress}
            style={[
                pillStyles.pill,
                active
                    ? pillStyles.pillActive(pillColor)
                    : pillStyles.pillInactive(theme.colors.surfaceContainerHighest)
            ]}
        >
            <Text style={[pillStyles.pillText, { color: active ? "#ffffff" : theme.colors.onSurfaceVariant }]}>
                {label}
            </Text>
        </Pressable>
    );
}

const pillStyles = StyleSheet.create((theme) => ({
    pill: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 16
    },
    pillActive: (color: string) => ({
        backgroundColor: color
    }),
    pillInactive: (bg: string) => ({
        backgroundColor: bg
    }),
    pillText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13
    }
}));

// --- Legend section ---

function Legend() {
    const { theme } = useUnistyles();

    return (
        <View style={legendStyles.container(theme.colors.surfaceContainer)}>
            {/* Platform colors */}
            <View style={legendStyles.row}>
                <Text style={legendStyles.label(theme.colors.onSurfaceVariant)}>Platforms:</Text>
                {ALL_PLATFORMS.map((p) => (
                    <View key={p} style={legendStyles.entry}>
                        <View style={legendStyles.colorSwatch(PLATFORM_COLORS[p])} />
                        <Text style={legendStyles.entryText(theme.colors.onSurface)}>{PLATFORM_LABELS[p]}</Text>
                    </View>
                ))}
            </View>
            {/* Status colors */}
            <View style={legendStyles.row}>
                <Text style={legendStyles.label(theme.colors.onSurfaceVariant)}>Status:</Text>
                {(Object.keys(STATUS_COLORS) as Status[]).map((s) => (
                    <View key={s} style={legendStyles.entry}>
                        <View style={legendStyles.statusDot(STATUS_COLORS[s])} />
                        <Text style={legendStyles.entryText(theme.colors.onSurface)}>{STATUS_LABELS[s]}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

const legendStyles = StyleSheet.create((theme) => ({
    container: (bg: string) => ({
        backgroundColor: bg,
        borderRadius: 10,
        padding: 12,
        gap: 8
    }),
    row: {
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 10
    },
    label: (color: string) => ({
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11,
        color: color,
        marginRight: 2
    }),
    entry: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4
    },
    colorSwatch: (color: string) => ({
        width: 12,
        height: 8,
        borderRadius: 2,
        backgroundColor: color
    }),
    statusDot: (color: string) => ({
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: color
    }),
    entryText: (color: string) => ({
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11,
        color: color
    })
}));

// --- Main component ---

export function ContentCalendarPage() {
    const { theme } = useUnistyles();
    const [weekOffset, setWeekOffset] = React.useState(0);
    const [activePlatform, setActivePlatform] = React.useState<Platform | "all">("all");

    // Compute displayed week label
    const baseDate = new Date(2026, 2, 3); // March 3, 2026
    const weekStart = new Date(baseDate.getTime() + weekOffset * 7 * 24 * 60 * 60 * 1000);
    const monthNames = ["Jan", "Feb", "March", "April", "May", "June", "July", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const weekLabel = `Week of ${monthNames[weekStart.getMonth()]} ${weekStart.getDate()}`;

    // Filter items by platform
    const filteredDays = WEEK_DATA.map((day) => ({
        ...day,
        filtered: activePlatform === "all" ? day.items : day.items.filter((i) => i.platform === activePlatform)
    }));

    return (
        <ShowcasePage contentContainerStyle={{ paddingTop: 16, paddingBottom: 16, gap: 16 }}>
            {/* Platform filter pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                <PlatformPill
                    platform="all"
                    label="All"
                    active={activePlatform === "all"}
                    onPress={() => setActivePlatform("all")}
                />
                {ALL_PLATFORMS.map((p) => (
                    <PlatformPill
                        key={p}
                        platform={p}
                        label={PLATFORM_LABELS[p]}
                        active={activePlatform === p}
                        onPress={() => setActivePlatform(p)}
                    />
                ))}
            </ScrollView>

            {/* Week navigation header */}
            <View style={styles.weekNav}>
                <Pressable
                    onPress={() => setWeekOffset((o) => o - 1)}
                    style={styles.navArrow(theme.colors.surfaceContainerHighest)}
                >
                    <Ionicons name="chevron-back" size={18} color={theme.colors.onSurface} />
                </Pressable>
                <Text style={styles.weekLabel(theme.colors.onSurface)}>{weekLabel}</Text>
                <Pressable
                    onPress={() => setWeekOffset((o) => o + 1)}
                    style={styles.navArrow(theme.colors.surfaceContainerHighest)}
                >
                    <Ionicons name="chevron-forward" size={18} color={theme.colors.onSurface} />
                </Pressable>
            </View>

            {/* Calendar grid: 5 day columns */}
            <View style={styles.calendarGrid(theme.colors.surfaceContainer)}>
                {filteredDays.map((day, idx) => (
                    <React.Fragment key={day.dayName}>
                        {idx > 0 && <View style={styles.columnDivider(theme.colors.outlineVariant)} />}
                        <DayColumn
                            day={day}
                            isToday={weekOffset === 0 && day.dateNum === TODAY_DATE}
                            filtered={day.filtered}
                        />
                    </React.Fragment>
                ))}
            </View>

            {/* Legend */}
            <Legend />
        </ShowcasePage>
    );
}

const styles = StyleSheet.create((theme) => ({
    filterRow: {
        flexDirection: "row",
        gap: 8,
        paddingVertical: 2
    },
    weekNav: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 16
    },
    navArrow: (bg: string) => ({
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: bg,
        alignItems: "center" as const,
        justifyContent: "center" as const
    }),
    weekLabel: (color: string) => ({
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 16,
        color: color
    }),
    calendarGrid: (bg: string) => ({
        flexDirection: "row" as const,
        backgroundColor: bg,
        borderRadius: 12,
        padding: 10,
        gap: 6
    }),
    columnDivider: (color: string) => ({
        width: 1,
        backgroundColor: color,
        marginVertical: 4
    })
}));
