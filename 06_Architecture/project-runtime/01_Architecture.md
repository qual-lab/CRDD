# Project Runtimeアーキテクチャ

状態: Candidate（v0.20.0、Released Baseline: v0.19.0）
担当責任者: Qual-Lab
最終更新日: 2026-09-06

Related:
- [Runtime責務分離](../../90_Release/Changes/CHG-000063_Runtime_Responsibility_Separation.md)
- [v0.19 Project Runtime詳細設計](../coordinator/03_Project_Runtime_Design.md)
- [MCP Transport](../mcp/01_Architecture.md)
- [実行知](../execution-intelligence/01_Architecture.md)
- [Project状態参照とローカルMCP HTTP](../../90_Release/Changes/CHG-000064_Project_State_and_Local_MCP_HTTP.md)

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
| Execution Observation Port | Task Attempt終了の非Authority Eventを記録する | 実行知Adapter |
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

## 6. 状態、Authority、資源

v0.19のTask、Objective、Milestone、QueueおよびDecision状態と遷移を意味変更せず継承する。正本は移行完了まで[v0.19 Project Runtime詳細設計](../coordinator/03_Project_Runtime_Design.md)と機械可読な設計対応である。v0.20の物理移動を理由に状態名、成功条件、IdentityまたはRecovery義務を簡略化しない。Project Stateを所有するProcess世代はCoreが乱数や時刻から生成せず、Hostが有効な`ownerGeneration`として明示入力する。Coreは欠落または不正な世代を状態生成前に拒否する。

Project RuntimeはAuthorityを生成しない。人間または上位Runtimeから受け取ったProject／Milestone AuthorityをTask単位へ縮小し、Task要求と`authorityBindingId`へ結合してExecution Portへ渡す。Runtime packageの実行許可CapabilityはExecution Authorization Portから外部Effect直前に取得し、Task Authority、Task内容または許可Pathの根拠として扱わない。Transport metadata、Provider出力、Project State、実行知EventまたはAdapterの存在からAuthorityを導出しない。

Applicationは長時間待機中に短時間Lockを保持しない。Port呼出し前後でProject generation、Task／attempt／Operation、Authority、取消、RecoveryおよびLeaseを再照合する。PortのcleanupまたはEffectが不明な場合は、同じProcess・Queue・Taskを再利用せずexact Recovery義務を保持する。

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
