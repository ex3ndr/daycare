import { useRouter } from "expo-router";
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
import { authEmailRequest } from "@/modules/auth/authApi";
import { authDefaultsResolve } from "@/modules/auth/authDefaultsResolve";

export default React.memo(function SignIn() {
    const { theme } = useUnistyles();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const defaults = React.useMemo(() => authDefaultsResolve(), []);
    const [email, setEmail] = React.useState("");
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const emailInputRef = React.useRef<TextInput>(null);

    // Focus input after all animations/interactions complete
    React.useEffect(() => {
        const handle = InteractionManager.runAfterInteractions(() => {
            emailInputRef.current?.focus();
        });
        return () => handle.cancel();
    }, []);

    const requestMagicLink = React.useCallback(async () => {
        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail || submitting) {
            return;
        }

        setSubmitting(true);
        setError(null);
        try {
            const result = await authEmailRequest(defaults.backendUrl, normalizedEmail);
            if (!result.ok) {
                throw new Error(result.error);
            }
            router.push({ pathname: "/verify", params: { email: normalizedEmail } });
            return;
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Failed to send sign-in code.");
        } finally {
            setSubmitting(false);
        }
    }, [defaults.backendUrl, email, router, submitting]);

    return (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <ScrollView
                style={styles.flex}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.top}>
                    <Text style={[styles.title, { color: theme.colors.onSurface }]}>Sign in with email</Text>
                    <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                        Enter your email and we'll send a sign-in code.
                    </Text>
                </View>
                <View style={styles.form}>
                    <TextInput
                        ref={emailInputRef}
                        autoCapitalize="none"
                        autoComplete="email"
                        autoCorrect={false}
                        keyboardType="email-address"
                        onChangeText={setEmail}
                        onSubmitEditing={() => void requestMagicLink()}
                        placeholder="you@company.com"
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
                        value={email}
                    />
                    <Pressable
                        accessibilityRole="button"
                        disabled={submitting || email.trim().length === 0}
                        onPress={() => void requestMagicLink()}
                        style={({ pressed }) => [
                            styles.button,
                            { backgroundColor: theme.colors.primary },
                            pressed && !submitting ? styles.buttonPressed : null,
                            submitting || email.trim().length === 0 ? styles.buttonDisabled : null
                        ]}
                    >
                        {submitting ? (
                            <ActivityIndicator size="small" color={theme.colors.onPrimary} />
                        ) : (
                            <Text style={[styles.buttonText, { color: theme.colors.onPrimary }]}>Continue</Text>
                        )}
                    </Pressable>
                    {error ? <Text style={[styles.feedback, { color: theme.colors.error }]}>{error}</Text> : null}
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
});

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
        gap: 8
    },
    title: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 24
    },
    subtitle: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 15,
        lineHeight: 22
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
        fontSize: 16
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
        lineHeight: 20
    }
});
