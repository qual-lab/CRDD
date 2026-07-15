# Context Repository Standard

Version: v0.1.0
Status: Stable
Owner: Human
Last Updated: 2026-07-15
Related:
- [00_00_CRDD_Overview.md](00_00_CRDD_Overview.md)
- [00_11_Information_Type_and_Provenance.md](00_11_Information_Type_and_Provenance.md)
- [00_15_Document_Standard.md](00_15_Document_Standard.md)

---

# 1. Purpose

本ドキュメントは、プロダクト開発における Context Repository の運用ルールを定義する。

Context Repository は、単なるドキュメント置き場ではない。
プロダクトのWhy、思想、判断、仕様、設計、根拠、実装、検証、Roadmapを接続するための正本である。

CRDDでは、AIが過去文脈を読み取り、人間が判断を継続できるように、プロジェクトの重要情報を人間にもAIにも可読な形で蓄積する。

本書は、Repository構造・正本性・ファイル管理（Header/Status/Naming/Link/廃止）を扱う。Evidence昇格・Decision契機・文書Typeの分類・Roadmap吸収は[`00_11_Information_Type_and_Provenance.md`](00_11_Information_Type_and_Provenance.md)、可読性の書き方戦略は[`00_15_Document_Standard.md`](00_15_Document_Standard.md)を参照する。

---

# 2. Basic Principle

Context Repositoryの基本原則は以下である。

```text
人間が読める。
AIが読める。
履歴を追える。
判断理由に戻れる。
実装と接続できる。
```

Context Repositoryは、AIに都合のよいデータ置き場ではない。
人間が読めることを最優先とし、その上でAIが検索・要約・比較・提案できる構造にする。

---

# 3. Source of Truth

CRDDでは、プロダクトのGitリポジトリを Context Repository の正本とする。

```text
Git Repository = Context Repository
```

Jira、Redmine、GitHub Issues、Backlog、Notion、Slack、Google Docs等は、原則として正本ではなく、入力元またはViewとして扱う。

## 原則

| 対象                             | 位置づけ                     |
| ------------------------------ | ------------------------ |
| Git Markdown                   | Why、判断、設計、仕様、Roadmapの正本  |
| Git履歴                          | 変更履歴、差分、時系列の正本           |
| Jira / Redmine / GitHub Issues | タスク進行状況のView             |
| Slack / Chat                   | 会話・未整理情報の入力元             |
| Google Docs / Figma / 画像       | 参照資料、Evidence、外部Artifact |
| 生成コード                          | 実装結果                     |
| テスト結果                          | 検証Evidence               |

---

# 4. Data Ownership

CRDDは、Context Repositoryに蓄積された、利用者・組織が作成したデータの所有権を主張しない。

```text
プロジェクト記録
議事録
判断履歴
Context Repositoryの各エントリ
業務文書
Ticket
実際の開発プロジェクトで使われる原資料
```

これらのデータは、元の利用者・組織・権利者に帰属したままとする。CRDDが定義するのは、こうしたデータをContext Repositoryとしてどう構造化・運用するかという方法論であり、データそのものの権利ではない。

CRDDの方法論自体の著作物（本文書群、図、テンプレート等）のライセンスは`LICENSE`を参照する。

---

# 5. Repository Structure

プロダクトのContext Repositoryは以下の構成を基本とする。

```text
00_CRDD
01_Discovery
02_UX
03_IA
04_Spec
05_UI
06_Architecture
07_Workflows
40_Develop
80_PR
90_Evidence
90_Release
95_Decisions
99_Roadmap
```

## Folder Responsibility

| Folder            | Responsibility              |
| ----------------- | ---------------------------- |
| `00_CRDD`         | CRDD思想、Repository運用、AI利用ルール |
| `01_Discovery`    | 課題発見、要求候補の受け皿              |
| `02_UX`           | プロダクトの原点、Why、思想、体験設計       |
| `03_IA`           | 情報構造、対象概念、画面責務、ナビゲーション       |
| `04_Spec`         | 機能仕様、振る舞い、状態、例外、受け入れ条件      |
| `05_UI`           | UI表示、操作、文言、画面別仕様             |
| `06_Architecture` | システム構成、データ構造、AI構成、セキュリティ    |
| `07_Workflows`    | 開発・検証・リリースの進め方              |
| `40_Develop`      | 実装計画、開発ログ、テスト、検証結果          |
| `80_PR`           | 外部向けPR資料、紹介資料、発信用コピー        |
| `90_Evidence`     | 調査資料、参考資料、スクリーンショット、根拠資料    |
| `90_Release`      | リリース判断の記録・根拠資料             |
| `95_Decisions`    | 重要判断、方針変更、採用・却下理由           |
| `99_Roadmap`      | Roadmap、Sprint計画、将来構想       |

## V2 Documentation Structure

V2では、UX / IA / Spec / UI / Architecture / Workflows を明示的に分離する。

```text
UX           = なぜ作るか、誰の何を助けるか、体験原則
IA           = 何を対象概念として扱い、どの画面が何に責任を持つか
Spec         = 機能がどう振る舞い、何を満たせば受け入れられるか
UI           = 画面にどう表示し、どう操作でき、どの文言を使うか
Architecture = それをどのデータ・API・処理・AI・セキュリティで実現するか
Workflows    = 人間とAIがどう開発・検証・リリースするか
```

`04_Spec` は、UIとArchitectureの間に置く仕様の正本である。
Roadmapや会話で決まった内容を、実装可能な振る舞い・状態・例外・受け入れ条件へ変換する場所として扱う。

## V2 Migration Rule

既存リポジトリに `04_UI` / `05_Architecture` / `06_Workflows` が存在する場合、V2移行時は `04_Spec` を追加し、UI / Architecture / Workflowsを1段ずつ後ろへ移すことを目標とする。

移行が完了するまでは、以下の読み替えを許容する。

| Existing Folder | Treated As |
|---|---|
| `04_UI` | `05_UI` |
| `05_Architecture` | `06_Architecture` |
| `06_Workflows` | `07_Workflows` |

ただし、新規に機能仕様を正本化する場合は、可能な限り `04_Spec` 相当の文書として作成する。
フォルダ名の物理リネームは、リンク更新・参照更新・実装影響確認とセットで行う。

---

# 6. What Should Be Stored

Context Repositoryに蓄積すべき情報は以下である。

```text
Why
困りごと
課題
リスク
思い
仮説
顧客価値
差別化
判断経緯
変えた理由
変えなかった理由
UX方針
IA設計
UI責務
Architecture方針
仕様
実装計画
検証結果
Roadmap
Evidence
```

CRDDでは、特に上流思想を重視する。

実装やテストはAIで代替・効率化しやすい。
一方で、Why、課題、価値判断、優先順位、方針変更理由は、人間の価値そのものである。

そのため、上流思想は失われないようにContext Repositoryへ明示的に残す。

---

# 7. What Should Not Be Stored as-is

以下は、そのままContext Repositoryの正本にしない。

```text
長大な生ログ
文脈のないスクリーンショット
出典不明のメモ
誰が判断したか分からない結論
AIが生成しただけの未レビュー文章
一時的な作業メモ
未検証の推測
```

ただし、これらを材料として使うことはできる。

その場合は、要約・解釈・判断・出典を付けて、適切なフォルダへ昇格する。昇格の具体的な流れは[`00_11_Information_Type_and_Provenance.md`](00_11_Information_Type_and_Provenance.md)を参照する。

---

# 8. Document Header Rule

各Markdown文書の冒頭には、可能な限り以下のHeaderを置く。

```text
# Title

Version: 0.1
Status: Draft / Review / Approved / Superseded / Deprecated
Owner: Human / AI Draft / Shared
Last Updated: yyyy-mm-dd
Related:
- [Title](path/to/related_file.md)
```

## Header Items

| Item           | Purpose |
| -------------- | ------- |
| `Version`      | 文書の版数   |
| `Status`       | 文書の状態   |
| `Owner`        | 責任主体    |
| `Last Updated` | 最終更新日   |
| `Related`      | 関連文書    |

Headerは、AIが文書の信頼度や状態を判断するためにも重要である。

`Related:` は、GitHub上でもクリックできるよう、ファイル名の列挙ではなくMarkdownリンク `[Title](path/to/file.md)` の形式にする。

---

# 9. Status Rule

文書にはStatusを付ける。

| Status       | Meaning      |
| ------------ | ------------ |
| `Draft`      | 作成中。まだ正本ではない |
| `Review`     | 確認中。判断前      |
| `Approved`   | 正本として扱う      |
| `Superseded` | 後継文書に置き換え済み  |
| `Deprecated` | 廃止済み。履歴として保持 |

## Owner Definition

| Owner      | Meaning         |
| ---------- | --------------- |
| `Human`    | 人間が責任を持つ        |
| `AI Draft` | AI生成草案。未承認      |
| `Shared`   | AI支援あり、人間レビュー済み |

AIが作成した文書は、承認されるまで `Status: Draft` / `Owner: AI Draft` とする。

人間が確認し、正本として扱う場合は、以下へ変更する。

```text
Status: Approved
Owner: Human
```

または、AI支援ありの人間承認済み文書として以下を使う。

```text
Status: Approved
Owner: Shared
```

---

# 10. File Naming Rule

文書名は、AIと人間が意味を推測しやすい名前にする。

## Good

```text
01_Product_Philosophy.md
02_User_Pain.md
2026-07-06_CRDD_Adoption.md
03_AI_Edit_Policy.md
```

## Bad

```text
memo.md
new.md
test.md
latest.md
aaa.md
考えたこと.md
```

## Rule

```text
番号 + 意味のある英語名
日付 + 判断内容
目的が分かる名前
```

日本語本文は問題ない。
ただし、ファイル名はAI検索・Git管理・リンク参照しやすいように、英語ベースを基本とする。

---

# 11. Link Rule

Context Repositoryでは、関連文書を必ずリンクで接続する。

特に以下はリンクする。

```text
UX方針 → IA設計
IA設計 → Spec
Spec → UI仕様
Spec → Architecture
Architecture → Develop
Develop → Verification
Decision → 関連する設計文書
Roadmap → 関連するDecision
Evidence → 昇格先Context
```

文書同士の接続がないと、AIは文脈をたどりにくくなる。
CRDDでは、リンクは単なる参照ではなく、Contextの経路である。

リンクは`[Title](path/to/file.md)`形式のクリック可能なMarkdownリンクにする。ファイル名だけを列挙する書き方は避ける。

---

# 12. Source Precedence and Conflict Rule

文書間で内容が矛盾した場合、以下の順で正本性を判断する。

```text
00_CRDD
↓
95_Decisions
↓
02_UX
↓
03_IA
↓
04_Spec
↓
05_UI / 06_Architecture
↓
07_Workflows
↓
99_Roadmap
↓
90_Evidence
```

`99_Roadmap` は未来計画であり、完了済み機能の仕様正本ではない。
実装・検証が完了した内容は、必要に応じて `04_Spec` / `05_UI` / `06_Architecture` / `95_Decisions` へ吸収する。

古い文書が新しい判断と矛盾する場合は、黙って上書きせず、以下のいずれかを行う。

```text
新しいDecision Logへリンクする
StatusをDeprecatedまたはSupersededへ変更する
後継文書を明記する
移行中であることを明記する
```

---

# 13. Update Rule

文書を更新する場合、以下を意識する。

```text
何が変わったか
なぜ変わったか
どの判断に基づくか
どの文書へ影響するか
過去の方針を置き換えるのか
単なる追記なのか
```

重要な変更では、文書本文の更新だけでなく `95_Decisions` へ判断履歴を残す。

---

# 14. Deprecation Rule

古い文書は削除しない。

必要に応じて、以下のいずれかのStatusに変更する。

```text
Deprecated
Superseded
```

## Deprecated

もう使わないが、履歴として残す。

## Superseded

新しい文書に置き換えられた状態。
後継文書へのリンクを必ず記載する。

```text
Status: Superseded
Superseded By:
- [New Title](path/to/new_file.md)
```

CRDDでは、過去の思想や判断の変遷も重要なContextである。
そのため、古い文書を無断で消さない。

---

# 15. AI Draft Rule

AIが作成した文書は、未承認の間は明示する。

```text
Status: Draft
Owner: AI Draft
```

AI Draftは正本ではない。
人間が確認し、必要に応じて承認する。

承認後は以下に変更する。

```text
Status: Approved
Owner: Human
```

または、

```text
Status: Approved
Owner: Shared
```

AIの編集可能範囲そのもの（何を草案でき、何を確定変更してはいけないか）は[`00_14_AI_Change_Control.md`](00_14_AI_Change_Control.md)を参照する。

---

# 16. Minimum Operation Rule

最初から完璧な運用を目指さない。

プロダクト開発では、まず以下を最小ルールとする。

```text
重要な思想は 02_UX に残す
重要な判断は 95_Decisions に残す
実装作業は 40_Develop に残す
将来構想は 99_Roadmap に残す
根拠資料は 90_Evidence に残す
外部向け資料は 80_PR に残す
AIに実装させる前に関連文書を読ませる
```

---

# 17. Definition of Healthy Repository

健全なContext Repositoryとは、以下を満たす状態である。

```text
なぜ作っているか分かる
今どこへ向かっているか分かる
なぜその判断をしたか分かる
何が未決か分かる
どの資料が正本か分かる
AIが関連文脈をたどれる
人間が読んで理解できる
実装と設計が接続されている
```

---

# 18. Minimum Rule

最低限、以下を守る。

```text
Gitリポジトリを正本とし、タスク管理ツールはViewとして扱う
文書HeaderにVersion/Status/Owner/Last Updated/Relatedを置く
Relatedはクリック可能なMarkdownリンクにする
古い文書は削除せず、Deprecated/Supersededで扱う
文書間の矛盾はSource Precedenceに従い、黙って上書きしない
```

---

# 19. Final Principle

Context Repositoryは、プロジェクトの記憶である。

記憶がなければ、AIは正しく支援できない。
記憶がなければ、人間は過去の判断に戻れない。
記憶がなければ、思想は下流工程で劣化する。

CRDDでは、Context Repositoryを通じて、人間のアイディアと判断を未来へ継承する。
