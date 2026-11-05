import type { Question } from "@/domain/game/question";

export type Clock = {
  now(): Date;
};

export type QuestionRepository = {
  count(): Promise<number>;
  findByNumber(number: number): Promise<Question | null>;
};
