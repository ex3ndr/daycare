import { intro, outro } from "@clack/prompts";

import { setSecret } from "../engine/client.js";

export async function setSecretCommand(
  pluginId: string,
  key: string,
  value: string
): Promise<void> {
  intro("gram secrets");
  await setSecret(pluginId, key, value);
  outro(`Stored ${key} for ${pluginId}.`);
}
