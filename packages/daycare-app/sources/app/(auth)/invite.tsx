import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { authRedirectStore } from "@/modules/auth/authRedirectStorage";

/**
 * Invite screen for unauthenticated users.
 * Shows invite details and prompts to sign in first, storing the invite
 * redirect so the user returns here after authentication.
 */
export default function AuthInviteScreen() {
    const { theme } = useUnistyles();
    const router = useRouter();
    const params = useLocalSearchParams<{
        backendUrl?: string;
        token?: string;
        workspaceName?: string;
    }>();

    const hasInvite = Boolean(params.backendUrl && params.token);

    const handleSignIn = React.useCallback(() => {
        if (params.backendUrl && params.token) {
            const query = new URLSearchParams({
                backendUrl: params.backendUrl,
                token: params.token,
                kind: "workspace-invite"
            });
            if (params.workspaceName) {
                query.set("workspaceName", params.workspaceName);
            }
            authRedirectStore(`/invite?${query.toString()}`);
        }
        router.push("/signin");
    }, [params.backendUrl, params.token, params.workspaceName, router]);

    return (
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
                            {params.workspaceName ?? "a workspace"}
                        </Text>
                        . Sign in to accept.
                    </Text>
                    <Pressable
                        accessibilityRole="button"
                        onPress={handleSignIn}
                        style={({ pressed }) => [
                            styles.button,
                            { backgroundColor: theme.colors.primary },
                            pressed && styles.buttonPressed
                        ]}
                    >
                        <Text style={[styles.buttonText, { color: theme.colors.onPrimary }]}>Sign in</Text>
                    </Pressable>
                </>
            ) : (
                <Text style={[styles.message, { color: theme.colors.error }]}>Invalid invite link.</Text>
            )}
        </View>
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
    }
});
