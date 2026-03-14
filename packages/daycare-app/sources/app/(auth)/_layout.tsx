import { Stack } from "expo-router";
import { useUnistyles } from "react-native-unistyles";
import { createAppHeader } from "@/components/AppHeader";

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
            <Stack.Screen name="signin" options={{ headerShown: true, header: createAppHeader() }} />
            <Stack.Screen name="auth" options={{ headerShown: true, header: createAppHeader() }} />
            <Stack.Screen name="invite" options={{ headerShown: true, header: createAppHeader({ title: "Invite" }) }} />
            <Stack.Screen name="verify" options={{ headerShown: true, header: createAppHeader() }} />
        </Stack>
    );
}
