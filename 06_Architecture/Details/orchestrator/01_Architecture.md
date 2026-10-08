# Orchestratorの詳細アーキテクチャ

成果物種別: Architecture詳細設計
詳細設計領域: orchestrator
状態: Candidate

本候補はOrchestratorの意味・公開操作をOrchestratorへ移す詳細設計である。物理的な詳細設計領域は`orchestrator`へ統一する。既存Semantic Keyと通信契約のIdentityは、物理配置とは分けて保持する。旧版のCoveredや保存切替の検証結果を、新配置の実装接続・実境界の成立証明には用いない。

段階5Cでは上位Attemptの記録変換を本領域の`src/task/execution-intelligence-adapter.ts`へ移し、公開入口から利用する。認証済みPrincipalと受入判断の一致検査も`src/decision/acceptance-authority-adapter.ts`で所有し、本領域の本番組立ては同じ公開入口を利用する。物理親Directoryは`40_Develop/orchestrator`、Package名は`@qual-lab/crdd-orchestrator`へ切替済みである。共通実行・通知と全利用側の接続確認は未完了である。下位Coordinatorの共通Operation記録と上位Attempt記録を重複発行しない責務は維持する。

旧State／Queue／Leaseの移行入力Readerは本番Sourceへ残さない。旧形式の抽出・移行はフロントAIの手順が所有する。現行Snapshot Readerは真正不存在と観測不能を区別し、読取り途中のRepository内領域置換では停止する。未解決Leaseの保存結合は新版Portが取得した意図・証拠を単一状態内で保持し、旧形式からの抽出値を正常状態の根拠にしない。未使用の試行部分形式codecと旧個別Writerは撤去済みで、保存基盤の物理移管は済んでおり、保存Root参照と設定名はOrchestratorへ切替済みで、旧実Runtime Rootの処置と残る実行接続は継続中である。Queueの許可遷移は現行保存でも同じ定義を使い、保存方式変更だけで進行・判断・終了条件を変更しない。

本番の上位組立ては`src/operation-composition.ts`、公開業務操作は`src/index.ts`、受付と現在保存の接続は`src/objective/intake-dependencies.ts`が所有する。Principal観測は`src/identity/observe-principal.ts`、候補統合は`src/candidate/integration-adapter.ts`、保護された判断世代の保存は`src/storage/protected-decision.ts`へ接続する。Coordinatorには同じ業務Sourceを残さず、個別実行・保護Root・候補保存等の下位能力を呼ぶ。Coordinator Rootによる上位操作の再公開は撤去済みで、MCP配布入口・Workbench状態観測を本領域へ直接接続した。CLI内部の上位呼出しは撤去済みで、全公開利用側と旧実Runtime Rootの処置は後続確認の対象であり、File移管だけを依存方向の最終完成としない。

## 基本設計との関係

業務操作の公開面はPackage Rootの`src/index.ts`へ統一する。Objective受付、判断、受入判断、状態照会の六操作は`src/operation-composition.ts`から、既存のPrincipal観測は`src/identity/observe-principal.ts`から明示的に公開する。純再exportの業務中継Fileと`./application` subpathは廃止し、MCP配布入口・WorkbenchはRootへ直接接続する。これはSource公開Pathの互換性変更であり、操作名、通信契約、保存形式、Authorityを変更しない。具象組立てはRootを逆参照せず、必要な実体へ依存する。開発用構築関数や診断内部関数を追加公開しない。Coordinator Rootは上位業務操作を再公開しない。CLIと親Directory・保存Root参照は切替済みだが、旧実Runtime Rootの処置と残る実行接続は未完了のため、公開面の接続だけを全移管完成とは扱わない。

現在状態・Queue・Leaseは`src/storage/current-state-store.ts`、終了要約と保持処置は`src/storage/history-store.ts`が所有する。本番利用側は`src/storage/index.ts`から現在の保存操作だけを呼ぶ。OSの実効排他はCoordinatorの`src/host-runtime/index.ts`を利用し、業務保存を下位へ再exportしない。上位Taskの回復終了確定は`src/task/docker-recovery-settlement.ts`が所有し、exact保存世代・Task・Attempt・Operation・回復義務と耐久応答を照合して既存のCoordinator内部資源処置へ委譲する。安定Symbol IDと既存QAへのRelationは配置変更だけで改名しない。物理移管と、Repositoryの保存Root・設定名の切替は区別し、後者の未完了を前者の成立から推定しない。

上位のProject／Task／Attempt／Revision相関は`src/task/execution-authorization-adapter.ts`が所有する。実行Capabilityの発行と未使用失効はCoordinatorの既存操作へ委譲し、上位Adapterに下位Authorityの生成・保存を移さない。固定Source閉包は新Ownerでの相関検査と不透明Capability搬送を引き続き検査する。上位本番組立ては本領域へ移管済みである。共通実行・通知の最終接続は未完了である。

人間判断の一回利用秘密値と照合Hashは`src/decision/decision-capability-adapter.ts`が生成する。上位判断の発行・置換・失効契約が利用し、Provider認証やCoordinatorの実行Capabilityへ転用しない。秘密値の保存・公開範囲は既存判断契約を維持する。

受入判断のRecord・Envelopeと世代相関は`src/decision/acceptance-decision-record.ts`、人間判断の未解決回復Intentは`src/decision/decision-recovery-record.ts`が検査する。これらは純粋な値検査であり、保存先やFilesystem処置を所有しない。現行の単一状態保存はOrchestrator公開入口からこの検査を利用する。旧個別保存Writer二件は試験利用側を現行Snapshotへ切り替えた後に撤去した。新配置へ旧Directory保存を再導入しない。再読取り、重複拒否、比較交換と受入判断の前世代Hash照合は現行保存が所有し、未知欄または連鎖不整合を含むSnapshotは内容Hashだけが一致しても拒否してbytesを保全する。保存基盤自体はOrchestratorへ移管済みであり、保存Root参照と設定名は切替済みである。旧実Runtime Rootの処置と共通実行・通知の最終接続は未完了である。

上位Attempt・判断権限・Revisionと単一Taskの対応付けは`src/task/single-task-adapter.ts`が所有する。CoordinatorのTask専用公開入口を呼び、開始時の上位相関を完了待機中に置き換えない。Task開始・取消・完了形状と下位回復参照の検証はCoordinatorが所有する。Coordinator Rootの上位再exportは撤去済みで、共通Task公開面を推移的に読み込む。CLI配送と保存Root参照は切替済みで、全本番利用側と旧実Runtime Rootの処置は継続中であり、この接続だけを全体完成としない。

候補公開・採用結果の保存値は`src/storage/types.ts`が定義し、`src/storage/result-record.ts`が固定欄、結果Identity、Repository／Project／Milestone／Queue結合と内容Hashを検査する。型契約と実行検査を分け、値検査にFilesystem処置、保存成功・受領・実適用の判断を追加しない。現行の単一状態保存は本領域の公開入口から利用する。旧結果Writer／Readerは撤去済みで、同一再送・完全な候補Identity・異内容衝突・不正結合の試験を現行Snapshot保存へ接続した。旧形式移行Readerは本番に残さずフロントAIが移行を扱う。保存基盤はOrchestratorへ移管済みであり、保存Root参照と設定名は切替済みである。旧実Runtime Rootの処置と共通実行・通知の最終接続は未完了である。

上位実行の時刻・安定識別子の生成とProcess安全操作への接続は`src/task/execution-host-adapter.ts`が所有する。Process世代、終了不明時の実行停止状態とその解除条件はCoordinatorの既存Host操作を使用し、Orchestrator側に複製しない。`src/task/task-recovery-adapter.ts`はRepository結合情報を既存回復操作へ渡し、上位の回復遷移を観測する。Docker処置・ack・finalizeそのものはCoordinatorに保持し、診断観測の失敗を回復結果へ混ぜない。新しい回復機構は追加しない。

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000004](../../Definitions/ARCH-000004/architecture_definition.md) | ObjectiveをTaskへ変換し、実行、判断待ち、取消、RecoveryのProject-level lifecycleを所有する。 | Covered |
| [ARCH-000005](../../Definitions/ARCH-000005/architecture_definition.md) | Task、Queue、Decision、Recoveryの現在状態を根拠付きProject Stateへ投影し、Objective／Milestone Acceptance Decision Port／Recordで明示された受入・差戻し・判断待ちだけを記録する。 | Covered |
| [ARCH-000007](../../Definitions/ARCH-000007/architecture_definition.md) | Execution IntelligenceのReader Portを呼び、読取り専用の実行事実・評価候補を返す。 | Partial |
| [ARCH-000012](../../Definitions/ARCH-000012/architecture_definition.md) | Transport非依存のPublic Application Contractを所有し、MCP等へ同じ意味を提供する。 | Covered |

Relation状態は、この領域が担当する責務断面に対する状態である。複数領域で同じARCH-IDを実現する場合、各領域の断面を合成して基本設計全体を閉じる。

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | 純粋な遷移判定と、下位公開APIを呼ぶ業務操作の依存方向を分ける。 | [§3](#3-内部層) |
| Interface Model | Required | Coordinator、保存、実行知、人間判断の担当と閉じた操作結果を固定する。 | [§4](#4-port) |
| Data Flow | Required | ObjectiveからTask状態と公開結果までの意味伝播を示す。 | [§7](#7-公開アプリケーション契約) |
| State Model | Required | Task、Decision、Lease、RecoveryとEffect状態を分ける。 | [§6](#6-状態authority資源) |
| Sequence | Required | 要求、状態更新、Execution Port、結果投影の順序を固定する。 | [§7](#7-公開アプリケーション契約) |
| Failure／Recovery | Required | Effect不明、判断待ち、取消競合、回復待ちを保持する。 | [§6](#6-状態authority資源) |
| Deployment | Required | 独立packageと公開入口、既存CLIからの配送先を示す。 | [§2](#2-package境界) |
| Observability | Required | 公開入口から状態、理由、Recovery Identityを観測できるようにする。 | [§10](#10-完成境界) |
| Security Boundary | Required | CoreがHost AuthorityやProvider Credentialを生成しない。 | [§6](#6-状態authority資源) |
| Implementation Structure | Required | Port具象、状態依存、Task構成、資源Ownerおよび外部実行境界を固定する。 | [§11](#11-implementation-structure) |

`N/A`は未検討を意味しない。対象外にできるArchitecture上の理由を記載する。

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS | Project、Queue、Task、DecisionのLock順序とownerGenerationを固定する。 | [正本節](#6-状態authority資源) |
| Timing | PASS | 観測時点、lease期限、取消待機、再接続を分ける。 | [正本節](#6-状態authority資源) |
| Resource Lifecycle | PASS | Task、Attempt、Lease、Queue、Decision、Recovery義務のOwnerを定義する。 | [正本節](#6-状態authority資源) |
| External Boundary | PASS | 実行、保存、実行知を各担当の公開APIから利用し、結果と観測不能を区別する。 | [正本節](#4-port) |
| Failure／Recovery | PASS | Effectなし／済み／不明、判断待ち、取消競合、回復待ちを分ける。 | [正本節](#6-状態authority資源) |
| State／Consistency | PASS | Task、Decision、Lease、Recovery、Objective／Milestone Acceptance DecisionとEffect状態を分ける。 | [§6](#6-状態authority資源) |
| Observability | PASS | 公開入口から状態、理由、Recovery Identityを観測できるようにする。 | [§10](#10-完成境界) |
| Security／Trust | PASS | CoreがHost AuthorityやProvider Credentialを生成しない。 | [§6](#6-状態authority資源) |

結果語彙は次の意味に限定する。

- `PASS`: 詳細設計上の処置と根拠節が揃った状態。実装済み・試験済みを意味しない。
- `N/A`: Architecture上、そのConcern自体が存在しない状態。未検討や後工程送りを意味しない。
- `OPEN`: 未解決の設計事項が残る状態。
- `FAIL`: 必須設計と矛盾する、または必要な設計が未充足の状態。

## Qualityへの引渡し

| 導出キー | 設計項目種別 | 対象 | 正常条件 | 反証する失敗 | 主な試験段階 | 外部境界の段階 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|---|---|---|
| `orchestrator.task-lifecycle` | State Transition／Failure-Recovery | ObjectiveとTask identity | 許可された状態遷移 | 競合、親喪失、取消、Effect不明 | UT／IT | UT: Direct Boundary<br>IT: Adjacent 1 Block | state、owner、recovery ID | lease／resource 0または義務 | なし |
| `orchestrator.candidate-adoption` | Interface／State Transition／Failure-Recovery | 公開済み候補のIdentity、Repository Revision、許可Pathおよび明示採用Authority | Candidate Storeから同じ候補を再読取りし、正規Candidate IdentityをIntegration Recordまで欠落・短縮せず保持する。Adoption Lease取得後に現在Revision、dirty PathおよびScopeを再観測して、一致する内容だけを正本へ一度反映する。採用Receiptを耐久記録へ保存し、Leaseを解放する | 表示時Metadataの流用、別候補へのすり替え、Consumer独自の長さ制限による正規Identity拒否、確認なし採用、Revision競合、dirty Scope競合、許可外Path、部分反映、Lease残存、採用に伴うCommit／Push | UT／IT | UT: Direct Boundary<br>IT: Related 2 Blocks | Candidate ID、Integration Record ID、Authority、Lease、Revision、dirty Path、Scope、Receipt、反映結果 | 成功時は完全なCandidate Identityを持つIntegration Record一件・Receipt一件・Lease 0・Commit 0・Push 0。拒否時は正本Effect 0。settlement不明時は同じRecovery義務を保持 | 実Provider E2Eで生成した候補からの採用はPhase 5で確認する |
| `orchestrator.acceptance-decision` | Interface／State Transition | 対象Identity、根拠Revision、Project運営者の明示判断 | 受入・差戻し・判断待ちを別状態で一度記録し、Objective受入済みだけがMilestone判断へ進む | ProjectionからのAuthority生成、SPEC-000006／000007からの到達、Task作成、Provider Effect、下位完了からの上位受入推定、Objective差戻し／判断待ちからのMilestone判断開始 | UT／IT | Direct Boundary | decision type、owner、source revision、effect count | 対象Decision Record一件またはEffect 0。Objective差戻し／判断待ちではMilestone判断Effect 0 | 物理StoreはDevelopmentで選択 |
| `orchestrator.public-application` | Interface／Data Flow | 公開DTOとPort | Transport間で同じ意味 | Schemaずれ、内部Path依存 | UT／IT | Adjacent 1 Block | exact result contract | 内部Effectは所有Portだけ | なし |

## 現行実装との照合

現行Sourceと既存試験は本詳細設計の正式入力ではない。本設計候補を固定した後、成立済み能力を失わないよう`Covered`、`Partial`、`Missing`、`Legacy`または`Implementation Detail`へ分類する。

担当責任者: Qual-Lab
最終更新日: 2026-10-07

Related:
- [責務再編の計画](../../../99_Roadmap/Changes/CHG-000082/Evidence/261007_develop-responsibility-mapping.md)
- [Runtime責務分離](../../../99_Roadmap/Changes/CHG-000063/change.md)
- [MCP Transport](../mcp-server/01_Architecture.md)
- [実行知](../execution-intelligence/01_Architecture.md)
- [Project状態参照とローカルMCP HTTP](../../../99_Roadmap/Changes/CHG-000064/change.md)

## 1. 目的と責務

Orchestratorは、人間が許可したObjectiveをProject-level execution stateへ変換し、Milestone、Objective、Task、判断、統合、受入およびRecoveryのlifecycleを管理する。Coordinatorの公開APIで個別Taskを実行し、MCP ServerやWorkbench ServerへTransport非依存の業務操作を提供する。Provider差はAI Adapter、実行資源はCoordinator、OS原語はPlatform Access、共通実行記録はExecution Intelligenceが担当する。

純粋な状態・遷移判定はI/Oから独立させる。業務操作はCoordinator等の公開APIを直接呼び、Orchestratorが望む通知をCoordinator定義のハンドラーへ登録する。下位が上位型をimportする逆依存、Port注入Framework、汎用Event Busは追加しない。

現在状態、待機中の仕事、採否待ち候補への参照、未確定の結果保存・採用後処理と未解決回復は、一連の仕事のつながりを失わず管理する。新しい受領・既読管理は追加しない。保存の具体契約は[詳細設計の一体保存](02_Detailed_Design.md#compact-runtime-storage)が所有する。保存方式刷新②の成立済み保証を保持して移管し、旧形式の清掃はフロントAIの移行手順で扱う。Runtimeへ恒久的な旧形式Readerを残さない。

Objective／Milestone Acceptance Decision PortはProject運営者の明示判断だけを受け付ける。Project Management Projection、Task完了またはObjective受入から次段階のAuthorityを生成せず、受入判断記録からTask作成やProvider Effectを発行しない。

## 2. Package境界

```text
40_Develop/orchestrator/
├ package.json
├ src/
│  ├ index.ts
│  ├ types.ts
│  ├ objective/
│  ├ task/
│  ├ queue/
│  ├ state/
│  ├ decision/
│  └ candidate/
└ tests/
   ├ unit/
   ├ integration/
   ├ system/
   ├ fixtures/
   └ support/
```

`src/index.ts`は業務操作、要求・結果検査、必要な公開型だけをexportする。内部配置は責務別とし、`src`配下は2階層まで、`internal`、`application`、`core`、`ports`等の汎用置場は作らない。型だけのファイルは`types.ts`とする。利用側は内部Pathを参照しない。単独常駐Serverや不要なLauncherは追加しない。

公開契約はOrchestratorと同じLifecycleを持つ間は本packageが所有する。Transport、Telemetry、Providerまたは管理用の便利な型を追加しない。複数Runtimeから独立版として利用する必要性が実証された場合だけ、別package化を再評価する。

## 3. 内部層

### 内部ブロック図

矢印は依存・呼出しを示す。業務操作は下位の公開APIを直接呼ぶ。状態判定自身はI/Oを呼ばず、下位はOrchestratorへ依存しない。

```text
CLI / MCP Server / Workbench Server
                   ↓ 公開入口
              Orchestrator
              ├─ Objective・Task・Queue
              ├─ State・Decision・Candidate
              ├→ 純粋な遷移・相関判定
              ├→ Coordinator → AI Adapter
              ├→ Domain Model：保存・設定部品
              ├→ Platform Access：OS原語
              ├→ Version Control：Revision・採用
              └→ Execution Intelligence：上位Attempt記録
```

各責務Folder内で純粋な判定とI/Oを発行する操作をファイル単位で分ける。図は処理順序や全importの列挙ではない。全Fileの移管は棚卸し表、正確な許可方向は§5に従う。

| 層 | 所有するもの | 所有しないもの |
|---|---|---|
| 公開契約 | Objective／Decision要求、Project結果、読み取り専用投影、closed schema | MCP envelope、CLI option、Provider result、OS Path |
| 業務操作 | Objective受付、Task Graph、実行順、再計画、判断移送、統合、受入、Recoveryの調停 | Provider差、Docker資源制御、下位の内部実装 |
| 純粋な判定 | 状態機械、不変条件、Identity相関、選択・遷移・投影 | I/O、時刻取得、乱数取得、外部待機 |
| 状態保存 | Project StateのSchema・改訂・Queue・判断・未解決参照、保存確定の順序 | 共通Filesystem原語、Coordinatorの実行状態 |
| 下位公開API | 各Ownerが定める必要能力と閉じた結果型 | Orchestratorへの逆依存、fallback、暗黙Authority |

純粋な判定はI/Oを発行しない。業務操作は下位の閉じた結果だけを解釈し、例外、欠落、時刻超過またはProcess終了から成功を推定しない。

## 4. Port

このアンカーは旧文書の参照解決用に保持する。新設計の実体は次の公開操作境界であり、Port Frameworkの実装を要求しない。旧型名の保持と依存方向の保持は別である。

| Port | 必要能力 | 主な実装所有者 |
|---|---|---|
| Execution Port | narrowed Task Authorityで一つのTask Attemptを実行し、exact Identity付き結果を返す | Coordinator公開実行API |
| Execution Authorization Port | 署名済みRuntime packageを一回起動する不透明Capabilityの発行と未使用時の失効を要求する。Task Authorityとは区別する | Coordinator Adapter |
| State Port | expected generation付きProject State／Queueの読取り・更新 | Orchestrator状態保存、Domain Model共通保存部品 |
| Objective／Milestone Acceptance Decision Port | 対象Identity、根拠Revision、Project運営者の明示Authorityを検証し、受入・差戻し・判断待ちだけを一度記録する。読取りProjection、Task作成およびProvider Effectとは分離する | Orchestrator判断操作・状態保存 |
| Lease Port | Project Operation、State、Adoptionの取得・settlementを観測する | Platform／Persistence Adapter |
| Candidate Port | Task候補の読取り、統合候補の構成、公開済み既存候補のIdentity固定、明示採用とrollback | 本体・Metadata読取りはCoordinator、統合・採用判断・Revision検査はOrchestrator |
| Decision Port | 一回限りCapabilityの発行、prepare、finalize、失効およびRecovery | Orchestrator判断意味、Platform Access保護保存 |
| Platform Observation Port | Repository Root、principal、owner、Process、cleanup、Recoveryの必要観測 | Platform Adapter |
| Execution Intelligence Query Port | 許可された実行記録を読取り、observed／not_observed／unknown、時間的出所、事実と非Authority評価候補を分けて返す | 実行知Reader Adapter |
| Clock／Identity Port | 契約が必要とする現在時刻、決定論的IDおよび内容Hashを業務操作で取得し、純粋な判定へ値として渡す | Orchestratorの既存Node Runtime利用 |
| Process Safety Port | 現在のProcess世代、cleanup不明時のProcess再利用禁止、exact Recovery Identityの生成および検証を要求する | Host Adapter |
| Task Recovery Port | Owner lossとの相関解決、Task回復、Docker回復受領、検証資源の最終化および非Authority診断を、Repository実装情報を含まないexact Identityで要求する | Coordinator Recovery Adapter |

下位APIは要求、受理、Effect、完了、観測および耐久的確定を区別した結果を返す。未知fieldまたは不明状態を成功・不存在・空集合へ畳まない。Clock／Identityは既存Node Runtimeの時刻・暗号関数を必要箇所で使い、純粋な遷移判定へ値を入力する。時刻だけのためのHost抽象Frameworkを追加しない。

Candidate Portが発行した正規Candidate Identityは、Integration Record、公開結果、採用要求およびReceiptの全利用側で同じ値を保持する。利用側Adapterが文字数、prefixまたは局所的な識別子規則を狭めて正規Identityを拒否・短縮・再採番してはならない。

## 5. 許可する依存

```text
利用側 → Orchestrator公開入口 → 責務別業務操作
                                 ├→ 純粋な状態・入力判定
                                 └→ 下位Ownerの公開API
Coordinator → AI Adapter
Coordinator ─×→ Orchestrator
```

- 純粋な状態・要求・結果判定はNode I/O、Coordinator、MCP、Provider、Platformまたは実行知へ依存しない。
- 業務操作はCoordinator、Domain Model、Platform Access、Version Control、Execution Intelligenceの公開APIへ直接依存できる。用途とAuthorityを限定し、他Ownerの内部Pathへ依存しない。
- CoordinatorはOrchestratorをimport、構成、再exportしない。Orchestrator由来の通知を必要とせず、単体利用を維持する。
- MCP Server、Workbench Server、CLI配送はOrchestratorの公開入口を利用し、業務操作を重複実装しない。
- 複数業務操作にまたがる公開型はOrchestratorが所有し、通知ハンドラー型はCoordinatorが所有する。上位型を下位へ移すだけの逆依存解消は行わない。

この規則は直接importだけでなく推移的依存へ適用する。静的検査はpackage dependency graphを入口から走査し、filenameの文字列一致だけで判定しない。

<a id="detailed-design-contract"></a>

## 6. 状態、Authority、資源

Task、Objective、Milestone、QueueおよびDecisionの状態と遷移は本書が上位の意味を、[詳細設計](02_Detailed_Design.md)がexactなID、不変条件、Lock、Authority、Effectおよび失敗注入点を所有する。[機械可読な設計対応](../../../07_Quality/Registry/orchestrator-design-traceability.json)は設計正本ではなく、設計とCoordinator実装・試験の対応切れを検出する検証用投影である。物理配置の変更を理由に状態名、成功条件、IdentityまたはRecovery義務を簡略化しない。Project Stateを所有するProcess世代はCoreが乱数や時刻から生成せず、Hostが有効な`ownerGeneration`として明示入力する。Coreは欠落または不正な世代を状態生成前に拒否する。

OrchestratorはAuthorityを生成しない。人間または上位Runtimeから受け取ったProject／Milestone AuthorityをTask単位へ縮小し、Task要求と`authorityBindingId`へ結合してCoordinatorへ渡す。Runtime packageの実行許可CapabilityはCoordinatorの公開APIから外部Effect直前に取得し、Task Authority、Task内容または許可Pathの根拠として扱わない。Transport metadata、Provider出力、Project State、実行知EventまたはAdapterの存在からAuthorityを導出しない。

統合結果の基本形は従来のcleanupと手動回復の相関を維持する。外部境界のEffect情報を持つ拡張形では、Effect不明とcleanup未確認を別軸で扱う。Effect不明なら手動回復を必要とし再試行を許可せず、Recovery参照はEffect不明またはcleanup未確認のときだけ許可する。Transportはこの相関を再定義せず、基本形または拡張形をCanonical Inspectorで検査してそのまま搬送する。

業務操作は長時間待機中に短時間Lockを保持しない。下位API呼出し前後でProject generation、Task／attempt／Operation、Authority、取消、RecoveryおよびLeaseを再照合する。cleanupまたはEffectが不明な場合は、該当するProcess・Attemptを再利用せずexact Recovery義務を保持する。回復結果の保存と通常実行の受付は別操作であり、回復APIから新しいProvider依頼を発行しない。

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
| Objective受入判断 | Task根拠とProject運営者の明示判断 | Acceptance Decision | Objective受入済み／Objective差戻し／Objective判断待ち | Task完了だけでは記録せずEffect 0。差戻し／判断待ちは同じObjectiveへ戻り、Milestone判断Effect 0。Task作成／Provider Effect 0 |
| Milestone受入判断 | Objective受入記録とProject運営者の明示判断 | Acceptance Decision | Milestone受入済み／Milestone差戻し／Milestone判断待ち | Objective受入記録がない場合はEffect 0。受入・差戻し・判断待ちを別状態で保持。Task作成／Provider Effect 0 |

<a id="platform-boundary"></a>

### Platform境界

Orchestrator CoreはOS固有のPath、principal、Filesystem保護、Lock、Process、Console、ContainerまたはRecovery機構を所有せず、Portとして必要な保証を要求する。Platform AdapterはAuthorityを生成せず、Coreが与えた閉じた要求だけを観測または限定操作へ変換する。純粋な業務契約の検査母集団は`application`、`boundary`、`core`、`ports`、`public-contract`であり、保存・具象Task接続・判断Adapterを持つSubsystem全体と同一視しない。現在のWindows保証選択は`src/task/windows-platform-adapter.ts`が所有し、OS生存観測と子Process環境導出はCoordinatorの`src/host-runtime/windows-platform-observation.ts`へ委譲する。未分類の領域を検査から無言で除外せず、部分保証を全Platform対応へ昇格しない。

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
- 採用済みのProject Stateを読み取り専用で投影する。

Objectiveは任意の`requestedProfileId`でExecutorのProfileを明示選択できる。入力は既存の`PROFILE-`形式を検査して所有Snapshotへ固定し、CLIとMCP stdio／HTTPの同じObjective操作からCoordinator Task、Route Candidate、Selection Grantへ同じIDを搬送する。省略時は既存の自動選択を維持する。形式が正しくても登録、Provider／Role／Tierとの適合性または利用可能性を保証せず、既存Resolverと実行Gateで検証する。Reviewerへ指定を継承せず、入力やMCP metadataからAuthorityを生成しない。

WorkbenchのPromptから変更候補を作る操作は別のSingle Task操作であり、公開Objectiveと同じ操作には統合しない。両操作のProfile搬送はそれぞれ検証し、一方の合格を他方の全経路成立へ流用しない。

Project State参照は`requestId`、`projectId`および`repositoryRevision`だけを受け取る。状態参照の処理は読取りAPIだけを呼び、書込み、Queue更新、Lease、Task実行または判断Capabilityを構成しない。結果は次を区別する。

```text
observed  現行改訂版へ結合したcanonical投影を取得
absent    対象Projectの状態が存在しないことを観測
unknown   Store、Identityまたは改訂版を現在値として確認不能
```

`absent`から未開始、完了または成功を推定しない。`unknown`を`absent`、空配列またはfalseへ畳まず、既存のRecovery要否と状態参照自身がEffect 0であることを別fieldで返す。公開投影はMilestone、Objective、Taskの集約状態、判断待ち、Recovery要求、品質状態および次の実行上の処置に限定し、進捗率、予定、RiskまたはProject Management判断を追加しない。

各操作は認証済み主体、Project／Repository Binding、request identity、Authority参照および取消を明示入力として受ける。MCP session、CLI process、HTTP connectionまたはWindows user tokenを公開契約自身のAuthorityにしない。

### 7.1. 公開操作と現在のSymbolの移管

次のSymbol名は現在の実装に存在する操作の対応であり、Package改名だけを理由に再命名しない。移管後の入口はOrchestratorの公開indexである。Coordinatorからの再exportは撤去する。

| 操作／現在Symbol | 入力と結果 | 主な利用側 | Authority／Effect |
|---|---|---|---|
| `runOrchestratorPublicObjective`／`executeOrchestratorObjective` | 固定Objective、Repository・Revision、縮小Authority、選択Profile、取消 → 相関検査済み結果 | CLI、MCP Server | 許可済み範囲のTaskをCoordinatorへ依頼し、Project Stateを保存する。Task完了から受入を生成しない。 |
| `runOrchestratorOperation` | Queue・Task・Attempt・Operationの結合 → 各Task結果と未解決義務 | Objective操作 | 待機前のIntent保存、待機後の再検査、下位実行だけ。Provider差を実装しない。 |
| `integrateOrchestratorOperation` | 固定Task結果と候補Identity → Integration Record | Objective操作 | 候補本体はCoordinatorから読む。上位統合結果の確定はOrchestratorが所有する。 |
| `inspectOrchestratorExistingCandidate`／`adoptOrchestratorExistingCandidate` | 同じ候補Identity、現在Revision・Scope、明示採用Authority → Receiptまたは拒否／未解決 | Workbench Server、許可済み公開操作 | 再読取り・Lease・競合検査後の限定正本反映。Commit 0、Push 0。 |
| `recordOrchestratorAcceptanceDecision` | 対象Objective／Milestone、根拠Revision、人間判断 → 一回の判断記録 | CLI、MCP Server | 受入・差戻し・判断待ちのみ。Task作成0、Provider Effect 0。 |
| `issueOrchestratorHumanDecision`／`submitOrchestratorHumanDecision` | exact判断要求・許可選択肢・一回Capability → 継続状態と適用結果 | 判断操作 | 保護保存とProject Stateの別境界を再照合し、跨る一括確定を主張しない。 |
| `replaceOrchestratorHumanDecision`／`invalidateOrchestratorHumanDecision`／`recoverOrchestratorHumanDecision` | 現在判断・適用世代・exact回復参照 → 置換／失効／回復結果 | 判断操作 | 旧Capabilityと現在適用を検査する。応答喪失から自動再発行しない。 |
| `queryOrchestratorState`／`runOrchestratorPublicStateQuery` | request・project・Revision → observed／absent／unknown | CLI、MCP Server、Workbench Server | 読取りのみ。不存在を未開始・成功へ読み替えない。 |

公開入口は上位操作と検査関数を公開し、保存部品やOS補助の内部関数全数をexportしない。開発用依存注入・Fixtureはtestsへ閉じ、本番入口に任意Adapterを差し込むAPIを新設しない。

### 7.2. 通知、取消と保存確定

| 境界 | 必要な順序・観測 | 反証と終了条件 |
|---|---|---|
| Task開始 | Intent・Authority結合保存 → Coordinator呼出し → exact開始通知の検査 → 対応Task状態保存 | Handle返却だけではrunningにしない。状態保存失敗は元の失敗として保持し、実資源の取消・回収を別に観測する。 |
| 登録ハンドラー | Coordinator所有の通知型で登録し、Orchestratorが同じOperation・Attemptへ結合する | 下位は上位の状態型を知らない。ハンドラー完了は耐久状態保存の完了を意味しない。 |
| 遅延・重複 | 現在世代・Operation・通知Identityを再検査し、既処置の通知で二重遷移しない | 旧Attemptの通知で新Attemptを更新しない。不正・観測不能は成功化しない。 |
| 取消 | 要求を記録 → Coordinatorへ通知 → 未使用許可失効・Process停止・資源回収を観測 → 上位状態保存 | cancel要求、Promise解決、Transport切断をcancelledの根拠にしない。保存不明とcleanup不明を別軸に残す。 |
| 親Process喪失 | fresh Owner観測とexact未解決参照で再入場する | PIDや経過時間だけでOwnerを奪取しない。旧Attemptを再実行せず、通常受付は回復確定後に別Identityで行う。 |
| 終了 | 下位の終了観測、Primary Failure、cleanup、上位保存結果を別々に確定する | cleanup失敗で最初の失敗を上書きしない。終了通知だけでQueue・Lease・slotを解放しない。 |

Coordinatorは下位の実行事実、Orchestratorは上位Attemptの事実をExecution Intelligenceへ記録する。同じEventを両側で再発行しない。通常結果の保存・実行履歴・正式Evidenceは目的と保持Ownerを分ける。

上位の`running`は、同じAttemptに結合したProvider接続用実行Processの開始を観測し、その事実を耐久保存した状態とする。下位の開始観測の保証範囲は[Coordinator通知契約](../coordinator/01_Architecture.md#coordinator-task-notification)に従い、AI内部の要求受理を主張しない。登録した上位Operationと下位Runtime Operationを混同せず、初回Executor通知だけで状態を保存する。同じ通知の重複で二重遷移せず、別Identity・旧世代・終端後の通知では現在状態を変更しない。Handle返却後の即時受付確認は実開始通知の代替にしない。正常Fixtureも開始通知を明示し、完了結果だけを上位の実開始根拠にしない。実接続と反証試験は未完了である。

## 8. 構成Root

`template/tools/crdd-coordinator.ts`の既存Project操作のコマンドは保持し、薄い配送入口がOrchestratorの公開APIへ振り分ける。個別TaskはCoordinator自身の入口へ送る。配送だけのためにCoordinatorのlibraryへOrchestrator依存を入れない。MCP ServerはOrchestratorの公開APIを直接利用し、Coordinatorから上位Applicationを取得しない。

業務CLIの入力・新品初期化・Objective受付・取消解除と公開結果は`src/cli/project-command.ts`が所有する。配布入口は直接Project操作と`interactive`／`automation`のProject配送を選び、後二者の端末・機械出力条件を既存Launcher判定へ照合してから渡す。単体Coordinatorの`bin/coordinator.ts`と内部CLIはProject操作を実行せず、上位依存を持たない。標準入力の128KiB上限、厳格UTF-8・一意JSON、入力理由と終了コードはCoordinatorの副作用なしでimportできる`cli/request-input.ts`を共用し、業務固有の初期化を下位へ戻さない。新しいOrchestrator用Launcherや常駐Processは追加しない。

```text
配布CLIの薄い配送
  ├ Project操作 → Orchestrator公開API → Coordinator公開API
  └ 単一Task操作 → Coordinator公開API
MCP Server → Orchestrator公開API
Workbench Server → Orchestrator公開API（候補採用・状態参照）
```

Orchestratorが自分の業務操作に必要な下位公開APIを構成する。Transport、外部端末、認可済み利用側の配送は各入口が所有する。Orchestratorを独立常駐Processにする要求はないため、見かけ上のServerやLauncherは追加しない。CLI、MCPの入力・出力と取消契約は移管前後で保持する。

## 9. 移行と検証

移行は下位のDomain Model／AI Adapter／Native公開面、Coordinator公開面、Orchestrator、MCP／Workbench／配布CLI、設定・署名閉包・試験の順に進める。旧Pathを残さず全利用側を切り替え、移行途中のPackageを完成済みと表示しない。フロントAIは旧Runtimeを止め、実資源と未解決参照を確認し、候補・秘密・正式根拠を保全してexact旧形式を清掃する。その後、新形式と新受付世代を初期化・読戻しする。旧キューやOwnerを新世代へ黙って引き継がない。

単体試験は状態とApplication判断、結合試験は各Portと実Adapter、総合試験はCLI／MCP stdioの公開入口を確認する。正常だけでなく、判断待ち、再計画、取消、Port拒否、Identity不一致、cleanup不明、Recovery再入場およびStore障害を含める。試験カタログはOrchestrator変更からCoordinator、MCP、Platform、実行知、traceabilityおよびRuntime実行Identityの利用側を逆向きに選択する。

## 10. 完成境界

Package作成、純粋な判定の試験合格または安全な拒否だけでは再編完了としない。公開APIの実装接続、全利用側、CLI／MCP stdio・HTTP回帰、状態・Authority・Recoveryの意味保持、下位からの逆依存0、内部Path参照0および独立レビューが揃った場合だけ完成とする。詳細設計固定、Source移管、全回帰、署名実境界の通過を別Gateで判定する。

## 11. Implementation Structure

| 観点 | 適用 | 判定理由 | 成立させる構造 | 局所責務・不変条件 | 失敗・変更時の影響 | Qualityへの導出キー |
|---|---|---|---|---|---|---|
| Variation | Required | 公開入口と実行、保存、OS観測の違いが存在する。 | Transport差は各Server、Provider差はAI Adapter、OS差はPlatform Accessへ閉じる。Orchestratorは公開結果を解釈する。 | 純粋な判定は具象Runtime、Transport、OS、保存方式を知らない。 | 個別入口だけがAuthorityや結果意味を変更する。 | `orchestrator.public-application` |
| Common Contract | Required | 複数入口が同じObjective・判断・状態操作を利用する。 | 公開DTOと検査関数、Identity・結果・回復義務を共通化し、同じOrchestrator APIへ配送する。 | 共通契約をPort注入Frameworkの採用理由にしない。 | 新入口だけが異なるAuthority、完了、RetryまたはRecovery意味を持つ。 | `orchestrator.public-application`<br>`orchestrator.task-lifecycle`<br>`orchestrator.acceptance-decision` |
| Creation／Selection | Required | Objective要求ごとのRole・Profile・Authority・現在状態の選択が必要である。 | Orchestratorは固定入力をCoordinatorへ渡し、下位Ownerが自分の選択を実行する。 | 任意Adapterを本番から注入せず、読取り操作から実行能力を構成しない。 | 入口ごとに異なるProfileや権限が選ばれる。 | `orchestrator.public-application` |
| State-dependent Behavior | Required | この観点を成立させる構造と責務が存在するため。 | Task、Decision、Lease、Recovery、Effect状態が許可する遷移をCoreが所有する。 | 下位完了やProjectionから上位Authorityを生成しない。 | 分散した状態分岐が二重実行や受入推定を起こす。 | `orchestrator.task-lifecycle`、`orchestrator.acceptance-decision` |
| Composition／Recursion | Required | この観点を成立させる構造と責務が存在するため。 | Objective、Milestone、Task Graphを明示した親子関係と停止条件で構成する。 | 子の完了を親の受入へ自動昇格せず、循環依存を作らない。 | Graphの部分成立がProject全体の完成へ畳まれる。 | `orchestrator.task-lifecycle`、`orchestrator.acceptance-decision` |
| Lifecycle Ownership | Required | この観点を成立させる構造と責務が存在するため。 | Task、Attempt、Lease、Queue、Decision、Recovery義務をOrchestratorのIdentityへ結ぶ。 | Owner移送、失効またはcleanup確認まで状態を完了にしない。 | LeaseやRecovery義務を失い、同じTaskへ再入場できない。 | `orchestrator.task-lifecycle` |
| External Boundary | Required | 実行、保存、OS、採用の境界が存在する。 | 下位Ownerの公開APIを直接呼び、待機前後で結合・Authority・結果・cleanupを再検査する。 | 下位は上位Authorityを生成せず、通知を上位保存確定へ昇格しない。 | OS／Transport／Provider固有の都合が状態契約を変える。 | `orchestrator.public-application` |

CLIとMCPの具象入口は共通の要求・結果検査と業務操作へ収束させる。ProviderとOSの具象差は各下位Ownerの共通契約で処置し、上位へ重複したAdapter Frameworkを作らない。ObjectiveとMilestoneは異なる階層の受入判断であり、単一の汎用Decision型へ畳まず、共有する不変条件だけを共通契約にする。

## 上流UI／SPEC Detailとの関係

| Detail Source | UI／SPEC Definition | この領域が担当するSCR／PRT／Interaction／BHV | Relation状態 | 未解決Gap／戻し先 |
|---|---|---|---|---|
| [UI／SPEC Detail Architecture Traceability](../../08_UI_SPEC_Detail_Traceability.md) | ARCH-000004、ARCH-000005、ARCH-000007、ARCH-000012のSource Definition | 同Traceability表で上記ARCH-IDへ接続された全Detail ID | Covered | Detailの意味変更はUI／SPECへ、配置責務の変更は該当ARCH定義へ戻す |

担当Interaction Relation: `PRT-000002.spec-000002`、`PRT-000002.spec-000003`、`PRT-000002.spec-000028`、`PRT-000002.spec-000029`、`PRT-000003.spec-000004`、`PRT-000003.spec-000005`、`PRT-000004.spec-000002`、`PRT-000004.spec-000006`、`PRT-000004.spec-000007`、`PRT-000005.spec-000008`、`PRT-000007.spec-000011`、`PRT-000011.spec-000005`、`PRT-000012.spec-000017`

本領域は上記Relationの配置責務を局所所有する。Detailを新しい要求として解釈せず、対応ARCH-IDが所有する配置・境界・状態・観測の制約として実現する。

## 保存方式の切替確認

保存方式刷新②は本番接続・Repository実切替・限定独立レビューを完了した。[変更記録](../../../99_Roadmap/Changes/CHG-000082/Evidence/261005_project-runtime-phase2.md)で追跡する。その結果は既存保存保証の基準として保持するが、今回のOrchestrator移管、全回帰、署名実境界や現版全体の完成を証明しない。

## Checklist

- [x] 関連するARCH-IDと担当する責務断面を明示した
- [x] 10種類の詳細成果物を全数Applicability判定した
- [x] Requiredを実在する節または成果物へ接続した
- [x] N/AにArchitecture上の理由を記録した
- [x] 8種類のEngineering Concernを全数評価した
- [x] PASSを設計済みの意味に限定した
- OPEN: 詳細設計02の保存・状態・全Symbolと通知結果の相関を再編先へ対応する必要がある — Component、Interface、Data／StateおよびSequenceを必要な粒度で具体化した
- [x] Failure／Recovery、ObservabilityおよびSecurity Boundaryを具体化した
- [x] 7種類のImplementation Structure観点を全数Applicability判定した
- [x] 二つ目の具象実装がある責務で、共通契約への昇格または非昇格理由を評価した
- [x] Qualityへ渡す設計項目を局所的な導出キーまたは同等に一意な参照へ接続した
- OPEN: 公開操作・通知・保存・取消の全義務を既存QA項目へ対応する必要がある — Qualityへ対象、正常条件、反証する失敗、観測および終了後条件を渡した
- [x] Human Inputの必要性とOpen／Gapを評価した
- [x] 現行実装との照合をReality Auditとして分離した
- [x] Source構造をCanonical詳細設計へ逆輸入していない
