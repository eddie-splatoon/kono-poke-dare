/** 値を変えると全員の出題順が変わるので、変更しない。 */
const SHUFFLE_SEED = 0x706f6b65;

/** mulberry32。[0, 1) の疑似乱数を返す関数を作る。 */
function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffledQuestionNumbers(questionCount: number): number[] {
  const random = createRandom(SHUFFLE_SEED);
  const numbers = Array.from({ length: questionCount }, (_, i) => i + 1);
  for (let i = numbers.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }
  return numbers;
}

/** 通算日から、その日の問題番号(1 から questionCount)を返す。 */
export function questionNumberForDay(
  dayNumber: number,
  questionCount: number,
): number {
  if (!Number.isInteger(questionCount) || questionCount < 1) {
    throw new RangeError(`問題数が不正です: ${questionCount}`);
  }
  if (!Number.isInteger(dayNumber)) {
    throw new RangeError(`通算日が不正です: ${dayNumber}`);
  }
  const position =
    ((dayNumber % questionCount) + questionCount) % questionCount;
  return shuffledQuestionNumbers(questionCount)[position];
}
