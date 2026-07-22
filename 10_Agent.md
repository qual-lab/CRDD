# CRDD Agent

Version: v0.5.1
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-22
Related:
- [01_Principles.md](01_Principles.md)
- [02_Terminology.md](02_Terminology.md)
- [03_Documentation.md](03_Documentation.md)
- [11_Skill.md](11_Skill.md)
- [12_Change.md](12_Change.md)
- [29_Verification.md](29_Verification.md)
- [51_Document_Audit.md](51_Document_Audit.md)
- [52_Conformance_Audit.md](52_Conformance_Audit.md)
- [53_Gap_Impact_Audit.md](53_Gap_Impact_Audit.md)

---

> この文書で分かること（非規範の案内）
>
> - AgentやSubagentへ何を渡してよいか
> - AIが実行できることと、人間へ戻す判断
> - 委譲した結果をどう確認・統合するか
> - 独立Reviewをどう成立させるか
> - Agent実行を安全に停止・再開する条件

<a id="1-purpose-and-boundary"></a>

# 1. 目的と適用範囲（Purpose and Boundary）

本書は、CRDDにおいてAI Agentまたは人間の専門担当が作業するときのInput、Output、Authority、実行境界、停止・拒否・Escalation、委譲、Review、統合責任を定義するAgent Contractの正本である。

Agent Contractの目的はAgentを細かく分業することではない。誰が作業しても、次を識別できる状態を作る。

```text
何を根拠にするか
何を守るか
どこまで判断・変更・実行できるか
何を成果として返すか
どこで止まり、誰へ判断を戻すか
```

Skillは達成する専門活動とLifecycleを定義する。Agentは、そのSkillまたは限定Taskを、明示されたAuthorityとContextで実行する主体である。Agent文書で工程固有のEntry、Coverage、Exit、Gateを再定義しない。

AIまたはAgentという名称だけではAuthorityを得ない。HumanとAIの一般的なAuthority、Progressive Autonomy、Change Safetyは[Principles](01_Principles.md)を正本とする。

---

# 2. Agent Contract

重要なAgent作業は、最低限次を取得可能にする。保存形式はMarkdown、YAML、JSON、Issue、Change Trace参照、Agent定義等から選べるが、形式変更によって意味上の項目を失ってはならない。

```yaml
agent_contract:
  id: ui-agent-contract-123
  role: UI
  owner: Product Design Lead
  invoked_by: Change Trace Owner
  purpose: IAとUX IntentをUI Contractへ変換する
  scope:
    change_trace: 90_Release/Changes/CHG-000004_Topic_Detail.md
    feature: Important Topic Review
  input:
    revision: active
    source_context:
      - id: UX-000004
        revision: 3
      - id: IA-000008
        revision: 2
    preserved_intent:
      - 利用者が根拠を確認して判断できる
    uncertainty:
      - cancellation rule is open
  boundary:
    may_change:
      - UI-000021
    must_not_change:
      - importance rule
    may_execute:
      - local prototype validation
    external_action: prohibited
  authority:
    may_decide:
      - visual hierarchy within approved UI contract
    must_escalate:
      - behavior rule change
    escalation_to:
      - Product Owner
  access:
    allowed:
      - approved design context
    restricted:
      - production personal data
  output:
    required:
      - produced_context
      - trace
      - open_questions
      - completion_evidence
      - handoff
  stop_conditions:
    - conflicting approved revision
```

## 2.1. Required Input

### Role, Responsibility, Purpose, and Active Scope

```text
担当Role、Owner、Invoker、達成目的
対象Product、Feature、Use Case、User Action
対象Change Trace、Release、Variant
In Scope、Out of Scope
```

### Active Revision and Source Context

参照するContext Revision、Artifact Version、Baseline、Gate、Approval状態を示す。複数Revisionを混在させる場合は理由と優先関係を示す。

Origin、Problem、REQ、UX、IA、UI、SPEC、Architecture、Decision / Rationale、Evidence等から対象Taskに必要な最小集合を選ぶ。Repository全体を無条件に渡し、Agentに正本を推測させない。

### Preserved Intent and Change Boundary

```text
守る価値、Outcome、Quality、Business Rule
変更してよいもの
変更してはいけないもの
提案できるが承認が必要なもの
対象外だが影響候補となるもの
```

### Authority, Action, and Access Boundary

判断Authorityだけでなく、読取、編集、実行、外部送信、公開、Deploy、Release等のAction Authorityを区別する。使用できるTool、Credential、Environment、Dataと、禁止・承認必須のActionを必要な粒度で示す。

重要作業では、Agent Contractを維持するOwner、作業を開始したInvoker、判断を戻すEscalation Targetを示す。同一人物が複数責務を持ってもよいが、責務を暗黙にしない。

AgentまたはSubagentへ渡すContextは最小化し、個人情報、Secret、機密情報、契約上制限されたDataのAccess Control、Redaction、Retentionを維持する。委譲は元の利用権限を拡張しない。

### Known Uncertainty and Expected Output

Open Question、Assumption、Hypothesis、Recovered Candidate、Confidence、未検証Evidenceを消さずに渡す。必要Artifact、粒度、Trace、Review、Evidence、Handoff、終了条件も示す。

## 2.2. Required Output

AgentのOutputは5章のAgent Resultを使用する。工程Handoffでは受信工程のPhase Entry Contractを併用し、Agentごとに工程固有の完了条件を再定義しない。

## 2.3. Compact Contract

小規模作業では独立したContract文書を作らず、Prompt、Issue、対象CHG等に次を含めればよい。

```text
Role / Purpose / Scope
Owner / Invoker / Escalation Target
Read Revision
Preserve
May Change / Must Not Change
May Execute / Must Not Execute
Output
Stop / Escalate
Handoff
```

簡略化しても、責務境界、Input Revision、Action Authority、未決事項を消さない。

---

# 3. Authority and Execution Control

## 3.1. Authority Boundary

Agentが決められるのは、明示された専門責務と承認済み境界の内側に限る。

| Level | Meaning | Example |
|---|---|---|
| May Decide | 承認済みContract内の局所判断 | UI Contract内のVisual Hierarchy、承認済みArchitecture内の局所実装、定義済み基準によるFinding分類 |
| May Propose | 別Authorityの承認が必要な候補 | UX Outcome、Feature Scope、Business Rule、Architecture方針、Security Risk受容、Release、Priority、CostのTrade-off |
| Must Escalate | Agentが確定または受容してはならない | Origin / Principle変更、承認済みContract破壊、不可逆Data変更、重大なSafety / Legal / Security / Privacy Risk、Scope外変更、Human Decisionの上書き |

同じRoleでも、AuthorityはProject、Property、Artifact、Change、Gate、Revision、期間によって変わる。Validation ProcedureやReview Findingも、AcceptanceまたはRisk受容を変更する場合はMay Decideではない。

Agentが人間へ判断を求める場合は、質問のLabelにかかわらず[SkillのDecision Support Contract](11_Skill.md#53-decision-support-contract)に従う。`確認`、`Clarification`、`Review`と表現しても例外にはならない。

このContractは、回答によって次が変わる場合に適用する。

- Canonical Contextの意味またはScope
- 責任、Default、Priority
- Risk受容または下流Contract

専門用語の二択やRecommendationだけをHuman Authorityへ渡してはならない。

人間向けの説明、質問、判断支援、Result Summaryは、[Documentationのロケール規則](03_Documentation.md#481-利用者ロケールを優先した表示)に従う。利用者の主要ロケールで意味を先に説明し、必要な初出でCanonical English Termを併記する。Canonical Term、ID、File名、Schema Key / Valueを表示名と混同して変更しない。

## 3.2. Action Boundary

判断権限と実行権限を混同しない。編集、Command実行、External System更新、Message送信、公開、Deploy、Release、Data Migration等は、対象と副作用に応じたAction Authorityを必要とする。

```text
Read Only
Draft
Repository Edit
Local Execution
External Action
Deploy / Release / Migration
```

高Riskまたは外部Side Effectを持つActionは、対象Environment、Credential、Rollback、Verification、Human Authorizationを確認する。承認は類似Actionへ自動拡張しない。

## 3.3. Stop, Reject, and Escalate

| Control | Meaning |
|---|---|
| Stop | 進行中の作業を安全な状態で止め、追加Contextまたは確認を求める |
| Reject | 現在の依頼条件では安全または正当に実行できないと判断する |
| Escalate | 必要なDecision、Risk受容、専門判断を適切なAuthorityへ戻す |

次の場合は停止または限定し、必要に応じてRejectまたはEscalateする。

```text
Scope、Revision、Authorityが不明
Preserved Intentと依頼内容が矛盾する
複数のApproved Revisionが競合する
重要なSource Contextがなく推測だけで成果物を作ることになる
変更境界を越えないと成立しない
重大Risk、不可逆変更、未承認の外部Side Effectがある
必要な専門判断、Secret、権限、Environmentが不足する
前提Contextが作業中に変更された
Evidence、成功、完了の偽装を要求される
```

Stop、Reject、Escalate時は、理由、不足Context、実施済み変更、安全に進める最小条件、代替作業、必要Decision、Escalation先、期限またはGate影響を返す。

---

# 4. Role and Phase Adapter

Role固有Contractは、共通Agent Contractへ対象工程・活動の正本を組み合わせて作る。次はAuthority境界と主要Outputの索引であり、工程Contractの複製ではない。

| Role | Authoritative Process | Main Responsibility | Must Escalate |
|---|---|---|---|
| Discovery | [Discovery](21_Discovery.md) | Raw Voice、Observation、Evidence、Problem、Requirement | Origin、最終価値、未確認のWhy、Feature Scope確定 |
| UX | [UX](22_UX.md) | Outcome、Actor、Journey、Service Blueprint、Experience Principle、Success Signal | Target User、Problem、Priority、Principle Trade-off |
| IA | [IA](23_IA.md) | Object、Relation、Responsibility、Lifecycle、Grouping、Navigation | Business Concept、Scope、Authority、重大なMental Model Conflict |
| UI | [UI](25_UI.md) | UI Contract、State、Action、Feedback、Recovery、Accessibility、Visual / Variant | Behavior、Permission、Data Lifecycle、UX Outcome、Feature Scope |
| Behavior Specification | [Behavior Specification](26_Behavior_Specification.md) | Condition、Trigger、State、Behavior、Exception、Acceptance | Business Rule、UX / UI Trade-off、Authority、Scope、Risk |
| Architecture | [Architecture](27_Architecture.md) | Boundary、Data、API、Failure、Security、Migration、Operation | 上流Contract不成立、不可逆Migration、重大Risk、Cost / Schedule Trade-off |
| Planning | Agent / Skill Contract、Project固有Workflow | Task、Boundary、Dependency、Owner、Verification、Rollback | Scope削減、Release延期、Risk受容、Contract変更 |
| Implementation | [Implementation](28_Implementation.md) | Code、Configuration、Migration、Developer Test、Deviation、Evidence | Requirement、Architecture Boundary、Dependency、Data、Security、Scope変更 |
| Review | Review Packageと対象Contract | Finding、Severity、Evidence、Required Fix、Residual Risk、Recommendation | 価値判断、Risk受容、Scope / Contract変更、工程承認 |
| Verification | [Verification](29_Verification.md) | Result、Fresh Evidence、Reproduction、Finding、Residual Risk | Acceptance変更、Production Fix、Risk受容、環境差異の無視、Test不能Contract |
| Learning / Promotion | Provenance、Decision、Change、Validation | Learning、Source、Affected Context、Promotion Proposal、Confidence | Origin、Principle、Rule、Decision、Roadmap Priority変更 |

一つのAgentが複数Roleを担当してよい。ただし、RoleごとのInput、判断、Output、Property Authority、Escalationを分離する。重要変更では作成とReviewを分ける。工程移行を伴わない低Riskな局所変更で同一Agentが兼務する場合もFresh Contextによる独立Review Passを設け、Phase Transition Reviewは7.1の別実行主体条件に従う。

UI ContractとBehavior SpecificationはPairとして反復的に整合させる。一方の全成果物が完成するまで他方を開始できないという直列依存ではなく、対象ScopeとRevision、未確定事項、次に更新するAuthorityを明示して往復する。

Implementation Agentは動くCodeを理由に上流Contractを置き換えない。LegacyではDocumented Context、Implemented Context、Observed Behavior、Operational Practice、Recovered Candidate、Current Decisionを区別し、Codeや古い文書を自動的に正しいRequirementへ昇格しない。

---

# 5. Agent Result

## 5.1. Result Outcome

Agent Resultの実行結果は`outcome`で表し、Skill Run Status、Artifact Status、Phase Approval Result、Change Trace Statusと混同しない。

| Outcome | Meaning |
|---|---|
| `Completed` | 契約されたOutputとAgent作業の終了条件を満たした |
| `CompletedWithOpenQuestions` | 必須Outputと終了条件は満たし、対象Scopeの完了を妨げない未決事項を明示した |
| `Conditional` | 記録した条件付きでHandoff候補にできる |
| `Paused` | 再開地点と現在状態を記録して安全に中断した |
| `Blocked` | 外部判断または不足Contextにより停止した |
| `Rejected` | 現在の依頼条件では安全に実行できない |
| `Failed` | 実行を試みたが、技術的または運用上の失敗により契約されたResultを生成できなかった |
| `Escalated` | Authorityまたは専門判断へ戻した |
| `Superseded` | 後続Resultに置き換えられた |

必須Output、終了条件、Verificationを妨げるOpen Questionがある場合は`CompletedWithOpenQuestions`を使用せず、`Conditional`、`Blocked`、`Escalated`のいずれかとする。`Conditional`は成立条件、Owner、期限またはRecheck条件を持たなければならない。`Paused`は再開に必要なRevision、完了済みAction、未完了Action、次の開始点を持つ。

いずれのOutcomeも工程完了やGate Approvalを意味しない。

## 5.2. Minimum Result Record

Agent Resultは、対象Riskに応じて次を取得可能にする。

```text
Produced or Updated Context
Transformation Summary
Trace and Provenance
Open Questions, Assumptions, Conflicts, and Risks
Completion Evidence
Propagation Check Result, Affected Context, and Remaining Candidate
Conditions or Resume Point
Handoff Obligations
```

Produced Contextは新規、更新、変更なし、廃止・置換候補を区別する。Transformation Summaryは受け取ったInput、保持したIntent、具体化・変更した内容、判断できなかった内容を示す。

TraceとRelationは[Documentation](03_Documentation.md)を正本とし、Source、Revision、事実、解釈、仮説、AI推定、Confidenceを区別する。作業が停止、失敗、または一部完了した場合も、変更済みArtifact、未完了Action、未検証状態、残るSide Effect、Rollback要否を隠さず返す。Artifactが存在するだけでは完了根拠にならない。

```yaml
agent_result:
  run_id: ui-agent-run-123
  agent_contract: ui-agent-contract-123
  role: UI
  scope: Important Topic Review
  input_revision:
    - id: UX-000004
      revision: 3
    - id: IA-000008
      revision: 2
  outcome: Conditional
  produced:
    - id: UI-000021
      revision: 4
  preserved_intent:
    - UX-000004
  proposals:
    - visual_hierarchy_updated
  open_questions:
    - cancellation behavior
  escalations:
    - cancellation rule requires decision
  relations:
    - source: UI-000021
      relation: pairs_with
      target: SPEC-000044
  completion_evidence:
    - 04_UI/Evidence/Topic_Detail_Review.md
  changed_but_unverified: []
  remaining_side_effects: []
  rollback_required: false
  conditions:
    - condition: cancellation behavior is approved
      owner: Product Owner
      recheck: before Behavior Specification approval
  resume_from: null
  handoff:
    - Behavior Specification Skill
```

Resultは、内部思考や一時Memoの全保存を要求しない。共有・継承する価値があるResult、Evidence、Assumption、Confidence、Conflict、Risk、Open Questionを返す。

新しい人間の判断、制約、学び、根拠、Findingを確定または変更したResultでは、次も返す。

- 変更影響の伝播確認が必要か
- 対象Revisionと結果参照
- 更新した上流・同層Context
- 未処理Candidateまたは`propagation_exception`

---

# 6. Delegation and Subagent

SubagentはAgent TaskまたはSkillの一部を、限定されたContextと責務で一時的に調査、作成、Reviewする実行者である。恒久的な組織、独立Authority、新しい正本体系ではない。

独立した成果物、異なる専門観点、大量Evidence、並行可能な作業、作成とReviewの分離、高Risk判断、複数Artifact整合確認に有効な場合だけ使用する。Scopeと成果が小さく、委譲・説明・統合Costの方が高い場合は分割しない。

Subagent Task Registry、Result Registry、Execution Log、専用Database、専用UIは必須ではない。既存のAgent Contract、Skill、対象CHG、Runtimeで足りる場合、新しい管理構造を追加しない。

## 6.1. Delegation Contract

Delegationは2章のAgent Contractを参照またはInlineで保持し、Role、Scope、Input、Authority、Access、Outputを別の名前で再定義しない。Parent Agentは委譲固有情報として、委譲理由、Parent責任、統合先、返却先を示す。

```yaml
delegation:
  parent: ux-parent-run-042
  reason: Journeyの独立Review
  agent_contract: journey-review-contract-007
  parent_responsibility:
    - Result比較
    - Canonical Artifact統合
  integrate_into:
    - UX-000004
  return_to: ux-parent-run-042
```

## 6.2. Parent and Subagent Responsibility

Parent AgentはTask境界、必要最小限のContext、Preserved Intent、Authority、Access、Stop条件、統合先を定義する。Resultを回収し、Evidence、Assumption、Confidence、Conflict、Riskを比較し、Canonical Artifactへの統合とHuman Reviewを担う。

Subagentは指定Contextを読み、Proposal、Finding、Gap、Conflict、Risk、Open Question、Completion Evidenceを共通Agent Resultとして返す。対象外Context変更、Origin / Principle変更、ProposalのDecision昇格、Approved Contextの自己Promotion、不足情報の確定、重要Riskの自己受容を行わない。

## 6.3. Integration, Conflict, and Promotion

複数Resultは多数決で決めず、次の順で比較する。

```text
1. Approved Origin / Principleとの整合
2. Source Evidenceの強さ
3. Revisionの新しさと有効性
4. Property / Professional Authority
5. Scope
6. Risk
7. 実現性
8. Human Decision
```

解消できない場合は、一致点、対立点、各案の根拠とRisk、判断論点、Parent AgentのRecommendationを、[Decision Support Contract](11_Skill.md#53-decision-support-contract)に従ってHuman Reviewへ提示する。

ProposalからCanonical Contextへの一般的なPromotionは[Principles](01_Principles.md)を正本とする。Subagent Resultを直接`Approved`または`Decision`にせず、Parent Agentが統合対象、Trace、Conflict、Human Review Needを確認する。Canonical Artifactを直接編集できる範囲は同書のProgressive Autonomyと対象Agent Contractに従う。

複数Agentが同じCanonical Artifactを並行編集する場合は、統合責任者を一人に定め、統合前にBase Revisionと競合を再確認する。

---

# 7. Independent Review

重要変更と工程移行候補は、生成・実装と分離した観点でReviewする。Review Agentには作成者の内部思考を必須Inputとせず、Review Target、Expected Contract、Revision、Boundary、Acceptance、Known Riskを渡す。

```text
Creator
→ Produced Artifact
→ Independent Review
→ Finding、Severity、Evidence、Required Fix、Residual Risk、Recommendation
→ Review Result and Parent Integration
→ Human Decision
```

Reviewerは作成者の結論を前提にせず、対象ArtifactとContractから独立してFindingを再構成できなければならない。工程移行を伴わない低Riskな局所変更で同一AgentがReviewを兼ねる場合は、Fresh Context、独立したReview Pass、作成時の結論に依存しないCriteriaを使用する。Phase Transition Reviewは7.1の別実行主体条件に従い、高Risk変更では作成者だけのSelf Reviewを独立Reviewとして扱わない。

Review AgentはFindingとRecommendationを返し、価値判断、Risk受容、Scope / Contract変更、Gate Approvalを自己確定しない。詳細な文書監査は[Document Audit](51_Document_Audit.md)、CRDD適用監査は[Conformance Audit](52_Conformance_Audit.md)、変更影響監査は[Gap / Impact Audit](53_Gap_Impact_Audit.md)を正本とする。

## 7.1. Review Agent and Audit Subagent Roles

作成・変換担当がAI Agentである場合、工程移行前のIndependent Reviewは、別のReview Subagentへ委譲する。

RuntimeがSubagentを利用できない場合は、次のいずれかを使用する。

- 作成時Contextを引き継がないClean Session / Agent
- 人間Reviewer

同じActive Context内で作成担当が続けて行うSelf Reviewは、Phase Transition Reviewとして扱わない。独立した実行主体を用意できない場合は、[Human-directed Review Exception](#73-human-directed-review-exception)なしに工程移行しない。

工程移行を伴わない低Riskな局所変更では、Fresh Contextによる独立Passを使用できる。高Risk Scope、重大なAuthority変更、Safety / Security / Privacy / Legal、不可逆Data、重大Migrationでは、工程移行の有無にかかわらず作成担当だけのSelf Reviewで代替しない。

次のRoleは新しいAuthorityやLifecycleではなく、6章のDelegation Contractを各Review正本へ写像する標準Adapterである。

| Agent ID | Primary Authority | Primary Output |
|---|---|---|
| `agent.phase_transition.review` | 送信・受信工程のPhase Process Contract、本章 | Phase Transition Review Result |
| `agent.document.audit` | [Document Audit](51_Document_Audit.md) | Audit Status、Finding、Remediation、Re-audit条件 |
| `agent.conformance.audit` | [Conformance Audit](52_Conformance_Audit.md) | Criteria Result、Finding、Claim Eligibility |
| `agent.gap_impact.audit` | [Gap / Impact Audit](53_Gap_Impact_Audit.md) | Relation横断Finding、Impact、Required Revalidation |
| `agent.verification.review` | [Verification](29_Verification.md) | Verification Result、Fresh Evidence、Residual Risk |

これらの`agent.*`は実行Role Adapterを選ぶための識別子であり、CRDD Stable Context ID、Artifact ID、Document Numberではない。中央Registry、専用Folder、恒久的なSubagent Instanceを要求しない。

Audit Subagentは原則Read-onlyとし、Findingを確定して返す前に対象Artifactを修正しない。修正はParent Agentまたは明示的に許可されたRemediation Runが行い、同じRoleまたは同等以上の独立性を持つReviewerが修正後Revisionを再評価する。

## 7.2. Phase Transition Review and Remediation Loop

`agent.phase_transition.review`は、新しい工程Authorityを作らない。一つの移行ScopeとRevisionに対して、次を評価する。

- 送信工程のExit / Phase Gate Criteria / Phase Audit Checklist
- 受信工程のEntry
- 共通Handoff不変条件
- 対象Handoff Artifactが[Documentationの可読性Self-check](03_Documentation.md#481-利用者ロケールを優先した表示)を通過し、人間がScope、判断、義務、例外、未解決事項を読み違えない状態であること

意味的な波及探索には`agent.gap_impact.audit`を使用できる。文書品質と直接Propagationの確認には、`agent.document.audit`を限定Subtaskとして使用できる。

表記上の好みだけを理由に通常Handoffを止めない。一方、可読性の不足によってScope、Human Decision、Obligation、Exception、Risk、受信側Entryを誤解する可能性がある場合は、移行に影響するFindingとして責務工程へ戻す。必要に応じて`agent.document.audit`または同等の独立Reviewerが修正後Revisionを再評価する。

```text
Freeze Transition Scope and Target Revision
→ Independent Review Subagent / Reviewer
→ Finding、Evidence、Severity、Required Remediation
→ Remediate in the Responsible Phase
→ Freeze the Updated Revision
→ Independent Re-review
→ Target Pass
→ Human Phase Decision
→ Handoff
```

最低限、次をReview Inputとする。

```text
Sending Phase and Receiving Phase
Transition Scope and Target Revision
Source Context and Preserved Intent
Required Responsibility Coverage and Coverage Summary
Sending Exit / Gate / Audit Checklist
Receiving Entry Contract
Decision / Rationale、Evidence、Trace
Unresolved Gap、Risk、Partial Scope
Active Change Trace or applicable Baseline
Triggered Propagation Check Result / Source Revision / Remediation / Propagation Exception
```

通常の引渡しへ進めるのは、対象Revisionが次の条件をすべて満たす場合に限る。

- 発火した変更影響の伝播確認（Triggered Propagation Check）が完了している
- 移行へ影響する未解消Findingが、Severityにかかわらず残っていない
- Critical / Major Finding、正本Conflict、Entry不足、未処置のCoverage Gapがない
- 必要な是正後の再Reviewが`Pass`を返している

移行へ影響しないMinor / Info Findingは、対象Scope内で根拠付き`No Impact`、`Not Applicable`、または解消済みと判定する。Audit Runが`Fail`または`Conditional`を返した場合、実行自体は完了していても移行可能な`Pass`ではない。FindingのOwnerを受信工程へ変更するだけでは、移行条件を満たさない。

Review Resultでは、少なくとも次を確認できるようにする。

- Review Agent IDとReviewer
- 送信工程、受信工程、対象Scope、Target Revision
- 使用Criteriaと変更影響の伝播確認結果
- Audit Status、Finding、是正内容、再ReviewしたRevision
- 未Review範囲とRecommendation

Review ResultへCRDD Stable Context IDを発行しない。対象Artifact、Handoff View、Change Trace等からArtifact Referenceで接続する。

## 7.3. Human-directed Review Exception

Independent Reviewの省略または未解消Findingを伴う移行は通常Routeではない。対象ScopeのHuman Authorityが明示的に要求した場合だけ、`review_exception`として次を記録する。

```yaml
review_exception:
  directed_by: <Human Authority>
  scope: <explicit transition scope>
  target_revision: <unreviewed or conditionally reviewed revision>
  skipped_review_or_findings: []
  reason: <why transition cannot wait>
  known_risk_and_impact: []
  receiving_owner: <owner>
  required_re_review: <condition / date / event>
  expires_or_reopens_when: <condition>
```

例外はReview Pass、Finding解消、Risk受容、受信工程Entry充足を意味しない。AI、Parent Agent、Reviewerは利便性や日程だけを理由に例外を自己生成しない。Human Authorityも、自身がAuthorityを持たない法令、契約、専門承認、Security Boundaryを免除できない。部分Handoffでは移行対象Scopeを通常どおりReviewし、対象外Scopeを混入させない。

## 7.4. Triggered Propagation Check

人間による判断、制約、学び、根拠、Findingが確定または変更された時点で、Parent Agentは変更影響の伝播確認が必要かを判断する。

次のいずれかに該当する可能性があれば、工程移行を待たずに確認を実行する。

- 既存の上流・同層ContextにあるOpen QuestionまたはUnresolved Gapへ答える
- Assumption、Decision、Constraintを制約する
- 既存Contextと矛盾する

確認は、別実行の`agent.gap_impact.audit`へ[Mandatory Propagation Trigger and Closure](53_Gap_Impact_Audit.md#43-mandatory-propagation-trigger-and-closure)を委譲する。

```text
Freeze the New Decision / Constraint / Learning Revision
→ Independent Gap / Impact Audit in reverse and lateral directions
→ Match upstream Open Questions, Gaps, Assumptions, Decisions, Constraints
→ Remediate in each Property Authority
→ If upstream Context changed, traverse forward from the updated Revision
→ Re-audit the affected Scope
→ Propagation Pass or Human-directed Propagation Exception
```

作成・変換担当は、探索するRelation候補を絞るInputを作成してよい。ただし、自身の記憶だけで「上流へ影響しない」と確定してはならない。

- Audit SubagentはRead-onlyでFindingを返す
- Parent Agentまたは責務工程が正本を修正する
- Phase Transition Reviewは、必要な是正と再監査が済んでいることを確認する

Audit Runの完了、FindingへのOwner付与、下流ArtifactへのDecision記録だけでは、伝播確認の`Pass`にならない。

---

# 8. Tool and Action Adapter

CRDDはClaude Code、Codex等の起動方法やAgent定義形式を正本化しない。`.claude/agents`、`.codex/agents`等は本書のTool Adapterである。

Tool間で次を一致させる。

```text
利用条件と対象Scope
Input / Output
判断AuthorityとAction Authority
Access、Credential、Secret、Environment
Stop / Escalation
Side Effect、Rollback、Verification
統合責任とHuman Review
```

Tool権限はAgent Contractより広くても、AgentのAuthorityを拡張しない。Read-only Review、対象Path限定、External Action禁止等の機能で責務境界を補強してよい。

並行実行または長時間実行では、Action直前とResult統合前に対象Revision、Authority、Scopeが変わっていないか確認する。変化している場合は自動適用せず、Rebase、再Review、停止、またはEscalationを選ぶ。

実装済みAgent一覧、導入進捗、Provider固有設定は本書ではなくProject側のWorkflowで管理する。

Agent ContractとResultの適用監査は[Conformance Audit](52_Conformance_Audit.md)のAgentic Delivery Profile Criteriaを正本とする。
