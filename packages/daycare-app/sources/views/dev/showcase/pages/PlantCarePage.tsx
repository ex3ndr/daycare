import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

// --- Types ---

type Room = "Living Room" | "Bedroom" | "Kitchen" | "Office" | "Balcony";
type Sunlight = "full sun" | "partial" | "shade";
type Health = "thriving" | "ok" | "struggling";
type WateringFrequency = "daily" | "every 2 days" | "weekly" | "biweekly";
type RoomFilter = "all" | Room;

type Plant = {
    id: string;
    name: string;
    species: string;
    room: Room;
    lastWatered: string;
    wateringFrequency: WateringFrequency;
    sunlight: Sunlight;
    health: Health;
    needsWaterToday: boolean;
    recentlyFertilized: boolean;
};

// --- Config ---

const ROOMS: Room[] = ["Living Room", "Bedroom", "Kitchen", "Office", "Balcony"];

const ROOM_ICONS: Record<Room, keyof typeof Ionicons.glyphMap> = {
    "Living Room": "tv-outline",
    Bedroom: "bed-outline",
    Kitchen: "restaurant-outline",
    Office: "desktop-outline",
    Balcony: "sunny-outline"
};

const ROOM_COLORS: Record<Room, string> = {
    "Living Room": "#16a34a",
    Bedroom: "#8B5CF6",
    Kitchen: "#F59E0B",
    Office: "#3B82F6",
    Balcony: "#EC4899"
};

const HEALTH_COLORS: Record<Health, string> = {
    thriving: "#16a34a",
    ok: "#d97706",
    struggling: "#dc2626"
};

const HEALTH_LABELS: Record<Health, string> = {
    thriving: "Thriving",
    ok: "OK",
    struggling: "Struggling"
};

const SUNLIGHT_ICONS: Record<Sunlight, keyof typeof Ionicons.glyphMap> = {
    "full sun": "sunny",
    partial: "partly-sunny",
    shade: "cloud"
};

const SUNLIGHT_LABELS: Record<Sunlight, string> = {
    "full sun": "Full Sun",
    partial: "Partial",
    shade: "Shade"
};

// --- Mock data ---

const initialPlants: Plant[] = [
    // Living Room
    {
        id: "lr1",
        name: "Fiddle Leaf Fig",
        species: "Ficus lyrata",
        room: "Living Room",
        lastWatered: "Mar 1",
        wateringFrequency: "weekly",
        sunlight: "partial",
        health: "thriving",
        needsWaterToday: false,
        recentlyFertilized: true
    },
    {
        id: "lr2",
        name: "Monstera",
        species: "Monstera deliciosa",
        room: "Living Room",
        lastWatered: "Feb 27",
        wateringFrequency: "weekly",
        sunlight: "partial",
        health: "thriving",
        needsWaterToday: false,
        recentlyFertilized: false
    },
    {
        id: "lr3",
        name: "Snake Plant",
        species: "Sansevieria trifasciata",
        room: "Living Room",
        lastWatered: "Feb 18",
        wateringFrequency: "biweekly",
        sunlight: "shade",
        health: "ok",
        needsWaterToday: true,
        recentlyFertilized: false
    },
    // Bedroom
    {
        id: "bd1",
        name: "Peace Lily",
        species: "Spathiphyllum wallisii",
        room: "Bedroom",
        lastWatered: "Mar 2",
        wateringFrequency: "every 2 days",
        sunlight: "shade",
        health: "thriving",
        needsWaterToday: false,
        recentlyFertilized: true
    },
    {
        id: "bd2",
        name: "Pothos",
        species: "Epipremnum aureum",
        room: "Bedroom",
        lastWatered: "Feb 25",
        wateringFrequency: "weekly",
        sunlight: "shade",
        health: "ok",
        needsWaterToday: true,
        recentlyFertilized: false
    },
    // Kitchen
    {
        id: "kt1",
        name: "Basil",
        species: "Ocimum basilicum",
        room: "Kitchen",
        lastWatered: "Mar 2",
        wateringFrequency: "daily",
        sunlight: "full sun",
        health: "thriving",
        needsWaterToday: true,
        recentlyFertilized: false
    },
    {
        id: "kt2",
        name: "Rosemary",
        species: "Salvia rosmarinus",
        room: "Kitchen",
        lastWatered: "Feb 28",
        wateringFrequency: "every 2 days",
        sunlight: "full sun",
        health: "ok",
        needsWaterToday: true,
        recentlyFertilized: false
    },
    {
        id: "kt3",
        name: "Aloe Vera",
        species: "Aloe barbadensis",
        room: "Kitchen",
        lastWatered: "Feb 20",
        wateringFrequency: "biweekly",
        sunlight: "partial",
        health: "struggling",
        needsWaterToday: true,
        recentlyFertilized: false
    },
    // Office
    {
        id: "of1",
        name: "ZZ Plant",
        species: "Zamioculcas zamiifolia",
        room: "Office",
        lastWatered: "Feb 22",
        wateringFrequency: "biweekly",
        sunlight: "shade",
        health: "thriving",
        needsWaterToday: false,
        recentlyFertilized: true
    },
    {
        id: "of2",
        name: "Spider Plant",
        species: "Chlorophytum comosum",
        room: "Office",
        lastWatered: "Feb 26",
        wateringFrequency: "weekly",
        sunlight: "partial",
        health: "struggling",
        needsWaterToday: true,
        recentlyFertilized: false
    },
    // Balcony
    {
        id: "bl1",
        name: "Lavender",
        species: "Lavandula angustifolia",
        room: "Balcony",
        lastWatered: "Mar 1",
        wateringFrequency: "every 2 days",
        sunlight: "full sun",
        health: "thriving",
        needsWaterToday: true,
        recentlyFertilized: false
    },
    {
        id: "bl2",
        name: "Geranium",
        species: "Pelargonium zonale",
        room: "Balcony",
        lastWatered: "Mar 2",
        wateringFrequency: "every 2 days",
        sunlight: "full sun",
        health: "ok",
        needsWaterToday: false,
        recentlyFertilized: true
    },
    {
        id: "bl3",
        name: "Succulent Mix",
        species: "Echeveria elegans",
        room: "Balcony",
        lastWatered: "Feb 15",
        wateringFrequency: "biweekly",
        sunlight: "full sun",
        health: "struggling",
        needsWaterToday: true,
        recentlyFertilized: false
    }
];

// --- Care Reminder Banner ---

function CareReminderBanner({ needsWaterCount }: { needsWaterCount: number }) {
    const { theme } = useUnistyles();

    if (needsWaterCount === 0) {
        return (
            <View style={[styles.banner, { backgroundColor: `${HEALTH_COLORS.thriving}14` }]}>
                <View style={[styles.bannerIconCircle, { backgroundColor: `${HEALTH_COLORS.thriving}20` }]}>
                    <Ionicons name="checkmark-circle" size={22} color={HEALTH_COLORS.thriving} />
                </View>
                <View style={styles.bannerTextCol}>
                    <Text style={[styles.bannerTitle, { color: HEALTH_COLORS.thriving }]}>All plants watered!</Text>
                    <Text style={[styles.bannerSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                        Great job, no plants need water today.
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.banner, { backgroundColor: `${theme.colors.primary}12` }]}>
            <View style={[styles.bannerIconCircle, { backgroundColor: `${theme.colors.primary}20` }]}>
                <Ionicons name="water" size={22} color={theme.colors.primary} />
            </View>
            <View style={styles.bannerTextCol}>
                <Text style={[styles.bannerTitle, { color: theme.colors.primary }]}>
                    {needsWaterCount} plant{needsWaterCount !== 1 ? "s" : ""} need water today
                </Text>
                <Text style={[styles.bannerSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                    Tap the water icon on each plant to mark as watered.
                </Text>
            </View>
            <View style={[styles.bannerBadge, { backgroundColor: theme.colors.primary }]}>
                <Ionicons name="water" size={10} color="#ffffff" />
                <Text style={styles.bannerBadgeText}>{needsWaterCount}</Text>
            </View>
        </View>
    );
}

// --- Summary Cards ---

function SummaryCards({
    totalPlants,
    needsWaterCount,
    fertilizedCount
}: {
    totalPlants: number;
    needsWaterCount: number;
    fertilizedCount: number;
}) {
    const { theme } = useUnistyles();

    return (
        <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, { backgroundColor: theme.colors.surfaceContainer }]}>
                <View style={[styles.summaryIconCircle, { backgroundColor: `${HEALTH_COLORS.thriving}18` }]}>
                    <Ionicons name="leaf" size={18} color={HEALTH_COLORS.thriving} />
                </View>
                <Text style={[styles.summaryValue, { color: HEALTH_COLORS.thriving }]}>{totalPlants}</Text>
                <Text style={[styles.summaryLabel, { color: theme.colors.onSurfaceVariant }]}>Total Plants</Text>
            </View>

            <View style={[styles.summaryCard, { backgroundColor: theme.colors.surfaceContainer }]}>
                <View style={styles.summaryIconRow}>
                    <View style={[styles.summaryIconCircle, { backgroundColor: `${theme.colors.primary}18` }]}>
                        <Ionicons name="water" size={18} color={theme.colors.primary} />
                    </View>
                    {needsWaterCount > 0 && (
                        <View style={[styles.countBadge, { backgroundColor: theme.colors.error }]}>
                            <Text style={styles.countBadgeText}>{needsWaterCount}</Text>
                        </View>
                    )}
                </View>
                <Text style={[styles.summaryValue, { color: theme.colors.primary }]}>{needsWaterCount}</Text>
                <Text style={[styles.summaryLabel, { color: theme.colors.onSurfaceVariant }]}>Need Water</Text>
            </View>

            <View style={[styles.summaryCard, { backgroundColor: theme.colors.surfaceContainer }]}>
                <View style={[styles.summaryIconCircle, { backgroundColor: `${ROOM_COLORS.Bedroom}18` }]}>
                    <Ionicons name="sparkles" size={18} color={ROOM_COLORS.Bedroom} />
                </View>
                <Text style={[styles.summaryValue, { color: ROOM_COLORS.Bedroom }]}>{fertilizedCount}</Text>
                <Text style={[styles.summaryLabel, { color: theme.colors.onSurfaceVariant }]}>Fertilized</Text>
            </View>
        </View>
    );
}

// --- Health Badge ---

function HealthBadge({ health }: { health: Health }) {
    const color = HEALTH_COLORS[health];

    return (
        <View style={[styles.healthBadge, { backgroundColor: `${color}18` }]}>
            <View style={[styles.healthDot, { backgroundColor: color }]} />
            <Text style={[styles.healthBadgeText, { color }]}>{HEALTH_LABELS[health]}</Text>
        </View>
    );
}

// --- Sunlight Chip ---

function SunlightChip({ sunlight }: { sunlight: Sunlight }) {
    const color = sunlight === "full sun" ? "#F59E0B" : sunlight === "partial" ? "#3B82F6" : "#6B7280";

    return (
        <View style={[styles.chip, { backgroundColor: `${color}15` }]}>
            <Ionicons name={SUNLIGHT_ICONS[sunlight]} size={12} color={color} />
            <Text style={[styles.chipText, { color }]}>{SUNLIGHT_LABELS[sunlight]}</Text>
        </View>
    );
}

// --- Watering Frequency Chip ---

function WateringChip({ frequency }: { frequency: WateringFrequency }) {
    const { theme } = useUnistyles();

    return (
        <View style={[styles.chip, { backgroundColor: `${theme.colors.primary}12` }]}>
            <Ionicons name="water-outline" size={12} color={theme.colors.primary} />
            <Text style={[styles.chipText, { color: theme.colors.primary }]}>{frequency}</Text>
        </View>
    );
}

// --- Plant Row ---

function PlantRow({ plant, onWater }: { plant: Plant; onWater: (id: string) => void }) {
    const { theme } = useUnistyles();
    const healthColor = HEALTH_COLORS[plant.health];

    return (
        <View
            style={[
                styles.plantRow,
                {
                    backgroundColor: theme.colors.surfaceContainer,
                    borderColor: plant.needsWaterToday ? `${theme.colors.primary}40` : theme.colors.outlineVariant
                }
            ]}
        >
            {/* Left health indicator bar */}
            <View style={[styles.plantHealthBar, { backgroundColor: healthColor }]} />

            <View style={styles.plantContent}>
                {/* Top row: name + species + health badge */}
                <View style={styles.plantTopRow}>
                    <View style={styles.plantNameCol}>
                        <Text style={[styles.plantName, { color: theme.colors.onSurface }]} numberOfLines={1}>
                            {plant.name}
                        </Text>
                        <Text style={[styles.plantSpecies, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
                            {plant.species}
                        </Text>
                    </View>
                    <HealthBadge health={plant.health} />
                </View>

                {/* Middle row: chips */}
                <View style={styles.plantChipRow}>
                    <WateringChip frequency={plant.wateringFrequency} />
                    <SunlightChip sunlight={plant.sunlight} />
                    {plant.recentlyFertilized && (
                        <View style={[styles.chip, { backgroundColor: `${ROOM_COLORS.Bedroom}15` }]}>
                            <Ionicons name="sparkles" size={12} color={ROOM_COLORS.Bedroom} />
                            <Text style={[styles.chipText, { color: ROOM_COLORS.Bedroom }]}>Fertilized</Text>
                        </View>
                    )}
                </View>

                {/* Bottom row: last watered + water button */}
                <View style={styles.plantBottomRow}>
                    <View style={styles.lastWateredRow}>
                        <Ionicons name="calendar-outline" size={13} color={theme.colors.onSurfaceVariant} />
                        <Text style={[styles.lastWateredText, { color: theme.colors.onSurfaceVariant }]}>
                            Watered: {plant.lastWatered}
                        </Text>
                    </View>

                    {plant.needsWaterToday && (
                        <Pressable
                            onPress={() => onWater(plant.id)}
                            style={({ pressed }) => [
                                styles.waterButton,
                                {
                                    backgroundColor: theme.colors.primary,
                                    opacity: pressed ? 0.8 : 1
                                }
                            ]}
                        >
                            <Ionicons name="water" size={14} color="#ffffff" />
                            <Text style={styles.waterButtonText}>Water</Text>
                        </Pressable>
                    )}

                    {!plant.needsWaterToday && (
                        <View style={[styles.wateredBadge, { backgroundColor: `${HEALTH_COLORS.thriving}15` }]}>
                            <Ionicons name="checkmark-circle" size={14} color={HEALTH_COLORS.thriving} />
                            <Text style={[styles.wateredBadgeText, { color: HEALTH_COLORS.thriving }]}>Watered</Text>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
}

// --- Room Section Header ---

function RoomSectionHeader({
    room,
    plantCount,
    needsWaterCount
}: {
    room: Room;
    plantCount: number;
    needsWaterCount: number;
}) {
    const { theme } = useUnistyles();
    const roomColor = ROOM_COLORS[room];
    const icon = ROOM_ICONS[room];

    return (
        <View style={[styles.roomHeader, { borderBottomColor: theme.colors.outlineVariant }]}>
            <View style={[styles.roomIconCircle, { backgroundColor: `${roomColor}18` }]}>
                <Ionicons name={icon} size={20} color={roomColor} />
            </View>
            <View style={styles.roomHeaderTextCol}>
                <Text style={[styles.roomTitle, { color: theme.colors.onSurface }]}>{room}</Text>
                <Text style={[styles.roomSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                    {plantCount} plant{plantCount !== 1 ? "s" : ""}
                </Text>
            </View>
            {needsWaterCount > 0 && (
                <View style={[styles.roomWaterBadge, { backgroundColor: `${theme.colors.primary}18` }]}>
                    <Ionicons name="water" size={12} color={theme.colors.primary} />
                    <Text style={[styles.roomWaterBadgeText, { color: theme.colors.primary }]}>{needsWaterCount}</Text>
                </View>
            )}
        </View>
    );
}

// --- Room Filter Pills ---

function RoomFilterPills({
    active,
    onSelect,
    roomCounts
}: {
    active: RoomFilter;
    onSelect: (filter: RoomFilter) => void;
    roomCounts: Record<RoomFilter, number>;
}) {
    const { theme } = useUnistyles();

    const filters: { key: RoomFilter; label: string }[] = [
        { key: "all", label: "All Rooms" },
        ...ROOMS.map((r) => ({ key: r as RoomFilter, label: r }))
    ];

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScrollContent}
        >
            {filters.map(({ key, label }) => {
                const isActive = active === key;
                const accentColor = key === "all" ? theme.colors.primary : ROOM_COLORS[key as Room];

                return (
                    <Pressable
                        key={key}
                        onPress={() => onSelect(key)}
                        style={[
                            styles.filterPill,
                            {
                                backgroundColor: isActive ? accentColor : theme.colors.surfaceContainer,
                                borderColor: isActive ? accentColor : theme.colors.outlineVariant
                            }
                        ]}
                    >
                        <Text
                            style={[
                                styles.filterPillText,
                                { color: isActive ? "#ffffff" : theme.colors.onSurfaceVariant }
                            ]}
                        >
                            {label}
                        </Text>
                        <View
                            style={[
                                styles.filterPillCount,
                                {
                                    backgroundColor: isActive ? "rgba(255,255,255,0.25)" : `${accentColor}20`
                                }
                            ]}
                        >
                            <Text style={[styles.filterPillCountText, { color: isActive ? "#ffffff" : accentColor }]}>
                                {roomCounts[key]}
                            </Text>
                        </View>
                    </Pressable>
                );
            })}
        </ScrollView>
    );
}

// --- Main Component ---

export function PlantCarePage() {
    const { theme } = useUnistyles();
    const [plants, setPlants] = React.useState(initialPlants);
    const [roomFilter, setRoomFilter] = React.useState<RoomFilter>("all");

    const waterPlant = React.useCallback((id: string) => {
        setPlants((prev) =>
            prev.map((p) => (p.id === id ? { ...p, needsWaterToday: false, lastWatered: "Mar 3" } : p))
        );
    }, []);

    // Compute summary counts
    const totalPlants = plants.length;
    const needsWaterCount = plants.filter((p) => p.needsWaterToday).length;
    const fertilizedCount = plants.filter((p) => p.recentlyFertilized).length;

    // Room counts for filter pills
    const roomCounts = React.useMemo(() => {
        const counts: Record<RoomFilter, number> = { all: plants.length } as Record<RoomFilter, number>;
        for (const room of ROOMS) {
            counts[room] = plants.filter((p) => p.room === room).length;
        }
        return counts;
    }, [plants]);

    // Filter plants
    const filteredPlants = roomFilter === "all" ? plants : plants.filter((p) => p.room === roomFilter);

    // Group by room
    const groupedByRoom = React.useMemo(() => {
        const groups: { room: Room; plants: Plant[] }[] = [];
        for (const room of ROOMS) {
            const roomPlants = filteredPlants.filter((p) => p.room === room);
            if (roomPlants.length > 0) {
                groups.push({ room, plants: roomPlants });
            }
        }
        return groups;
    }, [filteredPlants]);

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: theme.colors.surface }}
            contentContainerStyle={styles.scrollContent}
        >
            {/* Page header */}
            <View style={styles.pageHeader}>
                <View style={styles.pageTitleRow}>
                    <Ionicons name="leaf" size={24} color={HEALTH_COLORS.thriving} />
                    <Text style={[styles.pageTitle, { color: theme.colors.onSurface }]}>Plant Care</Text>
                </View>
                <Text style={[styles.pageDate, { color: theme.colors.onSurfaceVariant }]}>March 3, 2026</Text>
            </View>

            {/* Care reminder banner */}
            <CareReminderBanner needsWaterCount={needsWaterCount} />

            {/* Summary cards */}
            <SummaryCards
                totalPlants={totalPlants}
                needsWaterCount={needsWaterCount}
                fertilizedCount={fertilizedCount}
            />

            {/* Room filter */}
            <RoomFilterPills active={roomFilter} onSelect={setRoomFilter} roomCounts={roomCounts} />

            {/* Plant list grouped by room */}
            {groupedByRoom.map(({ room, plants: roomPlants }) => {
                const roomNeedsWater = roomPlants.filter((p) => p.needsWaterToday).length;

                return (
                    <View key={room} style={styles.roomSection}>
                        <RoomSectionHeader
                            room={room}
                            plantCount={roomPlants.length}
                            needsWaterCount={roomNeedsWater}
                        />
                        <View style={styles.plantList}>
                            {roomPlants.map((plant) => (
                                <PlantRow key={plant.id} plant={plant} onWater={waterPlant} />
                            ))}
                        </View>
                    </View>
                );
            })}

            {/* Empty state */}
            {groupedByRoom.length === 0 && (
                <View style={styles.emptyState}>
                    <Ionicons name="leaf-outline" size={48} color={theme.colors.onSurfaceVariant} />
                    <Text style={[styles.emptyStateText, { color: theme.colors.onSurfaceVariant }]}>
                        No plants in this room
                    </Text>
                </View>
            )}
        </ScrollView>
    );
}

// --- Styles ---

const styles = StyleSheet.create((theme) => ({
    scrollContent: {
        maxWidth: theme.layout.maxWidth,
        width: "100%",
        alignSelf: "center",
        padding: 16,
        gap: 16,
        paddingBottom: 48
    },

    // Page header
    pageHeader: {
        gap: 4,
        paddingTop: 8
    },
    pageTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10
    },
    pageTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 22,
        lineHeight: 28
    },
    pageDate: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        marginLeft: 34
    },

    // Care reminder banner
    banner: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 14,
        padding: 14,
        gap: 12
    },
    bannerIconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center"
    },
    bannerTextCol: {
        flex: 1,
        gap: 2
    },
    bannerTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 14,
        lineHeight: 18
    },
    bannerSubtitle: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        lineHeight: 16
    },
    bannerBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12
    },
    bannerBadgeText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 12,
        color: "#ffffff"
    },

    // Summary cards
    summaryRow: {
        flexDirection: "row",
        gap: 8
    },
    summaryCard: {
        flex: 1,
        borderRadius: 14,
        padding: 12,
        gap: 6,
        alignItems: "center"
    },
    summaryIconRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4
    },
    summaryIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center"
    },
    countBadge: {
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 4
    },
    countBadgeText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 10,
        color: "#ffffff"
    },
    summaryValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 24,
        lineHeight: 28
    },
    summaryLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11,
        lineHeight: 14
    },

    // Room filter pills
    filterScrollContent: {
        gap: 8,
        paddingVertical: 2
    },
    filterPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        borderWidth: 1
    },
    filterPillText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13
    },
    filterPillCount: {
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 8
    },
    filterPillCountText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 11
    },

    // Room section
    roomSection: {
        gap: 10
    },
    roomHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingBottom: 10,
        borderBottomWidth: 1
    },
    roomIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center"
    },
    roomHeaderTextCol: {
        flex: 1,
        gap: 1
    },
    roomTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15,
        lineHeight: 20
    },
    roomSubtitle: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    roomWaterBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10
    },
    roomWaterBadgeText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 12
    },

    // Plant list
    plantList: {
        gap: 8
    },

    // Plant row
    plantRow: {
        flexDirection: "row",
        borderRadius: 12,
        borderWidth: 1,
        overflow: "hidden"
    },
    plantHealthBar: {
        width: 4
    },
    plantContent: {
        flex: 1,
        padding: 12,
        gap: 8
    },
    plantTopRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 8
    },
    plantNameCol: {
        flex: 1,
        gap: 2
    },
    plantName: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 14,
        lineHeight: 18
    },
    plantSpecies: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        lineHeight: 16,
        fontStyle: "italic"
    },
    plantChipRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        flexWrap: "wrap"
    },
    plantBottomRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between"
    },
    lastWateredRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4
    },
    lastWateredText: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11,
        lineHeight: 14
    },

    // Chips
    chip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10
    },
    chipText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 10,
        lineHeight: 14
    },

    // Health badge
    healthBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10
    },
    healthDot: {
        width: 6,
        height: 6,
        borderRadius: 3
    },
    healthBadgeText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 10,
        lineHeight: 14
    },

    // Water button
    waterButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14
    },
    waterButtonText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 12,
        color: "#ffffff"
    },

    // Watered badge
    wateredBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10
    },
    wateredBadgeText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11
    },

    // Empty state
    emptyState: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 48,
        gap: 12
    },
    emptyStateText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14
    }
}));
