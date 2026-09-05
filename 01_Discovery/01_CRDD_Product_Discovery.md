# CRDD標準自身の課題探索・要求形成

工程規則: [`21_Discovery.md`](../21_Discovery.md)
維持責任者: Qual-Lab
項目の決定権限: Qual-Lab
対象改訂版: 2026-08-25に人間が採用した上流工程強化方針および長期発展方針、2026-08-28に追加採用し同日v0.18.0 Candidateへ収載した第2段階の改善意図、2026-08-29にRuntime終盤E2Eの学びから具体化したSystem Journey Closure、将来Runtime Architecture候補、能力到達点の投影および根拠駆動の責務分離原則、2026-08-31の有用性実測に基づく次版検討候補
現在状態: 項目別。採用済みの作業意図と未採用の能力候補を分ける。

| 対象 | 状態・変更記録 |
|---|---|
| §1～§6の上流工程強化、§7.3.1と§7.3.3の工程接続・判断再開・文書入口改善 | v0.18.0で採用・実装検証・公開済み（CHG-000055）。v0.18.1の採用入口是正はCHG-000056で追跡する |
| §7.3.2の根拠駆動Runtimeリファクタリング | 採用したv0.18.0対象は実装検証・公開済み（[CHG-000055の実施結果](../90_Release/Changes/CHG-000055_CRDD_Long_Term_Evolution_Roadmap.md#24-実務結果の照合と最終固定への引渡し)と[現在の評価](../90_Release/Changes/CHG-000055_CRDD_Long_Term_Evolution_Roadmap.md#26-実務評価と最終確認への引渡し)）。総合的な性能優位は未実証 |
| §7.9の責務分離原則 | `Adopted / Planned` |
| §7.1の上位方向 | `Adopted / Unscheduled` |
| §7.2のCoordinator Runtime 1.0 | v0.18.0で候補内容を採用・実装検証・公開済み（CHG-000015）。v0.18.1の配布契約と作業対象Revision結合の是正はCHG-000056で追跡する |
| §8のMinimum AI-native Project Runtime | v0.19.0へ採用・設計中（CHG-000057） |
| 第2段階に残る未採用の実行観測候補、§7.4～§7.8の個別研究候補、§7.9の将来能力地平 | `Held / Unscheduled` |

本書はCRDD標準自身について、会話だけへ残すと失われる起点、採用済み意図、保持条件、検証義務および未解決事項を保持する課題探索・要求形成の正本成果物である。標準の規範本文、変更トレースまたは実装指示ではない。着手時は現行正本、影響および既存の未リリース変更意図を再確認し、同じ意図は既存CHGへ接続する。独立した変更意図が必要な場合だけ、[変更規則](../12_Change.md)に従って新しい`CHG-*`を発行する。

2026-09-01の候補内容・移行方針の採用後、PR #32でmainへ統合し、v0.18.0を公開した。[CHG-000056](../90_Release/Changes/CHG-000056_Coordinator_Adoption_Interface_Correction.md)はv0.18.1の採用入口是正を追跡する。将来候補や別の採用先を追加承認したものではない。

§7.3.2の作業意図の採用と、同節の[次版検討候補](#runtime-utility-next-version-candidates)の状態は分ける。候補のうち§8へ明示収載した範囲だけがv0.19の実行対象であり、残りは`Held / Unscheduled`を維持する。

## 1. 起点と人間の判断

CRDDは、良質な上流コンテキストが存在する場合の実装、試験、監査および文書整合を高い安定性で進められるようになった。一方、上流工程では、必要項目や文書が揃ったことを理由に、人間の本質的なProblem、Motivation、Value、BehaviorまたはConstraintを十分に発見する前に次工程へ進むおそれがある。誤った上流前提を下流が高精度に具体化することは、下流能力が高まるほど大きな失敗になる。

Qual-Labの人間の決定権限者は、Coordinator Runtime 1.0をDogfoodingして次の二つを一つの上流工程強化として進めることを採用した。2026-08-30には、検証済みの署名済み固定Runtimeで工程強化を先に自己適用し、全変更収束後の最終固定版にだけ正式署名E2Eと完成監査を行う順序へ具体化した。

1. 課題探索・要求形成（Discovery）で、人間の暗黙Contextを発見し、反証し、再確認して収束させる対話Loopを強化する。
2. UX、IA、UI、Graphic、SPEC、Architectureの各Agentを、同じ「賢いAI」ではなく工程固有の専門家として振る舞わせる。

この時点の採用だけでは、実装着手、規範変更、特定版への収載、工程移行またはReleaseを意味しなかった。その後2026-08-28に、Qual-Labの人間の決定権限者は§7.3.1～§7.3.3を含む本強化をv0.18.0 Candidateへ収載すると判断した。判断経緯、現在の実行順序および具体的変更は[`CHG-000055` §9](../90_Release/Changes/CHG-000055_CRDD_Long_Term_Evolution_Roadmap.md#9-v0180-candidateへの収載判断による再開)と同CHGの最新節が所有する。収載判断や自己適用の開始は、実装完了、規範採用、Stable化またはReleaseを意味しない。

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

開始条件は、検証済み固定Runtimeによる自己適用、人間の着手判断、および現在の正本・対象範囲・専門探索・利用側・変更禁止範囲の再確認である。開始済みの工程接続、判断再開および文書入口改善は一つの主変更意図としてCHG-000055へ接続し、Runtime sourceへ影響しない間は最終固定版まで正式署名と完成監査を反復しない。

## 4. 目指さないこと

- すべての工程を同時に全面改修すること。
- 固定質問票、質問回数、文書の空欄充足をDiscovery品質へ読み替えること。
- Discovery AgentがUX、IAまたはUIの答えを先取りして確定すること。
- すべての画面や機能へ同じ状態一覧、同じ代替案数または同じQuality Attributeを機械適用すること。
- SPECが実装方法を必要以上に固定すること。
- 全工程で人間への質問を減らすこと、または逆に全工程をConversation-heavyにすること。
- Agentの自己申告、モデル名またはProvider名だけから専門能力やAuthorityを推定すること。
- 先行自己適用の開始をCoordinator Runtime全体の完成、規範採用またはReleaseとして扱うこと。

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

- 先行自己適用の各変更をDiscoveryだけへ限定するか、UX／UIまで同じCHGで扱うかは、利用側母集団と独立した採否・移行・切戻し境界から再評価する。既に開始済みの同じ変更意図を、工程が変わるだけで新CHGへ分割しない。
- 質問表示、対話状態、Confidence、Convergence等を新しい固定Schemaへする必要性は未確認であり、現時点では導入しない。
- 本候補から恒久契約へ採用する内容は責務を持つルート正本へ反映し、Dogfooding固有の結果はCHG／品質成果物へ保持する。
- 採用済みの先行自己適用は承認済み範囲で継続する。独立して採否できる変更境界、未承認の外部処理またはリスク受容が新たに必要になった時点だけ、現在の判断集合を再評価する。最終採用・統合・Releaseの人間判断は維持する。

## 7. CRDDの長期発展方針

### 7.1. 採用した上位方向

Qual-Labの人間の決定権限者は、CRDDの長期的な発展を次の流れとして捉える上位方向を採用した。

```text
AI作業者（AI Worker）
  ↓
AI開発チーム（AI Development Team）
  ↓
AIネイティブ・プロジェクト（AI-native Project）
  ↓
AIネイティブ組織（AI-native Organization）
```

CRDDは、コンテキストリポジトリを中心としたAI開発方式から、人間のアイデア・判断・責任を起点に、AIの専門家チームが設計・実装・検証を担う開発運営モデルへ進む。現在は、コンテキスト、判断、根拠、専門工程、不足／影響監査、エージェント組織（Agent Organization）、決定権限／人間判断境界、自律オペレーション（Autonomous Operation）およびCoordinator Runtimeが接続され、AI開発チームを安全かつ再現可能に動かす基盤を成立させる段階にある。

採用したのはこの発展方向であり、以下の個別能力、実装方式、固定スキーマ、順序、期限または製品統合ではない。各段階は前段の実測根拠と人間の判断から再評価し、次の観測地点まで進んだ後に再び考える。

### 7.2. 第1段階（Phase 1）— Coordinator Runtime 1.0

到達目標は、エージェント組織を実Runtimeへ接続し、必要な専門性、能力および独立性に応じて作業を委譲できるAI開発チームを実行可能にすることである。

主な能力候補は、エージェント／プロバイダー（Provider）経路選択、委譲／引き渡し、決定権限の強制、プロバイダー隔離、独立レビュー、結果統合、回復および人間判断への返却である。現在の具体的な完成条件は[`CHG-000015`](../90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md)が所有し、本節から追加または変更しない。

Issue #30の整理、自律オペレーションの参照実証およびv0.18.0の最終化は同時期の保守／リリース作業になり得るが、第1段階の能力定義には含めない。

### 7.3. 第2段階（Phase 2）— 実行観測と専門工程の自己適用

到達目標は、AI開発チームが実際にどう働くかを知り、工程固有の専門能力を育てることである。最初から予測モデルや固定の実行観測スキーマを作らず、CRDD自身の開発でCoordinatorを利用し、実行事実を必要最小限に観測する。

観測候補には、実行時間、プロバイダー／モデル／推論レベル、エージェント実行、委譲、並列実行、レビュー／指摘、再試行、人間判断、不足／影響範囲、利用枠観測および結果がある。認証情報、内部推論全文または目的に不要なプロバイダー情報を収集する許可にはならない。実行観測の情報分類、保持、送信、費用および決定権限は着手時に別途確認する。

<a id="runtime-utility-evaluation"></a>

#### 実行観測による有用性評価

Coordinator Runtimeの成功を、複数Providerの安全な起動だけで完了させない。主要な問いは「品質を落とさず、人間のAttention、採用可能な結果までの時間および単一Providerへの集中を減らし、不要なAI間反復を許容範囲へ保てるか」とする。[`進捗と運用上の有用性評価の分離`](../15_Progress.md#operational-utility-boundary)に従い、Dogfoodingでは次の軸を混ぜずに観測する。

| 評価軸 | 主な観測 |
|---|---|
| 採用可能な結果までの時間 | Task開始からReview、必要な是正、Verificationを経て、人間が追加作業をほぼ行わず採用可能になるまでの経過時間 |
| 人間の実作業時間 | 入力、確認、判断、再説明、手動Recoveryその他、人間が実際に拘束された時間と判断回数 |
| AI処理量 | Executor、Reviewer、Remediationの実行時間、Turn、Provider呼出し、Retry、ReviewおよびRemediation回数 |
| 反復効率 | 同一Findingの再発、不要な再Review、同じContextまたは判断の再要求、最終結果へ寄与しなかった実行 |
| Provider利用分散 | Provider別の実行、時間、Turn、観測可能な利用量、利用枠停止および切替Latency。API key、課金額または利用枠を観測できない場合は推定しない |
| 品質 | 初回Review Pass、Finding、是正成功、後工程Finding、人間による追加修正、E2E Failure、RecoveryおよびManual Recovery |
| 処理量 | 一定期間に採用可能な結果へ到達した作業数。個別Latencyおよび並行実行と分ける |

各Operationでは、対象Task／CHG、難易度、開始・終了、採用可能な結果までの時間、AI処理量、人間の実作業時間と判断回数、Provider別利用、Review／Remediation／Retry／Recovery、および後工程Findingを一つのProfileとして取得可能にする。未観測値を0へ補正せず、実測、Providerが返したmetadata、推定および取得不能を区別する。AI総処理のうち結果へ寄与した割合は、初期には単一数値へ固定せず、不要Loopの分類と件数から始める。

代表作業では、可能な範囲で、単一Agentによる直接実行、CRDD Contextあり・Coordinatorなし、CRDDとCoordinator Runtimeの三条件を比較する。すべてのTaskを三重実行せず、単純作業と高難易度作業を分け、対象選択、比較不能範囲および標本限界を示す。十分なOperationが集まるまで事前の改善率や総合点を成功条件にせず、品質を維持または向上した範囲で、人間負荷、完成時間、Provider集中、不要Loopおよび処理量の変化を集約する。

本観測は固定Telemetry Schema、利用量取得のための追加Credential、Provider規約外の計測または全作業の常時記録を直ちに採用する判断ではない。最小のOperation ProfileでBaselineを取得し、将来MCP等の協働接続面を追加した場合は、CRDDのみ、Coordinator追加、協働接続面追加の差を同じ境界で比較する。

CodexとClaude Codeの比較も、この有用性評価へ含める。最初は同じ小さな実務Taskを、Codex実行者＋Claude Code確認者、Claude Code実行者＋Codex確認者で各1回実行する計画とする。前者だけの成功を後者の成功へ流用せず、両者の成果を互いの入力へ混ぜない。目的は実務に適した委譲経路の判断材料を得ることであり、モデル全般の順位を確定することではない。

- 同じ対象Repository／Revision、Task本文、読取り投影、許可Path、受入条件、Runtime改訂版、隔離・cleanup条件を使い、別々の新規Candidateで実行する。結果は評価後に破棄し、比較のために正本へ自動反映しない。
- 使用した正確なモデル、Provider CLI／image、推論強度、turn上限、実行時刻・順序を記録する。同名の推論レベル、Provider別turn数、API相当USD値を同じ計算量・実課金額へ換算しない。互換性によるモデル切替が起きた場合は実モデルを明示する。比較のための自動高推論化や高速モードは使わない。
- 実行者の結果、Reviewer指摘、是正、採用可能な結果までの時間、親による追加修正と品質確認を分ける。Reviewerも入れ替わるため、全体差は経路の差であり、実行者単独の能力差とは断定しない。段階別時間・利用量を現在の出力から取得できない場合は未取得とする。
- 初回は2 Task、通常4回のProvider呼出し、既存の最大1回是正と再レビューを両Taskが使う場合でも最大8回に限定する。追加のTask再試行、利用枠不足時の有料API切替、追加購入は行わない。cleanup不明、回復要求、同意・Identity不一致では比較途中でも停止し、失敗を標本から除かない。
- 1組の観測は探索的な事例であり、成功率、統計的優位性または品質改善率を一般化しない。順序、負荷、cache、Provider状態の影響を未分離の要因として残す。追加比較が必要なら、その不確実性と必要回数を先に示し、承認した少数回の範囲を無制限に広げない。

更新Runtimeの効果とProvider差を混同しない。更新版で両経路を実行できる条件が未成立なら計画だけを保持し、旧署名配布物を使った比較を更新版の検証と表示しない。署名条件を外した実Provider入口をこの比較計画から自動許可しない。担当は親Coordinatorとし、更新版の実測経路成立時に実行可否と最大呼出し数を再確認する。

並行して、課題探索・要求形成、UX、IA、UI、アーキテクチャ、実装、検証および外部コミュニケーション等の専門工程を自己適用する。第1の入口は本書1章から6章に記録した課題探索対話ループと上流工程エージェント強化である。検証済み固定Runtimeと人間による着手判断を開始条件とし、全変更収束後の最終固定版へ正式署名E2Eと完成監査を実施する。ここで得た実績を、後続の計画／能力設計候補の根拠にする。

§7.3.1～§7.3.3では、改善へ着手する作業意図を採用している。§7.3.1と§7.3.3のうち工程接続、判断再開および文書入口はCHG-000055として自己適用中である。個別の観測Schema、新工程、Architecture境界、Adapterまたは互換性を一括採用したものではなく、自己適用の根拠から変更単位で再評価する。

#### 7.3.1. 工程接続と意味網羅検証の強化候補

Coordinator Runtime 1.0の実装と監査では、実装後にFailure、Recovery、資源所有、cleanup、部分状態、親Process消失および終端状態の不足が見つかり、修正の伝播漏れによる監査往復が発生した。この学びは特定Runtimeの局所修正だけに閉じず、振る舞い仕様、アーキテクチャ、検証設計、実装および検証の接続を強化する候補として第2段階で自己適用する。

```text
振る舞い仕様
何を保証するか
  ↓
アーキテクチャ
状態、遷移、資源、境界および不変条件でどう成立させるか
  ↓
検証設計
何を観測すれば成立または不成立を判定できるか
  ↓
実装 → 検証 → 独立レビュー／監査
```

候補には、Runtimeの特性に応じた機能、状態、失敗、回復、資源、冪等性、観測および終端の振る舞い契約、重要利用経路（Critical Journey）単位のシステム結合試験（System Integration Test）、ならびにEffect前後、耐久Write前後、Lock解放前後、cleanup途中および結果公開前後の失敗注入点（Failure Injection Point）を含む。正常、準正常、異常および回復の意味母集団を、試験件数やcoverage率ではなく設計上の状態・遷移・資源・観測へ接続する。

Runtime終盤の正式署名E2Eでは、UT、IT、Traceabilityおよび独立監査を通過したComponentをproduction相当の順序で接続した後に、同一Truthの重複所有、機械検証と独立Reviewerの責務重複、正常Resultの`absent / null / unknown`差、RuntimeとRunnerの成功母集団差、Remediation Handoffの情報不足、Subscription利用量metadataとFinancial Authorityの混同、および永続State producer変更に対するproduction consumer追従漏れが顕在化した。

この学びから、高複雑度・高信頼対象ではComponent単体の成立と利用者価値の成立を分け、次の閉包を自己適用候補へ含める。

- システムJourney閉包（System Journey Closure）: Human／TriggerからAuthority、Execution、Review、Remediation、Verification、cleanupおよびResult Publicationまでを一つのJourneyとして、開始・終了条件、Owner、Authority、資源、Result shape、正常・準正常・異常、cleanup後条件および最終成功判定へ接続する。
- 単一正本・単一所有者（Single Truth／Single Owner）: 重要なState／ArtifactごとにCanonical Owner、Producer、Consumer、Consumerが検証する境界および再所有してはならない契約を識別する。共有Schema化を目的化せず、Consumerが同じCanonical Truthを独自のexact key集合や意味規則として複製しない。
- 検証責務のProperty別分離: Runtime、AI Reviewer、Machine VerificationおよびHuman Authorityが何を最終証明するかをProperty単位で示す。複数Layerで同じ事実を観測するDefense in Depthと、同じProjectionを複数のCanonical Authorityとして再判定する責務重複を区別し、観測できない事実をAgentへ証明させない。
- 終端と成功母集団の共有: `success`、安全な拒否、Recovery必要、unknownおよびProcess再起動必要を先に定義し、UT、IT、E2EおよびRunnerで再定義しない。`null`は不要確認済み、field不存在は契約不適合、`unknown`は判定不能等、「ない」の意味も明示し、Consumerが推測補正しない。
- 安全で十分な是正搬送: Reviewer Findingを命令やAuthorityではなく、長さ、Path、Secret、受入条件、単回性およびScopeを検査した信頼しない欠陥主張として同じExecutorへ渡し、Workspace、受入条件およびTestと独立照合する。情報削減により欠陥を一意に復元できない状態も不成立とする。
- 実結合と外部値の意味: Authority、Recovery、Consent、Security State、Candidate／Release IdentityおよびDurable Intentでは、実Producerから実Transportを通してProduction Consumerへ届く結合を検証母集団へ含める。外部Systemの`cost`、`usage`、`quota`、`limit`、`price`または`budget`は名前から意味を推定せず、Observed Metadata、Operational／Policy Limitおよび実際のBilling／Financial Authorityを分離する。

人間判断境界では、既存の[`判断支援契約`](../11_Skill.md#53-decision-support-contract)を質問文の品質だけで完了としない。AIが既存Rule、AuthorityおよびContextから一意に処理できる事項を先に除外し、本当に人間の決定権限が必要な地点だけで停止する。判断要求から回答後の再開までを、次の一つのHuman Decision Journeyとして評価する。

```text
現在状態と判断要否の再計算
  ↓
承認／選択／確認／情報提供／判断／リスク受容等の要求種別
  ↓
推奨、理由、同粒度の代替案、影響、保留時の結果、具体的な回答形式
  ↓
人間の短い回答
  ↓
正しい正本Context／Authorityへの反映
  ↓
回答済み判断を再要求せず、必要な工程を自律再開
```

すべての問いへ固定Templateまたは長文を要求せず、重要度とリスクに応じた段階的開示を用いる。実質的な承認を選択に見せる等の要求種別混在、推奨案だけ詳細で代替案が比較できない状態、回答方法や保留影響が不明な状態、AIが確認できない事実を人間へ丸投げする状態、および回答後も同じ判断を反復する状態を不成立候補とする。人間が「何を答えるか」「なぜ推奨か」「案の差は何か」「決めないとどうなるか」を追加質問しなければ判断できない場合は、個人の理解不足ではなくInteraction UXのFinding候補として扱う。

自己適用では、設計閉包（Design Closure）、検証閉包（Verification Closure）およびシステムJourney閉包を別々に評価し、一つの合格から残りを推定しない。固定Schemaや新しい巨大工程を先に作らず、今回の反復Findingを事前検出できる最小の正本、ひな型、Checkerまたは契約試験を選び、実際に監査往復、伝播漏れおよび利用者操作を減らせたかをDogfoodingで評価する。

これは新しい固定工程または全対象への完全Runtime契約を直ちに追加する判断ではない。既存の振る舞い仕様、アーキテクチャ、品質保証および検証工程の責務を、対象の境界、資源、Authority、Effectおよび失敗影響に比例して強化する。Security／Authority境界、外部Effect、Durable State、Recovery、Multi-process／取消可能な非同期Runtime、Release／Promotion、Financial EffectおよびAI間Delegationを主対象とし、単純なローカル処理へ存在しない回復状態や外部Authorityを作らない。Coordinatorの機械可読Traceは有効性を自己適用で確認するReference Candidateであり、実効性が確認できた要素だけを共通規則へ昇格する。

#### 7.3.2. Coordinator Reference Runtimeの根拠駆動リファクタリング候補

Coordinator Runtime 1.0は未知のFailure Modeと回復要件を自己適用しながら成立させたため、一部の責務がCoordinator周辺へ集中している。Runtime 1.0の完成を大規模再設計で遅らせず、完成後の実行、監査、回復およびTraceabilityの根拠から、繰り返し変化した境界だけを抽出して再整理する。

内部責務の候補は、一つのOperationを安全に終了させるオペレーション・ライフサイクル（Operation Lifecycle）と、資源の取得・所有・移譲・解放・回復を扱う資源ライフサイクル／台帳（Resource Lifecycle／Ledger）である。外周では、次の境界候補を評価する。

- 外部接続境界（External Interface Adapter）: CLI、MCP stdio、MCP Streamable HTTPまたは将来API等のTransport固有処理を、Runtimeの意味Interfaceから分離する。
- リポジトリ選択・接続境界（Repository Router／Binding）: 外部要求を明示登録済みRepositoryのcanonical Identityへ結合し、Project Runtime候補からCoordinatorへ渡す。Repositoryを自動探索せず、利用者ローカルの明示Registryは探索と端末固有Bindingだけを担う。Repository-localに置ける候補は、検証済みProject／Repository Identityへの参照、宣言的Policy、非秘密の設定および参照に限り、いずれもAuthorityではなく検証対象の宣言入力とする。Repository内容の書換えだけでIdentity、Capability、実行許可またはRecovery権限を得られない。
- プラットフォーム境界（Platform Adapter）: Process、隔離、Lock、Filesystem、Console／stdio、Owner Loss、cleanup、RecoveryおよびDocker Host接続をCoordinator Coreから分ける。OS間で同じ機構ではなく、Effect前Authority、分離、回復、Fail ClosedおよびEvidenceという同じ保証を要求する。
- プロバイダー境界（Provider Adapter）: Codex、Claude Code、将来ProviderまたはSelf-hosted ProviderのInvocation、Capability、認証状態の観測、Output、Cancellation、Failure分類および固有制約を吸収する。CRDDはCredentialを所有・複製せず、各Providerの正式な認証とAuthorityを要求する。

```text
現在のReference Runtime
CLI → 単一Repository Binding → Coordinator Core
                               ├ Windows実装
                               └ Codex／Claude Code

第4～第5段階の研究候補（Held）
Client → External Interface → Repository Router／Binding → Project Runtime → Coordinator Core
                                                                                ├ Platform Adapter
                                                                                └ Provider Adapter

第6段階の研究候補（Held）
Client → External Interface → Organization Runtime → Repository Router → Project Runtime → Coordinator Core
                                                                                                ├ Platform Adapter
                                                                                                └ Provider Adapter
```

この図はHeld候補を理解するための説明投影であり、採用済みTopology、固定API、実装順または互換性契約ではない。将来機能の採用、実装許可、Remote接続、待受port、Credential入力、データ送信または課金を許可しない。

このHeld候補でも、Organization Runtimeを経由してProject Authority、Credential、CapabilityまたはRecovery権限を暗黙継承しない。Repository RouterでProject／Repository Identityとbindingを再検証し、Project Runtimeで現行Policyおよび要求操作のAuthority／Capabilityを再検証・認可する。Recovery操作も、現行Policyと専用Capabilityを再検証する対象に含める。不一致、置換、競合または観測不能では既定拒否とし、再検証前にEffectを発生させない。

このHeld候補のCredentialはProvider／OSのselected-user認証Storeが所有し、CRDDは所有・複製しない。保護Runtime Stateが保持できるのはopaque参照、認証状態の観測、selected-user／Provider／Project binding、発行済Capability、activation／operation stateおよび実行時Recovery recordであり、Repositoryへ保存しない。

Repositoryへ別途公開判断済みの非秘密CHG／QA Recovery Evidenceは、この保存禁止の対象外である。ただし、実行時Recovery record、Runtime Authority、CapabilityまたはRecovery入力として再利用しない。

Coordinator固有の状態、Lock、Named Pipe、Dockerおよび回復設計は`06_Architecture/coordinator/`に置き、CRDD全体へ再利用できる原則だけを`04_Agent_Organization.md`その他の責務を持つルート正本へ昇格する。Reference Runtimeの増加を理由に、CRDDルートを実装Component一覧へ変えない。

採用したのは、Runtime 1.0完成後に反復Finding、責務集中、変更頻度、Failure Patternおよび運用Evidenceから安定境界を抽出する作業意図である。上記の境界名、分割方式および将来利用側は候補であり、実測されていない抽象化を先に固定しない。

<a id="tool-development-layout-candidate"></a>

##### Tool開発構成の標準化候補

2026-08-31の人間の依頼により、現在のRuntime修正・機械試験・E2Eを一通り通した後に、CRDD自身のTool開発も標準工程から追える構成へ整理する作業意図を保持する。担当責任者はQual-Lab。目的は配置統一そのものではなく、要求・設計・実装・検証・配布の正本を一意にし、利用者と開発者が必要情報へ辿れること。配置だけから工程実施や準拠を推定しない。

- 要求・体験・設計・検証の正本は既存の標準工程フォルダ、ソースとテストコード・ビルド定義は`40_Develop/<tool>/`へ配置する案を第一候補とする。Coordinator、Checker、Generator等に同じ判断軸を適用するが、空の工程成果物やToolごとの小さなCRDD構造を作らない。
- 利用者観点として[UX](../22_UX.md)、[IA](../23_IA.md)、[UI](../25_UI.md)および[UIとSPECの対応レビュー](../24_UI_Behavior_Specification.md)を対象範囲に応じて扱う。UXでは導入・通常利用・判断・失敗・復旧の体験と人間負荷、IAではコマンドや案内の情報構造、UIではCLIを含む入力・状態・結果・次の操作、対応レビューでは許可・実行条件・取消・失敗・再開と表示の一致を確認する。UI×SPECを第三の工程や重複正本にしない。
- 人間が直接操作するTool、AIから使うTool、両方から使うToolを区別する。GUIがないことをUI非該当の理由にせず、存在しない画面や視覚素材は要求しない。確認画面の不表示、二重Enter、タイムアウト、誤解を招く成功表示、過剰な再承認を代表的な失敗仮説として、実際の操作経路と検証へ接続する。
- 利用者への案内と反復手順を分ける。目的・利用条件・主要操作への案内はルートREADME、署名・検証・復旧・配布などの反復手順は`19_Workflows`、技術的な構築・実行説明は必要に応じてコード同居READMEが所有する。案内だけのために`tools/<tool>/README.md`を追加維持することは必須にせず、重複がなくなれば公式Repositoryの`tools/`を削除する案を第一候補とする。配布テンプレートの`template/tools/`は採用先へ渡す別の責務であり、この削除へ含めない。
- Git管理の第一候補は、ソース正本と薄い起動スクリプト・案内・版／ハッシュ固定設定を追跡し、生成配布物・キャッシュ・実行状態は通常ブランチで重複管理しない構成。署名済み配布物のリリース添付等と、Repository取得直後にビルド／ダウンロードなしで利用できる必要性を比較して決める。自動取得・自動実行の権限は追加しない。
- Source Commit、配布版、成果物ハッシュ、試験対象、Evidenceを一方向に追跡し、`tools`を手修正可能な第二ソースにしない。生成物の差分確認や再現検査は必要性に応じて具体化する。
- 移行対象にはimport・CLI・CI・Checker・署名manifestの配布Root／相対Path・テンプレート・リンク／アンカーを含む。新配置からの実行と配布物の検証を行い、過去の固定Evidenceは書き換えない。

2026-08-31、人間からの一括実施依頼と、案内だけを`tools`へ残さず作業手順へ分離する説明後の続行指示を受け、下記の工程別配置への移行を開始した。その後の試験・参照確認・独立レビューと内容採用を完了し、[CHG-000017](../90_Release/Changes/CHG-000017_Tools_Coding_Standards.md)へ移行処置と検証を集約した。完了した実行順の案内はロードマップから除去した。配布テンプレートの公開配置、署名済み旧配布物、過去の固定Evidenceは変更していない。

採用した責務分離と移行先は次のとおり。作業の続行を統合・Releaseの確定と扱わず、新配置からの実行と旧版との境界を検証する。

| 情報・実装 | 採用した配置方針 | 保持する境界 |
|---|---|---|
| 利用者体験、CLIの情報構造・表示、振る舞い | `02_UX/01_User_Experience.md`、`03_IA/01_Information_Architecture.md`、`04_UI/01_User_Interface.md`、`05_SPEC/01_Behavior_Specification.md` | 導入・通常利用・判断・失敗・復旧の実在する内容を記す。空の成果物を作らず、UIと仕様は項目の所有を分離して対応づける |
| 状態・資源・回復・脅威モデル・実装規約 | `06_Architecture/01_Architecture.md`と必要なTool別詳細 | 旧配置の`architecture/README.md`、`threat-model.md`と`06_Architecture/99_Coding_Standards.md`の責務を移す。工程入口をリンク集だけにしない |
| 品質戦略、検証設計、現在の品質状態、新しい結果 | `07_Quality/02_Quality_Strategy.md`、`03_Verification_Design.md`、`01_Quality_Center.md`、`Verification_Results/` | 既存の固定Evidenceは`90_Release/Changes/Evidence/`に保持し参照する。試験コードを品質記録へ移さない |
| Coordinator、Checkerの開発package、Rust実装 | `40_Develop/coordinator/`、`40_Develop/checker/`、`40_Develop/platform-access/` | source・tests・build定義を一意に所有。Checker開発packageは配布正本への接続を維持する |
| 反復する構築・検証・署名・復旧・移行手順 | `19_Workflows/` | 具体的な入力・実行順・停止・結果の返却先を記す。要求、設計、実行結果を複製しない |
| 配布Checker、Coordinator Runtime、一時物 | `template/tools/crdd-check.ts`、`template/tools/coordinator/`、Repository直下`.crdd/` | CRDDをcloneまたはsubmoduleで取得した利用者が同じ基準版のToolを利用できるよう、配布物を`template/tools`へ集約する。Runtime状態と一時物はignore-by-defaultを維持し、自動取得や別配布経路は追加しない |

代替は、当時の`tools`配下へ実装を残す案、起動接続部だけを残す案、生成配布物をGitへ格納する案であった。前者は移行量が少ないが今回の工程別所有を満たさない。起動接続部は独立した実責務がある場合だけ有力であり、旧Path維持だけの互換shimは作らない。当初は生成物のGit格納を推奨しなかったが、その後、CRDD Repository自体をcloneまたはsubmoduleで取得する導入経路では基準版とRuntimeを分離しない方が導入と版整合に優れると判断した。このため、現在はMilestoneで固定した配布物だけを`template/tools/coordinator/`で追跡し、日常のbuild生成物やRuntime状態は追跡しない。

公式Repositoryの旧`tools`を廃止し、開発コマンドと新しい署名配布内のソースPathを新配置へ揃える。旧Path互換を残さないため、単なる文書移動ではなく破壊的移行として扱う。import、package、命名検査とTypeScript所有集合、Rust build、manifestのソース結合、Docker assets、traceability、AI入口、現行リンクと手順を全数確認する。その後の配布判断により、native配布成果物は`90_Release`ではなく`template/tools/coordinator/windows-x64/`へ移し、manifestも`template/tools/coordinator/`で所有する。`40_Develop`はソース・build・試験、`90_Release`は変更・根拠・公開状態を所有する。秘密入力なしの開発検証を先に収束させ、mainへ統合後に固定した最終版だけを正式署名E2Eへ渡す。別Download、ZIPまたは自動取得の第二配布経路は追加しない。

<a id="runtime-utility-next-version-candidates"></a>

##### 次版へ引き継ぐ有用性・照合費用の改善候補

2026-08-31の人間の依頼により、中間有用性評価から次版に向けた検討材料を保持する。**候補保持であり、版番号・収載・設計・実装は未決**である。現行v0.18の必須完了条件、不具合是正、有用性Baseline取得または最終監査を次版へ移す判断ではない。

[前回の実測](../90_Release/Changes/Evidence/CHG-000015_Development_Provider_Comparison_848877c.json)と[重複検証集約後の実測](../90_Release/Changes/Evidence/CHG-000015_Development_Provider_Comparison_799e368.json)では、同じ小Taskの両経路がレビュー1回・追加是正0回で完了した。一方、後者の所要時間は増加し、高速化は実証されていない。Reviewer承認を人間受入、横断品質または任意Taskへの適用可能性へ昇格しない。この差を出発点として、既存の[有用性評価](#runtime-utility-evaluation)と本節の責務分離候補へ次を接続する。

| 検討対象 | 次に確認したいこと | 保持する条件 |
|---|---|---|
| 照合の発生元と費用 | 誰が、どの境界で、何のために検証したかを区間・呼出し元別に数え、署名、配布内容、Repository、資源観測の内訳を分離できるか | 新しい固定計測Schemaを先に決めない。測定窓を揃え、内包時間の二重加算や未観測値の0補正をしない |
| 検証の共有単位 | 状態・許可の最新性確認と重いFilesystem走査を分離し、同じ所有操作内で新しい検証結果を共有できる範囲はどこか | TTLやOperation全期間cacheを採用済みとしない。差替え・待機後・取消・期限・公開前・cleanupを検証し、T1～T2の保証を弱めない |
| 作業分解と横断品質 | 意味のある独立作業単位へ分解した場合と広いTaskで、上限停止・初回レビュー承認・親の追加修正がどう変わるか | 初回レビュー承認率は分母と難易度を示す。Reviewerを弱めたり受入条件を緩めたりしない。局所レビューとRepository横断確認を区別する |
| 実務上の比較評価 | 直接実行、CRDD Contextのみ、Runtime追加の代表作業で、人間の実作業時間・採用可能な結果までの時間・利用分散・後工程品質を比較できるか | 固定件数や事前の改善率を合格条件にしない。失敗・停止も標本へ残し、追加Provider利用は許可範囲内だけで行う |

維持責任者は親Coordinator、採否はQual-Labの人間の決定権限者とする。再評価契機は現行Runtimeの完成固定と実務自己適用の収束後、または新しい根拠が現在の完了・安全判断へ影響した時点とする。保留中は現在の検証と横断確認を維持するため処理時間と人間負荷が残り得る。安全上の問題が現在成立すると分かった場合は、将来候補のまま退避せず現行是正へ戻す。細部と再現根拠はCHG・Evidence、具体的なRuntime設計は[実行設計](../06_Architecture/coordinator/01_Architecture.md)が所有し、上位規則や専門機能を増殖させない。

<a id="v020-runtime-responsibility-separation"></a>

##### v0.20 Runtime責務分離

2026-09-05、人間の決定権限者は、Project Runtime、公開アプリケーション契約、MCP TransportおよびProvider実行がCoordinator packageへ物理的に集中している状態を、v0.20の後続機能を追加する前に是正する作業意図を採用した。目的はFolder数や抽象層を増やすことではなく、Project RuntimeをProject-level execution lifecycleのApplication Core、Coordinatorを実行編成、MCPをTransport、Execution Intelligenceを観測・分析、Platform AccessをOS／Platform境界として分離し、依存方向を機械的に強制できるようにすることである。

Project RuntimeはObjectiveをProject-level execution stateへ変換し、Task Graph、Queue、再計画、人間判断、統合および受入のlifecycleを管理する。Provider選択・Provider実行・OS機構・Transport sessionを所有せず、必要な実行能力はExecution Portとして要求する。CoordinatorはそのPortを実装するAdapterとなり、Project RuntimeからCoordinator実装を参照しない。MCP stdio／HTTPとCLIは、Project Runtimeが所有する同じ公開アプリケーション契約へ接続し、Project Authority、成功、正本変更またはRecovery Authorityを生成しない。

初期配置は`40_Develop/project-runtime/`、`40_Develop/mcp/`、`40_Develop/coordinator/`、`40_Develop/execution-intelligence/`および`40_Develop/platform-access/`の責務単位を候補とする。公開アプリケーション契約は、独立したLifecycleまたは複数所有者による版管理の必要性が実証されるまでProject Runtimeの公開入口として所有し、先行して独立packageへしない。Architecture、Workflow、検証およびpackageの成果物も同じ責務へ分ける。

完成には、Project RuntimeからCoordinator／Provider／MCP／OS固有実装への推移的依存0、CoordinatorによるExecution Port実装、MCP／CLIの公開契約だけを介した接続、内部Pathを参照する利用側0、およびv0.19のCLI／MCP stdio／Project lifecycleの意味回帰0を必要とする。Project RuntimeへRuntime Stateを集約することを、Project Management State、WBS、Topic、Risk、Forecast、Provider orchestrationまたはOS実装を所有させる根拠にしない。具体的な移動集合、package境界、互換性、Runtime実行Identityへの影響および完成条件は、着手時の変更トレースで固定する。

<a id="bounded-distributed-execution-candidate"></a>

##### v0.20 限定分散と統合結果の評価

2026-09-05、人間の決定権限者は、v0.19で成立したObjective Planning、Task Graph、最大5並列、再計画および統合を基礎に、目的の分析、作業分解、依存関係、限定並列実行、再計画、統合後の検証が実務上有効かを評価する作業意図をv0.20へ採用した。新しい並列基盤を一から作るのではなく、実装済みの範囲と未確認の利用者成果を分け、個別Taskの合格ではなく統合後に採用可能な結果へ到達したかを実行知へ接続する。

最初の実証規模は2～4作業程度を候補とし、標準の必要件数や成功条件にはしない。分析・計画の専門性は役割・スキルへ、実行境界の強制はRuntimeへ置き、Coreへ専門機能を追加する前提にしない。次を同じ目的に対する一つの実証として評価する。

- 目的と現在状態から作業と依存を説明し、前提が成立した作業だけを実行する。別ファイルであることだけで独立とせず、仕様、判断前提、共有資源、Lock、Provider利用枠および決定権限の競合を確認する。
- 実行者は結果だけでなく、計画継続に疑義がある根拠と影響を親へ返せるようにする。親は前提を再確認し、必要な作業だけを再計画する。依存先の停止・取消、未採用候補の回収、再試行と利用量の上限を設計し、無制限の再実行や子による権限拡張を認めない。具体的な状態名・Schemaは固定しない。
- 個別レビュー承認を統合受入と同一視しない。統合した改訂版で作業間の仕様・前提・資源・成果物の整合と目的の受入条件を検証し、統合変更によって影響した個別結果を再評価する。
- 統合後に採用可能な結果へ至る時間、人間の実作業時間、不要な反復、統合時の指摘・競合・手戻り、失敗・停止、Provider別利用量および後工程品質を比較する。並列起動数や個別合格数だけを成果にせず、改善率は実測から評価する。

現在の影響が不明な問題は将来候補へ逃がさず、親が不足根拠を確認する。人間の常時監視を成立条件にせず、既存の許可・正本から処置を決められない目的変更、重要判断またはリスク受容だけを人間へ返す。大規模Worker Pool、自動Quota最適化、完全な意味競合推論、Cross-project schedulingはv0.20の最低条件ではない。実証Task、比較条件、既存機能との差分および完成条件はv0.20の変更トレースで固定し、新しいロードマップや管理台帳を増やさない。

#### 7.3.3. 人間可読文書の意味構造改善候補

CRDD文書は条件と例外を一文へ高密度に保持する傾向があり、意味精度を維持する一方で、人間、AIおよびGit差分からの理解を難しくする場合がある。意味を簡略化せず、一段落を一つの意味単位、箇条書きを一つの責務とし、規則、条件、例外、対応関係、状態および流れをMarkdown構造へ一致させる改善を評価する。

目標は、人間可読性、AI可読性および機械可読性のいずれかを他の犠牲にして高めることではない。同じ正本を、概要、現在状態、重要事項、詳細契約、根拠／履歴の順に必要な深さまで読める段階的開示（Progressive Disclosure）として再構成する。結論と現在地を先に示し、一文一義を基本とする。並列事項は箇条書き、比較、状態、責務および条件は表を候補とし、平易な説明を先に置いた後で必要な正式用語を示す。

文書種別の責務差を失わない。規則、変更トレース、課題探索・要求形成およびアーキテクチャへ単一Templateを機械的に適用せず、読者が最初に必要とする情報を種別ごとに評価する。特に長期化した変更トレースでは、現在の状況、目的、残件、人間判断待ちおよびRelease Blockerを履歴から分離し、Finding、原因、対応、検証および結果の時系列を必要に応じて表または後段の根拠へ移す。最初の短時間で現在地を理解できることと、後からCurrent Stateへ至った理由を再構成できることを両立させる。

対象は新規文書だけでなく、現行配布系列から参照する既存正本、README、監査文書および過去のCHGを含む。Released CHGも可読性棚卸しから除外しないが、公開済みtagを変更せず、変更ID、判断、当時の状態、根拠、Evidence、参照関係および時系列を保持する。本文を情報欠落なく再構成できる場合は現行系列で表現を改善し、履歴本文を直接変えると意味または不変参照を損なう場合は、読者向け投影、索引または補助説明を用いる。

既存文書の再構成は意味保持リライト（Semantic-preserving Rewrite）として扱う。Requirement、規範強度、Authority、Scope、Status、Risk、Decision、Evidence参照および過去事実と現在状態の境界が変わっていないことを、変更前後の意味差分から確認する。Markdown整形や文章生成の成功だけを意味保持の根拠にしない。

対象全件を機械的に一括書換えせず、利用頻度、誤読影響、密度および変更頻度から優先順位を決める。確認は既存の文書監査と不足／影響監査を使用し、新しい監査種別を存在だけで追加しない。技術的な正しさとは別に、初見の主要ロケール利用者が結論、現在状態、条件、責務および次の行動を過度な解読なしに理解できるかを確認する。人間の理解、AIによる意味保持およびGit差分の追跡可能性を評価し、表現の好みではなく判断、実装、検証、移行またはリスク理解へ影響する箇所を対象にする。

自己適用では、少なくとも変更トレースの現在地把握時間、同じ意味の重複説明、長文に埋没した独立義務、現在状態と履歴の誤認、意味差分監査のFindingおよび利用者が追加説明を必要とした箇所を観測候補とする。「文字数が減った」「表が増えた」だけを成功とせず、意味欠落を増やさずに理解、判断および再構成の負荷を下げられたかで評価する。

### 7.4. 第3段階（Phase 3）— AIネイティブ・プロジェクト運営

到達目標は、一つのプロジェクトの計画、進捗、リスクおよび判断をAI開発チームへ接続し、プロジェクトそのものをAIネイティブに実行できる状態を評価することである。

```text
アイデア / 方向
  ↓
CRDD
  ↓
計画 / プロジェクト作業
  ↓
Coordinator → AI開発チーム
  ↓
実行 / 検証
  ↓
結果 / 根拠
  ↓
進捗 / 予測 / リスク
  ↓
Topic / 人間判断
  ↓
判断 → CRDD → 再評価
```

主な研究候補は次のとおりである。

- プロジェクト作業／進捗: Roadmap、変更、実行および根拠から実績／進捗を投影する。WBSや進捗率を人間が管理する新しい正本にせず、CRDDのプロジェクト正本へ意味または注記を加える。
- 計画／能力／予測: 作業評価、依存関係、複雑性／不確実性、必要推論、並列化可能性、エージェント能力、利用枠、人間判断能力、実行見積、予測および再計画を、第2段階の実測から必要な範囲で評価する。
- リスク／Issue／Topic: リスク、Issue、不足、依存競合、方向競合および判断待ちを、人間が確認すべき意味単位へ整理する。
- 人間判断／MTG: AIだけで決定できないTopicを人間へ返し、複数人の議論が必要な場合に会議へ接続し、判断をCRDDと作業再評価へ戻す。
- プロジェクト状況理解: 「現在の停止要因は何か」「予定どおり終わるか」「先週から何が変わったか」「人間判断待ちは何か」「次の会議で扱うべきことは何か」等へ根拠付きで回答する。

Qual-Planner、Qual-TopicおよびQual-MTGは、それぞれ独立したプロジェクト正本を持つものとして確定しない。次のようにCRDDの同じプロジェクト正本を異なる専門接続面から利用する候補として評価する。

```text
CRDD          → プロジェクト正本 / コンテキスト / 判断 / 根拠
Coordinator   → AI開発チームの実行
Qual-Planner  → 計画 / 能力 / 予測の接続面
Qual-Topic    → 人間の注意 / Topicの接続面
Qual-MTG      → 人間の議論 / 判断の接続面
```

### 7.5. 第4段階（Phase 4）— 協働接続面

到達目標は、人間、AIおよび外部ツールが同じプロジェクト運営へ参加できる協働接続面（Collaborator Interface）を評価することである。MCP／Runtime API、Slack、Web、IDE、CodexまたはClaude Code等は入口候補であり、採用または利用許可を意味しない。

読み取りと書き込みを同一の決定権限にせず、書き込みはRepositoryを直接変更する経路ではなく、`意図 → 影響分析 → 作業／CHG → Coordinator → 実行`を基本候補とする。Branch／Worktree等をRuntime内部の実行隔離へ隠蔽できるかも、実測後に評価する。

Transportは外部接続境界から同じProject Runtime／Coordinator Contractへ到達させる候補とし、MCP ServerがRepositoryを直接操作する構造へしない。Repositoryは既定拒否と明示登録を基本に、Path文字列だけでなくcanonical Identity、Filesystem Identity、選択利用者およびPolicyを再確認して接続する。置換、symlink／junction、競合または観測不能時はBindingしない。

### 7.6. 第5段階（Phase 5）— プロジェクトRuntime

到達目標は、プロジェクトが常時作業を受け付けられるプロジェクト実行環境（Project Runtime）を評価することである。候補構成にはCRDDリポジトリ、プロジェクト運営、MCP／Runtime API、Coordinator、キュー／スケジューラー、プロバイダー実行環境、ビルド／テストおよびプロジェクト状態がある。

AI作業者を24時間実行し続けることを要件にせず、24時間待機でき、作業が発生したときだけ必要なAI作業者を起動する構造を候補とする。常駐サービス、スケジューラー、プロバイダー利用、API、追加課金または自律的な外部作用は別の決定権限と人間判断なしに有効化しない。

長期候補には、Linux Server上の常設RuntimeへMCP／Runtime Interfaceから接続し、Repository Routerを介して明示登録済みProjectだけを実行するRemote構成を含む。人間はChatGPT、Qual、Slack、Browserその他のClientを指示・確認Surfaceとして利用し、重要判断だけを返せる状態を評価する。Remote Host、Network、Tenant、認証、暗号化、replay防止、情報保持、監査、取消および運用責任は新しいTrust Boundaryであり、再設計するまで無効とする。

Self-hosted LLMもProvider Adapter候補へ接続できるかを評価する。Frontier Modelの置換を目的とせず、Taskの複雑性、情報分類、費用、必要な確信度および運用責任から、Managed Cloud、Private Cloud、社内GPUまたはLocalhostを選択できる可能性を調べる。Host、Model、配布物、更新、保持／削除、Log、学習利用、隔離および外部送信を着手時に再評価し、正式な認証とAuthorityを省略しない。

### 7.7. 第6段階（Phase 6）— 複数プロジェクト／組織実行環境

到達目標は、複数プロジェクトをAIネイティブに運営する複数プロジェクト／組織実行環境（Multi-Project／Organization Runtime）を評価することである。組織側へ各プロジェクトの詳細コンテキストを複製せず、状態、マイルストーン、進捗、予測、リスク、Issue、判断待ちおよび依存関係等のポートフォリオ投影（Portfolio Projection）を取得する候補を評価する。

「遅延しそうなプロジェクトはどれか」「人間判断待ちは何か」「どこへAI能力を追加すべきか」「経営会議で扱うTopicは何か」等の横断判断へ根拠を提供できるかを検証する。プロジェクト間の決定権限、情報分類、アクセス、費用および組織の決定権限は未設計であり、この候補から推定しない。

候補構造は`MCP／API → Organization Runtime → Repository Router → Project Runtime → Coordinator`とし、Project単位でContext、Authority、Runtime State、Lock、Capability namespace、EvidenceおよびRecoveryを分離する。`repository_id`、`project_id`および`organization_id`の安定識別を評価するが、上位scopeから下位ProjectへのAuthority、CredentialまたはRecoveryを暗黙継承しない。複数RepositoryにまたがるEffectは、部分成功、取消、再開およびexact recoveryを設計するまで非対応とする。

### 7.8. 研究候補と保持条件

作業評価、推論経路選択、能力モデル、Capability Routing、意味競合検出、意味範囲ロック、自律再計画、キュー／スケジューラーおよびポートフォリオ投影は、各段階を具体化するときの研究・実装候補である。Capability Routingはambient authorityを許さず、発行主体、対象Project、操作、期限、単回性、委譲時の減衰、取消および再利用拒否を説明可能にする。

全段階で次を保持する。

- AIには専門実務と検証を、人間にはアイデア、価値、方向、重要判断および責任を置く。[`04_Agent_Organization.md`](../04_Agent_Organization.md)が所有する許可範囲、決定権限、リスク受容、公開およびリリースの境界を再定義しない。
- プロジェクト正本、コンテキスト、判断および根拠を新しい進捗正本や外部接続面へ重複させない。
- [`05_Autonomous_Operation.md`](../05_Autonomous_Operation.md)が所有するオペレーション、再評価、安全、キュー／スケジューラー候補および人間接続の意味を再定義しない。
- 予測より先に実行事実を観測し、根拠から必要なモデルだけを育てる。
- 各段階の開始時に、現行性、価値、実現性、費用、セキュリティ、プライバシー、決定権限、利用側、移行および人間判断を再確認する。
- 段階番号または順序だけから、固定作業手順、前段の完全終了、実装着手、スキーマ、API、プロバイダー、課金、T3／T4強化、採用またはリリースを推定しない。
- Remote Runtime、MCP内容、外部応答またはProvider OutputをAuthorityとして扱わず、Prompt InjectionやTool指示からEffect権限を生成しない。T1～T2のBaselineを超えるTrust Boundaryが必要になれば、Threat Model、変更分類および人間判断へ戻す。

### 7.9. CRDD版の発展（Version Evolution）と責務分離

PhaseとVersionは直交する。Phaseは価値と能力を探索し、根拠から再評価する順序である。Versionは[`19_Maintenance.md`](../19_Maintenance.md#51-release-version-and-revision)が所有する公開差分、互換性および基準版の識別である。一つのPhaseが複数Versionにまたがることも、一つのVersionが個別に採用された複数Phaseの要素を含むこともある。Phase番号からVersionを、Version表示から収載、期限、互換性、Candidate状態またはReleaseを推定しない。

次の表は既存§7.2～§7.8を、人間が理解しやすい能力到達点へ投影した対応表である。CRDD v0.18.0と採用入口を是正したv0.18.1は内容採用・main統合・公開を完了した。個別の完成根拠はCHGと品質記録を用い、収載や統合だけからリリースを推定しない。v0.19.0は2026-09-01に§8の限定範囲を採用した。v1.0.0以降は将来の能力地平（Capability Horizon）であってRelease targetの予約ではなく、実現時の根拠と採用済み差分に応じて別のVersionへ再割当できる。

| 表示 | 能力像 | 判断／対応状態 | 再評価契機 | この表示が意味しないこと |
|---|---|---|---|---|
| CRDD v0.18.0 — 公開済み基準 | CRDD Methodology、Agent OrganizationおよびCoordinator Runtime 1.0 | 内容採用・main統合・公開済み | CHG-000014の公開記録とCHG-000015の完成根拠 | v0.18.1の公式Release識別子または将来候補の採用 |
| CRDD v0.18.0 — 自己適用で完了した改善 | §7.3.1～§7.3.3の工程接続、アーキテクチャ追跡可能性（Architecture Traceability）、システム結合試験、Repository構成および文書の意味可読性 | 採用した対象の実装検証・内容採用は完了（[CHG-000055](../90_Release/Changes/CHG-000055_CRDD_Long_Term_Evolution_Roadmap.md)） | 根拠を保持し、リリースへ引き渡す | 総合的な性能優位、Releaseまたはv0.19.0以降の研究候補の収載 |
| CRDD v0.19.0 | MCPの薄い協働接続面、単一Project／Repository、Objective Planning、Task Graph、最大5並列、Progress、Replanning、Integration、および工程内ReasoningのContext化を自己適用する | `Adopted / In Progress`（[§8](#v019-minimum-project-runtime)、[§9](#v019-reasoning-context)、[CHG-000057](../90_Release/Changes/CHG-000057_Minimum_AI_Native_Project_Runtime.md)、[CHG-000058](../90_Release/Changes/CHG-000058_Reasoning_Context_and_Design_Intent.md)） | Project Runtimeの工程設計・実装・E2E・Utility評価と、認知推論／選択推論の代表経路による自己適用および独立Closure | 複数Project／Repository、常設自律Runtime、専用PM System、Organization Runtime、全工程共通の固定Reasoning Schema |
| CRDD v1.0.0（将来能力像） | 単一Projectで`Context → Understanding → Decision → Execution → Verification → Context Update`の閉ループを、人間とAIの組織（Human × AI Organization）で成立させる | `Held / Unscheduled` | 協働接続面とエコシステム自己適用から、単一Projectの成立性、安全性および利用者価値を確認 | 対象版、期限、完全自律、人間のAuthority移譲または固定製品構成 |
| CRDD v1.x（将来能力像） | 単一Projectの運営モデル（Operating Model）を保ったまま、安全性、速度、費用、Remote利用、Platform／Provider非依存性、Self-hosted Providerおよび専門Skillを成熟させる | `Held / Unscheduled` | v1能力の実利用Evidenceと、個別候補ごとの人間判断 | Linux、macOS、Remote、Self-hostedその他の全候補を同じVersionへ収載する約束 |
| CRDD v2.x（将来能力像） | 調整と最適化の観測範囲をProjectから複数Project／Organizationへ広げ、依存、優先順位、Capacity、Riskおよび投資判断へ根拠を提供する | `Held / Unscheduled` | 単一Project境界の成熟と、Organization Scopeの価値、情報、安全およびAuthority設計 | Project Authorityの上位継承、横断Effect、予算消費、優先順位変更、Provider起動または外部送信の自動認可 |
| 将来（Future） | Product、Development、Operationその他のOrganization Contextを接続し、人間がCodeからFeature、Project、Portfolio、Organizationへ扱う抽象度を上げる | `Held / Unscheduled` | 前段の実測から新しい利用者価値または責務候補が生じ、人間が探索開始を判断した時点 | 一人企業OS（One-Person Company OS）の製品要件、Release計画または無制限のAI Authority |

v2能力地平でも、Project単位のContext、Policy、Credential、Capability、Runtime State、Recoveryおよび費用を分離する。Organization Runtime候補は、明示委任されたProject、操作、期間および最小情報投影だけを扱う。横断最適化は既定で助言と計画候補に限り、Project Effectまたは費用を自動認可しない。情報分類、目的制限、保持、監査、競合解決および人間判断を実装前に設計する。

専門性はAgent側、個別Projectの正本情報はそのProjectのCRDD正本成果物、実行はRuntime、協働接続面は意図と結果の搬送を担う。Project Management、QA、Planning、Architecture、Discoveryその他の能力が必要な場合は、まず既存Contextを整え、Role／Skillを持つAgentで隔離した自己適用を行う。具体的なPM機能、UI、Project Runtime統合等は不採用ではなく§7.4以降の研究候補であり、この能力投影から採用または実装許可を得ない。

責務分離は、次の根拠駆動ループで評価する。

```text
既存Context + Role／Skillで自己適用
  ↓
不足、反復Finding、責務集中および失敗影響を観測
  ↓
安定した責務境界の候補を作る
  ↓
Authority、安全、Recoveryおよび互換性を契約と試験へ接続
  ↓
抽出、既存境界での保持または共有責務境界の変更候補を人間が判断
  ↓
再観測
```

CRDDの共有責務境界を太らせないことは、その変更の絶対禁止ではない。複数のRole／Skillから共有すべき正本情報、横断的不変条件、Authorityまたは整合性を一意に所有する必要があり、Role、SkillまたはAdapterでは安全に閉じないとEvidenceから確認された場合だけ、責務を持つ正本の共有責務境界変更候補へ戻す。候補化は採用、共通規則化、現Runtime変更またはRelease根拠への自動昇格ではなく、変更分類、利用側、互換性、移行、Recovery、必要な監査および人間判断を別途要求する。

未解決事項は、第2段階で何を最小観測とするか、Qualシリーズの各Repositoryが同じプロジェクト正本へ接続できるか、第3段階以降の利用者価値と成立性、および各段階を独立した変更へ分ける境界である。次の再評価契機は、第1段階の完成固定版と、第2段階の最初の自己適用根拠である。

<a id="v019-minimum-project-runtime"></a>

## 8. v0.19 Minimum AI-native Project Runtime

### 8.1. 採用判断と目的

2026-09-01、v0.18.0の公開と正式署名4経路E2Eの成立後、人間の決定権限者は、限定分散候補と協働接続面候補を`v0.19.0`の一つの変更意図へ収載した。v0.18.1で新規採用入口とRuntime実行Identityを是正したSingle Task Runtimeを作り直すのではなく実行単位として再利用し、人間が個々のTaskではなく一つのMilestoneを委ねられる最小のProject Runtimeを成立させる。

### 8.2. 対象境界

対象は、1 Project、1 Repository、1 Parent Coordinator、人間起点のMilestone、複数Objective、任意数のTask、最大同時実行数5とする。MCPはProject Runtimeへの薄い外部接続面であり、独自のProject正本、AuthorityまたはRepository操作主体にしない。Project Runtimeは既存CRDD正本からProject、Milestone、ObjectiveおよびTaskを理解し、Task Graph、実行可能性、進捗、部分再計画、人間への判断移送および統合後受入を管理する。

成功単位は個別Taskの合格や並列起動数ではなく、統合済みのObjectiveまたはMilestoneが受入条件を満たすこととする。常に5並列せず、Dependency、共有資源、ファイル・仕様・判断の競合、Authority、Lock、Provider利用枠および統合境界から実効並行度を決める。進捗率はMilestoneへCommitした項目の完了数だけで算出し、Quality、Blocker、Risk、Human Decision、Critical Pathおよび未確認事項を別に示す。

複数Project、複数Repository、Organization Runtime、常設自律運転、Schedule／Repository Event起点の自動Objective生成、無制限Worker Pool、完全自動Quota最適化、Self-hosted Provider、Linux／macOS Runtimeおよび外部課題管理との本格同期は対象外である。これらをv0.19の内部Taskとして追加せず、現在の受入条件へ必要か不明な改善は不足Evidenceを確認してからCurrent Scopeまたは将来候補へ分ける。

### 8.3. 実施と自己適用

Discovery、UX、IA、UI、SPECおよびArchitectureでProject Runtime全体を先に設計し、その結果からCoordinatorの責務分離を導出する。続いてMCPの薄い縦断経路、Project階層、Task Graph／Scheduler、複数Task実行、進捗投影、再計画／判断移送、統合検証を接続する。

CRDD v0.19自身を代表Milestoneとして自己適用し、採用可能な結果までの時間、人間の実作業時間、AI処理量、待機、統合費用、競合、再試行、再計画、判断移送、Provider利用および後工程品質を観測する。並列化やAgent数そのものを成功指標にしない。

<a id="v019-reasoning-context"></a>

## 9. v0.19 推論コンテキストと設計意図

### 9.1. 採用した方向

2026-09-02、人間の決定権限者は、工程成果物へ吸収されると失われる熟練者の判断根拠を、再利用・変更・検証可能な推論コンテキスト（Reasoning Context）として扱う強化をv0.19へ追加した。共通化する候補は、根拠、解釈、仮説、代替、意図、不確実性、制約、トレードオフ、判断、判断理由、観測結果および学びである。これらを固定Schemaまたは全工程必須のTemplateにはしない。

### 9.2. 代表的な2つの検証経路

- 認知推論（Cognitive Reasoning）: UX、IA、UIおよびCommunicationで、利用者の現在状態、障壁／不確実性、必要な認知変化、必要な根拠／情報、目標状態、判断／行動および観測結果を接続する。
- 選択推論（Choice Reasoning）: Discovery、プロダクト方向およびCommunicationとの境界で、機会候補、判断状況、判断を変える比較観点、根拠／確信度、代替、トレードオフ、対象選択、位置づけ仮説、採用する解決方向および人間判断を接続する。

認知推論をCRDD全体の唯一のReasoning Modelにしない。Architecture、Quality、Operationその他の工程固有パターンは、代表2経路の自己適用で共通要素の有用性と負荷が確認されてから、現在の責務を持つ正本で別途評価する。

### 9.3. 責務境界と検証

Discoveryは機会、対象選択、価値、既存代替、差別化根拠および採用する解決方向を所有する。Communicationは外部で用いる比較枠、形成したい理解、主張、メッセージ、成果物および媒体を所有する。UXは認知意図、IAは必要な根拠／情報の関係・開示・構造、UIは注意・視覚階層・操作・フィードバックへの具体化を所有する。位置づけは責務を接続する推論レンズであり、第二正本ではない。

検証では、推論コンテキストがAIの変更判断と工程間伝播を改善するか、判断の逆方向追跡に実用価値があるか、記録負荷が再利用価値を上回らないかを、代表2経路で自己適用する。完全な連鎖、内部推論全文、固定点数、固定質問票、工程ごとの専用ファイルまたは新しいReasoning Databaseは目指さない。

<a id="v020-execution-intelligence"></a>

## 10. v0.20 実行知（Execution Intelligence）

### 10.1. 採用した目的

2026-09-03、人間の決定権限者は、CRDD RuntimeおよびCRDD採用Repositoryで明示的なWorkへ結合したAI実行を、仕事の単位で観測・評価し、次の改善候補へ還元する実行知（Execution Intelligence）をv0.20の能力として進める方向を採用した。目的はLLM呼出し監視製品の複製や豪華なDashboardではなく、AI組織がどのContextと入力戦略を使い、何を実行し、何が受け入れられ、人間・運用・事業へどの結果を生み、次に何を変えるべきかを根拠から判断できることである。

観測の主IdentityはLLM requestではなく、Project、Milestone、Objective、TaskおよびAttemptとする。Provider／Model、Role、Context参照、入力戦略、時間、利用量、再試行、再計画、検証、人間介入、候補・採用および結果を必要な範囲で下位実行へ結合する。Promptだけを原因や最適化対象にせず、Runtime Rule、CRDD Context、Role／Skill、Task Packet、人間の指示、Tool Capabilityおよび会話Contextから成るAI入力構成を評価する。

### 10.2. 評価階層と改善Loop

評価は次の階層を混同しない。

1. 実行効率: AI実行が正常・効率的だったか。
2. 成果物品質: 成果物が要求と必須品質を満たしたか。
3. 人間による受入: 人間がどれだけ介入せず利用できたか。
4. 運用成果: 実際の仕事やプロダクトで望む変化が起きたか。
5. 事業成果: 顧客、事業または組織へ価値が生じたか。

すべてのTaskへ第5層を要求せず、対象Workで説明・観測可能な階層までを評価の適用範囲として明示する。欠測は`unknown`、`not_observed`、`not_applicable`等で区別し、0や失敗へ補正しない。相関を因果へ強めず、対象期間、結果Source、帰属の不確実性および外部要因を示す。事業結果や人間の好みは、安全性、Security、Complianceおよび必須品質を上書きしない。

実行履歴から、Provider／Model／Role、Context選択、入力戦略、Task粒度、並行度、検証およびAgent Organizationの改善候補を生成できる。ただし観測から直接標準やRuntimeを自己変更しない。`観測 → 評価 → 分析 → 改善候補 → 人間判断 → 実験 → 評価 → 採用／不採用`を基本Loopとし、母数、Task Class、Context成熟度、比較対象、期間、品質、人間の実作業時間、費用およびRiskを確認する。Providerを単純順位づけせず、Task Type × Context Maturity × Input Strategy × Provider × Modelの条件付き仮説として扱う。

### 10.3. 保存・保持・正本への昇格

高頻度の実行記録はGitへ継続保存しない。Local Personal ProfileではRepository Root直下のGit管理外`.crdd/execution/`を候補とし、短期buffer、構造化履歴、既定OFF・短期保持のRaw情報、および再生成可能な一時データを責務別に分ける。通常会話を無条件収集せず、CRDD Workとして明示Bindingした実行だけを既定の観測対象とする。Runtimeを介さない手動AI Sessionも将来候補にできるが、人間がProject／Objectiveへ明示的に結合した範囲だけを扱い、通常会話の自動収集へ広げない。保持期間、件数、容量および整理方針を設定可能にし、Storage実装は将来の共有Databaseへ交換できるようEvent意味から分離する。

集約と正本への昇格（Promotion）を分ける。Git管理外の実行履歴保存先（Execution Store）は何が起きたかを保持し、CRDD Repositoryは長期的に再利用するFinding、Decision、Strategy、Experiment Resultおよび変更理由だけを人間判断と変更契約を経て保持する。集約は一定期間だけに固定せず、一定件数・容量、Objective／Milestone／Experiment／Releaseの完了等、判断価値が生じる区切りを候補とする。全Prompt、全Response、個別Token／Latency、高頻度Tool logおよびIntermediate AnalysisをGitの正本にしない。秘密、個人情報、Provider保持条件および情報分類を観測前に確認し、Raw情報がなくても分析できる構造化metadataを優先する。

### 10.4. v0.20の最小境界

v0.20では実行知全体の完成を前提としない。最初の対象は、共通Event契約、Work Identity、Provider／Model Identity、入力戦略参照、時間・利用量、人間の実作業時間、検証・受入、Project Stateへの投影、および判断に必要な最小Viewer／分析とする。CRDD標準はEvent・Metric・評価・Evidenceの意味を所有し、各Runtime／ApplicationはTelemetry発行、Collector／Storeは履歴、Viewer／Analyzerは比較、Optimizerは改善候補を所有する。Coordinator専用契約にせず、CRDD採用Repositoryや他のRuntimeが同じ意味へ接続できる境界を設計する。

運用成果（Operational Outcome）／事業成果（Business Result）は、目的との関係、結果Source、観測期間、帰属不確実性、取得費用およびPrivacy／Securityが成立する適用先から段階的に接続する。外部Sourceの事業データをCRDDへ複製せず、安定参照と必要な評価結果だけを保持する。初期自己適用では、CRDD自身のProject Runtime、Communication Repositoryおよび外部AI APIを使う採用先候補から、Eventの十分性、人間時間の測定可能性、入力戦略比較、Provider差および結果接続の実用性を検証する。

未決事項は、最小Event集合、同意・情報分類、保持Policy、Human Active Timeの測定方法、外部利用量の信頼境界、評価者の自己参照、実験の十分性、Viewerの形および事業結果接続の最初の適用先である。これらはv0.20設計開始時にEvidenceと利用側から具体化し、109項目相当の構想を一括Schemaや巨大Applicationへ先行固定しない。

<a id="v020-mcp-streamable-http"></a>

## 11. v0.20 MCP Streamable HTTP接続

### 11.1. 採用した目的

2026-09-05、人間の決定権限者は、v0.19で成立したMCP stdioの薄い協働接続面を、MCP Streamable HTTPからも利用できるようにする作業意図をv0.20へ採用した。目的は新しいProject Runtimeを別に作ることではなく、Transport固有処理を外部接続境界へ閉じ、stdioとHTTPが同じProject Runtimeの意味契約、結果契約、安全境界およびRecovery契約へ到達できるようにすることである。

HTTP接続の存在からProject Authority、Repository操作権限、Human Authority、成功またはRecovery Authorityを生成しない。MCP ServerはRepositoryを直接操作せず、検証済みのProject／Repository Identity、選択利用者、Policyおよび要求操作をProject Runtimeで再検証する。公開結果は既存のcanonicalな結果投影から生成し、Transportごとに同じ意味を再定義しない。

### 11.2. v0.20で具体化する境界

設計開始時に、少なくとも次を既存のstdio経路と対比して具体化する。

- 利用者Journey、Client、接続先、待受範囲および対応Platform。
- 認証、Session、接続・切断、取消、timeout、再送・重複、順序およびreplay防止。
- Repository Binding、情報分類、入力最小化、結果投影および監査可能な相関Identity。
- Process、socket、stream、request、Sessionその他の資源所有、上限、終了条件、cleanupおよびRecovery。
- 正常・準正常・異常経路、stdioとの意味同等性、公開入口からの結合試験／総合試験および回帰試験。

具体的なFramework、待受port、配布方式および運用形態はArchitectureで選択する。v0.20の実装・検証範囲は同じHostの`localhost`接続に限定し、LAN、InternetまたはRemote Hostから到達可能なlistenを成立済みとしない。Linux／macOSへ同じ機構を要求せず、Transportの意味契約と安全保証をPlatform固有実装から分離する。

### 11.3. 採用していない範囲

本採用単独では、LAN／Internetへの公開、Remote Hostでの常設運用、複数Repository、Organization Runtime、Self-hosted Provider、追加Credentialの保管、API key課金、無人の外部EffectまたはProject Authorityの上位継承を意味しない。Linux対応とRemote構成は§12の保留候補とし、TransportのPlatform非依存設計だけを現在の完成条件へ残す。その他も個別の価値、Trust Boundary、運用責任および人間判断を必要とする別候補として保持する。

v0.20での正確な実装範囲と完成条件は、Current State、利用側、脅威、対応Platformおよび既存MCP契約を再確認した変更トレースで固定する。MCP Streamable HTTPが起動したこと、接続できたこと、または一部Methodが応答したことだけから、協働接続面全体の完成を主張しない。

<a id="v020-linux-remote-runtime"></a>

## 12. Linux対応とRemote Runtimeの将来候補

### 12.1. 現在の処置

2026-09-05、人間の決定権限者は、Project RuntimeのLinux対応と、Linux Host上のRuntimeを別Clientから利用する限定Remote構成を一度v0.20作業意図へ採用した。その後、Runtime責務分離、限定分散実行、Project State投影およびMCP Streamable HTTPの初回実装と同時に、新しいPlatform実装とRemote Trust Boundaryまで扱うと完成条件と原因分離が過大になると判断し、v0.20の固定範囲から除外した。

現在状態は`Held / Unscheduled`であり、特定の次版、期限、実装着手またはReleaseを予約しない。v0.20のローカルMCP Streamable HTTP、Project State投影および限定分散実行が完了し、分離後のProject Runtime lifecycleと公開契約が安定したことを再評価契機とする。v0.20ではCoreのPlatform非依存、Transport分離およびWindows固有処理のAdapter内への封じ込めを維持するが、それらをLinux対応済みまたはRemote運用可能の根拠にしない。

### 12.2. 同じ保証と新しい境界

Linux対応はWindowsのAPIやDocker Desktop固有方式を移植せず、Project Runtime Coreが要求するPrincipal／Provider Home、Filesystem／Repository、Lock／Lease、Process／取消、Container Host、Runtime Root／RecoveryおよびEvidenceの保証をLinuxの実環境で成立させる。要求発行、handle取得、受理、Effect成立、終了通知、観測および耐久的確定を区別し、Linux上の実Processと実Filesystemで正常・準正常・異常を検証する。

Remote構成では、Remote Host、Network、認証、暗号化、接続先Identity、replay防止、Session／request相関、情報保持、監査、取消、切断後の処置、更新、停止、Recoveryおよび運用責任を新しいTrust Boundaryとして設計する。ClientやTransportからProject Authority、Credential、CapabilityまたはRecovery Authorityを暗黙継承しない。最初の対象は明示構成した単一Project／Repositoryとし、Repositoryの自動探索や複数Repository運営を完成条件にしない。

### 12.3. 分離して保持する候補

macOS対応はLinux対応の完了から推定せず、別の成果物、Build、署名Identity、検証母集団およびRelease判断を必要とする将来候補として保持する。Self-hosted ProviderもProvider Adapterの将来候補に留め、LinuxまたはRemote構成の成立条件へ混ぜない。Internet一般公開、Organization Runtime、Cross-project schedulingおよび無人の外部Effectもv0.20の本採用には含めない。

具体的な対応Linux、配布・更新方法、Host配置、Client、Network範囲、認証方式、運用責任および本番同等E2Eは、専門探索と脅威確認を行った変更トレースで固定する。一部のLinux契約試験、HTTP応答またはRemote Process起動だけから、Linux対応またはRemote Runtime全体の完成を主張しない。

<a id="v020-read-only-project-state-projection"></a>

## 13. v0.20 Project Stateの読み取り専用投影

### 13.1. 採用した目的

2026-09-05、人間の決定権限者は、Project Runtimeが既に所有する状態とv0.20の実行知を、利用者が内部TaskやAgent Logを追わずに確認できる読み取り専用のProject State投影をv0.20へ採用した。目的は新しいProject Management正本を作ることではなく、MCP stdio／HTTPおよび将来の最小Viewerが、現在の進行、実行中Task、停止理由、人間判断待ち、Recovery義務および統合結果を同じcanonicalな意味から取得できることである。

### 13.2. 投影の境界

投影はProject Runtimeの現在状態と許可された実行知を参照する非Authorityの読み取り結果である。Projection、Client metadata、表示状態または取得回数から、Task、計画、判断、Authority、Recovery Authority、成功、受入または正本変更を生成しない。古い状態、未観測、取得不能、非該当および解消済み履歴を区別し、欠測を0、正常または現在の阻害へ補正しない。

最小field、現行性とRevision、Project／Milestone／Objectiveとの相関、情報分類、取得主体、公開可能範囲およびstdio／HTTP間の意味同等性は、v0.20の変更トレースで具体化する。内部Path、Credential、Provider生出力、秘密のCapabilityまたは境界外のProject存在を公開しない。

### 13.3. 採用していない範囲

本採用は、手入力するWBS／進捗率、独立したProject Management Database、予測、Portfolio、Topic管理、会議管理またはProject状態からの自動実行を含まない。これらを扱うフルのProject Management Projectionは探索中の別候補に留め、読み取り専用投影の存在から採用を推定しない。

一部fieldの取得や画面表示だけで完成を主張せず、実producerからcanonicalなProject State、公開投影、MCP stdio／HTTP consumerまでの縦断、状態の現行性、閉じたSchema、権限制御、unknown、取消、Recoveryおよび終了後観測を検証する。
