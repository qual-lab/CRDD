# CRDD v2候補 — Forward Compatibility

Status: Concept / Future Candidate  
Target: CRDD v2.x Candidate  
Related: [v2構想](01_CRDD_v2_Concept.md), [責務境界](02_CRDD_v2_Responsibility_Boundary.md), [Activation ProfileとReference Implementation](03_CRDD_v2_PoC_Plan.md), [自律安全Architecture](04_CRDD_v2_Autonomous_Safety_Architecture.md), [Operation HealthとHuman Interface](05_CRDD_v2_Operation_Health_and_Human_Interface.md)

> 本書は非規範の将来互換Architecture候補である。現在のCRDD v0.17.0、安定コンテキストID、Human Authority、External Information Boundary、準拠基準または採用側のRepository構成を変更しない。ここで表現できる将来能力は、独立した採用・検証・人間判断を経るまで有効化または許可されない。

---

## 1. 目的

v2候補は、一つのCRDD Repositoryを基本的なコンテキスト境界として、再評価、候補形成、許可範囲内の実行、検証、学びを行う。

将来、複数Repositoryやより広い業務範囲へ接続するとしても、v2でその能力を先行実装しない。一方、v2の実行Identity、参照、由来、決定権限を物理Locationや現在の実行主体へ固定し、将来Core Contractの全面変更が必要になる状態も避ける。

中心原則は次のとおりである。

> **未来のCapabilityは追加しない。未来の拡張点だけを閉じない。**

Forward Compatibilityは、現在のScope、アクセス、操作または決定権限を拡大する理由ではない。

---

## 2. v2で確保する四つの接続点

### 2.1. Repository Identity

Repository Identityは、URL、Directory名、Git Remote、Hosting Provider等の物理Locationそのものへ固定しない。

```text
Repository Identity
  ↓ resolved by
Repository Location
```

v2では`Current Repository = Current Context Boundary`を基本としてよい。Cross-Repository Operationは行わない。ただし、Execution Identity、重複抑止、Current State解決で同じRepositoryを再識別できるようにする。

固定Schemaや全Repositoryへの新しい識別子ファイルは要求しない。対象リスクに応じて、既存のRepository設定、採用記録、Runtime設定または同等の根拠から再構成できればよい。

Identityを明示的に管理する場合は、少なくとも次を曖昧にしない。

- 付与または採用する決定権限
- 衝突と再利用の禁止
- rename、移管、mirror、fork、cloneの同一性
- 別名、失効、廃止後の追跡
- 判定不能時の停止と再評価条件

### 2.2. Context Reference

Context ReferenceはLocal File PathだけをIdentityとしない。安定した再識別が必要な対象では、CRDDが既に持つ安定コンテキストIDまたは同等のContext Identityを利用し、概念的には次から対象を解決できるようにする。

```text
Context Reference
= Repository Identity
+ Stable Context ID / equivalent Context Identity
+ Revision / Baseline
```

次の三つを分離する。

```text
Context Identity
  何を指すか

Locator
  現在どこにあるか

Resolver
  IdentityからLocationをどう解決するか
```

v2のResolverはLocal Fileだけを返してよい。MCP、Remote Storeまたは別Repositoryを解決できる表現があっても、その接続が有効または許可済みであることを意味しない。

RevisionまたはBaselineが不変対象を指すのか、Current Stateへ解決する可変参照なのかを区別する。古いRevision、移動後に解決不能な参照、競合するIdentityを推測で現在状態へ丸めない。

### 2.3. Provenance

Operation Result、Evidence、Decision、Learning等は、どの実行とコンテキストから導かれ、どの対象Revisionについて有効かを必要な粒度で再構成できるようにする。

```text
Result
├ produced by: Execution Identity
├ derived from: Context Reference
├ supported by: Evidence Reference
├ based on: Decision / Baseline
└ valid for: Target Revision
```

固定Property、固定Schemaまたは全項目の常時記録を要求しない。対象リスクと結果の利用目的に応じて、次を識別できることが重要である。

- 情報源となったRepository、Context、RevisionまたはBaseline
- 導出関係と採用した判断
- 利用不能、対象外または未評価だったコンテキスト
- 結果の有効範囲、失効条件、現在状態への採否

Provenanceを保持していても、情報源の決定権限、アクセス権または結果の採用権限を取得しない。

### 2.4. Authority Abstraction

Authorityは、単に`Human`または`AI`という実行主体の種別へ固定しない。次の三つを分離して表現できるようにする。

```text
Authority Requirement
  何の決定権限または操作権限が必要か

Authority Grant
  誰が、どの対象・操作・期間・Policyについて付与したか

Authorized Actor
  今回その権限を行使できる認証済み主体
```

役割名だけではAuthority Grantにならない。対象リスクに応じて、対象範囲、許可する判断・操作、対象Revision、期間または失効条件、付与主体、委譲可否、必要なHuman Gateを取得可能にする。

Actorの種別を将来拡張可能に表現できても、現在AIへ新しいAuthorityを与えることを意味しない。v2では、Product／Design Direction、Canonical Context変更、Risk Acceptance、External Publication、Production、Financial Action、Legal／Consent、Authority変更、Security Boundary変更、CRDD Core変更等の既存Human Gateを維持する。

---

## 3. 表現、利用、決定権限の分離

Forward Compatibilityでは次を同一視しない。

```text
Representable
≠ Enabled
≠ Accessible
≠ Authorized
≠ Promoted
```

| 状態 | 意味 |
|---|---|
| Representable | Contract上で対象や能力を表現できる |
| Enabled | Activation ProfileとRuntimeで利用可能になっている |
| Accessible | 対象ContextまたはToolへ実際にアクセスできる |
| Authorized | 対象の判断または操作を行うAuthority Grantが成立している |
| Promoted | 検証済み候補がCurrent／Canonical Stateへ正式に反映されている |

前段の成立から後段を推定しない。未知のIdentity、Reference、Authority型または拡張情報をRuntimeが理解できない場合、それを無視してEffectを許可せず、対象EffectについてFail Closedとする。未知情報を保持して後続へ渡すことと、その意味に基づいて操作することも分ける。

---

## 4. Repository Sovereignty

将来Repository間を接続しても、各Repositoryの次の境界を無条件に統合しない。

- Context BoundaryとCanonical State
- Property Authorityと採用済みPolicy
- Information ClassificationとExternal Information Boundary
- Release、Baseline、RecoveryのLifecycle
- Provenanceと監査可能性

別RepositoryのReferenceまたはResultを取得できることから、その内容の採用、上書き、再公開または別RepositoryへのEffectを許可しない。

---

## 5. v2で先行実装しないCapability

Forward Compatibilityを理由として、v2へ次を追加しない。

- Cross-Repository Contextの自律読取または自律実行
- Repository間の変更自動伝播
- 全Repositoryを一つの正本へ統合するGlobal Knowledge Repository
- 複数Repository間のAuthority自動委譲
- Agent自身による役割、Authorityまたは組織構造の再編
- Product範囲を越えたBusiness全体への自動拡張
- CRDD自身のSemantic Contract、安全境界または成功条件の自動変更

CRDD自身の改善候補は、`Observe → Analyze → Propose → Human / Authority Decision → Adopt`の境界を維持する。自己改善候補の発見と自己変更を混同しない。

---

## 6. 将来互換性の確認候補

v2のReference Implementationでは、将来Capabilityを実装する代わりに、現在の契約が次を満たすか確認する。

1. RepositoryのDirectory名またはLocationが変わっても、同じ対象として再識別できる。
2. 安定コンテキストID等を付与したContextファイルを移動しても、同じ対象として解決できる。
3. Operation Resultから、Execution Identity、対象Revision、使用Context、Evidenceを再構成できる。
4. 古いRevisionのResultまたはCandidateを現在状態へPromoteしようとすると停止する。
5. 表現可能だが有効化されていないCross-Repository ReferenceをRuntimeが読み取らない。
6. AgentをAuthority候補として表現しても、対象ScopeのGrantがなければEffectを実行できない。
7. AuthorityのScope、期間、Policyまたは付与主体が変わった場合、過去のGrantを流用しない。
8. fork、mirror、rename等でRepository同一性が曖昧なら推測せず停止する。

合格は固定Schemaの採用ではなく、IdentityとLocation、ReferenceとAccess、Authority RequirementとGrant、CandidateとPromotionを混同しないことで判定する。

---

## 7. 将来の発展方向

将来候補には、Repository Sovereigntyを維持した連携、より広い業務コンテキストへの接続、運用結果からの組織・方法改善候補がある。これらのVersion、Scope、Authority、移行、安全性は、それぞれ独立した提案と人間判断で決める。

本書は将来Versionの番号、実装順序または採用を確約しない。

---

## 8. 結論

v2で先に確保するのは、将来機能ではなく次の意味上の接続点である。

```text
Repository Identity
Context Reference
Provenance
Authority Requirement / Grant / Authorized Actor
```

これにより、v2はSingle Repository Autonomous Operationという現在の責務を維持しながら、将来の拡張時にIdentity、Reference、Provenance、Authorityを全面的に作り直す危険を減らす。
