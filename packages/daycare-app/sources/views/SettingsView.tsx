import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Item } from "@/components/Item";
import { ItemGroup } from "@/components/ItemGroup";
import { ItemListStatic } from "@/components/ItemList";
import { PageHeader } from "@/components/PageHeader";
import { useAuthStore } from "@/modules/auth/authContext";
import { useProfileStore } from "@/modules/profile/profileContext";
import { secretsFetch } from "@/modules/secrets/secretsFetch";
import type { SecretSummary } from "@/modules/secrets/secretsTypes";
import { secretPresenceSubtitleBuild } from "@/views/settings/secretPresenceSubtitleBuild";

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
    const [secrets, setSecrets] = useState<SecretSummary[] | null>(null);
    const [secretsLoading, setSecretsLoading] = useState(false);
    const [secretsError, setSecretsError] = useState<string | null>(null);

    useEffect(() => {
        if (baseUrl && token) {
            void fetchProfile(baseUrl, token);
        }
    }, [baseUrl, token, fetchProfile]);

    useEffect(() => {
        if (!baseUrl || !token) {
            setSecrets(null);
            setSecretsLoading(false);
            setSecretsError(null);
            return;
        }

        let active = true;
        setSecrets(null);
        setSecretsLoading(true);
        setSecretsError(null);

        void secretsFetch(baseUrl, token)
            .then((items) => {
                if (!active) {
                    return;
                }
                setSecrets(
                    [...items].sort(
                        (a, b) =>
                            a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }) ||
                            a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
                    )
                );
                setSecretsLoading(false);
            })
            .catch((fetchError) => {
                if (!active) {
                    return;
                }
                setSecretsError(fetchError instanceof Error ? fetchError.message : "Failed to fetch secrets.");
                setSecretsLoading(false);
            });

        return () => {
            active = false;
        };
    }, [baseUrl, token]);

    return (
        <View style={{ flex: 1 }}>
            <PageHeader title="Settings" icon="gear" />
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

                <ItemGroup
                    title="Secrets"
                    footer="This section shows secret names and variable presence only. Secret values are never displayed."
                >
                    {secretsLoading && !secrets && (
                        <View style={styles.centered}>
                            <ActivityIndicator color={theme.colors.primary} size="small" />
                        </View>
                    )}
                    {secretsError && !secrets && (
                        <Item
                            title="Secrets unavailable"
                            subtitle={secretsError}
                            subtitleLines={0}
                            showChevron={false}
                        />
                    )}
                    {secrets && secrets.length === 0 && (
                        <Item
                            title="No secrets saved"
                            subtitle="Saved secrets will appear here without exposing their values."
                            subtitleLines={0}
                            showChevron={false}
                        />
                    )}
                    {secrets?.map((secret) => (
                        <Item
                            key={secret.name}
                            title={secret.displayName || secret.name}
                            subtitle={secretPresenceSubtitleBuild(secret)}
                            subtitleLines={0}
                            detail={`${secret.variableCount} var${secret.variableCount === 1 ? "" : "s"}`}
                            showChevron={false}
                        />
                    ))}
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
        </View>
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
