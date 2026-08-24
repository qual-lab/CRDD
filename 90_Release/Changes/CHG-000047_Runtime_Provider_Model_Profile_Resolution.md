# 変更トレース: Runtime Provider Model Profile解決

- 変更ID: `CHG-000047`
- 状態: `Implementation in Progress`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-25
- 対象: Codex Sol／Claude Opusのexact modelをSelection Grantへ結合するRuntime-owned Profile resolver
- 対象version: v0.18.0 Candidate
- 変更分類: `additive`（Provider Model Profile Runtime revision 1を追加し、既存Selection Grant production入口へ接続）
- 移行要否: `migration_required: false`（発行済みproduction Selection Grantと実Provider Operationは0。旧Profile aliasまたは外部Schemaを移行しない）
- 関連正本: [`CHG-000041`](CHG-000041_Explainable_Model_Selection_And_Claude_Docker_Adapter.md)、[`CHG-000042`](CHG-000042_Provider_Neutral_Delegation_Selection_Grant.md)、[`CHG-000046`](CHG-000046_Runtime_Provider_Eligibility_Observation.md)

## 結論

Runtime-owned Profile resolverはCodex `sol`を`gpt-5.6-sol`、Claude `opus`を固定Claude Code 2.1.220が受理する`opus` aliasへ解決する。Providerと`preferred|upper_allowed`の組合せを4つの固定Profile IDへ分け、上位tierでもfamilyまたはexact modelを切り替えず、既存Model Selection Gateが`low|medium|high`の推論量だけを理由付きで選ぶ。

Codexのmodel IDと対応effortは[OpenAI公式GPT-5.6 Sol文書](https://developers.openai.com/api/docs/models/gpt-5.6-sol)を2026-08-25に確認した。Claudeは[Anthropic公式Claude Code CLI reference](https://docs.anthropic.com/en/docs/claude-code/cli-usage)と、固定image digest内のClaude Code 2.1.220 `--help`を、Network、CredentialおよびProvider Homeなしで確認した。外部文書またはhelpの確認はSubscription entitlementを意味せず、実利用可能性はProvider Eligibility Runtimeの別軸で判定する。

## 代表例と境界

- 発火例: Codex／`sol`／`preferred`／`normal`／`subscription_oauth`は`PROFILE-100001`と`gpt-5.6-sol`へ解決する。Claude／`opus`／`upper_allowed`は`PROFILE-200002`と`opus`へ解決する。
- 非発火例: Codex／`opus`、Claude／`sol`、`fast`、API key、未知tier、余分fieldまたはfallback model要求はProfileを返さない。
- 境界例: `upper_allowed`は高コストmodelへの自動切替ではなく、既存の高コスト理由Gateを通った同family／同modelの高推論Profileである。
- 判定情報不足例: Provider適格性、Subscription entitlement、ProfileとAuthority Bundleの現在結合またはcaller入力shapeを確認できない場合はSelection GrantまたはEffectを発行しない。

## Security invariant

- Profile resolverはcaller supplied exact modelを受理せず、固定4 Profileだけを返す。
- `xhigh`、`max`、fast、Fable、別model、API key、従量APIおよび自動fallbackをProfile母集団へ含めない。
- Profile解決とProvider適格性を分け、model名が存在するだけで認証、quota、公式配布物、PolicyまたはEffect Capabilityを成立させない。
- Profile ID、Provider、family、tier、exact model、通常速度およびSubscription billing modeはSelection Grant発行前に完全一致させる。
- Profile resolver単独ではSelection Grant、Provider AuthorityまたはEffectを発行しない。

## 現在の検証結果と残件

Provider Model Profile Runtime revision 1とSelection Grant production接続を実装した。固定Claude imageのoffline help probeはexit 0で終了し、自動削除された。基準Node.js v24.19.0で対象49試験、Coordinator全531試験、strict source／test typecheck、Biome lint／formatおよびRepository全体Checkerを通過した。対象coverageではProvider Model Profile Runtimeのline、branch、functionが全て100%であり、CheckerはMarkdown 380件、local link 2146件、anchor 588件を確認してerror 0／warning 0である。

残件はProfile IDと有効化済みAuthority sourceの現在結合、両Providerの必要Effect Capability、各Eligibility軸の実観測、検証済みDocker Effect executor、durable Recovery adapter、Codex Adapter、実Provider E2E、独立レビュー／監査およびPRである。

現在、人間による追加判断は必要ない。保護対象の採用、統合、Releaseまたはリスク受容は行わない。
