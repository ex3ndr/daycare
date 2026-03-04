import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

// --- Types ---

type ApplicationStatus = "Wishlist" | "Applied" | "Phone Screen" | "Interview" | "Offer" | "Rejected";
type LocationType = "remote" | "hybrid" | "onsite";

interface Application {
    id: string;
    company: string;
    role: string;
    dateApplied: string;
    salaryMin: number;
    salaryMax: number;
    location: LocationType;
    status: ApplicationStatus;
    referralContact: string | null;
    companyUrl: string;
    notes: string;
    interviewDate: string | null;
    recruiterName: string | null;
}

// --- Mock Data ---

const ALL_STATUSES: ApplicationStatus[] = ["Wishlist", "Applied", "Phone Screen", "Interview", "Offer", "Rejected"];

const MOCK_APPLICATIONS: Application[] = [
    {
        id: "a1",
        company: "Stripe",
        role: "Senior Frontend Engineer",
        dateApplied: "Feb 24, 2026",
        salaryMin: 185000,
        salaryMax: 225000,
        location: "remote",
        status: "Wishlist",
        referralContact: null,
        companyUrl: "stripe.com",
        notes: "Strong interest in their developer tools team. Need to tailor resume for fintech.",
        interviewDate: null,
        recruiterName: null
    },
    {
        id: "a2",
        company: "Vercel",
        role: "Staff Engineer, Infrastructure",
        dateApplied: "Feb 20, 2026",
        salaryMin: 200000,
        salaryMax: 260000,
        location: "remote",
        status: "Wishlist",
        referralContact: "Lina Park",
        companyUrl: "vercel.com",
        notes: "Lina works on the Edge Runtime team. Reach out before applying.",
        interviewDate: null,
        recruiterName: null
    },
    {
        id: "a3",
        company: "Datadog",
        role: "Full Stack Engineer",
        dateApplied: "Feb 18, 2026",
        salaryMin: 170000,
        salaryMax: 210000,
        location: "hybrid",
        status: "Applied",
        referralContact: null,
        companyUrl: "datadoghq.com",
        notes: "Applied through careers page. Team focuses on dashboards and alerting.",
        interviewDate: null,
        recruiterName: "Jessica Moore"
    },
    {
        id: "a4",
        company: "Figma",
        role: "Product Engineer",
        dateApplied: "Feb 15, 2026",
        salaryMin: 180000,
        salaryMax: 240000,
        location: "onsite",
        status: "Applied",
        referralContact: "Tom Nakamura",
        companyUrl: "figma.com",
        notes: "Tom referred me internally. Design systems team. SF office required.",
        interviewDate: null,
        recruiterName: "Rachel Kim"
    },
    {
        id: "a5",
        company: "Linear",
        role: "Senior Software Engineer",
        dateApplied: "Feb 12, 2026",
        salaryMin: 175000,
        salaryMax: 220000,
        location: "remote",
        status: "Applied",
        referralContact: null,
        companyUrl: "linear.app",
        notes: "Small team, high impact. Applied via AngelList.",
        interviewDate: null,
        recruiterName: null
    },
    {
        id: "a6",
        company: "Notion",
        role: "Software Engineer, Platform",
        dateApplied: "Feb 8, 2026",
        salaryMin: 190000,
        salaryMax: 245000,
        location: "hybrid",
        status: "Phone Screen",
        referralContact: "Maya Chen",
        companyUrl: "notion.so",
        notes: "Phone screen with hiring manager scheduled. Focus on API platform work.",
        interviewDate: "Mar 5, 2026",
        recruiterName: "Alex Rivera"
    },
    {
        id: "a7",
        company: "Shopify",
        role: "Senior Developer, Storefront",
        dateApplied: "Feb 5, 2026",
        salaryMin: 165000,
        salaryMax: 205000,
        location: "remote",
        status: "Phone Screen",
        referralContact: null,
        companyUrl: "shopify.com",
        notes: "30-minute intro call completed. Moving to technical screen next week.",
        interviewDate: "Mar 7, 2026",
        recruiterName: "Daniel Okafor"
    },
    {
        id: "a8",
        company: "Airbnb",
        role: "Staff Engineer, Search",
        dateApplied: "Jan 28, 2026",
        salaryMin: 220000,
        salaryMax: 300000,
        location: "onsite",
        status: "Interview",
        referralContact: "James Hoffman",
        companyUrl: "airbnb.com",
        notes: "Virtual onsite scheduled: 4 rounds (2 coding, 1 system design, 1 behavioral).",
        interviewDate: "Mar 10, 2026",
        recruiterName: "Priya Gupta"
    },
    {
        id: "a9",
        company: "Supabase",
        role: "Engineer, Realtime",
        dateApplied: "Jan 22, 2026",
        salaryMin: 160000,
        salaryMax: 200000,
        location: "remote",
        status: "Interview",
        referralContact: null,
        companyUrl: "supabase.com",
        notes: "Take-home completed. Panel interview with 3 engineers on Monday.",
        interviewDate: "Mar 3, 2026",
        recruiterName: "Olivia Zhang"
    },
    {
        id: "a10",
        company: "Retool",
        role: "Senior Engineer, Components",
        dateApplied: "Jan 18, 2026",
        salaryMin: 175000,
        salaryMax: 230000,
        location: "hybrid",
        status: "Offer",
        referralContact: "Sophie Laurent",
        companyUrl: "retool.com",
        notes: "Offer: $210k base + $50k RSUs/yr. 4 weeks PTO. Deadline to respond: Mar 8.",
        interviewDate: null,
        recruiterName: "Marcus Bell"
    },
    {
        id: "a11",
        company: "Planetscale",
        role: "Software Engineer, Console",
        dateApplied: "Jan 15, 2026",
        salaryMin: 155000,
        salaryMax: 195000,
        location: "remote",
        status: "Offer",
        referralContact: null,
        companyUrl: "planetscale.com",
        notes: "Offer: $185k base, fully remote. Great team culture. Deciding this week.",
        interviewDate: null,
        recruiterName: "Nina Patel"
    },
    {
        id: "a12",
        company: "Twilio",
        role: "Engineer II, Communications",
        dateApplied: "Jan 10, 2026",
        salaryMin: 150000,
        salaryMax: 190000,
        location: "onsite",
        status: "Rejected",
        referralContact: null,
        companyUrl: "twilio.com",
        notes: "Rejected after final round. Feedback: wanted more distributed systems experience.",
        interviewDate: null,
        recruiterName: "Kevin Wu"
    },
    {
        id: "a13",
        company: "Confluent",
        role: "Senior Software Engineer",
        dateApplied: "Jan 5, 2026",
        salaryMin: 170000,
        salaryMax: 215000,
        location: "hybrid",
        status: "Rejected",
        referralContact: "David Kim",
        companyUrl: "confluent.io",
        notes: "No response after 3 weeks. Recruiter confirmed position filled internally.",
        interviewDate: null,
        recruiterName: null
    },
    {
        id: "a14",
        company: "Cloudflare",
        role: "Systems Engineer, Workers",
        dateApplied: "Jan 2, 2026",
        salaryMin: 180000,
        salaryMax: 235000,
        location: "remote",
        status: "Rejected",
        referralContact: null,
        companyUrl: "cloudflare.com",
        notes: "Ghosted after phone screen. Followed up twice with no reply.",
        interviewDate: null,
        recruiterName: "Emily Shaw"
    }
];

// --- Helpers ---

function formatSalary(amount: number): string {
    return `$${Math.round(amount / 1000)}k`;
}

function salaryRange(app: Application): string {
    return `${formatSalary(app.salaryMin)}-${formatSalary(app.salaryMax)}`;
}

const STATUS_CONFIG: Record<
    ApplicationStatus,
    { icon: keyof typeof Ionicons.glyphMap; color: string; bgAlpha: string }
> = {
    Wishlist: { icon: "star-outline", color: "#8B5CF6", bgAlpha: "#8B5CF618" },
    Applied: { icon: "paper-plane-outline", color: "#3B82F6", bgAlpha: "#3B82F618" },
    "Phone Screen": { icon: "call-outline", color: "#F59E0B", bgAlpha: "#F59E0B18" },
    Interview: { icon: "people-outline", color: "#EC4899", bgAlpha: "#EC489918" },
    Offer: { icon: "trophy-outline", color: "#10B981", bgAlpha: "#10B98118" },
    Rejected: { icon: "close-circle-outline", color: "#EF4444", bgAlpha: "#EF444418" }
};

const LOCATION_CONFIG: Record<
    LocationType,
    { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }
> = {
    remote: { label: "Remote", color: "#10B981", bg: "#10B98118", icon: "globe-outline" },
    hybrid: { label: "Hybrid", color: "#F59E0B", bg: "#F59E0B18", icon: "business-outline" },
    onsite: { label: "Onsite", color: "#3B82F6", bg: "#3B82F618", icon: "location-outline" }
};

function initialsFrom(name: string): string {
    const parts = name.split(" ");
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
}

// --- Sub-components ---

/** Pipeline visualization showing status progression */
function StatusPipeline({
    appsByStatus,
    activeFilter,
    onFilterPress,
    textColor,
    surfaceColor
}: {
    appsByStatus: Map<ApplicationStatus, Application[]>;
    activeFilter: ApplicationStatus | null;
    onFilterPress: (status: ApplicationStatus | null) => void;
    textColor: string;
    surfaceColor: string;
}) {
    const totalApps = MOCK_APPLICATIONS.length;

    return (
        <View style={styles.pipelineContainer}>
            {ALL_STATUSES.map((status) => {
                const count = appsByStatus.get(status)?.length ?? 0;
                const config = STATUS_CONFIG[status];
                const isActive = activeFilter === status;
                const barWidth = totalApps > 0 ? Math.max((count / totalApps) * 100, 12) : 12;

                return (
                    <Pressable
                        key={status}
                        onPress={() => onFilterPress(isActive ? null : status)}
                        style={[
                            styles.pipelineStage,
                            {
                                backgroundColor: isActive ? `${config.color}14` : surfaceColor,
                                borderColor: isActive ? config.color : "transparent",
                                borderWidth: 1
                            }
                        ]}
                    >
                        <View style={styles.pipelineStageHeader}>
                            <Ionicons name={config.icon} size={14} color={config.color} />
                            <Text
                                style={[styles.pipelineStageLabel, { color: isActive ? config.color : textColor }]}
                                numberOfLines={1}
                            >
                                {status}
                            </Text>
                        </View>
                        <Text style={[styles.pipelineStageCount, { color: config.color }]}>{count}</Text>
                        <View style={[styles.pipelineBar, { backgroundColor: `${config.color}20` }]}>
                            <View
                                style={[
                                    styles.pipelineBarFill,
                                    { backgroundColor: config.color, width: `${barWidth}%` }
                                ]}
                            />
                        </View>
                    </Pressable>
                );
            })}
        </View>
    );
}

/** Metric card with icon */
function MetricCard({
    icon,
    iconColor,
    label,
    value,
    valueColor,
    bgColor,
    borderColor
}: {
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    label: string;
    value: string;
    valueColor: string;
    bgColor: string;
    borderColor: string;
}) {
    return (
        <View style={[styles.metricCard, { backgroundColor: bgColor, borderColor }]}>
            <View style={[styles.metricIconContainer, { backgroundColor: `${iconColor}14` }]}>
                <Ionicons name={icon} size={18} color={iconColor} />
            </View>
            <Text style={[styles.metricValue, { color: valueColor }]}>{value}</Text>
            <Text style={[styles.metricLabel, { color: `${valueColor}99` }]}>{label}</Text>
        </View>
    );
}

/** Location chip with icon and color */
function LocationChip({ location }: { location: LocationType }) {
    const config = LOCATION_CONFIG[location];
    return (
        <View style={[styles.locationChip, { backgroundColor: config.bg }]}>
            <Ionicons name={config.icon} size={11} color={config.color} />
            <Text style={[styles.locationChipText, { color: config.color }]}>{config.label}</Text>
        </View>
    );
}

/** Referral indicator badge */
function ReferralBadge({ name }: { name: string }) {
    const color = "#8B5CF6";
    return (
        <View style={[styles.referralBadge, { backgroundColor: `${color}14` }]}>
            <Ionicons name="person-add-outline" size={11} color={color} />
            <Text style={[styles.referralBadgeText, { color }]}>{name}</Text>
        </View>
    );
}

/** Individual application card with expandable details */
function ApplicationCard({
    app,
    isExpanded,
    onToggle,
    surfaceColor,
    textColor,
    subtextColor,
    borderColor,
    primaryColor
}: {
    app: Application;
    isExpanded: boolean;
    onToggle: () => void;
    surfaceColor: string;
    textColor: string;
    subtextColor: string;
    borderColor: string;
    primaryColor: string;
}) {
    const statusConfig = STATUS_CONFIG[app.status];
    const companyInitials = initialsFrom(app.company);

    return (
        <Pressable onPress={onToggle} style={({ pressed }) => [pressed && { opacity: 0.93 }]}>
            <View
                style={[
                    styles.appCard,
                    {
                        backgroundColor: surfaceColor,
                        borderColor: isExpanded ? primaryColor : borderColor
                    }
                ]}
            >
                {/* Left accent stripe */}
                <View style={[styles.appCardStripe, { backgroundColor: statusConfig.color }]} />

                <View style={styles.appCardContent}>
                    {/* Top row: company avatar + name + salary */}
                    <View style={styles.appTopRow}>
                        <View style={[styles.companyAvatar, { backgroundColor: `${statusConfig.color}18` }]}>
                            <Text style={[styles.companyAvatarText, { color: statusConfig.color }]}>
                                {companyInitials}
                            </Text>
                        </View>
                        <View style={styles.appCompanyCol}>
                            <Text style={[styles.appCompanyName, { color: textColor }]} numberOfLines={1}>
                                {app.company}
                            </Text>
                            <Text style={[styles.appRoleTitle, { color: subtextColor }]} numberOfLines={1}>
                                {app.role}
                            </Text>
                        </View>
                        <Text style={[styles.appSalary, { color: textColor }]}>{salaryRange(app)}</Text>
                    </View>

                    {/* Bottom row: date + location chip + referral */}
                    <View style={styles.appBottomRow}>
                        <View style={styles.appDateContainer}>
                            <Ionicons name="calendar-outline" size={12} color={subtextColor} />
                            <Text style={[styles.appDate, { color: subtextColor }]}>{app.dateApplied}</Text>
                        </View>
                        <LocationChip location={app.location} />
                        {app.referralContact ? <ReferralBadge name={app.referralContact} /> : null}
                        <View style={{ flex: 1 }} />
                        <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color={subtextColor} />
                    </View>

                    {/* Expanded details */}
                    {isExpanded && (
                        <View style={[styles.appExpanded, { borderTopColor: borderColor }]}>
                            {app.interviewDate ? (
                                <View style={styles.appExpandedRow}>
                                    <Ionicons name="calendar" size={14} color="#EC4899" />
                                    <Text style={[styles.appExpandedLabel, { color: subtextColor }]}>Next Step</Text>
                                    <Text style={[styles.appExpandedValue, { color: textColor }]}>
                                        {app.interviewDate}
                                    </Text>
                                </View>
                            ) : null}
                            {app.recruiterName ? (
                                <View style={styles.appExpandedRow}>
                                    <Ionicons name="person-outline" size={14} color={subtextColor} />
                                    <Text style={[styles.appExpandedLabel, { color: subtextColor }]}>Recruiter</Text>
                                    <Text style={[styles.appExpandedValue, { color: textColor }]}>
                                        {app.recruiterName}
                                    </Text>
                                </View>
                            ) : null}
                            <View style={styles.appExpandedRow}>
                                <Ionicons name="link-outline" size={14} color={subtextColor} />
                                <Text style={[styles.appExpandedLabel, { color: subtextColor }]}>Website</Text>
                                <Text style={[styles.appExpandedValue, { color: primaryColor }]}>{app.companyUrl}</Text>
                            </View>
                            {app.notes ? (
                                <View style={styles.appExpandedRow}>
                                    <Ionicons name="document-text-outline" size={14} color={subtextColor} />
                                    <Text style={[styles.appExpandedLabel, { color: subtextColor }]}>Notes</Text>
                                    <Text style={[styles.appExpandedValue, { color: textColor }]}>{app.notes}</Text>
                                </View>
                            ) : null}
                        </View>
                    )}
                </View>
            </View>
        </Pressable>
    );
}

/** Status group header with colored icon, count badge, and total */
function StatusGroupHeader({
    status,
    count,
    textColor
}: {
    status: ApplicationStatus;
    count: number;
    textColor: string;
}) {
    const config = STATUS_CONFIG[status];

    return (
        <View style={styles.statusGroupHeader}>
            <View style={[styles.statusGroupIcon, { backgroundColor: config.bgAlpha }]}>
                <Ionicons name={config.icon} size={16} color={config.color} />
            </View>
            <Text style={[styles.statusGroupLabel, { color: textColor }]}>{status}</Text>
            <View style={[styles.statusGroupBadge, { backgroundColor: config.bgAlpha }]}>
                <Text style={[styles.statusGroupBadgeText, { color: config.color }]}>{count}</Text>
            </View>
            <View style={{ flex: 1 }} />
            <View style={[styles.statusGroupLine, { backgroundColor: `${config.color}30` }]} />
        </View>
    );
}

// --- Main Component ---

/**
 * Job search tracking screen with metrics, pipeline visualization,
 * status-grouped application cards, and expandable details.
 */
export function JobApplicationsPage() {
    const { theme } = useUnistyles();
    const [statusFilter, setStatusFilter] = React.useState<ApplicationStatus | null>(null);
    const [expandedAppId, setExpandedAppId] = React.useState<string | null>(null);

    // Group applications by status
    const appsByStatus = React.useMemo(() => {
        const map = new Map<ApplicationStatus, Application[]>();
        for (const status of ALL_STATUSES) {
            map.set(status, []);
        }
        for (const app of MOCK_APPLICATIONS) {
            map.get(app.status)!.push(app);
        }
        return map;
    }, []);

    // Computed metrics
    const totalApps = MOCK_APPLICATIONS.length;
    const interviewsScheduled =
        (appsByStatus.get("Phone Screen")?.length ?? 0) + (appsByStatus.get("Interview")?.length ?? 0);
    const offersReceived = appsByStatus.get("Offer")?.length ?? 0;
    const appliedOrBeyond = MOCK_APPLICATIONS.filter((a) => a.status !== "Wishlist").length;
    const responded = MOCK_APPLICATIONS.filter((a) => a.status !== "Wishlist" && a.status !== "Applied").length;
    const responseRate = appliedOrBeyond > 0 ? Math.round((responded / appliedOrBeyond) * 100) : 0;

    // Filter statuses to display
    const statusesToShow = statusFilter ? [statusFilter] : ALL_STATUSES;

    const handleToggleApp = React.useCallback((appId: string) => {
        setExpandedAppId((prev) => (prev === appId ? null : appId));
    }, []);

    return (
        <ScrollView
            contentContainerStyle={[styles.scrollContent, { backgroundColor: theme.colors.surface }]}
            showsVerticalScrollIndicator={false}
        >
            {/* Header */}
            <View style={styles.headerContainer}>
                <View style={styles.headerTitleRow}>
                    <Ionicons name="briefcase" size={24} color={theme.colors.primary} />
                    <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>Job Search</Text>
                </View>
                <Text style={[styles.headerSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                    Track your applications and interview pipeline
                </Text>
            </View>

            {/* Metrics Cards */}
            <View style={styles.metricsRow}>
                <MetricCard
                    icon="documents-outline"
                    iconColor={theme.colors.primary}
                    label="Total Apps"
                    value={`${totalApps}`}
                    valueColor={theme.colors.onSurface}
                    bgColor={theme.colors.surfaceContainer}
                    borderColor={theme.colors.outlineVariant}
                />
                <MetricCard
                    icon="chatbubbles-outline"
                    iconColor="#EC4899"
                    label="Interviews"
                    value={`${interviewsScheduled}`}
                    valueColor={theme.colors.onSurface}
                    bgColor={theme.colors.surfaceContainer}
                    borderColor={theme.colors.outlineVariant}
                />
                <MetricCard
                    icon="trophy-outline"
                    iconColor="#10B981"
                    label="Offers"
                    value={`${offersReceived}`}
                    valueColor={theme.colors.onSurface}
                    bgColor={theme.colors.surfaceContainer}
                    borderColor={theme.colors.outlineVariant}
                />
                <MetricCard
                    icon="pulse-outline"
                    iconColor="#F59E0B"
                    label="Response"
                    value={`${responseRate}%`}
                    valueColor={theme.colors.onSurface}
                    bgColor={theme.colors.surfaceContainer}
                    borderColor={theme.colors.outlineVariant}
                />
            </View>

            {/* Pipeline Visualization */}
            <View style={styles.sectionContainer}>
                <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Pipeline</Text>
                <StatusPipeline
                    appsByStatus={appsByStatus}
                    activeFilter={statusFilter}
                    onFilterPress={setStatusFilter}
                    textColor={theme.colors.onSurface}
                    surfaceColor={theme.colors.surfaceContainer}
                />
            </View>

            {/* Filter Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                <Pressable
                    onPress={() => setStatusFilter(null)}
                    style={[
                        styles.filterPill,
                        {
                            backgroundColor:
                                statusFilter === null ? theme.colors.primary : theme.colors.surfaceContainerHighest
                        }
                    ]}
                >
                    <Text
                        style={[
                            styles.filterPillText,
                            { color: statusFilter === null ? "#FFFFFF" : theme.colors.onSurfaceVariant }
                        ]}
                    >
                        All ({totalApps})
                    </Text>
                </Pressable>
                {ALL_STATUSES.map((status) => {
                    const isActive = statusFilter === status;
                    const config = STATUS_CONFIG[status];
                    const count = appsByStatus.get(status)?.length ?? 0;
                    return (
                        <Pressable
                            key={status}
                            onPress={() => setStatusFilter(isActive ? null : status)}
                            style={[
                                styles.filterPill,
                                {
                                    backgroundColor: isActive ? config.color : theme.colors.surfaceContainerHighest
                                }
                            ]}
                        >
                            <Ionicons name={config.icon} size={13} color={isActive ? "#FFFFFF" : config.color} />
                            <Text
                                style={[
                                    styles.filterPillText,
                                    { color: isActive ? "#FFFFFF" : theme.colors.onSurfaceVariant }
                                ]}
                            >
                                {status}
                            </Text>
                            <View
                                style={[
                                    styles.filterPillBadge,
                                    {
                                        backgroundColor: isActive ? "rgba(255,255,255,0.25)" : `${config.color}20`
                                    }
                                ]}
                            >
                                <Text
                                    style={[styles.filterPillBadgeText, { color: isActive ? "#FFFFFF" : config.color }]}
                                >
                                    {count}
                                </Text>
                            </View>
                        </Pressable>
                    );
                })}
            </ScrollView>

            {/* Applications grouped by status */}
            <View style={styles.applicationsContainer}>
                {statusesToShow.map((status) => {
                    const apps = appsByStatus.get(status) ?? [];
                    if (apps.length === 0 && statusFilter === null) return null;

                    return (
                        <View key={status} style={styles.statusGroup}>
                            <StatusGroupHeader status={status} count={apps.length} textColor={theme.colors.onSurface} />
                            {apps.length === 0 ? (
                                <View style={styles.emptyGroup}>
                                    <Ionicons name="file-tray-outline" size={24} color={theme.colors.outlineVariant} />
                                    <Text style={[styles.emptyGroupText, { color: theme.colors.onSurfaceVariant }]}>
                                        No applications in this stage
                                    </Text>
                                </View>
                            ) : (
                                <View style={styles.appsList}>
                                    {apps.map((app) => (
                                        <ApplicationCard
                                            key={app.id}
                                            app={app}
                                            isExpanded={expandedAppId === app.id}
                                            onToggle={() => handleToggleApp(app.id)}
                                            surfaceColor={theme.colors.surfaceContainer}
                                            textColor={theme.colors.onSurface}
                                            subtextColor={theme.colors.onSurfaceVariant}
                                            borderColor={theme.colors.outlineVariant}
                                            primaryColor={theme.colors.primary}
                                        />
                                    ))}
                                </View>
                            )}
                        </View>
                    );
                })}
            </View>
        </ScrollView>
    );
}

// --- Styles ---

const styles = StyleSheet.create((_theme) => ({
    scrollContent: {
        maxWidth: 600,
        width: "100%",
        alignSelf: "center" as const,
        paddingBottom: 48
    },

    // Header
    headerContainer: {
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 4,
        gap: 4
    },
    headerTitleRow: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 10
    },
    headerTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 24,
        letterSpacing: -0.5
    },
    headerSubtitle: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14,
        marginLeft: 34
    },

    // Metrics row
    metricsRow: {
        flexDirection: "row" as const,
        gap: 8,
        paddingHorizontal: 16,
        marginTop: 16,
        marginBottom: 20
    },
    metricCard: {
        flex: 1,
        borderRadius: 12,
        padding: 12,
        alignItems: "center" as const,
        gap: 6,
        borderWidth: 1
    },
    metricIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center" as const,
        justifyContent: "center" as const
    },
    metricValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 20,
        letterSpacing: -0.3
    },
    metricLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 10,
        letterSpacing: 0.5,
        textTransform: "uppercase" as const
    },

    // Pipeline visualization
    sectionContainer: {
        paddingHorizontal: 16,
        marginBottom: 16,
        gap: 10
    },
    sectionTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 16,
        letterSpacing: -0.2
    },
    pipelineContainer: {
        flexDirection: "row" as const,
        flexWrap: "wrap" as const,
        gap: 6
    },
    pipelineStage: {
        borderRadius: 10,
        padding: 10,
        width: "31.5%",
        gap: 4
    },
    pipelineStageHeader: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 5
    },
    pipelineStageLabel: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11,
        flex: 1
    },
    pipelineStageCount: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 22,
        letterSpacing: -0.5
    },
    pipelineBar: {
        height: 4,
        borderRadius: 2,
        overflow: "hidden" as const,
        marginTop: 2
    },
    pipelineBarFill: {
        height: 4,
        borderRadius: 2
    },

    // Filter pills
    filterScroll: {
        paddingHorizontal: 16,
        gap: 8,
        paddingBottom: 16
    },
    filterPill: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20
    },
    filterPillText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 12
    },
    filterPillBadge: {
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: "center" as const,
        justifyContent: "center" as const
    },
    filterPillBadgeText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 10
    },

    // Applications container
    applicationsContainer: {
        paddingHorizontal: 16,
        gap: 20
    },
    statusGroup: {
        gap: 8
    },

    // Status group header
    statusGroupHeader: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 8,
        paddingBottom: 4
    },
    statusGroupIcon: {
        width: 28,
        height: 28,
        borderRadius: 8,
        alignItems: "center" as const,
        justifyContent: "center" as const
    },
    statusGroupLabel: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15
    },
    statusGroupBadge: {
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        alignItems: "center" as const,
        justifyContent: "center" as const,
        paddingHorizontal: 6
    },
    statusGroupBadgeText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 11
    },
    statusGroupLine: {
        flex: 1,
        height: 1,
        marginLeft: 4
    },

    // Application card
    appsList: {
        gap: 8
    },
    appCard: {
        borderRadius: 12,
        borderWidth: 1,
        overflow: "hidden" as const,
        flexDirection: "row" as const
    },
    appCardStripe: {
        width: 4
    },
    appCardContent: {
        flex: 1,
        padding: 14,
        gap: 10
    },

    // Card top row
    appTopRow: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 10
    },
    companyAvatar: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: "center" as const,
        justifyContent: "center" as const
    },
    companyAvatarText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 13
    },
    appCompanyCol: {
        flex: 1,
        gap: 1
    },
    appCompanyName: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15
    },
    appRoleTitle: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    appSalary: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 12,
        letterSpacing: -0.3
    },

    // Card bottom row
    appBottomRow: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 8,
        flexWrap: "wrap" as const
    },
    appDateContainer: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 4
    },
    appDate: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },

    // Location chip
    locationChip: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10
    },
    locationChipText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 10
    },

    // Referral badge
    referralBadge: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10
    },
    referralBadgeText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 10
    },

    // Expanded details
    appExpanded: {
        borderTopWidth: 1,
        paddingTop: 10,
        gap: 8
    },
    appExpandedRow: {
        flexDirection: "row" as const,
        alignItems: "flex-start" as const,
        gap: 8
    },
    appExpandedLabel: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 12,
        width: 72
    },
    appExpandedValue: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        flex: 1,
        lineHeight: 18
    },

    // Empty group
    emptyGroup: {
        paddingVertical: 24,
        alignItems: "center" as const,
        gap: 8
    },
    emptyGroupText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13
    }
}));
