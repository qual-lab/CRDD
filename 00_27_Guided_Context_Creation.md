# CRDD Guided Context Creation

Version: v0.1.0
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-16
Related:
- [00_02_CRDD_Core_Concepts_and_Terminology.md](00_02_CRDD_Core_Concepts_and_Terminology.md)
- [00_03_CRDD_Conformance.md](00_03_CRDD_Conformance.md)
- [00_13_Human_AI_Responsibility.md](00_13_Human_AI_Responsibility.md)
- [00_16_Context_Transformation.md](00_16_Context_Transformation.md)
- [00_17_Discovery.md](00_17_Discovery.md)
- [00_18_UI_Behavior_Contract.md](00_18_UI_Behavior_Contract.md)
- [00_19_Context_Traceability.md](00_19_Context_Traceability.md)
- [00_23_Phase_Gate_Approval.md](00_23_Phase_Gate_Approval.md)
- [00_24_Change_Context_Package.md](00_24_Change_Context_Package.md)
- [00_25_Gap_Validation_Impact.md](00_25_Gap_Validation_Impact.md)
- [00_26_Agent_IO_Contract.md](00_26_Agent_IO_Contract.md)
- [00_30_Product_Documentation.md](00_30_Product_Documentation.md)

---

本書で使用するCore Concept、Canonical Term、責務・Authorityの定義は、[`00_02_CRDD_Core_Concepts_and_Terminology.md`](00_02_CRDD_Core_Concepts_and_Terminology.md)を正本とし、本書では再定義しない。

# Purpose

本ドキュメントは、CRDDにおいて非専門家を含む人間が、AIとの対話を通じてUX、IA、UI、SPEC、Architecture、Planning等の専門Contextを作成・更新するためのGuided SkillとProfessional Templateの標準を定義する。

CRDDでは、専門成果物を作るために、利用者が最初から専門用語や文書構造を理解していることを前提としない。

```text
UX.mdを埋めてください
IAを定義してください
State Transitionを書いてください
EARSでRequirementを書いてください
```

という要求だけでは、専門家以外は適切なContextを作れない。

一方、AIが自由会話だけから成果物を生成すると、次の問題が起こる。

```text
重要な前提を確認せずに補完する
人間の思いを一般的な表現へ薄める
UX、IA、UI、SPECの責務を混在させる
不足Contextを隠して完成形を作る
専門的には不適切でも、文章として自然な成果物を返す
利用者が判断すべき選択肢をAIが勝手に確定する
```

Guided Skillは、人間の言葉を専門成果物へ変換するための対話プロトコルである。

Professional Templateは、AIと専門家が生成・Review・継承する成果物の構造である。

本標準は、質問数を増やすことを目的としない。

```text
必要なことを
必要な順序で
人間が答えられる言葉で問い
専門責務へ正しく変換し
未決と不確実性を残したまま
次の判断へ渡せる状態にする
```

ことを目的とする。

---

# 1. Basic Principle

Guided SkillとProfessional Templateは、以下の原則に従う。

```text
利用者へ最初から専門文書を書かせない。
質問は、成果物の項目順ではなく、人間が考えやすい順序で行う。
一度にすべてを質問しない。
既に分かっていることを再質問しない。
人間の原始的な言葉を保存し、専門用語だけに置き換えない。
Evidence、Interpretation、Hypothesis、Decisionを区別する。
AIが判断できることと、人間が決めることを分離する。
不足情報を隠して完成形を生成しない。
不明なことはUnknown、Open Question、Assumptionとして保持する。
専門成果物間の責務を混在させない。
生成物は上流ContextへTraceできるようにする。
Questionnaireの完了ではなく、次の判断に使えることを終了条件とする。
```

---

# 2. Guided Skill and Template Are Different

## 2.1. Guided Skill

Guided Skillは、人間との対話を通じて必要Contextを抽出・整理・確認する実行手順である。

```text
質問する
回答を受け取る
既存Contextと照合する
不足または矛盾を確認する
専門Contextへ変換する
人間へ要約して確認する
次の専門活動へHandoffする
```

Guided Skillは、単なる質問一覧ではない。

次を持つ。

```text
開始条件
必要Input
質問方針
分岐条件
生成するContext
確認方法
停止条件
Escalation条件
終了条件
次のHandoff
```

## 2.2. Professional Template

Professional Templateは、専門Contextを保存・Review・再利用するための成果物構造である。

例:

```text
UX Outcome Template
IA Object Model Template
UI Contract Template
Behavior Requirement Template
Architecture Decision Template
Delivery Plan Template
```

Professional Templateは、人間が最初から直接埋めることを必須としない。

Guided Skill、専門家、AI Agent、既存Artifactから生成・更新できる。

---

# 3. Interaction Layers

Guided Skillは、次の3層で構成する。

## 3.1. Human Conversation Layer

人間が答えやすい自然な言葉で質問する。

例:

```text
誰が一番困っていますか？
どんな場面で困りますか？
今はどうやってしのいでいますか？
何ができるようになれば成功ですか？
絶対に失いたくないことは何ですか？
```

## 3.2. Structured Context Layer

回答をCRDDのContextへ整理する。

例:

```text
Problem
Actor
Current Workaround
Pain
Desired Outcome
Principle
Constraint
Evidence
Hypothesis
Open Question
```

## 3.3. Professional Artifact Layer

専門領域の成果物へ変換する。

例:

```text
UX Outcome
Journey
Object Model
Navigation
UI Contract
Behavior Requirement
Acceptance Criteria
Architecture Boundary
```

利用者へProfessional Artifactの全項目を直接見せる必要はない。

ただし、最終的な人間確認では、AIがどのように変換したかを理解できる形で示す。

---

# 4. Standard Skill Lifecycle

Guided Skillは、原則として次のLifecycleを持つ。

```text
1. Orient
2. Load Context
3. Confirm Scope
4. Ask Minimum Questions
5. Structure Answers
6. Detect Gaps and Conflicts
7. Propose Professional Context
8. Human Review
9. Register Trace and Status
10. Route to Next Skill or Gate
```

## 4.1. Orient

現在何を整理しようとしているか、利用者へ簡潔に伝える。

悪い例:

```text
これからUX Requirements Templateを埋めます。
```

良い例:

```text
まず、誰のどんな困りごとを解決し、
利用後にどんな状態へ変えたいかを整理します。
画面や機能はまだ決めません。
```

## 4.2. Load Context

既存Repository、Change Package、会話、資料から、既知Contextを読む。

既に判明していることは、質問ではなく確認として扱う。

```text
これまでのContextでは、対象はPM／Managerで、
重要な相談の見逃しと認知負荷が主な問題と整理されています。
今回もこの前提で進めます。
```

## 4.3. Confirm Scope

```text
新規Product
既存Feature変更
Legacy Reverse
Concept検証
UI改善
Behavior変更
Architecture変更
```

のどれを扱うか確認する。

## 4.4. Ask Minimum Questions

次の判断に必要な質問だけを行う。

すべてのTemplate項目を一度に聞かない。

## 4.5. Structure Answers

人間の回答を、事実・解釈・仮説・判断へ分ける。

## 4.6. Detect Gaps and Conflicts

```text
回答同士の矛盾
既存DecisionとのConflict
必要Evidenceの不足
別専門領域で決めるべき事項
上流へ戻すべき事項
```

を示す。

## 4.7. Propose Professional Context

AIは専門Context案を提示する。

確定事項と提案を区別する。

## 4.8. Human Review

人間は少なくとも以下を確認する。

```text
自分の思いが失われていないか
AIが勝手に追加した価値判断がないか
重要な前提が抜けていないか
次へ進めてよいか
```

## 4.9. Register Trace and Status

Context ID、Relation、Revision、Confidence、Open Question、Statusを更新する。

## 4.10. Route

```text
次のSkillへ進む
Researchへ戻る
Decisionが必要
Prototypeを作る
Technical Spikeを行う
人間または専門家へEscalationする
```

を決める。

---

# 5. Question Design Standard

## 5.1. One Decision at a Time

一つの質問で複数の重要判断を要求しない。

悪い例:

```text
対象ユーザー、課題、主要機能、成功指標、収益モデルを教えてください。
```

良い例:

```text
今回、一番困っているのは誰ですか？
```

回答後:

```text
その人は、どんな場面で困りますか？
```

## 5.2. Ask from Experience, Not Terminology

専門用語ではなく、経験や具体例から聞く。

悪い例:

```text
主要なDomain Entityは何ですか？
```

良い例:

```text
利用者が仕事の中で「別のもの」として区別している情報や対象は何ですか？
```

## 5.3. Preserve Raw Voice

重要な発言は要約だけでなく、Raw Voiceとして残す。

例:

```text
Raw Voice:
「朝Slackを開くのが怖い。何か見落としている気がする」
```

専門Context:

```text
Problem:
情報量そのものではなく、未確認の重要事項が存在する不安が認知負荷になっている。
```

## 5.4. Ask for Concrete Example

抽象回答だけの場合、直近の具体例を聞く。

```text
最後にそれで困ったのはいつですか？
そのとき何が起きましたか？
どう対処しましたか？
```

## 5.5. Ask for Contrast

価値や境界を明確にするため、対比を聞く。

```text
それができる状態と、できない状態の違いは何ですか？
便利になっても、こうなったら嫌だという状態はありますか？
```

## 5.6. Separate Need and Solution

```text
何が必要か
今考えている解決案は何か
その解決案以外でも成立するか
```

を分ける。

## 5.7. Do Not Force Certainty

利用者が分からない場合、無理に選ばせない。

```text
Unknown
Need Research
Need Expert
Need Prototype
Need Decision Later
```

として残す。

## 5.8. Explain Why the Question Matters

専門的または答えにくい質問では、目的を短く説明する。

```text
この質問は、後で画面を分けるか、同じ場所にまとめるかを判断するためです。
```

---

# 6. Answer Classification

AIは回答を、少なくとも以下へ分類する。

| Type | Meaning |
|---|---|
| `Raw Voice` | 人間の元の言葉 |
| `Observation` | 観察された事実 |
| `Evidence` | 出典を持つ根拠 |
| `Interpretation` | 事実に対する解釈 |
| `Hypothesis` | 未検証の仮説 |
| `Preference` | 人間の嗜好 |
| `Principle` | 守るべき価値または原則 |
| `Constraint` | 現在の制約 |
| `Solution Candidate` | 解決案 |
| `Decision` | 人間が選択した内容 |
| `Open Question` | 未決事項 |
| `Recovered Candidate` | Legacyから復元した候補 |

AIは、分類を利用者へすべて見せる必要はない。

ただしRepositoryへ保存する際は、素性を失わせない。

---

# 7. Skill Routing

一つのGuided Skillで全工程を完結させない。

回答内容に応じて、次のSkillへRoutingする。

```text
Discovery
├─ Research Skill
├─ Decision Skill
├─ UX Skill
├─ IA Skill
├─ Prototype Skill
├─ Technical Spike Skill
├─ Roadmap Skill
└─ Legacy Reverse Skill
```

その後:

```text
UX Skill
↓
IA Skill
↓
UI Skill ⇄ Behavior / SPEC Skill
↓
Architecture Skill
↓
Planning Skill
↓
Delivery / Validation Skill
```

順序は固定ではない。

必要なContextとGate条件に応じて戻る、分岐する、並行することを許容する。

---

# 8. Discovery Guided Skill

## Goal

原始的な思い、課題、観察、仮説を失わず、次の活動を判断できるContextへ整理する。

## Minimum Question Set

```text
なぜ今これを考えていますか？
誰が、どんな場面で困っていますか？
最近の具体的な出来事はありますか？
今はどう対処していますか？
何ができるようになれば、改善したと言えますか？
絶対に失いたくない価値や条件はありますか？
すでに考えている解決案はありますか？
まだ分からないことは何ですか？
```

すべてを必ず聞く必要はない。

既存Contextにあるものは確認へ切り替える。

## Professional Output

```text
Origin / Intent
Problem
Actor
Current Situation
Current Workaround
Desired Outcome
Principle
Constraint
Evidence
Hypothesis
Solution Candidate
Open Question
Recommended Route
```

## Exit

```text
次に何を判断・調査・設計すべきかが明確
OriginまたはRecovered Candidateの素性が明確
重要な不確実性が明示
```

---

# 9. UX Guided Skill

## Goal

ProblemとOriginを、利用者にもたらすOutcomeと体験原則へ変換する。

## Human-friendly Questions

```text
この人は、利用前にどんな状態にいますか？
利用後、何ができる・分かる・安心できるようになればよいですか？
途中で最も不安、面倒、迷いが大きい場面はどこですか？
その体験で、人間が判断すべきことは何ですか？
AIやSystemに任せたいことは何ですか？
便利でも、こうなったら失敗だと思うことは何ですか？
成功したことを、どんな行動や変化で確認できますか？
```

## Professional Output

```text
UX Outcome
Experience Principle
Before / After State
Journey / Scenario
Critical Moment
Human Responsibility
System / AI Responsibility
Avoided Experience
Success Signal
Assumption
Validation Need
```

## Review Questions

```text
SolutionではなくOutcomeになっているか
誰にとっての価値か明確か
人間の思いが一般論へ薄まっていないか
実装変更後も残る内容か
```

---

# 10. IA Guided Skill

## Goal

利用者の理解と行動に沿って、情報、Object、責務、関係、Navigationを整理する。

## Human-friendly Questions

```text
利用者は、何と何を別のものとして考えますか？
一つの対象について、何を一覧で見て、何を詳しく見たいですか？
時間が経つと状態が変わるものは何ですか？
どの情報は履歴として残る必要がありますか？
同じ場所に置くと分かりやすいものは何ですか？
逆に、混ぜると混乱するものは何ですか？
利用者は、どこから入り、どこへ進みますか？
誰が作成・更新・承認・閲覧しますか？
```

## Professional Output

```text
Object / Entity
Definition
Relationship
Responsibility
Lifecycle
State Concept
Grouping
Navigation
Ownership / Authority
Naming
Expected UI Obligation
Expected Behavior Obligation
```

## Review Questions

```text
System内部構造だけになっていないか
利用者のMental Modelを説明できるか
Objectと画面を同一視していないか
責務境界が明確か
```

---

# 11. UI Guided Skill

## Goal

UXとIAを、利用者が認識・操作・理解・回復できるUI Contractへ変換する。

## Human-friendly Questions

```text
この場面で、利用者が最初に気付くべきことは何ですか？
次に何を判断・操作できる必要がありますか？
判断するために、どの根拠を同時に見たいですか？
操作後、何が起きたと分かれば安心できますか？
何もない場合は、何を伝えるべきですか？
処理中は、何を待っていると分かる必要がありますか？
失敗した場合、理由・影響・次の行動のどれが必要ですか？
権限がない、実行できない、未設定の場合をどう区別しますか？
取り消し、やり直し、再試行は必要ですか？
```

## Professional Output

```text
UI Contract
Visual Priority
Information Group
Action
Trigger Reference
Visible State
Feedback
Loading
Empty
Error
Permission
Disabled
Conflict
Cancel / Undo / Retry
Accessibility
Responsive / Variant Consideration
Figma / Prototype Reference
```

## Review Questions

```text
見た目の説明だけになっていないか
主要ActionとFeedbackがあるか
IA責務を崩していないか
Behaviorを無言で決めていないか
```

---

# 12. Behavior / SPEC Guided Skill

## Goal

Feature、Use Case、UI Contract、Business Ruleを、検証可能なBehavior Contractへ変換する。

## Human-friendly Questions

```text
何をきっかけに処理が始まりますか？
開始前に満たす必要がある条件は何ですか？
誰が実行できますか？
正常に終わったとき、何が変わりますか？
処理中、Systemはどの状態になりますか？
失敗にはどんな種類がありますか？
同じ操作が二重に行われた場合はどうしますか？
取り消しや再試行は可能ですか？
外部Systemが使えない場合はどうしますか？
どの結果ならRequirementを満たしたと言えますか？
```

## Professional Output

```text
REQ ID
Trigger
Precondition
Actor / Authority
Behavior
State Transition
Output
Failure / Exception
Permission
Idempotency
Cancel / Retry / Recovery
Non-functional Condition
Acceptance Criteria
EARS Statement
paired UI Contract
```

## Review Questions

```text
条件と結果が検証可能か
UI Actionと対応しているか
Business RuleをAIが創作していないか
UXやDesign IntentをEARSへ圧縮していないか
```

EARS等の構文は、このSkillのBehavior、Exception、Acceptance Criteriaで推奨する。

---

# 13. Architecture Guided Skill

## Goal

承認済みContractを、現在の制約下で成立させる技術境界、Data、API、Failure、Operationへ変換する。

## Human-friendly Questions

```text
どこで動かす必要がありますか？
誰のDataを、どこへ保存できますか？
外部Serviceが停止した場合、何を守る必要がありますか？
将来入れ替えたい部分はどこですか？
絶対に外部へ送れない情報はありますか？
失敗しても失ってはいけないものは何ですか？
利用規模や応答時間の目安はありますか？
既存Systemや運用で変えられないものは何ですか？
```

## Professional Output

```text
Architecture Context
Component Boundary
Data Ownership
Data Flow
API / Integration
Security / Privacy Boundary
Failure / Recovery
Deployment
Operation
Observability
Migration
Replaceable Implementation Choice
Trade-off
Decision Candidate
```

## Review Questions

```text
Architectureが上流Contractを弱めていないか
実装選択を永続的なProduct Principleにしていないか
交換可能な部分と恒久的なConstraintを区別しているか
```

---

# 14. Planning Guided Skill

## Goal

承認済みContextを、境界、依存、Owner、検証を持つ実行可能な計画へ変換する。

## Human-friendly Questions

```text
最初に確かめないと危険なことは何ですか？
独立して進められる部分はどこですか？
先に決まらないと進められないことは何ですか？
途中で止めても価値が残る単位は何ですか？
誰の判断が必要ですか？
どこまでできれば次へ渡せますか？
失敗した場合、どこまで戻せますか？
```

## Professional Output

```text
Task
Purpose
Boundary
Dependency
Required Context
Owner
Authority
Expected Output
Verification
Stop Condition
Rollback
Handoff
```

---

# 15. Legacy Reverse Guided Skill

## Goal

Code、挙動、文書、運用から、現在の実態と失われたContext候補を復元する。

## Human-friendly Questions

```text
現在、実際には何が起きていますか？
文書ではどう書かれていますか？
運用ではどんな例外対応をしていますか？
誰が、なぜこの挙動を必要としていると言っていますか？
変更すると困る人や処理はありますか？
意図なのか偶然なのか分からない部分はどこですか？
```

## Professional Output

```text
Documented Behavior
Implemented Behavior
Observed Behavior
Operational Practice
Difference
Recovered Intent Candidate
Expected Contract Candidate
Confidence
Risk
Unknown
Recommended Decision
```

## Review Questions

```text
Codeを自動的に正本にしていないか
古い文書を自動的に正本にしていないか
推定したWhyを確定していないか
互換性Riskを見落としていないか
```

---

# 16. Adaptive Questioning

Guided Skillは、固定Questionnaireではなく、回答と既存Contextに応じて分岐する。

## Example: UX Skill

```text
対象Userが不明
→ User / Actor確認へ戻る

ProblemのEvidenceが弱い
→ Research SkillへRouting

Outcomeは明確だがSolutionが固定されている
→ Alternative確認

複数UserのOutcomeがConflict
→ Decision SkillまたはPriority判断

Current Behavior改善のみ
→ Legacy / Change Skillへ切り替え
```

## Example: UI Skill

```text
Behaviorが未定義
→ SPEC Skillと並行または先行

IA責務が曖昧
→ IA Skillへ戻る

未知の技術制約が大きい
→ Prototype / Technical Spike

Visualだけの軽微変更
→ Compact UI Review
```

AIは、質問を続けること自体を目的にしない。

次の活動へ移る方が価値が高い場合、Routingを提案する。

---

# 17. Progressive Disclosure

利用者へ、最初からすべての専門項目を見せない。

## Level 1: Conversation

```text
自然な質問
簡単な選択肢
具体例
```

## Level 2: Structured Summary

```text
分かったこと
未決事項
AIの解釈
次の提案
```

## Level 3: Professional Detail

```text
Context ID
Relation
Requirement
State
Acceptance Criteria
Architecture
```

## Level 4: Machine-readable Registry

```text
YAML / JSON
Revision
Status
Provenance
Trace
```

利用者の役割と関心に応じて表示Levelを変える。

情報自体は失わせない。

---

# 18. Human Confirmation Pattern

AIが専門Contextへ変換した後は、単なる「OKですか？」ではなく、確認点を示す。

例:

```text
今回の整理では、次を重要な原点として扱います。

- 重要情報を一覧化することではなく、見落としへの不安を減らす
- AIが判断するのではなく、人間が判断しやすい材料を揃える
- 通知量を増やして解決しない

この理解で合っていますか？
特に失われている思いがあれば修正してください。
```

専門成果物の確認では:

```text
UIでは「根拠」と「次Action」を同じ視野へ置きます。
一方、重要度の算出RuleはUIでは決めず、REQ側の未決事項として残します。
```

のように、責務境界も説明する。

---

# 19. Skill Result Status

| Status | Meaning |
|---|---|
| `Framed` | 次の活動へ進むための基本Contextが整理された |
| `Drafted` | Professional Context案が生成された |
| `Reviewed` | 人間または専門家が内容を確認した |
| `Accepted` | 対象Revisionとして採用された |
| `Needs Research` | Evidence不足によりResearchが必要 |
| `Needs Decision` | 人間の価値判断が必要 |
| `Needs Expert` | 専門判断が必要 |
| `Blocked` | 前提不足またはConflictにより停止 |
| `Superseded` | 後続Contextへ置き換えられた |

Skill完了とGate承認は同一ではない。

Guided SkillでContextが作られても、重要なGateでは別途承認が必要になる。

---

# 20. Minimum Skill Definition

各Guided Skillは、最低限以下を定義する。

```yaml
skill:
  id: skill.ui.contract
  purpose: >
    UXとIAを、認識・操作・Feedbackを持つ
    UI Contractへ変換する。
  role: UI
  input:
    required:
      - UX Outcome
      - IA Structure
      - Use Case
    optional:
      - Existing UI
      - Pattern
      - Behavior Requirement
  questions:
    core:
      - first_information
      - primary_action
      - required_evidence
      - feedback
      - error_recovery
    adaptive:
      - permission
      - empty
      - conflict
  output:
    - UI Contract
    - Open Question
    - Trace Relation
  stop_conditions:
    - IA responsibility missing
    - behavior conflict
  human_confirmation:
    - preserved_intent
    - responsibility_boundary
  next:
    - Behavior Skill
    - Prototype Skill
```

---

# 21. Professional Template Common Fields

すべての重要Templateは、可能な範囲で以下を持つ。

```text
Context ID
Title
Purpose
Status
Revision
Owner / Authority
Source Context
Raw Voice Reference
Preserved Intent
Main Content
Decision / Rationale
Assumption
Open Question
Confidence
Relation
Artifact Reference
Verification
Last Reviewed
```

すべてのTemplateへ同じ項目を機械的に表示する必要はない。

Registry、Front Matter、本文へ分散して保持してよい。

---

# 22. Compact, Standard, and Extended Skills

## 22.1. Compact

小さな変更または個人利用。

```text
3〜5個の核心質問
短いStructured Summary
既存Contextへの追記
```

## 22.2. Standard

通常のFeatureまたはChange。

```text
適応型質問
専門Template生成
Trace更新
Open Question
Human Review
```

## 22.3. Extended

高Risk、複数Stakeholder、Enterprise、Legacy大規模変更。

```text
複数Evidence
専門家Review
Alternative比較
Gate
Impact Analysis
Variant
Baseline
Independent Validation
```

規模は質問数ではなく、Riskと判断負荷に応じて選ぶ。

---

# 23. AI and Human Responsibility

## AI May

```text
既存Contextを読み、重複質問を避ける
回答から構造化Contextを生成する
不足、矛盾、曖昧さを検出する
専門用語を人間向けに言い換える
選択肢とTrade-offを提示する
Professional Templateへ変換する
TraceとStatusを更新する
次のSkillを提案する
```

## AI Must Not

```text
人間のOriginやPrincipleを創作する
回答がない項目を確定情報で埋める
専門的に自然な文章を、正しいContextだとみなす
UX、IA、UI、SPECの責務を無言で混ぜる
質問に答えさせるため、もっともらしい選択肢へ誘導する
人間のDecisionをAI提案へ置き換える
未検証の仮説をRequirementへ昇格する
```

## Human Owns

```text
Origin
Value
Priority
Trade-off
Risk Acceptance
Scope
Final Decision
```

専門家は、専門Templateの妥当性と品質を判断する。

---

# 24. Anti-patterns

## 24.1. Empty Template First

最初に巨大なTemplateを見せ、利用者へ埋めさせる。

## 24.2. Interview Everything

必要性に関係なく、全Questionを順番に聞く。

## 24.3. AI Completes the Blank

回答がない項目を、AIが一般論で埋める。

## 24.4. Beautiful but Untraceable

読みやすい成果物を作るが、元の発言やEvidenceへ戻れない。

## 24.5. One Skill Does Everything

DiscoveryからArchitecture、実装計画まで一度に生成する。

## 24.6. Terminology Test

利用者が専門用語を知っているかを試すような質問をする。

## 24.7. Confirm by Yes / No Only

AIの変換内容と責務境界を説明せず、承認だけ求める。

## 24.8. Question Count as Quality

質問数が多いほど高品質だと考える。

## 24.9. UX as Requirement Syntax

UX OutcomeやDesign IntentをEARS等のBehavior構文へ圧縮する。

## 24.10. UI as Screenshot

画像やFigma FrameだけをUI Contractとみなす。

---

# 25. Completion Criteria

Guided SkillとProfessional Templateの適用は、対象Scopeについて以下を満たしたとき完了とする。

```text
既存Contextを読んだうえで質問している
人間が答えやすい言葉で必要事項を確認した
Raw Voiceと専門的な解釈を区別している
Evidence、Hypothesis、Decisionが区別されている
専門領域の責務に沿ったContextへ変換されている
不足情報とOpen Questionが明示されている
AIが創作した重要判断がない
人間が変換内容とPreserved Intentを確認した
Context ID、Relation、Revision、Statusが更新されている
次のSkill、Gate、Research、Decisionが明確である
```

# Summary

CRDDのGuided Skillは、専門家の仕事を質問票へ単純化する仕組みではない。

専門家が暗黙的に行ってきた、

```text
何を聞くか
なぜ聞くか
どこまで確定できるか
何を別領域へ渡すか
どこで人間判断へ戻すか
```

を、AIと人間が再現可能な形へ構造化する。

Professional Templateは、利用者へ空欄を埋めさせるための用紙ではない。

人間の思いを専門Contextへ変換し、次のAI、専門家、工程、実装へ意味を失わず渡すための契約である。

これによりCRDDは、専門家でなくても始められ、専門家が入ったときには精度を高められ、AIや実装環境が変わっても原点を継承できる方法論となる。
