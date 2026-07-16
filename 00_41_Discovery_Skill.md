# CRDD Discovery Skill

Version: v0.1.0
Status: Stable
Skill ID: `skill.discovery.frame`
Owner: Qual-Lab
Last Updated: 2026-07-16
Related:
- [00_17_Discovery.md](00_17_Discovery.md)
- [00_26_Agent_IO_Contract.md](00_26_Agent_IO_Contract.md)
- [00_27_Guided_Context_Creation.md](00_27_Guided_Context_Creation.md)
- [00_40_Guided_Skill_Runtime.md](00_40_Guided_Skill_Runtime.md)

- [00_46_Git_Markdown_Execution.md](00_46_Git_Markdown_Execution.md)
---

# 1. Purpose

人間の原始的な思い、違和感、課題、観察、資料、解決案を、Whyを失わず次の活動へRoutingできるDiscovery Contextへ変換する。

DiscoveryはFeature一覧を作る工程ではない。

```text
なぜ今考えているのか
誰が何に困っているのか
何が事実で何が仮説か
何を実現したいのか
次に何を確かめるべきか
```

を整理する。

---

# 2. Use When

```text
新しいProductまたはFeatureの着想がある
顧客から曖昧な相談を受けた
現場の困りごとを製品化できるか考えたい
既存Featureをなぜ変えるか整理したい
資料を投入したが、何から始めるべきか不明
Legacyから失われたWhyを復元したい
```

## Do Not Use As

```text
要件一覧の自動生成だけを行うSkill
市場Evidenceなしに事業性を確定するSkill
AIがProduct Visionを創作するSkill
画面や技術を最初から決めるSkill
```

---

# 3. Required Input

```text
人間の発言または依頼
投入資料
既存Context
関連Decision
既知のEvidence
Legacyの場合は文書・Code・挙動・運用
```

Inputが少なくても開始できる。

ただし、少ないInputからAIがOriginを確定してはならない。

---

# 4. Orientation Message

標準的な開始説明:

```text
まず、何を作るかではなく、
なぜ今それを考えているのか、
誰のどんな状態を変えたいのかを整理します。

画面・機能・技術は解決案として分けて扱い、
まだ分からないことは未決のまま残します。
```

Legacyの場合:

```text
現在の文書やCodeを正しい仕様とは決めつけず、
観察できる事実と、そこから復元できる意図候補を分けます。
```

---

# 5. Core Question Flow

すべてを必ず聞く必要はない。

## Q1. Trigger

```text
なぜ今、このことを考え始めましたか？
```

抽出候補:

```text
Origin Trigger
Recent Event
Pressure
Opportunity
Raw Voice
```

## Q2. Actor

```text
一番困っている、または変化を必要としているのは誰ですか？
```

複数Actorがある場合:

```text
最初に価値を届ける対象
影響を受ける対象
意思決定者
運用者
```

を分ける。

## Q3. Concrete Situation

```text
最近、実際に困った場面や具体例はありますか？
```

抽出候補:

```text
Observation
Evidence
Current Workflow
Pain
Frequency
Impact
```

## Q4. Current Workaround

```text
今は、どのように対処していますか？
```

現在の対応は、単なる非効率ではなく、守るべき要求を含む場合がある。

## Q5. Desired Change

```text
何ができる、分かる、安心できるようになれば、改善したと言えますか？
```

機能名で回答された場合:

```text
その機能によって、最終的にどんな状態へ変えたいですか？
```

とOutcomeへ戻す。

## Q6. Preserved Value

```text
便利になっても、絶対に失いたくないことはありますか？
```

抽出候補:

```text
Principle
Non-goal
Human Authority
Trust Boundary
Privacy
Quality
```

## Q7. Existing Solution Candidate

```text
すでに考えている解決案はありますか？
それ以外の方法でも、目的は達成できそうですか？
```

ProblemとSolutionを分離する。

## Q8. Unknown

```text
今の時点で、分からない、調べないと決められないことは何ですか？
```

---

# 6. Adaptive Branches

## Evidence Is Weak

```text
それは、実際に確認した事実ですか？
それとも、現時点の仮説ですか？
```

Route:

```text
Research Skill
User Interview
Data Analysis
Prototype
```

## Multiple Problems Are Mixed

```text
今挙げた問題のうち、最初に一つだけ変えられるとしたら、どれですか？
```

Problemを勝手に統合しない。

## Solution Is Fixed First

```text
その解決案を使わない場合でも、
変えたい状態は同じですか？
```

## Stakeholder Conflict

```text
利用者にとって良い状態と、運用者・事業側にとって良い状態で、
衝突する部分はありますか？
```

Route:

```text
Decision Skill
Stakeholder Alignment
```

## Legacy Reverse

次を分離して聞く。

```text
実際に起きていること
文書に書かれていること
運用で回避していること
意図だと考えられる候補
変更すると困る可能性
```

---

# 7. Structured Output

Discovery Skillは、`templates/01_Discovery_Context_Template.md`へ以下を生成する。

```text
Origin / Trigger
Raw Voice
Actor
Observed Situation
Problem
Current Workaround
Desired Outcome Candidate
Preserved Principle
Constraint
Evidence
Interpretation
Hypothesis
Solution Candidate
Non-goal
Open Question
Recommended Route
Confidence
```

---

# 8. Human Review

AIは次の形で確認する。

```text
今回の原点は、
「情報を一覧化したい」ことではなく、
重要な相談を見落としているかもしれない不安を減らしたいこと、
と理解しました。

解決案としてAI集約が挙がっていますが、
現時点ではSolution Candidateとして分けて残します。

この理解で、失われている思いや違う部分はありますか？
```

確認点:

```text
Raw Voiceが失われていない
ProblemとSolutionが分離されている
AIがWhyを追加していない
Unknownが隠されていない
```

---

# 9. Subagent Execution

Evidence量が多い、ProblemとSolutionが混ざっている、または独立Reviewが必要な場合、Parent Agentは `00_50_Subagent_Orchestration.md` に従って限定ScopeのSubagentへ委譲してよい。

分離可能な観点:

```text
Evidence Review
Problem Framing
Problem / Solution Separation
Discovery Consistency Review
```

SubagentはEvidence Gap、Assumption、Conflict、Open Questionを返す。Discovery Contextの統合、Human Review提示、正本文書更新はParent Agentが行う。

---

# 10. Routing Rules

| Condition | Recommended Route |
|---|---|
| ProblemとOutcomeが整理できた | UX Skill |
| Evidenceが弱い | Research |
| 重要な価値判断が必要 | Decision |
| 解決案の成立性を確かめたい | Prototype |
| 技術制約が支配的 | Technical Spike |
| Objectや業務概念の整理が先 | IA Skill |
| 既存仕様との差異が中心 | Legacy Reverse / Gap Validation |
| まだProduct化しない | Knowledge / Roadmap |

Discoveryから必ずUXへ進む必要はない。

---

# 11. Stop / Reject / Escalate

## Stop

```text
人間のOriginと依頼されたSolutionが矛盾する
複数Stakeholderの価値が重大に衝突する
Evidenceなしでは次の判断が危険
```

## Reject

```text
AIにWhyを創作させることが前提
事実と仮説を区別せず確定要求へしたい
```

## Escalate

```text
Scope Priority
Risk Acceptance
Business Model
法務・安全・Security
```

---

# 12. Exit Criteria

```text
OriginまたはRecovered Candidateの素性が明確
ActorとProblemが理解可能
Desired Outcome CandidateがSolutionから分離
Preserved Principleが明示
EvidenceとHypothesisが区別
重要なOpen Questionが明示
次のRouteが決定
人間が変換結果をReview
```

---

# 13. Compact Example

```text
Human:
会議後に結局何が決まったか分からなくなる。

AI Classification:
Raw Voice:
「会議後に結局何が決まったか分からなくなる」

Problem:
会議情報は存在するが、Decisionと未決事項が区別されず、
後続作業へ継承されない。

Desired Outcome Candidate:
会議後に、決定・保留・次Actionを確認できる。

Solution Candidate:
録音とAI議事録。

Open Question:
誰が最終Decisionを確認するか。

Route:
UX Skill + Session Workflow Research。
```
