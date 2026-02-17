import type { ConnectorFileDisposition } from "@/types";

import { tagExtractAllWithAttrs } from "../../../util/tagExtractAllWithAttrs.js";

export type SayFileExtractResult = {
  path: string;
  mode: ConnectorFileDisposition;
};

/**
 * Extracts `<file>` tags from say-mode model output.
 * Expects: tag body is a file path; invalid/unknown modes fall back to "auto".
 */
export function sayFileExtract(text: string): SayFileExtractResult[] {
  const parsed = tagExtractAllWithAttrs(text, "file");
  const results: SayFileExtractResult[] = [];

  for (const item of parsed) {
    const path = item.content.trim();
    if (path.length === 0) {
      continue;
    }
    results.push({
      path,
      mode: sayFileModeResolve(item.attrs.mode)
    });
  }

  return results;
}

function sayFileModeResolve(modeValue: string | undefined): ConnectorFileDisposition {
  const normalized = modeValue?.trim().toLowerCase();
  if (normalized === "doc") {
    return "document";
  }
  if (normalized === "photo") {
    return "photo";
  }
  if (normalized === "video") {
    return "video";
  }
  return "auto";
}
