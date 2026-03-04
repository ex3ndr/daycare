import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

// --- Types ---

type Phase = "discovery" | "design" | "development" | "testing" | "launch";
type MilestoneStatus = "completed" | "in_progress" | "upcoming" | "overdue";
type Priority = "high" | "medium" | "low";

type Milestone = {
    id: string;
    title: string;
    dueDate: string;
    status: MilestoneStatus;
    completed: boolean;
};

type TimelineEntry = {
    id: string;
    date: string;
    text: string;
    author: string;
    initials: string;
};

type OpenQuestion = {
    id: string;
    text: string;
    priority: Priority;
    daysOpen: number;
    askedBy: string;
};

// --- Mock data ---

const PROJECT_NAME = "Meridian Platform Redesign";
const CLIENT_NAME = "Meridian Health";
const CURRENT_PHASE: Phase = "development";
const OVERALL_PROGRESS = 62;

const PHASES: { key: Phase; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "discovery", label: "Discovery", icon: "search-outline" },
    { key: "design", label: "Design", icon: "color-palette-outline" },
    { key: "development", label: "Development", icon: "code-slash-outline" },
    { key: "testing", label: "Testing", icon: "flask-outline" },
    { key: "launch", label: "Launch", icon: "rocket-outline" }
];

const MILESTONES: Milestone[] = [
    {
        id: "m1",
        title: "Brand audit & stakeholder interviews",
        dueDate: "Jan 15",
        status: "completed",
        completed: true
    },
    {
        id: "m2",
        title: "Information architecture & wireframes",
        dueDate: "Feb 3",
        status: "completed",
        completed: true
    },
    {
        id: "m3",
        title: "Visual design system & component library",
        dueDate: "Feb 20",
        status: "completed",
        completed: true
    },
    { id: "m4", title: "Patient portal frontend build", dueDate: "Mar 10", status: "in_progress", completed: false },
    { id: "m5", title: "Provider dashboard integration", dueDate: "Mar 18", status: "in_progress", completed: false },
    { id: "m6", title: "API layer & data migration scripts", dueDate: "Mar 5", status: "overdue", completed: false },
    { id: "m7", title: "End-to-end QA & accessibility audit", dueDate: "Apr 1", status: "upcoming", completed: false },
    { id: "m8", title: "Staging deployment & UAT signoff", dueDate: "Apr 14", status: "upcoming", completed: false },
    { id: "m9", title: "Production launch & monitoring", dueDate: "Apr 28", status: "upcoming", completed: false }
];

const TIMELINE: TimelineEntry[] = [
    {
        id: "t1",
        date: "Mar 2",
        text: "Completed patient portal login flow with biometric auth support. Passed internal code review.",
        author: "Elena Vasquez",
        initials: "EV"
    },
    {
        id: "t2",
        date: "Feb 28",
        text: "Data migration script hit edge case with legacy appointment records. Added fallback handler, retesting now.",
        author: "James Okafor",
        initials: "JO"
    },
    {
        id: "t3",
        date: "Feb 26",
        text: "Client approved final color palette and typography choices. Design system locked for development.",
        author: "Priya Sharma",
        initials: "PS"
    },
    {
        id: "t4",
        date: "Feb 22",
        text: "Wireframe review session with Dr. Chen's team. Minor revisions to appointment booking flow requested.",
        author: "Priya Sharma",
        initials: "PS"
    },
    {
        id: "t5",
        date: "Feb 18",
        text: "Kicked off development sprint 1. Set up CI/CD pipeline and staging environment.",
        author: "Elena Vasquez",
        initials: "EV"
    }
];

const OPEN_QUESTIONS: OpenQuestion[] = [
    {
        id: "q1",
        text: "Should the patient portal support multi-language from day one, or is English-only acceptable for launch?",
        priority: "high",
        daysOpen: 5,
        askedBy: "Elena Vasquez"
    },
    {
        id: "q2",
        text: "Can we get access to the production FHIR API credentials for integration testing?",
        priority: "high",
        daysOpen: 3,
        askedBy: "James Okafor"
    },
    {
        id: "q3",
        text: "Preferred date/time format for appointment displays: 12-hour or 24-hour clock?",
        priority: "medium",
        daysOpen: 7,
        askedBy: "Priya Sharma"
    },
    {
        id: "q4",
        text: "Do we need SSO integration with Meridian's existing Okta setup before launch?",
        priority: "medium",
        daysOpen: 4,
        askedBy: "Elena Vasquez"
    },
    {
        id: "q5",
        text: "Is there a preferred analytics provider, or should we propose one?",
        priority: "low",
        daysOpen: 10,
        askedBy: "James Okafor"
    }
];

const AVATAR_COLORS: Record<string, string> = {
    EV: "#6366F1",
    JO: "#EC4899",
    PS: "#14B8A6"
};

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
    high: { label: "High", color: "#EF4444", icon: "alert-circle" },
    medium: { label: "Medium", color: "#F59E0B", icon: "warning" },
    low: { label: "Low", color: "#3B82F6", icon: "information-circle-outline" }
};

const MILESTONE_STATUS_CONFIG: Record<MilestoneStatus, { label: string; color: string }> = {
    completed: { label: "Done", color: "#10B981" },
    in_progress: { label: "In Progress", color: "#3B82F6" },
    overdue: { label: "Overdue", color: "#EF4444" },
    upcoming: { label: "Upcoming", color: "#9CA3AF" }
};

// --- Phase Stepper ---

function PhaseStepper({ currentPhase }: { currentPhase: Phase }) {
    const { theme } = useUnistyles();
    const currentIndex = PHASES.findIndex((p) => p.key === currentPhase);

    return (
        <View style={s.stepperContainer}>
            {PHASES.map((phase, index) => {
                const isComplete = index < currentIndex;
                const isCurrent = index === currentIndex;
                const isLast = index === PHASES.length - 1;

                const dotColor = isComplete
                    ? "#10B981"
                    : isCurrent
                      ? theme.colors.primary
                      : theme.colors.outlineVariant;
                const lineColor = isComplete ? "#10B981" : theme.colors.outlineVariant;
                const labelColor = isCurrent
                    ? theme.colors.primary
                    : isComplete
                      ? "#10B981"
                      : theme.colors.onSurfaceVariant;

                return (
                    <View key={phase.key} style={s.stepperStep}>
                        <View style={s.stepperDotRow}>
                            {/* Dot */}
                            <View
                                style={[
                                    s.stepperDot,
                                    {
                                        backgroundColor: dotColor,
                                        borderColor: isCurrent ? `${theme.colors.primary}30` : "transparent",
                                        borderWidth: isCurrent ? 3 : 0
                                    }
                                ]}
                            >
                                {isComplete && <Ionicons name="checkmark" size={10} color="#FFFFFF" />}
                                {isCurrent && (
                                    <View style={[s.stepperCurrentInner, { backgroundColor: theme.colors.primary }]} />
                                )}
                            </View>
                            {/* Connecting line */}
                            {!isLast && <View style={[s.stepperLine, { backgroundColor: lineColor }]} />}
                        </View>
                        <Text
                            style={[
                                s.stepperLabel,
                                { color: labelColor },
                                (isCurrent || isComplete) && s.stepperLabelActive
                            ]}
                            numberOfLines={1}
                        >
                            {phase.label}
                        </Text>
                    </View>
                );
            })}
        </View>
    );
}

// --- Progress Bar ---

function ProgressBar({ progress, color, trackColor }: { progress: number; color: string; trackColor: string }) {
    const clamped = Math.min(Math.max(progress, 0), 100);
    return (
        <View style={[s.progressTrack, { backgroundColor: trackColor }]}>
            <View style={[s.progressFill, { width: `${clamped}%`, backgroundColor: color }]} />
        </View>
    );
}

// --- Milestone Card ---

function MilestoneCard({ milestone, onToggle }: { milestone: Milestone; onToggle: (id: string) => void }) {
    const { theme } = useUnistyles();
    const statusConfig = MILESTONE_STATUS_CONFIG[milestone.status];

    return (
        <View style={[s.milestoneCard, { backgroundColor: theme.colors.surfaceContainer }]}>
            {/* Checkbox */}
            <Pressable onPress={() => onToggle(milestone.id)} style={s.milestoneCheckbox}>
                <View
                    style={[
                        s.checkbox,
                        {
                            backgroundColor: milestone.completed ? "#10B981" : "transparent",
                            borderColor: milestone.completed ? "#10B981" : theme.colors.outline
                        }
                    ]}
                >
                    {milestone.completed && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                </View>
            </Pressable>

            {/* Content */}
            <View style={s.milestoneContent}>
                <Text
                    style={[
                        s.milestoneTitle,
                        { color: milestone.completed ? theme.colors.onSurfaceVariant : theme.colors.onSurface },
                        milestone.completed && s.milestoneTitleDone
                    ]}
                    numberOfLines={2}
                >
                    {milestone.title}
                </Text>
                <View style={s.milestoneFooter}>
                    <View style={s.milestoneDateRow}>
                        <Ionicons name="calendar-outline" size={12} color={theme.colors.onSurfaceVariant} />
                        <Text style={[s.milestoneDateText, { color: theme.colors.onSurfaceVariant }]}>
                            {milestone.dueDate}
                        </Text>
                    </View>
                    <View style={[s.statusBadge, { backgroundColor: `${statusConfig.color}18` }]}>
                        <Text style={[s.statusBadgeText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
                    </View>
                </View>
            </View>
        </View>
    );
}

// --- Timeline Entry ---

function TimelineEntryRow({ entry, isLast }: { entry: TimelineEntry; isLast: boolean }) {
    const { theme } = useUnistyles();
    const [expanded, setExpanded] = React.useState(false);
    const avatarColor = AVATAR_COLORS[entry.initials] ?? theme.colors.primary;

    return (
        <View style={s.timelineRow}>
            {/* Vertical line and dot */}
            <View style={s.timelineSide}>
                <View style={[s.timelineDot, { backgroundColor: avatarColor }]} />
                {!isLast && <View style={[s.timelineVerticalLine, { backgroundColor: theme.colors.outlineVariant }]} />}
            </View>

            {/* Entry content */}
            <Pressable
                onPress={() => setExpanded((prev) => !prev)}
                style={[s.timelineCard, { backgroundColor: theme.colors.surfaceContainer }]}
            >
                <View style={s.timelineCardHeader}>
                    <Text style={[s.timelineDate, { color: theme.colors.primary }]}>{entry.date}</Text>
                    <Ionicons
                        name={expanded ? "chevron-up" : "chevron-down"}
                        size={14}
                        color={theme.colors.onSurfaceVariant}
                    />
                </View>
                <Text
                    style={[s.timelineText, { color: theme.colors.onSurface }]}
                    numberOfLines={expanded ? undefined : 2}
                >
                    {entry.text}
                </Text>
                <View style={s.timelineAuthorRow}>
                    <View style={[s.timelineAvatar, { backgroundColor: `${avatarColor}20` }]}>
                        <Text style={[s.timelineAvatarText, { color: avatarColor }]}>{entry.initials}</Text>
                    </View>
                    <Text style={[s.timelineAuthorName, { color: theme.colors.onSurfaceVariant }]}>{entry.author}</Text>
                </View>
            </Pressable>
        </View>
    );
}

// --- Open Question Card ---

function QuestionCard({ question }: { question: OpenQuestion }) {
    const { theme } = useUnistyles();
    const priorityConfig = PRIORITY_CONFIG[question.priority];

    return (
        <View
            style={[
                s.questionCard,
                {
                    backgroundColor: theme.colors.surfaceContainer,
                    borderLeftColor: priorityConfig.color
                }
            ]}
        >
            <View style={s.questionHeader}>
                <View style={[s.priorityChip, { backgroundColor: `${priorityConfig.color}18` }]}>
                    <Ionicons name={priorityConfig.icon} size={12} color={priorityConfig.color} />
                    <Text style={[s.priorityChipText, { color: priorityConfig.color }]}>{priorityConfig.label}</Text>
                </View>
                <Text style={[s.questionDays, { color: theme.colors.onSurfaceVariant }]}>
                    {question.daysOpen}d open
                </Text>
            </View>
            <Text style={[s.questionText, { color: theme.colors.onSurface }]}>{question.text}</Text>
            <Text style={[s.questionAskedBy, { color: theme.colors.onSurfaceVariant }]}>
                Asked by {question.askedBy}
            </Text>
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
        <View style={s.sectionHeader}>
            <Ionicons name={icon} size={18} color={theme.colors.primary} />
            <Text style={[s.sectionTitle, { color: theme.colors.onSurface }]}>{title}</Text>
            {count !== undefined && (
                <View style={[s.sectionCount, { backgroundColor: `${theme.colors.primary}18` }]}>
                    <Text style={[s.sectionCountText, { color: theme.colors.primary }]}>{count}</Text>
                </View>
            )}
        </View>
    );
}

// --- Main Component ---

export function ClientProjectsPage() {
    const { theme } = useUnistyles();
    const [milestones, setMilestones] = React.useState(MILESTONES);

    const toggleMilestone = React.useCallback((id: string) => {
        setMilestones((prev) =>
            prev.map((m) => {
                if (m.id !== id) return m;
                const newCompleted = !m.completed;
                return {
                    ...m,
                    completed: newCompleted,
                    status: newCompleted
                        ? ("completed" as MilestoneStatus)
                        : m.status === "completed"
                          ? ("upcoming" as MilestoneStatus)
                          : m.status
                };
            })
        );
    }, []);

    const completedCount = milestones.filter((m) => m.completed).length;
    const totalCount = milestones.length;

    return (
        <ScrollView contentContainerStyle={s.root} showsVerticalScrollIndicator={false}>
            {/* --- Project Header --- */}
            <View style={[s.headerCard, { backgroundColor: theme.colors.surfaceContainer }]}>
                {/* Top accent bar */}
                <View style={[s.headerAccent, { backgroundColor: theme.colors.primary }]} />

                <View style={s.headerInner}>
                    {/* Project icon and name */}
                    <View style={s.headerTopRow}>
                        <View style={[s.projectIconCircle, { backgroundColor: `${theme.colors.primary}18` }]}>
                            <Ionicons name="briefcase-outline" size={22} color={theme.colors.primary} />
                        </View>
                        <View style={s.headerTitleArea}>
                            <Text style={[s.projectName, { color: theme.colors.onSurface }]}>{PROJECT_NAME}</Text>
                            <Text style={[s.clientName, { color: theme.colors.onSurfaceVariant }]}>{CLIENT_NAME}</Text>
                        </View>
                    </View>

                    {/* Progress section */}
                    <View style={s.progressSection}>
                        <View style={s.progressLabelRow}>
                            <Text style={[s.progressLabel, { color: theme.colors.onSurfaceVariant }]}>
                                Overall Progress
                            </Text>
                            <Text style={[s.progressValue, { color: theme.colors.primary }]}>{OVERALL_PROGRESS}%</Text>
                        </View>
                        <ProgressBar
                            progress={OVERALL_PROGRESS}
                            color={theme.colors.primary}
                            trackColor={`${theme.colors.primary}18`}
                        />
                    </View>

                    {/* Stats row */}
                    <View style={s.statsRow}>
                        <View style={[s.statCard, { backgroundColor: theme.colors.surface }]}>
                            <Text style={[s.statValue, { color: "#10B981" }]}>{completedCount}</Text>
                            <Text style={[s.statLabel, { color: theme.colors.onSurfaceVariant }]}>Completed</Text>
                        </View>
                        <View style={[s.statCard, { backgroundColor: theme.colors.surface }]}>
                            <Text style={[s.statValue, { color: "#3B82F6" }]}>
                                {milestones.filter((m) => m.status === "in_progress").length}
                            </Text>
                            <Text style={[s.statLabel, { color: theme.colors.onSurfaceVariant }]}>In Progress</Text>
                        </View>
                        <View style={[s.statCard, { backgroundColor: theme.colors.surface }]}>
                            <Text style={[s.statValue, { color: "#EF4444" }]}>
                                {milestones.filter((m) => m.status === "overdue").length}
                            </Text>
                            <Text style={[s.statLabel, { color: theme.colors.onSurfaceVariant }]}>Overdue</Text>
                        </View>
                        <View style={[s.statCard, { backgroundColor: theme.colors.surface }]}>
                            <Text style={[s.statValue, { color: theme.colors.onSurface }]}>{totalCount}</Text>
                            <Text style={[s.statLabel, { color: theme.colors.onSurfaceVariant }]}>Total</Text>
                        </View>
                    </View>

                    {/* Phase Stepper */}
                    <PhaseStepper currentPhase={CURRENT_PHASE} />
                </View>
            </View>

            {/* --- Milestones Section --- */}
            <View style={s.section}>
                <SectionHeader title="Milestones" icon="flag-outline" count={totalCount} />
                <View style={s.milestoneList}>
                    {milestones.map((milestone) => (
                        <MilestoneCard key={milestone.id} milestone={milestone} onToggle={toggleMilestone} />
                    ))}
                </View>
            </View>

            {/* --- Recent Updates Section --- */}
            <View style={s.section}>
                <SectionHeader title="Recent Updates" icon="time-outline" count={TIMELINE.length} />
                <View style={s.timelineContainer}>
                    {TIMELINE.map((entry, index) => (
                        <TimelineEntryRow key={entry.id} entry={entry} isLast={index === TIMELINE.length - 1} />
                    ))}
                </View>
            </View>

            {/* --- Open Questions Section --- */}
            <View style={s.section}>
                <SectionHeader title="Open Questions" icon="help-circle-outline" count={OPEN_QUESTIONS.length} />
                <View style={s.questionList}>
                    {OPEN_QUESTIONS.map((question) => (
                        <QuestionCard key={question.id} question={question} />
                    ))}
                </View>
            </View>
        </ScrollView>
    );
}

// --- Styles ---

const s = StyleSheet.create((theme) => ({
    root: {
        maxWidth: theme.layout.maxWidth,
        width: "100%",
        alignSelf: "center",
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 48,
        gap: 24
    },

    // Header card
    headerCard: {
        borderRadius: 16,
        overflow: "hidden"
    },
    headerAccent: {
        height: 4
    },
    headerInner: {
        padding: 16,
        gap: 16
    },
    headerTopRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12
    },
    projectIconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center"
    },
    headerTitleArea: {
        flex: 1,
        gap: 2
    },
    projectName: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 20,
        lineHeight: 26
    },
    clientName: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 18
    },

    // Progress
    progressSection: {
        gap: 8
    },
    progressLabelRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "baseline"
    },
    progressLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13
    },
    progressValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 18,
        lineHeight: 24
    },
    progressTrack: {
        height: 10,
        borderRadius: 5,
        overflow: "hidden"
    },
    progressFill: {
        height: "100%",
        borderRadius: 5
    },

    // Stats row
    statsRow: {
        flexDirection: "row",
        gap: 8
    },
    statCard: {
        flex: 1,
        alignItems: "center",
        paddingVertical: 10,
        borderRadius: 10,
        gap: 2
    },
    statValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 20,
        lineHeight: 26
    },
    statLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 10,
        lineHeight: 14
    },

    // Phase stepper
    stepperContainer: {
        flexDirection: "row",
        alignItems: "flex-start",
        paddingTop: 4
    },
    stepperStep: {
        flex: 1,
        alignItems: "center",
        gap: 6
    },
    stepperDotRow: {
        flexDirection: "row",
        alignItems: "center",
        width: "100%",
        justifyContent: "center"
    },
    stepperDot: {
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2
    },
    stepperCurrentInner: {
        width: 8,
        height: 8,
        borderRadius: 4
    },
    stepperLine: {
        flex: 1,
        height: 2,
        marginLeft: -1,
        marginRight: -1,
        zIndex: 1
    },
    stepperLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 10,
        lineHeight: 14,
        textAlign: "center"
    },
    stepperLabelActive: {
        fontFamily: "IBMPlexSans-Regular"
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
        fontSize: 16,
        lineHeight: 22
    },
    sectionCount: {
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 6
    },
    sectionCountText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },

    // Milestones
    milestoneList: {
        gap: 8
    },
    milestoneCard: {
        flexDirection: "row",
        borderRadius: 12,
        padding: 12,
        gap: 12,
        alignItems: "flex-start"
    },
    milestoneCheckbox: {
        paddingTop: 2
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        alignItems: "center",
        justifyContent: "center"
    },
    milestoneContent: {
        flex: 1,
        gap: 6
    },
    milestoneTitle: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14,
        lineHeight: 20
    },
    milestoneTitleDone: {
        textDecorationLine: "line-through",
        opacity: 0.6
    },
    milestoneFooter: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between"
    },
    milestoneDateRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4
    },
    milestoneDateText: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11,
        lineHeight: 16
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8
    },
    statusBadgeText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },

    // Timeline
    timelineContainer: {
        paddingLeft: 4
    },
    timelineRow: {
        flexDirection: "row",
        gap: 12
    },
    timelineSide: {
        alignItems: "center",
        width: 20
    },
    timelineDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginTop: 14,
        zIndex: 2
    },
    timelineVerticalLine: {
        width: 2,
        flex: 1,
        marginTop: -1,
        zIndex: 1
    },
    timelineCard: {
        flex: 1,
        borderRadius: 12,
        padding: 12,
        gap: 8,
        marginBottom: 8
    },
    timelineCardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    timelineDate: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 13,
        lineHeight: 18
    },
    timelineText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 19
    },
    timelineAuthorRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginTop: 2
    },
    timelineAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center"
    },
    timelineAvatarText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 9
    },
    timelineAuthorName: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        lineHeight: 16
    },

    // Questions
    questionList: {
        gap: 8
    },
    questionCard: {
        borderRadius: 12,
        borderLeftWidth: 4,
        padding: 14,
        gap: 8
    },
    questionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    priorityChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10
    },
    priorityChipText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },
    questionDays: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11
    },
    questionText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14,
        lineHeight: 20
    },
    questionAskedBy: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        lineHeight: 16
    }
}));
