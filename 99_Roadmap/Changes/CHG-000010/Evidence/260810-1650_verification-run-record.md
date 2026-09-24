# CHG-000010 固定後検証実行記録

状態: `Invalidated`

この記録はCommit `dbe718c...`に対する当時の機械実行事実を保持する。独立確認で、非YAMLコードフェンス内の例示を移行宣言または必須区分として誤認する問題と、重複した言語区分またはコードフェンス内の見出し風文字列を正しく区別できない問題が確認されたため、現在の解消判定またはRelease Handoffには使用しない。後続の固定Commit／Root Treeと新しい実行記録を現在根拠とする。JSONとTAPは当時のRaw Resultとして改変しない。

## 1. 宣言対象

- 変更トレース: `CHG-000010`
- Repository: Qual-Lab / CRDD公式リポジトリ
- Object Format: `sha1`
- Commit OID: `dbe718caa19e6d50f48be1a21a913dbb374507e8`
- Root Tree OID: `4f18bb0ed143e161a1d195851c1a71ec58161e8e`
- 基準Commit: `c73da4d45861914a1d5a83892e1149e9cd9cf7e2`（v0.15.0未公開候補）
- 親Commit: `3b26d562e4dca594caf2193cdb5caad15297ba1b`
- 対象Path: 固定Commitの全Tree
- 実行場所: `C:\project\CRDD-IR\v016-dbe718c`のdetached分離worktree
- 出力場所: 固定対象外で生成後、`90_Release/Changes/Evidence/`へ固定後記録として追加

## 2. 実観測対象と実行対象

| 項目 | 実行直前／対象 | 実行直後 |
|---|---|---|
| Observed HEAD | `dbe718caa19e6d50f48be1a21a913dbb374507e8` | 同一 |
| Root Tree | `4f18bb0ed143e161a1d195851c1a71ec58161e8e` | 同一 |
| Git Tree所有ファイル | 111 | 111 |
| 分離worktree通常ファイル | 111 | 111 |
| Checker discovery | 111 | 実行結果に固定 |
| Index差分 | なし | なし |
| Worktree差分 | なし | なし |
| 未追跡ファイル | 0 | 0 |
| Submodule | `.gitmodules`およびmode `160000`のTree entryなし | 同一 |

固定Treeだけを展開した分離worktreeで実行し、Checker JSONとTAPは対象worktree外へ出力した。Tree、通常ファイル、discoveryの件数一致だけを同一性の証明とせず、HEAD、Root Tree、Index／Worktree差分、未追跡状態も実行前後で照合した。Git-ignoredファイルは未確認範囲である。

## 3. 実行環境と実行物

- Node.js: `v22.18.0`
- Git: `2.54.0.windows.1`
- Checker: `template/tools/crdd_check.mjs`
- Checker SHA-256: `31F67D39AD56FA5C739FCCE01DD95C3BE7AB42AFD80C2679D73EBEE01555CF83`
- Test source: `tools/crdd_check.test.mjs`
- Test source SHA-256: `CFB062B307286251C07F6D604E73AEA49D0286A1962778900FC649D9D843B2CD`
- Checker command: `node template/tools/crdd_check.mjs --json --summary`
- Test command: `node --test --experimental-test-coverage --test-reporter=tap --test-reporter-destination=<対象外Evidence Path> tools/crdd_check.test.mjs`
- Checker開始時刻: `2026-08-10T07:37:24.613Z`
- Test開始時刻: `2026-08-10T07:37:52Z`
- Test終了時刻: `2026-08-10T07:38:16Z`（TAP内 duration `23554.4309 ms`）
- Exit Code: Checker `0`、Test `0`

## 4. 完全結果

- Checker JSON: [CHG-000010_Checker_Run_dbe718c.json](CHG-000010_Checker_Run_dbe718c.json)
- Checker JSON SHA-256: `A21632A09CA52BD47A4E592FF805DD11EC1BA3123CDF27D165218DF8C311906A`
- Test / Coverage TAP: [CHG-000010_Test_Run_dbe718c.tap](CHG-000010_Test_Run_dbe718c.tap)
- Test / Coverage TAP SHA-256: `63251F8C9F291B19C268C6F5E211D56AF3493B00A05D62187411B10E0915F153`
- TAPは生成内容を保持し、Git差分検査に不要な表末尾空白だけを削除した。試験結果、件数、時刻、網羅率または失敗情報は変更していない。

### Checker

- Tree所有／通常ファイル／discovery: `111 / 111 / 111`
- Markdown: `82 / 82`
- Local links: `1,405`
- Anchors: `481`
- Version documents: `26`
- Remediation rows: `34`
- Error: `0`
- Warning: `0`

### 回帰試験と網羅率

- Tests: `129 / 129 Pass`
- Checker line coverage: `100.00%`
- Checker branch coverage: `100.00%`
- Checker function coverage: `97.06%`

## 5. 固定前照合と旧根拠の扱い

- 基準Commitから本固定Commitまでの変更集合: `38`ファイル
- 内容／入口／Checker等: `35`ファイル
- 初回固定候補`3b26d56...`の履歴根拠: `3`ファイル
- 既知利用側の処置、代表4例、変更禁止範囲、英日移行宣言の判定不能／不一致ケースをCHG-000010と実差分へ全数照合した。
- 確認待ち: `0`
- 未解消不一致: `0`
- `3b26d56...`のChecker／TAP／Run Recordおよび同対象の監査結果は履歴であり、本固定Commitの解消判定へ流用しない。

## 6. 未評価範囲と利用限界

- Git-ignoredファイル
- 外部採用Repositoryでの実運用効果、固定候補差替え回数、監査往復、処理時間、新規Finding数
- 未知の利用側の完全発見
- 代表例の意味判断そのもの、専門領域の正しさ
- v0.15.0のリリース、人間によるv0.16.0のリリース判断、公開タグ

本記録は固定Commitに対する共通機械根拠であり、独立エージェント運用レビュー、文書監査、不足／影響・準拠影響監査、人間によるリリース判断を代替しない。v0.15.0の公開後にv0.16.0を新しいmainへ再接続した場合、本結果を最終リリース根拠へ流用せず、新しいCommit／Treeで全根拠を取り直す。
