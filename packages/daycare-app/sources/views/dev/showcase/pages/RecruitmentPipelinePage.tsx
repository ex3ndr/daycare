import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

// --- Types ---

type Source = "Referral" | "LinkedIn" | "Direct";

type Candidate = {
    name: string;
    role: string;
    daysInStage: number;
    source: Source;
    stageIndex: number;
};

type Stage = {
    label: string;
    candidates: Omit<Candidate, "stageIndex">[];
};

type JobOpening = {
    title: string;
    stages: Stage[];
};

// --- Mock data ---

const jobOpenings: JobOpening[] = [
    {
        title: "Engineering",
        stages: [
            {
                label: "Applied",
                candidates: [
                    { name: "Priya Sharma", role: "Senior Frontend Engineer", daysInStage: 2, source: "LinkedIn" },
                    { name: "Marcus Johnson", role: "Backend Engineer", daysInStage: 5, source: "Referral" },
                    { name: "Lena Petrova", role: "Senior Frontend Engineer", daysInStage: 1, source: "Direct" },
                    { name: "David Kim", role: "DevOps Engineer", daysInStage: 3, source: "LinkedIn" },
                    { name: "Amara Osei", role: "Backend Engineer", daysInStage: 7, source: "Referral" }
                ]
            },
            {
                label: "Phone Screen",
                candidates: [
                    { name: "Jonas Eriksson", role: "Senior Frontend Engineer", daysInStage: 4, source: "LinkedIn" },
                    { name: "Sofia Mendez", role: "DevOps Engineer", daysInStage: 2, source: "Direct" },
                    { name: "Chen Wei", role: "Backend Engineer", daysInStage: 6, source: "Referral" }
                ]
            },
            {
                label: "Technical",
                candidates: [
                    { name: "Aisha Diallo", role: "Senior Frontend Engineer", daysInStage: 3, source: "Referral" },
                    { name: "Ryan O'Connor", role: "Backend Engineer", daysInStage: 8, source: "LinkedIn" },
                    { name: "Mei Lin", role: "DevOps Engineer", daysInStage: 1, source: "Direct" }
                ]
            },
            {
                label: "Offer",
                candidates: [
                    { name: "Tomasz Nowak", role: "Senior Frontend Engineer", daysInStage: 2, source: "Referral" },
                    { name: "Elena Vasquez", role: "Backend Engineer", daysInStage: 5, source: "LinkedIn" }
                ]
            },
            {
                label: "Hired",
                candidates: [
                    { name: "Kenji Tanaka", role: "DevOps Engineer", daysInStage: 0, source: "Referral" },
                    { name: "Fatima Al-Rashid", role: "Senior Frontend Engineer", daysInStage: 0, source: "Direct" }
                ]
            }
        ]
    },
    {
        title: "Product",
        stages: [
            {
                label: "Applied",
                candidates: [
                    { name: "Hannah Liu", role: "Product Manager", daysInStage: 3, source: "LinkedIn" },
                    { name: "Oscar Reyes", role: "Product Designer", daysInStage: 1, source: "Direct" }
                ]
            },
            {
                label: "Phone Screen",
                candidates: [{ name: "Nina Johansson", role: "Product Manager", daysInStage: 5, source: "Referral" }]
            },
            {
                label: "Technical",
                candidates: [{ name: "Raj Patel", role: "Product Designer", daysInStage: 2, source: "LinkedIn" }]
            },
            {
                label: "Offer",
                candidates: [{ name: "Claire Dubois", role: "Product Manager", daysInStage: 1, source: "Referral" }]
            },
            {
                label: "Hired",
                candidates: []
            }
        ]
    }
];

// --- Helpers ---

function initialsFrom(name: string): string {
    const parts = name.split(" ");
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
}

const avatarColors = ["#6366F1", "#EC4899", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EF4444", "#14B8A6"];

function colorForName(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return avatarColors[Math.abs(hash) % avatarColors.length];
}

const sourceColors: Record<Source, string> = {
    Referral: "#10B981",
    LinkedIn: "#3B82F6",
    Direct: "#8B5CF6"
};

// Funnel stage colors: gradient from light to saturated
const stageColors = ["#93C5FD", "#60A5FA", "#3B82F6", "#2563EB", "#1D4ED8"];

// Flex values for funnel narrowing effect
const stageFlex = [5, 4, 3, 2, 1.5];

/** Flatten all candidates with their stage index for filtering and display. */
function flattenCandidates(job: JobOpening): Candidate[] {
    const result: Candidate[] = [];
    for (let si = 0; si < job.stages.length; si++) {
        for (const c of job.stages[si].candidates) {
            result.push({ ...c, stageIndex: si });
        }
    }
    return result;
}

// --- Sub-components ---

function FunnelBar({ stages }: { stages: Stage[] }) {
    return (
        <View style={styles.funnelContainer}>
            {stages.map((stage, idx) => (
                <View
                    key={stage.label}
                    style={[
                        styles.funnelSegment,
                        {
                            flex: stageFlex[idx],
                            backgroundColor: stageColors[idx],
                            borderTopLeftRadius: idx === 0 ? 10 : 0,
                            borderBottomLeftRadius: idx === 0 ? 10 : 0,
                            borderTopRightRadius: idx === stages.length - 1 ? 10 : 0,
                            borderBottomRightRadius: idx === stages.length - 1 ? 10 : 0,
                            marginLeft: idx > 0 ? 2 : 0
                        }
                    ]}
                >
                    <Text style={styles.funnelLabel} numberOfLines={1}>
                        {stage.label}
                    </Text>
                    <Text style={styles.funnelCount}>{stage.candidates.length}</Text>
                </View>
            ))}
        </View>
    );
}

function StageFilterTabs({
    stages,
    activeIndex,
    onSelect,
    primaryColor,
    surfaceColor,
    textColor
}: {
    stages: Stage[];
    activeIndex: number | null;
    onSelect: (index: number | null) => void;
    primaryColor: string;
    surfaceColor: string;
    textColor: string;
}) {
    const allLabel = "All";
    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
            <Pressable
                onPress={() => onSelect(null)}
                style={[
                    styles.tabPill,
                    {
                        backgroundColor: activeIndex === null ? primaryColor : surfaceColor
                    }
                ]}
            >
                <Text style={[styles.tabPillText, { color: activeIndex === null ? "#FFFFFF" : textColor }]}>
                    {allLabel}
                </Text>
            </Pressable>
            {stages.map((stage, idx) => {
                const isActive = activeIndex === idx;
                return (
                    <Pressable
                        key={stage.label}
                        onPress={() => onSelect(idx)}
                        style={[
                            styles.tabPill,
                            {
                                backgroundColor: isActive ? primaryColor : surfaceColor
                            }
                        ]}
                    >
                        <Text style={[styles.tabPillText, { color: isActive ? "#FFFFFF" : textColor }]}>
                            {stage.label}
                        </Text>
                    </Pressable>
                );
            })}
        </ScrollView>
    );
}

function CandidateCard({
    candidate,
    totalStages,
    surfaceColor,
    textColor,
    subtextColor,
    borderColor
}: {
    candidate: Candidate;
    totalStages: number;
    surfaceColor: string;
    textColor: string;
    subtextColor: string;
    borderColor: string;
}) {
    const avatarColor = colorForName(candidate.name);
    const initials = initialsFrom(candidate.name);
    const sourceBg = `${sourceColors[candidate.source]}18`;
    const sourceFg = sourceColors[candidate.source];
    const progress = (candidate.stageIndex + 1) / totalStages;
    const stageColor = stageColors[candidate.stageIndex];
    const dayLabel = candidate.daysInStage === 0 ? "Today" : `Day ${candidate.daysInStage} in stage`;

    return (
        <View
            style={[
                styles.card,
                {
                    backgroundColor: surfaceColor,
                    borderColor: borderColor,
                    shadowColor: "#000"
                }
            ]}
        >
            <View style={styles.cardBody}>
                {/* Avatar */}
                <View style={[styles.avatar, { backgroundColor: `${avatarColor}20` }]}>
                    <Text style={[styles.avatarText, { color: avatarColor }]}>{initials}</Text>
                </View>

                {/* Center info */}
                <View style={styles.cardCenter}>
                    <Text style={[styles.cardName, { color: textColor }]} numberOfLines={1}>
                        {candidate.name}
                    </Text>
                    <Text style={[styles.cardRole, { color: subtextColor }]} numberOfLines={1}>
                        {candidate.role}
                    </Text>
                    <Text style={[styles.cardDays, { color: subtextColor }]}>{dayLabel}</Text>
                </View>

                {/* Right: source badge + stage dot */}
                <View style={styles.cardRight}>
                    <View style={[styles.sourceBadge, { backgroundColor: sourceBg }]}>
                        <Text style={[styles.sourceBadgeText, { color: sourceFg }]}>{candidate.source}</Text>
                    </View>
                    <View style={[styles.stageDot, { backgroundColor: stageColor }]} />
                </View>
            </View>

            {/* Progress bar */}
            <View style={[styles.progressTrack, { backgroundColor: borderColor }]}>
                <View
                    style={[
                        styles.progressFill,
                        {
                            backgroundColor: stageColor,
                            width: `${progress * 100}%`
                        }
                    ]}
                />
            </View>
        </View>
    );
}

// --- Main component ---

/**
 * Showcase page demonstrating a recruitment pipeline with a horizontal funnel visualization
 * and filterable candidate cards.
 */
export function RecruitmentPipelinePage() {
    const { theme } = useUnistyles();
    const [selectedJob, setSelectedJob] = React.useState(0);
    const [stageFilter, setStageFilter] = React.useState<number | null>(null);

    const job = jobOpenings[selectedJob];
    const allCandidates = React.useMemo(() => flattenCandidates(job), [job]);
    const filtered = stageFilter === null ? allCandidates : allCandidates.filter((c) => c.stageIndex === stageFilter);

    // Reset stage filter when switching jobs
    const handleJobSwitch = (idx: number) => {
        setSelectedJob(idx);
        setStageFilter(null);
    };

    return (
        <ScrollView contentContainerStyle={[styles.scrollContent, { backgroundColor: theme.colors.surface }]}>
            {/* Job opening selector */}
            <View style={styles.jobSelectorRow}>
                {jobOpenings.map((opening, idx) => {
                    const isActive = idx === selectedJob;
                    return (
                        <Pressable
                            key={opening.title}
                            onPress={() => handleJobSwitch(idx)}
                            style={[
                                styles.jobSelectorButton,
                                {
                                    backgroundColor: isActive
                                        ? theme.colors.primary
                                        : theme.colors.surfaceContainerHighest,
                                    borderRadius: 10
                                }
                            ]}
                        >
                            <Text
                                style={[
                                    styles.jobSelectorText,
                                    {
                                        color: isActive ? theme.colors.onPrimary : theme.colors.onSurfaceVariant
                                    }
                                ]}
                            >
                                {opening.title}
                            </Text>
                            <Text
                                style={[
                                    styles.jobSelectorCount,
                                    {
                                        color: isActive ? theme.colors.onPrimary : theme.colors.onSurfaceVariant
                                    }
                                ]}
                            >
                                {opening.stages.reduce((sum, s) => sum + s.candidates.length, 0)} candidates
                            </Text>
                        </Pressable>
                    );
                })}
            </View>

            {/* Funnel visualization */}
            <FunnelBar stages={job.stages} />

            {/* Section header + filter tabs */}
            <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>All Candidates</Text>
                <Text style={[styles.sectionCount, { color: theme.colors.onSurfaceVariant }]}>
                    {filtered.length} shown
                </Text>
            </View>

            <StageFilterTabs
                stages={job.stages}
                activeIndex={stageFilter}
                onSelect={setStageFilter}
                primaryColor={theme.colors.primary}
                surfaceColor={theme.colors.surfaceContainerHighest}
                textColor={theme.colors.onSurfaceVariant}
            />

            {/* Candidate cards */}
            <View style={styles.cardsContainer}>
                {filtered.map((candidate) => (
                    <CandidateCard
                        key={candidate.name}
                        candidate={candidate}
                        totalStages={job.stages.length}
                        surfaceColor={theme.colors.surfaceContainer}
                        textColor={theme.colors.onSurface}
                        subtextColor={theme.colors.onSurfaceVariant}
                        borderColor={theme.colors.outlineVariant}
                    />
                ))}
                {filtered.length === 0 && (
                    <View style={styles.emptyState}>
                        <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                            No candidates in this stage
                        </Text>
                    </View>
                )}
            </View>
        </ScrollView>
    );
}

// --- Styles ---

const styles = StyleSheet.create((theme) => ({
    scrollContent: {
        paddingBottom: 40,
        maxWidth: theme.layout.maxWidth,
        width: "100%",
        alignSelf: "center"
    },
    jobSelectorRow: {
        flexDirection: "row",
        gap: 10,
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 12
    },
    jobSelectorButton: {
        flex: 1,
        paddingVertical: 14,
        paddingHorizontal: 16,
        alignItems: "center"
    },
    jobSelectorText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15
    },
    jobSelectorCount: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        marginTop: 2,
        opacity: 0.8
    },
    funnelContainer: {
        flexDirection: "row",
        marginHorizontal: 16,
        marginTop: 8,
        marginBottom: 20,
        height: 56
    },
    funnelSegment: {
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 4
    },
    funnelLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11,
        color: "#FFFFFF",
        opacity: 0.9
    },
    funnelCount: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 18,
        color: "#FFFFFF"
    },
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "baseline",
        paddingHorizontal: 16,
        marginBottom: 8
    },
    sectionTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 17
    },
    sectionCount: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13
    },
    tabsScroll: {
        paddingHorizontal: 16,
        gap: 8,
        paddingBottom: 16
    },
    tabPill: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20
    },
    tabPillText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13
    },
    cardsContainer: {
        paddingHorizontal: 16,
        gap: 10
    },
    card: {
        borderRadius: 14,
        borderWidth: 1,
        overflow: "hidden",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2
    },
    cardBody: {
        flexDirection: "row",
        alignItems: "center",
        padding: 14,
        gap: 12
    },
    avatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: "center",
        justifyContent: "center"
    },
    avatarText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15
    },
    cardCenter: {
        flex: 1,
        gap: 1
    },
    cardName: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15
    },
    cardRole: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13
    },
    cardDays: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11,
        marginTop: 2,
        opacity: 0.7
    },
    cardRight: {
        alignItems: "flex-end",
        gap: 6
    },
    sourceBadge: {
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 3
    },
    sourceBadgeText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },
    stageDot: {
        width: 8,
        height: 8,
        borderRadius: 4
    },
    progressTrack: {
        height: 3,
        width: "100%"
    },
    progressFill: {
        height: 3
    },
    emptyState: {
        paddingVertical: 40,
        alignItems: "center"
    },
    emptyText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14
    }
}));
