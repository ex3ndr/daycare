import { Octicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { showcasePages } from "@/views/dev/showcase/_showcasePages";

/**
 * Grid listing of all showcase pages with navigation.
 * Renders each page as a tappable card that navigates to /dev/<id>.
 */
export function ShowcaseListView() {
    const { theme } = useUnistyles();
    const router = useRouter();

    return (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <View style={styles.grid}>
                {showcasePages.map((page) => (
                    <Pressable
                        key={page.id}
                        style={[styles.card, { backgroundColor: theme.colors.surfaceContainer }]}
                        onPress={() => router.replace(`/dev/${page.id}` as `/${string}`)}
                    >
                        <View style={[styles.iconCircle, { backgroundColor: theme.colors.primaryContainer }]}>
                            <Octicons name="beaker" size={16} color={theme.colors.onPrimaryContainer} />
                        </View>
                        <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]} numberOfLines={2}>
                            {page.title}
                        </Text>
                        <Octicons
                            name="chevron-right"
                            size={14}
                            color={theme.colors.onSurfaceVariant}
                            style={styles.chevron}
                        />
                    </Pressable>
                ))}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create((theme) => ({
    scroll: {
        flex: 1
    },
    scrollContent: {
        maxWidth: theme.layout.maxWidth,
        width: "100%",
        alignSelf: "center",
        paddingHorizontal: 20,
        paddingBottom: 40
    },
    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10
    },
    card: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 10,
        width: "48%",
        minWidth: 240
    },
    iconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center"
    },
    cardTitle: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 13,
        flex: 1
    },
    chevron: {
        marginLeft: 4
    }
}));
