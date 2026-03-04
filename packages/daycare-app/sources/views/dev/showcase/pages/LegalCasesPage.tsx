import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

// --- Types ---

type CaseStatus = "active" | "discovery" | "trial" | "settled" | "closed";
type CaseType = "Litigation" | "Corporate" | "Real Estate" | "Family" | "IP";

type TimelineEvent = {
    id: string;
    date: string;
    label: string;
    type: "filing" | "hearing" | "deadline" | "note";
};

type CaseDocument = {
    id: string;
    name: string;
    fileType: "pdf" | "docx" | "xlsx" | "img";
    date: string;
};

type BillingEntry = {
    description: string;
    hours: number;
    rate: number;
};

type LegalCase = {
    id: string;
    caseNumber: string;
    clientName: string;
    title: string;
    type: CaseType;
    status: CaseStatus;
    nextDeadline: string;
    deadlineUrgency: "overdue" | "urgent" | "soon" | "normal";
    totalBilled: number;
    timeline: TimelineEvent[];
    documents: CaseDocument[];
    billing: BillingEntry[];
};

// --- Config ---

const STATUS_CONFIG: Record<CaseStatus, { label: string; color: string }> = {
    active: { label: "Active", color: "#3B82F6" },
    discovery: { label: "Discovery", color: "#8B5CF6" },
    trial: { label: "Trial", color: "#EF4444" },
    settled: { label: "Settled", color: "#10B981" },
    closed: { label: "Closed", color: "#9CA3AF" }
};

const CASE_TYPE_CONFIG: Record<CaseType, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
    Litigation: { icon: "hammer-outline", color: "#EF4444" },
    Corporate: { icon: "business-outline", color: "#3B82F6" },
    "Real Estate": { icon: "home-outline", color: "#F59E0B" },
    Family: { icon: "people-outline", color: "#EC4899" },
    IP: { icon: "bulb-outline", color: "#8B5CF6" }
};

const FILE_TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
    pdf: "document-text-outline",
    docx: "document-outline",
    xlsx: "grid-outline",
    img: "image-outline"
};

const TIMELINE_TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
    filing: "document-attach-outline",
    hearing: "megaphone-outline",
    deadline: "alarm-outline",
    note: "create-outline"
};

// --- Mock Data ---

const CASES: LegalCase[] = [
    {
        id: "1",
        caseNumber: "2026-LIT-0142",
        clientName: "Meridian Corp.",
        title: "Meridian v. Apex Industries - Patent Infringement",
        type: "Litigation",
        status: "discovery",
        nextDeadline: "Mar 5, 2026",
        deadlineUrgency: "urgent",
        totalBilled: 48750,
        timeline: [
            { id: "t1", date: "Mar 5", label: "Discovery deadline - produce documents", type: "deadline" },
            { id: "t2", date: "Feb 28", label: "Deposition of CTO completed", type: "note" },
            { id: "t3", date: "Feb 14", label: "Motion to compel filed", type: "filing" },
            { id: "t4", date: "Jan 20", label: "Initial case management conference", type: "hearing" }
        ],
        documents: [
            { id: "d1", name: "Motion to Compel.pdf", fileType: "pdf", date: "Feb 14" },
            { id: "d2", name: "Deposition Transcript - CTO.docx", fileType: "docx", date: "Feb 28" },
            { id: "d3", name: "Exhibit A - Patent Claims.pdf", fileType: "pdf", date: "Jan 15" },
            { id: "d4", name: "Billing Summary Q1.xlsx", fileType: "xlsx", date: "Mar 1" }
        ],
        billing: [
            { description: "Legal research & analysis", hours: 45, rate: 350 },
            { description: "Deposition preparation", hours: 32, rate: 350 },
            { description: "Document review", hours: 60, rate: 275 },
            { description: "Court appearances", hours: 8, rate: 400 }
        ]
    },
    {
        id: "2",
        caseNumber: "2026-LIT-0156",
        clientName: "Harbor View HOA",
        title: "Harbor View v. Coastal Construction - Breach of Contract",
        type: "Litigation",
        status: "active",
        nextDeadline: "Mar 12, 2026",
        deadlineUrgency: "soon",
        totalBilled: 22400,
        timeline: [
            { id: "t1", date: "Mar 12", label: "Answer due", type: "deadline" },
            { id: "t2", date: "Feb 20", label: "Complaint filed", type: "filing" }
        ],
        documents: [
            { id: "d1", name: "Complaint.pdf", fileType: "pdf", date: "Feb 20" },
            { id: "d2", name: "Contract Agreement.pdf", fileType: "pdf", date: "Feb 15" }
        ],
        billing: [
            { description: "Complaint drafting", hours: 28, rate: 350 },
            { description: "Client consultations", hours: 12, rate: 300 }
        ]
    },
    {
        id: "3",
        caseNumber: "2026-LIT-0108",
        clientName: "Greenfield Dev.",
        title: "Greenfield v. City Planning Commission",
        type: "Litigation",
        status: "trial",
        nextDeadline: "Mar 3, 2026",
        deadlineUrgency: "overdue",
        totalBilled: 67200,
        timeline: [
            { id: "t1", date: "Mar 3", label: "Trial day 3 - cross-examination", type: "hearing" },
            { id: "t2", date: "Mar 2", label: "Trial day 2 - plaintiff witnesses", type: "hearing" },
            { id: "t3", date: "Mar 1", label: "Trial commenced", type: "hearing" }
        ],
        documents: [
            { id: "d1", name: "Trial Brief.pdf", fileType: "pdf", date: "Feb 25" },
            { id: "d2", name: "Witness List.docx", fileType: "docx", date: "Feb 20" },
            { id: "d3", name: "Exhibit Binder.pdf", fileType: "pdf", date: "Feb 26" }
        ],
        billing: [
            { description: "Trial preparation", hours: 80, rate: 375 },
            { description: "Expert witness coordination", hours: 24, rate: 350 },
            { description: "Court appearances", hours: 36, rate: 400 }
        ]
    },
    {
        id: "4",
        caseNumber: "2026-CORP-0034",
        clientName: "TechVenture Inc.",
        title: "Series B Funding Round - Corporate Restructuring",
        type: "Corporate",
        status: "active",
        nextDeadline: "Mar 15, 2026",
        deadlineUrgency: "soon",
        totalBilled: 35600,
        timeline: [
            { id: "t1", date: "Mar 15", label: "Board resolution deadline", type: "deadline" },
            { id: "t2", date: "Mar 1", label: "Term sheet finalized", type: "note" },
            { id: "t3", date: "Feb 18", label: "Due diligence review completed", type: "note" }
        ],
        documents: [
            { id: "d1", name: "Term Sheet - Final.pdf", fileType: "pdf", date: "Mar 1" },
            { id: "d2", name: "Due Diligence Report.pdf", fileType: "pdf", date: "Feb 18" },
            { id: "d3", name: "Articles of Amendment.docx", fileType: "docx", date: "Feb 25" }
        ],
        billing: [
            { description: "Due diligence review", hours: 40, rate: 350 },
            { description: "Document drafting", hours: 52, rate: 325 }
        ]
    },
    {
        id: "5",
        caseNumber: "2026-CORP-0029",
        clientName: "Atlas Partners",
        title: "Atlas-Pinnacle Merger Agreement",
        type: "Corporate",
        status: "active",
        nextDeadline: "Mar 20, 2026",
        deadlineUrgency: "normal",
        totalBilled: 89300,
        timeline: [
            { id: "t1", date: "Mar 20", label: "Regulatory filing deadline", type: "deadline" },
            { id: "t2", date: "Feb 28", label: "Shareholder agreement drafted", type: "filing" }
        ],
        documents: [
            { id: "d1", name: "Merger Agreement Draft.pdf", fileType: "pdf", date: "Feb 28" },
            { id: "d2", name: "Regulatory Filing Checklist.xlsx", fileType: "xlsx", date: "Feb 20" }
        ],
        billing: [
            { description: "Merger negotiation support", hours: 96, rate: 375 },
            { description: "Regulatory compliance review", hours: 64, rate: 350 }
        ]
    },
    {
        id: "6",
        caseNumber: "2026-RE-0018",
        clientName: "Oakwood Properties",
        title: "Commercial Lease - 450 Main St. Portfolio",
        type: "Real Estate",
        status: "active",
        nextDeadline: "Mar 10, 2026",
        deadlineUrgency: "soon",
        totalBilled: 18200,
        timeline: [
            { id: "t1", date: "Mar 10", label: "Lease execution deadline", type: "deadline" },
            { id: "t2", date: "Feb 22", label: "Title search completed", type: "note" }
        ],
        documents: [
            { id: "d1", name: "Commercial Lease Agreement.pdf", fileType: "pdf", date: "Feb 25" },
            { id: "d2", name: "Title Report.pdf", fileType: "pdf", date: "Feb 22" },
            { id: "d3", name: "Property Survey.img", fileType: "img", date: "Feb 10" }
        ],
        billing: [
            { description: "Lease negotiation", hours: 24, rate: 325 },
            { description: "Title review", hours: 16, rate: 300 }
        ]
    },
    {
        id: "7",
        caseNumber: "2026-RE-0021",
        clientName: "Riverstone LLC",
        title: "Residential Development - Zoning Variance Application",
        type: "Real Estate",
        status: "settled",
        nextDeadline: "N/A",
        deadlineUrgency: "normal",
        totalBilled: 14500,
        timeline: [
            { id: "t1", date: "Feb 15", label: "Variance approved by zoning board", type: "hearing" },
            { id: "t2", date: "Jan 30", label: "Zoning hearing", type: "hearing" }
        ],
        documents: [
            { id: "d1", name: "Zoning Variance Application.pdf", fileType: "pdf", date: "Jan 15" },
            { id: "d2", name: "Approval Letter.pdf", fileType: "pdf", date: "Feb 15" }
        ],
        billing: [
            { description: "Zoning application preparation", hours: 20, rate: 325 },
            { description: "Hearing representation", hours: 12, rate: 350 }
        ]
    },
    {
        id: "8",
        caseNumber: "2026-FAM-0047",
        clientName: "Sarah Mitchell",
        title: "Mitchell v. Mitchell - Custody & Division",
        type: "Family",
        status: "active",
        nextDeadline: "Mar 8, 2026",
        deadlineUrgency: "urgent",
        totalBilled: 31800,
        timeline: [
            { id: "t1", date: "Mar 8", label: "Mediation session", type: "hearing" },
            { id: "t2", date: "Feb 25", label: "Financial disclosure filed", type: "filing" },
            { id: "t3", date: "Feb 10", label: "Temporary custody order issued", type: "hearing" }
        ],
        documents: [
            { id: "d1", name: "Financial Disclosure.pdf", fileType: "pdf", date: "Feb 25" },
            { id: "d2", name: "Custody Proposal.docx", fileType: "docx", date: "Feb 20" }
        ],
        billing: [
            { description: "Court appearances", hours: 18, rate: 350 },
            { description: "Mediation preparation", hours: 24, rate: 325 },
            { description: "Document preparation", hours: 36, rate: 275 }
        ]
    },
    {
        id: "9",
        caseNumber: "2026-FAM-0051",
        clientName: "James & Linda Park",
        title: "Park Adoption - International Proceedings",
        type: "Family",
        status: "active",
        nextDeadline: "Apr 2, 2026",
        deadlineUrgency: "normal",
        totalBilled: 12600,
        timeline: [
            { id: "t1", date: "Apr 2", label: "Immigration filing deadline", type: "deadline" },
            { id: "t2", date: "Feb 28", label: "Home study report received", type: "note" }
        ],
        documents: [
            { id: "d1", name: "Adoption Petition.pdf", fileType: "pdf", date: "Feb 10" },
            { id: "d2", name: "Home Study Report.pdf", fileType: "pdf", date: "Feb 28" }
        ],
        billing: [
            { description: "Petition drafting", hours: 16, rate: 325 },
            { description: "Immigration coordination", hours: 20, rate: 300 }
        ]
    },
    {
        id: "10",
        caseNumber: "2026-IP-0012",
        clientName: "NovaTech Labs",
        title: "Patent Application - Quantum Sensor Array",
        type: "IP",
        status: "active",
        nextDeadline: "Mar 18, 2026",
        deadlineUrgency: "soon",
        totalBilled: 27400,
        timeline: [
            { id: "t1", date: "Mar 18", label: "USPTO response deadline", type: "deadline" },
            { id: "t2", date: "Feb 20", label: "Office action received", type: "filing" }
        ],
        documents: [
            { id: "d1", name: "Patent Application.pdf", fileType: "pdf", date: "Dec 15" },
            { id: "d2", name: "Office Action Response Draft.docx", fileType: "docx", date: "Mar 1" },
            { id: "d3", name: "Prior Art Analysis.xlsx", fileType: "xlsx", date: "Feb 25" }
        ],
        billing: [
            { description: "Patent prosecution", hours: 36, rate: 375 },
            { description: "Prior art research", hours: 28, rate: 300 }
        ]
    },
    {
        id: "11",
        caseNumber: "2026-IP-0009",
        clientName: "Bright Media Co.",
        title: "Trademark Opposition - BRIGHTLINE Mark",
        type: "IP",
        status: "closed",
        nextDeadline: "N/A",
        deadlineUrgency: "normal",
        totalBilled: 19800,
        timeline: [
            { id: "t1", date: "Feb 5", label: "Opposition sustained - mark denied", type: "hearing" },
            { id: "t2", date: "Jan 18", label: "TTAB hearing", type: "hearing" }
        ],
        documents: [
            { id: "d1", name: "Opposition Filing.pdf", fileType: "pdf", date: "Nov 10" },
            { id: "d2", name: "TTAB Decision.pdf", fileType: "pdf", date: "Feb 5" }
        ],
        billing: [
            { description: "Opposition proceeding", hours: 32, rate: 350 },
            { description: "Trademark research", hours: 20, rate: 275 }
        ]
    }
];

const CASE_TYPES: CaseType[] = ["Litigation", "Corporate", "Real Estate", "Family", "IP"];

// --- Helpers ---

function formatCurrency(amount: number): string {
    return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function urgencyColor(urgency: string, theme: { colors: Record<string, string> }): string {
    if (urgency === "overdue") return theme.colors.error;
    if (urgency === "urgent") return "#F59E0B";
    if (urgency === "soon") return theme.colors.primary;
    return theme.colors.onSurfaceVariant;
}

// --- Metric Card ---

function MetricCard({
    icon,
    label,
    value,
    tintColor
}: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: string;
    tintColor: string;
}) {
    const { theme } = useUnistyles();

    return (
        <View style={[s.metricCard, { backgroundColor: theme.colors.surfaceContainer }]}>
            <View style={[s.metricIconCircle, { backgroundColor: `${tintColor}18` }]}>
                <Ionicons name={icon} size={18} color={tintColor} />
            </View>
            <Text style={[s.metricValue, { color: theme.colors.onSurface }]}>{value}</Text>
            <Text style={[s.metricLabel, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
        </View>
    );
}

// --- Case Type Section Header ---

function TypeSectionHeader({ caseType, count }: { caseType: CaseType; count: number }) {
    const { theme } = useUnistyles();
    const config = CASE_TYPE_CONFIG[caseType];

    return (
        <View style={s.typeSectionHeader}>
            <View style={[s.typeSectionIconCircle, { backgroundColor: `${config.color}18` }]}>
                <Ionicons name={config.icon} size={16} color={config.color} />
            </View>
            <Text style={[s.typeSectionTitle, { color: theme.colors.onSurface }]}>{caseType}</Text>
            <View style={[s.typeSectionCount, { backgroundColor: `${config.color}18` }]}>
                <Text style={[s.typeSectionCountText, { color: config.color }]}>{count}</Text>
            </View>
        </View>
    );
}

// --- Case Row ---

function CaseRow({
    legalCase,
    isSelected,
    onPress
}: {
    legalCase: LegalCase;
    isSelected: boolean;
    onPress: () => void;
}) {
    const { theme } = useUnistyles();
    const statusConfig = STATUS_CONFIG[legalCase.status];
    const deadlineColor = urgencyColor(legalCase.deadlineUrgency, theme);

    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                s.caseRow,
                { backgroundColor: theme.colors.surfaceContainer },
                isSelected && { borderColor: theme.colors.primary, borderWidth: 1.5 },
                pressed && { opacity: 0.85 }
            ]}
        >
            <View style={s.caseRowTop}>
                <Text style={[s.caseNumber, { color: theme.colors.onSurfaceVariant }]}>{legalCase.caseNumber}</Text>
                <View style={[s.statusChip, { backgroundColor: `${statusConfig.color}18` }]}>
                    <Text style={[s.statusChipText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
                </View>
            </View>
            <Text style={[s.caseTitle, { color: theme.colors.onSurface }]} numberOfLines={2}>
                {legalCase.title}
            </Text>
            <Text style={[s.caseClient, { color: theme.colors.onSurfaceVariant }]}>{legalCase.clientName}</Text>
            <View style={s.caseRowBottom}>
                <View style={s.caseDeadlineRow}>
                    <Ionicons name="calendar-outline" size={12} color={deadlineColor} />
                    <Text style={[s.caseDeadlineText, { color: deadlineColor }]}>{legalCase.nextDeadline}</Text>
                </View>
                <Text style={[s.caseBilled, { color: theme.colors.onSurface }]}>
                    {formatCurrency(legalCase.totalBilled)}
                </Text>
            </View>
        </Pressable>
    );
}

// --- Detail Panel ---

function DetailPanel({ legalCase, onClose }: { legalCase: LegalCase; onClose: () => void }) {
    const { theme } = useUnistyles();
    const statusConfig = STATUS_CONFIG[legalCase.status];
    const typeConfig = CASE_TYPE_CONFIG[legalCase.type];
    const [activeTab, setActiveTab] = React.useState<"timeline" | "documents" | "billing">("timeline");

    const totalHours = legalCase.billing.reduce((sum, e) => sum + e.hours, 0);
    const totalAmount = legalCase.billing.reduce((sum, e) => sum + e.hours * e.rate, 0);

    return (
        <View style={[s.detailPanel, { backgroundColor: theme.colors.surfaceContainer }]}>
            {/* Header */}
            <View style={s.detailHeader}>
                <View style={s.detailHeaderLeft}>
                    <View style={[s.detailTypeIcon, { backgroundColor: `${typeConfig.color}18` }]}>
                        <Ionicons name={typeConfig.icon} size={18} color={typeConfig.color} />
                    </View>
                    <View style={s.detailHeaderInfo}>
                        <Text style={[s.detailCaseNumber, { color: theme.colors.onSurfaceVariant }]}>
                            {legalCase.caseNumber}
                        </Text>
                        <Text style={[s.detailTitle, { color: theme.colors.onSurface }]} numberOfLines={2}>
                            {legalCase.title}
                        </Text>
                        <Text style={[s.detailClient, { color: theme.colors.onSurfaceVariant }]}>
                            {legalCase.clientName}
                        </Text>
                    </View>
                </View>
                <View style={[s.statusChip, { backgroundColor: `${statusConfig.color}18` }]}>
                    <Text style={[s.statusChipText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
                </View>
            </View>

            {/* Summary row */}
            <View style={s.detailSummaryRow}>
                <View style={[s.detailSummaryCard, { backgroundColor: theme.colors.surface }]}>
                    <Text style={[s.detailSummaryLabel, { color: theme.colors.onSurfaceVariant }]}>BILLED</Text>
                    <Text style={[s.detailSummaryValue, { color: theme.colors.onSurface }]}>
                        {formatCurrency(legalCase.totalBilled)}
                    </Text>
                </View>
                <View style={[s.detailSummaryCard, { backgroundColor: theme.colors.surface }]}>
                    <Text style={[s.detailSummaryLabel, { color: theme.colors.onSurfaceVariant }]}>HOURS</Text>
                    <Text style={[s.detailSummaryValue, { color: theme.colors.onSurface }]}>{totalHours}h</Text>
                </View>
                <View style={[s.detailSummaryCard, { backgroundColor: theme.colors.surface }]}>
                    <Text style={[s.detailSummaryLabel, { color: theme.colors.onSurfaceVariant }]}>DEADLINE</Text>
                    <Text
                        style={[
                            s.detailSummaryValue,
                            { color: urgencyColor(legalCase.deadlineUrgency, theme), fontSize: 13 }
                        ]}
                    >
                        {legalCase.nextDeadline}
                    </Text>
                </View>
            </View>

            {/* Tabs */}
            <View style={[s.tabBar, { borderBottomColor: theme.colors.outlineVariant }]}>
                {(["timeline", "documents", "billing"] as const).map((tab) => {
                    const isActive = activeTab === tab;
                    const tabLabel = tab.charAt(0).toUpperCase() + tab.slice(1);
                    return (
                        <Pressable key={tab} onPress={() => setActiveTab(tab)} style={s.tab}>
                            <Text
                                style={[
                                    s.tabText,
                                    { color: isActive ? theme.colors.primary : theme.colors.onSurfaceVariant },
                                    isActive && s.tabTextActive
                                ]}
                            >
                                {tabLabel}
                            </Text>
                            {isActive && <View style={[s.tabIndicator, { backgroundColor: theme.colors.primary }]} />}
                        </Pressable>
                    );
                })}
            </View>

            {/* Tab content */}
            {activeTab === "timeline" && (
                <View style={s.tabContent}>
                    {legalCase.timeline.map((event, idx) => {
                        const isLast = idx === legalCase.timeline.length - 1;
                        const eventIcon = TIMELINE_TYPE_ICONS[event.type] ?? "ellipse-outline";
                        return (
                            <View key={event.id} style={s.timelineRow}>
                                <View style={s.timelineSide}>
                                    <View style={[s.timelineDot, { backgroundColor: `${theme.colors.primary}30` }]}>
                                        <Ionicons name={eventIcon} size={12} color={theme.colors.primary} />
                                    </View>
                                    {!isLast && (
                                        <View
                                            style={[
                                                s.timelineVertLine,
                                                { backgroundColor: theme.colors.outlineVariant }
                                            ]}
                                        />
                                    )}
                                </View>
                                <View style={s.timelineContent}>
                                    <Text style={[s.timelineDate, { color: theme.colors.primary }]}>{event.date}</Text>
                                    <Text style={[s.timelineLabel, { color: theme.colors.onSurface }]}>
                                        {event.label}
                                    </Text>
                                </View>
                            </View>
                        );
                    })}
                </View>
            )}

            {activeTab === "documents" && (
                <View style={s.tabContent}>
                    {legalCase.documents.map((doc) => {
                        const fileIcon = FILE_TYPE_ICONS[doc.fileType] ?? "document-outline";
                        return (
                            <View key={doc.id} style={[s.docRow, { borderBottomColor: theme.colors.outlineVariant }]}>
                                <View style={[s.docIconCircle, { backgroundColor: `${theme.colors.primary}14` }]}>
                                    <Ionicons name={fileIcon} size={16} color={theme.colors.primary} />
                                </View>
                                <View style={s.docInfo}>
                                    <Text style={[s.docName, { color: theme.colors.onSurface }]} numberOfLines={1}>
                                        {doc.name}
                                    </Text>
                                    <Text style={[s.docDate, { color: theme.colors.onSurfaceVariant }]}>
                                        {doc.date}
                                    </Text>
                                </View>
                                <Ionicons name="download-outline" size={18} color={theme.colors.onSurfaceVariant} />
                            </View>
                        );
                    })}
                </View>
            )}

            {activeTab === "billing" && (
                <View style={s.tabContent}>
                    {legalCase.billing.map((entry) => (
                        <View
                            key={entry.description}
                            style={[s.billingRow, { borderBottomColor: theme.colors.outlineVariant }]}
                        >
                            <View style={s.billingInfo}>
                                <Text style={[s.billingDesc, { color: theme.colors.onSurface }]}>
                                    {entry.description}
                                </Text>
                                <Text style={[s.billingHours, { color: theme.colors.onSurfaceVariant }]}>
                                    {entry.hours}h @ {formatCurrency(entry.rate)}/hr
                                </Text>
                            </View>
                            <Text style={[s.billingAmount, { color: theme.colors.onSurface }]}>
                                {formatCurrency(entry.hours * entry.rate)}
                            </Text>
                        </View>
                    ))}
                    {/* Billing total */}
                    <View style={[s.billingTotalRow, { borderTopColor: theme.colors.outline }]}>
                        <Text style={[s.billingTotalLabel, { color: theme.colors.onSurface }]}>Total</Text>
                        <Text style={[s.billingTotalValue, { color: theme.colors.primary }]}>
                            {formatCurrency(totalAmount)}
                        </Text>
                    </View>
                </View>
            )}

            {/* Close button */}
            <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                    s.closeButton,
                    { borderColor: theme.colors.outlineVariant },
                    pressed && { opacity: 0.85 }
                ]}
            >
                <Text style={[s.closeButtonText, { color: theme.colors.onSurface }]}>Close</Text>
            </Pressable>
        </View>
    );
}

// --- Filter Chip ---

function FilterChip({
    label,
    isActive,
    onPress,
    color
}: {
    label: string;
    isActive: boolean;
    onPress: () => void;
    color: string;
}) {
    const { theme } = useUnistyles();

    return (
        <Pressable
            onPress={onPress}
            style={[
                s.filterChip,
                {
                    backgroundColor: isActive ? `${color}18` : theme.colors.surface,
                    borderColor: isActive ? color : theme.colors.outlineVariant
                }
            ]}
        >
            <Text style={[s.filterChipText, { color: isActive ? color : theme.colors.onSurfaceVariant }]}>{label}</Text>
        </Pressable>
    );
}

// --- Main Component ---

export function LegalCasesPage() {
    const { theme } = useUnistyles();
    const [selectedCaseId, setSelectedCaseId] = React.useState<string | null>(null);
    const [activeTypeFilter, setActiveTypeFilter] = React.useState<CaseType | null>(null);

    // Computed metrics
    const activeCases = CASES.filter((c) => c.status !== "closed" && c.status !== "settled");
    const upcomingDeadlines = CASES.filter(
        (c) => c.deadlineUrgency === "urgent" || c.deadlineUrgency === "overdue" || c.deadlineUrgency === "soon"
    );
    const billableHoursThisMonth = CASES.reduce((sum, c) => sum + c.billing.reduce((s, b) => s + b.hours, 0), 0);

    const filteredTypes = activeTypeFilter ? [activeTypeFilter] : CASE_TYPES;
    const selectedCase = selectedCaseId ? (CASES.find((c) => c.id === selectedCaseId) ?? null) : null;

    const handleFilterPress = React.useCallback((caseType: CaseType) => {
        setActiveTypeFilter((prev) => (prev === caseType ? null : caseType));
    }, []);

    return (
        <ScrollView contentContainerStyle={s.root} showsVerticalScrollIndicator={false}>
            {/* Page Title */}
            <View style={s.pageTitleRow}>
                <View style={[s.pageTitleIcon, { backgroundColor: `${theme.colors.primary}18` }]}>
                    <Ionicons name="briefcase-outline" size={22} color={theme.colors.primary} />
                </View>
                <View style={s.pageTitleText}>
                    <Text style={[s.pageTitle, { color: theme.colors.onSurface }]}>Case Management</Text>
                    <Text style={[s.pageSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                        Law Office of J. Harrison
                    </Text>
                </View>
            </View>

            {/* Metrics Row */}
            <View style={s.metricsRow}>
                <MetricCard
                    icon="folder-open-outline"
                    label="Active Cases"
                    value={`${activeCases.length}`}
                    tintColor="#3B82F6"
                />
                <MetricCard
                    icon="alarm-outline"
                    label="Deadlines This Week"
                    value={`${upcomingDeadlines.length}`}
                    tintColor="#F59E0B"
                />
                <MetricCard
                    icon="time-outline"
                    label="Hours This Month"
                    value={`${billableHoursThisMonth}`}
                    tintColor="#10B981"
                />
            </View>

            {/* Detail panel (replaces list when a case is selected) */}
            {selectedCase ? (
                <DetailPanel legalCase={selectedCase} onClose={() => setSelectedCaseId(null)} />
            ) : (
                <>
                    {/* Filter chips */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
                        {CASE_TYPES.map((ct) => {
                            const config = CASE_TYPE_CONFIG[ct];
                            return (
                                <FilterChip
                                    key={ct}
                                    label={ct}
                                    isActive={activeTypeFilter === ct}
                                    onPress={() => handleFilterPress(ct)}
                                    color={config.color}
                                />
                            );
                        })}
                    </ScrollView>

                    {/* Cases grouped by type */}
                    {filteredTypes.map((caseType) => {
                        const casesOfType = CASES.filter((c) => c.type === caseType);
                        if (casesOfType.length === 0) return null;
                        return (
                            <View key={caseType} style={s.typeSection}>
                                <TypeSectionHeader caseType={caseType} count={casesOfType.length} />
                                <View style={s.caseList}>
                                    {casesOfType.map((legalCase) => (
                                        <CaseRow
                                            key={legalCase.id}
                                            legalCase={legalCase}
                                            isSelected={selectedCaseId === legalCase.id}
                                            onPress={() => setSelectedCaseId(legalCase.id)}
                                        />
                                    ))}
                                </View>
                            </View>
                        );
                    })}
                </>
            )}
        </ScrollView>
    );
}

// --- Styles ---

const s = StyleSheet.create((_theme) => ({
    root: {
        maxWidth: 600,
        width: "100%",
        alignSelf: "center",
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 48,
        gap: 20
    },

    // Page title
    pageTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12
    },
    pageTitleIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center"
    },
    pageTitleText: {
        flex: 1,
        gap: 2
    },
    pageTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 22,
        lineHeight: 28
    },
    pageSubtitle: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 18
    },

    // Metrics row
    metricsRow: {
        flexDirection: "row",
        gap: 10
    },
    metricCard: {
        flex: 1,
        borderRadius: 12,
        padding: 14,
        alignItems: "center",
        gap: 6
    },
    metricIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center"
    },
    metricValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 22,
        lineHeight: 28
    },
    metricLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 10,
        lineHeight: 14,
        textAlign: "center",
        textTransform: "uppercase",
        letterSpacing: 0.4
    },

    // Filter row
    filterRow: {
        flexDirection: "row",
        gap: 8,
        paddingVertical: 2
    },
    filterChip: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        borderWidth: 1
    },
    filterChipText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13
    },

    // Type section
    typeSection: {
        gap: 10
    },
    typeSectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    typeSectionIconCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center"
    },
    typeSectionTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 16,
        lineHeight: 22,
        flex: 1
    },
    typeSectionCount: {
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 6
    },
    typeSectionCountText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11
    },

    // Case list
    caseList: {
        gap: 8
    },

    // Case row card
    caseRow: {
        borderRadius: 12,
        padding: 14,
        gap: 6,
        borderWidth: 1,
        borderColor: "transparent"
    },
    caseRowTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    caseNumber: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 12,
        lineHeight: 16
    },
    statusChip: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10
    },
    statusChipText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11
    },
    caseTitle: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 14,
        lineHeight: 20
    },
    caseClient: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        lineHeight: 16
    },
    caseRowBottom: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 2
    },
    caseDeadlineRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4
    },
    caseDeadlineText: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11,
        lineHeight: 16
    },
    caseBilled: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 13,
        lineHeight: 18
    },

    // Detail panel
    detailPanel: {
        borderRadius: 16,
        padding: 18,
        gap: 16
    },
    detailHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 10
    },
    detailHeaderLeft: {
        flexDirection: "row",
        gap: 10,
        flex: 1
    },
    detailTypeIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 2
    },
    detailHeaderInfo: {
        flex: 1,
        gap: 2
    },
    detailCaseNumber: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 12,
        lineHeight: 16
    },
    detailTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 16,
        lineHeight: 22
    },
    detailClient: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 18
    },

    // Detail summary row
    detailSummaryRow: {
        flexDirection: "row",
        gap: 8
    },
    detailSummaryCard: {
        flex: 1,
        borderRadius: 10,
        padding: 10,
        alignItems: "center",
        gap: 4
    },
    detailSummaryLabel: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 9,
        letterSpacing: 0.6,
        textTransform: "uppercase"
    },
    detailSummaryValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 16,
        lineHeight: 22
    },

    // Tab bar
    tabBar: {
        flexDirection: "row",
        borderBottomWidth: 1
    },
    tab: {
        flex: 1,
        alignItems: "center",
        paddingVertical: 10,
        position: "relative"
    },
    tabText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13
    },
    tabTextActive: {
        fontFamily: "IBMPlexSans-SemiBold"
    },
    tabIndicator: {
        position: "absolute",
        bottom: -1,
        left: 16,
        right: 16,
        height: 2,
        borderRadius: 1
    },

    // Tab content
    tabContent: {
        gap: 0
    },

    // Timeline
    timelineRow: {
        flexDirection: "row",
        gap: 10
    },
    timelineSide: {
        alignItems: "center",
        width: 28
    },
    timelineDot: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center"
    },
    timelineVertLine: {
        width: 2,
        flex: 1,
        marginTop: 2,
        marginBottom: 2
    },
    timelineContent: {
        flex: 1,
        paddingBottom: 14,
        gap: 2
    },
    timelineDate: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 12,
        lineHeight: 16
    },
    timelineLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 19
    },

    // Documents
    docRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth
    },
    docIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center"
    },
    docInfo: {
        flex: 1,
        gap: 2
    },
    docName: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13,
        lineHeight: 18
    },
    docDate: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11,
        lineHeight: 16
    },

    // Billing
    billingRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth
    },
    billingInfo: {
        flex: 1,
        gap: 2,
        marginRight: 12
    },
    billingDesc: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13,
        lineHeight: 18
    },
    billingHours: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11,
        lineHeight: 16
    },
    billingAmount: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 14,
        lineHeight: 20
    },
    billingTotalRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: 12,
        marginTop: 4,
        borderTopWidth: 1.5
    },
    billingTotalLabel: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 14
    },
    billingTotalValue: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 16
    },

    // Close button
    closeButton: {
        borderWidth: 1,
        borderRadius: 10,
        paddingVertical: 10,
        alignItems: "center"
    },
    closeButtonText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 14
    }
}));
