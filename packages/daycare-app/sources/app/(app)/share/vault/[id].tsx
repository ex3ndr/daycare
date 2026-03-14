import { useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import { useVaultsStore } from "@/modules/documents/vaultsContext";

export default function ShareVaultScreen() {
    const { theme } = useUnistyles();
    const { id } = useLocalSearchParams<{ id: string }>();

    const document = useVaultsStore((s) => s.items.find((d) => d.id === id) ?? null);

    if (!document) return null;

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
            <View
                style={{
                    paddingHorizontal: 20,
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.colors.outlineVariant
                }}
            >
                <Text style={{ fontSize: 18, fontWeight: "600", color: theme.colors.onSurface }} numberOfLines={1}>
                    {document.title}
                </Text>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
                <Text
                    style={{
                        flex: 1,
                        padding: 20,
                        fontSize: 14,
                        lineHeight: 22,
                        color: theme.colors.onSurface,
                        fontFamily: "monospace"
                    }}
                    selectable
                >
                    {document.body}
                </Text>
            </ScrollView>
        </View>
    );
}
