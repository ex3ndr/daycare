import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Item } from "@/components/Item";
import { ItemGroup } from "@/components/ItemGroup";
import { ItemListStatic } from "@/components/ItemList";
import { useAuthStore } from "@/modules/auth/authContext";
import { useProfileStore } from "@/modules/profile/profileContext";

export function SettingsView() {
    const { theme } = useUnistyles();

    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);
    const userId = useAuthStore((s) => s.userId);
    const logout = useAuthStore((s) => s.logout);

    const profile = useProfileStore((s) => s.profile);
    const loading = useProfileStore((s) => s.loading);
    const error = useProfileStore((s) => s.error);
    const fetchProfile = useProfileStore((s) => s.fetch);

    useEffect(() => {
        if (baseUrl && token) {
            void fetchProfile(baseUrl, token);
        }
    }, [baseUrl, token, fetchProfile]);

    return (
        <ItemListStatic>
            <ItemGroup title="Identity">
                <Item title="User ID" subtitle={userId ?? "—"} showChevron={false} />
                {loading && !profile && (
                    <View style={styles.centered}>
                        <ActivityIndicator color={theme.colors.primary} size="small" />
                    </View>
                )}
                {error && !profile && <Item title="Profile error" subtitle={error} showChevron={false} />}
                {profile && (
                    <>
                        <Item title="Nametag" subtitle={profile.nametag} showChevron={false} />
                        <Item
                            title="Name"
                            subtitle={[profile.firstName, profile.lastName].filter(Boolean).join(" ") || "—"}
                            showChevron={false}
                        />
                    </>
                )}
            </ItemGroup>

            {profile && (
                <ItemGroup title="Profile">
                    <Item title="Bio" subtitle={profile.bio ?? "—"} showChevron={false} />
                    <Item title="Country" subtitle={profile.country ?? "—"} showChevron={false} />
                    <Item title="Timezone" subtitle={profile.timezone ?? "—"} showChevron={false} />
                    <Item title="Memory" subtitle={profile.memory ? "Enabled" : "Disabled"} showChevron={false} />
                </ItemGroup>
            )}

            <ItemGroup title="Connection">
                <Item title="Server" subtitle={baseUrl ?? "—"} showChevron={false} />
                <Item title="Token" subtitle={token ? `${token.slice(0, 12)}...` : "—"} showChevron={false} />
            </ItemGroup>

            <ItemGroup>
                <Item
                    title="Sign Out"
                    onPress={() => void logout()}
                    icon={<View style={[styles.dot, { backgroundColor: theme.colors.error }]} />}
                    showChevron={false}
                />
            </ItemGroup>
        </ItemListStatic>
    );
}

const styles = StyleSheet.create({
    centered: {
        alignItems: "center",
        justifyContent: "center",
        padding: 16
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5
    }
});
