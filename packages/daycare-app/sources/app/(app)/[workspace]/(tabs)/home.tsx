import { View } from "react-native";
import { useConfigStore } from "@/modules/config/configContext";
import { useWorkspace } from "@/modules/workspaces/workspaceProvider";
import { HomeView } from "@/views/HomeView";
import { OnboardingView } from "@/views/OnboardingView";

export default function HomeRoute() {
    const { workspaceId } = useWorkspace();
    const homeReady = useConfigStore((s) => s.configFor(workspaceId).homeReady);

    return <View style={{ flex: 1 }}>{homeReady ? <HomeView /> : <OnboardingView />}</View>;
}
