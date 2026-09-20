# CRDD Domain Library責務分離

変更ID: `CHG-000076`
状態: `Implementation In Progress — Phase 4 Complete`
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

本変更では設計、全Module分類、公開入口および依存方向を先に固定し、独立レビュー済みの段階移行としてSourceを移す。Phase 1の実装正本の受け皿に続き、Phase 2ではCommon Result、Reality Traceability、Semantic Coverage、Repository ObservationおよびSemantic Publisherを`40_Develop`へ移した。Phase 3ではArtifact Model、Markdown Parser、Schema ValidatorおよびRelation Graphを公開Domainへ移し、Checker固有Findingとの境界を独立レビューまで完了した。Phase 4ではChecker向けVersion Control生成Artifactを廃止し、同じ基準版Rootの公開AdapterへConsumerを統合して独立レビューまで完了した。

## 2. 現在状態と構造変更

| 対象 | 現在 | 本変更で固定する状態 |
|---|---|---|
| `internal` | Checker内部と共通能力が同居 | 各Capability内の非公開実装だけに使用 |
| `template/tools` | 起動入口とChecker／Domain実装本体が同居 | 起動入口と設定／Schemaに限定し、業務ロジックを0にする |
| `40_Develop` | 開発・試験入口と一部Capabilityの正本 | Checker、CRDD Domain Library、RepositoryおよびVersion Controlの実装正本 |
| Artifact／Relation | Checkerの`FindingSink`へ依存 | 中立なDomain Result／Issueを返し、Checker AdapterでFindingへ変換 |
| Reality Traceability | Checker内部に見えるPath | CRDD共通Domainの独立した公開Capability |
| Semantic Coverage | Checker補助成果物として配置 | CRDD共通Domainの独立した公開Capability |
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
- [`06_Architecture/Details/checker/02_Semantic_Coverage.md`](../../../06_Architecture/Details/checker/02_Semantic_Coverage.md)
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
- [`40_Develop/checker/compile-semantic-ir-pilot.ts`](../../../40_Develop/checker/compile-semantic-ir-pilot.ts)
- [`40_Develop/checker/src/launcher-binding.ts`](../../../40_Develop/checker/src/launcher-binding.ts)
- [`40_Develop/checker/src/internal/adapters/artifact-relation.ts`](../../../40_Develop/checker/src/internal/adapters/artifact-relation.ts)
- [`40_Develop/checker/src/internal/adapters/reality-test-catalog.ts`](../../../40_Develop/checker/src/internal/adapters/reality-test-catalog.ts)
- [`40_Develop/checker/src/internal/adapters/reality-traceability.ts`](../../../40_Develop/checker/src/internal/adapters/reality-traceability.ts)
- [`40_Develop/checker/src/internal/adapters/semantic-coverage.ts`](../../../40_Develop/checker/src/internal/adapters/semantic-coverage.ts)
- [`40_Develop/checker/src/internal/migrations/legacy-runtime-inventory.ts`](../../../40_Develop/checker/src/internal/migrations/legacy-runtime-inventory.ts)
- [`40_Develop/checker/test-catalog.ts`](../../../40_Develop/checker/test-catalog.ts)
- [`40_Develop/checker/tests/integration/crdd-check.contract.test.ts`](../../../40_Develop/checker/tests/integration/crdd-check.contract.test.ts)
- [`40_Develop/checker/tests/unit/launcher-binding.contract.test.ts`](../../../40_Develop/checker/tests/unit/launcher-binding.contract.test.ts)
- [`40_Develop/checker/tests/unit/semantic-coverage-pilot.contract.test.ts`](../../../40_Develop/checker/tests/unit/semantic-coverage-pilot.contract.test.ts)
- [`40_Develop/checker/tests/unit/symbol-graph.contract.test.ts`](../../../40_Develop/checker/tests/unit/symbol-graph.contract.test.ts)
- [`40_Develop/checker/tests/unit/test-catalog.contract.test.ts`](../../../40_Develop/checker/tests/unit/test-catalog.contract.test.ts)
- [`40_Develop/checker/tsconfig.json`](../../../40_Develop/checker/tsconfig.json)
- [`40_Develop/crdd-domain-library/package-lock.json`](../../../40_Develop/crdd-domain-library/package-lock.json)
- [`40_Develop/crdd-domain-library/package.json`](../../../40_Develop/crdd-domain-library/package.json)
- [`40_Develop/crdd-domain-library/src/application/semantic-coverage/index.ts`](../../../40_Develop/crdd-domain-library/src/application/semantic-coverage/index.ts)
- [`40_Develop/crdd-domain-library/src/domain/result/index.ts`](../../../40_Develop/crdd-domain-library/src/domain/result/index.ts)
- [`40_Develop/crdd-domain-library/src/domain/artifact/artifact-model.ts`](../../../40_Develop/crdd-domain-library/src/domain/artifact/artifact-model.ts)
- [`40_Develop/crdd-domain-library/src/domain/artifact/index.ts`](../../../40_Develop/crdd-domain-library/src/domain/artifact/index.ts)
- [`40_Develop/crdd-domain-library/src/domain/artifact/markdown-artifact-parser.ts`](../../../40_Develop/crdd-domain-library/src/domain/artifact/markdown-artifact-parser.ts)
- [`40_Develop/crdd-domain-library/src/domain/artifact/schema-validator.ts`](../../../40_Develop/crdd-domain-library/src/domain/artifact/schema-validator.ts)
- [`40_Develop/crdd-domain-library/src/domain/relation/artifact-graph.ts`](../../../40_Develop/crdd-domain-library/src/domain/relation/artifact-graph.ts)
- [`40_Develop/crdd-domain-library/src/domain/relation/index.ts`](../../../40_Develop/crdd-domain-library/src/domain/relation/index.ts)
- [`40_Develop/crdd-domain-library/src/domain/reality-traceability/index.ts`](../../../40_Develop/crdd-domain-library/src/domain/reality-traceability/index.ts)
- [`40_Develop/crdd-domain-library/src/domain/reality-traceability/internal/domain-issue.ts`](../../../40_Develop/crdd-domain-library/src/domain/reality-traceability/internal/domain-issue.ts)
- [`40_Develop/crdd-domain-library/src/domain/reality-traceability/internal/symbol-annotation.ts`](../../../40_Develop/crdd-domain-library/src/domain/reality-traceability/internal/symbol-annotation.ts)
- [`40_Develop/crdd-domain-library/src/domain/reality-traceability/symbol-graph.ts`](../../../40_Develop/crdd-domain-library/src/domain/reality-traceability/symbol-graph.ts)
- [`40_Develop/crdd-domain-library/src/domain/reality-traceability/symbol-discovery.ts`](../../../40_Develop/crdd-domain-library/src/domain/reality-traceability/symbol-discovery.ts)
- [`40_Develop/crdd-domain-library/src/domain/reality-traceability/symbol-manifest-model.ts`](../../../40_Develop/crdd-domain-library/src/domain/reality-traceability/symbol-manifest-model.ts)
- [`40_Develop/crdd-domain-library/src/domain/reality-traceability/symbol-manifest-validator.ts`](../../../40_Develop/crdd-domain-library/src/domain/reality-traceability/symbol-manifest-validator.ts)
- [`40_Develop/crdd-domain-library/src/domain/semantic-coverage/index.ts`](../../../40_Develop/crdd-domain-library/src/domain/semantic-coverage/index.ts)
- [`40_Develop/crdd-domain-library/src/domain/semantic-coverage/quality-semantic-relation.ts`](../../../40_Develop/crdd-domain-library/src/domain/semantic-coverage/quality-semantic-relation.ts)
- [`40_Develop/crdd-domain-library/src/domain/semantic-coverage/semantic-coverage-graph.ts`](../../../40_Develop/crdd-domain-library/src/domain/semantic-coverage/semantic-coverage-graph.ts)
- [`40_Develop/crdd-domain-library/src/domain/semantic-coverage/semantic-ir-compiler.ts`](../../../40_Develop/crdd-domain-library/src/domain/semantic-coverage/semantic-ir-compiler.ts)
- [`40_Develop/crdd-domain-library/src/repository/index.ts`](../../../40_Develop/crdd-domain-library/src/repository/index.ts)
- [`40_Develop/crdd-domain-library/src/repository/internal/filesystem-repository-observer.ts`](../../../40_Develop/crdd-domain-library/src/repository/internal/filesystem-repository-observer.ts)
- [`40_Develop/crdd-domain-library/src/repository/internal/filesystem-semantic-bundle-publisher.ts`](../../../40_Develop/crdd-domain-library/src/repository/internal/filesystem-semantic-bundle-publisher.ts)
- [`40_Develop/crdd-domain-library/symbol.json`](../../../40_Develop/crdd-domain-library/symbol.json)
- [`40_Develop/crdd-domain-library/tests/integration/reality-repository.integration.test.ts`](../../../40_Develop/crdd-domain-library/tests/integration/reality-repository.integration.test.ts)
- [`40_Develop/crdd-domain-library/tests/integration/semantic-bundle-publisher.integration.test.ts`](../../../40_Develop/crdd-domain-library/tests/integration/semantic-bundle-publisher.integration.test.ts)
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
- `template/tools/internal/reality-traceability/repository-regular-file-observer.ts` → [`40_Develop/crdd-domain-library/src/repository/internal/filesystem-repository-observer.ts`](../../../40_Develop/crdd-domain-library/src/repository/internal/filesystem-repository-observer.ts)
- `template/tools/internal/reality-traceability/symbol-annotation.ts` → [`40_Develop/crdd-domain-library/src/domain/reality-traceability/internal/symbol-annotation.ts`](../../../40_Develop/crdd-domain-library/src/domain/reality-traceability/internal/symbol-annotation.ts)
- `template/tools/internal/reality-traceability/symbol-discovery.ts` → [`40_Develop/crdd-domain-library/src/domain/reality-traceability/symbol-discovery.ts`](../../../40_Develop/crdd-domain-library/src/domain/reality-traceability/symbol-discovery.ts)
- `template/tools/internal/reality-traceability/symbol-graph.ts` → [`40_Develop/crdd-domain-library/src/domain/reality-traceability/symbol-graph.ts`](../../../40_Develop/crdd-domain-library/src/domain/reality-traceability/symbol-graph.ts)
- `template/tools/internal/reality-traceability/symbol-manifest-model.ts` → [`40_Develop/crdd-domain-library/src/domain/reality-traceability/symbol-manifest-model.ts`](../../../40_Develop/crdd-domain-library/src/domain/reality-traceability/symbol-manifest-model.ts)
- `template/tools/internal/reality-traceability/symbol-manifest-validator.ts` → [`40_Develop/crdd-domain-library/src/domain/reality-traceability/symbol-manifest-validator.ts`](../../../40_Develop/crdd-domain-library/src/domain/reality-traceability/symbol-manifest-validator.ts)
- `template/tools/internal/semantic-coverage/legacy-runtime-inventory.ts` → [`40_Develop/checker/src/internal/migrations/legacy-runtime-inventory.ts`](../../../40_Develop/checker/src/internal/migrations/legacy-runtime-inventory.ts)
- `template/tools/internal/semantic-coverage/quality-semantic-relation.ts` → [`40_Develop/crdd-domain-library/src/domain/semantic-coverage/quality-semantic-relation.ts`](../../../40_Develop/crdd-domain-library/src/domain/semantic-coverage/quality-semantic-relation.ts)
- `template/tools/internal/semantic-coverage/semantic-bundle-writer.ts` → [`40_Develop/crdd-domain-library/src/repository/internal/filesystem-semantic-bundle-publisher.ts`](../../../40_Develop/crdd-domain-library/src/repository/internal/filesystem-semantic-bundle-publisher.ts)
- `template/tools/internal/semantic-coverage/semantic-coverage-graph.ts` → [`40_Develop/crdd-domain-library/src/domain/semantic-coverage/semantic-coverage-graph.ts`](../../../40_Develop/crdd-domain-library/src/domain/semantic-coverage/semantic-coverage-graph.ts)
- `template/tools/internal/semantic-coverage/semantic-ir-compiler.ts` → [`40_Develop/crdd-domain-library/src/domain/semantic-coverage/semantic-ir-compiler.ts`](../../../40_Develop/crdd-domain-library/src/domain/semantic-coverage/semantic-ir-compiler.ts)
- `template/tools/internal/checker/rules/reality-test-catalog-adapter.ts` → [`40_Develop/checker/src/internal/adapters/reality-test-catalog.ts`](../../../40_Develop/checker/src/internal/adapters/reality-test-catalog.ts)
- [`template/tools/internal/checker/rules/reality-symbol-graph.ts`](../../../template/tools/internal/checker/rules/reality-symbol-graph.ts)
- [`template/tools/crdd-check.ts`](../../../template/tools/crdd-check.ts)
- `template/tools/internal/version-control-runtime.ts`（削除）
- `template/tools/internal/checker/artifact-model.ts` → [`40_Develop/crdd-domain-library/src/domain/artifact/artifact-model.ts`](../../../40_Develop/crdd-domain-library/src/domain/artifact/artifact-model.ts)
- `template/tools/internal/checker/markdown-artifact-parser.ts` → [`40_Develop/crdd-domain-library/src/domain/artifact/markdown-artifact-parser.ts`](../../../40_Develop/crdd-domain-library/src/domain/artifact/markdown-artifact-parser.ts)
- `template/tools/internal/checker/schema-validator.ts` → [`40_Develop/crdd-domain-library/src/domain/artifact/schema-validator.ts`](../../../40_Develop/crdd-domain-library/src/domain/artifact/schema-validator.ts)
- `template/tools/internal/checker/relation-engine.ts` → [`40_Develop/crdd-domain-library/src/domain/relation/artifact-graph.ts`](../../../40_Develop/crdd-domain-library/src/domain/relation/artifact-graph.ts)
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
| Source物理移動準備 | Phase 1 Complete — Launcher Integration Not Started | Root Identity契約と拒否条件を契約試験で固定した。実Launcher接続は後続Gate |
| Phase 2 Reality／Semantic公開 | Complete | Reality／Semanticの公開API、Repository Observation、Semantic Publisher、Checker変換Adapter、安全境界の反証試験を固定した。Checkerと開発Toolを公開入口へ移行し、旧deep import 0、局所試験、全Catalog回帰、Repository Checkerおよび独立再レビューを完了した |
| Phase 3 Artifact／Relation分離 | Complete | Artifact Model、Parser、SchemaおよびRelationを公開Domainへ移し、Checker Finding変換、Consumer Closure、局所試験、全Catalog回帰、Repository Checkerおよび独立再レビューを完了した |
| Phase 4 Version Control公開 | Complete | Checker向け生成Artifactを廃止し、同じ基準版RootのVersion Control公開入口へConsumerを統合した。公開Symbol完全一致、局所結合試験、Checker実物契約、全Catalog回帰、Repository Checkerおよび独立レビューがPassした |
| Reality Audit | Not Started | 本変更とは別Gateで扱う |

## 6. 検証方針

設計Gateでは、リンク、Module全数、既存Consumer、Architecture RelationおよびCheckerとの責務境界を確認する。物理移動Gateでは、各PhaseごとにFormatter、型検査、Lint、局所契約試験、全Catalog回帰、Repository CheckerおよびConsumer Closureを実行する。

## 7. 独立レビュー結果

| 対象改訂版 | 結果 | 指摘と是正 | 保持した境界 |
|---|---|---|---|
| 2026-09-20固定候補 | Pass | 現行所有者とv0.21目標の表示、開発Root／採用RootのIdentity、Quality 113件＋追加1件の状態を是正後に再レビュー | 30件全数分類、公開API allowlist、fallbackなし拒否、Source物理移動0、Reality Audit未開始 |
| 2026-09-20 Phase 1 Root Identity契約 | Pass | Path suffix一致、POSIX大小文字、境界観測、相対Path、Win32 root-relativeを理由別に反証し、完全修飾drive／UNCとPOSIX絶対Pathだけを受理 | 実Launcher未接続、Checker本体未移動、Reality Audit未開始 |
| 2026-09-20 Phase 2 Reality／Repository最初のSlice | Pass | DomainでChecker Findingを生成する逆依存、Repository Root／Path／Handle証明、Version Controlの非公開deep importを是正後に再レビューし、Critical／Major／Moderate／Minorすべて0を確認 | Windows Handle所在証明Adapter、Semantic移行およびConsumer Closureを次の固定候補で確認 |
| 2026-09-20 Phase 2完了候補 | Pass | 初回レビューで検出したReality `internal`へのdeep importとSemantic Domain内のChecker形Findingを是正した。Domain kind 30件とChecker明示変換30件の完全一致、未知kind／detail欠落のfail closed、公開入口限定を再レビューし、Critical／Major／Moderate／Minorすべて0を確認した | Artifact／Relation、Version Control、Checker全体、launcher／配布およびReality Auditは後続Phase |
| 2026-09-20 Phase 3完了候補 | Pass | Artifact Model、Markdown Parser、Schema ValidatorおよびRelation Graphを公開Domainへ移し、Checker固有Finding変換をAdapterへ分離した。初回レビューで検出したArchitectureの移行前状態を示す現在形1件を是正し、Critical／Major／Moderate／Minorすべて0を確認した | Version Control、Checker全体、launcher／配布およびReality Auditは後続Phase |
| 2026-09-20 Phase 4完了候補 | Pass | Checker向けVersion Control生成Artifactと生成Scriptを廃止し、同じ基準版Rootの公開入口へConsumerを統合した。初回Major 1件の公開Symbol正本不一致を是正し、Version Control局所結合39/39、公開Symbol 60/60の設計・実装完全一致、Checker実物契約327/327、全Catalog回帰399/399およびRepository Checker 0/0を確認した。独立再レビューはCritical／Major／Moderate／Minorすべて0でPassした | Checker全体、launcher薄型化、署名対象Artifact移行およびReality Auditは後続Phase |

## 8. Phase 1検証結果

| 検証 | 結果 | 確認内容 |
|---|---|---|
| Root Identity局所契約 | Pass（7/7） | 開発Root、任意名の採用Root、UNC、誤Path、相対Path、Win32 root-relative、POSIX大小文字を確認 |
| Test Catalogを含む局所回帰 | Pass（26/26） | Root Identity契約と試験登録・実行Ownerの整合を確認 |
| Formatter／型／Lint | Pass | Biome、TypeScript、WarningをErrorとするLintが完了 |
| Repository Checker | Pass | errors 0、warnings 0 |
| Checker全Catalog回帰 | Pass（400/400） | 期待値変更で逃がさず、命名規約を実装側で是正後に全件再実行 |

Phase 1で成立したのはRoot Identityと拒否境界の契約までである。実Launcherへの接続、Checker本体の移動、採用Repositoryでの配布実測およびReality Auditは後続Phaseの未完了範囲として維持する。

## 9. Phase 2完了結果

| 対象 | 完了した処置 | 後続Phaseへ残す範囲 |
|---|---|---|
| Common Result | `DomainOutcome<T>`、`DomainIssue`、`DomainLocation`を公開契約にし、Realityの中立結果へ適用した | Artifact／Relationへの適用はPhase 3 |
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
| 配布複製 | 生成Script、配布用Sourceおよび`template/tools/internal`の複製Artifactを削除した | 署名対象Artifact移行は後続Phase |
| Consumer Closure | 開発Rootと実Git submodule Fixtureの両方で同じ相対配置を利用し、`template/tools`単独コピーを再導入しない契約へ更新した | Reality Auditは別Gate |

検証結果は、Version ControlとCheckerの型・Lint・Formatter Pass、実Gitを含む局所結合39/39、Version Control Architectureに宣言した公開Symbol 60件と`src/index.ts`の完全一致、Checker実物契約327/327、全Catalog回帰399/399およびRepository Checker errors 0／warnings 0である。Phase 2で追加されたSemantic IR生成ToolのRepository Root Consumer登録漏れ1件も実Sourceから確認して宣言集合へ追加した。独立再レビューはCritical／Major／Moderate／Minorすべて0でPassした。Phase 4完了はChecker全体、launcher薄型化、署名対象Artifact移行またはReality Auditの完了を意味しない。

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
- [x] 設計を人間へ提示した
