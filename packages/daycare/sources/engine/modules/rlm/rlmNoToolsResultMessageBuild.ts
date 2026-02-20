import type { Context } from "@mariozechner/pi-ai";
import { rlmErrorTextBuild } from "./rlmErrorTextBuild.js";
import type { RlmExecuteResult } from "./rlmExecute.js";
import { rlmResultTextBuild } from "./rlmResultTextBuild.js";

type RlmNoToolsResultMessageBuildOptions =
    | {
          result: RlmExecuteResult;
      }
    | {
          error: unknown;
      };

/**
 * Builds a user-role <python_result> message for no-tools RLM loop turns.
 * Expects: exactly one of result or error is provided.
 */
export function rlmNoToolsResultMessageBuild(
    options: RlmNoToolsResultMessageBuildOptions
): Context["messages"][number] {
    const body = "result" in options ? rlmResultTextBuild(options.result) : rlmErrorTextBuild(options.error);
    return {
        role: "user",
        content: [
            {
                type: "text",
                text: `<python_result>\n${body}\n</python_result>`
            }
        ],
        timestamp: Date.now()
    };
}
