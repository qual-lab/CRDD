# CRDD参照Toolのアーキテクチャ

Status: Candidate (v0.21.0, Released Baseline: v0.20.1)
Owner: Qual-Lab
Last Updated: 2026-09-06

## 対象・判断・現在状態

CRDD自身が提供するCoordinator Runtime、実行知（Execution Intelligence）、Checker、Windowsプラットフォームアクセス部、Project Operation ContextおよびCROS候補を対象とする。目的は、利用者向けの振る舞い、内部の成立方式、実装、検証、反復手順を分け、同じ情報の正本を一意にすることである。上位の[エージェント組織](../04_Agent_Organization.md)や[原則](../01_Principles.md)をTool固有の実装方式へ置き換えない。

今回の配置是正では、実装・テスト・ビルドを`40_Develop`、内部設計を本工程、入力・結果を[振る舞い仕様](../05_SPEC/01_Behavior_Specification.md)、操作順序を[作業手順](../19_Workflows/01_Coordinator_Runtime.md)へ分離する。`tools`を第二ソースや手順索引として残さない。旧入口の互換shimは追加せず、採用側へ配布するChecker本体は`template/tools/crdd-check.ts`を単一の配布正本として維持する。

配置変更後の機械検証と独立レビューの結果は[品質の現在状態](../07_Quality/01_Quality_Center.md)へ集約する。この移管を設計工程全体の完了、Runtimeの新しい実測、署名配布物の成立またはReleaseとみなさない。過去の固定実測は当時版への根拠として保持し、配置変更後の配布Identityと正式E2Eは別に確認する。

## 構成と責務

| 対象 | 所有する責務 | 接続・制限 |
|---|---|---|
| Coordinator | Repository／Revision、実行編成、Authority、隔離候補、結果・回収の調整 | [状態・資源・Lock・回復設計](coordinator/01_Architecture.md)。Providerの自己申告を実行許可にせず、MCP Transportを所有しない |
| 実行知 | 仕事Identityへ結合した実行Event、欠測を保つ集約、非Authority改善候補、Repository-local保存と清掃 | [実行知のアーキテクチャ](execution-intelligence/01_Architecture.md)。Coordinator、MCP、Provider SDKまたはProject Stateを所有しない |
| Windowsプラットフォームアクセス | TypeScriptだけで閉じないOS観測と限定native操作 | [native境界・資源・回復の設計](platform-access/01_Architecture.md)、[脅威モデル](coordinator/02_Threat_Model.md)。一般PolicyやCLI責務をRustへ移さない |
| Checker | 文書・参照・契約の決定論的確認 | [検査範囲・配布・終了の設計](checker/01_Architecture.md)。private packageが配布正本を参照し、Checker合格を専門レビューや準拠承認にしない |
| Project Operation Context | Project／Repository Identity、Topic／Meeting Lifecycle、各正本からのProject Management Projection | [Project Operation Contextのアーキテクチャ](project-operation/01_Architecture.md)。Projectionを正本または更新Storeにせず、RelationからAuthorityを生成しない |
| CROS | Personal／Shared ServerのRepository Federation、Workspace Exposure、Connection Credential、Source-aware Projection、Agent Operating Contextおよび構造化Handoff | [CROS Federationと利用境界](cros/01_Architecture.md)。Server CredentialやProject Relationを利用者Authorityへ昇格せず、`system_admin`、Content Access、Task RoleおよびEffect Authorityを分離する |
| 実装規則 | 命名、実装境界、依存、検査母集団 | [コーディング規約](99_Coding_Standards.md)。公開Schemaや固定履歴を命名整理だけで変えない |
| 品質保証 | 品質方針、検証設計、確定結果、現在状態 | [Quality Center](../07_Quality/01_Quality_Center.md)。テストコードと検証義務の正本を中央へ移さない |

Generator等の将来Toolの存在を仮定して空成果物は作らない。新しいToolでは同じ責務分離を適用し、実際の入力・利用者・実行境界から必要な設計を追加する。

### Tool全体の結合ブロック

結合ブロックは、ファイルやDirectoryではなく、同じ状態、Authority、資源および終了条件を共同で成立させる責務の単位である。主機能だけでなく、取消、cleanup、Recovery、再入場、耐久記録および結果settlementを、その成立に必要な副次機能として同じブロックまたは隣接ブロックへ明示する。正確な試験IDと自動回帰接続は[試験カタログ](../07_Quality/04_Test_Catalog.json)が所有し、次表は人間が責務境界を判断する正本である。

```text
公開入口
  ↓
意味契約／受付ブロック
  ↓
Core／Applicationブロック
  ↓
Port／Adapterブロック
  ↓
外部境界ブロック
  ↓
終了観測
  ├─ 正常settlement
  ├─ 取消＋cleanup
  └─ Recovery記録＋再入場

段階的な結合確認
  block内の実境界
    → 隣接block間
      → 公開入口からのTool全体
        → 複数Toolを通る総合試験
```

| Tool | 結合ブロック | 共同で成立させる責務 | Lifecycle上の副次機能 | 詳細正本 |
|---|---|---|---|---|
| Checker | Repository検査 | Root／範囲受付、発見、参照解決、決定論的報告 | Git子Process終了、読取不能、未確認範囲、Effect 0 | [Checker](checker/01_Architecture.md#3-検査の順序) |
| Checker | 回帰実行 | 試験発見、子Process実行、結果集約 | timeout、取消、fixture cleanup、部分結果 | [Checker](checker/01_Architecture.md#5-資源と終了) |
| Project Runtime | Objective／Task | Objective受付、Task遷移、Execution Port調停 | 待機、取消、世代再照合、Effect不明時のRecovery | [Project Runtime](project-runtime/01_Architecture.md#6-状態authority資源) |
| Project Runtime | 判断／Recovery | 人間判断、再計画、Lease、Recovery再入場 | 一回限りAuthority、stale世代拒否、再開settlement | [Project Runtime](project-runtime/01_Architecture.md#9-移行と検証) |
| Project Runtime | 統合／投影 | 候補統合、Accepted Result、読取り専用状態投影 | 未採用候補の隔離、投影Effect 0、相関不一致拒否 | [Project Runtime](project-runtime/01_Architecture.md#7-公開アプリケーション契約) |
| Coordinator | Provider実行 | 選定、外部送信許可、隔離Executor実行、候補固定 | timeout、取消、Process／Container cleanup、候補未発行 | [Coordinator](coordinator/01_Architecture.md#3-一般taskの主シーケンス) |
| Coordinator | Reviewer判定 | 候補結合済み内容投影、独立Review、構造化判定、限定是正 | 投影失敗、Provider終了、指摘の安全な診断、最終判定settlement | [Coordinator](coordinator/01_Architecture.md#3-一般taskの主シーケンス) |
| Coordinator | 候補公開 | 候補snapshot、Store、統合公開 | Lock、衝突、破棄、正本採用前Effect 0 | [Coordinator](coordinator/01_Architecture.md#10-provider実行と候補) |
| Coordinator | Release署名 | 配布依存観測、署名、候補promotion | preflight、秘密入力、失敗staging、単一snapshot | [Coordinator](coordinator/01_Architecture.md#9-署名済み配布物) |
| Coordinator | Docker Task回復 | Docker Task実行、資源回収、Task Recovery | Container／Network／Volume不存在、exact Identity再入場 | [Coordinator](coordinator/01_Architecture.md#11-取消と回復) |
| Coordinator | Docker Desktop修復 | 障害分類、修復Effect、履歴Recovery | 停止、run Directory退避、再起動、Engine再観測、旧義務settlement | [Coordinator](coordinator/01_Architecture.md#docker外部境界の結合単位) |
| 実行知 | Event発行 | Event検証、非Authority発行、利用側観測 | 欠測保持、無効Event拒否、主処理結果の不変 | [実行知](execution-intelligence/01_Architecture.md#3-発行と失敗境界) |
| 実行知 | 耐久Store | Repository結合、immutable publish、保持候補 | Process間排他、衝突再読取、残存分類、清掃候補 | [実行知](execution-intelligence/01_Architecture.md#4-保存と改変検知) |
| MCP | 公開契約Adapter | decode／encode、公開契約投影、閉じた結果 | session開始・取消・終了、切断、再接続、Effect不明の保持 | [MCP](mcp/01_Architecture.md#3-依存と所有権) |
| MCP | Transport | stdio／localhost HTTP搬送 | bind、同時接続、切断、shutdown、listener不存在 | [MCP](mcp/01_Architecture.md#5-transport-lifecycle) |
| Platform Access | OS観測／Process | protocol、OS主体・実体観測、所有子Process | handle／Job／stdio回収、timeout、取消、部分frame拒否 | [Platform Access](platform-access/01_Architecture.md#5-状態資源回復) |
| Platform Access | Docker native操作 | 署名済みartifact固定、限定停止・再起動 | mutex、Process tree、Effect確認、helper異常終了 | [Platform Access](platform-access/01_Architecture.md#5-状態資源回復) |

ブロックの増減または責務移動では、表だけを更新して完了しない。詳細設計のテキスト図、状態遷移表および適用条件を満たす状態遷移図、試験カタログの結合ブロック、実在する結合試験、変更影響型回帰の利用側を同じ固定候補で一致させる。ブロック内の単体試験だけ、隣接Adapterのmockだけ、またはTool全体のE2Eだけで中間境界の成立を代替しない。

### ブロック間シーケンスの正本

前表は責務と境界、各Toolの状態遷移表はブロック内部の状態を所有する。以下のテキストシーケンス図は、順序に意味があるブロック間の呼出し、CanonicalなIdentity／Authority／状態の受渡し、応答および逆順cleanup／Recoveryだけを所有する。試験IDと実行条件は試験カタログが所有し、図へ複製しない。

```text
表        = 誰が何を所有するか
状態遷移表 = 一つのblock内で何が起きるか
sequence  = blockをまたいで、いつ何を渡すか
試験Catalog = どの試験がそのsequenceを反証するか
```

一段の結合で責務を切り分けられる経路は隣接する二ブロック、Identity、Authority、状態、Effect、cleanupまたはRecoveryが伝播する経路は一つ先を含む三ブロックまでを結合単位とする。四ブロック以上の全体経路は総合試験（ST）またはE2Eが所有する。順序やlifecycle伝播を持たない一意な局所変換には、シーケンス図を機械的に追加しない。

#### 検査と回帰実行

```text
利用者          Repository検査          回帰実行          子Process
  │                   │                    │                  │
  │-- 検査対象／基準 ->│                    │                  │
  │                   │-- Root・差分観測  │                  │
  │                   │-- {Canonical対象集合}／実行計画 ---->│
  │                   │                    │-- 試験開始 ------>│
  │                   │                    │<-- 結果／終了観測-│
  │                   │                    │                  │
  │                   │   [timeout／取消]  │-- 取消要求 ------>│
  │                   │                    │<-- Process不存在-│
  │<-- 完全／部分／停止を区別した結果 ------│                  │
  │                   │                    │                  │
  └─ cleanup（逆順）: 子Process -> 回帰実行 -> Repository検査
```

回帰実行はRepository検査が確定した対象集合を再解釈しない。子Processの開始、結果受信、終了観測および一時資源の不存在が揃うまで、完全実行と表示しない。

#### Task実行と公開

```text
受付と実行

外部Actor       MCP Transport       MCP Adapter       Project Runtime       Coordinator
   │                  │                  │                    │                   │
   │-- Objective ---->│                  │                    │                   │
   │                  │-- decode済み --->│                    │                   │
   │                  │                  │-- {Objective ID} ->│                   │
   │                  │                  │                    │-- {Execution Port Authority} -->│
   │                  │                  │                    │                   │-- Provider実行
   │                  │                  │                    │                   │-- settlement

候補と公開

Coordinator        候補公開         Project Runtime       統合／投影        MCP Adapter／Transport       外部Actor
    │                  │                    │                  │                      │                     │
    │-- {Candidate ID}->│                    │                  │                      │                     │
    │                  │-- {Candidate Reference} ------------>│                      │                     │
    │                  │                    │-- 候補／受入条件->│                      │                     │
    │                  │                    │<-- {Accepted Result／Recovery Ref} ------│                     │
    │                  │                    │-- Canonical公開結果 --------------------->│-- 公開結果 -------->│
    │                  │                    │                  │                      │                     │
    │                  │   [失敗／切断]     │<-- {Operation ID}の取消 -----------------│                     │
    │<-- 同じIdentityの取消／Recovery再入場-│                  │                      │                     │
    └─ cleanup（逆順）: Coordinator -> Project Runtime -> MCP Adapter -> MCP Transport
```

各ConsumerはCanonicalな候補、結果、Recovery参照を再構成しない。未settle候補、相関不一致またはcleanup不明をAccepted Resultへ投影しない。

#### Provider実行とReviewer判定

```text
Provider実行               Reviewer判定                 候補公開
    │                           │                          │
    │-- {Candidate Identity} -->│                          │
    │-- {認証済み内容投影} ----->│                          │
    │                           │-- 実Reviewer起動         │
    │                           │<-- 構造化判定／Finding --│
    │                           │                          │
    │   [changes_requested]     │-- 限定是正を同じExecutorへ戻す
    │<-- {Finding Capability} --│
    │-- {新Candidate／投影} ---->│
    │                           │-- 同じReviewerで再判定
    │                           │                          │
    │                           │-- approved＋Finding 0 -->│
    │                           │                          │-- 永続化／公開
    │                           │                          │
    │   [拒否／異常終了]        │-- 判定・分類・Hashだけを安全に記録
    └─ cleanup（逆順）: Reviewer Process -> Provider Process -> 候補隔離領域
```

内容投影の正確性、実Reviewerの判定、Provider終了、限定是正後の再判定および候補処置は一つの結合境界である。固定Fakeだけからこの境界の成立を推定せず、正式4経路E2Eの前に署名済み候補からCodex／Claude Reviewerを各一回通す実境界結合を明示実行する。実行結果は生のProvider文面を保存せず、判定、Finding件数・分類・message Hash、候補投影Hash、対象byteの一致およびcleanupを保持する。

#### 実行観測の耐久化

```text
Project Runtime            Event発行                 耐久Store
      │                         │                        │
      │-- {Task ID}／Task結果 ->│                        │
      │                         │-- 非Authority Event -->│
      │                         │                        │-- immutable publish
      │                         │                        │-- collision readback
      │                         │<-- 保存／欠測／失敗 ---│
      │<-- 観測状態 ------------│                        │
      │                         │                        │
      │   [保存失敗]            │-x Task結果／Authorityの変更なし
      └─ cleanup（逆順）: 耐久Store -> Event発行
```

実行知の保存失敗は主処理の結果やAuthorityを変更しない。欠測または保存失敗は成功値へ畳まず、同じ仕事Identityへ結合して観測可能にする。

#### Docker回復と再入場

```text
Project Runtime    Docker Task回復    Platform観測／所有Process    Docker Desktop修復       実Docker
      │                   │                       │                       │                    │
      │-- {Recovery ID} ->│                       │                       │                    │
      │                   │-- fresh状態観測 ----->│                       │                    │
      │                   │<-- {Exact Runtime State} --------------------│                    │
      │                   │-- {Recovery ID}／修復要求 ------------------->│                    │
      │                   │                       │<-- 限定Effect Authority│                    │
      │                   │                       │-- stop／start要求 ------------------------->│
      │                   │                       │<-- Engine応答 ------------------------------│
      │                   │                       │-- Process終了／資源不存在 ->│              │
      │                   │<-- Engine／資源のfresh再観測 ----------------│                    │
      │<-- 同じ{Recovery ID}のsettlement／停止 ---│                       │                    │
      │                   │                       │                       │                    │
      │   [観測不能／Identity不一致]              │                       │                    │
      │                   │-x Effect再発行なし    │                       │                    │
      └─ cleanup（逆順）: 実Docker -> Platform観測／所有Process -> Docker Desktop修復 -> Docker Task回復
```

要求発行、Process handle取得、Docker停止／開始要求、Engine応答および資源不存在を別の成立点として扱う。観測不能、Identity不一致またはcleanup不明ではEffectを再発行せず、同じRecovery Identityを保持して停止する。

#### Release候補と署名

```text
固定候補         配布依存観測          署名入口          秘密鍵境界         配置／再読取
   │                  │                   │                  │                  │
   │-- candidate ---->│                   │                  │                  │
   │                  │-- {Runtime Dependency Snapshot} --->│                  │
   │                  │                   │-- 全非秘密preflight                  │
   │                  │                   │                  │                  │
   │                  │   [preflight成立] │-- 一回だけの入力->│                  │
   │                  │                   │<-- Key Capability│                  │
   │                  │                   │-- 署名済みmanifest ----------------->│
   │                  │                   │<-- byte一致／Hash／配置観測 ---------│
   │<-- promotion可能 --------------------│                  │                  │
   │                  │                   │                  │                  │
   │   [preflight／署名／配置不成立]       │-x promotionなし  │                  │
   │<-- 失敗staging保持 ------------------│                  │                  │
   └─ cleanup（逆順）: 秘密鍵境界 -> 署名入口 -> 配置／再読取
```

署名入口は単一snapshotを使用し、Consumer側でPathまたはRuntime Identityを再解釈しない。preflight完了前に秘密入力を要求せず、署名または配置の不成立をpromotionへ進めない。

### v0.20で固定する依存方向

次の図はv0.20で目指す全体構成と依存方向を示す。図は責務境界の正本であり、各要素の実装済み・計画中という到達状態は、個別設計と対応するCHGで判定する。MCP Streamable HTTP、読み取り専用Project State投影および限定分散実行は、図に含まれていても単体の存在だけで完成とは扱わない。

```text
利用者／外部Actor
        │
        ├──────── CLI
        ├──────── MCP stdio
        └──────── MCP Streamable HTTP（v0.20実装中）
                         │
                  Transport Adapter
             decode／encode／接続lifecycle／取消通知
                         │
                         ▼
             Project Runtime公開契約
          Objective／判断／結果／状態投影
                         │
                         ▼
                 Project Runtime
          ┌──────────────┼──────────────┐
          │              │              │
      Application       Core           Ports
   受付／調停／統合   状態／不変条件   必要能力の契約
                                         │
               ┌─────────────────────────┼──────────────────────┐
               │                         │                      │
               ▼                         ▼                      ▼
       Coordinator Adapter       永続化／判断Adapter      実行観測Adapter
               │                         │                      │
               ▼                         ▼                      ▼
          Coordinator             Repository-local       Execution Intelligence
       選定／隔離／Review          `.crdd` State          非Authority Event／集約
          ┌────┴────┐                    ▲
          │         │                    │
          ▼         ▼                    │
     Provider    Platform Adapter ───────┘
     Adapter     Process／Filesystem／
          │      Lock／cleanup／Recovery
     ┌────┴────┐          │
     ▼         ▼          ▼
   Codex   Claude Code  Platform Access／Docker／OS

利用者向け構成Root
  ├─ template/tools/crdd-coordinator.ts
  │    └─ CLIとCoordinator AdapterをProject Runtimeへ接続する。
  └─ template/tools/crdd-mcp.ts
       └─ MCP Transport、Project Runtime、Coordinator公開Adapterを接続する。

内部Component
  └─ Project Runtime、MCP、実行知、Platform Accessは、利用目的のない
     見かけ上のLauncherや独自の全体構成Rootを持たない。
```

矢印は利用または注入の向きを表す。Project RuntimeはCoordinator、MCP、Provider、OSおよび実行知の実装へ逆依存しない。実行知Eventは観測であり、Project状態、実行許可、採用判断またはRecovery Authorityへ昇格しない。Project運営上のWBS、Risk／Issue、Topicおよび予測はこの実行構成図のProject Stateに含めず、別のProject Management投影として扱う。

MCP stdio、MCP Streamable HTTPおよびCLIは、Transport固有のdecode、encode、接続lifecycleおよび取消通知だけを担うAdapterとする。MCPを公開意味契約の所有者にせず、Transport非依存の公開アプリケーション契約をProject Runtimeの手前に置く。公開アプリケーション契約が所有できるのは、外部ActorがProject Runtimeへ渡す意図、結果、継続に必要な非Authority参照およびそれらの意味相関に限る。内部Event、実行知のTelemetry、Provider契約、管理操作またはProject正本を取り込まない。

Launcherはpackageの数に合わせて作らず、利用者が独立して開始・終了する公開アプリケーションにだけ置く。v0.20ではChecker、Coordinator、MCP Serverの3入口を`template/tools/`に固定する。Project Runtimeと実行知は公開API、Platform AccessはCoordinatorが所有するnative workerとして接続し、単独Processとして利用する要件が確定するまでLauncherを追加しない。単一の巨大な総合Launcherにも集約せず、検査、外部接続および実行編成で異なるAuthority、lifecycle、失敗影響を保つ。

Project Runtimeは必要な実行能力をExecution Portとして定義し、Coordinator固有型へ依存しない。Coordinator AdapterがそのPortを実装し、Provider選定、隔離、実行、独立Review、候補および回収を編成する。物理Directoryまたはpackageの分離は、この依存方向とAuthority所有を契約試験で固定した後に行う。ファイル移動だけを責務分離と扱わない。

読み取り専用のProject State投影は、現在状態、実行中／待機、停止理由、人間判断待ち、回復義務および現在のQueue／実行状態に限る。WBS、Risk／Issue、Topic、予測および入力済み進捗を、最小投影の成立から暗黙に追加しない。

## 状態・資源・信頼境界

Coordinatorの中心経路は、固定配布物とRepositoryを検証し、必要なAuthorityを確認し、Executorと独立Reviewerを隔離して実行し、候補と回収条件が成立した場合だけ結果を公開することである。正常OSと認証済みLocal Userを最小信頼境界に含め、Repository、子Process出力、ネットワーク入力や未検証成果物をAuthorityへ昇格しない。

共有・永続資源は取得者、Lock順序、失効、取消後の責務、終了確認を持つ。成功通知だけで資源不存在を推定せず、回復不明は停止・Evidence保持・処置可能なIDの返却へ閉じる。具体的な[実行順序](coordinator/01_Architecture.md#3-主実行シーケンス)、[資源所有](coordinator/01_Architecture.md#4-資源所有)、[Lock](coordinator/01_Architecture.md#5-lock順序と解放窓)、[回収順](coordinator/01_Architecture.md#7-cleanup依存順)、[不変条件](coordinator/01_Architecture.md#8-不変条件)は詳細正本から辿る。

Provider実行の方式はWindows上のDocker Desktop Linux Engineと固定公式CLI、専用認証Home、限定Egressである。Project Runtimeの公開入口にはMCP stdio Adapterが接続済みであり、v0.20では同じ公開アプリケーション契約へ到達するlocalhost限定のMCP Streamable HTTP Adapterを実装中である。Linux／Remote Runtime、macOSおよびSelf-hosted Providerはv0.20の対象外とし、将来の検証可能性を損なわない境界だけを維持する。API key課金へのfallback、任意外部ツール、直接Provider間spawn、正本への自動commit／push／mergeを、実行知の分離やAdapterの存在から追加しない。

## 検証義務・未確認範囲・引渡し

- 入力・結果・取消・回復の意味を移設前後で保持し、実producerから公開consumerまでの接続を確認する。
- import、package、CLI、CI、型・命名検査、機械可読Trace、固定成果物Path、署名manifestおよび利用案内を同じ最終配置へ揃える。
- 正常・準正常・異常の開発試験を新配置から実行する。固定Fake／契約試験と、実OS／Docker／Provider観測を混同しない。
- 署名済み配布物を必要とする操作は、変更後の固定版と成果物を再検証する。旧版の署名を新配置へ流用せず、開発デバッグに公式鍵を要求しない。
- 公開済みCHG・固定Evidenceは移動・改稿せず、その当時のPathと結果を保持する。
- 未解決の実装・観測範囲は[詳細設計の変更と検証](coordinator/01_Architecture.md#11-変更と検証)と[CHG-000015](../90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md#1-結論と現在状態)、配置・命名移行は[CHG-000017](../90_Release/Changes/CHG-000017_Tools_Coding_Standards.md)で追跡する。

担当はQual-LabのRuntime保守と親Coordinator。完成条件を満たさない範囲を将来候補へ送らず、変更後の固定版で独立Architecture／Security、Test／UX、Document／Gap／Impact／Conformanceの結果を統合して人間の採用・Release判断へ渡す。
