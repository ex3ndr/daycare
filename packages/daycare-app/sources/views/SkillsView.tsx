import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Item } from "@/components/Item";
import { ItemGroup } from "@/components/ItemGroup";
import { ItemList } from "@/components/ItemList";
import { PageHeader } from "@/components/PageHeader";
import { useAuthStore } from "@/modules/auth/authContext";
import { useSkillsStore } from "@/modules/skills/skillsContext";
import { useWorkspace } from "@/modules/workspaces/workspaceProvider";

/** Readable label for a skill source. */
function sourceLabel(source: string): string {
    if (source === "core" || source === "builtin") return "core";
    if (source === "config") return "config";
    if (source === "plugin") return "plugin";
    if (source === "user") return "user";
    if (source === "agents") return "agents";
    return source;
}

export function SkillsView() {
    const { theme } = useUnistyles();

    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);
    const { workspaceId } = useWorkspace();

    const skills = useSkillsStore((s) => s.skills);
    const loading = useSkillsStore((s) => s.loading);
    const error = useSkillsStore((s) => s.error);
    const fetchSkills = useSkillsStore((s) => s.fetch);

    useEffect(() => {
        if (baseUrl && token) {
            void fetchSkills(baseUrl, token, workspaceId);
        }
    }, [baseUrl, token, workspaceId, fetchSkills]);

    if (loading && skills.length === 0) {
        return (
            <View style={{ flex: 1 }}>
                <View style={[styles.centered, { flex: 1 }]}>
                    <ActivityIndicator color={theme.colors.primary} />
                </View>
            </View>
        );
    }

    if (error && skills.length === 0) {
        return (
            <View style={{ flex: 1 }}>
                <View style={[styles.centered, { flex: 1 }]}>
                    <Text style={[styles.stateText, { color: theme.colors.error }]}>{error}</Text>
                </View>
            </View>
        );
    }

    if (skills.length === 0) {
        return (
            <View style={{ flex: 1 }}>
                <View style={[styles.centered, { flex: 1 }]}>
                    <Text style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>No skills</Text>
                </View>
            </View>
        );
    }

    const sorted = [...skills].sort((a, b) => a.name.localeCompare(b.name));

    return (
        <View style={{ flex: 1 }}>
            <PageHeader title="Skills" icon="zap" />
            <ItemList>
                <ItemGroup title={`${skills.length} skills`}>
                    {sorted.map((skill, index) => (
                        <Item
                            key={skill.id}
                            title={skill.name}
                            subtitle={skill.description ?? undefined}
                            detail={sourceLabel(skill.source)}
                            showChevron={false}
                            showDivider={index < sorted.length - 1}
                        />
                    ))}
                </ItemGroup>
            </ItemList>
        </View>
    );
}

const styles = StyleSheet.create({
    centered: {
        alignItems: "center",
        justifyContent: "center",
        padding: 32
    },
    stateText: {
        fontSize: 14,
        fontFamily: "IBMPlexSans-Regular",
        textAlign: "center"
    }
});
