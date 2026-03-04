import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
// --- Types ---
import { Card } from "@/components/Card";
import { ShowcasePage } from "@/views/dev/showcase/components/ShowcasePage";

type ContentType = "video" | "reading" | "quiz" | "assignment";
type Lesson = {
    id: string;
    number: number;
    title: string;
    contentType: ContentType;
    durationMinutes: number;
    completed: boolean;
};
type CourseModule = {
    id: string;
    title: string;
    description: string;
    lessons: Lesson[];
};

// --- Mock Data ---

const initialModules: CourseModule[] = [
    {
        id: "m1",
        title: "Foundations of Design Systems",
        description: "Core principles and mental models for scalable design",
        lessons: [
            {
                id: "l1",
                number: 1,
                title: "What is a Design System?",
                contentType: "video",
                durationMinutes: 12,
                completed: true
            },
            {
                id: "l2",
                number: 2,
                title: "History and Evolution",
                contentType: "reading",
                durationMinutes: 8,
                completed: true
            },
            {
                id: "l3",
                number: 3,
                title: "Atomic Design Principles",
                contentType: "video",
                durationMinutes: 18,
                completed: true
            },
            {
                id: "l4",
                number: 4,
                title: "Foundations Quiz",
                contentType: "quiz",
                durationMinutes: 10,
                completed: true
            }
        ]
    },
    {
        id: "m2",
        title: "Color & Typography",
        description: "Building a cohesive visual language from scratch",
        lessons: [
            {
                id: "l5",
                number: 1,
                title: "Color Theory for UI",
                contentType: "video",
                durationMinutes: 22,
                completed: true
            },
            {
                id: "l6",
                number: 2,
                title: "Accessible Color Palettes",
                contentType: "reading",
                durationMinutes: 15,
                completed: true
            },
            {
                id: "l7",
                number: 3,
                title: "Type Scale & Hierarchy",
                contentType: "video",
                durationMinutes: 20,
                completed: false
            },
            {
                id: "l8",
                number: 4,
                title: "Build a Type System",
                contentType: "assignment",
                durationMinutes: 45,
                completed: false
            },
            {
                id: "l9",
                number: 5,
                title: "Color & Type Review",
                contentType: "quiz",
                durationMinutes: 12,
                completed: false
            }
        ]
    },
    {
        id: "m3",
        title: "Component Architecture",
        description: "Designing reusable, composable UI components",
        lessons: [
            {
                id: "l10",
                number: 1,
                title: "Component Anatomy",
                contentType: "video",
                durationMinutes: 16,
                completed: false
            },
            {
                id: "l11",
                number: 2,
                title: "Props, Variants & States",
                contentType: "reading",
                durationMinutes: 12,
                completed: false
            },
            {
                id: "l12",
                number: 3,
                title: "Composition Patterns",
                contentType: "video",
                durationMinutes: 25,
                completed: false
            },
            {
                id: "l13",
                number: 4,
                title: "Build a Button System",
                contentType: "assignment",
                durationMinutes: 60,
                completed: false
            },
            {
                id: "l14",
                number: 5,
                title: "Component Spec Review",
                contentType: "quiz",
                durationMinutes: 15,
                completed: false
            }
        ]
    },
    {
        id: "m4",
        title: "Tokens & Theming",
        description: "Design tokens, dark mode, and multi-brand support",
        lessons: [
            {
                id: "l15",
                number: 1,
                title: "What Are Design Tokens?",
                contentType: "video",
                durationMinutes: 14,
                completed: false
            },
            {
                id: "l16",
                number: 2,
                title: "Token Naming Conventions",
                contentType: "reading",
                durationMinutes: 10,
                completed: false
            },
            {
                id: "l17",
                number: 3,
                title: "Implementing Dark Mode",
                contentType: "video",
                durationMinutes: 28,
                completed: false
            },
            {
                id: "l18",
                number: 4,
                title: "Multi-brand Theming Project",
                contentType: "assignment",
                durationMinutes: 90,
                completed: false
            }
        ]
    },
    {
        id: "m5",
        title: "Documentation & Governance",
        description: "Making your design system adoptable and maintainable",
        lessons: [
            {
                id: "l19",
                number: 1,
                title: "Writing Component Docs",
                contentType: "video",
                durationMinutes: 18,
                completed: false
            },
            {
                id: "l20",
                number: 2,
                title: "Contribution Guidelines",
                contentType: "reading",
                durationMinutes: 10,
                completed: false
            },
            {
                id: "l21",
                number: 3,
                title: "Versioning & Changelog",
                contentType: "video",
                durationMinutes: 15,
                completed: false
            },
            {
                id: "l22",
                number: 4,
                title: "Final Capstone Project",
                contentType: "assignment",
                durationMinutes: 120,
                completed: false
            }
        ]
    }
];
const CONTENT_TYPE_CONFIG: Record<
    ContentType,
    {
        icon: keyof typeof Ionicons.glyphMap;
        label: string;
    }
> = {
    video: {
        icon: "videocam",
        label: "Video"
    },
    reading: {
        icon: "book",
        label: "Reading"
    },
    quiz: {
        icon: "help-circle",
        label: "Quiz"
    },
    assignment: {
        icon: "code-slash",
        label: "Assignment"
    }
};

// --- Helpers ---

function formatDuration(minutes: number): string {
    if (minutes >= 60) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    return `${minutes}m`;
}
function totalLessons(modules: CourseModule[]): number {
    return modules.reduce((sum, mod) => sum + mod.lessons.length, 0);
}
function totalCompleted(modules: CourseModule[]): number {
    return modules.reduce((sum, mod) => sum + mod.lessons.filter((l) => l.completed).length, 0);
}
function totalDuration(modules: CourseModule[]): number {
    return modules.reduce((sum, mod) => sum + mod.lessons.reduce((s, l) => s + l.durationMinutes, 0), 0);
}
function moduleCompleted(mod: CourseModule): number {
    return mod.lessons.filter((l) => l.completed).length;
}

// --- Progress Ring ---

function ProgressRing({
    percentage,
    size,
    strokeWidth,
    color,
    trackColor,
    label
}: {
    percentage: number;
    size: number;
    strokeWidth: number;
    color: string;
    trackColor: string;
    label: string;
}) {
    // Build a circular progress ring using small dot segments arranged in a circle.
    const segmentCount = 72;
    const radius = (size - strokeWidth) / 2;
    const center = size / 2;
    const filledSegments = Math.round((percentage / 100) * segmentCount);
    const segmentSize = strokeWidth * 0.7;
    const segments = [];
    for (let i = 0; i < segmentCount; i++) {
        const angle = (i / segmentCount) * 2 * Math.PI - Math.PI / 2;
        const x = center + radius * Math.cos(angle) - segmentSize / 2;
        const y = center + radius * Math.sin(angle) - segmentSize / 2;
        const isFilled = i < filledSegments;
        segments.push(
            <View
                key={i}
                style={{
                    position: "absolute",
                    left: x,
                    top: y,
                    width: segmentSize,
                    height: segmentSize,
                    borderRadius: segmentSize / 2,
                    backgroundColor: isFilled ? color : trackColor
                }}
            />
        );
    }
    return (
        <View
            style={{
                width: size,
                height: size
            }}
        >
            {segments}
            <View
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    justifyContent: "center",
                    alignItems: "center"
                }}
            >
                <Text
                    style={{
                        fontFamily: "IBMPlexSans-SemiBold",
                        fontSize: size * 0.2,
                        color
                    }}
                >
                    {Math.round(percentage)}%
                </Text>
                <Text
                    style={{
                        fontFamily: "IBMPlexSans-Regular",
                        fontSize: size * 0.085,
                        color: trackColor,
                        marginTop: 2
                    }}
                >
                    {label}
                </Text>
            </View>
        </View>
    );
}

// --- Module Progress Bar ---

function ModuleProgressBar({
    completed,
    total,
    fillColor,
    trackColor
}: {
    completed: number;
    total: number;
    fillColor: string;
    trackColor: string;
}) {
    const pct = total > 0 ? (completed / total) * 100 : 0;
    return (
        <View
            style={{
                gap: 4
            }}
        >
            <View
                style={[
                    styles.progressTrack,
                    {
                        backgroundColor: trackColor
                    }
                ]}
            >
                <View
                    style={[
                        styles.progressFill,
                        {
                            width: `${pct}%`,
                            backgroundColor: fillColor
                        }
                    ]}
                />
            </View>
        </View>
    );
}

// --- Content Type Chip ---

function ContentTypeChip({
    contentType,
    chipBg,
    chipColor
}: {
    contentType: ContentType;
    chipBg: string;
    chipColor: string;
}) {
    const config = CONTENT_TYPE_CONFIG[contentType];
    return (
        <View
            style={[
                styles.contentChip,
                {
                    backgroundColor: chipBg
                }
            ]}
        >
            <Ionicons name={config.icon} size={11} color={chipColor} />
            <Text
                style={[
                    styles.contentChipText,
                    {
                        color: chipColor
                    }
                ]}
            >
                {config.label}
            </Text>
        </View>
    );
}

// --- Lesson Row ---

function LessonRow({ lesson, onToggle, isLast }: { lesson: Lesson; onToggle: () => void; isLast: boolean }) {
    const { theme } = useUnistyles();
    const chipColors: Record<
        ContentType,
        {
            bg: string;
            color: string;
        }
    > = {
        video: {
            bg: `${theme.colors.primary}18`,
            color: theme.colors.primary
        },
        reading: {
            bg: `${theme.colors.tertiary}18`,
            color: theme.colors.tertiary
        },
        quiz: {
            bg: `${theme.colors.secondary}18`,
            color: theme.colors.secondary
        },
        assignment: {
            bg: `${theme.colors.error}18`,
            color: theme.colors.error
        }
    };
    const chip = chipColors[lesson.contentType];
    return (
        <Pressable
            onPress={onToggle}
            style={({ pressed }) => [
                styles.lessonRow,
                {
                    opacity: pressed ? 0.7 : 1,
                    borderBottomWidth: isLast ? 0 : 1,
                    borderBottomColor: theme.colors.outlineVariant
                }
            ]}
        >
            {/* Lesson number indicator */}
            <View
                style={[
                    styles.lessonNumber,
                    {
                        backgroundColor: lesson.completed ? theme.colors.primary : theme.colors.surfaceContainerHighest,
                        borderColor: lesson.completed ? theme.colors.primary : theme.colors.outlineVariant
                    }
                ]}
            >
                {lesson.completed ? (
                    <Ionicons name="checkmark" size={12} color={theme.colors.onPrimary} />
                ) : (
                    <Text
                        style={[
                            styles.lessonNumberText,
                            {
                                color: theme.colors.onSurfaceVariant
                            }
                        ]}
                    >
                        {lesson.number}
                    </Text>
                )}
            </View>

            {/* Middle content */}
            <View style={styles.lessonContent}>
                <Text
                    style={[
                        styles.lessonTitle,
                        {
                            color: lesson.completed ? theme.colors.onSurfaceVariant : theme.colors.onSurface,
                            textDecorationLine: lesson.completed ? "line-through" : "none"
                        }
                    ]}
                    numberOfLines={1}
                >
                    {lesson.title}
                </Text>

                <View style={styles.lessonMeta}>
                    <ContentTypeChip contentType={lesson.contentType} chipBg={chip.bg} chipColor={chip.color} />
                    <View style={styles.durationBadge}>
                        <Ionicons name="time-outline" size={11} color={theme.colors.onSurfaceVariant} />
                        <Text
                            style={[
                                styles.durationText,
                                {
                                    color: theme.colors.onSurfaceVariant
                                }
                            ]}
                        >
                            {formatDuration(lesson.durationMinutes)}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Completion checkbox */}
            <View
                style={[
                    styles.checkbox,
                    {
                        borderColor: lesson.completed ? theme.colors.primary : theme.colors.outline,
                        backgroundColor: lesson.completed ? theme.colors.primary : "transparent"
                    }
                ]}
            >
                {lesson.completed && <Ionicons name="checkmark" size={14} color={theme.colors.onPrimary} />}
            </View>
        </Pressable>
    );
}

// --- Module Section ---

function ModuleSection({
    mod,
    index,
    expanded,
    onToggleExpand,
    onToggleLesson
}: {
    mod: CourseModule;
    index: number;
    expanded: boolean;
    onToggleExpand: () => void;
    onToggleLesson: (lessonId: string) => void;
}) {
    const { theme } = useUnistyles();
    const completed = moduleCompleted(mod);
    const total = mod.lessons.length;
    const allDone = completed === total;
    const moduleDuration = mod.lessons.reduce((s, l) => s + l.durationMinutes, 0);
    return (
        <Card
            style={[
                styles.moduleCard,
                {
                    borderColor: allDone ? theme.colors.primary : theme.colors.outlineVariant
                }
            ]}
        >
            {/* Module header - pressable to collapse/expand */}
            <Pressable
                onPress={onToggleExpand}
                style={({ pressed }) => [
                    styles.moduleHeader,
                    {
                        opacity: pressed ? 0.8 : 1
                    }
                ]}
            >
                <View style={styles.moduleHeaderLeft}>
                    {/* Module index badge */}
                    <View
                        style={[
                            styles.moduleIndexBadge,
                            {
                                backgroundColor: allDone ? theme.colors.primary : `${theme.colors.primary}18`
                            }
                        ]}
                    >
                        {allDone ? (
                            <Ionicons name="checkmark" size={14} color={theme.colors.onPrimary} />
                        ) : (
                            <Text
                                style={[
                                    styles.moduleIndexText,
                                    {
                                        color: theme.colors.primary
                                    }
                                ]}
                            >
                                {index + 1}
                            </Text>
                        )}
                    </View>

                    <View style={styles.moduleTitleBlock}>
                        <Text
                            style={[
                                styles.moduleTitle,
                                {
                                    color: theme.colors.onSurface
                                }
                            ]}
                            numberOfLines={1}
                        >
                            {mod.title}
                        </Text>
                        <Text
                            style={[
                                styles.moduleDescription,
                                {
                                    color: theme.colors.onSurfaceVariant
                                }
                            ]}
                            numberOfLines={1}
                        >
                            {mod.description}
                        </Text>
                    </View>
                </View>

                <Ionicons
                    name={expanded ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={theme.colors.onSurfaceVariant}
                />
            </Pressable>

            {/* Progress bar + stats */}
            <View style={styles.moduleProgressSection}>
                <ModuleProgressBar
                    completed={completed}
                    total={total}
                    fillColor={allDone ? theme.colors.primary : theme.colors.tertiary}
                    trackColor={`${theme.colors.onSurface}12`}
                />
                <View style={styles.moduleStats}>
                    <Text
                        style={[
                            styles.moduleStatText,
                            {
                                color: theme.colors.onSurfaceVariant
                            }
                        ]}
                    >
                        {completed}/{total} lessons
                    </Text>
                    <View style={styles.moduleStatDot} />
                    <Text
                        style={[
                            styles.moduleStatText,
                            {
                                color: theme.colors.onSurfaceVariant
                            }
                        ]}
                    >
                        {formatDuration(moduleDuration)}
                    </Text>
                </View>
            </View>

            {/* Expanded lesson list */}
            {expanded && (
                <View
                    style={[
                        styles.lessonsContainer,
                        {
                            borderTopColor: theme.colors.outlineVariant
                        }
                    ]}
                >
                    {mod.lessons.map((lesson, i) => (
                        <LessonRow
                            key={lesson.id}
                            lesson={lesson}
                            onToggle={() => onToggleLesson(lesson.id)}
                            isLast={i === mod.lessons.length - 1}
                        />
                    ))}
                </View>
            )}
        </Card>
    );
}

// --- Main Component ---

export function CourseCurriculumPage() {
    const { theme } = useUnistyles();
    const [modules, setModules] = React.useState(initialModules);
    const [expandedModules, setExpandedModules] = React.useState<Set<string>>(
        () => new Set(["m2"]) // Start with the in-progress module expanded
    );
    const toggleExpand = React.useCallback((moduleId: string) => {
        setExpandedModules((prev) => {
            const next = new Set(prev);
            if (next.has(moduleId)) {
                next.delete(moduleId);
            } else {
                next.add(moduleId);
            }
            return next;
        });
    }, []);
    const toggleLesson = React.useCallback((lessonId: string) => {
        setModules((prev) =>
            prev.map((mod) => ({
                ...mod,
                lessons: mod.lessons.map((l) =>
                    l.id === lessonId
                        ? {
                              ...l,
                              completed: !l.completed
                          }
                        : l
                )
            }))
        );
    }, []);
    const allLessons = totalLessons(modules);
    const allCompleted = totalCompleted(modules);
    const allDuration = totalDuration(modules);
    const overallPct = allLessons > 0 ? (allCompleted / allLessons) * 100 : 0;

    // Count content types
    const contentCounts = React.useMemo(() => {
        const counts: Record<ContentType, number> = {
            video: 0,
            reading: 0,
            quiz: 0,
            assignment: 0
        };
        for (const mod of modules) {
            for (const l of mod.lessons) {
                counts[l.contentType]++;
            }
        }
        return counts;
    }, [modules]);
    return (
        <ShowcasePage
            style={{
                flex: 1,
                backgroundColor: theme.colors.surface
            }}
            bottomInset={48}
        >
            {/* Course Header Card */}
            <Card
                style={[
                    styles.headerCard,
                    {
                        backgroundColor: theme.colors.primary
                    }
                ]}
            >
                <View style={styles.headerTopRow}>
                    <View style={styles.headerBadge}>
                        <Text
                            style={[
                                styles.headerBadgeText,
                                {
                                    color: theme.colors.primary
                                }
                            ]}
                        >
                            DESIGN SYSTEMS
                        </Text>
                    </View>
                    <View
                        style={[
                            styles.publishedBadge,
                            {
                                backgroundColor: "rgba(255,255,255,0.2)"
                            }
                        ]}
                    >
                        <View style={styles.publishedDot} />
                        <Text
                            style={[
                                styles.publishedText,
                                {
                                    color: theme.colors.onPrimary
                                }
                            ]}
                        >
                            Published
                        </Text>
                    </View>
                </View>

                <Text
                    style={[
                        styles.courseTitle,
                        {
                            color: theme.colors.onPrimary
                        }
                    ]}
                >
                    Design Systems Masterclass
                </Text>
                <Text
                    style={[
                        styles.courseSubtitle,
                        {
                            color: `${theme.colors.onPrimary}BB`
                        }
                    ]}
                >
                    From foundations to production-ready component libraries
                </Text>

                {/* Progress ring centered */}
                <View style={styles.ringContainer}>
                    <ProgressRing
                        percentage={overallPct}
                        size={130}
                        strokeWidth={8}
                        color={theme.colors.onPrimary}
                        trackColor="rgba(255,255,255,0.25)"
                        label="complete"
                    />
                </View>

                {/* Quick stats row */}
                <View style={styles.headerStatsRow}>
                    <View style={styles.headerStat}>
                        <Ionicons name="layers-outline" size={16} color={theme.colors.onPrimary} />
                        <Text
                            style={[
                                styles.headerStatValue,
                                {
                                    color: theme.colors.onPrimary
                                }
                            ]}
                        >
                            {modules.length}
                        </Text>
                        <Text
                            style={[
                                styles.headerStatLabel,
                                {
                                    color: `${theme.colors.onPrimary}AA`
                                }
                            ]}
                        >
                            Modules
                        </Text>
                    </View>
                    <View
                        style={[
                            styles.headerStatDivider,
                            {
                                backgroundColor: `${theme.colors.onPrimary}30`
                            }
                        ]}
                    />
                    <View style={styles.headerStat}>
                        <Ionicons name="document-text-outline" size={16} color={theme.colors.onPrimary} />
                        <Text
                            style={[
                                styles.headerStatValue,
                                {
                                    color: theme.colors.onPrimary
                                }
                            ]}
                        >
                            {allLessons}
                        </Text>
                        <Text
                            style={[
                                styles.headerStatLabel,
                                {
                                    color: `${theme.colors.onPrimary}AA`
                                }
                            ]}
                        >
                            Lessons
                        </Text>
                    </View>
                    <View
                        style={[
                            styles.headerStatDivider,
                            {
                                backgroundColor: `${theme.colors.onPrimary}30`
                            }
                        ]}
                    />
                    <View style={styles.headerStat}>
                        <Ionicons name="time-outline" size={16} color={theme.colors.onPrimary} />
                        <Text
                            style={[
                                styles.headerStatValue,
                                {
                                    color: theme.colors.onPrimary
                                }
                            ]}
                        >
                            {formatDuration(allDuration)}
                        </Text>
                        <Text
                            style={[
                                styles.headerStatLabel,
                                {
                                    color: `${theme.colors.onPrimary}AA`
                                }
                            ]}
                        >
                            Total
                        </Text>
                    </View>
                </View>
            </Card>

            {/* Section label */}
            <View style={styles.sectionLabel}>
                <Ionicons name="school-outline" size={18} color={theme.colors.onSurface} />
                <Text
                    style={[
                        styles.sectionLabelText,
                        {
                            color: theme.colors.onSurface
                        }
                    ]}
                >
                    Course Modules
                </Text>
            </View>

            {/* Module list */}
            <View style={styles.moduleList}>
                {modules.map((mod, index) => (
                    <ModuleSection
                        key={mod.id}
                        mod={mod}
                        index={index}
                        expanded={expandedModules.has(mod.id)}
                        onToggleExpand={() => toggleExpand(mod.id)}
                        onToggleLesson={toggleLesson}
                    />
                ))}
            </View>

            {/* Summary Card */}
            <Card
                style={[
                    styles.summaryCard,
                    {
                        borderColor: theme.colors.outlineVariant
                    }
                ]}
            >
                <View style={styles.summaryHeader}>
                    <Ionicons name="stats-chart" size={18} color={theme.colors.tertiary} />
                    <Text
                        style={[
                            styles.summaryTitle,
                            {
                                color: theme.colors.onSurface
                            }
                        ]}
                    >
                        Course Summary
                    </Text>
                </View>

                {/* Content type breakdown */}
                <View style={styles.contentBreakdown}>
                    {(Object.keys(CONTENT_TYPE_CONFIG) as ContentType[]).map((type) => {
                        const config = CONTENT_TYPE_CONFIG[type];
                        const chipColors: Record<ContentType, string> = {
                            video: theme.colors.primary,
                            reading: theme.colors.tertiary,
                            quiz: theme.colors.secondary,
                            assignment: theme.colors.error
                        };
                        const color = chipColors[type];
                        return (
                            <View key={type} style={styles.breakdownItem}>
                                <View
                                    style={[
                                        styles.breakdownIconCircle,
                                        {
                                            backgroundColor: `${color}18`
                                        }
                                    ]}
                                >
                                    <Ionicons name={config.icon} size={16} color={color} />
                                </View>
                                <View style={styles.breakdownText}>
                                    <Text
                                        style={[
                                            styles.breakdownCount,
                                            {
                                                color: theme.colors.onSurface
                                            }
                                        ]}
                                    >
                                        {contentCounts[type]}
                                    </Text>
                                    <Text
                                        style={[
                                            styles.breakdownLabel,
                                            {
                                                color: theme.colors.onSurfaceVariant
                                            }
                                        ]}
                                    >
                                        {config.label}s
                                    </Text>
                                </View>
                            </View>
                        );
                    })}
                </View>

                {/* Completion overview */}
                <View
                    style={[
                        styles.completionRow,
                        {
                            borderTopColor: theme.colors.outlineVariant
                        }
                    ]}
                >
                    <View style={styles.completionItem}>
                        <Ionicons name="checkmark-done" size={16} color={theme.colors.primary} />
                        <Text
                            style={[
                                styles.completionValue,
                                {
                                    color: theme.colors.onSurface
                                }
                            ]}
                        >
                            {allCompleted}/{allLessons}
                        </Text>
                        <Text
                            style={[
                                styles.completionLabel,
                                {
                                    color: theme.colors.onSurfaceVariant
                                }
                            ]}
                        >
                            Completed
                        </Text>
                    </View>
                    <View
                        style={[
                            styles.completionDivider,
                            {
                                backgroundColor: theme.colors.outlineVariant
                            }
                        ]}
                    />
                    <View style={styles.completionItem}>
                        <Ionicons name="time" size={16} color={theme.colors.tertiary} />
                        <Text
                            style={[
                                styles.completionValue,
                                {
                                    color: theme.colors.onSurface
                                }
                            ]}
                        >
                            {formatDuration(allDuration)}
                        </Text>
                        <Text
                            style={[
                                styles.completionLabel,
                                {
                                    color: theme.colors.onSurfaceVariant
                                }
                            ]}
                        >
                            Total Time
                        </Text>
                    </View>
                    <View
                        style={[
                            styles.completionDivider,
                            {
                                backgroundColor: theme.colors.outlineVariant
                            }
                        ]}
                    />
                    <View style={styles.completionItem}>
                        <Ionicons name="rocket" size={16} color={theme.colors.secondary} />
                        <Text
                            style={[
                                styles.completionValue,
                                {
                                    color: theme.colors.onSurface
                                }
                            ]}
                        >
                            {Math.round(overallPct)}%
                        </Text>
                        <Text
                            style={[
                                styles.completionLabel,
                                {
                                    color: theme.colors.onSurfaceVariant
                                }
                            ]}
                        >
                            Progress
                        </Text>
                    </View>
                </View>

                {/* Published status pill */}
                <View style={styles.statusRow}>
                    <View
                        style={[
                            styles.statusPill,
                            {
                                backgroundColor: `${theme.colors.primary}14`
                            }
                        ]}
                    >
                        <View
                            style={[
                                styles.statusDotSmall,
                                {
                                    backgroundColor: theme.colors.primary
                                }
                            ]}
                        />
                        <Text
                            style={[
                                styles.statusPillText,
                                {
                                    color: theme.colors.primary
                                }
                            ]}
                        >
                            Published
                        </Text>
                    </View>
                    <Text
                        style={[
                            styles.lastUpdated,
                            {
                                color: theme.colors.onSurfaceVariant
                            }
                        ]}
                    >
                        Last updated Mar 1, 2026
                    </Text>
                </View>
            </Card>
        </ShowcasePage>
    );
}

// --- Styles ---

const styles = StyleSheet.create((_theme) => ({
    // Header card
    headerCard: {
        borderRadius: 20,
        padding: 24,
        marginTop: 16,
        gap: 4
    },
    headerTopRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12
    },
    headerBadge: {
        backgroundColor: "rgba(255,255,255,0.95)",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8
    },
    headerBadgeText: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 1
    },
    publishedBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10
    },
    publishedDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: "#4ADE80"
    },
    publishedText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 12
    },
    courseTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 26,
        letterSpacing: -0.5
    },
    courseSubtitle: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14,
        marginBottom: 8
    },
    ringContainer: {
        alignItems: "center",
        paddingVertical: 16
    },
    headerStatsRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
        marginTop: 4
    },
    headerStat: {
        flex: 1,
        alignItems: "center",
        gap: 4
    },
    headerStatValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 18
    },
    headerStatLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },
    headerStatDivider: {
        width: 1,
        height: 36
    },
    // Section label
    sectionLabel: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginTop: 28,
        marginBottom: 14,
        paddingHorizontal: 4
    },
    sectionLabelText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 18
    },
    // Module list
    moduleList: {
        gap: 12
    },
    // Module card
    moduleCard: {
        borderRadius: 16,
        borderWidth: 1,
        overflow: "hidden"
    },
    moduleHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 16,
        paddingBottom: 8
    },
    moduleHeaderLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        flex: 1,
        marginRight: 8
    },
    moduleIndexBadge: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: "center",
        justifyContent: "center"
    },
    moduleIndexText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 14
    },
    moduleTitleBlock: {
        flex: 1,
        gap: 2
    },
    moduleTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15
    },
    moduleDescription: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    moduleProgressSection: {
        paddingHorizontal: 16,
        paddingBottom: 14,
        gap: 6
    },
    moduleStats: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6
    },
    moduleStatText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    moduleStatDot: {
        width: 3,
        height: 3,
        borderRadius: 2,
        backgroundColor: "#999"
    },
    // Progress bar
    progressTrack: {
        height: 6,
        borderRadius: 3,
        overflow: "hidden"
    },
    progressFill: {
        height: "100%",
        borderRadius: 3
    },
    // Lessons container
    lessonsContainer: {
        borderTopWidth: 1,
        marginHorizontal: 0
    },
    // Lesson row
    lessonRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12
    },
    lessonNumber: {
        width: 26,
        height: 26,
        borderRadius: 13,
        borderWidth: 1.5,
        alignItems: "center",
        justifyContent: "center"
    },
    lessonNumberText: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11
    },
    lessonContent: {
        flex: 1,
        gap: 4
    },
    lessonTitle: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 14
    },
    lessonMeta: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    // Content type chip
    contentChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8
    },
    contentChipText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 10,
        letterSpacing: 0.3
    },
    // Duration badge
    durationBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3
    },
    durationText: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11
    },
    // Checkbox
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        alignItems: "center",
        justifyContent: "center"
    },
    // Summary card
    summaryCard: {
        marginTop: 28,
        borderRadius: 16,
        borderWidth: 1,
        padding: 20,
        gap: 16
    },
    summaryHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    summaryTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 16
    },
    // Content breakdown
    contentBreakdown: {
        flexDirection: "row",
        justifyContent: "space-between"
    },
    breakdownItem: {
        alignItems: "center",
        gap: 6
    },
    breakdownIconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center"
    },
    breakdownText: {
        alignItems: "center",
        gap: 1
    },
    breakdownCount: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 16
    },
    breakdownLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },
    // Completion row
    completionRow: {
        flexDirection: "row",
        borderTopWidth: 1,
        paddingTop: 16,
        justifyContent: "space-between"
    },
    completionItem: {
        flex: 1,
        alignItems: "center",
        gap: 4
    },
    completionValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15
    },
    completionLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },
    completionDivider: {
        width: 1,
        height: 44,
        alignSelf: "center"
    },
    // Status row
    statusRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between"
    },
    statusPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10
    },
    statusDotSmall: {
        width: 6,
        height: 6,
        borderRadius: 3
    },
    statusPillText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 12
    },
    lastUpdated: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    }
}));
