# CRDD

**Context Repository-Driven Development**

```text
作業をAIへ。判断を人間へ。思想をContext Repositoryへ。
Work to AI. Judgment to humans. Thought to the Context Repository.
```

Status: **v0.4.2 — Phase Transition Review Enforcement / 工程移行Review実行保証版**

**[English](#english)** | **[日本語](#日本語)** | **[Changelog](CHANGELOG.md)**

---

## English

### What is CRDD?

AI-assisted development can accelerate implementation while quietly losing a product's Why: the origin of a need, the reasoning behind a decision, rejected alternatives, accepted risks, and design intent often decay in chat logs, tickets, and pull request descriptions.

CRDD is a development methodology that preserves and connects that context so humans, AI, and specialists can carry a product from discovery through verification without silently changing its meaning. In a Git-based project, the repository can serve as the canonical control plane for the Context Repository, while authoritative external artifacts remain connected through explicit references.

AI may explore, organize, compare, draft, implement, and verify within its authority. Humans retain authority over meaning, value, priority, approval, risk acceptance, and final responsibility. CRDD does not require a particular AI tool, agent topology, document tool, or technology stack.

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

UI and Behavior Specification are parallel phases joined by a shared contract. Before a normal phase transition, an independent reviewer evaluates the sending exit, receiving entry, coverage, trace, and unresolved gaps for the target revision. Transition-affecting findings are remediated in the responsible phase and the updated revision is re-reviewed before Human approval. Review may be skipped only through an explicit Human-directed exception that records the unreviewed scope, risk, owner, and required re-review; partial handoff does not itself waive review of the transferred scope.

### Quick Start

1. Read the [Overview](00_00_Overview.md), [Principles](00_01_Principles.md), [Terminology](00_02_Terminology.md), and [Documentation rules](00_03_Documentation.md).
2. Copy the [`template/`](template) scaffold into the target project. Copy the released CRDD standard documents for the adopted version into its `00_CRDD/` folder and keep that version identifiable.
3. Read the shared authorities required for the work (`00_10`–`00_19`) and the applicable phase authorities (`00_21`–`00_29`). Read the [shared UI / Behavior Specification contract](00_24_UI_Behavior_Specification.md) before either parallel phase.
4. Use the project-root [`AGENTS.md`](template/AGENTS.md) or [`CLAUDE.md`](template/CLAUDE.md) as the AI entry point. Connect the active scope, target revision, canonical context, authority, applicable phase, and stop conditions instead of copying phase rules into prompts.
5. Before a phase transition, run the [Phase Transition Review](00_10_Agent.md#72-phase-transition-review-and-remediation-loop), remediate findings in the responsible phase, and re-review the updated revision before Human approval.
6. Before claiming CRDD conformance, evaluate the applicable Core and Profile criteria with current evidence using the [Conformance Audit](00_52_Conformance_Audit.md).

### Core Operating Boundaries

- Document numbers organize CRDD standard files; they are not Stable Context IDs. Standard Stable Context IDs are limited to `REQ`, `UX`, `IA`, `UI`, and `SPEC`. `CHG-*` identifies a Change Trace artifact, not stable product context.
- Keep Evidence inline or under the nearest parent folder's `Evidence/`. Reflect a Decision's result in the resulting Canonical Artifact and keep its rationale, evidence, alternatives, and history there. Do not use root-level Evidence or Decision folders as the default model.
- Use `01_Discovery` for new evidence, uncertainty, and requirements. Use `99_Roadmap` for accepted but deferred work by referencing requirements and other context; Roadmap items do not receive CRDD Stable Context IDs.
- Use `40_Develop` for code, configuration, migrations, build definitions, and tests—not for CRDD management Markdown.
- Use `07_Workflows` for repository-specific repeatable procedures. Use `90_Release/Changes/CHG-*.md` for Change Traces. Use the rest of `90_Release` only when the project needs release records, distribution references, or release verification.
- Treat governance, security, privacy, accessibility, compatibility, capacity, and cost as responsibilities of the applicable upstream and downstream phases rather than as detached end-stage checks.

The authoritative placement, artifact, Evidence, Decision, Stable Context ID, and traceability rules are in [Documentation](00_03_Documentation.md). The complete repository and document map is in the [Overview](00_00_Overview.md).

### Documentation Routes

| Need | Start here |
|---|---|
| Understand CRDD and its invariants | [Principles](00_01_Principles.md) |
| See the complete repository and document map | [Overview](00_00_Overview.md) |
| Resolve canonical concepts, status, and authority terms | [Terminology](00_02_Terminology.md) |
| Structure repositories, artifacts, evidence, decisions, IDs, and traces | [Documentation](00_03_Documentation.md) |
| Run or delegate AI work | [Agent](00_10_Agent.md) and [Skill](00_11_Skill.md) |
| Trace a change, release a product, or define a repeatable workflow | [Change](00_12_Change.md), [Release](00_13_Release.md), and [Workflow](00_14_Workflow.md) |
| Apply a product phase | Use the [phase authority map](00_00_Overview.md#33-product-phase-authorities), then read the applicable `00_21`–`00_29` authority |
| Maintain the CRDD standard itself | [Maintenance](00_19_Maintenance.md) |
| Audit documents, conformance, or cross-layer impact | [Document Audit](00_51_Document_Audit.md), [Conformance Audit](00_52_Conformance_Audit.md), and [Gap / Impact Audit](00_53_Gap_Impact_Audit.md) |

### License

CRDD's documentation and other copyrightable repository materials are licensed under [LICENSE](LICENSE) (CC BY-NC-SA 4.0) unless otherwise noted. For commercial use, see [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md). The names, marks, and logos associated with CRDD and Qual-Lab are governed separately by [TRADEMARK.md](TRADEMARK.md).

---

## 日本語

### CRDDとは？

AI協働開発は実装を高速化できる一方で、ProductのWhy——要望の起点、判断理由、却下した代替案、受容したRisk、設計意図——をChat Log、Ticket、Pull Requestの中で静かに劣化させることがある。

CRDDは、そのContextを保存・接続し、人間、AI、専門家が意味を無言で変えずにDiscoveryからVerificationまでProductを具体化できるようにする開発方法論である。Gitを利用するProjectでは、RepositoryをContext RepositoryのCanonical Control Planeとして利用し、Authorityを持つ外部Artifactも明示的な参照で接続できる。

AIはAuthorityの範囲内で探索、整理、比較、Draft、実装、検証を行える。人間は意味、価値、Priority、Approval、Risk受容、最終責任を保持する。CRDDは特定のAI Tool、Agent構成、文書Tool、技術Stackを要求しない。

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

UIとBehavior Specificationは共有Contractで接続された並行工程である。通常の工程移行前には、送信工程のExit、受信工程のEntry、Coverage、Trace、Unresolved Gapを対象Revisionに対してIndependent Reviewする。移行に影響するFindingは責務工程で修正し、更新Revisionを再ReviewしてからHuman Approvalへ進む。Reviewを省略できるのは、未Review範囲、Risk、Owner、必要な再Reviewを記録したHuman-directed Exceptionがある場合だけであり、部分Handoff自体は移行ScopeのReviewを免除しない。

### クイックスタート

1. [Overview](00_00_Overview.md)、[Principles](00_01_Principles.md)、[Terminology](00_02_Terminology.md)、[Documentation](00_03_Documentation.md)を読む。
2. [`template/`](template)のScaffoldを対象Projectへコピーする。採用するReleaseのCRDD標準文書を`00_CRDD/`へコピーし、採用Versionを識別可能にする。
3. 作業に必要な共通正本（`00_10`〜`00_19`）と対象工程の正本（`00_21`〜`00_29`）を読む。UIまたはBehavior Specificationへ進む前に、両者の[共有Contract](00_24_UI_Behavior_Specification.md)を読む。
4. Project Rootの[`AGENTS.md`](template/AGENTS.md)または[`CLAUDE.md`](template/CLAUDE.md)をAIの入口とする。工程RuleをPromptへ複製せず、Active Scope、Target Revision、Canonical Context、Authority、対象工程、Stop条件を接続する。
5. 工程移行前に[Phase Transition Review](00_10_Agent.md#72-phase-transition-review-and-remediation-loop)を実行し、責務工程でFindingを修正して更新Revisionを再Reviewした後にHuman Approvalへ進む。
6. CRDD準拠を表明する前に、[Conformance Audit](00_52_Conformance_Audit.md)に従って、適用されるCore / Profile Criteriaを現行Evidenceで評価する。

### 主要な運用境界

- Document NumberはCRDD標準文書の整理用であり、Stable Context IDではない。標準Stable Context IDは`REQ`、`UX`、`IA`、`UI`、`SPEC`に限定する。`CHG-*`はChange TraceのArtifact IDであり、Product ContextのStable IDではない。
- Evidenceは成果物内または最も近い親Folderの`Evidence/`へ置く。Decisionの結果は結果となるCanonical Artifactへ反映し、Rationale、Evidence、Alternative、Historyを同Artifactへ残す。Root直下のEvidence / Decision Folderを基本構成にしない。
- 新しいEvidence、不確実性、Requirementは`01_Discovery`へ置く。採用済みだが未着手の内容はRequirementや他のContextを参照して`99_Roadmap`へ置き、Roadmap項目へCRDD Stable Context IDを付与しない。
- `40_Develop`にはCode、Configuration、Migration、Build定義、Testを置き、CRDD管理用Markdownを置かない。
- `07_Workflows`にはRepository固有の反復可能な作業手順を置く。Change Traceは`90_Release/Changes/CHG-*.md`へ置く。その他の`90_Release`は、Release Record、配布物参照、Release Verificationが必要なProjectでだけ使用する。
- Governance、Security、Privacy、Accessibility、Compatibility、Capacity、Costは、終盤で独立して確認する項目ではなく、適用される上流・下流工程の責務として扱う。

配置、Artifact、Evidence、Decision、Stable Context ID、Traceabilityの正本は[Documentation](00_03_Documentation.md)、Repositoryと文書体系の完全な地図は[Overview](00_00_Overview.md)を参照する。

### 文書の導線

| 目的 | ここから読む |
|---|---|
| CRDDと不変条件を理解する | [Principles](00_01_Principles.md) |
| Repositoryと文書体系の全体像を確認する | [Overview](00_00_Overview.md) |
| Canonical Concept、Status、Authority用語を確認する | [Terminology](00_02_Terminology.md) |
| Repository、Artifact、Evidence、Decision、ID、Traceを設計する | [Documentation](00_03_Documentation.md) |
| AI作業を実行・委譲する | [Agent](00_10_Agent.md)と[Skill](00_11_Skill.md) |
| Change、Product Release、反復Workflowを扱う | [Change](00_12_Change.md)、[Release](00_13_Release.md)、[Workflow](00_14_Workflow.md) |
| Product工程を適用する | [工程正本Map](00_00_Overview.md#33-product-phase-authorities)から、該当する`00_21`〜`00_29`の正本を読む |
| CRDD標準自体を保守する | [Maintenance](00_19_Maintenance.md) |
| 文書、準拠、工程横断Impactを監査する | [Document Audit](00_51_Document_Audit.md)、[Conformance Audit](00_52_Conformance_Audit.md)、[Gap / Impact Audit](00_53_Gap_Impact_Audit.md) |

### ライセンス

CRDDの文書およびRepository内のその他の著作物は、特記がない限り[LICENSE](LICENSE)（CC BY-NC-SA 4.0）で提供する。商用利用は[COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md)を参照する。CRDDおよびQual-Labに関連する名称、商標、ロゴは[TRADEMARK.md](TRADEMARK.md)で別に扱う。
