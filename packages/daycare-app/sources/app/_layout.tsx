import "../theme.css";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as React from "react";
import { StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { initialWindowMetrics, SafeAreaProvider } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { AlertProvider } from "@/components/alert";
import { AuthProvider, useAuthStore } from "@/modules/auth/authContext";

export { ErrorBoundary } from "expo-router";

export default function RootLayout() {
    const { theme } = useUnistyles();
    const ready = useAuthStore((state) => state.ready);
    const authState = useAuthStore((state) => state.state);
    const bootstrap = useAuthStore((state) => state.bootstrap);

    React.useEffect(() => {
        void bootstrap();
    }, [bootstrap]);

    React.useEffect(() => {
        if (ready) {
            void SplashScreen.hideAsync();
        }
    }, [ready]);

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

    if (!ready) {
        return null;
    }

    return (
        <>
            <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} />
            <AuthProvider>
                <AlertProvider>
                    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
                        <GestureHandlerRootView style={styles.root}>
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
                        </GestureHandlerRootView>
                    </SafeAreaProvider>
                </AlertProvider>
            </AuthProvider>
        </>
    );
}

const styles = StyleSheet.create(() => ({
    root: {
        flex: 1
    }
}));
