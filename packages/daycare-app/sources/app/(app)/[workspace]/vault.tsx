import { createId } from "@paralleldrive/cuid2";
import * as React from "react";
import { ContentPanelLayout } from "@/components/layout/ContentPanelLayout";
import { useAuthStore } from "@/modules/auth/authContext";
import { vaultRootIdResolve } from "@/modules/documents/vaultRootIdResolve";
import { useVaultsStore } from "@/modules/documents/vaultsContext";
import { useWorkspace } from "@/modules/workspaces/workspaceProvider";
import { VaultCreateDialog } from "@/views/documents/VaultCreateDialog";
import { VaultView } from "@/views/documents/VaultView";

export default function VaultRoute() {
    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);
    const { workspaceId } = useWorkspace();
    const vaultItems = useVaultsStore((s) => s.items);
    const fetchVault = useVaultsStore((s) => s.fetch);
    const createVaultEntry = useVaultsStore((s) => s.createDocument);
    const [createDialogVisible, setCreateDialogVisible] = React.useState(false);
    const [createParentId, setCreateParentId] = React.useState<string | null>(null);
    const vaultRootId = React.useMemo(() => vaultRootIdResolve(vaultItems), [vaultItems]);

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
            const parentId = input.parentId ?? vaultRootId;
            if (!parentId) return;
            void createVaultEntry(baseUrl, token, workspaceId, {
                id: createId(),
                title: input.title,
                slug: input.slug,
                parentId
            });
        },
        [baseUrl, token, workspaceId, createVaultEntry, vaultRootId]
    );

    return (
        <>
            <ContentPanelLayout panel2={<VaultView onCreatePress={_handleCreatePress} />} />
            <VaultCreateDialog
                visible={createDialogVisible}
                parentId={createParentId ?? vaultRootId}
                onClose={() => setCreateDialogVisible(false)}
                onCreate={handleCreate}
            />
        </>
    );
}
