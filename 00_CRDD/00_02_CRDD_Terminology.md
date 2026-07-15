# CRDD Terminology

Version: v0.1.0
Status: Experimental
Owner: Qual-Lab
Last Updated: 2026-07-15
Related:
- [00_00_CRDD_Overview.md](00_00_CRDD_Overview.md)
- [00_03_CRDD_Conformance.md](00_03_CRDD_Conformance.md)

---

# Purpose

本ドキュメントは、CRDD固有の用語の意味を固定するための規範的Glossaryである。

現状、CRDDの各文書内で重要な概念が個別に定義・使用されており、定義が文書ごとに分散している。本書は、それらを一箇所に集約し、用語の意味がプロダクトやセッションをまたいでブレないようにするための正本を目指す。

> **Status: Draft.** 本書は骨子（対象語の一覧と分類）のみを整理した段階であり、各用語の正式な定義文はまだ確定していない。定義の確定は人間主導で行う。

---

# 1. 対象語（一次分類のみ、定義は未確定）

## 1.1 Repository / Contextの単位

```text
Context
Context Repository
Source of Truth
Evidence
Decision
Promotion
Generated Context
```

## 1.2 役割・責任

```text
Human
AI
Owner
Authority
```

## 1.3 文書ライフサイクル状態

```text
Draft
Approved
Verified
Implemented
Superseded
Deprecated
```

## 1.4 情報の種別（epistemic status）

```text
Fact
Evidence
Interpretation
Proposal
Decision
Requirement
Plan
Implementation
Verification Result
```

CRDDは「Contextを保存する方法論」であるため、この情報種別の区別（何を事実として扱い、何をAIの解釈として扱い、何を人間の決定として扱うか）が方法論の核心に近い。優先して定義を確定すべき語群である。

---

# 2. 既存文書での使用箇所（定義の手がかり）

各語の暫定的な用法は、以下の既存文書に分散している。定義確定時にはこれらを出典として突き合わせる。

| 語群 | 手がかりとなる既存文書 |
|---|---|
| Context Repository / Source of Truth | `00_10_Context_Repository_Standard.md` |
| Evidence / Promotion / Generated Context | `00_11_Information_Type_and_Provenance.md` |
| Decision | `00_12_Decision_Record_Standard.md` |
| Human / AI / Owner / Authority | `00_13_Human_AI_Responsibility.md`, `00_14_AI_Change_Control.md` |
| Draft / Approved / Verified / Implemented / Superseded / Deprecated | `00_10_Context_Repository_Standard.md`, `00_15_Document_Standard.md`, `00_32_Testing_and_Quality_Guide.md`（Implemented vs Verified） |

---

# 3. 次にやること（人間主導）

```text
各語の正式な定義文を確定する
Fact / Evidence / Interpretation / Proposal / Decision / Requirement / Plan /
  Implementation / Verification Resultの相互関係を明文化する
確定した用語をStatus: Approvedへ変更する
既存文書内の用語の揺れ（同じ概念に異なる語を使っている箇所）を洗い出し、本書へ統一する
```

---

# 4. Minimum Rule

最低限、以下を守る。

```text
本書がExperimentalのままの間は、既存文書内の用語運用を正とする（本書が既存の用法を上書きしない）
新しい用語を導入する場合、まず本書へ草案として追加してから使い始める
```
