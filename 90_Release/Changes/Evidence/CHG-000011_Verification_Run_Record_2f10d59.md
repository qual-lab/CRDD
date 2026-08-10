# CHG-000011 固定後検証実行記録（2f10d59）

## 1. 宣言対象

- 変更トレース: `CHG-000011`
- Repository: Qual-Lab / CRDD公式リポジトリ
- Object Format: `sha1`
- Commit OID: `2f10d59493b3751c64a037c6833017bfe528c4ec`
- Root Tree OID: `afd18cf3bed077f9227140ca32c37333150e001d`
- 親Commit: `a902d97277b5c17bd679560c7438e099de579bf9`
- 基準main: `bf0afd981474d5c9d62716717b84adf8363a2189`（v0.16.0公開結果を含むmain）
- 対象Path: 固定Commitの全Tree
- 実行場所: `C:\project\CRDD-IR\v017-2f10d59`のdetached分離worktree
- 出力場所: 固定対象外で生成後、`90_Release/Changes/Evidence/`へ固定後記録として追加

## 2. 実観測対象と実行対象

| 項目 | 実行直前／対象 | 実行直後 |
|---|---|---|
| Observed HEAD | `2f10d59493b3751c64a037c6833017bfe528c4ec` | 同一 |
| Root Tree | `afd18cf3bed077f9227140ca32c37333150e001d` | 同一 |
| Git Tree所有ファイル | 138 | 138 |
| 分離worktree通常ファイル | 138 | 138 |
| Checker discovery | 138 | 実行結果に固定 |
| Index差分 | なし | なし |
| Worktree差分 | なし | なし |
| 未追跡ファイル | 0 | 0 |
| Submodule | `.gitmodules`およびmode `160000`のTree entryなし | 同一 |

固定Treeだけを展開した分離worktreeで実行し、Checker JSONとTAPは対象worktree外へ出力した。HEAD、Root Tree、Index／Worktree差分、未追跡状態を実行前後で照合した。Git-ignoredファイルは未確認範囲である。

## 3. 実行環境と実行物

- 実行日: 2026-08-10（Asia/Tokyo）
- Runtime: Node.js `v22.18.0`
- Checker: 固定Commit内の`tools/crdd_check.mjs`
- Test: 固定Commit内の`tools/crdd_check.test.mjs`および`tools/crdd_check_fault_injector.cjs`
- Checker command: `node tools/crdd_check.mjs --json --summary`
- Test command: `node --test --experimental-test-coverage tools/crdd_check.test.mjs`
- Checker開始時点: `2026-08-10T10:27:09.864Z`
- Checker duration: `648 ms`
- Test開始時点: `2026-08-10T19:27:17.4484515+09:00`
- Test終了時点: `2026-08-10T19:27:42.5614515+09:00`
- Test duration: `25112.8597 ms`

## 4. 実行結果

### 4.1. 全体Checker

- JSON: [`CHG-000011_Checker_Run_2f10d59.json`](CHG-000011_Checker_Run_2f10d59.json)
- SHA-256: `4FCCE25AFB62E12A465E150B5A27F2A8A4564838F1C8AED5A5B414C5627C77D1`
- Tree所有ファイル／通常ファイル／discovery: `138 / 138 / 138`
- Markdown: `97`
- Links: `1489`
- Anchors: `522`
- Version documents: `26`
- Remediation rows: `54`
- Error: `0`
- Warning: `0`

### 4.2. Checker回帰試験

- TAP: [`CHG-000011_Test_Run_2f10d59.tap`](CHG-000011_Test_Run_2f10d59.tap)
- SHA-256: `DA05EE926CE3FF9E87CAFAB7F3ECE2D0ED1EEBC0D45C33FF2385A1EF0C3CD046`
- Tests: `139`
- Pass: `139`
- Fail: `0`
- Checker line coverage: `100.00%`
- Checker branch coverage: `100.00%`
- Checker function coverage: `97.32%`

Checkerと試験は固定Commit内の実装を使用した。Checkerの構造確認と回帰試験は、専門探索、視覚制作、許可した処理境界、外部情報境界、C-11、PL-19の意味的な正しさ、外部サービスの安全性または実行時強制の成立を証明しない。

## 5. 旧固定候補との境界

`d0e8dc8`、`0a5d232`および`a902d97`のRun Recordは`Invalidated`であり、対応するChecker JSON、TAPまたは独立監査結果を本固定候補の解消判定、準拠判定またはリリース引き渡しへ流用していない。本記録は、DOC-017-R02を含む監査集合の統合修正方針を指摘元へ再提示して合意後に作成した新しい固定Commit／Treeだけを対象とする。

## 6. 未評価範囲

- Git-ignoredファイル
- 外部採用Repositoryでの実移行、情報分類、許可した処理境界および外部サービス接続
- 実サービスでの漏洩、プロンプト注入、供給網、失効・回復および実行時強制
- 法務、契約、プライバシー、ブランド、美的判断およびリスク受容の個別専門判断
- 専門探索、2D／3D視覚制作および収束性の実案件効果
- 人間によるv0.17.0の採用、統合およびリリース判断

## 7. 現在状態

固定後の決定論的確認と回帰試験は成功した。作成担当から分離したエージェント運用レビュー、文書監査、不足／影響・準拠影響監査は未実施であり、現在状態は`Ready for Verification`である。3系統の独立確認と統合した解消判定が完了するまでは、`Ready for Release Handoff`または`Released`へ進めない。
