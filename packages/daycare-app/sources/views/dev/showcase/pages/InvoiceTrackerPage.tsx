import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
// --- Types ---
import { Card } from "@/components/Card";
import { Grid } from "@/components/Grid";
import { ShowcasePage } from "@/views/dev/showcase/components/ShowcasePage";

type InvoiceStatus = "overdue" | "pending" | "paid";
interface LineItem {
    description: string;
    hours: number;
    rate: number;
}
interface Invoice {
    id: string;
    invoiceNumber: string;
    clientName: string;
    amount: number;
    dueDate: string;
    status: InvoiceStatus;
    lineItems: LineItem[];
    notes: string;
}

// --- Mock Data ---

const mockInvoices: Invoice[] = [
    {
        id: "1",
        invoiceNumber: "INV-1041",
        clientName: "Greenfield Architects",
        amount: 4250.0,
        dueDate: "Feb 12, 2026",
        status: "overdue",
        lineItems: [
            {
                description: "Brand identity redesign",
                hours: 20,
                rate: 150
            },
            {
                description: "Stationery design",
                hours: 10,
                rate: 125
            },
            {
                description: "Brand guidelines document",
                hours: 5,
                rate: 100
            }
        ],
        notes: "Net 30. Second follow-up sent Feb 20."
    },
    {
        id: "2",
        invoiceNumber: "INV-1038",
        clientName: "Maple & Co Legal",
        amount: 1800.0,
        dueDate: "Feb 5, 2026",
        status: "overdue",
        lineItems: [
            {
                description: "Website copywriting",
                hours: 12,
                rate: 150
            }
        ],
        notes: "Client requested extension previously. Follow up ASAP."
    },
    {
        id: "3",
        invoiceNumber: "INV-1044",
        clientName: "Nimbus SaaS Inc.",
        amount: 6400.0,
        dueDate: "Feb 18, 2026",
        status: "overdue",
        lineItems: [
            {
                description: "Dashboard UI design",
                hours: 32,
                rate: 175
            },
            {
                description: "Design system tokens",
                hours: 8,
                rate: 150
            }
        ],
        notes: "Sent reminder on Feb 25. Awaiting AP department response."
    },
    {
        id: "4",
        invoiceNumber: "INV-1047",
        clientName: "Brightpath Education",
        amount: 3200.0,
        dueDate: "Mar 15, 2026",
        status: "pending",
        lineItems: [
            {
                description: "Mobile app wireframes",
                hours: 16,
                rate: 150
            },
            {
                description: "Usability review",
                hours: 8,
                rate: 150
            }
        ],
        notes: "Due on delivery of final wireframes."
    },
    {
        id: "5",
        invoiceNumber: "INV-1048",
        clientName: "Verdant Foods",
        amount: 2100.0,
        dueDate: "Mar 20, 2026",
        status: "pending",
        lineItems: [
            {
                description: "Packaging illustration",
                hours: 14,
                rate: 150
            }
        ],
        notes: "Net 30 from invoice date."
    },
    {
        id: "6",
        invoiceNumber: "INV-1049",
        clientName: "Atlas Ventures",
        amount: 5750.0,
        dueDate: "Mar 28, 2026",
        status: "pending",
        lineItems: [
            {
                description: "Pitch deck design",
                hours: 25,
                rate: 175
            },
            {
                description: "Financial charts",
                hours: 10,
                rate: 150
            }
        ],
        notes: "Half upfront received. Remainder on completion."
    },
    {
        id: "7",
        invoiceNumber: "INV-1050",
        clientName: "Clearview Analytics",
        amount: 900.0,
        dueDate: "Mar 31, 2026",
        status: "pending",
        lineItems: [
            {
                description: "Data visualization consulting",
                hours: 6,
                rate: 150
            }
        ],
        notes: ""
    },
    {
        id: "8",
        invoiceNumber: "INV-1030",
        clientName: "Summit Healthcare",
        amount: 7500.0,
        dueDate: "Jan 25, 2026",
        status: "paid",
        lineItems: [
            {
                description: "Patient portal UX audit",
                hours: 30,
                rate: 175
            },
            {
                description: "Redesign mockups",
                hours: 20,
                rate: 150
            }
        ],
        notes: "Paid via wire transfer Feb 28."
    },
    {
        id: "9",
        invoiceNumber: "INV-1033",
        clientName: "Coastal Realty",
        amount: 2400.0,
        dueDate: "Feb 1, 2026",
        status: "paid",
        lineItems: [
            {
                description: "Property listing page redesign",
                hours: 16,
                rate: 150
            }
        ],
        notes: "Paid Mar 1 via check."
    },
    {
        id: "10",
        invoiceNumber: "INV-1036",
        clientName: "Ember Studios",
        amount: 3600.0,
        dueDate: "Feb 10, 2026",
        status: "paid",
        lineItems: [
            {
                description: "Game UI concept art",
                hours: 18,
                rate: 150
            },
            {
                description: "Icon set (48 icons)",
                hours: 12,
                rate: 100
            }
        ],
        notes: "Paid Feb 28. Repeat client."
    },
    {
        id: "11",
        invoiceNumber: "INV-1039",
        clientName: "Drift Coffee Roasters",
        amount: 1350.0,
        dueDate: "Feb 15, 2026",
        status: "paid",
        lineItems: [
            {
                description: "Menu board design",
                hours: 6,
                rate: 125
            },
            {
                description: "Social media templates",
                hours: 4,
                rate: 100
            }
        ],
        notes: "Paid early. Great client."
    }
];

// --- Helpers ---

function formatCurrency(amount: number): string {
    return `$${amount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}
function statusColorForTheme(
    status: InvoiceStatus,
    theme: {
        colors: Record<string, string>;
    }
): string {
    if (status === "overdue") return theme.colors.error;
    if (status === "pending") return theme.colors.primary;
    return theme.colors.tertiary;
}
function statusLabel(status: InvoiceStatus): string {
    if (status === "overdue") return "OVERDUE";
    if (status === "pending") return "PENDING";
    return "PAID";
}

// --- Sub-components ---

function StatusCard({
    label,
    count,
    total,
    tintColor
}: {
    label: string;
    count: number;
    total: number;
    tintColor: string;
}) {
    return (
        <Card
            style={[
                styles.statusCard,
                {
                    backgroundColor: `${tintColor}14`
                }
            ]}
        >
            <View
                style={[
                    styles.statusCardStripe,
                    {
                        backgroundColor: tintColor
                    }
                ]}
            />
            <Text
                style={[
                    styles.statusCardLabel,
                    {
                        color: tintColor
                    }
                ]}
            >
                {label}
            </Text>
            <Text
                style={[
                    styles.statusCardCount,
                    {
                        color: tintColor
                    }
                ]}
            >
                {count}
            </Text>
            <Text
                style={[
                    styles.statusCardTotal,
                    {
                        color: `${tintColor}BB`
                    }
                ]}
            >
                {formatCurrency(total)}
            </Text>
        </Card>
    );
}
function InvoiceCard({
    invoice,
    onPress,
    statusColor
}: {
    invoice: Invoice;
    onPress: () => void;
    statusColor: string;
}) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.invoiceCard,
                pressed && {
                    opacity: 0.85
                }
            ]}
        >
            <View
                style={[
                    styles.invoiceCardBar,
                    {
                        backgroundColor: statusColor
                    }
                ]}
            />
            <View style={styles.invoiceCardContent}>
                <View style={styles.invoiceCardTopRow}>
                    <Text style={styles.invoiceCardClient} numberOfLines={1}>
                        {invoice.clientName}
                    </Text>
                    <Text
                        style={[
                            styles.invoiceCardAmount,
                            {
                                color: statusColor
                            }
                        ]}
                    >
                        {formatCurrency(invoice.amount)}
                    </Text>
                </View>
                <View style={styles.invoiceCardBottomRow}>
                    <Text style={styles.invoiceCardMeta}>{invoice.invoiceNumber}</Text>
                    <View
                        style={[
                            styles.invoiceCardBadge,
                            {
                                backgroundColor: `${statusColor}18`
                            }
                        ]}
                    >
                        <Text
                            style={[
                                styles.invoiceCardBadgeText,
                                {
                                    color: statusColor
                                }
                            ]}
                        >
                            {statusLabel(invoice.status)}
                        </Text>
                    </View>
                </View>
                <Text style={styles.invoiceCardDue}>Due {invoice.dueDate}</Text>
            </View>
        </Pressable>
    );
}
function DetailOverlay({
    invoice,
    onClose,
    onMarkPaid
}: {
    invoice: Invoice;
    onClose: () => void;
    onMarkPaid: (id: string) => void;
}) {
    const { theme } = useUnistyles();
    const color = statusColorForTheme(invoice.status, theme);
    return (
        <View style={styles.detailOverlay}>
            {/* Header */}
            <View style={styles.detailHeader}>
                <View
                    style={{
                        flex: 1
                    }}
                >
                    <Text style={styles.detailInvoiceNumber}>{invoice.invoiceNumber}</Text>
                    <Text style={styles.detailClient}>{invoice.clientName}</Text>
                </View>
                <View
                    style={[
                        styles.detailStatusChip,
                        {
                            backgroundColor: `${color}18`
                        }
                    ]}
                >
                    <Text
                        style={[
                            styles.detailStatusChipText,
                            {
                                color
                            }
                        ]}
                    >
                        {statusLabel(invoice.status)}
                    </Text>
                </View>
            </View>

            {/* Amount and Due Date row */}
            <View style={styles.detailSummaryRow}>
                <View style={styles.detailSummaryItem}>
                    <Text style={styles.detailSummaryLabel}>TOTAL AMOUNT</Text>
                    <Text
                        style={[
                            styles.detailSummaryValue,
                            {
                                color
                            }
                        ]}
                    >
                        {formatCurrency(invoice.amount)}
                    </Text>
                </View>
                <View
                    style={[
                        styles.detailSummaryDivider,
                        {
                            backgroundColor: theme.colors.outlineVariant
                        }
                    ]}
                />
                <View style={styles.detailSummaryItem}>
                    <Text style={styles.detailSummaryLabel}>DUE DATE</Text>
                    <Text style={styles.detailSummaryDateValue}>{invoice.dueDate}</Text>
                </View>
            </View>

            {/* Line Items Table */}
            <View style={styles.detailTableSection}>
                <Text style={styles.detailSectionTitle}>Line Items</Text>
                {/* Table header */}
                <View
                    style={[
                        styles.detailTableHeaderRow,
                        {
                            borderBottomColor: theme.colors.outlineVariant
                        }
                    ]}
                >
                    <Text
                        style={[
                            styles.detailTableHeaderCell,
                            styles.detailTableDescCol,
                            {
                                color: theme.colors.onSurfaceVariant
                            }
                        ]}
                    >
                        Description
                    </Text>
                    <Text
                        style={[
                            styles.detailTableHeaderCell,
                            styles.detailTableNumCol,
                            {
                                color: theme.colors.onSurfaceVariant
                            }
                        ]}
                    >
                        Hours
                    </Text>
                    <Text
                        style={[
                            styles.detailTableHeaderCell,
                            styles.detailTableNumCol,
                            {
                                color: theme.colors.onSurfaceVariant
                            }
                        ]}
                    >
                        Rate
                    </Text>
                    <Text
                        style={[
                            styles.detailTableHeaderCell,
                            styles.detailTableNumCol,
                            {
                                color: theme.colors.onSurfaceVariant
                            }
                        ]}
                    >
                        Total
                    </Text>
                </View>
                {/* Table rows */}
                {invoice.lineItems.map((li, idx) => (
                    <View
                        key={li.description}
                        style={[
                            styles.detailTableRow,
                            idx < invoice.lineItems.length - 1 && {
                                borderBottomWidth: StyleSheet.hairlineWidth,
                                borderBottomColor: theme.colors.outlineVariant
                            }
                        ]}
                    >
                        <Text
                            style={[
                                styles.detailTableCell,
                                styles.detailTableDescCol,
                                {
                                    color: theme.colors.onSurface
                                }
                            ]}
                        >
                            {li.description}
                        </Text>
                        <Text
                            style={[
                                styles.detailTableCell,
                                styles.detailTableNumCol,
                                {
                                    color: theme.colors.onSurfaceVariant
                                }
                            ]}
                        >
                            {li.hours}h
                        </Text>
                        <Text
                            style={[
                                styles.detailTableCell,
                                styles.detailTableNumCol,
                                {
                                    color: theme.colors.onSurfaceVariant
                                }
                            ]}
                        >
                            {formatCurrency(li.rate)}
                        </Text>
                        <Text
                            style={[
                                styles.detailTableCell,
                                styles.detailTableNumCol,
                                {
                                    color: theme.colors.onSurface
                                }
                            ]}
                        >
                            {formatCurrency(li.hours * li.rate)}
                        </Text>
                    </View>
                ))}
            </View>

            {/* Notes */}
            {invoice.notes ? (
                <View style={styles.detailNotesSection}>
                    <Text style={styles.detailSectionTitle}>Notes</Text>
                    <Text style={styles.detailNotesText}>{invoice.notes}</Text>
                </View>
            ) : null}

            {/* Actions */}
            <View style={styles.detailActions}>
                {invoice.status !== "paid" && (
                    <Pressable
                        onPress={() => onMarkPaid(invoice.id)}
                        style={({ pressed }) => [
                            styles.actionButton,
                            {
                                backgroundColor: theme.colors.primary
                            },
                            pressed && {
                                opacity: 0.85
                            }
                        ]}
                    >
                        <Text style={styles.actionButtonText}>Mark as Paid</Text>
                    </Pressable>
                )}
                <Pressable
                    onPress={onClose}
                    style={({ pressed }) => [
                        styles.actionButtonSecondary,
                        {
                            borderColor: theme.colors.outlineVariant
                        },
                        pressed && {
                            opacity: 0.85
                        }
                    ]}
                >
                    <Text
                        style={[
                            styles.actionButtonSecondaryText,
                            {
                                color: theme.colors.onSurface
                            }
                        ]}
                    >
                        Close
                    </Text>
                </Pressable>
            </View>
        </View>
    );
}

// --- Main Component ---

/**
 * Freelancer Invoice Tracker showcase page.
 * Financial dashboard layout with hero metric, status cards, and activity cards.
 */
export function InvoiceTrackerPage() {
    const { theme } = useUnistyles();
    const [selectedInvoice, setSelectedInvoice] = React.useState<Invoice | null>(null);
    const [invoices, setInvoices] = React.useState<Invoice[]>(mockInvoices);
    const overdue = invoices.filter((inv) => inv.status === "overdue");
    const pending = invoices.filter((inv) => inv.status === "pending");
    const paid = invoices.filter((inv) => inv.status === "paid");
    const totalOutstanding = [...overdue, ...pending].reduce((sum, inv) => sum + inv.amount, 0);
    const totalPaid = paid.reduce((sum, inv) => sum + inv.amount, 0);
    const invoiceCount = invoices.length;
    const handleMarkPaid = React.useCallback((id: string) => {
        setInvoices((prev) =>
            prev.map((inv) =>
                inv.id === id
                    ? {
                          ...inv,
                          status: "paid" as InvoiceStatus
                      }
                    : inv
            )
        );
        setSelectedInvoice(null);
    }, []);

    // Resolve the current state of the selected invoice (in case status changed)
    const currentSelected = selectedInvoice ? (invoices.find((inv) => inv.id === selectedInvoice.id) ?? null) : null;
    return (
        <ShowcasePage style={styles.root} topInset={20}>
            {/* Detail overlay replaces content when an invoice is selected */}
            {currentSelected ? (
                <DetailOverlay
                    invoice={currentSelected}
                    onClose={() => setSelectedInvoice(null)}
                    onMarkPaid={handleMarkPaid}
                />
            ) : (
                <>
                    {/* Hero Metric Section */}
                    <View style={styles.heroSection}>
                        <Text style={styles.heroLabel}>Total Outstanding</Text>
                        <Text style={styles.heroAmount}>{formatCurrency(totalOutstanding)}</Text>
                        <View style={styles.heroSubMetrics}>
                            <View style={styles.heroSubMetric}>
                                <Text style={styles.heroSubValue}>{formatCurrency(totalPaid)}</Text>
                                <Text style={styles.heroSubLabel}>Collected</Text>
                            </View>
                            <View
                                style={[
                                    styles.heroSubDivider,
                                    {
                                        backgroundColor: theme.colors.outlineVariant
                                    }
                                ]}
                            />
                            <View style={styles.heroSubMetric}>
                                <Text style={styles.heroSubValue}>{invoiceCount}</Text>
                                <Text style={styles.heroSubLabel}>Invoices</Text>
                            </View>
                            <View
                                style={[
                                    styles.heroSubDivider,
                                    {
                                        backgroundColor: theme.colors.outlineVariant
                                    }
                                ]}
                            />
                            <View style={styles.heroSubMetric}>
                                <Text
                                    style={[
                                        styles.heroSubValue,
                                        {
                                            color: theme.colors.error
                                        }
                                    ]}
                                >
                                    {overdue.length}
                                </Text>
                                <Text style={styles.heroSubLabel}>Overdue</Text>
                            </View>
                        </View>
                    </View>

                    {/* Status Cards Row */}
                    <View style={styles.statusCardsRow}>
                        <StatusCard
                            label="Overdue"
                            count={overdue.length}
                            total={overdue.reduce((s, i) => s + i.amount, 0)}
                            tintColor={theme.colors.error}
                        />
                        <StatusCard
                            label="Pending"
                            count={pending.length}
                            total={pending.reduce((s, i) => s + i.amount, 0)}
                            tintColor={theme.colors.primary}
                        />
                        <StatusCard
                            label="Paid"
                            count={paid.length}
                            total={paid.reduce((s, i) => s + i.amount, 0)}
                            tintColor={theme.colors.tertiary}
                        />
                    </View>

                    {/* Recent Activity Section */}
                    <View style={styles.activitySection}>
                        <Text style={styles.sectionTitle}>Recent Activity</Text>
                        <Grid style={styles.activityGrid}>
                            {invoices.map((inv) => (
                                <InvoiceCard
                                    key={inv.id}
                                    invoice={inv}
                                    onPress={() => setSelectedInvoice(inv)}
                                    statusColor={statusColorForTheme(inv.status, theme)}
                                />
                            ))}
                        </Grid>
                    </View>
                </>
            )}
        </ShowcasePage>
    );
}

// --- Styles ---

const styles = StyleSheet.create((theme) => ({
    root: {
        flex: 1
    },
    // Hero section
    heroSection: {
        backgroundColor: theme.colors.surfaceContainer,
        borderRadius: 16,
        padding: 24,
        alignItems: "center",
        marginBottom: 16
    },
    heroLabel: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13,
        color: theme.colors.onSurfaceVariant,
        letterSpacing: 0.8,
        textTransform: "uppercase",
        marginBottom: 4
    },
    heroAmount: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 36,
        color: theme.colors.onSurface,
        letterSpacing: -1,
        marginBottom: 20
    },
    heroSubMetrics: {
        flexDirection: "row",
        alignItems: "center",
        gap: 16
    },
    heroSubMetric: {
        alignItems: "center",
        gap: 2
    },
    heroSubValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 16,
        color: theme.colors.onSurface,
        letterSpacing: -0.3
    },
    heroSubLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11,
        color: theme.colors.onSurfaceVariant,
        letterSpacing: 0.3,
        textTransform: "uppercase"
    },
    heroSubDivider: {
        width: 1,
        height: 28,
        backgroundColor: theme.colors.outlineVariant
    },
    // Status cards row
    statusCardsRow: {
        flexDirection: "row",
        gap: 10,
        marginBottom: 24
    },
    statusCard: {
        flex: 1,
        borderRadius: 12,
        padding: 14,
        paddingLeft: 18,
        alignItems: "flex-start",
        gap: 2,
        overflow: "hidden"
    },
    statusCardStripe: {
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
        borderTopLeftRadius: 12,
        borderBottomLeftRadius: 12
    },
    statusCardLabel: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11,
        letterSpacing: 0.6,
        textTransform: "uppercase"
    },
    statusCardCount: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 24,
        letterSpacing: -0.5
    },
    statusCardTotal: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        letterSpacing: -0.2
    },
    // Activity section
    activitySection: {
        gap: 12
    },
    sectionTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15,
        color: theme.colors.onSurface,
        letterSpacing: -0.2
    },
    activityGrid: {
        gap: 8
    },
    // Invoice card
    invoiceCard: {
        flexDirection: "row",
        backgroundColor: theme.colors.surfaceContainer,
        borderRadius: 12,
        overflow: "hidden"
    },
    invoiceCardBar: {
        width: 4
    },
    invoiceCardContent: {
        flex: 1,
        padding: 14,
        gap: 4
    },
    invoiceCardTopRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    invoiceCardClient: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 15,
        color: theme.colors.onSurface,
        flex: 1,
        marginRight: 12
    },
    invoiceCardAmount: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15,
        letterSpacing: -0.3
    },
    invoiceCardBottomRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    invoiceCardMeta: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        color: theme.colors.onSurfaceVariant
    },
    invoiceCardBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10
    },
    invoiceCardBadgeText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 10,
        letterSpacing: 0.5
    },
    invoiceCardDue: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        color: theme.colors.outline,
        marginTop: 2
    },
    // Detail overlay
    detailOverlay: {
        backgroundColor: theme.colors.surfaceContainer,
        borderRadius: 16,
        padding: 20,
        gap: 20
    },
    detailHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start"
    },
    detailInvoiceNumber: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 20,
        color: theme.colors.onSurface,
        letterSpacing: -0.3
    },
    detailClient: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14,
        color: theme.colors.onSurfaceVariant,
        marginTop: 2
    },
    detailStatusChip: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12
    },
    detailStatusChipText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 11,
        letterSpacing: 0.5
    },
    // Detail summary row
    detailSummaryRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 16
    },
    detailSummaryItem: {
        flex: 1,
        alignItems: "center",
        gap: 4
    },
    detailSummaryLabel: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 10,
        color: theme.colors.onSurfaceVariant,
        letterSpacing: 0.8,
        textTransform: "uppercase"
    },
    detailSummaryValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 22,
        letterSpacing: -0.5
    },
    detailSummaryDateValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 16,
        color: theme.colors.onSurface,
        letterSpacing: -0.3
    },
    detailSummaryDivider: {
        width: 1,
        height: 36
    },
    // Detail table
    detailTableSection: {
        gap: 8
    },
    detailSectionTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 14,
        color: theme.colors.onSurface,
        letterSpacing: -0.1
    },
    detailTableHeaderRow: {
        flexDirection: "row",
        paddingBottom: 8,
        borderBottomWidth: 1
    },
    detailTableHeaderCell: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11,
        letterSpacing: 0.5,
        textTransform: "uppercase"
    },
    detailTableDescCol: {
        flex: 2
    },
    detailTableNumCol: {
        flex: 1,
        textAlign: "right"
    },
    detailTableRow: {
        flexDirection: "row",
        paddingVertical: 10
    },
    detailTableCell: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13
    },
    // Detail notes
    detailNotesSection: {
        gap: 6
    },
    detailNotesText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        color: theme.colors.onSurfaceVariant,
        lineHeight: 20
    },
    // Detail actions
    detailActions: {
        flexDirection: "row",
        gap: 10,
        justifyContent: "flex-end",
        paddingTop: 4
    },
    actionButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: "center"
    },
    actionButtonText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 14,
        color: "#FFFFFF"
    },
    actionButtonSecondary: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: "center"
    },
    actionButtonSecondaryText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14
    }
}));
