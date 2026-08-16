# 変更トレース: 内部ツールのコーディング規約と命名移行

- 変更ID: `CHG-000017`
- 状態: `Draft`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-16
- 対象: CRDD公式Repositoryの`tools/**`と配布用`template/tools/**`
- 対象version: v0.18.0 Candidate
- 変更分類: `breaking`
- 移行要否: `migration_required: true`
- 関連正本: [`19_Maintenance.md#34-essential-correction-and-compatibility-boundary`](../../19_Maintenance.md#34-essential-correction-and-compatibility-boundary)、[`tools/coding-standards.md`](../../tools/coding-standards.md)

## 判断

Qual-Labの人間の決定権限者は、CRDD内部ツールの命名を、外部方針への曖昧な参照ではなくCRDD所有の具体的なコーディング規約へ統一することを承認した。ファイル／フォルダ、TypeScript identifier、Boolean、配列、真の定数、試験kind、machine identifierおよび曖昧名の規則を`tools/coding-standards.md`へ固定する。

CRDDの保守は、原則として互換shim、旧名aliasまたは重複入口を残さず、本質的な正本修正と明示的な移行で処理する。今回のv0.18 Candidateでは旧Checker Pathの利用側を移行し、旧Pathのwrapperまたはaliasを残さない。Candidateであることだけを破壊的表示、移行または復旧の省略理由にしない。

既存CheckerのJSON出力keyは設定JSONではなく既存machine contractであるため、今回の`camelCase`設定key規則による改名対象にしない。CLI flag、reason、status、暗号domainおよび既存Schemaも変更しない。

既存Coordinator試験は公開挙動と複数の安全条件を同一ファイルで検証しているため、今回の移行では全30件を`contract`へ収束させる。後続で責務を分割する場合だけ、`unit`、`contract`、`integration`、`boundary`、`golden`または`current`の閉じたkindから選ぶ。

## 設計入力

命名規則は、Qual Suite Commit `d7493e25f719bef6e46b8dbba7926f9a74e1165e`、Tree `62fa90f2020803609935a10944dcffe03484af34`の次を設計入力として使用した。

- `06_Architecture/qual-insight/99_Coding_Standards.md`
- `90_Release/qual-insight/Changes/CHG-000004_Implementation_Naming_Convention.md`

CRDDは設計入力を自動追従せず、採用した具体値を`tools/coding-standards.md`で所有する。

## rename表

| 旧名 | 新名 | 処置 |
|---|---|---|
| `tools/checker/crdd_check.ts` | `tools/checker/crdd-check.ts` | 公式Repository private入口を置換 |
| `tools/checker/crdd_check.test.ts` | `tools/checker/crdd-check.contract.test.ts` | Checker契約試験を置換 |
| `template/tools/crdd_check.ts` | `template/tools/crdd-check.ts` | 配布正本を置換 |
| 採用側`tools/crdd_check.ts` | 採用側`tools/crdd-check.ts` | 採用側配置契約を置換 |
| `tools/coordinator/THREAT_MODEL.md` | `tools/coordinator/threat-model.md` | 現行脅威モデルPathを置換 |
| `tools/coordinator/tests/<subject>.test.ts` | `tools/coordinator/tests/<subject>.contract.test.ts` | 30試験を全数置換 |
| Checker package script `run` | `verify:repository` | 曖昧なbare名を責務名へ置換 |

source identifierでは、bare `run`、`execute`、`common`および`info`を責務名へ置換し、Boolean bindingと配列bindingを規約へ揃える。公開result keyまたは既存machine Schemaは改名しない。

## 移行

採用Repositoryがv0.18 Candidateまたはその後続Releaseを採用するときは、次を同じ移行で行う。

1. コピー済み`tools/crdd_check.ts`を`tools/crdd-check.ts`へrenameする。
2. `AGENTS.md`、CI、script、文書および自動化にある実行Pathを新名へ更新する。
3. CRDDを`00_CRDD/`へ置き、配布Checkerをコピーしていない場合は`node 00_CRDD/template/tools/crdd-check.ts --root . --json --summary`へ更新する。
4. 現在の作業Treeに旧Checker Pathが存在しないことを確認する。
5. 固定した採用候補へ新PathのCheckerまたは同等確認を実行し、必要な独立確認を完了してから基準版を有効化する。

移行を延期する採用Repositoryは以前固定していたv0.17.x Releaseを維持する。移行失敗時は、部分的に旧名shimを追加せず、変更前の固定Releaseと採用側変更へ戻す。v0.18 Candidateの存在、Checker合格または本変更の実装だけで採用、準拠、統合、Stable化またはReleaseを成立させない。

## 履歴と現在Path

過去のCHG、EvidenceおよびCHANGELOGにある`crdd_check.ts`、`crdd_check.test.ts`および当時のcommandは固定履歴として維持する。履歴中の現在移設先リンクだけを新Pathへ接続し、当時Pathを現在Pathへ書き換えない。

[`CHG-000016`](CHG-000016_Internal_TypeScript_Migration.md)の「配布Pathは変更しない」という当時の判断は、今回の後続人間判断によりsupersededされ、現在判定へ使用しない。TypeScript完全移行の結果、Node.js 24.12境界、Checkerの検査意味、CLI出力およびpackage分離は維持する。

## 検証と監査

- Biome filename ruleと専用命名contract test
- Checker packageの型検査、Lint、Formatter、全試験、package rootからのRepository確認
- Coordinator packageの型検査、Lint、Formatterおよび全試験
- Repository全体Checker
- Agent／Architecture／Security review
- Document Audit
- Gap / Impact AuditとConformance Audit

本変更は`Applied`であり、機械確認、固定改訂版および独立監査が完了するまでは`Resolved`、採用、統合またはReleaseではない。

## Self-check

2026-08-16の編集後候補で次を確認した。

- Node.js 24.12のCoordinator試験: 255 / 255 Pass
- Node.js 24.12のChecker既存契約試験: 144 / 144 Pass
- Node.js 24.12の命名contract試験: 2 / 2 Pass
- Checker／CoordinatorのTypeScript型検査、Biome LintおよびFormatter確認: Pass
- Checker package rootからのRepository全体確認: 403 file／279 Markdown／1848 link／561 anchor、Error 0／Warning 0
- 旧Checker Pathの実体、互換shimおよびalias: 0件

この結果は`Self-checked`であり、固定Commit／Treeに対する独立review／audit前は`Resolved`ではない。
