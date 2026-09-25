/**
 * Date match for the last `months` months, ending now. With `fromMonthStart`
 * the window starts at the first day of the earliest month.
 */
export function lastMonths(months: number, { fromMonthStart = false } = {}) {
  const end = new Date();
  const start = new Date(end);
  start.setMonth(end.getMonth() - months);
  if (fromMonthStart) {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }
  return { $gte: start, $lte: end };
}
