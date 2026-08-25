<a id="forward-compatibility"></a>

# 将来互換性（Forward Compatibility）

Version: v0.18.0
Status: Candidate
Released Baseline: v0.17.0
Owner: Qual-Lab
Last Updated: 2026-08-25
Related:
- [01_Principles.md](01_Principles.md)
- [05_Autonomous_Operation.md](05_Autonomous_Operation.md)
- [06_Autonomous_Operation_Responsibility.md](06_Autonomous_Operation_Responsibility.md)
- [07_Autonomous_Operation_Safety.md](07_Autonomous_Operation_Safety.md)
- [18_Context_Dependency.md](18_Context_Dependency.md)

> 本書はRepository Identity、Context Reference、来歴および決定権限を現在の物理実装へ固定しないための非規範Architecture Candidateである。将来の規範化候補を評価できる正本資料だが、現在の規範要件ではない。将来能力を表現できることから、その能力の有効化、アクセスまたは許可を推定しない。

---

## 1. 目的

本候補は、一つのCRDD Repositoryを基本的なコンテキスト境界として、再評価、候補形成、許可範囲内の実行、検証、学びを行う。

将来、複数Repositoryやより広い業務範囲へ接続するとしても、本候補でその能力を先行実装しない。一方、本候補の実行Identity、参照、由来、決定権限を物理Locationや現在の実行主体へ固定し、将来Core Contractの全面変更が必要になる状態も避ける。

中心原則は次のとおりである。

> **未来のCapabilityは追加しない。未来の拡張点だけを閉じない。**

Forward Compatibilityは、現在のScope、アクセス、操作または決定権限を拡大する理由ではない。

---

## 2. 本候補で確保する四つの接続点

### 2.1. Repository Identity

Repository Identityは、URL、Directory名、Git Remote、Hosting Provider等の物理Locationそのものへ固定しない。論理的な正本境界と、その内容を保持する物理実体も区別する。

```text
Logical Repository Identity
  正本Context、Decision Authority、Lifecycleを持つ論理単位

Repository Instance Identity
  clone、mirror、worktree、cache等の物理実体
```

複数Instanceが同じLogical Repositoryを指していても、各Instanceが同じアクセス権、書込権、Promotion AuthorityまたはCurrent Stateを持つとは限らない。内容が同じであること、同じremoteを参照すること、または物理的に複製されたことだけからLogical Identityを決めない。

本候補では`Current Logical Repository = Current Context Boundary`を基本としてよい。Cross-Repository Operationは行わない。ただし、Execution Identity、重複抑止、Current State解決でLogical Repositoryと実行に使用したInstanceを再識別できるようにする。

固定Schemaや全Repositoryへの新しい識別子ファイルは要求しない。対象リスクに応じて、既存のRepository設定、採用記録、Runtime設定または同等の根拠から再構成できればよい。

> **CRDDはIdentity判定の共通不変条件を定め、各採用先はその条件内でLogical Repository IdentityとRepository Instance Identityの関係を決定する。**

CRDD共通の不変条件は次のとおりである。

- 物理的な複製関係だけから同一または別Identityを自動推定しない。
- Logical Identity、Canonical State、Authority、RevisionおよびLifecycleを明示的に解決する。
- AI、Runtime、ToolまたはInstance自身がIdentity Policyを自己確定しない。
- IdentityまたはCanonical Instanceを判定できない場合は、対象Effectを停止する。

採用側のIdentity Policyは、既存のRepository設定、組織Policyまたは採用記録から取得できればよく、新しい専用成果物を要求しない。少なくとも必要に応じて次を決める。

- Canonical RepositoryまたはCanonical Instance
- clone、mirror、worktree等を同じLogical RepositoryのInstanceとする条件
- forkを独立したLogical Repositoryとする境界と由来
- Identityの付与、移管、衝突、再利用禁止を決める決定権限
- 別名、失効、廃止後の追跡
- 判定不能時の停止と再評価条件

安全側の既定例は次のとおりである。これはGit製品または固定運用の要求ではない。

| 物理的な関係 | Logical Identityの安全側候補 |
|---|---|
| clone／worktree | 同一候補。ただしorigin相当、対象Revision、Identity Policyを確認する |
| read-only mirror | 同一候補。ただし正本、更新方向、Authorityを確認し、mirrorからのCanonical Effectを推定しない |
| AuthorityまたはCanonical Stateの移管を伴うmirror | 明示的なIdentity移管判断を必要とする |
| fork | 原則として別Identityとし、元Repositoryとの関係はProvenanceで保持する |
| コピー元またはLifecycleが不明 | 判定不能として対象Effectを停止する |

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

本候補のResolverはLocal Fileだけを返してよい。MCP、Remote Storeまたは別Repositoryを解決できる表現があっても、その接続が有効または許可済みであることを意味しない。

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
- 統合元となったExecutor、Reviewer、ProviderまたはRunのResultとVerification
- 結果間の競合、重複、除外または失効の理由
- 現在の判断集合、AIによる再処置、報告、後続追跡または停止・移送への接続

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

Actorの種別を将来拡張可能に表現できても、現在AIへ新しいAuthorityを与えることを意味しない。本候補では、Product／Design Direction、Canonical Context変更、Risk Acceptance、External Publication、Production、Financial Action、Legal／Consent、Authority変更、Security Boundary変更、CRDD Core変更等の既存Human Gateを維持する。

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

ProviderまたはModelはExecution Provenanceの一部になり得るが、Repository Identity、Context Identity、Authorityまたは成果物の意味そのものではない。Providerを変更できることから、そのProviderへのアクセス、送信、実行またはReview独立性を推定しない。安全なRoutingの責務は[エージェント組織の実行アーキテクチャ](04_Agent_Organization.md#12-execution-architecture)に置く。

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

## 5. 本候補で先行実装しないCapability

Forward Compatibilityを理由として、本候補へ次を追加しない。

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

本候補のReference Implementationでは、将来Capabilityを実装する代わりに、現在の契約が次を満たすか確認する。

1. 同じLogical Repositoryのcloneまたはworktreeを別Instanceとして識別しつつ、同じ論理対象へ接続できる。
2. 安定コンテキストID等を付与したContextファイルを移動しても、同じ対象として解決できる。
3. Operation Resultから、Execution Identity、対象Revision、使用Context、Evidenceを再構成できる。
4. 古いRevisionのResultまたはCandidateを現在状態へPromoteしようとすると停止する。
5. 表現可能だが有効化されていないCross-Repository ReferenceをRuntimeが読み取らない。
6. AgentをAuthority候補として表現しても、対象ScopeのGrantがなければEffectを実行できない。
7. AuthorityのScope、期間、Policyまたは付与主体が変わった場合、過去のGrantを流用しない。
8. read-only mirrorを同じLogical Repositoryとして表現しても、そこからCanonical Effectを推定しない。
9. forkを原則として別Logical Identityとし、元Repositoryとの由来をProvenanceで保持できる。
10. mirror、rename、移管等でLogical IdentityまたはCanonical Instanceが曖昧なら推測せず停止する。

合格は固定Schemaの採用ではなく、IdentityとLocation、ReferenceとAccess、Authority RequirementとGrant、CandidateとPromotionを混同しないことで判定する。

---

## 7. 将来の発展方向

将来候補には、Repository Sovereigntyを維持した連携、より広い業務コンテキストへの接続、運用結果からの組織・方法改善候補がある。これらのVersion、Scope、Authority、移行、安全性は、それぞれ独立した提案と人間判断で決める。

本書は将来Versionの番号、実装順序または採用を確約しない。

---

## 8. 結論

本候補で先に確保するのは、将来機能ではなく次の意味上の接続点である。

```text
Repository Identity
Context Reference
Provenance
Authority Requirement / Grant / Authorized Actor
```

これにより、本候補はSingle Repository Autonomous Operationという現在の責務を維持しながら、将来の拡張時にIdentity、Reference、Provenance、Authorityを全面的に作り直す危険を減らす。
