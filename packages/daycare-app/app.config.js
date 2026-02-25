const variant = process.env.APP_ENV || "development";
const name = {
    development: "Daycare (dev)",
    preview: "Daycare (preview)",
    production: "Daycare"
}[variant];
const bundleId = {
    development: "build.daycare.app.dev",
    preview: "build.daycare.app.preview",
    production: "build.daycare.app"
}[variant];

export default {
    expo: {
        name,
        slug: "daycare-app",
        version: "0.0.0",
        runtimeVersion: "1",
        orientation: "default",
        scheme: "daycare",
        userInterfaceStyle: "automatic",
        newArchEnabled: true,
        ios: {
            supportsTablet: true,
            bundleIdentifier: bundleId,
            config: {
                usesNonExemptEncryption: false
            }
        },
        android: {
            edgeToEdgeEnabled: true,
            package: bundleId
        },
        web: {
            bundler: "metro",
            output: "single"
        },
        plugins: [
            [
                "expo-router",
                {
                    root: "./sources/app"
                }
            ],
            "expo-secure-store",
            "expo-system-ui",
            [
                "expo-splash-screen",
                {
                    ios: {
                        backgroundColor: "#fff8f5",
                        dark: {
                            backgroundColor: "#19120d"
                        }
                    },
                    android: {
                        backgroundColor: "#fff8f5",
                        dark: {
                            backgroundColor: "#19120d"
                        }
                    }
                }
            ]
        ],
        experiments: {
            typedRoutes: true
        },
        extra: {
            router: {
                root: "./sources/app"
            },
            app: {
                apiBaseUrl: process.env.EXPO_PUBLIC_DAYCARE_API_BASE_URL
            }
        }
    }
};
