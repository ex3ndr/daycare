import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { ShowcasePage } from "@/views/dev/showcase/components/ShowcasePage";

// --- Types ---

type ApplicationStatus = "not_applied" | "applied" | "approved" | "rejected";

type Apartment = {
    id: number;
    address: string;
    neighborhood: string;
    rent: number;
    bedrooms: number;
    bathrooms: number;
    availableDate: string;
    broker: string;
    brokerPhone: string;
    rating: number;
    status: ApplicationStatus;
    pros: string[];
    cons: string[];
    photosUrl: string;
    commuteMinutes: number;
    sqft: number;
    petFriendly: boolean;
    laundry: "in-unit" | "building" | "none";
};

type SearchCriteria = {
    budgetMin: number;
    budgetMax: number;
    neighborhoods: string[];
    minBedrooms: number;
    maxBedrooms: number;
};

// --- Mock data ---

const SEARCH_CRITERIA: SearchCriteria = {
    budgetMin: 1800,
    budgetMax: 3200,
    neighborhoods: ["Williamsburg", "Park Slope", "Greenpoint", "DUMBO"],
    minBedrooms: 1,
    maxBedrooms: 3
};

const APARTMENTS: Apartment[] = [
    {
        id: 1,
        address: "245 Bedford Ave, Apt 4R",
        neighborhood: "Williamsburg",
        rent: 2850,
        bedrooms: 2,
        bathrooms: 1,
        availableDate: "Apr 1, 2026",
        broker: "Maria Santos",
        brokerPhone: "(718) 555-0142",
        rating: 4,
        status: "applied",
        pros: ["Natural light in every room", "Hardwood floors throughout", "Close to L train"],
        cons: ["Street noise on weekends", "No dishwasher"],
        photosUrl: "zillow.com/245-bedford",
        commuteMinutes: 22,
        sqft: 875,
        petFriendly: true,
        laundry: "building"
    },
    {
        id: 2,
        address: "78 5th Ave, Unit 2A",
        neighborhood: "Park Slope",
        rent: 3100,
        bedrooms: 2,
        bathrooms: 1,
        availableDate: "Apr 15, 2026",
        broker: "James Whitfield",
        brokerPhone: "(718) 555-0287",
        rating: 5,
        status: "approved",
        pros: ["Renovated kitchen", "Prospect Park 2 blocks", "Quiet tree-lined street", "Roof access"],
        cons: ["4th floor walk-up", "Small closets"],
        photosUrl: "streeteasy.com/78-5th",
        commuteMinutes: 35,
        sqft: 950,
        petFriendly: true,
        laundry: "in-unit"
    },
    {
        id: 3,
        address: "112 Green St, Apt 6B",
        neighborhood: "Greenpoint",
        rent: 2200,
        bedrooms: 1,
        bathrooms: 1,
        availableDate: "Mar 15, 2026",
        broker: "Anya Kowalski",
        brokerPhone: "(718) 555-0391",
        rating: 3,
        status: "not_applied",
        pros: ["Below budget", "Recently painted", "Good water pressure"],
        cons: ["Far from subway", "Dated bathroom", "No AC units"],
        photosUrl: "apartments.com/112-green",
        commuteMinutes: 40,
        sqft: 620,
        petFriendly: false,
        laundry: "building"
    },
    {
        id: 4,
        address: "30 Washington St, 8F",
        neighborhood: "DUMBO",
        rent: 3200,
        bedrooms: 1,
        bathrooms: 1,
        availableDate: "May 1, 2026",
        broker: "David Chen",
        brokerPhone: "(718) 555-0508",
        rating: 4,
        status: "rejected",
        pros: ["Manhattan bridge views", "Doorman building", "Modern finishes"],
        cons: ["At budget max", "Small bedroom", "Bridge noise"],
        photosUrl: "zillow.com/30-washington",
        commuteMinutes: 18,
        sqft: 710,
        petFriendly: true,
        laundry: "in-unit"
    },
    {
        id: 5,
        address: "189 Berry St, Apt 3L",
        neighborhood: "Williamsburg",
        rent: 2650,
        bedrooms: 3,
        bathrooms: 2,
        availableDate: "Apr 1, 2026",
        broker: "Maria Santos",
        brokerPhone: "(718) 555-0142",
        rating: 3,
        status: "applied",
        pros: ["Extra bedroom for office", "Two full baths", "Laundry in unit"],
        cons: ["Ground floor", "Needs paint", "Facing courtyard"],
        photosUrl: "streeteasy.com/189-berry",
        commuteMinutes: 25,
        sqft: 1100,
        petFriendly: true,
        laundry: "in-unit"
    },
    {
        id: 6,
        address: "401 Union St, 5C",
        neighborhood: "Park Slope",
        rent: 1950,
        bedrooms: 1,
        bathrooms: 1,
        availableDate: "Mar 20, 2026",
        broker: "James Whitfield",
        brokerPhone: "(718) 555-0287",
        rating: 2,
        status: "not_applied",
        pros: ["Very affordable", "Pet friendly building"],
        cons: ["Needs renovation", "No natural light in kitchen", "Loud neighbors reported", "No laundry"],
        photosUrl: "apartments.com/401-union",
        commuteMinutes: 38,
        sqft: 550,
        petFriendly: true,
        laundry: "none"
    }
];

// --- Helpers ---

/** Formats a dollar amount with commas. */
function formatRent(amount: number): string {
    return `$${amount.toLocaleString("en-US")}`;
}

/** Returns display label and color for an application status. */
function statusDisplay(status: ApplicationStatus): { label: string; color: string; bg: string; icon: string } {
    switch (status) {
        case "not_applied":
            return { label: "Not Applied", color: "#6b7280", bg: "#6b728018", icon: "remove-circle-outline" };
        case "applied":
            return { label: "Applied", color: "#3b82f6", bg: "#3b82f618", icon: "time-outline" };
        case "approved":
            return { label: "Approved", color: "#10b981", bg: "#10b98118", icon: "checkmark-circle" };
        case "rejected":
            return { label: "Rejected", color: "#ef4444", bg: "#ef444418", icon: "close-circle" };
    }
}

/** Returns a color representing rent affordability relative to budget. */
function rentColor(rent: number): string {
    const ratio = (rent - SEARCH_CRITERIA.budgetMin) / (SEARCH_CRITERIA.budgetMax - SEARCH_CRITERIA.budgetMin);
    if (ratio <= 0.3) return "#10b981";
    if (ratio <= 0.7) return "#f59e0b";
    return "#ef4444";
}

/** Returns laundry display text. */
function laundryLabel(laundry: "in-unit" | "building" | "none"): string {
    switch (laundry) {
        case "in-unit":
            return "In-unit";
        case "building":
            return "In building";
        case "none":
            return "None";
    }
}

// --- Sub-components ---

/** Search criteria summary card at the top. */
function CriteriaSummary({ criteria }: { criteria: SearchCriteria }) {
    const { theme } = useUnistyles();

    return (
        <View style={styles.criteriaCard}>
            <View style={styles.criteriaHeader}>
                <Ionicons name="search" size={18} color={theme.colors.primary} />
                <Text style={styles.criteriaTitle}>Search Criteria</Text>
            </View>

            <View style={styles.criteriaGrid}>
                <View style={styles.criteriaItem}>
                    <Ionicons name="cash-outline" size={16} color={theme.colors.onSurfaceVariant} />
                    <Text style={styles.criteriaLabel}>Budget</Text>
                    <Text style={styles.criteriaValue}>
                        {formatRent(criteria.budgetMin)} - {formatRent(criteria.budgetMax)}
                    </Text>
                </View>

                <View style={styles.criteriaItem}>
                    <Ionicons name="bed-outline" size={16} color={theme.colors.onSurfaceVariant} />
                    <Text style={styles.criteriaLabel}>Bedrooms</Text>
                    <Text style={styles.criteriaValue}>
                        {criteria.minBedrooms} - {criteria.maxBedrooms} BR
                    </Text>
                </View>
            </View>

            <View style={styles.neighborhoodRow}>
                <Ionicons name="location-outline" size={16} color={theme.colors.onSurfaceVariant} />
                <View style={styles.neighborhoodChips}>
                    {criteria.neighborhoods.map((n) => (
                        <View
                            key={n}
                            style={[styles.neighborhoodChip, { backgroundColor: `${theme.colors.primary}14` }]}
                        >
                            <Text style={[styles.neighborhoodChipText, { color: theme.colors.primary }]}>{n}</Text>
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
}

/** Quick stats bar showing summary numbers. */
function StatsBar({ apartments }: { apartments: Apartment[] }) {
    const { theme } = useUnistyles();
    const total = apartments.length;
    const applied = apartments.filter((a) => a.status === "applied").length;
    const approved = apartments.filter((a) => a.status === "approved").length;
    const avgRent = Math.round(apartments.reduce((sum, a) => sum + a.rent, 0) / total);

    return (
        <View style={styles.statsBar}>
            <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.colors.onSurface }]}>{total}</Text>
                <Text style={styles.statLabel}>Listings</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: "#3b82f6" }]}>{applied}</Text>
                <Text style={styles.statLabel}>Applied</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: "#10b981" }]}>{approved}</Text>
                <Text style={styles.statLabel}>Approved</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.colors.onSurface }]}>{formatRent(avgRent)}</Text>
                <Text style={styles.statLabel}>Avg Rent</Text>
            </View>
        </View>
    );
}

/** Star rating display with interactive tapping. */
function StarRating({ rating, onRate }: { rating: number; onRate: (value: number) => void }) {
    const { theme } = useUnistyles();

    return (
        <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((star) => (
                <Pressable key={star} onPress={() => onRate(star)} hitSlop={4}>
                    <Ionicons
                        name={star <= rating ? "star" : "star-outline"}
                        size={16}
                        color={star <= rating ? "#f59e0b" : theme.colors.outlineVariant}
                    />
                </Pressable>
            ))}
        </View>
    );
}

/** Application status badge. */
function StatusBadge({ status }: { status: ApplicationStatus }) {
    const display = statusDisplay(status);

    return (
        <View style={[styles.statusBadge, { backgroundColor: display.bg }]}>
            <Ionicons name={display.icon as keyof typeof Ionicons.glyphMap} size={14} color={display.color} />
            <Text style={[styles.statusBadgeText, { color: display.color }]}>{display.label}</Text>
        </View>
    );
}

/** Pros/cons detail list. */
function ProsConsList({ pros, cons }: { pros: string[]; cons: string[] }) {
    const { theme } = useUnistyles();

    return (
        <View style={styles.prosConsContainer}>
            <View style={styles.prosConsColumn}>
                <Text style={[styles.prosConsTitle, { color: "#10b981" }]}>Pros</Text>
                {pros.map((pro) => (
                    <View key={pro} style={styles.prosConsRow}>
                        <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                        <Text style={[styles.prosConsText, { color: theme.colors.onSurface }]}>{pro}</Text>
                    </View>
                ))}
            </View>
            <View style={styles.prosConsColumn}>
                <Text style={[styles.prosConsTitle, { color: "#ef4444" }]}>Cons</Text>
                {cons.map((con) => (
                    <View key={con} style={styles.prosConsRow}>
                        <Ionicons name="close-circle" size={14} color="#ef4444" />
                        <Text style={[styles.prosConsText, { color: theme.colors.onSurface }]}>{con}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

/** Expandable detail panel for an apartment. */
function DetailPanel({ apartment }: { apartment: Apartment }) {
    const { theme } = useUnistyles();

    return (
        <View style={styles.detailPanel}>
            <View style={styles.detailDivider} />

            {/* Detail info grid */}
            <View style={styles.detailGrid}>
                <View style={styles.detailGridItem}>
                    <Ionicons name="resize-outline" size={14} color={theme.colors.onSurfaceVariant} />
                    <Text style={styles.detailGridLabel}>{apartment.sqft} sqft</Text>
                </View>
                <View style={styles.detailGridItem}>
                    <Ionicons name="car-outline" size={14} color={theme.colors.onSurfaceVariant} />
                    <Text style={styles.detailGridLabel}>{apartment.commuteMinutes} min commute</Text>
                </View>
                <View style={styles.detailGridItem}>
                    <Ionicons
                        name={apartment.petFriendly ? "paw" : "paw-outline"}
                        size={14}
                        color={apartment.petFriendly ? "#10b981" : theme.colors.outlineVariant}
                    />
                    <Text style={styles.detailGridLabel}>{apartment.petFriendly ? "Pets OK" : "No pets"}</Text>
                </View>
                <View style={styles.detailGridItem}>
                    <Ionicons name="water-outline" size={14} color={theme.colors.onSurfaceVariant} />
                    <Text style={styles.detailGridLabel}>{laundryLabel(apartment.laundry)}</Text>
                </View>
            </View>

            {/* Pros and cons */}
            <ProsConsList pros={apartment.pros} cons={apartment.cons} />

            {/* Broker contact + photos */}
            <View style={styles.detailFooter}>
                <View style={styles.brokerSection}>
                    <Ionicons name="person-circle-outline" size={16} color={theme.colors.onSurfaceVariant} />
                    <View>
                        <Text style={styles.brokerName}>{apartment.broker}</Text>
                        <Text style={styles.brokerPhone}>{apartment.brokerPhone}</Text>
                    </View>
                </View>
                <View style={[styles.photosLink, { backgroundColor: `${theme.colors.primary}14` }]}>
                    <Ionicons name="images-outline" size={14} color={theme.colors.primary} />
                    <Text style={[styles.photosLinkText, { color: theme.colors.primary }]}>Photos</Text>
                </View>
            </View>

            {/* Application status */}
            <View style={styles.statusRow}>
                <Text style={styles.statusRowLabel}>Application:</Text>
                <StatusBadge status={apartment.status} />
            </View>
        </View>
    );
}

/** A single apartment card with expand/collapse. */
function ApartmentCard({
    apartment,
    expanded,
    favorited,
    rating,
    onToggleExpand,
    onToggleFavorite,
    onRate
}: {
    apartment: Apartment;
    expanded: boolean;
    favorited: boolean;
    rating: number;
    onToggleExpand: () => void;
    onToggleFavorite: () => void;
    onRate: (value: number) => void;
}) {
    const { theme } = useUnistyles();
    const display = statusDisplay(apartment.status);

    return (
        <View style={styles.apartmentCard}>
            {/* Status accent bar at top */}
            <View style={[styles.accentBar, { backgroundColor: display.color }]} />

            <Pressable onPress={onToggleExpand} style={styles.cardContent}>
                {/* Top row: address + favorite */}
                <View style={styles.cardTopRow}>
                    <View style={styles.cardAddressBlock}>
                        <View style={styles.addressRow}>
                            <Ionicons name="location" size={16} color={theme.colors.primary} />
                            <Text style={styles.cardAddress} numberOfLines={1}>
                                {apartment.address}
                            </Text>
                        </View>
                        <Text style={styles.cardNeighborhood}>{apartment.neighborhood}</Text>
                    </View>
                    <Pressable onPress={onToggleFavorite} hitSlop={8}>
                        <Ionicons
                            name={favorited ? "heart" : "heart-outline"}
                            size={22}
                            color={favorited ? "#ef4444" : theme.colors.outlineVariant}
                        />
                    </Pressable>
                </View>

                {/* Rent + bed/bath row */}
                <View style={styles.metricsRow}>
                    <View style={styles.rentBlock}>
                        <Text style={[styles.rentAmount, { color: rentColor(apartment.rent) }]}>
                            {formatRent(apartment.rent)}
                        </Text>
                        <Text style={styles.rentPeriod}>/mo</Text>
                    </View>

                    <View style={styles.bedBathRow}>
                        <View style={styles.bedBathItem}>
                            <Ionicons name="bed-outline" size={15} color={theme.colors.onSurfaceVariant} />
                            <Text style={styles.bedBathText}>{apartment.bedrooms}</Text>
                        </View>
                        <View style={styles.bedBathDot} />
                        <View style={styles.bedBathItem}>
                            <Ionicons name="water-outline" size={15} color={theme.colors.onSurfaceVariant} />
                            <Text style={styles.bedBathText}>{apartment.bathrooms}</Text>
                        </View>
                    </View>
                </View>

                {/* Bottom row: date, rating, expand indicator */}
                <View style={styles.cardBottomRow}>
                    <View style={styles.availableRow}>
                        <Ionicons name="calendar-outline" size={13} color={theme.colors.onSurfaceVariant} />
                        <Text style={styles.availableText}>{apartment.availableDate}</Text>
                    </View>

                    <StarRating rating={rating} onRate={onRate} />

                    <Ionicons
                        name={expanded ? "chevron-up" : "chevron-down"}
                        size={18}
                        color={theme.colors.onSurfaceVariant}
                    />
                </View>
            </Pressable>

            {/* Expandable detail panel */}
            {expanded && <DetailPanel apartment={apartment} />}
        </View>
    );
}

// --- Main component ---

/** Rental search tracking screen with apartment listings, ratings, and detail panels. */
export function ApartmentHuntingPage() {
    const { theme } = useUnistyles();
    const [expandedId, setExpandedId] = React.useState<number | null>(null);
    const [favorites, setFavorites] = React.useState<Set<number>>(() => new Set([2]));
    const [ratings, setRatings] = React.useState<Record<number, number>>(() => {
        const initial: Record<number, number> = {};
        for (const apt of APARTMENTS) {
            initial[apt.id] = apt.rating;
        }
        return initial;
    });
    const [sortBy, setSortBy] = React.useState<"rent" | "rating" | "commute">("rent");

    const sorted = React.useMemo(() => {
        const copy = [...APARTMENTS];
        switch (sortBy) {
            case "rent":
                copy.sort((a, b) => a.rent - b.rent);
                break;
            case "rating":
                copy.sort((a, b) => (ratings[b.id] ?? 0) - (ratings[a.id] ?? 0));
                break;
            case "commute":
                copy.sort((a, b) => a.commuteMinutes - b.commuteMinutes);
                break;
        }
        return copy;
    }, [sortBy, ratings]);

    const toggleExpand = (id: number) => {
        setExpandedId((prev) => (prev === id ? null : id));
    };

    const toggleFavorite = (id: number) => {
        setFavorites((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleRate = (id: number, value: number) => {
        setRatings((prev) => ({ ...prev, [id]: value }));
    };

    return (
        <ShowcasePage edgeToEdge bottomInset={24}>
            {/* Search criteria summary */}
            <CriteriaSummary criteria={SEARCH_CRITERIA} />

            {/* Stats bar */}
            <StatsBar apartments={APARTMENTS} />

            {/* Sort options */}
            <View style={styles.sortRow}>
                <Text style={styles.sortLabel}>Sort by</Text>
                <View style={styles.sortOptions}>
                    {(["rent", "rating", "commute"] as const).map((option) => {
                        const isActive = sortBy === option;
                        const labels = { rent: "Rent", rating: "Rating", commute: "Commute" };
                        const icons = {
                            rent: "cash-outline",
                            rating: "star-outline",
                            commute: "car-outline"
                        } as const;
                        return (
                            <Pressable
                                key={option}
                                onPress={() => setSortBy(option)}
                                style={[
                                    styles.sortPill,
                                    {
                                        backgroundColor: isActive ? theme.colors.primary : theme.colors.surfaceContainer
                                    }
                                ]}
                            >
                                <Ionicons
                                    name={icons[option]}
                                    size={13}
                                    color={isActive ? "#ffffff" : theme.colors.onSurfaceVariant}
                                />
                                <Text
                                    style={[
                                        styles.sortPillText,
                                        { color: isActive ? "#ffffff" : theme.colors.onSurfaceVariant }
                                    ]}
                                >
                                    {labels[option]}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>
            </View>

            {/* Apartment listings */}
            <View style={styles.listingsContainer}>
                {sorted.map((apartment) => (
                    <ApartmentCard
                        key={apartment.id}
                        apartment={apartment}
                        expanded={expandedId === apartment.id}
                        favorited={favorites.has(apartment.id)}
                        rating={ratings[apartment.id] ?? apartment.rating}
                        onToggleExpand={() => toggleExpand(apartment.id)}
                        onToggleFavorite={() => toggleFavorite(apartment.id)}
                        onRate={(value) => handleRate(apartment.id, value)}
                    />
                ))}
            </View>

            {/* Bottom spacer */}
            <View style={{ height: 40 }} />
        </ShowcasePage>
    );
}

// --- Styles ---

const styles = StyleSheet.create((theme) => ({
    // Criteria summary card
    criteriaCard: {
        marginHorizontal: 16,
        marginTop: 16,
        padding: 16,
        backgroundColor: theme.colors.surfaceContainer,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: theme.colors.outlineVariant
    },
    criteriaHeader: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 8,
        marginBottom: 12
    },
    criteriaTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15,
        color: theme.colors.onSurface
    },
    criteriaGrid: {
        flexDirection: "row" as const,
        gap: 16,
        marginBottom: 12
    },
    criteriaItem: {
        flex: 1,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 6
    },
    criteriaLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        color: theme.colors.onSurfaceVariant
    },
    criteriaValue: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13,
        color: theme.colors.onSurface
    },
    neighborhoodRow: {
        flexDirection: "row" as const,
        alignItems: "flex-start" as const,
        gap: 6,
        paddingTop: 4
    },
    neighborhoodChips: {
        flexDirection: "row" as const,
        flexWrap: "wrap" as const,
        gap: 6,
        flex: 1
    },
    neighborhoodChip: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12
    },
    neighborhoodChipText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 12
    },

    // Stats bar
    statsBar: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "space-around" as const,
        marginHorizontal: 16,
        marginTop: 12,
        paddingVertical: 12,
        paddingHorizontal: 12,
        backgroundColor: theme.colors.surfaceContainer,
        borderRadius: 12
    },
    statItem: {
        alignItems: "center" as const,
        flex: 1
    },
    statValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 18
    },
    statLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11,
        color: theme.colors.onSurfaceVariant,
        marginTop: 2
    },
    statDivider: {
        width: 1,
        height: 28,
        backgroundColor: theme.colors.outlineVariant
    },

    // Sort row
    sortRow: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        marginHorizontal: 16,
        marginTop: 16,
        marginBottom: 4,
        gap: 10
    },
    sortLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        color: theme.colors.onSurfaceVariant
    },
    sortOptions: {
        flexDirection: "row" as const,
        gap: 8
    },
    sortPill: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 5
    },
    sortPillText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 12
    },

    // Apartment card
    listingsContainer: {
        paddingHorizontal: 16,
        marginTop: 12,
        gap: 12
    },
    apartmentCard: {
        backgroundColor: theme.colors.surface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: theme.colors.outlineVariant,
        overflow: "hidden" as const,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2
    },
    accentBar: {
        height: 3,
        width: "100%"
    },
    cardContent: {
        padding: 14
    },

    // Card top row
    cardTopRow: {
        flexDirection: "row" as const,
        alignItems: "flex-start" as const,
        justifyContent: "space-between" as const
    },
    cardAddressBlock: {
        flex: 1,
        marginRight: 12
    },
    addressRow: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 6
    },
    cardAddress: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15,
        color: theme.colors.onSurface,
        flex: 1
    },
    cardNeighborhood: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        color: theme.colors.onSurfaceVariant,
        marginLeft: 22,
        marginTop: 2
    },

    // Metrics row
    metricsRow: {
        flexDirection: "row" as const,
        alignItems: "baseline" as const,
        justifyContent: "space-between" as const,
        marginTop: 10
    },
    rentBlock: {
        flexDirection: "row" as const,
        alignItems: "baseline" as const
    },
    rentAmount: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 22
    },
    rentPeriod: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        color: theme.colors.onSurfaceVariant,
        marginLeft: 2
    },
    bedBathRow: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 6
    },
    bedBathItem: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 4
    },
    bedBathText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 14,
        color: theme.colors.onSurfaceVariant
    },
    bedBathDot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: theme.colors.outlineVariant
    },

    // Bottom row
    cardBottomRow: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "space-between" as const,
        marginTop: 10
    },
    availableRow: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 5
    },
    availableText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        color: theme.colors.onSurfaceVariant
    },
    starRow: {
        flexDirection: "row" as const,
        gap: 3
    },

    // Detail panel
    detailPanel: {
        paddingHorizontal: 14,
        paddingBottom: 14
    },
    detailDivider: {
        height: 1,
        backgroundColor: theme.colors.outlineVariant,
        marginBottom: 12
    },
    detailGrid: {
        flexDirection: "row" as const,
        flexWrap: "wrap" as const,
        gap: 8,
        marginBottom: 14
    },
    detailGridItem: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 5,
        backgroundColor: theme.colors.surfaceContainer,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8
    },
    detailGridLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        color: theme.colors.onSurfaceVariant
    },

    // Pros/cons
    prosConsContainer: {
        flexDirection: "row" as const,
        gap: 16,
        marginBottom: 14
    },
    prosConsColumn: {
        flex: 1
    },
    prosConsTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 12,
        marginBottom: 6
    },
    prosConsRow: {
        flexDirection: "row" as const,
        alignItems: "flex-start" as const,
        gap: 6,
        marginBottom: 4
    },
    prosConsText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        flex: 1,
        lineHeight: 17
    },

    // Detail footer
    detailFooter: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "space-between" as const,
        marginBottom: 10
    },
    brokerSection: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 8
    },
    brokerName: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13,
        color: theme.colors.onSurface
    },
    brokerPhone: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11,
        color: theme.colors.onSurfaceVariant,
        marginTop: 1
    },
    photosLink: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8
    },
    photosLinkText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 12
    },

    // Status badge
    statusRow: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 8,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: theme.colors.outlineVariant
    },
    statusRowLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        color: theme.colors.onSurfaceVariant
    },
    statusBadge: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12
    },
    statusBadgeText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 12
    }
}));
