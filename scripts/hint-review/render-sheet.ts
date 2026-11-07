import type { Criterion } from "./criteria.ts";
import type { ReviewEntry } from "./load-review-entries.ts";

export type ReviewSheetData = {
  readonly entries: readonly ReviewEntry[];
  readonly criteria: readonly Criterion[];
};

// 通信を禁止する。ブラウザの外へ採点を送らないことを、構造で保証する。
const CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'";

const STYLE = `
:root { color-scheme: light dark; --line: #8886; --accent: #2563eb; --warn: #b91c1c; --soft: #8882; }
* { box-sizing: border-box; }
body { margin: 0; font: 15px/1.6 system-ui, sans-serif; }
header { position: sticky; top: 0; z-index: 1; padding: 8px 16px; background: Canvas; border-bottom: 1px solid var(--line); }
h1 { margin: 0; font-size: 18px; }
.controls { display: flex; flex-wrap: wrap; gap: 4px 16px; align-items: center; margin-top: 4px; }
.small { font-size: 13px; opacity: .8; }
.status:empty { display: none; }
.status { margin: 4px 0 0; font-weight: 600; }
main { max-width: 960px; margin: 0 auto; padding: 16px; }
details { margin-bottom: 16px; }
article { scroll-margin-top: 160px; margin-bottom: 16px; padding: 12px 16px; border: 1px solid var(--line); border-radius: 8px; }
article.active { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
h2 { margin: 0; font-size: 16px; }
.note { margin: 4px 0; padding: 2px 8px; background: var(--soft); border-left: 3px solid var(--warn); }
ol { margin: 8px 0; padding-left: 28px; }
li.hand { font-weight: 700; }
fieldset { margin: 8px 0 0; padding: 0; border: 0; }
legend { padding: 0; font-weight: 600; }
fieldset label { display: inline-block; margin-right: 12px; }
textarea { display: block; width: 100%; margin-top: 8px; font: inherit; }
.warning { margin: 4px 0 0; color: var(--warn); font-weight: 600; }
nav { display: flex; gap: 12px; align-items: center; justify-content: center; }
`;

const BODY = `
<header>
  <h1>ヒントの評価シート</h1>
  <div class="controls">
    <span><label for="filter-generation">世代</label> <select id="filter-generation"></select></span>
    <span><input type="checkbox" id="filter-unscored"> <label for="filter-unscored">未採点のみ</label></span>
    <span><input type="checkbox" id="filter-priority"> <label for="filter-priority">優先のみ</label></span>
    <span><input type="checkbox" id="filter-needs-fix"> <label for="filter-needs-fix">要修正のみ</label></span>
    <button type="button" id="export-csv">CSV を書き出す</button>
    <span><label for="import-csv">CSV を取り込む</label> <input type="file" id="import-csv" accept=".csv,text/csv"></span>
  </div>
  <p class="small" id="progress"></p>
  <p class="status" id="status" role="status"></p>
</header>
<main>
  <details>
    <summary>採点の基準とキー操作</summary>
    <div id="legend"></div>
    <p>キー: <kbd>1</kbd>〜<kbd>5</kbd> で次の未採点の観点に評点を付ける。<kbd>0</kbd> は NA(判断できない)。<kbd>c</kbd> でコメント欄へ移り、<kbd>Esc</kbd> で抜ける。5 観点が揃うと次のカードへ移る。2 以下の評点があってコメントが空なら、先にコメント欄へ移る。</p>
    <p>太字は手書きのヒントである。いずれかが 2 以下の種族を要修正とする。採点はこのブラウザに自動で保存する。別の場所で続けるときは CSV を書き出して取り込む。</p>
  </details>
  <div id="cards"></div>
  <nav>
    <button type="button" id="previous-page">前のページ</button>
    <span id="page-label"></span>
    <button type="button" id="next-page">次のページ</button>
  </nav>
</main>
`;

/** JSON を script 要素に入れても、要素が閉じないようにする。 */
function embedJson(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

/** データとブラウザ用のコードを埋め込んだ、単一の HTML を作る。 */
export function renderReviewSheet(
  data: ReviewSheetData,
  clientSource: string,
): string {
  if (/<\/script/i.test(clientSource)) {
    throw new Error("ブラウザ用のコードに </script を含められません");
  }
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ヒントの評価シート</title>
<style>${STYLE}</style>
</head>
<body>${BODY}
<script type="application/json" id="review-data">${embedJson(data)}</script>
<script type="module">${clientSource}</script>
</body>
</html>
`;
}
