# CRDD Guided Skill Runtime

Version: v0.3.1
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-16
Related:
- [00_17_Discovery.md](00_17_Discovery.md)
- [00_19_Context_Traceability.md](00_19_Context_Traceability.md)
- [00_23_Phase_Gate_Approval.md](00_23_Phase_Gate_Approval.md)
- [00_24_Change_Context_Package.md](00_24_Change_Context_Package.md)
- [00_26_Agent_IO_Contract.md](00_26_Agent_IO_Contract.md)
- [00_27_Guided_Context_Creation.md](00_27_Guided_Context_Creation.md)

- [00_46_Git_Markdown_Execution.md](00_46_Git_Markdown_Execution.md)
---

# 1. Purpose

本ガイドは、CRDD Guided Skillを会話だけで終わらせず、開始・中断・再開・確認・保存・Handoffまで一貫して実行するための共通Runtimeを定義する。

Guided Skillは、固定Questionnaireではない。

```text
現在のContextを読む
次の判断に必要な不足だけを聞く
回答を専門Contextへ変換する
人間に変換結果を確認する
Repositoryへ保存する
次のSkillまたはGateへ渡す
```

Runtimeは、このLifecycleがAI Providerや担当者の変更によって崩れないようにする。

---

# 2. Runtime Unit

Guided Skillの一回の実行を`Skill Run`として扱う。

推奨ID:

```text
RUN-000123
```

Skill Runは会話Sessionと同一ではない。

一つのSkill Runを複数Sessionに分けてよく、一つのSession内で複数Skill Runを実施してもよい。

## Minimum Run Record

```yaml
skill_run:
  id: RUN-000123
  skill: skill.ux.outcome
  status: InProgress
  scope:
    change: 07_Workflows/Changes/04_Topic_Detail.md
    feature:
      - Important Topic Review
  input_revision:
    origin: 01_Discovery/00_Product_Origin.md@2
    problem: 01_Discovery/01_Product_Requirements.md#decision-fragmentation@3
  mode: Standard
  current_step: HumanReview
  answered_topics:
    - target_user
    - before_state
    - desired_outcome
  open_topics:
    - success_signal
  produced:
    - UX-000004@draft
  next:
    - resume_human_review
```

---

# 3. Skill Run Status

| Status | Meaning |
|---|---|
| `Not Started` | Skill候補だが、まだ開始していない |
| `Orienting` | 目的とScopeを確認中 |
| `Loading Context` | 既存Contextを読み込み中 |
| `Interviewing` | 必要な質問を実施中 |
| `Structuring` | 回答を専門Contextへ変換中 |
| `Reviewing` | 人間または専門家が変換結果を確認中 |
| `Accepted` | 対象Revisionとして採用済み |
| `Paused` | 安全に再開できる状態で中断 |
| `Blocked` | 外部判断または不足Contextにより停止 |
| `Escalated` | Decisionまたは専門Authorityへ戻した |
| `Superseded` | 別RunまたはRevisionに置き換えられた |

`Accepted`とPhase Gateの`Approved`は同一ではない。

---

# 4. Standard Run Flow

```text
0. Select Skill
1. Orient
2. Load Context
3. Confirm Scope and Revision
4. Build Question Queue
5. Ask One Decision at a Time
6. Classify and Store Answers
7. Generate Draft Context
8. Detect Gaps and Conflicts
9. Human Review
10. Register Context and Relations
11. Determine Route
12. Close or Pause
```

## 4.1. Select Skill

現在の不足Contextと目的からSkillを選ぶ。

Skill名を利用者へ押し付ける必要はない。

```text
「まず利用後にどんな状態を実現したいかを整理します」
```

のように、活動の意味を説明する。

## 4.2. Orient

次を30秒程度で理解できる形にする。

```text
今回整理すること
今回は決めないこと
なぜ今この質問をするか
最後に何が残るか
```

## 4.3. Load Context

最低限、次を読む。

```text
対象Feature / Use Case / Change
Active Revision
上流Context
関連Decision
Open Question
既存Artifact
過去のSkill Run
```

過去に回答済みのことを再質問しない。

## 4.4. Confirm Scope and Revision

AIは開始前に、参照Revisionの矛盾を確認する。

競合がある場合は質問を始めず、どのRevisionを使うか確認する。

## 4.5. Build Question Queue

Question Queueは固定順ではなく、優先度を持つ。

```yaml
question_queue:
  - topic: desired_outcome
    priority: Critical
    reason: UX Outcomeを定義できない
    status: Pending
  - topic: success_signal
    priority: Medium
    reason: 後続Verificationに必要
    status: Pending
```

優先度:

```text
Critical:
これが分からないと専門Contextを作れない

Important:
次工程で重大な手戻りが起きる

Useful:
精度を高めるが、Open Questionとして残せる

Deferred:
現在は聞かない
```

## 4.6. Ask One Decision at a Time

一度の問いで、原則一つの判断を扱う。

回答が広い場合は、AIが勝手に確定せず、理解を要約して次の問いへ進む。

## 4.7. Classify and Store Answers

各回答を、必要に応じて次へ分類する。

```text
Raw Voice
Observation
Evidence
Interpretation
Hypothesis
Preference
Principle
Constraint
Solution Candidate
Decision
Open Question
Recovered Candidate
```

利用者へ分類作業を要求しない。

## 4.8. Generate Draft Context

Draft生成時は、次を分離する。

```text
人間が明示したこと
既存Contextから継承したこと
AIが整理・言い換えたこと
AIが提案したこと
まだ不明なこと
```

## 4.9. Detect Gaps and Conflicts

次を確認する。

```text
上流Contextとの矛盾
同一概念の名称揺れ
既存DecisionとのConflict
別専門領域へ越境した判断
Evidence不足
未確認のAI補完
```

## 4.10. Human Review

Human Reviewでは、全文を一度に承認させるだけにしない。

最低限、以下を提示する。

```text
今回の結論
守ったIntent
AIが変換した部分
人間判断が必要な部分
未決のまま残す部分
次工程へ渡す義務
```

## 4.11. Register Context and Relations

AcceptedまたはReviewedとなったContextについて、次を更新する。

```text
Context ID
Revision
Status
Source Context
Relation
Confidence
Owner / Authority
Artifact Reference
Open Question
```

## 4.12. Determine Route

次の候補を提示する。

```text
次のGuided Skill
Research
Decision
Prototype
Technical Spike
Expert Review
Phase Gate
Pause
```

---

# 5. Pause and Resume

Skill Runは、回答待ちや疲労、外部調査のために中断できる。

`Paused`にする前に、Resume Snapshotを残す。

## Resume Snapshot

```yaml
resume:
  run: RUN-000123
  completed:
    - target_user
    - current_problem
    - desired_outcome
  current_understanding: >
    PMが重要相談を見逃す不安を減らし、
    判断に必要な根拠を集約することが中心。
  unresolved:
    - 成功を測るSignal
    - 通知との境界
  next_question: >
    利用者が「見落としへの不安が減った」と判断できる
    行動または変化は何ですか？
  draft:
    - UX-000004@draft
```

再開時に、最初から質問し直してはならない。

---

# 6. Context Update Strategy

Guided Skillは、毎回新しい文書を作るとは限らない。

次のいずれかを選ぶ。

```text
Create:
新しいContextを作る

Revise:
既存Contextの新Revisionを作る

Append Evidence:
Context本体は変えずEvidenceを追加する

Open Question:
未決事項だけを追加する

Supersede:
既存Contextを置き換える候補を作る

No Change:
確認したが変更しない
```

重要な意味変更では、既存Revisionを破壊的に上書きしない。

---

# 7. Human Review Modes

## 7.1. Lightweight Review

小規模または個人利用。

```text
理解の要約
重要な未決事項
採用／修正
```

## 7.2. Structured Review

通常のFeature。

```text
Source Context
Produced Context
Preserved Intent
Alternative
Open Question
Relation
```

## 7.3. Formal Review

高Riskまたは複数Stakeholder。

```text
Review Package
専門家所見
Impact Analysis
Decision / Rationale Section
Gate判定
```

---

# 8. Skill Handoff Contract

次のSkillへ渡す際は、受信工程の`Phase Entry Contract`を満たし、最低限以下を含める。Runtimeは工程固有の入力・成果・完了条件を再定義せず、選択した工程文書の`Phase Process Contract`を実行する。

```yaml
handoff:
  from_skill: skill.ux.outcome
  to_skill: skill.ia.structure
  scope:
    - feature: Important Topic Review
  coverage_state: Partial — Human Authorized
  coverage_summary:
    complete:
      - UX Outcome
      - Critical Journey
    open:
      - Secondary actor journey
      - Service Blueprint failure rows
  human_authorization:
    decision: IA may start for Important Topic Review only
    accepted_risk: Secondary actor structure may require rework
    owner: Product Owner
  accepted_context:
    - UX-000004@3
  preserve:
    - 人間が最終判断する
    - 根拠と提案を区別する
  obligations:
    - Topic / Evidence / Decisionの責務を分離する
  open_questions:
    - OQ-000031
  must_not_decide:
    - 重要度算出Rule
```

Handoffは成果物のリンクだけでは不十分。

次担当が守るべき意味、Coverage、未網羅項目、人間判断を明示する。通常Handoffは送信工程が`Complete for Scope`で受信工程のEntry Contractを満たす場合に限る。`Partial — Human Authorized`は、対象Scope、Gap、Risk、Ownerを人間が明示した場合だけ使用できる。

---

# 9. Compact Runtime

小規模変更では、次の簡易形式でよい。

```text
Skill:
UI Contract

Read:
UX-000004@3
IA-000008@2

Ask:
エラー時に利用者が次に取れる行動は何か

Result:
UI-000021@4

Open:
SPEC側のRetry上限

Next:
Behavior Specification Skill
```

簡略化しても、参照Revision、守るIntent、未決、次Handoffを消してはならない。

---

# 10. Failure Modes

## Repeated Interview

過去回答を読まず、毎回同じことを聞く。

## Template-driven Interview

Templateの上から順番に空欄を埋める。

## Hidden Completion

AIが不足を補う、または一部Artifactの完成度から対象Scope全体を完成扱いにする。

## Session Lock-in

会話Sessionが失われると再開できない。

## Handoff by File Link Only

次担当へファイルだけを渡し、守るIntentを伝えない。

## No-change without Record

Reviewしたが変更しなかった判断が残らない。

---

# 11. Completion Criteria

Skill Runは、次を満たしたとき終了できる。

ここでいうRun終了は工程完了と同義ではない。工程完了は対象工程の`Phase Gate Criteria`でのみ判定する。

```text
対象ScopeとRevisionが明確
必要な核心質問を確認済み
回答の素性が維持されている
専門Contextが生成または更新されている
AI補完と人間判断が分離されている
Open QuestionとRiskが明示されている
人間Reviewが実施されている
Context ID、Relation、Statusが更新されている
次のRouteまたは終了理由が明確
対象工程のCoverage StateとOpen Gapが記録されている
Handoff時は受信工程のPhase Entry Contractを満たしている
再開が必要な場合はResume Snapshotがある
```

---

# Summary

Guided Skill Runtimeは、AIとの対話を長くするための仕組みではない。

```text
会話をContextへ変え
Contextを専門成果物へ変え
成果物を人間が判断し
次の専門活動へ安全に渡す
```

ための実行基盤である。
