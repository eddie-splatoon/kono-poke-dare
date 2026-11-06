import type { FormEvent, Ref } from "react";

const BUTTON_BASE =
  "min-h-11 rounded-lg px-4 font-bold disabled:cursor-not-allowed disabled:opacity-50";

export function GuessForm({
  value,
  isBusy,
  isLastHint,
  inputRef,
  onChange,
  onSubmit,
  onSkip,
}: {
  readonly value: string;
  readonly isBusy: boolean;
  readonly isLastHint: boolean;
  readonly inputRef: Ref<HTMLInputElement>;
  readonly onChange: (value: string) => void;
  readonly onSubmit: () => void;
  readonly onSkip: () => void;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="font-bold">回答</span>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          enterKeyHint="send"
          maxLength={50}
          placeholder="名前を入力"
          className="min-h-11 w-full rounded-lg border border-foreground/30 bg-background px-3 text-base"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onSkip}
          disabled={isBusy}
          className={`${BUTTON_BASE} border border-foreground/30`}
        >
          {isLastHint ? "あきらめる" : "次のヒントへ"}
        </button>
        <button
          type="submit"
          disabled={isBusy}
          className={`${BUTTON_BASE} bg-foreground text-background`}
        >
          回答する
        </button>
      </div>
    </form>
  );
}
