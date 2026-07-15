# CRDD

**Context Repository-Driven Development**

```text
作業をAIへ。判断を人間へ。思想をContext Repositoryへ。
Work to AI. Judgment to humans. Thought to the Context Repository.
```

Status: **v0.1.0 — Experimental first public release.** / **v0.1.0 — 初回公開（一部Experimental）。**
See [CHANGELOG.md](CHANGELOG.md).

**[English](#english)** | **[日本語](#日本語)**

---

## English

CRDD is a development methodology for the AI era. It keeps a product's Why, ideas, decisions, risks, and design intent in a human- and AI-readable Context Repository, so AI can reference that context to support specification, implementation, testing, and organization — while humans keep meaning, judgment, and responsibility.

The initial Core Standard is available, while conformance criteria, terminology, and several operational provisions remain experimental.

### What is CRDD?

Most AI-assisted development speeds up implementation but lets a product's Why — the reasoning behind decisions, the alternatives it rejected, the risks it accepted — quietly decay in chat logs and pull request descriptions.

CRDD treats the Git repository itself as the Context Repository: the canonical, versioned, human-and-AI-readable record of why a product exists, what it decided, and what it's trying to become. AI is a capable collaborator inside that repository — it drafts, organizes, implements, and verifies — but it does not decide. Humans give meaning, set priorities, and own the outcome.

Read [`00_01_CRDD_Principles.md`](00_01_CRDD_Principles.md) for the full principles, or [`00_00_CRDD_Overview.md`](00_00_CRDD_Overview.md) for the complete map of this folder.

### Quick Start

1. Read [`00_00_CRDD_Overview.md`](00_00_CRDD_Overview.md), then [`00_01_CRDD_Principles.md`](00_01_CRDD_Principles.md).
2. Read the Core Standard documents you need (`00_10`–`00_15`) — these describe the current Core Standard. Formal conformance criteria are still being defined in [`00_03_CRDD_Conformance.md`](00_03_CRDD_Conformance.md) (Experimental).
3. Adopt the folder structure described in [`00_30_Product_Documentation_Guide.md`](00_30_Product_Documentation_Guide.md) for your own product (`02_UX`, `03_IA`, `04_Spec`, `05_UI`, `06_Architecture`, `07_Workflows`, `90_Release`, ...).
4. Point your AI coding assistant (Claude Code, Codex, or similar) at this folder as required reading before non-trivial changes.

CRDD does not require any specific AI tool, subagent architecture, or tech stack. The Practice Guides (`00_30`–`00_35`) are optional, reusable patterns — not requirements.

### Repository Structure

`00_CRDD` is organized into four layers by numbering band; the band itself signals the layer.

| Band | Layer | Meaning |
|---|---|---|
| `00`–`09` | Overview | What CRDD is, its principles, terminology, conformance |
| `10`–`19` | Core Standard | What a project must do to call itself CRDD |
| `20`–`29` | Operational | How CRDD itself is maintained and evolved |
| `30`–`39` | Practice Guide | Optional, reusable patterns and templates |

See [`00_00_CRDD_Overview.md`](00_00_CRDD_Overview.md) for the full file list and each file's responsibility.

### Documentation

| Start here | For |
|---|---|
| [`00_00_CRDD_Overview.md`](00_00_CRDD_Overview.md) | The full map of this folder |
| [`00_01_CRDD_Principles.md`](00_01_CRDD_Principles.md) | Why CRDD exists, its core tenets |
| [`00_03_CRDD_Conformance.md`](00_03_CRDD_Conformance.md) | What "CRDD-compliant" means (Experimental — still being defined) |
| [`00_10_Context_Repository_Standard.md`](00_10_Context_Repository_Standard.md) | Repository structure, headers, naming, links |
| [`00_13_Human_AI_Responsibility.md`](00_13_Human_AI_Responsibility.md) | The human/AI role split |
| [`00_14_AI_Change_Control.md`](00_14_AI_Change_Control.md) | What AI may and may not edit unsupervised |
| [`00_30_Product_Documentation_Guide.md`](00_30_Product_Documentation_Guide.md) | Starter folder/file templates for a new product |

### License

CRDD's documentation is licensed under [LICENSE](LICENSE) (CC BY-NC-SA 4.0, non-commercial use). For commercial use, see [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md). The names "CRDD," "Qual-Lab," and associated marks/logos are governed separately — see [TRADEMARK.md](TRADEMARK.md).

### Roadmap

CRDD v0.1.0 defines the Core Standard and a first set of Practice Guides. Open items tracked for future releases:

- Finalize `00_02_CRDD_Terminology.md` (Glossary) and `00_03_CRDD_Conformance.md` (conformance levels)
- Finalize `00_22_CRDD_Change_and_Versioning.md`
- Folder-system provisions: mandatory/optional folder rules, cross-cutting document placement, document split/merge criteria, temporary-information lifecycle, external-file (non-Markdown) reference metadata, and repository-level secret/PII handling
- A consistent MUST/SHOULD/MAY normative-strength vocabulary applied across Core Standard documents

See [CHANGELOG.md](CHANGELOG.md) for release history.

---

## 日本語

CRDDは、AI時代のための開発方法論である。プロダクトのWhy、アイディア、判断、リスク、設計意図を、人間とAIが読み取れるContext Repositoryとして蓄積し、AIがその文脈を参照して仕様化・実装・テスト・整理を支援する。一方で、意味づけ・判断・責任は人間が持ち続ける。

初期Core標準は公開済みですが、準拠条件、用語定義、および一部の運用条項は引き続きExperimentalです。

### CRDDとは？

多くのAI協働開発は実装速度を上げる一方で、プロダクトのWhy——判断の理由、却下した代替案、受け入れたリスク——をチャットログやPull Requestの説明文の中で静かに風化させてしまう。

CRDDは、Gitリポジトリそのものを Context Repository として扱う。プロダクトがなぜ存在し、何を決め、何を目指しているかを記録した、正本・バージョン管理された、人間とAIの双方が読める記録である。AIはそのリポジトリの中で有能な協働者として振る舞う——草案を作り、整理し、実装し、検証する——が、判断は下さない。意味を与え、優先順位を決め、結果に責任を持つのは人間である。

原則の全文は[`00_01_CRDD_Principles.md`](00_01_CRDD_Principles.md)、このフォルダ全体の地図は[`00_00_CRDD_Overview.md`](00_00_CRDD_Overview.md)を参照。

### クイックスタート

1. [`00_00_CRDD_Overview.md`](00_00_CRDD_Overview.md)を読み、次に[`00_01_CRDD_Principles.md`](00_01_CRDD_Principles.md)を読む。
2. 必要なCore標準文書（`00_10`〜`00_15`）を読む——これらは現時点のCore標準を記述したものであり、正式な準拠条件は[`00_03_CRDD_Conformance.md`](00_03_CRDD_Conformance.md)（Experimental）でまだ策定中である。
3. 自分のプロダクト向けに、[`00_30_Product_Documentation_Guide.md`](00_30_Product_Documentation_Guide.md)に記載されたフォルダ構成（`02_UX`・`03_IA`・`04_Spec`・`05_UI`・`06_Architecture`・`07_Workflows`・`90_Release`等）を採用する。
4. 非自明な変更の前に、AIコーディングアシスタント（Claude Code、Codex等）へこのフォルダを必読資料として読み込ませる。

CRDDは特定のAIツール・Subagent構成・技術スタックを要求しない。Practice Guide（`00_30`〜`00_35`）は任意の再利用可能なパターンであり、必須要件ではない。

### リポジトリ構成

`00_CRDD`は採番帯によって4つの層に分かれており、採番帯そのものが層を表す。

| 採番帯 | 層 | 意味 |
|---|---|---|
| `00`〜`09` | Overview | CRDDとは何か、原則、用語、準拠条件 |
| `10`〜`19` | Core標準 | プロジェクトがCRDDを名乗るために満たすべきこと |
| `20`〜`29` | Operational | CRDD自身がどう維持・進化するか |
| `30`〜`39` | Practice Guide | 任意の再利用可能なパターン・テンプレート |

全ファイル一覧と各ファイルの責務は[`00_00_CRDD_Overview.md`](00_00_CRDD_Overview.md)を参照。

### ドキュメント

| ここから読む | 内容 |
|---|---|
| [`00_00_CRDD_Overview.md`](00_00_CRDD_Overview.md) | このフォルダ全体の地図 |
| [`00_01_CRDD_Principles.md`](00_01_CRDD_Principles.md) | CRDDが存在する理由、基本信条 |
| [`00_03_CRDD_Conformance.md`](00_03_CRDD_Conformance.md) | 「CRDD準拠」の意味（Experimental・策定中） |
| [`00_10_Context_Repository_Standard.md`](00_10_Context_Repository_Standard.md) | Repository構造、Header、命名、リンク |
| [`00_13_Human_AI_Responsibility.md`](00_13_Human_AI_Responsibility.md) | 人間とAIの役割分担 |
| [`00_14_AI_Change_Control.md`](00_14_AI_Change_Control.md) | AIが人間の確認なしに編集してよい範囲・してはいけない範囲 |
| [`00_30_Product_Documentation_Guide.md`](00_30_Product_Documentation_Guide.md) | 新規プロダクト向けフォルダ・ファイルテンプレート |

### ライセンス

CRDDの文書は[LICENSE](LICENSE)（CC BY-NC-SA 4.0、非商用利用）の下でライセンスされる。商用利用については[COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md)を参照。「CRDD」「Qual-Lab」の名称・関連する商標・ロゴは別途管理される——[TRADEMARK.md](TRADEMARK.md)を参照。

### ロードマップ

CRDD v0.1.0はCore標準と最初のPractice Guide一式を定義している。今後のリリースへ持ち越す未対応項目:

- `00_02_CRDD_Terminology.md`（Glossary）と`00_03_CRDD_Conformance.md`（準拠レベル）の確定
- `00_22_CRDD_Change_and_Versioning.md`の確定
- フォルダ体系側の条項: 必須/任意フォルダのルール、Cross-cutting文書の置き場所、文書分割・統合基準、一時情報の寿命、外部ファイル（非Markdown）参照メタデータ、Repository自体のSecret/PII取扱い
- Core標準文書全体への一貫したMUST/SHOULD/MAY規範強度語彙の適用

リリース履歴は[CHANGELOG.md](CHANGELOG.md)を参照。
