import { Octicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { ItemList } from "@/components/ItemList";
import { PageHeader } from "@/components/PageHeader";

/**
 * Home view — placeholder for the main dashboard.
 */
export function HomeView() {
    const { theme } = useUnistyles();

    return (
        <ItemList>
            <PageHeader title="Home" icon="home" />
            <View style={styles.empty}>
                <Octicons name="home" size={32} color={theme.colors.onSurfaceVariant} />
                <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>Welcome to Daycare</Text>
            </View>
        </ItemList>
    );
}

const styles = StyleSheet.create({
    empty: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 80,
        gap: 12
    },
    emptyText: {
        fontSize: 16,
        fontWeight: "500"
    }
});
