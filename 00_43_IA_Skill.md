# CRDD IA Skill

Version: v0.1.0
Status: Stable
Skill ID: `skill.ia.structure`
Owner: Qual-Lab
Last Updated: 2026-07-16
Related:
- [00_16_Context_Transformation.md](00_16_Context_Transformation.md)
- [00_19_Context_Traceability.md](00_19_Context_Traceability.md)
- [00_26_Agent_IO_Contract.md](00_26_Agent_IO_Contract.md)
- [00_27_Guided_Context_Creation.md](00_27_Guided_Context_Creation.md)
- [00_40_Guided_Skill_Runtime.md](00_40_Guided_Skill_Runtime.md)

- [00_46_Git_Markdown_Execution.md](00_46_Git_Markdown_Execution.md)
---

# 1. Purpose

UX OutcomeとDomain Contextを、利用者が理解可能なObject、責務、関係、Lifecycle、Grouping、Navigationへ変換する。

IA Skillは画面一覧を先に作るSkillではない。

```text
利用者は何を一つの対象として考えるか
対象同士はどう関係するか
何が時間とともに変化するか
どの責務をどこへ置くか
どの単位で探し、比較し、判断するか
```

を整理する。

---

# 2. Use When

```text
画面が増え、情報の置き場所が揺れている
同じ概念が複数の名前・画面で扱われている
Feature単位では整理できるが、Product全体構造が不明
一覧・詳細・履歴・設定の責務が混在している
利用者の理解とDB構造が混同されている
```

## Do Not Use As

```text
Sitemapだけを作るSkill
DB SchemaをそのままUI構造へするSkill
画面数を先に決めるSkill
すべてを単一のTreeへ押し込めるSkill
```

---

# 3. Required Input

```text
UX Outcome
Target Actor
Primary Scenario / Use Case
Domain用語
既存Object / Data
Current Workflow
Principle / Constraint
既存IA / UI
```

UX Outcomeが不明な場合はUX Skillへ戻す。

---

# 4. Orientation Message

```text
ここでは画面を決める前に、
利用者が何を別の対象として理解し、
どの単位で確認・判断・操作するかを整理します。

Databaseの都合ではなく、利用者と業務の意味から構造を作ります。
```

---

# 5. Core Question Flow

## Q1. Nouns in the Work

```text
利用者が仕事の中で「別のもの」として名前を付けている対象は何ですか？
```

例:

```text
Topic
Evidence
Decision
Action
Project
Source
```

## Q2. Identity

```text
その対象は、何が同じなら同じものですか？
何が変わると別のものになりますか？
```

ObjectのIdentityを確認する。

## Q3. Relationship

```text
対象同士は、どのような関係ですか？
```

例:

```text
Topic has Evidence
Decision resolves Topic
Action follows Decision
```

## Q4. Responsibility

```text
それぞれの対象について、利用者は何を知り、何を操作し、何を判断しますか？
```

## Q5. Lifecycle

```text
時間が経つと、どの対象の状態が変わりますか？
開始・完了・保留・廃止などはありますか？
```

## Q6. List / Detail / History

```text
一覧で比較したい情報は何ですか？
一つを詳しく見る情報は何ですか？
履歴として追いたい変化は何ですか？
```

## Q7. Grouping and Finding

```text
利用者は、何を手掛かりに対象を探し、絞り込みますか？
```

複数軸がある場合はFacetを優先する。

## Q8. Navigation

```text
利用者は、どの目的から入り、次にどこへ進みますか？
```

## Q9. Ownership

```text
誰が作成し、更新し、承認し、閲覧しますか？
```

---

# 6. Adaptive Branches

## Same Word, Different Meaning

同じ名称が別概念を示す場合は分離する。

```text
業務上のStatus
処理実行Status
UI表示Status
```

を同一Object Propertyにしない。

## Different Words, Same Meaning

名称統合候補としてGlossaryへ出す。

## Screen-first Answers

利用者が画面名で答えた場合:

```text
その画面が扱っている中心対象と責務は何ですか？
```

へ戻す。

## Tree Pressure

分類軸が複数ある場合:

```text
一つの階層に固定すると、別の観点で探すときに困りませんか？
```

Facet Candidateを整理する。

## Backend-driven Structure

```text
利用者は、そのTechnical Entityを直接意識しますか？
意識しない場合、UI／IA上のObjectは別に必要ですか？
```

## Cross-domain Conflict

OwnershipまたはBounded Contextの判断が必要ならArchitecture／Domain ExpertへEscalateする。

---

# 7. Professional Output

`templates/03_IA_Context_Template.md`へ以下を生成する。

```text
IA ID
Object / Entity
Definition
Identity
Relationship
Responsibility
Lifecycle
State Concept
Grouping / Facet
Navigation
Ownership / Authority
Glossary
Expected UI Obligation
Expected Behavior Obligation
Open Question
Relation
```

---

# 8. Quality Check

## Good Object Definition

```text
Topic:
複数のMessageやEvidenceを横断して追跡する、
一つの判断対象または問題のLifecycle単位。
```

## Weak: Screen Definition

```text
Topic:
Topic画面に表示されるもの。
```

## Weak: Database Definition Only

```text
Topic:
topics tableの一行。
```

## Responsibility Conflict

```text
InboxとTopic一覧の両方が、同じ目的・同じ情報・同じActionを持つ
```

場合は責務重複を検出する。

---

# 9. Human Review

AIは次を提示する。

```text
中心Object:
Topic = 判断対象のLifecycle単位
Evidence = Topicを裏付けるSource断片
Decision = 人間が採用した結論
Action = Decision後に必要な実行

重要な境界:
AI提案はDecisionではない。
MessageはSourceであり、Topicそのものではない。

未決:
一つのTopicが複数Projectへ属せるか。
```

人間は、業務上の意味と合うかを確認する。

---

# 10. Subagent Execution

Object、Navigation、Relation、Lifecycleなど複数のIA観点を分けて検討する必要がある場合、Parent Agentは `00_50_Subagent_Orchestration.md` に従って限定ScopeのSubagentへ委譲してよい。

分離可能な観点:

```text
Object Model
Information Structure
Navigation / Flow
IA Consistency Review
```

SubagentはProposal、Relation Gap、Responsibility Conflict、Open Questionを返す。中心Object、責務境界、UI / SPECへのHandoff統合はParent Agentが行う。

---

# 11. Handoff to UI and SPEC

## UIへ

```text
利用者が認識すべきObject
一覧・詳細・履歴の責務
主要Grouping / Facet
主要Action
重要State
Navigation
```

## SPECへ

```text
Object Lifecycle
State Concept
Ownership / Authority
Relationship Constraint
Behavior Obligation
```

UIとSPECへ同じ情報を同じ文体で渡すのではない。

それぞれの専門責務へ必要なObligationを渡す。

---

# 12. Stop / Reject / Escalate

## Stop

```text
UX Outcomeが不明
同一概念に矛盾した定義がある
Ownershipが決まらず責務を置けない
```

## Reject

```text
DB SchemaをそのままIAとして採用
画面数だけを先に確定
```

## Escalate

```text
Business Concept
Domain Boundary
Authority
Data Ownership
```

---

# 13. Exit Criteria

```text
中心Objectが定義
Object間Relationが理解可能
主要責務が重複していない
Lifecycleと重要Stateが明示
Grouping / Finding方法が明示
Navigationの目的が説明可能
UX OutcomeへTrace可能
UI / SPECへのObligationが明確
人間Review済み
```
