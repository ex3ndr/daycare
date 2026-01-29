import type { AuthConfig } from "../auth.js";

export type CodexAuthUpdate = {
  token: string;
  model: string;
  main?: boolean;
};

export type ClaudeCodeAuthUpdate = {
  token: string;
  model: string;
  main?: boolean;
};

export function applyTelegramAuthUpdate(
  auth: AuthConfig,
  token: string
): AuthConfig {
  return {
    ...auth,
    telegram: { token }
  };
}

export function removeTelegramAuth(auth: AuthConfig): AuthConfig {
  return omitAuthKey(auth, "telegram");
}

export function applyCodexAuthUpdate(
  auth: AuthConfig,
  update: CodexAuthUpdate
): AuthConfig {
  return {
    ...auth,
    codex: { token: update.token }
  };
}

export function removeCodexAuth(auth: AuthConfig): AuthConfig {
  return {
    ...omitAuthKey(auth, "codex")
  };
}

export function applyClaudeCodeAuthUpdate(
  auth: AuthConfig,
  update: ClaudeCodeAuthUpdate
): AuthConfig {
  return {
    ...auth,
    "claude-code": { token: update.token }
  };
}

export function removeClaudeCodeAuth(auth: AuthConfig): AuthConfig {
  return {
    ...omitAuthKey(auth, "claude-code")
  };
}

function omitAuthKey<K extends keyof AuthConfig>(
  auth: AuthConfig,
  key: K
): AuthConfig {
  const copy = { ...auth };
  delete copy[key];
  return copy;
}
