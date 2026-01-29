import { confirm, intro, isCancel, outro, password } from "@clack/prompts";
import path from "node:path";

import { readAuthFile, writeAuthFile } from "../auth.js";

export type AddClaudeCodeOptions = {
  token?: string;
  output: string;
};

const DEFAULT_OUTPUT = "auth.json";

export async function addClaudeCodeCommand(
  options: AddClaudeCodeOptions
): Promise<void> {
  intro("scout add claude");

  const outputPath = path.resolve(options.output || DEFAULT_OUTPUT);

  const tokenInput =
    options.token ??
    (await password({
      message: "Claude Code token",
      validate: (value) => (value ? undefined : "Token is required")
    }));

  if (isCancel(tokenInput)) {
    outro("Canceled.");
    return;
  }

  const token = String(tokenInput);
  const auth = await readAuthFile(outputPath);

  if (auth["claude-code"]?.token || auth.claude?.token) {
    const overwrite = await confirm({
      message: `Overwrite existing Claude Code token in ${outputPath}?`,
      initialValue: false
    });

    if (isCancel(overwrite) || overwrite === false) {
      outro("Canceled.");
      return;
    }
  }

  auth["claude-code"] = { token };
  await writeAuthFile(outputPath, auth);

  outro(`Saved Claude Code token to ${outputPath}`);
}
