import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
// --- Types ---
import { Card } from "@/components/Card";
import { Grid } from "@/components/Grid";
import { ShowcasePage } from "@/views/dev/showcase/components/ShowcasePage";

type TransactionType = "income" | "expense";
type Transaction = {
    id: string;
    date: string;
    dateGroup: string;
    merchant: string;
    category: string;
    amount: number;
    type: TransactionType;
    account: string;
};
type BudgetCategory = {
    id: string;
    name: string;
    icon: keyof typeof Ionicons.glyphMap;
    spent: number;
    budget: number;
    color: string;
};

// --- Mock data ---

const NET_WORTH = 127450;
const MONTHLY_INCOME = 8200;
const MONTHLY_EXPENSES = 5340;
const SAVINGS_RATE = 34.9;
const CATEGORY_CHIP_COLORS: Record<string, string> = {
    Salary: "#10b981",
    Freelance: "#06b6d4",
    Groceries: "#f59e0b",
    Dining: "#ef4444",
    Transport: "#3b82f6",
    Shopping: "#8b5cf6",
    Utilities: "#64748b",
    Entertainment: "#ec4899",
    Health: "#14b8a6",
    Rent: "#f97316",
    Investment: "#6366f1",
    Subscription: "#a855f7"
};
const ACCOUNT_COLORS: Record<string, string> = {
    Checking: "#3b82f6",
    Savings: "#10b981",
    Credit: "#ef4444",
    Brokerage: "#8b5cf6"
};
const transactions: Transaction[] = [
    {
        id: "1",
        date: "Mar 3",
        dateGroup: "Today",
        merchant: "Whole Foods",
        category: "Groceries",
        amount: 87.42,
        type: "expense",
        account: "Credit"
    },
    {
        id: "2",
        date: "Mar 3",
        dateGroup: "Today",
        merchant: "Uber",
        category: "Transport",
        amount: 14.5,
        type: "expense",
        account: "Credit"
    },
    {
        id: "3",
        date: "Mar 3",
        dateGroup: "Today",
        merchant: "Spotify",
        category: "Subscription",
        amount: 9.99,
        type: "expense",
        account: "Checking"
    },
    {
        id: "4",
        date: "Mar 2",
        dateGroup: "Yesterday",
        merchant: "Acme Corp",
        category: "Salary",
        amount: 4100.0,
        type: "income",
        account: "Checking"
    },
    {
        id: "5",
        date: "Mar 2",
        dateGroup: "Yesterday",
        merchant: "Amazon",
        category: "Shopping",
        amount: 65.3,
        type: "expense",
        account: "Credit"
    },
    {
        id: "6",
        date: "Mar 2",
        dateGroup: "Yesterday",
        merchant: "Chipotle",
        category: "Dining",
        amount: 12.85,
        type: "expense",
        account: "Credit"
    },
    {
        id: "7",
        date: "Mar 1",
        dateGroup: "Mar 1",
        merchant: "Freelance Client",
        category: "Freelance",
        amount: 1200.0,
        type: "income",
        account: "Checking"
    },
    {
        id: "8",
        date: "Mar 1",
        dateGroup: "Mar 1",
        merchant: "Landlord",
        category: "Rent",
        amount: 1800.0,
        type: "expense",
        account: "Checking"
    },
    {
        id: "9",
        date: "Mar 1",
        dateGroup: "Mar 1",
        merchant: "Con Edison",
        category: "Utilities",
        amount: 142.3,
        type: "expense",
        account: "Checking"
    },
    {
        id: "10",
        date: "Mar 1",
        dateGroup: "Mar 1",
        merchant: "Planet Fitness",
        category: "Health",
        amount: 29.99,
        type: "expense",
        account: "Checking"
    },
    {
        id: "11",
        date: "Feb 28",
        dateGroup: "Feb 28",
        merchant: "Fidelity",
        category: "Investment",
        amount: 500.0,
        type: "expense",
        account: "Brokerage"
    },
    {
        id: "12",
        date: "Feb 28",
        dateGroup: "Feb 28",
        merchant: "AMC Theatres",
        category: "Entertainment",
        amount: 24.0,
        type: "expense",
        account: "Credit"
    }
];
const budgetCategories: BudgetCategory[] = [
    {
        id: "1",
        name: "Rent",
        icon: "home-outline",
        spent: 1800,
        budget: 1800,
        color: "#f97316"
    },
    {
        id: "2",
        name: "Groceries",
        icon: "cart-outline",
        spent: 420,
        budget: 500,
        color: "#f59e0b"
    },
    {
        id: "3",
        name: "Dining",
        icon: "restaurant-outline",
        spent: 185,
        budget: 200,
        color: "#ef4444"
    },
    {
        id: "4",
        name: "Transport",
        icon: "car-outline",
        spent: 95,
        budget: 150,
        color: "#3b82f6"
    },
    {
        id: "5",
        name: "Shopping",
        icon: "bag-outline",
        spent: 310,
        budget: 250,
        color: "#8b5cf6"
    },
    {
        id: "6",
        name: "Entertainment",
        icon: "film-outline",
        spent: 68,
        budget: 100,
        color: "#ec4899"
    },
    {
        id: "7",
        name: "Utilities",
        icon: "flash-outline",
        spent: 142,
        budget: 160,
        color: "#64748b"
    },
    {
        id: "8",
        name: "Health",
        icon: "heart-outline",
        spent: 30,
        budget: 80,
        color: "#14b8a6"
    },
    {
        id: "9",
        name: "Subscriptions",
        icon: "apps-outline",
        spent: 45,
        budget: 50,
        color: "#a855f7"
    }
];

// --- Helpers ---

function formatCurrency(n: number): string {
    return `$${n.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}
function formatCompact(n: number): string {
    if (n >= 1000) {
        return `$${(n / 1000).toFixed(1)}k`;
    }
    return `$${n.toFixed(0)}`;
}

// Group transactions by dateGroup
function groupTransactions(txns: Transaction[]): {
    group: string;
    items: Transaction[];
}[] {
    const groups: {
        group: string;
        items: Transaction[];
    }[] = [];
    for (const txn of txns) {
        const existing = groups.find((g) => g.group === txn.dateGroup);
        if (existing) {
            existing.items.push(txn);
        } else {
            groups.push({
                group: txn.dateGroup,
                items: [txn]
            });
        }
    }
    return groups;
}

// --- Metric Card ---

function MetricCard({
    title,
    value,
    icon,
    iconColor,
    accentColor,
    subtitle
}: {
    title: string;
    value: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    accentColor: string;
    subtitle?: string;
}) {
    const { theme } = useUnistyles();
    return (
        <Card style={metricStyles.card}>
            <View
                style={[
                    metricStyles.iconBadge,
                    {
                        backgroundColor: `${accentColor}18`
                    }
                ]}
            >
                <Ionicons name={icon} size={20} color={iconColor} />
            </View>
            <Text
                style={[
                    metricStyles.title,
                    {
                        color: theme.colors.onSurfaceVariant
                    }
                ]}
            >
                {title}
            </Text>
            <Text
                style={[
                    metricStyles.value,
                    {
                        color: theme.colors.onSurface
                    }
                ]}
            >
                {value}
            </Text>
            {subtitle && (
                <Text
                    style={[
                        metricStyles.subtitle,
                        {
                            color: accentColor
                        }
                    ]}
                >
                    {subtitle}
                </Text>
            )}
        </Card>
    );
}
const metricStyles = StyleSheet.create((_theme) => ({
    card: {
        flex: 1,
        minWidth: 140,
        gap: 6
    },
    iconBadge: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 4
    },
    title: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    value: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 22,
        lineHeight: 28
    },
    subtitle: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11
    }
}));

// --- Transaction Row ---

function TransactionRow({ txn }: { txn: Transaction }) {
    const { theme } = useUnistyles();
    const chipColor = CATEGORY_CHIP_COLORS[txn.category] ?? theme.colors.onSurfaceVariant;
    const accountColor = ACCOUNT_COLORS[txn.account] ?? theme.colors.outline;
    const isIncome = txn.type === "income";
    return (
        <View
            style={[
                txnStyles.row,
                {
                    backgroundColor: theme.colors.surface
                }
            ]}
        >
            <View
                style={[
                    txnStyles.iconWrap,
                    {
                        backgroundColor: `${chipColor}14`
                    }
                ]}
            >
                <Ionicons name={isIncome ? "arrow-down-outline" : "arrow-up-outline"} size={18} color={chipColor} />
            </View>
            <View style={txnStyles.info}>
                <Text
                    style={[
                        txnStyles.merchant,
                        {
                            color: theme.colors.onSurface
                        }
                    ]}
                    numberOfLines={1}
                >
                    {txn.merchant}
                </Text>
                <View style={txnStyles.tagRow}>
                    <View
                        style={[
                            txnStyles.chip,
                            {
                                backgroundColor: `${chipColor}18`
                            }
                        ]}
                    >
                        <Text
                            style={[
                                txnStyles.chipText,
                                {
                                    color: chipColor
                                }
                            ]}
                        >
                            {txn.category}
                        </Text>
                    </View>
                    <View
                        style={[
                            txnStyles.accountBadge,
                            {
                                borderColor: `${accountColor}40`
                            }
                        ]}
                    >
                        <View
                            style={[
                                txnStyles.accountDot,
                                {
                                    backgroundColor: accountColor
                                }
                            ]}
                        />
                        <Text
                            style={[
                                txnStyles.accountText,
                                {
                                    color: theme.colors.onSurfaceVariant
                                }
                            ]}
                        >
                            {txn.account}
                        </Text>
                    </View>
                </View>
            </View>
            <Text
                style={[
                    txnStyles.amount,
                    {
                        color: isIncome ? "#10b981" : "#ef4444"
                    }
                ]}
            >
                {isIncome ? "+" : "-"}
                {formatCurrency(txn.amount)}
            </Text>
        </View>
    );
}
const txnStyles = StyleSheet.create((_theme) => ({
    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 14,
        gap: 12
    },
    iconWrap: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center"
    },
    info: {
        flex: 1,
        gap: 4
    },
    merchant: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 15
    },
    tagRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6
    },
    chip: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8
    },
    chipText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11
    },
    accountBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1
    },
    accountDot: {
        width: 6,
        height: 6,
        borderRadius: 3
    },
    accountText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 10
    },
    amount: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 15
    }
}));

// --- Budget Row ---

function BudgetRow({ item }: { item: BudgetCategory }) {
    const { theme } = useUnistyles();
    const pct = Math.min((item.spent / item.budget) * 100, 100);
    const isOver = item.spent > item.budget;
    const remaining = item.budget - item.spent;
    return (
        <View style={budgetStyles.row}>
            <View style={budgetStyles.top}>
                <View style={budgetStyles.nameRow}>
                    <View
                        style={[
                            budgetStyles.catIcon,
                            {
                                backgroundColor: `${item.color}18`
                            }
                        ]}
                    >
                        <Ionicons name={item.icon} size={16} color={item.color} />
                    </View>
                    <Text
                        style={[
                            budgetStyles.name,
                            {
                                color: theme.colors.onSurface
                            }
                        ]}
                    >
                        {item.name}
                    </Text>
                </View>
                <View style={budgetStyles.amountRow}>
                    <Text
                        style={[
                            budgetStyles.spent,
                            {
                                color: theme.colors.onSurface
                            }
                        ]}
                    >
                        {formatCompact(item.spent)}
                    </Text>
                    <Text
                        style={[
                            budgetStyles.separator,
                            {
                                color: theme.colors.onSurfaceVariant
                            }
                        ]}
                    >
                        /
                    </Text>
                    <Text
                        style={[
                            budgetStyles.budget,
                            {
                                color: theme.colors.onSurfaceVariant
                            }
                        ]}
                    >
                        {formatCompact(item.budget)}
                    </Text>
                </View>
            </View>
            <View
                style={[
                    budgetStyles.track,
                    {
                        backgroundColor: `${item.color}14`
                    }
                ]}
            >
                <View
                    style={[
                        budgetStyles.fill,
                        {
                            width: `${pct}%`,
                            backgroundColor: isOver ? "#ef4444" : item.color
                        }
                    ]}
                />
            </View>
            <Text
                style={[
                    budgetStyles.remaining,
                    {
                        color: isOver ? "#ef4444" : theme.colors.onSurfaceVariant
                    }
                ]}
            >
                {isOver ? `$${Math.abs(remaining).toFixed(0)} over budget` : `$${remaining.toFixed(0)} left`}
            </Text>
        </View>
    );
}
const budgetStyles = StyleSheet.create((_theme) => ({
    row: {
        gap: 6,
        paddingVertical: 10
    },
    top: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    nameRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    catIcon: {
        width: 28,
        height: 28,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center"
    },
    name: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 14
    },
    amountRow: {
        flexDirection: "row",
        alignItems: "baseline",
        gap: 2
    },
    spent: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 14
    },
    separator: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    budget: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 12
    },
    track: {
        height: 8,
        borderRadius: 4,
        overflow: "hidden"
    },
    fill: {
        height: "100%",
        borderRadius: 4
    },
    remaining: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    }
}));

// --- Main Component ---

export function PersonalFinancePage() {
    const { theme } = useUnistyles();
    const [transactionsExpanded, setTransactionsExpanded] = React.useState(true);
    const [budgetExpanded, setBudgetExpanded] = React.useState(true);
    const grouped = React.useMemo(() => groupTransactions(transactions), []);
    const totalBudget = budgetCategories.reduce((s, b) => s + b.budget, 0);
    const totalSpent = budgetCategories.reduce((s, b) => s + b.spent, 0);
    const overallBudgetPct = Math.min((totalSpent / totalBudget) * 100, 100);
    return (
        <ShowcasePage topInset={24} bottomInset={60}>
            {/* --- Hero: Net Worth --- */}
            <View style={pageStyles.hero}>
                <Text
                    style={[
                        pageStyles.heroLabel,
                        {
                            color: theme.colors.onSurfaceVariant
                        }
                    ]}
                >
                    Net Worth
                </Text>
                <Text
                    style={[
                        pageStyles.heroValue,
                        {
                            color: theme.colors.onSurface
                        }
                    ]}
                >
                    ${NET_WORTH.toLocaleString("en-US")}
                </Text>
                <View style={pageStyles.heroBadgeRow}>
                    <View
                        style={[
                            pageStyles.heroBadge,
                            {
                                backgroundColor: "#10b98118"
                            }
                        ]}
                    >
                        <Ionicons name="trending-up" size={14} color="#10b981" />
                        <Text
                            style={[
                                pageStyles.heroBadgeText,
                                {
                                    color: "#10b981"
                                }
                            ]}
                        >
                            +2.4% this month
                        </Text>
                    </View>
                </View>
            </View>

            {/* --- Metric Cards Grid --- */}
            <Grid style={{ marginBottom: 20 }}>
                <MetricCard
                    title="Net Worth"
                    value={formatCompact(NET_WORTH)}
                    icon="wallet-outline"
                    iconColor="#6366f1"
                    accentColor="#6366f1"
                    subtitle="+2.4%"
                />
                <MetricCard
                    title="Income"
                    value={formatCompact(MONTHLY_INCOME)}
                    icon="trending-up-outline"
                    iconColor="#10b981"
                    accentColor="#10b981"
                    subtitle="This month"
                />
                <MetricCard
                    title="Expenses"
                    value={formatCompact(MONTHLY_EXPENSES)}
                    icon="trending-down-outline"
                    iconColor="#ef4444"
                    accentColor="#ef4444"
                    subtitle="This month"
                />
                <MetricCard
                    title="Savings Rate"
                    value={`${SAVINGS_RATE}%`}
                    icon="shield-checkmark-outline"
                    iconColor="#3b82f6"
                    accentColor="#3b82f6"
                    subtitle="Above goal"
                />
            </Grid>

            {/* --- Cashflow Mini Bar --- */}
            <Card style={pageStyles.cashflowCard}>
                <Text
                    style={[
                        pageStyles.cashflowTitle,
                        {
                            color: theme.colors.onSurface
                        }
                    ]}
                >
                    Monthly Cashflow
                </Text>
                <View style={pageStyles.cashflowBarWrap}>
                    <View style={pageStyles.cashflowBarRow}>
                        <View
                            style={[
                                pageStyles.cashflowBar,
                                {
                                    flex: MONTHLY_INCOME,
                                    backgroundColor: "#10b981"
                                }
                            ]}
                        />
                    </View>
                    <View style={pageStyles.cashflowBarRow}>
                        <View
                            style={[
                                pageStyles.cashflowBar,
                                {
                                    flex: MONTHLY_EXPENSES,
                                    backgroundColor: "#ef4444"
                                }
                            ]}
                        />
                        <View
                            style={{
                                flex: MONTHLY_INCOME - MONTHLY_EXPENSES
                            }}
                        />
                    </View>
                </View>
                <View style={pageStyles.cashflowLegend}>
                    <View style={pageStyles.cashflowLegendItem}>
                        <View
                            style={[
                                pageStyles.cashflowDot,
                                {
                                    backgroundColor: "#10b981"
                                }
                            ]}
                        />
                        <Text
                            style={[
                                pageStyles.cashflowLegendText,
                                {
                                    color: theme.colors.onSurfaceVariant
                                }
                            ]}
                        >
                            Income {formatCurrency(MONTHLY_INCOME)}
                        </Text>
                    </View>
                    <View style={pageStyles.cashflowLegendItem}>
                        <View
                            style={[
                                pageStyles.cashflowDot,
                                {
                                    backgroundColor: "#ef4444"
                                }
                            ]}
                        />
                        <Text
                            style={[
                                pageStyles.cashflowLegendText,
                                {
                                    color: theme.colors.onSurfaceVariant
                                }
                            ]}
                        >
                            Expenses {formatCurrency(MONTHLY_EXPENSES)}
                        </Text>
                    </View>
                </View>
            </Card>

            {/* --- Recent Transactions --- */}
            <Pressable onPress={() => setTransactionsExpanded((prev) => !prev)} style={pageStyles.sectionHeader}>
                <View style={pageStyles.sectionTitleRow}>
                    <Ionicons name="receipt-outline" size={18} color={theme.colors.primary} />
                    <Text
                        style={[
                            pageStyles.sectionTitle,
                            {
                                color: theme.colors.onSurface
                            }
                        ]}
                    >
                        Recent Transactions
                    </Text>
                </View>
                <Ionicons
                    name={transactionsExpanded ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={theme.colors.onSurfaceVariant}
                />
            </Pressable>

            {transactionsExpanded && (
                <Card style={pageStyles.sectionCard}>
                    {grouped.map((group, groupIdx) => (
                        <React.Fragment key={group.group}>
                            {groupIdx > 0 && (
                                <View
                                    style={[
                                        pageStyles.groupDivider,
                                        {
                                            borderColor: theme.colors.outlineVariant
                                        }
                                    ]}
                                />
                            )}
                            <View style={pageStyles.dateGroupHeader}>
                                <Text
                                    style={[
                                        pageStyles.dateGroupText,
                                        {
                                            color: theme.colors.onSurfaceVariant
                                        }
                                    ]}
                                >
                                    {group.group}
                                </Text>
                                <View
                                    style={[
                                        pageStyles.dateGroupLine,
                                        {
                                            backgroundColor: theme.colors.outlineVariant
                                        }
                                    ]}
                                />
                            </View>
                            {group.items.map((txn) => (
                                <TransactionRow key={txn.id} txn={txn} />
                            ))}
                        </React.Fragment>
                    ))}
                </Card>
            )}

            {/* --- Budget Categories --- */}
            <Pressable
                onPress={() => setBudgetExpanded((prev) => !prev)}
                style={[
                    pageStyles.sectionHeader,
                    {
                        marginTop: 24
                    }
                ]}
            >
                <View style={pageStyles.sectionTitleRow}>
                    <Ionicons name="pie-chart-outline" size={18} color={theme.colors.primary} />
                    <Text
                        style={[
                            pageStyles.sectionTitle,
                            {
                                color: theme.colors.onSurface
                            }
                        ]}
                    >
                        Budget
                    </Text>
                </View>
                <Ionicons
                    name={budgetExpanded ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={theme.colors.onSurfaceVariant}
                />
            </Pressable>

            {budgetExpanded && (
                <Card style={pageStyles.sectionCard}>
                    {/* Overall summary bar */}
                    <View style={pageStyles.budgetSummary}>
                        <View style={pageStyles.budgetSummaryTop}>
                            <Text
                                style={[
                                    pageStyles.budgetSummaryLabel,
                                    {
                                        color: theme.colors.onSurface
                                    }
                                ]}
                            >
                                Overall
                            </Text>
                            <Text
                                style={[
                                    pageStyles.budgetSummaryAmount,
                                    {
                                        color: theme.colors.onSurface
                                    }
                                ]}
                            >
                                {formatCurrency(totalSpent)}{" "}
                                <Text
                                    style={{
                                        color: theme.colors.onSurfaceVariant,
                                        fontSize: 13
                                    }}
                                >
                                    / {formatCurrency(totalBudget)}
                                </Text>
                            </Text>
                        </View>
                        <View
                            style={[
                                pageStyles.budgetSummaryTrack,
                                {
                                    backgroundColor: theme.colors.outlineVariant
                                }
                            ]}
                        >
                            <View
                                style={[
                                    pageStyles.budgetSummaryFill,
                                    {
                                        width: `${overallBudgetPct}%`,
                                        backgroundColor: overallBudgetPct > 90 ? "#ef4444" : theme.colors.primary
                                    }
                                ]}
                            />
                        </View>
                    </View>

                    <View
                        style={[
                            pageStyles.budgetDivider,
                            {
                                borderColor: theme.colors.outlineVariant
                            }
                        ]}
                    />

                    {/* Individual categories */}
                    {budgetCategories.map((cat) => (
                        <BudgetRow key={cat.id} item={cat} />
                    ))}
                </Card>
            )}
        </ShowcasePage>
    );
}

// --- Page Styles ---

const pageStyles = StyleSheet.create((_theme) => ({
    // Hero
    hero: {
        alignItems: "center",
        paddingTop: 8,
        paddingBottom: 20,
        gap: 4
    },
    heroLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14
    },
    heroValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 42,
        lineHeight: 52
    },
    heroBadgeRow: {
        flexDirection: "row",
        marginTop: 4
    },
    heroBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12
    },
    heroBadgeText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13
    },
    // Cashflow
    cashflowCard: {
        marginBottom: 24,
        gap: 12
    },
    cashflowTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15
    },
    cashflowBarWrap: {
        gap: 6
    },
    cashflowBarRow: {
        flexDirection: "row",
        height: 12,
        borderRadius: 6,
        overflow: "hidden"
    },
    cashflowBar: {
        height: "100%",
        borderRadius: 6
    },
    cashflowLegend: {
        flexDirection: "row",
        gap: 16
    },
    cashflowLegendItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6
    },
    cashflowDot: {
        width: 8,
        height: 8,
        borderRadius: 4
    },
    cashflowLegendText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    // Section headers
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 12
    },
    sectionTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    sectionTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 17
    },
    sectionCard: {
        overflow: "hidden",
        paddingVertical: 4
    },
    // Date group headers
    dateGroupHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 14,
        paddingTop: 10,
        paddingBottom: 2
    },
    dateGroupText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 12,
        textTransform: "uppercase",
        letterSpacing: 0.8
    },
    dateGroupLine: {
        flex: 1,
        height: 1
    },
    groupDivider: {
        borderTopWidth: 1,
        marginHorizontal: 14,
        marginVertical: 4
    },
    // Budget summary
    budgetSummary: {
        paddingHorizontal: 14,
        paddingTop: 12,
        paddingBottom: 8,
        gap: 8
    },
    budgetSummaryTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    budgetSummaryLabel: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 14
    },
    budgetSummaryAmount: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 14
    },
    budgetSummaryTrack: {
        height: 10,
        borderRadius: 5,
        overflow: "hidden"
    },
    budgetSummaryFill: {
        height: "100%",
        borderRadius: 5
    },
    budgetDivider: {
        borderTopWidth: 1,
        marginHorizontal: 14,
        marginVertical: 8
    }
}));
