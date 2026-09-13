# Checkerを実行して結果を読む

状態: 現行の操作手順
担当責任者: Qual-Lab
最終更新日: 2026-08-31

## 通常の全体確認

検証済みNode.jsと対象Repositoryの絶対Pathを使う。次は公式CRDD Repositoryの例であり、採用先では配布済みの`tools/crdd-check.ts`を指定する。

```powershell
& "C:\Program Files\nodejs\node.exe" "C:\project\CRDD\40_Develop\checker\crdd-check.ts" --root "C:\project\CRDD" --json --summary
```

`--root`を省略すると起動Directoryが対象になる。subdirectoryからの起動をRepository全体確認と誤認しない。通常Checkerは文書を書き換えず、Providerへ送信しない。

## 中間確認と参照調査

- 限定確認は上記へ`--scope 04_UI`等を追加する。直接の参照先・参照元が一段追加され、全体の構造等も検査されるが、全体確認の代替ではない。
- 参照関係を調べる場合は`--json --summary --references 04_UI/01_User_Interface.md`のようにRoot相対の対象を指定する。`--references`だけでは引数不足になる。
- 人間向けテキストは`--json`なし、指摘配列だけ必要なら`--json`単独を使う。範囲・未確認を引き渡す監査入力にはsummaryを使う。

## 結果から次へ

| 結果 | 次の操作 |
|---|---|
| exit 0 | warning、`unchecked`、範囲、発見方式も確認。専門品質や準拠の認定とはしない |
| exit 1 | 指摘の所有文書を修正し、同じ対象で再確認 |
| 引数拒否・exit 2 | 引数を直す。`--help`は現行未対応 |
| JSONが途中／例外／中断 | 完全な結果として採用しない。原因を確認して再実行 |

Gitを使えずFilesystem探索へ移った場合は理由と除外を読む。Root外、symbolic link／junction、Gitlinkまたは除外された対象を、リンク先が存在するだけで確認済みにしない。

Change記録とWork Lifecycle Evidence内部の参照、過去の移行Evidence、固定Commit／BlobまたはRelease主張の真正性は、Checkerではなく対象を固定した独立監査で確認する。通常Checkerは現在のCanonical配置、禁止された旧Path、現行正本・案内・ひな型のリンクだけを検査する。

## 開発試験は別の操作

`40_Develop/checker`の型・命名・契約試験は通常Checkerとは別で、一時fixtureと子Processを使う。一時物はRepository-local `.crdd/tests/checker/<run-id>/`等の実行単位で所有し、子Processへ渡す場合もそのRunだけへ限定して終了後の不存在を確認する。OS全体の環境変数を変更しない。詳細は[設計](../06_Architecture/checker/01_Architecture.md)と[コーディング規約](../06_Architecture/99_Coding_Standards.md)。
