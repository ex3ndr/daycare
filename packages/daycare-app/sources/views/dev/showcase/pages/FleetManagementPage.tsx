import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

// --- Types ---

type VehicleStatus = "active" | "maintenance" | "idle";
type VehicleType = "Sedans" | "Vans" | "Trucks";

interface Vehicle {
    id: string;
    make: string;
    model: string;
    type: VehicleType;
    driver: string;
    mileage: number;
    status: VehicleStatus;
    nextServiceDate: string;
    serviceOverdue: boolean;
    licensePlate: string;
    fuelLevel: number;
    lastLocation: string;
}

// --- Mock Data ---

const mockVehicles: Vehicle[] = [
    // Sedans
    {
        id: "VH-1001",
        make: "Toyota",
        model: "Camry",
        type: "Sedans",
        driver: "Maria Santos",
        mileage: 47832,
        status: "active",
        nextServiceDate: "Mar 15, 2026",
        serviceOverdue: false,
        licensePlate: "ABC 1234",
        fuelLevel: 72,
        lastLocation: "Downtown Hub"
    },
    {
        id: "VH-1002",
        make: "Honda",
        model: "Accord",
        type: "Sedans",
        driver: "James Lee",
        mileage: 63210,
        status: "maintenance",
        nextServiceDate: "Feb 20, 2026",
        serviceOverdue: true,
        licensePlate: "DEF 5678",
        fuelLevel: 15,
        lastLocation: "Service Center A"
    },
    {
        id: "VH-1003",
        make: "Ford",
        model: "Fusion",
        type: "Sedans",
        driver: "Unassigned",
        mileage: 31540,
        status: "idle",
        nextServiceDate: "Apr 10, 2026",
        serviceOverdue: false,
        licensePlate: "GHI 9012",
        fuelLevel: 90,
        lastLocation: "Lot B"
    },
    {
        id: "VH-1004",
        make: "Chevrolet",
        model: "Malibu",
        type: "Sedans",
        driver: "Sofia Garcia",
        mileage: 55180,
        status: "active",
        nextServiceDate: "Feb 28, 2026",
        serviceOverdue: true,
        licensePlate: "JKL 3456",
        fuelLevel: 44,
        lastLocation: "Route 7 North"
    },
    // Vans
    {
        id: "VH-2001",
        make: "Mercedes",
        model: "Sprinter",
        type: "Vans",
        driver: "Alex Petrov",
        mileage: 82450,
        status: "active",
        nextServiceDate: "Mar 22, 2026",
        serviceOverdue: false,
        licensePlate: "MNO 7890",
        fuelLevel: 58,
        lastLocation: "Warehouse District"
    },
    {
        id: "VH-2002",
        make: "Ford",
        model: "Transit",
        type: "Vans",
        driver: "Rachel Kim",
        mileage: 71290,
        status: "active",
        nextServiceDate: "Jan 15, 2026",
        serviceOverdue: true,
        licensePlate: "PQR 1234",
        fuelLevel: 33,
        lastLocation: "Industrial Park"
    },
    {
        id: "VH-2003",
        make: "RAM",
        model: "ProMaster",
        type: "Vans",
        driver: "Unassigned",
        mileage: 45600,
        status: "idle",
        nextServiceDate: "May 5, 2026",
        serviceOverdue: false,
        licensePlate: "STU 5678",
        fuelLevel: 85,
        lastLocation: "Lot A"
    },
    // Trucks
    {
        id: "VH-3001",
        make: "Ford",
        model: "F-150",
        type: "Trucks",
        driver: "Derek Chang",
        mileage: 98120,
        status: "active",
        nextServiceDate: "Mar 8, 2026",
        serviceOverdue: false,
        licensePlate: "VWX 9012",
        fuelLevel: 62,
        lastLocation: "Construction Site 4"
    },
    {
        id: "VH-3002",
        make: "Chevrolet",
        model: "Silverado",
        type: "Trucks",
        driver: "Tom Fischer",
        mileage: 112340,
        status: "maintenance",
        nextServiceDate: "Feb 10, 2026",
        serviceOverdue: true,
        licensePlate: "YZA 3456",
        fuelLevel: 8,
        lastLocation: "Service Center B"
    },
    {
        id: "VH-3003",
        make: "Toyota",
        model: "Tundra",
        type: "Trucks",
        driver: "Nina Volkov",
        mileage: 76890,
        status: "active",
        nextServiceDate: "Apr 1, 2026",
        serviceOverdue: false,
        licensePlate: "BCD 7890",
        fuelLevel: 81,
        lastLocation: "Highway 95 South"
    },
    {
        id: "VH-3004",
        make: "RAM",
        model: "1500",
        type: "Trucks",
        driver: "Unassigned",
        mileage: 54210,
        status: "idle",
        nextServiceDate: "Mar 30, 2026",
        serviceOverdue: false,
        licensePlate: "EFG 1234",
        fuelLevel: 95,
        lastLocation: "Lot C"
    }
];

// --- Helpers ---

function formatMileage(miles: number): string {
    return miles.toLocaleString("en-US");
}

function initialsFrom(name: string): string {
    if (name === "Unassigned") return "?";
    const parts = name.split(" ");
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
}

const avatarHues = ["#6366F1", "#EC4899", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EF4444", "#14B8A6"];

function colorForName(name: string): string {
    if (name === "Unassigned") return "#9CA3AF";
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return avatarHues[Math.abs(hash) % avatarHues.length];
}

function statusColor(status: VehicleStatus): string {
    switch (status) {
        case "active":
            return "#10B981";
        case "maintenance":
            return "#F59E0B";
        case "idle":
            return "#9CA3AF";
    }
}

function statusLabel(status: VehicleStatus): string {
    switch (status) {
        case "active":
            return "Active";
        case "maintenance":
            return "Maintenance";
        case "idle":
            return "Idle";
    }
}

function statusIcon(status: VehicleStatus): keyof typeof Ionicons.glyphMap {
    switch (status) {
        case "active":
            return "navigate-outline";
        case "maintenance":
            return "build-outline";
        case "idle":
            return "pause-circle-outline";
    }
}

function typeIcon(type: VehicleType): keyof typeof Ionicons.glyphMap {
    switch (type) {
        case "Sedans":
            return "car-outline";
        case "Vans":
            return "bus-outline";
        case "Trucks":
            return "car-sport-outline";
    }
}

// --- Sub-components ---

/** Overdue service banner with warning styling */
function OverdueBanner({
    vehicles,
    dismissedIds,
    onDismiss
}: {
    vehicles: Vehicle[];
    dismissedIds: Set<string>;
    onDismiss: (id: string) => void;
}) {
    const { theme } = useUnistyles();
    const visible = vehicles.filter((v) => !dismissedIds.has(v.id));

    if (visible.length === 0) return null;

    return (
        <View style={[styles.bannerContainer, { backgroundColor: `${theme.colors.error}10` }]}>
            <View style={styles.bannerHeader}>
                <View style={[styles.bannerIconCircle, { backgroundColor: `${theme.colors.error}20` }]}>
                    <Ionicons name="warning-outline" size={20} color={theme.colors.error} />
                </View>
                <View style={styles.bannerHeaderText}>
                    <Text style={[styles.bannerTitle, { color: theme.colors.error }]}>Service Overdue</Text>
                    <Text style={[styles.bannerSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                        {visible.length} vehicle{visible.length !== 1 ? "s" : ""} past service date
                    </Text>
                </View>
            </View>
            <View style={styles.bannerItemsList}>
                {visible.map((vehicle) => (
                    <View key={vehicle.id} style={[styles.bannerItem, { borderColor: `${theme.colors.error}30` }]}>
                        <View style={styles.bannerItemInfo}>
                            <View style={[styles.bannerDot, { backgroundColor: theme.colors.error }]} />
                            <View style={styles.bannerItemTextCol}>
                                <Text
                                    style={[styles.bannerItemName, { color: theme.colors.onSurface }]}
                                    numberOfLines={1}
                                >
                                    {vehicle.id} -- {vehicle.make} {vehicle.model}
                                </Text>
                                <Text style={[styles.bannerItemDetail, { color: theme.colors.onSurfaceVariant }]}>
                                    Due: {vehicle.nextServiceDate} -- {vehicle.driver}
                                </Text>
                            </View>
                        </View>
                        <Pressable
                            onPress={() => onDismiss(vehicle.id)}
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

/** Colored fleet metric card */
function MetricCard({
    icon,
    iconColor,
    label,
    value,
    accentBg
}: {
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    label: string;
    value: number;
    accentBg: string;
}) {
    const { theme } = useUnistyles();
    return (
        <View style={[styles.metricCard, { backgroundColor: theme.colors.surfaceContainer }]}>
            <View style={[styles.metricIconCircle, { backgroundColor: accentBg }]}>
                <Ionicons name={icon} size={18} color={iconColor} />
            </View>
            <Text style={[styles.metricValue, { color: theme.colors.onSurface }]}>{value}</Text>
            <Text style={[styles.metricLabel, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
        </View>
    );
}

/** Status filter pill tabs */
function StatusFilterPills({
    activeFilter,
    onSelect,
    counts
}: {
    activeFilter: VehicleStatus | null;
    onSelect: (status: VehicleStatus | null) => void;
    counts: Record<VehicleStatus | "all", number>;
}) {
    const { theme } = useUnistyles();

    const filters: { key: VehicleStatus | null; label: string; count: number }[] = [
        { key: null, label: "All", count: counts.all },
        { key: "active", label: "Active", count: counts.active },
        { key: "maintenance", label: "Maintenance", count: counts.maintenance },
        { key: "idle", label: "Idle", count: counts.idle }
    ];

    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsScroll}>
            {filters.map((f) => {
                const isActive = activeFilter === f.key;
                const pillColor = f.key ? statusColor(f.key) : theme.colors.primary;
                return (
                    <Pressable
                        key={f.label}
                        onPress={() => onSelect(f.key)}
                        style={[
                            styles.pill,
                            { backgroundColor: isActive ? pillColor : theme.colors.surfaceContainerHighest }
                        ]}
                    >
                        <Text
                            style={[styles.pillText, { color: isActive ? "#FFFFFF" : theme.colors.onSurfaceVariant }]}
                        >
                            {f.label}
                        </Text>
                        <View
                            style={[
                                styles.pillBadge,
                                {
                                    backgroundColor: isActive ? "rgba(255,255,255,0.25)" : `${pillColor}20`
                                }
                            ]}
                        >
                            <Text style={[styles.pillBadgeText, { color: isActive ? "#FFFFFF" : pillColor }]}>
                                {f.count}
                            </Text>
                        </View>
                    </Pressable>
                );
            })}
        </ScrollView>
    );
}

/** Vehicle type section header with icon */
function TypeSectionHeader({ type, count }: { type: VehicleType; count: number }) {
    const { theme } = useUnistyles();
    const icon = typeIcon(type);

    return (
        <View style={styles.typeSectionHeader}>
            <View style={[styles.typeIconCircle, { backgroundColor: `${theme.colors.primary}18` }]}>
                <Ionicons name={icon} size={16} color={theme.colors.primary} />
            </View>
            <Text style={[styles.typeSectionName, { color: theme.colors.onSurface }]}>{type}</Text>
            <View style={[styles.typeCountBadge, { backgroundColor: `${theme.colors.primary}18` }]}>
                <Text style={[styles.typeCountText, { color: theme.colors.primary }]}>{count}</Text>
            </View>
        </View>
    );
}

/** Individual vehicle card with status-colored left border and expandable details */
function VehicleCard({
    vehicle,
    isExpanded,
    onToggle
}: {
    vehicle: Vehicle;
    isExpanded: boolean;
    onToggle: () => void;
}) {
    const { theme } = useUnistyles();
    const sColor = statusColor(vehicle.status);
    const sIcon = statusIcon(vehicle.status);
    const driverColor = colorForName(vehicle.driver);
    const driverInitials = initialsFrom(vehicle.driver);

    return (
        <Pressable onPress={onToggle} style={({ pressed }) => [pressed && { opacity: 0.92 }]}>
            <View
                style={[
                    styles.vehicleCard,
                    {
                        backgroundColor: theme.colors.surfaceContainer,
                        borderColor: isExpanded ? theme.colors.primary : theme.colors.outlineVariant
                    }
                ]}
            >
                {/* Status-colored left border */}
                <View style={[styles.vehicleStripe, { backgroundColor: sColor }]} />

                <View style={styles.vehicleCardContent}>
                    {/* Top row: ID + driver avatar + status badge */}
                    <View style={styles.vehicleTopRow}>
                        <View style={styles.vehicleIdCol}>
                            <Text style={[styles.vehicleId, { color: theme.colors.onSurface }]}>{vehicle.id}</Text>
                            <Text style={[styles.vehicleMakeModel, { color: theme.colors.onSurfaceVariant }]}>
                                {vehicle.make} {vehicle.model}
                            </Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: `${sColor}18` }]}>
                            <Ionicons name={sIcon} size={12} color={sColor} />
                            <Text style={[styles.statusBadgeText, { color: sColor }]}>
                                {statusLabel(vehicle.status)}
                            </Text>
                        </View>
                    </View>

                    {/* Middle row: driver + mileage + service date */}
                    <View style={styles.vehicleMiddleRow}>
                        <View style={styles.driverSection}>
                            <View style={[styles.driverAvatar, { backgroundColor: `${driverColor}20` }]}>
                                <Text style={[styles.driverAvatarText, { color: driverColor }]}>{driverInitials}</Text>
                            </View>
                            <Text
                                style={[
                                    styles.driverName,
                                    {
                                        color:
                                            vehicle.driver === "Unassigned"
                                                ? theme.colors.outline
                                                : theme.colors.onSurface
                                    }
                                ]}
                                numberOfLines={1}
                            >
                                {vehicle.driver}
                            </Text>
                        </View>
                        <Text style={[styles.mileageText, { color: theme.colors.onSurfaceVariant }]}>
                            {formatMileage(vehicle.mileage)} mi
                        </Text>
                    </View>

                    {/* Bottom row: service date + chevron */}
                    <View style={styles.vehicleBottomRow}>
                        <View style={styles.serviceDateRow}>
                            <Ionicons
                                name={vehicle.serviceOverdue ? "alert-circle" : "calendar-outline"}
                                size={14}
                                color={vehicle.serviceOverdue ? theme.colors.error : theme.colors.onSurfaceVariant}
                            />
                            <Text
                                style={[
                                    styles.serviceDateText,
                                    {
                                        color: vehicle.serviceOverdue
                                            ? theme.colors.error
                                            : theme.colors.onSurfaceVariant
                                    }
                                ]}
                            >
                                Service: {vehicle.nextServiceDate}
                            </Text>
                            {vehicle.serviceOverdue && (
                                <View style={[styles.overduePill, { backgroundColor: `${theme.colors.error}18` }]}>
                                    <Text style={[styles.overdueText, { color: theme.colors.error }]}>OVERDUE</Text>
                                </View>
                            )}
                        </View>
                        <Ionicons
                            name={isExpanded ? "chevron-up" : "chevron-down"}
                            size={16}
                            color={theme.colors.onSurfaceVariant}
                        />
                    </View>

                    {/* Expanded details */}
                    {isExpanded && (
                        <View style={[styles.expandedSection, { borderTopColor: theme.colors.outlineVariant }]}>
                            <View style={styles.expandedRow}>
                                <Ionicons name="card-outline" size={14} color={theme.colors.onSurfaceVariant} />
                                <Text style={[styles.expandedLabel, { color: theme.colors.onSurfaceVariant }]}>
                                    Plate
                                </Text>
                                <Text style={[styles.expandedValue, { color: theme.colors.onSurface }]}>
                                    {vehicle.licensePlate}
                                </Text>
                            </View>
                            <View style={styles.expandedRow}>
                                <Ionicons name="speedometer-outline" size={14} color={theme.colors.onSurfaceVariant} />
                                <Text style={[styles.expandedLabel, { color: theme.colors.onSurfaceVariant }]}>
                                    Mileage
                                </Text>
                                <Text style={[styles.expandedValueMono, { color: theme.colors.onSurface }]}>
                                    {formatMileage(vehicle.mileage)} mi
                                </Text>
                            </View>
                            <View style={styles.expandedRow}>
                                <Ionicons name="location-outline" size={14} color={theme.colors.onSurfaceVariant} />
                                <Text style={[styles.expandedLabel, { color: theme.colors.onSurfaceVariant }]}>
                                    Location
                                </Text>
                                <Text style={[styles.expandedValue, { color: theme.colors.onSurface }]}>
                                    {vehicle.lastLocation}
                                </Text>
                            </View>
                            {/* Fuel level bar */}
                            <View style={styles.expandedRow}>
                                <Ionicons name="water-outline" size={14} color={theme.colors.onSurfaceVariant} />
                                <Text style={[styles.expandedLabel, { color: theme.colors.onSurfaceVariant }]}>
                                    Fuel
                                </Text>
                                <View style={styles.fuelBarContainer}>
                                    <View
                                        style={[styles.fuelBarTrack, { backgroundColor: theme.colors.outlineVariant }]}
                                    >
                                        <View
                                            style={[
                                                styles.fuelBarFill,
                                                {
                                                    width: `${vehicle.fuelLevel}%`,
                                                    backgroundColor:
                                                        vehicle.fuelLevel < 25
                                                            ? theme.colors.error
                                                            : vehicle.fuelLevel < 50
                                                              ? "#F59E0B"
                                                              : "#10B981"
                                                }
                                            ]}
                                        />
                                    </View>
                                    <Text style={[styles.fuelPct, { color: theme.colors.onSurfaceVariant }]}>
                                        {vehicle.fuelLevel}%
                                    </Text>
                                </View>
                            </View>
                        </View>
                    )}
                </View>
            </View>
        </Pressable>
    );
}

// --- Main Component ---

/**
 * Fleet management showcase page. Displays fleet summary metrics, overdue service
 * banner, status filter pills, and vehicles grouped by type with expandable details.
 */
export function FleetManagementPage() {
    const { theme } = useUnistyles();
    const [expandedVehicleId, setExpandedVehicleId] = React.useState<string | null>(null);
    const [statusFilter, setStatusFilter] = React.useState<VehicleStatus | null>(null);
    const [dismissedOverdue, setDismissedOverdue] = React.useState<Set<string>>(new Set());

    // Computed metrics
    const totalVehicles = mockVehicles.length;
    const activeCount = mockVehicles.filter((v) => v.status === "active").length;
    const maintenanceCount = mockVehicles.filter((v) => v.status === "maintenance").length;
    const idleCount = mockVehicles.filter((v) => v.status === "idle").length;
    const overdueVehicles = mockVehicles.filter((v) => v.serviceOverdue);

    // Filtered vehicles
    const filteredVehicles = statusFilter ? mockVehicles.filter((v) => v.status === statusFilter) : mockVehicles;

    // Group by type
    const vehiclesByType = React.useMemo(() => {
        const map = new Map<VehicleType, Vehicle[]>();
        const types: VehicleType[] = ["Sedans", "Vans", "Trucks"];
        for (const t of types) {
            map.set(t, []);
        }
        for (const v of filteredVehicles) {
            map.get(v.type)!.push(v);
        }
        return map;
    }, [filteredVehicles]);

    const handleToggleVehicle = React.useCallback((vehicleId: string) => {
        setExpandedVehicleId((prev) => (prev === vehicleId ? null : vehicleId));
    }, []);

    const handleDismissOverdue = React.useCallback((vehicleId: string) => {
        setDismissedOverdue((prev) => {
            const next = new Set(prev);
            next.add(vehicleId);
            return next;
        });
    }, []);

    const counts: Record<VehicleStatus | "all", number> = {
        all: totalVehicles,
        active: activeCount,
        maintenance: maintenanceCount,
        idle: idleCount
    };

    return (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Overdue Service Banner */}
            <OverdueBanner
                vehicles={overdueVehicles}
                dismissedIds={dismissedOverdue}
                onDismiss={handleDismissOverdue}
            />

            {/* Fleet Metrics */}
            <View style={styles.metricsGrid}>
                <View style={styles.metricsRow}>
                    <MetricCard
                        icon="car-outline"
                        iconColor={theme.colors.primary}
                        label="Total Vehicles"
                        value={totalVehicles}
                        accentBg={`${theme.colors.primary}18`}
                    />
                    <MetricCard
                        icon="navigate-outline"
                        iconColor="#10B981"
                        label="On Road"
                        value={activeCount}
                        accentBg="#10B98118"
                    />
                </View>
                <View style={styles.metricsRow}>
                    <MetricCard
                        icon="build-outline"
                        iconColor="#F59E0B"
                        label="In Maintenance"
                        value={maintenanceCount}
                        accentBg="#F59E0B18"
                    />
                    <MetricCard
                        icon="pause-circle-outline"
                        iconColor="#9CA3AF"
                        label="Available"
                        value={idleCount}
                        accentBg="#9CA3AF18"
                    />
                </View>
            </View>

            {/* Fleet Overview Summary Bar */}
            <View style={[styles.overviewBar, { backgroundColor: theme.colors.surfaceContainer }]}>
                <Text style={[styles.overviewBarTitle, { color: theme.colors.onSurface }]}>Fleet Utilization</Text>
                <View style={[styles.utilizationTrack, { backgroundColor: theme.colors.outlineVariant }]}>
                    {activeCount > 0 && (
                        <View
                            style={[
                                styles.utilizationSegment,
                                {
                                    backgroundColor: "#10B981",
                                    width: `${(activeCount / totalVehicles) * 100}%`
                                }
                            ]}
                        />
                    )}
                    {maintenanceCount > 0 && (
                        <View
                            style={[
                                styles.utilizationSegment,
                                {
                                    backgroundColor: "#F59E0B",
                                    width: `${(maintenanceCount / totalVehicles) * 100}%`
                                }
                            ]}
                        />
                    )}
                    {idleCount > 0 && (
                        <View
                            style={[
                                styles.utilizationSegment,
                                {
                                    backgroundColor: "#9CA3AF",
                                    width: `${(idleCount / totalVehicles) * 100}%`
                                }
                            ]}
                        />
                    )}
                </View>
                <View style={styles.utilizationLegend}>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: "#10B981" }]} />
                        <Text style={[styles.legendText, { color: theme.colors.onSurfaceVariant }]}>
                            Active {Math.round((activeCount / totalVehicles) * 100)}%
                        </Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: "#F59E0B" }]} />
                        <Text style={[styles.legendText, { color: theme.colors.onSurfaceVariant }]}>
                            Maint. {Math.round((maintenanceCount / totalVehicles) * 100)}%
                        </Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: "#9CA3AF" }]} />
                        <Text style={[styles.legendText, { color: theme.colors.onSurfaceVariant }]}>
                            Idle {Math.round((idleCount / totalVehicles) * 100)}%
                        </Text>
                    </View>
                </View>
            </View>

            {/* Status Filter */}
            <StatusFilterPills activeFilter={statusFilter} onSelect={setStatusFilter} counts={counts} />

            {/* Vehicles grouped by type */}
            <View style={styles.vehicleGroupsContainer}>
                {(["Sedans", "Vans", "Trucks"] as VehicleType[]).map((type) => {
                    const vehicles = vehiclesByType.get(type) ?? [];
                    if (vehicles.length === 0 && statusFilter !== null) return null;
                    return (
                        <View key={type} style={styles.typeGroup}>
                            <TypeSectionHeader type={type} count={vehicles.length} />
                            {vehicles.length === 0 ? (
                                <View style={styles.emptyGroup}>
                                    <Text style={[styles.emptyGroupText, { color: theme.colors.onSurfaceVariant }]}>
                                        No vehicles match filter
                                    </Text>
                                </View>
                            ) : (
                                <View style={styles.vehiclesList}>
                                    {vehicles.map((vehicle) => (
                                        <VehicleCard
                                            key={vehicle.id}
                                            vehicle={vehicle}
                                            isExpanded={expandedVehicleId === vehicle.id}
                                            onToggle={() => handleToggleVehicle(vehicle.id)}
                                        />
                                    ))}
                                </View>
                            )}
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

    // Overdue banner
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
    bannerDot: {
        width: 8,
        height: 8,
        borderRadius: 4
    },
    bannerItemTextCol: {
        flex: 1,
        gap: 1
    },
    bannerItemName: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13
    },
    bannerItemDetail: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11
    },

    // Metrics grid
    metricsGrid: {
        gap: 10,
        marginBottom: 16
    },
    metricsRow: {
        flexDirection: "row",
        gap: 10
    },
    metricCard: {
        flex: 1,
        borderRadius: 14,
        padding: 14,
        gap: 6
    },
    metricIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center"
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

    // Fleet overview bar
    overviewBar: {
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
        gap: 10
    },
    overviewBarTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 14,
        letterSpacing: -0.2
    },
    utilizationTrack: {
        height: 10,
        borderRadius: 5,
        flexDirection: "row",
        overflow: "hidden"
    },
    utilizationSegment: {
        height: 10
    },
    utilizationLegend: {
        flexDirection: "row",
        justifyContent: "space-around"
    },
    legendItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4
    },
    legendText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },

    // Filter pills
    pillsScroll: {
        gap: 8,
        paddingBottom: 16
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

    // Vehicle groups
    vehicleGroupsContainer: {
        gap: 20
    },
    typeGroup: {
        gap: 8
    },

    // Type section header
    typeSectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingBottom: 4
    },
    typeIconCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center"
    },
    typeSectionName: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15
    },
    typeCountBadge: {
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: "center",
        justifyContent: "center"
    },
    typeCountText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 11
    },

    // Vehicle list
    vehiclesList: {
        gap: 8
    },

    // Vehicle card
    vehicleCard: {
        borderRadius: 12,
        borderWidth: 1,
        overflow: "hidden",
        flexDirection: "row"
    },
    vehicleStripe: {
        width: 4
    },
    vehicleCardContent: {
        flex: 1,
        padding: 14,
        gap: 10
    },

    // Vehicle top row
    vehicleTopRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 12
    },
    vehicleIdCol: {
        flex: 1,
        gap: 2
    },
    vehicleId: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 14
    },
    vehicleMakeModel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },

    // Status badge
    statusBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12
    },
    statusBadgeText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 11
    },

    // Vehicle middle row
    vehicleMiddleRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    driverSection: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        flex: 1
    },
    driverAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center"
    },
    driverAvatarText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 11
    },
    driverName: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13,
        flex: 1
    },
    mileageText: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 12
    },

    // Vehicle bottom row
    vehicleBottomRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    serviceDateRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6
    },
    serviceDateText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    overduePill: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6
    },
    overdueText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 9,
        letterSpacing: 0.5
    },

    // Expanded details
    expandedSection: {
        borderTopWidth: 1,
        paddingTop: 10,
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
        width: 65
    },
    expandedValue: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        flex: 1,
        lineHeight: 18
    },
    expandedValueMono: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 12,
        flex: 1,
        lineHeight: 18
    },

    // Fuel bar
    fuelBarContainer: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    fuelBarTrack: {
        flex: 1,
        height: 6,
        borderRadius: 3,
        overflow: "hidden"
    },
    fuelBarFill: {
        height: 6,
        borderRadius: 3
    },
    fuelPct: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11,
        width: 32,
        textAlign: "right"
    },

    // Empty state
    emptyGroup: {
        paddingVertical: 20,
        alignItems: "center"
    },
    emptyGroupText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13
    }
}));
