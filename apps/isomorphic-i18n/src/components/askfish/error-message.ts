/** The reason the server gave for a failed question (`askfish:<reason>`), which the chat translates. */
export function askFishReason(error: unknown): string | undefined {
  return error instanceof Error ? /^askfish:([a-z-]+)$/.exec(error.message)?.[1] : undefined;
}
