#!/usr/bin/env bash
# PR の本文に Issue への参照があることを確認する。Dependabot の PR は対象外にする。
# 必須の環境変数: PR_AUTHOR, PR_BODY
set -euo pipefail

if [[ "$PR_AUTHOR" == "dependabot[bot]" ]]; then
  echo "Dependabot の PR のため、Issue への参照の確認を省略しました。"
  exit 0
fi

# 表示されないコメントと、参照として扱われないコードを取り除く。閉じていなければ本文の末尾までが対象になる。
visible_body="$(perl -0pe '
  s/\r\n/\n/g;
  s/<!--.*?(?:-->|\z)//gs;
  s/^ {0,3}(`{3,}|~{3,}).*?(?:^ {0,3}\1[`~]*[ \t]*$|\z)//gms;
  s/`[^`\n]*`//g;
' <<<"${PR_BODY:-}")"

keyword='close[sd]?|fix(e[sd])?|resolve[sd]?|refs?'
pattern="(^|[^[:alnum:]_])(${keyword}):?[[:space:]]+#[1-9][0-9]*([^[:alnum:]_]|\$)"

# macOS と Linux で文字クラスの解釈をそろえるために、バイト単位で照合する。
if LC_ALL=C grep -Eiq "$pattern" <<<"$visible_body"; then
  echo "Issue への参照を確認しました。"
  exit 0
fi

echo "::error::PR の本文に Issue への参照がありません。Closes #N または Refs #N の形で書いてください。"
exit 1
