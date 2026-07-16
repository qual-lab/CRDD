# CRDD Lightweight Subagent Orchestration

Version: v0.3.0
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-16
Related:
- [00_13_Human_AI_Responsibility.md](00_13_Human_AI_Responsibility.md)
- [00_31_Subagent_Practice.md](00_31_Subagent_Practice.md)
- [00_26_Agent_IO_Contract.md](00_26_Agent_IO_Contract.md)
- [00_27_Guided_Context_Creation.md](00_27_Guided_Context_Creation.md)
- [00_41_Discovery_Skill.md](00_41_Discovery_Skill.md)
- [00_42_UX_Skill.md](00_42_UX_Skill.md)
- [00_43_IA_Skill.md](00_43_IA_Skill.md)
- [00_44_UI_Skill.md](00_44_UI_Skill.md)
- [00_45_Behavior_Specification_Skill.md](00_45_Behavior_Specification_Skill.md)
- [00_51_Document_Audit_Agent.md](00_51_Document_Audit_Agent.md)

# Purpose

本書は、CRDDの既存構成を大幅に増やさず、Claude Code、Codex等のAI Coding AgentからSubagentを利用するための軽量なOrchestration方針を定義する。

CRDDでは、Subagentを独立した恒久的管理対象として扱わない。

Subagentは、Guided Skillの一部を限定されたContextと責務で調査・作成・Reviewする、一時的な実行者として扱う。

```text
Guided Skill
↓
Parent Agentが必要に応じて作業を分解
↓
Subagentへ限定的に委譲
↓
結果をParent Agentへ返却
↓
Parent Agentが比較・統合
↓
Human Review
↓
Canonical Artifact更新
```

本書の目的は、多数のAgent定義、Task Registry、Execution Log等を先に導入することではない。

```text
どのような場合に委譲するか
何を渡すか
何を返させるか
何を決めさせないか
誰が統合するか
```

を最小限の規則として定義する。

# 0. Relationship to Subagent Practice Guide

`00_31_Subagent_Practice.md` は、CRDDにおけるSubagentの役割例、Design Council、Strategist、Conformance Reviewer等のPracticeを定義する。

本書は、それらの役割をClaude Code / Codex等のGit / Markdown作業でどう安全に呼び出し、どう統合するかを定義するExecution Guideである。

```text
00_31 = Subagentの役割とPractice
00_50 = Subagentを使う条件、委譲Contract、統合責任、禁止事項
```

ツール固有のAgent定義はCRDD正本ではない。`.claude/agents` や `.codex/agents` は、`00_31` と `00_50` を実行するためのTool-specific adapterとして扱う。

# 1. Basic Principle

CRDDにおけるSubagent運用は、以下の原則に従う。

```text
Parent Agentが最終的な統合責任を持つ。
Subagentは限定された作業だけを担当する。
SubagentはProposalを作成できる。
SubagentはDecisionを確定してはならない。
SubagentはApproved Contextへ直接昇格してはならない。
必要最小限のContextだけを渡す。
対象Scopeと変更禁止範囲を明示する。
Assumption、Conflict、Open Questionを必ず返す。
Canonical Artifactは原則としてParent Agentだけが更新する。
Human Review前にPromotionしない。
```

Subagentの利用目的は、作業者を増やすことではない。

```text
専門観点を分離する
大量Evidenceを分担する
並行化する
Fresh ContextでReviewする
作成者の思い込みを減らす
```

ために利用する。

# 2. Minimal Structure

軽量運用では、以下の追加だけでよい。

```text
新規:
00_50_Subagent_Orchestration.md

既存文書への追記:
00_41〜00_45 Guided Skill文書
CLAUDE.md
AGENTS.md
```

以下は初期段階では必須としない。

```text
.agentフォルダ
Subagent Task Registry
Subagent Result Registry
Skill Run Registry
Checkpoint Schema
Resume Schema
Execution Log
専用Database
専用UI
```

Subagentを新しいRepository構造の中心へ置かず、既存Skillを実行する補助手段として扱う。

# 3. When to Use Subagents

次のいずれかに該当する場合、Parent AgentはSubagentへの委譲を検討する。

```text
独立した必須成果物が複数ある
Evidence量が多い
異なる専門観点が必要
並行実行できる
作成とReviewを分離したい
高Riskな判断を含む
複数Artifact間の整合確認が必要
```

例:

```text
Persona、Journey Map、Service Blueprintを別観点で確認する
大量のInterview Logを複数範囲に分けて分析する
UI ContractとBehavior Specificationを独立Reviewする
Architecture ProposalをSecurity観点から別AgentがReviewする
```

次の場合は、Parent Agentだけで進める。

```text
変更Scopeが小さい
対象Contextが少ない
成果物が一つ
判断が単純
分割・説明・統合Costの方が高い
```

Subagentの利用は必須工程ではない。

# 4. Parent Agent Responsibility

Parent AgentはOrchestratorとして、以下を担う。

```text
対象Skillの目的を確認する
Subagentへ分ける必要性を判断する
委譲Taskの境界を定義する
必要最小限のContextを選ぶ
Preserved Intentを明示する
変更禁止範囲を明示する
Subagent Resultを回収する
結果間の一致・矛盾を確認する
Evidenceの強さを比較する
統合案を作成する
Human Reviewへ渡す
Canonical Artifactを更新する
```

Parent Agentは、Subagent Resultを無条件に採用してはならない。

複数のResultがある場合、少なくとも次を比較する。

```text
Source Context
使用したEvidence
Assumption
Confidence
上流Intentとの整合
Scope
Conflict
Risk
```

# 5. Subagent Responsibility

Subagentは、委譲された限定Scopeについて作業する。

Subagentが行ってよいこと:

```text
指定されたContextを読む
Evidenceを整理する
専門観点からProposalを作る
Gap、Conflict、Riskを検出する
Open Questionを提示する
Review Findingを返す
次のHandoffを提案する
```

Subagentが行ってはならないこと:

```text
対象外Contextを無断で変更する
OriginやPrincipleを変更する
ProposalをDecisionへ昇格する
人間の判断を代替する
Approved Contextを直接更新する
Canonical Artifactを無断で編集する
不足情報を確定事項として補完する
重要なRiskを自己受容する
```

# 6. Delegation Contract

Parent AgentがSubagentへ委譲するときは、最低限以下を渡す。

```text
Role
Purpose
Scope
Read
Preserve
Do
Must Not
Return
```

## Standard Delegation Format

```text
Role:
<担当する専門観点>

Purpose:
<この委譲で明らかにすること>

Scope:
<対象Feature、Use Case、Context ID、Artifact範囲>

Read:
<参照するContext、Evidence、Revision>

Preserve:
<失ってはならない上流Intent、Principle、Decision>

Do:
<実施する分析、作成、Review>

Must Not:
<変更・確定してはいけない内容>

Return:
<返却するProposal、Finding、Open Question等>
```

## Example

```text
Role:
Journey Map Reviewer

Purpose:
PersonaとEvidenceからJourney Map案の妥当性を確認する。

Scope:
UX-000004に関連する主要利用Scenario。

Read:
Persona
Discovery Evidence
UX Outcome
既存Journey Map

Preserve:
利用者の判断負荷を下げる。
AIが最終判断を代替しない。

Do:
Phase、Action、Pain、Need、Evidence不足を整理する。

Must Not:
Personaを変更する。
Feature Scopeを確定する。
UIを設計する。

Return:
Journey Map Proposal
Evidence Gap
Assumption
Conflict
Open Question
```

# 7. Result Contract

Subagentは、最低限以下の形式で結果を返す。

```text
Status
Summary
Proposal
Evidence Used
Assumptions
Conflicts
Risks
Open Questions
Recommended Handoff
```

## Standard Result Format

```text
Status:
Completed / Completed with Questions / Blocked

Summary:
<実施内容と結論の要約>

Proposal:
<統合候補となる提案>

Evidence Used:
<参照したEvidenceとContext>

Assumptions:
<推定・仮定>

Conflicts:
<既存Contextや他Proposalとの矛盾>

Risks:
<見落とし、品質、Scope上のRisk>

Open Questions:
<人間または別専門領域で判断すべき事項>

Recommended Handoff:
<次に確認すべきRole、Skill、Review>
```

Subagentの内部的な思考過程や一時メモを、すべてRepositoryへ保存する必要はない。

共有・継承価値のあるResultだけをParent Agentへ返す。

# 8. Canonical Artifact Update Rule

初期運用では、SubagentにCanonical Artifactを直接編集させない。

```text
Subagent
↓
ResultをParent Agentへ返す
↓
Parent Agentが比較・統合する
↓
Human Review
↓
Parent AgentがCanonical Artifactを更新する
```

この方式により、次を防ぐ。

```text
複数Agentによる同一ファイル競合
前提の異なる内容の混在
ProposalとDecisionの混同
未Review Contextの正本混入
重複したArtifact生成
```

Git WorktreeやBranchを使って並行編集する場合も、Human ReviewとParent Agentによる統合責任は維持する。

# 9. Conflict Resolution

複数SubagentのResultが矛盾した場合、多数決で決めてはならない。

Parent Agentは、以下の順で比較する。

```text
1. Approved Origin / Principleとの整合
2. Source Evidenceの強さ
3. 対象Revisionの新しさと有効性
4. 専門Authority
5. 対象Scope
6. Risk
7. 実現性
8. Human Decision
```

解消できない場合は、次をHuman Reviewへ提示する。

```text
一致している点
矛盾している点
各Proposalの根拠
各ProposalのRisk
判断が必要な論点
Parent Agentの推奨
```

Parent Agent自身が重要なTrade-offを確定してはならない。

# 10. Independent Review

Subagentは、Fresh Contextによる独立Reviewにも利用できる。

```text
Creator Agent
↓
成果物を作成
↓
Review Subagent
↓
ContractとEvidenceだけを基に確認
↓
Parent AgentがFindingを統合
```

Review Subagentへは、作成者の詳細な会話や説明を必ずしも渡さない。

最低限渡すもの:

```text
Review Target
Expected Contract
Active Revision
Acceptance Criteria
Known Risk
```

Review Subagentは、次を返す。

```text
Finding
Severity
Evidence
Required Fix
Residual Risk
Pass / Conditional / Fail Recommendation
```

最終的な承認はHuman Authorityが行う。

## 10.1 CRDD Document Audit Agent

CRDD Document Audit Agentは、Independent Reviewの一種である。

ただし、Conformance Reviewerとは責務が異なる。

```text
Conformance Reviewer
    = 実装差分と合意済みContextの整合を確認する

CRDD Document Audit Agent
    = 文書体系、参照、用語、Traceability、Status、水平展開を確認する
```

Parent Agentは、README、Overview、CHANGELOG、Related Links、Status、文書採番、安定ID、Traceabilityに影響する変更では、必要に応じてCRDD Document Audit Agentへ監査を委譲する。

CRDD Document Audit Agentへの委譲では、最低限以下を渡す。

```text
Audit Purpose
Changed Files
Review Scope
Relevant Standards
Known Decisions
Expected Output Format
```

CRDD Document Audit AgentはAudit ReportとFindingを返す。
Canonical Artifactを直接編集しない。

詳細は[`00_51_Document_Audit_Agent.md`](00_51_Document_Audit_Agent.md)を参照する。

# 11. Guided Skill Integration

各Guided Skill文書には、`Subagent Execution`節を追加することを推奨する。

記載するのは、固定Agent名ではなく、分離可能な観点である。

## Discovery

```text
Evidence Review
Problem Framing
Problem / Solution Separation
Discovery Consistency Review
```

## UX

```text
Persona
Journey Map
Service Blueprint
UX Consistency Review
```

## IA

```text
Object Model
Information Structure
Navigation / Flow
IA Consistency Review
```

## UI

```text
Screen Inventory / Coverage
Wireframe
UI Contract
Design Token / Component
Usability Review
Accessibility Review
```

## Behavior Specification

```text
Behavior Specification
State Transition
Exception / Recovery
Acceptance Criteria
UI / SPEC Pair Review
```

実際の分け方は、対象Scopeと利用中のAI Agent機能に応じてParent Agentが決定する。

# 12. Claude Code / Codex Integration

CRDDは、Claude CodeやCodex固有のSubagent起動方法を規定しない。

`CLAUDE.md`と`AGENTS.md`には、以下の趣旨を追記する。

```text
When a Guided Skill contains multiple independent deliverables,
large evidence sets, or requires an independent review,
you may delegate bounded work to subagents.

Follow:
00_50_Subagent_Orchestration.md

Only the parent agent may integrate results and update
canonical CRDD artifacts.

Subagents may create proposals and findings,
but must not approve decisions or promote context.
```

ツール固有の実装差は、Claude Code、Codex等のRuntimeへ委譲する。

CRDDでは次だけを共通化する。

```text
利用条件
委譲境界
Input
Output
Authority
統合責任
Human Review
```

# 13. Status and Promotion

Subagent Resultは、原則として以下の扱いとする。

```text
Private Working Context
↓
Shared Proposal / Finding
↓ Parent Agent Integration
Integrated Draft
↓ Human Review
Reviewed / Approved Context
```

Subagent Resultを直接`Approved`または`Decision`にしてはならない。

Promotionは、既存のStatus / Promotion Ruleに従う。

# 14. Anti-patterns

## 14.1. Permanent Agent Explosion

成果物や観点ごとに永続Agent定義を大量作成する。

## 14.2. Full Repository Delegation

全Repositoryを無条件に渡し、Subagent自身に正本とScopeを推測させる。

## 14.3. Direct Canonical Editing

複数Subagentが同じCanonical Artifactを直接更新する。

## 14.4. Autonomous Approval

SubagentがProposalをDecisionやApproved Contextへ昇格する。

## 14.5. Result without Evidence

根拠、Assumption、Conflictを示さず結論だけ返す。

## 14.6. Majority Vote

複数Agentの意見を多数決で統合する。

## 14.7. Subagent for Every Task

小さな作業まで分割し、Context説明と統合Costを増大させる。

## 14.8. Hidden Conflict

Subagent間の矛盾を隠し、Parent Agentが一つの案としてまとめる。

# 15. Completion Criteria

軽量Subagent Orchestrationは、対象Skillについて以下を満たしたとき成立する。

```text
Parent Agentが統合責任を持っている
委譲TaskのScopeが明確
必要最小限のContextが渡されている
Preserved IntentとMust Notが明示されている
Subagent ResultにEvidence、Assumption、Conflict、Open Questionがある
SubagentがDecisionやApproved Contextを自己確定していない
複数Resultの一致・矛盾が比較されている
Human Review前にCanonical Artifactが更新されていない
Parent Agentが統合後のArtifactを更新している
```

# Summary

CRDDでは、Subagentを独立した大規模な管理体系として導入しない。

```text
Skillは達成する専門活動を定義する。
Parent AgentはSkillの実行と統合を担う。
Subagentは限定された専門作業を一時的に担当する。
Humanは価値判断と最終承認を担う。
```

この責務分離を守れば、既存のCRDD構成を大幅に増やさず、Git／MarkdownとClaude Code／CodexだけでSubagentを利用できる。

初期段階では、共通Guide一冊、既存Skillへの短い追記、`CLAUDE.md`／`AGENTS.md`への参照追加で十分である。
