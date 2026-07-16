# CRDD Context Transformation

Version: v0.3.1
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-16
Related:
- [00_02_CRDD_Core_Concepts_and_Terminology.md](00_02_CRDD_Core_Concepts_and_Terminology.md)
- [00_03_CRDD_Conformance.md](00_03_CRDD_Conformance.md)
- [00_04_CRDD_End_to_End_Context_Continuity.md](00_04_CRDD_End_to_End_Context_Continuity.md)
- [00_10_Context_Repository.md](00_10_Context_Repository.md)
- [00_11_Information_Provenance.md](00_11_Information_Provenance.md)
- [00_12_Decision_Rationale.md](00_12_Decision_Rationale.md)
- [00_13_Human_AI_Responsibility.md](00_13_Human_AI_Responsibility.md)
- [00_30_Product_Documentation.md](00_30_Product_Documentation.md)

---

本書で使用するCore Concept、Canonical Term、責務・Authorityの定義は、[`00_02_CRDD_Core_Concepts_and_Terminology.md`](00_02_CRDD_Core_Concepts_and_Terminology.md)を正本とし、本書では再定義しない。

# Purpose

本ドキュメントは、プロダクトの原点、課題、UX、IA、UI、SPEC、Architecture、Implementation、Verificationを、意味を失わず接続するための規範を定義する。

本書は工程間に共通する変換原則を定義する。各工程のEntry、責務Coverage、Exit、Gate、Auditは工程文書の`Phase Process Contract`を正本とする。本書内の受け渡し項目は意味接続の説明であり、受信工程の`Phase Entry Contract`を置き換えない。

境界では受信工程がEntry Contractを所有する。送信工程は同じ項目を別定義せず、受信工程のEntry Contractを満たしたことをCoverage Summaryとともに示す。

CRDDでは、上流から下流へ進むことを、単なる文書作成や情報の転記として扱わない。

各専門層は、上流Contextを受け取り、その意図を守りながら、次の専門領域で扱える形へ具体化する **Transformation Layer** である。

```text
思いを文章へ変えるだけではない。
文章を仕様へ変えるだけではない。
仕様をコードへ変えるだけではない。

各変換で、何を守り、何を判断し、何を次へ渡したかを残す。
```

本標準は、`00_03_CRDD_Conformance.md`のProduct Lifecycle Profileを具体化するCore標準である。

---

# 1. Basic Principle

CRDDにおける層間変換は、以下の原則に従う。

```text
上流の言葉を、そのまま下流へコピーしない。
上流の意図を、下流で検証可能な形へ具体化する。
下流の都合で、上流の意図を無言で変えない。
分からないことを、確定事項へ変換しない。
変換で生じた判断と未決事項を残す。
結果と学びを、再び上流Contextへ戻す。
```

CRDDが求めるのは、すべての工程を一方向へ順番に進めることではない。

CRDDが求めるのは、反復や手戻りが発生しても、前後の層の意味と判断が切断されないことである。

---

# 2. Canonical Context Flow

Product Lifecycle Profileでは、以下を標準的なContext Flowとして扱う。

```text
01_Discovery
課題、思い、Evidence、要求候補、仮説を集める
        ↓
02_UX
なぜ作るのか、誰をどの状態へ変えるのかを定義する
        ↓
03_IA
対象概念、情報、行動、責務、Navigationを構造化する
        ↓
05_UI ⇄ 04_Spec
利用者に見える契約と、システムの振る舞いの契約を対で定義する
        ↓
06_Architecture
現在の環境と制約で成立させる技術構造を選択する
        ↓
40_Develop
Code、Configuration、Test、Buildとして具体化する
        ↓
最寄りの親FolderにあるEvidence / 90_Release
SourceとRevisionを伴うEvidenceにより成立性と結果を検証する
        ↓
01_Discovery / 02_UX / 03_IA / 04_Spec / 05_UI / 06_Architecture / 99_Roadmap
学び、変更、次の判断を適切なContextへ戻す
```

このFlowは、物理的なフォルダ順や固定された工程順を強制するものではない。

小規模な対象では複数層を一つのArtifactへ統合してよい。
反復的な設計ではUIからIAへ戻ってよい。
技術検証を先行し、その結果からSPECやUXを再検討してよい。

ただし、層を統合、省略、往復する場合も、本来その層で判断すべき内容を失ってはならない。

---

# 3. Transformation Contract

重要な層間変換では、以下の内容を説明できなければならない。

| Item | Meaning |
|---|---|
| `Source Context` | 何を根拠として変換を開始したか |
| `Preserved Intent` | 次工程でも失ってはいけない意図、価値、原則 |
| `Transformation Decision` | この層で新しく具体化、選択、分解した内容 |
| `Assumptions` | 成立のために置いた前提 |
| `Open Questions` | 未確定、未確認、判断待ちの事項 |
| `Downstream Obligation` | 次の層が満たすべき条件、制約、確認事項 |
| `Verification` | 変換結果が妥当であることを、何によって確認するか |
| `Related Decision / Evidence` | 判断記録、根拠、外部Artifactとの接続 |

専用の表や固定フォーマットを使うことは必須ではない。

ただし、完成した成果物だけを見ても、なぜその形になったのか、何を守る必要があるのか、何がまだ未確定なのかを説明できない状態は認めない。

## Minimum Transformation Record

軽微でない変更では、最低限以下を残す。

```text
Source Context
Preserved Intent
Transformation Decision
Open Questions
Downstream Obligation
Verification
```

---

# 4. Transformation Rules

## T-01. Preserve Meaning, Not Wording

下流層は、上流文書の文言をそのまま複製することを目的としてはならない。

上流の意味を、その層で判断、実装、検証できる形へ変換しなければならない。

例:

```text
UX:
利用者が重要な相談を見逃さず、判断へ集中できる

IA:
相談、Risk、Evidence、Decision待ちをTopicとして統合する

UI:
Topicごとに重要度、根拠、次Actionを同一視野へ表示する

SPEC:
重要度条件、並び順、既読条件、通知条件を定義する
```

同じ文言を繰り返すだけでは、Transformationとはみなさない。

## T-02. Preserve Upstream Intent

下流層は、上流で確定したIntent、Principle、Non-goal、重要なDecisionを守らなければならない。

下流の技術、工数、都合によって上流意図を満たせない場合、下流側だけで仕様を弱めてはならない。

以下を明示し、人間の判断へ戻す。

```text
満たせない上流Intent
原因となる制約
代替案
UX / Scope / Schedule / Architectureへの影響
推奨判断
```

## T-03. Do Not Promote Uncertainty Silently

仮説、推定、未確認事項を、層を下る過程で確定Requirementsや確定仕様へ無言で昇格してはならない。

不確実性は、次の層へ引き継ぐか、検証によって解消する。

```text
Hypothesis → Hypothesisのまま引き継ぐ
Assumption → Assumptionとして明示する
Open Question → Ownerまたは確認方法を持たせる
Verified Result → Evidenceとともに確定情報へ昇格する
```

情報種別と由来は`00_11_Information_Provenance.md`に従う。

## T-04. Add Decisions Explicitly

上流Contextだけでは一意に決まらず、その層で新しい選択を行った場合は、Transformation Decisionとして明示する。

重大な価値、Scope、責務、契約、技術境界を変える判断は、結果となるCanonical Artifactへ反映し、同じ成果物へ理由、Evidence、代替案、経緯を記録する。

下流成果物の中へ判断を埋め込み、理由を失わせてはならない。

## T-05. Keep Layer Responsibility

各層は、自らの責務を越えて別の層の正本を無言で確定してはならない。

```text
UXは、特定の画面LayoutやAPI方式を正本化しない
IAは、Visual表現やDB構造を正本化しない
UIは、Backend実装方式を正本化しない
SPECは、具体的な技術選択を正本化しない
Architectureは、Product ValueやUX Intentを独自に変更しない
Implementationは、動いているCodeを理由に上流契約を上書きしない
```

別層の変更が必要になった場合は、変更候補として該当Ownerへ戻す。

## T-06. Propagate Change in Both Directions

上流変更は、影響する下流成果物を確認しなければならない。

下流で発見した制約、矛盾、失敗、学びは、影響する上流Contextへ戻さなければならない。

```text
Upstream Change
↓
影響するUX / IA / UI / SPEC / Architecture / Implementation / Testを特定する
↓
変更する、影響なしと判断する、次Releaseへ送る
↓
判断理由を残す
```

```text
Downstream Discovery
↓
単なる実装不具合か、契約不備か、上流仮説の誤りかを分類する
↓
適切な層へFeedbackする
↓
必要に応じてDecisionまたはRoadmapを更新する
```

## T-07. Verify against the Source Intent

各層のReviewは、その成果物単体の品質だけで終えてはならない。

変換元のContextを満たしているかを確認する。

```text
IA Review   = Object Modelが整っているか + UX Outcomeを支えられるか
UI Review   = 見た目が整っているか + IA責務とUX Principleを表現できるか
SPEC Review = 条件が網羅されているか + UI ContractとUX Outcomeを満たすか
Architecture Review = 技術的に成立するか + 上流契約を損なっていないか
Implementation Review = Codeが動くか + 承認済みContractを実現しているか
```

## T-08. Keep Implementation Replaceable

ArchitectureとImplementationは、当時の制約に対する選択として記録する。

特定のFramework、Cloud、AI Provider、Data Store、Code構造を、OriginやProduct Principleと同等の不変条件として扱ってはならない。

実装固有の制約を上流へ恒久的に反映する場合は、その理由と適用期間をDecisionとして残す。

## T-09. Allow Iteration without Losing History

CRDDは、UX、IA、UI、SPEC、Architectureを一度で完成させることを要求しない。

Prototype、Technical Spike、User Review、Implementationから得た学びによって、前の層へ戻ってよい。

ただし、確定内容を無言で上書きしてはならない。

```text
何が分かったか
何が変わったか
なぜ戻る必要があるか
旧判断を維持、修正、置換するか
どの下流成果物を再確認するか
```

を残す。

---

# 5. Layer Transformation Contract

## 5.1 Discovery → UX

正本の境界は[Discovery Exit and Handoff](00_17_Discovery.md#exit-and-handoff)と[UX Phase Entry Contract](00_42_UX_Skill.md#phase-entry-contract)である。

### Discoveryが受け持つもの

```text
原始的な思い
困りごと
観察
顧客や利用者の発言
既存資料
要求候補
仮説
制約候補
未整理のアイディア
```

### UXへ渡すもの

```text
Origin / Intent
対象者
Problem / Pain
利用前後で期待する変化
Desired Outcome
Product / Experience Principle
Non-goal
主要Risk
EvidenceとConfidence
未決事項
```

### 守るべき規則

```text
顧客の発言を、そのまま確定Requirementにしない
解決策より先にProblemと期待する変化を確認する
Evidence、解釈、仮説を区別する
実装Featureへ早期に固定しない
```

---

## 5.2 UX → IA

正本の境界は[UX Exit and Handoff](00_42_UX_Skill.md#exit-and-handoff)と[IA Phase Entry Contract](00_43_IA_Skill.md#phase-entry-contract)である。

### IAが受け取るもの

```text
Target User
利用状況
Problem / Pain
Desired Outcome
Experience Principle
主要Task / JTBD
Non-goal
成功条件
```

### IAで変換するもの

```text
中心となるObject / Entity
概念間の関係
情報の分類と階層
利用者のTask Model
画面またはSurfaceの責務
Navigation
検索、Filter、履歴、状態の構造
```

### 次工程へ渡すもの

```text
Object Model
Information Model
Screen / Surface Responsibility
Navigation Model
主要User Flow
情報優先度
共通Patternと例外候補
```

### 守るべき規則

```text
画面ありきでObject Modelを歪めない
見た目の都合で情報責務を分断しない
IA上の構造が、UX上の行動とOutcomeを支えられることを確認する
```

---

## 5.3 IA → UI / SPEC

正本の境界は[IA Exit and Handoff](00_43_IA_Skill.md#exit-and-handoff)、[UI Phase Entry Contract](00_44_UI_Skill.md#phase-entry-contract)、[Behavior Specification Phase Entry Contract](00_45_Behavior_Specification_Skill.md#phase-entry-contract)である。

IAからUIとSPECへは、同じContextを異なる観点で渡す。

### UIへ渡すもの

```text
各画面またはSurfaceの目的
主要Objectと情報優先度
主要Action
Navigationと遷移関係
利用者が判断するために必要なContext
共通Patternと例外
```

### SPECへ渡すもの

```text
Object / Entityの関係
許可されるAction
State候補
入力と出力の意味
責務境界
主要Flow
権限と制約候補
```

### 守るべき規則

```text
UIとSPECを別々の解釈で作らない
同じObject、Action、Stateに異なる用語を付けない
IAで定義した責務を、複数画面や複数Featureへ無計画に重複させない
```

---

## 5.4 UI ⇄ SPEC

各側の完了条件は[UI Phase Gate Criteria](00_44_UI_Skill.md#phase-gate-criteria)と[Behavior Specification Phase Gate Criteria](00_45_Behavior_Specification_Skill.md#phase-gate-criteria)を正本とし、本節は相互変換の原則だけを扱う。

UIとSPECは、対になるContractとして反復的に整合させる。

### UI Contract

```text
利用者に何が見えるか
何を操作できるか
何が重要として認識されるか
操作前後にどのFeedbackを受けるか
Loading / Empty / Error / Disabled / Permissionをどう表現するか
文言と説明責任をどう担うか
```

### Behavior Specification

```text
どの条件で処理が開始されるか
入力と出力は何か
どのStateからどのStateへ遷移するか
成功、失敗、取消、再試行時に何が起きるか
権限、上限、例外、外部依存をどう扱うか
Acceptance Criteriaは何か
```

### Paired Contract Rule

以下を一対一または説明可能な関係で接続する。

| UI | SPEC |
|---|---|
| Action | Command / Behavior |
| Visible State | System State |
| Feedback | Result / Error |
| Disabled / Hidden | Permission / Precondition |
| Loading | Processing State |
| Empty | No-data Condition |
| Confirmation | Irreversible or Risky Action |
| Undo / Cancel | Compensation / Cancellation Behavior |

UIに現れる主要状態がSPECに存在しない、またはSPECに存在する重要状態がUIから認識できない状態で、実装契約を確定してはならない。

---

## 5.5 UI / SPEC → Architecture

正本の受信条件は[Architecture Phase Entry Contract](00_35_Architecture_Integration.md#phase-entry-contract)である。

### Architectureが受け取るもの

```text
UI Contract
Behavior Specification
State
Input / Output
Acceptance Criteria
Dataと外部Systemの意味
権限、Security、Privacy要件
性能、可用性、Offline等の非機能要求
```

### Architectureで変換するもの

```text
System Boundary
Component / Service Responsibility
Data Model
API / IPC / Event Contract
AI / External Provider Boundary
Security / Permission Model
Failure Handling
非機能設計
Implementation Constraint
Test Strategy
```

### 守るべき規則

```text
技術方式を選ぶ前に、守るべき上流Contractを確認する
実装しやすさを理由に、UI / SPECの意味を無言で変更しない
技術的に成立しない場合は、代替案とImpactを上流へ返す
特定技術を採用した理由と、変更可能性を残す
```

---

## 5.6 Architecture → Implementation

正本の送信条件は[Architecture Exit and Handoff](00_35_Architecture_Integration.md#exit-and-handoff)である。

### Implementationが受け取るもの

```text
承認済みScope
UI Contract / Behavior Specification
Architecture Boundary
Data / API / Security Contract
実装規約
既知の制約
Acceptance Criteria
必要なVerification
```

### Implementationが生成するもの

```text
Code
Configuration
Migration
Build Artifact
Automated Test
Manual Verification Procedure
Implementation Note
Known Limitation
```

### 守るべき規則

```text
承認されたBoundaryを越えて変更しない
実装上発見した仕様変更を、Codeだけで確定しない
既存実装と文書が不一致の場合、正誤を判断せずConflictを提示する
完了宣言には変更後のEvidenceを伴わせる
```

---

## 5.7 Implementation → Verification / Learning

### Verificationで確認するもの

```text
Buildと基本動作
Acceptance Criteria
UI ContractとBehavior Specificationの一致
Architecture BoundaryとSecurity Constraint
UX上の期待する変化を阻害していないか
Origin / Product Principleに反していないか
```

### Contextへ戻すもの

```text
Verification Evidence
未達条件
不具合と原因分類
新しく判明した制約
利用者から得た学び
仮説の支持または反証
変更すべきDecision / UX / IA / UI / SPEC / Architecture
次ReleaseまたはRoadmapへの候補
```

検証結果をTest Logへ残すだけで終えてはならない。
将来の判断へ影響する学びは、該当するContextへ還元する。

---

# 6. Cross-cutting Context

以下は、直列のTransformation Layerではなく、すべての層を横断するContextである。

| Context | Responsibility |
|---|---|
| Evidence | Source、Revision、取得条件とともに変換と判断を支える、最寄りの親Folderまたは成果物内の根拠 |
| Decision / Rationale | Canonical Artifactへ反映した判断と、その採用・却下・変更理由 |
| `99_Roadmap` | 未実装、将来候補、時期と優先順位 |
| `07_Workflows` | 変換、Review、承認、検証をどう進めるか |

これらを、特定層の成果物へ埋め込んで失わせてはならない。

特に、将来構想を現在仕様として扱うこと、過去Decisionを現在の正本へ無言で混在させること、Evidenceを結論と同一視することを避ける。

---

# 7. Traceability Rule

重要な成果物は、必要に応じて以下の関係を説明できなければならない。

```text
derived_from   何を根拠に派生したか
realizes       どの上流Intentを実現するか
constrains     何の選択を制約するか
depends_on     何に依存するか
paired_with    どの対になるContractと整合するか
implemented_by 何によって実装されたか
verified_by    何によって成立確認されたか
supersedes     何を置き換えたか
```

関係名の記法、ID体系、Graph生成方法は、本標準では固定しない。

Template、Skill、Toolは、この意味関係を人間へ過度な入力負荷を与えず維持できるようにする。

---

# 8. Change Impact Rule

重要なContextを変更する場合、以下を確認する。

```text
変更元のLayer
変更理由
変更されたIntent / Contract / Constraint
影響する下流Layer
再Reviewが必要なArtifact
再Verificationが必要な範囲
既存Decisionを維持するか、置き換えるか
今回Releaseへ反映するか、将来へ送るか
```

すべての関連Artifactを機械的に更新することは求めない。

ただし、影響なしと判断した場合も、その理由を説明できなければならない。

---

# 9. Human and AI Responsibility

## Human

人間は、以下を担う。

```text
OriginとIntentを与える
価値、優先順位、Scopeを判断する
重要なTransformation Decisionを承認する
専門家Reviewが必要なRiskを判断する
上流Intentを変更するか、下流制約を受け入れるか決める
```

## AI

AIは、以下を支援できる。

```text
Source Contextを検索する
不足Contextを質問する
上流Contextを次の専門構造へ変換する
矛盾、欠落、未接続を検出する
複数案とTrade-offを提示する
下流変更のImpactを推定する
Traceabilityを維持する
Verification結果から更新候補を提案する
```

AIは、変換の草案を作成してよい。

ただし、AIは人間の思いを推測だけで確定してはならず、重要な価値判断をTransformationの中へ隠してはならない。

---

# 10. Conformance

Product Lifecycle Profileへ準拠する対象は、少なくとも以下を満たさなければならない。

```text
OriginからImplementationまで、対象に必要な層の意味的接続を説明できる
各主要な変換で、Source ContextとPreserved Intentを説明できる
新しい判断、前提、未決事項が変換の中で失われていない
UIとSPECの主要Contractが整合している
下流都合による上流Intentの変更が、無言で行われていない
Verification結果と学びが、必要なContextへFeedbackされている
```

すべての層を独立したMarkdownとして作成することは、準拠条件ではない。

準拠の対象は文書数ではなく、Contextの連続性と変換の説明可能性である。

---

# 11. Minimum Rule

最低限、以下を守る。

```text
各主要層は、何をInputとして受け取り、何を次へ渡したか説明できる
上流Intentを下流都合で無言変更しない
仮説や未確認事項を、変換過程で確定事項へ変えない
UIとSPECの主要状態・操作・Feedbackを対で確認する
下流で判明した重要な学びを、適切な上流Contextへ戻す
実装完了を、End-to-End Contextの完了と同一視しない
```

---

# 12. Final Principle

CRDDにおける一気通貫とは、すべてを一人で作ることでも、すべての工程を固定順で進めることでもない。

```text
上流の思いが、専門分野を越えても失われない。
下流の成果物から、なぜそうなったかを遡れる。
環境が変われば実装を変えられる。
それでも、製品を生んだ意志と判断は受け継がれる。
```

CRDDは、その連続性を偶然や個人の記憶へ任せない。

CRDDは、思いをUX、IA、UI、SPEC、Architecture、Implementation、Verificationへ変換し、再び学びとしてContextへ戻すための方法論である。
