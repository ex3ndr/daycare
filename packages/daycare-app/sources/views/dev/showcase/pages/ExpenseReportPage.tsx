import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
// --- Data types ---
import { Card } from "@/components/Card";
import { ShowcasePage } from "@/views/dev/showcase/components/ShowcasePage";

type Expense = {
    id: string;
    date: string;
    merchant: string;
    amount: number;
    category: "Travel" | "Meals" | "Software" | "Office";
    hasReceipt: boolean;
};

// --- Mock data ---

const CATEGORY_COLORS: Record<Expense["category"], string> = {
    Travel: "#3b82f6",
    Meals: "#f59e0b",
    Software: "#8b5cf6",
    Office: "#10b981"
};
const expenses: Expense[] = [
    {
        id: "1",
        date: "Feb 3",
        merchant: "Delta Airlines",
        amount: 1245.0,
        category: "Travel",
        hasReceipt: true
    },
    {
        id: "2",
        date: "Feb 8",
        merchant: "Uber",
        amount: 42.5,
        category: "Travel",
        hasReceipt: true
    },
    {
        id: "3",
        date: "Feb 15",
        merchant: "Hilton Hotels",
        amount: 892.0,
        category: "Travel",
        hasReceipt: false
    },
    {
        id: "4",
        date: "Feb 5",
        merchant: "Starbucks",
        amount: 8.75,
        category: "Meals",
        hasReceipt: true
    },
    {
        id: "5",
        date: "Feb 10",
        merchant: "Sweetgreen",
        amount: 16.4,
        category: "Meals",
        hasReceipt: false
    },
    {
        id: "6",
        date: "Feb 18",
        merchant: "Shake Shack",
        amount: 24.9,
        category: "Meals",
        hasReceipt: true
    },
    {
        id: "7",
        date: "Feb 1",
        merchant: "Figma",
        amount: 15.0,
        category: "Software",
        hasReceipt: true
    },
    {
        id: "8",
        date: "Feb 1",
        merchant: "GitHub",
        amount: 21.0,
        category: "Software",
        hasReceipt: true
    },
    {
        id: "9",
        date: "Feb 1",
        merchant: "Notion",
        amount: 10.0,
        category: "Software",
        hasReceipt: false
    },
    {
        id: "10",
        date: "Feb 12",
        merchant: "Amazon",
        amount: 29.99,
        category: "Office",
        hasReceipt: true
    },
    {
        id: "11",
        date: "Feb 20",
        merchant: "Staples",
        amount: 67.5,
        category: "Office",
        hasReceipt: true
    },
    {
        id: "12",
        date: "Feb 25",
        merchant: "Apple Store",
        amount: 1459.46,
        category: "Office",
        hasReceipt: true
    }
];
const TOTAL = 4832.5;
const MISSING_COUNT = expenses.filter((e) => !e.hasReceipt).length;

// Compute category totals for the bar chart
const categoryTotals: {
    category: Expense["category"];
    total: number;
}[] = (["Travel", "Meals", "Software", "Office"] as const).map((cat) => ({
    category: cat,
    total: expenses.filter((e) => e.category === cat).reduce((sum, e) => sum + e.amount, 0)
}));
const maxCategoryTotal = Math.max(...categoryTotals.map((c) => c.total));
function formatAmount(n: number): string {
    return (
        "$" +
        n.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })
    );
}

// --- Category bar ---

function CategoryBar({ category, total }: { category: Expense["category"]; total: number }) {
    const { theme } = useUnistyles();
    const color = CATEGORY_COLORS[category];
    const barFraction = total / maxCategoryTotal;
    return (
        <View style={barStyles.row}>
            <Text
                style={[
                    barStyles.label,
                    {
                        color: theme.colors.onSurface
                    }
                ]}
            >
                {category}
            </Text>
            <View
                style={[
                    barStyles.track,
                    {
                        backgroundColor: theme.colors.surfaceContainer
                    }
                ]}
            >
                <View
                    style={[
                        barStyles.fill,
                        {
                            width: `${barFraction * 100}%`,
                            backgroundColor: color
                        }
                    ]}
                />
            </View>
            <Text
                style={[
                    barStyles.amount,
                    {
                        color: theme.colors.onSurface
                    }
                ]}
            >
                {formatAmount(total)}
            </Text>
        </View>
    );
}
const barStyles = StyleSheet.create((_theme) => ({
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 6
    },
    label: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13,
        width: 72
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
        width: 88,
        textAlign: "right"
    }
}));

// --- Receipt card ---

function ReceiptCard({ expense }: { expense: Expense }) {
    const { theme } = useUnistyles();
    const color = CATEGORY_COLORS[expense.category];
    return (
        <View
            style={[
                cardStyles.container,
                {
                    backgroundColor: theme.colors.surface
                }
            ]}
        >
            {/* Dashed receipt tear at top */}
            <View
                style={[
                    cardStyles.dashedBorder,
                    {
                        borderColor: theme.colors.outlineVariant
                    }
                ]}
            />

            <View style={cardStyles.content}>
                {/* Left: color dot + merchant info */}
                <View style={cardStyles.left}>
                    <View
                        style={[
                            cardStyles.dot,
                            {
                                backgroundColor: color
                            }
                        ]}
                    />
                    <View style={cardStyles.info}>
                        <Text
                            style={[
                                cardStyles.merchant,
                                {
                                    color: theme.colors.onSurface
                                }
                            ]}
                        >
                            {expense.merchant}
                        </Text>
                        <Text
                            style={[
                                cardStyles.date,
                                {
                                    color: theme.colors.onSurfaceVariant
                                }
                            ]}
                        >
                            {expense.date} · {expense.category}
                        </Text>
                    </View>
                </View>

                {/* Right: amount */}
                <Text
                    style={[
                        cardStyles.cardAmount,
                        {
                            color: theme.colors.onSurface
                        }
                    ]}
                >
                    {formatAmount(expense.amount)}
                </Text>
            </View>

            {/* Receipt status icon at bottom right */}
            <View style={cardStyles.statusIcon}>
                <Ionicons
                    name={expense.hasReceipt ? "checkmark-circle" : "warning"}
                    size={16}
                    color={expense.hasReceipt ? "#10b981" : theme.colors.error}
                />
            </View>
        </View>
    );
}
const cardStyles = StyleSheet.create((_theme) => ({
    container: {
        borderRadius: 10,
        overflow: "hidden",
        marginBottom: 10
    },
    dashedBorder: {
        borderTopWidth: 2,
        borderStyle: "dashed"
    },
    content: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 14,
        paddingTop: 14,
        paddingBottom: 10
    },
    left: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        flex: 1
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5
    },
    info: {
        flex: 1,
        gap: 2
    },
    merchant: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15
    },
    date: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    cardAmount: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 16,
        marginLeft: 12
    },
    statusIcon: {
        position: "absolute",
        bottom: 10,
        right: 14
    }
}));

// --- Main component ---

export function ExpenseReportPage() {
    const { theme } = useUnistyles();
    return (
        <ShowcasePage horizontalInset={20} topInset={24} bottomInset={24}>
            {/* 1. Report header */}
            <View style={pageStyles.header}>
                <Text
                    style={[
                        pageStyles.monthTitle,
                        {
                            color: theme.colors.onSurface
                        }
                    ]}
                >
                    February 2026
                </Text>
                <Text
                    style={[
                        pageStyles.totalAmount,
                        {
                            color: theme.colors.primary
                        }
                    ]}
                >
                    {formatAmount(TOTAL)}
                </Text>
                <Text
                    style={[
                        pageStyles.dateRange,
                        {
                            color: theme.colors.onSurfaceVariant
                        }
                    ]}
                >
                    Feb 1 - Feb 28, 2026
                </Text>
                <View
                    style={[
                        pageStyles.badge,
                        {
                            backgroundColor: `${theme.colors.error}18`
                        }
                    ]}
                >
                    <Ionicons name="alert-circle" size={14} color={theme.colors.error} />
                    <Text
                        style={[
                            pageStyles.badgeText,
                            {
                                color: theme.colors.error
                            }
                        ]}
                    >
                        {MISSING_COUNT} Missing Receipts
                    </Text>
                </View>
            </View>

            {/* 2. Category breakdown */}
            <View style={pageStyles.section}>
                <Text
                    style={[
                        pageStyles.sectionTitle,
                        {
                            color: theme.colors.onSurface
                        }
                    ]}
                >
                    Category Breakdown
                </Text>
                <Card
                    style={[
                        pageStyles.breakdownCard,
                        {
                            backgroundColor: theme.colors.surfaceContainer
                        }
                    ]}
                >
                    {categoryTotals.map((ct) => (
                        <CategoryBar key={ct.category} category={ct.category} total={ct.total} />
                    ))}
                </Card>
            </View>

            {/* 3. Warning banner */}
            <View
                style={[
                    pageStyles.warningBanner,
                    {
                        backgroundColor: `${theme.colors.error}12`,
                        borderColor: `${theme.colors.error}30`
                    }
                ]}
            >
                <Ionicons name="warning" size={20} color={theme.colors.error} />
                <View style={pageStyles.warningTextWrap}>
                    <Text
                        style={[
                            pageStyles.warningTitle,
                            {
                                color: theme.colors.error
                            }
                        ]}
                    >
                        Missing Receipts
                    </Text>
                    <Text
                        style={[
                            pageStyles.warningBody,
                            {
                                color: theme.colors.onSurfaceVariant
                            }
                        ]}
                    >
                        {MISSING_COUNT} expenses are missing receipts. Please attach receipts before submitting this
                        report.
                    </Text>
                </View>
            </View>

            {/* 4. Expense entries as receipt cards */}
            <View style={pageStyles.section}>
                <Text
                    style={[
                        pageStyles.sectionTitle,
                        {
                            color: theme.colors.onSurface
                        }
                    ]}
                >
                    Expenses
                </Text>
                {expenses.map((expense) => (
                    <ReceiptCard key={expense.id} expense={expense} />
                ))}
            </View>

            {/* 5. Footer total */}
            <View
                style={[
                    pageStyles.footerRule,
                    {
                        borderColor: theme.colors.outlineVariant
                    }
                ]}
            />
            <View style={pageStyles.footerRow}>
                <Text
                    style={[
                        pageStyles.footerLabel,
                        {
                            color: theme.colors.onSurfaceVariant
                        }
                    ]}
                >
                    Total
                </Text>
                <Text
                    style={[
                        pageStyles.footerTotal,
                        {
                            color: theme.colors.onSurface
                        }
                    ]}
                >
                    {formatAmount(TOTAL)}
                </Text>
            </View>
        </ShowcasePage>
    );
}
const pageStyles = StyleSheet.create((_theme) => ({
    // Header
    header: {
        alignItems: "center",
        gap: 4,
        marginBottom: 28
    },
    monthTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 28,
        lineHeight: 36
    },
    totalAmount: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 42,
        lineHeight: 52,
        marginTop: 4
    },
    dateRange: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14,
        marginTop: 2
    },
    badge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 14,
        marginTop: 10
    },
    badgeText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 12
    },
    // Sections
    section: {
        marginBottom: 24
    },
    sectionTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 16,
        marginBottom: 12
    },
    breakdownCard: {
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12
    },
    // Warning banner
    warningBanner: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
        borderRadius: 10,
        borderWidth: 1,
        padding: 14,
        marginBottom: 24
    },
    warningTextWrap: {
        flex: 1,
        gap: 2
    },
    warningTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 14
    },
    warningBody: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 18
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
    footerLabel: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 16
    },
    footerTotal: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 22
    }
}));
