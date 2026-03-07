import { useLocalSearchParams } from "expo-router";
import { AgentDetailView } from "@/views/agents/AgentDetailView";

export default function AgentDetailRoute() {
    const { id } = useLocalSearchParams<{ id: string }>();
    if (!id) return null;
    return <AgentDetailView agentId={id} />;
}
