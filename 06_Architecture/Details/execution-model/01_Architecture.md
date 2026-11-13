# 実行モデルの責務と単一保存契約

成果物種別: Architecture詳細設計
状態: 完成操作への公開再編を接続済み・限定回帰を継続中（要求・表示契約、開始／終了、Checkpoint・Queue・Lease・回復Reader／保存を統合。過去試験物の一部は由来再確定待ち）
担当責任者: Qual-Lab
最終更新日: 2026-11-13

<a id="model-boundary"></a>
## 1. 責務と依存

実行モデル（execution-model）はObjective／Task／Attempt／Queue／Workspace、Blocker・提案回答、State／History、回復記録と局所遷移・保存を所有する。Scheduling・再試行判断はCoordinator、単一技術実行はExecutor、Provider計画・解析はAI Adapter、Docker実体はDIが所有する。

3モデル間の実装・型・再export・deep import・dynamic import・package直接依存は0とする。実行モデルは設定を探索・再選定せず、構成モデルのReaderや型を受け取らない。必要なVC／Lock／Node.jsと既存AD／DI技術結果型は正本を直接使用する。旧domain-modelの互換Facadeを残さない。

<a id="public-api"></a>
## 2. 公開入口と確定入力

`40_Develop/execution-model/src/index.ts`は、本番利用が必要とする完成操作と値契約を明示公開する。内部候補・汎用Helper・検証専用契約は必要性を確認してRootから外し、EM内部の試験は宣言元を参照する。外部Packageの試験は既存のRoot限定Guardを維持する。現在の実装途中の公開は134項目（96値・38型）であり、最終案ではない。基準267項目から要求・表示契約と開始／終了の内部段階、用途別Checkpoint・Lease・Queue・Reader・回収保存の重複入口、外部利用のない内部型と候補生成・分類Helperを撤去した。現在の公開集合は実Rootと固定期待値の契約試験を正本とし、[当初分離時の対応案](../../../99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md#9-indextsの移管候補)とは区別する。

### モデル別CRUDとState複合取得

モデル単体のCRUD・照会は各モデルが所有する。Projectの現在値取得はState側の`readProjectExecutionState`へ一本化し、Task側の旧`readQueueProject`と重複する投影処理は撤去した。有効Schemaの不正IDは既存のID不正理由へ統一し、Schema不正の理由は維持する。

複数モデルを同じ保存版で照合する取得は`state/crud.ts`の`readState(repository, binding, scope)`が所有する。固定二範囲の選択に限定し、任意fieldや投影callback・新Store・全技術Snapshotの返却には拡張しない。未知・欠測scopeは読取り前に拒否し、既定値へ補完しない。

| scope | 同じ一回の読取りから返すfield |
|---|---|
| `execution` | `projects`、`queueEntries`、`intakeEpoch`、`schemaRevision` |
| `workspace` | `projects`、`queueEntries`、`results`、`workspaces`、`snapshotRevision` |

元の2複合Readerの取得範囲・Rootとbindingの検査・短期Lock・明示不存在・読取り不明・解放失敗を維持する。旧`readExecutionOverview`／`readWorkspaceState`の公開・実装・互換Wrapperは残さない。4つの一般照会は、Project／Milestoneの対象限定と認可契約が異なるため今回は維持する。

Coordinatorの通常状態表示は`execution`取得結果からProjectと受付世代を投影し、追加Portの構築と同じ状態の再読取りをしない。Git改訂が異なる場合のWorkspace採用確認を挟む前後のfresh取得、排他取得後・保存後の読戻しは保持する。Workspace操作でも`workspace`範囲を同じ版で取得し、個別モデルを順番に読む方式へ分解しない。

### 公開から外した内部契約と保持理由

外部で型名を参照していない16型と、外部試験だけが参照する`RecoveryCheckpointRequest`はRootから外した。モデルの内部宣言・保存形式・関数引数の型は維持する。試験のRequest型は`Parameters<typeof saveRecoveryCheckpoint>[3]`から取得し、`unknown`化や別のRequest定義は追加しない。Rootの型集合は38項目とし、この型整理段階では実体を持つ98値を維持し、その後の複合取得統合で現96値となった。`queryDecisions`／`queryExecutionState`／`queryQueue`／`queryWorkspaces`の4照会は、型名の整理と提供機能の変更を混同せず今回は維持する。

外部試験の保存fixture・故障窓の都合だけで残していた下表11宣言は、利用側を完成操作・現役の公開値契約・独立した期待DTOへ接続してRootから外した。モデル自身の候補・遷移検査は宣言元で維持し、外部の深いimportや互換Facadeへ逃がしていない。Root集合は更新済みだが、今回の限定回帰が完了するまでは候補全体の完成を表示しない。

| 内部化した用途 | 宣言 |
|---|---|
| 保存fixtureの技術断面4件 | `prepareStateCleanupSnapshot`、`prepareStateLifecycleSnapshot`、`prepareStateResourceSnapshot`、`prepareStateRestartSnapshot` |
| 修復fixtureの候補3件 | `prepareStateRepairSnapshot`、`prepareStateRepairCheckpointSnapshot`、`prepareStateRepairSessionSnapshot` |
| 履歴fixtureと故障窓4件 | `prepareRepairHistoryLine`、`prepareRepairHistorySnapshot`、`prepareStateHistoryLine`、`prepareStateHistorySnapshot` |

本番で必要な検査も、公開Helperを直接呼ぶことが必須とは限らない。履歴要約・Host更新・開始Identity・初期Hostのモデル判定は次の既存操作へ内包した。初回候補Helperの外部fixtureは公開Writerと固定入力へ接続し、Root公開を撤去した。保存codecの外部利用とRoot公開は撤去した。公開最小化全体の完了は、この局所整理だけから推定しない。

| 検査の所有と公開境界 | 本番で必要な意味 |
|---|---|
| 履歴Reader／Writerの内部検査 | `readRecoveryState(kind: "repair_history")`が要約成立を検査し、Coordinatorは同じ値検査を再実行しない |
| 操作Reader／Writerの内部検査 | `readOperationStateStage(owner, {kind: "host_cleanup", recoveryId})`が同じ元版のHost清掃準備を検査し、元本文・対象・Host tokenを返す。一回Authorityの消費前に確認し、保存時にも元版を再検査する |
| 操作Readerの開始前取得 | `readOperationStateStage(owner, {kind: "operation_start", identityJson})`がState読取り・Lock取得・初期化をせず、現在Ownerと初回Identityを検査し、回復ID・Identity Hash・操作IDだけを返す |
| 回復Readerの初期Host取得 | `readRecoveryState(kind: "initial_host")`と既存host_cleanup範囲が同じ版のexact一操作だけを再導出し、不変のID一覧を返す。通常currentでは再導出しない。Coは成功・元版・解放確認後だけ使い、実host_onlyとtokenを別に確認する |
| 初回候補生成 | `prepareStateOperationSnapshot`はRootから撤去。実Rootの試験は公開開始Writer、純粋観測の試験は固定入力を使い、内部候補への間接依存も残さない |
| 回復Ownerの同版保持 | CoordinatorはReaderが検査・凍結したSnapshotを既存回復記録の元本文と同じ版で保持する。再decodeせずHost・consumer判定に使い、保存結果とfresh Readerの改訂・Hash・解放確認後だけ両方を更新する |
| Coordinatorの入力捕捉 | 公開受入・認証通知・資源作成通知・Host checkpointの入力コピーは既存`input/snapshot.ts`の`snapshotJsonValue`を使う。保存codecのroundtripを使わず、未知実行の拒否と参照分離を維持する。保存本文の正規符号化・Hash・比較は別の既存契約であり、JSON.stringifyへ置換しない |

開始前取得の`kind: "operation_start"`・`status: "completed"`・`operationIdentity`は事前検査範囲の共同結果で、`value`はnullである。`lockReleased:true`はこの範囲でLockを取得していないことを表し、保存・開始許可・現在Stateの観測を意味しない。Getter等の不正入力、別操作Owner、最終再検証失敗では相関を返さず、StateReaderにも進まない。保存時の再検査・重複判定は`saveOperationStart`に残す。

Host清掃確定ではWriterが正規候補を生成・検査する。Coordinatorは保存結果のrevision／payloadSha256とfresh Readerの一致、同じ回復ID・Host token・cleanup確定を確認し、確認済み本文だけを次の元版に使う。利用側で次Snapshotを再構築しない。試験の既知Host差分期待値は、対象外全文・前改訂・元Hashを明記した独立DTOとし、製品validationの代替実装にはしない。

### 要求・表示契約と開始／終了の境界

Objectiveの実行要求、状態照会・公開投影、判断操作の要求／応答、WorkspaceCommand、活動一覧はCoordinatorの既存Sourceが所有する。EMは保存モデルとその検査を所有し、Coordinatorへ依存しない。`inspectDecision()`は判断モデル自身の検査であり、Coordinatorが保存用の符号化や履歴投影を代用しないための入口である。

`saveOperationStart()`は初回記録の保存後に、同じ元Owner・Repository・exact回復参照へ終端Contextを固定する。開始保存と終端準備は別の成立事実として`startSaved`と`completionContext`を返す。保存済みでも準備が失敗したら全体はblockedとなり、Host要求を発行せず、元参照・保存Effectを保持する。統合結果のlockReleasedは先行Writerと後続準備Readerの両方を反映し、準備Readerの拒否理由・解放不明を保持する。準備例外時は解放済みと推定しない。ContextはProcess内だけで使用し、保存値から復元しない。

`completeOperation()`は元Host結果と元Controller結果の参照一致を内部で固定し、入力受理を`inputAccepted`として保存結果と別に返す。受理後の保存失敗・例外でも同じ元入力を上位が保持できるようにし、別参照への差替えは拒否する。実Writerが保持する発行済みEffect・保存未確定・Lock解放不明は畳まない。耐久配送のACK前には、既存のfreshな`readOperationResult()`を維持する。

<a id="repair-write-contract"></a>
### Checkpoint・Lease・Queue・回復読取りの契約

`saveOperationCheckpoint()`はresource／cleanup／host／lifecycle／references／restartを固定種別として受け、同じlive Owner・操作ID・改訂から保存候補を生成する。referencesでは対象外pendingDeliveriesを変えない。回復Owner向けの保存やHost事前検査をこの入口の権限へ混ぜない。

`saveRecoveryCheckpoint()`は回収中の途中更新・再起動・終端・Host清掃確定を固定種別として受ける。途中・再起動・終端は元の同期Owner確認、Host清掃確定は`assertAbsentOwner`とexact出版候補を要求し、証拠を相互代用しない。終端Readerの通常→履歴→配送の順序と前Readerの解放確認を維持する。live Host準備と正式未発行の元Controller照合は、それぞれ別の完成操作として維持する。

未確認履歴の出版途中から終端へ再入場する場合は、その履歴Readerが要求する保持日数と現在性確認を上位が同じ入力へ搬送する。Coordinatorは元Snapshotのexact操作に未確認履歴がある場合だけ既存の設定接続を使い、通常終了・確認済み履歴・他操作を理由に設定読取りを増やさない。保持設定不正・途中変更の拒否、元版一致・Host不存在・Ownerの一回性は維持する。

Leaseは`acquireLease()`・`releaseLease()`・`recoverLease()`・`readLease()`、Queueは`createQueue()`・`updateQueue()`へ用途固定の処置を集約する。Requestのkindごとに元の必須tuple型を持ち、共通のOptional集合や任意更新Callbackは受けない。入力tupleは既存のown-data配列捕捉で固定し、Getter・Proxy・疎配列・独自iterator・余剰symbolと不正arityを保存前に拒否する。Root観測Callbackは捕捉した値として保持し、実行は従来どおり短期Lock内の現在Rootへ結合する。保存Intentと物理処置後の観測は区別し、物理Lock取得・解放・回復はCoordinatorが所有する。

`readRecoveryState(root, request)`はcurrent／admission／history／resource_publication／host_cleanup／initial_host／execution_history／repair_history／execution_completion／repair_completion／deliveryの固定取得範囲を持つ。各範囲の元ID検査・保存途中の照合条件を保持し、通常Readerの拒否を自動的に別範囲へfallbackしない。live Ownerからの読取りと、受領ACK前のfresh結果読取りは別の権限境界として維持する。

`kind: "history"`はrecoveryIdを持たない閉じた要求で、初期化済みStateと同じ短期Lock内にある履歴を全行検査する。成功・値あり・解放確認・`historyRows !== null`の共同成立後だけ利用し、真正不存在は不変の空配列、不正・観測不能・pending・実体変化・解放不明は値なしの停止とする。取得途中の存在／不存在変化も最終照合し、部分行を返さない。通常currentの追加履歴I/Oは0で、`historyRows:null`は未要求を表す。履歴Queryに保持設定の読取り・変更や操作Authorityを追加しない。Workbench検証scriptはこの完成操作を使い、履歴の直接File読取りとdecoder呼出しを再実装しない。

State Readerの成功valueは、検査済みSnapshot・本文Hashと同じ読取りから`sourceText`を返す。これはUTF-8・正規JSON・末尾LFを検査したstate.json原文であり、pending候補や利用側で再生成した本文ではない。最終File同一性・現在Owner・Lock終了などの成功条件を変えず、拒否時はvalueを返さない。文字列と成功valueは不変とし、追加I/O・公開関数・Authorityは作らないが、本文文字列分のメモリ保持は増える。Coordinatorは元本文・Writer入力・全文比較にこの原文を使用し、SnapshotのJSON再生成をしない。原文を新しいログ・HTTP応答へ丸ごと転送しない。Coordinatorの値比較は既存のown-data捕捉後にNode.js標準で行い、保存用encoderを使わない。外部試験の固定値生成は既存試験用JSON処理へ接続済みであり、保存codecはEM内部へ閉じる。

外部試験でも、実保存済み履歴の確認はこのReader又は対象用途の完成観測へ接続する。履歴として有効な別consumer・別相関の行を、全履歴Readerが無条件に拒否することは要求しない。同じ操作の終了観測が対応関係を別に検査する。一次失敗・Command観測の純粋な値検査はEMのunit試験が実検査関数を直接確認し、CoordinatorのITから内部関数を抽出しない。正常Owner結合試験も、修復直後と後続Task各段階の実履歴を公開Readerで取得し、元修復行の本文・時刻・両Hashと件数を照合する。引数だけの変異・重複を実File不一致として拒否する対照と、EMが所有する実履歴の構文検査を区別する。子Processの保存途中の確認には既存の用途固定Readerが検査した履歴本文を使い、pendingを通常Queryへ通す例外は作らない。外部の履歴decoder依存は撤去済みであり、decodeHistoryRowsはEM内部の値検査と試験だけが使用する。Rootは全履歴取得の完成Readerを公開する。State decoderと保存用encoderの外部直接利用も撤去し、両関数のRoot公開を廃止した。実保存の検査は完成Readerへ、過去版・保存前候補の期待値は既知fixture本文の局所投影とraw Hashへ分離する。外部の固定値生成には既存の試験用canonicalJsonを使い、Schema検査の代役にはしない。EM自身の値検査試験は内部宣言元を使う。

汎用のRecord／Array捕捉・Object／key検査はEM Rootから公開しない。Coordinatorの入力捕捉には既存input/snapshot.tsを使用し、保存codecや内部Snapshot生成を入力検査の代用にしない。外部試験は宣言済みRootの完成操作又は現役の値契約だけを使い、Root限定Guardを維持する。

### 修復更新の完成InputとResult

`saveRepairState`は、`attempt/types.ts`の`RepairSaveRequest`として期待するStateVersion又は初回のnullと、create／checkpoint／session_begin／retention_handoff／disposal_decision／disposal_progressの六つの固定論理更新を受ける。Coordinatorは次Snapshotや符号化byteを生成して渡さず、EMが同exact対象・期待改訂／Hash・現在Ownerを照合して候補を構築する。相関、非対象の全文保全、正規符号化、単一WriterのCAS・一回consume・解放確認は維持する。

成功・保存確認・排他解放が共同成立した場合だけ、確定Versionと対象Repair Operationをvalueとして返す。不明／拒否時に新しい改訂や候補を利用側の正本へ補完せず、Coordinatorは既存のsticky停止と元回復参照を保持する。期待改訂不一致の自動再読込み・再基準化・再試行は追加しない。

State全体の候補生成は、Task・Operation・Decision・履歴等を一つの保存改訂へ結合する跨モデル責務である。名前にRepairやTaskを含むことだけを理由に別validationへ移さず、単一CASとSource Mapを分断しない。モデル内validationの既存相互参照は今回一律に解消せず、他二モデルとの直接依存0というPackage境界と区別する。

ExecutionSelection、inspectExecutionSelection、hashExecutionSelection、TaskExecutionSelectionsと担当組の検査は実行Ownerに置く。ADのModelSelectionを基礎に当時のcatalogIdentity／configIdentity／role／workType／sourceを固定する。CoordinatorがConfigとADの解決結果を明示投影し、実行モデルは役割・選定相関・形式を自身の境界で検査する。Hashの正規化順序・保存JSON・設定取得時の意味は変更しない。

<a id="consumers"></a>
### 内部の24ファイル構成

`index.ts`と、objective／task／attempt／decision／workspace／state／historyの各`crud.ts`・`validation.ts`・`types.ts`、`storage/store.ts`・`storage/lock.ts`で構成する。各crudは完成保存操作、validationは局所候補・検査、typesは契約を所有する。

固定所在、共通File読取り／書込み、一時保存資源のI/Oは`storage/store.ts`、共通の排他取得・保持・解放と保存Ownerは`storage/lock.ts`が所有する。State固有のCAS・出版／回復と、短命Mapに結合したEffect順序は`state/crud.ts`が所有し、共通保存primitiveへ接続する。出版・回復では同File自身がrename／unlink等も発行するため、全物理I/Oをstoreへ集約したとは扱わない。Stateの短命Mapと一回使用Protocolは一体で置き、重複実体や中継だけのWrapperを作らない。

共通Record取得は既存snapshotStateRecordへ統一し、同じ受理域のsnapshotPlainRecord実装と別名Wrapperは残さない。配列二種の理由分類・引数検査、およびdescriptor検査は条件が異なるため今回変更しない。

旧repository／identity／plain-dataのSource分散と旧PathのWrapperは残さない。機密検査の7値公開は撤去し、AIへの送信境界を所有するCoordinatorのinput/secret-validationへ移した。先行の24 Source整理では他のRoot公開を維持し、その後267項目へ縮減した段階を経て、現行集合は§2の134項目となる。各段階を通して、保存先・Schema・Hash・Lock Identity・CAS・現在性確認・失敗／回復相関は不変更とする。

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

先行267項目段階の固定候補ではSource・試験・台帳・文書の独立レビューを完了し、当該範囲の必須残指摘は0。Ownerの限定回帰は13親・45子の58件を正常終了し、その実行では途中停止・再実行・期限変更は行っていない。各fixtureの終了hookに例外報告はなかった。関係八型設定・台帳関係の限定検査も成功した。これは現在の134項目候補の完成根拠ではない。現在段階の試験・未確認・未回収は変更計画§14.3で区別し、各限定集合の重複を合算せず、全体回帰や公開最小化の完成へ拡大しない。
