import * as React from "react";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import WebView from "react-native-webview";
import { useAuthStore } from "@/modules/auth/authContext";
import { miniAppLaunchFetch } from "@/modules/mini-apps/miniAppLaunchFetch";
import { useMiniAppsStore } from "@/modules/mini-apps/miniAppsContext";
import { MINI_APPS_EMPTY } from "@/modules/mini-apps/miniAppsStoreCreate";
import { useWorkspace } from "@/modules/workspaces/workspaceProvider";

type MiniAppViewProps = {
    appId: string;
};

/**
 * Renders one mini app inside a token-scoped webview/iframe.
 * Expects: appId exists in the current workspace mini-app list.
 */
export function MiniAppView({ appId }: MiniAppViewProps) {
    const { theme } = useUnistyles();
    const baseUrl = useAuthStore((state) => state.baseUrl);
    const token = useAuthStore((state) => state.token);
    const { workspaceId } = useWorkspace();
    const app = useMiniAppsStore(
        (state) => (state.appsByWorkspace[workspaceId] ?? MINI_APPS_EMPTY).find((entry) => entry.id === appId) ?? null
    );
    const [launchUrl, setLaunchUrl] = React.useState<string | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        let cancelled = false;
        if (!baseUrl || !token || !appId) {
            return;
        }
        setError(null);
        setLaunchUrl(null);
        void miniAppLaunchFetch(baseUrl, token, workspaceId, appId)
            .then((launch) => {
                if (cancelled) {
                    return;
                }
                setLaunchUrl(new URL(launch.launchPath, `${baseUrl}/`).toString());
            })
            .catch((nextError: unknown) => {
                if (cancelled) {
                    return;
                }
                setError(nextError instanceof Error ? nextError.message : "Mini app failed to load.");
            });
        return () => {
            cancelled = true;
        };
    }, [appId, baseUrl, token, workspaceId]);

    return (
        <View style={[styles.root, { backgroundColor: theme.colors.surfaceContainerLow }]}>
            {!app ? (
                <View style={styles.center}>
                    <Text style={[styles.message, { color: theme.colors.onSurfaceVariant }]}>Mini app not found.</Text>
                </View>
            ) : error ? (
                <View style={styles.center}>
                    <Text style={[styles.message, { color: theme.colors.error }]}>{error}</Text>
                </View>
            ) : !launchUrl ? (
                <View style={styles.center}>
                    <ActivityIndicator color={theme.colors.primary} />
                </View>
            ) : Platform.OS === "web" ? (
                <iframe
                    title={app.title}
                    src={launchUrl}
                    sandbox="allow-scripts allow-same-origin"
                    style={{ width: "100%", height: "100%", border: "none" }}
                />
            ) : (
                <WebView
                    source={{ uri: launchUrl }}
                    originWhitelist={["*"]}
                    style={styles.webview}
                    onShouldStartLoadWithRequest={(request) => request.url.startsWith(launchUrl)}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1
    },
    center: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24
    },
    message: {
        fontSize: 14,
        fontFamily: "IBMPlexSans-Regular",
        textAlign: "center"
    },
    webview: {
        flex: 1
    }
});
