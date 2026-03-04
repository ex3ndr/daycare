import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { ShowcasePage } from "@/views/dev/showcase/components/ShowcasePage";

// --- Types ---

type LanguageKey = "japanese" | "spanish" | "french" | "korean";

type Language = {
    key: LanguageKey;
    name: string;
    flag: string;
    level: string;
    streak: number;
    wordsLearned: number;
    hoursStudied: number;
    xp: number;
    xpToNext: number;
};

type PracticeItem = {
    id: string;
    category: string;
    icon: keyof typeof Ionicons.glyphMap;
    completed: boolean;
};

type VocabWord = {
    id: string;
    native: string;
    translation: string;
    mastery: number; // 0-100
};

type Resource = {
    id: string;
    name: string;
    type: "book" | "app" | "course";
    icon: keyof typeof Ionicons.glyphMap;
    progress: number; // 0-100
};

// --- Mock Data ---

const LANGUAGES: Language[] = [
    {
        key: "japanese",
        name: "Japanese",
        flag: "\u{1F1EF}\u{1F1F5}",
        level: "N4",
        streak: 47,
        wordsLearned: 1240,
        hoursStudied: 186,
        xp: 3400,
        xpToNext: 5000
    },
    {
        key: "spanish",
        name: "Spanish",
        flag: "\u{1F1EA}\u{1F1F8}",
        level: "B1",
        streak: 23,
        wordsLearned: 890,
        hoursStudied: 112,
        xp: 2100,
        xpToNext: 3000
    },
    {
        key: "french",
        name: "French",
        flag: "\u{1F1EB}\u{1F1F7}",
        level: "A2",
        streak: 8,
        wordsLearned: 420,
        hoursStudied: 54,
        xp: 980,
        xpToNext: 2000
    },
    {
        key: "korean",
        name: "Korean",
        flag: "\u{1F1F0}\u{1F1F7}",
        level: "A1",
        streak: 3,
        wordsLearned: 85,
        hoursStudied: 12,
        xp: 210,
        xpToNext: 1000
    }
];

const PRACTICE_DATA: Record<LanguageKey, PracticeItem[]> = {
    japanese: [
        { id: "j1", category: "Vocabulary", icon: "text-outline", completed: true },
        { id: "j2", category: "Grammar", icon: "construct-outline", completed: true },
        { id: "j3", category: "Listening", icon: "headset-outline", completed: false },
        { id: "j4", category: "Speaking", icon: "mic-outline", completed: false },
        { id: "j5", category: "Reading", icon: "book-outline", completed: true }
    ],
    spanish: [
        { id: "s1", category: "Vocabulary", icon: "text-outline", completed: true },
        { id: "s2", category: "Grammar", icon: "construct-outline", completed: false },
        { id: "s3", category: "Listening", icon: "headset-outline", completed: true },
        { id: "s4", category: "Speaking", icon: "mic-outline", completed: false },
        { id: "s5", category: "Reading", icon: "book-outline", completed: false }
    ],
    french: [
        { id: "f1", category: "Vocabulary", icon: "text-outline", completed: false },
        { id: "f2", category: "Grammar", icon: "construct-outline", completed: false },
        { id: "f3", category: "Listening", icon: "headset-outline", completed: true },
        { id: "f4", category: "Speaking", icon: "mic-outline", completed: false },
        { id: "f5", category: "Reading", icon: "book-outline", completed: false }
    ],
    korean: [
        { id: "k1", category: "Vocabulary", icon: "text-outline", completed: false },
        { id: "k2", category: "Grammar", icon: "construct-outline", completed: false },
        { id: "k3", category: "Listening", icon: "headset-outline", completed: false },
        { id: "k4", category: "Speaking", icon: "mic-outline", completed: false },
        { id: "k5", category: "Reading", icon: "book-outline", completed: false }
    ]
};

const VOCAB_DATA: Record<LanguageKey, VocabWord[]> = {
    japanese: [
        { id: "jv1", native: "\u5143\u6C17", translation: "energy, vigor", mastery: 85 },
        { id: "jv2", native: "\u7D4C\u9A13", translation: "experience", mastery: 62 },
        { id: "jv3", native: "\u74B0\u5883", translation: "environment", mastery: 40 },
        { id: "jv4", native: "\u5F71\u97FF", translation: "influence", mastery: 28 },
        { id: "jv5", native: "\u6311\u6226", translation: "challenge", mastery: 15 }
    ],
    spanish: [
        { id: "sv1", native: "desarrollo", translation: "development", mastery: 90 },
        { id: "sv2", native: "conocimiento", translation: "knowledge", mastery: 72 },
        { id: "sv3", native: "esperanza", translation: "hope", mastery: 55 },
        { id: "sv4", native: "madrugada", translation: "early morning", mastery: 30 },
        { id: "sv5", native: "desaf\u00EDo", translation: "challenge", mastery: 18 }
    ],
    french: [
        { id: "fv1", native: "d\u00E9veloppement", translation: "development", mastery: 78 },
        { id: "fv2", native: "quotidien", translation: "daily", mastery: 50 },
        { id: "fv3", native: "connaissance", translation: "knowledge", mastery: 35 },
        { id: "fv4", native: "\u00E9panouissement", translation: "fulfillment", mastery: 12 }
    ],
    korean: [
        { id: "kv1", native: "\uD559\uC2B5", translation: "study, learning", mastery: 60 },
        { id: "kv2", native: "\uACBD\uD5D8", translation: "experience", mastery: 42 },
        { id: "kv3", native: "\uC5F0\uC2B5", translation: "practice", mastery: 20 }
    ]
};

const RESOURCE_DATA: Record<LanguageKey, Resource[]> = {
    japanese: [
        { id: "jr1", name: "Genki II Textbook", type: "book", icon: "book-outline", progress: 65 },
        { id: "jr2", name: "WaniKani", type: "app", icon: "phone-portrait-outline", progress: 48 },
        { id: "jr3", name: "JapanesePod101", type: "course", icon: "desktop-outline", progress: 32 }
    ],
    spanish: [
        { id: "sr1", name: "Assimil Spanish", type: "book", icon: "book-outline", progress: 55 },
        { id: "sr2", name: "Anki Deck", type: "app", icon: "phone-portrait-outline", progress: 70 },
        { id: "sr3", name: "SpanishPod101", type: "course", icon: "desktop-outline", progress: 40 }
    ],
    french: [
        { id: "fr1", name: "Alter Ego+ A2", type: "book", icon: "book-outline", progress: 30 },
        { id: "fr2", name: "Duolingo", type: "app", icon: "phone-portrait-outline", progress: 62 }
    ],
    korean: [
        { id: "kr1", name: "Talk To Me In Korean", type: "book", icon: "book-outline", progress: 15 },
        { id: "kr2", name: "LingoDeer", type: "app", icon: "phone-portrait-outline", progress: 22 },
        { id: "kr3", name: "TTMIK Course", type: "course", icon: "desktop-outline", progress: 8 }
    ]
};

// --- Helpers ---

function getMasteryColor(mastery: number, primary: string, tertiary: string, error: string): string {
    if (mastery >= 70) return primary;
    if (mastery >= 40) return tertiary;
    return error;
}

// --- Streak Display ---

function StreakDisplay({ streak, color, bgColor }: { streak: number; color: string; bgColor: string }) {
    return (
        <View style={[styles.streakCard, { backgroundColor: bgColor }]}>
            <Ionicons name="flame" size={32} color={color} />
            <Text style={[styles.streakNumber, { color }]}>{streak}</Text>
            <Text style={[styles.streakLabel, { color: `${color}AA` }]}>day streak</Text>
        </View>
    );
}

// --- Metric Tile ---

function MetricTile({
    icon,
    value,
    label,
    iconColor,
    bgColor,
    textColor,
    labelColor
}: {
    icon: keyof typeof Ionicons.glyphMap;
    value: string;
    label: string;
    iconColor: string;
    bgColor: string;
    textColor: string;
    labelColor: string;
}) {
    return (
        <View style={[styles.metricTile, { backgroundColor: bgColor }]}>
            <Ionicons name={icon} size={20} color={iconColor} />
            <Text style={[styles.metricValue, { color: textColor }]}>{value}</Text>
            <Text style={[styles.metricLabel, { color: labelColor }]}>{label}</Text>
        </View>
    );
}

// --- XP Progress Bar ---

function XPProgressBar({
    xp,
    xpToNext,
    color,
    trackColor,
    textColor
}: {
    xp: number;
    xpToNext: number;
    color: string;
    trackColor: string;
    textColor: string;
}) {
    const pct = Math.min((xp / xpToNext) * 100, 100);

    return (
        <View style={styles.xpContainer}>
            <View style={styles.xpHeader}>
                <View style={styles.xpLabelRow}>
                    <Ionicons name="star" size={14} color={color} />
                    <Text style={[styles.xpLabel, { color: textColor }]}>XP Progress</Text>
                </View>
                <Text style={[styles.xpCount, { color }]}>
                    {xp.toLocaleString()} / {xpToNext.toLocaleString()}
                </Text>
            </View>
            <View style={[styles.xpTrack, { backgroundColor: trackColor }]}>
                <View style={[styles.xpFill, { width: `${pct}%`, backgroundColor: color }]} />
            </View>
        </View>
    );
}

// --- Vocab Card ---

function VocabCard({
    word,
    revealed,
    onReveal,
    primaryColor,
    tertiaryColor,
    errorColor,
    surfaceBg,
    textColor,
    subtextColor,
    trackColor
}: {
    word: VocabWord;
    revealed: boolean;
    onReveal: () => void;
    primaryColor: string;
    tertiaryColor: string;
    errorColor: string;
    surfaceBg: string;
    textColor: string;
    subtextColor: string;
    trackColor: string;
}) {
    const masteryColor = getMasteryColor(word.mastery, primaryColor, tertiaryColor, errorColor);

    return (
        <Pressable
            onPress={onReveal}
            style={({ pressed }) => [styles.vocabCard, { backgroundColor: surfaceBg, opacity: pressed ? 0.85 : 1 }]}
        >
            <View style={styles.vocabTopRow}>
                <Text style={[styles.vocabNative, { color: textColor }]}>{word.native}</Text>
                {revealed ? (
                    <Text style={[styles.vocabTranslation, { color: subtextColor }]}>{word.translation}</Text>
                ) : (
                    <View style={styles.vocabRevealHint}>
                        <Ionicons name="eye-outline" size={14} color={subtextColor} />
                        <Text style={[styles.vocabRevealText, { color: subtextColor }]}>tap to reveal</Text>
                    </View>
                )}
            </View>
            <View style={styles.vocabBottomRow}>
                <View style={[styles.vocabProgressTrack, { backgroundColor: trackColor }]}>
                    <View
                        style={[styles.vocabProgressFill, { width: `${word.mastery}%`, backgroundColor: masteryColor }]}
                    />
                </View>
                <Text style={[styles.vocabMasteryText, { color: masteryColor }]}>{word.mastery}%</Text>
            </View>
        </Pressable>
    );
}

// --- Main Component ---

export function LanguageLearningPage() {
    const { theme } = useUnistyles();
    const [selectedLang, setSelectedLang] = React.useState<LanguageKey>("japanese");
    const [practiceState, setPracticeState] = React.useState<Record<LanguageKey, Record<string, boolean>>>(() => {
        const state: Record<string, Record<string, boolean>> = {};
        for (const langKey of Object.keys(PRACTICE_DATA) as LanguageKey[]) {
            state[langKey] = {};
            for (const item of PRACTICE_DATA[langKey]) {
                state[langKey][item.id] = item.completed;
            }
        }
        return state as Record<LanguageKey, Record<string, boolean>>;
    });
    const [revealedWords, setRevealedWords] = React.useState<Record<string, boolean>>({});

    const lang = LANGUAGES.find((l) => l.key === selectedLang)!;
    const practice = PRACTICE_DATA[selectedLang];
    const vocab = VOCAB_DATA[selectedLang];
    const resources = RESOURCE_DATA[selectedLang];

    const togglePractice = React.useCallback(
        (itemId: string) => {
            setPracticeState((prev) => ({
                ...prev,
                [selectedLang]: {
                    ...prev[selectedLang],
                    [itemId]: !prev[selectedLang][itemId]
                }
            }));
        },
        [selectedLang]
    );

    const toggleReveal = React.useCallback((wordId: string) => {
        setRevealedWords((prev) => ({ ...prev, [wordId]: !prev[wordId] }));
    }, []);

    const practiceCompleted = practice.filter((p) => practiceState[selectedLang][p.id]).length;

    return (
        <ShowcasePage density="spacious" horizontalInset={16}>
            {/* Language Selector Tabs */}
            <View style={[styles.segmentedControl, { backgroundColor: theme.colors.surfaceContainer }]}>
                {LANGUAGES.map((l) => {
                    const isActive = l.key === selectedLang;
                    return (
                        <Pressable
                            key={l.key}
                            onPress={() => setSelectedLang(l.key)}
                            style={[
                                styles.segmentTab,
                                {
                                    backgroundColor: isActive ? theme.colors.primary : "transparent"
                                }
                            ]}
                        >
                            <Text style={styles.segmentFlag}>{l.flag}</Text>
                            <Text
                                style={[
                                    styles.segmentLabel,
                                    { color: isActive ? theme.colors.onPrimary : theme.colors.onSurfaceVariant }
                                ]}
                                numberOfLines={1}
                            >
                                {l.name}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>

            {/* Level Badge + Streak */}
            <View style={styles.heroRow}>
                <StreakDisplay streak={lang.streak} color={theme.colors.error} bgColor={`${theme.colors.error}14`} />
                <View style={styles.heroRight}>
                    <View style={[styles.levelBadge, { backgroundColor: `${theme.colors.primary}18` }]}>
                        <Ionicons name="shield-checkmark" size={16} color={theme.colors.primary} />
                        <Text style={[styles.levelText, { color: theme.colors.primary }]}>{lang.level}</Text>
                    </View>
                    <View style={styles.heroMetrics}>
                        <MetricTile
                            icon="text-outline"
                            value={lang.wordsLearned.toLocaleString()}
                            label="Words"
                            iconColor={theme.colors.tertiary}
                            bgColor={theme.colors.surfaceContainer}
                            textColor={theme.colors.onSurface}
                            labelColor={theme.colors.onSurfaceVariant}
                        />
                        <MetricTile
                            icon="time-outline"
                            value={`${lang.hoursStudied}h`}
                            label="Studied"
                            iconColor={theme.colors.secondary}
                            bgColor={theme.colors.surfaceContainer}
                            textColor={theme.colors.onSurface}
                            labelColor={theme.colors.onSurfaceVariant}
                        />
                    </View>
                </View>
            </View>

            {/* XP Progress */}
            <XPProgressBar
                xp={lang.xp}
                xpToNext={lang.xpToNext}
                color={theme.colors.primary}
                trackColor={theme.colors.outlineVariant}
                textColor={theme.colors.onSurface}
            />

            {/* Daily Practice Section */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitleRow}>
                        <Ionicons name="checkbox-outline" size={20} color={theme.colors.onSurface} />
                        <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Daily Practice</Text>
                    </View>
                    <Text style={[styles.sectionCount, { color: theme.colors.onSurfaceVariant }]}>
                        {practiceCompleted}/{practice.length}
                    </Text>
                </View>

                {/* Practice progress bar */}
                <View style={[styles.practiceProgressTrack, { backgroundColor: theme.colors.outlineVariant }]}>
                    <View
                        style={[
                            styles.practiceProgressFill,
                            {
                                width: `${(practiceCompleted / practice.length) * 100}%`,
                                backgroundColor: theme.colors.primary
                            }
                        ]}
                    />
                </View>

                <View style={styles.practiceList}>
                    {practice.map((item) => {
                        const isCompleted = practiceState[selectedLang][item.id];
                        return (
                            <Pressable
                                key={item.id}
                                onPress={() => togglePractice(item.id)}
                                style={({ pressed }) => [
                                    styles.practiceRow,
                                    {
                                        backgroundColor: isCompleted
                                            ? `${theme.colors.primary}0A`
                                            : theme.colors.surfaceContainer,
                                        borderColor: isCompleted ? theme.colors.primary : theme.colors.outlineVariant,
                                        opacity: pressed ? 0.85 : 1
                                    }
                                ]}
                            >
                                <View
                                    style={[
                                        styles.practiceIconCircle,
                                        {
                                            backgroundColor: isCompleted
                                                ? `${theme.colors.primary}20`
                                                : theme.colors.surfaceContainerHighest
                                        }
                                    ]}
                                >
                                    <Ionicons
                                        name={item.icon}
                                        size={18}
                                        color={isCompleted ? theme.colors.primary : theme.colors.onSurfaceVariant}
                                    />
                                </View>
                                <Text
                                    style={[
                                        styles.practiceLabel,
                                        {
                                            color: isCompleted ? theme.colors.primary : theme.colors.onSurface
                                        }
                                    ]}
                                >
                                    {item.category}
                                </Text>
                                <View
                                    style={[
                                        styles.checkbox,
                                        {
                                            borderColor: isCompleted ? theme.colors.primary : theme.colors.outline,
                                            backgroundColor: isCompleted ? theme.colors.primary : "transparent"
                                        }
                                    ]}
                                >
                                    {isCompleted && (
                                        <Ionicons name="checkmark" size={14} color={theme.colors.onPrimary} />
                                    )}
                                </View>
                            </Pressable>
                        );
                    })}
                </View>
            </View>

            {/* Vocabulary Review Section */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitleRow}>
                        <Ionicons name="language-outline" size={20} color={theme.colors.onSurface} />
                        <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Vocabulary Review</Text>
                    </View>
                    <View style={[styles.dueBadge, { backgroundColor: `${theme.colors.error}18` }]}>
                        <Text style={[styles.dueText, { color: theme.colors.error }]}>{vocab.length} due</Text>
                    </View>
                </View>
                <View style={styles.vocabList}>
                    {vocab.map((word) => (
                        <VocabCard
                            key={word.id}
                            word={word}
                            revealed={!!revealedWords[word.id]}
                            onReveal={() => toggleReveal(word.id)}
                            primaryColor={theme.colors.primary}
                            tertiaryColor={theme.colors.tertiary}
                            errorColor={theme.colors.error}
                            surfaceBg={theme.colors.surfaceContainer}
                            textColor={theme.colors.onSurface}
                            subtextColor={theme.colors.onSurfaceVariant}
                            trackColor={theme.colors.outlineVariant}
                        />
                    ))}
                </View>
            </View>

            {/* Resources Section */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitleRow}>
                        <Ionicons name="library-outline" size={20} color={theme.colors.onSurface} />
                        <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Resources</Text>
                    </View>
                </View>
                <View style={styles.resourceList}>
                    {resources.map((resource) => {
                        const typeColor =
                            resource.type === "book"
                                ? theme.colors.tertiary
                                : resource.type === "app"
                                  ? theme.colors.primary
                                  : theme.colors.secondary;

                        return (
                            <View
                                key={resource.id}
                                style={[
                                    styles.resourceCard,
                                    {
                                        backgroundColor: theme.colors.surfaceContainer,
                                        borderColor: theme.colors.outlineVariant
                                    }
                                ]}
                            >
                                <View style={[styles.resourceIconCircle, { backgroundColor: `${typeColor}18` }]}>
                                    <Ionicons name={resource.icon} size={20} color={typeColor} />
                                </View>
                                <View style={styles.resourceContent}>
                                    <View style={styles.resourceTopRow}>
                                        <Text
                                            style={[styles.resourceName, { color: theme.colors.onSurface }]}
                                            numberOfLines={1}
                                        >
                                            {resource.name}
                                        </Text>
                                        <View style={[styles.resourceTypeBadge, { backgroundColor: `${typeColor}18` }]}>
                                            <Text style={[styles.resourceTypeText, { color: typeColor }]}>
                                                {resource.type}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.resourceProgressRow}>
                                        <View
                                            style={[
                                                styles.resourceProgressTrack,
                                                { backgroundColor: theme.colors.outlineVariant }
                                            ]}
                                        >
                                            <View
                                                style={[
                                                    styles.resourceProgressFill,
                                                    {
                                                        width: `${resource.progress}%`,
                                                        backgroundColor: typeColor
                                                    }
                                                ]}
                                            />
                                        </View>
                                        <Text
                                            style={[
                                                styles.resourceProgressText,
                                                { color: theme.colors.onSurfaceVariant }
                                            ]}
                                        >
                                            {resource.progress}%
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        );
                    })}
                </View>
            </View>
        </ShowcasePage>
    );
}

// --- Styles ---

const styles = StyleSheet.create((theme) => ({
    // Segmented control
    segmentedControl: {
        flexDirection: "row",
        borderRadius: 14,
        padding: 4,
        marginTop: 20,
        gap: 4
    },
    segmentTab: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 10,
        borderRadius: 10
    },
    segmentFlag: {
        fontSize: 18
    },
    segmentLabel: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13
    },

    // Hero row: streak + level + metrics
    heroRow: {
        flexDirection: "row",
        marginTop: 20,
        gap: 14
    },
    heroRight: {
        flex: 1,
        gap: 10
    },
    streakCard: {
        width: 110,
        borderRadius: 16,
        padding: 16,
        alignItems: "center",
        justifyContent: "center",
        gap: 2
    },
    streakNumber: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 36,
        lineHeight: 40
    },
    streakLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    levelBadge: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10
    },
    levelText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 16,
        letterSpacing: 0.5
    },
    heroMetrics: {
        flexDirection: "row",
        gap: 10
    },

    // Metric tile
    metricTile: {
        flex: 1,
        borderRadius: 12,
        padding: 12,
        alignItems: "center",
        gap: 4
    },
    metricValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 18
    },
    metricLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },

    // XP bar
    xpContainer: {
        marginTop: 16,
        gap: 8
    },
    xpHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    xpLabelRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5
    },
    xpLabel: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13
    },
    xpCount: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 12
    },
    xpTrack: {
        height: 8,
        borderRadius: 4,
        overflow: "hidden"
    },
    xpFill: {
        height: "100%",
        borderRadius: 4
    },

    // Sections
    section: {
        marginTop: 28,
        gap: 12
    },
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    sectionTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    sectionTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 18
    },
    sectionCount: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 13
    },

    // Practice progress bar
    practiceProgressTrack: {
        height: 6,
        borderRadius: 3,
        overflow: "hidden"
    },
    practiceProgressFill: {
        height: "100%",
        borderRadius: 3
    },

    // Practice list
    practiceList: {
        gap: 8
    },
    practiceRow: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 12,
        borderWidth: 1,
        padding: 12,
        gap: 12
    },
    practiceIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center"
    },
    practiceLabel: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 15,
        flex: 1
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        alignItems: "center",
        justifyContent: "center"
    },

    // Vocab
    dueBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8
    },
    dueText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 12
    },
    vocabList: {
        gap: 10
    },
    vocabCard: {
        borderRadius: 12,
        padding: 14,
        gap: 10
    },
    vocabTopRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    vocabNative: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 18
    },
    vocabTranslation: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14
    },
    vocabRevealHint: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4
    },
    vocabRevealText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    vocabBottomRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10
    },
    vocabProgressTrack: {
        flex: 1,
        height: 6,
        borderRadius: 3,
        overflow: "hidden"
    },
    vocabProgressFill: {
        height: "100%",
        borderRadius: 3
    },
    vocabMasteryText: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 12,
        width: 36,
        textAlign: "right"
    },

    // Resources
    resourceList: {
        gap: 10
    },
    resourceCard: {
        flexDirection: "row",
        borderRadius: 14,
        borderWidth: 1,
        padding: 14,
        gap: 12,
        alignItems: "center"
    },
    resourceIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center"
    },
    resourceContent: {
        flex: 1,
        gap: 8
    },
    resourceTopRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 8
    },
    resourceName: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 14,
        flex: 1
    },
    resourceTypeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8
    },
    resourceTypeText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11,
        textTransform: "capitalize"
    },
    resourceProgressRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    resourceProgressTrack: {
        flex: 1,
        height: 6,
        borderRadius: 3,
        overflow: "hidden"
    },
    resourceProgressFill: {
        height: "100%",
        borderRadius: 3
    },
    resourceProgressText: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 12,
        width: 36,
        textAlign: "right"
    }
}));
