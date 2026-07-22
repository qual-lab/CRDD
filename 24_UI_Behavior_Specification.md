# CRDD UI Contract and Behavior Specification

Version: v0.5.1
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-22
Related:
- [01_Principles.md](01_Principles.md)
- [02_Terminology.md](02_Terminology.md)
- [03_Documentation.md](03_Documentation.md)
- [23_IA.md](23_IA.md)
- [25_UI.md](25_UI.md)
- [26_Behavior_Specification.md](26_Behavior_Specification.md)
- [27_Architecture.md](27_Architecture.md)
- [29_Verification.md](29_Verification.md)
- [51_Document_Audit.md](51_Document_Audit.md)
- [52_Conformance_Audit.md](52_Conformance_Audit.md)
- [53_Gap_Impact_Audit.md](53_Gap_Impact_Audit.md)

---

> この文書で分かること（非規範の案内）
>
> - UIと振る舞い仕様をなぜ並行して扱うか
> - 表示・操作とSystem Behaviorの責務をどう分けるか
> - 両方の成果物をどう対応付けるか
> - 片方だけ完成したように見える状態をどう防ぐか
> - Architectureへ渡す前に何を共同確認するか

<a id="1-purpose-and-boundary"></a>

# 1. 目的と適用範囲（Purpose and Boundary）

本書は、利用者に見えるUI ContractとSystemのBehavior Specificationが、同じProduct Intent、Feature、Use Case、User Action、Stateを矛盾なく成立させるためのPair Review Contractを定義する。

```text
UI Contract
= 利用者が何を認識し、判断し、操作し、どのFeedbackを受けるか

Behavior Specification
= どの条件と状態で処理が始まり、何が変化し、何が返り、失敗時にどう振る舞うか

Pair Review
= 両者が同じ意味を、各Property Authorityから矛盾なく表しているか
```

本書は第三の工程、第三のProperty Authority、またはUIとSPECを統合した新しいStable Contextを作らない。UI工程のEntry、Coverage、Exit、Gate、Auditは[UI](25_UI.md#phase-process-contract)、Behavior Specification工程は[Behavior Specification](26_Behavior_Specification.md#phase-process-contract)を正本とする。

---

# 2. Pair Review Contract

## 2.1. Entry Contract

Pair Reviewは対象Scopeについて、次を受け取る。

- Source REQ / UX / IAと対象Revision
- IA Configuration Candidate / Model、Owner / Authority、適用Scope、Inheritance / Override
- 適用するAccessibility Profileと代替操作Obligation
- Pairing Unit CandidateとなるFeature、Use Case、User Action、Stateful Interaction
- 対象`UI-*`と`SPEC-*`、または各工程のDraft / Candidate
- UI Coverage Summary、SPEC Coverage Summary、Unresolved Gap、人間Review Result
- Source IA Phase Transition Review Result、Reviewed Revision、または明示された`review_exception`
- IA、UI、SPECで発火したTriggered Propagation Check Result、Source Revision、または明示された`propagation_exception`
- 対象のUI Obligation、Behavior Obligation、例外候補

片側が未着手でもReviewを開始し、他方に必要なObligationを発見してよい。ただし、未存在のContractをAIが推測で補完してPair成立扱いしない。

## 2.2. Pairing Transformation

各Pairing Unitについて、UI側のAction、Presentation State、Feedback、Settings / Control、Recoveryと、SPEC側のTrigger、Precondition、System State、Result、Configuration / Policy Behavior、Failure、Recoveryを意味のあるRelationで対応づける。

```text
Source Intent / Pairing Unit
├─ UI Contract: recognition / action / presentation / feedback
└─ Behavior Specification: condition / state / behavior / result
                    ↓
             Pair Consistency Result
```

両者を同じ文体や一つのArtifactへ統合する必要はない。Property Authorityを保ったまま、不一致、欠落、例外、検証方法を明らかにする。

## 2.3. Required Pair Coverage

対象Scopeの全Pairing Unitについて、次を判定する。

| 観点 | UI Contract側 | 振る舞い仕様側 |
|---|---|---|
| Source / Purpose | 利用者のGoal、UX / IA Intent | Systemが成立させるResult、Source REQ / UX / IA |
| Action / Trigger | 利用者または外部ActorのAction | Trigger、Actor、Authority |
| Availability | Visible、Hidden、Disabled、理由 | Precondition、Permission、Feature / Dependency Availability |
| Input | 入力、選択、Format、補助 | Validation、Normalization、拒否条件 |
| Settings / Policy | Current / Effective Value、適用Scope、継承 / Overrideの説明、変更・Reset Action | Option / Range、Default Source、Precedence、Permission、Apply / Reset / Recovery Behavior |
| Processing | Loading、Progress、操作可否 | Processing State、Timeout、Concurrency、Partial Result |
| State | Presentation State、Assuranceの見せ方 | Domain / System State、State Transition |
| Success / Output | 完了Feedback、結果、次Action | Success条件、Output、永続化、Side Effect |
| Empty / Unknown | 空・未取得・結果不明の意味 | Data不存在、未確定、照会・再確認Behavior |
| Failure / Recovery | Message、保持内容、Retry / Support導線 | Failure分類、保護、Retry、Fallback、Recovery |
| Permission | 操作可否、理由、情報開示 | Authorization、禁止時Result、Audit |
| Cancel / Undo | 取消・復元ActionとFeedback | Cancellation、Rollback、Compensation、不可逆条件 |
| Duplicate / Conflict | 二重操作防止、競合表示 | Idempotency、Conflict、Stale、Duplicate Result |
| Data / Content | Source、Freshness、Masking、Label | Data Source、更新条件、Privacy、Retention、Result Meaning |
| AI / External Action | Provenance、不確実性、人間確認、Consent | Inference State、Approval、Execution Authority、Provider Failure |
| Accessible Operation | Keyboard / Focus / Semantic / Reading Order / Alternative Interaction | 入力方式に依存しないTrigger、同等のPermission / Result / Failure / Recovery、時間制限・入力保持 |
| Verification | UI Acceptance、Visual / Interaction Evidence | Behavior Acceptance、Test / Log / Result Evidence |

全ConcernをすべてのPairing Unitへ機械的に実装する必要はない。適用しないConcernは`Not Applicable`として理由と人間確認を残す。

## 2.4. Pair Coverage State

各Pairing UnitとConcernを、`Complete for Scope`、`Partial — Human Authorized`、`Blocked`、`Not Started`、`Not Applicable`で追跡する。

代表的な一画面、Happy Path、一つのAction、またはUI / SPECの片側が完成したことを、対象Scope全体のPair Review完了と表現してはならない。

UI CoverageとSPEC Coverageは別々に保持し、Pair Coverageへ合算して曖昧にしない。

## 2.5. Human Decisions

人間はPairing Unit、重要Stateの利用者向けMeaning、情報開示、不可逆Action、Recovery / Fallback、Risk Acceptance、Pair例外、`Not Applicable`、部分Handoffを決定する。

AIは対応候補、不一致、欠落、選択肢を提示できるが、Business Rule、Authority、成功・失敗の意味、片側を正しいものとして自己決定しない。

Pairに関する人間の判断、制約、学び、根拠、Findingを確定または変更した時点で、[変更影響の伝播確認](53_Gap_Impact_Audit.md#43-mandatory-propagation-trigger-and-closure)が必要かを判定する。確認が必要な場合は、IA以前のContext、UI / SPECの両側、Architecture以降へのImpactを更新・再監査するまでPairを通常完了としない。

## 2.6. Exit and Pair Gate

Pair Gateを人間へ提示する前に、次を行う。

1. 対象Pairing Unit / Revisionへ[Phase Transition Review](10_Agent.md#72-phase-transition-review-and-remediation-loop)を実行する。
2. Pair FindingをUI、Behavior Specification、または責務を持つ上流工程で修正する。
3. UIとBehavior Specificationの更新Revisionを再Reviewし、`Pass`を得る。

片側のReviewだけでPair全体を`Pass`にしてはならない。Reviewの省略または未解消Findingを伴う移行は、[Human-directed Review Exception](10_Agent.md#73-human-directed-review-exception)がある場合だけ通常Routeと区別して扱う。

Pair Reviewは次を満たした場合に、対象Scopeについて完了できる。

- 全Pairing UnitとRequired Pair Coverageを判定している
- `UI-*`と`SPEC-*`のRelation、または承認済み例外を辿れる
- Action / Trigger、State、Result、Failure、Permission、Recoveryの重要な不一致がない
- Unresolved Gap、`Not Applicable`、部分承認、Riskを記録している
- UIとSPECの各Phase Gateを独立して評価している
- Acceptanceと取得予定Evidenceが両側で対応している
- 発火したTriggered Propagation Checkが`Pass`であり、必要な正本更新と再監査が完了している

Pair Review完了だけではUI工程またはSPEC工程の完了にならない。反対に、UIまたはSPECの個別Gateは、該当するPair Reviewが未完了なら実装への通常Handoffを許可しない。

UIが存在しないBehavior、実Behaviorを持たないPrototype等は、5章の例外条件を満たす場合に限りPair例外として扱う。

## 2.7. Pair Audit Checklist

- Pairing Unitまたは対象`UI-*` / `SPEC-*`の未特定
- Actionに対応しないTrigger、または利用者へ届かない重要Behavior
- UI StateとSystem Stateの無条件な一対一化
- Settings UIとSPECのOption、Default、Effective Value、Scope、Precedence、Permission、変更効果、Reset / Recoveryの不一致
- Loading / Empty / Unknown / Failure / Permission / Conflict / Cancel / Recoveryの片側欠落
- Keyboard、Focus、Semantic、代替操作等をUIだけの表現とし、同等のTrigger、Result、Failure、RecoveryがSPEC側にない
- UIによるBusiness Rule、Authority、State Transitionの創作
- SPECによるVisual、Information Priority、利用者向け文言の創作
- AI Proposal、Human Approval、Execution、VerificationのStatus Meaning Collapse
- FigmaやPrototypeだけによるBehavior確定、EARS文だけによるUI / UX確定
- 片側の実装都合によるSource UX / IA Intentの無断変更
- Pair Coverage、Unresolved Gap、人間Review、例外理由、Verification対応の欠落
- Pair Decision、Constraint、Learning、Evidence、Findingに対する上流・同層探索、両側の正本反映、下流再探索、再監査の欠落
- PairのIndependent Review未実施、片側だけのReview、旧RevisionのReview流用、Finding未修正の持ち越し、Audit Run完了をPair Passとみなしていないか

---

# 3. Property Authority and Pairing Relation

## 3.1. Separated Authority

UIとSPECが同じConcernを扱う場合も、Property Authorityは分離する。

| 観点 | UIの決定権限 | SPECの決定権限 | Pair Reviewの焦点 |
|---|---|---|---|
| Action | 認識・操作・Feedback | Trigger・条件・Result | Actionが意図したBehaviorを開始するか |
| State | Presentation / Assurance | Domain / System State | 利用者へ正しいMeaningが伝わるか |
| Failure | Message・Recovery導線 | Failure条件・保護・回復処理 | 原因を断定しすぎず回復可能か |
| Permission | 操作可否・説明 | Authorization Rule | 開示と実行制御が一致するか |
| Settings / Policy | Current / Effective Value、Scope、変更・Reset Action、影響説明 | Option / Range、Default、Precedence、Permission、変更効果、Recovery | 利用者が実際に有効な値と変更結果を正しく理解・制御できるか |
| Cancel / Undo | 利用可能なAction | Cancellation / Rollback Rule | UIが不可能な回復を約束しないか |
| Accessible Operation | 認識可能なSemantics、Keyboard / Focus、代替Interaction | 入力方式に依存しない条件、同等Result、時間制限、入力保持 | 特定の感覚・入力方式を使えない利用者にも同じOutcomeと回復が成立するか |
| Acceptance | 利用者から観測する成立 | Systemから観測する成立 | 同じOutcomeを検証できるか |

「Shared Concern」は共同所有を意味しない。各側が自分のPropertyを正本化し、Pair ReviewがRelationと整合を検査する。

## 3.2. Pairing Unit and Cardinality

Pairing Unitは原則としてFeature、Use Case、User Action、Stateful Interactionであり、Screen名やFile名ではない。

```text
悪い対応:
Screen A.md ⇄ Screen A Spec.md

意味に基づく対応:
Topicを承認するUI Contract ⇄ Topic Approval Behavior Specification
Topicを検索するUI Contract ⇄ Topic Search Behavior Specification
```

一つのUI Actionが複数Behaviorを協調させる場合や、一つのBehaviorを複数Surfaceから利用する場合があるため、Pairは一対一に限定しない。Cardinalityと責務をRelationとして説明する。

## 3.3. Stable Context and Artifact Boundary

Pairは既存の`UI-*`と`SPEC-*`を`pairs_with`等の意味あるRelationで接続する。Pairそのもの、Pairing Matrix、Review Resultへ新しいCRDD標準Stable Context IDを発行しない。文書番号やFile名へUI / SPEC IDを埋め込まない。

Pairing MatrixはReview Viewであり、UI ContractまたはBehavior Specification本文の代替正本ではない。単純な対象では同一ArtifactへUIとSPECを併記してよいが、Property Authority、Stable Context、Revision、Coverageを区別する。

## 3.4. Conflict Resolution

不一致が見つかった場合、実装済み、詳細、作成日時が新しい等の理由だけで片側を優先しない。

```text
Source UX / IA / REQとDecisionを確認する
UI PropertyかSPEC Propertyかを確認する
不足、誤り、意味変更、上流Conflictを分類する
必要なHuman Decisionまたは上流再開を行う
正本RevisionとPair Relationを更新する
```

---

# 4. Cross-contract Concerns

## 4.1. State and Assurance Correspondence

Presentation StateとDomain / System Stateは一対一とは限らない。重要なStateでは、内部で成立していること、利用者へ伝えること、その結果を何が保証するかを分ける。

```text
Domain / System State = 内部で成立している状態
Presentation State    = 利用者へ伝える状態
Assurance State       = その結果を確認したEvidenceまたは確からしさ
```

応答喪失等で結果が不明な場合、UIは成功・失敗を推測せず、SPECはUnknownを観測・再確認・回復できるBehaviorとして扱う。

## 4.2. Action, Async, and Recovery

主要Actionでは、操作可能条件、Trigger、即時Feedback、処理中操作、二重実行、成功・失敗、Cancel / Undo、次Actionを対応づける。

ActionをHiddenまたはDisabledにする場合、機能の存在や利用不可理由を知らせる必要、代替手段、将来利用可能性と、情報開示によるSecurity RiskをUI / SPECの両側から判断する。

非同期処理では、Requested、Queued、Processing、Partial、Succeeded、Failed、Cancelled、Expired等から適用Stateを判断し、Progress、Timeout、再訪、Retry、Idempotency、部分完了を両側で整合させる。実際に取得できない進捗率をUIで演出しない。

Rate Limit、Capacity不足、Dependency停止等でQueue、Reject、Throttle、Degradeが起こる場合、SPECの観測可能なBehaviorと、UIの待機・拒否・縮退・再試行Feedbackを対応づける。

削除、公開、送信、上書き、権限変更等では、ConfirmationだけをSafetyとみなさず、影響表示、Authority、不可逆条件、Rollback / Compensation、Audit Evidenceを対応づける。

## 4.3. Failure, Data, and Wording

重要Failureでは、発生条件、保護する対象、利用者へ伝えるMeaning、入力保持、Retry / Recovery、Support、Log / Evidenceを対応づける。内部Error Codeをそのまま表示せず、すべてを「予期しないエラー」へ潰さない。

表示Dataでは、Source、Freshness、欠損、Format、Localization、Privacy / Masking、更新条件を対応づける。UI文言は、SPECが保証しない成功、承認、保存、最新性を断定しない。

## 4.4. AI, Consent, and External Action

AI Scopeでは、AI Proposal、Human Reviewed、Approved、Execution Requested、Executed、Verified等の意味を必要範囲で分離する。UIはSource / Provenance、不確実性、人間確認、修正・却下を表現し、SPECはInput Scope、Inference、Approval条件、Provider Failure、保存・公開・実行条件を定義する。

Consentは表示だけで成立しない。UIの同意・変更・撤回Actionと、SPECの開始条件、Scope、取消・期限切れ時の停止、失敗時Behaviorを対応づける。

外部Actionでは、UIが対象、範囲、影響、Authorityを理解可能にし、SPECがRate、Amount、Target、Time、Approval、Idempotency、Cancel、Recovery、Auditを制御する。

## 4.5. Settings and Policy Correspondence

設定では、UIが表示するCurrent / Effective Value、Default / Inherited / Overridden / Policy-controlledのMeaning、適用Scope、変更Authority、Impact Preview、保存・反映・Reset Feedbackを、SPECのOption / Range、Default Source、Precedence、Permission、Apply Timing、Side Effect、Failure / Recoveryと対応づける。

UIだけに存在する設定、SPECだけに存在して利用者または運用者が確認・制御できない設定を放置しない。IA Configuration Modelから意図的に固定した項目、直接UIを持たないPolicy / Operational Configurationは、理由、Authority、Consumer / Operational FeedbackとのPair例外を示す。

## 4.6. Verification Correspondence

AcceptanceはUIとSPECで同じ文章にする必要はない。UI側は利用者が認識・操作・回復できること、SPEC側はCondition、State、Behavior、ResultをFresh Evidenceで確認できることを定義する。

Pair Reviewは、同じSource Outcomeについて、どのUI EvidenceとBehavior Evidenceを組み合わせるかを示す。実装済み、Test Pass、Figma完成のいずれか一つをPair成立としない。

EARS等の正式構文はBehavior Specification、Figma等のVisual ArtifactはUIの各正本規則に従う。Pair Contractはそれらの詳細な作成規則を再定義しない。

---

# 5. Exceptions and Legacy

## 5.1. UI-only or Simulated Prototype

価値仮説や操作性を検証するPrototypeでは、完全なBehavior SpecificationなしにSimulated Behaviorを利用してよい。ただし、実BehaviorとSimulation、検証対象、未確定Behavior、使用禁止範囲を明示し、Pair Review完了または実装可能Contractと表現しない。

## 5.2. Behavior without Direct UI

API、Batch、Background Job、Automation等で直接UIを持たない場合、UI側を`Not Applicable`にできる。Consumer Contract、Operational Feedback、監視、停止、回復、Audit Surfaceの必要性を判定し、人間が例外理由を確認する。

## 5.3. Read-only or UI-local Concern

Read-only Surfaceでも、Data Source、Freshness、Empty、Unknown、Failure、Permissionとの対応を確認する。

純粋なLayout、Visual、Client内の一時的なPresentation等で、System BehaviorとのPairが不要なConcernは`Not Applicable`にできる。ただし、Data、永続化、権限、共有State、外部Actionへ影響しないことを説明する。

## 5.4. Reverse and Legacy Reconciliation

LegacyではObserved UI、Observed Runtime Behavior、Code / API / Data、Existing Document、OperationをEvidenceとしてPairを復元してよい。

```text
Observed UI Contract Candidate
Observed Behavior
Documented Behavior
Expected Contract Candidate
Known Defect / Inconsistency
Recovered Intent Candidate
```

現行UI、実装、長期間の運用を意図されたContractと断定しない。復元候補は人間確認または追加Evidenceを得るまで確定UI / SPECとして扱わない。

---

# 6. Pair Review View and Feedback

## 6.1. Standard Pairing View

次はPair Reviewを表現する標準Viewであり、独立Fileを要求しない。

```text
Scope / Pairing Unit / Source Revision
UI ID / Revision / Artifact Reference
SPEC ID / Revision / Artifact Reference
Pair Relation / Cardinality
Applicable Accessibility Profile / Criteria

Concern
UI Contract Meaning
Behavior Specification Meaning
Consistency Result
Coverage State
Unresolved Gap / Exception / Risk
Decision / Rationale Reference
Acceptance / Evidence Plan
Human Review Result
Triggered Propagation Check Result / Source Revision / Remediation / Propagation Exception
Phase Transition Review Result / Reviewed UI and SPEC Revisions / Finding Disposition / Review Exception
```

Pair Review Resultは、`Consistent`、`Gap`、`Conflict`、`Not Applicable`等をProject内で表現してよいが、UI / SPECのArtifact Status、Phase Approval、Verification Resultと混同しない。

## 6.2. Review and Handoff

Reviewでは、対象ScopeのPair Coverage、重大な不一致、片側だけの推測、例外、Risk、各正本へ必要な修正を提示する。不一致の解消はUIまたはSPECのCanonical Artifactへ反映し、Pairing Viewだけを書き換えて終了しない。

Architecture、Implementation、VerificationへのHandoffは、UIとSPECの各Phase Contract、Pair Gate、[Transformation Handoff Invariants](01_Principles.md#62-transformation-invariants)をすべて満たす。部分Handoffは対象Pairing Unit、未解決Concern、Risk、後続Ownerを人間が承認した場合に限る。

Architecture HandoffはUI / SPECのHandoff Viewを縮小再掲して受信条件を減らさず、[Architecture Phase Entry Contract](27_Architecture.md#phase-entry-contract)が要求する全Contextを、Canonical UI / SPEC Artifactへの参照と各Coverage State付きで渡す。

## 6.3. Feedback and Change

UI具体化で新しいStateやRecoveryが必要と判明した場合はSPECへ、SPEC具体化で新しいFeedbackや操作が必要と判明した場合はUIへ戻す。Source UX / IA Intentが変わる場合は上流も再開する。

実装、Verification、運用でPair Conflictを発見した場合、Observed Evidenceを保存し、UI / SPECのどちらが誤りか、両方の上流前提が誤りかを判断する。同じ意味の明確化は既存IDのRevision、意味の置換は新IDと`supersedes`を用い、`pairs_with` Relationと影響Contextを更新する。

---

# 7. Final Principle

```text
人間に見えることと、Systemで起きることは、別のProperty Authorityで設計する。
しかし、同じProduct Intentを成立させる意味の上では切断しない。
```
