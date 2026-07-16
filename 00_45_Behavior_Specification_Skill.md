# CRDD Behavior Specification Skill

Version: v0.3.0
Status: Stable
Skill ID: `skill.spec.behavior`
Owner: Qual-Lab
Last Updated: 2026-07-16
Related:
- [00_18_UI_Behavior_Specification.md](00_18_UI_Behavior_Specification.md)
- [00_19_Context_Traceability.md](00_19_Context_Traceability.md)
- [00_26_Agent_IO_Contract.md](00_26_Agent_IO_Contract.md)
- [00_27_Guided_Context_Creation.md](00_27_Guided_Context_Creation.md)
- [00_40_Guided_Skill_Runtime.md](00_40_Guided_Skill_Runtime.md)

- [00_46_Git_Markdown_Execution.md](00_46_Git_Markdown_Execution.md)
---

# 1. Purpose

Feature、Use Case、IA Lifecycle、UI Contract、Business Ruleを、検証可能なCondition、State、Behavior、Exception、Acceptance Criteriaへ変換する。

Behavior Specification Skillは、UXやDesign Intentを機械的な構文へ変換するSkillではない。

```text
どの条件で
誰または何が
どの状態から
何を行い
何が変わり
失敗時にどうなるか
何をもって成立とするか
```

を定義する。

---

# 2. Use When

```text
UI Actionに対応するSystem Behaviorを定義したい
状態遷移・例外・権限が曖昧
RequirementをTest可能にしたい
既存実装からCurrent Behaviorを復元したい
UIとBackend／AI処理の契約を揃えたい
```

## Do Not Use As

```text
UX OutcomeをEARSへ書き換えるSkill
ArchitectureやCodeを先に決めるSkill
Business RuleをAIが創作するSkill
```

---

# 3. Required Input

```text
Feature / Use Case / User Action
IA Object / Lifecycle
UI Contract
Business Rule
Actor / Authority
Constraint
Quality Attribute
Existing Behavior / Code
```

Business RuleのAuthorityが不明な場合は確定せず、Decisionへ戻す。

---

# 4. Orientation Message

```text
ここでは、UIの操作やUse Caseに対して、
Systemがどの条件でどう振る舞い、
成功・失敗・再試行をどう扱うかを定義します。

UXやDesign Intentはそのまま保持し、
検証可能なBehaviorだけをEARS等で精密化します。
```

---

# 5. Core Question Flow

## Q1. Trigger

```text
何をきっかけに処理が始まりますか？
```

## Q2. Actor and Authority

```text
誰または何が実行できますか？
実行権限を決める根拠は何ですか？
```

## Q3. Precondition

```text
開始前に満たす必要がある条件は何ですか？
```

## Q4. Current State

```text
対象は、どの状態から処理を開始しますか？
```

## Q5. Behavior

```text
正常時にSystemは何を行いますか？
```

## Q6. State Change / Output

```text
完了後、Data、状態、表示可能な結果はどう変わりますか？
```

## Q7. Processing

```text
処理中は、二重実行や別操作をどう扱いますか？
```

## Q8. Failure

```text
どんな失敗があり、それぞれ何を保持・戻し・通知しますか？
```

## Q9. Retry / Recovery

```text
再試行は可能ですか？
自動か手動か、上限や条件はありますか？
```

## Q10. Cancel / Undo

```text
開始後に取消可能ですか？
完了後に元へ戻せますか？
```

## Q11. External Dependency

```text
外部Service、Network、AI Providerが使えない場合はどうしますか？
```

## Q12. Acceptance

```text
どの結果とEvidenceがあれば、Requirementを満たしたと言えますか？
```

---

# 6. EARS Usage

EARSは、Behavior Specification、Exception、Acceptance Criteriaで利用する。

## Ubiquitous

```text
The system shall <response>.
```

## Event-driven

```text
When <trigger>, the system shall <response>.
```

## State-driven

```text
While <state>, the system shall <response>.
```

## Unwanted Behavior

```text
If <unwanted condition>, then the system shall <response>.
```

## Optional Feature

```text
Where <feature is enabled>, the system shall <response>.
```

日本語では、自然さを保ちながら条件と結果を明示する。

例:

```text
利用者が未読の重要Topicを開いたとき、
SystemはTopic詳細と関連Evidenceを取得し、
表示可能な結果を返さなければならない。
```

EARSに向かないもの:

```text
利用者が判断に集中できる
信頼できる体験を提供する
分かりやすく表示する
```

これらはUX／UI Intentであり、Behaviorへ直接圧縮しない。

---

# 7. Adaptive Branches

## Rule Is Unknown

```text
現在の挙動
期待候補
Authority
```

を分け、Decision Requiredとする。

## UI and Behavior Conflict

例:

```text
UIはUndoを提供
SPECは不可逆
```

どちらかを自動修正せず、G4 Reviewへ戻す。

## AI Behavior

次を明示する。

```text
Input Scope
Prompt / Model Boundary
Output Status
Confidence
Human Review
Fallback
Provider Failure
Data Sending Policy
```

AI出力をDecisionまたは実行結果と同一視しない。

## Async Processing

```text
Requested
Queued
Processing
Succeeded
Failed
Cancelled
Expired
```

など、UI StateとSystem Stateを分ける。

## Idempotency

二重実行Riskがある場合:

```text
Idempotency Key
Duplicate Result
Retry Rule
```

を定義する。

## Legacy Reverse

次を分離する。

```text
Documented Behavior
Implemented Behavior
Observed Runtime Behavior
Operational Practice
Expected Behavior Specification Candidate
```

---

# 8. Professional Output

`templates/05_Behavior_Specification_Template.md`へ以下を生成する。

```text
SPEC ID
Feature / Use Case / User Action
Purpose
Source UX / IA / UI
Actor / Authority
Trigger
Precondition
State
Behavior
Output
State Transition
Failure / Exception
Permission
Idempotency
Cancel / Undo / Retry
External Dependency
Quality Condition
EARS Statement
Acceptance Criteria
Test / Evidence Candidate
pairs_with UI
Open Question
```

---

# 9. Acceptance Criteria Quality

Acceptance Criteriaは、次を満たす。

```text
対象Revisionが明確
Input / Conditionが明確
観察可能な結果が明確
Successだけでなく重要Failureを含む
対象Variant / Environmentが明確
Evidence取得方法を定義可能
```

## Weak

```text
正しく動作すること。
```

## Good

```text
Cloud Providerが利用不可の状態でCognitionを実行した場合、
SystemはLocal Providerへ自動Fallbackせず、
利用不可状態と理由を返すこと。
```

---

# 10. UI Pair Review

SPECごとに対応するUI Contractを確認する。

```text
Trigger ↔ Action
Precondition ↔ Visible availability
Processing State ↔ Loading / Disabled
Success ↔ Feedback
Failure ↔ Error / Recovery
Permission ↔ Permission UI
Retry ↔ Retry Action
Cancel ↔ Cancel UI
```

API／Batch等でUIがない場合は、Consumer ContractまたはOperational Feedbackを確認する。

---

# 11. Human Review

AIは次を提示する。

```text
確定Behavior:
AI提案の採用操作後、Decision CandidateをAcceptedへ変更する。

UIとの対応:
UI-000021の「採用」Actionに対応。

未決:
採用後のUndo可否。
これはUIではなくBusiness RuleとしてDecisionが必要。

Acceptance:
状態変更、Activity記録、再読込後の永続化を確認する。
```

---

# 12. Subagent Execution

Behavior、State、Exception、Acceptance Criteriaを分けて検討する必要がある場合、Parent Agentは `00_50_Subagent_Orchestration.md` に従って限定ScopeのSubagentへ委譲してよい。

分離可能な観点:

```text
Behavior Specification
State Transition
Exception / Recovery
Acceptance Criteria
UI Contract / SPEC Pair Review
```

SubagentはBehavior Specification Proposal、State Conflict、Exception Gap、Acceptance Gap、Open Questionを返す。Behavior Specificationの統合、UI Contractとの対応確認、正本文書更新はParent Agentが行う。

---

# 13. Stop / Reject / Escalate

## Stop

```text
Business Rule Authorityが不明
UIとBehaviorが重大Conflict
Acceptanceを定義できない
```

## Reject

```text
UX OutcomeをEARS化して完了
現行Codeを無条件にRequirementへ昇格
```

## Escalate

```text
Scope
Permission
Data Retention
Risk Acceptance
不可逆処理
Fallback Policy
```

---

# 14. Exit Criteria

```text
SPEC IDと対象Use Caseが明確
Trigger / Condition / Behavior / Resultが検証可能
重要StateとExceptionが定義
PermissionとRecoveryを必要範囲で確認
EARSはBehavior領域に限定
UI Contractとpairs_with
Acceptance Criteriaがある
未決RuleがOpen QuestionまたはDecisionへ接続
人間Review済み
```
