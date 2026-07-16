# CRDD Skill

Version: v0.4.0
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-17
Related:
- [00_01_Principles.md](00_01_Principles.md)
- [00_02_Terminology.md](00_02_Terminology.md)
- [00_03_Documentation.md](00_03_Documentation.md)
- [00_10_Agent.md](00_10_Agent.md)
- [00_12_Change.md](00_12_Change.md)
- [00_52_Conformance_Audit.md](00_52_Conformance_Audit.md)

---

# 1. Purpose and Boundary

本書は、CRDD Skillの共通定義と、Skillを開始、中断、再開、確認、保存、Handoffまで一貫して実行するSkill Runtimeの正本である。

Skillは専門活動とLifecycleを定義する。AgentはSkillまたは限定Taskを、明示されたContext、Authority、Action Boundaryで実行する主体である。AgentのInput、Output、Authority、Access、委譲、Reviewは[Agent](00_10_Agent.md)を正本とする。

工程固有のEntry、Transformation、Required Responsibility Coverage、Exit、Gate、Audit、Artifactは各工程文書を正本とし、本書で再定義しない。本書は全Skillに共通する次の責務だけを持つ。

```text
Skill Definition Contract
Skill Runの状態と再開可能性
共通Run Lifecycle
Guided Interaction
Human Reviewと実行時Handoff
Tool AdapterとRiskに応じた実行Scale
```

Guided Skillは固定Questionnaireではない。既存Contextを読み、次の判断に必要な不足だけを確認し、回答をProfessional Contextへ変換し、人間が変換結果を確認できる状態で次の活動へ渡す。

---

# 2. Skill Definition Contract

各Skillは、工程正本を参照しながら、最低限次を定義する。Skill自体はAuthorityを持たず、実行者と対象ContextのAuthorityに従う。

```yaml
skill:
  id: skill.ui.contract
  purpose: UXとIAをUI Contractへ変換する
  process_authority: 00_25_UI.md
  authority_boundary:
    source: 00_10_Agent.md
    may_propose:
      - UI Contract
    must_escalate:
      - Behavior Rule or Feature Scope change
  entry_conditions:
    - target scope is explicit
    - required UX and IA context is identifiable
  input:
    required:
      - UX Outcome
      - IA Structure
      - Use Case
  responsibility_coverage:
    source: 00_25_UI.md#required-responsibility-coverage
  interaction:
    core_topics:
      - first_information
      - primary_action
      - feedback
    adaptive_topics:
      - permission
      - empty
      - conflict
  professional_knowledge:
    options:
      - existing pattern
      - new contract
    decision_criteria:
      - preserved intent
      - responsibility boundary
    common_failures:
      - missing error and recovery state
  output:
    - UI Contract
    - Open Question
    - Trace
  exit_conditions:
    - required responsibility coverage is evaluated
    - result is reviewable
  stop_conditions:
    - IA responsibility missing
  human_confirmation:
    - preserved_intent
    - responsibility_boundary
    - coverage_state
  handoff:
    route_candidates:
      - type: Skill
        target: skill.spec.behavior
      - type: Prototype
        target: ui interaction validation
```

Skill Definitionは、開始条件、必要Input、質問または分析方針、専門知識、生成Context、停止、確認、終了、Handoffを再現可能にする。工程Contractを参照し、Entry、Coverage、Exit、Gate、Auditの内容をCopyしない。

## 2.1. Guided Skill and Professional Artifact

```text
Guided Skill
= 既存Contextの読込、質問、変換、確認、Routingを行う実行手順

Professional Artifact
= 専門Contextを保存、Review、継承する成果物
```

Professional Artifactは利用者へ空欄を埋めさせるQuestionnaireではない。Skill、専門家、Agent、既存Artifactから更新する。Artifactの共通Property、Stable Context ID、Evidence、Decision、Relationは[Documentation](00_03_Documentation.md)を正本とし、本書で共通Artifact Templateを再定義しない。

## 2.2. Professional Knowledge

専門知識を個人の暗黙知や見出しへ閉じず、Skill Definitionと工程固有のPhase Process Contractから次を取得可能にする。

```text
最初に確認すべきTopic
Required Input
検討すべきOption
Decision Criteria
Common Failure
Required Responsibility Coverageへの参照
Exit / Review / Expert Escalation Condition
```

Skillは専門家を不要にするものではない。定型作業を支援し、人間と専門家が重要判断、例外、品質、成立性へ集中するためのAdapterである。

---

# 3. Skill Run Model

Skillの一回の実行を`Skill Run`として扱う。Skill Runは会話Sessionと同一ではなく、一つのRunを複数Sessionに分けても、一つのSessionで複数Runを実行してもよい。

`run_id`は実行を再開・識別するためのOperational IDであり、CRDD Stable Context IDではない。`RUN-*`等の新しいStable ID Prefixを要求しない。

## 3.1. Run Status, Current Step, and Route

Runの状態、現在Step、次Route、Produced ArtifactのStatusを分離する。

| Run Status | Meaning |
|---|---|
| `NotStarted` | まだ開始していない |
| `InProgress` | 実行中 |
| `Paused` | 再開情報を残して安全に中断した |
| `Blocked` | 外部判断または不足Contextにより進めない |
| `Completed` | Skill DefinitionのRun終了条件を満たした |
| `Failed` | 実行を試みたが契約されたResultを生成できなかった |
| `Superseded` | 後続Runに置き換えられた |

`Current Step`は4章のLifecycle上の現在地であり、Run Statusではない。`Route`は次に行うResearch、Decision、Expert Review、別Skill、Gate Review、Pause、Close等であり、Artifact Statusではない。

Machine-readableな`current_step`は、`SelectSkill`、`Orient`、`LoadContext`、`ConfirmScope`、`AssessGap`、`Interact`、`Transform`、`DetectConflict`、`HumanReview`、`Register`、`DetermineRoute`、`CloseOrPause`を使用する。

Machine-readableな`route.type`は、`Continue`、`Research`、`Decision`、`ExpertReview`、`Skill`、`Prototype`、`GateReview`、`Pause`、`Close`を使用する。

`Completed`はSkill Runの終了だけを表し、Produced Artifactの`Reviewed`や`Approved`、工程完了、Gate Approval、Change Trace Closureを意味しない。

## 3.2. Minimum Run Record

```yaml
skill_run:
  run_id: skill-run-20260717-001
  skill: skill.ux.outcome
  run_owner: Product Design Lead
  executed_by: ui-agent-contract-123
  status: InProgress
  current_step: HumanReview
  scale: Standard
  update_strategy: Revise
  scope:
    change_trace: 90_Release/Changes/CHG-000004_Topic_Detail.md
    feature: Important Topic Review
  input_revision:
    - artifact: 01_Discovery/00_Product_Origin.md
      revision: 2
    - artifact: 01_Discovery/01_Product_Requirements.md
      anchor: decision-fragmentation
      revision: 3
  completed_topics:
    - target_user
    - before_state
    - desired_outcome
  open_topics:
    - success_signal
  produced:
    - id: UX-000004
      revision: rev-4
      artifact_status: Draft
  route:
    type: Continue
    target: Register
    owner: Product Design Lead
    required_input: []
  result_summary: UX Outcome draft is ready for registration
```

重要なRunは、継続、Escalation、監査を担うRun Ownerと、実行した人間、Agent Contract、またはSystemを識別する。Stable Context IDを付与するのは[Documentation](00_03_Documentation.md)の対象とAssignment Criteriaを満たすREQ、UX、IA、UI、SPECだけである。その他のRun Result、Open Question、Architecture、Evidence、Decision、Change Trace、Test等はArtifact Referenceで識別する。

## 3.3. Pause, Failure, and Resume

回答待ち、疲労、外部調査、Tool停止等でRunを中断できる。`Paused`、`Blocked`、`Failed`にする前に、対象Riskに応じて次を残す。

```yaml
resume:
  run_id: skill-run-20260717-001
  reason: external evidence pending
  input_revision:
    - id: UX-000004
      revision: rev-4
  completed:
    - target_user
    - current_problem
    - desired_outcome
  current_understanding: 利用者が重要相談を見逃す不安を減らす
  unresolved:
    - success signal
    - notification boundary
  changed_but_unverified: []
  remaining_side_effects: []
  rollback_required: false
  next_action: ask success signal
```

再開時はInput RevisionとScopeの変化を確認し、既知事項を最初から質問し直さない。前提が変化している場合は、Resume Snapshotを無言で適用せず、再確認、Rebase、停止、またはEscalationを選ぶ。

---

# 4. Standard Run Lifecycle

```text
0. Select Skill
1. Orient
2. Load Context
3. Confirm Scope and Revision
4. Assess Gap and Build Queue
5. Interact or Analyze
6. Transform
7. Detect Gap and Conflict
8. Human Review when required
9. Register Context and Relations
10. Determine Route
11. Close or Pause
```

## 4.1. Select and Orient

現在の不足Contextと目的からSkillを選び、今回整理すること、決めないこと、活動理由、残すResultを短く示す。Skill名や専門用語を利用者へ押し付けず、活動の意味を説明する。

## 4.2. Load and Confirm Context

対象Scope、Active Revision、上流Context、関連Decision、Open Question、既存Artifact、過去Runを必要な範囲で読む。回答済み事項を再質問しない。Scope、Revision、Authorityが競合する場合は実行を進めず、使用するBaselineを確認する。

## 4.3. Assess Gap and Build Queue

QuestionまたはAnalysis Queueは固定順ではなく、未充足責務、Risk、下流影響に基づいて優先する。

| Priority | Meaning |
|---|---|
| Critical | 不明なままでは対象Professional Contextを成立させられない |
| Important | 下流で重大な手戻りまたはRiskを生む |
| Useful | 精度を高めるがOpen Questionとして残せる |
| Deferred | 現在Scopeでは扱わない |

Queue項目はTopic、Reason、Priority、Source Gap、Statusを必要な粒度で持つ。質問数やTemplate充足率を品質指標にしない。

## 4.4. Interact, Capture, and Transform

Interactionは5章に従う。回答、Observation、Evidence、Interpretation、Proposal、Decision、Open Questionを区別し、次を分離してProfessional Contextへ変換する。

```text
人間が明示したこと
既存Contextから継承したこと
AIが整理・言い換えたこと
AIが提案したこと
未確認または不明なこと
```

## 4.5. Detect Gap and Conflict

上流Contextとの矛盾、名称揺れ、既存DecisionとのConflict、別Property Authorityへの越境、Evidence不足、未確認のAI補完を確認する。解消できない場合は隠して一案にせず、必要なResearch、Decision、Expert Review、上流工程へRouteする。

## 4.6. Human Review

Human Decision、Context採用、重要な意味変換、Phase Handoffを含む場合は、6章に従って変換結果を確認する。Read-only Auditや機械的Validationは、人間承認を自己生成せず、ResultをReview可能な状態で返すことでRunを終了できる。

## 4.7. Register and Update Context

Human Reviewまたは対象Contractに従い、責務を持つCanonical Artifact、Relation、Status、Artifact Reference、Open Questionを更新する。Stable Context IDは対象TypeとAssignment Criteriaを満たす場合だけ付与する。

更新方法はCreate、Revise、Append Evidence、Open Question、Supersede Candidate、No Changeから選べる。重要な意味変更では既存Revisionを破壊的に上書きしない。Evidence、Decision、Status、Revision、Deletionは[Documentation](00_03_Documentation.md)、変更のTriggerとExpected / Actual Impactは[Change](00_12_Change.md)を正本とする。

## 4.8. Route, Close, or Pause

次Route、Owner、必要Input、未解消Gapを示す。Skill Runを`Completed`にできるのは、Skill DefinitionのExit Conditionsを評価し、Result、Trace、Open Question、Risk、次Routeまたは終了理由を記録した場合に限る。Handoffする場合は6章を満たす。

---

# 5. Guided Interaction

## 5.1. Interaction Layers

```text
Human Conversation Layer
= 自然な言葉、経験、具体例、選択肢

Structured Context Layer
= Raw Voice、Observation、Evidence、Interpretation、Hypothesis、Constraint、Open Question

Professional Artifact Layer
= REQ、UX、IA、UI Contract、Behavior Specification、Architecture、Plan等
```

利用者へProfessional Artifactの全項目を常に表示する必要はない。ただし、どの発言やEvidenceをどう変換し、どこにAI解釈を加え、何を未決にしたかを追跡可能にする。

## 5.2. Question and Analysis Rules

```text
一度に原則一つの重要判断を扱う
専門用語の試験ではなく経験、出来事、困りごとから聞く
抽象回答には具体例とContrastを求める
Raw Voiceを保持し、AIによる構造化結果と分ける
SolutionをNeed、守る価値、代替可能部分へ分ける
UnknownをHypothesis、Assumption、Needs Evidence、Open Questionとして保持する
質問理由を責務、Gap、次判断と結び付けて説明する
```

回答が広い場合はAIが勝手に確定せず、理解を要約して次の一問へ進む。利用者へ分類作業やTemplate入力を要求しない。

## 5.3. Adaptive Routing

回答と既存Contextに応じてQueueとRouteを変える。

```text
対象ActorまたはAuthorityが不明 → DiscoveryまたはHuman Decision
Evidenceが弱い                 → ResearchまたはDiscovery
Solutionが先に固定             → NeedとAlternative確認
複数OutcomeがConflict          → Human Decision
別工程の責務が未定義           → 該当工程へ戻る
未知の技術制約が大きい         → Prototype / Technical Spike
既存挙動からWhyを復元する       → DiscoveryのLegacy Reverse
```

質問を続けること自体を目的にしない。別Skill、Research、Prototype、Expert Review、Decision、Gate Reviewへ移る方が有効ならRouteを変更する。

## 5.4. Progressive Disclosure

| Level | View |
|---|---|
| 1. Conversation | 自然な質問、簡単な選択肢、具体例 |
| 2. Structured Summary | 分かったこと、未決事項、AI解釈、次の提案 |
| 3. Professional Detail | Context、Contract、State、Acceptance、Architecture等 |
| 4. Machine-readable | ID、Relation、Revision、Status、Provenance |

利用者の役割と関心に応じて表示Levelを変えてよいが、Source、意味、Uncertainty、判断境界を失わせない。

---

# 6. Review and Handoff

## 6.1. Human Review

Reviewでは単に「OKですか」と聞かず、対象Riskに応じて次を示す。

```text
今回の結論またはProduced Context
保持したRaw Voice / Intent
AIが変換または提案した部分
別責務へ分離した内容
未決事項、Gap、Risk
次へ進む場合の影響とCoverage State
```

人間は、思いが失われていないか、AIが価値判断を追加していないか、前提が抜けていないか、対象Scopeについて採用またはHandoffできるかを確認する。

Reviewの厳密さは8章のScaleに従う。Compactでは要約と重要Gap、StandardではSource、Produced Context、Intent、Alternative、Relation、Extendedでは専門家所見、Impact、Decision / Rationale、Gate Evidenceを扱う。

## 6.2. Skill Handoff Contract

次のSkillへ渡す際は、受信工程のPhase Entry Contractを満たし、次を対象Riskに応じて保持する。工程固有のEntry、Coverage、Exitを本書で再記述しない。

```yaml
handoff:
  from_skill: skill.ux.outcome
  to_skill: skill.ia.structure
  scope:
    feature: Important Topic Review
  source_revision:
    - id: UX-000004
      revision: 3
  coverage_state: Partial — Human Authorized
  coverage_summary:
    complete:
      - UX Outcome
      - Critical Journey
    open:
      - Secondary actor journey
      - Service Blueprint failure rows
  human_authorization:
    decision: IA may start for the stated scope only
    accepted_risk: Secondary actor structure may require rework
    owner: Product Owner
  receiving_entry:
    authority: 00_23_IA.md#phase-entry-contract
    assessment: satisfied_for_stated_scope
  preserve:
    - 人間が最終判断する
    - 根拠と提案を区別する
  obligations:
    - Topic / Evidence / Decisionの責務を分離する
  open_questions:
    - description: 重要度算出Ruleは未決
      source:
        artifact: 02_UX/01_Experience_Principles.md
        anchor: important-topic-principle
  must_not_decide:
    - 重要度算出Rule
  reopen_condition:
    - Secondary actor journey changes the object responsibility
```

Handoffは成果物のLinkだけでは成立しない。通常Handoffは送信工程が`Complete for Scope`で受信工程のEntry Contractを満たす場合に行う。`Partial — Human Authorized`は、対象Scope、Gap、Risk、Owner、Reopen条件を人間が明示した場合だけ使用できる。

AgentまたはSubagent間の委譲は[Agent](00_10_Agent.md)、ArtifactのRevisionは[Documentation](00_03_Documentation.md)、変更のImpact Traceは[Change](00_12_Change.md)、共通Handoff不変条件は[Principles](00_01_Principles.md)を正本とする。

---

# 7. Git / Markdown Adapter

本章は共通Skill RuntimeをGit RepositoryとMarkdownへ写像するTool Adapterであり、別のLifecycleではない。専用Application、Database、Vector Search、Subagent構成を要求しない。

## 7.1. Entry and Startup

`CLAUDE.md`、`AGENTS.md`等のEntry FileはTool向けの起動指示である。工程Contractを複製せず、Overview、Principles、Terminology、対象Change / Scope、対象工程とSkill、Canonical Context、Revision、Authority、Stop条件への参照を一致させる。

同一Sessionで既読かつRevisionが変わっていないContextは再読を省略できる。Active ScopeまたはAuthorityが不明な場合は大規模変更を開始せず、最小Scopeを確認または提案する。

## 7.2. Lifecycle Mapping

| Runtime Responsibility | Git / Markdown Operation |
|---|---|
| Load / Confirm | Entry、Change Trace、工程正本、Canonical Context、Revisionを読む |
| Assess | Entry、Coverage、Gap、Conflictを評価する |
| Interact | 既知Contextを再質問せず必要な判断を確認する |
| Capture / Transform | Source、解釈、Proposal、Decisionを分離してArtifactへ反映する |
| Review | AI変換、Gap、Risk、影響を人間またはReviewerへ提示する |
| Register | Canonical Artifact、Relation、Statusを更新する |
| Route | 次のSkill、Research、Decision、Review、Gate、Pauseを示す |

Context / RelationとContext Selectionの規則は[Documentation](00_03_Documentation.md)、Change Traceは[Change](00_12_Change.md)を正本とする。

## 7.3. Execution Result and Validation

終了または中断時は3.2のSkill Run Recordを更新し、中断または失敗時は3.3のResume Snapshotを残す。Changed Files、Verification、Side Effect等の実行結果がある場合は[Agent Result](00_10_Agent.md)へ接続する。思考過程の全文は不要だが、判断に必要なEvidenceとReasoning Summaryを失わない。

別Sessionの人間またはAgentが、現在地、Scope、Revision、責務Coverage、SourceとAI変換、未決事項、中断点を再現できなければならない。Tool固有Entry FileやWorking StateはCanonical Contextを置き換えない。

---

# 8. Runtime Scale and Failure Controls

## 8.1. Runtime Scale

Runtimeは独自のDocumentation Scaleを選定しない。[Documentation](00_03_Documentation.md)のScaleを使用し、本節ではSkill実行への影響だけを定義する。対象CHGがある場合は、そのImpact ScopeとReferenceを入力に含める。

| Scale | Runtime Execution |
|---|---|
| Compact | 必要な核心判断、短いSummary、既存Context更新 |
| Standard | Adaptive Queue、Professional Context、Trace、Review |
| Extended | 複数Evidence、専門Review、Alternative、Impact、Gate Evidence |

質問数やファイル数からScaleを変更せず、Scaleを品質等級として扱わない。

## 8.2. Failure and Audit Boundary

共通Failureの検査は[Conformance Audit](00_52_Conformance_Audit.md)のAgentic Delivery Profile Criteriaを正本とする。工程固有Failureは各工程文書を正本とし、本書へ再掲しない。
