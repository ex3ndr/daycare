import { Ionicons } from "@expo/vector-icons";
import { ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

// --- Types ---

type Genre = "Fiction" | "Non-Fiction" | "Science" | "History" | "Biography" | "Self-Help";

type BookBase = {
    id: string;
    title: string;
    author: string;
    genre: Genre;
};

type CurrentlyReadingBook = BookBase & {
    status: "reading";
    progress: number; // 0-100
};

type WantToReadBook = BookBase & {
    status: "want";
};

type FinishedBook = BookBase & {
    status: "finished";
    rating: number; // 1-5
};

// --- Genre colors ---

const GENRE_COLORS: Record<Genre, string> = {
    Fiction: "#6366f1",
    "Non-Fiction": "#0891b2",
    Science: "#059669",
    History: "#d97706",
    Biography: "#dc2626",
    "Self-Help": "#7c3aed"
};

// --- Mock data ---

const currentlyReading: CurrentlyReadingBook[] = [
    { id: "1", title: "Project Hail Mary", author: "Andy Weir", genre: "Fiction", status: "reading", progress: 72 },
    {
        id: "2",
        title: "Thinking, Fast and Slow",
        author: "Daniel Kahneman",
        genre: "Non-Fiction",
        status: "reading",
        progress: 35
    },
    {
        id: "3",
        title: "The Gene: An Intimate History",
        author: "Siddhartha Mukherjee",
        genre: "Science",
        status: "reading",
        progress: 58
    }
];

const wantToRead: WantToReadBook[] = [
    { id: "4", title: "The Silk Roads", author: "Peter Frankopan", genre: "History", status: "want" },
    { id: "5", title: "Atomic Habits", author: "James Clear", genre: "Self-Help", status: "want" },
    { id: "6", title: "Leonardo da Vinci", author: "Walter Isaacson", genre: "Biography", status: "want" },
    { id: "7", title: "Klara and the Sun", author: "Kazuo Ishiguro", genre: "Fiction", status: "want" }
];

const finished: FinishedBook[] = [
    { id: "8", title: "Sapiens", author: "Yuval Noah Harari", genre: "History", status: "finished", rating: 5 },
    { id: "9", title: "Dune", author: "Frank Herbert", genre: "Fiction", status: "finished", rating: 5 },
    {
        id: "10",
        title: "The Immortal Life of Henrietta Lacks",
        author: "Rebecca Skloot",
        genre: "Biography",
        status: "finished",
        rating: 4
    },
    {
        id: "11",
        title: "A Brief History of Time",
        author: "Stephen Hawking",
        genre: "Science",
        status: "finished",
        rating: 4
    },
    {
        id: "12",
        title: "The Power of Habit",
        author: "Charles Duhigg",
        genre: "Self-Help",
        status: "finished",
        rating: 3
    }
];

const avgRating = (finished.reduce((sum, b) => sum + b.rating, 0) / finished.length).toFixed(1);

// --- Circular progress ring ---

function ProgressRing({ progress, size, color }: { progress: number; size: number; color: string }) {
    const strokeWidth = 3;

    return (
        <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
            {/* Background track */}
            <View
                style={{
                    position: "absolute",
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    borderWidth: strokeWidth,
                    borderColor: color + "25"
                }}
            />
            {/* Filled arc approximated with a dashed border trick */}
            <View
                style={{
                    position: "absolute",
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    borderWidth: strokeWidth,
                    borderColor: color,
                    borderTopColor: progress >= 25 ? color : "transparent",
                    borderRightColor: progress >= 50 ? color : "transparent",
                    borderBottomColor: progress >= 75 ? color : "transparent",
                    borderLeftColor: progress < 100 ? "transparent" : color,
                    transform: [{ rotate: "-90deg" }]
                }}
            />
            <Text style={{ fontFamily: "IBMPlexSans-SemiBold", fontSize: size * 0.24, color }}>{progress}%</Text>
        </View>
    );
}

// --- Book cover placeholder ---

function BookCover({ title, genre, width, height }: { title: string; genre: Genre; width: number; height: number }) {
    const color = GENRE_COLORS[genre];
    return (
        <View
            style={{
                width,
                height,
                backgroundColor: color,
                borderRadius: 8,
                alignItems: "center",
                justifyContent: "center",
                // Subtle gradient-like effect with inner shadow
                shadowColor: "#000",
                shadowOffset: { width: 2, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 4,
                elevation: 3
            }}
        >
            <Text
                style={{
                    fontFamily: "IBMPlexSans-SemiBold",
                    fontSize: Math.min(width, height) * 0.4,
                    color: "#ffffffcc"
                }}
            >
                {title.charAt(0).toUpperCase()}
            </Text>
        </View>
    );
}

// --- Genre chip ---

function GenreChip({ genre }: { genre: Genre }) {
    const color = GENRE_COLORS[genre];
    return (
        <View style={{ backgroundColor: color + "18", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
            <Text style={{ fontFamily: "IBMPlexSans-Regular", fontSize: 11, color }}>{genre}</Text>
        </View>
    );
}

// --- Rating dots ---

function RatingDots({ rating, color }: { rating: number; color: string }) {
    return (
        <View style={{ flexDirection: "row", gap: 4 }}>
            {[1, 2, 3, 4, 5].map((i) => (
                <View
                    key={i}
                    style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: i <= rating ? color : color + "30"
                    }}
                />
            ))}
        </View>
    );
}

// --- Section header ---

function SectionHeader({ title, icon }: { title: string; icon: keyof typeof Ionicons.glyphMap }) {
    const { theme } = useUnistyles();
    return (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Ionicons name={icon} size={20} color={theme.colors.onSurface} />
            <Text
                style={{
                    fontFamily: "IBMPlexSans-SemiBold",
                    fontSize: 18,
                    color: theme.colors.onSurface
                }}
            >
                {title}
            </Text>
        </View>
    );
}

// --- Main component ---

export function ReadingListPage() {
    const { theme } = useUnistyles();

    return (
        <ScrollView
            contentContainerStyle={{
                maxWidth: theme.layout.maxWidth,
                width: "100%",
                alignSelf: "center",
                paddingHorizontal: 16,
                paddingVertical: 20,
                gap: 28
            }}
        >
            {/* Top metrics row */}
            <View style={s.metricsRow}>
                <View style={s.metricCard(theme.colors.surfaceContainer, theme.colors.primary)}>
                    <Ionicons name="book" size={22} color={theme.colors.primary} />
                    <Text style={s.metricValue(theme.colors.primary)}>{finished.length}</Text>
                    <Text style={s.metricLabel(theme.colors.onSurfaceVariant)}>Read</Text>
                </View>
                <View style={s.metricCard(theme.colors.surfaceContainer, theme.colors.tertiary)}>
                    <Ionicons name="glasses" size={22} color={theme.colors.tertiary} />
                    <Text style={s.metricValue(theme.colors.tertiary)}>{currentlyReading.length}</Text>
                    <Text style={s.metricLabel(theme.colors.onSurfaceVariant)}>Reading</Text>
                </View>
                <View style={s.metricCard(theme.colors.surfaceContainer, "#f59e0b")}>
                    <Ionicons name="star" size={22} color="#f59e0b" />
                    <Text style={s.metricValue("#f59e0b")}>{avgRating} ★</Text>
                    <Text style={s.metricLabel(theme.colors.onSurfaceVariant)}>Avg</Text>
                </View>
            </View>

            {/* Currently Reading */}
            <View>
                <SectionHeader title="Currently Reading" icon="glasses-outline" />
                <View style={{ gap: 12 }}>
                    {currentlyReading.map((book) => {
                        const genreColor = GENRE_COLORS[book.genre];
                        return (
                            <View key={book.id} style={s.readingCard(theme.colors.surfaceContainer)}>
                                <BookCover title={book.title} genre={book.genre} width={72} height={100} />
                                <View style={s.readingCardRight}>
                                    <Text style={s.bookTitle(theme.colors.onSurface)} numberOfLines={2}>
                                        {book.title}
                                    </Text>
                                    <Text style={s.bookAuthor(theme.colors.onSurfaceVariant)}>{book.author}</Text>
                                    <GenreChip genre={book.genre} />
                                </View>
                                <View style={s.progressRingContainer}>
                                    <ProgressRing progress={book.progress} size={56} color={genreColor} />
                                </View>
                            </View>
                        );
                    })}
                </View>
            </View>

            {/* Want to Read - horizontal book spines */}
            <View>
                <SectionHeader title="Want to Read" icon="bookmark-outline" />
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 12, paddingVertical: 4 }}
                >
                    {wantToRead.map((book) => {
                        const genreColor = GENRE_COLORS[book.genre];
                        return (
                            <View key={book.id} style={s.spineCard(genreColor)}>
                                <Text style={s.spineTitle} numberOfLines={2}>
                                    {book.title}
                                </Text>
                                <View style={s.spineDivider} />
                                <Text style={s.spineAuthor} numberOfLines={1}>
                                    {book.author}
                                </Text>
                            </View>
                        );
                    })}
                </ScrollView>
            </View>

            {/* Finished */}
            <View>
                <SectionHeader title="Finished" icon="checkmark-circle" />
                <View style={{ gap: 10 }}>
                    {finished.map((book) => (
                        <View key={book.id} style={s.finishedCard(theme.colors.surfaceContainer)}>
                            <BookCover title={book.title} genre={book.genre} width={48} height={68} />
                            <View style={s.finishedCardContent}>
                                <Text style={s.finishedTitle(theme.colors.onSurface)} numberOfLines={1}>
                                    {book.title}
                                </Text>
                                <Text style={s.bookAuthor(theme.colors.onSurfaceVariant)}>{book.author}</Text>
                                <RatingDots rating={book.rating} color="#f59e0b" />
                            </View>
                            <View style={s.finishedBadge}>
                                <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary + "80"} />
                            </View>
                        </View>
                    ))}
                </View>
            </View>
        </ScrollView>
    );
}

// --- Styles ---

const s = StyleSheet.create((theme) => ({
    metricsRow: {
        flexDirection: "row",
        gap: 10
    },
    metricCard: (bg: string, accent: string) => ({
        flex: 1,
        backgroundColor: bg,
        borderRadius: 14,
        paddingVertical: 16,
        paddingHorizontal: 12,
        alignItems: "center" as const,
        gap: 4,
        borderWidth: 1,
        borderColor: accent + "20"
    }),
    metricValue: (color: string) => ({
        fontFamily: "IBMPlexSans-SemiBold" as const,
        fontSize: 22,
        color
    }),
    metricLabel: (color: string) => ({
        fontFamily: "IBMPlexSans-Regular" as const,
        fontSize: 12,
        color
    }),
    readingCard: (bg: string) => ({
        flexDirection: "row" as const,
        backgroundColor: bg,
        borderRadius: 14,
        padding: 14,
        gap: 14,
        alignItems: "center" as const
    }),
    readingCardRight: {
        flex: 1,
        gap: 4
    },
    bookTitle: (color: string) => ({
        fontFamily: "IBMPlexSans-SemiBold" as const,
        fontSize: 15,
        color
    }),
    bookAuthor: (color: string) => ({
        fontFamily: "IBMPlexSans-Regular" as const,
        fontSize: 13,
        color
    }),
    progressRingContainer: {
        alignItems: "center" as const,
        justifyContent: "center" as const
    },
    spineCard: (color: string) => ({
        width: 80,
        height: 160,
        backgroundColor: color,
        borderRadius: 8,
        paddingVertical: 14,
        paddingHorizontal: 8,
        justifyContent: "space-between" as const,
        alignItems: "center" as const,
        // Book spine shadow
        shadowColor: "#000",
        shadowOffset: { width: 2, height: 3 },
        shadowOpacity: 0.18,
        shadowRadius: 4,
        elevation: 4
    }),
    spineTitle: {
        fontFamily: "IBMPlexSans-SemiBold" as const,
        fontSize: 12,
        color: "#ffffffee",
        textAlign: "center" as const,
        writingDirection: "ltr" as const
    },
    spineDivider: {
        width: 20,
        height: 1,
        backgroundColor: "#ffffff50"
    },
    spineAuthor: {
        fontFamily: "IBMPlexSans-Regular" as const,
        fontSize: 10,
        color: "#ffffffaa",
        textAlign: "center" as const
    },
    finishedCard: (bg: string) => ({
        flexDirection: "row" as const,
        backgroundColor: bg,
        borderRadius: 14,
        padding: 12,
        gap: 12,
        alignItems: "center" as const,
        opacity: 0.85
    }),
    finishedCardContent: {
        flex: 1,
        gap: 4
    },
    finishedTitle: (color: string) => ({
        fontFamily: "IBMPlexSans-Regular" as const,
        fontSize: 14,
        color
    }),
    finishedBadge: {
        alignItems: "center" as const,
        justifyContent: "center" as const
    }
}));
