# CHG-000011 固定後検証実行記録（a902d97）

状態（Status）: `Invalidated`

本記録は第3固定候補`a902d97`に対する当時の実行事実を保持する。独立文書監査で、旧`0a5d232` EvidenceのTAPをRawのまま保持したという説明と、実際の行末空白整形の来歴が矛盾していること（DOC-017-R02）が判明したため、現在の解消判定、準拠判定またはリリース引き渡しへ流用しない。Checker JSONとTAPは当時の実行結果として保持し、新しい固定候補ではCommit、Tree、Checker、試験および3系統の独立確認をすべて取り直す。

## 1. 宣言対象

- 変更トレース: `CHG-000011`
- Repository: Qual-Lab / CRDD公式リポジトリ
- Object Format: `sha1`
- Commit OID: `a902d97277b5c17bd679560c7438e099de579bf9`
- Root Tree OID: `4270fdbb5b27aeadb2a364a2d4312fd1494a531e`
- 親Commit: `0a5d2328b6ed0454afdf7574d5dd7b545e6b51f8`
- 基準main: `bf0afd981474d5c9d62716717b84adf8363a2189`（v0.16.0公開結果を含むmain）
- 対象Path: 固定Commitの全Tree
- 実行場所: `C:\project\CRDD-IR\v017-a902d97`のdetached分離worktree
- 出力場所: 固定対象外で生成後、`90_Release/Changes/Evidence/`へ固定後記録として追加

## 2. 実観測対象と実行対象

| 項目 | 実行直前／対象 | 実行直後 |
|---|---|---|
| Observed HEAD | `a902d97277b5c17bd679560c7438e099de579bf9` | 同一 |
| Root Tree | `4270fdbb5b27aeadb2a364a2d4312fd1494a531e` | 同一 |
| Git Tree所有ファイル | 135 | 135 |
| 分離worktree通常ファイル | 135 | 135 |
| Checker discovery | 135 | 実行結果に固定 |
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
- Checker開始時点: `2026-08-10T10:19:43.445Z`
- Checker duration: `1268 ms`
- Test開始時点: `2026-08-10T19:19:50.4364744+09:00`
- Test終了時点: `2026-08-10T19:20:25.9974744+09:00`
- Test duration: `35561.1287 ms`

## 4. 実行結果

### 4.1. 全体Checker

- JSON: [`CHG-000011_Checker_Run_a902d97.json`](CHG-000011_Checker_Run_a902d97.json)
- SHA-256: `A81687B8C9134A02382BFEE3034751DFE8DD645C6EE5FA2820E3BE4C6E8F4424`
- Tree所有ファイル／通常ファイル／discovery: `135 / 135 / 135`
- Markdown: `96`
- Links: `1487`
- Anchors: `522`
- Version documents: `26`
- Remediation rows: `54`
- Error: `0`
- Warning: `0`

### 4.2. Checker回帰試験

- TAP: [`CHG-000011_Test_Run_a902d97.tap`](CHG-000011_Test_Run_a902d97.tap)
- 実行直後SHA-256: `8D0A43F9A1792535654493CAD7D2F38202E8292CF41FE29AA6D7009965A8F36D`
- 記録時SHA-256: `D25967F1D2259556B2B0BDE385DD36388FAC1F13A4F0C533238F07ADC19464CC`
- Tests: `139`
- Pass: `139`
- Fail: `0`
- Checker line coverage: `100.00%`
- Checker branch coverage: `100.00%`
- Checker function coverage: `97.32%`

TAPは実行後、網羅率表5行の行末空白だけを削除した。試験件数、成否、duration、網羅率、未網羅行およびその他の実行内容は変更していない。上記に実行直後Hashと記録時Hashを分け、形式更新を実行結果の変更として扱わない。

Checkerと試験は固定Commit内の実装を使用した。Checkerの構造確認と回帰試験は、専門探索、視覚制作、許可した処理境界、外部情報境界、C-11、PL-19の意味的な正しさ、外部サービスの安全性または実行時強制の成立を証明しない。

## 5. 旧固定候補との境界

`d0e8dc8`および`0a5d232`のRun Recordは`Invalidated`であり、対応するChecker JSON、TAPまたは独立監査結果を本固定候補の解消判定、準拠判定またはリリース引き渡しへ流用していない。本記録は、各監査集合の統合修正方針を指摘元へ再提示して合意後に作成した`a902d97`のCommit／Treeだけを対象とした当時の記録である。DOC-017-R02により固定内容を変更するため、本記録および`a902d97`の独立監査結果も新固定候補の現在判定へ流用しない。

## 6. 未評価範囲

- Git-ignoredファイル
- 外部採用Repositoryでの実移行、情報分類、許可した処理境界および外部サービス接続
- 実サービスでの漏洩、プロンプト注入、供給網、失効・回復および実行時強制
- 法務、契約、プライバシー、ブランド、美的判断およびリスク受容の個別専門判断
- 専門探索、2D／3D視覚制作および収束性の実案件効果
- 人間によるv0.17.0の採用、統合およびリリース判断

## 7. 現在状態

当時の固定後の決定論的確認と回帰試験は成功し、3系統の独立確認を実施した。その後の文書監査でDOC-017-R02が判明したため、本固定候補は`Invalidated`である。新しい固定Commit／Treeへ決定論的確認、回帰試験および3系統の独立確認を取り直し、統合した解消判定が完了するまでは、`Ready for Release Handoff`または`Released`へ進めない。
