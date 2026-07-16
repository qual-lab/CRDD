# CRDD UX Skill

Version: v0.3.1
Status: Stable
Skill ID: `skill.ux.outcome`
Owner: Qual-Lab
Last Updated: 2026-07-16
Related:
- [00_16_Context_Transformation.md](00_16_Context_Transformation.md)
- [00_17_Discovery.md](00_17_Discovery.md)
- [00_23_Phase_Gate_Approval.md](00_23_Phase_Gate_Approval.md)
- [00_26_Agent_IO_Contract.md](00_26_Agent_IO_Contract.md)
- [00_27_Guided_Context_Creation.md](00_27_Guided_Context_Creation.md)
- [00_40_Guided_Skill_Runtime.md](00_40_Guided_Skill_Runtime.md)
- [00_46_Git_Markdown_Execution.md](00_46_Git_Markdown_Execution.md)
- [00_51_Document_Audit_Agent.md](00_51_Document_Audit_Agent.md)
---

# 1. Purpose

Discoveryで整理されたOrigin、Problem、Evidenceを、利用者にもたらすOutcome、体験原則、成功状態へ変換する。

UX Skillは画面や機能を決めるSkillではない。

```text
誰が
どの状態から
どの状態へ変わり
何を人間が判断し
何をSystemまたはAIへ任せ
どんな体験を避けるか
```

を明らかにする。

---

# 2. Use When

```text
Problemはあるが、どんな価値を実現するか曖昧
機能候補が増え、判断軸がない
既存Featureを改善したいが、成功状態が不明
UI議論が好みの話になっている
AIと人間の責任境界を体験として整理したい
```

## Do Not Use As

```text
Personaをそれらしく生成するだけのSkill
機能一覧を作るSkill
UI Wireframeを作るSkill
数値KPIを無理に確定するSkill
```

---

# Phase Process Contract

この節はUX工程の入口、変換、責務網羅、出口、Phase Gate、Auditの正本である。`00_30_Product_Documentation.md`は配置例を示すが、UX完了条件を定義しない。

## Phase Entry Contract

UXは、対象ScopeについてOrigin / Intent、Problem、Target Actor、Observed Situation、Evidence、Desired Outcome Candidate、Constraint、Open Question、Human-confirmed Routeを受け取る。通常は[DiscoveryのExit and Handoff](00_17_Discovery.md#exit-and-handoff)から受け取る。Problem、Actor、対象Scope、または人間確認が不足する場合はDiscoveryへ戻す。

## Transformation Contract

Discovery Contextを、Solutionから独立したUX Outcomeと、利用前後の変化、重要場面、体験原則、人間とSystem / AIの責任境界、Journey、Service Blueprint、成功とRiskへ変換する。画面、機能、Behavior RuleをUXの結論として先取りしない。

## Required Responsibility Coverage

対象Scope全体について、次を網羅する。

- UX Foundation: Vision、Problem、Target Outcome、Experience Principle、Non-goal
- Persona / Situation: Actor、Goal、Pain、能力、制約、Evidence、Confidence
- Journey: Phase、Action、Thought、Emotion、Pain、Opportunity、Decision
- Service Blueprint: User Action、Frontstage、Backstage、System / AI、Support、Evidence、Failure
- Human / System / AI responsibility boundary
- Success Signal、Validation Need、Risk、Avoided Experience
- Discoveryの各対象Requirement / ProblemとUX成果のCoverage関係

Service BlueprintはUXからIAへの必須Bridgeである。複数の責務を一つのArtifactへ統合してよいが、統合によって上記責務を失ってはならない。

## Scope and Coverage State

各対象Requirement / Problemと各責務を、`Complete for Scope`、`Partial — Human Authorized`、`Blocked`、`Not Started`、`Not Applicable`のいずれかで追跡する。`Not Applicable`には理由が必要である。単一Persona、単一Journey、または一部Featureが7〜8割できたことを「UX完了」と表現してはならない。

## Human Decisions

人間は対象Scope、価値原則、優先順位、重要Trade-off、受容するRisk、`Not Applicable`、部分Handoffを決定する。AIはCoverage Gapと選択肢を提示できるが、未網羅項目を暗黙に完了扱いしてはならない。

## Exit and Handoff

通常のIA Handoffは、対象Scopeが`Complete for Scope`であり、人間Reviewを通過し、[IA Phase Entry Contract](00_43_IA_Skill.md#phase-entry-contract)を満たす場合に限る。途中Handoffは、人間が対象Scope、未網羅項目、Risk、後続Ownerを明示して`Partial — Human Authorized`とした場合に限る。HandoffにはCoverage SummaryとOpen Gapを含める。

## Phase Gate Criteria

- 対象Scopeと対応するDiscovery Contextが明確である
- Required Responsibility Coverageが対象Scope全体で判定済みである
- UX OutcomeがSolutionから独立し、Before / AfterとCritical Momentが理解可能である
- JourneyとService Blueprintが、利用者体験と提供責務を接続している
- 人間とSystem / AIの責任境界、Avoided Experience、Success / Validation、Riskが明示されている
- Gapが隠されず、部分Handoffなら人間承認が記録されている
- IAのPhase Entry Contractを満たすHandoffが生成されている

## Phase Audit Checklist

- Discovery Scopeに対するPersona、Journey、Blueprint、Principle、Success / RiskのCoverage漏れ
- Artifact統合による責務項目の欠落
- 一部Featureの完成を工程全体の完了と誤認する表現
- Coverage Summary、Open Gap、Human Review、Evidence / Traceの欠落
- UX内でのUI、IA、SPEC、Architecture判断の先取り
- IA Entry Contractとの不一致

---

# 3. Runtime Input View

Runtimeは[Phase Entry Contract](#phase-entry-contract)の全項目を読み込む。次は質問Queueを組み立てるためのCompact Viewであり、Entry Contractの代替ではない。

```text
Origin / Intent
Problem
Target Actor
Observed Situation
Evidence
Desired Outcome Candidate
Principle / Constraint
Solution Candidate
Open Question
```

ProblemまたはActorが不明な場合はDiscoveryへ戻す。

---

# 4. Orientation Message

```text
ここでは、何を作るかではなく、
利用者が利用前後でどう変わるべきかを整理します。

画面・通知・AI機能などは、Outcomeを実現する選択肢として分けます。
```

---

# 5. Core Question Flow

## Q1. Before State

```text
利用前、この人はどんな状態にいますか？
何が分からない、できない、不安ですか？
```

## Q2. Critical Moment

```text
その体験の中で、負担・迷い・不安が最も大きい場面はどこですか？
```

## Q3. After State

```text
利用後、何ができる、分かる、安心できるようになればよいですか？
```

回答が機能の場合:

```text
それができることで、利用者の状態はどう変わりますか？
```

## Q4. Human Decision

```text
最終的に人間が判断し、責任を持つべきことは何ですか？
```

## Q5. System / AI Responsibility

```text
人間が判断するために、SystemやAIへ任せたい整理・提案・処理は何ですか？
```

## Q6. Avoided Experience

```text
便利になっても、こうなったら失敗だと思う体験は何ですか？
```

## Q7. Success Signal

```text
Outcomeが実現したことを、どんな行動・変化・Evidenceで確認できますか？
```

数値が不明なら、観察可能なSignalでよい。

## Q8. Frequency and Context

```text
この体験は、いつ、どの頻度、どんな緊張度で発生しますか？
```

---

# 6. Adaptive Branches

## Multiple Actors

ActorごとにOutcomeを分け、Conflictを確認する。

```text
Primary User Outcome
Secondary User Outcome
Operator Outcome
Business Outcome
```

一つのUX Outcomeに無理に統合しない。

## AI Product

次を必ず分ける。

```text
AIが理解・整理・提案する
人間が判断する
Systemが実行する
```

AI提案と人間決定を同じ状態にしない。

## Success Signal Is Unclear

Route:

```text
Prototype
User Test
Operational Observation
Analytics Design
```

## Outcome Depends on Solution

```text
その技術や画面が変わっても、残したい体験価値は何ですか？
```

## Conflicting Principles

例:

```text
情報量を減らしたい
根拠を十分に見せたい
```

AIはTrade-off案を提示するが、Priorityは人間へ戻す。

---

# 7. Professional Output

Projectの正本UX Artifactへ以下を生成する。物理的なファイル構成は`00_30_Product_Documentation.md`の配置例を利用してよいが、Artifactの分割数は完了条件ではない。

```text
UX ID
Target Actor
Source Problem
Before State
Desired After State
UX Outcome
Experience Principle
Critical Moment
Human Responsibility
AI / System Responsibility
Avoided Experience
Journey / Scenario
Persona / Situation
Service Blueprint
Success Signal
Risk
Assumption
Validation Need
Relation
Coverage Summary
Open Gap
```

UX Outcomeは、実装方法を含めず、将来も残る表現を優先する。

---

# 8. Quality Check

## Good UX Outcome

```text
利用者が、重要事項の存在と根拠を把握し、
何を判断すべきかへ集中できる。
```

## Weak: Feature Description

```text
Dashboardに重要Topic一覧を表示する。
```

これはUI／Feature Candidateである。

## Weak: Unverifiable Ideal

```text
最高に使いやすい体験を提供する。
```

## Weak: EARS Compression

```text
重要Topicが存在するとき、
Systemは利用者を安心させなければならない。
```

UX OutcomeをBehavior構文へ圧縮しない。

---

# 9. Human Review

AIは次を提示する。

```text
今回のUX Outcome:
利用者が、見落としの有無を自分で探索するのではなく、
重要事項と根拠を確認し、判断へ集中できる。

守る原則:
AIは判断を代替せず、判断材料を整理する。

避ける体験:
通知量やAI断定によって、別の認知負荷を増やす。

未決:
何をSuccess Signalとするか。
```

人間は、思いが薄まっていないかを確認する。

---

# 10. Subagent Execution

複数のUX成果物を並行して検討する、Evidence量が多い、またはUX一貫性の独立Reviewが必要な場合、Parent Agentは `00_50_Subagent_Orchestration.md` に従って限定ScopeのSubagentへ委譲してよい。

分離可能な観点:

```text
Persona
Journey Map
Service Blueprint
UX Consistency Review
```

SubagentはProposal、Evidence Gap、Assumption、Conflict、Open Questionを返す。UX Outcome、Experience Principle、Handoffの統合はParent Agentが行い、人間確認前に価値判断を確定してはならない。

---

# 11. Handoff to IA

Handoffの可否と必須情報は[Exit and Handoff](#exit-and-handoff)および[IA Phase Entry Contract](00_43_IA_Skill.md#phase-entry-contract)に従う。少なくとも次を渡す。

```text
Target Actor
UX Outcome
Critical Moment
Experience Principle
Human / AI Responsibility
主要Scenario
Avoided Experience
Open Question
Coverage Summary
Open Gap
```

IAへ要求すること:

```text
Outcomeを成立させるObjectと責務を定義する
利用者が判断する単位を明らかにする
System都合の構造だけへ変換しない
```

---

# 12. Stop / Reject / Escalate

## Stop

```text
ProblemがEvidenceと大きく矛盾
複数ActorのOutcomeが衝突
Solution制約によりOutcomeを検討できない
```

## Reject

```text
AIへ価値原則の最終決定を要求
UXを機能一覧だけで置き換える
```

## Escalate

```text
Product Principle
Priority
対象User
倫理・Trust
重大なTrade-off
```

---

# 13. Exit Criteria

[Phase Gate Criteria](#phase-gate-criteria)を満たし、Coverage Stateと人間判断を記録したときにだけ、対象Scopeについて完了と表現できる。
