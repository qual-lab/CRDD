# UX-000005 目的と受入条件でMilestoneを委ねる

成果物種別: UX Definition
UX ID: `UX-000005`
状態: Canonical
維持責任者: Qual-Lab

## 利用者成果

内部Taskを逐次操作せず、目的・受入条件・統合状態からMilestoneの完成と必要な判断を理解できる

```text
Project Operator／PM
        │ Projectの成果をまとめて任せる時
        ▼
Objectiveと受入条件でMilestoneを委ねる
        │
        ▼
内部Taskを追わず統合済みの完成を判断できる
```

## 利用者・状況・Goal

| 項目 | 内容 |
|---|---|
| Primary Persona／Context | [Product横断の利用者像](../../02_Personas.md)の「Project Operator／PM」 |
| Trigger／Situation | Projectの成果をまとめて任せる時 |
| Goal | Objectiveと受入条件でMilestoneを委ねる |
| Outcome | 内部Taskを追わず統合済みの完成を判断できる |

## 成立条件

- 内部Taskを逐次操作せず、目的・受入条件・統合状態からMilestoneの完成と必要な判断を理解できる
- 重要場面「Task成功とMilestone完成を区別する」で、避ける失敗を利用者が正常状態や完了として誤認しない。
- 入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。

## 重要な体験と品質期待

```text
Projectの成果をまとめて任せる時
        ↓
Objectiveと受入条件でMilestoneを委ねる
        │
        ├─ ★ Critical: Task成功とMilestone完成を区別する
        ├─ ⚠ Failure:  Task件数を完成と誤認する
        └─ ✓ Quality:  統合・品質・判断待ちを分けて示す
        ↓
内部Taskを追わず統合済みの完成を判断できる
```

## 必要な情報

Objective、Acceptance、Milestone、Task、Integration、Qualityを関連付ける

## 制約

- 画面、Transport、内部Componentまたは特定の実装方式をUX成果そのものにしない。
- 下流工程は利用者成果を弱めず、情報構造、操作、振る舞いおよび実現方式へ具体化する。
- 想定した利用者、状況またはGoalが誤っていると判明した場合は、Source AnalysisとDiscoveryへ戻す。

## 検証意図

Task数や部分成功を完成へ畳む表示を反証する

具体的なTest Level、Scenarioおよび期待結果はQualityで設計し、このDefinitionには実行結果を書き込まない。

## 下流への引き渡し

IAはObjective、Milestone、Task、Integration、QualityおよびDecisionの関係を分ける。SPECとArchitectureは各状態の成立条件と再開契約を具体化し、総合試験はTask数でなく一連の委任体験を確認する。

## 関係

- Source REQ Analysis: [REQ-000003](../../Analysis/REQ-000003/ux_analysis.md)
- Cross-cutting Synthesis: [Personas](../../02_Personas.md)、[Experience Map](../../03_Experience_Map.md)、[Service Blueprint](../../04_Service_Blueprint.md)、[Quality Expectations](../../05_Quality_Expectations.md)

