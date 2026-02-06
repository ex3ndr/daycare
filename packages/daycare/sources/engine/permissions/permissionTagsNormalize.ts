import type { PermissionAccess } from "@/types";
import { permissionAccessParse } from "./permissionAccessParse.js";

/**
 * Normalizes an unknown permissions list into unique permission tags.
 * Expects: entries are @network, @read:<path>, or @write:<path>.
 */
export function permissionTagsNormalize(value: unknown): string[] {
  if (!value) {
    return [];
  }
  const entries = Array.isArray(value) ? value : [value];
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    if (typeof entry !== "string") {
      continue;
    }
    const trimmed = entry.trim();
    if (!trimmed) {
      continue;
    }
    const access: PermissionAccess = permissionAccessParse(trimmed);
    const tag = access.kind === "network"
      ? "@network"
      : `${access.kind === "read" ? "@read" : "@write"}:${access.path}`;
    if (seen.has(tag)) {
      continue;
    }
    seen.add(tag);
    normalized.push(tag);
  }

  return normalized;
}
