# CRDD Domain Libraryの責務境界

成果物種別: Architecture詳細設計
詳細設計領域: crdd-domain-library
状態: Stable

## 基本設計との関係

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000001](../../Definitions/ARCH-000001/architecture_definition.md) | Artifact解析、Relation構築等の共通能力と、Checker固有の判定・結果表現を分ける。 | Covered |
| [ARCH-000002](../../Definitions/ARCH-000002/architecture_definition.md) | Consumer Closureを含む共通Relation能力を、Checker以外の利用側も同じ意味で利用できる境界にする。 | Covered |
| [ARCH-000008](../../Definitions/ARCH-000008/architecture_definition.md) | Reality TraceabilityをChecker Ruleから分離し、実装・試験Symbolの中立な観測能力として公開する。 | Covered |
| [ARCH-000009](../../Definitions/ARCH-000009/architecture_definition.md) | Repository観測とVersion Control Adapterを、Domain意味およびChecker実装から分離する。 | Covered |

本書は、CRDD Domain Library、Checker、Repository／Version Control基盤および利用側の現在あるべき責務境界を定義する。移行前Path、段階移行、検証結果および残るGateは[CHG-000076](../../../99_Roadmap/Changes/CHG-000076/change.md)が所有する。

## 1. 責務と非目標

### 1.1 この設計が所有すること

- CRDD共通Domain能力とChecker固有能力の境界
- Capability別の公開入口とexport許可集合
- Filesystem／Version Controlを扱うRepository境界
- Domain ResultからSurface固有結果へ変換する責務
- 開発Rootと採用Rootの両方で成立する実装解決境界
- Consumer Closureを維持する恒久条件

### 1.2 非目標

- Checker FindingをCRDD共通Domainの結果型にすること
- 単一の巨大なRoot Barrelを作ること
- 同名Fileや類似Algorithmだけを根拠に共通化すること
- MCPまたはWorkbenchを接続済みConsumerとして扱うこと
- Git Adapterの意味をDomainへ取り込むこと
- 公開APIから採用、Authority、Releaseまたは外部Effect許可を発行すること
- Source移行の進捗や試験結果をArchitectureの正本にすること

## 2. ComponentとSource配置

```text
40_Develop/
│
├ crdd-domain-library/
│  └ src/
│     ├ index.ts                   Package全体の公開入口
│     ├ outcome.ts                 Capability横断の中立な処理結果契約
│     ├ artifact/                  Artifact解析・Schema・Relation Graph
│     ├ filesystem-store-root/     用途限定Store Root Capabilityと排他
│     ├ reality-traceability/      Symbol Manifest・Annotation・Graph
│     └ repository-observation/    検証済みRoot内の安全なRepository観測
│
├ version-control/
│  └ src/
│     └ index.ts                   公開入口
│
└ checker/
   ├ src/
   │  ├ index.ts                   公開入口
   │  ├ pipeline/                  Checker実行編成
   │  ├ findings/                  Checker固有結果
   │  ├ rules/                     Rule Registry／現行Profile
   │  ├ adapters/                  Domain結果からChecker結果への変換
   │  └ migrations/                期限付き移行処理
   ├ bin/                           人間／package script向けの薄いCLI
   ├ scripts/                       開発・生成・移行専用Script
   └ tests/                         試験と試験専用支援

└ verification-runner/
   ├ src/
   │  ├ index.ts                   公開入口
   │  ├ application/               回帰実行Use Case
   │  ├ catalog/                   Test Catalog読取り・選択
   │  └ execution/                 段階計画と子Process実行
   ├ bin/                           人間／package script向けの薄いCLI
   └ tests/                         検証実行Capabilityの試験

└ semantic-coverage/
   ├ src/
   │  ├ index.ts                   公開入口
   │  ├ application/               意味Coverage生成の編成
   │  ├ infrastructure/            Bundleの原子的公開
   │  └ migrations/                旧Runtime JSONの移行入力
   ├ bin/                           Pilot CLI
   └ tests/                         意味Coverageと公開境界の試験

template/tools/
├ crdd-check.ts                    薄い起動入口
├ crdd-coordinator.ts              薄い起動入口
├ crdd-mcp.ts                      薄い起動入口
└ config/                          採用Repository向け設定・Schema
```

物理Directoryは公開／非公開ではなく、Capability、責務または外部境界を表す。`internal/`を非公開性の根拠にせず、Architectureが宣言したRootまたはCapability単位の`index.ts`とexport集合で公開面を制御する。

`src/`直下はCapabilityを表し、その下は最大一階層までとする。Package名ですでに表現している`domain/`や`repository/`を重ねず、`src/domain/...`のような形式的な深掘りを行わない。型だけのFileも責務名で命名し、`types.ts`のような雑多な集約を既定にしない。共通結果契約の実体は`outcome.ts`、Package公開面は`src/index.ts`が所有する。

Package Rootにはecosystem固定Fileだけを置く。TypeScript Sourceは`src/`、`bin/`、`scripts/`または`tests/`の責務へ分類する。`bin/`は引数受付、公開Use Caseの呼出し、構造化結果の表示および終了値反映だけを所有する。回帰段階の選択・実行、Process呼出し、Authority判定および計画・結果構築はVerification Runnerが所有する。`bin/`と`scripts/`は実装本体を再定義せず、宣言済み公開入口を利用する。

## 3. 公開入口と依存方向

### 3.1 許可する方向

```text
Repository／Version Control Infrastructure
                 ▲
                 │ 観測結果
        CRDD Domain Capabilities
     Artifact／Relation／Reality
                 ▲
                 │ 公開API
       ┌─────────┼──────────┐
       │         │          │
    Checker     MCP     Workbench／Generator
```

| 利用側 | 利用してよい入口 | 利用してはならないもの |
|---|---|---|
| Checker | `crdd-domain-library/src/index.ts`、必要なCapabilityの`index.ts`、Version Controlの用途限定公開入口 | 別Capabilityの非公開実装Path、不要なGit Adapterを含むRoot公開入口 |
| 開発Tool | Architectureが宣言した対象CapabilityまたはApplicationの`index.ts` | Checker Rule、任意の近傍`index.ts` |
| MCP | 必要なDomainの公開入口 | Checker Pipeline、Checker Finding、Checker Rule |
| Workbench | 必要なDomainまたは公開Application Contract | Checker実装、Filesystem Adapterの直接呼出し |
| Test | 原則として公開入口。非公開単位の試験だけ同じCapabilityの実装Path | 他Capabilityの非公開実装 |

### 3.2 禁止する方向

- DomainはChecker、MCPまたはWorkbenchをimportしない。
- Repository／Version Control基盤はArtifactまたはRealityの意味をimportしない。
- Checker固有の`FindingSink`をDomain APIの引数または戻り値にしない。
- Subsystem外の利用側は公開入口を飛び越えて実装Fileをdeep importしない。
- `template/tools`にDomain、Checker、RepositoryまたはVersion Controlの実装本体を置かない。

### 3.3 Capability別の公開契約

| Capability／公開入口 | 公開Symbolの完全集合／正本 | Effect | 禁止する責務 |
|---|---|---|---|
| Package Root `crdd-domain-library/src/index.ts` | Capability別namespaceと共通Outcome型 | なし | 全実装Symbolの無差別な再公開 |
| Common Outcome `crdd-domain-library/src/outcome.ts` | `DomainStatus`、`DomainIssue`、`DomainOutcome<T>`、`DomainLocation` | なし | Capability固有Issue種別、Checker code、severity、rule、exit code |
| Artifact `crdd-domain-library/src/artifact/index.ts` | Artifact Model、Schema検証、Relation Graphの公開型と決定論的関数 | なし | Checker Finding、利用者向けmessage |
| Filesystem Store Root `crdd-domain-library/src/filesystem-store-root/index.ts` | 検証済みRoot Capability、Root内Path解決、OS Kernel排他、exact残存Lock回復 | Root検証では読取り、排他操作ではHash導出EndpointのlistenとLock Record作成・削除 | 任意絶対PathのAuthority化、Link／Junction経由のRoot拡張、個別Domain判断、Filesystem Recordだけによる排他推定 |
| Reality Traceability `crdd-domain-library/src/reality-traceability/index.ts` | Symbol Manifest、Annotation解釈、Graphの公開型と決定論的な生成・検証関数 | なし。Path APIはRepository相対表記の構文検査だけに用いる | Repository走査、Checker Finding変換、Reality Audit実行、Test合格、実装完成 |
| Repository Observation `crdd-domain-library/src/repository-observation/index.ts` | Repository観測Port、Root Capability、Reality Symbol Repository観測 | Filesystem読取り | CRDD意味、公開Effect、Checker code、採用判断 |
| Semantic Coverage `semantic-coverage/src/index.ts` | Repository入力の編成、診断、Bundle生成・公開 | 明示したBundle公開 | Architecture・Quality・実装の意味採否、部分公開の成功扱い |
| Version Control `version-control/src/checker-observation/index.ts`、`version-control/src/repository-identity/index.ts` | [Version Control用途限定公開入口](../version-control/01_Architecture.md#32-用途を限定した公開入口) | 宣言されたRepository観測とIdentity確認 | Domain意味、未Commit通常操作の拒否、利用しないGit Adapterの依存閉包への混入 |
| Checker `checker/src/index.ts` | `CheckerRunRequest`、`CheckerResult`、`CheckerFinding`、`runChecker` | Repository読取りのみ | Domain Issueの改変、意味採否、外部Effect許可 |
| Verification Runner `verification-runner/src/index.ts` | `RegressionRunRequest`、`RegressionRunResult`、`runRegression` | 宣言された試験段階の選択と子Process実行 | Checker規則、CLI表示、`process.argv`解釈、`process.exitCode`設定 |

未記載SymbolはCapability内部とする。新しい公開Symbolは本表へ追加し、宣言した公開Symbol集合と実export集合を契約試験で完全一致させる。

Filesystem Storeの所有権遷移は、WindowsではNamed Pipe、LinuxではAbstract Unix SocketをWorker lifetimeへ結合したOS Kernel排他で直列化する。Lock RecordはRecovery IdentityとOwner PIDを保持する耐久根拠であり、排他そのものではない。Recordの生成、観測および回復対象の確定は同じKernel Lock内で行う。Kernel Endpoint解放後のRecord削除は、同じexact IdentityのObligationを再確認する二段階cleanupとして別世代を保護する。

通常Operationと回復Operationのどちらでも、Kernel Endpointを解放する前に同じRootへexact Recovery IdentityのRecovery Obligation Recordを書き込み、`fsync`で耐久化する。Operation結果とcleanup結果は別に扱い、Effect発行後に解放を確認できない場合はEffect状態を`issued`、`not_issued`または`unknown`として搬送し、Lock RecordとObligation Recordを残す。成功結果はKernel Endpointの解放、同じRecordの再確認、Obligation解消まで確認した場合だけ返す。後続Ownerは通常Recordより先にObligationを確認してEffect 0で停止し、同じIdentityの再入場だけが再確認と解消を行える。

Owner不存在の観測でもKernel Endpointの解放を確認できなければProofを返さず観測不能とする。空、部分、破損または読取り不能なRecordは`recovery_required`へ昇格せず観測不能としてEffect 0で停止する。`recovery_required`を返す場合は、検証済みRecordに含まれる非nullのexact Recovery Identityを必須とする。対応するKernel原語を提供しないOSではFilesystem Lockへ縮退せず、観測不能として停止する。

## 4. Data Flow

```text
Repository上の入力
  Markdown／symbol.json／Architecture Details
                  │
                  ▼
CRDD Domain Library
  ├ Artifact Model
  ├ Relation Graph
  └ Reality Symbol Graph
                  │
          構造化Result／Issue
                  │
       ┌──────────┼──────────────────┐
       ▼          ▼                  ▼
 Checker Adapter  MCP／Workbench  Semantic Coverage
       │                             │
       ▼                             ▼
 Checker Finding／Exit Code   Bundle公開Adapter
                         temporary→fsync→readback
                               →atomic publish→cleanup
```

Repositoryからの読取りが必要な場合、Domainは`node:fs`実装ではなくRepository Observation Portまたは呼出し側が取得した内容を受け取る。Checker AdapterがDomainの構造化Issueを`CheckerFinding`へ変換し、RuleとPipelineが最終結果を構成する。

## 5. 結果と失敗の境界

| 結果 | Owner | 意味 |
|---|---|---|
| Domain Result | 各Domain Capability | Model、Graph、Projection等の正常結果 |
| Domain Issue | 各Domain Capability | 入力不備、重複、未知Relation、観測不能等の中立な構造化問題 |
| Checker Finding | Checker | 現行Profile上のcode、severity、Path、利用者向けmessage |
| Checker実行不能 | Checker CLI／Pipeline | Root不明、必要入力の読取不能、Process失敗等で検査集合を完了できない状態 |

Domain IssueはChecker severity、Rule名、exit codeを持たない。MCP／Workbenchは同じDomain Issueから各Surface固有の表示を作り、Checker Findingを表示契約として流用しない。

変換では`kind`、`targetIdentity`、`location`、`reason`、`details`、`status`およびResultの有無を欠落させない。Checkerは明示Mappingで`code`、`severity`、`rule`、`message`を追加し、未知kind、欠落detail、`partial`、`invalid`または`unobservable`を汎用Passへ畳まない。

## 6. 配布と開発の境界

| 領域 | 責務 |
|---|---|
| `template/tools` | 採用Repository向けの安定した起動入口と設定／Schema。業務ロジックを所有しない |
| `40_Develop/crdd-domain-library` | Artifact、Relation、Reality Traceability、共通OutcomeおよびRepository ObservationのCanonical実装正本 |
| `40_Develop/checker` | CheckerのCanonical実装正本、CLI、Profile、Generator、試験およびfixture |
| `40_Develop/version-control` | Version Control Port／AdapterのCanonical実装正本 |
| `40_Develop/<subsystem>/symbol.json` | 現実側Symbolの正方向Relation Owner |
| `07_Quality/Registry` | Canonical成果物から生成または移行する機械投影。Library SourceのOwnerではない |

`template/tools`から`40_Develop`へ実装をコピーしない。起動入口は自身の実PathからCRDD基準版Root候補を一つだけ導出し、そのRootのIdentityを検証してから同じRoot直下の`40_Develop`へ接続する。

| 実行形態 | launcherの位置 | 実装解決先 | 判定 |
|---|---|---|---|
| CRDD標準の開発 | `CRDD Root/template/tools/` | `CRDD Root/40_Develop/` | Repository Manifestで開発Rootを検証する |
| CRDD採用Repository | `<Project>/<CRDD基準版Directory>/template/tools/` | 同じ基準版Directoryの`40_Develop/` | 署名済みRelease Manifestと配布全体Identityを検証する |
| launcherだけの単独コピー | Project Root等 | なし | 対象外。代替Pathを推定せずEffect 0で停止する |

Root候補はlauncher実Pathの`template/tools`からexactに2階層上だけを採用する。launcher、候補Root、Manifestおよび実装入口はregular file／directoryであり、symbolic link、junctionまたはRoot外解決を含んではならない。単独配布Artifactが必要な場合は`40_Develop`の正本からRelease工程で決定論的に生成し、`template/tools`に二つ目の手編集実装を作らない。

## 7. Consumer Closure

### 7.1 Consumer契約

| Consumer分類 | 利用契約 |
|---|---|
| `template/tools` launcher | 同じ基準版Rootの公開入口だけへ接続し、実装本体を持たない |
| CRDD公式Repository CLI | Checker公開入口へ接続し、DomainやRuleの非公開Pathをimportしない |
| Verification Runner CLI | `verification-runner/src/index.ts`だけへ接続し、試験段階、Process実行、Authority判定または計画・結果構築を再実装しない |
| 開発／生成Script | 用途を限定し、必要なCapabilityの宣言済み公開入口を使う |
| 同一Capabilityの単体試験 | 公開入口を原則とし、非公開単位だけ同じCapabilityの実装Pathを利用できる |
| 複数Capabilityの結合試験 | 各Capabilityの公開入口を使い、他Capabilityの実装Pathをimportしない |
| MCP／Workbench | 接続時にDomainまたは公開Application Contractを使い、Checker実装を再利用しない |

MCPとWorkbenchは将来Consumer候補であり、現在接続済みとは表示しない。

### 7.2 Closure条件

- 宣言した公開入口と実Sourceから導出した公開入口が一致する。
- 全ConsumerがArchitecture宣言済みの入口だけを利用する。
- 未宣言export、Subsystem間deep importおよび禁止する逆依存を機械検出する。
- Source Path変更時は、launcher、package script、fixture、試験、現在有効な文書および配布契約を同じ変更で確認する。
- 旧Pathは、全Consumer移行と終了後不存在を確認するまで削除済みと扱わない。
- Consumer集合は手書き台帳だけに依存せず、実Sourceと公開入口から導出した集合との差分を確認する。

## 8. Security境界

- Repository観測は検証済みRoot内のregular file／directoryに限定する。
- 公開Filesystem PortはVersion Controlが発行した検証済みRepository Root Capabilityだけを受け取る。
- 完全修飾Pathは実行OSのPath形式で判定し、Windowsではdrive／通常UNC、POSIXでは`/`から始まるPathだけを受理する。
- File内容は、開いたHandleの所在を検証済みRoot配下として証明できる場合だけ、同じHandleから読む。
- Identity不一致、証明不能または観測不能では安全を推定せず、`unobservable`で停止してHandleを閉じる。
- symbolic link、junctionまたはRoot外Pathを、存在だけで確認済みにしない。
- Version ControlのProcess実行、Filesystem読取りおよびBundle書込みをDomain Modelと混在させない。
- 読取りAPIとFilesystem Effectを持つAPIを公開面で区別する。
- Domain ResultからAuthority、採用判断、Release判断または外部Effect許可を生成しない。

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | Checker固有、CRDD共通Domain、Repository／Version Control基盤を分ける。 | [§2](#2-componentとsource配置) |
| Interface Model | Required | 利用側が実装Fileを直接importしない公開入口を固定する。 | [§3](#3-公開入口と依存方向) |
| Data Flow | Required | Repository入力からDomain、Surface結果、Effect Adapterまでを示す。 | [§4](#4-data-flow) |
| State Model | N/A | Library境界は長期状態を所有しない。個別能力の状態は各詳細設計が所有する。 | - |
| Sequence | Required | Domain結果をSurface固有結果へ変換する順序を固定する。 | [§4](#4-data-flow) |
| Failure／Recovery | Required | 観測不能、Domain Issue、Checker Findingおよび実行不能を分ける。 | [§5](#5-結果と失敗の境界) |
| Deployment | Required | `40_Develop`を実装正本、`template/tools`を薄い入口と設定配置に限定する。 | [§6](#6-配布と開発の境界) |
| Observability | Required | 公開APIとConsumer集合のClosure条件を固定する。 | [§7](#7-consumer-closure) |
| Security Boundary | Required | Root検証、link非追従、読取りと書込みEffectの分離を維持する。 | [§8](#8-security境界) |
| Implementation Structure | Required | 設計責務を具象差、選択、状態依存、構成、資源Ownerおよび外部境界へ分解する。 | [§Implementation Structure](#implementation-structure) |

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | N/A | Library境界は共有可変状態を新設しない。個別Effectの並行制御は各Capabilityが所有する。 | [§2](#2-componentとsource配置) |
| Timing | N/A | Library境界自体に時間制約を追加しない。 | [§4](#4-data-flow) |
| Resource Lifecycle | PASS | Handleと一時物はEffectを持つAdapterが所有し、Domainへ移さない。 | [§8](#8-security境界) |
| External Boundary | PASS | FilesystemとVersion ControlをRepository／Adapterとして分離する。 | [§3](#3-公開入口と依存方向) |
| Failure／Recovery | PASS | Domain Issue、Surface固有結果、実行不能を分ける。 | [§5](#5-結果と失敗の境界) |
| State／Consistency | PASS | 正方向Relation Ownerだけを入力とし、逆引きGraphを生成する。 | [§4](#4-data-flow) |
| Observability | PASS | 公開面とConsumer集合を宣言集合・導出集合で照合する。 | [§7](#7-consumer-closure) |
| Security／Trust | PASS | Root Capability、regular file、Handle所在およびlink境界を維持する。 | [§8](#8-security境界) |

結果語彙は次の意味に限定する。

- `PASS`: 詳細設計上の処置と根拠節が揃った状態。実装済み・試験済みを意味しない。
- `N/A`: Architecture上、そのConcern自体が存在しない状態。未検討や後工程送りを意味しない。
- `OPEN`: 未解決の設計事項が残る状態。
- `FAIL`: 必須設計と矛盾する、または必要な設計が未充足の状態。

## Qualityへの引渡し

| 導出キー | 設計項目種別 | 対象 | 正常条件 | 反証する失敗 | 主な試験段階 | 外部境界の段階 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|---|---|---|
| `crdd-domain-library.dependency-direction` | Implementation Structure | Domain、Checker、Repository基盤 | DomainからCheckerへのimportが0 | DomainがChecker型、RuleまたはCLIをimport | IT | N/A | import graph | 禁止逆依存0 | 将来Consumer接続時の再確認 |
| `crdd-domain-library.public-surface` | Interface／Implementation Structure | Capability別公開入口 | 利用側が宣言済み`index.ts`だけをimport | deep import、巨大Barrel、未宣言export | UT／IT | Direct Boundary | export集合とConsumer import集合 | 集合差分0 | 将来公開API追加時の再確認 |
| `crdd-domain-library.source-layout` | Implementation Structure | CRDD所有Source | Directoryが責務を表し、Package Rootへ任意Sourceがない | 汎用`internal`、Root直下の`.ts`、Owner不明の共通置場 | IT | N/A | import graphとSource tree | 禁止Path 0 | 別Subsystem変更時の再確認 |
| `crdd-domain-library.consumer-closure` | Flow／Consistency | launcher、CLI、Script、試験 | 全Consumerが現在の入口を利用 | 旧Path残存、宣言漏れ、未知Consumer | IT | Related 2 Blocks | 宣言集合と自動導出集合 | 集合差分0 | 将来Consumer接続時の再確認 |
| `crdd-domain-library.result-boundary` | Interface | Domain IssueとSurface固有結果 | 中立IssueをSurface Adapterが変換 | Domainがseverity、Checker code、exit codeを決定 | UT／IT | Direct Boundary | 型と契約試験 | DomainからChecker型への依存0 | MCP／Workbench表示Adapter |
| `crdd-domain-library.repository-boundary` | Interface／Failure-Recovery | Repository観測と公開Effect | 検証済みRoot内のregular fileだけを観測 | Root外読取り、link先を確認済み扱い | IT | Direct Boundary | 境界反証fixture | Handleと一時物0 | 代替Version Control Adapter |
| `crdd-domain-library.distribution-identity` | Interface／Deployment | launcherと同じ基準版Rootの実装 | launcherが公開APIだけへ接続 | `template/tools`内の実装コピー、別版へのfallback | IT／ST | Related 2 Blocks | launcher target／配布Identity | launcher内の業務ロジック0 | 採用Repositoryでの配布実測 |

導出キーは本領域内でQualityが同じ設計項目を反復参照するための局所参照であり、CRDD全体の安定コンテキストIDではない。

## 現行実装との照合

本書は現在あるべき設計を所有し、現行Sourceを設計の根拠として逆輸入しない。Source、Test、package、配布物およびEvidenceとの一致は、Canonical設計固定後のReality Auditで照合する。移行中のPath対応、実行結果および残るGateはCHG-000076で追跡する。

## Implementation Structure

| 観点 | 適用 | 判定理由 | 成立させる構造 | 局所責務・不変条件 | 失敗・変更時の影響 | Qualityへの導出キー |
|---|---|---|---|---|---|---|
| Variation | Required | この観点を成立させる構造と責務が存在するため。 | Qualityへの引渡しで責務差を別の設計項目として固定する。 | 具象差を一つの分岐へ畳まず、各導出キーの正常条件と反証条件を保つ。 | 新しい具象を追加した場合、対応する導出キーと利用側の再確認が必要になる。 | `crdd-domain-library.dependency-direction`<br>`crdd-domain-library.public-surface`<br>`crdd-domain-library.source-layout`<br>`crdd-domain-library.consumer-closure`<br>`crdd-domain-library.result-boundary`<br>`crdd-domain-library.repository-boundary`<br>`crdd-domain-library.distribution-identity` |
| Common Contract | Required | この観点を成立させる構造と責務が存在するため。 | Artifact、Relation、Repository ObservationおよびResultを、Checker／MCP／Workbenchから再利用できるDomain契約として公開する。 | Domain型はCLIやFilesystemの具象を所有せず、各Consumerが同じ意味と結果語彙を利用する。 | Consumer別の類似型・変換・例外語彙が増え、同じCRDD意味が分岐する。 | `crdd-domain-library.public-surface`<br>`crdd-domain-library.result-boundary`<br>`crdd-domain-library.repository-boundary` |
| Creation／Selection | N/A | 本領域は独立した具象生成・選択責務を持たず、上位から固定入力を受ける。 | 本領域は独立した具象生成・選択責務を持たず、上位から固定入力を受ける。 | 生成・選択判断を本領域へ追加しない。 | 将来生成・選択責務を追加する場合に再評価する。 | N/A |
| State-dependent Behavior | N/A | 独立した状態遷移を所有せず、構造契約だけを扱う。 | 独立した状態遷移を所有せず、構造契約だけを扱う。 | 状態を新設する場合はOwnerと遷移を再設計する。 | 現時点では非該当。 | N/A |
| Composition／Recursion | Required | この観点を成立させる構造と責務が存在するため。 | 複数の局所責務を公開結果へ合成し、部分成立と全体成立を分ける。 | 各局所結果を保持し、必要な全要素が揃うまで上位完成を表示しない。 | 構成要素の追加時は完成条件と全Consumerを再確認する。 | `crdd-domain-library.dependency-direction`<br>`crdd-domain-library.public-surface`<br>`crdd-domain-library.source-layout`<br>`crdd-domain-library.consumer-closure`<br>`crdd-domain-library.result-boundary`<br>`crdd-domain-library.repository-boundary`<br>`crdd-domain-library.distribution-identity` |
| Lifecycle Ownership | Required | この観点を成立させる構造と責務が存在するため。 | Process、Handle、一時物、秘密または公開SnapshotのOwnerと終了条件を固定する。 | 成功・失敗・取消の全経路で資源回収または同一Identityの回復義務を残す。 | Owner変更は取消、Recovery、終了後条件へ波及する。 | `crdd-domain-library.distribution-identity` |
| External Boundary | Required | この観点を成立させる構造と責務が存在するため。 | 外部境界ごとに要求、受理、Effect、結果搬送および終了後状態を分ける。 | 境界の成功を要求発行だけから推定せず、段階に応じた観測を必須にする。 | 境界変更は直接境界からSystem／E2Eまでの検証範囲へ波及する。 | `crdd-domain-library.distribution-identity` |

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
