# CRDD Changelog

All notable changes to CRDD itself (the methodology documents in this folder) are recorded here.
CRDD自身（このフォルダ内のメソドロジー文書）の変更履歴を記録する。

**[English](#english)** | **[日本語](#日本語)**

---

## English

<a id="changelog-v0190-en"></a>

### v0.19.0 — Candidate (Unreleased)

The current candidate strengthens Communication reasoning without making one mandatory reasoning schema. It distinguishes trigger, non-trigger, and insufficient-information cases for Cognitive Intent; preserves historical hypotheses and current intent separately; limits AI projection to relevant, current, traceable context; and keeps commerciality, research safety, persuasion risk, and post-adoption value with their responsible canonical artifacts. This entry describes work in progress and does not establish publication, adoption, or conformance. The released baseline remains v0.18.1.

The dogfooding-wide candidate also makes assurance cost, planned and actual change routes, route deviations, and effective verification observable through existing Change Trace and quality evidence. Assurance cost is evaluated as the total cost to an accepted result, not as a target for reducing review or audit. Human readability remains the responsibility of the existing Document Audit, which checks intuitive display names, concise explanations, terminology dependency, sentence complexity, and information structure. This change does not add fixed profiles, an automatic routing engine, a readability-only checker, or length-based gates. It remains work in progress and does not change the released v0.18.1 baseline.

The same self-audit separates document ownership from content correctness. Tool implementation and static-analysis rules are canonical in Coding Standards; Runtime trust, resources, and execution identities remain in the responsible Architecture; repeatable commands remain in Workflow; and verification scope and results remain in Quality Assurance. Maintenance keeps change, migration, and release decisions instead of redefining those Tool contracts. This is a responsibility relocation with no change to the existing Runtime semantics, normative strength, or migration result, and it introduces no new artifact type.

The v0.19.0 candidate is composed of four independently traceable changes:

| Change trace | Release meaning |
|---|---|
| [CHG-000057](90_Release/Changes/CHG-000057_Minimum_AI_Native_Project_Runtime.md) | Add the bounded single-project Runtime, authenticated MCP entry, durable queue, task graph, integration, decision, cancellation, and exact recovery boundaries |
| [CHG-000058](90_Release/Changes/CHG-000058_Reasoning_Context_and_Design_Intent.md) | Preserve only decision-relevant reasoning context, distinguish current intent from history, and project a relevant traceable subset to AI |
| [CHG-000059](90_Release/Changes/CHG-000059_Dogfooding_Assurance_Route_and_Readability.md) | Make assurance cost and actual change routes observable and strengthen document ownership, readability, and completion-claim discipline |
| [CHG-000060](90_Release/Changes/CHG-000060_CRDD_Brand_Icon_Adoption.md) | Store two source-resolution variants of the same CRDD brand icon without extending trademark permission or Runtime identity |

Adoption impact: the combined candidate is `breaking` because CHG-000058 and CHG-000059 change normative evaluation for applicable active or resumed work. CHG-000057 is an opt-in Runtime capability and does not remove the v0.18.1 single-task entry. CHG-000060 is additive and requires no migration.

Migration note (v0.18.1 → v0.19.0 candidate):

- `migration_required: true`
- `change_classification: breaking`
- Required for every existing-baseline update: evaluate adoption of the new baseline; inventory every active, resumed, or otherwise governed asset; decide each asset's disposition including an explicit none-applicable result; complete required treatment; and independently confirm that the migration preserves meaning before declaring the baseline update complete.
- Required: assess active or resumed consumers of reasoning context, Communication, Change Trace, Quality Assurance, Documentation, Agent guidance, Architecture, and Document Audit. Preserve historical decisions and hypotheses; identify the current intent; do not claim overall completion when a required perspective remains unevaluated.
- Conditional for Project Runtime adopters: verify the Repository binding and authenticated local principal, use the durable queue and exact recovery identity, and keep the v0.18.1 single-task command available until the Project Runtime release gate is satisfied. Projects that do not enable Project Runtime need no Runtime migration.
- Not required: retrospectively rewrite completed artifacts, create dedicated reasoning files or databases, introduce a new audit type, adopt the brand icon in a UI, or change existing trademark permissions.
- Rollback: keep v0.18.1 as the active baseline until v0.19.0 activation is decided. Before returning from an activated Project Runtime, stop new objectives, settle every exact task, candidate, queue, decision, and recovery obligation, and retain evidence whose observation remains unknown. Restore the clone or submodule to the official v0.18.1 tag as one distribution.
- Known risk if deferred: current work may lose decision-relevant context, overstate readiness, or apply a partially connected Project Runtime as complete. Runtime users may also create competing work or abandon an exact recovery obligation.
- Verification: the final candidate requires the repository-wide checker, deterministic and real-process tests, authenticated MCP, cancellation, parent-loss, recovery-settlement, and interactive/scheduled-conflict evidence, followed by independent review and applicable audits on one fixed revision. Provider and signed E2E are required only when the Runtime execution identity changes or the final Runtime candidate is fixed.
- Known limitation: v0.19.0 remains single-Repository and single-Project in responsibility. It does not establish multi-project scheduling, Linux or macOS availability, a permanent autonomous service, a universal reasoning schema, or legal clearance of third-party brand rights.

<a id="changelog-v0181-en"></a>

### v0.18.1 — Coordinator Adoption Interface Correction

Corrects the first public Coordinator Runtime adoption path. Local Personal no longer exposes persistent `activate`, `disable`, or `provision` lifecycles: ordinary tasks verify their required conditions per operation. The unused commands, state records, provisioning stores, bootstrap supervisor, compatibility shims, and the second native artifact are removed rather than retained as always-blocked interfaces. `capabilities --json` reports the exact effect-free public capability set. Signed manifest revision 5 separates release identity from Runtime execution identity and binds execution authority to the machine-derived closed Runtime dependency set, security policies, and the single Platform Access artifact. Documentation-only changes do not require Runtime re-signing or provider E2E when that execution identity remains unchanged. This release does not rewrite the v0.18.0 tag or its historical evidence.

Migration note (v0.18.0 → v0.18.1):

- `migration_required: true`
- `change_classification: breaking`
- Required: projects using Coordinator Runtime must update the CRDD clone or submodule, run `capabilities --json`, and invoke `task` directly; the deleted setup commands are not valid v0.18.1 entry points.
- Conditional: if an unexpected host effect or retained recovery record is observed, stop for the recorded recovery decision instead of deleting or migrating it by assumption.
- Not required: projects using only the CRDD methodology and not Coordinator Runtime require no execution migration. Documentation-only changes with unchanged Runtime execution identity require no Runtime re-signing or provider E2E.
- Rollback / recovery: stop new tasks and settle or discard every exact candidate before changing the adopted revision. When a Provider effect completed, the result is known, the candidate is absent or discarded, cleanup is confirmed, no recovery identifier remains, and target resources are absent, preserve that settled evidence and switch without pretending the effect was cancelled or never issued. If cleanup is unknown or a recovery identifier exists, complete that exact recovery and confirm resource absence before switching; preserve evidence when observation remains unknown. Restore the clone or submodule to the official `v0.18.0` tag as one distribution, do not reuse v0.18.1 policy or consent, and use v0.18.0 only for its methodology or stop Runtime use because its setup entry points do not reach a useful result.
- Known risk if deferred: adopters may continue calling permanently blocked setup commands, or may bind execution trust to an unrelated repository-tree change and repeat signing or provider tests without gaining useful evidence.
- Verification: final publication requires the revision-5 signed manifest, fresh-adopter useful-result E2E, full tests, and independent review on the same fixed Runtime execution identity. Deterministic tests must show that documentation and tests do not change that identity while Runtime source, policy, or native-artifact changes do.
- Known limitation: Runtime dependency closure uses fail-closed lexical analysis and accepts only verified `node:` built-ins or canonical relative targets in the closed execution set. Selected scripts may start Node.js children or Workers only at the same source or a literal target in that closure. Arbitrary runtime-generated paths remain unsupported, and an equal identity does not by itself make a security-semantic change safe.

<a id="changelog-v0180-en"></a>

### v0.18.0 — Methodology, Agent Organization, and Reference Runtime

Clarifies the UI reference medium for terminal interfaces: line-oriented CLI and screen-based TUI use executable terminal references, while existing Web/GUI HTML requirements remain unchanged. Choosing a medium does not waive interaction, accessibility, independent review, or human decisions. Adopters classify each presentation surface, update the UI/specification mapping and known differences, and verify the actual target terminal before claiming completion. See [UI reference conditions](25_UI.md#design-system-reference) and [the existing tool-layout change](90_Release/Changes/CHG-000017_Tools_Coding_Standards.md).

Quality document naming is also a breaking placement change: within `07_Quality/`, rename `Quality_Center.md` to `01_Quality_Center.md`, `Quality_Strategy.md` to `02_Quality_Strategy.md`, and `Verification_Design.md` to `03_Verification_Design.md`. Update active references and scripts while preserving content, anchors, project additions, and assessment meaning. Keep `Verification_Results/` and dated records unchanged. If a destination already exists or history constraints are unclear, stop rather than overwrite. Verify layout, links, templates, and applicable conformance before activating the new baseline; rollback restores placement and consumers together. See the [migration procedure](90_Release/Changes/CHG-000017_Tools_Coding_Standards.md#quality-document-naming). This does not require empty quality documents for an inapplicable scope.

The v0.18.0 difference set combines the following seven canonical change traces. It covers decision support, external communication, specialized AI organization, the reference Runtime, tool maintenance and placement, and methodology improvements evaluated through dogfooding. The separate non-normative architecture material evaluates future execution projections; it does not add conformance requirements or establish implementation availability. Verify publication and its date through the official tag or equivalent immutable Release identifier and its publication record. This entry, a branch, Commit, or Stable status alone does not establish publication.

| Change trace | Meaning of the current change |
|---|---|
| [CHG-000012](90_Release/Changes/CHG-000012_Current_Decision_Set.md) | Reconstruct the decisions humans must make from the current revision after remediation and re-review |
| [CHG-000013](90_Release/Changes/CHG-000013_Communication_Market_and_Adoption_Exploration.md) | Connect adoption-oriented communication to Discovery-owned exploration, preserving research and persuasion safety |
| [CHG-000014](90_Release/Changes/CHG-000014_V018_Architecture_Candidate_Integration.md) | Separate candidate adoption boundaries and continue toward approved goals without unnecessary approval interruptions |
| [CHG-000015](90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md) | Implement and verify bounded delegation, independent review, cancellation, cleanup, and recovery in the reference Runtime |
| [CHG-000017](90_Release/Changes/CHG-000017_Tools_Coding_Standards.md) | Strengthen tool-development contracts and migrate implementation and supporting artifacts to their owning phase folders |
| [CHG-000054](90_Release/Changes/CHG-000054_Agent_Organization_Document_Architecture.md) | Separate role, specialty, capability, authority, independence, cost, and result integration |
| [CHG-000055](90_Release/Changes/CHG-000055_CRDD_Long_Term_Evolution_Roadmap.md#26-実務評価と最終確認への引渡し) | Record long-term direction separately from current commitments; strengthen phase connections, verification, convergence, and readability; evaluate evidence-driven refactoring and practical utility |

For Runtime use, fix the clone or submodule to the selected official Release tag and verify the embedded manifest and native Runtime artifacts against that release. No separate Runtime archive is required. An unsigned development branch, a modified checkout, this entry, or an earlier candidate signature cannot establish that verification. Signed candidate `48515eb` completed four delegation routes, seven recovery scenarios, and an actual terminal cancellation with cleanup confirmed. Earlier candidate `45ea2ac` also supported a bounded ordinary-CLI task through independent review, parent verification, and candidate disposal; that utility result is not a measurement of the later candidate. Those completion and terminal assessments apply to their recorded revisions, not automatically to another distribution. Human authorization is not evidence of publication or final-identity signing, and earlier candidate signatures are not transferred to a new tag. Internal source, tests, and build definitions move from `tools/` to `40_Develop/`, behavior to `05_SPEC`, design to `06_Architecture`, and operating procedures to `19_Workflows`. The adopting-project checker remains at `template/tools/crdd-check.ts`; existing signed distributions and fixed historical evidence are unchanged. See the [current quality status](07_Quality/01_Quality_Center.md) and [migration trace](90_Release/Changes/CHG-000017_Tools_Coding_Standards.md#9-内部ツールの工程別配置への移行). Practical dogfooding demonstrated bounded use, not a general speed, cost, or human-attention advantage.

The Local Personal v1 distribution trust requires the Ed25519 release manifest, Git identity, and exact native artifact hashes. Authenticode is an optional fixed-publisher defense, not a second installation or download prerequisite; a build that explicitly declares a publisher cannot fall back when that check fails.

The new release-manifest contract explicitly supports no expiry (`revision: 3`, `expiresAt: null`) as well as time-limited manifests. Existing revision-2 signatures remain time-limited and verifiable without rewriting their bytes. No expiry does not remove issue-date, signature, artifact-identity, authorization, or compatibility checks, and does not extend consent or operation lifetimes. It is not perpetual support; verification of this addition is tracked separately from the earlier signed candidate in the quality status.

Compared with v0.17.0:

- Strengthens [continuation toward approved goals](10_Agent.md#authorized-goal-continuation): internal steps, child-agent questions, or progress reports alone do not create another approval gate. New authority, scope, payment paths, unresolved material risk, and human stop or cancellation conditions retain their existing boundaries.
- Connects specifications, state/resource design, implementation, and normal, degraded, failure, and recovery verification. Selects [verification against remaining uncertainty](16_Quality_Assurance.md#uncertainty-driven-verification) without weakening completion conditions or independent review. Improves [human-readable document structure](03_Documentation.md#481-locale-first-display) while preserving conditions, authority, identifiers, and historical evidence; evaluates practical utility without inventing unmeasured improvements.
- Adds the Current Decision Set contract so resolved, AI-remediable, report-only, and safely deferrable matters are not returned as current Human decisions, while current major risk, irreversible effect, residual-risk acceptance, or authority conflict remains visible.
- Adds the Communication market／adoption exploration contract. Its compound trigger applies when external communication creates or changes audience, message, channel, advertising, or market-response treatment for adoption formation; it keeps Discovery authority over market and adoption hypotheses, separates observed signals from causes, checks delivery readiness before inducing external action, and preserves consent, autonomy, information minimization, selection bias, and generalization limits for human-subject work.
- Adds `04_Agent_Organization.md` as the normative foundation authority for organizing specialized AI work while retaining Human Authority.
- Adds Agentic Delivery criterion AD-22. Where work uses role assignment, delegation, execution-actor／Provider／Model selection, independent review, or Coordinator integration, it evaluates the separation of responsibility, specialty, capability, authority, verification, and integration; avoids unnecessary agents or delegation; does not infer quality, independence, or authority from a Provider or configuration name; compares cost, quota, or credit only among eligible candidates; and does not promote a result or `Pass` into Human Authority.
- Extends Agentic Delivery claims from AD-01–AD-21 to AD-01–AD-22 without requiring a permanent organization registry, fixed schema, multi-agent execution, or retrospective rewriting of closed work.
- Separates the normative Agent Organization foundation in `04_Agent_Organization.md` sections 1–11 from its non-normative execution architecture candidate in section 12 and from the current Coordinator Runtime implementation.
- Keeps the v0.18 Architecture Candidate non-normative. Its branch co-location, diagrams, runtime candidates, or future profiles do not add conformance criteria or establish implementation availability.
- Strengthens the existing maintenance and AI-entry contracts so process, channel, asynchronous I/O, cancellation, preflight equivalence, cleanup state, and audit feedback are checked against the actual production topology; implementation-specific Node, Windows-console, environment-key, timeout, and byte-limit choices remain in `40_Develop/coordinator/`, with their design in `06_Architecture/coordinator/`.
- A released baseline is identified by an official tag or equivalent immutable Release identifier. Branch contents, Stable status, checker success, or Runtime implementation alone do not establish project adoption, conformance, or execution authority.

Adoption impact: the combined release-candidate difference set is classified as breaking because it includes the Communication and quality-document placement changes. Current Decision Set, Agent Organization, and Coordinator maintenance／AI-entry changes are normative; the current CHG-000055 methodology difference is normative under the Human-approved candidate adoption. A project adopting v0.18.0 from v0.17.0 evaluates all applicable active decision-support, Communication／Discovery, Agentic Delivery, AI-entry, phase, design／verification, human-readable document, review, maintenance, and routing consumers through baseline adoption and Migration Completeness. The non-normative architecture material does not itself trigger migration. Historical completed work and old conformance records remain history and are not rewritten solely to match the new presentation or AD-22.

Migration note (v0.17.0 → v0.18.0):

- `migration_required: true`
- `change_classification: breaking`
- Required: perform the baseline-adoption assessment and satisfy Migration Completeness before activating v0.18.0. Inventory all applicable consumers of CHG-000012, CHG-000013, CHG-000014, CHG-000015, CHG-000017, CHG-000054, and CHG-000055; record their migration, replacement, retained, or not-applicable disposition; obtain independent meaning-preservation review; and record the Human activation decision and rollback boundary.
- Conditional for phase, verification, and document consumers: update active guidance where approved work is unnecessarily interrupted, design elements lack verification connections, unresolved current obligations are deferred without evidence, or presentation obscures conditions and decisions. Assess verification plans, deferral decisions, and human-readable artifacts against the existing governing contracts; retain already-conforming assets with evidence. This does not require a new framework, repeated measurements of every task, or rewriting completed history.
- Required for maintained AI entry points: preserve distinct resource roles, test the actual production process／channel topology, verify post-cleanup state rather than request completion, keep preflight and operation predicates equivalent, and generalize repeated review or audit findings into an existing governing contract where applicable. Projects that do not maintain or distribute such an entry point may disposition this consumer as not applicable with scope and reason.
- Required for decision support: update active Agent, Skill, quality, audit, and AI-entry guidance where it forwards stale or already-resolved findings, creates approval requests when no current Human decision remains, hides major unresolved risk, or groups separable decisions. Derive the Current Decision Set from the current revision after remediation and re-review.
- Required where the Communication compound trigger applies: connect adoption-oriented audience, message, channel, advertising, or market-response changes to Discovery-owned market／adoption exploration; preserve evidence type, selection and nonresponse bias, generalization limits, research consent and refusal, information minimization, autonomy, delivery readiness, stop conditions, and Human authority before external action. Communication scopes that do not meet the trigger do not create empty market-exploration artifacts.
- Required for Agentic Delivery conformance: evaluate AD-22 for the claimed scope. Existing Work Assignment, routing, review, and integration evidence may be reused when it already shows the required boundaries; no dedicated registry is required.
- Conditional: update only active or resumed consumers that violate one of these contracts. For Agent Organization, this includes inferring capability or authority from a role, Provider, Model, connection, or session; adding unnecessary delegation; comparing cost before eligibility; treating Provider difference as review independence; or promoting an Agent result into Human Authority. For Communication, re-evaluate fixed participant counts, fixed channel sequences, unsupported advertising metrics, or externally induced actions whose delivery path is unverified.
- Not required for adopting projects: adopt the non-normative Architecture Candidate, install Coordinator Runtime or include it in their own release, use multiple agents, require a fixed Planner／Executor／Reviewer flow or Provider／Model, add a permanent organization artifact or Stable Context ID, create Communication artifacts for a non-applicable scope, or retrospectively rewrite completed history. This does not remove the Runtime completion obligations already adopted for CRDD's own v0.18.0 candidate.
- Rollback / recovery: keep v0.17.0 as the active baseline until Migration Completeness and Human activation finish. If partial adoption is reversed, restore the previous active AI entry, decision-support, Communication／Discovery, and conformance scope while preserving candidate and migration records as history; do not treat rollback as erasing externally observed evidence or completed Human-subject interactions.
- Known risk if deferred: humans may be asked to re-decide resolved matters or may miss current major risk; Communication may infer market causes from weak signals, target the wrong population, pressure participants, expose unnecessary information, or promise an unsupported action; routing may conflate role, capability, and authority, let cost override eligibility, mistake Provider difference for independent review, or mistake an integrated AI result for Human approval.
- Verification: run the full repository checker on one fixed revision, then independently review Agent operation and Architecture and run Document, Gap／Impact, and Conformance Audits against that same revision. Verify the Current Decision Set representative cases, Communication trigger／non-trigger／unknown cases and human-subject boundaries, AD-22 and AD-01–AD-22 claims, bilingual migration equivalence, v0.17 preservation, and non-normative Architecture separation.
- Known limitation: these contracts improve decision presentation, adoption-exploration discipline, and explainable Agent composition, but they cannot prove a market, representative sampling, causality, delivery capacity, Provider capability, review quality, or the absence of every cost, quota, privacy, legal, or security failure. They do not replace Human Authority, qualified independent review, specialist judgment, consent, or applicable law and contract.

<a id="changelog-v0170-en"></a>

### v0.17.0 — Expert Exploration, Convergence, and External Information Boundary (2026-08-10)

This release adds a shared reasoning contract for producing strong expert candidates before Human judgment and an External Information Boundary for controlling information across research and connected-tool boundaries. It extends CRDD from preserving adopted decisions into structuring how AI and specialists retrieve patterns, synthesize alternatives, critique or falsify them, refine the result, and explain why further exploration is unlikely to change the decision. It does not define taste as fixed values, require a fixed option count, create a lighter route, treat “explored” and “converged” as evidence, or permit internal Context to be copied into queries, prompts, attachments, or tool inputs outside an authorized processing boundary.

Compared with v0.16.0:

- Adds the Expert Exploration and Convergence Contract to `11_Skill.md`. Expert decisions identify decision-changing uncertainty, use phase-specific lenses and pattern knowledge, synthesize credible candidates or explain why the current direction is the only credible one, critique weaknesses and conflicts with preserved conditions, expose remaining uncertainty, and justify convergence.
- Adds Decision-changing Evidence to Discovery, Experience Synthesis to UX, Structural Synthesis to IA, Behavioral Synthesis to Behavior Specification, Architecture Synthesis to Architecture, implementation strategy and reverse-diff critique to Implementation, and Verification / Evidence Strategy to Verification.
- Adds shared Visual Craft and Material / Spatial Expression guidance for UI, graphic, illustration, imagery, iconography, motion, presentation, and 2D / 3D assets without creating another serial phase. It treats composition, hierarchy, rhythm, typography, color, personality, form and silhouette, material response, scale, geometry and edges, object history and cause-based wear, lighting, camera, spatial context, technical fitness, and physical plausibility plus perceptual / contextual / artistic truth as critique lenses rather than fixed style rules.
- Allows an initially unexplained Human sense of visual discomfort to trigger a hypothesis and comparison, but not to become an automatic verdict. Human taste, brand judgment, publication approval, and artistic adoption remain Human authorities.
- Allows AI to identify a meaningful differentiation opportunity after the current direction is viable, but only as a proposal that separates conventional and differentiated scope, preserved conditions, expected value, cognitive and adoption cost, risk, and the required Human decision. It does not authorize AI to break an adopted principle, intent, contract, brand direction, or design direction.
- Strengthens Architecture from Drivers / Trade-off evaluation to Drivers → Synthesis → Evaluation. Pattern names are candidate-generation vocabulary, not answers; boundary reasoning, state ownership, failure-first reasoning, sensitivity, reversibility, and premortem distinguish credible structural strategies.
- Requires quality assurance and independent specialist review to evaluate actual artifacts and explainable reasoning results rather than option counts, activity logs, checklists, self-declared completion, or a single viewport.
- Adds non-normative README instructions for initial CRDD adoption, baseline migration, every product lifecycle phase, Communication, managed dependency, visual craft, and 3D material / spatial expression.
- Adds conditional Product Lifecycle criterion PL-19. It applies when an expert decision is created, changed, or adopted. Record-only updates do not invent expert alternatives, and no new fixed artifact, schema, Stable Context ID, audit type, approval stage, tool, or model-specific route is required.
- Adds the External Information Boundary to `01_Principles.md` and Core criterion C-11. An authorized processing boundary is identified from information class, purpose and action, destination or tenant, actors, retention, secondary use, retransmission, applicable contract or law, residual risk, and the authorized decision-maker as warranted by risk; it is not inferred from “internal,” private, signed-in, installed, or one-off approval. Inside that boundary, only information authorized for the purpose is sent in the minimum necessary amount. Research outside it uses a separately constructed, redacted, abstracted, and minimized Context; when classification, authorization, boundary conditions, or safe abstraction is uncertain, transmission stops for Human decision.
- Treats information classification as inherited unless explicitly overridden and protects derived or combined information at the same or higher sensitivity where reidentification risk increases. Secret values are not Context; agents receive references to runtime-injected secrets only when required.
- Treats presence inside an authorized boundary or tool as insufficient to grant instruction, decision, or action authority. Content is a permitted instruction only when the agent contract, an authenticated actor, and the authorized purpose and action separately establish that authority; otherwise it remains untrusted Evidence. Prompt injection, poisoned documents or tools, cross-agent leakage, privilege expansion, sensitive inference, hallucinated authority, unsafe actions, and external-tool supply-chain risk are evaluated through Architecture, Implementation, Verification, and Quality Assurance. Delegation does not expand privilege, and important security invariants use runtime enforcement and synthetic boundary tests where available instead of agent self-attestation.

Adoption impact: this is a breaking, non-structural Core, Product Lifecycle, and AI-execution change. Existing-baseline adoption is subject to [Migration Completeness](19_Maintenance.md#621-migration-completeness). Core claims evaluate C-11 and Product Lifecycle claims evaluate PL-19. Projects update active phase skills, quality evidence, AI entry points, local guidance, information classification, external-service connections, tool privileges, and security verification only where the existing project cannot preserve the new contracts. Closed historical work is not rewritten solely to match the new explanation format.

Migration note (v0.16.0 → v0.17.0):

- `migration_required: true`
- `change_classification: breaking`
- Required: perform the baseline-adoption assessment and satisfy Migration Completeness before activating v0.17.0. Record the adopted source, project-owned adaptations, affected active work, Human activation decision, and rollback boundary.
- Required for Product Lifecycle conformance: evaluate PL-19 for the claimed scope. For expert decisions created, changed, or adopted after activation, preserve explainable uncertainty, lens and pattern use, candidate synthesis, critique or falsification, remaining uncertainty, and convergence evidence.
- Required for Core conformance: evaluate C-11 for the claimed scope. Identify the connection population, applicable information classes and inheritance, derived or combined information risk, authorized processing boundaries, boundary-external connections, agent and tool privileges, external-input instruction authority, supply-chain assets, security invariants, enforcement, verification, audit, revocation, and recovery. A scope with no connection still records a zero population and reevaluation trigger rather than treating C-11 as not applicable or creating an empty artifact.
- Required before enabling external research or connected tools: identify the purpose and action, information class, destination, actors, retention and secondary use, retransmission, applicable authority, and other conditions warranted by risk. Inside an authorized processing boundary, send only authorized information in the minimum necessary amount. Outside it, construct a separate minimum Context by redaction plus abstraction, check combination-based reidentification and destination authorization, and retain the Human decision where residual disclosure risk cannot be safely resolved. Authorization for one purpose, service, tenant, or publication destination is not reused for another. External results do not acquire instruction authority merely by being inside a connected tool.
- Required for active or reopened phase work: update local phase instructions, skill adapters, quality strategy or verification design only when current project artifacts cannot preserve the applicable lens. Do not rewrite closed phase artifacts merely for format alignment.
- Conditional for visual work: when UI, graphic, presentation, motion, or 2D / 3D asset decisions are in scope, connect Visual Craft results to the owning UI, Communication, quality, or project artifact and retain Human aesthetic and brand authority. Use multiple viewing conditions only where they can change the decision.
- Conditional for staged implementation: use compatibility bridges, parallel states, dual operations, or feature switching only when the specific migration risk requires them and Human-approved scope, duration, comparison, consistency, stop, rollback, cost, and removal conditions exist. They are not a lighter default route.
- Not required: a fixed number of alternatives, a permanent exploration document, new phase folders, new audits or approvals, a model capability score, a checklist-based aesthetic verdict, a specific design / 3D / security tool, a broker implementation, a security label on every file, transmission of real secrets for testing, or retrospective rewriting of completed history.
- Rollback / recovery: until Migration Completeness and Human activation finish, keep the current v0.16.0 baseline and procedures active. If partial adoption is reversed, restore v0.16.0 AI and phase adapters, preserve v0.17.0 candidate records as history, and return active work to its last recorded decision and verification boundary.
- Known risk if deferred: AI may continue to fill phase artifacts correctly while failing to generate credible opportunities, experience structures, visual directions, behaviors, architectures, implementation strategies, or verification evidence. It may also disclose identifiable internal Context through external queries or tools, accept malicious external instructions, or use over-privileged or unassessed dependencies. Humans may remain the hidden rescue layer, causing late rework, repeated critique loops, or security incidents.
- Verification: run the full repository checker on one fixed revision, then independently review agent operation, document quality, and gap / impact plus conformance impact. Reconstruct representative existing-direction, multiple-candidate, insufficient-information, visual / 3D, record-only, no-connection, authorized private processing, safely abstracted public research, authorized publication to a specified destination, authorization-reuse rejection, blocked identifiable query, malicious external instruction, stale boundary condition, least-privilege, and supply-chain cases from the canonical rules. Use synthetic sensitive-like fixtures, never real secrets, for boundary tests.
- Known limitation: these contracts improve the quality and inspectability of expert exploration and the systematic control of external information flow, but cannot guarantee originality, taste, domain expertise, complete pattern knowledge, correct causal inference, perfect secret or personal-data detection, the trustworthiness of every external service, or absolute security. Runtime enforcement depends on project capabilities. Human authority and qualified specialist review remain necessary where the scope requires them.

<a id="changelog-v0160-en"></a>

### v0.16.0 — First-Pass Convergence (2026-08-10)

This release improves the probability that a non-trivial change reaches independent review as one coherent fixed candidate. It does not introduce a shadow route, a model-trust score, a record-field whitelist, sampling-based approval, or a lighter audit class. Instead, it strengthens preparation before freeze and gives the first independent review explicit counterexamples to reconstruct.

Compared with v0.15.0:

- Requires a non-trivial change to identify both its contract population and its consumer population before editing, including the canonical authorities, direct projections, templates, AI entry points, public guidance, migration records, and current-state views that can preserve or degrade the meaning.
- Requires representative activating, non-activating, boundary, and insufficient-information cases when a conditional rule controls applicability, escalation, status, conformance, migration, or Human decision. The insufficient-information case cannot be silently treated as activation, non-applicability, or completion.
- Separates four things that had repeatedly collapsed into one sentence: the concept definition, the activation condition, the handling of an undecidable case, and the result vocabulary used after evaluation.
- Adds a pre-freeze reconciliation against the actual diff. The parent agent compares the planned populations and cases with changed files, unchanged consumers, references, generated views, migration text, and current-state projections before fixing the review target.
- Makes the first independent review reconstruct the same four case types and check direct consumers rather than waiting for a first finding to reveal the missing branch.
- Extends verification design and Document, Conformance, and Gap / Impact audits to preserve these boundaries without creating another audit, approval gate, permanent artifact, profile, Stable Context ID, or external QA dependency.
- Extends the optional checker only where the rule is deterministic: the official repository must have exactly one current English and Japanese CHANGELOG release section, each with one valid and matching `migration_required` declaration. A migration-requiring release must also have one matching change classification and expose the required structured migration-note categories. Missing, invalid, duplicate, or bilingual-conflicting declarations are errors; prose and prior releases are not declarations. Checker success still proves only implemented checks.

Adoption impact: this is a breaking, non-structural Agentic Delivery and maintenance change. Existing-baseline adoption is subject to [Migration Completeness](19_Maintenance.md#621-migration-completeness). Projects that use AI for non-trivial maintenance or claim Agentic Delivery re-evaluate their pre-execution planning, first-review input, and AD-02 evidence. Projects that verify conditional rules through CRDD quality assurance re-evaluate PL-16; first independent reviews of newly introduced or changed conditional rules re-evaluate AD-21. Existing closed changes and historical review records are not rewritten solely to match the new preparation format.

Migration note (v0.15.0 → v0.16.0):

- `migration_required: true`
- `change_classification: breaking`
- Required: for non-trivial AI-assisted changes, identify contract and consumer populations, record activating, non-activating, boundary, and insufficient-information cases for conditional rules, and reconcile them against the actual diff before fixing the candidate.
- Required for Agentic Delivery conformance: re-evaluate AD-02 and ensure the change execution record or equivalent evidence can show the populations, representative cases, pre-freeze reconciliation, and unresolved mismatches.
- Required when CRDD quality assurance verifies a conditional rule: re-evaluate PL-16 so Verification Design and Evidence distinguish the definition, activation, undecidable handling, formal result, and the four representative case types.
- Required for the first independent review of an introduced or changed conditional rule: re-evaluate AD-21 so the reviewer reconstructs the four case types and consumers from the canonical authority rather than reusing the implementation plan.
- Conditional: update local AI entry points, change templates, verification design, or audit procedures only when they cannot preserve these inputs or reconstruct the four cases. Projects that do not use the supplied checker may use an equivalent deterministic confirmation and state its limits.
- Not required: create a new audit, approval stage, permanent convergence artifact, field whitelist, shadow workflow, random-sampling gate, model capability score, or lighter review path; rerun completed historical changes; reduce any currently required independent review or specialist check.
- Rollback / recovery: keep the currently active v0.15.0 baseline and procedures until Migration Completeness and Human activation are complete. If a partial adoption is reverted, restore the v0.15.0 AI entry and change-execution procedure, retain candidate records as history, and return in-flight changes to their previously recorded review boundary.
- Known risk if deferred: conditional rules may still be repaired one counterexample at a time; unchanged consumers, templates, migration notes, or current-state projections may be discovered only after freeze; review loops and replacement Evidence may therefore continue even when the edited rule looks locally correct.
- Verification: run the full checker and its complete regression and coverage suite for one fixed candidate, then perform independent agent-operation review, Document Audit, and Gap / Impact with conformance-impact review against the same target. Each semantic review reconstructs the four representative case types and checks contract and consumer populations.
- Known limitation: explicit cases and pre-freeze reconciliation improve convergence but cannot prove that an unknown consumer has been discovered, that a semantic judgment is correct, or that every reviewer interprets an ambiguous domain identically. Human authority and independent specialist review remain necessary where applicable.

<a id="changelog-v0150-en"></a>

### v0.15.0 — Communication and Context Dependency (2026-08-10)

This release adds two reusable contracts without turning communication into another product phase or prescribing a Git topology. Communication connects canonical product context to audience-specific claims, generated projections, Human publication decisions, immutable publication history, and measured learning candidates. Context Dependency distinguishes inherited meaning from versioned executable artifacts and makes adopted versions, local overrides, consumers, update impact, and recovery explicit.

Compared with v0.14.0:

- Adds `17_Communication.md` as the authority for audience, purpose, claims and evidence, Design Direction, publication decisions, Publication Records, measurement, observations, hypotheses, and learning candidates.
- Keeps Communication out of the linear phase sequence. Discovery, UX, IA, UI, Quality Assurance, and Release retain their existing authority while contributing to or consuming the shared contract.
- Adds the optional `80_Communication/01_Communication.md` entry artifact. Repositories that do not communicate externally do not create the folder, and repositories that do use it split SEO, landing pages, presentations, performance measurement, or other details only when needed.
- Separates a Communication Projection that can be generated from current context from a Publication Record of what was actually approved and published. A later projection does not overwrite publication history.
- Requires claims to remain connected to applicable evidence, conditions, source revisions, and unverified scope. AI may draft and compare but does not approve publication, legal or trademark conclusions, privacy or security disclosure, brand decisions, or risk acceptance.
- Routes measured reactions through measurement, observation, hypothesis, learning candidate, and Human decision. Click-through, conversion, search, or other response does not become Product Truth or a requirement automatically.
- Defines Design Direction as a shared alignment contract among UX, IA, UI, and Communication rather than a new phase or final visual specification. It can also be used for product UI, presentations, Web, or documentation without external publication and does not by itself require `80_Communication`.
- Adds `18_Context_Dependency.md` to distinguish semantic Context Dependency from versioned Artifact Dependency. Its full contract applies to context dependencies, artifact dependencies whose meaning, contract, adopted version, or update decision must be coordinated across independently managed consumers within the adopting organization, and artifact dependencies requiring explicit management for material quality, security, privacy, legal, license, compatibility, or recovery risk. Ordinary and transitive implementation dependencies may remain in architecture, package-manager, lockfile, or SBOM authorities.
- Treats same-repository folders, separate repositories, packages, registries, Git references, and submodules as implementation options selected by lifecycle, authority, release, access, reuse, and recovery needs. None is the universal inheritance model.
- Adds conditional Product Lifecycle criteria PL-17 and PL-18. PL-18 does not activate merely because an ordinary package or transitive dependency exists. They require reasoned `Not Applicable` results when Communication or managed-dependency capability is absent, without requiring empty artifacts, a new conformance profile, a manifest, or new Stable Context IDs.

Adoption impact: this is a breaking, capability-scoped change. Existing-baseline adoption is subject to [Migration Completeness](19_Maintenance.md#621-migration-completeness). Every Product Lifecycle conformance claim evaluates the new PL-17 and PL-18 criteria, but projects without external communication or managed project-specific dependencies may record reasoned non-applicability instead of creating artifacts. Ordinary or transitive implementation dependencies identify their existing architecture or dependency-management authority; dependencies requiring cross-consumer coordination within the adopting organization and materially risky dependencies are promoted to the full contract. Projects using either capability review the affected canonical artifacts, AI entry points, current publication or dependency records, verification obligations, and consumer impact.

Migration note (v0.14.0 → v0.15.0):

- `migration_required: true`
- `change_classification: breaking`
- Required for every existing-baseline update: perform the baseline-adoption assessment and satisfy Migration Completeness before activation. Initial adoption has no earlier baseline to migrate.
- Required for Product Lifecycle conformance: evaluate PL-17 and PL-18 for the claimed scope. Record a reason and scope for `Not Applicable`; absence of a folder alone is not the reason.
- Required when external communication is used: inventory current communication entry points, active claims, generated outputs, published artifacts or records, approval boundaries, measurements, and learning feedback. Add or update `80_Communication/01_Communication.md` only when the capability applies, and connect current records without rewriting closed publication history solely for format alignment.
- Required when context dependencies or managed artifact dependencies are used: inventory adopted sources and versions, local overrides, consumers, update procedures, verification impact, migration, recovery, and deferred risk. Ordinary and transitive implementation dependencies may use architecture, package-manager, lockfile, or SBOM records; promote them only when the adopting organization must coordinate meaning, contract, adopted version, or update decisions across independently managed consumers, or when they carry material risk. An upstream API contract, separate provider authority, or independent provider release alone does not trigger the full contract. If applicability cannot yet be determined, keep the evaluation pending rather than treating it as `Not Applicable` or fully contracted. Preserve the distinction between CRDD baseline adoption under Maintenance and project-specific dependency updates under Context Dependency.
- Conditional automation: dependency updates may run without a new Human decision only inside a pre-approved dependency set, version range, verification criteria, stop conditions, result-recording rule, and recovery method. Boundary escape, failed or unavailable verification, or material compatibility, security, privacy, license, or consumer impact returns to Human decision.
- Conditional: update AI entry points, workflows, templates, quality artifacts, or Change Traces only where current operations cannot preserve claim/evidence, projection/publication, learning, dependency, override, consumer, and update boundaries.
- Not required: create `80_Communication` for a repository that does not use the capability; split every campaign into a repository; adopt a submodule, package, CMS, design tool, or external QA system; create a new conformance profile, Stable Context ID, mandatory manifest, or fixed set of medium-specific files; rewrite closed historical publications or dependency decisions solely for formatting.
- Rollback / recovery: keep the currently active v0.14.0 baseline and procedures until Migration Completeness and Human activation are complete. When reverting a partial application, restore the v0.14.0 AI entry point and PL-01–PL-16 evaluation scope, preserve candidate publication and dependency records as history, and restore the previously active dependency versions or publication controls identified by the adopting project.
- Known risk if deferred: unsupported claims may remain disconnected from evidence, current generated output may be confused with what was published, market response may be promoted to a requirement without Human judgment, dependency versions or overrides may be ambiguous, and dependency updates may leave consumers or prior verification stale.
- Verification: run the full CRDD checker once for the fixed candidate, then independent agent-operation review, Document Audit, and Gap / Impact with conformance-impact review. Representative cases cover non-applicability, a lightweight single communication entry, detailed communication artifacts, publication history, market-learning feedback, same-repository and separate-repository dependencies, overrides, and dependency updates.
- Known limitation: the contracts cannot discover every external publication or implicit dependency, prove a claim true without adequate evidence, or infer legal, brand, privacy, security, and market causality judgments. Results depend on declared system boundaries, available evidence, reviewer capability, and Human authority.

<a id="changelog-v0140-en"></a>

### v0.14.0 — Convergent Remediation and Evidence Identity (2026-08-10)

This release strengthens convergence after a finding has been discovered. It preserves the meaning of the original finding, separates contract coverage from consumer coverage, distinguishes a verification oracle from evidence that each consumer actually used it, and makes Git the default identity source for fixed evidence. It does not add a mandatory remediation file, manifest, audit type, approval stage, profile, Stable Context ID, or external QA tool.

Compared with v0.13.0:

- Keeps an issued finding's identifier, target, rule, observed facts, root cause, and original expected state as history. A remediation item cannot silently replace the finding with another defect or with evidence acquisition.
- Records a correction or supersession separately when a finding was wrong or incomplete, including the correction reason, correct meaning, affected remediation and evidence, reevaluation scope, and crosswalk to the original finding.
- Separates the contract population—the state, input, branch, permission, failure, persistence, and other combinations that can change a result—from the consumer population that interprets, transforms, stores, renders, transmits, executes, or verifies that contract.
- Requires each contract target to connect to every applicable consumer's remediation, result, or reasoned non-applicability. A matching file count does not prove either population complete.
- Separates verification-oracle consistency, application to a reference harness or verifier, application to the product implementation, and execution results for individual consumers. A correct verification oracle or harness does not prove product behavior.
- Uses Git repository identity, object format, Commit OID, path set, expected gitlink OIDs, observed HEAD and Root Tree, per-path object identity when needed, index/worktree differences, and submodule state to distinguish declared, observed, and executed targets. A clean whole-repository target normally needs only its object format, Commit OID, matching observed HEAD, Root Tree OID, and confirmation that no result-affecting dirty or non-Git input exists.
- Uses Commit OIDs as the normal first choice. Per-path identity and additional manifests are limited to subsets, uncommitted changes, submodules, external inputs, or non-Git artifacts and must define a reproducible byte-level derivation when used. An observed target may stand for the execution target only when it is observed immediately before execution in the same run and remains unchanged until result generation finishes; otherwise the before and after identities are recorded separately.
- Separates semantic updates to a current record from record-only additions such as links, OIDs, timestamps, or reviewers. Record-only updates receive a terminal lightweight link, identity, and tamper check instead of recursively creating another audit target.
- Stops repeated local patching when the same root cause recurs across reviews, phases, or consumers, and returns to the shared authority, contract, generator, verification oracle, consumer map, or current-state projection.
- Aligns Document Audit, Gap / Impact Audit, Product Lifecycle criterion PL-16, Agentic Delivery criterion AD-21, official and distributed AI entry points, Overview, Terminology, and public guidance with these boundaries.

Adoption impact: this is a breaking, non-structural change. Existing-baseline adoption is subject to the [Migration Completeness](19_Maintenance.md#621-migration-completeness) bar. Projects that apply v0.13-style multi-location remediation or claim Agentic Delivery re-evaluate AD-21 and their finding/remediation procedure. Projects that use CRDD quality assurance re-evaluate PL-16, fixed-evidence target identity, current-record closure, contract/consumer coverage, and verification-oracle/consumer-result separation. Historical findings and evidence do not require blanket rewriting, but an active finding cannot be repurposed, and newly generated current evidence must follow the new identity boundary.

Migration note (v0.13.0 → v0.14.0):

- `migration_required: true`
- `change_classification: breaking`
- Required for every existing-baseline update: perform the baseline-adoption assessment and satisfy Migration Completeness before activation. Initial adoption has no earlier baseline to migrate.
- Required when AI applies findings or Agentic Delivery is claimed: review the AI entry point or equivalent procedure; preserve finding meaning, separate contract and consumer populations, keep remediation crosswalks, and switch repeated recurrence to structural remediation; re-evaluate AD-21.
- Required when CRDD quality assurance is used: review current fixed-evidence procedures and current records; use Git-centered declared/observed/execution target identity where applicable, separate the verification oracle and consumer execution evidence, and apply the terminal record-only check; re-evaluate PL-16.
- Conditional: update active remediation and evidence templates only when they cannot retain the new boundaries. Existing historical records remain historical and are not rewritten solely for format alignment.
- Not required: add a mandatory resolution-package file, custom manifest for normal clean Git commits, new audit, approval gate, profile, external test system, folder, Stable Context ID, or blanket rewrite of closed historical findings and evidence.
- Rollback / recovery: keep the currently active v0.13.0 baseline and procedures until Migration Completeness and Human activation are complete. When reverting a partial application, restore the v0.13.0 AI entry point and evidence procedure; retain records created by the v0.14.0 candidate as candidate history instead of deleting them.
- Known risk if deferred: finding meaning may be repurposed, affected consumers may remain unaccounted for, verification-oracle results may be mistaken for consumer execution evidence, declared and executed targets may be confused, and current-record verification may continue recursively.
- Verification: run the full CRDD checker once for the fixed candidate, then independent agent-operation review, Document Audit, and Gap / Impact with conformance-impact review. The checker supports deterministic structure only and does not decide finding meaning, population completeness, verification-oracle validity, or consumer behavior.
- Known limitation: these rules improve traceability and convergence but cannot discover an unknown consumer or prove an incorrect verification oracle correct. The result still depends on explicit system boundaries, reviewer capability, and available evidence.

<a id="changelog-v0130-en"></a>

### v0.13.0 — Complete Multi-location Remediation (2026-08-08)

This release standardizes how a parent agent applies an agreed remediation across every affected location before re-review. It closes the gap between a complete audit finding and an incomplete repair without adding another audit, approval gate, permanent remediation artifact, or Stable Context ID. Three auxiliary terms distinguish remediation progress, blocker state, and resolution verdict from existing status systems.

Compared with v0.12.0:

- Extends the existing remediation flow to cover every affected location. When one finding, root cause, or agreed plan affects multiple passages, relations, canonical artifacts, references, templates, AI entry points, guides, or examples, the parent agent identifies the target population before editing.
- Requires every identified target to be accounted for as repaired, verified unchanged, excluded with a reason, waiting for a Human decision, or unable to apply or verify with a reason and restart condition.
- Uses the reviewer's root cause, expected state, and horizontal-search scope as input. The remediation owner does not repeat the semantic audit; ambiguity, count mismatch, or scope expansion returns to the responsible reviewer or Human authority.
- Records counts only for a finite, traceable population and keeps the population basis and target-level dispositions available. A matching edit count or checker pass alone does not prove complete remediation.
- Separates remediation progress (`Identified`, `Planned`, `Applied`, `Self-checked`), blocker state (`None`, `Blocked`), and resolution verdict (`Open`, `Resolved`). The ambiguous value `fixed` is not used as remediation progress or a resolution verdict.
- Allows `Resolved` only when contract-level coverage, observable acceptance criteria, an evaluation method, fresh evidence for the same fixed revision, independent re-review, current-record propagation, and treatment of recurrence and newly found issues are available.
- Requires contract dimensions and combination constraints to be identified before reducing the population. Finite spaces enumerate all logical combinations; non-finite or impractically large spaces record the selection method, exclusions, unreviewed range, and limits. High-risk reductions receive independent review.
- Separates pre-freeze contracts and planned coverage from post-freeze execution evidence and current review or phase state. Fixed content is not rewritten to represent later current state or to self-reference its own hash.
- Strengthens fresh-evidence identity and reproducibility while allowing sensitive, large, or non-command evidence to retain a reasoned summary and re-identification path instead of mandatory stdout or stderr.
- Extends the optional checker to inspect recognizable remediation tables for invalid state values, premature `Resolved` verdicts, and incomplete blocker information. Alternative record formats remain valid and are reviewed semantically.
- Adds a pre-re-review self-check for stale wording, direct references, derived materials, unexpected differences, deterministic checks, and unresolved items.
- Keeps a lightweight path for one obvious local mechanical correction and reuses the existing Document Audit, Gap / Impact Audit, and Agentic Delivery criterion AD-21.

Adoption impact: this is a breaking, non-structural change. Existing-baseline adoption is subject to the [Migration Completeness](19_Maintenance.md#621-migration-completeness) bar. Projects that use AI to apply review or audit findings, or claim the Agentic Delivery Profile, must ensure that their parent-agent entry point or equivalent procedure enumerates multi-location remediation targets and reconciles each disposition before re-review. Projects that use CRDD quality assurance re-evaluate PL-16 for current or newly generated evidence and its generation procedure. Existing product artifacts, folders, Stable Context IDs, completed reviews, historical Change Traces, and inactive historical evidence do not require blanket rewriting.

Migration note (v0.12.0 → v0.13.0):

- `migration_required: true`
- `change_classification: breaking`
- Required for every existing-baseline update: perform the baseline-adoption assessment and satisfy the Migration Completeness bar before activation. Initial adoption has no earlier baseline to migrate.
- Required when AI applies review or audit findings, or when the Agentic Delivery Profile is claimed: review the AI entry point, prompt, agent definition, skill, or equivalent procedure; connect the contract-level target inventory, separated progress/blocker/resolution axes, `Resolved` evidence bar, and target-by-target reconciliation when no equivalent procedure exists; re-evaluate AD-21.
- Required when CRDD quality assurance is used: review the separation of fixed content from post-freeze current records and the identity and reproducibility information for current or newly generated evidence; re-evaluate PL-16. PL-01 is re-evaluated only when the project's own impact assessment finds that phase-to-quality connections also change.
- Conditional: update stored remediation-plan or review templates only when they cannot retain the population basis, concrete targets, dispositions, verification results, and unreviewed scope.
- Not required: add an audit type, approval stage, permanent remediation document, dedicated file, Stable Context ID, specialist for every repair, rewrite completed inactive work, or re-evaluate Core criteria solely because of this release.
- Candidate evidence: the [Change Trace](90_Release/Changes/CHG-000007_Multi_Location_Remediation.md) records a Human-provided adopter trial report for experiment baseline commit `cb510e6261fd44775d843c6e40fa7f737fb7a158`. The trial was partially effective: it exposed omissions and unreviewed scope but also found recurring root causes. Raw adopter records are not available in this repository, so the report supports reopening the candidate but does not by itself prove resolution or a quantitative improvement.
- Verification: deterministic checks and independent agent-operation, Document Audit, and Gap / Impact with conformance-impact review are rerun on the revised candidate before release.
- Known limitation: the rule can reduce early closure and application omissions but cannot prove that a reviewer discovered every relevant contract dimension. Its effectiveness still depends on available context, reviewer capability, evidence quality, and instruction-following.

<a id="changelog-v0120-en"></a>

### v0.12.0 — Pre-execution Alignment Check (2026-07-31)

This release adds a lightweight alignment check before the first edit of a non-trivial change. Its purpose is to catch missing canonical context, affected references, specialist viewpoints, terminology and migration concerns before they return as piecemeal findings during final review. It does not add a new audit, approval gate, permanent artifact, Stable Context ID or mandatory subagent.

Compared with v0.11.4:

- Requires the parent agent to decide whether the pre-execution alignment check is needed and, when it is, compare the proposed plan with the current canonical context before the first edit.
- Keeps the parent agent's lightweight review as the default. Read-only reviewers are used only when the parent cannot verify a necessary specialist viewpoint or the change can affect multiple canonical artifacts, phases, authorities, migration decisions or major risks.
- Requires all selected reviewer results and unreviewed scope to be consolidated into one plan before editing begins, except for defined stop, escalation and critical-containment actions.
- Distinguishes the defined results `着手可`, `計画修正` and `判断待ち・停止` from audit `Pass` or `Fail`, approval, risk acceptance and phase-gate states.
- Re-presents a revised plan only to affected reviewers when its confirmed scope, meaning, authority, dependencies, specialist conditions, classification, migration, risk or protected compatibility boundary changes. Mechanical application of an agreed fix does not trigger another planning loop.
- Maps the check to a renewed `AssessGap` activity after dialogue or read-only analysis has made the plan concrete; it does not add a new Skill state or lifecycle phase.
- Adds a locale-first wording check for changes to human-readable names, terminology boundaries and specialist explanations.
- Aligns the official and distributed AI entry points and updates Agentic Delivery criterion AD-02, while preserving final independent review, required audits and human decision authority.

Adoption impact: this is a normative, non-structural change. An adopting project updating an existing CRDD baseline to v0.12.0 is subject to the [Migration Completeness](19_Maintenance.md#621-migration-completeness) bar. It inventories the in-scope existing artifacts, adapters and operations, decides the disposition of each, completes every required action without leaving work waiting to start, and uses an independent review suited to the affected scope to confirm that meaning was not lost before activation. This also applies when no relevant AI operation exists or the project adopts with no action; in that case the inventory supports explicit retained or not-applicable dispositions rather than an unchecked exemption. Initial adoption has no earlier baseline to migrate, but still requires the baseline-adoption assessment and human activation decision. Existing product artifacts, folders, Stable Context IDs, completed phase results and historical Change Traces do not require blanket migration. Projects that use AI for non-trivial changes or claim the v0.12.0 Agentic Delivery Profile must additionally ensure that their AI entry point or equivalent operating procedure performs the same pre-edit decision and records either the applicable exemption or the completed alignment result.

Migration note (v0.11.4 → v0.12.0):

- `migration_required: true`
- `change_classification: normative`
- Required for every existing-baseline update: perform the baseline-adoption assessment and satisfy the Migration Completeness bar before activation. A no-action or no-relevant-AI result still requires an inventory, a disposition for every in-scope asset, completion of required actions, and an independent meaning-preservation review appropriate to the affected scope.
- Required when AI is used for non-trivial changes or the v0.12.0 Agentic Delivery Profile is claimed: review the AI entry points, prompts, agent definitions, skills or equivalent procedures. Add or connect the pre-execution alignment check when an equivalent parent-agent check is absent, and re-evaluate AD-02.
- Conditional: update stored work-plan or review templates only when they cannot record the check decision, an exemption and its reason, reviewed viewpoints, plan changes and unreviewed scope.
- Not required: add an audit type, approval gate, permanent planning document, specialist for every change, subagent, folder, Stable Context ID, or rewrite completed inactive work. Core and Product Lifecycle criteria are unchanged and do not require re-evaluation solely because of this release, unless the adopting project's own impact assessment finds another affected dependency.
- Verification: the full CRDD checker reports 0 errors and 0 warnings. Independent agent-operation review, Document Audit and Gap / Impact with conformance-impact review pass with no unresolved findings.
- Known limitation: the rule reduces preventable planning omissions but cannot guarantee that one review finds every defect. Its effectiveness still depends on available context, reviewer capability and model instruction-following.

<a id="changelog-v0114-en"></a>

### v0.11.4 — Gitlink Submodule Verification (2026-07-31)

This patch fixes false adopted-baseline errors caused by inferring submodule state from `.gitmodules` and a nested Git command without verifying the parent index gitlink. It does not change CRDD's baseline-adoption, folder, Stable Context ID, conformance, or migration rules.

Compared with v0.11.3:

- Reads parent-index stage data and recognizes normal stage-0 mode `160000` entries as Gitlink submodule boundaries; conflicted entries remain unverified.
- Reports the adopted `00_CRDD` baseline through separate states for `.gitmodules` declaration, indexed Gitlink and OID, worktree presence, Git-directory accessibility, readable HEAD and HEAD-to-Gitlink revision match.
- Verifies that Git commands executed at `00_CRDD` resolve to that worktree itself, rather than silently using the parent repository.
- Uses Git's own configuration parser for `.gitmodules` when available and compares filesystem paths with platform-correct case semantics.
- Treats unreadable `.gitmodules` data or malformed Git configuration output as unverified, rather than as proof that a declaration is missing.
- Distinguishes `baseline-gitlink-missing`, `baseline-submodule-not-initialized`, `baseline-submodule-unverified`, `baseline-submodule-revision-mismatch` and a missing `.gitmodules` declaration instead of collapsing them into one initialization error.
- Does not treat a nested Git repository or a `.gitmodules` entry alone as proof of a submodule.
- Does not report links into other uninitialized Gitlink boundaries as broken project links; it marks those targets as uninspected and requires direct checking from the initialized submodule root.
- In filesystem fallback mode, does not claim that a readable `.git` marker proves the parent-index Gitlink or HEAD revision.

Adoption impact: repositories using the supplied checker may replace it to obtain accurate Gitlink and baseline-revision diagnostics. Automation that branches on exact finding codes must recognize the separated diagnostics. JSON consumers should use `baseline_submodule_state` for details; the compatibility field `baseline_submodule_initialized` is `true` when the worktree, Git directory and HEAD are readable, `false` only when an indexed Gitlink has no worktree, and `null` when not applicable or unverified. No project artifact, ID, folder or CRDD conformance change is required.

Migration note (v0.11.3 → v0.11.4):

- `migration_required: false`
- `change_classification: clarification`
- Required: none.
- Conditional: update the optional checker where automated CRDD baseline or other submodule checks are used.
- Not required: move files, change submodule layout, renumber IDs, change conformance claims or alter baseline-activation decisions.
- Verification: 100 regression tests pass; the checker source has 100% line and branch coverage. Full CRDD checking reports 0 errors and 0 warnings.
- Known limitation: when Git index modes or submodule metadata cannot be read, the checker reports the baseline as unverified; it does not infer a verified state from filesystem markers.

<a id="changelog-v0113-en"></a>

### v0.11.3 — Hierarchical Checker Compatibility (2026-07-30)

This patch fixes false Change Trace placement errors when the optional checker runs against a repository-specific hierarchical layout. It does not change CRDD's canonical Change Trace placement, ID namespace, conformance criteria, or migration requirements.

Compared with v0.11.2:

- Retains recursive Markdown checking regardless of repository depth and adds regression coverage for deeply nested files.
- Recognizes `CHG-*.md` beneath a `Changes/` directory at any depth under `90_Release`, including repository-specific monorepo layouts, without a product registry or configuration file.
- Continues to reject Change Trace candidates named `CHG-*.md` outside a `Changes/` hierarchy, while excluding supporting files under `Evidence/` from that filename-only judgment.
- Does not misclassify supporting files under any `Evidence/` directory merely because their filenames or metadata contain a related `CHG-*`.
- Detects a standard Change Trace definition mistakenly placed under `Evidence/` when its canonical heading and declared Change ID are both present.
- Keeps Stable Context IDs globally unique and keeps the required basic repository folders unchanged.

Adoption impact: checker users may replace the previous checker and remove local false-positive workarounds. Projects that do not use the checker are unaffected.

Migration note (v0.11.2 → v0.11.3):

- `migration_required: false`
- `change_classification: clarification`
- Required: none.
- Conditional: repositories using the supplied checker may update it to remove the false placement findings.
- Not required: move files, renumber IDs, add configuration, change conformance claims, or change Stable Context IDs.
- Verification: 83 checker regression tests pass; the checker source has 1,537 / 1,537 covered lines and 291 / 291 covered branches. Full checks report 0 errors and 0 warnings for CRDD, and 0 errors for all 292 Markdown files in Qual Suite. Independent Document Audit and Gap / Impact Audit passed on the corrected revision. Conformance Audit was not selected because no conformance criterion changed; an independent conformance-impact recheck confirmed this boundary.
- Known limitation: accepting a path for mechanical inspection does not make that repository-specific layout a CRDD canonical placement or conformance decision.

<a id="changelog-v0112-en"></a>

### v0.11.2 — First-Pass Review and Audit Completeness (2026-07-29)

This patch strengthens the completeness of the first independent review or audit so existing problems are less likely to appear piecemeal across repeated remediation cycles. It does not remove re-review, weaken safety stops, or guarantee that one pass can discover every issue.

Compared with v0.11.1:

- Requires an independent reviewer or auditor to identify the applicable checks and complete one first-pass scan before finalizing findings, unless a safety, authority, access, or other defined stop condition requires immediate escalation.
- Separates candidate collection from finding confirmation. Reviewers collect candidates across the applicable checks, search horizontally for the same cause in related structures, references, templates, AI entry points, and parallel responsibilities, then consolidate duplicates and root causes before returning one report.
- Makes review coverage retrievable: applicable checks, reviewed and unreviewed scope, horizontal-search scope and result, and the population, selection method, and limitation of any sampling.
- Prevents one early major finding from silently leaving the remaining applicable checks unevaluated. Unreviewed scope remains explicit and cannot be treated as `Pass`.
- Requires the parent agent or remediation owner to confirm that all agreed remediations were applied and self-checked before submitting the updated revision for re-review.
- Classifies a new candidate found during re-review as caused by the remediation, newly observable after remediation, brought into scope by an approved scope expansion, or missed in the first review. A first-pass miss is not mislabeled as a remediation side effect.
- Keeps re-review focused on resolving existing findings, remediation side effects, affected relationships, and clear first-pass omissions rather than using every cycle to add unrelated improvements without limit.
- Adds Agentic Delivery criterion AD-21 and carries the same behavior through the official and distributed AI adapters. Document, Conformance, and Gap / Impact Audits connect their procedures and completion evidence to the common contract instead of creating new audit types.

Adoption impact: this is a normative, non-structural change. Existing product artifacts, folders, Stable Context IDs, and schemas do not require migration. Projects using CRDD review or audit agents should update their AI-facing instructions before claiming the v0.11.2 Agentic Delivery Profile.

Migration note (v0.11.1 → v0.11.2):

- `migration_required: true` for the Agentic Delivery Profile; no product-artifact or folder migration is required.
- `change_classification: normative`
- Required: update review and audit prompts, agent definitions, skills, or equivalent instructions so the first pass covers all applicable checks, records review coverage, performs bounded horizontal search, and classifies new re-review candidates.
- Conditional: update stored audit-report templates only when they cannot record reviewed scope, unreviewed scope, horizontal search, sampling limitations, or re-review classification.
- Not required: add an audit type, create a permanent report file, add an approval stage, rewrite completed inactive audit history, rename folders, or issue new Stable Context IDs.
- Verification: inventory the review and audit paths actually used by the adopting project under the baseline-adoption assessment, then run every path affected by this instruction update against a fixed revision. When several paths are used, give them the same fixed revision. Do not add an otherwise unused audit solely for this migration. Confirm each first-pass report identifies its applicable checks and coverage before remediation begins, then re-review the corrected revision where required and classify any new candidates.
- Known limitation: model capability, inaccessible evidence, and genuinely latent interactions can still require another cycle. The rule improves first-pass discipline without representing review coverage as a mathematical guarantee of defect absence.

<a id="changelog-v0111-en"></a>

### v0.11.1 — GitHub Anchor Checker Compatibility (2026-07-29)

This patch corrects the optional reference checker's GitHub Markdown heading-anchor validation. It does not change a CRDD rule, phase, artifact, folder, Stable Context ID, decision authority, audit, or conformance criterion.

Compared with v0.11.0:

- Removes full-width and non-ASCII punctuation from generated anchors while retaining Japanese and other Unicode letters, combining marks, and numbers.
- Preserves consecutive hyphens and leading or trailing hyphens produced by GitHub's anchor-generation order instead of collapsing or trimming them.
- Uses visible label text for the supported simple, non-nested forms of inline code, links, images, emphasis, and strikethrough before generating the anchor. This lightweight checker is not a complete GFM inline parser; HTML comments, nested link or image labels and destinations, and complex crossing or nested delimiters are outside its guaranteed parsing scope.
- Assigns duplicate-heading suffixes against all previously generated heading anchors. A sequence such as `Foo`, `Foo-1`, `Foo` therefore resolves to `foo`, `foo-1`, and `foo-2`.
- Adds regression cases for Japanese punctuation, consecutive spaces, leading emoji removal, formatted headings, and colliding duplicate suffixes.
- Keeps the checker standard-library-only and optional. A checker pass still does not replace semantic review or establish CRDD conformance.
- Reference-checker quality record — target revision: the v0.11.1 release candidate described by this entry; measurement target: `template/tools/crdd_check.mjs`; environment and command: Node.js v22.18.0 built-in V8 coverage on Windows, `node --test --experimental-test-coverage --test-reporter=lcov tools/crdd_check.test.mjs`.
- Result: 75 tests passed; line coverage was 1,475 / 1,475 (100%); branch coverage was 280 / 280 (100%). No checker source line or branch was removed from the coverage denominator.

Adoption impact: replace the distributed checker when GitHub-compatible Markdown anchor validation is used. No product artifact or repository migration is required.

Migration note (v0.11.0 → v0.11.1):

- `migration_required: false`
- `change_classification: clarification`
- Required: none for CRDD artifacts, folder layouts, Stable Context IDs, schemas, AI adapters, or conformance claims.
- Conditional: update `template/tools/crdd_check.mjs` or the adopted copy when the project relies on its Markdown anchor findings.
- Out of scope: product-scoped `90_Release/<product>/Changes/` placement and Change Trace ID namespacing are not introduced. The v0.10.0 migration from `07_Workflows` to `19_Workflows` remains unchanged.
- Verification: run the checker regression suite and a full repository check, then perform independent review, Document Audit, and Gap / Impact Audit for the fixed revision.

<a id="changelog-v0110-en"></a>

### v0.11.0 — Human Decision Presentation and Audit Finding Synthesis (2026-07-28)

This release strengthens the existing decision-support and audit-aggregation contracts. It does not add a phase, artifact, Stable Context ID, audit type, or competing source of truth.

Compared with v0.10.0:

- Makes the first Human-facing decision view lead with what must be decided, the AI recommendation, why the decision is needed now, what changes for users, business, product, delivery, cost, and risk, the recommendation's main drawback, and what remains if it is deferred or rejected.
- Keeps Change Trace references, audit names, finding IDs, target revisions, affected canonical artifacts, reopened phases, and re-audit details traceable without making them the center of the initial decision view.
- Prevents progressive disclosure from hiding material safety, security, privacy, legal, irreversibility, uncertainty, residual-risk, or authority-conflict information.
- Limits a simple Yes / No confirmation to genuinely binary decisions whose main drawback and rejection effect have already been explained. Conditional recommendations and independently selectable matters remain separate choices.
- Requires the parent agent to classify audit, review, and Change Trace outcomes into deterministic AI remediation, genuine Human decisions, and report-only information before asking a Human.
- Allows findings to be grouped into one Human decision only when they share the same root cause, decision authority, decision timing, and inseparable adoption outcome. The relationship from the decision back to every source finding and affected artifact remains traceable.
- Updates Agentic Delivery conformance criteria AD-17 and AD-20, the official and distributed AI adapters, and the public Human guide to carry the same behavior without duplicating the canonical contracts.
- Corrects the optional reference checker so the CRDD official repository may keep its own Change Traces under root `90_Release/Changes/` while still accepting distributed template Change Traces under `template/90_Release/Changes/`. Adopting repositories continue to use root `90_Release/Changes/`.
- Reference-checker quality record — target revision: the v0.11.0 release candidate described by this entry; measurement target: `template/tools/crdd_check.mjs`; environment and command: Node.js v22.18.0 built-in V8 coverage on Windows, `node --test --experimental-test-coverage --test-reporter=lcov tools/crdd_check.test.mjs`.
- Result: 69 tests passed; line coverage was 1,277 / 1,277 (100%); branch coverage was 201 / 201 (100%). Five consecutive measurements produced the same result. No source, line, or branch was removed from the coverage denominator.

Adoption impact: this is a normative, non-structural change. Existing product artifacts, folder layouts, Stable Context IDs, and schemas do not require bulk rewriting. Adopting projects must update their AI entry points, prompts, skills, or equivalent operating instructions so future Human decisions—especially those produced from CHG work, reviews, or integrated audits—use the new presentation and synthesis rules.

Migration note (v0.10.0 → v0.11.0):

- `migration_required: true`
- `change_classification: normative`
- Required: update AI-facing instructions that present Human decisions or forward review / audit findings; ensure deterministic remediation is not delegated to Humans, independently selectable decisions are not bundled, and CRDD execution details remain traceable behind the decision summary.
- Conditional: revise reusable prompt templates, agent definitions, skills, or workflow documents only where they currently expose findings one by one, lead with internal CRDD metadata, use unexplained technical choices, or reduce non-binary decisions to Yes / No.
- Not required: rename or move project folders, rewrite existing canonical product artifacts, issue new Stable Context IDs, introduce a new decision artifact, or re-run completed inactive audits solely because of this release.
- Verification: exercise representative Human decisions produced from a CHG, a standalone review, and an integrated audit; confirm the initial view is impact-first, the source findings remain traceable, material risks are not hidden, and AD-17 / AD-20 are re-evaluated before a v0.11.0 Agentic Delivery conformance claim.
- Known risk if deferred: front AI may continue exposing audit and repository-internal detail at the same granularity as Human choices, increasing cognitive load and encouraging uninformed, bundled, or unnecessary decisions.

<a id="changelog-v0100-en"></a>

### v0.10.0 — Pre-1.0 Structure, Human Guidance, and Deterministic Checks (2026-07-27)

**This release contains breaking changes.** It finalizes the pre-v1.0 placement of cross-phase quality artifacts and repository-specific workflows, makes AI route selection visible to humans, preserves all canonical terminology while adding reading classifications, and adds an optional deterministic checker. Migration is required for projects using the v0.9.0 template paths.

Compared with v0.9.0:

- Renames the fixed quality-assurance folder from `08_Quality` to `07_Quality`. The Quality Center, Quality Strategy, Verification Design, and immutable Verification Results keep the same responsibilities; the change places cross-phase quality before optional operational areas without treating quality as a post-implementation phase.
- Renames `07_Workflows` to `19_Workflows`. Repository-specific repeatable procedures remain separate from product context, Change Traces, Release Records, agents, and skills. Positions `08` through `18` are reserved for future cross-phase artifacts or shared operational areas and are not created by the standard template.
- Updates canonical documents, conformance criterion PL-16, phase templates, distributed AI adapters, examples, and current public guidance to use `07_Quality` and `19_Workflows`. Historical CHANGELOG entries retain the paths used by their releases.
- Keeps every canonical term and definition in `02_Terminology.md`. Adds reading classifications—core, supporting, and display/derived—to help people and AI choose a reading order without weakening, deleting, or turning supporting terms into informal aliases.
- Adds a human-readable change-route table to `00_Overview.md`. It connects common change types to affected phases, independent review, Document Audit, Conformance Audit, Gap / Impact Audit, baseline adoption, verification, and Human release authority without creating a new source of authority.
- Extends `10_Agent.md`, conformance criterion AD-02, and the root and distributed `AGENTS.md` entry points so AI shows the proposed change classification, affected or reopened phases and shared responsibilities, selected independent review and audits, major audits not selected and why, and remaining Human decisions.
- Adds a bilingual “What humans need to know” section to README. Humans can start with five responsibilities and a small input contract while AI selects canonical context, compares alternatives, maintains verification obligations, and returns an inspectable route.
- Adds the Node.js standard-library-only `template/tools/crdd_check.mjs` reference implementation, with no external package dependencies, so adopting projects receive the checker with the template. Full-repository checking is the default; explicit `--scope` checks retain repository-wide invariants, expand to direct Markdown references, and report unchecked areas. The checker uses Git's tracked and non-ignored untracked file set when available, reports exclusions and unperformed checks, rejects invalid targets and options, and does not read links outside the target repository. When `00_CRDD/` is an adopted-baseline submodule, it validates project links and anchors into that baseline without mixing all baseline internals into the project-owned file set, and reports the omitted internals as unchecked. Summary output records execution time and checked counts, reference-map output helps AI select semantic reading targets, and deterministic checks cover Stable Context IDs in filenames, duplicate explicit ID definitions, Change Trace placement, and branch-coverage numerator / denominator / percentage arithmetic where numeric values are present. Before independent review or an audit set, the parent AI runs it once for the fixed target revision and shares the result; reviewers repeat it only when the result is missing, stale, incomplete, or for a different scope. The root `tools/crdd_check.mjs` invokes the distributed implementation for CRDD-standard maintenance. A tool pass does not replace semantic review or any CRDD audit, and use of this implementation is not a conformance requirement.
- Prevents the checker from following symbolic links or junctions during discovery, link and anchor checking, scope selection, reference-map generation, canonical-document inspection, or structure inspection. Adds a real Git-submodule integration test and rejects an uninitialized `00_CRDD` submodule instead of reporting a successful project check.
- Does not add a phase, Stable Context ID type, mandatory tool, audit, approval stage, or canonical artifact. Folder numbers do not define a waterfall or authority priority.

Migration note (v0.9.0 → v0.10.0):

- Classification / migration required: `change_classification: breaking`, `migration_required: true`.
- Required: move `08_Quality/` to `07_Quality/`; move `07_Workflows/` to `19_Workflows/`; update project-owned references, AI adapters, workflow procedures, QA references, scripts, and external links; do not create standard folders for `08` through `18`; run link and anchor checks; review C-02 and PL-16, and AD-01 / AD-02 when the Agentic Delivery Profile applies, before recording a `Conformant` claim against v0.10.0.
- Conditional: update generated views, CI configuration, prompts, or external-tool paths only where they reference the old folders. Existing content and history inside the moved folders are retained; the move does not require rewriting QA meaning or workflow content.
- Out of scope: no new QA source of truth, workflow state model, Stable Context ID, mandatory Python runtime, third approval, or universal audit bundle is introduced.
- Verification: run `node tools/crdd_check.mjs` or equivalent deterministic checks, then Document Audit for current references, folders, versions, terminology classification, README, adapters, and templates; Gap / Impact Audit for adopter migration and cross-artifact path effects; Conformance Audit for the affected criteria when a v0.10.0 conformance claim is made.
  - Reference-checker quality record — target revision: the v0.10.0 release candidate described by this entry; measurement target: `template/tools/crdd_check.mjs`; environment and command: Node.js v22.18.0 built-in V8 coverage on Windows, `node --test --experimental-test-coverage --test-reporter=lcov tools/crdd_check.test.mjs`.
  - Result: 68 tests passed; line coverage was 1,274 / 1,274 (100%); branch coverage was 199 / 199 (100%). No source, line, or branch was removed from the coverage denominator.
  - Test design: ordinary fixtures cover supported repository modes and output paths. A test-only Node.js preload injects filesystem races, metadata failures, special filesystem objects, Git discovery failures, and unsafe Git file lists at the child-process boundary. Fallback discovery records the affected path as both an error and an unchecked area when a directory disappears, changes type, becomes a link, is replaced, or cannot be read; it does not convert an empty scan into success. The distributed checker does not import the injector and retains no test-only runtime switch or external package dependency.
  - Residual scope and reevaluation: 100% structural coverage does not prove semantic correctness or every operating-system implementation. Real Git-submodule and Windows-junction integration tests supplement the injected failures, and independent Document, Conformance, and Gap / Impact audits remain required before release. Rerun the full suite and coverage measurement after checker, Git-discovery, filesystem-boundary, output-contract, supported Node.js, or supported operating-system changes.
- Rollback / recovery: keep v0.9.0 active until both folders and all affected references are migrated and the Migration Completeness bar is met.
- Known risk if deferred: quality artifacts or workflow procedures may become undiscoverable, AI may write to obsolete paths, and a repository may claim v0.10.0 while still using the v0.9.0 structure.

---

<a id="changelog-v090-en"></a>

### v0.9.0 — Specialist Quality Review, Cross-phase Quality Assurance, and Stable Phase Entries (2026-07-27)

**This release contains breaking changes.** It adds specialist-quality review to phase transitions, introduces a cross-phase quality-assurance artifact model, and fixes the entry structure from Discovery through Architecture and Quality Assurance. Migration is required for adopting projects that use those phases, phase transitions, or the Product Lifecycle Profile.

Compared with v0.8.0:

- Adds Specialist Quality Review as a defined part of `agent.phase_transition.review`. It uses the coverage and audit checklist owned by the sending phase or applicable shared contract; it does not create a new phase, audit, approval stage, or source of truth.
- Keeps the two-stage transition model: an independent phase-transition review followed by the responsible Human decision. The specialist check belongs to the independent review, so this release does not add a third approval.
- Allows one independent reviewer to perform both contract and specialist checks when that reviewer can evaluate the required perspectives and explain the basis. Only missing perspectives are delegated to another subagent, a new session or agent that does not inherit the creation context, or a Human reviewer. CRDD does not require a fixed number of reviewers, a permanent specialist agent, a job title, a model, or a tool.
- Requires the review to make the required specialist perspectives, assigned reviewer, capability basis, criteria, consulted artifacts or evidence, result, and any unreviewed scope retrievable. Relevant knowledge or experience demonstrated by retrievable work, an evaluation method applied to the target, an authoritative reference applied competently, or comparable prior evaluation may establish the basis. A role label, agent name, model name, tool name, unsupported self-claim, or repetition of the checklist and target artifact does not.
- Prohibits a normal `Pass` while a required specialist perspective remains unreviewed. A Human authority may still direct transition through the existing `review_exception`, which remains distinct from `Pass` and must state the unreviewed scope, risk, owner, and re-review condition.
- Connects the rule to every phase contract from Discovery through Verification and to the shared UI / Behavior Specification contract. Each phase and the shared contract keep ownership of their own specialist criteria; no common checklist duplicates those criteria. The shared-contract review does not replace the UI or Behavior Specification phase reviews, and neither individual phase review replaces the shared-contract review.
- Updates the common skill handoff contract, official-repository adapters (`AGENTS.md`, `CLAUDE.md`, and `.github/copilot-instructions.md`), and distributed adapters (`template/AGENTS.md`, `template/CLAUDE.md`, and `template/.github/copilot-instructions.md`) so implementations carry specialist coverage in the existing review and handoff path.
- Extends conformance criteria PL-05, PL-06, AD-04, and AD-16. Document Audit verifies that specialist-review records are retrievable but does not decide domain quality. Gap / Impact Audit checks that required specialist responsibility did not disappear across a phase or shared-contract boundary but does not replace the specialist review.
- Adds `Specialist Quality Review`, `Quality Strategy`, `Verification Obligation`, `Verification Intent`, `Verification Design`, `Verification Item`, `Verification Procedure`, `Verification Result Summary`, `Current Quality Status`, and `Quality Center` to `02_Terminology.md`, with boundaries that keep conditions, reasons, methods, history, current state, and aggregate display separate.
- Adds `16_Quality_Assurance.md` as the common contract for Quality Strategy, phase-owned Verification Obligations, Verification Design, Verification Items, immutable Verification Results, Current Quality Status, and the human-readable Quality Center. Verification is not limited to test cases; expert review, measurement, analysis, usability evaluation, visual review, and accessibility audit can be Verification Items.
- Adds the fixed `08_Quality/Quality_Center.md`, `Quality_Strategy.md`, `Verification_Design.md`, and `Verification_Results/` structure. Application depth changes the amount of documentation, review, and evidence—not the file split. Obligations remain canonical in their owning phase artifacts, and retained evidence remains with the nearest owning artifact inside the repository; omitted raw outputs carry a repository-local summary and reproduction contract.
- Adds one fixed entry artifact for each phase from Discovery through Architecture: `01_Product_Discovery.md`, `01_User_Experience.md`, `01_Information_Architecture.md`, `01_User_Interface.md`, `01_Behavior_Specification.md`, and `01_Architecture.md` in their respective phase folders. Application depth changes content, review, evidence, and linked-detail depth rather than the entry name or basic split. The entry is the phase-wide canonical summary and discovery entry, not a links-only index: it directly retains scope, coverage, major conclusions and decisions, verification obligations, unresolved matters, and downstream obligations while referencing authoritative detail without duplicating it.
- Defines a tool-neutral logical record contract connecting strategy, phase-owned obligations, design, items, results, current status, and the Quality Center. The contract uses repository paths, anchors, commits, and artifact-local references. Artifact-local keys are used only when repeated cross-artifact or cross-result references would otherwise be unstable; v0.9.0 adds no `VO-*`, `VI-*`, `VR-*`, or other Stable Context ID type and mandates no YAML schema or central numbering registry.
- Keeps QA operable within the CRDD repository. CI, measurement, and test-execution tools may be used, but current quality status, rationale, unverified scope, residual risk, and reproduction methods remain understandable from repository artifacts. External links and run IDs are supplementary and do not become the sole QA record or an external QA source of truth.
- Sets branch coverage at `100%` as the default unit-test target where unit testing applies. A shortfall or exclusion must identify the measured scope, numerator, denominator, actual rate, concrete reason, residual risk, alternative verification, responsible owner, required Human decision, and reevaluation condition. A `100%` value does not by itself establish quality or release readiness.
- Requires Quality Center to show the current target, conclusion, user and operational impact, plan versus actual, numerator, denominator, percentages, variance reasons, unmapped obligations, required-but-unplanned specialist checks, high-risk failures, residual risk, and source references. Failed, blocked, and stale scope also shows its reason, impact, owner, and clearance or reverification condition. Percentages never decide quality or release authority by themselves.
- Separates Verification Item Results from Verification Obligation Assessment. Finalized results used for a decision, transition, or release are immutable; additional execution creates a new related result. Current Quality Status is derived and marks results that no longer apply as `Stale` without rewriting history.
- Adds Product Lifecycle criterion PL-16 and connects the model through every phase's responsibility coverage, transition criteria, and audit checklist, as well as Change, Progress, Release, Agent review, Document Audit, and Gap / Impact Audit.
- Does not change Stable Context ID types, phase order, or Human decision authority. QA artifact-local references and tool run IDs do not become CRDD Stable Context IDs.

Adoption impact: projects updating from v0.8.0 must update phase-review prompts, agent or skill definitions, and handoff records so future reviews include both contract and specialist coverage. Applied phases from Discovery through Architecture also add or map their fixed entry artifact without duplicating already authoritative detail. This applies to in-flight transitions, newly started transitions, and completed scope that is reopened, materially revised, or reused as input to a new transition. It does not require a bulk re-review of completed, inactive scope that will not be reused.

Migration note (v0.8.0 → v0.9.0):

- Classification / migration required: `change_classification: breaking`, `migration_required: true`.
- Required: update the existing phase-transition review path to identify the target scope's applicable specialist perspectives; assign reviewers able to evaluate them; record the capability basis, criteria, consulted artifacts or evidence, result, and unreviewed scope for each perspective; treat a perspective without a capability basis as unreviewed; remediate findings and re-review the updated revision before Human approval. UI / Behavior Specification scope also evaluates the shared contract separately from each phase. Add the fixed phase entry artifacts for every applied phase from Discovery through Architecture without duplicating their detailed canonical content. Add the fixed `08_Quality` structure, connect phase-owned obligations to Verification Design and skill handoffs, retain finalized Verification Results, and provide a Quality Center that exposes plan-versus-actual counts and percentages with their denominators and variance reasons. Where unit testing applies, set branch coverage to the default `100%` target and record the full exception contract for any shortfall or exclusion. Re-evaluate PL-01, PL-02, PL-05, PL-06, PL-16, AD-04, and AD-16 before recording a `Conformant` claim against v0.9.0.
- Conditional: use additional reviewers only where one independent reviewer cannot cover all applicable perspectives. Apply the new review contract to in-flight, future, reopened, materially revised, or reused phase scope. Closed, inactive scope needs no retroactive review unless it becomes input to a new decision or transition.
- Out of scope: no third approval, fixed team, permanent specialist agent, mandatory QA tool, new Stable Context ID type, or automatic release decision is introduced.
- Verification: run Document Audit for terminology, links, adapters, fixed phase entries, QA artifact boundaries, and retrievable review fields; Conformance Audit for PL-01, PL-02, PL-05, PL-06, PL-16, AD-04, and AD-16; and Gap / Impact Audit for propagation across all phase and shared contracts, phase-owned obligations, Verification Design, Current Quality Status, and Quality Center. Review representative transition and quality records to confirm that uncovered specialist scope, a missing capability basis, unmapped obligations, or required-but-unplanned specialist checks cannot produce a normal `Pass` or a misleading 100% quality claim.
- Rollback / recovery: keep v0.8.0 active until the review path and affected adapters are updated and the Migration Completeness bar is met.
- Known risk if deferred: a phase can continue to pass on contract completeness while domain-level errors, weak analysis, or unusable design decisions remain undetected until a later phase.

---

<a id="changelog-v080-en"></a>

### v0.8.0 — Open Work Registry and Progress Model (2026-07-26)

**This release contains breaking changes.** It redefines what `99_Roadmap` is for, replaces the single Roadmap status with two separate axes, and adds a registration duty for uncompleted work that reaches Discovery, Change, Verification, Maintenance, Document Audit, Conformance Audit, and Gap / Impact Audit. It also adds `15_Progress.md`, a new canonical document defining a development-method-independent progress model, and three new Product Lifecycle conformance criteria (PL-13, PL-14, and PL-15). Migration is required, not optional — see the migration note at the end of this section.

Compared with v0.7.0:

- Redefines `99_Roadmap` from a ledger of accepted-but-deferred work into an Open Work Registry (未完了作業の登録簿): a cross-cutting index of the uncompleted value, problems, requests, ideas, change candidates, and corrective items that remain in the product. `21_Discovery.md` §6 is rewritten around this — §6.1 (responsibility boundary and the registry's position), §6.2 (what the registry covers and when registration is required), §6.3 (Decision State and Work State), §6.4 (Roadmap Item recording contract), §6.5 (routes and transition rules), §6.6 (state transitions and activation), §6.7 (purpose-specific projections), and §6.8 (removal of completed items and closure). The registry is an index, not a second source of truth: an item's meaning, evidence, rationale, and settled results stay in the owning Canonical Artifact, and §6.1 carries a source-of-truth table making that split explicit.
- Separates existence from approval. §6.1 states that an item being in the registry does not mean the work is approved, that approved work is not necessarily in the current scope, and that in-scope work is not necessarily started. Registration alone cannot establish requirement adoption, settled priority, activation, a committed date, or risk acceptance.
- Splits the single Roadmap status into two axes (`21_Discovery.md` §6.3, with `02_Terminology.md` entries §2.30 and §2.31). Decision State — `Unreviewed` / `Exploring` / `Held` / `Adopted` / `Rejected` / `Superseded` — is a copy of the human decision Discovery owns, and updating the registry does not settle adoption. Work State — `Unscheduled` / `Ready for Review` / `Planned` / `In Progress` / `Completed` / `Cancelled` — carries progress. The former single set (`Deferred`, `Ready for Start Review`, `Started`, `Completed`, `Cancelled`) maps one-to-one onto the new pair; the mapping is given in the migration note.
- Keeps blocking out of the Work State values. Dependency, a pending decision, missing information, or missing access is recorded as a Blocker (停止要因) with its reason and release condition instead of replacing the Work State, and §6.3 states explicitly that this is a different concept from an audit result of `Blocked`, which means the audit could not be completed. This avoids a collision with the audit state `51_Document_Audit.md` §3.1 already defines and `10_Agent.md` §7.5 already consumes.
- Adds a registration duty with a stated firing condition (`21_Discovery.md` §6.2): an item is registered when its work is not complete, whether or not it is expected to close within the current scope. Registration does not mean transcribing an item into the registry by hand: it means the item is in the registry's target set and can be searched and aggregated from the Main View or a projection, whether by a reference row, generation from a Change Trace index, projection from an external tracker, or dynamic aggregation. CRDD does not prescribe the mechanism. Completed work, and work whose result is traceable from a closed Change Trace and the owning Canonical Artifact, is not registered retroactively, and no bulk import of historical items is required. The categories the registry covers are enumerated — ideas, future concepts, customer requests and user feedback, problems, requirement candidates, deferred adopted requirements, improvements, defects, technical debt, refactoring candidates, migrations, security / privacy / legal corrections, operational problems, unresolved audit findings, verification leftovers, follow-up work split out of a Change Trace, in-flight Change Traces, investigations, and open questions — with a per-category table naming the source of truth and what the registry holds for it.
- Indexes Optional Candidate Holding rather than absorbing it. `21_Discovery.md` §2.4 keeps the holding's format and location unfixed, and keeps `03_Documentation.md` §3.3's existing "no dedicated folder, no per-candidate file, no fixed status model, no central register" position for the holding itself, while requiring that a candidate one has decided to hold be discoverable from the registry. The content, evidence, and rationale stay on the `01_Discovery` side; the registry holds existence, Decision State, and reference. Adoption, rejection, and priority are not decided in the registry.
- Keeps in-flight Change Traces from being double-booked. `12_Change.md` now requires a reference row in the registry when a Change Trace is created, with the Work State set to `In Progress`, and states that the registry holds the reference only — the trigger, impact, implementation, and verification are not copied, and `90_Release/Changes/` remains the source of truth. The pre-existing route for a clear defect fixed in the current scope is unchanged: it still goes straight to a Change Trace without a new requirement, and the registry carries the reference row rather than a copy of the defect.
- Strengthens the rule that unfinished work must not survive only as prose. `12_Change.md` now states that where work remains incomplete when a Change Trace is closed, it is connected to another registry item or another Change Trace and actually registered, and that a Change must not be closed with the unfinished work left only in the Change Trace body or in an audit result. Matching duties are added to `51_Document_Audit.md` §7.1 (findings not resolved in the target revision), `53_Gap_Impact_Audit.md` §9.4 (the same, for gap / impact findings), `29_Verification.md` §2.10 (unmet conditions, known limitations, remaining defects, next-release candidates), and `19_Maintenance.md` §6.2.1 (assets still awaiting execution and unfinished items from a partial activation). In every case the audit or phase names the destination and the decision authority it needs; it does not settle adoption, priority, activation, or risk acceptance itself.
- Treats purpose-specific roadmap displays as projections (`21_Discovery.md` §6.7), reusing the `Projection` term v0.7.0 introduced. The registry has one source of truth and views over it are filters, not separate authorities; a projection does not add, remove, or change the state of an item. CRDD does not require any particular set of projections, names, tooling, or generation method.
- Adds removal conditions for completed items (`21_Discovery.md` §6.8): the applicable Change Trace is complete or release-dispositioned, settled results are reflected in the owning Canonical Artifacts, required verification is complete, the release or non-release disposition is settled, residual risk is recorded, unfinished work is connected to another registry item or Change Trace, and the final result is traceable. The four-step completion procedure and the detail-file deletion rule from v0.7.0's §6.4 are preserved. Items that end without ever reaching a Change Trace — rejected, duplicate, merged into another item, premise lost, value lost, ruled out of scope, invalid input — are removed from the Main View while keeping a closure reason and decision reference, with the closure reason's source of truth staying in the owning Discovery artifact or decision record. Establishes the removal conditions for completed items as conditions common to all registry items (`21_Discovery.md` §6.8). The conditions are not skipped on account of an item's origin, whether a Decision State applies, or whether and when a Change Trace exists. The preceding paragraph's treatment of items whose existence derives from a Change Trace is unchanged, so where a reference row is maintained by generation or dynamic aggregation, no per-item manual work is required. Where a condition does not apply to the item at hand, the reason it does not apply must be retrievable. Removal from the Main View is not deletion of the record: after removal, the closing outcome, the applied Change Trace, the release disposition, the reasoned closure, the merge target or successor item, and any reevaluation condition must remain traceable from the owning Canonical Artifact or Change Trace.
- Adds three Terminology entries (`02_Terminology.md`): `Open Work Registry` (§2.29), `Decision State` (§2.30), and `Work State` (§2.31), each delegating its obligations to `21_Discovery.md` per §2's delegation rule rather than restating MUST and MUST NOT. The same document's §5 boundary table gains rows for all three, and its existing `Plan` row is corrected — a Roadmap Item is now an uncompleted item in the registry, not "accepted deferred work."
- Rewrites `52_Conformance_Audit.md` PL-11 for the registry (a single registry across all uncompleted work, the two separated state axes, index-not-copy) and adds PL-13, which requires uncompleted work to be discoverable and aggregatable from the registry whether or not it is expected to close within the current scope, and forbids closing it with the item left only in an artifact body, a handoff view, a Change Trace body, a pull request, a code note, a release record, or an audit result. An item that a human decision authority closed with a reason under the follow-up-tracking invariant is not non-conformant merely because it is absent from the registry. PL-13 is added to the Product Lifecycle Profile; the resulting value of both claim rows for this release is stated with PL-15 below. Changes the registry's required fields from a single requirement keyed on the state value to a graded requirement based on Decision State and item type (`21_Discovery.md` §6.3, the phase transition criteria, the phase audit checklist, and `52_Conformance_Audit.md` PL-11). An item whose Decision State is `Unreviewed` may hold only the minimum that has been established. Items at `Exploring`, `Held`, or `Adopted`, and execution or reference items that need follow-up, must make their owner and reevaluation trigger retrievable. The reason is that §6 simultaneously allows an item to keep an undetermined owner, tells projects to hold an early idea with minimal information, and states that not everything is required from the earliest stage, while §6.6 registers every new item as `Unreviewed` / `Unscheduled` — so registering a single unevaluated idea could make a project non-conformant against PL-11. PL-11 is now judged by whether a judgment or execution responsibility has arisen, not by the Work State being `Unscheduled`, and both its claim column and its required-evidence column carry the same condition. Both columns accept either an information-source context or a reference to the owning Canonical Artifact. This is a relaxation and is a reevaluation trigger for projects that already evaluated PL-11 against v0.7.0. `Start condition` is dropped from PL-11's required fields in this release; PL-11 in v0.7.0 required an information-source context, an owner, a start condition, and a reevaluation trigger of every item unconditionally. What became stricter is the widened registry scope, the separation of the two state axes, the reproducible retrieval procedure, and not duplicating the index. A project that already evaluated PL-11 against v0.7.0 reevaluates it in both directions.
- Updates the surrounding surfaces so no adjacent summary keeps the old definition: `03_Documentation.md` §3.1's folder table and §3.3, `00_Overview.md`'s folder table, route table, intake flow diagram, and the prose under it, `README.md` in both languages, `template/AGENTS.md`, and the starter `template/99_Roadmap/01_Product_Roadmap.md` Project view, which now carries both state axes, the Blocker field, a projection section, and closure-reason and holding-reason fields.
- Does not introduce a standard `RM-*` key, a new file name, or an `Archive/` folder. A project-local reference key remains allowed and remains an artifact reference rather than a Stable Context ID, matching the position `21_Discovery.md` §2.4 already takes on `CAND-*`. `99_Roadmap/01_Product_Roadmap.md` stays the Main View, and closure reasons for items that never reach a Change Trace stay in Discovery's `Decision / Rationale` rather than in a parallel archive.
- Anchors: `#63-roadmap-item-contract` is preserved at the Roadmap Item recording contract even though it is now §6.4, so external links to it keep resolving. All four in-repository references it previously had were retargeted in this release: `12_Change.md`, `52_Conformance_Audit.md`, and `53_Gap_Impact_Audit.md` now point at `#64-roadmap-item-contract`, and `03_Documentation.md` now points at `#62-registry-scope-and-registration` because its sentence moved to §6.2. No in-repository reference uses `#63-roadmap-item-contract`, and a `#64-roadmap-item-contract` anchor is added alongside it. The new sections carry explicit anchors (`#62-registry-scope-and-registration`, `#63-decision-state-and-work-state`, `#65-transition-rules`, `#66-roadmap-state-transitions`, `#67-registry-projections`, `#68-closure-and-removal`). The generated Japanese anchors of the former §6.1–§6.4 headings move because those sections were renamed or renumbered; no in-repository link used them, but external links to them need updating. No anchor was removed.
- Adds `15_Progress.md`, a new canonical document defining a development-method-independent progress model. CRDD does not require a particular development method: a sequential, risk-driven iterative, timeboxed iterative, continuous-flow, or maintenance operation all need broadly the same responsibilities to make one feature, change, defect, investigation, or corrective item hold. Rather than defining one progress model per method, the standard defines one common minimum unit with one common set of progress information, and expresses method differences as how scope is cut, how time is cut, the purpose of iteration, the degree of parallelism, the aggregation unit, and method-specific auxiliary information. Progress information is derived from the existing sources of truth; it does not replace requirements, decisions, design, or verification results.
- Defines the Lifecycle Slice (ライフサイクル単位) as the minimum object of progress management: one value, change, feature, defect, investigation, or corrective item, together with the CRDD responsibilities that apply to it. It does not imply passing through the phases in series, applicable responsibilities and completion conditions are chosen per object, and no new CRDD identifier class is issued — a slice is identified by whatever already identifies it (a registry reference key, `CHG-*`, a Stable Context ID, or an external issue key). Not every slice has a Change Trace: investigations, UX validation, and documentation-only work may have no Change Trace and no Release, and the existence of a Change Trace is not a condition for tracking a slice.
- Defines the Progress Core (進捗中核): the information every Lifecycle Slice carries regardless of method — identification and type, scope, dates, Work State, Blocker, Readiness, Responsibility Progress, evidence, pending decisions and approvals, and dependencies. Method-specific auxiliary information is added to this common core; no separate core is created per method.
- Gives the Lifecycle Slice a coarse cross-cutting Work State of seven values — `Unscheduled` / `Planned` / `Committed` / `In Progress` / `Paused` / `Completed` / `Cancelled` — that aggregates across objects and does **not** replace the registry's Work State, a Change Trace's state, or a phase's coverage state. `Committed` is not the same as `In Progress`: deciding to admit work into a scope baseline and starting the actual work are separate decisions. `Paused` is not the same as a Blocker: `Paused` is an intentional human stop, a Blocker is an external obstruction. Advancing the state, in particular to `Committed` and `Completed`, is confirmed by the human decision authority.
- Keeps blocking, readiness, current responsibility, and review/verification activity off the state axis (`15_Progress.md` §3.3). A Blocker is an attribute that can overlap any Work State; Readiness is derived from the applicable next phase's entry contract; the current responsibility and activities such as reviewing and verifying are derived from Responsibility Progress. This is what keeps states like "in progress and blocked" or "committed but not ready" expressible instead of forcing a single mutually exclusive value. The human decision authority responsible for the Work State of the affected registry item or Lifecycle Slice confirms recording and clearing a Blocker. AI may propose candidates, draft records, and update evidence, but does not settle the Blocker or its clearance.
- Derives Responsibility Progress from the coverage states the phase documents already define (`Complete for Scope`, `Partial — Human Authorized`, `Blocked`, `Not Started`, `Not Applicable`) rather than introducing a new status vocabulary; `Not Applicable` responsibilities are excluded from the denominator. The Release responsibility is derived from `13_Release.md`'s release readiness and release decision.
- Layers how progress is expressed (`15_Progress.md` §4). The source of truth is each item's Work State, scope, dates, and evidence. The primary aggregation is the state distribution, which requires only counting. The basic derived indicator is a simple progress rate over applicable items with no weighting. Weighted progress rates, cross-phase phase progress, and forecast dates are advanced derived indicators that need additional input or assumptions; they are not required, weights are considered only when a human specifies them, and CRDD requires no particular weighting scheme, estimation technique, or forecasting model. Where they are used, the authority that specified the weights or assumptions, their content and scope, the calculation rule, and the calculation time with the evidence consulted must be retrievable. Registers `Progress Indicator` in `02_Terminology.md` as the umbrella term for state distributions, rates, advanced derived indicators, and forecasts, while leaving its detailed contract in `15_Progress.md`.
- Bounds what AI may settle (`15_Progress.md` §4.4). AI may compute the state distribution and the simple progress rate from evidence and report gaps, contradictions, and staleness, but does not itself settle state advancement — in particular `Committed` and `Completed` — a responsibility being `Not Applicable`, weighting or forecasting assumptions, a judgment that completion conditions are met, or a committed date. Where evidence is missing, the gap and where to confirm it are reported instead of an estimate.
- Separates progress from Health (健全性), and requires both to be shown side by side rather than folded into one number. Health is judged from blockers, pending decisions and approvals, undetermined scope, missing evidence, incomplete reviews or audits, incomplete verification, unresolved critical findings or defects, dependency delay, missed dates, and staleness of the progress information itself. The default display is `Healthy` / `At Risk` / `Impaired` / `Unknown`, projects may rename it, and the signals used plus the confirming authority must be retrievable.
- Maps the coarse Work State onto the existing state models (`15_Progress.md` §6) instead of replacing them, with tables for the Open Work Registry's Work State and for the Change Trace states in `12_Change.md` §5. `Committed` and `Paused` have no registry counterpart — admitting work into a scope baseline and intentionally pausing are progress-side distinctions. The registry's Work State value for started work is renamed within this release from `Started` to `In Progress` so one concept is not named differently at two granularities; `In Progress` is already a shared status value in `02_Terminology.md` §4.2, whereas `Started` was not. A high simple progress rate is explicitly not a basis for meeting a phase-gate criterion.
- Treats every aggregation unit — Change Trace, feature, defect, responsibility/phase, iteration or timebox, release, milestone, project, portfolio — as a projection over the same input (`15_Progress.md` §7), reusing the `Projection` term. The calculation rule does not change per aggregation unit; only the target set and filter change, and the aggregation side does not alter a slice's state, applicable responsibilities, or evidence.
- Adds UI / Behavior Specification pair readiness (`15_Progress.md` §8). Because UI and Behavior Specification are parallel responsibilities, a high Responsibility Progress on one side does not mean the pair holds. Pair readiness is derived from the items where both sides hold against `24_UI_Behavior_Specification.md`'s required pairing coverage, and must not be substituted with the average of the two sides' progress. `24_UI_Behavior_Specification.md` §2.4 carries the matching pointer.
- Defines an Execution Method Mapping contract (`15_Progress.md` §9) instead of naming execution profiles. CRDD does not define or redefine the vocabulary, roles, ceremonies, or rules of any external development method or framework. Adopting a method requires only that five correspondences be retrievable: which set of Lifecycle Slices the method's execution unit corresponds to, which CRDD completion conditions / phase-gate criteria / verification results the method's goals and completion conditions correspond to, which common Work State the method's states correspond to, where the method-specific auxiliary information lives and which Canonical Artifacts it references, and by what rule scope is selected from the Open Work Registry. The human decision authority responsible for the working method in scope confirms adopting or changing it. AI may propose and check the five correspondences, but does not settle adoption or change. Making the correspondences retrievable does not itself prove method adoption, work completion, phase transition, verification, or human judgment. A method-specific definition of done does not substitute for the applicable verification and human decision.
- Adds four Terminology entries (`02_Terminology.md`): `Lifecycle Slice` (§2.32), `Progress Core` (§2.33), `Health` (§2.34), and `Progress Indicator` (§2.35), each delegating its detailed obligations to `15_Progress.md`. The `Work State` entry (§2.31) is widened to cover both granularities and now names both authorities. `02_Terminology.md` §4.2 gains four shared status values (`Unscheduled`, `Planned`, `Committed`, `Paused`) and two entries in its do-not-confuse list (`Committed ≠ In Progress`, `Paused ≠ Blocked`), and its §5 boundary table gains rows for `Lifecycle Slice`, `Progress Core`, `Health`, `Progress Indicator`, and `Execution Method` — the last of which separates a development method from `52_Conformance_Audit.md`'s conformance profiles, which are a criteria set and a different concept. Three further §5 boundary rows are added for terms that already had entries or were used without a boundary row: `Locale and Display Name`, `Triggered Propagation Check`, and `Skill`. A fourth row registers `Blocker`, a term this release introduces, completing the §5 registration its own closing rule requires. These are clarifications or the mechanical completion of additions recorded above; no existing canonical term is renamed.
- Adds `52_Conformance_Audit.md` PL-14, which applies where a project reports progress based on CRDD responsibilities. Where it does not, the criterion result is `Not Applicable` under §3 with both the reason and affected scope. PL-14 requires the progress unit, applicable responsibilities, Work State, and evidence to be retrievable; progress and Health to be shown separately; and an advanced indicator to carry the authority that specified its weights or assumptions, their content and applicable scope, the calculation rule, and the calculation time with the evidence consulted. AI must not settle progress or forecasts, or mark an applicable responsibility or progress item `Not Applicable`, without human confirmation. Adds PL-15 as an unconditional criterion that forbids using a progress indicator as a basis for phase transition, verification completion, release eligibility, risk acceptance, or human approval, whether or not the project reports progress based on CRDD responsibilities. The prohibition applies to using an indicator as a basis at all and is not relaxed into a prohibition on sole-basis use. Its source of truth is `15_Progress.md` §1; §6.3 applies it to phase transition and §10 to all five targets. PL-15 carries all five in both its criteria and required-evidence columns, so evaluation also inspects risk-acceptance and human-approval records. `13_Release.md` §6 and `29_Verification.md` §2.10 point to the same rule for the judgments they own. Separating PL-15 prevents a project that records PL-14 as `Not Applicable` from becoming exempt from the prohibition. Both Product Lifecycle claim rows move to `PL-01〜PL-15`.
- Adds no new permanent folder and no new identifier class for progress. Progress information is retrievable from the Open Work Registry, Change Traces, phase Canonical Artifacts, verification and release records, or an external issue / progress tool; where an external tool is used, its location, target, target time, access method, and the route back to the Canonical Artifacts must be traceable.
- Adds a sweep responsibility for the registry as a whole, alongside relaxing the requirements on early items (`21_Discovery.md` §6.3). The project's Roadmap decision authority reviews `Unreviewed` items on the declared sweep trigger and either connects an item to existing work that covers the same subject or moves it to one of the Decision States. An individual early item may leave its owner unset, but the authority that sweeps the registry as a whole must not be left unset. No clock scheduler and no interval is required; this reuses the §6.6 framing of reevaluating on a declared trigger. This is an added obligation and can produce new non-conformance.
- Applies the new follow-up-tracking invariant to the product development that `01_Principles.md` governs. For the maintenance of the CRDD standard itself, the invariant is not copied into the maintenance canon; remainders are connected through what `AGENTS.md` and `19_Maintenance.md` already provide — issue intake, the change lifecycle, disposition with an owner and a reason, and the return of residual risk and follow-up work. For reasoned closure, the accepted impact, whether reevaluation is needed, and the boundary that AI does not settle the no-follow-up judgment itself are operated by reference to `01_Principles.md` §6.2 rather than copied. If that reference relationship is observed not to hold in practice, adding it to the maintenance canon is evaluated as a separate change. The three entry files of the official repository (`.github/copilot-instructions.md`, `AGENTS.md`, `.github/pull_request_template.md`) are brought into line in this release so that reporting a remainder is not mistaken for completing the maintenance work. An entry file is not a source of truth but an adapter that connects one to execution, so this is not a normative addition to the maintenance canon. The boundary is not an exemption from tracking but an arrangement that achieves the same result through a different canonical contract; adopting projects do not cite the CRDD standard repository's own operation as evidence for PL-13.
- Consolidates the conditions for using `Not Applicable` in `52_Conformance_Audit.md` into §3. It may be used only where the criterion's declared applicability condition is not met, or where the artifact, phase, or capability it governs does not exist in scope, and the reason and the scope must be retrievable. The restriction to profile criteria is kept in both the first sentence of §3 and the `Eligible` row of §7, and `Not Applicable` on a core criterion remains prohibited by the third sentence of §3 and by the `Not Eligible` row. The undefined term `conditional criterion` is removed from the `Not Eligible` row, which now names as a disqualifier any required criterion recorded as `Not Applicable` while its declared applicability condition is met and the artifact, phase, or capability it governs exists in scope. This closes a discrepancy where a claim marking PL-05 `Not Applicable` on scope grounds in a UI-less scope was permitted by §3 yet read as disqualified by §7. All four places that state the recording requirement for `Not Applicable` (§3, §11, §12, §13) now carry both the reason and the scope, and §12 gains `not_applicable_reason` in `criteria_results`. A project with existing `Not Applicable` judgments adds the scope and re-judges eligibility against the §3 and §7 changes. Change classification: `normative`.
- Adds criteria to `02_Terminology.md` §5 for deciding whether a name is a canonical term or a rule name. The wording previously left this to the discretion of whoever introduced the name, and two precedents coexisted: `Triggered Propagation Check` is registered while `Migration Completeness`, structurally the same, is not. Five conditions for registering as a canonical term and four for treating a name as a rule name are stated, each as an any-of set, with a priority rule: a name meeting both sets is treated as a rule name unless it carries its own schema keys, its own state-value set, or appears as a judgment condition in the criteria column of a conformance criterion. A canonical term is registered either by a §2 or §3 entry, or by a qualified first-column row in the §5 boundary table. Such a row must carry the local display name and canonical English name, state a boundary rule that changes how it is distinguished from another concept, and directly reference the canonical source or provide equivalent definition, authority, and scope information inline; a related expression alone is not registration. **These conditions apply to names newly introduced from v0.8.0 onward, or whose meaning, responsibility, or scope of application changes; they are not applied retroactively to names that already exist, and no existing name is reclassified.** The human decision authority for CRDD maintenance approved this non-retroactive policy and the closure of the item without reclassifying existing names. The reasons are that retroactive application would require reclassifying every existing name beyond the pre-fixed scope of this change; that reclassifying only the names an audit happened to surface would be partial application with no selection criterion; and that keeping existing usage while applying one consistent basis from the point of introduction or meaning change balances compatibility against maintainability. The accepted impact is that existing names remain which would fall on the canonical-term side under retroactive application; their current usage, authority, state, and conformance results are unchanged and this is accepted. No bulk reclassification is needed and no reevaluation condition is set. Where the meaning, responsibility, or scope of an existing name changes in future, these conditions are applied as part of that work. The measured name distribution and per-name classification examples retained with the audit evidence show that the criteria distinguish names of differing structure; they are not a work list for later reclassification, and no entry creates follow-up work.
- Generalises the definition of Projection in `02_Terminology.md` §2.25 from an IA-specific one to a cross-cutting concept: each of the representation forms produced by selecting, transforming, aggregating, or re-expressing the same entity, Canonical Artifact, or set of them for a particular purpose of use, with the explicit statement that a Projection does not replace the property authority of what it references. Authority is not fixed to one owner: the meaning of the source information belongs to its own canonical authority, the composition and purpose of a Projection to the property authority of the Canonical Artifact or approved rule that defines them, and the object-boundary judgment in IA to IA. The IA-specific MUST and MUST NOT, and the first sentence of the body paragraph, carry an explicit scope marker, while the general MUST (naming what the Projection is of) and the compound-term exclusion stay unqualified. No traceability MUST is added: aggregation drops information by definition, so adding one would immediately put the aggregation in `15_Progress.md` §7 and the purpose-specific projections in `21_Discovery.md` §6.7 in breach. This resolves the earlier inconsistency in which the registry's projections and the progress aggregation read as though they required IA's authority, and it justifies PL-11 and PL-13 listing reference rows, generation, projection, and dynamic aggregation side by side. The `Purpose` field also gains one general sentence ahead of the existing text, and `Related terms` gains the Open Work Registry and the Lifecycle Slice.
- Places the detection point for the registry-wide sweep responsibility in the Discovery phase audit checklist and does not add it to `52_Conformance_Audit.md` PL-11, because putting a relaxation and a tightening on the same criterion in one release would double the reevaluation load on projects that have already adopted it. The accepted impact is that a project claiming `CRDD Product Lifecycle Profile Conformant` without running the Discovery phase audit never encounters this obligation; the reevaluation trigger is the next revision of PL-11. The edit-planning discipline added to `19_Maintenance.md` §3.1 is scoped to the maintenance of the CRDD standard itself and is deliberately not applied to adopting projects. Within the condition added to `21_Discovery.md` §6.3 for what counts as an execution or reference item needing follow-up, the part requiring the executing basis to track an owner and a completion condition is an added norm, not a clarification.
- Clarifies or adds three maintenance rules. First, the four elements in `19_Maintenance.md` §2.2 (an independent decision authority, state transitions, approver, and users for the item) are clarified as the aspects to check when judging whether a new document is needed, not a conjunctive requirement that all must hold. Where an aspect does not hold, its reason and the grounds on which the remaining aspects establish the need must be retrievable. This is what lets the creation of `15_Progress.md` stand as an exception without relying on the independence of its approver. Second, a boundary is added to the registration rule in `02_Terminology.md` §5: writing a rule name, section name, or contract name in the `Japanese (English)` form does not constitute introducing a canonical term. Two precedents had coexisted — `Triggered Propagation Check` is registered while `Migration Completeness`, structurally the same, is not. `Unresolved Follow-up Tracking` is therefore treated as a rule name and requires no terminology registration. Third, a discipline for edit planning is added to `19_Maintenance.md` §3.1: where several findings or agreed items are applied together, the primary key of the edit plan is the edit identifier, and find-string uniqueness checking is not the organising principle of the plan; insertion-type edits are given a marker too, the finding identifiers and edit identifiers are reconciled in full before application starts, and the application order is derived from dependencies. This is not an earlier version of the post-repair full classification in `10_Agent.md` §7.5 but a discipline for the stage before detection. The entry adapters carry only a reference and do not copy the normative text. The first two are clarifications; the third is an added norm.
- Adds an invariant for follow-up tracking of uncompleted work to `01_Principles.md` §6.2 (anchor `unresolved-follow-up-tracking`). Where a phase, handoff, change, implementation, verification, or release closes and unresolved matters, unimplemented scope, known limitations, residual risk, or other remainders still need action, a decision, rechecking, or monitoring, recording them only in a handoff view, an artifact, a Change Trace, a pull request, a code note, or a release record does not complete the tracking. A remainder is dispositioned onto one of three routes. One that needs follow-up is connected to an Open Work Registry item, another Change Trace, an issue, or an equivalent trackable target, with its owner, next disposition, and reevaluation or completion condition retrievable. One closed as information that needs no follow-up must have its human decision authority, reason, accepted impact or risk, and either the fact that no reevaluation is needed or the condition under which it becomes needed retrievable; AI does not settle the no-follow-up judgment itself. A remainder whose judgment is undetermined is connected as a judgment target. Because the destination and the mechanism are left to each phase and to Change, Principles delegates no normative rule downstream. Three firing points carry only their own firing condition and do not copy the rule: `10_Agent.md` §7.3 for partial handoff and the review exception, `28_Implementation.md` for unimplemented scope, and `13_Release.md` §6 for known limitations. The minimal-principles block in `01_Principles.md` also gains one line stating that a remainder left after closing is dispositioned to a destination or a reasoned closure rather than merely recorded. Both distributed adapters follow through, `template/AGENTS.md` and `template/.github/copilot-instructions.md`, the latter because its completion-report list names remaining gaps and risks and would otherwise keep telling an agent that reporting is enough. `52_Conformance_Audit.md` PL-13 does not treat an item that a human decision authority closed with a reason under this invariant as non-conformant merely because it is absent from the registry. Change classification: `breaking`.
- Changes a phase contract and an agent execution boundary. First, the phase entry contract in `28_Implementation.md` gains a trace to the originating REQ / UX / IA. Every other phase document (`23_IA.md`, `25_UI.md`, `26_Behavior_Specification.md`, `27_Architecture.md`, `29_Verification.md`) already keeps an upstream trace at its entry; only Implementation was missing it. The exit condition in `27_Architecture.md` already requires the same item, so the sending side needs no change. This applies conditionally to adopting projects that run the Implementation phase, per the conditional step in the migration note. Second, `10_Agent.md` §3.1 gains a requirement that escalation must not lose an unmet obligation: the scope, the unmet obligation and its unmet condition, the required follow-up, the deciding authority, and the resume condition are handed over in a form the receiver can resume from. Copying the normative text verbatim is not required. A remainder that still needs action after escalation is connected per the follow-up-tracking invariant. Both are `breaking`.
- Adding `15_Progress.md` as a new canonical document was confirmed by the human decision authority for the scope of v0.8.0, as an exception to the default in `19_Maintenance.md` §2.2 of integrating into an existing canonical document. Integration into `21_Discovery.md` §6 and `12_Change.md` was considered. The former is an index of uncompleted work and its §6.1 declares that it is not a second source of truth, so making it own the derivation layers and Responsibility Progress would be self-contradictory. The latter is bounded to the change unit and cannot carry a Lifecycle Slice that has no Change Trace, such as investigation, UX validation, or documentation-only work. The decisive grounds are that progress management has its own state transitions (the Work State in §3.2) and its own users (the aggregation units in §7), belonging to no single phase. The independence of its approving authority is not offered as grounds, since it can be explained as a composition of existing authorities.
- Resolves, by defining boundaries rather than renaming, the situation where this standard calls several different things a Profile. `02_Terminology.md` §5 now distinguishes the Conformance Audit profile, the accessibility profile, the quality-concern profile, the skill-run profile, and the repository operation profile in a single row. A survey across the 36 files other than `CHANGELOG.md` found 71 occurrences of the term: 36 carry an explicit kind qualifier, 25 are resolvable from their immediate context, and 10 stand alone. All 10 sit in contexts where no other kind can intrude, so there is no bare use in a place where several kinds could be meant. Each usage is therefore distinguishable through its qualified canonical name, its scope of application, its decision authority, and its conformance impact. A shared name alone does not justify calling the current wording an error or requiring a migration, and a full rename would add little clarity relative to the migration it would force on existing adopters, so it is not carried out. The accepted impact is that a reader who does not read the boundary row in `02_Terminology.md` §5 may still conflate the usages. Closing the item while accepting that impact was confirmed by the human decision authority for CRDD maintenance, for the scope of v0.8.0. No follow-up work remains and no reevaluation is planned. If a concrete misreading by AI, a user, a tool, or an adopter is actually observed in future, it is taken up as a new observation rather than by reopening this item.
- Closes the carried-forward item recorded as a circular definition-and-authority relationship for `Priority`, having confirmed that no such cycle exists in the current text. The boundary row in `02_Terminology.md` §5 already assigns the source of truth for its meaning to [the Information Presentation Model](23_IA.md#28-information-presentation-model); the cycle was resolved when that boundary row was added in v0.7.0. This is a closure on a finding of fact, so no reevaluation condition is set.
- Does not update the `Related` header of documents that gained a new in-body link to `21_Discovery.md`. `Related` is operated as a selective guide to the main documents to read alongside, not as an exhaustive ledger of every in-body reference or delegated authority. The `Related` header in `03_Documentation.md` does not list `21_Discovery.md`, yet its own repository-structure table names `21_Discovery.md` as the phase authority for `01_Discovery`. Direct references to `21_Discovery.md` are retrievable in each body text, and adding only the documents changed in this release would make the listing criterion inconsistent with existing documents. Changing how exhaustive `Related` must be is treated as a separate document-rule change covering all canonical documents.

Adoption impact: adopting projects must migrate their Roadmap. Existing items must be re-stated onto the two axes using the mapping in the migration note, and the registry must be widened from accepted-but-deferred work to all uncompleted work, whether or not it is expected to close within the current scope — which means sweeping the places that work currently hides: Discovery candidate holdings, open Change Traces, unresolved audit findings, verification leftovers, migration assets still awaiting execution, and follow-up work recorded only in a Change Trace body. A project that keeps its roadmap in an external tool satisfies this the same way, provided the equivalent record carries both state axes and the reference back to the owning Canonical Artifact. Existing agent definitions, prompts, and workflows that close a Change, an audit, or a verification with unfinished work described only in prose need updating, as do any that treat Roadmap registration as evidence of adoption. The progress model itself imposes no work on a project that does not report progress based on CRDD responsibilities: PL-14 is `Not Applicable` with its reason and affected scope in that case, and `15_Progress.md` adds no folder, no identifier, and no required file. A project that does report such progress must make the progress unit, applicable responsibilities, Work State, and evidence retrievable, show progress and Health separately, and stop using a progress indicator as a basis for phase transition, verification completion, release eligibility, risk acceptance, or human approval. Projects should not bulk-import every historical idea; `21_Discovery.md` §6.2's firing condition and the migration note's ordering prioritise items that affect current product decisions. This migration is required, not optional, for projects updating to v0.8.0 from an existing baseline — a first-time CRDD adoption has no prior baseline to diff against and is out of scope for the bar per `19_Maintenance.md` §6.2.1, though its Baseline Adoption Assessment and human activation still apply — and must satisfy the Migration Completeness bar in `19_Maintenance.md` §6.2.1 before the project records a `Conformant` claim against v0.8.0.

Migration note (v0.7.0 → v0.8.0):

- Classification / migration required: `change_classification: breaking`, `migration_required: true`. This baseline update is in scope for the Migration Completeness bar regardless of adoption disposition, including adopting with no action.
- Required: re-state every existing Roadmap Item onto the two axes using the mapping below; widen the registry to all uncompleted work, whether or not it is expected to close within the current scope, taking the sources in order — existing Roadmap items, Discovery candidate holdings worth reconsidering, open Change Traces, follow-up work recorded in Change Traces, unresolved audit findings, defects, migration assets still awaiting execution, and technical debt — then merge duplicates; do not register work that is already complete; close candidates that are demonstrably rejected, invalid, or no longer valuable after confirming the decision reason. Update agent definitions, prompts, and workflows that close a Change, audit, or verification with unfinished work left only in prose. Give execution and reference items that carry no Decision State (Change Trace references, clear defects, approved corrections, and the like) a Work State and a reference to the executing basis, and do not record a Decision State for them. Items mapped from a former `Deferred` to `Adopted` / `Unscheduled`, and unaccepted items entering as `Held` / `Unscheduled`, must make their owner and reevaluation trigger retrievable; items registered as `Unreviewed` need neither. An execution or reference item that still carries follow-up work, a decision, or monitoring on the registry side must also make its owner and reevaluation trigger retrievable; one whose executing basis already tracks an owner and a completion condition does not.
- State mapping: `Deferred` → `Adopted` / `Unscheduled`; `Ready for Start Review` → `Adopted` / `Ready for Review`; `Started` → `Adopted` / `In Progress`; `Completed` → `Adopted` / `Completed`; `Cancelled` → `Adopted` / `Cancelled`. Items that were never adopted have no prior status to map and enter as `Unreviewed` or `Held` with `Unscheduled`. A previously blocked item takes the Work State it would otherwise hold, plus a Blocker with the reason and release condition.
- Conditional: the progress model applies only where the project reports progress based on CRDD responsibilities; otherwise record PL-14 as `Not Applicable` with a reason and the affected scope. Where it does apply, map the method's execution unit, goals and completion conditions, states, auxiliary information, and scope-selection rule onto `15_Progress.md` §9, and stop treating a method-specific definition of done as a substitute for the applicable verification and human decision. The `29_Verification.md`, `19_Maintenance.md`, and audit-side duties apply only where the project already runs those phases or audits. A project with no in-flight Change Trace, no unresolved audit finding, and no migration backlog has nothing to sweep from those sources and records that, rather than treating the sweep as skipped. A project that runs the Implementation phase adds the trace to the originating REQ / UX / IA to its phase entry contract and confirms that existing implementation-target artifacts make that trace retrievable at entry; where it is not retrievable, it is completed from the upstream exit record, since the exit condition in `27_Architecture.md` already requires the same item, and any scope that cannot be completed that way is connected to the Open Work Registry. This does not apply to a project that does not run the Implementation phase. A project that uses agents or subagents includes in its escalation format the scope, the unmet obligation and its unmet condition, the required follow-up, the deciding authority, and the resume condition. A remainder that still needs action after escalation is connected to the Open Work Registry or to a Change Trace. This does not apply to a project that does not use agents.
- Out of scope: no Stable Context ID change, no `RM-*` identifier, no file rename, no new folder, and no change to existing `REQ`/`UX`/`IA`/`UI`/`SPEC` identifiers. `99_Roadmap/01_Product_Roadmap.md` remains the Main View. No fixed schema is imposed: the registry may be a table in one Markdown file, an issue tracker, or an external roadmap tool, provided the item contract in `21_Discovery.md` §6.4 is retrievable.
- Verification: run Document Audit for reference, anchor, and terminology follow-through. Gap / Impact Audit is required for this baseline, not conditional: the Migration Completeness bar's first four points (inventory, disposition, migration destination, nothing awaiting execution) are central to this migration, and per `19_Maintenance.md` §6.2.1 Document Audit does not judge them. The inventory covers all existing assets in scope — artifacts, adapters, and operations — per `19_Maintenance.md` §6.2.1. Re-evaluate PL-11 and the new PL-13, PL-14, and PL-15 before recording any claim. For every existing `Not Applicable` result, add or confirm both its reason and affected scope, then re-evaluate eligibility under `52_Conformance_Audit.md` §§3 and 7; do not convert an unevaluated or unsupported criterion into `Not Applicable`.
- Rollback / recovery: keep the previous pinned baseline active until Migration Completeness is met; a candidate baseline read for assessment does not govern the project until human activation.
- Known risk if deferred: uncompleted work stays split across candidate holdings, Change Traces, audit results, and migration inventories with no place that shows the whole of it, so long-buried items keep going unnoticed; and a `Conformant` claim recorded against v0.8.0 without completing the migration is not eligible under `52_Conformance_Audit.md` §7.

---

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

<a id="changelog-v0190-ja"></a>

### v0.19.0 — 候補（未公開）

現在の候補は、一つの固定推論Schemaを必須にせず、Communicationの推論接続を強化する。認知意図の発火、非発火、判定情報不足を分け、当時の仮説と現在有効な意図を区別し、AIへは関係があり現在有効で追跡可能なContextだけを投影する。商業性、調査安全、説得リスクおよび採用後価値は、それぞれ責務を持つ正本へ維持する。

Dogfoodingからの横断改善として、採用可能な結果までの保証コスト、計画した変更経路と実際の経路、その差と有効だった検証を既存の変更トレース・品質根拠から観測できるようにする。人間可読性は新しい監査を増やさず、既存の文書監査で表示名、一言説明、用語依存、文の複雑さおよび情報構造を確認する。固定Profile、自動経路決定機構、可読性専用Checkerおよび文字数Gateは追加しない。本項は作業中の候補を説明するものであり、公開、採用または準拠を成立させない。公開済み基準はv0.18.1である。

同じ自己監査により、内容の正しさと文書の所有先を別に確認する。Toolの実装・静的検査規則は内部ツール・コーディング規約、Runtimeの信頼境界・資源・実行Identityは責務を持つアーキテクチャ、反復commandはWorkflow、検証範囲と結果は品質保証が正本となる。保守はこれらを再定義せず、変更、移行およびリリース判断を所有する。この責務再配置は既存Runtimeの意味、規範強度および移行結果を変更せず、新しい成果物種別も追加しない。

v0.19.0候補は、独立して追跡できる次の4変更から構成する。

| 変更トレース | リリース上の意味 |
|---|---|
| [CHG-000057](90_Release/Changes/CHG-000057_Minimum_AI_Native_Project_Runtime.md) | 単一Projectの限定Runtime、認証済みMCP入口、耐久Queue、Task Graph、統合、判断、取消およびexact Recovery境界を追加する |
| [CHG-000058](90_Release/Changes/CHG-000058_Reasoning_Context_and_Design_Intent.md) | 判断に必要な推論Contextだけを保持し、現在有効な意図と履歴を分け、関係があり追跡可能な範囲だけをAIへ投影する |
| [CHG-000059](90_Release/Changes/CHG-000059_Dogfooding_Assurance_Route_and_Readability.md) | 保証コストと実際の変更経路を観測可能にし、文書の所有先、可読性および完了主張の規律を強化する |
| [CHG-000060](90_Release/Changes/CHG-000060_CRDD_Brand_Icon_Adoption.md) | 同一CRDDブランドアイコンの2解像度原本を、商標許可やRuntime Identityを拡張せず保存する |

採用への影響: 統合候補は、CHG-000058とCHG-000059が該当する現在または再開対象の作業に対する規範評価を変更するため`breaking`である。CHG-000057は選択して利用するRuntime能力であり、v0.18.1のSingle Task入口を削除しない。CHG-000060は追加のみで移行不要である。

移行注記（v0.18.1 → v0.19.0候補）:

- `migration_required: true`
- `change_classification: breaking`
- 既存基準版から更新するすべての採用先で必須: 新しい基準版の採用を評価し、現在、再開対象または管理対象となる全資産を棚卸しし、該当なしを含め各資産の処遇を決定する。必要な処置を完了し、意味欠損がないことを独立確認してから基準版更新の完了を表示する。
- 必須: 現在または再開対象の推論Context、外部コミュニケーション、変更トレース、品質保証、文書化、エージェント案内、アーキテクチャおよび文書監査の利用側を適用判定する。当時の判断・仮説を上書きせず、現在有効な意図を識別し、必須観点が未評価の結果を全体完了と表示しない。
- Project Runtime採用時に条件付きで必須: Repository Bindingと認証済みLocal Principalを確認し、耐久Queueとexact Recovery Identityを使用する。Project RuntimeのRelease Gateが成立するまでv0.18.1のSingle Task commandを維持する。Project Runtimeを有効化しないProjectにRuntime移行は不要である。
- 不要: 完了済み成果物の遡及改稿、専用の推論File／Database、新しい監査種別、ブランドアイコンのUI組込み、または既存商標許可の変更。
- 切戻し: v0.19.0の有効化判断までv0.18.1を有効基準として維持する。有効化したProject Runtimeから戻す前に新しいObjectiveを停止し、exact Task、Candidate、Queue、DecisionおよびRecovery義務をすべて解消する。観測不能の根拠は保持し、cloneまたはsubmoduleを公式v0.18.1 tagへ一つの配布物として戻す。
- 延期時の既知リスク: 現在作業で判断に必要なContextを失い、準備状態を過大表示し、または部分接続のProject Runtimeを完成扱いする可能性がある。Runtime利用者が競合作業を開始したり、exact Recovery義務を放棄したりする可能性もある。
- 検証: 最終候補は、一つの固定改訂版に対するRepository全体Checker、決定論的試験、実Process試験、認証済みMCP、取消、親Process喪失、Recovery settlementおよび対話／スケジュール競合の根拠を必要とし、その後に独立レビューと適用する監査を行う。Provider／署名E2EはRuntime実行Identityが変わる場合または最終Runtime候補固定時だけ要求する。
- 既知の制限: v0.19.0の責務は単一Repository／単一Projectに限定する。複数Projectのスケジュール、Linux／macOSでの利用可能性、常設自律Service、普遍的推論Schemaまたは第三者ブランド権利の法的確認を成立させない。

<a id="changelog-v0181-ja"></a>

### v0.18.1 — Coordinator採用入口の是正

Coordinator Runtimeの初回公開時の採用経路を是正する。Local Personalは永続的な`activate`、`disable`または`provision` Lifecycleを公開せず、一般TaskがOperationごとに必要条件を検証する。利用結果へ接続しなかったcommand、状態Record、準備Store、bootstrap Supervisor、互換shimおよび第二のNative成果物は、常時`blocked`の入口として残さず削除する。`capabilities --json`はEffectなしの公開Capability閉集合を返す。署名manifest revision 5はRelease IdentityとRuntime実行Identityを分離し、実行Authorityを機械導出した閉じたRuntime依存集合、Security Policyおよび単一Platform Access成果物へ結合する。Runtime実行Identityが不変な文書だけの変更では、Runtime再署名と実Provider E2Eを要求しない。v0.18.0 tagと過去Evidenceは書き換えない。

移行注記（v0.18.0 → v0.18.1）:

- `migration_required: true`
- `change_classification: breaking`
- 必須: Coordinator Runtimeを利用するProjectはCRDDのsubmoduleまたはcloneを更新し、`capabilities --json`を確認して`task`を直接実行する。削除した準備commandをv0.18.1の入口として使用しない。
- 条件付き: 想定外のHost Effectまたは残存Recovery Recordを観測した場合は、推測削除・推測移行せず、記録された回復判断へ戻す。
- 不要: CRDD方法論だけを利用しCoordinator Runtimeを使わないProjectに実行移行は不要である。Runtime実行Identityが不変な文書だけの変更では、Runtime再署名と実Provider E2Eも不要である。
- 復旧: 新規Taskを止め、exact Candidateを破棄または回収してから採用版を切り替える。Provider Effect後でも結果が確定し、候補不存在または破棄済み、cleanup確認済み、Recovery IDなし、対象資源不存在なら、その完了根拠を保持して切り替え、Effectを取消済みまたは未発行へ読み替えない。cleanup不明またはRecovery IDがある場合は、exact Recoveryと資源不存在の確認を完了し、観測不能ならEvidenceと手動Recovery義務を保持する。cloneまたはsubmoduleを公式`v0.18.0` tagへ配布物単位で戻し、v0.18.1の外部送信Policyや同意を流用しない。v0.18.0のRuntime入口は有用結果へ到達しないため、方法論部分だけを継続するかRuntime利用を停止する。
- 延期時の既知リスク: 利用者が常時停止する準備commandを呼び続ける、または実行と無関係なRepository Tree変更へTrustを結合して、情報価値のない署名・Provider試験を反復する可能性がある。
- 検証: 最終公開にはrevision 5の署名manifest、fresh adopterの有用結果E2E、全試験および同じRuntime実行Identityの独立確認を必要とする。文書・試験ではIdentityが変わらず、Runtime Source、PolicyまたはNative成果物では変わることを決定論的試験で確認する。
- 既知の制限: 依存閉包はFail Closedの字句解析を使い、実在確認済みの`node:`組込みmoduleまたは閉じた実行集合内の正規relative targetだけを許可する。選択scriptのNode.js子Process／Workerは同じsourceまたは閉包内のliteral targetだけを許可する。任意に動的生成されるPathは非対応であり、Identityが同じという理由だけでSecurity上の意味変更が安全になることは主張しない。

<a id="changelog-v0180-ja"></a>

### v0.18.0 — 開発手法、エージェント組織、参照Runtime

新しい配布manifest契約は、期限付きに加えて期限なし（`revision: 3`、`expiresAt: null`）を明示的に扱う。既存revision 2の署名は書き換えず、期限付きのまま検証できる。期限なしでも発行日時、署名、実体の一致、権限、互換性の確認は維持し、同意や各操作の期限は延長しない。永久サポートを意味せず、この追加の検証状態は旧署名候補の結果と分けて品質状態から追跡する。

端末UIの参照媒体を明確化した。行単位CLIと画面構成型TUIでは実行可能な端末参照を使い、Web／GUIの既存の代表HTML要件は維持する。媒体選択を操作・アクセシビリティ・独立確認・人間判断の免除にしない。採用側は表示面ごとに分類し、UIと仕様の対応・既知差を更新して、対象端末の実物確認後に完了を判定する。[UI参照条件](25_UI.md#design-system-reference)と[既存のツール配置変更](90_Release/Changes/CHG-000017_Tools_Coding_Standards.md)を参照する。

品質文書の命名も破壊的な配置変更として是正する。`07_Quality/`内の`Quality_Center.md`を`01_Quality_Center.md`、`Quality_Strategy.md`を`02_Quality_Strategy.md`、`Verification_Design.md`を`03_Verification_Design.md`へ改名する。内容・アンカー・利用者の追記・品質判定の意味を保持して、現行参照とスクリプトを更新する。`Verification_Results/`と日付付き記録は維持する。移行先が既に存在する、または履歴の固定条件が不明な場合は上書きせず停止する。配置・リンク・ひな型・関連準拠基準を確認してから新基準版を有効化し、切戻しでは配置と利用側を一組で戻す。詳細は[移行手順](90_Release/Changes/CHG-000017_Tools_Coding_Standards.md#quality-document-naming)を参照する。品質保証が非該当の対象へ空文書を要求する変更ではない。

v0.18.0の差分は、次の七つの正本変更トレースを組み合わせる。判断支援、外部コミュニケーション、専門AIの組織化、参照Runtime、Toolの保守・配置、および自己適用で評価した工程改善を含む。別枠の非規範アーキテクチャ資料は将来の実行投影を評価するもので、準拠要件や実装利用可能性を成立させない。公開済みかどうかと公開日は、公式タグまたは同等の不変なRelease識別子と公開記録から確認する。本記述、branch、CommitまたはStable表示だけでは公開とみなさない。

| 変更トレース | 現在の変更の意味 |
|---|---|
| [CHG-000012](90_Release/Changes/CHG-000012_Current_Decision_Set.md) | 是正・再レビュー後の現在改訂版から人間が今決める事項を再構成する |
| [CHG-000013](90_Release/Changes/CHG-000013_Communication_Market_and_Adoption_Exploration.md) | 採用形成を目的とする外部説明を課題探索へ接続し、調査と説得の安全を保持する |
| [CHG-000014](90_Release/Changes/CHG-000014_V018_Architecture_Candidate_Integration.md) | 候補の採用境界を分離し、不要な承認待ちで分断せず承認済み目標へ継続する |
| [CHG-000015](90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md) | 参照Runtimeの限定委譲、独立レビュー、取消、回収、復旧を実装・検証する |
| [CHG-000017](90_Release/Changes/CHG-000017_Tools_Coding_Standards.md) | Tool開発契約を強化し、実装と関連成果物を責務を持つ工程フォルダへ移す |
| [CHG-000054](90_Release/Changes/CHG-000054_Agent_Organization_Document_Architecture.md) | 役割、専門性、能力、決定権限、独立性、費用、結果統合を分離する |
| [CHG-000055](90_Release/Changes/CHG-000055_CRDD_Long_Term_Evolution_Roadmap.md#26-実務評価と最終確認への引渡し) | 長期方向を現在の採用範囲と分けて記録し、工程接続・検証・収束・可読性を強化し、根拠駆動リファクタリングと実務有用性を評価する |

Runtimeを利用する場合は、cloneまたはsubmoduleを選択した公式Release tagへ固定し、同梱manifestと固定Native Runtime成果物の署名・実体がそのReleaseに一致することを検証する。別のRuntime archiveは必要としない。未署名の開発branch、改変されたcheckout、本記述または旧候補の署名だけでは検証は成立しない。署名固定版`48515eb`で4委譲経路、7種の復旧試験、実端末の取消と回収確認を完了した。旧固定版`45ea2ac`による限定実務も通常CLIから独立レビュー、親の確認、候補破棄まで成立したが、この有用性評価を後続版の実測とは扱わない。これらの完成評価と端末確認は記録された版に限定し、別の配布物へ自動適用しない。人間の承認自体は公開や最終Identityへの署名の証拠ではなく、旧候補の署名を新しいタグへ流用しない。内部のソース・テスト・ビルド定義は`tools/`から`40_Develop/`へ移し、振る舞いを`05_SPEC`、設計を`06_Architecture`、操作手順を`19_Workflows`へ分ける。採用先の配布Checkerは`template/tools/crdd-check.ts`を維持し、既存の署名配布物と固定履歴は変更しない。[品質の現在状態](07_Quality/01_Quality_Center.md)と[移行記録](90_Release/Changes/CHG-000017_Tools_Coding_Standards.md#9-内部ツールの工程別配置への移行)から確認できる。実務自己適用では限定利用の成立を確認したが、完成速度、費用、人間負荷の一般的な優位は未実証である。

Local Personal v1の配布Trustは、Ed25519 Release manifest、Git Identityおよび固定Native artifact Hashを必須とする。Authenticodeは第二のinstallまたはdownload前提ではなく、固定publisherを使う場合の追加防御である。publisherを明示したbuildは検証失敗時にmanifest-onlyへfallbackしない。

v0.17.0からの変更:

- [承認済み目標への継続](10_Agent.md#authorized-goal-continuation)を強化する。内部ステップ、子エージェントの質問、進捗報告だけで再承認待ちを作らない。新しい決定権限、対象範囲、課金経路、未解決の重大リスク、人間の停止・取消は既存の境界を維持する。
- 仕様、状態・資源設計、実装、正常・準正常・異常・回復の検証を接続する。[残る不確実性に応じて検証を選び](16_Quality_Assurance.md#uncertainty-driven-verification)、完成条件や独立レビューを弱めず収束させる。[人間可読文書の本文構造](03_Documentation.md#481-locale-first-display)を改善し、条件・決定権限・識別子・過去根拠を保持する。実務有用性を評価し、未測定の改善は主張しない。
- 是正済み、AIが一意に修正可能、報告のみ、または安全に独立保留できる事項を現在の人間判断へ戻さず、現在の重大リスク、不可逆な効果、残存リスク受容または決定権限競合を隠さない現在の判断集合契約を追加する。
- 外部コミュニケーションの市場・採用探索契約を追加する。採用形成を目的として受け手、訴求、媒体、広告または市場反応の扱いを新設・変更する場合に複合条件で発火し、市場・採用仮説の決定権限を課題探索へ保持し、観測と原因を分け、外部行動を促す前に提供準備を確認し、人間対象作業の同意、自律性、情報最小化、選定偏りおよび一般化限界を維持する。
- 専門化したAI作業を編成しながら人間の決定権限を維持する基礎規範の正本として`04_Agent_Organization.md`を追加する。
- エージェント型提供基準AD-22を追加する。役割分担、委譲、実行主体／プロバイダー／モデル選定、独立レビューまたは調整役による統合を行う場合に、責務、専門性、能力、決定権限、検証および統合の分離、不要なエージェント／委譲の非発火、名称から品質・独立性・決定権限を推定しないこと、適格候補間だけで費用・割当量・利用枠を比較すること、および結果や`Pass`を人間の決定権限へ昇格しないことを評価する。
- エージェント型提供の準拠表明範囲をAD-01〜AD-21からAD-01〜AD-22へ拡張する。恒久的な組織台帳、固定スキーマ、複数エージェント実行または完了済み履歴の遡及書換えは要求しない。
- `04_Agent_Organization.md`§1～§11のエージェント組織の基礎規範、§12の非規範実行Architecture候補、および現在のCoordinator Runtime実装を分離する。
- v0.18 Architecture Candidateは非規範のまま維持する。同一branchへの同居、図、実行環境候補または将来Profileから準拠基準や実装利用可能性を成立させない。
- 既存の保守およびAI入口契約を強化し、Process、channel、非同期I/O、取消、preflight同等性、cleanup後状態および監査フィードバックを本番同等構成で確認する。Node、Windows console、具体的環境key、timeoutおよびbyte上限は`40_Develop/coordinator/`の実装責務へ、その設計は`06_Architecture/coordinator/`へ残す。
- 公開済み基準は公式タグまたは同等の不変なRelease識別子で特定する。branchの内容、Stable表示、Checker合格またはRuntime実装だけでは、プロジェクトでの採用、準拠または実行権限は成立しない。

採用への影響: 統合したリリース候補の差分集合は、外部コミュニケーションと品質文書配置の破壊的変更を含むため`breaking`に分類する。現在の判断集合、エージェント組織およびCoordinator保守／AI入口の変更は規範変更であり、CHG-000055の現在の工程差分も、人間が採用した規範変更として扱う。v0.17.0からv0.18.0を採用するプロジェクトは、基準版採用評価と移行完了の条件を通じて、該当する現在の判断支援、外部コミュニケーション／課題探索、エージェント型提供、AI入口、工程、設計／検証、人間可読文書、レビュー、保守および経路制御の利用側をすべて評価する。非規範アーキテクチャ資料自体は移行を発火しない。完了済みの過去作業や過去の準拠記録を、新しい表示形式やAD-22へ合わせるだけの理由で書き換えない。

移行注記（v0.17.0 → v0.18.0）:

- `migration_required: true`
- `change_classification: breaking`
- 必須: v0.18.0を有効化する前に基準版採用評価と移行完了の条件を満たす。CHG-000012、CHG-000013、CHG-000014、CHG-000015、CHG-000017、CHG-000054およびCHG-000055の該当利用側を棚卸しし、移行、置換、据え置きまたは対象外の処遇を記録し、意味保持の独立レビュー、人間による有効化判断および切戻し境界を取得する。
- 工程・検証・文書の利用側で条件付き: 承認済み作業を不要に分断する、設計要素から検証への接続がない、現在の未解決義務を根拠なく将来へ送る、または表示によって条件・判断が読めなくなる案内を更新する。検証計画、保留判断、人間可読成果物を既存正本に照合し、既に適合する資産は根拠付きで据え置く。新しいFramework、全Taskの反復実測、完了済み履歴の改稿を要求しない。
- 保守するAI入口で必須: 資源役割を分離し、本番のProcess／channel構成を再現し、取消要求ではなくcleanup後状態を確認し、preflightと実処理の判定を同等に保ち、反復したレビュー／監査の一般化可能な原因を既存の支配契約へ還元する。その入口を保守または配布しないプロジェクトは、対象範囲と理由を示して本利用側を対象外と処遇できる。
- 判断支援で必須: 古い指摘や解消済み事項を人間判断へ転送する、現在判断がないのに承認を作る、現在の重大リスクを隠す、または独立に採否できる判断を束ねるエージェント、スキル、品質、監査およびAI入口の案内を更新する。是正・再レビュー後の現在改訂版から現在の判断集合を導出する。
- 外部コミュニケーションの複合発火条件が成立する場合に必須: 採用形成を目的とする受け手、訴求、媒体、広告または市場反応の変更を、課題探索が所有する市場・採用探索へ接続する。根拠の性質、選定・無反応の偏り、一般化限界、調査の同意と拒否、情報最小化、自律性、提供準備、停止条件および外部行動前の人間の決定権限を維持する。発火しない範囲へ空の市場探索成果物を追加しない。
- エージェント型提供の準拠で必須: 対象範囲のAD-22を評価する。既存の作業割当、経路制御、レビューおよび統合の根拠が必要境界を示せる場合は再利用でき、専用台帳を要求しない。
- 条件付き: 契約に反する現在または再開対象の利用側だけを更新する。エージェント組織では、役割、プロバイダー、モデル、接続またはセッションから能力・決定権限を推定する、不要な委譲を追加する、適格性判定より先に費用を比較する、プロバイダー差を独立レビューとみなす、またはエージェント結果を人間の決定権限へ昇格する場合が該当する。外部コミュニケーションでは、固定人数、固定媒体順、根拠のない広告指標または提供経路を確認できない外部行動を再評価する。
- 採用プロジェクトでは不要: 非規範のアーキテクチャ候補（Architecture Candidate）の採用、Coordinator Runtimeの導入や自プロジェクトのリリース範囲への追加、複数エージェント、固定の計画者／実行者／確認者フロー、特定プロバイダー／モデル、恒久的な組織成果物、新しい安定コンテキストID、非適用範囲の外部コミュニケーション成果物、または完了済み履歴の遡及書換え。CRDD自身のv0.18.0 Candidateで採用済みのRuntime完成義務を対象外へ移す意味ではない。
- 切戻し／復旧: 移行完了と人間による有効化が終わるまでv0.17.0を有効基準として維持する。部分採用を戻す場合は、候補・移行記録を履歴として保持しながら、以前のAI入口、判断支援、外部コミュニケーション／課題探索および準拠範囲を復元する。外部で既に観測した根拠や完了済みの人間対象作業を切戻しで消去したことにしない。
- 延期時の既知リスク: 人間が解消済み事項を再判断させられる、または現在の重大リスクを見落とす可能性がある。外部コミュニケーションが弱い信号から市場原因を断定し、対象者を誤り、回答圧力や不要な情報開示を生み、提供できない行動を約束する可能性がある。経路制御が役割、能力、決定権限を混同し、費用を適格性より優先し、プロバイダー差を独立レビューと誤認し、統合したAI結果を人間の承認と誤認する可能性がある。
- 検証: 一つの固定改訂版へリポジトリ全体Checkerを実行し、同じ改訂版に対してエージェント／アーキテクチャ独立レビュー、文書監査、不足／影響監査および準拠監査を実行する。現在の判断集合の代表例、外部コミュニケーションの発火／非発火／情報不足と人間対象境界、AD-22とAD-01〜AD-22準拠表明、英日移行注記の同義性、v0.17.0の保持および非規範アーキテクチャの分離を確認する。
- 既知の限界: これらの契約は判断表示、市場・採用探索およびエージェント編成の説明可能性と統制を高めるが、市場、標本の代表性、因果、提供能力、プロバイダー能力、レビュー品質、またはすべての費用・割当量・プライバシー・法務・セキュリティ失敗の不存在を証明しない。人間の決定権限、適格な独立レビュー、専門家判断、同意または適用法令・契約を代替しない。

<a id="changelog-v0170-ja"></a>

### v0.17.0 — 専門探索・収束と外部情報境界（2026-08-10）

本リリースは、人間の判断へ渡す前に有力な専門候補を作る共通推論契約と、外部調査・接続ツールを介する情報流通を制御する外部情報境界を追加する。採用済み判断を守るだけでなく、AIと専門担当がパターンを検索し、候補を合成し、批評または反証し、修正し、追加探索が判断を変えにくい理由を説明できるようにする。センスを固定値へ変換せず、固定案数、軽量経路、「探索済み」「収束済み」という自己申告を根拠にせず、許可した処理境界の外へ内部コンテキストを検索語、プロンプト、添付またはツール入力として複製することも許可しない。

v0.16.0からの主な変更:

- `11_Skill.md`へ専門探索・収束契約を追加した。専門判断では、判断を変え得る不確実性を特定し、工程固有のレンズとパターン知識から有力候補を合成する。既存案だけが有力な場合も理由を示し、弱点、保持条件との衝突、残存不確実性および収束根拠を説明する。
- 課題探索・要求形成へ判断を変える根拠、UXへ体験合成、IAへ構造合成、振る舞い仕様へ振る舞い合成、アーキテクチャへ構造合成、実装へ実装戦略と差分の逆向き批評、検証へ検証・根拠戦略を追加した。
- UI、グラフィック、イラスト、画像、アイコン、モーション、プレゼンテーション、2D／3D素材へ使える視覚制作と材質・空間表現の共通レンズを追加した。新しい直列工程は作らず、構成、階層、リズム、文字、色、個性、形態・輪郭、材質反応、縮尺、形状・縁、物体履歴と原因に基づく摩耗、照明、カメラ、空間文脈、技術的成立、物理的な納得性と知覚上・文脈上・芸術上の成立を固定スタイル規則ではなく批評観点として扱う。
- 人間のまだ言語化できない視覚的違和感を仮説と比較の開始点にできるが、自動的な合否判定にはしない。美的判断、ブランド判断、公開判断および芸術的採用は人間の決定権限に残す。
- 現在案が成立した後に意味のある差別化余地をAIが発見できるが、慣習に従う範囲、差別化する範囲、保持条件、期待価値、認知・導入費用、リスクおよび必要な人間判断を分けた提案までとする。採用済みの原則、意図、契約、ブランド方針または視覚方向をAIが自己判断で破ることは許可しない。
- アーキテクチャを設計要因とトレードオフの評価から、設計要因→構造合成→評価へ強化した。パターン名を答えにせず、境界推論、状態所有、失敗起点の推論、感度、可逆性、事前失敗分析から意味の異なる構造候補を作る。
- 品質保証と独立した専門品質確認は、案数、活動記録、チェックリスト、自己申告または単一表示条件ではなく、実際の成果物と説明可能な推論結果を評価する。
- READMEへCRDD初回導入、基準版移行、全プロダクトライフサイクル工程、外部コミュニケーション、管理対象依存、視覚制作、3D材質・空間表現の非規範な指示例を追加した。
- 条件付きプロダクトライフサイクル基準PL-19を追加した。専門判断を新設、変更または採用する場合に適用し、記録更新だけの対象へ架空の代替案を要求しない。固定成果物、スキーマ、安定コンテキストID、監査、承認段階、特定ツールまたはモデル固有経路は追加しない。
- `01_Principles.md`へ外部情報境界、Core基準へC-11を追加した。許可した処理境界は、対象リスクに応じて情報分類、目的・操作、送信先またはテナント、利用主体、保持、二次利用、再送、契約・法令、残存リスクおよび決定権限から識別し、「社内」、非公開表示、ログイン、導入済みまたは一回の承認だけから推定しない。境界内では目的に許可された情報だけを必要な最小量で送り、境界外の調査では削除・抽象化・最小化した別の外部向け調査コンテキストだけを送る。分類、許可、境界条件または安全な抽象化が不明な場合は送信せず人間判断へ戻す。
- 情報分類は明示的に上書きされない限り継承し、派生・組合せ情報は再識別リスクに応じて同等以上に保護する。シークレット値をコンテキストへせず、必要な場合も実行時注入するシークレットへの参照だけをエージェントへ渡す。
- 外部内容は、許可した処理境界またはツール内に存在するだけでは指示、決定または操作権限を得ない。エージェント契約、認証済み主体および許可した目的・操作から権限を別途確認できる場合だけ、その範囲の指示として扱う。それ以外は信頼していない根拠として扱い、プロンプト注入、汚染文書・ツール、エージェント間漏洩、権限拡大、機微な推論、権限の幻覚、危険な外部操作および接続ツールの供給網リスクを、アーキテクチャ、実装、検証、品質保証へ接続した。委譲で権限を拡大せず、重要なセキュリティ不変条件は可能な範囲で実行時強制と合成境界試験を用い、エージェントの自己申告へ依存しない。

採用への影響: これはCore、プロダクトライフサイクルおよびAI実行に対する非構造的な破壊的変更である。既存基準版からの採用には[移行完了の条件](19_Maintenance.md#621-migration-completeness)を適用する。Core準拠表明ではC-11、プロダクトライフサイクル準拠表明ではPL-19を評価する。進行中の工程スキル、品質根拠、AI入口、ローカル案内、情報分類、外部サービス接続、ツール権限またはセキュリティ検証が新しい契約を保持できない場合だけ更新する。完了済み履歴を新しい説明形式へ合わせるだけの理由で書き換えない。

移行注記（v0.16.0 → v0.17.0）:

- `migration_required: true`
- `change_classification: breaking`
- 必須: v0.17.0を有効化する前に基準版採用評価を行い、移行完了の条件を満たす。採用元、プロジェクト固有接続、影響する進行中作業、人間の有効化判断、復旧境界を記録する。
- プロダクトライフサイクル準拠で必須: 対象範囲のPL-19を評価する。有効化後に専門判断を新設、変更または採用する場合は、不確実性、レンズとパターンの使用、候補合成、批評または反証、残存不確実性および収束根拠を説明可能にする。
- Core準拠で必須: 対象範囲のC-11を評価する。接続母集団、適用する情報分類と継承、派生・組合せ情報のリスク、許可した処理境界、境界外接続、エージェント／ツール権限、外部入力の指示権限、供給網資産、セキュリティ不変条件、実行時強制、検証、監査、失効および回復を確認する。接続がない場合も接続母集団0と再評価契機を示し、C-11を非適用にせず、空の専用成果物も作らない。
- 外部調査または接続ツールの有効化前に必須: 目的・操作、情報分類、送信先、利用主体、保持・二次利用、再送および決定権限等を対象リスクに応じて確認する。許可した処理境界内では許可された最小情報だけを送り、境界外では削除と抽象化によって最小限の別コンテキストを作り、組合せによる再識別と送信先の許可を確認する。許可を別目的、別サービス、別テナントまたは別公開先へ流用せず、残存開示リスクを安全に解消できない場合は人間判断を残す。外部結果は、正規の認証済み指示経路として確認できる範囲を除き、信頼していない根拠として戻す。
- 進行中または再開した工程作業で必須: 現在のプロジェクト成果物が対象レンズを保持できない場合だけ、ローカル工程指示、スキル接続、品質戦略または検証設計を更新する。完了済み工程成果物を形式合わせだけの理由で書き換えない。
- 条件付き: UI、グラフィック、プレゼンテーション、モーションまたは2D／3D素材が対象の場合、視覚制作結果を責務を持つUI、外部コミュニケーション、品質またはプロジェクト成果物へ接続し、人間の美的・ブランド判断を維持する。複数表示条件は判断を変え得る場合だけ使用する。
- 段階実装で条件付き: 互換境界、並行状態、二重操作または機能切替は、固有の移行リスクが必要とし、人間が対象、期間、比較、整合、停止、復旧、費用、撤去条件を承認した場合だけ使用する。軽量な既定経路にはしない。
- 不要: 固定数の代替、恒久的な探索文書、新しい工程フォルダ、新しい監査・承認、モデル能力点数、チェックリストによる美的合否、特定のデザイン／3D／セキュリティツール、仲介実装、全ファイルへのセキュリティラベル、実在シークレットを使う試験、完了済み履歴の遡及書換え。
- 復旧: 移行完了と人間による有効化が終わるまで、現在有効なv0.16.0基準版と手順を維持する。部分適用を戻す場合はv0.16.0のAI入口と工程接続へ戻し、v0.17.0候補記録は履歴として保持し、進行中作業を直前に記録した判断・検証境界へ戻す。
- 延期時の既知リスク: AIが工程成果物を形式上は正しく埋めても、有力な機会、体験構造、視覚方向、振る舞い、アーキテクチャ、実装戦略または検証根拠を作れない可能性がある。加えて、外部検索・ツール経由で識別可能な内部コンテキストを開示し、悪意ある外部命令を受け入れ、過剰権限または未評価の依存を使う可能性がある。人間が暗黙の救済層として残り、後段の手戻り、批評反復またはセキュリティ事故につながり得る。
- 検証: 一つの固定改訂版へ全体Checkerを実行し、エージェント運用の独立レビュー、文書監査、不足／影響と準拠影響の監査を行う。既存案のみ、複数候補、情報不足、視覚／3D、記録更新だけ、外部接続なし、承認済みの非公開処理、安全に抽象化した公開調査、指定先への承認済み公開、承認流用の拒否、識別可能な検索語の拒否、悪意ある外部命令、境界条件の失効、最小権限、供給網の代表例を正本から再構成する。境界試験には実在シークレットではなく機微情報を模した合成データを使う。
- 既知の制限: 本契約は専門探索の品質・説明可能性と外部情報流通の体系的な制御を強化するが、独創性、センス、ドメイン専門性、パターン知識の完全性、因果推論、すべてのシークレット・個人情報の完全検出、全外部サービスの信頼性または絶対的安全を保証しない。実行時強制は採用プロジェクトの能力にも依存し、対象に応じた人間の決定権限と専門確認は引き続き必要である。

<a id="changelog-v0160-ja"></a>

### v0.16.0 — 初回固定候補の収束性（2026-08-10）

このリリースは、非自明な変更を一つの整合した固定候補として独立確認へ渡せる確率を高める。シャドウ経路、モデルへの信頼度、記録項目のホワイトリスト、抜き取り承認または軽量監査区分は導入しない。固定前の準備を強化し、初回の独立確認が再構成する反例を明示する。

v0.15.0からの主な変更:

- 非自明な変更では、編集前に契約母集団と利用側母集団を特定する。意味を保持または劣化させ得る正本、直接投影、ひな型、AI入口、公開案内、移行記録および現在状態表示を含める。
- 条件付き規則が適用、昇格、状態、準拠、移行または人間判断を支配する場合、発火例、非発火例、境界例、情報不足例を記録する。情報不足を発火、非該当または完了へ黙って丸めない。
- 一つの文へ混在しやすかった概念定義、発火条件、判定不能時の扱い、評価後の結果語彙を分ける。
- 固定前に実差分との全数照合を行う。親エージェントは計画した母集団と代表例を、変更ファイル、変更していない利用側、参照、生成表示、移行記述および現在状態投影と照合してから確認対象を固定する。
- 初回の独立確認は、最初の指摘で欠けた分岐を知るのを待たず、同じ4種類の代表例を再構成して直接利用側を確認する。
- 検証設計、文書監査、準拠監査および不足／影響監査へ同じ境界を接続する。新しい監査、承認段階、恒久成果物、準拠プロファイル、安定コンテキストIDまたは外部QA依存は追加しない。
- 任意Checkerは安全に決定できる範囲だけを拡張する。公式リポジトリの現行英日CHANGELOG節が各1件あり、有効な`migration_required`が各1件で一致することを確認する。移行が必要な場合は変更分類の一致と構造化された必須区分も確認し、欠落、不正、重複または英日競合をエラーにする。説明文や過去リリースは宣言へ流用しない。Checker合格は実装済み検査だけを証明する。

採用影響: これはAgentic Deliveryと保守手順に対する非構造的な破壊的変更である。既存基準版からの採用には[移行完了の条件](19_Maintenance.md#621-migration-completeness)を適用する。非自明な保守をAIで行う、またはAgentic Deliveryを表明するプロジェクトは、着手前計画、初回確認入力およびAD-02の根拠を再評価する。CRDD品質保証で条件規範を検証する場合はPL-16、条件規範を新設・変更した対象の初回独立確認ではAD-21も再評価する。完了済みの変更や過去の確認記録を、新しい準備形式へ合わせるためだけに書き換えない。

移行注記（v0.15.0 → v0.16.0）:

- `migration_required: true`
- `change_classification: breaking`
- 必須: AIが支援する非自明な変更では、契約母集団と利用側母集団を特定し、条件付き規則の発火例、非発火例、境界例、情報不足例を記録し、候補固定前に実差分と照合する。
- Agentic Delivery準拠で必須: AD-02を再評価し、変更実行記録または同等の根拠から、母集団、代表例、固定前照合および未解消の不一致を取得可能にする。
- CRDD品質保証で条件規範を検証する場合に必須: PL-16を再評価し、検証設計と根拠から定義、発火条件、判定不能時の扱い、正式結果および4種類の代表例を取得可能にする。
- 新設・変更した条件規範の初回独立確認で必須: AD-21を再評価し、実装計画を流用せず、確認者が正本から4種類の代表例と利用側を再構成する。
- 条件付き: ローカルAI入口、変更ひな型、検証設計または監査手順がこれらの入力を保持できず、4種類の例を再構成できない場合だけ更新する。配布Checkerを使わない場合は、同等の決定論的確認と限界を示してよい。
- 不要: 新しい監査、承認段階、恒久的な収束成果物、項目ホワイトリスト、シャドウ運用、抜き取り承認、モデル能力点数または軽量確認経路を追加すること。完了済み履歴の再実行、現在必要な独立確認または専門確認の削減。
- 復旧: 移行完了と人間による有効化が終わるまで、現在有効なv0.15.0基準版と手順を維持する。部分適用を戻す場合はv0.15.0のAI入口と変更実行手順へ戻し、候補記録は履歴として保持し、進行中の変更を直前に記録された確認境界へ戻す。
- 延期時の既知リスク: 条件付き規則を反例ごとに修正し続け、変更していない利用側、ひな型、移行注記または現在状態投影が固定後に初めて見つかる可能性が残る。局所規則が正しく見えても確認往復と根拠差替えが続き得る。
- 検証: 一つの固定候補へ全体Checker、全回帰試験および網羅率確認を実行し、同じ対象へ独立エージェント運用レビュー、文書監査、不足／影響・準拠影響監査を行う。各意味確認は4種類の代表例を再構成し、契約母集団と利用側母集団を確認する。
- 既知の制限: 代表例と固定前照合は収束性を高めるが、未知の利用側を必ず発見すること、意味判断の正しさ、曖昧な専門領域を全確認者が同じように解釈することは保証できない。適用される場合、人間の決定権限と独立した専門確認は引き続き必要である。

<a id="changelog-v0150-ja"></a>

### v0.15.0 — 外部コミュニケーションとコンテキスト依存（2026-08-10）

本リリースは、外部コミュニケーションを新しいプロダクト工程にせず、Git構造も固定せずに再利用できる二つの共通契約を追加する。外部コミュニケーションは、正本コンテキストを受け手別の主張、生成可能な表現、人間の公開判断、公開履歴、測定から得た学び候補へ接続する。コンテキスト依存は、別の正本が持つ意味の参照と、実行に使用する版付き成果物を区別し、採用版、ローカル上書き、利用側、更新影響、復旧を明示する。

v0.14.0からの変更:

- `17_Communication.md`を追加し、受け手、目的、主張と根拠、デザイン方針、公開判断、公開済み記録、測定、観察、仮説、学び候補の決定権限を定義した。
- 外部コミュニケーションを直列工程にしない。課題探索・要求形成、UX、IA、UI、品質保証、リリースは既存の決定権限を維持し、共有契約へ必要な情報を提供または利用する。
- 任意の入口`80_Communication/01_Communication.md`を追加した。外部コミュニケーションを扱わないRepositoryはフォルダを作らず、扱う場合もSEO、LP、プレゼンテーション、効果測定等の詳細は必要なときだけ分割する。
- 現在のコンテキストから生成できる外部向け投影と、実際に承認・公開した内容を保持する公開済み記録を分離した。後の投影で公開履歴を上書きしない。
- 主張を適用可能な根拠、条件、情報源改訂版、未確認範囲へ接続する。AIは下書き、比較、照合を支援できるが、公開、法務・商標判断、プライバシー・セキュリティ上の開示、ブランド判断、リスク受容を自己承認しない。
- 外部反応を、測定、観察、仮説、学び候補、人間判断の順で扱う。クリック率、転換、検索その他の反応をプロダクト上の事実または要求へ自動昇格しない。
- デザイン方針をUX、IA、UI、外部コミュニケーション間の共有整合契約とし、新工程または最終視覚仕様にはしない。外部公開のないプロダクトUI、プレゼンテーション、Web、文書でも使用でき、デザイン方針だけを理由に`80_Communication`を要求しない。
- `18_Context_Dependency.md`を追加し、意味を参照するコンテキスト依存と、版付き実行成果物を参照する成果物依存を分離した。完全契約はコンテキスト依存、採用組織の独立管理利用側間で意味・契約・採用版・更新判断の横断調整を必要とする成果物依存、および重大な品質・セキュリティ・プライバシー・法務・ライセンス・互換性・復旧リスクにより明示管理する成果物依存へ適用する。通常・推移依存はアーキテクチャ、パッケージ管理、lockfile、SBOM等を正本にできる。
- 同一Repository、別Repository、パッケージ、成果物レジストリ、Git参照、Submoduleを、ライフサイクル、決定権限、公開、アクセス、再利用、復旧から選ぶ実現候補とした。いずれも共通の継承方式として固定しない。
- 条件付きのプロダクトライフサイクル基準PL-17とPL-18を追加した。通常のパッケージまたは推移依存が存在するだけではPL-18を発火させない。外部コミュニケーションまたは管理対象依存が存在しない場合は理由付き`Not Applicable`を使用でき、空成果物、新しい準拠プロファイル、Manifest、安定コンテキストIDを要求しない。

採用への影響: 本変更は適用機能を限定できる破壊的変更である。既存基準版の採用には[移行完了の条件](19_Maintenance.md#621-migration-completeness)を適用する。すべてのプロダクトライフサイクル準拠表明で新しいPL-17とPL-18を評価するが、外部コミュニケーションまたは管理対象のプロジェクト固有依存がない場合は、成果物を作らず理由付き非適用を記録できる。通常・推移依存は既存の依存管理正本を示し、採用組織の独立管理利用側間で横断調整を必要とする依存または重大リスクへ達した依存だけを完全契約へ昇格する。いずれかを使用する場合は、影響する正本、AI入口、現在の公開／依存記録、検証義務、利用側影響を確認する。

移行注記（v0.14.0 → v0.15.0）:

- `migration_required: true`
- `change_classification: breaking`
- すべての既存基準版更新で必須: 基準版採用評価を行い、有効化前に移行完了の条件を満たす。初回採用には移行元がない。
- プロダクトライフサイクル準拠で必須: 表明対象範囲についてPL-17とPL-18を評価する。`Not Applicable`では理由と対象範囲を示し、フォルダがないことだけを理由にしない。
- 外部コミュニケーションを使用する場合に必須: 現在の入口、使用中の主張、生成物、公開済み成果物または記録、公開判断の境界、測定、学びの還流を棚卸しする。適用する場合だけ`80_Communication/01_Communication.md`を追加または更新し、完了済み公開履歴を形式合わせだけの理由で書き換えず現在記録へ接続する。
- コンテキスト依存または管理対象成果物依存を使用する場合に必須: 採用している依存元と版、ローカル上書き、利用側、更新手順、検証影響、移行、復旧、延期時リスクを棚卸しする。通常・推移依存は既存の依存管理正本を使用でき、採用組織が独立管理利用側間で意味・契約・採用版・更新判断を横断調整する必要がある場合か、重大リスクがある場合だけ完全契約へ昇格する。外部提供元とのAPI契約、別権限、独立リリースだけでは昇格させず、該当性を判定できない場合は確認待ちとする。CRDD基準版採用は保守、プロジェクト固有依存はコンテキスト依存を正本とする境界を維持する。
- 条件付きの自動化: 依存更新は、事前承認した対象、版範囲、検証条件、停止条件、結果記録、復旧方法の内側だけ、新しい人間判断なしで実行できる。範囲逸脱、検証失敗・確認不能、または重大な互換性、セキュリティ、プライバシー、ライセンス、利用側影響が生じた場合は人間判断へ戻す。
- 条件付き: 現行運用で主張／根拠、投影／公開、学び、依存、上書き、利用側、更新の境界を保持できない場合だけ、AI入口、作業手順、ひな型、品質成果物または変更トレースを更新する。
- 不要: 外部コミュニケーションを使用しないRepositoryへの`80_Communication`追加、全キャンペーンの別Repository化、Submodule、パッケージ、CMS、デザインツール、外部QAシステムの導入、新しい準拠プロファイル、安定コンテキストID、必須Manifest、媒体別固定ファイル一式、完了済み公開／依存判断の形式目的の書き換え。
- 復旧: 移行完了の条件と人間による有効化が終わるまで、現在有効なv0.14.0基準版と手順を維持する。部分適用を戻す場合はv0.14.0のAI入口とPL-01〜PL-16の評価範囲へ戻し、候補版で作成した公開／依存記録は履歴として保持し、採用プロジェクトが特定した以前の依存版または公開統制へ戻す。
- 延期時の既知リスク: 主張が根拠から切れたままになる、現在生成できる表現と実際に公開した内容を混同する、外部反応を人間判断なしに要求へ昇格する、依存版または上書きが曖昧になる、依存更新によって利用側または過去の検証結果が古くなる可能性がある。
- 検証: 固定候補へCRDDチェッカー全体を一度実行した後、エージェント運用の独立レビュー、文書監査、不足／影響と準拠影響の監査を実行する。代表ケースとして、非適用、軽量な単一入口、詳細成果物、公開履歴、市場学習、同一／別Repository依存、上書き、依存更新を確認する。
- 既知の制限: 本契約は、宣言されていない全公開成果物または暗黙依存を必ず発見したり、十分な根拠なしに主張を正しいと証明したり、法務、ブランド、プライバシー、セキュリティ、市場因果を判断したりはできない。結果は明示したシステム境界、利用可能な根拠、確認者の能力、人間の決定権限に依存する。

<a id="changelog-v0140-ja"></a>

### v0.14.0 — 収束する是正と根拠同一性（2026-08-10）

本リリースは、指摘事項を発見した後の是正を一度で収束させる力を強化する。元の指摘事項の意味を保持し、契約の網羅と利用側の網羅を分け、合否判定方法の存在と各利用側が実際にその結果どおり動いた根拠を区別する。固定後の根拠ではGitを標準の対象同一性として使う。必須の是正ファイル、Manifest、監査種別、承認段階、プロファイル、安定コンテキストID、外部QAツールは追加しない。

v0.13.0からの変更:

- 発行済みの指摘事項の識別子、対象、判定規則、確認事実、根本原因、当時の期待状態を履歴として保持する。是正対象が指摘事項を別の不備や根拠取得へ置き換えることを禁止する。
- 指摘事項が誤りまたは不完全だった場合は、訂正理由、正しい意味、影響する是正と根拠、再評価範囲、元の指摘事項との対応関係を、訂正または置換として別に残す。
- 結果を変え得る状態、入力、分岐、権限、失敗、保存等の契約母集団と、その契約を解釈、変換、保存、表示、送信、実行または検証する利用側母集団を分離する。
- 契約対象ごとに、該当する全利用側の是正、結果または理由付き非該当判定へ接続する。ファイル数の一致だけでは、どちらの母集団も網羅したとみなさない。
- 合否判定方法自体の整合性、参照用実行環境または検証器への適用、プロダクト実装への適用、各利用側の実行結果を分離する。正しい判定方法や参照用検証器だけでプロダクト挙動を証明しない。
- Gitのリポジトリ識別情報、Object Format、Commit OID、対象Path集合、期待gitlink OID、Observed HEAD、Root Tree、必要時のPathごとのObject、Index／Worktree差分、Submodule状態によって、宣言対象、実観測対象、実行対象を区別する。未コミット変更のないリポジトリ全体では、Object Format、Commit OID、Observed HEADとの一致、Root Tree OID、結果へ影響するdirty状態またはGit外入力がないことの確認を、最小限の対象同一性情報とする。
- 通常はCommit OIDを第一選択とする。Pathごとの対象同一性情報と追加Manifestは、部分集合、未Commit変更、Submodule、外部入力またはGit外成果物に限定し、使用時はByte列まで再導出可能な規則を持たせる。実観測対象を実行対象として扱う場合は、同じ実行の直前に観測し、結果生成まで不変であることを確認する。それ以外は実行前後の対象同一性情報を分けて記録する。
- 現在状態の意味を変える更新と、参照、OID、時刻、確認者等だけを加える記録更新を分離する。記録更新は、参照実在性、対象同一性、改変有無の軽量確認で終了し、新たな監査対象を再帰的に作らない。
- 同じ根本原因がレビュー、工程または利用側で再発する場合は、局所修正を重ねず、決定権限、共通契約、生成器、判定方法、利用側一覧または現在状態への投影へ戻る。
- 文書監査、不足／影響監査、プロダクトライフサイクル基準PL-16、エージェント型提供基準AD-21、公式／配布AI入口、概要、用語集、公開案内を同じ境界へ整合した。

採用影響: 本変更は非構造的な破壊的変更である。既存基準版の採用には[移行完了の条件](19_Maintenance.md#621-migration-completeness)を適用する。v0.13型の複数箇所是正を使うプロジェクトまたはエージェント型提供を表明するプロジェクトは、AD-21と指摘事項／是正手順を再評価する。CRDD品質保証を使うプロジェクトは、PL-16、固定後根拠の対象同一性、現在記録の終了、契約／利用側網羅、判定方法／利用側結果の分離を再評価する。過去の指摘事項と根拠を一括して書き換える必要はないが、進行中の指摘事項を別の意味へ流用せず、新しく生成する現在根拠には新しい同一性境界を適用する。

移行注記（v0.13.0 → v0.14.0）:

- `migration_required: true`
- `change_classification: breaking`
- すべての既存基準版更新で必須: 基準版採用評価を行い、有効化前に移行完了の条件を満たす。初回採用には移行元がない。
- AIが指摘事項を是正する場合、またはエージェント型提供を表明する場合に必須: AI入口または同等手順を確認し、指摘事項の意味保存、契約／利用側母集団の分離、是正の対応関係、再発時の構造是正を接続し、AD-21を再評価する。
- CRDD品質保証を使う場合に必須: 現行の固定後根拠手順と現在記録を確認し、該当時はGit中心の宣言対象／実観測対象／実行対象、判定方法と利用側実行根拠の分離、記録更新の終了確認を適用し、PL-16を再評価する。
- 条件付き: 進行中の是正または根拠ひな型が新しい境界を保持できない場合だけ更新する。完了済みの履歴記録は形式合わせだけを理由に書き換えない。
- 不要: 必須の解消パッケージファイル、未コミット変更のない通常のGit Commitに対する独自Manifest、新しい監査、承認段階、プロファイル、外部テスト管理システム、フォルダ、安定コンテキストID、完了済み履歴の一括書き換え。
- 復旧: 移行完了の条件と人間による有効化が終わるまで、現在有効なv0.13.0基準版と運用手順を維持する。部分適用を戻す場合はv0.13.0のAI入口と根拠手順へ戻し、v0.14.0候補で作成した履歴は削除せず候補記録として保持する。
- 延期時の既知リスク: 指摘事項の意味変更、利用側漏れ、合否判定方法の結果を利用側実行結果へ流用すること、宣言対象と実行対象の取り違え、現在記録の確認連鎖が終了しないことが残り得る。
- 検証: 固定候補へCRDDチェッカー全体を一度実行した後、エージェント運用の独立レビュー、文書監査、不足／影響と準拠影響の監査を実行する。チェッカーは決定論的な構造だけを補助し、指摘事項の意味、母集団の完全性、判定方法の正しさ、利用側挙動を決定しない。
- 既知の制限: 本規則は追跡可能性と収束性を改善するが、未知の利用側を発見したり、誤った判定方法を正しいと証明したりはできない。結果は明示されたシステム境界、確認者の能力、利用可能な根拠に依存する。

<a id="changelog-v0130-ja"></a>

### v0.13.0 — 複数箇所の是正適用（2026-08-08）

本リリースでは、合意した修正を親エージェントが再レビュー前にすべての影響箇所へ適用する手順を標準化する。監査の指摘自体は十分でも修正適用が一部に留まる問題を、新しい監査、承認段階、恒久的な是正成果物、安定コンテキストIDを増やさずに解消する。既存状態体系との混同を避けるため、処置進捗、阻害状態、解消判定の三つを補助的な正式用語として登録する。

v0.12.0からの変更:

- 既存の是正手順を、影響するすべての箇所へ適用できるようにした。一つの指摘、根本原因または合意済み方針が複数の記述、関係、正本、参照、ひな型、AI入口、ガイド、例示へ及ぶ場合、親エージェントは編集前に対象母集団を定める。
- 各対象を、修正、確認して変更不要、理由付き対象外、人間判断待ち、適用不能または確認不能として理由と再開条件を記録、のいずれかへ処置する。
- 監査またはレビューが示した根本原因、期待する状態、水平探索範囲を入力として使う。修正担当は意味監査を重複実行せず、曖昧さ、件数不一致、対象範囲の拡大を検出した場合は確認者または人間の決定権限者へ戻す。
- 有限で追跡可能な母集団に限って件数を示し、母集団の根拠と対象別処置を保持する。編集件数の一致またはチェッカー合格だけでは網羅的な是正を証明しない。
- 処置進捗（`Identified`、`Planned`、`Applied`、`Self-checked`）、阻害状態（`None`、`Blocked`）、解消判定（`Open`、`Resolved`）を分けた。曖昧な`fixed`を処置進捗または解消判定の値として使用しない。
- 契約母集団、観測可能な受入条件、合否判定方法、同じ固定改訂版の新しい根拠、独立再レビュー、現在状態への伝播、再発と新規指摘の処置を確認した場合だけ`Resolved`にできるようにした。
- 母集団を縮約する前に契約次元と組合せ制約を特定し、有限な場合は全論理組合せを把握するようにした。非有限または実用上巨大な空間では、選択方法、除外、未評価範囲、限界を残す。高リスク領域の縮約は独立レビュー対象とする。
- 固定前の契約・予定網羅範囲と、固定後の実行根拠・現在のレビュー／工程状態を分離した。固定後結果で固定本文を書き換えたり、自己参照Hashを作ったりしない。
- 新しい根拠の対象同一性と再現可能性を強化しつつ、機密、大容量、コマンドを使わない検証では、stdout／stderrの一律保存ではなく、保持しない理由と再識別方法を認めた。
- 任意チェッカーを拡張し、認識可能な是正表について、不正な状態値、根拠が揃う前の`Resolved`、阻害情報の不足を検出できるようにした。別の記録形式も引き続き使用でき、意味の妥当性はレビューで確認する。
- 再レビュー前のセルフチェックへ、旧表現、直接参照、派生物、想定外差分、機械確認、未完了事項の照合を追加した。
- 単一の明らかな局所修正は軽量に扱い、既存の文書監査、不足／影響監査、Agentic Delivery基準`AD-21`を再利用する。

採用への影響: 本変更は構造を変えない破壊的変更であり、既存基準版からの採用は[移行完了の条件](19_Maintenance.md#621-migration-completeness)の対象となる。AIがレビューまたは監査の指摘事項を修正するプロジェクト、またはAgentic Deliveryプロファイルを表明するプロジェクトは、親AI入口または同等の手順が複数箇所の是正対象を列挙し、再レビュー前に対象別の処置結果を照合することを確認する。CRDDの品質保証を使用するプロジェクトは、現在または今後生成する根拠と生成手順について`PL-16`を再評価する。既存のプロダクト成果物、フォルダ、安定コンテキストID、完了済みレビュー、過去の変更トレース、現在状態へ使わない過去根拠を一律に書き換える必要はない。

移行注記（v0.12.0 → v0.13.0）:

- `migration_required: true`
- `change_classification: breaking`
- すべての既存基準版更新で必須: 有効化前に基準版採用評価を行い、移行完了の条件を満たす。初回採用には移行元となる以前の基準版はない。
- AIがレビューまたは監査の指摘を修正する場合、またはAgentic Deliveryプロファイルを表明する場合は必須: AI入口、プロンプト、エージェント定義、スキルまたは同等手順を確認する。同等の契約単位の対象一覧、進捗／阻害／解消の分離、`Resolved`の根拠条件、対象別照合がない場合は追加し、`AD-21`を再評価する。
- CRDDの品質保証を使用する場合は必須: 固定本文と固定後の現在記録の分離、および現在へ使う根拠または今後生成する根拠の識別・再現情報を確認し、`PL-16`を再評価する。工程と品質保証の接続まで変わる場合だけ`PL-01`も再評価する。
- 条件付き: 保存済みの是正計画またはレビューテンプレートが、母集団の根拠、具体的な対象、処置、確認結果、未確認範囲を保持できない場合だけ更新する。
- 不要: 新しい監査種別、承認段階、恒久的な是正文書、専用ファイル、安定コンテキストID、すべての修正への専門家、完了済みで非アクティブな作業の書換え、本リリースだけを理由とする中核基準の再評価。
- 候補版の根拠: [変更トレース](90_Release/Changes/CHG-000007_Multi_Location_Remediation.md)は、実験基準コミット`cb510e6261fd44775d843c6e40fa7f737fb7a158`について人間から提供された適用先試行報告を保持する。試行は修正漏れと未評価範囲の発見には有効だったが、根本原因の再発も確認された。適用先のRaw Evidenceは本リポジトリから参照できないため、この報告は候補再開の根拠にはなるが、解消または定量効果を単独では証明しない。
- 検証: 改訂した候補へ、全体の機械確認、エージェント運用の独立レビュー、文書監査、不足／影響監査と準拠影響確認を再実行する。
- 既知制限: 本規則は早期完了と修正適用の漏れを減らせるが、確認者がすべての契約次元を発見したことまでは証明しない。効果は利用可能なコンテキスト、確認者の能力、根拠の品質、指示追従に依存する。

<a id="changelog-v0120-ja"></a>

### v0.12.0 — 着手前整合確認（2026-07-31）

本リリースは、非自明な変更の初回編集前に軽量な「着手前整合確認」を追加する。完成後のレビューで、正本コンテキスト、影響先、専門観点、用語、移行上の見落としが細切れに見つかる状況を減らすことが目的である。新しい監査、承認ゲート、恒久成果物、安定コンテキストID、必須サブエージェントは追加しない。

v0.11.4からの変更:

- 親エージェントは着手前整合確認の要否を判定し、必要な場合は初回編集前に変更計画を現在の正本コンテキストと照合する。
- 親エージェントによる軽量確認を基本とする。必要な専門観点を親だけでは確認できない場合、または複数正本、複数工程、決定権限、移行、重大リスクへ波及し得る場合だけ、不足する観点を読み取り専用の確認者へ委譲する。
- 確認者を選定した場合は、定義済みの停止、移送、重大リスクへの限定処置を除き、全確認結果と未評価範囲を一つの計画へ統合するまで編集を開始しない。
- `着手可`、`計画修正`、`判断待ち・停止`を、監査の`Pass`／`Fail`、承認、リスク受容、工程ゲート状態から分離する。
- 統合後の計画が、確認済みの対象範囲、意味、決定権限、依存関係、専門条件、変更分類、移行、リスク、保護する互換性境界を変える場合だけ、影響する確認者へ再提示する。合意済み修正の機械的な適用では計画確認を繰り返さない。
- 対話や読み取り専用分析で計画を具体化した後の`AssessGap`再評価として接続し、新しいSkill状態やライフサイクル工程を増やさない。
- 人間可読な名称、用語境界、専門説明を変更する場合の、主要ロケールを優先した表現確認を追加する。
- 公式・配布AI入口とエージェント型提供基準AD-02を揃え、完成後の独立レビュー、必要な監査、人間の決定権限は維持する。

採用への影響: 本リリースは構造を変えない規範変更である。既存のCRDD基準版からv0.12.0へ更新する採用プロジェクトは、[移行完了の条件](19_Maintenance.md#621-migration-completeness)の対象となる。対象範囲内の既存成果物、接続部、運用を棚卸しし、各資産の処遇を決め、必要な処置を着手待ちなく完了し、影響範囲に適した独立レビューで意味の欠損がないことを確認してから有効化する。該当するAI運用がない場合や対応なしで採用する場合も対象であり、棚卸しを根拠に据置または対象外の処遇を明示し、無確認の免除としない。初回採用は移行元の基準版がないため移行完了の条件の対象外だが、基準版採用評価と人間による有効化判断は必要である。既存のプロダクト成果物、フォルダ、安定コンテキストID、完了済み工程結果、過去の変更トレースを一括移行する必要はない。非自明な変更へAIを使用する、またはv0.12.0のエージェント型提供プロファイルを表明するプロジェクトは、AI入口または同等の作業手順が、初回編集前の要否判定と、適用した省略条件または実施結果を取得できることも確認する。

移行注記（v0.11.4 → v0.12.0）:

- `migration_required: true`
- `change_classification: normative`
- 既存基準版から更新する全採用先で必須: 基準版採用評価を行い、有効化前に移行完了の条件を満たす。対応なしまたは該当AI運用なしの場合も、対象資産の棚卸し、全資産の処遇、必要処置の完了、影響範囲に適した意味欠損確認の独立レビューを必要とする。
- 非自明な変更へAIを使用する、またはv0.12.0のエージェント型提供プロファイルを表明する場合に必須: AI入口、プロンプト、エージェント定義、スキルまたは同等の作業手順を確認する。同等の親エージェント確認がなければ着手前整合確認へ接続し、AD-02を再評価する。
- 条件付き: 保存する作業計画またはレビューひな型が、要否、省略条件と理由、確認観点、計画への反映、未評価範囲を記録できない場合だけ更新する。
- 不要: 新しい監査、承認ゲート、恒久計画書、全変更への専門家やサブエージェント、フォルダ、安定コンテキストIDの追加、完了済みで非活動の作業の書き換え。中核およびプロダクトライフサイクルの基準は変更していないため、採用プロジェクト自身の影響評価で別の依存影響が見つからない限り、本リリースだけを理由に再評価しない。
- 確認: CRDD全体Checkerでエラー0・警告0を確認した。エージェント運用の独立レビュー、文書監査、不足／影響および準拠影響確認は未解決指摘0件で合格した。
- 既知の限界: 本規則は防止可能な計画上の見落としを減らすが、一回のレビューですべての問題を検出することは保証しない。利用可能なコンテキスト、確認者の能力、モデルの指示追従に依存する。

<a id="changelog-v0114-ja"></a>

### v0.11.4 — gitlinkサブモジュール検証（2026-07-31）

このパッチは、親indexのgitlinkを確認せず、`.gitmodules`と入れ子のGitコマンドだけからサブモジュール状態を推定することで生じる、採用基準の誤エラーを修正する。CRDDの基準版採用、フォルダ、安定コンテキストID、準拠、移行の規則は変更しない。

v0.11.3からの変更:

- 親indexのstage情報を読み、通常のstage 0にあるmode `160000`の項目をgitlinkサブモジュール境界として認識する。競合中の項目は未確認のまま扱う。
- 採用基準`00_CRDD`について、`.gitmodules`宣言、index上のgitlinkとOID、worktreeの存在、Git directoryへのアクセス、HEAD取得、HEADとgitlink revisionの一致を別々の状態として返す。
- `00_CRDD`で実行したGitコマンドが親リポジトリではなく、そのworktree自身を解決したことを確認する。
- Gitを利用できる場合はGit自身の設定解析で`.gitmodules`を読み、ファイルシステムのパスはOSに合った大文字・小文字規則で比較する。
- `.gitmodules`を読めない場合またはGit設定の出力形式が不正な場合は、宣言欠落と断定せず未確認として扱う。
- すべてを未初期化へ丸めず、`baseline-gitlink-missing`、`baseline-submodule-not-initialized`、`baseline-submodule-unverified`、`baseline-submodule-revision-mismatch`、`.gitmodules`宣言欠落を区別する。
- 入れ子のGitリポジトリまたは`.gitmodules`記載だけを、サブモジュールの証明として扱わない。
- 他の未初期化gitlink境界へのリンクをプロジェクトの破損リンクとして報告せず、未確認対象として示し、初期化したサブモジュールrootからの直接確認を求める。
- ファイルシステムfallbackでは、読める`.git` markerだけから親indexのgitlinkやHEAD revisionを検証済みとしない。

採用への影響: 配布Checkerを使うリポジトリは、正確なgitlink・基準revision診断を得るためCheckerを更新できる。finding codeの完全一致で分岐する自動化は、分離した診断への対応を確認する。JSONの詳細診断には`baseline_submodule_state`を使用する。互換項目`baseline_submodule_initialized`は、worktree、Git directory、HEADを読めた場合に`true`、index上のgitlinkを確認できたがworktreeがない場合だけ`false`、非該当または未確認の場合は`null`となる。プロジェクト成果物、ID、フォルダ、CRDD準拠の変更は不要である。

移行注記（v0.11.3 → v0.11.4）:

- `migration_required: false`
- `change_classification: clarification`
- 必須: なし。
- 条件付き: CRDD基準または他のサブモジュールを自動確認する場合は任意Checkerを更新する。
- 不要: ファイル移動、サブモジュール構成変更、ID再採番、準拠表明変更、基準版有効化判断の変更。
- 検証: 回帰試験100件はすべて合格し、Checker本体は行・分岐ともに100%を網羅した。CRDD全体確認はError 0／Warning 0となった。
- 既知の制限: Git index modeまたはサブモジュールmetadataを読めない場合、Checkerは基準を未確認として報告し、ファイルシステムmarkerから検証済み状態を推定しない。

<a id="changelog-v0113-ja"></a>

### v0.11.3 — 階層構造に対するChecker互換性（2026-07-30）

このパッチは、任意Checkerがリポジトリ固有の階層構造を確認するときに、正当な変更関連ファイルを誤配置として報告する不具合を修正する。CRDDの変更トレース正本配置、ID名前空間、準拠基準、移行要否は変更しない。

v0.11.2からの変更:

- リポジトリの深さにかかわらずMarkdownを再帰検査する既存挙動を維持し、深い階層の回帰試験を追加した。
- 製品台帳や設定ファイルを追加せず、`90_Release`配下の任意階層にある`Changes/`以下の`CHG-*.md`を、リポジトリ固有の配置として機械確認できる。
- `Changes/`階層外にある`CHG-*.md`の変更トレース候補は引き続き誤配置として報告する。ただし、`Evidence/`配下の関連ファイルはファイル名だけで変更トレースと判定しない。
- 任意の`Evidence/`配下にあるファイルは、関連CHGをファイル名やメタデータに含むだけで変更トレースと誤認しない。
- 標準の変更トレース見出しと宣言IDを併せ持つ本文を`Evidence/`へ誤配置した場合は検出する。
- 安定コンテキストIDのリポジトリ全体一意性と、基本フォルダ必須の規則は変更しない。

採用への影響: 配布Checkerを使うリポジトリはCheckerを更新し、誤検知回避のローカル処置を除去できる。Checkerを使わないリポジトリには影響しない。

移行注記（v0.11.2 → v0.11.3）:

- `migration_required: false`
- `change_classification: clarification`
- 必須: なし。
- 条件付き: 配布Checkerを使うリポジトリは、誤配置の偽陽性を解消するため更新できる。
- 不要: ファイル移動、ID再採番、設定追加、準拠表明の変更、安定コンテキストIDの変更。
- 検証: Checker回帰試験83件はすべて合格し、Checker本体は行1,537 / 1,537、分岐291 / 291を網羅した。全体確認はCRDDでError 0／Warning 0、Qual Suiteの全292 MarkdownでError 0となった。修正版に対する独立文書監査と不足／影響監査は合格した。準拠基準を変更しないため準拠監査は選択せず、独立した準拠影響の再確認によってこの境界を確認した。
- 既知の制限: Checkerが機械確認のためにパスを受け入れることは、そのリポジトリ固有配置をCRDDの正本配置または準拠判断にするものではない。

<a id="changelog-v0112-ja"></a>

### v0.11.2 — 初回レビュー・監査の網羅性（2026-07-29）

このパッチは、既存の問題が是正と再確認のたびに小出しになる状態を減らすため、独立レビューと監査の初回確認の網羅性を強化する。再レビューや安全上の停止を廃止せず、一回ですべての問題を発見できるとは表明しない。

v0.11.1からの変更:

- 安全、決定権限、アクセスその他の停止条件によって直ちに上位判断へ移送する必要がある場合を除き、独立確認者が適用する確認観点を特定し、指摘事項を確定する前に初回の一次走査を完了することを要求した。
- 候補収集と指摘事項の確定を分離した。適用観点を横断して候補を集め、同じ原因が及び得る構造、参照、ひな型、AI入口、並行責務を水平探索し、重複と共通原因を整理してから一つの報告として返す。
- 適用した確認観点、確認済み／未評価範囲、水平探索の範囲と結果、サンプリングを使用した場合の母集団、選択方法、限界を取得可能にした。
- 早い段階で重大な指摘を見つけても、残る適用観点を暗黙に未評価のまま終了しないようにした。未評価範囲を明示せず`Pass`として扱えない。
- 親エージェントまたは是正担当が、合意した修正の全数適用とセルフチェックを確認してから、更新した改訂版を再レビューへ渡すようにした。
- 再レビューで見つけた新規候補を、「今回の修正によって新たに発生した」「今回の修正によって初めて確認可能になった」「承認された対象範囲の拡大によって確認対象になった」「初回レビュー／監査時から存在したが見落としていた」のいずれかへ分類する。初回の見落としを修正の副作用として扱わない。
- 再レビューを、既存指摘の解消、修正の副作用、影響を受ける関係、明らかな初回見落としへ集中させ、各往復で無関係な改善を無制限に追加しない。
- エージェント型提供プロファイルへAD-21を追加し、公式・配布AI入口へ同じ挙動を接続した。文書監査、準拠監査、不足／影響監査は新しい監査種別を作らず、共通契約を各手順と完了根拠から参照する。

適用への影響: 規範的だが構造変更ではない。既存のプロダクト成果物、フォルダ、安定コンテキストID、スキーマの移行は不要である。CRDDのレビュー／監査エージェントを使うプロジェクトは、v0.11.2のエージェント型提供プロファイルを表明する前にAI向け指示を更新する。

移行注記（v0.11.1 → v0.11.2）:

- `migration_required: true`（エージェント型提供プロファイル）。プロダクト成果物やフォルダの移行は不要。
- `change_classification: normative`
- 必須: レビュー／監査のプロンプト、エージェント定義、スキルまたは同等の指示を更新し、初回に適用観点を走査し、確認範囲を記録し、境界のある水平探索を行い、再レビューの新規候補を分類できるようにする。
- 条件付き: 保存する監査報告ひな型が、確認済み／未評価範囲、水平探索、サンプリングの限界、再レビュー分類を記録できない場合だけ更新する。
- 不要: 監査種別、恒久的な監査報告ファイル、承認段階の追加、完了済みで非活動の監査履歴の書き換え、フォルダ名変更、安定コンテキストIDの追加。
- 確認: 基準版採用評価に従って採用側が実際に使用するレビュー／監査経路を棚卸しし、今回の指示更新の影響を受ける経路を固定改訂版へ実行する。複数経路を使う場合は同じ固定改訂版を渡し、この移行のためだけに未使用の監査を追加しない。各初回報告が是正開始前に適用観点と確認範囲を示すことを確認し、必要な経路では修正済み改訂版を再レビューして、新しい候補があれば分類する。
- 既知の限界: モデル能力、取得できない根拠、修正後に初めて現れる相互作用によって、追加の往復が必要になる場合はある。本規則は初回確認の規律を改善するものであり、問題が存在しないことを数学的に保証しない。

<a id="changelog-v0111-ja"></a>

### v0.11.1 — GitHubアンカーチェッカー互換性修正（2026-07-29）

本パッチは、任意の参照チェッカーによるGitHub Markdown見出しアンカー検証を修正する。CRDDの規範、工程、成果物、フォルダ、安定コンテキストID、決定権限、監査、準拠基準は変更しない。

v0.11.0からの変更:

- 日本語等のUnicode文字、結合文字、数字は維持し、全角を含む句読点と記号を生成アンカーから除去する。
- GitHubの生成順序で生じる連続ハイフンと先頭・末尾ハイフンを圧縮または除去せず、そのまま維持する。
- 対応する単純・非入れ子のインラインコード、リンク、画像、強調、取消線から表示文字を取得してアンカーを生成する。この軽量チェッカーは完全なGFMインライン解析器ではなく、HTMLコメント、入れ子のリンク／画像ラベルやリンク先、複雑に交差・入れ子になる区切りの正確な判定は保証しない。
- 重複見出しの接尾辞を、それ以前に生成した全見出しアンカーとの衝突を避けて採番する。`Foo`、`Foo-1`、`Foo`の順なら、`foo`、`foo-1`、`foo-2`となる。
- 日本語句読点、連続スペース、先頭絵文字の除去、装飾付き見出し、重複接尾辞の衝突に対する回帰試験を追加する。
- チェッカーはNode.js標準ライブラリだけで動作し、任意利用のままとする。合格しても意味レビューを代替せず、CRDD準拠を証明しない。
- 参照チェッカーの品質記録 — 対象改訂版: 本項目が示すv0.11.1リリース候補。測定対象: `template/tools/crdd_check.mjs`。環境とコマンド: Windows上のNode.js v22.18.0組み込みV8カバレッジ、`node --test --experimental-test-coverage --test-reporter=lcov tools/crdd_check.test.mjs`。
- 結果: 75件の試験に合格した。行網羅率は1,475 / 1,475（100%）、分岐網羅率は280 / 280（100%）だった。チェッカーのソース行または分岐を測定分母から除外していない。

採用への影響: GitHub互換のMarkdownアンカー検証を利用する場合だけ、配布チェッカーを差し替える。プロダクト成果物またはリポジトリの移行は不要である。

移行注記（v0.11.0 → v0.11.1）:

- `migration_required: false`
- `change_classification: clarification`
- 必須: CRDD成果物、フォルダ構成、安定コンテキストID、スキーマ、AI入口、準拠表明に対する作業はない。
- 条件付き: プロジェクトがMarkdownアンカーの指摘を利用する場合は、`template/tools/crdd_check.mjs`または採用済みのコピーを更新する。
- 対象外: 製品別の`90_Release/<product>/Changes/`配置と変更IDの名前空間は導入しない。v0.10.0で定めた`07_Workflows`から`19_Workflows`への移行も変更しない。
- 検証: チェッカーの回帰試験とリポジトリ全体の機械確認を実行し、固定改訂版に対する独立レビュー、文書監査、不足／影響監査を行う。

<a id="changelog-v0110-ja"></a>

### v0.11.0 — 人間判断提示・監査指摘統合（2026-07-28）

本リリースは、既存の判断支援契約と複数監査の統合契約を強化する。新しい工程、成果物、安定コンテキストID、監査種類、競合する正本は追加しない。

v0.10.0からの変更:

- 人間への最初の判断表示を、今回決めること、AIの推奨、なぜ今必要か、利用者・業務・プロダクト・計画・費用・リスクへの変化、推奨の主な短所、保留または不採用時に残る問題の順で示す。
- 変更トレース参照、監査名、指摘事項ID、対象改訂版、影響する正本、再開工程、再監査詳細を追跡可能に保ちつつ、最初の判断表示の中心にしない。
- 段階的な情報開示によって、安全性、セキュリティ、プライバシー、法務、不可逆性、強い不確実性、残存リスク、決定権限の競合を隠すことを禁止する。
- 単純なYes／No確認を、実質的に二値で、主な短所と不採用時の影響を説明済みの判断へ限定する。条件付き推奨や別々に採否できる事項は分離する。
- 親エージェントが、監査、レビュー、変更トレース上の事項を、AIが一意に修正できる事項、人間による判断が必要な事項、報告のみの事項へ分類してから人間へ提示する。
- 同じ根本原因、決定権限者、判断時点、不可分な採否を持つ指摘だけを一つの人間判断へ統合できるようにする。判断から元の全指摘事項と影響する成果物への関係は保持する。
- エージェント型提供プロファイルの準拠基準AD-17／AD-20、公式・配布AI入口、人間向け公開案内へ同じ挙動を伝播し、判断支援の正本は増やさない。
- 任意の参照チェッカーを修正し、CRDD公式リポジトリ自身の変更トレースをルートの`90_Release/Changes/`へ、配布ひな型の変更トレースを`template/90_Release/Changes/`へ置けるようにする。採用リポジトリは従来どおりルートの`90_Release/Changes/`を使用する。
- 参照チェッカーの品質記録 — 対象改訂版: 本項目が示すv0.11.0リリース候補。測定対象: `template/tools/crdd_check.mjs`。環境とコマンド: Windows上のNode.js v22.18.0組み込みV8カバレッジ、`node --test --experimental-test-coverage --test-reporter=lcov tools/crdd_check.test.mjs`。
- 結果: 69件の試験に合格した。行網羅率は1,277 / 1,277（100%）、分岐網羅率は201 / 201（100%）だった。5回連続で同じ結果を再現した。測定分母から除外したソース、行、分岐はない。

採用への影響: 本リリースは構造を変えない規範変更である。既存のプロダクト成果物、フォルダ構成、安定コンテキストID、スキーマを一括して書き換える必要はない。採用プロジェクトは、今後の人間判断、特にCHG作業、レビューまたは統合監査から生じる判断へ新しい提示・統合規則を適用できるよう、AI入口、プロンプト、スキルまたは同等の運用指示を更新する。

移行注記（v0.10.0 → v0.11.0）:

- `migration_required: true`
- `change_classification: normative`
- 必須: 人間判断を提示する、またはレビュー／監査指摘を転送するAI向け指示を更新する。AIが一意に修正できる事項を人間へ転嫁せず、別々に採否できる判断を束ねず、CRDD実行詳細を判断要約から追跡できるようにする。
- 条件付き: 指摘事項を一件ずつ提示する、CRDD内部情報から説明を始める、説明のない専門的選択肢を示す、または非二値の判断をYes／Noへ縮約する、再利用可能なプロンプト、エージェント定義、スキル、作業手順だけを改訂する。
- 不要: プロジェクトフォルダの改名・移動、既存の正本プロダクト成果物の一括書換え、新しい安定コンテキストIDの発行、新しい判断成果物の導入、本リリースだけを理由とする完了済み・非活動監査の再実行。
- 検証: CHG、単独レビュー、統合監査から生じる代表的な人間判断を確認し、初期表示が影響中心であること、元の指摘事項へ追跡できること、重大情報が隠れていないことを確認する。v0.11.0に対するエージェント型提供プロファイル準拠表明の前にAD-17／AD-20を再評価する。
- 延期時の既知リスク: フロントAIが監査情報やリポジトリ内部情報を人間判断と同じ粒度で提示し続け、認知負荷が高まり、十分に理解されない判断、抱き合わせ判断、不要な判断転嫁を招く可能性がある。

<a id="changelog-v0100-ja"></a>

### v0.10.0 — v1.0前構造整理・人間向け案内・機械確認（2026-07-27）

**このリリースは破壊的変更を含む。** v1.0前に、工程横断の品質保証成果物とリポジトリ固有作業手順の配置を確定し、AIが選択する変更経路を人間から確認可能にした。全正式用語を保持したまま読取り分類を追加し、任意の決定論的チェッカーを追加した。v0.9.0のひな型パスを使用するプロジェクトでは移行が必要である。

v0.9.0からの変更:

- 品質保証の固定フォルダを`08_Quality`から`07_Quality`へ変更した。Quality Center、品質戦略、検証設計、確定済み検証結果の責務は変えず、品質保証を実装後の工程として扱うことなく、任意の運用領域より前へ配置した。
- `07_Workflows`を`19_Workflows`へ変更した。リポジトリ固有の反復可能な作業手順は、プロダクトコンテキスト、変更トレース、リリース記録、エージェント、スキルから分離したままとする。`08`〜`18`は将来の工程横断成果物または共通運用領域のために予約し、標準ひな型では作成しない。
- 正本文書、準拠基準PL-16、工程ひな型、配布用AI入口、例、現在の公開案内を`07_Quality`と`19_Workflows`へ追従させた。過去のCHANGELOGは各リリースで使用したパスを維持する。
- `02_Terminology.md`の正式用語と定義を一つも削除せず、中核概念、補助概念、表示／派生概念の読取り分類を追加した。分類は人間とAIが読む順序を選ぶためのものであり、補助用語の正式性や意味を弱めない。
- `00_Overview.md`へ人間向けの変更経路判断表を追加した。よくある変更種類から、影響工程、独立レビュー、文書監査、準拠監査、不足／影響監査、基準版採用、検証、人間のリリース決定権限へ接続する。新しい決定権限は作らない。
- `10_Agent.md`、準拠基準AD-02、ルートと配布用の`AGENTS.md`を更新し、AIが変更分類、影響または再開する工程と共通責務、実行する独立レビューと監査、実行しない主な監査と理由、残る人間判断を示すようにした。
- READMEへ日英の「人間が知っておくこと」を追加した。人間は五つの責務と小さな入力契約から開始でき、AIは正本コンテキストの選択、代替案比較、検証義務の維持、確認可能な経路の提示を担当できる。
- Node.js標準ライブラリだけで動作し、外部パッケージを必要としない参照実装`template/tools/crdd_check.mjs`を追加し、採用プロジェクトへひな型と一緒に配布する。リポジトリ全体の確認を既定とし、明示的な`--scope`では全体不変条件を維持しながら直接のMarkdown参照へ範囲を広げ、未確認範囲を表示する。Gitを利用できる場合は追跡対象と無視されていない未追跡ファイルを確認対象とし、除外範囲と未実施項目を表示する。不正な対象やオプションを成功扱いせず、対象リポジトリ外のリンク先を読み取らない。`00_CRDD/`が採用済み基準のサブモジュールである場合は、適用先から基準文書へのリンクとアンカーを確認しながら、基準文書内部の全ファイルを適用先の所有ファイル集合へ混在させず、除外した内部範囲を未確認として表示する。実行時点と確認件数をサマリーへ出力し、参照関係表示によってAIが意味確認の読取り対象を絞れるようにした。安定コンテキストIDを含むファイル名、明示されたID定義の重複、変更トレースの配置、および数値が記載された分岐網羅率の分母・分子・割合も決定論的に確認する。独立レビューまたは監査集合の前に、親AIが固定した対象改訂版へ一度実行して結果を共有し、結果がない、失効している、不足している、または対象範囲が異なる場合を除き、各確認者は同じ機械確認を繰り返さない。ルートの`tools/crdd_check.mjs`はCRDD標準保守時に配布実装を呼び出す。ツールの合格は意味レビューまたはCRDD監査を代替せず、配布実装の利用を準拠条件にしない。
- チェッカーがファイル探索、リンク／アンカー確認、範囲指定、参照関係表示、正本文書確認、構造確認でシンボリックリンクまたはジャンクションをたどらないようにした。実物のGitサブモジュールを使う統合試験を追加し、未初期化の`00_CRDD`サブモジュールを適用先確認の成功として扱わない。
- 新しい工程、安定コンテキストID種別、必須ツール、監査、承認段階、正本成果物は追加していない。フォルダ番号はウォーターフォールまたは決定権限の優先度を表さない。

移行注記（v0.9.0 → v0.10.0）:

- 分類／移行要否: `change_classification: breaking`、`migration_required: true`。
- 必須: `08_Quality/`を`07_Quality/`へ、`07_Workflows/`を`19_Workflows/`へ移動する。プロジェクト所有の参照、AI入口、作業手順、品質保証参照、スクリプト、外部リンクを更新する。`08`〜`18`をCRDD標準フォルダとして作成しない。リンクとアンカーを確認する。v0.10.0への`Conformant`表明前にC-02とPL-16を、エージェント型提供プロファイルを使用する場合はAD-01とAD-02も再評価する。
- 条件付き: 旧フォルダを参照する場合だけ、生成表示、CI設定、指示文、外部ツールのパスを更新する。移動するフォルダ内の既存内容と履歴は保持し、品質保証または作業手順の意味を書き直す必要はない。
- 対象外: 新しい品質保証正本、作業フロー状態モデル、安定コンテキストID、必須Python実行環境、第三の承認、全監査の一律実行は導入しない。
- 検証: `node tools/crdd_check.mjs`または同等の決定論的確認を行う。現在参照、フォルダ、版、用語分類、README、AI入口、ひな型について文書監査を行う。採用側の移行と成果物横断パス影響について不足／影響監査を行う。v0.10.0の準拠を表明する場合は影響する基準を準拠監査する。
  - 参照チェッカーの品質記録 — 対象改訂版: 本項目が示すv0.10.0リリース候補。測定対象: `template/tools/crdd_check.mjs`。環境とコマンド: Windows上のNode.js v22.18.0組み込みV8カバレッジ、`node --test --experimental-test-coverage --test-reporter=lcov tools/crdd_check.test.mjs`。
  - 結果: 68件の試験に合格した。行網羅率は1,274 / 1,274（100%）、分岐網羅率は199 / 199（100%）だった。測定分母から除外したソース、行、分岐はない。
  - 試験設計: 通常の試験用リポジトリで、対応する配置方式と出力経路を確認する。試験専用のNode.js事前読込により、ファイルシステム上の競合、メタデータ障害、特殊ファイル、Git探索失敗、安全でないGitファイル一覧を子プロセス境界へ注入する。フォールバック探索中にフォルダが消失、型変更、リンク化、置換または読取不能となった場合は、対象パスをエラーと未確認範囲の両方へ記録し、空の確認結果を成功へ変換しない。配布用チェッカーはこの注入器を読み込まず、試験専用の実行時切替や外部パッケージ依存を持たない。
  - 残る範囲と再評価: 構造的な網羅率100%は、意味上の正しさまたは全OS実装を単独で証明しない。実物のGitサブモジュールとWindowsジャンクションを使う統合試験で障害注入を補い、リリース前の独立した文書監査、準拠監査、不足／影響監査を引き続き必要とする。チェッカー、Git探索、ファイルシステム境界、出力契約、対応Node.js、対応OSを変更した後は、全試験と網羅率測定を再実行する。
- 切戻し／復旧: 両フォルダと影響参照の移行、および移行完了の条件を満たすまでv0.9.0を有効な基準版として維持する。
- 延期時の既知リスク: 品質保証成果物または作業手順を発見できず、AIが旧パスへ書き込み、v0.9.0構造のままv0.10.0への準拠を表明する可能性がある。

---

<a id="changelog-v090-ja"></a>

### v0.9.0 — 専門品質確認・工程横断品質保証・工程固定入口（2026-07-27）

**本リリースは破壊的変更を含む。** 工程移行へ専門品質確認を追加し、工程横断の品質保証成果物モデルを導入するとともに、課題探索・要求形成からアーキテクチャおよび品質保証までの入口構造を固定する。これらの工程、工程移行、またはプロダクトライフサイクルプロファイルを使用する採用プロジェクトでは移行が必要である。

v0.8.0からの変更:

- 専門品質確認（Specialist Quality Review）を`agent.phase_transition.review`の構成要素として追加した。評価基準には送信工程または対象となる共有契約が所有する網羅範囲と監査チェックリストを使用し、新しい工程、監査、承認段階、正本は作らない。
- 工程移行は、独立した工程移行レビューと、責任を持つ人間による判断の二段階のままとした。専門品質確認は独立レビューに含まれるため、三段階目の承認は追加しない。
- 一人の独立した確認者が契約と必要な専門観点を評価でき、その根拠を説明できるなら、一人でまとめて確認できる。不足する観点だけを別のサブエージェント、作成時コンテキストを引き継がない新しいセッション／エージェント、または人間確認者へ委譲する。固定人数、恒久的な専門エージェント、役職、モデル、ツールを要求しない。
- 必要な専門観点、担当確認者、評価能力の根拠、使用基準、参照した成果物または根拠、評価結果、未評価範囲を取得可能にする。参照可能な実績で示す関連知識・経験、対象へ適用した評価方法、権威ある参照基準を適切に適用できること、比較可能な過去評価等を能力根拠にできる。役割名、エージェント名、モデル名、ツール名、単なる自己申告、使用基準または対象成果物の再列挙だけを専門性の根拠としない。
- 必要な専門観点が未評価のまま通常の`Pass`とすることを禁止した。人間の決定権限者は既存の`review_exception`で移行を指示できるが、これは`Pass`とは区別し、未評価範囲、リスク、担当責任者、再レビュー条件を残す。
- 課題探索・要求形成から検証までの全工程契約と、UI／振る舞い仕様の共有契約へ接続した。専門基準は各工程文書と共有契約が引き続き所有し、共通チェックリストへ複製しない。共有契約のレビューはUIまたは振る舞い仕様の個別工程レビューを代替せず、個別工程レビューも共有契約のレビューを代替しない。
- 共通スキル引き渡し契約、公式リポジトリ接続部（`AGENTS.md`、`CLAUDE.md`、`.github/copilot-instructions.md`）、配布接続部（`template/AGENTS.md`、`template/CLAUDE.md`、`template/.github/copilot-instructions.md`）を更新し、既存のレビュー／引き渡し経路で専門観点の網羅を保持するようにした。
- 準拠基準PL-05、PL-06、AD-04、AD-16を拡張した。文書監査は専門レビュー記録を取得できるか確認するが、工程固有の専門品質を判定しない。不足／影響監査は工程または共有契約の境界で専門責務が脱落していないか確認するが、専門品質確認を代替しない。
- `02_Terminology.md`へ専門品質確認、品質戦略、検証義務、検証意図、検証設計、検証項目、検証手順、検証結果要約、現在の品質状態、Quality Centerを追加した。条件、確認理由、方法、履歴、現在状態、横断表示の責務を分離し、工程移行レビュー全体、専門家承認、文書監査との境界も明示した。
- `16_Quality_Assurance.md`を追加し、品質戦略、各工程が所有する検証義務、検証設計、検証項目、不変な検証結果、現在の品質状態、人間向けQuality Centerの共通契約を定義した。検証をテストケースに限定せず、専門家レビュー、計測、分析、ユーザビリティ評価、視覚品質レビュー、アクセシビリティ監査等を検証項目として扱える。
- `08_Quality/Quality_Center.md`、`Quality_Strategy.md`、`Verification_Design.md`、`Verification_Results/`の固定構成を追加した。適用の深さではファイル分割を変えず、記述、レビュー、根拠の深さを変える。検証義務は所有工程の正本へ、保存する根拠はリポジトリ内の最も近い所有成果物へ残す。保存しない生の出力には、リポジトリ内の要約と再現契約を残す。
- 課題探索・要求形成からアーキテクチャまでの各工程へ、各工程フォルダ内の`01_Product_Discovery.md`、`01_User_Experience.md`、`01_Information_Architecture.md`、`01_User_Interface.md`、`01_Behavior_Specification.md`、`01_Architecture.md`という固定入口を追加した。適用の深さでは入口名や基本のファイル分割を変えず、本文、レビュー、根拠、詳細参照の深さを変える。固定入口はリンクだけの索引ではなく、工程全体の主要正本兼探索入口として、対象範囲、網羅状態、主要な結論と判断、検証義務、未解決事項、次工程への義務を直接保持する。詳細な正本成果物は内容を複製せず参照する。
- 品質戦略、工程が所有する検証義務、検証設計、検証項目、検証結果、現在の品質状態、Quality Centerを接続する、ツール非依存の論理記録契約を追加した。リポジトリ内のパス、アンカー、コミット、成果物内の局所参照を使用する。局所キーは、複数成果物または複数結果からの反復参照が不安定になる場合だけ使用し、`VO-*`、`VI-*`、`VR-*`等の新しい安定コンテキストID、固定YAMLスキーマ、中央採番登録簿は追加しない。
- QAをCRDDリポジトリ内で運用可能にした。CI、計測基盤、テスト実行ツールを使用しても、品質状態、判断理由、未検証範囲、残存リスク、再現方法はリポジトリ内の成果物から理解できるようにする。外部リンクまたは実行IDは補助情報であり、唯一の品質保証記録または外部QA正本にしない。
- 単体試験が適用される場合の分岐網羅率`100%`を既定目標とした。未達または除外がある場合は、測定対象、分母、分子、実測値、具体的理由、残るリスク、代替確認、担当責任者、必要な人間判断、再確認条件を示す。`100%`という値だけで品質またはリリース準備完了とは判定しない。
- Quality Centerへ、現在対象、結論、利用者・運用への影響、計画対実績、分母、分子、割合、差異理由、検証項目へ未対応の義務、必須だが未計画の専門品質確認、重大な不成立、残存リスク、正本参照を求める。不成立、停止、要再確認の対象には、理由、影響、担当責任者、解除または再検証条件も示す。割合だけで品質またはリリースを判断しない。
- 検証項目結果と検証義務の評価を分離した。判断、工程移行またはリリースに使用した確定済み結果は変更せず、追加実行では関係を持つ新しい結果を作る。現在の品質状態は派生表示とし、適用不能になった結果を履歴変更なしに`Stale`として扱う。
- プロダクトライフサイクル基準PL-16を追加し、各工程の必要な責務の網羅、工程移行の判定基準、工程監査チェックリスト、および変更、進捗、リリース、エージェントレビュー、文書監査、不足／影響監査へ品質保証モデルを接続した。
- 安定コンテキストIDの種類、工程順、人間の決定権限は変更しない。品質保証成果物内の局所参照またはツール実行IDをCRDD安定コンテキストIDにしない。

採用側への影響: v0.8.0から更新するプロジェクトは、今後の工程移行レビューが契約確認と専門品質確認の両方を含むように、レビュー用の指示、エージェント／スキル定義、引き渡し記録を更新する。課題探索・要求形成からアーキテクチャまでで適用する工程には、既に正本である詳細を複製せず、固定入口を追加または対応づける。進行中、新規、再開、実質的に改訂した工程移行、および新しい工程移行の入力として再利用する対象範囲へ適用する。完了済みで再利用しない休止対象範囲を一括再レビューする必要はない。

移行注記（v0.8.0 → v0.9.0）:

- 分類／移行要否: `change_classification: breaking`、`migration_required: true`。
- 必須: 既存の工程移行レビュー経路を更新し、対象範囲へ適用する専門観点を特定する。各観点を評価できる確認者を割り当て、評価能力の根拠、使用基準、参照した成果物または根拠、評価結果、未評価範囲を残す。能力根拠を説明できない観点は未評価として扱う。UI／振る舞い仕様の対象範囲では、各工程と共有契約を別々に評価する。指摘事項を是正し、更新改訂版を再レビューしてから人間の承認へ進む。適用する課題探索・要求形成からアーキテクチャまでの各工程へ固定入口を追加し、詳細な正本内容を重複させずに接続する。固定した`08_Quality`構造を追加し、各工程が所有する検証義務を検証設計とスキル引き渡しへ接続し、確定済み検証結果を履歴として保持し、Quality Centerで計画対実績、件数、割合、分母、差異理由を確認可能にする。単体試験が適用される場合は分岐網羅率`100%`を既定目標とし、未達または除外の完全な例外記録を残す。v0.9.0への`Conformant`表明前にPL-01、PL-02、PL-05、PL-06、PL-16、AD-04、AD-16を再評価する。
- 条件付き: 一人の独立した確認者がすべての適用観点を扱えない場合だけ、追加の確認者を使用する。進行中、今後、再開、実質的に改訂、または再利用する工程対象範囲へ新契約を適用する。完了済みで休止中の対象範囲は、新しい判断や工程移行の入力にしない限り遡及レビューを要しない。
- 対象外: 三段階目の承認、固定チーム、恒久的な専門エージェント、必須の品質保証ツール、新しい安定コンテキストID種類、割合による自動リリース判断は追加しない。
- 確認: 用語、リンク、接続部、工程の固定入口、品質保証成果物の責務境界、レビュー項目の取得可能性を文書監査で確認する。PL-01、PL-02、PL-05、PL-06、PL-16、AD-04、AD-16を準拠監査で確認する。全工程契約、UI／振る舞い仕様の共有契約、工程所有の検証義務、検証設計、現在の品質状態、Quality Centerへの伝播を不足／影響監査で確認する。代表的な工程移行記録と品質保証記録を用い、未評価の専門観点、評価能力の根拠がない観点、検証項目へ未対応の義務、必須だが未計画の専門品質確認がある状態で、通常の`Pass`または誤解を招く品質100%表示にならないことを確認する。
- 切戻し／回復: レビュー経路と該当接続部の更新、および移行完了の条件を満たすまでv0.8.0を有効な基準版として維持する。
- 延期した場合の既知リスク: 契約欄だけが揃った状態で工程を通過し、専門的な誤り、浅い分析、後工程で利用できない設計判断が後から判明する。

---

<a id="changelog-v080-ja"></a>

### v0.8.0 — 未完了作業の登録簿と進捗管理（2026-07-26）

**本リリースは破壊的変更を含む。** `99_Roadmap`の位置付けを再定義し、単一のロードマップ状態を2つの軸へ分離し、未完了事項の登録義務を課題探索・要求形成、変更、検証、保守、文書監査、準拠監査、不足／影響監査へ追加する。あわせて、開発方式に依存しない進捗管理モデルを定義する新規正本文書`15_Progress.md`と、プロダクトライフサイクルプロファイルの準拠基準3件を追加し、`01_Principles.md`へ未完了事項の後続追跡の不変条件、`28_Implementation.md`の工程入口契約、`10_Agent.md`のエージェント実行境界を変更する。移行は任意ではなく必須であり、詳細は本節末尾の移行注記に従う。

v0.7.0からの変更:

- `99_Roadmap`を、採用済みで着手を延期した作業の台帳から、プロダクトに残っている未完了の価値、課題、要望、アイデア、変更候補、是正事項を横断して確認できる未完了作業の登録簿（Open Work Registry）へ再定義した。`21_Discovery.md`§6をこの位置付けで書き直し、§6.1（責務の境界と登録簿の位置付け）、§6.2（登録簿が扱う対象と登録義務）、§6.3（判断状態と対応状態）、§6.4（ロードマップ項目の記録契約）、§6.5（経路と移行規則）、§6.6（状態遷移と発動）、§6.7（目的別の投影）、§6.8（完了項目の除去と終了処理）に整理した。登録簿は索引であり第二の正本ではない。項目の意味、根拠、判断理由、確定結果は責務を持つ正本成果物へ残し、§6.1へその分担を示す正本対応表を置いた。
- 存在と承認を分離した。§6.1は、項目が登録簿に存在することと対応が承認されていること、対応が承認されていることと現在の対象範囲に含まれること、現在の対象範囲に含まれることとすでに着手していることを、それぞれ別のこととして明示する。登録簿への登録だけを理由に、要求の採用、優先順位の確定、着手、期日の確約、リスク受容を成立させない。
- 単一のロードマップ状態を2つの軸へ分離した（`21_Discovery.md`§6.3、`02_Terminology.md`§2.30・§2.31）。判断状態（Decision State）は`Unreviewed` / `Exploring` / `Held` / `Adopted` / `Rejected` / `Superseded`であり、課題探索・要求形成が所有する人間の判断の写しである。登録簿の更新だけで採否を確定しない。対応状態（Work State）は`Unscheduled` / `Ready for Review` / `Planned` / `In Progress` / `Completed` / `Cancelled`であり、進行段階を示す。従来の単一状態（`Deferred`、`Ready for Start Review`、`Started`、`Completed`、`Cancelled`）は新しい2軸へ1対1で対応し、対応表は移行注記に示す。
- 停止を対応状態の値から外した。依存、判断待ち、情報不足、アクセス不足は、対応状態を置き換えるのではなく停止要因（Blocker）として理由と解除条件を記録する。§6.3は、これが監査結果の`Blocked`（監査を完了できない状態）とは別概念であることを明示する。`51_Document_Audit.md`§3.1が定義し`10_Agent.md`§7.5が使用している監査状態との語の衝突を避けるためである。
- 発火条件を明示した登録義務を追加した（`21_Discovery.md`§6.2）。対応が完了していない事項を、現在の対象範囲の中で完結する見込みかどうかにかかわらず登録する。登録は、人間が登録簿へ手作業で転記することを意味しない。登録簿の対象集合に含まれ、主要表示または投影から検索・集計できる状態を指し、参照行、変更トレース索引からの生成、外部ツールからの投影、動的な集約のいずれで満たしてもよい。CRDDは実現方式を規定しない。対応が完了した事項、および終了した変更トレースと責務を持つ正本成果物から結果を追跡できる事項は、遡って登録しない。既存の履歴上の項目を一括で取り込むことも要求しない。登録簿が扱う対象は列挙する。プロダクトのアイデア、将来構想、顧客要望、利用者からのフィードバック、課題、要求候補、採用済みで着手を延期した要求、改善案、不具合、技術負債、リファクタリング候補、移行、セキュリティ／プライバシー／法務上の是正、運用上の課題、未解決の監査指摘、検証で見つかった残件、変更トレースから分離した後続対応、進行中の変更トレース、調査項目、未決事項である。対象ごとに、正本と登録簿が持つものを対応表で示した。
- 任意の候補保持を吸収せず、索引化した。`21_Discovery.md`§2.4は保持する内容と根拠の形式・場所を固定しないままとし、`03_Documentation.md`§3.3の「専用フォルダ、候補ごとのファイル、固定状態または中央登録簿を要求しない」という候補保持自体への立場も維持したうえで、保持すると判断した候補を登録簿から発見できるようにすることを求める。内容、根拠、判断理由は`01_Discovery`側へ残し、登録簿は存在、判断状態、参照先を持つ。採用、却下、優先順位を登録簿で決定しない。
- 進行中の変更トレースが二重簿記にならないようにした。`12_Change.md`は、変更トレースを作成した時点で登録簿へ参照行を置き対応状態を`In Progress`にすることを求め、登録簿は参照だけを持ち、契機、影響、実装、検証の内容を複製しないこと、変更トレースの正本は`90_Release/Changes/`であることを明示する。現在の対象範囲で直ちに修正する明確な不具合の経路は従来どおりで、要求を新設せず変更トレースへ直行し、登録簿は不具合の内容ではなく参照行を持つ。
- 未実施事項が文章内だけに残らないようにする規則を強化した。`12_Change.md`は、CHGを閉じる時点で対応が完了していない事項が残る場合、別の登録簿項目または別のCHGへ接続して実際に登録すること、未実施事項をCHG本文または監査結果の文章内だけに残して変更を閉じてはならないことを定める。対応する義務を`51_Document_Audit.md`§7.1（対象改訂版で解消しない指摘事項）、`53_Gap_Impact_Audit.md`§9.4（不足／影響の指摘事項について同様）、`29_Verification.md`§2.10（未達条件、既知の制限、残った不具合、次リリース候補）、`19_Maintenance.md`§6.2.1（着手待ちの資産、部分的な有効化の未完了事項）へ追加した。いずれの場合も、監査または工程は登録先と必要な決定権限を示すが、採用、優先順位、着手、リスク受容を自己決定しない。
- 目的別のロードマップ表示を投影（Projection）として扱うようにした（`21_Discovery.md`§6.7）。v0.7.0で導入した用語を再利用している。登録簿の正本は一つとし、目的別の表示はその投影であって別の決定権限ではない。投影の側で項目を追加、削除または状態変更しない。CRDDは特定の投影の集合、名称、ツール、生成方法を要求しない。
- 完了項目の除去条件を追加した（`21_Discovery.md`§6.8）。適用される変更トレースが完了またはリリース処置済みであること、確定結果が責務を持つ正本成果物へ反映されていること、必要な検証が完了していること、リリースまたは非リリースの処置が確定していること、残存リスクが記録されていること、未実施事項が別の登録簿項目または変更トレースへ接続されていること、最終結果を追跡できることを求める。v0.7.0の§6.4にあった完了時の4手順と詳細ファイル削除の規則は維持した。却下、重複、別項目への統合、前提消失、価値消失、対象外化、無効な入力等で変更トレースへ到達せず終了する項目は、終了理由と判断参照を保持したうえで主要表示から除去する。終了理由の正本は、責務を持つ課題探索・要求形成成果物または判断記録に置く。 完了項目の除去条件を、登録簿項目に共通する条件として確定した（`21_Discovery.md`§6.8）。項目の起点、判断状態の適用有無、変更トレースの有無または作成時期によって除去条件を省略しない。前段が定める変更トレース由来の項目についての充足の扱いは従前どおりで、参照行を生成または動的集約で維持している場合に項目ごとの手作業を要しない。除去条件のうち当該項目へ適用されないものについては、適用されない理由を取得可能にする。主要表示からの除去は記録そのものの削除ではなく、除去後も終了結果、適用した変更トレース、リリース処置、理由付き終了の判断、統合先または後継項目、再評価条件を、責務を持つ正本成果物または変更トレースから辿れるようにする。
- 用語エントリを3件追加した（`02_Terminology.md`）。未完了作業の登録簿（`Open Work Registry`、§2.29）、判断状態（`Decision State`、§2.30）、対応状態（`Work State`、§2.31）である。いずれも§2の委譲規則に従い、必須（MUST）と禁止（MUST NOT）を本書へ置かず`21_Discovery.md`へ委譲する。同文書§5の用語の境界表へ3行を追加し、既存の`Plan`行を修正した。ロードマップ項目は「採用済みの延期作業」ではなく、登録簿上の未完了項目である。
- `52_Conformance_Audit.md`のPL-11を登録簿に合わせて書き直し（すべての未完了事項を単一の登録簿から横断して確認できること、分離した2つの状態軸、索引であり複製しないこと）、PL-13を追加した。PL-13は、未完了事項を現在の対象範囲の中で完結する見込みかどうかにかかわらず登録簿から発見・集計できることを求め、成果物本文、引き渡し表示、変更トレース本文、プルリクエスト、コード注記、リリース記録または監査結果の文章内だけに残して閉じることを禁じる。未完了事項の後続追跡に従い、人間の決定権限が理由付きで終了させた事項は、登録簿に存在しないことをもって不適合としない。PL-13はプロダクトライフサイクルプロファイルの基準として追加する。本リリースにおける表明行の最終的な値は、後述のPL-15の項目に示す。登録簿の必須項目を、状態値だけによる一律の要求から、判断状態と項目種別に応じた段階的な必須性へ変更した（`21_Discovery.md`§6.3、工程移行の判定基準、工程監査チェックリスト、および`52_Conformance_Audit.md` PL-11）。判断状態が`Unreviewed`の項目は、確認できた最小限の情報だけを保持してよい。`Exploring`、`Held`もしくは`Adopted`の項目、および後続対応が必要な実行・参照項目は、担当責任者と再評価契機を取得可能にする。変更の理由は、§6が同時に「未確定として保持してよい」「初期のアイデアは最小限の情報だけを保持」「すべてを初期段階から必須にしない」と定めており、§6.6が新規項目を`Unreviewed` / `Unscheduled`で登録するため、未評価のアイデア1件を登録するだけでPL-11不適合になり得たためである。PL-11の判定は、対応状態が`Unscheduled`であることではなく、判断状態と項目種別で行う。表明列と必要な根拠列の双方を同じ条件へ揃え、情報源コンテキストまたは責務を持つ正本成果物への参照のいずれでも満たせるようにした。この変更は要件の緩和であり、v0.7.0でPL-11を評価済みのプロジェクトへの再評価契機になる。なお`開始条件`は本リリースでPL-11の必須項目から外れた。v0.7.0のPL-11は全項目へ無条件で`情報源コンテキスト、担当責任者、開始条件、再評価契機`を要求していた。厳しくなった方向は、登録簿の対象拡大、2つの状態軸の分離、再現可能な取得手順、索引として複製しないことである。v0.7.0でPL-11を評価済みのプロジェクトは、緩んだ方向と厳しくなった方向の双方について再評価する。
- 隣接する要約が旧定義のまま残らないよう、周辺を更新した。`03_Documentation.md`§3.1のフォルダ表と§3.3、`00_Overview.md`のフォルダ表・経路表・受付フロー図とその直後の説明、`README.md`の日英両方、`template/AGENTS.md`、およびひな型の`template/99_Roadmap/01_Product_Roadmap.md`である。ひな型は2つの状態軸、停止要因の項目、投影の節、終了理由と保持理由の項目を持つ形に更新した。
- CRDD標準の`RM-*`キー、新しいファイル名、`Archive/`フォルダのいずれも導入しない。プロジェクト固有の参照キーは引き続き付けてよく、安定コンテキストIDではなく成果物参照である。これは`21_Discovery.md`§2.4が`CAND-*`について既に取っている立場と同じである。主要表示は`99_Roadmap/01_Product_Roadmap.md`のままとし、変更トレースへ到達しない項目の終了理由は、別の保管場所ではなく課題探索・要求形成成果物の`Decision / Rationale`に残す。
- アンカー: `#63-roadmap-item-contract`は、節番号が§6.4へ移ったあともロードマップ項目の記録契約の位置で維持した。これにより外部からの参照は引き続き解決する。従来この旧アンカーを参照していたリポジトリ内の4件は、本リリースでいずれも参照先を変更した。`12_Change.md`、`52_Conformance_Audit.md`、`53_Gap_Impact_Audit.md`は`#64-roadmap-item-contract`へ、`03_Documentation.md`は該当文が§6.2へ移ったため`#62-registry-scope-and-registration`へ変更している。`#63-roadmap-item-contract`を使用するリポジトリ内参照は残っていない。同じ位置へ`#64-roadmap-item-contract`も追加した。新設節には明示アンカー（`#62-registry-scope-and-registration`、`#63-decision-state-and-work-state`、`#65-transition-rules`、`#66-roadmap-state-transitions`、`#67-registry-projections`、`#68-closure-and-removal`）を置いた。旧§6.1〜§6.4の見出しから生成される日本語アンカーは、節の改称または番号変更により移動する。リポジトリ内でこれらを参照するリンクはないが、外部からこれらを参照している場合は更新が必要である。削除したアンカーはない。
- 開発方式に依存しない進捗管理モデルを定義する新規正本文書`15_Progress.md`を追加した。CRDDは特定の開発方式を要求しない。段階型、リスク駆動の反復型、時間枠型の反復、継続フロー型、保守運用のいずれでも、一つの機能、変更、不具合、調査、是正事項を成立させるために必要な責務そのものは大きく変わらない。方式ごとに別の進捗管理モデルを定義せず、共通の最小対象と共通の進捗情報を持たせ、方式の違いは対象範囲の切り方、期間の切り方、反復の目的、並行度、集約単位、方式固有の補助情報として表す。進捗情報は既存の正本から導く二次情報であり、要求、判断、設計、検証結果の正本を置き換えない。
- 進捗管理の最小対象としてライフサイクル単位（Lifecycle Slice）を定義した。一つの価値、変更、機能、不具合、調査、是正事項等について、適用されるCRDD責務を成立させる単位である。責務を直列に通ることを意味せず、適用責務と完了条件は対象ごとに選び、CRDD標準の新しい識別子種別を発行しない。識別には既にその対象を識別しているもの（登録簿の参照キー、`CHG-*`、安定コンテキストID、外部Issueキー）を使う。すべてのライフサイクル単位が変更トレースを持つとは限らない。調査、UX検証、文書のみの対応では変更トレースやリリースが適用されない場合があり、変更トレースの存在をライフサイクル単位として追跡する条件にしない。
- 進捗中核（Progress Core）を定義した。方式を問わずすべてのライフサイクル単位が共通に保持する情報であり、識別と種別、対象範囲、期日、対応状態、停止要因、着手可能性、責務別進捗、根拠、判断待ち・承認待ち、依存関係を含む。方式固有の補助情報はこの共通中核へ追加する項目として扱い、方式ごとに別の中核を作らない。
- ライフサイクル単位へ、横断集計のための粗い対応状態7値（`Unscheduled` / `Planned` / `Committed` / `In Progress` / `Paused` / `Completed` / `Cancelled`）を定義した。これは上位状態であり、登録簿の対応状態、変更トレースの状態、工程の網羅状態を**置き換えない**。`Committed`と`In Progress`を同一視しない。対象範囲の基準へ投入することを決めたことと、実作業を開始したことは別の判断である。`Paused`と停止要因も同一視しない。`Paused`は人間が意図して止めた状態であり、停止要因は外部の阻害条件である。状態の前進、特に`Committed`と`Completed`は人間の決定権限が確認する。
- 停止、着手可能性、現在の責務、レビュー中・検証中といった活動を状態軸から外した（`15_Progress.md`§3.3）。停止要因はどの対応状態にも重なる属性とし、着手可能性は適用される次の責務の入口契約から、現在の責務とレビュー中・検証中の活動は責務別進捗から導く。これにより「対応中かつ停止中」「実行確定だが着手可能ではない」といった状態を、単一選択の値へ潰さずに表現できる。停止要因の記録と解除は、対象となる登録簿項目またはライフサイクル単位の対応状態に責任を持つ人間の決定権限が確認する。AIは候補提示、記録案の作成、根拠の更新を支援できるが、停止要因の確定または解除を自己決定しない。
- 責務別進捗を、各工程文書が既に定めている網羅状態（`Complete for Scope`、`Partial — Human Authorized`、`Blocked`、`Not Started`、`Not Applicable`）から導く形にし、新しい状態語彙を導入しなかった。`Not Applicable`の責務は分母から除外する。リリースの責務は`13_Release.md`のリリース準備状況とリリース判断から導く。
- 進捗の表し方を階層化した（`15_Progress.md`§4）。入力の正本は各項目の対応状態、対象範囲、期日、根拠である。一次集約は状態分布であり、数え方だけで決まる。基本派生指標は、適用対象の件数だけで算出する重み付けのない単純進捗率である。重み付き進捗率、工程横断の工程進捗、完了予測日は追加の入力または仮定を要する高度な派生指標であり、要求しない。重みは人間が指定した場合にだけ考慮し、CRDDは特定の重み体系、見積り手法、予測モデルを要求しない。使用する場合は、重みまたは仮定を指定した決定権限、その内容と適用対象範囲、算出規則、算出時点と参照した根拠を取得可能にする。状態分布、単純進捗率、高度な派生指標、完了予測を包含する正式用語として進捗指標（`Progress Indicator`）を`02_Terminology.md`へ登録し、詳細な契約は`15_Progress.md`へ委譲した。
- AIが確定してよい範囲を明示した（`15_Progress.md`§4.4）。AIは根拠から状態分布と単純進捗率を算出し、不足、矛盾、陳腐化を指摘できるが、対応状態の前進（特に`Committed`と`Completed`）、責務の`Not Applicable`、重みまたは予測の前提、完了条件を満たしたという判定、期日または完了予測の確約を自己確定しない。根拠が不足する場合は推定で埋めず、不足している根拠と確認先を示す。
- 進捗と健全性（Health）を分離し、一つの数値へ丸めずに並べて示すことを求めた。健全性は、停止要因、判断待ち・承認待ち、対象範囲の未確定、根拠の不足、未完了のレビューまたは監査、未完了の検証、未解消の重大な指摘事項または重大不具合、依存関係の遅延、期日の超過、進捗情報自体の陳腐化から判定する。既定の表示は`Healthy` / `At Risk` / `Impaired` / `Unknown`とし、名称はプロジェクトで定義してよい。判定に使用した信号と、判定を確認した決定権限を取得可能にする。
- 粗い対応状態を既存の状態モデルへ対応づけ、置き換えない形にした（`15_Progress.md`§6）。未完了作業の登録簿の対応状態と、`12_Change.md`§5の変更トレースの状態について、それぞれ対応表を置いた。`Committed`と`Paused`に対応する登録簿の状態値はない。対象範囲への投入確定と意図的な停止は進捗管理側の区別である。あわせて、同じ概念が粒度によって別名にならないよう、登録簿の着手済みを表す対応状態を本リリース内で`Started`から`In Progress`へ改めた。`In Progress`は`02_Terminology.md`§4.2の共通状態値に既にあり、`Started`にはなかった。単純進捗率が高いことを、工程移行の判定基準を満たした根拠にしないことも明示した。
- 集約単位（変更トレース、機能、不具合、責務・工程、反復または時間枠、リリース、節目、プロジェクト、複数プロジェクト）を、同じ入力に対する投影（Projection）として扱うようにした（`15_Progress.md`§7）。算出の基本規則は集約単位によって変えず、変えるのは対象集合と絞り込みだけである。集約の側で、ライフサイクル単位の対応状態、適用責務、根拠を変更しない。
- UIと振る舞い仕様の対の成立度を追加した（`15_Progress.md`§8）。UIと振る舞い仕様は並列責務であるため、片方の責務別進捗が高くても対として成立しているとは限らない。対の成立度は、`24_UI_Behavior_Specification.md`が定める必要な対応関係の網羅範囲に対して両側が成立している項目から導き、UIと振る舞い仕様の進捗の平均で代替しない。`24_UI_Behavior_Specification.md`§2.4に対応する接続を置いた。
- 実行方式のプロファイルを名前付きで定義する代わりに、実行方式の接続契約（Execution Method Mapping）を定義した（`15_Progress.md`§9）。CRDDは外部の開発方式、フレームワーク、手法の用語、役割、儀式、規則を定義または再定義しない。方式を採用する場合に取得可能にするのは5つの対応だけである。方式固有の実行単位がどのライフサイクル単位の集合に対応するか、方式固有の目標と完了条件がCRDDのどの完了条件・工程移行の判定基準・検証結果へ対応するか、方式固有の状態が共通の対応状態のどれに対応するか、方式固有の補助情報をどこに保持しどの正本成果物を参照するか、未完了作業の登録簿からどの規則で対象範囲を選ぶかである。実行方式の採用または変更は、対象範囲の作業方式に責任を持つ人間の決定権限が確認する。AIは5つの接続関係の候補提示と整合確認を支援できるが、採用または変更を自己決定しない。接続関係を取得可能にしたことだけを、方式の採用、作業の完了、工程移行、検証または人間の判断の代わりにしない。方式固有の完了定義を満たしたことを、適用される検証と人間の判断を満たした根拠にしない。
- 用語エントリを4件追加した（`02_Terminology.md`）。ライフサイクル単位（`Lifecycle Slice`、§2.32）、進捗中核（`Progress Core`、§2.33）、健全性（`Health`、§2.34）、進捗指標（`Progress Indicator`、§2.35）であり、詳細な義務を`15_Progress.md`へ委譲する。対応状態（§2.31）のエントリは2つの粒度を扱う形へ広げ、それぞれの決定権限を示した。`02_Terminology.md`§4.2へ共通状態値4つ（`Unscheduled`、`Planned`、`Committed`、`Paused`）と、混同してはならない対2件（`Committed ≠ In Progress`、`Paused ≠ Blocked`）を追加した。§5の用語の境界表へは、ライフサイクル単位、進捗中核、健全性、進捗指標、実行方式の5行を追加した。最後の行は、開発の進め方を指す実行方式と、準拠基準集合である`52_Conformance_Audit.md`のプロファイルを別概念として区別する。あわせて、既にエントリを持つ用語または境界行のないまま使用されていた用語について、§5境界表へ3行（`ロケールと表示名`、`変更影響の伝播確認`、`スキル`）を追加した。別の1行は本リリースが導入した`停止要因`の境界行であり、§5末尾の登録規則が求める登録を完了させるものである。これらは明確化、または上記で既に記録した追加の登録手続きであり、既存の正式用語は改称しない。
- `52_Conformance_Audit.md`へPL-14を追加した。CRDDの責務に基づく進捗を報告する対象範囲に適用し、報告しない場合は、`52_Conformance_Audit.md`3節が定める`Not Applicable`の使用条件に従い、理由と対象範囲を取得可能にして基準結果を`Not Applicable`とする。進捗の対象単位、適用責務、対応状態、根拠を取得可能にすること、進捗と健全性を分離して示すこと、高度な派生指標を用いる場合に、重みまたは仮定を指定した決定権限、その内容と適用対象範囲、算出規則、算出時点と参照した根拠を取得可能にすることを求める。AIは、進捗または完了予測を確定したり、適用責務または進捗項目を`Not Applicable`としたりする判断を、人間の確認なく行わない。`52_Conformance_Audit.md`へPL-15を追加した。進捗指標を工程移行、検証完了、リリース可否、リスク受容または人間の承認の判定根拠にしないことを、CRDDの責務に基づく進捗を報告するかどうかにかかわらず適用する無条件基準である。この禁止をPL-14から取り出したのは、PL-14を`Not Applicable`としたプロジェクトが同じ禁止からも免除されることを防ぐためである。規範強度は、進捗指標を判定根拠にすること自体を禁じる形とし、単独根拠でなければ許容する形へは緩和しない。禁止の正本は`15_Progress.md`§1に置き、§6.3は工程移行、§10は5対象について具体化する。PL-15は基準列と必要な根拠列の両方が5対象を扱い、リスク受容と人間の承認の記録も確認対象とする。`13_Release.md`§6と`29_Verification.md`§2.10へ、それぞれが所有する判断について同じ規則への接続を新設した。プロダクトライフサイクルの表明行はいずれも`PL-01〜PL-15`へ移る。
- 進捗のために新しい恒久フォルダも新しい識別子種別も追加しない。進捗情報は、未完了作業の登録簿、変更トレース、各工程の正本成果物、検証・リリース記録、または外部の課題管理・進捗管理ツールから取得可能にする。外部ツールを使う場合は、場所、対象、対象時点、アクセス方法、正本成果物へ戻る経路を辿れるようにする。
- 初期項目の必須性を緩めることに伴い、登録簿全体の整理責任を新設した（`21_Discovery.md`§6.3）。プロジェクト固有ロードマップの決定権限は、宣言した整理契機に基づいて`Unreviewed`の項目を確認し、判断状態のいずれかへ進める。重複する項目は`Superseded`として統合先を参照する。個々の初期項目に担当責任者が未設定であることは許容するが、登録簿全体を整理する決定権限を未設定にしてはならない。時刻スケジューラや周期は要求しない。§6.6の「宣言した契機で再評価する」枠組みを再利用する。これは義務の追加であり、新たな不適合を生じ得る。
- 新設した未完了事項の後続追跡の不変条件は、`01_Principles.md`が対象とするプロダクト開発へ適用する。CRDD標準自身の保守では、同不変条件を保守正本へ複製せず、`AGENTS.md`および`19_Maintenance.md`が既に持つIssue受付、変更ライフサイクル、担当責任者と理由を伴う処置、残存リスクと後続対応の返却によって残件を接続する。理由付き終了について、受容した影響、再評価の要否、およびAIが後続対応の不要を自己決定しない境界は、`01_Principles.md`§6.2を参照して運用する。この参照関係が運用で成立しないことが観察された場合は、保守正本への追加を別の変更として評価する。公式リポジトリの入口3件（`.github/copilot-instructions.md`、`AGENTS.md`、`.github/pull_request_template.md`）は、残件を報告しただけで保守作業を完了と誤認しないよう本リリースで追従させた。入口ファイルは正本ではなく正本を実行へ接続する接続部であり、この追従は保守正本への規範追加ではない。この境界は追跡義務の免除ではなく、同じ結果を別の正本契約で成立させる整理である。採用プロジェクトは、CRDD標準リポジトリ自身の運用をPL-13の根拠として引用しない。
- `52_Conformance_Audit.md`の`Not Applicable`の使用条件を3節へ一本化した。3節は、対象基準の宣言された適用条件を満たさない場合、またはその基準が統制する成果物、工程もしくは能力が対象範囲に存在しない場合に限り使用でき、理由と対象範囲を取得可能にしなければならないと定める。プロファイル基準についての限定は3節第1文と7節の`Eligible`行の双方で保持し、中核基準への`Not Applicable`は3節第3文と7節の`Not Eligible`行が引き続き禁じる。7節の`Not Eligible`行から未定義語`条件付き基準`を削除し、宣言された適用条件を満たしかつ統制する成果物、工程または能力が対象範囲に存在する必須基準を`Not Applicable`にしている状態を不適格事由とした。従来はUIを持たない対象範囲でPL-05を対象範囲上の根拠で`Not Applicable`とした表明が3節では許容され7節では不適格と読める食い違いがあり、これを解消した。`Not Applicable`の記録要件を述べる4箇所（3節・11節・12節・13節）をいずれも理由と対象範囲の2要素へ揃え、12節の`criteria_results`へ`not_applicable_reason`を追加した。既存の`Not Applicable`判定を持つプロジェクトは、対象範囲を追加し、3節・7節の変更に対して適格性を再判定する。変更分類は`normative`である。
- 正式用語と規則名の判定条件を`02_Terminology.md`§5へ追加した。従来は「どちらとして扱うかは、当該名称を導入する変更の対象範囲で決める」と導入者の裁量に委ねており、`変更影響の伝播確認`が登録済みで`移行完了の条件`が同じ構造で未登録という二つの前例が併存していた。正式用語として登録する条件5項目と規則名として扱う条件4項目をいずれも「いずれかを満たす」形で置き、両方に該当する名称は規則名として扱い、固有のスキーマキー、状態値集合、または準拠基準の基準列に判定条件として現れる場合だけ正式用語とする優先規則を置いた。正式用語は、§2または§3の用語エントリ、もしくは条件を満たす§5境界表の第1列の行で登録する。後者は、ローカル表示名と正式英語名、他概念との識別を変える境界規則、正本への直接参照または同等の定義・決定権限・適用範囲を備える必要があり、関連表現だけでは登録とみなさない。**本条件はv0.8.0以降に新しく導入する名称、または意味、責務もしくは適用範囲を変更する名称へ適用し、施行時点の既存名称には遡及適用せず再分類しない。** この非遡及方針と、既存名称の再分類を行わないままこの事項を終了させる判断は、CRDD保守に対する人間の決定権限が承認した。理由は、遡及適用すると全名称の再分類が必要になり本変更の事前確定した対象範囲を超えること、監査で抽出された一部名称だけを再分類すると選択基準のない部分適用になること、既存利用を維持し新規導入・意味変更時から一貫した基準を適用する方が互換性と保守可能性を両立することである。受容する影響は、遡及適用すれば正式用語側へ分類され得る既存名称が残ることである。現行の利用、決定権限、状態、準拠結果は変更せずこれを受容する。一括再分類は不要であり、再評価条件を設定しない。将来、既存名称の意味、責務または適用範囲を変更する場合は、その変更作業の一部として本条件を適用する。監査証跡に保持した併記名称の実測分布と個別名称の分類例は、判定条件が異なる構造の名称を識別できるかを確認する検証記録である。既存名称を将来再分類するための作業一覧ではなく、各項に後続処置を発生させない。
- `02_Terminology.md`§2.25の投影（Projection）の定義を、IAに固有の定義から横断概念へ一般化した。同じ実体、正本成果物またはそれらの集合を、特定の利用目的に合わせて選択、変換、集約または再表現した表現形のそれぞれとし、投影は参照元の項目の決定権限を置き換えないことを明示した。決定権限は単一へ固定せず、元情報の意味は元の正本の決定権限、投影の構成と利用目的はそれらを定める正本成果物または承認済み規則の項目の決定権限、IAにおけるオブジェクト境界の判断はIAの決定権限として項目単位で列挙した。IAに固有の必須と禁止、および本文段落の第1文へは`IAでは`または`IAにおける投影では`の範囲指定を置き、一般の必須（何の投影かを示す対象の併記）と複合語の除外文は無限定のまま保持した。追跡可能性の必須は追加していない。集約は定義上情報を落とすため、追加すると`15_Progress.md`§7の集約と`21_Discovery.md`§6.7の目的別投影が即座に違反になる。これにより、登録簿の投影と進捗の集約がIAの決定権限を要するかのように読める従来の不整合を解消し、`52_Conformance_Audit.md` PL-11とPL-13が参照行、生成、投影、動的集約を並置している構造が正当化される。あわせて`目的`欄へ一般の目的を1文前置し、`関連用語`へ未完了作業の登録簿とライフサイクル単位を加えた。
- 登録簿全体の整理責任について、検出面を課題探索・要求形成の工程監査チェックリストへ置き、`52_Conformance_Audit.md`のPL-11へは追加しない。同一リリースで同一基準へ緩和と強化を同居させると、採用済みプロジェクトの再評価負荷が二重になるためである。受容する影響は、`CRDD Product Lifecycle Profile Conformant`を表明するが課題探索・要求形成の工程監査を実施しないプロジェクトが、この義務に一度も接触しないことである。再評価契機は、PL-11の次回改訂時とする。また`19_Maintenance.md`§3.1へ追加した編集計画の規律は、CRDD標準自身の保守を対象とし、採用プロジェクトへは適用しない範囲の判断である。`21_Discovery.md`§6.3へ追加した「後続対応が必要な実行・参照項目」の該当条件のうち、実行根拠が担当責任者と完了条件を追跡できる状態にあることを求める部分は、明確化ではなく規範の追加である。
- 保守規則を3点明確化・追加した。第一に、`19_Maintenance.md`§2.2の4要素（独立した項目の決定権限、状態遷移、承認者、利用者）が、すべてを満たすことを求める連言要件ではなく、新規文書の必要性を判断するために確認する観点であることを明確化した。成立しない観点がある場合は、その理由と、残る観点で必要性が成立する根拠を取得可能にする。これにより、`15_Progress.md`の新設が承認者の独立性を根拠としないまま例外として成立する。第二に、`02_Terminology.md`§5の登録規則へ境界を追加し、規則名、節名、契約名を「日本語（English）」の形式で併記することは正式用語の導入に当たらないことを確定した。従来、`変更影響の伝播確認`は登録済み、`移行完了の条件`は同じ構造で未登録という二つの前例が併存していた。これにより`未完了事項の後続追跡`は規則名として扱い、用語登録を要しない。第三に、`19_Maintenance.md`§3.1へ編集計画の規律を追加した。複数の指摘または合意事項を一括して適用する場合は、編集計画の一次キーを編集の識別子とし、検索文字列の一意性検証を計画の組織原理にしない。挿入型の編集にも目印を与え、指摘と編集の全数対応を適用開始前に突き合わせ、依存関係から適用順を定める。これは修正後の全数分類による解消判定（`10_Agent.md`§7.5）の前倒しではなく、検出より前の段階の規律である。入口接続部には参照だけを置き、規範本文を複製しない。第一と第二は明確化、第三は規範の追加である。
- 未完了事項の後続追跡の不変条件を`01_Principles.md`§6.2へ追加した（アンカー`unresolved-follow-up-tracking`）。工程、引き渡し、変更、実装、検証またはリリースの完了後にも、対応、判断、再確認または監視を必要とする未解決事項、未実装対象範囲、既知の制限、残存リスクその他の残件を、引き渡し表示、成果物、変更トレース、プルリクエスト、コード注記またはリリース記録へ記載しただけで追跡を完了したものとしない。残件は三経路のいずれかへ処置する。後続対応を必要とするものは、未完了作業の登録簿の項目、別の変更トレース、Issueまたは同等の追跡可能な対象へ接続し、担当責任者、次の処置、再評価条件または完了条件を取得可能にする。後続対応を必要としない情報として終了する場合は、人間の決定権限、理由、受容した影響またはリスク、および再評価が不要であることまたは再評価が必要になる条件を取得可能にする。AIは、後続対応が不要であるという判断を自己決定しない。判断が未確定の残件は判断対象として接続する。接続先と実現方式は各工程および変更の正本に従うため、原則は規範を下流へ委譲しない。発火元は3文書で、それぞれ固有の発火条件だけを持ち規則を複製しない。`10_Agent.md`§7.3が部分引き渡しとレビュー例外、`28_Implementation.md`が未実装対象範囲、`13_Release.md`§6が既知の制限である。`01_Principles.md`の最小原則へも1行追加し、閉じた後に残る未完了事項を記載だけで終えず接続先または理由付きの終了へ処置することを示した。配布する接続部も同時に追従させ、`template/AGENTS.md`と`template/.github/copilot-instructions.md`を更新した。後者は完了時の報告項目に「残っている不足とリスク」を挙げており、報告だけで完了と読める指示をAIへ与え続けるためである。`52_Conformance_Audit.md`のPL-13は、この不変条件に従って人間の決定権限が理由付きで終了させた事項を、登録簿に存在しないことをもって不適合としない。変更分類は`breaking`である。
- 工程契約とエージェント実行境界を2点変更した。第一に、`28_Implementation.md`の工程入口契約へ「情報源となるREQ / UX / IAへのトレース」を追加した。他の工程文書（`23_IA.md`、`25_UI.md`、`26_Behavior_Specification.md`、`27_Architecture.md`、`29_Verification.md`）はいずれも上流トレースを入口で保持しており、実装だけが欠けていた。`27_Architecture.md`の出口条件は既に同項目を要求しているため、送信側の変更は不要である。この変更は実装工程を使用する採用プロジェクトへ条件付きで適用され、移行注記の条件付き操作に従う。第二に、`10_Agent.md`§3.1へ、上位判断への移送時に未達の義務を失わせない要件を追加した。対象範囲、満たせていない義務と未達条件、必要な後続対応、判断する決定権限、再開条件を、受信側が実行を再開できる形で渡す。規範本文の全文複製は要求しない。移送後にも対応が必要な残件は未完了事項の後続追跡に従って接続する。いずれも変更分類は`breaking`である。
- `15_Progress.md`を新規正本文書として追加する判断は、`19_Maintenance.md`§2.2が定める「既存正本文書への統合を優先する」既定に対する例外として、v0.8.0の対象範囲について人間の決定権限者が確認した。統合先候補として`21_Discovery.md`§6と`12_Change.md`を検討した。前者は未完了事項の索引であり、§6.1が自ら第二の正本にならないと宣言しているため、算出階層と責務別進捗の正本を担わせると自己矛盾する。後者は変更単位に閉じており、変更トレースを持たないライフサイクル単位（調査、UX検証、文書のみの対応）を扱えない。判断の決定的な根拠は、進捗管理が独自の状態遷移（§3.2の対応状態）と、単一工程へ帰属しない利用者（§7の集約単位）を持つことである。承認者の独立性は、既存の各決定権限の合成として説明できるため根拠としていない。
- `プロファイル`という語が本体系で複数の対象を指す状態を、境界定義の明確化によって解決し、改名しない。準拠監査のプロファイル、アクセシビリティプロファイル、品質懸念プロファイル、実行プロファイル、運用プロファイルの区別を`02_Terminology.md`§5の1行で読み切れるようにした。調査では、`CHANGELOG.md`を除く36ファイルで`プロファイル`が71件出現し、種別修飾語を伴うもの36件、文脈から種別が推測できるもの25件、修飾語を伴わないもの10件であった。修飾語を伴わない10件はいずれも他の種別が混入し得ない文脈であり、複数の種別が想定され得る場所での単独使用は0件である。各用法は修飾語付きの正式名称、適用対象、決定権限および準拠への影響を明示することで区別できる。名称の重複だけでは誤りや移行を正当化する根拠にならず、全面改名による追加の明確性は限定的であり、既存の採用先へ移行を要求する破壊的変更を正当化しないため、実施しない。受容した影響は、`02_Terminology.md`§5の境界行を読まない利用者が用法を混同し得ることである。この影響を受容して終了する判断は、v0.8.0の対象範囲についてCRDD保守に対する人間の決定権限が確認した。現時点で残る未完了対応はなく、再評価を予定しない。将来、AI、利用者、ツールまたは採用者による具体的な誤認が実際に観察された場合は、本件を再開するのではなく、新しい事象として受け付ける。
- `Priority`の定義と決定権限の循環として持ち越していた項目は、現行テキストに循環が存在しないことを確認したため終了する。`02_Terminology.md`§5の境界行が意味の正本を[情報提示の意味構造](23_IA.md#28-information-presentation-model)へ定めており、v0.7.0で§5境界行を追加した時点で解消していた。事実判定による終了であり、再評価条件は設けない。
- `21_Discovery.md`へ本文リンクを新設した文書のRelatedヘッダーは更新しない。Relatedは本文中の参照先または決定権限の委譲先を網羅する依存関係一覧でなく、主要な読み合わせ先を示す選択的な案内として運用されている。`03_Documentation.md`のRelatedは`21_Discovery.md`を持たないが、同文書の基本構造表は`01_Discovery`の工程決定権限として`21_Discovery.md`を直接参照している。`21_Discovery.md`への直接参照は各本文内で取得可能であり、今回変更した文書だけをRelatedへ追加すると既存文書との掲載基準が不均一になるため追加しない。Relatedの網羅性を変更する場合は、全正本文書を対象とした独立した文書規則変更として扱う。

採用側への影響: 採用プロジェクトはロードマップを移行する必要がある。既存項目は移行注記の対応表に従って2軸へ言い換え、登録簿の対象を、採用済みで延期した作業から、現在の対象範囲の中で完結する見込みかどうかを問わない未完了事項全体へ広げる。これは、現在それらが散らばっている場所を洗い出すことを意味する。課題探索・要求形成の候補保持、進行中の変更トレース、未解決の監査指摘、検証で見つかった残件、着手待ちの移行資産、変更トレース本文にだけ記録された後続対応である。ロードマップを外部ツールで管理しているプロジェクトも、同等の記録が2つの状態軸と正本成果物への参照を保持していれば同じ方法で満たせる。未実施事項を文章だけで説明したまま変更、監査、検証を閉じている既存のエージェント定義、プロンプト、作業手順は更新が必要であり、ロードマップ登録を採用の根拠として扱っているものも同様である。進捗管理モデル自体は、CRDDの責務に基づく進捗を報告しないプロジェクトへ作業を課さない。その場合PL-14は理由と対象範囲を伴う`Not Applicable`であり、`15_Progress.md`はフォルダも識別子も必須ファイルも追加しない。報告するプロジェクトは、進捗の対象単位、適用責務、対応状態、根拠を取得可能にし、進捗と健全性を分離して示し、進捗指標を工程移行、検証完了、リリース可否、リスク受容または人間の承認の判定根拠にする運用をやめる必要がある。過去のアイデアを無制限に取り込む必要はない。`21_Discovery.md`§6.2は、対応が完了した事項と、終了した変更トレースおよび責務を持つ正本成果物から結果を追跡できる事項を遡って登録しないことを定め、取り込みの順序を現在のプロダクト判断へ影響する項目から先にすることを定める。移行注記の順序もこれに従う。この移行は、既存の基準版からv0.8.0へ更新するプロジェクトにとって任意ではなく必須である。CRDDを初めて採用する場合は比較対象となる差分がないため`19_Maintenance.md`§6.2.1の対象外だが、基準版採用評価と人間の決定権限者による有効化は省略しない。更新するプロジェクトは、v0.8.0への`Conformant`表明を記録する前に、`19_Maintenance.md`§6.2.1の移行完了の条件を満たす必要がある。

移行注記（v0.7.0 → v0.8.0）:

- 変更分類 / 移行の要否: `change_classification: breaking`、`migration_required: true`。本基準版更新は、採用処置にかかわらず移行完了の条件の対象であり、対応なしで採用する場合も対象に含む。
- 必須操作: 既存のロードマップ項目すべてを、下記の対応表に従って2軸へ言い換える。登録簿の対象を、現在の対象範囲の中で完結する見込みかどうかを問わない未完了事項へ広げる。情報源は順に、既存のロードマップ項目、今後も再検討価値がある候補保持、進行中の変更トレース、変更トレースに記録された後続対応、未解決の監査指摘、不具合、着手待ちの移行資産、技術負債とし、そのうえで重複項目を統合する。すでに完了している項目は登録しない。却下、無効、価値消失が確認できる候補は、判断理由を確認して終了する。未実施事項を文章だけに残して変更、監査、検証を閉じている既存のエージェント定義、プロンプト、作業手順を更新する。判断状態を適用しない実行・参照項目（変更トレース参照、明確な不具合、承認済み是正等）には、判断状態を残さず、対応状態と実行根拠への参照を持たせる。旧`Deferred`項目を`Adopted` / `Unscheduled`へ、未採用項目を`Held` / `Unscheduled`へ写像した項目は、担当責任者と再評価契機を取得可能にする。`Unreviewed`として登録する項目には要求しない。登録簿側に固有の後続対応、判断または監視が残る実行・参照項目には、担当責任者と再評価契機も持たせる。実行根拠側で担当責任者と完了条件を追跡できる項目には要求しない。
- 状態の対応: `Deferred` → `Adopted` / `Unscheduled`、`Ready for Start Review` → `Adopted` / `Ready for Review`、`Started` → `Adopted` / `In Progress`、`Completed` → `Adopted` / `Completed`、`Cancelled` → `Adopted` / `Cancelled`。採用されたことがない項目には対応する旧状態がないため、`Unreviewed`または`Held`と`Unscheduled`で登録する。停止していた項目は、停止がなければ取るはずの対応状態に加えて、理由と解除条件を持つ停止要因を記録する。
- 条件付き操作: 進捗管理モデルは、CRDDの責務に基づく進捗を報告するプロジェクトだけに適用する。報告しない場合は、理由と対象範囲を取得可能にしてPL-14の基準結果を`Not Applicable`とする。適用する場合は、方式固有の実行単位、目標と完了条件、状態、補助情報、対象選択の規則を`15_Progress.md`§9へ対応づけ、方式固有の完了定義を適用される検証と人間の判断の代わりにしている運用をやめる。`29_Verification.md`、`19_Maintenance.md`、および監査側の義務は、当該工程または監査を実行しているプロジェクトだけに適用する。進行中の変更トレース、未解決の監査指摘、移行の着手待ちがいずれも存在しないプロジェクトは、その情報源から洗い出す対象がないことを記録し、洗い出しを省略したものとして扱わない。実装工程を使用するプロジェクトは、工程入口契約へ情報源となるREQ / UX / IAへのトレースを追加し、既存の実装対象成果物が入口で当該トレースを取得可能にしているかを確認する。取得できない場合は、`27_Architecture.md`の出口条件が既に同項目を要求しているため上流の出口記録から補完し、補完できない範囲は未完了作業の登録簿へ接続する。実装工程を使用しないプロジェクトには適用しない。エージェントまたはサブエージェントを使用するプロジェクトは、上位判断への移送の様式へ、対象範囲、満たせていない義務と未達条件、必要な後続対応、判断する決定権限、再開条件を含める。移送後にも対応が必要な残件は未完了作業の登録簿または変更トレースへ接続する。エージェントを使用しないプロジェクトには適用しない。
- 対象外: 安定コンテキストIDの変更、`RM-*`識別子、ファイル名の変更、新しいフォルダの追加、既存の`REQ`／`UX`／`IA`／`UI`／`SPEC`識別子の変更はいずれも発生しない。主要表示は`99_Roadmap/01_Product_Roadmap.md`のままである。固定スキーマも要求しない。`21_Discovery.md`§6.4の項目契約を取得可能にできれば、一つのMarkdown内の表、Issue管理システム、外部ロードマップツールのいずれでもよい。
- 検証: 参照、アンカー、用語の追従は文書監査で確認する。不足／影響監査は本基準版では条件付きではなく必須とする。移行完了の条件の1点目から4点目（棚卸し、処遇、移行先、着手待ちゼロ）が本移行の中核であり、`19_Maintenance.md`§6.2.1により文書監査はこれらの充足を判定しないためである。棚卸しの対象は`19_Maintenance.md`§6.2.1に従い、対象範囲の成果物、接続部、運用の全既存資産とする。表明を記録する前に、PL-11と新設のPL-13・PL-14・PL-15を再評価する。既存の`Not Applicable`判定は、理由と対象範囲を追加または確認し、`52_Conformance_Audit.md`§3および§7に従って適格性を再判定する。未評価または根拠のない基準を`Not Applicable`へ置き換えない。
- ロールバック / 回復: 移行完了の条件を満たすまで、従来の基準版を有効なまま維持する。評価のために読んだ採用候補の基準版は、人間が有効化するまでプロジェクトを拘束しない。
- 延期した場合の既知リスク: 未完了事項が候補保持、変更トレース、監査結果、移行の棚卸しへ分散したままとなり、全体量を示す場所が存在しないため、長期間埋もれている項目が引き続き気付かれない。移行を完了せずv0.8.0への`Conformant`表明を記録しても、`52_Conformance_Audit.md`§7の適格性を満たさない。

---

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
