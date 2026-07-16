# Document

Version: v0.2.0
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-16
Related:
- [00_10_Context_Repository.md](00_10_Context_Repository.md)
- [00_02_CRDD_Core_Concepts_and_Terminology.md](00_02_CRDD_Core_Concepts_and_Terminology.md)

---

# 1. Purpose

本ドキュメントは、プロダクト開発におけるMarkdown文書の可読性ルールを定義する。

CRDDでは、文書は単なる記録ではない。
文書は、人間が判断を継続し、AIが過去文脈を参照するためのContextである。

そのため、文書は以下を満たす必要がある。

```text
人間が読める
AIが読める
判断理由が追える
関連文脈へ戻れる
後から更新しやすい
```

本書は「人間とAIが誤読しない文章構造」に絞る。文書のHeader・Status・Naming・Link・廃止といったファイル管理ルールは[`00_10_Context_Repository.md`](00_10_Context_Repository.md)を参照する。

---

# 2. Basic Principle

CRDDにおける文書記述の基本原則は以下である。

```text
結論を先に書く。
背景と判断を分ける。
1文書1テーマを基本にする。
曖昧な代名詞を避ける。
関連文書へリンクする。
AIが検索しやすい見出しを使う。
```

CRDD文書は、読む人の記憶に依存しない。
文書単体でも、何について書かれているか分かる状態を目指す。

---

# 3. Human Readability

人間が読みやすい文書にするため、以下を守る。

```text
長すぎる文・長すぎる文書を避ける（分割する）
結論を先に置く
表や箇条書きを使う
背景・判断・影響を分ける
未決事項を明示する
古い情報はStatusで示す（Deprecated/Superseded）
関連文書を明示する
どれが正本か分かるようにする
```

人間が読みにくい文書は、AIにとっても扱いにくい。
CRDDでは、人間可読性をAI可読性の前提とする。

---

# 4. AI Readability

AIが読みやすい文書にするため、以下を守る。

```text
見出し名を具体的にする
主語と目的語を省略しすぎない
「これ」「それ」「あれ」だけで文脈をつながない
判断と事実を分ける
採用案と却下案を分ける
関連ファイルを明記する
重要語を毎回明示する
長文になりすぎたら分割する
```

Windows PowerShell 5.xでは、UTF-8のMarkdownを既定エンコーディングで読むと文字化けして見えることがある。
AIまたは人間がPowerShellでCRDD文書を確認する場合は、必要に応じて以下のようにUTF-8を明示する。

```powershell
Get-Content -Raw -Encoding UTF8 path/to/document.md
```

## Bad

```text
これは前に話した件。
やっぱりこっちで進める。
あとで直す。
```

## Good

```text
プロダクトの通知設定は、Settings画面内ではなく独立した画面として分離する。

理由は、通知設定は変更頻度が高く、他の設定に埋もれると発見しにくいため。
```

---

# 5. One Document, One Theme

CRDDでは、1文書1テーマを基本とする。

## Good

```text
01_Product_Philosophy.md
02_User_Pain.md
03_AI_Edit_Policy.md
2026-07-06_CRDD_Adoption.md
```

## Bad

```text
まとめ.md
いろいろ.md
設計全部.md
メモ.md
```

複数テーマが混在すると、AIが文脈を誤って結びつけやすい。
また、人間も後から判断理由を追いにくくなる。

---

# 6. Conclusion First

重要文書では、結論を先に書く。

## Bad

```text
いろいろ検討した結果、Settings内にも置けるし、独立画面にも置けるが、通知設定は変更頻度が高いので、最終的には独立画面がよさそう。
```

## Good

```text
プロダクトの通知設定は、独立した画面として配置する。

理由は、通知設定は変更頻度が高く、他の設定に埋もれると発見しにくいため。
```

AIも人間も、結論が先にある方が文脈を把握しやすい。

---

# 7. Separate Observation, Evidence, Interpretation, Decision

CRDD文書では、Observation、Evidence、Interpretation、Decisionを分ける。

## Recommended Structure

```text
# Observation

観測・確認できている内容。

# Evidence

Observationを裏付けるSourceまたは根拠。

# Interpretation

その事実から読み取れること。

# Decision

人間が決めたこと。
```

## Example

```text
# Observation

Slack、Jira、Confluenceに情報が分散している。

# Evidence

対象ProjectのSource一覧と、各Toolに存在するMessage・Ticket・Page。

# Interpretation

PMは重要な未決事項やリスクを見落としやすい。

# Decision

このプロダクトでは、分散情報をTopicとして集約し、AIが背景と次アクションを再構成する。
```

事実と判断が混ざると、後から方針変更しにくくなる。

情報の種別（Observation/Evidence/Interpretation/Proposal/Decision等）の正式な定義は[`00_02_CRDD_Core_Concepts_and_Terminology.md`](00_02_CRDD_Core_Concepts_and_Terminology.md)を参照する。

---

# 8. Separate Adopted and Rejected Ideas

採用案と却下案は分けて記録する。

```text
# Adopted

採用した案。

# Rejected

採用しなかった案。

# Why Rejected

採用しなかった理由。
```

却下理由は重要なContextである。
後から同じ議論を繰り返さないために残す。

---

# 9. Use Stable Terms

同じ概念には、同じ用語を使う。

## Recommended Terms

| Concept | Term               |
| ------- | ------------------ |
| 文脈正本    | Context Repository |
| 判断履歴    | Decision Log       |
| 根拠資料    | Evidence           |
| 外部向け資料  | PR Material        |
| 人間の判断点  | Human Decision     |
| AI作業計画  | AI Work Plan       |
| AI作業結果  | AI Work Result     |
| AIの挙動を説明する画面（設定変更はしない） | Governance / Trust画面 |

用語が揺れると、AI検索や要約の精度が落ちる。
新しい用語を導入する場合は、定義を明記する（正式なCRDD用語は[`00_02_CRDD_Core_Concepts_and_Terminology.md`](00_02_CRDD_Core_Concepts_and_Terminology.md)へ集約する）。

## Glossary

プロダクト固有の用語（ドメイン語彙）が増えてきた場合は、`03_IA`配下にGlossaryとして独立させることを推奨する。IA（情報構造）はプロダクトが扱う概念を定義する領域であり、用語集はその一部として自然に位置づく。

```text
用語数が少ない間 → 各文書内で都度定義する
用語数が増えてきた → 03_IA配下にGlossaryとして切り出す
```

---

# 10. Avoid Ambiguous References

曖昧な参照を避ける。

## Bad

```text
前の方針に従う。
```

## Good

```text
`95_Decisions/2026-07-06_CRDD_Adoption.md` で決定した方針に従う。
```

## Bad

```text
これを次にやる。
```

## Good

```text
`99_Roadmap/2026_Q3_Roadmap.md` に、Context Repository参照機能を次Sprint候補として追加する。
```

CRDDでは、文書間の明示的な接続を重視する。

---

# 11. Heading Rule

見出しは、内容が分かる名前にする。

## Good

```text
# Why Governance Is Independent Menu
# Human and AI Responsibility
# AI Change Control Boundary
# Decision Log Requirement
```

## Bad

```text
# メモ
# 概要
# その他
# 考えたこと
```

ただし、日本語見出しを使う場合も、意味が明確であれば問題ない。

## Good Japanese

```text
# Governance画面を独立メニューにする理由
# AIに任せること／人間が判断すること
# Decision Logを残す条件
```

見出しは1文書内で一貫したレベル（`#`はトップレベル節、`##`以下はその内側）を保つ。テンプレートや例をそのまま本文へ埋め込む場合は、実際の見出し構造と衝突しないよう、コードブロック内に収めるか見出しレベルを1段下げる。

---

# 12. Table Rule

比較、分類、責務整理には表を使う。

## Example

| 領域       | AIの役割       | 人間の役割     |
| -------- | ----------- | --------- |
| Roadmap  | 候補整理、依存関係整理 | 優先順位判断    |
| Develop  | 実装、テスト作成    | 差分確認、品質判断 |
| Decision | 下書き、論点整理    | 最終判断、承認   |

表は、AIにとっても構造化された情報として扱いやすい。

---

# 13. List Rule

複数の観点は箇条書きにする。

## Good

```text
AIは以下を支援する。

- 過去文脈の探索
- 情報の整理
- 仕様化
- 実装
- テスト
- 影響範囲の洗い出し
```

## Bad

```text
AIは過去文脈の探索や情報の整理や仕様化や実装やテストや影響範囲の洗い出しなどを支援する。
```

長い文章よりも、箇条書きの方がAIと人間の両方に読みやすい。

---

# 14. Do Not Over-document

CRDDは、文書を増やすことが目的ではない。

重要なのは、判断と文脈を失わないことである。

## 記録すべきもの

```text
思想
判断
理由
背景
影響
未決事項
重要な却下案
関連Evidence
```

## 記録しなくてよいもの

```text
一時的な思いつき
すぐ消える作業メモ
意味のない途中経過
判断に影響しない軽微な修正
```

文書運用が重くなりすぎると、CRDDは続かない。
最小限でも、重要判断とWhyを残すことを優先する。

---

# 15. Recommended Document Patterns

## Principle Document

```text
# Title

Version:
Status:
Owner:

# 1. Purpose

# 2. Basic Principle

# 3. Rules

# 4. Examples

# 5. Final Principle
```

## Decision Document

```text
# Decision

Version:
Status:
Owner:
Date:

# 1. Decision

# 2. Why

# 3. Context

# 4. Alternatives Considered

# 5. Consequences

# 6. Risks

# 7. Related Files

# 8. Follow-up
```

具体的な書式・記入例は[`00_12_Decision_Record.md`](00_12_Decision_Record.md)を参照する。

## Design Document

```text
# Title

Version:
Status:
Owner:

# 1. Purpose

# 2. Background

# 3. Requirements

# 4. Design

# 5. Non-goals

# 6. Risks

# 7. Related Files
```

## Develop Document

```text
# Title

Version:
Status:
Owner:

# 1. Goal

# 2. Related Context

# 3. Target Files

# 4. Implementation Plan

# 5. Verification Method

# 6. Result

# 7. Remaining Issues
```

---

# 16. Minimum Rule

最低限、以下を守る。

```text
結論を先に書く
Whyを残す
関連文書へリンクする
1文書1テーマを基本にする
事実・解釈・判断を分ける
採用案と却下案を分けて記録する
同じ概念には同じ用語を使う
```

---

# 17. Final Principle

CRDDにおける文書は、未来の人間と未来のAIへのメッセージである。

文書が読めなければ、AIは思い出せない。
文書が読めなければ、人間は判断に戻れない。
文書が読めなければ、思想は下流工程で劣化する。

だから、CRDDでは文書を読みやすく残す。

```text
Readable Documents
+
Traceable Decisions
+
Reusable Context
```
