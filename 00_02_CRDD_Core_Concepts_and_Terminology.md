# CRDD Core Concepts and Terminology

Version: v0.2.0
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-16
Related:
- [00_00_CRDD_Overview.md](00_00_CRDD_Overview.md)
- [00_03_CRDD_Conformance.md](00_03_CRDD_Conformance.md)
- [00_10_Context_Repository.md](00_10_Context_Repository.md)
- [00_11_Information_Provenance.md](00_11_Information_Provenance.md)
- [00_12_Decision_Record.md](00_12_Decision_Record.md)
- [00_13_Human_AI_Responsibility.md](00_13_Human_AI_Responsibility.md)
- [00_15_Document.md](00_15_Document.md)
- [00_19_Context_Traceability.md](00_19_Context_Traceability.md)
- [00_20_CRDD_Maintenance.md](00_20_CRDD_Maintenance.md)

---

# Purpose

本ドキュメントは、CRDDで使用するCore Concept、Canonical Term、概念間の関係、基本的な責務とAuthorityの正本である。

他のCRDD文書は、本書で定義された概念を再定義してはならない。専門領域固有の詳細な運用、Lifecycle、Approval、Schemaは各専門標準で定義してよいが、本書のCanonical Definitionと矛盾してはならない。

本書は、CRDDに登場するすべての専門用語を網羅する百科事典ではない。以下を対象とする。

```text
Core Context Type
CRDD全体を横断するSupporting Concept
責務・Authorityを表すCanonical Term
主要なLifecycle / Status Term
Alias / Deprecated Term
```

---

# 1. Normative Language

本書では、RFC 2119 / RFC 8174の意味で、以下の規範強度語彙を使用する。

| Term | Meaning |
|---|---|
| `MUST` / `しなければならない` | CRDD準拠に必須 |
| `MUST NOT` / `してはならない` | CRDD準拠上禁止 |
| `SHOULD` / `すべきである` | 原則として従う。従わない場合は理由を説明できること |
| `SHOULD NOT` / `すべきではない` | 原則として避ける。採用する場合は理由を説明できること |
| `MAY` / `してよい` | 任意の選択肢 |

規範強度語彙は、大文字表記または上記の日本語表現で用いる場合にのみ規範的意味を持つ。

---

# 2. Context Lifecycle

CRDDでは、Realityを直接Repositoryへ保存できるとは考えない。Repositoryへ保存されるのは、Realityについて観測・収集・解釈・判断・実行・検証されたContextである。

標準的なContext Lifecycleを以下に示す。

```text
Reality
  ↓ observed_as
Observation
  ↓ supported_by / captured_as
Evidence
  ↓ interpreted_as
Interpretation
  ↓ formulated_as
Hypothesis
  ↓ proposed_as
Proposal
  ↓ accepted_as
Decision
  ↓ realized_by
Requirement
  ↓ planned_as
Plan
  ↓ executed_as
Implementation
  ↓ verified_by
Verification Result
  ↓ promoted_as
Learning
  └──────────────→ Discovery / Principle / Standard / New Proposal
```

この流れは、すべてのContextが必ず一方向に一段ずつ遷移することを意味しない。

```text
一つのEvidenceが複数Interpretationを支えてよい
一つのHypothesisから複数Proposalを作成してよい
ProposalをRejectedまたはDeferredとして保持してよい
Decisionを複数Requirementが実現してよい
Verification ResultからRequirement、UX、IA、Architecture等へ戻ってよい
Learningから新しいObservation、Hypothesis、Proposalが生まれてよい
```

Core Context Type同士の変換では、元Contextを破壊的に上書きせず、RelationとRevisionを保持しなければならない。

---

# 3. Core Context Types

各Core Context Typeは、以下の共通Fieldで定義する。

```text
Definition
Purpose
Created By
Authority
Input
Output
Lifecycle
Related Concepts
Alias
MUST
MUST NOT
```

## 3.1. Observation

| Field | Definition |
|---|---|
| Definition | 人間、System、Sensor、Tool、またはAI Extractionが観測・記録した内容。意味付けや原因説明を含まない一次的な記述。 |
| Purpose | Realityについて確認可能な出来事、状態、発言、挙動をContext Repositoryへ取り込む。 |
| Created By | Human / System / Tool / Sensor / AI Extraction |
| Authority | Observationの採用者はHumanまたは信頼されたSystem。AIは抽出・整形できるが、観測していない内容を追加できない。 |
| Input | Reality、会話、ログ、実行挙動、計測、画像、資料、運用実態 |
| Output | Evidence、Interpretation、Gap Finding、Research Question |
| Lifecycle | `Captured` → `Reviewed` → `Accepted` / `Rejected` / `Superseded` |
| Related Concepts | Evidence、Source、Provenance、Recovered Context |
| Alias | Finding（単なる検出事実を指す場合）、Observed Fact。Canonical TermはObservation。 |
| MUST | Source、取得時点、対象Scopeを追跡可能にしなければならない。観測内容と解釈を分離しなければならない。 |
| MUST NOT | 原因、意図、一般化された結論をObservationとして確定してはならない。 |

## 3.2. Evidence

| Field | Definition |
|---|---|
| Definition | Observation、主張、Decision、Requirement、Verification Result等を裏付ける参照可能な根拠。 |
| Purpose | Contextの信頼性、由来、再確認可能性を担保する。 |
| Created By | Human / System / Tool / AIによる収集・索引化 |
| Authority | Evidenceの内容を作成したSourceが一次Authority。CRDD上の採用・分類はHumanまたは承認済みRuleが担う。 |
| Input | Observation、文書、ログ、録画、Test結果、計測値、外部Source、Artifact |
| Output | Interpretation、Hypothesis Evaluation、Decision Support、Verification Result |
| Lifecycle | `Collected` → `Validated` → `Accepted` / `Expired` / `Invalidated` / `Superseded` |
| Related Concepts | Observation、Source、Artifact、Provenance、Verification Result |
| Alias | Proof（完全な証明を意味しない場合は非推奨）、Reference。 |
| MUST | Source、対象、取得条件、Revisionまたは時点を追跡可能にしなければならない。 |
| MUST NOT | EvidenceそのものをInterpretation、Decision、Requirementとして扱ってはならない。Source不明の主張をEvidenceと呼んではならない。 |

## 3.3. Interpretation

| Field | Definition |
|---|---|
| Definition | ObservationまたはEvidenceに対する意味付け、説明、分類、因果候補。 |
| Purpose | 観測された情報を、人間が検討・判断できる理解へ変換する。 |
| Created By | Human / AI / Expert |
| Authority | Human Reviewを必要とする。AIは複数案とConfidenceを提示できる。 |
| Input | Observation、Evidence、既存Context、Domain Knowledge |
| Output | Hypothesis、Proposal、Research Question、Gap Finding |
| Lifecycle | `Draft` → `Reviewed` → `Accepted` / `Rejected` / `Superseded` |
| Related Concepts | Evidence、Hypothesis、Confidence、Provenance |
| Alias | Analysis、Inference（推論であることを明示する場合）。 |
| MUST | 根拠となるObservationまたはEvidenceへTrace可能でなければならない。確実性を超えて断定してはならない。 |
| MUST NOT | InterpretationをObservation、Evidence、Decisionとして表現してはならない。 |

## 3.4. Hypothesis

| Field | Definition |
|---|---|
| Definition | EvidenceまたはInterpretationから導かれた、まだ検証されていない説明・予測・成立条件。 |
| Purpose | 不確実な理解を明示し、Research、Prototype、Test、Proposalの対象にする。 |
| Created By | Human / AI / Expert |
| Authority | Humanが検証Priorityと採否を判断する。AIは生成・比較・反証候補提示を行える。 |
| Input | Interpretation、Evidence、Observation、既存Learning |
| Output | Research Plan、Experiment、Proposal、Validation Need |
| Lifecycle | `Candidate` → `Under Validation` → `Supported` / `Refuted` / `Inconclusive` / `Superseded` |
| Related Concepts | Interpretation、Proposal、Evidence、Verification Result、Learning |
| Alias | Assumption（前提として一時採用する場合）、Theory Candidate。 |
| MUST | 未検証であること、検証方法または不足Evidenceを明示しなければならない。 |
| MUST NOT | 検証前にDecision、Requirement、Learningへ昇格してはならない。 |

## 3.5. Proposal

| Field | Definition |
|---|---|
| Definition | 採用前の解決案、方針案、設計案、選択肢、変更案。 |
| Purpose | 人間が代替案、Trade-off、Riskを比較してDecisionを行えるようにする。 |
| Created By | Human / AI / Expert / Team |
| Authority | AIは作成・推奨できる。採用AuthorityはHumanにある。 |
| Input | Interpretation、Hypothesis、Evidence、Constraint、Principle、Requirement、Gap |
| Output | Decision、Experiment、Prototype、Rejected / Deferred Proposal |
| Lifecycle | `Candidate` → `Reviewed` → `Accepted as Decision` / `Rejected` / `Deferred` / `Superseded` |
| Related Concepts | Hypothesis、Decision、Alternative、Trade-off、Risk |
| Alias | Idea、Solution Candidate、Recommendation、Option。正式記録ではProposalを使用する。 |
| MUST | Decisionと明確に区別し、Statusと提案主体を保持しなければならない。重要Proposalでは根拠・代替案・Riskを示さなければならない。 |
| MUST NOT | Human Approval前に採用済み方針として扱ってはならない。 |

## 3.6. Decision

| Field | Definition |
|---|---|
| Definition | Human Authorityが採用、却下、延期、例外許容、優先順位等を確定した判断。 |
| Purpose | Productや組織が何を選び、なぜ選んだかを将来へ継承する。 |
| Created By | Human Authority。AIはDraftとDecision Candidateを作成できる。 |
| Authority | Human Only。Authorityは対象Scopeに応じたOwner / Approverが持つ。 |
| Input | Proposal、Evidence、Interpretation、Principle、Constraint、Trade-off、Risk |
| Output | Requirement、Plan、Scope、Principle Update、Exception、Rejected / Deferred Item |
| Lifecycle | `Proposed` → `Approved` / `Rejected` / `Deferred` → `Active` → `Superseded` / `Reversed` |
| Related Concepts | Proposal、Decision Record、Authority、Requirement、Rationale |
| Alias | Approval、Adoption Decision、Rejection Decision。単なるAI RecommendationはDecisionではない。 |
| MUST | Decision maker、日時、対象Scope、Rationale、主要Evidence、影響Contextを保持しなければならない。 |
| MUST NOT | AIが自己承認してはならない。履歴を破壊的に上書きしてはならない。 |

## 3.7. Requirement

| Field | Definition |
|---|---|
| Definition | Decision、Principle、法令、Contract、UX Outcome等を実現・遵守するために満たすべき条件。 |
| Purpose | Product、System、Processが何を満たす必要があるかを、設計・実装・検証可能な形で定義する。 |
| Created By | Human / Analyst / SPEC Agent / Expert。AIはDraftできる。 |
| Authority | 対象ScopeのHuman Authorityが承認する。外部法令・Contract由来の場合は外部Authorityを保持する。 |
| Input | Decision、Principle、UX、IA、UI Contract、法令、Contract、Constraint |
| Output | Architecture、Plan、Implementation、Acceptance Criteria、Test |
| Lifecycle | `Candidate` → `Draft` → `Reviewed` → `Approved` → `Implemented` → `Verified` → `Superseded` / `Deprecated` |
| Related Concepts | Decision、UI Contract、Behavior Contract、Acceptance Criteria、Verification Result |
| Alias | Specification（詳細仕様を指す場合）、Need。Featureそのものとは区別する。 |
| MUST | Source Decisionまたは正当なAuthorityへTrace可能でなければならない。検証可能性またはVerification方法を持たなければならない。 |
| MUST NOT | 根拠のないAI推定を承認済みRequirementとして扱ってはならない。UX OutcomeやDesign IntentをBehavior構文だけへ圧縮してはならない。 |

## 3.8. Plan

| Field | Definition |
|---|---|
| Definition | RequirementやDecisionを実現するための順序、Scope、Task、Dependency、Owner、Gate、Verificationを定めた実行計画。 |
| Purpose | 採用済みContextを、実行可能かつ中断・確認可能な作業へ変換する。 |
| Created By | Human / Planning Agent / Team |
| Authority | Human OwnerがScope、Priority、Schedule、Riskを承認する。 |
| Input | Requirement、Architecture、Decision、Constraint、Impact Analysis、Resource |
| Output | Task、Milestone、Change Package、Delivery Instruction、Verification Plan |
| Lifecycle | `Draft` → `Reviewed` → `Approved` → `In Progress` → `Completed` / `Cancelled` / `Superseded` |
| Related Concepts | Requirement、Change Package、Task、Gate、Implementation |
| Alias | Delivery Plan、Implementation Plan、Roadmap Item。Roadmap全体とは区別する。 |
| MUST | 対象Requirement、Scope、Dependency、完了条件、Ownerを追跡可能にしなければならない。 |
| MUST NOT | 未承認のScope削減やRequirement変更を暗黙に含めてはならない。 |

## 3.9. Implementation

| Field | Definition |
|---|---|
| Definition | PlanとRequirementに基づいて作成・変更されたCode、Configuration、Design Asset、Content、Infrastructure、Process等の実体。 |
| Purpose | 採用済みContextを、動作・利用・評価可能な現実の成果へ変換する。 |
| Created By | Human / AI Agent / Tool / System |
| Authority | 作成Authorityと採用Authorityを分離してよい。ReleaseまたはBaselineへの採用はHuman Authorityが決める。 |
| Input | Plan、Requirement、Architecture、UI / Graphic、Asset、Constraint |
| Output | Executable Artifact、Build、Release Candidate、Verification Target、Operational Change |
| Lifecycle | `Created` → `Reviewed` → `Integrated` → `Released` / `Rejected` → `Superseded` / `Retired` |
| Related Concepts | Artifact、Plan、Requirement、Architecture、Verification Result |
| Alias | Delivery、Code Change、Built Artifact。実装方法全体をCodeだけに限定しない。 |
| MUST | 対応するPlanまたはRequirementへTrace可能でなければならない。Deviationと既知Limitを明示しなければならない。 |
| MUST NOT | 動作していることだけを理由に、上流DecisionやRequirementの正本として扱ってはならない。 |

## 3.10. Verification Result

| Field | Definition |
|---|---|
| Definition | 対象RevisionのRequirement、Contract、Acceptance Criteria、Outcome等に対する検証結果とEvidence。 |
| Purpose | ImplementationやContextが期待条件を満たすか、どの条件では満たさないかを明らかにする。 |
| Created By | Human Reviewer / Test Agent / Tool / System / User Researcher |
| Authority | 検証方法と対象に応じたReviewerまたはQuality Authority。AIは実行・整理できるがRisk受容を決められない。 |
| Input | Requirement、Acceptance Criteria、Implementation、Environment、Test、Observation |
| Output | Pass / Fail / Blocked、Gap、Finding、Decision Input、Learning Candidate |
| Lifecycle | `Planned` → `Executed` → `Reviewed` → `Accepted` / `Invalidated` / `Superseded` |
| Related Concepts | Evidence、Requirement、Implementation、Gap、Learning |
| Alias | Test Result、Validation Result、Review Result。曖昧なResult単独表記は避ける。 |
| MUST | 対象Revision、Environment、実行条件、結果、Evidenceを保持しなければならない。 |
| MUST NOT | Test PassだけをProduct Outcome達成の証明として扱ってはならない。古いRevisionのResultを現行検証として再利用してはならない。 |

## 3.11. Learning

| Field | Definition |
|---|---|
| Definition | Observation、Verification Result、運用、Decision結果等から抽出され、将来再利用できる形に整理された知見。 |
| Purpose | 同じ失敗・調査・判断を繰り返さず、Product、Method、Standard、Roadmapを改善する。 |
| Created By | Human / AIによる整理。正式PromotionはHuman Reviewを必要とする。 |
| Authority | 対象RepositoryまたはStandardのOwner。単一事例から一般Ruleへ昇格する場合は明示承認を必要とする。 |
| Input | Verification Result、Operational Observation、Decision Outcome、Incident、Experiment、Retrospective |
| Output | Discovery Context、Principle Update、Practice、Rule、Proposal、Roadmap、Training Context |
| Lifecycle | `Candidate` → `Reviewed` → `Promoted` / `Rejected` / `Deferred` → `Superseded` / `Deprecated` |
| Related Concepts | Verification Result、Evidence、Practice、Rule、Proposal、Feedback Loop |
| Alias | Lesson Learned、Insight、Knowledge Candidate。単なるSummaryはLearningではない。 |
| MUST | Source Evidence、適用範囲、Confidence、Promotion先を保持しなければならない。 |
| MUST NOT | Evidenceのない一般化やAI推定を確立済みLearningとして登録してはならない。 |

---

# 4. Supporting Concepts

Supporting Conceptは、Core Context Typeを保存・接続・実行・管理するための横断概念である。詳細な運用規則はRelated文書へ委譲する。

## 4.1. Context

**Definition:** CRDDで意味、理由、状態、関係、判断、要求、計画、実装、検証、学びとして扱われる、人間とAIが参照可能な情報単位。

**Purpose:** セッション、担当者、AI、Artifact、Releaseをまたいで、Productの意味と判断を継承する。

**Authority:** Context Typeと対象Scopeに応じてHuman、System、外部Authorityが異なる。AIはAuthorityを自動取得しない。

**MUST:** Type、Source / Provenance、Status、Revision、Relationを必要な粒度で保持する。

**MUST NOT:** すべての情報を無差別にContext Repositoryの正本へ昇格してはならない。

## 4.2. Context Repository

**Definition:** ProductのWhy、Context、Decision、Artifact参照、Trace、Versionを、人間とAIが継続利用できる形で管理するRepositoryまたは論理的な情報基盤。

**Purpose:** Product Contextの継承、再現、判断、変更、検証の基盤となる。

**Authority:** Repository Owner。詳細は`00_10_Context_Repository.md`を参照する。

**MUST:** Canonical Contextと外部ArtifactのAuthority / Source of Truthを明示する。

**MUST NOT:** GitやMarkdownという媒体そのものを、すべてのPropertyの唯一の正本とみなしてはならない。

## 4.3. Artifact

**Definition:** 文書、Figma、Diagram、Code、Build、Asset、Log、動画等、Contextを表現・実装・検証する具体的な成果物。

**Purpose:** Contextを人間、AI、Systemが利用可能な形へ固定・参照する。

**Authority:** Artifact TypeおよびPropertyごとに異なる。

**MUST:** 安定した参照、Version / Revision、OwnerまたはSourceを必要な範囲で持つ。

**MUST NOT:** ArtifactとContextの意味を同一視してはならない。一つのArtifactに複数Contextが含まれてよい。

## 4.4. Registry

**Definition:** Context、Artifact、Relation、Status、Ownership、Version等を検索・検査・機械処理可能な形で管理する一覧またはData Store。

**Purpose:** 多対多Relation、Lifecycle、Trace、Impact Analysisを安定して扱う。

**Authority:** Registry Ownerまたは該当Context Authority。

**MUST:** Registryが正本であるPropertyと、参照先が正本であるPropertyを区別する。

**MUST NOT:** Registryの存在だけでContext内容の妥当性を保証したとみなしてはならない。

## 4.5. Context Package

**Definition:** 特定の作業、Agent、Review、Changeに必要な既存Contextを、対象Revisionへの参照として束ねたInput Set。

**Purpose:** Repository全体を無差別に渡さず、必要なContext、Preserved Intent、Boundaryを明示する。

**Authority:** Packageを構成するOwner / Orchestrator。正本Authorityは参照元Contextに残る。

**MUST:** Scope、Revision、Source、Preserved Intent、Known Uncertaintyを明示する。

**MUST NOT:** 正本Contextを複製して独立更新し、別の正本を作ってはならない。

詳細は`00_24_Change_Context_Package.md`を参照する。

## 4.6. Agent

**Definition:** 特定の目的、Authority、Input / Output Contractに従って作業するHuman、AI、System、または複合実行主体。

**Purpose:** Skill、Plan、Task等を実行し、ContextやArtifactを生成・変換・検証する。

**Authority:** Agent ContractとHuman Authorityによって付与される。AI Agentは暗黙にHuman Authorityを持たない。

**MUST:** Role、Scope、Input、Output、Boundary、Stop / Escalation条件を重要作業で明示する。

**MUST NOT:** 自身の専門責務を越える重要Decisionを自己承認してはならない。

詳細は`00_26_Agent_IO_Contract.md`を参照する。

## 4.7. Skill

**Definition:** 特定のContextをInputとして受け取り、質問・分析・変換・Reviewを通じて定義済みOutputへ導く再利用可能な作業方法。

**Purpose:** 専門知識や判断手順を、人間・AI・Expertが再現可能な形へする。

**Authority:** Skill自体はAuthorityを持たない。実行者と対象ContextのAuthorityに従う。

**MUST:** Purpose、Input、Output、Authority Boundary、終了条件を持つ。

**MUST NOT:** Skillの実行完了をPhase Gateの承認と同一視してはならない。

詳細は`00_27_Guided_Context_Creation.md`を参照する。

## 4.8. Phase Gate

**Definition:** 特定のFeature、Change、Revisionを次の活動へ進めるか、人間が条件とEvidenceを確認して判断する境界。

**Purpose:** 文書の存在ではなく、Contextの成熟度、Risk、未決、Verificationを基に進行を制御する。

**Authority:** Gateごとに定義されたHuman Approver。

**MUST:** Scope、対象Revision、Exit Criteria、判断、条件、残存Riskを保持する。

**MUST NOT:** AIが重要Gateを自己承認してはならない。

詳細は`00_23_Phase_Gate_Approval.md`を参照する。

## 4.9. Trace

**Definition:** Context、Artifact、Decision、Requirement、Implementation、Verification等の由来・実現・制約・検証関係を追跡できるRelation。

**Purpose:** 上流Intentから下流成果物へ、下流成果物から上流理由へ双方向に遡れるようにする。

**Authority:** RelationのOwnerまたは対象Context Authority。

**MUST:** Relationの意味、Source / Target、対象Revisionを必要な粒度で保持する。

**MUST NOT:** ファイルLinkが存在するだけで意味的Traceが成立したとみなしてはならない。

詳細は`00_19_Context_Traceability.md`を参照する。

## 4.10. Source of Truth

**Definition:** 特定のProperty、判断、Version、実行事実について、最終的に参照すべきAuthoritative Source。

**Purpose:** 複数ArtifactやSystem間のConflictを解消する基準を持つ。

**Authority:** Propertyごとに定義されたOwner / Authority。

**MUST:** Source of TruthはArtifact全体ではなく、必要に応じてProperty単位で定義する。

**MUST NOT:** Code、Markdown、Figma等の一媒体をすべてのPropertyの一律なSource of Truthとして扱ってはならない。

---

# 5. Responsibility and Authority Terms

## 5.1. Human

価値、意味、Priority、Trade-off、Risk Acceptance、重要Decision、最終責任を担う人間主体。

Humanはすべての作業を自ら行う必要はないが、AIまたはSystemへ委譲した作業の判断責任まで自動的に移転したとはみなさない。

## 5.2. AI

Contextの抽出、整理、比較、提案、Draft、変換、実装、検証支援を行う非人間主体。

AIはProposalを作成してよいが、Human Authorityが必要なDecision、Gate、Risk Acceptanceを自己承認してはならない。

## 5.3. System

定義済みRuleに従って観測、処理、保存、検証、通知等を行う実行主体。Systemの出力は、Rule、Environment、Versionを含むProvenanceを必要とする。

## 5.4. Owner

Context、Artifact、Process、Registry等を維持し、更新・Review・廃止・Escalationを管理する主体。Ownerと最終Authorityは同一でなくてよい。

## 5.5. Authority

特定Scopeについて、採用、承認、却下、Risk受容、正本変更を最終決定できる権限。

AuthorityはRole名だけでなく、対象Product、Property、Change、Release、期間によって定義する。

## 5.6. Reviewer

ContextまたはArtifactが、Source、Contract、Quality、Boundary、Evidenceを満たすか確認し、Findingと推奨判断を返す主体。Reviewerは重要なRiskを自動受容しない。

## 5.7. Approver

特定のContext、Gate、Baseline、Release等を正式採用するHuman Authority。AIはApproverになれない。

## 5.8. Agent and Subagent

Agentは定義済みContractに従う実行主体である。Subagentは、上位AgentまたはOrchestratorから限定されたScopeとContractを受けて作業するAgentである。

Subagentは独立したAuthorityを意味しない。詳細な構成は`00_31_Subagent_Practice.md`の任意Practiceであり、CRDD Coreは特定のSubagent構成を要求しない。

---

# 6. Lifecycle and Status Terms

StatusはContext Type、Artifact、Document、Gate、Releaseによって意味が異なる。以下はCanonicalな共通意味であり、詳細な遷移は各専門標準へ委譲する。

| Status | Canonical Meaning |
|---|---|
| `Candidate` | 検討対象として識別されたが、まだDraftまたは採用対象として確定していない |
| `Draft` | 作成中であり、Authorityによる採用前 |
| `Reviewed` | 指定されたReviewerが確認済み。採用または承認を意味しない |
| `Accepted` | 対象用途で使用することをHumanが認めた。Formal Approvalを必要としないContextにも使用する |
| `Approved` | 定義済みAuthorityが正式承認した |
| `Fixed` | 対象Revision、Version、Checksum等が変更不能なBaseline候補として固定された |
| `Active` | 現在有効なContext、Baseline、Ruleとして使用されている |
| `Implemented` | 対応する実装が存在する。正しさや検証完了を意味しない |
| `Verified` | 対象Revisionが定義済みVerificationを満たした |
| `Rejected` | 検討または採用対象から明示的に除外された |
| `Deferred` | 今回は採用・実行せず、後続時点へ送られた |
| `Superseded` | 後続Revisionまたは別Contextに置き換えられた。履歴は保持する |
| `Deprecated` | 使用を避けるべきだが、互換性等のため残っている |
| `Retired` | 現在および将来の利用対象から廃止された |
| `Recovered` | Legacy等から復元された候補で、由来とConfidenceの明示が必要 |
| `Blocked` | 外部判断、不足Context、Dependency等により進行できない |
| `Experimental` | 試験段階で、互換性や内容の安定を保証しない |
| `Stable` | 対象Scopeで基本構造が安定し、通常利用可能。将来変更されないことを意味しない |

以下を混同してはならない。

```text
Reviewed ≠ Approved
Implemented ≠ Verified
Fixed ≠ Active
Accepted ≠ Decision（Context TypeとStatusは別概念）
Stable ≠ Immutable
Recovered ≠ Confirmed
```

---

# 7. Canonical Aliases and Deprecated Terms

| Canonical Term | Alias / Deprecated Term | Rule |
|---|---|---|
| Observation | Fact | CRDD Context TypeとしてFactは原則使用しない。一般語としての「事実」は使用してよい |
| Proposal | Idea / Solution Candidate / Recommendation | Statusが採用前である限りProposalへ統一する |
| Decision | Adopted Proposal / Approval | Human Authorityによる判断だけをDecisionと呼ぶ |
| Verification Result | Result | Result単独は対象と意味が曖昧なため避ける |
| Evidence | Proof | 数学的・法的な完全証明でない限りProofを避ける |
| Context Repository | Documentation Repository | Context、Trace、Decisionを扱う場合にDocumentationだけへ狭めない |
| Requirement | Feature | FeatureはProduct Scope単位、Requirementは満たす条件として区別する |
| Implementation | Code | Code以外のDesign Asset、Config、Infra、Processも含む |
| Learning | Summary | 要約されただけではLearningへ昇格しない |

新しいCore Termを導入する場合、使用前または同一Change内で本書へ定義・Alias・既存Termとの境界を追加しなければならない。

---

# 8. Responsibility Matrix

以下はCore Context Typeの作成・Review・承認に関する簡易Matrixである。Project固有のRASICやOwnershipは別途定義してよいが、この境界を弱めてはならない。

| Context Type | Human | AI | System / Tool | Approval / Promotion Authority |
|---|---|---|---|---|
| Observation | Create / Review | Extract / Structure | Create | Humanまたは信頼されたSystem Rule |
| Evidence | Collect / Validate | Discover / Index | Produce | HumanまたはSource Authority |
| Interpretation | Create / Review | Create / Compare | — | Human Review |
| Hypothesis | Create / Prioritize | Generate / Challenge | — | Humanが検証扱いを決定 |
| Proposal | Create / Review | Create / Recommend | Generate候補 | Humanが採否を決定 |
| Decision | Create / Approve | Draft / Suggest only | — | Human Authority only |
| Requirement | Create / Approve | Draft / Analyze | Constraint提供 | Humanまたは外部Authority |
| Plan | Create / Approve | Draft / Optimize | Schedule計算 | Human Owner |
| Implementation | Create / Review / Adopt | Create / Modify | Execute / Build | Human Release / Baseline Authority |
| Verification Result | Review / Accept | Execute / Analyze | Execute / Measure | Human Reviewer / Quality Authority |
| Learning | Create / Promote | Extract / Propose | Signal提供 | Human Repository / Standard Owner |

本Matrixは、各Conceptの定義を補助するものであり、詳細なAgent Contract、RASIC、Property Responsibilityを置き換えない。

---

# 9. Conformance Rules

CRDD準拠のContext運用は、少なくとも以下を満たさなければならない。

```text
MUST Observation、Evidence、Interpretation、Hypothesis、Proposal、Decisionを区別する
MUST ProposalとDecisionのStatusおよびAuthorityを区別する
MUST DecisionにRationaleとHuman Authorityを持たせる
MUST RequirementをSource Decisionまたは正当なAuthorityへTrace可能にする
MUST ImplementationとVerification Resultを区別する
MUST Recovered ContextにSourceとConfidenceを持たせる
MUST Superseded / Rejected / Deferred Contextの履歴を必要な期間保持する
MUST NOT AIが重要Decision、Gate、Risk Acceptanceを自己承認する
MUST NOT ObservationまたはInterpretationを、根拠なく確定Factとして登録する
MUST NOT Artifactの存在だけでContextの意味・承認・検証を保証したとみなす
SHOULD Core Context Typeへ安定ID、Revision、Relationを付与する
SHOULD AliasではなくCanonical Termを正式文書とRegistryで使用する
MAY 人間向けUIではIDや詳細StatusをProgressive Disclosureにより簡略表示する
```

専門標準が本書より厳しい規則を定義することは許容する。本書より弱い責務境界やAuthorityを定義する場合は、CRDD CoreからのDeviationとして明示的なDecisionとRisk Acceptanceを必要とする。
