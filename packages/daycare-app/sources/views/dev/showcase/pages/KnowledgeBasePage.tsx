import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

// --- Types ---

type Category = "Engineering" | "Product" | "Design" | "Operations" | "Legal";

type Tag = string;

type TocEntry = {
    id: string;
    title: string;
    level: number;
};

type Revision = {
    id: string;
    date: string;
    author: string;
    summary: string;
};

type RelatedArticle = {
    id: string;
    title: string;
    category: Category;
};

type Article = {
    id: string;
    title: string;
    category: Category;
    lastUpdated: string;
    authorName: string;
    authorInitials: string;
    tags: Tag[];
    views: number;
    contentSummary: string;
    toc: TocEntry[];
    related: RelatedArticle[];
    revisions: Revision[];
};

// --- Mock data ---

const ARTICLES: Article[] = [
    {
        id: "eng-1",
        title: "Microservices Migration Guide",
        category: "Engineering",
        lastUpdated: "Feb 28, 2026",
        authorName: "Alex Rivera",
        authorInitials: "AR",
        tags: ["architecture", "backend", "migration"],
        views: 1842,
        contentSummary:
            "This guide covers the incremental migration strategy from our monolithic Rails application to a microservices architecture using Go and gRPC. It details service boundaries, data ownership patterns, and the strangler fig approach for gradual decomposition.",
        toc: [
            { id: "t1", title: "Introduction", level: 1 },
            { id: "t2", title: "Current Architecture", level: 1 },
            { id: "t3", title: "Service Boundaries", level: 2 },
            { id: "t4", title: "Data Ownership", level: 2 },
            { id: "t5", title: "Migration Strategy", level: 1 },
            { id: "t6", title: "Rollback Procedures", level: 2 }
        ],
        related: [
            { id: "eng-2", title: "API Gateway Configuration", category: "Engineering" },
            { id: "eng-3", title: "Database Sharding Strategy", category: "Engineering" }
        ],
        revisions: [
            { id: "r1", date: "Feb 28, 2026", author: "AR", summary: "Added rollback section" },
            { id: "r2", date: "Feb 15, 2026", author: "KP", summary: "Updated service boundary diagrams" },
            { id: "r3", date: "Jan 20, 2026", author: "AR", summary: "Initial draft" }
        ]
    },
    {
        id: "eng-2",
        title: "CI/CD Pipeline Best Practices",
        category: "Engineering",
        lastUpdated: "Mar 1, 2026",
        authorName: "Karen Park",
        authorInitials: "KP",
        tags: ["devops", "ci-cd", "automation"],
        views: 2310,
        contentSummary:
            "Comprehensive guide to our CI/CD pipeline setup using GitHub Actions. Covers build caching strategies, parallel test execution, canary deployments, and rollback automation for production releases.",
        toc: [
            { id: "t1", title: "Pipeline Overview", level: 1 },
            { id: "t2", title: "Build Caching", level: 2 },
            { id: "t3", title: "Test Parallelism", level: 2 },
            { id: "t4", title: "Deployment Stages", level: 1 },
            { id: "t5", title: "Monitoring & Alerts", level: 1 }
        ],
        related: [
            { id: "eng-1", title: "Microservices Migration Guide", category: "Engineering" },
            { id: "ops-1", title: "Incident Response Playbook", category: "Operations" }
        ],
        revisions: [
            { id: "r1", date: "Mar 1, 2026", author: "KP", summary: "Added canary deployment steps" },
            { id: "r2", date: "Feb 10, 2026", author: "KP", summary: "Initial publication" }
        ]
    },
    {
        id: "eng-3",
        title: "TypeScript Style Guide v3",
        category: "Engineering",
        lastUpdated: "Feb 20, 2026",
        authorName: "Sam Ortiz",
        authorInitials: "SO",
        tags: ["typescript", "standards", "linting"],
        views: 3105,
        contentSummary:
            "Our updated TypeScript style guide covering strict typing conventions, naming patterns (prefix notation), file organization, and Biome linter configuration. Includes migration notes from v2.",
        toc: [
            { id: "t1", title: "Naming Conventions", level: 1 },
            { id: "t2", title: "File Organization", level: 1 },
            { id: "t3", title: "Type Patterns", level: 1 },
            { id: "t4", title: "Linter Config", level: 2 },
            { id: "t5", title: "Migration from v2", level: 1 }
        ],
        related: [{ id: "eng-2", title: "CI/CD Pipeline Best Practices", category: "Engineering" }],
        revisions: [
            { id: "r1", date: "Feb 20, 2026", author: "SO", summary: "v3 release" },
            { id: "r2", date: "Jan 5, 2026", author: "SO", summary: "v2 updates" },
            { id: "r3", date: "Nov 12, 2025", author: "AR", summary: "Original v1" }
        ]
    },
    {
        id: "prod-1",
        title: "Q2 2026 Product Roadmap",
        category: "Product",
        lastUpdated: "Mar 2, 2026",
        authorName: "Nina Torres",
        authorInitials: "NT",
        tags: ["roadmap", "strategy", "q2-2026"],
        views: 4201,
        contentSummary:
            "Strategic product roadmap for Q2 2026 covering three major initiatives: AI-powered automation, enterprise SSO integration, and the self-serve analytics dashboard. Includes milestones, resource allocation, and risk assessment.",
        toc: [
            { id: "t1", title: "Executive Summary", level: 1 },
            { id: "t2", title: "AI Automation Initiative", level: 1 },
            { id: "t3", title: "Enterprise SSO", level: 1 },
            { id: "t4", title: "Analytics Dashboard", level: 1 },
            { id: "t5", title: "Resource Allocation", level: 2 },
            { id: "t6", title: "Risk Assessment", level: 2 }
        ],
        related: [
            { id: "prod-2", title: "User Research Findings: Feb 2026", category: "Product" },
            { id: "des-1", title: "Design System v4 Spec", category: "Design" }
        ],
        revisions: [
            { id: "r1", date: "Mar 2, 2026", author: "NT", summary: "Added risk matrix" },
            { id: "r2", date: "Feb 25, 2026", author: "NT", summary: "Stakeholder feedback incorporated" },
            { id: "r3", date: "Feb 18, 2026", author: "NT", summary: "First draft shared" }
        ]
    },
    {
        id: "prod-2",
        title: "User Research Findings: Feb 2026",
        category: "Product",
        lastUpdated: "Feb 26, 2026",
        authorName: "Diana Lee",
        authorInitials: "DL",
        tags: ["research", "ux", "interviews"],
        views: 1560,
        contentSummary:
            "Summary of 24 user interviews conducted in February 2026. Key themes: onboarding friction (72% mentioned), desire for bulk actions (65%), and request for better notification controls (58%).",
        toc: [
            { id: "t1", title: "Methodology", level: 1 },
            { id: "t2", title: "Key Findings", level: 1 },
            { id: "t3", title: "Onboarding Friction", level: 2 },
            { id: "t4", title: "Bulk Actions", level: 2 },
            { id: "t5", title: "Recommendations", level: 1 }
        ],
        related: [
            { id: "prod-1", title: "Q2 2026 Product Roadmap", category: "Product" },
            { id: "des-2", title: "Onboarding Flow Redesign", category: "Design" }
        ],
        revisions: [
            { id: "r1", date: "Feb 26, 2026", author: "DL", summary: "Final analysis published" },
            { id: "r2", date: "Feb 19, 2026", author: "DL", summary: "Raw data compiled" }
        ]
    },
    {
        id: "des-1",
        title: "Design System v4 Spec",
        category: "Design",
        lastUpdated: "Feb 22, 2026",
        authorName: "Mia Chen",
        authorInitials: "MC",
        tags: ["design-system", "tokens", "components"],
        views: 2780,
        contentSummary:
            "Complete specification for Design System v4, including updated color tokens, spacing scale, typography ramp, and 42 component definitions. Covers dark mode support and accessibility WCAG 2.1 AA compliance.",
        toc: [
            { id: "t1", title: "Color Tokens", level: 1 },
            { id: "t2", title: "Typography Scale", level: 1 },
            { id: "t3", title: "Spacing & Layout", level: 1 },
            { id: "t4", title: "Component Library", level: 1 },
            { id: "t5", title: "Accessibility", level: 2 },
            { id: "t6", title: "Dark Mode", level: 2 }
        ],
        related: [
            { id: "des-2", title: "Onboarding Flow Redesign", category: "Design" },
            { id: "eng-3", title: "TypeScript Style Guide v3", category: "Engineering" }
        ],
        revisions: [
            { id: "r1", date: "Feb 22, 2026", author: "MC", summary: "Added dark mode tokens" },
            { id: "r2", date: "Feb 8, 2026", author: "MC", summary: "Component specs finalized" },
            { id: "r3", date: "Jan 15, 2026", author: "MC", summary: "Token definitions" },
            { id: "r4", date: "Dec 20, 2025", author: "MC", summary: "Initial spec outline" }
        ]
    },
    {
        id: "des-2",
        title: "Onboarding Flow Redesign",
        category: "Design",
        lastUpdated: "Mar 1, 2026",
        authorName: "Jake Fisher",
        authorInitials: "JF",
        tags: ["ux", "onboarding", "flows"],
        views: 980,
        contentSummary:
            "Proposed redesign of the onboarding experience based on user research findings. Introduces progressive disclosure, contextual tooltips, and a checklist-driven approach to reduce time-to-value from 14 minutes to under 5.",
        toc: [
            { id: "t1", title: "Problem Statement", level: 1 },
            { id: "t2", title: "Proposed Flow", level: 1 },
            { id: "t3", title: "Progressive Disclosure", level: 2 },
            { id: "t4", title: "Metrics & Goals", level: 1 }
        ],
        related: [
            { id: "prod-2", title: "User Research Findings: Feb 2026", category: "Product" },
            { id: "des-1", title: "Design System v4 Spec", category: "Design" }
        ],
        revisions: [
            { id: "r1", date: "Mar 1, 2026", author: "JF", summary: "Updated after design review" },
            { id: "r2", date: "Feb 24, 2026", author: "JF", summary: "Initial wireframes" }
        ]
    },
    {
        id: "ops-1",
        title: "Incident Response Playbook",
        category: "Operations",
        lastUpdated: "Feb 18, 2026",
        authorName: "Raj Patel",
        authorInitials: "RP",
        tags: ["incidents", "sre", "runbook"],
        views: 3450,
        contentSummary:
            "Step-by-step incident response procedures for P1-P4 severity levels. Covers on-call escalation paths, communication templates, post-mortem process, and SLA tracking dashboards.",
        toc: [
            { id: "t1", title: "Severity Definitions", level: 1 },
            { id: "t2", title: "Escalation Paths", level: 1 },
            { id: "t3", title: "Communication Templates", level: 2 },
            { id: "t4", title: "Post-Mortem Process", level: 1 },
            { id: "t5", title: "SLA Tracking", level: 2 }
        ],
        related: [
            { id: "eng-2", title: "CI/CD Pipeline Best Practices", category: "Engineering" },
            { id: "ops-2", title: "On-Call Rotation Schedule", category: "Operations" }
        ],
        revisions: [
            { id: "r1", date: "Feb 18, 2026", author: "RP", summary: "Updated escalation contacts" },
            { id: "r2", date: "Jan 30, 2026", author: "RP", summary: "Added P4 procedures" },
            { id: "r3", date: "Dec 5, 2025", author: "RP", summary: "Initial playbook" }
        ]
    },
    {
        id: "ops-2",
        title: "On-Call Rotation Schedule",
        category: "Operations",
        lastUpdated: "Mar 3, 2026",
        authorName: "Tina Nguyen",
        authorInitials: "TN",
        tags: ["on-call", "scheduling", "sre"],
        views: 1920,
        contentSummary:
            "Current on-call rotation for all engineering teams. Includes primary and secondary responder assignments, swap procedures, compensation policy, and integration with PagerDuty.",
        toc: [
            { id: "t1", title: "Current Rotation", level: 1 },
            { id: "t2", title: "Swap Procedures", level: 1 },
            { id: "t3", title: "Compensation", level: 2 },
            { id: "t4", title: "PagerDuty Setup", level: 2 }
        ],
        related: [{ id: "ops-1", title: "Incident Response Playbook", category: "Operations" }],
        revisions: [
            { id: "r1", date: "Mar 3, 2026", author: "TN", summary: "March rotation updated" },
            { id: "r2", date: "Feb 1, 2026", author: "TN", summary: "February rotation" }
        ]
    },
    {
        id: "legal-1",
        title: "Data Processing Agreement Template",
        category: "Legal",
        lastUpdated: "Feb 14, 2026",
        authorName: "Olivia Grant",
        authorInitials: "OG",
        tags: ["gdpr", "compliance", "dpa"],
        views: 890,
        contentSummary:
            "Standard DPA template for enterprise customers, compliant with GDPR Article 28. Covers data processing scope, sub-processor requirements, breach notification timelines, and data subject rights handling.",
        toc: [
            { id: "t1", title: "Scope of Processing", level: 1 },
            { id: "t2", title: "Sub-Processor Requirements", level: 1 },
            { id: "t3", title: "Breach Notification", level: 2 },
            { id: "t4", title: "Data Subject Rights", level: 1 },
            { id: "t5", title: "Audit Rights", level: 2 }
        ],
        related: [{ id: "legal-2", title: "Privacy Policy Update Guide", category: "Legal" }],
        revisions: [
            { id: "r1", date: "Feb 14, 2026", author: "OG", summary: "Updated for GDPR 2026 amendments" },
            { id: "r2", date: "Oct 1, 2025", author: "OG", summary: "Original template" }
        ]
    },
    {
        id: "legal-2",
        title: "Privacy Policy Update Guide",
        category: "Legal",
        lastUpdated: "Feb 10, 2026",
        authorName: "Marcus Webb",
        authorInitials: "MW",
        tags: ["privacy", "compliance", "policy"],
        views: 640,
        contentSummary:
            "Procedures for updating the company privacy policy when new features collect or process personal data. Includes checklist, legal review workflow, and deployment timeline requirements.",
        toc: [
            { id: "t1", title: "When to Update", level: 1 },
            { id: "t2", title: "Review Checklist", level: 1 },
            { id: "t3", title: "Legal Approval Flow", level: 2 },
            { id: "t4", title: "Deployment Timeline", level: 1 }
        ],
        related: [{ id: "legal-1", title: "Data Processing Agreement Template", category: "Legal" }],
        revisions: [
            { id: "r1", date: "Feb 10, 2026", author: "MW", summary: "Simplified approval workflow" },
            { id: "r2", date: "Sep 15, 2025", author: "MW", summary: "Initial guide" }
        ]
    }
];

const CATEGORIES: Category[] = ["Engineering", "Product", "Design", "Operations", "Legal"];

const CATEGORY_COLORS: Record<Category, string> = {
    Engineering: "#3B82F6",
    Product: "#8B5CF6",
    Design: "#EC4899",
    Operations: "#F59E0B",
    Legal: "#10B981"
};

const CATEGORY_ICONS: Record<Category, keyof typeof Ionicons.glyphMap> = {
    Engineering: "code-slash-outline",
    Product: "rocket-outline",
    Design: "color-palette-outline",
    Operations: "settings-outline",
    Legal: "shield-checkmark-outline"
};

// --- Helpers ---

function formatViewCount(count: number): string {
    if (count >= 1000) {
        return `${(count / 1000).toFixed(1)}k`;
    }
    return String(count);
}

function articlesByCategory(category: Category, articles: Article[]): Article[] {
    return articles.filter((a) => a.category === category);
}

// --- Components ---

function SearchBar({ query, onChangeQuery }: { query: string; onChangeQuery: (text: string) => void }) {
    const { theme } = useUnistyles();

    return (
        <View style={searchStyles.container}>
            <View style={[searchStyles.inputWrapper, { backgroundColor: theme.colors.surfaceContainerHighest }]}>
                <Ionicons name="search" size={18} color={theme.colors.onSurfaceVariant} style={searchStyles.icon} />
                <TextInput
                    placeholder="Search articles..."
                    value={query}
                    onChangeText={onChangeQuery}
                    style={[searchStyles.input, { color: theme.colors.onSurface }]}
                    placeholderTextColor={theme.colors.onSurfaceVariant}
                />
                {query.length > 0 && (
                    <Pressable onPress={() => onChangeQuery("")} hitSlop={8}>
                        <Ionicons name="close-circle" size={18} color={theme.colors.onSurfaceVariant} />
                    </Pressable>
                )}
            </View>
        </View>
    );
}

const searchStyles = StyleSheet.create((_theme) => ({
    container: {
        paddingBottom: 4
    },
    inputWrapper: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 44
    },
    icon: {
        marginRight: 10
    },
    input: {
        flex: 1,
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 15,
        paddingVertical: 0
    }
}));

// --- Category Section Header ---

function CategoryHeader({ category, count }: { category: Category; count: number }) {
    const { theme } = useUnistyles();
    const color = CATEGORY_COLORS[category];
    const icon = CATEGORY_ICONS[category];

    return (
        <View style={catStyles.container}>
            <View style={[catStyles.accentBar, { backgroundColor: color }]} />
            <View style={catStyles.content}>
                <View style={[catStyles.iconCircle, { backgroundColor: `${color}18` }]}>
                    <Ionicons name={icon} size={16} color={color} />
                </View>
                <Text style={[catStyles.title, { color: theme.colors.onSurface }]}>{category}</Text>
                <View style={[catStyles.countBadge, { backgroundColor: `${color}20` }]}>
                    <Text style={[catStyles.countText, { color }]}>{count}</Text>
                </View>
            </View>
        </View>
    );
}

const catStyles = StyleSheet.create((_theme) => ({
    container: {
        flexDirection: "row",
        alignItems: "stretch",
        marginTop: 20,
        marginBottom: 10
    },
    accentBar: {
        width: 4,
        borderRadius: 2,
        marginRight: 12
    },
    content: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 4
    },
    iconCircle: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: "center",
        justifyContent: "center"
    },
    title: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 16,
        lineHeight: 22,
        flex: 1
    },
    countBadge: {
        paddingHorizontal: 9,
        paddingVertical: 2,
        borderRadius: 10
    },
    countText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 12,
        lineHeight: 16
    }
}));

// --- Tag Chip ---

function TagChip({ tag, color }: { tag: string; color: string }) {
    return (
        <View style={[tagStyles.chip, { backgroundColor: `${color}12` }]}>
            <Text style={[tagStyles.text, { color }]}>{tag}</Text>
        </View>
    );
}

const tagStyles = StyleSheet.create((_theme) => ({
    chip: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10
    },
    text: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11,
        lineHeight: 15
    }
}));

// --- Article Card ---

function ArticleCard({
    article,
    isExpanded,
    onToggle
}: {
    article: Article;
    isExpanded: boolean;
    onToggle: () => void;
}) {
    const { theme } = useUnistyles();
    const catColor = CATEGORY_COLORS[article.category];

    return (
        <View
            style={[
                cardStyles.container,
                {
                    backgroundColor: theme.colors.surfaceContainer,
                    borderColor: isExpanded ? `${catColor}50` : theme.colors.outlineVariant,
                    borderWidth: 1
                }
            ]}
        >
            {/* Main row - pressable */}
            <Pressable onPress={onToggle} style={cardStyles.mainRow}>
                {/* Author avatar */}
                <View style={[cardStyles.avatar, { backgroundColor: `${catColor}20` }]}>
                    <Text style={[cardStyles.avatarText, { color: catColor }]}>{article.authorInitials}</Text>
                </View>

                {/* Title & meta */}
                <View style={cardStyles.titleBlock}>
                    <Text style={[cardStyles.title, { color: theme.colors.onSurface }]} numberOfLines={2}>
                        {article.title}
                    </Text>
                    <View style={cardStyles.metaRow}>
                        <Text style={[cardStyles.metaText, { color: theme.colors.onSurfaceVariant }]}>
                            {article.lastUpdated}
                        </Text>
                        <View style={cardStyles.viewsBadge}>
                            <Ionicons name="eye-outline" size={12} color={theme.colors.onSurfaceVariant} />
                            <Text style={[cardStyles.viewsText, { color: theme.colors.onSurfaceVariant }]}>
                                {formatViewCount(article.views)}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Expand icon */}
                <Ionicons
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={theme.colors.onSurfaceVariant}
                />
            </Pressable>

            {/* Tags row */}
            <View style={cardStyles.tagsRow}>
                {article.tags.map((tag) => (
                    <TagChip key={tag} tag={tag} color={catColor} />
                ))}
            </View>

            {/* Expanded detail panel */}
            {isExpanded && (
                <View style={[cardStyles.detailPanel, { borderTopColor: theme.colors.outlineVariant }]}>
                    {/* Content summary */}
                    <View style={cardStyles.section}>
                        <View style={cardStyles.sectionHeader}>
                            <Ionicons name="document-text-outline" size={14} color={theme.colors.primary} />
                            <Text style={[cardStyles.sectionTitle, { color: theme.colors.primary }]}>Summary</Text>
                        </View>
                        <Text style={[cardStyles.summaryText, { color: theme.colors.onSurface }]}>
                            {article.contentSummary}
                        </Text>
                    </View>

                    {/* Table of contents */}
                    <View style={cardStyles.section}>
                        <View style={cardStyles.sectionHeader}>
                            <Ionicons name="list-outline" size={14} color={theme.colors.primary} />
                            <Text style={[cardStyles.sectionTitle, { color: theme.colors.primary }]}>
                                Table of Contents
                            </Text>
                        </View>
                        <View style={cardStyles.tocContainer}>
                            {article.toc.map((entry) => (
                                <View
                                    key={entry.id}
                                    style={[cardStyles.tocEntry, { paddingLeft: entry.level === 2 ? 20 : 0 }]}
                                >
                                    <View
                                        style={[
                                            cardStyles.tocDot,
                                            {
                                                backgroundColor:
                                                    entry.level === 1 ? catColor : theme.colors.onSurfaceVariant,
                                                width: entry.level === 1 ? 6 : 4,
                                                height: entry.level === 1 ? 6 : 4,
                                                borderRadius: entry.level === 1 ? 3 : 2
                                            }
                                        ]}
                                    />
                                    <Text
                                        style={[
                                            entry.level === 1 ? cardStyles.tocTextL1 : cardStyles.tocTextL2,
                                            {
                                                color:
                                                    entry.level === 1
                                                        ? theme.colors.onSurface
                                                        : theme.colors.onSurfaceVariant
                                            }
                                        ]}
                                    >
                                        {entry.title}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* Related articles */}
                    <View style={cardStyles.section}>
                        <View style={cardStyles.sectionHeader}>
                            <Ionicons name="link-outline" size={14} color={theme.colors.primary} />
                            <Text style={[cardStyles.sectionTitle, { color: theme.colors.primary }]}>
                                Related Articles
                            </Text>
                        </View>
                        <View style={cardStyles.relatedContainer}>
                            {article.related.map((rel) => {
                                const relColor = CATEGORY_COLORS[rel.category];
                                return (
                                    <View
                                        key={rel.id}
                                        style={[
                                            cardStyles.relatedCard,
                                            { backgroundColor: theme.colors.surfaceContainerHighest }
                                        ]}
                                    >
                                        <View style={[cardStyles.relatedAccent, { backgroundColor: relColor }]} />
                                        <View style={cardStyles.relatedContent}>
                                            <Text
                                                style={[cardStyles.relatedTitle, { color: theme.colors.onSurface }]}
                                                numberOfLines={1}
                                            >
                                                {rel.title}
                                            </Text>
                                            <Text style={[cardStyles.relatedCategory, { color: relColor }]}>
                                                {rel.category}
                                            </Text>
                                        </View>
                                        <Ionicons
                                            name="arrow-forward-outline"
                                            size={14}
                                            color={theme.colors.onSurfaceVariant}
                                        />
                                    </View>
                                );
                            })}
                        </View>
                    </View>

                    {/* Revision history */}
                    <View style={cardStyles.section}>
                        <View style={cardStyles.sectionHeader}>
                            <Ionicons name="time-outline" size={14} color={theme.colors.primary} />
                            <Text style={[cardStyles.sectionTitle, { color: theme.colors.primary }]}>
                                Revision History
                            </Text>
                        </View>
                        <View style={cardStyles.revisionsContainer}>
                            {article.revisions.map((rev, idx) => {
                                const isLast = idx === article.revisions.length - 1;
                                return (
                                    <View key={rev.id} style={cardStyles.revisionRow}>
                                        {/* Timeline */}
                                        <View style={cardStyles.revisionTimeline}>
                                            <View
                                                style={[
                                                    cardStyles.revisionDot,
                                                    {
                                                        backgroundColor:
                                                            idx === 0 ? catColor : theme.colors.onSurfaceVariant,
                                                        borderColor: idx === 0 ? `${catColor}40` : "transparent",
                                                        borderWidth: idx === 0 ? 3 : 0
                                                    }
                                                ]}
                                            />
                                            {!isLast && (
                                                <View
                                                    style={[
                                                        cardStyles.revisionLine,
                                                        {
                                                            backgroundColor: theme.colors.outlineVariant
                                                        }
                                                    ]}
                                                />
                                            )}
                                        </View>
                                        {/* Content */}
                                        <View style={cardStyles.revisionContent}>
                                            <View style={cardStyles.revisionHeader}>
                                                <Text
                                                    style={[
                                                        cardStyles.revisionDate,
                                                        { color: theme.colors.onSurfaceVariant }
                                                    ]}
                                                >
                                                    {rev.date}
                                                </Text>
                                                <View
                                                    style={[
                                                        cardStyles.revisionAuthorBadge,
                                                        {
                                                            backgroundColor: `${catColor}15`
                                                        }
                                                    ]}
                                                >
                                                    <Text style={[cardStyles.revisionAuthor, { color: catColor }]}>
                                                        {rev.author}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Text
                                                style={[cardStyles.revisionSummary, { color: theme.colors.onSurface }]}
                                            >
                                                {rev.summary}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                </View>
            )}
        </View>
    );
}

const cardStyles = StyleSheet.create((_theme) => ({
    container: {
        borderRadius: 12,
        overflow: "hidden",
        marginBottom: 10
    },
    mainRow: {
        flexDirection: "row",
        alignItems: "center",
        padding: 14,
        gap: 12
    },
    avatar: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: "center",
        justifyContent: "center"
    },
    avatarText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 13,
        lineHeight: 18
    },
    titleBlock: {
        flex: 1,
        gap: 4
    },
    title: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 14,
        lineHeight: 20
    },
    metaRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12
    },
    metaText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        lineHeight: 16
    },
    viewsBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4
    },
    viewsText: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11,
        lineHeight: 15
    },
    tagsRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
        paddingHorizontal: 14,
        paddingBottom: 12
    },
    detailPanel: {
        borderTopWidth: 1,
        paddingHorizontal: 14,
        paddingTop: 14,
        paddingBottom: 16,
        gap: 18
    },
    section: {
        gap: 8
    },
    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6
    },
    sectionTitle: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13,
        lineHeight: 18
    },
    summaryText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 20
    },

    // Table of contents
    tocContainer: {
        gap: 6
    },
    tocEntry: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    tocDot: {},
    tocTextL1: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13,
        lineHeight: 18
    },
    tocTextL2: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        lineHeight: 17
    },

    // Related articles
    relatedContainer: {
        gap: 8
    },
    relatedCard: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 10,
        overflow: "hidden"
    },
    relatedAccent: {
        width: 4,
        alignSelf: "stretch"
    },
    relatedContent: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 12,
        gap: 2
    },
    relatedTitle: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13,
        lineHeight: 18
    },
    relatedCategory: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11,
        lineHeight: 15
    },

    // Revision history
    revisionsContainer: {
        gap: 0
    },
    revisionRow: {
        flexDirection: "row",
        gap: 12,
        minHeight: 44
    },
    revisionTimeline: {
        width: 20,
        alignItems: "center"
    },
    revisionDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginTop: 3
    },
    revisionLine: {
        width: 2,
        flex: 1,
        marginTop: 2,
        marginBottom: 2
    },
    revisionContent: {
        flex: 1,
        paddingBottom: 10,
        gap: 2
    },
    revisionHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    revisionDate: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11,
        lineHeight: 15
    },
    revisionAuthorBadge: {
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 6
    },
    revisionAuthor: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 10,
        lineHeight: 14
    },
    revisionSummary: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        lineHeight: 17
    }
}));

// --- Stats Bar ---

function StatsBar({ articles }: { articles: Article[] }) {
    const { theme } = useUnistyles();
    const totalViews = articles.reduce((sum, a) => sum + a.views, 0);
    const totalArticles = articles.length;
    const totalAuthors = new Set(articles.map((a) => a.authorInitials)).size;

    const stats = [
        {
            icon: "document-text-outline" as keyof typeof Ionicons.glyphMap,
            value: String(totalArticles),
            label: "Articles"
        },
        {
            icon: "eye-outline" as keyof typeof Ionicons.glyphMap,
            value: formatViewCount(totalViews),
            label: "Total Views"
        },
        {
            icon: "people-outline" as keyof typeof Ionicons.glyphMap,
            value: String(totalAuthors),
            label: "Authors"
        },
        {
            icon: "folder-outline" as keyof typeof Ionicons.glyphMap,
            value: String(CATEGORIES.length),
            label: "Categories"
        }
    ];

    return (
        <View style={statsStyles.row}>
            {stats.map((stat) => (
                <View key={stat.label} style={[statsStyles.tile, { backgroundColor: theme.colors.surfaceContainer }]}>
                    <Ionicons name={stat.icon} size={16} color={theme.colors.primary} />
                    <Text style={[statsStyles.value, { color: theme.colors.onSurface }]}>{stat.value}</Text>
                    <Text style={[statsStyles.label, { color: theme.colors.onSurfaceVariant }]}>{stat.label}</Text>
                </View>
            ))}
        </View>
    );
}

const statsStyles = StyleSheet.create((_theme) => ({
    row: {
        flexDirection: "row",
        gap: 8
    },
    tile: {
        flex: 1,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 10,
        alignItems: "center",
        gap: 4
    },
    value: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 18,
        lineHeight: 24
    },
    label: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11,
        lineHeight: 14
    }
}));

// --- Main Component ---

export function KnowledgeBasePage() {
    const { theme } = useUnistyles();
    const [searchQuery, setSearchQuery] = React.useState("");
    const [expandedArticleId, setExpandedArticleId] = React.useState<string | null>(null);

    const filteredArticles = React.useMemo(() => {
        if (searchQuery.trim().length === 0) return ARTICLES;
        const q = searchQuery.toLowerCase();
        return ARTICLES.filter(
            (a) =>
                a.title.toLowerCase().includes(q) ||
                a.tags.some((t) => t.toLowerCase().includes(q)) ||
                a.category.toLowerCase().includes(q) ||
                a.authorName.toLowerCase().includes(q)
        );
    }, [searchQuery]);

    function handleToggle(articleId: string) {
        setExpandedArticleId((prev) => (prev === articleId ? null : articleId));
    }

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: theme.colors.surface }}
            contentContainerStyle={pageStyles.scrollContent}
            keyboardShouldPersistTaps="handled"
        >
            {/* Search */}
            <SearchBar query={searchQuery} onChangeQuery={setSearchQuery} />

            {/* Stats overview */}
            <StatsBar articles={ARTICLES} />

            {/* Results info when searching */}
            {searchQuery.trim().length > 0 && (
                <View style={pageStyles.resultsInfo}>
                    <Ionicons name="filter-outline" size={14} color={theme.colors.onSurfaceVariant} />
                    <Text style={[pageStyles.resultsText, { color: theme.colors.onSurfaceVariant }]}>
                        {filteredArticles.length} result{filteredArticles.length !== 1 ? "s" : ""} for "{searchQuery}"
                    </Text>
                </View>
            )}

            {/* Articles grouped by category */}
            {CATEGORIES.map((category) => {
                const categoryArticles = articlesByCategory(category, filteredArticles);
                if (categoryArticles.length === 0) return null;

                return (
                    <View key={category}>
                        <CategoryHeader category={category} count={categoryArticles.length} />
                        {categoryArticles.map((article) => (
                            <ArticleCard
                                key={article.id}
                                article={article}
                                isExpanded={expandedArticleId === article.id}
                                onToggle={() => handleToggle(article.id)}
                            />
                        ))}
                    </View>
                );
            })}

            {/* Empty state */}
            {filteredArticles.length === 0 && (
                <View style={pageStyles.emptyState}>
                    <Ionicons name="search-outline" size={40} color={theme.colors.onSurfaceVariant} />
                    <Text style={[pageStyles.emptyTitle, { color: theme.colors.onSurface }]}>No articles found</Text>
                    <Text style={[pageStyles.emptySubtitle, { color: theme.colors.onSurfaceVariant }]}>
                        Try a different search term
                    </Text>
                </View>
            )}

            {/* Bottom spacing */}
            <View style={pageStyles.bottomSpacer} />
        </ScrollView>
    );
}

const pageStyles = StyleSheet.create((_theme) => ({
    scrollContent: {
        maxWidth: 600,
        width: "100%",
        alignSelf: "center",
        padding: 16,
        gap: 12,
        paddingBottom: 40
    },
    resultsInfo: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingVertical: 4
    },
    resultsText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 18
    },
    emptyState: {
        alignItems: "center",
        paddingVertical: 60,
        gap: 8
    },
    emptyTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 16,
        lineHeight: 22
    },
    emptySubtitle: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14,
        lineHeight: 20
    },
    bottomSpacer: {
        height: 40
    }
}));
