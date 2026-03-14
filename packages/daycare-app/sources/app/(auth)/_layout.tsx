import { Stack } from "expo-router";
import { useUnistyles } from "react-native-unistyles";
import { AppHeader } from "@/components/AppHeader";

export default function AuthLayout() {
    const { theme } = useUnistyles();

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: {
                    backgroundColor: theme.colors.surface
                }
            }}
        >
            <Stack.Screen name="index" />
            <Stack.Screen
                name="signin"
                options={{
                    headerShown: true,
                    header: () => <AppHeader canGoBack />
                }}
            />
            <Stack.Screen
                name="auth"
                options={{
                    headerShown: true,
                    header: () => <AppHeader canGoBack />
                }}
            />
            <Stack.Screen
                name="invite"
                options={{
                    headerShown: true,
                    header: () => <AppHeader title="Invite" canGoBack />
                }}
            />
            <Stack.Screen
                name="verify"
                options={{
                    headerShown: true,
                    header: () => <AppHeader canGoBack />
                }}
            />
        </Stack>
    );
}
