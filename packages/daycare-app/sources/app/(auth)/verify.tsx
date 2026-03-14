import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import {
    ActivityIndicator,
    InteractionManager,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { authEmailVerify } from "@/modules/auth/authApi";
import { useAuthStore } from "@/modules/auth/authContext";
import { authDefaultsResolve } from "@/modules/auth/authDefaultsResolve";
import { authRedirectTake } from "@/modules/auth/authRedirectStorage";

/**
 * Code verification screen shown after a sign-in code is sent.
 * User enters the 6-digit code from their email to complete sign-in.
 */
export default function VerifyScreen() {
    const { theme } = useUnistyles();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { email } = useLocalSearchParams<{ email?: string }>();
    const defaults = React.useMemo(() => authDefaultsResolve(), []);
    const login = useAuthStore((state) => state.login);

    const [code, setCode] = React.useState("");
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const codeInputRef = React.useRef<TextInput>(null);

    // Focus code input after transition completes
    React.useEffect(() => {
        const handle = InteractionManager.runAfterInteractions(() => {
            codeInputRef.current?.focus();
        });
        return () => handle.cancel();
    }, []);

    const verifyCode = React.useCallback(async () => {
        const trimmedCode = code.trim();
        if (!trimmedCode || !email || submitting) {
            return;
        }

        setSubmitting(true);
        setError(null);
        try {
            const result = await authEmailVerify(defaults.backendUrl, email, trimmedCode);
            if (!result.ok) {
                throw new Error(result.error);
            }
            await login(defaults.backendUrl, result.token);
            router.replace((authRedirectTake() ?? "/(app)") as never);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Verification failed. Please try again.");
        } finally {
            setSubmitting(false);
        }
    }, [code, defaults.backendUrl, email, login, router, submitting]);

    return (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <ScrollView
                style={styles.flex}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.top}>
                    <View style={[styles.iconContainer, { backgroundColor: theme.colors.primaryContainer }]}>
                        <Ionicons name="mail-outline" size={42} color={theme.colors.onPrimaryContainer} />
                    </View>
                    <Text style={[styles.title, { color: theme.colors.onSurface }]}>Check your email</Text>
                    <Text style={[styles.message, { color: theme.colors.onSurfaceVariant }]}>
                        We sent a 6-digit code to{" "}
                        <Text style={[styles.email, { color: theme.colors.onSurface }]}>{email ?? "your email"}</Text>
                    </Text>
                </View>
                <View style={styles.form}>
                    <TextInput
                        ref={codeInputRef}
                        autoCapitalize="none"
                        autoComplete="one-time-code"
                        autoCorrect={false}
                        keyboardType="number-pad"
                        maxLength={6}
                        onChangeText={setCode}
                        onSubmitEditing={() => void verifyCode()}
                        placeholder="000000"
                        placeholderTextColor={theme.colors.onSurfaceVariant}
                        returnKeyType="go"
                        style={[
                            styles.input,
                            {
                                color: theme.colors.onSurface,
                                backgroundColor: theme.colors.surfaceContainerHighest,
                                borderColor: theme.colors.outlineVariant
                            }
                        ]}
                        textContentType="oneTimeCode"
                        value={code}
                    />
                    <Pressable
                        accessibilityRole="button"
                        disabled={submitting || code.trim().length === 0}
                        onPress={() => void verifyCode()}
                        style={({ pressed }) => [
                            styles.button,
                            { backgroundColor: theme.colors.primary },
                            pressed && !submitting ? styles.buttonPressed : null,
                            submitting || code.trim().length === 0 ? styles.buttonDisabled : null
                        ]}
                    >
                        {submitting ? (
                            <ActivityIndicator size="small" color={theme.colors.onPrimary} />
                        ) : (
                            <Text style={[styles.buttonText, { color: theme.colors.onPrimary }]}>Verify</Text>
                        )}
                    </Pressable>
                    {error ? <Text style={[styles.feedback, { color: theme.colors.error }]}>{error}</Text> : null}
                    <Text style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
                        Didn't receive it? Check your spam folder or try again.
                    </Text>
                    <Pressable
                        accessibilityRole="button"
                        onPress={() => router.back()}
                        style={({ pressed }) => [
                            styles.secondaryButton,
                            { backgroundColor: theme.colors.surfaceContainerHighest },
                            pressed && styles.buttonPressed
                        ]}
                    >
                        <Text style={[styles.secondaryButtonText, { color: theme.colors.onSurface }]}>
                            Try another email
                        </Text>
                    </Pressable>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    flex: {
        flex: 1
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24
    },
    top: {
        paddingTop: 24,
        alignItems: "center",
        gap: 12
    },
    iconContainer: {
        width: 88,
        height: 88,
        borderRadius: 44,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 8
    },
    title: {
        fontFamily: "IBMPlexSans-Bold",
        fontSize: 28,
        textAlign: "center"
    },
    message: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 16,
        lineHeight: 24,
        textAlign: "center",
        maxWidth: 340
    },
    email: {
        fontFamily: "IBMPlexSans-SemiBold"
    },
    form: {
        paddingTop: 32,
        gap: 16
    },
    input: {
        width: "100%",
        height: 48,
        borderRadius: 14,
        borderWidth: 1,
        paddingHorizontal: 14,
        fontSize: 24,
        fontFamily: "IBMPlexSans-SemiBold",
        textAlign: "center",
        letterSpacing: 8
    },
    button: {
        width: "100%",
        height: 48,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center"
    },
    buttonText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15
    },
    buttonPressed: {
        opacity: 0.92
    },
    buttonDisabled: {
        opacity: 0.7
    },
    feedback: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14,
        lineHeight: 20,
        textAlign: "center"
    },
    hint: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14,
        lineHeight: 20,
        textAlign: "center"
    },
    secondaryButton: {
        width: "100%",
        height: 48,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center"
    },
    secondaryButtonText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15
    }
});
