import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

// --- Types ---

interface Product {
    id: string;
    name: string;
    sku: string;
    category: string;
    currentStock: number;
    reorderPoint: number;
    unitPrice: number;
    supplier: string;
    lastRestocked: string;
    location: string;
}

// --- Mock Data ---

const mockProducts: Product[] = [
    // Electronics
    {
        id: "p1",
        name: "Wireless Bluetooth Earbuds",
        sku: "ELEC-4810",
        category: "Electronics",
        currentStock: 3,
        reorderPoint: 15,
        unitPrice: 49.99,
        supplier: "SoundTech Co.",
        lastRestocked: "Feb 12, 2026",
        location: "Warehouse A, Shelf 3"
    },
    {
        id: "p2",
        name: "USB-C Hub 7-in-1 Adapter",
        sku: "ELEC-4822",
        category: "Electronics",
        currentStock: 42,
        reorderPoint: 20,
        unitPrice: 34.95,
        supplier: "ConnectPro Ltd.",
        lastRestocked: "Feb 28, 2026",
        location: "Warehouse A, Shelf 5"
    },
    {
        id: "p3",
        name: "Mechanical Keyboard RGB",
        sku: "ELEC-4835",
        category: "Electronics",
        currentStock: 8,
        reorderPoint: 10,
        unitPrice: 89.99,
        supplier: "KeyCraft Inc.",
        lastRestocked: "Jan 20, 2026",
        location: "Warehouse A, Shelf 2"
    },
    {
        id: "p4",
        name: "Portable Power Bank 20000mAh",
        sku: "ELEC-4841",
        category: "Electronics",
        currentStock: 61,
        reorderPoint: 25,
        unitPrice: 29.99,
        supplier: "SoundTech Co.",
        lastRestocked: "Mar 1, 2026",
        location: "Warehouse A, Shelf 7"
    },
    // Office Supplies
    {
        id: "p5",
        name: "Premium Gel Pen Set (12pk)",
        sku: "OFFC-2010",
        category: "Office Supplies",
        currentStock: 5,
        reorderPoint: 30,
        unitPrice: 12.49,
        supplier: "Scribers Plus",
        lastRestocked: "Jan 15, 2026",
        location: "Warehouse B, Bin 12"
    },
    {
        id: "p6",
        name: "A4 Copy Paper (500 sheets)",
        sku: "OFFC-2015",
        category: "Office Supplies",
        currentStock: 120,
        reorderPoint: 50,
        unitPrice: 8.99,
        supplier: "PaperMill Direct",
        lastRestocked: "Feb 25, 2026",
        location: "Warehouse B, Pallet 3"
    },
    {
        id: "p7",
        name: "Sticky Notes Assorted (8pk)",
        sku: "OFFC-2023",
        category: "Office Supplies",
        currentStock: 2,
        reorderPoint: 20,
        unitPrice: 6.99,
        supplier: "Scribers Plus",
        lastRestocked: "Dec 10, 2025",
        location: "Warehouse B, Bin 8"
    },
    // Home & Garden
    {
        id: "p8",
        name: "Bamboo Cutting Board Set",
        sku: "HOME-7100",
        category: "Home & Garden",
        currentStock: 18,
        reorderPoint: 12,
        unitPrice: 24.99,
        supplier: "EcoHome Goods",
        lastRestocked: "Feb 18, 2026",
        location: "Warehouse C, Shelf 1"
    },
    {
        id: "p9",
        name: "Ceramic Planter Pot (Medium)",
        sku: "HOME-7115",
        category: "Home & Garden",
        currentStock: 4,
        reorderPoint: 15,
        unitPrice: 19.99,
        supplier: "GreenLeaf Supply",
        lastRestocked: "Jan 5, 2026",
        location: "Warehouse C, Shelf 4"
    },
    {
        id: "p10",
        name: "LED String Lights (10m)",
        sku: "HOME-7128",
        category: "Home & Garden",
        currentStock: 33,
        reorderPoint: 10,
        unitPrice: 15.49,
        supplier: "EcoHome Goods",
        lastRestocked: "Feb 22, 2026",
        location: "Warehouse C, Shelf 6"
    },
    // Health & Wellness
    {
        id: "p11",
        name: "Yoga Mat Premium (6mm)",
        sku: "HLTH-3050",
        category: "Health & Wellness",
        currentStock: 7,
        reorderPoint: 10,
        unitPrice: 34.99,
        supplier: "FitPro Wholesale",
        lastRestocked: "Feb 5, 2026",
        location: "Warehouse D, Shelf 2"
    },
    {
        id: "p12",
        name: "Stainless Steel Water Bottle",
        sku: "HLTH-3062",
        category: "Health & Wellness",
        currentStock: 55,
        reorderPoint: 20,
        unitPrice: 22.99,
        supplier: "FitPro Wholesale",
        lastRestocked: "Mar 1, 2026",
        location: "Warehouse D, Shelf 1"
    },
    {
        id: "p13",
        name: "Resistance Band Set (5pk)",
        sku: "HLTH-3078",
        category: "Health & Wellness",
        currentStock: 1,
        reorderPoint: 12,
        unitPrice: 18.49,
        supplier: "FitPro Wholesale",
        lastRestocked: "Dec 20, 2025",
        location: "Warehouse D, Shelf 3"
    }
];

// --- Helpers ---

function formatCurrency(amount: number): string {
    return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function isLowStock(product: Product): boolean {
    return product.currentStock < product.reorderPoint;
}

function stockRatio(product: Product): number {
    // Ratio relative to twice the reorder point as a reasonable "full" stock level
    const fullLevel = product.reorderPoint * 3;
    return Math.min(product.currentStock / fullLevel, 1);
}

function categoryIcon(category: string): keyof typeof Ionicons.glyphMap {
    switch (category) {
        case "Electronics":
            return "hardware-chip-outline";
        case "Office Supplies":
            return "briefcase-outline";
        case "Home & Garden":
            return "leaf-outline";
        case "Health & Wellness":
            return "fitness-outline";
        default:
            return "cube-outline";
    }
}

const supplierColors: Record<string, string> = {
    "SoundTech Co.": "#6366F1",
    "ConnectPro Ltd.": "#3B82F6",
    "KeyCraft Inc.": "#8B5CF6",
    "Scribers Plus": "#EC4899",
    "PaperMill Direct": "#F59E0B",
    "EcoHome Goods": "#10B981",
    "GreenLeaf Supply": "#14B8A6",
    "FitPro Wholesale": "#EF4444"
};

function getSupplierColor(supplier: string): string {
    return supplierColors[supplier] ?? "#6B7280";
}

// --- Sub-components ---

/** Warning banner showing items that need reordering */
function ReorderBanner({
    items,
    onDismiss,
    dismissedIds
}: {
    items: Product[];
    onDismiss: (id: string) => void;
    dismissedIds: Set<string>;
}) {
    const { theme } = useUnistyles();
    const visibleItems = items.filter((p) => !dismissedIds.has(p.id));

    if (visibleItems.length === 0) return null;

    return (
        <View style={[styles.bannerContainer, { backgroundColor: `${theme.colors.error}10` }]}>
            <View style={styles.bannerHeader}>
                <View style={[styles.bannerIconCircle, { backgroundColor: `${theme.colors.error}20` }]}>
                    <Ionicons name="warning-outline" size={20} color={theme.colors.error} />
                </View>
                <View style={styles.bannerHeaderText}>
                    <Text style={[styles.bannerTitle, { color: theme.colors.error }]}>Reorder Required</Text>
                    <Text style={[styles.bannerSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                        {visibleItems.length} item{visibleItems.length !== 1 ? "s" : ""} below reorder point
                    </Text>
                </View>
            </View>
            <View style={styles.bannerItemsList}>
                {visibleItems.map((product) => (
                    <View key={product.id} style={[styles.bannerItem, { borderColor: `${theme.colors.error}30` }]}>
                        <View style={styles.bannerItemInfo}>
                            <View style={[styles.bannerStockDot, { backgroundColor: theme.colors.error }]} />
                            <View style={styles.bannerItemTextCol}>
                                <Text
                                    style={[styles.bannerItemName, { color: theme.colors.onSurface }]}
                                    numberOfLines={1}
                                >
                                    {product.name}
                                </Text>
                                <Text style={[styles.bannerItemDetail, { color: theme.colors.onSurfaceVariant }]}>
                                    {product.currentStock} left / reorder at {product.reorderPoint}
                                </Text>
                            </View>
                        </View>
                        <Pressable
                            onPress={() => onDismiss(product.id)}
                            hitSlop={8}
                            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
                        >
                            <Ionicons name="close-circle" size={20} color={`${theme.colors.error}80`} />
                        </Pressable>
                    </View>
                ))}
            </View>
        </View>
    );
}

/** Summary metric card */
function MetricCard({
    icon,
    iconColor,
    label,
    value,
    badge
}: {
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    label: string;
    value: string;
    badge?: { text: string; color: string };
}) {
    const { theme } = useUnistyles();
    return (
        <View style={[styles.metricCard, { backgroundColor: theme.colors.surfaceContainer }]}>
            <View style={styles.metricCardTop}>
                <View style={[styles.metricIconCircle, { backgroundColor: `${iconColor}18` }]}>
                    <Ionicons name={icon} size={18} color={iconColor} />
                </View>
                {badge && (
                    <View style={[styles.metricBadge, { backgroundColor: `${badge.color}18` }]}>
                        <Text style={[styles.metricBadgeText, { color: badge.color }]}>{badge.text}</Text>
                    </View>
                )}
            </View>
            <Text style={[styles.metricValue, { color: theme.colors.onSurface }]}>{value}</Text>
            <Text style={[styles.metricLabel, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
        </View>
    );
}

/** Stock level progress bar */
function StockBar({ product, errorColor }: { product: Product; errorColor: string }) {
    const { theme } = useUnistyles();
    const ratio = stockRatio(product);
    const low = isLowStock(product);
    const barColor = low ? errorColor : theme.colors.primary;
    const reorderRatio = product.reorderPoint / (product.reorderPoint * 3);

    return (
        <View style={styles.stockBarContainer}>
            <View style={[styles.stockBarTrack, { backgroundColor: theme.colors.outlineVariant }]}>
                <View
                    style={[
                        styles.stockBarFill,
                        {
                            backgroundColor: barColor,
                            width: `${Math.max(ratio * 100, 2)}%`
                        }
                    ]}
                />
                {/* Reorder point marker */}
                <View
                    style={[
                        styles.stockBarMarker,
                        {
                            left: `${reorderRatio * 100}%`,
                            backgroundColor: theme.colors.onSurfaceVariant
                        }
                    ]}
                />
            </View>
        </View>
    );
}

/** Individual product row with expandable details */
function ProductRow({
    product,
    isExpanded,
    onToggle
}: {
    product: Product;
    isExpanded: boolean;
    onToggle: () => void;
}) {
    const { theme } = useUnistyles();
    const low = isLowStock(product);
    const supplierColor = getSupplierColor(product.supplier);

    return (
        <Pressable onPress={onToggle} style={({ pressed }) => [pressed && { opacity: 0.92 }]}>
            <View
                style={[
                    styles.productRow,
                    {
                        backgroundColor: theme.colors.surfaceContainer,
                        borderColor: isExpanded ? theme.colors.primary : theme.colors.outlineVariant
                    }
                ]}
            >
                {/* Left accent for low stock */}
                {low && <View style={[styles.productLowStripe, { backgroundColor: theme.colors.error }]} />}

                <View style={[styles.productRowContent, !low && { paddingLeft: 14 }]}>
                    {/* Top: Name and Price */}
                    <View style={styles.productTopRow}>
                        <View style={styles.productNameCol}>
                            <Text style={[styles.productName, { color: theme.colors.onSurface }]} numberOfLines={1}>
                                {product.name}
                            </Text>
                            <Text style={[styles.productSku, { color: theme.colors.onSurfaceVariant }]}>
                                {product.sku}
                            </Text>
                        </View>
                        <Text style={[styles.productPrice, { color: theme.colors.onSurface }]}>
                            {formatCurrency(product.unitPrice)}
                        </Text>
                    </View>

                    {/* Middle: Stock bar + Stock numbers */}
                    <View style={styles.productStockSection}>
                        <View style={styles.productStockNumbers}>
                            <Text
                                style={[
                                    styles.productStockValue,
                                    { color: low ? theme.colors.error : theme.colors.onSurface }
                                ]}
                            >
                                {product.currentStock}
                            </Text>
                            <Text style={[styles.productStockSep, { color: theme.colors.outline }]}>/</Text>
                            <Text style={[styles.productReorderValue, { color: theme.colors.onSurfaceVariant }]}>
                                {product.reorderPoint}
                            </Text>
                            {low && (
                                <Ionicons
                                    name="arrow-down"
                                    size={12}
                                    color={theme.colors.error}
                                    style={{ marginLeft: 2 }}
                                />
                            )}
                        </View>
                        <StockBar product={product} errorColor={theme.colors.error} />
                    </View>

                    {/* Bottom: Supplier badge */}
                    <View style={styles.productBottomRow}>
                        <View style={[styles.supplierBadge, { backgroundColor: `${supplierColor}14` }]}>
                            <View style={[styles.supplierDot, { backgroundColor: supplierColor }]} />
                            <Text style={[styles.supplierText, { color: supplierColor }]}>{product.supplier}</Text>
                        </View>
                        <Ionicons
                            name={isExpanded ? "chevron-up" : "chevron-down"}
                            size={16}
                            color={theme.colors.onSurfaceVariant}
                        />
                    </View>

                    {/* Expanded details */}
                    {isExpanded && (
                        <View style={[styles.productExpanded, { borderTopColor: theme.colors.outlineVariant }]}>
                            <View style={styles.expandedRow}>
                                <Ionicons name="location-outline" size={14} color={theme.colors.onSurfaceVariant} />
                                <Text style={[styles.expandedLabel, { color: theme.colors.onSurfaceVariant }]}>
                                    Location
                                </Text>
                                <Text style={[styles.expandedValue, { color: theme.colors.onSurface }]}>
                                    {product.location}
                                </Text>
                            </View>
                            <View style={styles.expandedRow}>
                                <Ionicons name="refresh-outline" size={14} color={theme.colors.onSurfaceVariant} />
                                <Text style={[styles.expandedLabel, { color: theme.colors.onSurfaceVariant }]}>
                                    Last Restocked
                                </Text>
                                <Text style={[styles.expandedValue, { color: theme.colors.onSurface }]}>
                                    {product.lastRestocked}
                                </Text>
                            </View>
                            <View style={styles.expandedRow}>
                                <Ionicons name="cash-outline" size={14} color={theme.colors.onSurfaceVariant} />
                                <Text style={[styles.expandedLabel, { color: theme.colors.onSurfaceVariant }]}>
                                    Stock Value
                                </Text>
                                <Text style={[styles.expandedValue, { color: theme.colors.onSurface }]}>
                                    {formatCurrency(product.currentStock * product.unitPrice)}
                                </Text>
                            </View>
                            {low && (
                                <View
                                    style={[styles.expandedReorderNote, { backgroundColor: `${theme.colors.error}10` }]}
                                >
                                    <Ionicons name="alert-circle" size={14} color={theme.colors.error} />
                                    <Text style={[styles.expandedReorderText, { color: theme.colors.error }]}>
                                        Need to order {product.reorderPoint - product.currentStock} more units to reach
                                        reorder point
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}
                </View>
            </View>
        </Pressable>
    );
}

/** Category section header */
function CategoryHeader({ category, count, totalValue }: { category: string; count: number; totalValue: number }) {
    const { theme } = useUnistyles();
    const icon = categoryIcon(category);

    return (
        <View style={styles.categoryHeader}>
            <View style={[styles.categoryIconCircle, { backgroundColor: `${theme.colors.primary}18` }]}>
                <Ionicons name={icon} size={16} color={theme.colors.primary} />
            </View>
            <Text style={[styles.categoryName, { color: theme.colors.onSurface }]}>{category}</Text>
            <View style={[styles.categoryCountBadge, { backgroundColor: `${theme.colors.primary}18` }]}>
                <Text style={[styles.categoryCountText, { color: theme.colors.primary }]}>{count}</Text>
            </View>
            <View style={{ flex: 1 }} />
            <Text style={[styles.categoryValue, { color: theme.colors.onSurfaceVariant }]}>
                {formatCurrency(totalValue)}
            </Text>
        </View>
    );
}

// --- Main Component ---

/**
 * Product inventory management showcase page.
 * Displays summary metrics, low-stock reorder alerts, and products grouped by category
 * with stock level indicators and expandable details.
 */
export function InventoryManagementPage() {
    const { theme } = useUnistyles();
    const [expandedProductId, setExpandedProductId] = React.useState<string | null>(null);
    const [dismissedAlerts, setDismissedAlerts] = React.useState<Set<string>>(new Set());

    // Computed metrics
    const totalSKUs = mockProducts.length;
    const lowStockItems = mockProducts.filter(isLowStock);
    const totalInventoryValue = mockProducts.reduce((sum, p) => sum + p.currentStock * p.unitPrice, 0);

    // Group products by category
    const categories = React.useMemo(() => {
        const map = new Map<string, Product[]>();
        for (const product of mockProducts) {
            const list = map.get(product.category) ?? [];
            list.push(product);
            map.set(product.category, list);
        }
        return map;
    }, []);

    const handleToggleProduct = React.useCallback((productId: string) => {
        setExpandedProductId((prev) => (prev === productId ? null : productId));
    }, []);

    const handleDismissAlert = React.useCallback((productId: string) => {
        setDismissedAlerts((prev) => {
            const next = new Set(prev);
            next.add(productId);
            return next;
        });
    }, []);

    return (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Reorder Alert Banner */}
            <ReorderBanner items={lowStockItems} onDismiss={handleDismissAlert} dismissedIds={dismissedAlerts} />

            {/* Summary Metrics */}
            <View style={styles.metricsRow}>
                <MetricCard
                    icon="cube-outline"
                    iconColor={theme.colors.primary}
                    label="Total SKUs"
                    value={String(totalSKUs)}
                />
                <MetricCard
                    icon="alert-circle-outline"
                    iconColor={theme.colors.error}
                    label="Low Stock"
                    value={String(lowStockItems.length)}
                    badge={{ text: "ALERT", color: theme.colors.error }}
                />
                <MetricCard
                    icon="wallet-outline"
                    iconColor="#10B981"
                    label="Total Value"
                    value={formatCurrency(totalInventoryValue)}
                />
            </View>

            {/* Stock Overview Mini Stats */}
            <View style={[styles.overviewCard, { backgroundColor: theme.colors.surfaceContainer }]}>
                <Text style={[styles.overviewTitle, { color: theme.colors.onSurface }]}>Stock Overview</Text>
                <View style={styles.overviewStatsRow}>
                    <View style={styles.overviewStat}>
                        <Text style={[styles.overviewStatValue, { color: theme.colors.primary }]}>
                            {mockProducts.filter((p) => p.currentStock >= p.reorderPoint * 2).length}
                        </Text>
                        <Text style={[styles.overviewStatLabel, { color: theme.colors.onSurfaceVariant }]}>
                            Well Stocked
                        </Text>
                    </View>
                    <View style={[styles.overviewDivider, { backgroundColor: theme.colors.outlineVariant }]} />
                    <View style={styles.overviewStat}>
                        <Text style={[styles.overviewStatValue, { color: "#F59E0B" }]}>
                            {mockProducts.filter((p) => !isLowStock(p) && p.currentStock < p.reorderPoint * 2).length}
                        </Text>
                        <Text style={[styles.overviewStatLabel, { color: theme.colors.onSurfaceVariant }]}>
                            Adequate
                        </Text>
                    </View>
                    <View style={[styles.overviewDivider, { backgroundColor: theme.colors.outlineVariant }]} />
                    <View style={styles.overviewStat}>
                        <Text style={[styles.overviewStatValue, { color: theme.colors.error }]}>
                            {lowStockItems.length}
                        </Text>
                        <Text style={[styles.overviewStatLabel, { color: theme.colors.onSurfaceVariant }]}>
                            Low Stock
                        </Text>
                    </View>
                    <View style={[styles.overviewDivider, { backgroundColor: theme.colors.outlineVariant }]} />
                    <View style={styles.overviewStat}>
                        <Text style={[styles.overviewStatValue, { color: theme.colors.onSurface }]}>
                            {new Set(mockProducts.map((p) => p.supplier)).size}
                        </Text>
                        <Text style={[styles.overviewStatLabel, { color: theme.colors.onSurfaceVariant }]}>
                            Suppliers
                        </Text>
                    </View>
                </View>
            </View>

            {/* Products grouped by category */}
            <View style={styles.categoriesContainer}>
                <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Products by Category</Text>
                {Array.from(categories.entries()).map(([category, products]) => {
                    const categoryValue = products.reduce((sum, p) => sum + p.currentStock * p.unitPrice, 0);
                    return (
                        <View key={category} style={styles.categoryGroup}>
                            <CategoryHeader category={category} count={products.length} totalValue={categoryValue} />
                            <View style={styles.productsList}>
                                {products.map((product) => (
                                    <ProductRow
                                        key={product.id}
                                        product={product}
                                        isExpanded={expandedProductId === product.id}
                                        onToggle={() => handleToggleProduct(product.id)}
                                    />
                                ))}
                            </View>
                        </View>
                    );
                })}
            </View>
        </ScrollView>
    );
}

// --- Styles ---

const styles = StyleSheet.create((theme) => ({
    scrollContent: {
        maxWidth: theme.layout.maxWidth,
        width: "100%",
        alignSelf: "center",
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 48
    },

    // Reorder banner
    bannerContainer: {
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
        gap: 12
    },
    bannerHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12
    },
    bannerIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center"
    },
    bannerHeaderText: {
        flex: 1,
        gap: 1
    },
    bannerTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15,
        letterSpacing: -0.2
    },
    bannerSubtitle: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    bannerItemsList: {
        gap: 6
    },
    bannerItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1
    },
    bannerItemInfo: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        flex: 1
    },
    bannerStockDot: {
        width: 8,
        height: 8,
        borderRadius: 4
    },
    bannerItemTextCol: {
        flex: 1,
        gap: 1
    },
    bannerItemName: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13
    },
    bannerItemDetail: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11
    },

    // Metrics row
    metricsRow: {
        flexDirection: "row",
        gap: 10,
        marginBottom: 16
    },
    metricCard: {
        flex: 1,
        borderRadius: 14,
        padding: 14,
        gap: 6
    },
    metricCardTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    metricIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center"
    },
    metricBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8
    },
    metricBadgeText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 9,
        letterSpacing: 0.5
    },
    metricValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 18,
        letterSpacing: -0.3
    },
    metricLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11,
        letterSpacing: 0.3,
        textTransform: "uppercase"
    },

    // Overview card
    overviewCard: {
        borderRadius: 14,
        padding: 18,
        marginBottom: 24,
        gap: 14
    },
    overviewTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15,
        letterSpacing: -0.2
    },
    overviewStatsRow: {
        flexDirection: "row",
        alignItems: "center"
    },
    overviewStat: {
        flex: 1,
        alignItems: "center",
        gap: 2
    },
    overviewStatValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 20,
        letterSpacing: -0.5
    },
    overviewStatLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 10,
        letterSpacing: 0.3,
        textTransform: "uppercase"
    },
    overviewDivider: {
        width: 1,
        height: 30
    },

    // Categories container
    categoriesContainer: {
        gap: 20
    },
    sectionTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 16,
        letterSpacing: -0.2
    },
    categoryGroup: {
        gap: 8
    },

    // Category header
    categoryHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingBottom: 4
    },
    categoryIconCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center"
    },
    categoryName: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 14
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
    categoryValue: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 12
    },

    // Product list
    productsList: {
        gap: 8
    },

    // Product row
    productRow: {
        borderRadius: 12,
        borderWidth: 1,
        overflow: "hidden",
        flexDirection: "row"
    },
    productLowStripe: {
        width: 4
    },
    productRowContent: {
        flex: 1,
        padding: 14,
        paddingLeft: 10,
        gap: 10
    },

    // Product top row
    productTopRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 12
    },
    productNameCol: {
        flex: 1,
        gap: 2
    },
    productName: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14
    },
    productSku: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11
    },
    productPrice: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15,
        letterSpacing: -0.3
    },

    // Stock section
    productStockSection: {
        gap: 6
    },
    productStockNumbers: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3
    },
    productStockValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 14
    },
    productStockSep: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    productReorderValue: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },

    // Stock bar
    stockBarContainer: {
        width: "100%"
    },
    stockBarTrack: {
        height: 6,
        borderRadius: 3,
        width: "100%",
        overflow: "hidden"
    },
    stockBarFill: {
        height: 6,
        borderRadius: 3
    },
    stockBarMarker: {
        position: "absolute",
        top: -1,
        width: 2,
        height: 8,
        borderRadius: 1
    },

    // Product bottom row
    productBottomRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    supplierBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12
    },
    supplierDot: {
        width: 6,
        height: 6,
        borderRadius: 3
    },
    supplierText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },

    // Expanded product details
    productExpanded: {
        borderTopWidth: 1,
        paddingTop: 10,
        gap: 8
    },
    expandedRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8
    },
    expandedLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        width: 95
    },
    expandedValue: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        flex: 1,
        lineHeight: 18
    },
    expandedReorderNote: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginTop: 4
    },
    expandedReorderText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        flex: 1,
        lineHeight: 18
    }
}));
