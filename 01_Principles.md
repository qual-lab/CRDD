<a id="crdd-principles"></a>

# CRDD原則（Principles）

Version: v0.5.1
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-22
Related:
- [00_Overview.md](00_Overview.md)
- [02_Terminology.md](02_Terminology.md)
- [03_Documentation.md](03_Documentation.md)
- [10_Agent.md](10_Agent.md)
- [11_Skill.md](11_Skill.md)
- [12_Change.md](12_Change.md)
- [52_Conformance_Audit.md](52_Conformance_Audit.md)
- [53_Gap_Impact_Audit.md](53_Gap_Impact_Audit.md)

---

> この文書で分かること（非規範の案内）
>
> - CRDDとは何か、何を守る方法なのか
> - 人間とAIがそれぞれ何を担うか
> - 上流の目的を下流へ、下流の学びを上流へどうつなぐか
> - 次工程へ進むときに誰が何を判断するか
> - CRDD適用を名乗るための最低条件

<a id="document-responsibility"></a>

# 文書の責務（Document Responsibility）

本書は、CRDDの存在理由、守る不変条件、人間とAIのAuthority、Context Continuity、工程遷移の原則を定義する。

| Section | Responsibility |
|---|---|
| 1. CRDD and Context Repository | CRDDとContext Repositoryの定義、関係、Data Ownership境界 |
| 2. Purpose and Core Belief | CRDDの目的、基本信条、人間が集中すべき価値 |
| 3. Conformance Boundary | CRDD準拠を名乗れる最低境界 |
| 4. What CRDD Preserves | 守るContext、Toolとの関係、完了観 |
| 5. Human and AI Authority | 人間・AI・専門家の一般的な判断境界と変更権限 |
| 6. End-to-End Context Continuity | Contextの意味変化、Product工程、工程別責務を双方向に接続する原則 |

Canonical TermとContext Type / Statusは[`02_Terminology.md`](02_Terminology.md)、Artifact、Evidence、Decision / Rationale、Stable Context ID、Traceの表現・保存は[`03_Documentation.md`](03_Documentation.md)を正本とする。本書はそれらを再定義しない。

---

<a id="1-crdd-and-context-repository"></a>

# 1. CRDDとコンテキストリポジトリ

CRDD（Context Repository-Driven Development）は、プロジェクトのWhyと人間の判断を失わず、AIと専門家がそのContextを参照してProductを一気通貫で具体化・検証できるようにする開発方法論である。

Context Repositoryは、単なる文書置き場ではない。Productの記憶、現在有効なContextへの入口、判断経緯、Artifact参照、変更履歴を、人間とAIが継続利用できる形で接続する情報基盤である。

Context Repositoryは媒体ではなく論理的な責務である。GitやMarkdownを採用しただけではCRDDにならない。

CRDDは、利用者・組織・権利者が作成したProject Record、業務文書、Evidence、Ticket、外部Artifact等の所有権を取得しない。CRDDが定義するのはContextの構造化・運用方法であり、Dataそのものの権利ではない。CRDD方法論の著作物には[LICENSE](LICENSE)を適用する。

機密情報、個人情報、契約上制限されたDataをContext Repositoryへ無条件に複製しない。Access Control、Redaction、Retention、Deletion、外部参照の利用可否は、適用されるSecurity / Privacy / Legal Authorityに従う。

---

<a id="2-purpose-and-core-belief"></a>

# 2. 目的と基本信条（Purpose and Core Belief）

CRDDの目的は、開発速度だけを上げることではない。人間のIdea、意味、判断を劣化させずContext Repositoryへ継承し、AIが上流Contextを参照して下流作業を支援できるようにする。専門工程を分断ではなく意味変換として接続し、実装と利用から得たLearningを次の判断へ戻すことで、人間が市場理解、価値創出、重要判断へ集中できる状態を目指す。

```text
作業をAIへ。
判断を人間へ。
思想をContext Repositoryへ。
```

AIは、探索、整理、比較、変換、提案、実装、検証を支援する。

人間は、意味、価値、優先順位、採用・却下、Risk受容、最終承認、結果責任を担う。

Context Repositoryは、両者が参照するOrigin、Intent、Decision、Evidence、Contract、Learningを継承する。

この分担において、AI時代における人間の価値は、作業量ではなく次にある。

```text
Idea
市場・現場理解
まだ言葉になっていないProblemの発見
意味づけ
価値判断
優先順位
何を作り、何を作らないかの判断
結果に対する責任
```

CRDDはAIに人間の責任を渡す方法ではない。AIによって作業を効率化し、人間が本来の判断へ集中するための方法である。

---

<a id="3-crdd-conformance-boundary"></a>

# 3. CRDD準拠の境界（CRDD Conformance Boundary）

CRDD準拠を表明するには、CRDD Coreと対象活動に適用されるProfileをEvidenceに基づいて評価し、すべての必須Criteriaを満たさなければならない。

次を採用しただけでは、CRDD準拠とは認めない。

```text
特定のFolder構成
MarkdownやGit
AI Coding Tool
AgentまたはSubagent
TemplateやSkill
多数の文書
Phase名の利用
```

Core Criteriaが未評価または未達の場合は、`CRDD Conformant`ではなく`CRDD-Inspired`として扱う。

詳細なCriteria、Required Evidence、Evaluation、Conformance Claimは[`52_Conformance_Audit.md`](52_Conformance_Audit.md)を正本とする。

---

<a id="4-what-crdd-preserves"></a>

# 4. CRDDが保持するもの（What CRDD Preserves）

<a id="41-preserved-context"></a>

## 4.1. 保持するコンテキスト（Preserved Context）

実装やTestはAIで効率化しやすい。一方、何を作るべきか、なぜ作るのか、何を捨てるのかは、下流だけから決められない。だからCRDDは、実装方式より長く維持すべきContextを守る。

| Preserved Context | Question |
|---|---|
| Origin | なぜ始めたのか |
| Actor / Situation | 誰が、どの状況にあるのか |
| Problem / Evidence | 誰の何を、どの根拠で変えたいのか |
| Desired Outcome | どのような変化を目指すのか |
| Intent / Principle | 何を大切にするのか |
| Non-goal | 何を目的にしないのか |
| Open Question / Required Human Decision | 何が未確定で、誰の判断を必要とするのか |
| Decision | なぜその選択をしたのか |
| Alternative | なぜ別案を採用しなかったのか |
| Risk / Constraint | 何を受け入れ、何に制約されたのか |
| Continuity | 担当者、AI、技術が変わっても意味を辿れるか |
| Learning | 実装・検証・利用から何が分かったのか |

下流へ進む前に、対象Scopeの上流判断に必要なPreserved Contextを取得可能にする。まだ存在しないContextを埋まっているように見せず、未確定事項はOpen Question、必要な判断はRequired Human Decisionとして明示する。

完全な上流Contextが存在しないLegacy / Brownfieldでは、現在の実装を正解と仮定せず、Recovered Context、不確実性、確認方法、Ownerを明示する。

Origin、Intent、UX、Contractは、特定のCode、Framework、Infrastructure、Provider、AI Agent、Delivery Engineと同一ではない。これらは変更可能な実現手段であり、現在のImplementationをOrigin、Product価値、永続的な正解と同一視しない。

```text
CRDD Context Repository
        ↓
Delivery Adapter
        ├─ AI Coding Agent
        ├─ SDD Tool
        ├─ Human Development Team
        └─ Future Delivery Engine
```

ImplementationまたはDelivery方式を交換しても、Origin、Product価値、Decision、Acceptanceを再利用・再評価できる状態を維持する。

<a id="42-tools-are-views-and-execution-surfaces"></a>

## 4.2. ToolはViewと実行面

Jira、Redmine、GitHub Issues、Backlog、Figma、CI、Agent Runtime等は、Contextの表示・編集・実行Surfaceになり得る。

すべてをMarkdownへ複製する必要はない。Figma、Code、Issue、Test、Build、外部System等をArtifact Referenceとして接続し、PropertyごとのSource of TruthとAuthorityを識別できればよい。

```text
Context Repository = Why、判断、Contract、Relationの論理的な正本
Task Tool          = 進行状況や作業単位のView
Design Tool        = UI / Visual PropertyのAuthorityになり得るArtifact
Code / CI          = Implementationと実行・検証事実のArtifact
```

Tool内のPropertyが正本である場合は、そのAuthority、Revision、Context Repositoryからの参照を明示する。Ticketだけを見ても、なぜ必要か分からない状態を避ける。

<a id="43-definition-of-done"></a>

## 4.3. 完了の定義（Definition of Done）

CRDDでは、Codeが動いたことだけを完了としない。

```text
Working Software
+ Fresh Verification
+ Readable Context
+ Traceable Decision
+ Returned Learning
```

対象Scopeについて、少なくとも次を説明できなければならない。

```text
実装が現在Revisionで動く
適用するAcceptanceとQuality Conditionに対して検証されている
Origin、UX Intent、UI / SPEC、Architectureと既知の矛盾がない
重要な判断理由とEvidenceを辿れる
未検証、Known Limitation、Residual Riskを隠していない
次の人間またはAIが正本と現在地を理解できる
得たLearningが責務を持つContextへ戻っている
```

<a id="44-documents-are-not-enough"></a>

## 4.4. 文書だけでは足りない

CRDDは文書量を増やす手法ではない。重要なのは、AIと人間が検索、比較、判断、変換、検証に利用できる粒度でContextを残すことである。

<a id="weak"></a>

### 弱い状態（Weak）

```text
使いやすくする。
AIで便利にする。
情報を整理する。
```

<a id="strong"></a>

### 強い状態（Strong）

```text
Problem: 複数Toolへ情報が分散し、重要な未決事項とRiskを見落としやすい。
Pain: 情報探索に時間がかかり、判断時間が削られる。
Principle: AIは情報を整理・提案し、人間は判断する。
Outcome: 確認対象、背景、Evidence、次Actionを同じContextで理解できる。
Non-goal: AIが重要判断を自動確定することではない。
```

同時に、構造化のために人間のRaw Voiceや意味を削り、空のTemplateへ変えてはならない。

---

<a id="5-human-and-ai-authority"></a>

# 5. 人間とAIの決定権限（Human and AI Authority）

<a id="51-authority-principle"></a>

## 5.1. 決定権限の原則（Authority Principle）

```text
AI = Work Acceleration and Context Transformation
Human = Meaning, Value, Decision, and Responsibility
Expert = Professional Judgment and Quality Accountability
Repository = Context Continuity
```

AIまたはAgentという名前だけではAuthorityを得ない。Authorityは対象Property、Scope、Revision、Human Decision、Agent Contractによって明示される。

<a id="52-authority-boundary"></a>

## 5.2. 決定権限の境界（Authority Boundary）

<a id="521-ai-may-do"></a>

### 5.2.1. AIが実行できること

AIはAuthority Boundary内で次を行える。

```text
関連Contextと過去Decisionを探索する
情報を要約・比較・構造化する
矛盾、Gap、Risk、影響範囲を示す
複数案とTrade-offを提示する
Professional ContextのDraftを作る
Code、Test、Review、Verificationを実行する
Decision CandidateとRationale Draftを作る
LearningとContext更新候補を示す
```

AIの機能的なRoleは固定Agent構成を要求しない。必要に応じて次のModeを単一Agentまたは複数の実行者へ割り当てる。

| Mode | Contribution | Boundary |
|---|---|---|
| Librarian | 過去Context、Decision、Conflict、未決、Evidenceを発見する | 判断を確定しない |
| Strategist | 価値、差別化、Roadmap、PriorityのOptionを比較する | 戦略と優先順位を確定しない |
| Developer | Code、Test、Refactor、Impact説明を行う | 上流Contractを無言変更しない |
| Reviewer | 不一致、Test不足、破壊的変更、更新漏れをFindingとして返す | Risk受容と最終承認を行わない |

RoleのInput、Output、Stop、Escalation、統合は[`10_Agent.md`](10_Agent.md)を正本とする。

<a id="522-ai-must-not-decide"></a>

### 5.2.2. AIが決定してはならないこと

AIはHuman Authorityなしに次を確定しない。

```text
Origin、Product価値、Non-goalの変更
対象ActorまたはProblemの変更
重要Featureの採用・却下
Roadmap PriorityとCommitment
Approved Decision / Rationaleの変更
重要Business Rule、UX / UI責務、Architecture方針
Security、Privacy、Governance、Data Retention、外部公開方針
Compatibility破壊、重大Migration、Risk受容
Acceptanceの弱体化、未検証ScopeのRelease
CRDD原則、Authority、Conformance Boundary
```

<a id="53-proposal-decision-execution-review"></a>

## 5.3. 提案・判断・実行・Review

```text
AI / Expert Proposal
→ Human Review and Decision
→ Authorized Execution
→ Independent or Fresh-context Verification
→ Human Acceptance / Risk Decision
→ Canonical Context and Learning Update
```

AIの生成物は生成時点では正本ではない。Human Reviewで既存Context、Evidence、Uncertainty、影響、Authorityを確認し、採用した結果を責務を持つCanonical Artifactへ反映する。

非自明な変更では、Authority、対象Scope / Revision、関連Contextを確認し、影響、Risk、Verification、Human Decision NeedをReview可能な形で示す。実行Contractは[Agent](10_Agent.md)と[Skill](11_Skill.md)、変更のImpact Traceは[Change](12_Change.md)を正本とする。

<a id="54-conflicting-evidence"></a>

## 5.4. 競合する根拠（Conflicting Evidence）

AIの分析結果が、人間の報告や別Systemの記録等の信頼できるEvidenceと食い違う場合、一方を自動採用して他方を削除しない。

```text
競合するEvidenceをSourceとともに並べる
Freshness、取得条件、適用Scopeを示す
不一致自体をHuman Decision事項として明示する
AI Inference、Observed Fact、Human-confirmed Informationを区別する
```

<a id="bad"></a>

### 悪い例（Bad）

```text
AIが「対応済み」と判定し、担当者の「未対応」という報告を上書きして確定表示する。
```

<a id="good"></a>

### 良い例（Good）

```text
両方をSource付きで表示し、「情報源が一致していない」と示して人間確認へ戻す。
```

<a id="55-progressive-autonomy"></a>

## 5.5. 段階的な自律性（Progressive Autonomy）

Context Repositoryまたは外部Systemへ変更を行うAI機能は、段階を飛ばして自律性を上げない。

```text
Level 1: Read Only
Level 2: Draft
Level 3: Assisted Edit + Human Approval
Level 4: 検証済みの狭い低Risk ActionだけをAuthorized Safe Editとして実行
```

昇格は、実績、Fresh Verification、失敗時の影響、Authority、取消・回復可能性に基づくHuman Decisionとする。機能追加のついでに自動昇格しない。

Folder番号だけでLevelを決めない。Property Authority、Status、Revision、Risk、Change Scopeに基づいて判断する。Code、Test、Evidence整理、Link修正であっても、上流Contractや保護された意味を変える場合はSafe Editではない。

<a id="56-change-safety"></a>

## 5.6. 変更の安全性（Change Safety）

Authorityまたは対象Revisionが不明、Approved Contextが競合、Scope外または不可逆な変更が必要、Security / Privacy / Compatibility / Data Meaningへ影響する場合、AIは推測で進めず停止または限定し、必要なHuman Authorityへ戻す。

AIは、古いContext、Decision / Rationale、Evidence、Stable IDを無言で削除・再利用・上書きしない。Status、Supersedes、History、Revisionは[Documentation](03_Documentation.md)、変更のTrigger、Impact、正本・実装・検証・Release間のTraceは[Change](12_Change.md)を正本とする。

---

<a id="6-end-to-end-context-continuity"></a>

# 6. 一気通貫のコンテキスト継続性（End-to-End Context Continuity）

一気通貫のコンテキスト継続性（End-to-End Context Continuity）とは、担当者、AI、Tool、技術、組織が変わっても、OriginからLearningまでの意味と判断を双方向に辿れる状態である。

- 上流から下流へ、Intent、Constraint、Obligation、Reasonを伝える
- 下流から上流へ、Limitation、Conflict、Evidence、Learningを返す

Contextの意味変化と専門工程間の成果物変換を、別々のLifecycleとして扱わず、一つのEnd-to-End Transformation Flowとして接続する。

CRDDの一気通貫は、一人または一組織がすべてを担当することではない。専門領域が変わってもContextが分断されないことを意味する。

RealityそのものをRepositoryへ保存することはできない。Realityから得たObservationとEvidenceを解釈し、HypothesisとProposalを経てHuman Decisionへつなぎ、その判断を専門工程で具体化・検証する。

```text
Reality / Origin / Source
        ↓ observe・collect・interpret・propose・decide
Discovery
        ↓
UX
        ↓
IA
        ↓
UI ⇄ Behavior Specification
        ↓
Architecture
        ↓
Implementation
        ↓
Verification
        ↓ verify・learn
Verification Result / Learning
        ↓
Canonical Context Update / Reopen / New Proposal
        ↺ affected phase
```

Observation、Evidence、Interpretation、Hypothesis、Proposal、Decisionは、Discoveryだけで完結する段階名ではない。各工程で新しいEvidence、Proposal、Human Decisionが生じ得る。Context Typeを工程名と同一視せず、次を守る。

```text
Observed Fact、Interpretation、Hypothesis、Proposal、Decisionを混同しない
AI InferenceをHuman-confirmed Factとして保存しない
元Contextを破壊的に上書きせず、RelationとRevisionを保つ
不確実性を確定事項へ無言昇格しない
新EvidenceとのConflictを隠さない
```

これは固定Waterfallではない。一つのEvidenceが複数のInterpretationを支え、ProposalがRejected / Deferredとなってよい。UIとSPECは並行し、Prototype、Technical Spike、部分Handoff、反復、上流Reopenを許容する。Project全体ではなく、Feature、Use Case、Change、Release等のScopeごとに異なる進行状態を持ってよい。

作って終わりにしない。実装・検証・運用・利用から得た制約、失敗、結果、仮説の支持・反証を、責務を持つCanonical Contextへ戻し、必要に応じてChange TraceまたはRoadmapへ接続する。

Context TypeとRelationの定義は[`02_Terminology.md`](02_Terminology.md)、ProvenanceとTraceは[`03_Documentation.md`](03_Documentation.md)を正本とする。

<a id="61-transformation-layers-and-responsibility"></a>

## 6.1. 変換層と責務（Transformation Layers and Responsibility）

各専門領域は、上流Contextを次の領域で判断・検証できる形へ変換するTransformation Layerである。AI / Agentは候補作成、整理、検査、実行を支援し、Human / Expertは意味、採否、Trade-off、Risk、Acceptanceに責任を持つ。

| Layer / Activity | Main Question → Transformation Value | AI / Agent Contribution | Human / Expert Authority |
|---|---|---|---|
| Discovery | 何が起き、何を要求として扱うか → Origin、Evidence、REQ、Route | Source整理、不足質問、仮説候補 | Origin、Problem Framing、Requirement昇格 |
| UX | 誰をどの状態へ変えるか → Outcome、Journey、Principle、Risk | Persona / Journey候補、Coverage検査 | 対象者、Outcome、体験価値、原則 |
| IA | 何をどう理解・探索・操作させるか → Object、Relation、Responsibility、Navigation | Object / Relation候補、重複検知 | Domain意味、責務、Authority、用語 |
| UI | 何を見せ、どう認識・操作させるか → Surface、Action、Feedback、State、Variant | Screen / State候補、Contract照合 | Interaction、情報優先度、Visual / Accessibility判断 |
| Behavior Specification | どの条件でSystemがどう振る舞うか → Trigger、State、Behavior、Failure、Acceptance | Behavior構造化、例外・Coverage整理 | Business Rule、Permission、Risk、Acceptance |
| Architecture | 現在の制約でどう成立させるか → Boundary、Data、Interface、Quality、Implementation Rule | Candidate比較、Impact、設計Draft | 技術Trade-off、Security / Privacy、運用責任 |
| Planning / Change | 何をどのScopeと順序で進めるか → Task、Dependency、Commitment、Change Trace | Task、Dependency、Option整理 | Scope、Priority、Commitment、Risk受容 |
| Implementation | 今回どう具体化したか → Code、Configuration、Migration、Developer Test | Code、Configuration、Migration、Developer Test | 重要変更承認、Deviation判断 |
| Verification | OriginとContractを満たしたか → Fresh Evidence、Finding、Residual Risk、Learning | Test、Review、Evidence、Finding | Acceptance、Residual Risk、Release判断 |
| Learning / Feedback | 何を次の判断へ戻すか → Promotion候補、Canonical Context更新、New Proposal | Evidence整理、Promotion候補 | 何を変更・標準化・継承するか |

各工程のEntry、Transformation、Required Responsibility Coverage、Exit、Gate、Auditは各工程文書の`Phase Process Contract`を正本とする。

UIとBehavior Specificationの相互Contractは[`24_UI_Behavior_Specification.md`](24_UI_Behavior_Specification.md)を正本とする。

<a id="62-transformation-invariants"></a>

## 6.2. 変換の不変条件（Transformation Invariants）

各Transformationは、最低限次を取得可能にする。

```text
Source Context
Preserved Intent / Non-goal
Transformation Decision
Assumption / Open Question
Downstream Obligation
Verification Method
```

次の不変条件を守る。

```text
上流の文言ではなく意味を保つ
Intent、Principle、Non-goal、重要Decisionを下流都合で無言変更しない
Hypothesis、Assumption、Open Questionを確定事項へ無言昇格しない
別工程のProperty Authorityを越えて確定しない
新Decisionと、その理由・Evidenceを明示する
上流変更を下流へ、下流の制約・Learningを上流へ伝播する
成果物単体だけでなくSource Intentに対して検証する
反復時も旧判断、変更理由、再確認範囲を失わない
```

技術、工数、環境制約でIntentを満たせない場合、満たせないIntent、Constraint、Alternative、Impact、Recommendationを示し、Human Decisionへ戻す。

Linkが存在するだけではContinuityにならない。重要な下流成果物から上流のIntentとDecisionへ遡れ、上流変更から影響する下流Artifactを確認できなければならない。Stable Context ID、Relation、Traceの表現は[`03_Documentation.md`](03_Documentation.md)を正本とする。

人間による判断、制約、学び、根拠、Findingが確定または変更されたときは、変更影響の伝播確認（Triggered Propagation Check）が必要かを評価する。既存の上流・同層コンテキストへ答える、制約する、矛盾する、または再評価を求める可能性があれば、[Gap / Impact Audit](53_Gap_Impact_Audit.md#43-mandatory-propagation-trigger-and-closure)を実行する。

伝播確認では次を行う。

1. 関連する上流の未決の問い、未解決Gap、前提、判断、制約を探索する。
2. 該当する正本を更新する。または、候補ごとに根拠付き`No Impact`か、既存Contractで対応済みであることを示す。
3. 上流を更新した場合は、そのRevisionから影響する下流コンテキストを再探索する。
4. Findingを責務工程で修正し、更新後Revisionを再監査する。

下流の判断を記録しただけでは、伝播完了にならない。必須更新が正本へ反映されず、未処理Candidateが残る状態を、工程完了、通常Handoff、Change Closure、Release Readinessとして扱わない。

未完了のまま進める場合は、対象の人間決定権限が`propagation_exception`を記録する。未伝播範囲、Risk、Owner、再監査条件を示し、通常のPassと区別する。

次の事実だけから、工程完了やHandoffを自動推定してはならない。

- 文書が存在する
- Skill Runが終了した
- Artifactの完成度が高い
- Implementationが完了した
- Testが`Pass`した

Human Authorityは、対象Scope / Revision、工程固有Criteria、Coverage、Gap、Assumption、Risk、受信側Entryを確認する。そのうえで、進む、条件付きで進む、戻す、Reopenする、のいずれかを判断する。

部分Handoffには、対象Scope、残っている未解決事項（Unresolved Gap）、Risk、Owner、Reopen条件、人間承認を明示する。

通常の工程移行前には、生成・更新担当から分離したIndependent Reviewで、送信工程のExit / Gate、受信工程のEntry、対象Scope全体のCoverage、Trace、Unresolved Gapを対象Revisionに対して評価する。移行に影響するFindingは、原則として送信側または責務を持つ工程で修正し、修正後Revisionを再ReviewしてからHuman Gateへ進む。Audit Runの完了、Findingの記録、後工程へのOwner移管だけをReview Passとみなさない。

Independent Reviewを省略できるのは、対象ScopeのHuman Authorityが明示的に要求し、理由、未Review範囲、Risk、影響、Owner、再Review条件を記録した場合に限る。部分HandoffはReview省略を意味せず、移行するScope自体はReview対象とする。Human Authorityが明示的に受容していない不足を、後工程の通常作業へ暗黙に持ち越さない。

実行時の詳細は、次を正本とする。

- 工程固有のEntry、Exit、Phase Gate Criteria、Reopen: 各工程文書
- Independent ReviewとReview Subagent: [`10_Agent.md`](10_Agent.md)
- Skill RunのRouteとHandoff: [`11_Skill.md`](11_Skill.md)
- 変更のTriggerとExpected / Actual Impact: [`12_Change.md`](12_Change.md)
- Triggered Propagation Check: [`53_Gap_Impact_Audit.md`](53_Gap_Impact_Audit.md)

---

<a id="minimum-principles"></a>

# 最小原則（Minimum Principles）

CRDDを実践するProjectは、最低限次を守る。

```text
Origin、Problem、Intent、Non-goalを現在のImplementationから独立して説明できる
Context Type、Evidence、Interpretation、Hypothesis、Decisionを混同しない
AIはAuthority Boundary内で作業し、重要判断を自己承認しない
Human Authorityが価値、Risk、Priority、最終承認を担う
上流Contextを下流都合で無言変更しない
各工程のRequired Responsibility Coverageを対象Scopeで確認する
重要な下流成果物から上流のIntentとDecisionへ遡れる
UIとBehavior Specificationを対として整合させる
ImplementationとVerificationを別状態として扱う
部分HandoffはScope、Gap、Risk、Owner、Human Approvalを持つ
実装・検証・利用から得たLearningをCanonical Contextへ戻す
CRDD準拠はEvidenceとConformance Criteriaで評価する
```

---

<a id="final-principle"></a>

# 最終原則（Final Principle）

コードは作り直せる。技術とToolは置き換えられる。

しかし、失われたOrigin、意味、判断、Evidenceは後から完全には取り戻せない。

CRDDは、人間の思いと判断をContext Repositoryへ残し、AIと専門家がその意味を失わずProductへ変換し、実装と利用から得たLearningを次の判断へ戻すための方法論である。
