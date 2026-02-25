import * as React from "react";
import { Pressable, Modal as RNModal, Text, View } from "react-native";
import { useUnistyles } from "react-native-unistyles";

type AlertButton = {
    text: string;
    style?: "default" | "cancel" | "destructive";
    onPress?: () => void;
};

type AlertConfig = {
    title: string;
    message?: string;
    buttons?: AlertButton[];
};

// Global alert state
let globalAlertHandler: ((config: AlertConfig) => Promise<void>) | null = null;

export function setGlobalAlertHandler(handler: (config: AlertConfig) => Promise<void>) {
    globalAlertHandler = handler;
}

// Promise-based alert function
export function alert(title: string, message?: string, buttons?: AlertButton[]): Promise<void> {
    if (!globalAlertHandler) {
        console.error("Alert handler not initialized. Make sure AlertProvider is rendered.");
        return Promise.resolve();
    }
    return globalAlertHandler({ title, message, buttons });
}

// Alert Provider Component
type AlertProviderProps = {
    children: React.ReactNode;
};

export const AlertProvider = React.memo<AlertProviderProps>((props) => {
    const { theme } = useUnistyles();
    const [alertConfig, setAlertConfig] = React.useState<AlertConfig | null>(null);
    const resolveRef = React.useRef<(() => void) | null>(null);

    React.useEffect(() => {
        setGlobalAlertHandler((config: AlertConfig) => {
            return new Promise<void>((resolve) => {
                resolveRef.current = resolve;
                setAlertConfig(config);
            });
        });

        return () => {
            setGlobalAlertHandler(() => Promise.resolve());
        };
    }, []);

    const handleButtonPress = React.useCallback((button: AlertButton) => {
        setAlertConfig(null);
        button.onPress?.();
        resolveRef.current?.();
        resolveRef.current = null;
    }, []);

    const defaultButtons: AlertButton[] = alertConfig?.buttons || [{ text: "OK", style: "default" }];

    return (
        <>
            {props.children}
            {alertConfig && (
                <RNModal
                    visible={true}
                    transparent
                    animationType="fade"
                    onRequestClose={() => {
                        const cancelButton = defaultButtons.find((b) => b.style === "cancel");
                        if (cancelButton) {
                            handleButtonPress(cancelButton);
                        }
                    }}
                >
                    <View
                        style={{
                            flex: 1,
                            backgroundColor: `${theme.colors.scrim}80`,
                            justifyContent: "center",
                            alignItems: "center",
                            padding: 20
                        }}
                    >
                        <View
                            style={{
                                backgroundColor: theme.colors.surface,
                                borderRadius: 12,
                                padding: 20,
                                minWidth: 300,
                                maxWidth: 400,
                                shadowColor: theme.colors.shadow,
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.3,
                                shadowRadius: 8
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 18,
                                    fontWeight: "600",
                                    marginBottom: alertConfig.message ? 12 : 0,
                                    color: theme.colors.onSurface,
                                    fontFamily: "IBMPlexSans-SemiBold"
                                }}
                            >
                                {alertConfig.title}
                            </Text>
                            {alertConfig.message && (
                                <Text
                                    style={{
                                        fontSize: 16,
                                        color: theme.colors.onSurfaceVariant,
                                        marginBottom: 20,
                                        lineHeight: 22,
                                        fontFamily: "IBMPlexSans-Regular"
                                    }}
                                >
                                    {alertConfig.message}
                                </Text>
                            )}
                            <View
                                style={{
                                    flexDirection: "row",
                                    gap: 12,
                                    justifyContent: "flex-end",
                                    marginTop: 20
                                }}
                            >
                                {defaultButtons.map((button) => (
                                    <Pressable
                                        key={`${button.text}:${button.style ?? "default"}`}
                                        onPress={() => handleButtonPress(button)}
                                        style={({ pressed }) => ({
                                            paddingVertical: 10,
                                            paddingHorizontal: 20,
                                            borderRadius: 8,
                                            backgroundColor:
                                                button.style === "destructive"
                                                    ? theme.colors.error
                                                    : button.style === "cancel"
                                                      ? theme.colors.surfaceContainerHighest
                                                      : theme.colors.primary,
                                            opacity: pressed ? 0.7 : 1
                                        })}
                                    >
                                        <Text
                                            style={{
                                                fontSize: 16,
                                                fontWeight: "600",
                                                fontFamily: "IBMPlexSans-SemiBold",
                                                color:
                                                    button.style === "cancel"
                                                        ? theme.colors.onSurface
                                                        : button.style === "destructive"
                                                          ? theme.colors.onError
                                                          : theme.colors.onPrimary
                                            }}
                                        >
                                            {button.text}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>
                    </View>
                </RNModal>
            )}
        </>
    );
});

// Export Alert-compatible API
export const Alert = {
    alert
};
