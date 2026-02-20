import { addEngineChannelMember } from "../engine/ipc/client.js";

export async function channelAddMemberCommand(channelName: string, agentId: string, username: string): Promise<void> {
    intro("daycare channel add-member");
    try {
        await addEngineChannelMember(channelName, agentId, username);
        outro(`Added @${username} (${agentId}) to #${channelName}.`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.exitCode = 1;
        console.error(`Failed to add channel member: ${message}`);
    }
}

function intro(message: string): void {
    console.log(message);
}

function outro(message: string): void {
    console.log(message);
}
