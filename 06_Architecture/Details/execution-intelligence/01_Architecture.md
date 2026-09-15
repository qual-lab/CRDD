# 実行記録の読取りと評価候補の詳細設計

成果物種別: Architecture詳細設計
詳細設計領域: execution-intelligence
状態: Candidate（v0.21.0）
維持責任者: Qual-Lab

## 基本設計との関係

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000007](../../Definitions/ARCH-000007/architecture_definition.md) | 利用可能な実行記録を読取り、欠測を保った事実と非Authorityな評価候補を返す。 | Covered |
| [ARCH-000016](../../Definitions/ARCH-000016/architecture_definition.md) | Source Revision、観測時点および評価候補の時間的出所を、現在値と履歴を混同せず解決する。 | Covered |

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | Query、Reader、Aggregator、Projectionの読取り責務を分ける。 | [§1](#1-component-model) |
| Interface Model | Required | 実行記録Sourceと利用側の間に読取り専用Portを置く。 | [§2](#2-interface-model) |
| Data Flow | Required | 記録から事実・欠測・評価候補へ至る変換を追跡する。 | [§3](#3-data-flow) |
| State Model | Required | observed、not_observed、unknownと時間的出所を区別する。 | [§4](#4-state-model) |
| Sequence | Required | 読取り、検査、集約、投影の順序を固定する。 | [§5](#5-sequence) |
| Failure／Recovery | Required | Source欠落、破損、相関不一致、観測不能を扱う。 | [§6](#6-failurerecovery) |
| Deployment | N/A | 読取りProjectionは特定Process配置を所有しない。 | [§7](#7-deployment) |
| Observability | Required | 読取り結果と欠測理由を相関可能にする。 | [§8](#8-observability) |
| Security Boundary | Required | 読取り権限を変更・採用・実行Authorityへ昇格させない。 | [§9](#9-security-boundary) |

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS | 一つの読取りSnapshot内で異なる観測時点を混在させず、Source更新は所有しない。 | [§4](#4-state-model) |
| Timing | PASS | 観測時点とSource Revisionを結果へ保持し、古い値を現在値として返さない。 | [§4](#4-state-model) |
| Resource Lifecycle | N/A | 書込み、Lock、動的外部資源または長期保持Handleを所有しない。 | [§1](#1-component-model) |
| External Boundary | PASS | Source取得不能と記録不存在を別状態で返す。 | [§6](#6-failurerecovery) |
| Failure／Recovery | PASS | 読取り不能時は状態を推測せず、再取得可能な参照と理由だけを返す。 | [§6](#6-failurerecovery) |

## Qualityへの引渡し

| 検証単位 | 対象 | 正常条件 | 反証する失敗 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|
| 実行記録の読取り | Query／Reader | 許可されたSourceのexact記録だけを返す | 別Task混入、破損黙殺、欠測補完 | Source ID、Task ID、Revision、読取り結果 | 書込みEffect 0、Handle 0 | 外部Source別の実在性 |
| 状態投影 | Aggregator／Projection | observed／not_observed／unknownを区別する | unknownを空値や正常へ畳む | 状態、reason、observed at | 入力記録不変、Authority発行0 | 利用側表示の理解可能性 |
| 時間的出所 | Revision／Observed At | 現在値と履歴を区別できる | 古い記録を現行として表示 | source revision、observed at | 履歴変更0 | Clock差の実境界 |
| 評価候補 | 事実と評価候補 | 両者を別結果として返す | 候補を事実・採用判断へ昇格 | fact、candidate、basis | 採用Effect 0 | 人間判断後の下流処置 |

## 現行実装との照合

v0.20.1にはEvent生成、Recorder、Store Writerおよび不変保存の成立済みCapabilityがある。これらは失わず、[現行実装のReality Audit](02_Current_Implementation_Reality_Audit.md)で比較する。ただし、UI／SPECから導出したARCH-000007／016の正式責務ではなく、本書のRelation、適用判断またはQuality引渡しの成立根拠にしない。

## 1. Component Model

```text
許可された実行記録Source
          ↓
        Query
          ↓
        Reader
          ↓
  検査・相関・Aggregation
          ↓
 Read-only Projection
   ├─ 観測事実
   ├─ 欠測／不明
   └─ 非Authority評価候補
```

各Componentは入力Sourceを変更しない。ProjectionはTask状態、Project状態、実行許可または評価採用を所有しない。

## 2. Interface Model

読取りPortは、許可されたSource識別、対象Task、取得条件とSnapshot条件を受け取る。結果は、観測状態、事実、評価候補、Source Revision、観測時点および欠測理由を返す。Filesystem Pathや内部Store表現を公開契約へ漏らさない。

## 3. Data Flow

```text
Source bytes
   ↓ schema・identity検査
Canonical execution record
   ↓ task・revision・time相関
Observed facts + missing/unknown
   ↓ 評価候補を別fieldへ導出
Read-only result
```

要求値、観測値および評価値を相互に代用しない。Sourceが返さない値は未観測として保持する。

## 4. State Model

| 状態 | 意味 | 禁止する短絡 |
|---|---|---|
| `observed` | 許可されたSourceから対象記録を検査できた | 現在有効・採用済みとみなさない |
| `not_observed` | Sourceは読めたが対象記録がない | 正常値や0へ補完しない |
| `unknown` | Sourceまたは相関を検査できない | `not_observed`へ畳まない |

一つの結果は単一Snapshot条件を持つ。異なるRevisionや観測時点の結果を、同じ現在状態へ暗黙統合しない。

## 5. Sequence

```text
取得条件を検査
      ↓
Sourceを読取る
      ↓
Schema／Identity／Revisionを検査
      ↓
事実・欠測・評価候補を分離
      ↓
根拠付きProjectionを返す
```

各段階で書込みEffect、Task更新、候補採用またはAuthority発行を行わない。

## 6. Failure／Recovery

- Source不存在とSource観測不能を分ける。
- 記録破損、Schema不一致、Identity不一致またはRevision競合を黙って除外しない。
- 部分的に読めた結果を完全な履歴として返さない。
- 再取得可能な場合は、秘密情報を含まないSource参照、Snapshot条件と失敗理由を返す。
- 回復処置そのものは所有せず、再取得後も同じ対象Identityを用いる。

## 7. Deployment

本責務はTypeScript API、CLI、MCPまたはWorkbenchから利用できる読取り契約であり、特定Process配置を前提にしない。共有Serverでの配置・認証はCROS／Transport側が所有する。

## 8. Observability

診断結果には、対象Task、Source種別、Source Revision、観測時点、観測状態、欠測理由および評価根拠を含める。Raw provider出力、資格情報または許可されていないPathを診断目的で複製しない。

## 9. Security Boundary

- Sourceを読めることを、Source変更、Task実行、評価採用または回復Authorityとして扱わない。
- 開示不可Sourceの存在やIdentityを境界外へ漏らさない。
- 評価候補は非Authorityであり、明示した決定権限者の判断を代替しない。
- CanonicalなTask Identity、Revisionおよび観測時点を利用側で再解釈しない。
