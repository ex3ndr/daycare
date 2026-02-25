import { Stack } from "expo-router";
import { useUnistyles } from "react-native-unistyles";

export default function AppLayout() {
    const { theme } = useUnistyles();

    return (
        <Stack
            screenOptions={{
                headerShown: true,
                headerLargeTitle: false,
                headerStyle: {
                    backgroundColor: theme.colors.surface
                },
                headerTintColor: theme.colors.onSurface,
                headerTitleStyle: {
                    color: theme.colors.onSurface
                },
                headerShadowVisible: false,
                contentStyle: {
                    backgroundColor: theme.colors.surface
                }
            }}
        >
            <Stack.Screen
                name="index"
                options={{
                    title: "Daycare",
                    headerShown: false,
                    contentStyle: {
                        backgroundColor: theme.colors.surface
                    }
                }}
            />
        </Stack>
    );
}
