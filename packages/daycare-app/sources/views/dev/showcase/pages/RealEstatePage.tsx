import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

// --- Types ---

type OccupancyStatus = "occupied" | "vacant" | "maintenance";
type PropertyType = "Residential" | "Commercial" | "Vacation Rental";

type Expense = {
    label: string;
    amount: number;
    color: string;
};

type Tenant = {
    name: string;
    since: string;
    leaseEnd: string;
    monthlyRent: number;
};

type MortgageInfo = {
    lender: string;
    balance: number;
    rate: number;
    monthlyPayment: number;
    remainingYears: number;
};

type Property = {
    id: string;
    address: string;
    city: string;
    type: PropertyType;
    purchasePrice: number;
    currentValue: number;
    monthlyRent: number;
    occupancy: OccupancyStatus;
    roi: number;
    mortgage: MortgageInfo;
    expenses: Expense[];
    tenant: Tenant | null;
};

// --- Mock Data ---

const TOTAL_PORTFOLIO_VALUE = 3_285_000;
const PORTFOLIO_TREND = "+8.2%";
const TOTAL_PROPERTIES = 8;
const MONTHLY_RENTAL_INCOME = 18_450;
const AVG_OCCUPANCY = 87.5;

const properties: Property[] = [
    {
        id: "r1",
        address: "142 Maple Street",
        city: "Austin, TX",
        type: "Residential",
        purchasePrice: 320_000,
        currentValue: 385_000,
        monthlyRent: 2_400,
        occupancy: "occupied",
        roi: 9.2,
        mortgage: {
            lender: "Wells Fargo",
            balance: 218_000,
            rate: 4.25,
            monthlyPayment: 1_260,
            remainingYears: 22
        },
        expenses: [
            { label: "Mortgage", amount: 1260, color: "#3B82F6" },
            { label: "Insurance", amount: 180, color: "#F59E0B" },
            { label: "Tax", amount: 320, color: "#EF4444" },
            { label: "Maintenance", amount: 150, color: "#8B5CF6" }
        ],
        tenant: { name: "Sarah Johnson", since: "Jan 2024", leaseEnd: "Dec 2026", monthlyRent: 2400 }
    },
    {
        id: "r2",
        address: "78 Oak Avenue",
        city: "Austin, TX",
        type: "Residential",
        purchasePrice: 275_000,
        currentValue: 310_000,
        monthlyRent: 1_950,
        occupancy: "occupied",
        roi: 7.8,
        mortgage: {
            lender: "Chase",
            balance: 195_000,
            rate: 3.875,
            monthlyPayment: 1_040,
            remainingYears: 25
        },
        expenses: [
            { label: "Mortgage", amount: 1040, color: "#3B82F6" },
            { label: "Insurance", amount: 155, color: "#F59E0B" },
            { label: "Tax", amount: 275, color: "#EF4444" },
            { label: "Maintenance", amount: 120, color: "#8B5CF6" }
        ],
        tenant: { name: "Mike Chen", since: "Mar 2025", leaseEnd: "Feb 2027", monthlyRent: 1950 }
    },
    {
        id: "r3",
        address: "205 Birch Lane",
        city: "Denver, CO",
        type: "Residential",
        purchasePrice: 410_000,
        currentValue: 395_000,
        monthlyRent: 0,
        occupancy: "vacant",
        roi: -3.7,
        mortgage: {
            lender: "Bank of America",
            balance: 330_000,
            rate: 5.5,
            monthlyPayment: 1_870,
            remainingYears: 28
        },
        expenses: [
            { label: "Mortgage", amount: 1870, color: "#3B82F6" },
            { label: "Insurance", amount: 210, color: "#F59E0B" },
            { label: "Tax", amount: 390, color: "#EF4444" },
            { label: "Maintenance", amount: 80, color: "#8B5CF6" }
        ],
        tenant: null
    },
    {
        id: "c1",
        address: "500 Commerce Blvd, Ste 200",
        city: "Dallas, TX",
        type: "Commercial",
        purchasePrice: 680_000,
        currentValue: 745_000,
        monthlyRent: 5_200,
        occupancy: "occupied",
        roi: 11.4,
        mortgage: {
            lender: "US Bank",
            balance: 420_000,
            rate: 4.75,
            monthlyPayment: 2_890,
            remainingYears: 18
        },
        expenses: [
            { label: "Mortgage", amount: 2890, color: "#3B82F6" },
            { label: "Insurance", amount: 450, color: "#F59E0B" },
            { label: "Tax", amount: 620, color: "#EF4444" },
            { label: "Maintenance", amount: 300, color: "#8B5CF6" }
        ],
        tenant: { name: "TechStart Inc.", since: "Jun 2023", leaseEnd: "May 2028", monthlyRent: 5200 }
    },
    {
        id: "c2",
        address: "12 Industrial Park Dr",
        city: "Houston, TX",
        type: "Commercial",
        purchasePrice: 520_000,
        currentValue: 540_000,
        monthlyRent: 0,
        occupancy: "maintenance",
        roi: 3.8,
        mortgage: {
            lender: "PNC Bank",
            balance: 380_000,
            rate: 5.0,
            monthlyPayment: 2_240,
            remainingYears: 20
        },
        expenses: [
            { label: "Mortgage", amount: 2240, color: "#3B82F6" },
            { label: "Insurance", amount: 380, color: "#F59E0B" },
            { label: "Tax", amount: 510, color: "#EF4444" },
            { label: "Renovation", amount: 2500, color: "#EC4899" }
        ],
        tenant: null
    },
    {
        id: "v1",
        address: "88 Oceanview Terrace",
        city: "Destin, FL",
        type: "Vacation Rental",
        purchasePrice: 425_000,
        currentValue: 490_000,
        monthlyRent: 4_800,
        occupancy: "occupied",
        roi: 13.6,
        mortgage: {
            lender: "Quicken Loans",
            balance: 290_000,
            rate: 4.5,
            monthlyPayment: 1_580,
            remainingYears: 24
        },
        expenses: [
            { label: "Mortgage", amount: 1580, color: "#3B82F6" },
            { label: "Insurance", amount: 320, color: "#F59E0B" },
            { label: "Tax", amount: 410, color: "#EF4444" },
            { label: "Cleaning", amount: 600, color: "#14B8A6" },
            { label: "Platform Fees", amount: 480, color: "#8B5CF6" }
        ],
        tenant: { name: "Various (Airbnb)", since: "Apr 2024", leaseEnd: "Rolling", monthlyRent: 4800 }
    },
    {
        id: "v2",
        address: "34 Mountain Lodge Rd",
        city: "Gatlinburg, TN",
        type: "Vacation Rental",
        purchasePrice: 340_000,
        currentValue: 375_000,
        monthlyRent: 3_200,
        occupancy: "occupied",
        roi: 10.3,
        mortgage: {
            lender: "First Horizon",
            balance: 245_000,
            rate: 4.875,
            monthlyPayment: 1_390,
            remainingYears: 26
        },
        expenses: [
            { label: "Mortgage", amount: 1390, color: "#3B82F6" },
            { label: "Insurance", amount: 260, color: "#F59E0B" },
            { label: "Tax", amount: 340, color: "#EF4444" },
            { label: "Cleaning", amount: 450, color: "#14B8A6" },
            { label: "Platform Fees", amount: 320, color: "#8B5CF6" }
        ],
        tenant: { name: "Various (VRBO)", since: "Sep 2024", leaseEnd: "Rolling", monthlyRent: 3200 }
    },
    {
        id: "v3",
        address: "7 Lakeshore Ct",
        city: "Lake Tahoe, CA",
        type: "Vacation Rental",
        purchasePrice: 515_000,
        currentValue: 445_000,
        monthlyRent: 900,
        occupancy: "vacant",
        roi: -5.2,
        mortgage: {
            lender: "SoFi",
            balance: 410_000,
            rate: 5.75,
            monthlyPayment: 2_520,
            remainingYears: 28
        },
        expenses: [
            { label: "Mortgage", amount: 2520, color: "#3B82F6" },
            { label: "Insurance", amount: 380, color: "#F59E0B" },
            { label: "Tax", amount: 540, color: "#EF4444" },
            { label: "Maintenance", amount: 200, color: "#8B5CF6" }
        ],
        tenant: null
    }
];

const PROPERTY_TYPES: PropertyType[] = ["Residential", "Commercial", "Vacation Rental"];

const TYPE_ICONS: Record<PropertyType, keyof typeof Ionicons.glyphMap> = {
    Residential: "home-outline",
    Commercial: "business-outline",
    "Vacation Rental": "bed-outline"
};

const TYPE_COLORS: Record<PropertyType, string> = {
    Residential: "#3B82F6",
    Commercial: "#8B5CF6",
    "Vacation Rental": "#F59E0B"
};

const OCCUPANCY_COLORS: Record<OccupancyStatus, { bg: string; text: string }> = {
    occupied: { bg: "#10B98120", text: "#10B981" },
    vacant: { bg: "#EF444420", text: "#EF4444" },
    maintenance: { bg: "#F59E0B20", text: "#F59E0B" }
};

const OCCUPANCY_LABELS: Record<OccupancyStatus, string> = {
    occupied: "Occupied",
    vacant: "Vacant",
    maintenance: "Maintenance"
};

// --- Helpers ---

function formatCurrency(n: number): string {
    if (n >= 1_000_000) {
        return `$${(n / 1_000_000).toFixed(2)}M`;
    }
    if (n >= 1_000) {
        return `$${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k`;
    }
    return `$${n.toLocaleString("en-US")}`;
}

function formatFullCurrency(n: number): string {
    return `$${n.toLocaleString("en-US")}`;
}

function groupByType(items: Property[]): { type: PropertyType; items: Property[] }[] {
    return PROPERTY_TYPES.map((type) => ({
        type,
        items: items.filter((p) => p.type === type)
    })).filter((g) => g.items.length > 0);
}

// --- Metric Card ---

function MetricCard({
    title,
    value,
    icon,
    color,
    subtitle
}: {
    title: string;
    value: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    subtitle?: string;
}) {
    const { theme } = useUnistyles();

    return (
        <View style={[metricStyles.card, { backgroundColor: theme.colors.surfaceContainer }]}>
            <View style={[metricStyles.iconBadge, { backgroundColor: `${color}18` }]}>
                <Ionicons name={icon} size={20} color={color} />
            </View>
            <Text style={[metricStyles.title, { color: theme.colors.onSurfaceVariant }]}>{title}</Text>
            <Text style={[metricStyles.value, { color: theme.colors.onSurface }]}>{value}</Text>
            {subtitle && <Text style={[metricStyles.subtitle, { color }]}>{subtitle}</Text>}
        </View>
    );
}

const metricStyles = StyleSheet.create((theme) => ({
    card: {
        flex: 1,
        minWidth: 140,
        borderRadius: 16,
        padding: 16,
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
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    }
}));

// --- Expense Bar Chart ---

function ExpenseBreakdown({ expenses }: { expenses: Expense[] }) {
    const { theme } = useUnistyles();
    const maxAmount = Math.max(...expenses.map((e) => e.amount));

    return (
        <View style={expenseStyles.container}>
            <Text style={[expenseStyles.heading, { color: theme.colors.onSurface }]}>Expense Breakdown</Text>
            <View style={expenseStyles.bars}>
                {expenses.map((expense) => {
                    const pct = maxAmount > 0 ? (expense.amount / maxAmount) * 100 : 0;
                    return (
                        <View key={expense.label} style={expenseStyles.barRow}>
                            <View style={expenseStyles.barLabelCol}>
                                <View style={[expenseStyles.barDot, { backgroundColor: expense.color }]} />
                                <Text
                                    style={[expenseStyles.barLabel, { color: theme.colors.onSurfaceVariant }]}
                                    numberOfLines={1}
                                >
                                    {expense.label}
                                </Text>
                            </View>
                            <View style={expenseStyles.barTrackCol}>
                                <View style={[expenseStyles.barTrack, { backgroundColor: `${expense.color}14` }]}>
                                    <View
                                        style={[
                                            expenseStyles.barFill,
                                            { width: `${Math.max(pct, 4)}%`, backgroundColor: expense.color }
                                        ]}
                                    />
                                </View>
                            </View>
                            <Text style={[expenseStyles.barAmount, { color: theme.colors.onSurface }]}>
                                {formatFullCurrency(expense.amount)}
                            </Text>
                        </View>
                    );
                })}
            </View>
            <View style={[expenseStyles.totalRow, { borderTopColor: theme.colors.outlineVariant }]}>
                <Text style={[expenseStyles.totalLabel, { color: theme.colors.onSurfaceVariant }]}>Total Monthly</Text>
                <Text style={[expenseStyles.totalAmount, { color: theme.colors.onSurface }]}>
                    {formatFullCurrency(expenses.reduce((s, e) => s + e.amount, 0))}
                </Text>
            </View>
        </View>
    );
}

const expenseStyles = StyleSheet.create((theme) => ({
    container: {
        gap: 10,
        paddingTop: 8
    },
    heading: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 13
    },
    bars: {
        gap: 8
    },
    barRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    barLabelCol: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        width: 90
    },
    barDot: {
        width: 8,
        height: 8,
        borderRadius: 4
    },
    barLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        flex: 1
    },
    barTrackCol: {
        flex: 1
    },
    barTrack: {
        height: 16,
        borderRadius: 4,
        overflow: "hidden"
    },
    barFill: {
        height: "100%",
        borderRadius: 4,
        opacity: 0.85
    },
    barAmount: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 12,
        width: 60,
        textAlign: "right"
    },
    totalRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderTopWidth: 1,
        paddingTop: 8,
        marginTop: 4
    },
    totalLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    totalAmount: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 13
    }
}));

// --- Property Card ---

function PropertyCard({
    property,
    isExpanded,
    onToggle
}: {
    property: Property;
    isExpanded: boolean;
    onToggle: () => void;
}) {
    const { theme } = useUnistyles();
    const appreciation = property.currentValue - property.purchasePrice;
    const isUp = appreciation >= 0;
    const appreciationPct = ((appreciation / property.purchasePrice) * 100).toFixed(1);
    const occupancyStyle = OCCUPANCY_COLORS[property.occupancy];

    return (
        <View style={[cardStyles.card, { backgroundColor: theme.colors.surfaceContainer }]}>
            <Pressable onPress={onToggle} style={cardStyles.cardHeader}>
                <View style={cardStyles.cardMainInfo}>
                    <View style={cardStyles.addressRow}>
                        <Text style={[cardStyles.address, { color: theme.colors.onSurface }]} numberOfLines={1}>
                            {property.address}
                        </Text>
                        <View style={[cardStyles.occupancyBadge, { backgroundColor: occupancyStyle.bg }]}>
                            <Text style={[cardStyles.occupancyText, { color: occupancyStyle.text }]}>
                                {OCCUPANCY_LABELS[property.occupancy]}
                            </Text>
                        </View>
                    </View>
                    <Text style={[cardStyles.city, { color: theme.colors.onSurfaceVariant }]}>{property.city}</Text>

                    <View style={cardStyles.statsRow}>
                        <View style={cardStyles.statItem}>
                            <Text style={[cardStyles.statLabel, { color: theme.colors.onSurfaceVariant }]}>
                                Purchase
                            </Text>
                            <Text style={[cardStyles.statValue, { color: theme.colors.onSurface }]}>
                                {formatCurrency(property.purchasePrice)}
                            </Text>
                        </View>
                        <View style={cardStyles.statItem}>
                            <Text style={[cardStyles.statLabel, { color: theme.colors.onSurfaceVariant }]}>
                                Current
                            </Text>
                            <View style={cardStyles.valueWithTrend}>
                                <Text style={[cardStyles.statValue, { color: theme.colors.onSurface }]}>
                                    {formatCurrency(property.currentValue)}
                                </Text>
                                <Ionicons
                                    name={isUp ? "arrow-up" : "arrow-down"}
                                    size={12}
                                    color={isUp ? "#10B981" : "#EF4444"}
                                />
                                <Text style={[cardStyles.trendPct, { color: isUp ? "#10B981" : "#EF4444" }]}>
                                    {isUp ? "+" : ""}
                                    {appreciationPct}%
                                </Text>
                            </View>
                        </View>
                        <View style={cardStyles.statItem}>
                            <Text style={[cardStyles.statLabel, { color: theme.colors.onSurfaceVariant }]}>Rent</Text>
                            <Text style={[cardStyles.statValue, { color: theme.colors.onSurface }]}>
                                {property.monthlyRent > 0 ? formatCurrency(property.monthlyRent) : "--"}
                            </Text>
                        </View>
                        <View style={cardStyles.statItem}>
                            <Text style={[cardStyles.statLabel, { color: theme.colors.onSurfaceVariant }]}>ROI</Text>
                            <Text style={[cardStyles.roiValue, { color: property.roi >= 0 ? "#10B981" : "#EF4444" }]}>
                                {property.roi >= 0 ? "+" : ""}
                                {property.roi}%
                            </Text>
                        </View>
                    </View>
                </View>
                <Ionicons
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={theme.colors.onSurfaceVariant}
                    style={cardStyles.chevron}
                />
            </Pressable>

            {/* Expanded detail panel */}
            {isExpanded && (
                <View style={[cardStyles.detailPanel, { borderTopColor: theme.colors.outlineVariant }]}>
                    {/* Mortgage info */}
                    <View style={cardStyles.detailSection}>
                        <View style={cardStyles.detailSectionHeader}>
                            <Ionicons name="card-outline" size={16} color={theme.colors.primary} />
                            <Text style={[cardStyles.detailSectionTitle, { color: theme.colors.onSurface }]}>
                                Mortgage
                            </Text>
                        </View>
                        <View style={cardStyles.detailGrid}>
                            <View style={cardStyles.detailGridItem}>
                                <Text style={[cardStyles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>
                                    Lender
                                </Text>
                                <Text style={[cardStyles.detailValue, { color: theme.colors.onSurface }]}>
                                    {property.mortgage.lender}
                                </Text>
                            </View>
                            <View style={cardStyles.detailGridItem}>
                                <Text style={[cardStyles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>
                                    Balance
                                </Text>
                                <Text style={[cardStyles.detailValue, { color: theme.colors.onSurface }]}>
                                    {formatFullCurrency(property.mortgage.balance)}
                                </Text>
                            </View>
                            <View style={cardStyles.detailGridItem}>
                                <Text style={[cardStyles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>
                                    Rate
                                </Text>
                                <Text style={[cardStyles.detailValue, { color: theme.colors.onSurface }]}>
                                    {property.mortgage.rate}%
                                </Text>
                            </View>
                            <View style={cardStyles.detailGridItem}>
                                <Text style={[cardStyles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>
                                    Monthly
                                </Text>
                                <Text style={[cardStyles.detailValue, { color: theme.colors.onSurface }]}>
                                    {formatFullCurrency(property.mortgage.monthlyPayment)}
                                </Text>
                            </View>
                            <View style={cardStyles.detailGridItem}>
                                <Text style={[cardStyles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>
                                    Remaining
                                </Text>
                                <Text style={[cardStyles.detailValue, { color: theme.colors.onSurface }]}>
                                    {property.mortgage.remainingYears} yrs
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Expense breakdown */}
                    <ExpenseBreakdown expenses={property.expenses} />

                    {/* Tenant details */}
                    <View style={cardStyles.detailSection}>
                        <View style={cardStyles.detailSectionHeader}>
                            <Ionicons name="person-outline" size={16} color={theme.colors.primary} />
                            <Text style={[cardStyles.detailSectionTitle, { color: theme.colors.onSurface }]}>
                                Tenant
                            </Text>
                        </View>
                        {property.tenant ? (
                            <View style={cardStyles.detailGrid}>
                                <View style={cardStyles.detailGridItem}>
                                    <Text style={[cardStyles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>
                                        Name
                                    </Text>
                                    <Text style={[cardStyles.detailValue, { color: theme.colors.onSurface }]}>
                                        {property.tenant.name}
                                    </Text>
                                </View>
                                <View style={cardStyles.detailGridItem}>
                                    <Text style={[cardStyles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>
                                        Since
                                    </Text>
                                    <Text style={[cardStyles.detailValue, { color: theme.colors.onSurface }]}>
                                        {property.tenant.since}
                                    </Text>
                                </View>
                                <View style={cardStyles.detailGridItem}>
                                    <Text style={[cardStyles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>
                                        Lease End
                                    </Text>
                                    <Text style={[cardStyles.detailValue, { color: theme.colors.onSurface }]}>
                                        {property.tenant.leaseEnd}
                                    </Text>
                                </View>
                                <View style={cardStyles.detailGridItem}>
                                    <Text style={[cardStyles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>
                                        Rent
                                    </Text>
                                    <Text style={[cardStyles.detailValue, { color: theme.colors.onSurface }]}>
                                        {formatFullCurrency(property.tenant.monthlyRent)}/mo
                                    </Text>
                                </View>
                            </View>
                        ) : (
                            <View
                                style={[
                                    cardStyles.emptyTenant,
                                    { backgroundColor: `${OCCUPANCY_COLORS[property.occupancy].text}10` }
                                ]}
                            >
                                <Ionicons
                                    name={
                                        property.occupancy === "maintenance"
                                            ? "construct-outline"
                                            : "alert-circle-outline"
                                    }
                                    size={16}
                                    color={OCCUPANCY_COLORS[property.occupancy].text}
                                />
                                <Text
                                    style={[
                                        cardStyles.emptyTenantText,
                                        { color: OCCUPANCY_COLORS[property.occupancy].text }
                                    ]}
                                >
                                    {property.occupancy === "maintenance"
                                        ? "Under maintenance -- no active tenant"
                                        : "No tenant -- property is vacant"}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            )}
        </View>
    );
}

const cardStyles = StyleSheet.create((theme) => ({
    card: {
        borderRadius: 14,
        overflow: "hidden"
    },
    cardHeader: {
        padding: 14,
        flexDirection: "row",
        gap: 8
    },
    cardMainInfo: {
        flex: 1,
        gap: 4
    },
    addressRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap"
    },
    address: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 15,
        flexShrink: 1
    },
    occupancyBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8
    },
    occupancyText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: 0.5
    },
    city: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        marginBottom: 6
    },
    statsRow: {
        flexDirection: "row",
        gap: 12,
        flexWrap: "wrap"
    },
    statItem: {
        gap: 2
    },
    statLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: 0.5
    },
    statValue: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 13
    },
    valueWithTrend: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3
    },
    trendPct: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 10
    },
    roiValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15
    },
    chevron: {
        marginTop: 2
    },
    detailPanel: {
        borderTopWidth: 1,
        paddingHorizontal: 14,
        paddingBottom: 14,
        paddingTop: 10,
        gap: 16
    },
    detailSection: {
        gap: 8
    },
    detailSectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6
    },
    detailSectionTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 13
    },
    detailGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12
    },
    detailGridItem: {
        minWidth: 100,
        gap: 2
    },
    detailLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: 0.5
    },
    detailValue: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13
    },
    emptyTenant: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 10
    },
    emptyTenantText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        flex: 1
    }
}));

// --- Section Header ---

function SectionHeader({
    title,
    icon,
    iconColor,
    isExpanded,
    onToggle,
    count
}: {
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    isExpanded: boolean;
    onToggle: () => void;
    count: number;
}) {
    const { theme } = useUnistyles();

    return (
        <Pressable onPress={onToggle} style={sectionStyles.header}>
            <View style={sectionStyles.titleRow}>
                <View style={[sectionStyles.iconBadge, { backgroundColor: `${iconColor}18` }]}>
                    <Ionicons name={icon} size={18} color={iconColor} />
                </View>
                <Text style={[sectionStyles.title, { color: theme.colors.onSurface }]}>{title}</Text>
                <View style={[sectionStyles.countBadge, { backgroundColor: `${iconColor}18` }]}>
                    <Text style={[sectionStyles.countText, { color: iconColor }]}>{count}</Text>
                </View>
            </View>
            <Ionicons
                name={isExpanded ? "chevron-up" : "chevron-down"}
                size={20}
                color={theme.colors.onSurfaceVariant}
            />
        </Pressable>
    );
}

const sectionStyles = StyleSheet.create((theme) => ({
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 14,
        marginTop: 8
    },
    titleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    iconBadge: {
        width: 32,
        height: 32,
        borderRadius: 9,
        alignItems: "center",
        justifyContent: "center"
    },
    title: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 17
    },
    countBadge: {
        minWidth: 24,
        height: 24,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 6
    },
    countText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 11
    }
}));

// --- Filter Chips ---

function FilterChips({
    activeFilter,
    onFilter
}: {
    activeFilter: PropertyType | "all";
    onFilter: (filter: PropertyType | "all") => void;
}) {
    const { theme } = useUnistyles();
    const filters: (PropertyType | "all")[] = ["all", ...PROPERTY_TYPES];

    return (
        <View style={filterStyles.row}>
            {filters.map((filter) => {
                const isActive = activeFilter === filter;
                const color = filter === "all" ? theme.colors.primary : TYPE_COLORS[filter];
                return (
                    <Pressable
                        key={filter}
                        onPress={() => onFilter(filter)}
                        style={[
                            filterStyles.chip,
                            {
                                backgroundColor: isActive ? `${color}20` : theme.colors.surfaceContainer,
                                borderColor: isActive ? color : theme.colors.outlineVariant,
                                borderWidth: 1
                            }
                        ]}
                    >
                        {filter !== "all" && (
                            <Ionicons
                                name={TYPE_ICONS[filter]}
                                size={14}
                                color={isActive ? color : theme.colors.onSurfaceVariant}
                            />
                        )}
                        <Text
                            style={[filterStyles.chipText, { color: isActive ? color : theme.colors.onSurfaceVariant }]}
                        >
                            {filter === "all" ? "All" : filter}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

const filterStyles = StyleSheet.create((theme) => ({
    row: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 8
    },
    chip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 10
    },
    chipText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13
    }
}));

// --- Main Component ---

export function RealEstatePage() {
    const { theme } = useUnistyles();
    const [activeFilter, setActiveFilter] = React.useState<PropertyType | "all">("all");
    const [expandedId, setExpandedId] = React.useState<string | null>(null);
    const [collapsedSections, setCollapsedSections] = React.useState<Set<PropertyType>>(new Set());

    const filteredProperties = React.useMemo(() => {
        if (activeFilter === "all") return properties;
        return properties.filter((p) => p.type === activeFilter);
    }, [activeFilter]);

    const grouped = React.useMemo(() => groupByType(filteredProperties), [filteredProperties]);

    const toggleSection = React.useCallback((type: PropertyType) => {
        setCollapsedSections((prev) => {
            const next = new Set(prev);
            if (next.has(type)) {
                next.delete(type);
            } else {
                next.add(type);
            }
            return next;
        });
    }, []);

    const toggleProperty = React.useCallback((id: string) => {
        setExpandedId((prev) => (prev === id ? null : id));
    }, []);

    return (
        <ScrollView
            contentContainerStyle={{
                maxWidth: theme.layout.maxWidth,
                width: "100%",
                alignSelf: "center",
                paddingHorizontal: 16,
                paddingVertical: 24,
                paddingBottom: 60
            }}
            showsVerticalScrollIndicator={false}
        >
            {/* Hero: Portfolio Value */}
            <View style={pageStyles.hero}>
                <Text style={[pageStyles.heroLabel, { color: theme.colors.onSurfaceVariant }]}>PORTFOLIO VALUE</Text>
                <Text style={[pageStyles.heroValue, { color: theme.colors.onSurface }]}>
                    ${TOTAL_PORTFOLIO_VALUE.toLocaleString("en-US")}
                </Text>
                <View style={pageStyles.heroBadgeRow}>
                    <View style={[pageStyles.heroBadge, { backgroundColor: "#10B98118" }]}>
                        <Ionicons name="trending-up" size={14} color="#10B981" />
                        <Text style={[pageStyles.heroBadgeText, { color: "#10B981" }]}>
                            {PORTFOLIO_TREND} this year
                        </Text>
                    </View>
                </View>
            </View>

            {/* Metric Cards */}
            <View style={pageStyles.metricsGrid}>
                <MetricCard
                    title="Properties"
                    value={`${TOTAL_PROPERTIES}`}
                    icon="business-outline"
                    color="#6366F1"
                    subtitle="3 types"
                />
                <MetricCard
                    title="Portfolio Value"
                    value={formatCurrency(TOTAL_PORTFOLIO_VALUE)}
                    icon="trending-up-outline"
                    color="#10B981"
                    subtitle={PORTFOLIO_TREND}
                />
                <MetricCard
                    title="Monthly Income"
                    value={formatCurrency(MONTHLY_RENTAL_INCOME)}
                    icon="cash-outline"
                    color="#3B82F6"
                    subtitle="Rental income"
                />
                <MetricCard
                    title="Occupancy"
                    value={`${AVG_OCCUPANCY}%`}
                    icon="people-outline"
                    color="#F59E0B"
                    subtitle="Avg rate"
                />
            </View>

            {/* Filter chips */}
            <FilterChips activeFilter={activeFilter} onFilter={setActiveFilter} />

            {/* Property groups */}
            {grouped.map((group) => {
                const isExpanded = !collapsedSections.has(group.type);
                const typeColor = TYPE_COLORS[group.type];
                const typeIcon = TYPE_ICONS[group.type];

                return (
                    <React.Fragment key={group.type}>
                        <SectionHeader
                            title={group.type}
                            icon={typeIcon}
                            iconColor={typeColor}
                            isExpanded={isExpanded}
                            onToggle={() => toggleSection(group.type)}
                            count={group.items.length}
                        />
                        {isExpanded && (
                            <View style={pageStyles.propertyList}>
                                {group.items.map((property) => (
                                    <PropertyCard
                                        key={property.id}
                                        property={property}
                                        isExpanded={expandedId === property.id}
                                        onToggle={() => toggleProperty(property.id)}
                                    />
                                ))}
                            </View>
                        )}
                    </React.Fragment>
                );
            })}
        </ScrollView>
    );
}

// --- Page Styles ---

const pageStyles = StyleSheet.create((theme) => ({
    hero: {
        alignItems: "center",
        paddingTop: 8,
        paddingBottom: 20,
        gap: 4
    },
    heroLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11,
        letterSpacing: 1.2,
        textTransform: "uppercase"
    },
    heroValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 42,
        lineHeight: 52,
        letterSpacing: -1
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
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13
    },
    metricsGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
        marginBottom: 20
    },
    propertyList: {
        gap: 10
    }
}));
