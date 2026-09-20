# Semantic Coverage Architecture

成果物種別: Architecture詳細設計
詳細設計領域: semantic-coverage
状態: Canonical

## 基本設計との関係

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000008](../../Definitions/ARCH-000008/architecture_definition.md) | Architecture Detailsの意味、実装Symbol、Quality Local ItemおよびTest Symbolを決定論的に接続し、意味Coverageを生成する。 | Covered |

Relation状態はSemantic Coverageが担当する責務断面に対する状態である。Architecture Details、実装、Quality定義または試験の意味自体は所有しない。

本書は、Semantic Coverageの実行境界、所有責務、公開EffectおよびQualityへの引渡しを定義する。Semantic IR、Relation OwnerおよびCoverage Graphの詳細契約は[Semantic IR・Relation詳細設計](02_Semantic_IR_and_Relation_Design.md)を正本とする。

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | Domain計算、Repository入力、Bundle公開およびCLIを分ける。 | [§3](#3-component) |
| Interface Model | Required | Domain Library、Version Control、Quality Registryとの境界を固定する。 | [§2](#2-責務境界) |
| Data Flow | Required | Architecture DetailsからBundleまでの変換を示す。 | [§4](#4-実行の流れ) |
| State Model | Required | complete、partial、invalid、unobservableを区別する。 | [§5](#5-状態と終了条件) |
| Sequence | Required | 観測、IR生成、Relation接続、Graph生成、公開を順序化する。 | [§4](#4-実行の流れ) |
| Failure／Recovery | Required | 入力不足、関係不整合、公開失敗を既存Snapshot保全とともに扱う。 | [§6](#6-失敗と回復) |
| Deployment | Required | 独立Packageと薄いCLIとして配置し、Checkerから分離する。 | [§3](#3-component) |
| Observability | Required | 入力Path、Semantic Key、未解決Relationおよび公開結果を返す。 | [§5](#5-状態と終了条件) |
| Security Boundary | Required | 検証済みRepository Root外への読取り・公開を拒否する。 | [§2](#2-責務境界) |

`N/A`は未検討を意味しない。対象外にできるArchitecture上の理由を記載する。

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS | 公開は同一Directory内の一時Fileを原子的に置換し、同一実行の入力集合を固定する。 | [§4](#4-実行の流れ) |
| Timing | PASS | 観測時点のRepository入力だけを一回のBundleへ使用し、別時点の入力を混在させない。 | [§5](#5-状態と終了条件) |
| Resource Lifecycle | PASS | File descriptorと一時Fileを公開Operationが所有し、成功・失敗の両方で終了させる。 | [§5](#5-状態と終了条件) |
| External Boundary | PASS | Repository FilesystemをVersion Control CapabilityとRepository Port経由で扱う。 | [§2](#2-責務境界) |
| Failure／Recovery | PASS | 公開前失敗では既存Snapshotを維持し、一時Fileを除去する。 | [§6](#6-失敗と回復) |
| State／Consistency | PASS | Architecture、Symbol、Quality、Testの各Relation Ownerを分け、逆RelationはGraphから生成する。 | [§4](#4-実行の流れ) |
| Observability | PASS | 不明な意味、未解決ID、曖昧なTest Relationおよび公開結果を構造化する。 | [§5](#5-状態と終了条件) |
| Security／Trust | PASS | Repository外Path、link、非regular fileおよび未検証Rootを拒否する。 | [§2](#2-責務境界) |

結果語彙は次の意味に限定する。

- `PASS`: 詳細設計上の処置と根拠節が揃った状態。実装済み・試験済みを意味しない。
- `N/A`: Architecture上、そのConcern自体が存在しない状態。未検討や後工程送りを意味しない。
- `OPEN`: 未解決の設計事項が残る状態。
- `FAIL`: 必須設計と矛盾する、または必要な設計が未充足の状態。

## Qualityへの引渡し

| 検証単位 | 対象 | 正常条件 | 反証する失敗 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|
| Meaning compilation | Architecture Detailsの構造化表 | 明示された意味だけをSemantic IRへ変換 | 自由文から意味を推測、重複Key、未解決ARCH-ID | IR、Domain Issue、入力Path | Repository内容不変 | Pilot解除条件は別Changeで判断 |
| Relation coverage | IR、Symbol Manifest、Quality Local Item | 必須Meaningが実装・検証Relationへ一意に接続 | 未解決、曖昧、逆向き所有、欠落 | Coverage Graphと理由code | Repository内容不変 | 全Subsystem展開は別Changeで判断 |
| Bundle publication | 検証済みRepository Root内のRegistry | 完全なBundleだけを原子的に公開 | Root外、link、部分書込み、置換前失敗 | receipt、内容、temporary file残存 | 既存Snapshot維持、一時File 0 | 同時公開競合は実装拡張時に再評価 |

## 現行実装との照合

現行Sourceと既存試験は本詳細設計の正式入力ではない。本設計候補を固定した後、`Covered`、`Partial`、`Missing`、`Legacy`または`Implementation Detail`へ分類する。

担当責任者: Qual-Lab
最終更新日: 2026-09-20
要求: [`REQ-000030`](../../../01_Discovery/Definitions/REQ-000030/requirement.md)
変更: [`CHG-000076`](../../../99_Roadmap/Changes/CHG-000076/change.md)

## 1. 目的

Semantic Coverageは、設計上の意味が実装Symbol、Quality Local ItemおよびTest Symbolまで接続されているかを、AIの補完なしに観測可能にする。

## 2. 責務境界

| Owner | 所有する責務 | 所有しない責務 |
|---|---|---|
| Semantic Coverage Compilation／Coverage | Semantic IR、Relation、Coverage GraphおよびBundleの純粋計算 | Repository観測、公開Effect、利用者向け診断 |
| Semantic Coverage Application／Infrastructure | Repository入力の編成、診断、Bundle生成・公開 | Architecture、実装、Quality、Testの内容採否 |
| CRDD Domain Library | 共通Outcome、Reality TraceabilityおよびRepository Observation | Semantic IR、Checker Finding、Bundle公開 |
| Checker | 現行Profile違反のFinding表示 | Semantic Coverageの生成・公開Operation |
| Version Control／Repository Port | 検証済みRootとFilesystem観測 | Semantic Relationの意味判断 |

## 3. Component

```text
semantic-coverage/
├ src/index.ts
├ src/compilation/       Semantic IR・Quality Relation
├ src/coverage/          Coverage Graph・Bundle
├ src/application/       IR・Relation・Coverageの編成
├ src/infrastructure/    原子的Bundle公開
├ src/migrations/        旧Runtime JSONの移行入力
├ bin/                   Pilot CLI
└ tests/                 Domain接続と実Filesystem公開の契約試験
```

`src`配下は2階層以内とし、利用側は`src/index.ts`から利用する。`bin/`は意味抽出や公開契約を再実装しない。

## 4. 実行の流れ

```text
[検証済みRepository Root]
          │
          ▼
[Architecture Detailsを観測]
          │
          ▼
[Semantic IRを決定論的に生成]
          │
          ├── 入力不足／未知ID ──→ [invalid／Effect 0]
          ▼
[Symbol・Quality Relationを接続]
          │
          ├── 欠落／曖昧 ───────→ [partial／Effect 0]
          ▼
[Coverage Graph／Bundleを生成]
          │
          ├── 表示のみ ─────────→ [Repository内容不変]
          └── 明示した公開 ─────→ [一時File → 検証 → 原子的置換]
```

## 5. 状態と終了条件

| 状態 | 意味 | 終了後条件 |
|---|---|---|
| complete | 必須入力とRelationが解決済み | 読取りのみ、または検証済みBundle一件 |
| partial | 一部の意味またはRelationが未接続 | 公開Effect 0、未解決集合を保持 |
| invalid | 入力契約またはIdentityが不正 | 公開Effect 0 |
| unobservable | Repository入力を安全に観測不能 | 不存在へ畳まず公開Effect 0 |

## 6. 失敗と回復

- Architecture Detailsから抽出できない意味をAIで補完しない。
- Manifest、Quality RelationまたはTest Relationの曖昧さを一意と推定しない。
- 公開前の失敗では既存Bundleを変更しない。
- 一時Fileは成功・失敗の両方で除去する。
- rename後の読戻し等、Effect成立が不明になる機能を追加する場合は耐久OperationとRecovery契約を別途設計する。

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
