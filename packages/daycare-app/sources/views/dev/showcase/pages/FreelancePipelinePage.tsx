import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
// --- Types ---
import { Card } from "@/components/Card";
import { ShowcasePage } from "@/views/dev/showcase/components/ShowcasePage";

type ProjectStatus = "proposal" | "in_progress" | "review" | "completed" | "invoiced";
type PaymentStatus = "unpaid" | "partial" | "paid";
interface Project {
    id: string;
    name: string;
    client: string;
    budget: number;
    hoursLogged: number;
    hoursEstimated: number;
    deadline: string;
    status: ProjectStatus;
    payment: PaymentStatus;
}
interface DayTime {
    day: string;
    hours: number;
}

// --- Config ---

const STATUS_ORDER: ProjectStatus[] = ["proposal", "in_progress", "review", "completed", "invoiced"];
const STATUS_CONFIG: Record<
    ProjectStatus,
    {
        label: string;
        icon: keyof typeof Ionicons.glyphMap;
        color: string;
    }
> = {
    proposal: {
        label: "Proposal Sent",
        icon: "paper-plane-outline",
        color: "#8B5CF6"
    },
    in_progress: {
        label: "In Progress",
        icon: "hammer-outline",
        color: "#3B82F6"
    },
    review: {
        label: "Review",
        icon: "eye-outline",
        color: "#F59E0B"
    },
    completed: {
        label: "Completed",
        icon: "checkmark-circle-outline",
        color: "#10B981"
    },
    invoiced: {
        label: "Invoiced",
        icon: "receipt-outline",
        color: "#6366F1"
    }
};
const PAYMENT_CONFIG: Record<
    PaymentStatus,
    {
        label: string;
        color: string;
        bg: string;
    }
> = {
    unpaid: {
        label: "Unpaid",
        color: "#EF4444",
        bg: "#EF444418"
    },
    partial: {
        label: "Partial",
        color: "#F59E0B",
        bg: "#F59E0B18"
    },
    paid: {
        label: "Paid",
        color: "#10B981",
        bg: "#10B98118"
    }
};

// --- Mock Data ---

const MOCK_PROJECTS: Project[] = [
    {
        id: "p1",
        name: "Brand Identity System",
        client: "Greenfield Architects",
        budget: 8500,
        hoursLogged: 12,
        hoursEstimated: 40,
        deadline: "Mar 28, 2026",
        status: "proposal",
        payment: "unpaid"
    },
    {
        id: "p2",
        name: "Mobile App Prototype",
        client: "Nimbus SaaS Inc.",
        budget: 15000,
        hoursLogged: 0,
        hoursEstimated: 80,
        deadline: "Apr 10, 2026",
        status: "proposal",
        payment: "unpaid"
    },
    {
        id: "p3",
        name: "Dashboard Redesign",
        client: "Atlas Ventures",
        budget: 12000,
        hoursLogged: 52,
        hoursEstimated: 60,
        deadline: "Mar 14, 2026",
        status: "in_progress",
        payment: "partial"
    },
    {
        id: "p4",
        name: "E-Commerce Platform",
        client: "Verdant Foods",
        budget: 22000,
        hoursLogged: 110,
        hoursEstimated: 120,
        deadline: "Mar 20, 2026",
        status: "in_progress",
        payment: "partial"
    },
    {
        id: "p5",
        name: "Marketing Website",
        client: "Brightpath Education",
        budget: 6800,
        hoursLogged: 38,
        hoursEstimated: 35,
        deadline: "Mar 7, 2026",
        status: "in_progress",
        payment: "unpaid"
    },
    {
        id: "p6",
        name: "API Documentation Portal",
        client: "Clearview Analytics",
        budget: 4200,
        hoursLogged: 28,
        hoursEstimated: 30,
        deadline: "Mar 5, 2026",
        status: "review",
        payment: "unpaid"
    },
    {
        id: "p7",
        name: "Onboarding Flow Redesign",
        client: "Summit Healthcare",
        budget: 9500,
        hoursLogged: 48,
        hoursEstimated: 50,
        deadline: "Feb 28, 2026",
        status: "completed",
        payment: "partial"
    },
    {
        id: "p8",
        name: "Data Viz Dashboard",
        client: "Coastal Realty",
        budget: 7200,
        hoursLogged: 36,
        hoursEstimated: 36,
        deadline: "Feb 15, 2026",
        status: "completed",
        payment: "paid"
    },
    {
        id: "p9",
        name: "Pitch Deck Design",
        client: "Ember Studios",
        budget: 3200,
        hoursLogged: 16,
        hoursEstimated: 16,
        deadline: "Jan 30, 2026",
        status: "invoiced",
        payment: "paid"
    },
    {
        id: "p10",
        name: "Icon Set & Illustrations",
        client: "Drift Coffee Roasters",
        budget: 2400,
        hoursLogged: 14,
        hoursEstimated: 15,
        deadline: "Feb 1, 2026",
        status: "invoiced",
        payment: "unpaid"
    }
];
const WEEKLY_TIME: DayTime[] = [
    {
        day: "Mon",
        hours: 7.5
    },
    {
        day: "Tue",
        hours: 8.0
    },
    {
        day: "Wed",
        hours: 6.5
    },
    {
        day: "Thu",
        hours: 9.0
    },
    {
        day: "Fri",
        hours: 4.0
    },
    {
        day: "Sat",
        hours: 2.0
    },
    {
        day: "Sun",
        hours: 0
    }
];
const MONTHLY_REVENUE = 18_400;
const UTILIZATION_RATE = 78;

// --- Helpers ---

function formatCurrency(amount: number): string {
    return `$${amount.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    })}`;
}
function hoursBarColor(logged: number, estimated: number): string {
    const ratio = estimated > 0 ? logged / estimated : 0;
    if (ratio >= 1.0) return "#EF4444"; // red - over budget
    if (ratio >= 0.85) return "#F59E0B"; // amber - near budget
    return "#10B981"; // green - under budget
}

// --- Sub-components ---

function MetricCard({
    label,
    value,
    icon,
    tintColor
}: {
    label: string;
    value: string;
    icon: keyof typeof Ionicons.glyphMap;
    tintColor: string;
}) {
    const { theme } = useUnistyles();
    return (
        <Card style={s.metricCard}>
            <View
                style={[
                    s.metricIconCircle,
                    {
                        backgroundColor: `${tintColor}18`
                    }
                ]}
            >
                <Ionicons name={icon} size={18} color={tintColor} />
            </View>
            <Text
                style={[
                    s.metricValue,
                    {
                        color: theme.colors.onSurface
                    }
                ]}
            >
                {value}
            </Text>
            <Text
                style={[
                    s.metricLabel,
                    {
                        color: theme.colors.onSurfaceVariant
                    }
                ]}
            >
                {label}
            </Text>
        </Card>
    );
}
function UtilizationBar({ rate }: { rate: number }) {
    const { theme } = useUnistyles();
    const clamped = Math.min(Math.max(rate, 0), 100);
    const barColor = clamped >= 90 ? "#10B981" : clamped >= 70 ? theme.colors.primary : "#F59E0B";
    return (
        <Card style={s.utilizationCard}>
            <View style={s.utilizationHeader}>
                <View style={s.utilizationLabelRow}>
                    <Ionicons name="speedometer-outline" size={18} color={barColor} />
                    <Text
                        style={[
                            s.utilizationTitle,
                            {
                                color: theme.colors.onSurface
                            }
                        ]}
                    >
                        Utilization Rate
                    </Text>
                </View>
                <Text
                    style={[
                        s.utilizationPercent,
                        {
                            color: barColor
                        }
                    ]}
                >
                    {clamped}%
                </Text>
            </View>
            <View
                style={[
                    s.utilizationTrack,
                    {
                        backgroundColor: `${barColor}18`
                    }
                ]}
            >
                <View
                    style={[
                        s.utilizationFill,
                        {
                            width: `${clamped}%`,
                            backgroundColor: barColor
                        }
                    ]}
                />
            </View>
            <Text
                style={[
                    s.utilizationHint,
                    {
                        color: theme.colors.onSurfaceVariant
                    }
                ]}
            >
                {clamped >= 85
                    ? "Excellent - near full capacity"
                    : clamped >= 70
                      ? "Good - room for 1 more project"
                      : "Low - consider prospecting"}
            </Text>
        </Card>
    );
}
function WeeklyTimeSummary({ days }: { days: DayTime[] }) {
    const { theme } = useUnistyles();
    const totalHours = days.reduce((sum, d) => sum + d.hours, 0);
    const maxHours = Math.max(...days.map((d) => d.hours), 1);
    return (
        <Card style={s.weeklyCard}>
            <View style={s.weeklyHeader}>
                <View style={s.weeklyLabelRow}>
                    <Ionicons name="time-outline" size={18} color={theme.colors.primary} />
                    <Text
                        style={[
                            s.weeklyTitle,
                            {
                                color: theme.colors.onSurface
                            }
                        ]}
                    >
                        Time This Week
                    </Text>
                </View>
                <Text
                    style={[
                        s.weeklyTotal,
                        {
                            color: theme.colors.primary
                        }
                    ]}
                >
                    {totalHours}h
                </Text>
            </View>
            <View style={s.weeklyBarsRow}>
                {days.map((d) => {
                    const barHeight = d.hours > 0 ? Math.max((d.hours / maxHours) * 48, 4) : 2;
                    const isToday = d.day === "Tue"; // mock: Tuesday is "today"
                    const barBg = isToday
                        ? theme.colors.primary
                        : d.hours > 0
                          ? `${theme.colors.primary}60`
                          : theme.colors.outlineVariant;
                    return (
                        <View key={d.day} style={s.weeklyBarCol}>
                            <View style={s.weeklyBarWrap}>
                                <View
                                    style={[
                                        s.weeklyBar,
                                        {
                                            height: barHeight,
                                            backgroundColor: barBg
                                        }
                                    ]}
                                />
                            </View>
                            <Text
                                style={[
                                    s.weeklyBarLabel,
                                    {
                                        color: isToday ? theme.colors.primary : theme.colors.onSurfaceVariant
                                    },
                                    isToday && s.weeklyBarLabelToday
                                ]}
                            >
                                {d.day}
                            </Text>
                            <Text
                                style={[
                                    s.weeklyBarValue,
                                    {
                                        color: theme.colors.onSurfaceVariant
                                    }
                                ]}
                            >
                                {d.hours > 0 ? `${d.hours}` : "-"}
                            </Text>
                        </View>
                    );
                })}
            </View>
        </Card>
    );
}
function HoursProgressBar({ logged, estimated }: { logged: number; estimated: number }) {
    const ratio = estimated > 0 ? Math.min(logged / estimated, 1.3) : 0;
    const displayRatio = Math.min(ratio, 1.0);
    const color = hoursBarColor(logged, estimated);
    return (
        <View style={s.hoursBarContainer}>
            <View
                style={[
                    s.hoursBarTrack,
                    {
                        backgroundColor: `${color}18`
                    }
                ]}
            >
                <View
                    style={[
                        s.hoursBarFill,
                        {
                            width: `${displayRatio * 100}%`,
                            backgroundColor: color
                        }
                    ]}
                />
            </View>
        </View>
    );
}
function PaymentChip({ status }: { status: PaymentStatus }) {
    const config = PAYMENT_CONFIG[status];
    return (
        <View
            style={[
                s.paymentChip,
                {
                    backgroundColor: config.bg
                }
            ]}
        >
            <Text
                style={[
                    s.paymentChipText,
                    {
                        color: config.color
                    }
                ]}
            >
                {config.label}
            </Text>
        </View>
    );
}
function ProjectRow({ project, onPress }: { project: Project; onPress: () => void }) {
    const { theme } = useUnistyles();
    const color = hoursBarColor(project.hoursLogged, project.hoursEstimated);
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                s.projectRow,
                {
                    backgroundColor: theme.colors.surfaceContainer
                },
                pressed && {
                    opacity: 0.85
                }
            ]}
        >
            <View style={s.projectTopRow}>
                <View style={s.projectNameArea}>
                    <Text
                        style={[
                            s.projectName,
                            {
                                color: theme.colors.onSurface
                            }
                        ]}
                        numberOfLines={1}
                    >
                        {project.name}
                    </Text>
                    <Text
                        style={[
                            s.projectClient,
                            {
                                color: theme.colors.onSurfaceVariant
                            }
                        ]}
                        numberOfLines={1}
                    >
                        {project.client}
                    </Text>
                </View>
                <Text
                    style={[
                        s.projectBudget,
                        {
                            color: theme.colors.onSurface
                        }
                    ]}
                >
                    {formatCurrency(project.budget)}
                </Text>
            </View>

            <View style={s.projectMiddleRow}>
                <View style={s.projectHoursArea}>
                    <Text
                        style={[
                            s.projectHoursLabel,
                            {
                                color: theme.colors.onSurfaceVariant
                            }
                        ]}
                    >
                        Hours
                    </Text>
                    <View style={s.projectHoursValueRow}>
                        <Text
                            style={[
                                s.projectHoursText,
                                {
                                    color
                                }
                            ]}
                        >
                            {project.hoursLogged}
                        </Text>
                        <Text
                            style={[
                                s.projectHoursSep,
                                {
                                    color: theme.colors.onSurfaceVariant
                                }
                            ]}
                        >
                            /
                        </Text>
                        <Text
                            style={[
                                s.projectHoursEst,
                                {
                                    color: theme.colors.onSurfaceVariant
                                }
                            ]}
                        >
                            {project.hoursEstimated}h
                        </Text>
                    </View>
                    <HoursProgressBar logged={project.hoursLogged} estimated={project.hoursEstimated} />
                </View>
            </View>

            <View style={s.projectBottomRow}>
                <View style={s.projectDeadlineRow}>
                    <Ionicons name="calendar-outline" size={12} color={theme.colors.onSurfaceVariant} />
                    <Text
                        style={[
                            s.projectDeadline,
                            {
                                color: theme.colors.onSurfaceVariant
                            }
                        ]}
                    >
                        {project.deadline}
                    </Text>
                </View>
                <PaymentChip status={project.payment} />
            </View>
        </Pressable>
    );
}
function StatusGroupHeader({
    status,
    count,
    expanded,
    onToggle
}: {
    status: ProjectStatus;
    count: number;
    expanded: boolean;
    onToggle: () => void;
}) {
    const { theme } = useUnistyles();
    const config = STATUS_CONFIG[status];
    return (
        <Pressable onPress={onToggle} style={s.statusGroupHeader}>
            <View
                style={[
                    s.statusGroupDot,
                    {
                        backgroundColor: config.color
                    }
                ]}
            />
            <Ionicons name={config.icon} size={16} color={config.color} />
            <Text
                style={[
                    s.statusGroupLabel,
                    {
                        color: theme.colors.onSurface
                    }
                ]}
            >
                {config.label}
            </Text>
            <View
                style={[
                    s.statusGroupCount,
                    {
                        backgroundColor: `${config.color}18`
                    }
                ]}
            >
                <Text
                    style={[
                        s.statusGroupCountText,
                        {
                            color: config.color
                        }
                    ]}
                >
                    {count}
                </Text>
            </View>
            <View style={s.statusGroupSpacer} />
            <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={theme.colors.onSurfaceVariant} />
        </Pressable>
    );
}

// --- Main Component ---

export function FreelancePipelinePage() {
    const { theme } = useUnistyles();
    const [projects, setProjects] = React.useState(MOCK_PROJECTS);
    const [expandedGroups, setExpandedGroups] = React.useState<Record<ProjectStatus, boolean>>({
        proposal: true,
        in_progress: true,
        review: true,
        completed: true,
        invoiced: false
    });
    const [selectedProject, setSelectedProject] = React.useState<Project | null>(null);
    const toggleGroup = React.useCallback((status: ProjectStatus) => {
        setExpandedGroups((prev) => ({
            ...prev,
            [status]: !prev[status]
        }));
    }, []);
    const cyclePayment = React.useCallback((id: string) => {
        setProjects((prev) =>
            prev.map((p) => {
                if (p.id !== id) return p;
                const next: PaymentStatus =
                    p.payment === "unpaid" ? "partial" : p.payment === "partial" ? "paid" : "unpaid";
                return {
                    ...p,
                    payment: next
                };
            })
        );
        setSelectedProject(null);
    }, []);
    const advanceStatus = React.useCallback((id: string) => {
        setProjects((prev) =>
            prev.map((p) => {
                if (p.id !== id) return p;
                const idx = STATUS_ORDER.indexOf(p.status);
                if (idx >= STATUS_ORDER.length - 1) return p;
                return {
                    ...p,
                    status: STATUS_ORDER[idx + 1]
                };
            })
        );
        setSelectedProject(null);
    }, []);

    // Compute metrics
    const activeProjects = projects.filter((p) => p.status === "in_progress" || p.status === "review").length;
    const outstandingProposals = projects.filter((p) => p.status === "proposal").length;

    // Group projects by status
    const grouped = React.useMemo(() => {
        const map: Record<ProjectStatus, Project[]> = {
            proposal: [],
            in_progress: [],
            review: [],
            completed: [],
            invoiced: []
        };
        for (const p of projects) {
            map[p.status].push(p);
        }
        return map;
    }, [projects]);

    // Resolve selected project from current state
    const currentSelected = selectedProject ? (projects.find((p) => p.id === selectedProject.id) ?? null) : null;
    return (
        <ShowcasePage topInset={16} bottomInset={48} contentGap={12}>
            {/* --- Metrics Row --- */}
            <View style={s.metricsRow}>
                <MetricCard
                    label="Active Projects"
                    value={`${activeProjects}`}
                    icon="briefcase-outline"
                    tintColor="#3B82F6"
                />
                <MetricCard
                    label="Monthly Revenue"
                    value={formatCurrency(MONTHLY_REVENUE)}
                    icon="cash-outline"
                    tintColor="#10B981"
                />
            </View>
            <View style={s.metricsRow}>
                <MetricCard
                    label="Proposals Out"
                    value={`${outstandingProposals}`}
                    icon="paper-plane-outline"
                    tintColor="#8B5CF6"
                />
                <MetricCard label="Avg. Rate" value="$150/h" icon="trending-up-outline" tintColor="#F59E0B" />
            </View>

            {/* --- Utilization Rate --- */}
            <UtilizationBar rate={UTILIZATION_RATE} />

            {/* --- Time This Week --- */}
            <WeeklyTimeSummary days={WEEKLY_TIME} />

            {/* --- Project Detail Overlay --- */}
            {currentSelected && (
                <Card style={s.detailCard}>
                    <View style={s.detailHeader}>
                        <View style={s.detailTitleArea}>
                            <Text
                                style={[
                                    s.detailName,
                                    {
                                        color: theme.colors.onSurface
                                    }
                                ]}
                            >
                                {currentSelected.name}
                            </Text>
                            <Text
                                style={[
                                    s.detailClient,
                                    {
                                        color: theme.colors.onSurfaceVariant
                                    }
                                ]}
                            >
                                {currentSelected.client}
                            </Text>
                        </View>
                        <Pressable onPress={() => setSelectedProject(null)}>
                            <Ionicons name="close-circle-outline" size={24} color={theme.colors.onSurfaceVariant} />
                        </Pressable>
                    </View>

                    <View style={s.detailStatsRow}>
                        <View style={s.detailStatItem}>
                            <Text
                                style={[
                                    s.detailStatLabel,
                                    {
                                        color: theme.colors.onSurfaceVariant
                                    }
                                ]}
                            >
                                Budget
                            </Text>
                            <Text
                                style={[
                                    s.detailStatValue,
                                    {
                                        color: theme.colors.onSurface
                                    }
                                ]}
                            >
                                {formatCurrency(currentSelected.budget)}
                            </Text>
                        </View>
                        <View
                            style={[
                                s.detailDivider,
                                {
                                    backgroundColor: theme.colors.outlineVariant
                                }
                            ]}
                        />
                        <View style={s.detailStatItem}>
                            <Text
                                style={[
                                    s.detailStatLabel,
                                    {
                                        color: theme.colors.onSurfaceVariant
                                    }
                                ]}
                            >
                                Hours
                            </Text>
                            <Text
                                style={[
                                    s.detailStatValue,
                                    {
                                        color: hoursBarColor(
                                            currentSelected.hoursLogged,
                                            currentSelected.hoursEstimated
                                        )
                                    }
                                ]}
                            >
                                {currentSelected.hoursLogged}/{currentSelected.hoursEstimated}h
                            </Text>
                        </View>
                        <View
                            style={[
                                s.detailDivider,
                                {
                                    backgroundColor: theme.colors.outlineVariant
                                }
                            ]}
                        />
                        <View style={s.detailStatItem}>
                            <Text
                                style={[
                                    s.detailStatLabel,
                                    {
                                        color: theme.colors.onSurfaceVariant
                                    }
                                ]}
                            >
                                Deadline
                            </Text>
                            <Text
                                style={[
                                    s.detailStatValue,
                                    {
                                        color: theme.colors.onSurface
                                    }
                                ]}
                            >
                                {currentSelected.deadline}
                            </Text>
                        </View>
                    </View>

                    <HoursProgressBar logged={currentSelected.hoursLogged} estimated={currentSelected.hoursEstimated} />

                    <View style={s.detailStatusRow}>
                        <View
                            style={[
                                s.detailStatusChip,
                                {
                                    backgroundColor: `${STATUS_CONFIG[currentSelected.status].color}18`
                                }
                            ]}
                        >
                            <Ionicons
                                name={STATUS_CONFIG[currentSelected.status].icon}
                                size={14}
                                color={STATUS_CONFIG[currentSelected.status].color}
                            />
                            <Text
                                style={[
                                    s.detailStatusText,
                                    {
                                        color: STATUS_CONFIG[currentSelected.status].color
                                    }
                                ]}
                            >
                                {STATUS_CONFIG[currentSelected.status].label}
                            </Text>
                        </View>
                        <PaymentChip status={currentSelected.payment} />
                    </View>

                    <View style={s.detailActions}>
                        {currentSelected.status !== "invoiced" && (
                            <Pressable
                                onPress={() => advanceStatus(currentSelected.id)}
                                style={({ pressed }) => [
                                    s.detailButton,
                                    {
                                        backgroundColor: theme.colors.primary
                                    },
                                    pressed && {
                                        opacity: 0.85
                                    }
                                ]}
                            >
                                <Ionicons name="arrow-forward-outline" size={14} color={theme.colors.onPrimary} />
                                <Text
                                    style={[
                                        s.detailButtonText,
                                        {
                                            color: theme.colors.onPrimary
                                        }
                                    ]}
                                >
                                    Advance Stage
                                </Text>
                            </Pressable>
                        )}
                        <Pressable
                            onPress={() => cyclePayment(currentSelected.id)}
                            style={({ pressed }) => [
                                s.detailButtonOutline,
                                {
                                    borderColor: theme.colors.outlineVariant
                                },
                                pressed && {
                                    opacity: 0.85
                                }
                            ]}
                        >
                            <Ionicons name="card-outline" size={14} color={theme.colors.onSurface} />
                            <Text
                                style={[
                                    s.detailButtonOutlineText,
                                    {
                                        color: theme.colors.onSurface
                                    }
                                ]}
                            >
                                Cycle Payment
                            </Text>
                        </Pressable>
                    </View>
                </Card>
            )}

            {/* --- Projects Grouped by Status --- */}
            <View style={s.projectsSection}>
                <View style={s.projectsSectionHeader}>
                    <Ionicons name="layers-outline" size={18} color={theme.colors.primary} />
                    <Text
                        style={[
                            s.projectsSectionTitle,
                            {
                                color: theme.colors.onSurface
                            }
                        ]}
                    >
                        Projects
                    </Text>
                    <View
                        style={[
                            s.projectsTotalBadge,
                            {
                                backgroundColor: `${theme.colors.primary}18`
                            }
                        ]}
                    >
                        <Text
                            style={[
                                s.projectsTotalText,
                                {
                                    color: theme.colors.primary
                                }
                            ]}
                        >
                            {projects.length}
                        </Text>
                    </View>
                </View>

                {STATUS_ORDER.map((status) => {
                    const group = grouped[status];
                    if (group.length === 0) return null;
                    const isExpanded = expandedGroups[status];
                    return (
                        <View key={status} style={s.statusGroup}>
                            <StatusGroupHeader
                                status={status}
                                count={group.length}
                                expanded={isExpanded}
                                onToggle={() => toggleGroup(status)}
                            />
                            {isExpanded && (
                                <View style={s.statusGroupList}>
                                    {group.map((project) => (
                                        <ProjectRow
                                            key={project.id}
                                            project={project}
                                            onPress={() => setSelectedProject(project)}
                                        />
                                    ))}
                                </View>
                            )}
                        </View>
                    );
                })}
            </View>
        </ShowcasePage>
    );
}

// --- Styles ---

const s = StyleSheet.create((_theme) => ({
    // Metrics
    metricsRow: {
        flexDirection: "row",
        gap: 10
    },
    metricCard: {
        flex: 1,
        borderRadius: 12,
        padding: 14,
        gap: 6,
        alignItems: "flex-start"
    },
    metricIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center"
    },
    metricValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 22,
        lineHeight: 28,
        letterSpacing: -0.5
    },
    metricLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        lineHeight: 16
    },
    // Utilization
    utilizationCard: {
        borderRadius: 12,
        padding: 16,
        gap: 10
    },
    utilizationHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    utilizationLabelRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    utilizationTitle: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 14,
        lineHeight: 20
    },
    utilizationPercent: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 24,
        lineHeight: 30,
        letterSpacing: -0.5
    },
    utilizationTrack: {
        height: 12,
        borderRadius: 6,
        overflow: "hidden"
    },
    utilizationFill: {
        height: "100%",
        borderRadius: 6
    },
    utilizationHint: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        lineHeight: 16
    },
    // Weekly time
    weeklyCard: {
        borderRadius: 12,
        padding: 16,
        gap: 14
    },
    weeklyHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    weeklyLabelRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    weeklyTitle: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 14,
        lineHeight: 20
    },
    weeklyTotal: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 18,
        lineHeight: 24,
        letterSpacing: -0.3
    },
    weeklyBarsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-end",
        gap: 6
    },
    weeklyBarCol: {
        flex: 1,
        alignItems: "center",
        gap: 4
    },
    weeklyBarWrap: {
        height: 52,
        justifyContent: "flex-end",
        width: "100%",
        alignItems: "center"
    },
    weeklyBar: {
        width: "70%",
        borderRadius: 3,
        minHeight: 2
    },
    weeklyBarLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 10,
        lineHeight: 14
    },
    weeklyBarLabelToday: {
        fontFamily: "IBMPlexSans-SemiBold"
    },
    weeklyBarValue: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 10,
        lineHeight: 14
    },
    // Hours progress bar
    hoursBarContainer: {
        width: "100%"
    },
    hoursBarTrack: {
        height: 6,
        borderRadius: 3,
        overflow: "hidden"
    },
    hoursBarFill: {
        height: "100%",
        borderRadius: 3
    },
    // Payment chip
    paymentChip: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10
    },
    paymentChipText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11,
        lineHeight: 14
    },
    // Project row
    projectRow: {
        borderRadius: 12,
        padding: 14,
        gap: 10
    },
    projectTopRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 12
    },
    projectNameArea: {
        flex: 1,
        gap: 2
    },
    projectName: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 14,
        lineHeight: 20
    },
    projectClient: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        lineHeight: 16
    },
    projectBudget: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15,
        lineHeight: 20,
        letterSpacing: -0.3
    },
    projectMiddleRow: {
        flexDirection: "row",
        alignItems: "center"
    },
    projectHoursArea: {
        flex: 1,
        gap: 4
    },
    projectHoursLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11,
        lineHeight: 14
    },
    projectHoursValueRow: {
        flexDirection: "row",
        alignItems: "baseline",
        gap: 1
    },
    projectHoursText: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 13,
        lineHeight: 18
    },
    projectHoursSep: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 12,
        lineHeight: 18
    },
    projectHoursEst: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 12,
        lineHeight: 18
    },
    projectBottomRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    projectDeadlineRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4
    },
    projectDeadline: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11,
        lineHeight: 16
    },
    // Status group
    statusGroup: {
        gap: 8
    },
    statusGroupHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 6
    },
    statusGroupDot: {
        width: 8,
        height: 8,
        borderRadius: 4
    },
    statusGroupLabel: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 14,
        lineHeight: 20
    },
    statusGroupCount: {
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 6
    },
    statusGroupCountText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11
    },
    statusGroupSpacer: {
        flex: 1
    },
    statusGroupList: {
        gap: 8
    },
    // Projects section
    projectsSection: {
        gap: 12,
        marginTop: 4
    },
    projectsSectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    projectsSectionTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 16,
        lineHeight: 22
    },
    projectsTotalBadge: {
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 6
    },
    projectsTotalText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11
    },
    // Detail card
    detailCard: {
        borderRadius: 14,
        padding: 16,
        gap: 14
    },
    detailHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 12
    },
    detailTitleArea: {
        flex: 1,
        gap: 2
    },
    detailName: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 18,
        lineHeight: 24
    },
    detailClient: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 18
    },
    detailStatsRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12
    },
    detailStatItem: {
        flex: 1,
        alignItems: "center",
        gap: 2
    },
    detailStatLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 10,
        lineHeight: 14,
        letterSpacing: 0.5,
        textTransform: "uppercase"
    },
    detailStatValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15,
        lineHeight: 20,
        letterSpacing: -0.3
    },
    detailDivider: {
        width: 1,
        height: 28
    },
    detailStatusRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    detailStatusChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10
    },
    detailStatusText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 12
    },
    detailActions: {
        flexDirection: "row",
        gap: 10,
        justifyContent: "flex-end"
    },
    detailButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 8
    },
    detailButtonText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13
    },
    detailButtonOutline: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 8,
        borderWidth: 1
    },
    detailButtonOutlineText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13
    }
}));
