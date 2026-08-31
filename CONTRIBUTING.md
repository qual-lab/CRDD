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
→ Scope, authority, and impact review
→ Alternative comparison
→ Human CRDD change decision
→ Canonical document and adapter updates
→ Triggered propagation check when required
→ Independent review, required audits, and remediation
→ Release or reasoned closure
```

An issue, proposal, vote, or pull request does not by itself change CRDD. Qual-Lab owns the CRDD standard and makes the final adoption, classification, release, and rejection decisions. Contributors provide valuable problems, evidence, alternatives, implementation proposals, and review input.

### Contribution licensing

Unless you explicitly mark a submission as "Not a Contribution," a contribution intentionally submitted for inclusion in CRDD is provided under the [Apache License 2.0](LICENSE), consistent with Section 5 of that license. Submit only material that you have the right to contribute. Submission does not grant rights to CRDD, Qual-Lab, Qual, or related names and logos; see [TRADEMARK.md](TRADEMARK.md).

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

Before maintainers begin an accepted non-trivial implementation, the issue, task, or linked change record should identify the allowed and excluded scope, base revision, preserved intent and non-goal, expected result, unresolved Human decisions, required review and audits, and stop or re-triage conditions. The maintainer then follows the [pre-execution alignment check](10_Agent.md#pre-execution-alignment-check) and CRDD's [tracked change execution contract](19_Maintenance.md#31-tracked-change-execution-contract), including the applicable contract and consumer populations, representative cases for changed conditional rules, and reconciliation with the actual diff before fixing the review target. This does not require an external proposer to supply those execution records at issue intake. If the scope, classification, authority, migration impact, or baseline changes materially, return for triage instead of silently expanding the change.

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
4. For changes under `40_Develop/**` or the distribution source `template/tools/**`, follow [`06_Architecture/99_Coding_Standards.md`](06_Architecture/99_Coding_Standards.md).
5. Update directly affected README, Overview, Related links, templates, agent instructions, audit criteria, and migration guidance as applicable.
6. Preserve old rationale, Stable Context IDs, and historical CHANGELOG entries unless the approved change explicitly requires otherwise.
7. Before independent review or audits, have the parent AI run `node 40_Develop/checker/crdd-check.ts` once for the fixed target revision and share the result. An equivalent deterministic check may be used, and it does not replace an audit.
8. Describe unresolved impact and required maintainer decisions honestly.

Use the repository pull request template. A complete pull request may still be revised or declined when Evidence, generalization, authority, compatibility, or release impact does not support adoption.

### Review and decision

Maintainers may request more Evidence, narrow the scope, separate concerns, choose an alternative, classify the proposal differently, defer it, or close it without adoption. The disposition and rationale should remain traceable in the issue, pull request, resulting canonical artifact, or release record as appropriate.

Accepted non-trivial changes enter the CRDD change path. Before they are Released, the applicable canonical updates, audits, CHANGELOG, Migration consideration, and release decision must be finished; closing an implementation issue earlier does not waive those release responsibilities.

After an accepted change is merged, its issue may be closed as `Integrated — Pending Release` instead of remaining open until publication. Record the merged pull request or revision, changed canonical artifacts, target release or release-plan reference, and known limitations or risks. Merge does not mean Released; `Released` applies only after the target version or equivalent immutable release identifier is published. Rejected, duplicate, no-change, non-generalized, or otherwise non-releasing outcomes use `Close without Release` with a reason.

In the CRDD GitHub repository, a target-version milestone may collect closed issues and merged pull requests until release. Closing that milestone after the tag is published avoids reopening or commenting on every issue. Milestones are a repository adapter, not a CRDD adoption requirement.

---

## 日本語

### 貢献の境界

公開フィードバックは、既存の[CRDDメンテナンス](19_Maintenance.md)の決定権限と状態遷移へ接続する。

```text
問題 / 根拠
→ 対象範囲・決定権限・影響確認
→ 代替案比較
→ CRDD変更判断
→ 正本文書・接続部更新
→ 必要な場合は変更影響の伝播確認
→ 独立レビュー・必要な監査・指摘事項修正
→ リリースまたは理由付き終了
```

Issue、提案、投票、プルリクエストだけでCRDD規則が変更されることはない。CRDD標準の担当責任者はQual-Labであり、採用、分類、リリース、却下の最終判断を行う。貢献者は問題、根拠、代替案、実装案、レビューを提供できる。

### 貢献物のライセンス

提出時に「Not a Contribution（貢献物ではない）」と明示しない限り、CRDDへの採用を意図して提出された貢献物は、[Apache License 2.0](LICENSE)第5条に従い、同ライセンスで提供される。提出者は、自らが提供する権利を持つ内容だけを提出する。提出によってCRDD、Qual-Lab、Qual、関連する名称またはロゴの使用権は付与されない。詳細は[TRADEMARK.md](TRADEMARK.md)を参照する。

### 受付種別

次の3種類のIssue形式を使う。

- **問題報告:** 誤字、リンク切れ、矛盾、責務不足、曖昧な規則、人間やAIを誤誘導する記述を報告する。
- **標準変更提案:** 規則、決定権限、工程契約、監査基準、エージェント / スキル境界、ひな型契約、準拠結果の変更を提案する。
- **採用フィードバック:** 公開済みCRDDバージョンを実プロジェクトへ適用して実際に起きたことを共有する。

受付種別はメンテナンスへ何が入ったかを表し、結果となる変更が編集上の、明確化、追加、規範的な、破壊的のどれかを決定しない。実際の影響に基づき保守担当者が整理で分類する。

一般的な質問は通常Issue、または利用可能な場合はGitHub Discussionsで扱う。質問専用形式は現時点では設けない。

顧客の秘密情報、個人データ、認証情報、非公開ソースコード、共有権限のない根拠を記載しない。機微な根拠は適切に抽象化するか、公開前に利用可能な非公開経路で保守担当者へ相談する。

### 小さな修正

明らかな誤字、内部リンク切れ、書式不具合等、意味を変えない修正は問題報告または限定的なプルリクエストから直接提出できる。

対象ファイルと、なぜ意味を変えないかを説明する。差分が小さいという理由だけで「編集上の変更」に分類しない。責務、決定権限、要求、ゲート、監査、準拠、採用者が行う作業を変える場合は、編集上の変更ではない。

### Standard Change

規範的な変更または破壊的変更では、保守担当者が既に方向性を確認している場合を除き、大きなプルリクエストを作る前に標準変更提案を提出する。最低限、次を示す。

- 現在の問題と、人間またはAIへの影響
- 実際の事象、再現、外部決定権限等の根拠
- 影響する正本文書と項目の決定権限
- 文言だけでなく、変更後に成立させたい結果
- 意味のある代替案と、それを採らない理由
- 既存採用者、ツール、ひな型、準拠への影響
- 移行の必要性
- 不確実性、制限、推奨が変わる条件

一つのプロジェクト事例でも候補は開始できる。ただし一般規則へ昇格するには、再発性、重大リスク、外部決定権限、複数プロダクト / ドメインへの適用可能性等、一般化できる理由が必要である。

### 判断と実行

初期整理、固定した対象範囲と基準版で作業を始める許可、最終的な採用またはリリース承認を区別する。Issueの状態、表示名、割当、提案だけで三つの判断がすべて成立したり、変更作業が自動的に開始されたりすることはない。

保守担当者が採用済みの非自明な変更の実装を始める前に、Issue、タスク、または参照する変更記録から、変更可能な範囲／対象外、基準改訂版、保持する意図／非目標、期待結果、未決の人間判断、必要なレビュー／監査、停止・再整理条件を識別可能にする。そのうえで[着手前整合確認](10_Agent.md#pre-execution-alignment-check)とCRDDの[追跡対象変更の実行契約](19_Maintenance.md#31-tracked-change-execution-contract)に従い、該当する契約母集団と利用側母集団、変更する条件規範の代表例、固定前の実差分照合を扱う。Issue受付時の外部提案者へ、これらの実行記録を常時要求しない。対象範囲、変更分類、決定権限、移行影響、基準版が実質的に変わった場合は、変更を暗黙に拡張せず整理へ戻す。

### 変更分類

正式な分類と承認規則は[メンテナンス](19_Maintenance.md#4-change-classification-and-approval)を正本とする。概要は次のとおり。

| 分類 | 貢献者向けの意味 |
|---|---|
| 編集上の | 意味や期待動作を変えず、表記、誤字、リンクを修正する |
| 明確化 | 責務や適用結果を変えず、既存規則を理解しやすくする |
| 追加 | 既存の必須結果を変えず、互換性のある指針や能力を追加する |
| 規範的な | 必須動作、決定権限、責務、ゲート、監査、準拠を変更する |
| 破壊的 | 既存採用者、成果物、ツール、準拠表明に移行または変更を要求する |

影響確認後に保守担当者が分類を変更する場合がある。CRDDが`v0.x`であっても、破壊的変更では移行を検討する。

### Pull Request

プルリクエストを提出する前に、次を確認する。

1. 単独で完結する編集上の修正を除き、関連Issueをリンクする。
2. 一つのプルリクエストに一つの主要な変更意図を置く。
3. 競合する新しい正本を増やさず、責務を持つ正本文書を更新する。
4. `40_Develop/**`または配布正本`template/tools/**`を変更する場合は[内部ツール・コーディング規約](06_Architecture/99_Coding_Standards.md)に従う。
5. 適用範囲に応じてREADME、概要、関連、ひな型、エージェント指示、監査基準、移行指針を追従させる。
6. 承認済み変更で必要とされない限り、旧判断理由、安定コンテキストID、過去CHANGELOGを破壊しない。
7. 独立レビューまたは監査の前に、親AIが固定した対象改訂版へ`node 40_Develop/checker/crdd-check.ts`を一度実行して結果を共有する。同等の決定論的確認へ置き換えられるが、監査は代替しない。
8. 未解決影響と保守担当者の判断が必要な点を隠さない。

リポジトリのプルリクエストひな型を使用する。十分に整理されたプルリクエストでも、根拠、一般化、決定権限、互換性、リリースへの影響が採用を支持しない場合は変更または却下されることがある。

### レビューと最終判断

保守担当者は追加根拠の依頼、対象範囲縮小、論点分離、代替案採用、分類変更、延期、非採用終了を行える。処置と理由は、必要に応じてIssue、プルリクエスト、結果となる正本成果物、リリース記録から追跡可能にする。

採用された非自明な変更はCRDD自身の変更経路へ入る。公開済みとする前に、正本更新、必要な監査、CHANGELOG、移行検討、リリース判断を完了しなければならず、実装Issueを先に終了してもリリース責務は免除されない。

採用変更を統合した後は、公開までIssueを未完了に保たず、`Integrated — Pending Release`として終了できる。統合済みプルリクエストまたは改訂版、変更した正本成果物、対象リリースまたはリリース計画参照、既知の制約／リスクを記録する。統合はリリースを意味せず、`Released`は対象バージョンまたは同等の不変リリース識別子が公開された後だけ使用する。拒否、重複、変更なし、一般化しなかったフィードバック等は、理由付き`Close without Release`とする。

CRDD公式GitHubリポジトリでは、対象バージョンのマイルストーンへ終了済みIssueと統合済みプルリクエストを集約し、タグ公開後にマイルストーンを終了できる。個別Issueの再未完了やリリース完了コメントは要求しない。マイルストーンはリポジトリ接続部であり、CRDD採用要件ではない。
