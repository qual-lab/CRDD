# 変更トレース: Provider非依存の委譲経路選定とSelection Grant

- 変更ID: `CHG-000042`
- 状態: `Implementation in Progress`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-24
- 対象: Coordinator Runtime 1.0の4経路Delegation Route Selection、短命Selection GrantおよびClaude Docker Adapter consumer
- 対象version: v0.18.0 Candidate
- 変更分類: `additive`（Delegation Route Selection revision 1とDelegation Selection Grant Runtime revision 1を追加。Claude Docker Runtime Adapter revision 1の未接続Selection入力をopaque Grant consumerへ接続）
- 移行要否: `migration_required: false`（発行済みproduction Selection Grantと実Provider Operationは0。候補Schemaに旧aliasまたはProvider fallbackを設けない）
- 関連正本: [`CHG-000041`](CHG-000041_Explainable_Model_Selection_And_Claude_Docker_Adapter.md)、[`19_Maintenance.md`](../../19_Maintenance.md#33-internal-typescript-runtime)

## 結論

Front ProviderをExecutor Providerへ暗黙継承せず、Front Codex／Claude CodeとExecutor Codex／Claude Codeの4経路を一つの選定契約へ固定した。具体化済み実装はClaude、検証・診断・方針整合・レビュー・統合はCodexを既定候補とする。これはProvider品質の普遍的優劣ではなくRuntime 1.0の役割別初期policyであり、実行前のavailability、独立性、明示Executor制約および高コストGateで絞る。

Selection Grantは候補をRuntime-owned Operation、観測済みavailability、検証済みProfile、exact model ID、subscription OAuthおよび通常速度へ結合するprocess-local opaque Capabilityである。control／use alias、壁時計／単調時計、最大30秒、一回利用へ固定し、Selection Grant単独ではProvider AuthorityまたはEffectを発行しない。production availability observerとProfile resolverは未接続のため、現在のproduction issuerはfail closedである。

## 着手前整合と代表例

- 変更経路: Provider-neutral Architecture、Authority、Securityおよび4つの利用経路へ及ぶ非自明なRuntime変更。Provider Home、Model Selection、Claude Adapter、後続Codex Adapter、Process Controller、QAおよびGap／Impact Auditを再開する。
- 着手前整合結果: `着手可`。Provider自身のspawnやCredential取得を許可せず、Front origin、Executor、Reviewer、AuthorityおよびOperationを別軸にする。候補選定と実行権限を分離する。
- 発火例: Front Codexから具体化済みの低難度Local Candidate実装をauto委譲するとClaude／low／normal候補、Front ClaudeからClaude成果の独立Security reviewを委譲するとCodex候補を理由付きで表示する。検証済みProfile解決後だけSelection Grantを発行する。
- 非発火例: 明示Codex制約時にCodexが利用不能、独立Reviewで対象Providerしか利用不能、偽造management Capability、Profile family／tier差、旧／再利用aliasは別Provider選択やEffectを発火しない。
- 境界例: auto選定時に既定Providerが実行前から利用不能なら、観測済み代替候補を`preferred_provider_unavailable_before_selection`として明示する。選定後のavailability差は無言で変更せず、replacementを完全検証できた場合だけprocess-local supersedeで旧Grantを失効する。replacement検証失敗時は旧Grantを保持してCoordinatorへ戻す。
- 判定情報不足例: availability、Profile、Operation chain、時計、乱数、独立Review対象または明示制約を確認できない場合は固定blockedとする。

## Security invariant

- route requestはFront、明示制約、Review対象、役割、work class、plan state、risk、difficulty、decision impact、復旧範囲、未決方針、cross-context、Operation chainおよび深度のexact keyだけを受理する。
- ancestor Operationは重複、自己参照、親不一致および最大深度2を拒否する。Provider同士の直接spawnは全経路で禁止する。
- 独立Reviewerは対象Providerと`requiresIndependentProvider: true`を必須にし、対象Providerを候補から除外する。
- ユーザーの明示Executor制約は候補集合を狭めるだけで、利用不能時に無言で別Providerへ変更しない。
- availabilityはproductionでRuntime-owned observerから取得し、caller claimをAuthorityへ昇格させない。現在は未接続で発行前に停止する。
- resolved ProfileはExecutor Provider、Profile ID、model family／tier、exact model ID、通常速度および`subscription_oauth`をSelection結果へ完全一致させる。
- GrantはOperation management Capabilityへ結合したprocess-local `Map`／`WeakMap`で所有し、control／useを分離する。期限切れ、clock rollback、乱数衝突、別Operation、再利用またはrestart後はfail closedにする。
- Claude Docker AdapterはGrant use aliasを一回消費し、Operation、Claude、Mount Grant Profile、model、effort、tier、通常速度および選定理由を再照合する。不一致時はactive mount leaseを完了しDocker Effectを発行しない。

## 現在の検証結果と残件

- 基準Node.js v24.19.0でstrict source／test typecheckと対象contract test 32／32を確認した。Selection Grantのopaque use aliasをClaude Adapterへ接続するcomponent integrationを含む。
- 4経路、明示制約、選定前availability差、独立Provider、循環、深度、Operation差、Profile差、期限、clock rollback、乱数衝突、revoke、一回consumeおよびproduction偽造入口を確認した。
- 残件はproduction availability observer／Profile resolver、Provider Authority、Codex Adapter、Docker Process Controller、timeout／cancel／cleanup／Recovery、4経路E2E、独立レビュー／監査およびPRである。

現在、人間による追加判断は必要ない。保護対象の採用、統合、Releaseまたはリスク受容は行わない。
