# Checkerを実行して結果を読む

## 現行検査と移行の境界

Checkerは現在のCRDD仕様を検査する。旧形式からの調査・移行は、フロントAIが[保守の移行条件](../19_Maintenance.md#34-essential-correction-and-compatibility-boundary)に従って実施する。旧形式の棚卸し・自動変換・互換受付をCheckerへ恒久保持しない。

フロントAIは旧成果物の意味と新Owner、利用側、停止・復旧条件を確認して移行し、その後に現在仕様のCheckerを実行する。Checker成功を旧成果物の移行完了証明にはしない。過去Evidenceは当時の記録として維持する。

## 試験台帳と回帰計画

次は試験を起動せず、台帳検査または計画だけを表示する。

```powershell
node 40_Develop/checker/bin/checker.ts --test-catalog --root .
node 40_Develop/checker/bin/checker.ts --test-catalog --root . --base main
node 40_Develop/checker/bin/checker.ts --test-catalog --root . --changed 40_Develop/domain-model/src/test-catalog/inspect.ts --levels unit,integration,system
```

`--changed`、`--base`、`--all`は互いに排他的である。引数不正64、台帳不整合1、Root・読取り・差分観測不能2、台帳検査／計画成功0を返す。成功0は試験Passではなく、常に試験未起動として扱う。手動UAT、外部AI、Windows固有Process制御、高負荷の必要条件を計画から確認し、実行許可がない操作は実行しない。PT／LTは全条件があっても計画のみである。

フロントAI／人間は計画の段階順に実施し、先行失敗時は後続を止め、実施済みと未実施を既存QAへ記録する。Checkerはこの起動・停止・結果収集を自動化しない。適用先は言語や環境に合う実行手段を使う。

CRDD公式Repositoryの開発に限り、各Packageの`npm run check`、`npm run test:run`等を使う。Owner全試験は選択範囲より広いため未許可試験を含めないことを確認する。Coordinator／Docker Isolationの通常とHost Windows入口を分ける。Platform AccessのRust確認は同Packageの`rust:check`、`test:rust:unit`、`test:rust:integration`に移した固定toolchain・明示targetを使う。WorkbenchのSTは`test:system`を通常ITと区別する。Checkerへ移した計画理解UATは人間参加のままで、自動Passにしない。npm成功や手動UATのskipを全体QA成立へ読み替えない。

状態: 現行の操作手順
担当責任者: Qual-Lab
最終更新日: 2026-08-31

## 通常の全体確認

検証済みNode.jsと対象Repositoryの絶対Pathを使う。次は公式CRDD Repositoryの例であり、採用先では配布済みの`tools/crdd-check.ts`を指定する。

```powershell
& "C:\Program Files\nodejs\node.exe" "C:\project\CRDD\40_Develop\checker\bin\checker.ts" --root "C:\project\CRDD" --json --summary
```

`--root`を省略すると起動Directoryが対象になる。subdirectoryからの起動をRepository全体確認と誤認しない。通常Checkerは文書を書き換えず、Providerへ送信しない。

## 中間確認と参照調査

### Semanticの確認と明示保存

意味IR・Relation・Coverageの固定二領域確認は、同じ入口へ`--semantic --root "C:\project\CRDD"`を指定する。既定はJSON表示のみで、`--write`を追加した場合だけ従来の`07_Quality/Registry/semantic-coverage-pilot.json`へ保存する。保存先Directoryは既存であることを前提とし、観測不能や入力不成立では書き込まない。これは全領域対応や品質Passを意味しない。

`npm run semantic --prefix 40_Develop/checker`からも同じ入口を使える。SemanticでRootを省略した場合だけ、起動Directoryを含む最寄りの検証済みRepositoryを対象とする。通常文書検査の対象選択は変えない。Semantic入口は成功0、検査不成立1、実行不能・保存失敗2、引数不正64を返す。生成Schemaや既存Snapshotの形式をPackage移管だけで変更しない。

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

通常のChange記録とWork Lifecycle Evidence内部のリンクはCheckerで検査する。本文を変更できない固定履歴の参照は、CRDD Official Current Profileが承認済み移行表を使って機械的に解決する。固定原文Identity、過去Git object、移行表およびRelease主張の真正性は、Checkerではなく対象を固定した独立監査で確認する。固定履歴の扱いを現行正本、案内、ひな型または改変可能なChange／Evidenceのリンク切れへ流用しない。

## 開発試験は別の操作

`40_Develop/checker`の型・命名・契約試験は通常Checkerとは別で、一時fixtureと子Processを使う。一時物はRepository-local `.crdd/tests/checker/<run-id>/`等の実行単位で所有し、子Processへ渡す場合もそのRunだけへ限定して終了後の不存在を確認する。OS全体の環境変数を変更しない。詳細は[設計](../06_Architecture/Details/checker/01_Architecture.md)と[コーディング規約](../06_Architecture/99_Coding_Standards.md)。

通常の全回帰は次の単一入口を使う。

```powershell
npm test --prefix 40_Develop/checker
```

この入口は`format:check`、`typecheck`、`lint`、Repository全体Checker、Checker試験本体の順にFail Fastで実行する。前段が失敗した場合、後段の試験本体は開始しない。`format:check`が失敗した場合だけ、差分を確認して`npm run format --prefix 40_Develop/checker`を明示実行し、同じ全回帰入口を最初から再実行する。原因確認のため`test:run`を直接使う場合は、同じ固定改訂版で静的段階が成功済みであることを前提とし、その結果だけを全回帰完了としない。
