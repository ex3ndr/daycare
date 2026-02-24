"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ChevronDown,
    ChevronRight,
    FileText,
    Globe,
    MessageSquare,
    Pencil,
    Plus,
    RefreshCw,
    Save,
    Trash2,
    User,
    X
} from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    createSystemPrompt,
    deleteSystemPrompt,
    fetchSystemPrompts,
    fetchUsers,
    updateSystemPrompt,
    type SystemPrompt,
    type SystemPromptCondition,
    type SystemPromptCreateInput,
    type SystemPromptKind,
    type SystemPromptScope,
    type UserSummary
} from "@/lib/engine-client";

type EditingPrompt = {
    scope: SystemPromptScope;
    userId: string | null;
    kind: SystemPromptKind;
    condition: SystemPromptCondition | null;
    prompt: string;
    enabled: boolean;
};

const defaultEdit: EditingPrompt = {
    scope: "global",
    userId: null,
    kind: "system",
    condition: null,
    prompt: "",
    enabled: true
};

export default function PromptsPage() {
    const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
    const [users, setUsers] = useState<UserSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    // Create form state
    const [showCreate, setShowCreate] = useState(false);
    const [createForm, setCreateForm] = useState<EditingPrompt>({ ...defaultEdit });
    const [saving, setSaving] = useState(false);

    // Inline edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<EditingPrompt>({ ...defaultEdit });

    // Delete confirmation
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [promptData, userData] = await Promise.all([fetchSystemPrompts(), fetchUsers()]);
            setPrompts(promptData);
            setUsers(userData);
            setLastUpdated(new Date());
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load prompts");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const systemPrompts = useMemo(() => prompts.filter((p) => p.kind === "system"), [prompts]);
    const firstMessagePrompts = useMemo(() => prompts.filter((p) => p.kind === "first_message"), [prompts]);

    const userMap = useMemo(() => {
        const map = new Map<string, UserSummary>();
        for (const u of users) {
            map.set(u.id, u);
        }
        return map;
    }, [users]);

    const handleCreate = async () => {
        setSaving(true);
        try {
            const input: SystemPromptCreateInput = {
                scope: createForm.scope,
                kind: createForm.kind,
                prompt: createForm.prompt,
                enabled: createForm.enabled,
                userId: createForm.scope === "user" ? createForm.userId : null,
                condition: createForm.condition ?? undefined
            };
            await createSystemPrompt(input);
            setShowCreate(false);
            setCreateForm({ ...defaultEdit });
            await refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create prompt");
        } finally {
            setSaving(false);
        }
    };

    const startEdit = (prompt: SystemPrompt) => {
        setEditingId(prompt.id);
        setEditForm({
            scope: prompt.scope,
            userId: prompt.userId,
            kind: prompt.kind,
            condition: prompt.condition,
            prompt: prompt.prompt,
            enabled: prompt.enabled
        });
    };

    const handleUpdate = async () => {
        if (!editingId) return;
        setSaving(true);
        try {
            await updateSystemPrompt(editingId, {
                scope: editForm.scope,
                kind: editForm.kind,
                prompt: editForm.prompt,
                enabled: editForm.enabled,
                userId: editForm.scope === "user" ? editForm.userId : null,
                condition: editForm.condition ?? undefined
            });
            setEditingId(null);
            await refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to update prompt");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        setSaving(true);
        try {
            await deleteSystemPrompt(id);
            setDeletingId(null);
            await refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to delete prompt");
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (prompt: SystemPrompt) => {
        try {
            await updateSystemPrompt(prompt.id, { enabled: !prompt.enabled });
            await refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to toggle prompt");
        }
    };

    return (
        <DashboardShell
            title="System Prompts"
            subtitle="Configure prompts appended to the system message or prepended to the first user message."
            toolbar={
                <>
                    <Button
                        variant="outline"
                        onClick={() => {
                            setShowCreate(true);
                            setCreateForm({ ...defaultEdit });
                        }}
                        className="gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        New prompt
                    </Button>
                    <Button onClick={() => void refresh()} disabled={loading} className="gap-2">
                        <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                        Refresh
                    </Button>
                </>
            }
            status={
                <>
                    <span>
                        {lastUpdated ? `Last synced ${lastUpdated.toLocaleTimeString()}` : "Awaiting first sync"}
                    </span>
                    {error ? (
                        <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-destructive">
                            {error}
                        </span>
                    ) : (
                        <span>{prompts.length} prompts configured</span>
                    )}
                </>
            }
        >
            <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
                {/* Stats */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <StatCard
                        label="System prompts"
                        value={systemPrompts.length}
                        detail="Appended to system message"
                        icon={<FileText className="h-5 w-5" />}
                        tone="primary"
                    />
                    <StatCard
                        label="First message prompts"
                        value={firstMessagePrompts.length}
                        detail="Prepended to first user message"
                        icon={<MessageSquare className="h-5 w-5" />}
                        tone="amber"
                    />
                    <StatCard
                        label="Active"
                        value={prompts.filter((p) => p.enabled).length}
                        detail={`${prompts.filter((p) => !p.enabled).length} disabled`}
                        icon={<Globe className="h-5 w-5" />}
                        tone="emerald"
                    />
                </div>

                {/* Create form */}
                {showCreate && (
                    <PromptForm
                        title="Create new prompt"
                        form={createForm}
                        onChange={setCreateForm}
                        users={users}
                        onSave={handleCreate}
                        onCancel={() => setShowCreate(false)}
                        saving={saving}
                    />
                )}

                {/* Prompt list */}
                {prompts.length === 0 && !showCreate ? (
                    <EmptyState
                        icon={<FileText className="h-8 w-8" />}
                        label="No system prompts configured"
                    />
                ) : (
                    <div className="grid gap-4">
                        {prompts.map((prompt) => (
                            <PromptCard
                                key={prompt.id}
                                prompt={prompt}
                                userMap={userMap}
                                isEditing={editingId === prompt.id}
                                editForm={editForm}
                                onEditFormChange={setEditForm}
                                users={users}
                                onStartEdit={() => startEdit(prompt)}
                                onCancelEdit={() => setEditingId(null)}
                                onSave={handleUpdate}
                                onDelete={() =>
                                    deletingId === prompt.id
                                        ? void handleDelete(prompt.id)
                                        : setDeletingId(prompt.id)
                                }
                                onCancelDelete={() => setDeletingId(null)}
                                isConfirmingDelete={deletingId === prompt.id}
                                onToggle={() => void handleToggle(prompt)}
                                saving={saving}
                            />
                        ))}
                    </div>
                )}
            </div>
        </DashboardShell>
    );
}

/* -- Stat card ---------------------------------------------------------- */

type StatCardProps = {
    label: string;
    value: number;
    detail: string;
    icon: React.ReactNode;
    tone: "primary" | "amber" | "emerald";
};

const toneMap: Record<StatCardProps["tone"], { bg: string; text: string; gradient: string }> = {
    primary: { bg: "bg-primary/10", text: "text-primary", gradient: "from-primary/10 via-card to-card" },
    amber: {
        bg: "bg-amber-500/10",
        text: "text-amber-600 dark:text-amber-400",
        gradient: "from-amber-500/10 via-card to-card"
    },
    emerald: {
        bg: "bg-emerald-500/10",
        text: "text-emerald-600 dark:text-emerald-400",
        gradient: "from-emerald-500/10 via-card to-card"
    }
};

function StatCard({ label, value, detail, icon, tone }: StatCardProps) {
    const t = toneMap[tone];
    return (
        <Card className="relative overflow-hidden">
            <div className={`absolute inset-0 bg-gradient-to-br ${t.gradient}`} />
            <CardHeader className="relative flex flex-row items-center justify-between pb-2">
                <div>
                    <CardDescription className="text-xs">{label}</CardDescription>
                    <CardTitle className="text-3xl font-semibold tabular-nums">{value}</CardTitle>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${t.bg} ${t.text}`}>
                    {icon}
                </div>
            </CardHeader>
            <CardContent className="relative text-xs text-muted-foreground">{detail}</CardContent>
        </Card>
    );
}

/* -- Prompt form -------------------------------------------------------- */

type PromptFormProps = {
    title: string;
    form: EditingPrompt;
    onChange: (form: EditingPrompt) => void;
    users: UserSummary[];
    onSave: () => void;
    onCancel: () => void;
    saving: boolean;
};

function PromptForm({ title, form, onChange, users, onSave, onCancel, saving }: PromptFormProps) {
    return (
        <Card className="border-dashed border-primary/40">
            <CardHeader>
                <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-1.5">
                        <Label className="text-xs">Kind</Label>
                        <Select
                            value={form.kind}
                            onValueChange={(v) => onChange({ ...form, kind: v as SystemPromptKind })}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="system">System prompt</SelectItem>
                                <SelectItem value="first_message">First message</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs">Scope</Label>
                        <Select
                            value={form.scope}
                            onValueChange={(v) =>
                                onChange({ ...form, scope: v as SystemPromptScope, userId: null })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="global">Global (all users)</SelectItem>
                                <SelectItem value="user">Specific user</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {form.scope === "user" && (
                        <div className="space-y-1.5">
                            <Label className="text-xs">User</Label>
                            <Select
                                value={form.userId ?? ""}
                                onValueChange={(v) => onChange({ ...form, userId: v || null })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select user" />
                                </SelectTrigger>
                                <SelectContent>
                                    {users.map((u) => (
                                        <SelectItem key={u.id} value={u.id}>
                                            {u.nametag} ({u.id.slice(0, 8)})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <Label className="text-xs">Condition</Label>
                        <Select
                            value={form.condition ?? "always"}
                            onValueChange={(v) =>
                                onChange({
                                    ...form,
                                    condition: v === "always" ? null : (v as SystemPromptCondition)
                                })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="always">Always</SelectItem>
                                <SelectItem value="new_user">New user</SelectItem>
                                <SelectItem value="returning_user">Returning user</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label className="text-xs">Prompt</Label>
                    <textarea
                        className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        placeholder="Enter prompt text..."
                        value={form.prompt}
                        onChange={(e) => onChange({ ...form, prompt: e.target.value })}
                    />
                </div>

                <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={form.enabled}
                            onChange={(e) => onChange({ ...form, enabled: e.target.checked })}
                            className="h-4 w-4 rounded border-input"
                        />
                        Enabled
                    </label>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onCancel} disabled={saving}>
                            <X className="mr-1 h-4 w-4" />
                            Cancel
                        </Button>
                        <Button onClick={onSave} disabled={saving || !form.prompt.trim()}>
                            <Save className="mr-1 h-4 w-4" />
                            {saving ? "Saving..." : "Save"}
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

/* -- Prompt card -------------------------------------------------------- */

type PromptCardProps = {
    prompt: SystemPrompt;
    userMap: Map<string, UserSummary>;
    isEditing: boolean;
    editForm: EditingPrompt;
    onEditFormChange: (form: EditingPrompt) => void;
    users: UserSummary[];
    onStartEdit: () => void;
    onCancelEdit: () => void;
    onSave: () => void;
    onDelete: () => void;
    onCancelDelete: () => void;
    isConfirmingDelete: boolean;
    onToggle: () => void;
    saving: boolean;
};

function PromptCard({
    prompt,
    userMap,
    isEditing,
    editForm,
    onEditFormChange,
    users,
    onStartEdit,
    onCancelEdit,
    onSave,
    onDelete,
    onCancelDelete,
    isConfirmingDelete,
    onToggle,
    saving
}: PromptCardProps) {
    const [expanded, setExpanded] = useState(false);

    if (isEditing) {
        return (
            <PromptForm
                title="Edit prompt"
                form={editForm}
                onChange={onEditFormChange}
                users={users}
                onSave={onSave}
                onCancel={onCancelEdit}
                saving={saving}
            />
        );
    }

    const userName = prompt.userId ? userMap.get(prompt.userId)?.nametag ?? prompt.userId.slice(0, 8) : null;

    return (
        <Card className={`transition-shadow hover:shadow-md ${!prompt.enabled ? "opacity-60" : ""}`}>
            <CardHeader className="cursor-pointer select-none" onClick={() => setExpanded((prev) => !prev)}>
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                        <div
                            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                                prompt.kind === "first_message"
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                    : "bg-primary/10 text-primary"
                            }`}
                        >
                            {prompt.kind === "first_message" ? (
                                <MessageSquare className="h-4 w-4" />
                            ) : (
                                <FileText className="h-4 w-4" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <CardTitle className="text-base">
                                    {prompt.kind === "system" ? "System prompt" : "First message prompt"}
                                </CardTitle>
                                {!prompt.enabled && (
                                    <Badge variant="secondary" className="text-[10px] uppercase">
                                        disabled
                                    </Badge>
                                )}
                                {prompt.condition && (
                                    <Badge variant="outline" className="text-[10px]">
                                        {prompt.condition === "new_user" ? "New users" : "Returning users"}
                                    </Badge>
                                )}
                            </div>
                            <CardDescription className="mt-0.5 line-clamp-2">
                                {prompt.prompt.slice(0, 120)}
                                {prompt.prompt.length > 120 ? "..." : ""}
                            </CardDescription>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                    {prompt.scope === "global" ? (
                                        <Globe className="h-3 w-3" />
                                    ) : (
                                        <User className="h-3 w-3" />
                                    )}
                                    {prompt.scope === "global" ? "All users" : `User: ${userName}`}
                                </span>
                                <span className="text-muted-foreground/50">
                                    {new Date(prompt.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button className="mt-1 shrink-0 rounded p-1 text-muted-foreground hover:bg-muted">
                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                </div>
            </CardHeader>

            {expanded && (
                <CardContent className="border-t pt-4 space-y-4">
                    <div>
                        <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            <FileText className="h-3.5 w-3.5" />
                            Prompt text
                        </div>
                        <pre className="max-h-72 overflow-auto rounded-lg border bg-muted/50 p-4 text-xs leading-relaxed text-foreground whitespace-pre-wrap break-words font-mono">
                            {prompt.prompt}
                        </pre>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <MetaField label="ID" value={prompt.id} mono />
                        <MetaField label="Kind" value={prompt.kind === "system" ? "System" : "First message"} />
                        <MetaField
                            label="Scope"
                            value={prompt.scope === "global" ? "Global" : `User: ${userName}`}
                        />
                        <MetaField
                            label="Condition"
                            value={
                                prompt.condition === "new_user"
                                    ? "New users only"
                                    : prompt.condition === "returning_user"
                                      ? "Returning users only"
                                      : "Always"
                            }
                        />
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggle();
                            }}
                        >
                            {prompt.enabled ? "Disable" : "Enable"}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                onStartEdit();
                            }}
                            className="gap-1"
                        >
                            <Pencil className="h-3 w-3" />
                            Edit
                        </Button>
                        {isConfirmingDelete ? (
                            <>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete();
                                    }}
                                    disabled={saving}
                                    className="gap-1"
                                >
                                    <Trash2 className="h-3 w-3" />
                                    Confirm delete
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onCancelDelete();
                                    }}
                                >
                                    Cancel
                                </Button>
                            </>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete();
                                }}
                                className="gap-1 text-destructive hover:text-destructive"
                            >
                                <Trash2 className="h-3 w-3" />
                                Delete
                            </Button>
                        )}
                    </div>
                </CardContent>
            )}
        </Card>
    );
}

/* -- Shared components -------------------------------------------------- */

function MetaField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="rounded-lg border bg-background/60 px-3 py-2.5">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className={`mt-0.5 text-sm text-foreground truncate ${mono ? "font-mono" : ""}`}>{value}</div>
        </div>
    );
}

function EmptyState({ icon, label }: { icon: React.ReactNode; label: string }) {
    return (
        <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">{icon}</div>
                <span className="text-sm">{label}</span>
            </CardContent>
        </Card>
    );
}
