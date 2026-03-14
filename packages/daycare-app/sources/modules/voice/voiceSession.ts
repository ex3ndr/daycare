import type { VoiceAgentToolDefinition } from "./voiceTypes";

/**
 * Builds generic client-tool callbacks for the ElevenLabs SDK from voice-agent tool definitions.
 * Expects: tool names are unique within a single voice agent definition.
 */
export function voiceSessionClientToolsBuild(tools: VoiceAgentToolDefinition[]) {
    return Object.fromEntries(
        tools.map((tool) => [
            tool.name,
            async (parameters: unknown) =>
                JSON.stringify({
                    ok: true,
                    tool: tool.name,
                    parameters,
                    summary: `Client tool ${tool.name} executed locally.`
                })
        ])
    );
}
