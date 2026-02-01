import type { MessageContext } from "../connectors/types.js";

export function sessionRoutingSanitize(context: MessageContext): MessageContext {
  const { messageId, commands, ...rest } = context;
  return { ...rest };
}
