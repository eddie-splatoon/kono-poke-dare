import type { Question } from "@/domain/game/question";
import { MAX_HINTS } from "@/domain/scoring/score";
import type { DailyGame } from "./game-view";
import type {
  DailyGameRepository,
  QuestionRepository,
  StoragePersistence,
} from "./ports";

export const QUESTION_COUNT = 5;

export function makeQuestion(number: number): Question {
  return {
    number,
    name: `ナマエ${number}`,
    aliases: [`ベツメイ${number}`],
    hints: Array.from(
      { length: MAX_HINTS },
      (_, i) => `問題${number}のヒント${i + 1}`,
    ),
  };
}

export const fakeQuestions: QuestionRepository = {
  count: async () => QUESTION_COUNT,
  findByNumber: async (number) =>
    number >= 1 && number <= QUESTION_COUNT ? makeQuestion(number) : null,
};

export function createInMemoryDailyGameRepository(): DailyGameRepository & {
  readonly stored: Map<string, DailyGame>;
} {
  const stored = new Map<string, DailyGame>();
  return {
    stored,
    update: async (date, change) => {
      const next = change(stored.get(date) ?? null);
      stored.set(date, next);
      return next;
    },
    list: async () => [...stored.values()],
  };
}

export function createFakePersistence(): StoragePersistence & {
  readonly requests: () => number;
} {
  let count = 0;
  return {
    requests: () => count,
    request: async () => {
      count += 1;
      return true;
    },
  };
}
