/*
 * The month window (CONTEXT.md): the last N complete months, in UTC. Summaries
 * are dated on the 1st of their month, in UTC.
 */

/** First day (UTC) of the month `by` months from `date`'s. */
export const addMonths = (date: Date, by: number) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + by, 1));

/** First day (UTC) of the current month: its landings are still coming in, so no window includes it. */
export const thisMonth = () => addMonths(new Date(), 0);

/** First day (UTC) of the window's earliest month: `months` complete months back. */
export const windowStart = (months: number) => addMonths(thisMonth(), -months);

/** The last instant (UTC) of the last complete month. */
export const lastMonthEnd = () => new Date(thisMonth().getTime() - 1);

/**
 * The Mongo date filter for months from `start` (all of them when left out) to the
 * last complete month, both ends included, so a caller can report them (AskFish).
 */
export const monthWindow = (start?: Date | null) => ({
  ...(start ? { $gte: start } : {}),
  $lte: lastMonthEnd(),
});
