import { removeEngineChannelMember } from "../engine/ipc/client.js";

export async function channelRemoveMemberCommand(
  channelName: string,
  agentId: string
): Promise<void> {
  intro("daycare channel remove-member");
  try {
    const removed = await removeEngineChannelMember(channelName, agentId);
    if (removed) {
      outro(`Removed ${agentId} from #${channelName}.`);
      return;
    }
    outro(`${agentId} is not a member of #${channelName}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.exitCode = 1;
    console.error(`Failed to remove channel member: ${message}`);
  }
}

function intro(message: string): void {
  console.log(message);
}

function outro(message: string): void {
  console.log(message);
}

