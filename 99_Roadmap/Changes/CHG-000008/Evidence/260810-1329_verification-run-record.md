# CHG-000008 固定後検証実行記録

対象変更: [CHG-000008](../CHG-000008_Convergent_Remediation_and_Evidence_Identity.md)

## 結論

固定コミット`f5208227332ddda9d7ad4bca56e4e543abacf0b0`だけを展開した分離worktreeで全体Checkerを実行し、エラー0件、警告0件で完了した。固定Treeの所有ファイル83件、分離worktreeの通常ファイル83件、Checkerの発見ファイル83件は一致した。実行直前と直後のHEAD、Root Treeおよびworktree状態にも変化はなかった。

この結果は文書の意味、専門品質、準拠判定または人間によるリリース判断を代替しない。独立レビューと監査は別に実施する。

## 宣言対象

- リポジトリ: `qual-lab/CRDD`
- ブランチ上の固定元: `feature/v0.14.0-convergence`
- 分離worktree: `C:\project\CRDD-IR\v014-f520822-check`
- 分離worktree状態: detached HEAD
- 基準main: `00e791d4897897c4f49ba0c07d0f7e9d2536df4e`
- Object Format: `sha1`
- Commit OID: `f5208227332ddda9d7ad4bca56e4e543abacf0b0`
- Root Tree OID: `33d9a8b5d96ec4f3b431dcd165c3fb946ecb751d`
- 対象Path: 固定コミットが所有するリポジトリ全体
- Submodule: `.gitmodules`なし、Git Indexのmode `160000`は0件、Checkerの観測gitlinkは0件

## 実観測対象と実行対象

同じ実行記録内で、Checker実行の直前と直後に対象を観測した。

| 観測 | 実行直前 | 実行直後 |
|---|---|---|
| HEAD OID | `f5208227332ddda9d7ad4bca56e4e543abacf0b0` | `f5208227332ddda9d7ad4bca56e4e543abacf0b0` |
| Root Tree OID | `33d9a8b5d96ec4f3b431dcd165c3fb946ecb751d` | `33d9a8b5d96ec4f3b431dcd165c3fb946ecb751d` |
| tracked差分 | なし | なし |
| 未追跡物 | なし | なし |

- `git ls-tree -r --name-only HEAD`の対象: 83件
- 分離worktree内の通常ファイル: 83件
- Checkerの`files_discovered`: 83件
- 分離worktreeの`.git`はGit動作に必要な接続情報を持つ管理ファイルであり、固定Treeの成果物母集団には含めない
- Checkerは`git ls-files --cached --others --exclude-standard`を用いるが、分離worktreeに固定Tree外の通常ファイルと未追跡物は存在しなかった
- 実行後に対象worktree外へ保存した本記録とChecker完全結果は、実行対象を増やしていない
- 元のworktreeにある未追跡の`CRDD_Introduction.pptx`は移動、削除または変更しておらず、分離worktreeには存在しない

## 実行条件

- 実行主体: CRDD保守タスクの親エージェント`/root`
- 実行環境: `Microsoft Windows NT 10.0.26200.0`
- Git: `git version 2.54.0.windows.1`
- Node.js: `v22.18.0`
- Node実行物: `C:\Program Files\nodejs\node.exe`
- Node実行物SHA-256: `C22D1C59A1F767A1ED0178445A027F2257D318C55430FC819D48F269586822B7`
- Checker: 固定コミット内の`template/tools/crdd_check.mjs`
- Checker SHA-256: `2013153F0DCEBB71795725D7D888C63514AD8A6D5D370E7A1CDCB4272CC4CE17`
- コマンド: `node template/tools/crdd_check.mjs --json --summary`
- 開始時刻（UTC）: `2026-08-10T04:22:20.0482762Z`
- 終了時刻（UTC）: `2026-08-10T04:22:21.0001224Z`
- Checker内部実行時刻（UTC）: `2026-08-10T04:22:20.434Z`
- Checker内部所要時間: `552 ms`
- Exit Code: `0`

## 完全結果

- [Checker完全結果](CHG-000008_Checker_Run_f520822.json)
- 出力SHA-256: `A061620469F0F04263526478D41407506C00F145D432439B231CDCF3EC0FB029`
- 発見ファイル: 83件
- Markdown: 62件中62件
- ローカルリンク: 1,256件
- アンカー: 457件
- 版付き正本文書: 24件
- 是正表: 22行
- Error: 0件
- Warning: 0件

実行ラッパーでは、利用者領域のGit global ignoreへアクセスできない警告が標準エラーに出た。リポジトリのGit管理対象の発見、Checkerの実行、Exit Codeおよび結果には影響していない。Checker自身もGit-ignoredファイルを未確認範囲として明示している。

## 以前の実行との関係

固定コミット`f7ff5797441c0fa3af0d339f76c1bc807209cae8`の実行では、元のworktreeにあった未追跡PPTXをCheckerが発見し、固定Tree 83件に対して発見ファイルが84件になった。その実行記録は`Invalidated`として履歴保持し、現在の解消判定またはRelease Handoffには使用しない。

## 未評価範囲

- 文書規範の意味、判断の妥当性、専門品質および準拠判定
- 未追跡の`CRDD_Introduction.pptx`
- Git-ignoredファイル
- リリース後の再監査往復回数とAI処理コストの改善量
- 人間によるリリース判断
