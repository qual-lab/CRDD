# 実行モデルの責務と単一保存契約

成果物種別: Architecture詳細設計
状態: 完成操作への公開再編と今回範囲の限定回帰・独立再レビュー完了（全体回帰未実施。過去試験物の一部は由来再確定待ち）
担当責任者: Qual-Lab
最終更新日: 2026-11-14

## 独立ロード検証の所有 — 2026-11-14

EM自身の公開RootがDIなしで開始できることは、EMの既存package-boundary ITが確認する。DI側の相互ロード試験からモデル側の一枝を移し、子のerror・signal・exit・固定markerの四観測を維持する。先行するAD／DIなしの公開理由集合検証とは別の旧反例として保持し、保存・Parser・技術処置は呼ばない。DIは上位を解決できない条件で自身のRootだけを確認する。試験の移管によって公開IFや保存Schemaを変更しない。

<a id="model-boundary"></a>
## 1. 責務と依存

実行モデル（execution-model）はObjective／Task／Attempt／Queue／Workspace、Blocker・提案回答、State／History、回復記録と局所遷移・保存を所有する。Scheduling・再試行判断はCoordinator、単一技術実行はExecutor、Provider計画・解析はAI Adapter、Docker実体はDIが所有する。

3モデル間の実装・型・再export・deep import・dynamic import・package直接依存は0とする。実行モデルは設定を探索・再選定せず、構成モデルのReaderや型を受け取らない。必要なVC／Lock／Node.jsを使用し、保存契約はEM自身が定義する。旧domain-modelの互換Facadeを残さない。

`ExecutionSelection`の技術選定五項目、`OperationResources.snapshot`の非秘密資源情報、一次失敗の`turnCountDiagnostic`はEM所有の保存型とする。ADのModel選定型・診断型、DIのResourceSnapshotをEM Sourceから直接import又は型参照しない。元のProperty・閉じた値域・optional性・null許容・readonly性と既存保存検査は維持する。型の所有権変更だけを理由に保存Schemaや実行時コピー・変換Wrapperを追加しない。storageの終端観測も同じ`OperationResources["snapshot"]`を参照する。

技術型と保存型の現在の双方向構造適合はCoordinatorの既存selection-consumers Suiteで型検査し、片側の項目欠落・値域拡大・optional性・readonly性の差を検出する。これは値の認可・技術実行・永続化成功の証拠ではない。EM単独のBook値試験はEMの保存型を使い、AD／DIを必要としない。EM内に残るDI技術処理を含む連携試験のOwner移管は[変更計画§14.33–14.34](../../../99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)で別途追跡し、この型整理だけでPackage全体の依存解消を完了とは表示しない。

<a id="public-api"></a>
## 2. 公開入口と確定入力

`40_Develop/execution-model/src/index.ts`は、本番利用が必要とする完成操作と値契約を明示公開する。内部候補・汎用Helper・検証専用契約は必要性を確認してRootから外し、EM内部の試験は宣言元を参照する。外部Packageの試験は既存のRoot限定Guardを維持する。現在の公開は100項目（65値・35型）。用途別の読取り・保存・完了・履歴入口を既存の完成操作へ統合した。基準267項目から要求・表示契約と開始／終了の内部段階、用途別Checkpoint・Lease・Queue・Reader・回収保存の重複入口、外部利用のない内部型と候補生成・分類Helperを撤去した。現在の公開集合は実Rootと固定期待値の契約試験を正本とし、[当初分離時の対応案](../../../99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md#9-indextsの移管候補)とは区別する。

### モデル別CRUDとState複合取得

モデル単体のCRUD・照会は各モデルが所有する。Projectの現在値取得はState側の`readProjectExecutionState`へ一本化し、Task側の旧`readQueueProject`と重複する投影処理は撤去した。有効Schemaの不正IDは既存のID不正理由へ統一し、Schema不正の理由は維持する。

複数モデルを同じ保存版で照合する取得は`state/crud.ts`の`readState(repository, binding, scope)`が所有する。固定三範囲の選択に限定し、任意fieldや投影callback・新Store・全技術Snapshotの返却には拡張しない。未知・欠測scopeは読取り前に拒否し、既定値へ補完しない。

| scope | 同じ一回の読取りから返すfield |
|---|---|
| `intake` | `intakeEpoch`のみ。既存の出版確認用読取りを使用し、未初期化は明示的な`null` |
| `execution` | `projects`、`queueEntries`、`intakeEpoch`、`schemaRevision` |
| `workspace` | `projects`、`queueEntries`、`results`、`workspaces`、`snapshotRevision` |

元の2複合Readerの取得範囲・Rootとbindingの検査・短期Lock・明示不存在・読取り不明・解放失敗を維持する。旧`readExecutionOverview`／`readWorkspaceState`の公開・実装・互換Wrapperは残さない。4つの一般照会は、Project／Milestoneの対象限定と認可契約が異なるため今回は維持する。

Coordinatorの通常状態表示は`execution`取得結果からProjectと受付世代を投影し、追加Portの構築と同じ状態の再読取りをしない。Git改訂が異なる場合のWorkspace採用確認を挟む前後のfresh取得、排他取得後・保存後の読戻しは保持する。Workspace操作でも`workspace`範囲を同じ版で取得し、個別モデルを順番に読む方式へ分解しない。

Port単独構成の受付世代取得は`intake`へ統合し、`readSnapshotIntakeEpoch`の実装・Root公開・利用側importを撤去した。他scopeの通常読取り条件は変えない。`readState`の二引数形式は`scope: "operation" | "recovery"`と用途別inputを受ける。前者の現在Owner、後者の真正Repositoryという権限境界は元のまま区別する。内部Readerは`state/crud.ts`に一意に置き、返却内容・読取り順序は維持する。

Leaseの取得Identity・回復IDは、`acquireLease`の既存Intent保存がRepository結合・Project・Queue・種別から生成する。呼出側はOwner世代とProcess IDを渡し、保存前通知でexact回復IDを受け取る。保存成功後は同じIntentを物理取得確認へ渡す。Owner喪失照会も同じIdentityと回復IDを返し、Queue解放の不存在観測へ同じIdentityを渡す。Coでの再計算と二つのRoot生成Helperは撤去し、保存形式・物理Path・排他と回復順序は変更しない。

### 公開から外した内部契約と保持理由

`validation.ts`由来の18公開は一律に非公開化しない。資源記録の二更新は実装本体を`attempt/crud.ts`へ、明示メールからの主体構築は`state/crud.ts`へ移した。状態列挙・契約識別子・完了理由の四定義は対応モデルの`types.ts`が正本を持ち、状態型も同じ不変列挙から定義する。更新処理を呼ぶだけのWrapperや旧所在地の再exportは作らない。State候補検査が使用する資源更新と主体形式検査が使用する構築は純粋な値操作であり、保存・Root探索・外部Effectを呼ばない。宣言Ownerの移管を単独で公開数削減とは数えない。

再起動ID生成とHost遷移相関検査はRootから撤去した。前者は`readState`の`scope: "recovery"`・`restart_preparation`範囲で、対象操作と`scopeSha256`を一回の既存読取りへ結合して返す。通常Readerの確認完了と準備値の成立は別で、`restartPreparation`が非nullであり、Coの同版・排他・現在性確認も成立した場合だけ使用する。Coは既存の排他取得後の再読取りをこの範囲へ置換し、追加読取り・先行保存を行わない。後者は同版の`operationStates.hostTransition`へ投影する。新規意図は既存Writerの検査と保存後Readerを経てから実Host遷移へ使い、保存済み意図の再入場も同じ返却値を使う。実Host token・marker・recordBefore・旧世代の照合はCoに残す。

残る八公開は、`inspectDecision`、`inspectExecutionPlan`、`inspectExecutionSelection`、`inspectTaskExecutionSelections`、`isPrincipalId`、`parseDockerTaskRecoveryId`、`parseHostRecoveryToken`、`validateResourceBook`である。未保存モデルと完全Decision搬送、入口主体、Operation保存前／Host-only相関、Repository Operationとは別の認証記録、IPC後の動的QAという独立した受付を持つ。保存を伴うCRUDへ押し込むと時点・Effect順又は検証範囲が変わるため、今回の保証維持範囲では維持する。規則のCo複製、検査目的の先行保存、別名の汎用Facadeで隠さない。これらを撤去する場合は当該受付契約の変更を別途評価する。

外部で型名を参照していない16型と、外部試験だけが参照する`RecoveryCheckpointRequest`はRootから外した。モデルの内部宣言・保存形式・関数引数の型は維持する。試験のRequest型は`Parameters<typeof saveRecoveryCheckpoint>[3]`から取得し、`unknown`化や別のRequest定義は追加しない。Rootの型集合は38項目とし、この型整理段階では実体を持つ98値を維持し、その後の複合取得統合で96値、補助公開・受付照会の統合で91値となった。その後の利用側別ACK撤去と検査Owner整理を含む先行候補は74値・35型だった。今回の9入口統合後は65値・35型であり、先行段階の試験結果を現候補の完成根拠へ流用しない。`queryDecisions`／`queryExecutionState`／`queryQueue`／`queryWorkspaces`の4照会は、型名の整理と提供機能の変更を混同せず今回は維持する。

外部試験の保存fixture・故障窓の都合だけで残していた下表11宣言は、利用側を完成操作・現役の公開値契約・独立した期待DTOへ接続してRootから外した。モデル自身の候補・遷移検査は宣言元で維持し、外部の深いimportや互換Facadeへ逃がしていない。Root集合は更新済みだが、今回の限定回帰が完了するまでは候補全体の完成を表示しない。

| 内部化した用途 | 宣言 |
|---|---|
| 保存fixtureの技術断面4件 | `prepareStateCleanupSnapshot`、`prepareStateLifecycleSnapshot`、`prepareStateResourceSnapshot`、`prepareStateRestartSnapshot` |
| 修復fixtureの候補3件 | `prepareStateRepairSnapshot`、`prepareStateRepairCheckpointSnapshot`、`prepareStateRepairSessionSnapshot` |
| 履歴fixtureと故障窓4件 | `prepareRepairHistoryLine`、`prepareRepairHistorySnapshot`、`prepareStateHistoryLine`、`prepareStateHistorySnapshot` |

本番で必要な検査も、公開Helperを直接呼ぶことが必須とは限らない。履歴要約・Host更新・開始Identity・初期Hostのモデル判定は次の既存操作へ内包した。初回候補Helperの外部fixtureは公開Writerと固定入力へ接続し、Root公開を撤去した。保存codecの外部利用とRoot公開は撤去した。公開最小化全体の完了は、この局所整理だけから推定しない。

| 検査の所有と公開境界 | 本番で必要な意味 |
|---|---|
| 履歴Reader／Writerの内部検査 | `readState(root, {scope: "recovery", input: {kind: "repair_history", recoveryId}})`が要約成立を検査し、Coordinatorは同じ値検査を再実行しない |
| 操作Reader／Writerの内部検査 | `readState(owner, {scope: "operation", input: {kind: "host_cleanup", recoveryId}})`が同じ元版のHost清掃準備を検査し、元本文・対象・Host tokenを返す。一回Authorityの消費前に確認し、保存時にも元版を再検査する |
| 操作Readerの開始前取得 | `readState(owner, {scope: "operation", input: {kind: "operation_start", identityJson}})`がState読取り・Lock取得・初期化をせず、現在Ownerと初回Identityを検査し、回復ID・Identity Hash・操作IDだけを返す |
| 回復Readerの初期Host取得 | `readState(root, {scope: "recovery", input: {kind: "initial_host", recoveryId}})`と既存host_cleanup範囲が同じ版のexact一操作だけを再導出し、不変のID一覧を返す。通常currentでは再導出しない。Coは成功・元版・解放確認後だけ使い、実host_onlyとtokenを別に確認する |
| 初回候補生成 | `prepareStateOperationSnapshot`はRootから撤去。実Rootの試験は公開開始Writer、純粋観測の試験は固定入力を使い、内部候補への間接依存も残さない |
| 回復Ownerの同版保持 | CoordinatorはReaderが検査・凍結したSnapshotを既存回復記録の元本文と同じ版で保持する。再decodeせずHost・consumer判定に使い、保存結果とfresh Readerの改訂・Hash・解放確認後だけ両方を更新する |
| Coordinatorの入力捕捉 | 公開受入・認証通知・資源作成通知・Host checkpointの入力コピーは既存`input/snapshot.ts`の`snapshotJsonValue`を使う。保存codecのroundtripを使わず、未知実行の拒否と参照分離を維持する。保存本文の正規符号化・Hash・比較は別の既存契約であり、JSON.stringifyへ置換しない |

開始前取得の`kind: "operation_start"`・`status: "completed"`・`operationIdentity`は事前検査範囲の共同結果で、`value`はnullである。`lockReleased:true`はこの範囲でLockを取得していないことを表し、保存・開始許可・現在Stateの観測を意味しない。Getter等の不正入力、別操作Owner、最終再検証失敗では相関を返さず、StateReaderにも進まない。保存時の再検査・重複判定は`saveOperationStart`に残す。

Host清掃確定ではWriterが正規候補を生成・検査する。Coordinatorは保存結果のrevision／payloadSha256とfresh Readerの一致、同じ回復ID・Host token・cleanup確定を確認し、確認済み本文だけを次の元版に使う。利用側で次Snapshotを再構築しない。試験の既知Host差分期待値は、対象外全文・前改訂・元Hashを明記した独立DTOとし、製品validationの代替実装にはしない。

### 要求・表示契約と開始／終了の境界

Objectiveの実行要求、状態照会・公開投影、判断操作の要求／応答、WorkspaceCommand、活動一覧はCoordinatorの既存Sourceが所有する。EMは保存モデルとその検査を所有し、Coordinatorへ依存しない。`inspectDecision()`は判断モデル自身の検査であり、Coordinatorが保存用の符号化や履歴投影を代用しないための入口である。

判断操作は完全な質問・選択肢・回答者・日時・理由・適用結果を返す。同じProcess内ではEMの完成操作が返した検査済み値を搬送し、表示のためだけに再検査・再照会しない。未知のProcess結果を受け付ける場合は、Coordinatorの既存結果受付がEMのモデル検査を一度使用し、その独立捕捉済みの返却値を結果へ載せる。検査段階を減らすために応答情報を削ったり、同じモデル規則を利用側へ複製したりしない。

`saveOperationStart()`は初回記録の保存後に、同じ元Owner・Repository・exact回復参照へ終端Contextを固定する。開始保存と終端準備は別の成立事実として`startSaved`と`completionContext`を返す。保存済みでも準備が失敗したら全体はblockedとなり、Host要求を発行せず、元参照・保存Effectを保持する。統合結果のlockReleasedは先行Writerと後続準備Readerの両方を反映し、準備Readerの拒否理由・解放不明を保持する。準備例外時は解放済みと推定しない。ContextはProcess内だけで使用し、保存値から復元しない。

`completeOperation()`は元Host結果と元Controller結果の参照一致を内部で固定し、入力受理を`inputAccepted`として保存結果と別に返す。受理後の保存失敗・例外でも同じ元入力を上位が保持できるようにし、別参照への差替えは拒否する。実Writerが保持する発行済みEffect・保存未確定・Lock解放不明は畳まない。Taskに結合したOperationはTask終端と同じStateで終了し、Task非関連のOperationは技術終端・履歴確認後に終了する。利用側の配送ACKは終了条件にしない。

<a id="repair-write-contract"></a>
### Checkpoint・Lease・Queue・回復読取りの契約

正常なState Readerの`value.operationStates`は、同じ`value.snapshot.operations`の操作参照とモデル判定を不変の組で返す。実行操作は`resourcesSettled`／`restartSettled`／`authenticationClosureAllowed`、修復操作は`disposalSettled`を持つ。失敗・観測不能から空の成功観測を作らない。利用側はIDだけで別版の操作と組み合わせず、同じ操作参照を照合して使用する。回復Ownerの保持Snapshotを交換するときは観測も一緒に更新し、認証の分岐はEffect前のfresh取得に従う。Reader内の値投影のみで、追加I/O・保存field・Authorityは作らない。旧四判定関数のRoot公開とCo本番呼出しは撤去した。モデル検査自体はEM内部に維持する。

出版済みStateの本文と排他を確認し、短命markerを除去して不存在を確認する処理は、`state/crud.ts`の`completeStatePublication`が所有する。`storage/store.ts`の旧`removeStatePublicationMarker`は実装・Root公開とも撤去し、互換Wrapperは作らない。修復再入場と終了時の呼出し位置、個別の処置／不存在／本文保全／解放結果を維持する。State出版の確定はTask成功・技術回復完了とは別の事実である。

`saveRepairState()`の成功valueは、確認済み`operation`・`version`に対応する`checkpointSettled`と`disposalSettled`を返す。通常保存と同値の再観測で同じ契約を使い、保存不明・排他解放不明のvalueは`null`とする。Coordinatorは最終Checkpointの保存成功後、その判定を既存のEngine・Host安全性・Cleanup・Lifecycle条件と組み合わせる。八処置の値上の終端だけで修復全体の成功を表示しない。`isRepairCheckpointSettled`のRoot公開とCoでの再検査は撤去し、EM内部とDI内部の技術検査は維持する。

`saveOperationCheckpoint()`はresource／cleanup／host／lifecycle／references／restartを固定種別として受け、同じlive Owner・操作ID・改訂から保存候補を生成する。referencesでも対象外区画と現在Operationの相関を保持する。回復Owner向けの保存やHost事前検査をこの入口の権限へ混ぜない。

`saveRecoveryCheckpoint()`は回収中の途中更新・再起動・終端・Host清掃確定を固定種別として受ける。途中・再起動・終端は元の同期Owner確認、Host清掃確定は`assertAbsentOwner`とexact出版候補を要求し、証拠を相互代用しない。現在状態・履歴・技術終端の照合と各Readerの解放確認を維持する。live Host準備と正式未発行の元Controller照合は、それぞれ別の完成操作として維持する。

未確認履歴の出版途中から終端へ再入場する場合は、その履歴Readerが要求する保持日数と現在性確認を上位が同じ入力へ搬送する。Coordinatorは元Snapshotのexact操作に未確認履歴がある場合だけ既存の設定接続を使い、通常終了・確認済み履歴・他操作を理由に設定読取りを増やさない。保持設定不正・途中変更の拒否、元版一致・Host不存在・Ownerの一回性は維持する。

Leaseは`acquireLease()`・`releaseLease()`・`recoverLease()`・`readLease()`、Queueは`createQueue()`・`updateQueue()`へ用途固定の処置を集約する。Requestのkindごとに元の必須tuple型を持ち、共通のOptional集合や任意更新Callbackは受けない。入力tupleは既存のown-data配列捕捉で固定し、Getter・Proxy・疎配列・独自iterator・余剰symbolと不正arityを保存前に拒否する。Root観測Callbackは捕捉した値として保持し、実行は従来どおり短期Lock内の現在Rootへ結合する。保存Intentと物理処置後の観測は区別し、物理Lock取得・解放・回復はCoordinatorが所有する。

`readState(root, {scope: "recovery", input: request})`はcurrent／restart_preparation／admission／history／resource_publication／host_cleanup／initial_host／execution_history／repair_history／execution_completion／repair_completionの固定取得範囲を持つ。各範囲の元ID検査・保存途中の照合条件を保持し、通常Readerの拒否を自動的に別範囲へfallbackしない。restart_preparationだけが元回復IDとscopeSha256を必要とし、他範囲への余剰scopeは読取り前に拒否する。live Ownerからの読取りと回復Ownerによるfreshな終端確認を区別し、配送・ACK専用の取得範囲は持たない。

`kind: "history"`はrecoveryIdを持たない閉じた要求で、初期化済みStateと同じ短期Lock内にある履歴を全行検査する。成功・値あり・解放確認・`historyRows !== null`の共同成立後だけ利用し、真正不存在は不変の空配列、不正・観測不能・pending・実体変化・解放不明は値なしの停止とする。取得途中の存在／不存在変化も最終照合し、部分行を返さない。通常currentの追加履歴I/Oは0で、`historyRows:null`は未要求を表す。履歴Queryに保持設定の読取り・変更や操作Authorityを追加しない。Workbench検証scriptはこの完成操作を使い、履歴の直接File読取りとdecoder呼出しを再実装しない。

State Readerの成功valueは、検査済みSnapshot・本文Hashと同じ読取りから`sourceText`を返す。これはUTF-8・正規JSON・末尾LFを検査したstate.json原文であり、pending候補や利用側で再生成した本文ではない。最終File同一性・現在Owner・Lock終了などの成功条件を変えず、拒否時はvalueを返さない。文字列と成功valueは不変とし、追加I/O・公開関数・Authorityは作らないが、本文文字列分のメモリ保持は増える。Coordinatorは元本文・Writer入力・全文比較にこの原文を使用し、SnapshotのJSON再生成をしない。原文を新しいログ・HTTP応答へ丸ごと転送しない。Coordinatorの値比較は既存のown-data捕捉後にNode.js標準で行い、保存用encoderを使わない。外部試験の固定値生成は既存試験用JSON処理へ接続済みであり、保存codecはEM内部へ閉じる。

外部試験でも、実保存済み履歴の確認はこのReader又は対象用途の完成観測へ接続する。履歴として有効な別consumer・別相関の行を、全履歴Readerが無条件に拒否することは要求しない。同じ操作の終了観測が対応関係を別に検査する。一次失敗・Command観測の純粋な値検査はEMのunit試験が実検査関数を直接確認し、CoordinatorのITから内部関数を抽出しない。正常Owner結合試験も、修復直後と後続Task各段階の実履歴を公開Readerで取得し、元修復行の本文・時刻・両Hashと件数を照合する。引数だけの変異・重複を実File不一致として拒否する対照と、EMが所有する実履歴の構文検査を区別する。子Processの保存途中の確認には既存の用途固定Readerが検査した履歴本文を使い、pendingを通常Queryへ通す例外は作らない。外部の履歴decoder依存は撤去済みであり、decodeHistoryRowsはEM内部の値検査と試験だけが使用する。Rootは全履歴取得の完成Readerを公開する。State decoderと保存用encoderの外部直接利用も撤去し、両関数のRoot公開を廃止した。実保存の検査は完成Readerへ、過去版・保存前候補の期待値は既知fixture本文の局所投影とraw Hashへ分離する。外部の固定値生成には既存の試験用canonicalJsonを使い、Schema検査の代役にはしない。EM自身の値検査試験は内部宣言元を使う。

汎用のRecord／Array捕捉・Object／key検査はEM Rootから公開しない。Coordinatorの入力捕捉には既存input/snapshot.tsを使用し、保存codecや内部Snapshot生成を入力検査の代用にしない。外部試験は宣言済みRootの完成操作又は現役の値契約だけを使い、Root限定Guardを維持する。

### 修復更新の完成InputとResult

`saveRepairState`は、`attempt/types.ts`の`RepairSaveRequest`として期待するStateVersion又は初回のnullと、create／checkpoint／session_begin／retention_handoff／disposal_decision／disposal_progressの六つの固定論理更新を受ける。Coordinatorは次Snapshotや符号化byteを生成して渡さず、EMが同exact対象・期待改訂／Hash・現在Ownerを照合して候補を構築する。相関、非対象の全文保全、正規符号化、単一WriterのCAS・一回consume・解放確認は維持する。

成功・保存確認・排他解放が共同成立した場合だけ、確定Versionと対象Repair Operationをvalueとして返す。不明／拒否時に新しい改訂や候補を利用側の正本へ補完せず、Coordinatorは既存のsticky停止と元回復参照を保持する。期待改訂不一致の自動再読込み・再基準化・再試行は追加しない。

State全体の候補生成は、Task・Operation・Decision・履歴等を一つの保存改訂へ結合する跨モデル責務である。名前にRepairやTaskを含むことだけを理由に別validationへ移さず、単一CASとSource Mapを分断しない。モデル内validationの既存相互参照は今回一律に解消せず、他二モデルとの直接依存0というPackage境界と区別する。

ExecutionSelection、inspectExecutionSelection、TaskExecutionSelectionsと担当組の保存検査は実行モデルに置く。Hash生成はEMの内部利用がなく、Coordinatorの既存selection/resolveが正規化済み選定を同じbyte・SHA-256で識別する。ADのModelSelectionを基礎に当時のcatalogIdentity／configIdentity／role／workType／sourceを固定する。CoordinatorがConfigとADの解決結果を明示投影し、実行モデルは役割・選定相関・形式を自身の境界で検査する。Hashの正規化順序・保存JSON・設定取得時の意味は変更しない。

保存WriterもReaderと同様に、検査済み選定二件と組を不変値として返す。JSON由来の保存値を検査した時点で一度だけ凍結し、その後のCoordinatorの状態遷移とTask要求構築は同じ値を搬送する。未信頼のTask要求は受付で一度捕捉し、同じ受付内でモデル検査を繰り返さない。Root公開の要否と検査自体の要否は分けて評価し、検査済み返却値の再利用だけで外せる経路と、未保存入力・Process結果の境界を区別する。

<a id="consumers"></a>
### 内部の24ファイル構成

`index.ts`と、objective／task／attempt／decision／workspace／state／historyの各`crud.ts`・`validation.ts`・`types.ts`、`storage/store.ts`・`storage/lock.ts`で構成する。各crudは完成保存操作、validationは局所候補・検査、typesは契約を所有する。

固定所在、共通File読取り／書込み、一時保存資源のI/Oは`storage/store.ts`、共通の排他取得・保持・解放と保存Ownerは`storage/lock.ts`が所有する。State固有のCAS・出版／回復と、短命Mapに結合したEffect順序は`state/crud.ts`が所有し、共通保存primitiveへ接続する。出版・回復では同File自身がrename／unlink等も発行するため、全物理I/Oをstoreへ集約したとは扱わない。Stateの短命Mapと一回使用Protocolは一体で置き、重複実体や中継だけのWrapperを作らない。

共通Record取得は既存snapshotStateRecordへ統一し、同じ受理域のsnapshotPlainRecord実装と別名Wrapperは残さない。配列二種の理由分類・引数検査、およびdescriptor検査は条件が異なるため今回変更しない。

旧repository／identity／plain-dataのSource分散と旧PathのWrapperは残さない。機密検査の7値公開は撤去し、AIへの送信境界を所有するCoordinatorのinput/secret-validationへ移した。先行の24 Source整理では他のRoot公開を維持し、その後267項目へ縮減した段階を経て、現行集合は§2の100項目となる。各段階を通して、保存先・Schema・Hash・Lock Identity・CAS・現在性確認・失敗／回復相関は不変更とする。

## 3. 保持設定と利用側

基底ExecutionModelAccess／OperationStorageAccessと通常Queryは不変更。保持日数を消費する保存操作・履歴処理分岐だけ、既存Inputに履歴保持日数を加える。非履歴Query／Recovery入口を設定不正で一律停止しない。

上位Consumerは履歴確認を求められた既存revalidate呼出しに限り、現在設定がreadyで期待保持日数と同じことを結合する。履歴Input側の既存revalidateは任意の最終引数expectedHistoryRetentionDaysを受け、通常呼出しは従来引数のまま設定Readerを呼ばない。元runtime-storeの6箇所・runtime-historyの4箇所の当該枝・Effect順序へ対応付ける。Root単体のRecovery・修復出版再入場と履歴保守も取り残さない。

履歴と配送の一回保存Ownerも任意の期待保持日数を元repository.revalidateへ転送し、active・Map同一性・used・元Owner照合と日数の途中変更拒否を両立する。通常の引数なし再検証へ設定読取りを追加しない。

新しい設定Callback field・Context階層・Reader注入は作らない。追加引数を渡しただけでは比較成立とせず、本番Consumerの現在性確認と途中設定変更の負例で検証する。設定不存在時30日と明示30日を新たに区別せず、Config Hashや世代一致も追加しない。

<a id="storage"></a>
## 4. 保存・初期化・回復

保存先は既存`.crdd/domain-model/`のstate.json・history.jsonl等を維持する。Package名と保存Identityは別であり、Schema・契約ID・Lock Path／Hash namespace・CAS・Principal・回復参照・履歴保持条件を変更しない。自動移行・旧形式Reader・過去保持物の操作は追加しない。

State／Task／Queue／Decision／回復義務は既存の単一SnapshotとWriterで扱う。History確認前に必要な判断記録を退役させず、未確認・部分Effect・配送・回復相関を落とさない。既存Blocker 1:N提案回答、未適用・解消・中止を維持する。

初期化作成と旧coordinator領域の不存在確認はstorage/store.ts内部へ一緒に置く。真正不存在、親実体の前後一致、排他的作成、空の新規領域を維持し、一般ensureで既存領域を新品としない。旧署名準備の専用Temporary Operationは、本番Callerがa04ecb703で撤去済みのため、作成・再開・根拠昇格・終了・専用Map／型／検証Variantまで代替なしで退役する。汎用の一時操作Storeは作らない。共有の領域・固定File I/Oと通常State／Attempt回復は維持する。過去のtmp／.operations文書の有無は未走査で、旧APIによる再開・清掃を提供せず、由来不明物は保全し個別承認の対象確認へ委ねる。

領域確保の失敗は既存ExecutionStorageBlockedErrorを実行失敗契約として公開し、Coのinstanceof投影へ接続する。単なる一般Errorや未実施に変換せず、Effect不明・Cleanup・元回復参照を保持する。宣言はstorage/store.tsで所有し、他モデルのReturnTypeへ依存しない。

局所I/O・EOF・close・Getter／Proxy拒否は各入力／保存Ownerへ必要分を置く。共通Helper全文の複製や第4Packageは作らない。詳細な局所遷移・出版の契約は[API・単一保存](05_Runtime_Domain.md)を参照する。保持設定・Owner配置の新しい境界は本書を正本とする。

<a id="verification"></a>
## 5. 検証と未確認

公開集合、3モデル直接依存0、全Consumer型、State／History／CAS／Lock、初期化・途中失敗・回復・Receipt／相関を既存試験へ対応付ける。保持設定の初回不成立・途中変更・同値と、設定不正でも非履歴処理を止めない対照を含む。

型・Source移管だけで保存や再入場の成立を主張しない。限定回帰と独立確認は[変更計画](../../../99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)へ記録する。全体回帰・実AI・Docker・過去保持物の操作は今回実施しない。

先行267項目段階の固定候補ではSource・試験・台帳・文書の独立レビューを完了し、当該範囲の必須残指摘は0。Ownerの限定回帰は13親・45子の58件を正常終了し、その実行では途中停止・再実行・期限変更は行っていない。各fixtureの終了hookに例外報告はなかった。関係八型設定・台帳関係の限定検査も成功した。これは後続の公開整理候補の完成根拠ではない。当時の試験・未確認・未回収は変更計画§14.3で区別し、各限定集合の重複を合算せず、全体回帰や公開最小化の完成へ拡大しない。

### 補助検査の公開境界

validId・validWorkspaceDisplayName・validWorkspaceCandidateRequestはモデル内の保存検査として維持しRoot公開しない。CoordinatorのID入力は既存のstate/validation、Workspaceコマンドの表示名・Path・選択は既存commandsで確認する。仮のCandidateをPath検査のために組み立てず、Git接続は保存が受理したCandidate Intentを使う。汎用の採用結果本文は検証済みWorkspaceモデルと同一視せず、Coordinatorが利用するIdentity・Commit相関を確認する。

verifyQueueIntakeとCoordinatorの委譲入口は撤去する。新StateはsaveProjectExecutionState、既存StateはcreateQueueの同じ短期保存排他内でsnapshotIntakeMatchesを用い、受付世代・Queue・要求Hash・Project・Milestoneの相関を保存前に確認する。古い受付の明示未保存拒否と保存／解放不明は区別し、後者をno_effectへ変換しない。

validateResourceBookはCoordinator所有の認証回復ファイルを読む独立境界と、保存済みQAイベント列の検査に必要な受付である。後者はbeforeを明示して同じ内部の遷移正本を利用する。validateResourceBookTransitionの独立Root公開は撤去した。別記録をEMのState Readerが検査済みと扱わず、同義Wrapper・履歴の再構築・汎用検査Frameworkは作らない。外部の保存代役はapplyResourceEvent／applyResourceCleanupの検査済み結果を使用する。

WorkspaceResultとinspectWorkspaceResultはCoordinatorの結果搬送契約であり、EMの保存モデルではないためCoordinatorの既存workspace/record.tsへ移す。EMからの宣言・Root公開は撤去し、相対Path・欠測・変更相関・参照分離・getter／Proxy拒否の試験は新Ownerで維持する。

inspectSingleTaskRecordはQueueの保存・読取り内部に閉じる。単発更新のWriterは未検証入力を捕捉し、Lease観測や更新候補生成の前に記録の閉形式と終端相関を検査する。CoordinatorはWriterが返したsingleTaskを次の現在値として使用する。実行Adapterの用途結果はCoordinator自身が検査し、検査のために仮のPrincipal・Task・Attemptを生成しない。保存後の表示を保存前の成功へ読み替えない。


### 読取り・Checkpoint・回復結果の共通入口

- 三引数の表示用readStateは既存の取得範囲を維持する。二引数のoperation／recoveryはそれぞれのOwner・元版・Lock条件で検査し、未知scope・余剰field・Getterを読取り前に拒否する。
- saveRecoveryCheckpointは既存更新に加え、resource_not_issued・host_cleanup_preparation・authentication_unknown_closureを同じ閉集合で受ける。未発行は元Operationの現在Owner、Host準備は元本文と再読取り、認証終了は元Ownerと二回の不存在観測・一回証拠の検査を維持する。
- completeRecovery／advanceOwnedRecoveryHistoryはdocker_task／runtime_repairを必須引数で区別する。未知用途はOwner callbackと保存前に拒否する。旧固定用途Wrapperは置かない。
- validateResourceBookのbefore指定は同じ内部の遷移検査へ接続する。省略時は値検査だけであり、呼出側が必要な比較を省略してよいという変更ではない。
- 読取り専用のreadOperationResourcesStageは撤去し、既存operation取得結果からexact回復IDの資源を取得する。追加読取り・技術操作は行わない。

保存Schema、Authority、Lock／CAS、認証終了の一回証拠と通知順序は変更しない。通常の利用側も試験・生成子SourceもRootの共通入口を利用し、内部実装への迂回は追加しない。
