# CRDD標準自身の課題探索・要求形成

工程規則: [`21_Discovery.md`](../21_Discovery.md)
維持責任者: Qual-Lab
項目の決定権限: Qual-Lab
対象改訂版: 2026-08-25に人間が採用した上流工程強化方針
現在状態: Adopted / Planned

本書はCRDD標準自身について、会話だけへ残すと失われる起点、採用済み意図、保持条件、検証義務および未解決事項を保持する課題探索・要求形成の正本成果物である。標準の規範本文、変更トレースまたは実装指示ではない。着手時は現行正本と影響を再確認し、一つの変更意図として`CHG-*`を発行する。

## 1. 起点と人間の判断

CRDDは、良質な上流コンテキストが存在する場合の実装、試験、監査および文書整合を高い安定性で進められるようになった。一方、上流工程では、必要項目や文書が揃ったことを理由に、人間の本質的なProblem、Motivation、Value、BehaviorまたはConstraintを十分に発見する前に次工程へ進むおそれがある。誤った上流前提を下流が高精度に具体化することは、下流能力が高まるほど大きな失敗になる。

Qual-Labの人間の決定権限者は、Coordinator Runtime 1.0の正式署名一般Task実行と完成固定版の確認後、そのRuntimeをDogfoodingして次の二つを一つの上流工程強化として進めることを採用した。

1. 課題探索・要求形成（Discovery）で、人間の暗黙Contextを発見し、反証し、再確認して収束させる対話Loopを強化する。
2. UX、IA、UI、Graphic、SPEC、Architectureの各Agentを、同じ「賢いAI」ではなく工程固有の専門家として振る舞わせる。

この採用は実装着手、規範変更、v0.18.0への収載、工程移行またはReleaseを意味しない。

## 2. 保持する意図

### 2.1. Discovery Elicitation Loop

Discoveryは欄を埋める工程ではなく、後続のUX、IA、UI等で重要な設計判断が大きくぶれない地点まで、人間の判断軸を発見する工程とする候補を評価する。後工程の答えそのものを先取りせず、Problem、Motivation、Value、Desired Outcome、Behavior、Constraint、PriorityおよびFailure Impactの因果関係を形成する。

候補Loopは次のとおりである。

```text
Elicit
  ↓
Why
  ↓
Interpret / Reframe
  ↓
Challenge
  ↓
Update Context
  ↓
Revisit
  ↓
Convergence Check
```

保持する条件:

- 一度の回答を直ちに確定情報へ昇格させず、AI仮説、人間の明示発言、Reframeへの同意、反証後も維持された結論を区別する。
- 重要な問いはContext増加後に、Open Question、Hypothesis、Counterfactual等の異なる角度で再確認する。
- 回答の変化を失敗ではなく、解像度、因果理解または価値判断が深まった結果として扱う。
- 発言量やEvidence量に比べ結論のConfidenceが高すぎる状態を潜在Contextリスクとして扱う。
- 「他にありますか」だけに依存せず、工程の専門性から有力な仮説と選択肢、推奨理由を提示して人間が違和感を返せるようにする。
- 質問時は現在の工程、今考えていること、次に決めること、AIの推奨、代替案と影響を短く示す。
- 文書完成、固定質問数または単純なKnown／Unknownだけを終了条件にしない。
- 次工程へ進む前に、後から覆りそうな前提、暗黙仮定、未確認の価値／制約を確認する早期終了防止確認を行う。
- DiscoveryとUXその他の後続工程は、意味を変える新事実が見つかった場合に戻れるLearning Loopとする。

### 2.2. 工程別Agentの専門性

| 工程 | 強化する思考様式 | 主な品質 |
|---|---|---|
| Discovery | Why、Reframe、Challenge、潜在Context発見、再確認 | 本質性 |
| UX | 複数のExperience Hypothesis、上流PrincipleへのTrace、反証 | 有用性 |
| IA | Entity、Relationship、Grouping、Hierarchy、Lifecycle、Authorityの構造化 | 構造性 |
| UI | 複数Interaction Patternの探索、比較、状態網羅 | 操作性 |
| Graphic | Visual Intent、知覚・感情の方向、具体案を見せた比較 | 表現性 |
| SPEC | 実装者により解釈が変わる曖昧さ、境界、例外の除去 | 明確性 |
| Architecture | Technologyより先に責務、Ownership、Trust／Failure Boundary、Trade-offを設計し反証 | 成立性 |
| Implementation | 確定Contextと委譲Authority内で自律的に完遂 | 正確性 |
| Test | 期待、失敗、境界を判定できるEvidenceの生成 | 検証性 |
| Audit | 全体整合、逸脱、未評価範囲の独立確認 | 保証性 |

上流と下流で人間接続を同一最適化にしない。答えが人間の中にしかないDiscoveryでは積極的に聞き、確定Contextに答えがある下流では不要な質問を減らす。UI／Graphicは比較できる具体案を見せ、SPEC／Architectureは必要なTrade-offだけを人間へ返す。

### 2.3. 工程間のFeedback

```text
Discovery ⇄ UX ⇄ IA ⇄ UI / Graphic
                         ↓
                        SPEC
                         ⇄
                    Architecture
                         ↓
                   Implementation
```

後工程の新しい事実によって上流の意味が変わる場合は、該当工程へ戻る。反復を無制限に続けず、Context Confidence、保持条件、未解決不確実性および収束理由を説明可能にする。

## 3. 優先順位と開始条件

第一優先はHumanからCRDDへの入口である。候補順序は次とする。

1. Discovery Elicitation Loop
2. UXのExperience Hypothesisと反証
3. UIの代替案探索と必要状態の網羅
4. GraphicのVisual Direction比較
5. IAは実運用上の不足に応じて追加強化
6. SPEC／Architectureは、改善した上流Contextが失われた実例をDogfoodingで観測した場合に重点強化

開始条件は、Coordinator Runtime 1.0の正式署名一般Task実行と完成固定版が確認され、この変更へ人間が着手判断を返すことである。開始時に本書の現行性、対象範囲、専門探索、利用側、変更禁止範囲および必要監査を再確認し、Discovery Loopと工程別Agent強化を一つの主変更意図としてCHGへ接続する。

## 4. 目指さないこと

- すべての工程を同時に全面改修すること。
- 固定質問票、質問回数、文書の空欄充足をDiscovery品質へ読み替えること。
- Discovery AgentがUX、IAまたはUIの答えを先取りして確定すること。
- すべての画面や機能へ同じ状態一覧、同じ代替案数または同じQuality Attributeを機械適用すること。
- SPECが実装方法を必要以上に固定すること。
- 全工程で人間への質問を減らすこと、または逆に全工程をConversation-heavyにすること。
- Agentの自己申告、モデル名またはProvider名だけから専門能力やAuthorityを推定すること。
- Coordinator Runtime完成前に本項目を実装中として扱うこと。

## 5. 検証義務

変更着手後は少なくとも次を検証する。

- 発言量が少ない人間でも、表面的要求と本質的なProblem／Desired Outcomeを区別できる。
- AI仮説と人間の発言を分け、Reframe、Challenge、Revisitによる意味変化を追跡できる。
- Discovery終了は、後続判断へ使える安定した判断軸、Evidence Depth、残存不確実性および収束理由で説明できる。
- UX、IA、UI、Graphic、SPEC、Architectureの重要判断が上流ContextへTraceでき、工程固有の反証を行える。
- 後工程の不足を無言で補完せず、正しい上流工程へFeedbackできる。
- 工程別の専門性強化が、不要なAgent、質問、成果物、承認段階または固定Workflowを増やさない。
- 既存のHuman Authority、外部情報境界、専門探索・収束、独立レビュー、品質保証および変更影響伝播を弱めない。
- CRDD自身の実変更、独立レビュー、監査、CHANGELOG更新をCoordinator Runtime経由で実行し、選定理由、委譲、結果統合および人間判断境界をEvidence化できる。

## 6. 未解決事項と引き渡し

- Runtime完成後、第一実装をDiscoveryだけへ限定するか、UX／UIまで同じCHGで扱うかは、利用側母集団と独立した採否・移行・切戻し境界を着手前に再評価する。
- 質問表示、対話状態、Confidence、Convergence等を新しい固定Schemaへする必要性は未確認であり、現時点では導入しない。
- 本候補から恒久契約へ採用する内容は責務を持つルート正本へ反映し、Dogfooding固有の結果はCHG／品質成果物へ保持する。
- 現在、人間による追加判断は必要ない。次の人間判断は、Runtime完成後の着手、または着手前確認で独立して採否できる変更境界が判明した時点で行う。
