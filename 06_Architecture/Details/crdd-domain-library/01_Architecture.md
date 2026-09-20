# CRDD Domain Libraryの責務境界

成果物種別: Architecture詳細設計
詳細設計領域: crdd-domain-library
状態: Candidate

## 基本設計との関係

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000001](../../Definitions/ARCH-000001/architecture_definition.md) | Artifact解析、Relation構築等の共通能力と、Checker固有の判定・結果表現を分ける。 | Partial |
| [ARCH-000002](../../Definitions/ARCH-000002/architecture_definition.md) | Consumer Closureを含む共通Relation能力を、Checker以外の利用側も同じ意味で利用できる境界にする。 | Partial |
| [ARCH-000008](../../Definitions/ARCH-000008/architecture_definition.md) | Reality TraceabilityとSemantic Coverageを、Checker Ruleではなく再利用可能な観測・関係能力として公開する。 | Partial |
| [ARCH-000009](../../Definitions/ARCH-000009/architecture_definition.md) | Repository観測とVersion Control Adapterを、Domain意味およびChecker内部から分離する。 | Partial |

本設計は既存Architecture定義の意味を変更しない。`template/tools/internal/`に同居していた能力のOwner、公開入口および依存方向を整理し、段階移行の完了状態を記録する。

Relation状態は、この領域が担当する責務断面に対する状態である。Phase 2ではCommon Result、Reality Traceability、Semantic Coverage、Repository Observation、Semantic Publisherおよび既知Consumerを`40_Develop`の公開入口へ移行し、旧deep importを0にした。Phase 3ではArtifact、Markdown Parser、SchemaおよびRelation Graphを公開Domainへ移し、Checker Finding変換をChecker Adapterへ分離して独立レビューまで完了した。Phase 4ではVersion Controlの配布複製を廃止して同じ基準版Rootの公開入口へConsumerを統合し、独立レビューまで完了した。Phase 5ではChecker固有のPipeline、Finding、Rule RegistryおよびProfile Ruleを`40_Develop/checker/src/internal`へ移し、独立レビューまで完了した。launcher薄型化および配布Consumerは後続Phaseなので、全体状態は`Partial`を維持する。

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | Checker固有、CRDD共通Domain、Repository／Version Control基盤を分ける。 | [§2](#2-目標component) |
| Interface Model | Required | 将来のMCP／Workbenchを含む利用側が、内部Fileを直接importしない公開入口を固定する。 | [§3](#3-公開入口と依存方向) |
| Data Flow | Required | Markdown、Repository観測、Symbol、Semantic IR、Findingへの変換を示す。 | [§4](#4-data-flow) |
| State Model | N/A | 本変更はLibrary責務境界を定義し、長期状態を所有しない。個別能力の状態は各詳細設計が所有する。 | - |
| Sequence | Required | Domain結果をChecker Findingへ変換する順序と、公開入口を経由する利用規則を固定する。 | [§4](#4-data-flow) |
| Failure／Recovery | Required | 読取不能、Schema不一致、Relation不整合を中立結果とChecker結果へ分ける。 | [§5](#5-結果と失敗の境界) |
| Deployment | Required | `40_Develop`を実装正本、`template/tools`を薄い起動入口と設定配置に限定する。 | [§6](#6-配布と開発の境界) |
| Observability | Required | 公開API、Consumer、移行段階および未移行Pathを追跡する。 | [§7](#7-consumer-closure) |
| Security Boundary | Required | 検証済みRepository Root、link非追従、読取りと書込みEffectの分離を維持する。 | [§8](#8-security境界) |

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | N/A | 本設計は共有可変状態を新設しない。Semantic Bundle公開時の並行生成はSemantic Coverage詳細設計の責務として維持する。 | [段階移行](#10-段階移行) |
| Timing | N/A | Library境界自体に時間制約を追加しない。 | [段階移行](#10-段階移行) |
| Resource Lifecycle | PASS | Repository／Filesystem handleと一時物はAdapterまたはEffectを持つCapabilityが所有し、Domain Modelへ移さない。 | [§2](#2-目標component) |
| External Boundary | PASS | FilesystemとVersion ControlをInfrastructure／Adapterとして分離し、DomainがProcess APIへ直接依存する範囲を増やさない。 | [§3](#3-公開入口と依存方向) |
| Failure／Recovery | PASS | Domainの構造化Issue、Checker Finding、Process実行不能を別の結果にする。 | [§5](#5-結果と失敗の境界) |
| State／Consistency | PASS | 正方向Relation Ownerだけを入力とし、逆引きGraphを生成する原則を維持する。 | [公開入口と依存方向](#3-公開入口と依存方向) |
| Observability | PASS | Module分類、公開面、Consumer集合および移行Gateを本書で明示する。 | [§7](#7-consumer-closure) |
| Security／Trust | PASS | Root検証、regular file観測、link境界およびVersion Control AdapterのFail-closed契約を維持する。 | [Version ControlのCapabilityと再確認](../version-control/01_Architecture.md#4-capabilityと再確認) |

結果語彙は次の意味に限定する。

- `PASS`: 詳細設計上の処置と根拠節が揃った状態。実装済み・試験済みを意味しない。
- `N/A`: Architecture上、そのConcern自体が存在しない状態。未検討や後工程送りを意味しない。
- `OPEN`: 未解決の設計事項が残る状態。
- `FAIL`: 必須設計と矛盾する、または必要な設計が未充足の状態。

## Qualityへの引渡し

| 検証単位 | 対象 | 正常条件 | 反証する失敗 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|
| Dependency Direction | Domain、Checker、Infrastructure | DomainからCheckerへのimportが0 | Domainが`FindingSink`、Rule、CLIをimport | import graph | 禁止逆依存0 | 物理移動後の実Graph |
| Public Surface | Capability別公開入口とConsumer | 利用側が対象`index.ts`だけをimport | deep import、巨大Barrel、未宣言export | 公開export集合とConsumer import集合 | 旧deep import 0 | 将来MCP／Workbench接続 |
| Consumer Closure | 配布入口、開発Tool、試験、fixture | 全既知Consumerが新入口へ移行 | 旧Path残存、宣言漏れ、未知Consumer | 宣言集合と自動導出集合の差分 | 集合差分0 | 将来Consumerは接続時に再評価 |
| Result Boundary | Domain IssueとChecker Finding | 中立IssueをChecker AdapterがFindingへ変換 | Domainがseverity、Checker code、exit codeを決定 | 型と契約試験 | DomainからChecker型への依存0 | MCP／Workbench向け表示Adapter |
| Repository Boundary | Repository／Version Control API | 検証済みRoot内のregular fileだけを観測 | Root外読取り、link先を確認済み扱い | 境界反証fixture | handleと一時物0 | 代替Version Control Adapter |
| Distribution Identity | `template/tools`起動入口と`40_Develop`実装 | 起動入口が実装正本の公開APIだけへ接続 | `template/tools`内の実装コピー、旧実装混在 | launcher target／source identity | launcher内の業務ロジック0 | 採用Repositoryでの移行実測 |

## 現行実装との照合

本書は移行開始時のSource Directoryを目標構造として追認しない。移行開始時の`template/tools/internal/`にあった23 Moduleと、直下／配下の7 Entryの合計30件を棚卸し入力として全数分類した。Phase 2からPhase 5でDomain、Repository、Version ControlおよびChecker固有Moduleは各Ownerへ移行済みであり、現在残るのはPhase 6のlauncher薄型化と設定配置、Phase 7以降の署名対象Artifact移行および旧Path削除である。実装・試験との適合判定は後続Reality Auditで行う。

## 1. 移行開始時の問題

`internal`は「公開Toolではない実装詳細」を表すために導入された。しかし移行開始時は、Checker固有処理だけでなく、Reality Traceability、Semantic Coverage、Artifact Model、Relation Engine、Repository観測およびVersion Control Adapterを含んでいた。

```text
移行開始時
────────────────────────────────────────
template/tools/internal/
  ├ checker/
  │   ├ Checker固有処理
  │   └ 共通化可能なArtifact／Relation処理
  ├ reality-traceability/   共通Domain候補
  ├ semantic-coverage/      共通Domain候補
  └ version-control-runtime Infrastructure／Adapter

表示上のOwner
  すべてChecker内部に見える

実際の利用方向
  Checker ─┐
  開発Tool ├→ Reality／Semantic／Repository能力
  将来MCP ┤
  将来Workbench ┘
```

この構造のままでは、将来のMCP／WorkbenchがChecker内部Fileを直接importするか、同じ能力を再実装する。`internal`を`core`へ一括改名しても、Checker固有型への逆依存は解消しない。

## 2. 目標Component

```text
40_Develop/
│
├ crdd-domain-library/
│  └ src/
│     ├ domain/
│     │  ├ result/                 公開入口: index.ts
│     │  ├ artifact/               公開入口: index.ts
│     │  ├ relation/               公開入口: index.ts
│     │  ├ reality-traceability/   公開入口: index.ts
│     │  └ semantic-coverage/      公開入口: index.ts
│     ├ repository/                    公開入口: index.ts
│     │  ├ regular file／directoryの安全な観測
│     │  └ semantic-bundle-publisher.ts
│     ├ application/
│     │  └ semantic-coverage/       公開入口: index.ts
│     └ schemas/                       共有する機械契約
│
├ version-control/
│  └ src/
│     ├ index.ts                       公開入口
│     └ Version Control Port／Git Adapter
│
└ checker/
│  └ src/
│     ├ index.ts                       公開入口
│     └ internal/
│        ├ Pipeline／Finding変換
│        ├ Rule Registry
│        └ CRDD現行Profile Rules
│
template/tools/
├ crdd-check.ts          薄い起動入口
├ crdd-coordinator.ts    薄い起動入口
├ crdd-mcp.ts            薄い起動入口
└ config/                採用Repository向け設定・Schema
```

`domain`全体を一つの巨大なBarrelから公開しない。Artifact、Relation、Reality Traceability、Semantic Coverageごとに公開入口を持たせ、利用側が必要な能力だけへ依存する。

`internal`という名前は廃止しない。各Capabilityの公開入口の背後にあり、他Capabilityから直接利用してはならない実装詳細に限定する。

## 3. 公開入口と依存方向

### 3.1 許可する方向

```text
Repository／Version Control Infrastructure
                 ▲
                 │ 観測結果
                 │
        CRDD Domain Capabilities
  Artifact／Relation／Reality／Semantic
                 ▲
                 │ 公開API
       ┌─────────┼──────────┐
       │         │          │
    Checker     MCP     Workbench／Generator
```

| 利用側 | 利用してよい入口 | 利用してはならないもの |
|---|---|---|
| Checker | `40_Develop/crdd-domain-library/src/domain/*/index.ts`、`40_Develop/crdd-domain-library/src/repository/index.ts`、`40_Develop/version-control/src/index.ts` | 別Capabilityの`internal/` |
| 開発Tool | 対象CapabilityまたはApplicationの`index.ts` | `template/tools/internal/*`、Checker Rule |
| MCP | 必要なDomainの公開入口 | Checker Pipeline、Checker Finding、Checker Rule |
| Workbench | 必要なDomainまたは公開Application Contract | Checker内部、Filesystem Adapterの直接呼出し |
| Test | 原則として公開入口。内部単体試験だけ対象Capabilityの内部を許可 | 他Capabilityの内部実装 |

### 3.2 禁止する方向

- DomainはChecker、MCPまたはWorkbenchをimportしない。
- Repository／Version Control基盤はArtifact、RealityまたはSemanticの意味をimportしない。
- Checker固有の`FindingSink`をDomain APIの引数または戻り値にしない。
- 利用側は公開入口を飛び越えて実装Fileをdeep importしない。
- `template/tools`にDomain、Checker、RepositoryまたはVersion Controlの実装本体を置かない。

### 3.3 Capability別の公開契約

| Capability／公開入口 | 公開Symbolの完全集合／正本 | Effect | 禁止Field／責務 |
|---|---|---|---|
| Common Result `40_Develop/crdd-domain-library/src/domain/result/index.ts` | `DomainStatus`、`DomainIssue`、`DomainOutcome<T>`、`DomainLocation` | なし | Checker code、severity、rule、exit code |
| Artifact `40_Develop/crdd-domain-library/src/domain/artifact/index.ts` | `SourceLocation`、`ArtifactSection`、`ArtifactRelation`、`ChecklistResult`、`ArtifactModel`、`ArtifactSource`、`ArtifactSchema`、`ArtifactSchemaValidationResult`、`parseMarkdownArtifact`、`validateArtifactSchema` | なし | Checker Finding、利用者向けmessage |
| Relation `40_Develop/crdd-domain-library/src/domain/relation/index.ts` | `ArtifactGraph`、`BuildArtifactGraphRequest`、`ArtifactGraphResult`、`buildArtifactGraph` | なし | Checker Finding、利用者向けmessage |
| Reality Traceability `40_Develop/crdd-domain-library/src/domain/reality-traceability/index.ts` | `realitySymbolKinds`、`RealitySymbolKind`、`RealitySymbol`、`RealitySymbolManifest`、`LoadedRealitySymbolManifest`、`RealitySymbolNode`、`RealitySymbolGraph`、`RealitySymbolDiscoveryRequest`、`RealitySymbolDiscoveryResult`、`validateRealitySymbolManifest`、`discoverRealitySymbols`、`createRealitySymbolGraph` | Repository Portを通じた読取りのみ | Test合格、実装完成、Reality Audit判定、低水準Path観測の公開 |
| Semantic Coverage Domain `40_Develop/crdd-domain-library/src/domain/semantic-coverage/index.ts` | `SemanticIrMeaning`、`SemanticIr`、`QualitySemanticRelation`、`SemanticCoverageGraph`、`SemanticCoverageProjection`、`SemanticCoverageBundle`、`SemanticBundleContent`、`compileSemanticIr`、`compileQualitySemanticRelations`、`createSemanticCoverageGraph`、`createSemanticBundle` | なし | Filesystem Path、temporary file、publish完了 |
| Semantic Coverage Application `40_Develop/crdd-domain-library/src/application/semantic-coverage/index.ts` | `PublishSemanticCoverageRequest`、`PublishSemanticCoverageResult`、`publishSemanticCoverage` | Filesystem公開をPublisher Portへ要求 | Domain意味の再計算、部分公開の成功扱い |
| Repository `40_Develop/crdd-domain-library/src/repository/index.ts` | `RepositoryEntryKind`、`RepositoryDirectoryEntry`、`RepositoryFileObservation`、`RepositoryDirectoryObservation`、`RepositoryObservationPort`、`RepositoryRootCapability`、`SemanticBundlePublishRequest`、`SemanticBundlePublishReceipt`、`SemanticBundlePublisher`、`createFilesystemRepositoryObservationPort`、`createFilesystemSemanticBundlePublisher` | Filesystem読取り／明示したpublish | CRDD意味、Checker code、採用判断 |
| Version Control `40_Develop/version-control/src/index.ts` | [Version Control現行公開Symbol](../version-control/01_Architecture.md#31-現行公開symbol)を正本とする。Phase 4追加は`RepositoryEntryObservation`、`observeDeclaredNestedRepositoryPaths`、`observeRepositoryEntries`、`observeNestedRepository`、`readFixedSnapshotText`、`resolveRevisionIdentity` | Git CLI読取り | Domain意味、未Commit通常操作の拒否 |
| Checker `40_Develop/checker/src/index.ts` | `CheckerRunRequest`、`CheckerResult`、`CheckerFinding`、`runChecker` | Repository読取りのみ | Domain Issueの改変、意味採否、外部Effect許可 |

公開Symbol名は物理移動時の実装契約であり、現行Fileの全exportを自動的に公開するallowlistではない。新しい公開Symbolは同表へ追加し、`index.ts`から明示exportする。未記載SymbolはCapability内部とする。

## 4. Data Flow

```text
Repository上の入力
  Markdown／symbol.json／Architecture Details
                  │
                  ▼
CRDD Domain
  ├ Artifact Model
  ├ Relation Graph
  ├ Reality Symbol Graph
  └ Semantic Coverage Bundle
                  │
          構造化Result／Issue
                  │
       ┌──────────┼──────────────────┐
       ▼          ▼                  ▼
 Checker Adapter  MCP／Workbench  Semantic Application
       │                             │ Publisher Port
       ▼                             ▼
 Checker Finding／Exit Code   Repository Effect Adapter
                                temporary→fsync→readback
                                      →atomic publish→cleanup
```

Repositoryからの読取りが必要な場合、Domainは`node:fs`実装ではなくRepository Observation Portまたは呼出し側が取得した内容を受け取る。DomainはChecker向けの表示文や終了codeを決めない。Checker AdapterがDomainの構造化Issueを`CheckerFinding`へ変換し、RuleとPipelineが最終結果を構成する。

## 5. 結果と失敗の境界

| 結果 | Owner | 意味 |
|---|---|---|
| Domain Result | 各Domain Capability | Model、Graph、Projection等の正常結果 |
| Domain Issue | 各Domain Capability | 入力不備、重複、未知Relation、観測不能等の中立な構造化問題 |
| Checker Finding | Checker | CRDD現行Profile上のcode、severity、Path、利用者向けmessage |
| Checker実行不能 | Checker CLI／Pipeline | Root不明、必要入力の読取不能、Process失敗等で検査集合を完了できない状態 |

Phase 3では、旧`relation-engine.ts`と`schema-validator.ts`の`FindingSink`依存を除去し、中立なIssueを返すDomain APIとChecker変換Adapterへ分離した。

### 5.1 Domain Outcome

```text
DomainOutcome<T>
├ status: complete | partial | invalid | unobservable
├ result: T | null
└ issues: DomainIssue[]
```

| Status | Result | Issue | 利用条件 |
|---|---|---|---|
| `complete` | 必須 | 0件 | 完全結果として利用可能 |
| `partial` | 部分結果を許可 | 1件以上 | 不足範囲を保持する利用側だけ利用可能。`complete`へ変換禁止 |
| `invalid` | `null` | 1件以上 | 入力不正。結果利用禁止 |
| `unobservable` | `null` | 1件以上 | 観測不能。不存在または正常へ変換禁止 |

Issueが1件でもあるOutcomeは少なくとも`partial`とする。`complete`とIssueの併存は不正な契約として拒否する。情報レベルの説明が必要な場合もIssueへ隠さず、完全結果に含まれる正式fieldまたは別の利用側表示として扱う。

### 5.2 Domain Issue

| Field | Owner | 条件 |
|---|---|---|
| `kind` | Domain Capability | Capability内で安定した機械識別子。Checker codeではない |
| `targetIdentity` | Domain Capability | 問題対象のCanonicalまたは入力Identity |
| `location` | Domain Capability | Repository相対Pathと必要な行位置。絶対Pathを含めない |
| `reason` | Domain Capability | 判定した事実または観測不能理由。利用者向け表現へ固定しない |
| `details` | Domain Capability | Secretを含まない構造化補足。順序を決定的にする |

### 5.3 Checker Findingへの写像

| Domainから欠落させないもの | Checkerが追加するもの | 変換規則 |
|---|---|---|
| `kind`、`targetIdentity`、`location`、`reason`、`details` | `code`、`severity`、`rule`、利用者向け`message` | Rule所有の明示Mapping表で変換し、未知`kind`を汎用Passへ畳まない |
| `status`とResultの有無 | 未検査範囲、Checker全体状態、exit code | `partial`、`invalid`、`unobservable`を`complete`へ昇格しない |

Domain IssueはChecker severity、Rule名、exit codeを持たない。MCP／Workbenchは同じDomain Issueから各Surface固有の表示を作り、Checker Findingを表示契約として流用しない。

## 6. 配布と開発の境界

| 領域 | 責務 |
|---|---|
| `template/tools` | 採用Repository向けの安定した起動入口と設定／Schemaの配置。引数受付と実装入口の解決以外の業務ロジックを所有しない |
| `40_Develop/crdd-domain-library` | Artifact、Relation、Reality Traceability、Semantic CoverageおよびRepository Port／AdapterのCanonical実装正本 |
| `40_Develop/checker` | CheckerのCanonical実装正本、CLI、Profile、Generator、試験およびfixture |
| `40_Develop/version-control` | Version Control Port／AdapterのCanonical実装正本 |
| `40_Develop/<subsystem>/symbol.json` | 現実側Symbolの正方向Relation Owner |
| `07_Quality/Registry` | Canonical成果物から生成または移行する機械投影。Library SourceのOwnerではない |

`template/tools`から`40_Develop`へ実装をコピーしない。起動入口は、自身の実Pathから一つだけCRDD基準版Root候補を作り、そのRootのIdentityを検証してから、同じRoot直下の`40_Develop`へ接続する。親ProjectのRoot、別のCRDD版、兄弟DirectoryまたはPATH上の候補を探索しない。起動入口だけを単独コピーし、実装本体がない状態はサポートしない。

| 実行形態 | launcherの位置 | 実装解決先 | 注意 |
|---|---|---|---|
| CRDD標準の開発 | `CRDD Root/template/tools/` | `CRDD Root/40_Develop/` | 候補Rootがnearest Version Control Rootと一致し、候補Root自身の`.crdd/config/repository-manifest.json`が`schema: crdd/repository-manifest/v1`、`projectId: qual-lab.crdd`、`repositoryRole: crdd-standard`を持つことを検証する |
| CRDD採用Repository | `<Project>/<CRDD基準版Directory>/template/tools/` | `<Project>/<CRDD基準版Directory>/40_Develop/` | `template/tools/config/coordinator-package-manifest.json`の署名、配布Root、Version、Runtime Execution IdentityおよびPackage Content Rootを検証する。現行例は`00_CRDD`だがDirectory名を固定しない |
| launcherのみを単独コピー | Project Root等 | なし | 対象外。代替Pathを推定せずEffect 0で停止する |

Root候補はlauncher実Pathの`template/tools`からexactに2階層上だけを採用する。launcher、候補Root、Manifestおよび実装入口はregular file／directoryであり、symbolic link、junctionまたはRoot外解決を含んではならない。開発経路のRepository Manifestは開発Rootの識別にだけ使い、配布物の完全性やRelease Authorityを証明しない。採用経路では署名済みRelease Manifestがlauncher集合、公開API改訂、`40_Develop`およびNative Runtime Artifactを含む配布全体Identityへ結合する。Manifestがない、署名・Version・Content Rootが一致しない、または別の基準版を指す場合は、似たDirectory構造が存在してもEffect 0で停止する。

移行試験は、CRDD標準Repository直下の開発経路と、Project内のCRDD基準版Directoryを通じた採用経路を別fixtureで確認する。片方の成功をもう一方の成立根拠にしない。少なくとも、Project自身の`40_Develop`、別VersionのCRDD、Manifest欠落、改変済み配布物、同名Directoryだけを持つ配置、launcher単独コピーおよびlink介在を拒否する。

将来、単独配布Artifactが必要になった場合は、`40_Develop`の正本からRelease工程で決定論的に生成する。`template/tools`に二つ目の手編集実装を復活させない。

## 7. Consumer Closure

### 7.1 現在確認できるConsumer

| Consumer分類 | 現在のConsumer | 現在の利用 | 移行後入口 |
|---|---|---|---|
| 公開Consumer | `template/tools/crdd-check.ts` | Checker、Version Controlの実装本体と内部Pathを所有 | `40_Develop/checker/src/index.ts`の安定入口だけへ接続する薄いlauncher |
| 公開Consumer | `40_Develop/checker/crdd-check.ts` | 現行は配布Checker入口を利用 | `40_Develop/checker/src/index.ts`へ接続する公式Repository用CLI |
| 公開Consumer | `40_Develop/checker/compile-semantic-ir-pilot.ts` | Semantic／Reality／Publisherの内部Pathをimport | Semantic ApplicationとRealityの公開入口 |
| 同一Capability内部単体試験 | Artifact、Relation、Reality、Semantic各単体試験 | 対象内部Fileを直接import | 対象Capabilityの公開入口を原則とし、非公開単体だけ同一Capability内部を許可 |
| 複数Capability結合試験 | `40_Develop/checker/tests/unit/symbol-graph.contract.test.ts`、Semantic Coverage契約試験 | Reality、Repository、Checker Adapter等を同時import | 各Capabilityの公開入口。非公開内部importを禁止 |
| Checker結合試験 | `40_Develop/checker/tests/integration/crdd-check.contract.test.ts` | Checker PipelineとRule Registryを直接import | `checker/index.ts`のChecker公開入口 |
| Path／配布Closure fixture | Package／Submodule fixture、`40_Develop/version-control/tests/integration/consumer-closure.integration.test.ts` | 現行Path集合とConsumer Closureを固定 | 新公開Pathの宣言集合と旧Path禁止集合 |
| 公開／署名Consumer | Coordinator Manifest、Runtime Execution Identity、Promotion、Recovery、署名4経路E2E | `template/tools/coordinator/windows-x64/crdd-platform-access.exe`を正規Artifact Pathとして利用 | `40_Develop/platform-access/artifacts/windows-x64/`の新Pathへ同じIdentity／Authority／Recovery契約のまま一括移行 |
| Canonical文書参照 | Checker、Semantic Coverage、Version Control詳細設計 | 現行Source Pathを設計・配布参照として使用 | 移行時に現在有効な公開入口へ更新し、歴史記録は変更しない |

MCPとWorkbenchは将来Consumer候補であり、現在接続済みとは表示しない。接続時には本書の公開入口または別途定義する公開Application Contractを使用し、Checker内部をimportしない。

### 7.2 Closure条件

- 宣言した公開入口と実Sourceから導出した公開入口が一致する。
- 既知Consumerに旧`template/tools/internal/*` importが残らない。
- 禁止した逆依存を静的検査で検出できる。
- launcher、`40_Develop`実装正本、fixture、package契約および試験を同じ変更で更新する。
- 現行の配布正本を示すOverview、Coding Standards、Version Control詳細設計および通常Workflowを同じ変更で更新し、固定履歴を除く旧契約参照を0にする。
- 全Consumer移行前に旧Pathを削除しない。

## 8. Security境界

- Repository観測は検証済みRoot内のregular file／directoryに限定する。
- 公開Filesystem PortはVersion Controlが発行した検証済みRepository Root Capabilityだけを受け取り、任意Path文字列からRoot Authorityを自己発行しない。
- 完全修飾Pathは実行OSのPath形式で判定し、Windowsではdrive／通常UNCだけ、POSIXでは`/`から始まるPathだけを受理する。Windowsのroot-relative Path、device namespaceおよび異なるOS形式を受理しない。
- File内容は、Platform境界が開いたHandleの所在を検証済みRoot配下として証明できる場合だけ同じHandleから読む。Linuxは`/proc/self/fd`から開いたHandleのPathを観測する。WindowsはRoot内のCanonical Pathと開いたHandleのFile Identityを`dev`と`ino`を含むmetadataで照合する。証明手段がないPlatform、Identity不一致または観測不能ではPathの再観測から安全を推定せず`unobservable`で停止し、Handleを閉じる。
- symbolic link、junctionまたはRoot外Pathを、存在だけで確認済みにしない。
- Version ControlのProcess実行、Filesystem読取りおよびBundle書込みをDomain Modelと混在させない。
- 読取りAPIとFilesystem Effectを持つAPIを公開面で区別する。
- Domain ResultからAuthority、採用判断、Release判断または外部Effect許可を生成しない。

## 9. 現行ModuleとTemplate Surfaceの全数分類

次表の`domain/`、`repository/`および`application/`は`40_Develop/crdd-domain-library/src/`を基点とする。`checker/`は`40_Develop/checker/src/`、`version-control/`は`40_Develop/version-control/src/`を基点とする。`template/tools`はこれらの移動先にしない。

| 現在Path（`template/tools/internal/`以下） | 現在の責務 | 目標Owner／Path | 公開判断 | 移行前提 |
|---|---|---|---|---|
| `checker/artifact-model.ts` | Artifact型 | `domain/artifact/` | 公開 | なし |
| `checker/markdown-artifact-parser.ts` | MarkdownからArtifactへの変換 | `domain/artifact/` | 公開入口から公開 | Parser結果契約を固定 |
| `checker/schema-validator.ts` | Artifact構造検査 | `domain/artifact/` | 公開入口から公開 | `FindingSink`を中立Issueへ分離 |
| `checker/relation-engine.ts` | Artifact Relation Graph | `domain/relation/` | 公開入口から公開 | `FindingSink`を中立Issueへ分離 |
| `checker/finding-model.ts` | Checker固有Finding | `checker/` | Checker入口から公開 | Domain Issueとの変換を追加 |
| `checker/checker-pipeline.ts` | Checker実行編成 | `checker/internal/` | 非公開 | Domain公開入口へ依存を変更 |
| `checker/rule-registry.ts` | Checker Ruleと実行段階 | `checker/internal/` | 非公開 | なし |
| `checker/rules/current-profile.ts` | 現行Profile Rule構成 | `checker/internal/rules/` | 非公開 | なし |
| `checker/rules/quality-design-state.ts` | Quality状態Rule | `checker/internal/rules/` | 非公開 | なし |
| `checker/rules/reality-symbol-graph.ts` | Reality GraphのChecker Rule | `checker/internal/rules/` | 非公開 | Reality公開入口へ依存を変更 |
| `checker/rules/reality-test-catalog-adapter.ts` | Test CatalogをChecker入力へ変換 | `checker/internal/adapters/` | 非公開 | Repository公開入口へ依存を変更 |
| `reality-traceability/repository-regular-file-observer.ts` | regular file／directory観測 | `repository/` | 公開入口から公開 | Reality固有型を持たないことを確認 |
| `reality-traceability/symbol-manifest-model.ts` | Symbol Manifest型とIssue | `domain/reality-traceability/` | 公開 | なし |
| `reality-traceability/symbol-manifest-validator.ts` | Symbol Manifest検証 | `domain/reality-traceability/` | 公開入口から公開 | Repository観測を公開入口経由にする |
| `reality-traceability/symbol-annotation.ts` | Source Annotation抽出 | `domain/reality-traceability/internal/` | 非公開 | Discovery経由だけで利用可能にする |
| `reality-traceability/symbol-discovery.ts` | Symbol探索とSource照合 | `domain/reality-traceability/` | 公開入口から公開 | Domain探索とRepository Observationの実行編成を分け、`node:fs`直接依存を除く |
| `reality-traceability/symbol-graph.ts` | Global Symbol Graph | `domain/reality-traceability/` | 公開入口から公開 | なし |
| `semantic-coverage/legacy-runtime-inventory.ts` | 旧JSON移行棚卸し | `checker/src/internal/migrations/` | 非公開 | Domain公開契約へ含めず、Checkerが所有する一時的な移行入力としてPilot終了後の保持要否を再評価 |
| `semantic-coverage/semantic-ir-compiler.ts` | Semantic IR生成 | `domain/semantic-coverage/` | 公開入口から公開 | Repository読取りを呼出し側へ分離し、構造化入力からの決定論的生成に限定する |
| `semantic-coverage/quality-semantic-relation.ts` | Quality Local ItemとのRelation生成 | `domain/semantic-coverage/` | 公開入口から公開 | Repository読取りを呼出し側へ分離し、完全修飾IDを維持する |
| `semantic-coverage/semantic-coverage-graph.ts` | Coverage Graph／Projection | `domain/semantic-coverage/` | 公開入口から公開 | 完成状態と観測状態を分ける |
| `semantic-coverage/semantic-bundle-writer.ts` | Bundleの原子的公開 | `domain/semantic-coverage/`の純粋Bundle Builderと`repository/semantic-bundle-publisher.ts`へ分割 | DomainはBuilderを公開し、Publisher PortはApplicationから利用 | atomic publish、readback、失敗時cleanupを維持し、DomainからFilesystem Effectを除く |
| `version-control-runtime.ts` | Git Adapter／固定Snapshot読取り | `version-control/src/git/checker-repository-observation-adapter.ts` | 公開入口から公開 | Phase 4で配布複製を廃止し、開発・採用の両Rootから同じ公開入口を利用する |

上表は`template/tools/internal/`の23 Moduleを全数分類した。`template/tools`をlauncherと設定配置に限定するため、直下および配下の7 Entryも次のように処置する。

| 現在Path（`template/tools/`以下） | 現在の責務 | 目標Owner／Path | 処置 | 移行前提 |
|---|---|---|---|---|
| `crdd-check.ts` | 安定入口とChecker実装本体 | launcherは現Path、実装は`40_Develop/checker/` | launcherだけ残す | 開発・採用の両Root経路と単独launcher拒否を`RCM-09`で固定 |
| `crdd-coordinator.ts` | Coordinatorへの薄い安定入口 | launcherは現Path、実装は`40_Develop/coordinator/` | 現状を維持 | launcherに業務ロジックが増えない契約を追加 |
| `crdd-mcp.ts` | 安定入口とMCP起動／結果出力ロジック | launcherは現Path、実装は`40_Develop/mcp/bin/launch.ts` | launcherだけ残す | stdio／HTTP、signal cleanup、help／error結果のConsumer Closureを先に固定 |
| `schemas/reality-symbol-schema.json` | Reality Symbolの機械契約 | `template/tools/config/schemas/` | 設定／Schemaとして残す | 読取りConsumerとPathを同じ変更で移行 |
| `schemas/semantic-coverage-pilot-schema.json` | Semantic Coverage Pilotの機械契約 | `template/tools/config/schemas/` | 設定／Schemaとして残す | Pilot表示の解除判断と読取りConsumerを確認 |
| `schemas/semantic-ir-pilot-schema.json` | Semantic IR Pilotの機械契約 | `template/tools/config/schemas/` | 設定／Schemaとして残す | Pilot表示の解除判断と読取りConsumerを確認 |
| `coordinator/windows-x64/crdd-platform-access.exe` | 署名対象のNative Runtime Artifact | `40_Develop/platform-access/artifacts/windows-x64/` | Templateから移動 | Manifest、Runtime Execution Identity、署名、Promotion、RecoveryおよびE2EのConsumer Closureを別Gateで完了 |

Native Runtime Artifactの移動は、単なるDirectory整理ではない。現在の署名対象Pathを変えるため、[Coordinator詳細設計](../coordinator/01_Architecture.md)、[Platform Access詳細設計](../platform-access/01_Architecture.md)、署名Workflow、Manifest ConsumerおよびRecovery Matrixと同じ変更単位で閉じる。この別Gateを通るまで現行Artifactを削除しない。

## 10. 段階移行

| Phase | 対象 | 完了条件 |
|---|---|---|
| 0. 設計固定 | 本書、CHG、Module分類、公開入口 | 独立レビューPass。物理移動は0 |
| 1. 実装正本の受け皿 | `40_Develop/crdd-domain-library`、`40_Develop/checker/src`、薄いlauncher契約 | package境界、公開API、開発Manifest／署名済みRelease ManifestによるRoot Identity、template-only非対応を契約試験で固定 |
| 2. Reality／Semantic公開 | Reality Traceability、Semantic Coverage、Repository観測、Semantic Publisher | Domain計算とFilesystem Effectを分け、開発ToolとChecker Ruleが`40_Develop`の公開入口を使用し、旧deep importが0 |
| 3. Artifact／Relation分離 | Artifact Model、Parser、Schema、Relation | Domain IssueとChecker Findingを分離し、Checker逆依存が0 |
| 4. Version Control公開 | Version Control Adapter | 既存Version Control契約とConsumer Closureを維持 |
| 5. Checker内部整理 | Pipeline、Finding、Rule、Profile | Checker固有処理だけが`40_Develop/checker/src/internal/`に残る |
| 6. launcher薄型化 | `crdd-check.ts`、`crdd-mcp.ts`、Schema配置、現在有効な文書／Workflow | 開発・採用の両Root経路、MCPのLifecycleおよび設定Path移行後に、launcherと設定だけが残り、固定履歴を除く旧配布契約参照が0になる |
| 7. 署名対象Artifact移行 | Platform Access、Manifest、Runtime Execution Identity、Promotion、Recovery | 新Artifact Pathを同じ署名契約で固定し、署名・4経路・Recoveryの実境界確認後だけ旧Pathを削除 |
| 8. 旧Path削除 | 旧`template/tools/internal/`と不要になったTemplate内実装 | 全Consumer、fixture、package、試験および署名経路の移行後に削除 |

Phase単位で型検査、Lint、Formatter、局所契約試験、全Catalog回帰およびCheckerを実行する。一括移動後に利用側を探す進め方は採らない。

## 11. 非目標

- 設計固定だけを根拠にSource移動を完了扱いすること
- `internal`を`core`へ一括改名すること
- 単一の巨大な`domain/index.ts`を作ること
- WorkbenchまたはMCPを実装済みConsumerとして扱うこと
- Checker FindingをCRDD共通Domainの結果型にすること
- Git Adapterの意味をDomainへ取り込むこと
- 公開APIから採用、Authority、Releaseまたは外部Effect許可を発行すること

Architecture固有の追加人間判断はない。各Phaseは、対象Consumer、局所契約試験、全回帰および独立レビューを閉じてから次Phaseへ進む。

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
