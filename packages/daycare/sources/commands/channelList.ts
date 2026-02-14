import { listEngineChannels } from "../engine/ipc/client.js";

export async function channelListCommand(): Promise<void> {
  intro("daycare channel list");
  try {
    const channels = await listEngineChannels();
    if (channels.length === 0) {
      outro("No channels.");
      return;
    }
    for (const channel of channels) {
      const members = channel.members.length;
      console.log(`#${channel.name} leader=${channel.leader} members=${members}`);
    }
    outro(`Listed ${channels.length} channel(s).`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.exitCode = 1;
    console.error(`Failed to list channels: ${message}`);
  }
}

function intro(message: string): void {
  console.log(message);
}

function outro(message: string): void {
  console.log(message);
}

