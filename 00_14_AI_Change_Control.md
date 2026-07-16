# AI Change Control

Version: v0.1.0
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-12
Related:
- [00_10_Context_Repository.md](00_10_Context_Repository.md)
- [00_13_Human_AI_Responsibility.md](00_13_Human_AI_Responsibility.md)
- [00_12_Decision_Record.md](00_12_Decision_Record.md)

---

# 1. Purpose

本ドキュメントは、プロダクト開発においてAIがContext Repositoryを編集する際のルールを定義する。

CRDDでは、AIを積極的に活用する。
ただし、AIにプロジェクトの思想、判断、優先順位、正本情報を破壊させてはいけない。

AIは作業を支援する。
人間は判断し、承認し、責任を持つ。

---

# 2. Basic Principle

AI編集の基本原則は以下である。

```text
AI can draft.
AI can organize.
AI can implement.
AI can verify.
AI cannot decide without human approval.
```

日本語では、以下を基本方針とする。

```text
AIは草案を作れる。
AIは整理できる。
AIは実装できる。
AIは検証できる。
AIは人間承認なしに重要判断を確定しない。
```

---

# 3. Edit Levels

AIによる編集は、以下の4段階に分ける。

| Level   | Name          | Meaning            |
| ------- | ------------- | ------------------ |
| Level 0 | Read Only     | AIは読むだけ。編集しない      |
| Level 1 | Draft         | AIは草案を作成できる        |
| Level 2 | Assisted Edit | AIは編集できるが、人間レビュー必須 |
| Level 3 | Safe Edit     | AIが比較的自由に編集できる     |

---

# 4. Folder Edit Policy

| Folder            | AI Edit Level | Policy                       |
| ----------------- | ------------- | ---------------------------- |
| `00_CRDD`         | Level 1〜2     | 原則・運用ルールのため、人間承認必須           |
| `01_Discovery`    | Level 1〜2     | 一次情報・要求候補の受け皿。分類・昇格は人間承認必須   |
| `02_UX`           | Level 1〜2     | プロダクトの思想正本のため、人間承認必須        |
| `03_IA`           | Level 2       | 構造案の整理・更新は可能。重要変更は承認必須       |
| `04_Spec`         | Level 2       | 機能仕様の草案・整理は可能。振る舞い・受け入れ条件変更は承認必須 |
| `05_UI`           | Level 2       | UI表示・操作・文言の草案整理は可能。画面責務変更は承認必須 |
| `06_Architecture` | Level 2       | 技術設計の草案・修正は可能。構成変更は承認必須      |
| `07_Workflows`    | Level 2〜3     | 運用手順の草案・更新は可能。開発フローの方針変更は承認必須 |
| `40_Develop`      | Level 3       | 実装計画、作業ログ、検証結果はAI編集可         |
| `80_PR`           | Level 1〜2     | PR文案は作成可。外部公開表現は人間承認必須       |
| `90_Evidence`     | Level 2〜3     | 要約・分類・Index作成は可能。解釈の正本化は承認必須 |
| `90_Release`      | Level 2〜3     | Release Evidence・要約作成は可能。Release可否判断は人間 |
| `95_Decisions`    | Level 1       | Decision Logの下書きのみ。確定判断は人間   |
| `99_Roadmap`      | Level 1〜2     | Roadmap案は作成可。優先順位確定は人間       |

---

# 5. Protected Areas

以下は、AIが人間承認なしに確定変更してはいけない。

```text
CRDD原則
プロダクトの思想
Product Philosophy
Non-goal
Human / AI Role
Roadmap優先順位
重要Decision
Security方針
Governance方針
AI利用同意方針
データ保持方針
外部公開方針
```

AIはこれらについて、以下は行ってよい。

```text
論点整理
問題提起
草案作成
代替案作成
差分比較
影響範囲整理
```

ただし、確定は人間が行う。

---

# 6. AI Can Edit

AIが比較的安全に編集してよいものは以下である。

```text
40_Develop配下の作業計画
40_Develop配下の検証結果
実装メモ
テスト計画
テスト結果
fixture説明
エラー調査メモ
AI作業ログ
既存文書の表記ゆれ修正案
リンク補正案
READMEの草案
PR文案の草案
Evidenceの要約
```

ただし、既存方針を変更する場合は、人間レビューを必要とする。

---

# 7. AI Must Ask Human Review

以下に該当する場合、AIは作業を止めて人間レビューへ戻す。

```text
思想が変わる
目的が変わる
対象ユーザーが変わる
機能優先順位が変わる
画面責務が変わる
IA構造が変わる
機能仕様・状態・受け入れ条件が変わる
DBスキーマが変わる
AI出力スキーマが変わる
Security / Governanceに影響する
既存データ互換性に影響する
外部公開内容に影響する
```

---

# 8. Required AI Work Flow

AIが編集または実装を行う場合、原則として以下の順に進める。

```text
1. 関連Contextを読む
2. 影響範囲を整理する
3. Planを提示する
4. 人間が必要に応じて確認する
5. AIが編集・実装する
6. AIが差分を説明する
7. AIが検証結果を残す
8. 人間がレビューする
9. 必要ならDecision Logへ反映する
```

---

# 9. Required Plan Format

AIが実装または重要編集を行う前には、以下の形式でPlanを出す。

```text
# AI Work Plan

## Goal

## Related Context

## Target Files

## Non-goals

## Expected Changes

## Risks

## Verification Method

## Need Human Decision
Yes / No
```

---

# 10. Required Result Format

AIが編集・実装を行った後は、以下の形式で結果を残す。

```text
# AI Work Result

## Summary

## Changed Files

## Verification Result

## Remaining Issues

## Human Review Points

## Need Decision Log
Yes / No
```

---

# 11. Decision Log Requirement

以下に該当するAI作業後は、`95_Decisions` にDecision Logを残す。

```text
方針変更が発生した
複数案から1つを選んだ
重要な代替案を却下した
Roadmapに影響した
Architectureに影響した
Security / Governanceに影響した
AI出力スキーマに影響した
プロダクトの思想やUXに影響した
```

AIはDecision Logの下書きを作成してよい。
ただし、Decisionの確定文言は人間が承認する。Decision Logの詳細な書式は[`00_12_Decision_Record.md`](00_12_Decision_Record.md)を参照する。

---

# 12. Evidence Handling

AIは `90_Evidence` の資料を要約・分類してよい。

ただし、Evidenceをそのまま正本として扱ってはいけない。

```text
Evidence = 材料
Context = 解釈済みの文脈
Decision = 判断
```

AIがEvidenceから重要な示唆を抽出した場合、以下のいずれかへ昇格案を作成する。

```text
02_UX
03_IA
04_Spec
05_UI
06_Architecture
95_Decisions
99_Roadmap
```

昇格は人間レビュー後に確定する。Evidence昇格の全体フローは[`00_11_Information_Provenance.md`](00_11_Information_Provenance.md)を参照する。

## Generated Context Handling

AIが生成した要約、候補、推論、分類、再利用可能な知見は、保存された時点では以下のいずれかとして扱う。

```text
Draft
Candidate
Reviewed
Approved
Superseded
```

AIは `Draft` / `Candidate` / `Reviewed` の作成・整理・更新を支援してよい。
ただし、`Approved` への昇格、または既存の `Approved` を置き換える判断は人間が行う。

AI生成物を正本化する場合は、最低限以下を残す。

```text
source
evidence
generated_by
reviewed_by
status
known_limitations
```

根拠へ戻れないAI生成物を、仕様・判断・外部公開情報の正本として扱ってはならない。

---

# 13. AI Draft Label

AIが作成した未承認文書は、Headerに以下を記載する。

```text
Status: Draft
Owner: AI Draft
```

人間が確認し、正本として扱う場合は、以下へ変更する。

```text
Status: Approved
Owner: Human
```

または、AI支援ありの人間承認済み文書として以下を使う。

```text
Status: Approved
Owner: Shared
```

---

# 14. Prohibited AI Behavior

AIは以下を行ってはいけない。

```text
人間承認なしに重要判断を確定する
既存方針を理由なく上書きする
古い文書を削除する
Decision Logを書き換えて判断履歴を消す
Roadmap優先順位を勝手に変更する
Security方針を緩める
Governance方針を削除する
外部公開資料を勝手に確定する
テストなしに大きな実装変更を行う
関連Contextを読まずに実装する
```

---

# 15. Deletion Policy

AIは原則として文書を削除しない。

古い文書を使わなくなった場合は、以下のいずれかを使う。

```text
Deprecated
Superseded
```

## Deprecated

もう使わないが、履歴として残す。

## Superseded

後継文書に置き換えた状態。

```text
Status: Superseded
Superseded By:
- path/to/new_file.md
```

CRDDでは、過去の思想や判断の変遷も重要なContextである。

---

# 16. Safe Edit Examples

## Example 1: Develop Plan

AIが `40_Develop/Sprint_xx/01_Implementation_Plan.md` を作成する。

```text
Allowed: Yes
Level: Safe Edit
Human Review: Recommended
Decision Log: Usually not required
```

## Example 2: UX Philosophy Change

AIが `02_UX/01_Product_Philosophy.md` の思想を書き換える。

```text
Allowed: Draft only
Level: Assisted Edit
Human Review: Required
Decision Log: Required
```

## Example 3: Roadmap Priority Change

AIが `99_Roadmap` の優先順位を変更する。

```text
Allowed: Proposal only
Level: Draft
Human Review: Required
Decision Log: Required
```

## Example 4: Evidence Summary

AIが競合調査資料を要約して `90_Evidence` にIndexを作る。

```text
Allowed: Yes
Level: Safe Edit
Human Review: Recommended
Decision Log: Not required unless used for decision
```

## Example 5: Security Policy Change

AIがCloud AIへの送信範囲を変更する。

```text
Allowed: Proposal only
Level: Draft
Human Review: Required
Decision Log: Required
```

---

# 17. Human Review Checklist

AIが編集した後、人間は以下を確認する。

```text
目的に合っているか
プロダクトの思想と矛盾していないか
CRDD原則と矛盾していないか
既存文書との整合性があるか
勝手に判断を確定していないか
関連文書リンクがあるか
テストまたは検証結果があるか
Decision Logが必要ではないか
古い情報を破壊していないか
過剰に複雑化していないか
```

---

# 18. Minimum Rule

最低限、以下を守る。

```text
AIは00_CRDD、02_UX、95_Decisions、99_Roadmapを勝手に確定変更しない。
AIは実装前にPlanを出す。
AIは変更後にResultを残す。
人間は重要差分を確認する。
重要判断は95_Decisionsへ残す。
```

---

# 19. Final Principle

AIは、Context Repositoryを育てるために使う。
AIにContext Repositoryを壊させてはいけない。

CRDDにおけるAI編集の原則は、以下である。

```text
Draft by AI.
Decide by Human.
Preserve by Repository.
```
