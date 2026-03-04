import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
// --- Types ---
import { Card } from "@/components/Card";
import { ShowcasePage } from "@/views/dev/showcase/components/ShowcasePage";

type RenewalStatus = "active" | "trial" | "cancelling";
type PaymentMethod = "Visa" | "Mastercard" | "PayPal";
type Category = "Streaming" | "Software" | "News" | "Fitness" | "Cloud Storage";
type Subscription = {
    id: string;
    name: string;
    icon: keyof typeof Ionicons.glyphMap;
    monthlyCost: number;
    billingDate: number; // day of month
    paymentMethod: PaymentMethod;
    status: RenewalStatus;
    category: Category;
    description?: string;
};

// --- Constants ---

const CATEGORY_COLORS: Record<Category, string> = {
    Streaming: "#8b5cf6",
    Software: "#3b82f6",
    News: "#f59e0b",
    Fitness: "#10b981",
    "Cloud Storage": "#06b6d4"
};
const CATEGORY_ICONS: Record<Category, keyof typeof Ionicons.glyphMap> = {
    Streaming: "play-circle-outline",
    Software: "code-slash-outline",
    News: "newspaper-outline",
    Fitness: "barbell-outline",
    "Cloud Storage": "cloud-outline"
};
const STATUS_COLORS: Record<
    RenewalStatus,
    {
        bg: string;
        text: string;
    }
> = {
    active: {
        bg: "#10b98120",
        text: "#10b981"
    },
    trial: {
        bg: "#f59e0b20",
        text: "#f59e0b"
    },
    cancelling: {
        bg: "#ef444420",
        text: "#ef4444"
    }
};
const STATUS_LABELS: Record<RenewalStatus, string> = {
    active: "Active",
    trial: "Trial",
    cancelling: "Cancelling"
};
const PAYMENT_ICONS: Record<PaymentMethod, keyof typeof Ionicons.glyphMap> = {
    Visa: "card-outline",
    Mastercard: "card-outline",
    PayPal: "logo-paypal"
};

// --- Mock Data ---

const subscriptions: Subscription[] = [
    // Streaming
    {
        id: "1",
        name: "Netflix",
        icon: "tv-outline",
        monthlyCost: 15.99,
        billingDate: 5,
        paymentMethod: "Visa",
        status: "active",
        category: "Streaming",
        description: "Premium 4K plan, 4 screens"
    },
    {
        id: "2",
        name: "Spotify",
        icon: "musical-notes-outline",
        monthlyCost: 9.99,
        billingDate: 12,
        paymentMethod: "PayPal",
        status: "active",
        category: "Streaming",
        description: "Individual plan with HiFi"
    },
    {
        id: "3",
        name: "Disney+",
        icon: "star-outline",
        monthlyCost: 13.99,
        billingDate: 8,
        paymentMethod: "Visa",
        status: "trial",
        category: "Streaming",
        description: "Premium plan, no ads"
    },
    {
        id: "4",
        name: "YouTube Premium",
        icon: "logo-youtube",
        monthlyCost: 13.99,
        billingDate: 1,
        paymentMethod: "Mastercard",
        status: "active",
        category: "Streaming"
    },
    // Software
    {
        id: "5",
        name: "Figma",
        icon: "color-palette-outline",
        monthlyCost: 15.0,
        billingDate: 1,
        paymentMethod: "Visa",
        status: "active",
        category: "Software",
        description: "Professional plan"
    },
    {
        id: "6",
        name: "GitHub Pro",
        icon: "logo-github",
        monthlyCost: 4.0,
        billingDate: 15,
        paymentMethod: "Mastercard",
        status: "active",
        category: "Software"
    },
    {
        id: "7",
        name: "Notion",
        icon: "document-text-outline",
        monthlyCost: 10.0,
        billingDate: 3,
        paymentMethod: "Visa",
        status: "cancelling",
        category: "Software",
        description: "Plus plan, cancels Mar 31"
    },
    // News
    {
        id: "8",
        name: "The New York Times",
        icon: "newspaper-outline",
        monthlyCost: 17.0,
        billingDate: 7,
        paymentMethod: "Visa",
        status: "active",
        category: "News",
        description: "All Access bundle"
    },
    {
        id: "9",
        name: "The Athletic",
        icon: "american-football-outline",
        monthlyCost: 9.99,
        billingDate: 4,
        paymentMethod: "PayPal",
        status: "active",
        category: "News"
    },
    // Fitness
    {
        id: "10",
        name: "Peloton",
        icon: "bicycle-outline",
        monthlyCost: 24.0,
        billingDate: 10,
        paymentMethod: "Mastercard",
        status: "active",
        category: "Fitness",
        description: "App membership"
    },
    {
        id: "11",
        name: "Strava",
        icon: "walk-outline",
        monthlyCost: 11.99,
        billingDate: 6,
        paymentMethod: "Visa",
        status: "trial",
        category: "Fitness",
        description: "30-day trial, ends Mar 15"
    },
    // Cloud Storage
    {
        id: "12",
        name: "iCloud+",
        icon: "cloud-outline",
        monthlyCost: 9.99,
        billingDate: 2,
        paymentMethod: "Visa",
        status: "active",
        category: "Cloud Storage",
        description: "2TB storage plan"
    },
    {
        id: "13",
        name: "Dropbox",
        icon: "folder-outline",
        monthlyCost: 11.99,
        billingDate: 5,
        paymentMethod: "PayPal",
        status: "cancelling",
        category: "Cloud Storage",
        description: "Plus plan, cancels Apr 5"
    }
];
const CATEGORIES: Category[] = ["Streaming", "Software", "News", "Fitness", "Cloud Storage"];

// Today is March 3, 2026 -- subscriptions renewing this week: billing dates 3-9
const RENEWAL_WEEK_START = 3;
const RENEWAL_WEEK_END = 9;

// --- Helpers ---

function formatCurrency(n: number): string {
    return `$${n.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}
function getCategoryTotal(category: Category): number {
    return subscriptions.filter((s) => s.category === category).reduce((sum, s) => sum + s.monthlyCost, 0);
}
function getRenewingThisWeek(): Subscription[] {
    return subscriptions.filter(
        (s) => s.billingDate >= RENEWAL_WEEK_START && s.billingDate <= RENEWAL_WEEK_END && s.status !== "cancelling"
    );
}
const MONTHLY_TOTAL = subscriptions.reduce((sum, s) => sum + s.monthlyCost, 0);
const ANNUAL_PROJECTION = MONTHLY_TOTAL * 12;
const RENEWING_THIS_WEEK = getRenewingThisWeek();
const MAX_CATEGORY_TOTAL = Math.max(...CATEGORIES.map(getCategoryTotal));

// --- Renewal Banner ---

function RenewalBanner() {
    const { theme } = useUnistyles();
    if (RENEWING_THIS_WEEK.length === 0) return null;
    const renewalTotal = RENEWING_THIS_WEEK.reduce((sum, s) => sum + s.monthlyCost, 0);
    return (
        <View
            style={[
                bannerStyles.container,
                {
                    backgroundColor: `${theme.colors.primary}12`,
                    borderColor: `${theme.colors.primary}30`
                }
            ]}
        >
            <View
                style={[
                    bannerStyles.iconWrap,
                    {
                        backgroundColor: `${theme.colors.primary}20`
                    }
                ]}
            >
                <Ionicons name="calendar" size={20} color={theme.colors.primary} />
            </View>
            <View style={bannerStyles.textWrap}>
                <Text
                    style={[
                        bannerStyles.title,
                        {
                            color: theme.colors.primary
                        }
                    ]}
                >
                    Renewing This Week
                </Text>
                <Text
                    style={[
                        bannerStyles.body,
                        {
                            color: theme.colors.onSurfaceVariant
                        }
                    ]}
                >
                    {RENEWING_THIS_WEEK.length} subscription{RENEWING_THIS_WEEK.length > 1 ? "s" : ""} renewing for{" "}
                    {formatCurrency(renewalTotal)} total
                </Text>
                <View style={bannerStyles.chipRow}>
                    {RENEWING_THIS_WEEK.map((s) => (
                        <View key={s.id} style={bannerStyles.chip}>
                            <Text
                                style={[
                                    bannerStyles.chipText,
                                    {
                                        color: theme.colors.onSurface
                                    }
                                ]}
                            >
                                {s.name}
                            </Text>
                            <Text
                                style={[
                                    bannerStyles.chipDate,
                                    {
                                        color: theme.colors.onSurfaceVariant
                                    }
                                ]}
                            >
                                Mar {s.billingDate}
                            </Text>
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
}
const bannerStyles = StyleSheet.create((_theme) => ({
    container: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
        borderRadius: 14,
        borderWidth: 1,
        padding: 16,
        marginBottom: 24
    },
    iconWrap: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center"
    },
    textWrap: {
        flex: 1,
        gap: 4
    },
    title: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15
    },
    body: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 18
    },
    chipRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
        marginTop: 8
    },
    chip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8
    },
    chipText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 12
    },
    chipDate: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11
    }
}));

// --- Category Breakdown Bar ---

function CategoryBreakdownBar({ category }: { category: Category }) {
    const { theme } = useUnistyles();
    const total = getCategoryTotal(category);
    const fraction = total / MAX_CATEGORY_TOTAL;
    const color = CATEGORY_COLORS[category];
    return (
        <View style={breakdownStyles.row}>
            <View style={breakdownStyles.labelWrap}>
                <Ionicons name={CATEGORY_ICONS[category]} size={14} color={color} />
                <Text
                    style={[
                        breakdownStyles.label,
                        {
                            color: theme.colors.onSurface
                        }
                    ]}
                >
                    {category}
                </Text>
            </View>
            <View
                style={[
                    breakdownStyles.track,
                    {
                        backgroundColor: `${color}14`
                    }
                ]}
            >
                <View
                    style={[
                        breakdownStyles.fill,
                        {
                            width: `${fraction * 100}%`,
                            backgroundColor: color
                        }
                    ]}
                />
            </View>
            <Text
                style={[
                    breakdownStyles.amount,
                    {
                        color: theme.colors.onSurface
                    }
                ]}
            >
                {formatCurrency(total)}
            </Text>
        </View>
    );
}
const breakdownStyles = StyleSheet.create((_theme) => ({
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 6
    },
    labelWrap: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        width: 120
    },
    label: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13
    },
    track: {
        flex: 1,
        height: 20,
        borderRadius: 4,
        overflow: "hidden"
    },
    fill: {
        height: "100%",
        borderRadius: 4
    },
    amount: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 13,
        width: 72,
        textAlign: "right"
    }
}));

// --- Subscription Card ---

function SubscriptionCard({ sub, expanded, onToggle }: { sub: Subscription; expanded: boolean; onToggle: () => void }) {
    const { theme } = useUnistyles();
    const statusColor = STATUS_COLORS[sub.status];
    const catColor = CATEGORY_COLORS[sub.category];
    return (
        <Pressable
            onPress={onToggle}
            style={[
                cardStyles.container,
                {
                    backgroundColor: theme.colors.surface
                }
            ]}
        >
            <View style={cardStyles.mainRow}>
                {/* Icon */}
                <View
                    style={[
                        cardStyles.iconWrap,
                        {
                            backgroundColor: `${catColor}14`
                        }
                    ]}
                >
                    <Ionicons name={sub.icon} size={22} color={catColor} />
                </View>

                {/* Info */}
                <View style={cardStyles.info}>
                    <Text
                        style={[
                            cardStyles.name,
                            {
                                color: theme.colors.onSurface
                            }
                        ]}
                    >
                        {sub.name}
                    </Text>
                    <View style={cardStyles.metaRow}>
                        {/* Billing date */}
                        <View style={cardStyles.dateChip}>
                            <Ionicons name="calendar-outline" size={12} color={theme.colors.onSurfaceVariant} />
                            <Text
                                style={[
                                    cardStyles.dateText,
                                    {
                                        color: theme.colors.onSurfaceVariant
                                    }
                                ]}
                            >
                                Mar {sub.billingDate}
                            </Text>
                        </View>

                        {/* Payment method */}
                        <View style={cardStyles.paymentChip}>
                            <Ionicons
                                name={PAYMENT_ICONS[sub.paymentMethod]}
                                size={12}
                                color={theme.colors.onSurfaceVariant}
                            />
                            <Text
                                style={[
                                    cardStyles.paymentText,
                                    {
                                        color: theme.colors.onSurfaceVariant
                                    }
                                ]}
                            >
                                {sub.paymentMethod}
                            </Text>
                        </View>

                        {/* Status badge */}
                        <View
                            style={[
                                cardStyles.statusBadge,
                                {
                                    backgroundColor: statusColor.bg
                                }
                            ]}
                        >
                            <Text
                                style={[
                                    cardStyles.statusText,
                                    {
                                        color: statusColor.text
                                    }
                                ]}
                            >
                                {STATUS_LABELS[sub.status]}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Cost */}
                <View style={cardStyles.costWrap}>
                    <Text
                        style={[
                            cardStyles.cost,
                            {
                                color: theme.colors.onSurface
                            }
                        ]}
                    >
                        {formatCurrency(sub.monthlyCost)}
                    </Text>
                    <Text
                        style={[
                            cardStyles.costLabel,
                            {
                                color: theme.colors.onSurfaceVariant
                            }
                        ]}
                    >
                        /mo
                    </Text>
                </View>
            </View>

            {/* Expanded detail */}
            {expanded && (
                <View
                    style={[
                        cardStyles.expandedSection,
                        {
                            borderTopColor: theme.colors.outlineVariant
                        }
                    ]}
                >
                    {sub.description && (
                        <Text
                            style={[
                                cardStyles.description,
                                {
                                    color: theme.colors.onSurfaceVariant
                                }
                            ]}
                        >
                            {sub.description}
                        </Text>
                    )}
                    <View style={cardStyles.expandedRow}>
                        <View style={cardStyles.expandedItem}>
                            <Text
                                style={[
                                    cardStyles.expandedLabel,
                                    {
                                        color: theme.colors.onSurfaceVariant
                                    }
                                ]}
                            >
                                Annual Cost
                            </Text>
                            <Text
                                style={[
                                    cardStyles.expandedValue,
                                    {
                                        color: theme.colors.onSurface
                                    }
                                ]}
                            >
                                {formatCurrency(sub.monthlyCost * 12)}
                            </Text>
                        </View>
                        <View style={cardStyles.expandedItem}>
                            <Text
                                style={[
                                    cardStyles.expandedLabel,
                                    {
                                        color: theme.colors.onSurfaceVariant
                                    }
                                ]}
                            >
                                Next Billing
                            </Text>
                            <Text
                                style={[
                                    cardStyles.expandedValue,
                                    {
                                        color: theme.colors.onSurface
                                    }
                                ]}
                            >
                                Mar {sub.billingDate}, 2026
                            </Text>
                        </View>
                        <View style={cardStyles.expandedItem}>
                            <Text
                                style={[
                                    cardStyles.expandedLabel,
                                    {
                                        color: theme.colors.onSurfaceVariant
                                    }
                                ]}
                            >
                                Payment
                            </Text>
                            <Text
                                style={[
                                    cardStyles.expandedValue,
                                    {
                                        color: theme.colors.onSurface
                                    }
                                ]}
                            >
                                {sub.paymentMethod}
                            </Text>
                        </View>
                    </View>

                    {sub.status !== "cancelling" ? (
                        <View
                            style={[
                                cardStyles.cancelButton,
                                {
                                    borderColor: theme.colors.error
                                }
                            ]}
                        >
                            <Ionicons name="close-circle-outline" size={16} color={theme.colors.error} />
                            <Text
                                style={[
                                    cardStyles.cancelText,
                                    {
                                        color: theme.colors.error
                                    }
                                ]}
                            >
                                Cancel Subscription
                            </Text>
                        </View>
                    ) : (
                        <View
                            style={[
                                cardStyles.cancelledNotice,
                                {
                                    backgroundColor: `${theme.colors.error}10`
                                }
                            ]}
                        >
                            <Ionicons name="information-circle-outline" size={16} color={theme.colors.error} />
                            <Text
                                style={[
                                    cardStyles.cancelledText,
                                    {
                                        color: theme.colors.error
                                    }
                                ]}
                            >
                                Cancellation scheduled
                            </Text>
                        </View>
                    )}
                </View>
            )}
        </Pressable>
    );
}
const cardStyles = StyleSheet.create((_theme) => ({
    container: {
        borderRadius: 12,
        overflow: "hidden",
        marginBottom: 8
    },
    mainRow: {
        flexDirection: "row",
        alignItems: "center",
        padding: 14,
        gap: 12
    },
    iconWrap: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center"
    },
    info: {
        flex: 1,
        gap: 6
    },
    name: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15
    },
    metaRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        flexWrap: "wrap"
    },
    dateChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3
    },
    dateText: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11
    },
    paymentChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6
    },
    paymentText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8
    },
    statusText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: 0.5
    },
    costWrap: {
        alignItems: "flex-end"
    },
    cost: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 16
    },
    costLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },
    // Expanded
    expandedSection: {
        borderTopWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 12
    },
    description: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 18
    },
    expandedRow: {
        flexDirection: "row",
        gap: 16
    },
    expandedItem: {
        flex: 1,
        gap: 2
    },
    expandedLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },
    expandedValue: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13
    },
    cancelButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        borderWidth: 1,
        borderRadius: 10,
        paddingVertical: 10
    },
    cancelText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13
    },
    cancelledNotice: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8
    },
    cancelledText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13
    }
}));

// --- Category Section ---

function CategorySection({
    category,
    items,
    expandedId,
    onToggle,
    collapsed,
    onToggleCollapse
}: {
    category: Category;
    items: Subscription[];
    expandedId: string | null;
    onToggle: (id: string) => void;
    collapsed: boolean;
    onToggleCollapse: () => void;
}) {
    const { theme } = useUnistyles();
    const color = CATEGORY_COLORS[category];
    const total = items.reduce((sum, s) => sum + s.monthlyCost, 0);
    return (
        <View style={sectionStyles.container}>
            <Pressable onPress={onToggleCollapse} style={sectionStyles.header}>
                <View style={sectionStyles.headerLeft}>
                    <View
                        style={[
                            sectionStyles.catDot,
                            {
                                backgroundColor: color
                            }
                        ]}
                    />
                    <Text
                        style={[
                            sectionStyles.catName,
                            {
                                color: theme.colors.onSurface
                            }
                        ]}
                    >
                        {category}
                    </Text>
                    <View
                        style={[
                            sectionStyles.countBadge,
                            {
                                backgroundColor: `${color}18`
                            }
                        ]}
                    >
                        <Text
                            style={[
                                sectionStyles.countText,
                                {
                                    color
                                }
                            ]}
                        >
                            {items.length}
                        </Text>
                    </View>
                </View>
                <View style={sectionStyles.headerRight}>
                    <Text
                        style={[
                            sectionStyles.subtotal,
                            {
                                color: theme.colors.onSurface
                            }
                        ]}
                    >
                        {formatCurrency(total)}
                    </Text>
                    <Ionicons
                        name={collapsed ? "chevron-down" : "chevron-up"}
                        size={18}
                        color={theme.colors.onSurfaceVariant}
                    />
                </View>
            </Pressable>

            {!collapsed &&
                items.map((sub) => (
                    <SubscriptionCard
                        key={sub.id}
                        sub={sub}
                        expanded={expandedId === sub.id}
                        onToggle={() => onToggle(sub.id)}
                    />
                ))}
        </View>
    );
}
const sectionStyles = StyleSheet.create((_theme) => ({
    container: {
        marginBottom: 20
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 10,
        marginBottom: 6
    },
    headerLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    catDot: {
        width: 10,
        height: 10,
        borderRadius: 5
    },
    catName: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 16
    },
    countBadge: {
        paddingHorizontal: 7,
        paddingVertical: 1,
        borderRadius: 8
    },
    countText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 11
    },
    headerRight: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    subtotal: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 14
    }
}));

// --- Main Component ---

export function SubscriptionManagerPage() {
    const { theme } = useUnistyles();
    const [expandedId, setExpandedId] = React.useState<string | null>(null);
    const [collapsedCategories, setCollapsedCategories] = React.useState<Set<Category>>(new Set());
    const toggleExpand = React.useCallback((id: string) => {
        setExpandedId((prev) => (prev === id ? null : id));
    }, []);
    const toggleCategory = React.useCallback((category: Category) => {
        setCollapsedCategories((prev) => {
            const next = new Set(prev);
            if (next.has(category)) {
                next.delete(category);
            } else {
                next.add(category);
            }
            return next;
        });
    }, []);

    // Group subscriptions by category
    const grouped = React.useMemo(() => {
        const map = new Map<Category, Subscription[]>();
        for (const cat of CATEGORIES) {
            map.set(cat, []);
        }
        for (const sub of subscriptions) {
            map.get(sub.category)!.push(sub);
        }
        return map;
    }, []);
    const activeCount = subscriptions.filter((s) => s.status === "active").length;
    const trialCount = subscriptions.filter((s) => s.status === "trial").length;
    const cancellingCount = subscriptions.filter((s) => s.status === "cancelling").length;
    return (
        <ShowcasePage topInset={24} bottomInset={60}>
            {/* --- Hero: Monthly Spend --- */}
            <View style={pageStyles.hero}>
                <Text
                    style={[
                        pageStyles.heroLabel,
                        {
                            color: theme.colors.onSurfaceVariant
                        }
                    ]}
                >
                    Monthly Spend
                </Text>
                <Text
                    style={[
                        pageStyles.heroValue,
                        {
                            color: theme.colors.onSurface
                        }
                    ]}
                >
                    {formatCurrency(MONTHLY_TOTAL)}
                </Text>
                <View style={pageStyles.annualRow}>
                    <Ionicons name="trending-up" size={14} color={theme.colors.primary} />
                    <Text
                        style={[
                            pageStyles.annualText,
                            {
                                color: theme.colors.primary
                            }
                        ]}
                    >
                        {formatCurrency(ANNUAL_PROJECTION)}/yr projected
                    </Text>
                </View>
            </View>

            {/* --- Status Summary Chips --- */}
            <View style={pageStyles.statusRow}>
                <View
                    style={[
                        pageStyles.statusChip,
                        {
                            backgroundColor: STATUS_COLORS.active.bg
                        }
                    ]}
                >
                    <View
                        style={[
                            pageStyles.statusDot,
                            {
                                backgroundColor: STATUS_COLORS.active.text
                            }
                        ]}
                    />
                    <Text
                        style={[
                            pageStyles.statusChipText,
                            {
                                color: STATUS_COLORS.active.text
                            }
                        ]}
                    >
                        {activeCount} Active
                    </Text>
                </View>
                <View
                    style={[
                        pageStyles.statusChip,
                        {
                            backgroundColor: STATUS_COLORS.trial.bg
                        }
                    ]}
                >
                    <View
                        style={[
                            pageStyles.statusDot,
                            {
                                backgroundColor: STATUS_COLORS.trial.text
                            }
                        ]}
                    />
                    <Text
                        style={[
                            pageStyles.statusChipText,
                            {
                                color: STATUS_COLORS.trial.text
                            }
                        ]}
                    >
                        {trialCount} Trial
                    </Text>
                </View>
                <View
                    style={[
                        pageStyles.statusChip,
                        {
                            backgroundColor: STATUS_COLORS.cancelling.bg
                        }
                    ]}
                >
                    <View
                        style={[
                            pageStyles.statusDot,
                            {
                                backgroundColor: STATUS_COLORS.cancelling.text
                            }
                        ]}
                    />
                    <Text
                        style={[
                            pageStyles.statusChipText,
                            {
                                color: STATUS_COLORS.cancelling.text
                            }
                        ]}
                    >
                        {cancellingCount} Cancelling
                    </Text>
                </View>
            </View>

            {/* --- Renewal Banner --- */}
            <RenewalBanner />

            {/* --- Category Spend Breakdown --- */}
            <Card style={pageStyles.breakdownCard}>
                <Text
                    style={[
                        pageStyles.breakdownTitle,
                        {
                            color: theme.colors.onSurface
                        }
                    ]}
                >
                    Spend by Category
                </Text>
                {CATEGORIES.map((cat) => (
                    <CategoryBreakdownBar key={cat} category={cat} />
                ))}
            </Card>

            {/* --- Category Sections --- */}
            {CATEGORIES.map((cat) => {
                const items = grouped.get(cat) ?? [];
                if (items.length === 0) return null;
                return (
                    <CategorySection
                        key={cat}
                        category={cat}
                        items={items}
                        expandedId={expandedId}
                        onToggle={toggleExpand}
                        collapsed={collapsedCategories.has(cat)}
                        onToggleCollapse={() => toggleCategory(cat)}
                    />
                );
            })}

            {/* --- Footer Summary --- */}
            <View
                style={[
                    pageStyles.footerRule,
                    {
                        borderColor: theme.colors.outlineVariant
                    }
                ]}
            />
            <View style={pageStyles.footerRow}>
                <View style={pageStyles.footerLeft}>
                    <Text
                        style={[
                            pageStyles.footerLabel,
                            {
                                color: theme.colors.onSurfaceVariant
                            }
                        ]}
                    >
                        {subscriptions.length} subscriptions
                    </Text>
                </View>
                <View style={pageStyles.footerRight}>
                    <Text
                        style={[
                            pageStyles.footerTotalLabel,
                            {
                                color: theme.colors.onSurfaceVariant
                            }
                        ]}
                    >
                        Monthly Total
                    </Text>
                    <Text
                        style={[
                            pageStyles.footerTotal,
                            {
                                color: theme.colors.onSurface
                            }
                        ]}
                    >
                        {formatCurrency(MONTHLY_TOTAL)}
                    </Text>
                </View>
            </View>
        </ShowcasePage>
    );
}

// --- Page Styles ---

const pageStyles = StyleSheet.create((_theme) => ({
    // Hero
    hero: {
        alignItems: "center",
        paddingTop: 8,
        paddingBottom: 8,
        gap: 4
    },
    heroLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14
    },
    heroValue: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 44,
        lineHeight: 54
    },
    annualRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        marginTop: 4
    },
    annualText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 14
    },
    // Status summary
    statusRow: {
        flexDirection: "row",
        justifyContent: "center",
        gap: 8,
        marginTop: 16,
        marginBottom: 24
    },
    statusChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12
    },
    statusDot: {
        width: 7,
        height: 7,
        borderRadius: 4
    },
    statusChipText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 12
    },
    // Breakdown card
    breakdownCard: {
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 14,
        marginBottom: 24,
        gap: 2
    },
    breakdownTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15,
        marginBottom: 8
    },
    // Footer
    footerRule: {
        borderTopWidth: 1,
        marginBottom: 12
    },
    footerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingBottom: 40
    },
    footerLeft: {
        gap: 2
    },
    footerLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13
    },
    footerRight: {
        alignItems: "flex-end",
        gap: 2
    },
    footerTotalLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    footerTotal: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 22
    }
}));
