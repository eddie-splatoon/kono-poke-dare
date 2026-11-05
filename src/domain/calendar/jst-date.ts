const MS_PER_DAY = 24 * 60 * 60 * 1000;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function jstEpochMs(now: Date): number {
  const ms = now.getTime();
  if (Number.isNaN(ms)) {
    throw new RangeError("不正な日時です");
  }
  return ms + JST_OFFSET_MS;
}

/** 時刻が属する JST の日付を YYYY-MM-DD で返す。 */
export function jstDateKey(now: Date): string {
  return new Date(jstEpochMs(now)).toISOString().slice(0, 10);
}

/** JST の 1970-01-01 を 0 とする通算日を返す。 */
export function jstDayNumber(now: Date): number {
  return Math.floor(jstEpochMs(now) / MS_PER_DAY);
}
