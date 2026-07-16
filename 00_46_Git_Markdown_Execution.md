# CRDD Git / Markdown Execution

Version: v0.2.0
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-16
Related:
- [00_02_CRDD_Core_Concepts_and_Terminology.md](00_02_CRDD_Core_Concepts_and_Terminology.md)
- [00_11_Information_Provenance.md](00_11_Information_Provenance.md)
- [00_13_Human_AI_Responsibility.md](00_13_Human_AI_Responsibility.md)
- [00_14_AI_Change_Control.md](00_14_AI_Change_Control.md)
- [00_19_Context_Traceability.md](00_19_Context_Traceability.md)
- [00_23_Phase_Gate_Approval.md](00_23_Phase_Gate_Approval.md)
- [00_24_Change_Context_Package.md](00_24_Change_Context_Package.md)
- [00_26_Agent_IO_Contract.md](00_26_Agent_IO_Contract.md)
- [00_27_Guided_Context_Creation.md](00_27_Guided_Context_Creation.md)
- [00_40_Guided_Skill_Runtime.md](00_40_Guided_Skill_Runtime.md)

---

# Purpose

本ドキュメントは、Claude Code、Codex、または同等のAI Coding Assistantが、Git RepositoryとMarkdown文書だけでCRDD Guided Skillを再現実行するための実行規約を定義する。

あわせて、Context / Relation Registry、Package / Review / Status / Promotionの最小運用を定義する。

---

# 1. AI Assistant Execution

## Purpose

本標準は、専用アプリケーションや自動化Runtimeを前提にせず、Claude Code、Codex、または同等のAI Coding AssistantがGit RepositoryとMarkdown文書だけでCRDD Guided Skillを再現実行するための実行規約を定義する。

AI Assistantに自由会話だけで作業させるのではなく、次の一貫した作業単位を守らせることを目的とする。

```text
Repositoryを読む
→ Active Skillと対象Scopeを確認する
→ 既存Contextを再利用する
→ 次に必要な質問を一つ提示する
→ 回答をContextへ変換する
→ 人間へ変換結果を確認する
→ Registry / Relation / Statusを更新する
→ 次のSkillまたはDecisionへRoutingする
```

---

## 1. Supported Execution Model

本標準が対象とする最小実行環境は以下である。

```text
Git Repository
Markdown files
CLAUDE.md / AGENTS.md
Claude Code / Codex / equivalent assistant
Human decision maker
```

Database、Web UI、専用Skill Runtime、Subagent Orchestration、Vector Searchは必須ではない。

AI AssistantはRepository Rootの`CLAUDE.md`または`AGENTS.md`を入口として読み、対象CRDD文書、対象Product文書、Change Package、Context Package、Registry文書を確認する。

---

## 2. Repository Entry Files

### 2.1. CLAUDE.md

Claude Code向けのRepository-level instructionである。

Claude Codeは作業開始時にこのファイルを読み、CRDD文書、対象Package、対象Skill、禁止事項、Protected Areaを確認する。

### 2.2. AGENTS.md

Codexおよび`AGENTS.md`を読むAI Coding Assistant向けのRepository-level instructionである。

`CLAUDE.md`と`AGENTS.md`は同じCRDD責務を表し、Tool固有の記述以外で意味を分岐させてはならない。

### 2.3. Repository Working State

Git / Markdown運用時のMachine-assisted Working Stateは、Product文書、Package文書、Registry文書としてRepository内に保持してよい。

専用の隠しDirectoryを前提とせず、対象RepositoryのDocument Architectureに合わせて配置する。

Working State文書はCRDDの正本Contextを置き換えない。正本Contextは各Product文書に保持し、Packageは参照と進行状態を、Registryは関係とStatusを管理する。

---

## 3. Mandatory Startup Sequence

AI Assistantは、非自明な作業を開始する前に以下を順に確認する。

```text
1. CLAUDE.md または AGENTS.md
2. 00_CRDD/00_00_CRDD_Overview.md
3. 00_CRDD/00_01_CRDD_Principles.md
4. 00_CRDD/00_02_CRDD_Core_Concepts_and_Terminology.md
5. 対象Change Package
6. 対象Context Package
7. 対象Skill / Registry Index
8. 対象Skill文書
9. 対象Scopeの正本Context
```

同一Session内で既に読んでおり、Revisionが変わっていない文書は再読を省略してよい。

Active Packageが未設定の場合、AI Assistantは勝手に作業Scopeを確定してはならない。軽微な作業を除き、最小のChange PackageまたはSkill Package作成を提案する。

---

## 4. Guided Skill Execution Loop

AI Assistantは一回の応答でSkill全体を完了させようとしてはならない。

標準Loopは以下である。

```text
A. Read
B. Assess
C. Ask
D. Capture
E. Transform
F. Confirm
G. Register
H. Route
```

### 4.1. Read

Active Context Packageと対象Skillを読む。

### 4.2. Assess

Entry Criteria、既知Context、未決事項を比較し、次に必要な判断を一つ選ぶ。

### 4.3. Ask

人間が答えられる自然な言葉で、一度に一つの重要質問を提示する。既知Contextを再質問してはならない。

### 4.4. Capture

回答をRaw Voiceとして保持し、必要に応じてObservation、Interpretation、Hypothesis、Proposal、Decisionへ分類する。

### 4.5. Transform

回答を対象SkillのProfessional Contextへ変換する。AIが追加した解釈やProposalを、人間の発言と混同してはならない。

### 4.6. Confirm

重要な変換またはPromotionの前に、以下を人間へ提示する。

```text
理解した原則または結論
AIが解釈・提案した部分
未決事項
次に進む場合の影響
```

### 4.7. Register

AcceptedまたはReviewedとなったContextは、RegistryとRelationへ反映する。

### 4.8. Route

次の質問、次Skill、Research、Decision、Review、Gate、Pauseのいずれかを決める。

---

## 5. Output Requirements

AI Assistantの出力は、以下を満たす。

```text
何を読んだか
何を根拠にしたか
何を変更したか
何を未変更にしたか
人間判断が必要な点
次の推奨Step
```

思考過程の全文を出す必要はない。ただし、判断に必要なEvidenceとReasoning Summaryは残す。

---

## 6. Prohibited Behavior

AI Assistantは以下をしてはならない。

```text
Protected Areaを無断で変更する
Approved Contextを人間承認なしに置き換える
不明点を推測で埋めて正本化する
AI ProposalをHuman Decisionとして記録する
Context Packageを読まずに大規模変更を始める
Registry更新を省略して完了扱いにする
```

---

## 7. Completion Criteria

SkillまたはChangeの終了時には、最低限以下を残す。

```text
Produced Context
Changed Files
Updated Registry / Relation
Human Decision
Open Questions
Verification / Evidence
Next Route
```

CRDDの目的は作業を重くすることではない。次のSessionが同じ理解から再開できるだけのContextを残すことである。

---

## 8. Git / Markdown Execution Validation

Git / MarkdownだけでCRDDを実行する場合、専用Application UI、Database Registry、Vector Search、自動Question Engine、Automatic Git Commitは必須ではない。

最初に確認すべきことは、仕組みの完全性ではなく、以下がRepository上で再現できることである。

```text
別SessionのAIでも現在地を説明できる
同じSkill定義から同様の質問が出る
人間回答がContextへ保存される
人間判断なしにDecisionが作られない
UX → IA → UI / SPECへ意味を継続できる
```

最小の開始条件:

```text
CLAUDE.md / AGENTS.mdが存在する
対象Change Packageまたは作業Scopeが明確である
対象Context Packageまたは読み込むべき正本Contextが明確である
対象Skill文書をAI Assistantが読める
Human Authorityが明確である
Protected Areaの扱いが明確である
```

最小の成功基準:

```text
新しいSessionが現在地を説明できる
前Sessionと同じ質問を不用意に繰り返さない
Origin / UX / IA / UI / SPECの意味接続が壊れていない
AI ProposalとHuman Decisionが区別されている
Registry / Package更新が過剰負荷になっていない
Markdownだけで再開できる
```

これらを満たさない場合は、CRDD自身の問題として扱うのではなく、まずPackage、Registry、Skill Entry / Exit、Handoff Contractのどこが不足しているかを特定する。


---

# 2. Context and Relation Registry

## Purpose

本標準は、Git / MarkdownだけでCRDD Skillを実行するためのContext RegistryとRelation Registryの最小構造、更新規則、整合条件を定義する。

Registryは正本Contextの内容を複製するDatabaseではない。

```text
Context Registry
= 何が存在し、どこにあり、どのRevision / Statusかを示すIndex

Relation Registry
= Context同士がどの意味で接続されているかを示すGraph Index
```

---

## 1. Context Registry

Context Registryは、追跡対象Contextごとに最低限以下を保持する。

| Field | Required | Meaning |
|---|---:|---|
| `ID` | MUST | 安定ID |
| `Type` | MUST | Core Context Typeまたは専門Context Type |
| `Subtype` | SHOULD | UX Outcome、Experience Principle等 |
| `Title` | MUST | 人間向け名称 |
| `Status` | MUST | Candidate / Draft / Reviewed / Approved等 |
| `Revision` | MUST | Contextの意味Revision |
| `Owner` | MUST | 更新責任主体 |
| `Authority` | SHOULD | 承認主体または参照元 |
| `Source` | MUST | 正本Artifact PathまたはURI |
| `Confidence` | SHOULD | 不確実性がある場合の信頼度または区分 |
| `Change` | SHOULD | 現在または直近のChange Package |
| `Last Reviewed` | SHOULD | 最終Review日 |
| `Notes` | MAY | 短い補足 |

最小Markdown形式:

```markdown
| ID | Type | Subtype | Title | Status | Revision | Owner | Source |
|---|---|---|---|---|---:|---|---|
| ORI-000001 | Origin | ProductIntent | 根拠ある計画判断 | Approved | 2 | Human | 01_Discovery/Origin.md |
```

### 1.1. Registry and Source

Registryの内容と正本Artifactが矛盾する場合、意味内容は正本Artifactを優先する。

ただし、Registry不整合はGapとして修正しなければならない。

### 1.2. Registry Granularity

登録単位はファイル単位ではなく、追跡価値のあるContext単位とする。

一つのMarkdownに複数Contextがある場合、複数行を登録してよい。

---

## 2. Relation Registry

Relation Registryは、最低限以下を保持する。

| Field | Required | Meaning |
|---|---:|---|
| `From` | MUST | Relation元Context ID |
| `Relation` | MUST | Canonical Relation Type |
| `To` | MUST | Relation先Context ID |
| `Status` | MUST | Proposed / Confirmed / Superseded |
| `Source` | SHOULD | Relation根拠 |
| `Change` | SHOULD | Relationを追加・変更したChange |
| `Notes` | MAY | 補足 |

最小Markdown形式:

```markdown
| From | Relation | To | Status | Source |
|---|---|---|---|---|
| UX-000010 | fulfills | ORI-000001 | Confirmed | 02_UX/02_01.md |
```

---

## 3. Canonical Relation Types

最低限、以下のRelation Typeを使用する。

| Relation | Meaning |
|---|---|
| `originates_from` | 上流Contextに由来する |
| `supports` | 判断、設計、実装を支える |
| `fulfills` | 要求、Outcome、Contractを満たす |
| `constrains` | 下流の選択肢を制約する |
| `refines` | より具体化する |
| `supersedes` | 旧Contextを置き換える |
| `conflicts_with` | 矛盾または衝突する |
| `depends_on` | 成立に依存する |
| `verifies` | 検証する |
| `implements` | 実装する |

Project固有Relationを追加してよいが、Canonical Relationと意味が重複する別名を増やしてはならない。

---

## 4. Update Rules

AI Assistantまたは人間は、以下の場合にRegistryを更新する。

```text
新しい追跡対象Contextを作成した
ContextのStatusが変わった
ContextのRevisionが変わった
Relationを追加、変更、削除した
Approved Contextを置換または廃止した
ReviewでGapが見つかった
```

Registry更新は、Context本文の変更と同じCommitまたは同じChange Packageで扱う。

---

## 5. Integrity Checks

最低限、以下を確認する。

```text
Registryに存在するSourceが実在する
RelationのFrom / ToがContext Registryに存在する
Approved Contextが孤立していない
Superseded Contextに後継Relationがある
Conflictが放置されていない
下流実装が削除済みContextを参照していない
```

Integrity Checkは完全自動でなくてよい。Git / Markdown運用では、AI Assistantが確認し、人間が重要なGapを判断する。

---

## 6. What Registry Must Not Become

Registryは以下になってはならない。

```text
正本文書の全文コピー
人間が読めない巨大表
AIの内部メモリ置き場
承認なしにStatusを昇格する仕組み
更新されない飾りの一覧
```

Registryは、次の作業者が「何を読めばよいか」「何と何がつながっているか」を素早く理解するための索引である。


---

# 3. Package, Review, Status and Promotion Workflow

## Purpose

本標準は、Git / Markdown運用でSkillを実行するために必要なContext Package、Change Package、Review Package、Status、Promotionの共通Workflowを定義する。

`00_24`がPackageの一般構造を定義するのに対し、本標準はAI Coding Assistantが実際に読み書きする最小運用形式を定義する。

---

## 1. Three Packages

### 1.1. Context Package

現在のSkillまたは作業へ渡すInput集合である。

最低限:

```text
Purpose
Active Skill
Scope
Read Context / Revision
Preserved Intent
Known Decision
Open Question
Must Not Change
Expected Output
```

### 1.2. Change Package

なぜ何を変えるかを追跡するLifecycle単位である。

最低限:

```text
Change ID
Reason
Scope
Current State
Desired State
Preserved Intent
Affected Context
Out of Scope
Risk
Decision Needed
Implementation / Document Change
Verification
Closure
```

### 1.3. Review Package

人間または独立Reviewerへ、判断可能な形で提示する単位である。

最低限:

```text
Review Purpose
Review Scope
Source Revision
Proposed Change
Rationale
Alternatives
Gap / Risk
Questions to Reviewer
Required Decision
Evidence
Recommendation
```

---

## 2. Standard Status

Git / Markdown運用で使用する共通Statusは以下とする。

| Status | Meaning |
|---|---|
| `Candidate` | 候補。まだ採用判断前 |
| `Draft` | 作成中。正本ではない |
| `Reviewed` | 確認済み。ただし承認とは限らない |
| `Approved` | 人間または定義済みAuthorityが承認済み |
| `Superseded` | 後継Contextに置き換え済み |
| `Deprecated` | 非推奨。既存参照は残る可能性がある |
| `Retired` | 運用終了。通常の参照対象から外す |

`Reviewed`は`Approved`ではない。AI Assistantは`Reviewed`案を作成してよいが、`Approved`へのPromotionは人間Authorityが決める。

---

## 3. Promotion Rules

Status Promotionは以下を満たす。

```text
Promotion前のStatusが明確
Promotion理由が記録されている
影響するRelationが更新されている
必要なReviewが完了している
Approvedへの昇格は人間Authorityが判断している
```

AI AssistantはPromotion候補と根拠を提示してよい。ただし、AuthorityのないPromotionを完了扱いにしてはならない。

---

## 4. Standard Workflow

標準Workflow:

```text
1. Context Packageを読む
2. Change Packageを確認または作成する
3. Skillを実行する
4. Produced ContextをDraftまたはCandidateとして記録する
5. Registry / Relationを更新する
6. Review Packageを作る
7. 人間がReviewed / Approved / Reworkを判断する
8. 必要ならPromotionする
9. ClosureとNext Routeを記録する
```

小さな文言修正などではPackageを軽量化してよい。ただし、Protected Areaや正本Contextへ影響する場合は省略してはならない。

---

## 5. Review Pattern

AI AssistantはReview PackageにRecommendationを含めてよい。

Recommendationは以下のいずれかを明示する。

| Recommendation | Meaning |
|---|---|
| `Approve` | 承認してよいと考える |
| `Approve with Notes` | 補足条件付きで承認可能 |
| `Rework` | 修正が必要 |
| `Need Decision` | 人間判断が必要 |
| `Need Expert Review` | 専門Reviewが必要 |
| `Pause` | 前提が不足している |

AI RecommendationはDecisionではない。人間判断と分離して記録する。

---

## 6. Closure

Change Packageを閉じるには以下を満たす。

```text
目的が満たされた
変更ファイルが明確
Registry / Relationが更新された
Review結果が残っている
未解決事項がNext Routeへ移された
VerificationまたはEvidenceが残っている
```

Closureは「作業を終えた」という宣言ではなく、次の作業者が安全に再開できる状態を作ることである。
