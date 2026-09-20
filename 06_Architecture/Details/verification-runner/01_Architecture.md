# Verification Runner Architecture

成果物種別: Architecture詳細設計
詳細設計領域: verification-runner
状態: Canonical

## 基本設計との関係

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000003](../../Definitions/ARCH-000003/architecture_definition.md) | 変更した意味とTest Catalogから必要な試験を選び、段階実行と未実行理由を含む結果を返す。 | Covered |

Relation状態は、この領域が担当する責務断面に対する状態である。Quality Centerによる品質状態の統合やRelease判断は所有しない。

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | Catalog、選択、Authority、実行、結果を分ける。 | [§3](#3-component) |
| Interface Model | Required | Checkerを含む各Test OwnerとはCatalogとProcess境界で接続する。 | [§2](#2-責務境界) |
| Data Flow | Required | 変更集合から試験結果までの流れを固定する。 | [§4](#4-実行の流れ) |
| State Model | Required | planned、completed、failed、not_runを区別する。 | [§4](#4-実行の流れ) |
| Sequence | Required | StaticからUATまでの順序と先行失敗時の停止を定義する。 | [§4](#4-実行の流れ) |
| Failure／Recovery | Required | Catalog不整合、Authority不足、子Process失敗を安全に停止する。 | [§7](#7-失敗と回復) |
| Deployment | Required | CRDD公式Repository内の独立Packageと薄いCLIとして配置する。 | [§3](#3-component) |
| Observability | Required | 選択理由、段階、終了値、未実行理由を返す。 | [§4](#4-実行の流れ) |
| Security Boundary | Required | PT／LTと外部境界試験のAuthorityを実行前に確認する。 | [§6](#6-段階的な外部境界試験) |

`N/A`は未検討を意味しない。対象外にできるArchitecture上の理由を記載する。

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS | 同一実行の段階を順序化し、先行失敗後の後続Processを開始しない。 | [§4](#4-実行の流れ) |
| Timing | PASS | PT／LTは時間上限をAuthority条件に含め、未指定時はEffect 0で停止する。 | [§6](#6-段階的な外部境界試験) |
| Resource Lifecycle | PASS | 子Processと試験一時物のOwnerと終了条件を分ける。 | [§5](#5-資源と終了条件) |
| External Boundary | PASS | 外部境界を局所Contractから公開入口E2Eまで段階適用する。 | [§6](#6-段階的な外部境界試験) |
| Failure／Recovery | PASS | Catalog不整合、Authority不足、signal終了、清掃不明を成功へ畳まない。 | [§7](#7-失敗と回復) |
| State／Consistency | PASS | 一つの検証済みCatalog Snapshotを同じ実行の選択と結果へ用いる。 | [§5](#5-資源と終了条件) |
| Observability | PASS | 段階、Owner、選択試験、終了値および未実行理由を構造化する。 | [§4](#4-実行の流れ) |
| Security／Trust | PASS | CatalogやPathをAuthorityへ読み替えず、資源集約試験は明示Authorityを要求する。 | [§6](#6-段階的な外部境界試験) |

結果語彙は次の意味に限定する。

- `PASS`: 詳細設計上の処置と根拠節が揃った状態。実装済み・試験済みを意味しない。
- `N/A`: Architecture上、そのConcern自体が存在しない状態。未検討や後工程送りを意味しない。
- `OPEN`: 未解決の設計事項が残る状態。
- `FAIL`: 必須設計と矛盾する、または必要な設計が未充足の状態。

## Qualityへの引渡し

| 検証単位 | 対象 | 正常条件 | 反証する失敗 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|
| Catalog closure | Test Catalogと実在試験 | Owner、Path、Level、実在試験、実行可能Ownerが完全一致 | 未登録、Owner不一致、選択されたOwnerを実行ループが処置しない | 集合差分と理由code | 子Process 0 | なし |
| Stage execution | Static、UT、IT、ST、UAT | 宣言順に実行し全結果を保持 | 先行失敗後の後続開始、一部成功の全体Pass化 | stage、owner、selected、status、exitCode | 全子Process終了 | 各Subsystem固有の外部資源はTest Ownerで再確認 |
| Resource-intensive gate | PT／LT | 目的、環境、時間、回数、費用、清掃、停止条件が明示済み | Authority不足のままProcess開始 | Authority判定とEffect発行有無 | 未許可時Effect 0 | 実PT／LTは人間指定時だけ実行 |
| External-boundary progression | 外部境界を持つ試験 | 局所、直接境界、Lifecycle、隣接1～2 Block、公開入口の順に配置 | 最終E2Eが最初の実境界確認になる | Level、Lifecycle Profile、Block Path | 各段階の事後条件を観測 | 実環境差は対象IT／STで再確認 |

## 現行実装との照合

現行Sourceと既存試験は本詳細設計の正式入力ではない。本設計候補を固定した後、成立済み能力を失わないよう`Covered`、`Partial`、`Missing`、`Legacy`または`Implementation Detail`へ分類する。

担当責任者: Qual-Lab
最終更新日: 2026-09-20
要求: [`REQ-000030`](../../../01_Discovery/Definitions/REQ-000030/requirement.md)
変更: [`CHG-000076`](../../../99_Roadmap/Changes/CHG-000076/change.md)

## 1. 目的

Verification Runnerは、変更した意味とTest Catalogから必要な試験を選び、試験段階ごとの実行と結果集約を行う。Checkerの規則判定とは分離し、Checkerを一つの検証対象として利用する。

```text
変更Path／明示した試験範囲
             │
             ▼
       Test Catalog
             │
      ┌──────┴──────┐
      ▼             ▼
 試験選択       Authority確認
      │             │
      └──────┬──────┘
             ▼
 Static → UT → IT → ST → UAT
             │
             ▼
       構造化した実行結果
```

## 2. 責務境界

| 区分 | 所有する責務 | 所有しない責務 |
|---|---|---|
| Test Catalog | Test ID、Owner、Level、実行Path、外部境界、事後条件の読取りと検証 | Testの意味採否、品質Passの宣言 |
| Selection | 変更Path、明示範囲、Levelから実行対象を決定 | Source差分の意味を推測して未宣言試験を捏造 |
| Execution | Static、UT、IT、ST、UATを依存順に実行し、先行失敗後の未実行を区別 | 各Subsystem固有の試験実装 |
| Resource-intensive gate | PT／LTの目的、環境、時間、回数、Credit、清掃、停止条件を確認 | 人間Authorityの推定、無許可実行 |
| Result | 選択理由、段階、終了値、未実行理由を構造化 | 一部成功から全体Passを推定 |

CheckerはRepository規則の機械判定を所有する。Verification Runnerは必要な場合にCheckerの公開入口を実行するが、Checker規則やFinding生成を所有しない。

## 3. Component

```text
verification-runner/
├ src/index.ts
├ src/application/   回帰実行の受付・結果構築
├ src/catalog/       Test Catalogの読取り・選択
├ src/execution/     段階計画・子Process実行
├ bin/               引数受付・表示・終了値反映だけを行うCLI
└ tests/             Capability固有の契約試験
```

Subsystem外の利用側は`src/index.ts`だけを利用する。`bin/`は実行順、Authority判定または選択規則を再実装しない。

## 4. 実行の流れ

```text
[変更集合を観測]
        │
        ├ 観測不能 ───────────────→ [Effect 0／blocked]
        ▼
[Catalogを検証]
        │
        ├ 不正・不整合 ───────────→ [Effect 0／invalid]
        ▼
[試験と段階を選択]
        │
        ├ PT／LTを含む
        │      ├ Authority不足 ───→ [Effect 0／not_authorized]
        │      └ Authority確認済み
        ▼
[Static] → [UT] → [IT] → [ST] → [UAT]
        │      │      │      │
        └ failure以後は未実行理由を保持
                       │
                       ▼
                 [構造化結果]
```

## 5. 資源と終了条件

| 資源 | Owner | 終了条件 |
|---|---|---|
| Test Catalog Snapshot | Verification Runner | 同一実行中は同じ検証済みSnapshotを使用する |
| 子Process | Execution Component | 正常、失敗、signalのいずれでも終了状態を観測する |
| PT／LT Authority | 呼出し側の人間Authority | 指定Scopeだけに限定し、別実行へ流用しない |
| 試験一時物 | 各Test Owner | Catalogの事後条件と各試験契約で清掃・回復を確認する |

## 6. 段階的な外部境界試験

外部境界を含む試験は、局所Contract、外部境界単体、一連のLifecycle、隣接1～2 Block、公開入口E2Eの順で配置する。最終E2Eを最初の実境界確認にしない。

PT／LTはApplicabilityを必ず評価する。対象が存在しても、人間が目的、環境、上限、清掃および停止条件を指定しない限り実行しない。

## 7. 失敗と回復

- Catalog不整合では子Processを開始しない。
- 先行段階の失敗後は、後続段階を成功扱いせず`not_run_due_to_prior_stage`として保持する。
- 子Processのsignal終了と終了値を区別する。
- 一部の結果だけから全試験完了を主張しない。
- Effectや清掃状態が不明な試験は、各Test Ownerの回復契約へ引き渡す。

## Checklist

- [x] 関連するARCH-IDと担当する責務断面を明示した
- [x] 9種類の詳細成果物を全数Applicability判定した
- [x] Requiredを実在する節または成果物へ接続した
- [x] N/AにArchitecture上の理由を記録した
- [x] 8種類のEngineering Concernを全数評価した
- [x] PASSを設計済みの意味に限定した
- [x] Component、Interface、Data／StateおよびSequenceを必要な粒度で具体化した
- [x] Failure／Recovery、ObservabilityおよびSecurity Boundaryを具体化した
- [x] Qualityへ対象、正常条件、反証する失敗、観測および終了後条件を渡した
- [x] Human Inputの必要性とOpen／Gapを評価した
- [x] 現行実装との照合をReality Auditとして分離した
- [x] Source構造をCanonical詳細設計へ逆輸入していない
