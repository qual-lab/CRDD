# 変更トレース: Runtime Provider適格性観測

- 変更ID: `CHG-000046`
- 状態: `Implementation in Progress`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-25
- 対象: Codex／Claudeの実行前Provider適格性をRuntime自身が判定する観測器とSelection Grant接続
- 対象version: v0.18.0 Candidate
- 変更分類: `additive`（Provider Eligibility Runtime revision 1を追加し、既存Selection Grant production入口へ接続）
- 移行要否: `migration_required: false`（発行済みproduction Selection Grantと実Provider Operationは0。永続成果物、Schemaまたは外部APIを変更しない）
- 関連正本: [`CHG-000042`](CHG-000042_Provider_Neutral_Delegation_Selection_Grant.md)、[`CHG-000044`](CHG-000044_Runtime_Provider_Authority_Capability.md)、[`19_Maintenance.md`](../../19_Maintenance.md#33-internal-typescript-runtime)

## 結論

Provider適格性観測器（Provider Eligibility Observer）はCodexとClaudeについて、必要Capability、Subscription認証、Subscription quota、公式配布物およびPolicyの5軸をRuntime所有の観測だけから判定する。全軸を確認できたProviderだけを`eligible: ready`とし、明示的な不成立は軸固有の理由へ、不明、取得不能または不正な観測は`observation_unavailable`へ閉じる。

callerが渡す適格性申告は受理しない。不明状態を反対Providerの不成立と推定して同一Providerへfallbackせず、API key、従量API、追加Creditまたは有料API fallbackを選択肢に含めない。現在は両Providerとも検証済みEffect Capabilityが未接続であるため、production観測は`required_capability_unavailable`を返し、Selection Grant発行を止める。

## 代表例と境界

- 発火例: Runtimeが対象Providerの5軸を全て`confirmed`として観測した場合だけ、経路選定へ`eligible: ready`を渡す。
- 非発火例: Subscription quotaまたは公式配布物が明示的に不成立なら、対応する不適格理由を返し、そのProviderを候補にしない。
- 境界例: 反対Providerの明示的不成立は既存契約が許す同一Provider候補の根拠にできるが、`unknown`または観測不能は推測fallbackの根拠にしない。
- 判定情報不足例: accessor、Proxy、余分なkey、不明状態、observer例外または閉集合外の値は、入力コードを実行せず`observation_unavailable`へ閉じる。

## Security invariant

- 観測対象Providerは`codex`と`claude`の固定2件とし、順序、重複またはcaller指定で対象集合を変えない。
- 適格性はAuthorityやProvider自身の自己申告ではなく、Runtime-owned observerの結果に限る。
- 明示的な不成立理由を優先して返すが、全軸確認なしに`eligible`へ昇格しない。
- `observation_unavailable`は同一Provider fallback理由の閉集合へ含めない。
- Provider適格性だけではSelection Grant、Provider AuthorityまたはEffectを発行しない。

## 現在の検証結果と残件

Provider Eligibility Runtime revision 1とSelection Grant production接続を実装した。基準Node.js v24.19.0で対象45試験、Coordinator全527試験、strict source／test typecheck、Biome lint／formatおよびRepository全体Checkerを通過した。対象coverageではProvider Eligibility Runtimeのline、branch、functionが全て100%であり、CheckerはMarkdown 379件、local link 2143件、anchor 588件を確認してerror 0／warning 0である。

残件は各軸の実Provider観測接続、有効化済みAuthority source loader、Codex Adapter、実Provider E2E、独立レビュー／監査およびPRである。production Profile resolverは`CHG-000047`、durable Recovery adapterは`CHG-000048`、固定Docker Effect executorは`CHG-000049`で接続済みである。

現在、人間による追加判断は必要ない。保護対象の採用、統合、Releaseまたはリスク受容は行わない。
