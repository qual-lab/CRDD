# CHG-000010 固定後検証実行記録（f35dc1c）

## 1. 宣言対象

- 変更トレース: `CHG-000010`
- Repository: Qual-Lab / CRDD公式リポジトリ
- Object Format: `sha1`
- Commit OID: `f35dc1cb9e7774b78a857f6635530211232dcef8`
- Root Tree OID: `3faf546ba25f02e07dc2563e2fdf4b9de43ea009`
- 親Commit: `475cc69bba6955bfe5bb0a67346a8065f84b981a`
- 基準main: `122a0f2cfe6f94a504604d0f265d549f1f08c35f`（v0.15.0公開結果記録を含むmain）
- 公開基準版: 注釈付き`v0.15.0`タグ、peeled commit `caab4aec6c5f3bc4d9b39bc4f18ed67cf121db18`
- 対象Path: 固定Commitの全Tree
- 実行場所: `C:\project\CRDD-IR\v016-f35dc1c`のdetached分離worktree
- 出力場所: 固定対象外で生成後、`90_Release/Changes/Evidence/`へ固定後記録として追加

## 2. 実観測対象と実行対象

| 項目 | 実行直前／対象 | 実行直後 |
| --- | --- | --- |
| Observed HEAD | `f35dc1cb9e7774b78a857f6635530211232dcef8` | 同一 |
| Root Tree | `3faf546ba25f02e07dc2563e2fdf4b9de43ea009` | 同一 |
| Git Tree所有ファイル | 121 | 121 |
| 分離worktree通常ファイル | 121 | 121 |
| Checker discovery | 121 | 実行結果に固定 |
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
- Test開始時刻: `2026-08-10T08:13:47.6850749Z`
- Test終了時刻: `2026-08-10T08:14:10.5277305Z`（TAP内 duration `22380.8547 ms`）
- Checker開始時刻: `2026-08-10T08:14:10.5277305Z`
- Checker終了時刻: `2026-08-10T08:14:11.1256915Z`
- Exit Code: Checker `0`、Test `0`

## 4. 完全結果

- Checker JSON: [CHG-000010_Checker_Run_f35dc1c.json](CHG-000010_Checker_Run_f35dc1c.json)
- Checker JSON SHA-256: `F5C77F8D6B0887EE9AF570D46EB33ADA69A44C62A3C2F5D27B2FF648FD3A9DFB`
- Test / Coverage TAP: [CHG-000010_Test_Run_f35dc1c.tap](CHG-000010_Test_Run_f35dc1c.tap)
- Test / Coverage TAP SHA-256: `B83E7FCE1BEE0292FBB23A8B36CF8B81380E2C68E7218FD13A9271397E1A049C`

### Checker

- Tree所有／通常ファイル／discovery: `121 / 121 / 121`
- Markdown: `88 / 88`
- Local links: `1,416`
- Anchors: `481`
- Version docs: `26`
- Remediation rows: `44`
- Error: `0`
- Warning: `0`

### Test / Coverage

- Tests: `139`
- Pass: `139`
- Fail: `0`
- Checker line coverage: `100.00%`
- Checker branch coverage: `100.00%`
- Checker function coverage: `97.32%`

## 5. v0.15.0公開後の再接続

- v0.15.0本文統合: PR #17およびPR #18
- v0.15.0リリース前記録: PR #19、mainコミット`caab4aec6c5f3bc4d9b39bc4f18ed67cf121db18`
- v0.15.0公開識別子: 注釈付き`v0.15.0`タグ。local／remote tag object `d48cdd7d9f5b07f7171e8c57d3471aa43b0b8470`、peeled commit `caab4aec6c5f3bc4d9b39bc4f18ed67cf121db18`
- v0.15.0公開結果記録: PR #20、mainコミット`122a0f2cfe6f94a504604d0f265d549f1f08c35f`
- v0.16.0再接続: mainをmergeしたCommit `475cc69bba6955bfe5bb0a67346a8065f84b981a`の後、CHGの履歴・実差分・現在処置を更新して本固定Commitを作成した
- 旧`e19501d`以前のChecker、試験および監査結果は本固定版の解消判定またはRelease Handoffへ流用しない

## 6. 未評価範囲

- 元worktreeの未追跡`CRDD_Introduction.pptx`とGit-ignoredファイル
- 外部採用Repositoryでの実移行と運用効果
- 人間によるv0.16.0の最終リリース判断、main統合、タグ作成、remote公開
- Checkerコードの独立セキュリティ／性能レビュー

本記録は固定Commitに対する機械確認と回帰試験の事実を示す。意味の正しさ、独立監査、準拠表明またはリリース判断を代替しない。
