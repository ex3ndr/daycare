import { createId } from "@paralleldrive/cuid2";
import path from "node:path";

import type { PermissionDecision, PermissionRequest } from "@/types";
import { agentDescriptorLabel } from "../agents/ops/agentDescriptorLabel.js";
import { agentDescriptorTargetResolve } from "../agents/ops/agentDescriptorTargetResolve.js";
import type { AgentSystem } from "../agents/agentSystem.js";
import type { ConnectorRegistry } from "../modules/connectorRegistry.js";
import type { PermissionRequestRegistry } from "../modules/tools/permissionRequestRegistry.js";
import { permissionAccessParse } from "../permissions/permissionAccessParse.js";

const DEFAULT_TIMEOUT_MS = 15 * 60_000;

export type GatePermissionRequestInput = {
  missing: string[];
  taskLabel: string;
  agentSystem: AgentSystem;
  connectorRegistry: ConnectorRegistry;
  permissionRequestRegistry: PermissionRequestRegistry;
  agentId: string;
  timeoutMs?: number;
};

export type GatePermissionRequestResult = {
  granted: boolean;
};

/**
 * Requests missing gate permissions from the most-recent foreground user.
 * Expects: missing values are valid permission tags and agentId identifies the gated task agent.
 */
export async function gatePermissionRequest(
  input: GatePermissionRequestInput
): Promise<GatePermissionRequestResult> {
  if (input.missing.length === 0) {
    return { granted: true };
  }

  const foregroundAgentId = input.agentSystem.agentFor("most-recent-foreground");
  if (!foregroundAgentId) {
    throw new Error("No foreground agent available for permission requests.");
  }

  const foregroundDescriptor = input.agentSystem.getAgentDescriptor(foregroundAgentId);
  if (!foregroundDescriptor) {
    throw new Error("Foreground agent descriptor not found.");
  }

  const target = agentDescriptorTargetResolve(foregroundDescriptor);
  if (!target) {
    throw new Error("Foreground agent has no user target for permission requests.");
  }

  const connector = input.connectorRegistry.get(target.connector);
  if (!connector) {
    throw new Error("Connector not available for permission requests.");
  }

  const requesterDescriptor = input.agentSystem.getAgentDescriptor(input.agentId);
  if (!requesterDescriptor) {
    throw new Error("Requesting agent descriptor not found.");
  }

  const permissions = input.missing.map((permission) => {
    const access = permissionAccessParse(permission);
    if ((access.kind === "read" || access.kind === "write") && !path.isAbsolute(access.path)) {
      throw new Error("Path must be absolute.");
    }
    return { permission, access };
  });

  const reason = `Gate check for ${input.taskLabel} requires additional permissions.`;
  const message = [
    `Permission request for ${input.taskLabel}:`,
    ...permissions.map((entry) => `- ${entry.permission}`),
    `Reason: ${reason}`,
    "Scope: always"
  ].join("\n");
  const request: PermissionRequest = {
    token: createId(),
    agentId: input.agentId,
    reason,
    message,
    permissions,
    scope: "always",
    requester: {
      id: input.agentId,
      type: requesterDescriptor.type,
      label: agentDescriptorLabel(requesterDescriptor),
      kind: "background"
    }
  };

  if (connector.requestPermission) {
    await connector.requestPermission(target.targetId, request, {}, foregroundDescriptor);
  } else {
    await connector.sendMessage(target.targetId, { text: request.message });
  }

  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let decision: PermissionDecision;
  try {
    decision = await input.permissionRequestRegistry.register(request.token, timeoutMs);
  } catch (error) {
    const isTimeout = error instanceof Error && error.message === "Permission request timed out.";
    if (isTimeout) {
      return { granted: false };
    }
    throw error;
  }

  if (!decision.approved) {
    return { granted: false };
  }

  const targetAgentId = decision.agentId || input.agentId;
  const resolvedDecision: PermissionDecision = {
    ...decision,
    agentId: targetAgentId,
    scope: "always"
  };
  for (const entry of decision.permissions) {
    await input.agentSystem.grantPermission(
      { agentId: targetAgentId },
      entry.access,
      {
        source: target.connector,
        decision: resolvedDecision
      }
    );
  }

  return { granted: true };
}
