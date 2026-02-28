import "../theme.css";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import * as Fonts from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as React from "react";
import { StatusBar, View } from "react-native";
import { initialWindowMetrics, SafeAreaProvider } from "react-native-safe-area-context";
import { useUnistyles } from "react-native-unistyles";
import { AlertProvider } from "@/components/alert";
import { AuthProvider, useAuthStore } from "@/modules/auth/authContext";

export { ErrorBoundary } from "expo-router";

let fontsLoaded = false;
async function loadFonts() {
    if (fontsLoaded) return;
    fontsLoaded = true;
    await Fonts.loadAsync({
        "IBMPlexSans-Regular": require("@/assets/fonts/IBMPlexSans-Regular.ttf"),
        "IBMPlexSans-Italic": require("@/assets/fonts/IBMPlexSans-Italic.ttf"),
        "IBMPlexSans-SemiBold": require("@/assets/fonts/IBMPlexSans-SemiBold.ttf"),
        "IBMPlexMono-Regular": require("@/assets/fonts/IBMPlexMono-Regular.ttf"),
        "IBMPlexMono-Italic": require("@/assets/fonts/IBMPlexMono-Italic.ttf"),
        "IBMPlexMono-SemiBold": require("@/assets/fonts/IBMPlexMono-SemiBold.ttf"),
        "BricolageGrotesque-Bold": require("@/assets/fonts/BricolageGrotesque-Bold.ttf"),
        SpaceMono: require("@/assets/fonts/SpaceMono-Regular.ttf")
    });
}

export default function RootLayout() {
    const { theme } = useUnistyles();
    const ready = useAuthStore((state) => state.ready);
    const authState = useAuthStore((state) => state.state);
    const bootstrap = useAuthStore((state) => state.bootstrap);
    const [fontsReady, setFontsReady] = React.useState(false);

    React.useEffect(() => {
        loadFonts().then(() => setFontsReady(true));
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
                    background: theme.colors.surface,
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
                background: theme.colors.surface,
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
                <AlertProvider>
                    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
                        <View style={{ flexDirection: "column", flexGrow: 1, flexBasis: 0 }}>
                            <ThemeProvider value={navigationTheme}>
                                <Stack screenOptions={{ headerShown: false }}>
                                    <Stack.Protected guard={authState === "authenticated"}>
                                        <Stack.Screen name="(app)" />
                                    </Stack.Protected>
                                    <Stack.Protected guard={authState === "unauthenticated"}>
                                        <Stack.Screen name="(auth)" />
                                    </Stack.Protected>
                                </Stack>
                            </ThemeProvider>
                        </View>
                    </SafeAreaProvider>
                </AlertProvider>
            </AuthProvider>
        </>
    );
}
