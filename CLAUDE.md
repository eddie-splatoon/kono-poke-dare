# このポケだーれ?(kono-poke-dare)

@AGENTS.md

## Claude Code 固有の設定

`.claude/settings.json` の SessionStart フックが、セッションの `GH_TOKEN` を `eddie-splatoon` のトークンに設定する。共通の GitHub アカウント規則は `AGENTS.md` を参照する。

`.claude/agents/` の `shard-worker` と `shard-reviewer` は Claude Code 用のサブエージェント定義。既存問題データを全世代にわたって変更するときは、`parallel-data-change` Skill と合わせて使用する。

## clone し直したとき

Git のローカル設定はリポジトリに含まれないので、もう一度設定する。`gh` のパスは環境に合わせる。

```sh
git config --local user.name eddie-splatoon
git config --local user.email "<eddie-splatoon の GitHub に登録したメールアドレス>"
git config --local user.useConfigOnly true
git config --local --replace-all credential.https://github.com.helper ''
git config --local --add credential.https://github.com.helper '!f() { test "$1" = get || exit 0; token="$(/opt/homebrew/bin/gh auth token --user eddie-splatoon)" || exit 1; echo username=eddie-splatoon; echo "password=$token"; }; f'
```

## CI

`.github/workflows/identity.yml` が PR ごとに次の内容を確認する。

- PR の作成者とコミットの author / committer が許可リストにあること
- PR のタイトルと本文、コミットのメッセージと名義に、Actions シークレット `FORBIDDEN_IDENTITIES` の文字列が含まれないこと

禁止語はリポジトリに書かず、シークレットにだけ登録する。
