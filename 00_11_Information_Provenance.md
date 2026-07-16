# Information Provenance

Version: v0.3.0
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-16
Related:
- [00_10_Context_Repository.md](00_10_Context_Repository.md)
- [00_12_Decision_Rationale.md](00_12_Decision_Rationale.md)
- [00_19_Context_Traceability.md](00_19_Context_Traceability.md)

---

# 1. Purpose

本書は、CRDDにおけるEvidenceの意味、配置、参照、鮮度、判断理由への反映方法を定義する。

Evidenceは独立したStable ID体系や中央Folderを作るための概念ではない。成果物の主張、要求、仕様、設計、検証結果を支える根拠である。

---

# 2. Basic Principle

```text
Evidence = 成果物の内容を支える根拠
Source   = Evidenceの出所
Decision = Evidenceや経緯を踏まえて成果物へ反映した判断
```

Source Artifactを置いた、または外部Sourceへリンクしただけでは、根拠として十分とは限らない。利用目的に応じて、対象、取得条件、Revisionまたは時点、Provenance、既知の制限を明示する。

EvidenceそのものへCRDD標準のStable IDを付与しない。EvidenceはPath、URL、Artifact固有ID、Revision、Anchor等で参照する。

---

# 3. Evidence Placement

Evidenceは、利用する成果物に最も近い親Folderの下へ置く。

```text
01_Discovery/
├─ 01_Product_Requirements.md
└─ Evidence/
   ├─ Interview_Notes.md
   └─ Market_Research.md

02_UX/
├─ 01_Experience_Principles.md
└─ Evidence/
   └─ Usability_Observation.md

04_Spec/
├─ 01_Topic_Behavior.md
└─ Evidence/
   └─ Existing_Behavior_Capture.md

06_Architecture/
├─ 01_System_Boundaries.md
└─ Evidence/
   └─ Runtime_Measurement.md
```

Project Root直下へ`90_Evidence`等の中央Evidence Folderを基本構成として作ってはならない。

複数領域で同じSourceを使う場合も、安易にRootへ移動しない。最も責任の近い親Folderに正本を置き、他の成果物から参照する。外部Systemが正本である場合は、各成果物から外部Artifactと固定Revisionへ直接リンクしてよい。

---

# 4. Inline Evidence and Evidence Files

Evidenceが短く、単一成果物だけで利用する場合は、成果物内の`Evidence` Sectionへ直接記載してよい。

```markdown
## Evidence

- Source: User interview summary
- Observed at: 2026-07-10
- Participants: 5 project managers
- Finding: 4名が重要Topicの見落としを報告した
- Limitations: 同一業種のみ
```

Evidenceが長い、画像やCaptureを伴う、複数成果物から参照する、独立したRevision管理が必要な場合は、最寄りの`Evidence/`へ分離する。

---

# 5. Minimum Evidence Properties

Evidenceを成果物の根拠として使う場合、Riskに応じて以下を追跡可能にする。

| Property | Meaning |
|---|---|
| Subject | 何を裏づけるEvidenceか |
| Source | 元資料、観察対象、実行結果 |
| Revision / Observed At | どのRevisionまたは時点か |
| Conditions | 対象、Environment、取得・検証条件 |
| Finding | 何が確認されたか |
| Limitations | 適用範囲、未確認事項、偏り |
| Provenance | Human、Observed、Tool、External等 |
| Owner | 鮮度と利用判断を維持する責任者 |

Evidenceファイルの例:

```yaml
subject: 未読の重要Topicを利用者が識別できるか
source: usability-test/session-summary
observed_at: 2026-07-10
conditions:
  participants: 5
  prototype_revision: figma-42
finding: 4名が優先Topicを正しく選択した
limitations:
  - 同一業種の参加者のみ
provenance: Observed
owner: UX Research
```

---

# 6. Discovery and Requirement

Discoveryで得た観察、調査、制約は、必要に応じて`01_Discovery/Evidence/`へ保存する。

そこから、複数成果物で追跡する価値がある要求を`REQ-*`としてDiscovery成果物へ記録する。

```text
01_Discovery/Evidence/User_Interviews.md
  ↓ supports
REQ-000012 利用者が重要事項を見落とさず確認できること
  ↓ specified_by
SPEC-000044 未読重要Topicの表示・既読更新Behavior
```

EvidenceとRequirementを同一視してはならない。Evidenceは要求の根拠であり、RequirementはDiscoveryから得た「満たすべき条件」である。

---

# 7. Decision and Evidence

Evidenceを根拠に判断した場合、判断結果となるCanonical Artifact内に、採用内容とEvidence参照を残す。

```markdown
## Decision / Rationale

### Adopted
重要Topicは通常Topicより先に表示する。

### Why
利用者が重要事項を見落とす問題を優先して解決するため。

### Evidence
- ../01_Discovery/Evidence/User_Interviews.md
- Evidence/Priority_Prototype_Test.md

### Alternatives / History
- 時系列のみの表示は、重要事項を識別できないため不採用。
```

Evidenceは材料であり、成果物へ反映された内容が判断結果である。

---

# 8. Freshness and Replacement

Evidenceは対象Revisionや時点が変わると陳腐化する。

```text
Current   = 現行成果物の判断に利用できる
Stale     = 再確認が必要
Replaced  = 新しいEvidenceに置き換えられた
Invalid   = 条件不備等により根拠として利用できない
```

古いEvidenceを削除する必要はないが、現行成果物の根拠として参照し続ける場合は妥当性を再確認する。

---

# 9. Minimum Rules

```text
Evidenceは利用する成果物に最も近い親Folderの下へ置く
Root直下へ中央Evidence Folderを基本構成として作らない
短いEvidenceは成果物内へ記載してよい
EvidenceへCRDD標準Stable IDを付けない
Source、Revisionまたは時点、条件、Finding、Limitationsを追跡可能にする
Discovery Evidenceから昇格した要求はREQ-*として追跡できる
判断に使ったEvidenceは結果となる成果物のDecision / Rationale Sectionから参照する
```

---

# 10. Final Principle

Evidenceは集めるために存在するのではない。

CRDDでは、Evidenceを必要な成果物の近くへ置き、要求、仕様、設計、検証の理由を後から確かめられるようにする。
