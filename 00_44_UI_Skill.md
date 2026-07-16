# CRDD UI Skill

Version: v0.3.1
Status: Stable
Skill ID: `skill.ui.contract`
Owner: Qual-Lab
Last Updated: 2026-07-16
Related:
- [00_18_UI_Behavior_Specification.md](00_18_UI_Behavior_Specification.md)
- [00_19_Context_Traceability.md](00_19_Context_Traceability.md)
- [00_23_Phase_Gate_Approval.md](00_23_Phase_Gate_Approval.md)
- [00_26_Agent_IO_Contract.md](00_26_Agent_IO_Contract.md)
- [00_27_Guided_Context_Creation.md](00_27_Guided_Context_Creation.md)
- [00_40_Guided_Skill_Runtime.md](00_40_Guided_Skill_Runtime.md)
- [00_46_Git_Markdown_Execution.md](00_46_Git_Markdown_Execution.md)
- [00_51_Document_Audit_Agent.md](00_51_Document_Audit_Agent.md)

---

# 1. Purpose

UX OutcomeとIA Structureを、利用者が認識・操作・理解・回復できるUI Contractへ変換する。

UI Skillは、単に画面を描くSkillではない。

```text
何を最初に認識するか
何を判断するか
どの根拠を見るか
何を操作するか
結果をどう理解するか
失敗からどう回復するか
```

を定義する。

---

# 2. Use When

```text
新しいUse CaseのUIを設計する
既存画面の責務・情報優先度を見直す
Figmaはあるが、状態・Feedbackが不明
UIとSPECの不整合を解消したい
複数画面・Componentで一貫したContractが必要
```

## Do Not Use As

```text
見た目の好みだけを決めるSkill
Business RuleをUI側で確定するSkill
Figma FrameをUI ContractそのものとみなすSkill
```

---

# Phase Process Contract

この節はUI工程の入口、変換、責務網羅、出口、Phase Gate、Auditの正本である。

## Phase Entry Contract

UIは対象Scope、UX Intent、IA Object / Responsibility / Navigation / State / Glossary、主要User Action、UI Obligation、Behavior Obligation、Coverage Summary、Open Gap、人間Review結果を受け取る。通常は[IAのExit and Handoff](00_43_IA_Skill.md#exit-and-handoff)から受け取る。

## Transformation Contract

UX IntentとIA責務を、利用者が認識・判断・操作・回復できるScreen / Surface、Flow、Information Priority、Action、Feedback、State、Accessibility、Variantへ変換する。Business RuleをUIで創作しない。

## Required Responsibility Coverage

対象Scope全体について、UI Index、Principle、Screen / Surface Inventory、Screen Flow、Wireframe / Prototype、UI Contract、Design Token、Component / Pattern、Visual / Asset / Motion、およびUI Quality Reviewを必要範囲で網羅する。全論理Screenと、Normal、Loading、Empty、Error、Permission、Disabled、Conflict等の適用状態、必要VariantをInventoryで追跡する。

## Scope and Coverage State

各Use Case / User Action、Screen / Surface、State、Variantを、`Complete for Scope`、`Partial — Human Authorized`、`Blocked`、`Not Started`、`Not Applicable`で追跡する。見た目または一画面の完成をUI工程全体の完了と表現してはならない。

## Human Decisions

人間は情報優先度、主要Action、重要Trade-off、Visual Direction、Accessibility Risk、`Not Applicable`、部分Handoffを決定する。Behavior RuleやAuthorityが未決ならSPECまたは上位工程へ戻す。

## Exit and Handoff

実装またはDelivery Planningへの通常Handoffは、対象Scopeが`Complete for Scope`で、人間Reviewを通過し、対応するBehavior SpecificationとのPair Reviewを完了した場合に限る。部分Handoffには対象Scope、Gap、Risk、後続Ownerの人間承認を必要とする。

## Phase Gate Criteria

- IA Obligationと対象Use Case / User ActionへのTraceがある
- Screen Inventoryが対象Scope、State、Variantを網羅しCoverageを示す
- 情報、Action、Feedback、Loading / Empty / Error / Permission等が適用範囲で定義されている
- Accessibility、Responsive / Platform Variant、Visual / Component責務が必要範囲で判定済みである
- UI ContractとBehavior SpecificationのPairが整合する、または未決が明示される
- Coverage Gapと部分Handoff承認が記録されている

## Phase Audit Checklist

- Screen / Surface、State、VariantのInventory漏れ
- Screenshot / Figmaだけによる完了判定
- UIによるBusiness Rule、Authority、State Transitionの創作
- UI ContractとSPECのAction / Trigger、State、Failure、Recovery、Permissionの不一致
- Coverage Summary、Open Gap、人間Review、Traceの欠落
- 実装への暗黙Handoff

---

# 3. Runtime Input View

Runtimeは[Phase Entry Contract](#phase-entry-contract)の全項目を読み込む。次は質問Queueを組み立てるためのCompact Viewであり、Entry Contractの代替ではない。

```text
UX Outcome
Experience Principle
IA Object / Responsibility
Feature / Use Case / User Action
既知のBehavior Specification
Platform / Brand / Accessibility Constraint
Existing Pattern / Component
```

主要Behaviorが不明でも開始できるが、UI側で推測して確定してはならない。

---

# 4. Orientation Message

```text
ここでは、利用者が何を見て、何を判断し、
どんな操作とFeedbackによって安心して進めるかを整理します。

処理条件やBusiness RuleはSPEC側と対にして扱い、
UIだけで勝手に決めません。
```

---

# 5. Core Question Flow

## Q1. User Goal

```text
この場面で、利用者が達成したいことは何ですか？
```

## Q2. First Recognition

```text
画面や状態を見た瞬間に、最初に気付くべきことは何ですか？
```

## Q3. Decision Evidence

```text
判断するために、どの情報や根拠を同時に確認できる必要がありますか？
```

## Q4. Primary Action

```text
次に取るべき主要Actionは何ですか？
```

Actionの実行条件はSPECへ確認する。

## Q5. Result Feedback

```text
操作後、何が起きたと分かれば安心できますか？
```

## Q6. Loading

```text
処理中、何を待っているか、操作してよいかをどう伝えますか？
```

## Q7. Empty

```text
対象がない場合、単に空にするのではなく、何を意味し、次に何ができますか？
```

## Q8. Error and Recovery

```text
失敗した場合、理由・影響・次Actionのうち何を伝える必要がありますか？
```

## Q9. Permission / Disabled / Unavailable

```text
権限がない、条件未達、未設定、Service停止をどう区別しますか？
```

## Q10. Cancel / Undo / Retry

```text
利用者は取り消し、やり直し、再試行できますか？
UI上でどう理解できますか？
```

## Q11. Accessibility and Variant

```text
色以外で区別する必要はありますか？
Keyboard、Screen Reader、狭い画面、Brand差分で何が変わりますか？
```

---

# 6. Adaptive Branches

## Behavior Unknown

UIはDraftとして作成し、次をOpen Questionへ出す。

```text
Trigger
Permission
Failure
Retry
Persistence
```

SPEC Skillと並行する。

## Too Many Information Items

```text
この場面で判断に直接必要な情報はどれですか？
参照できればよい情報はどれですか？
```

Visual Hierarchyへ変換する。

## Multiple Primary Actions

```text
最も頻度または価値が高いAction
不可逆なAction
例外的なAction
```

を分ける。

## AI Proposal UI

必ず状態を分離する。

```text
AI Draft
Human Accepted
Execution Requested
Executed
Verified
```

## Destructive Action

次を確認する。

```text
Confirmation
Impact Preview
Undo
Permission
Audit
```

## Figma Existing

Figmaを見た目のEvidenceとして参照し、UI Contractとの不足を抽出する。

```text
FigmaにあるがContractにない
ContractにあるがFigmaにない
```

---

# 7. Professional Output

Projectの正本UI Artifactへ以下を生成する。物理的なファイル構成は`00_30_Product_Documentation.md`の配置例を利用してよい。

```text
UI ID
Use Case / User Action
Purpose
Preserved UX Intent
IA Object / Responsibility
First Recognition
Information Priority
Decision Evidence
Primary / Secondary Action
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
Variant
Figma / Prototype Reference
pairs_with SPEC
Open Question
Coverage Summary
Open Gap
```

---

# 8. Quality Check

## Good UI Contract

```text
利用者はTopic Card内で、
重要度、重要と判断した理由、Source Evidence、
次に必要なActionを同じ視野で確認できる。
```

## Weak: Appearance Only

```text
Cardは角丸で、重要度を赤く表示する。
```

## Weak: Behavior Leakage

```text
重要TopicはAIが自動的に承認する。
```

Business Ruleと人間AuthorityをUI側で決めている。

## Weak: Screenshot Only

Figma Frameがあっても、Loading、Error、Permission、Feedbackが不明ならUI Contractは未完了。

---

# 9. UI Contract / Behavior Specification Pair Review

UI Skill終了前に、SPECがある場合は次を照合する。

| UI | Behavior |
|---|---|
| Action | Trigger |
| Visible prerequisite | Precondition |
| Loading | Processing State |
| Success Feedback | Success Result |
| Error Message | Failure / Exception |
| Disabled / Permission | Authority / Rule |
| Retry | Recovery Rule |
| Undo | Reversal Rule |

同じ構文で書く必要はない。

同じUse Case／User Actionに対する意味の整合を確認する。

---

# 10. Human Review

AIは次を提示する。

```text
UIで最も優先する情報:
重要度ではなく、重要と判断した理由と根拠。

主要Action:
人間が採用・保留・却下を判断する。

UIでは決めないこと:
重要度算出Rule、再試行上限、権限Rule。

不足:
SPEC側でCancellation Behaviorが未定義。
```

---

# 11. Subagent Execution

画面範囲が広い、状態設計が多い、またはUI一貫性・Usability・Accessibilityの独立Reviewが必要な場合、Parent Agentは `00_50_Subagent_Orchestration.md` に従って限定ScopeのSubagentへ委譲してよい。

分離可能な観点:

```text
Screen Inventory / Coverage
Wireframe
UI Contract
Design Token / Component
Usability Review
Accessibility Review
```

SubagentはUI Proposal、Coverage Gap、Behavior Conflict、Accessibility Risk、Open Questionを返す。UI Contractの統合、Behavior Pair Review、正本文書更新はParent Agentが行う。

---

# 12. Stop / Reject / Escalate

## Stop

```text
IA責務が曖昧
UIと既存SPECが重大に矛盾
重要ActionのAuthorityが不明
```

## Reject

```text
UI側でBusiness Ruleを創作
Screenshotだけで完了扱い
```

## Escalate

```text
UX Trade-off
IA責務変更
Behavior Rule
Permission
不可逆Action
```

---

# 13. Exit Criteria

[Phase Gate Criteria](#phase-gate-criteria)を満たし、Coverage Stateと人間判断を記録したときにだけ、対象Scopeについて完了と表現できる。
