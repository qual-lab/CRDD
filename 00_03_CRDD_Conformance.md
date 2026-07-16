# CRDD Conformance

Version: v0.1.0
Status: Experimental
Owner: Qual-Lab
Last Updated: 2026-07-15
Related:
- [00_00_CRDD_Overview.md](00_00_CRDD_Overview.md)
- [00_01_CRDD_Principles.md](00_01_CRDD_Principles.md)
- [00_02_CRDD_Terminology.md](00_02_CRDD_Terminology.md)

---

# Purpose

本ドキュメントは、あるプロジェクトが「CRDDを実践している」と言えるための準拠条件（Conformance）を定義する。

現状、CRDDには「何を満たせばCRDDと名乗れるか」「一部だけ採用した場合もCRDDと呼べるか」「AIを使わなくてもCRDDは成立するか」「Git以外のRepositoryでも成立するか」「Subagent構成なしでも成立するか」を一箇所で定義した規範が無い。本書はそのギャップを埋める。

> **Status: Draft.** 本書は論点の整理までであり、準拠レベルの具体的な線引き（Level 0〜3等）はまだ確定していない。確定は人間主導で行う。

---

# 1. 出発点: Definition of Done との関係

`00_01_CRDD_Principles.md`「13. Definition of Done」は、個別の変更が完了したと言える条件（Working Software + Readable Context + Traceable Decision）を定義している。

本書が扱うのはその一段上のレベルである。**プロジェクト全体**が、CRDDという方法論に沿っていると言えるための条件を定義する。

```text
Definition of Done      = 個別の変更が完了したと言えるか
CRDD Conformance（本書） = プロジェクト全体がCRDDに沿っていると言えるか
```

---

# 2. 論点（確定前の整理）

## 2.1 段階を設けるか

```text
案A: Level制にする（例: Level 0 Context Repository → Level 1 Traceable Decisions →
     Level 2 Human-AI Collaboration → Level 3 Continuous Context Feedback）
案B: Level制にせず、必須要件・推奨要件・任意要件・CRDDを名乗れない状態の4区分にする
```

## 2.2 何が必須で、何が任意か（暫定の当たり）

現時点の暫定的な整理案（確定前）:

```text
必須になりそうなもの:
  - Gitリポジトリ（またはそれに相当する構造化されたバージョン管理）をContext Repositoryの正本とすること
  - 重要判断をDecision Logとして残すこと（00_12_Decision_Record_Standard.md）
  - 人間が最終判断者であること（AIが思想・判断・優先順位を勝手に確定しないこと）

任意になりそうなもの:
  - Subagent構成（00_31_Subagent_Practice_Guide.mdはPractice Guideであり、特定の
    Agent構成モデルを取らなくてもCRDDは成立しうる）
  - Testing/Quality・AI Governance/Security・Compatibility/Evolution・
    Architecture/Integrationの各Practice Guide（00_32〜00_35）の個別プラクティス
```

## 2.3 規範強度の表現

CRDD文書内でMUST/SHOULD/MAY相当の表現が統一されていない。本書で以下のようなキーワード規約を定義することを検討する（既存文書への遡及適用は別作業）。

```text
必須   = MUST      満たさない場合、CRDDに準拠しているとは言えない
禁止   = MUST NOT  行った場合、CRDDに準拠しているとは言えない
推奨   = SHOULD    原則として行うが、理由があれば逸脱してよい
非推奨 = SHOULD NOT 原則として避けるが、理由があれば行ってよい
任意   = MAY       プロジェクトの判断に委ねる
```

---

# 3. 次にやること（人間主導）

```text
Level制にするか、必須/推奨/任意の3区分にするかを決める
各Core標準（00_10〜00_15）のうち、どの項目が必須でどの項目が推奨かを確定する
Practice Guide（00_30〜00_35）はすべて任意（推奨知見）であることを明記する
規範強度キーワードを定義し、Core標準文書から順に適用していくかを判断する
```

---

# 4. Minimum Rule

最低限、以下を守る。

```text
本書がExperimentalのままの間は、既存の各文書のMinimum Ruleセクションを実質的な準拠条件として扱う
Practice Guide（00_30番台）の内容不採用を理由に「CRDDに準拠していない」と判定しない
```
