# Decision and Rationale

Version: v0.3.0
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-16
Related:
- [00_10_Context_Repository.md](00_10_Context_Repository.md)
- [00_11_Information_Provenance.md](00_11_Information_Provenance.md)
- [00_14_AI_Change_Control.md](00_14_AI_Change_Control.md)
- [00_15_Document.md](00_15_Document.md)

---

# 1. Purpose

本書は、重要な判断を最終成果物へ反映し、その理由、Evidence、代替案、経緯を同じ文脈から追跡できるようにするルールを定義する。

CRDDでは、Decisionを成果物から分離した中央台帳へ集約することを基本としない。判断の結果は、承認されたUX、IA、UI、Behavior Specification、Architecture、Workflow、Roadmap等の成果物である。

---

# 2. Basic Principle

```text
Decision Result = 採用された内容が反映されたCanonical Artifact
Rationale       = なぜその内容を採用したか
Evidence        = 判断を支えた根拠
History         = 代替案、却下理由、変更経緯
```

DecisionへCRDD標準のStable IDを付与しない。`DEC-*`は標準Prefixではない。

Project Root直下へ`95_Decisions`等の中央Decision Folderを基本構成として作ってはならない。

---

# 3. Storage and Authority

判断理由は、判断結果のProperty Authorityを持つCanonical Artifact内へ記録する。

```text
Product要求の判断       → 01_Discoveryの該当Requirement文書
UX原則・Outcomeの判断   → 02_UXの該当文書
情報構造・責務の判断    → 03_IAの該当文書
System Behaviorの判断   → 04_Specの該当文書
表示・操作の判断        → 05_UIの該当文書
技術方式・境界の判断    → 06_Architectureの該当文書
開発・Release手順の判断 → 07_Workflowsの該当文書
優先順位・将来予定      → 99_Roadmapの該当文書
```

複数成果物へ影響する場合は、判断責任を持つ主成果物へRationaleを記録し、他の成果物から主成果物のPathとAnchorへリンクする。同じ判断理由を複数箇所で手動管理してはならない。

Architecture Decision Record等、領域固有の成果物形式をProjectが利用することは妨げない。ただし、それをRoot直下の全Decision中央台帳やCRDD Stable ID体系として扱わない。

---

# 4. When to Record Rationale

以下に該当する判断は、成果物内へ理由と経緯を残す。

```text
Productの思想、価値、Scopeを変える
Requirement、UX、IA、UI、Behavior Specificationを採用・変更・廃止する
重要な技術境界、Data、API、Security方式を選択する
互換性、Migration、Release、Risk Acceptanceへ影響する
有力な代替案を却下する
後から結論だけでは理由を再構成できない
```

誤字、表記、意味を変えない整理、一時メモ等には通常不要である。

---

# 5. Decision / Rationale Section Template

```markdown
## Decision / Rationale

### Adopted
採用し、本文へ反映した内容。

### Why
解決したい問題、守る価値、判断理由。

### Evidence
- 相対Path、URL、Artifact固有ID、Revision、Anchor

### Alternatives
- 検討した案
- 採用しなかった理由

### Consequences
- 得られる効果
- Trade-off
- Follow-up

### History
- 2026-07-16: 初回承認
- 後から変更した場合の変更理由と旧Revisionへの参照
```

Riskが低い場合は、`Adopted`、`Why`、`Evidence`だけへ縮小してよい。

---

# 6. Decision Result and Stable Context

判断によってREQ、UX、IA、UI、SPECの意味が確定または変更された場合、成果物内の該当Stable IDを維持する。

意味が置き換わる場合は、新しいStable IDを発行し、旧IDとの`supersedes` Relationを記録する。これはDecision IDを作ることを意味しない。

```text
SPEC-000052 supersedes SPEC-000044
Reason: 04_Spec/01_Topic_Behavior.md#decision-rationale
```

---

# 7. Evidence

判断に利用したEvidenceは、成果物内のEvidence Section、最も近い親Folderの`Evidence/`、または外部Sourceの固定Revisionへリンクする。

Evidenceの配置と最低Propertyは[`00_11_Information_Provenance.md`](00_11_Information_Provenance.md)に従う。

```text
Evidence = 判断材料
Decision = 成果物へ反映した判断
Rationale = その判断へ至った理由と経緯
```

---

# 8. AI Draft Handling

AIは、成果物の変更案とDecision / Rationale SectionのDraftを作成してよい。

ただし、AIは重要判断を自己承認してはならない。人間が成果物の採否とRationaleを確認するまで、提案内容をApprovedまたは確定事実として扱わない。

AIは以下を区別する。

```text
Evidenceから確認できる事実
AIによる解釈
採用を提案する内容
人間が承認した成果物
```

---

# 9. Change and History

成果物の判断を変更する場合、過去の理由を黙って消さない。

```text
新しい内容を本文へ反映する
Decision / RationaleのHistoryへ変更理由を追加する
旧Revisionまたは旧Stable IDを参照可能にする
意味が置換されたStable ContextはSupersededにする
```

Git履歴だけに理由を委ねず、現行成果物から必要な経緯へ到達できるようにする。

---

# 10. Minimum Rules

```text
判断結果はCanonical Artifactへ反映する
理由、Evidence、重要な代替案、経緯は同じ成果物内へ残す
DecisionへCRDD標準Stable IDを付けない
Root直下へ中央Decision Folderを基本構成として作らない
複数成果物にまたがる場合は主成果物を一つ定め、他からリンクする
AI Draftは人間承認まで確定扱いしない
```

---

# 11. Final Principle

Decisionは独立した記録を増やすためのものではない。

CRDDでは、成果物を見れば、何が採用され、なぜそうなり、どのEvidenceと経緯に基づくかを追跡できる状態を作る。
