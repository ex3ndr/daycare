import { Slot } from "expo-router";
import { View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { AppHeader } from "@/components/AppHeader";

export default function AppLayout() {
    const { theme } = useUnistyles();

    return (
        <View style={[styles.root, { backgroundColor: theme.colors.surfaceContainerLow }]}>
            <AppHeader />
            <Slot />
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flexGrow: 1,
        flexBasis: 0,
        flexDirection: "column"
    }
});
