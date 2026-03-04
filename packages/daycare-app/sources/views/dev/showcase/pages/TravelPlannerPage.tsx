import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { ShowcasePage } from "../components/ShowcasePage";

// --- Types ---

type Category = "flight" | "hotel" | "restaurant" | "activity" | "transport";
type ConfirmationStatus = "confirmed" | "pending" | "cancelled";

type ItineraryItem = {
    id: string;
    day: number;
    time: string;
    name: string;
    location: string;
    category: Category;
    status: ConfirmationStatus;
    bookingRef: string;
    notes?: string;
};

type PackingItem = {
    id: string;
    name: string;
    category: string;
    packed: boolean;
};

// --- Constants ---

const CATEGORY_CONFIG: Record<Category, { color: string; icon: keyof typeof Ionicons.glyphMap; label: string }> = {
    flight: { color: "#3B82F6", icon: "airplane-outline", label: "Flight" },
    hotel: { color: "#8B5CF6", icon: "bed-outline", label: "Hotel" },
    restaurant: { color: "#F59E0B", icon: "restaurant-outline", label: "Restaurant" },
    activity: { color: "#10B981", icon: "compass-outline", label: "Activity" },
    transport: { color: "#EF4444", icon: "car-outline", label: "Transport" }
};

const STATUS_CONFIG: Record<ConfirmationStatus, { color: string; icon: keyof typeof Ionicons.glyphMap }> = {
    confirmed: { color: "#10B981", icon: "checkmark-circle" },
    pending: { color: "#F59E0B", icon: "time" },
    cancelled: { color: "#EF4444", icon: "close-circle" }
};

// --- Mock data ---

const DESTINATION = "Tokyo, Japan";
const START_DATE = "Mar 15, 2026";
const END_DATE = "Mar 22, 2026";
const DAYS_UNTIL = 12;
const TOTAL_DAYS = 7;

const itineraryItems: ItineraryItem[] = [
    // Day 1
    {
        id: "1",
        day: 1,
        time: "06:30",
        name: "Flight to Tokyo",
        location: "SFO -> NRT",
        category: "flight",
        status: "confirmed",
        bookingRef: "JAL-7742-X",
        notes: "Terminal 1, Gate 42. Meal included."
    },
    {
        id: "2",
        day: 1,
        time: "15:00",
        name: "Airport Limousine Bus",
        location: "Narita Airport -> Shinjuku",
        category: "transport",
        status: "confirmed",
        bookingRef: "LMB-001892"
    },
    {
        id: "3",
        day: 1,
        time: "17:00",
        name: "Park Hyatt Tokyo",
        location: "Shinjuku, Nishi-Shinjuku",
        category: "hotel",
        status: "confirmed",
        bookingRef: "PHT-20260315-KN",
        notes: "Check-in from 15:00. Room 4702."
    },
    {
        id: "4",
        day: 1,
        time: "19:30",
        name: "Omoide Yokocho",
        location: "Shinjuku Memory Lane",
        category: "restaurant",
        status: "confirmed",
        bookingRef: "WALK-IN"
    },
    // Day 2
    {
        id: "5",
        day: 2,
        time: "09:00",
        name: "Senso-ji Temple Visit",
        location: "Asakusa, Taito",
        category: "activity",
        status: "confirmed",
        bookingRef: "FREE-ENTRY"
    },
    {
        id: "6",
        day: 2,
        time: "12:30",
        name: "Ichiran Ramen",
        location: "Asakusa Branch",
        category: "restaurant",
        status: "confirmed",
        bookingRef: "WALK-IN"
    },
    {
        id: "7",
        day: 2,
        time: "15:00",
        name: "TeamLab Borderless",
        location: "Azabudai Hills, Minato",
        category: "activity",
        status: "pending",
        bookingRef: "TLB-88421",
        notes: "Digital art museum. Allow 2-3 hours."
    },
    {
        id: "8",
        day: 2,
        time: "19:00",
        name: "Sushi Saito",
        location: "Roppongi, Minato",
        category: "restaurant",
        status: "confirmed",
        bookingRef: "SSR-0315-2P"
    },
    // Day 3
    {
        id: "9",
        day: 3,
        time: "07:30",
        name: "Tsukiji Outer Market",
        location: "Tsukiji, Chuo",
        category: "activity",
        status: "confirmed",
        bookingRef: "FREE-ENTRY"
    },
    {
        id: "10",
        day: 3,
        time: "10:00",
        name: "Shinkansen to Hakone",
        location: "Tokyo Station -> Odawara",
        category: "transport",
        status: "pending",
        bookingRef: "JR-PASS-GRN",
        notes: "JR Pass covers fare. Reserve seats at station."
    },
    {
        id: "11",
        day: 3,
        time: "13:00",
        name: "Hakone Open-Air Museum",
        location: "Ninotaira, Hakone",
        category: "activity",
        status: "confirmed",
        bookingRef: "HOAM-2P-0317"
    },
    {
        id: "12",
        day: 3,
        time: "17:00",
        name: "Ryokan Onsen Stay",
        location: "Gora, Hakone",
        category: "hotel",
        status: "cancelled",
        bookingRef: "RYO-GORA-517",
        notes: "Cancelled - rebooking in progress."
    }
];

const initialPackingItems: PackingItem[] = [
    { id: "p1", name: "Passport & Visa docs", category: "Essentials", packed: true },
    { id: "p2", name: "Travel insurance printout", category: "Essentials", packed: true },
    { id: "p3", name: "JR Pass voucher", category: "Essentials", packed: false },
    { id: "p4", name: "Yen cash (50,000)", category: "Essentials", packed: false },
    { id: "p5", name: "Universal adapter", category: "Electronics", packed: true },
    { id: "p6", name: "Portable charger", category: "Electronics", packed: false },
    { id: "p7", name: "Camera + lenses", category: "Electronics", packed: false },
    { id: "p8", name: "Noise-cancelling headphones", category: "Electronics", packed: true },
    { id: "p9", name: "Rain jacket", category: "Clothing", packed: false },
    { id: "p10", name: "Comfortable walking shoes", category: "Clothing", packed: true },
    { id: "p11", name: "Light layers (5 sets)", category: "Clothing", packed: false },
    { id: "p12", name: "Sunscreen SPF50", category: "Toiletries", packed: false },
    { id: "p13", name: "Medications", category: "Toiletries", packed: true },
    { id: "p14", name: "Pocket Wi-Fi reservation", category: "Tech", packed: false }
];

// --- Helper ---

function groupByDay(items: ItineraryItem[]): Map<number, ItineraryItem[]> {
    const map = new Map<number, ItineraryItem[]>();
    for (const item of items) {
        const existing = map.get(item.day) ?? [];
        existing.push(item);
        map.set(item.day, existing);
    }
    return map;
}

function groupPackingByCategory(items: PackingItem[]): Map<string, PackingItem[]> {
    const map = new Map<string, PackingItem[]>();
    for (const item of items) {
        const existing = map.get(item.category) ?? [];
        existing.push(item);
        map.set(item.category, existing);
    }
    return map;
}

// --- Category Chip ---

function CategoryChip({ category }: { category: Category }) {
    const config = CATEGORY_CONFIG[category];
    return (
        <View style={[chipStyles.container, { backgroundColor: `${config.color}18` }]}>
            <Ionicons name={config.icon} size={12} color={config.color} />
            <Text style={[chipStyles.label, { color: config.color }]}>{config.label}</Text>
        </View>
    );
}

const chipStyles = StyleSheet.create((theme) => ({
    container: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10
    },
    label: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11
    }
}));

// --- Status Badge ---

function StatusBadge({ status }: { status: ConfirmationStatus }) {
    const config = STATUS_CONFIG[status];
    return (
        <View style={[badgeStyles.container, { backgroundColor: `${config.color}14` }]}>
            <Ionicons name={config.icon} size={13} color={config.color} />
            <Text style={[badgeStyles.label, { color: config.color }]}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
        </View>
    );
}

const badgeStyles = StyleSheet.create((theme) => ({
    container: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10
    },
    label: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11
    }
}));

// --- Itinerary Card ---

function ItineraryCard({
    item,
    isExpanded,
    onToggle
}: {
    item: ItineraryItem;
    isExpanded: boolean;
    onToggle: () => void;
}) {
    const { theme } = useUnistyles();
    const catConfig = CATEGORY_CONFIG[item.category];

    return (
        <Pressable
            onPress={onToggle}
            style={({ pressed }) => [
                itinStyles.card,
                {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.outlineVariant,
                    opacity: pressed ? 0.85 : 1
                }
            ]}
        >
            {/* Left accent bar */}
            <View style={[itinStyles.accentBar, { backgroundColor: catConfig.color }]} />

            <View style={itinStyles.cardBody}>
                {/* Time column */}
                <View style={itinStyles.timeCol}>
                    <Text style={[itinStyles.time, { color: theme.colors.primary }]}>{item.time}</Text>
                    <View style={[itinStyles.timeDot, { backgroundColor: catConfig.color }]} />
                </View>

                {/* Content column */}
                <View style={itinStyles.contentCol}>
                    <View style={itinStyles.titleRow}>
                        <Text style={[itinStyles.name, { color: theme.colors.onSurface }]} numberOfLines={1}>
                            {item.name}
                        </Text>
                        <Ionicons
                            name={isExpanded ? "chevron-up" : "chevron-down"}
                            size={16}
                            color={theme.colors.onSurfaceVariant}
                        />
                    </View>

                    <View style={itinStyles.locationRow}>
                        <Ionicons name="location-outline" size={13} color={theme.colors.onSurfaceVariant} />
                        <Text style={[itinStyles.location, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
                            {item.location}
                        </Text>
                    </View>

                    <View style={itinStyles.tagsRow}>
                        <CategoryChip category={item.category} />
                        <StatusBadge status={item.status} />
                    </View>

                    {/* Expanded details */}
                    {isExpanded && (
                        <View style={[itinStyles.expandedSection, { borderColor: theme.colors.outlineVariant }]}>
                            <View style={itinStyles.refRow}>
                                <Ionicons
                                    name="document-text-outline"
                                    size={13}
                                    color={theme.colors.onSurfaceVariant}
                                />
                                <Text style={[itinStyles.refLabel, { color: theme.colors.onSurfaceVariant }]}>
                                    Booking Ref:
                                </Text>
                                <Text style={[itinStyles.refValue, { color: theme.colors.onSurface }]}>
                                    {item.bookingRef}
                                </Text>
                            </View>
                            {item.notes && (
                                <View style={itinStyles.notesRow}>
                                    <Ionicons
                                        name="information-circle-outline"
                                        size={13}
                                        color={theme.colors.onSurfaceVariant}
                                    />
                                    <Text style={[itinStyles.notesText, { color: theme.colors.onSurfaceVariant }]}>
                                        {item.notes}
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}
                </View>
            </View>
        </Pressable>
    );
}

const itinStyles = StyleSheet.create((theme) => ({
    card: {
        borderRadius: 12,
        borderWidth: 1,
        overflow: "hidden",
        marginBottom: 10,
        flexDirection: "row"
    },
    accentBar: {
        width: 4
    },
    cardBody: {
        flex: 1,
        flexDirection: "row",
        padding: 12,
        gap: 12
    },
    timeCol: {
        alignItems: "center",
        width: 48,
        gap: 6
    },
    time: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 13
    },
    timeDot: {
        width: 8,
        height: 8,
        borderRadius: 4
    },
    contentCol: {
        flex: 1,
        gap: 6
    },
    titleRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8
    },
    name: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15,
        flex: 1
    },
    locationRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4
    },
    location: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        flex: 1
    },
    tagsRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginTop: 2
    },
    expandedSection: {
        borderTopWidth: 1,
        marginTop: 8,
        paddingTop: 8,
        gap: 6
    },
    refRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6
    },
    refLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    refValue: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 12
    },
    notesRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 6
    },
    notesText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        lineHeight: 17,
        flex: 1
    }
}));

// --- Day Divider ---

function DayDivider({ day, itemCount }: { day: number; itemCount: number }) {
    const { theme } = useUnistyles();
    const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const dayLabel = dayLabels[(day - 1) % 7];

    return (
        <View style={dividerStyles.container}>
            <View style={[dividerStyles.circle, { backgroundColor: theme.colors.primary }]}>
                <Text style={[dividerStyles.dayNum, { color: theme.colors.onPrimary }]}>{day}</Text>
            </View>
            <View style={dividerStyles.textCol}>
                <Text style={[dividerStyles.dayTitle, { color: theme.colors.onSurface }]}>Day {day}</Text>
                <Text style={[dividerStyles.dayMeta, { color: theme.colors.onSurfaceVariant }]}>
                    {dayLabel} - {itemCount} {itemCount === 1 ? "item" : "items"}
                </Text>
            </View>
            <View style={[dividerStyles.line, { backgroundColor: theme.colors.outlineVariant }]} />
        </View>
    );
}

const dividerStyles = StyleSheet.create((theme) => ({
    container: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginTop: 20,
        marginBottom: 12
    },
    circle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center"
    },
    dayNum: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 16
    },
    textCol: {
        gap: 1
    },
    dayTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15
    },
    dayMeta: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    line: {
        flex: 1,
        height: 1
    }
}));

// --- Packing Checkbox ---

function PackingCheckbox({ item, onToggle }: { item: PackingItem; onToggle: () => void }) {
    const { theme } = useUnistyles();

    return (
        <Pressable onPress={onToggle} style={({ pressed }) => [packStyles.row, { opacity: pressed ? 0.7 : 1 }]}>
            <View
                style={[
                    packStyles.checkbox,
                    {
                        backgroundColor: item.packed ? theme.colors.primary : "transparent",
                        borderColor: item.packed ? theme.colors.primary : theme.colors.outline
                    }
                ]}
            >
                {item.packed && <Ionicons name="checkmark" size={14} color={theme.colors.onPrimary} />}
            </View>
            <Text
                style={[
                    packStyles.itemName,
                    {
                        color: item.packed ? theme.colors.onSurfaceVariant : theme.colors.onSurface,
                        textDecorationLine: item.packed ? "line-through" : "none"
                    }
                ]}
            >
                {item.name}
            </Text>
        </Pressable>
    );
}

const packStyles = StyleSheet.create((theme) => ({
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 6
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        alignItems: "center",
        justifyContent: "center"
    },
    itemName: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14,
        flex: 1
    }
}));

// --- Main Component ---

export function TravelPlannerPage() {
    const { theme } = useUnistyles();
    const [expandedItems, setExpandedItems] = React.useState<Set<string>>(new Set());
    const [packingItems, setPackingItems] = React.useState(initialPackingItems);

    const toggleExpand = React.useCallback((id: string) => {
        setExpandedItems((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    const togglePacked = React.useCallback((id: string) => {
        setPackingItems((prev) => prev.map((p) => (p.id === id ? { ...p, packed: !p.packed } : p)));
    }, []);

    const dayGroups = React.useMemo(() => groupByDay(itineraryItems), []);
    const packingGroups = React.useMemo(() => groupPackingByCategory(packingItems), [packingItems]);
    const packedCount = packingItems.filter((p) => p.packed).length;
    const totalPacking = packingItems.length;

    // Count statuses
    const confirmedCount = itineraryItems.filter((i) => i.status === "confirmed").length;
    const pendingCount = itineraryItems.filter((i) => i.status === "pending").length;

    return (
        <ShowcasePage contentContainerStyle={{ paddingBottom: 48 }}>
            {/* --- Hero Header Card --- */}
            <View style={[styles.heroCard, { backgroundColor: theme.colors.primary }]}>
                {/* Decorative travel icon */}
                <View style={styles.heroIconRow}>
                    <Ionicons name="airplane" size={28} color={theme.colors.onPrimary} />
                </View>

                <Text style={[styles.heroDestination, { color: theme.colors.onPrimary }]}>{DESTINATION}</Text>

                <View style={styles.heroDatesRow}>
                    <Ionicons name="calendar-outline" size={14} color={`${theme.colors.onPrimary}CC`} />
                    <Text style={[styles.heroDates, { color: `${theme.colors.onPrimary}CC` }]}>
                        {START_DATE} - {END_DATE}
                    </Text>
                </View>

                {/* Countdown & stats row */}
                <View style={styles.heroStatsRow}>
                    <View style={[styles.heroStatBox, { backgroundColor: `${theme.colors.onPrimary}20` }]}>
                        <Text style={[styles.heroStatNumber, { color: theme.colors.onPrimary }]}>{DAYS_UNTIL}</Text>
                        <Text style={[styles.heroStatLabel, { color: `${theme.colors.onPrimary}BB` }]}>Days Away</Text>
                    </View>
                    <View style={[styles.heroStatBox, { backgroundColor: `${theme.colors.onPrimary}20` }]}>
                        <Text style={[styles.heroStatNumber, { color: theme.colors.onPrimary }]}>{TOTAL_DAYS}</Text>
                        <Text style={[styles.heroStatLabel, { color: `${theme.colors.onPrimary}BB` }]}>Nights</Text>
                    </View>
                    <View style={[styles.heroStatBox, { backgroundColor: `${theme.colors.onPrimary}20` }]}>
                        <Text style={[styles.heroStatNumber, { color: theme.colors.onPrimary }]}>
                            {itineraryItems.length}
                        </Text>
                        <Text style={[styles.heroStatLabel, { color: `${theme.colors.onPrimary}BB` }]}>Activities</Text>
                    </View>
                </View>
            </View>

            {/* --- Quick Status Summary --- */}
            <View style={styles.statusSummaryRow}>
                <View style={[styles.statusPill, { backgroundColor: `${STATUS_CONFIG.confirmed.color}14` }]}>
                    <Ionicons name="checkmark-circle" size={15} color={STATUS_CONFIG.confirmed.color} />
                    <Text style={[styles.statusPillText, { color: STATUS_CONFIG.confirmed.color }]}>
                        {confirmedCount} Confirmed
                    </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: `${STATUS_CONFIG.pending.color}14` }]}>
                    <Ionicons name="time" size={15} color={STATUS_CONFIG.pending.color} />
                    <Text style={[styles.statusPillText, { color: STATUS_CONFIG.pending.color }]}>
                        {pendingCount} Pending
                    </Text>
                </View>
            </View>

            {/* --- Itinerary Section --- */}
            <View style={styles.sectionHeader}>
                <Ionicons name="map-outline" size={18} color={theme.colors.primary} />
                <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Itinerary</Text>
            </View>

            {Array.from(dayGroups.entries()).map(([day, items]) => (
                <View key={day}>
                    <DayDivider day={day} itemCount={items.length} />
                    {items.map((item) => (
                        <ItineraryCard
                            key={item.id}
                            item={item}
                            isExpanded={expandedItems.has(item.id)}
                            onToggle={() => toggleExpand(item.id)}
                        />
                    ))}
                </View>
            ))}

            {/* --- Packing Checklist Section --- */}
            <View style={[styles.packingSection, { borderColor: theme.colors.outlineVariant }]}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="briefcase-outline" size={18} color={theme.colors.primary} />
                    <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Packing List</Text>
                    <View style={styles.packingProgress}>
                        <Text style={[styles.packingProgressText, { color: theme.colors.onSurfaceVariant }]}>
                            {packedCount}/{totalPacking}
                        </Text>
                    </View>
                </View>

                {/* Progress bar */}
                <View style={[styles.progressTrack, { backgroundColor: theme.colors.surfaceContainer }]}>
                    <View
                        style={[
                            styles.progressFill,
                            {
                                width: `${(packedCount / totalPacking) * 100}%`,
                                backgroundColor: theme.colors.primary
                            }
                        ]}
                    />
                </View>

                {/* Packing groups */}
                {Array.from(packingGroups.entries()).map(([category, items]) => (
                    <View key={category} style={styles.packingGroup}>
                        <Text style={[styles.packingGroupTitle, { color: theme.colors.onSurfaceVariant }]}>
                            {category}
                        </Text>
                        <View
                            style={[
                                styles.packingGroupCard,
                                {
                                    backgroundColor: theme.colors.surfaceContainer
                                }
                            ]}
                        >
                            {items.map((item) => (
                                <PackingCheckbox key={item.id} item={item} onToggle={() => togglePacked(item.id)} />
                            ))}
                        </View>
                    </View>
                ))}
            </View>
        </ShowcasePage>
    );
}

// --- Page Styles ---

const styles = StyleSheet.create((theme) => ({
    // Hero card
    heroCard: {
        borderRadius: 20,
        padding: 24,
        marginTop: 20,
        alignItems: "center",
        gap: 8
    },
    heroIconRow: {
        marginBottom: 4
    },
    heroDestination: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 30,
        lineHeight: 38,
        textAlign: "center"
    },
    heroDatesRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6
    },
    heroDates: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14
    },
    heroStatsRow: {
        flexDirection: "row",
        gap: 10,
        marginTop: 16,
        width: "100%"
    },
    heroStatBox: {
        flex: 1,
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: "center",
        gap: 2
    },
    heroStatNumber: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 24,
        lineHeight: 30
    },
    heroStatLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },

    // Status summary
    statusSummaryRow: {
        flexDirection: "row",
        gap: 10,
        marginTop: 16,
        marginBottom: 8
    },
    statusPill: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 8,
        borderRadius: 10
    },
    statusPillText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13
    },

    // Section headers
    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginTop: 24,
        marginBottom: 4
    },
    sectionTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 18,
        flex: 1
    },

    // Packing section
    packingSection: {
        marginTop: 28,
        borderTopWidth: 1,
        paddingTop: 4
    },
    packingProgress: {
        marginLeft: "auto"
    },
    packingProgressText: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 13
    },
    progressTrack: {
        height: 6,
        borderRadius: 3,
        overflow: "hidden",
        marginTop: 12,
        marginBottom: 16
    },
    progressFill: {
        height: "100%",
        borderRadius: 3
    },
    packingGroup: {
        marginBottom: 16
    },
    packingGroupTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 12,
        textTransform: "uppercase",
        letterSpacing: 0.8,
        marginBottom: 6
    },
    packingGroupCard: {
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 6
    }
}));
