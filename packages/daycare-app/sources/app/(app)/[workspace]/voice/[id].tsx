import { useLocalSearchParams } from "expo-router";
import { VoiceCallView } from "@/views/voice/VoiceCallView";

export default function VoiceCallRoute() {
    const { id } = useLocalSearchParams<{ id: string }>();
    if (!id) {
        return null;
    }
    return <VoiceCallView voiceAgentId={id} />;
}
