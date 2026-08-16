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

Qual-Labの人間の決定権限者は、CRDD内部ツールの命名を、外部方針への曖昧な参照ではなくCRDD所有の具体的なコーディング規約へ統一することを承認した。ファイル／フォルダ、TypeScript識別子（TypeScript identifier）、Boolean、配列、真の定数、試験種別（test kind）、機械識別子（machine identifier）および曖昧名の規則を`tools/coding-standards.md`へ固定する。

CRDDの保守は、原則として互換shim、旧名aliasまたは重複入口を残さず、本質的な正本修正と明示的な移行で処理する。今回のv0.18 Candidateでは旧Checker Pathの利用側を移行し、廃止入口を維持する互換wrapperまたはaliasを残さない。単一配布正本へ委譲するpackage entry adapterは責務分離であり、互換層ではない。Candidateであることだけを破壊的表示、移行または復旧の省略理由にしない。

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
| Checkerのパッケージスクリプト（package script）`run` | `verify:repository` | 曖昧なbare名を責務名へ置換 |

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
- 固定TypeScript 7.0.2の型付きASTから、Checker、Coordinator本体およびCoordinator試験の3 projectを実Pathで全数走査する命名contract test
- 現行利用側にある廃止Pathを拒否し、過去CHGと移行説明の旧literalだけをPath、literalおよび期待件数で固定する参照contract test
- Checker packageの型検査、Lint、Formatter、全試験、package rootからのRepository確認
- Coordinator packageの型検査、Lint、Formatterおよび全試験
- Repository全体Checker
- Agent／Architecture／Security review
- Document Audit
- Gap / Impact AuditとConformance Audit

本変更は`Applied`であり、機械確認、固定改訂版および独立監査が完了するまでは`Resolved`、採用、統合またはReleaseではない。

## 初回固定版の監査集合と構造是正

初回固定版はCommit `7ff1a81e7bc044c57d51b6ac503fe2534ed2b711`、Tree `74bf3e3c27a1ada5d16963342ebeccfe017a4cce`、Parent `2585bbe8cdfca0a3ed26326609eb20aeb20d1802`である。共通入力はNode.js 24.12、Coordinator試験255 / 255、Checker試験144 / 144、命名contract試験2 / 2、全体Checker 403 file／279 Markdown／1848 link／561 anchor、Error 0／Warning 0、diff／worktree cleanだった。

- Agent／Architecture／Security review: `Fail`、Major 2件。`AG-CODING-STANDARDS-001`は全sourceへ規約を適用したことで判明した既存識別子の未移行、`AG-CODING-STANDARDS-002`は今回新設した正規表現検査が型付き宣言を網羅せず偽Passした問題である。
- Document Audit: `Fail`、Major 1件とMinor 2件。`DOC-TOOLS-STANDARD-001`は配布正本とpackage entry adapterの所有方向および互換wrapper禁止の曖昧さ、`DOC-TOOLS-HISTORY-001`は過去CHGから現在配布正本への接続不足、`DOC-TOOLS-LOCALE-001`は新規正本のlocale-first不足で、いずれも今回変更で新たに発生した。
- Gap / Impact Audit: `Fail`、Major 2件。`GCI-TOOLS-NAMING-001`は今回新設した規範と機械検査の母集団不一致、`GCI-TOOLS-MIGRATION-001`は全利用側へ範囲を拡大したことで`.github`の廃止入口を検出した問題である。
- Conformance Audit: `Pass`、Finding 0件。Gap / Impactの結果へ集約せず、準拠基準、Stable ID、VersionおよびReleaseへの変更がないという個別結果として保持する。

この監査集合は全体として`Invalidated`であり、現在の合否へ流用しない。型付きASTを使用する単一classifierへ3 projectのowned sourceを集約し、Boolean、配列、真の定数、parameter、destructuringおよびnested declarationを全数検査して識別子を移行した。併せて現行利用側の廃止Path検査、配布正本からpackage entry adapterへの所有方向、互換wrapper禁止の限定、locale-firstおよび過去CHGの現在接続を構造的に是正した。これらは`Applied`／`Self-checked`であり、新固定版の同じ監査集合が完了するまでは`Resolved`ではない。

## Self-check

2026-08-16の編集後候補で次を確認した。

- Node.js 24.12のCoordinator試験: 255 / 255 Pass
- Node.js 24.12のChecker既存契約試験: 144 / 144 Pass
- Node.js 24.12の命名／廃止参照contract試験: 4 / 4 Pass（package全体148 / 148 Pass）
- Checker／CoordinatorのTypeScript型検査、Biome LintおよびFormatter確認: Pass
- Checker package rootからのRepository全体確認: 403 file／279 Markdown／1857 link／561 anchor、Error 0／Warning 0
- 旧Checker Pathの実体、互換shimおよびalias: 0件

この結果は`Self-checked`であり、固定Commit／Treeに対する独立review／audit前は`Resolved`ではない。
