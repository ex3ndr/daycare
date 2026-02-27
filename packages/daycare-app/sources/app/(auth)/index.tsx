import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { SinglePanelLayout } from "@/components/layout/SinglePanelLayout";

export default React.memo(function Welcome() {
    const { theme } = useUnistyles();

    return (
        <SinglePanelLayout>
            <View style={styles.content}>
                <View style={[styles.heroIcon, { backgroundColor: theme.colors.primaryContainer }]}>
                    <Ionicons name="sparkles" size={48} color={theme.colors.onPrimaryContainer} />
                </View>
                <Text style={[styles.title, { color: theme.colors.onSurface }]}>Welcome to Daycare</Text>
                <Text style={[styles.slogan, { color: theme.colors.onSurfaceVariant }]}>
                    The AI-powered assistant for your software team.
                </Text>

                <View style={styles.featuresList}>
                    <FeatureItem
                        icon="chatbubbles-outline"
                        title="Collaborative Chat"
                        description="Engage with specialized AI agents tailored for your workflows."
                        theme={theme}
                    />
                    <FeatureItem
                        icon="folder-open-outline"
                        title="Context Aware"
                        description="Daycare understands your codebase and project context natively."
                        theme={theme}
                    />
                    <FeatureItem
                        icon="flash-outline"
                        title="Lightning Fast"
                        description="Get answers and generate code with zero latency impact."
                        theme={theme}
                    />
                </View>

                <View style={[styles.instructionCard, { backgroundColor: theme.colors.surfaceContainerHighest }]}>
                    <Ionicons
                        name="mail-unread-outline"
                        size={24}
                        color={theme.colors.onSurface}
                        style={styles.instructionIcon}
                    />
                    <View style={styles.instructionTextContainer}>
                        <Text style={[styles.instructionTitle, { color: theme.colors.onSurface }]}>Ready to join?</Text>
                        <Text style={[styles.instructionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                            Check your email or team chat for your magic login link to access your workspace.
                        </Text>
                    </View>
                </View>
            </View>
        </SinglePanelLayout>
    );
});

type FeatureItemProps = {
    icon: React.ComponentProps<typeof Ionicons>["name"];
    title: string;
    description: string;
    theme: {
        colors: {
            primary: string;
            onSurface: string;
            onSurfaceVariant: string;
            surfaceContainerHigh: string;
        };
    };
};

function FeatureItem({ icon, title, description, theme }: FeatureItemProps) {
    return (
        <View style={styles.featureItem}>
            <View style={[styles.featureIconContainer, { backgroundColor: theme.colors.surfaceContainerHigh }]}>
                <Ionicons name={icon} size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.featureTextContainer}>
                <Text style={[styles.featureTitle, { color: theme.colors.onSurface }]}>{title}</Text>
                <Text style={[styles.featureDescription, { color: theme.colors.onSurfaceVariant }]}>{description}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    content: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 32,
        width: "100%"
    },
    heroIcon: {
        width: 88,
        height: 88,
        borderRadius: 44,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 24,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4
        },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5
    },
    title: {
        fontSize: 36,
        fontWeight: "800",
        marginBottom: 12,
        textAlign: "center",
        letterSpacing: -0.5
    },
    slogan: {
        fontSize: 18,
        textAlign: "center",
        marginBottom: 48,
        lineHeight: 26,
        maxWidth: 320
    },
    featuresList: {
        width: "100%",
        maxWidth: 440,
        gap: 24,
        marginBottom: 48
    },
    featureItem: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 16
    },
    featureIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center"
    },
    featureTextContainer: {
        flex: 1
    },
    featureTitle: {
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 4
    },
    featureDescription: {
        fontSize: 14,
        lineHeight: 20
    },
    instructionCard: {
        flexDirection: "row",
        padding: 24,
        borderRadius: 20,
        width: "100%",
        maxWidth: 440,
        alignItems: "center",
        gap: 16
    },
    instructionIcon: {
        opacity: 0.8
    },
    instructionTextContainer: {
        flex: 1
    },
    instructionTitle: {
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 4
    },
    instructionSubtitle: {
        fontSize: 14,
        lineHeight: 20
    }
});
