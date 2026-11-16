/**
 * A single version-selection policy for the Peskas dashboard and AskFish.
 * The source-grain key is supplied by the caller; never combine physical
 * versions of the same observation or use Mongo's incidental cursor order.
 */
export function recordVersionTimestamp(record: Record<string, unknown>): number {
  const timestamp = record.timestamp;
  if (timestamp instanceof Date && Number.isFinite(timestamp.getTime())) {
    return timestamp.getTime();
  }
  const objectId = record._id as { getTimestamp?: () => Date } | undefined;
  return objectId?.getTimestamp?.().getTime() ?? 0;
}

function recordId(record: Record<string, unknown>): string {
  const id = record._id as { toHexString?: () => string } | string | undefined;
  if (typeof id === "string") return id;
  return id?.toHexString?.() ?? "";
}

/** Select a single newest record for each complete source-grain key. */
export function canonicalizeNewestByKey<T extends Record<string, unknown>>(
  records: readonly T[],
  keyForRecord: (record: T) => string,
): T[] {
  const canonical = new Map<string, T>();
  for (const record of records) {
    const key = keyForRecord(record);
    const existing = canonical.get(key);
    if (!existing) {
      canonical.set(key, record);
      continue;
    }
    const nextTime = recordVersionTimestamp(record);
    const oldTime = recordVersionTimestamp(existing);
    // When two documents have the same version timestamp, the larger ObjectId
    // is a stable tie-breaker. Identical IDs retain the later encountered row.
    if (nextTime > oldTime || (nextTime === oldTime && recordId(record) >= recordId(existing))) {
      canonical.set(key, record);
    }
  }
  return [...canonical.values()];
}
