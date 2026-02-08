import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Persists recipe auth JSON to disk with strict file mode.
 * Expects: authConfig is a plain JSON-compatible object.
 */
export async function recipeAuthConfigWrite(
  authPath: string,
  authConfig: Record<string, unknown>
): Promise<void> {
  await fs.mkdir(path.dirname(authPath), { recursive: true });
  await fs.writeFile(authPath, `${JSON.stringify(authConfig, null, 2)}\n`, {
    mode: 0o600
  });
}
