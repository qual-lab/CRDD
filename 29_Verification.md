# CRDD Verification

Version: v0.5.0
Status: Stable
Owner: Qual-Lab
Skill ID: `skill.verification.assure`
Last Updated: 2026-07-21
Related:
- [01_Principles.md](01_Principles.md)
- [02_Terminology.md](02_Terminology.md)
- [03_Documentation.md](03_Documentation.md)
- [10_Agent.md](10_Agent.md)
- [11_Skill.md](11_Skill.md)
- [12_Change.md](12_Change.md)
- [13_Release.md](13_Release.md)
- [22_UX.md](22_UX.md)
- [23_IA.md](23_IA.md)
- [24_UI_Behavior_Specification.md](24_UI_Behavior_Specification.md)
- [25_UI.md](25_UI.md)
- [26_Behavior_Specification.md](26_Behavior_Specification.md)
- [27_Architecture.md](27_Architecture.md)
- [28_Implementation.md](28_Implementation.md)
- [51_Document_Audit.md](51_Document_Audit.md)
- [52_Conformance_Audit.md](52_Conformance_Audit.md)
- [53_Gap_Impact_Audit.md](53_Gap_Impact_Audit.md)

---

> Verificationを適用するProjectでは、本書の`Phase Process Contract`をVerification工程内の正本として使用する。

# 1. Purpose and Boundary

Verificationは、Implementation Artifactが承認済みContext、Acceptance、Architecture、Quality Conditionを満たすかを、Target RevisionとEnvironmentに対するFresh Evidenceで独立検証する工程である。

```text
Implemented = 承認済みContractを実行可能Artifactへ具体化した状態
Verified    = 特定RevisionとEnvironmentでContractの成立をEvidenceにより確認した状態
Accepted    = Verification ResultとResidual RiskをHuman Authorityが受容した状態
```

Code、Test、Documentの存在や実装者の完了宣言だけではVerifiedにならない。VerificationはQualityやAcceptanceを新しく決めず、基準が不足・矛盾・観測不能なら原因側の工程へFindingを返す。

VerificationはDocument AuditやCRDD Conformance Auditの代替ではない。文書構造・規範適合は[`51_Document_Audit.md`](51_Document_Audit.md)と[`52_Conformance_Audit.md`](52_Conformance_Audit.md)、工程間Gap / Impactは[`53_Gap_Impact_Audit.md`](53_Gap_Impact_Audit.md)を正本とする。

---

# Phase Process Contract

本章はVerification工程の入口、変換、責務Coverage、出口、Phase Gate、Auditの正本である。後続章は本Contractを検証設計、Evidence、Finding、Skill実行へ具体化し、独自の完了条件を持たない。

## Phase Entry Contract

Verificationは対象Scopeについて次を受け取る。

- Target Revision / Baselineと変更Scope
- 承認済みREQ / UX / IA / UI / SPEC / Architecture
- 該当するChange TraceとImplementation Artifact
- Developer Test / Implementation Evidence
- Acceptance Criteria、Quality Condition、Verification Obligation
- 適用するQuality Concern ProfileとSource / Version / Scope
- 適用するHuman-centered Quality Criteria View（Source、Version、Level、Platform、Scope、Normative / Informative）
- Environment、Configuration、Variant、Fixture / Test Data
- Migration / Rollback、Compatibility、Capacity、Security等のRisk条件
- Known Limitation、Unresolved Gap、人間Review結果
- Implementation → Verification Phase Transition Review Result、Reviewed Revision、または明示された`review_exception`
- Implementationで発火したTriggered Propagation Check Result、Source Revision、または明示された`propagation_exception`

Target、Expected Contract、Environment、Acceptanceのいずれかが特定できない場合、推測でPassせず`Blocked`または`Not Verified`として不足情報とOwnerを返す。

## Transformation Contract

Implementation ArtifactとImplementation Evidenceを、独立Test、Review、Runtime / Visual Observation、Comparison、Simulation、Load / Security / Migration Verification等によって、Verification Result、Fresh Evidence、Finding、Residual Risk、Recommendation、Learningへ変換する。

Verificationは「TestがPassした」だけでなく、何を、どの条件で保証し、何を保証していないかを明示する。

## Required Responsibility Coverage

対象Scopeについて次の責務を適用範囲で判定する。

| Responsibility | Verificationで明らかにすること |
|---|---|
| Target and Baseline | Scope、Revision、Environment、Configuration、Fixture、比較対象 |
| Acceptance / Contract | REQ、UX Outcome、UI / SPEC、Architecture、Quality ConditionへのTrace |
| Functional Behavior | Success、Boundary、Failure、Permission、Recovery、State、Side Effect |
| Regression / Integration | 既存Behavior、Consumer、End-to-end Data Flow、変更Layer間の整合 |
| Product Experience | UX Outcome、Goal完了、認知負荷、IA Findability、UI / SPEC Pair、Usability、Accessibility Profile、Visual / Content |
| Compatibility / Migration | 旧新Version、既存Data / Consumer、切替、再実行、Rollback、廃止 |
| Capacity / Quality | Latency、Throughput、Availability、Recovery、Resource、Cost、劣化時Behavior |
| Security / Privacy / AI | Authority、Consent、Data Flow、External Action、AI Output、Audit、Guardrail |
| Environment / Variant | Platform、Locale、Role、Tenant、Feature、Provider、Configuration差 |
| Evidence / Reproduction | Method、Procedure、Result、Artifact、Timestamp、再現条件 |
| Finding / Risk | Severity、Impact、Owner、Disposition、Residual Risk、未検証範囲 |
| Learning / Feedback | 原因工程、更新対象、再検証条件、Release / Roadmap候補 |

すべてを全Scopeへ機械的に要求しない。適用しない責務は`Not Applicable`として理由と人間確認を残す。一つのTest Suite、Environment、Happy PathのPassだけで対象Scope全体をVerifiedとしない。

## Scope and Coverage State

各Verification Obligationを、`Verified`、`Failed`、`Partially Verified — Human Authorized`、`Blocked`、`Not Verified`、`Not Applicable`で追跡する。

集約Statusは最も都合のよい結果へ丸めない。`Failed`、`Blocked`、`Not Verified`を含むScopeを単純な`Verified`として表示せず、対象、例外、Authority、Residual Riskを示す。

## Human Decisions

人間はAcceptance変更、Risk受容、未検証ScopeのRelease、Environment差異の許容、Risk受容・例外を伴うFindingのDisposition、Human-centered Criteriaの採用・非適用・例外、`Not Applicable`、条件付き完了、Residual Risk、Release / Rollbackを決定する。

Verification実行者はStatus、Severity、Required Fix、Recommendationを提示できるが、Acceptanceを弱める、Production Artifactを修正する、Riskを自己受容する、Human Approvalを代行することはできない。

Human Decision、Learning、Fresh Evidence、Finding、Known Limitationを確定または変更した時点で、[Triggered Propagation Check](53_Gap_Impact_Audit.md#43-mandatory-propagation-trigger-and-closure)の要否を判定する。発火した場合は、原因側または回答先となる上流・同層Contextを更新し、更新後RevisionのImpactと必要な再Verificationを再監査するまで通常完了としない。

## Exit and Handoff

Release、Close、Roadmap、Reopen等の次Route候補をHuman Gateへ提示する前に、[Phase Transition Review](10_Agent.md#72-phase-transition-review-and-remediation-loop)を対象Scope / Revisionへ実行する。移行に影響するFindingはVerificationまたは原因側の責務工程で修正し、必要な再Verificationを含む修正後Revisionの再Reviewで`Pass`を得る。Review省略または未解消Findingを伴う移行は[Human-directed Review Exception](10_Agent.md#73-human-directed-review-exception)がある場合だけ通常Routeと区別して扱う。

Verification Resultには、Target Scope / Revision / Environment、適用Contract、方法、結果、Coverage State、Finding、Fresh Evidence、未検証範囲、Residual Risk、Recommendation、Learning / Feedback先を含める。

FailureまたはGapは、Production ArtifactならImplementation、Contract不足なら該当する上流工程、Architecture不足ならArchitecture、Scope / Risk / Release判断ならHuman Authorityへ戻す。Verification内で原因側の正本を無言修正しない。

Verification完了はRelease承認と同一ではない。VerificationはRelease Readinessを推奨し、人間またはRelease Authorityが配布・有効化を決定する。

## Phase Gate Criteria

- Target Scope、Revision、Baseline、Environment、Variantが特定されている
- Acceptance、Contract、Quality Condition、Verification ObligationへTraceできる
- Riskに応じた自動Test、手動Review、Runtime / Visual / Load等を実行している
- Success、Failure、Permission、Recovery、Regression、Variantを適用範囲で確認している
- Compatibility、Migration、Capacity、Security、Accessibility等を適用範囲で確認している
- Human-centered Quality CriteriaのSource、Version、Level、Platform、Scope、Normative / Informativeを識別し、対象Revisionへの結果とEvidenceを辿れる
- Finding、未検証範囲、Residual Risk、Known Limitationを隠していない
- Fresh EvidenceとReproduction条件がTarget Revisionへ対応している
- Learning、原因工程、再検証条件、Recommendationが特定されている
- 発火したTriggered Propagation Checkが`Pass`であり、必要な上流・同層正本更新、下流再探索、再監査・再Verification範囲が確定している
- 対象RevisionのPhase Transition Reviewが`Pass`であり、移行に影響するFindingのRemediation、必要な再Verification、再Reviewが完了している

## Phase Audit Checklist

- Implementation担当の説明、Testの存在、過去のPassだけを根拠にVerifiedとしている
- Target Revision、Environment、Configuration、Fixture、Baselineが不明である
- Testの保証範囲と対象Contractが不明である
- Happy Path、単一Role、単一Environmentだけを全Scopeへ一般化している
- AcceptanceをTest結果へ合わせて弱めている
- Testを通すためにProduction ArtifactをVerification側で変更している
- Failure、Compatibility、Migration、Capacity、Security、Accessibilityの適用判定漏れ
- Human-centered CriteriaのSource / Version / Scope不明、Informative Heuristicの無条件なRelease Block、Normative Criteriaの未評価または根拠のない非適用
- `Failed` / `Blocked` / `Not Verified`を`Verified`へ混在させている
- Evidence、Finding、Residual Risk、Learning、再検証条件の欠落
- 確定・変更したDecision、Learning、Evidence、Finding、Known Limitationに対する上流・同層探索、正本反映、下流再探索、再監査の欠落
- Independent Review未実施、旧RevisionのReview流用、Finding未修正の持ち越し、Audit Run完了をTarget Passとみなしていないか

---

# 2. Verification Model

## 2.1. Target, Expected Result, and Baseline

Verificationは、次の三つを混同しない。

```text
Target   = 実際に検証するRevision、Build、Artifact、Environment
Expected = Acceptance、Contract、Quality Conditionが要求する結果
Baseline = 回帰・差分・Migration前後比較に使う既知状態
```

Branch名や「最新版」だけでTargetを表さず、Commit、Build、Package、Migration状態等から再識別できるようにする。Baselineは現行挙動であるだけでは正しさを保証しないため、Characterizationと承認済みExpected Resultを区別する。

## 2.2. Independence and Verification Status

独立性とは、必ず別の人が実行することだけを意味しない。実装者の記憶や成功報告ではなく、Target、Contract、Method、Evidenceから結果を再判定できる状態をいう。

小規模・低Risk変更では同じAgentがImplementationとVerificationを連続実行してよいが、Verification RunはFresh ContextでTarget、Contract、Revision、Acceptance、Known Riskを読み直す。高Risk Scopeでは別Agent、Subagent、専門家、人間Reviewer等による独立Reviewを使用する。

多数のObligationを継続管理する場合は、実装状態と検証状態を別Propertyとして持つVerification Matrixを使ってよい。中央Registryや新しいFolderを必須とせず、対象Artifactから参照可能にする。

```text
implementation_status = Not Started / In Progress / Implemented
verification_status   = Not Verified / Blocked / Failed / Verified
evidence_reference    = 対象RevisionのEvidence
last_verified_target  = 最後に検証したRevision / Environment
```

## 2.3. Verification, Validation, and Assurance Intent

CRDDでは、承認済みRequirement、UI / SPEC、Architecture等のContractを対象Revisionが満たすかの確認をVerification、Problem、Need / Desired Outcome、利用者価値に対してProductの方向と結果が妥当かの確認をValidationとして区別する。Validationは人間または対象Domain / User Authorityの判断を含み得るが、抽象的な満足確認だけで下流ContractのVerificationを代替しない。VerificationがPassしても、SourceとなるNeed / Outcomeを満たさないEvidenceが得られた場合はLearningと上流Gapを返す。

Test名やファイル分割ではなく、何を保証するための方法かを明確にする。

| Method / Pattern | Assurance Intent |
|---|---|
| Unit / Component | Logic、State、Boundary、局所Failure |
| Contract / Consumer | API、IPC、Event、Schema、互換性 |
| Integration / E2E | Layer間Data Flow、主要Outcome、External Boundary |
| Characterization | 現在の観測挙動の固定と差分検出 |
| Golden / Comparison | 承認済みまたは既知Fixtureとの差分検出 |
| Simulation / Property | 多様・未知入力、Invariant、Pipeline頑健性 |
| Runtime / Visual Review | 実描画、操作、Content、Environment固有挙動 |
| Load / Soak / Failure Injection | Capacity、劣化、Recovery、Resilience |
| Security / Privacy Review | Authority、Boundary、Data Flow、Abuse / Adversarial条件 |
| Migration / Rollback Exercise | Data Meaning、切替、再実行、復旧 |

同じMethodが複数Intentを持ってよいが、保証していない範囲を隠さない。具体的なTest命名・Directory配置は`06_Architecture`のProject Ruleに従う。

## 2.4. Developer Test and Independent Verification

Implementationは変更を成立させるDeveloper TestをCodeとともに作成する。Verificationは対象Revisionに対する独立検証を設計・実行し、保証不足を検出した場合は追加Testを作成してよい。

Testの技術形式や名称だけで両者を区別しない。同じE2E、Integration、Contract Testでも、目的、独立性、Authority、Target Evidenceが異なる。

VerificationがTest Codeを`40_Develop`またはProjectの通常Test配置へ追加することは許容する。ただし、Testを通すためにProduction Artifact、Acceptance、上流Contractを変更しない。Production FixはFindingとしてImplementationへ戻す。

## 2.5. Fresh Evidence and Reproduction

Fresh Evidenceは少なくとも次を識別できる。

- Target Revision / Build / Artifact
- Environment、Configuration、Variant、Fixture / Data条件
- 対象Contract / Verification Obligation
- 適用する外部CriteriaのSource / Version / Level / Platform / ScopeとCriterion Reference
- Method、Command / Procedure、Tool Version
- 実行日時、実行者またはAgent、Result
- Log、Report、Screenshot、Metric等のEvidence Artifact
- Reproduction条件と未検証範囲

Source、Binary、Configuration、Migration、Dependency、Environment、AcceptanceがEvidenceの適用性へ影響する形で変わった場合、過去Evidenceを自動的に現行RevisionのPassとして再利用しない。再利用可能性を判断し、必要範囲を再検証する。

Evidenceは対象Artifact内または最も近い親Folderの`Evidence/`へ置く。Root直下の中央Evidence Folderを前提にしない。外部CI、Test Management、Monitoring等を使う場合もArtifact Reference、Retention、Accessを明確にする。

## 2.6. Finding, Severity, and Disposition

Findingは単なるError Messageではなく、対象Contractに対する差異として記録する。

```text
Finding ID or Artifact Reference
Target / Environment
Expected / Actual
Reproduction / Evidence
Impact / Affected Scope
Severity / Confidence
Likely Cause and Return Route
Owner / Disposition / Reverification Condition
Residual Risk
```

Severityは原因工程や修正優先度と同一ではない。Product Impact、Security / Privacy、Data Integrity、Recovery、Exposure、Workaround等から判断する。`Accepted Risk`、`Deferred`、`Not Reproducible`はPassではなく、人間Authority、理由、対象Scope、再評価Triggerを持つDispositionである。

NormativeなHuman-centered Criteriaの例外またはRisk受容は、新しい`WAV-*`等のStable IDを発行せず、既存Finding、Change Trace、Canonical ArtifactまたはProjectの承認記録に残す。少なくともCriterion / Source Revision、対象Scope / Target Revision、理由、利用者影響とResidual Risk、Mitigation、Approver、失効日または失効条件、再確認Triggerを取得可能にする。期限切れ・条件不一致の例外を現行Passとして再利用しない。

## 2.7. Product Context and Experience Verification

各工程成果物の責務Coverageは、それぞれの`Required Responsibility Coverage`を正本とする。Verificationは対象ScopeのCoverage State、Unresolved Gap、`Not Applicable`理由、人間承認を受け取り、実装結果が承認済みOutcomeと矛盾していないか確認する。工程文書の完全性そのものはDocument / Conformance Auditへ渡す。

UI / Product Scopeでは、次を適用範囲で確認する。

- UI ContractとBehavior SpecificationのPair整合
- Preference / Policy / SettingのOption、Default / Effective Value、Scope、Inheritance / Override、Permission、変更・反映・Reset / RecoveryのPair整合
- UX OutcomeとGoal完了、不要な記憶・比較・判断負荷、System状態・変化・影響・次Actionの理解、Error予防・回復
- IAのMental Model、Label、Browse / Search、現在位置、関連情報、Current / Historical / Deprecated、Progressive Disclosure
- Screen、State、Variant、Role、Locale、Responsive条件
- Usability、Content、Visual Hierarchy、初心者と熟練者の経路
- Accessibility Profileに基づくKeyboard、Focus、Semantic、Assistive Technology、Contrast、Text Scaling / Reflow、Reading Order、Target Size、Drag代替、Motion、Error Identification
- UX Outcome、Origin、Product Principleを阻害していないこと

Human-centered Quality Criteria Viewは新しいProperty Authorityではなく、UX、IA、UI、Behavior Specificationの正本と、Projectが採用した外部Criteriaを対象Scope向けに束ねたVerification Viewである。外部CriteriaはSource、Version、Level、Platform、Scope、Normative / Informativeを識別する。法令、契約、承認済みRequirement、Project ProfileによるCriteriaはNormativeとして評価し、一般HeuristicはProjectが採用しない限りInformativeなFindingとする。

詳細なUI責務は[UI and Visual Quality](25_UI.md#ui-and-visual-quality)を正本とする。VerificationはCriterion単位で`Verified`、`Failed`、`Not Applicable`、`Not Evaluated`等の結果を持ってよいが、CRDD共通の新しいAudit Status体系や中央`Audits/` Folderを作らない。Target Revisionに対するMethod、Finding、Disposition、Evidenceを残す。

## 2.8. Compatibility, Migration, Capacity, and Quality Verification

Quality Conditionと観測可能なCompatibility / Capacity BehaviorはBehavior Specification、成立方式はArchitectureを正本とする。Verificationは対象Scopeに応じて次をFresh Evidenceで確認する。

| Area | Verification Focus |
|---|---|
| Compatibility | 旧Consumer、既存Contract、新旧Version共存、Deprecation、Failure / Fallback |
| Migration | Data Meaning / Count / Relation、Backfill、切替順序、再実行、Rollback、旧利用停止 |
| Capacity | Traffic、Concurrency、Data / Batch量、Peak、Latency、Throughput、完了時間 |
| Resilience | Rate Limit、Queue、Backpressure、Load Shedding、Degraded Mode、Failover、Recovery |
| Resource / Cost | Connection、Memory、Storage、Quota、Scaling、Alert、Budget Guardrail |
| Quality | Availability、Durability、Accessibility、Maintainability等の適用Condition |

Backupの存在だけをRollback成功とみなさず、Riskに応じてRestoreまたはRollbackをExerciseする。単一平均値だけでPeak、劣化、回復を保証したことにしない。基準が不足またはTest不能なら、SPECまたはArchitectureへFindingを返す。

## 2.9. Governance, Security, Privacy, AI, and Cost Verification

Governance対応は、実装されたという説明ではなく、対象RevisionのFresh Evidenceで検証する。適用するBehavior / BoundaryはSPECとArchitectureを正本とし、次をRiskに応じて確認する。

- Consent、Authority、Permission、Tenant、External Action Limit
- UI、API、Batch、Queue、Retry、Admin PathのBoundary一貫性
- Provider、Log、Cache、Backupを含むData Flowと禁止Data
- External Data / Instruction分離、Schema / Output Validation、Least Privilege
- Observed Fact、AI Inference、Human-confirmed Informationの分離
- Retention、Deletion、Correction、Consent Revocation
- Rate / Amount / Target / Time / Cost Guardrail、Audit、Kill Switch
- AI OutputのCorrectness、Safety、Usefulness、Uncertainty、Human Review条件

AI Outputは機械判定可能なSchema、禁止条件、Referenceとの整合を自動化し、自然さ、有用性、誤解Risk等は承認済みRubricによるHuman / Expert Reviewを組み合わせる。固定の採点尺度や合格率をCRDD共通値として強制せず、SPECのAcceptanceとRiskから定める。Model、Prompt、Provider、Tool、Data条件が変わった場合は影響範囲を再検証する。

未検証範囲は`Not Verified`として残し、SecurityやGovernance対応をImplementation説明だけで「対応済み」と表示しない。

## 2.10. Release Readiness and Learning

VerificationはRelease対象、Distribution Artifact、Environment、Security / Governance / License、Known Limitation、Context Consistencyを確認し、`Ready`、`Conditional`、`Not Ready`等のRecommendationを返す。名称はProjectで定義してよい。

Release Evidenceは対象Release Artifactの最も近い親Folderにある`Evidence/`または参照可能な外部Artifactへ置き、Target、Contract、Method、Result、未解決事項、Known Limitation、関連Decisionを識別可能にする。承認者・承認日は[Release](13_Release.md)とProject固有のHuman Release Authorityの記録であり、Verification実行者が代行しない。

Verification ResultをTest Logだけで閉じず、不具合、原因分類、新しい制約、仮説の支持・反証、変更すべき上流Context、再検証条件、次Release / Roadmap候補をCanonical Artifactへ戻し、該当Change Traceへ結果を接続する。

Human-centered CriteriaのSource / Version / Level、対象Platform / Scope、UI / SPEC Pair、利用者影響のあるContent / Flow / State、Assistive Technologyまたは重要なEnvironmentが変わった場合は、影響するCriteriaを再評価する。Findingの修正、例外の失効、Riskまたは対象利用者の変化も再Verification Triggerとする。

## 2.11. Trace, Stable Context ID, and Decision Boundary

Verification、Finding、Evidence、TestへCRDD標準Stable Context IDを新規発行しない。Source `REQ-*` / `UX-*` / `IA-*` / `UI-*` / `SPEC-*`、Architecture、Implementation、Change Trace、ReleaseとはArtifact Referenceで接続する。

Verification ResultはAcceptanceやRelease Decisionそのものではない。FindingのDispositionとResidual Risk受容は責務を持つCanonical ArtifactまたはChange Traceへ、Release判断はRelease RecordへHuman AuthorityとRationaleを残す。

---

# 3. Guided Skill Adapter

## 3.1. Runtime Authority

`skill.verification.assure`は、本書のPhase Process Contractを[`11_Skill.md`](11_Skill.md)のRun Lifecycle、Guided Interaction、Human Review、Handoffに従って実行するVerification固有Adapterである。本書ではRun Status、Pause / Resume、共通Question Rule、Subagent Lifecycleを再定義しない。

## 3.2. Verification-specific Progression

| Step | Transformation | Output |
|---|---|---|
| Load | Target、Contract、Risk、Implementation Evidenceを対応づける | Verification Coverage Queue |
| Plan | ObligationごとにMethod、Environment、Evidenceを定める | Verification Plan |
| Execute | Test、Review、Observation、Simulation等を実行する | Fresh Evidence |
| Evaluate | Expected / Actual、Coverage、Finding、Residual Riskを判定する | Verification Result |
| Route | Findingを原因工程とHuman Authorityへ返す | Disposition / Fix Route |
| Learn | Outcome、制約、再検証条件を正本へ戻す | Learning / Recommendation |

Test数やPass率だけを進捗とみなさず、Required Responsibility Coverageと対象Scopeで判定する。

## 3.3. Stop, Block, and Escalation

次の場合はPassを推測せず、対象Scopeを`Blocked`または`Not Verified`として返す。

| Condition | Route |
|---|---|
| Target Revision / Artifactを特定できない | Implementation / Release Owner |
| Acceptance / Quality Conditionが不足・矛盾・観測不能 | SPEC / Architecture / Human Decision |
| Environment、Fixture、Permission、Toolが不足 | Environment / Test Owner |
| Production Artifactの修正が必要 | Implementation |
| Coverageまたは上流Contextが不足 | Relevant Phase / Audit |
| Residual Risk、Release例外、条件付き受容が必要 | Human / Release Authority |

## 3.4. Agent and Subagent Use

AgentまたはSubagentへ委譲する場合は[`10_Agent.md`](10_Agent.md)に従い、Contract、UI / Visual、Accessibility、Security、Migration、Load等の限定Scopeを渡す。

Parent AgentはTarget Revision、Expected Contract、Environment、Method、Evidence Requirementを明示し、結果を一つのCoverage Viewへ統合する。Subagentの自己申告、Test Pass、SummaryだけをEvidenceまたはHuman Acceptanceにしない。

---

# 4. Review, Handoff View, and Feedback

## 4.1. Verification-specific Human Review

人間Reviewでは少なくとも次を確認する。

- Target、Contract、Environment、Evidenceが同じ検証対象へ対応している
- Riskに対してMethodとCoverageが十分である
- Human-centered Quality CriteriaのSource / Version / Level / Platform / Scope、Normative / Informative、結果が対応している
- `Failed`、`Blocked`、`Not Verified`、Known Limitationを隠していない
- FindingのSeverity、Impact、Owner、Disposition、再検証条件が明確である
- Residual RiskとRelease RecommendationがEvidenceから説明できる
- Implementation結果をHuman Acceptanceと同一視していない

## 4.2. Verification Result / Handoff View

Artifactの分割方法は固定しないが、対象Scopeについて次を参照可能にする。

```text
Target Scope / Revision / Baseline
Environment / Configuration / Variant / Fixture
Source Contract / Acceptance / Verification Obligation
Human-centered Quality Criteria View / Criterion Result
Method / Procedure / Tool
Coverage State
Expected / Actual / Result
Fresh Evidence / Reproduction
Finding / Severity / Impact / Owner / Disposition
Exception / Authority / Mitigation / Expiry / Recheck Trigger
Unverified Scope / Known Limitation / Residual Risk
Recommendation / Human Decision Required
Learning / Feedback Route / Reverification Condition
Triggered Propagation Check Result / Source Revision / Remediation / Propagation Exception
Phase Transition Review Result / Reviewed Revision / Finding Disposition / Review Exception
```

## 4.3. Feedback and Reverification

Findingは原因に応じてImplementation、Architecture、SPEC、UI、Discovery、Change Trace、Human Authorityへ戻す。修正または基準変更後はTarget RevisionとExpected Contractを更新し、以前のResultを自動的にPassへ変更しない。

同じTargetへ追加Evidenceを得た場合は既存Resultへ追記できる。Target、Acceptance、Environment、Risk条件が意味を変えた場合は、新しいVerification Resultとして旧Resultとの適用関係を明確にする。

Release後のMonitoring、Incident、Support、顧客Feedbackから反証が得られた場合は、過去のVerification Resultを消さず、当時のTarget / Conditionでは成立していたのか、Coverage Gapだったのか、基準が変わったのかを分類して再検証する。

---

# 5. Final Principle

Verificationは、「動いているように見える」を「動くと確認された」へ変換する工程である。

Target、Contract、Environment、Evidence、未保証範囲を結び、実装結果とHuman Acceptanceの間に独立した判断材料を作る。
