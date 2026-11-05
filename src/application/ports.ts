import type { Question } from "@/domain/game/question";
import type { DailyGame } from "./game-view";

export type Clock = {
  now(): Date;
};

export type QuestionRepository = {
  count(): Promise<number>;
  findByNumber(number: number): Promise<Question | null>;
};

/** 端末内に保存できないことを表す。 */
export class RecordStorageError extends Error {
  constructor(cause?: unknown) {
    super("記録を保存できません", { cause });
    this.name = "RecordStorageError";
  }
}

export type DailyGameRepository = {
  /**
   * date の記録を change の結果で置き換えて、保存した値を返す。
   * 読み込みから書き込みまでを不可分に行う。不正な保存値は null として渡す。
   * change は同期関数にする。
   */
  update(
    date: string,
    change: (stored: DailyGame | null) => DailyGame,
  ): Promise<DailyGame>;
  /** 検証を通った記録だけを返す。 */
  list(): Promise<readonly DailyGame[]>;
};

export type StoragePersistence = {
  /** データを消しにくくするように要求する。失敗しても reject しない。 */
  request(): Promise<boolean>;
};
