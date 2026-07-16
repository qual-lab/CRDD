# 00_CRDD Overview

Version: v0.3.1
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-16
Related:
- [00_01_CRDD_Principles.md](00_01_CRDD_Principles.md)
- [00_02_CRDD_Core_Concepts_and_Terminology.md](00_02_CRDD_Core_Concepts_and_Terminology.md)
- [00_03_CRDD_Conformance.md](00_03_CRDD_Conformance.md)

---

# Purpose

このフォルダは、プロダクト開発における CRDD（Context Repository-Driven Development）の思想、原則、運用ルールを管理する。

CRDDは、AI時代において人間のアイディアと判断を劣化させず、Context Repositoryとして蓄積し、AIがその文脈を参照しながら開発を支援するための開発思想である。

プロダクトのGitリポジトリは、単なる設計資料置き場ではない。
プロダクトのWhy、思想、判断、設計、実装、根拠、ロードマップを接続する Context Repository として扱う。

---

# CRDDの基本信条

```text
作業をAIへ。
判断を人間へ。
思想をContext Repositoryへ。
```

AIは、実装、テスト、整理、要約、比較、提案を支援する。
人間は、意味づけ、判断、承認、優先順位、進行制御を担う。

CRDDの目的は、AIで人間を置き換えることではない。
人間が市場理解、次のアイディア、重要判断、価値創出に集中できるようにすることである。

CRDDはUXの5層だけで製品が完成するとは考えない。
Persona・Journey・Service Blueprintから、IA、UI、Graphic／Visual、SPEC、Architecture、Implementation、Verificationまでを接続し、思いを動く製品へ変換する。

---

# このフォルダの位置づけ

`00_CRDD` は、リポジトリ全体のメタ原則を定義する。

```text
00_CRDD        = 開発思想・Repository運用の憲法
01_Discovery   = 課題発見・要求候補の受け皿
02_UX          = Persona・Journey・Service Blueprint・体験原則
03_IA          = Blueprintを受けた情報構造・Object・責務・Navigation
04_Spec        = 機能仕様・振る舞い・受け入れ条件
05_UI          = Wireframe・Screen Flow・UI Contract・Design Token・Graphic／Visual・素材
06_Architecture = システム構造・データ・API・AI・セキュリティ
07_Workflows   = 開発・検証・リリースの進め方
40_Develop     = Code・Configuration・Test等のImplementation Artifact
90_Release     = Release Record・配布物・Release Verification
99_Roadmap     = 未来計画
```

Evidenceは成果物内、または最も近い親Folderの`Evidence/`へ置く。Decisionの結果はCanonical Artifactへ反映し、理由、Evidence、代替案、経緯を同じ成果物へ残す。Root直下へEvidence / Decisionの中央Folderを基本構成として作らない。

`00_CRDD` は、特定プロダクト固有のUX思想そのものではない（プロダクトの思想は `02_UX` に置く）。フォルダ構成の詳細・V2移行ルール・各フォルダの正本性は[`00_10_Context_Repository.md`](00_10_Context_Repository.md)を参照する。

---

# 管理する内容

このフォルダでは、主に以下を管理する。

```text
CRDDの思想
Context Repositoryの運用原則
AIと人間の役割分担
AIに編集させてよい範囲
AIに破壊させないためのルール
成果物内のDecision / Rationale記録ルール
Evidenceの昇格ルール
AIが読みやすいMarkdown記述ルール
```

---

# ファイル構成

`00_CRDD`は、性質の異なる6つの層で構成する。採番帯（10刻み）そのものが層を表す。

この採番はCRDD文書の分類と順序を示すDocument Numberであり、文書内のContext Entityを追跡する安定IDではない。一つのCRDD文書に複数の安定IDが含まれてよい。

```text
00-09  CRDDの全体定義（Overview / Principles / Terminology / Conformance）
10-19  必須のCore標準（CRDDと名乗るために満たす規範）
20-29  CRDD自身の運用・保守
30-39  実践ガイド（Practice Guide。推奨知見だが必須要件ではない）
40-49  Git / Markdown Skill Execution（Git / MarkdownでSkillを再現実行するための実行定義）
50-59  Agent Execution（Subagentや監査Agentの委譲・統合定義）
```

```text
00_CRDD/
├─ 00_00_CRDD_Overview.md
├─ 00_01_CRDD_Principles.md
├─ 00_02_CRDD_Core_Concepts_and_Terminology.md
├─ 00_03_CRDD_Conformance.md
├─ 00_04_CRDD_End_to_End_Context_Continuity.md
├─ 00_05_CRDD_Development_Stack.md
│
├─ 00_10_Context_Repository.md
├─ 00_11_Information_Provenance.md
├─ 00_12_Decision_Rationale.md
├─ 00_13_Human_AI_Responsibility.md
├─ 00_14_AI_Change_Control.md
├─ 00_15_Document.md
├─ 00_16_Context_Transformation.md
├─ 00_17_Discovery.md
├─ 00_18_UI_Behavior_Specification.md
├─ 00_19_Context_Traceability.md
│
├─ 00_20_CRDD_Maintenance.md
├─ 00_23_Phase_Gate_Approval.md
├─ 00_24_Change_Context_Package.md
├─ 00_25_Gap_Validation_Impact.md
├─ 00_26_Agent_IO_Contract.md
├─ 00_27_Guided_Context_Creation.md
│
├─ 00_30_Product_Documentation.md
├─ 00_31_Subagent_Practice.md
├─ 00_32_Testing_Quality.md
├─ 00_33_AI_Governance_Security.md
├─ 00_34_Compatibility_Evolution.md
├─ 00_35_Architecture_Integration.md
│
├─ 00_40_Guided_Skill_Runtime.md
├─ 00_41_Discovery_Skill.md
├─ 00_42_UX_Skill.md
├─ 00_43_IA_Skill.md
├─ 00_44_UI_Skill.md
├─ 00_45_Behavior_Specification_Skill.md
├─ 00_46_Git_Markdown_Execution.md
├─ 00_50_Subagent_Orchestration.md
└─ 00_51_Document_Audit_Agent.md
```

---

# 各ファイルの責務

| File | Responsibility |
|---|---|
| `00_00_CRDD_Overview.md` | `00_CRDD` フォルダの目的・全体像・読む順番 |
| `00_01_CRDD_Principles.md` | CRDDの基本信条・原則・価値観 |
| `00_02_CRDD_Core_Concepts_and_Terminology.md` | CRDDのCore Concept・用語・責務・Authorityの正本 |
| `00_03_CRDD_Conformance.md` | CRDDを名乗るための準拠条件 |
| `00_04_CRDD_End_to_End_Context_Continuity.md` | 上流の思いをUX・IA・UI・SPEC・Architecture・Implementation・Verificationへ一気通貫で接続する基本思想 |
| `00_05_CRDD_Development_Stack.md` | CRDDのDevelopment Stack全体定義（Discovery〜Learning）、Layer Mapping、最低成果物、品質基準、AI/人間の役割分担 |
| `00_10_Context_Repository.md` | Repository構造・正本・保存対象・Header/Status/Naming/Link・更新・廃止 |
| `00_11_Information_Provenance.md` | Evidence Promotion・Decision Rule・文書Type・Roadmap Absorption・Feature Adoption |
| `00_12_Decision_Rationale.md` | 判断結果を成果物へ反映し、理由・Evidence・経緯を残す方法 |
| `00_13_Human_AI_Responsibility.md` | 人間とAIの役割分担 |
| `00_14_AI_Change_Control.md` | AIが編集してよい領域・してはいけない領域 |
| `00_15_Document.md` | 人間とAIが誤読しない文章構造の書き方 |
| `00_16_Context_Transformation.md` | 原点・課題・UX・IA・UI・SPEC・Architecture・Implementation・Verificationを意味を失わず接続する規範 |
| `00_17_Discovery.md` | 未整理の思い・困りごと・観察・既存資料等をCRDDで扱えるContextへ変換するDiscovery規範 |
| `00_18_UI_Behavior_Specification.md` | UI ContractとBehavior Specificationを対として定義・Reviewする規範 |
| `00_19_Context_Traceability.md` | Contextの識別・関連づけ・変更追跡・影響分析の標準 |
| `00_20_CRDD_Maintenance.md` | Feedback Loop、Repository Audit、CRDD Change / Versioningを含むCRDD自身の保守運用 |
| `00_23_Phase_Gate_Approval.md` | 共通Gate状態・承認権限・Evidence・再開・Routing。工程固有条件は各Phase Process Contractを参照 |
| `00_24_Change_Context_Package.md` | Change Package・Context Packageの責務・構造・Lifecycle・承認・分割・統合・検証・終了条件 |
| `00_25_Gap_Validation_Impact.md` | Cross-layer Gap ValidationとImpact Analysisの目的・検査範囲・判定方法・責任・記録・終了条件 |
| `00_26_Agent_IO_Contract.md` | AI Agent・人間の専門担当が作業する際のInput/Output/Authority/停止条件/拒否条件/Review条件 |
| `00_27_Guided_Context_Creation.md` | 非専門家との共通対話・確認・Routing標準。工程固有条件は各Phase Process Contractを参照 |
| `CHANGELOG.md` | CRDD文書体系そのものの変更履歴 |
| `00_30_Product_Documentation.md` | Product Artifactの責務と推奨配置・統合・分割例。工程完了条件は定義しない |
| `00_31_Subagent_Practice.md` | サブエージェント構成の参考モデル（任意） |
| `00_32_Testing_Quality.md` | テスト・品質保証・非機能要件の実践知見 |
| `00_33_AI_Governance_Security.md` | AI Governance・セキュリティ・透明性の実践知見 |
| `00_34_Compatibility_Evolution.md` | API・スキーマ・依存関係を安全に進化させる実践知見 |
| `00_35_Architecture_Integration.md` | Architecture工程のEntry・変換・Coverage・Exit・Gate・Auditと実践規約 |
| `00_40_Guided_Skill_Runtime.md` | Guided Skillの開始・中断・再開・確認・保存・Handoffを一貫実行する共通Runtime |
| `00_41_Discovery_Skill.md` | 原始的な思い・違和感・課題・観察をDiscovery Contextへ変換するGuided Skill |
| `00_42_UX_Skill.md` | UX工程のEntry・変換・責務Coverage・Exit・Gate・AuditとGuided Skill |
| `00_43_IA_Skill.md` | IA工程のEntry・変換・責務Coverage・Exit・Gate・AuditとGuided Skill |
| `00_44_UI_Skill.md` | UI工程のEntry・変換・責務Coverage・Exit・Gate・AuditとGuided Skill |
| `00_45_Behavior_Specification_Skill.md` | SPEC工程のEntry・変換・責務Coverage・Exit・Gate・AuditとGuided Skill |
| `00_46_Git_Markdown_Execution.md` | Claude Code／CodexでSkillを再現実行するための最小実行、Registry、Package / Promotion運用 |
| `00_50_Subagent_Orchestration.md` | Guided Skill内でSubagentを安全に委譲・統合する軽量Guide |
| `00_51_Document_Audit_Agent.md` | 共通Audit実行・Finding・SeverityのGuide。工程監査は各Phase Audit Checklistを参照 |

---

# 新規参加者の読む順番

新しくプロジェクトに参加した人間（またはAI）は、以下の順に読むことを推奨する。

```text
1. 00_CRDD（この階層）
   00_00_CRDD_Overview → 00_01_CRDD_Principles → 00_13_Human_AI_Responsibility
   （必要に応じて00_10〜00_35も参照）

2. 01_Discovery
   プロダクトが解こうとしている課題

3. 02_UX
   Persona・Journey Map・Service Blueprint・体験原則

4. 03_IA
   Blueprintを情報構造・Object・責務・Navigationへ変換

5. 04_Spec / 05_UI
   Behavior Specificationと、Wireframe・Screen Flow・Graphic／Visualを対で設計

6. 06_Architecture
   技術構造・Data・API・AI・Security

7. 07_Workflows
   日々の開発の進め方


8. 99_Roadmap
   現在地と今後の計画
```

`40_Develop`はCode、Configuration、Test等のImplementation Artifactであり、CRDD管理用Markdownの配置先にはしない。思想や設計を理解した後に、現在の実装事実を確認するため必要に応じて参照する。

---

# CRDDで重視すること

CRDDでは、単にドキュメントを残すだけでは不十分である。

重要なのは、以下をAIと人間が読み返せる形で残すことである。

```text
なぜ作るのか
誰の何を解決するのか
どんな困りごとがあるのか
どんなリスクがあるのか
どんな思いがあるのか
なぜその判断をしたのか
なぜ別案を採用しなかったのか
方針変更の理由は何か
```

これらが残っていれば、AIは後からContext Repositoryを参照し、商品性、ロードマップ、実装すべき機能、差別化、次の判断を支援できる。

---

AIと人間の役割の詳細な分担、既存タスク管理ツールとの関係（Context Repository = 正本 / タスク管理ツール = View）は[`00_01_CRDD_Principles.md`](00_01_CRDD_Principles.md)（6〜9節）を参照する。

CRDDにおける「完了条件（Working Software + Readable Context + Traceable Decision）」は[`00_03_CRDD_Conformance.md`](00_03_CRDD_Conformance.md)を参照する。

## 40-49: Git / Markdown Skill Execution

| File | Responsibility |
|---|---|
| `00_40_Guided_Skill_Runtime.md` | Guided Skill共通Lifecycleと中断・再開の参考モデル |
| `00_41_Discovery_Skill.md` | Discovery Skill定義 |
| `00_42_UX_Skill.md` | UX Skill定義 |
| `00_43_IA_Skill.md` | IA Skill定義 |
| `00_44_UI_Skill.md` | UI Skill定義 |
| `00_45_Behavior_Specification_Skill.md` | Behavior Specification Skill定義 |
| `00_46_Git_Markdown_Execution.md` | Claude Code／CodexでSkillを再現実行するための最小実行、Registry、Package / Promotion運用 |

## 50-59: Agent Execution

| File | Responsibility |
|---|---|
| `00_50_Subagent_Orchestration.md` | Guided Skill内でSubagentを安全に委譲・統合する軽量Guide |
| `00_51_Document_Audit_Agent.md` | CRDD文書体系・参照・用語・Traceabilityを監査するDocument Audit AgentのGuide |
