# 詳細設計領域名

成果物種別: Architecture詳細設計
詳細設計領域: `area`
状態: Candidate
維持責任者: （記入）

## 基本設計との関係

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-XXXXXX](../../Definitions/ARCH-XXXXXX/architecture_definition.md) | （この領域が担当する責務断面） | Covered／Partial／Missing |

Relation状態はこの領域が担当する責務断面に対する状態である。複数領域で同じARCH-IDを実現する場合は、各断面を合成して基本設計全体を閉じる。

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required／N/A | | [§1](#1-component-model) |
| Interface Model | Required／N/A | | [§2](#2-interface-model) |
| Data Flow | Required／N/A | | [§3](#3-data-flow) |
| State Model | Required／N/A | | [§4](#4-state-model) |
| Sequence | Required／N/A | | [§5](#5-sequence) |
| Failure／Recovery | Required／N/A | | [§6](#6-failurerecovery) |
| Deployment | Required／N/A | | [§7](#7-deployment) |
| Observability | Required／N/A | | [§8](#8-observability) |
| Security Boundary | Required／N/A | | [§9](#9-security-boundary) |

`N/A`は未検討を意味しない。対象外にできるArchitecture上の理由を記載する。

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS／N/A／OPEN／FAIL | | |
| Timing | PASS／N/A／OPEN／FAIL | | |
| Resource Lifecycle | PASS／N/A／OPEN／FAIL | | |
| External Boundary | PASS／N/A／OPEN／FAIL | | |
| Failure／Recovery | PASS／N/A／OPEN／FAIL | | |

## Qualityへの引渡し

| 検証単位 | 対象 | 正常条件 | 反証する失敗 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|
| （検証単位） | | | | | | |

## 現行実装との照合

Canonical詳細設計を固定した後、現行Sourceと既存試験を`Covered`、`Partial`、`Missing`、`Legacy`または`Implementation Detail`へ分類する。

## 1. Component Model

責務、Owner、依存方向と所有しない責務を、実装単位へ落とせる粒度で示す。

## 2. Interface Model

内部／外部境界を越える入力、結果、Authority、Effectと失敗を示す。

## 3. Data Flow

Canonical Identity、状態、入力、派生結果と保存先の流れを示す。

## 4. State Model

正常、準正常、異常、観測不能、回復待ちと終了後状態を示す。

## 5. Sequence

順序が成立条件になる場合、要求、検証、Effect、観測、Settlementを分けて示す。対象外なら適用判断へ理由を残す。

## 6. Failure／Recovery

故障点、部分成立、再試行可否、Recovery Owner、再入場Identityと安全な停止状態を示す。

## 7. Deployment

Process、package、Repository、OSまたはNetwork配置が意味へ影響する場合、その境界を示す。対象外なら適用判断へ理由を残す。

## 8. Observability

入力、構成、要求、受理、開始、完了、結果搬送と終了後状態を相関できる観測を示す。

## 9. Security Boundary

Trust、Authority、秘密、情報開示、許可されたEffectと拒否時Effect 0を示す。
