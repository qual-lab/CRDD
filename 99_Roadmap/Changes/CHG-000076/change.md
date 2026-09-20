# CRDD Domain Library責務分離

変更ID: `CHG-000076`
状態: `Implementation Complete — Coordinator Runtime Gate Pending`
決定権限: Qual-Lab
対象版: `v0.21.0`
変更分類: `tool_architecture_boundary_change`

## 1. 変更の目的

`template/tools/internal/`に同居するChecker固有処理、CRDD共通DomainおよびRepository／Version Control基盤を分類し、実装正本を`40_Develop`へ集約する。`template/tools`は薄い起動入口と設定配置に限定し、MCP／Workbench等の利用側がChecker内部へ依存しない公開境界を設計する。

```text
現在
  Checker internal
     ├ Checker固有
     ├ Artifact／Relation
     ├ Reality Traceability
     ├ Semantic Coverage
     └ Repository／Version Control

目標
  CRDD Domain Library ─┬─ Checker
                       ├─ MCP
                       ├─ Workbench
                       └─ Generator

  Repository／Version Control Adapter
           └──────────→ Domain／Consumer
```

本変更では設計、全Module分類、公開入口および依存方向を先に固定し、独立レビュー済みの段階移行としてSourceを移す。Phase 1の実装正本の受け皿に続き、Phase 2ではCommon Outcome、Reality Traceability、Semantic Coverage、Repository ObservationおよびSemantic Publisherを`40_Develop`へ移した。Phase 3ではArtifact Model、Markdown Parser、Schema ValidatorおよびRelation Graphを公開Domainへ移し、Checker固有Findingとの境界を独立レビューまで完了した。Phase 4ではChecker向けVersion Control生成Artifactを廃止し、同じ基準版Rootの公開AdapterへConsumerを統合して独立レビューまで完了した。Phase 5ではChecker固有のPipeline、Finding、Rule RegistryおよびProfile RuleをChecker実装正本へ移している。

## 2. 現在状態と構造変更

| 対象 | 現在 | 本変更で固定する状態 |
|---|---|---|
| `internal` | Checker内部と共通能力が同居 | 廃止し、Capability／責務／外部境界を表すDirectoryへ移行。非公開性は宣言済み`index.ts`のexport集合で管理 |
| `template/tools` | 起動入口とChecker／Domain実装本体が同居 | 起動入口と設定／Schemaに限定し、業務ロジックを0にする |
| `40_Develop` | 開発・試験入口と一部Capabilityの正本 | Checker、CRDD Domain Library、RepositoryおよびVersion Controlの実装正本 |
| Artifact／Relation | Checkerの`FindingSink`へ依存 | 中立なDomain Result／Issueを返し、Checker AdapterでFindingへ変換 |
| Reality Traceability | Checker内部に見えるPath | CRDD共通Domainの独立した公開Capability |
| Semantic Coverage | Checker補助成果物として配置 | Domain Libraryを利用して意味IRの編纂、Coverage結合およびBundle公開を行う独立Application Subsystem |
| Repository観測 | Reality Traceability配下 | Domain意味を持たないRepository基盤 |
| Version Control | `internal`直下 | 既存Version Control Architectureが所有する公開Adapter |
| MCP／Workbench | 将来Consumer候補 | Checker内部ではなく公開Domain／Application Contractだけを利用 |

[CRDD Domain Libraryの責務境界](../../../06_Architecture/Details/crdd-domain-library/01_Architecture.md)を目標設計とModule分類の正本とする。

### 影響ファイル

<details>
<summary>全ファイルを表示</summary>

- [`06_Architecture/01_Architecture.md`](../../../06_Architecture/01_Architecture.md)
- [`00_Overview.md`](../../../00_Overview.md)
- [`06_Architecture/07_Detail_Architecture_Map.md`](../../../06_Architecture/07_Detail_Architecture_Map.md)
- [`06_Architecture/99_Coding_Standards.md`](../../../06_Architecture/99_Coding_Standards.md)
- [`06_Architecture/Details/crdd-domain-library/01_Architecture.md`](../../../06_Architecture/Details/crdd-domain-library/01_Architecture.md)
- [`06_Architecture/Details/checker/01_Architecture.md`](../../../06_Architecture/Details/checker/01_Architecture.md)
- [`06_Architecture/Details/semantic-coverage/02_Semantic_IR_and_Relation_Design.md`](../../../06_Architecture/Details/semantic-coverage/02_Semantic_IR_and_Relation_Design.md)
- [`06_Architecture/Details/coordinator/01_Architecture.md`](../../../06_Architecture/Details/coordinator/01_Architecture.md)
- [`06_Architecture/Details/platform-access/01_Architecture.md`](../../../06_Architecture/Details/platform-access/01_Architecture.md)
- [`06_Architecture/Details/version-control/01_Architecture.md`](../../../06_Architecture/Details/version-control/01_Architecture.md)
- [`07_Quality/01_Quality_Center.md`](../../../07_Quality/01_Quality_Center.md)
- [`07_Quality/04_Quality_Integration.md`](../../../07_Quality/04_Quality_Integration.md)
- [`07_Quality/05_Current_Implementation_Reality_Audit.md`](../../../07_Quality/05_Current_Implementation_Reality_Audit.md)
- [`07_Quality/Definitions/QA-000001/quality_definition.md`](../../../07_Quality/Definitions/QA-000001/quality_definition.md)
- [`07_Quality/Definitions/QA-000007/quality_definition.md`](../../../07_Quality/Definitions/QA-000007/quality_definition.md)
- [`07_Quality/Definitions/QA-000010/quality_definition.md`](../../../07_Quality/Definitions/QA-000010/quality_definition.md)
- [`07_Quality/Definitions/QA-000013/quality_definition.md`](../../../07_Quality/Definitions/QA-000013/quality_definition.md)
- [`07_Quality/Registry/semantic-coverage-pilot.json`](../../../07_Quality/Registry/semantic-coverage-pilot.json)
- [`07_Quality/Registry/test-catalog.json`](../../../07_Quality/Registry/test-catalog.json)
- [`19_Workflows/01_Coordinator_Runtime.md`](../../../19_Workflows/01_Coordinator_Runtime.md)
- [`40_Develop/semantic-coverage/bin/compile-semantic-coverage-pilot.ts`](../../../40_Develop/semantic-coverage/bin/compile-semantic-coverage-pilot.ts)
- [`40_Develop/checker/src/application/checker-command.ts`](../../../40_Develop/checker/src/application/checker-command.ts)
- [`40_Develop/checker/src/profiles/current-profile.ts`](../../../40_Develop/checker/src/profiles/current-profile.ts)
- [`40_Develop/checker/src/index.ts`](../../../40_Develop/checker/src/index.ts)
- [`40_Develop/checker/src/adapters/artifact-relation.ts`](../../../40_Develop/checker/src/adapters/artifact-relation.ts)
- [`40_Develop/checker/src/adapters/reality-test-catalog.ts`](../../../40_Develop/checker/src/adapters/reality-test-catalog.ts)
- [`40_Develop/checker/src/adapters/reality-traceability.ts`](../../../40_Develop/checker/src/adapters/reality-traceability.ts)
- [`40_Develop/semantic-coverage/src/application/semantic-coverage.ts`](../../../40_Develop/semantic-coverage/src/application/semantic-coverage.ts)
- [`40_Develop/checker/src/pipeline/checker-pipeline.ts`](../../../40_Develop/checker/src/pipeline/checker-pipeline.ts)
- [`40_Develop/checker/src/findings/finding-model.ts`](../../../40_Develop/checker/src/findings/finding-model.ts)
- [`40_Develop/semantic-coverage/src/migrations/legacy-runtime-inventory.ts`](../../../40_Develop/semantic-coverage/src/migrations/legacy-runtime-inventory.ts)
- [`40_Develop/checker/src/rules/rule-registry.ts`](../../../40_Develop/checker/src/rules/rule-registry.ts)
- [`40_Develop/checker/src/rules/current-profile.ts`](../../../40_Develop/checker/src/rules/current-profile.ts)
- [`40_Develop/checker/src/rules/quality-design-state.ts`](../../../40_Develop/checker/src/rules/quality-design-state.ts)
- [`40_Develop/checker/src/rules/reality-symbol-graph.ts`](../../../40_Develop/checker/src/rules/reality-symbol-graph.ts)
- [`40_Develop/verification-runner/src/catalog/test-catalog.ts`](../../../40_Develop/verification-runner/src/catalog/test-catalog.ts)
- [`40_Develop/checker/tests/integration/crdd-check.contract.test.ts`](../../../40_Develop/checker/tests/integration/crdd-check.contract.test.ts)
- [`40_Develop/checker/bin/crdd-check.ts`](../../../40_Develop/checker/bin/crdd-check.ts)
- [`40_Develop/checker/package.json`](../../../40_Develop/checker/package.json)
- [`40_Develop/semantic-coverage/tests/unit/semantic-coverage-pilot.contract.test.ts`](../../../40_Develop/semantic-coverage/tests/unit/semantic-coverage-pilot.contract.test.ts)
- [`40_Develop/checker/tests/unit/symbol-graph.contract.test.ts`](../../../40_Develop/checker/tests/unit/symbol-graph.contract.test.ts)
- [`40_Develop/verification-runner/tests/unit/test-catalog.contract.test.ts`](../../../40_Develop/verification-runner/tests/unit/test-catalog.contract.test.ts)
- [`40_Develop/checker/tsconfig.json`](../../../40_Develop/checker/tsconfig.json)
- [`40_Develop/crdd-domain-library/package-lock.json`](../../../40_Develop/crdd-domain-library/package-lock.json)
- [`40_Develop/crdd-domain-library/package.json`](../../../40_Develop/crdd-domain-library/package.json)
- [`40_Develop/semantic-coverage/src/application/semantic-bundle.ts`](../../../40_Develop/semantic-coverage/src/application/semantic-bundle.ts)
- [`40_Develop/crdd-domain-library/src/outcome.ts`](../../../40_Develop/crdd-domain-library/src/outcome.ts)
- [`40_Develop/crdd-domain-library/src/artifact/artifact-model.ts`](../../../40_Develop/crdd-domain-library/src/artifact/artifact-model.ts)
- [`40_Develop/crdd-domain-library/src/artifact/index.ts`](../../../40_Develop/crdd-domain-library/src/artifact/index.ts)
- [`40_Develop/crdd-domain-library/src/artifact/markdown-artifact-parser.ts`](../../../40_Develop/crdd-domain-library/src/artifact/markdown-artifact-parser.ts)
- [`40_Develop/crdd-domain-library/src/artifact/schema-validator.ts`](../../../40_Develop/crdd-domain-library/src/artifact/schema-validator.ts)
- [`40_Develop/crdd-domain-library/src/artifact/artifact-graph.ts`](../../../40_Develop/crdd-domain-library/src/artifact/artifact-graph.ts)
- [`40_Develop/crdd-domain-library/src/artifact/index.ts`](../../../40_Develop/crdd-domain-library/src/artifact/index.ts)
- [`40_Develop/crdd-domain-library/src/reality-traceability/index.ts`](../../../40_Develop/crdd-domain-library/src/reality-traceability/index.ts)
- [`40_Develop/crdd-domain-library/src/reality-traceability/domain-issue.ts`](../../../40_Develop/crdd-domain-library/src/reality-traceability/domain-issue.ts)
- [`40_Develop/crdd-domain-library/src/reality-traceability/symbol-annotation.ts`](../../../40_Develop/crdd-domain-library/src/reality-traceability/symbol-annotation.ts)
- [`40_Develop/crdd-domain-library/src/reality-traceability/symbol-graph.ts`](../../../40_Develop/crdd-domain-library/src/reality-traceability/symbol-graph.ts)
- [`40_Develop/crdd-domain-library/src/reality-traceability/symbol-discovery.ts`](../../../40_Develop/crdd-domain-library/src/reality-traceability/symbol-discovery.ts)
- [`40_Develop/crdd-domain-library/src/reality-traceability/symbol-manifest-model.ts`](../../../40_Develop/crdd-domain-library/src/reality-traceability/symbol-manifest-model.ts)
- [`40_Develop/crdd-domain-library/src/reality-traceability/symbol-manifest-validator.ts`](../../../40_Develop/crdd-domain-library/src/reality-traceability/symbol-manifest-validator.ts)
- [`40_Develop/semantic-coverage/src/index.ts`](../../../40_Develop/semantic-coverage/src/index.ts)
- [`40_Develop/semantic-coverage/src/compilation/quality-semantic-relation.ts`](../../../40_Develop/semantic-coverage/src/compilation/quality-semantic-relation.ts)
- [`40_Develop/semantic-coverage/src/coverage/semantic-coverage-graph.ts`](../../../40_Develop/semantic-coverage/src/coverage/semantic-coverage-graph.ts)
- [`40_Develop/semantic-coverage/src/compilation/semantic-ir-compiler.ts`](../../../40_Develop/semantic-coverage/src/compilation/semantic-ir-compiler.ts)
- [`40_Develop/crdd-domain-library/src/repository-observation/index.ts`](../../../40_Develop/crdd-domain-library/src/repository-observation/index.ts)
- [`40_Develop/crdd-domain-library/src/repository-observation/filesystem-repository-observer.ts`](../../../40_Develop/crdd-domain-library/src/repository-observation/filesystem-repository-observer.ts)
- [`40_Develop/semantic-coverage/src/infrastructure/filesystem-semantic-bundle-publisher.ts`](../../../40_Develop/semantic-coverage/src/infrastructure/filesystem-semantic-bundle-publisher.ts)
- [`40_Develop/crdd-domain-library/symbol.json`](../../../40_Develop/crdd-domain-library/symbol.json)
- [`40_Develop/crdd-domain-library/tests/integration/reality-repository.integration.test.ts`](../../../40_Develop/crdd-domain-library/tests/integration/reality-repository.integration.test.ts)
- [`40_Develop/semantic-coverage/tests/integration/semantic-bundle-publisher.integration.test.ts`](../../../40_Develop/semantic-coverage/tests/integration/semantic-bundle-publisher.integration.test.ts)
- [`40_Develop/crdd-domain-library/tests/unit/public-boundary.contract.test.ts`](../../../40_Develop/crdd-domain-library/tests/unit/public-boundary.contract.test.ts)
- [`40_Develop/crdd-domain-library/tests/unit/repository-observation.contract.test.ts`](../../../40_Develop/crdd-domain-library/tests/unit/repository-observation.contract.test.ts)
- [`40_Develop/crdd-domain-library/tsconfig.json`](../../../40_Develop/crdd-domain-library/tsconfig.json)
- [`40_Develop/version-control/package.json`](../../../40_Develop/version-control/package.json)
- [`40_Develop/version-control/src/git/checker-repository-observation-adapter.ts`](../../../40_Develop/version-control/src/git/checker-repository-observation-adapter.ts)
- [`40_Develop/version-control/src/index.ts`](../../../40_Develop/version-control/src/index.ts)
- [`40_Develop/version-control/symbol.json`](../../../40_Develop/version-control/symbol.json)
- [`40_Develop/version-control/tests/integration/consumer-closure.integration.test.ts`](../../../40_Develop/version-control/tests/integration/consumer-closure.integration.test.ts)
- `40_Develop/version-control/scripts/generate-checker-runtime.ts`（削除）
- `40_Develop/version-control/src/distribution/checker-version-control-runtime.ts` → [`40_Develop/version-control/src/git/checker-repository-observation-adapter.ts`](../../../40_Develop/version-control/src/git/checker-repository-observation-adapter.ts)
- `template/tools/internal/reality-traceability/repository-regular-file-observer.ts` → [`40_Develop/crdd-domain-library/src/repository-observation/filesystem-repository-observer.ts`](../../../40_Develop/crdd-domain-library/src/repository-observation/filesystem-repository-observer.ts)
- `template/tools/internal/reality-traceability/symbol-annotation.ts` → [`40_Develop/crdd-domain-library/src/reality-traceability/symbol-annotation.ts`](../../../40_Develop/crdd-domain-library/src/reality-traceability/symbol-annotation.ts)
- `template/tools/internal/reality-traceability/symbol-discovery.ts` → [`40_Develop/crdd-domain-library/src/reality-traceability/symbol-discovery.ts`](../../../40_Develop/crdd-domain-library/src/reality-traceability/symbol-discovery.ts)
- `template/tools/internal/reality-traceability/symbol-graph.ts` → [`40_Develop/crdd-domain-library/src/reality-traceability/symbol-graph.ts`](../../../40_Develop/crdd-domain-library/src/reality-traceability/symbol-graph.ts)
- `template/tools/internal/reality-traceability/symbol-manifest-model.ts` → [`40_Develop/crdd-domain-library/src/reality-traceability/symbol-manifest-model.ts`](../../../40_Develop/crdd-domain-library/src/reality-traceability/symbol-manifest-model.ts)
- `template/tools/internal/reality-traceability/symbol-manifest-validator.ts` → [`40_Develop/crdd-domain-library/src/reality-traceability/symbol-manifest-validator.ts`](../../../40_Develop/crdd-domain-library/src/reality-traceability/symbol-manifest-validator.ts)
- `template/tools/internal/semantic-coverage/legacy-runtime-inventory.ts` → [`40_Develop/semantic-coverage/src/migrations/legacy-runtime-inventory.ts`](../../../40_Develop/semantic-coverage/src/migrations/legacy-runtime-inventory.ts)
- `template/tools/internal/semantic-coverage/quality-semantic-relation.ts` → [`40_Develop/semantic-coverage/src/compilation/quality-semantic-relation.ts`](../../../40_Develop/semantic-coverage/src/compilation/quality-semantic-relation.ts)
- `template/tools/internal/semantic-coverage/semantic-bundle-writer.ts` → [`40_Develop/semantic-coverage/src/infrastructure/filesystem-semantic-bundle-publisher.ts`](../../../40_Develop/semantic-coverage/src/infrastructure/filesystem-semantic-bundle-publisher.ts)
- `template/tools/internal/semantic-coverage/semantic-coverage-graph.ts` → [`40_Develop/semantic-coverage/src/coverage/semantic-coverage-graph.ts`](../../../40_Develop/semantic-coverage/src/coverage/semantic-coverage-graph.ts)
- `template/tools/internal/semantic-coverage/semantic-ir-compiler.ts` → [`40_Develop/semantic-coverage/src/compilation/semantic-ir-compiler.ts`](../../../40_Develop/semantic-coverage/src/compilation/semantic-ir-compiler.ts)
- `template/tools/internal/checker/rules/reality-test-catalog-adapter.ts` → [`40_Develop/checker/src/adapters/reality-test-catalog.ts`](../../../40_Develop/checker/src/adapters/reality-test-catalog.ts)
- `template/tools/internal/checker/checker-pipeline.ts` → [`40_Develop/checker/src/pipeline/checker-pipeline.ts`](../../../40_Develop/checker/src/pipeline/checker-pipeline.ts)
- `template/tools/internal/checker/finding-model.ts` → [`40_Develop/checker/src/findings/finding-model.ts`](../../../40_Develop/checker/src/findings/finding-model.ts)
- `template/tools/internal/checker/rule-registry.ts` → [`40_Develop/checker/src/rules/rule-registry.ts`](../../../40_Develop/checker/src/rules/rule-registry.ts)
- `template/tools/internal/checker/rules/current-profile.ts` → [`40_Develop/checker/src/rules/current-profile.ts`](../../../40_Develop/checker/src/rules/current-profile.ts)
- `template/tools/internal/checker/rules/quality-design-state.ts` → [`40_Develop/checker/src/rules/quality-design-state.ts`](../../../40_Develop/checker/src/rules/quality-design-state.ts)
- `template/tools/internal/checker/rules/reality-symbol-graph.ts` → [`40_Develop/checker/src/rules/reality-symbol-graph.ts`](../../../40_Develop/checker/src/rules/reality-symbol-graph.ts)
- [`template/tools/crdd-check.ts`](../../../template/tools/crdd-check.ts)
- `template/tools/internal/version-control-runtime.ts`（削除）
- `template/tools/internal/checker/artifact-model.ts` → [`40_Develop/crdd-domain-library/src/artifact/artifact-model.ts`](../../../40_Develop/crdd-domain-library/src/artifact/artifact-model.ts)
- `template/tools/internal/checker/markdown-artifact-parser.ts` → [`40_Develop/crdd-domain-library/src/artifact/markdown-artifact-parser.ts`](../../../40_Develop/crdd-domain-library/src/artifact/markdown-artifact-parser.ts)
- `template/tools/internal/checker/schema-validator.ts` → [`40_Develop/crdd-domain-library/src/artifact/schema-validator.ts`](../../../40_Develop/crdd-domain-library/src/artifact/schema-validator.ts)
- `template/tools/internal/checker/relation-engine.ts` → [`40_Develop/crdd-domain-library/src/artifact/artifact-graph.ts`](../../../40_Develop/crdd-domain-library/src/artifact/artifact-graph.ts)
- [`99_Roadmap/Changes/CHG-000074/change.md`](../CHG-000074/change.md)
- [`99_Roadmap/Changes/CHG-000075/change.md`](../CHG-000075/change.md)
- [`99_Roadmap/Changes/CHG-000057/change.md`](../CHG-000057/change.md)
- [`99_Roadmap/Changes/CHG-000063/change.md`](../CHG-000063/change.md)
- [`99_Roadmap/Changes/CHG-000065/change.md`](../CHG-000065/change.md)
- [`99_Roadmap/Changes/CHG-000066/change.md`](../CHG-000066/change.md)
- [`99_Roadmap/Changes/CHG-000067/change.md`](../CHG-000067/change.md)
- [`99_Roadmap/Changes/CHG-000068/change.md`](../CHG-000068/change.md)
- [`99_Roadmap/Changes/CHG-000070/change.md`](../CHG-000070/change.md)
- [`99_Roadmap/Changes/CHG-000071/change.md`](../CHG-000071/change.md)
- [`99_Roadmap/01_Roadmap.md`](../../01_Roadmap.md)
- [`99_Roadmap/02_Changes.md`](../../02_Changes.md)
- [`99_Roadmap/Changes/CHG-000076/change.md`](change.md)

</details>

## 3. 成立条件

- `template/tools/internal/`配下の全Moduleを、Owner、目標Path、公開判断および移行前提付きで一件ずつ分類する。
- Checker固有、CRDD共通Domain、Repository／Version Control Infrastructureを区別する。
- `template/tools`には薄いlauncherと設定／Schemaだけを残し、実装本体を`40_Develop`に一本化する。
- Capability別公開入口と禁止する依存方向を定義する。
- Artifact／RelationからChecker `FindingSink`への逆依存を移動前の解消条件にする。
- 現在のConsumerと将来Consumer候補を区別する。
- 物理移動を段階化し、各段階でConsumer Closureを確認する。
- 本設計の独立レビューがPassするまで物理移動を開始しない。

## 4. 非目標

- `internal`から`core`への名前だけの一括置換
- 本変更の設計Gate内でのSource移動
- `template/tools`だけをコピーした単独実行の互換維持
- MCP／Workbenchの実装
- 巨大な単一Barrelの新設
- Reality Auditの開始
- Git AdapterのDomain化

## 5. Gate

| Gate | 状態 | 完了条件 |
|---|---|---|
| Module／Template Surface全数分類 | Complete | `internal`の23 Moduleと直下／配下の7 Entry、合計30件を一件ずつ分類した |
| 公開境界設計 | Complete | Capability別入口、依存方向、結果境界を定義した |
| Consumer棚卸し | Complete | 現在Consumerと将来候補を分け、移行対象を記録した |
| 独立レビュー | Complete | Critical／Major／Moderate／Minorすべて0でPassした |
| Source物理移動準備 | Complete | Phase 1でRoot Identity契約と拒否条件を固定し、Phase 6で配布入口を同じ基準版Root内の公式CLIへ相対接続した |
| Phase 2 Reality／Semantic公開 | Complete | Reality／Semanticの公開API、Repository Observation、Semantic Publisher、Checker変換Adapter、安全境界の反証試験を固定した。Checkerと開発Toolを公開入口へ移行し、旧deep import 0、局所試験、全Catalog回帰、Repository Checkerおよび独立再レビューを完了した |
| Phase 3 Artifact／Relation分離 | Complete | Artifact Model、Parser、SchemaおよびRelationを公開Domainへ移し、Checker Finding変換、Consumer Closure、局所試験、全Catalog回帰、Repository Checkerおよび独立再レビューを完了した |
| Phase 4 Version Control公開 | Complete | Checker向け生成Artifactを廃止し、同じ基準版RootのVersion Control公開入口へConsumerを統合した。公開Symbol完全一致、局所結合試験、Checker実物契約、全Catalog回帰、Repository Checkerおよび独立レビューがPassした |
| Phase 5 Checker内部整理 | Complete | Pipeline、Finding、Rule RegistryおよびProfile RuleをChecker実装正本へ移し、旧Template所有Pathを削除した。型・Lint・Formatter、局所反証、全Catalog回帰、Repository Checkerおよび独立再レビューがPassした |
| Phase 6 Directory規則／launcher薄型化 | Complete | 汎用`internal/`とChecker Package Root直下実装を廃止し、Domain Library、Semantic Coverage、Verification Runnerおよび利用側を責務別Directoryへ移行した。Checker公開Use Caseと現行Profile本体を物理分離し、狭いVersion Control公開入口とConsumer Closureも是正した。Checkerは読取り専用Toolであり、Coordinatorの署名済みRuntime閉包へ含めない |
| Reality Audit | Not Started | 本変更とは別Gateで扱う |

## 6. 検証方針

設計Gateでは、リンク、Module全数、既存Consumer、Architecture RelationおよびCheckerとの責務境界を確認する。物理移動Gateでは、各PhaseごとにFormatter、型検査、Lint、局所契約試験、全Catalog回帰、Repository CheckerおよびConsumer Closureを実行する。

## 7. 独立レビュー結果

| 対象改訂版 | 結果 | 指摘と是正 | 保持した境界 |
|---|---|---|---|
| 2026-09-20固定候補 | Pass | 現行所有者とv0.21目標の表示、開発Root／採用RootのIdentity、Quality 113件＋追加1件の状態を是正後に再レビュー | 30件全数分類、公開API allowlist、fallbackなし拒否、Source物理移動0、Reality Audit未開始 |
| 2026-09-20 Phase 1 Root Identity契約 | Pass | Path suffix一致、POSIX大小文字、境界観測、相対Path、Win32 root-relativeを理由別に反証し、完全修飾drive／UNCとPOSIX絶対Pathだけを受理 | 当時は配布入口接続とChecker本体移動が未完了。Phase 6で完了。Reality Auditは別Gate |
| 2026-09-20 Phase 2 Reality／Repository最初のSlice | Pass | DomainでChecker Findingを生成する逆依存、Repository Root／Path／Handle証明、Version Controlの非公開deep importを是正後に再レビューし、Critical／Major／Moderate／Minorすべて0を確認 | Windows Handle所在証明Adapter、Semantic移行およびConsumer Closureを次の固定候補で確認 |
| 2026-09-20 Phase 2完了候補 | Pass | 初回レビューで検出したReality `internal`へのdeep importとSemantic Domain内のChecker形Findingを是正した。Domain kind 30件とChecker明示変換30件の完全一致、未知kind／detail欠落のfail closed、公開入口限定を再レビューし、Critical／Major／Moderate／Minorすべて0を確認した | Artifact／Relation、Version Control、Checker全体、launcher／配布およびReality Auditは後続Phase |
| 2026-09-20 Phase 3完了候補 | Pass | Artifact Model、Markdown Parser、Schema ValidatorおよびRelation Graphを公開Domainへ移し、Checker固有Finding変換をAdapterへ分離した。初回レビューで検出したArchitectureの移行前状態を示す現在形1件を是正し、Critical／Major／Moderate／Minorすべて0を確認した | Version Control、Checker全体、launcher／配布およびReality Auditは後続Phase |
| 2026-09-20 Phase 4完了候補 | Pass | Checker向けVersion Control生成Artifactと生成Scriptを廃止し、同じ基準版Rootの公開入口へConsumerを統合した。初回Major 1件の公開Symbol正本不一致を是正し、Version Control局所結合39/39、公開Symbol 60/60の設計・実装完全一致、Checker実物契約327/327、全Catalog回帰399/399およびRepository Checker 0/0を確認した。独立再レビューはCritical／Major／Moderate／Minorすべて0でPassした | Checker全体、launcher薄型化、配布Consumer ClosureおよびReality Auditは後続Phase |
| 2026-09-20 Phase 5完了候補 | Pass | Checker固有6 ModuleをChecker実装正本へ移し、旧Template DirectoryとFixture Consumerを閉じた。初回Minor 2件の移行前／現在状態と残Gate表示を是正し、全Catalog回帰400/400、Repository Checker 0/0および独立再レビューCritical／Major／Moderate／Minorすべて0を確認した | launcher薄型化、Directory規則統一、配布Consumer ClosureおよびReality Auditは後続Phase |

## 8. Phase 1検証結果

| 検証 | 結果 | 確認内容 |
|---|---|---|
| Root Identity局所契約 | Pass（7/7） | 開発Root、任意名の採用Root、UNC、誤Path、相対Path、Win32 root-relative、POSIX大小文字を確認 |
| Test Catalogを含む局所回帰 | Pass（26/26） | Root Identity契約と試験登録・実行Ownerの整合を確認 |
| Formatter／型／Lint | Pass | Biome、TypeScript、WarningをErrorとするLintが完了 |
| Repository Checker | Pass | errors 0、warnings 0 |
| Checker全Catalog回帰 | Pass（400/400） | 期待値変更で逃がさず、命名規約を実装側で是正後に全件再実行 |

Phase 1で成立した範囲はRoot Identityと拒否境界の契約までだった。その後Phase 6で配布入口とChecker本体の移動を完了した。採用Repositoryでの配布実測とReality Auditは、Phase 6のSource配置完了とは分けて後続Gateで扱う。

## 9. Phase 2完了結果

| 対象 | 完了した処置 | 後続Phaseへ残す範囲 |
|---|---|---|
| Common Outcome | `DomainOutcome<T>`、`DomainIssue`、`DomainLocation`を公開契約にし、Realityの中立結果へ適用した | Artifact／Relationへの適用はPhase 3 |
| Reality Traceability | Manifest、Discovery、GraphおよびAnnotationを公開入口へ統合し、Checker表示への変換をChecker Adapterへ分離した | Reality Audit自体は別Gate |
| Semantic Coverage | IR、Quality Relation、Coverage GraphおよびBundle生成を純粋Domain APIへ移した | Pilot表示の解除判断と全Subsystem展開は別Change |
| Repository Observation | 検証済みRoot Capabilityだけを受け取るPortを公開し、Directory列挙とWindows／Linuxの実File観測をHandle所在証明へ接続した | 代替Version Control AdapterはPhase 4 |
| Semantic Publisher | Bundle計算をDomain、公開調停をApplication、atomic publish／fsync／readback／cleanupをRepositoryへ分離した | 他の公開Artifactへの一般化は必要時に別設計 |
| Consumer Closure | Checker Rule、Adapter、開発Tool、試験およびCatalogを公開入口へ移し、旧Reality／Semantic deep importと旧実装Fileを0にした | Artifact／Relation等の旧Pathは各後続Phaseで閉じる |

検証結果はDomain Package 20/20、Checker局所契約 21/21、Repository Checker errors 0／warnings 0、Checker全Catalog回帰398/398である。旧`template/tools/internal/reality-traceability`および`semantic-coverage`へのdeep importは0で、CheckerとTemplate ToolからCRDD Domain Libraryの非`index.ts`入口へのimportも0である。DomainはCheckerの診断code／表示文やFilesystem Effectを生成せず、Checker AdapterとRepository Publisherが各境界の責務を持つ。Phase 2完了は、採用Repository配布、Reality Audit、または後続Capabilityの移行完了を意味しない。

## 10. Phase 3完了結果

| 対象 | 完了した処置 | 後続Phaseへ残す範囲 |
|---|---|---|
| Artifact | ModelとMarkdown Parserを`domain/artifact`へ移し、旧Parserと同じ可視本文、Property、RelationおよびChecklist解釈を維持した | Version Control、Checker全体および配布Consumerは後続Phase |
| Schema | `FindingSink`を除去し、Schema ID、欠落Property／Section、無効Statusを中立Issueとして返した | 新しいSchema契約の追加は後続する個別変更で扱う |
| Relation | Canonical ID重複を中立Issueとし、重複があっても既知Graphを`partial`で返した | Reality Audit自体は別Gate |
| Checker Adapter | 中立Issueを従来code／rule／messageへ明示変換し、未知kindとdetail欠落を拒否した | Checker全体移行は後続Phase |

検証結果はDomain Package 22/22、Checker統合契約327/327、Test Catalog／Symbol Graph局所契約30/30、Checker全Catalog回帰399/399、Repository Checker errors 0／warnings 0、型・Lint・Formatter Passである。旧4実装Pathは移行表示以外の実参照0、CheckerとTemplate ToolからArtifact／Relation Domainへのimportは公開`index.ts`だけである。独立再レビューはCritical／Major／Moderate／Minorすべて0でPassした。Phase 3完了はVersion Control、Checker全体、launcher／配布またはReality Auditの完了を意味しない。

## 11. Phase 4完了結果

| 対象 | 完了した処置 | 後続Phaseへ残す範囲 |
|---|---|---|
| Version Control Adapter | Checker固有のRepository一覧、入れ子Repository、固定SnapshotおよびRevision観測を`src/git`へ移し、公開`index.ts`から提供した | 新しいVersion Control能力は個別変更で扱う |
| Checker Consumer | `template/tools/crdd-check.ts`を同じ基準版RootのVersion Control公開入口へ接続した | Checker全体移行とlauncher薄型化は後続Phase |
| 配布複製 | 生成Script、配布用Sourceおよび`template/tools/internal`の複製Artifactを削除した | 配布入口と実装Ownerの接続はPhase 6 |
| Consumer Closure | 開発Rootと実Git submodule Fixtureの両方で同じ相対配置を利用し、`template/tools`単独コピーを再導入しない契約へ更新した | Reality Auditは別Gate |

検証結果は、Version ControlとCheckerの型・Lint・Formatter Pass、実Gitを含む局所結合39/39、Version Control Architectureに宣言した公開Symbol 60件と`src/index.ts`の完全一致、Checker実物契約327/327、全Catalog回帰399/399およびRepository Checker errors 0／warnings 0である。Phase 2で追加されたSemantic IR生成ToolのRepository Root Consumer登録漏れ1件も実Sourceから確認して宣言集合へ追加した。独立再レビューはCritical／Major／Moderate／Minorすべて0でPassした。Phase 4完了はChecker全体、launcher薄型化、配布Consumer ClosureまたはReality Auditの完了を意味しない。

## 12. Phase 5完了結果

| 対象 | 完了した処置 | 後続Phaseへ残す範囲 |
|---|---|---|
| Checker固有Model | FindingとFinding Collectorを`40_Develop/checker/src`の責務別Directoryへ移した | Phase 6で配置規則を統一した |
| Checker実行編成 | PipelineとRule RegistryをChecker実装正本へ移し、Domain公開入口とChecker Adapterを合成する依存方向を維持した | launcher薄型化はPhase 6 |
| 現行Profile | 現行工程順、Quality状態RuleおよびReality Symbol Graph RuleをChecker実装正本へ移した | 工程別検査本体の移行はPhase 6 |
| Consumer Closure | 配布入口、Checker試験および実Git submodule Fixtureを新Ownerへ移し、旧`template/tools/internal/checker`を削除した | 配布Consumer ClosureとReality Auditは後続Phase |

検証結果は、Checkerの型・Lint・Formatter、Checker固有Module所有契約、実Git submodule経路の局所反証、全Catalog回帰400/400およびRepository Checker errors 0／warnings 0がPassした。初回の実物契約全件実行では旧Template Directoryを複製するFixture 1件を検出し、新Ownerの`40_Develop/checker/src`だけを複製する経路へ是正して局所Passを確認した。期待値は変更していない。独立再レビューはCritical／Major／Moderate／Minorすべて0でPassした。Phase 5完了はPhase 6のlauncher薄型化とDirectory規則統一、配布Consumer ClosureまたはReality Auditの完了を意味しない。

## 13. Phase 6 Source配置移行

### 13.1 汎用`internal`の廃止

次表は、移行開始時にSourceから自動導出した管理対象19件の全数処置である。公開／非公開はDirectory名ではなく、Architectureで宣言した`index.ts`とexport集合で制御する。

| # | 移行前Path | 移行先Path |
|---:|---|---|
| 1 | `checker/src/internal/adapters/artifact-relation.ts` | `checker/src/adapters/artifact-relation.ts` |
| 2 | `checker/src/internal/adapters/reality-test-catalog.ts` | `checker/src/adapters/reality-test-catalog.ts` |
| 3 | `checker/src/internal/adapters/reality-traceability.ts` | `checker/src/adapters/reality-traceability.ts` |
| 4 | `checker/src/internal/adapters/semantic-coverage.ts` | `semantic-coverage/src/application/semantic-coverage.ts` |
| 5 | `checker/src/internal/checker-pipeline.ts` | `checker/src/pipeline/checker-pipeline.ts` |
| 6 | `checker/src/internal/finding-model.ts` | `checker/src/findings/finding-model.ts` |
| 7 | `checker/src/internal/migrations/legacy-runtime-inventory.ts` | `semantic-coverage/src/migrations/legacy-runtime-inventory.ts` |
| 8 | `checker/src/internal/rule-registry.ts` | `checker/src/rules/rule-registry.ts` |
| 9 | `checker/src/internal/rules/current-profile.ts` | `checker/src/rules/current-profile.ts` |
| 10 | `checker/src/internal/rules/quality-design-state.ts` | `checker/src/rules/quality-design-state.ts` |
| 11 | `checker/src/internal/rules/reality-symbol-graph.ts` | `checker/src/rules/reality-symbol-graph.ts` |
| 12 | `crdd-domain-library/src/reality-traceability/internal/domain-issue.ts` | `crdd-domain-library/src/reality-traceability/domain-issue.ts` |
| 13 | `crdd-domain-library/src/reality-traceability/internal/symbol-annotation.ts` | `crdd-domain-library/src/reality-traceability/symbol-annotation.ts` |
| 14 | `crdd-domain-library/src/repository/internal/filesystem-repository-observer.ts` | `crdd-domain-library/src/repository-observation/filesystem-repository-observer.ts` |
| 15 | `crdd-domain-library/src/repository/internal/filesystem-semantic-bundle-publisher.ts` | `semantic-coverage/src/infrastructure/filesystem-semantic-bundle-publisher.ts` |
| 16 | `execution-intelligence/src/internal/plain-data-snapshot.ts` | `execution-intelligence/src/boundary/plain-data-snapshot.ts` |
| 17 | `mcp/src/internal/plain-data-snapshot.ts` | `mcp/src/boundary/plain-data-snapshot.ts` |
| 18 | `project-runtime/src/internal/plain-data-snapshot.ts` | `project-runtime/src/boundary/plain-data-snapshot.ts` |
| 19 | `project-runtime/src/internal/repository-relative-path.ts` | `project-runtime/src/boundary/repository-relative-path.ts` |

移行前集合と表の左辺は完全一致し、移行先19件は重複しない。同名のPlain Data Snapshotは結果型、拒否理由および利用側が異なるため、本変更では意味統合しない。

### 13.2 Checker Package Rootの整理

Checker Package Rootに平置きされた8件も、同じSource配置規則で処置する。

| # | 移行前Path | 実装Owner／移行先Path | 追加する入口 | 接続する公開入口 | 処置 |
|---:|---|---|---|---|---|
| 1 | `checker/crdd-check.ts` | `checker/src/`の公開Checker Use Case | `checker/bin/crdd-check.ts` | `checker/src/index.ts` | 既存CLIを実装Ownerと薄い入口へ分割する。 |
| 2 | `checker/regression-runner.ts` | `verification-runner/src/application/regression-runner.ts` | `verification-runner/bin/regression-runner.ts` | `verification-runner/src/index.ts` | Checkerから検証実行責務を分離し、回帰段階の選択・実行、Process呼出し、Authority判定および計画・結果構築をVerification Runnerへ移す。CLIは引数受付・Use Case呼出し・表示・終了値反映だけにする。 |
| 3 | `checker/compile-semantic-ir-pilot.ts` | `semantic-coverage/src/application/semantic-coverage.ts` | `semantic-coverage/bin/compile-semantic-coverage-pilot.ts` | `semantic-coverage/src/index.ts` | 意味IR編纂をCheckerから分離し、用途限定の開発Pilotを独立Subsystemの薄い入口へ移す。 |
| 4 | `checker/regression-execution.ts` | `verification-runner/src/execution/regression-execution.ts` | なし | `verification-runner/src/index.ts` | 回帰段階の計画・実行CoreをVerification Runnerへ移す。 |
| 5 | `checker/test-catalog.ts` | `verification-runner/src/catalog/test-catalog.ts` | なし | `verification-runner/src/index.ts` | Test Catalog読取り・選択CoreをVerification Runnerへ移す。 |
| 6 | `checker/fault-injector.ts` | `checker/tests/support/fault-injector.ts` | なし | 試験対象の宣言済み入口 | 試験専用の異常注入器として移す。 |
| 7 | `checker/test-discovery.ts` | `checker/tests/support/test-discovery.ts` | なし | 試験対象の宣言済み入口 | 試験列挙支援として移す。 |
| 8 | `checker/test-runner.ts` | `checker/tests/test-runner.ts` | 同左 | 試験対象の宣言済み入口 | Checker試験入口として移す。 |

移行前のChecker Package Root直下`.ts`集合と表の左辺を完全一致させる。移行後はRoot直下`.ts`を0件とし、`bin/`と`scripts/`に実装本体を複製しない。`bin/`に許可するのは、引数受付、公開Use Caseの呼出し、構造化結果の表示および終了値反映だけである。package script、試験、現在有効なArchitecture／Workflowおよび変更トレースは同じ変更で新Pathへ移す。固定Evidence内の過去の実行Pathは変更しない。

### 13.3 完了条件

- CRDD所有Sourceの汎用`internal/`配下Fileが0件である。
- Checker Package Root直下の`.ts`が0件である。
- Checkerに回帰段階の選択・実行、Process呼出し、Authority判定またはTest Catalog所有が残っていない。
- Verification Runnerの`bin/`に試験選択、Process実行、Authority判定または計画・結果構築が残っていない。
- 移行前Pathごとに実装Ownerが一つだけ存在し、実装Ownerは重複しない。
- 分割で追加するlauncherは本表に明示し、接続する公開入口を一つに固定する。
- launcherは実装Ownerを複製せず、宣言した公開入口だけを利用する。
- Subsystem外ConsumerがArchitecture宣言済み公開入口だけを利用する。
- Formatter、型検査、Lint、局所契約試験、全Catalog回帰およびRepository CheckerがPassする。
- 独立レビューで移行表、Consumer Closureおよび非目標の維持を確認する。

### 13.4 現在の検証結果

| 検証 | 結果 | 確認内容 |
|---|---|---|
| Source配置契約 | Pass | 管理対象Subsystemの`internal/`配下TypeScript 0件、Checker Package Root直下TypeScript 0件、主要4 Packageの`src`配下3階層目以深0件 |
| Formatter／型／Lint | Pass | Coordinatorを含む変更Packageの静的確認を完了 |
| Package／局所契約 | Pass | Domain Library 20/20、Semantic Coverage 14/14、Version Control 39/39、Verification Runner 35/35を確認した。現行Test Catalog 192件は実在試験と完全一致する |
| Checker全Catalog回帰 | Pass | 用途限定入口、Profile分離および過剰な署名契約削除後の同一固定候補で351/351 Pass |
| Coordinator非Docker回帰 | Pass | 実Provider Effectを発行しないIntegration／System／Unit集合がPass。Platform Provisionerの配布Filesystem契約124/124もPass |
| Windows Process Gate | Blocked（7/8 Pass） | Docker Engine Pipeが存在せず、Codex Executor Sandboxの実Docker境界1件を実行できない。実装Assertionの失敗ではない |
| Repository Checker | Pass | errors 0、warnings 0 |
| 署名境界 | N/A | Checker、Domain Library、Semantic CoverageおよびVerification RunnerはCoordinator Runtime Authorityを発行しない。Coordinatorの署名済みRuntime閉包へ追加せず、通常のRepository境界、公開入口およびConsumer Closureで検証する |
| Phase 6独立レビュー | Pass | Critical／Major／Moderate／Minorすべて0。Test Catalogの削除済み試験参照も除去し、192件の実在試験との完全一致を再確認した |

長時間を要したPlatform Provisioner配布Filesystem契約は124件すべてPassした。一方、個別の異常注入ごとに配布Fixtureを再構築するため約8分33秒を要した。正しさの失敗ではないが、後続変更で試験の進捗観測と安全なFixture共有可否を検討する。速度改善を理由に異常注入範囲を削らない。

Phase 6のSource配置移行と独立再レビューは完了した。Checker現行Profile本体は`profiles/current-profile.ts`へ移し、`application/checker-command.ts`を委譲だけの公開Use Case入口へ縮小した。CheckerはRepositoryを読む補助Toolであり、Provider Effect、Runtime Authorityまたは共有Effectを発行しないため、Coordinator相当の重い署名境界を追加しない。本変更にはCoordinator署名閉包内のSource変更が含まれるため、Coordinatorだけは固定Commit後の再署名・署名済みE2Eを最終Gateとして維持する。

## Checklist

- [x] CHG-000075を再開せず別の変更意図として分離した
- [x] 全現行ModuleとTemplate Surfaceを分類した
- [x] 公開入口と禁止依存を定義した
- [x] Checker FindingをDomain結果にしていない
- [x] 現在Consumerと将来候補を区別した
- [x] 段階移行とConsumer Closureを定義した
- [x] Reality／Semanticの公開入口とFilesystem Effect境界を実装した
- [x] Checkerと開発Toolを公開入口へ移行し、旧deep importを0にした
- [x] Phase 2の局所試験、全回帰およびRepository Checkerを完了した
- [x] Phase 2完了候補の独立再レビューを完了した
- [x] Phase 3の局所試験、全回帰およびRepository Checkerを完了した
- [x] Phase 3完了候補の独立レビューを完了した
- [x] Phase 4でVersion Control生成Artifactと生成Scriptを廃止した
- [x] Checkerを同じ基準版RootのVersion Control公開入口へ移行した
- [x] Phase 4の全回帰、Repository Checkerおよび独立レビューを完了した
- [x] Phase 5でChecker固有ModuleをChecker実装正本へ移した
- [x] 旧`template/tools/internal/checker`とFixture Consumerを新Ownerへ移行した
- [x] Phase 5の全回帰とRepository Checkerを完了した
- [x] Phase 5の独立レビューを完了した
- [x] 設計を人間へ提示した
- [x] 汎用`internal/`とChecker Package Root直下実装を0件にした
- [x] Semantic CoverageとVerification RunnerをCheckerから独立Subsystemへ分離した
- [x] `src`配下を責務別Directoryと公開`index.ts`で統一した
- [x] 非Docker回帰とRepository Checkerを完了した
- [x] Version Controlの用途限定公開入口とConsumer Closureを実装した
- [x] Checker公開Use Caseと現行Profile本体を物理分離した
- [x] CheckerをCoordinator署名Runtimeの対象外として責務境界を固定した
- [ ] 実Docker境界を確認する（OPEN: Docker Engineが起動していない）
- [x] Phase 6完了候補の独立レビューを完了する
- [ ] Coordinator署名閉包への実変更を判定し、変更がある場合だけ再署名と署名済みE2Eを行う
