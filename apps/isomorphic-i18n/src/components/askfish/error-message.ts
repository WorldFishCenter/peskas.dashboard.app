/** Show only messages explicitly classified as safe by the server router.
 * Other tRPC/client exceptions remain generic (no stack traces or secrets).
 */
export function safeAskFishMessage(error: unknown): string | null {
  if (!(error instanceof Error)) return null;
  const prefix = "AskFish: ";
  const message = error.message;
  if (!message.startsWith(prefix)) return null;
  const text = message.slice(prefix.length).trim();
  return text && text.length <= 300 ? text : null;
}
