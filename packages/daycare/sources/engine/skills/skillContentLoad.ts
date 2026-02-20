import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";

/**
 * Loads SKILL.md body content and strips optional YAML frontmatter.
 *
 * Expects: filePath points to a readable markdown file.
 */
export async function skillContentLoad(filePath: string): Promise<string> {
    const content = await fs.readFile(path.resolve(filePath), "utf8");
    try {
        const parsed = matter(content);
        return parsed.content.trim();
    } catch {
        return content.trim();
    }
}
