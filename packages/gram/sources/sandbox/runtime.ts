import { SandboxManager, type SandboxRuntimeConfig } from "@anthropic-ai/sandbox-runtime";

import { getLogger } from "../log.js";

const logger = getLogger("sandbox.runtime");

let currentConfigKey: string | null = null;
let initPromise: Promise<void> | null = null;

export async function ensureSandbox(config: SandboxRuntimeConfig): Promise<void> {
  const key = JSON.stringify(config);
  if (currentConfigKey === key) {
    return;
  }

  if (initPromise) {
    await initPromise;
    if (currentConfigKey === key) {
      return;
    }
  }

  initPromise = (async () => {
    logger.debug("Initializing sandbox runtime");
    await SandboxManager.initialize(config);
    currentConfigKey = key;
  })();

  try {
    await initPromise;
  } finally {
    initPromise = null;
  }
}

export async function wrapWithSandbox(
  command: string,
  config: SandboxRuntimeConfig
): Promise<string> {
  await ensureSandbox(config);
  return SandboxManager.wrapWithSandbox(command);
}
