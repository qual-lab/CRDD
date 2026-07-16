# CRDD Change and Context Package

Version: v0.2.0
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-16
Related:
- [00_03_CRDD_Conformance.md](00_03_CRDD_Conformance.md)
- [00_10_Context_Repository.md](00_10_Context_Repository.md)
- [00_11_Information_Provenance.md](00_11_Information_Provenance.md)
- [00_12_Decision_Record.md](00_12_Decision_Record.md)
- [00_13_Human_AI_Responsibility.md](00_13_Human_AI_Responsibility.md)
- [00_14_AI_Change_Control.md](00_14_AI_Change_Control.md)
- [00_16_Context_Transformation.md](00_16_Context_Transformation.md)
- [00_17_Discovery.md](00_17_Discovery.md)
- [00_18_UI_Behavior_Contract.md](00_18_UI_Behavior_Contract.md)
- [00_19_Context_Traceability.md](00_19_Context_Traceability.md)
- [00_23_Phase_Gate_Approval.md](00_23_Phase_Gate_Approval.md)
- [00_30_Product_Documentation.md](00_30_Product_Documentation.md)

---

# Purpose

本ドキュメントは、CRDDにおけるChange PackageとContext Packageの責務、構造、Lifecycle、承認、分割、統合、検証、終了条件を定義する。

CRDDでは、変更を単なるTask、Ticket、Pull Request、Commitとして扱わない。

変更には、以下の連続したContextが存在する。

```text
なぜ変更するのか
何を守る必要があるか
何が変わり、何を変えないのか
どの上流Contextへ影響するか
どの契約を追加・変更・廃止するか
どのように実現するか
何によって成立を確認するか
何を学び、どこへ戻すか
```

Change Packageは、この一連の変更Lifecycleを一つの追跡可能な単位として管理する。

Context Packageは、特定の判断、設計、実装、検証に必要な既存Contextを、正本を複製せずに参照可能な入力セットとして束ねる。

両者を区別することで、CRDDは以下を実現する。

```text
必要なContextを読み落とさない
変更理由と実装を切断しない
上流Intentを下流都合で失わない
大きなRepositoryを作業ごとの適切な範囲へ絞る
AIや専門家が同じ境界で協働する
中断、再開、分割、切戻しを安全に行う
変更後の学びを正本Contextへ戻す
```

---

# 1. Basic Principle

Change PackageとContext Packageは、以下の原則に従う。

```text
Change Packageは変更Lifecycleを追跡する単位である。
Context Packageは作業に必要なContextを選択した入力集合である。
Context Packageは正本を置き換えない。
Change PackageはTicketやPull Requestと同一ではない。
Packageは特定のScopeとRevisionを持つ。
PackageはOrigin、Intent、Contract、Implementation、Verificationを接続する。
変更しないものもBoundaryとして明示する。
不確実性、仮説、未決事項をPackage内で隠さない。
AIはPackageを組み立て、更新、検証できるが、重要な価値判断を自己承認しない。
Package終了時は、学びと確定変更を正本Contextへ還元する。
```

Packageの目的は、作業者へ大量の文書作成を要求することではない。

後から、最低限以下を説明できる状態を作ることが目的である。

```text
この変更はなぜ始まったか
何を根拠に進めたか
どのContextを守ったか
何を変えたか
誰が何を判断したか
何をもって完了としたか
どの未決事項が残ったか
```

---

# 2. Change Package and Context Package

## 2.1. Context Package

Context Packageは、特定の活動に必要な既存Contextを選択し、参照可能にした入力セットである。

例:

```text
UX設計のためのContext Package
UI / Behavior ReviewのためのContext Package
Architecture検討のためのContext Package
AI実装Agentへ渡すContext Package
Legacy解析のためのContext Package
独立Reviewerへ渡すContext Package
```

Context Packageは、原則として以下を含む。

```text
対象Scope
作業目的
守るべきOrigin / Intent
関連Context ID
参照ArtifactとVersion
現在有効なDecision
既知のConstraint
Open Question
禁止変更範囲
必要なVerification条件
```

Context Packageは正本ContextのCopyではない。

可能な限り、安定ID、Path、Version、Commit、Figma Node、Artifact ID等への参照として管理する。

```yaml
context_package:
  purpose: UI / Behavior Contract Review
  scope:
    - FTR-000012
    - UC-000012
  preserve:
    - ORI-000001
    - UX-000004
  references:
    - id: IA-000008
      source: 03_IA/02_Object_Model.md
      revision: 4
    - id: UI-000021
      source: figma://file-key/node-id
      revision: approved-2026-07-15
    - id: REQ-000044
      source: 04_Spec/Topic_Behavior.md
      revision: 3
```

## 2.2. Change Package

Change Packageは、一つの変更要求または変更目的について、開始から検証、学びの還元までを管理するDelivery Entityである。

Change Packageには、`CHG` IDを付与する。

```text
CHG-000123
```

Change Packageは、少なくとも以下を接続する。

```text
Change Origin
↓
Current Context Package
↓
Impact and Boundary
↓
Decision / Approval
↓
Contract Change
↓
Delivery Plan
↓
Implementation
↓
Verification Evidence
↓
Feedback / Promotion / Closure
```

## 2.3. Difference

| Item | Context Package | Change Package |
|---|---|---|
| Purpose | 作業に必要なContextを束ねる | 変更Lifecycle全体を追跡する |
| Primary Nature | Input | Change Control Unit |
| Stable ID | 必要に応じて付与 | 原則`CHG` IDを必須とする |
| Authority | 正本への参照のみ | Scope、Decision、実行、検証を追跡する |
| Mutation | 参照集合は更新できる | Package Revisionとして履歴管理する |
| Completion | 作業終了後に破棄または保存可能 | Closed後も履歴として保持する |
| Source of Truth | ならない | 変更履歴の正本になり得るが、各Propertyの正本を置き換えない |

---

# 3. When to Create a Change Package

以下のいずれかに該当する変更では、Change Packageを作成する。

```text
複数の専門層へ影響する
重要なUX、IA、UI、Behavior、Architectureを変更する
複数Artifactを同期して変更する
人間承認が必要な判断を含む
既存互換性、Security、Governance、Dataへ影響する
実装と検証を複数Taskへ分割する
複数人または複数Agentが協働する
中断、再開、切戻しが必要になる可能性がある
Releaseまたは顧客説明に影響する
変更理由を将来再利用する価値がある
```

以下のような軽微な変更では、独立したChange Packageを省略してよい。

```text
意味を変えない誤字修正
参照切れの修正
Format整形
自動生成物の再生成
既存承認済みRuleに従う機械的な更新
```

ただし、軽微に見える変更でも、以下へ影響する場合はChange Packageを作成する。

```text
名称変更により意味または責務が変わる
UI文言変更によりUser Decisionへ影響する
ID、Schema、API、Data Compatibilityへ影響する
Securityまたは権限表示へ影響する
既存Decisionを実質的に覆す
```

---

# 4. Change Package Scope

Change Packageは、Project全体ではなく、一つの追跡可能な変更目的へ適用する。

標準Scope候補は以下である。

```text
Feature変更
Use Case変更
User Action変更
UX Outcome変更
IA構造変更
UI / Behavior Contract変更
Architecture変更
Migration
Refactoring
Bug Correction
Security / Governance変更
Prototype / Experiment
Legacy Reconstruction
Documentation-only Change
```

## 4.1. One Package, One Primary Change Intent

一つのChange Packageは、一つのPrimary Change Intentを持つ。

複数の無関係な変更を一つのPackageへ混在させてはならない。

Bad:

```text
CHG-000123
- InboxのUI改善
- Database Migration
- License文言修正
- Slack同期性能改善
```

Good:

```text
CHG-000123: Topic確認時の判断負荷を下げる
CHG-000124: Topic IndexのDatabase Migration
CHG-000125: License表示を更新する
CHG-000126: Slack同期処理時間を短縮する
```

複数変更が同じ上位目的へ属する場合、Parent Changeを作成し、Child Packageへ分割してよい。

```text
CHG-000120: Inbox Decision Experience Improvement
├─ CHG-000123: Topic Detail UI / Behavior
├─ CHG-000127: Priority Calculation
└─ CHG-000128: Evidence Retrieval Performance
```

---

# 5. Standard Change Package Components

Change Packageは、最低限以下の情報を持つ。

| Component | Meaning |
|---|---|
| `Change ID` | 安定した`CHG` ID |
| `Title` | 人間が理解できる変更名称 |
| `Primary Intent` | なぜ変更するか |
| `Trigger` | 発見、要求、Evidence、Incident、Decision等 |
| `Scope` | 変更対象Context、Artifact、Feature、Use Case |
| `Non-scope` | 今回変更しないもの |
| `Context Package` | 作業に必要な上流・周辺Context |
| `Current State` | 現状と問題 |
| `Target State` | 変更後に目指す状態 |
| `Impact` | 上流、下流、横断影響 |
| `Open Questions` | 未決事項、不確実性、仮説 |
| `Decision` | 人間判断またはDecision Recordへの参照 |
| `Gate State` | 関連Phase Gateの状態 |
| `Delivery Plan` | 実装、移行、作業順序、Dependency |
| `Verification` | Acceptance、Test、Review、Evidence |
| `Result` | 実際に変更した内容 |
| `Learning` | 得られた知見とContext Feedback先 |
| `Status` | Package Lifecycle状態 |

すべてを別ファイルに分割する必要はない。

小規模な変更では、一つのMarkdownまたは一つのRegistry Recordへ統合してよい。

---

# 6. Standard Package Structure

標準的なPackage構造例を以下に示す。

```text
40_Develop/
└─ Changes/
   └─ CHG-000123_Topic_Decision_Experience/
      ├─ 00_Manifest.md
      ├─ 01_Brief.md
      ├─ 02_Context_References.md
      ├─ 03_Impact_and_Boundary.md
      ├─ 04_Decision_and_Gate.md
      ├─ 05_Contract_Changes.md
      ├─ 06_Delivery_Plan.md
      ├─ 07_Verification.md
      └─ 08_Result_and_Learning.md
```

これは推奨構造であり、固定構造ではない。

Compact Packageでは、以下のように一つへまとめてよい。

```text
40_Develop/Changes/CHG-000123.md
```

外部Tool、Issue Tracker、DatabaseでPackageを管理する場合も、同じ情報責務を満たせばよい。

## 6.1. Package Manifest

Package Manifestは、機械的な参照、影響分析、Agent実行、中断再開に利用できる形式を推奨する。

例:

```yaml
id: CHG-000123
title: Topic確認時の判断負荷を下げる
status: In Progress
revision: 3
change_type: Enhancement
primary_intent:
  - UX-000004
trigger:
  - EVD-000072
scope:
  features:
    - FTR-000012
  use_cases:
    - UC-000012
  contexts:
    - IA-000008
    - UI-000021
    - REQ-000044
non_scope:
  - Priority calculation logic
relations:
  derived_from:
    - PRB-000006
  implements:
    - DEC-000031
  verified_by:
    - TST-000087
phase_gates:
  G4: Approved
  G5: Approved
  G6: In Review
approver: Human
```

YAML等の機械可読形式は推奨であり、初期運用ではMarkdownのみでもよい。

---

# 7. Change Brief

Change Briefは、Change Packageの入口となる。

最低限、以下を含む。

```text
何が起きたか
誰が何に困っているか
なぜ今変更するか
何を目指すか
何を目指さないか
どのEvidenceまたは発言がTriggerか
```

Change Briefは、Solutionを先に固定するための文書ではない。

Bad:

```text
Topic Cardへ赤いBadgeを追加する。
```

Good:

```text
重要Topicと通常Topicの差が認識しにくく、利用者が確認順序を判断できない。
重要性とその理由を短時間で理解できる状態を目指す。
Badge追加はSolution Candidateの一つである。
```

Discoveryが完了している場合、Change Briefは既存のOrigin、Problem、UX Contextを参照する。

新しいWhyをPackage内で重複して正本化しない。

---

# 8. Context Package Assembly

Change Packageを開始するとき、AIまたは人間はContext Packageを組み立てる。

## 8.1. Minimum Context Selection

最低限、以下を確認する。

```text
Primary Origin / Problem
関連UX Outcome
対象Feature / Use Case / User Action
関連IA Context
UI / Behavior Contract
有効なDecision
Architecture Constraint
既存Implementation Context
関連Test / Evidence
Roadmap / Release Constraint
Security / Governance Constraint
```

すべてが存在するとは限らない。

存在しない場合は、以下のいずれかとして明示する。

```text
Not Applicable
Not Yet Defined
Unknown
Recovered Candidate
Required Before Gate
Can Proceed as Assumption
```

## 8.2. Context Relevance

Repository内の全Contextを無差別にPackageへ含めてはならない。

Context選択時は、以下を区別する。

| Relevance | Meaning |
|---|---|
| `Required` | 作業前に必ず読む必要がある |
| `Reference` | 判断補助として参照する |
| `Constraint` | 変更が違反してはならない |
| `Evidence` | 現状または検証を支える |
| `Excluded` | 今回は意図的に対象外とする |

Context Packageには、選択理由を残す。

AIは、検索Hitがあったという理由だけでContextを大量投入してはならない。

## 8.3. Snapshot and Live Reference

Context Packageの参照方式は、以下を区別する。

```text
Live Reference
現在有効な正本を常に参照する

Revision Reference
特定RevisionまたはCommitを参照する

Snapshot
作業時点の内容を検証目的で固定保存する
```

承認、再現、独立Reviewに使用するContextは、Revision ReferenceまたはSnapshotを推奨する。

---

# 9. Impact and Boundary

Change Packageは、変更対象だけでなく、変更しないものを明示する。

## 9.1. Boundary

最低限、以下を定義する。

```text
In Scope
Out of Scope
Must Preserve
May Change
Must Not Change
Deferred
```

例:

```text
In Scope:
- Topic Detailの情報優先順位
- Topic DetailのLoading / Error表示
- Topic既読化Behavior

Out of Scope:
- Topic重要度算出Logic
- 通知Timing

Must Preserve:
- AI提案と人間判断を視覚的に区別する
- Evidence Sourceへ遡れる
```

## 9.2. Cross-layer Impact

影響評価は、実装ファイルだけで行わない。

以下の層を確認する。

```text
Origin / Principle
Problem / Evidence
UX
Feature / Use Case
IA
UI
Behavior / SPEC
Architecture
Data / API
Security / Governance
Implementation
Test
Release / Operation
Documentation / Onboarding
```

影響なしと判断した層も、重要変更では理由を残す。

## 9.3. Expected and Actual Impact

作業前の影響予測と、作業後に判明した実影響を分ける。

```text
Expected Impact
Package開始時点の予測

Actual Impact
実装・検証後に確認された影響
```

差分が大きい場合、Context FeedbackまたはDecision Reviewを行う。

---

# 10. Change Package Lifecycle

Change Packageは、以下の標準Statusを持つ。

| Status | Meaning |
|---|---|
| `Captured` | 変更候補を受け取った |
| `Framing` | Intent、Scope、Contextを整理中 |
| `Ready for Review` | 変更判断またはGate Reviewが可能 |
| `Approved` | 対象Revisionの変更開始が承認された |
| `In Progress` | 設計、実装、移行等を実行中 |
| `Blocked` | 未決、Dependency、Failure等により停止中 |
| `Ready for Verification` | 実装または変更が完了し検証可能 |
| `Verified` | 定義したVerificationを満たした |
| `Closed` | 正本更新、学び還元、残課題整理まで完了 |
| `Reopened` | 新Evidence、Regression、追加変更により再開 |
| `Cancelled` | 実施せず終了した |
| `Superseded` | 別Change Packageへ置き換えられた |

Package StatusとPhase Gate Statusを同一視してはならない。

例:

```text
Change Package Status: In Progress
G4 UI / Behavior Contract: Approved
G5 Delivery Plan: Approved
G6 Implementation Verification: Not Evaluated
```

## 10.1. Verified and Closed Are Different

`Verified`は、変更結果が定義したVerificationを満たした状態である。

`Closed`は、さらに以下が完了した状態である。

```text
正本Contextが更新された
Decisionが必要なら記録された
Trace Relationが更新された
残課題がDeferredまたは別Changeへ移された
学びが適切なContextへ戻された
不要なTemporary Contextが整理された
```

コードがMergeされたことだけで`Closed`にしてはならない。

---

# 11. Package Revision

Change Packageは、意味のある変更ごとにRevisionを持つ。

以下の場合、Revisionを更新する。

```text
Primary Intentが変更された
Scopeが拡大または縮小した
重要なContext Referenceが変更された
承認済みContractが変更された
Delivery Planが大きく変更された
Verification条件が変更された
```

過去Revisionを破壊的に上書きしてはならない。

Git履歴だけで十分に再現できる場合、文書内へ全Revisionを複製する必要はない。

ただし、Gate承認対象、実装対象、検証対象のRevisionを識別できるようにする。

---

# 12. Phase Gate Integration

Change Packageは、`00_23_Phase_Gate_Approval.md`のGateを利用する。

Package内で、必要なGateだけを選択する。

例:

```text
Legacyの表示Bug修正
G0 Discovery Framed: Combined
G1 Origin / Problem Accepted: Recovered Contextで代替
G2 UX Direction Accepted: Existing UXを参照
G3 IA Coherence Accepted: Not Impacted
G4 UI / Behavior Contract Accepted: Required
G5 Delivery Plan Accepted: Required
G6 Implementation Verified: Required
G7 Outcome / Learning Reviewed: Compact Review
```

Gateを省略する場合、`Not Applicable`、`Combined`、`Existing Approval Referenced`等の理由を残す。

Gateを見えない形で省略してはならない。

---

# 13. Decision and Approval

Change Packageに重要判断が含まれる場合、Decision Recordへ接続する。

以下の判断は、Package内メモだけで完結させず、原則として`DEC` IDを持つDecision Recordへ昇格する。

```text
OriginまたはProduct Principleを変更する
複数案から重要な方針を選択する
UX、IA、UI責務を大きく変更する
Behavior ContractまたはAcceptanceを変更する
Architecture境界、Data、Securityへ影響する
互換性を破壊する
重大Riskを受容する
今後も再利用される判断を行う
```

AIはDecision Candidateを整理してよい。

最終的な承認者は、人間である。

---

# 14. Delivery Plan

Delivery Planは、実装Taskの一覧だけではない。

最低限、以下を含む。

```text
Goal
Input Context Revision
Target Contract
Boundary
Dependency
作業順序
Task分割
Migration / Rollback
Verification方法
AI / Human Role
停止条件
再開方法
```

## 14.1. Right-sized Task

Taskは、以下を満たす大きさへ分割する。

```text
一つの明確なGoalを持つ
変更境界を説明できる
単独で検証できる
失敗時に切戻しまたは再実行できる
後続Taskへ学びを渡せる
```

AI Agentによる実装では、一つのTaskへ過大なContextと責務を渡さない。

Context PackageはTaskごとに再構成してよい。

## 14.2. Delivery Engine Adapter

Change Packageは、特定のDelivery Engineへ依存しない。

以下へ変換または出力してよい。

```text
cc-sdd
Claude Code
Codex
GitHub Spec Kit
OpenSpec
Issue Tracker
Manual Development Plan
External Vendor Work Package
```

Delivery Engineへ渡す際も、以下を失ってはならない。

```text
Primary Intent
Scope / Non-scope
Contract
Constraint
Approval State
Verification Obligation
```

---

# 15. Verification

Verificationは、実装が動くことだけを確認しない。

以下を必要に応じて確認する。

```text
Contract Verification
UI / Behavior / API / Data契約を満たすか

Intent Verification
UX Outcomeまたは変更目的へ寄与したか

Regression Verification
既存の守るべきContextを壊していないか

Operational Verification
運用、監視、移行、Supportが成立するか

Governance Verification
Security、Privacy、AI Policy、Authorityへ違反しないか
```

Verification Evidenceには、`TST`または`EVD` IDを付与できる。

検証結果は、成功、失敗、未検証を分離する。

```text
Passed
Failed
Partially Verified
Not Verified
Blocked
Not Applicable
```

「問題なさそう」「実装済み」だけで完了宣言してはならない。

---

# 16. Result and Learning

Change Package終了時は、計画と結果の差を記録する。

```text
何を変更したか
何を変更しなかったか
計画との差分
新しく判明した制約
失敗または却下した案
未解消Risk
Deferred Scope
次のChange候補
```

得られた学びは、以下のいずれかへ戻す。

```text
Discovery / Evidence
UX
IA
UI / Behavior Contract
Architecture
Testing Guide
Operation / Workflow
Decision Record
Roadmap
CRDD Core / Practice GuideへのPromotion Candidate
```

Package内だけに重要な学びを閉じ込めてはならない。

---

# 17. Dependency, Split, and Merge

## 17.1. Dependency

Change Package間のDependencyを明示する。

標準Relation例:

```text
blocks
blocked_by
depends_on
enables
conflicts_with
supersedes
split_from
merged_into
```

Dependencyは、単なる作業順序だけでなく、Context確定順序を含む。

例:

```text
CHG-000128 depends_on CHG-000123
理由: UIが必要とするEvidence構造が確定しないとRetrieval APIを確定できない
```

## 17.2. Split

Packageが大きくなりすぎた場合、以下を基準に分割する。

```text
Primary Intentが複数存在する
独立して承認可能である
異なる専門Boundaryを持つ
異なるReleaseへ分けられる
個別に検証可能である
RiskまたはOwnerが大きく異なる
```

分割元と分割先のRelationを保持する。

## 17.3. Merge

複数Packageを統合する場合、以下を確認する。

```text
同じPrimary Intentへ収束する
Scopeの重複または競合を解消できる
承認履歴を失わない
個別Verification結果を追跡できる
Cancelled扱いではなくmerged_intoを残す
```

---

# 18. Legacy and Brownfield Application

Legacy／Brownfield環境では、Change Package開始時に信頼できる上流Contextが存在しない場合がある。

この場合、Context Packageは以下をEvidenceとして利用できる。

```text
実行中のCode
Runtime Behavior
Log
Database Schema
API Response
Screen Capture
運用手順
Support記録
既存文書
担当者の証言
過去Commit / Ticket
```

ただし、以下を分離する。

```text
Observation
Documented Claim
Current Behavior
Expected Behavior Candidate
Recovered Intent Candidate
Human-confirmed Intent
```

現在動いている実装を、そのまま正しいRequirementまたはOriginとして扱ってはならない。

Legacy Change Packageでは、以下を追加で記録する。

```text
復元した範囲
復元できなかった範囲
Evidence Source
Confidence
ConflictするEvidence
人間確認が必要なIntent
今回確定するもの
今回仮説のまま残すもの
```

Legacy解析そのものを目的とするPackageは、Change Typeを`Reconstruction`または`Reverse Engineering`とする。

---

# 19. AI Use

AIは、Change Packageに対して以下を行える。

```text
関連Contextの検索と候補提示
Context Packageの組み立て
Impact候補の抽出
不足Contextの検知
Conflictの検出
Scope分割案の提示
Delivery Planの草案
Task分解
Trace Relation更新案
Verification Planと結果整理
Learning Promotion候補の抽出
```

AIは、以下を人間承認なしに確定してはならない。

```text
Primary Intentの変更
Scope拡大による重要影響の受容
UX、IA、UI、Behaviorの重要変更
Security / Governance Riskの受容
互換性破壊
重要Decision
Gate Approval
Change Package Closure
```

## 19.1. AI Execution Context

AIへ作業を依頼する際は、最低限以下を渡す。

```text
Change ID
Task Goal
Current Package Revision
Context Package
Scope / Non-scope
Protected Context
Expected Output
Verification Obligation
Stop Conditions
```

AIが不足Contextを検知した場合、勝手に補完せず、以下のいずれかを行う。

```text
質問する
Assumptionとして明示する
Technical Spikeへ分岐する
Gate Reviewへ戻す
Blockedにする
```

---

# 20. Compact, Standard, and Extended Package

変更規模に応じて、Packageの文書量を調整する。

## 20.1. Compact Package

対象:

```text
単一Use Caseまたは小規模Bug
影響層が限定的
Decisionが既存Ruleで解決できる
一人または一Agentで完了可能
```

最低限:

```text
Change ID
Why
Scope / Non-scope
Related Context
変更内容
Verification
Result
```

## 20.2. Standard Package

対象:

```text
複数Artifactまたは複数Task
UI / Behavior Contract変更
人間承認が必要
複数の専門層へ影響
```

本標準の主要Componentを持つ。

## 20.3. Extended Package

対象:

```text
複数Featureまたは複数Release
Migration
重大Security / Governance影響
外部Vendorまたは複数Team
高い不確実性
Legacy大規模再構築
```

追加候補:

```text
Stakeholder Map
RASIC
Release Plan
Rollback Plan
Migration Evidence
Cross-package Dependency Map
Risk Register
Communication Plan
```

Package規模は、変更の重要度と複雑性に合わせる。

Document量を増やすこと自体を品質としない。

---

# 21. Example

```text
CHG-000123
Title: Topic確認時の判断負荷を下げる
Type: Enhancement
Status: Ready for Verification
Revision: 3

Primary Intent:
- UX-000004 判断負荷を下げる

Trigger:
- EVD-000072 ユーザー観察で重要度と根拠の往復確認が発生

Scope:
- UC-000012 Topicの根拠を確認し、次Actionを判断する
- UI-000021 Topic Detailの認識と操作
- REQ-000044 Topic既読化Behavior

Non-scope:
- Topicの重要度算出Logic
- Slack通知条件

Must Preserve:
- AI提案と人間判断を明確に区別する
- Evidence Sourceへ遡れる

Decision:
- DEC-000031 根拠と次Actionを同一視野へ配置する

Gate:
- G4 Approved
- G5 Approved
- G6 In Review

Verification:
- TST-000087 Loading / Error / Permissionを含むUI Contract Test
- EVD-000083 Headless DOM Test Result
- Human Review: UX Intent確認

Remaining:
- Mobile LayoutはCHG-000129へDeferred
```

このPackageから、実装Agent向けにTaskごとのContext Packageを生成してよい。

```text
Task 1 Context Package:
- UI-000021
- REQ-000044
- ARC-000018
- Existing Component Contract
- TST-000087

Task 2 Context Package:
- REQ-000044
- Database behavior
- Existing read-state migration rule
- Integration Test obligation
```

---

# 22. Anti-patterns

## 22.1. Ticket Equals Change Context

Issue Trackerの短いTicketだけで、変更理由、上流Intent、検証義務まで管理できると考える。

TicketはChange Packageへの入口または外部表示になり得るが、CRDD Contextを自動的には満たさない。

## 22.2. Copying All Documents

関連しそうな文書をすべてPackageへ複製する。

正本との乖離とContext Overloadを生む。

## 22.3. Implementation-first Package

変更理由やContractを確認せず、Target Filesと実装手順だけをPackageにする。

これはTask Planであり、CRDD Change Packageではない。

## 22.4. Hidden Scope Expansion

作業中に影響範囲が増えたにもかかわらず、Package RevisionやGateを更新しない。

## 22.5. Closing at Merge

Pull RequestがMergeされた時点でPackageをClosedにする。

正本Context、Trace、Evidence、Learning、Deferred Scopeが更新されていなければCloseできない。

## 22.6. Package as New Source of Truth for Everything

Change PackageへUX、IA、UI、SPECの全文をコピーし、元の正本Contextを更新しない。

Packageは変更Lifecycleを追跡するが、各Propertyの正本を置き換えない。

## 22.7. AI-generated Why

AIが実装内容から、もっともらしい変更目的を後付けし、Human-confirmed Intentとして扱う。

AI推定はHypothesisまたはRecovered Candidateとして明示する。

---

# 23. Minimum Rule

CRDD Change Packageでは、最低限以下を守る。

```text
重要変更には安定したChange IDを付ける。
なぜ変更するかを実装内容と分離して記録する。
変更対象と変更しない範囲を明示する。
必要な上流ContextとDecisionへ接続する。
UI / Behavior等のContract変更をTraceする。
実装前にVerification方法を定義する。
実装結果と計画との差を記録する。
重要判断は人間が承認する。
Package終了時に正本Context、Trace、Evidence、Learningを更新する。
```

すべての変更へ重いPackageを要求しない。

しかし、将来説明すべき変更を、Commit Messageだけへ閉じ込めてはならない。

---

# 24. Final Principle

CRDDにおけるChange Packageは、コードを変更するための作業箱ではない。

Change Packageは、ある時点で人間が何を変えようとし、何を守り、どのContextに基づいて判断し、どの実現方法を選び、何によって成立を確認したかを未来へ渡す単位である。

Context Packageは、その変更に必要な知識を、正本を壊さず、必要な範囲へ集める。

```text
Context Packageが、作業に必要な理解を届ける。
Change Packageが、理解から判断、実装、検証までをつなぐ。
正本Contextが、変更後の学びを受け取り、次の変更へ継承する。
```

CRDDは、この循環によって、個々のTaskやAgent Sessionを越えて、ものづくりの意図と判断を継続させる。
