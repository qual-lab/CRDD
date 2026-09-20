# Checker安定化とReality Traceability基盤

変更ID: `CHG-000074`
状態: `Ready for Release Handoff`
決定権限: Qual-Lab
対象版: `v0.21.0`
変更分類: `tool_architecture_and_traceability_change`

## 1. 変更の目的

Quality設計固定後、実装・試験とのReality Auditへ進む前に、Checkerの現行Contractを保持した責務分割と、Canonical設計をSource／Testへ接続する機械可読なTraceability基盤を成立させる。

```text
Canonical Design固定
        ↓
Checker安定化
        ↓
Reality Traceability基盤
        ↓
Reality Audit
```

本変更では、既存実装を理由にCanonical設計を変更しない。Canonical側の不足候補はReality AuditのGapとして所有工程へ返す。

## 2. 現在状態と構造変更

| 対象 | 変更前 | 変更後 |
|---|---|---|
| Checker Pipeline | CLI、探索、Markdown解釈、工程別検査、集計が巨大な配布Sourceへ集積 | Repository DiscoveryからFinding Reportまでの固定Stageを明示する |
| 検査入力 | RuleごとにMarkdown文字列を解釈 | MarkdownをArtifact Modelへ変換し、Schema／Relation／Special Ruleが共有する |
| 工程別Rule | Coreの処理順序と同じSourceへ直接埋込み | Rule Registryへ登録し、Core変更なしで追加できる単位へ移す |
| Finding | 検査箇所ごとの追加処理 | severity、code、path、rule、message、evidenceを共通化する |
| Reality Relation | Architecture／QualityとSource／Testの対応を文書や人間の記憶で再構成 | Subsystem単位の`symbol.json`、共通Schema、Global Symbol Graphで双方向に解決する |
| Reality Audit | Canonicalと現行実装の対応を都度探索 | ARCH／QAから実装・試験へ辿れる基盤上で意味一致とGapを評価する |

現在はChecker内部基盤、Quality状態Rule、現行ProfileのRule登録までを移行した段階である。工程別Profileの検査本体は、既存Findingを固定するため配布入口内に残り、Registry callbackを介して実行している。このcallback接続をRule本体の分離完了とは扱わない。

### 影響ファイル

<details>
<summary>全ファイルを表示</summary>

- [`06_Architecture/Details/checker/01_Architecture.md`](../../../06_Architecture/Details/checker/01_Architecture.md)
- [`40_Develop/checker/tests/integration/crdd-check.contract.test.ts`](../../../40_Develop/checker/tests/integration/crdd-check.contract.test.ts)
- [`template/tools/crdd-check.ts`](../../../template/tools/crdd-check.ts)
- [`template/tools/internal/checker/artifact-model.ts`](../../../template/tools/internal/checker/artifact-model.ts)
- [`template/tools/internal/checker/checker-pipeline.ts`](../../../template/tools/internal/checker/checker-pipeline.ts)
- [`template/tools/internal/checker/finding-model.ts`](../../../template/tools/internal/checker/finding-model.ts)
- [`template/tools/internal/checker/markdown-artifact-parser.ts`](../../../template/tools/internal/checker/markdown-artifact-parser.ts)
- [`template/tools/internal/checker/relation-engine.ts`](../../../template/tools/internal/checker/relation-engine.ts)
- [`template/tools/internal/checker/rule-registry.ts`](../../../template/tools/internal/checker/rule-registry.ts)
- [`template/tools/internal/checker/schema-validator.ts`](../../../template/tools/internal/checker/schema-validator.ts)
- [`template/tools/internal/checker/rules/current-profile.ts`](../../../template/tools/internal/checker/rules/current-profile.ts)
- [`template/tools/internal/checker/rules/quality-design-state.ts`](../../../template/tools/internal/checker/rules/quality-design-state.ts)
- [`template/tools/internal/checker/rules/reality-symbol-graph.ts`](../../../template/tools/internal/checker/rules/reality-symbol-graph.ts)
- `template/tools/internal/checker/rules/reality-test-catalog-adapter.ts` → [`40_Develop/checker/src/internal/adapters/reality-test-catalog.ts`](../../../40_Develop/checker/src/internal/adapters/reality-test-catalog.ts)
- `template/tools/internal/reality-traceability/symbol-discovery.ts` → [`40_Develop/crdd-domain-library/src/domain/reality-traceability/symbol-discovery.ts`](../../../40_Develop/crdd-domain-library/src/domain/reality-traceability/symbol-discovery.ts)
- `template/tools/internal/reality-traceability/symbol-annotation.ts` → [`40_Develop/crdd-domain-library/src/domain/reality-traceability/internal/symbol-annotation.ts`](../../../40_Develop/crdd-domain-library/src/domain/reality-traceability/internal/symbol-annotation.ts)
- `template/tools/internal/reality-traceability/symbol-graph.ts` → [`40_Develop/crdd-domain-library/src/domain/reality-traceability/symbol-graph.ts`](../../../40_Develop/crdd-domain-library/src/domain/reality-traceability/symbol-graph.ts)
- `template/tools/internal/reality-traceability/symbol-manifest-model.ts` → [`40_Develop/crdd-domain-library/src/domain/reality-traceability/symbol-manifest-model.ts`](../../../40_Develop/crdd-domain-library/src/domain/reality-traceability/symbol-manifest-model.ts)
- `template/tools/internal/reality-traceability/symbol-manifest-validator.ts` → [`40_Develop/crdd-domain-library/src/domain/reality-traceability/symbol-manifest-validator.ts`](../../../40_Develop/crdd-domain-library/src/domain/reality-traceability/symbol-manifest-validator.ts)
- `template/tools/internal/reality-traceability/repository-regular-file-observer.ts` → [`40_Develop/crdd-domain-library/src/repository/internal/filesystem-repository-observer.ts`](../../../40_Develop/crdd-domain-library/src/repository/internal/filesystem-repository-observer.ts)
- [`template/tools/schemas/reality-symbol-schema.json`](../../../template/tools/schemas/reality-symbol-schema.json)
- [`40_Develop/artifact-signing/symbol.json`](../../../40_Develop/artifact-signing/symbol.json)
- [`40_Develop/checker/symbol.json`](../../../40_Develop/checker/symbol.json)
- [`40_Develop/coordinator/symbol.json`](../../../40_Develop/coordinator/symbol.json)
- [`40_Develop/execution-intelligence/symbol.json`](../../../40_Develop/execution-intelligence/symbol.json)
- [`40_Develop/mcp/symbol.json`](../../../40_Develop/mcp/symbol.json)
- [`40_Develop/platform-access/symbol.json`](../../../40_Develop/platform-access/symbol.json)
- [`40_Develop/project-runtime/symbol.json`](../../../40_Develop/project-runtime/symbol.json)
- [`40_Develop/runtime-data/symbol.json`](../../../40_Develop/runtime-data/symbol.json)
- [`40_Develop/version-control/symbol.json`](../../../40_Develop/version-control/symbol.json)
- [`40_Develop/checker/tests/unit/symbol-graph.contract.test.ts`](../../../40_Develop/checker/tests/unit/symbol-graph.contract.test.ts)
- [`07_Quality/Registry/test-catalog.json`](../../../07_Quality/Registry/test-catalog.json)
- [`99_Roadmap/01_Roadmap.md`](../../01_Roadmap.md)
- [`99_Roadmap/02_Changes.md`](../../02_Changes.md)
- [`99_Roadmap/Changes/CHG-000074/change.md`](change.md)

</details>

## 3. 成立条件

### Checker安定化

- PipelineのStageと順序が固定されている。
- Parser、Artifact Model、Schema、Relation、Special Rule、Findingが責務分離されている。
- 工程別Ruleの追加でChecker CoreとPipeline順序を原則変更しない。
- CLI、Finding code、終了値、検査範囲および既存契約試験集合の意味を維持する。
- Checkerへ独立監査の意味判断を移さない。

### Reality Traceability

- Subsystem単位で共通Schema準拠の`symbol.json`を配置できる。
- ARCH-IDとImplementation Symbolを双方向に解決できる。
- QA-IDとTest Symbolを双方向に解決できる。
- Test Symbolから検証対象Implementation Symbolを追跡できる。
- Test SymbolはTest Catalogへexact Pathで一度だけ登録され、OwnerがSubsystemと一致する場合だけ受理する。
- Symbol Pathは途中要素を含めてlink／junctionではなく、実体PathがSubsystem内に留まる場合だけ受理する。
- Test CatalogとQuality DefinitionもRepository内の通常fileとして観測できる場合だけGraph入力に使う。
- 構造Findingが1件でも存在する場合は、部分的に利用可能なGlobal Symbol Graphを発行しない。
- Source Annotationは補助情報に限定し、`symbol.json`をRelationの正本とする。
- Local Test IDは、Test Symbolに結合したQA定義の検証項目へ実在する場合だけ受理する。
- Source Annotationが存在する場合は`symbol.json`との不一致を検出し、Annotationの不在は拒否しない。
- 新Subsystem追加でChecker Coreを変更しない。

## 4. 検証と残るGate

| Gate | 状態 | 完了条件 |
|---|---|---|
| Quality設計 | Complete | 157 Canonical ID、13 QA、110 Local Item、43詳細設計検証単位がCanonicalで独立レビューPass |
| Checker現挙動固定 | Complete | 静的入口、Repository Checker 0／0、全契約試験383／383 Pass |
| Checker責務分割 | Complete | Pipeline、Model、Schema、Relation、Rule、Findingの局所契約2／2と実Gitサブモジュール配布Consumer縦断1／1がPass |
| Checker独立レビュー | Complete | Critical／Major／Moderate／Minor 0 |
| Symbol Schema／Graph | Complete | 共通Schema、9 Subsystemの動的Discovery、ARCH／QA／実装／試験の双方向照会、全入力Finding Gate、Path実体境界、Test Catalog閉包、Local Test所有、`verifies`、任意Annotation不一致を契約試験13／13で確認 |
| Reality Traceability独立レビュー | Complete | Critical／Major／Moderate／Minor 0 |
| Reality Audit | Not Started | 本変更完了後に別Gateとして開始 |

## Checklist

- [x] 変更目的とReality Audit前の順序を固定した
- [x] Checkerの決定論的責務と独立監査の責務を分けた
- [x] 現行Contractを挙動保存境界として明示した
- [x] Reality TraceabilityをCanonical設計の第二正本にしていない
- [x] Source AnnotationをRelationの正本にしていない
- [x] Reality Auditを未開始として分離した
- [x] Checker責務分割を完了した
- [x] Checker独立レビューを完了した
- [x] Symbol SchemaとGlobal Symbol Graphを完了した
- [x] Reality Traceability独立レビューを完了した

初回のReality Traceability独立レビューは、Path実体境界、無効ManifestのGraph混入、Test Catalogとの閉包、Annotationの誤認防止に不足を検出した。Pathの各要素と実体Pathを検査し、検査中に観測不能となった対象を拒否する。Validation Findingを持つManifestはGraphへ渡さず、Test SymbolはChecker Adapterが取得したTest Catalog登録集合へ閉じる。Annotationは独立したcomment行だけをHintとして認識し、実装へのQA注釈と試験へのARCH注釈を拒否する。

初回是正後の再レビューでは、Graph-level Findingがあっても部分Graphを返す経路と、Test Catalog／Quality Definition読取りが同じRepository境界を通らない経路を検出した。GraphはFinding 0の場合だけ発行し、Catalog／Definition／Sourceは共通のRepository File Observerを介して読む。現在は二回目の是正後再レビュー待ちである。

二回目是正後の再レビューでは、個別Builderは閉じたが、DiscoveryとCatalogのFindingを含む全入力Gate、および`40_Develop`からSubsystem／Manifestまでの上位Directory境界が不足していた。Global Graph Factoryは全入力Findingが0の場合だけGraphを発行し、`40_Develop`、Subsystem、Manifestも共通ObserverでRepository内の通常Directory／Fileとして観測する是正を行った。

三回目の独立再レビューはCritical／Major／Moderate／Minor 0でPassした。全入力Finding Gate、上位Directory境界、Catalog／Definition／Sourceの通常File境界、部分Graph非発行、動的Subsystem参加、Annotation非正本、Checkerと意味監査の責務分離が一致している。Reality Auditは別Gateとして未開始であり、本変更は構造成立を`Covered`、実装済み、試験済みまたは合格済みへ昇格しない。

## 5. 実装中に検出したConsumer Closure

| 検出 | 原因 | 是正 |
|---|---|---|
| 実Gitサブモジュール内の配布Checkerだけが起動時にmodule解決失敗 | 配布fixtureが旧来の単一`crdd-check.ts`だけを複製し、責務分割後の`internal/checker`をConsumer集合へ含めていなかった | 配布入口と内部Checker module群を同じfixtureへ配置し、実サブモジュール経路で起動する契約試験を維持する |
| Symbol Graph試験の追加後に回帰Runner全体が試験台帳不整合で停止 | 新しい試験Sourceを追加したが、実行可能試験集合の正本であるTest Catalogへ同じ変更単位で登録していなかった | `checker:unit:symbol-graph`を登録し、実在試験、登録試験、実行Ownerのexact一致を先に確認する |
| 実Gitサブモジュールfixture内でReality Traceability moduleだけが解決不能 | 配布Consumerの複製対象を`internal/checker`へ固定し、新しい依存moduleの閉包を同じ入口から導出していなかった | `internal/reality-traceability`も配布fixtureへ含め、実入口のmodule closureを縦断試験で確認する |

この失敗はCheckerの判定差ではなく、責務移動後の配布Consumer取り残しである。単体のPipeline試験だけで完了とせず、採用Repositoryの実入口まで含む縦断契約で閉じる。

独立再レビューでは、工程別Profile本体がcallback移行中であることを分離完了と誤表示していないこと、Checkerへ意味監査を取り込んでいないこと、CLI／Finding／終了値／Rule順序／Quality状態の意味を維持していることを確認した。初回レビューが検出した12件の内部命名違反と固定試験件数表現を是正し、再レビューはCritical／Major／Moderate／Minor 0でPassした。
