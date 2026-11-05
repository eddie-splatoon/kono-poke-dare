#!/usr/bin/env bash
# ブランチごとの Git worktree を作成し、PR のマージ後に削除する。
# 仕様: docs/specs/worktree-tool.md
set -euo pipefail

readonly ACCOUNT="eddie-splatoon"
readonly WORKTREES_DIR=".claude/worktrees"

usage() {
  cat >&2 <<'EOF'
使い方:
  scripts/worktree.sh new <branch> [--base <ref>]
      <branch> の worktree を作り、依存をインストールする。最終行に絶対パスを出す
      分岐元の既定は origin/main
  scripts/worktree.sh clean
      PR がマージ済みで、変更のない worktree とローカルブランチを削除する
EOF
  exit 2
}

die() {
  echo "$*" >&2
  exit 1
}

repo_root() {
  dirname "$(git rev-parse --path-format=absolute --git-common-dir)"
}

ensure_account() {
  if [[ -z "${GH_TOKEN:-}" ]]; then
    GH_TOKEN="$(gh auth token --user "$ACCOUNT")" ||
      die "gh に $ACCOUNT のログイン情報がありません。"
    export GH_TOKEN
  fi

  local login
  login="$(gh api user --jq .login)" || die "gh のアカウントを確認できませんでした。"
  [[ "$login" == "$ACCOUNT" ]] ||
    die "gh のアカウントが $login です。$ACCOUNT で実行してください。"
}

clean_worktree() {
  local path="$1" branch="$2" current="$3"

  if [[ -z "$branch" ]]; then
    echo "残す: $path (ブランチがありません)"
    return
  fi

  local merged_heads
  merged_heads="$(gh pr list --head "$branch" --state merged --json headRefOid --jq '.[].headRefOid')" ||
    die "$branch の PR を確認できませんでした。"
  if [[ -z "$merged_heads" ]]; then
    echo "残す: $path (マージ済みの PR がありません)"
    return
  fi

  if ! grep -Fxq "$(git -C "$path" rev-parse HEAD)" <<<"$merged_heads"; then
    echo "残す: $path (HEAD がマージ済みの PR と異なります)"
    return
  fi

  if [[ -n "$(git -C "$path" status --porcelain)" ]]; then
    echo "残す: $path (未コミットの変更か、追跡外のファイルがあります)"
    return
  fi

  if [[ "$path" == "$current" ]]; then
    echo "残す: $path (実行中の worktree です。親のチェックアウトで clean を実行してください)"
    return
  fi

  git worktree remove "$path"
  git branch -D "$branch" >/dev/null
  echo "削除: $path ($branch)"
}

cmd_clean() {
  [[ $# -eq 0 ]] || usage
  ensure_account

  local root current
  root="$(repo_root)"
  current="$(git rev-parse --show-toplevel)"
  git worktree prune

  local line path="" branch=""
  # ループ内のコマンドが標準入力を読まないように、一覧は別の記述子で渡す。
  while IFS= read -r line <&3; do
    case "$line" in
      "worktree "*)
        path="${line#worktree }"
        branch=""
        ;;
      "branch refs/heads/"*)
        branch="${line#branch refs/heads/}"
        ;;
      "")
        if [[ "$path" == "$root/$WORKTREES_DIR/"* ]]; then
          clean_worktree "$path" "$branch" "$current"
        fi
        ;;
    esac
  done 3< <(git worktree list --porcelain)
}

cmd_new() {
  [[ $# -ge 1 ]] || usage
  local branch="$1" base="origin/main"
  shift
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --base)
        [[ $# -ge 2 ]] || usage
        base="$2"
        shift 2
        ;;
      *)
        usage
        ;;
    esac
  done

  # --branch は @{-1} を展開するので、入力と一致することまで確かめる。
  [[ "$(git check-ref-format --branch "$branch" 2>/dev/null)" == "$branch" ]] ||
    die "ブランチ名が不正です: $branch"
  if git rev-parse --verify --quiet "refs/heads/$branch" >/dev/null; then
    die "ブランチがすでにあります: $branch"
  fi

  local path
  path="$(repo_root)/$WORKTREES_DIR/${branch//\//-}"
  [[ ! -e "$path" ]] || die "すでに存在します: $path"

  # ブラウザでマージされた分を回収する。標準出力の最終行はパスに使うので、標準エラーへ流す。
  bash "${BASH_SOURCE[0]}" clean >&2 ||
    echo "警告: clean に失敗しました。worktree の作成は続けます。" >&2

  git fetch origin >&2
  git rev-parse --verify --quiet "$base^{commit}" >/dev/null ||
    die "分岐元が見つかりません: $base"

  git worktree add --quiet --no-track -b "$branch" "$path" "$base" >&2
  (cd "$path" && pnpm install --frozen-lockfile) >&2 ||
    die "依存のインストールに失敗しました。worktree は残しています: $path"

  echo "$path"
}

case "${1:-}" in
  new)
    shift
    cmd_new "$@"
    ;;
  clean)
    shift
    cmd_clean "$@"
    ;;
  *)
    usage
    ;;
esac
