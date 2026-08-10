# CHG-000010 固定後検証実行記録

## 1. 宣言対象

- 変更トレース: `CHG-000010`
- Repository: Qual-Lab / CRDD公式リポジトリ
- Object Format: `sha1`
- Commit OID: `e19501dc457841605aa033ed10e0d47fb4c43c5e`
- Root Tree OID: `1556397b103adfb267dca5c7b7bfc58edebd506a`
- 基準Commit: `c73da4d45861914a1d5a83892e1149e9cd9cf7e2`（v0.15.0未公開候補）
- 親Commit: `dbe718caa19e6d50f48be1a21a913dbb374507e8`
- 対象Path: 固定Commitの全Tree
- 実行場所: `C:\project\CRDD-IR\v016-e19501d`のdetached分離worktree
- 出力場所: 固定対象外で生成後、`90_Release/Changes/Evidence/`へ固定後記録として追加

## 2. 実観測対象と実行対象

| 項目 | 実行直前／対象 | 実行直後 |
|---|---|---|
| Observed HEAD | `e19501dc457841605aa033ed10e0d47fb4c43c5e` | 同一 |
| Root Tree | `1556397b103adfb267dca5c7b7bfc58edebd506a` | 同一 |
| Git Tree所有ファイル | 114 | 114 |
| 分離worktree通常ファイル | 114 | 114 |
| Checker discovery | 114 | 実行結果に固定 |
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
- Checker command: `node template/tools/crdd_check.mjs --json --summary`
- Test command: `node --test --experimental-test-coverage --test-reporter=tap --test-reporter-destination=<対象外Evidence Path> tools/crdd_check.test.mjs`
- Test開始時刻: `2026-08-10T07:51:26.4709753Z`
- Test終了時刻: `2026-08-10T07:51:52.5150458Z`（TAP内 duration `25723.2555 ms`）
- Checker開始時刻: `2026-08-10T07:51:57.262Z`
- Exit Code: Checker `0`、Test `0`

## 4. 完全結果

- Checker JSON: [CHG-000010_Checker_Run_e19501d.json](CHG-000010_Checker_Run_e19501d.json)
- Checker JSON SHA-256: `A641E30225D447AFE703C962AE1DF7A7380640270F29AD920B77F6CD8E7697D2`
- Test / Coverage TAP: [CHG-000010_Test_Run_e19501d.tap](CHG-000010_Test_Run_e19501d.tap)
- Test / Coverage TAP SHA-256: `303F11A665634256C7CBD07136307F6AB904C1A918C00D72CC8B6CDF63EFB882`
- 独立監査の共通入力時Hashは`06F1733BFEA39BACA1DD873FD043E87B0237D25598E1FCB20DDE36C6D580319C`であった。終端記録の差分検査で検出した網羅率表5行の末尾空白だけを削除し、試験結果、件数、時刻、網羅率、失敗情報は変更していない。上記Hashは整形後の現在ファイルを示す。

### Checker

- Tree所有／通常ファイル／discovery: `114 / 114 / 114`
- Markdown: `83 / 83`
- Local links: `1,407`
- Anchors: `481`
- Version documents: `26`
- Remediation rows: `34`
- Error: `0`
- Warning: `0`

### 回帰試験と網羅率

- Tests: `139 / 139 Pass`
- Checker line coverage: `100.00%`
- Checker branch coverage: `100.00%`
- Checker function coverage: `97.32%`

## 5. 固定前照合と旧根拠の扱い

- 基準Commitから本固定Commitまでの変更集合: `41`ファイル
- 内容／入口／Checker等: `35`ファイル
- 初回固定候補`3b26d56...`の履歴根拠: `3`ファイル
- 第2固定候補`dbe718c...`の履歴根拠: `3`ファイル
- 既知利用側の処置、代表4例、変更禁止範囲、英日移行宣言の判定不能／不一致、コードフェンスおよび言語／Release見出しの構造境界をCHG-000010と実差分へ全数照合した。
- 確認待ち: `0`
- 未解消不一致: `0`
- `3b26d56...`および`dbe718c...`のChecker／TAP／Run Recordと同対象の監査結果は履歴であり、本固定Commitの解消判定へ流用しない。

## 6. 未評価範囲と利用限界

- Git-ignoredファイル
- 外部採用Repositoryでの実運用効果、固定候補差替え回数、監査往復、処理時間、新規Finding数
- 未知の利用側の完全発見
- 代表例の意味判断そのもの、専門領域の正しさ
- v0.15.0のリリース、人間によるv0.16.0のリリース判断、公開タグ

本記録は固定Commitに対する共通機械根拠であり、独立エージェント運用レビュー、文書監査、不足／影響・準拠影響監査、人間によるリリース判断を代替しない。v0.15.0の公開後にv0.16.0を新しいmainへ再接続した場合、本結果を最終リリース根拠へ流用せず、新しいCommit／Treeで全根拠を取り直す。
