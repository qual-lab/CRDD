# CRDD Overview

Version: v0.4.2
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-19
Related:
- [00_01_Principles.md](00_01_Principles.md)
- [00_02_Terminology.md](00_02_Terminology.md)
- [00_03_Documentation.md](00_03_Documentation.md)
- [00_52_Conformance_Audit.md](00_52_Conformance_Audit.md)

---

# Purpose

本書は、CRDD（Context Repository-Driven Development）の入口、Repository全体の地図、CRDD標準文書の責務、基本的な読む順序を示すOverviewである。

CRDDの定義・原則・人間とAIのAuthorityは[`00_01_Principles.md`](00_01_Principles.md)、Canonical Termは[`00_02_Terminology.md`](00_02_Terminology.md)、Repository・Artifact・Evidence・Decision・Stable Context ID・TraceabilityのRuleは[`00_03_Documentation.md`](00_03_Documentation.md)を正本とする。本書はそれらのRuleを再定義しない。本書の要約と正本文書が競合する場合は、対象Propertyの正本文書に従う。

---

# 1. Quick Orientation

CRDDは、ProjectのWhyと人間の判断を失わず、AIと専門家がそのContextを参照してProductを一気通貫で具体化・検証できるようにする開発方法論である。

```text
作業をAIへ。
判断を人間へ。
思想をContext Repositoryへ。
```

Context Repositoryは単なる文書置き場ではない。Origin、Intent、Decision、Evidence、Contract、Artifact Reference、Implementation、Verification、Learningを、人間とAIが継続利用できるように接続する情報基盤である。Git RepositoryはそのCanonical Control Planeになり得るが、Git、Markdown、Folder構成、AI Toolの採用だけでCRDD準拠になるわけではない。

CRDD準拠は、対象ScopeとRevisionに適用されるCriteriaおよびEvidenceによって評価する。詳細は[`00_52_Conformance_Audit.md`](00_52_Conformance_Audit.md)を参照する。

---

# 2. Product Context Repository Map

ProjectへCRDDを適用する場合、標準文書は原則として`00_CRDD/`に置く。本CRDD標準Repositoryでは、配布・保守対象である同文書群をRepository Rootに置く。

| Location | Primary Responsibility | Authority |
|---|---|---|
| `00_CRDD` | CRDD標準、共通実行Contract、工程条項、Audit Contract | 各正本文書（本書の3章を入口とする） |
| `01_Discovery` | Origin、Problem、Source、Evidence、不確実性、Requirement | [Discovery](00_21_Discovery.md) |
| `02_UX` | Actor、Outcome、Journey、Service Blueprint、Experience Principle | [UX](00_22_UX.md) |
| `03_IA` | Object、Relation、Responsibility、Navigation、Information Structure | [IA](00_23_IA.md) |
| `04_UI` | Screen、Interaction、Feedback、Visual、Design Token、Asset | [UI](00_25_UI.md) |
| `05_SPEC` | Condition、State、Behavior、Exception、Acceptance | [Behavior Specification](00_26_Behavior_Specification.md) |
| `06_Architecture` | System Boundary、Data、Interface、Quality、Security、Operation、Implementation Rule | [Architecture](00_27_Architecture.md) |
| `07_Workflows` | Repository固有の反復可能な作業手順、Runbook、Handoff | [Workflow](00_14_Workflow.md) |
| `40_Develop` | Code、Configuration、Migration、Build、Developer Test等のImplementation Artifact | [Implementation](00_28_Implementation.md) |
| `90_Release` | Change Trace、Release Record、CHANGELOG、配布物参照、Release Verification | [Change](00_12_Change.md)、[Release](00_13_Release.md) |
| `99_Roadmap` | 採用済みだが未着手のRequirementやContextを参照する将来計画 | [Documentation](00_03_Documentation.md#33-discovery-and-roadmap) |

UIとBehavior Specificationは直列工程ではない。両者は[`00_24_UI_Behavior_Specification.md`](00_24_UI_Behavior_Specification.md)を共有Contractとして、相互参照しながら並行して具体化する。

Evidenceは成果物内、または最も近い親Folderの`Evidence/`へ置く。Decisionの結果は結果となるCanonical Artifactへ反映し、Rationale、Evidence、Alternative、Historyを同Artifactへ残す。Root直下に中央Evidence Folderまたは中央Decision Folderを基本構成として設けない。詳細は[Documentation](00_03_Documentation.md)を正本とする。

`40_Develop`はImplementation Artifactの領域であり、CRDD管理用Markdownの配置先にしない。Code固有README等を実装と同居させる場合も、上流Contextや判断理由の正本として暗黙に扱わない。

---

# 3. CRDD Standard Map

## 3.1. Document Number Bands

文書番号は、CRDD文書の責務、分類、読む順序を補助するDocument Numberである。文書内のContext Entityを追跡するStable Context IDとは別の識別体系であり、一つの文書に複数のStable Context IDが含まれてよい。

| Band | Responsibility |
|---|---|
| `00`–`09` | 基礎規範：Overview、Principles、Terminology、Documentation |
| `10`–`19` | 共通実行・Delivery・CRDD保守：Agent、Skill、Change、Release、Workflow、Maintenance |
| `20`–`29` | Product工程条項とUI／Behavior Specification横断Contract |
| `30`–`49` | 予約 |
| `50`–`59` | 横断Audit Contract |

Stable Context IDの種類、付与境界、Document NumberおよびArtifact IDとの違いは[`00_03_Documentation.md`](00_03_Documentation.md#8-stable-context-id)を正本とする。`CHG-*`はChange TraceのArtifact IDであり、Stable Context IDではない。

## 3.2. Foundation and Shared Authorities

| File | Responsibility |
|---|---|
| `00_00_Overview.md` | CRDDへの入口、Repository Map、文書責務、読む順序 |
| `00_01_Principles.md` | CRDDの定義、基本信条、Conformance境界、人間／AI Authority、Context Continuity、工程遷移原則 |
| `00_02_Terminology.md` | Core Context Type、Supporting Concept、責務・Authority、Lifecycle / Status Term、Alias |
| `00_03_Documentation.md` | Repository、Artifact、文書記法、Evidence、Decision、Stable Context ID、Artifact Reference、Traceability |
| `00_10_Agent.md` | Agent共通Input / Output、Authority、委譲、Subagent統合、Review |
| `00_11_Skill.md` | Skill共通Lifecycle、Route、中断・再開、Review、Handoff、Git / Markdown実行Profile |
| `00_12_Change.md` | `90_Release/Changes/CHG-*.md`によるTrigger、変更意図、Expected / Actual Impact、実装、検証、CloseのTrace |
| `00_13_Release.md` | Product Releaseの最小Contract、Human Release Authority、Release Record、CHANGELOG、Release Verification |
| `00_14_Workflow.md` | `07_Workflows`へ置くRepository固有の反復可能な作業手順とHandoff |
| `00_19_Maintenance.md` | CRDD自身の変更、Learning Promotion、Version、Migration、Correction、Audit接続 |

## 3.3. Product Phase Authorities

`00_21`〜`00_23`および`00_25`〜`00_29`は、その工程のEntry、Transformation、Required Responsibility Coverage、Exit、Phase Gate Criteria、Audit Checklist、Guided Skill Adapterを一体として定義する。`00_24`は独立工程ではなく、UIとBehavior SpecificationのPair Review Contractである。

| File | Responsibility |
|---|---|
| `00_21_Discovery.md` | Discovery、Source / Evidence、不確実性、REQ昇格、Route |
| `00_22_UX.md` | Actor、Outcome、Journey、Service Blueprint、Experience Principle、UX Coverage |
| `00_23_IA.md` | Object、Relation、Responsibility、Navigation、Information Structure |
| `00_24_UI_Behavior_Specification.md` | UIとBehavior Specificationの相互参照、Pair、整合性、共同Reviewを定める横断Contract |
| `00_25_UI.md` | Screen、Interaction、State / Variant、Visual、Asset、Accessibility、UI Coverage |
| `00_26_Behavior_Specification.md` | Condition、State、Rule、Exception、Failure、Acceptance、SPEC Coverage |
| `00_27_Architecture.md` | System設計、Data、Interface、Quality、Security、Operation、Compatibility、Implementation Rule |
| `00_28_Implementation.md` | Code、Configuration、Migration、Build、Developer Test、Deviation、Implementation Evidence |
| `00_29_Verification.md` | 独立Test / Review、Fresh Evidence、Finding、Verification Result、Release Readiness Recommendation、Learning |

## 3.4. Audit Authorities

| File | Responsibility |
|---|---|
| `00_51_Document_Audit.md` | 文書構造、参照、用語、Authority、情報保存、TraceabilityのAudit |
| `00_52_Conformance_Audit.md` | CRDD Core / Profile Criteria、Required Evidence、Evaluation、Claim Eligibility |
| `00_53_Gap_Impact_Audit.md` | Relationを横断するGap / Impact探索、Disposition、再Review・再検証範囲 |

## 3.5. Repository-level Companion Artifacts

| Artifact | Responsibility |
|---|---|
| `README.md` | CRDD標準Repositoryの公開入口とQuick Start |
| `CHANGELOG.md` | CRDD標準自体のVersion間変更履歴。Product固有のCHANGELOGとは別に扱う |
| `template/` | ProjectへCRDDを導入するためのScaffoldとAI Entry File |

CRDD標準自体のVersion、CHANGELOG、Tag、Migrationは[`00_19_Maintenance.md`](00_19_Maintenance.md)を正本とする。Product固有ReleaseのCHANGELOGは[`00_13_Release.md`](00_13_Release.md)に従う。

---

# 4. Reading and Execution Routes

## 4.1. Foundation Route

新しく参加する人間またはAIは、最初に次を読む。

```text
00_00 Overview
  ↓
00_01 Principles
  ↓
00_02 Terminology
  ↓
00_03 Documentation
```

その後、実行主体に応じて`00_10_Agent.md`と`00_11_Skill.md`を読み、対象作業に必要な`00_12`〜`00_19`および工程文書だけを追加する。AI Entry Fileはこれらの正本を複製せず、Active Scope、Target Revision、対象工程、Canonical Context、Authority、Stop条件へ接続する。

## 4.2. Integrated Product, Change, Roadmap, and Learning Route

CRDDのProduct Transformation、Change、Roadmap、Release、Learningの関係は次のとおりである。

```text
Evidence・要望・法改正・不具合・運用結果・監査結果・Learning
                              │
                    意味や要求が不明確か
                      ┌───────┴───────┐
                     Yes              No
                      │                │
               00_21 Discovery   分類済みTrigger
                 ├─ 追加調査          │
                 │  / Researchへ戻る  │
                 └──────────┬─────────┘
                            ↓
                    Human Route Decision
                    ├─ 採用しない → Decision / No Action
                    ├─ 採用 + 延期
                    │       ↓
                    │  99_Roadmap Main
                    │  └─ Detail（必要時）
                    │       ↓
                    │  Start Condition / Re-evaluation Trigger
                    │       ↓
                    │  Human Start Review
                    │  ├─ 再延期 → Main / Trigger更新
                    │  ├─ Cancel → Decision / Rationale
                    │  └─ Start ─────────────────────┐
                    └─ 今回実施 ─────────────────────┤
                                                     ↓
                                         90_Release/Changes/CHG-*
                                             │
                           必要な工程を開始またはReopen
                                             ↓
                 00_22 UX → 00_23 IA → 00_24 Pair Contract
                                      ┌──────────┴──────────┐
                                      ↓                     ↓
                                00_25 UI   ⇄   00_26 Behavior Specification
                                      └──────────┬──────────┘
                                                 ↓
                                      00_27 Architecture
                                                 ↓
                                      00_28 Implementation
                                                 ↓
                                      00_29 Verification
                         ┌───────────────────────┼──────────────────────┐
                    未達・新Gap             Ready / Conditional       Learning
                         │                       │                      │
                 該当工程 / CHGへ戻る       Releaseが必要か       責務を持つ
                                             ┌──┴──┐          Canonical Contextへ
                                            No    Yes                  │
                                             │     │              必要ならDiscovery /
                                             │  Human Release          Roadmap / CHG
                                             │   Decision
                                             │     ↓
                                             │  00_13 / 90_Release
                                             └──┬──┘
                                                ↓
                                正本・CHG・結果参照を更新してClose
                                                ↓
                             Roadmap起点ならMainをCompletedへ更新し
                                  Detail固有情報を移管後にDetail削除
```

図の工程列は基本的な意味変換順を示す。すべてのChangeが全工程を通る意味ではなく、承認済みContextとImpactに応じて最も近い必要工程から開始またはReopenする。UIとBehavior Specificationは並行・反復し、Releaseは必要なProjectだけが使用する。

これは固定WaterfallやProject全体の一括Statusを表さない。Feature、Use Case、Change、Release等のScopeごとに、反復、並行、上流Reopen、Technical Spike、部分Handoffを行ってよい。ただし、Artifactの一部完成やSkill Run終了から工程完了を推定してはならない。通常の工程移行前には、送信Exitと受信Entryを対象Revisionに対してIndependent Reviewし、Findingを責務工程で修正して更新Revisionを再Reviewする。対象ScopeのRequired Responsibility CoverageとReview Passを満たすか、残っている未解決事項（Unresolved Gap）、Risk、Owner、Reopen条件、Review Exceptionを明示してHuman Authorityが例外的な移行を承認した場合にのみ次へ進む。

## 4.3. Cross-cutting Routes

| Need | Route |
|---|---|
| 変更Triggerから影響・実装・検証・Closeを追跡する | [Change](00_12_Change.md)に従い、必要な`CHG-*`を`90_Release/Changes/`へ置く |
| Repository固有の反復作業を定義する | [Workflow](00_14_Workflow.md)に従い、`07_Workflows`へ置く |
| 検証済みRevisionを配布・有効化する | [Verification](00_29_Verification.md)のReadiness RecommendationをProject固有Release Authorityへ渡し、必要な場合だけ[Release](00_13_Release.md)に従う |
| 採用済みだが未着手の内容を計画する | Requirementや関連Contextを参照して`99_Roadmap`へ置く |
| 文書品質を監査する | [Document Audit](00_51_Document_Audit.md) |
| CRDD準拠を評価する | [Conformance Audit](00_52_Conformance_Audit.md) |
| 変更の工程横断影響を調べる | [Gap / Impact Audit](00_53_Gap_Impact_Audit.md) |
| 工程移行前に独立Reviewし、Findingを修正・再確認する | [AgentのPhase Transition Review](00_10_Agent.md#72-phase-transition-review-and-remediation-loop)と送信・受信工程のPhase Process Contract |
| CRDD標準自体を変更する | [Maintenance](00_19_Maintenance.md) |

ReleaseはDiscoveryからVerificationまでと同じ設計工程ではない。Verificationの後に常に`90_Release`へ進むのではなく、配布・有効化を行うProjectで必要な場合にだけ、Human Release Decisionを経て使用する。
