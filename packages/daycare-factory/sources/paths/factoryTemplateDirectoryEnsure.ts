import { stat } from "node:fs/promises";

/**
 * Validates that the environment template path exists and is a directory.
 * Expects: templateDirectory points to the environment template folder.
 */
export async function factoryTemplateDirectoryEnsure(
  templateDirectory: string
): Promise<void> {
  let templateDirectoryStat;
  try {
    templateDirectoryStat = await stat(templateDirectory);
  } catch {
    throw new Error(`template directory not found at ${templateDirectory}`);
  }

  if (!templateDirectoryStat.isDirectory()) {
    throw new Error(`template path is not a directory: ${templateDirectory}`);
  }
}
