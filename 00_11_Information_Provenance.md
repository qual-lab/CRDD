# Information Type and Provenance

Version: v0.1.0
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-15
Related:
- [00_10_Context_Repository.md](00_10_Context_Repository.md)
- [00_12_Decision_Record.md](00_12_Decision_Record.md)
- [00_02_CRDD_Core_Concepts_and_Terminology.md](00_02_CRDD_Core_Concepts_and_Terminology.md)

---

# 1. Purpose

本ドキュメントは、Context Repositoryに蓄積される情報の「種別（Type）」と「由来（Provenance）」の扱いを定義する。

CRDDは「Contextを保存する方法論」である。何を事実として扱い、何をAIの解釈として扱い、何を人間の決定として扱うかという情報種別の区別と、それらがどう昇格していくかというライフサイクルが、方法論の核心に近い。

各種別の正式な定義は[`00_02_CRDD_Core_Concepts_and_Terminology.md`](00_02_CRDD_Core_Concepts_and_Terminology.md)を参照する。本書はその運用ルールを扱う。

---

# 2. Document Type

Context Repository内の文書は、役割を明確にする。

| Type         | Purpose                       | Example Folder             |
| ------------ | ----------------------------- | --------------------------- |
| Principle    | 原則・思想                         | `00_CRDD`, `02_UX`         |
| Context      | 課題・背景・Why                     | `02_UX`, `90_Evidence`     |
| Design       | UX / IA / UI / Architecture設計 | `02_UX`〜`06_Architecture`  |
| Specification | 機能の振る舞い・状態・受け入れ条件 | `04_Spec`                  |
| Decision     | 判断履歴                          | `95_Decisions`             |
| Plan         | 開発計画・Sprint計画                 | `40_Develop`, `99_Roadmap` |
| Verification | 検証結果                          | `40_Develop`               |
| Evidence     | 根拠資料                          | `90_Evidence`              |
| PR Material  | 外部向け資料                        | `80_PR`                    |

各文書は、自分がどのTypeに属するかを明確にする。

---

# 3. Evidence Promotion Rule

`90_Evidence` に置いた資料は、置いただけでは正本にならない。

Evidenceは材料であり、判断や設計に使われたときに、Contextとして昇格する。

## Promotion Flow

```text
Raw Evidence
↓
Finding
↓
Context
↓
Decision / Design / Roadmap
```

## Example

```text
90_Evidence/Competitors/xxx.md
↓
02_UX/xx_User_Pain.md
↓
95_Decisions/2026-xx-xx_feature_priority.md
↓
99_Roadmap/xx_Roadmap.md
```

## Rule

Evidenceを参照して重要判断を行った場合、必ず以下のいずれかに反映する。

```text
02_UX
03_IA
04_Spec
05_UI
06_Architecture
95_Decisions
99_Roadmap
```

Evidenceは「資料の墓場」にしない。
重要な示唆は、必ずContextへ昇格する。

---

# 4. Evidence Reference Rule

Evidenceを使う場合は、必ず出典または元資料を明示する。

```text
# Evidence

- Competitor Research: ../90_Evidence/Competitors/2026-07-xx_competitor_research.md
- User Pain: ../90_Evidence/User_Voices/2026-07-xx_user_pain.md
```

Evidenceを根拠に判断した場合は、`95_Decisions` からEvidenceへリンクする。

Evidenceは材料であり、Decisionは判断である。

```text
Evidence = 材料
Decision = 判断
Context = 判断可能な文脈
```

---

# 5. Roadmap Absorption Rule

Roadmapは予定・優先順位・将来構想を扱う。
完了した項目は、Roadmapに詳細を残し続けず、以下へ吸収する。

| Completed Content | Absorb Into |
|---|---|
| 体験価値・ユーザー判断 | `02_UX` |
| 情報構造・画面責務 | `03_IA` |
| 機能の振る舞い・状態・例外 | `04_Spec` |
| 表示・操作・文言 | `05_UI` |
| DB・API・IPC・AI・Security | `06_Architecture` |
| 開発・検証・Release手順 | `07_Workflows` |
| 重要な判断理由 | `95_Decisions` |
| 検証・Smoke Test・Release結果 | `90_Release` / `90_Evidence` |

完了済みRoadmap文書は、吸収先が明確であれば削除してよい。
ただし、判断履歴そのものは削除せず、必要に応じて `95_Decisions` に残す。

---

# 6. Feature Adoption Rule

Roadmap上の構想やAIが整理した候補は、そのまま実装正本にはならない。

ユーザーに見える新しい概念、画面、状態、用語、AI出力を実装する場合は、実装前または実装と同時に、最低限以下へ昇格する。

| Content | Promote Into |
|---|---|
| 何を提供するか、どう振る舞うか | `04_Spec` |
| ユーザーにどう見えるか、どう操作するか | `05_UI` |
| どう実現するか、どのデータ・API・AI経路を使うか | `06_Architecture` |
| なぜ採用したか、重要な代替案をなぜ捨てたか | `95_Decisions` |

特に、AIが生成・抽出・提案する情報をプロダクト上の再利用可能な概念として扱う場合は、以下を明示する。

```text
何を候補として扱うのか
いつ正本または採用済みになるのか
誰が採用・却下を判断するのか
根拠・出典・制限事項をどこに保持するのか
ユーザーが誤って確定情報と受け取らない表示になっているか
```

AI生成物は、承認されるまでは候補である。
候補を仕様・UI・DB・外部公開情報へ昇格する判断は、人間が行う。

---

# 7. Minimum Rule

最低限、以下を守る。

```text
各文書がどのDocument Typeに属するか明確にする
Evidenceを根拠にした判断は、必ずいずれかのフォルダへ昇格させる
Evidenceを引用する場合は出典をリンクする
完了したRoadmap項目は吸収先を明示してから削除する
AI生成物をユーザー向け確定情報として扱う前に、昇格の判断者・根拠・既知の制限を明示する
```

---

# 8. Final Principle

情報は、種別と由来（どこから来て、誰が確認し、どこへ昇格したか）が分からなくなった瞬間に、Contextではなくただのデータになる。

CRDDでは、情報の種別と由来を明示し続けることで、Context Repositoryを判断可能な状態に保つ。
