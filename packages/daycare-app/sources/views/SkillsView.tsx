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

/** Whether a skill source is user-created (shown first) vs system (shown last). */
function sourceIsUser(source: string): boolean {
    return source === "user" || source === "agents" || source === "plugin";
}

function categoryLabel(category: string | null): string {
    if (!category) {
        return "Uncategorized";
    }
    return category
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
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

    // Split skills into user-created (top) and system (bottom)
    const userSkills = skills.filter((s) => sourceIsUser(s.source));
    const systemSkills = skills.filter((s) => !sourceIsUser(s.source));

    const groupByCategory = (items: typeof skills) => {
        const map = new Map<string | null, typeof skills>();
        for (const skill of items) {
            const key = skill.category ?? null;
            const current = map.get(key) ?? [];
            current.push(skill);
            map.set(key, current);
        }
        return Array.from(map.entries()).sort(([a], [b]) => {
            if (a && b) return a.localeCompare(b);
            if (a) return -1;
            if (b) return 1;
            return 0;
        });
    };

    const userGroups = groupByCategory(userSkills);
    const systemGroups = groupByCategory(systemSkills);

    const renderGroups = (groups: Array<[string | null, typeof skills]>) =>
        groups.map(([category, group]) => {
            const sorted = [...group].sort((a, b) => a.name.localeCompare(b.name));
            return (
                <ItemGroup key={category ?? "uncategorized"} title={`${categoryLabel(category)} (${sorted.length})`}>
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
            );
        });

    return (
        <View style={{ flex: 1 }}>
            <PageHeader title="Skills" icon="zap" />
            <ItemList>
                {renderGroups(userGroups)}
                {renderGroups(systemGroups)}
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
