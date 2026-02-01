/**
 * Parses heartbeat content from body and frontmatter.
 *
 * Expects: body (markdown content), frontmatter (parsed YAML), fallbackTitle.
 * Returns: { title, prompt } extracted from content.
 */
export function heartbeatParse(
  body: string,
  frontmatter: Record<string, unknown>,
  fallbackTitle: string
): { title: string; prompt: string } {
  const trimmedBody = body.trim();
  const frontmatterTitle = frontmatter.title ?? frontmatter.name;
  if (frontmatterTitle && typeof frontmatterTitle === "string") {
    return {
      title: frontmatterTitle.trim() || fallbackTitle,
      prompt: trimmedBody
    };
  }

  if (trimmedBody.length > 0) {
    const lines = trimmedBody.split(/\r?\n/);
    const firstLine = lines[0]?.trim() ?? "";
    const headingMatch = /^#{1,6}\s+(.*)$/.exec(firstLine);
    if (headingMatch && headingMatch[1]) {
      const title = headingMatch[1].trim() || fallbackTitle;
      const prompt = lines.slice(1).join("\n").trim();
      return { title, prompt };
    }
  }

  return {
    title: fallbackTitle,
    prompt: trimmedBody
  };
}
