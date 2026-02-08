import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  complete,
  getModel,
  getOAuthApiKey,
  type Api,
  type AssistantMessage,
  type Context,
  type Model
} from "@mariozechner/pi-ai";

import { promptInput } from "../commands/prompts.js";
import { recipeAuthAnthropicEntryParse } from "./recipeAuthAnthropicEntryParse.js";

const DEFAULT_MODEL = "claude-sonnet-4-5";

/**
 * Runs a manual chat loop against Anthropic with OAuth credentials from ~/.dev/auth.json.
 * Expects: auth file contains `anthropic` entry with `type: "oauth"`.
 */
export async function recipeAnthropicManualLoop(): Promise<void> {
  const authPath = recipeAuthPathResolve();
  const model = process.env.DAYCARE_RECIPE_MODEL?.trim() || DEFAULT_MODEL;
  const modelDefinition = recipeModelResolve(model);
  const messages: Context["messages"] = [];

  console.log("Anthropic manual loop started.");
  console.log("Type /exit to quit.\n");

  while (true) {
    const userInput = await promptInput({
      message: "You",
      placeholder: "Type your message"
    });

    if (userInput === null) {
      break;
    }

    const message = userInput.trim();
    if (message.length === 0) {
      continue;
    }
    if (message === "/exit" || message === "/quit") {
      break;
    }

    messages.push({
      role: "user",
      content: [{ type: "text", text: message }],
      timestamp: Date.now()
    });

    try {
      const apiKey = await recipeAuthAnthropicApiKeyResolve(authPath);
      const reply = await recipeAnthropicReplyGet(messages, apiKey, modelDefinition);
      messages.push(reply.message);
      console.log(`\nAssistant: ${reply.text}\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`\nError: ${message}\n`);
    }
  }

  console.log("Exited.");
}

async function recipeAnthropicReplyGet(
  messages: Context["messages"],
  apiKey: string,
  model: Model<Api>
): Promise<{ text: string; message: AssistantMessage }> {
  const response = await complete(model, { messages, tools: [] }, {
    apiKey,
    sessionId: "recipe-anthropic-manual-loop"
  });

  if (response.stopReason === "error" || response.stopReason === "aborted") {
    throw new Error(response.errorMessage ?? `Inference failed with stopReason=${response.stopReason}`);
  }

  const text = recipeAssistantTextExtract(response);

  if (!text) {
    throw new Error("Anthropic response did not include text content.");
  }

  return { text, message: response };
}

async function recipeAuthAnthropicApiKeyResolve(authPath: string): Promise<string> {
  const authConfig = await recipeAuthConfigRead(authPath);
  const anthropicEntry = authConfig.anthropic;
  const credentials = recipeAuthAnthropicEntryParse(anthropicEntry);
  const result = await getOAuthApiKey("anthropic", { anthropic: credentials });

  if (!result) {
    throw new Error("Failed to resolve Anthropic OAuth API key from auth.json.");
  }

  // Persist refreshed OAuth credentials so future calls keep working.
  authConfig.anthropic = { type: "oauth", ...result.newCredentials };
  await recipeAuthConfigWrite(authPath, authConfig);

  return result.apiKey;
}

async function recipeAuthConfigRead(
  authPath: string
): Promise<Record<string, unknown>> {
  try {
    const raw = await fs.readFile(authPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Auth file must contain a JSON object.");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Auth file not found at ${authPath}.`);
    }
    throw error;
  }
}

async function recipeAuthConfigWrite(
  authPath: string,
  authConfig: Record<string, unknown>
): Promise<void> {
  await fs.mkdir(path.dirname(authPath), { recursive: true });
  await fs.writeFile(authPath, `${JSON.stringify(authConfig, null, 2)}\n`, {
    mode: 0o600
  });
}

function recipeAuthPathResolve(): string {
  return path.join(os.homedir(), ".dev", "auth.json");
}

function recipeModelResolve(modelId: string): Model<Api> {
  const model = getModel("anthropic", modelId as never);
  if (!model) {
    throw new Error(`Unknown Anthropic model: ${modelId}`);
  }
  return model as Model<Api>;
}

function recipeAssistantTextExtract(message: AssistantMessage): string {
  return message.content
    .filter((part): part is { type: "text"; text: string } => {
      return part.type === "text" && typeof part.text === "string";
    })
    .map((part) => part.text)
    .join("\n\n")
    .trim();
}

function recipeExecutedDirectly(): boolean {
  const argvPath = process.argv[1];
  if (!argvPath) {
    return false;
  }
  return import.meta.url === pathToFileURL(path.resolve(argvPath)).href;
}

if (recipeExecutedDirectly()) {
  await recipeAnthropicManualLoop();
}
