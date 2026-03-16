const variant = process.env.APP_ENV || "development";
const defaultBackendUrl =
    process.env.EXPO_PUBLIC_DAYCARE_DEFAULT_BACKEND_URL ||
    process.env.DAYCARE_APP_DEFAULT_BACKEND_URL ||
    "https://api.daycare.dev";
const defaultTelegramInstanceId =
    process.env.EXPO_PUBLIC_DAYCARE_DEFAULT_TELEGRAM_INSTANCE_ID ||
    process.env.DAYCARE_APP_DEFAULT_TELEGRAM_INSTANCE_ID ||
    "telegram";
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
        icon: "./sources/assets/images/icon.png",
        scheme: "daycare",
        userInterfaceStyle: "automatic",
        newArchEnabled: true,
        ios: {
            supportsTablet: true,
            bundleIdentifier: bundleId,
            config: {
                usesNonExemptEncryption: false
            },
            infoPlist: {
                NSMicrophoneUsageDescription: "This app needs microphone access for voice conversations with Daycare."
            }
        },
        android: {
            adaptiveIcon: {
                foregroundImage: "./sources/assets/images/icon-adaptive.png",
                monochromeImage: "./sources/assets/images/icon-monochrome.png",
                backgroundColor: "#19120d"
            },
            package: bundleId,
            permissions: ["RECORD_AUDIO"]
        },
        web: {
            bundler: "metro",
            output: "single",
            favicon: "./sources/assets/images/favicon.png"
        },
        plugins: [
            [
                "expo-router",
                {
                    root: "./sources/app"
                }
            ],
            "expo-image",
            "expo-secure-store",
            "expo-system-ui",
            "@livekit/react-native-expo-plugin",
            "@config-plugins/react-native-webrtc",
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
                        image: "./sources/assets/images/splash-android-light.png",
                        backgroundColor: "#fff8f5",
                        dark: {
                            image: "./sources/assets/images/splash-android-dark.png",
                            backgroundColor: "#19120d"
                        }
                    }
                }
            ]
        ],
        experiments: {
            typedRoutes: true,
            useExperimentalModals: true
        },
        extra: {
            defaultBackendUrl,
            defaultTelegramInstanceId,
            router: {
                root: "./sources/app"
            }
        }
    }
};
