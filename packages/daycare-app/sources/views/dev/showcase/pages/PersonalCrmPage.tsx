import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Card } from "@/components/Card";
import { ShowcasePage } from "@/views/dev/showcase/components/ShowcasePage";

type ContactCategory = "All" | "Clients" | "Partners" | "Personal";
type RelationshipStrength = "strong" | "warm" | "cold";

interface Contact {
    name: string;
    company: string;
    lastContacted: string;
    daysAgo: number;
    category: Exclude<ContactCategory, "All">;
    strength: RelationshipStrength;
}

const CONTACTS: Contact[] = [
    {
        name: "Alice Chen",
        company: "Stripe",
        lastContacted: "2 days ago",
        daysAgo: 2,
        category: "Clients",
        strength: "strong"
    },
    {
        name: "Amara Okafor",
        company: "Notion",
        lastContacted: "7 days ago",
        daysAgo: 7,
        category: "Partners",
        strength: "warm"
    },
    {
        name: "Ben Torres",
        company: "Vercel",
        lastContacted: "3 days ago",
        daysAgo: 3,
        category: "Clients",
        strength: "strong"
    },
    {
        name: "Clara Kim",
        company: "Linear",
        lastContacted: "14 days ago",
        daysAgo: 14,
        category: "Partners",
        strength: "cold"
    },
    {
        name: "David Russo",
        company: "Figma",
        lastContacted: "5 days ago",
        daysAgo: 5,
        category: "Personal",
        strength: "warm"
    },
    {
        name: "Elena Vasquez",
        company: "Supabase",
        lastContacted: "1 day ago",
        daysAgo: 1,
        category: "Clients",
        strength: "strong"
    },
    {
        name: "Felix Nguyen",
        company: "Replit",
        lastContacted: "21 days ago",
        daysAgo: 21,
        category: "Personal",
        strength: "cold"
    },
    {
        name: "Grace Halloway",
        company: "Anthropic",
        lastContacted: "4 days ago",
        daysAgo: 4,
        category: "Partners",
        strength: "strong"
    },
    {
        name: "Hugo Lindqvist",
        company: "Spotify",
        lastContacted: "7 days ago",
        daysAgo: 7,
        category: "Personal",
        strength: "warm"
    },
    {
        name: "Isabel Moreno",
        company: "Plaid",
        lastContacted: "6 days ago",
        daysAgo: 6,
        category: "Clients",
        strength: "warm"
    },
    {
        name: "Jake Patel",
        company: "Loom",
        lastContacted: "14 days ago",
        daysAgo: 14,
        category: "Partners",
        strength: "cold"
    },
    {
        name: "Kenji Yamamoto",
        company: "Arc",
        lastContacted: "3 days ago",
        daysAgo: 3,
        category: "Clients",
        strength: "strong"
    },
    {
        name: "Lina Schmidt",
        company: "Datadog",
        lastContacted: "7 days ago",
        daysAgo: 7,
        category: "Partners",
        strength: "warm"
    },
    {
        name: "Marcus Bennett",
        company: "Retool",
        lastContacted: "28 days ago",
        daysAgo: 28,
        category: "Personal",
        strength: "cold"
    },
    {
        name: "Nina Johansson",
        company: "Klarna",
        lastContacted: "2 days ago",
        daysAgo: 2,
        category: "Clients",
        strength: "strong"
    }
];

const CATEGORIES: ContactCategory[] = ["All", "Clients", "Partners", "Personal"];

/** Extracts uppercase initials from a full name. */
function getInitials(name: string): string {
    return name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .toUpperCase();
}

/** Assigns a deterministic color based on contact category. */
function getCategoryColor(category: Exclude<ContactCategory, "All">): string {
    switch (category) {
        case "Clients":
            return "#6366f1";
        case "Partners":
            return "#0ea5e9";
        case "Personal":
            return "#ec4899";
    }
}

/** Returns the fill ratio for the relationship thermometer (0 to 1). */
function getThermometerFill(strength: RelationshipStrength): number {
    switch (strength) {
        case "strong":
            return 1.0;
        case "warm":
            return 0.5;
        case "cold":
            return 0.25;
    }
}

/** Returns the color for the relationship thermometer fill. */
function getThermometerColor(strength: RelationshipStrength): string {
    switch (strength) {
        case "strong":
            return "#22c55e";
        case "warm":
            return "#f59e0b";
        case "cold":
            return "#9ca3af";
    }
}

/** Groups contacts alphabetically by the first letter of their name. */
function groupAlphabetically(contacts: Contact[]): Map<string, Contact[]> {
    const groups = new Map<string, Contact[]>();
    for (const contact of contacts) {
        const letter = contact.name[0].toUpperCase();
        const existing = groups.get(letter);
        if (existing) {
            existing.push(contact);
        } else {
            groups.set(letter, [contact]);
        }
    }
    return new Map([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

/** Relationship thermometer: a vertical bar filled proportionally from the bottom. */
function Thermometer({ strength }: { strength: RelationshipStrength }) {
    const fill = getThermometerFill(strength);
    const color = getThermometerColor(strength);

    return (
        <View style={styles.thermometerTrack}>
            <View
                style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 32 * fill,
                    backgroundColor: color,
                    borderRadius: 2
                }}
            />
        </View>
    );
}

/** Large initials avatar circle. */
function Avatar({ name, category }: { name: string; category: Exclude<ContactCategory, "All"> }) {
    const color = getCategoryColor(category);
    return (
        <View style={[styles.avatar, { backgroundColor: `${color}18` }]}>
            <Text style={[styles.avatarText, { color }]}>{getInitials(name)}</Text>
        </View>
    );
}

/** A single contact card row. */
function ContactCard({ contact }: { contact: Contact }) {
    return (
        <Card style={styles.card}>
            <Avatar name={contact.name} category={contact.category} />
            <View style={styles.cardCenter}>
                <Text style={styles.cardName} numberOfLines={1}>
                    {contact.name}
                </Text>
                <Text style={styles.cardCompany} numberOfLines={1}>
                    {contact.company}
                </Text>
                <Text style={styles.cardLastContacted} numberOfLines={1}>
                    Last contacted: {contact.lastContacted}
                </Text>
            </View>
            <Thermometer strength={contact.strength} />
        </Card>
    );
}

/** Section divider with a large translucent letter in the background. */
function LetterDivider({ letter }: { letter: string }) {
    return (
        <View style={styles.dividerContainer}>
            <Text style={styles.dividerLetter}>{letter}</Text>
            <View style={styles.dividerLine} />
        </View>
    );
}

/** Filter pill button. */
function FilterPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
    const { theme } = useUnistyles();

    return (
        <Pressable
            onPress={onPress}
            style={[
                styles.pillBase,
                { backgroundColor: active ? theme.colors.primary : theme.colors.surfaceContainer }
            ]}
        >
            <Text style={[styles.pillTextBase, { color: active ? "#ffffff" : theme.colors.onSurfaceVariant }]}>
                {label}
            </Text>
        </Pressable>
    );
}

export function PersonalCrmPage() {
    const { theme } = useUnistyles();
    const [search, setSearch] = React.useState("");
    const [activeCategory, setActiveCategory] = React.useState<ContactCategory>("All");

    const filtered = React.useMemo(() => {
        return CONTACTS.filter((c) => {
            const matchesCategory = activeCategory === "All" || c.category === activeCategory;
            const matchesSearch =
                search.length === 0 ||
                c.name.toLowerCase().includes(search.toLowerCase()) ||
                c.company.toLowerCase().includes(search.toLowerCase());
            return matchesCategory && matchesSearch;
        });
    }, [search, activeCategory]);

    const grouped = React.useMemo(() => groupAlphabetically(filtered), [filtered]);

    // Compute summary metrics from filtered contacts
    const totalContacts = filtered.length;
    const needFollowUp = filtered.filter((c) => c.daysAgo >= 7).length;
    const strongRelationships = filtered.filter((c) => c.strength === "strong").length;

    return (
        <View style={styles.root}>
            <ShowcasePage edgeToEdge bottomInset={24}>
                {/* Search bar + filter pills */}
                <View style={styles.searchRow}>
                    <Ionicons name="search" size={18} color={theme.colors.onSurfaceVariant} style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search contacts..."
                        placeholderTextColor={theme.colors.onSurfaceVariant}
                        value={search}
                        onChangeText={setSearch}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                    {CATEGORIES.map((cat) => (
                        <FilterPill
                            key={cat}
                            label={cat}
                            active={cat === activeCategory}
                            onPress={() => setActiveCategory(cat)}
                        />
                    ))}
                </ScrollView>

                {/* Summary metrics bar */}
                <View style={styles.metricsBar}>
                    <View style={styles.metric}>
                        <Text style={[styles.metricValueBase, { color: theme.colors.onSurface }]}>{totalContacts}</Text>
                        <Text style={styles.metricLabel}>Contacts</Text>
                    </View>
                    <View style={styles.metricDivider} />
                    <View style={styles.metric}>
                        <Text style={[styles.metricValueBase, { color: "#f59e0b" }]}>{needFollowUp}</Text>
                        <Text style={styles.metricLabel}>Need Follow-up</Text>
                    </View>
                    <View style={styles.metricDivider} />
                    <View style={styles.metric}>
                        <Text style={[styles.metricValueBase, { color: "#22c55e" }]}>{strongRelationships}</Text>
                        <Text style={styles.metricLabel}>Strong</Text>
                    </View>
                </View>

                {/* Contact cards grouped by letter */}
                {[...grouped.entries()].map(([letter, contacts]) => (
                    <View key={letter}>
                        <LetterDivider letter={letter} />
                        {contacts.map((contact) => (
                            <ContactCard key={contact.name} contact={contact} />
                        ))}
                    </View>
                ))}

                {/* Empty state */}
                {filtered.length === 0 && (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="people-outline" size={48} color={theme.colors.onSurfaceVariant} />
                        <Text style={styles.emptyText}>No contacts found</Text>
                    </View>
                )}

                {/* Bottom spacer for FAB */}
                <View style={{ height: 80 }} />
            </ShowcasePage>

            {/* Floating Add Contact button */}
            <Pressable style={styles.fab}>
                <Ionicons name="add" size={28} color="#ffffff" />
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create((theme) => ({
    root: {
        flex: 1
    },
    searchRow: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        backgroundColor: theme.colors.surfaceContainerHighest,
        borderRadius: 12,
        marginHorizontal: 16,
        marginTop: 16,
        paddingHorizontal: 12,
        paddingVertical: 8
    },
    searchIcon: {
        marginRight: 8
    },
    searchInput: {
        flex: 1,
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 16,
        lineHeight: 22,
        color: theme.colors.onSurface,
        padding: 0
    },
    pillRow: {
        flexDirection: "row" as const,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 4,
        gap: 8
    },
    pillBase: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20
    },
    pillTextBase: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13
    },
    metricsBar: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "space-around" as const,
        marginHorizontal: 16,
        marginTop: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: theme.colors.surfaceContainer,
        borderRadius: 12
    },
    metric: {
        alignItems: "center" as const,
        flex: 1
    },
    metricValueBase: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 20
    },
    metricLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11,
        color: theme.colors.onSurfaceVariant,
        marginTop: 2
    },
    metricDivider: {
        width: 1,
        height: 28,
        backgroundColor: theme.colors.outlineVariant
    },
    dividerContainer: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        marginHorizontal: 16,
        marginTop: 20,
        marginBottom: 4,
        height: 36,
        overflow: "hidden" as const
    },
    dividerLetter: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 32,
        color: theme.colors.onSurface,
        opacity: 0.08,
        position: "absolute" as const,
        left: 0,
        top: -4
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: theme.colors.outlineVariant,
        marginLeft: 32,
        opacity: 0.5
    },
    card: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        backgroundColor: theme.colors.surface,
        marginHorizontal: 16,
        marginTop: 8,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.colors.outlineVariant
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center" as const,
        justifyContent: "center" as const
    },
    avatarText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 14
    },
    cardCenter: {
        flex: 1,
        marginLeft: 12,
        marginRight: 12
    },
    cardName: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15,
        color: theme.colors.onSurface
    },
    cardCompany: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        color: theme.colors.onSurfaceVariant,
        marginTop: 1
    },
    cardLastContacted: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11,
        color: theme.colors.tertiary,
        marginTop: 3
    },
    thermometerTrack: {
        width: 4,
        height: 32,
        borderRadius: 2,
        backgroundColor: theme.colors.surfaceContainerHighest,
        overflow: "hidden" as const
    },
    emptyContainer: {
        paddingVertical: 64,
        alignItems: "center" as const,
        gap: 12
    },
    emptyText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 15,
        color: theme.colors.onSurfaceVariant
    },
    fab: {
        position: "absolute" as const,
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: theme.colors.primary,
        alignItems: "center" as const,
        justifyContent: "center" as const,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6
    }
}));
