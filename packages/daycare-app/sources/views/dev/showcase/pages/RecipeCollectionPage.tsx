import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

// --- Types ---

type MealType = "All" | "Breakfast" | "Lunch" | "Dinner" | "Snacks";
type Difficulty = "easy" | "medium" | "hard";
type DietaryTag = "vegetarian" | "gluten-free" | "dairy-free";
type Cuisine = "Italian" | "Mexican" | "Japanese" | "Indian" | "American" | "Thai";

type Recipe = {
    id: string;
    name: string;
    mealType: Exclude<MealType, "All">;
    cuisine: Cuisine;
    prepTime: number;
    cookTime: number;
    difficulty: Difficulty;
    dietary: DietaryTag[];
    servings: number;
    ingredients: { name: string; amount: string }[];
    steps: string[];
};

// --- Constants ---

const MEAL_TYPES: MealType[] = ["All", "Breakfast", "Lunch", "Dinner", "Snacks"];

const MEAL_ICONS: Record<MealType, keyof typeof Ionicons.glyphMap> = {
    All: "grid-outline",
    Breakfast: "sunny-outline",
    Lunch: "restaurant-outline",
    Dinner: "moon-outline",
    Snacks: "cafe-outline"
};

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
    easy: "#16a34a",
    medium: "#d97706",
    hard: "#dc2626"
};

const DIETARY_COLORS: Record<DietaryTag, string> = {
    vegetarian: "#16a34a",
    "gluten-free": "#7c3aed",
    "dairy-free": "#0891b2"
};

const DIETARY_ICONS: Record<DietaryTag, keyof typeof Ionicons.glyphMap> = {
    vegetarian: "leaf-outline",
    "gluten-free": "nutrition-outline",
    "dairy-free": "water-outline"
};

const CUISINE_COLORS: Record<Cuisine, string> = {
    Italian: "#dc2626",
    Mexican: "#ea580c",
    Japanese: "#db2777",
    Indian: "#d97706",
    American: "#2563eb",
    Thai: "#059669"
};

// --- Mock data ---

const RECIPES: Recipe[] = [
    {
        id: "1",
        name: "Avocado Toast with Poached Eggs",
        mealType: "Breakfast",
        cuisine: "American",
        prepTime: 5,
        cookTime: 10,
        difficulty: "easy",
        dietary: ["vegetarian"],
        servings: 2,
        ingredients: [
            { name: "Sourdough bread", amount: "2 slices" },
            { name: "Ripe avocado", amount: "1 large" },
            { name: "Eggs", amount: "2" },
            { name: "Lemon juice", amount: "1 tsp" },
            { name: "Red pepper flakes", amount: "pinch" },
            { name: "Salt & pepper", amount: "to taste" }
        ],
        steps: [
            "Toast the sourdough bread until golden and crispy.",
            "Halve the avocado, remove the pit, and mash with lemon juice, salt, and pepper.",
            "Bring a pot of water to a gentle simmer and add a splash of vinegar.",
            "Crack each egg into a small cup and gently slide into the simmering water.",
            "Poach for 3-4 minutes until whites are set but yolks are still runny.",
            "Spread mashed avocado on toast, top with poached eggs, and sprinkle with red pepper flakes."
        ]
    },
    {
        id: "2",
        name: "Margherita Pizza",
        mealType: "Dinner",
        cuisine: "Italian",
        prepTime: 20,
        cookTime: 15,
        difficulty: "medium",
        dietary: ["vegetarian"],
        servings: 4,
        ingredients: [
            { name: "Pizza dough", amount: "500g" },
            { name: "San Marzano tomatoes", amount: "400g can" },
            { name: "Fresh mozzarella", amount: "250g" },
            { name: "Fresh basil", amount: "1 bunch" },
            { name: "Olive oil", amount: "2 tbsp" },
            { name: "Salt", amount: "1 tsp" }
        ],
        steps: [
            "Preheat oven to 250C (480F) with a pizza stone or inverted baking sheet inside.",
            "Crush tomatoes by hand with salt to make the sauce.",
            "Stretch dough on a floured surface into a 12-inch circle.",
            "Spread a thin layer of tomato sauce, leaving a 1-inch border.",
            "Tear mozzarella into pieces and distribute evenly.",
            "Bake for 12-15 minutes until crust is golden and cheese is bubbly.",
            "Top with fresh basil leaves and a drizzle of olive oil before serving."
        ]
    },
    {
        id: "3",
        name: "Chicken Pad Thai",
        mealType: "Dinner",
        cuisine: "Thai",
        prepTime: 15,
        cookTime: 15,
        difficulty: "medium",
        dietary: ["gluten-free", "dairy-free"],
        servings: 3,
        ingredients: [
            { name: "Rice noodles", amount: "250g" },
            { name: "Chicken breast", amount: "300g" },
            { name: "Eggs", amount: "2" },
            { name: "Bean sprouts", amount: "1 cup" },
            { name: "Fish sauce", amount: "3 tbsp" },
            { name: "Tamarind paste", amount: "2 tbsp" },
            { name: "Crushed peanuts", amount: "1/4 cup" },
            { name: "Lime", amount: "1" }
        ],
        steps: [
            "Soak rice noodles in warm water for 20 minutes, then drain.",
            "Mix fish sauce, tamarind paste, and sugar for the sauce.",
            "Stir-fry sliced chicken in a hot wok until cooked through.",
            "Push chicken aside, scramble eggs in the same wok.",
            "Add noodles and sauce, toss everything together for 2-3 minutes.",
            "Add bean sprouts, toss briefly, then serve with crushed peanuts and lime wedges."
        ]
    },
    {
        id: "4",
        name: "Japanese Onigiri",
        mealType: "Snacks",
        cuisine: "Japanese",
        prepTime: 10,
        cookTime: 0,
        difficulty: "easy",
        dietary: ["gluten-free", "dairy-free"],
        servings: 6,
        ingredients: [
            { name: "Sushi rice (cooked)", amount: "3 cups" },
            { name: "Nori sheets", amount: "3" },
            { name: "Salmon flakes", amount: "1/2 cup" },
            { name: "Salt", amount: "1 tsp" },
            { name: "Sesame seeds", amount: "1 tbsp" }
        ],
        steps: [
            "Season cooked sushi rice with salt while still warm.",
            "Wet your hands with salted water to prevent sticking.",
            "Place a scoop of rice in your palm, make a small well, and add salmon filling.",
            "Shape into a triangle by pressing firmly but gently with both hands.",
            "Wrap the base with a strip of nori.",
            "Sprinkle with sesame seeds and serve at room temperature."
        ]
    },
    {
        id: "5",
        name: "Tacos al Pastor",
        mealType: "Lunch",
        cuisine: "Mexican",
        prepTime: 30,
        cookTime: 20,
        difficulty: "hard",
        dietary: ["dairy-free"],
        servings: 4,
        ingredients: [
            { name: "Pork shoulder", amount: "500g" },
            { name: "Pineapple", amount: "4 slices" },
            { name: "Dried guajillo chiles", amount: "4" },
            { name: "Corn tortillas", amount: "12 small" },
            { name: "White onion", amount: "1" },
            { name: "Cilantro", amount: "1 bunch" },
            { name: "Lime", amount: "2" },
            { name: "Achiote paste", amount: "2 tbsp" }
        ],
        steps: [
            "Rehydrate guajillo chiles in hot water for 15 minutes, then blend with achiote paste.",
            "Slice pork thinly, coat in the chile marinade, and refrigerate for at least 1 hour.",
            "Grill pineapple slices until charred on both sides, then dice.",
            "Cook marinated pork on high heat in batches until charred and cooked through.",
            "Warm tortillas on a dry skillet until pliable.",
            "Assemble tacos with pork, diced pineapple, onion, cilantro, and lime juice."
        ]
    },
    {
        id: "6",
        name: "Palak Paneer",
        mealType: "Dinner",
        cuisine: "Indian",
        prepTime: 15,
        cookTime: 25,
        difficulty: "medium",
        dietary: ["vegetarian", "gluten-free"],
        servings: 4,
        ingredients: [
            { name: "Paneer", amount: "300g" },
            { name: "Fresh spinach", amount: "500g" },
            { name: "Onion", amount: "1 large" },
            { name: "Garlic cloves", amount: "4" },
            { name: "Ginger", amount: "1 inch" },
            { name: "Green chili", amount: "2" },
            { name: "Cream", amount: "3 tbsp" },
            { name: "Garam masala", amount: "1 tsp" }
        ],
        steps: [
            "Blanch spinach in boiling water for 2 minutes, then transfer to ice water.",
            "Blend blanched spinach into a smooth puree.",
            "Saute diced onion until golden, then add minced garlic, ginger, and green chili.",
            "Add spinach puree, garam masala, and salt. Simmer for 10 minutes.",
            "Cube paneer and pan-fry until golden on all sides.",
            "Add paneer to the spinach gravy, stir in cream, and simmer for 5 more minutes."
        ]
    },
    {
        id: "7",
        name: "Granola Parfait",
        mealType: "Breakfast",
        cuisine: "American",
        prepTime: 5,
        cookTime: 0,
        difficulty: "easy",
        dietary: ["vegetarian", "gluten-free"],
        servings: 1,
        ingredients: [
            { name: "Greek yogurt", amount: "1 cup" },
            { name: "Granola", amount: "1/2 cup" },
            { name: "Mixed berries", amount: "1/2 cup" },
            { name: "Honey", amount: "1 tbsp" },
            { name: "Chia seeds", amount: "1 tsp" }
        ],
        steps: [
            "Layer half the yogurt in the bottom of a glass or bowl.",
            "Add a layer of granola and half the mixed berries.",
            "Add the remaining yogurt on top.",
            "Finish with remaining berries, a drizzle of honey, and chia seeds."
        ]
    },
    {
        id: "8",
        name: "Chicken Caesar Wrap",
        mealType: "Lunch",
        cuisine: "American",
        prepTime: 10,
        cookTime: 12,
        difficulty: "easy",
        dietary: [],
        servings: 2,
        ingredients: [
            { name: "Flour tortillas", amount: "2 large" },
            { name: "Grilled chicken breast", amount: "200g" },
            { name: "Romaine lettuce", amount: "2 cups" },
            { name: "Parmesan cheese", amount: "1/4 cup" },
            { name: "Caesar dressing", amount: "3 tbsp" },
            { name: "Croutons", amount: "1/4 cup" }
        ],
        steps: [
            "Season chicken with salt and pepper, grill until internal temp reaches 74C.",
            "Let chicken rest for 5 minutes, then slice into thin strips.",
            "Toss chopped romaine with Caesar dressing and shaved parmesan.",
            "Lay tortilla flat, arrange dressed lettuce and chicken strips in center.",
            "Sprinkle croutons on top, fold in sides, and roll tightly.",
            "Slice diagonally and serve immediately."
        ]
    },
    {
        id: "9",
        name: "Miso Ramen",
        mealType: "Dinner",
        cuisine: "Japanese",
        prepTime: 15,
        cookTime: 30,
        difficulty: "hard",
        dietary: ["dairy-free"],
        servings: 2,
        ingredients: [
            { name: "Ramen noodles", amount: "200g" },
            { name: "White miso paste", amount: "3 tbsp" },
            { name: "Chicken broth", amount: "4 cups" },
            { name: "Soft-boiled eggs", amount: "2" },
            { name: "Chashu pork", amount: "6 slices" },
            { name: "Corn kernels", amount: "1/4 cup" },
            { name: "Green onions", amount: "2 stalks" },
            { name: "Nori", amount: "2 sheets" }
        ],
        steps: [
            "Bring chicken broth to a simmer and dissolve miso paste into it.",
            "Prepare soft-boiled eggs: boil for 6.5 minutes, then ice bath.",
            "Cook ramen noodles according to package directions, drain well.",
            "Sear chashu pork slices in a hot pan until caramelized.",
            "Divide noodles between bowls, ladle hot miso broth over them.",
            "Top with halved soft-boiled egg, chashu, corn, sliced green onions, and nori."
        ]
    },
    {
        id: "10",
        name: "Bruschetta al Pomodoro",
        mealType: "Snacks",
        cuisine: "Italian",
        prepTime: 10,
        cookTime: 5,
        difficulty: "easy",
        dietary: ["vegetarian", "dairy-free"],
        servings: 4,
        ingredients: [
            { name: "Ciabatta bread", amount: "1 loaf" },
            { name: "Roma tomatoes", amount: "4" },
            { name: "Fresh basil", amount: "8 leaves" },
            { name: "Garlic cloves", amount: "2" },
            { name: "Extra virgin olive oil", amount: "3 tbsp" },
            { name: "Balsamic vinegar", amount: "1 tbsp" }
        ],
        steps: [
            "Dice tomatoes, combine with torn basil, olive oil, balsamic vinegar, salt and pepper.",
            "Let the tomato mixture sit for 10 minutes to meld flavors.",
            "Slice ciabatta into 1-inch thick pieces and toast until golden.",
            "Rub each toast with a cut garlic clove while still warm.",
            "Spoon the tomato mixture generously onto each toast.",
            "Drizzle with a little more olive oil and serve immediately."
        ]
    },
    {
        id: "11",
        name: "Butter Chicken",
        mealType: "Dinner",
        cuisine: "Indian",
        prepTime: 20,
        cookTime: 35,
        difficulty: "hard",
        dietary: ["gluten-free"],
        servings: 4,
        ingredients: [
            { name: "Chicken thighs", amount: "600g" },
            { name: "Yogurt", amount: "1/2 cup" },
            { name: "Tomato puree", amount: "400g" },
            { name: "Butter", amount: "3 tbsp" },
            { name: "Heavy cream", amount: "1/2 cup" },
            { name: "Garam masala", amount: "2 tsp" },
            { name: "Kasuri methi", amount: "1 tbsp" },
            { name: "Garlic-ginger paste", amount: "2 tbsp" }
        ],
        steps: [
            "Marinate chicken in yogurt, garam masala, and salt for at least 30 minutes.",
            "Grill or pan-sear marinated chicken until lightly charred.",
            "Melt butter in a deep pan, saute garlic-ginger paste until fragrant.",
            "Add tomato puree and simmer for 15 minutes until reduced and thickened.",
            "Add grilled chicken pieces and cream, simmer for 10 more minutes.",
            "Crush kasuri methi between palms and stir in. Adjust seasoning and serve with naan."
        ]
    },
    {
        id: "12",
        name: "Guacamole & Chips",
        mealType: "Snacks",
        cuisine: "Mexican",
        prepTime: 10,
        cookTime: 0,
        difficulty: "easy",
        dietary: ["vegetarian", "gluten-free", "dairy-free"],
        servings: 4,
        ingredients: [
            { name: "Ripe avocados", amount: "3" },
            { name: "Lime juice", amount: "2 tbsp" },
            { name: "Red onion", amount: "1/4 cup diced" },
            { name: "Jalapeno", amount: "1 small" },
            { name: "Cilantro", amount: "2 tbsp chopped" },
            { name: "Tortilla chips", amount: "1 bag" }
        ],
        steps: [
            "Halve avocados, remove pits, and scoop flesh into a bowl.",
            "Mash with a fork to desired consistency (chunky or smooth).",
            "Add lime juice, diced red onion, minced jalapeno, cilantro, and salt.",
            "Mix gently and taste for seasoning.",
            "Serve immediately with tortilla chips."
        ]
    }
];

// --- Helper: group recipes by cuisine ---

function groupByCuisine(recipes: Recipe[]): { cuisine: Cuisine; recipes: Recipe[] }[] {
    const map = new Map<Cuisine, Recipe[]>();
    for (const recipe of recipes) {
        const list = map.get(recipe.cuisine) ?? [];
        list.push(recipe);
        map.set(recipe.cuisine, list);
    }
    return Array.from(map.entries()).map(([cuisine, recs]) => ({ cuisine, recipes: recs }));
}

// --- Sub-components ---

function DifficultyChip({ difficulty }: { difficulty: Difficulty }) {
    const color = DIFFICULTY_COLORS[difficulty];
    return (
        <View
            style={{
                backgroundColor: `${color}18`,
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: `${color}40`
            }}
        >
            <Text style={{ fontFamily: "IBMPlexSans-Medium", fontSize: 11, color }}>
                {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
            </Text>
        </View>
    );
}

function DietaryBadge({ tag }: { tag: DietaryTag }) {
    const color = DIETARY_COLORS[tag];
    const icon = DIETARY_ICONS[tag];
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 3,
                backgroundColor: `${color}14`,
                paddingHorizontal: 7,
                paddingVertical: 2,
                borderRadius: 10
            }}
        >
            <Ionicons name={icon} size={11} color={color} />
            <Text style={{ fontFamily: "IBMPlexSans-Regular", fontSize: 10, color }}>{tag}</Text>
        </View>
    );
}

function TimeIndicator({ minutes, label, color }: { minutes: number; label: string; color: string }) {
    return (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Ionicons name="time-outline" size={13} color={color} />
            <Text style={{ fontFamily: "IBMPlexMono-Regular", fontSize: 11, color }}>
                {minutes > 0 ? `${minutes}m` : "--"}
            </Text>
            <Text style={{ fontFamily: "IBMPlexSans-Regular", fontSize: 10, color, opacity: 0.7 }}>{label}</Text>
        </View>
    );
}

function CuisineHeader({ cuisine }: { cuisine: Cuisine; count: number }) {
    const { theme } = useUnistyles();
    const color = CUISINE_COLORS[cuisine];

    return (
        <View style={styles.cuisineHeader}>
            <View style={[styles.cuisineAccent, { backgroundColor: color }]} />
            <Ionicons name="flag-outline" size={16} color={color} />
            <Text style={[styles.cuisineTitle, { color: theme.colors.onSurface }]}>{cuisine}</Text>
            <View style={[styles.cuisineLine, { backgroundColor: `${color}30` }]} />
        </View>
    );
}

function SegmentedControl({ active, onSelect }: { active: MealType; onSelect: (tab: MealType) => void }) {
    const { theme } = useUnistyles();

    return (
        <View style={[styles.segmentedContainer, { backgroundColor: theme.colors.surfaceContainer }]}>
            {MEAL_TYPES.map((type) => {
                const isActive = active === type;
                return (
                    <Pressable
                        key={type}
                        onPress={() => onSelect(type)}
                        style={[
                            styles.segmentButton,
                            {
                                backgroundColor: isActive ? theme.colors.primary : "transparent"
                            }
                        ]}
                    >
                        <Ionicons
                            name={MEAL_ICONS[type]}
                            size={14}
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
                            {type}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

function IngredientCheckbox({
    ingredient,
    checked,
    onToggle
}: {
    ingredient: { name: string; amount: string };
    checked: boolean;
    onToggle: () => void;
}) {
    const { theme } = useUnistyles();

    return (
        <Pressable onPress={onToggle} style={styles.ingredientRow}>
            <View
                style={[
                    styles.checkbox,
                    {
                        borderColor: checked ? theme.colors.primary : theme.colors.outline,
                        backgroundColor: checked ? theme.colors.primary : "transparent"
                    }
                ]}
            >
                {checked && <Ionicons name="checkmark" size={12} color={theme.colors.onPrimary} />}
            </View>
            <Text
                style={[
                    styles.ingredientName,
                    {
                        color: checked ? theme.colors.onSurfaceVariant : theme.colors.onSurface,
                        textDecorationLine: checked ? "line-through" : "none"
                    }
                ]}
            >
                {ingredient.name}
            </Text>
            <Text style={[styles.ingredientAmount, { color: theme.colors.onSurfaceVariant }]}>{ingredient.amount}</Text>
        </Pressable>
    );
}

function RecipeDetail({
    recipe,
    checkedIngredients,
    onToggleIngredient
}: {
    recipe: Recipe;
    checkedIngredients: Set<number>;
    onToggleIngredient: (index: number) => void;
}) {
    const { theme } = useUnistyles();

    return (
        <View
            style={[
                styles.detailPanel,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }
            ]}
        >
            {/* Serving size */}
            <View style={styles.servingRow}>
                <Ionicons name="people-outline" size={16} color={theme.colors.primary} />
                <Text style={[styles.servingText, { color: theme.colors.onSurface }]}>Serves {recipe.servings}</Text>
            </View>

            {/* Ingredients */}
            <View style={styles.detailSection}>
                <View style={styles.detailSectionHeader}>
                    <Ionicons name="list-outline" size={16} color={theme.colors.tertiary} />
                    <Text style={[styles.detailSectionTitle, { color: theme.colors.onSurface }]}>Ingredients</Text>
                    <Text style={[styles.detailSectionCount, { color: theme.colors.onSurfaceVariant }]}>
                        {checkedIngredients.size}/{recipe.ingredients.length}
                    </Text>
                </View>
                {recipe.ingredients.map((ing, i) => (
                    <IngredientCheckbox
                        key={`${recipe.id}-ing-${i}`}
                        ingredient={ing}
                        checked={checkedIngredients.has(i)}
                        onToggle={() => onToggleIngredient(i)}
                    />
                ))}
            </View>

            {/* Steps */}
            <View style={styles.detailSection}>
                <View style={styles.detailSectionHeader}>
                    <Ionicons name="footsteps-outline" size={16} color={theme.colors.secondary} />
                    <Text style={[styles.detailSectionTitle, { color: theme.colors.onSurface }]}>Instructions</Text>
                </View>
                {recipe.steps.map((step, i) => (
                    <View key={`${recipe.id}-step-${i}`} style={styles.stepRow}>
                        <View style={[styles.stepNumber, { backgroundColor: `${theme.colors.primary}18` }]}>
                            <Text style={[styles.stepNumberText, { color: theme.colors.primary }]}>{i + 1}</Text>
                        </View>
                        <Text style={[styles.stepText, { color: theme.colors.onSurface }]}>{step}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

function RecipeCard({
    recipe,
    expanded,
    onToggle,
    checkedIngredients,
    onToggleIngredient
}: {
    recipe: Recipe;
    expanded: boolean;
    onToggle: () => void;
    checkedIngredients: Set<number>;
    onToggleIngredient: (index: number) => void;
}) {
    const { theme } = useUnistyles();
    const cuisineColor = CUISINE_COLORS[recipe.cuisine];
    const totalTime = recipe.prepTime + recipe.cookTime;

    return (
        <View
            style={[
                styles.recipeCard,
                { backgroundColor: theme.colors.surfaceContainer, borderColor: theme.colors.outlineVariant }
            ]}
        >
            {/* Color strip at top */}
            <View style={[styles.cardStrip, { backgroundColor: cuisineColor }]} />

            <Pressable
                onPress={onToggle}
                style={({ pressed }) => [styles.cardPressable, { opacity: pressed ? 0.85 : 1 }]}
            >
                {/* Top row: name + expand icon */}
                <View style={styles.cardTopRow}>
                    <View style={styles.cardTitleArea}>
                        <Text style={[styles.recipeName, { color: theme.colors.onSurface }]} numberOfLines={2}>
                            {recipe.name}
                        </Text>
                    </View>
                    <Ionicons
                        name={expanded ? "chevron-up" : "chevron-down"}
                        size={20}
                        color={theme.colors.onSurfaceVariant}
                    />
                </View>

                {/* Time indicators */}
                <View style={styles.timeRow}>
                    <TimeIndicator minutes={recipe.prepTime} label="prep" color={theme.colors.onSurfaceVariant} />
                    <TimeIndicator minutes={recipe.cookTime} label="cook" color={theme.colors.onSurfaceVariant} />
                    <View style={styles.timeDivider} />
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                        <Ionicons name="hourglass-outline" size={13} color={theme.colors.primary} />
                        <Text style={[styles.totalTime, { color: theme.colors.primary }]}>{totalTime}m</Text>
                    </View>
                </View>

                {/* Badges row: difficulty + dietary */}
                <View style={styles.badgesRow}>
                    <DifficultyChip difficulty={recipe.difficulty} />
                    {recipe.dietary.map((tag) => (
                        <DietaryBadge key={tag} tag={tag} />
                    ))}
                </View>
            </Pressable>

            {/* Expandable detail */}
            {expanded && (
                <RecipeDetail
                    recipe={recipe}
                    checkedIngredients={checkedIngredients}
                    onToggleIngredient={onToggleIngredient}
                />
            )}
        </View>
    );
}

// --- Main Component ---

export function RecipeCollectionPage() {
    const { theme } = useUnistyles();
    const [activeMeal, setActiveMeal] = React.useState<MealType>("All");
    const [expandedId, setExpandedId] = React.useState<string | null>(null);
    const [checkedMap, setCheckedMap] = React.useState<Record<string, Set<number>>>({});

    const filteredRecipes = React.useMemo(() => {
        if (activeMeal === "All") return RECIPES;
        return RECIPES.filter((r) => r.mealType === activeMeal);
    }, [activeMeal]);

    const groups = React.useMemo(() => groupByCuisine(filteredRecipes), [filteredRecipes]);

    const totalRecipes = filteredRecipes.length;
    const easyCount = filteredRecipes.filter((r) => r.difficulty === "easy").length;
    const vegCount = filteredRecipes.filter((r) => r.dietary.includes("vegetarian")).length;

    const handleToggle = React.useCallback((id: string) => {
        setExpandedId((prev) => (prev === id ? null : id));
    }, []);

    const handleIngredientToggle = React.useCallback((recipeId: string, index: number) => {
        setCheckedMap((prev) => {
            const current = prev[recipeId] ?? new Set<number>();
            const next = new Set(current);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
            return { ...prev, [recipeId]: next };
        });
    }, []);

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: theme.colors.surface }}
            contentContainerStyle={{
                maxWidth: 600,
                width: "100%",
                alignSelf: "center",
                paddingHorizontal: 16,
                paddingBottom: 40
            }}
        >
            {/* Header area */}
            <View style={styles.headerSection}>
                <View style={styles.headerTitleRow}>
                    <Ionicons name="restaurant" size={24} color={theme.colors.primary} />
                    <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>Recipe Collection</Text>
                </View>
                <Text style={[styles.headerSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                    {totalRecipes} recipes across {groups.length} cuisines
                </Text>
            </View>

            {/* Quick stats row */}
            <View style={styles.statsRow}>
                <View style={[styles.statCard, { backgroundColor: theme.colors.surfaceContainer }]}>
                    <Ionicons name="book-outline" size={18} color={theme.colors.primary} />
                    <Text style={[styles.statValue, { color: theme.colors.primary }]}>{totalRecipes}</Text>
                    <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>Recipes</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: theme.colors.surfaceContainer }]}>
                    <Ionicons name="flash-outline" size={18} color={DIFFICULTY_COLORS.easy} />
                    <Text style={[styles.statValue, { color: DIFFICULTY_COLORS.easy }]}>{easyCount}</Text>
                    <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>Quick & Easy</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: theme.colors.surfaceContainer }]}>
                    <Ionicons name="leaf-outline" size={18} color={DIETARY_COLORS.vegetarian} />
                    <Text style={[styles.statValue, { color: DIETARY_COLORS.vegetarian }]}>{vegCount}</Text>
                    <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>Vegetarian</Text>
                </View>
            </View>

            {/* Segmented control */}
            <SegmentedControl active={activeMeal} onSelect={setActiveMeal} />

            {/* Grouped recipe list */}
            <View style={styles.groupsContainer}>
                {groups.map((group) => (
                    <View key={group.cuisine} style={styles.group}>
                        <CuisineHeader cuisine={group.cuisine} count={group.recipes.length} />
                        <View style={styles.recipeList}>
                            {group.recipes.map((recipe) => (
                                <RecipeCard
                                    key={recipe.id}
                                    recipe={recipe}
                                    expanded={expandedId === recipe.id}
                                    onToggle={() => handleToggle(recipe.id)}
                                    checkedIngredients={checkedMap[recipe.id] ?? new Set()}
                                    onToggleIngredient={(index) => handleIngredientToggle(recipe.id, index)}
                                />
                            ))}
                        </View>
                    </View>
                ))}
            </View>

            {/* Empty state */}
            {groups.length === 0 && (
                <View style={styles.emptyState}>
                    <Ionicons name="search-outline" size={40} color={theme.colors.outlineVariant} />
                    <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                        No recipes found for this meal type
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
        marginLeft: 34
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
        gap: 4,
        paddingVertical: 8,
        borderRadius: 10
    },
    segmentLabel: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 12
    },

    // Cuisine group
    groupsContainer: {
        gap: 20
    },
    group: {
        gap: 10
    },
    cuisineHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    cuisineAccent: {
        width: 3,
        height: 18,
        borderRadius: 2
    },
    cuisineTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 16
    },
    cuisineLine: {
        flex: 1,
        height: 1,
        marginLeft: 8
    },

    // Recipe list
    recipeList: {
        gap: 10
    },

    // Recipe card
    recipeCard: {
        borderRadius: 14,
        overflow: "hidden",
        borderWidth: 1
    },
    cardStrip: {
        height: 3
    },
    cardPressable: {
        padding: 14,
        gap: 10
    },
    cardTopRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 8
    },
    cardTitleArea: {
        flex: 1
    },
    recipeName: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15,
        lineHeight: 20
    },
    timeRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12
    },
    timeDivider: {
        width: 1,
        height: 12,
        backgroundColor: theme.colors.outlineVariant
    },
    totalTime: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 12
    },
    badgesRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6
    },

    // Detail panel
    detailPanel: {
        borderTopWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 14,
        gap: 16
    },
    servingRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6
    },
    servingText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13
    },

    // Detail section
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

    // Ingredient checkbox
    ingredientRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 4
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 4,
        borderWidth: 1.5,
        alignItems: "center",
        justifyContent: "center"
    },
    ingredientName: {
        flex: 1,
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13
    },
    ingredientAmount: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11
    },

    // Steps
    stepRow: {
        flexDirection: "row",
        gap: 10,
        alignItems: "flex-start"
    },
    stepNumber: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 1
    },
    stepNumberText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 12
    },
    stepText: {
        flex: 1,
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 20
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
