import { createId } from "@paralleldrive/cuid2";
import * as React from "react";
import type { AppMode } from "@/components/AppHeader";
import { ContentPanelLayout } from "@/components/layout/ContentPanelLayout";
import { useAuthStore } from "@/modules/auth/authContext";
import { documentRootIdResolve } from "@/modules/documents/documentRootIdResolve";
import { useDocumentsStore } from "@/modules/documents/documentsContext";
import { AgentsView } from "@/views/AgentsView";
import { CostsView } from "@/views/CostsView";
import { DevView } from "@/views/DevView";
import { DocumentCreateDialog } from "@/views/documents/DocumentCreateDialog";
import { DocumentMetadataPanel } from "@/views/documents/DocumentMetadataPanel";
import { DocumentsView } from "@/views/documents/DocumentsView";
import { FragmentsView } from "@/views/FragmentsView";
import { FilesView } from "@/views/files/FilesView";
import { HomeView } from "@/views/HomeView";
import { RoutinesView } from "@/views/RoutinesView";
import { SettingsView } from "@/views/SettingsView";
import { SkillsView } from "@/views/SkillsView";
import { TodosView } from "@/views/TodosView";
import { ToolsView } from "@/views/ToolsView";

const viewComponents: Record<AppMode, React.ComponentType> = {
    home: HomeView,
    agents: AgentsView,
    fragments: FragmentsView,
    todos: TodosView,
    routines: RoutinesView,
    costs: CostsView,
    documents: DocumentsView,
    files: FilesView,
    skills: SkillsView,
    tools: ToolsView,
    dev: DevView,
    settings: SettingsView
};

type SidebarModeViewProps = {
    mode: AppMode;
    /** Override the default panel2 content (e.g. to pass props to a view component). */
    panel2Override?: React.ReactElement;
};

/**
 * Renders the content area for a given mode when using the sidebar layout.
 * Only renders Panel2 (main view) and optional Panel3 (details) — no Panel1,
 * since the sidebar handles mode selection and sub-items.
 */
export function SidebarModeView({ mode, panel2Override }: SidebarModeViewProps) {
    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);
    const documentItems = useDocumentsStore((s) => s.items);
    const selectedId = useDocumentsStore((s) => s.selectedId);
    const fetchDocuments = useDocumentsStore((s) => s.fetch);
    const createDocument = useDocumentsStore((s) => s.createDocument);
    const [createDialogVisible, setCreateDialogVisible] = React.useState(false);
    const [createParentId, setCreateParentId] = React.useState<string | null>(null);
    const documentRootId = React.useMemo(() => documentRootIdResolve(documentItems), [documentItems]);

    const isDocuments = mode === "documents";

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
            const parentId = input.parentId ?? documentRootId;
            if (!parentId) return;
            void createDocument(baseUrl, token, { id: createId(), title: input.title, slug: input.slug, parentId });
        },
        [baseUrl, token, createDocument, documentRootId]
    );

    const ViewComponent = viewComponents[mode];

    return (
        <>
            <ContentPanelLayout
                panel2={panel2Override ?? <ViewComponent />}
                panel3={isDocuments && selectedId ? <DocumentMetadataPanel /> : undefined}
            />
            {isDocuments && (
                <DocumentCreateDialog
                    visible={createDialogVisible}
                    parentId={createParentId ?? documentRootId}
                    onClose={() => setCreateDialogVisible(false)}
                    onCreate={handleCreate}
                />
            )}
        </>
    );
}
