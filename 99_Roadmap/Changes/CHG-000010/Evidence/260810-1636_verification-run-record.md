# CHG-000010 固定後検証実行記録

状態: `Invalidated`

この記録はCommit `3b26d56...`に対する当時の機械実行事実を保持する。初回独立監査で、単一正本、利用側伝播、準拠根拠、移行状態およびCheckerの判定不能境界に未解決Findingが確認されたため、現在の解消判定またはRelease Handoffには使用しない。後続の固定Commit／Root Treeと新しい実行記録を現在根拠とする。JSONとTAPは当時のRaw Resultとして改変しない。

## 1. 宣言対象

- 変更トレース: `CHG-000010`
- Repository: Qual-Lab / CRDD公式リポジトリ
- Object Format: `sha1`
- Commit OID: `3b26d562e4dca594caf2193cdb5caad15297ba1b`
- Root Tree OID: `6572c8a1291a58f903b6ec275d97a6dde2b7a1db`
- 基準Commit: `c73da4d`（v0.15.0固定後記録を含むfeature候補）
- 対象Path: 固定Commitの全Tree
- 実行場所: `C:\project\CRDD-IR\v016-3b26d56`のdetached分離worktree
- 出力場所: 固定対象外で生成後、`90_Release/Changes/Evidence/`へ固定後記録として追加

## 2. 実観測対象と実行対象

| 項目 | 実行直前／対象 | 実行直後 |
|---|---|---|
| Observed HEAD | `3b26d562e4dca594caf2193cdb5caad15297ba1b` | 同一 |
| Root Tree | `6572c8a1291a58f903b6ec275d97a6dde2b7a1db` | 同一 |
| Git Tree所有ファイル | 108 | 108 |
| 分離worktree通常ファイル | 108 | 108 |
| Checker discovery | 108 | 実行結果に固定 |
| Index差分 | なし | なし |
| Worktree差分 | なし | なし |
| 未追跡ファイル | 0 | 0 |
| Submodule | `.gitmodules`およびmode `160000`のTree entryなし | 同一 |

固定Treeだけを展開した分離worktreeで実行し、Checker JSONとTAPは対象worktree外へ出力した。Git-ignoredファイルはCheckerの未確認範囲である。Tree、通常ファイル、discoveryの件数一致だけを同一性の証明とせず、HEAD、Root Tree、Index／Worktree差分、未追跡状態も実行前後で照合した。

## 3. 実行環境と実行物

- Node.js: `v22.18.0`
- Node executable: `C:\Program Files\nodejs\node.exe`
- Node executable SHA-256: `C22D1C59A1F767A1ED0178445A027F2257D318C55430FC819D48F269586822B7`
- Git: `git version 2.54.0.windows.1`
- Checker: `template/tools/crdd_check.mjs`
- Checker SHA-256: `439F2096B5C283EE605859581CD54B8F34D658717B81A69206809D85AEFE8ACD`
- Test source: `tools/crdd_check.test.mjs`
- Test source SHA-256: `4F738BB0E42B2D8730D29D8F8690EEE05063E2CF28C03F47045C73ABAF190C0F`

## 4. Checker実行

- Command: `node tools/crdd_check.mjs --json --summary`
- 実行時刻: `2026-08-10T07:11:35.758Z`
- Exit Code: `0`
- 完全Result: [CHG-000010_Checker_Run_3b26d56.json](CHG-000010_Checker_Run_3b26d56.json)
- 保存Result SHA-256: `E189D97A760E655DB97DE4582C6AEADC3D6BCCAB96C5C044A83AFFB8C5B0D711`
- 結果: 108 files / 81 Markdown / 1,396 links / 474 anchors / 26 versioned documents / 34 remediation rows / Error 0 / Warning 0

## 5. 回帰試験と網羅率

- Command: `node --test --experimental-test-coverage --test-reporter=tap --test-reporter-destination=C:\project\CRDD-IR\CHG-000010_Test_Run_3b26d56.tap tools/crdd_check.test.mjs`
- UTC開始: `2026-08-10T07:11:43Z`
- UTC終了: `2026-08-10T07:12:14Z`
- Exit Code: `0`
- 完全Result: [CHG-000010_Test_Run_3b26d56.tap](CHG-000010_Test_Run_3b26d56.tap)
- 保存Result SHA-256: `78D64CC4CAF1ECAE7369E7E4B0B7D35E53E0756E847ADF157D45F1B045A21D03`
- 結果: 116 tests / 116 pass / 0 fail / 0 skipped
- Checker本体: line `100.00%` / branch `100.00%`
- 注記: TAP保存時の末尾改行正規化により、対象外一時出力のHashではなく、リポジトリへ保存した上記ResultのHashを正本とする。

## 6. 判定と限界

- 決定論的構造確認: `Pass`
- Checker回帰: `Pass`
- Checker本体の行・分岐網羅率: `100%`
- 本記録は規範の意味、契約母集団／利用側母集団の完全性、代表例の妥当性、独立レビューまたは人間のリリース判断を代替しない。
- 未評価: Git-ignoredファイル、外部採用先での実移行、実運用での固定候補差替え回数／監査往復／処理時間、専門領域における個別の意味判断、人間のリリース判断。
