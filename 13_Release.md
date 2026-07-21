# CRDD Release

Version: v0.5.0
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-21
Related:
- [01_Principles.md](01_Principles.md)
- [02_Terminology.md](02_Terminology.md)
- [03_Documentation.md](03_Documentation.md)
- [12_Change.md](12_Change.md)
- [14_Workflow.md](14_Workflow.md)
- [19_Maintenance.md](19_Maintenance.md)
- [29_Verification.md](29_Verification.md)
- [53_Gap_Impact_Audit.md](53_Gap_Impact_Audit.md)

---

# 1. Purpose and Boundary

本書は、CRDDを適用するProductにおけるReleaseの最小契約と`90_Release`の配置責務を定義する。

ReleaseはDiscoveryからVerificationまでと同じ設計工程ではない。VerificationがRelease Readinessを評価し、Project固有のHuman Release Authorityが配布、有効化、延期、取消を判断する。本書はCI/CD、Branch戦略、Deploy手順、承認組織を一律に規定しない。

CRDD自体のVersion、CHANGELOG、Tag、Migrationは[Maintenance](19_Maintenance.md)を正本とする。

---

# 2. Release Flow and Authority

```text
Verified Change / Build Artifact
→ Release Readiness Evaluation
→ Human Release Decision
→ Distribution / Activation
→ Release Verification
→ Release Record and Learning
```

Release判断と`90_Release`の関係は次のとおりである。

```text
Verification
    ↓ Release Readiness recommendation
Project-specific Release Authority
    ↓ 承認・配布・有効化
90_Release（必要な場合のみ）
    └ Release Record・配布物参照・Release Verification
```

| Concern | Authority |
|---|---|
| Verification ResultとRelease Readiness Recommendation | [Verification](29_Verification.md) |
| 配布・有効化・延期・取消・Risk受容 | Project固有のHuman Release Authority |
| Change単位の影響Trace | [Change Trace](12_Change.md) |
| Release Record、CHANGELOG、配布物参照 | 本書 |
| 実際のBuild / Deploy / Rollback手順 | Project固有の[Workflow](14_Workflow.md)、CI/CD、Operations |

Verification完了はRelease承認を意味しない。Release Authorityは対象Version、Environment、対象CHG、残Risk、Rollback条件を識別して判断する。

---

# 3. Placement

必要なArtifactだけを`90_Release`へ置く。

```text
90_Release/
├─ Changes/
│  └─ CHG-000001_<SHORT_NAME>.md
├─ Releases/
│  └─ <VERSION>_Release.md
├─ Evidence/
└─ CHANGELOG.md
```

- `Changes/`はChange Traceを置く。詳細は[Change Trace](12_Change.md)に従う。
- `Releases/`は複数CHG、配布物、判断、結果を一つのReleaseとして束ねる必要がある場合に使用する。
- `Evidence/`は複数ChangeまたはRelease全体で使用するRelease Evidenceを置く。
- `CHANGELOG.md`は利用者へ公開するRelease単位の変更要約を置く場合に使用する。

すべてのProjectへ全FolderやRelease Recordの作成を要求しない。単一Artifactで十分な場合は空の構造を増やさない。ただし、CHGを使用する場合の配置先は`90_Release/Changes/`とする。

---

# 4. Release Record Contract

独立したRelease Recordを作る場合は、最低限次を取得可能にする。

```text
Release Version / Identifier
Status
Release Scope and Target Environment
Included CHG References
Excluded / Deferred CHG References
Build / Distribution Artifact Reference
Release Readiness Result
Triggered Propagation Check Result / Propagation Exception
Human Release Decision and Conditions
Known Limitation / Residual Risk
Human-centered Quality Finding / Exception Reference
Migration / Compatibility / Rollback Reference
Release Verification Result
Released At
Follow-up / Learning
```

Release Recordは各CHGの影響説明、Verification Result、配布物、運用手順を全文複製せず、Referenceで束ねる。

---

# 5. CHANGELOG and Git

Release CHANGELOGは利用者視点でAdded、Changed、Fixed、Deprecated、Removed、Security、Migration等を要約する。内部Task、Commit、ファイル移動をそのまま列挙しない。

Git LogからCHANGELOGを生成または補助生成してよい。対象ReleaseのGit Rangeに加えて、Included CHG、Breaking Change、Migration、Known Limitation、Security Noticeを確認する。生成結果はHuman Release Authorityまたは指定Reviewerが公開前に確認する。

CHGはCHANGELOGの下書きではない。CHGは変更のTrace、CHANGELOGはRelease利用者への通知を担う。

---

# 6. Release Readiness and Completion

Release判断前に、対象Scopeに応じて次を確認する。

```text
Included CHGが`Ready for Release Handoff`または明示的にCondition付きである
Build / Distribution Artifactを一意に識別できる
Required VerificationとRelease Verificationが完了している
Included Scopeで発火したTriggered Propagation Checkが完了し、必要な正本更新と再監査を辿れる。未完了の場合はHuman-directed `propagation_exception`として通常Readinessと区別されている
Security、Privacy、Governance、License、Costの未解決事項を把握している
適用するNormativeなHuman-centered Quality Criteriaが`Verified`または根拠付き`Not Applicable`である。未解決Findingまたは未評価Scopeを含む場合は、Human Authorityが対象Revision、理由、Mitigation、期限・再確認条件、Residual Riskを明示した例外として通常Readinessと区別している
Compatibility、Migration、Rollback、Operational Readinessを確認している
Known LimitationとResidual Riskが利用者または運用者へ伝達される
CHANGELOGまたは同等のRelease Communicationが確認されている
```

Release後は実際のVersion、時刻、対象Environment、結果をRelease Recordと該当CHGへ反映する。Failure、Rollback、RegressionはEvidenceを残し、必要に応じて新しいCHG、Reopen、Discovery、Roadmapへ戻す。

---

# 7. Final Principle

`90_Release`は開発工程を複製する場所ではない。

変更、検証済み配布物、人間のRelease判断、利用者への通知、Release結果を接続し、何がどのReleaseへ入ったかを再構成できる最小のDelivery Contextである。
