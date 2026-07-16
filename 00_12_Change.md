# CRDD Change Trace

Version: v0.4.0
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-17
Related:
- [00_01_Principles.md](00_01_Principles.md)
- [00_02_Terminology.md](00_02_Terminology.md)
- [00_03_Documentation.md](00_03_Documentation.md)
- [00_13_Release.md](00_13_Release.md)
- [00_21_Discovery.md](00_21_Discovery.md)
- [00_28_Implementation.md](00_28_Implementation.md)
- [00_29_Verification.md](00_29_Verification.md)
- [00_53_Gap_Impact_Audit.md](00_53_Gap_Impact_Audit.md)

---

# 1. Purpose and Boundary

本書は、各Triggerから発生した一つの変更について、なぜ始まり、どのContextとArtifactへ影響し、何を実装・検証・Releaseしたかを辿るChange Traceの正本である。

```text
Trigger / Origin
→ Change Intent
→ Expected Impact
→ Canonical Context / Implementation / Verification
→ Actual Impact
→ Release Disposition
```

Change Traceは工程、Task管理、実装計画、Commit一覧、Pull Request説明、Release CHANGELOGの代替ではない。これらをArtifact Referenceで接続し、変更の意味と影響範囲をReleaseから遡れるようにする。

| Concern | Authority |
|---|---|
| ChangeのTrigger、Intent、Impact、関連Artifact、結果 | 本書 |
| Artifact、Evidence、Decision / Rationale、Trace | [Documentation](00_03_Documentation.md) |
| 作業手順 | [Workflow](00_14_Workflow.md) |
| 工程固有のEntry / Exit / Gate | 各`00_21`〜`00_29`工程文書 |
| Gap / Impact評価 | [Gap / Impact Audit](00_53_Gap_Impact_Audit.md) |
| Implementation | [Implementation](00_28_Implementation.md) |
| Verification | [Verification](00_29_Verification.md) |
| Release判断、記録、CHANGELOG | [Release](00_13_Release.md) |

---

# 2. Trigger and Route

Change Traceは、変更を実施すると決まった時点、または既に発生した変更をRelease対象として追跡する必要が生じた時点で作成する。

```text
Evidence・要望・法改正・不具合・Roadmap・監査結果
                         │
             意味や要求が不明確か
                  ┌──────┴──────┐
                 Yes            No
                  │              │
              Discovery          │
                  │              │
          採用・対応決定──────────┘
                         │
                    Change Trace
                         │
       必要な工程の再開・実装・Verification
                         │
             正本への反映・学習・Close
                         │
              必要ならReleaseへ引き渡す
```

主なTriggerは次のとおりである。

```text
Discoveryで採用された要求・法改正・顧客要望
明確な仕様変更
承認済み仕様からのDefect
仕様変更かDefectか曖昧な要求をDiscoveryで分類した結果
Roadmap項目の着手決定
工程Review、Verification、Gap / Impact Auditの是正決定
運用、Security、Privacy、Cost、Compatibility上の是正
緊急対応またはReleased ProductへのCorrection
```

曖昧な要求はChange Traceへ直接入れず、Discoveryで意味、Requirement、採否、優先度を整理する。明確なDefectは不要なRequirementを新設せず、対象Contractへの逸脱としてChange Traceへ進める。延期する採用事項は`99_Roadmap`へ置き、着手時にChange Traceを作成する。

Typo、意味を変えないFormat、再生成可能な出力など、Release内容やCanonical Contextへ影響しない変更はCHGを省略できる。ただし、Commit数の少なさだけで省略を判断しない。

---

# 3. Placement and Change Trace ID

Change Traceは原則として次へ配置する。

```text
90_Release/
├─ Changes/
│  ├─ CHG-000001_Consent_Execution_Control.md
│  └─ CHG-000002_Topic_Read_State.md
└─ Evidence/
```

ファイル名は次の形式を使用する。

```text
CHG-<SEQUENCE>_<SHORT_NAME>.md
```

`CHG-*`はChange Traceを一意に参照するためのArtifact IDであり、REQ、UX、IA、UI、SPECと同じStable Context IDではない。意味を持つContextへ付与せず、一つのChange Traceへ一つだけ付与する。番号は再利用せず、名称変更やファイル移動でも維持する。

Change Traceに固有Evidenceがある場合は`90_Release/Changes/Evidence/`またはChange固有の子Folderへ置く。複数ChangeやRelease全体に関係するEvidenceは`90_Release/Evidence/`へ置く。Root直下へEvidence Folderを作らない。

`07_Workflows`や`40_Develop`へCHG Markdownを置かない。

---

# 4. Change Trace Contract

各CHGは最低限、次を取得可能にする。

```text
Change Trace ID
Status
Trigger / Origin
Primary Change Intent
Expected Impact Scope
Out of Scope / Must Not Change
Affected Context and Artifact References
Applicable Decision / Approval Reference
Implementation Reference
Verification Obligation / Result Reference
Actual Impact and Deviation
Canonical Context Update
Known Limitation / Residual Risk
Target Release / Released In / Release Disposition
Follow-up / Roadmap Reference
```

Expected Impact Scopeでは、影響し得る工程、Stable Context ID、Artifact、Data、Interface、Migration、Security、Privacy、Cost、Operation、Userを、判明している範囲で示す。実行後はActual Impactを更新し、見込みとの差、追加影響、影響なしと確認した範囲を残す。

CHGはRequirement、UX、IA、UI、SPEC、Architecture、Decisionの正本にならない。確定結果は責務を持つCanonical Artifactへ反映し、CHGからPath、Anchor、RevisionまたはStable Context IDで参照する。

---

# 5. Status and Revision

| Status | Meaning |
|---|---|
| `Open` | Triggerを受け、影響と実施内容を追跡中 |
| `Ready for Verification` | 対象実装とVerification Obligationを識別可能 |
| `Verified` | 対象RevisionのVerification Resultを取得済み |
| `Ready for Release Handoff` | 正本反映、残Risk、Release帰属を確認し、Release Authorityへ引き渡せる |
| `Released` | 対象Releaseで配布または有効化済み |
| `Closed` | Release不要を含め、変更結果と追跡上の処置が完了 |
| `Cancelled` | 変更を実施せず終了 |
| `Reopened` | 新Evidence、Regression、Scope変更等で再開 |
| `Superseded` | 別CHGへ置換 |

CHGのStatusは工程承認、Task、Pull Request、Verification Result、Release判断と同一ではない。それぞれのAuthorityが返した結果を参照する。

Intent、Expected Impact、対象Baseline、Verification Obligation、Release帰属が変わった場合はCHGのRevisionまたはHistoryを更新する。Primary IntentまたはRelease / Rollback Boundaryが分かれる場合は新しいCHGへ分割し、相互参照する。

---

# 6. Git, Pull Request, and CHANGELOG Boundary

Git、Pull Request、CHG、CHANGELOGは次の責務を持つ。

| Record | Primary Responsibility |
|---|---|
| Git Commit | どのファイルがどのRevisionで変更されたか |
| Pull Request | Review単位の差分、会話、Check、Merge結果 |
| `CHG-*` | Trigger、変更意図、影響範囲、正本・実装・検証・Release間のTrace |
| Release CHANGELOG | 利用者へ伝えるRelease単位の変更要約 |

CHGへCommit一覧やDiffを転記しない。実装の範囲を識別するために必要なCommit、Pull Request、Build、Deployment等をReferenceする。

CHANGELOGはGit履歴から生成または補助生成してよい。ただしGit履歴だけでは利用者への意味、Breaking Change、Migration、既知制限、複数Commitにまたがる一つの変更を安定して復元できない場合がある。Release時は対象CHGとGit履歴を入力として編集し、CHG本文をそのまま複製しない。

---

# 7. Closure

`Verified`だけではChange Traceを閉じない。次を確認する。

```text
Actual Impactが記録されている
確定内容がCanonical Artifactへ反映されている
ImplementationとVerificationの対象Revisionが一致する
Known Limitation / Residual RiskとOwnerを辿れる
未実施事項が別CHGまたはRoadmapへ接続されている
Target Release、Released In、Release不要、取消のいずれかが明確である
```

Release後にRegressionや新しい影響が判明した場合、同一Intentの追跡継続ならReopenし、別の是正Intentなら新しいCHGを作成して元CHGを参照する。

---

# 8. Compact Example

```yaml
change_id: CHG-000042
status: Ready for Release Handoff
trigger:
  type: defect
  source: SPEC-000018
intent: 未同意状態で外部送信処理を起動させない
expected_impact:
  contexts:
    - SPEC-000018
  artifacts:
    - 06_Architecture/AI_Data_Boundary.md
  runtime:
    - batch
    - queue
out_of_scope:
  - Consent UIの全面Redesign
must_not_change:
  - 同意前は外部送信しない
implementation:
  - pull-request-reference
verification:
  obligation: 未同意・取消済み・状態不明で全Execution Pathが停止する
  result: verification-result-reference
actual_impact:
  - SPECとArchitectureを更新
  - BatchとQueueの起動Guardを変更
target_release: v1.4.0
released_in: pending
residual_risk: none-known
```

---

# 9. Anti-patterns and Audit

```text
Commit一覧をCHG本文へ複製する
CHGをTask Listまたは日報にする
影響範囲を書かず変更結果だけを記録する
正本を更新せずCHGだけを仕様の正本にする
複数の無関係なIntentを一つのCHGへ入れる
CHG番号をStable Context IDとして使用する
Release後もTarget ReleaseやActual Impactを更新しない
```

Auditでは次を確認する。

- Trigger、Intent、Expected / Actual Impactを識別できる
- 影響するCanonical Context、実装、Verificationを辿れる
- Scope外と守る条件が明確である
- CHGとGit / Pull Request / CHANGELOGが責務を重複していない
- Release帰属またはRelease不要のDispositionがある
- 残課題、Residual Risk、後続CHGを辿れる

---

# 10. Final Principle

Change Traceは変更作業そのものではない。

各TriggerからRelease結果まで、変更の意味と影響範囲を正本、実装、検証、Git履歴へ接続し、将来の人間とAIが変更理由を再構成できるようにするTrace Logである。
