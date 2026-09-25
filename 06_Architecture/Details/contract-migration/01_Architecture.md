# Canonical Contract移行の閉包設計

成果物種別: Architecture詳細設計
詳細設計領域: contract-migration
状態: Canonical
維持責任者: Qual-Lab

## 基本設計との関係

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000002](../../Definitions/ARCH-000002/architecture_definition.md) | Contractまたは責務移動時にProducer、全Consumer、派生物、署名・Release経路と旧契約禁止を一つの移行単位で閉じる。 | Covered |

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | Contract Owner、Producer、Consumer、派生物、Release経路を分ける。 | [§1](#1-移行単位) |
| Interface Model | Required | 旧／新Canonical Contractと変換境界を固定する。 | [§2](#2-consumer-closure) |
| Data Flow | Required | Producerから最終公開・回復利用側までの意味伝播を追跡する。 | [§2](#2-consumer-closure) |
| State Model | Required | inventoried、migrating、verified、retired、blockedを分ける。 | [§3](#3-状態と完了条件) |
| Sequence | Required | 棚卸し、移行、旧経路禁止、縦断反証の順序を固定する。 | [§3](#3-状態と完了条件) |
| Failure／Recovery | Required | Consumer取り残し、再解釈、移行中断を扱う。 | [§4](#4-失敗と再入場) |
| Deployment | N/A | 移行閉包は責務・契約の変更規律であり、特定Process配置を所有しない。 | [§1](#1-移行単位) |
| Observability | Required | 宣言集合、自動導出集合、差分、試験、旧参照0を観測する。 | [§2](#2-consumer-closure) |
| Security Boundary | Required | Canonical Path、Identity、StateをConsumer側で再解釈しない。 | [§4](#4-失敗と再入場) |
| Implementation Structure | Required | 設計責務を具象差、選択、状態依存、構成、資源Ownerおよび外部境界へ分解する。 | [§Implementation Structure](#implementation-structure) |

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS | 一つの固定改訂版を移行単位にし、旧／新候補の結果を混在させない。 | [§3](#3-状態と完了条件) |
| Timing | N/A | 期限ではなくConsumer集合と縦断反証の閉包を完了条件にする。 | [§3](#3-状態と完了条件) |
| Resource Lifecycle | N/A | Processや動的外部資源を所有せず、移行状態とEvidenceを追跡する。 | [§1](#1-移行単位) |
| External Boundary | PASS | 署名、Release、公開Transport、RecoveryもConsumer集合に含める。 | [§2](#2-consumer-closure) |
| Failure／Recovery | PASS | 中断時は未移行Consumerと旧契約禁止状態を保持し、同じ固定候補へ再入場する。 | [§4](#4-失敗と再入場) |
| State／Consistency | PASS | inventoried、migrating、verified、retired、blockedを分ける。 | [§3](#3-状態と完了条件) |
| Observability | PASS | 宣言集合、自動導出集合、差分、試験、旧参照0を観測する。 | [§2](#2-consumer-closure) |
| Security／Trust | PASS | Canonical Path、Identity、StateをConsumer側で再解釈しない。 | [§4](#4-失敗と再入場) |

結果語彙は次の意味に限定する。

- `PASS`: 詳細設計上の処置と根拠節が揃った状態。実装済み・試験済みを意味しない。
- `N/A`: Architecture上、そのConcern自体が存在しない状態。未検討や後工程送りを意味しない。
- `OPEN`: 未解決の設計事項が残る状態。
- `FAIL`: 必須設計と矛盾する、または必要な設計が未充足の状態。

## Qualityへの引渡し

| 導出キー | 設計項目種別 | 対象 | 正常条件 | 反証する失敗 | 主な試験段階 | 外部境界の段階 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|---|---|---|
| `contract-migration.consumer-closure` | Flow／Consistency | Owner、Producer、全Consumer、派生物、公開入口、署名・Release・Recovery | 宣言集合と自動導出集合が完全一致し、既知Consumerごとの試験がある | Registry記載漏れ、未知・重複、rare path、派生物・署名経路の取り残し | IT／ST | Related 2 Blocks | set差分、consumer test、旧参照検索 | 全Consumer移行前の旧処理削除0、旧参照0 | 意味妥当性は独立レビュー |
| `contract-migration.vertical-migration` | Sequence／Transition | Producerから公開／Release／Recovery | Canonical Path／Identity／Stateを再解釈せず同じSnapshot上で搬送 | path再構成、schema旧版、Snapshot混在、署名経路残存 | IT／ST | System/E2E | phase、snapshot identity、value identity、result | 新経路verified、旧経路retired | 外部実境界は該当IT／E2E |

導出キーは本領域内でQualityが同じ設計項目を反復参照するための局所参照であり、CRDD全体の安定コンテキストIDではない。

## 現行実装との照合

現行API、import、Manifest、試験とGit履歴は正式入力ではない。Canonical移行設計を固定した後、各Consumerを`Covered`、`Partial`、`Missing`、`Legacy`または`Implementation Detail`へ分類する。

## 1. 移行単位

```text
Changed Contract／Responsibility
  ├─ Owner
  ├─ Producer
  ├─ Runtime Consumer
  ├─ Public／Transport Consumer
  ├─ Derived Artifact
  ├─ Signing／Release Consumer
  └─ Recovery／Resume Consumer
```

変更ファイル集合ではなく、変更した意味を一次キーにする。移行開始前に旧契約、必要な保証、移行対象、変更禁止範囲と基準版Capabilityを固定する。

## 2. Consumer closure

手書きRegistryだけを正本にしない。宣言したConsumer集合と、Source、公開入口、Manifest、Release／Recovery経路から自動導出できる集合を比較する。差分は不整合であり、代表Consumerだけの試験で閉じない。

```text
Declared Consumers ─┐
                    ├─ exact set comparison ─→ per-consumer contract tests
Derived Consumers ──┘                              ↓
                                            public end-to-end rebuttal
```

## 3. 状態と完了条件

```text
inventoried → migrating → verified → retired
                   └──────── finding ─→ blocked／remediation
```

`verified`はProducer、全Consumer、派生物、公開・署名・Release・Recovery経路が新契約へ接続され、旧参照禁止検索と縦断反証がPassした場合だけ成立する。旧処理はその後に`retired`へ移す。

## 4. 失敗と再入場

- CanonicalなPath、Identity、StateをConsumerが別基準で再構成しない。
- 移行中断時は未処置Consumer、旧経路、適用済み範囲を保持する。
- Consumer追加で導出集合が変わった場合は、固定候補と閉包を再評価する。
- 安全に独立保留できないConsumerを将来改善へ退避しない。

## Implementation Structure

| 観点 | 適用 | 判定理由 | 成立させる構造 | 局所責務・不変条件 | 失敗・変更時の影響 | Qualityへの導出キー |
|---|---|---|---|---|---|---|
| Variation | Required | この観点を成立させる構造と責務が存在するため。 | Qualityへの引渡しで責務差を別の設計項目として固定する。 | 具象差を一つの分岐へ畳まず、各導出キーの正常条件と反証条件を保つ。 | 新しい具象を追加した場合、対応する導出キーと利用側の再確認が必要になる。 | `contract-migration.consumer-closure`<br>`contract-migration.vertical-migration` |
| Common Contract | Required | この観点を成立させる構造と責務が存在するため。 | 契約変更、利用側移行、旧契約除去と検証を、一つの移行集合と完了条件で扱う。 | すべてのConsumerを同じ対象改訂版と新旧契約対応へ接続し、部分移行を完了にしない。 | Consumer種別ごとの独自移行で旧契約、互換Shimまたは未検証利用側が残る。 | `contract-migration.consumer-closure`<br>`contract-migration.vertical-migration` |
| Creation／Selection | N/A | 本領域は独立した具象生成・選択責務を持たず、上位から固定入力を受ける。 | 本領域は独立した具象生成・選択責務を持たず、上位から固定入力を受ける。 | 生成・選択判断を本領域へ追加しない。 | 将来生成・選択責務を追加する場合に再評価する。 | N/A |
| State-dependent Behavior | Required | この観点を成立させる構造と責務が存在するため。 | 入力・処理中・完了・失敗・観測不能を区別して振る舞いを決める。 | 状態を空値や成功へ畳まず、同じIdentityで終了条件まで追跡する。 | 状態追加・統合はRecoveryと観測契約へ波及する。 | `contract-migration.consumer-closure` |
| Composition／Recursion | Required | この観点を成立させる構造と責務が存在するため。 | 複数の局所責務を公開結果へ合成し、部分成立と全体成立を分ける。 | 各局所結果を保持し、必要な全要素が揃うまで上位完成を表示しない。 | 構成要素の追加時は完成条件と全Consumerを再確認する。 | `contract-migration.consumer-closure`<br>`contract-migration.vertical-migration` |
| Lifecycle Ownership | N/A | 本領域は独立した動的資源を所有しない。 | 本領域は独立した動的資源を所有しない。 | 資源所有を追加する場合はLifecycle契約を新設する。 | 現時点では非該当。 | N/A |
| External Boundary | Required | この観点を成立させる構造と責務が存在するため。 | 外部境界ごとに要求、受理、Effect、結果搬送および終了後状態を分ける。 | 境界の成功を要求発行だけから推定せず、段階に応じた観測を必須にする。 | 境界変更は直接境界からSystem／E2Eまでの検証範囲へ波及する。 | `contract-migration.vertical-migration` |

同じ責務へ二つ目の具象実装を追加する場合は、共通契約へ昇格するかを評価する。昇格しない場合は、同じ責務ではない、または局所分岐の方が単純で影響が小さい理由を記録する。特定のDesign Pattern名は必須にしない。

## 上流UI／SPEC Detailとの関係

| Detail Source | UI／SPEC Definition | この領域が担当するSCR／PRT／Interaction／BHV | Relation状態 | 未解決Gap／戻し先 |
|---|---|---|---|---|
| [UI／SPEC Detail Architecture Traceability](../../08_UI_SPEC_Detail_Traceability.md) | ARCH-000002のSource Definition | 同Traceability表で上記ARCH-IDへ接続された全Detail ID | Covered | Detailの意味変更はUI／SPECへ、配置責務の変更は該当ARCH定義へ戻す |

担当Interaction Relation: `PRT-000014.spec-000019`

本領域は上記Relationの配置責務を局所所有する。Detailを新しい要求として解釈せず、対応ARCH-IDが所有する配置・境界・状態・観測の制約として実現する。

## Checklist

- [x] 関連するARCH-IDと担当する責務断面を明示した
- [x] 10種類の詳細成果物を全数Applicability判定した
- [x] Requiredを実在する節または成果物へ接続した
- [x] N/AにArchitecture上の理由を記録した
- [x] 8種類のEngineering Concernを全数評価した
- [x] PASSを設計済みの意味に限定した
- [x] Component、Interface、Data／StateおよびSequenceを必要な粒度で具体化した
- [x] Failure／Recovery、ObservabilityおよびSecurity Boundaryを具体化した
- [x] 7種類のImplementation Structure観点を全数Applicability判定した
- [x] 二つ目の具象実装がある責務で、共通契約への昇格または非昇格理由を評価した
- [x] Qualityへ渡す設計項目を局所的な導出キーまたは同等に一意な参照へ接続した
- [x] Qualityへ対象、正常条件、反証する失敗、観測および終了後条件を渡した
- [x] Human Inputの必要性とOpen／Gapを評価した
- [x] 現行実装との照合をReality Auditとして分離した
- [x] Source構造をCanonical詳細設計へ逆輸入していない
