import { Stack } from "expo-router";
import { useUnistyles } from "react-native-unistyles";

export default function AuthLayout() {
    const { theme } = useUnistyles();

    return (
        <Stack
            screenOptions={{
                headerTintColor: theme.colors.onSurface,
                headerTitleStyle: {
                    color: theme.colors.onSurface
                },
                headerShadowVisible: false
            }}
        >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="auth" options={{ headerShown: false }} />
        </Stack>
    );
}
