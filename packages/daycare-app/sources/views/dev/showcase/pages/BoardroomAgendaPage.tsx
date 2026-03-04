import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
// --- Types ---
import { Card } from "@/components/Card";
import { Grid } from "@/components/Grid";
import { ShowcasePage } from "@/views/dev/showcase/components/ShowcasePage";

type AgendaItemType = "decision" | "discussion" | "info" | "vote";
type AgendaDocument = {
    id: string;
    name: string;
};
type AgendaItem = {
    id: string;
    topic: string;
    presenter: string;
    presenterInitials: string;
    durationMinutes: number;
    type: AgendaItemType;
    documents: AgendaDocument[];
};
type ActionItem = {
    id: string;
    description: string;
    assignee: string;
    dueDate: string;
    done: boolean;
};
type PreReadMaterial = {
    id: string;
    title: string;
    fileType: "pdf" | "docx" | "xlsx" | "pptx";
    pages: number;
};

// --- Config ---

const ITEM_TYPE_CONFIG: Record<
    AgendaItemType,
    {
        label: string;
        color: string;
        icon: keyof typeof Ionicons.glyphMap;
    }
> = {
    decision: {
        label: "Decision",
        color: "#EF4444",
        icon: "hammer-outline"
    },
    discussion: {
        label: "Discussion",
        color: "#3B82F6",
        icon: "chatbubbles-outline"
    },
    info: {
        label: "Info",
        color: "#10B981",
        icon: "information-circle-outline"
    },
    vote: {
        label: "Vote",
        color: "#8B5CF6",
        icon: "hand-left-outline"
    }
};
const FILE_TYPE_ICONS: Record<
    string,
    {
        icon: keyof typeof Ionicons.glyphMap;
        color: string;
    }
> = {
    pdf: {
        icon: "document-text-outline",
        color: "#EF4444"
    },
    docx: {
        icon: "document-outline",
        color: "#3B82F6"
    },
    xlsx: {
        icon: "grid-outline",
        color: "#10B981"
    },
    pptx: {
        icon: "easel-outline",
        color: "#F59E0B"
    }
};
const AVATAR_COLORS = [
    "#6366F1",
    "#EC4899",
    "#14B8A6",
    "#F97316",
    "#8B5CF6",
    "#06B6D4",
    "#EF4444",
    "#84CC16",
    "#F59E0B",
    "#3B82F6"
];

// Deterministic color from initials
function avatarColor(initials: string): string {
    let hash = 0;
    for (let i = 0; i < initials.length; i++) {
        hash = initials.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// --- Mock Data ---

const MEETING_DATE = "Tuesday, March 3, 2026";
const MEETING_TIME = "10:00 AM - 12:30 PM EST";
const MEETING_LOCATION = "Conference Room A, 42nd Floor";
const QUORUM_REQUIRED = 5;
const QUORUM_PRESENT = 6;
const TOTAL_MEMBERS = 8;
const AGENDA_ITEMS: AgendaItem[] = [
    {
        id: "a1",
        topic: "Call to Order and Approval of Minutes",
        presenter: "Margaret Chen",
        presenterInitials: "MC",
        durationMinutes: 10,
        type: "decision",
        documents: [
            {
                id: "d1",
                name: "Q4 2025 Minutes Draft.pdf"
            }
        ]
    },
    {
        id: "a2",
        topic: "CEO Report: Q1 Performance and Strategic Update",
        presenter: "David Harrington",
        presenterInitials: "DH",
        durationMinutes: 25,
        type: "info",
        documents: [
            {
                id: "d2",
                name: "CEO Report Q1.pptx"
            },
            {
                id: "d3",
                name: "Financial Summary.xlsx"
            }
        ]
    },
    {
        id: "a3",
        topic: "CFO Report: Budget Reforecast and Capital Allocation",
        presenter: "Sarah Kimura",
        presenterInitials: "SK",
        durationMinutes: 20,
        type: "discussion",
        documents: [
            {
                id: "d4",
                name: "Budget Reforecast 2026.xlsx"
            },
            {
                id: "d5",
                name: "Capital Plan.pdf"
            },
            {
                id: "d6",
                name: "Variance Analysis.xlsx"
            }
        ]
    },
    {
        id: "a4",
        topic: "Proposed Acquisition of Nextera Solutions",
        presenter: "Robert Lang",
        presenterInitials: "RL",
        durationMinutes: 30,
        type: "vote",
        documents: [
            {
                id: "d7",
                name: "Acquisition Proposal.pdf"
            },
            {
                id: "d8",
                name: "Due Diligence Report.pdf"
            },
            {
                id: "d9",
                name: "Valuation Model.xlsx"
            },
            {
                id: "d10",
                name: "Legal Opinion.pdf"
            }
        ]
    },
    {
        id: "a5",
        topic: "Board Governance and Committee Appointments",
        presenter: "Margaret Chen",
        presenterInitials: "MC",
        durationMinutes: 15,
        type: "decision",
        documents: [
            {
                id: "d11",
                name: "Committee Roster 2026.docx"
            }
        ]
    },
    {
        id: "a6",
        topic: "Risk Management and Compliance Update",
        presenter: "Anil Gupta",
        presenterInitials: "AG",
        durationMinutes: 20,
        type: "discussion",
        documents: [
            {
                id: "d12",
                name: "Risk Dashboard Q1.pdf"
            },
            {
                id: "d13",
                name: "Compliance Report.pdf"
            }
        ]
    },
    {
        id: "a7",
        topic: "ESG Strategy and Sustainability Report",
        presenter: "Elena Vasquez",
        presenterInitials: "EV",
        durationMinutes: 15,
        type: "info",
        documents: [
            {
                id: "d14",
                name: "ESG Report 2025.pdf"
            }
        ]
    },
    {
        id: "a8",
        topic: "Executive Compensation Plan Approval",
        presenter: "Thomas Wright",
        presenterInitials: "TW",
        durationMinutes: 15,
        type: "vote",
        documents: [
            {
                id: "d15",
                name: "Compensation Proposal.pdf"
            },
            {
                id: "d16",
                name: "Benchmarking Study.xlsx"
            }
        ]
    }
];
const ACTION_ITEMS: ActionItem[] = [
    {
        id: "ai1",
        description: "Finalize partnership agreement with Meridian Corp",
        assignee: "David Harrington",
        dueDate: "Feb 28, 2026",
        done: true
    },
    {
        id: "ai2",
        description: "Submit revised compliance framework to regulators",
        assignee: "Anil Gupta",
        dueDate: "Mar 1, 2026",
        done: true
    },
    {
        id: "ai3",
        description: "Complete board skills matrix assessment",
        assignee: "Margaret Chen",
        dueDate: "Mar 3, 2026",
        done: false
    },
    {
        id: "ai4",
        description: "Present updated cybersecurity investment plan",
        assignee: "Robert Lang",
        dueDate: "Mar 3, 2026",
        done: false
    },
    {
        id: "ai5",
        description: "Distribute Q4 dividend analysis to shareholders",
        assignee: "Sarah Kimura",
        dueDate: "Feb 15, 2026",
        done: true
    }
];
const PRE_READ_MATERIALS: PreReadMaterial[] = [
    {
        id: "pr1",
        title: "Board Book - Q1 2026",
        fileType: "pdf",
        pages: 84
    },
    {
        id: "pr2",
        title: "Strategic Plan Update 2026-2028",
        fileType: "pptx",
        pages: 32
    },
    {
        id: "pr3",
        title: "Nextera Solutions - Due Diligence Package",
        fileType: "pdf",
        pages: 156
    },
    {
        id: "pr4",
        title: "Financial Statements - February 2026",
        fileType: "xlsx",
        pages: 12
    },
    {
        id: "pr5",
        title: "Executive Compensation Benchmarking Study",
        fileType: "pdf",
        pages: 28
    },
    {
        id: "pr6",
        title: "Board Governance Policy Amendments",
        fileType: "docx",
        pages: 18
    }
];

// --- Components ---

function MeetingHeader() {
    const { theme } = useUnistyles();
    const quorumMet = QUORUM_PRESENT >= QUORUM_REQUIRED;
    return (
        <Card
            style={[
                styles.headerCard,
                {
                    backgroundColor: theme.colors.surfaceContainer,
                    borderColor: theme.colors.outlineVariant
                }
            ]}
        >
            {/* Top accent bar */}
            <View
                style={[
                    styles.headerAccent,
                    {
                        backgroundColor: theme.colors.primary
                    }
                ]}
            />

            <View style={styles.headerContent}>
                <View style={styles.headerTitleRow}>
                    <Text
                        style={[
                            styles.headerTitle,
                            {
                                color: theme.colors.onSurface
                            }
                        ]}
                    >
                        Board of Directors Meeting
                    </Text>
                    <View
                        style={[
                            styles.quorumBadge,
                            {
                                backgroundColor: quorumMet ? "#10B98118" : "#EF444418"
                            }
                        ]}
                    >
                        <Ionicons
                            name={quorumMet ? "checkmark-circle" : "alert-circle"}
                            size={14}
                            color={quorumMet ? "#10B981" : "#EF4444"}
                        />
                        <Text
                            style={[
                                styles.quorumBadgeText,
                                {
                                    color: quorumMet ? "#10B981" : "#EF4444"
                                }
                            ]}
                        >
                            {quorumMet ? "Quorum Met" : "No Quorum"}
                        </Text>
                    </View>
                </View>

                <Grid style={styles.headerDetailsGrid}>
                    <View style={styles.headerDetailRow}>
                        <Ionicons name="calendar-outline" size={16} color={theme.colors.onSurfaceVariant} />
                        <Text
                            style={[
                                styles.headerDetailText,
                                {
                                    color: theme.colors.onSurface
                                }
                            ]}
                        >
                            {MEETING_DATE}
                        </Text>
                    </View>
                    <View style={styles.headerDetailRow}>
                        <Ionicons name="time-outline" size={16} color={theme.colors.onSurfaceVariant} />
                        <Text
                            style={[
                                styles.headerDetailText,
                                {
                                    color: theme.colors.onSurface
                                }
                            ]}
                        >
                            {MEETING_TIME}
                        </Text>
                    </View>
                    <View style={styles.headerDetailRow}>
                        <Ionicons name="location-outline" size={16} color={theme.colors.onSurfaceVariant} />
                        <Text
                            style={[
                                styles.headerDetailText,
                                {
                                    color: theme.colors.onSurface
                                }
                            ]}
                        >
                            {MEETING_LOCATION}
                        </Text>
                    </View>
                    <View style={styles.headerDetailRow}>
                        <Ionicons name="people-outline" size={16} color={theme.colors.onSurfaceVariant} />
                        <Text
                            style={[
                                styles.headerDetailText,
                                {
                                    color: theme.colors.onSurface
                                }
                            ]}
                        >
                            {QUORUM_PRESENT} of {TOTAL_MEMBERS} members present ({QUORUM_REQUIRED} required)
                        </Text>
                    </View>
                </Grid>

                {/* Total duration */}
                <View
                    style={[
                        styles.totalDurationBar,
                        {
                            backgroundColor: theme.colors.surface
                        }
                    ]}
                >
                    <Ionicons name="hourglass-outline" size={14} color={theme.colors.onSurfaceVariant} />
                    <Text
                        style={[
                            styles.totalDurationText,
                            {
                                color: theme.colors.onSurfaceVariant
                            }
                        ]}
                    >
                        Total Duration: {AGENDA_ITEMS.reduce((sum, i) => sum + i.durationMinutes, 0)} minutes
                    </Text>
                </View>
            </View>
        </Card>
    );
}
function ItemTypeChip({ type }: { type: AgendaItemType }) {
    const config = ITEM_TYPE_CONFIG[type];
    return (
        <View
            style={[
                styles.typeChip,
                {
                    backgroundColor: `${config.color}18`
                }
            ]}
        >
            <Ionicons name={config.icon} size={12} color={config.color} />
            <Text
                style={[
                    styles.typeChipText,
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
function PresenterAvatar({ initials, name }: { initials: string; name: string }) {
    const { theme } = useUnistyles();
    const bg = avatarColor(initials);
    return (
        <View style={styles.presenterRow}>
            <View
                style={[
                    styles.avatar,
                    {
                        backgroundColor: `${bg}20`
                    }
                ]}
            >
                <Text
                    style={[
                        styles.avatarText,
                        {
                            color: bg
                        }
                    ]}
                >
                    {initials}
                </Text>
            </View>
            <Text
                style={[
                    styles.presenterName,
                    {
                        color: theme.colors.onSurfaceVariant
                    }
                ]}
                numberOfLines={1}
            >
                {name}
            </Text>
        </View>
    );
}
function TimeAllocationBar({ minutes, maxMinutes }: { minutes: number; maxMinutes: number }) {
    const { theme } = useUnistyles();
    const percentage = Math.min((minutes / maxMinutes) * 100, 100);
    return (
        <View style={styles.timeBarContainer}>
            <View
                style={[
                    styles.timeBarTrack,
                    {
                        backgroundColor: `${theme.colors.outlineVariant}40`
                    }
                ]}
            >
                <View
                    style={[
                        styles.timeBarFill,
                        {
                            width: `${percentage}%`,
                            backgroundColor: `${theme.colors.primary}60`
                        }
                    ]}
                />
            </View>
            <Text
                style={[
                    styles.timeBarLabel,
                    {
                        color: theme.colors.onSurfaceVariant
                    }
                ]}
            >
                {minutes} min
            </Text>
        </View>
    );
}
function AgendaItemCard({
    item,
    index,
    expanded,
    onToggle
}: {
    item: AgendaItem;
    index: number;
    expanded: boolean;
    onToggle: () => void;
}) {
    const { theme } = useUnistyles();
    const config = ITEM_TYPE_CONFIG[item.type];
    const maxDuration = Math.max(...AGENDA_ITEMS.map((a) => a.durationMinutes));
    return (
        <Card
            style={[
                styles.agendaCard,
                {
                    backgroundColor: theme.colors.surfaceContainer,
                    borderColor: theme.colors.outlineVariant
                }
            ]}
        >
            {/* Left accent strip colored by type */}
            <View
                style={[
                    styles.agendaAccent,
                    {
                        backgroundColor: config.color
                    }
                ]}
            />

            <View style={styles.agendaCardInner}>
                <Pressable
                    onPress={onToggle}
                    style={({ pressed }) => [
                        styles.agendaCardHeader,
                        {
                            opacity: pressed ? 0.7 : 1
                        }
                    ]}
                >
                    {/* Item number */}
                    <View
                        style={[
                            styles.itemNumber,
                            {
                                backgroundColor: theme.colors.surface
                            }
                        ]}
                    >
                        <Text
                            style={[
                                styles.itemNumberText,
                                {
                                    color: theme.colors.onSurfaceVariant
                                }
                            ]}
                        >
                            {index + 1}
                        </Text>
                    </View>

                    <View style={styles.agendaCardTitleArea}>
                        <Text
                            style={[
                                styles.agendaCardTitle,
                                {
                                    color: theme.colors.onSurface
                                }
                            ]}
                            numberOfLines={2}
                        >
                            {item.topic}
                        </Text>
                        <View style={styles.agendaCardMeta}>
                            <ItemTypeChip type={item.type} />
                            {item.documents.length > 0 && (
                                <View style={styles.docCountRow}>
                                    <Ionicons name="attach-outline" size={13} color={theme.colors.onSurfaceVariant} />
                                    <Text
                                        style={[
                                            styles.docCountText,
                                            {
                                                color: theme.colors.onSurfaceVariant
                                            }
                                        ]}
                                    >
                                        {item.documents.length}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>

                    <Ionicons
                        name={expanded ? "chevron-up" : "chevron-down"}
                        size={18}
                        color={theme.colors.onSurfaceVariant}
                    />
                </Pressable>

                {/* Presenter and time bar always visible */}
                <View style={styles.agendaCardSubRow}>
                    <PresenterAvatar initials={item.presenterInitials} name={item.presenter} />
                    <TimeAllocationBar minutes={item.durationMinutes} maxMinutes={maxDuration} />
                </View>

                {/* Expanded document list */}
                {expanded && item.documents.length > 0 && (
                    <View
                        style={[
                            styles.agendaDocsSection,
                            {
                                borderTopColor: theme.colors.outlineVariant
                            }
                        ]}
                    >
                        <Text
                            style={[
                                styles.agendaDocsSectionTitle,
                                {
                                    color: theme.colors.onSurfaceVariant
                                }
                            ]}
                        >
                            Attached Documents
                        </Text>
                        {item.documents.map((doc) => {
                            const ext = doc.name.split(".").pop() ?? "pdf";
                            const fileConfig = FILE_TYPE_ICONS[ext] ?? FILE_TYPE_ICONS.pdf;
                            return (
                                <View key={doc.id} style={styles.agendaDocRow}>
                                    <Ionicons name={fileConfig.icon} size={16} color={fileConfig.color} />
                                    <Text
                                        style={[
                                            styles.agendaDocName,
                                            {
                                                color: theme.colors.onSurface
                                            }
                                        ]}
                                        numberOfLines={1}
                                    >
                                        {doc.name}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                )}
            </View>
        </Card>
    );
}
function PreviousMinutesSection() {
    const { theme } = useUnistyles();
    const [checkedItems, setCheckedItems] = React.useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {};
        for (const ai of ACTION_ITEMS) {
            initial[ai.id] = ai.done;
        }
        return initial;
    });
    function toggleItem(id: string) {
        setCheckedItems((prev) => ({
            ...prev,
            [id]: !prev[id]
        }));
    }
    const completedCount = Object.values(checkedItems).filter(Boolean).length;
    return (
        <Card
            style={[
                styles.sectionCard,
                {
                    backgroundColor: theme.colors.surfaceContainer,
                    borderColor: theme.colors.outlineVariant
                }
            ]}
        >
            <View style={styles.sectionHeader}>
                <Ionicons name="document-text-outline" size={20} color={theme.colors.primary} />
                <Text
                    style={[
                        styles.sectionTitle,
                        {
                            color: theme.colors.onSurface
                        }
                    ]}
                >
                    Previous Minutes - Action Items
                </Text>
            </View>

            <View
                style={[
                    styles.completionBar,
                    {
                        backgroundColor: theme.colors.surface
                    }
                ]}
            >
                <Text
                    style={[
                        styles.completionText,
                        {
                            color: theme.colors.onSurfaceVariant
                        }
                    ]}
                >
                    {completedCount} of {ACTION_ITEMS.length} completed
                </Text>
                <View
                    style={[
                        styles.completionTrack,
                        {
                            backgroundColor: `${theme.colors.outlineVariant}40`
                        }
                    ]}
                >
                    <View
                        style={[
                            styles.completionFill,
                            {
                                width: `${(completedCount / ACTION_ITEMS.length) * 100}%`,
                                backgroundColor: "#10B981"
                            }
                        ]}
                    />
                </View>
            </View>

            {ACTION_ITEMS.map((ai) => {
                const isChecked = checkedItems[ai.id] ?? false;
                return (
                    <Pressable
                        key={ai.id}
                        onPress={() => toggleItem(ai.id)}
                        style={({ pressed }) => [
                            styles.actionItemRow,
                            {
                                borderBottomColor: theme.colors.outlineVariant,
                                opacity: pressed ? 0.7 : 1
                            }
                        ]}
                    >
                        <View
                            style={[
                                styles.checkbox,
                                {
                                    borderColor: isChecked ? "#10B981" : theme.colors.outline,
                                    backgroundColor: isChecked ? "#10B981" : "transparent"
                                }
                            ]}
                        >
                            {isChecked && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                        </View>
                        <View style={styles.actionItemContent}>
                            <Text
                                style={[
                                    styles.actionItemDescription,
                                    {
                                        color: isChecked ? theme.colors.onSurfaceVariant : theme.colors.onSurface,
                                        textDecorationLine: isChecked ? "line-through" : "none"
                                    }
                                ]}
                                numberOfLines={2}
                            >
                                {ai.description}
                            </Text>
                            <View style={styles.actionItemMeta}>
                                <Text
                                    style={[
                                        styles.actionItemAssignee,
                                        {
                                            color: theme.colors.onSurfaceVariant
                                        }
                                    ]}
                                >
                                    {ai.assignee}
                                </Text>
                                <Text
                                    style={[
                                        styles.actionItemDot,
                                        {
                                            color: theme.colors.outlineVariant
                                        }
                                    ]}
                                >
                                    {"\u00B7"}
                                </Text>
                                <Text
                                    style={[
                                        styles.actionItemDue,
                                        {
                                            color: theme.colors.onSurfaceVariant
                                        }
                                    ]}
                                >
                                    Due {ai.dueDate}
                                </Text>
                            </View>
                        </View>
                    </Pressable>
                );
            })}
        </Card>
    );
}
function PreReadMaterialsSection() {
    const { theme } = useUnistyles();
    return (
        <Card
            style={[
                styles.sectionCard,
                {
                    backgroundColor: theme.colors.surfaceContainer,
                    borderColor: theme.colors.outlineVariant
                }
            ]}
        >
            <View style={styles.sectionHeader}>
                <Ionicons name="library-outline" size={20} color={theme.colors.primary} />
                <Text
                    style={[
                        styles.sectionTitle,
                        {
                            color: theme.colors.onSurface
                        }
                    ]}
                >
                    Pre-read Materials
                </Text>
            </View>

            <Text
                style={[
                    styles.preReadSubtext,
                    {
                        color: theme.colors.onSurfaceVariant
                    }
                ]}
            >
                Please review all materials before the meeting
            </Text>

            {PRE_READ_MATERIALS.map((mat) => {
                const fileConfig = FILE_TYPE_ICONS[mat.fileType] ?? FILE_TYPE_ICONS.pdf;
                return (
                    <View
                        key={mat.id}
                        style={[
                            styles.preReadRow,
                            {
                                borderBottomColor: theme.colors.outlineVariant
                            }
                        ]}
                    >
                        <View
                            style={[
                                styles.preReadIcon,
                                {
                                    backgroundColor: `${fileConfig.color}15`
                                }
                            ]}
                        >
                            <Ionicons name={fileConfig.icon} size={20} color={fileConfig.color} />
                        </View>
                        <View style={styles.preReadInfo}>
                            <Text
                                style={[
                                    styles.preReadTitle,
                                    {
                                        color: theme.colors.onSurface
                                    }
                                ]}
                                numberOfLines={1}
                            >
                                {mat.title}
                            </Text>
                            <Text
                                style={[
                                    styles.preReadMeta,
                                    {
                                        color: theme.colors.onSurfaceVariant
                                    }
                                ]}
                            >
                                {mat.fileType.toUpperCase()} {"\u00B7"} {mat.pages} pages
                            </Text>
                        </View>
                        <Ionicons name="download-outline" size={18} color={theme.colors.onSurfaceVariant} />
                    </View>
                );
            })}
        </Card>
    );
}

// --- Main Component ---

export function BoardroomAgendaPage() {
    const [expandedItems, setExpandedItems] = React.useState<Record<string, boolean>>({});
    function toggleExpand(id: string) {
        setExpandedItems((prev) => ({
            ...prev,
            [id]: !prev[id]
        }));
    }
    return (
        <ShowcasePage density="spacious">
            <MeetingHeader />

            {/* Section: Agenda */}
            <Text style={styles.agendaSectionLabel}>Agenda</Text>
            {AGENDA_ITEMS.map((item, idx) => (
                <AgendaItemCard
                    key={item.id}
                    item={item}
                    index={idx}
                    expanded={expandedItems[item.id] ?? false}
                    onToggle={() => toggleExpand(item.id)}
                />
            ))}

            <PreviousMinutesSection />

            <PreReadMaterialsSection />

            <View style={styles.bottomSpacer} />
        </ShowcasePage>
    );
}

// --- Styles ---

const styles = StyleSheet.create((theme) => ({
    // Meeting header
    headerCard: {
        borderRadius: 14,
        borderWidth: 1,
        overflow: "hidden",
        marginTop: 20
    },
    headerAccent: {
        height: 4
    },
    headerContent: {
        padding: 16,
        gap: 12
    },
    headerTitleRow: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "space-between" as const,
        gap: 8
    },
    headerTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 18,
        lineHeight: 24,
        flex: 1
    },
    quorumBadge: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12
    },
    quorumBadgeText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 11
    },
    headerDetailsGrid: {
        gap: 8
    },
    headerDetailRow: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 8
    },
    headerDetailText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 18
    },
    totalDurationBar: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8
    },
    totalDurationText: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 12
    },
    // Agenda section label
    agendaSectionLabel: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 16,
        color: theme.colors.onSurface,
        marginTop: 24,
        marginBottom: 12
    },
    // Agenda card
    agendaCard: {
        borderRadius: 12,
        borderWidth: 1,
        overflow: "hidden",
        marginBottom: 10,
        flexDirection: "row" as const
    },
    agendaAccent: {
        width: 4
    },
    agendaCardInner: {
        flex: 1,
        padding: 12,
        gap: 10
    },
    agendaCardHeader: {
        flexDirection: "row" as const,
        alignItems: "flex-start" as const,
        gap: 10
    },
    itemNumber: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center" as const,
        justifyContent: "center" as const
    },
    itemNumberText: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 13
    },
    agendaCardTitleArea: {
        flex: 1,
        gap: 6
    },
    agendaCardTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 14,
        lineHeight: 20
    },
    agendaCardMeta: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 10
    },
    docCountRow: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 2
    },
    docCountText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    // Type chip
    typeChip: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10
    },
    typeChipText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11
    },
    // Presenter
    presenterRow: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 6
    },
    avatar: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: "center" as const,
        justifyContent: "center" as const
    },
    avatarText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 10
    },
    presenterName: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        flexShrink: 1
    },
    // Sub row
    agendaCardSubRow: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "space-between" as const,
        gap: 12,
        paddingLeft: 38
    },
    // Time bar
    timeBarContainer: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 8,
        flex: 1,
        maxWidth: 160
    },
    timeBarTrack: {
        flex: 1,
        height: 6,
        borderRadius: 3,
        overflow: "hidden" as const
    },
    timeBarFill: {
        height: "100%",
        borderRadius: 3
    },
    timeBarLabel: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11,
        minWidth: 42,
        textAlign: "right" as const
    },
    // Expanded docs
    agendaDocsSection: {
        borderTopWidth: 1,
        paddingTop: 8,
        paddingLeft: 38,
        gap: 6
    },
    agendaDocsSectionTitle: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11,
        textTransform: "uppercase" as const,
        letterSpacing: 0.6,
        marginBottom: 2
    },
    agendaDocRow: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 6
    },
    agendaDocName: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        flex: 1
    },
    // Section card (shared by Previous Minutes and Pre-read)
    sectionCard: {
        borderRadius: 14,
        borderWidth: 1,
        overflow: "hidden",
        marginTop: 20
    },
    sectionHeader: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 8,
        padding: 16,
        paddingBottom: 0
    },
    sectionTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 16
    },
    // Completion bar
    completionBar: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 10,
        marginHorizontal: 16,
        marginTop: 12,
        marginBottom: 4,
        padding: 8,
        borderRadius: 8
    },
    completionText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        minWidth: 110
    },
    completionTrack: {
        flex: 1,
        height: 6,
        borderRadius: 3,
        overflow: "hidden" as const
    },
    completionFill: {
        height: "100%",
        borderRadius: 3
    },
    // Action item row
    actionItemRow: {
        flexDirection: "row" as const,
        alignItems: "flex-start" as const,
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 4,
        borderWidth: 2,
        alignItems: "center" as const,
        justifyContent: "center" as const,
        marginTop: 1
    },
    actionItemContent: {
        flex: 1,
        gap: 4
    },
    actionItemDescription: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 18
    },
    actionItemMeta: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 4
    },
    actionItemAssignee: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11
    },
    actionItemDot: {
        fontSize: 11
    },
    actionItemDue: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },
    // Pre-read materials
    preReadSubtext: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        paddingHorizontal: 16,
        paddingTop: 4,
        paddingBottom: 8
    },
    preReadRow: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1
    },
    preReadIcon: {
        width: 36,
        height: 36,
        borderRadius: 8,
        alignItems: "center" as const,
        justifyContent: "center" as const
    },
    preReadInfo: {
        flex: 1,
        gap: 2
    },
    preReadTitle: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13,
        lineHeight: 18
    },
    preReadMeta: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },
    // Bottom spacer
    bottomSpacer: {
        height: 40
    }
}));
