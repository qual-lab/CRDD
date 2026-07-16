# CRDD

**Context Repository-Driven Development**

```text
作業をAIへ。判断を人間へ。思想をContext Repositoryへ。
Work to AI. Judgment to humans. Thought to the Context Repository.
```

Status: **v0.3.0 — Stable ID and Behavior Specification clarification release.** / **v0.3.0 — 安定IDとBehavior Specificationの明確化版。**
See [CHANGELOG.md](CHANGELOG.md).

**[English](#english)** | **[日本語](#日本語)**

---

## English

CRDD is a development methodology for the AI era. It keeps a product's Why, ideas, decisions, risks, and design intent in a human- and AI-readable Context Repository, so AI can reference that context to support specification, implementation, testing, and organization — while humans keep meaning, judgment, and responsibility.

The Core Standard, conformance criteria, Core Concepts/Terminology, and the minimum CRDD change/versioning rules are available.

### What is CRDD?

Most AI-assisted development speeds up implementation but lets a product's Why — the reasoning behind decisions, the alternatives it rejected, the risks it accepted — quietly decay in chat logs and pull request descriptions.

CRDD treats the Git repository itself as the Context Repository: the canonical, versioned, human-and-AI-readable record of why a product exists, what it decided, and what it's trying to become. AI is a capable collaborator inside that repository — it drafts, organizes, implements, and verifies — but it does not decide. Humans give meaning, set priorities, and own the outcome.

Read [`00_01_CRDD_Principles.md`](00_01_CRDD_Principles.md) for the full principles, or [`00_00_CRDD_Overview.md`](00_00_CRDD_Overview.md) for the complete map of this folder.

### Quick Start

1. Read [`00_00_CRDD_Overview.md`](00_00_CRDD_Overview.md), then [`00_01_CRDD_Principles.md`](00_01_CRDD_Principles.md).
2. Read the Core Standard documents you need (`00_10`–`00_19`) — these describe the current Core Standard. Conformance criteria are defined in [`00_03_CRDD_Conformance.md`](00_03_CRDD_Conformance.md).
3. Copy the [`template`](template) scaffold or adopt the folder structure described in [`00_30_Product_Documentation.md`](00_30_Product_Documentation.md). Place the CRDD standard documents in `00_CRDD/` when using the scaffold in another repository.
4. Point your AI coding assistant (Claude Code, Codex, or similar) at this folder as required reading before non-trivial changes.
5. For Git / Markdown execution, keep `CLAUDE.md` / `AGENTS.md` at the repository root, prepare the required Markdown Package / Registry documents, and follow [`00_46_Git_Markdown_Execution.md`](00_46_Git_Markdown_Execution.md).

CRDD does not require any specific AI tool, subagent architecture, or tech stack. The Practice Guides (`00_30`–`00_35`) are optional, reusable patterns — not requirements.

### Repository Structure

`00_CRDD` is organized into six layers by numbering band; the band itself signals the layer.

These document numbers organize files; they are separate from stable IDs assigned to Context entities inside documents.

Store Evidence inline or under the nearest parent folder's `Evidence/`. A decision's result is the approved canonical artifact; keep its rationale, evidence, alternatives, and history in that artifact. Do not use root-level Evidence or Decision folders as the default model. Standard Stable IDs are limited to `REQ`, `UX`, `IA`, `UI`, and `SPEC`. `40_Develop` is for implementation artifacts rather than CRDD management Markdown.

`01_Discovery` receives new evidence, uncertainty, and requirements. `99_Roadmap` schedules accepted but deferred work by referencing those requirements and other Stable Contexts; Roadmap items do not receive CRDD Stable IDs.

| Band | Layer | Meaning |
|---|---|---|
| `00`–`09` | Overview | What CRDD is, its principles, terminology, conformance |
| `10`–`19` | Core Standard | What a project must do to call itself CRDD |
| `20`–`29` | Operational | How CRDD itself is maintained and evolved |
| `30`–`39` | Practice Guide | Optional, reusable patterns and templates |
| `40`–`49` | Git / Markdown Skill Execution | Guided Skill definitions and Git / Markdown execution protocol |
| `50`–`59` | Agent Execution | Lightweight Subagent orchestration and document audit agent guidance |

See [`00_00_CRDD_Overview.md`](00_00_CRDD_Overview.md) for the full file list and each file's responsibility.

### Documentation

| Start here | For |
|---|---|
| [`00_00_CRDD_Overview.md`](00_00_CRDD_Overview.md) | The full map of this folder |
| [`00_01_CRDD_Principles.md`](00_01_CRDD_Principles.md) | Why CRDD exists, its core tenets |
| [`00_02_CRDD_Core_Concepts_and_Terminology.md`](00_02_CRDD_Core_Concepts_and_Terminology.md) | Canonical concepts, terminology, responsibility, authority, and lifecycle terms |
| [`00_03_CRDD_Conformance.md`](00_03_CRDD_Conformance.md) | What "CRDD-compliant" means |
| [`00_05_CRDD_Development_Stack.md`](00_05_CRDD_Development_Stack.md) | CRDD's development stack from Discovery to Learning |
| [`00_10_Context_Repository.md`](00_10_Context_Repository.md) | Repository structure, headers, naming, links |
| [`00_13_Human_AI_Responsibility.md`](00_13_Human_AI_Responsibility.md) | The human/AI role split |
| [`00_14_AI_Change_Control.md`](00_14_AI_Change_Control.md) | What AI may and may not edit unsupervised |
| [`00_30_Product_Documentation.md`](00_30_Product_Documentation.md) | Starter folder/file templates for a new product |
| [`00_46_Git_Markdown_Execution.md`](00_46_Git_Markdown_Execution.md) | Reproducible Claude Code / Codex execution using Git and Markdown |
| [`00_50_Subagent_Orchestration.md`](00_50_Subagent_Orchestration.md) | Lightweight Subagent delegation and Parent Agent integration rules |
| [`00_51_Document_Audit_Agent.md`](00_51_Document_Audit_Agent.md) | Document audit agent scope, findings, and CRDD repository audit contract |

### License

CRDD's documentation is licensed under [LICENSE](LICENSE) (CC BY-NC-SA 4.0, non-commercial use). For commercial use, see [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md). The names "CRDD," "Qual-Lab," and associated marks/logos are governed separately — see [TRADEMARK.md](TRADEMARK.md).

See [CHANGELOG.md](CHANGELOG.md) for release history.

---

## 日本語

CRDDは、AI時代のための開発方法論である。プロダクトのWhy、アイディア、判断、リスク、設計意図を、人間とAIが読み取れるContext Repositoryとして蓄積し、AIがその文脈を参照して仕様化・実装・テスト・整理を支援する。一方で、意味づけ・判断・責任は人間が持ち続ける。

Core標準・準拠条件・Core Concepts/Terminology・CRDD自身の変更/バージョニング最小ルールは公開済みです。

### CRDDとは？

多くのAI協働開発は実装速度を上げる一方で、プロダクトのWhy——判断の理由、却下した代替案、受け入れたリスク——をチャットログやPull Requestの説明文の中で静かに風化させてしまう。

CRDDは、Gitリポジトリそのものを Context Repository として扱う。プロダクトがなぜ存在し、何を決め、何を目指しているかを記録した、正本・バージョン管理された、人間とAIの双方が読める記録である。AIはそのリポジトリの中で有能な協働者として振る舞う——草案を作り、整理し、実装し、検証する——が、判断は下さない。意味を与え、優先順位を決め、結果に責任を持つのは人間である。

原則の全文は[`00_01_CRDD_Principles.md`](00_01_CRDD_Principles.md)、このフォルダ全体の地図は[`00_00_CRDD_Overview.md`](00_00_CRDD_Overview.md)を参照。

### クイックスタート

1. [`00_00_CRDD_Overview.md`](00_00_CRDD_Overview.md)を読み、次に[`00_01_CRDD_Principles.md`](00_01_CRDD_Principles.md)を読む。
2. 必要なCore標準文書（`00_10`〜`00_19`）を読む——これらは現時点のCore標準を記述したものである。準拠条件は[`00_03_CRDD_Conformance.md`](00_03_CRDD_Conformance.md)に定義されている。
3. [`template`](template)のscaffoldをコピーするか、[`00_30_Product_Documentation.md`](00_30_Product_Documentation.md)のフォルダ構成を採用する。別Repositoryでscaffoldを使う場合は、CRDD標準文書を`00_CRDD/`へ配置する。
4. 非自明な変更の前に、AIコーディングアシスタント（Claude Code、Codex等）へこのフォルダを必読資料として読み込ませる。
5. Git / Markdownで実行する場合は、Repository Rootの`CLAUDE.md` / `AGENTS.md`を入口にし、必要なMarkdown Package / Registry文書を用意したうえで、[`00_46_Git_Markdown_Execution.md`](00_46_Git_Markdown_Execution.md)に従う。

CRDDは特定のAIツール・Subagent構成・技術スタックを要求しない。Practice Guide（`00_30`〜`00_35`）は任意の再利用可能なパターンであり、必須要件ではない。

### リポジトリ構成

`00_CRDD`は採番帯によって6つの層に分かれており、採番帯そのものが層を表す。

この文書番号はファイルを整理するための採番であり、文書内のContext Entityへ付与する安定IDとは別の識別体系である。

Evidenceは成果物内、または最も近い親Folderの`Evidence/`へ置く。Decisionの結果は承認済みCanonical Artifactであり、理由、Evidence、代替案、経緯を同じ成果物へ残す。Root直下のEvidence / Decision Folderは基本モデルにしない。標準Stable IDは`REQ`、`UX`、`IA`、`UI`、`SPEC`の5種類に限定する。`40_Develop`はImplementation Artifactの領域であり、CRDD管理用Markdownの配置先にはしない。

`01_Discovery`は新しいEvidence、不確実性、Requirementの入口である。`99_Roadmap`は採用済みだが未着手の内容を、Requirementや他のStable Contextへの参照とともに計画する。Roadmap項目へCRDD Stable IDは付与しない。

| 採番帯 | 層 | 意味 |
|---|---|---|
| `00`〜`09` | Overview | CRDDとは何か、原則、用語、準拠条件 |
| `10`〜`19` | Core標準 | プロジェクトがCRDDを名乗るために満たすべきこと |
| `20`〜`29` | Operational | CRDD自身がどう維持・進化するか |
| `30`〜`39` | Practice Guide | 任意の再利用可能なパターン・テンプレート |
| `40`〜`49` | Git / Markdown Skill Execution | Guided Skill定義、Git / Markdown実行Protocol |
| `50`〜`59` | Agent Execution | 軽量Subagent Orchestration、文書監査Agent Guide |

全ファイル一覧と各ファイルの責務は[`00_00_CRDD_Overview.md`](00_00_CRDD_Overview.md)を参照。

### ドキュメント

| ここから読む | 内容 |
|---|---|
| [`00_00_CRDD_Overview.md`](00_00_CRDD_Overview.md) | このフォルダ全体の地図 |
| [`00_01_CRDD_Principles.md`](00_01_CRDD_Principles.md) | CRDDが存在する理由、基本信条 |
| [`00_02_CRDD_Core_Concepts_and_Terminology.md`](00_02_CRDD_Core_Concepts_and_Terminology.md) | Core Concept・用語・責務・Authority・Lifecycle用語の正本 |
| [`00_03_CRDD_Conformance.md`](00_03_CRDD_Conformance.md) | 「CRDD準拠」の意味 |
| [`00_05_CRDD_Development_Stack.md`](00_05_CRDD_Development_Stack.md) | DiscoveryからLearningまでのCRDD Development Stack |
| [`00_10_Context_Repository.md`](00_10_Context_Repository.md) | Repository構造、Header、命名、リンク |
| [`00_13_Human_AI_Responsibility.md`](00_13_Human_AI_Responsibility.md) | 人間とAIの役割分担 |
| [`00_14_AI_Change_Control.md`](00_14_AI_Change_Control.md) | AIが人間の確認なしに編集してよい範囲・してはいけない範囲 |
| [`00_30_Product_Documentation.md`](00_30_Product_Documentation.md) | 新規プロダクト向けフォルダ・ファイルテンプレート |
| [`00_46_Git_Markdown_Execution.md`](00_46_Git_Markdown_Execution.md) | Git / MarkdownのみでClaude Code／CodexへSkillを再現実行させる標準 |
| [`00_50_Subagent_Orchestration.md`](00_50_Subagent_Orchestration.md) | Guided Skill内でSubagentを安全に委譲・統合する軽量Guide |
| [`00_51_Document_Audit_Agent.md`](00_51_Document_Audit_Agent.md) | 文書監査AgentのScope、Finding、CRDD Repository監査Contract |

### ライセンス

CRDDの文書は[LICENSE](LICENSE)（CC BY-NC-SA 4.0、非商用利用）の下でライセンスされる。商用利用については[COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md)を参照。「CRDD」「Qual-Lab」の名称・関連する商標・ロゴは別途管理される——[TRADEMARK.md](TRADEMARK.md)を参照。

リリース履歴は[CHANGELOG.md](CHANGELOG.md)を参照。
