/**
 * Wraps text in a <system_message_silent> XML tag for silent system messages.
 * Silent messages are added to context for awareness without triggering inference.
 *
 * Expects: text is non-empty.
 */
export function messageBuildSystemSilentText(
  text: string,
  origin?: string
): string {
  const trimmed = text.trim();
  const originTag = origin ? ` origin="${origin}"` : "";
  return `<system_message_silent${originTag}>${trimmed}</system_message_silent>`;
}
