import Link from "next/link";
import { RIGHTS_FORM_URL } from "./contact";
import { GameClient } from "./game-client";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 p-4">
      <header className="text-center">
        <h1 className="text-3xl font-bold">このポケだーれ?</h1>
        <p>10 個のヒントで当てる、1 日 1 回のゲームです。</p>
      </header>
      <GameClient />
      <footer className="mt-auto text-center text-sm opacity-70">
        <p>
          {/* たまに開くだけのページなので、遊んでいる間に事前取得しない。 */}
          <Link className="underline" href="/about" prefetch={false}>
            データの扱いと権利について
          </Link>
        </p>
        <p>
          非公式のファン作品です。権利者とは関係ありません。
          権利者の方からのご連絡は、
          <a className="underline" href={RIGHTS_FORM_URL}>
            専用のフォーム
          </a>
          で受け付けます。
        </p>
      </footer>
    </main>
  );
}
