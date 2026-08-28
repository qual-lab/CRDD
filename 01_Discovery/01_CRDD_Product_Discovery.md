# CRDD標準自身の課題探索・要求形成

工程規則: [`21_Discovery.md`](../21_Discovery.md)
維持責任者: Qual-Lab
項目の決定権限: Qual-Lab
対象改訂版: 2026-08-25に人間が採用した上流工程強化方針および長期発展方針、2026-08-28に追加採用した第2段階の改善意図、将来Runtime Architecture候補、能力到達点の投影および根拠駆動の責務分離原則
現在状態: 項目別。§1～§6の上流工程強化、§7.3.1～§7.3.3の改善意図および§7.9の責務分離原則は`Adopted / Planned`、§7.1の上位方向は`Adopted / Unscheduled`、§7.2のCoordinator Runtime 1.0は`In Progress`（CHG-000015）、第2段階に残る未採用の実行観測候補、§7.4～§7.8の個別研究候補および§7.9の将来能力地平は`Held / Unscheduled`

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

並行して、課題探索・要求形成、UX、IA、UI、アーキテクチャ、実装、検証および外部コミュニケーション等の専門工程を自己適用する。第1の入口は本書1章から6章に記録した課題探索対話ループと上流工程エージェント強化であり、開始条件はCoordinator Runtime 1.0の正式署名一般タスク実行、完成固定版および人間による着手判断である。ここで得た実績を、後続の計画／能力設計候補の根拠にする。

§7.3.1～§7.3.3では、改善へ着手する作業意図を採用している。個別の観測Schema、工程、Architecture境界、Adapter、実装順または互換性は採用済みではなく、Runtime 1.0の完成後に得る根拠から再評価する。

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

これは新しい固定工程または全対象への完全Runtime契約を直ちに追加する判断ではない。既存の振る舞い仕様、アーキテクチャ、品質保証および検証工程の責務を、対象の境界、資源、Authority、Effectおよび失敗影響に比例して強化する。単純なローカル処理へ存在しない回復状態や外部Authorityを作らない。Coordinatorの機械可読Traceは有効性を自己適用で確認するReference Candidateであり、実効性が確認できた要素だけを共通規則へ昇格する。

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

Coordinator固有の状態、Lock、Named Pipe、Dockerおよび回復設計は`tools/coordinator/architecture/`に置き、CRDD全体へ再利用できる原則だけを`04_Agent_Organization.md`その他の責務を持つルート正本へ昇格する。Reference Runtimeの増加を理由に、CRDDルートを実装Component一覧へ変えない。

採用したのは、Runtime 1.0完成後に反復Finding、責務集中、変更頻度、Failure Patternおよび運用Evidenceから安定境界を抽出する作業意図である。上記の境界名、分割方式および将来利用側は候補であり、実測されていない抽象化を先に固定しない。

#### 7.3.3. 人間可読文書の意味構造改善候補

CRDD文書は条件と例外を一文へ高密度に保持する傾向があり、意味精度を維持する一方で、人間、AIおよびGit差分からの理解を難しくする場合がある。意味を簡略化せず、一段落を一つの意味単位、箇条書きを一つの責務とし、規則、条件、例外、対応関係、状態および流れをMarkdown構造へ一致させる改善を評価する。

対象は新規文書だけでなく、現行配布系列から参照する既存正本、README、監査文書および過去のCHGを含む。Released CHGも可読性棚卸しから除外しないが、公開済みtagを変更せず、変更ID、判断、当時の状態、根拠、Evidence、参照関係および時系列を保持する。本文を情報欠落なく再構成できる場合は現行系列で表現を改善し、履歴本文を直接変えると意味または不変参照を損なう場合は、読者向け投影、索引または補助説明を用いる。

対象全件を機械的に一括書換えせず、利用頻度、誤読影響、密度および変更頻度から優先順位を決める。確認は既存の文書監査と不足／影響監査を使用し、新しい監査種別を存在だけで追加しない。人間の理解、AIによる意味保持およびGit差分の追跡可能性を評価し、表現の好みではなく判断、実装、検証、移行またはリスク理解へ影響する箇所を対象にする。

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

### 7.9. CRDD Version Evolutionと責務分離

PhaseとVersionは直交する。Phaseは価値と能力を探索し、根拠から再評価する順序である。Versionは[`19_Maintenance.md`](../19_Maintenance.md#51-release-version-and-revision)が所有する公開差分、互換性および基準版の識別である。一つのPhaseが複数Versionにまたがることも、一つのVersionが個別に採用された複数Phaseの要素を含むこともある。Phase番号からVersionを、Version表示から収載、期限、互換性、Candidate状態またはReleaseを推定しない。

次の表は既存§7.2～§7.8を、人間が理解しやすい能力到達点へ投影した対応表である。`CRDD v0.18.0 Candidate`以外は将来の能力地平（Capability Horizon）であり、Release targetの予約ではない。実現時の根拠と採用済み差分に応じ、別のVersionへ再割当できる。

| 表示 | 能力像 | 判断／対応状態 | 再評価契機 | この表示が意味しないこと |
|---|---|---|---|---|
| CRDD v0.18.0 Candidate | MethodologyとCoordinator Runtime 1.0をCRDD自身へ適用し、工程接続、Architecture Traceability、システム結合試験、Repository構成および文書の意味可読性を成熟させる | 項目別。RuntimeとRelease準備は`In Progress`、採用済み第2段階改善は`Planned` | CHG-000015の完成固定、工程強化の自己適用、未終了CHGおよびRelease Readinessの確認 | 現在の未完了項目の完了、Stable化またはRelease |
| CRDD v0.19.0（将来能力像） | MCP等の協働接続面、Repository Binding／Router、Runtime境界およびCRDDの機械利用性を自己適用し、v1能力到達性を評価するEcosystem dogfooding | `Held / Unscheduled` | v0.18.0の結果と、第2段階で得た最初の自己適用Evidenceを人間が再評価 | v0.19.0への収載予約、Release Candidate、専用PM Systemまたは実装許可 |
| CRDD v1.0.0（将来能力像） | 単一Projectで`Context → Understanding → Decision → Execution → Verification → Context Update`の閉ループをHuman × AI Organizationで成立させる | `Held / Unscheduled` | 協働接続面とEcosystem dogfoodingから、単一Projectの成立性、安全性および利用者価値を確認 | 対象版、期限、完全自律、人間のAuthority移譲または固定製品構成 |
| CRDD v1.x（将来能力像） | 単一ProjectのOperating Modelを保ったまま、安全性、速度、費用、Remote利用、Platform／Provider非依存性、Self-hosted Providerおよび専門Skillを成熟させる | `Held / Unscheduled` | v1能力の実利用Evidenceと、個別候補ごとの人間判断 | Linux、Remote、Self-hostedその他の全候補を同じVersionへ収載する約束 |
| CRDD v2.x（将来能力像） | 調整と最適化の観測範囲をProjectから複数Project／Organizationへ広げ、依存、優先順位、Capacity、Riskおよび投資判断へ根拠を提供する | `Held / Unscheduled` | 単一Project境界の成熟と、Organization Scopeの価値、情報、安全およびAuthority設計 | Project Authorityの上位継承、横断Effect、予算消費、優先順位変更、Provider起動または外部送信の自動認可 |
| Future | Product、Development、Operationその他のOrganization Contextを接続し、人間がCodeからFeature、Project、Portfolio、Organizationへ扱う抽象度を上げる | `Held / Unscheduled` | 前段の実測と、人間が新しい責務境界を採用した時点 | One-Person Company OSの製品要件、Release計画または無制限のAI Authority |

v2能力地平でも、Project単位のContext、Policy、Credential、Capability、Runtime State、Recoveryおよび費用を分離する。Organization Runtime候補は、明示委任されたProject、操作、期間および最小情報投影だけを扱う。横断最適化は既定で助言と計画候補に限り、Project Effectまたは費用を自動認可しない。情報分類、目的制限、保持、監査、競合解決および人間判断を実装前に設計する。

専門性はAgent側、Project Truthは個別ProjectのCRDD正本成果物、実行はRuntime、協働接続面は意図と結果の搬送を担う。Project Management、QA、Planning、Architecture、Discoveryその他の能力が必要な場合は、まず既存Contextを整え、Role／Skillを持つAgentで隔離した自己適用を行う。具体的なPM機能、UI、Project Runtime統合等は不採用ではなく§7.4以降の研究候補であり、この能力投影から採用または実装許可を得ない。

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
抽出、既存境界での保持またはCore変更候補を人間が判断
  ↓
再観測
```

Coreを太らせないことは、Core変更の絶対禁止ではない。複数のRole／Skillから共有すべきProject Truth、横断的不変条件、Authorityまたは整合性を一意に所有する必要があり、Role、SkillまたはAdapterでは安全に閉じないとEvidenceから確認された場合だけ、責務を持つ正本のCore変更候補へ戻す。候補化は採用、共通規則化、現Runtime変更またはRelease根拠への自動昇格ではなく、変更分類、利用側、互換性、移行、Recovery、必要な監査および人間判断を別途要求する。

未解決事項は、第2段階で何を最小観測とするか、Qualシリーズの各Repositoryが同じプロジェクト正本へ接続できるか、第3段階以降の利用者価値と成立性、および各段階を独立した変更へ分ける境界である。次の再評価契機は、第1段階の完成固定版と、第2段階の最初の自己適用根拠である。
