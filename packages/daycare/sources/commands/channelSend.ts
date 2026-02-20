import { sendEngineChannelMessage } from "../engine/ipc/client.js";

export async function channelSendCommand(channelName: string, text: string): Promise<void> {
    intro("daycare channel send");
    try {
        const result = await sendEngineChannelMessage(channelName, "daycare-cli", text, []);
        outro(`Sent message ${result.message.id} to #${channelName} (delivered=${result.deliveredAgentIds.length}).`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.exitCode = 1;
        console.error(`Failed to send channel message: ${message}`);
    }
}

function intro(message: string): void {
    console.log(message);
}

function outro(message: string): void {
    console.log(message);
}
