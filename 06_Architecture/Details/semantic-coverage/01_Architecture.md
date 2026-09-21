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
| Implementation Structure | Required | 設計責務を具象差、選択、状態依存、構成、資源Ownerおよび外部境界へ分解する。 | [§Implementation Structure](#implementation-structure) |

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

| 導出キー | 設計項目種別 | 対象 | 正常条件 | 反証する失敗 | 主な試験段階 | 外部境界の段階 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|---|---|---|
| `semantic-coverage.meaning-compilation` | Flow／Implementation Structure | Architecture Detailsの構造化表 | 明示された意味だけをSemantic IRへ変換 | 自由文から意味を推測、重複Key、未解決ARCH-ID | UT／IT | Adjacent 1 Block | IR、Domain Issue、入力Path | Repository内容不変 | Pilot解除条件は別Changeで判断 |
| `semantic-coverage.relation-coverage` | Flow／Consistency | IR、Symbol Manifest、Quality Local Item | 必須Meaningが実装・検証Relationへ一意に接続 | 未解決、曖昧、逆向き所有、欠落 | UT／IT | Related 2 Blocks | Coverage Graphと理由code | Repository内容不変 | 全Subsystem展開は別Changeで判断 |
| `semantic-coverage.bundle-publication` | Sequence／Lifecycle Ownership | 検証済みRepository Root内のRegistry | 完全なBundleだけを原子的に公開 | Root外、link、部分書込み、置換前失敗 | IT | Direct Boundary | receipt、内容、temporary file残存 | 既存Snapshot維持、一時File 0 | 同時公開競合は実装拡張時に再評価 |

導出キーは本領域内でQualityが同じ設計項目を反復参照するための局所参照であり、CRDD全体の安定コンテキストIDではない。

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

## Implementation Structure

| 観点 | 適用 | 判定理由 | 成立させる構造 | 局所責務・不変条件 | 失敗・変更時の影響 | Qualityへの導出キー |
|---|---|---|---|---|---|---|
| Variation | Required | この観点を成立させる構造と責務が存在するため。 | Qualityへの引渡しで責務差を別の設計項目として固定する。 | 具象差を一つの分岐へ畳まず、各導出キーの正常条件と反証条件を保つ。 | 新しい具象を追加した場合、対応する導出キーと利用側の再確認が必要になる。 | `semantic-coverage.meaning-compilation`<br>`semantic-coverage.relation-coverage`<br>`semantic-coverage.bundle-publication` |
| Common Contract | Required | この観点を成立させる構造と責務が存在するため。 | Architecture Meaning、Implementation Symbol、Quality Local ItemとTest Symbolを、片側Ownerを持つRelation契約へ揃える。 | 各Symbol種別は固有Propertyを保ち、逆Relationを複製せずGraphから投影する。 | 新しいRelation種別が独自Identityや双方向台帳を持ち、整合不能になる。 | `semantic-coverage.meaning-compilation`<br>`semantic-coverage.relation-coverage`<br>`semantic-coverage.bundle-publication` |
| Creation／Selection | N/A | 本領域は独立した具象生成・選択責務を持たず、上位から固定入力を受ける。 | 本領域は独立した具象生成・選択責務を持たず、上位から固定入力を受ける。 | 生成・選択判断を本領域へ追加しない。 | 将来生成・選択責務を追加する場合に再評価する。 | N/A |
| State-dependent Behavior | Required | この観点を成立させる構造と責務が存在するため。 | 入力・処理中・完了・失敗・観測不能を区別して振る舞いを決める。 | 状態を空値や成功へ畳まず、同じIdentityで終了条件まで追跡する。 | 状態追加・統合はRecoveryと観測契約へ波及する。 | `semantic-coverage.meaning-compilation` |
| Composition／Recursion | Required | この観点を成立させる構造と責務が存在するため。 | 複数の局所責務を公開結果へ合成し、部分成立と全体成立を分ける。 | 各局所結果を保持し、必要な全要素が揃うまで上位完成を表示しない。 | 構成要素の追加時は完成条件と全Consumerを再確認する。 | `semantic-coverage.meaning-compilation`<br>`semantic-coverage.relation-coverage`<br>`semantic-coverage.bundle-publication` |
| Lifecycle Ownership | Required | この観点を成立させる構造と責務が存在するため。 | Process、Handle、一時物、秘密または公開SnapshotのOwnerと終了条件を固定する。 | 成功・失敗・取消の全経路で資源回収または同一Identityの回復義務を残す。 | Owner変更は取消、Recovery、終了後条件へ波及する。 | `semantic-coverage.bundle-publication` |
| External Boundary | Required | この観点を成立させる構造と責務が存在するため。 | 外部境界ごとに要求、受理、Effect、結果搬送および終了後状態を分ける。 | 境界の成功を要求発行だけから推定せず、段階に応じた観測を必須にする。 | 境界変更は直接境界からSystem／E2Eまでの検証範囲へ波及する。 | `semantic-coverage.bundle-publication` |

同じ責務へ二つ目の具象実装を追加する場合は、共通契約へ昇格するかを評価する。昇格しない場合は、同じ責務ではない、または局所分岐の方が単純で影響が小さい理由を記録する。特定のDesign Pattern名は必須にしない。

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
