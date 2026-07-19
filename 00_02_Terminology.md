# CRDD Terminology

Version: v0.4.2
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-19
Related:
- [00_00_Overview.md](00_00_Overview.md)
- [00_01_Principles.md](00_01_Principles.md)
- [00_03_Documentation.md](00_03_Documentation.md)
- [00_10_Agent.md](00_10_Agent.md)
- [00_11_Skill.md](00_11_Skill.md)
- [00_12_Change.md](00_12_Change.md)
- [00_13_Release.md](00_13_Release.md)
- [00_14_Workflow.md](00_14_Workflow.md)
- [00_19_Maintenance.md](00_19_Maintenance.md)
- [00_52_Conformance_Audit.md](00_52_Conformance_Audit.md)
- [00_53_Gap_Impact_Audit.md](00_53_Gap_Impact_Audit.md)

---

# Purpose

本ドキュメントは、CRDDで使用するCanonical Term、各Termの境界、基本的な責務とAuthority、Lifecycle / Status、Aliasの正本である。Context間を一気通貫で変換する概念モデルは[`00_01_Principles.md`](00_01_Principles.md)を正本とする。

他のCRDD文書は、本書で定義された概念を再定義してはならない。専門領域固有の詳細な運用、Lifecycle、Approval、Schemaは各専門標準で定義してよいが、本書のCanonical Definitionと矛盾してはならない。

本書は、CRDDに登場するすべての専門用語を網羅する百科事典ではない。以下を対象とする。

```text
Core Context Type
CRDD全体を横断するSupporting Concept
責務・Authorityを表すCanonical Term
主要なLifecycle / Status Term
Alias / Deprecated Term
```

本書を含むCRDD文書で用いる規範強度語彙の意味は、[`00_03_Documentation.md`](00_03_Documentation.md#48-normative-language)を正本とする。

---

# 1. Core Context Types

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
MUST
MUST NOT
```

## 1.1. Observation

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
| MUST | Source、取得時点、対象Scopeを追跡可能にしなければならない。観測内容と解釈を分離しなければならない。 |
| MUST NOT | 原因、意図、一般化された結論をObservationとして確定してはならない。 |

## 1.2. Evidence

| Field | Definition |
|---|---|
| Definition | Observation、主張、Decision、Requirement、Verification Result等を裏付ける参照可能な根拠。 |
| Purpose | Contextの信頼性、由来、再確認可能性を担保する。 |
| Created By | Human / System / Tool / AIによる収集・索引化 |
| Authority | Evidenceの内容と真正性はSourceに由来する。CRDD上の採用、分類、適用範囲、Freshness判断は対象ContextのOwner、Human Authority、または承認済みRuleが担う。 |
| Input | Observation、文書、ログ、録画、Test結果、計測値、外部Source、Artifact |
| Output | Interpretation、Hypothesis Evaluation、Decision Support、Verification Result |
| Lifecycle | `Collected` → `Validated` → `Accepted` / `Expired` / `Invalidated` / `Superseded` |
| Related Concepts | Observation、Source、Artifact、Provenance、Verification Result |
| MUST | Source、対象、取得条件、Revisionまたは時点を追跡可能にしなければならない。 |
| MUST NOT | EvidenceそのものをInterpretation、Decision、Requirementとして扱ってはならない。Source不明の主張をEvidenceと呼んではならない。 |

## 1.3. Interpretation

| Field | Definition |
|---|---|
| Definition | ObservationまたはEvidenceに対する意味付け、説明、分類、因果候補。 |
| Purpose | 観測された情報を、人間が検討・判断できる理解へ変換する。 |
| Created By | Human / AI / Expert |
| Authority | Interpretationの作成者。Decision、Requirement、Canonical Contextへ昇格する場合は、対象AuthorityのReviewを必要とする。AIは複数案とConfidenceを提示できる。 |
| Input | Observation、Evidence、既存Context、Domain Knowledge |
| Output | Hypothesis、Proposal、Research Question、Gap Finding |
| Lifecycle | `Draft` → `Reviewed` → `Accepted` / `Rejected` / `Superseded` |
| Related Concepts | Evidence、Hypothesis、Confidence、Provenance |
| MUST | 根拠となるObservationまたはEvidenceへTrace可能でなければならない。確実性を超えて断定してはならない。 |
| MUST NOT | InterpretationをObservation、Evidence、Decisionとして表現してはならない。 |

## 1.4. Hypothesis

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
| MUST | 未検証であること、検証方法または不足Evidenceを明示しなければならない。 |
| MUST NOT | 検証前に確定Factまたは確立済みLearningとして扱ってはならない。DecisionやRequirementのInputにする場合は、未検証性、Risk、検証または見直し条件を隠してはならない。 |

## 1.5. Proposal

| Field | Definition |
|---|---|
| Definition | 採用前の解決案、方針案、設計案、選択肢、変更案。 |
| Purpose | 人間が代替案、Trade-off、Riskを比較してDecisionを行えるようにする。 |
| Created By | Human / AI / Expert / Team |
| Authority | AIは作成・推奨できる。採用AuthorityはHumanにある。 |
| Input | Interpretation、Hypothesis、Evidence、Constraint、Principle、Requirement、Gap |
| Output | Decision、Experiment、Prototype、Rejected / Deferred Proposal |
| Lifecycle | `Candidate` → `Reviewed` → `Promoted to Decision` / `Rejected` / `Deferred` / `Superseded` |
| Related Concepts | Hypothesis、Decision、Alternative、Trade-off、Risk |
| MUST | Decisionと明確に区別し、Statusと提案主体を保持しなければならない。重要Proposalでは根拠・代替案・Riskを示さなければならない。 |
| MUST NOT | Human Approval前に採用済み方針として扱ってはならない。 |

## 1.6. Decision

| Field | Definition |
|---|---|
| Definition | Human Authorityが採用、却下、延期、例外許容、優先順位等を確定した判断。 |
| Purpose | Productや組織が何を選び、なぜ選んだかを将来へ継承する。 |
| Created By | Human Authority。AIはDraftとDecision Candidateを作成できる。 |
| Authority | Human Only。Authorityは対象Scopeに応じたOwner / Approverが持つ。 |
| Input | Proposal、Evidence、Interpretation、Principle、Constraint、Trade-off、Risk |
| Output | Requirement、Plan、Scope、Principle Update、Exception、Rejected / Deferred Item |
| Lifecycle | `Recorded` → `Active` → `Superseded` / `Reversed` |
| Related Concepts | Proposal、Canonical Artifact、Authority、Requirement、Rationale |
| MUST | Decision maker、日時、対象Scope、Decision Outcome、Rationale、主要Evidence、影響Contextを保持しなければならない。 |
| MUST NOT | AIが自己承認してはならない。履歴を破壊的に上書きしてはならない。 |

## 1.7. Requirement

| Field | Definition |
|---|---|
| Definition | Discoveryで得た問題、Need、Evidence、法令、Contract、Constraint等から導かれる、Product、System、Processが満たすべき条件。 |
| Purpose | Discoveryの結果を、UX、IA、UI、Behavior Specificationへ引き渡せる追跡可能な要求として定義する。 |
| Created By | Human / Analyst / Discovery Agent / Expert。AIはDraftできる。 |
| Authority | 対象ScopeのHuman AuthorityがProductへの採用、適用、優先度を決める。外部法令・Contract由来の義務そのものは外部Authorityを保持し、人間判断で由来を上書きしない。 |
| Input | Observation、Evidence、Problem、Need、Decision、Principle、法令、Contract、Constraint |
| Output | UX / IA / UI / Behavior SpecificationへのObligation、Architecture Input、Plan、Verification Obligation |
| Lifecycle | `Candidate` → `Draft` → `Reviewed` → `Approved` → `Active` → `Superseded` / `Deprecated` / `Retired` |
| Related Concepts | Decision、UI Contract、Behavior Specification、Acceptance Criteria、Verification Result |
| MUST | Discovery Source、Evidence、Decisionまたは正当なAuthorityへTrace可能でなければならない。検証可能性またはVerification方法を持たなければならない。 |
| MUST NOT | 根拠のないAI推定を承認済みRequirementとして扱ってはならない。UX OutcomeやDesign IntentをBehavior構文だけへ圧縮してはならない。Implementation StatusやVerification StatusをRequirement自身のStatusとして流用してはならない。 |

## 1.8. Behavior Specification

| Field | Definition |
|---|---|
| Definition | Feature、Use Case、User Action等について、特定のCondition、Trigger、State、Inputに対してSystemが何を行い、何を変更・出力し、例外・失敗・回復をどう扱うかを定義した検証可能な振る舞い仕様。 |
| Purpose | Requirement、UX、IA、UI Contract、Business Ruleを、実装・検証へ渡せる具体的なSystem Behaviorへ変換する。 |
| Created By | Human / Analyst / SPEC Agent / Expert。AIはDraftできる。 |
| Authority | 対象ScopeのProductまたはDomain Authorityが意味を承認する。ArchitectureやImplementationは承認済みBehavior Specificationを無断で弱めない。 |
| Input | Requirement、Decision、Feature、Use Case、User Action、IA、UI Contract、Business Rule、Constraint |
| Output | Architecture Input、Implementation Obligation、Acceptance Criteria、Verification Obligation |
| Lifecycle | `Candidate` → `Draft` → `Reviewed` → `Approved` → `Active` → `Superseded` / `Deprecated` / `Retired` |
| Related Concepts | Requirement、UI Contract、State、Business Rule、Acceptance Criteria、Verification Result |
| MUST | Condition、Trigger、State、Behavior、Exception、AcceptanceまたはVerification方法を対象Riskに応じた粒度で持たなければならない。Source Requirementまたは正当なAuthorityへTrace可能でなければならない。 |
| MUST NOT | Requirement、UX Outcome、UI表現、Architecture方式、実装詳細と同一視してはならない。Implementation StatusやVerification StatusをBehavior Specification自身のStatusとして流用してはならない。 |

Requirementは「何を満たす必要があるか」を定義し、Behavior Specificationは「どの条件と状態でSystemがどう振る舞うか」を定義する。

Behavior Specificationが承認され、UI、Architecture、Implementation、Verificationの基準として利用される場合、契約的な役割を果たす。ただし、その役割を別のContext Typeである`Behavior Contract`として扱ってはならない。

## 1.9. Plan

| Field | Definition |
|---|---|
| Definition | RequirementやDecisionを実現するための順序、Scope、Task、Dependency、Owner、Gate、Verificationを定めた実行計画。 |
| Purpose | 採用済みContextを、実行可能かつ中断・確認可能な作業へ変換する。 |
| Created By | Human / Planning Agent / Team |
| Authority | Human OwnerがScope、Priority、Schedule、Riskを承認する。 |
| Input | Requirement、Architecture、Decision、Constraint、Impact Analysis、Resource |
| Output | Task、Milestone、Change Trace Reference、Delivery Instruction、Verification Plan |
| Lifecycle | `Draft` → `Reviewed` → `Approved` → `In Progress` → `Completed` / `Cancelled` / `Superseded` |
| Related Concepts | Requirement、Change Trace、Task、Gate、Implementation |
| MUST | 対象Requirement、Scope、Dependency、完了条件、Ownerを追跡可能にしなければならない。 |
| MUST NOT | 未承認のScope削減やRequirement変更を暗黙に含めてはならない。 |

## 1.10. Implementation

| Field | Definition |
|---|---|
| Definition | 承認済みContext、Behavior Specification、Architecture、UI等に基づいて作成・変更されたCode、Configuration、Migration、Infrastructure、配布Content、Developer Test、Build等の実行可能または配布可能な実体。 |
| Purpose | 採用済みContextを、動作・利用・評価可能な現実の成果へ変換する。 |
| Created By | Human / AI Agent / Tool / System |
| Authority | 作成Authorityと採用Authorityを分離してよい。Baselineへの統合はProjectのAgent / Review Contract、Releaseへの採用はHuman Release Authorityが決める。 |
| Input | Plan、Requirement、Behavior Specification、Architecture、UI / Graphic、Asset、Constraint、Change Trace |
| Output | Executable Artifact、Configuration、Migration、Developer Test、Build、Release Candidate、Verification Target |
| Lifecycle | `Planned` → `In Progress` → `Implemented` → `Superseded` / `Retired` |
| Related Concepts | Artifact、Plan、Requirement、Behavior Specification、Architecture、Verification Result |
| MUST | 対応するPlan、Requirement、Behavior Specificationのうち該当するContextへTrace可能でなければならない。Deviationと既知Limitを明示しなければならない。 |
| MUST NOT | 動作していることだけを理由に、上流DecisionやRequirementの正本として扱ってはならない。`Implemented`を`Verified`または`Released`として扱ってはならない。 |

## 1.11. Verification Result

| Field | Definition |
|---|---|
| Definition | 対象RevisionのRequirement、Behavior Specification、Contract、Acceptance Criteria、Outcome等に対する検証結果とEvidence。 |
| Purpose | ImplementationやContextが期待条件を満たすか、どの条件では満たさないかを明らかにする。 |
| Created By | Human Reviewer / Test Agent / Tool / System / User Researcher |
| Authority | 検証方法と対象に応じたReviewerまたはQuality Authority。AIは実行・整理できるがRisk受容を決められない。 |
| Input | Requirement、Behavior Specification、Acceptance Criteria、Implementation、Environment、Test、Observation |
| Output | Pass / Fail / Blocked、Gap、Finding、Decision Input、Learning Candidate |
| Lifecycle | `Produced` → `Reviewed` → `Accepted` / `Invalidated` / `Superseded` |
| Related Concepts | Evidence、Requirement、Behavior Specification、Implementation、Gap、Learning |
| MUST | 対象Revision、Environment、実行条件、結果、Evidenceを保持しなければならない。 |
| MUST NOT | Test PassだけをProduct Outcome達成の証明として扱ってはならない。古いRevisionのResultを現行検証として再利用してはならない。ResultのLifecycle、Verification Outcome、Human Acceptanceを同一Statusとして扱ってはならない。 |

## 1.12. Learning

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
| MUST | Source Evidence、適用範囲、Confidence、Promotion先を保持しなければならない。 |
| MUST NOT | Evidenceのない一般化やAI推定を確立済みLearningとして登録してはならない。 |

---

# 2. Supporting Concepts

Supporting Conceptは、Core Context Typeを保存・接続・実行・管理するための横断概念である。詳細な運用規則はRelated文書へ委譲する。

## 2.1. Context

**Definition:** CRDDで意味、理由、状態、関係、判断、要求、計画、実装、検証、学びとして扱われる、人間とAIが参照可能な情報単位。

**Purpose:** セッション、担当者、AI、Artifact、Releaseをまたいで、Productの意味と判断を継承する。

**Authority:** Context Typeと対象Scopeに応じてHuman、System、外部Authorityが異なる。AIはAuthorityを自動取得しない。

**MUST:** Type、Source / Provenance、Status、Revision、Relationを必要な粒度で保持する。

**MUST NOT:** すべての情報を無差別にContext Repositoryの正本へ昇格してはならない。

## 2.2. Context Repository

**Definition:** ProductのWhy、Context、Decision、Artifact参照、Trace、Versionを、人間とAIが継続利用できる形で管理するRepositoryまたは論理的な情報基盤。

**Purpose:** Product Contextの継承、再現、判断、変更、検証の基盤となる。

**Authority:** Repository Owner。詳細は[`00_03_Documentation.md`](00_03_Documentation.md)を参照する。

**MUST:** Canonical Contextと外部ArtifactのProperty Authorityを明示する。

**MUST NOT:** GitやMarkdownという媒体そのものを、すべてのPropertyの唯一の正本とみなしてはならない。

## 2.3. Artifact

**Definition:** 文書、Figma、Diagram、Code、Build、Asset、Log、動画等、Contextを表現・実装・検証する具体的な成果物。

**Purpose:** Contextを人間、AI、Systemが利用可能な形へ固定・参照する。

**Authority:** Artifact TypeおよびPropertyごとに異なる。

**MUST:** 安定した参照、Version / Revision、OwnerまたはSourceを必要な範囲で持つ。

**MUST NOT:** ArtifactとContextの意味を同一視してはならない。一つのArtifactに複数Contextが含まれてよい。

## 2.4. Canonical Artifact

**Definition:** 特定のContextまたはPropertyについて、Authoritative Sourceとして承認または宣言されたArtifact。Decisionの結果は、原則として結果となるCanonical Artifactへ反映される。

**Purpose:** 人間とAIが、現在有効な意味、状態、判断とその理由を同じ参照先から取得できるようにする。

**Authority:** Artifact全体ではなく、対象PropertyごとのProperty Authorityに従う。Git外のArtifactもCanonicalになり得る。

**MUST:** 対象Property、Owner、Status、Revision、取得方法を必要な粒度で識別可能にする。

**MUST NOT:** Draft、Copy、Index、Change Trace、Review Viewを、宣言や承認なしにCanonical Artifactとして扱ってはならない。

## 2.5. Property Authority

**Definition:** 特定のPropertyについて、競合時に最終参照するArtifact、System、外部Sourceと、その更新・承認責任の組合せ。

**Purpose:** 一つのArtifactや媒体を万能な正本にせず、意味、Visual、Code、Test Result、Release等の責務を適切なSourceへ分ける。

**Authority:** 対象ScopeのHuman Authorityまたは正当に委任された外部Authorityが宣言する。

**MUST:** Property、Source、Owner、Revisionまたは有効時点、競合時の扱いを識別可能にする。

**MUST NOT:** Folder番号、ファイル形式、Code、Markdown、Figma等の媒体だけから一律にAuthorityを推定してはならない。

`Source of Truth`は一般語として使用できるが、CRDDではArtifact全体よりProperty Authorityを優先して表現する。詳細は[Documentation](00_03_Documentation.md#22-property-authority)を参照する。

## 2.6. Artifact Reference

**Definition:** Stable Context IDを付与しないArtifactまたは外部Sourceを、Path、Anchor、Revision、URL、Record ID、Checksum等で再識別する参照。

**Purpose:** Architecture、Evidence、Decision、Change Trace、Implementation、Verification、Release、外部Artifactを、不要なStable Context IDを増やさず接続する。

**Authority:** 参照先のProperty Authority。Reference自体は参照先のAuthorityを取得しない。

**MUST:** Locatorと、判断・検証に必要なRevisionまたは時点を保持する。

**MUST NOT:** `latest`、壊れやすいSession URL、曖昧なファイル名だけを重要ArtifactのReferenceにしてはならない。

## 2.7. Stable Context ID

**Definition:** Artifactの場所や文書番号から独立して、複数Artifactまたは工程をまたいで追跡する意味を識別するID。

**Purpose:** 文書移動、統合、分割、実現手段の変更後も、同じContextのRelationと履歴を維持する。

**Authority:** [Documentation](00_03_Documentation.md#8-stable-context-id)のAssignmentとAllocation規則に従うProjectの採番Authority。

**MUST:** CRDD標準では、Assignment Criteriaを満たす`REQ`、`UX`、`IA`、`UI`、`SPEC`だけに使用する。

**MUST NOT:** ファイル名、Document Number、`CHG-*`、Architecture、Decision、Evidence、Test、Release等のArtifact IDと同一視してはならない。

## 2.8. Context Selection

**Definition:** 特定の作業、Agent、Skill、Reviewに必要な既存Contextを、対象Revisionへの参照として選んだInput Set。

**Purpose:** Repository全体を無差別に渡さず、必要なContext、Preserved Intent、Boundary、Known Uncertaintyを明示する。

**Authority:** Selectionを構成するOwner、Invoker、Parent Agent、またはOrchestrator。正本Authorityは参照元Contextに残る。

**MUST:** Purpose、Scope、Source、Revision、Preserved Intent、Known Uncertaintyを必要な粒度で明示する。

**MUST NOT:** 正本Contextを複製して独立更新し、別の正本を作ってはならない。

`Context Package`はContext Selectionを保存・受け渡すArtifact表現として使用できるが、別のContext Typeではない。詳細なInput契約は[Agent](00_10_Agent.md)と[Skill](00_11_Skill.md)、参照規則は[Documentation](00_03_Documentation.md)を参照する。

## 2.9. Change Trace

**Definition:** 一つのPrimary Change Intentについて、Trigger、Expected / Actual Impact、関連Context、実装、検証、Release帰属を`90_Release/Changes/CHG-*.md`で接続するTrace Artifact。

**Purpose:** Ticket、Pull Request、Commitだけでは失われる変更理由と影響範囲を、Canonical ContextからRelease結果まで追跡可能にする。

**Authority:** Change Trace Owner。各PropertyのAuthorityは参照先のCanonical Artifact、工程、Human Authority、Release Authorityに残る。

**MUST:** Trigger、Primary Intent、Expected / Actual Impact、関連Context、Implementation / Verification Reference、Canonical Context Update、Release Dispositionを必要な範囲で保持する。

**MUST NOT:** Requirement、SPEC、Architecture、Phase Approval、Impact Audit、Verification、Git Log、CHANGELOG等の正本をChange Trace内へ複製して置き換えてはならない。

`CHG-*`はChange Traceを参照するArtifact IDであり、Stable Context ID Typeではない。詳細は[`00_12_Change.md`](00_12_Change.md)を参照する。

## 2.10. Workflow

**Definition:** Repository内で反復する作業のTrigger、Input、順序、確認、停止、Handoffを定めたOperational Guide。

**Purpose:** Repository固有の作業方法を再現可能にし、結果を適切なCanonical Artifact、Change Trace、Releaseへ返す。

**Authority:** Workflow Owner。Workflow自体はProduct Decision、Phase Approval、Release ApprovalのAuthorityを持たない。

**MUST:** Purpose、Trigger、Scope、Input Authority、Step、Validation、Stop条件、Output / Handoffを必要な粒度で持つ。

**MUST NOT:** Product Context、Change Trace、Release Record、Agent / Skill共通規範を置き換えてはならない。

詳細は[`00_14_Workflow.md`](00_14_Workflow.md)を参照する。

## 2.11. Release

**Definition:** 検証済みまたは明示的に条件付けされたDistribution Artifactを、特定Version、Environment、利用者へ配布または有効化するHuman DecisionとDelivery Event。

**Purpose:** 対象CHG、配布物、Release Readiness、Known Limitation、Migration、Release結果を接続する。

**Authority:** Project固有のHuman Release Authority。VerificationはRecommendationを返すがReleaseを自己承認しない。

**MUST:** 対象Version / Environment、Included Scope、配布物、判断、条件、結果を必要な粒度で追跡可能にする。

**MUST NOT:** Verification完了、Merge、Build成功をRelease承認またはRelease完了と同一視してはならない。

ReleaseはDiscoveryからVerificationまでと同じ設計工程ではない。詳細は[`00_13_Release.md`](00_13_Release.md)を参照する。

## 2.12. Skill

**Definition:** 特定のContextをInputとして受け取り、質問・分析・変換・Reviewを通じて定義済みOutputへ導く再利用可能な作業方法。

**Purpose:** 専門知識や判断手順を、人間・AI・Expertが再現可能な形へする。

**Authority:** Skill自体はAuthorityを持たない。実行者と対象ContextのAuthorityに従う。

**MUST:** Purpose、Input、Output、Authority Boundary、終了条件を持つ。

**MUST NOT:** Skillの実行完了をPhase Gateの承認と同一視してはならない。

詳細は[`00_11_Skill.md`](00_11_Skill.md)を参照する。

## 2.13. Phase Gate

**Definition:** 特定のFeature、Change、Revisionを次の活動へ進めるか、人間が条件とEvidenceを確認して判断する境界。

**Purpose:** 文書の存在ではなく、Contextの成熟度、Risk、未決、Verificationを基に進行を制御する。

**Authority:** Gateごとに定義されたHuman Approver。

**MUST:** Scope、対象Revision、Exit Criteria、判断、条件、残存Riskを保持する。

**MUST NOT:** AIが重要Gateを自己承認してはならない。

共通のHandoff不変条件は[Transformation Invariants](00_01_Principles.md#62-transformation-invariants)、実行時のRouteとHandoffは[Skill](00_11_Skill.md)、ArtifactのRevisionは[Documentation](00_03_Documentation.md)、変更のImpact Traceは[Change](00_12_Change.md)、工程固有条件とReopenは各工程文書の`Phase Gate Criteria`を参照する。

## 2.14. Trace

**Definition:** Context、Artifact、Decision、Requirement、Behavior Specification、Implementation、Verification等の由来・実現・制約・検証関係を追跡できるRelation。

**Purpose:** 上流Intentから下流成果物へ、下流成果物から上流理由へ双方向に遡れるようにする。

**Authority:** RelationのOwnerまたは対象Context Authority。

**MUST:** Relationの意味、Source / Target、対象Revisionを必要な粒度で保持する。

**MUST NOT:** ファイルLinkが存在するだけで意味的Traceが成立したとみなしてはならない。

詳細は[`00_03_Documentation.md`](00_03_Documentation.md)のStable Context IDとTraceabilityを参照する。

## 2.15. Gap, Disposition, Unresolved Gap, and Open Question

**Gap Definition:** 対象Scopeで必要な責務、Coverage、Trace、整合、Evidence、Decision、Artifact、またはVerificationが不足・矛盾・未確認であり、期待する状態との差があること。

**Undispositioned Gap Definition:** 検出したGapのうち、対応、保留、Risk受容、対象外、影響なし等のDispositionを、必要なAuthorityがまだ決定していないもの。

**Unresolved Gap Definition:** 検出したGapのうち、修正、根拠付き`Covered` / `No Impact`判定、または再検証によって解消を確認していないもの。`Deferred`、`Accepted Risk`、`Out of Scope`等のDispositionが決まっていても、対象Scope、より広いProduct Scope、将来Revisionのいずれかで解消または再評価が必要ならUnresolved Gapとして追跡する。

**Open Question Definition:** 回答、調査、Evidence、または人間判断を必要とする未決の問い。Open QuestionはGapの原因または解消手段になり得るが、未作成Artifact、Coverage漏れ、正本Conflict、未検証状態そのものと同一ではない。

**Purpose:** 未解決事項を曖昧な一語へ集約せず、何が不足し、なぜ必要で、進行へどう影響し、誰がどう解消するかを追跡可能にする。

**Authority:** Gapの検出・分類候補は人間、AI、Audit、Verificationが作成できる。重要なDisposition、延期、Risk受容、Scope外判定は、対象PropertyまたはScopeのHuman Authorityが決定する。

**MUST:** Unresolved Gapは、Type、Description、Reason、Impact、Disposition、Blocking / Non-blocking、Owner、Next Action / Route、ResolutionまたはReopen ConditionをRiskに応じて保持する。`Deferred`、`Accepted Risk`、`Out of Scope`では、判断したAuthority、適用Scope、期限または再評価Triggerも保持する。人間向けには「残っている未解決事項」等の自然なLabelと具体的な内容を示す。

**MUST NOT:** `Open Gap`、`Gapあり`等のLabelだけを表示してはならない。Open Questionへの回答だけで、別に存在するCoverage、Conflict、Evidence、VerificationのGapまで解消したとみなしてはならない。

Gap / Impact Audit固有のGap Type、Disposition、Impact Levelは[`00_53_Gap_Impact_Audit.md`](00_53_Gap_Impact_Audit.md)を参照する。

---

# 3. Responsibility and Authority Terms

## 3.1. Human

価値、意味、Priority、Trade-off、Risk Acceptance、重要Decision、最終責任を担う人間主体。

Humanはすべての作業を自ら行う必要はないが、AIまたはSystemへ委譲した作業の判断責任まで自動的に移転したとはみなさない。

## 3.2. AI

Contextの抽出、整理、比較、提案、Draft、変換、実装、検証支援を行う非人間主体。

AIはProposalを作成してよいが、Human Authorityが必要なDecision、Gate、Risk Acceptanceを自己承認してはならない。

## 3.3. System

定義済みRuleに従って観測、処理、保存、検証、通知等を行う実行主体。Systemの出力は、Rule、Environment、Versionを含むProvenanceを必要とする。

## 3.4. Owner

Context、Artifact、Process、Index等を維持し、更新・Review・廃止・Escalationを管理する主体。Ownerと最終Authorityは同一でなくてよい。

## 3.5. Authority

特定Scopeについて、採用、承認、却下、Risk受容、正本変更を最終決定できる権限。

AuthorityはRole名だけでなく、対象Product、Property、Change、Release、期間によって定義する。

## 3.6. Reviewer

ContextまたはArtifactが、Source、Contract、Quality、Boundary、Evidenceを満たすか確認し、Findingと推奨判断を返す主体。Reviewerは重要なRiskを自動受容しない。

Independent Reviewでは、作成者の結論や内部思考ではなく、対象Scope、Revision、Source、適用Contract、Criteria、EvidenceからFindingを再構成する。独立性は必ず別人であることだけを意味しないが、AIが作成・変換した成果物のPhase Transition Reviewは、別Review Subagent、作成時Contextを引き継がないClean Session / Agent、または人間Reviewerが行う。同じActive Context内のSelf Reviewで代替しない。ReviewerはReview Resultを返すが、Phase Gateを承認しない。

## 3.7. Approver

特定のContext、Gate、Baseline、Release等を正式採用するHuman Authority。AIはApproverになれない。

## 3.8. Agent and Subagent

Agentは、特定の目的、Authority、Input / Output Contractに従って作業するHuman、AI、System、または複合実行主体である。Skill、Plan、Task等を実行し、ContextやArtifactを生成・変換・検証する。

AgentのAuthorityはAgent ContractとHuman Authorityによって付与される。重要作業ではRole、Scope、Input、Output、Action Boundary、Stop / Escalation条件を明示し、自身の専門責務を越える重要Decisionを自己承認しない。

Subagentは、Parent AgentまたはOrchestratorから限定されたScope、Context、Action Authority、Output Contractを受けて作業するAgentである。

Subagentは独立したAuthorityを意味しない。詳細な委譲、Access、Result、統合、Promotion規定は[`00_10_Agent.md`](00_10_Agent.md)を参照し、CRDD Coreは特定のSubagent構成を要求しない。

---

# 4. Lifecycle and Status Terms

## 4.1. Flow and Lifecycle Boundaries

CRDDでは、意味の異なる流れをすべて`Lifecycle`と呼ばない。

| Canonical Term | Meaning | Authority |
|---|---|---|
| End-to-End Transformation Flow | Realityから得たContextの意味変化と、DiscoveryからVerificationまでの専門工程による具体化・Learning還元を接続する流れ | [Principles](00_01_Principles.md)、本書のContext Type定義、各工程文書 |
| Change Trace | 一つの変更のTriggerから影響、実装、検証、Release帰属までの追跡 | [Change](00_12_Change.md) |
| Skill / Agent Run | 一回の専門活動または委譲実行の開始からHandoffまで | [Skill](00_11_Skill.md)、[Agent](00_10_Agent.md) |
| Workflow Execution | Repository固有の反復手順を一回実行し、結果をAuthorityへ返す流れ | [Workflow](00_14_Workflow.md) |
| Release Flow | Release ReadinessからHuman Release Decision、配布・有効化、Release Verificationまでの流れ | [Release](00_13_Release.md) |

## 4.2. Status Terms

StatusはContext Type、Artifact、Document、Gate、Releaseによって意味が異なる。以下はCanonicalな共通意味であり、詳細な遷移は各専門標準へ委譲する。

| Status | Canonical Meaning |
|---|---|
| `Candidate` | 検討対象として識別されたが、まだDraftまたは採用対象として確定していない |
| `Draft` | 作成中であり、Authorityによる採用前 |
| `Open` | 対象の追跡または処置が開始され、まだ終了していない |
| `Not Started` | 対象Scopeの作業または検証をまだ開始していない |
| `Reviewed` | 指定されたReviewerが確認済み。採用または承認を意味しない |
| `Accepted` | 対象用途で使用することをHumanが認めた。Formal Approvalを必要としないContextにも使用する |
| `Approved` | 定義済みAuthorityが正式承認した |
| `Active` | 現在有効なContext、Baseline、Ruleとして使用されている |
| `In Progress` | 対象Scopeの作業または処置を実行中 |
| `Implemented` | 対応する実装が存在する。正しさや検証完了を意味しない |
| `Verified` | 対象Revisionが定義済みVerificationを満たした |
| `Released` | 特定Version / Environmentへ配布または有効化された |
| `Completed` | Run、Plan、Workflow等の定義済み終了条件を満たした。工程完了やReleaseを自動的に意味しない |
| `Closed` | 対象の結果、残課題、後続参照を処置し、追跡を終了した |
| `Rejected` | 検討または採用対象から明示的に除外された |
| `Deferred` | 今回は採用・実行せず、後続時点へ送られた |
| `Cancelled` | 採用または実行を完了せず、明示的に終了した |
| `Failed` | 実行を試みたが、定義済みResultまたはConditionを満たせなかった |
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
Verified ≠ Released
Completed ≠ Closed
Accepted ≠ Decision（Context TypeとStatusは別概念）
Stable ≠ Immutable
Recovered ≠ Confirmed
```

共通語だけでは対象を誤認する場合、Domainを付けて表す。

```text
Document Status
Context Status
Phase Coverage / Approval
Implementation Status
Verification Status / Result
Agent Result / Skill Run Status
Change Trace Status
Release Status / Decision
```

`Not Verified`、`Partially Verified — Human Authorized`等は[Verification](00_29_Verification.md)、Release Readiness Recommendationは[Verification](00_29_Verification.md)、配布・有効化のRelease Decision / Statusは[Release](00_13_Release.md)、Agent ResultとSkill RunのStatusは[Agent](00_10_Agent.md)と[Skill](00_11_Skill.md)を正本とする。専門Statusを本表の共通語へ無理に丸めない。

---

# 5. Canonical Terms and Boundary Language

| Canonical Term | Related / Deprecated Language | Boundary Rule |
|---|---|---|
| Observation | Fact / Finding | Observationは解釈前の記録。FindingはContractとの差異を評価した結果であり、同義語にしない |
| Evidence | Proof / Reference | EvidenceはSourceと取得条件を持つ根拠。Referenceだけ、または完全証明を意味しないProofと同一視しない |
| Interpretation | Analysis / Inference | 根拠に対する意味付けであることとConfidenceを明示する |
| Hypothesis | Assumption | Hypothesisは検証対象、Assumptionは作業上置いた前提。未検証である点が同じでも用途を区別する |
| Proposal | Idea / Solution Candidate / Recommendation | Statusが採用前である限りProposalへ統一する |
| Decision | Adopted Proposal / Approval | Human Authorityによる判断だけをDecisionと呼ぶ |
| Context Repository | Documentation Repository | Context、Trace、Decisionを扱う場合にDocumentationだけへ狭めない |
| Canonical Artifact | Draft / Copy / Index / View | 現在のAuthorityを持つArtifactだけをCanonicalと呼ぶ。参照用Viewは正本を置き換えない |
| Property Authority | Source of Truth | CRDDでは媒体全体よりProperty単位のAuthoritative Sourceと更新責任を明示する |
| Artifact Reference | Stable Context ID | Artifactの所在・Revisionを指すReferenceと、意味を追跡するStable Context IDを区別する |
| Stable Context ID | Document Number / File Name / `CHG-*` | Stable Context IDは`REQ`、`UX`、`IA`、`UI`、`SPEC`の意味識別子。文書やChange Traceの識別子ではない |
| Context Selection | Context Package | Context PackageはSelectionを受け渡す表現であり、別のContext Typeや正本ではない |
| Requirement | Need / Feature | NeedはSourceとなる必要、FeatureはProduct Scopeまたは実現単位、Requirementは満たすべき条件 |
| Behavior Specification | Behavior Requirement / Behavior Contract / Requirement | Canonical TermはBehavior Specification。Requirementや契約的役割と別Context Typeとして区別する |
| Plan | Roadmap Item / Workflow | Planは特定Scopeの実行計画、Roadmap Itemは採用済みDeferred Work、Workflowは反復可能な作業方法 |
| Implementation | Code / Delivery | CodeだけでなくConfiguration、Migration、Infrastructure、Developer Test、Build等を含むが、Releaseとは区別する |
| Verification Result | Test Result / Validation Result / Review Result / Result | 何をどのRevision・条件で検証したResultかを明示し、曖昧な`Result`を避ける |
| Learning | Summary | 要約されただけではLearningへ昇格しない |
| Change Trace | Change Record / Task / Pull Request | `CHG-*`は変更の意味と影響を追跡する。Task、PR、Git Log、CHANGELOGの代替ではない |
| Workflow | Plan / Skill | WorkflowはRepository固有の反復手順、Planは個別Scopeの計画、Skillは再利用可能な専門作業方法 |
| Release | Verification / Deployment | VerificationはReadinessを評価し、Deploymentは実行手段。ReleaseはHuman DecisionとDelivery Eventを含む |
| Phase Gate | Skill Completion / Artifact Completion | Gateは対象Scope / RevisionへのHuman Handoff Decisionであり、Run終了や成果物完成から自動推定しない |

新しいCore Termを導入する場合、使用前または同一Change内で本書へ定義・Alias・既存Termとの境界を追加しなければならない。

Core Context TypeごとのAuthorityと禁止事項は各定義を正本とする。CRDD適用Criteriaと評価方法は[Conformance Audit](00_52_Conformance_Audit.md)を参照し、本書に重複したChecklistを置かない。
