export const MAX_HINTS = 10;

/** 正解したときのヒント番号(1 から 10)から得点を返す。 */
export function scoreForHint(hintNumber: number): number {
  if (
    !Number.isInteger(hintNumber) ||
    hintNumber < 1 ||
    hintNumber > MAX_HINTS
  ) {
    throw new RangeError(`ヒント番号が範囲外です: ${hintNumber}`);
  }
  return (MAX_HINTS + 1 - hintNumber) * 10;
}
