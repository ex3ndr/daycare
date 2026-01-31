import { resolveEngineSocketPath } from "../engine/ipc/socket.js";
import { requestSocket } from "../engine/ipc/client.js";

export async function statusCommand(): Promise<void> {
  intro("claybot status");
  try {
    const status = await fetchStatus();
    console.log(JSON.stringify(status, null, 2));
    outro("Done.");
  } catch (error) {
    outro(`Engine not running: ${(error as Error).message}`);
  }
}

async function fetchStatus(): Promise<unknown> {
  const socketPath = resolveEngineSocketPath();
  const response = await requestSocket({ socketPath, path: "/v1/engine/status" });
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(response.body);
  }
  return JSON.parse(response.body) as unknown;
}

function intro(message: string): void {
  console.log(message);
}

function outro(message: string): void {
  console.log(message);
}
