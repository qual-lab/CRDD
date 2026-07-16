# CRDD Gap and Impact Audit

Version: v0.4.0
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-17
Related:
- [00_01_Principles.md](00_01_Principles.md)
- [00_02_Terminology.md](00_02_Terminology.md)
- [00_03_Documentation.md](00_03_Documentation.md)
- [00_10_Agent.md](00_10_Agent.md)
- [00_11_Skill.md](00_11_Skill.md)
- [00_12_Change.md](00_12_Change.md)
- [00_19_Maintenance.md](00_19_Maintenance.md)
- [00_24_UI_Behavior_Specification.md](00_24_UI_Behavior_Specification.md)
- [00_51_Document_Audit.md](00_51_Document_Audit.md)
- [00_52_Conformance_Audit.md](00_52_Conformance_Audit.md)

---

# 1. Purpose and Boundary

本書は、変更後も上流Context、専門成果物、Implementation、Verificationの意味的接続を維持するため、Cross-layer Gap ValidationとImpact Analysisを実行するAudit Contractである。

```text
Gap    = 現在のContext、Contract、Relation、Artifact、Evidence間にある欠落・矛盾・古い状態
Impact = 変更によって別Context、Artifact、判断、Releaseへ影響が及ぶ可能性
```

Gap ValidationとImpact Analysisは別々のLifecycleではない。変更または新Evidenceを起点にImpact Candidateを探索し、現在のGapか、変更が必要か、影響がないかを同じAuditで判定する。

```text
Document Audit     = 既知の文書品質と直接Propagation
Phase Audit        = 各工程のEntry、Coverage、Exit、Gate
Conformance Audit  = C / PL / AD CriteriaとClaim Eligibility
Gap / Impact Audit = Relationを横断した意味的Gap、影響候補、再Review範囲
Verification       = Product / Implementationの成立をFresh Evidenceで確認
```

本Auditは変更されたArtifactの一覧作成、全Repositoryの機械的再検証、Canonical Artifactの自動修正、Phase / Release Approvalの代替ではない。

Gap / Impact Audit Runは読取専用である。Finding、Disposition Candidate、Required Update / Review / Verificationを返し、修正と承認はChange、該当工程、Human Authorityが行う。修正後は必要範囲を再監査する。

---

# 2. Audit Model and Authority

## 2.1. Core Principles

- Changed FileだけでImpactを判断しない
- 上流から下流、下流から上流、共通要素・VariantへRelationを探索する
- Relationを候補発見に使い、Relationだけで実影響を断定しない
- Relationがないことを影響なしの根拠にせず、Relation欠落自体をGap候補とする
- 未決、Hypothesis、Recovered Context、Observed Behaviorを確定Contextとして扱わない
- No Impact、Covered、Deferred、Accepted Riskにも理由とAuthorityを残す
- Gapを隠したままPhase Approval、Change Trace Closure、Releaseを行わない
- Risk、共通性、不可逆性、Variant、Release影響に応じて探索範囲を調整する

Gapが見つかることはAudit失敗ではない。Gapを検出・分類し、OwnerとRouteを明らかにすることがAuditの成果である。

## 2.2. Authority Boundary

Audit実行者は、差分抽出、Relation探索、Candidate生成、比較、Gap Type / Impact Level / Dispositionの提案、定義済み基準による低Risk Finding分類を行える。

Humanまたは該当Property Authorityは、価値、Scope、Priority、上位Intent、重要Gapの確定、重要なNo Impact、延期、Risk受容、Contract変更、Phase / Release判断を担う。

Audit実行者は、上流Intentを推測して修正せず、専門Ownerの判断なしにContractを弱めず、Gapを隠すRelationやEvidenceを生成しない。

---

# 3. Input and Output Contract

## 3.1. Input

```text
Audit Trigger and Goal
Active Scope / Out of Scope
Changed Context / Artifact / Relation
Target Revision / Baseline
Applicable Phase Contracts
Change Trace or Review Context
Known Decision / Evidence / Open Gap
Expected Output / Handoff
```

Input不足により意味的影響を判定できない場合、推測で埋めず`Blocked`として不足情報、Owner、Resume条件を返す。

## 3.2. Output

Report全体のAudit Status、共通Finding Fields、Severity、Report Viewは[`00_51_Document_Audit.md`](00_51_Document_Audit.md#3-output)を再利用する。本AuditはFindingへ次を追加する。

| Field | Meaning |
|---|---|
| `gap_type` | Continuity / Coverage / Consistency / Revision / Provenance / Contract / Implementation / Verification / Feedback |
| `impact_level` | L0〜L5 |
| `source_change` | 起点となったContext、Artifact、Relation、Evidence |
| `affected_candidates` | Relation探索で得た影響候補 |
| `disposition` | Update / Review / No Impact / Covered / Deferred / Accepted Risk / Upstream Decision / Out of Scope |
| `affected_authority` | 再判断・修正・承認が必要なProperty / Phase / Human Authority |
| `revalidation` | 修正後に必要なAudit / Review / Verification |

Audit Reportは対象Scope / Revision、探索したRelation、未探索Scope、No Impact Decision、Deferred / Accepted Risk、Affected Phase / Release、Remaining Gapを示す。

Audit Statusは次のように使う。適用Candidateが`No Impact`、`Covered by Existing Contract`、`Resolved`等へ根拠付きで判定され、未処理の重大Gapがなければ`Pass`、未解消GapがOwner・追跡先・Human Authority付きで限定されていれば`Conditional`、未解決Critical / Major Gapまたは正本Conflictがあれば`Fail`、意味的影響を判断できなければ`Blocked`とする。`Conditional`はGap解消やPhase / Release承認を意味しない。

Findingの記録先は原則としてChange Traceまたは対象Canonical Artifactとする。Gap / Impact Audit文書をProject固有の中央台帳にしない。FindingへCRDD標準Stable Context IDを発行せず、Report内Key、Issue、Path、Anchor等で追跡する。

Evidenceは対象Artifact内または最も近い親Folderの`Evidence/`へ置く。重要なDispositionの結果とRationaleは結果となるCanonical Artifact、Change Trace、またはRelease Artifactへ残す。

---

# 4. Scope and Trigger

## 4.1. Validation Scope

対象Scopeは、変更されたContextだけでなく、Relation、共通性、Risk、Variant、Baseline、Release状態から決める。

```text
Origin / Problem / Decision / Evidence
REQ / UX / IA / UI / SPEC
Architecture / Implementation / Configuration
Verification / Acceptance / Quality
Change Trace / Phase Approval / Release / Roadmap
Shared Component / Consumer / Provider / Data / Variant
```

すべての変更で全層を検査しない。対象外にする場合は、意味、Contract、Relation、Behavior、Verificationへ影響しない理由を説明できるようにする。

## 4.2. Trigger

次の場合に対象ScopeとRiskに応じて実行する。

- Origin、Problem、Requirement、UX Outcome、Principleの変更
- IA Object / Responsibility / Navigationの変更
- UI Contract、Behavior Specification、Pair Relationの変更
- 共通Component、Rule、Architecture Boundary、Data / Interfaceの変更
- Feature、Use Case、Variant、Permission、Consumerの追加
- Context、Contract、Artifactの廃止・統合・置換
- 承認後の追加変更、Baseline / Release Scopeの変更
- 法令、Security、Privacy、Compatibility、Capacity条件の変更
- Legacy解析、Prototype、Test、Implementation、Operationからの新Evidence
- Handoff、過去Approval、Change Trace Closure、Release Readinessの再判断

意味に影響しないEditorial Changeでは省略できる。省略はL0相当のNo Impact Decisionとして簡潔に理由を残す。

---

# 5. Gap Types and Impact Dimensions

## 5.1. Gap Types

| Type | Meaning | Example |
|---|---|---|
| Continuity | 上流の意味が下流へ変換されない、または遡れない | UX Outcomeを実現するUI / Featureが不明 |
| Coverage | 必要なContext、State、Exception、Variant、Testがない | SuccessだけでFailure / Recoveryがない |
| Consistency | 同じ対象についてArtifact間のMeaningが異なる | UIは取消可、SPECは取消不可 |
| Revision | Revision、Version、Baselineが揃っていない | TestがSuperseded Acceptanceを検証 |
| Provenance | Source、Confidence、Fact / Hypothesis境界が不明 | Recovered Intentを確定Whyとして扱う |
| Contract | Property間の対応が不足・矛盾する | UI ActionにSPEC Triggerがない |
| Implementation | Contract / ArchitectureとCode / Configurationが異なる | 未承認Fallbackを実装している |
| Verification | AcceptanceとTest / Evidenceの対象が一致しない | Pass Evidenceが現行Revisionでない |
| Feedback | 下流のLearningが必要な上流Contextへ戻っていない | 技術制約がArchitectureだけに残る |

一つのFindingに複数Typeが該当してよい。Typeを増やすより、原因、影響、Return Routeを明確にする。

## 5.2. Impact Dimensions

少なくとも次を適用範囲で確認する。

| Dimension | Review Focus |
|---|---|
| Intent / Scope | Origin、Actor、Value、Non-goal、Feature、Release範囲 |
| Information / Interaction | Object、Navigation、Action、Feedback、State、Permission |
| Behavior / Contract | Condition、Rule、Result、Failure、Compatibility |
| Architecture / Data | Boundary、API、Data Meaning、Security、Migration、Dependency |
| Implementation / Shared | Code、Configuration、Build、共通Component / Service、Consumer |
| Variant | Role、Tenant、Brand、Platform、Locale、Provider |
| Capacity / Quality | Traffic、Latency、Resource、Availability、Accessibility、Safety、Cost |
| Verification | Acceptance、Test、Evidence、Environment、Review Scope |
| Delivery / Authority | Phase Approval、Change Trace、Release、Schedule、Owner、Risk |
| Learning | Decision、Canonical Context、Roadmapへ戻すべき知見 |

---

# 6. Relation Traversal and Phase Sources

## 6.1. Standard Directions

```text
Origin / Evidence / Decision -> REQ -> UX -> IA -> UI / SPEC
UI <-> SPEC Pair
UI / SPEC -> Architecture -> Implementation -> Verification
Implementation / Verification / Operation -> affected upstream Context
Change Trace -> Phase Approval / Release / Roadmap
Shared Element -> Consumer / Variant / Feature
```

矢印は固定工程順ではない。変更またはEvidenceが下流から発生した場合は逆方向へ確認する。Stable Context ID、Semantic Relation、Artifact Reference、Change Trace / Commit、Test Result、Owner情報を組み合わせて候補を探索する。

## 6.2. Traversal Rules

1. Changed Entity / Relation / Artifactと変更前後のMeaningを特定する
2. Direct Relationを上下流へたどる
3. Shared Element、Consumer、Variant、Baselineへ横断する
4. Relation欠落、古いRevision、未接続ArtifactをGap Candidateへ追加する
5. Candidateごとに実影響とDispositionを判定する

Relationがある対象をすべて変更せず、同じContract内で吸収できるか確認する。Relationがない場合も、Naming、Interface、Data、Runtime Evidence等から暗黙依存を調べる。

## 6.3. Phase-specific Audit Sources

本Auditは工程固有のCoverageや品質条件を再定義しない。対象Scopeに応じ、各正本の`Required Responsibility Coverage`、`Phase Gate Criteria`、`Phase Audit Checklist`を読み、Boundary間の意味を比較する。

| Boundary | Authoritative Audit Source |
|---|---|
| Origin / Problem → UX | [Discovery](00_21_Discovery.md#phase-audit-checklist)、[UX](00_22_UX.md#phase-audit-checklist) |
| UX → IA | [UX](00_22_UX.md#phase-audit-checklist)、[IA](00_23_IA.md#phase-audit-checklist) |
| IA → UI / SPEC | [IA](00_23_IA.md#phase-audit-checklist)、[UI](00_25_UI.md#phase-audit-checklist)、[SPEC](00_26_Behavior_Specification.md#phase-audit-checklist) |
| UI ⇄ SPEC | [Pair Contract](00_24_UI_Behavior_Specification.md#27-pair-audit-checklist) |
| UI / SPEC → Architecture | [UI](00_25_UI.md#phase-audit-checklist)、[SPEC](00_26_Behavior_Specification.md#phase-audit-checklist)、[Architecture](00_27_Architecture.md#phase-audit-checklist) |
| Architecture → Implementation | [Architecture](00_27_Architecture.md#phase-audit-checklist)、[Implementation](00_28_Implementation.md#phase-audit-checklist) |
| Implementation → Verification | [Implementation](00_28_Implementation.md#phase-audit-checklist)、[Verification](00_29_Verification.md#phase-audit-checklist) |
| Compatibility / Migration / Capacity | [SPEC](00_26_Behavior_Specification.md#phase-audit-checklist)、[Architecture](00_27_Architecture.md#phase-audit-checklist)、[Verification](00_29_Verification.md#phase-audit-checklist) |
| Implementation / Evidence → Upstream | [Principles](00_01_Principles.md)、[Change](00_12_Change.md)、該当工程正本 |

Findingには使用した正本条件とRevisionを記録する。Phase Approvalは本Auditが行わず、Gap / Impact Resultを該当GateのInputとして返す。

---

# 7. Evaluation

## 7.1. Disposition

| Disposition | Meaning | Authority Boundary |
|---|---|---|
| `Update Required` | Context、Artifact、Contract、Test等の変更が必要 | 対象Property Authority |
| `Review Required` | 専門Ownerの判断が必要 | 専門Owner / Human |
| `No Impact` | 意味上の影響がない | 重要ScopeではHuman Review |
| `Covered by Existing Contract` | 現行Contract内で成立する | Contract Authorityを確認 |
| `Deferred` | 後続Change / Releaseへ送る | Priority / Release Authority |
| `Accepted Risk` | Gapを理解して一時的に受容する | Human Authority必須 |
| `Upstream Decision Required` | 下流では決められない | 上流Property Authority |
| `Out of Scope` | 今回のScope外 | 追跡先とOwnerを判定 |

`No Impact`と`False Positive`を混同しない。No Impactは変更候補を評価した結果、False PositiveはGap / Impact Candidate自体が成立しなかった結果である。

## 7.2. Impact Level

| Level | Meaning | Review Guidance |
|---|---|---|
| `L0 None` | 意味、Contract、Implementation、Verificationへ影響なし | 省略理由またはNo Impactを残す |
| `L1 Local` | 単一Context / Artifact内 | 対象ArtifactとDirect Relation |
| `L2 Cross-artifact` | 同一専門層または複数Artifact | 利用先、共通要素、関連Test |
| `L3 Cross-layer` | 複数工程・Property | 上下流、Pair、Architecture、Verification |
| `L4 Baseline / Release` | Baseline、共通Contract、複数Feature、Release | Approval、Variant、Migration、Release再評価 |
| `L5 Critical` | Origin、Safety、Security、法令、不可逆Data、重大品質 | 作業停止を含むHuman Decisionと独立Review |

Impact Levelは工数やFinding Severityと別の軸である。小さなCode変更でも、Authority、Safety、不可逆処理へ影響すれば高Levelになり得る。

## 7.3. Finding Lifecycle

| Status | Meaning |
|---|---|
| `Candidate` | 未確認のGap / Impact候補 |
| `Under Review` | 実影響とAuthorityを確認中 |
| `Confirmed` | GapまたはImpactとして確認済み |
| `False Positive` | Candidateが成立しなかった |
| `Routed` | Owner、Change Trace、Phase、Release等の対応先へ引き渡した |
| `Resolved` | 必要な変更と再検証が完了した |
| `Superseded` | 後続FindingまたはChangeに置換された |

`Deferred`と`Accepted Risk`はFinding StatusではなくDispositionである。延期またはRisk受容後も、Findingの対象、Authority、追跡先、期限、再評価Triggerを保持する。

---

# 8. Audit Procedure

```text
1. Trigger、Goal、Scope、Revision、Baselineを固定する
2. Changed Meaningと変更していない保証範囲を特定する
3. Applicable Phase SourcesとRelationを選ぶ
4. 上下流、Shared、Variant、Release方向へCandidateを探索する
5. CandidateをGap Type、Impact Dimension、Levelで分類する
6. Actual Impact、Disposition、Authority、Ownerを判定する
7. Required Update / Review / Verificationと再評価条件を定める
8. Audit Status、Finding、No Impact、未探索Scopeを返す
```

Audit実行者は修正を同じAudit Pass内で行わない。Remediation後は、Target Revisionを更新し、Relation、Phase Gate、Verification、Learningへの反映を再監査する。

---

# 9. Change Trace, Phase, Release, and Roadmap Integration

## 9.1. Change Trace

非自明な変更では、Gap / Impact Resultを[`00_12_Change.md`](00_12_Change.md)のChange Traceへ接続する。

```text
Changed Context / Meaning
Impact Candidate / Confirmed Impact
No Impact / Existing Contract Decision
Required Update / Review / Verification
Deferred Scope / Accepted Risk
Affected Phase / Approval / Release
Owner / Revalidation / Closure Evidence
```

Auditが独立Reportを返しても、FindingのDispositionと実行結果はChange Traceまたは対象Canonical Artifactへ還元する。

## 9.2. Phase Approval and Reopening

次の場合は、対象Scope / Revisionについて過去のPhase Decisionを再評価する。

- 承認済みContextのMeaningが変わった
- UI / SPEC PairにConfirmed Gapがある
- Architectureが上位Contractを満たせない
- AcceptanceまたはVerification Scopeが変わった
- 新Evidenceが重要Assumptionを反証した
- BaselineまたはRelease Scopeへ波及した

すべてのGapでPhaseをReopenしない。既存Exit / Gateと承認判断へ影響しない場合は、理由とAuthorityを残して維持できる。

## 9.3. Discovery and Roadmap Boundary

`01_Discovery`は顧客Feedback、法令変更、明確な仕様変更、不具合、曖昧な要求等を分類し、Requirementと判断を確定する正本領域である。Impact Auditは下流差分から新しいRequirementを創作せず、Sourceと判断が不足する場合はDiscoveryへ戻す。

`99_Roadmap`は、採用済みだが今回実行しないDeferred WorkのPriority、Target、Dependency、着手条件を扱う。Roadmap項目をRequirement、SPEC、Decisionの正本にしない。

```text
Source / Evidence
-> DiscoveryでRequirementまたはChangeを判断
-> 今回実行するScopeはChange / Phaseへ
-> 採用済みDeferred WorkだけをRoadmapへ
-> 着手時にCanonical Contextと現行Impactを再確認
```

`Out of Scope`や`Deferred`を追跡先なしでRoadmapへ送らない。Owner、理由、Source Context、再評価Triggerを持たせる。

## 9.4. Closure

ChangeまたはFindingをCloseする前に、必要な正本・Relation・Implementation・Verificationが更新され、Fresh Evidence、Deferred Scope、Accepted Risk、Learningが追跡可能か確認する。Merge、Build、Ticket完了だけをClosure Evidenceにしない。

---

# 10. Legacy / Brownfield

Legacyでは次を分離する。

```text
Documented Behavior
Implemented Behavior
Observed Runtime Behavior
Operational Practice
Expected Behavior Candidate
Recovered Intent Candidate
```

現在動くCodeや古い文書を自動的に正本としない。差異をObservation、Candidate、Confirmed Contract、Bug、Debt、Unknownへ分類し、Source、Confidence、Compatibility、Human Decisionを保持する。

すべてのGapを一度に解消せず、Safety / Security / Data Risk、重大不具合、変更予定Scope、Shared Service、運用依存、将来変更を妨げるBoundaryを優先する。未解消GapはOwnerと追跡先を持つDeferred ScopeまたはDebtとする。

---

# 11. Compact Operation

小規模変更では独立Reportを作らず、Change Trace、Issue、Pull Request等の既存Artifactへ次を残してよい。

```text
Changed Context / Revision
Reviewed Relations / Scope
Impact / No Impact and Rationale
Action / Review / Verification Handoff
Remaining Gap / Owner
Evidence / Re-audit Result
```

Artifactを短くすることは、Trace、Authority、未解決事項を省略することではない。`40_Develop`へCRDD管理用Markdownを新設しない。

---

# 12. Anti-patterns

| Anti-pattern | Problem |
|---|---|
| Changed File List Only | File差分と意味的Impact Scopeを同一視する |
| Relation Equals Impact | Relation先をすべて変更対象とする |
| No Relation Equals No Impact | Relation欠落の可能性を無視する |
| Update Everything | Riskに関係なく全Artifactを同期し、運用を形骸化させる |
| Fix Downstream Silently | 実装都合で上位Contractを無言変更する |
| Pass Means Aligned | 古いAcceptanceや限定ScopeのTest Passを全体整合とみなす |
| Ignore No-impact Decision | 同じ調査を繰り返し、判断理由を失う |
| Hide Deferred Gap | Owner・追跡先なしでChangeをCloseする |

---

# 13. Audit Completion and Gap Closure

## 13.1. Audit Run Completion

次を満たしたとき、Gap / Impact Audit Runを完了できる。

- Trigger、Scope、Revision、Baseline、適用Sourceが特定されている
- 探索したRelationと未探索Scopeが明示されている
- CandidateにResult、Disposition Candidate、`Not Evaluated`、またはBlocking理由がある
- Confirmed FindingにImpact、Authority、Owner、Required Actionがある
- No Impact / CoveredにRationaleがある
- Deferred / Accepted Riskに追跡先とHuman Authorityがある
- Revalidation、Recommended Handoff、Audit Statusが示されている

Confirmed Gapや未完了Remediationがあっても、必要なFindingを返せばAudit Runは完了できる。

## 13.2. Finding / Change Trace Closure

FindingまたはChangeを`Resolved` / Closedにするには、適用範囲で次を満たす。

- 必要なCanonical Context、Contract、Artifact、Relationが更新されている
- 必要なPhase Decision、Handoff、Release Scopeが再評価されている
- ImplementationとVerificationが現行Revisionへ対応している
- Fresh Evidenceで解消状態を確認している
- Deferred Scope、Accepted Risk、Remaining Gapが追跡可能である
- Learningを該当Canonical Contextへ戻している

完全なGapゼロを常に要求しない。残るGap、Risk、不確実性にScope、Owner、Authority、期限または再評価Triggerが必要である。

---

# 14. Audit Execution and Delegation

Skill Runとして実行する場合は[`00_11_Skill.md`](00_11_Skill.md)、Agent / Subagentへ委譲する場合は[`00_10_Agent.md`](00_10_Agent.md)に従う。本書独自のAgent Lifecycleを作らない。

```text
Load Change Trace / Scope / Revision
Identify Changed Meaning and Relations
Traverse Candidates
Evaluate Gap / Impact / Disposition
Return Finding / Authority / Revalidation
Remediate outside Audit Run if authorized
Re-audit affected Scope
```

Parent AgentはSubagentごとのScope、Relation方向、使用する正本、Expected Outputを指定し、重複Candidate、Conflict、Impact Level、Authorityを統合する。Subagent ResultをそのままGap確定、No Impact、Risk受容、Phase / Release判断にしない。

---

# 15. Final Principle

Gap / Impact Auditは、変更されたファイルではなく、変更後もContextの意味が上下流・横断方向へ接続されているかを確認する。

Relationで候補を広く見つけ、AuthorityとEvidenceで実影響を絞り、必要な範囲だけを再設計・再承認・再検証する。
