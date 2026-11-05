const IGNORED_CHARACTERS = /[\s・:]/g;
const HIRAGANA = /[ぁ-ゖ]/g;
const HIRAGANA_TO_KATAKANA_OFFSET = 0x60;

/** 回答の表記ゆれをなくした文字列を返す。 */
export function normalizeAnswer(input: string): string {
  return input
    .normalize("NFKC")
    .replace(IGNORED_CHARACTERS, "")
    .normalize("NFKC")
    .replace(HIRAGANA, (c) =>
      String.fromCharCode(c.charCodeAt(0) + HIRAGANA_TO_KATAKANA_OFFSET),
    )
    .toLowerCase();
}

/** 正規化した回答が、正解の名前のいずれかと一致するかを返す。 */
export function isCorrectAnswer(
  input: string,
  acceptedNames: readonly string[],
): boolean {
  const answer = normalizeAnswer(input);
  if (answer === "") {
    return false;
  }
  return acceptedNames.some((name) => normalizeAnswer(name) === answer);
}
