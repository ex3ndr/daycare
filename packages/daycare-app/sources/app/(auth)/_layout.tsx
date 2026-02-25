import { Stack } from "expo-router";
import { useUnistyles } from "react-native-unistyles";

export default function AuthLayout() {
    const { theme } = useUnistyles();

    return (
        <Stack
            screenOptions={{
                headerStyle: {
                    backgroundColor: theme.colors.surface
                },
                headerTintColor: theme.colors.onSurface,
                headerTitleStyle: {
                    color: theme.colors.onSurface
                },
                headerShadowVisible: false,
                contentStyle: {
                    backgroundColor: theme.colors.background
                }
            }}
        >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="auth" options={{ headerShown: false }} />
        </Stack>
    );
}
