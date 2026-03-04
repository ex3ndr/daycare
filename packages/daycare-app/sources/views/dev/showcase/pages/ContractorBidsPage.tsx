import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
// --- Types ---
import { Card } from "@/components/Card";
import { ShowcasePage } from "@/views/dev/showcase/components/ShowcasePage";

type LicenseStatus = "verified" | "pending" | "expired";
type CategoryKey = "demolition" | "framing" | "electrical" | "plumbing" | "finishing";
interface Bid {
    id: string;
    contractorName: string;
    companyName: string;
    amount: number;
    timeline: string;
    timelineDays: number;
    rating: number;
    licenseStatus: LicenseStatus;
    licenseNumber: string;
    availableDate: string;
    phone: string;
    notes: string;
}
interface BidCategory {
    key: CategoryKey;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    bids: Bid[];
}

// --- Mock Data ---

const mockCategories: BidCategory[] = [
    {
        key: "demolition",
        label: "Demolition",
        icon: "hammer-outline",
        bids: [
            {
                id: "d1",
                contractorName: "Marcus Rivera",
                companyName: "Rivera Demolition Co.",
                amount: 8500,
                timeline: "5 days",
                timelineDays: 5,
                rating: 5,
                licenseStatus: "verified",
                licenseNumber: "DEM-2024-1182",
                availableDate: "Mar 15, 2026",
                phone: "(416) 555-0142",
                notes: "Includes debris removal and disposal fees."
            },
            {
                id: "d2",
                contractorName: "Jean-Luc Fournier",
                companyName: "ClearPath Contractors",
                amount: 7200,
                timeline: "7 days",
                timelineDays: 7,
                rating: 4,
                licenseStatus: "verified",
                licenseNumber: "DEM-2023-0847",
                availableDate: "Mar 20, 2026",
                phone: "(416) 555-0289",
                notes: "Disposal fees billed separately at cost."
            },
            {
                id: "d3",
                contractorName: "Brian Kemp",
                companyName: "Kemp & Sons Demo",
                amount: 9800,
                timeline: "4 days",
                timelineDays: 4,
                rating: 3,
                licenseStatus: "pending",
                licenseNumber: "DEM-2026-0031",
                availableDate: "Mar 10, 2026",
                phone: "(905) 555-0176",
                notes: "Fast turnaround, premium rate for weekend work."
            }
        ]
    },
    {
        key: "framing",
        label: "Framing",
        icon: "grid-outline",
        bids: [
            {
                id: "f1",
                contractorName: "Tony Bianchi",
                companyName: "Bianchi Framing Ltd.",
                amount: 22000,
                timeline: "14 days",
                timelineDays: 14,
                rating: 5,
                licenseStatus: "verified",
                licenseNumber: "FRM-2022-3381",
                availableDate: "Apr 1, 2026",
                phone: "(416) 555-0331",
                notes: "Materials included. Uses kiln-dried lumber only."
            },
            {
                id: "f2",
                contractorName: "Nadia Kowalski",
                companyName: "Precision Frame Works",
                amount: 19500,
                timeline: "18 days",
                timelineDays: 18,
                rating: 4,
                licenseStatus: "verified",
                licenseNumber: "FRM-2023-2104",
                availableDate: "Apr 5, 2026",
                phone: "(647) 555-0412",
                notes: "Labour only. Client supplies materials."
            },
            {
                id: "f3",
                contractorName: "Derek Shaw",
                companyName: "Shaw Building Group",
                amount: 24800,
                timeline: "12 days",
                timelineDays: 12,
                rating: 5,
                licenseStatus: "expired",
                licenseNumber: "FRM-2021-0998",
                availableDate: "Mar 25, 2026",
                phone: "(416) 555-0587",
                notes: "Renewal submitted. Includes engineered trusses."
            }
        ]
    },
    {
        key: "electrical",
        label: "Electrical",
        icon: "flash-outline",
        bids: [
            {
                id: "e1",
                contractorName: "Samira Patel",
                companyName: "Patel Electric Inc.",
                amount: 15200,
                timeline: "10 days",
                timelineDays: 10,
                rating: 5,
                licenseStatus: "verified",
                licenseNumber: "ELE-2024-5521",
                availableDate: "Apr 10, 2026",
                phone: "(416) 555-0663",
                notes: "Full panel upgrade included. 200A service."
            },
            {
                id: "e2",
                contractorName: "Viktor Novak",
                companyName: "Novak Electrical Services",
                amount: 13800,
                timeline: "12 days",
                timelineDays: 12,
                rating: 4,
                licenseStatus: "pending",
                licenseNumber: "ELE-2026-0114",
                availableDate: "Apr 15, 2026",
                phone: "(905) 555-0741",
                notes: "Panel upgrade extra ($2,400). Rough-in only."
            },
            {
                id: "e3",
                contractorName: "Amy Chen",
                companyName: "Brightline Electric",
                amount: 16900,
                timeline: "8 days",
                timelineDays: 8,
                rating: 5,
                licenseStatus: "verified",
                licenseNumber: "ELE-2023-3307",
                availableDate: "Apr 8, 2026",
                phone: "(647) 555-0829",
                notes: "Includes smart home pre-wire and panel upgrade."
            }
        ]
    },
    {
        key: "plumbing",
        label: "Plumbing",
        icon: "water-outline",
        bids: [
            {
                id: "p1",
                contractorName: "Raj Dhillon",
                companyName: "Dhillon Plumbing & Gas",
                amount: 18400,
                timeline: "11 days",
                timelineDays: 11,
                rating: 4,
                licenseStatus: "verified",
                licenseNumber: "PLB-2024-2289",
                availableDate: "Apr 12, 2026",
                phone: "(416) 555-0912",
                notes: "PEX throughout. Includes rough-in for 2 baths + kitchen."
            },
            {
                id: "p2",
                contractorName: "Connor O'Brien",
                companyName: "O'Brien Pipe & Drain",
                amount: 16200,
                timeline: "14 days",
                timelineDays: 14,
                rating: 3,
                licenseStatus: "verified",
                licenseNumber: "PLB-2023-1567",
                availableDate: "Apr 20, 2026",
                phone: "(905) 555-1023",
                notes: "Copper supply lines. Labour rate $95/hr beyond estimate."
            },
            {
                id: "p3",
                contractorName: "Elena Volkov",
                companyName: "AquaFlow Mechanical",
                amount: 21000,
                timeline: "9 days",
                timelineDays: 9,
                rating: 5,
                licenseStatus: "expired",
                licenseNumber: "PLB-2021-0443",
                availableDate: "Apr 5, 2026",
                phone: "(647) 555-1158",
                notes: "Premium fixtures included. License renewal in progress."
            }
        ]
    },
    {
        key: "finishing",
        label: "Finishing",
        icon: "color-palette-outline",
        bids: [
            {
                id: "fin1",
                contractorName: "Lucia Greco",
                companyName: "Greco Fine Finishes",
                amount: 28000,
                timeline: "21 days",
                timelineDays: 21,
                rating: 5,
                licenseStatus: "verified",
                licenseNumber: "FIN-2024-0872",
                availableDate: "May 1, 2026",
                phone: "(416) 555-1234",
                notes: "Drywall, trim, paint, and flooring. Premium paint grade."
            },
            {
                id: "fin2",
                contractorName: "Jason Hartley",
                companyName: "Hartley Interior Works",
                amount: 24500,
                timeline: "25 days",
                timelineDays: 25,
                rating: 4,
                licenseStatus: "verified",
                licenseNumber: "FIN-2023-1456",
                availableDate: "May 5, 2026",
                phone: "(905) 555-1367",
                notes: "Drywall and paint only. Flooring quoted separately."
            },
            {
                id: "fin3",
                contractorName: "Aisha Mohamed",
                companyName: "FinishRight Contracting",
                amount: 31200,
                timeline: "18 days",
                timelineDays: 18,
                rating: 5,
                licenseStatus: "pending",
                licenseNumber: "FIN-2026-0089",
                availableDate: "Apr 28, 2026",
                phone: "(647) 555-1490",
                notes: "All-inclusive: drywall, crown moulding, hardwood, paint."
            }
        ]
    }
];

// --- Helpers ---

function formatCurrency(amount: number): string {
    return `$${amount.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    })}`;
}
function licenseLabel(status: LicenseStatus): string {
    if (status === "verified") return "VERIFIED";
    if (status === "pending") return "PENDING";
    return "EXPIRED";
}
function licenseColor(
    status: LicenseStatus,
    theme: {
        colors: Record<string, string>;
    }
): string {
    if (status === "verified") return theme.colors.tertiary;
    if (status === "pending") return "#F59E0B";
    return theme.colors.error;
}
function licenseIcon(status: LicenseStatus): keyof typeof Ionicons.glyphMap {
    if (status === "verified") return "shield-checkmark";
    if (status === "pending") return "time-outline";
    return "alert-circle-outline";
}
function findLowestBid(bids: Bid[]): string | null {
    if (bids.length === 0) return null;
    let lowest = bids[0];
    for (const bid of bids) {
        if (bid.amount < lowest.amount) {
            lowest = bid;
        }
    }
    return lowest.id;
}
function renderStars(rating: number, filledColor: string, emptyColor: string) {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
        stars.push(
            <Ionicons
                key={i}
                name={i <= rating ? "star" : "star-outline"}
                size={13}
                color={i <= rating ? filledColor : emptyColor}
            />
        );
    }
    return stars;
}

// --- Sub-components ---

function ProjectHeader({
    totalBudget,
    totalBids,
    categoriesCount
}: {
    totalBudget: number;
    totalBids: number;
    categoriesCount: number;
}) {
    const { theme } = useUnistyles();
    return (
        <View
            style={[
                styles.projectHeader,
                {
                    backgroundColor: theme.colors.surfaceContainer
                }
            ]}
        >
            <View style={styles.projectTitleRow}>
                <Ionicons name="construct-outline" size={22} color={theme.colors.primary} />
                <View style={styles.projectTitleText}>
                    <Text
                        style={[
                            styles.projectName,
                            {
                                color: theme.colors.onSurface
                            }
                        ]}
                    >
                        45 Elm Street Renovation
                    </Text>
                    <Text
                        style={[
                            styles.projectSubtitle,
                            {
                                color: theme.colors.onSurfaceVariant
                            }
                        ]}
                    >
                        Full gut renovation - 2,400 sq ft residential
                    </Text>
                </View>
            </View>

            <View
                style={[
                    styles.projectMetrics,
                    {
                        borderTopColor: theme.colors.outlineVariant
                    }
                ]}
            >
                <View style={styles.projectMetricItem}>
                    <Text
                        style={[
                            styles.projectMetricLabel,
                            {
                                color: theme.colors.onSurfaceVariant
                            }
                        ]}
                    >
                        BUDGET
                    </Text>
                    <Text
                        style={[
                            styles.projectMetricValue,
                            {
                                color: theme.colors.onSurface
                            }
                        ]}
                    >
                        {formatCurrency(totalBudget)}
                    </Text>
                </View>
                <View
                    style={[
                        styles.projectMetricDivider,
                        {
                            backgroundColor: theme.colors.outlineVariant
                        }
                    ]}
                />
                <View style={styles.projectMetricItem}>
                    <Text
                        style={[
                            styles.projectMetricLabel,
                            {
                                color: theme.colors.onSurfaceVariant
                            }
                        ]}
                    >
                        BIDS
                    </Text>
                    <Text
                        style={[
                            styles.projectMetricValue,
                            {
                                color: theme.colors.onSurface
                            }
                        ]}
                    >
                        {totalBids}
                    </Text>
                </View>
                <View
                    style={[
                        styles.projectMetricDivider,
                        {
                            backgroundColor: theme.colors.outlineVariant
                        }
                    ]}
                />
                <View style={styles.projectMetricItem}>
                    <Text
                        style={[
                            styles.projectMetricLabel,
                            {
                                color: theme.colors.onSurfaceVariant
                            }
                        ]}
                    >
                        TRADES
                    </Text>
                    <Text
                        style={[
                            styles.projectMetricValue,
                            {
                                color: theme.colors.onSurface
                            }
                        ]}
                    >
                        {categoriesCount}
                    </Text>
                </View>
            </View>
        </View>
    );
}
function ComparisonBar({
    amount,
    maxAmount,
    isLowest,
    barColor,
    lowestColor
}: {
    amount: number;
    maxAmount: number;
    isLowest: boolean;
    barColor: string;
    lowestColor: string;
}) {
    const widthPercent = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;
    return (
        <View style={styles.comparisonBarTrack}>
            <View
                style={[
                    styles.comparisonBarFill,
                    {
                        width: `${widthPercent}%`,
                        backgroundColor: isLowest ? lowestColor : barColor
                    }
                ]}
            />
        </View>
    );
}
function BidCard({
    bid,
    isLowest,
    maxAmount,
    isExpanded,
    onToggle
}: {
    bid: Bid;
    isLowest: boolean;
    maxAmount: number;
    isExpanded: boolean;
    onToggle: () => void;
}) {
    const { theme } = useUnistyles();
    const lColor = licenseColor(bid.licenseStatus, theme);
    const starColor = "#F59E0B";
    return (
        <Pressable
            onPress={onToggle}
            style={({ pressed }) => [
                pressed && {
                    opacity: 0.92
                }
            ]}
        >
            <Card
                style={[
                    styles.bidCard,
                    {
                        backgroundColor: theme.colors.surfaceContainer,
                        borderColor: isExpanded ? theme.colors.primary : theme.colors.outlineVariant
                    }
                ]}
            >
                {/* Top row: contractor + amount */}
                <View style={styles.bidTopRow}>
                    <View style={styles.bidNameCol}>
                        <View style={styles.bidNameRow}>
                            <Text
                                style={[
                                    styles.bidContractor,
                                    {
                                        color: theme.colors.onSurface
                                    }
                                ]}
                                numberOfLines={1}
                            >
                                {bid.contractorName}
                            </Text>
                            {isLowest && (
                                <View
                                    style={[
                                        styles.lowestChip,
                                        {
                                            backgroundColor: `${theme.colors.tertiary}18`
                                        }
                                    ]}
                                >
                                    <Ionicons name="trending-down" size={10} color={theme.colors.tertiary} />
                                    <Text
                                        style={[
                                            styles.lowestChipText,
                                            {
                                                color: theme.colors.tertiary
                                            }
                                        ]}
                                    >
                                        LOWEST
                                    </Text>
                                </View>
                            )}
                        </View>
                        <Text
                            style={[
                                styles.bidCompany,
                                {
                                    color: theme.colors.onSurfaceVariant
                                }
                            ]}
                            numberOfLines={1}
                        >
                            {bid.companyName}
                        </Text>
                    </View>
                    <Text
                        style={[
                            styles.bidAmount,
                            {
                                color: isLowest ? theme.colors.tertiary : theme.colors.onSurface
                            }
                        ]}
                    >
                        {formatCurrency(bid.amount)}
                    </Text>
                </View>

                {/* Comparison bar */}
                <ComparisonBar
                    amount={bid.amount}
                    maxAmount={maxAmount}
                    isLowest={isLowest}
                    barColor={`${theme.colors.primary}30`}
                    lowestColor={`${theme.colors.tertiary}40`}
                />

                {/* Bottom row: timeline, rating, license */}
                <View style={styles.bidBottomRow}>
                    <View style={styles.bidMetaItem}>
                        <Ionicons name="calendar-outline" size={13} color={theme.colors.onSurfaceVariant} />
                        <Text
                            style={[
                                styles.bidMetaText,
                                {
                                    color: theme.colors.onSurfaceVariant
                                }
                            ]}
                        >
                            {bid.timeline}
                        </Text>
                    </View>

                    <View style={styles.starsRow}>
                        {renderStars(bid.rating, starColor, theme.colors.outlineVariant)}
                    </View>

                    <View
                        style={[
                            styles.licenseChip,
                            {
                                backgroundColor: `${lColor}18`
                            }
                        ]}
                    >
                        <Ionicons name={licenseIcon(bid.licenseStatus)} size={11} color={lColor} />
                        <Text
                            style={[
                                styles.licenseChipText,
                                {
                                    color: lColor
                                }
                            ]}
                        >
                            {licenseLabel(bid.licenseStatus)}
                        </Text>
                    </View>
                </View>

                {/* Expanded detail panel */}
                {isExpanded && (
                    <View
                        style={[
                            styles.expandedPanel,
                            {
                                borderTopColor: theme.colors.outlineVariant
                            }
                        ]}
                    >
                        <View style={styles.expandedRow}>
                            <Ionicons name="document-text-outline" size={14} color={theme.colors.onSurfaceVariant} />
                            <Text
                                style={[
                                    styles.expandedLabel,
                                    {
                                        color: theme.colors.onSurfaceVariant
                                    }
                                ]}
                            >
                                License
                            </Text>
                            <Text
                                style={[
                                    styles.expandedValue,
                                    {
                                        color: theme.colors.onSurface
                                    }
                                ]}
                            >
                                {bid.licenseNumber}
                            </Text>
                        </View>

                        <View style={styles.expandedRow}>
                            <Ionicons name="time-outline" size={14} color={theme.colors.onSurfaceVariant} />
                            <Text
                                style={[
                                    styles.expandedLabel,
                                    {
                                        color: theme.colors.onSurfaceVariant
                                    }
                                ]}
                            >
                                Available
                            </Text>
                            <Text
                                style={[
                                    styles.expandedValue,
                                    {
                                        color: theme.colors.onSurface
                                    }
                                ]}
                            >
                                {bid.availableDate}
                            </Text>
                        </View>

                        <View style={styles.expandedRow}>
                            <Ionicons name="call-outline" size={14} color={theme.colors.onSurfaceVariant} />
                            <Text
                                style={[
                                    styles.expandedLabel,
                                    {
                                        color: theme.colors.onSurfaceVariant
                                    }
                                ]}
                            >
                                Phone
                            </Text>
                            <Text
                                style={[
                                    styles.expandedValue,
                                    {
                                        color: theme.colors.primary
                                    }
                                ]}
                            >
                                {bid.phone}
                            </Text>
                        </View>

                        {bid.notes ? (
                            <View
                                style={[
                                    styles.notesBox,
                                    {
                                        backgroundColor: `${theme.colors.primary}08`,
                                        borderColor: `${theme.colors.primary}20`
                                    }
                                ]}
                            >
                                <Ionicons name="chatbubble-outline" size={13} color={theme.colors.primary} />
                                <Text
                                    style={[
                                        styles.notesText,
                                        {
                                            color: theme.colors.onSurfaceVariant
                                        }
                                    ]}
                                >
                                    {bid.notes}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                )}
            </Card>
        </Pressable>
    );
}
function CategorySection({
    category,
    expandedBidId,
    onToggleBid,
    selectedSort
}: {
    category: BidCategory;
    expandedBidId: string | null;
    onToggleBid: (id: string) => void;
    selectedSort: SortOption;
}) {
    const { theme } = useUnistyles();
    const sortedBids = React.useMemo(() => {
        const sorted = [...category.bids];
        if (selectedSort === "price-low") {
            sorted.sort((a, b) => a.amount - b.amount);
        } else if (selectedSort === "price-high") {
            sorted.sort((a, b) => b.amount - a.amount);
        } else if (selectedSort === "rating") {
            sorted.sort((a, b) => b.rating - a.rating);
        } else if (selectedSort === "timeline") {
            sorted.sort((a, b) => a.timelineDays - b.timelineDays);
        }
        return sorted;
    }, [category.bids, selectedSort]);
    const lowestId = findLowestBid(category.bids);
    const maxAmount = Math.max(...category.bids.map((b) => b.amount));
    const categoryTotal = category.bids.reduce((sum, b) => sum + b.amount, 0);
    const avgAmount = category.bids.length > 0 ? Math.round(categoryTotal / category.bids.length) : 0;
    return (
        <View style={styles.categorySection}>
            {/* Category header */}
            <View style={styles.categoryHeader}>
                <View
                    style={[
                        styles.categoryIconCircle,
                        {
                            backgroundColor: `${theme.colors.primary}14`
                        }
                    ]}
                >
                    <Ionicons name={category.icon} size={16} color={theme.colors.primary} />
                </View>
                <Text
                    style={[
                        styles.categoryTitle,
                        {
                            color: theme.colors.onSurface
                        }
                    ]}
                >
                    {category.label}
                </Text>
                <View
                    style={[
                        styles.categoryCountBadge,
                        {
                            backgroundColor: `${theme.colors.primary}18`
                        }
                    ]}
                >
                    <Text
                        style={[
                            styles.categoryCountText,
                            {
                                color: theme.colors.primary
                            }
                        ]}
                    >
                        {category.bids.length}
                    </Text>
                </View>
                <View
                    style={{
                        flex: 1
                    }}
                />
                <Text
                    style={[
                        styles.categoryAvg,
                        {
                            color: theme.colors.onSurfaceVariant
                        }
                    ]}
                >
                    avg {formatCurrency(avgAmount)}
                </Text>
            </View>

            {/* Bid cards */}
            <View style={styles.bidList}>
                {sortedBids.map((bid) => (
                    <BidCard
                        key={bid.id}
                        bid={bid}
                        isLowest={bid.id === lowestId}
                        maxAmount={maxAmount}
                        isExpanded={expandedBidId === bid.id}
                        onToggle={() => onToggleBid(bid.id)}
                    />
                ))}
            </View>
        </View>
    );
}

// --- Sort Options ---

type SortOption = "price-low" | "price-high" | "rating" | "timeline";
const SORT_OPTIONS: {
    key: SortOption;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
}[] = [
    {
        key: "price-low",
        label: "Price \u2191",
        icon: "trending-down"
    },
    {
        key: "price-high",
        label: "Price \u2193",
        icon: "trending-up"
    },
    {
        key: "rating",
        label: "Rating",
        icon: "star-outline"
    },
    {
        key: "timeline",
        label: "Timeline",
        icon: "time-outline"
    }
];

// --- Main Component ---

/**
 * Contractor bid comparison showcase page.
 * Displays a renovation project overview with bids grouped by trade category.
 * Each bid shows price, timeline, rating, and license status with expandable details.
 * Includes sort controls and visual comparison bars per category.
 */
export function ContractorBidsPage() {
    const { theme } = useUnistyles();
    const [expandedBidId, setExpandedBidId] = React.useState<string | null>(null);
    const [sortOption, setSortOption] = React.useState<SortOption>("price-low");
    const totalBids = mockCategories.reduce((sum, cat) => sum + cat.bids.length, 0);
    const totalBudget = 125000;
    const handleToggleBid = React.useCallback((id: string) => {
        setExpandedBidId((prev) => (prev === id ? null : id));
    }, []);
    return (
        <ShowcasePage density="spacious">
            {/* Project header */}
            <ProjectHeader totalBudget={totalBudget} totalBids={totalBids} categoriesCount={mockCategories.length} />

            {/* Sort controls */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.sortPillsScroll}
            >
                {SORT_OPTIONS.map((opt) => {
                    const isActive = sortOption === opt.key;
                    return (
                        <Pressable
                            key={opt.key}
                            onPress={() => setSortOption(opt.key)}
                            style={[
                                styles.sortPill,
                                {
                                    backgroundColor: isActive
                                        ? theme.colors.primary
                                        : theme.colors.surfaceContainerHighest
                                }
                            ]}
                        >
                            <Ionicons
                                name={opt.icon}
                                size={13}
                                color={isActive ? "#FFFFFF" : theme.colors.onSurfaceVariant}
                            />
                            <Text
                                style={[
                                    styles.sortPillText,
                                    {
                                        color: isActive ? "#FFFFFF" : theme.colors.onSurfaceVariant
                                    }
                                ]}
                            >
                                {opt.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </ScrollView>

            {/* Category sections */}
            <View style={styles.categoriesContainer}>
                {mockCategories.map((cat) => (
                    <CategorySection
                        key={cat.key}
                        category={cat}
                        expandedBidId={expandedBidId}
                        onToggleBid={handleToggleBid}
                        selectedSort={sortOption}
                    />
                ))}
            </View>

            {/* Budget summary footer */}
            <View
                style={[
                    styles.summaryFooter,
                    {
                        backgroundColor: theme.colors.surfaceContainer
                    }
                ]}
            >
                <View style={styles.summaryRow}>
                    <Text
                        style={[
                            styles.summaryLabel,
                            {
                                color: theme.colors.onSurfaceVariant
                            }
                        ]}
                    >
                        Total Budget
                    </Text>
                    <Text
                        style={[
                            styles.summaryValue,
                            {
                                color: theme.colors.onSurface
                            }
                        ]}
                    >
                        {formatCurrency(totalBudget)}
                    </Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text
                        style={[
                            styles.summaryLabel,
                            {
                                color: theme.colors.onSurfaceVariant
                            }
                        ]}
                    >
                        Lowest Combined
                    </Text>
                    <Text
                        style={[
                            styles.summaryValue,
                            {
                                color: theme.colors.tertiary
                            }
                        ]}
                    >
                        {formatCurrency(
                            mockCategories.reduce((sum, cat) => {
                                const lowest = Math.min(...cat.bids.map((b) => b.amount));
                                return sum + lowest;
                            }, 0)
                        )}
                    </Text>
                </View>
                <View
                    style={[
                        styles.summaryDivider,
                        {
                            backgroundColor: theme.colors.outlineVariant
                        }
                    ]}
                />
                <View style={styles.summaryRow}>
                    <Text
                        style={[
                            styles.summaryLabel,
                            {
                                color: theme.colors.onSurfaceVariant
                            }
                        ]}
                    >
                        Remaining Budget
                    </Text>
                    <Text
                        style={[
                            styles.summaryValueLarge,
                            {
                                color:
                                    totalBudget -
                                        mockCategories.reduce((sum, cat) => {
                                            const lowest = Math.min(...cat.bids.map((b) => b.amount));
                                            return sum + lowest;
                                        }, 0) >=
                                    0
                                        ? theme.colors.tertiary
                                        : theme.colors.error
                            }
                        ]}
                    >
                        {formatCurrency(
                            totalBudget -
                                mockCategories.reduce((sum, cat) => {
                                    const lowest = Math.min(...cat.bids.map((b) => b.amount));
                                    return sum + lowest;
                                }, 0)
                        )}
                    </Text>
                </View>
            </View>
        </ShowcasePage>
    );
}

// --- Styles ---

const styles = StyleSheet.create((_theme) => ({
    // Project header
    projectHeader: {
        borderRadius: 16,
        marginHorizontal: 16,
        marginTop: 16,
        padding: 20,
        gap: 16
    },
    projectTitleRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12
    },
    projectTitleText: {
        flex: 1,
        gap: 2
    },
    projectName: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 18,
        letterSpacing: -0.3
    },
    projectSubtitle: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13
    },
    projectMetrics: {
        flexDirection: "row",
        alignItems: "center",
        borderTopWidth: 1,
        paddingTop: 16,
        gap: 16
    },
    projectMetricItem: {
        flex: 1,
        alignItems: "center",
        gap: 4
    },
    projectMetricLabel: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 10,
        letterSpacing: 0.8,
        textTransform: "uppercase"
    },
    projectMetricValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 18,
        letterSpacing: -0.5
    },
    projectMetricDivider: {
        width: 1,
        height: 32
    },
    // Sort pills
    sortPillsScroll: {
        paddingHorizontal: 16,
        gap: 8,
        paddingTop: 16,
        paddingBottom: 8
    },
    sortPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 18
    },
    sortPillText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 12
    },
    // Categories container
    categoriesContainer: {
        paddingHorizontal: 16,
        gap: 20,
        marginTop: 12
    },
    // Category section
    categorySection: {
        gap: 8
    },
    categoryHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingBottom: 4
    },
    categoryIconCircle: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: "center",
        justifyContent: "center"
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
    categoryAvg: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 12
    },
    // Bid list
    bidList: {
        gap: 8
    },
    // Bid card
    bidCard: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 14,
        gap: 10
    },
    bidTopRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 10
    },
    bidNameCol: {
        flex: 1,
        gap: 2
    },
    bidNameRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    bidContractor: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 14
    },
    bidCompany: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    bidAmount: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 16,
        letterSpacing: -0.3
    },
    // Lowest bid chip
    lowestChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 10
    },
    lowestChipText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 9,
        letterSpacing: 0.5
    },
    // Comparison bar
    comparisonBarTrack: {
        height: 4,
        borderRadius: 2,
        backgroundColor: "rgba(128, 128, 128, 0.1)"
    },
    comparisonBarFill: {
        height: 4,
        borderRadius: 2
    },
    // Bid bottom row
    bidBottomRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12
    },
    bidMetaItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4
    },
    bidMetaText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    starsRow: {
        flexDirection: "row",
        gap: 1
    },
    // License chip
    licenseChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10
    },
    licenseChipText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 9,
        letterSpacing: 0.5
    },
    // Expanded panel
    expandedPanel: {
        borderTopWidth: 1,
        paddingTop: 12,
        gap: 8
    },
    expandedRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    expandedLabel: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 12,
        width: 60
    },
    expandedValue: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        flex: 1
    },
    // Notes box
    notesBox: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        marginTop: 4
    },
    notesText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        flex: 1,
        lineHeight: 18
    },
    // Summary footer
    summaryFooter: {
        borderRadius: 16,
        marginHorizontal: 16,
        marginTop: 24,
        padding: 20,
        gap: 10
    },
    summaryRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    summaryLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13
    },
    summaryValue: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 14
    },
    summaryValueLarge: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 20,
        letterSpacing: -0.5
    },
    summaryDivider: {
        height: 1,
        marginVertical: 4
    }
}));
