<a id="crdd-documentation"></a>

# CRDD文書規則（Documentation）

Version: v0.5.1
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-22
Related:
- [00_Overview.md](00_Overview.md)
- [01_Principles.md](01_Principles.md)
- [02_Terminology.md](02_Terminology.md)
- [10_Agent.md](10_Agent.md)
- [11_Skill.md](11_Skill.md)
- [12_Change.md](12_Change.md)
- [13_Release.md](13_Release.md)
- [14_Workflow.md](14_Workflow.md)
- [51_Document_Audit.md](51_Document_Audit.md)
- [52_Conformance_Audit.md](52_Conformance_Audit.md)
- [53_Gap_Impact_Audit.md](53_Gap_Impact_Audit.md)

---

> この文書で分かること（非規範の案内）
>
> - 文書や成果物をどこへ置き、何を正本として扱うか
> - 根拠、判断理由、安定ID、参照関係をどう残すか
> - 人間とAIの双方が読み違えにくい文書をどう書くか
> - 規範の強さと、利用者の主要言語をどう表現するか
> - 文書を更新、廃止、削除するときに何を守るか

<a id="1-responsibility-and-boundary"></a>

# 1. 責務と適用範囲（Responsibility and Boundary）

本書は、CRDDにおけるRepository構造、ArtifactとDocumentの表現、Evidence、Decision / Rationale、Stable Context ID、Artifact Reference、Traceabilityの共通規則を定義するDocumentationの正本である。

本書が所有しない情報は、次の文書を正本とする。

- Context TypeとStatusのCanonical Definition: [Terminology](02_Terminology.md)
- 人間とAIのAuthority、一気通貫のContext継続性: [Principles](01_Principles.md)
- Change Trace: [Change](12_Change.md)
- Release: [Release](13_Release.md)
- Repository固有の作業手順: [Workflow](14_Workflow.md)

工程固有のEntry、Transformation、Required Responsibility Coverage、Exit、Gate、Auditは、各工程文書を正本とする。本書では複製しない。

CRDD Documentationは文書量を増やすための規定ではない。人間とAIが、現在有効なContext、Source、判断理由、実装、検証、Learningを同じ意味で辿れる状態を作る。

DocumentとArtifactは、人間とAIの双方が誤読しにくい構造にする。

```text
目的または結論を先に示す
一つのDocumentまたはSectionへ一つの主題を置く
主要ロケールの表示名を使い、必要な初出でCanonical Termを併記する
曖昧な「これ」「それ」「最新」を避ける
比較、Mapping、Status、AuthorityにはTableを使う
並列Rule、条件、成果、確認項目にはListを使う
Observation、Evidence、Interpretation、Hypothesis、Proposal、Decisionを混同しない
採用案と判断価値のあるAlternativeを区別する
```

Canonical Termの定義は[Terminology](02_Terminology.md)を正本とし、本書で再定義しない。本文は対象読者の主要ロケールを優先し、表示名とCanonical Termの境界は4.8に従う。

---

<a id="2-repository-and-source-of-truth"></a>

# 2. Repositoryと正本（Source of Truth）

## 2.1. Context Repository

Context Repositoryの定義と基本原則は[Principles](01_Principles.md)を正本とする。本書では、その論理的な情報基盤をRepository構造、Authority宣言、Artifact Reference、Relation、履歴として実現する規則を定める。

CRDDの基本構成ではGit RepositoryをCanonical Control Planeとして使用する。ただし、すべてのPropertyをMarkdownへ複製することや、Gitだけを唯一のAuthorityとすることを意味しない。

```text
Git Repository
= Repository内Canonical Context
+ Property Authorityの宣言
+ 外部Artifactへの安定した参照
+ Relation、Review、変更履歴
```

## 2.2. Property Authority

Source of TruthはArtifact全体ではなく、必要に応じてProperty単位で定義する。

Repository内の工程別PropertyとPhase / Process Authorityは3.1の構造表を正本とする。Current ImplementationはCode、Configuration、Runtimeを、Verification Resultは対象RevisionとEnvironmentが明確なFresh EvidenceをAuthorityとする。Repository外のArtifactがAuthorityを持つ場合は、対象Propertyと参照方法を宣言する。

Jira、Redmine、GitHub Issues、Backlog等は通常Task Viewであり、Change Traceそのものではない。必要な場合は`CHG-*`からArtifact Referenceで接続する。Figma等はVisual PropertyのAuthorityになり得る。外部Document、Data Store、CI、Test Systemも、Property、Source、Revision、Access方法を明示すればAuthorityまたはEvidenceになり得る。

Git履歴は差分と時系列のEvidenceであり、判断理由そのものを自動的に説明しない。重要なRationaleは責務を持つCanonical Artifactへ残す。

## 2.3. Conflict Resolution

ConflictはFolder番号だけで解決しない。Property Authority、対象Scope、Revision、Status、Decision、Source、Freshnessを比較する。

古いContextと新しい判断が競合する場合、一方を無言で上書きしない。次のいずれかを行う。

```text
Authorityを持つCanonical Artifactへ判断結果とRationaleを反映する
新旧ContextをRelationで接続する
StatusをSuperseded / Deprecated / Retiredへ変更する
移行中、Conflict、再確認条件を明示する
Human Authorityへ判断を戻す
```

宣言された外部Authorityを取得できない、削除された、またはRevisionを確認できない場合は、最後に検証できたArtifact Reference、確認時点、参照不能である事実を保持する。検証不能な複製を無言でAuthorityへ昇格せず、代替Authorityの指定または復旧判断をHuman Authorityへ戻す。

---

<a id="3-repository-structure-and-placement"></a>

# 3. Repository構造と配置

## 3.1. Basic Structure

```text
00_CRDD
01_Discovery
02_UX
03_IA
04_UI
05_SPEC
06_Architecture
07_Workflows
40_Develop
90_Release
99_Roadmap
```

| Folder | Product Context Responsibility | Phase / Process Authority |
|---|---|---|
| `00_CRDD` | CRDD原則、共通Contract、工程条項、監査規則 | `00_CRDD`内の該当Canonical Document |
| `01_Discovery` | Origin、Problem、Source、Evidence、不確実性、Requirement | [Discovery](21_Discovery.md) |
| `02_UX` | Actor、Outcome、Journey、Service Blueprint、Experience Principle | [UX](22_UX.md) |
| `03_IA` | Object、Relation、Responsibility、Navigation、Domain用語 | [IA](23_IA.md) |
| `04_UI` | Surface、Interaction、Feedback、Visual、UI Asset | [UI](25_UI.md) |
| `05_SPEC` | Condition、State、System Behavior、Exception、Acceptance | [Behavior Specification](26_Behavior_Specification.md) |
| `06_Architecture` | Boundary、Data、Interface、Quality、Security、Implementation Rule | [Architecture](27_Architecture.md) |
| `07_Workflows` | Repository固有の反復可能な作業手順、Runbook、手順間Handoff | [Workflow](14_Workflow.md) |
| `40_Develop` | Code、Configuration、Developer Test等のImplementation Artifact | [Implementation](28_Implementation.md) |
| `90_Release` | `CHG-*` Change Trace、Release Record、CHANGELOG、配布物参照、Release Verification | [Change](12_Change.md)、[Release](13_Release.md)、Project固有のRelease Authority |
| `99_Roadmap` | 採用済みDeferred WorkのPriority、Target、Dependency、着手条件 | Project固有のRoadmap Authority |

工程固有のArtifact Mapping、Template、Coverageは上表のPhase / Process Authorityを正本とする。`04_UI`と`05_SPEC`の番号は探索順であり、直列工程やAuthority優先度を意味しない。UI ContractとBehavior Specificationは並行・反復して対として接続するが、同じProperty Authorityへ統合しない。

Evidenceの配置は6.2、Decisionの配置は7.1を正本とする。Repository構造へ中央Evidence Folderまたは中央Decision Folderを追加しない。

## 3.2. Implementation Placement

`40_Develop`はCRDD管理用Markdownの保存先として使用しない。Change Traceは`90_Release/Changes/`、Repository固有の反復作業手順は`07_Workflows`へ置く。Implementation Planは使用するProject固有ToolまたはWorkflowから参照し、CRDD標準の恒久Folderを追加しない。Code固有READMEを実装と同居させる場合も、Contextや判断理由の正本として暗黙に扱わない。

## 3.3. Discovery and Roadmap

`01_Discovery`は、新しいSource、Evidence、不確実性、Requirementの入口であり、`REQ-*`の正本を保持する。

`99_Roadmap`は、採用済みだが未着手の内容を、Requirementや他のContextへの参照とともに計画する。Roadmapは原則として単一の`99_Roadmap/01_Product_Roadmap.md`で管理する。比較、調査、依存関係等の詳細がMain Viewの可読性を損なう場合だけ、別のDetail Fileへ分ける。

Roadmap Itemの必須Context、Lifecycle、登録・再評価・着手・Detail削除条件は、[Discovery](21_Discovery.md#63-roadmap-item-contract)を正本とする。

Discovery文書をRoadmapへ移動せず、Roadmap項目をRequirementまたはSpecificationの正本として扱わない。Roadmap項目またはDetail FileへCRDD標準Stable Context IDを発行せず、Path、Anchor、外部Issue等で識別する。完了したDetail FileをRoadmap Archiveとして恒久保存しない。

---

<a id="4-artifact-and-document-contract"></a>

# 4. 成果物と文書の契約

## 4.1. Artifact and Context

ArtifactはContextを表現、保存、実行、検証する媒体である。ArtifactとContextの意味を同一視しない。一つのArtifactに複数Contextを含めても、一つのContextを複数Artifactで表現してもよい。

CRDDが要求するのは責務Coverageであり、固定ファイル数ではない。

```text
統合時もSectionとProperty Authorityを区別する
分割時もSource ContextとRelationを保つ
配置変更だけでStable Contextの意味を変えない
一部Artifactの完成度から工程全体の完了を推定しない
```

## 4.2. Connected Contract

重要Artifactは独立した説明資料ではなく、上流Contextを受け取り、専門責務へ変換し、下流へ義務を渡すContractとして扱う。

```text
Source Context
→ Preserved Intent
→ Decision / Definition
→ Downstream Obligation
→ Verification
```

## 4.3. Common Artifact Contract

重要ArtifactはRiskと責務に応じて次を取得可能にする。

```text
Title / Purpose
Status / Version / Revision
Owner / Property Authority
Source Context / Artifact Reference
Preserved Intent / Non-goal
Decision / Definition
Assumption / Open Question
Downstream Obligation
Evidence / Limitation
Relation
Verification
Last Reviewed
```

すべてを同じHeaderやTemplateへ機械的に表示する必要はない。Header、本文、Index、Code、外部Toolへ分散してよいが、Authorityと取得方法を識別できなければならない。Canonical Markdown Documentでは4.4以降の表現規則を使用し、他媒体では同等のPropertyを媒体に適した形で保持する。

## 4.4. Markdown Header

CRDD標準文書は、次のHeaderを持たなければならない。Canonical Markdown Documentは、Document TypeとRiskに応じて同等のPropertyをHeader、本文、Indexまたは管理Systemから取得可能にする。すべてのArtifactへ同一Headerを機械的に要求しない。

```markdown
# Title

Version: v1.0.0
Status: Draft
Owner: Responsible Team or Human
Last Updated: yyyy-mm-dd
Related:
- [01_Principles.md](01_Principles.md)
```

| Item | Meaning |
|---|---|
| `Version` | 公開または運用上識別する文書Version |
| `Status` | 文書の現在状態。Canonical MeaningはTerminologyに従う |
| `Owner` | 維持、Review、廃止、Escalationを管理する人間または組織 |
| `Last Updated` | 内容を最後に更新した日。Revisionの代用ではない |
| `Related` | 直接参照する正本、依存Contract、主要Handoff先へのクリック可能なLink |

CRDD標準文書のHeaderは、`Version`、`Status`、`Owner`、Document Type固有の識別Field、`Last Updated`、`Related`の順を基本とする。`Related`は実行時Read Setの全列挙ではなく、直接関係する正本への探索導線である。CRDD標準文書はDocument Numberの昇順に並べ、Link Textにも実ファイル名を示す。`CHANGELOG.md`等の番号を持たないRepository-level Artifactは番号付き文書の後へ置く。

実行時Read Setは、Overview、Principles、Terminology、Documentationを基礎に、Active Scope、Target Revision、実行主体、対象工程、Change / Release / Workflow、Auditの必要性に応じて追加する。`Related`にないことを、必要な正本を読まない理由にしてはならない。一方、対象Scopeと無関係な全標準文書を常時読み込み、Authorityや現行Contextの識別を曖昧にしない。

OwnerとAuthor、AI利用、Reviewer、Approverを混同しない。必要な場合は`Authority`、`Revision`、`Reviewed By`、`Approved By`、`Drafted By`等を、Document Typeごとに意味を定義して追加する。

AIが草案を作成しても、Ownerを`AI Draft`へ置き換えない。未承認案は`Status: Draft`とし、必要に応じて`Drafted By: AI`またはProvenanceを記録する。AIは自分のDraftをHuman Approvedとして確定しない。

## 4.5. Version, Revision, Baseline, and Date

```text
Version      = 公開・配布・運用上の版
Revision     = Git Commit、Artifact Revision等の特定可能な内容状態
Baseline     = ReviewやVerification対象として固定したRevision Set
Last Updated = 人間向けの更新日表示
```

`latest`や日付だけを、対象Revisionの代用にしない。Verification、Evidence、Approval、外部Artifact参照では必要な粒度でRevisionまたはBaselineを示す。

## 4.6. File Name and Document Number

ファイル名は目的を推測できる英語ベースを基本とする。文書番号はFolderまたは文書体系内の分類、順序、探索に使用する。Stable Context IDとの境界は8.1を正本とする。

`00_CRDD/`内のCRDD正本文書は、Folder番号をファイル名へ重ねず、二桁のDocument Numberを一度だけ先頭へ置く。本CRDD標準RepositoryのRootに置く配布・保守対象文書も同じ名前を使用する。

```text
Good: 00_CRDD/01_Principles.md
Good: 00_CRDD/27_Architecture.md
Bad:  00_CRDD/01_Principles.md
Bad:  00_CRDD/27_Architecture.md
```

先頭の`00_CRDD`は配置Folder、`01`や`27`はそのFolder内のDocument Numberであり、連結した`01`や`27`をDocument Numberまたはファイル名として使用しない。

```text
Document Number
= Folderまたは文書体系内の分類、順序、探索用番号
```

```text
Good:
02_UX/01_Experience_Principles.md
07_Workflows/01_Document_Review.md
90_Release/Changes/CHG-000042_Topic_Decision_Experience.md

Bad:
memo.md
latest.md
02_UX/02.md
05_SPEC/new_specification.md
```

文書番号は再構成、挿入、統合、分割に伴って変更してよい。番号を文書の永続的な意味識別子として扱わない。

## 4.7. Heading and Link

Headingは内容と責務を示し、同一Document内で曖昧または重複するAnchorを避ける。実在するRepository文書は、内容を推測できるLink Textと相対Markdown Linkで参照する。存在しないTemplate PathはLinkにせずplaceholderとして示す。

LinkだけではContinuityにならない。重要な接続はRelationの意味、対象Revision、Source / Targetを必要な粒度で示す。

外部または長期参照されるHeadingやAnchorを変更する場合は、Repository内の参照元を同じ変更で更新する。参照元を更新できない場合は、旧Anchorを維持するか、旧参照から新しい位置を特定できる移行情報を残し、無言で参照を切断しない。

<a id="48-normative-language"></a>

## 4.8. ロケールと規範表現（Normative Language）

### 4.8.1. 利用者ロケールを優先した表示

説明文、見出し、表の項目名、質問、判断支援は、対象読者または利用者の主要ロケールを優先する。共通参照が必要なCRDD用語は、初出時または用語集で「ローカル表示名（Canonical English Term）」として示し、同じ節で英語名を不必要に繰り返さない。

```yaml
locale:
  primary: ja-JP
  canonical_term_language: en
```

この例は表示方針を示すものであり、すべてのArtifactへ同じMetadataを要求しない。

ローカライズしてよいものは、説明文、見出し、表の表示項目名、状態の説明、読者への指示、流れと責務の説明である。Canonical Term、Stable Context ID、Agent ID、File名、Schema Key / Value、Code、外部規格の正式名称は、互換性を持つ識別子として無断で翻訳または変更しない。

厳密さだけを理由に、説明を英語用語の連続へ圧縮しない。文書では次を優先する。

- 結論または一言説明を先に示す
- 条件、決定権限、禁止、例外、完了条件を必要に応じて分ける
- 一文に複数の独立した義務を詰め込まない
- 並列事項は箇条書きまたは表で示す
- 専門用語だけで説明を完結させず、主要ロケールで平易な意味を添える

CRDD標準文書は、正式な目的と適用範囲の前に、非規範の「この文書で分かること」を短く置いてよい。この案内は本文のRule、Authority、適用範囲を追加または変更しない。

採用Projectは、対象利用者に適したロケールと表現方法を選べる。ローカライズの有無だけでCRDD Conformanceを判定しない。ただし、翻訳や表示名によってRule、Authority、Status、識別子、Handoffの意味が変わる場合は、不整合として扱う。

### 4.8.2. 規範強度語彙

CRDD文書では、BCP 14（RFC 2119およびRFC 8174）の意味で、選択した規範強度語彙を使用する。

| 日本語表示 | Canonical Keyword | 意味 |
|---|---|---|
| 必須 | `MUST` | 適用範囲で例外を認めない絶対要件 |
| 禁止 | `MUST NOT` | 適用範囲で例外を認めない絶対禁止 |
| 推奨 | `SHOULD` | 原則として従う。逸脱する場合は、理由と影響を理解して比較する |
| 原則禁止 | `SHOULD NOT` | 原則として避ける。実施する場合は、理由と影響を理解して比較する |
| 任意 | `MAY` | 採用してもしなくてもよい選択肢 |

英語のKeywordは、表に示す大文字表記の場合だけBCP 14の規範的意味を持つ。小文字の`must`、`should`等は通常の英語として扱う。日本語では、「しなければならない」「してはならない」「すべきである」「すべきではない」「してよい」等、意味上同等の明示的な表現もRuleとして解釈する。

EARS等の外部構文、Code、Schema、引用に含まれる小文字の`shall`等は、その構文またはSourceの定義に従う。大文字でない語へBCP 14の意味を自動適用しない。

`REQUIRED`、`SHALL`、`SHALL NOT`、`RECOMMENDED`、`NOT RECOMMENDED`、`OPTIONAL`はBCP 14上の対応語だが、CRDD本文では語彙を増やさず、原則として`MUST`、`MUST NOT`、`SHOULD`、`SHOULD NOT`、`MAY`を使用する。

規範強度はRuleの強さを示し、Document Status、Property Authority、Human Approvalを代替しない。`Draft`または`Experimental`な文書に記載された`MUST`は、その文書自体が承認・適用されたことを意味しない。一方、`Stable`な文書の説明文が、規範語彙を伴わず自動的に必須Ruleになるわけでもない。適用可否は、対象Scope、Document Status、Property Authority、必要なHuman Approvalと合わせて判断する。

## 4.9. External Source Trace

CRDD Rule、構文、評価観点へ外部標準、論文、原則、Guidelineを実質的に使用する場合、[OverviewのSource索引](00_Overview.md#36-external-foundations-and-source-trace)と対象文書から、Source、Versionまたは発行日、Authoritative URL / DOI、Relation、適用Section、Coverageを取得可能にする。名称が似ていることだけを理由に、後から`derived_from`または出典として登録しない。

| Relation | Meaning |
|---|---|
| `uses` | 語彙、構文、方法を直接使用する |
| `derived_from` | Sourceの特定内容をCRDD Ruleへ変換する |
| `aligned_with` | 整合を確認するが、準拠または完全な導出を主張しない |
| `informed_by` | 設計、比較、Problem発見の参考にする |
| `project_adopts` | 適用ProjectがSource、Version、Level、Platform、Scopeを選択する |

Coverageは、少なくとも次を区別する。

- `Referenced`
- `Selected Concepts`
- `Clause-mapped`
- `Fully Assessed`

`Referenced`または`Selected Concepts`は、Source全体の網羅を意味しない。`aligned_with`または`informed_by`だけで準拠を主張してはならない。

`Clause-mapped`または`Fully Assessed`を主張する場合は、適用Clause / Criterion、非適用理由、対応するCRDD Rule、対象Revision、評価Evidenceを追跡可能にする。

Reference Keyは引用Labelであり、Stable Context ID、Document Number、Artifact IDではない。外部Sourceの本文をCRDDへ不必要に複製せず、長期参照に適したVersion付きURL、DOI、発行主体等を優先する。SourceのVersionまたは適用範囲が変わった場合は、影響するCRDD条項とProject Profileを再確認する。

4.8の規範強度語彙は`BCP14`（`RFC2119` / `RFC8174`）を`uses`として使用し、選択した語彙と大文字・小文字の境界だけを適用する。RFC全体への準拠または網羅は主張しない。

---

<a id="5-status-update-and-retirement"></a>

# 5. 状態・更新・廃止

## 5.1. Status

StatusのCanonical Meaningは[Terminology](02_Terminology.md)を正本とする。Documentで主に使用するStatusは次のとおりである。

| Status | Document Meaning |
|---|---|
| `Draft` | 作成中で、採用前 |
| `Reviewed` | 指定Reviewerが確認済み。承認を意味しない |
| `Approved` | 定義済みAuthorityが対象用途で正式承認した |
| `Stable` | 対象Scopeで通常利用可能。将来不変を意味しない |
| `Superseded` | 後続DocumentまたはContextに置き換えられた |
| `Deprecated` | 使用を避けるが、互換性や履歴のため残す |
| `Retired` | 現在および将来の利用対象から廃止された |

Document Statusを、内部に含まれる全Context、実装、VerificationのStatusへ自動伝播させない。

## 5.2. Update and History

重要な更新では、何が、なぜ、どのAuthorityとEvidenceに基づき変わり、どのScopeとArtifactへ影響するかを説明可能にする。結果となるCanonical Artifactを更新し、Git履歴だけで理由や影響範囲を再現できない場合はDecision / RationaleまたはChange Traceへ残す。

## 5.3. Superseded, Deprecated, and Deletion

古い文書は原則として保持し、無断で削除しない。現在も履歴または参照先として価値がある場合は`Superseded`、`Deprecated`、`Retired`を使用し、後継がある場合はLinkする。

文書整備、重複統合、責務移管、誤生成物の除去等により、残すことが重複、矛盾、誤参照の原因になる場合は、人間の承認により削除できる。削除前に次を確認する。

```text
固有のContext、Decision / Rationale、Evidence、Historyが移管または不要と判断されている
Link、Index、Related、Artifact Referenceが更新されている
後継Canonical ArtifactとAuthorityが明確である
Git履歴、Change Trace、または承認記録から削除理由を確認できる
```

機密情報、個人情報、権利侵害、Security Risk等では、通常の履歴保持より安全、法令、契約上の要請を優先する。

---

<a id="6-evidence-and-provenance"></a>

# 6. 根拠と来歴（Evidence and Provenance）

## 6.1. Evidence Boundary

Evidenceは確認可能な根拠であり、Interpretation、Requirement、Decisionと同一ではない。Raw Voice、Observation、法令、既存資料、Log、Test Result等をEvidenceとして利用し、人間の解釈と判断を経てCanonical Contextへ反映する。

長大な生Log、文脈のないScreenshot、出典不明のMemo、AIが生成した未検証推測を、そのままCanonical Contextへ昇格しない。必要なSource、要約、条件、解釈、限界を付ける。

## 6.2. Inline, File, and External Evidence

短く一つのArtifactだけで使うEvidenceはInlineにできる。複数Artifactから参照する、量が多い、独立Reviewや再現が必要な場合は最寄りの`Evidence/`、または外部Artifactを使用する。

External Evidenceは複製を必須にしない。外部Artifact ID、URL、Revision、取得時点、Authority、Access条件を必要な粒度で保持する。

## 6.3. Minimum Evidence Properties

Evidenceを成果物の根拠として使う場合、Riskに応じて次を追跡可能にする。

```yaml
evidence:
  subject: 未読の重要Topicを利用者が識別できるか
  source: customer interview
  source_reference: interview-2026-07-01
  source_revision: rev-2
  observed_at: 2026-07-01
  acquisition_condition: moderated remote session
  finding: 5名中4名が重要Topicの見落としを報告した
  supports_context:
    - REQ-000012
  limitation:
    - one organization
  provenance: Observed
  owner: UX Research
```

必要に応じてConsent / Legal Basis、Confidentiality、Access、Redaction、Retention、Deletion条件も保持する。Evidence専用のCRDD Stable IDは要求せず、Artifact Referenceで追跡する。

## 6.4. Freshness, Conflict, and Lifecycle

Evidenceは取得時点、条件、対象Scope / Revisionを示す。Lifecycle StatusはTerminologyのEvidence定義に従い、独自の同義Statusを増やさない。

新Evidenceが旧Evidenceと食い違う場合、旧記録を黙って削除しない。Freshness、条件差、適用範囲、Source、Conflict、置換関係を示し、必要なHuman Decisionへ戻す。

---

<a id="7-decision-and-rationale"></a>

# 7. 判断と判断理由（Decision and Rationale）

## 7.1. Storage and Authority

Decisionの結果は、結果となるCanonical Artifactへ反映する。理由、Evidence、Alternative、Consequences、Historyを同ArtifactのDecision / Rationale Sectionへ残す。

複数Artifactへ影響する場合は、判断責任を持つ主Artifactを一つ定め、他のArtifactからPathとAnchorで参照する。同じRationaleを複数箇所で手動管理しない。

Architecture Decision Record等の領域固有形式を使用してよいが、全Decisionを集めるRoot直下の中央台帳や、CRDD標準Decision ID体系として扱わない。

## 7.2. When to Record

```text
OriginまたはProduct Principleへ影響する
複数案から重要方針を選ぶ
UX、IA、UI、Behavior、Architectureの責務やContractを変更する
Compatibilityを破壊する
重大Riskを受容する
将来同じ理由を再利用する
既存Decisionを置き換える
```

軽微な誤字、意味を変えない整形、既存Ruleどおりの機械変更へ重いRationaleを要求しない。

## 7.3. Minimum Structure

```markdown
## Decision / Rationale

### Adopted
成果物へ反映した判断結果

### Why
採用理由と守るIntent

### Evidence
参照Evidence、Source、Revision

### Alternatives
比較した案と不採用理由

### Consequences
影響、Trade-off、受容Risk

### History
変更日、Authority、置換前判断、再検討条件
```

Riskが低い場合は`Adopted`、`Why`、`Evidence`へ縮小してよい。AIはCandidate、Alternative、Impact、Rationale Draftを整理できるが、Human Decisionとして自己承認しない。

判断が変わった場合、旧判断、変更理由、新Evidence、Authority、影響範囲、再検討条件を追跡可能にする。

---

<a id="8-stable-context-id"></a>

# 8. 安定コンテキストID（Stable Context ID）

## 8.1. Boundary

Stable Context IDは、Artifactの場所に依存せず、複数Artifactまたは工程をまたいで追跡する意味を識別する。一つのArtifactに複数Stable Contextを含めてよい。

```text
05_SPEC/01_Topic_Behavior.md
├─ SPEC-000041
├─ SPEC-000044
└─ SPEC-000052
```

Document NumberはArtifactの分類・順序・探索用であり、Stable IDとは別の名前空間である。文書移動、名称変更、統合、分割、再採番だけを理由にStable IDを変更しない。

Stable IDをファイル名やDirectory名へ埋め込まない。Artifactの識別は文書番号またはArtifact Reference、Artifact内で追跡する意味の識別はStable IDが担う。

## 8.2. Standard Format and Prefix

```text
<PREFIX>-<SEQUENCE>
```

| Prefix | Meaning |
|---|---|
| `REQ` | Discoveryで確定したRequirement |
| `UX` | UX Outcome、Experience Principle等 |
| `IA` | Object、Responsibility、Navigation等 |
| `UI` | 認識、操作、Feedback、StateのUI Contract |
| `SPEC` | Condition、State、System Behavior、Exception、Acceptance |

`ARC`、`DEC`、`EVD`、Test用のCRDD標準Stable Context Prefixを新規発行しない。`CHG-*`は[Change](12_Change.md)が定義するChange Trace用Artifact IDであり、本節のStable Context IDには含めない。Stable Context IDへ名称、画面名、日付、Release、Feature名を埋め込まない。

## 8.3. Assignment and Allocation

次のいずれかに該当するREQ、UX、IA、UI、SPECへ付与する。

```text
複数Artifactから参照される
別専門層へ変換される
独立Review、承認、置換される
変更影響を長期追跡する
同じ意味を再発見する必要がある
```

生の会話、一時Memo、全Paragraph、全Figma Layer、Evidence File、Decision Section、Architectureの全Section、実装内部処理へ機械的に付与しない。

採番方法は特定FolderやRegistryを要求しない。ただし、Projectは採番責任を持つHuman、Team、またはToolと採番手順を明示する。Repository内でPrefixごとの重複を防ぎ、発行済み・Superseded・Retiredを含むSequenceを再利用しない。並行発行時は一つのAllocator、Index、Tool、またはReview手順で衝突を防ぐ。

## 8.4. Minimum Context Record

```yaml
id: SPEC-000044
type: SPEC
title: 未読重要Topicの既読更新
status: Approved
source:
  artifact: 05_SPEC/01_Topic_Behavior.md
  anchor: mark-important-topic-as-read
relations:
  - type: addresses
    target: REQ-000012
  - type: pairs_with
    target: UI-000021
last_updated: 2026-07-17
```

最低限、ID、Type、Title、Status、Sourceを持ち、必要に応じてOwner、Authority、Revision、Relation、Last Reviewedを持つ。Status Lifecycleは各Context TypeのCanonical Definitionに従い、Stable ID専用の一律Lifecycleを作らない。

## 8.5. Legacy IDs

Legacy Projectへ一括改番を要求しない。既存の非標準Prefixや旧意味のIDは履歴を破壊せず参照可能に保つが、新規標準Prefixとして発行しない。意味、責務、Contractが別物になる場合だけ新IDを発行し、旧IDを`supersedes`等で接続する。

Version固有の変更内容とMigration Noteは[Maintenance](19_Maintenance.md)および`CHANGELOG.md`を正本とする。

---

<a id="9-artifact-reference-and-traceability"></a>

# 9. 成果物参照と追跡可能性

## 9.1. Artifact Reference

Stable IDを付与しないArchitecture、Evidence、Decision、Change Trace、Implementation、Test、Release、外部ArtifactはArtifact Referenceで接続する。

Riskと媒体に応じて次を識別可能にする。

```yaml
artifact_reference:
  type: figma
  locator: external-file-or-node-id
  anchor: optional-section-or-node
  revision: version-or-checksum
  property_authority: visual
  owner: Design Team
  last_verified: 2026-07-17
```

Git ArtifactではPath、Anchor、Commit / Revision、外部SystemではURL、Record ID、Version、取得方法等を使用する。`latest`、ファイル名だけ、壊れやすいSession URLだけで重要Artifactを参照しない。

## 9.2. Standard Relations

| Relation | Meaning |
|---|---|
| `derived_from` | 上流Contextから変換・具体化された |
| `addresses` | Requirementの解決へ寄与する |
| `realizes` | UX Outcomeや原則を実現する |
| `specified_by` | RequirementがBehavior Specificationで具体化される |
| `pairs_with` | UI ContractとBehavior Specificationが対応する |
| `constrains` | 下流へ守る条件を与える |
| `depends_on` | 成立に別Contextを必要とする |
| `supersedes` | 新Contextが旧Contextを置き換える |
| `implemented_by` | Stable ContextをImplementation Artifactへ接続する |
| `verified_by` | ContextまたはArtifactをVerification Evidenceへ接続する |

RelationはSource、Target、意味、対象Revisionを必要な粒度で保持する。新しい同義Relationを無制限に増やさず、標準Relationで表現できない場合は意味を定義する。

## 9.3. Index

Stable Contextの所在と状態を一覧化するIndexを置いてよいが、特定Directoryは要求しない。Indexは正本全文のCopyではなく、ID、Type、Title、Status、Sourceを発見するViewである。

Relation Indexを使用する場合はFrom、Relation、To、Statusを最低限持ち、必要に応じてSource、Revision、Change Trace、Notesを持つ。IndexとCanonical Artifactが競合した場合、宣言されたProperty Authorityへ戻す。

## 9.4. Requirement to Verification

```text
Source / Evidence / Problem / Need or Desired Outcome
  -> REQ-000012
REQ-000012 specified_by SPEC-000044
UI-000021 pairs_with SPEC-000044
SPEC-000044 implemented_by path/to/implementation
SPEC-000044 verified_by test-or-evidence-reference
```

Traceは単一の固定Chainを要求しない。REQはDiscovery Source、Problem、Need / Desired Outcomeからの由来を辿れ、UX / IA / UI / SPECはそれぞれのProperty Authorityに従ってREQを変換する。一つのRequirementを複数SPECが具体化してよく、一つのSPECが複数Requirementへ寄与してよい。重要な下流成果物から上流のIntentとDecisionへ遡れ、上流変更から影響するArtifactを確認できなければならない。

---

<a id="10-documentation-scale-and-patterns"></a>

# 10. 文書規模と構成Pattern

## 10.1. Scale

| Scale | Use | Documentation |
|---|---|---|
| Compact | 小規模、単一Scope、既知Rule内 | 既存ArtifactのSection更新、短いRationale、必要Trace |
| Standard | 通常Feature、複数Artifact、人間Review | Common Artifact Contract、Phase Coverage、Change Trace、Verification |
| Extended | 高Risk、複数Stakeholder、Migration、Legacy大規模 | 複数Evidence、Baseline、Alternative、専門Review、Impact、Release Evidence |

規模は行数やファイル数ではなく、Risk、Authority、Context量、再現性、判断負荷に合わせる。`Scale`をConformance Profileまたは品質等級として扱わない。

## 10.2. Separation Guide

次の場合はArtifactまたはSectionを分ける。

```text
Property Authorityが異なる
LifecycleまたはApproverが異なる
更新頻度が大きく異なる
独立Reviewや再利用が必要である
一つのArtifactでは責務境界を誤読する
```

単に長い、担当Agentが異なる、Templateが別という理由だけで正本を増やさない。

## 10.3. Patterns

Principle DocumentはPurpose、Principle、Rule、Exampleを必要な粒度で持つ。Design / Definition ArtifactはSource Context、Preserved Intent、Scope / Non-goal、Decision / Definition、Constraint、Risk / Open Question、Downstream Obligation、Verificationを取得可能にする。

Change TraceのTrigger、Intent、Expected / Actual Impact、Artifact Trace、Release帰属は[Change](12_Change.md)を正本とし、Documentation側に別Templateを作らない。Release RecordとCHANGELOGは[Release](13_Release.md)、作業手順は[Workflow](14_Workflow.md)に従う。

## 10.4. Validation and Audit

本書は、検査対象となるRuleを定義する。検査の実行方法は、次を正本とする。

- 文書のAudit手順、Severity、Remediation Policy、Audit Completion、Target Status: [Document Audit](51_Document_Audit.md)
- 工程ArtifactのCoverage: 各工程の`Phase Audit Checklist`
- CRDDの最小適用条件と適用状態: [Conformance Audit](52_Conformance_Audit.md)
- 変更影響: [Gap / Impact Audit](53_Gap_Impact_Audit.md)
