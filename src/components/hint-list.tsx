export function HintList({ hints }: { readonly hints: readonly string[] }) {
  return (
    <ol
      data-testid="hint-list"
      aria-live="polite"
      className="flex list-inside list-decimal flex-col gap-2"
    >
      {hints.map((hint) => (
        // 同じ問題の中でヒントは重複しない(quiz-data.md の R-11)。
        <li
          key={hint}
          className="break-words rounded-lg border border-foreground/15 p-3"
        >
          {hint}
        </li>
      ))}
    </ol>
  );
}
