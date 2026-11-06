"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  GameFailureKind,
  GameSession,
  GameSessionResult,
} from "@/application/game-session";
import { GameResult } from "./game-result";
import { GuessForm } from "./guess-form";
import { HintList } from "./hint-list";

type Playable = Extract<GameSessionResult, { ok: true }>;

type Notice =
  | { readonly tone: "status"; readonly message: string }
  | { readonly tone: "alert"; readonly message: string };

const FAILURE_MESSAGES: Record<GameFailureKind, string> = {
  "empty-guess": "名前を入力してください。",
  storage:
    "記録を保存できません。ブラウザの設定でサイトのデータの保存が許可されているか、空き容量があるかを確認してください。",
  unavailable:
    "問題を読み込めません。通信環境を確認して、もう一度試してください。",
};

const WRONG_MESSAGE = "不正解です。次のヒントを確認してください。";

export function GameScreen({ session }: { readonly session: GameSession }) {
  const [current, setCurrent] = useState<Playable | null>(null);
  const [startFailure, setStartFailure] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [guess, setGuess] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const isRunning = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const start = useCallback(async () => {
    setStartFailure(null);
    const result = await session.start();
    if (result.ok) {
      setCurrent(result);
    } else {
      console.error(result.cause);
      setStartFailure(FAILURE_MESSAGES[result.kind]);
    }
  }, [session]);

  useEffect(() => {
    void start();
  }, [start]);

  /** 誤ってヒントを進めないように、処理中の操作を受け付けない。 */
  async function run(
    operation: () => Promise<GameSessionResult>,
    onPlaying?: () => void,
  ) {
    if (isRunning.current) {
      return;
    }
    isRunning.current = true;
    setIsBusy(true);
    const result = await operation();
    isRunning.current = false;
    setIsBusy(false);

    if (!result.ok) {
      if (result.kind === "empty-guess") {
        setNotice({ tone: "status", message: FAILURE_MESSAGES[result.kind] });
        inputRef.current?.focus();
      } else {
        console.error(result.cause);
        setNotice({ tone: "alert", message: FAILURE_MESSAGES[result.kind] });
      }
      return;
    }
    setCurrent(result);
    setNotice(null);
    if (result.view.status === "playing") {
      onPlaying?.();
    }
  }

  if (startFailure !== null) {
    return (
      <div className="flex flex-col gap-3">
        <p role="alert">{startFailure}</p>
        <button
          type="button"
          onClick={() => void start()}
          className="min-h-11 rounded-lg border border-foreground/30 px-4 font-bold"
        >
          もう一度試す
        </button>
      </div>
    );
  }

  if (current === null) {
    return <p className="text-center">読み込み中です…</p>;
  }

  const { game, view, totalScore } = current;

  return (
    <div className="flex flex-col gap-4">
      {view.status === "playing" ? (
        <p data-testid="hint-progress" className="text-center font-bold">
          ヒント {view.hintNumber} / {view.maxHints}
        </p>
      ) : (
        <GameResult view={view} totalScore={totalScore} />
      )}
      <HintList hints={view.visibleHints} />
      {notice !== null && (
        <p role={notice.tone} className="font-bold">
          {notice.message}
        </p>
      )}
      {view.status === "playing" && (
        <GuessForm
          value={guess}
          isBusy={isBusy}
          isLastHint={view.hintNumber === view.maxHints}
          inputRef={inputRef}
          onChange={setGuess}
          onSubmit={() =>
            void run(
              () => session.guess(game, guess),
              () => {
                setGuess("");
                setNotice({ tone: "status", message: WRONG_MESSAGE });
                inputRef.current?.focus();
              },
            )
          }
          onSkip={() => void run(() => session.skip(game))}
        />
      )}
    </div>
  );
}
