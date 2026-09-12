# CHG-000011 固定後検証実行記録（d0e8dc8）

状態（Status）: `Invalidated`

本記録は初回固定候補`d0e8dc8`に対する当時の実行事実を保持する。独立監査で、許可した処理境界と境界外送信を区別できないMajor 2件（AG-017-M01／GCI-017-01）および日本語表示のMinor 1件（DOC-017-01）が判明したため、現在の解消判定、準拠判定またはリリース引き渡しへ流用しない。Checker JSONとTAPは当時のRaw Resultとして改変せず、新しい固定候補ではCommit、Tree、Checker、試験および3系統の独立確認をすべて取り直す。

## 1. 宣言対象

- 変更トレース: `CHG-000011`
- Repository: Qual-Lab / CRDD公式リポジトリ
- Object Format: `sha1`
- Commit OID: `d0e8dc8aee083db03356737af8426b78bac9338f`
- Root Tree OID: `9d7c484ac4233c258d13eda302f04f80f27cb8e8`
- 親Commit／基準main: `bf0afd981474d5c9d62716717b84adf8363a2189`（v0.16.0公開結果を含むmain）
- 対象Path: 固定Commitの全Tree
- 実行場所: `C:\project\CRDD-IR\v017-d0e8dc8`のdetached分離worktree
- 出力場所: 固定対象外で生成後、`90_Release/Changes/Evidence/`へ固定後記録として追加

## 2. 実観測対象と実行対象

| 項目 | 実行直前／対象 | 実行直後 |
|---|---|---|
| Observed HEAD | `d0e8dc8aee083db03356737af8426b78bac9338f` | 同一 |
| Root Tree | `9d7c484ac4233c258d13eda302f04f80f27cb8e8` | 同一 |
| Git Tree所有ファイル | 129 | 129 |
| 分離worktree通常ファイル | 129 | 129 |
| Checker discovery | 129 | 実行結果に固定 |
| Index差分 | なし | なし |
| Worktree差分 | なし | なし |
| 未追跡ファイル | 0 | 0 |
| Submodule | `.gitmodules`およびmode `160000`のTree entryなし | 同一 |

固定Treeだけを展開した分離worktreeで実行し、Checker JSONとTAPは対象worktree外へ出力した。Tree、通常ファイル、discoveryの件数一致だけを同一性の証明とせず、HEAD、Root Tree、Index／Worktree差分、未追跡状態も実行前後で照合した。Git-ignoredファイルは未確認範囲である。

## 3. 実行環境と実行物

- Node.js: `v22.18.0`
- Node executable SHA-256: `C22D1C59A1F767A1ED0178445A027F2257D318C55430FC819D48F269586822B7`
- Git: `2.54.0.windows.1`
- Checker: `template/tools/crdd_check.mjs`
- Checker SHA-256: `8AE9E93F8F0384DE7E72ED076C32A42FBF2C3109663952FD3229D23A01813235`
- Test source: `tools/crdd_check.test.mjs`
- Test source SHA-256: `383B73DD4B6B22C4CD0099A533F53A380E1E37F17E3D380AB4B3D1297F730197`
- Checker command: `node tools/crdd_check.mjs --json --summary`
- Test command: `node --test --experimental-test-coverage --test-reporter=tap --test-reporter-destination=<対象外Evidence Path> tools/crdd_check.test.mjs`
- Checker記録時刻: `2026-08-10T09:44:32.247Z`（JSON内 duration `1218 ms`）
- Test結果ファイル観測終了時刻: `2026-08-10T09:46:27.3170001Z`
- Test開始相当時刻: `2026-08-10T09:45:52.0790001Z`（結果ファイル観測終了時刻からTAP内 duration `35237.9589 ms`を差し引いて再導出）
- Exit Code: Checker `0`、Test `0`

## 4. 完全結果

- Checker JSON: [CHG-000011_Checker_Run_d0e8dc8.json](CHG-000011_Checker_Run_d0e8dc8.json)
- Checker JSON SHA-256: `4E51671D099C6C142823B7F9B4B21EFADEE81B2693139865851F31FC02C4DB50`
- Test / Coverage TAP: [CHG-000011_Test_Run_d0e8dc8.tap](CHG-000011_Test_Run_d0e8dc8.tap)
- Test / Coverage TAP SHA-256: `44FCA2CD01AB77F051A12B8C4EDF4BA2DDA944CEE95F0984E75258C0DBD68637`

### Checker

- Tree所有／通常ファイル／discovery: `129 / 129 / 129`
- Markdown: `94 / 94`
- Local links: `1,478`
- Anchors: `520`
- Version docs: `26`
- Remediation rows: `54`
- Error: `0`
- Warning: `0`

### Test / Coverage

- Tests: `139`
- Pass: `139`
- Fail: `0`
- Checker line coverage: `100.00%`
- Checker branch coverage: `100.00%`
- Checker function coverage: `97.32%`

Checkerと試験は固定Commit内の未変更実装を使用した。Checkerの構造確認と回帰試験は、専門探索、視覚制作、外部情報境界、C-11、PL-19の意味的な正しさ、外部サービスの安全性または実行時強制の成立を証明しない。

## 5. 未評価範囲

- Git-ignoredファイル
- 外部採用Repositoryでの実移行、情報分類、外部サービス接続および実行時強制
- 実在する外部サービスに対する情報漏洩、プロンプト注入、供給網、失効・回復の実地試験
- 法務、契約、プライバシー、専門セキュリティ判断
- 専門探索・視覚制作・3D・差別化提案の実プロジェクトでの品質効果
- 人間によるv0.17.0の最終リリース判断、main統合、タグ作成、remote公開
- Checkerコードの独立セキュリティ／性能レビュー

本記録は固定Commitに対する機械確認と回帰試験の事実を示す。意味の正しさ、独立監査、準拠表明、セキュリティ保証またはリリース判断を代替しない。
