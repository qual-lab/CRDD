# CRDD Changelog

All notable changes to CRDD itself (the methodology documents in this folder) are recorded here.
CRDD自身（このフォルダ内のメソドロジー文書）の変更履歴を記録する。

**[English](#english)** | **[日本語](#日本語)**

---

## English

<a id="changelog-v070-en"></a>

### v0.7.0 — Information Presentation Model and Design System Reference (2026-07-25)

**This release contains breaking changes.** It changes required-responsibility coverage across six phases (UX, IA, UI, Behavior Specification, Architecture, Implementation) and extends Verification's phase-gate criteria, audit checklist, and UI checklist, adds a mandatory Design System Reference for scopes with visual logical screens, changes conformance determination (`52_Conformance_Audit.md`'s eligibility conditions now include a migration precondition), and updates distributed tool adapters (`template/.github/copilot-instructions.md`, `template/AGENTS.md`). Migration is required, not optional — see the migration note at the end of this section.

Compared with v0.6.2:

- Adds an Information Presentation Model to IA (`23_IA.md`), owned by IA, that defines semantic Grouping, information Priority (Primary/Secondary/Reference), Visibility Obligation, Shared Context across views of the same object, Temporal Role (ephemeral/persistent), and Mode — the meaning that must be settled before UI patterns such as Tabs, Sidebar, Drawer, or Workspace are chosen.
- Strengthens the UX Service Blueprint (`22_UX.md`) as the source of that Information Presentation Model: its columns are now explicitly time-axis Steps (not screens or features), with an optional in-blueprint Step Key that is not a CRDD stable context ID, and each Step now also connects sharing/handoff, Temporal Role candidates, and same-object Projection candidates. IA's blueprint-to-information mapping (`23_IA.md` §2.1) is extended to receive these as candidate input, closing the loop from Blueprint through IA Object/Relation to the Information Presentation Model.
- Adds the corresponding Presentation Realization concept to UI (`25_UI.md`), making explicit that UI pattern selection, region composition, and scroll ownership are UI's realization of IA's Information Presentation Model, not something IA confirms.
- Extends both the required-coverage table (§2.3) and the decision-authority table (§3.1) in the UI–Behavior Specification pairing document (`24_UI_Behavior_Specification.md`) with Projection synchronization / shared-selection-context, Mode-switching, and Temporal Role rows, with matching updates to its pair completion conditions (§2.6), pair audit checklist (§2.7), and entry contract (§2.1), connecting IA's Shared Context, Temporal Role, and Mode to concrete UI and SPEC obligations. `26_Behavior_Specification.md`'s own phase entry contract was extended to receive these same IA-owned obligations directly.
- Splits the single "Design System" row in UI's required-responsibility-coverage table into three rows — Design Token, UI Theme, UI Component/UI Design Pattern — and adds "known contract-vs-implementation drift" as an explicit required item for the component/pattern row, so this frequently-underweighted area is tracked with proportionate weight.
- Requires a tool-agnostic, executable Design System Reference (design tokens, components, and at least one representative HTML per adopted screen-composition-level UI Design Pattern) whenever the target scope has visual logical screens, regardless of target platform (Web, desktop, native mobile, or an embedded device with a screen). The reference HTML is a platform-independent look-and-feel reference; platform-specific rendering is handled at implementation time. Scopes with no visual logical screen (voice-only, haptic-only, API/backend-only) record `Not Applicable` with a confirmed reason, using the same scope-tracking states `25_UI.md` already uses elsewhere — no new recording format is introduced. Full per-screen "Screen Sample HTML" for one-off Unique/Exception screens remains an optional practice, not a required deliverable. Like the Screen Visual Index, the Design System Reference must be discoverable from the UI phase's entry point rather than left only under `Evidence/`, and a reference generated once during migration and never revisited is not treated as authoritative.
- Requires the Screen Visual Index to be discoverable from the UI phase's entry point (not left only under `Evidence/`) whenever it is the only product-wide visual reference, and adds matching items to UI's required-responsibility-coverage table, phase-gate criteria, and audit checklist. Also requires it to show IA's hierarchy, grouping, and navigation structure — as a tree or map where those relationships matter to understanding — rather than hiding them behind a flat list.
- Enriches IA's blueprint-to-information mapping (`23_IA.md` §2.1) with the qualitative attributes of decision-supporting information (evidence, freshness, confidence, uncertainty, provenance) and an explicit instruction not to conflate fact, inference, hypothesis, and decision.
- Lets a Service Blueprint split into detail artifacts only when a single blueprint can no longer sustain readability, updatability, and reuse (`22_UX.md`), preferring consolidation into the blueprint's own connection items first and preserving Step Keys and relationships when splitting.
- Adds skill-adapter guidance so UI work checks the existing Design System and UI Design Patterns before proposing new tokens or components, avoiding duplicate components (`25_UI.md` §3.1).
- Clarifies in Documentation (`03_Documentation.md`) that an executable reference implementation (e.g. HTML) may serve as part of the UI/Visual Direction source of truth when it keeps the same required items in a form suited to the medium. The same document's §8.2 now also states that artifact-local keys — such as a Service Blueprint's `STEP-*` step keys — are not Stable Context IDs even when they share the `<PREFIX>-<ordinal>` shape, and that the issuing, numbering, renumbering, and traceability rules for Stable Context IDs do not apply to them.
- Adds three new full Terminology entries (`02_Terminology.md`): `Information Presentation Model` (§2.23) and `Presentation Realization` (§2.24), each with an explicit authority split between IA, UI, and Behavior Specification, and `Projection` (§2.25), the term for one of several representations of the same underlying object, which carries its own MUST (do not split projection candidates into separate objects before IA confirms the object boundary; name what a projection is a projection of when referring to a specific one) and MUST NOT (do not split projections of the same object apart merely because they look different). `Information Presentation Model`, `Presentation Realization`, `Design System Reference`, `Design System`, `Scroll Ownership` (スクロール責務), `Step Key` (手順キー), and the four Information Presentation Model sub-items `Grouping` (意味上のグルーピング), `Visibility Obligation` (可視性の義務), `Shared Context` (共有すべき選択コンテキスト), and `Temporal Role` (一時的 / 永続的な意味) are added to the same document's canonical-term display-name table, and `Projection`, `Mode`, and `Priority` gain rows in its term-boundary table. `53_Gap_Impact_Audit.md`'s own illustrative cross-phase concept list was extended to include Information Presentation Model, Presentation Realization, Design System Reference, and Projection.
- Updates the phase-summary tables in Overview (`00_Overview.md`) to mention the new IA/UI concepts.
- Editorial: fixes a duplicated section number in `53_Gap_Impact_Audit.md` — the second `## 9.4` (Closure) becomes `## 9.5` — and renames `19_Maintenance.md` §6.3's heading from 移行案内 to 移行注記, matching the name every reference to it already used. Links through explicit anchors are unaffected. Three generated anchors move and external links to them must be updated: `#94-完了処理` becomes `#95-完了処理` in `53_Gap_Impact_Audit.md`; `#28-安定コンテキスト根拠判断` becomes `#29-安定コンテキスト根拠判断` in `23_IA.md`, because the new §2.8 displaces the former §2.8 to §2.9; and `#63-移行案内` becomes `#63-移行注記` in `19_Maintenance.md`. Both relocated sections gain stable explicit anchors (`#29-stable-context-evidence-decision`, `#95-closure`) so future renumbering cannot break them again. Also editorial: the terminology-display rule in `03_Documentation.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `template/AGENTS.md`, and `template/.github/copilot-instructions.md` now names the canonical term `Canonical Term` as `02_Terminology.md` defines it, instead of the undefined variant `Canonical English Term`; `03_Documentation.md` §8.2's new local-key sentence uses the same `<PREFIX>` placeholder as the format block above it; and `02_Terminology.md` gains `23_IA.md` and `25_UI.md` in its `Related` header, since §2.23 and §2.28 now delegate canonical authority there.
- Widens the registration rule that closes `02_Terminology.md` §5 from `Core Term` to 正式用語（`Canonical Term`), so every canonical term — not only the core context types — must carry a definition, its related or deprecated expressions, and its boundary against existing terms before it is used. This is normative, not an editorial restatement: it changes which terms the MUST reaches. The terms this release introduces are registered accordingly — `Information Presentation Model`, `Presentation Realization`, `Design System Reference`, `Bounded Remediation Proposal`, and `Cross-Audit Remediation Reconciliation` gain §5 boundary rows, and `Design System Reference` gains a §2.28 entry that delegates its detail to `25_UI.md`. Projects that maintain their own terminology document under CRDD's rules should apply the same bar to terms they add.
- Closes the downstream footprint of the two new payloads, each reaching the phases it actually governs. Design System Reference reaches `27_Architecture.md` (entry contract, coverage table, UI/visual-realization tracking list, phase-gate criteria, audit checklist), `28_Implementation.md` (entry contract, coverage table, phase-gate criteria, audit checklist), and `29_Verification.md` (phase-gate criteria, audit checklist, UI checklist); `27_Architecture.md`'s scope-exemption clause is also scoped so that a scope with visual logical screens cannot mark the Design System Reference revision and its platform-conversion method `Not Applicable`, and `25_UI.md` — which owns the requirement — carries the same restriction on its own coverage-state tracking. The projection-synchronization, Mode-switching, and Temporal Role pairing obligations reach `26_Behavior_Specification.md` (entry contract, own required-coverage table, phase-gate criteria, audit checklist, handoff view) and `29_Verification.md` (UI checklist), and deliberately do not reach `27_Architecture.md` or `28_Implementation.md`: IA → Architecture is not a phase edge in CRDD — `23_IA.md`'s handoff hands to UI and Behavior Specification only, and `27_Architecture.md`'s entry contract receives the approved UI contract and Behavior Specification — so these obligations reach Architecture and Implementation through the approved SPEC rather than as a separate obligation list. The Information Presentation Model's Visibility Obligation also reaches Behavior Specification: `23_IA.md`'s IA-to-SPEC handoff now passes the show/hide conditions and permission-based display differences, `26_Behavior_Specification.md`'s entry contract receives them, and its new coverage row 投影（Projection）同期・作業モード・可視性・一時的 / 永続的な意味 requires them to be defined against the paired UI contract, as do its phase-gate criterion, audit checklist, and handoff view. `24_UI_Behavior_Specification.md` gains a 可視性 row in both its required-pairing table and its authority-split table, plus matching items in its pair completion conditions (§2.6) and its pair audit checklist (§2.7), so the UI-side concretisation and the SPEC-side show/hide conditions cannot exist on one side only; `29_Verification.md` gains a Visibility item requiring the show/hide conditions and permission-based display differences to match implementation on both sides. `29_Verification.md`'s UI checklist gains the Temporal Role save obligation (destination, save point, expiry) alongside new projection-synchronization and Mode-switching items. `53_Gap_Impact_Audit.md` §4.2's propagation-trigger list was extended with Information Presentation Model, Presentation Realization, and Design System Reference. Projection was added to §4.1's scope list but deliberately not to §4.2, because a change to a projection boundary already fires the existing IA object / relation / responsibility trigger.
- Adopts `Projection` as the canonical English term for one of several representations of the same object, displayed as 投影（Projection）. `View` was not used for this, because `02_Terminology.md` already lists it as a related expression under 正本成果物 with an unrelated meaning. The sub-concept `Mode` is displayed as 作業モード（Mode）, following the katakana rendering this repository already uses for `Mode`.
- Renames the canonical Japanese display name for `Design Token` from "設計トークン" to "デザイントークン" everywhere it appears (`02_Terminology.md`, `25_UI.md`, `26_Behavior_Specification.md`, `27_Architecture.md`, `28_Implementation.md`, `29_Verification.md`, `53_Gap_Impact_Audit.md`, `template/.github/copilot-instructions.md`), to match the term Japanese-language practice actually uses. This is a display-name correction with no change to meaning, authority, or required coverage.
- Separates the two senses of information priority. `情報の優先度` is IA's semantic classification (the Information Presentation Model sub-item: primary / secondary / reference); `情報優先度` is UI's visual expression of it. `23_IA.md` §2.8 now states the relationship explicitly — they are the meaning side and the expression side of one judgment, not two judgments. The redundant third rendering `情報の優先順位` is normalized in `24_UI_Behavior_Specification.md` and `25_UI.md`, to `情報優先度` where UI owns the expression and to `情報の優先度` where the text carries IA's classification (`25_UI.md`'s phase entry contract); `23_IA.md`'s IA-to-UI handoff was likewise corrected from `情報優先度` to `情報の優先度`, and `02_Terminology.md`'s term-boundary table records the distinction. Because `Priority` now demonstrably carries three renderings, it moves out of the flat canonical-term display-name table — whose unconditional `| Priority | 優先順位 |` row contradicted the new boundary row — into the "do not use alone" table alongside `State`, `Variant`, `Component`, `Pattern`, `Asset`, `Screen`, and `Visual`, with all three renderings named. `Mode` is added to the same table for symmetry. No canonical term is renamed and no required coverage changes.
- Tightens `19_Maintenance.md` §6.2 (Baseline Adoption Assessment): adopting a new baseline "with no action" now requires the same `Not Applicable`-with-confirmed-reason discipline used elsewhere in CRDD, rather than a bare "give a reason." Adds a new §6.2.1 Migration Completeness bar (full inventory of in-scope existing assets, a determined disposition for each, a traceable destination for every asset dispositioned as migrated or replaced, no assets still awaiting execution, and an independent review confirming no semantic loss), required for normative/breaking baseline differences or any release CHANGELOG marks as requiring migration, and applying regardless of adoption disposition — including adopting with no action, where the inventory and disposition points are satisfied by dispositioning every in-scope asset as retained or out-of-scope, and only the independent review is genuinely additional. `52_Conformance_Audit.md`, `53_Gap_Impact_Audit.md` §9.3, and `51_Document_Audit.md` are wired to it: a conformance claim cannot be issued against a new baseline while its required migration is incomplete, and the bar's fifth point routes to Gap/Impact Audit or Document Audit — Document Audit covers only that fifth point, not the inventory and disposition points, and both `51_Document_Audit.md` and `53_Gap_Impact_Audit.md` now state that only an audit state of `Pass` with no unresolved critical/major findings can back it — `Conditional`, `Fail`, and `Blocked` cannot. Unfinished items from a partial activation carry forward to later baseline updates, so neither a subsequent update that is itself out of scope for the bar, nor satisfying the bar for that subsequent update alone, clears them — the result stays `Not Met` until the carried-forward items are resolved, and satisfaction is judged against the whole scope including them. Where a difference's change classification is undetermined and a human decision authority rules it out of scope, the recorded reason must now also carry a reevaluation trigger for settling that classification, and `52_Conformance_Audit.md` checks that the reason carries scope, the differences, the confirming authority, and that trigger before accepting `Not Applicable`. `53_Gap_Impact_Audit.md`'s own audit-state definitions are corrected to the same 未解決 threshold `51_Document_Audit.md` uses, so `Pass` and `Fail` can no longer both be satisfied by a dispositioned-but-unresolved major gap.
- Adds a machine-readable value column to `19_Maintenance.md` §4's change-classification table (`editorial` / `clarification` / `additive` / `normative` / `breaking`), for use wherever a schema must carry the classification — notably `change_classification` in the §6.3 migration note; prose keeps using the classification names. Two release-process items follow from it: §5.2 now asks each release section to state the change classification of the differences it covers, and §5.3's Release Readiness list now requires a migration-requiring release to carry `migration_required` and `change_classification` in its migration note. Where a single value stands for a release or a difference set, it must name the most consequential classification present, ordered editorial → clarification → additive → normative → breaking, so a lower classification cannot represent a higher difference. These govern how CRDD itself, and any project reusing its release process, record classifications; they impose no new requirement on project artifacts.
- Strengthens how independent review and multiple audits are operated (`10_Agent.md` §7 and new §7.5, with two new Terminology entries in `02_Terminology.md`: `Bounded Remediation Proposal` (§2.26, 境界付き修正提案) and `Cross-Audit Remediation Reconciliation` (§2.27, 監査間是正方針レビュー), both also added to its canonical-term display-name table). Independent review must now return findings in a form the repair executor can apply without reinterpreting them — cause, expected state, a change proposal that identifies its target uniquely, what must not change, how to verify, and confidence — because abstract instructions like "clarify the responsibility" lead the repair executor to re-derive a fix and introduce semantic changes the finding never asked for. Proposing a fix does not compromise independence; independence means not passing or approving one's own work. Where several resolutions are defensible, no reviewer, audit, parent agent, or repair executor picks one — the options and their consequences go to the human decision authority. Where intent, authority, source of truth, or the target location is unclear, the proposal must not be guessed; confidence, missing information, and prohibited changes are reported instead. `51_Document_Audit.md` §3.2 carries the corresponding finding fields, which `52_Conformance_Audit.md` and `53_Gap_Impact_Audit.md` already reuse.
- Adds an aggregation discipline for running several audits over one scope (`10_Agent.md` §7.5). The scope, target revision, and the list of required audits that make up the set are fixed before the audit set starts — and that list is not narrowed afterwards to let integration or repair proceed — and every audit evaluates the same revision; audit sub-agents stay read-only; and no repair, request for a human decision on the integrated remediation plan, phase-gate determination, finding closure, or risk acceptance happens from a partial set of results. Escalation that §3.1 or §3.3 already makes mandatory — serious safety, security, privacy, or legal risk, irreversible data loss, a stop or reject condition, or an audit returning `Blocked` that needs a human decision to resume — does not wait for the set to complete, nor does §7.4's trigger evaluation and read-only exploration, though the canonical repair it may lead to does. The parent agent must cluster findings that share a cause rather than counting them, separate symptom from cause, detect proposals that cannot both hold, and resolve conflicts by the comparison order in §6.3 plus conformance and propagation impact — never by completion order, finding count, severity, majority, or preference. It then re-presents the integrated remediation plan to the originating audits **before** repair begins; each answers within its own audit remit with accept / accept-with-conditions / reject / conflict / out-of-scope / blocked, and only answers that would leave a finding unresolved, break a conformance basis or source of truth, sever meaning, create serious risk, fail to meet the target's entry or exit, fail to apply to the target revision, or come from an audit that returned `Blocked` because it could not evaluate the plan within its own remit, stop the repair from starting. This pre-repair reconciliation does not replace re-auditing afterwards. Each audit document states what it checks when a plan is re-presented to it, and `AGENTS.md` and `template/AGENTS.md` carry the adopter-facing form. `52_Conformance_Audit.md` gains `AD-19` for the bounded remediation proposal, which applies unconditionally, and `AD-20` for the multi-audit aggregation discipline, which is `Not Applicable` with a reason where a scope runs only one audit; both Agentic Delivery claim rows move from `AD-01〜AD-18` to `AD-01〜AD-20`; §7.5 states the minimum record an audit set must make retrievable, in the same style as §7.2's review record and likewise requiring no fixed file or schema.
- Clarifies licensing in `README.md` and `COMMERCIAL_LICENSE.md`: every version of CRDD is available under the Apache License 2.0, including releases originally distributed under CC BY-NC-SA 4.0, with trademarks as the only carve-out (`TRADEMARK.md`). Permissions granted to recipients under the earlier license were never revoked and remain valid. The earlier wording could be read as leaving parts of CRDD under a non-commercial restriction; no version carries one today. This is Qual-Lab's decision, as the copyright holder of that content, to offer every version under the Apache License 2.0. It does not change the Apache License 2.0 terms themselves, and it withdraws nothing from recipients who obtained a version under the earlier license.

Adoption impact: this release changes the required-responsibility-coverage tables for UX, IA, UI, Behavior Specification, Architecture, and Implementation, and extends Verification's phase-gate criteria, audit checklist, and UI checklist, so adopting projects must re-assess scope across all of these phases — in particular, existing UI artifacts must be re-checked against the three split Design-System responsibilities (Design Token / UI Theme / UI Component-Pattern) and, for any scope with visual logical screens, against the new Design System Reference requirement (including its downstream footprint in `27_Architecture.md`, `28_Implementation.md`, and `29_Verification.md`, each of which received a matching entry-contract, coverage-table, phase-gate, and/or checklist item); existing Service Blueprints must be re-checked for sharing/handoff, Temporal Role, and Projection coverage. Existing UI–Behavior Specification pairs must be re-checked against the four new pairing rows (projection synchronization/shared-selection-context, Mode switching, Visibility, Temporal Role) in `24_UI_Behavior_Specification.md`, which now also appear in `26_Behavior_Specification.md`'s own required-coverage table — whose row additionally carries the Visibility Obligation's show/hide conditions and permission-based display differences — and `29_Verification.md`'s UI checklist, and existing UI exit reviews must apply the new layered-evaluation requirement in `25_UI.md` §4.1 (not collapsing IA structure, Information Presentation Model, Presentation Realization, UI contract, content, state coverage, accessibility, visual quality, and implementation drift into one undifferentiated "UI quality" judgment). Projects with no other product-wide visual reference must also confirm their Screen Visual Index is discoverable from the UI phase's entry point. Separately from the IA/UI payload, projects that run more than one audit over a single scope must adopt the aggregation discipline in `10_Agent.md` §7.5: fix the target revision before the audit set starts, keep audit sub-agents read-only, wait for every required audit before repairing or requesting a human decision on the integrated remediation plan, while still escalating without delay whatever §3.1 or §3.3 already makes mandatory, and re-present the integrated remediation plan to the originating audits before repair begins. Existing agent definitions, prompts, and workflows that instruct an audit to return findings alone, or that apply one audit's findings before the others finish, need updating. This migration is required, not optional, for projects updating to v0.7.0 from an existing baseline — a first-time CRDD adoption has no prior baseline to diff against and is out of scope for the bar per `19_Maintenance.md` §6.2.1, though its Baseline Adoption Assessment and human activation still apply — and must satisfy the new Migration Completeness bar in `19_Maintenance.md` §6.2.1 before the project records a `Conformant` claim against v0.7.0.

The maintenance-rule change itself is also normative and has its own adoption impact, independent of the IA/UI payload above. Two cases need attention. First, a project that previously closed a Baseline Adoption Assessment as "adopt with no action" under the older bare-reason wording should revisit that reasoning against the tightened `Not Applicable` discipline, and record the confirming human authority if it was never captured. Second, once a project activates v0.7.0, a migration in progress toward it — or toward any later baseline whose difference is normative/breaking or whose CHANGELOG declares migration required — cannot back a `Conformant` claim until the five-point Migration Completeness bar is met; such a project should record its interim state as `CRDD-Inspired` with scope, known risk, and a reevaluation trigger rather than leaving a prior `Conformant` claim standing unexamined. A project still operating on v0.6.2 or earlier remains governed by its own active baseline until it activates v0.7.0.

Migration note (v0.6.2 → v0.7.0):

- Classification / migration required: `change_classification: breaking`, `migration_required: true`. This baseline update is in scope for the Migration Completeness bar regardless of adoption disposition, including adopting with no action.
- Required: re-assess UX, IA, and UI scope against the changed coverage tables; for any scope with visual logical screens, produce or identify the Design System Reference and record known contract-vs-implementation drift; re-check existing UI–Behavior Specification pairs against the four new pairing rows (projection synchronization/shared-selection-context, Mode switching, Visibility, Temporal Role), and existing Behavior Specifications against the Visibility Obligation items now required in `26_Behavior_Specification.md`'s coverage row; confirm the Screen Visual Index is discoverable when it is the only product-wide visual reference; where the project runs more than one audit over a single scope, adopt the aggregation and reconciliation discipline and update the agent definitions, prompts, or workflows that currently bypass it.
- Conditional: `26_Behavior_Specification.md`, `27_Architecture.md`, `28_Implementation.md`, and `29_Verification.md` items apply only where the project already has those phases in scope. Projects with no visual logical screen record `Not Applicable` with a human-confirmed reason instead.
- Out of scope: no Stable Context ID change, no mandated file name or folder layout, and no change to existing `REQ`/`UX`/`IA`/`UI`/`SPEC` identifiers. (The Design System Reference required above adds a responsibility, not a fixed path or file count; an existing component-catalog tool may satisfy it.) The schema additions are the three conformance-report fields in `52_Conformance_Audit.md` §12, the two migration-note keys in `19_Maintenance.md` §6.3, the six finding fields in `51_Document_Audit.md` §3.2 that `52` and `53` inherit, and the `audit_set` record in `10_Agent.md` §7.5; none of these impose a fixed file or YAML format, and no new fixed schema is imposed on product artifacts.
- Verification: run Document Audit for reference and terminology follow-through; run Gap / Impact Audit where the coverage-table changes touch multiple phases; rerun affected Conformance Criteria before recording any claim.
- Rollback / recovery: keep the previous pinned baseline active until Migration Completeness is met; a candidate baseline read for assessment does not govern the project until human activation.
- Known risk if deferred: UI reviews continue to run without an executable visual reference, so contract-vs-implementation drift stays undetected; a `Conformant` claim recorded against v0.7.0 without completing the migration is not eligible under `52_Conformance_Audit.md` §7.

<a id="changelog-v062-en"></a>

### v0.6.2 — Lightweight Baseline Adoption Assessment (2026-07-24)

Compared with v0.6.1:

- Makes the existing baseline-adoption rule executable through a lightweight Baseline Adoption Assessment before a project activates a different CRDD tag, commit, submodule reference, distributed document set, local standard patch, or conformance baseline.
- Evaluates semantic, AI-behavior, conformance, phase-contract, and artifact / adapter / operational differences rather than treating file replacement or a submodule pointer update as adoption completion.
- Keeps the assessment proportional. It requires no dedicated file, folder, schema, Delta ID, fixed status lifecycle, Change Trace, or full audit set. Existing Issues, pull requests, Change Traces, workflows, or migration records may carry the result.
- Separates the candidate baseline from the active baseline. AI may read the candidate for assessment and adaptation, but it does not become the governing completion or conformance baseline until the responsible Human authority activates it.
- Requires only affected conformance criteria to be reevaluated and routes uncertain cross-artifact or AI-behavior impact to Gap / Impact Audit. Previous conformance results are not copied to a changed baseline without an applicability decision.
- Updates the Overview, README, starter agent guidance, Maintenance, Conformance Audit, and Gap / Impact Audit with the same adoption route.

Adoption impact: no project artifact migration, new Stable Context ID, phase-contract change, conformance-criterion change, mandatory Audit, or mandatory Change Trace is introduced. A project moving to v0.6.2 records the previous and candidate baselines, checks applicable release differences and local adapters, and obtains the responsible Human activation decision. Additional migration, audits, or verification are conditional on detected impact.

<a id="changelog-v061-en"></a>

### v0.6.1 — Lightweight Discovery Candidate Holding (2026-07-24)

Compared with v0.6.0-p1:

- Clarifies an optional holding view within Discovery for unadopted inputs that are not being analyzed now but may merit later reconsideration.
- Separates unadopted held candidates, Human-adopted deferred Roadmap items, and changes that require a `CHG-*`. Holding or researching a candidate alone does not authorize implementation or create a Change Trace.
- Keeps the practice lightweight: no mandatory candidate file, folder, template, standard `CAND-*` identifier, fixed status model, owner, deadline, or full-pool review is added.
- Allows current work to finish without processing unrelated held candidates. Only candidates related to the active scope, a reached reconsideration trigger, or a Human selection normally need review.
- Updates the Overview and Change Trace flow diagrams and aligns the Discovery, Documentation, Change, README, and starter agent guidance with the clarified route.

This release does not add a mandatory phase, artifact, Stable Context ID, fixed candidate lifecycle, or full-pool audit, and it does not require migration of existing project artifacts. When optional candidate holding is used, it is evaluated within the existing Discovery contract.

<a id="changelog-v060-p1-en"></a>

### v0.6.0-p1 — README Anchor Correction (2026-07-24)

Compared with v0.6.0:

- Repairs the two same-document links from the English and Japanese entry tables to the historical v0.4.2-to-v0.5.x migration guidance.
- Adds stable explicit anchors for both language sections so future wording changes do not break these links.

This patch does not change CRDD rules, phase contracts, conformance, Stable Context IDs, templates, or adopting-project migration requirements.

<a id="changelog-v060-en"></a>

### v0.6.0 — Practical Review, Human-Centered Quality, and Open Maintenance (2026-07-24)

Compared with v0.5.1-p1:

- Defines a practical operating scale for CRDD records. Small, reversible local work may close with a self-check; standard and extended operation add trace, impact, migration, and audit evidence only when the scope and risk require them. “Necessary granularity” now has explicit sufficiency conditions instead of implying more files or decomposition.
- Simplifies phase-transition control to two stages: an independent review, followed by the responsible Human authority’s decision. When content authority and transition authority are the same person, one Human approval may cover both; separate approvals are required only for different authorities or applicable specialist approval.
- Strengthens the existing backward-propagation rule. New Human decisions, constraints, learning, evidence, or findings trigger an explicit impact check so that downstream answers close or update affected upstream and peer questions before normal completion.
- Strengthens Discovery and requirements engineering with source-to-requirement separation, promotion criteria for individual requirements, requirement-set quality, verification obligations, and a project-selected quality concern profile. The selected use of ISO/IEC/IEEE 29148:2018, ISO/IEC/IEEE 15288:2023, ISO/IEC/IEEE 12207:2026, and ISO/IEC 25010:2023 is recorded as `informed_by` or otherwise scoped relations, without claiming conformance.
- Strengthens UX, IA, UI, and Behavior Specification for understandable decision support, configuration extraction, human-centered quality, experience-expression intent, visual direction, UI themes, UI components, UI design patterns, accessibility, and explicit UI-to-behavior correspondence. These responsibilities remain distributed to their owning phase documents rather than forming a new competing authority.
- Makes canonical Japanese documents locale-first throughout. Human-facing headings, field labels, state explanations, and prose use Japanese display names; canonical English terms, identifiers, schema values, filenames, and BCP 14 keywords remain available where interoperability or normative strength requires them.
- Adds plain-language entry guidance and a small-problem walkthrough to the README and Overview. Human readers can start without reading all canonical documents, while AI entry files continue to load the applicable authorities by scope.
- Adds repository-specific AI entry adapters for GitHub Copilot at the CRDD root and in the starter template. These adapters do not become CRDD conformance requirements and do not prescribe a particular AI provider.
- Clarifies CRDD’s public-feedback and self-maintenance route from problem or evidence through impact and alternatives, Human adoption, review, audit, integration, pending release, and release closure, while keeping Issue, label, branch, and pull-request mechanics specific to the official repository.
- Changes the project license to Apache License 2.0 and adds a NOTICE and a separate trademark policy. Apache 2.0 governs the standard’s copyrighted content; the Qual-Lab and Qual names, logos, and related brand identifiers are not licensed as trademarks.
- Aligns the canonical documents, audits, root and starter agent instructions, Change Trace and Roadmap templates, README, and document headers with the v0.6.0 baseline.

v0.6.0 does not add a Stable Context ID type. The standard set remains `REQ`, `UX`, `IA`, `UI`, and `SPEC`.

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

#### Also included at the v0.1.0 release

The following describes the historical v0.1.0 files and does not describe the current license:

- `LICENSE` — CC BY-NC-SA 4.0 for CRDD documentation and other copyrightable materials at that release
- `COMMERCIAL_LICENSE.md` — the commercial-license route used at that release
- `TRADEMARK.md` — the separate policy for the CRDD / Qual-Lab names and marks
- `README.md` — the entry point for that release

---

## 日本語

<a id="changelog-v070-ja"></a>

### v0.7.0 — 情報提示の意味構造とデザインシステム参照実装（2026-07-25）

**本リリースは破壊的変更を含む。** UX・IA・UI・振る舞い仕様・アーキテクチャ・実装の6工程で必要な責務の網羅を変更し、検証の工程移行判定基準・監査チェックリスト・UIチェックリストを拡張する。視覚的な論理画面を持つ対象範囲へデザインシステム参照実装を必須とし、準拠判定を変更し（`52_Conformance_Audit.md`の適格性条件へ移行の前提条件を追加）、配布するツール接続部（`template/.github/copilot-instructions.md`、`template/AGENTS.md`）を更新する。移行は任意ではなく必須であり、詳細は本節末尾の移行注記に従う。

v0.6.2からの変更:

- IA（`23_IA.md`）へ、UIパターン（Tabs、Sidebar、Drawer、Workspace等）を選ぶ前に整理すべき情報提示の意味構造（Information Presentation Model）を追加した。意味上のグルーピング（Grouping）、情報の優先度（Primary / Secondary / Reference）、可視性の義務、同一対象の複数の投影間で共有する選択コンテキスト、一時的 / 永続的な意味（Temporal Role）、作業モードを、IAが所有する責務として明示した。
- UX（`22_UX.md`）のサービスブループリントを、情報提示の意味構造への入力元として強化した。列を画面や機能ではなく時間軸上の手順（Step）と明確化し、CRDD安定コンテキストIDではない任意の手順キー（Step Key）を導入し、各手順が接続する項目へ共有・引き継ぎ、一時的 / 永続的な意味（Temporal Role）の候補、同一対象の別投影候補を追加した。IAのブループリント対応づけ（`23_IA.md`§2.1）もこれらを候補入力として受け取るよう拡張し、ブループリントからIAのオブジェクト・関係を経て情報提示の意味構造へ至る連鎖を接続した。
- UI（`25_UI.md`）へ対応する具体的な表示構造（Presentation Realization）を追加し、UIパターンの選択・画面領域構成・スクロール責務が、IAの情報提示の意味構造を受けてUIが具体化する結果であり、IAが確定する対象ではないことを明文化した。
- `24_UI_Behavior_Specification.md`の必要な対応関係の網羅範囲（§2.3）と分離された決定権限（§3.1）の両表へ、投影同期／選択コンテキスト共有、作業モード切替、一時的 / 永続的な意味の行を追加し、完了条件（§2.6）、対応レビュー監査チェックリスト（§2.7）、入口契約（§2.1）にも反映した。IAが所有する共有すべき選択コンテキスト・一時的 / 永続的な意味・作業モードを、UI・SPEC双方の具体的な義務へ接続している。`26_Behavior_Specification.md`の工程入口契約も、これらのIA由来の義務を直接受け取るよう拡張した。
- UIの必要な責務の網羅表にあった「設計システム」の1行を、デザイントークン／UIテーマ／UI部品・UI設計パターンの3行へ分割し、UI部品・UI設計パターン行へ「契約と実装の既知差分」を新規必須項目として追加した。実務上最も肥大化しやすいこの領域の重みを、表の粒度でも正しく見せるようにした。
- 対象範囲に視覚的な論理画面が存在する場合、対象プラットフォーム（Web、デスクトップアプリ、ネイティブモバイル、特定の画面を持つ組み込み機器等）を問わず、デザイントークン・UI部品・UI設計パターンについて、ツールを指定しない実行可能な参照実装（デザインシステム参照実装）と、採用している画面構成レベルのUI設計パターンごとの代表HTMLを必須にした。参照HTMLはプラットフォーム非依存の見た目・操作感の参照であり、プラットフォームへの変換は実装工程が担う。視覚的な論理画面を持たない対象範囲（Voice専用、触覚のみ、API／バックエンドのみ等）は、既存の網羅状態追跡と同じ`Not Applicable`で理由を記録する。新しい記録様式は追加しない。個別のUnique／Exception画面の"Screen Sample HTML"化は引き続き任意実践とし、必須要件にしない。画面視覚一覧と同様、デザインシステム参照実装も`Evidence/`配下への設置だけで完了とせず、UI工程の入口から発見可能な状態にする。移行作業等で一度だけ生成され、その後見直されない参照実装は正本として扱わない。
- 画面視覚一覧（Screen Visual Index）が製品横断で唯一の視覚参照である場合、`Evidence/`配下への設置だけで完了とせず、UI工程の入口から直接参照できる状態にすることを必須にし、UIの責務網羅表、工程移行判定基準、監査チェックリストにも対応項目を追加した。あわせて、IAの階層・グループ化・ナビゲーション構造が利用者の理解に重要な場合は、ツリーまたはマップ形式でその関係を表現し、フラットな一覧だけで関係を隠さないことを求めた。
- IAのブループリント対応づけ（`23_IA.md`§2.1）へ、判断に必要な情報の質的属性（根拠、鮮度、確信度、不確実性、出典）と、事実・推定・仮説・判断を混同しないという明示的な指示を追加した。
- サービスブループリントの詳細成果物への分離を、一つのブループリントでは可読性・更新性・再利用性を維持できない場合に限定した（`22_UX.md`）。まずブループリント内の接続項目として統合することを優先し、分離する場合も手順キーと関係を維持する。
- UI作業で新しいトークンや部品を提案する前に、既存のデザインシステムとUI設計パターンを確認し、重複するUI部品を作らないという指示をスキル実行接続部へ追加した（`25_UI.md`§3.1）。
- 文書化（`03_Documentation.md`）へ、実行可能な参照実装（HTML等）が媒体に適した形で必要項目を保持する限り、UI契約・視覚表現方針の正本の一部として扱えることを明記した。同文書§8.2へ、サービスブループリントの手順キー`STEP-*`のように成果物内だけで参照する局所キーは、`<PREFIX>-<順序>`と同じ見た目を持っても安定コンテキストIDではなく、発行・採番・改番禁止・トレースの規則を適用しないことを明記した。
- 用語集（`02_Terminology.md`）へ正式エントリを3つ新規追加した。「情報提示の意味構造（Information Presentation Model）」（§2.23）と「具体的な表示構造（Presentation Realization）」（§2.24）は、IA・UI・振る舞い仕様間の決定権限の分離を用語レベルで明示する。「投影（Projection）」（§2.25）は、同一対象の複数ある表現形のそれぞれを指す用語であり、独自の必須（IAがオブジェクト境界を確認するまで別オブジェクトとして確定しない、特定の投影を指すときは何の投影かを併記する）と禁止（見た目が異なることだけを理由に同一対象の投影を別オブジェクトへ分割しない）を持つ。同文書の正式名称→ローカル表示名対応表へは「情報提示の意味構造（Information Presentation Model）」「具体的な表示構造（Presentation Realization）」「デザインシステム参照実装（Design System Reference）」「デザインシステム（Design System）」「スクロール責務（Scroll Ownership）」「手順キー（Step Key）」に加え、情報提示の意味構造のサブ項目である「意味上のグルーピング（Grouping）」「可視性の義務（Visibility Obligation）」「共有すべき選択コンテキスト（Shared Context）」「一時的 / 永続的な意味（Temporal Role）」を追加し、用語の境界表へは「投影（Projection）」「作業モード（Mode）」「情報の優先度（Priority）」を追加した。`53_Gap_Impact_Audit.md`の工程横断概念の例示リストには、情報提示の意味構造・具体的な表示構造・デザインシステム参照実装・投影を反映した。
- 概要（`00_Overview.md`）のフェーズ要約表を更新し、新しいIA/UI概念を反映した。
- 編集上の変更として、`53_Gap_Impact_Audit.md`で重複していた節番号を修正し（2つ目の`## 9.4`（完了処理）を`## 9.5`へ変更）、`19_Maintenance.md`§6.3の見出しを「移行案内」から、参照側が既に使用している「移行注記」へ統一した。明示アンカーによるリンクは影響を受けない。生成アンカーは3つ移動し、これらを参照する外部リンクは更新が必要である。`53_Gap_Impact_Audit.md`の`#94-完了処理`は`#95-完了処理`へ、`23_IA.md`の`#28-安定コンテキスト根拠判断`は新設した§2.8により旧§2.8が§2.9へ移るため`#29-安定コンテキスト根拠判断`へ、`19_Maintenance.md`の`#63-移行案内`は`#63-移行注記`へ移る。移動した2節へは、今後の節番号変更でリンクが切れないよう明示アンカー（`#29-stable-context-evidence-decision`、`#95-closure`）を追加した。あわせて編集上の変更として、`03_Documentation.md`、`AGENTS.md`、`.github/copilot-instructions.md`、`template/AGENTS.md`、`template/.github/copilot-instructions.md`の用語表記ルールを、`02_Terminology.md`が定義する正式用語`Canonical Term`へ揃えた（従来は未定義の変種`Canonical English Term`）。`03_Documentation.md`§8.2の局所キーの記述を直前の書式ブロックと同じ`<PREFIX>`表記へ統一し、§2.23と§2.28が決定権限を委譲している`23_IA.md`と`25_UI.md`を`02_Terminology.md`の`Related`ヘッダーへ追加した。
- `02_Terminology.md`§5末尾の登録規則の適用範囲を、`Core Term`から正式用語（`Canonical Term`）へ広げた。中核となるコンテキスト種別だけでなく、すべての正式用語について、使用前に定義、関連・廃止予定の表現、既存用語との境界を本書へ追加することを求める。これは表記の書き換えではなく規範の変更であり、MUSTが対象とする用語の範囲が変わる。本リリースが導入する用語もこれに従って登録した。`Information Presentation Model`、`Presentation Realization`、`Design System Reference`、`Bounded Remediation Proposal`、`Cross-Audit Remediation Reconciliation`へ§5の境界行を追加し、`Design System Reference`には詳細を`25_UI.md`へ委譲する§2.28を追加した。CRDDの規則に従って独自の用語集を維持するプロジェクトは、追加する用語へ同じ登録水準を適用する。
- デザインシステム参照実装と、新設した投影同期／作業モード切替の対応義務について、下流への波及を、それぞれが実際に規律する工程へ反映した。デザインシステム参照実装は、`27_Architecture.md`（工程入口契約、責務網羅表、UI／視覚表現成立方式の追跡リスト、工程移行判定基準、監査チェックリスト）、`28_Implementation.md`（工程入口契約、責務網羅表、工程移行判定基準、監査チェックリスト）、`29_Verification.md`（工程移行判定基準、監査チェックリスト、UIチェックリスト）へ波及する。あわせて`27_Architecture.md`の適用除外条項を限定し、視覚的な論理画面を持つ対象範囲ではデザインシステム参照実装の改訂版と対象プラットフォームへの変換方式を`Not Applicable`にできないようにした。要件を所有する`25_UI.md`側の網羅状態の追跡にも同じ制限を置いた。投影同期／作業モード切替／一時的 / 永続的な意味の対応義務は、`26_Behavior_Specification.md`（工程入口契約、自身の責務網羅表、工程移行判定基準、監査チェックリスト、引き渡し表示）と`29_Verification.md`（UIチェックリスト）へ波及し、`27_Architecture.md`と`28_Implementation.md`へは意図的に波及させていない。CRDDではIA→アーキテクチャは工程の辺ではなく、`23_IA.md`の引き渡しはUIと振る舞い仕様だけに渡し、`27_Architecture.md`の工程入口契約は承認済みUI契約と振る舞い仕様を受け取るためである。これらの義務は、承認済みSPECを経てアーキテクチャと実装へ届く。情報提示の意味構造の可視性の義務も振る舞い仕様へ波及する。`23_IA.md`のIAからSPECへの引き渡しが表示 / 非表示条件と権限による表示差を渡し、`26_Behavior_Specification.md`の工程入口契約がこれを受け取り、責務網羅表へ「投影（Projection）同期・作業モード・可視性・一時的 / 永続的な意味」の行を新設し、対となるUI契約に対して定義することを求める。工程移行判定基準、工程監査チェックリスト、引き渡し表示にも同じ項目を反映した。`24_UI_Behavior_Specification.md`へは、必須の対応関係の表と決定権限の分離表の両方へ「可視性」行を追加し、完了条件（§2.6）と対応レビュー監査チェックリスト（§2.7）にも対応項目を置いた。UI側の具体化とSPEC側の表示 / 非表示条件が片側だけになる状態を検出できる。`29_Verification.md`へは可視性項目を新設し、表示 / 非表示条件と権限による表示差がUI契約と振る舞い仕様の両側で実装と一致することを求めた。`29_Verification.md`のUIチェックリストへは、投影同期・作業モード切替と、一時的 / 永続的な意味に対応する保存義務（保存先、保存時点、消失条件）の項目を新設した。`53_Gap_Impact_Audit.md`§4.2の伝播契機リストへは、情報提示の意味構造・具体的な表示構造・デザインシステム参照実装を追加した。投影は§4.1の対象範囲リストにだけ追加し、§4.2へは意図的に追加していない。投影の境界変更は、既存の「IAのオブジェクト / 責務 / ナビゲーションの変更」契機で発火するためである。
- 同一対象の複数ある表現形を指す概念の正式英語名を`Projection`とし、ローカル表示名を投影（Projection）とした。`View`は使用していない。`02_Terminology.md`が既に正本成果物の関連表現として別の意味で挙げているためである。サブ概念の`Mode`は、本リポジトリで既に使用している「モード」というカタカナ表記に合わせ、作業モード（Mode）と表示する。
- `Design Token`の正式なローカル表示名を「設計トークン」から「デザイントークン」へ、出現する全箇所（`02_Terminology.md`、`25_UI.md`、`26_Behavior_Specification.md`、`27_Architecture.md`、`28_Implementation.md`、`29_Verification.md`、`53_Gap_Impact_Audit.md`、`template/.github/copilot-instructions.md`）で統一した。実務でより一般的な表記に合わせる表示名の是正であり、意味、決定権限、必要な網羅範囲は変更しない。
- 「情報の優先度」と「情報優先度」の二つの意味を分離した。「情報の優先度」はIAが所有する意味上の区分（情報提示の意味構造のサブ項目。主・副・参照）、「情報優先度」はUIによるその表現である。`23_IA.md`§2.8へ両者の関係を明記し（同じ判断の意味側と表現側であり、別々の判断ではない）、冗長な第三の表記であった「情報の優先順位」を`24_UI_Behavior_Specification.md`と`25_UI.md`で整理し、UIが表現を所有する箇所は「情報優先度」へ、IAの区分を指す箇所（`25_UI.md`の工程入口契約）は「情報の優先度」へ統一した。`23_IA.md`のIAからUIへの引き渡しも「情報優先度」から「情報の優先度」へ是正し、`02_Terminology.md`の用語の境界表へこの区別を記録した。`Priority`が3通りの表示を持つことが明確になったため、無条件に「優先順位」へ対応づけて新設の境界行と矛盾していた平の正式名称→ローカル表示名対応表から`Priority`を外し、`State`・`Variant`・`Component`・`Pattern`・`Asset`・`Screen`・`Visual`と同じ「単独では使わない語」の表へ3通りの表示とともに移した。対称性のため`Mode`も同表へ追加した。正式英語名の改名はなく、必要な網羅範囲も変更しない。
- `19_Maintenance.md`§6.2（基準版採用評価）を強化した。「対応なしで採用」は単に理由を示せば成立する運用から、CRDD標準内の他の`Not Applicable`と同じ「対象範囲の人間の決定権限者が確認した理由を根拠として残す」様式へ統一した。新設した§6.2.1「移行完了の条件（Migration Completeness）」は、対象差分が規範／破壊的に分類される場合、またはCHANGELOGが移行を必要と明示する場合に、既存資産の棚卸し・全資産の処遇決定・移行または置換とした資産の移行先追跡・着手待ち資産ゼロ・独立レビューによる意味の欠損確認、の5点を満たすまで対応完了とみなさない基準として追加した。本条件は採用処置にかかわらず適用し、「対応なしで採用」も対象に含む。対応なしの場合は、全資産の処遇を「据え置き」または「対象外」として1点目から4点目を満たし、実質的に増えるのは5点目の独立レビューである。`52_Conformance_Audit.md`、`53_Gap_Impact_Audit.md`§9.3、`51_Document_Audit.md`を本条件へ接続した。移行が未完了のまま新基準版への準拠表明を発行できないようにし、5点目の独立レビューは不足／影響監査または文書監査へ接続する。文書監査が担当するのは5点目だけであり、棚卸しと処遇に関する1点目から4点目は判定しない。あわせて`51_Document_Audit.md`と`53_Gap_Impact_Audit.md`へ、5点目の充足根拠になるのは監査状態が`Pass`で未解決の重大／メジャーな指摘事項が残っていない場合に限り、`Conditional`・`Fail`・`Blocked`は充足として扱わないことを明記した。部分的な有効化で残した未完了事項は以後の基準版更新へ引き継ぎ、後続の更新が本条件の対象外であることも、後続の更新の差分だけで5点を満たしたことも、引き継いだ事項を解消する理由にならない。解消するまで結果は`Not Met`とし、充足判定は引き継いだ事項を含む対象範囲全体に対して行う。対象差分の変更分類が未確定のまま人間の決定権限者が対象外と判断する場合は、その理由へ分類を確定して再判定する再評価契機を含める。`52_Conformance_Audit.md`は、記録された理由が対象範囲・対象差分・確認した決定権限・再評価契機を含むことを確認したうえで`Not Applicable`として扱う。`53_Gap_Impact_Audit.md`自身の監査状態の定義も、`51_Document_Audit.md`と同じ「未解決」のバーへ是正し、処置済みだが未解決のメジャーな不足が`Pass`と`Fail`の両方を満たす状態を解消した。
- `19_Maintenance.md`§4の変更分類表へ、機械可読な値の列（`editorial` / `clarification` / `additive` / `normative` / `breaking`）を追加した。§6.3の移行注記の`change_classification`等、スキーマで分類を示す必要がある箇所で使用し、人間向けの説明では従来どおり分類名を使用する。あわせて、§5.2の各リリース節へ「対象差分の変更分類」を示す項目を、§5.3のリリース準備状態へ「移行が必要なリリースでは移行注記が`migration_required`と`change_classification`を含む」確認項目を追加した。一つのリリースまたは差分集合を単一の値で示す場合は、含まれる差分のうち最も影響の大きい分類を示す（編集上、明確化、追加、規範、破壊的の順）。下位の分類で上位の差分を代表させない。いずれもCRDD自身および同じリリース運用を再利用するプロジェクトの記録方法に関する規定であり、プロジェクト成果物へ新しい要求を追加しない。
- 独立レビューと複数監査の運用を強化した（`10_Agent.md`§7と新設§7.5。`02_Terminology.md`へ正式エントリを2つ追加。「境界付き修正提案（Bounded Remediation Proposal）」§2.26と「監査間是正方針レビュー（Cross-Audit Remediation Reconciliation）」§2.27。いずれも正式名称→ローカル表示名対応表へも追加した）。独立レビューは指摘事項だけで終えず、修正担当が意味を再解釈せずに適用できる形（原因、期待する正しい状態、対象箇所を一意に特定できる修正案、変更してはならない範囲、確認方法、確信度）まで返す。「責務を明確化する」のような抽象的な指示は、修正担当に修正方法を再推論させ、指摘とは別の意味変更を持ち込ませるためである。修正方法を提案することは独立性に反しない。独立性は、自分が作成・修正した成果物を自分で合格または承認しないことを意味する。複数の妥当な選択肢がある場合は、レビュー、監査、親エージェント、修正担当のいずれも自己決定せず、選択肢ごとの結果を人間の決定権限者へ移送する。意図、決定権限、正本、対象箇所が不明な場合は修正案を推測で確定せず、確信度、不足情報、実行してはならない変更を返す。対応する指摘事項の項目は`51_Document_Audit.md`§3.2へ追加した。`52_Conformance_Audit.md`と`53_Gap_Impact_Audit.md`は同項目を再利用する。
- 一つの対象範囲へ複数の監査を実行する場合の統合規律を追加した（`10_Agent.md`§7.5）。監査集合の開始前に対象範囲、対象改訂版、および監査集合を構成する必須監査の一覧を固定し（一覧は統合や修正を進めるために開始後に縮小しない）、全監査が同じ改訂版を評価する。監査用サブエージェントは読み取り専用とし、一部の監査結果だけを根拠に修正、統合修正方針についての人間判断の要求、工程移行の判定、指摘事項の解消判定、リスク受容を行わない。ただし、`10_Agent.md`3.1と3.3が上位判断への移送を必須とする事項（重大な安全性・セキュリティ・プライバシー・法務上のリスク、不可逆なデータ損失、停止・拒否条件への該当、監査が`Blocked`となり再開に人間の判断を要する場合）と、変更影響の伝播確認の契機評価および読み取り専用の探索は、統合の完了を待たない。ただし伝播確認から生じる正本の是正は統合後に行う。親エージェントは、同じ原因を指す指摘事項をまとめて件数として水増しせず、症状と原因を分離し、両立しない修正提案を競合として検出し、§6.3の比較順序に準拠・伝播影響を加えて解決する。先に完了した監査、指摘事項の件数、重大度、多数決、親エージェントの選好で解決しない。そのうえで、統合した修正方針を**修正の開始前に**指摘元の各監査へ再提示する。各監査は自身の監査責務の範囲で受入、条件付き受入、拒否、競合、対象範囲外、判定不能を返し、修正の開始を止めるのは、指摘事項を解消しない、準拠根拠や正本を壊す、意味の断絶を作る、重大リスクを作る、対象の入口／出口を満たさない、対象改訂版へ適用できない、当該監査が自身の責務の範囲で方針を評価できず`Blocked`を返した、のいずれかに該当する回答に限る。この修正前のレビューは、修正後の再監査を代替しない。各監査文書へは、方針を再提示されたときに確認する内容を記載した。`AGENTS.md`と`template/AGENTS.md`には採用側向けの形で反映した。この規律を検証可能にするため`52_Conformance_Audit.md`へ、無条件に適用する境界付き修正提案の`AD-19`と、複数監査の統合規律の`AD-20`（単一監査だけの対象範囲は理由付きで`Not Applicable`）を新設し、エージェント型提供の準拠表明2件を`AD-01〜AD-18`から`AD-01〜AD-20`へ変更した。§7.5へは、監査集合が取得可能にする最小の記録項目を、§7.2のレビュー記録と同じ様式で示した。固定ファイルや固定スキーマは要求しない。
- `README.md`と`COMMERCIAL_LICENSE.md`のライセンス記述を明確化した。当初CC BY-NC-SA 4.0で配布したリリースを含め、CRDDの全バージョンをApache License 2.0で提供する。唯一の例外は商標であり、`TRADEMARK.md`で別に扱う。旧ライセンスで既に付与した許諾は取り消しておらず、そのまま有効である。従来の記述はCRDDの一部が非商用の制限下にあるとも読めたが、現在そのような制限を受けるバージョンは存在しない。これは当該内容の著作権者であるQual-Labが、全バージョンをApache License 2.0で提供するという判断である。Apache License 2.0の条件自体は変更せず、旧ライセンスで取得した利用者から何も取り上げない。

採用側への影響: 本リリースはUX・IA・UI・振る舞い仕様・アーキテクチャ・実装の必要な責務の網羅表を変更し、検証の工程移行判定基準・監査チェックリスト・UIチェックリストを拡張するため、採用プロジェクトはこれらすべての工程の対象範囲を再評価する必要がある。特に、既存のUI成果物は分割後の3責務（デザイントークン／UIテーマ／UI部品・UI設計パターン）へ照らして網羅状態を再確認し、視覚的な論理画面を持つ対象範囲ではデザインシステム参照実装要件への対応も確認する（`27_Architecture.md`・`28_Implementation.md`・`29_Verification.md`それぞれに追加した対応する入口契約・責務網羅表・工程移行判定基準・チェックリスト項目を含む）。既存のサービスブループリントは、共有・引き継ぎ、一時的 / 永続的な意味、同一対象の別投影候補の網羅状態を再確認する。既存のUI・振る舞い仕様の対応関係は、`24_UI_Behavior_Specification.md`に追加した4行（投影同期／選択コンテキスト共有、作業モード切替、可視性、一時的 / 永続的な意味）を再確認し、これらは`26_Behavior_Specification.md`自身の責務網羅表（同行には可視性の義務に対応する表示 / 非表示条件と権限による表示差も加わる）と`29_Verification.md`のUIチェックリストにも反映されている。既存のUI完了レビューは、`25_UI.md`§4.1に追加した層別評価要件（IA構造、情報提示の意味構造、具体的な表示構造、UI契約、内容、状態網羅、アクセシビリティ、視覚品質、実装差分を単一の「UI品質」に潰さない）を適用する。製品横断の視覚参照が画面視覚一覧しかないプロジェクトは、その発見可能性も確認する。IA／UIの変更とは別に、一つの対象範囲へ複数の監査を実行するプロジェクトは、`10_Agent.md`§7.5の統合規律を採用する必要がある。監査集合の開始前に対象改訂版を固定し、監査用サブエージェントを読み取り専用に保ち、すべての必須監査が終了するまで修正や統合修正方針についての人間判断の要求を行わず（`10_Agent.md`3.1・3.3が必須とする上位判断への移送は統合の完了を待たない）、統合した修正方針を修正の開始前に指摘元の各監査へ再提示する。監査へ指摘事項だけを返させている既存のエージェント定義、プロンプト、作業手順や、一部の監査結果を先に適用している運用は更新が必要である。この移行は、既存の基準版からv0.7.0へ更新するプロジェクトにとって任意ではなく必須である。CRDDを初めて採用する場合は比較対象となる差分がないため`19_Maintenance.md`§6.2.1の対象外だが、基準版採用評価と人間の決定権限者による有効化は省略しない。更新するプロジェクトは、v0.7.0への`Conformant`表明を記録する前に、`19_Maintenance.md`§6.2.1の移行完了の条件を満たす必要がある。

保守規則の変更自体も規範であり、上記のIA／UI変更とは独立した採用側への影響を持つ。確認が必要なのは次の2点である。第一に、旧文言（理由を示すだけ）の下で基準版採用評価を「対応なしで採用」として終了したプロジェクトは、強化後の`Not Applicable`の規律に照らしてその判断を見直し、確認した人間の決定権限が記録されていない場合は補う。第二に、v0.7.0への移行、および差分が規範もしくは破壊的に分類される、またはCHANGELOGが移行を必要と明示する以降の基準版への移行は、§6.2.1の移行完了の条件（5点）を満たすまで、その基準版への`Conformant`表明の根拠にできない。この場合は、過去の`Conformant`表明を未確認のまま残さず、対象範囲・既知リスク・再評価契機を明示した`CRDD-Inspired`等として暫定状態を記録する。v0.6.2以前で運用しているプロジェクトは、v0.7.0を有効化するまで現在の有効な基準版に従う。

移行注記（v0.6.2 → v0.7.0）:

- 変更分類 / 移行の要否: `change_classification: breaking`、`migration_required: true`。本基準版更新は、採用処置にかかわらず移行完了の条件の対象であり、対応なしで採用する場合も対象に含む。
- 必須操作: 変更後の責務網羅表に照らしてUX・IA・UIの対象範囲を再評価する。視覚的な論理画面を持つ対象範囲では、デザインシステム参照実装を用意または特定し、契約と実装の既知差分を記録する。既存のUI・振る舞い仕様の対応関係を新設4行（投影同期／選択コンテキスト共有、作業モード切替、可視性、一時的 / 永続的な意味）に照らして再確認し、既存の振る舞い仕様を`26_Behavior_Specification.md`の責務網羅表が求める可視性の義務の項目に照らして再確認する。画面視覚一覧が製品横断で唯一の視覚参照である場合は、その発見可能性を確認する。一つの対象範囲へ複数の監査を実行するプロジェクトは、統合と監査間是正方針レビューの規律を採用し、これを迂回している既存のエージェント定義、プロンプト、作業手順を更新する。
- 条件付き操作: `26_Behavior_Specification.md`・`27_Architecture.md`・`28_Implementation.md`・`29_Verification.md`の項目は、当該工程を対象範囲に持つプロジェクトだけに適用する。視覚的な論理画面を持たないプロジェクトは、人間が確認した理由とともに`Not Applicable`を記録する。
- 対象外: 安定コンテキストIDの変更、必須のファイル名・フォルダ構成の指定、既存の`REQ`／`UX`／`IA`／`UI`／`SPEC`識別子の変更はいずれも発生しない。上記のデザインシステム参照実装は責務の追加であり、固定のパスやファイル数を指定しない。既にチームが保有するコンポーネントカタログツールで満たしてよい。スキーマの追加は、`52_Conformance_Audit.md`§12の報告項目3つ、`19_Maintenance.md`§6.3の移行注記キー2つ、`52`と`53`が継承する`51_Document_Audit.md`§3.2の指摘事項項目6つ、および`10_Agent.md`§7.5の`audit_set`の記録である。いずれも固定ファイルや固定YAML形式は要求せず、プロダクト成果物へ新しい固定スキーマを要求しない。
- 検証: 参照と用語の追従は文書監査で確認する。責務網羅表の変更が複数工程へ及ぶ場合は不足／影響監査を実行する。表明を記録する前に、影響する準拠基準を再評価する。
- ロールバック / 回復: 移行完了の条件を満たすまで、従来の基準版を有効なまま維持する。評価のために読んだ採用候補の基準版は、人間が有効化するまでプロジェクトを拘束しない。
- 延期した場合の既知リスク: 実行可能な視覚参照を持たないままUIレビューを継続することになり、契約と実装の乖離が検出されない。移行を完了せずv0.7.0への`Conformant`表明を記録しても、`52_Conformance_Audit.md`§7の適格性を満たさない。

<a id="changelog-v062-ja"></a>

### v0.6.2 — 軽量な基準版採用評価（2026-07-24）

v0.6.1からの変更:

- 採用プロジェクトがCRDDのタグ、コミット、サブモジュール参照、配布文書一式、標準へのプロジェクト固有差分、準拠評価基準を変更するとき、既存の基準版採用規則を軽量な基準版採用評価として実行できるようにした。
- ファイル差し替えやサブモジュールポインタ更新を採用完了とせず、意味、AI挙動、準拠、工程契約、成果物・接続部・運用の差分を評価する。
- 専用ファイル、専用フォルダ、固定スキーマ、差分ID、固定状態遷移、変更トレース、全監査を一律に要求しない。既存のIssue、プルリクエスト、変更トレース、作業手順、移行記録から結果を取得できればよい。
- 採用候補の基準版と現在有効な基準版を分離した。AIは評価・適応作業のために候補版を読めるが、責任を持つ人間が有効化するまでは、正式な完了条件または準拠根拠として扱わない。
- 影響する準拠基準だけを再評価し、工程横断またはAI挙動への不明な影響だけを不足／影響監査へ接続する。旧基準版の準拠結果を、適用性判断なしに新基準版へ引き継がない。
- 概要、README、導入用エージェント指示、保守、準拠監査、不足／影響監査を同じ採用経路へ揃えた。

採用側への影響: プロジェクト成果物の移行、新しい安定コンテキストID、工程契約変更、準拠基準変更、必須監査、必須変更トレースは追加しない。v0.6.2へ更新するプロジェクトは、現在版と候補版、関係するリリース差分、プロジェクト固有接続部を確認し、責任を持つ人間が有効化を判断する。追加の移行、監査、検証は、検出した影響がある場合だけ実施する。

<a id="changelog-v061-ja"></a>

### v0.6.1 — 軽量な未採用候補の保持（2026-07-24）

v0.6.0-p1からの変更:

- 今すぐ分析しないが後から再検討する価値がある未採用入力を、課題探索・要求形成内で任意に保持できることを明確にした。
- 未採用の保持候補、人間が採用して延期したロードマップ項目、`CHG-*`を必要とする変更を分離した。候補の保持や調査だけでは、実装を許可せず変更トレースも作成しない。
- 候補ファイル、専用フォルダ、ひな型、標準`CAND-*`識別子、固定状態、担当者、期限、全候補の一括確認を必須にせず、軽量な運用を維持した。
- 現在の対象範囲と無関係な保持候補を処理せずに、活動中の作業を完了できるようにした。通常確認するのは、現在の対象範囲、到達した再検討契機、または人間の指定に関係する候補だけである。
- 概要と変更トレースのフロー図を更新し、課題探索・要求形成、文書化、変更、README、導入用エージェント指示を明確になった経路へ揃えた。

このリリースでは、必須工程、必須成果物、安定コンテキストID、固定された候補の状態遷移、全候補の一括監査を追加せず、既存プロジェクト成果物の移行も要求しない。任意の候補保持を使用する場合だけ、既存の課題探索・要求形成契約の中で確認する。

<a id="changelog-v060-p1-ja"></a>

### v0.6.0-p1 — READMEアンカー修正（2026-07-24）

v0.6.0からの変更:

- 英語・日本語の入口表から、過去のv0.4.2→v0.5.x移行案内へ移動する同一文書内リンク2件を修正した。
- 見出しの文言を将来変更してもリンクが切れないよう、両言語の移行案内へ安定した明示アンカーを追加した。

このパッチでは、CRDD規則、工程契約、準拠、安定コンテキストID、ひな型、採用プロジェクトの移行要件を変更しない。

<a id="changelog-v060-ja"></a>

### v0.6.0 — 現実的なレビュー・人間中心品質・公開保守（2026-07-24）

v0.5.1-p1からの変更:

- CRDDの記録量を、簡潔・標準・拡張の運用規模で選べるようにした。小さく可逆な局所変更はセルフチェックで閉じられ、通常または高リスクの変更だけが対象範囲に応じたトレース、影響、移行、監査根拠を持つ。「必要な粒度」は、ファイルや分解を増やす意味ではなく、判断・実装・検証・引き渡しを再現できる最低条件として定義した。
- 工程移行を、独立レビューと、責任を持つ人間の決定権限者による判断の二段階へ整理した。内容の決定権限者と工程移行の決定権限者が同じ場合は、一度の人間承認で両方を扱える。決定権限が異なる場合または専門承認が必要な場合だけ、人間の判断を分ける。
- 既存の後方伝播規則を実行可能にした。人間の判断、制約、学び、根拠、指摘事項が確定または変更された時点で影響確認を行い、下流で得た答えを、影響する上流・同層の未決事項へ反映してから通常完了とする。
- 課題探索・要求形成と要求工学を強化した。情報源から要求までの分離、個別要求の昇格基準、要求集合の品質、検証義務、プロジェクトが選ぶ品質観点プロファイルを追加した。ISO/IEC/IEEE 29148:2018、15288:2023、12207:2026、ISO/IEC 25010:2023は、準拠を主張せず、`informed_by`等の範囲を限定した関係で利用箇所を記録する。
- UX、IA、UI、振る舞い仕様に、判断しやすい説明、設定候補の抽出、人間中心品質、体験表現意図、視覚表現方針、UIテーマ、UI部品、UI設計パターン、アクセシビリティ、UIと振る舞い仕様の明示的な対応関係を追加した。新しい競合正本は作らず、各観点を責務を持つ工程文書へ分配した。
- 日本語の正本文書をロケール優先の表現へ統一した。人間向けの見出し、項目名、状態説明、本文は日本語表示を基本とし、相互運用や規範強度に必要な正式英語名、識別子、スキーマ値、ファイル名、BCP 14キーワードは維持した。
- READMEと概要へ、平易な開始案内と小さな問題から始める例を追加した。人間は全正本文書を通読せずに開始でき、AI入口は対象範囲に必要な決定権限文書を選択して読む。
- CRDD公式リポジトリと配布テンプレートへ、GitHub Copilot向けのAI入口接続部を追加した。この接続部はCRDD準拠要件ではなく、特定AI提供元の利用も要求しない。
- CRDD自身の公開フィードバックと保守経路を、問題・根拠、影響と代替案、人間による採用、レビュー、監査、統合、リリース待ち、リリース完了まで接続した。Issue、ラベル、ブランチ、プルリクエストの運用は公式リポジトリ固有とし、採用先へ要求しない。
- ライセンスをApache License 2.0へ変更し、NOTICEと商標方針を追加した。標準の著作物はApache 2.0で扱い、Qual-Lab、Qualの名称、ロゴ、関連ブランド識別子を商標として許諾するものではない。
- 正本文書、監査、ルートと配布テンプレートのエージェント指示、変更トレースとロードマップのひな型、README、文書ヘッダーをv0.6.0基準版へ揃えた。

v0.6.0では安定コンテキストIDの種類を追加しない。標準の種類は引き続き`REQ`、`UX`、`IA`、`UI`、`SPEC`である。

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

#### v0.1.0リリースに含まれていたもの

次はv0.1.0当時の履歴であり、現在のライセンスを説明するものではない。

- `LICENSE` — 当時のCRDD文書等の著作物に対するCC BY-NC-SA 4.0
- `COMMERCIAL_LICENSE.md` — 当時使用していた商用ライセンスの取得経路
- `TRADEMARK.md` — CRDD / Qual-Lab名称・商標の別ポリシー
- `README.md` — 当時の入口
