# Contributing to CRDD

Thank you for helping improve Context Repository-Driven Development.

CRDD accepts public problem reports, standard-change proposals, adoption feedback, and pull requests. A submission is an input to CRDD Maintenance; it is not automatically an accepted CRDD rule.

**[English](#english)** | **[日本語](#日本語)**

---

## English

### Contribution boundary

Public feedback follows the existing [CRDD Maintenance](19_Maintenance.md) authority and lifecycle:

```text
Problem / Evidence
→ Scope, Authority, and Impact Review
→ Alternative Comparison
→ CRDD Change Decision
→ Canonical Document and Adapter Updates
→ Triggered Propagation Check when applicable
→ Independent Review, Required Audits, and Remediation
→ Release or Reasoned Close
```

An issue, proposal, vote, or pull request does not by itself change CRDD. Qual-Lab owns the CRDD standard and makes the final adoption, classification, release, and rejection decisions. Contributors provide valuable problems, evidence, alternatives, implementation proposals, and review input.

### Choose the right intake

Use one of the three issue forms:

- **Problem Report:** report a typo, broken link, contradiction, missing responsibility, ambiguous rule, or behavior that misleads people or AI.
- **Standard Change Proposal:** propose a change to a rule, authority, phase contract, audit criterion, agent or skill boundary, template contract, or conformance result.
- **Adoption Feedback:** share what happened while applying a released CRDD version to a real project.

The intake type describes what entered Maintenance. It does not determine whether the resulting change is Editorial, Clarification, Additive, Normative, or Breaking. Maintainers classify the actual impact during triage.

General questions may use a regular issue or GitHub Discussions when available. A dedicated question form is intentionally not provided yet.

Do not include customer secrets, personal data, credentials, private source code, or evidence you are not allowed to share. Describe sensitive evidence at an appropriate level or contact the maintainers through an available private channel before posting it publicly.

### Small corrections

For an obvious typo, broken internal link, formatting defect, or other change that does not alter meaning, you may open a Problem Report or submit a focused pull request directly.

Identify the affected file and explain why the change is meaning-preserving. Do not label a change Editorial merely because the diff is small: changing responsibility, authority, a requirement, a gate, audit behavior, conformance, or an expected adopter action is not Editorial.

### Standard changes

For Normative or Breaking changes, open a Standard Change Proposal before investing in a large pull request unless a maintainer has already confirmed the direction. Include:

- the current problem and affected users or AI behavior;
- an observed event, reproduction, external authority, or other Evidence;
- the affected canonical documents and Property Authorities;
- the proposed result, not only preferred wording;
- meaningful alternatives and why they are weaker;
- impact on existing adopters, tools, templates, and conformance;
- whether Migration may be required;
- uncertainty, limitations, and what would change the recommendation.

One project example may be enough to start a candidate. Promotion into a general CRDD rule still requires a reason it generalizes, such as recurrence, material risk, an external authority, or applicability across products or domains.

### Decisions and execution

Maintainers distinguish initial triage, authorization to work within a fixed scope and baseline, and final adoption or release approval. An issue status, label, assignment, or proposal does not by itself provide all three decisions or start an automated change.

Before non-trivial implementation, the issue, task, or linked change record should identify the allowed and excluded scope, base revision, preserved intent and non-goal, expected result, unresolved Human decisions, required review and audits, and stop or re-triage conditions. If the scope, classification, authority, migration impact, or baseline changes materially, return for triage instead of silently expanding the change.

### Change classification

The canonical classification and approval rules are in [Maintenance](19_Maintenance.md#4-change-classification-and-approval). In brief:

| Category | Contributor-facing meaning |
|---|---|
| Editorial | Corrects presentation, spelling, or links without changing meaning or expected behavior |
| Clarification | Makes an existing rule easier to understand without changing responsibility or outcome |
| Additive | Adds compatible guidance or capability without changing existing required results |
| Normative | Changes required behavior, authority, responsibility, gates, audits, or conformance |
| Breaking | Requires existing adopters, artifacts, tools, or conformance claims to migrate or change |

The maintainer may reclassify a proposal after impact analysis. A Breaking change must consider Migration even when CRDD is still in a `v0.x` release line.

### Pull requests

Before submitting a pull request:

1. Link the relevant issue, except for a self-contained Editorial correction.
2. Keep one primary change intent per pull request.
3. Update the owning canonical document instead of creating a competing authority.
4. Update directly affected README, Overview, Related links, templates, agent instructions, audit criteria, and migration guidance as applicable.
5. Preserve old rationale, Stable Context IDs, and historical CHANGELOG entries unless the approved change explicitly requires otherwise.
6. Run link, anchor, structure, and applicable audit checks.
7. Describe unresolved impact and required maintainer decisions honestly.

Use the repository pull request template. A complete pull request may still be revised or declined when Evidence, generalization, authority, compatibility, or release impact does not support adoption.

### Review and decision

Maintainers may request more Evidence, narrow the scope, separate concerns, choose an alternative, classify the proposal differently, defer it, or close it without adoption. The disposition and rationale should remain traceable in the issue, pull request, resulting canonical artifact, or release record as appropriate.

Accepted non-trivial changes enter the CRDD change path. Before they are Released, the applicable canonical updates, audits, CHANGELOG, Migration consideration, and release decision must be finished; closing an implementation issue earlier does not waive those release responsibilities.

After an accepted change is merged, its issue may be closed as `Integrated — Pending Release` instead of remaining open until publication. Record the merged pull request or revision, changed canonical artifacts, target release or release-plan reference, and known limitations or risks. Merge does not mean Released; `Released` applies only after the target version or equivalent immutable release identifier is published. Rejected, duplicate, no-change, non-generalized, or otherwise non-releasing outcomes use `Close without Release` with a reason.

In the CRDD GitHub repository, a target-version milestone may collect closed issues and merged pull requests until release. Closing that milestone after the tag is published avoids reopening or commenting on every issue. Milestones are a repository adapter, not a CRDD adoption requirement.

---

## 日本語

### Contributionの境界

Public Feedbackは、既存の[CRDD Maintenance](19_Maintenance.md)のAuthorityとLifecycleへ接続する。

```text
Problem / Evidence
→ Scope・Authority・Impact確認
→ Alternative比較
→ CRDD変更判断
→ Canonical Document・Adapter更新
→ 必要な場合はTriggered Propagation Check
→ Independent Review・必要なAudit・Finding修正
→ Releaseまたは理由付きClose
```

Issue、提案、投票、Pull RequestだけでCRDD Ruleが変更されることはない。CRDD標準のOwnerはQual-Labであり、採用、分類、Release、却下の最終判断を行う。ContributorはProblem、Evidence、Alternative、実装案、Reviewを提供できる。

### 受付種別

次の3種類のIssue Formを使う。

- **Problem Report:** 誤字、Link切れ、矛盾、責務不足、曖昧なRule、人間やAIを誤誘導する記述を報告する。
- **Standard Change Proposal:** Rule、Authority、工程Contract、Audit Criteria、Agent / Skill境界、Template Contract、Conformance結果の変更を提案する。
- **Adoption Feedback:** 公開済みCRDD Versionを実Projectへ適用して実際に起きたことを共有する。

受付種別はMaintenanceへ何が入ったかを表し、結果となるChangeがEditorial、Clarification、Additive、Normative、Breakingのどれかを決定しない。実際の影響に基づきMaintainerがTriageで分類する。

一般的な質問は通常Issue、または利用可能な場合はGitHub Discussionsで扱う。質問専用Formは現時点では設けない。

顧客の秘密情報、個人Data、Credential、非公開Source Code、共有権限のないEvidenceを記載しない。機微なEvidenceは適切に抽象化するか、公開前に利用可能な非公開経路でMaintainerへ相談する。

### 小さな修正

明らかな誤字、内部Link切れ、Formatting不具合等、意味を変えない修正はProblem Reportまたは限定的なPull Requestから直接提出できる。

対象Fileと、なぜ意味を変えないかを説明する。Diffが小さいという理由だけでEditorialに分類しない。責務、Authority、Requirement、Gate、Audit、Conformance、採用者が行う作業を変える場合はEditorialではない。

### Standard Change

Normative ChangeまたはBreaking Changeでは、Maintainerが既に方向性を確認している場合を除き、大きなPull Requestを作る前にStandard Change Proposalを提出する。最低限、次を示す。

- 現在のProblemと、人間またはAIへの影響
- 実際の事象、再現、外部Authority等のEvidence
- 影響するCanonical DocumentとProperty Authority
- 文言だけでなく、変更後に成立させたい結果
- 意味のあるAlternativeと、それを採らない理由
- 既存採用者、Tool、Template、Conformanceへの影響
- Migrationの必要性
- 不確実性、Limit、Recommendationが変わる条件

一つのProject事例でもCandidateは開始できる。ただし一般RuleへPromotionするには、再発性、重大Risk、外部Authority、複数Product / Domainへの適用可能性等、一般化できる理由が必要である。

### Decisionと実行

初期Triage、固定したScopeとBaselineで作業を始める許可、最終的な採用またはRelease Approvalを区別する。IssueのStatus、Label、Assignment、Proposalだけで三つのDecisionがすべて成立したり、変更作業が自動的に開始されたりすることはない。

非自明な変更を実装する前に、Issue、Task、または参照するChange Recordから、Allowed / Out of Scope、Base Revision、Preserved Intent / Non-goal、Expected Result、未決のHuman Decision、必要なReview / Audit、停止・再Triage条件を識別可能にする。Scope、Classification、Authority、Migration Impact、Baselineが実質的に変わった場合は、変更を暗黙に拡張せずTriageへ戻す。

### Change分類

正式な分類とApproval Ruleは[Maintenance](19_Maintenance.md#4-change-classification-and-approval)を正本とする。概要は次のとおり。

| Category | Contributor向けの意味 |
|---|---|
| Editorial | 意味や期待動作を変えず、表記、誤字、Linkを修正する |
| Clarification | 責務や適用結果を変えず、既存Ruleを理解しやすくする |
| Additive | 既存の必須結果を変えず、互換性のあるGuidanceやCapabilityを追加する |
| Normative | 必須動作、Authority、責務、Gate、Audit、Conformanceを変更する |
| Breaking | 既存採用者、Artifact、Tool、Conformance Claimに移行または変更を要求する |

Impact確認後にMaintainerが分類を変更する場合がある。CRDDが`v0.x`であっても、Breaking ChangeではMigrationを検討する。

### Pull Request

Pull Requestを提出する前に、次を確認する。

1. 単独で完結するEditorial修正を除き、関連IssueをLinkする。
2. 一つのPull Requestに一つの主要な変更Intentを置く。
3. 競合する新しい正本を増やさず、責務を持つCanonical Documentを更新する。
4. 適用範囲に応じてREADME、Overview、Related、Template、Agent指示、Audit Criteria、Migration Guidanceを追従させる。
5. 承認済み変更で必要とされない限り、旧Rationale、Stable Context ID、過去CHANGELOGを破壊しない。
6. Link、Anchor、構造、および適用されるAuditを確認する。
7. 未解決ImpactとMaintainerの判断が必要な点を隠さない。

RepositoryのPull Request Templateを使用する。十分に整理されたPull Requestでも、Evidence、一般化、Authority、Compatibility、Release Impactが採用を支持しない場合は変更または却下されることがある。

### Reviewと最終判断

Maintainerは追加Evidenceの依頼、Scope縮小、論点分離、Alternative採用、分類変更、延期、非採用Closeを行える。Dispositionと理由は、必要に応じてIssue、Pull Request、結果となるCanonical Artifact、Release Recordから追跡可能にする。

採用された非自明な変更はCRDD自身の変更経路へ入る。Releasedとする前に、Canonical Update、必要なAudit、CHANGELOG、Migration検討、Release判断を完了しなければならず、実装Issueを先にCloseしてもRelease責務は免除されない。

採用変更をMergeした後は、公開までIssueをOpenに保たず、`Integrated — Pending Release`としてCloseできる。Merged Pull RequestまたはRevision、変更したCanonical Artifact、Target ReleaseまたはRelease Plan Reference、Known Limitation / Riskを記録する。MergeはReleaseを意味せず、`Released`は対象Versionまたは同等の不変Release識別子が公開された後だけ使用する。Reject、Duplicate、No Change、一般化しなかったFeedback等は、理由付き`Close without Release`とする。

CRDD公式GitHub Repositoryでは、Target VersionのMilestoneへClose済みIssueとMerged Pull Requestを集約し、Tag公開後にMilestoneをCloseできる。個別Issueの再OpenやRelease完了Commentは要求しない。MilestoneはRepository Adapterであり、CRDD採用要件ではない。
