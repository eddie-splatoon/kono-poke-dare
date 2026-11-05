#!/usr/bin/env bash
# Claude Code のセッション内で実行する gh を、このリポジトリの操作アカウントに固定する。
# トークンはセッション用の環境ファイルにだけ書き出し、リポジトリには保存しない。
set -euo pipefail

account="eddie-splatoon"

if [[ -z "${CLAUDE_ENV_FILE:-}" ]]; then
  echo "CLAUDE_ENV_FILE が未設定のため、gh のアカウントを固定できませんでした。" >&2
  exit 1
fi

if ! token="$(gh auth token --user "$account" 2>/dev/null)" || [[ -z "$token" ]]; then
  echo "gh に $account のログイン情報がありません。gh auth login で追加してください。" >&2
  exit 1
fi

printf 'export GH_TOKEN=%q\n' "$token" >>"$CLAUDE_ENV_FILE"
