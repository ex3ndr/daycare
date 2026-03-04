import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

// --- Types ---

type RetroItem = {
    id: string;
    text: string;
    votes: number;
    author: string;
};

type ActionItem = {
    id: string;
    description: string;
    assignee: string;
    assigneeInitials: string;
    dueDate: string;
    done: boolean;
    carriedOver: boolean;
};

type PreviousAction = {
    id: string;
    description: string;
    assignee: string;
    assigneeInitials: string;
    completed: boolean;
    fromSprint: string;
};

// --- Mock data ---

const SPRINT_NUMBER = 24;
const SPRINT_DATE_RANGE = "Feb 24 - Mar 7, 2026";
const PARTICIPANT_COUNT = 8;

const PARTICIPANTS = [
    { initials: "JK", color: "#3B82F6" },
    { initials: "SM", color: "#8B5CF6" },
    { initials: "AL", color: "#EC4899" },
    { initials: "RD", color: "#F59E0B" },
    { initials: "KM", color: "#10B981" },
    { initials: "NP", color: "#EF4444" },
    { initials: "TW", color: "#06B6D4" },
    { initials: "BL", color: "#6366F1" }
];

const INITIAL_WENT_WELL: RetroItem[] = [
    { id: "w1", text: "Deployment pipeline improvements saved hours of manual work", votes: 6, author: "JK" },
    { id: "w2", text: "Great cross-team collaboration on the auth migration", votes: 5, author: "SM" },
    { id: "w3", text: "Sprint goal achieved ahead of schedule", votes: 4, author: "AL" },
    { id: "w4", text: "New code review process caught several bugs early", votes: 3, author: "RD" },
    { id: "w5", text: "Knowledge sharing sessions were very helpful", votes: 2, author: "KM" }
];

const INITIAL_COULD_IMPROVE: RetroItem[] = [
    { id: "i1", text: "Story estimation was off for backend tasks this sprint", votes: 5, author: "RD" },
    { id: "i2", text: "Too many context switches between projects", votes: 4, author: "NP" },
    { id: "i3", text: "Staging environment was unstable for two days", votes: 3, author: "TW" },
    { id: "i4", text: "Documentation not updated after API changes", votes: 2, author: "SM" },
    { id: "i5", text: "Standup meetings running over 15 minutes regularly", votes: 1, author: "BL" }
];

const INITIAL_ACTION_ITEMS: ActionItem[] = [
    {
        id: "a1",
        description: "Set up estimation calibration session for backend team",
        assignee: "Rachel Diaz",
        assigneeInitials: "RD",
        dueDate: "Mar 10",
        done: false,
        carriedOver: false
    },
    {
        id: "a2",
        description: "Implement staging environment health checks",
        assignee: "Tom Wang",
        assigneeInitials: "TW",
        dueDate: "Mar 14",
        done: false,
        carriedOver: false
    },
    {
        id: "a3",
        description: "Add API changelog automation to CI pipeline",
        assignee: "Sarah Mitchell",
        assigneeInitials: "SM",
        dueDate: "Mar 12",
        done: false,
        carriedOver: false
    },
    {
        id: "a4",
        description: "Introduce async standup format trial for 2 weeks",
        assignee: "Ben Lee",
        assigneeInitials: "BL",
        dueDate: "Mar 9",
        done: false,
        carriedOver: false
    },
    {
        id: "a5",
        description: "Create runbook for deployment rollback procedures",
        assignee: "Jake Kim",
        assigneeInitials: "JK",
        dueDate: "Mar 7",
        done: true,
        carriedOver: true
    }
];

const PREVIOUS_ACTIONS: PreviousAction[] = [
    {
        id: "pa1",
        description: "Set up automated regression test suite",
        assignee: "Jake Kim",
        assigneeInitials: "JK",
        completed: true,
        fromSprint: "Sprint 23"
    },
    {
        id: "pa2",
        description: "Document onboarding process for new developers",
        assignee: "Amy Lin",
        assigneeInitials: "AL",
        completed: true,
        fromSprint: "Sprint 23"
    },
    {
        id: "pa3",
        description: "Create runbook for deployment rollback procedures",
        assignee: "Jake Kim",
        assigneeInitials: "JK",
        completed: false,
        fromSprint: "Sprint 23"
    },
    {
        id: "pa4",
        description: "Review and update team working agreement",
        assignee: "Sarah Mitchell",
        assigneeInitials: "SM",
        completed: true,
        fromSprint: "Sprint 22"
    },
    {
        id: "pa5",
        description: "Investigate flaky e2e tests in CI",
        assignee: "Nick Park",
        assigneeInitials: "NP",
        completed: false,
        fromSprint: "Sprint 22"
    }
];

// --- Colors ---

const GREEN_TINT = "#10B981";
const AMBER_TINT = "#F59E0B";

// --- Helper ---

function getParticipantColor(initials: string): string {
    const p = PARTICIPANTS.find((pp) => pp.initials === initials);
    return p?.color ?? "#9CA3AF";
}

// --- Components ---

function ParticipantAvatars() {
    const { theme } = useUnistyles();
    const maxVisible = 6;
    const visible = PARTICIPANTS.slice(0, maxVisible);
    const overflow = PARTICIPANT_COUNT - maxVisible;

    return (
        <View style={s.avatarRow}>
            {visible.map((p, idx) => (
                <View
                    key={p.initials}
                    style={[
                        s.avatar,
                        {
                            backgroundColor: `${p.color}20`,
                            borderColor: theme.colors.surface,
                            marginLeft: idx > 0 ? -8 : 0,
                            zIndex: maxVisible - idx
                        }
                    ]}
                >
                    <Text style={[s.avatarText, { color: p.color }]}>{p.initials}</Text>
                </View>
            ))}
            {overflow > 0 && (
                <View
                    style={[
                        s.avatar,
                        {
                            backgroundColor: theme.colors.surfaceContainer,
                            borderColor: theme.colors.surface,
                            marginLeft: -8,
                            zIndex: 0
                        }
                    ]}
                >
                    <Text style={[s.avatarText, { color: theme.colors.onSurfaceVariant }]}>+{overflow}</Text>
                </View>
            )}
        </View>
    );
}

function VoteButton({ votes, onVote }: { votes: number; onVote: () => void }) {
    const { theme } = useUnistyles();

    return (
        <Pressable onPress={onVote} style={[s.voteButton, { backgroundColor: theme.colors.surfaceContainerHighest }]}>
            <Ionicons name="chevron-up-outline" size={14} color={theme.colors.primary} />
            <Text style={[s.voteCount, { color: theme.colors.primary }]}>{votes}</Text>
        </Pressable>
    );
}

function RetroItemRow({ item, accentColor, onVote }: { item: RetroItem; accentColor: string; onVote: () => void }) {
    const { theme } = useUnistyles();

    return (
        <View style={[s.retroItemRow, { backgroundColor: theme.colors.surface }]}>
            <View style={[s.retroItemAccent, { backgroundColor: accentColor }]} />
            <View style={s.retroItemContent}>
                <Text style={[s.retroItemText, { color: theme.colors.onSurface }]}>{item.text}</Text>
                <View style={s.retroItemFooter}>
                    <View style={[s.authorChip, { backgroundColor: `${getParticipantColor(item.author)}20` }]}>
                        <Text style={[s.authorChipText, { color: getParticipantColor(item.author) }]}>
                            {item.author}
                        </Text>
                    </View>
                    <VoteButton votes={item.votes} onVote={onVote} />
                </View>
            </View>
        </View>
    );
}

function RetroSection({
    title,
    icon,
    accentColor,
    items,
    onVote,
    onAdd
}: {
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
    accentColor: string;
    items: RetroItem[];
    onVote: (id: string) => void;
    onAdd: () => void;
}) {
    const { theme } = useUnistyles();
    const sorted = [...items].sort((a, b) => b.votes - a.votes);

    return (
        <View style={[s.sectionCard, { backgroundColor: `${accentColor}08`, borderColor: `${accentColor}30` }]}>
            <View style={s.sectionHeader}>
                <View style={[s.sectionIconCircle, { backgroundColor: `${accentColor}20` }]}>
                    <Ionicons name={icon} size={18} color={accentColor} />
                </View>
                <Text style={[s.sectionTitle, { color: theme.colors.onSurface }]}>{title}</Text>
                <View style={[s.sectionCount, { backgroundColor: `${accentColor}20` }]}>
                    <Text style={[s.sectionCountText, { color: accentColor }]}>{items.length}</Text>
                </View>
            </View>

            <View style={s.sectionItems}>
                {sorted.map((item) => (
                    <RetroItemRow key={item.id} item={item} accentColor={accentColor} onVote={() => onVote(item.id)} />
                ))}
            </View>

            <Pressable onPress={onAdd} style={[s.addButton, { borderColor: `${accentColor}40` }]}>
                <Ionicons name="add-circle-outline" size={18} color={accentColor} />
                <Text style={[s.addButtonText, { color: accentColor }]}>Add item</Text>
            </Pressable>
        </View>
    );
}

function ActionItemCard({ item, onToggle }: { item: ActionItem; onToggle: () => void }) {
    const { theme } = useUnistyles();
    const assigneeColor = getParticipantColor(item.assigneeInitials);

    return (
        <View style={[s.actionCard, { backgroundColor: theme.colors.surface }]}>
            <View style={s.actionCardTop}>
                <Pressable onPress={onToggle} style={s.checkbox}>
                    {item.done ? (
                        <View style={[s.checkboxChecked, { backgroundColor: theme.colors.primary }]}>
                            <Ionicons name="checkmark" size={14} color="#ffffff" />
                        </View>
                    ) : (
                        <View style={[s.checkboxUnchecked, { borderColor: theme.colors.outline }]} />
                    )}
                </Pressable>
                <View style={s.actionCardContent}>
                    <Text
                        style={[
                            s.actionDescription,
                            { color: item.done ? theme.colors.onSurfaceVariant : theme.colors.onSurface },
                            item.done && s.strikethrough
                        ]}
                    >
                        {item.description}
                    </Text>
                </View>
            </View>
            <View style={s.actionCardBottom}>
                <View style={[s.actionAvatar, { backgroundColor: `${assigneeColor}20` }]}>
                    <Text style={[s.actionAvatarText, { color: assigneeColor }]}>{item.assigneeInitials}</Text>
                </View>
                <Text style={[s.actionAssignee, { color: theme.colors.onSurfaceVariant }]}>{item.assignee}</Text>
                <View style={s.actionCardRight}>
                    {item.carriedOver && (
                        <View style={[s.carriedOverBadge, { backgroundColor: `${AMBER_TINT}18` }]}>
                            <Ionicons name="repeat-outline" size={12} color={AMBER_TINT} />
                            <Text style={[s.carriedOverText, { color: AMBER_TINT }]}>Carried over</Text>
                        </View>
                    )}
                    <View style={[s.dueDateChip, { backgroundColor: theme.colors.surfaceContainer }]}>
                        <Ionicons name="calendar-outline" size={12} color={theme.colors.onSurfaceVariant} />
                        <Text style={[s.dueDateText, { color: theme.colors.onSurfaceVariant }]}>{item.dueDate}</Text>
                    </View>
                </View>
            </View>
        </View>
    );
}

function PreviousActionRow({ action }: { action: PreviousAction }) {
    const { theme } = useUnistyles();
    const assigneeColor = getParticipantColor(action.assigneeInitials);

    return (
        <View style={[s.prevActionRow, { backgroundColor: theme.colors.surface }]}>
            <View style={s.prevActionLeft}>
                {action.completed ? (
                    <View style={[s.prevStatusDot, { backgroundColor: GREEN_TINT }]}>
                        <Ionicons name="checkmark" size={10} color="#ffffff" />
                    </View>
                ) : (
                    <View style={[s.prevStatusDot, { backgroundColor: theme.colors.error }]}>
                        <Ionicons name="close" size={10} color="#ffffff" />
                    </View>
                )}
                <View style={s.prevActionContent}>
                    <Text
                        style={[
                            s.prevActionText,
                            { color: action.completed ? theme.colors.onSurfaceVariant : theme.colors.onSurface },
                            action.completed && s.strikethrough
                        ]}
                    >
                        {action.description}
                    </Text>
                    <View style={s.prevActionMeta}>
                        <View style={[s.miniAvatar, { backgroundColor: `${assigneeColor}20` }]}>
                            <Text style={[s.miniAvatarText, { color: assigneeColor }]}>{action.assigneeInitials}</Text>
                        </View>
                        <Text style={[s.prevActionFrom, { color: theme.colors.onSurfaceVariant }]}>
                            {action.fromSprint}
                        </Text>
                    </View>
                </View>
            </View>
            <View
                style={[
                    s.prevStatusBadge,
                    { backgroundColor: action.completed ? `${GREEN_TINT}18` : `${theme.colors.error}18` }
                ]}
            >
                <Text style={[s.prevStatusText, { color: action.completed ? GREEN_TINT : theme.colors.error }]}>
                    {action.completed ? "Done" : "Open"}
                </Text>
            </View>
        </View>
    );
}

// --- Main component ---

export function RetrospectiveBoardPage() {
    const { theme } = useUnistyles();
    const [wentWell, setWentWell] = React.useState(INITIAL_WENT_WELL);
    const [couldImprove, setCouldImprove] = React.useState(INITIAL_COULD_IMPROVE);
    const [actionItems, setActionItems] = React.useState(INITIAL_ACTION_ITEMS);

    const handleVoteWell = React.useCallback((id: string) => {
        setWentWell((prev) => prev.map((item) => (item.id === id ? { ...item, votes: item.votes + 1 } : item)));
    }, []);

    const handleVoteImprove = React.useCallback((id: string) => {
        setCouldImprove((prev) => prev.map((item) => (item.id === id ? { ...item, votes: item.votes + 1 } : item)));
    }, []);

    const handleAddWell = React.useCallback(() => {
        const newId = `w${Date.now()}`;
        setWentWell((prev) => [...prev, { id: newId, text: "New item added by you", votes: 0, author: "JK" }]);
    }, []);

    const handleAddImprove = React.useCallback(() => {
        const newId = `i${Date.now()}`;
        setCouldImprove((prev) => [...prev, { id: newId, text: "New improvement suggestion", votes: 0, author: "JK" }]);
    }, []);

    const handleToggleAction = React.useCallback((id: string) => {
        setActionItems((prev) => prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item)));
    }, []);

    const handleAddAction = React.useCallback(() => {
        const newId = `a${Date.now()}`;
        setActionItems((prev) => [
            ...prev,
            {
                id: newId,
                description: "New action item",
                assignee: "Jake Kim",
                assigneeInitials: "JK",
                dueDate: "Mar 14",
                done: false,
                carriedOver: false
            }
        ]);
    }, []);

    const completedActions = actionItems.filter((a) => a.done).length;
    const prevCompleted = PREVIOUS_ACTIONS.filter((a) => a.completed).length;

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: theme.colors.surface }}
            contentContainerStyle={s.root}
            showsVerticalScrollIndicator={false}
        >
            {/* Sprint header */}
            <View style={[s.headerCard, { backgroundColor: theme.colors.surfaceContainer }]}>
                <View style={s.headerTop}>
                    <View>
                        <Text style={[s.sprintLabel, { color: theme.colors.onSurfaceVariant }]}>RETROSPECTIVE</Text>
                        <Text style={[s.sprintTitle, { color: theme.colors.onSurface }]}>Sprint {SPRINT_NUMBER}</Text>
                        <Text style={[s.sprintDates, { color: theme.colors.onSurfaceVariant }]}>
                            {SPRINT_DATE_RANGE}
                        </Text>
                    </View>
                    <View style={[s.statusBadge, { backgroundColor: `${theme.colors.primary}18` }]}>
                        <Ionicons name="chatbubbles-outline" size={14} color={theme.colors.primary} />
                        <Text style={[s.statusBadgeText, { color: theme.colors.primary }]}>In Progress</Text>
                    </View>
                </View>

                <View style={s.headerDivider}>
                    <View style={[s.dividerLine, { backgroundColor: theme.colors.outlineVariant }]} />
                </View>

                <View style={s.headerBottom}>
                    <ParticipantAvatars />
                    <View style={[s.participantCount, { backgroundColor: theme.colors.surfaceContainerHighest }]}>
                        <Ionicons name="people-outline" size={14} color={theme.colors.onSurfaceVariant} />
                        <Text style={[s.participantCountText, { color: theme.colors.onSurfaceVariant }]}>
                            {PARTICIPANT_COUNT} participants
                        </Text>
                    </View>
                </View>
            </View>

            {/* Summary metrics */}
            <View style={s.metricsRow}>
                <View style={[s.metricCard, { backgroundColor: `${GREEN_TINT}12` }]}>
                    <Text style={[s.metricValue, { color: GREEN_TINT }]}>{wentWell.length}</Text>
                    <Text style={[s.metricLabel, { color: theme.colors.onSurfaceVariant }]}>Positives</Text>
                </View>
                <View style={[s.metricCard, { backgroundColor: `${AMBER_TINT}12` }]}>
                    <Text style={[s.metricValue, { color: AMBER_TINT }]}>{couldImprove.length}</Text>
                    <Text style={[s.metricLabel, { color: theme.colors.onSurfaceVariant }]}>To Improve</Text>
                </View>
                <View style={[s.metricCard, { backgroundColor: `${theme.colors.primary}12` }]}>
                    <Text style={[s.metricValue, { color: theme.colors.primary }]}>
                        {completedActions}/{actionItems.length}
                    </Text>
                    <Text style={[s.metricLabel, { color: theme.colors.onSurfaceVariant }]}>Actions</Text>
                </View>
            </View>

            {/* What Went Well */}
            <RetroSection
                title="What Went Well"
                icon="thumbs-up-outline"
                accentColor={GREEN_TINT}
                items={wentWell}
                onVote={handleVoteWell}
                onAdd={handleAddWell}
            />

            {/* What Could Improve */}
            <RetroSection
                title="What Could Improve"
                icon="trending-up-outline"
                accentColor={AMBER_TINT}
                items={couldImprove}
                onVote={handleVoteImprove}
                onAdd={handleAddImprove}
            />

            {/* Action Items */}
            <View
                style={[
                    s.sectionCard,
                    { backgroundColor: theme.colors.surfaceContainer, borderColor: theme.colors.outlineVariant }
                ]}
            >
                <View style={s.sectionHeader}>
                    <View style={[s.sectionIconCircle, { backgroundColor: `${theme.colors.primary}20` }]}>
                        <Ionicons name="rocket-outline" size={18} color={theme.colors.primary} />
                    </View>
                    <Text style={[s.sectionTitle, { color: theme.colors.onSurface }]}>Action Items</Text>
                    <View style={[s.sectionCount, { backgroundColor: `${theme.colors.primary}20` }]}>
                        <Text style={[s.sectionCountText, { color: theme.colors.primary }]}>
                            {completedActions}/{actionItems.length}
                        </Text>
                    </View>
                </View>

                {/* Progress bar */}
                <View style={[s.progressBarBg, { backgroundColor: `${theme.colors.outlineVariant}40` }]}>
                    <View
                        style={[
                            s.progressBarFill,
                            {
                                backgroundColor: theme.colors.primary,
                                width: `${actionItems.length > 0 ? (completedActions / actionItems.length) * 100 : 0}%`
                            }
                        ]}
                    />
                </View>

                <View style={s.sectionItems}>
                    {actionItems.map((item) => (
                        <ActionItemCard key={item.id} item={item} onToggle={() => handleToggleAction(item.id)} />
                    ))}
                </View>

                <Pressable
                    onPress={handleAddAction}
                    style={[s.addButton, { borderColor: theme.colors.outlineVariant }]}
                >
                    <Ionicons name="add-circle-outline" size={18} color={theme.colors.primary} />
                    <Text style={[s.addButtonText, { color: theme.colors.primary }]}>Add action item</Text>
                </Pressable>
            </View>

            {/* Previous Retro Actions */}
            <View
                style={[
                    s.sectionCard,
                    { backgroundColor: theme.colors.surfaceContainer, borderColor: theme.colors.outlineVariant }
                ]}
            >
                <View style={s.sectionHeader}>
                    <View style={[s.sectionIconCircle, { backgroundColor: `${theme.colors.tertiary}20` }]}>
                        <Ionicons name="time-outline" size={18} color={theme.colors.tertiary} />
                    </View>
                    <Text style={[s.sectionTitle, { color: theme.colors.onSurface }]}>Previous Retro Actions</Text>
                    <View style={[s.sectionCount, { backgroundColor: `${theme.colors.tertiary}20` }]}>
                        <Text style={[s.sectionCountText, { color: theme.colors.tertiary }]}>
                            {prevCompleted}/{PREVIOUS_ACTIONS.length}
                        </Text>
                    </View>
                </View>

                {/* Previous actions progress bar */}
                <View style={[s.progressBarBg, { backgroundColor: `${theme.colors.outlineVariant}40` }]}>
                    <View
                        style={[
                            s.progressBarFill,
                            {
                                backgroundColor: theme.colors.tertiary,
                                width: `${PREVIOUS_ACTIONS.length > 0 ? (prevCompleted / PREVIOUS_ACTIONS.length) * 100 : 0}%`
                            }
                        ]}
                    />
                </View>

                <View style={s.sectionItems}>
                    {PREVIOUS_ACTIONS.map((action) => (
                        <PreviousActionRow key={action.id} action={action} />
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
        padding: 16,
        gap: 16,
        paddingBottom: 40
    },

    // Header card
    headerCard: {
        borderRadius: 16,
        padding: 16,
        gap: 12
    },
    headerTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start"
    },
    sprintLabel: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 11,
        lineHeight: 14,
        letterSpacing: 1
    },
    sprintTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 24,
        lineHeight: 30,
        marginTop: 4
    },
    sprintDates: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 18,
        marginTop: 2
    },
    statusBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12
    },
    statusBadgeText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 12,
        lineHeight: 16
    },
    headerDivider: {
        paddingVertical: 2
    },
    dividerLine: {
        height: 1
    },
    headerBottom: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    avatarRow: {
        flexDirection: "row",
        alignItems: "center"
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2
    },
    avatarText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 10,
        lineHeight: 14
    },
    participantCount: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12
    },
    participantCountText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        lineHeight: 16
    },

    // Metrics row
    metricsRow: {
        flexDirection: "row",
        gap: 8
    },
    metricCard: {
        flex: 1,
        alignItems: "center",
        paddingVertical: 12,
        borderRadius: 12,
        gap: 2
    },
    metricValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 20,
        lineHeight: 26
    },
    metricLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11,
        lineHeight: 14
    },

    // Section card (shared across went well, improve, action items, previous)
    sectionCard: {
        borderRadius: 14,
        padding: 16,
        gap: 12,
        borderWidth: 1
    },
    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    sectionIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center"
    },
    sectionTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 16,
        lineHeight: 22,
        flex: 1
    },
    sectionCount: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10
    },
    sectionCountText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 12,
        lineHeight: 16
    },
    sectionItems: {
        gap: 8
    },

    // Retro item row
    retroItemRow: {
        flexDirection: "row",
        borderRadius: 10,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowOffset: { width: 0, height: 1 },
        shadowRadius: 2,
        elevation: 1
    },
    retroItemAccent: {
        width: 4
    },
    retroItemContent: {
        flex: 1,
        padding: 12,
        gap: 8
    },
    retroItemText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14,
        lineHeight: 20
    },
    retroItemFooter: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    authorChip: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8
    },
    authorChipText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11,
        lineHeight: 16
    },

    // Vote button
    voteButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12
    },
    voteCount: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 12,
        lineHeight: 16
    },

    // Add button
    addButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderStyle: "dashed"
    },
    addButtonText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13,
        lineHeight: 18
    },

    // Action item card
    actionCard: {
        borderRadius: 10,
        padding: 12,
        gap: 10,
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowOffset: { width: 0, height: 1 },
        shadowRadius: 2,
        elevation: 1
    },
    actionCardTop: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10
    },
    checkbox: {
        marginTop: 2
    },
    checkboxChecked: {
        width: 22,
        height: 22,
        borderRadius: 6,
        alignItems: "center",
        justifyContent: "center"
    },
    checkboxUnchecked: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2
    },
    actionCardContent: {
        flex: 1
    },
    actionDescription: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14,
        lineHeight: 20
    },
    strikethrough: {
        textDecorationLine: "line-through",
        opacity: 0.7
    },
    actionCardBottom: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        flexWrap: "wrap"
    },
    actionAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center"
    },
    actionAvatarText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 9,
        lineHeight: 12
    },
    actionAssignee: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        lineHeight: 16
    },
    actionCardRight: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginLeft: "auto"
    },
    carriedOverBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 8
    },
    carriedOverText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 10,
        lineHeight: 14
    },
    dueDateChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8
    },
    dueDateText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11,
        lineHeight: 16
    },

    // Progress bar
    progressBarBg: {
        height: 6,
        borderRadius: 3,
        overflow: "hidden"
    },
    progressBarFill: {
        height: 6,
        borderRadius: 3
    },

    // Previous action row
    prevActionRow: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 10,
        padding: 12,
        gap: 10,
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowOffset: { width: 0, height: 1 },
        shadowRadius: 2,
        elevation: 1
    },
    prevActionLeft: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
        flex: 1
    },
    prevStatusDot: {
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 2
    },
    prevActionContent: {
        flex: 1,
        gap: 4
    },
    prevActionText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 18
    },
    prevActionMeta: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6
    },
    miniAvatar: {
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center"
    },
    miniAvatarText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 8,
        lineHeight: 10
    },
    prevActionFrom: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11,
        lineHeight: 14
    },
    prevStatusBadge: {
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: 10
    },
    prevStatusText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11,
        lineHeight: 16
    }
}));
