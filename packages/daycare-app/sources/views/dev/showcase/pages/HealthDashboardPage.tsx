import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { ShowcasePage } from "@/views/dev/showcase/components/ShowcasePage";

// --- Types ---

type Medication = {
    id: string;
    name: string;
    dosage: string;
    time: string;
    taken: boolean;
};

type Appointment = {
    id: string;
    doctor: string;
    specialty: string;
    date: string;
    time: string;
    location: string;
    icon: keyof typeof Ionicons.glyphMap;
};

type LabResult = {
    id: string;
    metric: string;
    value: number;
    unit: string;
    refLow: number;
    refHigh: number;
    status: "normal" | "abnormal";
    date: string;
};

type SeverityLevel = "mild" | "moderate" | "severe";

type SymptomEntry = {
    id: string;
    date: string;
    symptom: string;
    severity: SeverityLevel;
    notes: string;
};

// --- Mock Data ---

const initialMedications: Medication[] = [
    { id: "1", name: "Lisinopril", dosage: "10mg", time: "8:00 AM", taken: true },
    { id: "2", name: "Metformin", dosage: "500mg", time: "8:00 AM", taken: true },
    { id: "3", name: "Vitamin D3", dosage: "2000 IU", time: "12:00 PM", taken: false },
    { id: "4", name: "Atorvastatin", dosage: "20mg", time: "9:00 PM", taken: false },
    { id: "5", name: "Melatonin", dosage: "3mg", time: "10:00 PM", taken: false }
];

const appointments: Appointment[] = [
    {
        id: "1",
        doctor: "Dr. Sarah Chen",
        specialty: "Cardiology",
        date: "Mar 10, 2026",
        time: "10:30 AM",
        location: "Heart Health Center",
        icon: "heart-outline"
    },
    {
        id: "2",
        doctor: "Dr. James Park",
        specialty: "Endocrinology",
        date: "Mar 18, 2026",
        time: "2:00 PM",
        location: "Metro Diabetes Clinic",
        icon: "flask-outline"
    },
    {
        id: "3",
        doctor: "Dr. Lisa Wang",
        specialty: "Ophthalmology",
        date: "Apr 2, 2026",
        time: "9:15 AM",
        location: "Clear Vision Eye Care",
        icon: "eye-outline"
    }
];

const labResults: LabResult[] = [
    { id: "1", metric: "HbA1c", value: 6.8, unit: "%", refLow: 4.0, refHigh: 5.6, status: "abnormal", date: "Feb 20" },
    {
        id: "2",
        metric: "LDL Cholesterol",
        value: 98,
        unit: "mg/dL",
        refLow: 0,
        refHigh: 100,
        status: "normal",
        date: "Feb 20"
    },
    { id: "3", metric: "TSH", value: 2.4, unit: "mIU/L", refLow: 0.4, refHigh: 4.0, status: "normal", date: "Feb 20" },
    {
        id: "4",
        metric: "Blood Pressure",
        value: 138,
        unit: "mmHg",
        refLow: 90,
        refHigh: 120,
        status: "abnormal",
        date: "Feb 28"
    },
    {
        id: "5",
        metric: "Fasting Glucose",
        value: 105,
        unit: "mg/dL",
        refLow: 70,
        refHigh: 100,
        status: "abnormal",
        date: "Feb 20"
    },
    {
        id: "6",
        metric: "Creatinine",
        value: 0.9,
        unit: "mg/dL",
        refLow: 0.7,
        refHigh: 1.3,
        status: "normal",
        date: "Feb 20"
    }
];

const symptomLog: SymptomEntry[] = [
    { id: "1", date: "Mar 3", symptom: "Headache", severity: "mild", notes: "Woke up with slight tension behind eyes" },
    {
        id: "2",
        date: "Mar 2",
        symptom: "Dizziness",
        severity: "moderate",
        notes: "After standing up quickly. Lasted ~2 min"
    },
    { id: "3", date: "Mar 1", symptom: "Joint Pain", severity: "severe", notes: "Left knee, sharp pain during stairs" },
    {
        id: "4",
        date: "Feb 28",
        symptom: "Fatigue",
        severity: "moderate",
        notes: "Low energy all afternoon despite good sleep"
    },
    {
        id: "5",
        date: "Feb 27",
        symptom: "Nausea",
        severity: "mild",
        notes: "Brief episode after medication, resolved quickly"
    }
];

const SEVERITY_COLORS: Record<SeverityLevel, string> = {
    mild: "#22C55E",
    moderate: "#F59E0B",
    severe: "#EF4444"
};

const SPECIALTY_COLORS: Record<string, string> = {
    Cardiology: "#EF4444",
    Endocrinology: "#8B5CF6",
    Ophthalmology: "#3B82F6"
};

// --- Today's Summary Data ---

const todaySummary = {
    steps: 7482,
    stepsGoal: 10000,
    sleepHours: 7.2,
    waterGlasses: 5,
    waterGoal: 8,
    calories: 1850,
    caloriesGoal: 2200
};

// --- Progress Ring ---

function ProgressRing({
    progress,
    size,
    strokeWidth,
    color,
    trackColor,
    children
}: {
    progress: number;
    size: number;
    strokeWidth: number;
    color: string;
    trackColor: string;
    children?: React.ReactNode;
}) {
    // Build a circular progress ring using small dot segments arranged in a circle.
    const segmentCount = 60;
    const radius = (size - strokeWidth) / 2;
    const center = size / 2;
    const filledSegments = Math.round(Math.min(progress, 1) * segmentCount);
    const segmentSize = strokeWidth * 0.8;

    const segments = [];
    for (let i = 0; i < segmentCount; i++) {
        const angle = (i / segmentCount) * 2 * Math.PI - Math.PI / 2;
        const x = center + radius * Math.cos(angle) - segmentSize / 2;
        const y = center + radius * Math.sin(angle) - segmentSize / 2;
        const isFilled = i < filledSegments;

        segments.push(
            <View
                key={i}
                style={{
                    position: "absolute",
                    left: x,
                    top: y,
                    width: segmentSize,
                    height: segmentSize,
                    borderRadius: segmentSize / 2,
                    backgroundColor: isFilled ? color : trackColor
                }}
            />
        );
    }

    return (
        <View style={{ width: size, height: size }}>
            {segments}
            <View
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    justifyContent: "center",
                    alignItems: "center"
                }}
            >
                {children}
            </View>
        </View>
    );
}

// --- Reference Range Bar ---

function RangeBar({
    value,
    refLow,
    refHigh,
    color,
    trackColor
}: {
    value: number;
    refLow: number;
    refHigh: number;
    color: string;
    trackColor: string;
}) {
    // Show the value position within an extended range (0.5x low to 1.5x high)
    const rangeMin = refLow * 0.5;
    const rangeMax = refHigh * 1.5;
    const normalStartPct = ((refLow - rangeMin) / (rangeMax - rangeMin)) * 100;
    const normalWidthPct = ((refHigh - refLow) / (rangeMax - rangeMin)) * 100;
    const valuePct = Math.min(Math.max(((value - rangeMin) / (rangeMax - rangeMin)) * 100, 2), 98);

    return (
        <View style={{ height: 12, gap: 0 }}>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: trackColor, overflow: "hidden" }}>
                {/* Normal range band */}
                <View
                    style={{
                        position: "absolute",
                        left: `${normalStartPct}%`,
                        width: `${normalWidthPct}%`,
                        height: "100%",
                        backgroundColor: `${color}30`,
                        borderRadius: 4
                    }}
                />
                {/* Value indicator */}
                <View
                    style={{
                        position: "absolute",
                        left: `${valuePct}%`,
                        top: -1,
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: color,
                        marginLeft: -5
                    }}
                />
            </View>
        </View>
    );
}

// --- Main Component ---

export function HealthDashboardPage() {
    const { theme } = useUnistyles();
    const [medications, setMedications] = React.useState(initialMedications);

    const toggleMedication = React.useCallback((id: string) => {
        setMedications((prev) => prev.map((m) => (m.id === id ? { ...m, taken: !m.taken } : m)));
    }, []);

    const takenCount = medications.filter((m) => m.taken).length;
    const stepsProgress = todaySummary.steps / todaySummary.stepsGoal;

    return (
        <ScrollView
            contentContainerStyle={{
                maxWidth: theme.layout.maxWidth,
                width: "100%",
                alignSelf: "center",
                paddingHorizontal: 16,
                paddingBottom: 48
            }}
        >
            {/* --- Hero Section: Steps Ring --- */}
            <View style={styles.heroSection}>
                <ProgressRing
                    progress={stepsProgress}
                    size={160}
                    strokeWidth={12}
                    color={theme.colors.primary}
                    trackColor={theme.colors.outlineVariant}
                >
                    <Ionicons name="footsteps-outline" size={28} color={theme.colors.primary} />
                    <Text style={[styles.heroStepsValue, { color: theme.colors.onSurface }]}>
                        {todaySummary.steps.toLocaleString()}
                    </Text>
                    <Text style={[styles.heroStepsLabel, { color: theme.colors.onSurfaceVariant }]}>
                        / {todaySummary.stepsGoal.toLocaleString()}
                    </Text>
                </ProgressRing>
                <Text style={[styles.heroTitle, { color: theme.colors.onSurface }]}>Today's Health</Text>
                <Text style={[styles.heroSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                    Tuesday, March 3, 2026
                </Text>
            </View>

            {/* --- Quick Metric Cards --- */}
            <View style={styles.metricsGrid}>
                {/* Sleep */}
                <View style={[styles.metricCard, { backgroundColor: theme.colors.surfaceContainer }]}>
                    <View style={[styles.metricIconCircle, { backgroundColor: `${theme.colors.secondary}18` }]}>
                        <Ionicons name="moon-outline" size={22} color={theme.colors.secondary} />
                    </View>
                    <Text style={[styles.metricValue, { color: theme.colors.onSurface }]}>
                        {todaySummary.sleepHours}
                    </Text>
                    <Text style={[styles.metricUnit, { color: theme.colors.onSurfaceVariant }]}>hours sleep</Text>
                </View>

                {/* Water */}
                <View style={[styles.metricCard, { backgroundColor: theme.colors.surfaceContainer }]}>
                    <View style={[styles.metricIconCircle, { backgroundColor: "#3B82F618" }]}>
                        <Ionicons name="water-outline" size={22} color="#3B82F6" />
                    </View>
                    <Text style={[styles.metricValue, { color: theme.colors.onSurface }]}>
                        {todaySummary.waterGlasses}
                    </Text>
                    <Text style={[styles.metricUnit, { color: theme.colors.onSurfaceVariant }]}>
                        / {todaySummary.waterGoal} glasses
                    </Text>
                    {/* Mini progress bar */}
                    <View style={styles.miniProgressTrack}>
                        <View
                            style={[
                                styles.miniProgressFill,
                                {
                                    width: `${(todaySummary.waterGlasses / todaySummary.waterGoal) * 100}%`,
                                    backgroundColor: "#3B82F6"
                                }
                            ]}
                        />
                    </View>
                </View>

                {/* Calories */}
                <View style={[styles.metricCard, { backgroundColor: theme.colors.surfaceContainer }]}>
                    <View style={[styles.metricIconCircle, { backgroundColor: `${theme.colors.tertiary}18` }]}>
                        <Ionicons name="flame-outline" size={22} color={theme.colors.tertiary} />
                    </View>
                    <Text style={[styles.metricValue, { color: theme.colors.onSurface }]}>
                        {todaySummary.calories.toLocaleString()}
                    </Text>
                    <Text style={[styles.metricUnit, { color: theme.colors.onSurfaceVariant }]}>
                        / {todaySummary.caloriesGoal} cal
                    </Text>
                    {/* Mini progress bar */}
                    <View style={styles.miniProgressTrack}>
                        <View
                            style={[
                                styles.miniProgressFill,
                                {
                                    width: `${Math.min((todaySummary.calories / todaySummary.caloriesGoal) * 100, 100)}%`,
                                    backgroundColor: theme.colors.tertiary
                                }
                            ]}
                        />
                    </View>
                </View>

                {/* Medications summary */}
                <View style={[styles.metricCard, { backgroundColor: theme.colors.surfaceContainer }]}>
                    <View style={[styles.metricIconCircle, { backgroundColor: `${theme.colors.primary}18` }]}>
                        <Ionicons name="medkit-outline" size={22} color={theme.colors.primary} />
                    </View>
                    <Text style={[styles.metricValue, { color: theme.colors.onSurface }]}>
                        {takenCount}/{medications.length}
                    </Text>
                    <Text style={[styles.metricUnit, { color: theme.colors.onSurfaceVariant }]}>meds taken</Text>
                    {/* Mini progress bar */}
                    <View style={styles.miniProgressTrack}>
                        <View
                            style={[
                                styles.miniProgressFill,
                                {
                                    width: `${(takenCount / medications.length) * 100}%`,
                                    backgroundColor: theme.colors.primary
                                }
                            ]}
                        />
                    </View>
                </View>
            </View>

            {/* --- Medications Section --- */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="medical-outline" size={20} color={theme.colors.primary} />
                    <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Medications</Text>
                    <View style={[styles.countBadge, { backgroundColor: `${theme.colors.primary}18` }]}>
                        <Text style={[styles.countBadgeText, { color: theme.colors.primary }]}>
                            {takenCount}/{medications.length}
                        </Text>
                    </View>
                </View>

                <View style={styles.sectionContent}>
                    {medications.map((med) => (
                        <Pressable
                            key={med.id}
                            onPress={() => toggleMedication(med.id)}
                            style={({ pressed }) => [
                                styles.medicationCard,
                                {
                                    backgroundColor: med.taken
                                        ? `${theme.colors.primary}0A`
                                        : theme.colors.surfaceContainer,
                                    borderColor: med.taken ? theme.colors.primary : theme.colors.outlineVariant,
                                    opacity: pressed ? 0.85 : 1
                                }
                            ]}
                        >
                            <View
                                style={[
                                    styles.checkbox,
                                    {
                                        borderColor: med.taken ? theme.colors.primary : theme.colors.outline,
                                        backgroundColor: med.taken ? theme.colors.primary : "transparent"
                                    }
                                ]}
                            >
                                {med.taken && <Ionicons name="checkmark" size={14} color={theme.colors.onPrimary} />}
                            </View>
                            <View style={styles.medicationInfo}>
                                <Text
                                    style={[
                                        styles.medicationName,
                                        {
                                            color: med.taken ? theme.colors.primary : theme.colors.onSurface,
                                            textDecorationLine: med.taken ? "line-through" : "none"
                                        }
                                    ]}
                                >
                                    {med.name}
                                </Text>
                                <Text style={[styles.medicationDetail, { color: theme.colors.onSurfaceVariant }]}>
                                    {med.dosage}
                                </Text>
                            </View>
                            <View style={[styles.timePill, { backgroundColor: theme.colors.surfaceContainerHighest }]}>
                                <Ionicons name="time-outline" size={12} color={theme.colors.onSurfaceVariant} />
                                <Text style={[styles.timeText, { color: theme.colors.onSurfaceVariant }]}>
                                    {med.time}
                                </Text>
                            </View>
                        </Pressable>
                    ))}
                </View>
            </View>

            {/* --- Appointments Section --- */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="calendar-outline" size={20} color={theme.colors.tertiary} />
                    <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Upcoming Appointments</Text>
                </View>

                <View style={styles.sectionContent}>
                    {appointments.map((appt) => {
                        const specialtyColor = SPECIALTY_COLORS[appt.specialty] ?? theme.colors.secondary;

                        return (
                            <View
                                key={appt.id}
                                style={[
                                    styles.appointmentCard,
                                    {
                                        backgroundColor: theme.colors.surfaceContainer,
                                        borderColor: theme.colors.outlineVariant
                                    }
                                ]}
                            >
                                <View
                                    style={[styles.appointmentIconCircle, { backgroundColor: `${specialtyColor}18` }]}
                                >
                                    <Ionicons name={appt.icon} size={22} color={specialtyColor} />
                                </View>
                                <View style={styles.appointmentInfo}>
                                    <Text style={[styles.appointmentDoctor, { color: theme.colors.onSurface }]}>
                                        {appt.doctor}
                                    </Text>
                                    <View style={styles.appointmentSpecialtyRow}>
                                        <View
                                            style={[styles.specialtyBadge, { backgroundColor: `${specialtyColor}18` }]}
                                        >
                                            <Text style={[styles.specialtyBadgeText, { color: specialtyColor }]}>
                                                {appt.specialty}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.appointmentDetailsRow}>
                                        <View style={styles.appointmentDetailItem}>
                                            <Ionicons
                                                name="calendar-outline"
                                                size={12}
                                                color={theme.colors.onSurfaceVariant}
                                            />
                                            <Text
                                                style={[
                                                    styles.appointmentDetailText,
                                                    { color: theme.colors.onSurfaceVariant }
                                                ]}
                                            >
                                                {appt.date} at {appt.time}
                                            </Text>
                                        </View>
                                        <View style={styles.appointmentDetailItem}>
                                            <Ionicons
                                                name="location-outline"
                                                size={12}
                                                color={theme.colors.onSurfaceVariant}
                                            />
                                            <Text
                                                style={[
                                                    styles.appointmentDetailText,
                                                    { color: theme.colors.onSurfaceVariant }
                                                ]}
                                                numberOfLines={1}
                                            >
                                                {appt.location}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        );
                    })}
                </View>
            </View>

            {/* --- Lab Results Section --- */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="analytics-outline" size={20} color={theme.colors.secondary} />
                    <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Lab Results</Text>
                </View>

                <View style={styles.sectionContent}>
                    {labResults.map((lab) => {
                        const isAbnormal = lab.status === "abnormal";
                        const statusColor = isAbnormal ? "#EF4444" : "#22C55E";
                        const statusLabel = isAbnormal ? "Abnormal" : "Normal";

                        return (
                            <View
                                key={lab.id}
                                style={[
                                    styles.labCard,
                                    {
                                        backgroundColor: theme.colors.surfaceContainer,
                                        borderColor: theme.colors.outlineVariant
                                    }
                                ]}
                            >
                                <View style={styles.labTopRow}>
                                    <View style={styles.labMetricInfo}>
                                        <Text style={[styles.labMetricName, { color: theme.colors.onSurface }]}>
                                            {lab.metric}
                                        </Text>
                                        <Text style={[styles.labDate, { color: theme.colors.onSurfaceVariant }]}>
                                            {lab.date}
                                        </Text>
                                    </View>
                                    <View style={styles.labValueColumn}>
                                        <Text style={[styles.labValue, { color: theme.colors.onSurface }]}>
                                            {lab.value}{" "}
                                            <Text style={[styles.labUnit, { color: theme.colors.onSurfaceVariant }]}>
                                                {lab.unit}
                                            </Text>
                                        </Text>
                                        <View style={[styles.statusBadge, { backgroundColor: `${statusColor}18` }]}>
                                            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                                            <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                                                {statusLabel}
                                            </Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Reference range bar */}
                                <View style={styles.labRangeSection}>
                                    <RangeBar
                                        value={lab.value}
                                        refLow={lab.refLow}
                                        refHigh={lab.refHigh}
                                        color={statusColor}
                                        trackColor={theme.colors.surfaceContainerHighest}
                                    />
                                    <View style={styles.labRangeLabels}>
                                        <Text style={[styles.labRangeText, { color: theme.colors.onSurfaceVariant }]}>
                                            Ref: {lab.refLow} - {lab.refHigh} {lab.unit}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        );
                    })}
                </View>
            </View>

            {/* --- Symptoms Log Section --- */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="clipboard-outline" size={20} color={theme.colors.error} />
                    <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Symptoms Log</Text>
                </View>

                <View style={styles.sectionContent}>
                    {symptomLog.map((entry) => {
                        const sevColor = SEVERITY_COLORS[entry.severity];

                        return (
                            <View
                                key={entry.id}
                                style={[
                                    styles.symptomCard,
                                    {
                                        backgroundColor: theme.colors.surfaceContainer,
                                        borderColor: theme.colors.outlineVariant
                                    }
                                ]}
                            >
                                <View style={styles.symptomTopRow}>
                                    <View style={[styles.symptomDot, { backgroundColor: sevColor }]} />
                                    <Text style={[styles.symptomName, { color: theme.colors.onSurface }]}>
                                        {entry.symptom}
                                    </Text>
                                    <View style={[styles.severityChip, { backgroundColor: `${sevColor}18` }]}>
                                        <Text style={[styles.severityChipText, { color: sevColor }]}>
                                            {entry.severity.charAt(0).toUpperCase() + entry.severity.slice(1)}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={[styles.symptomNotes, { color: theme.colors.onSurfaceVariant }]}>
                                    {entry.notes}
                                </Text>
                                <View style={styles.symptomDateRow}>
                                    <Ionicons name="calendar-outline" size={12} color={theme.colors.onSurfaceVariant} />
                                    <Text style={[styles.symptomDate, { color: theme.colors.onSurfaceVariant }]}>
                                        {entry.date}
                                    </Text>
                                </View>
                            </View>
                        );
                    })}
                </View>
            </View>
        </ScrollView>
    );
}

// --- Styles ---

const styles = StyleSheet.create((theme) => ({
    // Hero
    heroSection: {
        alignItems: "center",
        paddingTop: 32,
        paddingBottom: 24,
        gap: 8
    },
    heroStepsValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 26,
        marginTop: 2
    },
    heroStepsLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    heroTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 22,
        marginTop: 12
    },
    heroSubtitle: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14
    },

    // Metrics grid
    metricsGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
        marginBottom: 8
    },
    metricCard: {
        flexBasis: "47%",
        flexGrow: 1,
        borderRadius: 16,
        padding: 16,
        alignItems: "center",
        gap: 4
    },
    metricIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 4
    },
    metricValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 24
    },
    metricUnit: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    miniProgressTrack: {
        width: "80%",
        height: 4,
        borderRadius: 2,
        backgroundColor: "rgba(128,128,128,0.15)",
        overflow: "hidden",
        marginTop: 4
    },
    miniProgressFill: {
        height: "100%",
        borderRadius: 2
    },

    // Sections
    section: {
        marginTop: 28,
        gap: 14
    },
    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    sectionTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 18,
        flex: 1
    },
    sectionContent: {
        gap: 10
    },

    // Count badge
    countBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10
    },
    countBadgeText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 12
    },

    // Medication card
    medicationCard: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 14,
        borderWidth: 1,
        padding: 14,
        gap: 12
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 7,
        borderWidth: 2,
        alignItems: "center",
        justifyContent: "center"
    },
    medicationInfo: {
        flex: 1,
        gap: 2
    },
    medicationName: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 15
    },
    medicationDetail: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13
    },
    timePill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8
    },
    timeText: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11
    },

    // Appointment card
    appointmentCard: {
        flexDirection: "row",
        borderRadius: 14,
        borderWidth: 1,
        padding: 14,
        gap: 14,
        alignItems: "flex-start"
    },
    appointmentIconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center"
    },
    appointmentInfo: {
        flex: 1,
        gap: 6
    },
    appointmentDoctor: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15
    },
    appointmentSpecialtyRow: {
        flexDirection: "row"
    },
    specialtyBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8
    },
    specialtyBadgeText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11,
        letterSpacing: 0.3
    },
    appointmentDetailsRow: {
        gap: 4
    },
    appointmentDetailItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5
    },
    appointmentDetailText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },

    // Lab result card
    labCard: {
        borderRadius: 14,
        borderWidth: 1,
        padding: 14,
        gap: 10
    },
    labTopRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start"
    },
    labMetricInfo: {
        flex: 1,
        gap: 2
    },
    labMetricName: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15
    },
    labDate: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    labValueColumn: {
        alignItems: "flex-end",
        gap: 4
    },
    labValue: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 16
    },
    labUnit: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    statusBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3
    },
    statusBadgeText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11
    },
    labRangeSection: {
        gap: 4
    },
    labRangeLabels: {
        flexDirection: "row",
        justifyContent: "flex-end"
    },
    labRangeText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11
    },

    // Symptom card
    symptomCard: {
        borderRadius: 14,
        borderWidth: 1,
        padding: 14,
        gap: 8
    },
    symptomTopRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    symptomDot: {
        width: 8,
        height: 8,
        borderRadius: 4
    },
    symptomName: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15,
        flex: 1
    },
    severityChip: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10
    },
    severityChipText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11,
        letterSpacing: 0.3
    },
    symptomNotes: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 18,
        paddingLeft: 16
    },
    symptomDateRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingLeft: 16
    },
    symptomDate: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    }
}));
