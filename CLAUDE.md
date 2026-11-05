# このポケだーれ?(kono-poke-dare)

## 操作アカウント

このリポジトリのコミット、PR、Issue はすべて `eddie-splatoon` 名義にする。他の人間のアカウント名やメールアドレスを、コミット履歴、PR、Issue、リポジトリ内のファイルに書かない。

`gh auth switch` は他のリポジトリにも影響するので使わない。

### Claude Code

`.claude/settings.json` の SessionStart フックが、セッションの `GH_TOKEN` を `eddie-splatoon` のトークンに設定する。

作業前に `gh api user --jq .login` の結果が `eddie-splatoon` であることを確認する。別のアカウントが表示されたら、`gh` と `git push` を実行せず、原因を解消する。

### 手元のターミナル

`git push` はリポジトリの credential helper が `eddie-splatoon` を使う。`gh` は次のようにアカウントを指定して実行する。

```sh
GH_TOKEN="$(gh auth token --user eddie-splatoon)" gh pr create
```

### IDE

GitHub 連携の既定アカウントを `eddie-splatoon` にしてから、PR の作成やレビューを行う。

### clone し直したとき

Git のローカル設定はリポジトリに含まれないので、もう一度設定する。`gh` のパスは環境に合わせる。

```sh
git config --local user.name eddie-splatoon
git config --local user.email "<eddie-splatoon の GitHub に登録したメールアドレス>"
git config --local user.useConfigOnly true
git config --local --replace-all credential.https://github.com.helper ''
git config --local --add credential.https://github.com.helper '!f() { test "$1" = get || exit 0; token="$(/opt/homebrew/bin/gh auth token --user eddie-splatoon)" || exit 1; echo username=eddie-splatoon; echo "password=$token"; }; f'
```

### CI

`.github/workflows/identity.yml` が PR ごとに次の内容を確認する。

- PR の作成者とコミットの author / committer が許可リストにあること
- PR のタイトルと本文、コミットのメッセージと名義に、Actions シークレット `FORBIDDEN_IDENTITIES` の文字列が含まれないこと

禁止語はリポジトリに書かず、シークレットにだけ登録する。
