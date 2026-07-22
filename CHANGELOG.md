# CRDD Changelog

All notable changes to CRDD itself (the methodology documents in this folder) are recorded here.
CRDD自身（このフォルダ内のメソドロジー文書）の変更履歴を記録する。

**[English](#english)** | **[日本語](#日本語)**

---

## English

### v0.5.1 — Standard Repository Operations, Migration, and Readability (2026-07-22)

Compared with v0.5.0:

- Adds root `AGENTS.md` and a minimal `CLAUDE.md` as tool-neutral adapters for maintaining the CRDD standard repository.
- Defines scope, baseline, Human authority, stop conditions, review boundaries, and default Git handling for standard maintenance without requiring every Editorial change to create an Issue or run every Audit.
- Adds bilingual migration guidance from v0.4.2 to v0.5.x. It covers document renames, the `00_00_Overview.md` exception, project Artifact and local-adapter preservation, reference validation, conditional Gap / Impact Audit, and rollback readiness.
- Makes the three existing public Issue Forms bilingual without adding intake types or required fields. They assign only the three intake labels; status, classification, approval, and release control remain official-repository adapters rather than CRDD adoption requirements.
- Defines locale-first documentation and AI communication without creating per-language canonical documents. The primary locale is used for reader-facing content; canonical English aliases and interoperable identifiers remain unchanged.
- Aligns normative wording with BCP 14 (RFC 2119 and RFC 8174). Japanese-first text retains uppercase `MUST`, `MUST NOT`, `SHOULD`, `SHOULD NOT`, and `MAY` where requirement strength must be explicit; lowercase English words do not acquire BCP 14 meaning.
- Reworks Terminology with Japanese-first display names, canonical English aliases, one-line explanations, localized field labels, and examples for commonly confused concepts.
- Reworks all 22 canonical documents for human readability without weakening their rules. They add short reading guides and separate dense rules into conclusions, conditions, responsibilities, exceptions, and completion criteria while retaining legacy heading anchors.
- Applies locale and readability rules to human-facing Artifacts in adopting projects, not only to CRDD's own documents. A lightweight readability self-check runs before Human presentation or normal Handoff; misunderstanding that could affect decisions or downstream work triggers Document Audit or an equivalent independent review.
- Keeps Conformance and Gap / Impact Audit focused on semantic consistency, and aligns root and starter Agent instructions, README, Overview, and document headers with the v0.5.1 baseline.

v0.5.1 does not change the phase model, Property Authority, Conformance boundary, required Artifact set, or Stable Context ID semantics. The standard Stable Context ID set remains `REQ`, `UX`, `IA`, `UI`, and `SPEC`.

### v0.5.0 — Context Propagation and Public Maintenance (2026-07-21)

Compared with v0.4.2, v0.5.0 changes the published CRDD model as follows:

- Enforces the existing transformation invariant that downstream Human decisions, constraints, learning, evidence, and findings must propagate back to affected upstream and peer context. A Triggered Propagation Check now scans unresolved questions, gaps, assumptions, decisions, and constraints; remediates the owning canonical artifacts; rescans forward impact; and re-audits before normal completion or phase transition.
- Makes Gap / Impact Audit the independent execution route for mandatory propagation checks and adds explicit result, exception, remediation, and re-audit requirements. Recording a decision only in a downstream artifact, completing an audit run, or assigning a finding does not by itself complete propagation.
- Renames the 22 canonical CRDD documents from the repeated `00_YY_*` pattern to a single two-digit Document Number such as `01_Principles.md`, `27_Architecture.md`, and `53_Gap_Impact_Audit.md`. Adopters updating to v0.5.0 must rename copied standard documents and update references; Document Numbers remain separate from Stable Context IDs.
- Adds a bilingual, non-normative plain-language introduction and ten-term reading aid to the README while retaining `02_Terminology.md` as the canonical definition authority.
- Adds `CONTRIBUTING.md`, Problem Report, Standard Change Proposal, and Adoption Feedback issue forms, and a pull request template. Public submissions enter CRDD Maintenance as candidates and do not become rules solely because they were proposed, discussed, voted on, or closed.
- Clarifies Issue-driven Maintenance without prescribing a specific AI provider, Agent topology, label set, branch-protection implementation, or tracking tool. Intake type and change classification are separate; triage, execution authorization, and adoption or release approval remain distinct Human decisions; executable status does not itself invoke an executor or approve a protected change.
- Connects tracked maintenance work to a tool-neutral scope, baseline, expected-result, review, audit, and stop contract; requires applicable propagation checks, independent review, finding remediation, re-review of the updated revision, and return of the final disposition to the intake source.
- Adds a lightweight release disposition for tracked maintenance: `Integrated — Pending Release`, `Released`, or `Close without Release`. An issue may close after integration without claiming release; a target release or release-plan reference aggregates pending changes, and the CRDD GitHub repository may use a version milestone as an optional adapter without requiring it in adopting repositories.
- Strengthens human-centered quality without adding a competing canonical document or central audit registry. UX owns goal completion, cognitive load, understandable state, error recovery, and inclusion outcomes; IA owns mental-model-aligned structure and findability; UI owns a versioned, scoped Accessibility Profile and interaction semantics; Behavior Specification owns equivalent alternative-operation behavior; Verification evaluates applicable normative and informative criteria with fresh evidence, time-bounded exceptions, and re-verification triggers; Release accounts for unresolved normative findings and residual risk.
- Strengthens Requirements Engineering without adding a separate requirements authority, audit registry, folder tree, or Stable Context ID. Discovery now preserves the path from raw source through evidence, interpretation, problem, optional Need / Desired Outcome, Requirement Candidate, and Human adoption; gates individual promotion on necessity, singular meaning, trace, scope, appropriate abstraction, feasibility or explicit risk, and a Verification Obligation; and evaluates Requirement Set coverage, consistency, and jointly feasible scope. A project-selected Quality Concern Profile flows through Behavior Specification and Architecture into Verification, while Verification distinguishes contract conformance from validation against the originating Need / Desired Outcome.
- Adds a minimal external-source trace model without creating another canonical document or ID system. The README points to an Overview source index; Documentation defines `uses`, `derived_from`, `aligned_with`, `informed_by`, and `project_adopts` relations and limits coverage claims; Discovery, UI, and Behavior Specification map only their explicitly used or project-selectable sources; Document Audit checks the trace when an external source is materially used. The index records ISO/IEC/IEEE 29148:2018, ISO/IEC/IEEE 15288:2023, ISO/IEC/IEEE 12207:2026, and ISO/IEC 25010:2023 as selected or background sources without claiming clause coverage or conformance.
- Treats public intake files and repository controls as CRDD official-repository adapters rather than requirements for adopting product repositories or CRDD Conformance. The Overview and Maintenance impact paths include affected public guidance and intake adapters without adding them to the product-repository Document Audit contract.
- Aligns all canonical document headers, README status, starter entry files, Change and Roadmap templates, references, and release-facing guidance with the v0.5.0 baseline.

Stable Context ID semantics do not change in v0.5.0: the standard set remains `REQ`, `UX`, `IA`, `UI`, and `SPEC`. Issue identifiers, Change Traces, decisions, evidence, architecture, implementation, verification, and repository operation artifacts do not receive additional CRDD Stable Context IDs.

### v0.4.2 — Phase Transition Review Enforcement (2026-07-19)

Compared with v0.4.1, v0.4.2 changes the published CRDD model as follows:

- Makes an independent Phase Transition Review a required input before every normal phase Handoff. The review evaluates a fixed scope and revision against the sending phase's Exit Contract, Phase Gate Criteria, and Phase Audit Checklist, together with the receiving phase's Entry Contract.
- Requires AI-created or AI-transformed output to be reviewed through a separately executed Review Subagent, a clean-context session or Agent, or a Human reviewer. Review performed only within the same Active Context that created the output does not qualify as independent Phase Transition Review.
- Adds a mandatory pre-Handoff remediation loop. Transition-affecting findings return to the responsible phase for correction; the resulting revision must be frozen and reviewed again until it passes. Audit completion, a Conditional result, assignment of an owner, or transfer of a finding does not constitute Pass.
- Defines an explicit Human-directed `review_exception` as the only route for skipping the review. The exception records the unreviewed scope and revision, reason, known risk and impact, owner, required re-review condition, and expiry or reopening condition. Partial Handoff does not waive review for the scope being transferred.
- Defines tool-neutral execution role adapters for Phase Transition Review, Document Audit, Conformance Audit, Gap / Impact Audit, and Verification Review: `agent.phase_transition.review`, `agent.document.audit`, `agent.conformance.audit`, `agent.gap_impact.audit`, and `agent.verification.review`. These identifiers are execution roles rather than Stable Context IDs, Artifact IDs, or Document Numbers, and audit roles remain read-only and non-authoritative.
- Wires the review result, reviewed revision, finding disposition, and any approved exception into the Entry, Exit, Phase Gate, Phase Audit Checklist, and Handoff View of Discovery through Verification, including the UI / Behavior Specification Pair Contract.
- Aligns Conformance requirements PL-06, AD-04, and AD-16 with independent transition review and remediation, and corrects the Conformance claim ranges so that the already-defined PL-10, PL-11, and AD-17 requirements are included.
- Aligns the Overview, repository entry points, starter Agent instructions, and all canonical document headers with the v0.4.2 Release Baseline.

Stable Context ID semantics do not change in v0.4.2: the standard set remains `REQ`, `UX`, `IA`, `UI`, and `SPEC`.

### v0.4.1 — Decision Support and Roadmap Activation (2026-07-19)

Compared with v0.4.0, v0.4.1 changes the published CRDD model as follows:

- Strengthens guided Human decision support across both Agents and Skills. Questions that can change canonical meaning, scope, responsibility, defaults, priority, accepted risk, or downstream contracts must explain user, business, and product impact; compare meaningful alternatives; provide a recommendation with its decisive criteria, evidence or professional basis, confidence, uncertainty, reversal conditions, and deferral impact; and distinguish the AI recommendation from the Human decision. Compact, Standard, and Extended views preserve this content without forcing the same presentation size for every decision.
- Separates `Undispositioned Gap`, `Unresolved Gap`, and `Open Question`. A Deferred, Accepted Risk, or Out-of-Scope disposition does not by itself resolve a Gap; unresolved work retains its disposition, owner, impact, next route, and resolution or reevaluation condition. Human-facing output must describe the unresolved matter and impact instead of presenting labels such as `Open Gap` alone.
- Tightens phase completion and partial Handoff behavior. AI must evaluate the full active Discovery / phase scope and required responsibility coverage instead of inferring completion from one highly developed Artifact, one Skill Run, implementation completion, or passing tests. Partial Handoff remains item- and scope-specific, requires explicit Human authorization, and does not stop unrelated routes.
- Adds an end-to-end configuration and adaptation path. UX extracts and classifies Control / Adaptation Needs without turning every variation into a user setting; IA owns configuration meaning, owner, subject, scope, and inheritance relationships; UI owns understandable Settings / Control surfaces; Behavior Specification owns options, defaults, precedence, permissions, effects, and recovery; Architecture owns the technical configuration mechanism; Implementation realizes it; and Verification checks the applicable variants and results.
- Clarifies the UI / Behavior Specification phase layout by changing the starter paths from `04_Spec` and `05_UI` to `04_UI` and `05_SPEC`. The numbering remains an exploration order rather than an authority or waterfall order, and UI and Behavior Specification remain parallel, iterative phases joined by the shared Pair Contract. Adopters must rename these two project folders and update affected Artifact references.
- Makes Roadmap routing executable rather than advisory. Accepted but deferred work must be registered in a single `99_Roadmap/01_Product_Roadmap.md` Main View, with optional Detail files only when needed for readability. Roadmap Items retain their source Context, owner, priority, target, dependencies, start condition, reevaluation trigger, risk, and Human decision reference; they move through Deferred, Ready for Start Review, Started, Completed, or Cancelled states under Project-specific Roadmap Authority.
- Connects Roadmap activation to Change Trace and cleanup. A Human start decision creates a `CHG-*` after the current Context revision and impact are reevaluated. Completion returns applicable canonical Artifact, implementation, verification, and CHG references—or a reasoned `Not Applicable` result—to the Main View. Detail-only information is first promoted to its proper authority, then the completed Detail file is deleted rather than retained as a permanent Roadmap archive. Pending registration blocks only the affected Item, and normal execution reviews only Roadmap Items relevant to the active scope or a reached trigger.
- Adds an integrated Overview flow connecting incoming triggers, Discovery, Human routing, Roadmap, Change Trace, selective phase start or reopening, UI / Behavior Specification pairing, Architecture, Implementation, Verification, optional Release, Learning, closure, and Roadmap Detail cleanup. Discovery and the starter Roadmap also contain focused lifecycle diagrams.
- Extends Conformance and Gap / Impact Audit criteria for decision-support quality, configuration propagation, Roadmap registration and activation, item-scoped pending states, current-impact reassessment, result references, justified non-applicability, and Detail cleanup. The starter template now includes a non-normative `99_Roadmap/01_Product_Roadmap.md` Project view, while `template/AGENTS.md` and `template/CLAUDE.md` route Roadmap activity to the canonical Discovery and Change authorities without duplicating their rules.

Stable Context ID semantics do not change in v0.4.1: the standard set remains `REQ`, `UX`, `IA`, `UI`, and `SPEC`; Roadmap Items, Detail files, Change Traces, Decisions, Evidence, Architecture, Implementation, and Verification do not receive additional CRDD Stable Context IDs.

### v0.4.0 — Document Architecture Consolidation (2026-07-17)

Compared with v0.3.0, v0.4.0 changes the published CRDD model as follows:

- Replaces the overlapping v0.3 document set with 22 responsibility-oriented authorities: Foundation (`00_00`–`00_03`), shared execution and operations (`00_10`–`00_19`), product phases (`00_21`–`00_29`), and audits (`00_51`–`00_53`). The `00_30`–`00_49` range is reserved instead of retaining a separate Practice Guide and Skill Execution layer.
- Consolidates CRDD definition, end-to-end continuity, Human / AI authority, scoped Handoff approval, and the minimum Conformance boundary in `00_01_Principles.md`; limits `00_02_Terminology.md` to canonical definitions; and centralizes repository, Artifact, Evidence, Decision, Stable Context ID, and traceability rules in `00_03_Documentation.md`.
- Consolidates Agent and Subagent delegation, authority, access, integration, and independent-review rules in `00_10_Agent.md`, without prescribing a fixed Agent topology. Consolidates the Skill lifecycle, guided interaction, status, resume, review, and Handoff contract in `00_11_Skill.md`, with Git and Markdown treated as optional execution adapters.
- Reorganizes Discovery through Verification as a contiguous set of phase authorities. Each phase owns its entry, transformation, responsibility coverage, Human decisions, exit, Handoff, reopening conditions, and audit criteria; receiving phases own their entry contracts, and partial Handoff requires explicit Human approval of scope, gaps, risks, and ownership.
- Keeps UI and Behavior Specification as parallel phases connected by `00_24_UI_Behavior_Specification.md`, then adds `00_28_Implementation.md` and establishes `00_29_Verification.md` as an independent phase. Architecture owns project implementation rules under `06_Architecture`, Implementation owns code and developer tests, and Verification evaluates the target revision without changing production code or weakening acceptance criteria.
- Distributes Development Stack, Context Transformation, product-documentation coverage, governance, security, privacy, cost, compatibility, evolution, architecture integration, and testing responsibilities to the Principles, Documentation, and phase authorities that own them, removing the former standalone and overlapping documents without reducing their normative coverage.
- Replaces Change Context Packages with lightweight Change trace logs in `90_Release/Changes/CHG-*.md`. A CHG record connects its trigger, expected and actual impact, affected canonical Context, implementation, verification, release disposition, and closure; `CHG-*` is an Artifact ID, not a Stable Context ID.
- Adds `00_13_Release.md` for optional product-release handling after Verification, including Human Release Authority, Release Records, distribution references, release verification, and CHANGELOG boundaries. Adds `00_14_Workflow.md` and limits `07_Workflows` to repository-specific repeatable procedures rather than Change or Release records.
- Consolidates CRDD's own learning, change approval, versioning, migration, released-error correction, and audit connections in `00_19_Maintenance.md`.
- Replaces the standalone Phase Gate and Conformance documents with distributed phase criteria and three executor-independent audits: `00_51_Document_Audit.md`, `00_52_Conformance_Audit.md`, and `00_53_Gap_Impact_Audit.md`. The audits may be performed by a Human reviewer, parent Agent, or delegated Subagent.
- Centralizes the existing v0.3 Stable Context ID, Evidence, and Decision rules without changing their semantics: the Stable Context ID set remains `REQ`, `UX`, `IA`, `UI`, and `SPEC`; Evidence remains inline or under the nearest parent `Evidence/`; Decision rationale remains with the resulting canonical Artifact; and `40_Develop` remains limited to implementation Artifacts rather than CRDD management Markdown.
- Standardizes document headers and reference semantics: `Owner` precedes type-specific identity fields, `Related` filenames are ordered by Document Number, and runtime Context Selection adds authorities required by the active scope instead of treating `Related` as an exhaustive read set.
- Rebuilds `00_00_Overview.md` and `README.md` as non-duplicating entry points; updates template `AGENTS.md` and `CLAUDE.md` for the consolidated architecture and scope-based Context Selection; removes `template/07_Workflows/Changes/`; and adds a CHG template under `template/90_Release/Changes/`.
- This is a breaking documentation-architecture update. Adopters replace the v0.3 standard-document set and update entry-file references, while retaining project canonical Artifacts and existing Stable Context IDs unless their meaning changes.

### v0.3.0 — Stable IDs and Behavior Specifications (2026-07-16)

Compared with v0.2.0, v0.3.0 changes the published CRDD model as follows:

- Separates Artifact numbering and filenames from Stable Context IDs. A document may contain multiple Stable IDs, while Artifact references use paths, anchors, and revisions as needed; Stable IDs are not embedded in document filenames or directory names.
- Limits the standard Stable ID set to `REQ`, `UX`, `IA`, `UI`, and `SPEC`. Architecture, Decision, Evidence, Change, Test, and other Artifacts are traced by Artifact reference rather than additional standard prefixes.
- Defines `Requirement` and `Behavior Specification` as distinct canonical concepts. `REQ-*` identifies requirements established through Discovery, while `SPEC-*` identifies specified system behavior under defined conditions and states.
- Replaces the canonical terms `Behavior Requirement` and `Behavior Contract` with `Behavior Specification`, including the corresponding standard and Skill filenames. Existing `REQ-*` IDs that already represent behavior specifications remain valid legacy IDs and are not renumbered solely for terminology alignment.
- Makes the approved Canonical Artifact the result of a decision. Its Decision / Rationale Section records rationale, alternatives, supporting Evidence, and history; Decision does not require a separate CRDD Stable ID or central decision ledger.
- Places Evidence inline with the Artifact that uses it or in the nearest parent folder's `Evidence/`. Evidence records include source, revision or observation time, acquisition conditions, provenance, and limitations, and require no separate CRDD Stable ID.
- Defines `01_Discovery` as the intake and authority for observations, uncertainty, and `REQ-*`. Defines `99_Roadmap` as the scheduling view for accepted but deferred work; Roadmap entries reference Stable Contexts without receiving their own CRDD Stable IDs.
- Adds explicit initial-development and maintenance routes for customer interviews, regulatory changes, specification changes, defects, and requests whose defect-versus-change classification is unresolved.
- Standardizes the starter template around domain-local `Evidence/`, `07_Workflows/Changes/`, and `90_Release/Evidence/`. `40_Develop` contains implementation Artifacts rather than CRDD management Markdown.
- Extends document auditing to distinguish Artifact numbering from Stable ID validation and to detect ambiguous heading anchors, duplicated authority, inconsistent terminology, missing propagation, and broken traceability.

### v0.2.0 — Context Continuity and Git / Markdown Execution (2026-07-16)

Compared with v0.1.0, v0.2.0 changes the published CRDD set as follows:

- Completes the previously experimental Core Concepts / Terminology and Conformance definitions, and adds an end-to-end model of Context continuity and the CRDD Development Stack.
- Extends the Core Standard from repository, provenance, decision, responsibility, change-control, and document rules to also cover Context transformation, Discovery, UI / Behavior contracts, and traceability.
- Reorganizes the Operational layer around a single CRDD maintenance standard and adds phase-gate approval, Change Context Packages, gap / validation / impact handling, Agent I/O contracts, and guided Context creation.
- Updates the optional Practice Guides, including the product documentation model and the minimum UX / IA / UI deliverables, and normalizes their canonical filenames.
- Expands the four-band v0.1.0 document model with a `40`–`49` Git / Markdown Skill Execution layer and a `50`–`59` Agent Execution layer, covering Guided Skills, reproducible repository execution, Subagent orchestration, and document audit.
- Aligns the repository entry point and starter template with the v0.2.0 structure, including `README.md` and the template `AGENTS.md` / `CLAUDE.md` instructions.

### v0.1.0 — Initial Public Release (2026-07-15)

First public release of CRDD, organized into four layers by numbering band.

#### Overview (`00_00`–`00_03`)

- CRDD Overview, Principles
- Terminology (Experimental — glossary skeleton, definitions pending)
- Conformance (Experimental — conformance model pending)

#### Core Standard (`00_10`–`00_15`)

- Context Repository Standard
- Information Type and Provenance
- Decision Record Standard
- Human and AI Responsibility
- AI Change Control
- Document Standard

#### Operational (`00_20`–`00_27`)

- Context Feedback Loop
- Context Repository Audit
- CRDD Change and Versioning (Experimental — versioning policy pending)

#### Practice Guide (`00_30`–`00_35`, optional)

- Product Documentation Guide
- Subagent Practice Guide (reference agent model)
- Testing and Quality Guide
- AI Governance and Security Guide
- Compatibility and Evolution Guide
- Architecture and Integration Guide

#### Also included

- [LICENSE](LICENSE) — CC BY-NC-SA 4.0 for CRDD documentation and other copyrightable materials
- [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md) — what counts as commercial use, and how to obtain a commercial license
- [TRADEMARK.md](TRADEMARK.md) — separate policy for the CRDD / Qual-Lab names and marks
- [README.md](README.md) — entry point for this folder

---

## 日本語

### v0.5.1 — 標準Repository運用・Migration・可読性改善（2026-07-22）

v0.5.0からの変更:

- CRDD標準RepositoryをMaintenanceするためのTool非依存な実行Adapterとして、Root `AGENTS.md`と最小限の`CLAUDE.md`を追加した。
- 標準MaintenanceのScope、Baseline、Human Authority、停止条件、Review境界、Gitの既定動作を定める一方、すべてのEditorial ChangeでIssue作成や全Audit実行を要求しない。
- v0.4.2からv0.5.xへの日英Migration案内を追加した。正本文書のRename、`00_00_Overview.md`の例外、Project ArtifactとLocal Adapterの保持、参照・Anchor検証、条件付きGap / Impact Audit、任意のSubmodule・Change Trace運用、Rollback可能性を扱う。
- 既存3種類の公開Issue Formを、受付種別や必須項目を増やさず日英併記にした。指定するLabelは`type:problem`、`type:standard-change`、`type:adoption-feedback`だけとし、Status、変更分類、承認、Release管理はCRDD採用要件ではなく公式RepositoryのAdapterとして維持する。
- 言語ごとに別の正本を作らず、利用者ロケールを優先する文書・AI対話規則を追加した。説明、見出し、Field表示名、質問、判断支援は主要ロケールを優先する。正式英語名は共通Aliasとして保持し、ID、File名、Schema値、Codeは互換性を持つ識別子として翻訳しない。
- 規範表現をBCP 14（RFC 2119およびRFC 8174）と対応付けた。日本語表示を先にしつつ、規範強度を明示する箇所では大文字の`MUST`、`MUST NOT`、`SHOULD`、`SHOULD NOT`、`MAY`を保持し、小文字英語へBCP 14の意味を付与しない。
- Terminologyを、日本語表示名、正式英語Alias、一言説明、日本語Field名、混同しやすい概念の例で再構成した。
- 22の正本文書を、Ruleを弱めず人間が読みやすい構成へ再編した。短い読書案内を追加し、密度の高い文章を結論、条件、責任、例外、完了条件へ分離した。変更した見出しでは旧Anchorを保持する。
- ロケールと可読性のRuleを、CRDD自身の文書だけでなく、採用Projectで人間が読むArtifactにも適用した。人間への提示または通常Handoff前に軽量な可読性Self-checkを行い、誤読が判断や後続作業へ影響し得る場合はDocument Auditまたは同等の独立Reviewへ渡す。
- Conformance AuditとGap / Impact Auditでは翻訳量ではなく意味の一致を評価する。RootとStarterのAgent指示、README、Overview、全正本文書Headerをv0.5.1 Baselineへ揃えた。

v0.5.1では、工程モデル、Property Authority、Conformance境界、必須Artifact集合、Stable Context IDの意味を変更しない。標準Stable Context IDは引き続き`REQ`、`UX`、`IA`、`UI`、`SPEC`の5種である。

### v0.5.0 — Context伝播と公開Maintenance（2026-07-21）

v0.4.2と比較して、v0.5.0の公開CRDDモデルを次のように変更した。

- 下流で確定・変更されたHuman Decision、Constraint、Learning、Evidence、Findingを、影響する上流・同層Contextへ戻す既存のTransformation Invariantを実行可能にした。Triggered Propagation Checkは、Open Question、Gap、Assumption、Decision、Constraintを探索し、責務を持つCanonical Artifactを修正し、下流Impactを再探索して、通常完了または工程移行前に再監査する。
- Mandatory Propagation Checkの独立実行経路をGap / Impact Auditへ置き、結果、Exception、Remediation、再監査の要件を追加した。下流ArtifactへのDecision記録、Audit Run完了、FindingへのOwner付与だけではPropagation完了としない。
- 22個のCRDD正本文書名を、重複した`00_YY_*`形式から、`01_Principles.md`、`27_Architecture.md`、`53_Gap_Impact_Audit.md`等の二桁Document Numberを一度だけ使用する形式へ変更した。v0.5.0へ更新する採用Repositoryは、コピー済み標準文書をRenameし、参照を更新する。Document NumberとStable Context IDは引き続き別の識別体系である。
- READMEへ日英の非規範な平易説明と主要10用語の理解補助を追加した。正式な定義のAuthorityは`02_Terminology.md`に維持する。
- `CONTRIBUTING.md`、Problem Report、Standard Change Proposal、Adoption FeedbackのIssue Form、およびPull Request Templateを追加した。公開提案はCRDD MaintenanceのCandidateとして扱い、提案、Discussion、投票、Issue CloseだけでRuleへ昇格しない。
- 特定AI Provider、Agent構成、Label一式、Branch Protection実装、追跡Toolを規定せず、Issue-driven Maintenanceの境界を明確化した。受付種別とChange Classificationを分離し、Triage、Execution Authorization、Adoption / Release Approvalを異なるHuman Decisionとして扱う。実行可能Statusだけでは実行主体の起動またはProtected Change承認にならない。
- 追跡対象Maintenanceを、Tool-neutralなScope、Baseline、Expected Result、Review、Audit、Stop Contractへ接続した。適用されるPropagation Check、Independent Review、Finding修正、更新Revisionの再Review、受付元への最終Disposition返却を完了経路へ追加した。
- 追跡対象Maintenanceへ`Integrated — Pending Release`、`Released`、`Close without Release`の軽量なRelease Dispositionを追加した。Issueは統合後にRelease済みと表示せずCloseでき、Target ReleaseまたはRelease Plan Referenceで未Release変更を集約する。CRDD公式GitHub RepositoryではVersion Milestoneを任意Adapterとして使用できるが、採用Repositoryへ同じToolを要求しない。
- 競合する正本文書や中央Audit Registryを増やさず、人間中心品質を強化した。UXはGoal完了、認知負荷、理解可能な状態、Error回復、包摂性Outcome、IAはMental Modelに沿う構造とFindability、UIはVersionとScopeを持つAccessibility ProfileとInteraction Semantics、Behavior Specificationは代替操作の同等Behaviorを所有する。Verificationは適用するNormative / Informative CriteriaをFresh Evidence、期限付き例外、再Verification Triggerとともに評価し、Releaseは未解決のNormative FindingとResidual Riskを確認する。
- 独立した要求正本、Audit Registry、Folder Tree、Stable Context IDを追加せず、Requirements Engineeringを強化した。DiscoveryはRaw SourceからEvidence、Interpretation、Problem、任意のNeed / Desired Outcome、Requirement Candidate、Human Adoptionまでを保持する。個別Requirementの昇格には必要性、単一の意味、Trace、Scope、適切な抽象度、実現可能性または明示Risk、Verification Obligationを要求し、Requirement SetとしてCoverage、Consistency、組合せ上の実現可能性を評価する。Projectが選択したQuality Concern ProfileをBehavior Specification、Architecture、Verificationへ渡し、VerificationではContract適合確認と、元のNeed / Desired Outcomeに対するValidationを区別する。
- 新しい正本文書またはID体系を作らず、最小の外部Source Traceを追加した。READMEはOverviewのSource索引へ案内し、Documentationは`uses`、`derived_from`、`aligned_with`、`informed_by`、`project_adopts`のRelationとCoverage Claimの境界を定義する。Discovery、UI、Behavior Specificationは、明示的に使用またはProjectで選択するSourceだけを対応づけ、Document Auditは外部Sourceを実質的に使用する場合のTraceを確認する。索引にはISO/IEC/IEEE 29148:2018、ISO/IEC/IEEE 15288:2023、ISO/IEC/IEEE 12207:2026、ISO/IEC 25010:2023を選択的または背景Sourceとして記載し、Clause網羅または準拠を主張しない。
- Public Intake FileとRepository ControlをCRDD公式RepositoryのAdapterとして扱い、採用Product RepositoryまたはCRDD Conformanceの必須要件にしない。OverviewとMaintenanceの影響経路では追従対象に含めるが、Product Repository向けDocument Audit Contractへは追加しない。
- すべての正本文書Header、README Status、Starter Entry File、Change / Roadmap Template、参照、公開案内をv0.5.0 Baselineへ整合させた。

v0.5.0でStable Context IDのSemanticsは変更しない。標準Stable Context IDは引き続き`REQ`、`UX`、`IA`、`UI`、`SPEC`の5種であり、Issue識別子、Change Trace、Decision、Evidence、Architecture、Implementation、Verification、Repository運用Artifactへ新しいCRDD Stable Context IDを追加しない。

### v0.4.2 — 工程移行Reviewの実行保証（2026-07-19）

v0.4.1と比較して、v0.4.2の公開CRDDモデルを次のように変更した。

- 通常の工程Handoff前に、独立したPhase Transition Reviewを必須入力とした。固定した対象範囲とRevisionについて、移行元工程のExit Contract、Phase Gate Criteria、Phase Audit Checklist、および移行先工程のEntry Contractをまとめて検証する。
- AIが作成または変換した成果物は、別実行のReview Subagent、Active Contextを引き継がないSessionまたはAgent、もしくはHuman reviewerがReviewすることを必須とした。成果物を作成した同一Active Context内だけの自己Reviewは、独立したPhase Transition Reviewとして扱わない。
- Handoff前の是正ループを必須化した。工程移行に影響するFindingは責任工程へ戻して修正し、新しいRevisionを固定してPassまで再Reviewする。Auditの実行完了、Conditional判定、Ownerの割当、またはFindingの移管だけではPassにならない。
- Reviewを省略できる唯一の経路として、Humanが明示する`review_exception`を定義した。未Reviewの範囲とRevision、理由、既知のRiskとImpact、Owner、必須の再Review条件、失効または再開条件を記録する。Partial Handoffであっても、移管対象範囲のReviewは免除されない。
- Phase Transition Review、Document Audit、Conformance Audit、Gap / Impact Audit、Verification Reviewについて、ツール非依存の実行Role Adapter `agent.phase_transition.review`、`agent.document.audit`、`agent.conformance.audit`、`agent.gap_impact.audit`、`agent.verification.review`を定義した。これらはStable Context ID、Artifact ID、Document Numberではなく、Audit Roleはread-onlyかつ非権限主体である。
- DiscoveryからVerificationまでの各工程とUI / Behavior Specification Pair Contractについて、Review結果、対象Revision、Findingの対処状況、および承認済み例外をEntry、Exit、Phase Gate、Phase Audit Checklist、Handoff Viewへ接続した。
- Conformance要件PL-06、AD-04、AD-16を独立Reviewと是正ループに合わせ、既に定義済みだったPL-10、PL-11、AD-17が適合宣言の対象範囲から漏れていた不整合を修正した。
- Overview、リポジトリ入口、starter Agent指示、および全正本文書のヘッダーをv0.4.2 Release Baselineへ統一した。

v0.4.2でStable Context IDの意味は変更しない。標準セットは引き続き`REQ`、`UX`、`IA`、`UI`、`SPEC`である。

### v0.4.1 — 判断支援とRoadmapの実行化（2026-07-19）

v0.4.0と比較して、v0.4.1の公開CRDDモデルを次のように変更した。

- AgentとSkillに共通する人間判断支援を強化した。Canonical Contextの意味、Scope、責任、Default、Priority、Risk受容、下流Contractを変える問いでは、利用者・業務・Productへの影響、判断価値のある代替案、主要Trade-off、評価基準、Evidenceまたは専門根拠、Confidence／Uncertainty、推奨が変わる条件、保留影響を示し、AIのRecommendationとHuman Decisionを分離する。Compact、Standard、Extendedの表示段階により、判断材料を失わずに小さな判断の可読性を維持する。
- `Undispositioned Gap`、`Unresolved Gap`、`Open Question`を分離した。`Deferred`、`Accepted Risk`、`Out of Scope`等のDispositionだけではGap解消とみなさず、Disposition、Owner、Impact、次Route、解消または再評価条件を保持する。人間向け出力では`Open Gap`等のLabelだけを示さず、残っている未解決事項と影響を具体的に説明する。
- 工程完了と部分Handoffを厳格化した。AIは、一つの完成度が高いArtifact、Skill Run終了、Implementation完了、Test Passから工程全体の完了を推定せず、ActiveなDiscovery／工程Scope全体とRequired Responsibility Coverageを評価する。部分HandoffはItem・Scope単位で人間の明示承認を必要とし、無関係なRouteを停止しない。
- 設定・調整項目の一気通貫経路を追加した。UXはControl / Adaptation Needを抽出・分類し、すべてを利用者向け設定へ変換しない。IAはConfigurationの意味、Owner、Subject、Scope、Inheritance関係、UIは理解可能なSettings / Control Surface、Behavior SpecificationはOption、Default、Precedence、Permission、変更効果、Recovery、ArchitectureはTechnical Configurationの成立方式、Implementationは実現、Verificationは適用Variantと結果を担う。
- starterのUI／Behavior Specification配置を`04_Spec`・`05_UI`から`04_UI`・`05_SPEC`へ変更した。番号は探索順であり、Authority順や固定Waterfallを意味しない。UIとBehavior SpecificationはShared Pair Contractで接続された並行・反復工程のままである。採用Projectは二つのFolderをRenameし、影響するArtifact Referenceを更新する必要がある。
- Roadmap RouteをRecommendationではなく実行可能な契約にした。採用済みDeferred Workは、原則として単一の`99_Roadmap/01_Product_Roadmap.md` Main Viewへ登録し、可読性のため必要な場合だけDetail Fileへ分ける。Roadmap ItemはSource Context、Owner、Priority、Target、Dependency、Start Condition、再評価Trigger、Risk、人間判断参照を保持し、Project固有Roadmap Authorityの下で`Deferred`、`Ready for Start Review`、`Started`、`Completed`、`Cancelled`を遷移する。
- Roadmapの着手をChange Traceと完了処理へ接続した。Human Start Decision後、現行Context RevisionとImpactを再評価して`CHG-*`を作成する。完了時は、適用されるCanonical Artifact、Implementation、Verification、CHGの参照、または理由付き`Not Applicable`をMain Viewへ戻す。Detail固有情報を適切な正本へ移管してからDetail Fileを削除し、恒久Roadmap Archiveにはしない。登録待ちは対象Itemだけを止め、通常実行ではActive Scopeまたは到達Triggerに関係するItemだけを再評価する。
- Trigger、Discovery、人間Route判断、Roadmap、Change Trace、必要工程の開始・Reopen、UI／Behavior Specification Pair、Architecture、Implementation、Verification、任意Release、Learning、Close、Roadmap Detail削除を接続する統合Workflow図をOverviewへ追加した。Discoveryとstarter Roadmapにも、対象責務へ限定したLifecycle図を追加した。
- ConformanceとGap / Impact Auditを拡張し、判断支援品質、Configuration伝播、Roadmap登録・着手、Item単位のPending、現行Impact再評価、結果参照、理由付き非適用、Detail削除を検査対象にした。starter templateへ非規範のProject Viewである`99_Roadmap/01_Product_Roadmap.md`を追加し、`template/AGENTS.md`と`template/CLAUDE.md`は規則を複製せずRoadmap ActivityをDiscovery／Change正本へ接続する構成にした。

v0.4.1ではStable Context IDのSemanticsを変更しない。標準の5種は引き続き`REQ`、`UX`、`IA`、`UI`、`SPEC`であり、Roadmap Item、Detail File、Change Trace、Decision、Evidence、Architecture、Implementation、Verificationへ新しいCRDD Stable Context IDを追加しない。

### v0.4.0 — 文書体系の統廃合（2026-07-17）

v0.3.0と比較して、v0.4.0の公開CRDDモデルを次のように変更した。

- 重複していたv0.3の文書群を、Foundation（`00_00`〜`00_03`）、共通実行・運用（`00_10`〜`00_19`）、Product工程（`00_21`〜`00_29`）、Audit（`00_51`〜`00_53`）からなる22の責務指向正本へ再編した。独立したPractice Guide層とSkill Execution層は残さず、`00_30`〜`00_49`を予約領域とした。
- CRDDの定義、一気通貫のContext継続性、人間／AIのAuthority、Scope単位のHandoff承認、最低限のConformance境界を`00_01_Principles.md`へ統合した。`00_02_Terminology.md`はCanonical Definitionに限定し、Repository、Artifact、Evidence、Decision、Stable Context ID、Traceabilityの規則を`00_03_Documentation.md`へ集約した。
- AgentとSubagentの委譲、Authority、Access、統合、独立Review規則を、固定Agent構成を前提としない`00_10_Agent.md`へ統合した。SkillのLifecycle、Guided Interaction、Status、再開、Review、Handoff契約を`00_11_Skill.md`へ統合し、GitとMarkdownは任意のExecution Adapterとした。
- DiscoveryからVerificationまでを連続した工程正本へ再編した。各工程がEntry、Transformation、責務Coverage、人間判断、Exit、Handoff、Reopen条件、Audit Criteriaを所有し、受信工程が自身のEntry Contractを所有する。部分Handoffには、Scope、Gap、Risk、Ownerについて人間の明示的承認を必須とした。
- UIとBehavior Specificationを`00_24_UI_Behavior_Specification.md`で接続する並行工程として維持し、`00_28_Implementation.md`を新設して、`00_29_Verification.md`を独立工程とした。Architectureは`06_Architecture`配下のProject実装規約、ImplementationはCodeとDeveloper Test、VerificationはProduction CodeやAcceptance Criteriaを変更しない対象Revisionの検証を担う。
- Development Stack、Context Transformation、Product Documentation Coverage、Governance、Security、Privacy、Cost、Compatibility、Evolution、Architecture Integration、Testingの責務を、それぞれを所有するPrinciples、Documentation、工程正本へ分配した。旧来の独立文書と重複文書は、規範Coverageを劣化させずに廃止した。
- Change Context Packageを、`90_Release/Changes/CHG-*.md`に置く軽量なChange Trace Logへ置き換えた。CHG RecordはTrigger、Expected／Actual Impact、影響するCanonical Context、Implementation、Verification、Release Disposition、Closeを接続する。`CHG-*`はStable Context IDではなくArtifact IDである。
- Verification後に必要な場合だけ行うProduct Releaseについて、Human Release Authority、Release Record、配布物参照、Release Verification、CHANGELOG境界を定める`00_13_Release.md`を追加した。`00_14_Workflow.md`を追加し、`07_Workflows`をChange／Release記録ではなくRepository固有の反復可能な手順に限定した。
- CRDD自体のLearning、変更承認、Versioning、Migration、公開済み誤りのCorrection、Audit接続を`00_19_Maintenance.md`へ統合した。
- 独立したPhase Gate文書とConformance文書を、各工程へ分配したCriteriaと、実行主体に依存しない`00_51_Document_Audit.md`、`00_52_Conformance_Audit.md`、`00_53_Gap_Impact_Audit.md`へ置き換えた。Auditは人間Reviewer、親Agent、委譲されたSubagentのいずれでも実行できる。
- v0.3のStable Context ID、Evidence、Decision規則を、Semanticsを変えずに集約した。Stable Context IDは`REQ`、`UX`、`IA`、`UI`、`SPEC`の5種、EvidenceはInlineまたは最も近い親Folderの`Evidence/`、Decision Rationaleは結果となるCanonical Artifact、`40_Develop`はCRDD管理用MarkdownではなくImplementation Artifactの配置先という規則を維持する。
- 文書Headerと参照Semanticsを統一した。`Owner`を文書種別固有IDより前に置き、`Related`のファイル名をDocument Number順に並べ、実行時Context Selectionは`Related`を全読込一覧とみなさずActive Scopeに必要な正本を追加する。
- `00_00_Overview.md`と`README.md`を重複しない入口として再構成し、templateの`AGENTS.md`と`CLAUDE.md`を統合後の文書体系とScope別Context Selectionへ更新した。`template/07_Workflows/Changes/`を削除し、`template/90_Release/Changes/`へCHG Templateを追加した。
- 本Releaseは文書Architectureの破壊的変更である。採用Projectはv0.3の標準文書群をv0.4の文書群へ置き換えてEntry Fileの参照を更新する一方、ProjectのCanonical Artifactと既存Stable Context IDは、意味が変わらない限り維持する。

### v0.3.0 — 安定IDとBehavior Specificationの明確化（2026-07-16）

v0.2.0と比較して、v0.3.0の公開CRDDモデルを次のように変更した。

- Artifactの文書番号・ファイル名とStable Context IDを分離した。一つの文書に複数のStable IDを含められ、Artifactは必要に応じてPath、Anchor、Revisionで参照する。Stable IDは文書ファイル名やDirectory名へ埋め込まない。
- 標準Stable IDを`REQ`、`UX`、`IA`、`UI`、`SPEC`の5種類に限定した。Architecture、Decision、Evidence、Change、Test等のArtifactは、標準Prefixを追加せずArtifact参照で追跡する。
- `Requirement`と`Behavior Specification`を異なるCanonical Conceptとして定義した。`REQ-*`はDiscoveryを通じて確定した要求を識別し、`SPEC-*`は条件と状態に応じて定義されたSystem Behaviorを識別する。
- Canonical Termであった`Behavior Requirement`と`Behavior Contract`を`Behavior Specification`へ統一し、対応する標準文書名とSkill名も変更した。Behavior Specificationを表す既存の`REQ-*`はLegacy IDとして維持し、用語統一だけを理由に改番しない。
- 承認済みCanonical ArtifactをDecisionの結果とした。理由、代替案、参照Evidence、経緯は成果物内のDecision / Rationale Sectionへ記録し、Decision専用のCRDD Stable IDや中央台帳を要求しない。
- Evidenceは利用するArtifact内、または最も近い親Folderの`Evidence/`へ配置する。EvidenceにはSource、Revisionまたは観測時点、取得条件、Provenance、Limitationを記録し、専用のCRDD Stable IDを要求しない。
- `01_Discovery`をObservation、不確実性、`REQ-*`の入口・正本とした。`99_Roadmap`を採用済みだが未着手の内容を扱う計画Viewとし、Roadmap項目はStable Contextを参照するが独自のCRDD Stable IDを持たない。
- 初期開発期と保守期について、顧客ヒアリング、法改正、明確な仕様変更、不具合、不具合か仕様変更か未確定な要求の処理経路を定義した。
- starter templateを各領域直下の`Evidence/`、`07_Workflows/Changes/`、`90_Release/Evidence/`を中心とする構成へ統一した。`40_Develop`にはCRDD管理用MarkdownではなくImplementation Artifactを配置する。
- Document Auditを拡張し、Artifact採番とStable ID検証を分離するとともに、曖昧なHeading Anchor、Authorityの重複、用語不整合、水平展開漏れ、Traceability切れを検出対象にした。

### v0.2.0 — Context継続性とGit / Markdown実行（2026-07-16）

v0.1.0と比較して、v0.2.0の公開文書体系は次のように変わった。

- ExperimentalだったCore Concepts / TerminologyとConformanceを確定し、Context継続性のEnd-to-EndモデルとCRDD Development Stackを加えた。
- Repository、Provenance、Decision、責任分界、Change Control、Documentを扱っていたCore標準を、Context Transformation、Discovery、UI / Behavior Contract、Traceabilityまで拡張した。
- Operational層を単一のCRDD Maintenance標準を中心に再構成し、Phase Gate Approval、Change Context Package、Gap / Validation / Impact、Agent I/O Contract、Guided Context Creationを定義した。
- 任意のPractice Guideを更新し、Product DocumentationモデルとUX / IA / UIの最低成果物を拡充するとともに、正本ファイル名を統一した。
- v0.1.0の4採番帯構成に、`40`〜`49` Git / Markdown Skill Execution層と`50`〜`59` Agent Execution層を加え、Guided Skill、再現可能なRepository実行、Subagent Orchestration、Document Auditを定義した。
- `README.md`およびtemplateの`AGENTS.md` / `CLAUDE.md`を、v0.2.0のRepository構成と実行ルールに合わせた。

### v0.1.0 — 初回公開（2026-07-15）

CRDDの初回公開版。採番帯によって4層に構成されている。

#### Overview（`00_00`〜`00_03`）

- CRDD Overview、Principles
- Terminology（Experimental — Glossary骨子のみ、定義は未確定）
- Conformance（Experimental — 準拠モデルは未確定）

#### Core標準（`00_10`〜`00_15`）

- Context Repository Standard
- Information Type and Provenance
- Decision Record Standard
- Human and AI Responsibility
- AI Change Control
- Document Standard

#### Operational（`00_20`〜`00_27`）

- Context Feedback Loop
- Context Repository Audit
- CRDD Change and Versioning（Experimental — バージョニング方針は未確定）

#### Practice Guide（`00_30`〜`00_35`、任意）

- Product Documentation Guide
- Subagent Practice Guide（参考Agent構成モデル）
- Testing and Quality Guide
- AI Governance and Security Guide
- Compatibility and Evolution Guide
- Architecture and Integration Guide

#### あわせて含まれるもの

- [LICENSE](LICENSE) — CRDD文書等の著作物に対するCC BY-NC-SA 4.0
- [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md) — 商用利用の定義と商用ライセンスの取得方法
- [TRADEMARK.md](TRADEMARK.md) — CRDD / Qual-Lab名称・商標の別ポリシー
- [README.md](README.md) — このフォルダの入口
