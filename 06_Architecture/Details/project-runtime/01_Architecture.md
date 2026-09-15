# Project Runtimeアーキテクチャ

成果物種別: Architecture詳細設計
詳細設計領域: project-runtime
状態: Candidate（v0.21.0）

## 基本設計との関係

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000004](../../Definitions/ARCH-000004/architecture_definition.md) | ObjectiveをTaskへ変換し、実行、判断待ち、取消、RecoveryのProject-level lifecycleを所有する。 | Covered |
| [ARCH-000005](../../Definitions/ARCH-000005/architecture_definition.md) | Task、Queue、Decision、Recoveryの現在状態を根拠付きProject Stateへ投影する。 | Partial |
| [ARCH-000007](../../Definitions/ARCH-000007/architecture_definition.md) | Execution IntelligenceのReader Portを呼び、読取り専用の実行事実・評価候補を返す。 | Partial |
| [ARCH-000012](../../Definitions/ARCH-000012/architecture_definition.md) | Transport非依存のPublic Application Contractを所有し、MCP等へ同じ意味を提供する。 | Covered |

Relation状態は、この領域が担当する責務断面に対する状態である。複数領域で同じARCH-IDを実現する場合、各領域の断面を合成して基本設計全体を閉じる。

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | Core、Application、Port、公開契約の依存方向を分ける。 | [§3](#3-内部層) |
| Interface Model | Required | Coordinator、State Store、実行事実SourceをPortで隔離する。 | [§4](#4-port) |
| Data Flow | Required | ObjectiveからTask状態と公開結果までの意味伝播を示す。 | [§7](#7-公開アプリケーション契約) |
| State Model | Required | Task、Decision、Lease、RecoveryとEffect状態を分ける。 | [§6](#6-状態authority資源) |
| Sequence | Required | 要求、状態更新、Execution Port、結果投影の順序を固定する。 | [§7](#7-公開アプリケーション契約) |
| Failure／Recovery | Required | Effect不明、判断待ち、取消競合、回復待ちを保持する。 | [§6](#6-状態authority資源) |
| Deployment | Required | 独立package境界とHostが注入するAdapterを示す。 | [§2](#2-package境界) |
| Observability | Required | 公開入口から状態、理由、Recovery Identityを観測できるようにする。 | [§10](#10-完成境界) |
| Security Boundary | Required | CoreがHost AuthorityやProvider Credentialを生成しない。 | [§6](#6-状態authority資源) |

`N/A`は未検討を意味しない。対象外にできるArchitecture上の理由を記載する。

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS | Project、Queue、Task、DecisionのLock順序とownerGenerationを固定する。 | [正本節](#6-状態authority資源) |
| Timing | PASS | 観測時点、lease期限、取消待機、再接続を分ける。 | [正本節](#6-状態authority資源) |
| Resource Lifecycle | PASS | Task、Attempt、Lease、Queue、Decision、Recovery義務のOwnerを定義する。 | [正本節](#6-状態authority資源) |
| External Boundary | PASS | Execution Port、State Store、実行事実SourceをPort化する。 | [正本節](#4-port) |
| Failure／Recovery | PASS | Effectなし／済み／不明、判断待ち、取消競合、回復待ちを分ける。 | [正本節](#6-状態authority資源) |

`PASS`は詳細設計上の処置が定義済みであることだけを示し、実装済み・試験済みを意味しない。

## Qualityへの引渡し

| 検証単位 | 対象 | 正常条件 | 反証する失敗 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|
| Task lifecycle | ObjectiveとTask identity | 許可された状態遷移 | 競合、親喪失、取消、Effect不明 | state、owner、recovery ID | lease／resource 0または義務 | なし |
| Public Application | 公開DTOとPort | Transport間で同じ意味 | Schemaずれ、内部Path依存 | exact result contract | 内部Effectは所有Portだけ | なし |

## 現行実装との照合

現行Sourceと既存試験は本詳細設計の正式入力ではない。本設計候補を固定した後、成立済み能力を失わないよう`Covered`、`Partial`、`Missing`、`Legacy`または`Implementation Detail`へ分類する。

担当責任者: Qual-Lab
最終更新日: 2026-09-11

Related:
- [Runtime責務分離](../../../99_Roadmap/Changes/CHG-000063/change.md)
- [MCP Transport](../mcp/01_Architecture.md)
- [実行知](../execution-intelligence/01_Architecture.md)
- [Project状態参照とローカルMCP HTTP](../../../99_Roadmap/Changes/CHG-000064/change.md)

## 1. 目的と責務

Project Runtimeは、人間が許可したObjectiveをProject-level execution stateへ変換し、Milestone、Objective、Task、判断、統合、受入およびRecoveryのlifecycleを管理するApplication Coreである。Providerを選び実行するCoordinator、要求を搬送するMCP、OS資源を扱うPlatform Adapter、観測を保存する実行知とは責務を分ける。

Project Runtimeが所有するのは意味と遷移であり、外部能力の実装ではない。必要な実行、永続化、Platform観測、候補統合、判断継続および実行知発行はPortとして要求する。

## 2. Package境界

```text
40_Develop/project-runtime/
├ package.json
├ src/
│  ├ index.ts
│  ├ public-contract/
│  ├ application/
│  ├ core/
│  ├ internal/
│  └ ports/
└ tests/
   ├ unit/
   ├ integration/
   ├ system/
   ├ fixtures/
   └ support/
```

`src/index.ts`を唯一のpackage公開入口とする。利用側は`application`、`core`、`ports`または`public-contract`の内部Pathを直接参照しない。公開入口はProject要求、Project結果、読み取り専用投影、Port型およびApplicationの構成関数だけを必要最小限にexportする。

公開契約はProject Runtimeと同じLifecycleを持つ間は本packageが所有する。Transport、Telemetry、Providerまたは管理用の便利な型を追加しない。複数Runtimeから独立版として利用する必要性が実証された場合だけ、別package化を再評価する。

## 3. 内部層

### 内部ブロック図

矢印は依存・呼出しを示す。Portの実装はpackage外から注入され、CoreがCoordinatorを直接呼ぶ構造ではない。各ブロックの所有範囲は下表と次節のPort定義に従う。

```text
外部利用側
  ↓ 公開入口（index）
公開要求・結果（public-contract）
  ↓
Application
  ├─ Objective受付・実行調停
  ├─ 再計画・人間判断
  └─ 統合・状態参照
       │
       ├→ Core：Project状態・Queue・遷移判定
       │     └→ Internal：入力snapshot・相対Path
       └→ Ports：実行・永続化・判断・回復・観測
                    ↑ 実装を注入
           外部Adapter（Coordinator等）
```

実装上の塊は`src/application/`、`core/`、`public-contract/`、`ports/`、`internal/`に対応する。公開契約からCoreのvalidatorを利用する依存も含め、正確な許可方向は§5に示す。図は処理順序や全importの列挙ではない。

| 層 | 所有するもの | 所有しないもの |
|---|---|---|
| 公開契約 | Objective／Decision要求、Project結果、読み取り専用投影、closed schema | MCP envelope、CLI option、Provider result、OS Path |
| Application | Objective受付、Task Graph、実行順、再計画、判断移送、統合、受入、Recoveryの調停 | Provider選定実装、Process起動、Filesystem書込み |
| Core | 状態機械、不変条件、Identity相関、純粋な選択・遷移・投影 | I/O、時刻取得、乱数取得、外部待機 |
| Internal | 副作用を持たないplain-data snapshotとRepository相対Path正規化 | 公開契約、状態、I/O、Adapter |
| Ports | 必要能力と閉じた結果型 | Adapter実装、fallback、暗黙Authority |

CoreはI/Oを発行しない。ApplicationはPortの閉じた結果だけを解釈し、例外、欠落、時刻超過またはProcess終了から成功を推定しない。

## 4. Port

| Port | 必要能力 | 主な実装所有者 |
|---|---|---|
| Execution Port | narrowed Task Authorityで一つのTask Attemptを実行し、exact Identity付き結果を返す | Coordinator Adapter |
| Execution Authorization Port | 署名済みRuntime packageを一回起動する不透明Capabilityの発行と未使用時の失効を要求する。Task Authorityとは区別する | Coordinator Adapter |
| State Port | expected generation付きProject State／Queueの読取り・更新 | Repository-local Persistence Adapter |
| Lease Port | Project Operation、State、Adoptionの取得・settlementを観測する | Platform／Persistence Adapter |
| Candidate Port | Task候補の読取り、統合候補の構成、明示採用とrollback | Coordinator Candidate Adapter |
| Decision Port | 一回限りCapabilityの発行、prepare、finalize、失効およびRecovery | Platform Decision Adapter |
| Platform Observation Port | Repository Root、principal、owner、Process、cleanup、Recoveryの必要観測 | Platform Adapter |
| Execution Intelligence Query Port | 許可された実行記録を読取り、observed／not_observed／unknown、時間的出所、事実と非Authority評価候補を分けて返す | 実行知Reader Adapter |
| Clock／Identity Port | 契約が必要とする現在時刻、決定論的IDおよび内容Hashを返す。言語Runtimeの時刻・暗号実装をApplicationへ露出しない | Host Adapter |
| Process Safety Port | 現在のProcess世代、cleanup不明時のProcess再利用禁止、exact Recovery Identityの生成および検証を要求する | Host Adapter |
| Task Recovery Port | Owner lossとの相関解決、Task回復、Docker回復受領、検証資源の最終化および非Authority診断を、Repository実装情報を含まないexact Identityで要求する | Coordinator Recovery Adapter |

Portは任意関数の集合ではなく、要求、受理、Effect、完了、観測および耐久的確定を区別した結果を返す。未知fieldまたは不明状態を成功・不存在・空集合へ畳まない。

## 5. 許可する依存

```text
external consumer → index
                     ├→ public-contract → core validator
                     ├→ application → core / public-contract / ports / internal
                     ├→ core → internal
                     └→ ports → core
```

- `core`はNode標準I/O、Coordinator、MCP、Provider、Platformまたは実行知へ依存しない。
- `internal`は純粋なsnapshot／Path utilityに限定し、`core`、`public-contract`および`application`からだけ利用する。
- `application`は`core`、`public-contract`、`ports`および`internal`だけへ依存する。
- `public-contract`は検証に必要な`core`の意味型／validatorと`internal`だけ、`ports`は`core`の意味型だけを参照し、いずれもAdapter型を参照しない。
- package公開入口は内部層を構成して公開するが、外部Adapterをimportしない。
- Coordinator、MCPおよび各Adapterは公開入口へ依存できる。逆方向は禁止する。

この規則は直接importだけでなく推移的依存へ適用する。静的検査はpackage dependency graphを入口から走査し、filenameの文字列一致だけで判定しない。

<a id="detailed-design-contract"></a>

## 6. 状態、Authority、資源

Task、Objective、Milestone、QueueおよびDecisionの状態と遷移は本書が上位の意味を、[詳細設計](02_Detailed_Design.md)がexactなID、不変条件、Lock、Authority、Effectおよび失敗注入点を所有する。[機械可読な設計対応](../../../07_Quality/06_Project_Runtime_Design_Traceability.json)は設計正本ではなく、設計とCoordinator実装・試験の対応切れを検出する検証用投影である。物理配置の変更を理由に状態名、成功条件、IdentityまたはRecovery義務を簡略化しない。Project Stateを所有するProcess世代はCoreが乱数や時刻から生成せず、Hostが有効な`ownerGeneration`として明示入力する。Coreは欠落または不正な世代を状態生成前に拒否する。

Project RuntimeはAuthorityを生成しない。人間または上位Runtimeから受け取ったProject／Milestone AuthorityをTask単位へ縮小し、Task要求と`authorityBindingId`へ結合してExecution Portへ渡す。Runtime packageの実行許可CapabilityはExecution Authorization Portから外部Effect直前に取得し、Task Authority、Task内容または許可Pathの根拠として扱わない。Transport metadata、Provider出力、Project State、実行知EventまたはAdapterの存在からAuthorityを導出しない。

統合結果の基本形は従来のcleanupと手動回復の相関を維持する。外部境界のEffect情報を持つ拡張形では、Effect不明とcleanup未確認を別軸で扱う。Effect不明なら手動回復を必要とし再試行を許可せず、Recovery参照はEffect不明またはcleanup未確認のときだけ許可する。Transportはこの相関を再定義せず、基本形または拡張形をCanonical Inspectorで検査してそのまま搬送する。

Applicationは長時間待機中に短時間Lockを保持しない。Port呼出し前後でProject generation、Task／attempt／Operation、Authority、取消、RecoveryおよびLeaseを再照合する。PortのcleanupまたはEffectが不明な場合は、同じProcess・Queue・Taskを再利用せずexact Recovery義務を保持する。

### ブロック状態遷移

詳細な個別状態名と遷移IDは、[詳細設計](02_Detailed_Design.md)から解決する。次表はPackageをまたぐ結合ブロックのLifecycleを示し、個別状態の第二正本にはしない。

| ブロック状態 | 契機／事前条件 | Portとの結合 | 次状態 | 終了後条件 |
|---|---|---|---|---|
| Objective受付 | Project／Milestone Authorityと現行世代 | State／Clock／Identity | Task準備／判断待ち／拒否 | 不正入力ではTask Effect 0 |
| Task準備 | dependencyと縮小Authority成立 | Execution Authorization／Execution | 実行中／停止 | 外部Effect直前に世代・取消を再確認 |
| 実行中 | Attempt結果または取消 | Candidate／Observation／Process Safety | 統合準備／Recovery | cleanup不明を通常失敗へ畳まない |
| 判断待ち | 一回限り判断要求 | Decision／Lease | 再計画／取消／Recovery | 待機中に短時間Lockを保持しない |
| 統合準備 | 必要Task結果と候補が相関 | Candidate／State | Accepted Result／停止 | 個別Task成功を統合受入へしない |
| Recovery | exact義務とfresh owner観測 | Task Recovery／Platform Observation | 再入場／手動処置 | Identityを置換せず、旧世代を再利用しない |
| 状態投影 | 読取り専用要求 | read-only State | observed／absent／unknown | Effect 0、unknownをabsentへ畳まない |

<a id="platform-boundary"></a>

### Platform境界

Project Runtime CoreはOS固有のPath、principal、Filesystem保護、Lock、Process、Console、ContainerまたはRecovery機構を所有せず、Portとして必要な保証を要求する。Platform AdapterはAuthorityを生成せず、Coreが与えた閉じた要求だけを観測または限定操作へ変換する。

| 境界 | Coreが要求する保証 | Adapterの責務 |
|---|---|---|
| Principal／Provider Home | 選択ユーザー、固定Home Identity、所有・書込み主体、non-link | 対象OSのidentityと保護を実観測する |
| Filesystem／Repository | Root、Revision、Path、Identity、原子的更新、隔離 | 境界付きPath解決とreadbackを行う |
| Lock／Lease | OS排他、owner generation、生存観測 | 時刻やfile存在だけで奪取しない |
| Process／取消 | argv、環境、Process tree、終了、owner loss | 要求発行と終了観測を区別する |
| Container Host | 固定image、Network、mount、Process、cleanup | Host接続と終了後不存在を観測する |
| Runtime Root／Recovery | OS管理Root、権限、資源Identity、回復後不存在 | exact Recovery Identityの再入場とsettle後を保証する |

対応Platformが必要保証を満たさない場合、別OSのAdapterへfallbackせずEffect 0で停止する。OSのAPI名や実装方式は共通化せず、必要保証と失敗時の意味だけを共通契約にする。

## 7. 公開アプリケーション契約

公開契約はTransportに依存しない次の意味操作を持つ。

- Objectiveを受け付ける。
- 現在の判断要求へ人間の判断を提出する。
- 同じrequest identityの現在結果を再取得する。
- v0.20の別変更で採用した場合に限り、Project Stateを読み取り専用で投影する。

Project State参照は`requestId`、`projectId`および`repositoryRevision`だけを受け取る。Applicationへ渡すState Portは`readState`だけへ縮小し、書込み、Queue更新、Lease、Task実行または判断Capabilityを構成できない。結果は次を区別する。

```text
observed  現行改訂版へ結合したcanonical投影を取得
absent    対象Projectの状態が存在しないことを観測
unknown   Store、Identityまたは改訂版を現在値として確認不能
```

`absent`から未開始、完了または成功を推定しない。`unknown`を`absent`、空配列またはfalseへ畳まず、既存のRecovery要否と状態参照自身がEffect 0であることを別fieldで返す。公開投影はMilestone、Objective、Taskの集約状態、判断待ち、Recovery要求、品質状態および次の実行上の処置に限定し、進捗率、予定、RiskまたはProject Management判断を追加しない。

各操作は認証済み主体、Project／Repository Binding、request identity、Authority参照および取消を明示入力として受ける。MCP session、CLI process、HTTP connectionまたはWindows user tokenを公開契約自身のAuthorityにしない。

## 8. 構成Root

v0.20では`template/tools/crdd-coordinator.ts`と`template/tools/crdd-mcp.ts`を、利用目的ごとの構成Rootとする。前者はCLI、後者はMCP stdio／HTTPを所有し、どちらも公開indexだけを使ってProject Runtime ApplicationへCoordinator、Persistence、Platform、Candidate、Decisionおよび実行知Adapterを注入する。Coordinator CLIはMCP Transportを所有せず、MCP packageはCoordinator内部moduleへ依存しない。

```text
Coordinator CLI composition root
  ├ Project Runtime application
  ├ Coordinator execution adapter
  ├ Repository persistence adapter
  ├ Windows platform / decision adapter
  ├ Candidate integration adapter
  └ Execution Intelligence adapter
```

構成RootをProject Runtime内部へ置かない。MCP公開LauncherはCoordinatorの公開Adapterから同じApplicationを受け取り、内部Pathを組み立てない。Project Runtimeを単独Processとして利用する要件はないため、見かけ上のLauncherを追加しない。

## 9. 移行と検証

移行はCore／公開契約、Port、Adapter、MCPの順に依存を反転させる。各単位で旧Pathを残さず全利用側を切り替える。移行途中のpackageは完成済みと表示しない。

単体試験は状態とApplication判断、結合試験は各Portと実Adapter、総合試験はCLI／MCP stdioの公開入口を確認する。正常だけでなく、判断待ち、再計画、取消、Port拒否、Identity不一致、cleanup不明、Recovery再入場およびStore障害を含める。試験カタログはProject Runtime変更からCoordinator、MCP、Platform、実行知、traceabilityおよびRuntime実行Identityの利用側を逆向きに選択する。

## 10. 完成境界

Project Runtimeのpackage作成、Core試験合格または安全な拒否だけでは分離完了としない。全Portの実装接続、公開入口、利用側閉包、CLI／MCP stdio回帰、状態・Authority・Recoveryの意味保持、内部Path参照0および独立レビューが揃った場合だけ完成とする。
