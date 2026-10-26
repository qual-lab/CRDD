# Coordinator保存構造と状態所有の再設計計画

- 対象: CRDD v0.22 / CHG-000082
- 変更分類: Architecture / Structure Refactoring。Lifecycle簡略化は構造移管後。
- 基準Source: `81d9647a4`（2026-10-27、先行診断是正をcommit・push済み）
- 状態: Sourceの五File化・対象の分割回帰・独立レビューは完了。全体一括回帰の初回不合格は保持する。
- 正本: [Coordinator詳細設計](../../../06_Architecture/Details/coordinator/01_Architecture.md#storage-state-ownership-redesign)
- 入力: 人間が提示した「Coordinator Storage構造再設計・State Ownership整理方針」。

## 1. 変更経路と停止点

保存統合Bの構造凍結を今回の変更で見直す。以前の凍結を誤りとして消さず、保存形式・Root・CAS・排他・中断時記録の保証は維持したままSource責務の移管を設計する。

初回の着手前整合確認は、Maintenanceの追跡変更、Coding Standardsの操作／保存分離、Quality Assuranceの実装前基準点、および現行Architectureと直接Consumerを対象に行った。保存と実行のlifecycleにまたがるため、一名の読取り専用確認者へ排他・一回使用証拠の専門観点を委譲した。これは完成後の独立レビューではない。

| 経路 | 今回の処置 |
|---|---|
| ArchitectureとQuality | 論理Ownerと物理保存を分離する設計、保持すべき保証、反証試験を定義 |
| 不足／影響確認 | 公開Root、CLI、Workbench、MCP、直接利用側、試験、Traceを移管閉包へ含める |
| 文書確認 | 旧凍結記述と新しい設計案の状態を明示し、リンク・用語を確認 |
| 実装の独立レビュー | Source移管後の固定候補で実行。今回の事前確認から流用しない |
| 準拠・Release監査 | 準拠基準・Release判断を変えないため今回の設計段階では実行しない |
| 人間の判断 | 宣言割当と設計図を完成させた後、Source実装前に設計レビュー |
| 禁止する操作 | AI再送、Docker起動・再起動・試験、保持物の読取り・変更・削除 |

2026-10-27、人間が提示Afterを承認し、宣言ごとの対応を確定して実装するよう指示した。各移管群の意味・利用側・試験を先に確定し、未割当の宣言を推測で動かさない。公開契約・保存Schema・Recovery Identityの変更が必要になった場合は、単なる配置変更と分けて判断へ戻す。

## 2. 棚卸しの現在地

`40_Develop`およびRepositoryの追跡対象候補Sourceを検索した範囲で、`model.ts`は次の三件だけである。過去Evidence、生成物、node_modulesは改名しない。

| Source | 行数 | トップレベル宣言 | 実際の混在と予定処置 |
|---|---:|---:|---|
| `storage/model.ts` | 8,220 | 131 | 保存Schema／Codec、Operation遷移、終了判断、Task投影を保存対象と意味Ownerへ分離し廃止 |
| `state/model.ts` | 1,808 | 56 | 人間判断、Task／Objectiveの型・操作、統合投影、共有値検査を分離し廃止 |
| `selection/model.ts` | 336 | 10 | 共有値型と閉形式検査を分離し廃止。Catalogによる新規選定と保存済み選定の復元を混同しない |

Storage七Fileは合計296宣言、上記二つの非Storage modelを含め合計362宣言。一次抽出一覧は本計画末尾に置く。これは**全宣言の意味的移管先が確定したという数値ではない**。

### 必須の未完了調査

- 各宣言を、純粋な変更候補生成／Lock内の現在版検査／物理I/O／一回使用証拠／型に分類する。
- 各宣言の依存Symbol、直接Consumer、保存対象、意味Owner、移管先、維持条件、既存試験と不足試験を対応付ける。
- 巨大Writer内のローカル関数と閉包を含め、保存と状態判断が混ざる関数を設計上分解する。
- 公開Root経由の間接Consumer、CLI／MCP／Workbench、Trace、文書生成物まで閉包を確認する。
- Git履歴とCHGの基準EvidenceをCapabilityごとに結び直し、過去の件数だけを移管後の成功根拠にしない。

## 3. 目標構造と主要な割当候補

```text
coordinator/src/
├ task/                   Task・Queueの受付／進行／終了と型
├ execution/              Operation・Attempt・観測・終了・回復
├ decision/               人間判断・同意・受入
├ workspace/              作業領域・候補・採用
├ state/                  複数Owner間の整合・統合投影
├ selection/
│  ├ types.ts             設定と固定選定の共有型
│  ├ validation.ts        構造検査・固定選定の相関と内容Identity
│  └ resolve.ts           現行CatalogとRepository設定から新規選定
└ storage/
   ├ lock.ts              既存の短期保存排他と保存Owner
   ├ state.ts             単一state.jsonのSchema・Codec・CAS・確定
   ├ history.ts           履歴Codec・pending・確定・保持
   ├ decision.ts          保護Rootの判断記録・世代・Hash連続性
   └ ai-selection.ts      RepositoryのAI選択設定保存
```

Storageは五Fileに固定する。型と関数を形式的に別Fileへ分けるのではなく、保存対象に付随するSchema・Codec・読戻し・再入場は同じFileへ置く。固定構造と保証が両立しない具体例が見つかれば、勝手にFileやFrameworkを追加せず、対象宣言・理由・代替・影響・試験を提示する。

| 現行宣言／処理 | 意味上のOwnerと候補 | 保存側に維持する部分 |
|---|---|---|
| `requestCoordinatorHumanDecision`、`applyCoordinatorHumanDecision` | 既存`decision/lifecycle.ts` | 統合Snapshotの原子保存 |
| `applyObjectiveAcceptance`、`applyMilestoneAcceptance`、`applyCoordinatorAcceptanceDecision` | 既存`decision/acceptance.ts` | 判断記録とTask更新の同一保存単位 |
| Task定義の固定・循環検査・Task更新 | `task/lifecycle.ts`／既存操作Owner | 世代・元版照合 |
| Objectiveの定義・記録型 | 既存`objective/types.ts` | 保存Codecから型を参照 |
| Task・Queue・単発記録の共有型 | 既存`task/types.ts` | 保存値の閉形式検査 |
| `projectState`、統合Task投影 | 既存`state/projection.ts` | 公開投影と永続Codecを分離 |
| 統合状態の初期構築 | 既存`state/initialize.ts`と純粋部分を照合 | 領域初期化と初回原子保存 |
| 統合値・複数Blockの整合検査 | `state/validation.ts`候補 | 最新版に対する検査は保存Lock内 |
| Plain値・相対Path検査 | 現行意味を保持する責務へ。Domain Model既存関数への単純差替えは禁止 | 入出力Shape・拒否条件の意味差を先に照合 |
| `inspectAiSelectionChoice`等三検査と`hashExecutionSelection` | `selection/validation.ts` | `storage/ai-selection.ts`は設定保存だけ |
| `result-record.ts` | Task結果受領／Workspace候補・採用の既存Ownerへ型・Portを戻す | 永続行のSchemaは`storage/state.ts` |
| `protected-decision.ts` | 物理責務は`storage/decision.ts`へ改名 | 保護Root・既存専用Lock・Generation・Hash連続性を維持 |

`types.ts`は共有型だけを持ち、実行時定数・検証・遷移を集めない。`crud.ts`は本当に登録・取得・変更・削除を所有する場合だけ使用し、既存lifecycleへの転送Fileを増やさない。上表は宣言単位調査の候補であり、未調査Symbolの割当確定ではない。

## 4. 分割前に解く混在箇所

| 対象 | 必要な分解 | 変更してはならない条件 |
|---|---|---|
| `prepareCoordinatorStateWrite`／`commitCoordinatorStateSnapshotOwned` | 純粋な候補・意味の検査と物理確定を区別 | 実際の現在版・Owner・他操作不変の照合を短期Lock外だけで済ませない |
| `withCoordinatorSnapshotOperation`／各Port生成 | Task／Queue等の候補生成と、読取り・CAS・確定を区別 | 関数全体をTaskへ移してFilesystem処理まで流入させない |
| `settlements` | union variantごとに終了根拠と保存試行を分類 | before／candidate、元Owner、exact回復ID、usedの相関を分断しない |
| `initializations` | 初期化の一回使用証拠と保存確定 | 初回版・同一領域・失敗後の再利用禁止 |
| `historyAttempts` | Historyの発行・読戻し・消費と上位Operation相関 | issued・pending・初回時刻を再生成しない |
| `activeLeases`／`acquireCoordinatorSnapshotLease` | 長期実行Leaseの意図保存→物理取得→根拠保存 | 短期保存Lockへ混ぜず、取得順とOwner喪失時の義務を維持 |
| `createCoordinatorSnapshotAcceptanceDecisionStore` | 判断の意味と統合state.jsonへの保存 | 別保護RootのDecision Storeとは名前だけで統合しない |
| History確定とState退役 | History Ownerの確定と、State参照退役の順序を明示 | 履歴だけ成功・State未確定を全体完了にしない |

存続Mapは名前だけで`lock.ts`へ集約しない。短期保存Ownerの`storageOwners`だけがその候補である。実行LeaseのMapや一回使用の終了証拠は、それぞれの意味Ownerと発行・借用・消費・失効まで一組で扱う。

## 5. 保証と検証の対応（設計用）

| 保持するCapability | 移管先 | 必須の正常・反証確認 |
|---|---|---|
| 耐久受付と実行開始の分離 | Task＋State保存 | 保存失敗ではAcceptedなし、受付後Cancel、Owner喪失、同ID照会 |
| Unified Snapshot | Storage State＋State整合 | CAS競合、他Operation変更、改訂飛越、pending不一致、保存後読戻し不明 |
| 短期排他と長期Lease | Storage Lock／Execution | 解放不明、偽Owner、別Root、Lease取得途中停止、二重取得 |
| 同一Ownerの限定是正・再レビュー | Execution＋Task | 過去Effect unknown保持、旧Effect不能、別Task／Owner拒否、許可再利用拒否 |
| 技術終了と上位結果受領 | Execution Result／Task Acceptance | 清掃完了だけでQueue成功にしない、transient／durableの相違、同結果の再保存防止 |
| History確定・保持 | Storage History | pending→読戻し→rename→不存在、同ID別本文、保持中参照の削除拒否 |
| 保護判断 | Storage Decision＋Decision | 世代欠落、Hash不一致、別Root、判断だけ先行確定する反例 |
| AI選択保存 | Storage AI Selection | Expected Identity二回照合、途中認可変更、tmp差替え、rename後不明 |

既存の関連試験は末尾の直接参照元一覧を入口に確認する。各Capabilityと個別の試験名・基準Evidenceの対応はPhase 1の残作業。試験数・前候補の回帰成功を新版の全体成立へ読み替えない。

## 6. 実施順序と完了Gate

1. **宣言割当と設計を完了**: Source Responsibility Map、State Ownership Matrix、lifecycleと通常／Recoveryの収束図、全宣言とConsumer・試験の対応を確定。
2. **人間による設計レビュー**: 添付指定の停止点。ここまではSource挙動を変えない。
3. **構造移管**: 型・遷移・検査・保存を移管し、Root export・利用側・Trace・試験を追従。旧四Fileと旧名参照、三つのmodel.tsを撤去。
4. **Lifecycle簡略化**: 同じ根拠から導く終了規則だけ共用し、通常／回復のAuthorityや実資源処置を統合しない。
5. **固定回帰と独立レビュー**: Source／文書／利用側の意味を確認。実AI・実Docker未実施は明示。

保存形式・通信値を変える移行は、配置変更から分離して事前判断する。過去Evidenceや保持中の試験状態を、新構成に書き換える実装は作らない。

## 7. 事前確認の反映と未確定事項

読取り専用確認では、五File構成と既存保証は両立可能という見通しを得た。ただし次を未処置のまま実装しない。

- 長期LeaseはStorage Lockではない。
- 一回使用証拠は単なるキャッシュではない。
- 保存前の意味検査を古いSnapshotだけで済ませない。
- 同Ownerの既存completed結果を再利用する保証を、再保存へ戻さない。
- Decisionの二つの保存契約を混合しない。
- Selectionの既存Filesystem LockをKernel Lockへ交換しない。

残る不確実性は、混在関数内部の宣言・閉包の分割境界と、全Consumerへの対応。現在の索引と設計案を、完成した移管表またはSource実装完了として扱わない。

2026-10-27の読取り専用確認では、本計画・Architecture新16.2・PROJECT_CONTEXTの設計案と未完了範囲の表現を照合し、残指摘零を確認した。これはPhase 1完成やSource移管安全性の最終保証ではない。Source不変のため回帰試験は再実行せず、変更文書の参照と差分形式を確認した。

## 8. 確定した移管群

2026-10-27、以下66宣言の移管を実装した。Source本文の正規化比較でState56宣言は差分零、Selectionの固定合成十項目のHashは移管前後一致。型・整形・lint、Runtime TraceとTask Design Traceは成功。局所五Suite52件と、公開API・搬送・助言等七Suite57件はそれぞれ成功した（重複する先行試験件数とは合算しない）。Source独立レビューの指摘一件はQA Trace JSON二行の旧Pathであり、是正・再レビュー後は残指摘零。現在のWindows実保存を含む対象回帰は実行中で、全体完了・Storage本体移管完了は主張しない。

追加回帰の助言投影一件は、PROJECT_CONTEXT.mdの65,536byte上限超過で失敗した。基準Commitでも65,631byte、今回追記後66,500byteであることを確認した。上限・拒否条件を変えず、先行経過の重複を既存CHG参照へ要約し64,568byteへ縮小。同単独試験と七Suite57件の再確認は成功した。正式Evidenceは不変、文書の独立確認は残指摘零。

横断Checkerの選択実行は七件中四成功・三不合格。今回のSource移管差分外のplatform-access/tests/integration/host-record.rs命名、Docker Isolation公開Module一覧、AI Adapterの既存Test Header不足に現れた。基準版での同試験再実行は未実施のため、この結果を全体QAの合格や今回移管だけによる不合格とは扱わない。

### 8.1. AI選定値（十宣言）

| 元宣言 | 移管先 | 利用側・保持する意味 |
|---|---|---|
| AiSelectionRole | selection/types.ts | Resolve・実行・公開API。五役割の集合を維持 |
| AiSelectionChoice | selection/types.ts | 設定・明示指定。Provider／Model／Effortの三項目を維持 |
| AiSelectionConfig | selection/types.ts | 設定の保存・解決。Schema・版・分類を維持 |
| AiSelectionSnapshot | selection/types.ts | 設定読書き・受付時選定。内容Identityを維持 |
| ExecutionSelection | selection/types.ts | Task／Packet／Operation。技術選定と設定相関を維持 |
| TaskExecutionSelections | selection/types.ts | Taskの編集・レビュー組。役割と設定Identityの相関を維持 |
| inspectAiSelectionChoice | selection/validation.ts | 公開要求・設定境界。閉形式・不変Snapshotを維持 |
| inspectTaskExecutionSelections | selection/validation.ts | Task／保存Codec。二役割の組と元設定相関を維持 |
| inspectExecutionSelection | selection/validation.ts | 実行・保存Codec。現在Catalogで再解釈しない |
| hashExecutionSelection | selection/validation.ts | Packet／Grant／保存相関。検査後のJSON byteとHashを維持 |

直接Consumerは下の旧selection/model.ts索引に列挙した24File。通常のimport／re-exportに加え、二つのWindows統合試験が生成する子ProcessのURL、platform-independence試験の純粋依存閉包定義も追従する。Root export集合を増減しない。

必要試験: selection/resolve、固定選定、明示選択、同意への選定結合、Task入力／Packet／Structured Result、Codex／Claude準備、Provider Authority、保存Codec、platform-independence、公開API。Proxy／getter／過剰field／役割混合／当時Catalogの再解釈拒否は既存条件を維持する。型だけのFileは外部実行・保存へ値依存させない。

### 8.2. 状態モデル（五十六宣言）

| 宣言群（全宣言を以下へ一意に割当） | 移管先 | 利用側・試験と維持条件 |
|---|---|---|
| requestCoordinatorHumanDecision / applyCoordinatorHumanDecision / applyObjectiveAcceptance / applyMilestoneAcceptance / applyCoordinatorAcceptanceDecision | decision/transition.ts | decision/lifecycle・acceptanceとobjective/replan。純粋な遷移をI/O入口とは別閉包に保持。transitions／acceptance-decision／replanningの試験 |
| CoordinatorAcceptanceTarget / CoordinatorAcceptanceDecision / CoordinatorAcceptanceDecisionInput | decision/types.ts | Decision要求・記録・公開API。対象と三判断値は不変 |
| ProjectObjectiveState / ProjectMilestoneState / ProjectObjectiveDefinition / ProjectObjectiveRecord / ProjectMilestoneRecord | objective/types.ts | Objective計画と統合状態の型。状態値・項目を維持 |
| ProjectResultAcceptance / ProjectTaskState / ProjectTaskDefinition / ProjectTaskRecoveryKind / ProjectTaskRecoveryObligation / ProjectDockerRecoveryAcknowledgement / ProjectTaskStartPhase / ProjectTaskRecord / ProjectQueueState / ProjectQueueEntry / SingleTaskRecord | task/types.ts | Task lifecycle・受領・Queue・保存Codec。task-execution／queue／single-task／storage試験 |
| CoordinatorState / StateResult | state/types.ts | 状態構築・投影・全意味Owner。型専用で保存実装へ値依存しない |
| projectState | state/projection.ts | 全遷移の不変投影。固定選定の再検査と凍結を維持 |
| createCoordinatorState / snapshotObjectiveDefinition | state/create.ts | Task／Objectiveと試験fixtureの純粋初期構築。I/Oのinitialize.tsとは分離。createしか持たないためcrud.tsは作らない |
| snapshotDefinition / hasCycle / replaceTask | task/lifecycle.ts | Task定義・循環・置換。Task遷移と計画の既存条件を維持 |
| decodeProjectResultAcceptance | task/acceptance.ts | 受領本文と保存Codec。過剰field／旧形式／Getter／Proxy拒否を維持 |
| inspectSingleTaskRecord / KEYS / ID | task/validation.ts | 単発Taskの閉形式。single-task-state／状態codecの試験 |
| COORDINATOR_STATE_CONTRACT / COORDINATOR_MAXIMUM_CONCURRENCY / COORDINATOR_MAXIMUM_OBJECTIVES / COORDINATOR_MAXIMUM_TASKS / PROJECT_OBJECTIVE_STATES / PROJECT_TASK_STATES / describeCoordinatorStateContract | state/validation.ts | 複数状態の契約・上限・許容集合。値と公開記述は不変 |
| validIdentity / validRevision / isCoordinatorRecoveryIdentity / uniqueStrings / singleTaskQueueIsConsistent / ArraySnapshot / isPlainRecord / isDataDescriptor / snapshotPlainRecord / snapshotPlainArray / normalizeRepositoryRelativePath / repositoryPathWithin / deriveCoordinatorRepositoryBindingId | state/validation.ts | 複数Owner共用の値・相関検査。既存Domain Model APIへ意味差を無視して差し替えない。transitionsのplain-data反証・Path／Binding・純粋import閉包を追従 |

全50直接参照元の母集団は末尾のstate/model.ts索引。型・関数ごとのimportを上表に分配し、同居先から自身をimportしない。uniqueStrings／validRevisionを別Fileから利用する場合はPackage内部exportだけとし、標準公開APIへ追加しない。現行の共有型types.tsへ実行時定数を追加しない。新しいdecision/transition.ts・state/create.ts・task/validation.ts・state/validation.tsは実責務の移管先であって、新しいState・Port・Registry・Frameworkではない。

### 8.3. Storage移管群の切断条件と宣言割当

Task／Queue・Decision・Workspaceの操作Factoryは、既存の`withCoordinatorSnapshotOperation`を呼ぶOwner側の操作へ移す。この既存トランザクションはStorageに残し、callbackの呼出位置・排他・CASを変えない。長期Leaseの実発行集合はExecutionへ一体で移し、Task側は同じ実発行記録を読取り専用で借用して現Ownerを照合する。短期保存Ownerとは混ぜない。

| 移管先 | current-stateからの宣言 |
|---|---|
| `state/result.ts` | `StoreResult`、`completed`、`blocked` |
| `storage/lock.ts` | `acquireCoordinatorSnapshotPilotLock`、`CoordinatorSnapshotOwner`、`isLiveCoordinatorSnapshotOwner` |
| `execution/lease.ts` | `ActiveLease`、`activeLeases`、`activeLeaseIsObserved`、`inspectCoordinatorSnapshotLeaseAcquisitionOwner`、`acquireCoordinatorSnapshotLease`、`reconcileCoordinatorSnapshotLeaseOwnerLoss` |
| `task/queue.ts` | `QUEUE_TRANSITIONS`、`inspectCoordinatorSnapshotIntake`、`createCoordinatorSnapshotStatePort`、`enqueueCoordinatorSingleTask`、`updateCoordinatorSingleTask`、`closeUnstartedCoordinatorSingleTask` |
| `state/settlement.ts` | `coordinatorSnapshotIntakeMatches` |
| `decision/lifecycle.ts` | `createCoordinatorSnapshotAcceptanceDecisionStore`、`createCoordinatorSnapshotDecisionRecoveryStore` |
| `workspace/commands.ts` | `createCoordinatorSnapshotIntegrationRecordPort`、`writeCoordinatorWorkspaceRecord` |
| `state/transaction.ts` | `createCurrentCoordinatorPersistencePorts`、`createCoordinatorSnapshotPersistencePorts` |
| `state/query.ts` | `readCurrentCoordinatorState` |
| `state/retirement.ts` | `maintainCoordinatorSnapshot`、`transferCoordinatorSnapshotHistory` |

統合Snapshotのbyte復号・改訂・元Hash確認はStorageに残し、その後の受領本文・固定選定・終端操作とTask投影の相関判断は`state/transition.ts`の`validateCoordinatorSettlementTransition`へ移す。旧`validateCoordinatorUnifiedTransition`内の該当本文と空白以外が一致することを確認する。Task投影を保存値のprojectsへ置換せず、履歴行の再導出も同じ元本文とRepository結合で行う。


次の値宣言群はOwnerを確定して移管する。保存Schema・Envelope・byte復号・CAS・再入場はStorage Stateに残す。下表の実行値検査はOperationの観測と終了条件、共有検査はStateの値同一性、Task検査はTask／Queue、履歴CodecはHistoryが一度だけ所有する。実行型は`execution/types.ts`へ置き、型専用の依存を維持する。移管後もWriterはfreshな元版に同じ判定を同じ位置で適用する。

| 移管先 | 宣言 |
|---|---|
| `execution/validation.ts` | `purposeResource`、`commandPurposes`、`failureStages`、`finalReasons`、`repairReasons`、`validateHostSnapshot`、`validateCoordinatorOperationIdentity`、`validCoordinatorRepairRetentionReceipt`、`coordinatorRepairRetentionMatchesCheckpoint`、`validCoordinatorRepairOperation`、`coordinatorOperationNonce`、`coordinatorResourceIsSettled`、`coordinatorAuthenticationUnknownCanClose`、`coordinatorAuthenticationClosureEvidence`、`coordinatorTaskResourcesAreSettled`、`coordinatorReleasedTaskCanObserveHostAbsence`、`validCoordinatorRepairSummary`、`validCoordinatorPrimaryFailure`、`validCoordinatorOutcome`、`coordinatorRepairCanSummarize`、`coordinatorRepairCanComplete` |
| `state/validation.ts` | `exactRecordKeys`、`isSha256Hex`、`exactKeys`、`plainObject`、`stringArray`、`nullableId`、`nullableCandidateId`、`nullableRecoveryId`、`validResultReference`、`nullableResultReference`、`validId`、`digest`、`leaseAcquisitionRecoveryId`、`leaseIdentity`、`ID`、`HASH`、`REVISION` |
| `task/validation.ts` | `validTaskLifecycleTuple`、`validCoordinatorState`、`validQueueEntry`、`recoveryObligations`、`resultAcceptances` |
| `state/settlement.ts` | `projectCoordinatorTaskSettlement`、`associateCoordinatorTaskOperations`、`normalizeCoordinatorTaskProjects`、`validCoordinatorTaskState` |
| `storage/history.ts` | `decodeCoordinatorHistoryRows`、`prepareCoordinatorHistoryRetention`、`HistoryRow`、`closedObject`、`timestamp`、`historyRow` |
| `execution/types.ts` | `CoordinatorStateTaskOperation`、`CoordinatorStateRepairOperation`、`CoordinatorStateOperation`、`CoordinatorRepairRetentionReceipt` |


継続実装の着手前確認で、一回使用証拠の割当を確定した。`settlements`の`live` variantと`readLiveSettlement`、正常終了の準備・元入力固定・終了保存・履歴checkpoint／出版・配送登録・完了・結果照会は`execution/settlement.ts`へ一体で戻した。他の五variantは限定された物理保存ContextなのでStorage Stateに残し、`used = true`の消費位置を変えない。`initializations`も新品領域の物理出版証拠としてStorage Stateに残す。`historyAttempts`は履歴だけでなく同じSnapshot候補・物理出版順序へ結合した証拠なので、履歴Codecとは分けてStorage Stateに残す。登録は従来どおりSnapshot確認とLock解放の両方が成立した後だけ行う。Mapの二重登録、新しいID・State・Lock・回復機構は追加しない。

2026-10-27、短期保存Owner六宣言は`storage/lock.ts`へ一体で移管する。既存Mapの直接読取り五箇所には、同じ記録だけを返す私有Package関数を用い、生存再確認や排他取得の時点は変えない。保護判断保存十七宣言は`storage/decision.ts`へ改名する。長期Lease・settlement・初期化・履歴の一回使用証拠はこの短期排他へ混ぜない。

候補公開・採用の意味契約`IntegrationRecordBinding`・`CoordinatorIntegrationRecord`・`CoordinatorIntegrationRecordPort`と、保存行の意味型・定数`COORDINATOR_INTEGRATION_CONTRACT`・`CoordinatorResultRecord`、保存行の値検査は`workspace/record.ts`へ置く。保存封筒へのencode/decodeはStorageが所有する。元の型本文・定数値・返却契約を変えず、`result-record.ts`は撤去した。固定受領方式の値判断`coordinatorConsumerCompletionPolicy`は既存`task/acceptance.ts`へ移し、全直接Consumerは新Ownerを参照する。新しい公開Root APIは追加しない。

Writer内の最初の切断箇所は、`writeCoordinatorSnapshotState`にあるTask受領集合の遷移判断とする。既存`task/acceptance.ts`の`hasProjectTaskResultAcceptanceConflict`へ同じ判定本文を移し、Writerは短期Lock内で読み直した`previous`と`state`をそのまま渡す。読取り・元世代比較・受付世代照合・CAS・保存・読戻し・解放の順序は移動しない。初回受領、同一Attemptの固定本文保全、別Attemptの受領世代、明示的な部分再計画による置換を反例として局所検査する。

値の正規化二宣言`encodeCoordinatorStateValue`・`coordinatorStateContentHash`は、保存I/Oではなく状態値の同一性を検査する共有処理である。既存`state/validation.ts`へ同じ処理を移す。Schema・Envelope・LFを含む保存本文の確定、現在／pendingの復号・再入場はStorageに残す。key順、配列順、深度、safe integer、Proxy／Accessor拒否、Hashへ渡すUTF-8とLFは変更しない。純粋OwnerがStorageの実行値を逆参照しないための先行移管であり、汎用Codecや新しいFrameworkは設けない。

これらの移管は実装済み。第一・第二群の独立確認で検出したWorkbench正式検証Toolの旧importとCheckerの削除済みFile参照を是正した。Coordinatorの静的検査、Workbenchの型検査、状態／保存／修復モデル／純粋依存の四Suite六十二件が成功。Windowsの保存marker実処置一件も成功した。Workbench合成HTTPのsandbox内二失敗は、同じ対象の通常Windows実行では三件成功した（同意なし拒否、正式Toolの模擬HTTP、同IDの通常完了・取消・応答喪失継続）。実AI・実Dockerの成立根拠とはしない。

Sourceは五Fileへ整理した。長期Leaseは`execution/lease.ts`、Task／Queue操作は`task/queue.ts`、判断操作は`decision/lifecycle.ts`、Workspace保存操作は`workspace/commands.ts`、閉鎖・退役と区画相関は`state/transition.ts`・`state/retirement.ts`・`state/settlement.ts`が所有する。旧三Fileは撤去した。Sourceの独立レビューは残指摘零だが、対象回帰の成功を全体回帰の合格へ読み替えない。

第三群の固定差分に対する独立確認は残指摘零。受領競合判定と正規化／Hash二関数の元本文一致、Lock内の判定順序、静的・namespace・動的・生成Worker参照の追従、新しい値依存循環とRoot API追加がないことを確認した。移管後の通常Windows本番接続三件（通常結果受領、依存／競合予約、開始前取消）は成功した（exit 0、約六十二秒）。先行の全体回帰中断を取り消す根拠にはせず、未実施残りは保持する。

先行のWindows実保存を含む回帰は、依存・競合予約を確認する`PR-N-03 and PR-Q-01`で約十五分CPUを消費し出力が進まないため中断した（exit 1）。直前の同Workspace直列Task試験までは成功していたが、回帰全体は未合格である。対象Node二Processの終了を確認した。原因は未確定であり、Sourceの判定・期限を緩めない。Storage第一移管後の局所十四件は成功した。別の実Filesystem試験ではsandboxのhardlink拒否と保護保存のblockedを観測したため、通常Windows環境との差を独立に確認する必要がある。

保存Schema・byte復号・revision／previous Hash付与・encode・全体CASの再導出はStorageに残す。Operationの状態検査・遷移は`execution/validation.ts`、Taskの値検査は`task/validation.ts`、復号済みの区画相関・Task投影は`state/settlement.ts`へ分離した。prepare*Snapshot／validate*Transitionを名前だけで丸ごとExecutionへ移さない。Writerはfreshな現在版に対する意味Ownerの検査を既存の短期排他内で維持する。閉鎖判定には同じOwnerへ束縛した同期観測を渡し、実Lease不存在・履歴確定の確認位置と例外の扱いを維持する。

- encodeCoordinatorStateValueは意味検査・証拠Hashも利用する。正規化の共通実体と保存封筒Codecの境界を先に確定し、JSON.stringifyへの差替えや二重実装をしない。
- projectCoordinatorTaskSettlementはStateの横断投影。入力の閉形式化・拒否を省略せず、保存・実行Effectを発行しない。区画検査の`state/settlement.ts`は保存codecや履歴検査と値依存があり、純粋Coreの依存閉集合とは区別する。
- classifyCoordinatorSnapshotReentryは物理保存途中版の再入場なのでStorage State。
- 資源終端・限定auth unknown終了は、通常／専用条件を保った共通の純粋判定へ分離する。実不存在・現在Authorityの証明へ昇格しない。
- HistoryのCodec・pending・全文照合・保持はStorage History。要約の意味判断と物理確定を分け、State参照退役との相関は保持する。

### 8.4. 最終差分の検証と残る限界

- Coordinatorの整形・Source／試験の型検査・lint・Runtime Trace・Task Design Traceは成功。Workbench／MCPの型検査も成功した。
- 意味検査・保存モデル・修復結果・純粋依存の局所88件、Windows実保存22件、移管後の受領・退役・履歴4件、耐久受付と生成Worker15件、Workbench／MCPの合成HTTPを含む利用側34件が成功した。重複する試験は合算しない。
- 実Git・別Process再入場を伴うWorkspace結合18件も成功した。最初のケース開始から約20分後に結果がまとめて届いた。今回生成された試験領域の新規作成・状態更新・通常清掃を途中に読み取り、無出力中も進行していたことを確認した。過去の保持領域は対象外とした。
- 全体回帰で検出したVM依存注入、移管先mock、Symbol登録と生成Workerの旧参照は追従し、対象を再実行して成功を確認した。製品の拒否条件や保存形式を変えた是正ではない。
- 全体回帰は`task-execution.contract.test.ts`の直列Task成功後に約十四分出力が更新されず、対象Workerだけを終了した。依存・競合予約は単独実行と直前の直列Taskとの連続実行（二件、約六十七秒）では成功した。追加の名前指定二ケースも内部の負例を含む七件が成功した。前半を除いた後半42件は約639秒で全成功し、結果がまとめて到着した。無出力だけで実行停止と断定せず、中断前の内部進行は未確定とする。通常配送・前半は元実行、依存・競合と後半は分割実行で確認したが、一括実行の合格へ読み替えない。後続は一括実行の終了結果で確認した。
- 最終Source独立レビューは残指摘零。終了・受領相関の移管本文、短期排他内の再確認位置、一回使用証拠の消費位置、公開API不変を照合した。中断箇所の試験本文・Scheduling・Dispatch・保存Port・Leaseの比較でも意味変更は検出しなかったが、性能や先行試験の影響を静的比較だけで否定しない。
- 全体一括実行は約4,200秒で終了し、1,794成功・28失敗・5省略だった。失敗は移管先へのVM／mock／生成Worker／Symbol追従、中断したTask実行File、および共用一時領域のWindows保護不一致二件に分類した。前者は修正後の対象試験、中断Fileは前半の既存結果・依存予約二件・後半42件、保護不一致は新品領域の二Suite15件で確認した。各対象の成功を、初回一括実行の合格や単一固定runの合格へ換算しない。分割再確認後に未処置のSource故障は検出していない。
- 保護不一致二件では、今回の共用一時Root内の管理Directoryが継承保護なし、新品Rootは保護ありだった。Nativeが既存Directoryを拒否する条件を維持し、製品へのACL修復・fallback・検査緩和は追加しない。今回の一時Root `storage-regression-runtime-20261027-c1`／`c2`だけは、絶対Path・linkなし・回復Fileなし・試験Process終了を確認後に通常削除し、不存在を確認した。中断Workerが生成した全fixtureの不存在までは確認しておらず、由来を一意に結合できない領域は削除していない。
- 文書検査は依存文書・過去CHGまで展開して3,353診断となり、全体未合格。現在のCoordinator Source／Architectureを直接指す診断は零だが、全診断を既知扱いせず、過去Evidenceの改変や今回の構造整理と無関係な一括是正は行わない。
- AI再送・Docker操作・過去保持物の操作は行っていない。実AI編集E2E成功や以前のContainer作成不明の解消を今回の構造移管から推定しない。

## 9. 宣言の抽出一覧（基準版の歴史的索引）

基準 `81d9647a4`。正規のSource行頭にあるトップレベル宣言を抽出した一次索引であり、ローカル関数・閉包・Map variant・全使用参照の意味確認完了を示さない。下記362宣言を母集団として、移管時には各宣言の責務・依存Symbol・利用側・保存対象・安全保証・必要試験を確定する。ファイル単位のimport集合を宣言単位の依存閉包の代用にしない。

### storage/ai-selection.ts

637行、トップレベル11宣言。

直接のimport／re-export元:

- `node:fs`
- `node:crypto`
- `../../../domain-model/src/index.ts`
- `../../../ai-adapter/src/index.ts`
- `../../../version-control/src/index.ts`
- `../selection/resolve.ts`
- `../selection/model.ts`

直接参照元（静的な相対import／re-exportの走査結果。公開Root経由の推移的利用側は別途追跡）:

- `40_Develop/coordinator/src/api.ts`
- `40_Develop/coordinator/src/objective/execute.ts`
- `40_Develop/coordinator/src/task/requests.ts`
- `40_Develop/coordinator/tests/integration/advice-recovery-handoff.integration.test.ts`
- `40_Develop/coordinator/tests/integration/advice-selection-flow.integration.test.ts`
- `40_Develop/coordinator/tests/integration/ai-selection-store.contract.test.ts`
- `40_Develop/coordinator/tests/integration/public-operation.integration.test.ts`
- `40_Develop/workbench-server/tests/integration/ai-verification.contract.test.ts`

```text
  25  export const AI_SELECTION_MAXIMUM_BYTES
  26         const CONFIG_FILE
  38  export type AiSelectionReadResult
  63  export type AiSelectionTemporaryReference
  88  export type AiSelectionSaveResult
 124         type ConfigAreaFailure
 144         function inspectSelectionFile
 257  export function readRepositoryAiSelection
 278         function matchesExpected
 302         function authorized
 325  export function saveRepositoryAiSelection
```

### storage/current-state.ts

5,179行、トップレベル56宣言。

直接のimport／re-export元:

- `node:crypto`
- `./model.ts`
- `node:fs`
- `node:path`
- `../../../domain-model/src/index.ts`
- `../../../version-control/src/index.ts`
- `../decision/types.ts`
- `../decision/records.ts`
- `./settlement-store.ts`
- `../state/model.ts`
- `../state/persistence.ts`
- `../state/result.ts`
- `../workspace/operations.ts`
- `../workspace/record.ts`
- `./history.ts`
- `./result-record.ts`

直接参照元（静的な相対import／re-exportの走査結果。公開Root経由の推移的利用側は別途追跡）:

- `40_Develop/coordinator/src/decision/acceptance.ts`
- `40_Develop/coordinator/src/decision/lifecycle.ts`
- `40_Develop/coordinator/src/execution/recovery.ts`
- `40_Develop/coordinator/src/objective/execute.ts`
- `40_Develop/coordinator/src/state/initialize.ts`
- `40_Develop/coordinator/src/state/observation.ts`
- `40_Develop/coordinator/src/state/query.ts`
- `40_Develop/coordinator/src/task/requests.ts`
- `40_Develop/coordinator/src/workspace/commands.ts`
- `40_Develop/coordinator/src/workspace/operations.ts`
- `40_Develop/coordinator/tests/fixtures/task-lease-race-probe.ts`
- `40_Develop/coordinator/tests/fixtures/task-persistence-fixture.ts`
- `40_Develop/coordinator/tests/fixtures/task-result-publication-worker.ts`
- `40_Develop/coordinator/tests/fixtures/task-snapshot-lock-owner.ts`
- `40_Develop/coordinator/tests/fixtures/workspace-surface.ts`
- `40_Develop/coordinator/tests/integration/advice-recovery-handoff.integration.test.ts`
- `40_Develop/coordinator/tests/integration/public-operation.integration.test.ts`
- `40_Develop/coordinator/tests/integration/runtime-activity.contract.test.ts`
- `40_Develop/coordinator/tests/integration/single-task-state.integration.test.ts`
- `40_Develop/coordinator/tests/integration/task-decision-recovery-store.contract.test.ts`
- `40_Develop/coordinator/tests/integration/task-durable-foundation.contract.test.ts`
- `40_Develop/coordinator/tests/integration/task-execution.contract.test.ts`
- `40_Develop/coordinator/tests/integration/task-full-flow.integration.test.ts`
- `40_Develop/coordinator/tests/integration/task-history.contract.test.ts`
- `40_Develop/coordinator/tests/integration/task-integration-record-adapter.contract.test.ts`
- `40_Develop/coordinator/tests/integration/task-objective-intake.contract.test.ts`
- `40_Develop/coordinator/tests/integration/task-queue-priority.contract.test.ts`
- `40_Develop/coordinator/tests/integration/task-replanning-and-decision.contract.test.ts`
- `40_Develop/coordinator/tests/integration/workspace-lifecycle.integration.test.ts`
- `40_Develop/coordinator/tests/system/task-acceptance-decision.contract.test.ts`
- `40_Develop/coordinator/tests/system/task-recovery.contract.test.ts`
- `40_Develop/mcp-server/tests/integration/access-capabilities.integration.test.ts`
- `40_Develop/workbench-server/scripts/verify-workspace-ai.ts`
- `40_Develop/workbench-server/tests/integration/ai-verification.contract.test.ts`

```text
 118         function resolveCoordinatorNamedPaths
 140         function observeCoordinatorArea
 175         function assertCoordinatorArea
 201         function assertCoordinatorAreaUnchanged
 217         const QUEUE_TRANSITIONS
 272         type StoreResult
 285         type ActiveLease
 301         const activeLeases
 319  export function acquireCoordinatorSnapshotPilotLock
 344         function errorCode
 366         function completed
 386         function blocked
 416         function leaseAcquisitionTemporaryPrefix
 436         function leaseAcquisitionTemporaryFiles
 463         function pathConfirmedAbsent
 489         function leaseAcquisitionFootprintAbsent
 516         function assertDirectory
 543         function ensureDirectory
 582         function activeLeaseIsObserved
 635         function envelope
 680         function readEnvelopeFile
 755         function readExactLeaseEvidence
 852  export function readCoordinatorSnapshot
 881  export function initializeCoordinatorSnapshot
 970  export type CoordinatorSnapshotOwner
 987  export function isLiveCoordinatorSnapshotOwner
1008  export function writeCoordinatorSnapshotState
1181         function readCoordinatorSnapshotOwned
1228  export function writeCoordinatorSnapshot
1277         function writeCoordinatorSnapshotOwned
1372         function assertCoordinatorSnapshotTransition
1848         function withCoordinatorSnapshotOperation
1915         function coordinatorQueueIsClosed
2050         function coordinatorAdoptionWasRejected
2087         function coordinatorRejectedAdoptionEvidenceCanRetire
2129         function coordinatorStandaloneAdoptionIsClosed
2242  export function maintainCoordinatorSnapshot
2487  export function transferCoordinatorSnapshotHistory
2543  export function createCoordinatorSnapshotAcceptanceDecisionStore
2720  export function createCoordinatorSnapshotDecisionRecoveryStore
2874  export function createCoordinatorSnapshotIntegrationRecordPort
2961  export function inspectCoordinatorSnapshotLeaseAcquisitionOwner
3036  export function acquireCoordinatorSnapshotLease
3389         function coordinatorSnapshotLeaseResourcesAbsent
3429  export function reconcileCoordinatorSnapshotLeaseOwnerLoss
3945         function coordinatorSnapshotIntakeMatches
3992  export function inspectCoordinatorSnapshotIntake
4031  export function createCoordinatorSnapshotStatePort
4512  export function enqueueCoordinatorSingleTask
4618  export function updateCoordinatorSingleTask
4766  export function closeUnstartedCoordinatorSingleTask
4844  export function createCurrentCoordinatorPersistencePorts
4882  export function readCurrentCoordinatorState
4919  export function createCoordinatorSnapshotPersistencePorts
5001  export function writeCoordinatorWorkspaceRecord
5165  export function describeCoordinatorDurableFoundation
```

### storage/history.ts

356行、トップレベル5宣言。

直接のimport／re-export元:

- `node:fs`
- `node:path`
- `../../../domain-model/src/index.ts`
- `../../../version-control/src/index.ts`
- `./model.ts`
- `./settlement-store.ts`

直接参照元（静的な相対import／re-exportの走査結果。公開Root経由の推移的利用側は別途追跡）:

- `40_Develop/coordinator/src/storage/current-state.ts`
- `40_Develop/coordinator/tests/integration/task-history.contract.test.ts`

```text
  43         function readHistoryFile
  96         function taskHistoryLine
 121  export function updateCoordinatorHistoryOwned
 272  export function updateCoordinatorHistoryPilot
 307  export function inspectCoordinatorHistorySettlement
```

### storage/model.ts

8,220行、トップレベル131宣言。

直接のimport／re-export元:

- `node:crypto`
- `node:util`
- `../../../ai-adapter/src/index.ts`
- `../selection/model.ts`
- `../../../docker-isolation/src/index.ts`
- `../decision/records.ts`
- `../execution/result.ts`
- `../state/persistence.ts`
- `../state/model.ts`
- `../workspace/record.ts`
- `./result-record.ts`

直接参照元（静的な相対import／re-exportの走査結果。公開Root経由の推移的利用側は別途追跡）:

- `40_Develop/coordinator/src/execution/controller.ts`
- `40_Develop/coordinator/src/execution/recovery.ts`
- `40_Develop/coordinator/src/storage/current-state.ts`
- `40_Develop/coordinator/src/storage/history.ts`
- `40_Develop/coordinator/src/storage/settlement-store.ts`
- `40_Develop/coordinator/tests/fixtures/docker-auth-create-closure-verifier.ts`
- `40_Develop/coordinator/tests/fixtures/docker-recovery-abandon-worker.ts`
- `40_Develop/coordinator/tests/fixtures/task-result-fixture.ts`
- `40_Develop/coordinator/tests/integration/coordinator-state-runtime.contract.test.ts`
- `40_Develop/coordinator/tests/integration/coordinator-task-runtime.contract.test.ts`
- `40_Develop/coordinator/tests/integration/current-admission.contract.test.ts`
- `40_Develop/coordinator/tests/integration/current-host-transition.integration.test.ts`
- `40_Develop/coordinator/tests/integration/current-recovery-resources.contract.test.ts`
- `40_Develop/coordinator/tests/integration/current-state-marker-cleanup.contract.test.ts`
- `40_Develop/coordinator/tests/integration/docker-auth-create-closure.contract.test.ts`
- `40_Develop/coordinator/tests/integration/docker-recovery-owner-reentry.contract.test.ts`
- `40_Develop/coordinator/tests/integration/docker-restart-preparation-order.contract.test.ts`
- `40_Develop/coordinator/tests/integration/runtime-repair-owner.contract.test.ts`
- `40_Develop/coordinator/tests/integration/runtime-repair-result.contract.test.ts`
- `40_Develop/coordinator/tests/integration/task-decision-recovery-store.contract.test.ts`
- `40_Develop/coordinator/tests/integration/task-durable-foundation.contract.test.ts`
- `40_Develop/coordinator/tests/integration/task-execution.contract.test.ts`
- `40_Develop/coordinator/tests/integration/task-history.contract.test.ts`
- `40_Develop/coordinator/tests/integration/task-integration-record-adapter.contract.test.ts`
- `40_Develop/coordinator/tests/integration/task-objective-intake.contract.test.ts`
- `40_Develop/coordinator/tests/system/task-acceptance-decision.contract.test.ts`
- `40_Develop/coordinator/tests/unit/storage/model-reentry.contract.test.ts`
- `40_Develop/coordinator/tests/unit/storage/model.contract.test.ts`
- `40_Develop/coordinator/tests/unit/storage/repair-model.contract.test.ts`
- `40_Develop/workbench-server/scripts/verify-workspace-ai.ts`

```text
  86         function exactRecordKeys
 113         function isSha256Hex
 133         function validateHostSnapshot
 200  export const COORDINATOR_STATE_SCHEMA
 201         const OPERATION_IDENTITY_SCHEMA
 218  export function coordinatorConsumerCompletionPolicy
 242         function validateCoordinatorOperationIdentity
 366  export const MAX_COORDINATOR_STATE_BYTES
 367  export const MAX_COORDINATOR_STATE_OPERATIONS
 368         const purposeResource
 375         const commandPurposes
 382         const failureStages
 393         const finalReasons
 409  export type CoordinatorStateTaskOperation
 488  export type CoordinatorStateRepairOperation
 538  export type CoordinatorStateOperation
 552  export type CoordinatorRepairRetentionReceipt
 573         function validCoordinatorRepairRetentionReceipt
 613         function coordinatorRepairRetentionMatchesCheckpoint
 645         const repairReasons
 671         function validCoordinatorRepairOperation
 890  export function classifyCoordinatorSnapshotReentry
 966         function coordinatorOperationNonce
 987         function coordinatorResourceIsSettled
1012  export function coordinatorAuthenticationUnknownCanClose
1069         function coordinatorAuthenticationClosureEvidence
1109  export function coordinatorTaskResourcesAreSettled
1146  export function coordinatorReleasedTaskCanObserveHostAbsence
1180  export function prepareCoordinatorAuthenticationUnknownClosureSnapshot
1264         type CoordinatorExecutionStateSnapshot
1299  export type CoordinatorTaskSettlementFact
1323  export type CoordinatorStoredTask
1356  export type CoordinatorUnifiedSnapshot
1382  export type CoordinatorStateSnapshot
1384         const EMPTY_COORDINATOR_TASK_SECTIONS
1415  export function projectCoordinatorTaskSettlement
1499  export function encodeCoordinatorStateValue
1556  export function coordinatorStateContentHash
1577  export function prepareCoordinatorStateOperationSnapshot
1689  export function prepareCoordinatorStateRepairSnapshot
1777  export function prepareCoordinatorStateRepairCheckpointSnapshot
1844  export function prepareCoordinatorStateRepairSessionSnapshot
1909  export function prepareCoordinatorStateRepairRetentionHandoffSnapshot
1995  export function validateCoordinatorStateRepairRetentionHandoffTransition
2033  export function validateCoordinatorStateRepairSessionTransition
2066  export function prepareCoordinatorStateRepairDisposalDecisionSnapshot
2153  export function prepareCoordinatorStateRepairDisposalProgressSnapshot
2237  export function validateCoordinatorStateRepairDisposalTransition
2283  export function classifyCoordinatorRepairPublication
2422         function prepareCoordinatorStateOperationCheckpoint
2526  export function prepareCoordinatorStateResourceSnapshot
2557  export function prepareCoordinatorStateHostSnapshot
2588  export function prepareCoordinatorStateLifecycleSnapshot
2618  export function prepareCoordinatorStateRestartSnapshot
2649  export function prepareCoordinatorStateCleanupSnapshot
2763  export function prepareCoordinatorStateReferencesSnapshot
2859  export function prepareCoordinatorStateHistorySummary
2915  export function prepareCoordinatorStateResultDeliverySnapshot
3009         function coordinatorOperationSummaryBytes
3079         function coordinatorRepairCanSummarize
3125         function coordinatorRepairSummaryBytes
3174         function coordinatorRepairHistoryLineBytes
3204         function validCoordinatorRepairSummary
3490  export function prepareCoordinatorRepairHistorySummary
3534  export function prepareCoordinatorRepairHistorySnapshot
3621  export function prepareCoordinatorRepairHistoryLine
3654         function copyCoordinatorRepairHistoryBytes
3697  export function prepareCoordinatorRepairHistoryPublication
3771         function coordinatorHistoryLineBytes
3801  export function prepareCoordinatorStateHistoryLine
3840         function validCoordinatorPrimaryFailure
3974         function validCoordinatorOutcome
4011  export function decodeCoordinatorHistoryRows
4193  export function prepareCoordinatorHistoryRetention
4276  export function prepareCoordinatorRecoveredHistoryPublication
4377  export function prepareCoordinatorStateHistorySnapshot
4469         function validCoordinatorExecutionState
4820         function decodeCoordinatorCanonicalBytes
4875  export function decodeCoordinatorStateSnapshot
4900  export function decodeCoordinatorUnifiedSnapshot
5196  export function validateCoordinatorUnifiedTransition
5407  export function prepareCoordinatorUnifiedTaskSnapshot
5494         function associateCoordinatorTaskOperations
5530         function normalizeCoordinatorTaskProjects
5707  export function projectCoordinatorTaskSnapshot
5748  export function prepareCoordinatorUnifiedTaskSections
5830  export function prepareCoordinatorStateCompletionSnapshot
5920  export function coordinatorRepairCanComplete
5975  export function prepareCoordinatorStateRepairCompletionSnapshot
6031  export function validateCoordinatorStateTransition
6059  export function classifyCoordinatorResourcePublication
6143         function validateCoordinatorStateTransitionValue
6637  export const COORDINATOR_DURABLE_FOUNDATION_CONTRACT
6651  export type LeaseKind
6664  export type Envelope
6676  export const ID
6678  export const HASH
6680  export const REVISION
6682  export const MAX_RECORD_BYTES
6684  export const COORDINATOR_PROJECT_SNAPSHOT_SCHEMA
6687  export const PROJECT_QUEUE_STATES
6716  export function exactKeys
6741  export function plainObject
6766  export function stringArray
6796  export function nullableId
6816  export function nullableCandidateId
6842  export function nullableRecoveryId
6868  export function recoveryObligations
6947  export function resultAcceptances
7033  export function validResultReference
7058  export function nullableResultReference
7078  export function validTaskLifecycleTuple
7128  export function validCoordinatorState
7337  export function validQueueEntry
7403  export function validLeaseEvidence
7442  export function leaseAcquisitionRecoveryId
7473  export function leaseIdentity
7502  export function digest
7522  export function validId
7537  export type LeaseEvidenceContent
7560  export type LeaseEvidenceEnvelope
7573  export type CoordinatorSnapshot
7626         function validCoordinatorTaskState
7978  export function validCoordinatorSnapshot
8035  export type HistoryRow
8065  export function closedObject
8094  export function timestamp
8122  export function historyRow
8160         const INTEGRATION_RECORD_IDENTITY
8161         const INTEGRATION_BINDING_IDENTITY
8178  export function validCoordinatorResultRecord
```

### storage/protected-decision.ts

577行、トップレベル17宣言。

直接のimport／re-export元:

- `node:crypto`
- `node:fs`
- `node:path`
- `../decision/records.ts`
- `../decision/types.ts`
- `../execution/kernel-lock.ts`
- `../execution/authority.ts`
- `../../../domain-model/src/index.ts`

直接参照元（静的な相対import／re-exportの走査結果。公開Root経由の推移的利用側は別途追跡）:

- `40_Develop/coordinator/src/decision/acceptance.ts`
- `40_Develop/coordinator/src/decision/lifecycle.ts`
- `40_Develop/coordinator/src/objective/composition.ts`
- `40_Develop/coordinator/src/objective/types.ts`
- `40_Develop/coordinator/src/state/query.ts`
- `40_Develop/coordinator/tests/integration/public-operation.integration.test.ts`
- `40_Develop/coordinator/tests/integration/task-windows-decision-store.contract.test.ts`
- `40_Develop/coordinator/tests/system/task-acceptance-decision.contract.test.ts`

```text
  23  export const COORDINATOR_WINDOWS_DECISION_STORE_CONTRACT
  26         const ENTRY
  39         type VerifiedRoot
  53         type Envelope
  77         function hash
  97         function sameRoot
 123         function envelope
 158         function entryName
 178         function inspectRoot
 211         function current
 268         function result
 287         function unknown
 307         function withLock
 349         function createStore
 484  export function openRuntimeOwnedWindowsProjectDecisionStore
 530  export function createCoordinatorWindowsDecisionStoreTestingAdapter
 567  export function describeCoordinatorWindowsDecisionStoreContract
```

### storage/result-record.ts

87行、トップレベル5宣言。

直接のimport／re-export元:

- `../state/result.ts`

直接参照元（静的な相対import／re-exportの走査結果。公開Root経由の推移的利用側は別途追跡）:

- `40_Develop/coordinator/src/storage/current-state.ts`
- `40_Develop/coordinator/src/storage/model.ts`

```text
   9  export const COORDINATOR_INTEGRATION_CONTRACT
  23  export type IntegrationRecordBinding
  42  export type CoordinatorResultRecord
  65  export type CoordinatorIntegrationRecord
  82  export type CoordinatorIntegrationRecordPort
```

### storage/settlement-store.ts

7,295行、トップレベル71宣言。

直接のimport／re-export元:

- `node:crypto`
- `node:fs`
- `node:path`
- `node:util`
- `../../../docker-isolation/src/index.ts`
- `../../../domain-model/src/index.ts`
- `../../../version-control/src/index.ts`
- `../execution/observation.ts`
- `../execution/kernel-lock.ts`
- `../execution/result.ts`
- `../execution/operation.ts`
- `./model.ts`

直接参照元（静的な相対import／re-exportの走査結果。公開Root経由の推移的利用側は別途追跡）:

- `40_Develop/coordinator/src/execution/controller.ts`
- `40_Develop/coordinator/src/execution/recovery.ts`
- `40_Develop/coordinator/src/storage/current-state.ts`
- `40_Develop/coordinator/src/storage/history.ts`
- `40_Develop/coordinator/src/task/requests.ts`
- `40_Develop/coordinator/tests/integration/coordinator-state-runtime.contract.test.ts`
- `40_Develop/coordinator/tests/integration/current-host-transition.integration.test.ts`
- `40_Develop/coordinator/tests/integration/current-state-marker-cleanup.contract.test.ts`
- `40_Develop/coordinator/tests/integration/docker-recovery-owner-reentry.contract.test.ts`
- `40_Develop/coordinator/tests/integration/runtime-repair-owner.contract.test.ts`
- `40_Develop/workbench-server/scripts/verify-workspace-ai.ts`

```text
  95  export type CoordinatorStorageOwner
 103         const storageOwners
 130  export function acquireCoordinatorStorageOwner
 158         function acquireCoordinatorStorageOwnerForRepository
 211         function borrowCoordinatorStorageOwner
 245  export function isLiveCoordinatorStorageOwner
 265         type RepairWritePurpose
 289         function validateRepairWriteCandidate
 344         function authenticationUnknownAbsenceChanged
 389  export function writeRuntimeOwnedCoordinatorAuthenticationUnknownClosure
 478         const settlements
 595         function readLiveSettlement
 616  export function saveRuntimeOwnedCoordinatorOperationStart
 727  export function prepareRuntimeOwnedCoordinatorSettlement
 780  export function writeRuntimeOwnedCoordinatorSettlement
 806         const initializations
 831  export function captureRuntimeOwnedCoordinatorSettlementInputs
 869  export function settleRuntimeOwnedCoordinatorResult
1134  export function advanceRuntimeOwnedCoordinatorRecoveryHistory
1164  export function advanceRuntimeOwnedCoordinatorRepairHistory
1194         function advanceCoordinatorCurrentHistory
1353  export function registerRuntimeOwnedCoordinatorRecoveryResultDelivery
1451         const historyAttempts
1485  export function writeRuntimeOwnedCoordinatorHistoryCheckpoint
1553  export function registerRuntimeOwnedCoordinatorSettlementResultDeliveries
1616  export function completeRuntimeOwnedCoordinatorSettlement
1707  export function publishRuntimeOwnedCoordinatorHistory
1798  export function readRuntimeOwnedCoordinatorStateSnapshot
1821  export function readRuntimeOwnedCoordinatorRecoverySnapshot
1845  export function readRuntimeOwnedCoordinatorResourcePublicationSnapshot
1878  export function resumeRuntimeOwnedCoordinatorResourcePublication
1952  export function readRuntimeOwnedCoordinatorAdmissionSnapshot
1983  export function cleanupRuntimeOwnedCoordinatorStateMarker
2194  export function readRuntimeOwnedCoordinatorCurrentHistorySnapshot
2223  export function readRuntimeOwnedCoordinatorRepairHistorySnapshot
2258  export function readRuntimeOwnedCoordinatorHostCleanupRecoverySnapshot
2286  export function readRuntimeOwnedCoordinatorCurrentDeliverySnapshot
2316  export function readRuntimeOwnedCoordinatorCurrentCompletionSnapshot
2347  export function readRuntimeOwnedCoordinatorRepairCompletionSnapshot
2381  export function completeRuntimeOwnedCoordinatorCurrentRecovery
2409  export function completeRuntimeOwnedCoordinatorRepair
2437         function completeCoordinatorCurrentRecovery
2523  export function readRuntimeOwnedCoordinatorResourceRequests
2583  export function checkpointRuntimeOwnedCoordinatorResourceNotIssued
2655  export function readRuntimeOwnedCoordinatorSettlementSnapshot
2681  export function readRuntimeOwnedCoordinatorSettlementResult
2724  export function readRuntimeOwnedCoordinatorRecoveryResult
2754  export function observeRuntimeOwnedTransientTaskCompletion
2808         function projectRegisteredCoordinatorResult
2885         function readCoordinatorStateSnapshot
3807  export function readCoordinatorStorageSnapshotOwned
3846  export function writeCoordinatorStorageTaskSnapshotOwned
4073  export function prepareRuntimeOwnedCoordinatorStateInitialization
4101         function prepareCoordinatorStateInitialization
4220  export function writeRuntimeOwnedCoordinatorStateSnapshot
4247  export function resumeRuntimeOwnedCoordinatorRepairPublication
4483  export function writeRuntimeOwnedCoordinatorRepairSnapshot
4703         function prepareCoordinatorStateWrite
4906         function commitCoordinatorStateSnapshotOwned
6548         function writeCoordinatorStateSnapshot
6616         function checkpointRuntimeOwnedCoordinatorValue
6709  export function checkpointRuntimeOwnedCoordinatorRestart
6737  export function writeRuntimeOwnedCoordinatorRestartCheckpoint
6816  export function writeRuntimeOwnedCoordinatorRecoveryTerminal
6940  export function writeRuntimeOwnedCoordinatorRecoveryCheckpoint
7058  export function writeRuntimeOwnedCoordinatorRecoveredHostCleanup
7167  export function checkpointRuntimeOwnedCoordinatorResource
7196  export function checkpointRuntimeOwnedCoordinatorCleanup
7225  export function checkpointRuntimeOwnedCoordinatorHost
7254  export function checkpointRuntimeOwnedCoordinatorLifecycle
7283  export function checkpointRuntimeOwnedCoordinatorReferences
```

### state/model.ts

1,808行、トップレベル56宣言。

直接のimport／re-export元:

- `node:util`
- `node:crypto`
- `../selection/model.ts`

直接参照元（静的な相対import／re-exportの走査結果。公開Root経由の推移的利用側は別途追跡）:

- `40_Develop/coordinator/src/api.ts`
- `40_Develop/coordinator/src/decision/acceptance.ts`
- `40_Develop/coordinator/src/decision/lifecycle.ts`
- `40_Develop/coordinator/src/decision/records.ts`
- `40_Develop/coordinator/src/decision/request.ts`
- `40_Develop/coordinator/src/decision/types.ts`
- `40_Develop/coordinator/src/objective/execute.ts`
- `40_Develop/coordinator/src/objective/plan.ts`
- `40_Develop/coordinator/src/objective/replan.ts`
- `40_Develop/coordinator/src/objective/request.ts`
- `40_Develop/coordinator/src/objective/types.ts`
- `40_Develop/coordinator/src/state/initialize.ts`
- `40_Develop/coordinator/src/state/observation.ts`
- `40_Develop/coordinator/src/state/persistence.ts`
- `40_Develop/coordinator/src/state/projection.ts`
- `40_Develop/coordinator/src/state/query.ts`
- `40_Develop/coordinator/src/state/request.ts`
- `40_Develop/coordinator/src/state/types.ts`
- `40_Develop/coordinator/src/storage/current-state.ts`
- `40_Develop/coordinator/src/storage/model.ts`
- `40_Develop/coordinator/src/task/acceptance.ts`
- `40_Develop/coordinator/src/task/dispatch.ts`
- `40_Develop/coordinator/src/task/lifecycle.ts`
- `40_Develop/coordinator/src/task/recovery.ts`
- `40_Develop/coordinator/src/task/requests.ts`
- `40_Develop/coordinator/src/task/scheduling.ts`
- `40_Develop/coordinator/src/task/types.ts`
- `40_Develop/coordinator/src/workspace/commands.ts`
- `40_Develop/coordinator/tests/fixtures/accepted-task-owner.ts`
- `40_Develop/coordinator/tests/fixtures/task-persistence-fixture.ts`
- `40_Develop/coordinator/tests/fixtures/workspace-surface.ts`
- `40_Develop/coordinator/tests/integration/acceptance-decision.integration.test.ts`
- `40_Develop/coordinator/tests/integration/advice-recovery-handoff.integration.test.ts`
- `40_Develop/coordinator/tests/integration/runtime-activity.contract.test.ts`
- `40_Develop/coordinator/tests/integration/single-task-state.integration.test.ts`
- `40_Develop/coordinator/tests/integration/task-decision-recovery-store.contract.test.ts`
- `40_Develop/coordinator/tests/integration/task-durable-foundation.contract.test.ts`
- `40_Develop/coordinator/tests/integration/task-execution.contract.test.ts`
- `40_Develop/coordinator/tests/integration/task-integration-record-adapter.contract.test.ts`
- `40_Develop/coordinator/tests/integration/task-queue-priority.contract.test.ts`
- `40_Develop/coordinator/tests/integration/task-replanning-and-decision.contract.test.ts`
- `40_Develop/coordinator/tests/integration/workspace-lifecycle.integration.test.ts`
- `40_Develop/coordinator/tests/system/task-acceptance-decision.contract.test.ts`
- `40_Develop/coordinator/tests/unit/objective/plan.contract.test.ts`
- `40_Develop/coordinator/tests/unit/state/query.contract.test.ts`
- `40_Develop/coordinator/tests/unit/state/transitions.contract.test.ts`
- `40_Develop/coordinator/tests/unit/storage/model.contract.test.ts`
- `40_Develop/mcp-server/tests/integration/access-capabilities.integration.test.ts`
- `40_Develop/workbench-server/scripts/verify-workspace-ai.ts`
- `40_Develop/workbench-server/tests/integration/ai-verification.contract.test.ts`

```text
  32  export function requestCoordinatorHumanDecision
  89  export function applyCoordinatorHumanDecision
 142         function applyObjectiveAcceptance
 219         function applyMilestoneAcceptance
 270  export function applyCoordinatorAcceptanceDecision
 362  export const COORDINATOR_STATE_CONTRACT
 365  export const COORDINATOR_MAXIMUM_CONCURRENCY
 367  export const COORDINATOR_MAXIMUM_OBJECTIVES
 369  export const COORDINATOR_MAXIMUM_TASKS
 381  export type ProjectResultAcceptance
 410  export function decodeProjectResultAcceptance
 467  export type ProjectTaskState
 491  export type ProjectObjectiveState
 511  export type ProjectMilestoneState
 532  export type CoordinatorAcceptanceTarget
 545  export type CoordinatorAcceptanceDecision
 558  export type CoordinatorAcceptanceDecisionInput
 565  export const PROJECT_OBJECTIVE_STATES
 575  export const PROJECT_TASK_STATES
 600  export type ProjectObjectiveDefinition
 616  export type ProjectObjectiveRecord
 633  export type ProjectMilestoneRecord
 651  export type ProjectTaskDefinition
 670  export type ProjectTaskRecoveryKind
 688  export type ProjectTaskRecoveryObligation
 706  export type ProjectDockerRecoveryAcknowledgement
 719  export type ProjectTaskStartPhase
 737  export type ProjectTaskRecord
 764  export type CoordinatorState
 790  export type StateResult
 820  export function validIdentity
 845         function validRevision
 865  export function isCoordinatorRecoveryIdentity
 890         function uniqueStrings
 932  export function snapshotDefinition
 984         function snapshotObjectiveDefinition
1013  export function hasCycle
1049  export function projectState
1082  export function createCoordinatorState
1249  export function replaceTask
1275  export function describeCoordinatorStateContract
1305  export type ProjectQueueState
1329  export type ProjectQueueEntry
1356  export type SingleTaskRecord
1371         const KEYS
1385         const ID
1402  export function inspectSingleTaskRecord
1505  export function singleTaskQueueIsConsistent
1552         type ArraySnapshot
1572         function isPlainRecord
1604         function isDataDescriptor
1633  export function snapshotPlainRecord
1674  export function snapshotPlainArray
1739  export function normalizeRepositoryRelativePath
1775  export function repositoryPathWithin
1805  export function deriveCoordinatorRepositoryBindingId
```

### selection/model.ts

336行、トップレベル10宣言。

直接のimport／re-export元:

- `node:util`
- `node:crypto`
- `../../../domain-model/src/index.ts`
- `../../../ai-adapter/src/index.ts`

直接参照元（静的な相対import／re-exportの走査結果。公開Root経由の推移的利用側は別途追跡）:

- `40_Develop/coordinator/src/api.ts`
- `40_Develop/coordinator/src/execution/advice.ts`
- `40_Develop/coordinator/src/execution/authority.ts`
- `40_Develop/coordinator/src/execution/controller.ts`
- `40_Develop/coordinator/src/execution/preparation.ts`
- `40_Develop/coordinator/src/execution/recovery.ts`
- `40_Develop/coordinator/src/execution/request.ts`
- `40_Develop/coordinator/src/objective/execute.ts`
- `40_Develop/coordinator/src/objective/request.ts`
- `40_Develop/coordinator/src/selection/resolve.ts`
- `40_Develop/coordinator/src/state/model.ts`
- `40_Develop/coordinator/src/storage/ai-selection.ts`
- `40_Develop/coordinator/src/storage/model.ts`
- `40_Develop/coordinator/src/task/requests.ts`
- `40_Develop/coordinator/tests/fixtures/ai-selection.ts`
- `40_Develop/coordinator/tests/integration/coordinator-task-runtime.contract.test.ts`
- `40_Develop/coordinator/tests/integration/docker-effect-runtime.contract.test.ts`
- `40_Develop/coordinator/tests/unit/execution/advice-request.contract.test.ts`
- `40_Develop/coordinator/tests/unit/execution/claude-preparation.contract.test.ts`
- `40_Develop/coordinator/tests/unit/execution/codex-preparation.contract.test.ts`
- `40_Develop/coordinator/tests/unit/execution/delegation-selection-grant.contract.test.ts`
- `40_Develop/coordinator/tests/unit/execution/provider-execution.contract.test.ts`
- `40_Develop/coordinator/tests/unit/execution/task-packet.contract.test.ts`
- `40_Develop/coordinator/tests/unit/selection/resolve.contract.test.ts`

```text
  28  export type AiSelectionRole
  45  export type AiSelectionChoice
  66  export function inspectAiSelectionChoice
  99  export type AiSelectionConfig
 121  export type AiSelectionSnapshot
 136  export type ExecutionSelection
 155  export type TaskExecutionSelections
 175  export function inspectTaskExecutionSelections
 224  export function inspectExecutionSelection
 330  export function hashExecutionSelection
```
