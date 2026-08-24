# 変更トレース: Provider非依存の委譲経路選定とSelection Grant

- 変更ID: `CHG-000042`
- 状態: `Implementation in Progress`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-24
- 対象: Coordinator Runtime 1.0の4経路Delegation Route Selection、短命Selection GrantおよびClaude Docker Adapter consumer
- 対象version: v0.18.0 Candidate
- 変更分類: `additive`（Delegation Route Selection revision 2とDelegation Selection Grant Runtime revision 1を追加。Claude Docker Runtime Adapter revision 1の未接続Selection入力をopaque Grant consumerへ接続）
- 移行要否: `migration_required: false`（発行済みproduction Selection Grantと実Provider Operationは0。候補Schemaに旧aliasまたはProvider fallbackを設けない）
- 関連正本: [`CHG-000041`](CHG-000041_Explainable_Model_Selection_And_Claude_Docker_Adapter.md)、[`19_Maintenance.md`](../../19_Maintenance.md#33-internal-typescript-runtime)

## 結論

移譲が不要ならRoute Selectionは`front_codex_only`または`front_claude_only`の`retained`結果を理由付きで返し、Selection Grant、子AgentまたはProvider Effectを発行しない。移譲が必要な場合はFront ProviderをExecutor Providerへ暗黙継承せず、Front Codex／Claude CodeとExecutor Codex／Claude Codeの4経路を一つの選定契約へ固定した。既定はFrontと反対のProviderとし、Front側Subscription枠を実作業で消費し続けないよう負荷を分散する。ただし、検証、診断、方針整合、Architecture／Security review、Gap／Impact Auditまたは結果統合の説明可能な特性からCodexを優先でき、Front CodexからCodexへの委譲も許可する。役割名だけで高コストmodel／effortへ上げない。同一Providerは説明可能な作業特性、明示制約、独立性、または反対Providerの必要Capability、Subscription認証／quota、公式配布物もしくはPolicy適格性の実測不成立がある場合だけ候補にする。適格性不明から推測fallbackせず、有料API fallbackは発行しない。

Selection Grantは候補をRuntime-owned Operation、観測済みProvider eligibility、検証済みProfile、exact model ID、subscription OAuthおよび通常速度へ結合するprocess-local opaque Capabilityである。control／use alias、壁時計／単調時計、最大30秒、一回利用へ固定し、Selection Grant単独ではProvider AuthorityまたはEffectを発行しない。production eligibility observerとProfile resolverは未接続のため、現在のproduction issuerはfail closedである。

## 着手前整合と代表例

- 変更経路: Provider-neutral Architecture、Authority、Securityおよび4つの利用経路へ及ぶ非自明なRuntime変更。Provider Home、Model Selection、Claude Adapter、後続Codex Adapter、Process Controller、QAおよびGap／Impact Auditを再開する。
- 着手前整合結果: `着手可`。Provider自身のspawnやCredential取得を許可せず、Front origin、Executor、Reviewer、AuthorityおよびOperationを別軸にする。候補選定と実行権限を分離する。
- 発火例: Front Codexの具体実装はClaudeへ、Front Claudeの具体実装はCodexへauto委譲する。Codex向きの検証／レビューはFront CodexからCodexも選べる。作業特性から選んだmodel／effort／normal候補と経路理由を表示し、検証済みProfile解決後だけSelection Grantを発行する。
- 非発火例: Front Agentだけで十分な作業は`retained`となり、Provider eligibilityがなくても子AgentやSelection Grantを作らない。明示Codex制約時にCodexが不適格、独立Reviewで対象Providerしか適格でない、反対Providerの適格性が不明、偽造management Capability、Profile family／tier差、旧／再利用aliasは別Provider選択やEffectを発火しない。
- 境界例: 反対Providerが実行前からSubscription quota不足なら、同一Provider候補を`cross_provider_subscription_quota_unavailable_before_selection`として明示する。選定後のeligibility差は無言で変更せず、replacementを完全検証できた場合だけprocess-local supersedeで旧Grantを失効する。replacement検証失敗時は旧Grantを保持してCoordinatorへ戻す。
- 判定情報不足例: Provider eligibility、Profile、Operation chain、時計、乱数、独立Review対象または明示制約を確認できない場合は固定blockedとする。

## Security invariant

- route requestはFront、明示制約、Review対象、役割、work class、plan state、risk、difficulty、decision impact、復旧範囲、未決方針、cross-context、Operation chainおよび深度のexact keyだけを受理する。
- ancestor Operationは重複、自己参照、親不一致および最大深度2を拒否する。Provider同士の直接spawnは全経路で禁止する。
- 独立Reviewerは対象Providerと`requiresIndependentProvider: true`を必須にし、対象Providerを候補から除外する。
- ユーザーの明示Executor制約は候補集合を狭めるだけで、利用不能時に無言で別Providerへ変更しない。
- Provider eligibilityはproductionでRuntime-owned observerから取得し、必要Capability、Subscription認証／quota、公式配布物およびPolicy適格性を区別する。caller claimをAuthorityへ昇格させず、現在は未接続で発行前に停止する。
- resolved ProfileはExecutor Provider、Profile ID、model family／tier、exact model ID、通常速度および`subscription_oauth`をSelection結果へ完全一致させる。
- GrantはOperation management Capabilityへ結合したprocess-local `Map`／`WeakMap`で所有し、control／useを分離する。期限切れ、clock rollback、乱数衝突、別Operation、再利用またはrestart後はfail closedにする。
- Claude Docker AdapterはGrant use aliasを一回消費し、Operation、Claude、Mount Grant Profile、model、effort、tier、通常速度および選定理由を再照合する。不一致時はactive mount leaseを完了しDocker Effectを発行しない。

## 現在の検証結果と残件

- 基準Node.js v24.19.0でstrict source／test typecheckと対象contract test 36／36を確認した。Selection Grantのopaque use aliasをClaude Adapterへ接続するcomponent integrationを含む。
- 4経路、cross-provider既定、明示制約、必要Capability／Subscription quota不成立時だけの同一Provider、適格性不明時の停止、独立Provider、循環、深度、Operation差、Profile差、期限、clock rollback、乱数衝突、revoke、一回consumeおよびproduction偽造入口を確認した。
- 残件はproduction eligibility observer／Profile resolver、Provider Authority、Codex Adapter、Docker Process Controller、timeout／cancel／cleanup／Recovery、4経路E2E、独立レビュー／監査およびPRである。

現在、人間による追加判断は必要ない。保護対象の採用、統合、Releaseまたはリスク受容は行わない。
