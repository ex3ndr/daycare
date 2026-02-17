import { tagExtract } from "../../../util/tagExtract.js";

/**
 * Extracts Python code from the first <run_python> ... last </run_python> block.
 * Expects: response text may include arbitrary non-tag content.
 */
export function rlmNoToolsExtract(text: string): string | null {
  return tagExtract(text, "run_python");
}
