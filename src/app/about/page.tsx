import type { Metadata } from "next";
import Link from "next/link";
import { RIGHTS_FORM_URL } from "@/app/contact";

export const metadata: Metadata = {
  title: "データの扱いと権利について | このポケだーれ?",
  description:
    "記録の保存先、外部へ送信しないこと、消す方法、権利者の方の連絡先を説明します。",
};

const SECTION_CLASS = "flex flex-col gap-2";
const HEADING_CLASS = "text-xl font-bold";

export default function AboutPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 p-4">
      <header className="text-center">
        <h1 className="text-3xl font-bold">データの扱いと権利について</h1>
      </header>

      <section className={SECTION_CLASS}>
        <h2 className={HEADING_CLASS}>保存するもの</h2>
        <p>記録は、お使いの端末のブラウザの中にだけ保存します。</p>
        <p>
          保存するのは、遊んだ日付、問題の番号、進行状況(状態、見たヒントの番号、得点)です。保存先はブラウザの
          IndexedDB で、Cookie は使いません。
        </p>
        <p>入力した回答の文字列は保存しません。</p>
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={HEADING_CLASS}>外部への送信</h2>
        <p>ログインはありません。</p>
        <p>記録と回答を外部へ送信しません。解析ツールと広告もありません。</p>
        <p>
          通信するのは、ページと問題データを取得するときだけです。このサイトは
          GitHub Pages で配信しているので、取得の際のアクセスログを GitHub
          が持っている可能性があります。
        </p>
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={HEADING_CLASS}>記録を消す方法</h2>
        <p>
          ブラウザの設定から、eddie-splatoon.github.io
          のサイトデータを削除すると消えます。項目の名前と手順は、ブラウザごとに異なります。
        </p>
        <p>
          削除の対象はドメイン全体です。同じドメインの他のプロジェクトのデータも消える可能性があります。
        </p>
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={HEADING_CLASS}>消えた記録について</h2>
        <p>消えた記録は元に戻せません。</p>
        <p>
          これまでの記録と累積スコアがすべてなくなります。サーバーに控えはなく、別の端末への引き継ぎもできません。
        </p>
        <p>ブラウザの判断で記録が消えることがあります。</p>
        <p>
          ゲームを終えたときに、記録を消さないようブラウザに依頼しますが、許可されるとは限りません。依頼の際に、ブラウザが確認を表示することがあります。
        </p>
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={HEADING_CLASS}>権利について</h2>
        <p>
          非公式のファン作品です。任天堂、株式会社ポケモン、その他の権利者とは関係ありません。公式の画像、ロゴ、音声は使用しません。収益化はしていません。
        </p>
        <p>
          権利者の方からのご連絡は、
          <a className="underline" href={RIGHTS_FORM_URL}>
            権利者の方の連絡フォーム
          </a>
          で受け付けます。申し立てがあれば、公開を停止します。フォームの内容は公開の
          Issue になり、送信には GitHub
          のアカウントが必要です。個人情報は書かないでください。
        </p>
      </section>

      <footer className="mt-auto text-center">
        <Link className="underline" href="/" prefetch={false}>
          ゲームに戻る
        </Link>
      </footer>
    </main>
  );
}
