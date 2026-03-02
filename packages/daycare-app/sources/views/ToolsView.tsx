import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { ItemGroup } from "@/components/ItemGroup";
import { ItemListStatic } from "@/components/ItemList";

export function ToolsView() {
    const { theme } = useUnistyles();
    return (
        <ItemListStatic>
            <ItemGroup title="Tools">
                <View style={styles.empty}>
                    <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                        No tools configured yet
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
