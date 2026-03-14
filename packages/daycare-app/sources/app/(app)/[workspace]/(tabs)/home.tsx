import { View } from "react-native";
import { PageHeader } from "@/components/PageHeader";
import { useConfigStore } from "@/modules/config/configContext";
import { useWorkspace } from "@/modules/workspaces/workspaceProvider";
import { HomeView } from "@/views/HomeView";
import { OnboardingView } from "@/views/OnboardingView";

export default function HomeRoute() {
    const { workspaceId, workspace } = useWorkspace();
    const homeReady = useConfigStore((s) => s.configFor(workspaceId).homeReady);
    const title = workspace.isSelf ? "Home" : (workspace.firstName ?? "Workspace");

    return (
        <View style={{ flex: 1 }}>
            <PageHeader title={title} icon="home" />
            {homeReady ? <HomeView /> : <OnboardingView />}
        </View>
    );
}
