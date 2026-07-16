# Human and AI Responsibility

Version: v0.1.0
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-12
Related:
- [00_01_CRDD_Principles.md](00_01_CRDD_Principles.md)
- [00_14_AI_Change_Control.md](00_14_AI_Change_Control.md)
- [00_31_Subagent_Practice.md](00_31_Subagent_Practice.md)（AI役割を専門Agentへ分割した具体構成）

---

# 1. Purpose

本ドキュメントは、CRDDにおける人間とAIの役割分担を定義する。

CRDDでは、AIは作業を支援する。
人間は意味づけ、判断、承認、進行制御、責任を担う。

AIを強力に使うほど、人間が何を握るべきかを明確にする必要がある。
本ドキュメントは、AIに任せる領域と、人間が必ず判断する領域の境界を定義する。

---

# 2. Basic Principle

CRDDにおける基本信条は以下である。

```text
作業をAIへ。
判断を人間へ。
思想をContext Repositoryへ。
```

AIは、人間の代替ではない。
AIは、人間がより重要な判断に集中するための補助知性である。

---

# 3. Human Value

CRDDでは、人間の価値を作業量ではなく、以下に置く。

```text
アイディア
判断
市場理解
意味づけ
優先順位
価値創出
責任
```

AIによって、実装、テスト、整理、要約、調査、仕様化の一部は大きく効率化できる。
その結果、人間はより多くの時間を、次の価値を考えることに使うべきである。

---

# 4. AI Role

CRDDにおけるAIの主な役割は以下である。

```text
思い出す
整理する
比較する
要約する
仕様化する
実装する
検証する
提案する
```

AIは、Context Repositoryを読み取り、過去の文脈、判断、設計、未決事項、Roadmapを参照しながら作業を支援する。

---

# 5. Human Role

CRDDにおける人間の主な役割は以下である。

```text
意味を与える
目的を決める
価値を判断する
優先順位を決める
採用・却下を判断する
進行を制御する
承認する
責任を持つ
```

人間は、AIが出した案をそのまま採用するのではなく、Context Repositoryに蓄積された思想・判断・根拠を踏まえて判断する。

---

# 6. Role Matrix

| 領域           | AIの役割          | 人間の役割          |
| ------------ | -------------- | -------------- |
| Idea         | メモ整理、論点抽出      | アイディアを出す、意味づける |
| Why          | 課題分解、過去文脈探索    | 本当に解くべき課題か判断する |
| UX           | 体験案、Pain整理     | 体験方針を決める       |
| IA           | 情報構造案、比較       | 情報の優先順位を決める    |
| UI           | 画面案、表示ルール案     | 使いやすさと意図を判断する  |
| Architecture | 構成案、影響範囲整理     | 採用方針、制約、責任を決める |
| Develop      | 実装、リファクタ、テスト作成 | 差分確認、品質判断      |
| Test         | テスト案、実行、結果整理   | 受入判断、リスク判断     |
| Roadmap      | 候補整理、依存関係整理    | 優先順位、やる／やらない判断 |
| Decision     | 下書き、論点整理       | 最終判断、承認        |
| PR           | 紹介文案、説明整理      | 外部に出す表現を判断する   |

---

# 7. What AI Can Do

AIに積極的に任せてよい作業は以下である。

```text
既存文書の要約
過去判断の探索
関連文書の洗い出し
論点整理
比較表の作成
仕様書の草案作成
実装計画の草案作成
コード修正
テスト作成
fixture作成
エラー原因の調査
リファクタ案の作成
PR文案作成
Decision Logの下書き
Roadmap候補の整理
```

AIは、作業の初速を上げるために使う。
ただし、AIが作ったものは人間が確認し、必要に応じてContext Repositoryへ正式反映する。

---

# 8. What AI Must Not Decide

AIが人間承認なしに決めてはいけないものは以下である。

```text
プロダクトの思想変更
CRDD原則の変更
Product Philosophyの変更
Non-goalの変更
Roadmap優先順位の確定
主要Architecture方針の確定
Security / Governance方針の確定
外部公開方針の確定
重要な機能の採用・却下
重要な仕様変更の確定
```

AIはこれらについて提案してよい。
しかし、確定判断は人間が行う。

以降の Librarian / Strategist / Developer / Reviewer は、AIが担う役割を機能面から整理したものである。これらをサブエージェントとして分離・組織化する場合の具体的な構成は[`00_31_Subagent_Practice.md`](00_31_Subagent_Practice.md)を参照する（これは推奨される実践モデルの一例であり、CRDDの必須構造ではない）。

---

# 9. AI as Librarian

AIは、Context Repositoryの司書として振る舞う。

## AI Librarianの役割

```text
過去の文書を探す
関連するDecisionを探す
矛盾する記述を見つける
未決事項を抽出する
古い情報と新しい情報の関係を整理する
根拠資料を見つける
```

AI Librarianは、判断を下すのではなく、判断材料を取り出す。

---

# 10. AI as Strategist

AIは、戦略補助者として振る舞うことができる。

## AI Strategistの役割

```text
商品性の仮説を出す
Roadmap案を出す
差別化要素を整理する
ユーザー価値を比較する
競合との差分を整理する
機能優先順位の案を出す
```

ただし、AI Strategistは最終戦略を決めない。
戦略の採用・却下・優先順位は人間が判断する。

---

# 11. AI as Developer

AIは、開発補助者として振る舞う。

## AI Developerの役割

```text
実装する
テストを書く
不具合原因を調査する
既存コードを読む
影響範囲を整理する
リファクタする
差分を説明する
```

AI Developerは、実装前にPlanを出す。
AI Developerは、実装後に検証結果を残す。
AI Developerは、思想やRoadmapを勝手に変更しない。

---

# 12. AI as Reviewer

AIは、レビュー補助者として振る舞う。

## AI Reviewerの役割

```text
差分を説明する
仕様との不一致を指摘する
テスト不足を指摘する
破壊的変更を探す
命名や構造の違和感を指摘する
ドキュメント更新漏れを指摘する
```

AI Reviewerの指摘は判断材料である。
最終的なレビュー判断は人間が行う。

---

# 13. Human as Owner

CRDDでは、人間がOwnerである。

人間は以下を担う。

```text
プロダクトの意味を決める
CRDDの思想を守る
何を作るか決める
何を作らないか決める
優先順位を決める
AIの提案を採用するか判断する
リリース可否を判断する
外部へ出す表現を決める
```

AIがどれだけ実装を支援しても、プロダクトの方向性は人間が持つ。

---

# 14. Human Review Points

AI作業後に、人間が確認すべき観点は以下である。

```text
プロダクトの思想と矛盾していないか
CRDD原則を壊していないか
既存設計と整合しているか
過剰に複雑化していないか
受入条件を満たしているか
テストまたは検証結果があるか
関連ドキュメントが更新されているか
Decision Logが必要ではないか
Roadmapへの影響がないか
```

---

# 15. Escalation Rule

以下に該当する場合、AI作業を止めて人間判断へ戻す。

```text
思想に関わる変更が発生した
既存方針と矛盾する案が出た
Roadmap優先順位に影響する
Security / Governanceに影響する
DBやAI出力スキーマに大きな変更がある
既存データの互換性が崩れる
UI責務が変わる
ユーザー体験の前提が変わる
```

AIは、判断が必要な状態を検出したら、勝手に進めず、論点を整理して人間へ戻す。

---

# 16. Proposal and Approval

AIは提案できる。
人間が承認する。

## Flow

```text
AI Proposal
↓
Human Review
↓
Human Decision
↓
Context Repository Update
↓
Implementation
```

重要な判断では、`95_Decisions` にDecision Logを残す。

## AI-Generated Context

AIは、議事録、要約、仕様候補、設計候補、テスト観点、再利用可能な知見を生成できる。
ただし、それらは生成された時点では正本ではない。

AIが生成した情報をContext Repository上の正式な文脈として扱うには、人間が以下を確認する。

```text
既存の思想・判断・仕様と矛盾していないか
根拠または出典へ戻れるか
未確定情報を確定情報として表現していないか
採用・却下・保留の状態が明確か
ユーザーや後続AIが誤読しない粒度になっているか
```

AIは候補を作る。
人間は候補へ意味を与え、採用するか判断する。

---

# 17. Human-in-the-loop

CRDDでは、Human-in-the-loopを前提とする。

AIが行う作業は増えてよい。
ただし、以下のLoopを維持する。

```text
AIが整理する
↓
人間が判断する
↓
AIが実行する
↓
人間が確認する
↓
Context Repositoryへ戻す
```

このLoopにより、AIによる効率化と、人間による進行制御を両立する。

---

# 18. Anti-patterns

CRDDで避けるべきアンチパターンは以下である。

## AI丸投げ

```text
AIに全部任せて、人間が判断しない。
```

問題：思想が劣化し、責任境界が曖昧になる。

## ドキュメント放置

```text
実装だけ進み、Context Repositoryが更新されない。
```

問題：次にAIや人間が文脈を追えなくなる。

## タスク管理ツール正本化

```text
JiraやRedmineのチケットだけが最新情報になる。
```

問題：Whyや判断経緯が失われる。

## AI出力の無検証採用

```text
AIが出した案をそのまま採用する。
```

問題：仕様・思想・制約とのズレを見落とす。

## 上流思想の未記録

```text
なぜ作るのかを残さず、仕様と実装だけ残る。
```

問題：下流工程で思想が劣化する。

---

# 19. Minimum Rule

まずは以下だけ守ればよい。

```text
AIは作業前に関連Contextを読む
AIは実装前にPlanを出す
AIは重要判断を確定しない
人間はAIの差分を確認する
重要判断は95_Decisionsへ残す
思想変更は02_UXへ反映する
```

---

# 20. Final Principle

AIは作業を速くする。
Context Repositoryは思想を残す。
人間は判断を担う。

CRDDでは、この三者を分離し、接続する。

```text
AI = Work Acceleration
Context Repository = Thought Continuity
Human = Meaning and Decision
```

CRDDを採用するプロダクトは、この構造を実装し、人間がアイディアと判断に集中できる状態を目指す。
