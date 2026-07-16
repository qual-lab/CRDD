# CRDD Discovery

Version: v0.3.1
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-16
Related:
- [00_02_CRDD_Core_Concepts_and_Terminology.md](00_02_CRDD_Core_Concepts_and_Terminology.md)
- [00_01_CRDD_Principles.md](00_01_CRDD_Principles.md)
- [00_03_CRDD_Conformance.md](00_03_CRDD_Conformance.md)
- [00_04_CRDD_End_to_End_Context_Continuity.md](00_04_CRDD_End_to_End_Context_Continuity.md)
- [00_10_Context_Repository.md](00_10_Context_Repository.md)
- [00_11_Information_Provenance.md](00_11_Information_Provenance.md)
- [00_12_Decision_Rationale.md](00_12_Decision_Rationale.md)
- [00_13_Human_AI_Responsibility.md](00_13_Human_AI_Responsibility.md)
- [00_16_Context_Transformation.md](00_16_Context_Transformation.md)
- [00_23_Phase_Gate_Approval.md](00_23_Phase_Gate_Approval.md)
- [00_30_Product_Documentation.md](00_30_Product_Documentation.md)
- [00_51_Document_Audit_Agent.md](00_51_Document_Audit_Agent.md)

---

本書で使用するCore Concept、Canonical Term、責務・Authorityの定義は、[`00_02_CRDD_Core_Concepts_and_Terminology.md`](00_02_CRDD_Core_Concepts_and_Terminology.md)を正本とし、本書では再定義しない。

# Purpose

本ドキュメントは、未整理の思い、困りごと、観察、顧客の発言、既存資料、要求候補、解決案、Legacy Systemの挙動等を、CRDDで扱えるContextへ変換するためのDiscovery規範を定義する。

CRDDにおけるDiscoveryは、要求を大量に集める工程でも、AIがもっともらしい企画書を生成する工程でもない。

Discoveryの目的は、以下である。

```text
人間が持つ原始的な思いを失わずに残す
観察事実、解釈、仮説、要求候補、解決案を分離する
何が分かり、何が分からないかを明示する
なぜ取り組むのかを、人間が確認できる言葉へ整理する
次に進むべき専門領域と検証方法を判断できる状態にする
```

Discoveryは、CRDDの入口である。

ただし、必ず最初に一度だけ行う工程ではない。
新しい課題、顧客要求、技術制約、検証結果、Legacy分析によって、プロジェクトの途中から再びDiscoveryへ戻ってよい。

---

# Phase Process Contract

この節はDiscovery工程の入口、変換、責務網羅、出口、Phase Gate、Auditの正本である。`00_41_Discovery_Skill.md`はこのContractを実行するための対話Adapterであり、独自の完了条件を持たない。

## Phase Entry Contract

Discoveryは、顧客の声、Idea、観測、Incident、法令変更、明確な仕様変更、曖昧な要求、既存挙動、運用上の困りごと等を、Raw SourceとProvenanceを保ったまま受け取る。入力時点でRequirement、Defect、Change、Solutionの分類確定を要求しない。

## Transformation Contract

入力を、Origin / Trigger、Raw Voice、Actor / Situation、Problem、Evidence、Interpretation / Hypothesis、Desired Outcome Candidate、Preserved Intent、Non-goal、Constraint、Open Question、Recommended Routeへ分離・構造化し、人間確認を経て必要な`REQ-*`を確立する。事実、解釈、仮説、提案を混同しない。

## Required Responsibility Coverage

対象Scopeについて、Input Source、Provenance、Actor / Situation、Problem / Pain、Evidenceと限界、Desired Outcome Candidate、Preserved Intent、Non-goal、Constraint / Assumption、Solution Candidate、Open Question、Routing、人間確認、および`REQ-*`の発行または非発行理由を網羅する。

## Scope and Coverage State

各入力・Problem・候補Requirementを、`Complete for Scope`、`Partial — Human Authorized`、`Blocked`、`Not Started`、`Not Applicable`で追跡する。複数の入力がある場合、一件を整理しただけでDiscovery全体を完了扱いしない。

## Human Decisions

人間はOriginの意味、Problem Framing、価値、優先順位、Requirementへの昇格、Routing、Defect / Change分類、`Not Applicable`、部分Handoffを決定する。AIはWhy、重要度、Requirementを創作しない。

## Exit and Handoff

通常のUX Handoffは、対象Scopeが`Complete for Scope`で、人間Reviewを通過し、[UX Phase Entry Contract](00_42_UX_Skill.md#phase-entry-contract)を満たす場合に限る。Research、Decision、Prototype、IA、Technical Spike、Roadmap等の別Routeでは、各受信先が必要とするContextを示す。部分Handoffには対象Scope、未網羅項目、Risk、後続Ownerの人間承認を必要とする。

## Phase Gate Criteria

- Raw Source、Origin、Provenanceが保持されている
- Actor / Situation、Problem、Evidence、Interpretation / Hypothesisが分離されている
- Desired Outcome CandidateとSolution Candidateが分離されている
- Preserved Intent、Non-goal、Constraint、Open Questionが対象Scopeで判定済みである
- `REQ-*`の発行または非発行理由とRecommended Routeが人間確認済みである
- Coverage Gapと部分Handoff承認が記録されている
- 選択した受信先のEntry Contractを満たす

## Phase Audit Checklist

- Raw Voice / Source / Provenanceの消失
- AIが補ったWhy、重要度、Requirement
- Fact、Interpretation、Hypothesis、Solutionの混同
- 入力、Problem、候補Requirement、RouteのCoverage漏れ
- `01_Discovery`と`99_Roadmap`の責務混同または文書移動
- Coverage Summary、Open Gap、人間Review、Route根拠の欠落
- 受信先Entry Contractとの不一致

---

# 1. Basic Principle

CRDD Discoveryは、以下の原則に従う。

```text
人間の思いを、AIが都合よく完成させない。
顧客の発言を、そのまま確定Requirementにしない。
解決策を、解くべきProblemと同一視しない。
情報が少ないまま、詳細な仕様へ飛ばない。
不確実性を隠さない。
質問すること自体を目的にしない。
十分に分かったら、適切な次工程へ進む。
```

Discoveryで重要なのは、完璧な理解ではない。

重要なのは、現在の理解の範囲、根拠、不確実性、次の確認方法が明示されていることである。

---

# 2. Discovery Is Not Requirement Gathering

DiscoveryとRequirement Definitionは同一ではない。

Discoveryが扱うものは、まだ確定していない原始Contextを含む。

```text
思いつき
違和感
困りごと
感情
観察
顧客の発言
業務上の制約
既存の解決策
競合への不満
技術的な可能性
解決案
未確認の推測
Legacy Systemの現在挙動
```

これらは重要なInputであるが、そのままRequirementではない。

例:

```text
発言:
「一覧画面にAI要約ボタンが欲しい」

Discoveryで分離する内容:
Evidence      = 利用者が一覧から詳細を一件ずつ開いて確認している
Interpretation = 全体像を把握する負荷が高い可能性がある
Desired Outcome = 短時間で重要事項を把握し、確認対象を選べる
Solution Candidate = 一覧画面のAI要約ボタン
Requirement Candidate = 重要事項の要約と根拠へアクセスできる
Open Question = ボタンが最適か、自動表示が最適か
```

解決案は捨てない。
ただし、Problem、Outcome、Requirementと分離して保存する。

---

# 3. What Discovery Must Preserve

Discoveryは、整理の過程で原始Contextを消してはならない。

最低限、以下を必要に応じて保持する。

| Context | Meaning |
|---|---|
| `Raw Voice` | 人間、顧客、利用者が実際に表現した言葉 |
| `Origin` | 何が始まりで、なぜ考え始めたか |
| `Intent` | 何を実現したいか、何を大切にしたいか |
| `Problem` | 現在何が成立していないか |
| `Pain / Impact` | どんな負担、損失、不安、制約が生じているか |
| `Evidence` | 観察、記録、データ、実行結果、資料、証言 |
| `Interpretation` | Evidenceから人間またはAIが読み取った意味 |
| `Hypothesis` | 未検証だが成立する可能性がある説明 |
| `Desired Outcome` | 利用者、業務、組織をどの状態へ変えたいか |
| `Value / Principle` | 下流でも失ってはいけない価値や判断基準 |
| `Non-goal` | 今回目指さないこと、意図的に扱わないこと |
| `Solution Candidate` | 現時点で考えられる実現方法 |
| `Constraint` | 時間、費用、技術、法務、運用、組織等の制約 |
| `Open Question` | まだ分からず、判断または検証が必要な事項 |
| `Confidence` | 現時点の理解がどの程度確からしいか |

すべての項目を必須入力欄として機械的に埋める必要はない。

ただし、重要なDiscoveryで、事実と仮説、目的と解決手段、確定事項と未確定事項を区別できない状態は認めない。

---

# 4. Human Origin and AI Assistance

## 4.1. Origin Is Human-authored or Human-confirmed

CRDDにおけるOrigin、Intent、Value、Non-negotiableは、人間が与えるか、人間が確認しなければならない。

AIは以下を行ってよい。

```text
発言からOrigin候補を抽出する
複数の表現を整理する
矛盾や曖昧さを指摘する
確認質問を作る
言語化の草案を提案する
過去Contextとの関係を示す
```

ただし、AIが推定した内容は、人間が確認するまでOriginとして確定してはならない。

```text
AI Inference
↓
Origin Candidate / Intent Candidate
↓
Human Confirmation
↓
Approved Origin / Intent
```

## 4.2. Do Not Polish Away the Human Meaning

AIは、原始的で感情的な表現を、抽象的なビジネス用語へ置き換えるだけで終えてはならない。

例:

```text
Raw Voice:
「毎回、会議前になると何か見落としている気がして怖い」

悪い要約:
会議準備を効率化する。

保持すべき意味:
情報探索時間の削減だけでなく、見落としへの不安を減らし、
十分なContextを持って会議へ臨める状態を作る。
```

原始Contextは、後から製品の原点へ戻るためのEvidenceである。
整理後の表現とは別に保持してよい。

## 4.3. AI Must Not Manufacture Importance

AIは、情報が少ないことを補うために、Problemの深刻度、利用者数、市場価値、緊急性、顧客意図を創作してはならない。

不明な場合は、以下のように扱う。

```text
Unknown
Not Confirmed
Hypothesis
Needs Evidence
Human Decision Required
```

---

# 5. Discovery Input Sources

Discoveryは、会話だけをInputとしない。

利用可能なSourceには、以下が含まれる。

```text
人間のメモや発言
顧客・利用者へのInterview
Meeting Log
問い合わせ・Support Log
業務手順
既存の企画書・仕様書・設計書
Figma等のDesign Artifact
Issue / Ticket
Code
Database Schema
API
実行時挙動
Log / Metric
運用上のWorkaround
障害・不具合
競合・市場情報
Prototype結果
User Test結果
```

各Sourceは、存在するだけで正本とは限らない。

SourceのAuthority、対象時点、適用範囲、作成者、現状との一致を確認する。

---

# 6. Greenfield and Brownfield Discovery

## 6.1. Greenfield Discovery

新規の製品・機能・活動では、人間のOrigin、Problem、Desired Outcomeを起点とする。

標準的な流れは以下である。

```text
Raw Idea / Pain
↓
Origin / Intent
↓
Problem / Evidence
↓
Desired Outcome / Principle
↓
Hypothesis / Solution Candidate
↓
Next Route
```

## 6.2. Brownfield / Legacy Reverse Discovery

Legacy環境では、信頼できるWhyや文書が存在しない場合がある。

その場合は、現在残っているEvidenceから逆方向にContextを復元してよい。

```text
Code / Runtime Behavior / Log / DB / Operation / Existing Docs
↓
Current Behavior
↓
Inferred Requirement Candidate
↓
Inferred Intent Candidate
↓
Human / Stakeholder Confirmation
↓
Recovered Context
```

ただし、以下を守る。

```text
現在の実装を、元の意図と同一視しない
長く動いている挙動を、望ましい挙動と決めつけない
既存文書を、現行の正本と決めつけない
復元したWhyを、確認前に確定しない
不明なOriginは、不明なまま明示してよい
```

Legacy Discoveryで復元した情報は、確認されるまで以下として扱う。

```text
Observed Behavior
Recovered Requirement Candidate
Recovered Intent Candidate
Historical Hypothesis
```

CRDDは、失われたContextをAIに創作させる方法ではない。
残っているEvidenceから、再判断可能な形へ漸進的に復元する方法である。

---

# 7. Discovery Progression

Discoveryは、以下の論理段階を持つ。

固定された会議回数や作業順を強制するものではない。

## D-01. Capture

未整理の情報を、評価や整形によって失わずに取り込む。

```text
Raw Voice
Source
発生時点
対象
現在分かっている背景
```

## D-02. Separate

情報の種別を分離する。

```text
Observation
Evidence
Interpretation
Hypothesis
Requirement Candidate
Solution Candidate
Decision
Open Question
```

## D-03. Clarify

次の判断に必要な不足だけを質問・調査する。

```text
誰または何が対象か
どの状況で起きるか
何が困りごとか
現在どう対処しているか
どう変われば成功か
何を失いたくないか
何が未確認か
```

## D-04. Frame

上流Contextとして利用できる形へ整理する。

```text
Origin / Intent
Problem / Evidence
Desired Outcome
Value / Principle
Non-goal
Constraint
Hypothesis
Open Question
```

## D-05. Route

次に行うべき活動を判断する。

## D-06. Handoff

次工程が利用できるDiscovery Briefを渡す。

段階を進めるたびに、原始Contextを破棄する必要はない。
Raw Voiceと整理後のContextを接続したまま保持する。

---

# 8. Questioning Standard

CRDDにおけるAIの質問は、空欄をすべて埋めるためのInterviewではない。

質問の目的は、次の判断に必要な不確実性を減らすことである。

## Q-01. Ask the Minimum Discriminating Question

一度に大量の質問を並べず、次の方向を分けるために最も重要な質問から行う。

例:

```text
「誰向けですか？」だけでなく、
「一番困っている人は誰で、どの場面で困りますか？」と聞く。
```

```text
「必要な機能は？」だけでなく、
「それができないことで、現在どんな負担や判断ミスが起きていますか？」と聞く。
```

## Q-02. Ask Why without Interrogating

Whyを確認するために、同じ問いを機械的に繰り返してはならない。

人間が持つ背景、感情、現場知識を尊重し、回答済みの情報を再び尋ねない。

## Q-03. Separate Problem from Preferred Solution

解決案が先に提示された場合も、否定せず保存した上で、背景を確認する。

```text
その案によって何を改善したいか
現在何が成立していないか
案のどの性質が重要か
別の方法でも守るべき価値は何か
```

## Q-04. Make Uncertainty Visible

回答を得られない場合、AIが推測で埋めない。

```text
未回答
確認できる人物
確認できるSource
Prototypeで検証する内容
現時点で置くAssumption
```

を整理する。

## Q-05. Stop When the Next Action Is Clear

Discoveryは、すべてを確定するまで続けるものではない。

次の専門層、調査、Prototype、Decisionへ安全に渡せる状態になったら進む。

---

# 9. Discovery Routing

Discoveryの結果は、常にUX文書作成へ直行するとは限らない。

以下を標準的なRoute候補とする。

| Route | When to Use |
|---|---|
| `Continue Discovery` | 問題や対象が曖昧で、次の判断に必要な情報が不足している |
| `Research` | 外部事実、市場、利用者、制度、技術等の確認が必要 |
| `Decision` | 選択肢と判断材料が揃い、人間の決定が必要 |
| `UX` | 対象者、Problem、Desired Outcomeを体験設計へ変換できる |
| `IA` | 既存UXの範囲内で、概念・責務・情報構造の再設計が主題 |
| `UI / SPEC` | 上流Intentが既に承認済みで、Interaction / Behaviorの具体化が主題 |
| `Architecture / Technical Spike` | 技術的成立性が主要な不確実性であり、先行検証が必要 |
| `Prototype / Experiment` | 言葉だけでは仮説を判断できず、試作・利用検証が必要 |
| `Existing Context Update` | 新規Featureではなく、既存Contextの訂正・補足・再構成が必要 |
| `Change Package` | 既存Productに対する影響範囲付きの変更として扱うべき |
| `Roadmap Candidate` | 価値はあるが、現時点で着手判断をしない |
| `No Action / Archive` | 解決対象ではない、重複、誤認、現時点で扱わないと判断した |

RouteはAIが提案してよい。

Scope、優先順位、採用・却下を伴うRouteの最終判断は人間が行う。

## Routing Record

軽微でないDiscoveryでは、以下を説明できるようにする。

```text
Selected Route
Why this route
Rejected or deferred routes
Unresolved questions
Required input for the next activity
Human confirmation
```

---

# 10. Discovery Brief

Discoveryから次工程へ渡す標準OutputをDiscovery Briefと呼ぶ。

Discovery Briefは、詳細な企画書や確定仕様ではない。

次工程が、原点と不確実性を失わずに作業を開始するためのContext Packageである。

## Minimum Discovery Brief

```text
# Discovery Brief

## Trigger / Origin
何が始まりで、なぜ今扱うのか

## Raw Voice
原始的な表現、発言、観察

## Target / Situation
誰または何が、どの状況で対象になるか

## Problem / Pain
現在何が成立せず、どんな影響があるか

## Evidence and Provenance
根拠、Source、対象時点、Authority

## Interpretation / Hypothesis
Evidenceから読み取った意味と、未検証の仮説

## Desired Outcome
何がどの状態へ変わればよいか

## Values / Preserved Intent
下流で失ってはいけない価値、思い、原則

## Non-goal
今回目指さないこと

## Solution Candidates
現時点の実現案。確定Requirementとは分離する

## Constraints / Assumptions
制約と、成立のために置いた前提

## Open Questions
未確定事項、Owner、確認方法

## Recommended Route
次に進む活動と理由

## Human Confirmation
人間が確認・判断した範囲
```

小規模な対象では、一つの短いMarkdownや会話から生成したStructured Contextでよい。

重要なのは項目数ではなく、次工程が「なぜ」「何が確かか」「何が未確定か」を理解できることである。

---

# 11. Discovery Handoff Gate

Discoveryは、すべての疑問が解消されるまで完了しない、というものではない。

次の活動へ進むには、最低限以下を満たす。

## Required

```text
着手のTriggerまたはOriginが説明できる
対象となる人、業務、System、状況のいずれかが特定されている
Problemまたは検証したいOpportunityが説明できる
Evidence、Interpretation、Hypothesisが混同されていない
Desired Outcomeまたは次に確かめたい変化が説明できる
重要な未決事項が明示されている
次のRouteと、その理由が説明できる
人間がOrigin / Intent / Routeを確認している
```

## Not Required

```text
すべてのRequirementが確定していること
すべての利用者を理解していること
解決策が決まっていること
画面一覧が完成していること
技術方式が決まっていること
すべてのOpen Questionが解消されていること
```

## UX Handoff Minimum

UXへ渡す場合、最低限以下を説明できるようにする。

```text
なぜ取り組むか
誰が、どの状況で困るか
現在どんな影響があるか
どう変われば成功か
何を大切にし、何を避けたいか
根拠と仮説は何か
何がまだ分からないか
```

---

# 12. Decision and Promotion

Discovery中に重要な選択を確定した場合は、Requirement等の成果物へ反映し、そのDecision / Rationale Sectionへ理由、Evidence、経緯を残す。

例:

```text
対象利用者を限定した
今回は解決しない範囲を決めた
特定のProblemを優先した
Prototypeへ進むと決めた
Legacyの現在挙動を維持しないと決めた
```

Discovery Artifact内のメモだけで、重要判断を確定扱いにしてはならない。

また、以下は自動的に確定ContextへPromotionしない。

```text
AIが生成した要約
AIが推定したWhy
顧客一人の発言
現在の実装挙動
会議中の未承認案
Prototypeで一度成立した結果
```

Promotionは、`00_11_Information_Provenance.md`および`00_12_Decision_Rationale.md`に従う。

---

# 13. Discovery Review

Discovery Reviewは、文章の完成度ではなく、次の判断へ使えるContextになっているかを確認する。

## Review Questions

```text
人間の原始的な思いは残っているか
AIの言葉だけに置き換わっていないか
ProblemとSolution Candidateを分離しているか
顧客の発言をRequirementへ直結させていないか
EvidenceとInterpretationを分けているか
不明事項をAIが創作していないか
Desired OutcomeはFeature名ではなく、変化として表現されているか
守る価値とNon-goalが分かるか
次に何をするか、その理由が分かるか
Discoveryを続ける必要性が本当にあるか
```

Legacy Discoveryでは、追加で以下を確認する。

```text
現在の挙動と、本来の要求を混同していないか
既存文書のAuthorityを確認したか
復元したIntentをHypothesisとして扱っているか
不明な歴史を無理に埋めていないか
```

---

# 14. Anti-patterns

## 14.1. AI-generated Why

短い入力からAIが完成されたVision、Mission、Problemを生成し、人間確認なしに正本化する。

## 14.2. Feature-first Discovery

最初から画面、ボタン、API、AI機能の一覧を作り、解決したいProblemやOutcomeを確認しない。

## 14.3. Customer Said, Therefore Requirement

顧客や利用者の発言を、そのまま確定Requirementとして扱う。

## 14.4. Question Exhaustion

テンプレートの全項目を埋めるために、大量の質問を一度に投げる。

## 14.5. Polished but Empty Brief

文章は整っているが、Evidence、対象状況、未決事項、次の判断がない。

## 14.6. Hidden Uncertainty

不明事項を一般論やAI推定で埋め、確定情報のように見せる。

## 14.7. Solution Rejection

人間が出した解決案を「上流ではない」として捨てる。
解決案は保持し、背景のIntentと分離する。

## 14.8. Endless Discovery

すべてを理解するまで次工程へ進まず、Prototype、Research、UX等による学習を開始しない。

## 14.9. Legacy Behavior as Truth

現在動いているCodeや運用を、元の要求または望ましい状態として扱う。

## 14.10. Raw Voice Erasure

整理されたビジネス用語だけを残し、人間が最初に持っていた違和感、思い、言葉を失う。

---

# 15. Relationship Between `01_Discovery` and `99_Roadmap`

## 15.1. Responsibility Boundary

`01_Discovery`と`99_Roadmap`は、時間軸ではなく責務が異なる。

| Folder | Responsibility | Authority |
|---|---|---|
| `01_Discovery` | 新しい発言、事実、法令、問題、要求候補、不確実性を受け取り、EvidenceとInterpretationを分離し、追跡すべきRequirementを確定する | Discovery Source、Evidence、`REQ-*`の正本 |
| `99_Roadmap` | 採用済みの要求・改善・変更のうち、未着手または将来実施するものについて、優先順位、時期、依存関係、着手条件を示す | 将来実施計画の正本。Requirement、Specification、Designの正本ではない |

```text
01_Discovery = 何が分かり、何を満たす必要があるか
99_Roadmap   = 採用済みの何を、いつ・どの順序で扱うか
```

すべてのDiscovery結果がRoadmapへ進むわけではない。

```text
今すぐ対応する      → 07_WorkflowsのChange Context Packageへ進む
将来対応すると決める → 99_Roadmapへ参照を追加する
追加調査が必要       → 01_Discoveryに留める
採用しない           → 01_DiscoveryのDecision / Rationaleへ理由を残す
既存仕様どおりの不具合 → 01や99を経由せずChange Context Packageへ進める
```

## 15.2. No Document Movement Between 01 and 99

Discovery文書やEvidenceを`99_Roadmap`へ移動してはならない。Roadmap項目をRequirementやSpecificationの正本として扱ってもならない。

```text
01_Discovery/01_Product_Requirements.md#missed-important-topic
  └─ REQ-000012

99_Roadmap/01_Product_Roadmap.md#important-topic-review
  ├─ Source Requirement: REQ-000012
  ├─ Status: Planned
  ├─ Target: Q4
  └─ Start Condition: UX / feasibility review completed
```

Roadmap項目へCRDD標準Stable IDを付与しない。文書番号、Path、Anchor、必要なら外部IssueやProject IDで識別する。

着手時はRoadmap文書を`07_Workflows`へ移動しない。Change Context Packageを作成し、RoadmapからPackageへリンクする。

```text
99_Roadmap/01_Product_Roadmap.md#important-topic-review
  ↓ starts_as
07_Workflows/Changes/03_Important_Topic_Review.md
  ↓ reads / updates
REQ-000012 → UX-* / IA-* / UI-* / SPEC-*
```

完了後もRoadmapを仕様正本にしない。RoadmapのStatusと成果物参照を更新し、確定内容は各Canonical Artifactへ残す。

## 15.3. Stable ID Transition Rule

経路上でStable IDを扱うときは、以下を守る。

```text
新しい独立した要求・意味単位     → 新しいREQ / UX / IA / UI / SPEC ID
既存Contextの意味を保つ明確化     → 同じIDのRevision更新
既存Contextを別の意味へ置き換える → 新IDを発行しsupersedesで旧IDへ接続
Evidence、Roadmap、Architecture、Change、Test → Stable IDを発行せずArtifact参照
```

---

# 16. Initial Development Routes

## 16.1. Customer Interview → Idea → Human Decision

顧客の発言やアイディアを、そのままRequirementまたはRoadmap項目にしない。

```text
01_Discovery/Evidence/Customer_Interview_01.md
  ↓ interpretation / human decision
01_Discovery/01_Product_Requirements.md
  └─ REQ-000012: 利用者が重要事項を見落とさず確認できること
       ├─ addresses ← UX-000004
       └─ specified_by → SPEC-000044
                            └─ pairs_with ← UI-000021
```

今すぐ作る場合:

```text
REQ-000012
  ↓
02_UX / 03_IA / 04_Spec / 05_UIのCanonical Artifact
  ↓
07_Workflows/Changes/01_Important_Topic_Review.md
  ↓
Architecture Artifact → Implementation → Verification
```

採用したが後で作る場合:

```text
REQ-000012
  ↓ referenced_by
99_Roadmap/01_Product_Roadmap.md#important-topic-review
```

Roadmapには要求本文を複製せず、REQ、期待Outcome、優先理由、着手条件を参照として持たせる。

## 16.2. Legal or Regulatory Change During Development

法令本文、施行日、解釈根拠はDiscovery Evidenceとして保存または外部正本へ固定参照する。

```text
01_Discovery/Evidence/Legal/2026_Regulation_Change.md
  ↓ supports
REQ-000020: 対象操作の監査記録を保持すること
  ↓ specified_by
SPEC-000061: 監査記録の生成・失敗時Behavior
```

即時対応が必要なら`07_Workflows`へ進み、将来の施行日に合わせるなら`99_Roadmap`へREQ参照と期限を置く。Roadmapだけに法的要求を書いてはならない。

既存Requirementの意味を明確化するだけなら同じ`REQ-*`のRevisionを更新する。新しい法的義務なら新しい`REQ-*`を発行する。

## 16.3. Explicit Specification Change

変更要求の根拠を`01_Discovery`で確認し、Requirementが変わるかを先に判定する。

```text
Requirementも変わる
  → 新規または更新REQ
  → 影響するUX / IA / UI / SPECを更新

Requirementは同じでBehaviorの明確化だけ
  → 同じSPEC IDのRevisionを更新

Behaviorの意味を置換する
  → 新しいSPEC ID
  → new SPEC supersedes old SPEC
```

着手済みならChange Context Packageへ、採用済みだが未着手ならRoadmapへ参照を追加する。

## 16.4. Defect

承認済みSPECまたはUIに対して実装が一致しないことが明確なら、新しいREQやRoadmap項目を必須としない。

```text
04_Spec/Evidence/Topic_Behavior_Failure.md
  ↓ shows deviation from
SPEC-000044 / UI-000021
  ↓
07_Workflows/Changes/04_Fix_Topic_Read_State.md
  ↓
Implementation / Test / Verification
```

修正を意図的に延期する場合だけ、RoadmapまたはBacklog Viewへ参照を置く。既存仕様が存在しない、または期待動作自体が未確定なら、単純なDefectとして扱わずDiscoveryへ戻す。

## 16.5. Ambiguous Request: Defect or Specification Change Unknown

曖昧な要求を直接Roadmapや実装へ渡さない。まず`01_Discovery`で分類する。

```text
01_Discovery/Evidence/Support_Request_27.md
  ↓
01_Discovery/03_Hypotheses_and_Questions.md#request-27
  ├─ 現行SPECどおりでない        → Defect Route
  ├─ 現行SPECは正しいが説明不足   → 同じIDの文書・Acceptance明確化
  ├─ Requirementが新しい          → 新しいREQ Route
  ├─ Behaviorの意味を変える       → 新しいSPEC + supersedes
  └─ Evidence不足                 → Continue Discovery / Research
```

価値と対応方針が人間により採用され、かつ将来対応と決まるまで`99_Roadmap`へ昇格しない。

---

# 17. Maintenance Routes

保守期でも`01_Discovery`は閉じない。新しい外部事実、要求、法令、不確実性の入口として継続利用する。一方、既存成果物との差分が明確な場合は、不要なDiscoveryやID発行を増やさない。

## 17.1. Customer Interview → Idea → Human Decision

```text
01_Discovery/Evidence/Customer_Interview_18.md
  ↓ compare with existing REQ / UX / IA / UI / SPEC
```

| Finding | Route |
|---|---|
| 既存Requirementを補強するEvidence | 既存`REQ-*`を維持し、Evidence参照またはRevisionを更新 |
| 新しい独立要求 | 新しい`REQ-*`を発行 |
| 既存要求を置き換える | 新しい`REQ-*`を発行し`supersedes` |
| 採用済みで即時対応 | Canonical Artifact更新案 → Change Context Package |
| 採用済みで将来対応 | `99_Roadmap`からREQと影響Contextを参照 |
| 採用しない | Discovery成果物のDecision / Rationaleへ理由を残す |

## 17.2. Legal or Regulatory Change During Maintenance

```text
Legal Source / Revision / Effective Date
  ↓
01_Discovery/Evidence/Legal/
  ↓
new or revised REQ-*
  ↓ impact analysis
existing UX / IA / UI / SPEC + Architecture Artifact
```

対応期限が現在Releaseより前なら、Roadmap待ちにせず緊急Change Context Packageへ進める。将来施行ならRoadmapへ期限、対象REQ、影響成果物、着手条件を記録する。

## 17.3. Explicit Specification Change During Maintenance

```text
Change Trigger
  ↓ requirement impact classification in 01_Discovery
Existing REQ / UX / IA / UI / SPEC
  ↓ same meaning       → same ID + Revision
  ↓ semantic replace  → new ID + supersedes
07_Workflows/Changes/<document-number>_<topic>.md
  ↓
Architecture / Implementation / Migration / Verification
```

変更を次期Releaseへ送る場合はRoadmapへ参照を置くが、変更後の仕様本文をRoadmapへ先行して正本化しない。

## 17.4. Defect During Maintenance

```text
Incident / Test Failure / Support Evidence
  ↓ compare with Approved UI / SPEC
仕様との差分が明確
  ↓
Change Context Package → Fix → Regression Test → Evidence
```

既存`REQ-*`、`UI-*`、`SPEC-*`は、意味が変わらない限り維持する。修正結果、Test名、Evidence Path、ReleaseはArtifact参照で接続する。

修正過程で「現行仕様そのものが不適切」と判明した場合はDefect Routeを中断し、Discoveryへ戻してRequirementまたはSpecification Changeとして再分類する。

## 17.5. Ambiguous Request During Maintenance

```text
Support / Operation / Monitoring Input
  ↓
01_Discoveryで期待、現行仕様、実装事実を比較
  ├─ Implementation deviation → Defect
  ├─ Missing requirement      → new or revised REQ
  ├─ Changed behavior intent  → revised/new SPEC
  ├─ UX / IA / UI issue       → affected Stable Context update
  └─ Not enough evidence      → Research / Observation
```

分類前に既存Stable IDの意味を書き換えたり、新しいIDを仮発行したりしない。Roadmapには「曖昧な要求」そのものを仕様として置かず、必要なら調査項目としてPathと着手条件だけを記録する。

---

# 18. Route Summary

| Trigger | First Check | Stable ID Action | Immediate | Deferred |
|---|---|---|---|---|
| 顧客ヒアリング・アイディア | Evidenceと要求を分離 | 新規要求なら`REQ-*`。既存意味なら維持 | Canonical Artifact → Change Package | REQ参照をRoadmapへ |
| 法改正 | Source、Revision、施行日、適用範囲 | 新義務なら`REQ-*`。Behaviorは`SPEC-*` | 緊急または期限付きChange Package | 期限とREQ参照をRoadmapへ |
| 明確な仕様変更 | Requirementも変わるか | 同じ意味はRevision、置換は新ID + `supersedes` | Change Package | 影響ID参照をRoadmapへ |
| 不具合 | Approved UI / SPECとの差分か | 原則ID維持 | Fix Change Package | 延期時だけRoadmap / Backlog参照 |
| 仕様変更か曖昧 | 期待・仕様・実装事実を比較 | 分類まで新IDを発行しない | 分類後のRouteへ | 採用・延期決定後だけRoadmapへ |

---

# 19. Minimum Compliance

CRDD Product Lifecycle ProfileでDiscoveryを適用する場合、最低限以下を満たす。

```text
原始Contextと整理後Contextを区別できる
Origin / Intentを人間が確認する
Observation / Evidence / Interpretation / Hypothesisを混同しない
Problem / Desired Outcome / Solution Candidateを区別する
不確実性とOpen Questionを明示する
次に進むRouteを判断する
次工程へ、Preserved Intentと未決事項を渡す
01_DiscoveryをEvidence・不確実性・REQの入口として扱う
99_Roadmapを採用済みで未着手の計画Viewとして扱う
Discovery文書をRoadmapへ移動せず、RoadmapをRequirementやSpecificationの正本にしない
Roadmap項目へCRDD標準Stable IDを付与しない
不具合・仕様変更・曖昧な要求でStable IDを維持、改訂、置換する条件を区別する
```

固定された質問票、専用Tool、特定のFile構成、特定のAI Agentに依存してはならない。

---

# 20. Final Principle

```text
Discoveryは、AIが正しい答えを作る工程ではない。
人間が持つ思いと、現在分かっている現実を、
次の判断へ進めるContextに変える工程である。
```

```text
分からないことは、分からないまま残してよい。
しかし、何が分からず、次にどう確かめるかは残さなければならない。
```

```text
CRDDは、思いを仕様へ急いで変換しない。
思いを失わず、事実と仮説を分け、
最も適切な次の専門活動へ接続する。
```
