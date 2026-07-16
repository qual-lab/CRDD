# CRDD Changelog

All notable changes to CRDD itself (the methodology documents in this folder) are recorded here.
CRDD自身（このフォルダ内のメソドロジー文書）の変更履歴を記録する。

**[English](#english)** | **[日本語](#日本語)**

---

## English

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
