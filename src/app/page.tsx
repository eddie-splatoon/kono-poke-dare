export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-bold">このポケだーれ?</h1>
      <p>10 個のヒントで当てる、1 日 1 回のゲームです。ただいま準備中です。</p>
      <p className="text-sm opacity-70">
        非公式のファン作品です。権利者とは関係ありません。
        権利者の方からのご連絡は、
        <a
          className="underline"
          href="https://github.com/eddie-splatoon/kono-poke-dare/issues"
        >
          GitHub の Issue
        </a>
        で受け付けます。
      </p>
    </main>
  );
}
