# CRDD Context Traceability

Version: v0.1.0
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-16
Related:
- [00_03_CRDD_Conformance.md](00_03_CRDD_Conformance.md)
- [00_10_Context_Repository.md](00_10_Context_Repository.md)
- [00_11_Information_Provenance.md](00_11_Information_Provenance.md)
- [00_12_Decision_Record.md](00_12_Decision_Record.md)
- [00_15_Document.md](00_15_Document.md)
- [00_16_Context_Transformation.md](00_16_Context_Transformation.md)
- [00_18_UI_Behavior_Contract.md](00_18_UI_Behavior_Contract.md)
- [00_30_Product_Documentation.md](00_30_Product_Documentation.md)

---

# Purpose

本ドキュメントは、CRDDにおけるContextの識別、関連づけ、変更追跡、影響分析の標準を定義する。

CRDDでは、UX、IA、UI、SPEC、Architecture、Implementationを、同じ文書や同じIDへ押し込めない。

各専門層は異なる責務を持ち、同じFeatureまたはUse Caseへ関与しながら、それぞれ独立して変更、承認、置換される。

そのため、追跡対象となるContextには安定したIDを付与し、以下を多対多のRelationとして接続する。

```text
Origin / Problem
        ↓
UX Outcome
        ↓
Feature / Use Case
        ↓
IA Structure
        ↓
UI Contract ⇄ Behavior Requirement
        ↓
Architecture / Implementation
        ↓
Test / Evidence
```

この図は固定された親子階層を意味しない。

CRDDが必要とするのは、各Contextの意味と責務を分離しながら、前後の意図を双方向に追跡できることである。

---

# 1. Basic Principle

Context IdentificationとTraceabilityは、以下の原則に従う。

```text
IDは場所ではなく意味を識別する。
異なる専門責務には異なるIDを付ける。
Feature / Use Caseを共通の接続単位として利用できる。
ただし、すべてをFeatureの子要素へ固定しない。
関係は1対1ではなく多対多として扱う。
名称変更やファイル移動でIDを変更しない。
一度使用したIDを再利用しない。
人間には名称を主に見せ、ID管理はAIとToolが支援する。
```

IDを付ける目的は、管理項目を増やすことではない。

以下を可能にするために付与する。

```text
このUIは、どのUXとIAを実現しているか
このRequirementは、どのUse CaseのBehaviorか
この実装変更は、どのContractを実現したか
このテストは、何を検証しているか
上流変更により、どこまで再確認が必要か
現在のArtifactが置き換わっても、同じ意図を追えるか
```

---

# 2. Identification Target

CRDDでは、次の4種類を区別する。

| Category | Meaning | Example |
|---|---|---|
| `Context Entity` | 意味、責務、契約、判断として追跡する単位 | UX Outcome、IA Structure、UI Contract、Requirement |
| `Connecting Entity` | 複数の専門層を接続する共通対象 | Feature、Use Case、User Action |
| `Artifact` | Contextを表現、保存、参照する媒体 | Markdown、Figma Frame、Diagram、Schema、Source Code |
| `Delivery Entity` | 変更、実装、検証、Releaseを進める単位 | Change Package、Task、Test、Release |

## 2.1. Context Entity and Artifact Are Different

Context EntityとArtifactを同一視してはならない。

```text
UX-000004
= 「利用者が重要事項を見逃さず、判断へ集中できる」というUX Outcome

02_UX/01_Experience_Principles.md
= UX-000004を記述しているArtifact
```

1つのArtifactに複数のContext Entityを含めてよい。

```text
02_UX/01_Experience_Principles.md
├─ UX-000001
├─ UX-000002
└─ UX-000004
```

同じContext Entityを複数Artifactで表現する場合は、どのArtifactまたはPropertyが正本かを明示する。

## 2.2. Figma Frame Is Not Automatically a UI Contract

Figma Frame、Component、Prototype Nodeへ自動的にUI IDを付ける必要はない。

追跡する価値のある認識、操作、Feedback、状態表現をUI Contractとして登録し、その参照先としてFigma Nodeを接続する。

```text
UI-000021
Title: Topicの重要度・根拠・次Actionを同一視野へ表示する
Artifact: Figma / Topic Detail / node-id=123:456
```

画面数とUI Contract数は一致しなくてよい。

---

# 3. Standard ID Format

安定IDは、原則として次の形式を使用する。

```text
<PREFIX>-<SEQUENCE>
```

例:

```text
UX-000004
IA-000008
UI-000021
REQ-000044
```

## 3.1. ID Rule

```text
PrefixはContext Typeを示す。
SequenceはRepository内で一意な連番とする。
IDへ名称、機能分類、画面名、日付、Release名を埋め込まない。
名称や所属が変わってもIDを維持する。
廃止したIDを別の意味へ再利用しない。
```

## Bad

```text
UI-INBOX-TOPIC-CARD
UX-MANAGER-IMPORTANT-INFORMATION
REQ-2026-V2-LOGIN-001
```

名称、組織、Release、機能分類が変わるとIDまで変更されるため、安定IDには適さない。

## Good

```text
UI-000021
UX-000004
REQ-000044
```

人間向け名称はIDとは別Propertyとして管理する。

---

# 4. Standard Prefix

以下を標準Prefixとする。

| Prefix | Context Type | Meaning |
|---|---|---|
| `ORI` | Origin | 作り始めた理由、原始的な思い、守る価値 |
| `PRB` | Problem | 解決対象となる問題、Pain、損失 |
| `UX` | UX Context | UX Outcome、Experience Principle、JTBD等 |
| `FTR` | Feature | Productが提供する能力、まとまり |
| `UC` | Use Case | Actorが目的を達成する利用シナリオ |
| `ACT` | User Action | Use Case内で独立追跡する価値がある利用者の行動 |
| `IA` | IA Context | Object Model、情報構造、責務、Navigation等 |
| `UI` | UI Contract | 認識、操作、Feedback、UI Stateの契約 |
| `REQ` | Behavior Requirement | Condition、State、System Behavior、Exception、Acceptance Requirement |
| `ARC` | Architecture Context | 技術境界、Data、API、Security、Integration等 |
| `DEC` | Decision | 重要な判断と理由 |
| `CHG` | Change | 変更要求、Change Package、影響評価単位 |
| `TST` | Test | Test Case、Validation Scenario |
| `EVD` | Evidence | 検証結果、観察結果、根拠 |
| `ART` | Artifact | 外部ArtifactまたはVersion固定が必要な成果物 |

Prefixを増やしすぎてはならない。

UX OutcomeとExperience Principleなど、同じ専門責務内の種類は、原則としてPrefixを増やさず`Subtype`で区別する。

```yaml
id: UX-000004
type: UX
subtype: ExperienceOutcome
```

## 4.1. Requirement and Spec

`REQ`は、Behavior ContractまたはSPEC内で独立して追跡、検証する価値がある原子的なRequirementへ付与する。

EARS等の構文は、`REQ`の本文を曖昧なく記述するために利用できる。

```text
REQ-000044
利用者が未読の重要Topicを開いたとき、
Systemは当該Topicを既読として記録しなければならない。
```

SPEC文書そのものへ必ず1つの`REQ` IDを付けるのではない。

1つのSPEC文書に複数の`REQ`を含めてよい。

---

# 5. When to Assign an ID

すべての文章、発言、画面、ComponentへIDを付けてはならない。

次のいずれかに該当する場合、安定IDを付与する。

```text
別のContextから参照される
複数Artifactにまたがって表現される
独立して変更、承認、廃止される
影響分析の起点または対象になる
ReleaseまたはTestで成立確認する
重要なDecisionの対象になる
複数の専門層へ変換される
後から同じ意味を再発見する必要がある
```

通常、以下には安定IDを必須としない。

```text
生の会話ログ
一時的なメモ
文書内の全Paragraph
全Figma Layer
全Source File
単独で追跡する価値のない軽微な文言
実装途中の一時変数や内部処理
```

## 5.1. Registration Timing

Contextが最初に作られた時点で、必ずIDを付ける必要はない。

以下の時点で登録する。

```text
別の層へHandoffする
人間がReview対象として扱う
別Contextから参照する
ChangeまたはRelease Scopeへ含める
将来も維持すべき意味単位になった
```

登録時点で確定していなくてもよい。

```yaml
id: UX-000004
status: Draft
confidence: Medium
```

不確実なContextへIDを付けることは、確定扱いを意味しない。

---

# 6. Independent IDs by Layer

UX、IA、UI、REQは、それぞれ独立したIDを持つ。

```text
FTR-000012 重要なTopicを確認する

UX-000004 判断負荷を下げる
IA-000008 TopicとEvidenceを判断単位として構造化する
UI-000021 根拠と次Actionを同一視野へ表示する
REQ-000044 重要Topicの表示条件を定義する
```

同じFeatureへ関係していても、同じIDや派生番号を共有しない。

## Bad

```text
FTR-012-UX
FTR-012-IA
FTR-012-UI
FTR-012-REQ
```

この形式では、Contextが別Featureでも再利用される場合や、Featureが分割・統合された場合にIDが不安定になる。

## Good

```text
FTR-000012
UX-000004
IA-000008
UI-000021
REQ-000044
```

関係はIDの構造ではなく、Relationとして管理する。

---

# 7. Feature and Use Case as a Connecting Entity

Feature、Use Case、User Actionは、UX、IA、UI、REQを接続する共通の背骨として使用できる。独立追跡するUser Actionには`ACT`を使用する。

ただし、FeatureまたはUse Caseを全Contextの唯一の親Entityとしてはならない。

## 7.1. Many-to-Many Relationship

実際のProduct Contextは多対多である。

```text
1つのUX Outcomeを複数Featureが実現する
1つのIA Structureを複数Featureが共有する
1つのUI Contractが複数Use Caseで利用される
1つのRequirementを複数UIから呼び出す
UIを持たないRequirementが存在する
Featureを越えて適用されるExperience Principleが存在する
```

したがって、次の両方を許容する。

```text
Layer Continuity
UX → IA → UI / REQ → ARC
```

```text
Shared Backbone
UX / IA / UI / REQ → Feature / Use Case
```

どちらか一方へ統一する必要はない。

---

# 8. Standard Relation Types

Context間のRelationは、意味を明示して記録する。

単なる`Related`だけでは、関係の方向と意味が不明なため、Traceabilityとしては不十分である。

## 8.1. Core Relation

| Relation | Direction Example | Meaning |
|---|---|---|
| `derived_from` | IA → UX | 上流Contextを変換、具体化して生まれた |
| `addresses` | FTR → PRB | Problemの解決へ寄与する |
| `realizes` | UI → UX | 上流の価値、Outcome、Contractを実現する |
| `structures` | IA → FTR / UC | FeatureまたはUse Caseの情報・責務を構造化する |
| `presents` | UI → FTR / UC | Feature、Use Case、Actionを利用者へ提示する |
| `defines_behavior_for` | REQ → FTR / UC | 対象のSystem Behaviorを定義する |
| `pairs_with` | UI → REQ | UI ContractとBehavior Contractが対になっている。逆方向は検索時に導出する |
| `constrains` | UX / REQ / ARC → Downstream | 下流の選択へ守るべき制約を与える |
| `depends_on` | Context → Context | 成立または確定に別Contextを必要とする |
| `implemented_by` | REQ / ARC → CHG / Code Artifact | Contractが実装によって具体化される |
| `verified_by` | UX / UI / REQ / ARC → TST / EVD | TestまたはEvidenceによって成立確認される |
| `evidenced_by` | Context → EVD | 事実、観察、資料、検証結果により裏づけられる |
| `decided_by` | Context → DEC | 重要判断によって採用、変更、廃止された |
| `supersedes` | New → Old | 新しいContextが古いContextを置き換える |
| `impacts` | CHG → Context | Changeによる確認、変更、再検証対象である |

Relation名は、むやみに増やしてはならない。

既存Relationで意味を表現できない場合のみ、理由と定義を明示して追加する。

## 8.2. Relation Direction

Relationは、どちらからどちらへ向かうかを固定する。

```text
UI-000021 realizes UX-000004
REQ-000044 defines_behavior_for UC-000012
UI-000021 pairs_with REQ-000044
REQ-000044 implemented_by CHG-000031
REQ-000044 verified_by TST-000052
```

逆方向の検索はToolまたはAIが導出する。

同じ関係を両方向へ二重登録しない。

---

# 9. Minimum Context Record

安定IDを持つContext Entityは、最低限以下を持つ。

| Property | Required | Meaning |
|---|---|---|
| `id` | Yes | 安定ID |
| `type` | Yes | UX、IA、UI、REQ等 |
| `title` | Yes | 人間向け名称 |
| `status` | Yes | Draft、Reviewed、Approved、Superseded、Retired |
| `owner` | Recommended | 判断、維持、Review責任 |
| `source` | Recommended | 正本ArtifactとAnchor |
| `provenance` | Recommended | Human、Observed、Recovered、AI Draft等 |
| `confidence` | When uncertain | High、Medium、Low等 |
| `relations` | When connected | 他Contextとの意味的関係 |
| `last_updated` | Recommended | 最終更新日 |

## Example

```yaml
id: UI-000021
type: UI
subtype: UIContract
title: Topicの重要度・根拠・次Actionを同一視野へ表示する
status: Approved
owner: Product Design
source:
  artifact: 05_UI/Topic_Detail.md
  anchor: topic-decision-summary
relations:
  - type: presents
    target: UC-000012
  - type: realizes
    target: IA-000008
  - type: realizes
    target: UX-000004
  - type: pairs_with
    target: REQ-000044
last_updated: 2026-07-16
```

YAML形式は実装例であり、唯一の保存形式ではない。

ただし、機械処理する場合は、同等のPropertyを構造化して取得できなければならない。

---

# 10. Storage and Authority

Context Registryは論理的な管理機能であり、必ず単一ファイルに集約する必要はない。

以下の方式を利用できる。

```text
A. 文書内のSection Metadataを正本とする
B. Machine-readable Registryを正本とする
C. 外部Artifact Registryを正本とし、Markdownから参照する
```

同じPropertyを複数箇所で手動管理してはならない。

1つのContext Entityについて、ID、Status、Title、Relationsの正本を1箇所に定める。

## 10.1. Recommended Machine-readable Location

Toolによる自動検査、影響分析、Graph表示を行う場合は、Repository Root配下の専用Registry領域を推奨する。

```text
registry/
├─ context-registry.yaml
├─ traceability.yaml
└─ schema/
```

専用Registry領域は、人間向け思想文書の置き場所ではない。
Machine-readableなIndex、Relation、Validation Schemaを保持する。

人間向けの一覧やTraceability Mapは、Registryから生成してよい。
生成Viewを正本にしてはならない。
## 10.2. External Artifact

Figma、Google Docs、Diagram Tool、Ticket System等を参照する場合は、次を保持する。

```text
Artifact IDまたは安定した参照先
対象VersionまたはRevision
Node / Section / Anchor
Property Authority
Last Verified
```

URLだけを残し、何が正本か分からない状態を避ける。

---

# 11. Lifecycle Rule

Context Entityは、以下のLifecycleを基本とする。

| Status | Meaning |
|---|---|
| `Draft` | 作成中または復元候補。確定していない |
| `Reviewed` | 人間による確認済み。承認前 |
| `Approved` | 現在有効なContextとして扱う |
| `Superseded` | 新しいContextに置き換えられた |
| `Retired` | 利用を終了した。後継がない場合を含む |

## 11.1. Rename and Move

名称変更、文書移動、Figma Page移動ではIDを変更しない。

```text
Title変更 → 同じID
File移動 → 同じID
Owner変更 → 同じID
Release変更 → 同じID
```

## 11.2. Semantic Replacement

意味、責務、Contractが別物になる場合は、新しいIDを作成する。

```text
UI-000032 supersedes UI-000021
```

古いIDは削除せず、`Superseded`として保持する。

## 11.3. Split

1つのContextを複数へ分割する場合、分割後に新しいIDを付与する。

```text
Old: IA-000008 Status: Superseded
New: IA-000014 derived_from IA-000008
New: IA-000015 derived_from IA-000008
```

## 11.4. Merge

複数Contextを1つへ統合する場合、新しいIDを付与し、旧ContextをSupersededにする。

```text
IA-000020 supersedes IA-000014
IA-000020 supersedes IA-000015
```

---

# 12. Minimum Traceability by Layer

全文書を一列につなぐ必要はない。

ただし、Product Lifecycle Profileでは、管理対象となるContextが孤立しないよう、最低限以下を満たす。

## 12.1. Origin and Problem

```text
ORIは、関連するPRB、UX、DECのいずれかへ接続される。
PRBは、EvidenceまたはProvenanceを持つ。
```

## 12.2. UX

```text
UXは、ORIまたはPRBの少なくとも一方へ接続される。
Productへ反映するUXは、FTR、UC、IA、UIのいずれかへ下流接続される。
```

## 12.3. IA

```text
IAは、UX、FTR、UCのいずれかを構造化または実現する。
UIまたはREQで使用される対象概念・責務への接続を持つ。
```

## 12.4. UI

```text
UI Contractは、UX、IA、FTR、UCのいずれかへ上流接続される。
System Behaviorを伴うUIは、対応するREQへpairs_withで接続される。
静的表現のみでREQが不要な場合は、その理由を明示する。
```

## 12.5. Behavior Requirement

```text
REQは、FTR、UC、ACT、別REQのいずれかへ対象を接続する。
利用者へ見えるBehaviorは、対応するUI ContractまたはUI不要理由を持つ。
Approved REQは、原則としてTSTまたはEVDによるVerification接続を持つ。
```

## 12.6. Architecture and Implementation

```text
ARCは、実現または制約するREQ、Quality、Security、Integration Contextへ接続される。
CHGまたはImplementation Artifactは、実現するREQまたはARCへ接続される。
```

## 12.7. Verification

```text
TSTは、検証対象となるUX、UI、REQ、ARCを明示する。
EVDは、何を確認したEvidenceか、取得条件、結果を明示する。
```

---

# 13. Traceability Validation

ToolまたはAIは、少なくとも以下を検査できることが望ましい。

```text
重複ID
存在しないTargetへのRelation
廃止IDの不正な再利用
Approved Contextの孤立
Superseded ContextをActiveとして参照しているRelation
UI Contractに対応REQまたは例外理由がない
利用者へ見えるREQにUI ContractまたはUI不要理由がない
Approved REQにVerificationがない
Artifact LinkまたはAnchorが到達不能
上流変更後にDownstream Impactが未評価
```

検査結果は、すべて即時エラーにしてはならない。

```text
Error   = ID重複、存在しないTarget、矛盾したActive状態
Warning = Trace不足、Verification不足、古いArtifact参照
Info    = 追加検討に値するRelation
```

Product Phase、Risk、Profileに応じてSeverityを調整する。

---

# 14. Human and AI Responsibility

ID採番、Relation候補作成、影響分析、孤立検出は、AIまたはToolが支援してよい。

人間へ、IDの手入力やGraph管理を過度に要求してはならない。

## AI May

```text
未登録ContextのID候補を発行する
文書とFigmaからContext候補を抽出する
Relation候補を提示する
名称変更時に同一IDを維持する
変更によるImpact候補を列挙する
不足Traceを警告する
人間向けTraceability Viewを生成する
```

## Human Must Decide

```text
異なるContextか、同一Contextの更新か
重要なRelationの意味が正しいか
Supersede、Split、Mergeの判断
ContextがApprovedとして扱えるか
上流Intentが正しく継承されているか
```

AIが推定したRelationは、確定前に`Proposed`または`AI Draft`として扱う。

---

# 15. Human-facing Presentation

通常の画面、文書、Reviewでは、人間向け名称を主表示とする。

```text
判断負荷を下げる
UX-000004
```

IDだけを一覧表示し、人間へ意味の解読を要求してはならない。

推奨表示:

```text
重要なTopicを確認する（UC-000012）

関連Context
- UX: 判断負荷を下げる
- IA: TopicとEvidenceを判断単位にする
- UI: 根拠と次Actionを同一視野へ表示する
- Behavior: 重要Topicを優先対象として返す
```

IDは、検索、同期、変更追跡、Machine処理を安定させる補助情報として扱う。

---

# 16. Legacy and Reverse Engineering

LegacyまたはBrownfield Projectでは、過去のContextへ当時からIDが存在したように装ってはならない。

現在確認できるArtifact、Code、実行結果、関係者証言からContextを復元し、復元時点で新しいIDを付与する。

```yaml
id: REQ-000081
status: Draft
provenance: Recovered
confidence: Medium
source:
  - existing-code
  - runtime-observation
```

不明な上流Relationは、もっともらしい内容で補完しない。

```text
Known Relation   = 確認できた接続
Proposed Relation = AIまたは人間による復元候補
Unknown          = 現時点で接続不明
```

復元後に人間が確認したContextは、通常のReview、Approved Lifecycleへ移行できる。

---

# 17. End-to-End Example

```text
ORI-000001
重要な相談を見逃すことで、判断が後手に回る状況をなくしたい
    │
    ├─ evidenced_by → EVD-000003
    │

PRB-000002
Slack、Jira、会議記録へ判断材料が分散している
    └─ derived_from → ORI-000001
    ↓
UX-000004
利用者が重要事項を見逃さず、判断へ集中できる
    ↓
FTR-000012
重要なTopicを確認する
    ↓
UC-000012
利用者が重要Topicの根拠を確認し、次Actionを判断する
    │

IA-000008
Topic、Evidence、Decision、Actionを同一の判断単位として扱う
    └─ structures → UC-000012

UI-000021
重要度、根拠、次Actionを同一視野へ表示する
    ├─ presents → UC-000012
    └─ pairs_with → REQ-000044

REQ-000044
重要条件を満たすTopicを優先対象として返す
    ├─ defines_behavior_for → UC-000012
    ├─ implemented_by → CHG-000031
    └─ verified_by → TST-000052

CHG-000031
Topic Priority Pipelineを実装する

TST-000052
重要Topicの分類・表示・既読更新を検証する
    └─ evidenced_by → EVD-000064

EVD-000064
Acceptance Test結果とCapture
```

上記の各Contextは、同じFeatureに関係していても別IDを持つ。

これにより、実装やUIが置き換わっても、UX Outcome、IA Structure、Requirementとの関係を維持できる。

---

# 18. Anti-patterns

## A. One ID for All Layers

```text
FTR-001の中にUX、IA、UI、SPECをすべて埋め込む
```

どの専門責務が変更されたのか追跡できない。

## B. ID per File Only

```text
UX文書1つにUX IDを1つ付ける
```

文書内の複数Outcomeを独立して変更、参照できない。

## C. Semantic ID

```text
UI-INBOX-CARD
```

名称変更や責務変更で不安定になる。

## D. Related without Meaning

```text
Related:
- UX.md
- UI.md
- Spec.md
```

何を実現、制約、検証する関係か分からない。

## E. Traceability as Manual Labor

人間へ、すべてのID採番とRelation更新を手作業で要求する。

CRDDではAIとToolが管理負荷を吸収する。

## F. Fake Trace in Legacy Project

現在のCodeから推定したWhyを、過去から確定していたOriginとして登録する。

Recovered Contextと確定Contextを区別しなければならない。

---

# 19. Minimum Acceptance Criteria

本標準を利用するRepositoryは、最低限以下を満たす。

```text
追跡対象となるUX、IA、UI、REQが独立IDを持つ
Feature / Use Caseと各専門Contextの関係を表現できる
Context IDが名称、Path、Release変更で変わらない
Relationに方向と意味がある
UIと利用者へ見えるREQを対応づけられる
REQから実装とVerificationへ遡れる
上流Contextから影響する下流Contextを検索できる
Superseded Contextを削除せず履歴として保持する
AI推定Relationと人間承認Relationを区別できる
```

すべてのArtifact、Paragraph、CodeへIDを付けることは要求しない。

追跡の価値と変更Riskに応じて管理粒度を選択する。

IDとRelationは、文書体系を複雑にするためではない。

```text
人間の思いが、どの専門判断を経て、
どのContractと実装へ変換され、
何によって成立確認されたかを、
後から再構築できるようにする。
```

これをCRDDにおけるTraceabilityの目的とする。
