import { createEngineChannel } from "../engine/ipc/client.js";

export async function channelCreateCommand(name: string, options: { leader: string }): Promise<void> {
    intro("daycare channel create");
    try {
        const channel = await createEngineChannel(name, options.leader);
        outro(`Created #${channel.name} (leader=${channel.leader}).`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.exitCode = 1;
        console.error(`Failed to create channel: ${message}`);
    }
}

function intro(message: string): void {
    console.log(message);
}

function outro(message: string): void {
    console.log(message);
}
