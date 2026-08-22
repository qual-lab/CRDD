# 変更トレース: Claude実行計画基盤（Claude Execution Plan Foundation）

- 変更ID: `CHG-000028`
- 状態: `Verified`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-22
- 対象: CRDD公式Repositoryのprivate Coordinatorにおける最初の外部Executor候補
- 対象version: v0.18.0 Candidate
- 変更分類: `breaking`（privateなProvider実行計画をClaude Codeへ先行限定し、任意CLI、任意prompt、Host CLI fallbackおよびAPI課金経路を受理しない）
- 移行要否: `migration_required: true`（新規contract、試験、package command、TypeScript projectとCheckerの固定source母集団、READMEおよび脅威モデルを同時追加する。supported production consumer、認証sessionおよび実Provider stateは0で、永続変換はない）
- 関連正本: [`18_Context_Dependency.md`](../../18_Context_Dependency.md)、[`19_Maintenance.md`](../../19_Maintenance.md#33-internal-typescript-runtime)、[`CHG-000022`](CHG-000022_Provider_Lifecycle_Foundation.md)、[`CHG-000026`](CHG-000026_Provider_Home_Protection_Foundation.md)、[`tools/coordinator/README.md`](../../tools/coordinator/README.md)、[`tools/coordinator/threat-model.md`](../../tools/coordinator/threat-model.md)

## 結論と変更経路

最初の外部ExecutorはClaude Codeだけを対象にし、Codex CLI Adapter、実login、実Provider request、Installer、Egress Proxy EffectおよびProvider Home保護Effectを本変更へ含めない。Anthropic公式release manifestに基づくLinux x64 binary `2.1.220`のversion、upstream commit、SHA-256、byte長および固定絶対pathと、toolを持たない固定probe argvを、起動不能な候補contractとして追加する。

変更は管理対象依存、Credential、外部送信および将来のprocess起動へ接続する非自明なprivate security変更である。着手前整合ではProvider Lifecycle、Provider Home、Egress、管理対象依存、QA、内部TypeScript境界および人間向け日本語表示を確認した。完成固定版ではAgent／Architecture／Security Review、Document Audit、Gap／Impact AuditおよびConformance Auditを同一改訂版へ実施する。公開CLI、採用Repository Schema、Communication、DiscoveryおよびUIは変更しないため非該当である。

## 発火、非発火、境界および情報不足

- 発火例: `provider:claude`と`mode:read_only_probe`だけを持つplain objectは、固定command、argv、環境、配布Identityおよび未完了の有効化条件を持つ`candidate`になる。
- 非発火例: 通常`doctor`、`doctor --isolation`、source import、contract testおよび説明contract取得はProvider process、Network、Filesystem、loginまたは課金Effectを発火しない。
- 境界例: `provider:codex`、別mode、余分field、accessorまたはProxyは固定`blocked` reasonへ閉じる。正しい候補も`spawnAllowed:false`であり、Operation Capabilityを発行しない。
- 情報不足例: manifest署名、fixed image digest、terms有効化、専用Home保護、Mount Grant、Egress Proxy、Telemetry判断、OAuth観測またはsubscription quotaを確認できない場合はspawn前に停止する。Host CLI、npm package、API keyまたは別Providerへfallbackしない。

## 管理対象依存と外部情報境界

外部へ送信したのは公開製品名と公開version確認語だけで、Repository内容、Path、Credential、prompt、利用者情報または内部成果物を送信していない。次の公式入力を2026-08-22に確認した。利用条件文書の確認は候補文書を再識別するための記録であり、選択アカウントへの適用、同意、固定image利用、再配布または自動subscription利用の許可を意味しない。

| 文書Identity | 公式URL／source revision | 公開版の発効日 | 確認状態と今回の限界 |
| --- | --- | --- | --- |
| Claude Code CLI reference | `https://code.claude.com/docs/en/cli-usage` | Not stated | `candidate_reviewed`。固定argv候補の意味を確認したが、exact binaryでの実挙動は未検証 |
| Claude Code advanced setup | `https://code.claude.com/docs/en/getting-started` | Not stated | `candidate_reviewed`。native binaryと署名手順を確認したが、署名は未検証 |
| Claude Code release manifest 2.1.220 | `https://downloads.claude.ai/claude-code-releases/2.1.220/manifest.json` | Not stated | `candidate_reviewed`。manifest観測値であり、有効な署名済み配布物へ未昇格 |
| Claude Code GitHub release v2.1.220 | `https://github.com/anthropics/claude-code/releases/tag/v2.1.220`、public release commit `7ef6eec9d9ba84ea6f233f26c45f1df5c5991843` | 2026-07-25 release | `candidate_reviewed`。binary manifestのupstream commitとは別Identity |
| Claude Code LICENSE at v2.1.220 release commit | `https://github.com/anthropics/claude-code/blob/7ef6eec9d9ba84ea6f233f26c45f1df5c5991843/LICENSE.md` | Not stated | `candidate_unresolved`。Commercial Terms参照を確認したが、固定image利用または再配布許可は未解決 |
| Anthropic Commercial Terms | `https://www.anthropic.com/legal/commercial-terms` | 2025-06-17 | `candidate_unresolved`。公開版の発効日を観測しただけで、選択アカウントへの適用は未解決 |
| Anthropic Consumer Terms | `https://www.anthropic.com/legal/consumer-terms` | 2025-10-08 | `candidate_unresolved`。公開版の発効日を観測しただけで、選択アカウントへの適用は未解決 |

manifestはversion `2.1.220`、commit `4073f59596e272f39393db4f96abc5f4b10eff21`、Linux x64 checksum `674f61f20ff306f3100cf9200e4c36c4b70278b5bef2884549819b942a89c863`および275,012,592 byteを示す。公式setupはrelease manifestのGPG署名とrelease signing key fingerprint `31DD DE24 DDFA B679 F42D 7BD2 BAA9 29FF 1A7E CACE`の確認手順を示す。現在環境にはGPG verifierがないため、署名は未検証であり、観測値を有効な配布成果物へ昇格しない。

## 固定probe計画と課金境界

固定commandは`/opt/crdd/providers/claude/2.1.220/claude`であり、同じversion、commit、SHA-256およびbyte長のartifact Identityへ結合する。固定argvは`--bare`、`-p`、固定prompt、`--output-format json`、`--max-turns 1`、`--no-session-persistence`、`--permission-mode plan`、`--tools ""`、`--disallowedTools mcp__*`および`--disable-slash-commands`だけである。親process環境を継承せず、Runtime所有の`HOME`、`TMPDIR`、`HTTPS_PROXY`と`DISABLE_AUTOUPDATER=1`、`DISABLE_UPDATES=1`、`CLAUDE_CODE_SKIP_PROMPT_HISTORY=1`だけで完全置換することを要求する。環境置換、fixed image digest、exact versionでのargv制約、user／project／local／managed settings、Provider Home settingsおよび認証stateとの分離は未実装または未検証なので、要求を実測済みと扱わない。shell、PATH lookup、workspace mount、resumeおよびsession永続化を許可せず、各未完了条件をactivation blockerとしてspawn前停止へ接続する。

`read_only_probe`はRepository変更を許可しない計画名であり、Providerへの外部request、専用HomeへのProvider内部書込み、既存subscription利用枠の消費、Telemetryまたは認証更新が存在しないという主張ではない。Pro／Maxはindividual offering候補、Team／Enterpriseはorganization offering候補としてだけ保持する。binary配布物の条件と認証済みservice／アカウントの適用条件を別axisにし、選択アカウントの提供形態、適用条件、自動subscription利用許可、人間のアカウント権限確認およびbindingはいずれも未解決とする。Console API account、API key、第三者API Provider、追加credit購入および自動plan切替は拒否し、quota不足または判定不能では追加購入せず停止する。

## 専門探索と収束

| 案 | 利点 | 反証・短所 | 採否 |
| --- | --- | --- | --- |
| npm packageをfixed imageへinstall | versionとintegrityをpackage lockへ固定しやすい | 公式READMEではnpm installがdeprecatedで、postinstallとplatform optional packageを供給網へ追加する | 不採用 |
| native installerをRuntimeへ組み込む | 公式推奨経路に近い | install script実行、自動更新launcher、download時EffectおよびInstaller保守がRuntimeへ入る | 不採用 |
| 公式署名manifestからexact binaryをbuild時に取得 | version、platform checksum、byte長を固定し、RuntimeからInstallerを除外できる | build時のGPG署名検証、binary取得、terms確認およびimage digest固定が必要 | 採用候補 |
| Hostの既存Claude CLIを実行 | 追加image buildが不要 | PATH差替え、Host Home、auto-update、Credentialおよびversion driftを隔離できない | 不採用 |

判断を変え得る不確実性は、binary配布物の適用条件と固定image利用許可、認証済みserviceへ適用される条件と自動subscription利用許可、選択アカウントに対する人間の権限、manifest署名の実検証、Telemetry停止方法、subscription quota観測および専用Home内の実書込みである。提供形態名だけからConsumer TermsまたはCommercial Termsの適用を確定しない。これらは非実行contractの成立を妨げないが、実配布またはspawnの有効化前に人間判断または実測が必要である。追加探索によって現在の非実行候補の安全境界を変える有力案はなく、実Effectを別変更へ分離して収束する。

## 品質義務と未完了事項

- pure production母集団`claude-execution-plan.ts`と直接依存`plain-data-snapshot.ts`のline、functionおよびbranch coverageを100%にする。
- strict typecheck、Biome warning 0、format差分0、全Coordinator contract test、Checker package testおよび全Repository checkerを別軸で確認する。
- 固定候補commitにAgent／Architecture／Security、Document、Gap／ImpactおよびConformanceの独立確認を行い、全結果を統合する。
- manifest署名検証、binary取得、fixed image build／digest、argv互換性、配布条件とservice条件の有効化、Provider Home Effect、Mount Grant、Egress Proxy、Telemetry、login／logout、quota probeおよび実Provider probeは[`実装残件台帳`](../../99_Roadmap/08_CRDD_v0_18_Implementation_Follow_Up_Registry.md)から後続変更として追跡する。

基準Node.js `v24.19.0`で、Coordinator strict typecheck／Biome lint／formatはPass、全contract testは392／392、Checker package checkはPass、contract testは151／151だった。専用coverage commandはproduction source `claude-execution-plan.ts`と`plain-data-snapshot.ts`のline、functionおよびbranchを各100.00%とした。Repository全体checkerは529 files、335 Markdown、1,968 local links、575 anchorsを確認し、Error 0／Warning 0だった。実Provider、Docker、Network、Filesystem、OAuthまたは課金Effectは本確認で発火していない。

## 初回独立確認と是正

固定commit `788eb81f021f02790c40a81b4a0793ae4fe0fc80`への初回確認は、Agent／Architecture／Security ReviewがConditional、Document AuditがFail、Gap／Impact AuditおよびConformance AuditがFailだった。共通原因は、PATH lookupを拒否しながらcommandをbasenameで示したこと、親環境置換が未定義だったこと、customization抑止要求を検証済み事実として表したこと、binary配布条件と認証済みservice／アカウント条件を一つのgenericなterms項目へ潰したこと、および後続残件に発見可能な台帳がなかったことである。

是正では固定絶対pathとartifact Identityを結合し、環境完全置換と禁止する親環境分類を追加し、argv／customization／settingsの要求と検証状態を分離した。配布条件とservice条件を別axisへ分け、提供形態を適用条件ではなく候補分類に限定し、選択アカウント、適用条件、自動利用許可および人間権限を明示的なblockerにした。Provider Lifecycle contractもrevision 4へ更新し、Claudeの利用源を既存subscriptionのincluded usage候補へ修正した。残件は非規範の実装残件台帳へ接続した。初回監査結果は修正版の合否へ流用せず、新しい固定commitへ同じ監査集合を再実行する。

固定commit `b8c53064fc931d2a81152ea3ae38159219d622c3`への再確認では、危険な昇格原因は解消したが、Agent／Architecture／Security Reviewは配布bindingの重複投影を1件、Document Auditは利用条件3文書の出典追跡不足を1件、Gap／Impact／Conformanceは同じ出典追跡不足と台帳の非正本Work Stateを2件残した。統合是正では、Identity、署名状態、image digestおよびargv互換性を単一の`DISTRIBUTION_BINDING`から全計画へ投影し、release tagが指すpublic commit `7ef6eec9d9ba84ea6f233f26c45f1df5c5991843`へLICENSEを固定した。利用条件3文書は文書Identity、公開版発効日、確認日および候補状態を記録しつつ、実アカウントへの適用を未解決に保った。台帳は`In Progress`と`Unscheduled`の正本Work Stateへ修正した。この再確認結果も最終固定版の合否へ流用しない。

現在、人間による判断は非実行候補の実装には必要ない。配布条件またはservice条件を有効化し、binaryを固定imageへ格納し、選択アカウントを実Providerへbindingする判断は、後続の実配布・認証変更を開始する前に必要である。本変更はv0.18 Candidate、v0.17 Released Baseline、Gate blocked、Authority／Capability非発行および非Releaseを維持する。

## 最終独立確認

固定Commit `01a92ba5d8597baebf52265c6c733747451e44ad`／Tree `2100a7d0d8682df6da80ba2771a8b4c95b62837a`で、全機械確認と必須監査集合を旧合否不流用で取得した。Agent／Architecture／Security、Document、Gap／ImpactおよびConformanceはすべて`Pass`／Finding 0で、変更scope claim eligibilityは`Eligible`である。旧Findingはすべて`Resolved`、新規候補は0件である。

固定結果は[`Agent／Architecture／Security Review`](Evidence/CHG-000028_Agent_Security_Review_01a92ba.md)、[`Document Audit`](Evidence/CHG-000028_Document_Audit_01a92ba.md)、[`Gap／Impact＋Conformance Audit`](Evidence/CHG-000028_Gap_Conformance_Audit_01a92ba.md)および[`Current Review Record`](Evidence/CHG-000028_Current_Review_Record_01a92ba.md)へ保存する。この`Verified`はCHG-000028の非実行候補の検証完了だけを表し、実Provider readiness、Gate open、採用、統合、StableまたはReleaseを意味しない。
