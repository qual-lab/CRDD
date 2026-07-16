# CRDD Discovery

Version: v0.2.0
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
- [00_12_Decision_Record.md](00_12_Decision_Record.md)
- [00_13_Human_AI_Responsibility.md](00_13_Human_AI_Responsibility.md)
- [00_16_Context_Transformation.md](00_16_Context_Transformation.md)
- [00_30_Product_Documentation.md](00_30_Product_Documentation.md)

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

Discovery中に重要な選択を確定した場合は、必要に応じてDecision RecordへPromotionする。

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

Promotionは、`00_11_Information_Provenance.md`および`00_12_Decision_Record.md`に従う。

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

# 15. Minimum Compliance

CRDD Product Lifecycle ProfileでDiscoveryを適用する場合、最低限以下を満たす。

```text
原始Contextと整理後Contextを区別できる
Origin / Intentを人間が確認する
Observation / Evidence / Interpretation / Hypothesisを混同しない
Problem / Desired Outcome / Solution Candidateを区別する
不確実性とOpen Questionを明示する
次に進むRouteを判断する
次工程へ、Preserved Intentと未決事項を渡す
```

固定された質問票、専用Tool、特定のFile構成、特定のAI Agentに依存してはならない。

---

# 16. Final Principle

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
