# CRDD Maintenance

Version: v0.5.0
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-21
Related:
- [01_Principles.md](01_Principles.md)
- [02_Terminology.md](02_Terminology.md)
- [03_Documentation.md](03_Documentation.md)
- [12_Change.md](12_Change.md)
- [13_Release.md](13_Release.md)
- [14_Workflow.md](14_Workflow.md)
- [51_Document_Audit.md](51_Document_Audit.md)
- [52_Conformance_Audit.md](52_Conformance_Audit.md)
- [53_Gap_Impact_Audit.md](53_Gap_Impact_Audit.md)
- [CHANGELOG.md](CHANGELOG.md)

---

# 1. Purpose and Boundary

本書は、CRDD標準自体へLearning、Correction、Normative Changeを反映し、Version、Release、Migrationとして安全に提供するMaintenanceの正本である。

対象はCRDDのCanonical Document、Template、Repository Entry File、Audit Criteria、公開説明、Public Maintenance Input、Repository-level Intake Adapter、Release Metadataである。CRDDを適用した個別Productの保守経路は[Discovery](21_Discovery.md)、[Change](12_Change.md)、[Release](13_Release.md)を正本とし、本書で再定義しない。

本書は次を定義する。

```text
Maintenance InputとLearning Candidateの扱い
Public Feedbackと追跡可能なIssueの境界
CRDD標準へのPromotion条件
CRDD Change Lifecycle
Change分類とHuman Approval
追跡対象Changeの実行Contract
Release VersionとCHANGELOG
採用RepositoryのVersion Pin、Migration、Correction
Maintenance完了時のAudit接続
```

文書表現、Status、Version / Revision / Baseline、削除は[Documentation](03_Documentation.md)、一般的なHuman / AI AuthorityとProgressive Autonomyは[Principles](01_Principles.md)、監査手順は各Audit文書を正本とする。

CRDD公式Repositoryが使用するIssue Form、Pull Request Template、Repository Rule、Entry File等は、本書を実装するRepository-level Adapterであり、本書のRuleを再定義しない。採用Repositoryとの境界は6.1に定める。

---

# 2. Maintenance Input and Learning Promotion

## 2.1. Maintenance Input

CRDD Maintenanceは、次をInputとして開始できる。

```text
Product実践から得られたLearningまたはFailure
複数Projectで繰り返されたGap
Document / Conformance / Gap Impact AuditのFinding
CRDD文書間の矛盾、重複、責務不足
外部Standard、法令、Tool、Delivery環境の変化
利用者、採用者、ContributorからのFeedback
Public Repositoryへ登録されたProblem、Proposal、Adoption Feedback
公開済みReleaseの誤りまたはMigration不足
```

InputはそのままCRDD Ruleではない。Source、適用Scope、Evidence、再現条件、Confidence、既知のLimit、提案者、Promotion候補先を保持し、既存のIssue、Change Trace、またはArtifact Reference上の`Learning Candidate` / `Change Candidate`として評価する。CandidateへCRDD Stable IDを発行しない。

## 2.2. Generalization and Ownership Check

Product固有のLearningをCRDDへPromotionする前に、次を確認する。

```text
固有名詞を除いても問題と理由を説明できる
別Productまたは別Domainでも責務とRiskが成立する
一回限りの局所判断ではなく再利用価値がある
既存CRDD Rule、工程Contract、Audit Criteriaと矛盾しない
CRDDの必須規範か、工程固有規則か、実践上の推奨かを区別できる
変更を所有する既存Canonical Documentを特定できる
```

一つの事例だけでもCandidateにはできるが、一般RuleへのPromotionには、再発可能性、重大Risk、外部Authority、複数事例等の説明可能な根拠を必要とする。一般化できない内容はProduct側に残す。

既存Canonical Documentへの統合を優先し、新しい正本文書をMaintenanceの既定動作として追加しない。既存責務へ統合できず、独立したProperty Authority、Lifecycle、Approver、利用者を持つ場合だけ、新規文書の必要性をImpact AnalysisとHuman Decisionの対象にする。

## 2.3. Promotion Boundary

AIはCandidate抽出、一般化案、重複調査、影響分析、Rationale Draftを作成できるが、CRDD RuleへのPromotionを自己承認しない。

```text
Product Learning / Audit Finding / Public Feedback
→ Generalization and Ownership Check
→ CRDD Change Candidate
→ Impact and Conflict Review
→ Human Decision when required
→ Canonical Document Update
→ Triggered Propagation Check
→ Independent Review and Required Audit
→ Release or Reasoned Close
```

採用結果は責務を持つCanonical Documentへ反映し、判断価値のある理由、Evidence、Alternative、影響は同ArtifactのDecision / Rationaleへ残す。AIがDraftを作成してもOwnerをAIへ置き換えず、Status昇格は対象文書のAuthorityとLifecycleに従う。

## 2.4. Public Maintenance Intake and Issue Boundary

Public Feedbackは追跡可能なIssue Systemで受け付けられる。CRDD公式RepositoryではGitHub IssueをAdapterとして使用するが、本Contractは特定のIssue Providerへ依存しない。Issueは次を接続するMaintenance Working Surfaceである。

```text
Problem / Trigger / Observation / Evidence
Affected Scope / Proposal / Alternative
Triage and Human Decision Reference
Implementation / Review / Release Reference
Residual Risk / Follow-up
```

IssueはCRDD Rule、Canonical Document、Change Trace、Release Recordの代替ではない。Issueを読まなければ現在有効なCRDD Ruleを理解できない状態にせず、採用された結果、判断理由、影響、Migrationは責務を持つCanonical Artifactまたは必要な`CHG-*`へ反映する。Discussion、Comment、投票、AI Summary、IssueのCloseだけからRule採用を推定しない。

受付時のIssue Typeと、採用時のChange Classificationは別の分類軸である。

```text
Issue Type            Change Classification
Problem Report        Editorial
Standard Change       Clarification
Adoption Feedback     Additive
                      Normative
                      Breaking
```

Issue TypeからChange Classificationを自動決定しない。Public ContributorへImpact、Authority、Alternative、Migrationの完全な分析を要求せず、不足する分析はMaintainerまたは委譲された実行者がTriageで補える。ただし、NormativeまたはBreaking Changeの採用に必要なEvidenceとHuman Approvalを省略しない。

## 2.5. Decision Boundaries in Tracked Maintenance

追跡可能なIssueまたはTaskを使用する場合、少なくとも次のDecisionを混同しない。

| Decision | Meaning |
|---|---|
| Triage Disposition | Candidateとして調査するか、Reject、Defer、Duplicate等へDispositionするか |
| Execution Authorization | 固定したScope、Baseline、Classificationの範囲で変更作業を開始してよいか |
| Adoption / Integration Decision | Review済み結果をCRDDへ採用し、対象BranchまたはBaselineへ統合するか |
| Release Decision | 統合済み結果をどのVersionで公開するか |

各Decisionは決定主体、対象Scope、対象RevisionまたはBaseline、結果、理由またはRationale Referenceを識別可能にする。同じScopeとRevisionを対象に連続して判断できる場合は一つのReviewまたは記録で扱ってよいが、統合済みであることからRelease済みと推定しない。IssueのStatus、Label、Assignment、AIへの提示はDecisionの記録を補助できるが、Protected Changeの承認、Risk Acceptance、Release Approval、実行主体の起動を単独では代替しない。

---

# 3. CRDD Change Lifecycle

非自明なCRDD変更は、次のLifecycleで扱う。

```text
1. Intake / Issue
2. Triage, Generalization, and Initial Disposition
3. Classify and Locate Property Authority
4. Check Existing Duplication and Conflict
5. Define Scope, Baseline, Alternatives, and Impact
6. Record Required Human Decision and Execution Authorization
7. Draft Canonical Changes and Migration Need
8. Update Documents, Templates, Adapters, and Public Guidance
9. Complete Triggered Propagation Check when applicable
10. Run Independent Review and Required Audits
11. Remediate Findings and Re-review the Updated Revision
12. Record CHANGELOG, Migration, and Release Evidence
13. Obtain Required Human Adoption / Integration Decision
14. Integrate or Close without Integration
15. Record Release Disposition and Target Release
16. Complete Release Readiness and Human Release Decision when releasing
17. Return the Result to the Intake Source and Close or Follow Up
```

軽微なEditorial ChangeではCHGを省略し、既存Issue、Pull Request、Commit等で追跡できる。複数正本、Authority、Conformance、Template、Migration、Releaseへ影響する変更は、[Change](12_Change.md)に従う`90_Release/Changes/CHG-*.md`を使用する。

Change Scopeは、対象文書だけでなく次の影響候補を確認する。

```text
Principles and Terminology
Documentation and Stable Context ID
Agent / Skill / Change Trace / Release
Phase Process Contract and Audit Checklist
Conformance / Document / Gap Impact Audit
README / Overview / Related Links
CONTRIBUTING / Issue Forms / Pull Request Template
Template / CLAUDE.md / AGENTS.md / Tool Adapter
CHANGELOG / Migration Note / Release Tag
```

一部文書の編集完了からCRDD Change全体の完了を推定しない。更新不要と判断した影響先も、重要な場合はNo Change理由を残す。

## 3.1. Tracked Change Execution Contract

Issue、Task、Change Trace等から変更を実行する前に、次を取得可能にする。保存場所やToolは固定しない。

```text
Intake / Task Reference
Change Classificationまたは未確定であること
Allowed Scope / Out of Scope
Base Revision / Baseline
Human Decision済みの範囲と未決事項
Preserved Intent / Non-goal
Expected Result
Required Review / Audit
Stop / Re-triage Condition
```

実行主体は[Agent](10_Agent.md)と[Skill](11_Skill.md)のAuthority、停止、Independent Reviewに従う。IssueやTaskが実行可能状態を示していても、それだけで自動実行、Scope外変更、Protected Change承認、最終Merge、Releaseを許可しない。

作業中にScope外変更、より重大なClassification、Authority競合、複数解釈可能なHuman Decision、未確認Migration、Baseline変更、Security / Privacy / Legal Risk、必要Access不足を検出した場合は、安全に取得した結果を残して停止または再Triageする。

## 3.2. Integration and Release Disposition

IssueまたはTaskの進行StatusをRelease待ちのために増やし続けず、統合後は次のRelease Dispositionだけを記録する。Release DispositionはCRDD全体のLifecycle Statusではなく、当該変更と公開Releaseの関係を示す結果Fieldである。

| Release Disposition | Meaning |
|---|---|
| `Integrated — Pending Release` | 採用済みRevisionが対象BranchまたはBaselineへ統合されたが、まだ不変なRelease Versionへ含まれていない |
| `Released` | 対象変更を含むRelease Version、Tag、または同等の不変識別子が公開された |
| `Close without Release` | Reject、Duplicate、No Change、一般化しなかったFeedback、またはCRDD Releaseを必要としない理由付きClose |

`Integrated — Pending Release`では、Merged RevisionまたはPull Request、Target ReleaseまたはRelease Plan Reference、変更したCanonical Artifact、既知のLimit / Riskを取得可能にする。Target Releaseが未定の場合は`Unscheduled`、Owner、Release再評価条件を示す。

IssueまたはTaskは、統合結果と`Integrated — Pending Release`を返した時点でCloseしてよい。個別IssueをReleaseまでOpenに保つこと、Release後に再Openすること、各IssueへRelease完了Commentを追加することを要求しない。Release Scopeは、Milestone、Release Issue、CHANGELOG Draft、Release Record等の集約Viewから追跡する。

CRDD公式GitHub RepositoryではTarget ReleaseごとのMilestoneを軽量なAdapterとして使用できる。Milestoneは本節の意味を実装する一例であり、採用Repositoryまたは他のIssue Systemへ同じ機能を要求しない。

---

# 4. Change Classification and Approval

CRDD変更は、意図ではなくConsumer、Authority、Conformance、Migrationへの影響で分類する。

| Category | Meaning | Required Handling |
|---|---|---|
| Editorial | Typo、表記、Link等を直し意味を変えない | Review、必要な機械検証 |
| Clarification | 既存Ruleの意味を明確化し責務・適用結果を変えない | Review、影響が外部に見える場合はCHANGELOG |
| Additive | 既存の必須責務やConformance結果を変えず、GuidanceまたはCapabilityを追加する | Impact確認、CHANGELOG、必要なVersion更新 |
| Normative | MUST / MUST NOT、Authority、Property Responsibility、Conformanceを変える | Human Approval、Version更新、CHANGELOG、Audit |
| Breaking | 既存Consumerの運用、Artifact、Tool Adapter、準拠判定、Migrationを変更する | Human Approval、Migration Note、Version更新、Audit、Release判断 |

意味を訂正するCorrectionも、結果が変わる場合はClarificationではなくAdditive、Normative、Breakingのいずれかへ分類する。判断に迷う場合は影響の大きい分類として扱い、Impact確認後に下げる。

Human Approvalが必要なProtected Changeは[Principles](01_Principles.md)を正本とする。CRDD自身では、少なくとも次をProtected Changeとして扱う。

```text
Principle、Conformance Boundary、Human / AI Authority
Stable Context ID、Property Authority、Decision / Evidenceの意味
Agent / Skill / ChangeのAuthorityまたは実行境界
工程Entry、Coverage、Exit、Gate、Audit
公開済みConsumerのMigrationまたは互換性
```

AIは差分作成や検証を行えても、Protected Change、Risk Acceptance、Breaking分類の解除、Release Approvalを自己確定しない。文書のStatusは[Terminology](02_Terminology.md)、廃止・削除は[Documentation](03_Documentation.md)に従う。

Repository-level Intake Adapter、Contributor Guide、Review Template等だけを変更し、CRDD Rule、Consumerの必須動作、Authority、Conformance、Migrationを変えない場合は、その実際の影響に従ってEditorialまたはClarificationとして扱える。Adapter変更によってMaintenanceの必須結果または採用Repositoryの責務を変える場合は、Diffの小ささにかかわらずAdditive、Normative、Breakingの該当分類へ上げる。

---

# 5. Release, Version, and CHANGELOG

## 5.1. Release Version and Revision

CRDDはRepository単位のRelease Versionを持ち、Git Tagまたは同等の不変なRelease識別子でBaselineを固定する。Canonical CRDD文書は、配布されるBaselineのRelease VersionをHeaderへ表示する。Git Commit等の内容識別はRevisionであり、Versionの代用ではない。

Release Versionは`MAJOR.MINOR.PATCH`形式を使用する。

| Part | Meaning |
|---|---|
| MAJOR | v1.0.0以降で、既存採用者へ互換性を維持できないBreaking Change |
| MINOR | 後方互換なCapability / Normative追加。v0.xではMigrationを伴うBreaking Changeを含み得る |
| PATCH | 意味、Authority、Conformance、必要Migrationを変えないEditorial / Clarification |

v0.xのMINORにBreaking Changeを含める場合も、Breaking表示とMigration Noteを省略しない。意味が変わるCorrectionをPATCHとして隠さない。

## 5.2. CHANGELOG

`CHANGELOG.md`はRelease間の外部公開可能な差分を記録する正本である。各Release Sectionは直前Releaseからの純粋な差分として書き、現在の構成と利用者への影響を説明する。

次をCHANGELOGへ記録する。

```text
追加、廃止、統合、名称または責務変更
Normative / Breaking Change
Conformance、Authority、Stable Context ID、Handoff、Migrationの変更
利用方法、Template、Tool Adapterへ影響する変更
Public FeedbackまたはMaintenance Intakeの利用方法へ影響する変更
採用者が対応または再確認すべき内容
```

内部の試行錯誤、途中案、Commit一覧、同じ変更の旧説明をRelease差分として残さない。Editorial Changeは利用者影響がある場合だけまとめて記録できる。CHANGELOGはDecision / RationaleやGit履歴の代用ではない。

## 5.3. Release Readiness

Release前に次を確認する。

```text
Release ScopeとVersionがHuman Authorityにより確定している
Canonical CRDD文書のHeader VersionがRelease Baselineと一致している
CHANGELOGが直前Releaseからの純粋差分になっている
Breaking ChangeとMigration Needが明示されている
README、Overview、Template、Entry File、Related Linkが追従している
CONTRIBUTING、Issue Form、Pull Request Template等の影響を受けるIntake Adapterが追従している
必要なAuditとValidationが完了している
Finding修正後のRevisionが再Reviewされている
Release Tagが対象Revisionを一意に固定する
対象Releaseの`Integrated — Pending Release`をRelease Scope、CHANGELOG、除外理由のいずれかへ照合している
```

公開済みTagを別Revisionへ付け替えない。Release後の誤りは6.3のCorrectionとして扱う。

---

# 6. Adoption, Migration, and Correction

## 6.1. Version Pin and Adoption

CRDDを採用するRepositoryは、利用するRelease Tag、Commit、配布物Version等のBaselineを識別可能にする。常に最新Releaseへ即時追従する必要はなく、採用VersionとProject固有Deviationを明示して運用できる。

新Releaseの採用は、変更された規範、Project Artifact、Tool Adapter、Team運用への影響を確認して決める。Breaking Change、Conformance変更、Protected Meaning変更を機械的に上書きしない。

CRDD公式RepositoryのPublic Feedback受付、Issue System、Pull Request、Label、Branch Rule、Agent Entry等は公式Repositoryの運用Profileであり、採用Repositoryへ同一実装を要求しない。採用Repositoryは、必要なAuthority、Traceability、Review BoundaryをProjectに適したToolまたは運用で満たせる。

## 6.2. Migration Note

Migrationが必要なReleaseは、CHANGELOGまたは参照先Artifactから次を取得可能にする。

```yaml
migration:
  from: v0.3.0
  to: v0.4.0
  changed_contract:
    - Skill Run Status and Handoff
  affected:
    - CRDD canonical documents
    - project templates and agent adapters
  required_actions:
    - update references and status mappings
  optional_actions: []
  verification:
    - run Document Audit
    - rerun affected Conformance Criteria
  rollback_or_recovery:
    - retain the previous pinned release until migration verification passes
  known_risk_if_deferred:
    - old runtime status may be interpreted as phase approval
```

Migration NoteはすべてのProjectへ同じ作業を強制せず、必須Action、条件付きAction、対象外、延期時Riskを区別する。採用Project側では[Change](12_Change.md)に従ってImpactを追跡し、実際の作業は対象工程、Agent / Skill Contract、Project固有Workflowに従う。

## 6.3. Released Error and Correction

公開済みReleaseに誤りを発見した場合、公開Tagや過去CHANGELOGを無言で書き換えない。

```text
誤りと影響するRelease / Scopeを記録する
利用者へ影響する意味、Authority、Migrationを評価する
必要なCorrection Releaseを発行する
旧Releaseとの関係と既知RiskをCHANGELOGへ記録する
必要に応じて旧ReleaseをDeprecatedまたはSupersededとして案内する
```

漏えい、個人情報、Security Risk等では、安全・法令上必要な削除や非公開化を優先し、実施理由と代替案内を可能な範囲で残す。

---

# 7. Maintenance Verification and Closure

MaintenanceはAudit手順を独自に再定義せず、変更内容に応じて次を使用する。

| Verification Need | Authority |
|---|---|
| Link、Header、構成、用語、重複、README / Template追従 | [Document Audit](51_Document_Audit.md) |
| CRDD適用CriteriaまたはConformance Claimへの影響 | [Conformance Audit](52_Conformance_Audit.md) |
| 複数工程、Artifact、Consumer、Migrationへの波及 | [Gap / Impact Audit](53_Gap_Impact_Audit.md) |
| Trigger、Expected / Actual Impact、正本・実装・検証・Release間のTrace | [Change](12_Change.md) |
| 実行Boundary、停止、Rollback、Handoff | [Agent](10_Agent.md)、[Skill](11_Skill.md)、Project固有[Workflow](14_Workflow.md) |
| Release判断、CHANGELOG、Release結果 | [Release](13_Release.md) |
| Intakeと実行Scope、Issue Type / Change Classification、結果返却 | 本書2.4、2.5、3.1、3.2 |

Editorial Changeは対象検証だけでCloseできる。NormativeまたはBreaking Changeは、対象Scope / Revision、Human Approval、Impact、Migration、Audit Result、CHANGELOG、Release判断が追跡可能になるまでCloseしない。

Findingを検出しただけでは修正完了ではない。修正、意図的なNo Change、Deferred、Risk AcceptanceのいずれかをOwnerと理由付きでDispositionし、必要なCanonical Documentへ反映する。

追跡可能なIssueまたはTaskから開始したMaintenanceでは、CloseまたはFollow-up前に、採否、採用した変更、採用しなかった主要Alternative、Canonical Artifact / Change / Review Reference、Release Disposition、Target ReleaseまたはRelease Plan Reference、Migration、Known Limitation、Residual Risk、Follow-upを適用範囲で返す。Issueを`Integrated — Pending Release`でCloseしても、Release済みとは表示せず、Canonical Document、CHANGELOG、Migration Note、Release Evidenceの責務をIssueへ移さない。
