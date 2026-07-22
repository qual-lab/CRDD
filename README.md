# CRDD

**Context Repository-Driven Development**

```text
作業をAIへ。判断を人間へ。思想をContext Repositoryへ。
Work to AI. Judgment to humans. Thought to the Context Repository.
```

Status: **v0.5.1 — Standard Repository Operations, Migration, and Readability / 標準Repository運用・Migration・可読性改善版**

**[English](#english)** | **[日本語](#日本語)** | **[Contributing](CONTRIBUTING.md)** | **[Changelog](CHANGELOG.md)**

---

## English

### What is CRDD?

AI-assisted development can accelerate implementation while quietly losing a product's Why: the origin of a need, the reasoning behind a decision, rejected alternatives, accepted risks, and design intent often decay in chat logs, tickets, and pull request descriptions.

CRDD is a development methodology for preserving and connecting product context. It helps humans, AI, and specialists carry a product from discovery through verification without silently changing its meaning.

In a Git-based project, the repository can serve as the canonical control plane for the Context Repository. Authoritative external artifacts can remain in their original systems when explicit references connect them to the repository.

Within its authority, AI may explore, organize, compare, draft, implement, and verify. Humans retain authority over meaning, value, priority, approval, risk acceptance, and final responsibility.

CRDD does not require a particular AI tool, agent topology, document tool, or technology stack.

### CRDD in plain language

CRDD is not only a way to make AI write code. It keeps why something is being built, whose situation should change, what was decided, and why that decision was made in a repository so that people and AI can understand the same meaning later.

- AI supports research, organization, comparison, documentation, implementation, and verification.
- Humans remain responsible for value, priority, adoption or rejection, risk, and final decisions.
- Requirements, UX, IA, UI, behavior specifications, architecture, implementation, and verification stay connected.
- Unknowns remain visible instead of being silently filled in by AI.
- The authoritative place is selected for each kind of information, rather than treating one whole document as correct about everything.

| CRDD term | Plain-language guide |
|---|---|
| Context Repository | The connected place that preserves why, decisions, design, implementation, verification, and learning |
| Canonical Artifact | The artifact that currently carries the authoritative content for a particular kind of information |
| Property Authority | The person, role, or artifact allowed to determine a particular property |
| Preserved Intent | The purpose, value, or non-goal that must not disappear as work moves downstream |
| Responsibility Coverage | Evidence that the concerns owned by a phase were considered for the required scope |
| Phase Transition Review | An independent check for omissions and contradictions before handing scope to another phase |
| Evidence | Checkable support for a claim, interpretation, or decision |
| Handoff | Passing context, obligations, risks, and unresolved matters to the next responsible activity |
| Stable Context ID | An ID that keeps the same meaning traceable even when files move or are reorganized |
| Change Trace | A record connecting a change's reason, impact, implementation, verification, and release disposition |

This table is a non-normative reading aid. The canonical definitions remain in [Terminology](02_Terminology.md); if wording differs, the canonical definition governs.

The product transformation is connected end to end, but it is not a fixed waterfall:

```text
Discovery → UX → IA
                  ↓
        UI ⇄ Behavior Specification
          └──────┬──────┘
                 ↓
           Architecture
                 ↓
           Implementation
                 ↓
            Verification
                 ↓
 Learning / Finding → affected Context
```

UI and Behavior Specification are parallel phases joined by a shared contract.

When a new decision, constraint, learning, evidence item, or finding is established downstream, check its effect on upstream and peer context immediately. Update the owning canonical artifacts, then reassess downstream impact.

Before a normal phase transition, an independent reviewer checks:

- whether the sending phase has met its exit conditions;
- whether the receiving phase is ready to start;
- whether the target scope has gaps or conflicts; and
- whether unresolved items and their effects are explicit.

Fix transition-affecting findings in the responsible phase. Re-review the updated revision before Human approval.

Proceeding with an incomplete review or propagation check requires an explicit Human-directed exception. Record its risk, owner, and recheck condition. A partial handoff does not waive the checks for the transferred scope.

### External standards and foundations

CRDD uses selected requirements, usability, accessibility, design-principle, and normative-language sources. Referencing a source does not mean CRDD fully covers or conforms to it.

The authoritative source index, relationship, and stated coverage are listed in [External Foundations and Source Trace](00_Overview.md#36-external-foundations-and-source-trace). Trace rules are defined in [Documentation](03_Documentation.md#49-external-source-trace).

### Quick Start

1. Read the [Overview](00_Overview.md), [Principles](01_Principles.md), [Terminology](02_Terminology.md), and [Documentation rules](03_Documentation.md).
2. Copy the [`template/`](template) scaffold into the target project. Copy the released CRDD standard documents for the adopted version into its `00_CRDD/` folder and keep that version identifiable.
3. Read the shared authorities required for the work (`10`–`19`) and the applicable phase authorities (`21`–`29`). Read the [shared UI / Behavior Specification contract](24_UI_Behavior_Specification.md) before either parallel phase.
4. Use the project-root [`AGENTS.md`](template/AGENTS.md) or [`CLAUDE.md`](template/CLAUDE.md) as the AI entry point. Connect the active scope, target revision, canonical context, authority, applicable phase, and stop conditions instead of copying phase rules into prompts.
5. When a decision, constraint, learning, evidence, or finding is established or changed, evaluate and, when triggered, complete the [Triggered Propagation Check](53_Gap_Impact_Audit.md#43-mandatory-propagation-trigger-and-closure) before treating the result as complete.
6. Before a phase transition, run the [Phase Transition Review](10_Agent.md#72-phase-transition-review-and-remediation-loop), remediate findings in the responsible phase, and re-review the updated revision before Human approval.
7. Before claiming CRDD conformance, evaluate the applicable Core and Profile criteria with current evidence using the [Conformance Audit](52_Conformance_Audit.md).

### Updating from v0.4.2 to v0.5.x

v0.5.0 renamed the canonical CRDD documents. The general filename migration is:

```text
00_YY_Name.md -> YY_Name.md

Exception:
00_00_Overview.md -> 00_Overview.md
```

Adopt the release as an explicit migration instead of overwriting a project blindly:

1. Record the currently pinned CRDD release, local deviations, and the target v0.5.x release.
2. Update the released standard-document set under `00_CRDD/` while preserving project-owned artifacts and identifying local adapter changes that must be reapplied.
3. Rename old canonical filenames and update fixed references in project-root `AGENTS.md`, `CLAUDE.md`, product documents, workflows, prompts, templates, and external tooling.
4. Check local Markdown links and anchors, then run the [Document Audit](51_Document_Audit.md).
5. Run the [Gap / Impact Audit](53_Gap_Impact_Audit.md) only when meaning, authority, phase handoff, consumer behavior, or cross-artifact trace may have changed.
6. Update a Git submodule pointer only when CRDD is adopted as a submodule. Record a project Change Trace only when the migration materially affects project operation, authority, product context, or verification.

Until migration verification passes, keep the previous pinned release recoverable. The official-repository root [`AGENTS.md`](AGENTS.md) and [`CLAUDE.md`](CLAUDE.md) maintain CRDD itself; adopting projects continue to use the [`template/`](template) entry files.

### Core Operating Boundaries

- Within `00_CRDD/`, canonical filenames use the two-digit document number once, such as `01_Principles.md` and `27_Architecture.md`; do not repeat the folder number as `00_01_*` or `00_27_*`. Document numbers are not Stable Context IDs. Standard Stable Context IDs are limited to `REQ`, `UX`, `IA`, `UI`, and `SPEC`. `CHG-*` identifies a Change Trace artifact, not stable product context.
- Keep Evidence inline or under the nearest parent folder's `Evidence/`. Reflect a Decision's result in the resulting Canonical Artifact and keep its rationale, evidence, alternatives, and history there. Do not use root-level Evidence or Decision folders as the default model.
- Use `01_Discovery` for new evidence, uncertainty, and requirements. Use `99_Roadmap` for accepted but deferred work by referencing requirements and other context; Roadmap items do not receive CRDD Stable Context IDs.
- Use `40_Develop` for code, configuration, migrations, build definitions, and tests—not for CRDD management Markdown.
- Use `07_Workflows` for repository-specific repeatable procedures. Use `90_Release/Changes/CHG-*.md` for Change Traces. Use the rest of `90_Release` only when the project needs release records, distribution references, or release verification.
- Treat governance, security, privacy, accessibility, compatibility, capacity, and cost as responsibilities of the applicable upstream and downstream phases rather than as detached end-stage checks.
- Published CRDD documents prioritize the reader's primary locale. Canonical English terms remain common aliases; Stable Context IDs, Agent IDs, filenames, schema keys and values, and code are not translated. BCP 14 keywords remain visible where normative strength must be unambiguous.

The authoritative placement, artifact, Evidence, Decision, Stable Context ID, and traceability rules are in [Documentation](03_Documentation.md). The complete repository and document map is in the [Overview](00_Overview.md).

### Documentation Routes

| Need | Start here |
|---|---|
| Understand CRDD and its invariants | [Principles](01_Principles.md) |
| See the complete repository and document map | [Overview](00_Overview.md) |
| Resolve canonical concepts, status, and authority terms | [Terminology](02_Terminology.md) |
| Structure repositories, artifacts, evidence, decisions, IDs, and traces | [Documentation](03_Documentation.md) |
| Run or delegate AI work | [Agent](10_Agent.md) and [Skill](11_Skill.md) |
| Trace a change, release a product, or define a repeatable workflow | [Change](12_Change.md), [Release](13_Release.md), and [Workflow](14_Workflow.md) |
| Apply a product phase | Use the [phase authority map](00_Overview.md#33-product-phase-authorities), then read the applicable `21`–`29` authority |
| Maintain the CRDD standard itself | [Maintenance](19_Maintenance.md) |
| Migrate a v0.4.2 adoption to v0.5.x | [Updating from v0.4.2 to v0.5.x](#updating-from-v042-to-v05x) |
| Audit documents, conformance, or cross-layer impact | [Document Audit](51_Document_Audit.md), [Conformance Audit](52_Conformance_Audit.md), and [Gap / Impact Audit](53_Gap_Impact_Audit.md) |
| Report a problem, propose a standard change, or share adoption feedback | [Contributing](CONTRIBUTING.md) |

### Contributing

Public problem reports, standard-change proposals, adoption feedback, and pull requests are welcome. A submitted proposal is not automatically part of CRDD.

Each proposal enters the [CRDD Maintenance](19_Maintenance.md) route. Maintainers review its evidence, impact, alternatives, authority, audit needs, and release implications.

See [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a normative or breaking change.

### License

Unless otherwise noted, CRDD documentation and other copyrightable repository materials are licensed under [LICENSE](LICENSE) (CC BY-NC-SA 4.0).

For commercial use, see [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md). The names, marks, and logos associated with CRDD and Qual-Lab are governed separately by [TRADEMARK.md](TRADEMARK.md).

---

## 日本語

### CRDDとは？

AI協働開発は実装を高速化できる一方で、ProductのWhy——要望の起点、判断理由、却下した代替案、受容したRisk、設計意図——をChat Log、Ticket、Pull Requestの中で静かに劣化させることがある。

CRDDは、そのContextを保存・接続し、人間、AI、専門家が意味を無言で変えずにDiscoveryからVerificationまでProductを具体化できるようにする開発方法論である。Gitを利用するProjectでは、RepositoryをContext RepositoryのCanonical Control Planeとして利用し、Authorityを持つ外部Artifactも明示的な参照で接続できる。

AIはAuthorityの範囲内で探索、整理、比較、Draft、実装、検証を行える。人間は意味、価値、Priority、Approval、Risk受容、最終責任を保持する。CRDDは特定のAI Tool、Agent構成、文書Tool、技術Stackを要求しない。

### CRDDを簡単に言うと

CRDDは、AIにCodeを書かせるためだけの方法ではない。なぜ作るのか、誰の何を変えたいのか、何をなぜ決めたのかをRepositoryへ残し、人間やAIが後から同じ意味を理解できるようにする方法である。

- AIは、調査、整理、比較、文書化、実装、検証を支援する。
- 人間は、価値、優先順位、採用・却下、Risk、最終判断に責任を持つ。
- Requirement、UX、IA、UI、Behavior Specification、Architecture、Implementation、Verificationを接続する。
- 分からないことをAIが勝手に補わず、未決事項として残す。
- 成果物全体を一つの正解とせず、情報の種類ごとにAuthorityを定める。

| CRDD用語 | 初めて読む人向けの説明 |
|---|---|
| Context Repository | なぜ作るか、判断、設計、実装、検証、Learningをつないで残す場所 |
| Canonical Artifact | 特定の情報について、現在の正式な内容を持つ成果物 |
| Property Authority | 特定の項目を決める権限を持つ人、Role、または成果物 |
| Preserved Intent | 下流へ進んでも失ってはいけない目的、価値、Non-goal |
| Responsibility Coverage | その工程が考えるべきことを必要なScopeで確認した状態 |
| Phase Transition Review | 次工程へ渡す前に、抜けや矛盾を独立した視点で確認すること |
| Evidence | 主張、解釈、判断を確認するための根拠 |
| Handoff | Context、責務、Risk、未決事項を保ったまま次の活動へ渡すこと |
| Stable Context ID | Fileが移動・再編されても同じ意味を追跡するためのID |
| Change Trace | 変更理由、影響、実装、検証、Release上の処置をつないだ記録 |

この表は非規範の理解補助であり、別の定義を作るものではない。正式な定義は[Terminology](02_Terminology.md)を正本とし、表現が異なる場合は正本に従う。

Product Transformationは一気通貫で接続するが、固定Waterfallではない。

```text
Discovery → UX → IA
                  ↓
        UI ⇄ Behavior Specification
          └──────┬──────┘
                 ↓
           Architecture
                 ↓
           Implementation
                 ↓
            Verification
                 ↓
 Learning / Finding → 影響するContext
```

UIとBehavior Specificationは、共有Contractで接続された並行工程である。

下流で新しい判断、制約、学び、根拠、Findingが生じた場合は、その場で上流や同じ工程への影響を確認する。影響があれば、責務を持つ正本を更新し、下流への影響も改めて検証する。

通常の工程移行前には、作成担当とは別の視点で次を確認する。

- 送信工程の完了条件を満たしているか
- 受信工程を開始できる状態か
- 対象Scopeに抜けや矛盾がないか
- 未解決事項と影響範囲が明確か

問題は責務を持つ工程で修正し、修正後の内容を再Reviewしてから人間の承認へ進む。未完了の確認を残して進む場合は、人間が例外、Risk、Owner、再確認条件を明示する。部分Handoffだけを理由に、移行するScopeの確認を省略してはならない。

### 外部標準・参考原則

CRDDは、Requirement記法、Usability、Accessibility、設計原則、規範語彙等のSourceを、必要な範囲で使用または参考にする。参照していることだけでは、そのSourceを完全に網羅または準拠していることを意味しない。

正式なSource索引、CRDDとの関係、Coverageは[External Foundations and Source Trace](00_Overview.md#36-external-foundations-and-source-trace)を参照する。Trace Ruleは[Documentation](03_Documentation.md#49-external-source-trace)を正本とする。

### クイックスタート

1. [Overview](00_Overview.md)、[Principles](01_Principles.md)、[Terminology](02_Terminology.md)、[Documentation](03_Documentation.md)を読む。
2. [`template/`](template)のScaffoldを対象Projectへコピーする。採用するReleaseのCRDD標準文書を`00_CRDD/`へコピーし、採用Versionを識別可能にする。
3. 作業に必要な共通正本（`10`〜`19`）と対象工程の正本（`21`〜`29`）を読む。UIまたはBehavior Specificationへ進む前に、両者の[共有Contract](24_UI_Behavior_Specification.md)を読む。
4. Project Rootの[`AGENTS.md`](template/AGENTS.md)または[`CLAUDE.md`](template/CLAUDE.md)をAIの入口とする。工程RuleをPromptへ複製せず、Active Scope、Target Revision、Canonical Context、Authority、対象工程、Stop条件を接続する。
5. Decision、Constraint、Learning、Evidence、Findingを確定・変更したときは[Triggered Propagation Check](53_Gap_Impact_Audit.md#43-mandatory-propagation-trigger-and-closure)を評価し、発火した場合は通常完了とする前に正本反映と再監査まで終える。
6. 工程移行前に[Phase Transition Review](10_Agent.md#72-phase-transition-review-and-remediation-loop)を実行し、責務工程でFindingを修正して更新Revisionを再Reviewした後にHuman Approvalへ進む。
7. CRDD準拠を表明する前に、[Conformance Audit](52_Conformance_Audit.md)に従って、適用されるCore / Profile Criteriaを現行Evidenceで評価する。

### v0.4.2からv0.5.xへの更新

v0.5.0ではCRDD正本文書のFile名を変更した。基本的な移行Ruleは次のとおり。

```text
00_YY_Name.md -> YY_Name.md

例外:
00_00_Overview.md -> 00_Overview.md
```

Projectを無条件に上書きせず、明示的なMigrationとして適用する。

1. 現在PinしているCRDD Release、Project固有Deviation、移行先v0.5.xを記録する。
2. `00_CRDD/`の公開標準文書一式を更新する。Project所有Artifactは保持し、再適用が必要なProject固有Adapter変更を識別する。
3. 旧正本File名をRenameし、Project Rootの`AGENTS.md`／`CLAUDE.md`、Product文書、Workflow、Prompt、Template、外部Toolの固定参照を更新する。
4. Local MarkdownのLink / Anchorを確認し、[Document Audit](51_Document_Audit.md)を実行する。
5. 意味、Authority、工程Handoff、Consumer Behavior、Artifact間Traceへ影響し得る場合だけ[Gap / Impact Audit](53_Gap_Impact_Audit.md)を実行する。
6. CRDDをSubmoduleとして採用している場合だけPointerを更新する。MigrationがProject運用、Authority、Product Context、Verificationへ実質的に影響する場合だけProject側Change Traceへ記録する。

Migration検証がPassするまでは、以前PinしていたReleaseへ戻せる状態を保つ。公式Repository Rootの[`AGENTS.md`](AGENTS.md)と[`CLAUDE.md`](CLAUDE.md)はCRDD標準自身のMaintenance用であり、採用Projectは引き続き[`template/`](template)のEntry Fileを使用する。

### 主要な運用境界

- `00_CRDD/`内の正本文書名は`01_Principles.md`、`27_Architecture.md`のように二桁Document Numberを一度だけ使用し、Folder番号を重ねた`00_01_*`、`00_27_*`にはしない。Document NumberはStable Context IDではない。標準Stable Context IDは`REQ`、`UX`、`IA`、`UI`、`SPEC`に限定する。`CHG-*`はChange TraceのArtifact IDであり、Product ContextのStable IDではない。
- Evidenceは成果物内または最も近い親Folderの`Evidence/`へ置く。Decisionの結果は結果となるCanonical Artifactへ反映し、Rationale、Evidence、Alternative、Historyを同Artifactへ残す。Root直下のEvidence / Decision Folderを基本構成にしない。
- 新しいEvidence、不確実性、Requirementは`01_Discovery`へ置く。採用済みだが未着手の内容はRequirementや他のContextを参照して`99_Roadmap`へ置き、Roadmap項目へCRDD Stable Context IDを付与しない。
- `40_Develop`にはCode、Configuration、Migration、Build定義、Testを置き、CRDD管理用Markdownを置かない。
- `07_Workflows`にはRepository固有の反復可能な作業手順を置く。Change Traceは`90_Release/Changes/CHG-*.md`へ置く。その他の`90_Release`は、Release Record、配布物参照、Release Verificationが必要なProjectでだけ使用する。
- Governance、Security、Privacy、Accessibility、Compatibility、Capacity、Costは、終盤で独立して確認する項目ではなく、適用される上流・下流工程の責務として扱う。
- CRDD正本文書は読者の主要ロケールを優先する。正式英語名は共通Aliasとして保持し、Stable Context ID、Agent ID、File名、Schema Key / Value、Codeは翻訳しない。規範強度を曖昧にできない箇所では、BCP 14 Keywordを併記する。

配置、Artifact、Evidence、Decision、Stable Context ID、Traceabilityの正本は[Documentation](03_Documentation.md)、Repositoryと文書体系の完全な地図は[Overview](00_Overview.md)を参照する。

### 文書の導線

| 目的 | ここから読む |
|---|---|
| CRDDと不変条件を理解する | [Principles](01_Principles.md) |
| Repositoryと文書体系の全体像を確認する | [Overview](00_Overview.md) |
| Canonical Concept、Status、Authority用語を確認する | [Terminology](02_Terminology.md) |
| Repository、Artifact、Evidence、Decision、ID、Traceを設計する | [Documentation](03_Documentation.md) |
| AI作業を実行・委譲する | [Agent](10_Agent.md)と[Skill](11_Skill.md) |
| Change、Product Release、反復Workflowを扱う | [Change](12_Change.md)、[Release](13_Release.md)、[Workflow](14_Workflow.md) |
| Product工程を適用する | [工程正本Map](00_Overview.md#33-product-phase-authorities)から、該当する`21`〜`29`の正本を読む |
| CRDD標準自体を保守する | [Maintenance](19_Maintenance.md) |
| v0.4.2採用Repositoryをv0.5.xへ移行する | [v0.4.2からv0.5.xへの更新](#v042からv05xへの更新) |
| 文書、準拠、工程横断Impactを監査する | [Document Audit](51_Document_Audit.md)、[Conformance Audit](52_Conformance_Audit.md)、[Gap / Impact Audit](53_Gap_Impact_Audit.md) |
| 問題報告、Rule変更提案、採用Feedbackを行う | [Contributing](CONTRIBUTING.md) |

### Contribution

公開のProblem Report、Standard Change Proposal、Adoption Feedback、Pull Requestを受け付ける。ただし、提案されたこと自体はCRDDへの採用を意味しない。

提案は、Evidence、Impact、Alternative、Authority、Audit、Releaseを確認する[CRDD Maintenance](19_Maintenance.md)の経路へ接続する。Normative ChangeまたはBreaking Changeを提案する前に、[CONTRIBUTING.md](CONTRIBUTING.md)を確認する。

### ライセンス

CRDDの文書およびRepository内のその他の著作物は、特記がない限り[LICENSE](LICENSE)（CC BY-NC-SA 4.0）で提供する。商用利用は[COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md)を参照する。CRDDおよびQual-Labに関連する名称、商標、ロゴは[TRADEMARK.md](TRADEMARK.md)で別に扱う。
