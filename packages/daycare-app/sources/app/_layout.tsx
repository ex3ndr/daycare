import "../theme.css";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import * as Fonts from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as React from "react";
import { StatusBar, Text, View } from "react-native";
import { initialWindowMetrics, SafeAreaProvider } from "react-native-safe-area-context";
import { useUnistyles } from "react-native-unistyles";
import { AlertProvider } from "@/components/alert";
import { AuthProvider, useAuthStore } from "@/modules/auth/authContext";
import { SyncProvider } from "@/modules/sync/SyncProvider";
import { isTMA } from "@/modules/tma/isTMA";
import { WorkspaceProvider } from "@/modules/workspaces/workspaceProvider";

export { ErrorBoundary } from "expo-router";

/** Set IBMPlexSans-Regular as the default font for all Text components. */
const defaultTextStyle = { fontFamily: "IBMPlexSans-Regular" };
// @ts-expect-error -- RN defaultProps is untyped but widely supported
Text.defaultProps = { ...Text.defaultProps, style: defaultTextStyle };

let fontsLoaded = false;
async function loadFonts() {
    if (fontsLoaded) return;
    fontsLoaded = true;
    await Fonts.loadAsync({
        // IBM Plex Sans — all weights + italics
        "IBMPlexSans-Thin": require("@/assets/fonts/IBMPlexSans-Thin.ttf"),
        "IBMPlexSans-ThinItalic": require("@/assets/fonts/IBMPlexSans-ThinItalic.ttf"),
        "IBMPlexSans-ExtraLight": require("@/assets/fonts/IBMPlexSans-ExtraLight.ttf"),
        "IBMPlexSans-ExtraLightItalic": require("@/assets/fonts/IBMPlexSans-ExtraLightItalic.ttf"),
        "IBMPlexSans-Light": require("@/assets/fonts/IBMPlexSans-Light.ttf"),
        "IBMPlexSans-LightItalic": require("@/assets/fonts/IBMPlexSans-LightItalic.ttf"),
        "IBMPlexSans-Regular": require("@/assets/fonts/IBMPlexSans-Regular.ttf"),
        "IBMPlexSans-Italic": require("@/assets/fonts/IBMPlexSans-Italic.ttf"),
        "IBMPlexSans-Text": require("@/assets/fonts/IBMPlexSans-Text.ttf"),
        "IBMPlexSans-TextItalic": require("@/assets/fonts/IBMPlexSans-TextItalic.ttf"),
        "IBMPlexSans-Medium": require("@/assets/fonts/IBMPlexSans-Medium.ttf"),
        "IBMPlexSans-MediumItalic": require("@/assets/fonts/IBMPlexSans-MediumItalic.ttf"),
        "IBMPlexSans-SemiBold": require("@/assets/fonts/IBMPlexSans-SemiBold.ttf"),
        "IBMPlexSans-SemiBoldItalic": require("@/assets/fonts/IBMPlexSans-SemiBoldItalic.ttf"),
        "IBMPlexSans-Bold": require("@/assets/fonts/IBMPlexSans-Bold.ttf"),
        "IBMPlexSans-BoldItalic": require("@/assets/fonts/IBMPlexSans-BoldItalic.ttf"),
        // IBM Plex Mono
        "IBMPlexMono-Regular": require("@/assets/fonts/IBMPlexMono-Regular.ttf"),
        "IBMPlexMono-Italic": require("@/assets/fonts/IBMPlexMono-Italic.ttf"),
        "IBMPlexMono-SemiBold": require("@/assets/fonts/IBMPlexMono-SemiBold.ttf"),
        // Display fonts
        "BricolageGrotesque-Bold": require("@/assets/fonts/BricolageGrotesque-Bold.ttf"),
        SpaceMono: require("@/assets/fonts/SpaceMono-Regular.ttf")
    });
}

const modalScreenOptions = {
    presentation: "modal" as const,
    animation: "fade_from_bottom" as const,
    webModalStyle: {
        width: "90vw",
        height: "90vh",
        minWidth: "min(1100px, 90vw)",
        minHeight: "min(800px, 90vh)"
    }
};

export default function RootLayout() {
    const { theme } = useUnistyles();
    const ready = useAuthStore((state) => state.ready);
    const authState = useAuthStore((state) => state.state);
    const bootstrap = useAuthStore((state) => state.bootstrap);
    const [fontsReady, setFontsReady] = React.useState(false);

    React.useEffect(() => {
        if (isTMA()) {
            // In Telegram Mini Apps, skip awaiting fonts to avoid timeout-induced blank screens.
            loadFonts().catch(() => {});
            setFontsReady(true);
        } else {
            loadFonts()
                .catch(() => {})
                .then(() => setFontsReady(true));
        }
    }, []);

    React.useEffect(() => {
        void bootstrap();
    }, [bootstrap]);

    React.useEffect(() => {
        if (ready && fontsReady) {
            void SplashScreen.hideAsync();
        }
    }, [ready, fontsReady]);

    const navigationTheme = React.useMemo(() => {
        if (theme.dark) {
            return {
                ...DarkTheme,
                colors: {
                    ...DarkTheme.colors,
                    primary: theme.colors.primary,
                    background: theme.colors.surfaceDim,
                    card: theme.colors.surfaceContainer,
                    text: theme.colors.onSurface,
                    border: theme.colors.outlineVariant,
                    notification: theme.colors.error
                }
            };
        }

        return {
            ...DefaultTheme,
            colors: {
                ...DefaultTheme.colors,
                primary: theme.colors.primary,
                background: theme.colors.surfaceDim,
                card: theme.colors.surfaceContainer,
                text: theme.colors.onSurface,
                border: theme.colors.outlineVariant,
                notification: theme.colors.error
            }
        };
    }, [theme]);

    if (!ready || !fontsReady) {
        return null;
    }

    return (
        <>
            <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} />
            <AuthProvider>
                <WorkspaceProvider>
                    <SyncProvider>
                        <AlertProvider>
                            <SafeAreaProvider initialMetrics={initialWindowMetrics}>
                                <View style={{ flexDirection: "column", flexGrow: 1, flexBasis: 0 }}>
                                    <ThemeProvider value={navigationTheme}>
                                        <Stack screenOptions={{ headerShown: false }}>
                                            <Stack.Protected guard={authState === "authenticated"}>
                                                <Stack.Screen name="(app)" />
                                                <Stack.Screen
                                                    name="[workspace]/fragment/[id]"
                                                    options={modalScreenOptions}
                                                />
                                                <Stack.Screen
                                                    name="[workspace]/routine/[id]"
                                                    options={modalScreenOptions}
                                                />
                                                <Stack.Screen
                                                    name="[workspace]/file-preview/[path]"
                                                    options={modalScreenOptions}
                                                />
                                                <Stack.Screen name="share" />
                                                <Stack.Screen name="workspace-not-found" />
                                            </Stack.Protected>
                                            <Stack.Protected guard={authState === "unauthenticated"}>
                                                <Stack.Screen name="(auth)" />
                                            </Stack.Protected>
                                            <Stack.Screen name="verify" />
                                            <Stack.Screen name="invite" />
                                        </Stack>
                                    </ThemeProvider>
                                </View>
                            </SafeAreaProvider>
                        </AlertProvider>
                    </SyncProvider>
                </WorkspaceProvider>
            </AuthProvider>
        </>
    );
}
