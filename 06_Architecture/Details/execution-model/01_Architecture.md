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

`40_Develop/execution-model/src/index.ts`は、本番利用が必要とする完成操作と値契約を明示公開する。内部候補・汎用Helper・検証専用契約は必要性を確認してRootから外し、EM内部の試験は宣言元を参照する。外部Packageの試験は既存のRoot限定Guardを維持する。現在の公開は93項目（58値・35型）。用途別の読取り・保存・完了・履歴入口を既存の完成操作へ統合した。基準267項目から要求・表示契約と開始／終了の内部段階、用途別Checkpoint・Lease・Queue・Reader・回収保存の重複入口、外部利用のない内部型と候補生成・分類Helperを撤去した。現在の公開集合は実Rootと固定期待値の契約試験を正本とし、[当初分離時の対応案](../../../99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md#9-indextsの移管候補)とは区別する。

### モデル別CRUDとState複合取得

モデル単体のCRUD・照会は各モデルが所有する。Projectの現在値取得はState側の`readProjectExecutionState`へ一本化し、Task側の旧`readQueueProject`と重複する投影処理は撤去した。有効Schemaの不正IDは既存のID不正理由へ統一し、Schema不正の理由は維持する。

複数モデルを同じ保存版で照合する取得は`state/crud.ts`の`readState(repository, binding, scope)`が所有する。固定四範囲の選択に限定し、任意fieldや投影callback・新Store・全技術Snapshotの返却には拡張しない。未知・欠測scopeは読取り前に拒否し、既定値へ補完しない。

| scope | 同じ一回の読取りから返すfield |
|---|---|
| `intake` | `intakeEpoch`のみ。既存の出版確認用読取りを使用し、未初期化は明示的な`null` |
| `queue` | `queueEntries`、`leaseIntents`、`intakeEpoch`を通常Readerの同版一回から返す |
| `execution` | `projects`、`queueEntries`、`intakeEpoch`、`schemaRevision` |
| `workspace` | `projects`、`queueEntries`、`results`、`workspaces`、`snapshotRevision` |

元の2複合Readerの取得範囲・Rootとbindingの検査・短期Lock・明示不存在・読取り不明・解放失敗を維持する。旧`readExecutionOverview`／`readWorkspaceState`の公開・実装・互換Wrapperは残さない。通常のQueue一覧照会は維持する。Decision＋Blocker、Project＋管理実行、Queue参照限定Workspaceの三特殊Queryは本番利用がなく、通常CRUDへ限定する後続整理で廃止した。

Coordinatorの通常状態表示は`execution`取得結果からProjectと受付世代を投影し、追加Portの構築と同じ状態の再読取りをしない。Git改訂が異なる場合のWorkspace採用確認を挟む前後のfresh取得、排他取得後・保存後の読戻しは保持する。Workspace操作でも`workspace`範囲を同じ版で取得し、個別モデルを順番に読む方式へ分解しない。

Port単独構成の受付世代取得は`intake`へ統合し、`readSnapshotIntakeEpoch`の実装・Root公開・利用側importを撤去した。他scopeの通常読取り条件は変えない。`readState`の二引数形式は`scope: "operation" | "recovery"`と用途別inputを受ける。前者の現在Owner、後者の真正Repositoryという権限境界は元のまま区別する。内部Readerは`state/crud.ts`に一意に置き、返却内容・読取り順序は維持する。

Leaseの取得Identity・回復IDは、`acquireLease`の既存Intent保存がRepository結合・Project・Queue・種別から生成する。呼出側はOwner世代とProcess IDを渡し、保存前通知でexact回復IDを受け取る。保存成功後は同じIntentを物理取得確認へ渡す。Owner喪失照会も同じIdentityと回復IDを返し、Queue解放の不存在観測へ同じIdentityを渡す。Coでの再計算と二つのRoot生成Helperは撤去し、保存形式・物理Path・排他と回復順序は変更しない。

### 公開から外した内部契約と保持理由

資源記録の二更新とBook／遷移検査は`attempt/operations.ts`、明示メールからの主体構築と形式検査は`state/operations.ts`が実体を持つ。状態列挙・契約識別子・完了理由は対応モデルの`types.ts`を正本とする。旧所在地の再exportや中継Wrapperは作らず、宣言Ownerの移管自体を公開削減とは数えない。これらの値操作は保存・Root探索・外部Effectを呼ばない。

再起動ID生成とHost遷移相関検査はRootから撤去した。前者は`readState`の`scope: "recovery"`・`restart_preparation`範囲で、対象操作と`scopeSha256`を一回の既存読取りへ結合して返す。通常Readerの確認完了と準備値の成立は別で、`restartPreparation`が非nullであり、Coの同版・排他・現在性確認も成立した場合だけ使用する。Coは既存の排他取得後の再読取りをこの範囲へ置換し、追加読取り・先行保存を行わない。後者は同版の`operationStates.hostTransition`へ投影する。新規意図は既存Writerの検査と保存後Readerを経てから実Host遷移へ使い、保存済み意図の再入場も同じ返却値を使う。実Host token・marker・recordBefore・旧世代の照合はCoに残す。

残る八公開は、`inspectDecision`、`inspectExecutionPlan`、`inspectExecutionSelection`、`inspectTaskExecutionSelections`、`isPrincipalId`、`parseDockerTaskRecoveryId`、`parseHostRecoveryToken`、`validateResourceBook`である。未保存モデルと完全Decision搬送、入口主体、Operation保存前／Host-only相関、Repository Operationとは別の認証記録、IPC後の動的QAという独立した受付を持つ。保存を伴うCRUDへ押し込むと時点・Effect順又は検証範囲が変わるため、今回の保証維持範囲では維持する。規則のCo複製、検査目的の先行保存、別名の汎用Facadeで隠さない。これらを撤去する場合は当該受付契約の変更を別途評価する。

現在のRootは93項目（58値・35型）で、外部の完成操作・入力受付・モデル語彙として必要な集合を維持する。過去の件数推移・内部化対象・段階ごとの検証は[変更計画](../../../99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)に記録し、現行契約と混在させない。内部型は宣言元に保持し、外部試験のためだけの型公開やunknownへの置換を行わない。

外部試験の保存fixture・故障窓だけで必要だった下表11宣言は内部に閉じる。利用側は完成操作・現役の公開値契約・独立した期待DTOを使用し、外部Packageからの深いimportや互換Facadeを作らない。モデル自身の候補・遷移検査は宣言元で維持する。

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

保存markerの`domain-model/state.lock`と専用`completeStatePublication`は撤去した。排他は共通Lock、更新候補はpending、確定内容はcurrentと履歴を正本とする。通常Readerはpending・未知File・旧marker残存を拒否し、明示再入場では元版/候補/回復ID/Owner/実体/履歴の照合を維持する。rename済み・pendingなしの正常currentはfresh読取りできるが、前回Writer成功や耐久確定を推定しない。Coordinatorは既存の履歴付きReaderと終了後の相関付きReaderを使い、新Wrapperを追加しない。

`saveRepairRecord()`の成功valueは、確認済み`operation`・`version`に対応する`checkpointSettled`と`disposalSettled`を返す。通常保存と同値の再観測で同じ契約を使い、保存不明・排他解放不明のvalueは`null`とする。Coordinatorは最終Checkpointの保存成功後、その判定を既存のEngine・Host安全性・Cleanup・Lifecycle条件と組み合わせる。八処置の値上の終端だけで修復全体の成功を表示しない。`isRepairCheckpointSettled`のRoot公開とCoでの再検査は撤去し、EM内部とDI内部の技術検査は維持する。

`saveOperationCheckpoint()`はresource／cleanup／host／lifecycle／references／restartを固定種別として受け、同じlive Owner・操作ID・改訂から保存候補を生成する。referencesでも対象外区画と現在Operationの相関を保持する。回復Owner向けの保存やHost事前検査をこの入口の権限へ混ぜない。

`saveRecoveryCheckpoint()`は回収中の途中更新・再起動・終端・Host清掃確定を固定種別として受ける。途中・再起動・終端は元の同期Owner確認、Host清掃確定は`assertAbsentOwner`とexact出版候補を要求し、証拠を相互代用しない。現在状態・履歴・技術終端の照合と各Readerの解放確認を維持する。live Host準備と正式未発行の元Controller照合は、それぞれ別の完成操作として維持する。

未確認履歴の出版途中から終端へ再入場する場合は、その履歴Readerが要求する保持日数と現在性確認を上位が同じ入力へ搬送する。Coordinatorは元Snapshotのexact操作に未確認履歴がある場合だけ既存の設定接続を使い、通常終了・確認済み履歴・他操作を理由に設定読取りを増やさない。保持設定不正・途中変更の拒否、元版一致・Host不存在・Ownerの一回性は維持する。

Leaseは`acquireLease()`・`releaseLease()`・`recoverLease()`・`readLease()`、Queueは`createQueue()`・`updateQueue()`へ用途固定の処置を集約する。Requestのkindごとに元の必須tuple型を持ち、共通のOptional集合や任意更新Callbackは受けない。入力tupleは既存のown-data配列捕捉で固定し、Getter・Proxy・疎配列・独自iterator・余剰symbolと不正arityを保存前に拒否する。Root観測Callbackは捕捉した値として保持し、実行は従来どおり短期Lock内の現在Rootへ結合する。保存Intentと物理処置後の観測は区別し、物理Lock取得・解放・回復はCoordinatorが所有する。

`readState(root, {scope: "recovery", input: request})`はcurrent／restart_preparation／admission／history／resource_publication／host_cleanup／initial_host／execution_history／repair_history／execution_completion／repair_completion／completionの固定取得範囲を持つ。各範囲の元ID検査・保存途中の照合条件を保持し、通常Readerの拒否を自動的に別範囲へfallbackしない。completionは回復IDと上位相関IDを必須とする。restart_preparationだけが元回復IDとscopeSha256を必要とし、他範囲への余剰scopeは読取り前に拒否する。live Ownerからの読取りと回復Ownerによるfreshな終端確認を区別し、配送・ACK専用の取得範囲は持たない。

`kind: "history"`はrecoveryIdを持たない閉じた要求で、初期化済みStateと同じ短期Lock内にある履歴を全行検査する。成功・値あり・解放確認・`historyRows !== null`の共同成立後だけ利用し、真正不存在は不変の空配列、不正・観測不能・pending・実体変化・解放不明は値なしの停止とする。取得途中の存在／不存在変化も最終照合し、部分行を返さない。通常currentの追加履歴I/Oは0で、`historyRows:null`は未要求を表す。履歴Queryに保持設定の読取り・変更や操作Authorityを追加しない。Workbench検証scriptはこの完成操作を使い、履歴の直接File読取りとdecoder呼出しを再実装しない。

State Readerの成功valueは、検査済みSnapshot・本文Hashと同じ読取りから`sourceText`を返す。これはUTF-8・正規JSON・末尾LFを検査したstate.json原文であり、pending候補や利用側で再生成した本文ではない。最終File同一性・現在Owner・Lock終了などの成功条件を変えず、拒否時はvalueを返さない。文字列と成功valueは不変とし、追加I/O・公開関数・Authorityは作らないが、本文文字列分のメモリ保持は増える。Coordinatorは元本文・Writer入力・全文比較にこの原文を使用し、SnapshotのJSON再生成をしない。原文を新しいログ・HTTP応答へ丸ごと転送しない。Coordinatorの値比較は既存のown-data捕捉後にNode.js標準で行い、保存用encoderを使わない。外部試験の固定値生成は既存試験用JSON処理へ接続済みであり、保存codecはEM内部へ閉じる。

外部試験でも、実保存済み履歴の確認はこのReader又は対象用途の完成観測へ接続する。履歴として有効な別consumer・別相関の行を、全履歴Readerが無条件に拒否することは要求しない。同じ操作の終了観測が対応関係を別に検査する。一次失敗・Command観測の純粋な値検査はEMのunit試験が実検査関数を直接確認し、CoordinatorのITから内部関数を抽出しない。正常Owner結合試験も、修復直後と後続Task各段階の実履歴を公開Readerで取得し、元修復行の本文・時刻・両Hashと件数を照合する。引数だけの変異・重複を実File不一致として拒否する対照と、EMが所有する実履歴の構文検査を区別する。子Processの保存途中の確認には既存の用途固定Readerが検査した履歴本文を使い、pendingを通常Queryへ通す例外は作らない。外部の履歴decoder依存は撤去済みであり、decodeHistoryRowsはEM内部の値検査と試験だけが使用する。Rootは全履歴取得の完成Readerを公開する。State decoderと保存用encoderの外部直接利用も撤去し、両関数のRoot公開を廃止した。実保存の検査は完成Readerへ、過去版・保存前候補の期待値は既知fixture本文の局所投影とraw Hashへ分離する。外部の固定値生成には既存の試験用canonicalJsonを使い、Schema検査の代役にはしない。EM自身の値検査試験は内部宣言元を使う。

汎用のRecord／Array捕捉・Object／key検査はEM Rootから公開しない。Coordinatorの入力捕捉には既存input/snapshot.tsを使用し、保存codecや内部Snapshot生成を入力検査の代用にしない。外部試験は宣言済みRootの完成操作又は現役の値契約だけを使い、Root限定Guardを維持する。

### 修復更新の完成InputとResult

`saveRepairRecord`は、`attempt/types.ts`の`RepairSaveRequest`として期待するStateVersion又は初回のnullと、create／checkpoint／session_begin／retention_handoff／disposal_decision／disposal_progressの六つの固定論理更新を受ける。Coordinatorは次Snapshotや符号化byteを生成して渡さず、EMが同exact対象・期待改訂／Hash・現在Ownerを照合して候補を構築する。相関、非対象の全文保全、正規符号化、単一WriterのCAS・一回consume・解放確認は維持する。

成功・保存確認・排他解放が共同成立した場合だけ、確定Versionと対象Repair Operationをvalueとして返す。不明／拒否時に新しい改訂や候補を利用側の正本へ補完せず、Coordinatorは既存のsticky停止と元回復参照を保持する。期待改訂不一致の自動再読込み・再基準化・再試行は追加しない。

State全体の候補生成は、Task・Operation・Decision・履歴等を一つの保存改訂へ結合する跨モデル責務である。名前にRepairやTaskを含むことだけを理由に別validationへ移さず、単一CASとSource Mapを分断しない。モデル内validationの既存相互参照は今回一律に解消せず、他二モデルとの直接依存0というPackage境界と区別する。

ExecutionSelection、inspectExecutionSelection、TaskExecutionSelectionsと担当組の保存検査は実行モデルに置く。Hash生成はEMの内部利用がなく、Coordinatorの既存selection/resolveが正規化済み選定を同じbyte・SHA-256で識別する。ADのModelSelectionを基礎に当時のcatalogIdentity／configIdentity／role／workType／sourceを固定する。CoordinatorがConfigとADの解決結果を明示投影し、実行モデルは役割・選定相関・形式を自身の境界で検査する。Hashの正規化順序・保存JSON・設定取得時の意味は変更しない。

保存WriterもReaderと同様に、検査済み選定二件と組を不変値として返す。JSON由来の保存値を検査した時点で一度だけ凍結し、その後のCoordinatorの状態遷移とTask要求構築は同じ値を搬送する。未信頼のTask要求は受付で一度捕捉し、同じ受付内でモデル検査を繰り返さない。Root公開の要否と検査自体の要否は分けて評価し、検査済み返却値の再利用だけで外せる経路と、未保存入力・Process結果の境界を区別する。

<a id="consumers"></a>
### 内部の責務構成

`index.ts`と、objective／task／attempt／decision／workspace／state／historyの各`crud.ts`・`validation.ts`・`types.ts`、objective／task／attempt／history／stateの`operations.ts`、`storage/store.ts`・`storage/lock.ts`・`storage/publication.ts`で構成する。各crudは完成操作の意味、validationは局所検査、operationsは保存しない値操作・用途候補、typesは契約を所有する。

固定所在、共通File読取り／書込み、一時保存資源のI/Oは`storage/store.ts`、共通の排他取得・保持・解放と保存Ownerは`storage/lock.ts`が所有する。単一StateのCAS・保存／回復と、短命Mapに結合したEffect順序は`storage/publication.ts`が所有し、共通保存primitiveへ接続する。同Fileはrename／unlink等も発行するため、全物理I/Oをstoreへ集約したとは扱わない。短命Mapと一回使用ProtocolはWriterと一体で置く。`state/crud.ts`は同版の意味整合と候補の接続を所有し、重複Writerや中継だけのWrapperを作らない。

共通Record取得は既存snapshotStateRecordへ統一し、同じ受理域のsnapshotPlainRecord実装と別名Wrapperは残さない。配列二種の理由分類・引数検査、およびdescriptor検査は条件が異なるため今回変更しない。

旧repository／identity／plain-dataのSource分散と旧PathのWrapperは残さない。機密検査の7値公開は撤去し、AIへの送信境界を所有するCoordinatorのinput/secret-validationへ移した。先行の24 Source整理では他のRoot公開を維持し、その後267項目へ縮減した段階を経て、現行集合は§2の93項目となる。各段階を通して、保存先・Schema・Hash・Lock Identity・CAS・現在性確認・失敗／回復相関は不変更とする。

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

### 保存証拠の寿命と物理出版の分類

| 内部処理 | 主な入口・責務 | 終了条件 |
|---|---|---|
| 初期化 | prepareOwnedStateInitialization：exact新規領域と初回候補の結合 | 初期化証拠の成功／失敗・解放結果を区別 |
| 通常出版 | writeOwnedStateSnapshot／writeStateSnapshot：候補を単一Writerへ接続 | 元版・Owner・File・設定のfresh照合、CAS、保存確認とLock解放 |
| 再入場 | resumeRepairRecordSave：exact修復保存の中断状態を再観測 | 未知の保存物を確定せず、既存の出版相関を照合 |
| 特殊候補の出版 | publishRecoveryState：用途候補を短命Contextへ結合 | 一回消費とfinallyによるContext失効 |
| 取得済みOwnerによる出版 | publishStateOwned：Task／定義候補を単一Writerへ接続 | 排他を再取得・解放せず、Owner寿命は呼出し側が管理 |

settlementsは一回の保存呼出しの候補・元版・OwnerをContextへ結合し、消費後はfinallyで破棄する。initializationsはexact初期領域・本文だけの証拠を保持し、準備・解放成功時は後続出版まで保持する。解放失敗、既存の出版終了またはContext失効条件で削除する。historyAttemptsは同じ生存Ownerでの履歴試行とpending候補を保持するため、各呼出しfinallyでは消さない。弱参照のOwner寿命に従い、Process再起動後の正本やfresh照合の代替にはしない。

resumeRepairRecordSaveはLock・保存物・途中結果を扱う完成した保存再入場操作であり、Storageの実体をRootから直接提供する。公開Ownerの見た目のためのAttempt転送Wrapperや、新しいMap／Managerは作らない。短命証拠とWriterを分散させないため、publication.tsは行数だけで分割しない。

<a id="verification"></a>
## 5. 検証と未確認

公開集合、3モデル直接依存0、全Consumer型、State／History／CAS／Lock、初期化・途中失敗・回復・Receipt／相関を既存試験へ対応付ける。保持設定の初回不成立・途中変更・同値と、設定不正でも非履歴処理を止めない対照を含む。

型・Source移管だけで保存や再入場の成立を主張しない。限定回帰と独立確認は[変更計画](../../../99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)へ記録する。全体回帰・実AI・Docker・過去保持物の操作は今回実施しない。

保存Source試験補助は、同じ試験ProcessでSourceを編集しないことを前提に、固定10Sourceの読取り・型除去・宣言抽出を一回準備する。通常経路は順序付き依存名と内部関数override名が同じ場合だけ未束縛factoryを再利用し、依存値・fixture結果・Owner・保存領域は保持しない。factory評価と製品Map初期化は各ケースで実行する。Source変異は毎回適用してcompileし、通常factoryへ混入させない。この試験準備共有は製品の保存・Lock・CAS・回復の保証変更ではない。

各段階の限定検証、失敗と是正、未確認範囲は[変更計画](../../../99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)を正本とする。過去の成功件数を現在候補へ合算せず、局所成功から全体回帰や公開最小性の成立を主張しない。

### 補助検査の公開境界

validId・validWorkspaceDisplayName・validWorkspaceCandidateRequestはモデル内の保存検査として維持しRoot公開しない。CoordinatorのID入力は既存のstate/validation、Workspaceコマンドの表示名・Path・選択は既存commandsで確認する。仮のCandidateをPath検査のために組み立てず、Git接続は保存が受理したCandidate Intentを使う。汎用の採用結果本文は検証済みWorkspaceモデルと同一視せず、Coordinatorが利用するIdentity・Commit相関を確認する。

verifyQueueIntakeとCoordinatorの委譲入口は撤去する。新StateはsaveProjectExecutionState、既存StateはcreateQueueの同じ短期保存排他内でsnapshotIntakeMatchesを用い、受付世代・Queue・要求Hash・Project・Milestoneの相関を保存前に確認する。古い受付の明示未保存拒否と保存／解放不明は区別し、後者をno_effectへ変換しない。

validateResourceBookはCoordinator所有の認証回復ファイルを読む独立境界と、保存済みQAイベント列の検査に必要な受付である。後者はbeforeを明示して同じ内部の遷移正本を利用する。validateResourceBookTransitionの独立Root公開は撤去した。別記録をEMのState Readerが検査済みと扱わず、同義Wrapper・履歴の再構築・汎用検査Frameworkは作らない。外部の保存代役はapplyResourceEvent／applyResourceCleanupの検査済み結果を使用する。

WorkspaceResultとinspectWorkspaceResultはCoordinatorの結果搬送契約であり、EMの保存モデルではないためCoordinatorの既存workspace/record.tsへ移す。EMからの宣言・Root公開は撤去し、相対Path・欠測・変更相関・参照分離・getter／Proxy拒否の試験は新Ownerで維持する。

inspectSingleTaskRecordはQueueの保存・読取り内部に閉じる。単発更新のWriterは未検証入力を捕捉し、Lease観測や更新候補生成の前に記録の閉形式と終端相関を検査する。CoordinatorはWriterが返したsingleTaskを次の現在値として使用する。実行Adapterの用途結果はCoordinator自身が検査し、検査のために仮のPrincipal・Task・Attemptを生成しない。保存後の表示を保存前の成功へ読み替えない。


### 読取り・Checkpoint・回復結果の共通入口

- 三引数の表示用readStateは既存の取得範囲を維持する。二引数のoperation／recoveryはそれぞれのOwner・元版・Lock条件で検査し、未知scope・余剰field・Getterを読取り前に拒否する。
- saveRecoveryCheckpointは既存更新に加え、resource_not_issued・host_cleanup_preparation・authentication_unknown_closureを同じ閉集合で受ける。未発行は元Operationの現在Owner、Host準備は元本文と再読取り、認証終了は元Ownerと二回の不存在観測・一回証拠の検査を維持する。
- completeRecovery／saveRecoveryHistoryはdocker_task／runtime_repairを必須引数で区別する。未知用途はOwner callbackと保存前に拒否する。旧固定用途Wrapperは置かない。
- validateResourceBookのbefore指定は同じ内部の遷移検査へ接続する。省略時は値検査だけであり、呼出側が必要な比較を省略してよいという変更ではない。
- 読取り専用のreadOperationResourcesStageは撤去し、既存operation取得結果からexact回復IDの資源を取得する。追加読取り・技術操作は行わない。

保存Schema、Authority、Lock／CAS、認証終了の一回証拠と通知順序は変更しない。通常の利用側も試験・生成子SourceもRootの共通入口を利用し、内部実装への迂回は追加しない。


### 純粋な資源操作と保存依存の境界 — 2026-11-14

| Owner | 所有する処理 | 持たない依存 |
|---|---|---|
| `attempt/operations.ts` | 資源イベント・清掃観測の適用、Book構造と単調遷移、認証未確認資源の不存在辺の差分検出 | State候補・CRUD・Storage |
| `state/operations.ts` | plain値の正規符号化、記録捕捉・主体ID、Hash・Lease ID／証拠の構築と局所形式検査 | 他モデルの実行時処理・全体候補・保存・Authority |
| `state/validation.ts` | 複数モデルの同版整合と全State候補 | 資源値処理のためのAttempt CRUD、主体構築のためのState CRUD |
| `state/crud.ts` | 現在版の意味・取得と用途候補の接続 | 資源更新の別実装、物理Writerとその私有Map |
| `storage/publication.ts` | 単一Writer／Lock／CAS・初期化・再入場・短命証拠の寿命 | Attempt／History CRUDへの実行時依存 |

主体IDの固定prefixは`state/operations.ts`の私有定数とし、Decision／Taskの局所検査は同じ値処理を利用する。公開名・文法・保存形式は変えず、Decision検査のために全State検査をロードしない。Coordinatorでは初回受付で独立・凍結捕捉したSelectionを再利用する。再発行側・Resolver・保存／搬送入力の検査とHashの正規順は維持し、内部受渡しの省略を未信頼入力の無検査へ拡張しない。

共有する値処理は`state/operations.ts`の一つの実体を内部Consumerが直接利用する。保存しない記録値・主体・ID・Pathの構築／捕捉／変換に限定し、全Stateの整合や物理保存を追加しない。Root93項目・保存本文とHash・Intent／Receipt／正式未発行／不存在の条件を維持し、清掃観測の不明を不存在へ変換しない。

新品NodeでState候補・CRUD・Storageの解決を拒否しても資源の値更新が使えることを確認する。型だけの参照をAuthorityにしない。局所値検査と全State候補の逆依存は分離するが、局所検査同士の全参照を禁止するものではない。Historyの意味Owner・完成操作・明示Snapshot型は下記の現行責務に従う。

`hashStateText`を局所値Ownerへ閉じることで、Workspaceの局所検査から全State検査へ戻る実行時参照を持たない。単一採用結果の`adoptionWasRejected`はWorkspace、計画全体の同一性HashはObjectiveの局所validation、資源の新しい不存在辺の検出はAttemptが所有する。資源差分を検知した後の一般保存拒否と専用証拠の確認はStorageに残す。Lease証拠は内容検査・構築・Hashを同じState operationsへ置き、保存形式識別子`STORAGE_CONTRACT`はstate/typesを正本とする。文字列・LF・ID・参照保持と例外契約は変更しない。

### 履歴の生成・保持・出版候補とState整合 — 2026-11-14

| Owner | 実体を所有する処理 | 所有しないもの |
|---|---|---|
| `history/operations.ts` | Operation／Repairの要約と行、Task／判断の行生成、必須行の両Hash照合、元順序の保持・期間選別、同IDのexact比較、pending全文一致、intrinsic Buffer捕捉 | 全State復号、改訂更新、Decoder、保存・Lock・Authority |
| `history/validation.ts` | 共通履歴の全行decode・重複／部分行／未知Schema拒否 | 全Stateの退役判断、物理保存、実資源の終了確認 |
| `state/validation.ts` | 全体復号、現在操作選択と終端条件、判断・未搬送・未解決・現在操作の保持参照／必須Hash投影、履歴候補と同じ元版のSnapshot候補結合 | 履歴本文の独自符号化、期間選別・pending比較の別実装 |
| `storage/publication.ts`／`storage/store.ts` | 元版・現在Owner／設定・File実体照合、単一CAS、pending保存・確定・読戻し | 履歴要約／行の別の値生成 |

`prepareHistoryRetention`の内部入口は、保存済み全体Stateから参照を導出するためState側に置く。Historyは、検査済み行と同じStateの保持参照・必須Hashだけを受け、現在Operationが履歴確認済みか否かによらず欠測・行Hash差・要約Hash差を選別前に拒否する。単なる参照保護と必須行の存在照合を混同しない。現在参照・reviewAfter前・保持期間境界の行を、元順序・元本文のまま残す。

二つの出版候補は、同じ同期呼出しで検査済みの元Snapshotからexact操作・固定行・確認済み次版を導出する。要約・行の意味計算はHistoryへ委譲し、Stateは改訂・元Hash・対象外保全と最終遷移を検査する。canonical全行と固定一行の検査、History側のexact比較・重複拒否・期間整理・pending全文一致は維持する。導出中に同じ元本文を再decodeしないが、最終遷移検査は元本文と候補を独立して検査する。Writerのfresh読取り、異なるLock区間や外部入力境界で検査済み値を使い回さない。どちらかの候補が不成立なら全体候補も不成立とする。

Task／RepairのBuffer捕捉はHistoryの共通実体を使う。Proxy・非Buffer・intrinsic取得失敗を拒否し、own equals／lengthを使わず独立コピーする。Task入口のcatchとRepair入口の例外伝播、各結果のコピー条件・入力捕捉順序を維持する。Schema・Hash対象・Root93項目・物理保存順・Reader／WriterとLock保持条件は変更しない。値候補成功は保存・退役・実資源回収の成功ではない。

Historyの意味計算はhistory/operations、完成保存はhistory/crud、同版への結合はstate/validation、物理出版はstorage/publicationに一意に配置する。Stateを単なる保存先へ縮めず、全モデルの相関・改訂保証を維持する。

`prepareHistorySummary`は既存encoderのbyteを複製・再符号化せずHash化し、既に固定されたHashだけを照合する。要約可能条件はTask／RepairごとにStateから既存Attempt判定へ接続し、導出元State HashはStateが付加する。`operationHistoryLine`はTaskの固定済み行Hashを照合し、初回候補にも使うhistoryLineBytesの意味は変えない。Repairの転送Helperは置かず、既存repairHistoryLineBytesを履歴欠測null・保存済みoccurredAtの条件で使用する。HistoryからAttempt validationへの逆参照は追加しない。


### 局所検査から全State候補への逆依存の撤去 — 2026-11-14

Objectiveの定義更新候補とEntity単位の更新用Hashは`objective/operations.ts`、Project定義全体の同一性Hashは`objective/validation.ts`、Task／Queueの同版候補・投影は`task/operations.ts`が所有する。両operationsは全State検査とモデル局所検査を使用するが、State検査は局所validationだけを参照し、用途候補へ戻らない。小さい値処理は既存`state/operations.ts`の単一実体を利用し、全Stateのdecode・相関・遷移を同ファイルへ移さない。Schema・保存識別子は`state/types.ts`に置く。

Historyの`historyRow`と全行検査は`history/validation.ts`が所有する。全Stateの閉鎖判定・履歴確認・参照保全を必要とするpending生成／記録退役／搬送確定は、唯一の利用元であるHistory CRUDの局所関数とする。状態を使う候補を、Attemptからも利用する履歴行生成operationsへ混ぜない。義務観測・時計・受付世代発行の位置と回数、失敗の短絡順を維持する。

局所validationの新品NodeロードでState検査・CRUD・Storageを解決しないことを確認する。この分離は局所検査同士のすべての参照を禁止するものではなく、全Stateの同版相関はStateが引き続き所有する。公開93項目・Schema・Hash本文・単一Writer／CASは変更しない。

### Checkpointの完成操作とState保存証拠のOwner — 2026-11-14

`saveOperationCheckpoint`の実体はAttemptのCRUDが所有する。同じ操作の現在値を既存Readerで取得し、六種の候補生成と元版照合Writerへ接続する。State側に旧宣言・再export・転送Wrapperを残さず、Rootの公開名・引数・結果・保存順は維持する。

Storageにある`settlements`はWriterが短命証拠を一回消費する状態、`initializations`は初版の物理出版と失効の状態、`historyAttempts`は保存確認かつLock解放後に確定する発行・pending再入場の証拠である。単なるAttempt／Historyの値モデルではなく、単一Writerの調停状態として一体で所有する。

`completeRecovery`と`saveRepairRecord`の対象選定・候補・結果投影はAttempt CRUD、`saveRecoveryHistory`の完成保存と段階制御はHistory CRUDが所有する。`resumeRepairRecordSave`は固定保存物の再観測とpending確定であるためStorageに置き、Rootから直接公開する。旧所在地の転送Wrapperは残さない。

内部の`publishRecoveryState`は既存の四証拠用途だけを受け、Context生成・必要な初期化・一回の保存・finally失効を一体で行う。Mapや可変証拠は返さない。認証終了も同じ入口を使う。`publishStateOwned`は取得済みOwnerでのTask／定義保存だけを単一Writerへ接続し、排他の再取得・解放をしない。両関数はRoot非公開で、新しいManager・Registry・Mapはない。

保存形式、初期化Effect、元版比較、証拠消費、rename直前の発行状態更新、保存と解放成功後の履歴試行登録を維持する。PublicationからState CRUDへの参照は既存Reader結果の型だけで、実行時の逆依存は作らない。

### Snapshotの保存正本・投影・Reader結果 — 2026-11-14

| 型／結果 | 役割 | Schemaと差分 |
|---|---|---|
| `ExecutionStateSnapshot` | 19fieldを明示した唯一の保存値正本 | state/v4。定義のみのprojects、nullableの業務結合・受付世代を保持 |
| `ExecutionOverview` | 保存正本の6fieldをPickした技術現在集合の投影 | 正本と同じstate/v4。独立保存しない |
| `Snapshot` | 9共通fieldと7投影固有fieldを組み合わせるモデル操作用の値 | project-snapshot/v7はメモリ投影の識別。管理Project・non-null結合と受付世代を持つ |
| `decodeStateSnapshot`の結果 | 検査済み正本と本文HashのReader結果封筒 | 保存値そのものの別名ではなく、現在本文との相関を付加する |

同一だった`UnifiedSnapshot`／`DecodedStateSnapshot`の型別名は撤去し、内部・試験も公開済みの正本名を使う。正本を投影のOmit合成で定義せず、投影が正本を参照する向きへ統一する。保存JSON、Schema、null許容、配列readonly、Leaseの省略可能なphysicalIdentityとnull許容は変更しない。JSONの解析と値の符号化であり、暗号化・復号化は行わない。公開型の追加や削除はない。


### 特殊Queryの退役と通常CRUD — 2026-11-14

queryDecisions（Decision＋Blocker）、queryExecutionState（Project定義＋管理実行）、queryWorkspaces（Queueが参照するWorkspaceだけ）は、モデル単体の通常CRUDではなく用途固定投影だった。3宣言・Root・内部の専用分岐・ExecutionContentViewsの対応型を撤去する。通常のqueryPlan／queryObjectives／queryTasks／queryQueue、単件Decision取得、既存本番のreadState同版取得は維持する。特殊照会の同名Wrapperや新Facadeは作らない。

readExecutionContentの用途はplan／objectives／tasks／queueに限定し、旧三種・未知用途は認可／Repository観測前に拒否する。通常Queryの現在認可、Lock、同版version、absent／unknownと解放確認は維持する。Decision保存内容とBlockerの相関は既存単件取得と自己生成保存物で確認し、通常Queryの認可負例とは区別する。

この区切りはRoot全体を通常CRUDだけにしたという主張ではない。当該段階では既存readStateの複合取得、readTaskIntakeStateとreadOperationCompletionの用途固定観測、保存・回復の業務操作は変更しなかった。後続で二観測を既存Readerへ統合した。後者の必要性と配置は次のOwner判断へ分け、排他内の同版観測を逐次読取りへ分解しない。


### 受付集合と終了観測の既存Readerへの統合 — 2026-11-14

独立したreadTaskIntakeStateは撤去し、既存readStateのqueue範囲へ接続する。Queue集合・Lease Intent・受付世代は元のreadSnapshot通常モードを一回だけ使用し、field参照・明示不存在・結合・読取り失敗・解放不明を維持する。既存intake範囲は出版確認付きモードのままで、二つの読取り条件を同一視しない。

独立したreadOperationCompletionは撤去し、readStateのrecovery範囲でkind=completionと回復ID・correlationIdを要求する。完全key捕捉後に値を検査し、同じreadStateSnapshotのcompletedOperation引数へ渡す。operationCompletionConfirmedは単なる操作不存在ではなく、同じ操作nonceの残存拒否、終了履歴の現Schema・回復ID・上位相関、読取り成功と排他解放の共同成立である。Readerのreason・value・回復参照等を封筒ごと保持し、falseを不存在へ読み替えない。

二宣言・Root公開・旧Wrapper・利用側の別名importは残さない。保存方式・型の正本・新Mapは追加しない。この二Reader統合の段階では保存三操作の完成単位は未変更だった。後続で資源再保存を既存の完成保存入口へ統合した。phaseやmodeへの名前付替えだけを完成扱いにしない。


### 資源Checkpoint再保存の完成入口 — 2026-11-14

独立したresumeResourcePublicationは撤去し、saveRecoveryCheckpointがkind=resource_publicationの要求を受ける。上位はreadStateのresource_publication観測が返したbefore／candidateの一組を、そのままpublicationとして渡す。別々の本文を組み立てず、EMがrequestの三keyとpublicationの二keyを捕捉する。専用の元本文引数はnullのみで、通常Buffer入力の型からこの用途を除外する。

case本体は元のclassifyResourcePublication、fresh ReaderのresourcePublicationRecoveryId、両本文のexact比較、Owner再確認、既存Writerと保持設定再確認を保持する。未知field・用途混在はOwner観測前に拒否し、上位の保存後fresh Readerと候補一致確認も残す。元pairを改訂番号や新Hashで代替しない。旧Root名・別名Wrapper・新Map／Readerはない。

completeStatePublicationは保存marker自体とともに撤去した。saveRecoveryHistoryは要約固定・履歴保存・最終fresh確認を一回で完結させ、Coordinatorの段階ループは撤去した。変更計画§14.64のmarker組込み案は実装せず、marker不要化で置き換えた。
