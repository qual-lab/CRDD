# 00_CRDD Overview

Version: v0.1.0
Status: Stable
Owner: Shared
Last Updated: 2026-07-15
Related:
- [00_01_CRDD_Principles.md](00_01_CRDD_Principles.md)
- [00_02_CRDD_Terminology.md](00_02_CRDD_Terminology.md)
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

---

# このフォルダの位置づけ

`00_CRDD` は、リポジトリ全体のメタ原則を定義する。

```text
00_CRDD        = 開発思想・Repository運用の憲法
01_Discovery   = 課題発見・要求候補の受け皿
02_UX          = プロダクトの原点・思想・体験設計
03_IA          = 情報構造・画面責務・ナビゲーション
04_Spec        = 機能仕様・振る舞い・受け入れ条件
05_UI          = UI表示・操作・文言・画面別仕様
06_Architecture = システム構造・データ・API・AI・セキュリティ
07_Workflows   = 開発・検証・リリースの進め方
40_Develop     = 実装・検証
80_PR          = 外部向け資料
90_Evidence    = 根拠資料
90_Release     = リリース判断の記録・根拠資料
95_Decisions   = 判断履歴
99_Roadmap     = 未来計画
```

`00_CRDD` は、特定プロダクト固有のUX思想そのものではない（プロダクトの思想は `02_UX` に置く）。フォルダ構成の詳細・V2移行ルール・各フォルダの正本性は[`00_10_Context_Repository_Standard.md`](00_10_Context_Repository_Standard.md)を参照する。

---

# 管理する内容

このフォルダでは、主に以下を管理する。

```text
CRDDの思想
Context Repositoryの運用原則
AIと人間の役割分担
AIに編集させてよい範囲
AIに破壊させないためのルール
Decision Logの記録ルール
Evidenceの昇格ルール
AIが読みやすいMarkdown記述ルール
```

---

# ファイル構成

`00_CRDD`は、性質の異なる4層＋付録で構成する。採番帯（10刻み）そのものが層を表す。

```text
00-09  CRDDの全体定義（Overview / Principles / Terminology / Conformance）
10-19  必須のCore標準（CRDDと名乗るために満たす規範）
20-29  CRDD自身の運用・保守
30-39  実践ガイド（Practice Guide。推奨知見だが必須要件ではない）
```

```text
00_CRDD/
├─ 00_00_CRDD_Overview.md
├─ 00_01_CRDD_Principles.md
├─ 00_02_CRDD_Terminology.md
├─ 00_03_CRDD_Conformance.md
│
├─ 00_10_Context_Repository_Standard.md
├─ 00_11_Information_Type_and_Provenance.md
├─ 00_12_Decision_Record_Standard.md
├─ 00_13_Human_AI_Responsibility.md
├─ 00_14_AI_Change_Control.md
├─ 00_15_Document_Standard.md
│
├─ 00_20_Context_Feedback_Loop.md
├─ 00_21_Context_Repository_Audit.md
├─ 00_22_CRDD_Change_and_Versioning.md
│
├─ 00_30_Product_Documentation_Guide.md
├─ 00_31_Subagent_Practice_Guide.md
├─ 00_32_Testing_and_Quality_Guide.md
├─ 00_33_AI_Governance_and_Security_Guide.md
├─ 00_34_Compatibility_and_Evolution_Guide.md
└─ 00_35_Architecture_and_Integration_Guide.md
```

---

# 各ファイルの責務

| File | Responsibility |
|---|---|
| `00_00_CRDD_Overview.md` | `00_CRDD` フォルダの目的・全体像・読む順番 |
| `00_01_CRDD_Principles.md` | CRDDの基本信条・原則・価値観 |
| `00_02_CRDD_Terminology.md` | CRDD固有の用語を固定するGlossary（Experimental） |
| `00_03_CRDD_Conformance.md` | CRDDを名乗るための準拠条件（Experimental） |
| `00_10_Context_Repository_Standard.md` | Repository構造・正本・保存対象・Header/Status/Naming/Link・更新・廃止 |
| `00_11_Information_Type_and_Provenance.md` | Evidence Promotion・Decision Rule・文書Type・Roadmap Absorption・Feature Adoption |
| `00_12_Decision_Record_Standard.md` | 判断履歴の残し方（Decision Log） |
| `00_13_Human_AI_Responsibility.md` | 人間とAIの役割分担 |
| `00_14_AI_Change_Control.md` | AIが編集してよい領域・してはいけない領域 |
| `00_15_Document_Standard.md` | 人間とAIが誤読しない文章構造の書き方 |
| `00_20_Context_Feedback_Loop.md` | プロダクト側の知見をCRDDへ還元するプロセス |
| `00_21_Context_Repository_Audit.md` | ドキュメントと実態のズレを検出する監査原則 |
| `00_22_CRDD_Change_and_Versioning.md` | CRDD自身の変更・バージョニング方針（Experimental） |
| `00_30_Product_Documentation_Guide.md` | 新規プロダクトのUX/IA/Spec/UI/Architecture/Workflows/Release体系と最小構成 |
| `00_31_Subagent_Practice_Guide.md` | サブエージェント構成の参考モデル（任意） |
| `00_32_Testing_and_Quality_Guide.md` | テスト・品質保証・非機能要件の実践知見 |
| `00_33_AI_Governance_and_Security_Guide.md` | AI Governance・セキュリティ・透明性の実践知見 |
| `00_34_Compatibility_and_Evolution_Guide.md` | API・スキーマ・依存関係を安全に進化させる実践知見 |
| `00_35_Architecture_and_Integration_Guide.md` | 設計表現規約・結合観点・同時実行/輻輳への備え |

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
   プロダクトのWhy・思想・体験設計

4. 03_IA 〜 06_Architecture
   情報構造・仕様・UI表示・技術設計

5. 07_Workflows
   日々の開発の進め方

6. 99_Roadmap
   現在地と今後の計画
```

`40_Develop`は実装・検証の詳細であり、思想や設計を理解した後に必要に応じて参照する。

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
