# CRDD Principles

Version: v0.1.0
Status: Stable
Owner: Human
Last Updated: 2026-07-12
Related:
- [00_00_CRDD_Overview.md](00_00_CRDD_Overview.md)
- [00_13_Human_AI_Responsibility.md](00_13_Human_AI_Responsibility.md)

---

# 1. CRDDとは

CRDD（Context Repository-Driven Development）は、製品やプロジェクトのWhy、アイディア、判断、課題、リスク、設計思想を、人間とAIが読み取れるContext Repositoryとして蓄積し、AIがその文脈を参照しながら仕様化・実装・テスト・整理を支援する開発手法である。

CRDDの目的は、開発速度を上げることだけではない。

CRDDの目的は、人間のアイディアと判断を劣化させずに継承し、AIによって下流工程を効率化することで、人間が市場理解、次のアイディア、重要判断、価値創出に集中できる状態を作ることである。

---

# 2. 基本信条

```text
作業をAIへ。
判断を人間へ。
思想をContext Repositoryへ。
```

AIは作業を支援する。
人間は意味を与え、判断し、責任を持つ。
Context Repositoryは、その思想と判断を劣化させずに残す。

---

# 3. なぜCRDDが必要か

AIによって、実装、テスト、整理、要約、調査、仕様化の一部は大きく効率化できる。

しかし、人間の根本的な価値は、作業量ではなく、以下にある。

```text
アイディア
判断
市場理解
意味づけ
優先順位
価値創出
```

AI時代に重要なのは、人間がこれらに集中できるようにすることである。

そのためには、単にAIにコードを書かせるだけでは足りない。
AIが参照できる上流思想、判断経緯、課題、リスク、思いを、人間にもAIにも読みやすい形で蓄積する必要がある。

---

# 4. CRDDが守るもの

CRDDは、以下を守る。

| 守るもの  | 内容                |
| ----- | ----------------- |
| 原点    | なぜ作り始めたのか         |
| 思想    | 何を大切にするのか         |
| 判断    | なぜその方針にしたのか       |
| 連続性   | 時間が経っても文脈を失わないこと  |
| 人間の価値 | アイディアと判断を劣化させないこと |

---

# 5. Context Repositoryとは

Context Repositoryは、単なるドキュメント置き場ではない。

Context Repositoryは、プロジェクトの記憶であり、製品思想の正本であり、判断経緯のタイムラインであり、AIが参照する戦略コンテキストである。

Context Repositoryには、以下を蓄積する。

```text
Why
困りごと
課題
リスク
思い
仮説
顧客価値
差別化
判断経緯
変えた理由
変えなかった理由
仕様
設計
タスク
検証結果
Evidence
Roadmap
```

---

# 6. CRDDにおけるAIの役割

CRDDにおけるAIは、プロジェクトを勝手に進める主体ではない。

AIは、人間の判断を補助するために、以下を行う。

```text
過去文脈を探す
時系列をたどる
情報を整理する
論点を抽出する
仕様化を支援する
実装を支援する
テストを支援する
差分を説明する
矛盾や抜けを指摘する
ロードマップ案を出す
判断材料を提示する
```

AIは提案できる。
AIは草案を作れる。
AIは実装できる。
しかし、AIは最終判断者ではない。

---

# 7. CRDDにおける人間の役割

CRDDにおける人間は、以下を担う。

```text
意味づけ
価値判断
優先順位
方針決定
承認
進行制御
責任
```

人間は、AIの出力をそのまま採用するのではなく、Context Repositoryに蓄積された思想・判断・根拠を踏まえて判断する。

人間は、AIに任せる作業と、任せてはいけない判断を分ける。

---

# 8. AIに破壊させない

CRDDでは、AIに開発を加速させる一方で、AIにプロジェクトの思想や判断を破壊させない。

そのために、以下を原則とする。

```text
AIは実装前にPlanを出す
AIは関連Contextを読んでから作業する
重要ドキュメントは人間レビューなしに確定変更しない
思想・判断・Roadmapの変更は人間が承認する
AIが変更した内容は差分で確認する
検証できない変更は小さく分割する
```

特に、以下は人間承認なしに確定変更しない。

```text
00_CRDD
02_UX
95_Decisions
99_Roadmap
```

AIはこれらの草案を作成してよい。
ただし、確定するのは人間である。

---

# 9. Tools as Views

CRDDでは、既存のタスク管理ツールを正本とは扱わない。

Jira、Redmine、GitHub Issues、Backlogなどは、進行状況を見るためのViewである。

```text
Context Repository = Why / 判断 / 設計 / 仕様の正本
Task Management Tool = 進行状況のView
```

タスク管理ツールには、Context Repository上の関連文書へのリンクを持たせる。
タスクだけを見ても、なぜその作業が必要なのか分からない状態を避ける。

---

# 10. Docs are not enough

CRDDは、ただドキュメントを増やす手法ではない。

重要なのは、AIと人間が使える形で文脈を残すことである。

悪い例。

```text
使いやすくする。
AIで便利にする。
情報を整理する。
```

良い例。

```text
Problem:
Slack、Jira、Confluenceに情報が分散し、PMが重要な未決事項やリスクを見落としやすい。

Pain:
情報を探す時間が長く、判断に使う時間が削られている。

Product Principle:
AIは情報を理解・整理・提案し、人間は判断する。

UX Direction:
Inboxを中心に、確認すべきTopic、背景、次アクションを一画面で把握できるようにする。

Differentiation:
単なるタスク管理ではなく、判断に必要な文脈を再構成する。
```

CRDDでは、思想をポエムで終わらせず、AIが検索・比較・要約・提案できる構造にする。

---

# 11. Upstream First

CRDDでは、下流工程より前に、上流思想を重視する。

実装やテストはAIで大きく効率化できる。
しかし、何を作るべきか、なぜ作るのか、何を捨てるのかは、人間が考える必要がある。

CRDDでは、以下を先に残す。

```text
Why
Problem
Pain
Target User
Value
Principle
Non-goal
Risk
Decision Point
```

その後に、仕様、設計、実装、テストへ進む。

---

# 12. Development Loop

CRDDの基本ループは以下である。

```text
Idea / Why
↓
Context化
↓
UX / Strategy
↓
IA / UI / Architecture
↓
Roadmap化
↓
Develop
↓
Verify
↓
Decision更新
↓
Context Repositoryへ還元
```

開発で得た学びは、必ずContext Repositoryへ戻す。

CRDDでは、作って終わりではない。
作った結果、判断がどう変わったか、次に何を考えるべきかを残す。

---

# 13. Definition of Done

CRDDでは、コードが動いたら完了ではない。

完了とは、以下が満たされた状態である。

```text
Working Software
+
Readable Context
+
Traceable Decision
```

つまり、以下を満たす必要がある。

```text
実装が動く
検証されている
思想と矛盾していない
判断理由が残っている
次にAIや人間が読み返せる
```

このDefinition of Doneを、CRDDへの準拠条件として満たすべき最低要件へ具体化したものは[`00_03_CRDD_Conformance.md`](00_03_CRDD_Conformance.md)を参照する。

---

# 14. CRDDの一文定義

CRDDは、プロジェクトのWhyを失わないためのAI時代の開発手法である。

もう少し詳細に言えば、CRDDは、人間のアイディアと判断をContext Repositoryに蓄積し、AIがその文脈を参照して下流工程を支援することで、人間が市場理解、次のアイディア、重要判断に集中できるようにする開発思想である。
