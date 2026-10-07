# Domain Modelの責務境界

成果物種別: Architecture詳細設計
詳細設計領域: crdd-domain-library
状態: Candidate

## 基本設計との関係

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000001](../../Definitions/ARCH-000001/architecture_definition.md) | Artifact解析、Relation構築等の共通能力と、Checker固有の判定・結果表現を分ける。 | Covered |
| [ARCH-000002](../../Definitions/ARCH-000002/architecture_definition.md) | Consumer Closureを含む共通Relation能力を、Checker以外の利用側も同じ意味で利用できる境界にする。 | Covered |
| [ARCH-000008](../../Definitions/ARCH-000008/architecture_definition.md) | Reality TraceabilityをChecker Ruleから分離し、実装・試験Symbolの中立な観測能力として公開する。 | Covered |
| [ARCH-000009](../../Definitions/ARCH-000009/architecture_definition.md) | Repository観測とVersion Control Adapterを、Domain意味およびChecker実装から分離する。 | Covered |
| [ARCH-000005](../../Definitions/ARCH-000005/architecture_definition.md) | Project Context、Release、Qualityの構造化投影を提供し、上位の受入判断・実行状態を所有しない。 | Partial |
| [ARCH-000006](../../Definitions/ARCH-000006/architecture_definition.md) | Topic／Meetingの構造化CRUD、Outcome処置、昇格とRelation解決を責務別に提供する。 | Partial |
| [ARCH-000011](../../Definitions/ARCH-000011/architecture_definition.md) | 用途限定Root、設定読取り、保存・排他・短命ファイルの共通部品を提供し、Runtimeごとの終了判断を所有しない。 | Partial |
| [ARCH-000016](../../Definitions/ARCH-000016/architecture_definition.md) | Source改訂版、現在性、履歴と未観測を投影・保存契約で区別する。 | Partial |

本書は、旧CRDD Domain Library、Project Operation、Runtime Dataの実装を`domain-model`へ統合する責務境界を定義する。Topic／Meetingの意味・状態は[活動Context詳細](../project-operation/01_Architecture.md)、保存用途・保持・清掃は[保存配置詳細](../runtime-data/01_Architecture.md)が所有し、Package統合を理由に重複定義しない。現在の移管と検証Gateは[CHG-000082](../../../99_Roadmap/Changes/CHG-000082/change.md)、過去のLibrary分離は[CHG-000076](../../../99_Roadmap/Changes/CHG-000076/change.md)へ戻る。

新配置での接続は未実施である。従来のCoveredは保持する設計断面であり、統合後のSource、全利用側、試験・署名の成立を示さない。

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
- MCP／Workbenchの旧接続を、新配置の接続確認なしに成立済みとして扱うこと
- Git Adapterの意味をDomainへ取り込むこと
- 公開APIから採用、Authority、Releaseまたは外部Effect許可を発行すること
- Source移行の進捗や試験結果をArchitectureの正本にすること

## 2. ComponentとSource配置

```text
40_Develop/
│
├ domain-model/
│  └ src/
│     ├ index.ts                   共通結果だけの軽量公開入口
│     ├ outcome.ts                 Capability横断の中立な処理結果契約
│     ├ artifact/                  Artifact解析・Schema・Relation Graph
│     ├ storage/                   用途限定Store Root、排他・短命保存
│     ├ configuration/             Manifest・設定の検証と読取り
│     ├ project-context/           正本の構造化投影とContext固有候補判断
│     ├ topic/                     Topic状態・CRUD・昇格
│     ├ meeting/                   Meeting記録・Outcome処置・CRUD
│     ├ quality-change-control/    品質・変更の中立な意味判定
│     ├ reality-traceability/      Symbol Manifest・Annotation・Graph
│     └ repository/                検証済みRoot内の安全な観測・Path解決
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
└ schemas/                         配布版が所有する固定Schema
```

物理Directoryは公開／非公開ではなく、Capability、責務または外部境界を表す。`internal/`を非公開性の根拠にせず、Architectureが宣言したRootまたはCapability単位の`index.ts`とexport集合で公開面を制御する。

`src/`直下は責務を表し、その下は最大一階層までとする。`domain/`、`application/`、`internal/`を形式的な中間階層として追加しない。`repository/`は検証済みRootの観測・解決という具体責務であり、全I/Oの雑多な置場にはしない。共通結果契約の実体は`outcome.ts`、軽量なPackage公開面は`src/index.ts`、個別責務の公開面は各直下Directoryの`index.ts`が所有する。

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
| Checker | `domain-model/src/index.ts`、必要な責務の`index.ts`、Version Controlの用途限定公開入口 | 業務CRUD・保存Writerの不要な推移依存、別責務の非公開実装Path、不要なGit Adapterを含むRoot公開入口 |
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
| Package Root `domain-model/src/index.ts` | `DomainStatus`、`DomainIssue`、`DomainOutcome<T>`、`DomainLocation`、`validateDomainOutcome`だけ | なし | namespace経由でCRUD、Filesystem Writer、設定Readerを推移的に読み込むこと |
| Artifact `domain-model/src/artifact/index.ts` | Artifact Model、Schema検証、Relation Graphの公開型と決定論的関数 | なし | Checker Finding、利用者向けmessage |
| Storage `domain-model/src/storage/index.ts` | 検証済みStore Root、Root内Path解決、Kernel排他、exact Lock回復、短命操作の作成・再入場・終了 | 用途限定Root内の保存・回収とKernel Endpoint | 任意絶対PathのAuthority化、個別Domain判断、Filesystem Recordだけによる排他推定 |
| Configuration `domain-model/src/configuration/index.ts` | Manifest／設定Schema検証、Repository別Tool設定読取り | 設定読取りだけ。Root作成と設定の自動書込みなし | Policyの採用、Trust Framework、Credential・Authorityの発行 |
| Project Context `domain-model/src/project-context/index.ts` | Project Context／Release／Qualityの構造化Reader、Source投影、Context固有候補判断 | 本文の解析・意味変換はEffectなし | Roadmap・品質・実行状態の第二正本、一般Task候補の採用 |
| Topic `domain-model/src/topic/index.ts` | Topic解析・状態変換・登録・編集・取得・一覧・昇格・誤登録削除 | 認可済みRepository内の明示CRUDだけ | Meeting本文・CHG本文の複製、Git Commit／Push、別Repositoryの自動選択 |
| Meeting `domain-model/src/meeting/index.ts` | Meeting解析・CRUD・Outcome処置・Close評価 | 認可済みRepository内の明示CRUDだけ | pendingを残すClose、時点記録を現在値で上書き、Topicへの無条件昇格 |
| Quality Change Control `domain-model/src/quality-change-control/index.ts` | 品質・変更状態の中立な判定 | なし | Checker固有Rule、採用・Release Authority |
| Reality Traceability `domain-model/src/reality-traceability/index.ts` | Symbol Manifest、Annotation解釈、Graphの公開型と決定論的な生成・検証関数 | なし。Path APIはRepository相対表記の構文検査だけに用いる | Repository走査、Checker Finding変換、Reality Audit実行、Test合格、実装完成 |
| Repository `domain-model/src/repository/index.ts` | 検証済みRoot内のRepository観測、名前付きPath解決、保存領域の読取り専用観測 | Filesystem読取りだけ | Directory作成、設定自動生成、Git確定・公開、採用判断 |
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

純粋な解析・意味変換は`node:fs`実装へ依存せず、Repositoryの観測結果または呼出し側が取得した内容を受け取る。統合Package内のCRUDと設定読取りは責務別のRepository／保存公開面を利用し、純粋Coreから暗黙に呼び出さない。Checker AdapterがDomainの構造化Issueを`CheckerFinding`へ変換し、RuleとPipelineが最終結果を構成する。

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
| `40_Develop/domain-model` | Artifact、Relation、Reality、共通Outcome、Repository観測、設定・保存部品、Topic／MeetingとContext投影の実装正本。旧三Packageの移管先 |
| `40_Develop/checker` | CheckerのCanonical実装正本、CLI、Profile、Generator、試験およびfixture |
| `40_Develop/version-control` | Version Control Port／AdapterのCanonical実装正本 |
| `40_Develop/<subsystem>/symbol.json` | 現実側Symbolの正方向Relation Owner |
| `07_Quality/Registry` | Canonical成果物から生成または移行する機械投影。Library SourceのOwnerではない |

`template/tools`から`40_Develop`へ実装をコピーしない。起動入口は自身の実PathからCRDD基準版Root候補を一つだけ導出し、そのRootのIdentityを検証してから同じRoot直下の`40_Develop`へ接続する。

| 実行形態 | launcherの位置 | 実装解決先 | 判定 |
|---|---|---|---|
| CRDD標準の開発 | `CRDD Root/template/tools/` | `CRDD Root/40_Develop/` | Repository Manifestで開発Rootを検証する |
| CRDD採用Repositoryの一般Tool | `<Project>/<CRDD基準版Directory>/template/tools/` | 同じ基準版Directoryの`40_Develop/` | 同じCRDD基準版Root、宣言した公開入口と当該Toolが必要とする配布Identityを検証する。Coordinator署名や全Repository Tree検証を一律要求しない |
| Coordinatorの保護実行 | 同じ基準版DirectoryのCoordinator入口 | 検証済みCoordinator実行閉包と固定Native | [CoordinatorのV6署名契約](../coordinator/01_Architecture.md#署名範囲の縮小--v6方式と再編後の閉包)へ接続し、Manifest、選択した実行閉包とNativeのIdentityを検証する |
| launcherだけの単独コピー | Project Root等 | なし | 対象外。代替Pathを推定せずEffect 0で停止する |

Root候補はlauncher実Pathの`template/tools`からexactに2階層上だけを採用する。launcher、候補Root、当該Toolが読むIdentity入力および実装入口はregular file／directoryであり、symbolic link、junctionまたはRoot外解決を含んではならない。Coordinator保護実行の署名Manifestも同じ実体確認へ含めるが、一般Toolへ署名Manifestの存在を一律要求しない。必要なIdentity入力が不存在・不一致・観測不能なら代替Rootや署名免除を推測せず停止する。単独配布Artifactが必要な場合は`40_Develop`の正本からRelease工程で決定論的に生成し、`template/tools`に二つ目の手編集実装を作らない。

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

MCPとWorkbenchの旧公開入口利用は移管対象である。新Packageへの接続、本番Reader／Storeおよび終了後状態の確認前に新構成を完成済みと表示しない。

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
- Version ControlのProcess実行とBundle書込みをDomain Modelへ移さない。Filesystem読取り・CRUD保存は用途別公開面へ隔離し、純粋な意味変換から呼び出さない。
- 読取りAPIとFilesystem Effectを持つAPIを公開面で区別する。
- Domain ResultからAuthority、採用判断、Release判断または外部Effect許可を生成しない。

## 9. 統合後の公開操作と保存Owner

以下は実装を分割する設計契約であり、新APIの実装済み宣言ではない。公開Symbolの移管は元の意味・結果・失敗条件を保持する。Topic／Meetingが共有する内部Repository手順は`storage/`へ集約できるが、相互の公開Barrelを循環importしない。

| 操作／既存Symbol | 新しい公開入口 | 入力と結果 | 主な利用側 | AuthorityとEffect |
|---|---|---|---|---|
| `projectProjectOperationSources`、`applyProjectOperationCandidateDecision` | `project-context/index.ts` | Source状態・改訂版／投影、対象候補と明示判断／次候補状態 | Workbench Server、MCP Server、CROS | 意味変換だけ。対象の採否Authorityを生成せず、一般Patchの採用はOrchestratorへ渡す |
| `parseRepositoryProjectContextMarkdown`、`parseRepositoryReleaseProjectionMarkdown`、`parseRepositoryQualityProjectionMarkdown` | `project-context/index.ts` | 所有正本のMarkdown／固定表の構造化結果 | Workbench Server、MCP Server、CROS | Effectなし。不正表・欠測を推測で補完しない |
| `parseTopicMarkdown`、`applyTopicPromotion` | `topic/index.ts` | Topic本文、昇格先Identity・期待改訂／検証済み次版 | TopicのCRUD操作 | 意味変換だけ。実在する対象・同一Projectと人間判断は保存前に再確認 |
| `parseMeetingMarkdown`、`applyMeetingOutcomeTreatment` | `meeting/index.ts` | Meeting本文、Outcome処置／全表が一致する次版 | MeetingのCRUD操作 | 意味変換だけ。pendingが残るCloseを拒否 |
| `createTopicMeetingRepository`、`createTopicMeetingApplication`のTopic操作 | `topic/index.ts` | 検証済みRoot、操作、対象ID、期待改訂、Relation／CRUD結果・Cursor付き一覧 | Workbench Server、MCP Server。CROSは認可済みBindingを供給 | 対象Repositoryだけに保存。誤登録削除は影響確認と明示承認が必要 |
| 同ApplicationのMeeting操作、`MeetingOutcomeCommandResult` | `meeting/index.ts` | 検証済みRoot、Meeting／Outcome、期待改訂／処置結果 | Workbench Server、MCP Server | 同一Repositoryの原子的次版。別Repository処置はCROSの認可・Routingが成立するまで発行しない |
| `inspectRepositoryManifest`、`inspectCrosTrustPolicy` | `configuration/index.ts` | 明示した宣言／検査結果 | CROS、Checker、各設定利用側 | 宣言の検証のみ。既存Schemaの移管をTrust Policy Framework採用と扱わない |
| `readProjectRuntimeConfig`、`readExecutionIntelligenceConfig` | `configuration/index.ts` | 検証済みRootと当該Tool／検証済み設定Snapshot | Orchestrator、Execution Intelligence | 設定読取り。不存在だけ既定30日、不正・読取り不能は整理を停止 |
| `resolveRepositoryRuntimeDataPaths`、`observeRepositoryRuntimeDataArea` | `repository/index.ts` | 検証済みRoot／用途別Pathと境界観測 | Runtime各Owner、Execution Intelligence、診断 | 読取りだけ。`not_observed`と`blocked`を区別し、Rootを逆算しない |
| `ensureRepositoryRuntimeDataArea`、`createCoordinatorRuntimeDataArea`、`createTemporaryOperation`／`resumeTemporaryOperation`／`settleTemporaryOperation` | `storage/index.ts` | 許可Root、用途、exact Identity／保存Capability・終了／回復結果 | Coordinator、Orchestrator、試験・署名準備 | 宣言用途だけ作成・回収。由来不明・使用中・観測不能ではEffect前停止 |

`createTopicMeetingApplication`の共通実体は一つとし、Topic／Meeting公開面は許可された操作だけを返す。既存型の意味を変えず、全APIの巨大再公開や別実装を作らない。File名・型名の具体化は段階3の公開Symbol全数照合で固定する。

### 9.1. 状態保存と呼出し順

| 順序 | 所有者と処置 | 失敗・取消・中断時 |
|---|---|---|
| 1 | Workbench Server／MCP Serverが操作入力を受付。共有利用ではCROSが対象Binding、Credential、許可範囲を再確認 | 認可不明なら本文・件数・対象存在を開示せず、CRUD Effectを発行しない |
| 2 | Topic／MeetingがIdentity、期待改訂、Relation、状態遷移を評価し、全表が一致する次版を作る | 不正・競合・未処置Outcomeは保存前拒否。通知だけで採用・終了を確定しない |
| 3 | 保存部品が同じRootで排他、短命File生成、保存確定、読戻しを担当 | 最初の失敗と保存・cleanup結果を分け、不明を旧版・次版いずれかの成功へ丸めない |
| 4 | 操作Ownerが次版の保存を確認して公開結果を返し、短命File・Handleを終了する | 応答喪失時の再入場は対象Identityと改訂を再観測。古い入力を盲目的に再適用しない |

Source本文を読むだけの投影は書込み排他・作業Directoryを作らない。OrchestratorのQueue／判断／採用状態、Coordinatorの実行／回復状態は各Ownerの単一`state.json`へ保存し、Domain Modelへ中央の状態正本を新設しない。通常履歴のローテーション、候補の期限処置、署名準備の終了判断も各Ownerが行い、共通保存部品が用途を推測して削除しない。

### 9.2. 移管確認と反証

- 旧三Packageの全公開Symbol、利用側、worker起動URL、固定fixture、Schema・配布閉包を新責務へ対応する。Rootの文字置換だけで接続済みとしない。
- CheckerのArtifact利用からTopic／Meeting Writer、CROS設定、Provider実行が読み込まれないことを依存閉包で確認する。
- Topic編集の期待改訂不一致、Meetingのpending Close、Relation先不存在ではEffect 0を観測する。保存要求だけを次版確定の証明にしない。
- 最初の保存失敗と排他解放失敗を独立に観測し、別Ownerのretryが旧回復義務を無視して書き込めないことを確認する。
- 旧Meaning・QA導出キーは保持する。現在の`crdd-domain-library.*`、`project-operation.*`、`runtime-data.*`はPackage名ではなく既存の設計項目参照であり、改名だけで新IDを発行しない。

公開集合の移管先と既存QA義務は§9.3、全File／Consumerの予定処置は全ファイル対応、設定・配布とFront AI移行は各Ownerへ接続する。OPEN: 新公開面・worker・全Consumerの実装移管と実起動、設定例と配布物の実切替、統合後のSource試験と実境界は段階5〜7で確認する。

### 9.3. 旧公開集合の移管先と検証義務

旧三Packageの公開型は意味を保って各責務の`types.ts`へ移し、その責務の`index.ts`から明示再公開する。型だけのFileを`outcome.ts`と呼ぶ運用は追加しない。共通`outcome.ts`は既存の実行時検証`validateDomainOutcome`も持つため維持し、Package Rootは共通結果の型と検証だけの軽量入口にする。旧Rootの名前空間exportを巨大Barrelとして引き継がず、利用側importを能力別公開入口へ変更する。

| 旧公開集合 | 移管先 | 利用側と確認する既存義務 |
|---|---|---|
| `parseMarkdownArtifact`、`buildArtifactGraph`、`validateArtifactSchema`とArtifact／Schema型 | `artifact/index.ts` | Checker、Semantic Coverage、成果物解析の利用側。`RCM-IT-009/013`で依存方向、`RCM-UT-014`で公開集合、`RCM-IT-003/004`でConsumer閉包を確認する。 |
| `createRealitySymbolGraph`、`validateRealitySymbolManifest`、`discoverRealitySymbols`、`realitySymbolKinds`とSymbol型 | `reality-traceability/index.ts` | Checker、Semantic Coverage、Reality Audit。意味GraphとSymbol Graphを混同せず、旧七導出キーと実観測の不足区分を保持する。 |
| `fixQualityCandidate`、`integrateQualityGate`、`reenterQualityReview`と品質Gate型 | `quality-change-control/index.ts` | 品質・変更の判定利用側。`RCM-IT-011/RCM-UT-016`で共通結果とChecker結果を分離し、品質GateからRelease Authorityを生成しない。 |
| `createFilesystemStoreRoot`、`resolveFilesystemStorePath`、`withFilesystemStoreLock`、`observeFilesystemStoreLockOwnerAbsence`、`recoverFilesystemStoreLock`とRoot／Lock型 | `storage/index.ts` | 各Store Owner。worker起動URLは同じstorage配下の実workerへ接続する。`RDL-IT-001/003/004`でRoot・排他・再入場・回収を、`RCM-IT-003/004`で移管後の利用側を確認する。Lock Fileだけを実排他の証拠にしない。 |
| `createFilesystemRepositoryObservationPort`、`observeRealitySymbolRepository`とRepository観測型 | `repository/index.ts` | Checker、Semantic Coverage、Repository表示。`RFD-IT-012`でRoot外・link・regular file・観測不能とHandle終了を確認する。 |
| Runtime DataのPath解決・観測・ready検査、CWD起点の二resolverと`resolveCrosRuntimeRoots` | `repository/index.ts` | Coordinator、Orchestrator、Execution Intelligence、CROS、試験入口。CWDは対象Rootそのものではなく、Version Control境界で確定する入力として維持する。CROS Rootを単体Repository書込み許可へ拡張しない。`RDL-IT-001/003/004`と`RFD-ST-003`へ対応する。 |
| Runtime Dataの領域作成、temporary operationの作成・再入場・終了、`verifyTemporaryOperationEvidencePromotion`とReceipt／Capability型 | `storage/index.ts` | 署名準備、各Runtimeと試験入口。操作状態・世代・exact参照と正式Evidence昇格確認を保持する。`RDL-IT-001/003/004`で未解決保護と終了後条件を確認する。 |
| Manifest／Trust宣言、Tool設定の型・検査・読取り、用途別の固定Path／Schema定数 | `configuration/index.ts` | CROS、Checker、Tool設定利用側。既存Trust Schemaの検査能力は維持するが独立Trust Frameworkを有効化しない。`RCM-ST-012`で新設定・旧参照・全Consumerを照合する。 |
| Project／Release／Quality投影、候補判断と全対応型 | `project-context/index.ts` | Workbench Server、MCP Server、CROS。`PPR-IT-001/002/PPR-ST-005/PPR-UT-006/PPR-UAT-015`で部分観測、出所、情報境界と表示意味を維持する。 |
| Topic／Meeting Record、状態、昇格、Outcome、Repository／Application、Query／Page／Relation／Resultの全対応型 | `topic/index.ts`、`meeting/index.ts` | Workbench Server、MCP Server。共通保存実体は一つとし、各公開面で操作を限定する。`CPR-ST-005/CPR-IT-006/CPR-UAT-007/CPR-IT-008`で全CRUD・安全な削除・Outcome処置とCloseを維持する。 |

各利用側のFile単位処置は[全ファイル対応](../../../99_Roadmap/Changes/CHG-000082/Evidence/261007_develop-file-inventory.md)に結合する。ここでの公開集合固定は移管方針であり、旧importの不存在、workerの実起動、各公開入口の本番接続と試験成功は段階5〜7で観測する。既存QAの件数・過去Passをこの表の追加で変更しない。

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | Checker固有、CRDD共通Domain、Repository／Version Control基盤を分ける。 | [§2](#2-componentとsource配置) |
| Interface Model | Required | 利用側が実装Fileを直接importしない公開入口を固定する。 | [§3](#3-公開入口と依存方向) |
| Data Flow | Required | Repository入力からDomain、Surface結果、Effect Adapterまでを示す。 | [§4](#4-data-flow) |
| State Model | Required | 統合対象のTopic／Meeting状態、候補判断、保存・排他の状態を意味Ownerごとに維持する。 | [§9](#9-統合後の公開操作と保存owner) |
| Sequence | Required | Domain結果をSurface固有結果へ変換する順序を固定する。 | [§4](#4-data-flow) |
| Failure／Recovery | Required | 観測不能、Domain Issue、Checker Findingおよび実行不能を分ける。 | [§5](#5-結果と失敗の境界) |
| Deployment | Required | `40_Develop`を実装正本、`template/tools`を薄い入口と設定配置に限定する。 | [§6](#6-配布と開発の境界) |
| Observability | Required | 公開APIとConsumer集合のClosure条件を固定する。 | [§7](#7-consumer-closure) |
| Security Boundary | Required | Root検証、link非追従、読取りと書込みEffectの分離を維持する。 | [§8](#8-security境界) |
| Implementation Structure | Required | 設計責務を具象差、選択、状態依存、構成、資源Ownerおよび外部境界へ分解する。 | [§Implementation Structure](#implementation-structure) |

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS | Topic／Meetingの期待改訂と保存排他を維持し、Package統合を共有Writerの新設と扱わない。 | [§9](#9-統合後の公開操作と保存owner) |
| Timing | PASS | 時点付きMeeting、投影現在性、Tool別保持期間を意味Ownerへ接続し、普通の履歴期間で未解決状態を削除しない。 | [§9](#9-統合後の公開操作と保存owner) |
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
| Creation／Selection | Required | Topic／Meeting操作と用途限定保存部品を検証済みRootへ結合する。 | 用途別公開入口と共通内部Repository手順。 | 作成を操作許可や別Repositoryの自動選択と扱わない。 | Root・公開操作の追加は全利用側とEffect前拒否へ波及する。 | `project-operation.context-lifecycle`<br>`runtime-data.repository-local-storage` |
| State-dependent Behavior | Required | Topic／Meetingの状態、期待改訂、保存・回復状態により許可操作が異なる。 | 意味変換と保存確定を分けた状態判定。 | pending Close、競合、観測不能を成功へ畳まない。 | 状態変更は正本表、CRUD、再入場、QAへ波及する。 | `project-operation.context-lifecycle`<br>`runtime-data.repository-local-storage` |
| Composition／Recursion | Required | この観点を成立させる構造と責務が存在するため。 | 複数の局所責務を公開結果へ合成し、部分成立と全体成立を分ける。 | 各局所結果を保持し、必要な全要素が揃うまで上位完成を表示しない。 | 構成要素の追加時は完成条件と全Consumerを再確認する。 | `crdd-domain-library.dependency-direction`<br>`crdd-domain-library.public-surface`<br>`crdd-domain-library.source-layout`<br>`crdd-domain-library.consumer-closure`<br>`crdd-domain-library.result-boundary`<br>`crdd-domain-library.repository-boundary`<br>`crdd-domain-library.distribution-identity` |
| Lifecycle Ownership | Required | この観点を成立させる構造と責務が存在するため。 | Process、Handle、一時物、秘密または公開SnapshotのOwnerと終了条件を固定する。 | 成功・失敗・取消の全経路で資源回収または同一Identityの回復義務を残す。 | Owner変更は取消、Recovery、終了後条件へ波及する。 | `crdd-domain-library.distribution-identity` |
| External Boundary | Required | この観点を成立させる構造と責務が存在するため。 | 外部境界ごとに要求、受理、Effect、結果搬送および終了後状態を分ける。 | 境界の成功を要求発行だけから推定せず、段階に応じた観測を必須にする。 | 境界変更は直接境界からSystem／E2Eまでの検証範囲へ波及する。 | `crdd-domain-library.distribution-identity` |

同じ責務へ二つ目の具象実装を追加する場合は、共通契約へ昇格するかを評価する。昇格しない場合は、同じ責務ではない、または局所分岐の方が単純で影響が小さい理由を記録する。特定のDesign Pattern名は必須にしない。

## 上流UI／SPEC Detailとの関係

| Detail Source | UI／SPEC Definition | この領域が担当するSCR／PRT／Interaction／BHV | Relation状態 | 未解決Gap／戻し先 |
|---|---|---|---|---|
| [UI／SPEC Detail Architecture Traceability](../../08_UI_SPEC_Detail_Traceability.md) | ARCH-000001、ARCH-000002、ARCH-000008、ARCH-000009のSource Definition | 同Traceability表で上記ARCH-IDへ接続された全Detail ID | Covered | Detailの意味変更はUI／SPECへ、配置責務の変更は該当ARCH定義へ戻す |
| [活動Contextの担当Relation](../project-operation/01_Architecture.md#上流uispec-detailとの関係) | ARCH-000005、ARCH-000006、ARCH-000016のSource Definition | Topic／MeetingとProject Contextの既存担当Relationを統合Packageの責務別入口で実現する | Partial | 詳細の意味は活動Contextが所有。新配置の利用側接続は段階5〜7で確認する |
| [保存配置の担当Relation](../runtime-data/01_Architecture.md#上流uispec-detailとの関係) | ARCH-000009、ARCH-000011、ARCH-000013、ARCH-000016のSource Definition | Repository-local／CROSの保存境界に接続された既存担当Relation | Partial | CROSの認可・横断状態はCROSへ、Runtime固有の現在状態は各Ownerへ残す |

担当Interaction Relation: `PRT-000001.spec-000001`、`PRT-000005.spec-000009`、`PRT-000006.spec-000010`、`PRT-000006.spec-000031`、`PRT-000014.spec-000019`、`PRT-000018.spec-000023`

本領域は上記Relationの配置責務を局所所有する。Detailを新しい要求として解釈せず、対応ARCH-IDが所有する配置・境界・状態・観測の制約として実現する。

Checklist評価根拠: §9の公開集合・保存Owner・呼出し順と全ファイル対応により、Component、Interface、Data／StateおよびSequenceを具体化した。実装移管と実起動は未評価である。 §9.3で旧三領域の公開集合を既存Local Itemへ対応し、対象・反証・観測・終了後条件をQualityへ渡した。設計の対応を試験Passと扱っていない。

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
