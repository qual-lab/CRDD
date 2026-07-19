# CRDD Behavior Specification

Version: v0.4.1
Status: Stable
Owner: Qual-Lab
Skill ID: `skill.spec.behavior`
Last Updated: 2026-07-19
Related:
- [00_01_Principles.md](00_01_Principles.md)
- [00_02_Terminology.md](00_02_Terminology.md)
- [00_03_Documentation.md](00_03_Documentation.md)
- [00_10_Agent.md](00_10_Agent.md)
- [00_11_Skill.md](00_11_Skill.md)
- [00_23_IA.md](00_23_IA.md)
- [00_24_UI_Behavior_Specification.md](00_24_UI_Behavior_Specification.md)
- [00_25_UI.md](00_25_UI.md)
- [00_27_Architecture.md](00_27_Architecture.md)
- [00_29_Verification.md](00_29_Verification.md)
- [00_51_Document_Audit.md](00_51_Document_Audit.md)
- [00_52_Conformance_Audit.md](00_52_Conformance_Audit.md)

---

# 1. Purpose and Boundary

Behavior Specificationは、Requirement、UX / IA Intent、Feature、Use Case、User Action、Business Ruleを、検証可能なCondition、State、System Behavior、Result、Exception、Acceptanceへ変換する工程である。

```text
どの条件で
誰または何が、どのAuthorityにより
どの状態から何を行い
何が変わり、何が返り
失敗、競合、取消、回復時にどうなり
何をもって成立と判断するか
```

Behavior SpecificationはRequirement、UX Outcome、UI表現、Architecture方式、Codeの代替ではない。UXやDesign IntentをEARSへ機械変換したり、現行実装を正しい仕様として採用したり、AIがBusiness Ruleを創作したりしない。

---

# Phase Process Contract

本章はBehavior Specification工程の入口、変換、責務Coverage、出口、Phase Gate、Auditの正本である。後続章は本ContractをArtifact構造とSkill実行へ具体化し、独自の完了条件を持たない。Artifactの統合・分割・配置は[`00_03_Documentation.md`](00_03_Documentation.md)に従う。

## Phase Entry Contract

Behavior Specificationは対象Scopeについて、次を受け取る。

- Source REQ / UX / IA、Preserved Intent、Non-goal
- Feature / Use Case / User Action、Pairing Unit Candidate
- Actor / Authority、IA Object / Relation / Lifecycle / State Concept
- Configuration Candidate / Model、Owner / Authority、適用Scope、Inheritance / Override
- Behavior Obligation、Business RuleまたはそのAuthority
- 対応UI Contract Candidate、Consumer / Operational Feedback Candidate
- Quality、Compatibility、Capacity、Privacy、Cost等のConstraint
- IA Coverage Summary、Unresolved Gap、Human Review Result
- Existing Behavior / Code / Documentと、そのAuthority / Revision

通常は[IAのExit and Handoff](00_23_IA.md#exit-and-handoff)から受け取り、UIと並行・反復して具体化する。Source Requirement、Behavior Obligation、Actor / Authority、対象Scope、人間Reviewが不足する場合はDiscovery、IA、Human Decisionへ戻す。IAが`Partial — Human Authorized`の場合は、承認されたScopeだけを扱い、未網羅項目、Risk、後続Ownerを引き継ぐ。

## Transformation Contract

Behavior ObligationとConfiguration Candidateを、Actor / Authority、Trigger、Precondition、Input / Validation、Option / Default / Effective Value、State、Behavior、Output / State Transition、Failure / Exception、Permission、Idempotency、Cancel / Undo / Retry、External Dependency、Consumer Compatibility、Capacity / Quality Behavior、Acceptance Criteriaへ変換する。

SPECはConsumerまたは利用者から観測可能な契約を定義し、Component構成、Server台数、Queue Size、Autoscaling、DB Connection、Cache、Provider選択等の成立方式を決めない。

## Required Responsibility Coverage

対象Scopeの各REQ、Use Case、User Action、Behavior Obligationについて、次を網羅する。

| Responsibility | Required Context |
|---|---|
| Source and Scope | Source REQ / UX / IA、Purpose、Preserved Intent、Non-goal、Revision、Relation |
| Actor and Entry | Actor / Authority、Trigger、Precondition、Feature Flag、Input / Validation |
| State and Success | Current State、Behavior、Output、State Transition、Side Effect、Success Condition |
| Failure and Recovery | Validation、Permission、Conflict、Timeout、Dependency Failure、Fallback、Retry、Recovery |
| Integrity and Control | Idempotency、Concurrency、Duplicate、Cancel、Undo、Rollback / Compensation、Audit |
| External Dependency | Consumer、Provider、Unavailable / Partial / Degraded Behavior、Observable Result |
| Compatibility | Consumer Contract、Version、Breaking / Non-breaking、Deprecation、Migration-period Behavior |
| Capacity and Quality | Response / Completion Condition、Rate Limit、Queue / Reject / Throttle / Degrade、Quality Condition |
| AI / Data / External Action | Consent State、Input Scope、Inference / Provenance、Human Approval、Privacy / Retention、Cost Guardrail、Action Limit |
| Configuration and Policy | Allowed Option / Range、Default Source、Effective Value、Scope、Inheritance / Override、Permission、Validation、Apply Timing、Side Effect、Reset / Rollback、Failure / Recovery、Audit |
| Acceptance and Trace | Acceptance Criteria、Environment / Variant、Test / Evidence Candidate、UI / Consumer Pair、Coverage / Unresolved Gap |

すべての責務を全Behaviorへ機械的に記載する必要はない。適用しない責務は`Not Applicable`として理由と人間確認を残す。

## Scope and Coverage State

各REQ / Use Case / User Action / Behavior Obligationと各SPEC責務を、`Complete for Scope`、`Partial — Human Authorized`、`Blocked`、`Not Started`、`Not Applicable`で追跡する。

一つのHappy Path、EARS文、State Diagram、API定義、既存Code、または対応UIの完成を、対象Scope全体のBehavior Specification完了と表現してはならない。

## Human Decisions

人間はBusiness Rule、Actor / Authority、Permission、ConfigurationのDefault / Policy / Override、Risk Acceptance、不可逆処理、Fallback、Compatibility破壊、Cost / Quality Trade-off、`Not Applicable`、部分Handoffを決定する。AIは候補、Gap、Conflict、Acceptance案を提示できるが、未決Rule、Default、Policy、Authorityを推測で確定しない。

## Exit and Handoff

UIとBehavior Specificationは並行・反復して具体化してよい。UIからBehavior Gapを、SPECからFeedback / Recovery Gapを発見できるが、片側の進捗を他方またはPair Reviewの完了とみなさない。

通常のArchitecture Handoffは、対象Scopeが`Complete for Scope`で、人間Reviewを通過し、UIがあるScopeでは[Pair Review](00_24_UI_Behavior_Specification.md#26-exit-and-pair-gate)を完了し、検証可能なAcceptanceを持ち、[Architecture Phase Entry Contract](00_27_Architecture.md#phase-entry-contract)を満たす場合に限る。

直接UIがない場合は、Consumer ContractまたはOperational Feedbackとの対応と、[Pair例外](00_24_UI_Behavior_Specification.md#52-behavior-without-direct-ui)の人間確認を示す。部分Handoffには、対象Scope、未定義Behavior / Exception / Acceptance、Pair Gap、Risk、受信先、後続Ownerの人間承認を必要とする。

## Phase Gate Criteria

- Source REQ / UX / IA、対象Use Case / User ActionへTraceできる
- 全Behavior ObligationとRequired Responsibility Coverageを対象Scopeで判定している
- Actor / Authority、Trigger、Precondition、State、Behavior、Result、重要Failure / Exceptionが観察・検証可能である
- Permission、Idempotency、Cancel / Undo / Retry、Dependency、Recoveryを適用範囲で判定している
- Configuration CandidateのOption / Range、Default Source、Effective Value、Scope、Inheritance / Override、Permission、変更効果、Reset / Recoveryを定義している
- Consumer Compatibility、Capacity / Quality Behavior、Migration-period Behaviorを必要範囲で定義している
- AI / Personal Data ScopeではConsent、Inference / Provenance、External Action Authority、Privacy / Retention、Cost Guardrailが観測可能なBehaviorである
- UI ContractまたはConsumer / Operational Contractと整合している
- Acceptance CriteriaとEvidence取得方法を定義している
- Coverage Gap、`Not Applicable`、部分Handoff承認を記録している
- Architecture Phase Entry Contractを満たす

## Phase Audit Checklist

- REQ / Use Case / User Action / Behavior Obligationの未変換
- Happy Pathだけの仕様、曖昧なResult、観察不能なAcceptance
- Failure、Permission、Recovery、Idempotency、Cancel、Dependencyの適用判定漏れ
- IA Configuration Candidateに対応するOption / Range、Default、Effective Value、Permission、Apply Timing、変更効果、Reset / Recoveryの欠落
- Compatibility、Version、Deprecation、Migration-period Behavior、Capacity / Qualityの漏れ
- UI / Consumer ContractとのAction、State、Failure、Recovery、Permissionの不一致
- AI ScopeでConsentを表示だけにし、実行停止・取消・External Action Authorityを定義していない
- SPECによるUX / UI Intent、Architecture方式、Implementation Detailの先取り
- 現行CodeやObserved Behaviorの無条件な正本化、UX OutcomeのEARS化
- Source Trace、Coverage Summary、Unresolved Gap、Human Review、Decision / Rationaleの欠落
- Architectureまたは実装への暗黙Handoff

---

# 2. Behavior Specification Model

## 2.1. Behavior Unit, State, and Result

Behavior Unitは、Feature、Use Case、User Action、Event、Scheduled Action等の意味ある処理単位である。Actor / Authority、Trigger、Precondition、Current State、Input、Behavior、Output / State Transition、Success Conditionを対応づける。

State名だけを列挙せず、各StateのMeaning、Entry / Exit Condition、許可Action、観測可能なResultを説明する。UIがある場合、Presentation Stateとの対応は[`00_24_UI_Behavior_Specification.md`](00_24_UI_Behavior_Specification.md)に従う。

## 2.2. Failure, Recovery, and Integrity

重要Failureでは、発生条件、保護するData / State、利用者またはConsumerへ返すResult、入力保持、Retry / Fallback / Recovery、Log / Auditを定義する。

```text
Validation
Authentication / Authorization
Conflict / Stale
Unavailable / Timeout
External Dependency
Data Integrity
Unsupported State
Unexpected Failure
```

二重実行や並行更新があり得る場合は、Idempotency、Duplicate Result、Conflict Detection、Retry Ruleを定義する。Cancel、Undo、Rollback、Compensationを区別し、不可逆なら理由と観測可能なResultを示す。

## 2.3. Consumer Compatibility and Capacity Behavior

API、IPC、Event、Batch、Command等を外部Consumerが利用する場合、次を観測可能なContractとして定義する。

- Field、Parameter、Status、Error、EventのMeaning
- Breaking / Non-breaking Change、Version選択、Deprecated条件
- 旧Versionの利用可能期間、移行中の共存Behavior
- 廃止通知、Failure、Fallback、Recovery、対象Consumer
- 既存DataやConsumerへのAcceptance Criteria

CapacityまたはInfrastructure制約がConsumerへ見える場合は、Response / Completion Condition、同時実行やRequest量のQuality Condition、Rate Limit、Timeout、Queue / Reject / Throttle / Degrade、部分完了、Retry / Recoveryを定義する。

SPECは成立させるべき観測可能なBehaviorとAcceptanceを定義する。Topology、Autoscaling、Queue実装、Database、Cache、Provider等の方式はArchitectureへ渡す。

## 2.4. AI, Consent, Data, and External Action

AI Behaviorでは、Input Scope、Data送信、Prompt / Model Boundary、Output Status、Confidence / Uncertainty、Source / Provenance、Human Review、Fallback、Provider Failure、保存・公開・実行条件を定義する。AI出力をDecisionまたは実行結果と同一視しない。

ConsentはDialog表示ではなく実行条件である。未同意、状態不明、取消済み、期限切れ、Scope変更、保存失敗時の開始・停止・取消Behaviorを定義する。安全または法的にFail Closedが必要なScopeでは、その条件と利用者へ返すResultを明示する。

外部Actionは[`00_01_Principles.md`](00_01_Principles.md)のProgressive Autonomyを、Read、Proposal、Human-approved Execution、限定自動実行等のBehaviorへ変換する。Authority、Rate、Amount、Target、Time、Cost、Confirmation、Idempotency、Cancel、Recovery、Auditの上限を定義する。

## 2.5. Configuration and Policy Behavior

IAのConfiguration Candidateを、観測・検証可能なBehaviorへ具体化する。

```text
Allowed Option / Range / Format
Default Value and Default Source
Current / Effective Value
Applied Subject / Scope
Inheritance / Override / Precedence
Read / Change / Approve Authority
Validation / Conflict
Apply Timing / Propagation / Side Effect
Cancel / Revert / Reset / Rollback
Failure / Partial Apply / Recovery
Audit / Evidence / Acceptance
```

`Default`は単なる初期画面値ではなく、未設定時にSystemが採用するBehaviorである。個人Preference、組織Policy、System Default、Temporary Overrideが競合する場合は、Precedenceと利用者へ返すEffective Valueを定義する。変更が非同期、段階反映、不可逆、既存Dataへ影響する場合は、適用時点、対象、部分失敗、Rollback / Recoveryを明示する。

環境変数、Provider固有Parameter、Resource Size等が利用者・Consumerから観測できない成立方式だけである場合はArchitectureのTechnical Configurationへ渡す。Product Behavior、Availability、Quality、Cost、Privacyへ影響する部分はSPECの観測可能なContractとして残す。

## 2.6. EARS Usage

EARSはBehavior、Exception、Acceptance Criteriaを曖昧なく表すための任意の構文であり、すべてのSPECをEARSだけで記述する必要はない。

| Pattern | Form |
|---|---|
| Ubiquitous | `The system shall <response>.` |
| Event-driven | `When <trigger>, the system shall <response>.` |
| State-driven | `While <state>, the system shall <response>.` |
| Unwanted Behavior | `If <unwanted condition>, then the system shall <response>.` |
| Optional Feature | `Where <feature is enabled>, the system shall <response>.` |

自然言語でもConditionとResultを明確にする。UX Outcome、Experience Principle、IA Intent、Visual / Design IntentをEARSへ圧縮しない。形式構文を使ってもSource Context、Rationale、Exception、Recoveryを失わせない。

## 2.7. Acceptance Criteria and Evidence

Acceptance Criteriaは、対象Revision、Input / Condition、観察可能なResult、重要Failure、Variant / Environment、Evidence取得方法を説明できるようにする。

```text
Weak:
正しく動作すること。

Observable:
Cloud Providerが利用不可の状態でCognitionを実行した場合、
SystemはLocal Providerへ自動Fallbackせず、
利用不可状態と理由を返すこと。
```

AcceptanceはTest手順や実装方式そのものではない。VerificationがFresh Evidenceを取得できるContractを示し、実際の成立判定は[`00_29_Verification.md`](00_29_Verification.md)へ渡す。

## 2.8. Legacy, Stable Context, Evidence, and Decision

LegacyではDocumented Behavior、Implemented Behavior、Observed Runtime Behavior、Operational Practice、Expected Behavior Candidate、Recovered Intent Candidateを分離する。現行Codeや長期間の挙動を望ましい仕様と断定せず、人間確認または追加EvidenceまでCandidateとして扱う。

`SPEC-*`は複数Artifactや工程から参照し、独立Review、置換、影響追跡を必要とするCondition、State、Behavior、Exception、Acceptance等の意味単位へ付与する。文書名・Feature名・EARS文・Test名・文書番号とStable Context IDを同一視せず、一つのBehavior Specification Artifact内に複数の`SPEC-*`が存在してよい。

全Paragraph、全Acceptance、Evidence、Decision、Test、Architecture Section、実装処理へ機械的にSPEC IDを発行しない。SPECはSource `REQ-*` / `UX-*` / `IA-*`、`pairs_with UI-*`、Architecture、VerificationとRelationで接続する。

Behaviorの根拠は対象Artifact内または最も近い親Folderの`Evidence/`へ置く。Business Rule、Authority、Permission、不可逆処理、Fallback、Compatibility破壊、Risk受容の決定は、結果となるCanonical SPEC Artifactの`Decision / Rationale`へ理由、Evidence、代替、影響を残す。

---

# 3. Guided Skill Adapter

## 3.1. Runtime Authority

`skill.spec.behavior`は、Phase Process Contractを[`00_11_Skill.md`](00_11_Skill.md)のRun Lifecycle、Guided Interaction、Human Review、Handoffに従って実行するBehavior Specification固有Adapterである。本書ではRun Status、Pause / Resume、共通Question Rule、Subagent Lifecycle、Artifact Registrationを再定義しない。

開始時は、Systemがどの条件と状態でどう振る舞い、成功、失敗、再試行をどう扱うかを定義し、UX / UI Intentは保持したまま検証可能なBehaviorだけを精密化することを説明する。

## 3.2. SPEC-specific Progression

| Step | SPEC固有の変換 | Result |
|---|---|---|
| Load and Scope | REQ、IA Obligation、Pairing Unit、既存Behaviorを対応づける | SPEC Coverage Queue |
| Frame | Actor、Authority、Trigger、Precondition、Stateを定義する | Behavior Boundary |
| Specify | Behavior、Result、Transition、Failure、Recoveryを具体化する | Behavior Specification |
| Harden | Permission、Configuration / Policy、Idempotency、Dependency、Compatibility、Capacity、AI / Dataを判定する | Operational Contract |
| Accept | Acceptance、Environment、Evidence Candidateを定義する | Verification Obligation |
| Review and Handoff | Pair、Coverage、人間判断を確認する | Architecture Handoffまたは別Route |

## 3.3. SPEC-specific Question Topics

| Topic | Question Intent |
|---|---|
| Trigger / Actor | 何をきっかけに、誰がどのAuthorityで開始するか |
| Precondition / State | 開始前に何が成立し、どのStateから始まるか |
| Behavior / Result | Systemが何を行い、Data / State / Outputがどう変わるか |
| Processing | 処理中、二重実行、並行操作、進捗をどう扱うか |
| Failure / Recovery | 何を保護し、返し、保持し、再試行・回復するか |
| Cancel / Undo | 開始後の取消、完了後の復元は可能か |
| Dependency | 外部Service、Network、AI Provider停止時にどうするか |
| Configuration | 何を選べ、DefaultとEffective Valueは何で、誰がどのScopeへ変更し、いつ反映・回復するか |
| Acceptance | どのCondition、Result、Evidenceで成立とするか |

## 3.4. Adaptive Route and Escalation

| Condition | Route |
|---|---|
| Source Requirement、Business Rule、Authorityが不明 | Discovery / Human Decision |
| IA Object / Lifecycle / State Conceptが不明 | IA |
| UIとのAction / State / RecoveryがConflict | Pair Review |
| 技術方式、Boundary、Capacity Designが主題 | Architecture / Technical Spike |
| 現行BehaviorのAuthorityが不明 | Legacy Reverse / Research |
| Acceptanceを観測可能にできない | Requirement / Behaviorの再整理 |

AIへScope、Permission、Data Retention、Risk Acceptance、不可逆処理、Fallback Policy、Compatibility破壊の最終決定を要求された場合は確定しない。

Subagentを使う場合は[`00_10_Agent.md`](00_10_Agent.md)に従い、State Transition、Failure / Recovery、Compatibility、Acceptance、Pair Consistency等の限定Scopeを委譲できる。Behavior Specification、Business Rule、Pair Review、Handoffの統合と人間確認はParent Agentが行う。

---

# 4. Review, Handoff View, and Feedback

## 4.1. SPEC-specific Human Review

共通Review Contractは[`00_11_Skill.md`](00_11_Skill.md#61-human-review)に従う。SPEC Reviewでは追加で次を確認する。

- Source RequirementとPreserved IntentがBehaviorとAcceptanceへ残っている
- AIや現行CodeがBusiness Rule、Authority、Expected Behaviorを創作していない
- Happy PathだけでなくFailure、Permission、Recovery、Dependencyを判定している
- Compatibility、Capacity、AI / Consent / External ActionのRiskを隠していない
- Configuration / PolicyのDefault、Effective Value、Authority、変更効果、Reset / RecoveryをUIと対応づけている
- UI / Consumer ContractとのPair Conflictを明示している
- 対象Scope全体のCoverageと部分承認範囲を誤認なく示している

## 4.2. Behavior Specification Artifact / Handoff View

次はBehavior Specification責務をProject内で表現する標準Viewであり、独立File数を要求しない。

```text
Scope / Coverage Summary / Unresolved Gap
Source REQ / UX / IA / Pairing Unit
SPEC ID / Revision / Status
Purpose / Preserved Intent / Non-goal
Actor / Authority / Trigger / Precondition / Input
State / Behavior / Output / State Transition / Side Effect
Failure / Exception / Permission / Recovery
Idempotency / Concurrency / Cancel / Undo / Retry
External Dependency / Consumer Contract
Compatibility / Version / Migration-period Behavior
Capacity / Quality Condition
AI / Consent / Data / External Action / Cost Guardrail
Configuration / Policy / Default / Effective Value / Scope / Inheritance / Override
Acceptance Criteria / Environment / Evidence Candidate
pairs_with UI / Consumer / Operational Feedback
Decision / Rationale
Human Review Result
```

Architectureへの共同Handoff条件は[Pair Review Handoff](00_24_UI_Behavior_Specification.md#62-review-and-handoff)を正本とする。Behavior Specification側はこのViewへの参照とSPEC Coverage Stateを欠落なく渡す。

## 4.3. Feedback to Behavior Specification

UI、Architecture、実装、Verification、運用から、State、Failure、Recovery、Compatibility、Capacity、Acceptanceに関するLearningが得られた場合はSPECへ戻す。同じ意味の明確化は同じ`SPEC-*`のRevisionを更新し、意味を置換する場合は新しい`SPEC-*`を発行して`supersedes`で接続する。

実装都合や既存CodeだけでBehavior Specificationを無断変更せず、Evidenceと人間判断を結果となるSPEC Artifactへ反映し、Pair Relation、Coverage、影響するArchitecture / Verificationを再確認する。

---

# 5. Final Principle

```text
Behavior Specificationは、Happy PathやEARS文を一つ書いて終わる工程ではない。
対象Scopeの全Requirement、Use Case、Behavior Obligationについて、
条件、状態、結果、失敗、回復、AcceptanceをUI・Architecture・Verificationへ接続する。
```
