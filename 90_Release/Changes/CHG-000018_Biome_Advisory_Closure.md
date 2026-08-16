# 変更トレース: Biome診断の全解消と再発防止

- 変更ID: `CHG-000018`
- 状態: `Draft`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-16
- 対象: CRDD公式Repositoryの`tools/**`と`template/tools/**`
- 対象version: v0.18.0 Candidate
- 変更分類: `non-breaking`
- 移行要否: `migration_required: false`
- 関連正本: [`tools/coding-standards.md`](../../tools/coding-standards.md)、[`CHG-000017`](CHG-000017_Tools_Coding_Standards.md)

## 判断と処置

Qual-Labの人間の決定権限者は、TypeScript完全移行後に残ったBiomeのWarning 44件とInfo 3件を先に全解消することを承認した。抑制コメントや広域除外は追加せず、次の責務別処置を行った。

- 冗長な正規表現escape、通常関数式、不要な`String.raw`および任意連鎖を、Biomeが示す等価な表現へ整理した。
- 未使用のprivate関数を削除し、試験生成器で意図的に未使用なコールバック引数は名称を変えず明示的に消費した。
- 未使用importを削除した。公開関数の既存parameterはAPI形状を保持し、明示的に消費した。
- CheckerとCoordinatorの`lint`パッケージスクリプトへ`--error-on-warnings`を追加した。今後Warningが1件でも生じれば両packageの`check`は失敗する。
- 両private packageの`lint`スクリプト完全一致をChecker契約試験へ追加し、厳格化の後退を検出可能にした。

公開CheckerのCLI、JSON、Schema、reason、status、Coordinator RuntimeのAuthority／Capability／Effect、既存の暗号domainおよび外部向けPathは変更していない。採用Repositoryの作業や移行は不要である。

## 検証と監査

2026-08-16のSelf-checkでは次を確認した。

- CheckerとCoordinatorのTypeScript型検査: Pass
- Biome Lint: Warning 0／Info 0。`--error-on-warnings`付きの両package `check`: Pass
- Biome Formatter確認: Pass
- Coordinator試験: 255 / 255 Pass
- Checker試験: 150 / 150 Pass
- 公式入口とChecker package root入口のRepository全体確認: いずれも408 file／284 Markdown／1863 link／561 anchor、Error 0／Warning 0
- `git diff --check`: Pass

この処置は`Applied`／`Self-checked`であり、新しい固定Commit／Treeに対するRepository全体Checkerと独立review／auditが完了するまでは`Resolved`ではない。変更候補の確認完了は、採用、統合、準拠、Stable化またはRelease判断を代替しない。v0.18は`Candidate`、Released Baselineはv0.17.0のままである。
