export type Question = {
  /** 図鑑番号(1 から問題数)。 */
  readonly number: number;
  /** 正解として表示する名前。 */
  readonly name: string;
  /** name のほかに正解とする名前。 */
  readonly aliases: readonly string[];
  /** 難しい順のヒント。 */
  readonly hints: readonly string[];
};
