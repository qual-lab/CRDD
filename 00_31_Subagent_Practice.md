# Subagent Practice

Version: v0.3.0
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-16
Related:
- [00_01_CRDD_Principles.md](00_01_CRDD_Principles.md)
- [00_13_Human_AI_Responsibility.md](00_13_Human_AI_Responsibility.md)
- [00_14_AI_Change_Control.md](00_14_AI_Change_Control.md)
- [00_12_Decision_Rationale.md](00_12_Decision_Rationale.md)
- [00_50_Subagent_Orchestration.md](00_50_Subagent_Orchestration.md)
- [00_51_Document_Audit_Agent.md](00_51_Document_Audit_Agent.md)

---

> このドキュメントはPractice Guide（推奨知見）である。ここで示すサブエージェント構成は、CRDDを実践する上での参考モデルの一つであり、CRDDの必須構造ではない。単一のAIセッションのみで、専門Agentへ分割せずにCRDDを実践することもできる。

---

# 1. Purpose

本ドキュメントは、CRDD（Context Repository-Driven Development）を複数の専門AI Agentへ分割して運用する場合の、参考構成モデルを定義する。

CRDDは「AIを増やすこと」を目的としない。

目的は、人間が考えるべきことへ集中できるよう、AIを専門家チームとして組織化することである。

---

# 2. CRDDの基本思想

AIは最終判断を行わない。

AIは、

```text
理解する
整理する
比較する
提案する
```

ことを担当する。

最終判断・優先順位・責任は人間が持つ。

---

# 3. サブエージェントを導入する理由

単一AIは、

```text
UX
IA
UI
Architecture
実装
レビュー
```

を一度に考える。

小規模では問題ないが、プロジェクトが大きくなるほど

```text
Contextが肥大化する
専門視点が混在する
同じ説明を何度も行う
思考が整理しにくくなる
```

という問題が発生する。

CRDDでは専門視点ごとにAIを分離し、人間が必要な判断だけを行えるようにする。

---

# 4. 基本構成

```text
Human
    │
    ▼
Context Facilitator
    │
    ├── Design Council
    │      ├── UX View
    │      ├── IA View
    │      ├── UI View
    │      └── Architecture View
    │
    ├── Strategist
    │
    ├── Implementation Agent
    │
    ├── Conformance Reviewer
    │
    └── CRDD Document Audit Agent
```

Design CouncilとStrategistは、見ている粒度が異なる。

```text
Design Council = 「今回の変更」が専門的に妥当かを見る
Strategist     = 「複数の変更・優先順位」をRoadmap起点で見る
```

そのため、StrategistはDesign Councilの5番目のViewにはせず、Context Facilitator直下の並列Agentとして独立させる。

---

# 5. Context Facilitator

## 役割

Context Facilitatorは、人間との唯一の対話窓口となる。

目的は、曖昧なアイデアや違和感を、

```text
問題
仮説
論点
判断事項
```

へ整理することである。

Context Facilitator自身が最終設計を決めることはない。

必要に応じて専門エージェントへ相談し、その結果を整理して人間へ返す。

## 主な責務

```text
人間との対話
Context整理
専門Agentの呼び出し
専門Agentの結果統合
判断材料の提示
```

## Design Council内の対立を扱う方法

Design Councilの複数Viewが異なる結論を出した場合（例: UX Viewは採用したいが、Architecture Viewはセキュリティ上非推奨、など）、Context Facilitatorは以下に従う。

```text
Context Facilitatorは対立を仲裁・判断しない
Context Facilitatorは対立を Option 比較表へ構造化するだけに留める
```

構造化には `00_12_Decision_Rationale.md` の「Alternatives」形式を流用する。

```text
### Option A: ◯◯

Pros:
- View名: 賛成理由

Cons:
- View名: 懸念点

### Option B: ◯◯

Pros:
- View名: 賛成理由

Cons:
- View名: 懸念点
```

Facilitatorは、Viewの間で見解が一致している点（合意事項）と、人間の判断が必要な一点（トレードオフの核）を分けて提示する。これにより、対立の生データをそのまま人間へ投げることを避け、認知負荷を下げつつ最終判断は人間に残す。

---

# 6. Design Council

Design Councilは専門家チームである。

各Agentは自分の専門視点のみを担当する。

## UX View

見るもの

```text
UX原則
ユーザー体験
認知負荷
```

考えること

```text
分かりやすいか
判断しやすいか
プロダクトの理念に合うか
```

## IA View

見るもの

```text
情報構造
画面責務
Navigation
```

考えること

```text
責務は適切か
他画面との役割は重複していないか
```

## UI View

見るもの

```text
Component
Layout
Visual
```

考えること

```text
どこへ配置するか
状態は十分か
既存UIと整合するか
```

## Architecture View

見るもの

```text
Architecture
API
IPC
Data構造
```

考えること

```text
境界は適切か
将来拡張できるか
Securityに問題はないか
```

---

# 7. Strategist

Strategistは、単一の変更の妥当性ではなく、複数の変更・機能候補をRoadmap起点で比較する役割を担う。

見るもの

```text
99_Roadmap
複数の機能候補
市場・ユーザー価値
差別化要素
```

考えること

```text
優先順位はどうあるべきか
今やるべきか、後回しにすべきか
他の候補と比べて価値が高いか
```

Strategistは`00_13_Human_AI_Responsibility.md`の「AI as Strategist」に対応する。Design Councilとは異なり、特定の変更のレビュー依頼では起動せず、Roadmap優先順位の検討時にContext Facilitatorから起動される。

Strategist自身がRoadmap優先順位を確定することはない。あくまで判断材料と選択肢の整理までを担当する。

---

# 8. Implementation Agent

Implementation Agentは設計済み内容を実装する。

担当は

```text
Code
Test
Build
```

である。

新しい仕様を勝手に追加しない。

設計不足を発見した場合はContext Facilitatorへ戻す。

---

# 9. Conformance Reviewer

Conformance Reviewerは、コードレビューではなく、Contextと実装の整合を確認する。

確認対象

```text
UX
IA
UI
Architecture
Code
Test
```

を見る。

重要なのは、「コードが正しいか」ではなく、「Contextどおりに実装されているか」である。

---

# 10. CRDD Document Audit Agent

CRDD Document Audit Agentは、実装差分ではなく、Context Repositoryの文書体系そのものを監査する。

確認対象

```text
文書構造
参照整合性
用語
規範語彙
水平展開
採番・識別子
Traceability
Status / Version
README / Overview / CHANGELOG追従
```

を見る。

重要なのは、「実装がContextどおりか」ではなく、「Context Repository自体がCRDD Standardどおりに保たれているか」である。

CRDD Document Audit AgentはFindingを返す。
Canonical Artifactを直接編集せず、Parent AgentがFindingを統合し、人間確認が必要なものを切り分ける。

詳細なInput / Output Contractと監査カテゴリは[`00_51_Document_Audit_Agent.md`](00_51_Document_Audit_Agent.md)を参照する。

---

# 11. 人間の役割

人間は、

```text
アイデアを出す
AIの提案を見る
最終判断する
```

ことを担当する。

AIが勝手に仕様を決定しない。

---

# 12. 基本フロー

```text
Human
    │
    ▼
Context Facilitator
    │
    ▼
Design Council / Strategist
    │
    ▼
Context Facilitator（Option比較表への構造化）
    │
    ▼
Human Decision
    │
    ▼
Implementation Agent
    │
    ▼
Conformance Reviewer
```

文書体系そのものの監査が必要な場合は、Conformance Reviewerとは別にCRDD Document Audit Agentを起動する。

```text
Context Facilitator
    │
    ▼
CRDD Document Audit Agent
    │
    ▼
Audit Report
    │
    ▼
Context Facilitator（Finding統合）
    │
    ▼
Human Review / Parent Agent Fix
```

---

# 13. 発動条件

この構成は、すべての変更で毎回起動するものではない。

```text
軽微な変更（誤字修正、表記ゆれ、小さなバグ修正）
    → 単一Agentで完結する。Context Facilitatorは起動しない

非自明な変更（Plan modeが要求される変更）
    → Context Facilitatorが起動する
```

Context Facilitatorが起動した場合も、Design Councilの4 Viewを毎回すべて呼ぶわけではない。変更が実際に触れる領域の分だけ、該当Viewを呼ぶ。

```text
UIのみに閉じた変更   → UI Viewのみ
UX・IAにまたがる変更 → UX View + IA View
Architectureに影響する変更 → Architecture Viewを追加
```

`00_CRDD` / `02_UX` / 重要判断が反映されたApproved Canonical Artifactに影響する変更は、Design Councilの構成に関わらず、必ずContext Facilitator経由で人間承認を求める（[`00_14_AI_Change_Control.md`](00_14_AI_Change_Control.md)のProtected Areasルールが優先する）。

README、Overview、CHANGELOG、Related、Status、文書採番、安定ID、Traceabilityなど、Context Repositoryの文書体系に影響する変更では、必要に応じてCRDD Document Audit Agentを起動する。

---

# 14. 実装モデルの一例

このAgent構成は、複数のAIツール（例: Claude Code、Codex CLI等）のカスタムAgent定義機能を使って具体化できる。以下は一実装例である。

```text
Claude Code: .claude/agents/*.md（frontmatterでtoolsを制限）
Codex CLI:   .codex/agents/*.toml（sandbox_mode = "read-only"で制限）

ux-view
ia-view
ui-view
architecture-view
strategist
conformance-reviewer
crdd-document-auditor
```

いずれも読み取り専用（ツール実行権限をAgent定義側で制限する）とし、所見の提示までを担当する。採用可否・実装方針の確定は行わない設計を、ツール実行権限のレベルで強制する。

呼び出しは自動発火ではなく、人間または呼び出し元Agentが明示的に指名する必要がある。

一方、以下は独立したカスタムAgent定義を作らず、メイン会話（人間と直接対話するAIセッション）が引き続き兼務することが多い。

```text
Context Facilitator
    → 人間との対話窓口そのものであり、自分自身を「呼び出す」対象ではないため
Implementation Agent
    → メイン会話が直接編集・実行して実装する。
      独立させる場合はgeneral-purpose Agentへの委譲で代替可能
```

プロダクトによっては、複数のAIツールを役割ごとに使い分けることもある。その具体的な役割分担（どの局面でどのツールを使うか）は本ドキュメントのスコープ外とし、プロダクト側の運用ドキュメントで別途整理する。

導入するAgentの実装状態（実装済み・未実装・ツール名等）は、時間とともに変わる。この「今どのAgentが実際に動いているか」という進捗情報は、本Practice Guide側では管理せず、プロダクト側の`07_Workflows`で管理し、重要な採用・廃止判断は結果となる成果物内へ理由と経緯を残す。

---

# 15. 設計原則

サブエージェントは、「役職」ではなく、「責務」で分割する。

各Agentは必要最小限のContextのみを参照する。

Context Facilitatorのみが全体を統合する。

人間はContext Facilitatorとの対話を中心とし、各専門Agentと直接会話することを基本としない。

# 16. Summary

CRDDにおけるサブエージェントは、AIを増やすための仕組みではない。

専門視点を分離し、人間の認知負荷を下げるための組織構造である。

Context Facilitatorが専門Agentの知見を統合し、人間が最終判断を行うことで、

```text
AIは理解・整理・提案し、人間は判断する
```

というCRDDの基本理念を実現する。
