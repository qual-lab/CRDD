# CRDD Development Stack

Version: v0.3.1
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-16
Related:
- [00_00_CRDD_Overview.md](00_00_CRDD_Overview.md)
- [00_01_CRDD_Principles.md](00_01_CRDD_Principles.md)
- [00_04_CRDD_End_to_End_Context_Continuity.md](00_04_CRDD_End_to_End_Context_Continuity.md)
- [00_16_Context_Transformation.md](00_16_Context_Transformation.md)
- [00_30_Product_Documentation.md](00_30_Product_Documentation.md)
- [00_32_Testing_Quality.md](00_32_Testing_Quality.md)

---

# Purpose

本ドキュメントは、CRDDがプロダクト開発のどこからどこまでを接続する方法論であるかを、一つのDevelopment Stackとして定義する。

CRDDはUXの5層を否定しない。
Strategy、Scope、Structure、Skeleton、Surfaceを内包したうえで、Behavior、Architecture、Planning、Delivery、Verification、Learningまで接続する。

UX成果物だけでは、動作し、運用され、検証され、学習される製品は完成しない。

```text
人間の思い
↓
UXによる価値と体験の設計
↓
IAによる情報・責務・行動構造の設計
↓
UIによる認識・操作・Feedbackの設計
↓
Graphicによる最終表現と素材の設計
↓
SPECによる振る舞いの契約
↓
Architectureによる技術的成立
↓
Planningによる実行可能な計画
↓
Deliveryによる実装・検証
↓
LearningによるContextへの還元
```

この一気通貫した接続を維持することが、CRDDのProduct Lifecycle Profileの中心である。

---

# 1. Development Stack

```text
Discovery
│
├─ Strategy
├─ Scope
├─ Structure
├─ Skeleton
├─ Surface
│
├─ Behavior
├─ Architecture
├─ Planning
├─ Delivery
├─ Verification
└─ Learning
```

各層は固定的なウォーターフォール工程ではない。
戻る、並行する、統合することを許容する。

ただし、各層が担う専門責務と、前後のContext接続を失ってはならない。

---

# 2. Layer Mapping

| CRDD Layer | 主な専門責務 | UX 5層との関係 | 主な保存先 |
|---|---|---|---|
| Discovery | 原点、課題、Evidence、仮説の整理 | Strategy前段 | `01_Discovery` |
| Strategy | 誰を、なぜ、どの状態へ変えるか | Strategy | `02_UX` |
| Scope | 対象体験、Use Case、対象範囲、Non-goal | Scope | `02_UX` / `04_Spec` |
| Structure | Object、情報構造、責務、Navigation | Structure | `03_IA` |
| Skeleton | Wireframe、Screen Flow、Interaction、UI Contract | Skeleton | `05_UI` |
| Surface | Graphic、Visual、素材、Motion、最終表現 | Surface | `05_UI` |
| Behavior | Condition、State、Rule、Exception、Acceptance | UX 5層の後続 | `04_Spec` |
| Architecture | Data、API、System Boundary、Security、Operation | UX 5層の後続 | `06_Architecture` |
| Planning | Task、Dependency、Estimate、Milestone、Risk | UX 5層の後続 | `07_Workflows` / `99_Roadmap` |
| Delivery | Code、Configuration、Migration、Release | UX 5層の後続 | `40_Develop` / `90_Release` |
| Verification | Test、Review、Evidence、Outcome確認 | UX 5層の後続 | Test Artifact / `90_Release` / 最寄りの親FolderにあるEvidence |
| Learning | Decision、Knowledge、Roadmapへの還元 | 全層へのFeedback | 責務を持つCanonical Artifact / `99_Roadmap` |

---

# 3. Representative Artifact Views

本章はDevelopment Stackを理解するための代表例であり、工程完了条件の正本ではない。Discovery、UX、IA、UI、SPEC、ArchitectureのEntry、変換、責務Coverage、Exit、Gate、Auditは各工程文書の`Phase Process Contract`に従う。Artifactは統合・分割できるため、以下の項目やファイルの存在だけで工程完了を判定してはならない。

## 3.1. Discovery / Strategy / UX

代表的には次を扱う。

```text
Origin / Problem Statement
Persona または Actor Model
Journey Map
Service Blueprint
Experience Principles
Success Signal / Validation Need
```

### Persona / Actor Model

対象者、役割、状況、行動、困りごと、判断責任を明確にする。

Evidenceが弱い場合は、確定PersonaではなくProto Personaとして扱い、Confidenceと検証予定を明示する。

### Journey Map

利用者の時間軸に沿って、行動、思考、感情、Pain、Need、Opportunityを整理する。

### Service Blueprint

Journeyに対して、少なくとも次を接続する。

```text
User Action
Frontstage
Backstage
Human Responsibility
AI Responsibility
System Responsibility
Information / Evidence
Failure / Recovery
```

Service Blueprintは、UXからIA、SPEC、Architectureへ接続する主要な橋渡し成果物である。

## 3.2. IA / Structure

Service Blueprintを受けて、代表的には次を扱う。

```text
Blueprint to Information Map
Object / Concept Model
Information Structure
Responsibility Model
Navigation / User Flow
State Concept
Glossary
```

### Blueprint to Information Map

Blueprint上の各Action・工程について、次を対応づける。

```text
必要な情報
情報源
更新主体
利用主体
表示・操作Surface
必要なBehavior
Failure / Recovery
```

IAは画面一覧そのものではない。
情報・Object・責務・関係を定義し、UIとSPECが参照できる構造を作る。

## 3.3. UI / Skeleton

承認済みScopeに対して、代表的には次を扱う。

```text
Screen Inventory
全対象ScreenのWireframe
Screen Flow / Navigation Flow
UI Contract
Component / Layout Pattern
Minimum Design Token
State / Variant Coverage
```

### 全対象Screen

「全画面」は、製品全体を毎回描き直すことを意味しない。

対象Feature、Change、Release Scope内について、次を網羅することを意味する。

```text
全Logical Screen
主要User Flow
Loading
Empty
Error
Permission
必要なRole / Platform / Brand / Display / Locale Variant
```

### Minimum Design Token

少なくとも次を定義する。

```text
Color
Typography
Spacing
Sizing
Radius
Elevation / Effect
Motionの基本値
必要なState表現
```

すべてを高度なDesign Systemにする必要はない。
ただし、画面ごとに恣意的な値を使わず、再利用可能な最低限のRuleを持つ。

## 3.4. Graphic / Surface

承認済みUI Scopeに対して、代表的には次を扱う。

```text
全対象Screen・主要StateのFinal Visual
Color / Typographyの実適用
Icon
Illustration
Image / Photo
Texture / Effect
Motion / Animation
編集可能なSource Master
Export / Naming / Version Rule
Visual Coverage Matrix
```

Graphicは代表画面だけを美しく作ることではない。
UIで定義されたScreen、State、Variantが、最終表現と必要素材によって網羅されている必要がある。

外部Source Masterを利用する場合、Figma、Illustrator、PSD、After Effects等のAuthorityとVersionをContext Repositoryから追跡可能にする。

## 3.5. Behavior Specification

代表的には次を扱う。

```text
Feature / Use Case
Behavior Specification
Business Rule
State Transition
Permission
Exception / Recovery
Acceptance Criteria
UI Contractとの対応
```

EARS等の構文は、Behavior、Exception、Acceptance Criteriaを曖昧なく表すために利用する。
UX Outcome、IA Intent、Design Intentまで同じ構文へ圧縮してはならない。

## 3.6. Architecture

代表的には次を扱う。

```text
System Context
Component / Service Boundary
Data Model / Data Flow
API / Integration Contract
Security / Privacy Boundary
Failure / Recovery
Deployment / Operation
Architecture Artifact内のDecision / Rationale
```

Architectureは、現在の環境で上流Contractを成立させる実現方法である。
OriginやUXと同一視しない。

## 3.7. Planning

代表的には次を扱う。

```text
Task Breakdown
Dependency
Milestone
Estimate / Range / Confidence
Risk
Owner / Authority
Verification Plan
Change / Rollback Plan
```

## 3.8. Delivery / Verification

代表的には次を扱う。

```text
Code / Configuration / Migration
Test
Review Result
Validation Evidence
Release Record
Known Limitation
Outcome Review
Learning / Feedback
```

CodeやTest Passだけでは、Product Outcome達成を意味しない。

---

# 4. Deliverables and Quality Criteria Are Different

成果物を作ることと、その品質を満たすことを分離する。

## 4.1. UX Quality

```text
PersonaがEvidenceまたは明示された仮説に基づく
Journeyが実際の時間軸とCritical Momentを表す
Service Blueprintが人・AI・System・情報・Failureを接続する
OutcomeがSolutionから独立している
```

## 4.2. IA Quality

```text
利用者のMental Modelを説明できる
ObjectとScreenを同一視していない
責務重複がない
Navigationと情報構造が主要Journeyを支える
State ConceptがBehaviorへ接続可能
```

## 4.3. UI Quality

UI成果物は、最低限次の観点でReviewする。

### Nielsenの5 Usability Quality Components

```text
Learnability
Efficiency
Memorability
Errors
Satisfaction
```

必要に応じてNielsenの10 Usability Heuristicsを詳細Reviewへ利用する。

### Universal Designの7原則

```text
Equitable Use
Flexibility in Use
Simple and Intuitive Use
Perceptible Information
Tolerance for Error
Low Physical Effort
Size and Space for Approach and Use
```

### Accessibility

```text
Contrast
色以外の識別
Keyboard / Focus
Screen Reader
Text Expansion
Motion Reduction
Touch Target
Locale / Language
```

原則名を記載するだけではVerifiedとしない。
対象Screen、Finding、対応、Evidenceを残す。

## 4.4. Graphic Quality

```text
UI CoverageとVisual Coverageが一致
State / Variant漏れがない
Source Masterが追跡可能
素材の再編集性とExport条件が明確
Brand / Platform差分がRuleとして説明可能
```

## 4.5. Behavior / Delivery Quality

```text
UI ContractとBehavior Specificationが整合
Acceptance Criteriaが検証可能
Architectureが承認済みContractを弱めていない
Fresh Evidenceで現在Revisionを確認
Implementationで得た学びが上流へ戻る
```

---

# 5. AI / Human / Specialist Roles

| Layer | AIが支援すること | 人間・専門家が担うこと |
|---|---|---|
| Discovery | 抽出、分類、不足質問 | 原点、価値、問題認識の確認 |
| UX | Journey候補、Outcome整理、矛盾検知 | 対象者、体験価値、原則の判断 |
| IA | Object候補、Relation整理、責務重複検知 | Domain意味、責務、Authorityの判断 |
| UI | Wireframe候補、State抽出、Contract照合 | Interaction、優先順位、利用品質の判断 |
| Graphic | Variant展開、素材一覧、Rule整理 | Visual Direction、Brand、最終表現の判断 |
| SPEC | EARS化、状態・例外整理、Coverage検査 | Business Rule、Permission、Risk判断 |
| Architecture | Candidate比較、Impact分析、設計草案 | 技術Trade-off、Security、運用責任 |
| Planning | Task分解、依存分析、見積候補 | Scope、Priority、Commitment、Risk受容 |
| Delivery | 実装、Test、Review支援 | 重要変更承認、Release判断、結果責任 |
| Learning | Evidence整理、Promotion候補 | 何を標準化・変更・継承するかの判断 |

AIは専門家の成果物形式を再現できるが、専門判断の最終Authorityにはならない。

---

# 6. Coverage Rule

CRDDは、すべての案件へ同じ量の成果物を要求しない。

ただし、対象Scopeについて必要な専門責務を欠かしてはならない。

```text
Compact:
一つの統合文書や軽量Artifactで複数責務を満たす

Standard:
代表成果物を専門領域ごとに分離する

Extended:
高Risk、複数Variant、複数Stakeholder、Enterprise、Legacy向けに
Registry、Baseline、専門Review、Evidenceを強化する
```

成果物を統合する場合も、次を説明できる必要がある。

```text
Persona / Actorはどこにあるか
Journey / Blueprintはどこにあるか
情報構造はどこにあるか
全対象Screen / Flowはどこにあるか
Visual / Asset Coverageはどこにあるか
Behavior / Acceptanceはどこにあるか
```

---

# 7. CRDD Completion Is Not UX Completion

UXの5層が成立しても、次が欠ければ製品は完成していない。

```text
Behavior Specification
Technical Architecture
Delivery Plan
Implementation
Verification
Operation
Learning
```

一方、実装が完成しても、次が失われていればCRDDとして完成していない。

```text
Origin
Persona / Actor
Journey
Service Blueprint
UX Outcome
IA Structure
UI / Graphic Intent
Decision Rationale
```

CRDDの完成条件は、上流成果物と下流成果物が存在することだけではない。

```text
思い
体験
構造
表現
振る舞い
技術
実装
検証
学び
```

が意味を失わず接続されていることである。

---

# 8. Development Stack Definition

本Development Stackにより、CRDDの差別化と適用範囲を次のように定義する。

```text
CRDDは、AIコーディング手法ではない。
CRDDは、UX方法論だけでもない。
CRDDは、人間の思いを、UX・IA・UI・Graphic・SPEC・Architecture・Planning・Deliveryへ接続し、
実装後の学びを再びContextへ戻すEnd-to-End Product Development Methodologyである。
```
