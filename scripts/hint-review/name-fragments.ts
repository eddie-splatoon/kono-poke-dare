export type NameFragment = {
  readonly number: number;
  readonly name: string;
  /** ヒントの番号(1 始まり)。 */
  readonly hint: number;
  readonly fragment: string;
};

const MIN_FRAGMENT_LENGTH = 3;
/** ヒント 10 は名前の文字数と頭文字を示すので、対象にしない。 */
const CHECKED_HINT_COUNT = 9;

function longestFragment(name: string, hint: string): string | undefined {
  const characters = [...name];
  for (
    let length = characters.length;
    length >= MIN_FRAGMENT_LENGTH;
    length -= 1
  ) {
    for (let start = 0; start + length <= characters.length; start += 1) {
      const fragment = characters.slice(start, start + length).join("");
      if (hint.includes(fragment)) {
        return fragment;
      }
    }
  }
  return undefined;
}

/** ヒント 1〜9 に出ている、名前の 3 文字以上の最長の部分を、ヒントごとに返す。 */
export function findNameFragments(
  species: readonly {
    readonly number: number;
    readonly name: string;
    readonly hints: readonly string[];
  }[],
): NameFragment[] {
  return species.flatMap(({ number, name, hints }) =>
    hints.slice(0, CHECKED_HINT_COUNT).flatMap((hint, index) => {
      const fragment = longestFragment(name, hint);
      return fragment === undefined
        ? []
        : [{ number, name, hint: index + 1, fragment }];
    }),
  );
}

export function renderNameFragmentsCsv(
  fragments: readonly NameFragment[],
): string {
  const rows = fragments.map(
    ({ number, name, hint, fragment }) =>
      `${number},${name},${hint},${fragment}`,
  );
  return `﻿${["number,name,hint,fragment", ...rows].join("\r\n")}\r\n`;
}
