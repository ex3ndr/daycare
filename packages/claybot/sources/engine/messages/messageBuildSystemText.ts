export function messageBuildSystemText(
  text: string,
  origin?: "background" | "system"
): string {
  const trimmed = text.trim();
  const originTag = origin ? ` origin=\"${origin}\"` : "";
  return `<system_message${originTag}>${trimmed}</system_message>`;
}
