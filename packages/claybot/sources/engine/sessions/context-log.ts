import type { Context } from "@mariozechner/pi-ai";

export type SerializedContextMessages = Context["messages"];

export function serializeContextMessages(
  messages: Context["messages"]
): SerializedContextMessages {
  return JSON.parse(JSON.stringify(messages)) as SerializedContextMessages;
}

export function restoreContextMessages(
  messages: SerializedContextMessages
): Context["messages"] {
  return JSON.parse(JSON.stringify(messages)) as Context["messages"];
}
