import { promises as fs } from "node:fs";

/**
 * Reads a recipe auth JSON file and returns its object payload.
 * Expects: authPath points to a JSON object file.
 */
export async function recipeAuthConfigRead(
  authPath: string
): Promise<Record<string, unknown>> {
  try {
    const raw = await fs.readFile(authPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Auth file must contain a JSON object.");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Auth file not found at ${authPath}.`);
    }
    throw error;
  }
}
