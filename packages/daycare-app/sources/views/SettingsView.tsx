import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Item } from "@/components/Item";
import { ItemGroup } from "@/components/ItemGroup";
import { ItemListStatic } from "@/components/ItemList";

export function SettingsView() {
    const { theme } = useUnistyles();

    return (
        <View style={styles.root}>
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>Settings</Text>
            <ItemListStatic>
                <ItemGroup>
                    <Item title="Account" icon={<View style={styles.dot} />} />
                    <Item title="Appearance" icon={<View style={styles.dot} />} />
                    <Item title="About" icon={<View style={styles.dot} />} showChevron={false} />
                </ItemGroup>
            </ItemListStatic>
        </View>
    );
}

const styles = StyleSheet.create(() => ({
    root: {
        flex: 1,
        paddingTop: 8
    },
    title: {
        fontSize: 20,
        fontWeight: "600",
        marginHorizontal: 24,
        marginBottom: 8
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: "#7d7d7d"
    }
}));
