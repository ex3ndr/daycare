import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { ItemGroup } from "@/components/ItemGroup";
import { ItemListStatic } from "@/components/ItemList";

export function SkillsView() {
    const { theme } = useUnistyles();
    return (
        <ItemListStatic>
            <ItemGroup title="Skills">
                <View style={styles.empty}>
                    <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                        No skills configured yet
                    </Text>
                </View>
            </ItemGroup>
        </ItemListStatic>
    );
}

const styles = StyleSheet.create({
    empty: {
        padding: 20,
        alignItems: "center"
    },
    emptyText: {
        fontSize: 14
    }
});
