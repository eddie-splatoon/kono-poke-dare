#!/usr/bin/env bash
# PR の作成者、コミットの名義、本文に、許可されていないアカウントが含まれないことを確認する。
# 必須の環境変数: REPO, PR_NUMBER, PR_AUTHOR, PR_TITLE, PR_BODY
# Dependabot 以外で必須: FORBIDDEN_IDENTITIES(改行区切り。大文字と小文字は区別しない)
set -euo pipefail

allowed_pr_authors=("eddie-splatoon" "dependabot[bot]")
allowed_commit_logins=("eddie-splatoon" "dependabot[bot]" "web-flow")

failures=0

fail() {
  echo "::error::$1"
  failures=$((failures + 1))
}

is_in_list() {
  local value="$1" item
  shift
  for item in "$@"; do
    [[ "$value" == "$item" ]] && return 0
  done
  return 1
}

if ! is_in_list "$PR_AUTHOR" "${allowed_pr_authors[@]}"; then
  fail "PR の作成者が許可リストにありません: $PR_AUTHOR"
fi

commits="$(gh api --paginate "repos/$REPO/pulls/$PR_NUMBER/commits" | jq -s 'add')"

# login を特定できないコミットは "-" になり、許可リストに一致しないので失敗する。
while IFS=$'\t' read -r sha author committer; do
  if ! is_in_list "$author" "${allowed_commit_logins[@]}"; then
    fail "コミット $sha の author が許可リストにありません: $author"
  fi
  if ! is_in_list "$committer" "${allowed_commit_logins[@]}"; then
    fail "コミット $sha の committer が許可リストにありません: $committer"
  fi
done < <(jq -r '.[] | [.sha, (.author.login // "-"), (.committer.login // "-")] | @tsv' <<<"$commits")

# Dependabot の PR にはシークレットが渡らないので、本文の照合を省略する。
if [[ "$PR_AUTHOR" == "dependabot[bot]" ]]; then
  echo "Dependabot の PR のため、本文の照合を省略しました。"
else
  patterns="$(mktemp)"
  trap 'rm -f "$patterns"' EXIT
  # 空行が残るとすべての行に一致してしまうので取り除く。
  tr -d '\r' <<<"${FORBIDDEN_IDENTITIES:-}" | { grep -v '^[[:space:]]*$' || true; } >"$patterns"

  if [[ ! -s "$patterns" ]]; then
    fail "シークレット FORBIDDEN_IDENTITIES が未設定です。"
  else
    if grep -Fqi -f "$patterns" <<<"$PR_TITLE"; then
      fail "PR のタイトルに禁止語が含まれています。"
    fi
    if grep -Fqi -f "$patterns" <<<"$PR_BODY"; then
      fail "PR の本文に禁止語が含まれています。"
    fi

    while IFS= read -r sha; do
      text="$(jq -r --arg sha "$sha" '.[] | select(.sha == $sha) | .commit
        | [.message, .author.name, .author.email, .committer.name, .committer.email] | join("\n")' <<<"$commits")"
      if grep -Fqi -f "$patterns" <<<"$text"; then
        fail "コミット $sha のメッセージまたは名義に禁止語が含まれています。"
      fi
    done < <(jq -r '.[].sha' <<<"$commits")
  fi
fi

if ((failures > 0)); then
  echo "名義チェックに失敗しました($failures 件)。"
  exit 1
fi

echo "名義チェックに成功しました。"
