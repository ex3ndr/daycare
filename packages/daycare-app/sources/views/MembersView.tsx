import * as Clipboard from "expo-clipboard";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Badge } from "@/components/Badge";
import { ItemGroup } from "@/components/ItemGroup";
import { ItemList } from "@/components/ItemList";
import { PageHeader } from "@/components/PageHeader";
import { useAuthStore } from "@/modules/auth/authContext";
import { memberKick } from "@/modules/members/memberKick";
import { useMembersStore } from "@/modules/members/membersContext";
import { membersInviteCreate } from "@/modules/members/membersInviteCreate";
import { useWorkspacesStore } from "@/modules/workspaces/workspacesContext";

function memberDisplayName(member: { firstName: string | null; lastName: string | null; nametag: string }): string {
    const label = [member.firstName, member.lastName].filter(Boolean).join(" ").trim();
    return label || member.nametag;
}

function joinedAtFormat(joinedAt: number): string {
    return new Date(joinedAt).toLocaleString();
}

export function MembersView() {
    const { theme } = useUnistyles();
    const baseUrl = useAuthStore((state) => state.baseUrl);
    const token = useAuthStore((state) => state.token);
    const authUserId = useAuthStore((state) => state.userId);
    const activeId = useWorkspacesStore((state) => state.activeId);
    const workspaces = useWorkspacesStore((state) => state.workspaces);
    const fetchMembers = useMembersStore((state) => state.fetch);
    const members = useMembersStore((state) => state.members);
    const loading = useMembersStore((state) => state.loading);
    const error = useMembersStore((state) => state.error);
    const applyKicked = useMembersStore((state) => state.applyKicked);
    const activeWorkspace = useMemo(
        () => workspaces.find((workspace) => workspace.userId === activeId) ?? null,
        [activeId, workspaces]
    );
    const isOwner = members.some((member) => member.isOwner && member.userId === authUserId);

    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteUrl, setInviteUrl] = useState<string | null>(null);
    const [inviteExpiresAt, setInviteExpiresAt] = useState<number | null>(null);
    const [inviteMessage, setInviteMessage] = useState<string | null>(null);
    const [inviteError, setInviteError] = useState<string | null>(null);
    const [kickTarget, setKickTarget] = useState<string | null>(null);
    const [kickReason, setKickReason] = useState("");
    const [kickLoading, setKickLoading] = useState<string | null>(null);
    const [kickError, setKickError] = useState<string | null>(null);

    useEffect(() => {
        if (baseUrl && token && activeWorkspace?.nametag) {
            void fetchMembers(baseUrl, token, activeWorkspace.nametag);
        }
    }, [activeWorkspace?.nametag, baseUrl, fetchMembers, token]);

    const inviteCopy = async () => {
        if (!inviteUrl) {
            return;
        }
        await Clipboard.setStringAsync(inviteUrl);
        setInviteMessage("Invite link copied.");
    };

    const inviteCreate = async () => {
        if (!baseUrl || !token || !activeWorkspace?.nametag || inviteLoading) {
            return;
        }
        setInviteLoading(true);
        setInviteError(null);
        setInviteMessage(null);
        try {
            const result = await membersInviteCreate(baseUrl, token, activeWorkspace.nametag);
            if (!result.ok) {
                throw new Error(result.error);
            }
            setInviteUrl(result.url);
            setInviteExpiresAt(result.expiresAt);
            await Clipboard.setStringAsync(result.url);
            setInviteMessage("Invite link copied.");
        } catch (createError) {
            setInviteError(createError instanceof Error ? createError.message : "Failed to create invite link.");
        } finally {
            setInviteLoading(false);
        }
    };

    const kickSubmit = async (userId: string) => {
        if (!baseUrl || !token || !activeWorkspace?.nametag || kickLoading) {
            return;
        }
        setKickLoading(userId);
        setKickError(null);
        try {
            const result = await memberKick(baseUrl, token, activeWorkspace.nametag, userId, kickReason);
            if (!result.ok) {
                throw new Error(result.error);
            }
            applyKicked(userId);
            setKickTarget(null);
            setKickReason("");
        } catch (kickRequestError) {
            setKickError(kickRequestError instanceof Error ? kickRequestError.message : "Failed to remove member.");
        } finally {
            setKickLoading(null);
        }
    };

    return (
        <View style={{ flex: 1 }}>
            <PageHeader title="Members" icon="people" />
            <ItemList>
                <ItemGroup
                    title="Access"
                    footer={
                        activeWorkspace?.isSelf
                            ? "Shared members are only supported for workspace users, not your personal workspace."
                            : isOwner
                              ? "Invite links stay reusable until they expire. Removing a member revokes access immediately."
                              : "Only workspace owners can create invite links or remove members."
                    }
                >
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                            {activeWorkspace?.isSelf ? "Personal workspace" : "Invite collaborators"}
                        </Text>
                        <Text style={[styles.sectionBody, { color: theme.colors.onSurfaceVariant }]}>
                            {activeWorkspace?.isSelf
                                ? "Switch to a shared workspace to manage members and invite links."
                                : isOwner
                                  ? "Generate a link that teammates can use to join this workspace."
                                  : "You can view who has access to this workspace, but only the owner can manage it."}
                        </Text>
                        {isOwner && !activeWorkspace?.isSelf ? (
                            <>
                                <Pressable
                                    accessibilityRole="button"
                                    disabled={inviteLoading}
                                    onPress={() => void inviteCreate()}
                                    style={({ pressed }) => [
                                        styles.primaryButton,
                                        { backgroundColor: theme.colors.primary },
                                        pressed ? styles.buttonPressed : null,
                                        inviteLoading ? styles.buttonDisabled : null
                                    ]}
                                >
                                    {inviteLoading ? (
                                        <ActivityIndicator color={theme.colors.onPrimary} size="small" />
                                    ) : (
                                        <Text style={[styles.primaryButtonText, { color: theme.colors.onPrimary }]}>
                                            Create Invite Link
                                        </Text>
                                    )}
                                </Pressable>
                                {inviteUrl ? (
                                    <View
                                        style={[
                                            styles.inviteCard,
                                            {
                                                backgroundColor: theme.colors.surfaceContainerLowest,
                                                borderColor: theme.colors.outlineVariant
                                            }
                                        ]}
                                    >
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                            <Text style={[styles.inviteUrl, { color: theme.colors.onSurface }]}>
                                                {inviteUrl}
                                            </Text>
                                        </ScrollView>
                                        <View style={styles.inviteMeta}>
                                            <Text
                                                style={[styles.inviteExpires, { color: theme.colors.onSurfaceVariant }]}
                                            >
                                                Expires {inviteExpiresAt ? joinedAtFormat(inviteExpiresAt) : "soon"}
                                            </Text>
                                            <Pressable onPress={() => void inviteCopy()}>
                                                <Text style={[styles.copyLink, { color: theme.colors.primary }]}>
                                                    Copy
                                                </Text>
                                            </Pressable>
                                        </View>
                                    </View>
                                ) : null}
                            </>
                        ) : null}
                        {inviteMessage ? (
                            <Text style={[styles.feedback, { color: theme.colors.primary }]}>{inviteMessage}</Text>
                        ) : null}
                        {inviteError ? (
                            <Text style={[styles.feedback, { color: theme.colors.error }]}>{inviteError}</Text>
                        ) : null}
                    </View>
                </ItemGroup>

                <ItemGroup title="Members">
                    {loading && members.length === 0 ? (
                        <View style={styles.centered}>
                            <ActivityIndicator color={theme.colors.primary} size="small" />
                        </View>
                    ) : null}
                    {error && !loading ? (
                        <View style={styles.section}>
                            <Text style={[styles.feedback, { color: theme.colors.error }]}>{error}</Text>
                        </View>
                    ) : null}
                    {!loading && !error && members.length === 0 ? (
                        <View style={styles.section}>
                            <Text style={[styles.sectionBody, { color: theme.colors.onSurfaceVariant }]}>
                                No active members yet.
                            </Text>
                        </View>
                    ) : null}
                    {members.map((member) => (
                        <View key={member.userId} style={styles.memberCard}>
                            <View style={styles.memberRow}>
                                <View style={styles.memberText}>
                                    <Text style={[styles.memberName, { color: theme.colors.onSurface }]}>
                                        {memberDisplayName(member)}
                                    </Text>
                                    <Text style={[styles.memberMetaText, { color: theme.colors.onSurfaceVariant }]}>
                                        @{member.nametag} · Joined {joinedAtFormat(member.joinedAt)}
                                    </Text>
                                </View>
                                <View style={styles.memberActions}>
                                    {member.isOwner ? <Badge color={theme.colors.primary}>Owner</Badge> : null}
                                    {isOwner && !member.isOwner ? (
                                        <Pressable
                                            onPress={() => {
                                                setKickTarget(member.userId);
                                                setKickReason("");
                                                setKickError(null);
                                            }}
                                            style={[
                                                styles.kickButton,
                                                {
                                                    borderColor: theme.colors.error,
                                                    backgroundColor: `${theme.colors.error}14`
                                                }
                                            ]}
                                        >
                                            <Text style={[styles.kickButtonText, { color: theme.colors.error }]}>
                                                Kick
                                            </Text>
                                        </Pressable>
                                    ) : null}
                                </View>
                            </View>
                            {kickTarget === member.userId ? (
                                <View style={styles.kickComposer}>
                                    <TextInput
                                        onChangeText={setKickReason}
                                        placeholder="Reason for removal"
                                        placeholderTextColor={theme.colors.onSurfaceVariant}
                                        style={[
                                            styles.kickInput,
                                            {
                                                color: theme.colors.onSurface,
                                                borderColor: theme.colors.outlineVariant,
                                                backgroundColor: theme.colors.surfaceContainerLowest
                                            }
                                        ]}
                                        value={kickReason}
                                    />
                                    <View style={styles.kickComposerActions}>
                                        <Pressable
                                            onPress={() => {
                                                setKickTarget(null);
                                                setKickReason("");
                                                setKickError(null);
                                            }}
                                            style={[
                                                styles.secondaryButton,
                                                {
                                                    borderColor: theme.colors.outlineVariant,
                                                    backgroundColor: theme.colors.surfaceContainerLowest
                                                }
                                            ]}
                                        >
                                            <Text
                                                style={[styles.secondaryButtonText, { color: theme.colors.onSurface }]}
                                            >
                                                Cancel
                                            </Text>
                                        </Pressable>
                                        <Pressable
                                            disabled={kickLoading === member.userId}
                                            onPress={() => void kickSubmit(member.userId)}
                                            style={({ pressed }) => [
                                                styles.primaryButtonCompact,
                                                { backgroundColor: theme.colors.error },
                                                pressed ? styles.buttonPressed : null,
                                                kickLoading === member.userId ? styles.buttonDisabled : null
                                            ]}
                                        >
                                            {kickLoading === member.userId ? (
                                                <ActivityIndicator color={theme.colors.onError} size="small" />
                                            ) : (
                                                <Text
                                                    style={[styles.primaryButtonText, { color: theme.colors.onError }]}
                                                >
                                                    Confirm Remove
                                                </Text>
                                            )}
                                        </Pressable>
                                    </View>
                                    {kickError ? (
                                        <Text style={[styles.feedback, { color: theme.colors.error }]}>
                                            {kickError}
                                        </Text>
                                    ) : null}
                                </View>
                            ) : null}
                        </View>
                    ))}
                </ItemGroup>
            </ItemList>
        </View>
    );
}

const styles = StyleSheet.create({
    section: {
        padding: 16,
        gap: 12
    },
    sectionTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15
    },
    sectionBody: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14,
        lineHeight: 20
    },
    centered: {
        padding: 24,
        alignItems: "center",
        justifyContent: "center"
    },
    feedback: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 18
    },
    primaryButton: {
        minHeight: 42,
        paddingHorizontal: 16,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        alignSelf: "flex-start"
    },
    primaryButtonCompact: {
        minHeight: 40,
        paddingHorizontal: 14,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center"
    },
    primaryButtonText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 14
    },
    secondaryButton: {
        minHeight: 40,
        paddingHorizontal: 14,
        borderRadius: 10,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center"
    },
    secondaryButtonText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 14
    },
    buttonPressed: {
        opacity: 0.85
    },
    buttonDisabled: {
        opacity: 0.6
    },
    inviteCard: {
        borderWidth: 1,
        borderRadius: 14,
        padding: 12,
        gap: 10
    },
    inviteUrl: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 12
    },
    inviteMeta: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12
    },
    inviteExpires: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12
    },
    copyLink: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 13
    },
    memberCard: {
        borderTopWidth: 1,
        borderTopColor: "#00000010"
    },
    memberRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: 16
    },
    memberText: {
        flex: 1,
        gap: 4
    },
    memberName: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15
    },
    memberMetaText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 18
    },
    memberActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    kickButton: {
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6
    },
    kickButtonText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 12
    },
    kickComposer: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        gap: 10
    },
    kickInput: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14
    },
    kickComposerActions: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 10
    }
});
