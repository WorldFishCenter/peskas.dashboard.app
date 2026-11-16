
// Backwards-compatible import for the AskFish query executor and its tests.
// The dashboard and AskFish now share the same source-version selector.
export { canonicalizeNewestByKey, recordVersionTimestamp } from "../lib/canonicalization";


/** 
export function recordVersionTimestamp(record: Record<string, unknown>): number {
  const timestamp = record.timestamp;
  if (timestamp instanceof Date) return timestamp.getTime();

  // STAGE 2 STEP 2.7.1: MongoDB ObjectId timestamps are the deterministic fallback
  // when an explicit collection timestamp is unavailable on a versioned summary row.
  const objectId = record._id as { getTimestamp?: () => Date } | undefined;
  return objectId?.getTimestamp?.().getTime() ?? 0;
}

// STAGE 2 STEP 2.7.1: Collapse repeated physical versions to exactly one record per
// semantic grain key. Equal timestamps preserve the later encountered record, matching
// the previous inline query behavior while making the no-summing invariant testable.
export function canonicalizeNewestByKey<T extends Record<string, unknown>>(
  records: T[],
  keyForRecord: (record: T) => string,
): T[] {
  const canonical = new Map<string, T>();

  for (const record of records) {
    const key = keyForRecord(record);
    const existing = canonical.get(key);
    if (!existing || recordVersionTimestamp(record) >= recordVersionTimestamp(existing)) {
      canonical.set(key, record);
    }
  }

  return Array.from(canonical.values());
}
*/