<a id="crdd-document-audit"></a>

# CRDD文書監査（Document Audit）

Version: v0.5.1
Status: Stable
Owner: Qual-Lab
Agent ID: `agent.document.audit`
Last Updated: 2026-07-22
Related:
- [01_Principles.md](01_Principles.md)
- [02_Terminology.md](02_Terminology.md)
- [03_Documentation.md](03_Documentation.md)
- [10_Agent.md](10_Agent.md)
- [11_Skill.md](11_Skill.md)
- [19_Maintenance.md](19_Maintenance.md)
- [52_Conformance_Audit.md](52_Conformance_Audit.md)
- [53_Gap_Impact_Audit.md](53_Gap_Impact_Audit.md)

---

> この文書で分かること（非規範の案内）
>
> - 文書のLink、Anchor、構造、用語をどう監査するか
> - 重複、正本競合、情報劣化をどう見つけるか
> - 日本語表示とCanonical Termの意味一致をどう確認するか
> - Findingへ何を記録し、誰へ修正を返すか
> - 修正後RevisionをいつPassと判断できるか

<a id="purpose-and-boundary"></a>

# 目的と適用範囲（Purpose and Boundary）

本書は、CRDD Repositoryの文書体系、参照、用語、Authority、Stable Context ID、Traceabilityを継続的に評価するDocument Auditの共通Contractである。

```text
Document Audit     = 文書品質、参照、用語、Authority、Stable Context ID、Traceabilityの監査
Phase Audit        = 各工程のEntry、Coverage、Exit、Gate条件の監査
Conformance Audit  = C / PL / AD CriteriaとConformance Claimの監査
Gap / Impact Audit = Relationを横断したGap、影響候補、再Review範囲の監査
Verification       = Product / ImplementationがContractを満たすかのFresh Evidenceによる検証
```

Document Auditは成果物作成、工程承認、Conformance Claim、変更影響分析、Product Verificationの代替ではない。対象工程の文書品質を監査するためPhase Audit Checklistを参照できるが、Phase Gateを自己承認しない。

Document Audit Runは読取専用である。Findingと修正案を返し、Canonical Artifactの変更はParent Agent、人間、または明示的に承認されたRemediation Runが行う。同一Task内で監査と修正を続ける場合も、Audit Resultを確定してから修正し、再監査する。

---

# 1. Audit Responsibility and Authority

Document Auditは対象Scopeについて次を担当する。

| 監査責務 | 確認する観点 |
|---|---|
| Structure | Header、Markdown、見出し、Artifact Contract、配置 |
| Reference | Link、Anchor、Related、旧Path、Index / Overview |
| Terminology | Canonical Term、Alias、Status、Concept境界 |
| Readability | 主要ロケール、初出併記、平易な説明、義務の分離、表示名と識別子の境界 |
| Normative / Authority | Rule強度、正本、責務境界、Human / AI Authority |
| Duplication | 同じRuleの複数正本化、統合後の残存、意味の競合 |
| Identification | 文書番号、ファイル名、Stable Context ID、Artifact Reference |
| Traceability | Source、Decision、Context Relation、Implementation、Verificationへの到達 |
| Propagation | 変更で直接影響する既知文書、Template、Entry Fileの追従 |
| Lifecycle | Status、Version、Deprecation、Superseded、Release整合 |

Audit実行者は、Finding、Evidence、Impact、Severity、Recommendation、Remediation Eligibilityを返す。定義済み基準によるFinding分類は行えるが、Authority変更、Decision、Risk受容、Status昇格、Phase Approvalを自己確定しない。

---

# 2. Input and Audit Scope

Document Auditは最低限、次をInputとする。

```text
Audit Purpose
Target Scope and Revision
Changed Files or Target Artifacts
Applicable Standards / Phase Sources
Known Decision / Change Trace
Requested Depth and Output
```

監査Scopeは、対象ファイルだけでなく、直接参照、参照元、正本Authority、既知のPropagation先を含める。Repository全体Auditでない限り、Scope外の文書を無制限に読み、未確認領域までPassと推定しない。

Audit実行者は、親から渡されたRead Setだけを機械的に信頼せず、Broken Link、Authority、Term、Propagationを判定するために必要な直接Dependencyを追加で読める。Relation Graphの広範な探索が必要になった場合はGap / Impact AuditへHandoffする。

## 2.1. Context-sensitive Read Set

対象Scopeに応じて次から必要なものを読む。

- README、Overview、対象Folder Index
- Terminology、Documentation、Principles
- 対象ArtifactとRelated先・参照元
- 対象工程のPhase Process Contract / Phase Audit Checklist
- Change Trace、Decision / Rationale、Known Finding
- Template、CLAUDE.md、AGENTS.md等のRepository Entry File
- Maintenance、CHANGELOG、Release情報

CHANGELOGは公開Release、利用者影響、Migration、Normative Change等で必要な場合に確認する。すべてのEditorial Changeへ機械的な追記を要求しない。

---

# 3. Output

Document Auditは、一つのAudit Reportを返す。

## 3.1. Audit Status

| Status | Meaning |
|---|---|
| `Pass` | 適用Checkを評価し、未解決Critical / Majorがなく、残るMinor / InfoにDispositionがある |
| `Conditional` | 対象を限定した例外または未解決事項があり、条件・Owner・Human Authorityが明確である |
| `Fail` | 未解決Critical / Major、正本競合、重大Trace切れ等により対象を合格と評価できない |
| `Blocked` | Scope、Revision、Authority、Artifact等が不足し、必要な評価を完了できない |

Audit StatusはFinding Severityと別の軸である。Audit Runが正常に完了して`Fail`を返すことも、評価不能の理由を揃えて`Blocked`を返すこともできる。

## 3.2. Finding Fields

各Findingは最低限、次を持つ。

| Field | Meaning |
|---|---|
| `finding_id` | Audit Report内で一意なLocal Key。CRDD標準Stable Context IDではない |
| `severity` | Critical / Major / Minor / Info |
| `category` | Structure / Reference / Terminology / Normative / Authority / Duplication / Propagation / Identification / Traceability / Lifecycle |
| `target` | File、Anchor、Artifact Reference等の対象 |
| `rule_reference` | 判定に使用した正本RuleまたはContract |
| `evidence` | 再確認できる根拠 |
| `impact` | 放置した場合の影響とScope |
| `recommendation` | 推奨対応またはHandoff |
| `remediation` | Safe Mechanical / Review Required / Human Decision Required |
| `owner` | 次の対応責任 |
| `status` | Open / Accepted for Remediation / Resolved / Deferred / False Positive等 |

FindingへCRDD標準Stable Context IDを発行しない。Audit Report内Key、Issue、Change Trace、Artifact Path等で追跡する。

## 3.3. Report View

```text
Audit Purpose / Scope / Revision
Applicable Standards and Read Set
Status / Summary
Checks Performed / Not Evaluated / Not Applicable
Findings
Traceability Gaps
Direct Propagation Gaps
Open Questions / Blocking Conditions
Recommended Handoff / Re-audit Condition
```

Conformance Auditは本章のStatus、Finding Fields、Severity、Report Viewを再利用し、`criterion_id`等の固有Fieldだけを追加する。

---

# 4. Audit Categories

## 4.1. Structure and Format Audit

CRDD標準文書とCanonical Markdown Documentでは、[Documentation Header](03_Documentation.md#44-markdown-header)に定めるHeaderと、Markdown構文、見出し階層、Code Fence、Table、Anchorを確認する。

その他のArtifactでは、媒体とRiskに応じてCommon Artifact Contractの情報を取得可能か確認し、同じMarkdown Headerを機械的に要求しない。

空Section、孤立した例、同じ内容のSummary / Minimum Rule、見出しだけ残った統合跡、情報粒度を失った過度な要約も確認する。

## 4.2. Reference, Naming, and Numbering Audit

次を確認する。

- Broken Link / Anchor、Related切れ、旧ファイル名、孤立Artifact
- 外部Sourceを実質的に使用する場合のSource / Versionまたは発行日、Authoritative URL / DOI、Relation、適用Section、Coverage、および過大な準拠・網羅Claim
- README、Overview、Folder Index等の探索導線
- 文書体系またはFolder内の採番帯、重複番号、順序
- `00_CRDD/`内でFolder番号を重ねた`00_01_*`等ではなく、`01_*`等の二桁Document Numberを一度だけ使用していること
- ファイル名が目的を表し、Stable IDを埋め込んでいないこと
- 文書移動・統合・削除後の参照元とTemplateの追従

文書番号はArtifactの分類、順序、探索用であり、Stable Context IDと同じ名前空間として監査しない。

## 4.3. Terminology, Status, and Normative Audit

[`02_Terminology.md`](02_Terminology.md)のCanonical Concept、Alias、Status、Authorityと一致するか確認する。特にObservation / Evidence、Proposal / Decision、Implemented / Verified / Accepted、Draft / Candidate / Reviewed / Approvedの混同を検出する。

規範強度語彙は[`03_Documentation.md`](03_Documentation.md#48-normative-language)を正本とする。`MUST`、`MUST NOT`、`SHOULD`、`SHOULD NOT`、`MAY`等を使う場合は、その強さが文書のStatus、Property Authority、人間判断と矛盾していないか確認する。日本語の義務表現も意味上のRuleとして評価し、英語Keywordの有無だけで規範性を判断しない。

利用者ロケールを優先した表示では、次を確認する。

- 初出時のローカル表示名とCanonical English Termが同じ概念を指す
- 翻訳によってRule、Authority、Status、識別子、例外、完了条件が変わっていない
- Canonical Term、ID、File名、Schema Key / Valueを表示名と混同して変更していない
- 一文へ複数の独立した義務を詰め込み、適用条件や決定主体が読めなくなっていない
- 専門用語だけで人間への質問・判断支援を完結させていない

英語用語が残っていること、ローカライズしていないことだけをFindingにしない。対象読者の理解、意味保存、誤判断の可能性を評価する。

Status、Version、Last Updated、Release / CHANGELOGの関係を適用範囲で確認する。AIや文書編集者がStatusを自己昇格していないか、Deprecated / Superseded Artifactの後継参照とMigrationがあるか、削除がDocumentationの廃止規則とHuman Approvalに従っているかを確認する。

## 4.4. Authority, Duplication, and Information Preservation Audit

同じRuleまたはConceptが複数文書で正本化されていないか、入口・変換・出口・Gateが異なるAuthorityから競合していないか確認する。

```text
同じ見出しや定義が別Sectionで説明量だけ変えて反復されていないか
共通Ruleを各工程へコピーし、更新元が分岐していないか
工程固有Ruleが共通文書へ移り、専門的な条件を失っていないか
統合・短縮で例外、Authority、適用条件、Evidence、Handoffが消えていないか
例示やTemplateがCanonical Ruleと異なる別規則になっていないか
```

同一語句の出現だけでFindingにしない。親Section、目的、Authority、規範性、参照関係を比較し、探索または判断が分岐する重複をFindingとする。

## 4.5. Stable Context ID and Artifact Reference Audit

次を確認する。

- CRDD標準Stable Context IDが`REQ`、`UX`、`IA`、`UI`、`SPEC`の5種類に限定されている
- 追跡価値のある対象Contextへ必要最小限のIDが付与されている
- Architecture、Decision、Evidence、Change、Implementation、Test、Verification、Findingへ標準外Prefixを新規発行していない
- 一文書一ID、全Paragraph、全Test等への機械的付与を要求していない
- 一つのArtifact内にある複数Contextを独立参照できる
- IDの再利用、意味の上書き、ファイル名・Directory名への埋め込みがない
- 移動、名称変更、統合、分割、再採番だけを理由に改番していない
- Stable IDを持たないArtifactがPath、Anchor、Revision等のArtifact Referenceで接続されている
- Behavior Specificationの新規IDは`SPEC-*`で、Legacy IDを見かけだけで改番していない

## 4.6. Traceability Audit

対象Scopeに応じて、次のRelationを意味付きで追跡できるか確認する。

```text
Origin / Evidence / Decision
REQ -> UX -> IA -> UI / SPEC
UI <-> SPEC Pair
SPEC / UI -> Architecture -> Implementation -> Verification
Change / Finding / Learning -> affected Canonical Context
```

単なるRelated Linkの存在だけでTrace成立とせず、どのContextをどのRelationで接続するか確認する。Trace切れは切断位置、影響、必要なAuthorityをFindingとして返す。

Evidenceが対象Artifact内または最も近い親Folderの`Evidence/`にあり、Root直下の中央Evidence Folderを基本構成にしていないか確認する。Decisionの結果とRationaleがCanonical Artifactへ反映され、全DecisionをRoot直下の中央台帳へ複製していないかも確認する。

## 4.7. Direct Propagation Audit

変更内容から直接影響すると分かる既知の文書、Template、Entry Fileが追従しているか確認する。

```text
README / Overview / Folder Index
Related Documents / Cross References
Template / CLAUDE.md / AGENTS.md
Audit Criteria / Skill or Agent Adapter
CHANGELOG / Migration Note（Releaseまたは利用者影響がある場合）
```

Document Auditは既知の直接Propagationを確認する。Relation Graphを探索して未知の影響候補、再Review範囲、複数工程への意味変更を発見する必要がある場合は[`53_Gap_Impact_Audit.md`](53_Gap_Impact_Audit.md)へ渡す。

## 4.8. Phase-specific Audit Sources

工程Artifactを対象に含む場合は、該当正本の`Required Responsibility Coverage`、`Scope and Coverage State`、`Phase Gate Criteria`、`Phase Audit Checklist`を読む。Document Auditはこれらを複製せず、文書として取得可能か、内部整合しているか、対象ArtifactにGapがあるかを報告する。Phase ApprovalはHuman Authorityへ残す。

| Scope | Authoritative Audit Source |
|---|---|
| Discovery | [21_Discovery.md](21_Discovery.md#phase-audit-checklist) |
| UX | [22_UX.md](22_UX.md#phase-audit-checklist) |
| IA | [23_IA.md](23_IA.md#phase-audit-checklist) |
| UI / SPEC Pair | [24_UI_Behavior_Specification.md](24_UI_Behavior_Specification.md#27-pair-audit-checklist) |
| UI | [25_UI.md](25_UI.md#phase-audit-checklist) |
| Behavior Specification | [26_Behavior_Specification.md](26_Behavior_Specification.md#phase-audit-checklist) |
| Architecture | [27_Architecture.md](27_Architecture.md#phase-audit-checklist) |
| Implementation | [28_Implementation.md](28_Implementation.md#phase-audit-checklist) |
| Verification | [29_Verification.md](29_Verification.md#phase-audit-checklist) |

---

# 5. Severity

| Severity | Meaning |
|---|---|
| `Critical` | 正本喪失、Authority破壊、重大な誤承認、回復困難なTrace / Provenance破壊につながる |
| `Major` | Repository整合性、工程判断、AI / Human実行、重要なCoverageへ実質的に影響する |
| `Minor` | 意味を大きく変えない局所的な形式、明瞭性、軽微な参照不整合 |
| `Info` | 必須修正ではない改善提案または観察事項 |

Severityは修正工数、ファイル数、好みだけで決めない。Authority、意味、Scope、Propagation、回復可能性、誤判断Riskから評価する。

---

# 6. Remediation Policy

`remediation`は修正可能性を示すFieldであり、Audit実行者へ変更権限を与えない。

| Class | Example | Execution Boundary |
|---|---|---|
| Safe Mechanical | 明白なBroken Link、表記揺れ、Header / Anchor整形 | Parentまたは承認済みRemediation Runが適用し、再監査する |
| Review Required | Related追加、Section移動、重複統合、Template / Overview追従 | Authorityと情報保存をReviewして適用する |
| Human Decision Required | Concept、Normative Rule、Authority、Status、Stable ID体系、Scope、Decision変更 | Human Authorityの判断前に適用しない |

自動修正Toolが利用可能でも、推測を伴うLink先、意味を変える用語置換、削除、統合、規範強度変更をSafe Mechanicalとして扱わない。

---

# 7. Audit Completion and Target Status

## 7.1. Audit Run Completion

次を満たしたとき、Audit Run自体を完了できる。

- Audit Purpose、Scope、Revision、適用Standardが記録されている
- 適用CheckにResult、Finding、`Not Evaluated`、または`Not Applicable`がある
- FindingにEvidence、Impact、Recommendation、Ownerがある
- Blocked項目に不足情報とHandoff先がある
- 未確認ScopeとAudit Statusが明示されている
- Re-audit条件とRecommended Handoffが示されている

CriticalやMajorを検出したAuditも、必要な記録を返せば正常に完了できる。

## 7.2. Target Pass Conditions

対象文書またはScopeを`Pass`と評価するには、少なくとも次を満たす。

- 未解決Critical / Majorがない
- Broken Link、正本競合、重大Trace切れがない
- 適用するAuthority、Stable Context ID、Phase Sourceと矛盾しない
- 直接Propagation漏れがない
- 未確認Scope、Minor / Info、例外にDispositionがある

条件付き例外がある場合は`Conditional`とし、Scope、Risk、Owner、Human Authority、再評価Triggerを記録する。

---

# 8. Audit Execution and Delegation

Document AuditをSkill、Agent、Subagentとして実行する場合は、[`11_Skill.md`](11_Skill.md)のRun Lifecycleと[`10_Agent.md`](10_Agent.md)のDelegation / Independent Reviewに従う。

Subagentとして実行する標準Agent IDは`agent.document.audit`とする。Parent AgentはDelegation Contractへ次を指定する。

- Audit Purposeと対象Scope / Revision
- Applicable Standardsと直接Dependency
- 既知FindingとExpected Output
- Read-onlyであることとReturn先

Subagentは本書のAudit Reportを返し、Canonical Artifactを変更しない。Phase Transition Reviewから呼び出された場合は、対象工程のPhase Audit ChecklistとHandoff Artifactを取得できるか評価する。Phase Approvalは返さない。

```text
Load Scope / Revision / Standards
Identify Authority and Direct Dependencies
Run Applicable Audit Categories
Record Evidence and Findings
Determine Audit Status
Return Remediation and Handoff
Remediate outside Audit Run if authorized
Re-audit changed Scope
```

同一Agentが作成・修正・Auditを連続実行する場合は、Fresh Contextで対象Artifactと正本RuleからFindingを再構成する。ただし、工程移行のIndependent Reviewでは同じActive Context内のSelf Reviewを使用せず、別Subagent、Clean Session / Agent、または人間Reviewerへ委譲する。高Risk変更では、作成者だけのSelf Reviewを独立Auditとして扱わない。

Parent Agentは複数Findingを統合し、Conflict、Severity、Authority、Remediationを再確認する。修正はAudit Result確定後に責務を持つ工程またはRemediation Runで行い、`agent.document.audit`は修正後Revisionを再監査する。Subagent ResultまたはAudit Run完了をそのままDecision、Target Pass、Phase Approval、Conformance Claimにしない。

---

# 9. Final Principle

Document Auditは、文書を直したことではなく、何をどの正本に照らして確認し、どのGapが残るかを明らかにする。

Findingを修正から分離し、修正後に再監査することで、文書体系の整合とAuthorityを保つ。
