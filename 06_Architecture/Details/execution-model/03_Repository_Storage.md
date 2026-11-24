# `.crdd` Runtime Dataの目標Architecture

> 2026-11-12の3モデル分離に伴う移管詳細。現在の公開入口、保持設定のInput／再検証scope、Helper局所化、AM Root、各保存Ownerは[実行モデル](01_Architecture.md)・[構成モデル](../configuration-model/01_Architecture.md)を正本とする。以下に残る過去時点のSource接続・公開候補・検証結果はその時点の比較基準であり、新3モデルの実装・回帰成立を示さない。Schema・Path・Lock・CAS・回復相関と既存処理順序は維持する。


共通排他の現在の名前と所在は[Lock設計](../lock/01_Architecture.md#lockの名前と所在)を正本とする。EMの物理排他は`.crdd/lock/execution-model.state.lock`、長期Leaseは同じ共通Directory内の対象別Fileへ接続する。以下に残る旧Kernel・旧配置の説明から現在の排他所在を導出しない。`domain-model/state.lock`は別の保存markerであり、今回の保存簡素化で撤去した。

## Operation Identityと終了保存の現在契約

実行モデルが書き出す現在状態は `crdd-execution-model/state/v9`、保存包絡は `crdd-execution-model/storage-envelope/v2`、履歴行と操作要約はそれぞれ `crdd-execution-model/history-row/v3` と `crdd-execution-model/operation-summary/v7` とする。保存される呼出し元 `coordinator` はCLIの `coordinator_cli`・画面の `workbench` と区別する。Docker環境修復および実行プロセス回復の種別は `docker_repair`・`execution_process`、回復参照の接頭辞は `docker-repair.`・`execution-process.` とする。Docker照合で取得した受領情報の由来は `docker_observation` とする。

旧書式は自動変換せず、新形式の読取り入口では拒否する。既存記録が必要な場合は、停止中に未解決の回復記録と元資源の対応を確認したうえで、別途移行する。旧記録を空の新状態として初期化しない。

実行のOperation Identityは`crdd-coordinator/operation-identity/v6`とし、完全選定・試行番号・Operation／Home相関を保存する。Hostは同じOperation IDの独立記録へ結合し、IdentityへHost Pathを複製しない。旧v5・v4及び`grantRef`を含む旧構造は受理せず、互換Reader・暗黙補完・自動変換を置かない。終了観測の旧`mountLeaseReleased`は受付契約から除き、元の実行Ownerへ照合した資源終端・実Home解放・Recovery確定を、既存Writer・CAS・現在版照合で保存する。Schema更新は過去保持物の移行・削除を実行する許可ではなく、本変更では操作しない。

## 共通状態保存の配置切替 — 2026-10-28

保存本体の読取り・確定、初期化領域の作成、Lease実体の観測では、保存Ownerに結合済みの絶対ディレクトリを使う。ファイル操作ごとにGitを探索せず、Node.jsで起点と固定領域を観測して、観測不能と領域の真正不存在を区別する。保存形式v8では保存識別値を正規ディレクトリの実体から導出し、Gitの管理実体からは導出しない。上位が修復・再起動などで同じ値を必要とする場合も、実行モデルの同じ観測を使う。排他・Ownerの現在性は別の条件として維持し、旧形式を不存在として初期化しない。

明示の初期化・実行Queue受付・Host操作の開始記録で必要なローカルGit除外の登録は、CoordinatorまたはCRDD Serverが担当する。実行モデルは、排他のもとで状態の不存在と初期化候補を確認した場合に限り、利用側が渡した同期の準備処理を呼ぶ。内容認可を伴う入口では既存の認可確認も維持する。準備の失敗や結果不明では新しい状態を作らない。すでに準備済みの環境では処理を渡さなくてよい。これらの入口の既存状態の読取りや更新では準備を呼び直さない。修復の初回保存は既存の別経路のままとする。

サーバーのHTTP／MCP定義操作とCoordinatorの通常のHost開始・終端記録は、利用側が確定した絶対ディレクトリを渡す。実行モデルは文字列の起動位置から保存先を探さず、その絶対ディレクトリの実体だけを確認する。ローカルGit除外、定義の参照元改訂と内容認可は利用側に残す。

Coordinatorの回復入口は、保存対象のGit改訂と実体を上位で捕捉し、実行モデルへは確定ディレクトリと同期の現在性確認だけを渡す。履歴を伴う処置では、同じ対象で捕捉した保持設定も結び付ける。元の確認位置で失効を見つけたら保存や回収に進めず、改訂値を回復の入力や許可として渡さない。

通常保存・回復の読取りと保存は、上位が確定した正規ディレクトリだけを保存先として受理する。旧来のRepository参照は、排他取得や初期化の前に拒否する。実行モデルはVersion Controlの実装・型に依存せず、Git配置や改訂を直接確認しない。Objective初回保存のGit除外はCoordinatorの準備処理だけが扱う。

Docker修復の技術実行から戻った後に、最後の観測と初回の結果を記録するときは、Coordinatorが元の保存先の実体と同じ呼び出しの生存を確認する。この経路ではGit改訂を確認しない。実行モデルは、同じ回復参照・元版、保存先・領域・ファイルの実体、排他、保存候補、読戻しを従来どおり確認する。実体や保存資格が失効したときは、置換前なら正本と発行済みの保留物を維持し、置換後でも保存確認済みとはしない。修復受付、実行途中のチェックポイント、新しい処置、履歴・終了の確定、回復再入場にはこの例外を適用しない。

[Runtime Domain保存契約](05_Runtime_Domain.md#runtime-domain-storage)が、単一Snapshot／CAS、局所定義と管理実行記録の分離、現在認可との結合、五種一回使用Context・初期化・履歴出版の物理順序を所有する。本書は名前付きRoot・配置・保持・清掃を継続して所有し、同じAPIや状態遷移を複製しない。人間承認により共通保存先を`.crdd/execution-model/`へ統一する。製品は新配置だけを読み書きし、実データの移行・切戻しは[フロントAI手順](../../../19_Workflows/01_Coordinator_Runtime.md#runtime-domain-storage-migration)へ分離する。今回のSource切替は実データ移行済みを意味しない。

実行状態は固定の `.crdd/execution-model/` に保存する。全Runtime Path集合・Area enumは公開しない。空初期化では旧 `.crdd/domain-model/` の有無と親の同一性を確認し、旧領域の存在・観測不能・親置換では新規作成を拒否する。現行の作業領域 `.crdd/coordinator/` の有無は初期化判定に使わない。旧状態の読取り、移行・清掃は製品へ追加せず、切替前にフロントAIが処置する。既存の新しい正本の通常読取りは旧領域探索に結び付けない。

旧`domain-model/state.lock`は廃止した。排他配置は共通Lock設計へ従い、pendingの元版と現在値・履歴を照合して再入場する。旧markerの自動清掃や互換読取りはしない。保持設定は上位が構成モデルから取得し、履歴処理のInputと既存再検証へ結合する。通常Queryへ設定要件を広げない。

[Workspace配置契約](../coordinator/05_Workspace.md#4-配置とroot解決)に従い、Repository Identity／Manifestと共通の名前付き領域は本領域、Workspace利用・寿命はOrchestrator、Git Worktreeの物理配置はVersion Controlが所有する。`workspaces`を既存の名前付き領域集合へ含める。上位はVC観測のWorkspace ID・relativePath・登録・実体・HEADを照合し、配置文字列を再定義しない。Tool RuntimeやWorktree内へRuntime正本を重複生成しない。以下の一般候補の配置は維持するが、コード変更候補の独自Bundle Storeは置換対象であり新しい常設Storeを作る指示ではない。旧データ移行・全体実境界の完了は別に判定する。

借用実行Treeの内部Directory保護はCoordinatorの既存実行処理内へ局所化する。検証Root能力とobserve／prepareを受け、ready／absent／blockedだけを返しraw Rootは公開しない。observeは作成0、prepareは真正不存在の場合だけ空Directory一件を作り、既存内容・子領域・状態・Ignore・台帳・Lockを変更しない。link・File・観測不能は停止する。この空Mount先をWorktree内へのRuntime正本保存許可と扱わない。

成果物種別: Architecture詳細設計
詳細設計領域: execution-model（実行保存）
状態: Canonical

### Lock Workerの標準入出力

保存Lock Workerは共有状態による取得・解放ACKだけを応答経路とする。stdout／stderrは親Consoleへ自動pipeせず、生成したOwnerが各streamを消費する。Workerのerror／exitと既存の取得・解放期限は維持する。解放ACKはWorker内のEndpoint close完了であり、親側のexit／stdio終了とは区別する。親Threadの同期Atomics待機でexitを待たず、固定sleep・監視上限増加・新しい管理状態で警告を隠さない。

### 保存ReaderのFile ID表現

`storage/store.ts`の固定File読取りは、WindowsのNode BigInt statが返すinodeのうち`-2^63`以上・`-1`以下だけを、同じ64bit列の符号なし値へ正規化する。読取り前後のPathとdescriptor、およびReaderの結果と生のstatを比較する保存Writerは同じ私有変換を使用し、IDそのものの比較を省略しない。ゼロ、型不正、下限逸脱、POSIXの負値、File型・link・dev・birthtime・途中変更の拒否は維持する。容量引数と固定byte上限は撤去し、旧16MiBを超える正常Stateも同じSchema・CAS・排他で保存・再読取りする。既存の正値と保存済み記録は変更せず、新たな状態・移行Reader・排他を追加しない。

## 基本設計との関係

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000009](../../Definitions/ARCH-000009/architecture_definition.md) | Repository Manifest、Repository IDと検証済みRootに結合するRepository-local data配置を定義する。 | Partial |
| [ARCH-000011](../../Definitions/ARCH-000011/architecture_definition.md) | durable、candidate、temporary、recoveryの配置・保持・清掃・再入場を定義する。 | Covered |
| [ARCH-000013](../../Definitions/ARCH-000013/architecture_definition.md) | CROSのTrust Domain／instance dataをRepository-local `.crdd`から物理分離する。 | Partial |
| [ARCH-000016](../../Definitions/ARCH-000016/architecture_definition.md) | Runtime dataへSource revision、観測時点、保持期限と現在性を残す。 | Partial |

Relation状態は、この領域が担当する責務断面に対する状態である。複数領域で同じARCH-IDを実現する場合、各領域の断面を合成して基本設計全体を閉じる。

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | config、state、execution、recovery、candidate、tmpのOwnerを分ける。 | [§3](#3-各領域の意味) |
| Interface Model | Required | 検証済みRoot Capabilityと全ConsumerのPath利用を固定する。 | [§8](#8-path-capabilityとconsumer-closure) |
| Data Flow | Required | Repository-localとOS管理Rootへの配置を追跡する。 | [§2](#2-repository-local構成と切替境界) |
| State Model | Required | durable、candidate、temporary、参照中、清掃可能を分ける。 | [§4.4](#44-lifecycle) |
| Sequence | Required | 作成時にOwnerと清掃条件を記録し、観測後だけ削除する。 | [§4.4](#44-lifecycle) |
| Failure／Recovery | Required | 観測不能、参照中、由来不明を削除せず回復義務へ結ぶ。 | [§4.5](#45-recoveryの所有) |
| Deployment | Required | Repository-local `.crdd`とOS管理CROS Rootを物理分離する。 | [§6](#6-crosとの物理分離) |
| Observability | Required | Owner、参照、保持期限、清掃結果と終了後不存在を確認する。 | [§9](#9-完成条件) |
| Security Boundary | Required | Repository identity、Secret非格納、Root越境禁止を固定する。 | [§5](#5-configとrepository-identity) |
| Implementation Structure | Required | 設計責務を具象差、選択、状態依存、構成、資源Ownerおよび外部境界へ分解する。 | [§Implementation Structure](#implementation-structure) |

`N/A`は未検討を意味しない。対象外にできるArchitecture上の理由を記載する。

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS | Writer領域とpublish単位を分け、同Path更新は排他またはimmutable publishにする。 | [正本節](#42-operation所有契約) |
| Timing | PASS | 経過時間だけで削除せずOwner、参照、Recovery義務を再確認する。 | [正本節](#44-lifecycle) |
| Resource Lifecycle | PASS | durable、candidate、temporaryを分け、Owner、cleanup条件、再入場Identityを記録する。 | [正本節](#3-各領域の意味) |
| External Boundary | PASS | Repository Root、OS Runtime Root、Version Control Portを境界化する。 | [正本節](#6-crosとの物理分離) |
| Failure／Recovery | PASS | 観測不能または参照中の残存は削除せず義務として保持する。 | [正本節](#45-recoveryの所有) |
| State／Consistency | PASS | durable、candidate、temporary、参照中、清掃可能を分ける。 | [§4.4](#44-lifecycle) |
| Observability | PASS | Owner、参照、保持期限、清掃結果と終了後不存在を確認する。 | [§9](#9-完成条件) |
| Security／Trust | PASS | Repository identity、Secret非格納、Root越境禁止を固定する。 | [§5](#5-configとrepository-identity) |

結果語彙は次の意味に限定する。

- `PASS`: 詳細設計上の処置と根拠節が揃った状態。実装済み・試験済みを意味しない。
- `N/A`: Architecture上、そのConcern自体が存在しない状態。未検討や後工程送りを意味しない。
- `OPEN`: 未解決の設計事項が残る状態。
- `FAIL`: 必須設計と矛盾する、または必要な設計が未充足の状態。

## Qualityへの引渡し

| 導出キー | 設計項目種別 | 対象 | 正常条件 | 反証する失敗 | 主な試験段階 | 外部境界の段階 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|---|---|---|
| `runtime-data.repository-local-storage` | Interface／Lifecycle Ownership | 検証済みRootと用途分類 | 正しい子領域へ保存 | subdirectory `.crdd`、直下乱立 | IT／ST | Direct Boundary | path capabilityとowner | tmp消去または義務 | 現行Path移行はReality Audit |
| `runtime-data.cros-runtime-root` | Deployment／Security Boundary | trust domainとinstance | Repository dataと物理分離 | domain混在、secret混入 | IT／ST | Direct Boundary | binding、owner、retention | 参照閉包後に清掃 | Linux配置はv0.22 |

導出キーは本領域内でQualityが同じ設計項目を反復参照するための局所参照であり、CRDD全体の安定コンテキストIDではない。

## 現行実装との照合

現行Sourceと既存試験は本詳細設計の正式入力ではない。本設計候補を固定した後、成立済み能力を失わないよう`Covered`、`Partial`、`Missing`、`Legacy`または`Implementation Detail`へ分類する。

担当責任者: Qual-Lab
最終更新日: 2026-09-12
Related:
- [旧Path棚卸しの退役案内](../domain-model/04_Storage_Path_Reality_Audit.md)。当時の観測本文はGit履歴から追跡する
- [文書化](../../../03_Documentation.md#repository-local-working-storage)
- [Coding Standards](../../99_Coding_Standards.md)

## 1. 目的と設計判断

`.crdd`は、検証済みRepository Rootに属する非正本の設定、Runtime状態、Evidenceおよび一時物を、用途とLifecycleが分かる形で収容する。Repositoryの正本文書、実装Source、再利用可能なScriptまたは複数Repositoryを束ねるCROS状態は所有しない。

| 判断 | 目標 |
|---|---|
| Repository境界 | 一つの`.crdd`には、そのRepositoryに属する情報だけを置く |
| Project階層 | Repository RootがProjectの物理境界であるため、同じ`project-id`でもう一段掘らない |
| 親子関係 | 子が親なしでは解釈できずLifecycleも継承する場合はDirectory階層で表す |
| 横断関係 | 複数領域を結ぶ関係だけを安定IDで参照し、関係台帳を無条件に増やさない |
| Git | 非秘密のRepository設定だけを`config/`の明示allowlistで追跡する |
| Runtime Data | 状態、Evidence、候補、一時物はGit管理しない |
| 直下 | `.crdd`直下にfileを置かない。新しい用途は所有とLifecycleを決めてから追加する |

## 2. Repository-local構成と切替境界

以下は保存統合Bの配置契約である。Task進行と技術実行はCoordinatorの一つの現在状態・履歴へ保存し、旧Orchestrator領域を並行した正本として運用しない。実装・検証の現在地と旧記録の移行は変更計画で追跡する。

凡例:

- `[G]`: 非秘密でGit管理できるRepository設定
- `[D]`: 終了後も意味を持つ耐久状態またはEvidence
- `[W]`: 処理途中の作業領域
- `[T]`: 再生成可能で短期保持する一時領域

```text
<Repository Root>/
└─ .crdd/
   │
   ├─ config/                              [G] Repository固有の宣言とPolicy
   │  ├─ repository-manifest.json             Project Identity、役割、Capability宣言
   │  └─ external-send-policy.json            外部送信の情報分類、送信先、条件
   │
   ├─ execution-model/                        [D/W] 共通定義・Task進行・技術実行の現在状態
   │  ├─ state.json                           単一改訂の現在状態
   │  ├─ state.pending.json                   保存中の候補
   │  ├─ history.jsonl                        種別を持つ終了要約
   │  ├─ history.pending.jsonl                履歴保存中の候補
   │  └─ recovery/host-terminal/               同じ非Authority参照と完全intentの再入場情報
   │
   ├─ coordinator/                        [W] Coordinatorが所有する実行ごとの作業資源
   │  └─ <operation-id>/                     対象の操作記録に結び付く作業領域
   │
   ├─ execution-intelligence/              [D] Execution Intelligence
   │  ├─ history.jsonl                       不変Eventを1行ずつ保持する履歴
   │  ├─ history.lock                        単一履歴全体の排他
   │  └─ history.pending.jsonl                保存確定中だけ存在する短命な完成Snapshot
   │
   ├─ candidates/                          [D/W] 未採用の成果物
   │  └─ <candidate-id>/
   │     ├─ metadata.json                     出所、対象、状態、関連Operation
   │     ├─ artifacts/                        候補差分と生成物
   │     └─ recovery/                         Candidate処理固有の回復義務
   │
   ├─ release/                             [D/W] Release候補と準備処理
   │  └─ <candidate-id>/
   │     └─ <distribution tree>                固定Commitから展開した配布Root。署名Manifestも配布内の正規位置に置く
   │
   ├─ communication/                       [D/W] Repository内Communication
   │  └─ <context-id>/
   │     ├─ state.json                        Meeting・Topic等の現在状態
   │     └─ candidates/                       昇格前のDecision・記事等の候補
   │
   ├─ tests/                               [T] 試験の一時生成物。必要な場合だけrun内に実行単位の子階層を設ける
   │  └─ <run-id>/
   │     ├─ started.json                      結果保存を行う試験の対象改訂版と開始時点
   │     ├─ result.json                       判定、確認・未確認範囲
   │     ├─ complete.json                     flush/read-backを含む保存完了記録
   │     ├─ input/                           必要な試験入力
   │     ├─ output/                          必要な試験出力・中間署名
   │     └─ diagnostics/                     必要な診断情報
   │
   └─ tmp/                                 [T] Operation所有の短期一時物
      └─ <operation-id>/                       操作が所有する一時作業領域
         └─ work/                             再生成可能な中間file
```

<a id="compact-owner-layout"></a>

### Coordinatorへの単一保存統合

以下の旧Orchestrator配置は移行前の基準を示す。保存統合Bの物理OwnerはCoordinatorとし、Task・Queue・Workspaceと技術実行を同じ現在状態・履歴へ接続する。下表は目標と移行担当の契約であり、B全体の回帰・独立レビュー完了を表示するものではない。

| 基準配置 | 再編後の固定配置 | 移行担当と保持する意味 |
|---|---|---|
| `.crdd/orchestrator/` | `.crdd/coordinator/` | フロントAIが旧受付・資源・未解決参照を確認し、新受付世代で初期化する。Runtimeへ旧Path探索を残さず、現在状態・要約履歴・短命保存物の再入場保証を維持する。 |
| `.crdd/config/orchestrator.json` | `.crdd/config/coordinator.json` | フロントAIが保持日数を照合して引き継ぐ。両設定の値が異なる場合は人間判断へ戻し、Runtimeによる旧設定探索は行わない。 |
| orchestrator設定例・Schema | coordinator設定例・Schema | Taskと技術履歴の同一Owner化へ追従し、旧Reader・配布例・Schemaを撤去する。Execution Intelligenceとは統合しない。 |
| 旧 `.crdd/coordinator/` の実行状態・`.crdd/domain-model/` | `.crdd/execution-model/` | フロントAIが実行状態を移す。現行の作業領域の `.crdd/coordinator/` と混同せず、旧状態を空初期化又は自動変換しない。 |
| 旧 `.crdd/operations/<operation-id>/` | `.crdd/coordinator/<operation-id>/` | フロントAIが未解決の記録と資源の処置を確認する。製品は旧パスを参照しない。 |
| `.crdd/execution-intelligence/` | 同名を維持 | 非Authorityの分析履歴Ownerとし、共通の現在状態を複製しない。 |

共通保存の配置・公開契約は[Runtime Domain](05_Runtime_Domain.md)、Task側の論理Lifecycleは[詳細設計](../coordinator/04_Task_Detailed_Design.md#unified-storage-lifecycle)が所有する。移行前の基準ツリーと旧設定名を新構成の配置指示として使用しない。旧設定Reader・配布例・Schemaは撤去し、実設定は値の一致を確認してCoordinator設定へ一本化する。未解決の旧実行記録は設定整理に巻き込まない。

以前のOrchestrator保存への切替結果は[歴史記録](../../../99_Roadmap/Changes/CHG-000082/Evidence/261005_project-runtime-phase2.md#29-repositoryの実切替結果)として維持し、保存統合Bの検証根拠へ流用しない。Bでは旧形式のRuntime変換を行わず、フロントAIが対象と未解決参照を確認して移行する。②の保持物は別判断まで移行・清掃の対象にしない。

```text
.crdd/
├ execution-model/
│  ├ state.json
│  ├ state.pending.json
│  ├ history.jsonl
│  └ history.pending.jsonl
├ candidates/<candidate-id>/  候補本体と由来
└ tmp/<operation-id>/work/    再生成可能な一時作業
```

`state.pending.json`は保存更新中だけ必要な短命ファイル、`tmp/.../work/`は再生成できる作業中間物であり、用途と再入場の責任を混同しない。一時物のために共通の状態保存領域を作らない。

状態のSchema・物理保存は[Runtime Domain](05_Runtime_Domain.md)、Taskの進行・履歴条件は[Coordinator詳細設計](../coordinator/04_Task_Detailed_Design.md#compact-runtime-storage)および[Coordinator縮小設計](../coordinator/01_Architecture.md#現在状態と履歴を分ける縮小設計)が所有する。判断は承認済みの統合方針に従い、非秘密の要求・回答・適用事実をRepository-local Stateへ保存する。秘密・署名鍵・Provider Homeを同じJSONへ統合する許可ではない。既存のRepository外Candidate Storeも、Identity・保護・全利用側の移行確認前に移動・回収しない。

## 3. 各領域の意味

| 領域 | 所有する情報 | 主な終了条件 |
|---|---|---|
| `config/` | Commit固定する非秘密のRepository宣言とPolicy | Repository設定の変更・削除がGitで確定する |
| `execution-model/` | Task・Queue・Workspace、技術Operation、未解決義務、未受領結果、判断・統合の参照と終了要約 | 実行モデルが物理保存を所有し、[単一保存Lifecycle](../coordinator/04_Task_Detailed_Design.md#unified-storage-lifecycle)に従い、実終端・受領・履歴の確認後に現在項目を除く。通常Recoveryは[対象相関と排他](../coordinator/01_Architecture.md#通常回復の対象相関と排他)を維持し、元の参照が不明なHost残存を推測回収しない |
| `coordinator/` | Coordinatorが所有する実行ごとの作業資源 | [対象相関と排他](../coordinator/01_Architecture.md#通常回復の対象相関と排他)に従い、元の操作と資源の終端を確認して回収する。未確認の回収義務は実行モデルの記録に残す |
| `execution-intelligence/` | 実行履歴、測定値、相関可能な診断情報 | 保持期間と未解決参照を確認して清掃できる。旧`execution/`の移行はフロントAIが行い、Runtime互換Readerを残さない |
| `candidates/` | 未採用成果物、由来、現在の処置、Candidate固有Recovery | 採用、破棄または期限切れ処置とRecoveryが確定する |
| `release/` | Release候補、Manifest、Gate Evidence、staging、Release固有Recovery | Promotion、破棄またはRecoveryが完了する |
| `communication/` | Repository内のCommunication状態と昇格候補 | Promotion、終了または保持方針が確定する |
| `tests/` | 特定試験Runの入力、中間署名、段階結果、出力、診断 | 結果確認後、必要根拠をCHG／Releaseの正式Evidenceへ記録し、参照・非使用・回復義務を確認して清掃する |
| `tmp/` | Operation中だけ必要な再生成可能な中間物 | Operationの全終端経路で削除し、不存在を確認する |

### 3.1. 保存量を増やし続けないための終了契約

保存領域を追加・変更する際は、用途、保持責任者、利用側、終了条件、清掃契機と保持上限を評価する。保持条件の未設定を、無期限・無制限保持の許可として扱わない。既存のComponentが終了・受理・回復を所有し、保持のためだけに新しい共通DBや常設Serviceを作らない。

| 情報の種類 | 終了・保持の評価 |
|---|---|
| 現在状態 | 現在値を更新し、終了・受理済み項目を除く。再入場に必要な世代を除き、Snapshotを永久累積しない。 |
| 通常の診断 | File容量、世代数、総容量を有限にする。制御状態・未受理結果を循環ログへ混入させない。 |
| 一時作業と試験中間物 | 正常・失敗・取消の終端で回収する。中断残存は既存のOwnerとexact参照による次回再入場へ接続する。 |
| 検証根拠 | 改訂版・結果・Hash・未確認範囲を必要な品質／CHG成果物へ昇格する。参照終了後の物理回収は保持責任者が判断する。 |
| CandidateとRelease入力 | 採用・破棄、利用側の受理、置換・比較参照終了を清掃契機にする。未受理・参照中の入力を容量都合で削除しない。 |

上限値と上限到達時の処置は各Ownerの設計・設定で具体化する。未解決義務、未受理結果、所有不明、観測不能または参照中の必要根拠を、経過時間や件数だけで削除しない。上限内へ収められない場合は、不要な新規生成を止め、必要な対象・容量・保持条件を再評価する。

既存の固定Pathに依存する入力集合は、利用側を移行するまで保全できるが、対象、責任者、再評価契機と移行先を明示した有限の例外とする。同じ場所へ新しいScriptや診断を追加する許可ではない。終了記録の自動期限削除が未実装・未承認である領域は、明示清掃の契約を維持する。

### 3.1.1. 試験結果の受理と清掃

`verification/`を新しい保存領域として作成・解決しない。旧領域の実行場所とHashは歴史的根拠として保持し、固定利用側や唯一の必要根拠が残る対象は、処置を確認するまで元位置で保全する。旧領域を新形式の互換ReaderやAliasとして残さない。

フロントAIは次の順で処置する。Runtimeによる結果保存の完了は、正式根拠への昇格や清掃の完了を意味しない。

| 順序 | 必須の確認・処置 |
|---|---|
| 1 | 同じrunの結果、対象版、開始・終了記録とHashを確認する。未完了や不一致は未確認として残す。 |
| 2 | 判断に必要な意味と再現情報を対象CHG／Releaseの`Evidence/`へ記録する。原Artifactのbytes自体が根拠なら、そのArtifactも保持する。不要なら理由を確定する。 |
| 3 | 旧入力・結果への参照終了、使用中Processの不存在と回復義務を確認する。未知・観測不能を非使用へ丸めない。 |
| 4 | 許可Root内のexactな一時物を清掃し、終了後の不存在を確認する。 |
| 5 | 中断残存は次回作業開始時に再評価する。未受理結果を年齢だけで消さない。 |

結果保存Recorderは既存のUUID分離、開始・結果・完了の相関、flush／read-back、32KiBのFile上限と256件の全entry受付上限を維持する。上限到達時は新規保存を停止し、フロントAIが上記手順で処置する。保管用の新しいDB、自動年齢GCまたは常設清掃Serviceは作らない。

### 3.2. Candidateの有限保持

承認済み方針は、作成から7日を既定期限とし、次回起動または候補操作で期限切れを処置することである。常設清掃Serviceは追加しない。採用時は反映・結果・回復・参照の確定後、不採用時は拒否の確定後に本体を回収する。保留する場合は明示した有限期限へ延長し、無期限保留にしない。

処理中、採用／rollback中、回復中、参照中の候補は保護する。Identity、時計、非使用または参照終了を確認できなければ削除せず、同じOwnerで再入場する。部分削除の再入場と終了後不存在を確認し、名前・経過時間だけで由来不明物を消さない。Release入力、Evidence、認証情報、未受領結果にはこの7日規則を適用しない。

OPEN: 自動処置、保持延長の上限、保護参照の全利用側照合と物理Store移行は未実装・未確定。方針の採用を有効化済みと表示しない。

## 4. `tmp/`の限定用途

`tmp/`は未分類物の退避先ではない。内容を失っても正本、結果、Authority、再開可能性または説明責任を失わず、同じ入力から再生成できるOperation内中間物だけを置く。

### 4.1. 配置判定

| 対象 | `tmp/` | 正しい配置 |
|---|---|---|
| 一回のOperationだけで使う生成ScriptまたはLauncher | 条件付きで可 | `tmp/<operation-id>/work/`。実行後に削除する |
| 繰り返し使用するScript | 不可 | `40_Develop`の実装または`19_Workflows`が参照する正式入口 |
| 再開時に必要なScript、引数、Identity | 不可 | 回復を所有するComponent配下の`recovery/`へ構造化して置く。秘密値は保存しない |
| 一時変換、展開、比較、組立て途中のfile | 可 | 所有Operationの`work/` |
| 正式な検証結果または監査根拠 | 不可 | 対象CHG／Releaseの`Evidence/`。試験中の一時結果は`tests/<run-id>/` |
| 診断log | 条件付きで可 | 非試験の一時診断なら`tmp/`、試験診断なら`tests/<run-id>/`、実行横断の観測なら`execution-intelligence/`。正式な根拠は対象CHG／Releaseの`Evidence/`へ接続する |
| Coordinator固有署名用の一時配置 | 不可（専用方式退役） | 新規作成しない。旧`tmp/signature/`はフロントAIが参照・非使用・所有実体・必要な成果物を確認して清掃し、Runtimeの互換Readerへ戻さない |
| 昇格済み署名Manifest、正式なRelease判断・根拠 | 不可 | Manifestは配布先の正規位置、判断と必要な根拠は対象Release／CHGの正本へ置く。短期作業領域を履歴書庫として保持しない |
| Provider出力または未採用Candidate | 不可 | `candidates/`。外部送信Policyと保持条件に従う |
| Cache | 不可 | `tmp/`をCacheとして流用しない。必要性を確認して別契約を設計する |
| 作業メモ | 不可 | 正本へ意味変換するか、追跡不要なら会話・Task内で閉じる |
| 所有者や用途を説明できないfile | 不可 | Effect前に停止し、推測で配置しない |

### 4.2. Operation所有契約

`tmp/<operation-id>/`を作る処理は、作成前に次を確定する。作業領域の識別子は作成前に確定する。再入場が必要な処理では、作業領域の探索に頼らず、回復を担当するコンポーネントが元の処理を特定できるようにする。

| 必須情報 | 意味 |
|---|---|
| `operation-id` | 他の実行と衝突しない所有Identity |
| Owner | 作成、利用、清掃を担当するComponentまたはProcess |
| Purpose | 中間物が必要な処理と再生成元 |
| Allowed content | 作成できるfile種別と最大範囲 |
| Evidence promotion | 正式な根拠が必要な場合だけ、指定した保存先で実物と対象処理の対応を確認する。一時的な複製や呼出し側の自己申告だけでは削除を許可しない |
| Terminal paths | 正常、失敗、取消、Timeout、親Process喪失 |
| Promotion | 残す必要が生じた情報の正式な移動先 |
| Cleanup trigger | 各終端経路と次回の安全な再入場 |
| Completion evidence | 削除要求ではなく、対象不存在の観測 |

既存の作業領域と衝突した場合は、所有権を推定せず変更・削除しない。

### 4.3. 旧制御領域の扱い

旧 `tmp/.operations/` は[一時操作機能の退役](../../../99_Roadmap/Changes/CHG-000082/change.md#未接続temporary-operationの退役--2026-11-12)により現行の配置に含めない。製品はその領域を作成・読取りせず、自動回復や自動清掃もしない。現行の `.crdd/coordinator/` はCoordinatorが実行単位の作業資源を置く別の領域であり、旧制御領域の移行先ではない。

### 4.4. Lifecycle

用途と所有者を確定して、一時領域には再生成できる中間物だけを置く。終了時には正式な保存が必要な根拠を先に正本へ移し、対象の所有・参照終了を確認してから一時物を削除し、不存在を確認する。

中断や清掃失敗で残った物は、成功や清掃済みとして扱わない。処理の再入場に必要な記録は回復を担当するコンポーネントに残し、不明な残存物を名前や経過時間だけで削除しない。

### 4.5. Recoveryの所有

Recovery記録は、状態遷移、再入場および解消を所有するComponentの配下へ置く。同じRecovery義務をRepository直下の汎用`recovery/`とComponent配下へ複製しない。

| Recovery対象 | 保存先 |
|---|---|
| Queue、Decision、Integration、Project State | `execution-model/state.json`内の既存の未解決区画・参照。専用Directoryを追加しない |
| Candidate適用・rollback | `candidates/<candidate-id>/recovery/` |
| Release staging、署名、Promotion | `release/<candidate-id>/recovery/` |
| Docker、子Process、Host Resource | 対象を所有するPlatform／Runtimeの保護領域 |
| 複数RepositoryをまたぐCROS Operation | CROS Trust Domainの`recovery/` |

全Recoveryの一覧は保存場所を中央へ複製せず、各Ownerの共通Recovery Queryから読み取り専用Projectionとして構成する。Recovery IDからOwnerと保存先を決定論的に解決し、Filesystem全体の推測探索を行わない。

## 5. `config/`とRepository Identity

`repository-manifest.json`と`external-send-policy.json`は、どちらもRepositoryに結合する非秘密設定であるため`config/`へ置く。両者の責務は統合しない。

| 設定 | 所有するもの | 所有しないもの |
|---|---|---|
| `repository-manifest.json` | 安定したProject ID、Project IDと異なるRepository ID、表示名、Repositoryの役割、提供Capability、Context Surface、Policy参照 | Secret、絶対Path、現在状態、実行Authority |
| `external-send-policy.json` | 許可対象Provider、情報分類、目的、Session境界、候補保持条件 | Project Identity、Capability実装、送信実行の個別Authority |

実効的な許可はManifestの宣言だけでは成立しない。

Manifest v2では`projectId`と`repositoryId`を必須とし、同じ値を拒否する。`projectId`は複数Repositoryを束ねるLogical Projectを、`repositoryId`は一つのRepositoryを識別する。`repositoryRole`はAuthorityや固定Role階層ではなく、そのRepositoryがProject Contextを投影する責任範囲を表す安定した宣言であり、Project固有の値を許容する。v1にはRepository IDがないためv2として扱わず、利用側は値を推測して補完しない。

ManifestはRepository Identityの正本であり、非秘密の共有設定としてGit管理する。Repositoryルートの`PROJECT_CONTEXT.md`は`projectId`、`repositoryId`および`repositoryRole`を表示用に投影し、Manifestと異なるIdentityを所有しない。Consumerは両者の不一致を一方の値で暗黙補完せず、現在投影の競合として拒否する。

次のTrust Policyを含む式は旧CROS配置案の比較説明であり、今回撤去する未接続の`CrosTrustPolicy`型・検査が製品で強制されていたことを示さない。現在の認証・認可は[AMの正本](../access-management/01_Architecture.md)が所有し、Manifestの宣言だけで実行許可が成立しない条件は維持する。式の各項を現行実装済みの独立した検査APIと読み替えない。

```text
Repository Manifestの宣言
  ∩ CROS／配置先のTrust Policy
  ∩ Actor Authorization
  ∩ Operation Authority
  = 実行可能な範囲
```

## 6. CROSとの物理分離

本節のTrust Policy付き配置図は旧CROSの比較配置を保持したものであり、現行のTrust設定File・Schema・保存・強制処理の存在を示さない。今回の構成モデル整理は未接続の宣言検査を撤去するだけで、既存AMの認証・認可、Host Root所在、CredentialやLockの保証を変更しない。CROS全体の設計再編や新たなTrust機構の採用は本変更の範囲外である。

複数Repositoryを束ねるCROS状態は、MCPを起動したRepositoryの`.crdd`へ保存しない。CRDDの子Directoryにもせず、配布主体とApplicationを識別できるOS管理の専用Runtime Rootを使用する。OS間で同じ論理Pathを識別できるよう、WindowsとLinuxのDirectory名はともにASCII小文字`kebab-case`へ統一する。

```text
Windows
%LOCALAPPDATA%\qual-lab\cros\<trust-domain-id>\
├─ config/                 Trust PolicyとProject登録
├─ repository-bindings/    Projectと検証済みRepository Rootの結合
├─ sessions/               複数Repositoryを扱う実行Session
├─ projections/            各Repositoryから取得した読取り投影
├─ recovery/               CROS横断Operationの回復義務
└─ tmp/                    CROS Operation所有の一時物

Linux configuration
${XDG_CONFIG_HOME:-$HOME/.config}/qual-lab/cros/<trust-domain-id>/

Linux durable state
${XDG_STATE_HOME:-$HOME/.local/state}/qual-lab/cros/<trust-domain-id>/

Linux temporary runtime
${XDG_RUNTIME_DIR}/qual-lab/cros/<trust-domain-id>/
```

| Root候補 | 判断 |
|---|---|
| `%LOCALAPPDATA%\qual-lab\cros\` | Qual-Lab公式配布のWindows既定。Linuxと同じDirectory名を使用し、PublisherとApplicationを識別する |
| `%LOCALAPPDATA%\cros\` | 短いが、別Publisherの同名Applicationと衝突し得るため公式既定にはしない |
| `%LOCALAPPDATA%\crdd\cros\` | CROSをCRDD配下の機能に見せ、責務分離と一致しないため使用しない |
| `%USERPROFILE%\.cros\`または`%USERPROFILE%\.crdd\` | OS標準のApplication Data領域を使えず、Repository-local `.crdd`とも混同しやすいため使用しない |

`qual-lab`はCRDD Contract上の固定名ではなく、公式配布物の既定Publisher namespaceである。Forkまたは組織内配布では、配布主体が所有する衝突しない小文字`kebab-case`のApplication Rootへ差し替えられる。Rootの値をSource各所へ埋め込まず、Platform AdapterがPublisher Identity、Application IdentityおよびOS標準Rootから解決する。

| Identity | 意味 |
|---|---|
| Project ID | Repositoryが表す論理Projectの安定Identity |
| Repository Binding ID | 特定のclone、worktree、検証済みRootとの実行時結合 |
| Trust Domain ID | 信頼するPublisher、Repository、接続主体、Credential参照および許可上限を共有する安定した境界 |
| Operation ID | 一回の実行、判断または検証単位 |

Directory探索だけでProjectを登録せず、Repository Manifest、検証済みRootおよびCROS側Bindingを一致させる。

同じTrust Domain内の複数Repository、MCP接続および並行実行はSession IDとOperation IDで分離する。信頼するPublisher、Credentialまたは組織境界が異なる対象は別の`<trust-domain-id>/`へ分離し、v0.22では一つのCROS Processを一つのTrust Domainへだけ接続する。Process起動ごとのランダムなInstance Directoryは作らない。

`trust-domains/`の中間Directoryは設けない。CROS Root直下の各DirectoryをTrust Domainとし、全Trust Domainで共有するRuntime状態、Repository Binding、CredentialまたはRecoveryを作らない。将来、複数Domainの入口だけを束ねるBrokerが必要になった場合は、CROS Rootへ共有領域を足さず、Authorityを持たない別Applicationの`qual-lab/cros-broker/`として設計する。

## 7. 現行配置からの移行境界

| 現行 | 目標 | 切替条件 |
|---|---|---|
| `.crdd/external-send-policy.json` | `.crdd/config/external-send-policy.json` | Loader、署名、Checker、ひな型、`.gitignore`、試験を同じ変更で切り替える |
| `.crdd`直下の生成Script・log・JSON | 所有領域または`tmp/<operation-id>/` | Reader、Recovery参照、Evidence昇格先を確認する |
| `test-tmp`、`test-fixtures`、`native-fixture` | `tests/<run-id>/`。実行単位別の分離が必要な場合だけ`tests/<run-id>/<execution-unit>/` | 全Producerとcleanupを移行し、旧Path利用を機械検出する。保全中の固定入力は今回移動しない |
| `release-staging`、`release-e2e`等 | `release/`、`tests/`、対象CHG／Releaseの`Evidence/` | Candidate、正式根拠、一時展開を分類する |
| `orchestrator/adoption`内の混在 | `results/`と`work/` | 耐久結果とTransactionのIdentity・Lifecycleを分離する |

旧Pathの互換書込みは残さない。切替前に全Producer、Consumer、派生物、RecoveryおよびRelease経路を閉じ、旧Path利用をCheckerまたは契約試験で拒否する。

## 8. Path CapabilityとConsumer Closure

Repository-local Pathは、検証済みRepository Root Capabilityから共通Resolverが返した名前付きPathをCanonical値として使用する。Consumerは`.crdd`、Top-level領域またはCanonical Pathを再構成・再解釈しない。名前付きPathへ`dirname`等を適用してRuntime Data Rootを逆算し、変数やHelper経由で未登録領域を作ることも同じ迂回として拒否する。

| 入口 | 利用範囲 | 制約 |
|---|---|---|
| 公開Resolver | 通常のRuntime Data Consumer | 検証済みRoot Capabilityを必須とし、raw文字列Rootを受理しない |
| Working Directory入口 | Repository内から開始する既存Runtime Consumer | Git境界、symlink／junction、最寄りRootを検証してから公開Resolverへ接続する |

Consumer集合は手書き一覧だけを正本としない。実Sourceからraw Resolverおよび未登録Top-level領域の利用箇所を導出し、宣言した閉集合との差をCheckerで拒否する。既知Consumerごとの契約試験に加え、現行の本番利用側と公開入口までの縦断反証を持つ。Coordinator専用署名の保護Resolverと署名・昇格入口は退役しており、現在Consumerの保証へ含めない。汎用成果物署名と過去の検証記録は、この退役を理由に変更しない。

## 9. 完成条件

- 全本番Producerが共通Path Resolverから目標領域を取得する。
- `.crdd`直下fileと未登録Top-level Directoryの新規作成を機械的に拒否する。
- `tmp/`の全ProducerがOperation所有、全終端経路、昇格、清掃、不存在確認を試験する。
- Repository-local状態とCROS／User／Host Runtime状態を混在させない。
- 現行のRecovery義務と正式Evidenceを失わず、旧Path Readerを0件にする。
- 移行後に旧Pathを再生成する回帰試験を持つ。

## 保存領域の読取り専用観測

実行モデルの保存処理は、保存Ownerに結合済みの起点と宣言済みの領域名で、保存領域の実体を観測する。履歴の追記、搬送済み確認、判断履歴の読取りでもGitから保存先を引き直さない。排他・保存方針の現在性・読取り前後の領域一致は維持する。観測単独では、Directory作成、Git除外登録、Lock取得、設定変更および削除を行わない。利用側が名前付きPathの親を逆算して`.crdd`を再構成しない。

| 結果 | 意味 | 利用側の処置 |
|---|---|---|
| ready | RootとAreaのDirectory境界を検証した現在の観測。非Authorityの不透明な`boundaryIdentity`を持つ。 | 内容読取りの前後でOwner観測を再取得し、同じ境界を見ているか照合する。 |
| not_observed | 保存起点を確認した上で、`.crdd`または対象領域の明示的な不存在を観測した。 | 未作成を正常履歴や実行なしへ読み替えず、未観測を表示する。 |
| blocked | 保存起点の欠測・不正、link・type不正、境界失効または観測不能。 | 読取りを停止し、不存在や空履歴へ補正しない。 |

`boundaryIdentity`はDirectory置換の検知用であり、操作権限、過去の終了証明、履歴の完全性または内容の不変性を発行しない。内容Hash、Lock・pendingと終了後観測は各Storeの責務として維持する。

## 履歴保持期間の設定

設定Readerは構成モデルが所有し、上位Consumerが各履歴Ownerへ必要な保持値を渡す。現在の配置は`.crdd/config/execution-intelligence.json`と`.crdd/config/coordinator.json`である。保存統合BではTaskと技術実行の履歴をCoordinatorの同一設定へ接続し、旧Orchestrator専用Reader・設定例・Schemaを撤去する。Coordinatorの現在状態・回復・終了要約の条件は[Coordinator詳細の縮小設計](../coordinator/01_Architecture.md#現在状態と履歴を分ける縮小設計)を正本とし、本節で再定義しない。

CRDDのCoordinatorが`readExecutionIntelligenceConfig`又は`readCoordinatorConfig`で対象Tool設定を読む。EIには準備済み所在と保持日数を明示して渡し、EIからDMを参照しない。Runtime Dataは設定の検証と読取りだけを所有し、記録の整理判断は各履歴Ownerが行う。他Toolの設定は読取り条件にせず、旧`orchestrator.json`も探索しない。

| 項目 | 契約 |
|---|---|
| 配置 | Repository-local `.crdd/config/`の`execution-intelligence.json`、`coordinator.json`。非秘密のTool別設定として明示allowlistでGit管理する。 |
| 固定形式 | 各ファイルに`schemaRevision: 1`と`historyRetentionDays`を必須とする。未評価の設定項目を先回りして追加しない。 |
| 既定 | 当該Toolの設定ファイルが存在しない場合だけ30日。他Toolの設定状態に依存しない。 |
| 指定値 | ミリ秒へ安全に変換できる正の整数日数。所有者別に指定する。 |
| 不正・観測不能 | 当該Toolの設定結果をblockedとして整理を停止する。既定値や無期限へ読み替えない。 |
| 保護範囲 | 未解決の回復義務、実行中の状態、Candidate、秘密情報および正式Evidenceを通常履歴の期間で削除しない。 |
| 変更時 | 一回の整理処理は一つの設定Snapshotを用いる。過去の終了判断に必要な保持期間はOrchestrator側が判断時の記録へ固定し、後の設定変更で過去の根拠を書き換えない。 |

設定例は`template/.crdd/config/`の`execution-intelligence.example.json`、`coordinator.example.json`、Schemaは`template/tools/schemas/`の各Tool名に対応する`*-config-schema.json`で提供する。設定を自動作成せず、不存在だけを既定値の適用根拠とする。共通の期間設定ファイルや旧形式Readerは追加しない。移行時はフロントAIが旧設定値を新設定へ照合し、現在状態・未解決参照とは分けて処置する。設定Readerの提供だけを、保存統合Bの全体完成とは扱わない。

### 設定の配置と管理境界

設定は読み込む所有者と適用範囲で配置する。設定例を実設定として読み込まず、配布物にあるという理由だけで権限や採用を推定しない。

| 種別 | 配布・説明 | 実際の配置 | 管理責任 |
|---|---|---|---|
| Repository Identity・外部送信Policy | `template/.crdd/config/*.example.json` | 利用Repositoryの`.crdd/config/` | 非秘密の共有宣言として明示allowlistでGit管理する。Policy採用権限は既存契約を維持する。 |
| Orchestrator・Execution Intelligence設定 | Tool別の`template/.crdd/config/*.example.json` | 利用Repositoryの`.crdd/config/<tool>.json` | 非秘密のRepository設定として明示allowlistでGit管理する。期間の指定だけで削除権限を発行しない。 |
| AI Profile Catalog | AI Runtimeが所有する固定既定Catalogと管理入口 | Repository単体は`.crdd/config/ai-profile-catalog/`、CROSはOS管理の設定Root | 既存Catalog保存契約を維持する。今回Snapshot方式や管理権限を変更しない。 |
| MCP／Workbench配置設定 | `template/.crdd/config/mcp-server.example.json`、`workbench-server.example.json` | 起動Repositoryの`.crdd/config/<server>.json` | 非秘密の公開Originだけ。明示CROS modeで既存Readerが検査し、例は実設定へ自動採用しない。 |
| Access Management管理状態 | [Host初期化と管理API](../access-management/02_Management_State_and_API.md) | 既存OS管理Rootの管理状態 | Host初期化・Workbench管理操作が保存する。手編集するCROS設定や秘密状態の配布例を作らない。 |
| Schema | `template/tools/schemas/` | 配布物の固定Schema | CRDD配布版が所有する検査契約であり、利用Repositoryの実設定ではない。 |
| 固定Runtime設定・既定Catalog・Release Manifest | 各SubsystemのRuntime／Source、署名Manifestの既存配置 | 固定配布物内 | 実装・署名契約が所有する。利用者の設定置場として編集しない。 |

`template/tools/`は起動入口、Schema、固定Release Manifestを保持し、利用Repositoryが編集する実設定は置かない。Repository用の設定例は実配置と対応する`template/.crdd/config/`へ揃える。旧Shared Serverの混在例は、MCP／Workbenchの可視配置例とAccess Managementの管理操作へ分離したため撤去する。管理状態を新しい手編集設定として重複保持せず、秘密状態をGitへ移さない。例のJSONを文書に重複保持しない。

`.crdd`全体を追跡対象にせず、既定の非追跡と非秘密の改訂固定設定の明示allowlistを併用する。Runtime状態、履歴、Lock、一時物、候補および秘密は追跡しない。今回、既存設定の値、Loaderの配置、署名対象、Catalog保存形式およびAuthorityを変更しない。

## Implementation Structure

| 観点 | 適用 | 判定理由 | 成立させる構造 | 局所責務・不変条件 | 失敗・変更時の影響 | Qualityへの導出キー |
|---|---|---|---|---|---|---|
| Variation | Required | この観点を成立させる構造と責務が存在するため。 | Qualityへの引渡しで責務差を別の設計項目として固定する。 | 具象差を一つの分岐へ畳まず、各導出キーの正常条件と反証条件を保つ。 | 新しい具象を追加した場合、対応する導出キーと利用側の再確認が必要になる。 | `runtime-data.repository-local-storage`<br>`runtime-data.cros-runtime-root` |
| Common Contract | Required | この観点を成立させる構造と責務が存在するため。 | Repository-localとOS-managed Runtime Rootを、Owner、Durability、Retention、CleanupおよびRecoveryの共通契約へ揃える。 | 配置先が異なっても由来、Identity、読書きAuthorityと終了後不存在を同じ語彙で扱う。 | 新しい保存領域が独自Top-level、無期限保持または名前だけの清掃判断を持つ。 | `runtime-data.repository-local-storage`<br>`runtime-data.cros-runtime-root` |
| Creation／Selection | N/A | 本領域は独立した具象生成・選択責務を持たず、上位から固定入力を受ける。 | 本領域は独立した具象生成・選択責務を持たず、上位から固定入力を受ける。 | 生成・選択判断を本領域へ追加しない。 | 将来生成・選択責務を追加する場合に再評価する。 | N/A |
| State-dependent Behavior | Required | この観点を成立させる構造と責務が存在するため。 | 入力・処理中・完了・失敗・観測不能を区別して振る舞いを決める。 | 状態を空値や成功へ畳まず、同じIdentityで終了条件まで追跡する。 | 状態追加・統合はRecoveryと観測契約へ波及する。 | `runtime-data.repository-local-storage` |
| Composition／Recursion | Required | この観点を成立させる構造と責務が存在するため。 | 複数の局所責務を公開結果へ合成し、部分成立と全体成立を分ける。 | 各局所結果を保持し、必要な全要素が揃うまで上位完成を表示しない。 | 構成要素の追加時は完成条件と全Consumerを再確認する。 | `runtime-data.repository-local-storage`<br>`runtime-data.cros-runtime-root` |
| Lifecycle Ownership | Required | この観点を成立させる構造と責務が存在するため。 | Process、Handle、一時物、秘密または公開SnapshotのOwnerと終了条件を固定する。 | 成功・失敗・取消の全経路で資源回収または同一Identityの回復義務を残す。 | Owner変更は取消、Recovery、終了後条件へ波及する。 | `runtime-data.cros-runtime-root` |
| External Boundary | Required | この観点を成立させる構造と責務が存在するため。 | 外部境界ごとに要求、受理、Effect、結果搬送および終了後状態を分ける。 | 境界の成功を要求発行だけから推定せず、段階に応じた観測を必須にする。 | 境界変更は直接境界からSystem／E2Eまでの検証範囲へ波及する。 | `runtime-data.cros-runtime-root` |

同じ責務へ二つ目の具象実装を追加する場合は、共通契約へ昇格するかを評価する。昇格しない場合は、同じ責務ではない、または局所分岐の方が単純で影響が小さい理由を記録する。特定のDesign Pattern名は必須にしない。

## 上流UI／SPEC Detailとの関係

| Detail Source | UI／SPEC Definition | この領域が担当するSCR／PRT／Interaction／BHV | Relation状態 | 未解決Gap／戻し先 |
|---|---|---|---|---|
| [UI／SPEC Detail Architecture Traceability](../../08_UI_SPEC_Detail_Traceability.md) | ARCH-000009、ARCH-000011、ARCH-000013、ARCH-000016のSource Definition | 同Traceability表で上記ARCH-IDへ接続された全Detail ID | Covered | Detailの意味変更はUI／SPECへ、配置責務の変更は該当ARCH定義へ戻す |

担当Interaction Relation: `PRT-000006.spec-000010`、`PRT-000006.spec-000031`、`PRT-000008.spec-000012`、`PRT-000011.spec-000005`、`PRT-000011.spec-000016`、`PRT-000017.spec-000022`

本領域は上記Relationの配置責務を局所所有する。Detailを新しい要求として解釈せず、対応ARCH-IDが所有する配置・境界・状態・観測の制約として実現する。

## 保存方式の切替確認

共通4ファイルを切替前の設計として区別し、保存中の短命ファイルと処理中間物のOwnerを分けた。Candidateの7日方針、保護対象、削除不能条件と未実装範囲を記録した。保存用途別に終了、保持責任者、利用側、清掃契機と上限の評価を要求し、未解決・未受理・観測不能をログ容量対策で捨てない契約を記録した。

OPEN: 各Ownerの保持上限値・自動循環・旧形式の清掃は未完了。CHG-000082の後続段階で具体化し、実装・実切替・独立確認の結果が揃うまで、設計記載だけを実装済みとしない。

## 検証報告と保存物読取りのOwner

汎用JSON確定StoreはDomainの責務から撤去する。旧sidecar方式の現役利用はExecutorの検証報告だけであるため、実装をExecutorの `tests/support/report.ts` へ専用化する。報告本文・確定sidecar・中断時intentの同一性、byte・Hash照合、部分保存・観測不能時の停止を維持し、本番判断Stateの保存や旧Host記録の互換読取りには使用しない。形式とsuffixは既存検証報告の契約として維持する。

旧容量制限付き共有Readerは維持しない。EMの保存物読取りは`storage/store.ts`の既存Node.js処理が所有し、正規byte表現、Link・実体の照合、descriptor終了、元版との一致を公開操作の必要条件に応じて確認する。今回の公開境界整理を理由に容量上限、汎用永続Store、新しいFacade又は用途別の読取り実装を再導入しない。

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
