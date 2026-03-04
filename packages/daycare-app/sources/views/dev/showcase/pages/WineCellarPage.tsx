import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

// --- Types ---

type WineType = "Red" | "White" | "Ros\u00e9" | "Sparkling" | "Dessert";

type Wine = {
    id: string;
    name: string;
    producer: string;
    vintage: number;
    region: string;
    varietal: string;
    type: WineType;
    quantity: number;
    drinkFrom: number;
    drinkTo: number;
    rating: number;
    tastingNotes: string;
    purchasePrice: number;
    currentValue: number;
    servingTempC: number;
};

// --- Constants ---

const WINE_TYPE_COLORS: Record<WineType, string> = {
    Red: "#8B1A1A",
    White: "#C5A427",
    "Ros\u00e9": "#D4708A",
    Sparkling: "#B8860B",
    Dessert: "#CD853F"
};

const WINE_TYPE_ICONS: Record<WineType, keyof typeof Ionicons.glyphMap> = {
    Red: "wine-outline",
    White: "wine-outline",
    "Ros\u00e9": "wine-outline",
    Sparkling: "sparkles-outline",
    Dessert: "heart-outline"
};

// --- Mock data ---

const WINES: Wine[] = [
    {
        id: "1",
        name: "Ch\u00e2teau Margaux",
        producer: "Ch\u00e2teau Margaux",
        vintage: 2015,
        region: "Bordeaux, France",
        varietal: "Cabernet Sauvignon",
        type: "Red",
        quantity: 6,
        drinkFrom: 2025,
        drinkTo: 2060,
        rating: 5,
        tastingNotes:
            "Extraordinarily perfumed with violets, cassis, and graphite. Silky tannins wrap around a core of dark fruit with remarkable length and poise.",
        purchasePrice: 450,
        currentValue: 780,
        servingTempC: 17
    },
    {
        id: "2",
        name: "Opus One",
        producer: "Opus One Winery",
        vintage: 2018,
        region: "Napa Valley, USA",
        varietal: "Bordeaux Blend",
        type: "Red",
        quantity: 3,
        drinkFrom: 2024,
        drinkTo: 2045,
        rating: 4,
        tastingNotes:
            "Rich and layered with blackberry, espresso, and a touch of vanilla. The palate is round with fine-grained tannins and a persistent finish.",
        purchasePrice: 380,
        currentValue: 420,
        servingTempC: 18
    },
    {
        id: "3",
        name: "Barolo Monfortino Riserva",
        producer: "Giacomo Conterno",
        vintage: 2010,
        region: "Piedmont, Italy",
        varietal: "Nebbiolo",
        type: "Red",
        quantity: 2,
        drinkFrom: 2026,
        drinkTo: 2055,
        rating: 5,
        tastingNotes:
            "Ethereal aromas of tar, roses, and dried cherry. The palate is austere yet profoundly complex with iron-clad tannins that unfold over hours.",
        purchasePrice: 520,
        currentValue: 900,
        servingTempC: 17
    },
    {
        id: "4",
        name: "Puligny-Montrachet 1er Cru",
        producer: "Domaine Leflaive",
        vintage: 2020,
        region: "Burgundy, France",
        varietal: "Chardonnay",
        type: "White",
        quantity: 4,
        drinkFrom: 2024,
        drinkTo: 2035,
        rating: 4,
        tastingNotes:
            "Pristine citrus, white peach, and crushed stone. The palate is taut and mineral-driven with a saline finish of remarkable persistence.",
        purchasePrice: 180,
        currentValue: 220,
        servingTempC: 12
    },
    {
        id: "5",
        name: "Cloudy Bay Sauvignon Blanc",
        producer: "Cloudy Bay",
        vintage: 2023,
        region: "Marlborough, NZ",
        varietal: "Sauvignon Blanc",
        type: "White",
        quantity: 12,
        drinkFrom: 2024,
        drinkTo: 2027,
        rating: 3,
        tastingNotes:
            "Vibrant passionfruit, lime zest, and fresh-cut grass. Crisp acidity and a clean, refreshing finish make this a perfect aperitif.",
        purchasePrice: 22,
        currentValue: 24,
        servingTempC: 8
    },
    {
        id: "6",
        name: "Condrieu Les Chaillets",
        producer: "Yves Cuilleron",
        vintage: 2021,
        region: "Rh\u00f4ne Valley, France",
        varietal: "Viognier",
        type: "White",
        quantity: 3,
        drinkFrom: 2023,
        drinkTo: 2030,
        rating: 4,
        tastingNotes:
            "Opulent apricot, honeysuckle, and white pepper. Rich mouthfeel balanced by a subtle mineral backbone and lingering floral notes.",
        purchasePrice: 65,
        currentValue: 72,
        servingTempC: 11
    },
    {
        id: "7",
        name: "Whispering Angel",
        producer: "Ch\u00e2teau d'Esclans",
        vintage: 2023,
        region: "Provence, France",
        varietal: "Grenache Blend",
        type: "Ros\u00e9",
        quantity: 8,
        drinkFrom: 2024,
        drinkTo: 2026,
        rating: 3,
        tastingNotes:
            "Delicate strawberry, white peach, and a hint of garrigue. Light and refreshing with crisp acidity and a dry, clean finish.",
        purchasePrice: 20,
        currentValue: 22,
        servingTempC: 9
    },
    {
        id: "8",
        name: "Bandol Ros\u00e9",
        producer: "Domaine Tempier",
        vintage: 2022,
        region: "Provence, France",
        varietal: "Mourv\u00e8dre",
        type: "Ros\u00e9",
        quantity: 5,
        drinkFrom: 2023,
        drinkTo: 2028,
        rating: 4,
        tastingNotes:
            "Savory and complex with notes of wild herbs, blood orange, and crushed rock. A structured ros\u00e9 with gastronomic ambition.",
        purchasePrice: 35,
        currentValue: 40,
        servingTempC: 10
    },
    {
        id: "9",
        name: "Dom P\u00e9rignon",
        producer: "Mo\u00ebt & Chandon",
        vintage: 2013,
        region: "Champagne, France",
        varietal: "Chardonnay/Pinot Noir",
        type: "Sparkling",
        quantity: 2,
        drinkFrom: 2024,
        drinkTo: 2040,
        rating: 5,
        tastingNotes:
            "Toasted brioche, Meyer lemon, and white flowers. Incredibly fine mousse with a creamy palate and an electrifying, chalky finish.",
        purchasePrice: 200,
        currentValue: 280,
        servingTempC: 8
    },
    {
        id: "10",
        name: "Krug Grande Cuv\u00e9e",
        producer: "Krug",
        vintage: 2014,
        region: "Champagne, France",
        varietal: "Multi-vintage Blend",
        type: "Sparkling",
        quantity: 1,
        drinkFrom: 2024,
        drinkTo: 2035,
        rating: 5,
        tastingNotes:
            "Hazelnut, candied citrus, and toasted almond. Extraordinarily rich and complex with a seemingly endless finish of spice and salinity.",
        purchasePrice: 250,
        currentValue: 310,
        servingTempC: 9
    },
    {
        id: "11",
        name: "Ch\u00e2teau d'Yquem",
        producer: "Ch\u00e2teau d'Yquem",
        vintage: 2009,
        region: "Sauternes, France",
        varietal: "S\u00e9millon/Sauvignon Blanc",
        type: "Dessert",
        quantity: 2,
        drinkFrom: 2020,
        drinkTo: 2070,
        rating: 5,
        tastingNotes:
            "Liquid gold with aromas of saffron, cr\u00e8me br\u00fbl\u00e9e, and dried apricot. Unctuously sweet yet balanced by razor-sharp acidity and endless complexity.",
        purchasePrice: 400,
        currentValue: 650,
        servingTempC: 10
    },
    {
        id: "12",
        name: "Tokaji Asz\u00fa 6 Puttonyos",
        producer: "Royal Tokaji",
        vintage: 2016,
        region: "Tokaj, Hungary",
        varietal: "Furmint",
        type: "Dessert",
        quantity: 3,
        drinkFrom: 2024,
        drinkTo: 2050,
        rating: 4,
        tastingNotes:
            "Intense honey, marmalade, and botrytis-laced tropical fruit. Luscious sweetness counterbalanced by vibrant acidity and a long, spicy finish.",
        purchasePrice: 85,
        currentValue: 110,
        servingTempC: 11
    }
];

const WINE_TYPES: WineType[] = ["Red", "White", "Ros\u00e9", "Sparkling", "Dessert"];

// --- Helpers ---

function groupByType(wines: Wine[]): { type: WineType; wines: Wine[] }[] {
    const groups: { type: WineType; wines: Wine[] }[] = [];
    for (const wineType of WINE_TYPES) {
        const matching = wines.filter((w) => w.type === wineType);
        if (matching.length > 0) {
            groups.push({ type: wineType, wines: matching });
        }
    }
    return groups;
}

function formatCurrency(value: number): string {
    return `$${value.toLocaleString()}`;
}

function drinkWindowLabel(from: number, to: number): string {
    const now = 2026;
    if (now < from) return "Too young";
    if (now > to) return "Past peak";
    if (to - now <= 2) return "Drink now";
    return "In window";
}

function drinkWindowColor(from: number, to: number): string {
    const now = 2026;
    if (now < from) return "#7c3aed";
    if (now > to) return "#dc2626";
    if (to - now <= 2) return "#d97706";
    return "#16a34a";
}

// --- Sub-components ---

function StarRating({ rating, size, color }: { rating: number; size: number; color: string }) {
    return (
        <View style={{ flexDirection: "row", gap: 2 }}>
            {[1, 2, 3, 4, 5].map((i) => (
                <Ionicons key={i} name={i <= rating ? "star" : "star-outline"} size={size} color={color} />
            ))}
        </View>
    );
}

function MetricCard({
    icon,
    value,
    label,
    accentColor
}: {
    icon: keyof typeof Ionicons.glyphMap;
    value: string;
    label: string;
    accentColor: string;
}) {
    const { theme } = useUnistyles();
    return (
        <View style={[styles.metricCard, { backgroundColor: theme.colors.surfaceContainer }]}>
            <View style={[styles.metricIconCircle, { backgroundColor: `${accentColor}18` }]}>
                <Ionicons name={icon} size={20} color={accentColor} />
            </View>
            <Text style={[styles.metricValue, { color: accentColor }]}>{value}</Text>
            <Text style={[styles.metricLabel, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
        </View>
    );
}

function TypeSectionHeader({ wineType, count }: { wineType: WineType; count: number }) {
    const { theme } = useUnistyles();
    const color = WINE_TYPE_COLORS[wineType];
    const icon = WINE_TYPE_ICONS[wineType];

    return (
        <View style={styles.sectionHeader}>
            <View style={[styles.sectionAccent, { backgroundColor: color }]} />
            <Ionicons name={icon} size={18} color={color} />
            <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>{wineType}</Text>
            <View style={[styles.sectionCountBadge, { backgroundColor: `${color}20` }]}>
                <Text style={[styles.sectionCountText, { color }]}>{count}</Text>
            </View>
            <View style={[styles.sectionLine, { backgroundColor: `${color}30` }]} />
        </View>
    );
}

function QuantityBadge({ quantity }: { quantity: number }) {
    const { theme } = useUnistyles();
    const isLow = quantity <= 2;
    const badgeColor = isLow ? "#dc2626" : theme.colors.primary;

    return (
        <View style={[styles.quantityBadge, { backgroundColor: `${badgeColor}18`, borderColor: `${badgeColor}40` }]}>
            <Ionicons name="layers-outline" size={11} color={badgeColor} />
            <Text style={[styles.quantityText, { color: badgeColor }]}>
                {quantity} {quantity === 1 ? "btl" : "btls"}
            </Text>
        </View>
    );
}

function DrinkWindowIndicator({ from, to }: { from: number; to: number }) {
    const label = drinkWindowLabel(from, to);
    const color = drinkWindowColor(from, to);

    return (
        <View style={[styles.drinkWindowBadge, { backgroundColor: `${color}14` }]}>
            <View style={[styles.drinkWindowDot, { backgroundColor: color }]} />
            <Text style={[styles.drinkWindowText, { color }]}>{label}</Text>
        </View>
    );
}

function WineDetailPanel({ wine }: { wine: Wine }) {
    const { theme } = useUnistyles();
    const valueChange = wine.currentValue - wine.purchasePrice;
    const valuePositive = valueChange >= 0;

    return (
        <View
            style={[
                styles.detailPanel,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }
            ]}
        >
            {/* Tasting Notes */}
            <View style={styles.detailSection}>
                <View style={styles.detailSectionHeader}>
                    <Ionicons name="chatbubble-ellipses-outline" size={15} color={theme.colors.tertiary} />
                    <Text style={[styles.detailSectionTitle, { color: theme.colors.onSurface }]}>Tasting Notes</Text>
                </View>
                <Text style={[styles.tastingNotesText, { color: theme.colors.onSurfaceVariant }]}>
                    {wine.tastingNotes}
                </Text>
            </View>

            {/* Pricing */}
            <View style={styles.detailSection}>
                <View style={styles.detailSectionHeader}>
                    <Ionicons name="cash-outline" size={15} color={theme.colors.primary} />
                    <Text style={[styles.detailSectionTitle, { color: theme.colors.onSurface }]}>Valuation</Text>
                </View>
                <View style={styles.priceGrid}>
                    <View style={styles.priceItem}>
                        <Text style={[styles.priceLabel, { color: theme.colors.onSurfaceVariant }]}>Purchase</Text>
                        <Text style={[styles.priceValue, { color: theme.colors.onSurface }]}>
                            {formatCurrency(wine.purchasePrice)}
                        </Text>
                    </View>
                    <View style={styles.priceItem}>
                        <Text style={[styles.priceLabel, { color: theme.colors.onSurfaceVariant }]}>Current</Text>
                        <Text style={[styles.priceValue, { color: theme.colors.onSurface }]}>
                            {formatCurrency(wine.currentValue)}
                        </Text>
                    </View>
                    <View style={styles.priceItem}>
                        <Text style={[styles.priceLabel, { color: theme.colors.onSurfaceVariant }]}>Change</Text>
                        <Text style={[styles.priceValue, { color: valuePositive ? "#16a34a" : "#dc2626" }]}>
                            {valuePositive ? "+" : ""}
                            {formatCurrency(valueChange)}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Serving Temperature */}
            <View style={styles.servingTempRow}>
                <Ionicons name="thermometer-outline" size={16} color={theme.colors.secondary} />
                <Text style={[styles.servingTempLabel, { color: theme.colors.onSurfaceVariant }]}>Serve at</Text>
                <Text style={[styles.servingTempValue, { color: theme.colors.onSurface }]}>
                    {wine.servingTempC}\u00b0C
                </Text>
                <Text style={[styles.servingTempHint, { color: theme.colors.onSurfaceVariant }]}>
                    ({Math.round(wine.servingTempC * 1.8 + 32)}\u00b0F)
                </Text>
            </View>

            {/* Drink Window Detail */}
            <View style={styles.drinkWindowDetailRow}>
                <Ionicons name="calendar-outline" size={16} color={theme.colors.primary} />
                <Text style={[styles.drinkWindowDetailText, { color: theme.colors.onSurfaceVariant }]}>
                    Drink window: {wine.drinkFrom}\u2013{wine.drinkTo}
                </Text>
            </View>
        </View>
    );
}

function WineCard({ wine, expanded, onToggle }: { wine: Wine; expanded: boolean; onToggle: () => void }) {
    const { theme } = useUnistyles();
    const typeColor = WINE_TYPE_COLORS[wine.type];

    return (
        <View
            style={[
                styles.wineCard,
                { backgroundColor: theme.colors.surfaceContainer, borderColor: theme.colors.outlineVariant }
            ]}
        >
            {/* Wine type color strip */}
            <View style={[styles.cardStrip, { backgroundColor: typeColor }]} />

            <Pressable
                onPress={onToggle}
                style={({ pressed }) => [styles.cardPressable, { opacity: pressed ? 0.85 : 1 }]}
            >
                {/* Top row: vintage + name + chevron */}
                <View style={styles.cardTopRow}>
                    <View
                        style={[
                            styles.vintageBadge,
                            { backgroundColor: `${typeColor}14`, borderColor: `${typeColor}30` }
                        ]}
                    >
                        <Text style={[styles.vintageText, { color: typeColor }]}>{wine.vintage}</Text>
                    </View>
                    <View style={styles.cardTitleArea}>
                        <Text style={[styles.wineName, { color: theme.colors.onSurface }]} numberOfLines={1}>
                            {wine.name}
                        </Text>
                        <Text style={[styles.producerText, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
                            {wine.producer}
                        </Text>
                    </View>
                    <Ionicons
                        name={expanded ? "chevron-up" : "chevron-down"}
                        size={20}
                        color={theme.colors.onSurfaceVariant}
                    />
                </View>

                {/* Info row: region, varietal chip, quantity, drink window, rating */}
                <View style={styles.infoRow}>
                    <View style={styles.regionContainer}>
                        <Ionicons name="location-outline" size={12} color={theme.colors.onSurfaceVariant} />
                        <Text style={[styles.regionText, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
                            {wine.region}
                        </Text>
                    </View>
                </View>

                <View style={styles.badgesRow}>
                    {/* Varietal chip */}
                    <View
                        style={[
                            styles.varietalChip,
                            { backgroundColor: `${typeColor}14`, borderColor: `${typeColor}30` }
                        ]}
                    >
                        <Ionicons name="leaf-outline" size={11} color={typeColor} />
                        <Text style={[styles.varietalText, { color: typeColor }]}>{wine.varietal}</Text>
                    </View>

                    <QuantityBadge quantity={wine.quantity} />
                    <DrinkWindowIndicator from={wine.drinkFrom} to={wine.drinkTo} />
                </View>

                {/* Rating */}
                <View style={styles.ratingRow}>
                    <StarRating rating={wine.rating} size={14} color="#d4a017" />
                </View>
            </Pressable>

            {/* Expandable detail */}
            {expanded && <WineDetailPanel wine={wine} />}
        </View>
    );
}

// --- Main Component ---

export function WineCellarPage() {
    const { theme } = useUnistyles();
    const [expandedId, setExpandedId] = React.useState<string | null>(null);

    const totalBottles = React.useMemo(() => WINES.reduce((sum, w) => sum + w.quantity, 0), []);
    const totalValue = React.useMemo(() => WINES.reduce((sum, w) => sum + w.currentValue * w.quantity, 0), []);
    const oldestVintage = React.useMemo(() => Math.min(...WINES.map((w) => w.vintage)), []);
    const varietalsCount = React.useMemo(() => new Set(WINES.map((w) => w.varietal)).size, []);

    const groups = React.useMemo(() => groupByType(WINES), []);

    const handleToggle = React.useCallback((id: string) => {
        setExpandedId((prev) => (prev === id ? null : id));
    }, []);

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: theme.colors.surface }}
            contentContainerStyle={{
                maxWidth: theme.layout.maxWidth,
                width: "100%",
                alignSelf: "center",
                paddingHorizontal: 16,
                paddingBottom: 40
            }}
        >
            {/* Header */}
            <View style={styles.headerSection}>
                <View style={styles.headerTitleRow}>
                    <Ionicons name="wine" size={26} color="#8B1A1A" />
                    <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>Wine Cellar</Text>
                </View>
                <Text style={[styles.headerSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                    {totalBottles} bottles across {groups.length} categories
                </Text>
            </View>

            {/* Metrics */}
            <View style={styles.metricsRow}>
                <MetricCard icon="wine-outline" value={String(totalBottles)} label="Bottles" accentColor="#8B1A1A" />
                <MetricCard
                    icon="cash-outline"
                    value={formatCurrency(totalValue)}
                    label="Total Value"
                    accentColor="#16a34a"
                />
                <MetricCard icon="time-outline" value={String(oldestVintage)} label="Oldest" accentColor="#B8860B" />
                <MetricCard
                    icon="leaf-outline"
                    value={String(varietalsCount)}
                    label="Varietals"
                    accentColor="#7c3aed"
                />
            </View>

            {/* Grouped wine list */}
            <View style={styles.groupsContainer}>
                {groups.map((group) => (
                    <View key={group.type} style={styles.group}>
                        <TypeSectionHeader wineType={group.type} count={group.wines.length} />
                        <View style={styles.wineList}>
                            {group.wines.map((wine) => (
                                <WineCard
                                    key={wine.id}
                                    wine={wine}
                                    expanded={expandedId === wine.id}
                                    onToggle={() => handleToggle(wine.id)}
                                />
                            ))}
                        </View>
                    </View>
                ))}
            </View>

            {/* Empty state */}
            {groups.length === 0 && (
                <View style={styles.emptyState}>
                    <Ionicons name="wine-outline" size={40} color={theme.colors.outlineVariant} />
                    <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                        No wines in your collection
                    </Text>
                </View>
            )}
        </ScrollView>
    );
}

// --- Styles ---

const styles = StyleSheet.create((theme) => ({
    // Header
    headerSection: {
        paddingTop: 24,
        paddingBottom: 16,
        gap: 4
    },
    headerTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10
    },
    headerTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 24
    },
    headerSubtitle: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        marginLeft: 36
    },

    // Metrics
    metricsRow: {
        flexDirection: "row",
        gap: 8,
        marginBottom: 20
    },
    metricCard: {
        flex: 1,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 6,
        alignItems: "center",
        gap: 4
    },
    metricIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center"
    },
    metricValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 16
    },
    metricLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 10
    },

    // Section header
    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    sectionAccent: {
        width: 3,
        height: 20,
        borderRadius: 2
    },
    sectionTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 17
    },
    sectionCountBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10
    },
    sectionCountText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 12
    },
    sectionLine: {
        flex: 1,
        height: 1,
        marginLeft: 4
    },

    // Groups
    groupsContainer: {
        gap: 22
    },
    group: {
        gap: 10
    },
    wineList: {
        gap: 10
    },

    // Wine card
    wineCard: {
        borderRadius: 14,
        overflow: "hidden",
        borderWidth: 1
    },
    cardStrip: {
        height: 3
    },
    cardPressable: {
        padding: 14,
        gap: 8
    },
    cardTopRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10
    },
    vintageBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1
    },
    vintageText: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 14
    },
    cardTitleArea: {
        flex: 1,
        gap: 2
    },
    wineName: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15,
        lineHeight: 20
    },
    producerText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    infoRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    regionContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        flex: 1
    },
    regionText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    badgesRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
        alignItems: "center"
    },
    varietalChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        borderWidth: 1
    },
    varietalText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11
    },
    quantityBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 10,
        borderWidth: 1
    },
    quantityText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11
    },
    drinkWindowBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 10
    },
    drinkWindowDot: {
        width: 6,
        height: 6,
        borderRadius: 3
    },
    drinkWindowText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11
    },
    ratingRow: {
        flexDirection: "row",
        alignItems: "center"
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
    tastingNotesText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 20,
        fontStyle: "italic"
    },
    priceGrid: {
        flexDirection: "row",
        gap: 12
    },
    priceItem: {
        flex: 1,
        gap: 2
    },
    priceLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },
    priceValue: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 14
    },

    // Serving temperature
    servingTempRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6
    },
    servingTempLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13
    },
    servingTempValue: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 14
    },
    servingTempHint: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },

    // Drink window detail
    drinkWindowDetailRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6
    },
    drinkWindowDetailText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13
    },

    // Empty state
    emptyState: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 60,
        gap: 12
    },
    emptyText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14
    }
}));
