import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { ShowcasePage } from "@/views/dev/showcase/components/ShowcasePage";

// --- Types ---

type Pet = {
    id: string;
    name: string;
    breed: string;
    species: "dog" | "cat";
    age: string;
    weight: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
};

type Appointment = {
    id: string;
    petId: string;
    type: "vet" | "grooming" | "medication";
    title: string;
    date: string;
    time: string;
    reminderEnabled: boolean;
};

type HealthRecord = {
    id: string;
    petId: string;
    type: "vaccination" | "visit";
    date: string;
    description: string;
    vetName: string;
};

type DailyCareItem = {
    id: string;
    petId: string;
    category: "feeding" | "walk" | "medication";
    title: string;
    time: string;
    completed: boolean;
};

// --- Config ---

const APPOINTMENT_ICONS: Record<Appointment["type"], keyof typeof Ionicons.glyphMap> = {
    vet: "medkit-outline",
    grooming: "cut-outline",
    medication: "medical-outline"
};

const APPOINTMENT_COLORS: Record<Appointment["type"], string> = {
    vet: "#3B82F6",
    grooming: "#EC4899",
    medication: "#F59E0B"
};

const CARE_ICONS: Record<DailyCareItem["category"], keyof typeof Ionicons.glyphMap> = {
    feeding: "restaurant-outline",
    walk: "walk-outline",
    medication: "medical-outline"
};

const CARE_COLORS: Record<DailyCareItem["category"], string> = {
    feeding: "#16a34a",
    walk: "#3B82F6",
    medication: "#F59E0B"
};

// --- Mock Data ---

const PETS: Pet[] = [
    {
        id: "p1",
        name: "Bella",
        breed: "Golden Retriever",
        species: "dog",
        age: "3 years",
        weight: "65 lbs",
        icon: "paw",
        color: "#F59E0B"
    },
    {
        id: "p2",
        name: "Milo",
        breed: "Maine Coon",
        species: "cat",
        age: "5 years",
        weight: "18 lbs",
        icon: "paw",
        color: "#8B5CF6"
    },
    {
        id: "p3",
        name: "Charlie",
        breed: "French Bulldog",
        species: "dog",
        age: "2 years",
        weight: "28 lbs",
        icon: "paw",
        color: "#3B82F6"
    }
];

const initialAppointments: Appointment[] = [
    {
        id: "a1",
        petId: "p1",
        type: "vet",
        title: "Annual checkup",
        date: "Mar 10",
        time: "10:00 AM",
        reminderEnabled: true
    },
    {
        id: "a2",
        petId: "p1",
        type: "grooming",
        title: "Bath & nail trim",
        date: "Mar 15",
        time: "2:00 PM",
        reminderEnabled: false
    },
    {
        id: "a3",
        petId: "p1",
        type: "medication",
        title: "Heartworm prevention",
        date: "Mar 20",
        time: "8:00 AM",
        reminderEnabled: true
    },
    {
        id: "a4",
        petId: "p2",
        type: "vet",
        title: "Dental cleaning",
        date: "Mar 8",
        time: "9:00 AM",
        reminderEnabled: true
    },
    {
        id: "a5",
        petId: "p2",
        type: "medication",
        title: "Flea treatment",
        date: "Mar 12",
        time: "7:00 AM",
        reminderEnabled: true
    },
    {
        id: "a6",
        petId: "p3",
        type: "vet",
        title: "Vaccination booster",
        date: "Mar 18",
        time: "11:00 AM",
        reminderEnabled: false
    },
    {
        id: "a7",
        petId: "p3",
        type: "grooming",
        title: "Wrinkle cleaning",
        date: "Mar 22",
        time: "3:00 PM",
        reminderEnabled: true
    }
];

const HEALTH_RECORDS: HealthRecord[] = [
    {
        id: "h1",
        petId: "p1",
        type: "vaccination",
        date: "Feb 15, 2026",
        description: "Rabies vaccine (3-year)",
        vetName: "Dr. Sarah Chen"
    },
    {
        id: "h2",
        petId: "p1",
        type: "visit",
        date: "Jan 20, 2026",
        description: "Routine wellness exam - all clear",
        vetName: "Dr. Sarah Chen"
    },
    {
        id: "h3",
        petId: "p1",
        type: "vaccination",
        date: "Dec 5, 2025",
        description: "DHPP booster",
        vetName: "Dr. James Park"
    },
    {
        id: "h4",
        petId: "p1",
        type: "visit",
        date: "Oct 10, 2025",
        description: "Ear infection treatment",
        vetName: "Dr. Sarah Chen"
    },
    {
        id: "h5",
        petId: "p2",
        type: "vaccination",
        date: "Feb 1, 2026",
        description: "FVRCP vaccine",
        vetName: "Dr. Lisa Wong"
    },
    {
        id: "h6",
        petId: "p2",
        type: "visit",
        date: "Jan 5, 2026",
        description: "Weight management consultation",
        vetName: "Dr. Lisa Wong"
    },
    {
        id: "h7",
        petId: "p2",
        type: "visit",
        date: "Nov 15, 2025",
        description: "Dental assessment - mild tartar",
        vetName: "Dr. Lisa Wong"
    },
    {
        id: "h8",
        petId: "p3",
        type: "vaccination",
        date: "Feb 20, 2026",
        description: "Bordetella vaccine",
        vetName: "Dr. James Park"
    },
    {
        id: "h9",
        petId: "p3",
        type: "visit",
        date: "Jan 28, 2026",
        description: "Skin fold dermatitis check",
        vetName: "Dr. James Park"
    }
];

const initialDailyCare: DailyCareItem[] = [
    { id: "d1", petId: "p1", category: "feeding", title: "Breakfast", time: "7:00 AM", completed: true },
    { id: "d2", petId: "p1", category: "walk", title: "Morning walk", time: "7:30 AM", completed: true },
    { id: "d3", petId: "p1", category: "medication", title: "Joint supplement", time: "8:00 AM", completed: true },
    { id: "d4", petId: "p1", category: "feeding", title: "Lunch snack", time: "12:00 PM", completed: false },
    { id: "d5", petId: "p1", category: "walk", title: "Afternoon walk", time: "3:00 PM", completed: false },
    { id: "d6", petId: "p1", category: "feeding", title: "Dinner", time: "6:00 PM", completed: false },
    { id: "d7", petId: "p1", category: "walk", title: "Evening walk", time: "8:00 PM", completed: false },
    { id: "d8", petId: "p2", category: "feeding", title: "Morning meal", time: "7:00 AM", completed: true },
    { id: "d9", petId: "p2", category: "medication", title: "Hairball remedy", time: "7:30 AM", completed: false },
    { id: "d10", petId: "p2", category: "feeding", title: "Evening meal", time: "6:00 PM", completed: false },
    { id: "d11", petId: "p3", category: "feeding", title: "Breakfast", time: "7:30 AM", completed: true },
    { id: "d12", petId: "p3", category: "walk", title: "Short morning walk", time: "8:00 AM", completed: true },
    { id: "d13", petId: "p3", category: "feeding", title: "Dinner", time: "5:30 PM", completed: false },
    { id: "d14", petId: "p3", category: "walk", title: "Evening stroll", time: "7:00 PM", completed: false }
];

// --- Pet Selector Tabs ---

function PetSelectorTabs({
    pets,
    selectedId,
    onSelect
}: {
    pets: Pet[];
    selectedId: string;
    onSelect: (id: string) => void;
}) {
    const { theme } = useUnistyles();

    return (
        <View style={styles.segmentedControl}>
            {pets.map((pet) => {
                const isActive = pet.id === selectedId;

                return (
                    <Pressable
                        key={pet.id}
                        onPress={() => onSelect(pet.id)}
                        style={[
                            styles.segmentTab,
                            {
                                backgroundColor: isActive ? pet.color : "transparent",
                                borderColor: isActive ? pet.color : theme.colors.outlineVariant
                            }
                        ]}
                    >
                        <Ionicons name="paw" size={14} color={isActive ? "#ffffff" : theme.colors.onSurfaceVariant} />
                        <Text
                            style={[
                                styles.segmentLabel,
                                { color: isActive ? "#ffffff" : theme.colors.onSurfaceVariant }
                            ]}
                            numberOfLines={1}
                        >
                            {pet.name}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

// --- Pet Hero Card ---

function PetHeroCard({ pet }: { pet: Pet }) {
    const { theme } = useUnistyles();
    const initials = pet.name.slice(0, 2).toUpperCase();

    return (
        <View style={[styles.heroCard, { backgroundColor: theme.colors.surfaceContainer }]}>
            {/* Large avatar with initials */}
            <View style={[styles.heroAvatar, { backgroundColor: `${pet.color}20` }]}>
                <Text style={[styles.heroInitials, { color: pet.color }]}>{initials}</Text>
                <View style={[styles.heroAvatarBadge, { backgroundColor: pet.color }]}>
                    <Ionicons name="paw" size={12} color="#ffffff" />
                </View>
            </View>

            {/* Pet info */}
            <View style={styles.heroInfoCol}>
                <Text style={[styles.heroName, { color: theme.colors.onSurface }]}>{pet.name}</Text>
                <Text style={[styles.heroBreed, { color: theme.colors.onSurfaceVariant }]}>{pet.breed}</Text>

                <View style={styles.heroDetailsRow}>
                    <View style={[styles.heroDetailChip, { backgroundColor: `${pet.color}14` }]}>
                        <Ionicons name="calendar-outline" size={12} color={pet.color} />
                        <Text style={[styles.heroDetailText, { color: pet.color }]}>{pet.age}</Text>
                    </View>
                    <View style={[styles.heroDetailChip, { backgroundColor: `${pet.color}14` }]}>
                        <Ionicons name="scale-outline" size={12} color={pet.color} />
                        <Text style={[styles.heroDetailText, { color: pet.color }]}>{pet.weight}</Text>
                    </View>
                    <View style={[styles.heroDetailChip, { backgroundColor: `${pet.color}14` }]}>
                        <Ionicons
                            name={pet.species === "dog" ? "paw-outline" : "paw-outline"}
                            size={12}
                            color={pet.color}
                        />
                        <Text style={[styles.heroDetailText, { color: pet.color }]}>
                            {pet.species === "dog" ? "Dog" : "Cat"}
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );
}

// --- Upcoming Appointment Row ---

function AppointmentRow({
    appointment,
    onToggleReminder
}: {
    appointment: Appointment;
    onToggleReminder: (id: string) => void;
}) {
    const { theme } = useUnistyles();
    const typeColor = APPOINTMENT_COLORS[appointment.type];
    const typeIcon = APPOINTMENT_ICONS[appointment.type];

    return (
        <View style={[styles.appointmentRow, { backgroundColor: theme.colors.surfaceContainer }]}>
            {/* Calendar-style date badge */}
            <View style={[styles.dateBadge, { backgroundColor: `${typeColor}14` }]}>
                <Text style={[styles.dateBadgeMonth, { color: typeColor }]}>{appointment.date.split(" ")[0]}</Text>
                <Text style={[styles.dateBadgeDay, { color: typeColor }]}>{appointment.date.split(" ")[1]}</Text>
            </View>

            {/* Info column */}
            <View style={styles.appointmentInfoCol}>
                <View style={styles.appointmentTitleRow}>
                    <Ionicons name={typeIcon} size={14} color={typeColor} />
                    <Text style={[styles.appointmentTitle, { color: theme.colors.onSurface }]} numberOfLines={1}>
                        {appointment.title}
                    </Text>
                </View>
                <Text style={[styles.appointmentTime, { color: theme.colors.onSurfaceVariant }]}>
                    {appointment.time}
                </Text>
            </View>

            {/* Reminder toggle */}
            <View style={styles.reminderCol}>
                <Ionicons
                    name={appointment.reminderEnabled ? "notifications" : "notifications-outline"}
                    size={14}
                    color={appointment.reminderEnabled ? typeColor : theme.colors.onSurfaceVariant}
                />
                <Switch
                    value={appointment.reminderEnabled}
                    onValueChange={() => onToggleReminder(appointment.id)}
                    trackColor={{ false: theme.colors.outlineVariant, true: `${typeColor}60` }}
                    thumbColor={appointment.reminderEnabled ? typeColor : theme.colors.surfaceContainerHighest}
                    style={styles.reminderSwitch}
                />
            </View>
        </View>
    );
}

// --- Health Timeline Entry ---

function HealthTimelineEntry({ record, isLast }: { record: HealthRecord; isLast: boolean }) {
    const { theme } = useUnistyles();
    const isVaccination = record.type === "vaccination";
    const dotColor = isVaccination ? "#16a34a" : "#3B82F6";

    return (
        <View style={styles.timelineEntry}>
            {/* Timeline dot and line */}
            <View style={styles.timelineDotCol}>
                <View style={[styles.timelineDot, { backgroundColor: dotColor }]}>
                    <Ionicons name={isVaccination ? "shield-checkmark" : "medkit"} size={10} color="#ffffff" />
                </View>
                {!isLast && <View style={[styles.timelineLine, { backgroundColor: theme.colors.outlineVariant }]} />}
            </View>

            {/* Content */}
            <View
                style={[
                    styles.timelineContent,
                    { borderBottomColor: isLast ? "transparent" : theme.colors.outlineVariant }
                ]}
            >
                <View style={styles.timelineHeader}>
                    <Text style={[styles.timelineDate, { color: theme.colors.onSurfaceVariant }]}>{record.date}</Text>
                    {isVaccination && (
                        <View style={[styles.vaccinationBadge, { backgroundColor: `${dotColor}14` }]}>
                            <Ionicons name="shield-checkmark-outline" size={10} color={dotColor} />
                            <Text style={[styles.vaccinationBadgeText, { color: dotColor }]}>Vaccine</Text>
                        </View>
                    )}
                </View>
                <Text style={[styles.timelineDescription, { color: theme.colors.onSurface }]}>
                    {record.description}
                </Text>
                <View style={styles.timelineVetRow}>
                    <Ionicons name="person-outline" size={12} color={theme.colors.onSurfaceVariant} />
                    <Text style={[styles.timelineVetName, { color: theme.colors.onSurfaceVariant }]}>
                        {record.vetName}
                    </Text>
                </View>
            </View>
        </View>
    );
}

// --- Daily Care Checklist Item ---

function DailyCareRow({ item, onToggle }: { item: DailyCareItem; onToggle: (id: string) => void }) {
    const { theme } = useUnistyles();
    const categoryColor = CARE_COLORS[item.category];
    const categoryIcon = CARE_ICONS[item.category];

    return (
        <Pressable
            onPress={() => onToggle(item.id)}
            style={({ pressed }) => [
                styles.careRow,
                {
                    backgroundColor: item.completed ? `${categoryColor}08` : theme.colors.surfaceContainer,
                    opacity: pressed ? 0.85 : 1
                }
            ]}
        >
            {/* Time slot */}
            <View style={styles.careTimeCol}>
                <Text
                    style={[
                        styles.careTime,
                        { color: item.completed ? theme.colors.onSurfaceVariant : theme.colors.onSurface }
                    ]}
                >
                    {item.time}
                </Text>
            </View>

            {/* Checkbox */}
            <View
                style={[
                    styles.careCheckbox,
                    {
                        borderColor: item.completed ? categoryColor : theme.colors.outline,
                        backgroundColor: item.completed ? categoryColor : "transparent"
                    }
                ]}
            >
                {item.completed && <Ionicons name="checkmark" size={12} color="#ffffff" />}
            </View>

            {/* Category icon + title */}
            <View style={[styles.careIconCircle, { backgroundColor: `${categoryColor}14` }]}>
                <Ionicons name={categoryIcon} size={14} color={categoryColor} />
            </View>
            <Text
                style={[
                    styles.careTitle,
                    {
                        color: item.completed ? theme.colors.onSurfaceVariant : theme.colors.onSurface,
                        textDecorationLine: item.completed ? "line-through" : "none"
                    }
                ]}
                numberOfLines={1}
            >
                {item.title}
            </Text>
        </Pressable>
    );
}

// --- Section Header ---

function SectionHeader({
    icon,
    title,
    color,
    count
}: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    color: string;
    count?: number;
}) {
    const { theme } = useUnistyles();

    return (
        <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconCircle, { backgroundColor: `${color}18` }]}>
                <Ionicons name={icon} size={18} color={color} />
            </View>
            <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>{title}</Text>
            {count !== undefined && (
                <View style={[styles.sectionCountBadge, { backgroundColor: `${color}14` }]}>
                    <Text style={[styles.sectionCountText, { color }]}>{count}</Text>
                </View>
            )}
        </View>
    );
}

// --- Main Component ---

export function PetCarePage() {
    const { theme } = useUnistyles();
    const [selectedPetId, setSelectedPetId] = React.useState(PETS[0].id);
    const [appointments, setAppointments] = React.useState(initialAppointments);
    const [dailyCare, setDailyCare] = React.useState(initialDailyCare);

    const selectedPet = PETS.find((p) => p.id === selectedPetId)!;

    // Filter data by selected pet
    const petAppointments = appointments.filter((a) => a.petId === selectedPetId);
    const petHealthRecords = HEALTH_RECORDS.filter((r) => r.petId === selectedPetId);
    const petDailyCare = dailyCare.filter((d) => d.petId === selectedPetId);

    const completedCareCount = petDailyCare.filter((d) => d.completed).length;
    const totalCareCount = petDailyCare.length;

    const toggleReminder = React.useCallback((id: string) => {
        setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, reminderEnabled: !a.reminderEnabled } : a)));
    }, []);

    const toggleCareItem = React.useCallback((id: string) => {
        setDailyCare((prev) => prev.map((d) => (d.id === id ? { ...d, completed: !d.completed } : d)));
    }, []);

    return (
        <ShowcasePage
            style={{ flex: 1, backgroundColor: theme.colors.surface }}
            topInset={16}
            bottomInset={48}
            contentGap={16}
        >
            {/* Page header */}
            <View style={styles.pageHeader}>
                <View style={styles.pageTitleRow}>
                    <Ionicons name="paw" size={24} color={theme.colors.primary} />
                    <Text style={[styles.pageTitle, { color: theme.colors.onSurface }]}>Pet Care</Text>
                </View>
                <Text style={[styles.pageDate, { color: theme.colors.onSurfaceVariant }]}>March 3, 2026</Text>
            </View>

            {/* Pet selector */}
            <PetSelectorTabs pets={PETS} selectedId={selectedPetId} onSelect={setSelectedPetId} />

            {/* Pet hero card */}
            <PetHeroCard pet={selectedPet} />

            {/* Daily care progress */}
            <View style={[styles.progressBanner, { backgroundColor: `${selectedPet.color}10` }]}>
                <View style={[styles.progressIconCircle, { backgroundColor: `${selectedPet.color}20` }]}>
                    <Ionicons name="checkbox-outline" size={18} color={selectedPet.color} />
                </View>
                <View style={styles.progressTextCol}>
                    <Text style={[styles.progressTitle, { color: selectedPet.color }]}>
                        {completedCareCount}/{totalCareCount} tasks done today
                    </Text>
                    <View style={[styles.progressTrack, { backgroundColor: `${selectedPet.color}20` }]}>
                        <View
                            style={[
                                styles.progressFill,
                                {
                                    backgroundColor: selectedPet.color,
                                    width: totalCareCount > 0 ? `${(completedCareCount / totalCareCount) * 100}%` : "0%"
                                }
                            ]}
                        />
                    </View>
                </View>
            </View>

            {/* Upcoming section */}
            <View style={styles.section}>
                <SectionHeader
                    icon="calendar-outline"
                    title="Upcoming"
                    color={theme.colors.primary}
                    count={petAppointments.length}
                />
                <View style={styles.sectionContent}>
                    {petAppointments.map((appointment) => (
                        <AppointmentRow
                            key={appointment.id}
                            appointment={appointment}
                            onToggleReminder={toggleReminder}
                        />
                    ))}
                    {petAppointments.length === 0 && (
                        <View style={styles.emptyState}>
                            <Ionicons name="calendar-outline" size={32} color={theme.colors.onSurfaceVariant} />
                            <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                                No upcoming appointments
                            </Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Health Log section */}
            <View style={styles.section}>
                <SectionHeader
                    icon="heart-outline"
                    title="Health Log"
                    color="#16a34a"
                    count={petHealthRecords.length}
                />
                <View style={styles.timelineContainer}>
                    {petHealthRecords.map((record, index) => (
                        <HealthTimelineEntry
                            key={record.id}
                            record={record}
                            isLast={index === petHealthRecords.length - 1}
                        />
                    ))}
                    {petHealthRecords.length === 0 && (
                        <View style={styles.emptyState}>
                            <Ionicons name="heart-outline" size={32} color={theme.colors.onSurfaceVariant} />
                            <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                                No health records
                            </Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Daily Care section */}
            <View style={styles.section}>
                <SectionHeader
                    icon="list-outline"
                    title="Daily Care"
                    color={selectedPet.color}
                    count={totalCareCount}
                />
                <View style={styles.sectionContent}>
                    {petDailyCare.map((item) => (
                        <DailyCareRow key={item.id} item={item} onToggle={toggleCareItem} />
                    ))}
                    {petDailyCare.length === 0 && (
                        <View style={styles.emptyState}>
                            <Ionicons name="list-outline" size={32} color={theme.colors.onSurfaceVariant} />
                            <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                                No daily care tasks
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        </ShowcasePage>
    );
}

// --- Styles ---

const styles = StyleSheet.create((theme) => ({
    // Page header
    pageHeader: {
        gap: 4,
        paddingTop: 8
    },
    pageTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10
    },
    pageTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 22,
        lineHeight: 28
    },
    pageDate: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        marginLeft: 34
    },

    // Segmented control
    segmentedControl: {
        flexDirection: "row",
        gap: 8
    },
    segmentTab: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1
    },
    segmentLabel: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 14
    },

    // Hero card
    heroCard: {
        flexDirection: "row",
        borderRadius: 16,
        padding: 16,
        gap: 16,
        alignItems: "center"
    },
    heroAvatar: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: "center",
        justifyContent: "center",
        position: "relative"
    },
    heroInitials: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 26
    },
    heroAvatarBadge: {
        position: "absolute",
        bottom: -2,
        right: -2,
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: "#ffffff"
    },
    heroInfoCol: {
        flex: 1,
        gap: 4
    },
    heroName: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 20,
        lineHeight: 24
    },
    heroBreed: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14,
        lineHeight: 18
    },
    heroDetailsRow: {
        flexDirection: "row",
        gap: 6,
        marginTop: 4,
        flexWrap: "wrap"
    },
    heroDetailChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10
    },
    heroDetailText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11
    },

    // Progress banner
    progressBanner: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 14,
        padding: 14,
        gap: 12
    },
    progressIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center"
    },
    progressTextCol: {
        flex: 1,
        gap: 6
    },
    progressTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 13
    },
    progressTrack: {
        height: 6,
        borderRadius: 3,
        overflow: "hidden"
    },
    progressFill: {
        height: "100%",
        borderRadius: 3
    },

    // Section
    section: {
        gap: 10
    },
    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10
    },
    sectionIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center"
    },
    sectionTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 16,
        flex: 1
    },
    sectionCountBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10
    },
    sectionCountText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 12
    },
    sectionContent: {
        gap: 8
    },

    // Appointment row
    appointmentRow: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 12,
        padding: 12,
        gap: 12
    },
    dateBadge: {
        width: 44,
        height: 44,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        gap: 1
    },
    dateBadgeMonth: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 10,
        textTransform: "uppercase"
    },
    dateBadgeDay: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 16,
        lineHeight: 18
    },
    appointmentInfoCol: {
        flex: 1,
        gap: 2
    },
    appointmentTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6
    },
    appointmentTitle: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 14,
        flex: 1
    },
    appointmentTime: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 12
    },
    reminderCol: {
        alignItems: "center",
        gap: 2
    },
    reminderSwitch: {
        transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }]
    },

    // Timeline
    timelineContainer: {
        paddingLeft: 4
    },
    timelineEntry: {
        flexDirection: "row"
    },
    timelineDotCol: {
        alignItems: "center",
        width: 24
    },
    timelineDot: {
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 2
    },
    timelineLine: {
        width: 2,
        flex: 1,
        marginTop: 4,
        marginBottom: 0
    },
    timelineContent: {
        flex: 1,
        paddingLeft: 12,
        paddingBottom: 16,
        gap: 4
    },
    timelineHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    timelineDate: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 12
    },
    vaccinationBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8
    },
    vaccinationBadgeText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 10
    },
    timelineDescription: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 14,
        lineHeight: 18
    },
    timelineVetRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        marginTop: 2
    },
    timelineVetName: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },

    // Daily care row
    careRow: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 10,
        padding: 10,
        gap: 10
    },
    careTimeCol: {
        width: 62
    },
    careTime: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11
    },
    careCheckbox: {
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 2,
        alignItems: "center",
        justifyContent: "center"
    },
    careIconCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center"
    },
    careTitle: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 14,
        flex: 1
    },

    // Empty state
    emptyState: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 32,
        gap: 8
    },
    emptyText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13
    }
}));
