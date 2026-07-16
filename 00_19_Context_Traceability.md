# CRDD Context Traceability

Version: v0.3.0
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-16
Related:
- [00_02_CRDD_Core_Concepts_and_Terminology.md](00_02_CRDD_Core_Concepts_and_Terminology.md)
- [00_10_Context_Repository.md](00_10_Context_Repository.md)
- [00_11_Information_Provenance.md](00_11_Information_Provenance.md)
- [00_12_Decision_Rationale.md](00_12_Decision_Rationale.md)
- [00_18_UI_Behavior_Specification.md](00_18_UI_Behavior_Specification.md)

---

# 1. Purpose

本書は、DiscoveryからUX、IA、UI、Behavior Specificationへ続くContextを、必要最小限のStable IDとRelationで追跡する標準を定義する。

Stable IDは、すべての文書、Section、Evidence、Decision、Architecture、実装、Testへ付けるものではない。PathやRevisionだけでは追跡が壊れやすく、複数成果物から継続参照する意味単位に限定する。

---

# 2. Basic Principle

```text
IDは場所ではなく意味を識別する
文書番号とStable IDを分離する
Stable IDの種類と発行数を必要最小限にする
成果物とStable Contextを同一視しない
関係はIDの構造ではなくRelationで表現する
名称変更やファイル移動ではIDを変更しない
意味が置き換わる場合だけ新しいIDを発行する
```

---

# 3. Artifact and Stable Context

ArtifactはContextを表現・保存する媒体である。一つのArtifactに複数のStable Contextを含めてよい。

```text
04_Spec/01_Topic_Behavior.md
├─ SPEC-000041
├─ SPEC-000044
└─ SPEC-000052
```

同じStable Contextを複数Artifactから参照してよい。ただし、意味とStatusの正本となるArtifactとAnchorを一つ定める。

---

# 4. Document Number and Stable ID

文書番号はArtifactの分類、順序、探索を支援する番号であり、Stable IDではない。

```text
02_UX/01_Experience_Principles.md
├─ UX-000001
├─ UX-000002
└─ UX-000004
```

`01`は文書番号、`UX-000001`等は意味単位のStable IDであり、別の名前空間に属する。

Stable IDをファイル名またはDirectory名へ埋め込んではならない。Artifactとの接続にはPathを使用し、文書内に複数Contextがある場合はAnchor、必要な場合はRevisionを併用する。

## Good

```text
01_Discovery/01_Product_Requirements.md#missed-important-topic
04_Spec/01_Topic_Behavior.md#mark-important-topic-as-read
```

## Bad

```text
01_Discovery/REQ-000012.md
04_Spec/SPEC-000044.md
```

---

# 5. Standard ID Format

```text
<PREFIX>-<SEQUENCE>
```

```text
REQ-000012
UX-000004
IA-000008
UI-000021
SPEC-000044
```

PrefixはStable Contextの専門責務を示す。SequenceはRepository内でPrefixごとに一意な連番とする。

IDへ名称、画面名、日付、Release、Feature名を埋め込まない。

---

# 6. Standard Prefix

CRDD v0.3.0の標準Stable IDは、以下の5種類だけとする。

| Prefix | Context Type | Meaning |
|---|---|---|
| `REQ` | Discovery Requirement | Discoveryで得た、Product、System、Processが満たすべき要求・制約・解決条件 |
| `UX` | UX Context | UX Outcome、Experience Principle、JTBD等 |
| `IA` | IA Context | Object Model、情報構造、責務、Navigation等 |
| `UI` | UI Contract | 認識、操作、Feedback、UI Stateの契約 |
| `SPEC` | Behavior Specification | Condition、Trigger、State、System Behavior、Exception、Acceptance Criteria |

Subtypeで表現できる差異のためにPrefixを増やしてはならない。

```yaml
id: UX-000004
type: UX
subtype: ExperienceOutcome
```

---

# 7. What Does Not Receive a Standard Stable ID

以下はCRDD標準Stable IDの対象外である。

| Target | Identification / Trace Method |
|---|---|
| Origin、Problem、Observation | Discovery文書内のSection、Path、Anchor、Provenance |
| Feature、Use Case、User Action | 成果物内の名称、Section、必要なRelation Property |
| Evidence | 最寄りの`Evidence/`にあるPath、外部Artifact ID、Revision、Anchor |
| Decision | 結果となる成果物のPathとDecision / Rationale Anchor |
| Architecture | Architecture Artifact、Schema、Diagram、API、SectionのPathとRevision |
| Change | Change Package、Issue、Commit、Pull Request等の既存識別子 |
| Test | Test名、Test Artifact、Run ID、Revision |
| External Artifact | 外部System固有ID、URL、Revision |

したがって、`ARC-*`、`DEC-*`、`EVD-*`等をCRDD標準Prefixとして新規発行しない。

---

# 8. Requirement and Behavior Specification

`REQ-*`はDiscoveryで得た「何を満たす必要があるか」を追跡する。

`SPEC-*`は、Requirement、Feature、Use Case、User Action等について「どの条件と状態でSystemがどう振る舞うか」を追跡する。

```text
REQ-000012
利用者が重要事項を見落とさず確認できること

SPEC-000044
利用者が未読の重要Topicを開いたとき、
Systemは当該Topicを既読として記録しなければならない。
```

```text
REQ-000012 specified_by SPEC-000044
```

一つのRequirementを複数のBehavior Specificationが具体化してよく、一つのBehavior Specificationが複数Requirementへ寄与してもよい。

---

# 9. When to Assign a Stable ID

次のいずれかに該当するREQ、UX、IA、UI、SPECへStable IDを付与する。

```text
複数Artifactから参照される
別の専門層へ変換される
独立してReview、承認、置換される
変更影響を追跡する必要がある
長期間にわたり同じ意味を再発見する必要がある
```

次のものには通常付与しない。

```text
生の会話ログ
一時的なメモ
文書内の全Paragraph
全Figma Layer
全Source File
Evidenceファイル
Decision / Rationale Section
Architecture文書の全Section
実装途中の内部処理
```

Context作成時点で必ず発行する必要はない。複数成果物から参照される段階、または独立した追跡価値が明確になった段階で発行する。

---

# 10. Minimum Context Record

Stable IDを持つContextは、最低限以下を持つ。

| Property | Required | Meaning |
|---|---|---|
| `id` | Yes | Stable ID |
| `type` | Yes | REQ、UX、IA、UI、SPEC |
| `title` | Yes | 人間向け名称 |
| `status` | Yes | Draft、Reviewed、Approved、Superseded、Retired |
| `source` | Yes | 正本ArtifactとAnchor |
| `owner` | Recommended | Review・維持責任 |
| `relations` | When connected | 他のStable Contextとの意味的関係 |
| `last_updated` | Recommended | 最終更新日 |

```yaml
id: SPEC-000044
type: SPEC
title: 未読重要Topicの既読更新
status: Approved
source:
  artifact: 04_Spec/01_Topic_Behavior.md
  anchor: mark-important-topic-as-read
relations:
  - type: specifies
    target: REQ-000012
  - type: pairs_with
    target: UI-000021
last_updated: 2026-07-16
```

YAMLは実装例であり、同等のPropertyを取得できれば保存形式は限定しない。

---

# 11. Standard Relations

Relationは必要最小限にする。

| Relation | Direction | Meaning |
|---|---|---|
| `derived_from` | UX / IA / UI / SPEC → upstream Stable Context | 上流の意味を変換・具体化して生まれた |
| `addresses` | UX / SPEC → REQ | Discovery Requirementの解決へ寄与する |
| `realizes` | IA / UI / SPEC → UX | UX Outcomeや原則を実現する |
| `specified_by` | REQ → SPEC | RequirementがBehavior Specificationで具体化される |
| `pairs_with` | UI → SPEC | UI ContractとBehavior Specificationが対応する |
| `constrains` | REQ / UX / IA → downstream Stable Context | 下流へ守る条件を与える |
| `depends_on` | Stable Context → Stable Context | 成立に別Contextを必要とする |
| `supersedes` | New Stable Context → Old Stable Context | 新しい意味単位が旧Contextを置き換える |

Code、Architecture、Evidence、Decision、Change、Testとの接続はStable ID Relationを必須にせず、該当ContextのPropertyへArtifact参照として保持する。

```yaml
implementation:
  - path: 40_Develop/app/src/topic-priority.ts
architecture:
  - artifact: 06_Architecture/02_Topic_Pipeline.md
    anchor: priority-boundary
evidence:
  - artifact: 04_Spec/Evidence/Priority_Acceptance_Result.md
decision_rationale:
  artifact: 04_Spec/01_Topic_Behavior.md
  anchor: decision-rationale
verification:
  - test: topic-priority.acceptance.test.ts
    revision: commit-sha
```

---

# 12. Lifecycle

```text
Draft       = 作成中または復元候補
Reviewed    = 人間による確認済み
Approved    = 現在有効
Superseded  = 新しいStable Contextに置き換えられた
Retired     = 利用終了。後継がない場合を含む
```

名称、文書移動、Owner、Release変更ではIDを変更しない。

意味、責務、Contractが別物になる場合は、新しいIDを発行して`supersedes`を記録する。旧IDは削除・再利用しない。

---

# 13. Evidence and Decision Trace

EvidenceはStable IDではなくArtifact参照で追跡する。判断理由は成果物内のDecision / Rationale Sectionで追跡する。

```text
01_Discovery/Evidence/User_Interviews.md
  ↓ supports
REQ-000012
  ↓ specified_by
SPEC-000044
  ├─ Evidence: 04_Spec/Evidence/Priority_Acceptance_Result.md
  └─ Rationale: 04_Spec/01_Topic_Behavior.md#decision-rationale
```

配置ルールは[`00_11_Information_Provenance.md`](00_11_Information_Provenance.md)、判断理由の書式は[`00_12_Decision_Rationale.md`](00_12_Decision_Rationale.md)を参照する。

## 13.1. Discovery, Roadmap, and Delivery Route

`01_Discovery`はEvidenceとRequirementの正本、`99_Roadmap`は採用済みだが未着手の内容に関する優先順位・時期・着手条件の正本である。

```text
New Source / Voice / Law / Ambiguous Request
  ↓
01_Discovery/Evidence/...
  ↓ human interpretation and decision
REQ-* → UX-* / IA-* / UI-* / SPEC-*
  ├─ immediate → 07_Workflows/Changes/... → Architecture / Implementation / Test
  └─ deferred  → 99_Roadmap/...#item
                    ↓ starts_as
                  07_Workflows/Changes/...
```

Roadmap項目へStable IDを発行せず、対象のREQ、UX、IA、UI、SPECを参照する。Discovery文書をRoadmapへ移動せず、Roadmap本文をRequirementまたはSpecificationの正本にしない。

明確なDefectは既存UI / SPECと実装の差分としてChange Context Packageへ直行できる。仕様変更か不具合か曖昧な場合は`01_Discovery`へ戻り、分類が終わるまで既存IDの意味変更や新ID発行を行わない。

初期開発・保守期の具体的な経路は[`00_17_Discovery.md`](00_17_Discovery.md)の15〜18節を参照する。

---

# 14. Validation

ToolまたはAIは、少なくとも以下を検査できることが望ましい。

```text
標準外Prefixの新規発行
重複ID
存在しないStable ContextへのRelation
廃止IDの再利用
Superseded ContextをActiveとして参照するRelation
UI Contractに対応SPECまたは例外理由がない
利用者へ見えるSPECにUI ContractまたはUI不要理由がない
REQからSPECまたは解決成果物へ到達できない
Artifact LinkまたはAnchorが到達不能
EvidenceがRoot直下の中央Folderを正本としている
判断理由が結果となる成果物から追跡できない
```

---

# 15. Migration

v0.2以前にBehavior Requirementの意味で発行された`REQ-*`は、用語変更だけを理由に改番しない。既存IDをLegacy参照として維持し、Metadataで旧意味を明示する。

新規の`REQ-*`はDiscovery Requirementへ、新規のBehavior Specificationは`SPEC-*`へ付与する。

v0.2以前または移行中のProjectに`ARC-*`、`DEC-*`、`EVD-*`等が存在する場合、削除や一括改番を要求しない。ただし、v0.3.0以降はCRDD標準Prefixとして新規発行せず、Artifact参照、Evidence参照、Decision / Rationale Sectionへ段階的に移行する。

---

# 16. Minimum Conformance

```text
標準Stable IDはREQ、UX、IA、UI、SPECの5種類に限定する
文書番号とStable IDを別の名前空間として扱う
Stable IDをファイル名へ埋め込まない
一つのArtifactに複数Stable IDを含められる
REQからSPECへ、SPECからUI・実装・検証へ遡れる
Architecture、Evidence、Decision、Change、TestはArtifact参照で追跡できる
意味を置き換えた旧IDを削除・再利用しない
```

---

# 17. Final Principle

Stable IDは増やすほどTraceabilityが高まるわけではない。

CRDDでは、Discovery RequirementからUX、IA、UI、Behavior Specificationへ続く重要な意味単位だけをStable IDで追跡し、それ以外は成果物、Path、Anchor、Revision、既存Toolの識別子を使う。
