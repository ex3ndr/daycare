import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { SinglePanelLayout } from "@/components/layout/SinglePanelLayout";
import { useAuthStore } from "@/modules/auth/authContext";
import { membersInviteAccept } from "@/modules/members/membersInviteAccept";
import { useWorkspacesStore } from "@/modules/workspaces/workspacesContext";

/**
 * Invite screen for authenticated users.
 * Shows invite details and allows accepting directly.
 */
export default function AppInviteScreen() {
    const { theme } = useUnistyles();
    const router = useRouter();
    const baseUrl = useAuthStore((state) => state.baseUrl);
    const token = useAuthStore((state) => state.token);
    const fetchWorkspaces = useWorkspacesStore((state) => state.fetch);
    const params = useLocalSearchParams<{
        backendUrl?: string;
        token?: string;
        workspaceName?: string;
    }>();

    const hasInvite = Boolean(params.backendUrl && params.token);
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const confirmJoin = React.useCallback(async () => {
        if (!params.backendUrl || !params.token || !baseUrl || !token || submitting) {
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            if (baseUrl !== params.backendUrl) {
                throw new Error("This invite belongs to a different Daycare server. Sign in there first.");
            }
            const result = await membersInviteAccept(baseUrl, token, params.token);
            if (!result.ok) {
                throw new Error(result.error);
            }
            await fetchWorkspaces(baseUrl, token);
            router.replace(`/${result.workspaceId}` as never);
        } catch (acceptError) {
            setError(acceptError instanceof Error ? acceptError.message : "Failed to join workspace.");
        } finally {
            setSubmitting(false);
        }
    }, [baseUrl, fetchWorkspaces, params.backendUrl, params.token, router, submitting, token]);

    return (
        <SinglePanelLayout>
            <View style={styles.content}>
                <View style={[styles.iconContainer, { backgroundColor: theme.colors.primaryContainer }]}>
                    <Text style={styles.icon}>👥</Text>
                </View>
                <Text style={[styles.title, { color: theme.colors.onSurface }]}>Workspace Invite</Text>
                {hasInvite ? (
                    <>
                        <Text style={[styles.message, { color: theme.colors.onSurfaceVariant }]}>
                            You've been invited to join{" "}
                            <Text style={[styles.value, { color: theme.colors.onSurface }]}>
                                {params.workspaceName ?? "this workspace"}
                            </Text>
                            .
                        </Text>
                        <Pressable
                            accessibilityRole="button"
                            disabled={submitting}
                            onPress={() => void confirmJoin()}
                            style={({ pressed }) => [
                                styles.button,
                                { backgroundColor: theme.colors.primary },
                                pressed ? styles.buttonPressed : null,
                                submitting ? styles.buttonDisabled : null
                            ]}
                        >
                            {submitting ? (
                                <ActivityIndicator size="small" color={theme.colors.onPrimary} />
                            ) : (
                                <Text style={[styles.buttonText, { color: theme.colors.onPrimary }]}>
                                    Join Workspace
                                </Text>
                            )}
                        </Pressable>
                    </>
                ) : (
                    <Text style={[styles.message, { color: theme.colors.error }]}>Invalid invite link.</Text>
                )}
                {error ? <Text style={[styles.message, { color: theme.colors.error }]}>{error}</Text> : null}
            </View>
        </SinglePanelLayout>
    );
}

const styles = StyleSheet.create({
    content: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 28,
        gap: 18
    },
    iconContainer: {
        width: 88,
        height: 88,
        borderRadius: 44,
        alignItems: "center",
        justifyContent: "center"
    },
    icon: {
        fontSize: 42
    },
    title: {
        fontFamily: "IBMPlexSans-Bold",
        fontSize: 30,
        textAlign: "center"
    },
    message: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 16,
        lineHeight: 24,
        textAlign: "center",
        maxWidth: 360
    },
    value: {
        fontFamily: "IBMPlexSans-SemiBold"
    },
    button: {
        minHeight: 46,
        paddingHorizontal: 20,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center"
    },
    buttonText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15
    },
    buttonPressed: {
        opacity: 0.85
    },
    buttonDisabled: {
        opacity: 0.6
    }
});
