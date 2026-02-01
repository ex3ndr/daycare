import type { Context } from "@mariozechner/pi-ai";

import type { MessageContext } from "../connectors/types.js";
import type { SessionPermissions } from "../permissions.js";
import type { SessionDescriptor } from "./descriptor.js";

export type SessionState = {
  context: Context;
  providerId?: string;
  permissions: SessionPermissions;
  session?: SessionDescriptor;
  routing?: {
    source: string;
    context: MessageContext;
  };
  agent?: {
    kind: "background";
    parentSessionId?: string;
    name?: string;
  };
};
