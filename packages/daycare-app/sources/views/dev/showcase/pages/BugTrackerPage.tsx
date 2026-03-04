import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { ShowcasePage } from "@/views/dev/showcase/components/ShowcasePage";

// --- Types ---

type Severity = "critical" | "high" | "medium" | "low";
type Status = "open" | "in_progress" | "fixed";
type FilterTab = "all" | Severity;

type Bug = {
    id: string;
    title: string;
    reporter: string;
    component: string;
    ageDays: number;
    severity: Severity;
    status: Status;
};

// --- Mock data ---

const BUGS: Bug[] = [
    {
        id: "BUG-101",
        title: "App crashes when uploading files > 10MB",
        reporter: "Alice Chen",
        component: "Upload",
        ageDays: 2,
        severity: "critical",
        status: "in_progress"
    },
    {
        id: "BUG-108",
        title: "Database connection pool exhausted under load",
        reporter: "Carlos Diaz",
        component: "Backend",
        ageDays: 1,
        severity: "critical",
        status: "open"
    },
    {
        id: "BUG-114",
        title: "Payment processing fails for international cards",
        reporter: "Diana Park",
        component: "Payments",
        ageDays: 3,
        severity: "critical",
        status: "open"
    },
    {
        id: "BUG-118",
        title: "Auth token leak in error response headers",
        reporter: "Tom Reed",
        component: "Security",
        ageDays: 0,
        severity: "critical",
        status: "open"
    },
    {
        id: "BUG-102",
        title: "Dark mode toggle doesn't persist after restart",
        reporter: "Bob Miller",
        component: "Settings",
        ageDays: 5,
        severity: "high",
        status: "open"
    },
    {
        id: "BUG-105",
        title: "Push notifications not delivered on Android 14",
        reporter: "Eve Santos",
        component: "Notifications",
        ageDays: 8,
        severity: "high",
        status: "in_progress"
    },
    {
        id: "BUG-109",
        title: "Search results missing recently created items",
        reporter: "Frank Liu",
        component: "Search",
        ageDays: 4,
        severity: "high",
        status: "open"
    },
    {
        id: "BUG-112",
        title: "Session token not refreshed before expiry",
        reporter: "Grace Kim",
        component: "Auth",
        ageDays: 6,
        severity: "high",
        status: "fixed"
    },
    {
        id: "BUG-103",
        title: "Profile avatar cropper cuts off edges",
        reporter: "Hank Novak",
        component: "Profile",
        ageDays: 12,
        severity: "medium",
        status: "open"
    },
    {
        id: "BUG-106",
        title: "Date picker shows wrong month on locale change",
        reporter: "Ivy Tran",
        component: "Calendar",
        ageDays: 9,
        severity: "medium",
        status: "in_progress"
    },
    {
        id: "BUG-110",
        title: "CSV export truncates long field values",
        reporter: "Jake Owen",
        component: "Export",
        ageDays: 15,
        severity: "medium",
        status: "open"
    },
    {
        id: "BUG-104",
        title: "Tooltip flickers on rapid hover",
        reporter: "Leo Barnes",
        component: "UI",
        ageDays: 20,
        severity: "low",
        status: "open"
    },
    {
        id: "BUG-107",
        title: "Footer links misaligned on tablet landscape",
        reporter: "Mia Russo",
        component: "Layout",
        ageDays: 18,
        severity: "low",
        status: "open"
    },
    {
        id: "BUG-111",
        title: "Placeholder text color too faint in light mode",
        reporter: "Nick Hale",
        component: "Theme",
        ageDays: 25,
        severity: "low",
        status: "fixed"
    }
];

const SEVERITY_COLORS: Record<Severity, string> = {
    critical: "#dc2626",
    high: "#ea580c",
    medium: "#d97706",
    low: "#2563eb"
};

const SEVERITY_ICONS: Record<Severity, keyof typeof Ionicons.glyphMap> = {
    critical: "flame-outline",
    high: "alert-circle-outline",
    medium: "warning-outline",
    low: "information-circle-outline"
};

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

const STATUS_LABELS: Record<Status, string> = {
    open: "Open",
    in_progress: "In Progress",
    fixed: "Fixed"
};

function getInitials(name: string): string {
    return name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

function countBySeverity(severity: Severity): number {
    return BUGS.filter((b) => b.severity === severity).length;
}

// --- Metric Tile ---

function MetricTile({ value, label, color, pulse }: { value: string; label: string; color: string; pulse?: boolean }) {
    const { theme } = useUnistyles();

    return (
        <View style={[tileStyles.container, { backgroundColor: theme.colors.surfaceContainer }]}>
            <View style={tileStyles.valueRow}>
                {pulse && (
                    <View style={tileStyles.pulseOuter(color)}>
                        <View style={tileStyles.pulseInner(color)} />
                    </View>
                )}
                <Text style={tileStyles.value(color)}>{value}</Text>
            </View>
            <Text style={[tileStyles.label, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
        </View>
    );
}

const tileStyles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        borderRadius: 12,
        padding: 14,
        gap: 4
    },
    valueRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    pulseOuter: (color: string) => ({
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: `${color}30`,
        alignItems: "center" as const,
        justifyContent: "center" as const
    }),
    pulseInner: (color: string) => ({
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: color
    }),
    value: (color: string) => ({
        fontFamily: "IBMPlexSans-SemiBold" as const,
        fontSize: 22,
        lineHeight: 28,
        color
    }),
    label: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        lineHeight: 16
    }
}));

// --- Severity Bar ---

function SeverityBar() {
    const { theme } = useUnistyles();
    const total = BUGS.length;
    const counts = SEVERITY_ORDER.map((s) => ({ severity: s, count: countBySeverity(s) }));

    return (
        <View style={[barStyles.container, { backgroundColor: theme.colors.surfaceContainer }]}>
            <Text style={[barStyles.title, { color: theme.colors.onSurface }]}>Severity Distribution</Text>
            <View style={barStyles.bar}>
                {counts.map(({ severity, count }) => {
                    const pct = (count / total) * 100;
                    if (pct === 0) return null;
                    return <View key={severity} style={barStyles.segment(SEVERITY_COLORS[severity], pct)} />;
                })}
            </View>
            <View style={barStyles.legend}>
                {counts.map(({ severity, count }) => (
                    <View key={severity} style={barStyles.legendItem}>
                        <View style={barStyles.legendDot(SEVERITY_COLORS[severity])} />
                        <Text style={[barStyles.legendText, { color: theme.colors.onSurfaceVariant }]}>
                            {severity.charAt(0).toUpperCase() + severity.slice(1)} ({count})
                        </Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

const barStyles = StyleSheet.create((theme) => ({
    container: {
        borderRadius: 12,
        padding: 16,
        gap: 12
    },
    title: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 14,
        lineHeight: 20
    },
    bar: {
        flexDirection: "row",
        height: 14,
        borderRadius: 7,
        overflow: "hidden"
    },
    segment: (color: string, pct: number) => ({
        backgroundColor: color,
        width: `${pct}%` as unknown as number
    }),
    legend: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 14
    },
    legendItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5
    },
    legendDot: (color: string) => ({
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: color
    }),
    legendText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        lineHeight: 16
    }
}));

// --- Filter Pills ---

function FilterPills({ active, onSelect }: { active: FilterTab; onSelect: (tab: FilterTab) => void }) {
    const { theme } = useUnistyles();
    const tabs: { key: FilterTab; label: string }[] = [
        { key: "all", label: "All" },
        { key: "critical", label: "Critical" },
        { key: "high", label: "High" },
        { key: "medium", label: "Medium" },
        { key: "low", label: "Low" }
    ];

    return (
        <View style={pillStyles.row}>
            {tabs.map(({ key, label }) => {
                const isActive = active === key;
                const accentColor = key === "all" ? theme.colors.primary : SEVERITY_COLORS[key];
                return (
                    <Pressable
                        key={key}
                        onPress={() => onSelect(key)}
                        style={[
                            pillStyles.pill,
                            {
                                backgroundColor: isActive ? accentColor : theme.colors.surfaceContainer
                            }
                        ]}
                    >
                        <Text
                            style={[
                                pillStyles.pillText,
                                {
                                    color: isActive ? "#ffffff" : theme.colors.onSurfaceVariant
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

const pillStyles = StyleSheet.create((theme) => ({
    row: {
        flexDirection: "row",
        gap: 8,
        flexWrap: "wrap"
    },
    pill: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20
    },
    pillText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13,
        lineHeight: 18
    }
}));

// --- Status Badge ---

function StatusBadge({ status }: { status: Status }) {
    const { theme } = useUnistyles();

    const map: Record<Status, { bg: string; fg: string }> = {
        open: { bg: `${theme.colors.error}18`, fg: theme.colors.error },
        in_progress: { bg: `${theme.colors.primary}18`, fg: theme.colors.primary },
        fixed: { bg: "#16a34a18", fg: "#16a34a" }
    };
    const c = map[status];

    return (
        <View style={statusStyles.badge(c.bg)}>
            <Text style={statusStyles.text(c.fg)}>{STATUS_LABELS[status]}</Text>
        </View>
    );
}

const statusStyles = StyleSheet.create((theme) => ({
    badge: (bg: string) => ({
        backgroundColor: bg,
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: 10
    }),
    text: (color: string) => ({
        fontFamily: "IBMPlexSans-Medium" as const,
        fontSize: 11,
        lineHeight: 16,
        color
    })
}));

// --- Bug Card ---

function BugCard({ bug }: { bug: Bug }) {
    const { theme } = useUnistyles();
    const color = SEVERITY_COLORS[bug.severity];
    const initials = getInitials(bug.reporter);

    return (
        <View style={[cardStyles.outer, { backgroundColor: theme.colors.surfaceContainer }]}>
            {/* Colored top border */}
            <View style={cardStyles.topBorder(color)} />

            <View style={cardStyles.body}>
                {/* Left accent strip */}
                <View style={cardStyles.leftStrip(color)} />

                <View style={cardStyles.content}>
                    {/* Header: Bug ID + Status */}
                    <View style={cardStyles.header}>
                        <Text style={[cardStyles.bugId, { color: theme.colors.onSurfaceVariant }]}>{bug.id}</Text>
                        <StatusBadge status={bug.status} />
                    </View>

                    {/* Title */}
                    <Text style={[cardStyles.title, { color: theme.colors.onSurface }]} numberOfLines={2}>
                        {bug.title}
                    </Text>

                    {/* Footer: Reporter, Component, Age */}
                    <View style={cardStyles.footer}>
                        <View style={cardStyles.avatar(color)}>
                            <Text style={cardStyles.avatarText}>{initials}</Text>
                        </View>
                        <View style={[cardStyles.chip, { backgroundColor: theme.colors.surfaceContainerHighest }]}>
                            <Text style={[cardStyles.chipText, { color: theme.colors.onSurfaceVariant }]}>
                                {bug.component}
                            </Text>
                        </View>
                        <Text style={[cardStyles.age, { color: theme.colors.onSurfaceVariant }]}>{bug.ageDays}d</Text>
                    </View>
                </View>
            </View>
        </View>
    );
}

const cardStyles = StyleSheet.create((theme) => ({
    outer: {
        borderRadius: 12,
        overflow: "hidden"
    },
    topBorder: (color: string) => ({
        height: 3,
        backgroundColor: color
    }),
    body: {
        flexDirection: "row"
    },
    leftStrip: (color: string) => ({
        width: 4,
        backgroundColor: `${color}50`
    }),
    content: {
        flex: 1,
        padding: 14,
        gap: 10
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    bugId: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 12,
        lineHeight: 16
    },
    title: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 14,
        lineHeight: 20
    },
    footer: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10
    },
    avatar: (color: string) => ({
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: `${color}25`,
        alignItems: "center" as const,
        justifyContent: "center" as const
    }),
    avatarText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 10,
        lineHeight: 14,
        color: "#ffffff"
    },
    chip: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8
    },
    chipText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11,
        lineHeight: 16
    },
    age: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11,
        lineHeight: 16,
        marginLeft: "auto"
    }
}));

// --- Severity Group Header ---

function SeverityGroupHeader({ severity }: { severity: Severity }) {
    const { theme } = useUnistyles();
    const color = SEVERITY_COLORS[severity];
    const icon = SEVERITY_ICONS[severity];
    const count = countBySeverity(severity);

    return (
        <View style={groupStyles.header}>
            <Ionicons name={icon} size={18} color={color} />
            <Text style={[groupStyles.headerText, { color: theme.colors.onSurface }]}>
                {severity.charAt(0).toUpperCase() + severity.slice(1)}
            </Text>
            <View style={groupStyles.countBadge(color)}>
                <Text style={groupStyles.countText}>{count}</Text>
            </View>
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
    headerText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15,
        lineHeight: 22
    },
    countBadge: (color: string) => ({
        backgroundColor: `${color}20`,
        paddingHorizontal: 7,
        paddingVertical: 1,
        borderRadius: 8
    }),
    countText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11,
        lineHeight: 16,
        color: "#ffffff"
    }
}));

// --- Main Component ---

export function BugTrackerPage() {
    const { theme } = useUnistyles();
    const [activeFilter, setActiveFilter] = React.useState<FilterTab>("all");

    const filteredBugs = activeFilter === "all" ? BUGS : BUGS.filter((b) => b.severity === activeFilter);

    // Group bugs by severity for "all" view
    const groupedBugs = React.useMemo(() => {
        if (activeFilter !== "all") return null;
        const groups: { severity: Severity; bugs: Bug[] }[] = [];
        for (const severity of SEVERITY_ORDER) {
            const bugs = BUGS.filter((b) => b.severity === severity);
            if (bugs.length > 0) {
                groups.push({ severity, bugs });
            }
        }
        return groups;
    }, [activeFilter]);

    return (
        <ShowcasePage style={{ flex: 1, backgroundColor: theme.colors.surface }} topInset={16} contentGap={16}>
            {/* Metrics Row */}
            <View style={pageStyles.metricsRow}>
                <MetricTile value="23" label="Open" color={theme.colors.primary} />
                <MetricTile value="4" label="Critical" color={theme.colors.error} pulse />
                <MetricTile value="3.2d" label="Avg Time" color={theme.colors.tertiary} />
                <MetricTile value="87%" label="Fix Rate" color="#16a34a" />
            </View>

            {/* Severity Distribution */}
            <SeverityBar />

            {/* Filter Tabs */}
            <FilterPills active={activeFilter} onSelect={setActiveFilter} />

            {/* Bug Cards */}
            {activeFilter === "all" && groupedBugs
                ? groupedBugs.map((group) => (
                      <View key={group.severity} style={pageStyles.group}>
                          <SeverityGroupHeader severity={group.severity} />
                          <View style={pageStyles.cardList}>
                              {group.bugs.map((bug) => (
                                  <BugCard key={bug.id} bug={bug} />
                              ))}
                          </View>
                      </View>
                  ))
                : activeFilter !== "all" && (
                      <View style={pageStyles.cardList}>
                          {filteredBugs.map((bug) => (
                              <BugCard key={bug.id} bug={bug} />
                          ))}
                      </View>
                  )}
        </ShowcasePage>
    );
}

const pageStyles = StyleSheet.create((theme) => ({
    metricsRow: {
        flexDirection: "row",
        gap: 8
    },
    group: {
        gap: 10
    },
    cardList: {
        gap: 10
    }
}));
