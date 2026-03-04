import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
// --- Types ---
import { Card } from "@/components/Card";
import { ShowcasePage } from "@/views/dev/showcase/components/ShowcasePage";

type EpisodeStatus = "planning" | "recording" | "editing" | "published";
type TalkingPoint = {
    text: string;
    checked: boolean;
};
type AudioFile = {
    label: string;
    duration: string;
    icon: keyof typeof Ionicons.glyphMap;
};
type Episode = {
    id: string;
    number: number;
    title: string;
    guestName: string;
    guestInitials: string;
    guestColor: string;
    status: EpisodeStatus;
    recordDate: string;
    publishDate: string;
    duration: string;
    outline: string;
    talkingPoints: TalkingPoint[];
    showNotes: string;
    audioFiles: AudioFile[];
};

// --- Constants ---

const STATUS_META: Record<
    EpisodeStatus,
    {
        label: string;
        color: string;
        icon: keyof typeof Ionicons.glyphMap;
    }
> = {
    planning: {
        label: "Planning",
        color: "#7c3aed",
        icon: "bulb-outline"
    },
    recording: {
        label: "Recording",
        color: "#dc2626",
        icon: "mic-outline"
    },
    editing: {
        label: "Editing",
        color: "#d97706",
        icon: "cut-outline"
    },
    published: {
        label: "Published",
        color: "#16a34a",
        icon: "checkmark-circle-outline"
    }
};
const STATUS_ORDER: EpisodeStatus[] = ["planning", "recording", "editing", "published"];

// --- Mock Data ---

const EPISODES: Episode[] = [
    {
        id: "ep-next",
        number: 48,
        title: "The Future of AI-Powered Developer Tools",
        guestName: "Dr. Sarah Lin",
        guestInitials: "SL",
        guestColor: "#7c3aed",
        status: "recording",
        recordDate: "Mar 5, 2026",
        publishDate: "Mar 12, 2026",
        duration: "~55 min",
        outline:
            "Deep dive into how AI is reshaping the developer experience, from code completion to autonomous debugging. We explore the ethical considerations and where the industry is headed in the next 5 years.",
        talkingPoints: [
            {
                text: "Introduction & guest background in AI research",
                checked: true
            },
            {
                text: "Current state of AI dev tools landscape",
                checked: true
            },
            {
                text: "Live demo: autonomous debugging session",
                checked: false
            },
            {
                text: "Ethics of AI-generated code in production",
                checked: false
            },
            {
                text: "Predictions for 2027 and beyond",
                checked: false
            },
            {
                text: "Audience Q&A segment",
                checked: false
            }
        ],
        showNotes:
            "Dr. Sarah Lin is a principal researcher at DeepMind focusing on developer productivity. Previously led tooling at Stripe. Author of 'Code & Conscience' (O'Reilly, 2025).",
        audioFiles: [
            {
                label: "Raw Recording",
                duration: "1:12:34",
                icon: "document-outline"
            },
            {
                label: "Edited Master",
                duration: "54:20",
                icon: "musical-notes-outline"
            }
        ]
    },
    {
        id: "ep-47",
        number: 47,
        title: "Building Resilient Distributed Systems",
        guestName: "Marcus Webb",
        guestInitials: "MW",
        guestColor: "#2563eb",
        status: "editing",
        recordDate: "Feb 26, 2026",
        publishDate: "Mar 5, 2026",
        duration: "48 min",
        outline:
            "Marcus shares battle-tested patterns for building distributed systems that survive chaos. Real stories from running infrastructure at Netflix scale.",
        talkingPoints: [
            {
                text: "Guest intro and Netflix journey",
                checked: true
            },
            {
                text: "Circuit breaker patterns in practice",
                checked: true
            },
            {
                text: "Chaos engineering war stories",
                checked: true
            },
            {
                text: "Observability stack recommendations",
                checked: false
            },
            {
                text: "Wrap-up and resource links",
                checked: false
            }
        ],
        showNotes:
            "Marcus Webb is a Staff Engineer at Netflix. 12 years in distributed systems. Maintainer of the Resilience4j library.",
        audioFiles: [
            {
                label: "Raw Recording",
                duration: "1:05:11",
                icon: "document-outline"
            },
            {
                label: "Draft Edit v2",
                duration: "48:15",
                icon: "musical-notes-outline"
            }
        ]
    },
    {
        id: "ep-46",
        number: 46,
        title: "Design Systems at Scale",
        guestName: "Ava Patel",
        guestInitials: "AP",
        guestColor: "#db2777",
        status: "published",
        recordDate: "Feb 19, 2026",
        publishDate: "Feb 26, 2026",
        duration: "42 min",
        outline:
            "How Figma's design systems team manages consistency across 100+ components used by thousands of designers worldwide.",
        talkingPoints: [
            {
                text: "Ava's path from graphic design to systems thinking",
                checked: true
            },
            {
                text: "Token architecture and theming strategies",
                checked: true
            },
            {
                text: "Versioning and breaking changes policy",
                checked: true
            },
            {
                text: "Community contribution model",
                checked: true
            },
            {
                text: "Measuring design system adoption",
                checked: true
            }
        ],
        showNotes:
            "Ava Patel leads the Design Systems team at Figma. Speaker at Config 2025. Co-author of the Design Tokens W3C spec.",
        audioFiles: [
            {
                label: "Final Master",
                duration: "42:08",
                icon: "musical-notes-outline"
            },
            {
                label: "Transcript (PDF)",
                duration: "18 pages",
                icon: "document-text-outline"
            }
        ]
    },
    {
        id: "ep-45",
        number: 45,
        title: "The Art of Technical Writing",
        guestName: "James Okonkwo",
        guestInitials: "JO",
        guestColor: "#059669",
        status: "published",
        recordDate: "Feb 12, 2026",
        publishDate: "Feb 19, 2026",
        duration: "38 min",
        outline:
            "James breaks down why most technical documentation fails and shares his framework for writing docs that developers actually read.",
        talkingPoints: [
            {
                text: "Why docs are the #1 developer experience factor",
                checked: true
            },
            {
                text: "The ARID framework for technical writing",
                checked: true
            },
            {
                text: "Live review of good vs bad documentation",
                checked: true
            },
            {
                text: "Tools and workflows for docs-as-code",
                checked: true
            }
        ],
        showNotes:
            "James Okonkwo is Head of Developer Relations at Vercel. Former tech writer at Google. Created the ARID documentation framework.",
        audioFiles: [
            {
                label: "Final Master",
                duration: "38:22",
                icon: "musical-notes-outline"
            },
            {
                label: "Transcript (PDF)",
                duration: "14 pages",
                icon: "document-text-outline"
            }
        ]
    },
    {
        id: "ep-49",
        number: 49,
        title: "WebAssembly Beyond the Browser",
        guestName: "Kai Nakamura",
        guestInitials: "KN",
        guestColor: "#0891b2",
        status: "planning",
        recordDate: "Mar 12, 2026",
        publishDate: "Mar 19, 2026",
        duration: "~50 min",
        outline:
            "Exploring how WebAssembly is breaking out of the browser into server-side, edge computing, and embedded systems.",
        talkingPoints: [
            {
                text: "Guest intro and Wasm background",
                checked: false
            },
            {
                text: "WASI and the component model explained",
                checked: false
            },
            {
                text: "Real-world Wasm use cases outside browsers",
                checked: false
            },
            {
                text: "Performance benchmarks vs native",
                checked: false
            },
            {
                text: "The plugin ecosystem and extensibility story",
                checked: false
            }
        ],
        showNotes:
            "Kai Nakamura is a core contributor to the Wasmtime runtime at the Bytecode Alliance. Previously worked on V8 at Google.",
        audioFiles: []
    },
    {
        id: "ep-50",
        number: 50,
        title: "50th Episode Special: State of the Podcast",
        guestName: "Solo Episode",
        guestInitials: "SE",
        guestColor: "#ea580c",
        status: "planning",
        recordDate: "Mar 19, 2026",
        publishDate: "Mar 26, 2026",
        duration: "~40 min",
        outline:
            "Celebrating 50 episodes! Reflecting on the journey, listener stats, top moments, and announcing exciting changes for season 3.",
        talkingPoints: [
            {
                text: "Journey from episode 1 to 50",
                checked: false
            },
            {
                text: "Top 5 most downloaded episodes",
                checked: false
            },
            {
                text: "Listener stats and demographics",
                checked: false
            },
            {
                text: "Season 3 format changes announcement",
                checked: false
            },
            {
                text: "Listener voicemails and shoutouts",
                checked: false
            }
        ],
        showNotes:
            "Special solo episode. No guest. Includes listener-submitted voice messages and community highlights.",
        audioFiles: []
    }
];

// The upcoming episode is the one currently in recording status
const UPCOMING_EPISODE = EPISODES.find((e) => e.id === "ep-next")!;

// --- Helpers ---

function daysUntil(dateStr: string): number {
    // Simplified: just return a fixed number based on hardcoded data
    const map: Record<string, number> = {
        "Mar 5, 2026": 2,
        "Mar 12, 2026": 9,
        "Mar 19, 2026": 16,
        "Mar 26, 2026": 23
    };
    return map[dateStr] ?? 0;
}
function groupByStatus(episodes: Episode[]): {
    status: EpisodeStatus;
    episodes: Episode[];
}[] {
    const groups: {
        status: EpisodeStatus;
        episodes: Episode[];
    }[] = [];
    for (const status of STATUS_ORDER) {
        const filtered = episodes.filter((ep) => ep.id !== UPCOMING_EPISODE.id && ep.status === status);
        if (filtered.length > 0) {
            groups.push({
                status,
                episodes: filtered
            });
        }
    }
    return groups;
}

// --- Sub-components ---

function StatusChip({ status, small }: { status: EpisodeStatus; small?: boolean }) {
    const meta = STATUS_META[status];
    const size = small ? 10 : 12;
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: `${meta.color}15`,
                paddingHorizontal: small ? 7 : 10,
                paddingVertical: small ? 2 : 4,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: `${meta.color}30`
            }}
        >
            <Ionicons name={meta.icon} size={size} color={meta.color} />
            <Text
                style={{
                    fontFamily: "IBMPlexSans-Medium",
                    fontSize: size,
                    color: meta.color
                }}
            >
                {meta.label}
            </Text>
        </View>
    );
}
function GuestAvatar({ initials, color, size }: { initials: string; color: string; size: number }) {
    return (
        <View
            style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: `${color}20`,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1.5,
                borderColor: `${color}40`
            }}
        >
            <Text
                style={{
                    fontFamily: "IBMPlexSans-SemiBold",
                    fontSize: size * 0.36,
                    color: color
                }}
            >
                {initials}
            </Text>
        </View>
    );
}
function EpisodeNumberBadge({ num }: { num: number }) {
    const { theme } = useUnistyles();
    return (
        <View
            style={[
                styles.epBadge,
                {
                    backgroundColor: theme.colors.primary
                }
            ]}
        >
            <Text
                style={[
                    styles.epBadgeText,
                    {
                        color: theme.colors.onPrimary
                    }
                ]}
            >
                #{num}
            </Text>
        </View>
    );
}
function CountdownRing({ days }: { days: number }) {
    const { theme } = useUnistyles();
    const isUrgent = days <= 3;
    const ringColor = isUrgent ? "#dc2626" : theme.colors.primary;
    return (
        <View
            style={[
                styles.countdownRing,
                {
                    borderColor: `${ringColor}30`,
                    backgroundColor: `${ringColor}10`
                }
            ]}
        >
            <Text
                style={[
                    styles.countdownNumber,
                    {
                        color: ringColor
                    }
                ]}
            >
                {days}
            </Text>
            <Text
                style={[
                    styles.countdownLabel,
                    {
                        color: `${ringColor}99`
                    }
                ]}
            >
                {days === 1 ? "day" : "days"}
            </Text>
        </View>
    );
}
function HeroCard({ episode }: { episode: Episode }) {
    const { theme } = useUnistyles();
    const recordDays = daysUntil(episode.recordDate);
    const publishDays = daysUntil(episode.publishDate);
    const checkedCount = episode.talkingPoints.filter((tp) => tp.checked).length;
    return (
        <Card style={styles.heroCard}>
            {/* Gradient-like accent bar */}
            <View style={styles.heroAccentBar}>
                <View
                    style={[
                        styles.heroAccentSegment,
                        {
                            backgroundColor: "#dc2626",
                            flex: 1
                        }
                    ]}
                />
                <View
                    style={[
                        styles.heroAccentSegment,
                        {
                            backgroundColor: "#d97706",
                            flex: 1
                        }
                    ]}
                />
                <View
                    style={[
                        styles.heroAccentSegment,
                        {
                            backgroundColor: "#7c3aed",
                            flex: 1
                        }
                    ]}
                />
                <View
                    style={[
                        styles.heroAccentSegment,
                        {
                            backgroundColor: theme.colors.primary,
                            flex: 1
                        }
                    ]}
                />
            </View>

            <View style={styles.heroPadding}>
                {/* Top row: label + status */}
                <View style={styles.heroTopRow}>
                    <View style={styles.heroLabelRow}>
                        <Ionicons name="radio-outline" size={14} color={theme.colors.primary} />
                        <Text
                            style={[
                                styles.heroLabel,
                                {
                                    color: theme.colors.primary
                                }
                            ]}
                        >
                            UP NEXT
                        </Text>
                    </View>
                    <StatusChip status={episode.status} />
                </View>

                {/* Title + episode number */}
                <View style={styles.heroTitleRow}>
                    <EpisodeNumberBadge num={episode.number} />
                    <Text
                        style={[
                            styles.heroTitle,
                            {
                                color: theme.colors.onSurface
                            }
                        ]}
                    >
                        {episode.title}
                    </Text>
                </View>

                {/* Guest row */}
                <View style={styles.heroGuestRow}>
                    <GuestAvatar initials={episode.guestInitials} color={episode.guestColor} size={32} />
                    <View>
                        <Text
                            style={[
                                styles.heroGuestName,
                                {
                                    color: theme.colors.onSurface
                                }
                            ]}
                        >
                            {episode.guestName}
                        </Text>
                        <Text
                            style={[
                                styles.heroGuestSub,
                                {
                                    color: theme.colors.onSurfaceVariant
                                }
                            ]}
                        >
                            Guest Speaker
                        </Text>
                    </View>
                </View>

                {/* Countdown and dates section */}
                <View
                    style={[
                        styles.heroCountdownSection,
                        {
                            backgroundColor: `${theme.colors.primary}08`
                        }
                    ]}
                >
                    <CountdownRing days={recordDays} />
                    <View style={styles.heroDatesList}>
                        <View style={styles.heroDateRow}>
                            <Ionicons name="mic" size={14} color="#dc2626" />
                            <Text
                                style={[
                                    styles.heroDateLabel,
                                    {
                                        color: theme.colors.onSurfaceVariant
                                    }
                                ]}
                            >
                                Record:
                            </Text>
                            <Text
                                style={[
                                    styles.heroDateValue,
                                    {
                                        color: theme.colors.onSurface
                                    }
                                ]}
                            >
                                {episode.recordDate}
                            </Text>
                        </View>
                        <View style={styles.heroDateRow}>
                            <Ionicons name="cloud-upload" size={14} color="#16a34a" />
                            <Text
                                style={[
                                    styles.heroDateLabel,
                                    {
                                        color: theme.colors.onSurfaceVariant
                                    }
                                ]}
                            >
                                Publish:
                            </Text>
                            <Text
                                style={[
                                    styles.heroDateValue,
                                    {
                                        color: theme.colors.onSurface
                                    }
                                ]}
                            >
                                {episode.publishDate}
                            </Text>
                            <Text
                                style={[
                                    styles.heroDateAway,
                                    {
                                        color: theme.colors.onSurfaceVariant
                                    }
                                ]}
                            >
                                ({publishDays}d away)
                            </Text>
                        </View>
                        <View style={styles.heroDateRow}>
                            <Ionicons name="time-outline" size={14} color={theme.colors.onSurfaceVariant} />
                            <Text
                                style={[
                                    styles.heroDateLabel,
                                    {
                                        color: theme.colors.onSurfaceVariant
                                    }
                                ]}
                            >
                                Duration:
                            </Text>
                            <Text
                                style={[
                                    styles.heroDateValue,
                                    {
                                        color: theme.colors.onSurface
                                    }
                                ]}
                            >
                                {episode.duration}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Prep progress bar */}
                <View style={styles.heroProgressSection}>
                    <View style={styles.heroProgressHeader}>
                        <Text
                            style={[
                                styles.heroProgressLabel,
                                {
                                    color: theme.colors.onSurfaceVariant
                                }
                            ]}
                        >
                            Prep Progress
                        </Text>
                        <Text
                            style={[
                                styles.heroProgressCount,
                                {
                                    color: theme.colors.primary
                                }
                            ]}
                        >
                            {checkedCount}/{episode.talkingPoints.length}
                        </Text>
                    </View>
                    <View
                        style={[
                            styles.heroProgressTrack,
                            {
                                backgroundColor: theme.colors.outlineVariant
                            }
                        ]}
                    >
                        <View
                            style={[
                                styles.heroProgressFill,
                                {
                                    backgroundColor: theme.colors.primary,
                                    width: `${(checkedCount / episode.talkingPoints.length) * 100}%`
                                }
                            ]}
                        />
                    </View>
                </View>
            </View>
        </Card>
    );
}
function StatusSectionHeader({ status, count }: { status: EpisodeStatus; count: number }) {
    const { theme } = useUnistyles();
    const meta = STATUS_META[status];
    return (
        <View style={styles.sectionHeader}>
            <View
                style={[
                    styles.sectionAccent,
                    {
                        backgroundColor: meta.color
                    }
                ]}
            />
            <Ionicons name={meta.icon} size={18} color={meta.color} />
            <Text
                style={[
                    styles.sectionTitle,
                    {
                        color: theme.colors.onSurface
                    }
                ]}
            >
                {meta.label}
            </Text>
            <View
                style={[
                    styles.sectionCount,
                    {
                        backgroundColor: `${meta.color}18`
                    }
                ]}
            >
                <Text
                    style={{
                        fontFamily: "IBMPlexSans-SemiBold",
                        fontSize: 12,
                        color: meta.color
                    }}
                >
                    {count}
                </Text>
            </View>
            <View
                style={[
                    styles.sectionLine,
                    {
                        backgroundColor: `${meta.color}20`
                    }
                ]}
            />
        </View>
    );
}
function TalkingPointItem({ point, onToggle }: { point: TalkingPoint; onToggle: () => void }) {
    const { theme } = useUnistyles();
    return (
        <Pressable onPress={onToggle} style={styles.talkingPointRow}>
            <View
                style={[
                    styles.talkingPointCheckbox,
                    {
                        borderColor: point.checked ? theme.colors.primary : theme.colors.outline,
                        backgroundColor: point.checked ? theme.colors.primary : "transparent"
                    }
                ]}
            >
                {point.checked && <Ionicons name="checkmark" size={12} color={theme.colors.onPrimary} />}
            </View>
            <Text
                style={[
                    styles.talkingPointText,
                    {
                        color: point.checked ? theme.colors.onSurfaceVariant : theme.colors.onSurface,
                        textDecorationLine: point.checked ? "line-through" : "none"
                    }
                ]}
            >
                {point.text}
            </Text>
        </Pressable>
    );
}
function AudioFileRow({ file }: { file: AudioFile }) {
    const { theme } = useUnistyles();
    return (
        <View
            style={[
                styles.audioRow,
                {
                    backgroundColor: `${theme.colors.primary}08`
                }
            ]}
        >
            <View
                style={[
                    styles.audioIconWrap,
                    {
                        backgroundColor: `${theme.colors.primary}18`
                    }
                ]}
            >
                <Ionicons name="play" size={14} color={theme.colors.primary} />
            </View>
            <View style={styles.audioInfo}>
                <Text
                    style={[
                        styles.audioLabel,
                        {
                            color: theme.colors.onSurface
                        }
                    ]}
                >
                    {file.label}
                </Text>
                <Text
                    style={[
                        styles.audioDuration,
                        {
                            color: theme.colors.onSurfaceVariant
                        }
                    ]}
                >
                    {file.duration}
                </Text>
            </View>
            <Ionicons name={file.icon} size={18} color={theme.colors.onSurfaceVariant} />
        </View>
    );
}
function EpisodeDetailPanel({
    episode,
    talkingPoints,
    onTogglePoint
}: {
    episode: Episode;
    talkingPoints: TalkingPoint[];
    onTogglePoint: (index: number) => void;
}) {
    const { theme } = useUnistyles();
    const checkedCount = talkingPoints.filter((tp) => tp.checked).length;
    return (
        <View
            style={[
                styles.detailPanel,
                {
                    borderTopColor: theme.colors.outlineVariant
                }
            ]}
        >
            {/* Outline */}
            <View style={styles.detailSection}>
                <View style={styles.detailSectionHeader}>
                    <Ionicons name="document-text-outline" size={16} color={theme.colors.tertiary} />
                    <Text
                        style={[
                            styles.detailSectionTitle,
                            {
                                color: theme.colors.onSurface
                            }
                        ]}
                    >
                        Episode Outline
                    </Text>
                </View>
                <Text
                    style={[
                        styles.outlineText,
                        {
                            color: theme.colors.onSurfaceVariant
                        }
                    ]}
                >
                    {episode.outline}
                </Text>
            </View>

            {/* Talking Points */}
            <View style={styles.detailSection}>
                <View style={styles.detailSectionHeader}>
                    <Ionicons name="chatbubbles-outline" size={16} color={theme.colors.secondary} />
                    <Text
                        style={[
                            styles.detailSectionTitle,
                            {
                                color: theme.colors.onSurface
                            }
                        ]}
                    >
                        Talking Points
                    </Text>
                    <Text
                        style={[
                            styles.detailSectionCount,
                            {
                                color: theme.colors.primary
                            }
                        ]}
                    >
                        {checkedCount}/{talkingPoints.length}
                    </Text>
                </View>
                {talkingPoints.map((tp, i) => (
                    <TalkingPointItem key={`${episode.id}-tp-${i}`} point={tp} onToggle={() => onTogglePoint(i)} />
                ))}
            </View>

            {/* Show Notes */}
            <View style={styles.detailSection}>
                <View style={styles.detailSectionHeader}>
                    <Ionicons name="reader-outline" size={16} color="#d97706" />
                    <Text
                        style={[
                            styles.detailSectionTitle,
                            {
                                color: theme.colors.onSurface
                            }
                        ]}
                    >
                        Show Notes
                    </Text>
                </View>
                <Text
                    style={[
                        styles.showNotesText,
                        {
                            color: theme.colors.onSurfaceVariant
                        }
                    ]}
                >
                    {episode.showNotes}
                </Text>
            </View>

            {/* Audio Files */}
            {episode.audioFiles.length > 0 && (
                <View style={styles.detailSection}>
                    <View style={styles.detailSectionHeader}>
                        <Ionicons name="headset-outline" size={16} color={theme.colors.primary} />
                        <Text
                            style={[
                                styles.detailSectionTitle,
                                {
                                    color: theme.colors.onSurface
                                }
                            ]}
                        >
                            Audio Files
                        </Text>
                    </View>
                    <View style={styles.audioList}>
                        {episode.audioFiles.map((file, i) => (
                            <AudioFileRow key={`${episode.id}-audio-${i}`} file={file} />
                        ))}
                    </View>
                </View>
            )}
        </View>
    );
}
function EpisodeRow({
    episode,
    expanded,
    onToggle,
    talkingPoints,
    onTogglePoint
}: {
    episode: Episode;
    expanded: boolean;
    onToggle: () => void;
    talkingPoints: TalkingPoint[];
    onTogglePoint: (index: number) => void;
}) {
    const { theme } = useUnistyles();
    const statusColor = STATUS_META[episode.status].color;
    return (
        <Card
            style={[
                styles.episodeCard,
                {
                    borderColor: expanded ? `${statusColor}40` : theme.colors.outlineVariant
                }
            ]}
        >
            {/* Color strip */}
            <View
                style={[
                    styles.episodeStrip,
                    {
                        backgroundColor: statusColor
                    }
                ]}
            />

            <Pressable
                onPress={onToggle}
                style={({ pressed }) => [
                    styles.episodePressable,
                    {
                        opacity: pressed ? 0.85 : 1
                    }
                ]}
            >
                {/* Main row */}
                <View style={styles.episodeMainRow}>
                    <EpisodeNumberBadge num={episode.number} />
                    <View style={styles.episodeTitleArea}>
                        <Text
                            style={[
                                styles.episodeTitle,
                                {
                                    color: theme.colors.onSurface
                                }
                            ]}
                            numberOfLines={1}
                        >
                            {episode.title}
                        </Text>
                        <View style={styles.episodeMetaRow}>
                            <GuestAvatar initials={episode.guestInitials} color={episode.guestColor} size={22} />
                            <Text
                                style={[
                                    styles.episodeGuestName,
                                    {
                                        color: theme.colors.onSurfaceVariant
                                    }
                                ]}
                                numberOfLines={1}
                            >
                                {episode.guestName}
                            </Text>
                            <View style={styles.episodeMetaDivider} />
                            <Ionicons name="time-outline" size={12} color={theme.colors.onSurfaceVariant} />
                            <Text
                                style={[
                                    styles.episodeDuration,
                                    {
                                        color: theme.colors.onSurfaceVariant
                                    }
                                ]}
                            >
                                {episode.duration}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.episodeEndCol}>
                        <StatusChip status={episode.status} small />
                        <Ionicons
                            name={expanded ? "chevron-up" : "chevron-down"}
                            size={18}
                            color={theme.colors.onSurfaceVariant}
                            style={styles.episodeChevron}
                        />
                    </View>
                </View>
            </Pressable>

            {/* Expandable detail */}
            {expanded && (
                <EpisodeDetailPanel episode={episode} talkingPoints={talkingPoints} onTogglePoint={onTogglePoint} />
            )}
        </Card>
    );
}

// --- Main Component ---

export function PodcastPlannerPage() {
    const { theme } = useUnistyles();
    const [expandedId, setExpandedId] = React.useState<string | null>(null);
    const [talkingPointsMap, setTalkingPointsMap] = React.useState<Record<string, TalkingPoint[]>>(() => {
        const map: Record<string, TalkingPoint[]> = {};
        for (const ep of EPISODES) {
            map[ep.id] = ep.talkingPoints.map((tp) => ({
                ...tp
            }));
        }
        return map;
    });
    const statusGroups = React.useMemo(() => groupByStatus(EPISODES), []);
    const handleToggleExpand = React.useCallback((id: string) => {
        setExpandedId((prev) => (prev === id ? null : id));
    }, []);
    const handleTogglePoint = React.useCallback((episodeId: string, index: number) => {
        setTalkingPointsMap((prev) => {
            const points = [...(prev[episodeId] ?? [])];
            if (points[index]) {
                points[index] = {
                    ...points[index],
                    checked: !points[index].checked
                };
            }
            return {
                ...prev,
                [episodeId]: points
            };
        });
    }, []);

    // Stats
    const totalEpisodes = EPISODES.length;
    const publishedCount = EPISODES.filter((e) => e.status === "published").length;
    const inProgressCount = EPISODES.filter((e) => e.status === "recording" || e.status === "editing").length;
    return (
        <ShowcasePage
            style={{
                flex: 1,
                backgroundColor: theme.colors.surface
            }}
        >
            {/* Page Header */}
            <View style={styles.pageHeader}>
                <View style={styles.pageHeaderRow}>
                    <Ionicons name="mic" size={26} color={theme.colors.primary} />
                    <View>
                        <Text
                            style={[
                                styles.pageTitle,
                                {
                                    color: theme.colors.onSurface
                                }
                            ]}
                        >
                            Podcast Planner
                        </Text>
                        <Text
                            style={[
                                styles.pageSubtitle,
                                {
                                    color: theme.colors.onSurfaceVariant
                                }
                            ]}
                        >
                            DevTalk Weekly - Season 2
                        </Text>
                    </View>
                </View>
            </View>

            {/* Quick Stats */}
            <View style={styles.statsRow}>
                <Card style={styles.statCard}>
                    <Ionicons name="albums-outline" size={18} color={theme.colors.primary} />
                    <Text
                        style={[
                            styles.statValue,
                            {
                                color: theme.colors.primary
                            }
                        ]}
                    >
                        {totalEpisodes}
                    </Text>
                    <Text
                        style={[
                            styles.statLabel,
                            {
                                color: theme.colors.onSurfaceVariant
                            }
                        ]}
                    >
                        Episodes
                    </Text>
                </Card>
                <Card style={styles.statCard}>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#16a34a" />
                    <Text
                        style={[
                            styles.statValue,
                            {
                                color: "#16a34a"
                            }
                        ]}
                    >
                        {publishedCount}
                    </Text>
                    <Text
                        style={[
                            styles.statLabel,
                            {
                                color: theme.colors.onSurfaceVariant
                            }
                        ]}
                    >
                        Published
                    </Text>
                </Card>
                <Card style={styles.statCard}>
                    <Ionicons name="pulse-outline" size={18} color="#d97706" />
                    <Text
                        style={[
                            styles.statValue,
                            {
                                color: "#d97706"
                            }
                        ]}
                    >
                        {inProgressCount}
                    </Text>
                    <Text
                        style={[
                            styles.statLabel,
                            {
                                color: theme.colors.onSurfaceVariant
                            }
                        ]}
                    >
                        In Progress
                    </Text>
                </Card>
            </View>

            {/* Hero: Upcoming Episode */}
            <HeroCard episode={UPCOMING_EPISODE} />

            {/* Status-grouped episodes */}
            {statusGroups.map((group) => (
                <View key={group.status} style={styles.statusGroup}>
                    <StatusSectionHeader status={group.status} count={group.episodes.length} />
                    <View style={styles.episodeList}>
                        {group.episodes.map((ep) => (
                            <EpisodeRow
                                key={ep.id}
                                episode={ep}
                                expanded={expandedId === ep.id}
                                onToggle={() => handleToggleExpand(ep.id)}
                                talkingPoints={talkingPointsMap[ep.id] ?? []}
                                onTogglePoint={(idx) => handleTogglePoint(ep.id, idx)}
                            />
                        ))}
                    </View>
                </View>
            ))}
        </ShowcasePage>
    );
}

// --- Styles ---

const styles = StyleSheet.create((theme) => ({
    // Page header
    pageHeader: {
        paddingTop: 24,
        paddingBottom: 16
    },
    pageHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12
    },
    pageTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 24
    },
    pageSubtitle: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        marginTop: 1
    },
    // Stats
    statsRow: {
        flexDirection: "row",
        gap: 8,
        marginBottom: 16
    },
    statCard: {
        flex: 1,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 10,
        alignItems: "center",
        gap: 4
    },
    statValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 20
    },
    statLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },
    // Hero card
    heroCard: {
        borderRadius: 16,
        overflow: "hidden",
        marginBottom: 24
    },
    heroAccentBar: {
        flexDirection: "row",
        height: 4
    },
    heroAccentSegment: {
        height: 4
    },
    heroPadding: {
        padding: 16,
        gap: 14
    },
    heroTopRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    heroLabelRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5
    },
    heroLabel: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 11,
        letterSpacing: 1.2
    },
    heroTitleRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10
    },
    heroTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 18,
        lineHeight: 24,
        flex: 1
    },
    heroGuestRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10
    },
    heroGuestName: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 14
    },
    heroGuestSub: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },
    heroCountdownSection: {
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        borderRadius: 12,
        padding: 12
    },
    heroDatesList: {
        flex: 1,
        gap: 6
    },
    heroDateRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6
    },
    heroDateLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    heroDateValue: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 12
    },
    heroDateAway: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 10
    },
    heroProgressSection: {
        gap: 6
    },
    heroProgressHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    heroProgressLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    heroProgressCount: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 12
    },
    heroProgressTrack: {
        height: 6,
        borderRadius: 3,
        overflow: "hidden"
    },
    heroProgressFill: {
        height: 6,
        borderRadius: 3
    },
    // Countdown ring
    countdownRing: {
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 3,
        alignItems: "center",
        justifyContent: "center"
    },
    countdownNumber: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 22,
        lineHeight: 26
    },
    countdownLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 10,
        marginTop: -2
    },
    // Episode number badge
    epBadge: {
        minWidth: 36,
        height: 22,
        borderRadius: 11,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 8
    },
    epBadgeText: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11
    },
    // Section header
    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 12
    },
    sectionAccent: {
        width: 3,
        height: 20,
        borderRadius: 2
    },
    sectionTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 16
    },
    sectionCount: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center"
    },
    sectionLine: {
        flex: 1,
        height: 1,
        marginLeft: 4
    },
    // Status groups
    statusGroup: {
        marginBottom: 20
    },
    episodeList: {
        gap: 10
    },
    // Episode card
    episodeCard: {
        borderRadius: 14,
        overflow: "hidden",
        borderWidth: 1
    },
    episodeStrip: {
        height: 3
    },
    episodePressable: {
        padding: 14
    },
    episodeMainRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10
    },
    episodeTitleArea: {
        flex: 1,
        gap: 6
    },
    episodeTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 14,
        lineHeight: 18
    },
    episodeMetaRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6
    },
    episodeGuestName: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        flexShrink: 1
    },
    episodeMetaDivider: {
        width: 1,
        height: 12,
        backgroundColor: theme.colors.outlineVariant
    },
    episodeDuration: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11
    },
    episodeEndCol: {
        alignItems: "flex-end",
        gap: 6
    },
    episodeChevron: {
        marginTop: 2
    },
    // Detail panel
    detailPanel: {
        borderTopWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 14,
        gap: 16
    },
    detailSection: {
        gap: 8
    },
    detailSectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginBottom: 2
    },
    detailSectionTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 14
    },
    detailSectionCount: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 12,
        marginLeft: "auto"
    },
    outlineText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 20
    },
    showNotesText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 20,
        fontStyle: "italic"
    },
    // Talking points
    talkingPointRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 4
    },
    talkingPointCheckbox: {
        width: 20,
        height: 20,
        borderRadius: 4,
        borderWidth: 1.5,
        alignItems: "center",
        justifyContent: "center"
    },
    talkingPointText: {
        flex: 1,
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 18
    },
    // Audio files
    audioList: {
        gap: 8
    },
    audioRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        borderRadius: 10,
        padding: 10
    },
    audioIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center"
    },
    audioInfo: {
        flex: 1,
        gap: 1
    },
    audioLabel: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13
    },
    audioDuration: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11
    }
}));
