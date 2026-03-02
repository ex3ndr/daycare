import { createId } from "@paralleldrive/cuid2";
import type { ToolExecutionContext } from "@/types";
import { tagExtractAll } from "../../../utils/tagExtract.js";
import { montyPreambleBuild } from "../monty/montyPreambleBuild.js";
import { rlmExecute } from "../rlm/rlmExecute.js";
import { rlmToolsForContextResolve } from "../rlm/rlmToolsForContextResolve.js";
import type { ToolResolverApi } from "../toolResolver.js";
import { executablePromptTagReplace } from "./executablePromptTagReplace.js";

export type ExecutablePromptExpandResult = {
    expanded: string;
    skipTurn: boolean;
};

/**
 * Expands `<run_python>...</run_python>` blocks inside a prompt using the RLM runtime.
 * When any block calls skip(), stops processing and signals the caller to abort inference.
 * Expects: caller has already checked feature flags and execution permissions.
 */
export async function executablePromptExpand(
    prompt: string,
    context: ToolExecutionContext,
    toolResolver: ToolResolverApi
): Promise<ExecutablePromptExpandResult> {
    const codeBlocks = tagExtractAll(prompt, "run_python");
    if (codeBlocks.length === 0) {
        return { expanded: prompt, skipTurn: false };
    }

    const tagMatches = [...prompt.matchAll(/<run_python(\s[^>]*)?>[\s\S]*?<\/run_python\s*>/gi)];
    if (tagMatches.length === 0) {
        return { expanded: prompt, skipTurn: false };
    }

    const preamble = montyPreambleBuild(rlmToolsForContextResolve(toolResolver, context));
    const replacements: string[] = [];
    let skipTurn = false;
    for (let index = 0; index < codeBlocks.length; index += 1) {
        const code = codeBlocks[index]!;
        try {
            const result = await rlmExecute(
                code,
                preamble,
                context,
                toolResolver,
                createId(),
                context.appendHistoryRecord
            );
            if (result.skipTurn) {
                skipTurn = true;
                break;
            }
            replacements.push(result.output);
        } catch (error) {
            replacements.push(`<exec_error>${errorMessageResolve(error)}</exec_error>`);
        }
    }

    if (skipTurn) {
        return { expanded: prompt, skipTurn: true };
    }

    let expanded = prompt;
    const replacementCount = Math.min(tagMatches.length, replacements.length);
    for (let index = replacementCount - 1; index >= 0; index -= 1) {
        const tagMatch = tagMatches[index]!;
        expanded = executablePromptTagReplace(expanded, tagMatch, replacements[index] ?? "");
    }

    return { expanded, skipTurn: false };
}

function errorMessageResolve(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}
