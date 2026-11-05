const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 実在する日付の YYYY-MM-DD であるかを返す。 */
export function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_KEY_PATTERN.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}
