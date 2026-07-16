# CRDD Agent Input / Output Contract

Version: v0.1.0
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-16
Related:
- [00_02_CRDD_Core_Concepts_and_Terminology.md](00_02_CRDD_Core_Concepts_and_Terminology.md)
- [00_03_CRDD_Conformance.md](00_03_CRDD_Conformance.md)
- [00_13_Human_AI_Responsibility.md](00_13_Human_AI_Responsibility.md)
- [00_14_AI_Change_Control.md](00_14_AI_Change_Control.md)
- [00_16_Context_Transformation.md](00_16_Context_Transformation.md)
- [00_17_Discovery.md](00_17_Discovery.md)
- [00_18_UI_Behavior_Contract.md](00_18_UI_Behavior_Contract.md)
- [00_19_Context_Traceability.md](00_19_Context_Traceability.md)
- [00_23_Phase_Gate_Approval.md](00_23_Phase_Gate_Approval.md)
- [00_24_Change_Context_Package.md](00_24_Change_Context_Package.md)
- [00_25_Gap_Validation_Impact.md](00_25_Gap_Validation_Impact.md)
- [00_30_Product_Documentation.md](00_30_Product_Documentation.md)
- [00_31_Subagent_Practice.md](00_31_Subagent_Practice.md)

---

本書で使用するCore Concept、Canonical Term、責務・Authorityの定義は、[`00_02_CRDD_Core_Concepts_and_Terminology.md`](00_02_CRDD_Core_Concepts_and_Terminology.md)を正本とし、本書では再定義しない。

# Purpose

本ドキュメントは、CRDDにおいてAI Agentまたは人間の専門担当が作業を行う際のInput、Output、Authority、停止条件、拒否条件、Review条件を定義する。

CRDDでは、Agentの専門性や生成能力だけでは、End-to-End Context Continuityは保証できない。

同じAgentであっても、与えられるContext、対象Revision、変更境界、期待Output、承認権限が曖昧であれば、次の問題が発生する。

```text
不足したContextをAIが推測で補う
上流Intentを知らずに局所最適化する
別RevisionのContextを混在させる
UX AgentがSPECを確定する
UI AgentがBehaviorを無言で変更する
Implementation AgentがRequirementを弱める
Reviewerが作成者の前提をそのまま引き継ぐ
完了条件が不明なまま成果物を提出する
```

Agent Contractは、このような責務混同とContext欠落を防ぐ。

本標準の目的は、Agentを細かく分業すること自体ではない。

```text
誰が作業しても
何を根拠に
どこまで判断し
何を成果として返し
何を人間または別専門領域へ戻すか
```

を明確にすることにある。

---

# 1. Basic Principle

CRDD Agentは、以下の原則に従う。

```text
Inputにない重要情報を、確定事項として創作しない。
対象Scope、Revision、Baselineを確認してから作業する。
上流IntentとPreserved Contextを最初に読む。
自分の専門責務を越える重要判断を自己承認しない。
不足Context、矛盾、Riskを隠して成果物を完成扱いにしない。
Outputは次の担当が利用できる構造で返す。
推測、提案、決定、観察事実を区別する。
変更したContextと、変更していないContextを明示する。
完了宣言にはFresh EvidenceまたはReview可能な根拠を伴わせる。
学びとGapをContext Repositoryへ戻す。
```

Agentは、単に文章やCodeを生成する実行者ではない。

```text
Contextを理解し
専門観点で変換し
不確実性を明示し
次の判断へ渡す
```

責任を持つ。

---

# 2. Agent Contract Model

各Agent Contractは、最低限以下を持つ。

```yaml
agent_contract:
  agent_type: UI
  purpose: >
    IAとUX Intentを、利用者が認識・操作・理解できる
    UI Contractへ変換する。
  input:
    required:
      - active_scope
      - active_revision
      - source_context
      - preserved_intent
      - change_boundary
    optional:
      - reference_artifacts
      - prior_decisions
      - research_evidence
  authority:
    may_decide:
      - layout_hierarchy
      - interaction_feedback
    must_escalate:
      - behavior_rule_change
      - origin_tradeoff
  output:
    required:
      - transformed_context
      - trace_relations
      - open_questions
      - confidence
      - handoff_obligations
  reject_conditions:
    - source_context_missing
    - conflicting_approved_revision
  completion:
    - output_reviewable
    - trace_updated
```

実装形式はYAMLに限定しない。

Markdown、JSON、Database、Agent Skill定義等でもよいが、意味上の項目を保持する。

---

# 3. Common Required Input

すべての重要Agent作業では、少なくとも以下をInputとして与える。

## 3.1. Active Scope

```text
対象Product
対象Feature / Use Case / User Action
対象Change Package
対象Release
対象Variant
対象外Scope
```

## 3.2. Active Revision / Baseline

```text
参照すべきContext Revision
参照すべきArtifact Version
有効なGate状態
Approved / Fixed / Draftの区別
```

複数Revisionを混在させる場合、その理由と優先関係を明示する。

## 3.3. Source Context

作業の根拠となるContext。

例:

```text
Origin
Problem
UX Outcome
IA Structure
UI Contract
Behavior Requirement
Architecture
Decision
Evidence
```

## 3.4. Preserved Intent

今回の作業で、下流都合によって失ってはならないもの。

```text
守るべき価値
避けるべき体験
必須Outcome
重要な非機能要件
変更禁止のBusiness Rule
```

## 3.5. Change Boundary

```text
変更してよいもの
変更してはいけないもの
提案はできるが承認が必要なもの
今回対象外だが影響候補となるもの
```

## 3.6. Known Uncertainty

```text
Open Question
Assumption
Hypothesis
Recovered Context
Confidence
Unverified Evidence
```

不確実性をInputから消してはならない。

## 3.7. Expected Output

```text
必要な成果物
必要な粒度
必要なRelation
必要なReview
必要なEvidence
次のHandoff先
```

---

# 4. Common Required Output

すべての重要Agent作業では、最低限以下を返す。

## 4.1. Produced or Updated Context

```text
新規作成したContext
更新したContext
変更しなかったContext
廃止または置換候補
```

## 4.2. Transformation Summary

```text
何をInputとして受けたか
何を保持したか
何を具体化したか
何を変更したか
何を判断できなかったか
```

## 4.3. Trace Relations

```text
derived_from
realizes
supports
structures
presents
defines_behavior_for
pairs_with
constrains
implemented_by
verified_by
supersedes
```

必要なRelationを追加または更新する。

## 4.4. Open Questions and Risks

```text
未決事項
不足Evidence
矛盾
Risk
専門OwnerへのEscalation
Gateへの影響
```

## 4.5. Confidence and Provenance

```text
事実
解釈
仮説
AI推定
Recovered Candidate
Confidence
Source
```

## 4.6. Handoff Obligations

次の担当が必ず確認または実施すべきこと。

```text
次工程で確定すべき内容
変更してはいけないIntent
必要なReview
必要なTest
必要なDecision
```

## 4.7. Completion Evidence

```text
比較結果
Review結果
Validation結果
Test結果
Prototype結果
未解消項目一覧
```

成果物が存在することだけを完了根拠にしない。

---

# 5. Authority Model

AgentのAuthorityは、以下の3段階に分ける。

## 5.1. May Decide

Agentが専門責務の範囲で決定できる。

例:

```text
UI AgentがVisual Hierarchy候補を決める
Architecture Agentが承認済みContract内の技術構成を選ぶ
Implementation Agentが局所的な内部実装を選ぶ
```

## 5.2. May Propose

Agentは提案できるが、確定には人間または別Authorityの承認が必要。

例:

```text
UX Outcomeの変更
Feature Scopeの変更
REQのBusiness Rule変更
Security Riskの受容
Release延期
```

## 5.3. Must Escalate

Agentが自律判断してはならない。

例:

```text
OriginまたはPrincipleを弱める
承認済みContractを破る
不可逆Data変更を行う
重要な安全・法令・Security Riskを受容する
対象外Scopeを無断で変更する
人間のDecisionを上書きする
```

AuthorityはAgent名だけで決めない。

同じAgentでも、Project、Artifact、Change、GateによってAuthorityが変わる。

---

# 6. Stop, Reject, and Escalate

Agentは、作業を続けることよりも止めることが正しい場合がある。

## 6.1. Stop Condition

作業途中で停止し、追加確認を求める条件。

```text
Preserved Intentと要求された変更が矛盾する
複数のApproved Revisionが競合する
重大なSecurity、Safety、Data Riskを発見した
変更境界を越えないと成立しない
必要な専門判断が不足している
前提となるContextが変更された
```

## 6.2. Reject Condition

依頼をそのまま実行してはならない条件。

```text
対象ScopeまたはRevisionが不明
重要なSource Contextがなく、推測だけで成果物を作ることになる
承認済みDecisionと明確に矛盾する
人間Authorityなしに重要なRisk受容を要求される
Evidence偽装または成功偽装を要求される
```

Rejectは依頼を放棄することではない。

次を返す。

```text
実行できない理由
不足しているContext
安全に進めるための最小条件
代替可能な作業
上流へ戻すべきDecision
```

## 6.3. Escalation Condition

```text
専門領域間で判断が割れる
Trade-offがProduct価値へ影響する
複数FeatureまたはReleaseへ波及する
GateのReopenが必要
外部Authorityの承認が必要
```

Escalation先、必要なDecision、期限またはGate影響を明示する。

---

# 7. Discovery Agent Contract

## Purpose

人間の原始的な思い、観察、課題、仮説を失わず、次の専門活動へRoutingできるContextへ整理する。

## Required Input

```text
人間の発言、メモ、資料、観察
既知のEvidence
既存Context
Legacyの場合はCode、挙動、運用、文書
```

## May Decide

```text
情報の分類
不足質問の優先順位
次に必要な活動候補
```

## Must Not Decide

```text
人間のOrigin
Productの最終価値
未確認のWhy
Feature Scopeの最終確定
```

## Required Output

```text
Origin / Intent Candidate
Problem
Desired Outcome
Evidence
Interpretation
Hypothesis
Solution Candidate
Open Question
Recommended Route
Confidence
Raw Voice Reference
```

## Reject / Stop

```text
AIがWhyを創作しなければ成立しない
人間の原始的な発言が保存されていない
Evidenceと解釈を分離できない
```

---

# 8. UX Agent Contract

## Purpose

Origin、Problem、Evidenceを、利用者にもたらすOutcome、体験原則、成功状態へ変換する。

## Required Input

```text
Origin
Problem
Target User / Actor
Evidence
Desired Outcome Candidate
Constraint
Non-goal
```

## May Decide

```text
UX Outcomeの表現候補
Journey上の主要なPain / Moment
Experience Principle候補
検証仮説
```

## Must Escalate

```text
対象Userの変更
解決すべきProblemの変更
Business Priorityの変更
OriginまたはPrincipleのTrade-off
```

## Required Output

```text
UX Outcome
Experience Principle
User Journey / Scenario
Success Signal
Avoided Experience
Assumption
Validation Need
Trace to Origin / Problem
Handoff to IA / Feature
```

## Reject / Stop

```text
Target UserまたはProblemが特定できない
Solutionが先に固定され、Outcomeを検討できない
人間の価値判断なしにUX原則を確定する必要がある
```

EARS構文はUX OutcomeやExperience Principleの主要記述には使用しない。

---

# 9. IA Agent Contract

## Purpose

UX OutcomeとFeature Contextを、利用者が理解可能なObject、責務、分類、Navigation、関係へ構造化する。

## Required Input

```text
UX Outcome
Feature / Use Case
主要Actor
Domain Context
既存Object / Data
Known Constraint
```

## May Decide

```text
Object Model候補
Information Grouping
Navigation Structure
Responsibility Boundary
Taxonomy候補
```

## Must Escalate

```text
Business Conceptの意味変更
Feature Scope変更
User Mental ModelとSystem制約の重大Conflict
新しいAuthorityまたはOwnershipの必要
```

## Required Output

```text
Object / Entity
Relationship
Responsibility
Lifecycle概念
Navigation
Grouping
Naming Rationale
Expected UI / REQ Obligation
Trace to UX / Feature
```

## Reject / Stop

```text
UX Outcomeが不明
同一概念に複数の矛盾した定義がある
System都合だけで利用者向け構造を決める必要がある
```

---

# 10. UI Agent Contract

## Purpose

UXとIAを、利用者が認識、操作、理解、回復できるUI Contractへ変換する。

## Required Input

```text
UX Outcome
IA Structure
Feature / Use Case / User Action
Behavior Context
Brand / Platform / Accessibility Constraint
Existing Component / Pattern
```

## May Decide

```text
Visual Hierarchy
Information Placement
Interaction Flow
Feedback表現
Component利用
Responsive / Variant表現候補
```

## Must Escalate

```text
Behavior Rule変更
Permission Rule変更
Data Lifecycle変更
UX Outcomeを弱めるTrade-off
新しいFeature Scope
```

## Required Output

```text
UI Contract
Action
Visible State
Feedback
Loading
Empty
Error
Permission
Cancel / Undo / Retry
Accessibility Consideration
Figma / Prototype Reference
pairs_with候補
Trace to IA / UX / Use Case
```

## Reject / Stop

```text
主要Behaviorが不明
UIでSystem Ruleを推測しないと成立しない
IA責務が不明で画面へすべて押し込む必要がある
```

UI Contract自体をEARSへ圧縮しない。

---

# 11. Behavior / SPEC Agent Contract

## Purpose

Feature、Use Case、UI Contract、Domain Ruleを、検証可能なCondition、State、Behavior、Exception、Acceptance Criteriaへ変換する。

## Required Input

```text
Feature / Use Case / User Action
IA Object / Lifecycle
UI Contract
Business Rule
Permission
Constraint
Non-functional Requirement
```

## May Decide

```text
Requirement分解
Condition整理
State Transition表現
Exception分類
EARS記述
Acceptance Criteria候補
```

## Must Escalate

```text
Business Rule変更
UX / UI ContractとのTrade-off
新しいAuthorityまたはPermission
Scope、Priority、Risk受容
```

## Required Output

```text
REQ ID
Behavior Requirement
Condition
Trigger
State Transition
Output
Failure / Exception
Permission
Acceptance Criteria
pairs_with UI
verified_by候補
Open Question
```

## Reject / Stop

```text
UI Actionと期待Behaviorが矛盾する
Business RuleのAuthorityが不明
検証不能な曖昧要求しか作れない
```

EARS等の構文は、Behavior、Exception、Acceptance Criteriaで推奨する。

---

# 12. Architecture Agent Contract

## Purpose

承認済みのUX、UI、REQ、Quality Attributeを、現在の技術と制約で成立させるArchitectureへ変換する。

## Required Input

```text
Approved or Accepted Contract
Quality Attribute
Security / Privacy Requirement
Data Requirement
Integration Constraint
Deployment / Operation Context
Existing Architecture
```

## May Decide

```text
Component Boundary
API / Data設計
Technology Candidate
Failure Boundary
Migration Approach候補
Observability設計
```

## Must Escalate

```text
上流Contractを満たせない
不可逆Migration
重大Security / Privacy Risk
Product Scope変更
大きなCost / Schedule Trade-off
```

## Required Output

```text
Architecture Decision
Component / Service Boundary
Data Flow
API Contract
Failure / Recovery
Security Boundary
Migration
Operational Requirement
Implementation Constraint
Trace to REQ / UI / UX
```

## Reject / Stop

```text
承認対象Revisionが不明
Requirementを無言で弱めないと成立しない
重要なQuality Attributeが未定義
```

Architectureは現在の実現方法であり、OriginやUXの恒久的正本ではない。

---

# 13. Planning Agent Contract

## Purpose

承認済みContextとArchitectureを、依存関係、境界、Verificationを持つ実行可能なDelivery Planへ変換する。

## Required Input

```text
Change Package
Context Package
Approved Contract
Architecture
Impact Analysis
Available Resource / Schedule
Gate Condition
```

## May Decide

```text
Task分解
Execution Order
Dependency
Parallelization候補
Verification Point
Context Package分割
```

## Must Escalate

```text
Scope削減
Release延期
Risk受容
上流Contract変更
Authority不足
```

## Required Output

```text
Task
Boundary
Dependency
Required Context
Expected Output
Verification
Owner
Stop Condition
Rollback / Recovery
```

## Reject / Stop

```text
TaskがContractへTraceできない
完了条件が定義できない
変更境界が不明
```

---

# 14. Implementation Agent Contract

## Purpose

承認済みContractとArchitectureを、変更境界内でCode、Configuration、Migration等へ実装する。

## Required Input

```text
Task
Change Boundary
Active Revision
Approved Contract
Architecture
Coding / Repository Rule
Test / Verification Requirement
```

## May Decide

```text
局所的な内部実装
承認済みBoundary内のCode構造
低RiskなRefactoring
Test実装方法
```

## Must Escalate

```text
Requirement変更
Architecture Boundary変更
新しい外部Dependency
不可逆Data変更
Security Rule変更
Scope外変更
```

## Required Output

```text
Code / Configuration / Migration
Changed File / Module
Implemented Requirement
Deviation
Test
Evidence
Known Limitation
Handoff to Reviewer
```

## Reject / Stop

```text
ContractとArchitectureが矛盾する
安全にTestできない
対象外変更なしでは成立しない
必要なSecretまたは権限がない
```

Implementation Agentは、動くCodeを理由に上流Contractを置き換えてはならない。

---

# 15. Review Agent Contract

## Purpose

作成者とは可能な限り独立したContextで、成果物がInput Contract、Boundary、Trace、Quality、Verificationを満たすか確認する。

## Required Input

```text
Review Target
Expected Contract
Active Revision
Change Boundary
Acceptance Criteria
Known Risk
Prior Decision
```

Review Agentには、作成者の詳細な思考過程を必須Inputとしない。

必要なのは成果物、契約、根拠、変更記録である。

## May Decide

```text
Finding分類
Gap候補
修正要求
追加Verification要求
Review Pass候補
```

## Must Escalate

```text
価値判断
Risk受容
Scope変更
Contract変更
Gate最終承認
```

## Required Output

```text
Reviewed Scope
Finding
Severity / Impact
Evidence
Pass / Conditional / Fail Recommendation
Required Fix
Residual Risk
Gate Effect
```

## Reject / Stop

```text
Expected Contractが不明
Review対象Revisionが固定されていない
Evidenceへアクセスできない
```

独立Reviewでは、作成者の前提をそのまま信頼しない。

---

# 16. Validation Agent Contract

## Purpose

Acceptance Criteriaと現在のRevisionに対して、成果物または実装が成立していることをFresh Evidenceで確認する。

## Required Input

```text
Acceptance Criteria
Target Revision
Target Variant
Environment
Expected Result
Known Limitation
```

## May Decide

```text
Validation Procedure
Evidence取得方法
Test Case追加
Failure分類候補
```

## Must Escalate

```text
Acceptance Criteria変更
Risk受容
Environment差異の無視
Test不能なContract
```

## Required Output

```text
Validation Result
Evidence
Environment
Revision
Pass / Fail / Blocked
Observed Difference
Reproduction
Recommended Disposition
```

## Reject / Stop

```text
対象Revisionを確認できない
Expected Resultが曖昧
Evidenceを再現できない
環境差異が重大
```

Testが通ることと、Product Outcomeが達成されたことを同一視しない。

---

# 17. Learning / Promotion Agent Contract

## Purpose

Discovery、設計、実装、検証、運用で得た学びを、適切なContextへPromotionする。

## Required Input

```text
Evidence
Finding
Decision
Change Package
Validation Result
Operational Observation
```

## May Decide

```text
Promotion先候補
重複Context候補
Knowledge分類
更新提案
```

## Must Escalate

```text
Origin変更
UX Principle変更
Ruleの正式化
既存Decisionの置換
Roadmap Priority変更
```

## Required Output

```text
Learning
Source Evidence
Affected Context
Promotion Proposal
Confidence
Required Human Decision
Updated Trace
```

## Reject / Stop

```text
単一事例を一般Ruleへ昇格する
Source Evidenceがない
AI推定を実証済みLearningとして扱う
```

---

# 18. Multi-role Agent

一つのAgentが複数Roleを担当してもよい。

例:

```text
UX + IA Agent
UI + SPEC Agent
Architecture + Planning Agent
Implementation + Test Agent
```

ただし、Role統合時もContract上の責務を消してはならない。

```text
どのRoleとして何を判断したか
どのOutputがどの専門責務に属するか
どの判断が別Authorityを必要とするか
```

を明示する。

重要変更では、作成とReviewを可能な限り分離する。

同一Agentが作成とReviewを行う場合は、Fresh Contextまたは独立したReview Passを設ける。

---

# 19. Context Package per Agent

すべてのAgentへRepository全体を無条件に渡す必要はない。

Agentごとに必要なContext Packageを構成する。

## Discovery Agent

```text
Raw Input
Existing Origin / Problem
Relevant Evidence
Known Decision
Legacy Evidence
```

## UX Agent

```text
Origin
Problem
User Evidence
Constraint
Existing UX
```

## IA Agent

```text
UX
Feature / Use Case
Domain Object
Existing IA
Relevant Constraint
```

## UI Agent

```text
UX
IA
Use Case
Relevant REQ
Pattern / Component
Platform Constraint
```

## SPEC Agent

```text
Use Case
IA Lifecycle
UI Contract
Business Rule
Permission
Quality Constraint
```

## Architecture Agent

```text
Approved REQ
UI Contract
Quality Attribute
Security / Integration
Existing Architecture
```

## Implementation Agent

```text
Task
Approved Contract
Architecture Boundary
Repository Rule
Relevant Code
Test Requirement
```

## Review Agent

```text
Review Target
Expected Contract
Boundary
Acceptance Criteria
Known Risk
```

Context Packageは正本の複製ではなく、対象Revisionへの参照を持つ。

---

# 20. Agent Result Status

Agent Resultには、以下のStatusを使用できる。

| Status | Meaning |
|---|---|
| `Completed` | 契約されたOutputと終了条件を満たした |
| `Completed with Open Questions` | 作業は完了したが、明示された未決がある |
| `Conditional` | 条件付きで次へ渡せる |
| `Blocked` | 外部判断または不足Contextにより停止 |
| `Rejected` | 現在の依頼条件では安全に実行できない |
| `Escalated` | Authorityまたは専門判断へ戻した |
| `Superseded` | 後続Resultに置き換えられた |

`Completed`は、Outputが生成されたことだけを意味しない。

Trace、Risk、Handoff、Evidenceを含む終了条件を満たす必要がある。

---

# 21. Minimum Agent Result Record

```yaml
agent_result:
  id: AGR-000123
  agent_type: UI
  change: CHG-000045
  scope:
    - UC-000012
  input_revision:
    ux: UX-000004@3
    ia: IA-000008@2
    req: REQ-000044@1
  status: CompletedWithOpenQuestions
  produced:
    - UI-000021@4
  preserved_intent:
    - UX-000004
  decisions:
    - visual_hierarchy_updated
  escalations:
    - REQ cancellation rule requires decision
  open_questions:
    - OQ-000031
  relations:
    - UI-000021 pairs_with REQ-000044
  evidence:
    - EVD-000019
  next_handoff:
    - BehaviorAgent
```

安定IDの実装方法は、対象RepositoryのRegistry設計に従う。

---

# 22. Compact Operation

小規模案件では、Agent Contractを独立ファイルとして毎回作らなくてよい。

Prompt、Issue、Change Package等に、最低限以下を含める。

```text
Role
対象Scope
参照Context / Revision
守るIntent
変更境界
期待Output
止める条件
次のHandoff
```

例:

```text
Role:
UI Agent

Scope:
UC-000012

Read:
UX-000004@3
IA-000008@2
REQ-000044@1

Preserve:
判断理由を同一視野で確認できること

May Change:
UI-000021

Must Not Change:
重要度Rule
Permission Rule

Output:
UI Contract revision
Open Questions
REQとの対応表
```

簡略化しても、責務境界とInput Revisionを消してはならない。

---

# 23. Legacy / Brownfield Application

Legacy環境では、Agent Inputが完全でないことを前提とする。

Agentは以下を区別する。

```text
Documented Context
Implemented Context
Observed Behavior
Operational Practice
Recovered Candidate
Current Decision
```

Reverse Engineering Agentまたは複合Agentは、次をOutputする。

```text
観察事実
推定構造
推定Behavior
Recovered Intent Candidate
Confidence
矛盾
未確認範囲
Current Contractとして採用すべき候補
```

Agentは、現在のCodeを自動的に正しいRequirementへ昇格しない。

また、古い文書を自動的に正本として扱わない。

---

# 24. Anti-patterns

## 24.1. Role Name Only

「UX Agent」「UI Agent」と名付けるだけで、Input、Authority、Outputを定義しない。

Role名はContractではない。

## 24.2. Full Repository Dump

必要性を考えずRepository全体を渡し、Agent自身に正本を推測させる。

Context PackageとActive Revisionを明示する。

## 24.3. Hidden Assumption

不足ContextをAgentが暗黙に補い、成果物へ混ぜる。

AssumptionとConfidenceを明示する。

## 24.4. Authority Leakage

下流Agentが上流価値、Scope、Requirementを無言で変更する。

提案と決定を分離する。

## 24.5. Output without Handoff

成果物だけを返し、次工程が何を確認すべきか示さない。

## 24.6. Reviewer with Same Blind Spot

作成Agentの会話履歴や前提をそのまま引き継ぎ、独立Reviewになっていない。

## 24.7. Completion by Generation

Markdown、Figma、Codeが生成されたため完了とする。

Contract、Trace、Gap、Evidenceを確認する。

## 24.8. Agent as Final Authority

AI Agentが価値判断、Risk受容、Gate承認まで自己完結する。

最終Authorityは人間が持つ。

---

# 25. Completion Criteria

Agent Contract標準に準拠した作業は、対象Scopeについて以下を満たす。

```text
Agent RoleとPurposeが明確である
Active ScopeとRevisionが明確である
Source ContextとPreserved Intentが明確である
変更境界とAuthorityが明確である
必要OutputとHandoffが定義されている
Stop / Reject / Escalate条件がある
OutputにTrace、Open Question、Confidenceが含まれる
重要判断をAIが自己承認していない
ReviewまたはValidationに必要なEvidenceがある
学びとGapがContext Repositoryへ戻されている
```

# Summary

CRDDのAgent Contractは、AIへ作業指示を与えるためだけのPrompt Templateではない。

```text
何を根拠に
何を守り
どこまで判断し
何を成果として返し
どこで止まり
誰へ判断を戻すか
```

を定義する責任契約である。

UX、IA、UI、SPEC、Architecture、Implementationは、それぞれ異なる専門責務を持つ。

一つのAgentが複数Roleを担当してもよいが、責務境界とAuthorityを曖昧にしてはならない。

Agentが変わっても、AI Providerが変わっても、専門家が変わっても、Contractが維持されれば、Contextは意味を失わず次へ継承される。
