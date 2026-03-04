import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

// --- Types ---

type ContractStatus = "active" | "expiring" | "expired";
type StatusFilter = "all" | ContractStatus;
type VendorCategory = "Technology" | "Office Supplies" | "Professional Services" | "Marketing" | "Facilities";

interface Transaction {
    date: string;
    description: string;
    amount: number;
}

interface Vendor {
    id: string;
    name: string;
    category: VendorCategory;
    primaryContact: string;
    contactEmail: string;
    contractStatus: ContractStatus;
    annualSpend: number;
    rating: number;
    paymentTerms: string;
    contractStart: string;
    contractEnd: string;
    slaTerms: string;
    pendingApproval: boolean;
    transactions: Transaction[];
}

// --- Mock Data ---

const mockVendors: Vendor[] = [
    {
        id: "v1",
        name: "CloudSync Technologies",
        category: "Technology",
        primaryContact: "Derek Huang",
        contactEmail: "derek@cloudsync.io",
        contractStatus: "active",
        annualSpend: 84000,
        rating: 5,
        paymentTerms: "Net 30",
        contractStart: "Jan 1, 2025",
        contractEnd: "Dec 31, 2026",
        slaTerms: "99.9% uptime, 4h response time, 24/7 support",
        pendingApproval: false,
        transactions: [
            { date: "Feb 1, 2026", description: "Monthly SaaS license", amount: 7000 },
            { date: "Jan 1, 2026", description: "Monthly SaaS license", amount: 7000 },
            { date: "Dec 1, 2025", description: "Monthly SaaS license", amount: 7000 }
        ]
    },
    {
        id: "v2",
        name: "NetGuard Security",
        category: "Technology",
        primaryContact: "Priya Sharma",
        contactEmail: "priya@netguard.com",
        contractStatus: "expiring",
        annualSpend: 42000,
        rating: 4,
        paymentTerms: "Net 45",
        contractStart: "Apr 1, 2024",
        contractEnd: "Mar 31, 2026",
        slaTerms: "99.5% uptime, 1h incident response, quarterly audits",
        pendingApproval: false,
        transactions: [
            { date: "Feb 15, 2026", description: "Quarterly security audit", amount: 5000 },
            { date: "Jan 1, 2026", description: "Monthly monitoring fee", amount: 3500 },
            { date: "Dec 1, 2025", description: "Monthly monitoring fee", amount: 3500 }
        ]
    },
    {
        id: "v3",
        name: "DataVault Solutions",
        category: "Technology",
        primaryContact: "Marcus Bell",
        contactEmail: "marcus@datavault.io",
        contractStatus: "expired",
        annualSpend: 28000,
        rating: 3,
        paymentTerms: "Net 30",
        contractStart: "Jan 1, 2024",
        contractEnd: "Dec 31, 2025",
        slaTerms: "99% uptime, 8h response time",
        pendingApproval: true,
        transactions: [
            { date: "Dec 1, 2025", description: "Backup storage - final", amount: 2333 },
            { date: "Nov 1, 2025", description: "Backup storage", amount: 2333 }
        ]
    },
    {
        id: "v4",
        name: "PaperTrail Office Co.",
        category: "Office Supplies",
        primaryContact: "Janet Liu",
        contactEmail: "janet@papertrail.com",
        contractStatus: "active",
        annualSpend: 12500,
        rating: 4,
        paymentTerms: "Net 15",
        contractStart: "Jul 1, 2025",
        contractEnd: "Jun 30, 2026",
        slaTerms: "Next-day delivery, free returns within 30 days",
        pendingApproval: false,
        transactions: [
            { date: "Feb 20, 2026", description: "Q1 bulk order - paper, toner", amount: 3200 },
            { date: "Jan 10, 2026", description: "Ergonomic supplies", amount: 1800 }
        ]
    },
    {
        id: "v5",
        name: "FurnishPro",
        category: "Office Supplies",
        primaryContact: "Tom Henderson",
        contactEmail: "tom@furnishpro.com",
        contractStatus: "active",
        annualSpend: 35000,
        rating: 5,
        paymentTerms: "Net 30",
        contractStart: "Mar 1, 2025",
        contractEnd: "Feb 28, 2027",
        slaTerms: "2-week delivery, 5-year warranty on furniture",
        pendingApproval: false,
        transactions: [
            { date: "Feb 5, 2026", description: "Standing desks x12", amount: 9600 },
            { date: "Jan 15, 2026", description: "Conference chairs x20", amount: 6000 }
        ]
    },
    {
        id: "v6",
        name: "Sterling & Associates",
        category: "Professional Services",
        primaryContact: "Catherine Blackwell",
        contactEmail: "c.blackwell@sterling.law",
        contractStatus: "active",
        annualSpend: 96000,
        rating: 5,
        paymentTerms: "Net 60",
        contractStart: "Jan 1, 2026",
        contractEnd: "Dec 31, 2026",
        slaTerms: "48h document review, dedicated partner, monthly retainer",
        pendingApproval: false,
        transactions: [
            { date: "Mar 1, 2026", description: "Monthly legal retainer", amount: 8000 },
            { date: "Feb 1, 2026", description: "Monthly legal retainer", amount: 8000 },
            { date: "Jan 15, 2026", description: "Contract review - Meridian deal", amount: 3500 }
        ]
    },
    {
        id: "v7",
        name: "Apex Talent Partners",
        category: "Professional Services",
        primaryContact: "Lisa Okonkwo",
        contactEmail: "lisa@apextalent.com",
        contractStatus: "expiring",
        annualSpend: 68000,
        rating: 4,
        paymentTerms: "Net 30",
        contractStart: "Jun 1, 2024",
        contractEnd: "May 31, 2026",
        slaTerms: "3 candidate shortlist within 2 weeks, 90-day replacement guarantee",
        pendingApproval: true,
        transactions: [
            { date: "Feb 10, 2026", description: "Sr. Engineer placement fee", amount: 22000 },
            { date: "Jan 5, 2026", description: "Product Manager placement fee", amount: 18000 }
        ]
    },
    {
        id: "v8",
        name: "BrightWave Creative",
        category: "Marketing",
        primaryContact: "Yuki Tanaka",
        contactEmail: "yuki@brightwave.co",
        contractStatus: "active",
        annualSpend: 54000,
        rating: 4,
        paymentTerms: "Net 30",
        contractStart: "Sep 1, 2025",
        contractEnd: "Aug 31, 2026",
        slaTerms: "2 revision rounds per deliverable, 5-day turnaround",
        pendingApproval: false,
        transactions: [
            { date: "Feb 25, 2026", description: "Q1 campaign assets", amount: 12000 },
            { date: "Jan 20, 2026", description: "Brand refresh consultation", amount: 4500 }
        ]
    },
    {
        id: "v9",
        name: "Pixel & Prose Agency",
        category: "Marketing",
        primaryContact: "Andre Morales",
        contactEmail: "andre@pixelprose.io",
        contractStatus: "expired",
        annualSpend: 31000,
        rating: 2,
        paymentTerms: "Net 15",
        contractStart: "Jan 1, 2025",
        contractEnd: "Dec 31, 2025",
        slaTerms: "Weekly content calendar, 3 posts/week, monthly analytics report",
        pendingApproval: false,
        transactions: [
            { date: "Dec 15, 2025", description: "December content package", amount: 2500 },
            { date: "Nov 15, 2025", description: "November content package", amount: 2500 }
        ]
    },
    {
        id: "v10",
        name: "GreenScape Maintenance",
        category: "Facilities",
        primaryContact: "Roberto Diaz",
        contactEmail: "roberto@greenscape.com",
        contractStatus: "active",
        annualSpend: 18000,
        rating: 4,
        paymentTerms: "Net 30",
        contractStart: "Apr 1, 2025",
        contractEnd: "Mar 31, 2026",
        slaTerms: "Bi-weekly grounds maintenance, same-day emergency response",
        pendingApproval: false,
        transactions: [
            { date: "Feb 28, 2026", description: "February maintenance", amount: 1500 },
            { date: "Jan 31, 2026", description: "January maintenance", amount: 1500 },
            { date: "Jan 10, 2026", description: "Emergency snow removal", amount: 800 }
        ]
    },
    {
        id: "v11",
        name: "ClearAir HVAC Systems",
        category: "Facilities",
        primaryContact: "Nina Johansson",
        contactEmail: "nina@clearairhvac.com",
        contractStatus: "expiring",
        annualSpend: 24000,
        rating: 3,
        paymentTerms: "Net 45",
        contractStart: "May 1, 2024",
        contractEnd: "Apr 30, 2026",
        slaTerms: "Quarterly inspections, 24h emergency repair, parts warranty",
        pendingApproval: true,
        transactions: [
            { date: "Feb 1, 2026", description: "Q1 inspection", amount: 3000 },
            { date: "Jan 18, 2026", description: "Filter replacement - all units", amount: 2200 }
        ]
    }
];

const categories: { name: VendorCategory; icon: keyof typeof Ionicons.glyphMap }[] = [
    { name: "Technology", icon: "hardware-chip-outline" },
    { name: "Office Supplies", icon: "cube-outline" },
    { name: "Professional Services", icon: "briefcase-outline" },
    { name: "Marketing", icon: "megaphone-outline" },
    { name: "Facilities", icon: "business-outline" }
];

// --- Helpers ---

function formatCurrency(amount: number): string {
    return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function statusLabel(status: ContractStatus): string {
    if (status === "active") return "ACTIVE";
    if (status === "expiring") return "EXPIRING";
    return "EXPIRED";
}

function statusColor(status: ContractStatus, theme: { colors: Record<string, string> }): string {
    if (status === "active") return theme.colors.tertiary;
    if (status === "expiring") return "#F59E0B";
    return theme.colors.error;
}

function renderStars(rating: number, filledColor: string, emptyColor: string) {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
        stars.push(
            <Ionicons
                key={i}
                name={i <= rating ? "star" : "star-outline"}
                size={14}
                color={i <= rating ? filledColor : emptyColor}
            />
        );
    }
    return stars;
}

// --- Sub-components ---

function MetricCard({
    icon,
    iconColor,
    label,
    value,
    bgColor,
    textColor,
    subtextColor
}: {
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    label: string;
    value: string;
    bgColor: string;
    textColor: string;
    subtextColor: string;
}) {
    return (
        <View style={[styles.metricCard, { backgroundColor: bgColor }]}>
            <Ionicons name={icon} size={22} color={iconColor} />
            <Text style={[styles.metricValue, { color: textColor }]}>{value}</Text>
            <Text style={[styles.metricLabel, { color: subtextColor }]}>{label}</Text>
        </View>
    );
}

function StatusFilterPills({
    active,
    onSelect,
    counts,
    primaryColor,
    surfaceColor,
    textColor
}: {
    active: StatusFilter;
    onSelect: (filter: StatusFilter) => void;
    counts: Record<StatusFilter, number>;
    primaryColor: string;
    surfaceColor: string;
    textColor: string;
}) {
    const filters: { key: StatusFilter; label: string }[] = [
        { key: "all", label: "All" },
        { key: "active", label: "Active" },
        { key: "expiring", label: "Expiring" },
        { key: "expired", label: "Expired" }
    ];

    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsScroll}>
            {filters.map((f) => {
                const isActive = active === f.key;
                return (
                    <Pressable
                        key={f.key}
                        onPress={() => onSelect(f.key)}
                        style={[styles.pill, { backgroundColor: isActive ? primaryColor : surfaceColor }]}
                    >
                        <Text style={[styles.pillText, { color: isActive ? "#FFFFFF" : textColor }]}>{f.label}</Text>
                        <View
                            style={[
                                styles.pillBadge,
                                { backgroundColor: isActive ? "rgba(255,255,255,0.25)" : `${primaryColor}20` }
                            ]}
                        >
                            <Text style={[styles.pillBadgeText, { color: isActive ? "#FFFFFF" : primaryColor }]}>
                                {counts[f.key]}
                            </Text>
                        </View>
                    </Pressable>
                );
            })}
        </ScrollView>
    );
}

function VendorCard({ vendor, isExpanded, onToggle }: { vendor: Vendor; isExpanded: boolean; onToggle: () => void }) {
    const { theme } = useUnistyles();
    const color = statusColor(vendor.contractStatus, theme);
    const starColor = "#F59E0B";

    return (
        <Pressable onPress={onToggle} style={({ pressed }) => [pressed && { opacity: 0.92 }]}>
            <View
                style={[
                    styles.vendorCard,
                    {
                        backgroundColor: theme.colors.surfaceContainer,
                        borderColor: isExpanded ? theme.colors.primary : theme.colors.outlineVariant
                    }
                ]}
            >
                {/* Left accent stripe */}
                <View style={[styles.vendorStripe, { backgroundColor: color }]} />

                <View style={styles.vendorCardContent}>
                    {/* Top row: name + status chip */}
                    <View style={styles.vendorTopRow}>
                        <View style={styles.vendorNameCol}>
                            <Text style={[styles.vendorName, { color: theme.colors.onSurface }]} numberOfLines={1}>
                                {vendor.name}
                            </Text>
                            <Text style={[styles.vendorContact, { color: theme.colors.onSurfaceVariant }]}>
                                {vendor.primaryContact}
                            </Text>
                        </View>
                        <View style={[styles.statusChip, { backgroundColor: `${color}18` }]}>
                            <View style={[styles.statusDot, { backgroundColor: color }]} />
                            <Text style={[styles.statusChipText, { color }]}>{statusLabel(vendor.contractStatus)}</Text>
                        </View>
                    </View>

                    {/* Bottom row: annual spend, rating, payment terms */}
                    <View style={styles.vendorBottomRow}>
                        <Text style={[styles.vendorSpend, { color: theme.colors.onSurface }]}>
                            {formatCurrency(vendor.annualSpend)}
                        </Text>
                        <View style={styles.starsRow}>
                            {renderStars(vendor.rating, starColor, theme.colors.outlineVariant)}
                        </View>
                        <View style={[styles.paymentBadge, { backgroundColor: `${theme.colors.primary}14` }]}>
                            <Text style={[styles.paymentBadgeText, { color: theme.colors.primary }]}>
                                {vendor.paymentTerms}
                            </Text>
                        </View>
                    </View>

                    {/* Expanded detail panel */}
                    {isExpanded && (
                        <View style={[styles.expandedPanel, { borderTopColor: theme.colors.outlineVariant }]}>
                            {/* Contract dates */}
                            <Text style={[styles.expandedSectionTitle, { color: theme.colors.onSurface }]}>
                                Contract Details
                            </Text>
                            <View style={styles.expandedRow}>
                                <Ionicons name="calendar-outline" size={14} color={theme.colors.onSurfaceVariant} />
                                <Text style={[styles.expandedLabel, { color: theme.colors.onSurfaceVariant }]}>
                                    Period
                                </Text>
                                <Text style={[styles.expandedValue, { color: theme.colors.onSurface }]}>
                                    {vendor.contractStart} - {vendor.contractEnd}
                                </Text>
                            </View>
                            <View style={styles.expandedRow}>
                                <Ionicons name="mail-outline" size={14} color={theme.colors.onSurfaceVariant} />
                                <Text style={[styles.expandedLabel, { color: theme.colors.onSurfaceVariant }]}>
                                    Email
                                </Text>
                                <Text style={[styles.expandedValue, { color: theme.colors.primary }]}>
                                    {vendor.contactEmail}
                                </Text>
                            </View>

                            {/* SLA terms */}
                            <Text
                                style={[styles.expandedSectionTitle, { color: theme.colors.onSurface, marginTop: 12 }]}
                            >
                                SLA Terms
                            </Text>
                            <View
                                style={[
                                    styles.slaBox,
                                    {
                                        backgroundColor: `${theme.colors.primary}08`,
                                        borderColor: `${theme.colors.primary}20`
                                    }
                                ]}
                            >
                                <Ionicons name="shield-checkmark-outline" size={14} color={theme.colors.primary} />
                                <Text style={[styles.slaText, { color: theme.colors.onSurfaceVariant }]}>
                                    {vendor.slaTerms}
                                </Text>
                            </View>

                            {/* Transaction history */}
                            <Text
                                style={[styles.expandedSectionTitle, { color: theme.colors.onSurface, marginTop: 12 }]}
                            >
                                Recent Transactions
                            </Text>
                            <View style={styles.transactionList}>
                                {vendor.transactions.map((txn, idx) => (
                                    <View
                                        key={`${txn.date}-${idx}`}
                                        style={[
                                            styles.transactionRow,
                                            idx < vendor.transactions.length - 1 && {
                                                borderBottomWidth: StyleSheet.hairlineWidth,
                                                borderBottomColor: theme.colors.outlineVariant
                                            }
                                        ]}
                                    >
                                        {/* Timeline dot and line */}
                                        <View style={styles.timelineDotCol}>
                                            <View
                                                style={[styles.timelineDot, { backgroundColor: theme.colors.primary }]}
                                            />
                                            {idx < vendor.transactions.length - 1 && (
                                                <View
                                                    style={[
                                                        styles.timelineLine,
                                                        { backgroundColor: theme.colors.outlineVariant }
                                                    ]}
                                                />
                                            )}
                                        </View>
                                        <View style={styles.transactionContent}>
                                            <Text
                                                style={[
                                                    styles.transactionDate,
                                                    { color: theme.colors.onSurfaceVariant }
                                                ]}
                                            >
                                                {txn.date}
                                            </Text>
                                            <Text
                                                style={[styles.transactionDesc, { color: theme.colors.onSurface }]}
                                                numberOfLines={1}
                                            >
                                                {txn.description}
                                            </Text>
                                        </View>
                                        <Text style={[styles.transactionAmount, { color: theme.colors.onSurface }]}>
                                            {formatCurrency(txn.amount)}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
                </View>
            </View>
        </Pressable>
    );
}

function CategorySection({
    category,
    icon,
    vendors,
    expandedId,
    onToggle,
    textColor,
    subtextColor,
    primaryColor
}: {
    category: VendorCategory;
    icon: keyof typeof Ionicons.glyphMap;
    vendors: Vendor[];
    expandedId: string | null;
    onToggle: (id: string) => void;
    textColor: string;
    subtextColor: string;
    primaryColor: string;
}) {
    const totalSpend = vendors.reduce((sum, v) => sum + v.annualSpend, 0);

    return (
        <View style={styles.categorySection}>
            {/* Category header */}
            <View style={styles.categoryHeader}>
                <Ionicons name={icon} size={18} color={primaryColor} />
                <Text style={[styles.categoryTitle, { color: textColor }]}>{category}</Text>
                <View style={[styles.categoryCountBadge, { backgroundColor: `${primaryColor}18` }]}>
                    <Text style={[styles.categoryCountText, { color: primaryColor }]}>{vendors.length}</Text>
                </View>
                <View style={{ flex: 1 }} />
                <Text style={[styles.categorySpend, { color: subtextColor }]}>{formatCurrency(totalSpend)}</Text>
            </View>

            {/* Vendor cards */}
            <View style={styles.vendorList}>
                {vendors.map((vendor) => (
                    <VendorCard
                        key={vendor.id}
                        vendor={vendor}
                        isExpanded={expandedId === vendor.id}
                        onToggle={() => onToggle(vendor.id)}
                    />
                ))}
            </View>
        </View>
    );
}

// --- Main Component ---

/**
 * Vendor management directory showcase page.
 * Displays vendor count metrics, status filter pills, and vendors grouped by category
 * with expandable detail panels showing contract info and transaction history.
 */
export function VendorDirectoryPage() {
    const { theme } = useUnistyles();
    const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
    const [expandedVendorId, setExpandedVendorId] = React.useState<string | null>(null);

    // Computed metrics
    const totalVendors = mockVendors.length;
    const pendingApprovalCount = mockVendors.filter((v) => v.pendingApproval).length;
    const activeCount = mockVendors.filter((v) => v.contractStatus === "active").length;
    const totalAnnualSpend = mockVendors.reduce((sum, v) => sum + v.annualSpend, 0);

    // Status counts for filter pills
    const statusCounts: Record<StatusFilter, number> = {
        all: totalVendors,
        active: mockVendors.filter((v) => v.contractStatus === "active").length,
        expiring: mockVendors.filter((v) => v.contractStatus === "expiring").length,
        expired: mockVendors.filter((v) => v.contractStatus === "expired").length
    };

    // Filter vendors by status
    const filteredVendors = React.useMemo(() => {
        if (statusFilter === "all") return mockVendors;
        return mockVendors.filter((v) => v.contractStatus === statusFilter);
    }, [statusFilter]);

    // Group filtered vendors by category
    const vendorsByCategory = React.useMemo(() => {
        const map = new Map<VendorCategory, Vendor[]>();
        for (const cat of categories) {
            map.set(cat.name, []);
        }
        for (const vendor of filteredVendors) {
            map.get(vendor.category)!.push(vendor);
        }
        return map;
    }, [filteredVendors]);

    const handleToggleVendor = React.useCallback((id: string) => {
        setExpandedVendorId((prev) => (prev === id ? null : id));
    }, []);

    return (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Metric cards row */}
            <View style={styles.metricsRow}>
                <MetricCard
                    icon="people-outline"
                    iconColor={theme.colors.primary}
                    label="Total Vendors"
                    value={String(totalVendors)}
                    bgColor={theme.colors.surfaceContainer}
                    textColor={theme.colors.onSurface}
                    subtextColor={theme.colors.onSurfaceVariant}
                />
                <MetricCard
                    icon="time-outline"
                    iconColor="#F59E0B"
                    label="Pending Approval"
                    value={String(pendingApprovalCount)}
                    bgColor={theme.colors.surfaceContainer}
                    textColor={theme.colors.onSurface}
                    subtextColor={theme.colors.onSurfaceVariant}
                />
            </View>

            {/* Secondary metrics */}
            <View style={styles.metricsRow}>
                <MetricCard
                    icon="checkmark-circle-outline"
                    iconColor={theme.colors.tertiary}
                    label="Active Contracts"
                    value={String(activeCount)}
                    bgColor={theme.colors.surfaceContainer}
                    textColor={theme.colors.onSurface}
                    subtextColor={theme.colors.onSurfaceVariant}
                />
                <MetricCard
                    icon="wallet-outline"
                    iconColor={theme.colors.primary}
                    label="Annual Spend"
                    value={formatCurrency(totalAnnualSpend)}
                    bgColor={theme.colors.surfaceContainer}
                    textColor={theme.colors.onSurface}
                    subtextColor={theme.colors.onSurfaceVariant}
                />
            </View>

            {/* Status filter */}
            <StatusFilterPills
                active={statusFilter}
                onSelect={setStatusFilter}
                counts={statusCounts}
                primaryColor={theme.colors.primary}
                surfaceColor={theme.colors.surfaceContainerHighest}
                textColor={theme.colors.onSurfaceVariant}
            />

            {/* Vendor categories */}
            <View style={styles.categoriesContainer}>
                {categories.map((cat) => {
                    const vendors = vendorsByCategory.get(cat.name) ?? [];
                    if (vendors.length === 0) return null;
                    return (
                        <CategorySection
                            key={cat.name}
                            category={cat.name}
                            icon={cat.icon}
                            vendors={vendors}
                            expandedId={expandedVendorId}
                            onToggle={handleToggleVendor}
                            textColor={theme.colors.onSurface}
                            subtextColor={theme.colors.onSurfaceVariant}
                            primaryColor={theme.colors.primary}
                        />
                    );
                })}
            </View>
        </ScrollView>
    );
}

// --- Styles ---

const styles = StyleSheet.create((_theme) => ({
    scrollContent: {
        maxWidth: 600,
        width: "100%",
        alignSelf: "center",
        paddingBottom: 48
    },

    // Metric cards
    metricsRow: {
        flexDirection: "row",
        gap: 10,
        paddingHorizontal: 16,
        marginTop: 12
    },
    metricCard: {
        flex: 1,
        borderRadius: 12,
        padding: 16,
        alignItems: "center",
        gap: 4
    },
    metricValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 22,
        letterSpacing: -0.5
    },
    metricLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11,
        letterSpacing: 0.3,
        textTransform: "uppercase"
    },

    // Filter pills
    pillsScroll: {
        paddingHorizontal: 16,
        gap: 8,
        paddingTop: 16,
        paddingBottom: 8
    },
    pill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20
    },
    pillText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 12
    },
    pillBadge: {
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center"
    },
    pillBadgeText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 10
    },

    // Categories
    categoriesContainer: {
        paddingHorizontal: 16,
        gap: 20,
        marginTop: 12
    },
    categorySection: {
        gap: 8
    },
    categoryHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingBottom: 4
    },
    categoryTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15
    },
    categoryCountBadge: {
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: "center",
        justifyContent: "center"
    },
    categoryCountText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 11
    },
    categorySpend: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 13
    },

    // Vendor list
    vendorList: {
        gap: 8
    },

    // Vendor card
    vendorCard: {
        borderRadius: 12,
        borderWidth: 1,
        overflow: "hidden",
        flexDirection: "row"
    },
    vendorStripe: {
        width: 4
    },
    vendorCardContent: {
        flex: 1,
        padding: 14,
        gap: 10
    },
    vendorTopRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 10
    },
    vendorNameCol: {
        flex: 1,
        gap: 2
    },
    vendorName: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15
    },
    vendorContact: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    statusChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3
    },
    statusChipText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 10,
        letterSpacing: 0.5
    },
    vendorBottomRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12
    },
    vendorSpend: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 14
    },
    starsRow: {
        flexDirection: "row",
        gap: 2
    },
    paymentBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10
    },
    paymentBadgeText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11
    },

    // Expanded detail panel
    expandedPanel: {
        borderTopWidth: 1,
        paddingTop: 12,
        gap: 6
    },
    expandedSectionTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 13,
        letterSpacing: -0.1,
        marginBottom: 4
    },
    expandedRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8
    },
    expandedLabel: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 12,
        width: 52
    },
    expandedValue: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        flex: 1,
        lineHeight: 18
    },

    // SLA box
    slaBox: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
        padding: 10,
        borderRadius: 8,
        borderWidth: 1
    },
    slaText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        flex: 1,
        lineHeight: 18
    },

    // Transaction history timeline
    transactionList: {
        gap: 0
    },
    transactionRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        paddingVertical: 8,
        gap: 10
    },
    timelineDotCol: {
        width: 12,
        alignItems: "center",
        paddingTop: 4
    },
    timelineDot: {
        width: 8,
        height: 8,
        borderRadius: 4
    },
    timelineLine: {
        width: 2,
        flex: 1,
        marginTop: 4
    },
    transactionContent: {
        flex: 1,
        gap: 2
    },
    transactionDate: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },
    transactionDesc: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 12
    },
    transactionAmount: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 13
    }
}));
