# 変更トレース: Claude実行計画基盤（Claude Execution Plan Foundation）

- 変更ID: `CHG-000028`
- 状態: `Ready for Verification`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-22
- 対象: CRDD公式Repositoryのprivate Coordinatorにおける最初の外部Executor候補
- 対象version: v0.18.0 Candidate
- 変更分類: `breaking`（privateなProvider実行計画をClaude Codeへ先行限定し、任意CLI、任意prompt、Host CLI fallbackおよびAPI課金経路を受理しない）
- 移行要否: `migration_required: true`（新規contract、試験、package command、TypeScript projectとCheckerの固定source母集団、READMEおよび脅威モデルを同時追加する。supported production consumer、認証sessionおよび実Provider stateは0で、永続変換はない）
- 関連正本: [`18_Context_Dependency.md`](../../18_Context_Dependency.md)、[`19_Maintenance.md`](../../19_Maintenance.md#33-internal-typescript-runtime)、[`CHG-000022`](CHG-000022_Provider_Lifecycle_Foundation.md)、[`CHG-000026`](CHG-000026_Provider_Home_Protection_Foundation.md)、[`tools/coordinator/README.md`](../../tools/coordinator/README.md)、[`tools/coordinator/threat-model.md`](../../tools/coordinator/threat-model.md)

## 結論と変更経路

最初の外部ExecutorはClaude Codeだけを対象にし、Codex CLI Adapter、実login、実Provider request、Installer、Egress Proxy EffectおよびProvider Home保護Effectを本変更へ含めない。Anthropic公式release manifestに基づくLinux x64 binary `2.1.220`のversion、upstream commit、SHA-256およびbyte長と、toolを持たない固定probe argvを、起動不能な候補contractとして追加する。

変更は管理対象依存、Credential、外部送信および将来のprocess起動へ接続する非自明なprivate security変更である。着手前整合ではProvider Lifecycle、Provider Home、Egress、管理対象依存、QA、内部TypeScript境界および人間向け日本語表示を確認した。完成固定版ではAgent／Architecture／Security Review、Document Audit、Gap／Impact AuditおよびConformance Auditを同一改訂版へ実施する。公開CLI、採用Repository Schema、Communication、DiscoveryおよびUIは変更しないため非該当である。

## 発火、非発火、境界および情報不足

- 発火例: `provider:claude`と`mode:read_only_probe`だけを持つplain objectは、固定command、argv、環境、配布Identityおよび未完了の有効化条件を持つ`candidate`になる。
- 非発火例: 通常`doctor`、`doctor --isolation`、source import、contract testおよび説明contract取得はProvider process、Network、Filesystem、loginまたは課金Effectを発火しない。
- 境界例: `provider:codex`、別mode、余分field、accessorまたはProxyは固定`blocked` reasonへ閉じる。正しい候補も`spawnAllowed:false`であり、Operation Capabilityを発行しない。
- 情報不足例: manifest署名、fixed image digest、terms有効化、専用Home保護、Mount Grant、Egress Proxy、Telemetry判断、OAuth観測またはsubscription quotaを確認できない場合はspawn前に停止する。Host CLI、npm package、API keyまたは別Providerへfallbackしない。

## 管理対象依存と外部情報境界

外部へ送信したのは公開製品名と公開version確認語だけで、Repository内容、Path、Credential、prompt、利用者情報または内部成果物を送信していない。2026-08-22に確認した公式入力は次である。

- Anthropic CLI reference: `https://code.claude.com/docs/en/cli-usage`
- Anthropic advanced setup: `https://code.claude.com/docs/en/getting-started`
- Anthropic release manifest: `https://downloads.claude.ai/claude-code-releases/2.1.220/manifest.json`
- Anthropic GitHub release: `https://github.com/anthropics/claude-code/releases/tag/v2.1.220`

manifestはversion `2.1.220`、commit `4073f59596e272f39393db4f96abc5f4b10eff21`、Linux x64 checksum `674f61f20ff306f3100cf9200e4c36c4b70278b5bef2884549819b942a89c863`および275,012,592 byteを示す。公式setupはrelease manifestのGPG署名とrelease signing key fingerprint `31DD DE24 DDFA B679 F42D 7BD2 BAA9 29FF 1A7E CACE`の確認手順を示す。現在環境にはGPG verifierがないため、署名は未検証であり、観測値を有効な配布成果物へ昇格しない。

## 固定probe計画と課金境界

固定argvは`--bare`、`-p`、固定prompt、`--output-format json`、`--max-turns 1`、`--no-session-persistence`、`--permission-mode plan`、`--tools ""`、`--disallowedTools mcp__*`および`--disable-slash-commands`だけである。環境は`DISABLE_AUTOUPDATER=1`、`DISABLE_UPDATES=1`および`CLAUDE_CODE_SKIP_PROMPT_HISTORY=1`を固定する。shell、PATH lookup、workspace mount、project instruction、customization、built-in tool、MCP tool、resumeおよびsession永続化を許可しない。

`read_only_probe`はRepository変更を許可しない計画名であり、Providerへの外部request、専用HomeへのProvider内部書込み、既存subscription利用枠の消費、Telemetryまたは認証更新が存在しないという主張ではない。Pro、Max、TeamまたはEnterpriseの既存subscription OAuthだけを候補とし、Console API account、API key、第三者API Provider、追加credit購入および自動plan切替は拒否する。quota不足または判定不能では追加購入せず停止する。

## 専門探索と収束

| 案 | 利点 | 反証・短所 | 採否 |
| --- | --- | --- | --- |
| npm packageをfixed imageへinstall | versionとintegrityをpackage lockへ固定しやすい | 公式READMEではnpm installがdeprecatedで、postinstallとplatform optional packageを供給網へ追加する | 不採用 |
| native installerをRuntimeへ組み込む | 公式推奨経路に近い | install script実行、自動更新launcher、download時EffectおよびInstaller保守がRuntimeへ入る | 不採用 |
| 公式署名manifestからexact binaryをbuild時に取得 | version、platform checksum、byte長を固定し、RuntimeからInstallerを除外できる | build時のGPG署名検証、binary取得、terms確認およびimage digest固定が必要 | 採用候補 |
| Hostの既存Claude CLIを実行 | 追加image buildが不要 | PATH差替え、Host Home、auto-update、Credentialおよびversion driftを隔離できない | 不採用 |

判断を変え得る不確実性は、Anthropicの利用条件をCRDDのローカル固定image内で使用する判断、manifest署名の実検証、Telemetry停止方法、subscription quota観測および専用Home内の実書込みである。これらは非実行contractの成立を妨げないが、実配布またはspawnの有効化前に人間判断または実測が必要である。追加探索によって現在の非実行候補の安全境界を変える有力案はなく、実Effectを別変更へ分離して収束する。

## 品質義務と未完了事項

- pure production母集団`claude-execution-plan.ts`と直接依存`plain-data-snapshot.ts`のline、functionおよびbranch coverageを100%にする。
- strict typecheck、Biome warning 0、format差分0、全Coordinator contract test、Checker package testおよび全Repository checkerを別軸で確認する。
- 固定候補commitにAgent／Architecture／Security、Document、Gap／ImpactおよびConformanceの独立確認を行い、全結果を統合する。
- manifest署名検証、binary取得、fixed image build／digest、terms有効化、Provider Home Effect、Mount Grant、Egress Proxy、Telemetry、login／logout、quota probeおよび実Provider probeは後続変更として追跡する。

基準Node.js `v24.19.0`で、Coordinator strict typecheck／Biome lint／formatはPass、全contract testは391／391、Checker package checkはPass、contract testは151／151だった。専用coverage commandはproduction source `claude-execution-plan.ts`と`plain-data-snapshot.ts`のline、functionおよびbranchを各100.00%とした。Repository全体checkerは528 files、334 Markdown、1,958 local links、571 anchorsを確認し、Error 0／Warning 0だった。実Provider、Docker、Network、Filesystem、OAuthまたは課金Effectは本確認で発火していない。

現在、人間による判断は非実行候補の実装には必要ない。Anthropicの利用条件を有効化しbinaryを固定imageへ格納する判断は、後続の実配布変更を開始する前に必要である。本変更はv0.18 Candidate、v0.17 Released Baseline、Gate blocked、Authority／Capability非発行および非Releaseを維持する。
