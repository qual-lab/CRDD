# Decision Record

Version: v0.1.0
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-15
Related:
- [00_11_Information_Provenance.md](00_11_Information_Provenance.md)
- [00_14_AI_Change_Control.md](00_14_AI_Change_Control.md)
- `95_Decisions/`

---

# 1. Purpose

本ドキュメントは、プロダクト開発における Decision Log の記録ルールを定義する。

CRDDでは、判断履歴は単なる議事録ではない。
判断履歴は、プロジェクトの思想、方針、優先順位、設計意図を未来へ継承するための重要なContextである。

AIと人間が後から判断経緯をたどれるように、重要な判断は `95_Decisions` に記録する。

---

# 2. Basic Principle

Decision Logの基本原則は以下である。

```text
結論だけでなく、理由を残す。
理由だけでなく、背景を残す。
採用案だけでなく、却下案も残す。
変更後だけでなく、変更前の前提も残す。
```

CRDDでは、判断の結果だけでは不十分である。
なぜその判断に至ったかを残すことで、AIと人間が後から原点に戻れるようにする。

---

# 3. Why Decision Log Matters

通常の開発では、時間が経つほど以下が失われやすい。

```text
なぜこの機能を作るのか
なぜこのUIにしたのか
なぜこの設計を採用したのか
なぜ別案を捨てたのか
なぜ優先順位を変えたのか
なぜ今は対応しないのか
```

これらが失われると、下流工程で思想が劣化する。
また、AIが過去文脈を参照しても、結論だけでは正しい支援ができない。

Decision Logは、以下を防ぐために存在する。

```text
思想の劣化
判断理由の消失
同じ議論の繰り返し
方針変更の経緯不明
AIによる誤った文脈解釈
属人的な記憶への依存
```

---

# 4. Storage Location

Decision Logは、原則として以下に保存する。

```text
95_Decisions/
```

ファイル名は、日付と判断内容が分かる形式にする。

## Naming Rule

```text
yyyy-mm-dd_short_decision_title.md
```

## Example

```text
95_Decisions/
├─ 2026-07-06_CRDD_Adoption.md
├─ 2026-07-06_Context_Repository_As_Core.md
├─ 2026-07-06_Product_As_CRDD_Platform.md
└─ 2026-07-10_Notification_Screen_Position.md
```

ファイル名は英語ベースを基本とする。
本文は日本語でよい。

---

# 5. When to Write Decision Log

以下に該当する場合、Decision Logを残す。

```text
プロダクトの思想に関わる判断
CRDD原則に関わる判断
UX方針の変更
IA構造の変更
機能仕様・状態・受け入れ条件の変更
主要UI責務の変更
Architecture方針の変更
DBスキーマの変更
AI出力スキーマの変更
Security / Governance方針の変更
Roadmap優先順位の変更
採用しなかった案が重要な場合
一度決めた方針を撤回する場合
外部公開方針に関わる判断
```

---

# 6. When Decision Log Is Not Required

以下は、通常Decision Logを必須としない。

```text
誤字修正
表記ゆれ修正
軽微な文書整理
小さなUI文言修正
実装上の軽微なバグ修正
テスト追加のみ
内部コメント整理
一時的な作業メモ
```

ただし、軽微に見える変更でも、思想・設計・Roadmap・Security・Governanceに影響する場合はDecision Logを残す。

---

# 7. Decision Log Template

Decision Logは、以下の形式を基本とする。テンプレート内の見出しは、本書自体の見出し構造と衝突しないよう、コードブロック内で1段下げた見出しレベル（`##`始まり）にしている。

```text
# Decision

Version: 0.1
Status: Approved
Owner: Human
Date: yyyy-mm-dd

---

## 1. Decision

### 決定内容

---

## 2. Why

### なぜこの判断をしたか

---

## 3. Context

### 判断時点の背景・前提

---

## 4. Alternatives Considered

### 検討した代替案

---

## 5. Consequences

### この判断により発生する影響

---

## 6. Risks

### 残るリスク・注意点

---

## 7. Related Files

### 関連文書

---

## 8. Follow-up

### 後続対応
```

---

# 8. Required Items

Decision Logには、最低限以下を含める。

| Item          | Required    | Purpose   |
| ------------- | ----------- | --------- |
| Date          | Yes         | いつ判断したか   |
| Decision      | Yes         | 何を決めたか    |
| Why           | Yes         | なぜ決めたか    |
| Context       | Yes         | 判断時点の背景   |
| Alternatives  | Recommended | 他に何を検討したか |
| Consequences  | Recommended | 影響        |
| Risks         | Recommended | 残るリスク     |
| Related Files | Yes         | 関連Context |
| Follow-up     | Optional    | 後続対応      |

---

# 9. Decision Status

Decision LogにはStatusを付ける。

| Status       | Meaning              |
| ------------ | -------------------- |
| `Draft`      | AIまたは人間による草案。未確定     |
| `Proposed`   | 判断案。まだ承認前            |
| `Approved`   | 確定判断                 |
| `Superseded` | 後続判断に置き換え済み          |
| `Deprecated` | 判断としては現在使わないが履歴として保持 |

---

# 10. AI Draft Handling

AIはDecision Logの下書きを作成してよい。

ただし、AIが作成したDecision Logは、承認されるまで以下の状態とする。

```text
Status: Draft
Owner: AI Draft
```

人間が確認し、判断として確定する場合は以下へ変更する。

```text
Status: Approved
Owner: Human
```

AI支援ありで人間が承認した場合は、以下でもよい。

```text
Status: Approved
Owner: Shared
```

AIは判断の下書きを作れる。
しかし、判断を確定するのは人間である。

---

# 11. Decision Scope

Decision Logは、判断の粒度を意識して作成する。

## 小さすぎる例

```text
ボタン文言を「OK」から「保存」にした。
```

通常はDecision Log不要。

## 適切な例

```text
プロダクトの通知設定は、Settings画面内ではなく独立した画面として分離する。
```

理由：画面責務、ユーザー理解、情報設計に影響するため。

## 大きすぎる例

```text
プロダクトの全体方針を決めた。
```

範囲が広すぎるため、以下のように分割する。

```text
CRDDをプロダクトの開発思想として採用する
Context Repositoryをプロダクトの中核にする
AIと人間の役割を分離する
既存タスク管理ツールをViewとして扱う
```

---

# 12. Alternatives Rule

重要判断では、採用しなかった案も残す。

## Why

採用しなかった理由は、後から同じ議論を繰り返さないための重要なContextである。

## Example

```text
## Alternatives Considered

### Option A: 通知設定をSettings画面内に置く

Pros:
- 他の設定と近く、実装上は自然

Cons:
- 通知設定は変更頻度が高く、他の設定に埋もれると発見しにくい
- ユーザーが能動的に確認しにくい

Decision:
採用しない。
```

---

# 13. Consequences Rule

Decision Logには、判断によって発生する影響を残す。

## Include

```text
変更される文書
変更される画面
実装への影響
Roadmapへの影響
ユーザー体験への影響
Security / Governanceへの影響
後続で必要な検証
```

判断は、結論だけではなく、影響まで含めてContextになる。

---

# 14. Related Files Rule

Decision Logには、必ず関連文書をリンクする。

## Example

```text
## 7. Related Files

- [CRDD Principles](../00_CRDD/00_01_CRDD_Principles.md)
- Product Origin: ../02_UX/00_Product_Origin.md
- Governance Spec: ../04_Spec/04_XX_Governance.md
- Governance UI: ../05_UI/05_XX_Governance.md
- ISMS AI Governance: ../06_Architecture/06_XX_ISMS_AI_Governance.md
```

関連文書がないDecision Logは、AIが文脈をたどりにくい。

---

# 15. Supersede Rule

過去の判断を置き換える場合、古いDecision Logは削除しない。

古いDecision LogのStatusを以下に変更する。

```text
Status: Superseded
```

そして、後継Decisionへのリンクを記載する。

```text
Superseded By:
- New Decision: 2026-xx-xx_new_decision.md
```

新しいDecision Log側にも、置き換え元を記載する。

```text
Supersedes:
- Old Decision: 2026-xx-xx_old_decision.md
```

CRDDでは、判断の変遷も重要なContextである。

---

# 16. Decision Log and Roadmap

Roadmap優先順位に影響する判断は、Decision Logを残す。

## Examples

```text
ある機能を次Sprintへ入れる
ある機能を後回しにする
ある機能をRoadmapから外す
技術的前提が変わり、順序を入れ替える
市場・ユーザー価値の観点で優先度を変更する
```

Roadmap変更は、`99_Roadmap` の更新だけでなく、必要に応じて `95_Decisions` に理由を残す。

---

# 17. Decision Log and Evidence

Evidenceを根拠に判断した場合、Decision LogからEvidenceへリンクする。Evidenceの昇格ルール全体は[`00_11_Information_Provenance.md`](00_11_Information_Provenance.md)を参照する。

## Example

```text
## 7. Related Files

- Competitor Research: ../90_Evidence/Competitors/2026-07-xx_competitor_research.md
- User Pain: ../90_Evidence/User_Voices/2026-07-xx_user_pain.md
```

Evidenceは材料であり、Decision Logは判断である。

```text
Evidence = 材料
Decision = 判断
Context = 判断可能な文脈
```

---

# 18. Decision Log and AI

AIはDecision Logを以下の用途で参照する。

```text
過去の判断理由を探す
現方針と矛盾する提案を避ける
Roadmap変更の背景を理解する
設計意図を理解する
却下済みの案を再提案しない
仕様変更時の影響を推定する
```

そのため、Decision LogはAIが読みやすい構造にする。

## AI Readability Rules

```text
結論を先に書く
Whyを明確にする
代替案を分けて書く
関連ファイルをリンクする
曖昧な代名詞を避ける
日付を明記する
Statusを明記する
```

---

# 19. Decision Log Example

```text
# Decision

Version: 0.1
Status: Approved
Owner: Human
Date: 2026-07-06

---

## 1. Decision

このプロダクトは、CRDD（Context Repository-Driven Development）を中核思想として採用する。

---

## 2. Why

AIによって実装やテストなどの下流工程は大きく効率化できる。
一方で、人間の根本的な価値は、アイディア、市場理解、意味づけ、重要判断にある。

このプロダクトは、人間のアイディアと判断を劣化させず、Context Repositoryへ蓄積し、AIがその文脈を参照しながら整理・提案・実装支援を行う構造を目指す。

---

## 3. Context

このプロダクトの開発では、Git上にUX、IA、UI、Architecture、Develop、Roadmapの文書が蓄積されている。
今後はこれらを単なる設計資料ではなく、AIと人間が参照するContext Repositoryとして扱う。

---

## 4. Alternatives Considered

### Option A: AI駆動開発として実装効率化を中心に扱う

Pros:
- 分かりやすい
- 実装速度向上を説明しやすい

Cons:
- プロダクトの思想である「人間の判断を支援する」観点が弱くなる
- 上流思想や判断履歴の継承が中心に置かれない

Decision:
採用しない。

---

## 5. Consequences

- `00_CRDD` を新設する
- `02_UX` をプロダクトの思想正本として扱う
- `95_Decisions` を判断履歴の置き場とする
- 既存タスク管理ツールはViewとして扱う
- AI編集ルールを整備する

---

## 6. Risks

- 文書運用が重くなりすぎる可能性がある
- Decision Logが形骸化する可能性がある
- AIに読ませる文脈が増えすぎる可能性がある

---

## 7. Related Files

- [CRDD Principles](../00_CRDD/00_01_CRDD_Principles.md)
- Product Origin: ../02_UX/00_Product_Origin.md
- Roadmap README: ../99_Roadmap/README.md

---

## 8. Follow-up

- `00_CRDD` 配下の運用ルールを整備する
- プロダクト本体にContext Repository参照機能を導入する
```

---

# 20. Minimum Rule

最小運用として、以下だけは守る。

```text
重要判断は95_Decisionsへ残す
結論だけでなくWhyを残す
関連文書リンクを残す
過去判断は削除せずSupersededにする
AI Draftは人間承認まで確定扱いしない
```

---

# 21. Final Principle

Decision Logは、判断の墓場ではない。
Decision Logは、未来の判断を支えるためのContextである。

CRDDでは、判断を記録することで、人間のアイディアと判断を未来へ継承する。
