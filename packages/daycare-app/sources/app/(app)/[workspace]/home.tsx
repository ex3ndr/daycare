import { useConfigStore } from "@/modules/config/configContext";
import { HomeView } from "@/views/HomeView";
import { OnboardingView } from "@/views/OnboardingView";

export default function HomeRoute() {
    const homeReady = useConfigStore((s) => s.config.homeReady);
    return homeReady ? <HomeView /> : <OnboardingView />;
}
