import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { ShowcasePage } from "@/views/dev/showcase/components/ShowcasePage";

// --- Types ---

type MealPeriod = "Breakfast" | "Lunch" | "Dinner" | "Drinks";
type Course = "Starters" | "Mains" | "Sides" | "Desserts";
type DietaryTag = "V" | "VG" | "GF" | "DF";
type PopularityBadge = "bestseller" | "new" | "seasonal";

interface MenuItem {
    id: string;
    name: string;
    description: string;
    price: number;
    course: Course;
    mealPeriods: MealPeriod[];
    dietary: DietaryTag[];
    popularity?: PopularityBadge;
    available: boolean;
}

// --- Constants ---

const MEAL_PERIODS: MealPeriod[] = ["Breakfast", "Lunch", "Dinner", "Drinks"];

const MEAL_PERIOD_ICONS: Record<MealPeriod, keyof typeof Ionicons.glyphMap> = {
    Breakfast: "sunny-outline",
    Lunch: "restaurant-outline",
    Dinner: "moon-outline",
    Drinks: "wine-outline"
};

const COURSES: Course[] = ["Starters", "Mains", "Sides", "Desserts"];

const COURSE_ICONS: Record<Course, keyof typeof Ionicons.glyphMap> = {
    Starters: "flame-outline",
    Mains: "fish-outline",
    Sides: "leaf-outline",
    Desserts: "ice-cream-outline"
};

const DIETARY_COLORS: Record<DietaryTag, string> = {
    V: "#16a34a",
    VG: "#059669",
    GF: "#7c3aed",
    DF: "#0891b2"
};

const DIETARY_LABELS: Record<DietaryTag, string> = {
    V: "Vegetarian",
    VG: "Vegan",
    GF: "Gluten Free",
    DF: "Dairy Free"
};

const POPULARITY_CONFIG: Record<
    PopularityBadge,
    { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }
> = {
    bestseller: { label: "Bestseller", color: "#d97706", icon: "star" },
    new: { label: "New", color: "#16a34a", icon: "sparkles" },
    seasonal: { label: "Seasonal", color: "#ea580c", icon: "time-outline" }
};

// --- Mock Data ---

const MENU_ITEMS: MenuItem[] = [
    // Breakfast
    {
        id: "b1",
        name: "Eggs Benedict",
        description: "Poached eggs on toasted English muffin with hollandaise sauce and Canadian bacon",
        price: 16.5,
        course: "Mains",
        mealPeriods: ["Breakfast"],
        dietary: [],
        popularity: "bestseller",
        available: true
    },
    {
        id: "b2",
        name: "Avocado Toast",
        description: "Smashed avocado on sourdough with cherry tomatoes, microgreens, and chili flakes",
        price: 14.0,
        course: "Mains",
        mealPeriods: ["Breakfast"],
        dietary: ["V", "DF"],
        popularity: "new",
        available: true
    },
    {
        id: "b3",
        name: "Acai Bowl",
        description: "Blended acai with banana, granola, fresh berries, coconut flakes, and honey drizzle",
        price: 13.5,
        course: "Mains",
        mealPeriods: ["Breakfast"],
        dietary: ["VG", "GF", "DF"],
        available: true
    },
    {
        id: "b4",
        name: "Breakfast Potatoes",
        description: "Crispy roasted fingerling potatoes with herbs, garlic, and smoked paprika",
        price: 7.0,
        course: "Sides",
        mealPeriods: ["Breakfast"],
        dietary: ["VG", "GF", "DF"],
        available: true
    },
    {
        id: "b5",
        name: "Fresh Fruit Plate",
        description: "Seasonal selection of fresh fruits with a mint garnish and honey yogurt dip",
        price: 9.0,
        course: "Sides",
        mealPeriods: ["Breakfast"],
        dietary: ["V", "GF"],
        popularity: "seasonal",
        available: true
    },
    {
        id: "b6",
        name: "Buttermilk Pancakes",
        description: "Fluffy stack with maple syrup, whipped butter, and fresh blueberries",
        price: 15.0,
        course: "Desserts",
        mealPeriods: ["Breakfast"],
        dietary: ["V"],
        popularity: "bestseller",
        available: true
    },
    // Lunch
    {
        id: "l1",
        name: "Burrata Salad",
        description: "Creamy burrata with heirloom tomatoes, basil oil, and aged balsamic reduction",
        price: 17.0,
        course: "Starters",
        mealPeriods: ["Lunch"],
        dietary: ["V", "GF"],
        popularity: "new",
        available: true
    },
    {
        id: "l2",
        name: "Crispy Calamari",
        description: "Lightly battered calamari with marinara dipping sauce and lemon wedges",
        price: 15.0,
        course: "Starters",
        mealPeriods: ["Lunch", "Dinner"],
        dietary: ["DF"],
        available: true
    },
    {
        id: "l3",
        name: "Wagyu Burger",
        description: "Wagyu patty with aged cheddar, caramelized onions, truffle aioli, and brioche bun",
        price: 24.0,
        course: "Mains",
        mealPeriods: ["Lunch"],
        dietary: [],
        popularity: "bestseller",
        available: true
    },
    {
        id: "l4",
        name: "Grilled Chicken Salad",
        description: "Mixed greens with grilled chicken, avocado, corn, black beans, and lime dressing",
        price: 19.0,
        course: "Mains",
        mealPeriods: ["Lunch"],
        dietary: ["GF", "DF"],
        available: true
    },
    {
        id: "l5",
        name: "Truffle Fries",
        description: "Crispy hand-cut fries tossed with truffle oil, parmesan, and fresh parsley",
        price: 11.0,
        course: "Sides",
        mealPeriods: ["Lunch", "Dinner"],
        dietary: ["V", "GF"],
        popularity: "bestseller",
        available: true
    },
    {
        id: "l6",
        name: "Tiramisu",
        description: "Classic Italian dessert with espresso-soaked ladyfingers and mascarpone cream",
        price: 13.0,
        course: "Desserts",
        mealPeriods: ["Lunch", "Dinner"],
        dietary: ["V"],
        available: false
    },
    // Dinner
    {
        id: "d1",
        name: "Tuna Tartare",
        description: "Yellowfin tuna with avocado, sesame, soy-ginger dressing, and wonton crisps",
        price: 19.0,
        course: "Starters",
        mealPeriods: ["Dinner"],
        dietary: ["GF", "DF"],
        popularity: "new",
        available: true
    },
    {
        id: "d2",
        name: "French Onion Soup",
        description: "Rich beef broth with caramelized onions, topped with gruyere crouton",
        price: 14.0,
        course: "Starters",
        mealPeriods: ["Dinner"],
        dietary: [],
        popularity: "seasonal",
        available: true
    },
    {
        id: "d3",
        name: "Filet Mignon",
        description: "8oz center-cut tenderloin with red wine reduction, roasted garlic, and herb butter",
        price: 48.0,
        course: "Mains",
        mealPeriods: ["Dinner"],
        dietary: ["GF"],
        popularity: "bestseller",
        available: true
    },
    {
        id: "d4",
        name: "Pan-Seared Salmon",
        description: "Atlantic salmon with lemon-dill beurre blanc, asparagus, and wild rice pilaf",
        price: 34.0,
        course: "Mains",
        mealPeriods: ["Dinner"],
        dietary: ["GF"],
        available: true
    },
    {
        id: "d5",
        name: "Wild Mushroom Risotto",
        description: "Arborio rice with porcini, shiitake, and chanterelle mushrooms in truffle cream",
        price: 26.0,
        course: "Mains",
        mealPeriods: ["Dinner"],
        dietary: ["V", "GF"],
        popularity: "seasonal",
        available: true
    },
    {
        id: "d6",
        name: "Roasted Brussels Sprouts",
        description: "Charred brussels sprouts with balsamic glaze, crispy pancetta, and pine nuts",
        price: 12.0,
        course: "Sides",
        mealPeriods: ["Dinner"],
        dietary: ["GF", "DF"],
        available: true
    },
    {
        id: "d7",
        name: "Garlic Mashed Potatoes",
        description: "Yukon gold potatoes whipped with roasted garlic, butter, and cream",
        price: 10.0,
        course: "Sides",
        mealPeriods: ["Dinner"],
        dietary: ["V", "GF"],
        available: true
    },
    {
        id: "d8",
        name: "Creme Brulee",
        description: "Vanilla bean custard with a caramelized sugar crust and fresh raspberries",
        price: 14.0,
        course: "Desserts",
        mealPeriods: ["Dinner"],
        dietary: ["V", "GF"],
        popularity: "bestseller",
        available: true
    },
    {
        id: "d9",
        name: "Chocolate Lava Cake",
        description: "Warm dark chocolate cake with molten center, served with vanilla gelato",
        price: 15.0,
        course: "Desserts",
        mealPeriods: ["Dinner"],
        dietary: ["V"],
        popularity: "new",
        available: false
    },
    // Drinks
    {
        id: "dr1",
        name: "Espresso Martini",
        description: "Vodka, fresh espresso, coffee liqueur, and vanilla syrup shaken over ice",
        price: 16.0,
        course: "Starters",
        mealPeriods: ["Drinks"],
        dietary: ["VG", "GF", "DF"],
        popularity: "bestseller",
        available: true
    },
    {
        id: "dr2",
        name: "Negroni",
        description: "Classic blend of gin, Campari, and sweet vermouth with an orange peel twist",
        price: 15.0,
        course: "Starters",
        mealPeriods: ["Drinks"],
        dietary: ["VG", "GF", "DF"],
        available: true
    },
    {
        id: "dr3",
        name: "Seasonal Sangria",
        description: "House red wine with brandy, fresh citrus, seasonal berries, and sparkling water",
        price: 13.0,
        course: "Mains",
        mealPeriods: ["Drinks"],
        dietary: ["VG", "GF", "DF"],
        popularity: "seasonal",
        available: true
    },
    {
        id: "dr4",
        name: "Craft Lemonade",
        description: "Fresh-squeezed lemonade with lavender syrup, mint, and sparkling water",
        price: 7.0,
        course: "Mains",
        mealPeriods: ["Drinks"],
        dietary: ["VG", "GF", "DF"],
        popularity: "new",
        available: true
    },
    {
        id: "dr5",
        name: "Matcha Latte",
        description: "Ceremonial grade matcha whisked with oat milk and a touch of vanilla",
        price: 8.0,
        course: "Sides",
        mealPeriods: ["Drinks"],
        dietary: ["VG", "GF", "DF"],
        available: true
    }
];

// --- Helpers ---

function formatPrice(amount: number): string {
    return `$${amount.toFixed(2)}`;
}

function groupByCourse(items: MenuItem[]): { course: Course; items: MenuItem[] }[] {
    const groups: { course: Course; items: MenuItem[] }[] = [];
    for (const course of COURSES) {
        const courseItems = items.filter((item) => item.course === course);
        if (courseItems.length > 0) {
            groups.push({ course, items: courseItems });
        }
    }
    return groups;
}

// --- Sub-components ---

function MealPeriodTabs({ active, onSelect }: { active: MealPeriod; onSelect: (period: MealPeriod) => void }) {
    const { theme } = useUnistyles();

    return (
        <View style={[styles.segmentedContainer, { backgroundColor: theme.colors.surfaceContainer }]}>
            {MEAL_PERIODS.map((period) => {
                const isActive = active === period;
                return (
                    <Pressable
                        key={period}
                        onPress={() => onSelect(period)}
                        style={[
                            styles.segmentButton,
                            {
                                backgroundColor: isActive ? theme.colors.primary : "transparent"
                            }
                        ]}
                    >
                        <Ionicons
                            name={MEAL_PERIOD_ICONS[period]}
                            size={15}
                            color={isActive ? theme.colors.onPrimary : theme.colors.onSurfaceVariant}
                        />
                        <Text
                            style={[
                                styles.segmentLabel,
                                {
                                    color: isActive ? theme.colors.onPrimary : theme.colors.onSurfaceVariant
                                }
                            ]}
                        >
                            {period}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

function DietaryChip({ tag }: { tag: DietaryTag }) {
    const color = DIETARY_COLORS[tag];
    return (
        <View
            style={{
                backgroundColor: `${color}18`,
                paddingHorizontal: 7,
                paddingVertical: 2,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: `${color}40`
            }}
        >
            <Text
                style={{
                    fontFamily: "IBMPlexSans-SemiBold",
                    fontSize: 10,
                    color,
                    letterSpacing: 0.3
                }}
            >
                {tag}
            </Text>
        </View>
    );
}

function PopularityTag({ badge }: { badge: PopularityBadge }) {
    const config = POPULARITY_CONFIG[badge];
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: `${config.color}14`,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 10
            }}
        >
            <Ionicons name={config.icon} size={11} color={config.color} />
            <Text
                style={{
                    fontFamily: "IBMPlexSans-Medium",
                    fontSize: 10,
                    color: config.color,
                    letterSpacing: 0.2
                }}
            >
                {config.label}
            </Text>
        </View>
    );
}

function AvailabilityToggle({ available, onToggle }: { available: boolean; onToggle: () => void }) {
    const { theme } = useUnistyles();
    const trackColor = available ? theme.colors.primary : theme.colors.outlineVariant;
    const thumbColor = available ? theme.colors.onPrimary : theme.colors.onSurfaceVariant;

    return (
        <Pressable onPress={onToggle} hitSlop={6}>
            <View style={[styles.toggleTrack, { backgroundColor: trackColor }]}>
                <View
                    style={[
                        styles.toggleThumb,
                        {
                            backgroundColor: thumbColor,
                            transform: [{ translateX: available ? 16 : 2 }]
                        }
                    ]}
                />
            </View>
        </Pressable>
    );
}

function CourseHeader({ course, count }: { course: Course; count: number }) {
    const { theme } = useUnistyles();
    const icon = COURSE_ICONS[course];

    return (
        <View style={styles.courseHeader}>
            <View style={[styles.courseIconCircle, { backgroundColor: `${theme.colors.primary}18` }]}>
                <Ionicons name={icon} size={16} color={theme.colors.primary} />
            </View>
            <Text style={[styles.courseTitle, { color: theme.colors.onSurface }]}>{course}</Text>
            <View style={[styles.courseCountBadge, { backgroundColor: `${theme.colors.primary}18` }]}>
                <Text style={[styles.courseCountText, { color: theme.colors.primary }]}>{count}</Text>
            </View>
            <View style={[styles.courseLine, { backgroundColor: theme.colors.outlineVariant }]} />
        </View>
    );
}

function MenuItemCard({ item, onToggleAvailability }: { item: MenuItem; onToggleAvailability: () => void }) {
    const { theme } = useUnistyles();

    return (
        <View
            style={[
                styles.menuCard,
                {
                    backgroundColor: theme.colors.surfaceContainer,
                    borderColor: theme.colors.outlineVariant,
                    opacity: item.available ? 1 : 0.6
                }
            ]}
        >
            {/* Top section: name, price, toggle */}
            <View style={styles.cardTopRow}>
                <View style={styles.cardNameArea}>
                    <View style={styles.cardNameRow}>
                        <Text style={[styles.itemName, { color: theme.colors.onSurface }]} numberOfLines={1}>
                            {item.name}
                        </Text>
                        {item.popularity && <PopularityTag badge={item.popularity} />}
                    </View>
                    <Text style={[styles.itemDescription, { color: theme.colors.onSurfaceVariant }]} numberOfLines={2}>
                        {item.description}
                    </Text>
                </View>
                <View style={styles.cardPriceCol}>
                    <Text style={[styles.itemPrice, { color: theme.colors.onSurface }]}>{formatPrice(item.price)}</Text>
                </View>
            </View>

            {/* Bottom section: dietary chips + availability */}
            <View style={styles.cardBottomRow}>
                <View style={styles.dietaryRow}>
                    {item.dietary.map((tag) => (
                        <DietaryChip key={tag} tag={tag} />
                    ))}
                    {item.dietary.length === 0 && (
                        <Text
                            style={{
                                fontFamily: "IBMPlexSans-Regular",
                                fontSize: 10,
                                color: theme.colors.outline
                            }}
                        >
                            No dietary tags
                        </Text>
                    )}
                </View>
                <View style={styles.availabilityCol}>
                    <Text
                        style={[
                            styles.availabilityLabel,
                            { color: item.available ? theme.colors.primary : theme.colors.outline }
                        ]}
                    >
                        {item.available ? "Available" : "Unavailable"}
                    </Text>
                    <AvailabilityToggle available={item.available} onToggle={onToggleAvailability} />
                </View>
            </View>
        </View>
    );
}

// --- Main Component ---

export function RestaurantMenuPage() {
    const { theme } = useUnistyles();
    const [activePeriod, setActivePeriod] = React.useState<MealPeriod>("Dinner");
    const [availability, setAvailability] = React.useState<Record<string, boolean>>(() => {
        const map: Record<string, boolean> = {};
        for (const item of MENU_ITEMS) {
            map[item.id] = item.available;
        }
        return map;
    });

    const handleToggleAvailability = React.useCallback((id: string) => {
        setAvailability((prev) => ({ ...prev, [id]: !prev[id] }));
    }, []);

    const filteredItems = React.useMemo(() => {
        return MENU_ITEMS.filter((item) => item.mealPeriods.includes(activePeriod)).map((item) => ({
            ...item,
            available: availability[item.id] ?? item.available
        }));
    }, [activePeriod, availability]);

    const courseGroups = React.useMemo(() => groupByCourse(filteredItems), [filteredItems]);

    const totalItems = filteredItems.length;
    const availableCount = filteredItems.filter((i) => i.available).length;
    const avgPrice = totalItems > 0 ? filteredItems.reduce((sum, i) => sum + i.price, 0) / totalItems : 0;

    return (
        <ShowcasePage style={{ flex: 1, backgroundColor: theme.colors.surface }} bottomInset={48}>
            {/* Header */}
            <View style={styles.headerSection}>
                <View style={styles.headerTitleRow}>
                    <Ionicons name="restaurant" size={24} color={theme.colors.primary} />
                    <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>Menu Management</Text>
                </View>
                <Text style={[styles.headerSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                    Manage items, availability, and pricing
                </Text>
            </View>

            {/* Summary stats */}
            <View style={styles.statsRow}>
                <View style={[styles.statCard, { backgroundColor: theme.colors.surfaceContainer }]}>
                    <Ionicons name="fast-food-outline" size={18} color={theme.colors.primary} />
                    <Text style={[styles.statValue, { color: theme.colors.primary }]}>{totalItems}</Text>
                    <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>Items</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: theme.colors.surfaceContainer }]}>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#16a34a" />
                    <Text style={[styles.statValue, { color: "#16a34a" }]}>{availableCount}</Text>
                    <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>Available</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: theme.colors.surfaceContainer }]}>
                    <Ionicons name="pricetag-outline" size={18} color="#d97706" />
                    <Text style={[styles.statValue, { color: "#d97706" }]}>{formatPrice(avgPrice)}</Text>
                    <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>Avg Price</Text>
                </View>
            </View>

            {/* Dietary legend */}
            <View style={[styles.legendCard, { backgroundColor: theme.colors.surfaceContainer }]}>
                <Text style={[styles.legendTitle, { color: theme.colors.onSurface }]}>Dietary Key</Text>
                <View style={styles.legendRow}>
                    {(["V", "VG", "GF", "DF"] as DietaryTag[]).map((tag) => (
                        <View key={tag} style={styles.legendItem}>
                            <DietaryChip tag={tag} />
                            <Text style={[styles.legendText, { color: theme.colors.onSurfaceVariant }]}>
                                {DIETARY_LABELS[tag]}
                            </Text>
                        </View>
                    ))}
                </View>
            </View>

            {/* Meal period tabs */}
            <MealPeriodTabs active={activePeriod} onSelect={setActivePeriod} />

            {/* Course groups */}
            <View style={styles.groupsContainer}>
                {courseGroups.map((group) => (
                    <View key={group.course} style={styles.courseGroup}>
                        <CourseHeader course={group.course} count={group.items.length} />
                        <View style={styles.itemsList}>
                            {group.items.map((item) => (
                                <MenuItemCard
                                    key={item.id}
                                    item={item}
                                    onToggleAvailability={() => handleToggleAvailability(item.id)}
                                />
                            ))}
                        </View>
                    </View>
                ))}
            </View>

            {/* Empty state */}
            {courseGroups.length === 0 && (
                <View style={styles.emptyState}>
                    <Ionicons name="search-outline" size={40} color={theme.colors.outlineVariant} />
                    <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                        No menu items for this meal period
                    </Text>
                </View>
            )}
        </ShowcasePage>
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
        marginLeft: 34
    },

    // Stats row
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

    // Dietary legend
    legendCard: {
        borderRadius: 12,
        padding: 14,
        marginBottom: 16,
        gap: 10
    },
    legendTitle: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 12,
        letterSpacing: 0.3,
        textTransform: "uppercase"
    },
    legendRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12
    },
    legendItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5
    },
    legendText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },

    // Segmented control
    segmentedContainer: {
        flexDirection: "row",
        borderRadius: 12,
        padding: 4,
        gap: 2,
        marginBottom: 20
    },
    segmentButton: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        paddingVertical: 9,
        borderRadius: 10
    },
    segmentLabel: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 12
    },

    // Course header
    courseHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    courseIconCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center"
    },
    courseTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 16
    },
    courseCountBadge: {
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: "center",
        justifyContent: "center"
    },
    courseCountText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 11
    },
    courseLine: {
        flex: 1,
        height: 1,
        marginLeft: 8
    },

    // Course groups
    groupsContainer: {
        gap: 22
    },
    courseGroup: {
        gap: 10
    },
    itemsList: {
        gap: 10
    },

    // Menu item card
    menuCard: {
        borderRadius: 14,
        borderWidth: 1,
        padding: 14,
        gap: 12
    },
    cardTopRow: {
        flexDirection: "row",
        gap: 12
    },
    cardNameArea: {
        flex: 1,
        gap: 4
    },
    cardNameRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap"
    },
    itemName: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15,
        lineHeight: 20
    },
    itemDescription: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        lineHeight: 17
    },
    cardPriceCol: {
        alignItems: "flex-end",
        paddingTop: 1
    },
    itemPrice: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 16,
        letterSpacing: -0.3
    },
    cardBottomRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between"
    },
    dietaryRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 5,
        flex: 1
    },
    availabilityCol: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginLeft: 12
    },
    availabilityLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },

    // Toggle
    toggleTrack: {
        width: 36,
        height: 20,
        borderRadius: 10,
        justifyContent: "center"
    },
    toggleThumb: {
        width: 16,
        height: 16,
        borderRadius: 8
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
