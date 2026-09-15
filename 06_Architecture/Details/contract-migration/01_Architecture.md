# Canonical Contract移行の閉包設計

成果物種別: Architecture詳細設計
詳細設計領域: contract-migration
状態: Candidate（v0.21.0）
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

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS | 一つの固定改訂版を移行単位にし、旧／新候補の結果を混在させない。 | [§3](#3-状態と完了条件) |
| Timing | N/A | 期限ではなくConsumer集合と縦断反証の閉包を完了条件にする。 | [§3](#3-状態と完了条件) |
| Resource Lifecycle | N/A | Processや動的外部資源を所有せず、移行状態とEvidenceを追跡する。 | [§1](#1-移行単位) |
| External Boundary | PASS | 署名、Release、公開Transport、RecoveryもConsumer集合に含める。 | [§2](#2-consumer-closure) |
| Failure／Recovery | PASS | 中断時は未移行Consumerと旧契約禁止状態を保持し、同じ固定候補へ再入場する。 | [§4](#4-失敗と再入場) |

## Qualityへの引渡し

| 検証単位 | 対象 | 正常条件 | 反証する失敗 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|
| Consumer closure | Owner、Producer、全Consumer、派生物、公開入口、署名・Release・Recovery | 宣言集合と自動導出集合が完全一致し、既知Consumerごとの試験がある | Registry記載漏れ、未知・重複、rare path、派生物・署名経路の取り残し | set差分、consumer test、旧参照検索 | 全Consumer移行前の旧処理削除0、旧参照0 | 意味妥当性は独立レビュー |
| 縦断移行 | Producerから公開／Release／Recovery | Canonical Path／Identity／Stateを再解釈せず同じSnapshot上で搬送 | path再構成、schema旧版、Snapshot混在、署名経路残存 | phase、snapshot identity、value identity、result | 新経路verified、旧経路retired | 外部実境界は該当IT／E2E |

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
