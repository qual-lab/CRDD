# CRDD Architecture

Version: v0.5.1
Status: Stable
Owner: Qual-Lab
Skill ID: `skill.architecture.integrate`
Last Updated: 2026-07-22
Related:
- [01_Principles.md](01_Principles.md)
- [02_Terminology.md](02_Terminology.md)
- [03_Documentation.md](03_Documentation.md)
- [10_Agent.md](10_Agent.md)
- [11_Skill.md](11_Skill.md)
- [24_UI_Behavior_Specification.md](24_UI_Behavior_Specification.md)
- [25_UI.md](25_UI.md)
- [26_Behavior_Specification.md](26_Behavior_Specification.md)
- [28_Implementation.md](28_Implementation.md)
- [29_Verification.md](29_Verification.md)
- [51_Document_Audit.md](51_Document_Audit.md)
- [52_Conformance_Audit.md](52_Conformance_Audit.md)
- [53_Gap_Impact_Audit.md](53_Gap_Impact_Audit.md)

---

> Architectureを適用するProjectでは、本書の`Phase Process Contract`をArchitecture工程内の正本として使用する。

> この文書で分かること（非規範の案内）
>
> - 上流の要求・UX・UI・仕様を技術構造へどう変換するか
> - Boundary、Data、Interface、Quality、Securityをどう決めるか
> - 下流で判明した制約を上流へどう返すか
> - Coding Ruleや実装制約をどこへ置くか
> - Implementationへ渡す前に何を確認するか

<a id="1-purpose-and-boundary"></a>

# 1. 目的と適用範囲（Purpose and Boundary）

Architectureは、承認済みProduct Contextを、現在の制約下で実現できるSystem Boundary、Data、Interface、Security、Quality、Operation、Implementation Ruleへ変換する工程である。

```text
Behavior Specification = 何が、どの条件で、どう振る舞うべきか
UI                     = 利用者がどう認識・操作・回復できるか
Architecture           = どの境界・構造・契約・制約で成立させるか
Implementation         = 承認済みArchitectureをCode等へどう具体化するか
Verification           = 対象Revisionで実際に成立したか
```

ArchitectureはRequirement、UX Outcome、UI表現、Behavior Specification、Codeの代替ではない。技術都合で上位IntentやBehaviorを暗黙に弱めず、成立不能または新しい制約を発見した場合は代替案とImpactを該当工程へ戻す。

Architecture Artifactは現在の制約に対する選択結果であり、永続的な一般原則と同一視しない。

---

<a id="phase-process-contract"></a>

# 工程実行契約（Phase Process Contract）

本章はArchitecture工程の入口、変換、責務Coverage、出口、Phase Gate、Auditの正本である。後続章は本Contractを設計判断とSkill実行へ具体化し、独自の完了条件を持たない。

<a id="phase-entry-contract"></a>

## 工程入口契約（Phase Entry Contract）

Architectureは、対象Scopeについて次を受け取る。

- Source REQ / UX / IAへのTrace
- 承認済みUI Contract / Behavior Specificationと[Pair Review](24_UI_Behavior_Specification.md#26-exit-and-pair-gate)結果
- 適用するQuality Concern ProfileとSource / Version / Scope、Quality、Compatibility、Capacity、Security、Privacy、Compliance、Costの条件
- Acceptance CriteriaとVerification Obligation
- 既存System Context、Data、Interface、Operation、Deployment
- Technology、Platform、Provider、Resource等の既知制約
- 外部DependencyとConsumer
- Coverage Summary、Unresolved Gap、人間Review結果
- UI / SPEC → Architecture Phase Transition Review Result、Reviewed UI / SPEC Revisions、または明示された`review_exception`
- UI / SPEC / Pairで発火したTriggered Propagation Check Result、Source Revision、または明示された`propagation_exception`

部分Handoffの場合は、承認されたScope、未決事項、暫定制約、Risk、後続Owner、人間承認も必要である。上位Contextが矛盾する場合はArchitectureで都合よく解釈せず、該当Authorityへ戻す。

<a id="transformation-contract"></a>

## 変換契約（Transformation Contract）

Product Contextを、実装と検証に使えるArchitecture Contextへ変換する。必要に応じて次を定義する。

- System / Domain / Component Boundary
- Data / Interface ContractとSource of Truth
- State / Sequence
- Security / PrivacyとQuality Attribute
- External IntegrationとCompatibility / Migration
- Capacity / InfrastructureとConcurrency / Resilience
- ObservabilityとOperation
- Implementation Rule

Architectureは観測可能なBehaviorを新しく決めない。技術的制約からBehavior変更が必要な場合は、Behavior SpecificationまたはUIへFeedbackし、人間判断後のContractを設計へ反映する。

<a id="required-responsibility-coverage"></a>

## 必要な責務の網羅（Required Responsibility Coverage）

対象Scope全体について、次の責務を適用範囲で判定する。

| Responsibility | Architectureで明らかにすること |
|---|---|
| System Context | Actor、External System、Trust Boundary、主要Data Flow |
| Domain / Component Boundary | 責務、Authority、Dependency Direction、交換Boundary |
| Data | Model、Ownership、Source of Truth、Lifecycle、Consistency、Transaction Boundary |
| Interface / Integration | API / IPC / Event、同期性、Error、Version、Consumer / Provider Boundary |
| State / Sequence | 処理順序、永続State、一時State、Side Effect、Coordination |
| Security / Privacy / Compliance | Authentication、Authorization、Tenant、Secret、Data Flow、Retention、Audit |
| Quality / Operation | Availability、Latency、Throughput、Recovery、Maintainability、Cost、運用責任 |
| Concurrency / Resilience | Idempotency、Contention、Timeout、Retry、Backpressure、Partial Failure、Shutdown |
| Compatibility / Migration | Consumer、Schema、Version、移行期間、Rollback、廃止順序 |
| Capacity / Infrastructure | 負荷前提、Resource、Quota、Scaling、Region、Deployment、Failure Domain |
| Technical Configuration | Product Settingとの境界、保存・配布・優先順位の成立方式、Environment、Secret参照、Provider Parameter、Resource Size、Default / Override Authority |
| Observability | Metric、Log、Trace、Alert、Audit、運用上の状態判定 |
| Implementation Rule | Coding / Dependency / Boundary Rule、禁止事項、実行可能な検査への接続 |
| Verification Enablement | Testability Seam、Environment条件、Load / Failure / Migration検証義務 |
| Trace / Rationale | Source Context、Decision、Alternative、Constraint、Evidence、Unresolved Gap |

すべてを全Scopeへ機械的に記載する必要はない。適用しない責務は`Not Applicable`として理由と人間確認を残す。単一Diagram、主要Happy Path、Technology選定、Prototypeの完成だけでArchitecture完了としない。

<a id="scope-and-coverage-state"></a>

## 対象範囲と網羅状態（Scope and Coverage State）

各上位Contextと各Architecture責務を、`Complete for Scope`、`Partial — Human Authorized`、`Blocked`、`Not Started`、`Not Applicable`で追跡する。

対象ScopeはFeature名だけでなく、Actor、Data、Interface、Environment、Variant、Migration対象、既存Consumerを含めて特定する。Coverage Summaryは「設計文書がある」ではなく、必要な責務が判定済みかを示す。

<a id="human-decisions"></a>

## 人間による判断（Human Decisions）

人間はSystem / Trust Boundary、Technology / Provider選択、Data Ownership、Quality / Cost Trade-off、Security / Privacy Risk、Compatibility破壊、Migration / Rollback方針、重大Dependency、`Not Applicable`、部分Handoffを決定する。

AIは候補比較、Gap、Impact、設計案を提示できるが、上位Contract変更、Risk Acceptance、Authority、重大Trade-offを自己承認しない。

Architectureで人間の判断、制約、学び、根拠、Findingを確定または変更した時点で、[変更影響の伝播確認](53_Gap_Impact_Audit.md#43-mandatory-propagation-trigger-and-closure)を実行する。

Discovery、UX、IA、UI、SPECにある次の項目へ答える、または影響するCandidateを探索する。

- Open QuestionとUnresolved Gap
- AssumptionとDecision
- Constraint

見つかった結果は、それぞれの正本へ反映する。上流の正本を更新した場合は、更新後RevisionからArchitecture以降へのImpactを再探索・再監査するまで通常完了としない。

<a id="exit-and-handoff"></a>

## 完了条件と引渡し（Exit and Handoff）

通常Handoff候補を人間のGateへ提示する前に、次を行う。

1. 対象Scope / Revisionへ[Phase Transition Review](10_Agent.md#72-phase-transition-review-and-remediation-loop)を実行する。
2. 移行に影響するFindingをArchitectureまたは責務を持つ工程で修正する。
3. 修正後Revisionを再Reviewし、`Pass`を得る。

Reviewの省略または未解消Findingを伴う移行は、[Human-directed Review Exception](10_Agent.md#73-human-directed-review-exception)がある場合だけ通常Routeと区別して扱う。

通常のImplementation Handoffは、対象Scopeが`Complete for Scope`で、人間Reviewを通過し、[`28_Implementation.md`](28_Implementation.md#phase-entry-contract)の受信条件を満たす場合に限る。

Handoffでは、次を渡す。

- 承認済みScopeとSource UI / SPEC
- Architecture Boundary
- Data / Interface / Security Contract
- Compatibility / MigrationとCapacity / Operation
- Technical ConfigurationとImplementation Rule
- 禁止事項と既知制約
- Acceptance CriteriaとVerification Obligation
- Coverage StateとUnresolved Gap

部分Handoffには、対象Scope、未定義設計、暫定制約、Risk、受信先、後続Ownerの人間承認を必要とする。Architecture不成立をCodeで暗黙解決させない。

<a id="phase-gate-criteria"></a>

## 工程移行の判定基準（Phase Gate Criteria）

- Source REQ / UX / IA / UI / SPECへTraceできる
- Boundary、Authority、Data Ownership、Source of Truth、Interfaceが判定済みである
- State / Sequence、Failure、Concurrency、Recoveryが説明・検証可能である
- Security / Privacy / Compliance、Quality、Operation、Observabilityを適用範囲で定義している
- 適用するQuality ConcernをArchitecture上のQuality Attribute、成立方式、Verification Obligationへ処置している
- Compatibility / Migration、Capacity / Infrastructure、Dependencyを適用範囲で定義している
- Product SettingとTechnical Configurationを区別し、保存・配布・優先順位、Environment差分、Secret参照、Provider Parameter等を適用範囲で定義している
- Implementation Rule、禁止事項、Verification Obligationが実装前に明確である
- Decision / Rationale、Coverage Gap、部分Handoff承認が記録されている
- 発火したTriggered Propagation Checkが`Pass`であり、必要な上流・同層正本更新と下流再探索・再監査が完了している
- 対象RevisionのPhase Transition Reviewが`Pass`であり、移行に影響するFindingのRemediationと再Reviewが完了している

<a id="phase-audit-checklist"></a>

## 工程監査チェックリスト（Phase Audit Checklist）

- 上位ContextにTraceしないArchitecture判断
- SPECが所有するBehaviorやUIが所有する表現のArchitecture内での再定義
- Boundary、Authority、Data Ownership、Source of Truthの重複またはConflict
- Failure、Concurrency、Security、Privacy、Migration、Capacity、Dependency、Operation、Observability、Technical Configurationの適用判定漏れ
- Product SettingとTechnical Configurationの混同、Default / Override AuthorityまたはEnvironment差分の未定義
- Pattern、Technology、Providerを理由のない一律Ruleとして強制している状態
- DiagramやCode ExampleだけでContract、Constraint、Rationaleがない状態
- Test CaseをArchitectureが所有、またはTestability / Verification Obligationを未定義にしている状態
- Coverage Summary、Unresolved Gap、人間Review、Implementation Ruleの欠落
- Architecture Decision、Constraint、Learning、Evidence、Findingに対応する上流Open Question / Gap探索、正本反映、下流再探索、再監査の欠落
- Independent Review未実施、旧RevisionのReview流用、Finding未修正の持ち越し、Audit Run完了をTarget Passとみなしていないか

---

# 2. Architecture Model

## 2.1. Boundary, Authority, and Dependency

System Contextでは、System、Actor、External System、Trust Boundary、主要Data Flowを示す。Domain / Componentごとに責務、Authority、Dependency Direction、公開Interfaceを定義し、同じ責務を複数Componentが暗黙に所有しないようにする。

外部Service、Provider、Platform固有処理は、交換・隔離・Testの必要性がある場合にAdapter / Provider Boundaryへ閉じ込める。すべてのDependencyへ形式的な抽象化を追加せず、交換可能性、Risk、Testability、Provider固有制約から判断する。

```text
External Consumer -> Interface Boundary -> Domain Responsibility -> Data Authority
External Provider <- Adapter Boundary   <- Domain Responsibility
```

## 2.2. Data, Source of Truth, and Lifecycle

DataごとにOwner、Authoritative Source、Writer、Reader、Classification、Retention、Deletion、Consistency、Transaction Boundaryを定義する。複数Systemを統合する場合、一つのSystem全体を常に正本とせず、意味のあるFieldまたはAggregate単位でSource of Truthを決める。

Copy、Cache、Read Model、Derived Data、AI InferenceをAuthoritative Dataと同一視しない。Freshness、Staleness、Conflict、Correction、Rebuildの扱いを定義する。

UIに表示する更新通知、差し替え、Freshness表現はUI / SPECが正本である。ArchitectureはSnapshot / Version、通知経路、Consistency、再取得、競合検出を成立させる。

## 2.3. Interface and Integration Contract

各API、IPC、Event、File、Batch、External Connectorについて、Consumer / Provider、Data Contract、Authority、同期性、Delivery、Ordering、Error、Timeout、Retry、Idempotency、Version、Observabilityを適用範囲で定義する。

```text
Request-Response = 呼び出し側が結果または受付結果を待つ
One-way Message  = 呼び出し側が同期結果を待たずに送る
Push / Event     = 提供側がEventまたは更新を通知する
Batch / File     = 集合または時点単位で受け渡す
```

この分類は実装方式を固定するためではなく、Ownership、Failure、Delivery Guarantee、Consumer Behaviorを曖昧にしないために使う。

## 2.4. State, Sequence, and Side Effects

主要Flowは、開始条件、Actor / Trigger、State、Component間の処理順序、永続化点、External Side Effect、成功・失敗・取消・回復を対応づける。SPECの状態とArchitecture内部Stateを区別し、内部都合のStateを利用者向けMeaningとして無断公開しない。

複数の入口が同じSide Effectを起動する場合、共通Execution Boundary、Idempotency Key、Lock、Queue、Transaction等から適切な制御を選ぶ。常に単一Gateへ集約するとは限らないが、入口ごとに防御が不一致になる構造は避ける。

## 2.5. Concurrency, Failure, and Recovery

ConcurrencyとFailureは、次の判断を一つのRecovery Contractとして扱う。

- 同時実行、Re-entry、Duplicate、Stale Write、Conflictの発生条件
- Atomicity Boundaryと部分成功を許容する単位
- Timeout BudgetとLayer間の順序
- Retry可能なFailure、Backoff、上限、Idempotency
- Cancel、Rollback、Compensation、Manual Recovery
- Graceful Shutdown時の受付停止、Drain、Flush、上限時間
- Dependency停止、Degraded Mode、Backpressure、Load Shedding
- Recovery後のState、Observability、再検証

部分成功を常に保持する、または常にRollbackするとは決めない。SPECのResultとData Integrityに従い、Atomicity Boundaryを設計する。Retry上限後の復帰を常に人間操作に限定せず、Risk、Authority、回復可能性をSPECと整合させる。

Fail ClosedはAuthorization、Consent、安全、法的制約、不可逆Action等、判定不能時に許可側へ倒すRiskが高い境界へ適用する。一般的な表示状態や低RiskのAvailability判定へ無条件に拡張せず、Fallbackと利用者・Consumerへ返すBehaviorをSPECと整合させる。

高Cost処理、Batch、外部呼び出しでは、必要に応じて実行前に対象有無、Eligibility、Quotaを安価に判定するAdmission Stepを設ける。対象なしの扱い、Log / Metric / UI通知の要否は、Operational Observabilityと利用者へのFeedbackを損なわないようScopeごとに決める。

## 2.6. Quality, Capacity, Infrastructure, and Operation

SPECの観測可能なQuality ConditionとCapacity Behaviorを、負荷前提、Resource、Deployment、Operationへ変換する。

利用者・組織が理解し変更するPreference / Policy / Settingの意味と観測可能なBehaviorはIA、UI、SPECを正本とする。Architectureは、それらを成立させる保存・配布・優先順位の技術方式と、環境変数、Secret参照、Provider Parameter、Resource Size等のTechnical Configurationを設計し、両者を無自覚に同じ設定体系へ混在させない。

- Traffic、Concurrency、Data / Batch量、成長率、Peak、Seasonality
- Latency、Throughput、Availability、Durability、Recovery、CostのTarget / Limit
- Compute、Memory、Storage、DB Connection、Queue、Cache、Provider Quota
- Scaling、Rate Limit、Backpressure、Load Shedding、Degraded Mode
- Region、Network、Failure Domain、Backup、Restore、Failover
- Deployment、Rollback、Configuration、Secret、Environment差分
- Metric、Log、Trace、Alert、Runbook Owner、Capacity Review Trigger

過負荷時に何を守り、何を遅延・拒否・縮退するかはSPECへ戻して人間判断を得る。Architectureは、そのBehaviorを成立させるResourceとControlを設計する。

## 2.7. Compatibility, Migration, and Dependency Evolution

Consumerから観測可能なCompatibility / Migration-period BehaviorはBehavior Specificationを正本とし、ArchitectureはVersioning、Coexistence、Migration、Deployment、Rollback、廃止順序を定義する。

API / InterfaceではBreaking / Non-breakingを分類し、Consumer Inventory、複数Version共存、Adapter / Compatibility Layer、Feature Flag、廃止条件を扱う。旧Contract削除前にConsumer移行と利用停止をEvidenceで確認する。

Schema変更は既存DataとDeploy順序を含め、必要に応じてExpand / Contract、Backfill、Dual Read / Write、Backup、Rollback、安全な再実行、Partial Failureを設計する。

Library、Runtime、Provider、Platformの追加・更新は、必要性、保守状況、License、Security Advisory、Support期間、Breaking Change、移行方法、代替を確認する。

## 2.8. Security, Privacy, and AI Architecture

Security、Privacy、AI Governanceは後付けの非機能項目ではなく、Boundary、Data、Interface、Execution Pathへ組み込む。

- Authentication、Authorization、Tenant、Least Privilege、Secret
- Trust Boundary、Input Provenance、External DataとInstructionの分離
- Allowlist、Schema Validation、Tool / External Action Authority
- Consent、Purpose、Data Minimization、Provider送信、Region、学習利用
- Observed Fact、AI Inference、Human-confirmed Informationの分離
- Retention、Deletion、Correction、Consent Revocation、Backup / Log
- Output Validation、Human Approval、Rate / Cost Limit、Audit、Kill Switch

Promptの注意書き、UIのConsent表示、Release直前のMaskingだけをSecurity Boundaryとみなさない。Batch、Queue、Retry、Admin Pathを含むすべての実行経路で同じAuthorityとData Boundaryを強制する。

## 2.9. Implementation and Coding Rule Authority

Project固有のCoding RuleとImplementation RuleのCanonical Markdownは`06_Architecture`へ置く。ArchitectureはRuleの意味、適用Scope、理由、禁止事項、例外承認、検査方法を定義する。

```text
06_Architecture/
├─ System / Data / Interface Architecture
├─ Security / Operation / Migration Architecture
└─ Coding / Implementation Rules
```

Code、Configuration、Migration、Developer Test、Build Artifact、およびLinter / Formatter / Static Analyzer等の実行可能な強制手段はImplementationが所有する。Architectureは具体的なTest Caseを所有せず、Testability Seam、必要Environment、Failure / Load / Migration等のVerification Obligationを渡す。

## 2.10. Representation, Decision, and Trace

ArchitectureはText、Table、Schema、Diagramを、関係を最も明確に表す最小の形式で使う。Diagramだけを正本にせず、Boundary、Rule、Constraint、RationaleをTextで追跡可能にする。複雑な構造やSequenceではMermaid等の差分管理可能なDiagramを利用してよい。

ArchitectureへCRDD標準Stable Context IDを新規発行しない。Source `REQ-*` / `UX-*` / `IA-*` / `UI-*` / `SPEC-*`、Change Trace、Implementation、VerificationとはArtifact ReferenceとRelationで接続する。

根拠はArchitecture Artifact内または最も近い親Folderの`Evidence/`へ置く。選択結果はCanonical Architecture Artifactの`Decision / Rationale`へ、Context、選択、理由、Alternative、Evidence、Trade-off、Impact、再評価Triggerを残す。全DecisionをRoot直下の台帳へ複製しない。

---

<a id="3-guided-skill-adapter"></a>

# 3. Skill実行Adapter（Guided Skill Adapter）

<a id="31-runtime-authority"></a>

## 3.1. 実行時の決定権限（Runtime Authority）

`skill.architecture.integrate`は、本書のPhase Process Contractを[`11_Skill.md`](11_Skill.md)のRun Lifecycle、Guided Interaction、Human Review、Handoffに従って実行するArchitecture固有Adapterである。本書ではRun Status、Pause / Resume、共通Question Rule、Subagent Lifecycleを再定義しない。

## 3.2. Architecture-specific Progression

| 手順 | 変換 | 出力 |
|---|---|---|
| Load | UI / SPEC、Quality、既存System、Constraintを対応づける | Architecture Coverage Queue |
| Frame | System / Trust Boundary、Actor、Data、External Dependencyを定める | System Context |
| Structure | Domain、Component、Data、Interface、State / Sequenceを設計する | Structural Contract |
| Harden | Security、Failure、Concurrency、Compatibility、Capacity、Operationを判定する | Operational Architecture |
| Enable | Implementation Rule、Testability、Verification Obligationを定める | Implementation Handoff |
| Review | Coverage、Decision、Gap、Riskを人間が確認する | Approved / Partial / Blocked |

質問数や文書分割を進捗とみなさず、Required Responsibility Coverageと対象Scopeで進捗を判定する。

## 3.3. Guided Clarification

専門用語を要求する前に、人間が答えられる言葉で不足Contextを確認する。

| 話題 | 質問の意図 |
|---|---|
| Boundary | どこで動き、誰・何と接続する必要があるか |
| Data | 誰のDataを、どこへ、どの期間保存できるか |
| Authority | 誰が読み書き・承認・外部実行できるか |
| Failure | 外部Serviceや処理が停止したとき何を守るか |
| Integrity | 失敗しても失ってはいけないDataやActionは何か |
| Evolution | 将来交換したいもの、既存運用で変えられないものは何か |
| Quality | 利用規模、応答時間、可用性、復旧、Costの目安は何か |
| Operation | 誰が異常を知り、停止・復旧・Rollbackするか |

回答をBoundary、Data、Interface、Failure、Security、Quality、Operation、Migration、Capacityへ変換する。上位Contractを弱める必要がある場合はArchitecture内で確定しない。

## 3.4. Escalation and Subagent Use

次の場合は該当Authorityへ戻す。

| 条件 | 移行先（Route） |
|---|---|
| Source Behavior、Quality Condition、Authorityが不明 | SPEC / Human Decision |
| UIと実現可能なBehaviorがConflict | UI / SPEC Pair Review |
| Data Purpose、Consent、Retentionが不明 | Discovery / Human Decision |
| Technology検証が必要 | Architecture Spike / Evidence取得 |
| Risk、Cost、Compatibility破壊の受容が必要 | Human Authority |
| Architectureは成立するが実装方法の選択が主題 | Implementation |

Subagentを使う場合は[`10_Agent.md`](10_Agent.md)に従い、Data、Security、Capacity、Migration、Provider比較等の限定Scopeを委譲できる。Architecture全体の整合、Decision、Coverage、HandoffはParent Agentが統合し、人間確認を得る。

---

<a id="4-review-handoff-view-and-feedback"></a>

# 4. Review・引渡しView・Feedback

## 4.1. Architecture-specific Human Review

人間Reviewでは少なくとも次を確認する。

- 上位IntentとBehaviorを技術都合で弱めていない
- Boundary、Authority、Data Ownership、Source of Truthが一意またはConflict管理されている
- Failure、Security、Privacy、Compatibility、CapacityのRiskを隠していない
- PatternとTechnology選択にContext、Alternative、Trade-offがある
- Operation、Migration、Rollback、Verificationを実装後回しにしていない
- Product SettingとTechnical Configurationを区別し、成立方式とAuthorityを実装へ渡している
- Partial / `Not Applicable`のScope、理由、Ownerが明確である

## 4.2. Architecture Artifact / Handoff View

Artifactの分割方法は固定しないが、対象Scopeについて次を参照可能にする。

```text
Scope / Coverage Summary / Unresolved Gap
Source UI / SPEC / Quality / Constraint
System Context / Trust Boundary
Domain / Component Responsibility
Data / Source of Truth / Lifecycle
Interface / Integration / External Dependency
State / Sequence / Concurrency / Recovery
Security / Privacy / AI Boundary
Quality / Capacity / Infrastructure / Operation
Technical Configuration / Product Setting Boundary
Compatibility / Migration / Rollback
Implementation / Coding Rule
Verification Obligation
Decision / Rationale / Evidence / Human Review
Triggered Propagation Check Result / Source Revision / Upstream Updates / Downstream Re-scan / Propagation Exception
Phase Transition Review Result / Reviewed Revision / Finding Disposition / Review Exception
```

Implementation HandoffはこのViewを縮小再掲して受信条件を減らさず、Canonical Architecture Artifactへの参照とCoverage State付きで渡す。

## 4.3. Feedback to Architecture

Implementation、Verification、Operation、Incident、Dependency更新から、成立不能、性能差、Failure Mode、Security Gap、Migration Risk等が得られた場合はArchitectureへ戻す。

同じ制約下の明確化は既存Artifactを更新する。Boundary、Authority、Data Meaning、主要Technology、Migration方針等を置換する場合は、旧Decisionを消さず、新しいDecision / RationaleとArtifact Referenceで履歴を接続する。

Architecture LearningがSPECやUIの観測可能なBehaviorを変える場合は、Architectureだけを更新せず、該当工程をReopenする。

---

<a id="5-final-principle"></a>

# 5. 最終原則（Final Principle）

ArchitectureはDiagramやPatternを作って終わる工程ではない。

上位Contextを実現可能なBoundary、Contract、Constraint、Ruleへ変換し、ImplementationとVerificationが迷わず実行・検証できる状態を作る。
