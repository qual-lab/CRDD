# 変更トレース: 内部ツールのコーディング規約と命名移行

- 変更ID: `CHG-000017`
- 状態: `Reopened`
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

この監査集合は全体として`Invalidated`であり、現在の合否へ流用しない。型付きASTを使用する単一分類器（classifier）へ3 projectのowned sourceを集約し、Boolean、配列、真の定数、parameter、destructuringおよびnested declarationを全数検査して識別子を移行した。併せて現行利用側の廃止Path検査、配布正本からpackage entry adapterへの所有方向、互換wrapper禁止の限定、locale-firstおよび過去CHGの現在接続を構造的に是正した。これらは`Applied`／`Self-checked`であり、新固定版の同じ監査集合が完了するまでは`Resolved`ではない。

## Self-check

2026-08-16の編集後候補で次を確認した。

- Node.js 24.12のCoordinator試験: 255 / 255 Pass
- Node.js 24.12のChecker既存契約試験: 144 / 144 Pass
- Node.js 24.12の命名／廃止参照contract試験: 4 / 4 Pass（package全体148 / 148 Pass）
- Checker／CoordinatorのTypeScript型検査、Biome LintおよびFormatter確認: Pass
- Checker package rootからのRepository全体確認: 403 file／279 Markdown／1857 link／561 anchor、Error 0／Warning 0
- 旧Checker Pathの実体、互換shimおよびalias: 0件

この結果は`Self-checked`であり、固定Commit／Treeに対する独立review／audit前は`Resolved`ではない。

## 構造是正版の監査集合と再是正

構造是正版はCommit `bab5169fdfbdc7ef3677a95cffa07259ad52f925`、Tree `4e7619d289b5e8a0bf798bf1a52da02427ae9e6c`、Parent `7ff1a81e7bc044c57d51b6ac503fe2534ed2b711`である。共通入力はNode.js 24.12、Coordinator試験255 / 255、Checker package試験148 / 148、型検査／Biome Lint／Formatter Pass、全体Checker 403 file／279 Markdown／1857 link／561 anchor、Error 0／Warning 0、diff／worktree cleanだった。

- Agent／Architecture／Security review: `Fail`、Major 2件。`AG-CODING-STANDARDS-R01`はソース所有範囲（source ownership root）をPath検査へ流用して`tools/**`全体のPath母集団を縮退させた今回修正起因の新規退行、`AG-CODING-STANDARDS-R02`は既知`AG-CODING-STANDARDS-002`の宣言形、型制約付きジェネリック（generic）配列および固定定数分類が部分未解消だった結果である。
- Document Audit: `Pass`、Finding 0件。初回版で指摘された所有方向、履歴接続およびlocale-firstの解消確認として個別保持する。
- Gap / Impact Audit: `Fail`、Major 1件。`GCI-TOOLS-NAMING-R01`は既知`GCI-TOOLS-NAMING-001`の型付き分類器とfixtureが部分未解消だった結果であり、新規候補4分類へ加算しない。
- Conformance Audit: `Pass`、Finding 0件。準拠基準、Stable ID、Version、Authority／CapabilityおよびRelease状態を変更しない個別結果として保持する。

この監査集合も全体として`Invalidated`であり、現在の合否へ流用しない。後続処置では、Path検査範囲（Path inspection root）を`tools/**`＋`template/tools/**`、型付きソース所有範囲（typed source ownership root）を3 TypeScript projectへ分離し、両集合のTypeScript対象範囲（TypeScript coverage）を完全一致させた。型付き分類器へ名前付き関数／class式、取得／設定アクセサー、型制約付きジェネリック配列および固定定数のシンボル（symbol）追跡を追加した。固定定数は任意identifierや任意`Object.freeze`を認めず、固定集約値（fixed aggregate）、CRDD所有module定数、限定した組込み要素（intrinsic）および終端ダイジェスト（terminal digest）へ限定し、Path、snapshot、resource handle、shadowed globalおよび循環定数を負例で固定した。

この後続処置は`Applied`／`Self-checked`であり、新しい固定Commit／Treeの全機械確認と同じ監査集合が完了するまでは`Resolved`ではない。公開CheckerのCLI／JSON／Schema／reason／status、v0.17 Releaseおよび今回のbreaking migration／no-shim境界は変更していない。

### 再是正Self-check

2026-08-16の再是正後候補で次を確認した。

- Node.js 24.12のCoordinator試験: 255 / 255 Pass
- Node.js 24.12のChecker既存契約試験: 144 / 144 Pass
- Path／型付き命名／廃止参照contract試験: 5 / 5 Pass（Checker package全体149 / 149 Pass）
- Checker／CoordinatorのTypeScript型検査、Biome LintおよびFormatter確認: Pass
- 公式入口とChecker package root入口のRepository全体確認: いずれも403 file／279 Markdown／1857 link／561 anchor、Error 0／Warning 0
- 3 TypeScript projectから得た実Path重複排除後のowned source: 74件。`tools/**`＋`template/tools/**`にあるTypeScript実ファイル集合との未所属／余剰: 0件
- 旧Checker Pathの現行実体、互換shimおよびalias: 0件

この結果も`Self-checked`であり、新固定Commit／Treeに対する独立review／audit前は`Resolved`ではない。

## 閉包是正版の監査集合と後続処置

閉包是正版はCommit `c3db7689dcb534579863bfd4bc5e2fbd58769fbc`、Tree `1c375d005509103b7a86acf1a1d505ad4674c92a`、Parent `bab5169fdfbdc7ef3677a95cffa07259ad52f925`である。共通入力はNode.js 24.12、Coordinator試験255 / 255、Checker package試験149 / 149、3 TypeScript project／74 owned sourceとPath配下TypeScript実体の完全一致、型検査／Biome Lint／Formatter Pass、全体Checker 403 file／279 Markdown／1857 link／561 anchor、Error 0／Warning 0、diff／worktree cleanだった。

- Agent／Architecture／Security review: `Fail`、Major 1件。`AG-CODING-STANDARDS-R02-R03`は既知`AG-CODING-STANDARDS-R02`の直接固定配列／object、組込み`Date`のproperty allowlistおよびfixture完全一致が部分未解消だった結果であり、新規候補4分類へ加算しない。
- Document Audit: `Conditional`、Minor 1件。`DOC-TOOLS-LOCALE-R02`は同根1件で、`00_Overview.md`の直接利用側残存は初回監査見落とし、閉包是正で追加した現在説明は今回修正起因という発生内訳を保持する。
- Gap / Impact Audit: `Fail`、Major 1件とMinor 1件。`GCI-TOOLS-NAMING-R02`は組込み`Date`の閉じたallowlistを一般property fallbackが迂回した今回修正起因の新規退行、`GCI-TOOLS-NAMING-R01-R2`は既知`GCI-TOOLS-NAMING-R01`のnullable／型制約付きジェネリック（generic）／tuple fixtureが部分未解消だった結果で、新規候補4分類へ加算しない。
- Conformance Audit: `Pass`、Finding 0件。準拠基準、Stable ID、Version、Authority／Capability、v0.17 Released BaselineおよびRelease状態を変更しない個別結果として保持する。

この監査集合も全体として`Invalidated`であり、現在の合否へ流用しない。後続処置では、global `Date`のpropertyを`Date.now`と`Date.prototype.toISOString`へ閉じ、CRDD所有の固定集約値を参照するproperty経路と分離した。直接記述する配列／objectはmodule-local、非export、再帰固定で、すべての参照が変更またはescapeのない`void`参照として分類できる場合だけ真の定数とした。fixtureは宣言ごとに固有名と位置を持たせ、違反の重複を潰さない完全一致へ変更し、変更、nested変更、alias、escape、`Date.parse`、`Date.prototype`および適用外property／overrideを対照化した。`00_Overview.md`、コーディング規約正本および本変更トレースの現在説明は、日本語表示を先に示すlocale-firstへ同期した。

これらの後続処置は`Applied`／`Self-checked`であり、新しい固定Commit／Treeの全機械確認と同じ監査集合が完了するまでは`Resolved`ではない。公開CheckerのCLI／JSON／Schema／reason／status、breaking migration／no-shim、Version、v0.17 ReleaseおよびRelease判断は変更していない。

### 閉包再是正Self-check

2026-08-16の閉包再是正後候補で次を確認した。

- Node.js 24.12のCoordinator試験: 255 / 255 Pass
- Node.js 24.12のChecker package試験: 149 / 149 Pass。うちPath／型付き命名／廃止参照contract試験は5 / 5 Pass
- 3 TypeScript projectから得たowned source: 74件。Path配下のTypeScript実体との未所属／余剰: 0件
- Checker／CoordinatorのTypeScript型検査、Biome LintおよびFormatter確認: Pass
- 公式入口とChecker package root入口のRepository全体確認: いずれも403 file／279 Markdown／1857 link／561 anchor、Error 0／Warning 0
- 旧Checker Pathの現行実体、互換shimおよびalias: 0件

この結果は`Self-checked`であり、新固定Commit／Treeに対する独立review／audit前は`Resolved`ではない。

## 安全read是正版の監査集合と後続処置

安全read是正版はCommit `370137757c4a1d43ddc96cd16d3f6224cd6c67e1`、Tree `910fe12de19e01cb8161ffcb244df987455f2932`、Parent `c3db7689dcb534579863bfd4bc5e2fbd58769fbc`である。共通入力はNode.js 24.12、Coordinator試験255 / 255、Checker package試験149 / 149、3 TypeScript project／74 owned sourceとPath配下TypeScript実体の完全一致、両package check Pass、公式／package root全体Checker 403 file／279 Markdown／1857 link／561 anchor、Error 0／Warning 0、diff／worktree cleanだった。

- Agent／Architecture／Security review: `Fail`、Major 1件。`AG-CODING-STANDARDS-R02-R04`は`Object.freeze(Date)`経由で組込み`Date`の閉じたproperty allowlistを迂回できた既知Finding部分未解消で、新規候補4分類へ加算しない。
- Document Audit: `Conditional`、Minor 1件。`DOC-TOOLS-DIRECT-FIXED-R01`は正本が分類可能な非変更readを許す一方、実装が`void`参照だけを許した既知Finding部分未解消で、新規候補4分類へ加算しない。
- Gap / Impact Audit: `Pass`、Finding 0件。
- Conformance Audit: `Pass`、Finding 0件。Gap / Impactへ集約せず、準拠基準、Stable ID、Version、Authority／Capability、v0.17 Released BaselineおよびRelease状態を変更しない個別結果として保持する。

この監査集合も全体として`Invalidated`であり、現在の合否へ流用しない。後続処置では、固定集約値からの安全readを元の直接literalへsegmentごとに照合し、objectのown data property、配列の範囲内固定index、配列自身の終端`length`および、Boolean／string／number／bigintの終端値だけへ閉じた。prototype、method、dynamic／範囲外index、aggregate取出し、変更、alias、argument、returnその他のescapeは一般bindingへfail closedにする。`Object.freeze(...)`の固定集約値seedはglobal intrinsic、exact 1引数、再帰固定された直接配列／object literalだけへ限定し、`Date`およびそのaliasを凍結した迂回を負例化した。

これらの後続処置は`Applied`／`Self-checked`であり、新しい固定Commit／Treeの全機械確認と同じ監査集合が完了するまでは`Resolved`ではない。公開CheckerのCLI／JSON／Schema／reason／status、breaking migration／no-shim、Version、v0.17 ReleaseおよびRelease判断は変更していない。

### 安全read再是正Self-check

2026-08-16の安全read再是正後候補で次を確認した。

- Node.js 24.12のCoordinator試験: 255 / 255 Pass
- Node.js 24.12のChecker package試験: 149 / 149 Pass。うちPath／型付き命名／廃止参照contract試験は5 / 5 Pass
- 3 TypeScript projectから得たowned source: 74件。Path配下のTypeScript実体との未所属／余剰: 0件
- Checker／CoordinatorのTypeScript型検査、Biome LintおよびFormatter確認: Pass
- 公式入口とChecker package root入口のRepository全体確認: いずれも403 file／279 Markdown／1857 link／561 anchor、Error 0／Warning 0
- 旧Checker Pathの現行実体、互換shimおよびalias: 0件

この結果は`Self-checked`であり、新固定Commit／Treeに対する独立review／audit前は`Resolved`ではない。

## 利用文脈是正版の監査集合と後続処置

利用文脈是正版はCommit `4a232fa80fcb67c2418346c3cebfe61c5b19fbfd`、Tree `a0c3e033b8267cf97fb7a7d26049c7ef7ff4f3cf`、Parent `370137757c4a1d43ddc96cd16d3f6224cd6c67e1`である。共通入力はNode.js 24.12、Coordinator試験255 / 255、Checker package試験149 / 149、3 TypeScript project／74 owned sourceとPath配下TypeScript実体の完全一致、両package check Pass、公式／package root全体Checker 403 file／279 Markdown／1857 link／561 anchor、Error 0／Warning 0、diff／worktree cleanだった。

- Agent／Architecture／Security review: `Fail`、Major 1件。`AG-CODING-STANDARDS-R05`は固定集約値のliteral由来とprimitive終端を検証しても、代入、更新または削除等の利用文脈を拒否していなかった今回修正起因の新規退行である。
- Document Audit: `Conditional`、Minor 1件。`DOC-TOOLS-DIRECT-FIXED-R02`は一般の`Object.freeze(...)`分岐が`Date`またはaliasを真の定数として受理し、正本の直接literal限定と一致しなかった既知Finding部分未解消で、新規候補4分類へ加算しない。
- Gap / Impact Audit: `Fail`、Major 2件。`GCI-TOOLS-NAMING-R03`は安全readの利用文脈を確認しなかった今回修正起因の新規退行、`GCI-TOOLS-NAMING-R02-R2`は一般の`Object.freeze(...)`分岐が部分未解消だった結果である。
- Conformance Audit: `Pass`、Finding 0件。準拠基準、Stable ID、Version、Authority／Capability、v0.17 Released BaselineおよびRelease状態を変更しない個別結果として保持する。

この監査集合も全体として`Invalidated`であり、現在の合否へ流用しない。後続処置では、固定集約値からのreadについて、括弧、`as`、`satisfies`およびnon-null wrapperの外側まで利用文脈を確認し、直接`void`参照、非export変数宣言の初期値、代入ではない明示した二項readおよびテンプレート補間だけを許可した。代入、compound／logical assignment、更新、削除、引数渡し、`new`、return、暗黙returnおよびexportを固有負例で固定し、未定義文脈は一般bindingへfail closedにした。一般の`Object.freeze(...)`と固定集約値seedは、global symbol、exact 1引数、再帰固定された直接配列／object literalを確認する同一private predicateへ統合した。`Object.freeze(Date)`、そのalias、primitive、owned identifierおよびresource handleは一般bindingとして検査する。

これらの後続処置は`Applied`／`Self-checked`であり、新しい固定Commit／Treeの全機械確認と同じ監査集合が完了するまでは`Resolved`ではない。公開CheckerのCLI／JSON／Schema／reason／status、3 project／74 owned source、Path母集団、breaking migration／no-shim、Version、v0.17 ReleaseおよびRelease判断は変更していない。

### 利用文脈再是正Self-check

2026-08-16の利用文脈再是正後候補で次を確認した。

- Node.js 24.12のCoordinator試験: 255 / 255 Pass
- Node.js 24.12のChecker package試験: 149 / 149 Pass。うちPath／型付き命名／廃止参照contract試験は5 / 5 Pass
- 3 TypeScript projectから得たowned source: 74件。Path配下のTypeScript実体との未所属／余剰: 0件
- Checker／CoordinatorのTypeScript型検査、Biome LintおよびFormatter確認: Pass
- 公式入口とChecker package root入口のRepository全体確認: いずれも403 file／279 Markdown／1857 link／561 anchor、Error 0／Warning 0
- 旧Checker Pathの現行実体、互換shimおよびalias: 0件

この結果は`Self-checked`であり、新固定Commit／Treeに対する独立review／audit前は`Resolved`ではない。

## 最外利用先是正版の監査集合と後続処置

最外利用先是正版はCommit `15ff4f76190f0da78167209f9de30925365d08f8`、Tree `04889784d7f1884c34c2ca716fd93020e1dc855b`、Parent `4a232fa80fcb67c2418346c3cebfe61c5b19fbfd`である。共通入力はNode.js 24.12、Coordinator試験255 / 255、Checker package試験149 / 149、Path／型付き命名／廃止参照contract試験5 / 5、3 TypeScript project／74 owned sourceとPath配下TypeScript実体の完全一致、両package check Pass、公式／package root全体Checker 403 file／279 Markdown／1857 link／561 anchor、Error 0／Warning 0、diff／worktree cleanだった。

- Agent／Architecture／Security review: `Pass`、Finding 0件。
- Document Audit: `Conditional`、Minor 1件。`DOC-TOOLS-DIRECT-FIXED-R03`は二項式またはテンプレート補間を一段挟むと、その外側の引数渡し、return、暗黙return、`new`またはexportを確認せず許可できた既知`AG-CODING-STANDARDS-R05`の部分未解消で、新規候補4分類へ加算しない。
- Gap / Impact Audit: `Pass`、Finding 0件。
- Conformance Audit: `Pass`、Finding 0件。Gap / Impactへ集約せず、準拠基準、Stable ID、Version、Authority／Capability、v0.17 Released BaselineおよびRelease状態を変更しない個別結果として保持する。

この監査集合も全体として`Invalidated`であり、現在の合否へ流用しない。後続処置では、transparent wrapper、許可した二項式およびテンプレート補間を、各子位置と演算子を再確認しながら式全体として最外利用先まで畳む。途中の二項式またはテンプレート補間を終端許可にせず、最終的に直接`void`または非export・非destructuring変数宣言の初期値へ到達した場合だけ許可する。inline exportに加え、後続`export { name }`もシンボル単位で拒否し、nested call／`new`／return／yield／暗黙return／export／tagged template／条件式／comma／destructuringを固有負例で固定する。

この後続処置は`Applied`／`Self-checked`であり、新しい固定Commit／Treeの全機械確認と同じ監査集合が完了するまでは`Resolved`ではない。`Object.freeze(...)`の単一predicate、literal由来、primitive終端、公開CheckerのCLI／JSON／Schema／reason／status、3 project／74 owned source、Path母集団、breaking migration／no-shim、Version、v0.17 ReleaseおよびRelease判断は変更していない。

### 最外利用先再是正Self-check

2026-08-16の最外利用先再是正後候補で次を確認した。

- Node.js 24.12のCoordinator試験: 255 / 255 Pass
- Node.js 24.12のChecker package試験: 149 / 149 Pass。うちPath／型付き命名／廃止参照contract試験は5 / 5 Pass
- 3 TypeScript projectから得たowned source: 74件。Path配下のTypeScript実体との未所属／余剰: 0件
- Checker／CoordinatorのTypeScript型検査、Biome LintおよびFormatter確認: Pass
- 公式入口とChecker package root入口のRepository全体確認: いずれも403 file／279 Markdown／1857 link／561 anchor、Error 0／Warning 0
- 旧Checker Pathの現行実体、互換shimおよびalias: 0件

この結果は`Self-checked`であり、新固定Commit／Treeに対する独立review／audit前は`Resolved`ではない。

## 最終監査結果

固定版`5185946ae8193d7bc305be3152558abd45fde020`に対するAgent／Architecture／Security Review、Document AuditおよびGap／Impact＋Conformance Auditは、すべて`Pass`／Finding `0`で完了した。既知Findingは`Resolved`であり、旧`15ff4f7`以前の監査集合は履歴として保持するが現在の合否へ流用しない。固定結果とSHA-256は[`CHG-000017_Current_Review_Record_5185946.md`](Evidence/CHG-000017_Current_Review_Record_5185946.md)を正本とする。

この完了は変更候補の独立確認完了であり、採用、統合、準拠、Stable化またはRelease判断を代替しない。v0.18は`Candidate`、Released Baselineはv0.17.0のままである。

## 未リリース候補の再開

CHG-000038が追加したRuntime配布成果物を独立監査前の共通Checkerへ接続したところ、通常JSON、PythonおよびDockerfileのPath規則が本変更の命名分類器へ伝播していないことを検出した。個別Pathをallowlistへ加えず、CRDD所有の共通命名規則と正負のPath classifier試験へ接続した。

同じ検査を現行Tree全体へ継続した結果、型検査projectへ未所属のCoordinator source、古い所有source件数、Windows shellが展開しないglobによりChecker packageの`npm test`が試験0件で成功する入口、および現行識別子母集団と本変更の規則の不一致を検出した。いずれも未リリースの同じ命名正本、分類器、移行、no-shim、切戻しおよび検証境界に属するため、別CHGを作らず本変更を再開して是正する。CHG-000038は発見契機とRuntime成果物の利用側接続を記録し、命名正本、分類器、全source移行およびChecker試験入口の所有は本変更へ戻す。

発見時の235 owned sourceを型付き分類器へ全数接続すると、243件の違反候補が得られた。型と利用文脈を再確認し、Booleanの閉じたpredicate、配列の不規則複数形・collective・標準引数vector、および宣言だけに存在する未使用parameterの単一underscoreを規則と正負fixtureへ固定した結果、144件は過剰判定、99件は実際のrename対象と確定した。99件はTypeScript symbol単位で宣言と利用側を移行し、object shorthandとdestructuringでは既存Schema／外部property keyを保持した。CLI flag、reason、status、protocol、暗号domain文字列、Docker外部fieldおよび既存machine Schemaは変更していない。

Checkerの全試験入口はshell globを廃止し、package所有の`*.test.ts`を列挙してNode test runnerへ明示する`test-runner.ts`へ置換した。これによりChecker／template 6、Coordinator production 119、Coordinator test 111、Rust 8、重複排除後236 sourceを現在の所有母集団として固定した。新しい試験追加時もpackage scriptの変更なしに全件へ含め、0件なら失敗する。

### 再開後Self-check

- Coordinator TypeScript型検査: Pass
- Coordinator package試験: 740 / 740 Pass
- Checker package試験: 151 / 151 Pass。命名契約5 / 5を含む
- 命名対象: 236 owned source、未所属／余剰0、命名違反0

これは再開後候補の`Applied`／`Self-checked`である。Repository全体Checker、両packageのLint／Formatter、固定改訂版に対する独立Agent／Architecture／Security Review、Document Audit、Gap / Impact AuditおよびConformance Auditが完了するまでは`Verified`へ戻さない。旧`5185946`のPassは当時版の履歴であり、現在の合否へ流用しない。

## 文書移管固定版と結合した再監査

固定改訂版`d60bcd8b835d684829d1059d304c9ab369bb3a99`を対象に、全体Checker、Checker 151／151、Coordinator 740／740、両package checkおよび`git diff --check`を共通入力として、エージェント／Architectureレビュー、Security／Conformanceレビュー、文書監査および不足／影響監査を実行した。前回までの命名違反、試験0件成功および文書移管Findingは解消していたが、エージェント／Architectureレビューは本変更に次のMajor 2件を返した。

1. `test-runner.ts`はpackage直下の`.test.ts`だけを列挙する一方、Path規則、TypeScript projectおよび所有source契約はnested testを禁止しておらず、将来のnested testが型検査へ入りながら`npm test`で未実行になり得た。
2. Boolean predicateの実装は補助動詞prefix、主語先行suffixおよびstandalone stateの閉集合を持つ一方、正本はsuffixを「等」と省略しており、実装正規表現だけを変更しても正本差分を検出できなかった。

全監査結果を統合し、安全な再帰列挙の共通化、runner列挙集合とTypeScript project所有試験集合のPath完全一致、およびBoolean三集合の正本化とexact Set実装を一つの是正として各確認者へ編集前に再提示した。全確認者は、公開Checker CLI／JSON／Schema、Coordinator試験入口、Runtime Security、v0.17公開基準およびRelease状態を変更しない条件でAcceptした。

是正候補では、package-privateな`test-discovery.ts`がrootと全entryを検査し、nested testを正規化relative Pathのordinal順で列挙する。root外解決、重複／case衝突、symbolic link／junction、未対応entryをFail Closedにし、`node_modules`はexact名かつ実Directoryの場合だけ除外する。同じ列挙器をrunnerと命名contractから使用しつつ、TypeScript projectの所有試験集合との独立した完全一致を要求した。direct／nested／0件／欠落／余剰／case衝突／junction／未知entryを正負fixtureで固定した。

Boolean規則は、補助動詞prefix 9件、主語先行suffix 32件、standalone state 9件を`tools/coding-standards.md`へ全数列挙し、実装を同じ三つのexact Setへ分解した。全許可値の正例と、prefix単独、未知suffix、大小文字差および一文字違いの負例を固定した。外部Schema／property key、CLI flag、reason、status、protocolおよび暗号domainは変更していない。

是正後のSelf-checkはChecker 153／153、Coordinator 740／740、Checker packageの型検査／Lint／Formatter Pass、237 owned TypeScript sourceの未所属／余剰0、命名違反0である。この結果は`Applied`／`Self-checked`であり、新固定Commit／Treeの全体Checker、両package checkと同じ四監査が完了するまではFindingを`Resolved`、監査を`Pass`または本変更を`Verified`としない。
