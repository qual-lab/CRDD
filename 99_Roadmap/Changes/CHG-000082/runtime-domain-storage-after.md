# Domain・共通保存の棚卸しとAfter案

- 対象: CRDD v0.22 / CHG-000082
- 成果物種別: Architecture再編の調査・詳細案。正式設計への反映・Source移管前。
- 基準Commit: `5dae7108436205ecf7804d7898b1aecc2e8ce85b`
- 責任者: Qual-Lab
- 入力・段階: [Runtime責務再編計画](runtime-responsibility-realignment-plan.md)のA〜C。
- 対象外: Source編集、Runtime状態・保持物の読取りと操作、AI再送、Docker操作、保存先有効化、リリース判断。

後続の正式設計は[Runtime DomainのAPI・単一保存契約](../../../06_Architecture/Details/domain-model/05_Runtime_Domain.md)を正本とする。本資料のAPI候補・型名・更新方式は調査時点の案であり、正式設計と競合した場合に優先しない。基準版の宣言索引と未確定事項の経緯は保持する。

## 1. 結論と調査の限界

後続の人間確認により、文書のMilestone／Roadmap／WBSはCRDD文書群、実行Taskの計画分解はフロントAI等のCaller、渡されたTaskの実行はCoordinatorとする。以下のPlan／Objective／Milestone移管案は実行依頼モデルだけを対象とし、文書の業務計画の別正本や自動同期を作る案ではない。現行用途と公開入口の差は[正式設計](../../../06_Architecture/Details/domain-model/05_Runtime_Domain.md#document-and-execution-ownership)を参照する。

Domain Modelへ「業務上の値・局所操作・共通保存」を移し、Coordinatorには横断的な実行調停を残す。Executorは単一試行のLibraryとし、Domainを通してAIを起動する構造にはしない。

保存は一つの現在状態を維持する。目的、Task、Queue、技術Operationをそれぞれ別の保存正本へ分離しない。意味上のOwnerを分けても、同じ世代・Hashを確認する比較更新（CAS）で相関を確定する。

今回確認した範囲は次のとおり。

| 母集団 | 観測 | 限界 |
|---|---|---|
| Coordinator `src/**/*.ts` | 74 File、トップレベル名前付き宣言1,668件、うちexport修飾980件 | TypeScript構文索引。ローカル宣言、生成Worker、実行時閉包の全意味確認ではない |
| Package Root公開 | 73項目 = 値39・型34 | 内部export980件とは異なる。値には検査関数・定数を含み、73操作ではない |
| 本番Sourceの直接参照 | MCP 4 File、Workbench 15 File | 型と値の参照を含む。Coordinator読込み不能での起動成立は未試験 |
| 本番入口・配布・検証 | Workbench bin 1、scripts 3、template入口1、試験参照23、Coordinator scripts 5 | 相対参照等の静的文字列検索。動的構成・型消去後の閉包は後続試験で確認 |

宣言索引は基準版の構文を読み、通常のトップレベル関数・型・Interface・Class・Enum・変数Bindingを数えた。再exportを宣言数へ足さない。表の移管先は宣言群の処置案であり、1,668件すべての移管実装・真正証拠の閉包確認済みという意味ではない。

本番依存0のDomain ModelとAI Adapterも、今後の移管で逆依存を作れば独立性を失う。File数0だけで完成としない。

## 2. 現行Fileと宣言群の処置

数値は「トップレベル宣言 / export修飾宣言」。Fileを丸ごと移す指示ではなく、各File内の意味の分解先を示す。Executor内部の最終分割は段階Fで確定し、今回のDomain移管に混ぜない。

| 現行Coordinator src相対Path | 宣言数 | 処置案 |
|---|---:|---|
| `api.ts` | 17 / 14 | 公開表に従い分配。旧Rootを互換barrelとして残さない |
| `cli/authentication.ts` | 1 / 1 | Coordinator CLI据置。Domain CRUD・Executor操作の接続は各Ownerへ追従 |
| `cli/cancellation.ts` | 9 / 5 | Coordinator CLI据置。Domain CRUD・Executor操作の接続は各Ownerへ追従 |
| `cli/command.ts` | 4 / 3 | Coordinator CLI据置。Domain CRUD・Executor操作の接続は各Ownerへ追従 |
| `cli/doctor.ts` | 1 / 1 | Coordinator CLI据置。Domain CRUD・Executor操作の接続は各Ownerへ追従 |
| `cli/options.ts` | 5 / 3 | Coordinator CLI据置。Domain CRUD・Executor操作の接続は各Ownerへ追従 |
| `cli/recovery-report.ts` | 4 / 2 | Coordinator CLI据置。Domain CRUD・Executor操作の接続は各Ownerへ追従 |
| `cli/request.ts` | 2 / 2 | Coordinator CLI据置。Domain CRUD・Executor操作の接続は各Ownerへ追従 |
| `decision/acceptance.ts` | 6 / 3 | 判断記録・局所適用はDomain、発行Authority／横断受入調停はCoordinator |
| `decision/external-send-consent.ts` | 26 / 8 | 送信Policy値はDomain設定、同意・Grant・技術実行はExecutor。Host端末技術は既存Owner |
| `decision/external-send-grant.ts` | 41 / 23 | 送信Policy値はDomain設定、同意・Grant・技術実行はExecutor。Host端末技術は既存Owner |
| `decision/external-send-policy.ts` | 14 / 8 | 送信Policy値はDomain設定、同意・Grant・技術実行はExecutor。Host端末技術は既存Owner |
| `decision/lifecycle.ts` | 22 / 12 | 判断記録・局所適用はDomain、発行Authority／横断受入調停はCoordinator |
| `decision/records.ts` | 9 / 4 | 判断記録・局所適用はDomain、発行Authority／横断受入調停はCoordinator |
| `decision/request.ts` | 9 / 5 | 判断記録・局所適用はDomain、発行Authority／横断受入調停はCoordinator |
| `decision/transition.ts` | 5 / 3 | 判断記録・局所適用はDomain、発行Authority／横断受入調停はCoordinator |
| `decision/types.ts` | 13 / 13 | 判断記録・局所適用はDomain、発行Authority／横断受入調停はCoordinator |
| `execution/advice.ts` | 55 / 23 | Executor切出し対象。技術下位Ownerを再利用、宣言単位の最終配置はFで確定 |
| `execution/authority.ts` | 192 / 76 | Executor切出し対象。技術下位Ownerを再利用、宣言単位の最終配置はFで確定 |
| `execution/controller.ts` | 110 / 30 | Executor切出し対象。技術下位Ownerを再利用、宣言単位の最終配置はFで確定 |
| `execution/diagnostics.ts` | 151 / 51 | Executor切出し対象。技術下位Ownerを再利用、宣言単位の最終配置はFで確定 |
| `execution/kernel-lock.ts` | 13 / 13 | Executor切出し対象。技術下位Ownerを再利用、宣言単位の最終配置はFで確定 |
| `execution/lease.ts` | 6 / 6 | Coordinatorの長期実行排他。短期保存Lockとは別 |
| `execution/observation.ts` | 20 / 14 | Executor切出し対象。技術下位Ownerを再利用、宣言単位の最終配置はFで確定 |
| `execution/operation.ts` | 177 / 79 | Executor切出し対象。技術下位Ownerを再利用、宣言単位の最終配置はFで確定 |
| `execution/preparation.ts` | 100 / 57 | Executor切出し対象。技術下位Ownerを再利用、宣言単位の最終配置はFで確定 |
| `execution/process-safety-state.ts` | 13 / 12 | Executor切出し対象。技術下位Ownerを再利用、宣言単位の最終配置はFで確定 |
| `execution/recovery.ts` | 90 / 58 | Executor切出し対象。技術下位Ownerを再利用、宣言単位の最終配置はFで確定 |
| `execution/request.ts` | 2 / 2 | Executor切出し対象。技術下位Ownerを再利用、宣言単位の最終配置はFで確定 |
| `execution/result.ts` | 62 / 43 | Executor切出し対象。技術下位Ownerを再利用、宣言単位の最終配置はFで確定 |
| `execution/settlement.ts` | 11 / 10 | Executor切出し対象。技術下位Ownerを再利用、宣言単位の最終配置はFで確定 |
| `execution/types.ts` | 4 / 4 | Executor切出し対象。技術下位Ownerを再利用、宣言単位の最終配置はFで確定 |
| `execution/validation.ts` | 18 / 18 | Executor切出し対象。技術下位Ownerを再利用、宣言単位の最終配置はFで確定 |
| `index.ts` | 0 / 0 | 公開表に従い分配。旧Rootを互換barrelとして残さない |
| `objective/composition.ts` | 2 / 2 | 局所定義検査はDomain、受付・実行・Replan調停はCoordinator |
| `objective/execute.ts` | 16 / 8 | 局所定義検査はDomain、受付・実行・Replan調停はCoordinator |
| `objective/plan.ts` | 5 / 1 | 局所定義検査はDomain、受付・実行・Replan調停はCoordinator |
| `objective/replan.ts` | 7 / 1 | 局所定義検査はDomain、受付・実行・Replan調停はCoordinator |
| `objective/request.ts` | 6 / 2 | 局所定義検査はDomain、受付・実行・Replan調停はCoordinator |
| `objective/types.ts` | 13 / 13 | Objective／Milestone値はDomain、計画実行依存はCoordinator |
| `selection/resolve.ts` | 7 / 5 | 設定値・検査はDomain ai-selection、実行BindingはCoordinator／Executor |
| `selection/types.ts` | 6 / 6 | 設定値・検査はDomain ai-selection、実行BindingはCoordinator／Executor |
| `selection/validation.ts` | 4 / 4 | 設定値・検査はDomain ai-selection、実行BindingはCoordinator／Executor |
| `state/create.ts` | 2 / 1 | Domain状態・Query／保存相関へ。実行Lease構成・横断調停はCoordinatorに残す |
| `state/initialize.ts` | 2 / 2 | Domain状態・Query／保存相関へ。実行Lease構成・横断調停はCoordinatorに残す |
| `state/observation.ts` | 3 / 1 | Domain状態・Query／保存相関へ。実行Lease構成・横断調停はCoordinatorに残す |
| `state/persistence.ts` | 11 / 11 | Domain状態・Query／保存相関へ。実行Lease構成・横断調停はCoordinatorに残す |
| `state/projection.ts` | 17 / 12 | Domain状態・Query／保存相関へ。実行Lease構成・横断調停はCoordinatorに残す |
| `state/query.ts` | 4 / 4 | Domain状態・Query／保存相関へ。実行Lease構成・横断調停はCoordinatorに残す |
| `state/request.ts` | 3 / 3 | Domain状態・Query／保存相関へ。実行Lease構成・横断調停はCoordinatorに残す |
| `state/result.ts` | 5 / 5 | Domain状態・Query／保存相関へ。実行Lease構成・横断調停はCoordinatorに残す |
| `state/retirement.ts` | 2 / 2 | Domain状態・Query／保存相関へ。実行Lease構成・横断調停はCoordinatorに残す |
| `state/settlement.ts` | 5 / 5 | Domain状態・Query／保存相関へ。実行Lease構成・横断調停はCoordinatorに残す |
| `state/transaction.ts` | 2 / 2 | Domain状態・Query／保存相関へ。実行Lease構成・横断調停はCoordinatorに残す |
| `state/transition.ts` | 7 / 7 | Domain状態・Query／保存相関へ。実行Lease構成・横断調停はCoordinatorに残す |
| `state/types.ts` | 10 / 10 | Domain状態・Query／保存相関へ。実行Lease構成・横断調停はCoordinatorに残す |
| `state/validation.ts` | 30 / 27 | Domain状態・Query／保存相関へ。実行Lease構成・横断調停はCoordinatorに残す |
| `storage/ai-selection.ts` | 9 / 5 | Domain共通保存へ。意味判断を下表のEntity／調停／技術Ownerへ先に分離 |
| `storage/decision.ts` | 15 / 3 | Domain共通保存へ。意味判断を下表のEntity／調停／技術Ownerへ先に分離 |
| `storage/history.ts` | 11 / 9 | Domain共通保存へ。意味判断を下表のEntity／調停／技術Ownerへ先に分離 |
| `storage/lock.ts` | 9 / 9 | Domain共通保存へ。意味判断を下表のEntity／調停／技術Ownerへ先に分離 |
| `storage/state.ts` | 132 / 118 | Domain共通保存へ。意味判断を下表のEntity／調停／技術Ownerへ先に分離 |
| `task/acceptance.ts` | 5 / 5 | DomainのTask／Attempt／Queue値と局所検査、Scheduling／実資源判断はCoordinatorへ分解 |
| `task/dispatch.ts` | 12 / 7 | Coordinator調停／Executor単一試行。Task定義の値はDomainへ抽出 |
| `task/lifecycle.ts` | 11 / 10 | DomainのTask／Attempt／Queue値と局所検査、Scheduling／実資源判断はCoordinatorへ分解 |
| `task/queue.ts` | 5 / 5 | DomainのTask／Attempt／Queue値と局所検査、Scheduling／実資源判断はCoordinatorへ分解 |
| `task/recovery.ts` | 4 / 4 | Coordinator調停／Executor単一試行。Task定義の値はDomainへ抽出 |
| `task/requests.ts` | 12 / 10 | Coordinator調停／Executor単一試行。Task定義の値はDomainへ抽出 |
| `task/scheduling.ts` | 5 / 1 | Coordinator調停／Executor単一試行。Task定義の値はDomainへ抽出 |
| `task/types.ts` | 30 / 30 | DomainのTask／Attempt／Queue値と局所検査、Scheduling／実資源判断はCoordinatorへ分解 |
| `task/validation.ts` | 6 / 6 | DomainのTask／Attempt／Queue値と局所検査、Scheduling／実資源判断はCoordinatorへ分解 |
| `workspace/commands.ts` | 8 / 6 | Domain workspaceの値・保存、Version ControlのGit、Coordinatorの実行調停に分解 |
| `workspace/operations.ts` | 4 / 4 | Domain workspaceの値・保存、Version ControlのGit、Coordinatorの実行調停に分解 |
| `workspace/record.ts` | 9 / 8 | Domain workspaceの値・保存、Version ControlのGit、Coordinatorの実行調停に分解 |

### 2.1 Domainへ移す具体的な宣言と分解点

| 宣言・現在のまとまり | Domain側の置き先 | 移さない部分／理由 |
|---|---|---|
| `CoordinatorObjectivePlan`、`ProjectObjectiveDefinition/Record`、`ProjectMilestoneRecord`と局所検査 | `objective/types.ts, validation.ts, crud.ts` | `CoordinatorObjectiveExecutionDependencies`、Objective全体の実行・再計画はCoordinator |
| `ProjectTaskDefinition`、`snapshotDefinition`、`hasCycle` | `task/types.ts, validation.ts` | `reserveProjectTaskStart`は内部でSchedulerを呼ぶため、そのままDomainへ移さない |
| `ProjectTaskRecord`の業務定義・採用参照 | `task/types.ts, crud.ts` | Attempt・Operation・Authority・cleanupをTaskの編集可能fieldにしない |
| `ProjectTaskStartPhase`、`SingleTaskRecord`の純粋記録、終端元事実 | `attempt/types.ts, validation.ts` | Session、Promise、取消Controller、Home権限、真正MapはExecutor |
| `ProjectQueueEntry/State`、受付世代・同ID結合の値 | `queue/types.ts, validation.ts, crud.ts` | `selectNextOperation`、Lease取得、Owner喪失後の処置はCoordinator。現在の`task/queue.ts`はこれらもimportするため丸ごと移さない |
| `CoordinatorAcceptanceDecisionRecord`等の記録と`applyObjectiveAcceptance/applyMilestoneAcceptance`の局所条件 | `decision/types.ts, validation.ts, crud.ts` | Capability発行・失効、複数対象の受入調停はCoordinator。記録だけで現在認可を代替しない |
| `CoordinatorWorkspace/Candidate`、`CoordinatorIntegrationRecord/ResultRecord`の値・参照 | `workspace/types.ts, validation.ts` | 作成・固定・Merge・削除はVersion Control。実行前選択・WorkspaceとTaskの調停はCoordinator |
| `WorkspaceCommand/View`、`workspaceView` | Domainの業務Query・操作型へ分解 | `executeWorkspaceCommand`はQueue必須・Git・認可・保存を合成する。単純な移動ではCore独立にならない |
| `AiSelectionRole/Choice/Config/Snapshot`、`validateAiSelectionConfig`の設定検査 | `ai-selection/types.ts, validation.ts, resolve.ts` | `ExecutionSelection/TaskExecutionSelections`の実行固定・現在AuthorityはCoordinator／Executor。設定値自体はAuthorityではない |
| `CoordinatorUnifiedSnapshot/StoredTask/TaskSettlementFact`の保存値、`decode*Snapshot` | `state/types.ts, validation.ts` | 生きたController／Hostを入力とする処理をdecodeへ混ぜない |
| `projectCoordinatorTaskSettlement`、`associateCoordinatorTaskOperations`等 | `attempt/query.ts`と`state/validation.ts`へ役割別に配置 | 終端Booleanを複製保存せず、元Operationと受領から導く。元unknownは保持 |
| `assertCoordinatorSnapshotTransition`等の全区画相関 | `state/validation.ts` | Taskの局所遷移、Scheduler、技術資源の現在観測とは分ける |
| `createCurrentCoordinatorPersistencePorts/createCoordinatorSnapshotPersistencePorts` | 共通保存への接続部分のみDomain | 実行Leaseも同時構成する現在のFactoryはCoordinatorに残し、Domainの必須依存にしない |
| `readRepositoryAiSelection/saveRepositoryAiSelection` | `storage/ai-selection.ts` | 保存結果の型と設定意味はai-selection側。AI Adapterから汎用JSON解析だけを逆輸入しない |
| `readHistoryFile/updateCoordinatorHistoryOwned`、保存・Lock操作 | `storage/history.ts, state.ts, lock.ts` | 履歴へ移す資格・Task終了判断は意味Owner、物理出版順序は保存Owner |
| `Activity*`、`RuntimeActivity*`、投影・Cursor・検査 | `state/query.ts`と必要な型／検査 | 実行実績の分析正本はExecution Intelligence。Task進行の別正本を作らない |

現在のTask定義は `id/objectiveId/dependencies/allowedPaths/conflictKeys` であり、名前・目的本文等は持たない。添付のPlan例にある`planId/sourceDocuments/goal/acceptanceCriteria`は正式Schemaではない。新しい属性を既存Schemaにあるものとして扱わず、Core利用に必要な最小契約を正式設計で確定する。

現行Planは`milestoneAcceptanceCriteria/objectives/tasks`の集合である。AfterはDomainのObjective／Task Graphを共通Planとして保存・参照し、Coordinatorが同じ改訂をAdmissionに使う。別の実行Planを保存し直さない。`savePlan/queryPlan`をまとまった定義の保存・取得候補とし、Task CRUDと同じ正本・同じ改訂検査を使う。Plan保存自体はQueue受付・実行開始・Authority発行ではない。

## 3. 具体的なSource After候補

以下は今回扱う追加・移管部分。既存Topic／Meeting／Artifact等は省略する。空Fileを一括作成しない。小さい局所遷移は`crud.ts`へまとめ、型名だけを理由に一Fileずつ作らない。

```text
40_Develop/domain-model/src/
├ index.ts                    公開APIを実Ownerから明示export
├ objective/
│  ├ types.ts                 共通Plan・Objective・Milestone・受入基準
│  ├ validation.ts            定義と参照の検査
│  └ crud.ts                  作成・編集・削除・局所判断適用
├ task/
│  ├ types.ts                 業務定義・依存・定義改訂
│  ├ validation.ts            DAG・Path値・参照の検査
│  └ crud.ts                  定義操作。実行中の定義変更は拒否
├ attempt/
│  ├ types.ts                 試行の記録・出所・結果／回復参照
│  ├ validation.ts            観測値と相関の検査。資源観測はしない
│  └ query.ts                 Task状態・終了・受領の導出
├ decision/
│  ├ types.ts                 判断内容・対象改訂・適用記録
│  ├ validation.ts            許可された選択肢・対象・局所遷移
│  └ crud.ts                  記録と局所適用。Capability発行なし
├ workspace/
│  ├ types.ts                 論理Workspace／固定Candidate／統合参照
│  ├ validation.ts            Git観測結果との値相関
│  └ crud.ts                  論理記録の保存・取得。Git実行なし
├ queue/
│  ├ types.ts                 受付・対象・状態・世代
│  ├ validation.ts            受付ID・対象改訂・遷移の検査
│  └ crud.ts                  受付と局所更新。Task選択・Dispatchなし
├ ai-selection/
│  ├ types.ts                 Repository設定と型付き結果
│  ├ validation.ts            JSON値のSchema・重複・不正入力
│  └ resolve.ts               role/workTypeの設定解決
├ state/
│  ├ types.ts                 一つのSnapshotの閉じた値契約
│  ├ validation.ts            区画間参照・世代・受領の相関
│  └ query.ts                 Core読取り・統合した状態投影
└ storage/
   ├ state.ts                 bounded読取り・CAS・物理出版・読戻し
   ├ history.ts               履歴出版・保持期限・pending整合
   ├ lock.ts                  移管した短期保存Owner
   ├ decision.ts              判断記録の既存保存方式
   ├ ai-selection.ts          設定CAS保存
   ├ root-and-lock.ts         既存Root／OS Lock基盤を再利用
   ├ bounded-file-snapshot.ts 既存安定Readerを再利用
   └ …                        その他既存の保存Fileは今回削除しない
```

Folder内のbarrel、`public-*.ts`、空の`model.ts`は追加しない。StorageのFile数をPackage全体で5へ制限しない。Domainの既存汎用保存には別のConsumerがあるため、Coordinatorの5 Fileだけで上書きしない。

DomainのAttemptは記録モデルであって実行機能ではない。Executorの型名と二重に同じ状態機械を実装せず、Executorが返す非秘密の技術観測を対応する純粋値として記録する。

### 3.1 AI Adapterとの循環を作らない

AI Adapterは現在、Catalog・Provider・Codex／Claudeの検査からDomainのplain-data機能を利用している。したがってDomainへ移した設定ResolverからAI AdapterのRootを実行値importすると循環する。現在のselection/types.tsにもAI Adapter型への参照があるため、File移動だけでは完了しない。

Domainは設定の形状・role/workType解決を所有し、Providerの実行能力・Model Catalogの正本はAI Adapterが維持する。信頼したHost構成が既存Catalog APIの非秘密データを取得し、必要な最小の値をDomainの設定検査へ渡す方式を候補とする。Browser／MCP入力からCatalog自体を偽造させず、未照合を設定検査成功にしない。DomainにProvider起動・Catalog再定義・汎用Resolver登録を追加しない。実行Admissionでも現在の技術対応と固定Selectionを改めて照合する。正確な最小入力型はAPI署名固定時に確認し、型だけの参照と実行依存を別に検査する。

## 4. 単一保存と状態の正本

保存物理構成の第一候補は以下。Path・Schemaの有効化は段階Eの判断前であり、今回は作成・移動しない。

```text
.crdd/
├ config/ai-selection.json        Repositoryごとのモデル選択（既存位置）
└ domain-model/
   ├ state.json                  現在状態の単一正本
   ├ state.lock                  既存短期排他の移管先候補
   ├ state.pending.json          保存中だけ。業務Queueではない
   └ history.jsonl               完了要約。正式Evidenceとは別
```

旧統合Schema `crdd-coordinator/current-state/v5`の名前だけを変えず、[固定した分解対応](../../../06_Architecture/Details/domain-model/05_Runtime_Domain.md#runtime-domain-storage)に従ってSourceを`crdd-domain/runtime-state/v1`へ切り替える。定義はprojects、技術行はmanagedExecutionsに一度だけ保持し、既存の単一保存・全区画CASを維持する。既存実データの移行と保存先変更は今回実行しない。

| 正本の意味区画 | 現在のfield／型 | Afterの意味Ownerと更新境界 |
|---|---|---|
| Repository結合・全体改訂 | revision、previous、repositoryBinding、repositoryBindingId、intakeEpoch | Domain state／storage。Bindingの二表現を無根拠に一つへ畳まない |
| Objective・Milestone・Task定義 | projects内のdefinitions、acceptanceCriteria、dependencies等 | 各Domain。Task本体は一箇所。Automation側にPlanを複製しない |
| Taskの実行参照 | attemptId、operationId、authorityBindingId、startPhase、retryCount等 | Attempt値＋Coordinator更新規則。実行中は定義の改訂・削除を拒否 |
| 受付 | queueEntries、intakeBindings、singleTask | Domain Queueが保存。Coordinatorが選択とClaimを判断 |
| Workspace・統合 | workspaces、results | Domain Workspace値。Git EffectはVersion Controlの既存Owner |
| 実行・回復 | operations、unresolvedRecoveries、leaseEvidence、leaseIntents | 技術観測と実行排他の意味OwnerはExecutor／Coordinator。Domainは純粋な閉じたSchemaと参照を検査・保全 |
| 判断 | acceptanceDecisions、decisionRecoveries | Domainの判断記録。現在認可・Capability有効性は別Ownerで再確認 |
| 結果受領 | resultReceipts、pendingDeliveries | 正本は各一箇所。受領と回収を同じBooleanへ畳まない |
| 履歴搬送 | historyPending、元Snapshot改訂とHash | 保存Ownerが出版整合。終端資格は意味Owner。未解決を保持期限で消さない |

Core／Automationという名前の二つのstateファイルは作らない。履歴へ移すときも未解決参照・pending・他区画からの参照を確認する。通常履歴30日・設定可能の既存方針を維持し、今回新しい件数上限を追加しない。

### 4.1 TaskとAttemptを分ける

- Taskは「何を、どの依存と範囲で行うか」の正本。既存定義と判断対象を持つ。
- Attemptは「そのTaskに対して行われた一回の実行」の参照と観測。Taskの編集入力でOperationやcleanupを書き換えない。
- 現在のTask状態にあるstarting／running／cleanup_pending／recovery_requiredは、実行観測との対応を持つ投影である。Coreの一般更新APIから直接設定させない。
- 人間・外部AIの作業結果は既存の文書・判断・根拠参照へ記録する。管理下Attemptの終了、Effect不能、cleanupの根拠へ昇格しない。新しい報告SchemaやAPIを追加せず、未知の報告出所を管理実行に補完しない。
- 後続確認では汎用の報告操作を追加せず、既存判断・根拠ID・局所受入をDomainへ移す方針へ整理した。管理Taskの完了条件を根拠IDだけで代用しない。正式な確認結果と限界はRuntime Domain正本§4.1を参照する。

### 4.2 更新範囲と同一CAS

| 操作 | 更新可 | 同じ保存で保全・再検査するもの |
|---|---|---|
| Objective／Taskの作成・編集 | 対象定義とその改訂・依存 | Queue／Attempt／判断が参照する対象改訂。参照中の変更は拒否 |
| Entity削除 | 非参照・非実行中の対象のみ | 依存Task、固定Candidate、受領、未解決義務。Cascade削除はしない |
| AI Selection設定保存 | 設定Fileだけ、既存expected identityのCAS | 実行へ固定済みのSelectionは不変。設定更新で受付済み選定を再計算しない |
| Queue受付 | 新受付と受付世代・対象参照 | 定義改訂、Workspace、同IDのHash。AcceptedをRunningにしない |
| Queue Claim／開始・終端 | Domainが局所Claim条件・世代更新、Coordinatorが実行選択と横断許可を判断 | 最新Task改訂、Lease、Authority、旧実行のEffect不能、回復義務。Coreの任意JSON CRUDには公開しない |
| 判断適用 | 判断記録・対象の局所結果 | 現在認可、対象改訂、二重適用、受領・関連Taskを一回で照合 |
| Operation／回復更新 | 対象技術記録と必要な相関 | 他Task・Queue・元Recovery Identity。unknownを成功へ書き換えない |
| 履歴化・現在集合から除去 | 閉じた対象と履歴搬送参照 | 未解決Recovery／結果配送／物理Lock・一回性を保全 |

公開`saveState(anySnapshot)`や汎用`updateTask(partial)`は作らない。外部JSONから任意区画更新・状態変更・保存Context生成をできない境界とする。

保存の流れは「現在認可確認 → 既存短期Lock → bounded再読 → expected改訂／Hash照合 → 操作Ownerの局所条件と全体相関 → 既存pending出版 → atomic replace／読戻し → Lock解放確認 → 型付き結果」。AIや長時間処理中はLockを保持しない。競合は自動再送せず競合結果を返す。

Core操作では保存値の相関を検査するが、DockerやProviderへの照会は行わない。既存Automation区画を安全に保全できなければ当該更新を拒否する。「解消のための暗黙Recovery」は追加しない。

## 5. 真正証拠と保存の境界

`state/transaction.ts`や巨大WriterをそのままDomainへ移すと、Domainが実行Lease・Controller・Hostに依存する。次の分離を移管の必要条件とする。

| 現在の物理証拠 | 保存Ownerに残すもの | Executor／Coordinatorが所有するもの |
|---|---|---|
| settlements: authentication_unknown_closure | before／candidate／物理結合・used一回性 | 同じ元Ownerの現在確認、限定終了の成立観測 |
| settlements: runtime_repair | publicationのFile Identity・bytes、目的の値・一回性 | 修復の現在Authority・同じ技術Owner |
| settlements: current_completion | 元版、履歴File同一性、候補、一回性 | Effect不能・回収終了と終端結果の真正根拠 |
| settlements: current_delivery | 元版、履歴同一性、候補、一回性 | 同じ結果・Consumerの受領観測。保存をACKにしない |
| settlements: current_history | checkpoint／publish／confirmed、履歴とpending同一性、一回性 | 終端資格・元回復Ownerの確認 |
| initializations | boundaryIdentity、payloadHash、publicationIssued | 初期化と通常実行のAuthorityを混ぜない |
| historyAttempts | lineHash、issued、before／after、保持期限・観測時刻の出版相関 | Taskの業務成功・物理回収を履歴だけから生成しない |
| liveSettlements／activeLeases | 保存Mapへ複写しない | 元Controller／Hostのobject同一性、実行Leaseの生存と解放 |

`used=true`は既存と同じくOwner確認・I/Oより前に消費し、失敗しても未使用へ戻さない。Contextを公開CRUDの入力やJSONへ変換しない。DomainとExecutorへ同じ真正証拠を二重登録しない。

既存の同期`assertOwner`／`revalidate`結合は、I/O前後の現在確認を失わない形で維持する。新しいcallback登録Frameworkや汎用検証Pluginは作らない。値のValidationはDomain側から静的に呼び、実行能力の検査は元Ownerが行う。現在の借用Repository型への`ReturnType<Executor関数>`依存はDomainへ持ち込まず、既存の検証済みRootと保存結合の最小値へ縮める。実装時に五Contextそれぞれの呼出し順・fresh確認・参照を照合できるまでは旧処理を撤去しない。

`committed-json.ts`の既存上限262,144byteとsidecar契約を、巨大な統合Snapshotへ無条件に流用しない。既存のSnapshot出版保証を維持し、共通化の名目で新しい第二の確定方式を追加しない。

<a id="runtime-domain-fixed-storage-uses"></a>

### 5.1 残る十九固定用途の入力・観測・保存差分

以下は`d43e623e3`の本番callback母集団に対する固定契約であり、実装済みの表示ではない。共通する保存側入力は検証済みRepository scope・binding、出力は既存の固定結果封筒とする。短期Owner取得→fresh読取り→表の位置で観測→候補検査→CAS・読戻し→解放を一つの保存Ownerへ閉じる。Owner・Kernel handle・任意Snapshot callback・raw WriterはPackage境界へ公開しない。表の用途を一つの汎用dispatcher・新Registryへ集約しない。

| 利用側の固定用途 | 用途固有の値入力 | Coordinatorに残す同期観測・判断と位置 | 保存で変更できる区画／結果 |
|---|---|---|---|
| Queue実行対象選択 | 閉じた選択ID、固定理由、対象ID・期待世代・次状態・再開条件 | fresh Queueから既存優先順位で選択。Domainは優先順位を再判断しない | 対象scheduled Queueのqueued／waiting_foregroundと一世代だけ。選択値又はnull |
| Queue更新 | Queue ID・期待世代・次状態・再開条件・結果参照・Lease有無 | 元の値検査後に私有Mapを一回借用。kind／Root／binding／Project／Queue一致後だけ同じ実体の生存観測 | 同じQueue一件と一世代。元Owner不一致・不正遷移は拒否 |
| exact回復後Queue | Queue ID・期待世代・同じ回復ID | 回復成立と再開処置の発火はCoordinator。Domainはfresh値のexact条件を再検査 | ownerなし・exact_recoveryの同じQueueだけqueued候補。実回復完了・実行許可の証明ではない |
| QueueのLease解放確定 | Queue ID・期待世代・元Owner世代 | 値検査後、同Rootの資源不存在→境界再確認→既存解放証拠。unknownは不存在でない | 同じQueueのOwner除去と一世代。未終了intent、回復済み証拠、欠測は拒否 |
| 単発Task受付 | 発行時epoch・閉形式Queue一件 | Provider・Lease・時計の観測なし。呼出し側が受付を発火 | 同じ入力の再入場は無書込み。新規だけQueue／受付結合追加 |
| 単発Task更新 | Queue ID・期待世代・検査済み次記録 | 元位置で実Lease一回借用、相関成立後だけ同実体の生存確認。clean終端末尾だけ時計二回 | 同じQueueと、clean終端時だけ同ID履歴pending置換。元ID・失敗・回復参照保持 |
| 未開始単発Task終了 | Queue ID・期待世代・固定理由 | 値検査後、取得intentなしの確認。成功末尾だけ時計二回 | accepted・Ownerなし一件だけ終了し履歴pending追加。回収完了を捏造しない |
| Lease取得Owner照会 | binding | 実Process死亡を判断しない。fresh intent／Queue値だけ照合 | 無書込み。閉じた取得参照、真正な不存在又は停止 |
| Lease取得予約 | Project／Queue／kind・元Owner世代・予約intent | Queue結合と同Identity intentなしの後、実資源不存在→Root実体観測→保存要求記録 | 予約intent追加。保存拒否時も元のexact回復IDを保持 |
| Lease取得確定 | 元予約intent・同じ物理Identity・Owner／Process ID | 元intent一致の後に同じ実Directory実体を再観測 | lock_owned intentとacquired証拠を一体保存。実Lease発行はCoordinator |
| Lease解放pending | 同じOwner／kind／Project／Queue・物理Identity・回復ID | 元lock_owned intent一致。実解放はこの保存後のCoordinator | 同じrelease_pending intent追加。保存失敗後も一回証拠を復活させない |
| Lease解放確定 | 元intent・物理Identity・Owner／Process ID・回復ID | 実解放と不存在はCoordinatorが先に観測。fresh release_pendingを保存時に再照合 | 同じintent除去とreleased証拠追加。公開解放成功は保存／解放確認後 |
| owner-loss初回照会 | Project／Queue／kind | 値結合後にRoot実体観測。Process生死は短期保存Ownerの外で確認 | 無書込み。対象intent集合・Queue元版・Root相関だけ |
| intentなし旧Lease終了 | 元Queue世代／Owner・回復ID | released証拠・intentなしの後に実資源不存在を再観測 | 同じQueueだけowner_lossの回復待ちへ。完了へは変えない |
| 回復intent予約 | exact元intent集合・元Queue・Root相関・pending | 元位置でRoot実体を観測、元集合／Queue全文を比較 | 同じpendingは無書込み、異なるpendingは拒否。新規同intentだけ追加 |
| 回復確定 | 元intent／Queue・pending・Root／物理相関・回復ID | 実Process不存在・物理回収はCoordinator。保存時にRoot実体と実資源不存在を再観測 | 同対象intent除去、終了証拠、必要なQueueの回復待ち更新を一CASへ |
| 終了履歴pending生成 | 評価時刻 | 対象ごとの元位置で実Lease不存在・履歴確定を有限観測。非対象では観測しない | 閉じたQueue／adoptionの要約だけ追加。既存pendingを保持 |
| 履歴確認後退役 | 評価時刻・新epoch生成の有限操作 | 元位置で履歴出版→対象ごとの閉鎖義務／履歴再読→除去条件。epochは必要時だけ生成 | 適格Queue／証拠／判断等だけ除去し受付世代切替。参照中結果・未解決状態を保持 |
| pending履歴搬送 | 評価時刻 | pendingありの場合だけ履歴出版、各行を同じOwnerで再確認 | 確定行の件数を返しpending除去。Queue・Project・回復義務は変更しない |

実Lease観測は借用0／1回・生存0／1回を用途別の元制御順で維持する。単発更新では元実装が前状態検査より先に借用するため、前状態不一致でも借用一回／生存零回を維持する。Domainへ渡す借用値はkind、Repository Root、binding、Project ID、Queue ID、Owner世代の六fieldだけ。同じ実体はCoordinatorの呼出し局所変数で保持し、別操作へ再利用しない。生存の返却は`=== true`だけを受理し、Promise／thenable／truthy値を成功にしない。

時計は用途固定の無名同期`now:()=>number`とし、clean終端又は未開始終了の候補末尾で、表示時刻→履歴検査用時刻の順に二回呼ぶ。拒否・非clean・同値確定済み再入場では零回。時刻観測・Owner確認の例外は既存の外側Store失敗と解放へ接続し、未使用へ戻さない。

候補接続のSource更新では、上表のTask／Queue七に続き、Lease九を`domain-model/src/attempt/lease.ts`、履歴三を`domain-model/src/state/history.ts`へ配置する。基準版の残十九を含む全三十二用途が固定候補へ接続されるが、物理取引はまだCoordinator内部に残る。取得予約のmarkは資源不存在・Root投影の同期閉形式確認後だけ一回、履歴出版はCoordinatorの元の位置で成功後に候補へ進む。Root投影は生Statsでなく二field、履歴再読はrecorded／expiredだけ受理し、非同期又は契約外の値を成功にしない。観測型・Map・Lockを一般化しない。

### 5.2 原子的に移す物理閉包

固定用途の接続が閉じた後、短期保存Owner、Reader／Writer、history I/O、五Context、initializations、historyAttempts、Module-private取引を同じDomain保存Ownerへ移す。借用Repositoryの実行Package関数型への依存は、既存の検証済みRootと用途固定の現在観測へ置換する。新旧Map／Writerの併存や、先にraw取引をRoot公開して後から縮める手順は採らない。長期Lease、Host／Home、Process生死、Docker・ProviderのEffectと回復判断はCoordinator／既存専門Ownerに残す。

## 6. Package公開APIの全数処置

全73項目を以下に分類する。矢印は候補であり、今回exportを変更していない。型の細分化は操作の所属に従い、名前だけの互換exportは残さない。

| 現在の公開項目 | After処置 |
|---|---|
| readRepositoryAiSelection、saveRepositoryAiSelection、inspectAiSelectionChoice | Domain設定APIへ |
| AiSelectionReadResult、AiSelectionSaveResult、AiSelectionChoice、AiSelectionConfig、AiSelectionRole、AiSelectionSnapshot | Domain設定型へ |
| openTaskSession、runTask、inspectSingleTaskCommand、SingleTaskCommand、TaskSessionContext、TaskSession、TaskRunResult、ExecutionSelection | 単一試行はExecutor、Task受付／選定固定はCoordinator。現行Session丸ごとのDomain移管は禁止 |
| initializeProject、ProjectInitializationRequest | Domain初期化とCoordinator実行設定を分解。Core初期化にProvider選定・認証を要求しない |
| runObjective、CoordinatorObjectiveRequest、inspectCoordinatorObjectiveRequest、COORDINATOR_OBJECTIVE_INTAKE_CONTRACT | Coordinatorの計画実行受付に残す。Domainの目的作成とは別操作 |
| submitDecision、CoordinatorDecisionRequest、inspectCoordinatorDecisionRequest、COORDINATOR_HUMAN_DECISION_CONTRACT | Domain判断記録／局所適用とCoordinatorの実行再開・取消を分解 |
| acceptResult、inspectCoordinatorWorkspaceResults、isCoordinatorObjectiveProjectionCorrelationValid | Domain受入の局所条件＋Coordinatorの横断品質・実行相関へ分解 |
| queryState、CoordinatorStateQuery、CoordinatorStateQueryResult、CoordinatorProjection、inspectCoordinatorStateQuery、inspectCoordinatorStateQueryResult、isCoordinatorProjectionSemanticallyValid | Domain状態Query／型／検査へ。実行の次候補選択はCoordinator、Queryから実行しない |
| executeWorkspace、WorkspaceCommand、WorkspaceView、CoordinatorWorkspaceResult、inspectWorkspaceCommand | Domain論理CRUD／Query、VC Git操作、Coordinator実行調停に分解 |
| queryActivity、ActivityRepository、ActivitySource、RuntimeActivityEvent、RuntimeActivityObservation、RuntimeActivityRequest、parseRuntimeActivityObservation、inspectRuntimeActivityObservation | Domain統合Reader／値へ。EIの分析APIと実績の正本は維持 |
| readRepositoryNetworkPolicies、RepositoryNetworkPolicies | DomainのRepository設定読取りと、ExecutorのProvider固定通信先との合成を分離 |
| observeClientPrincipal | Access Managementの既存認証済み主体観測へ。DomainがPrincipalを発行しない |
| isSupportedNodeRuntime | 実行・Host入口側の技術検査へ。Domain CRUDの起動依存から外す |
| getCapabilities、COORDINATOR_MAXIMUM_OBJECTIVES、COORDINATOR_MAXIMUM_TASKS、COORDINATOR_PUBLIC_RUNTIME_CONTRACT | Coordinator実行能力／上限契約。Domainの一般Entity数へ転用しない |
| getAuthenticationStatus、authenticateProvider、AuthenticationRequest、AuthenticationResult | Executorが隔離Lifecycleを調整しAI AdapterがProvider認証差を所有。Domainから呼ばない |
| diagnoseEnvironment、EnvironmentRequest、EnvironmentResult | 実行環境診断へ。Domain CRUDの必須条件にしない |
| recoverExecution、restartDockerForRecovery、repairDockerRuntime、retainRepair、RecoveryRequest、RecoveryResult、RuntimeRepairResult、ExecutionContext | Executor／既存Docker Isolation／Platform Accessへ責務別に接続。Coordinatorは必要時に調停するのみ |

### 6.1 Domainの新しい利用者API候補

既存にないCore操作を単に旧`runObjective`等の改名として提供しない。次の最小契約を正式設計で固定してから実装する。すべてPackage Rootから直接公開し、汎用OperationsSetや中継Factoryは追加しない。

| API候補 | 入力と返却値の要点 | 認可・I/O・取消 |
|---|---|---|
| savePlan／queryPlan | 定義集合・期待改訂 → 共通Planと改訂／DAG不正／参照中 | Coordinator不要。Task CRUDと同じ定義正本を使用し、実行受付はしない |
| createObjective／updateObjective／deleteObjective／queryObjectives | 定義・期待改訂 → 確定値と改訂、又は競合／参照中／観測不能 | 現在内容権限をSurfaceで確認し処置直前に再確認。有限の保存I/Oのみ |
| createTask／updateTask／deleteTask／queryTasks | 既存Task定義・依存・期待改訂 → 値と改訂／不正DAG／参照中 | 実行状態やcleanupを更新入力に含めない |
| recordDecision／queryDecisions | 対象改訂・判断・根拠参照 → 適用記録／不一致 | 現在認可を必要とし、保存済みPrincipalから権限を復元しない |
| queryAttempts | Task参照 → 出所・観測・結果／回復参照 | 読取り専用。再実行・回復・取消を行わない |
| queryWorkspaces／保存用の内部論理更新 | 値・Git観測参照 → 論理記録 | Git実操作はVersion Control。任意JSONのGit成功報告は受理しない |
| enqueueOperation／queryQueue | 対象定義改訂・Request ID／Hash → 同ID受付／競合 | Acceptedのみ。局所canClaim／claimはDomain、選択・実行権限確認・DispatchはCoordinator。任意JSONからClaimさせない |
| readRepositoryAiSelection／saveRepositoryAiSelection | 設定・expected identity → 確定設定／競合等 | 設定の既存CAS。Catalog技術照合はAI Adapter、固定選定とAuthorityは別 |
| queryRuntimeState／queryExecutionStatus | 許可対象・改訂／Cursor → observed／absent／unknownを区別した投影 | Coreの現在QueryはCoordinatorなし。EIは実績読取りだけに利用 |

結果は既存の型付き結果方針を使い、正常・競合・拒否・観測不能を区別する。保存成功だけでTask実行成功・取消完了・資源回収を返さない。正規化された結果へ元のexact回復参照を保持し、認可された利用側だけへ返す。

有限の同期CRUDには存在しないProcess取消契約を追加しない。保存発行後の取消をrollbackへ読み替えず、読戻し不明ならunknownと同ID再照会へ接続する。実行取消はExecutor／Coordinatorの同ID操作、技術資源の回収は既存Ownerの責務である。

## 7. 利用側の追従表

| 現在の利用側 | Core接続への処置 | 任意実行・検証側に残るもの |
|---|---|---|
| MCP request/authentication.ts | Domain CRUDと認可構成。活動ReaderのCoordinator静的依存を外す | 認証済み主体はAccess Management |
| MCP tools/task.ts、workspace.ts、execution-status.ts | 定義CRUD・論理QueryをDomainへ。単なるoptionalプロパティで独立成立としない | 実行・取消・Recovery・Git Effect接続は各Owner |
| MCP request/server.ts、bin、template/tools/crdd-mcp-server.ts | Core構成だけでload・起動可能にする。配布入口の静的Coordinator importも対象 | 自動実行を明示導入した構成だけCoordinatorを接続 |
| WB shared/view/types.ts、validation.ts | Domain値・投影へ型と検査を移す | 実行能力の有無を全Coreの故障扱いにしない |
| WB server/routes/repository-view.ts、shared-view.ts | 設定・状態読取りをDomainへ | Provider固定通信設定の合成をCore GETに必須化しない |
| WB server/routes/ai-selection.ts、server/ai-selection/projection.ts | Domain設定API＋AI Adapter Catalogに直接接続 | 保存しても実行済み選定は不変 |
| WB server/routes/workspace.ts | Domain論理状態・Version Controlへ。Queue必須の現行結合を分解 | 管理実行中の変更拒否、現在認可は維持 |
| WB server/routes/ai.ts、server/ai-request/types.ts | Optional実行の型とCore表示型を分離 | 現在の助言・Workspace編集は勝手に削除しない |
| WB server/activity/observe.ts、server/presentation/types.ts、project.ts | Domain Query／設定結果へ | EI分析・実績記録の正本は移さない |
| WB client/components/{workspace-panel,ai-request-panel,ai-selection-management-panel}.tsx | Browser向けDomain DTOに追従 | BrowserへExecutor内部権限やHost Pathを渡さない |
| WB bin/workbench-server.ts | Core起動でopenTaskSessionの必須loadを外す | 明示的な実行構成は後続段階で接続 |
| WB scripts/{verify-readonly-ai,verify-workspace-ai,workspace-task-diagnostic}.ts | 新Ownerへの参照と診断責務へ追従 | 実行は別途承認。今回走らせない |
| 直接参照を持つ23試験File | Sourceの新Owner、Root API、読込み閉包、命名・診断契約へ追従 | 旧Source文字列を新版成立根拠として残さない |
| Coordinatorの5 coverage確認scripts | 技術実装の移管先と保証の実発生点に追従 | 名前置換だけでCoverageを成立扱いにしない |

試験参照23件の内訳はCoordinator12、Workbench4、Domain2、AI Adapter・Checker・Execution Intelligence・MCP・Version Control各1。Module参照に加えSource文字列を検査するものも含む。現在の公開APIを使わない試験もあるため、移管対象の試験全数とは主張しない。

## 8. 保持する能力と検証への接続

基準版のStorage分離の判断と検証は[Storage所有権整理](coordinator-storage-ownership-plan.md)を参照する。基準Commitの局所成立を新Packageの成功証拠へ転用しない。とくに通常実行とRecoveryの一回証拠、Owner確認、結果受領と物理回収の分離を残す。

| 保持する能力／反証 | 新Owner・必要な非AI検証 |
|---|---|
| Coordinatorが存在しないCore | import失敗を意図的に与えたMCP／WB構成で起動・Objective／Task／Decision CRUD・再読。単なる未起動では不足 |
| Automation区画のあるCore更新 | 元unknown・Recovery ID・Lease・受領・pendingを保全。Docker／Provider呼出し0を観測 |
| 定義変更とClaimの競合 | 同じSnapshot CASで片方のみ確定。参照中定義・固定選定の上書き拒否 |
| stale／別Repository／別Owner／受付世代差 | 新品扱いせず拒否。同IDを別Taskへ再結合しない |
| 真正Context偽造・再利用・Owner失効 | 五Context・初期化・履歴の各経路で拒否、一回性を失敗後に復活させない |
| 保存途中・応答失敗 | state／pending／historyの元相関を保持。耐久受付と実行開始を区別 |
| Task完了と結果受領 | transient／durable既存方針、Candidate固定／Merge／Promotionは別操作 |
| Core報告と管理実行 | 外部完了報告だけでcleanupConfirmed・Effect不能・実行成功を生成できない |
| Workspace・Git能力 | Dirty・stage保全、明示固定、二親Merge、採否後回収をVC既存試験へ接続。DomainにMerge実装なし |
| AI設定 | 未Commit設定、役割／作業種別、Catalog不一致、CAS競合、固定後不変。外部AI呼出しなし |

L1/L2とFake ExecutorによるL4は実AI不要。L3/L5、Docker実境界、実データ移行は別承認・別結果として残す。今回はSource試験を新実装成立の証拠として実行しない。

## 9. 選ばなかった案と実装前の未確定事項

| 案 | 採らない理由 |
|---|---|
| DomainからCoordinatorを動的importするだけ | 根本の意味Owner・保存・Core CRUDは独立しない |
| Core／AutomationごとのstateとWriter | 参照・世代・受領を跨ぐ整合と回復を増やす |
| 巨大WriterをそのままDomainへ移動 | Controller／Lease／技術意味の逆依存が残る |
| 全Snapshotを編集できる共通CRUD | 実行状態・Authority・cleanupの偽造経路を作る |
| 新規Plugin／Manager／Registryで検査を差し込む | 現在必要な静的なOwner分離を超える。現存の同期Owner確認を再利用する |

実装前に閉じるものは、①新Core CRUDの要求／結果と改訂単位、②既存判断・根拠ID・局所受入の移管対応（新報告Schemaなし）、③五Contextの宣言ごとの依存閉包・fresh検査の搬送、④保存Path／Schema切替とフロントAI移行手順、⑤既存Workbench助言・編集の存続接続である。Source宣言索引だけでこれらを解決済みとしない。

現在、調査・After案作成を止める人間判断はない。既存属性のみで進め、新しい非管理完了機能は追加しない。保存先有効化・機能撤去は具体的な影響を提示する実装前Gateとする。本資料はSource移管完了、Architecture正本切替、全体QA Pass、実AI E2E成功を意味しない。
