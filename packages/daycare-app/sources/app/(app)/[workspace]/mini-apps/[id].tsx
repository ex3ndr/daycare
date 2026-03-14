import { useLocalSearchParams } from "expo-router";
import { MiniAppView } from "@/views/MiniAppView";

export default function MiniAppRoute() {
    const { id } = useLocalSearchParams<{ id: string }>();
    if (!id) {
        return null;
    }
    return <MiniAppView appId={id} />;
}
