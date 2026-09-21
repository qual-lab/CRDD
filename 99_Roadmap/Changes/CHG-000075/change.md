# Semantic Coverage基盤

変更ID: `CHG-000075`
状態: `Ready for Release Handoff`
決定権限: Qual-Lab
対象版: `v0.21.0`
変更分類: `architecture_traceability_change`

## 1. 変更の目的

Architecture詳細設計が要求する意味を、実装Symbol、Qualityの検証項目およびTest Symbolへ機械的に接続できる基盤を作る。

```text
Architecture Details
  人間が編集する設計正本
          │
          │ 決定論的に生成
          ▼
Semantic IR
  機械が利用する生成物
          │
      ┌───┼───────────┐
      ▼   ▼           ▼
  実装Symbol  Quality Local Item  Test Symbol
      │           │           │
      └───────────┴───────────┘
                  │
                  ▼
          Semantic Coverage
                  │
                  ▼
          Reality Audit（後続）
```

本変更は[CHG-000074](../CHG-000074/change.md)で成立したSymbol Foundationを置き換えない。CHG-000074は現実側のSymbolを安全に識別・結合する基盤として完了状態を維持し、本変更は設計上の意味が実装・検証・試験へ到達するかを判定する層を追加する。

## 2. 現在状態と構造変更

| 対象 | 現在 | 本変更で目指す状態 |
|---|---|---|
| Architecture Details | 人間は意味を読めるが、Subsystem間で機械抽出可能性が揃っていない | 意味単位、ARCH-ID、検証要否および根拠を決定論的に抽出できる |
| Semantic IR | 未存在 | Architecture Detailsだけから生成し、人間が直接編集しない |
| Implementation Symbol | ARCH-IDとSource位置を保持 | 実装しているSemantic Keyを実装Symbol側で宣言する |
| Quality Local Item | QA-ID内の局所IDとして検証内容を保持 | 検証するSemantic KeyをLocal Item側で宣言する |
| Test Symbol | Test Catalog、Local Item、実装Symbolへ接続 | Local Itemと検証対象実装Symbolの両方へ接続する |
| 旧Runtime JSON | 意味、実装、試験、Projectionが混在 | 移行入力として分解し、正本または恒久Relation Ownerにしない |
| Reality Audit | 未開始 | Semantic Coverage基盤の独立レビュー後に別Gateで開始する |

### 影響ファイル

<details>
<summary>全ファイルを表示</summary>

- [`06_Architecture/Details/semantic-coverage/02_Semantic_IR_and_Relation_Design.md`](../../../06_Architecture/Details/semantic-coverage/02_Semantic_IR_and_Relation_Design.md)
- [`06_Architecture/Details/coordinator/01_Architecture.md`](../../../06_Architecture/Details/coordinator/01_Architecture.md)
- [`06_Architecture/Details/project-runtime/02_Detailed_Design.md`](../../../06_Architecture/Details/project-runtime/02_Detailed_Design.md)
- [`07_Quality/Registry/semantic-coverage-pilot.json`](../../../07_Quality/Registry/semantic-coverage-pilot.json)
- [`07_Quality/Definitions/QA-000003/quality_definition.md`](../../../07_Quality/Definitions/QA-000003/quality_definition.md)
- [`07_Quality/Definitions/QA-000004/quality_definition.md`](../../../07_Quality/Definitions/QA-000004/quality_definition.md)
- [`07_Quality/Definitions/QA-000005/quality_definition.md`](../../../07_Quality/Definitions/QA-000005/quality_definition.md)
- [`07_Quality/Definitions/QA-000006/quality_definition.md`](../../../07_Quality/Definitions/QA-000006/quality_definition.md)
- [`07_Quality/Definitions/QA-000010/quality_definition.md`](../../../07_Quality/Definitions/QA-000010/quality_definition.md)
- [`07_Quality/01_Quality_Center.md`](../../../07_Quality/01_Quality_Center.md)
- [`07_Quality/04_Quality_Integration.md`](../../../07_Quality/04_Quality_Integration.md)
- [`07_Quality/05_Current_Implementation_Reality_Audit.md`](../../../07_Quality/05_Current_Implementation_Reality_Audit.md)
- [`40_Develop/semantic-coverage/bin/compile-semantic-coverage-pilot.ts`](../../../40_Develop/semantic-coverage/bin/compile-semantic-coverage-pilot.ts)
- [`40_Develop/semantic-coverage/tests/unit/semantic-coverage-pilot.contract.test.ts`](../../../40_Develop/semantic-coverage/tests/unit/semantic-coverage-pilot.contract.test.ts)
- [`40_Develop/checker/tsconfig.json`](../../../40_Develop/checker/tsconfig.json)
- [`07_Quality/Registry/test-catalog.json`](../../../07_Quality/Registry/test-catalog.json)
- `template/tools/internal/semantic-coverage/legacy-runtime-inventory.ts` → [`40_Develop/semantic-coverage/src/migrations/legacy-runtime-inventory.ts`](../../../40_Develop/semantic-coverage/src/migrations/legacy-runtime-inventory.ts)
- `template/tools/internal/semantic-coverage/semantic-ir-compiler.ts` → [`40_Develop/semantic-coverage/src/compilation/semantic-ir-compiler.ts`](../../../40_Develop/semantic-coverage/src/compilation/semantic-ir-compiler.ts)
- `template/tools/internal/semantic-coverage/semantic-coverage-graph.ts` → [`40_Develop/semantic-coverage/src/coverage/semantic-coverage-graph.ts`](../../../40_Develop/semantic-coverage/src/coverage/semantic-coverage-graph.ts)
- `template/tools/internal/semantic-coverage/semantic-bundle-writer.ts` → [`40_Develop/semantic-coverage/src/infrastructure/filesystem-semantic-bundle-publisher.ts`](../../../40_Develop/semantic-coverage/src/infrastructure/filesystem-semantic-bundle-publisher.ts)
- `template/tools/internal/semantic-coverage/quality-semantic-relation.ts` → [`40_Develop/semantic-coverage/src/compilation/quality-semantic-relation.ts`](../../../40_Develop/semantic-coverage/src/compilation/quality-semantic-relation.ts)
- `template/tools/internal/reality-traceability/symbol-manifest-model.ts` → [`40_Develop/crdd-domain-library/src/reality-traceability/symbol-manifest-model.ts`](../../../40_Develop/crdd-domain-library/src/reality-traceability/symbol-manifest-model.ts)
- `template/tools/internal/reality-traceability/symbol-manifest-validator.ts` → [`40_Develop/crdd-domain-library/src/reality-traceability/symbol-manifest-validator.ts`](../../../40_Develop/crdd-domain-library/src/reality-traceability/symbol-manifest-validator.ts)
- [`template/tools/schemas/reality-symbol-schema.json`](../../../template/tools/schemas/reality-symbol-schema.json)
- [`template/tools/schemas/semantic-ir-pilot-schema.json`](../../../template/tools/schemas/semantic-ir-pilot-schema.json)
- [`template/tools/schemas/semantic-coverage-pilot-schema.json`](../../../template/tools/schemas/semantic-coverage-pilot-schema.json)
- [`40_Develop/coordinator/symbol.json`](../../../40_Develop/coordinator/symbol.json)
- [`40_Develop/project-runtime/symbol.json`](../../../40_Develop/project-runtime/symbol.json)
- [`99_Roadmap/01_Roadmap.md`](../../01_Roadmap.md)
- [`99_Roadmap/02_Changes.md`](../../02_Changes.md)
- [`99_Roadmap/Changes/CHG-000075/change.md`](change.md)

</details>

実装・Schema・試験を追加した時点で本一覧へ追記する。

## 3. Pilot範囲

| Pilot | 選定理由 | 移行入力 | 現時点の観測 |
|---|---|---|---|
| Coordinator | Authority、Process、外部Effect、Recoveryが強い | `coordinator-runtime-traceability.json` | ID集合はArchitecture Detailsにあるが、一部の説明と検証結合を旧JSONなしで再生成できない |
| Project Runtime | State、Persistence、Operation、Recoveryが強い | `project-runtime-design-traceability.json` | Interface、Record、Resource、Lock、Authority、Effect、状態機械、不変条件等を構造化表から抽出できる |

PilotではSemantic Keyの最終記法、最終Schemaおよび全Subsystemへの展開を固定しない。仮の記法やSchemaを使う場合はPilotであることを機械結果にも表示し、Pilot結果から変更できる状態を保つ。

## 4. Relation Owner

| Relation | 正方向のOwner | 逆方向 |
|---|---|---|
| Semantic Key → ARCH-ID | 生成されたSemantic IR | Graphから生成 |
| Implementation Symbol → Semantic Key | Implementation Symbol | Graphから生成 |
| Quality Local Item → Semantic Key | Quality Local Item | Graphから生成 |
| Test Symbol → Implementation Symbol | Test Symbol | Graphから生成 |
| Test Symbol → Quality Local Item | Test Symbolの`qaIds`／`localTestIds` | Graphから生成 |

同じRelationを両側へ手書きしない。Architecture Detailsから意味を抽出できない場合はSemantic IRへAI推測で補完せず、Architecture DetailsまたはTemplateのGapとして停止する。

## 5. 成立条件

- CoordinatorとProject Runtimeについて、旧JSONの全fieldを「設計意味」「実装結合」「検証結合」「生成Projection」に分類できる。
- Architecture Detailsから抽出可能な意味と、旧JSONにしか存在しない意味を区別できる。
- 同じArchitecture Detailsからbyte-identicalなSemantic IRを再生成できる。
- 生成不能、重複、未知ARCH-ID、根拠Anchor欠落および理由のない`N/A`を正常結果へ畳まない。
- Implementation Symbol、Quality Local Item、Test Symbolの正方向Relation Ownerを一つに限定する。
- Pilot中のSemantic KeyとSchemaをStable Contractとして表示しない。
- 本変更の独立レビューがPassするまでReality Auditを開始しない。

## 6. 非目標

- 9 Subsystemへの一括展開
- 一般的な自然言語解析器の実装
- AIによる欠落意味の推測補完
- 旧Runtime JSONを新しい正本として固定すること
- Symbolの存在から実装済み、試験済みまたは合格済みを推定すること
- 本変更内でReality Auditを実施すること

## 7. Gate

| Gate | 状態 | 完了条件 |
|---|---|---|
| Pilot移行棚卸し | Complete | 2つの旧JSONを責務別に分解し、Architecture Detailsからの抽出可否とGapを記録する |
| Semantic Source Contract | Complete | Pilotに必要な意味を人間可読かつ決定論的に抽出できる形でArchitecture Detailsへ置く |
| Semantic IR Pilot | Complete | 同一入力から同一結果を生成し、生成不能時にEffect 0で停止する |
| Relation Pilot | Complete | 実装、Quality Local Item、Test Symbolの正方向RelationをPilot範囲で接続する |
| 独立レビュー | Complete | 初回3指摘を是正し、同じ独立確認者の再レビューでPassした |
| Reality Audit | Blocked by Design | 本変更完了後に別Gateとして開始する |

## 8. 検証結果

| 確認 | 結果 | 意味 |
|---|---|---|
| 静的検査 | Pass | Formatter、TypeScript型検査、Lintが全てPassした |
| Repository Checker | Pass | 全Repository確認でError 0、Warning 0 |
| Semantic Coverage契約試験 | 10／10 Pass | 旧JSON分類、決定論的IR、完全修飾Quality Relation、曖昧結合拒否および原子的公開を確認した |
| 全Catalog回帰 | 393／393 Pass | 独立レビュー是正後の固定候補で既存契約を含む全件がPassした |
| 生成決定性 | Pass | IRとCoverageを含む単一Bundleを再生成し、SHA-256が再生成前後で一致した |

Pilot Projectionは17件すべてについてArchitectureとQuality Local Itemを接続した。実装Symbolは16件が`observed`、Runtime Trust消費の1件が`unobserved`である。Test Symbolとの接続は3件が`observed`、14件が`unobserved`である。いずれも実装完成、試験実行または合格を表さず、後続Reality Auditへの観測入力である。

Quality Relationを作成する過程で、Queue／Leaseの終了条件とTransport中立Application Contractに専用Local Itemがないことを検出した。既存Local Itemへ意味を流用せず、`PRL-IT-011`および`PRL-IT-012`としてQuality正本へ追加した。

## Checklist

- [x] CHG-000074を再開せず別の変更意図として分離した
- [x] Architecture Detailsを人間が編集する設計正本とした
- [x] Semantic IRを生成物とし、第二の手編集正本にしていない
- [x] CoordinatorとProject RuntimeだけをPilot対象にした
- [x] 旧Runtime JSONを移行入力に限定した
- [x] Relation Ownerを正方向の片側に限定した
- [x] SchemaとSemantic Keyの最終固定をPilot後へ保留した
- [x] 生成不能時にAI推測で補完しない
- [x] Reality Auditを後続Gateとして分離した
- [x] Pilot移行棚卸しを完了した
- [x] Semantic IRの決定論的生成を確認した
- [x] Pilot Relationを閉じた
- [x] Quality Local Itemを`QA-ID/Local-ID`の完全修飾Identityで接続した
- [x] IRとCoverageを単一Bundleとして原子的に公開した
- [x] Coordinatorの実装RelationをBarrelではなく実所有Fileへ分割した
- [x] 独立レビューを完了した

初回独立レビューは、Local IDだけによるQA間誤接続、複数生成Fileの新旧混在、およびCoordinatorのBarrelへの過大な実装Relationを検出した。完全修飾した`QA-ID/Local-ID`、単一Bundleの原子的公開、実所有FileへのRelation分割で是正し、再レビューはPassした。実所有者を確定できないRuntime Trust消費は、既存実装へ推測で結び付けず`unobserved`として残した。

複数Processによる同時生成の世代選択と、生成中にWorktreeが編集された場合のRepository全体の単一入力Snapshotは、本Pilotの「部分生成を公開しない」契約には含めない。後続で固定Revisionからの生成を要求する場合に、Lockと入力Snapshotの要否を再評価する。
