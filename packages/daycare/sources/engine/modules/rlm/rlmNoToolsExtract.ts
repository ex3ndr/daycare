import { tagExtractAll } from "../../../utils/tagExtract.js";

/**
 * Extracts Python code from all complete <run_python>...</run_python> blocks.
 * Expects: response text may include arbitrary non-tag content.
 */
export function rlmNoToolsExtract(text: string): string[] {
    return tagExtractAll(text, "run_python");
}
