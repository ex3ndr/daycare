import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Badge } from "@/components/Badge";
import { ShowcasePage } from "@/views/dev/showcase/components/ShowcasePage";

// --- Types ---

type FilterTab = "all" | "feature" | "fix" | "improvement";
type ReleaseType = "major" | "minor" | "patch";
type ChangeType = "feature" | "fix" | "improvement" | "breaking";

interface Change {
    id: string;
    type: ChangeType;
    description: string;
    issueNumber: number;
}

interface Release {
    version: string;
    date: string;
    releaseType: ReleaseType;
    changes: Change[];
}

// --- Mock data ---

const RELEASES: Release[] = [
    {
        version: "3.0.0",
        date: "Feb 28, 2026",
        releaseType: "major",
        changes: [
            {
                id: "c1",
                type: "breaking",
                description: "Migrated authentication to OAuth 2.1 with PKCE flow",
                issueNumber: 892
            },
            {
                id: "c2",
                type: "feature",
                description: "New dashboard with customizable widget grid layout",
                issueNumber: 887
            },
            {
                id: "c3",
                type: "feature",
                description: "Multi-tenant workspace support with role-based access",
                issueNumber: 874
            },
            { id: "c4", type: "breaking", description: "Removed legacy REST v1 endpoints", issueNumber: 891 },
            {
                id: "c5",
                type: "improvement",
                description: "Redesigned onboarding flow with interactive tutorials",
                issueNumber: 880
            }
        ]
    },
    {
        version: "2.14.0",
        date: "Feb 15, 2026",
        releaseType: "minor",
        changes: [
            {
                id: "c6",
                type: "feature",
                description: "Real-time collaborative editing with presence cursors",
                issueNumber: 856
            },
            {
                id: "c7",
                type: "feature",
                description: "Webhook event subscriptions for third-party integrations",
                issueNumber: 843
            },
            { id: "c8", type: "fix", description: "Fixed memory leak in WebSocket connection pool", issueNumber: 861 },
            {
                id: "c9",
                type: "improvement",
                description: "Reduced cold start latency by 40% with lazy module loading",
                issueNumber: 855
            },
            {
                id: "c10",
                type: "fix",
                description: "Resolved race condition in concurrent file uploads",
                issueNumber: 858
            }
        ]
    },
    {
        version: "2.13.2",
        date: "Feb 3, 2026",
        releaseType: "patch",
        changes: [
            {
                id: "c11",
                type: "fix",
                description: "Corrected timezone handling in scheduled reports",
                issueNumber: 849
            },
            { id: "c12", type: "fix", description: "Fixed CSV export truncating Unicode characters", issueNumber: 847 },
            {
                id: "c13",
                type: "improvement",
                description: "Improved search result ranking with TF-IDF scoring",
                issueNumber: 845
            }
        ]
    },
    {
        version: "2.13.0",
        date: "Jan 20, 2026",
        releaseType: "minor",
        changes: [
            {
                id: "c14",
                type: "feature",
                description: "Advanced filter builder with saved filter presets",
                issueNumber: 831
            },
            {
                id: "c15",
                type: "feature",
                description: "Audit log with exportable compliance reports",
                issueNumber: 828
            },
            {
                id: "c16",
                type: "improvement",
                description: "Migrated to edge-cached CDN for static assets",
                issueNumber: 835
            },
            {
                id: "c17",
                type: "fix",
                description: "Fixed notification badge count not clearing on read",
                issueNumber: 837
            },
            {
                id: "c18",
                type: "improvement",
                description: "Added keyboard shortcuts for all list operations",
                issueNumber: 830
            }
        ]
    },
    {
        version: "2.12.1",
        date: "Jan 8, 2026",
        releaseType: "patch",
        changes: [
            { id: "c19", type: "fix", description: "Patched XSS vulnerability in markdown renderer", issueNumber: 822 },
            { id: "c20", type: "fix", description: "Fixed dark mode colors in PDF export", issueNumber: 820 },
            {
                id: "c21",
                type: "improvement",
                description: "Optimized database queries for large team views",
                issueNumber: 818
            }
        ]
    }
];

const RELEASE_TYPE_COLORS: Record<ReleaseType, string> = {
    major: "#dc2626",
    minor: "#2563eb",
    patch: "#16a34a"
};

const CHANGE_TYPE_CONFIG: Record<ChangeType, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
    feature: { icon: "add-circle", color: "#16a34a", label: "Feature" },
    fix: { icon: "build", color: "#dc2626", label: "Fix" },
    improvement: { icon: "arrow-up-circle", color: "#2563eb", label: "Improvement" },
    breaking: { icon: "warning", color: "#dc2626", label: "Breaking" }
};

const FILTER_TABS: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "feature", label: "Features" },
    { key: "fix", label: "Fixes" },
    { key: "improvement", label: "Improvements" }
];

// --- Segmented Control ---

function SegmentedControl({ active, onSelect }: { active: FilterTab; onSelect: (tab: FilterTab) => void }) {
    const { theme } = useUnistyles();

    return (
        <View style={[segStyles.container, { backgroundColor: theme.colors.surfaceContainerHighest }]}>
            {FILTER_TABS.map(({ key, label }) => {
                const isActive = key === active;
                return (
                    <Pressable
                        key={key}
                        onPress={() => onSelect(key)}
                        style={[segStyles.tab, { backgroundColor: isActive ? theme.colors.surface : "transparent" }]}
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

const segStyles = StyleSheet.create((_theme) => ({
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

// --- Release Type Chip ---

function ReleaseTypeChip({ releaseType }: { releaseType: ReleaseType }) {
    const color = RELEASE_TYPE_COLORS[releaseType];

    return <Badge color={color}>{releaseType.charAt(0).toUpperCase() + releaseType.slice(1)}</Badge>;
}

// --- Issue Badge ---

function IssueBadge({ issueNumber }: { issueNumber: number }) {
    const { theme } = useUnistyles();

    return (
        <View style={[issueStyles.container, { backgroundColor: theme.colors.surfaceContainerHighest }]}>
            <Text style={[issueStyles.text, { color: theme.colors.primary }]}>#{issueNumber}</Text>
        </View>
    );
}

const issueStyles = StyleSheet.create((_theme) => ({
    container: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8
    },
    text: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11,
        lineHeight: 16
    }
}));

// --- Change Row ---

function ChangeRow({ change, isLast }: { change: Change; isLast: boolean }) {
    const { theme } = useUnistyles();
    const config = CHANGE_TYPE_CONFIG[change.type];

    return (
        <View style={changeStyles.wrapper}>
            {/* Timeline connector dot and line */}
            <View style={changeStyles.timelineCol}>
                <View style={[changeStyles.dot, { backgroundColor: config.color }]} />
                {!isLast && <View style={[changeStyles.line, { backgroundColor: theme.colors.outlineVariant }]} />}
            </View>

            {/* Content */}
            <View style={changeStyles.content}>
                <View style={changeStyles.row}>
                    <Ionicons name={config.icon} size={18} color={config.color} />
                    <Text style={[changeStyles.description, { color: theme.colors.onSurface }]} numberOfLines={2}>
                        {change.description}
                    </Text>
                </View>
                <View style={changeStyles.metaRow}>
                    <View style={[changeStyles.typePill, { backgroundColor: `${config.color}15` }]}>
                        <Text style={[changeStyles.typeLabel, { color: config.color }]}>{config.label}</Text>
                    </View>
                    <IssueBadge issueNumber={change.issueNumber} />
                </View>
            </View>
        </View>
    );
}

const changeStyles = StyleSheet.create((_theme) => ({
    wrapper: {
        flexDirection: "row",
        gap: 12,
        minHeight: 52
    },
    timelineCol: {
        width: 20,
        alignItems: "center"
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginTop: 5
    },
    line: {
        width: 2,
        flex: 1,
        marginTop: 4
    },
    content: {
        flex: 1,
        gap: 6,
        paddingBottom: 16
    },
    row: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8
    },
    description: {
        flex: 1,
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14,
        lineHeight: 20
    },
    metaRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginLeft: 26
    },
    typePill: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8
    },
    typeLabel: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 10,
        lineHeight: 14
    }
}));

// --- Release Section ---

function ReleaseSection({
    release,
    filteredChanges,
    isLast
}: {
    release: Release;
    filteredChanges: Change[];
    isLast: boolean;
}) {
    const { theme } = useUnistyles();
    const releaseColor = RELEASE_TYPE_COLORS[release.releaseType];

    return (
        <View style={sectionStyles.container}>
            {/* Version header */}
            <View style={sectionStyles.header}>
                <View style={[sectionStyles.versionAccent, { backgroundColor: releaseColor }]} />
                <View style={sectionStyles.headerContent}>
                    <View style={sectionStyles.headerTop}>
                        <Text style={[sectionStyles.version, { color: theme.colors.onSurface }]}>
                            v{release.version}
                        </Text>
                        <ReleaseTypeChip releaseType={release.releaseType} />
                    </View>
                    <View style={sectionStyles.headerBottom}>
                        <Ionicons name="calendar-outline" size={13} color={theme.colors.onSurfaceVariant} />
                        <Text style={[sectionStyles.date, { color: theme.colors.onSurfaceVariant }]}>
                            {release.date}
                        </Text>
                        <Text style={[sectionStyles.changeCount, { color: theme.colors.onSurfaceVariant }]}>
                            {filteredChanges.length} {filteredChanges.length === 1 ? "change" : "changes"}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Changes list */}
            <View style={sectionStyles.changesList}>
                {filteredChanges.map((change, idx) => (
                    <ChangeRow key={change.id} change={change} isLast={idx === filteredChanges.length - 1} />
                ))}
            </View>

            {/* Timeline connector between versions */}
            {!isLast && (
                <View style={sectionStyles.versionConnector}>
                    <View style={[sectionStyles.connectorLine, { backgroundColor: theme.colors.outlineVariant }]} />
                    <View style={[sectionStyles.connectorDot, { backgroundColor: theme.colors.outlineVariant }]} />
                    <View style={[sectionStyles.connectorLine, { backgroundColor: theme.colors.outlineVariant }]} />
                </View>
            )}
        </View>
    );
}

const sectionStyles = StyleSheet.create((_theme) => ({
    container: {
        gap: 0
    },
    header: {
        borderRadius: 12,
        overflow: "hidden",
        flexDirection: "row"
    },
    versionAccent: {
        width: 4
    },
    headerContent: {
        flex: 1,
        padding: 14,
        gap: 6
    },
    headerTop: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between"
    },
    version: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 18,
        lineHeight: 24
    },
    headerBottom: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6
    },
    date: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        lineHeight: 16
    },
    changeCount: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        lineHeight: 16,
        marginLeft: "auto"
    },
    changesList: {
        paddingTop: 14,
        paddingLeft: 8
    },
    versionConnector: {
        alignItems: "center",
        paddingVertical: 4,
        gap: 0
    },
    connectorLine: {
        width: 2,
        height: 10
    },
    connectorDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginVertical: 2
    }
}));

// --- Summary Stats ---

function SummaryStats() {
    const { theme } = useUnistyles();

    const allChanges = RELEASES.flatMap((r) => r.changes);
    const features = allChanges.filter((c) => c.type === "feature").length;
    const fixes = allChanges.filter((c) => c.type === "fix").length;
    const improvements = allChanges.filter((c) => c.type === "improvement").length;
    const breaking = allChanges.filter((c) => c.type === "breaking").length;

    const stats = [
        { value: String(RELEASES.length), label: "Releases", color: theme.colors.primary },
        { value: String(features), label: "Features", color: "#16a34a" },
        { value: String(fixes), label: "Fixes", color: "#dc2626" },
        { value: String(improvements + breaking), label: "Other", color: "#2563eb" }
    ];

    return (
        <View style={statsStyles.row}>
            {stats.map(({ value, label, color }) => (
                <View key={label} style={statsStyles.tile}>
                    <Text style={[statsStyles.value, { color }]}>{value}</Text>
                    <Text style={[statsStyles.label, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
                </View>
            ))}
        </View>
    );
}

const statsStyles = StyleSheet.create((_theme) => ({
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

// --- Main Component ---

export function ChangelogPage() {
    const { theme } = useUnistyles();
    const [activeFilter, setActiveFilter] = React.useState<FilterTab>("all");

    // Filter releases: only show releases that have matching changes, and filter the changes list
    const filteredReleases = React.useMemo(() => {
        if (activeFilter === "all") {
            return RELEASES.map((r) => ({ release: r, changes: r.changes }));
        }

        // "improvement" filter includes both improvement and breaking changes
        const matchType = (change: Change): boolean => {
            if (activeFilter === "improvement") {
                return change.type === "improvement" || change.type === "breaking";
            }
            return change.type === activeFilter;
        };

        return RELEASES.map((r) => ({
            release: r,
            changes: r.changes.filter(matchType)
        })).filter((entry) => entry.changes.length > 0);
    }, [activeFilter]);

    return (
        <ShowcasePage style={{ flex: 1, backgroundColor: theme.colors.surface }} topInset={16} contentGap={16}>
            {/* Page header */}
            <View style={pageStyles.titleRow}>
                <View style={[pageStyles.titleIcon, { backgroundColor: `${theme.colors.primary}15` }]}>
                    <Ionicons name="document-text-outline" size={22} color={theme.colors.primary} />
                </View>
                <View style={pageStyles.titleTextCol}>
                    <Text style={[pageStyles.title, { color: theme.colors.onSurface }]}>Changelog</Text>
                    <Text style={[pageStyles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                        Track every release and change
                    </Text>
                </View>
            </View>

            {/* Summary stats */}
            <SummaryStats />

            {/* Filter segmented control */}
            <SegmentedControl active={activeFilter} onSelect={setActiveFilter} />

            {/* Release sections */}
            {filteredReleases.map((entry, idx) => (
                <ReleaseSection
                    key={entry.release.version}
                    release={entry.release}
                    filteredChanges={entry.changes}
                    isLast={idx === filteredReleases.length - 1}
                />
            ))}

            {/* Empty state */}
            {filteredReleases.length === 0 && (
                <View style={pageStyles.emptyState}>
                    <Ionicons name="file-tray-outline" size={44} color={theme.colors.onSurfaceVariant} />
                    <Text style={[pageStyles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                        No matching changes found
                    </Text>
                </View>
            )}
        </ShowcasePage>
    );
}

const pageStyles = StyleSheet.create((_theme) => ({
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
