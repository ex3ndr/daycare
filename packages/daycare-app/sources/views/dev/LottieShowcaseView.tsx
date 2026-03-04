import LottieView from "lottie-react-native";
import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { ItemList } from "@/components/ItemList";

const animations = [
    { name: "Owl", source: require("@/assets/animations/owl.json") },
    { name: "Wand", source: require("@/assets/animations/wand.json") },
    { name: "Snail", source: require("@/assets/animations/snail.json") },
    { name: "Robot", source: require("@/assets/animations/robot.json") },
    { name: "Popcorn", source: require("@/assets/animations/popcorn.json") },
    { name: "Sparkles", source: require("@/assets/animations/sparkles.json") },
    { name: "Stone", source: require("@/assets/animations/stone.json") },
    { name: "Game", source: require("@/assets/animations/game.json") }
];

/**
 * Dev page showcasing all available Lottie animations.
 */
export function LottieShowcaseView() {
    const { theme } = useUnistyles();

    return (
        <ItemList>
            <View style={styles.grid}>
                {animations.map((anim) => (
                    <View key={anim.name} style={[styles.card, { backgroundColor: theme.colors.surfaceContainer }]}>
                        <LottieView source={anim.source} autoPlay loop style={styles.animation} />
                        <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>{anim.name}</Text>
                    </View>
                ))}
            </View>
        </ItemList>
    );
}

const styles = StyleSheet.create({
    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 16,
        padding: 24
    },
    card: {
        alignItems: "center",
        borderRadius: 12,
        padding: 16,
        gap: 8,
        width: 180
    },
    animation: {
        width: 120,
        height: 120
    },
    label: {
        fontSize: 14,
        fontWeight: "500"
    }
});
