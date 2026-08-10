# CHG-000011 固定後検証実行記録（0a5d232）

状態（Status）: `Invalidated`

本記録は第2固定候補`0a5d232`に対する当時の実行事実を保持する。独立監査で、許可した処理境界内にも抽象化を必須と読める実装規則（GCI-017-01-R1）と、旧一律禁止モデルを残すCHG要約2箇所（DOC-017-R01）が判明したため、現在の解消判定、準拠判定またはリリース引き渡しへ流用しない。Checker JSONとTAPは当時のRaw Resultとして改変せず、新しい固定候補ではCommit、Tree、Checker、試験および3系統の独立確認をすべて取り直す。

## 1. 宣言対象

- 変更トレース: `CHG-000011`
- Repository: Qual-Lab / CRDD公式リポジトリ
- Object Format: `sha1`
- Commit OID: `0a5d2328b6ed0454afdf7574d5dd7b545e6b51f8`
- Root Tree OID: `49acad072f71ebcd03ea6dce68e3dd535dee6eff`
- 親Commit: `d0e8dc8aee083db03356737af8426b78bac9338f`
- 基準main: `bf0afd981474d5c9d62716717b84adf8363a2189`（v0.16.0公開結果を含むmain）
- 対象Path: 固定Commitの全Tree
- 実行場所: `C:\project\CRDD-IR\v017-0a5d232`のdetached分離worktree
- 出力場所: 固定対象外で生成後、`90_Release/Changes/Evidence/`へ固定後記録として追加

## 2. 実観測対象と実行対象

| 項目 | 実行直前／対象 | 実行直後 |
|---|---|---|
| Observed HEAD | `0a5d2328b6ed0454afdf7574d5dd7b545e6b51f8` | 同一 |
| Root Tree | `49acad072f71ebcd03ea6dce68e3dd535dee6eff` | 同一 |
| Git Tree所有ファイル | 132 | 132 |
| 分離worktree通常ファイル | 132 | 132 |
| Checker discovery | 132 | 実行結果に固定 |
| Index差分 | なし | なし |
| Worktree差分 | なし | なし |
| 未追跡ファイル | 0 | 0 |
| Submodule | `.gitmodules`およびmode `160000`のTree entryなし | 同一 |

固定Treeだけを展開した分離worktreeで実行し、Checker JSONとTAPは対象worktree外へ出力した。Tree、通常ファイル、discoveryの件数一致だけを同一性の証明とせず、HEAD、Root Tree、Index／Worktree差分、未追跡状態も実行前後で照合した。Git-ignoredファイルは未確認範囲である。

## 3. 実行環境と実行物

- 実行日: 2026-08-10（Asia/Tokyo）
- Runtime: Node.js `v22.18.0`
- Checker: 固定Commit内の`tools/crdd_check.mjs`
- Test: 固定Commit内の`tools/crdd_check.test.mjs`および`tools/crdd_check_fault_injector.cjs`
- Checker command: `node tools/crdd_check.mjs --json --summary`
- Test command: `node --test --experimental-test-coverage tools/crdd_check.test.mjs`
- Checker開始時点: `2026-08-10T10:09:03.685Z`
- Checker duration: `1276 ms`
- Test開始時点: `2026-08-10T19:09:14.0849712+09:00`
- Test終了時点: `2026-08-10T19:09:49.4199712+09:00`
- Test duration: `35334.9227 ms`

## 4. 実行結果

### 4.1. 全体Checker

- JSON: [`CHG-000011_Checker_Run_0a5d232.json`](CHG-000011_Checker_Run_0a5d232.json)
- SHA-256: `BB900D07CE6FF179F7AE76435E026409154FD77590052D0016F8593A0F8DFC5D`
- Tree所有ファイル／通常ファイル／discovery: `132 / 132 / 132`
- Markdown: `95`
- Links: `1485`
- Anchors: `522`
- Version documents: `26`
- Remediation rows: `54`
- Error: `0`
- Warning: `0`

### 4.2. Checker回帰試験

- TAP: [`CHG-000011_Test_Run_0a5d232.tap`](CHG-000011_Test_Run_0a5d232.tap)
- 実行直後SHA-256: `BD245244E7571C7D8B088E53E13893BB84193C3FE736F1E11CE9E4F98B3BC2D4`
- 記録時SHA-256: `0084ECC9FD269AC8CA207CF7218D148AA8B38BCDE2DBE274D537F8BADCCE428F`
- Tests: `139`
- Pass: `139`
- Fail: `0`
- Checker line coverage: `100.00%`
- Checker branch coverage: `100.00%`
- Checker function coverage: `97.32%`

Checkerと試験は固定Commit内の実装を使用した。Checkerの構造確認と回帰試験は、専門探索、視覚制作、許可した処理境界、外部情報境界、C-11、PL-19の意味的な正しさ、外部サービスの安全性または実行時強制の成立を証明しない。

TAPは実行後、網羅率表5行の行末空白だけを削除した。試験件数、成否、duration、網羅率、未網羅行およびその他の実行内容は変更していない。上記に実行直後Hashと記録時Hashを分け、形式更新を実行結果の変更として扱わない。

## 5. 旧固定候補との境界

初回固定候補`d0e8dc8`のRun Recordは`Invalidated`であり、対応するChecker JSON、TAPおよび3監査結果を本固定候補の解消判定、準拠判定またはリリース引き渡しへ流用していない。本記録は、統合修正方針を3監査へ再提示して合意後に作成した新しい固定Commit／Treeだけを対象とする。

## 6. 未評価範囲

- Git-ignoredファイル
- 外部採用Repositoryでの実移行、情報分類、許可した処理境界および外部サービス接続
- 実サービスでの漏洩、プロンプト注入、供給網、失効・回復および実行時強制
- 法務、契約、プライバシー、ブランド、美的判断およびリスク受容の個別専門判断
- 専門探索、2D／3D視覚制作および収束性の実案件効果
- 人間によるv0.17.0の採用、統合およびリリース判断

## 7. 現在状態

固定後の決定論的確認と回帰試験は成功した。作成担当から分離したエージェント運用レビュー、文書監査、不足／影響・準拠影響監査は未実施であり、現在状態は`Ready for Verification`である。3系統の独立確認と統合した解消判定が完了するまでは、`Ready for Release Handoff`または`Released`へ進めない。
