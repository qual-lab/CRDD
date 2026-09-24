# CHG-000008 固定後検証実行記録

状態: `Invalidated`

この記録は監査履歴として保持する。Checkerが未追跡の`CRDD_Introduction.pptx`も発見していたため、固定Treeと実行対象が一致していなかった。本文中の「Checkerの入力ではない」という当時の判断は誤りであり、現在の解消判定またはRelease Handoffには使用しない。後続の固定コミット`f5208227332ddda9d7ad4bca56e4e543abacf0b0`を、未追跡物のない分離worktreeで再検証した。

対象変更: [CHG-000008](../CHG-000008_Convergent_Remediation_and_Evidence_Identity.md)

## 結論

固定コミット`f7ff5797441c0fa3af0d339f76c1bc807209cae8`に対する全体Checkerは、エラー0件、警告0件で完了した。実行直前と直後のHEAD、Root Treeおよびtracked差分は一致し、結果生成まで対象状態の変化はなかった。

この結果は文書の意味、専門品質、準拠判定または人間によるリリース判断を代替しない。独立レビューと監査は別に実施する。

## 宣言対象

- リポジトリ: `qual-lab/CRDD`
- ブランチ: `feature/v0.14.0-convergence`
- 基準main: `00e791d4897897c4f49ba0c07d0f7e9d2536df4e`
- Object Format: `sha1`
- Commit OID: `f7ff5797441c0fa3af0d339f76c1bc807209cae8`
- Root Tree OID: `b0029e919d05a940dfb99e2e00aa01b1b36bcc8e`
- 対象Path: 固定コミットが所有するリポジトリ全体
- Submodule: `.gitmodules`なし、Git Indexのmode `160000`は0件、Checkerの観測gitlinkは0件

## 実観測対象と実行対象

同じ実行記録内で、Checker実行の直前と直後に対象を観測した。

| 観測 | 実行直前 | 実行直後 |
|---|---|---|
| HEAD OID | `f7ff5797441c0fa3af0d339f76c1bc807209cae8` | `f7ff5797441c0fa3af0d339f76c1bc807209cae8` |
| Root Tree OID | `b0029e919d05a940dfb99e2e00aa01b1b36bcc8e` | `b0029e919d05a940dfb99e2e00aa01b1b36bcc8e` |
| trackedなIndex／Worktree差分 | なし | なし |

- 未追跡の`CRDD_Introduction.pptx`は実行前から存在するが、Git管理対象を探索するCheckerの入力ではなく、本検証の対象外である
- CheckerはGit管理対象84ファイルを発見し、Markdown 62件を確認した
- Git-ignoredファイルはCheckerの未確認範囲である。CheckerがGit管理対象を入力とするため本実行の対象には含めない
- 実行後に追加した本記録とChecker完全結果は固定コミットに含まれず、実行時の対象を変更していない

## 実行条件

- 実行主体: CRDD保守タスクの親エージェント`/root`
- 実行環境: `Microsoft Windows NT 10.0.26200.0`
- Git: `git version 2.54.0.windows.1`
- Node.js: `v22.18.0`
- Node実行物: `C:\Program Files\nodejs\node.exe`
- Node実行物SHA-256: `C22D1C59A1F767A1ED0178445A027F2257D318C55430FC819D48F269586822B7`
- Checker: `template/tools/crdd_check.mjs`
- Checker SHA-256: `2013153F0DCEBB71795725D7D888C63514AD8A6D5D370E7A1CDCB4272CC4CE17`
- コマンド: `node template/tools/crdd_check.mjs --json --summary`
- 開始時刻（UTC）: `2026-08-10T04:17:02.5524706Z`
- 終了時刻（UTC）: `2026-08-10T04:17:03.2292794Z`
- Checker内部実行時刻（UTC）: `2026-08-10T04:17:02.847Z`
- Checker内部所要時間: `363 ms`
- Exit Code: `0`

## 完全結果

- [Checker完全結果](CHG-000008_Checker_Run_f7ff579.json)
- 出力SHA-256: `FF47450115A443C7C95EA5D62E77B4DECDB25AC4338EA22958092C6F2662AE30`
- Markdown: 62件中62件
- ローカルリンク: 1,256件
- アンカー: 457件
- 版付き正本文書: 24件
- 是正表: 22行
- Error: 0件
- Warning: 0件

実行ラッパーでは、利用者領域のGit global ignoreへアクセスできない警告が標準エラーに出た。リポジトリのGit管理対象の発見、Checkerの実行、Exit Codeおよび結果には影響していない。Checker自身もGit-ignoredファイルを未確認範囲として明示している。

## 未評価範囲

- 文書規範の意味、判断の妥当性、専門品質および準拠判定
- 未追跡の`CRDD_Introduction.pptx`
- Git-ignoredファイル
- リリース後の再監査往復回数とAI処理コストの改善量
- 人間によるリリース判断
