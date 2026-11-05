import type { GameView } from "@/application/game-view";

export function GameResult({
  view,
  totalScore,
}: {
  readonly view: GameView;
  readonly totalScore: number | null;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-foreground/30 p-4">
      <h2 className="text-center text-2xl font-bold">
        {view.status === "won" ? "正解!" : "残念!"}
      </h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt>正解</dt>
        <dd data-testid="answer" className="min-w-0 break-words font-bold">
          {view.answer}
        </dd>
        <dt>得点</dt>
        <dd data-testid="score" className="font-bold">
          {view.score} 点
        </dd>
        <dt>累積スコア</dt>
        <dd data-testid="total-score" className="font-bold">
          {totalScore === null ? "読み込めませんでした" : `${totalScore} 点`}
        </dd>
      </dl>
      <p className="text-center text-sm opacity-70">
        次の問題は日本時間の 0 時に公開します。
      </p>
    </section>
  );
}
