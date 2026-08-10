# CRDD

**Context Repository-Driven Development**

```text
作業をAIへ。判断を人間へ。思想をコンテキストリポジトリへ。
Work to AI. Judgment to humans. Thought to the Context Repository.
```

Status: **v0.15.0 — Communication and Context Dependency / 外部コミュニケーションとコンテキスト依存**

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
- Intended experience is carried into visual direction, themes, reusable patterns, components, screens, and verification instead of ending as a mood board or representative mockup.
- Unknowns remain visible instead of being silently filled in by AI.
- The authoritative place is selected for each kind of information, rather than treating one whole document as correct about everything.

| CRDD term | Plain-language guide |
|---|---|
| Context Repository | The connected place that preserves why, decisions, design, implementation, verification, and learning |
| Canonical Artifact | The artifact that currently carries the authoritative content for a particular kind of information |
| Property Authority | The person, role, or artifact allowed to determine a particular property |
| Preserved Intent | The purpose, value, or non-goal that must not disappear as work moves downstream |
| Responsibility Coverage | Evidence that the concerns owned by a phase were considered for the required scope |
| Phase Transition Review | An independent check of contract gaps, conflicts, and the specialist quality owned by the sending phase or applicable shared contract before handoff |
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
- whether the target scope has gaps or conflicts;
- whether unresolved items and their effects are explicit; and
- whether the work is sound for the sending phase's applicable specialist responsibilities.

The specialist check uses the coverage and audit checklist owned by the sending phase or applicable shared contract. One independent reviewer may cover both contract and specialist checks when able to evaluate the required perspectives and explain that basis; otherwise, delegate only the missing perspectives. A title, agent or model name, tool, unsupported self-claim, or a repeated checklist is not enough. This does not add a third approval stage.

Fix transition-affecting findings in the responsible phase. Re-review the updated revision before Human approval.

Proceeding with an incomplete review or propagation check requires an explicit Human-directed exception. Record its risk, owner, and recheck condition. A partial handoff does not waive the checks for the transferred scope.

### External standards and foundations

CRDD uses selected requirements, usability, accessibility, design-principle, and normative-language sources. Referencing a source does not mean CRDD fully covers or conforms to it.

The authoritative source index, relationship, and stated coverage are listed in [External Foundations and Source Trace](00_Overview.md#36-external-foundations-and-source-trace). Trace rules are defined in [Documentation](03_Documentation.md#49-external-source-trace).

### What humans need to know

You do not need to memorize every CRDD rule before starting. Keep these five responsibilities:

1. Explain what should change, for whom, and why.
2. Ask AI for a recommendation with reasons, benefits, drawbacks, uncertainty, and alternatives—not an unexplained A/B choice.
3. Humans decide value, priority, adoption or rejection, risk acceptance, phase transition, and release.
4. Do not let unknowns or unresolved findings disappear behind a completed document or task.
5. Check the route selected by AI: affected phases, independent review, audits, and remaining Human decisions.

When an audit, review, or Change Trace produces many findings, AI should not turn every finding into a separate Human question. It should first integrate the results, separate deterministic remediation from genuine Human decisions and report-only information, and group only findings that depend on the same inseparable decision. For each Human decision, AI should lead with what must be decided, its recommendation, why the decision is needed now, what changes for users, business, the product, delivery, cost, and risk, the recommendation's main drawback, and what remains if the recommendation is not adopted. Finding IDs, files, phases, and audit details remain traceable but normally follow this decision summary.

When one agreed remediation affects several passages, references, templates, guides, or examples, AI should list those concrete targets before editing. Before re-review, it should reconcile every target as updated, verified unchanged, excluded with a reason, waiting for a Human decision, or unable to apply or verify with a reason and restart condition. A simple local correction remains simple; this check does not create another audit or approval step.

Editing or self-checking a target means the remediation was applied; it does not mean the problem is resolved. AI should report progress, blockers, and resolution separately. Resolution requires observable acceptance criteria, a decision method, fresh evidence for the same fixed revision, independent re-review, and propagation to the current records used by the project.

For remediation that crosses several locations, AI preserves the original finding's meaning and checks two separate populations: the contract cases that can change the result, and every consumer that uses those cases. A correct verification oracle or reference harness does not prove that the product and each consumer behaved correctly. Repeated recurrence should move the work back to the shared contract, generator, verification oracle, authority, or consumer map instead of adding another local patch.

Git-managed evidence normally identifies declared, observed, and execution targets with Git object format and OIDs. Extra manifests are reserved for subsets, dirty state, submodules, external inputs, or non-Git artifacts. Adding links, OIDs, timestamps, or reviewers to an already settled current record receives a lightweight reference check and then stops; changing its meaning triggers reevaluation.

Give AI at least:

```text
The problem or change to handle
The affected users and desired outcome
Known evidence, constraints, and uncertainty
What may change and what must remain unchanged
Decisions already made and decisions still needed
```

AI should select and load the responsible canonical documents, compare alternatives, update the approved scope, maintain verification obligations, and run the necessary checks. It should return the selected route in a form a Human can inspect:

```text
Change classification
Affected or reopened phases and shared responsibilities
Independent review and audits to run
Major audits not selected and why
Human decisions still required
```

The [human-readable route table](00_Overview.md#44-change-route-selection) shows the common combinations. It is a navigation aid; the linked canonical rules govern.

### Quick Start

Humans do not need to read every canonical document before starting. Read this section and the [Overview orientation](00_Overview.md#1-quick-orientation); use [Terminology](02_Terminology.md) and [Documentation](03_Documentation.md) as references when a term or recording rule is needed. AI and people designing CRDD operation should load the canonical foundation set.

1. Read the [Overview orientation](00_Overview.md#1-quick-orientation) and identify the first problem or request to handle.
2. Copy the base scaffold from [`template/`](template) into the target project, excluding the optional `template/80_Communication` capability folder. Add that folder as root `80_Communication` only when Human scope selection says external communication applies. Design Direction alone does not activate it. Copy the released CRDD standard documents for the adopted version into `00_CRDD/` and keep that version identifiable.
3. Let the AI entry point load the canonical foundation set, the shared authorities required for the work (`10`–`19`), and only the applicable phase authorities (`21`–`29`). Read the [shared UI / Behavior Specification contract](24_UI_Behavior_Specification.md) before either parallel phase.
4. Use the project-root [`AGENTS.md`](template/AGENTS.md) or [`CLAUDE.md`](template/CLAUDE.md) as the AI entry point. Connect the active scope, target revision, canonical context, authority, applicable phase, and stop conditions instead of copying phase rules into prompts.
5. When a decision, constraint, learning, evidence, or finding is established or changed, evaluate and, when triggered, complete the [Triggered Propagation Check](53_Gap_Impact_Audit.md#43-mandatory-propagation-trigger-and-closure) before treating the result as complete.
6. Before handing off phase or shared-contract scope, run the [Phase Transition Review](10_Agent.md#72-phase-transition-review-and-remediation-loop) with both contract and applicable specialist checks, remediate findings in the responsible phase or contract, and re-review the updated revision before Human approval.
7. Before claiming CRDD conformance, evaluate the applicable Core and Profile criteria with current evidence using the [Conformance Audit](52_Conformance_Audit.md).

### Start one small problem

This non-normative example shows the minimum flow; it does not require a separate file for every line.

```text
A customer says, "Important notices are easy to miss."
  ↓
Keep the interview note inline or in the nearest 01_Discovery/Evidence/
  ↓
Separate what was heard, the interpretation, and solution ideas
  ↓
Draft a requirement candidate and show uncertainty
  ↓
The responsible Human adopts, defers, rejects, or asks for more evidence
  ↓
Only the adopted scope proceeds to UX
```

Before changing an adopted CRDD baseline, run the lightweight [Baseline Adoption Assessment](19_Maintenance.md#62-baseline-adoption-assessment). Compare every intervening release, evaluate semantic, AI-behavior, conformance, phase-contract, and adapter impacts, and apply only the migration, audits, Change Traces, or verification that the project actually needs. Adopting with no action is possible, but only as a `Not Applicable` with a reason confirmed by the responsible human authority — not as a default. Updating a submodule pointer or `00_CRDD/` copy alone does not activate the new baseline.

Where a baseline update includes any difference classified normative or breaking, or any release whose CHANGELOG declares migration required, adoption is not complete until the [Migration Completeness](19_Maintenance.md#621-migration-completeness) bar is met — this applies to adopting with no action just as much as to adopting after remediation — and a `Conformant` claim cannot be recorded against that baseline before then. The bar's fifth point, an independent review, is carried out by Document Audit or Gap / Impact Audit, not by Conformance Audit.

v0.15.0 contains a breaking, capability-scoped change for Communication and Context Dependency and requires migration; review the [v0.15.0 changelog](CHANGELOG.md#changelog-v0150-en) and its migration note. v0.14.0 contains a breaking change for convergent remediation and evidence identity and also requires migration; review the [v0.14.0 changelog](CHANGELOG.md#changelog-v0140-en) and its migration note. v0.13.0 contains a breaking change for complete multi-location remediation and also requires migration; review the [v0.13.0 changelog](CHANGELOG.md#changelog-v0130-en) and its migration note. v0.12.0 contains a normative pre-execution alignment change and also requires migration; review the [v0.12.0 changelog](CHANGELOG.md#changelog-v0120-en) and its migration note. v0.11.0 contains a normative AI-interaction change and also requires migration; review the [v0.11.0 changelog](CHANGELOG.md#changelog-v0110-en) and its migration note. v0.10.0, v0.9.0, v0.8.0, and v0.7.0 contain breaking changes and also require migration — review the [v0.10.0 changelog](CHANGELOG.md#changelog-v0100-en), [v0.9.0 changelog](CHANGELOG.md#changelog-v090-en), [v0.8.0 changelog](CHANGELOG.md#changelog-v080-en), and [v0.7.0 changelog](CHANGELOG.md#changelog-v070-en) with their migration notes. For migration from v0.5.1-p1 to v0.6.0, review the [v0.6.0 changelog](CHANGELOG.md#changelog-v060-en) and apply only the changes relevant to the adopting project.

<a id="historical-migration-v042-v05x-en"></a>

### Historical migration guide: v0.4.2 to v0.5.x

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

### AI Precheck

The distributed template includes `tools/crdd_check.mjs`. In normal use, the parent AI agent runs it once against a fixed revision before independent review or an audit set; users do not need to run it manually.

```text
node tools/crdd_check.mjs
node tools/crdd_check.mjs --json
node tools/crdd_check.mjs --json --summary
node tools/crdd_check.mjs --references <PATH> --summary
```

When CRDD itself is mounted at `00_CRDD/` as a Git submodule and the checker has not been copied to the project root, run it from the project root and identify that root explicitly:

```text
node 00_CRDD/template/tools/crdd_check.mjs --root . --json --summary
```

In this layout, the checker treats the submodule as the adopted baseline boundary. It checks project links and anchors that point into the baseline, but does not mix the baseline's complete internal file set with project-owned files. The omitted baseline internals are reported as unchecked. To inspect the baseline itself, run the checker separately with `--root 00_CRDD`; do not use project `--scope` to cross the submodule boundary. Symbolic links and junctions are not followed during repository inspection; affected targets are rejected or reported as unchecked.

Without `--scope`, the checker inspects the whole repository; this is the default for independent review, audit sets, and release readiness. `--scope <PATH>` is reserved for an explicitly bounded intermediate check. A scoped run expands to direct inbound and outbound Markdown references, keeps repository-wide invariants such as structure and explicit Stable Context ID uniqueness, and reports what remains unchecked. It is not evidence of a full-repository precheck.

The parent agent passes the target scope, target revision, checker revision, findings, unperformed checks, execution time, and summary metrics to each reviewer as shared input. Reviewers do not repeat the same deterministic check unless that result is missing, stale, incomplete, or for a different scope. After the target files, scope, or checker changes, the parent agent runs it once again for the new revision.

The checker is an efficiency aid, not a conformance authority. If Node.js or the supplied implementation is unavailable, the AI may perform an equivalent check and report what remains unchecked. A checker pass does not replace independent review, specialist-quality review, or any CRDD audit.

### Core Operating Boundaries

- Within `00_CRDD/`, canonical filenames use the two-digit document number once, such as `01_Principles.md` and `27_Architecture.md`; do not repeat the folder number as `00_01_*` or `00_27_*`. Document numbers are not Stable Context IDs. Standard Stable Context IDs are limited to `REQ`, `UX`, `IA`, `UI`, and `SPEC`. `CHG-*` identifies a Change Trace artifact, not stable product context.
- Keep Evidence inline or under the nearest parent folder's `Evidence/`. Reflect a Decision's result in the resulting Canonical Artifact and keep its rationale, evidence, alternatives, and history there. Do not use root-level Evidence or Decision folders as the default model.
- Use `01_Discovery` for new evidence, uncertainty, and requirements. It may also hold unadopted inputs for later reconsideration without a mandatory candidate file, identifier, or status model. Use `99_Roadmap` as an Open Work Registry that indexes uncompleted work—ideas, deferred requirements, defects, technical debt, migrations, unresolved audit findings, and in-flight Change Traces—by existence, current state, and reference, while meaning, evidence, and rationale stay in the owning Canonical Artifact. Registration alone does not mean adoption, priority, or permission to execute. Roadmap items do not receive CRDD Stable Context IDs.
- Keep one fixed entry artifact for each phase from Discovery through Architecture, using the paths defined by [Documentation](03_Documentation.md#31-basic-structure). Change the depth of writing, review, evidence, and linked detail—not the entry name or basic file split—when risk or complexity changes. The entry is not a links-only index: it directly states phase-wide scope, coverage, major conclusions and decisions, verification obligations, unresolved matters, and downstream obligations. It references authoritative detail without duplicating it into a second source of truth.
- Use `40_Develop` for code, configuration, migrations, build definitions, and tests—not for CRDD management Markdown.
- Use `07_Quality` for the Quality Center, quality strategy, verification design, and immutable verification-result history. Keep phase-owned obligations and evidence in their owning artifacts. Quality status, rationale, unverified scope, residual risk, and reproduction methods must remain understandable from the repository even when CI or test tools are used; an external link or run ID is not the QA record. Where unit testing applies, use `100%` branch coverage as the default target and explain every shortfall or exclusion with its scope, residual risk, alternative verification, owner, and reevaluation condition.
- When external communication is part of the repository, use `80_Communication/01_Communication.md` as the single entry. Separate generated projections from published records, connect claims to evidence, and treat measured reactions as observations or learning candidates until a human adopts them. Repositories without this capability do not create the folder.
- Distinguish semantic context dependencies from versioned artifact dependencies. Apply the full contract to context dependencies, artifact dependencies whose meaning, contract, adopted version, or update decision must be coordinated across independently managed consumers within the adopting organization, and artifact dependencies requiring explicit management for material risk. An upstream provider's API contract, separate authority, or independent release alone does not trigger the full contract. Ordinary and transitive implementation dependencies may remain in architecture or package-management authorities. Do not make a repository, submodule, or package layout mandatory.
- Use `19_Workflows` for repository-specific repeatable procedures. Use `90_Release/Changes/CHG-*.md` for Change Traces. Use the rest of `90_Release` only when the project needs release records, distribution references, or release verification.
- Before independent review or an audit set, the parent AI agent runs `node tools/crdd_check.mjs` or an equivalent deterministic check once for the fixed target revision and shares the result. The supplied implementation is optional and does not replace Document Audit, specialist-quality review, Conformance Audit, or Gap / Impact Audit.
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
| Track progress and health across any development method | [Progress](15_Progress.md) |
| Build quality obligations across phases and inspect current quality status | [Quality Assurance](16_Quality_Assurance.md) |
| Create, approve, publish, and learn from external communication | [Communication](17_Communication.md) |
| Manage semantic context and versioned artifact dependencies | [Context Dependency](18_Context_Dependency.md) |
| Apply a product phase | Use the [phase authority map](00_Overview.md#33-product-phase-authorities), then read the applicable `21`–`29` authority |
| Maintain the CRDD standard itself | [Maintenance](19_Maintenance.md) |
| Evaluate and adopt a newer CRDD baseline | [Baseline Adoption Assessment](19_Maintenance.md#62-baseline-adoption-assessment) |
| Migrate a v0.4.2 adoption to v0.5.x | [Historical migration guide: v0.4.2 to v0.5.x](#historical-migration-v042-v05x-en) |
| Audit documents, conformance, or cross-layer impact | [Document Audit](51_Document_Audit.md), [Conformance Audit](52_Conformance_Audit.md), and [Gap / Impact Audit](53_Gap_Impact_Audit.md) |
| Report a problem, propose a standard change, or share adoption feedback | [Contributing](CONTRIBUTING.md) |

### Contributing

Public problem reports, standard-change proposals, adoption feedback, and pull requests are welcome. A submitted proposal is not automatically part of CRDD.

Each proposal enters the [CRDD Maintenance](19_Maintenance.md) route. Maintainers review its evidence, impact, alternatives, authority, audit needs, and release implications.

See [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a normative or breaking change.

### License

CRDD is licensed under the [Apache License 2.0](LICENSE). This covers the documentation and every other copyrightable material in this repository. Trademarks are carved out: the CRDD, Qual-Lab, and Qual names, their logos, and related brand elements are governed separately by [TRADEMARK.md](TRADEMARK.md), because Apache License 2.0 grants no trademark rights beyond the limited use its Section 6 allows.

Commercial use is permitted under the terms of the Apache License 2.0. No separate commercial copyright license from Qual-Lab is required; the trademark terms above still apply.

Every version of CRDD is available under the Apache License 2.0, including releases originally distributed under CC BY-NC-SA 4.0. Qual-Lab authored that content and provides it under these terms. Permissions granted to recipients under the earlier license were never revoked and remain valid.

---

## 日本語

### CRDDとは？

AI協働開発は実装を高速化できる一方で、プロダクトの「なぜ」——要望の起点、判断理由、却下した代替案、受容したリスク、設計意図——をチャットログ、チケット、プルリクエストの中で静かに劣化させることがある。

CRDDは、そのコンテキストを保存・接続し、人間、AI、専門家が意味を無言で変えずに課題探索・要求形成工程（Discovery）から検証までプロダクトを具体化できるようにする開発方法論である。Gitを利用するプロジェクトでは、リポジトリをコンテキストリポジトリの正本制御基盤として利用し、決定権限を持つ外部成果物も明示的な参照で接続できる。

品質保証は最後にテストを実行する活動ではない。各工程が自身の品質条件について検証義務と検証観点を育て、テスト、レビュー、計測、分析、利用者評価等によって確認する。人間は`07_Quality/Quality_Center.md`から、現在の結論、計画対実績、件数、割合、差異理由、重大な問題、残存リスクと詳細参照を確認できる。

AIは決定権限の範囲内で探索、整理、比較、下書き、実装、検証を行える。人間は意味、価値、優先順位、承認、リスク受容、最終責任を保持する。CRDDは特定のAIツール、エージェント構成、文書ツール、技術スタックを要求しない。

### CRDDを簡単に言うと

CRDDは、AIにコードを書かせるためだけの方法ではない。なぜ作るのか、誰の何を変えたいのか、何をなぜ決めたのかをリポジトリへ残し、人間やAIが後から同じ意味を理解できるようにする方法である。

- AIは、調査、整理、比較、文書化、実装、検証を支援する。
- 人間は、価値、優先順位、採用・却下、リスク、最終判断に責任を持つ。
- 要求、UX、IA、UI、振る舞い仕様、アーキテクチャ、実装、検証を接続する。
- UXで定めた印象や関係性を、視覚表現方針（Visual Direction）、UIテーマ（UI Theme）、UI設計パターン（UI Design Pattern）、UI部品（UI Component）、全対象論理画面（Logical Screen）の最終視覚表現（Final Visual）、実装結果の検証まで接続する。
- 分からないことをAIが勝手に補わず、未決事項として残す。
- 成果物全体を一つの正解とせず、情報の種類ごとに決定権限を定める。

| CRDD用語 | 初めて読む人向けの説明 |
|---|---|
| コンテキストリポジトリ（Context Repository） | なぜ作るか、判断、設計、実装、検証、学びをつないで残す場所 |
| 正本成果物 | 特定の情報について、現在の正式な内容を持つ成果物 |
| 項目の決定権限（Property Authority） | 特定の項目を決める権限を持つ人、役割、または成果物 |
| 保持する意図（Preserved Intent） | 下流へ進んでも失ってはいけない目的、価値、目指さないこと |
| 責務の網羅状態（Responsibility Coverage） | その工程が考えるべきことを必要な対象範囲で確認した状態 |
| 工程移行レビュー | 工程または共有契約の対象範囲を渡す前に、契約上の抜けや矛盾と、その工程または契約で必要な専門品質を独立した視点で確認すること |
| 根拠 | 主張、解釈、判断を確認するための根拠 |
| 引き渡し | コンテキスト、責務、リスク、未決事項を保ったまま次の活動へ渡すこと |
| 安定コンテキストID（Stable Context ID） | ファイルが移動・再編されても同じ意味を追跡するためのID |
| 変更トレース | 変更理由、影響、実装、検証、リリース上の処置をつないだ記録 |

この表は非規範の理解補助であり、別の定義を作るものではない。正式な定義は[用語](02_Terminology.md)を正本とし、表現が異なる場合は正本に従う。

プロダクト変換は一気通貫で接続するが、固定的なウォーターフォールではない。

```text
課題探索・要求形成 → UX → IA
                  ↓
        UI ⇄ 振る舞い仕様
          └──────┬──────┘
                 ↓
           アーキテクチャ
                 ↓
           実装
                 ↓
            検証
                 ↓
 学び／指摘事項 → 影響するコンテキスト
```

UIと振る舞い仕様は、共有契約で接続された並行工程である。

下流で新しい判断、制約、学び、根拠、指摘事項が生じた場合は、その場で上流や同じ工程への影響を確認する。影響があれば、責務を持つ正本を更新し、下流への影響も改めて検証する。

通常の工程移行前には、作成担当とは別の視点で次を確認する。

- 送信工程の完了条件を満たしているか
- 受信工程を開始できる状態か
- 対象範囲に抜けや矛盾がないか
- 未解決事項と影響範囲が明確か
- その工程で必要な専門観点から、内容が実際に成立しているか

専門品質は、送信工程または対象となる共有契約が所有する網羅範囲と監査チェックリストを基準に確認する。一人の独立した確認者が契約と必要な専門観点を評価でき、その根拠を説明できるなら、確認者を増やす必要はない。足りない観点だけを別の確認者へ渡す。肩書き、エージェント名、モデル名、ツール、根拠のない自己申告、チェックリストの再掲だけでは、評価能力の根拠にならない。これは三段階目の承認ではない。

問題は責務を持つ工程で修正し、修正後の内容を再レビューしてから人間の承認へ進む。未完了の確認を残して進む場合は、人間が例外、リスク、担当責任者、再確認条件を明示する。部分引き渡しだけを理由に、移行する対象範囲の確認を省略してはならない。

### 外部標準・参考原則

CRDDは、要求記法、ユーザビリティ、アクセシビリティ、設計原則、規範語彙等の情報源を、必要な範囲で使用または参考にする。参照していることだけでは、その情報源を完全に網羅または準拠していることを意味しない。

正式な情報源索引、CRDDとの関係、網羅範囲は[外部基盤と情報源の追跡](00_Overview.md#36-external-foundations-and-source-trace)を参照する。追跡規則は[文書化](03_Documentation.md#49-external-source-trace)を正本とする。

### 人間が知っておくこと

開始前にCRDDの全規則を暗記する必要はない。人間は、まず次の五つを押さえればよい。

1. 誰の何を、なぜ変えたいかをAIへ伝える。
2. AIには、理由のないA／B質問ではなく、推奨案、理由、利点、欠点、不確実性、代替案を求める。
3. 価値、優先順位、採用・却下、リスク受容、工程移行、リリースは人間が決める。
4. 不明点や未解決の指摘事項を、文書やタスクの完了によって見えなくしない。
5. AIが選んだ変更経路、対象工程、独立レビュー、監査、人間の判断事項を確認する。

監査、レビュー、変更トレースから多数の指摘事項が出ても、AIは指摘ごとに人間へ質問しない。全結果を統合し、AIが一意に修正できる事項、人間による判断が必要な事項、報告のみの事項へ分け、同じ不可分な判断に依存する指摘だけをまとめる。人間判断では、今回決めること、推奨、なぜ今必要か、利用者・業務・プロダクト・計画・費用・リスクへの変化、推奨の主な短所、不採用時に残る問題を先に示す。指摘事項ID、対象ファイル、工程、監査等の詳細は追跡可能に保ち、判断要約の後から確認できるようにする。

一つの合意済み修正が複数の記述、参照、ひな型、ガイド、例示へ及ぶ場合、AIは編集前に具体的な対象を一覧化する。再レビュー前には、各対象を、修正済み、確認して変更不要、理由付き対象外、人間判断待ち、適用不能または確認不能として理由と再開条件を記録、のいずれかへ照合する。単一箇所の明らかな修正は簡潔に扱い、新しい監査や承認を増やさない。

複数箇所へ及ぶ是正では、元の指摘事項の意味を変えず、結果を変え得る契約の組合せと、その契約を使う利用側を別々に確認する。正しい期待値や参照用の検証器があるだけでは、プロダクトや各利用側が正しく動いた証明にはならない。同じ原因が再発する場合は局所修正を重ねず、共通契約、生成器、判定方法、決定権限または利用側一覧へ戻る。

Git管理対象の根拠では、通常はGitのObject FormatとOIDを使って、確認予定の対象、実際に観測した対象、結果を生成した対象を区別する。追加Manifestは、部分集合、dirty状態、Submodule、外部入力またはGit外成果物で必要な範囲に限る。確定済みの現在記録へ参照、OID、時刻、確認者だけを追記した場合は軽量な参照確認で終了し、意味が変わった場合だけ再評価する。

対象を編集またはセルフチェックした状態は「適用済み」であり、「解消済み」ではない。AIは処置の進み方、阻害要因、解消判定を分けて示す。解消には、観測可能な受入条件、合否判定方法、同じ固定改訂版に対する新しい根拠と独立再レビュー、プロジェクトが参照する現在状態への反映が必要になる。

AIへは少なくとも次を渡す。

```text
扱いたい問題または変更
影響する利用者と期待する結果
分かっている根拠、制約、不確実性
変更してよい範囲と維持するもの
判断済みの事項と、これから人間が決める事項
```

AIは、責務を持つ正本文書の選択、代替案の比較、承認された範囲の更新、検証義務の維持、必要な確認を担当できる。AIは選択した経路を、少なくとも次の形で人間へ示す。

```text
変更分類
影響または再開する工程と共通責務
実行する独立レビューと監査
実行しない主な監査と理由
残っている人間の判断事項
```

よく使う組み合わせは[人間向けの変更経路判断表](00_Overview.md#44-change-route-selection)から確認できる。この表は案内であり、最終的な規則は表から接続する正本文書に従う。

### クイックスタート

人間は、開始前にすべての正本文書を通読する必要はない。この節と[概要の「最初に把握すること」](00_Overview.md#1-quick-orientation)から始め、分からない用語は[用語集](02_Terminology.md)、配置や記録方法は[文書化](03_Documentation.md)で必要時に確認する。AIとCRDD運用を設計する担当者は、基礎正本一式を読む。

1. [概要の「最初に把握すること」](00_Overview.md#1-quick-orientation)を読み、最初に扱う問題または要望を一つ決める。
2. [`template/`](template)から任意機能の`template/80_Communication`を除く基礎ひな型を対象プロジェクトへコピーする。人間が外部コミュニケーションを適用すると判断した場合だけ、同フォルダをプロジェクト直下の`80_Communication`として追加する。デザイン方針だけの利用では追加しない。採用するリリースのCRDD標準文書を`00_CRDD/`へコピーし、採用バージョンを識別可能にする。
3. AI入口から基礎正本、作業に必要な共通正本（`10`〜`19`）、対象工程の正本（`21`〜`29`）だけを読む。UIまたは振る舞い仕様へ進む前に、両者の[共有契約](24_UI_Behavior_Specification.md)を読む。
4. プロジェクト直下の[`AGENTS.md`](template/AGENTS.md)または[`CLAUDE.md`](template/CLAUDE.md)をAIの入口とする。工程規則を指示文へ複製せず、作業対象、対象改訂版、正本コンテキスト、決定権限、対象工程、停止条件を接続する。
5. 判断、制約、学び、根拠、指摘事項を確定・変更したときは[変更影響の伝播確認](53_Gap_Impact_Audit.md#43-mandatory-propagation-trigger-and-closure)を評価し、発火した場合は通常完了とする前に正本反映と再監査まで終える。
6. 工程または共有契約の対象範囲を引き渡す前に、契約確認と対象工程または対象共有契約の専門品質確認を含む[工程移行レビュー](10_Agent.md#72-phase-transition-review-and-remediation-loop)を実行し、責務を持つ工程または契約で指摘事項を修正して更新改訂版を再レビューした後に人間の承認へ進む。
7. CRDD準拠を表明する前に、[準拠監査](52_Conformance_Audit.md)に従って、適用される中核／プロファイル基準を現行根拠で評価する。

### 小さな問題を一つ始める

次は非規範の最小例であり、一行ごとに別ファイルを作る必要はない。

```text
顧客から「重要なお知らせを見落としやすい」と聞いた
  ↓
ヒアリング記録を本文内または最寄りの01_Discovery/Evidence/へ残す
  ↓
聞いた事実、解釈、解決案を分ける
  ↓
不確実性を示した要求候補を作る
  ↓
責任者が採用、延期、却下、追加調査を決める
  ↓
採用した対象範囲だけをUXへ渡す
```

採用しているCRDD基準版を変更する前に、軽量な[基準版採用評価](19_Maintenance.md#62-baseline-adoption-assessment)を行う。途中の各リリース差分を確認し、意味、AI挙動、準拠、工程契約、接続部への影響を評価して、プロジェクトに必要な移行、監査、変更トレース、検証だけを実施する。対応なしで採用することもできるが、それは既定の扱いではなく、責任を持つ人間の決定権限者が確認した理由を伴う`Not Applicable`としてのみ成立する。サブモジュールポインタまたは`00_CRDD/`の文書を更新しただけでは、新しい基準版を有効化したことにならない。

基準版更新に含まれる差分のいずれかが規範もしくは破壊的に分類される場合、またはいずれかのリリースのCHANGELOGが移行を必要と明示する場合、[移行完了の条件](19_Maintenance.md#621-migration-completeness)を満たすまで採用は完了せず、その基準版への`Conformant`表明も記録できない。これは対応なしで採用する場合にも適用する。同条件の5点目の独立レビューは、文書監査または不足／影響監査で実施し、準拠監査では実施しない。

v0.15.0は外部コミュニケーションとコンテキスト依存に関する適用機能を限定できる破壊的変更を含み、移行を必要とする。[v0.15.0の変更履歴](CHANGELOG.md#changelog-v0150-ja)と移行注記を確認する。v0.14.0は収束する是正と根拠同一性に関する破壊的変更を含み、同じく移行を必要とする。[v0.14.0の変更履歴](CHANGELOG.md#changelog-v0140-ja)と移行注記を確認する。v0.13.0は複数箇所への是正適用に関する破壊的変更を含み、同じく移行を必要とする。[v0.13.0の変更履歴](CHANGELOG.md#changelog-v0130-ja)と移行注記を確認する。v0.12.0は着手前整合確認に関する規範変更を含み、同じく移行を必要とする。[v0.12.0の変更履歴](CHANGELOG.md#changelog-v0120-ja)と移行注記を確認する。v0.11.0はAI対話に関する規範変更を含み、同じく移行を必要とする。[v0.11.0の変更履歴](CHANGELOG.md#changelog-v0110-ja)と移行注記を確認する。v0.10.0、v0.9.0、v0.8.0、v0.7.0はいずれも破壊的変更を含み、同じく移行を必要とする。[v0.10.0の変更履歴](CHANGELOG.md#changelog-v0100-ja)、[v0.9.0の変更履歴](CHANGELOG.md#changelog-v090-ja)、[v0.8.0の変更履歴](CHANGELOG.md#changelog-v080-ja)、[v0.7.0の変更履歴](CHANGELOG.md#changelog-v070-ja)、およびそれぞれの移行注記を確認する。v0.5.1-p1からv0.6.0へ移行する場合は、[v0.6.0の変更履歴](CHANGELOG.md#changelog-v060-ja)を確認し、採用プロジェクトに関係する変更だけを適用する。

<a id="historical-migration-v042-v05x-ja"></a>

### 過去の移行案内: v0.4.2からv0.5.xへの更新

v0.5.0ではCRDD正本文書のファイル名を変更した。基本的な移行規則は次のとおり。

```text
00_YY_Name.md -> YY_Name.md

例外:
00_00_Overview.md -> 00_Overview.md
```

プロジェクトを無条件に上書きせず、明示的な移行として適用する。

1. 現在固定しているCRDDリリース、プロジェクト固有の差異、移行先v0.5.xを記録する。
2. `00_CRDD/`の公開標準文書一式を更新する。プロジェクト所有の成果物は保持し、再適用が必要なプロジェクト固有の接続変更を識別する。
3. 旧正本ファイル名を変更し、プロジェクト直下の`AGENTS.md`／`CLAUDE.md`、プロダクト文書、作業手順、指示文、ひな型、外部ツールの固定参照を更新する。
4. ローカルMarkdownのリンクとアンカーを確認し、[文書監査](51_Document_Audit.md)を実行する。
5. 意味、決定権限、工程引き渡し、利用側の振る舞い、成果物間の追跡関係へ影響し得る場合だけ[不足／影響監査](53_Gap_Impact_Audit.md)を実行する。
6. CRDDをサブモジュールとして採用している場合だけ参照先を更新する。移行がプロジェクト運用、決定権限、プロダクトコンテキスト、検証へ実質的に影響する場合だけ、プロジェクト側の変更トレースへ記録する。

移行検証に合格するまでは、以前固定していたリリースへ戻せる状態を保つ。公式リポジトリ直下の[`AGENTS.md`](AGENTS.md)と[`CLAUDE.md`](CLAUDE.md)はCRDD標準自身の保守用であり、採用プロジェクトは引き続き[`template/`](template)の入口ファイルを使用する。

### AIによる事前確認

配布用ひな型には`tools/crdd_check.mjs`が含まれる。通常は、独立レビューまたは監査集合の前に親AIエージェントが固定した対象改訂版へ一度実行する。利用者が手動で実行する必要はない。

```text
node tools/crdd_check.mjs
node tools/crdd_check.mjs --json
node tools/crdd_check.mjs --json --summary
node tools/crdd_check.mjs --references <PATH> --summary
```

CRDD本体を`00_CRDD/`へGitサブモジュールとして配置し、チェッカーをプロジェクトルートへコピーしていない場合は、プロジェクトルートから対象ルートを明示して実行する。

```text
node 00_CRDD/template/tools/crdd_check.mjs --root . --json --summary
```

この配置では、`00_CRDD/`を採用済み基準の境界として扱う。適用先文書から基準文書へのリンクとアンカーは確認するが、基準文書の内部ファイル全体をプロジェクト所有ファイルへ混在させない。確認対象から外した基準文書内部は未確認範囲として表示する。基準文書自体を確認するときは`--root 00_CRDD`で別に実行し、適用先の`--scope`でサブモジュール境界をまたがない。リポジトリ確認ではシンボリックリンクとジャンクションをたどらず、該当対象を拒否するか未確認範囲として表示する。

`--scope`を指定しない場合はリポジトリ全体を確認する。独立レビュー、監査集合、リリース準備では、これを既定とする。`--scope <PATH>`は、修正途中など、明示的に限定した中間確認だけに使用する。範囲指定時も、直接の参照元・参照先へ確認範囲を広げ、基本構造や明示された安定コンテキストIDの一意性等の全体不変条件を確認し、未確認範囲を表示する。範囲指定結果を全体確認済みとして扱わない。

親エージェントは、対象範囲、対象改訂版、チェッカーの改訂版、指摘、実行できなかった確認、実行時点、確認件数を共通入力として各確認者へ渡す。確認者は、結果がない、失効している、不足している、または対象範囲が異なる場合を除き、同じ機械確認を繰り返さない。対象ファイル、対象範囲またはチェッカーを変更した場合は、親エージェントが新しい改訂版へ一度再実行する。

チェッカーはAIの確認負荷を減らす補助であり、準拠を決める正本ではない。Node.jsまたは配布実装を利用できない場合は、AIが同等の確認を行い、未確認事項を示せばよい。チェッカーの合格は、独立レビュー、専門品質確認またはCRDD監査を代替しない。

### 主要な運用境界

- `00_CRDD/`内の正本文書名は`01_Principles.md`、`27_Architecture.md`のように二桁の文書番号を一度だけ使用し、フォルダ番号を重ねた`00_01_*`、`00_27_*`にはしない。文書番号は安定コンテキストIDではない。標準の安定コンテキストIDは`REQ`、`UX`、`IA`、`UI`、`SPEC`に限定する。`CHG-*`は変更トレースの成果物IDであり、プロダクトコンテキストの安定IDではない。
- 根拠は成果物内または最も近い親フォルダの`Evidence/`へ置く。判断の結果は結果となる正本成果物へ反映し、判断理由、根拠、代替案、履歴を同じ成果物へ残す。リポジトリ直下の根拠／判断フォルダを基本構成にしない。
- 新しい根拠、不確実性、要求は`01_Discovery`へ置く。未採用の入力を後から再検討するため、候補ファイル、識別子、固定状態を必須にせず任意に保持してよい。`99_Roadmap`は未完了作業の登録簿とし、アイデア、延期した要求、不具合、技術負債、移行、未解決の監査指摘、進行中の変更トレースの存在、現在状態、参照先を横断して索引する。意味、根拠、判断理由は責務を持つ正本成果物へ残す。登録簿への登録だけでは、採用、優先順位の確定、実行の許可を意味しない。ロードマップ項目へCRDD安定コンテキストIDを付与しない。
- 課題探索・要求形成からアーキテクチャまでは、[文書化](03_Documentation.md#31-basic-structure)が定める工程ごとの固定入口を使用する。リスクや複雑性が変わっても入口名や基本のファイル分割を変えず、同じ入口内の記述、レビュー、根拠、詳細参照の深さを調整する。固定入口はリンクだけの索引ではなく、工程全体の対象範囲、網羅状態、主要な結論と判断、検証義務、未解決事項、次工程への義務を直接示す。詳細な正本成果物の内容は複製せず、決定権限、改訂版、現在状態、参照を示す。
- `40_Develop`にはコード、構成、移行、ビルド定義、テストを置き、CRDD管理用Markdownを置かない。
- `07_Quality`には品質戦略、検証設計、確定済み検証結果とQuality Centerを置く。検証義務や根拠を中央へ複製しない。CIやテスト実行ツールを使っても、品質状態、判断理由、未検証範囲、残存リスク、再現方法はリポジトリ内から理解できるようにし、外部リンクや実行IDだけを品質保証記録にしない。単体試験が適用される場合は分岐網羅率`100%`を既定目標とし、未達または除外ごとに対象、残るリスク、代替確認、担当責任者、再確認条件を明示する。
- 外部コミュニケーションを扱う場合だけ`80_Communication/01_Communication.md`を単一入口として使う。生成可能な表現と公開済み記録を分け、主張を根拠へ接続し、外部反応は人間が採用するまで観察または学び候補として扱う。扱わないRepositoryにはフォルダを作らない。
- 意味を参照するコンテキスト依存と、版付き成果物を使う成果物依存を区別する。完全な依存契約はコンテキスト依存、採用組織の独立管理利用側間で意味・契約・採用版・更新判断の横断調整を必要とする成果物依存、または重大リスクにより明示管理する成果物依存へ適用する。外部提供元とのAPI契約、別権限、独立リリースだけでは発火させない。通常・推移依存は既存のアーキテクチャやパッケージ管理を正本にでき、存在だけで個別CHGや都度の人間判断を要求しない。Repository、Submodule、パッケージのいずれかを共通方式として固定しない。
- `19_Workflows`にはリポジトリ固有の反復可能な作業手順を置く。変更トレースは`90_Release/Changes/CHG-*.md`へ置く。その他の`90_Release`は、リリース記録、配布物参照、リリース検証が必要なプロジェクトでだけ使用する。
- 独立レビューまたは監査集合の前に、親AIエージェントが固定した対象改訂版へ`node tools/crdd_check.mjs`または同等の機械確認を一度実行し、結果を共有する。配布実装の利用は任意であり、文書監査、専門品質確認、準拠監査または不足／影響監査を代替しない。
- ガバナンス、セキュリティ、プライバシー、アクセシビリティ、互換性、処理能力、コストは、終盤で独立して確認する項目ではなく、適用される上流・下流工程の責務として扱う。
- CRDD正本文書は読者の主要ロケールを優先する。用語は初出時に日本語表示名と正式英語名を併記し、その後の説明文、見出し、説明用の表では日本語表示名を基本とする。正式英語名は共通の別名として保持し、安定コンテキストID、エージェントID、ファイル名、スキーマのキー／値、コードは翻訳しない。規範強度を曖昧にできない箇所では、BCP 14キーワードを併記する。

配置、成果物、根拠、判断、安定コンテキストID、追跡可能性の正本は[文書化](03_Documentation.md)、リポジトリと文書体系の完全な地図は[概要](00_Overview.md)を参照する。

### 文書の導線

| 目的 | ここから読む |
|---|---|
| CRDDと不変条件を理解する | [原則](01_Principles.md) |
| リポジトリと文書体系の全体像を確認する | [概要](00_Overview.md) |
| 正式概念、状態、決定権限の用語を確認する | [用語](02_Terminology.md) |
| リポジトリ、成果物、根拠、判断、ID、追跡関係を設計する | [文書化](03_Documentation.md) |
| AI作業を実行・委譲する | [エージェント](10_Agent.md)と[スキル](11_Skill.md) |
| 変更、プロダクトリリース、反復作業を扱う | [変更](12_Change.md)、[リリース](13_Release.md)、[作業手順](14_Workflow.md) |
| 開発方式を問わず進捗と健全性を把握する | [進捗管理](15_Progress.md) |
| 各工程の品質条件、検証設計、結果、現在状態を接続する | [品質保証](16_Quality_Assurance.md) |
| 外部向けの表現、公開判断、公開後の学びを扱う | [外部コミュニケーション](17_Communication.md) |
| 意味上の依存と版付き成果物依存を管理する | [コンテキスト依存](18_Context_Dependency.md) |
| プロダクト工程を適用する | [工程正本一覧](00_Overview.md#33-product-phase-authorities)から、該当する`21`〜`29`の正本を読む |
| CRDD標準自体を保守する | [保守](19_Maintenance.md) |
| 新しいCRDD基準版の差分を評価して採用する | [基準版採用評価](19_Maintenance.md#62-baseline-adoption-assessment) |
| v0.4.2採用リポジトリをv0.5.xへ移行する | [過去の移行案内: v0.4.2からv0.5.xへの更新](#historical-migration-v042-v05x-ja) |
| 文書、準拠、工程横断影響を監査する | [文書監査](51_Document_Audit.md)、[準拠監査](52_Conformance_Audit.md)、[不足／影響監査](53_Gap_Impact_Audit.md) |
| 問題報告、規則変更提案、採用フィードバックを行う | [コントリビューションガイド](CONTRIBUTING.md) |

### Contribution

公開の問題報告（Problem Report）、標準変更提案（Standard Change Proposal）、採用フィードバック（Adoption Feedback）、プルリクエストを受け付ける。ただし、提案されたこと自体はCRDDへの採用を意味しない。

提案は、根拠、影響、代替案、決定権限、監査、リリースを確認する[CRDDの保守](19_Maintenance.md)の経路へ接続する。規範変更（Normative Change）または破壊的変更（Breaking Change）を提案する前に、[CONTRIBUTING.md](CONTRIBUTING.md)を確認する。

### ライセンス

CRDDは[Apache License 2.0](LICENSE)で提供する。文書およびリポジトリ内のその他の著作物すべてが対象である。商標は対象から除く。CRDD、Qual-Lab、Qualの名称、ロゴおよび関連するブランド要素は[TRADEMARK.md](TRADEMARK.md)で別に扱う。Apache License 2.0は、第6条が認める限定的な使用を超える商標権を付与しないためである。

同ライセンスの条件に従う商用利用は認められる。Qual-Labとの別の商用著作権ライセンス契約は必要ない。上記の商標の条件は引き続き適用される。

当初CC BY-NC-SA 4.0で配布したリリースを含め、CRDDの全バージョンをApache License 2.0で提供する。該当する内容はQual-Labが著作したものであり、この条件で提供する。旧ライセンスで取得した利用者へ既に付与した許諾は取り消しておらず、そのまま有効である。
