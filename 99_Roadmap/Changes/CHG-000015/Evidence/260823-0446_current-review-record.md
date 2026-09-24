# CHG-000035 現行レビュー記録（7da5b6c）

## 現在状態

- 変更トレース: [`CHG-000035`](../CHG-000035_Native_Provision_Bootstrap_Dependency_Reduction.md)
- 固定本文の状態: `In Review`（固定時点の履歴）
- 現在の処置: 限定implementation scopeの独立確認完了。Operational one-shotとRelease準備は未完了
- 対象version: `v0.18.0 Candidate`
- 変更分類: `breaking`（native entrypoint contract revision 1→2）
- 移行要否: `migration_required: true`
- 適格性: fixed-blocked native bootstrapの依存縮退、bounded same-fd静的検査およびentrypoint revision 2移行に限定して`Eligible`
- 非適格: Operational one-shot、Gate open、CRDD全体の準拠表明、Stable、Releaseおよび採用

固定実装へ固定後結果を書き戻さず、本記録がChecker、試験、独立レビュ、監査、指摘の解消判定および現在の処置を所有する。独立確認完了は「安全なClaude Code実行」、Authority、Capability、Gate、準拠表明、Stable、Releaseまたは採用を意味しない。

## 固定対象

- Repository: Qual-Lab / CRDD公式リポジトリ
- 現行記録Commit OID: `7da5b6c5e81684d0789afddf9504c73910256dcb`
- 現行記録Root Tree OID: `c425d1f17a0d60014e676a38083575968b9b4e89`
- 実装Commit OID: `f678428cc2b1e96756fb1df356dcd86e65510339`
- 実装Root Tree OID: `a226fc65c334548ca811bf6420a9e50cea5cac4a`
- 実装検証: [`CHG-000035_Verification_Run_Record_f678428.md`](CHG-000035_Verification_Run_Record_f678428.md)
- 旧Node.js 22記録: [`CHG-000035_Verification_Run_Record_1d7bac2.md`](CHG-000035_Verification_Run_Record_1d7bac2.md)（`Superseded`、現在判定へ不使用）

## 共通機械確認と試験

- Repository全体Checker: 353 Markdown、2,031 local links、581 anchors、Error 0、Warning 0
- Checker実行: `2026-08-22T19:42:18.964Z`、584 ms、Git-ignored fileは未確認
- Coordinator: `check` Pass、435/435 tests Pass
- Checker package: `check` Pass、151/151 tests Pass
- Rust: format Pass、worker／native bootstrap Clippy Pass、11/11 tests Pass、frozen release build Pass
- TypeScript coverage: 2 payload完全一致、line 7438/8345、function 267/291、branch 1179/1445
- Rust coverage: 2 JSON payload完全一致、region 1289/1416、function 53/54、line 844/914、branchは固定stable toolchainで測定非対応
- Native PE／CLI: 連続2runのstdout完全一致、各run 2 clean build完全一致、4608 bytes、SHA-256 `a1c2be0b2a70f6c1cbc2caf29d47ee360dee359174a82bab65952d28420ee281`

exact command、Node／npm／Cargo／rustc Identity、coverage／PE payloadのbyte長とSHA-256、抽出規則およびbinary-safe driverは実装検証記録を正本とする。

## 独立確認結果

| 確認 | 確認者 | 対象と経路 | 結果 |
|---|---|---|---|
| Agent／Architecture／Security Review | `/root/chg28_security_review` | `9bf0a71`の全観点再走査でPass、`7da5b6c`の記録限定差分を軽量再確認 | `Pass`、Finding 0 |
| Document Audit | `/root/chg28_document_audit` | `9bf0a71`でMinor 1件、exact command／環境を再実行記録した`7da5b6c`を限定再監査 | `Pass`、Finding 0 |
| Gap／Impact Audit | `/root/chg28_gap_conformance` | `9bf0a71`の全観点再走査でPass。`7da5b6c`でbinary-safe driver再実行によるRust生stream SHA-256 2件の訂正を含む記録限定差分を確認し、coverage payload 3238 bytes／SHA-256 `e631edc4abc808c95df3dbeaa5e1497ec03951a6f336386045ba8c44d47056e6`、totals、実装、契約および適格性境界の不変を確認 | `Pass`、Finding 0 |
| Conformance Audit | `/root/chg28_gap_conformance` | 本変更scopeの適格性と非Gate／非Release境界を確認 | 限定scopeで`Pass`、Finding 0 |

全確認は既知の契約母集団と利用側母集団を全数確認し、サンプリングは行っていない。新規候補4分類はすべて0件、未解決Findingは0件である。

## 解消判定

| 是正対象 | 処置進捗 | 阻害状態 | 解消判定 | 受入条件 | 判定方法 | 根拠 | 独立再レビュー | 現在状態への反映 |
|---|---|---|---|---|---|---|---|---|
| Node.js検証基準 | Self-checked | None | Resolved | 24.12以上のexact path／hash、Node 22 fallbackなし | 実体Identityと全suiteを照合 | Node `v24.19.0`のpath／byte長／hash、旧記録`Superseded` | 3系統Pass | 限定scopeの検証基準成立 |
| coverage／PE実行Identity | Self-checked | None | Resolved | exact command／cwd／env、2回payload Identity、抽出規則 | 975-byte driverを文書から再Hashし実測値へ照合 | driver SHA-256 `e9668667d2cf69a882d69960a2a052deed6c9289d7f4570fcafb7760617f85ba`とpayload記録 | Document／Security Pass | 現行Evidenceが実行再現情報を所有 |
| 旧V2 entrypoint revision 1 Gate | Self-checked | None | Resolved | 暗号検証後に拒否、exact key、全安全field false | Trust CoreからGate試験まで水平照合 | signed fixtureとGate contract test | Security／Gap Pass | alias／fallbackなしのrevision 2移行 |
| build override／provenance主張 | Self-checked | None | Resolved | 大小文字非依存拒否、child allowlist、tool Identity、未検証供給網の非主張 | build helper、試験、CHG／README／Threat Modelを照合 | Cargo／rustc Identity、Cargo config 0、cache／linker blocker | Security／Gap Pass | 実装候補は成立、Release blocker維持 |
| Network証拠の分離 | Self-checked | None | Resolved | 固定result、static PE、実process、dependency Networkを別軸化 | code、runner、CHG／README／Threat Model／Evidenceを照合 | 報告false、direct import 0、実process `not_verified`、Cargo frozen | Security／Gap Pass | 実process Networkを成立へ読み替えない |
| PEのbounded same-fd検査 | Self-checked | None | Resolved | pre-lstat、same-fd、上限+1／EOF、前後Identity／Hash、race拒否 | helper、observer、runner、正負試験を照合 | exact／+1、growth／truncate、leaf／parent replacement試験 | Security Pass | 配布前static検査候補のみ成立 |

各`Resolved`は上記指摘の解消であり、Cargo cache供給元真正性、MSVC linker Identity、実process Network非発火または「安全なClaude Code実行」の解消・受容・完成を意味しない。

## 未評価範囲と後続処置

- loaded image結合、DLL／module探索閉包、side-loading不存在、実process Network非発火、leafから全parentまでの継続Identity、local volume、stdout failure、partial writeおよびpanicは未実装または未評価。OwnerはQual-Lab、次段の開始条件は現行固定bootstrapと同一runでこれらをfail closed観測できる設計固定である。
- token／Root、selected-user binder、Protection、active、Provider Home、実Claude Code、subscription OAuth、Egress、quotaおよび課金は未実装または未評価。上記bootstrap安全条件の成立前にこれらを有効化しない。
- Cargo cache供給元真正性とMSVC linker IdentityはRelease blocker。OwnerはQual-Lab、Release署名、配布artifact採用、toolchain／cache／dependency変更時に再確認し、承認済み供給元、Identityおよび再現根拠がそろうまでRelease不可を解除しない。
- Git-ignored fileはCheckerの未確認範囲である。

## 現在の人間判断

現在、承認済みbootstrap依存縮退の実装候補に追加の人間判断は必要ない。保護対象の採用／統合、残存risk受容、Gate open、準拠表明、StableおよびReleaseは、本記録では実施・自己決定しない。
