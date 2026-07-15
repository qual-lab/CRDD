# CRDD Change and Versioning

Version: v0.1.0
Status: Experimental
Owner: Qual-Lab
Last Updated: 2026-07-15
Related:
- [00_20_Context_Feedback_Loop.md](00_20_Context_Feedback_Loop.md)
- [00_21_Context_Repository_Audit.md](00_21_Context_Repository_Audit.md)
- [00_03_CRDD_Conformance.md](00_03_CRDD_Conformance.md)

---

# Purpose

本ドキュメントは、CRDD自身（`00_CRDD`配下の規範文書群）がどう変更・バージョニングされるかを定義する。

[`00_20_Context_Feedback_Loop.md`](00_20_Context_Feedback_Loop.md)は「プロダクト側の知見をどう00_CRDDへ昇格させるか」を扱い、[`00_21_Context_Repository_Audit.md`](00_21_Context_Repository_Audit.md)は「ドキュメントと実態のズレをどう検出するか」を扱う。本書はその両方の結果として発生する「CRDD自身の変更」を、採用プロダクト側にどう安全に伝播させるかを扱う。

> **Status: Draft.** 本書は論点の整理までであり、具体的なバージョニング規則・破壊的変更の告知方法はまだ確定していない。確定は人間主導で行う。

---

# 1. 論点（確定前の整理）

## 1.1 各文書のVersionは何を表すか

現状、各`00_CRDD`文書は個別に`Version: 0.x`を持つが、`00_CRDD`全体としてのバージョンは無い。次を検討する必要がある。

```text
文書ごとのVersionのみで足りるか
00_CRDD全体としての集合的なVersion（例: CRDD v0.2）を別途持つべきか
Core標準（00_10〜00_15）とPractice Guide（00_30〜00_35）でバージョニングの厳密さを変えるべきか
```

## 1.2 破壊的変更の扱い

CRDD自身のCore標準（例: Protected Areasの定義、Decision Logの必須項目）を変更する場合、それを採用している既存プロダクトにどう影響するかを考える必要がある。[`00_34_Compatibility_and_Evolution_Guide.md`](00_34_Compatibility_and_Evolution_Guide.md)のAPI/Interface Versioningの考え方（破壊的変更と非破壊的変更を区別し、移行手段を用意する）を、CRDD自身にも適用できるかを検討する。

## 1.3 Practice Guideの陳腐化

`00_30`番台のPractice Guide（Testing/Quality、AI Governance/Security、Compatibility/Evolution、Architecture/Integration等）は、特定の技術トレンドや実践知見に基づく。時間が経てば内容が古くなる可能性があるため、レビュー頻度・陳腐化した知見の扱い（Deprecated化の基準）を検討する必要がある。

---

# 2. 次にやること（人間主導）

```text
00_CRDD全体のバージョニング方針を決める（文書単位のみか、集合的Versionを持つか）
Core標準の破壊的変更をどう告知・移行するかを決める
Practice Guideの定期レビュー・陳腐化判定の頻度を決める
```

---

# 3. Minimum Rule

最低限、以下を守る。

```text
本書がExperimentalのままの間は、各文書のHeaderにあるVersion/Last Updatedのみを変更履歴の手がかりとする
Core標準（00_10〜00_15）を変更する場合は、[`00_14_AI_Change_Control.md`](00_14_AI_Change_Control.md)が定める
  人間承認プロセスに従う
```
