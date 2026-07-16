# Product Documentation

Version: v0.2.0
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-16
Related:
- [00_03_CRDD_Conformance.md](00_03_CRDD_Conformance.md)
- [00_04_CRDD_End_to_End_Context_Continuity.md](00_04_CRDD_End_to_End_Context_Continuity.md)
- [00_10_Context_Repository.md](00_10_Context_Repository.md)
- [00_15_Document.md](00_15_Document.md)
- [00_16_Context_Transformation.md](00_16_Context_Transformation.md)
- [00_35_Architecture_Integration.md](00_35_Architecture_Integration.md)

---

> 本ドキュメントは、CRDD Product Lifecycle Profileを実務へ適用するためのPractice Guideである。
>
> 本書が示すファイル名・分割方法・テンプレートは推奨形であり、すべての文書を個別に作成することを要求しない。
>
> 一方で、Origin、UX、IA、UI、SPEC、Architecture、Implementation、Verificationのうち、対象に必要な専門責務と前後の意味的接続を失ってはならない。

---

# 1. Purpose

本ドキュメントは、プロダクトの原点と判断を、UX・IA・UI・SPEC・Architecture・Implementation・Verificationへ接続するための、成果物の責務境界と推奨構成を定義する。

CRDDにおけるProduct Documentationは、工程ごとに文書を作ること自体を目的としない。

各Artifactは、上流Contextを次の専門領域で扱える形へ変換し、その判断と制約を次へ渡すためのViewまたはContractである。

```text
文書を増やすことが目的ではない。
思いと判断を、下流で利用・検証できる形へ変換することが目的である。
```

本書は、以下の実務上の問いに答える。

```text
どの情報を、どの専門層が責任を持つか
何を独立文書にし、何を統合してよいか
前後の層をどのように接続するか
UIとSPECをどのように対として管理するか
小規模・初期・Legacy案件でどこまで作ればよいか
AIや専門家へ何をInputとして渡すか
```

---

# 2. Documentation Principle

## 2.1. Responsibility Is Required; File Count Is Not

CRDDは、すべての対象に同じ数の文書を要求しない。

小規模なPrototypeでは、UX・IA・UI・SPECを一つの文書へ統合してよい。
複雑なProductでは、機能・画面・Domain・Release単位へ分割してよい。

ただし、文書を統合または省略する場合も、以下の責務を失ってはならない。

```text
Origin / UX        = なぜ作るか、誰をどの状態へ変えるか
IA                 = Service Blueprintを受け、対象概念・情報・責務・Navigationを構造化する
UI                 = 情報構造を認識・操作できるWireframe、Flow、Component、Tokenへ変換する
Graphic / Visual   = UIを最終Visual、素材、Icon、Motionとして成立させる
SPEC               = どの条件・状態で、システムがどう振る舞うか
Architecture       = 現在の制約で、どう成立させるか
Implementation     = 今回、何をどの方法で具体化したか
Verification       = 意図と契約を満たしたか、何を学んだか
```

## 2.2. Documents Are Connected Contracts

各Artifactは、単独で完結した説明資料ではない。

前の層から受け取ったContextと、次の層へ渡すObligationを持つ。

重要なArtifactでは、少なくとも以下を確認できるようにする。

```text
Source Context
Preserved Intent
Transformation Decision
Open Questions
Downstream Obligation
Verification
```

記載方法はHeader、本文、表、Manifest、Link等のいずれでもよい。

## 2.3. Preserve Authority by Property

CRDDでは、すべてのPropertyを一つのMarkdownへ集約する必要はない。

Propertyごとに、最も適切なArtifactが正本を持つ。

| Property | Primary Authority Candidate |
|---|---|
| Origin、Why、価値、判断理由 | UX文書、Decision Record |
| User Problem、Outcome、Experience Principle | UX文書 |
| Object Model、Responsibility、Navigation | IA文書、Diagram |
| Information Hierarchy、Wireframe、Screen Flow、Interaction、Component | UI文書、Figma等のDesign Artifact |
| Color、Typography、Icon、Illustration、Graphic、Motion、Visual Asset | Graphic / Visual Design Artifact、Source Asset |
| Behavior、State、Condition、Exception | SPEC |
| Data、API、Security、Technical Boundary | Architecture |
| 現在の実装事実 | Code、Configuration |
| 成立確認結果 | Test、Evidence、Release Record |

外部Artifactを正本として扱う場合、Context Repository側には少なくとも以下を残す。

```text
Artifactの目的
Authorityを持つProperty
Versionまたは確認時点
参照先
関連する上流・下流Context
現在のStatus
```

## 2.4. UI and SPEC Are Paired Contracts

UIとSPECは完全な直列工程として扱わない。

```text
UI Contract
利用者に何が見え、何を操作でき、どんなFeedbackを受けるか

Behavior Contract
どの条件・状態で何が起き、何が返されるか
```

両者は相互に具体化し、Loading、Empty、Error、Permission、Disabled、Confirmation等の状態を対応づける。

## 2.5. Documentation Must Scale

文書化の粒度は、以下に応じて変えてよい。

```text
対象の複雑性
変更Risk
関係者数
専門領域の境界数
再利用期間
AIへ委譲する範囲
後から再判断する可能性
```

単純な変更へ過剰な文書を要求してはならない。
一方で、重要な判断を会話や担当者の記憶だけに残してはならない。

---

# 3. Canonical Product Context Flow

Product Lifecycle Profileでは、以下を標準的な責務の流れとして扱う。

```text
01_Discovery
未整理の思い、課題、Evidence、要求候補を受け取る
        ↓
02_UX
なぜ作るか、誰をどの状態へ変えるかを定義する
        ↓
03_IA
Service Blueprintを受け、対象概念、情報、行動、責務、Navigationを構造化する
        ↓
05_UI ⇄ 04_Spec
情報構造を見せるUI Contractと、System Behavior Contractを対で定義する
        ↓
05_UI / Graphic & Visual Design
承認済みScopeの全Screen・主要Stateを最終Visualと素材へ展開する
        ↓
06_Architecture
現在の環境・制約で成立させる技術構造を選ぶ
        ↓
40_Develop
Plan、Code、Configuration、Testとして具体化する
        ↓
90_Evidence / 90_Release
成立性、利用結果、Release状態を記録する
        ↓
UX / IA / UI / SPEC / Architecture / Decisions / Roadmap
学びと変更を適切なContextへ戻す
```

このFlowは、固定された作業順を意味しない。

```text
UI PrototypeからUX仮説を検証してよい
Technical Spikeを先に行ってよい
IAとUIを反復してよい
Legacy CodeからSPECやOriginを逆方向に復元してよい
```

ただし、反復や逆方向の分析でも、情報の由来、不確実性、判断理由を維持する。

---

# 4. Common Artifact Contract

各専門Artifactは、可能な範囲で以下を持つ。

```text
# Title

Version:
Status:
Owner:
Last Updated:
Related:

## Purpose
このArtifactが何を決めるか

## Source Context
何を根拠にしているか

## Preserved Intent
下流でも守るべき価値・原則

## Decision / Definition
このArtifactで具体化した内容

## Assumptions
成立のために置いた前提

## Open Questions
未確定事項

## Downstream Obligation
次のArtifactまたは工程が満たす条件

## Verification
どのように妥当性を確認するか
```

すべての見出しを機械的に持つ必要はない。
ただし、重要なArtifactについて同等の情報を説明できない状態は避ける。

---

# 5. Discovery Starter Structure

`01_Discovery`は、未整理の情報を直ちに確定仕様へ変えず、Origin・Problem・Evidence・Hypothesisを抽出する入口である。

詳細な質問、振り分け、昇格条件は、別途定義するDiscovery Standardを正本とする。

推奨する最小構成は以下である。

| Artifact | Responsibility |
|---|---|
| `01_00_INDEX.md` | Discoveryの対象、読む順番、現在の主要論点 |
| `01_01_Origin.md` | 始まりの経緯、作りたい理由、守りたい思い |
| `01_02_Problem_and_Evidence.md` | 課題、観察、利用者の声、Evidence |
| `01_03_Hypotheses_and_Questions.md` | 仮説、前提、不足情報、確認計画 |
| `01_9X_Discovery_Brief.md` | UX・Research・Prototype等へ渡す要約 |

小規模な対象では、これらを一つのDiscovery Briefへ統合してよい。

## Discovery Handoff

UXへ進む時点で、最低限以下を説明できるようにする。

```text
なぜ着手するのか
誰または何が困っているのか
何が観察事実で、何が仮説か
何を実現したいのか
何がまだ分からないのか
次に何を検証するのか
```

---

# 6. UX Starter Structure

`02_UX`は、製品の原点を、利用者に起こしたい変化、体験の時間軸、Frontstage／Backstageの成立条件へ変換する。

CRDDでは、UXを画面設計の前段資料で終わらせない。UX成果物は、IA・UI・SPEC・Architectureへ引き継ぐ上流Contractとして扱う。

## 6.1. Minimum Required UX Deliverables

Product Lifecycle Profileでは、承認済みScopeについて最低限以下を持つ。

| Artifact | Responsibility | Minimum Content |
|---|---|---|
| `02_01_Foundation.md` | Origin / Why | Vision、Problem、Target Outcome、Principle、Non-goal |
| `02_02_Persona.md` | Who | Persona、状況、Goal、Pain、能力・制約、Evidence、Confidence |
| `02_03_Journey_Map.md` | Experience Timeline | Phase、行動、思考、感情、Pain、Opportunity、主要Decision |
| `02_04_Service_Blueprint.md` | Delivery Bridge | User Action、Frontstage、Backstage、System／AI、Support Process、Evidence、Failure Point |
| `02_05_Experience_Principles.md` | 判断基準 | Desired Outcome、守る体験、避ける体験、人間／AI責任 |
| `02_06_Success_and_Risk.md` | 成立確認 | Success Signal、仮説、Risk、検証方法 |

### Persona Rule

Personaは必須成果物とするが、根拠のない人物像を創作してはならない。

```text
Research Persona   = Evidenceに基づく
Proto Persona      = 仮説として作成し、Confidenceと検証予定を持つ
Role / Actor Model = 個人属性が価値を持たない業務Systemで利用してよい
```

重要なのは、名前や年齢を埋めることではなく、利用状況、Goal、Pain、能力、責任、制約を後工程へ渡せることである。

### Journey Map Rule

Journey Mapは、画面遷移図ではない。

```text
利用前
利用中
利用後
```

の時間軸で、行動、認識、感情、Pain、Decision、Evidence、Opportunityを表す。

### Service Blueprint Rule

Service Blueprintは、UXからIA・SPEC・Architectureへ接続する必須の橋渡し成果物である。

最低限、以下を対応づける。

```text
User Action
Frontstage Interaction
Backstage Process
System / AI Responsibility
Human Responsibility
Data / Evidence
Support Process
Failure / Recovery Point
```

Blueprintによって、人間に見える体験と、その裏で必要な情報・処理・責任を接続する。

## UX Owns

```text
なぜ作るか
誰の何を変えるか
利用前後の期待する変化
体験の時間軸
人間・AI・Systemの責任関係
体験上守る原則
避けるべき体験
成功と失敗の判断基準
```

## UX Does Not Own

```text
最終画面Layout
最終Graphic
個別APIの構造
DB Schema
Framework選択
```

## UX Handoff to IA

IAへ渡す最低条件は以下である。

```text
PersonaまたはActor Model
Journey Map
Service Blueprint
対象利用者と利用状況
実現したいOutcome
User Actionと主要Decision
Frontstage / Backstage / System責任
扱う必要がある情報とEvidence
未検証の仮説と制約
```

---

# 7. IA Starter Structure

`03_IA`は、UXのPersona、Journey Map、Service Blueprintを、利用者が理解・探索・操作できる情報構造、Object、責務、関係、Navigationへ変換する。

## 7.1. Minimum Required IA Deliverables

| Artifact | Responsibility | Minimum Content |
|---|---|---|
| `03_00_INDEX.md` | IAの入口 | Scope、読む順番、正本、未決事項 |
| `03_01_Blueprint_to_Information_Map.md` | UX接続 | Blueprint StepとObject、情報、責務、System処理の対応 |
| `03_02_Object_Model.md` | 対象構造 | Object、定義、Identity、Relation、Lifecycle、Ownership |
| `03_03_Information_Structure.md` | 情報構造 | Grouping、Hierarchy、Facet、Metadata、List／Detail／History |
| `03_04_Responsibility_Model.md` | 責務 | Surface、Screen、Function、Actor間の責務境界 |
| `03_05_Navigation_and_User_Flow.md` | 動線 | Entry、Navigation、主要User Flow、Cross-surface Flow |
| `03_06_State_and_Glossary.md` | 共通理解 | State Concept、用語、名称、同義語・禁止語 |

## Blueprint Mapping Rule

Service Blueprintの各Stepについて、最低限以下を追跡する。

```text
Blueprint Step
User Goal / Action
必要なObject / Information
情報のSource
更新主体
表示・操作するSurface
必要なBehavior
Failure / Recovery
```

IAはBlueprintをそのまま画面一覧へ変換しない。
まず、体験を成立させる情報と責務を構造化する。

## IA Owns

```text
対象概念と関係
Information Hierarchy
Grouping / Facet / Metadata
責務境界
NavigationとFindability
一覧・詳細・履歴の役割
用語と分類
共通State Concept
```

## IA Does Not Own

```text
最終Visual
Color / Typography / Graphic Asset
個別機能の詳細な例外処理
Backendの実装方式
```

## Facet over Forced Tree

対象を分類する軸が複数ある場合、単一Treeへ強制するより、独立して組み合わせられるFacetを優先する。

```text
種類
状態
担当
期間
重要度
検索語
```

## IA Handoff to UI / SPEC

```text
Blueprintと情報構造のMapping
中心Objectと関係
Information Hierarchy
利用者が認識すべき情報優先度
各SurfaceまたはScreenの責務
主要Action、Navigation、User Flow
検索・Filter・Historyの構造
共通Stateと例外候補
Glossary
```

---

# 8. UI / SPEC Paired Documentation

UIとSPECは、同一FeatureまたはUse Caseに対して対応関係を持たせる。

物理フォルダは`04_Spec`と`05_UI`に分けてよいが、設計・Reviewでは対のContractとして扱う。

## 8.1. SPEC Starter Structure

`04_Spec`は、UX・IA・UIで表現された期待を、実装と検証に渡せるBehavior Contractへ変換する。

| Artifact | Responsibility | Main Content |
|---|---|---|
| `04_00_INDEX.md` | Specの入口 | Scope、読む順番、Feature Map |
| `04_01_Feature_Map.md` | 機能関係 | Feature ID、目的、対象Object、関連UI、Status |
| `04_XX_<Feature>.md` | Behavior Contract | Trigger、Behavior、State、Input、Output、Exception |
| `04_9X_Acceptance_Criteria.md` | 横断検証 | Acceptance、Quality Rule、Evidence Link |

### Feature Spec Template

```text
# <Feature Name>

Version:
Status:
Owner:
Last Updated:
Related:

## Purpose and Source Context

## Preserved Intent

## Scope

## Non-goals

## Trigger / Preconditions

## Behavior

## State and Transition

## Input / Output

## Empty / Loading / Error / Offline / Permission

## Constraints

## Acceptance Criteria

## Test / Evidence

## Open Questions
```

EARS等の構文は、Acceptance CriteriaやBehaviorを曖昧なく表すために利用してよい。
UXやDesign Intentまで同じ構文へ圧縮してはならない。

## 8.2. UI and Graphic / Visual Starter Structure

`05_UI`は、IAの情報構造を、利用者が認識・操作できるUI Structureへ変換し、さらに最終Graphic／Visual、素材、Motionへ展開する。

物理的に同じ`05_UI`配下で管理してよいが、以下の二つの専門責務を混同しない。

```text
UI Design
= Information Hierarchy、Wireframe、Screen Flow、Interaction、Component、Token

Graphic / Visual Design
= Color、Typography、Icon、Illustration、Image、Effect、Motion、Final Visual
```

### 8.2.1. Minimum Required UI Deliverables

承認済みScope内の全Screen、主要State、必要Variantについて最低限以下を持つ。

| Artifact | Responsibility | Minimum Content |
|---|---|---|
| `05_00_INDEX.md` | UIの入口 | Scope、全Screen Coverage、主要Surface、参照Artifact |
| `05_01_UI_Principles.md` | UI判断基準 | 情報優先度、Feedback、人間／AI関係、Accessibility |
| `05_02_Screen_Inventory.md` | 網羅性 | Screen ID、名称、目的、IA責務、Status、Wireframe／Visual Link |
| `05_03_Screen_Flow.md` | 画面遷移 | Entry、遷移、分岐、Modal、Back、Cancel、Error Flow |
| `05_1X_Wireframes.md`またはFigma | 全画面Wireframe | Information Hierarchy、Action、State、主要文言、Responsive／Variant |
| `05_20_UI_Contracts.md` | Interaction | Action、Feedback、Loading、Empty、Error、Permission、Undo／Retry |
| `05_30_Design_Tokens.md` | 最低Token | Color、Typography、Spacing、Size、Radius、Elevation、Motion等 |
| `05_40_Component_and_Patterns.md` | 再利用構造 | Component、Layout Pattern、State、Variant、利用Rule |
| `05_50_Visual_Design.md`またはFigma | 最終Visual | Scope内全Screen／主要StateのGraphic／Visual Coverage |
| `05_60_Assets_and_Motion.md` | 素材 | Icon、Illustration、Image、Animation、Source Master、Export Rule |
| `05_90_UI_Quality_Review.md` | 品質確認 | Nielsen、Universal Design、Accessibility、Coverage、未解消Risk |

### Scope Coverage Rule

「全画面」とは、毎回Product全体を作り直すことではない。

```text
承認済みFeature / Change / Release Scope内の全Logical Screen
主要なNormal / Loading / Empty / Error / Permission State
必要なRole / Platform / Brand / Display / Locale Variant
```

を指す。

Screen Inventoryを正本として、Wireframe、Visual、SPEC、TestのCoverageを追跡する。

### Minimum Design Token Rule

少なくとも以下を定義する。

```text
Semantic Color
Typography
Spacing
Size / Grid
Radius
Elevation / Layer
Opacity
Interaction State
Motion Duration / Easing（Motionを持つ場合）
```

すべてのProductに大規模Design Systemを要求しない。
一方、画面ごとの任意値だけでUIを作らない。

### Component / Pattern Rule

全Screenを個別絵として管理せず、最低限以下を識別する。

```text
Reusable Component
Layout Pattern
Component State
Variant
Screen-specific Exception
```

### 8.2.2. Minimum Required Graphic / Visual Deliverables

Graphic / Visual Designは、Wireframeへ色を付ける作業ではない。
UI Structureを、Brand、視認性、感情、品質、実装可能性を持つ最終表現へ変換する。

最低限以下を持つ。

```text
Scope内全Screen／主要StateのFinal Visual
Color / Typographyの実適用
Icon / Illustration / Image / Texture等のAsset一式
各AssetのSource Masterと利用条件
Component / State / VariantごとのVisual Rule
Motion / Animation SpecificationとSource（該当する場合）
Export / Naming / Version Rule
Visual Coverage Matrix
```

Graphic Assetは配置画像だけでなく、再編集可能なSourceとOutputを区別する。

### 8.2.3. UI Quality Criteria

以下は成果物ではなく、UI成果物をReviewする品質基準である。

#### Nielsen Usability Quality Components

```text
Learnability   = 初回でも理解・開始できるか
Efficiency     = 習熟後に効率よく達成できるか
Memorability   = 間隔が空いても再利用できるか
Errors         = Errorを防ぎ、理解し、回復できるか
Satisfaction   = 利用者が納得・安心して使えるか
```

必要に応じてNielsenの10 Usability Heuristicsも詳細Reviewへ利用する。

#### Universal Design Seven Principles

```text
Equitable Use
Flexibility in Use
Simple and Intuitive Use
Perceptible Information
Tolerance for Error
Low Physical Effort
Size and Space for Approach and Use
```

#### Additional Required Review

```text
Accessibility
Information Priority
Consistency
Feedback
State Coverage
Keyboard / Focus / Screen Reader（対象Platformに応じる）
Color以外の識別手段
Text Expansion / Locale
Responsive / Device / Display差分
```

品質基準の詳細なEvidence管理は`00_32_Testing_Quality.md`を参照する。

### UI Contract Template

```text
# <Surface / Screen / Feature>

Version:
Status:
Owner:
Last Updated:
Related:

## Purpose and Source Context
## Preserved UX Intent
## IA Responsibility
## User Goal
## Information Priority
## Visible Elements
## Primary / Secondary Actions
## Interaction Flow
## State Presentation
- Initial
- Loading
- Empty
- Success
- Error
- Disabled
- Permission
## Feedback and Recovery
## Wording
## Accessibility / Responsiveness
## Paired Behavior Contract
## Wireframe / Figma / Visual Artifact
## Open Questions
```

## 8.3. UI / SPEC Consistency Matrix

重要Featureでは、以下を対応づける。

| Concern | UI Contract | Behavior Contract |
|---|---|---|
| Trigger | 利用者が何を行うか | 処理開始条件 |
| State | 何が見えるか | 内部状態と遷移 |
| Loading | 待機中の表示 | 非同期処理中の状態 |
| Empty | 空状態の説明とAction | Dataがない条件 |
| Error | Message、Recovery | Error条件、再試行、Fallback |
| Permission | 操作可否の表示 | Authorization条件 |
| Success | 完了Feedback | 完了条件とOutput |
| Undo / Cancel | 戻し方 | Rollback / Cancellation Behavior |

UIに存在するActionへ対応SPECがない、またはSPECの状態がUIで表現されない場合、未整合として扱う。

---

# 9. Architecture Starter Structure

`06_Architecture`は、承認されたProduct Contractを、現在の制約・環境で成立させるTechnical Contractへ変換する。

| Artifact | Responsibility | Main Content |
|---|---|---|
| `06_00_INDEX.md` | Architectureの入口 | Scope、読む順番、System Boundary |
| `06_01_System_Context.md` | 外部境界 | User、External System、Trust Boundary |
| `06_XX_<Domain>.md` | 技術設計 | Component、Data、API、IPC、AI、Security等 |
| `06_9X_Implementation_Rules.md` | 実装規約 | 命名、責務境界、Error、Log、Test、禁止事項 |

## Architecture Owns

```text
System Boundary
Data and Interface
Security and Privacy
Quality Attribute
Technical Constraint
Transformation Rule
Implementation Boundary
```

## Architecture Does Not Own

```text
Productの存在理由
利用者価値の優先順位
画面文言の正本
実装都合によるUX変更の無断確定
```

## Implementation Rule Requirement

実装を開始する場合、特にAgentic Delivery Profileを適用する場合は、AIまたは開発者が従う実装規約を用意する。

最低限、以下を扱う。

```text
責務境界
命名規則
外部境界の実装Rule
Data Access / Persistence
Error Handling / Logging
Security
Test Strategy
Refactoring Boundary
Document Update Rule
Completion Review Checklist
```

実装をまだ行わないDiscovery・Concept段階では、詳細な実装規約を必須としない。
実装開始前に必要な粒度まで承認する。

---

# 10. Workflows and Delivery Documentation

## 10.1. Workflows

`07_Workflows`は、Product Contractではなく、人間とAIがどう作業・Review・Releaseするかを扱う。

| Artifact | Responsibility |
|---|---|
| `07_00_INDEX.md` | Workflowの入口 |
| `07_01_Development_Setup.md` | 環境構築、Local実行 |
| `07_02_Review_Process.md` | 文書・Design・Code Review |
| `07_03_Change_Process.md` | Context変更、Impact確認、Approval |
| `07_04_Release_Process.md` | Build、Package、Distribution |
| `07_05_AI_Agent_Process.md` | Context読込、Plan、実装、Review、Evidence |

## 10.2. Develop

`40_Develop`は、実装中のPlan、Task、作業Evidenceを扱う。

```text
実装計画
変更対象とBoundary
Task分解とDependency
実行Log
Test結果
未解決事項
Contextへ戻す学び
```

Task管理Toolを併用してよい。
ただし、重要なPlan、Boundary、判断、学びを外部Task Toolだけに閉じない。

## 10.3. Evidence and Release

`90_Evidence`は、検証に使った根拠と結果を扱う。
`90_Release`は、どのVersionを何の確認に基づいて有効化・配布したかを扱う。

### Release Readiness Categories

```text
Source State
Automated Test
Manual Verification
Distribution Artifact
Security / Governance / License
Known Limitation
Context Consistency
```

### Release Evidence Record

```text
何を検証したか
どのContractを検証したか
検証方法
結果
未解決事項
既知の制限
承認者と承認日
関連するDecision / Evidence
```

---

# 11. Separation Guide

内容が混同される場合は、次で判断する。

| Question | Location |
|---|---|
| なぜ作るか、誰をどう変えるか | `02_UX` |
| 何を対象概念とし、どう整理するか | `03_IA` |
| どの条件で何が起きるか | `04_Spec` |
| 情報構造をどう見せ、どう操作させるか | `05_UI`（UI Design） |
| 最終Visual、素材、Icon、Motionをどう成立させるか | `05_UI`（Graphic / Visual Design） |
| どの技術構造で成立させるか | `06_Architecture` |
| 人間とAIがどう作業するか | `07_Workflows` |
| 今回何を実装し、何を確認したか | `40_Develop` / `90_Evidence` |
| なぜ採用・変更・却下したか | `95_Decisions` |
| 次に何を行うか | `99_Roadmap` |

同じTopicを複数Artifactが扱う場合、内容を重複コピーするのではなく、それぞれのProperty Authorityを保ち、意味のあるLinkで接続する。

---

# 12. Documentation Scale Profiles

## 12.1. Compact

個人Prototype、小規模検証、初期Concept向け。

```text
Discovery / Product Brief
UX・IA統合文書
UI / SPEC統合Contract
Architecture Decision
Implementation Plan
Verification Record
```

## 12.2. Standard

複数Feature、継続開発、複数関係者向け。

```text
01_Discovery
02_UX
03_IA
04_Spec
05_UI
06_Architecture
07_Workflows
40_Develop
90_Evidence / Release
95_Decisions
99_Roadmap
```

## 12.3. Extended

大規模、複数Domain、複数Team、規制・高Risk向け。

```text
Domain別IA / SPEC / Architecture
Artifact Manifest
Stable ID / Trace Registry
Requirement / Design / Release Baseline
Approval Gate
Cross-domain Impact Analysis
Independent Verification
```

規模を選択する目的は、準拠Levelを競うことではない。
対象に必要なContextを、最小の管理Costで失わず維持することである。

---

# 13. Minimum Rules

Product Lifecycle Profileで本Guideを適用する場合、最低限以下を守る。

```text
必要な専門責務を、文書統合によって消さない
Origin / UXからVerificationまでの接続を説明できる
各主要ArtifactがSource ContextとDownstream Obligationを持つ
UXはPersona、Journey Map、Service Blueprint、Outcome、Experience Principleを定義する
IAはService Blueprintを情報構造、Object、Responsibility、Navigationへ変換する
UIはScope内全ScreenのInventory、Wireframe、Screen Flow、最低限のDesign Token、Component / Patternを持つ
Graphic / Visual DesignはScope内全Screen／主要StateのFinal Visualと必要Assetを網羅する
UI品質はNielsenの5 Usability Quality Components、Universal Designの7原則、Accessibility等でReviewする
UIとSPECは対のContractとして整合を確認する
Architectureは上流Contractを無断で弱めない
実装開始時には、必要なArchitectureとImplementation Ruleを用意する
完了判断はFresh Evidenceに基づく
学びと変更を上流Contextへ戻す
外部Artifactを使う場合、Authority・Version・参照先をRepositoryに残す
```

以下は必須ではない。

```text
すべてのFolderに必ず同じ数の文書を置くこと
すべての画面を1画面1ファイルにすること
すべての層を固定順で完成させること
Figmaや外部Toolの内容をすべてMarkdownへ複製すること
小さな変更へフルセットの文書を作ること
```

---

# 14. Anti-patterns

## Artifact Completion without Context Continuity

```text
UX、IA、UI、SPECのファイルは存在するが、互いに何を実現しているか分からない。
```

## Template Filling without Decision

```text
AIがテンプレートを埋めたが、なぜその選択になったか、人間が何を承認したか分からない。
```

## UI-only Product Definition

```text
画面は詳細に作られているが、対象Object、Behavior、Error条件が定義されていない。
```

## Spec-only Product Definition

```text
機能条件は詳細だが、利用者がどのように理解し、判断し、回復するかが定義されていない。
```

## Architecture-led Requirement Degradation

```text
実装しやすさを理由にUXやSPECを変更したが、上流への影響と人間の判断が残っていない。
```

## External Artifact without Authority

```text
FigmaやSpreadsheetへのLinkはあるが、どのPropertyが正しく、どのVersionを見ればよいか分からない。
```

---

## UX without Blueprint

```text
PersonaとJourneyはあるが、Frontstage、Backstage、System、AI、Support Processへ接続されず、IA・SPECへ渡せない。
```

## IA as Screen List

```text
Service BlueprintとObjectを構造化せず、画面名だけを増やす。
```

## Wireframe without Coverage

```text
代表画面だけが作られ、Scope内のScreen、主要State、Variantの未作成範囲が分からない。
```

## Graphic without Source or Rule

```text
Final Imageはあるが、Asset Source、Component State、Token、Version、利用条件がない。
```

## Quality Principle as Deliverable

```text
NielsenやUniversal Designの名前を記載しただけで、どの画面・状態をどう確認したかEvidenceがない。
```

# 15. Final Principle

テンプレートは、専門家の思考を省略するためのものではない。

テンプレートは、専門家が暗黙的に行ってきた質問、判断、境界、検証を、人間とAIが再利用できる構造へ変えるためのものである。

```text
CRDDは、文書を一式作る方法ではない。
CRDDは、人間の思いを、専門領域を越えて、実装と検証まで失わず運ぶ方法である。
```
