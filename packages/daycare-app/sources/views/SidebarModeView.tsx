import { createId } from "@paralleldrive/cuid2";
import * as React from "react";
import type { AppMode } from "@/components/AppHeader";
import { ContentPanelLayout } from "@/components/layout/ContentPanelLayout";
import { useAuthStore } from "@/modules/auth/authContext";
import { useDocumentsStore } from "@/modules/documents/documentsContext";
import { useTasksStore } from "@/modules/tasks/tasksContext";
import { AgentsView } from "@/views/AgentsView";
import { CostsView } from "@/views/CostsView";
import { DocumentCreateDialog } from "@/views/documents/DocumentCreateDialog";
import { DocumentMetadataPanel } from "@/views/documents/DocumentMetadataPanel";
import { DocumentsView } from "@/views/documents/DocumentsView";
import { EmailView } from "@/views/EmailView";
import { HomeView } from "@/views/HomeView";
import { InboxView } from "@/views/InboxView";
import { PeopleView } from "@/views/PeopleView";
import { RoutinesView } from "@/views/RoutinesView";
import { RoutineDetailPanel } from "@/views/routines/RoutineDetailPanel";
import { SettingsView } from "@/views/SettingsView";
import { SkillsView } from "@/views/SkillsView";
import { TodosView } from "@/views/TodosView";
import { ToolsView } from "@/views/ToolsView";

const viewComponents: Record<AppMode, React.ComponentType> = {
    home: HomeView,
    agents: AgentsView,
    people: PeopleView,
    email: EmailView,
    inbox: InboxView,
    todos: TodosView,
    routines: RoutinesView,
    costs: CostsView,
    documents: DocumentsView,
    skills: SkillsView,
    tools: ToolsView,
    settings: SettingsView
};

type SidebarModeViewProps = {
    mode: AppMode;
};

/**
 * Renders the content area for a given mode when using the sidebar layout.
 * Only renders Panel2 (main view) and optional Panel3 (details) — no Panel1,
 * since the sidebar handles mode selection and sub-items.
 */
export function SidebarModeView({ mode }: SidebarModeViewProps) {
    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);
    const selectedId = useDocumentsStore((s) => s.selectedId);
    const fetchDocuments = useDocumentsStore((s) => s.fetch);
    const createDocument = useDocumentsStore((s) => s.createDocument);
    const [createDialogVisible, setCreateDialogVisible] = React.useState(false);
    const [createParentId, setCreateParentId] = React.useState<string | null>(null);

    const selectedTaskId = useTasksStore((s) => s.selectedTaskId);
    const isDocuments = mode === "documents";
    const isRoutines = mode === "routines";

    React.useEffect(() => {
        if (isDocuments && baseUrl && token) {
            void fetchDocuments(baseUrl, token);
        }
    }, [isDocuments, baseUrl, token, fetchDocuments]);

    // Kept for future use when document creation is wired into the sidebar
    const _handleCreatePress = React.useCallback((parentId?: string | null) => {
        setCreateParentId(parentId ?? null);
        setCreateDialogVisible(true);
    }, []);

    const handleCreate = React.useCallback(
        (input: { title: string; slug: string; parentId: string | null }) => {
            if (!baseUrl || !token) return;
            void createDocument(baseUrl, token, { id: createId(), ...input });
        },
        [baseUrl, token, createDocument]
    );

    const ViewComponent = viewComponents[mode];

    return (
        <>
            <ContentPanelLayout
                panel2={<ViewComponent />}
                panel3={
                    isDocuments && selectedId ? (
                        <DocumentMetadataPanel />
                    ) : isRoutines && selectedTaskId ? (
                        <RoutineDetailPanel />
                    ) : undefined
                }
            />
            {isDocuments && (
                <DocumentCreateDialog
                    visible={createDialogVisible}
                    parentId={createParentId}
                    onClose={() => setCreateDialogVisible(false)}
                    onCreate={handleCreate}
                />
            )}
        </>
    );
}
