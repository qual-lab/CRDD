# CRDD Domain Library責務分離

変更ID: `CHG-000076`
状態: `Implementation In Progress — Phase 1 Binding Contract Complete`
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

本変更では設計、全Module分類、公開入口、依存方向および段階移行を固定する。Sourceの物理移動は独立レビュー後の次Gateとする。

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
- [`07_Quality/Registry/test-catalog.json`](../../../07_Quality/Registry/test-catalog.json)
- [`19_Workflows/01_Coordinator_Runtime.md`](../../../19_Workflows/01_Coordinator_Runtime.md)
- [`40_Develop/checker/src/launcher-binding.ts`](../../../40_Develop/checker/src/launcher-binding.ts)
- [`40_Develop/checker/tests/unit/launcher-binding.contract.test.ts`](../../../40_Develop/checker/tests/unit/launcher-binding.contract.test.ts)
- [`40_Develop/checker/tsconfig.json`](../../../40_Develop/checker/tsconfig.json)
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
| Source物理移動準備 | Phase 1 Complete — Launcher Integration Not Started | Root Identity契約と拒否条件を契約試験で固定した。実Launcher接続とChecker本体移動は次Gate |
| Reality Audit | Not Started | 本変更とは別Gateで扱う |

## 6. 検証方針

設計Gateでは、リンク、Module全数、既存Consumer、Architecture RelationおよびCheckerとの責務境界を確認する。物理移動Gateでは、各PhaseごとにFormatter、型検査、Lint、局所契約試験、全Catalog回帰、Repository CheckerおよびConsumer Closureを実行する。

## 7. 独立レビュー結果

| 対象改訂版 | 結果 | 指摘と是正 | 保持した境界 |
|---|---|---|---|
| 2026-09-20固定候補 | Pass | 現行所有者とv0.21目標の表示、開発Root／採用RootのIdentity、Quality 113件＋追加1件の状態を是正後に再レビュー | 30件全数分類、公開API allowlist、fallbackなし拒否、Source物理移動0、Reality Audit未開始 |
| 2026-09-20 Phase 1 Root Identity契約 | Pass | Path suffix一致、POSIX大小文字、境界観測、相対Path、Win32 root-relativeを理由別に反証し、完全修飾drive／UNCとPOSIX絶対Pathだけを受理 | 実Launcher未接続、Checker本体未移動、Reality Audit未開始 |

## 8. Phase 1検証結果

| 検証 | 結果 | 確認内容 |
|---|---|---|
| Root Identity局所契約 | Pass（7/7） | 開発Root、任意名の採用Root、UNC、誤Path、相対Path、Win32 root-relative、POSIX大小文字を確認 |
| Test Catalogを含む局所回帰 | Pass（26/26） | Root Identity契約と試験登録・実行Ownerの整合を確認 |
| Formatter／型／Lint | Pass | Biome、TypeScript、WarningをErrorとするLintが完了 |
| Repository Checker | Pass | errors 0、warnings 0 |
| Checker全Catalog回帰 | Pass（400/400） | 期待値変更で逃がさず、命名規約を実装側で是正後に全件再実行 |

Phase 1で成立したのはRoot Identityと拒否境界の契約までである。実Launcherへの接続、Checker本体の移動、採用Repositoryでの配布実測およびReality AuditはPhase 2以降の未完了範囲として維持する。

## Checklist

- [x] CHG-000075を再開せず別の変更意図として分離した
- [x] 全現行ModuleとTemplate Surfaceを分類した
- [x] 公開入口と禁止依存を定義した
- [x] Checker FindingをDomain結果にしていない
- [x] 現在Consumerと将来候補を区別した
- [x] 段階移行とConsumer Closureを定義した
- [x] Source物理移動を開始していない
- [x] 独立レビューを完了した
- [x] 設計を人間へ提示した
