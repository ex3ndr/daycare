import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

// --- Types ---

type FileFormat = "SVG" | "PNG" | "PDF" | "AI";

type AssetCategory =
    | "Brand Logos"
    | "Marketing Materials"
    | "Social Templates"
    | "Product Photos"
    | "Icons & Illustrations";

type UsageRecord = {
    date: string;
    project: string;
    user: string;
};

type Asset = {
    id: string;
    name: string;
    category: AssetCategory;
    format: FileFormat;
    width: number;
    height: number;
    lastModified: string;
    version: number;
    usageCount: number;
    guidelinesNotes: string;
    downloadFormats: FileFormat[];
    usageHistory: UsageRecord[];
};

type AssetTypeCount = {
    type: string;
    count: number;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
};

// --- Mock Data ---

const mockAssets: Asset[] = [
    // Brand Logos
    {
        id: "a1",
        name: "Primary Logo Full Color",
        category: "Brand Logos",
        format: "SVG",
        width: 1200,
        height: 400,
        lastModified: "Feb 28, 2026",
        version: 4,
        usageCount: 187,
        guidelinesNotes:
            "Use on white or light backgrounds only. Maintain minimum clear space of 2x the logo mark height on all sides.",
        downloadFormats: ["SVG", "PNG", "PDF", "AI"],
        usageHistory: [
            { date: "Feb 27, 2026", project: "Website Redesign", user: "Sarah Chen" },
            { date: "Feb 20, 2026", project: "Annual Report 2025", user: "Mike Torres" },
            { date: "Feb 14, 2026", project: "Email Campaign Q1", user: "Lisa Park" }
        ]
    },
    {
        id: "a2",
        name: "Logo Monochrome Dark",
        category: "Brand Logos",
        format: "SVG",
        width: 1200,
        height: 400,
        lastModified: "Jan 15, 2026",
        version: 3,
        usageCount: 94,
        guidelinesNotes: "For dark backgrounds and print on dark stock. Do not modify opacity or add effects.",
        downloadFormats: ["SVG", "PNG", "PDF"],
        usageHistory: [
            { date: "Feb 10, 2026", project: "Dark Mode UI", user: "Alex Kim" },
            { date: "Jan 30, 2026", project: "Merch Printing", user: "Tom Nguyen" }
        ]
    },
    {
        id: "a3",
        name: "Favicon & App Icon",
        category: "Brand Logos",
        format: "PNG",
        width: 512,
        height: 512,
        lastModified: "Feb 05, 2026",
        version: 2,
        usageCount: 42,
        guidelinesNotes: "Square format only. Includes 1024px, 512px, 192px, and 32px variants in the package.",
        downloadFormats: ["PNG", "SVG"],
        usageHistory: [{ date: "Feb 04, 2026", project: "Mobile App v3", user: "Sarah Chen" }]
    },
    // Marketing Materials
    {
        id: "a4",
        name: "Product Launch Banner",
        category: "Marketing Materials",
        format: "AI",
        width: 2400,
        height: 1200,
        lastModified: "Mar 01, 2026",
        version: 6,
        usageCount: 23,
        guidelinesNotes: "Editable layers for copy changes. Keep gradient overlay intact. Use brand typeface only.",
        downloadFormats: ["AI", "PDF", "PNG"],
        usageHistory: [
            { date: "Mar 01, 2026", project: "Spring Launch 2026", user: "Mike Torres" },
            { date: "Feb 22, 2026", project: "Partner Co-brand", user: "Lisa Park" }
        ]
    },
    {
        id: "a5",
        name: "Trade Show Backdrop",
        category: "Marketing Materials",
        format: "PDF",
        width: 3600,
        height: 2400,
        lastModified: "Feb 20, 2026",
        version: 2,
        usageCount: 8,
        guidelinesNotes: "Print-ready at 300 DPI. CMYK color profile. Bleed marks included.",
        downloadFormats: ["PDF", "AI"],
        usageHistory: [{ date: "Feb 18, 2026", project: "CES 2026", user: "Tom Nguyen" }]
    },
    {
        id: "a6",
        name: "Email Header Template",
        category: "Marketing Materials",
        format: "PNG",
        width: 600,
        height: 200,
        lastModified: "Feb 12, 2026",
        version: 3,
        usageCount: 156,
        guidelinesNotes: "Optimized for email clients. Max file size 150KB. Test in Outlook and Gmail before sending.",
        downloadFormats: ["PNG", "SVG"],
        usageHistory: [
            { date: "Feb 28, 2026", project: "Weekly Newsletter", user: "Lisa Park" },
            { date: "Feb 21, 2026", project: "Promo Blast", user: "Lisa Park" },
            { date: "Feb 14, 2026", project: "Valentine Campaign", user: "Sarah Chen" }
        ]
    },
    // Social Templates
    {
        id: "a7",
        name: "Instagram Post Square",
        category: "Social Templates",
        format: "AI",
        width: 1080,
        height: 1080,
        lastModified: "Feb 25, 2026",
        version: 5,
        usageCount: 312,
        guidelinesNotes: "Swap hero image layer. Keep text within safe zone overlay. Use approved color palette only.",
        downloadFormats: ["AI", "PNG", "PDF"],
        usageHistory: [
            { date: "Mar 02, 2026", project: "Daily Social", user: "Alex Kim" },
            { date: "Mar 01, 2026", project: "Product Feature", user: "Alex Kim" },
            { date: "Feb 28, 2026", project: "Customer Story", user: "Lisa Park" }
        ]
    },
    {
        id: "a8",
        name: "Twitter/X Header Banner",
        category: "Social Templates",
        format: "PNG",
        width: 1500,
        height: 500,
        lastModified: "Jan 20, 2026",
        version: 2,
        usageCount: 14,
        guidelinesNotes: "Account for profile photo overlap in lower-left. Central text area preferred.",
        downloadFormats: ["PNG", "AI"],
        usageHistory: [{ date: "Jan 20, 2026", project: "Brand Refresh", user: "Mike Torres" }]
    },
    {
        id: "a9",
        name: "LinkedIn Company Cover",
        category: "Social Templates",
        format: "PNG",
        width: 1128,
        height: 191,
        lastModified: "Feb 10, 2026",
        version: 3,
        usageCount: 7,
        guidelinesNotes: "Minimal text due to small render size on mobile. Focus on brand imagery.",
        downloadFormats: ["PNG", "SVG"],
        usageHistory: [{ date: "Feb 10, 2026", project: "Q1 Hiring Push", user: "Tom Nguyen" }]
    },
    // Product Photos
    {
        id: "a10",
        name: "Hero Product Shot White BG",
        category: "Product Photos",
        format: "PNG",
        width: 2400,
        height: 2400,
        lastModified: "Feb 18, 2026",
        version: 1,
        usageCount: 67,
        guidelinesNotes: "Studio-lit, white seamless background. Do not crop below product base shadow.",
        downloadFormats: ["PNG"],
        usageHistory: [
            { date: "Feb 28, 2026", project: "Website PDP", user: "Sarah Chen" },
            { date: "Feb 22, 2026", project: "Amazon Listing", user: "Mike Torres" }
        ]
    },
    {
        id: "a11",
        name: "Lifestyle Product in Use",
        category: "Product Photos",
        format: "PNG",
        width: 3200,
        height: 2133,
        lastModified: "Feb 15, 2026",
        version: 1,
        usageCount: 45,
        guidelinesNotes: "Editorial style. Model release on file. Credit photographer in editorial placements.",
        downloadFormats: ["PNG"],
        usageHistory: [
            { date: "Feb 26, 2026", project: "Blog Post", user: "Lisa Park" },
            { date: "Feb 20, 2026", project: "Social Campaign", user: "Alex Kim" }
        ]
    },
    {
        id: "a12",
        name: "Product Detail Close-Up",
        category: "Product Photos",
        format: "PNG",
        width: 1600,
        height: 1600,
        lastModified: "Feb 15, 2026",
        version: 1,
        usageCount: 29,
        guidelinesNotes: "Macro lens detail shot. Suitable for zoom feature on product pages.",
        downloadFormats: ["PNG"],
        usageHistory: [{ date: "Feb 24, 2026", project: "Website PDP", user: "Sarah Chen" }]
    },
    // Icons & Illustrations
    {
        id: "a13",
        name: "Feature Icon Set (24 icons)",
        category: "Icons & Illustrations",
        format: "SVG",
        width: 24,
        height: 24,
        lastModified: "Feb 22, 2026",
        version: 7,
        usageCount: 534,
        guidelinesNotes: "Stroke-based at 2px. Align to 24px grid. Use currentColor for theming support.",
        downloadFormats: ["SVG", "PNG"],
        usageHistory: [
            { date: "Mar 02, 2026", project: "App UI v3", user: "Alex Kim" },
            { date: "Feb 28, 2026", project: "Marketing Site", user: "Sarah Chen" },
            { date: "Feb 25, 2026", project: "Help Center", user: "Tom Nguyen" }
        ]
    },
    {
        id: "a14",
        name: "Onboarding Illustrations",
        category: "Icons & Illustrations",
        format: "SVG",
        width: 400,
        height: 300,
        lastModified: "Feb 08, 2026",
        version: 3,
        usageCount: 18,
        guidelinesNotes: "Flat style with brand palette. Maintain consistent character proportions across set.",
        downloadFormats: ["SVG", "PNG", "PDF"],
        usageHistory: [{ date: "Feb 08, 2026", project: "Mobile Onboarding", user: "Alex Kim" }]
    },
    {
        id: "a15",
        name: "Empty State Illustrations",
        category: "Icons & Illustrations",
        format: "SVG",
        width: 320,
        height: 240,
        lastModified: "Jan 30, 2026",
        version: 2,
        usageCount: 22,
        guidelinesNotes: "Muted palette variant for less visual weight. Match empty state copy tone.",
        downloadFormats: ["SVG", "PNG"],
        usageHistory: [
            { date: "Feb 15, 2026", project: "Dashboard Redesign", user: "Sarah Chen" },
            { date: "Feb 01, 2026", project: "App UI v3", user: "Alex Kim" }
        ]
    }
];

const assetTypeCounts: AssetTypeCount[] = [
    { type: "Logos", count: 3, icon: "ribbon-outline", color: "#6366F1" },
    { type: "Icons", count: 3, icon: "grid-outline", color: "#3B82F6" },
    { type: "Photos", count: 3, icon: "image-outline", color: "#10B981" },
    { type: "Templates", count: 3, icon: "layers-outline", color: "#F59E0B" },
    { type: "Fonts", count: 4, icon: "text-outline", color: "#EC4899" }
];

const categoryIcons: Record<AssetCategory, keyof typeof Ionicons.glyphMap> = {
    "Brand Logos": "ribbon-outline",
    "Marketing Materials": "megaphone-outline",
    "Social Templates": "share-social-outline",
    "Product Photos": "camera-outline",
    "Icons & Illustrations": "color-palette-outline"
};

const categoryColors: Record<AssetCategory, string> = {
    "Brand Logos": "#6366F1",
    "Marketing Materials": "#EF4444",
    "Social Templates": "#3B82F6",
    "Product Photos": "#10B981",
    "Icons & Illustrations": "#F59E0B"
};

const formatColors: Record<FileFormat, string> = {
    SVG: "#6366F1",
    PNG: "#10B981",
    PDF: "#EF4444",
    AI: "#F59E0B"
};

// --- Helpers ---

function formatDimensions(width: number, height: number): string {
    return `${width} x ${height}`;
}

// --- Sub-components ---

/** Asset type count card shown in the top summary row */
function AssetTypeCard({ item }: { item: AssetTypeCount }) {
    const { theme } = useUnistyles();
    return (
        <View style={[styles.typeCard, { backgroundColor: theme.colors.surfaceContainer }]}>
            <View style={[styles.typeCardIcon, { backgroundColor: `${item.color}18` }]}>
                <Ionicons name={item.icon} size={18} color={item.color} />
            </View>
            <Text style={[styles.typeCardCount, { color: theme.colors.onSurface }]}>{item.count}</Text>
            <Text style={[styles.typeCardLabel, { color: theme.colors.onSurfaceVariant }]}>{item.type}</Text>
        </View>
    );
}

/** File format chip with color */
function FormatChip({ format, small }: { format: FileFormat; small?: boolean }) {
    const color = formatColors[format];
    return (
        <View style={[small ? styles.formatChipSmall : styles.formatChip, { backgroundColor: `${color}18` }]}>
            <Text style={[small ? styles.formatChipTextSmall : styles.formatChipText, { color }]}>{format}</Text>
        </View>
    );
}

/** Version badge */
function VersionBadge({ version }: { version: number }) {
    const { theme } = useUnistyles();
    return (
        <View style={[styles.versionBadge, { backgroundColor: `${theme.colors.primary}18` }]}>
            <Text style={[styles.versionBadgeText, { color: theme.colors.primary }]}>v{version}</Text>
        </View>
    );
}

/** Category section header with icon and asset count */
function CategorySectionHeader({ category, count }: { category: AssetCategory; count: number }) {
    const { theme } = useUnistyles();
    const icon = categoryIcons[category];
    const color = categoryColors[category];

    return (
        <View style={[styles.catHeader, { borderBottomColor: theme.colors.outlineVariant }]}>
            <View style={[styles.catHeaderIcon, { backgroundColor: `${color}18` }]}>
                <Ionicons name={icon} size={16} color={color} />
            </View>
            <Text style={[styles.catHeaderTitle, { color: theme.colors.onSurface }]}>{category}</Text>
            <View style={[styles.catHeaderCount, { backgroundColor: `${color}18` }]}>
                <Text style={[styles.catHeaderCountText, { color }]}>{count}</Text>
            </View>
        </View>
    );
}

/** Individual asset row with expandable detail panel */
function AssetRow({ asset, isExpanded, onToggle }: { asset: Asset; isExpanded: boolean; onToggle: () => void }) {
    const { theme } = useUnistyles();
    const catColor = categoryColors[asset.category];

    return (
        <Pressable onPress={onToggle} style={({ pressed }) => [pressed && { opacity: 0.92 }]}>
            <View
                style={[
                    styles.assetRow,
                    {
                        backgroundColor: theme.colors.surfaceContainer,
                        borderColor: isExpanded ? theme.colors.primary : theme.colors.outlineVariant
                    }
                ]}
            >
                {/* Color accent stripe */}
                <View style={[styles.assetStripe, { backgroundColor: catColor }]} />

                <View style={styles.assetRowContent}>
                    {/* Top: Name, format chip, version */}
                    <View style={styles.assetTopRow}>
                        <View style={styles.assetNameCol}>
                            <Text style={[styles.assetName, { color: theme.colors.onSurface }]} numberOfLines={1}>
                                {asset.name}
                            </Text>
                            <View style={styles.assetMetaRow}>
                                <FormatChip format={asset.format} />
                                <VersionBadge version={asset.version} />
                            </View>
                        </View>
                    </View>

                    {/* Middle: Dimensions, last modified, usage count */}
                    <View style={styles.assetInfoRow}>
                        <View style={styles.assetInfoItem}>
                            <Ionicons name="resize-outline" size={12} color={theme.colors.onSurfaceVariant} />
                            <Text style={[styles.assetDimensions, { color: theme.colors.onSurfaceVariant }]}>
                                {formatDimensions(asset.width, asset.height)}
                            </Text>
                        </View>
                        <View style={styles.assetInfoItem}>
                            <Ionicons name="calendar-outline" size={12} color={theme.colors.onSurfaceVariant} />
                            <Text style={[styles.assetInfoText, { color: theme.colors.onSurfaceVariant }]}>
                                {asset.lastModified}
                            </Text>
                        </View>
                        <View style={styles.assetInfoItem}>
                            <Ionicons name="analytics-outline" size={12} color={theme.colors.onSurfaceVariant} />
                            <Text style={[styles.assetInfoText, { color: theme.colors.onSurfaceVariant }]}>
                                {asset.usageCount} uses
                            </Text>
                        </View>
                    </View>

                    {/* Bottom: Expand indicator */}
                    <View style={styles.assetBottomRow}>
                        <View style={{ flex: 1 }} />
                        <Ionicons
                            name={isExpanded ? "chevron-up" : "chevron-down"}
                            size={16}
                            color={theme.colors.onSurfaceVariant}
                        />
                    </View>

                    {/* Expanded detail panel */}
                    {isExpanded && (
                        <View style={[styles.detailPanel, { borderTopColor: theme.colors.outlineVariant }]}>
                            {/* Preview placeholder */}
                            <View
                                style={[
                                    styles.previewBox,
                                    { backgroundColor: `${catColor}08`, borderColor: `${catColor}30` }
                                ]}
                            >
                                <Ionicons name="image-outline" size={32} color={`${catColor}60`} />
                                <Text style={[styles.previewText, { color: `${catColor}80` }]}>Preview</Text>
                                <Text style={[styles.previewDimText, { color: theme.colors.onSurfaceVariant }]}>
                                    {formatDimensions(asset.width, asset.height)}px
                                </Text>
                            </View>

                            {/* Download formats */}
                            <View style={styles.detailSection}>
                                <Text style={[styles.detailSectionTitle, { color: theme.colors.onSurface }]}>
                                    Download Formats
                                </Text>
                                <View style={styles.downloadFormatsRow}>
                                    {asset.downloadFormats.map((fmt) => (
                                        <DownloadFormatButton key={fmt} format={fmt} />
                                    ))}
                                </View>
                            </View>

                            {/* Brand guidelines notes */}
                            <View style={styles.detailSection}>
                                <Text style={[styles.detailSectionTitle, { color: theme.colors.onSurface }]}>
                                    Brand Guidelines
                                </Text>
                                <View
                                    style={[
                                        styles.guidelinesBox,
                                        {
                                            backgroundColor: `${theme.colors.primary}08`,
                                            borderColor: `${theme.colors.primary}20`
                                        }
                                    ]}
                                >
                                    <Ionicons
                                        name="information-circle-outline"
                                        size={14}
                                        color={theme.colors.primary}
                                    />
                                    <Text style={[styles.guidelinesText, { color: theme.colors.onSurfaceVariant }]}>
                                        {asset.guidelinesNotes}
                                    </Text>
                                </View>
                            </View>

                            {/* Usage history */}
                            <View style={styles.detailSection}>
                                <Text style={[styles.detailSectionTitle, { color: theme.colors.onSurface }]}>
                                    Recent Usage
                                </Text>
                                <View style={styles.usageHistoryList}>
                                    {asset.usageHistory.map((record, idx) => (
                                        <View
                                            key={`${record.date}-${record.project}`}
                                            style={[
                                                styles.usageRow,
                                                idx < asset.usageHistory.length - 1 && {
                                                    borderBottomWidth: 1,
                                                    borderBottomColor: theme.colors.outlineVariant
                                                }
                                            ]}
                                        >
                                            <View style={styles.usageRowLeft}>
                                                <Text
                                                    style={[styles.usageProject, { color: theme.colors.onSurface }]}
                                                    numberOfLines={1}
                                                >
                                                    {record.project}
                                                </Text>
                                                <Text
                                                    style={[styles.usageUser, { color: theme.colors.onSurfaceVariant }]}
                                                >
                                                    {record.user}
                                                </Text>
                                            </View>
                                            <Text style={[styles.usageDate, { color: theme.colors.onSurfaceVariant }]}>
                                                {record.date}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        </View>
                    )}
                </View>
            </View>
        </Pressable>
    );
}

/** Download format button */
function DownloadFormatButton({ format }: { format: FileFormat }) {
    const color = formatColors[format];
    const [pressed, setPressed] = React.useState(false);

    return (
        <Pressable
            onPressIn={() => setPressed(true)}
            onPressOut={() => setPressed(false)}
            style={[
                styles.downloadBtn,
                {
                    backgroundColor: pressed ? `${color}28` : `${color}12`,
                    borderColor: `${color}30`
                }
            ]}
        >
            <Ionicons name="download-outline" size={14} color={color} />
            <Text style={[styles.downloadBtnText, { color }]}>{format}</Text>
        </Pressable>
    );
}

// --- Main Component ---

/**
 * Brand asset management showcase page.
 * Displays asset type summary cards, assets grouped by category with file type chips,
 * dimensions, version badges, usage metrics, and expandable detail panels.
 */
export function DigitalAssetsPage() {
    const { theme } = useUnistyles();
    const [expandedAssetId, setExpandedAssetId] = React.useState<string | null>(null);

    // Group assets by category
    const groupedAssets = React.useMemo(() => {
        const categories: AssetCategory[] = [
            "Brand Logos",
            "Marketing Materials",
            "Social Templates",
            "Product Photos",
            "Icons & Illustrations"
        ];
        const map = new Map<AssetCategory, Asset[]>();
        for (const cat of categories) {
            map.set(cat, []);
        }
        for (const asset of mockAssets) {
            const list = map.get(asset.category);
            if (list) {
                list.push(asset);
            }
        }
        return map;
    }, []);

    // Total stats
    const totalAssets = mockAssets.length;
    const totalUsages = mockAssets.reduce((sum, a) => sum + a.usageCount, 0);

    const handleToggleAsset = React.useCallback((assetId: string) => {
        setExpandedAssetId((prev) => (prev === assetId ? null : assetId));
    }, []);

    return (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Total stats banner */}
            <View style={[styles.statsBanner, { backgroundColor: theme.colors.surfaceContainer }]}>
                <View style={styles.statsBannerItem}>
                    <Ionicons name="folder-outline" size={18} color={theme.colors.primary} />
                    <View>
                        <Text style={[styles.statsBannerValue, { color: theme.colors.onSurface }]}>{totalAssets}</Text>
                        <Text style={[styles.statsBannerLabel, { color: theme.colors.onSurfaceVariant }]}>
                            Total Assets
                        </Text>
                    </View>
                </View>
                <View style={[styles.statsBannerDivider, { backgroundColor: theme.colors.outlineVariant }]} />
                <View style={styles.statsBannerItem}>
                    <Ionicons name="analytics-outline" size={18} color="#10B981" />
                    <View>
                        <Text style={[styles.statsBannerValue, { color: theme.colors.onSurface }]}>
                            {totalUsages.toLocaleString()}
                        </Text>
                        <Text style={[styles.statsBannerLabel, { color: theme.colors.onSurfaceVariant }]}>
                            Total Uses
                        </Text>
                    </View>
                </View>
                <View style={[styles.statsBannerDivider, { backgroundColor: theme.colors.outlineVariant }]} />
                <View style={styles.statsBannerItem}>
                    <Ionicons name="people-outline" size={18} color="#6366F1" />
                    <View>
                        <Text style={[styles.statsBannerValue, { color: theme.colors.onSurface }]}>5</Text>
                        <Text style={[styles.statsBannerLabel, { color: theme.colors.onSurfaceVariant }]}>
                            Contributors
                        </Text>
                    </View>
                </View>
            </View>

            {/* Asset type count cards */}
            <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Assets by Type</Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.typeCardsScroll}
            >
                {assetTypeCounts.map((item) => (
                    <AssetTypeCard key={item.type} item={item} />
                ))}
            </ScrollView>

            {/* Asset categories */}
            <Text style={[styles.sectionTitle, { color: theme.colors.onSurface, marginTop: 24 }]}>Asset Library</Text>

            <View style={styles.categoriesContainer}>
                {Array.from(groupedAssets.entries()).map(([category, assets]) => (
                    <View key={category} style={styles.categoryGroup}>
                        <CategorySectionHeader category={category} count={assets.length} />
                        <View style={styles.assetsList}>
                            {assets.map((asset) => (
                                <AssetRow
                                    key={asset.id}
                                    asset={asset}
                                    isExpanded={expandedAssetId === asset.id}
                                    onToggle={() => handleToggleAsset(asset.id)}
                                />
                            ))}
                        </View>
                    </View>
                ))}
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

    // Stats banner
    statsBanner: {
        flexDirection: "row",
        borderRadius: 14,
        padding: 16,
        marginBottom: 20,
        alignItems: "center",
        justifyContent: "space-between"
    },
    statsBannerItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        flex: 1
    },
    statsBannerValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 17,
        letterSpacing: -0.3
    },
    statsBannerLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },
    statsBannerDivider: {
        width: 1,
        height: 32,
        marginHorizontal: 8
    },

    // Section title
    sectionTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 16,
        letterSpacing: -0.2,
        marginBottom: 12
    },

    // Type cards
    typeCardsScroll: {
        gap: 10,
        paddingBottom: 4
    },
    typeCard: {
        borderRadius: 14,
        padding: 14,
        alignItems: "center",
        gap: 6,
        width: 90
    },
    typeCardIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center"
    },
    typeCardCount: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 20,
        letterSpacing: -0.5
    },
    typeCardLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11,
        letterSpacing: 0.3,
        textTransform: "uppercase"
    },

    // Categories
    categoriesContainer: {
        gap: 20
    },
    categoryGroup: {
        gap: 8
    },

    // Category header
    catHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingBottom: 8,
        borderBottomWidth: 1
    },
    catHeaderIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center"
    },
    catHeaderTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 14,
        flex: 1
    },
    catHeaderCount: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center"
    },
    catHeaderCountText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 12
    },

    // Asset list
    assetsList: {
        gap: 8
    },

    // Asset row
    assetRow: {
        borderRadius: 12,
        borderWidth: 1,
        overflow: "hidden",
        flexDirection: "row"
    },
    assetStripe: {
        width: 4
    },
    assetRowContent: {
        flex: 1,
        padding: 14,
        paddingLeft: 12,
        gap: 8
    },

    // Asset top row
    assetTopRow: {
        flexDirection: "row",
        alignItems: "flex-start"
    },
    assetNameCol: {
        flex: 1,
        gap: 6
    },
    assetName: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14
    },
    assetMetaRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6
    },

    // Format chip
    formatChip: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6
    },
    formatChipText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 10,
        letterSpacing: 0.5
    },
    formatChipSmall: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4
    },
    formatChipTextSmall: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 9,
        letterSpacing: 0.4
    },

    // Version badge
    versionBadge: {
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 6
    },
    versionBadgeText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 10,
        letterSpacing: 0.3
    },

    // Asset info row
    assetInfoRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        flexWrap: "wrap"
    },
    assetInfoItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4
    },
    assetDimensions: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11
    },
    assetInfoText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },

    // Asset bottom row
    assetBottomRow: {
        flexDirection: "row",
        alignItems: "center"
    },

    // Detail panel
    detailPanel: {
        borderTopWidth: 1,
        paddingTop: 14,
        gap: 16,
        marginTop: 4
    },

    // Preview box
    previewBox: {
        borderRadius: 10,
        borderWidth: 1,
        borderStyle: "dashed",
        padding: 24,
        alignItems: "center",
        justifyContent: "center",
        gap: 6
    },
    previewText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 13
    },
    previewDimText: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11
    },

    // Detail sections
    detailSection: {
        gap: 8
    },
    detailSectionTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 13,
        letterSpacing: -0.1
    },

    // Download formats row
    downloadFormatsRow: {
        flexDirection: "row",
        gap: 8,
        flexWrap: "wrap"
    },
    downloadBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1
    },
    downloadBtnText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 12
    },

    // Guidelines box
    guidelinesBox: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1
    },
    guidelinesText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        lineHeight: 18,
        flex: 1
    },

    // Usage history
    usageHistoryList: {
        gap: 0
    },
    usageRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 8,
        gap: 12
    },
    usageRowLeft: {
        flex: 1,
        gap: 2
    },
    usageProject: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    usageUser: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },
    usageDate: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11
    }
}));
