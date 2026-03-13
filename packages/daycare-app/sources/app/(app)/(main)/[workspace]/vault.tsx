import { createId } from "@paralleldrive/cuid2";
import * as React from "react";
import { ContentPanelLayout } from "@/components/layout/ContentPanelLayout";
import { useAuthStore } from "@/modules/auth/authContext";
import { documentRootIdResolve } from "@/modules/documents/documentRootIdResolve";
import { useDocumentsStore } from "@/modules/documents/documentsContext";
import { useWorkspace } from "@/modules/workspaces/workspaceProvider";
import { DocumentCreateDialog } from "@/views/documents/DocumentCreateDialog";
import { DocumentsView } from "@/views/documents/DocumentsView";

export default function VaultRoute() {
    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);
    const { workspaceId } = useWorkspace();
    const documentItems = useDocumentsStore((s) => s.items);
    const fetchVault = useDocumentsStore((s) => s.fetch);
    const createVaultEntry = useDocumentsStore((s) => s.createDocument);
    const [createDialogVisible, setCreateDialogVisible] = React.useState(false);
    const [createParentId, setCreateParentId] = React.useState<string | null>(null);
    const documentRootId = React.useMemo(() => documentRootIdResolve(documentItems), [documentItems]);

    React.useEffect(() => {
        if (baseUrl && token) {
            void fetchVault(baseUrl, token, workspaceId);
        }
    }, [baseUrl, token, workspaceId, fetchVault]);

    const _handleCreatePress = React.useCallback((parentId?: string | null) => {
        setCreateParentId(parentId ?? null);
        setCreateDialogVisible(true);
    }, []);

    const handleCreate = React.useCallback(
        (input: { title: string; slug: string; parentId: string | null }) => {
            if (!baseUrl || !token) return;
            const parentId = input.parentId ?? documentRootId;
            if (!parentId) return;
            void createVaultEntry(baseUrl, token, workspaceId, {
                id: createId(),
                title: input.title,
                slug: input.slug,
                parentId
            });
        },
        [baseUrl, token, workspaceId, createVaultEntry, documentRootId]
    );

    return (
        <>
            <ContentPanelLayout panel2={<DocumentsView onCreatePress={_handleCreatePress} />} />
            <DocumentCreateDialog
                visible={createDialogVisible}
                parentId={createParentId ?? documentRootId}
                onClose={() => setCreateDialogVisible(false)}
                onCreate={handleCreate}
            />
        </>
    );
}
