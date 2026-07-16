# CRDD Workflow

Version: v0.4.0
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-17
Related:
- [00_01_Principles.md](00_01_Principles.md)
- [00_02_Terminology.md](00_02_Terminology.md)
- [00_03_Documentation.md](00_03_Documentation.md)
- [00_10_Agent.md](00_10_Agent.md)
- [00_11_Skill.md](00_11_Skill.md)
- [00_12_Change.md](00_12_Change.md)
- [00_13_Release.md](00_13_Release.md)

---

# 1. Purpose and Boundary

本書は、`07_Workflows`へ置くRepository内の作業フロー文書の責務を定義する。

Workflowは、このRepositoryで反復して行う作業の順序、入力、実行条件、確認、停止、引き渡しを示すOperational Guideである。Product Context、Change Trace、Release Record、Code、Agent / Skillの共通規範を置き換えない。

---

# 2. What Belongs in `07_Workflows`

次のようなRepository固有の作業フローを置ける。

```text
文書更新とReviewの進め方
Stable Context ID採番のRepository固有手順
Auditの実行順序と結果の引き渡し
Release準備で使用するRepository固有手順
Migration、生成、同期、公開のRunbook
複数ToolまたはRoleを接続する反復可能な作業手順
```

次は置かない。

```text
Requirement、UX、IA、UI、SPEC、Architectureの正本
CHG-* Change Trace
Release RecordまたはRelease CHANGELOG
実装CodeやTest Code
一時的な個人メモ、日報、完了済みTask一覧
Agent / Skill全体へ適用する共通規範
```

Workflow実行によって生じた製品変更は`90_Release/Changes/CHG-*.md`へ、確定した設計結果は該当Canonical Artifactへ、Release結果は`90_Release`へ戻す。

---

# 3. Placement and Naming

```text
07_Workflows/
├─ 01_Document_Review.md
├─ 02_Release_Preparation.md
└─ Evidence/
```

Workflow文書はRepository内の検索・表示用Document Numberを使用してよい。`CHG-*`、REQ、UX、IA、UI、SPECのIDをファイル名として流用しない。WorkflowにCRDD Stable Context IDは付与しない。

Workflow固有の実行根拠が必要な場合は最も近い`Evidence/`へ置く。実行のたびに恒久的なLogをMarkdownで増やすことは要求しない。CI Log、Issue、Pull Request、CHG、Release Record等の適切なArtifactを参照する。

---

# 4. Workflow Contract

Workflow文書は、必要な粒度で次を取得可能にする。

```text
Purpose
Trigger / When to Run
Scope / Non-goal
Required Input and Authority
Roles / Human Decision Point
Ordered Steps
Validation / Expected Result
Stop / Failure / Rollback Condition
Output and Handoff Destination
Related Agent / Skill / Tool
```

工程固有のEntry、Transformation、Exit、GateをWorkflowへ再定義しない。工程文書を参照し、Repository固有の実行順序とAdapterだけを記載する。

Agentへ実行させる場合も、Authority、許可Action、停止条件、期待Outputは[Agent](00_10_Agent.md)に従う。Guided Skillとして実装する場合は[Skill](00_11_Skill.md)に従い、Workflow本文へRuntime Lifecycleを複製しない。

---

# 5. Lifecycle

Workflowは作業方法が変わった時に更新する。個別変更の完了を理由にWorkflowをClosedへしない。

```text
Draft → Active → Deprecated → Retired
```

実際のRepository運用と一致しないWorkflowはActiveのまま放置せず、更新、Deprecated、Retiredのいずれかにする。後継がある場合はLinkする。

---

# 6. Anti-patterns and Audit

```text
個別FeatureのTask Listを恒久Workflowにする
CHGと同じ影響TraceをWorkflowへ記録する
工程正本やAgent / Skill規範をCopyする
実行結果を正本へ戻さずWorkflow内だけに残す
Trigger、停止条件、Outputのない手順一覧にする
```

Auditでは、Repository固有の反復手順であること、参照Authorityが明確であること、結果のHandoff先があること、他の正本と責務が重複していないことを確認する。

---

# 7. Final Principle

Workflowは何を決めたかを保存する正本ではない。

このRepositoryで、誰またはどのAgentが、どのAuthorityを参照し、どの順序で作業し、どこへ結果を返すかを再現可能にする実行ガイドである。
