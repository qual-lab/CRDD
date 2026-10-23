# CoordinatorのTask状態・資源詳細設計

Cの物理統合により、本書が所有するTask・Objective・状態保存の実装は`40_Develop/coordinator`へ配置する。独立Orchestrator Packageを必要とせず、単発Executionと同Package内で責務を分ける。以下の単一保存方式を2026-10-22に目標として採用した。旧二保存方式の本文・Schema・Lock・CAS・ACKは移管元の保証を照合する基準であり、新方式の実装済み契約とは扱わない。過去の試験結果を統合後の全体成立へ流用しない。

<a id="unified-storage-lifecycle"></a>

## 単一保存方式の採用とLifecycle — 2026-10-22

状態: 単一Writer・共通Owner・統合保存Root・履歴・耐久受領のSource接続、旧二段ACK経路の撤去・試験移行、外部AIなしの最終固定回帰は完了し、限定独立再確認済み。現在状態はRepository-localの`.crdd/coordinator/state.json`、通常終了要約は同じ領域の`history.jsonl`、運用設定は`.crdd/config/coordinator.json`へ統合する。旧二Writerの上へ第三の同期層を追加せず、旧保存形式の移行はフロントAI手順が所有する。現在の検証結果と未確認範囲は[実施計画](../../../99_Roadmap/Changes/CHG-000082/coordinator-consolidation-plan.md#375-保存統合bの最終確認)を参照する。

### 保存する事実と寿命

| 事実 | 一意な所有先 | 終了・参照の扱い |
|---|---|---|
| 保存改訂・変更前Hash・検証済みRoot結合 | Snapshot全体に一組 | 保存の比較交換は一つ。Taskの業務世代、Owner世代、受付世代は別意味なので維持する |
| Task／Objectiveの進行、Queue、Workspace | 既存業務モデルの各記録 | Operation終了と別寿命。WorkspaceをTask完了で削除せず、Taskも後続判断・参照がある間は残す |
| Process・Container等の観測、一次失敗、cleanup | 元Operationの技術記録 | Task側の技術状態は参照から導出する。同じcleanup真偽を別の正本へ保存しない |
| exact回復義務 | 発生元のOperation又は既存Lease／判断記録に一度だけ保持 | Taskは参照と再開判断を持つ。Task失敗・試験終了や履歴期限を義務解消にしない |
| Taskへの結果反映・耐久Consumerの初回受領 | 同じSnapshot内の一つの受領事実 | Task／Attempt／論理操作／実行操作／回復参照／結果を照合。異なるIdentityを同一視せず、初回受理世代を上書きしない |
| 統合・採用の成果 | 既存のintegration／adoption結果契約 | AI単発実行結果と同じものではない。`results`区画を機械統合しない |
| 履歴移送 | 元の終端記録と小さな確定checkpoint | 要約本文の正本を二つ作らず、固定Identity・行Hash・段階で相関。未確定の元記録は履歴確定まで保持する |

Taskが後から必要とする結果・受理・未解決義務を、期限で消える履歴だけへの参照にしない。Operationから技術資源情報を整理できるのは、必要な耐久結果・受理と未解決義務が失われず、履歴確定も確認できた場合だけである。Host保護判断は現行の別保存・世代チェーンを維持し、通常履歴の30日期限処理へ混ぜない。

<a id="task-attempt-storage-facts"></a>

#### Task／Attempt固有の事実と技術Operationの境界

`cleanupConfirmed`／`recoveryUnresolved`の保存コピーを除くことと、Taskが観測した事実を除くことは異なる。単発技術Operationが存在しない経路へ架空のDocker操作を作らない。

Taskの公開`recoveryUnresolved`は、Task自身が受け取った結果の不明を表す`settlement.resultUnresolved`から導出する。技術Operationの未解決義務はexact参照・義務段階・cleanupから別に判定し、Task固有の不明へ複製しない。配送待ちだけを理由にTask結果を不明へ変えると、その配送を解消する耐久受領自体が停止するためである。Task固有の結果不明、未解決の技術義務、元参照の欠落は、引き続きそれぞれの検査で受領・除去・再実行を拒否する。

Docker回復の`required`／`settled`は元Operationから読み取る。回復要求の`recovering`通知は局所的な診断であり、Task側へ同じ技術進捗を独立保存しない。待機後は対象Taskの同じexact義務の`required`→`settled`とcleanupの前進だけを許し、業務世代・Attempt・Queue・他Task・受領本文の差、逆行、取消又は観測不能では後続保存へ進まない。耐久受領後の通知中に取消された場合も、確定した受領を巻き戻さず、Queue更新・再実行前に停止する。

| 経路・情報 | 一意に保持する元事実 | 公開状態の導出・保持条件 |
|---|---|---|
| 開始前拒否・未委譲 | Task／Attemptによる未発行の終端結果 | Operation集合が空という理由ではなく、未発行を確認した同じAttemptの結果から導出する |
| 委譲済み・結果不正・開始通知との矛盾 | Task／Attemptの委譲観測と結果未確定 | Operationが見つからないことを問題不存在にしない。既存Process安全状態由来の義務はその発生元へ結合する |
| 既存の差替えExecutor | Task／Attemptが受け取った終了結果 | 技術Operationを耐久保存しないExecutorにも、架空のDocker記録を補完しない |
| executor／reviewerを伴う本番実行 | Attemptから同じ実行に属する技術Operation集合への参照 | Taskの論理操作IDと技術Operationを一対一と仮定しない。役割、exact回復参照、固定結果の対応を維持する |
| retryで新しいAttemptへ移る場合 | 必要な旧Attemptの終端事実と初回耐久受領 | 現在TaskのAttempt／操作IDを解除しても、旧結果・未解決参照・初回受理世代を別Attemptへ付け替えない |
| 回復義務 | Dockerは元Operation、Lease／判断／Process安全状態は既存の各発生元 | Taskは参照と再開判断を持つ。全義務をDockerの未解決集合へ機械移管しない |

これらは単一Snapshot内の既存Task／Attemptと発生元の情報配置であり、別Registry、別保存、監視又は回復Frameworkを追加するものではない。結果受領はcleanupとは別の事実であり、Operationの整理後にも必要な結果Identityと初回受理世代を保持する。

保存形式は`crdd-coordinator/current-state/v3`とし、改訂・元Hash・物理Repository結合と各現在区画を平坦に保存する。Taskを使わない単発実行では、業務Repository結合と受付世代をともにnull、Task関連区画を空集合にする。Task初期化は既存の技術操作を失わず同じ保存の更新として行う。旧二Snapshotを内包する形式や、旧形式を補完するReaderは作らない。Taskの`CoordinatorSnapshot`はメモリ内の表示・更新DTOであり、独立した保存Envelopeではない。

| 新形式の値 | 保存・投影の境界 |
|---|---|
| Taskの`settlement` | 未終端、明示未発行、技術保存を持たないExecutorの元結果、又は同じ論理操作に属する全技術Operation参照。公開`cleanupConfirmed`／`recoveryUnresolved`は投影し保存しない |
| `resultReceipts` | 既存十一項目の受領本文を一度だけ保持する。本文自身が旧Attemptの固定Scopeを持ち、Task側は`resultAcceptanceIds`で参照する。retry後も旧本文を現在Attemptへ付け替えない |
| Docker回復義務のTask参照 | `kind`とexact`recoveryId`だけ。技術段階は元Operation、受領済みは同じRootの受領本文から導出し、Task側へ独立した`phase`やACK本文を保存しない。Task／Lease／判断／Process固有の段階は元の責務へ残す |
| 内部配送待ち | 固定結果とConsumerの参照だけ。受領Hashを複製せず、受領保存と同じ更新で対象の配送待ちを除く |

共通遷移検査は初回受領の出所・初回世代・本文不変と、Operation除去／Task参照置換／配送解消の同更新を照合する。これだけを任意更新の許可とせず、既存の業務遷移・技術操作・実観測・排他の検証を別途維持する。

### 保存排他と結果受理

単一Writerは一つの保存改訂、短期排他、比較交換、保存途中の再入場手順を意味し、常駐Writer Processの新設ではない。二ファイルを同時に原子保存できるという意味でもない。

1. 検証済みRepositoryへ結合した既存Kernel Lock一つを取得する。
2. 同じOwnerから一つのSnapshotを読み、期待保存改訂と現在Identity・許可された遷移を照合する。
3. 履歴確認済みの同じ結果について、Task／Objectiveによる耐久Consumerの受領事実を同じSnapshotへ一度保存し、その同じ更新でProducer側の内部配送待ちを解消する。内部受理という別事実を作らない。
4. 短命な`state.pending.json`から確定し、exact内容の読戻しを確認する。
5. 排他解放を確認してから呼出し元へ結果を返す。保存成功と解放成功は別に観測する。

現行の「技術保存Lock→上位受理Reader→Task保存Lock」は撤去対象である。Lock名だけを同一化して自己再取得させず、受理照合を同じOwner・同じSnapshot内へ移す。短期排他を保持した外部Reader呼出し、Provider／子Process待機、Docker回収、外部通知を禁止する。履歴の更新も同じ排他を利用し、保持済みOwnerを借りる内部処理が再取得しない構成とする。

保存用短期排他だけを一本化する。Task実行Lease、Provider Home、Host世代・実行環境回復等の別寿命の排他は維持する。`state.lock`は保存途中markerであり実効排他の代替ではない。これらの取得・解放失敗をFile削除で解除しない。

Task保存で`state.pending.json`の作成が失敗した場合、同じ呼出しが新規作成した`state.lock`だけは、真正Owner・Root・領域・marker実体と本文の一致、pendingと履歴pendingの明示不存在、元の正規本文の不変を確認できる場合に限り回収する。回収後も不存在と元本文を再確認し、保存結果は失敗のまま返す。部分作成、既存marker、実体置換、本文差又は観測不能では残存を保持する。Process喪失後のmarker-only状態まで、この同一呼出し内の回収で解決したとは扱わない。

Taskの未搬送要約は、同じ保存意図の全集合を一回の履歴候補として公開し、同じ集合で再入場する。通常保守も先行する別意図のtrimや一行ずつの出版を挟まない。各正規行を読戻した後、既存のQueue・採用・Leaseごとの退役条件を照合し、条件を満たす現在記録だけを単一Writerで除く。履歴pendingを読む経路は保守・搬送の既存専用読取りに限定し、通常Readerやstate出版pendingの拒否は緩めない。

回復後の耐久受領本文は、受領と配送解消を保存する次の業務世代を参照する。初回保存後はその世代と本文を維持し、再入場時の現在世代へ上書きしない。履歴の設定不正・前後変更・時計逆行では保存確認と整理を停止し、期限経過だけを受領や搬送完了へ変換しない。

同時保存が成立した内部経路では、現行の上位受理Reader再読取りと`pendingDeliveries.acceptanceSha256`への転記、同じ受領を二度確定するACKリレーを削除する。耐久Consumerが受領した事実自体やIdentity照合を削除しない。履歴の確定・確認前には耐久受領を保存しない。CLI／Workbenchの返却は一時返却のままとし、画面表示・既読・任意保存のACKを追加しない。実在する別保存先のConsumer受領は、この内部統合だけで完了扱いにしない。

### 正常・中断・整理

| 経路 | 残す情報と次の処置 | 禁止する短絡 |
|---|---|---|
| 正常 | Effect前の意図→開始観測→固定結果・必要成果保全→実終端・回収観測→履歴確定・確認→必要な耐久Consumer受領→不要な現在記録の整理 | AI終了だけでTask、Workspace、採用を一括完了にしない |
| 開始前取消 | 未発行を確認し、取得済みの今回資源だけを解放する | 取消通知だけから未発行や解放成功を生成しない |
| 開始後取消・親喪失 | 元Identityと発行済み／unknownを保持。新OwnerでRoot・実資源・排他をfresh確認し同じ義務へ再入場する | WeakMap／実行Capabilityの復元、別Task生成、自動AI再実行をしない |
| 結果保存済み・耐久Consumer未受領 | 固定結果と履歴確認を再観測し、未完了の搬送・受領だけを再開する | 未受領を受領済みにせず、元Provider又は回収を自動再発行しない |
| 受領保存済み・Producer完了応答喪失 | 同じ受領事実と同更新の内部配送待ち解消を再観測し、必要な終端応答・整理だけを再開する | 再配送・再受領しない。受領だけが別更新で保存される新しい部分状態を作らない |
| 受理済み・cleanup不明 | 受理と未解決回収を別事実として保持する | 受理済みをcleanup完了へ読み替えない |
| 履歴保存中断 | 元終端記録から固定した同じ行・時刻・Hashを使い、同一行の出版だけを再開する | 重複append、時刻再生成、未確認の元記録削除をしない |
| 通常期限整理 | 既定30日を超えた終了要約を設定に従って整理する | 未解決義務・未確定移送・後続参照中の結果を期限削除しない |

`state.json`と`history.jsonl`の確定は別更新である。元結果を残して行Identity・Hash・段階を固定し、短命`history.pending.jsonl`の出版・読戻し後にstateの確定段階を進める。既に同じ行があれば再appendせず確認する。state更新がその後失敗しても、履歴確定前へ巻き戻したりProviderを再実行したりしない。現在値／候補／履歴の相関が不明なら同じ参照を保持して停止する。通常の保存・読戻し確認を、突然の電源断に対する無条件保証へ強めない。

### 実装の切替単位と成立確認

- 統一Schemaと一意な情報配置を固定し、保存モデル・遷移を純粋試験で確認する。
- 既存の保存処理を一つのWriterと保存排他へ実移管する。並行した二重書込み・第三Writerを本番へ接続しない。
- OperationとTask／Queue／Workspaceを同じ保存へ接続し、履歴確認後の耐久Consumer受領を一度だけ保存する。内部ACKリレー・受理Readerの保存再入場を撤去する。
- 履歴出版と期限整理を同じOwnerの再入場へ接続し、旧Writer・旧保存Root／設定Readerを撤去する。
- 実Filesystemでwrite／flush／rename／読戻しの各中断、保存済み／応答喪失、履歴出版済み／state未確認、同時更新を反証する。取消・親喪失は合成子Processでjoinと残存を観測する。

今回の条件で追加保証を成立させられない場合は、管理機構を増築する前に不足する保証と代替案を人間へ返す。実AI・実Docker・②の保持物を使用した検証は本設計から許可されない。旧設計の機械対応と過去Evidenceは移管元保証として維持し、新方式のSource・本番接続・新しい観測が揃うまで完成を表示しない。

Workspace方式の目標は[作業領域の横断契約](05_Workspace.md)に従う。現行のTask／Attempt／Queue／保存・判断を再利用し、RepositoryとWorkspaceの対象結合、Workspace単位の競合変更と共有Git／正本／Provider資源の排他を分ける。下記の現Schema、Bundle参照、binding-wide Lease、同Process配送閉包は移行元の能力であり、新方式の確定API・保存形式ではない。旧状態を機械コピーせず、元Effect・未解決・結果参照を失わない切替契約を設計する。実装・移行・新方式検証は未完了。

状態: 設計候補
担当責任者: Qual-Lab
最終更新日: 2026-10-08

## Related

- [Orchestratorアーキテクチャ](03_Task_Architecture.md)
- [責務再編の計画](../../../99_Roadmap/Changes/CHG-000082/Evidence/261007_develop-responsibility-mapping.md)
- [Orchestrator責務分離](../../../99_Roadmap/Changes/CHG-000063/change.md)
- [検証設計](../../../07_Quality/03_Verification_Design.md)

<a id="historical-design-reference"></a>

### 過去版の参照

本書は現在の設計だけを更新する。v0.19.0時点の詳細設計と当時の件数は、現行文書へ上書きせず、`Git tag v0.19.0:06_Architecture/Details/coordinator/03_Project_Runtime_Design.md`で参照する。現在の件数と契約は本書および機械可読な設計対応から取得し、過去版の件数を現在値として利用しない。

## 1. 目的と所有範囲

### Workspace接続の実装順序と移管先

VCのWorktree技術APIは`9c462a2e`で実装・実Git試験済み。これはOrchestratorへの本番接続やGit取込を意味しない。次の接続では新しい別台帳・保存Directory・Lockを作らず、既存Snapshotと利用調停を更新する。

| 順序 | 現行Sourceと変更先 | 固定する契約・終了条件 |
|---|---|---|
| 1. 保存・遷移 | `storage/current-state.ts`、`state/model.ts`、`state/projection.ts`、Task／Objective／Decisionの純粋遷移、`queue/types.ts`、decoder・投影 | 現Snapshotの同じ`state.json`へWorkspaceの現在集合を追加する。所属Repository・方式・IsolatedのUUID／Base／確認HEAD、現在必要な作成／終了処置と明示保留期限を持つ。Task／Queueは対象参照だけを持ち、WorkspaceへTask一覧を重複保存しない |
| 2. 技術操作の接続 | 既存Snapshot Writer・操作Lease→VC公開API | 同対象の意図保存→Git作成／観測→結果保存。部分成立は同UUIDへ再観測する。Task終端・通常履歴整理で継続Workspaceを消さず、終了解決後は要約を既存履歴へ渡して不要な現在記録を除く |
| 3. 受付・Task搬送 | `objective/request.ts`、`objective/plan.ts`、`objective/execute.ts`、`task/dispatch.ts` | 新Workspaceの明示作成と既存WorkspaceへのTask依頼を分け、Objective受付だけでWorktreeを増やさない。要求→Queue→Task→Attemptの対象を固定し、既存Lease取得後の再読取り・retry・Replanでも対象を再照合する |
| 4. 保存先と実行先の分離 | `objective/public-operation.ts`、`task/executor.ts`、`task/execute-attempt.ts`→Coordinator | 所属Repository Rootは状態保存・認可・回復・結果受領へ維持する。AIの実行Treeは別の入力として渡し、Rootを単純にWorktreeへ差し替えない。Coordinator／DI側の入力と保護を接続するまで新方式の本番Task開始を有効化しない |
| 5. 採否・終了 | `workspace/operations.ts`と既存Snapshot結果Writer、既存Decision・回復参照→VC削除 | 旧Bundleの採用ReceiptをGit取込完了の証拠にしない。新Git成果の取込又は不採用・破棄を確認→非使用→終了意図保存→Worktree／専用Ref削除の段階別保存→必要判断資料の処置→履歴確定・現在記録整理とする。採用後の自動片付けは実取込確認の実装と一体で接続する |

移行元の`repositoryRoot`一値は状態保存と実行の両方に使われ、SnapshotにはWorkspace集合がなかった。現在の接続では次の新形式と操作を使う。使用中は既存Task・Queue・Lease・未解決回復から導出し、新たな監視・使用中台帳を追加しない。binding-wideの既存直列化をWorkspace導入だけで解除せず、異なるWorkspaceの並行保証は別途実接続で確認する。

| 現在の具体契約 | 値・処置 |
|---|---|
| 保存形式 | `crdd-coordinator/orchestrator-snapshot/v3`、schemaRevision=3。新規初期化はworkspaces空集合を含む。旧版・欠落集合を補完しない |
| Workspace現在値 | `workspace/record.ts`の`CoordinatorWorkspace`。UUID、generation、baseCommit、head、phase（creating／ready／discarding）、holdUntil、pending、lastResult、primaryFailure。専用Branch／PathはUUIDからVCが導出。Task一覧は持たない |
| Queue対象 | 新形式の保存QueueはworkspaceIdを必ず持つ。nullは所属Repositoryの現在Tree、UUIDはIsolatedの参照。新規受付時の指定省略はnullを記録するが、旧保存値の欠落をDirectへ補完しない。Taskは取得した同Queueの対象を継承する |
| 内部操作入口 | `manageCoordinatorWorkspace`。実在するProject／Queueの既存project-operation Lease内でcreate／observe／discard／holdを処置する。架空Queue・独立したWorkspace専用Leaseは作らない。adoptedは取込証拠未接続としてVC要求前に拒否する |
| 意図と保存 | 同ID・元世代・固定入力の意図保存→短期保存Lock解放→VC→同Lease・世代を再確認して結果保存。作成不明を別IDで再試行しない。初回Git失敗はprimaryFailureへ保持し、解決時は既存historyへcleanup失敗有無を要約する |
| 終了 | 不採用・破棄の明示要求だけで専用資源を削除。別の未終了Queue参照・Task実行中・未解決回復・明示保留を拒否する。未終端の対象Queueはcancelledへ閉じ、既にcompleted／cancelledの結果は維持して参照だけ解除する。対象を暗黙にDirect実行へ切り替えない。必要資料の親Directoryが残る間は現在記録を保持する |
| Task搬送 | `resolveCoordinatorWorkspaceTaskTarget`を既存State Portへ接続し、DispatcherがTaskごとにfresh観測する。ownerRepositoryRoot／executionTree／workspaceId／workspaceBaseCommit／workspaceHeadを分ける。repositoryRevisionでWorkspace HEADを代用しない |
| 本番実行のGate | Coordinatorが新対象搬送に未対応の間、実Adapterは`single_task_workspace_execution_not_connected`をEffect前に返す。有限AI代役の成功を本番Provider・Direct新書込み境界の成立へ換算しない |

作成中の再観測では、保存したBase・pending.expectedHeadと実HEAD／Branch HEADの一致、clean、非locked・非prunableを要求する。未成立は同IDのcreating意図を保持する。readyの継続作業にdirty禁止を拡張しない。Task対象確認の拒否は委譲前のno_effectとして扱い、架空の実行回復やProcess破棄を発行しない。Workspace操作結果のleaseReleasedは既存操作Leaseの解放だけを表し、Git資源の回収と混同しない。一次失敗のrecoveryIdは二次失敗で上書きせず、解放側の参照はreleaseRecoveryIdへ分離する。

保存形式は既存の厳密codec・世代比較・相関検査・初期化・現在投影と同時切替する。旧形式の保全・移行・清掃はフロントAIが扱い、旧要求へ暗黙にDirectを補完する互換Readerは作らない。具体的fieldと公開入力はこの接続のSource編集前に固定する。旧Bundle・旧実行入口は置換能力とConsumer接続を確認するまで撤去済みと扱わない。

正常例は同じIsolatedで複数Taskを継続し、途中Taskの終了ではTreeを保持する場合。非発火例はDirectのTask終了で、専用Worktree作成・削除をしない。境界例は終了解決待ちと新Task受付の競合、Worktree削除後のRef残存、必要判断資料の残存。情報不足例はVC更新後の保存失敗で、未実施へ巻き戻さず同対象を再観測する。試験はQA-000003の対象結合・再入場、QA-000005の採否、QA-000007の実Gitへ接続する。Orchestrator内の保存・Dispatcher接続と、外部Provider／Surface・採用取込の未接続を分ける。

本書はCoordinator内のTask／Objectiveと共通保存のInterface、Record、資源、Lock、Authority、Effect、遷移、不変条件、失敗注入を所有する。以下の既存`orchestrator`系安定値は論理役割又は通信実値であり、独立Package・Root・Storeを表さない。旧設計は対応するGit tagに保持する。

[上位アーキテクチャ](03_Task_Architecture.md)は責務、依存方向、公開APIと通知、Platform境界を所有する。[機械可読な設計対応](../../../07_Quality/Registry/coordinator-task-design-traceability.json)は本書を再定義せず、設計と実装・試験の対応切れを検出する検証用投影である。現行Symbol・旧実装Pathの対応表は移管前の基準であり、新配置の成立済み根拠ではない。Interface、Record、遷移とSemantic KeyはFolder改名だけで再採番しない。

<a id="detailed-design-contract"></a>
## 2. Interface

| ID | 所有者 | 実装状態 | 実装段階 |
|---|---|---|---|
| `IF-PROJECT-CORE` | `orchestrator_core` | `partial` | `durable_foundation_through_integration` |
| `IF-SINGLE-TASK` | `single_task_adapter` | `partial` | `responsibility_separation_and_single_task_flow` |
| `IF-STATE-STORE` | `project_state_store` | `partial` | `durable_foundation` |
| `IF-QUEUE` | `durable_operation_queue` | `partial` | `durable_foundation` |
| `IF-SCHEDULER` | `project_scheduler` | `partial` | `multi_task_execution` |
| `IF-INTEGRATION` | `integration_owner` | `partial` | `integration_and_adoption` |
| `IF-TRANSPORT` | `transport_adapter` | `partial` | `single_task_flow` |
| `IF-DECISION` | `human_decision_controller` | `partial` | `human_decision_flow` |
| `IF-PLATFORM` | `platform_adapter` | `partial` | `responsibility_separation` |

### 再編後の実装担当

上表の所有者値は論理的な役割である。実装Packageと混同せず、次の担当へ対応する。既存IDを下位APIの実装型へ移すだけの逆依存は作らない。

| Interface | 新しい実装担当 | 保存・呼出し境界 |
|---|---|---|
| `IF-PROJECT-CORE`、`IF-QUEUE`、`IF-SCHEDULER` | Coordinator内Task／Objective | 純粋な選択・遷移と、共通Storageへの業務更新を分ける。 |
| `IF-SINGLE-TASK` | Coordinator内Execution | Taskが解決済み対象を渡す。Provider差はAI Adapter、実資源終了はExecutionと専門Packageが観測する。 |
| `IF-STATE-STORE` | Coordinator共通Storage | Task・技術実行を単一Snapshot・Writer・短期Ownerへ保存する。保存原語はDomain Model、OS排他はPlatform Accessを使う。 |
| `IF-INTEGRATION` | Coordinator内Workspace／Version Control | Workspaceと候補判断はCoordinator、固定Ref／Commitと二親MergeはVersion Control。exact候補・現在HEAD／dirtyと明示採用を照合し、結果は共通Storageへ保存する。 |
| `IF-TRANSPORT` | MCP Server、Workbench Server、薄いCLI | 同じCoordinator公開要求・結果検査へ接続し、業務操作や保存をTransportへ複製しない。 |
| `IF-DECISION` | Coordinator内Decision | 判断の意味と適用世代を所有する。Host保護保存はPlatform Access、非秘密の現在適用は統合Snapshotへ保存する。 |
| `IF-PLATFORM` | Platform Access／Coordinator | OS原語はPlatform Access、実行・回復・Task再入場の意味はCoordinatorの各責務。Nativeへ業務状態を移さない。 |

Executionの開始・終了通知だけではTask／Queueの保存確定は成立しない。Coordinator内Taskが通知Identityと現在世代を照合し、共通Storageの確定・読戻し・短期Owner解放を確認した後だけ状態を進める。

### 2.1. 既存候補の採用境界

`IF-INTEGRATION`は[候補採用の引渡し契約](03_Task_Architecture.md#qualityへの引渡し)に従い、Workspaceの現在状態とVersion Controlの固定Ref／Commitから同じ候補を再観測し、明示採用Authority、Workspace／Candidate Identity、取込先HEAD、現在Revision、dirty Pathおよび許可Scopeを確認してから二親Mergeへ接続する。候補IdentityをIntegration Record、公開結果および既存結果Writerへ完全に保持する。処置前の拒否では正本Effect 0とし、Merge発行後のCommit失敗等では拒否結果だけからEffect 0を推定せず、元Effect・HEAD／Indexの観測・結果・回復参照を保持する。settlement不明時は同じRecovery義務を保持する。候補固定と候補採用を同じ成功状態へ畳まず、採用でもPushを発行しない。

## 3. 永続Record

| ID | 所有Interface | 資源 | 耐久化の意味 | 必須意味 |
|---|---|---|---|---|
| `REC-PROJECT-STATE` | `IF-STATE-STORE` | `RES-PROJECT-STATE` | `generation_state` | — |
| `REC-QUEUE-ENTRY` | `IF-QUEUE` | `RES-PROJECT-QUEUE` | `before_effect_intent` | — |
| `REC-PROJECT-LEASE` | `IF-QUEUE` | `RES-PROJECT-OPERATION-LEASE` | `before_effect_intent` | — |
| `REC-TASK-ATTEMPT` | `IF-PROJECT-CORE` | `RES-SINGLE-TASK-BINDING` | `before_effect_intent` | `attempt_operation_authority_binding`<br>`start_phase_reserved_handoff_prepared_running_or_settled`<br>`typed_recovery_obligations_host_docker_candidate_or_candidate_store`<br>`exact_technical_references_with_fresh_operation_phase_and_cleanup_projection`<br>`task_owned_result_unresolved_and_root_receipt_task_reference_in_one_cas`<br>`unresolved_recovery_without_synthetic_identity` |
| `REC-INTEGRATION` | `IF-INTEGRATION` | `RES-INTEGRATION-WORKSPACE` | `after_effect_result` | — |
| `REC-ADOPTION` | `IF-INTEGRATION` | `RES-ADOPTION-LEASE` | `after_effect_receipt` | — |
| `REC-HUMAN-DECISION` | `IF-DECISION` | `RES-PENDING-DECISION` | `generation_state` | `decision_project_milestone_generation_revision`<br>`selected_user_principal`<br>`continuation_record_id`<br>`decision_application_generation`<br>`decision_lifecycle_state` |
| `REC-DECISION-CONTINUATION` | `IF-DECISION` | `RES-DECISION-CONTINUATION` | `before_effect_intent` | `continuation_hash`<br>`selected_user_principal`<br>`decision_project_milestone_generation_revision`<br>`continuation_expiry`<br>`continuation_consumed_or_invalidated_state`<br>`replacement_request_identity`<br>`decision_application_id`<br>`expected_project_generation`<br>`new_project_generation`<br>`application_disposition_issued_prepared_finalized_recovery_invalidated_or_expired` |
| `REC-DECISION-RECOVERY-INTENT` | `IF-PLATFORM` | `RES-DECISION-RECOVERY-INTENT` | `before_effect_intent` | `exact_continuation_record_identity`<br>`last_confirmed_disposition`<br>`decision_application_id`<br>`expected_project_generation`<br>`new_project_generation`<br>`unknown_observation_boundary`<br>`recovery_identity`<br>`recovery_disposition_required_or_settled` |
| `REC-DOCKER-RECOVERY-ACKNOWLEDGEMENT` | `IF-STATE-STORE` | `RES-DOCKER-RECOVERY-ACKNOWLEDGEMENT` | `after_effect_receipt` | `exact_docker_recovery_identity`<br>`repository_binding_and_fixed_result_identity`<br>`project_task_attempt_logical_operation_binding`<br>`first_acceptance_generation_preserved`<br>`root_receipt_and_task_reference_with_matching_delivery_removal_in_one_cas_after_history_confirmation`<br>`absence_is_not_acknowledgement` |

<a id="compact-runtime-storage"></a>

### 結果受領と単一保存の確定境界

耐久Consumerの受領は、Repository、Project、Milestone、Task、Attempt、論理操作、回復参照、初回受理世代、Repository結合Hash、結果ID、固定利用側の十一項目で表す。実項目は`repositoryBindingId / projectId / milestoneId / taskId / attemptId / operationId / recoveryId / settlementGeneration / repositoryBinding / resultId / consumer`で、`consumer`の既存実値は`orchestrator`を維持する。Path、旧AppData Rootや旧領収書のHashを受領本文へ含めない。既存の`ACKNOWLEDGEMENT`系安定ID・Symbolは論理受領の識別名であり、独立ACK Store、別の受理Reader又は二段更新を意味しない。

保存正本はRootの`resultReceipts`であり、Taskは`resultAcceptanceIds`だけを持つ。メモリDTOの`resultAcceptances`は同じ受領の投影で、別の物理保存ではない。`decodeProjectResultAcceptance`は閉形式を検査し、Writerは固定Repository／Task／Attempt／論理操作／回復参照／結果を現在値と照合する。初回世代と本文を後の世代や別Attemptへ付け替えない。形式成立だけで耐久保存、資源清掃又はTask成功を主張しない。

通常Taskは開始直後・元Control除去前に結果読取り閉包を捕捉する。捕捉又は通知の失敗でも元Taskの完了・取消join・清掃を待ち、Effect前拒否へ読み替えない。閉包はHost清掃・全handoff終端後に固定結果集合だけを返し、関数やCapabilityを公開結果・Stateへ保存しない。結果0件の`not_required`は元Taskの許可された終端、Host清掃、旧操作なし、handoffとfinalizationがともに0件の場合の配送不要であり、Provider未発行の証明ではない。

技術終端・cleanup・実履歴行の確認後、Task終端候補、Root受領本文、Task参照、対応する内部配送待ちの解消、除去可能なOperationの整理を一つのSnapshot CASで確定する。`recordProjectTaskResultAcceptances`はこの候補を構築する純粋遷移であり、独立したACK Writerではない。正常の清掃済み終端・同じAttempt・固定結果全件を要求し、重複、二件目不正、本文変更、未来世代、通常受領と別の回復受領の混同を拒否する。受領からcleanupや元outcomeを補完しない。

通常Taskの捕捉済み結果集合は全件を一括受領する。複数のDocker回復義務は既存のexact参照ごとの順次処置を維持し、一件の受領CASでそのOperationだけを除ける。残るOperationがある間はTaskの技術参照集合を保持し、全対象の受領後にだけ技術Operation参照を持たない終端事実へ切り替える。各受領で元終端・履歴・同じTask／Attempt／論理操作・初回受理世代、前後のcleanupとTask固有不明の一致を確認し、未受領参照の欠落、除去済み参照の残留、配送・技術義務の片側除去を拒否する。

回復後も、先に同じexact義務の技術終端・履歴確認を保存し、現在Root・業務世代・Task／Attempt・固定結果を照合した受領候補を同じWriterへ渡す。受領だけを保存して後から別Writerで配送解除する経路は持たない。保存・読戻し・排他解放の確認後にだけ完了を返し、以後のQueue整理・retryは現在世代・Revision・競合を新しく確認する。

保存済み応答喪失やpending再入場は、元の固定候補と現在本文・改訂・元Hash・Ownerを照合し、同じ候補だけを一重確定する。通常Queryはpendingを拒否する。別候補、未知marker、部分結果又は相関不明ではbytesとexact参照を保全して停止し、Provider・技術回収・受領を自動再発行しない。別Process再提示の合成試験は、実Docker回復又は保持②の再入場成立を意味しない。

通常履歴は受領本文を複製しない。未受領配送・未解決義務・未確定移送から参照される行は30日を超えても保持し、必要行の欠落・重複・内容差・確認不能を履歴確定や受領成功にしない。参照解消後だけ通常の期限整理へ戻す。古い物理保存形式の移行・清掃はフロントAIが担当し、本番互換Readerや新しい台帳を追加しない。

### 3.1. 現在状態の一体保存と有限履歴

実Provider検証Reportの現在終了根拠は、同じ回復対象の公開再入場に限る。`required → recovering → settled → acknowledged → verification_resources_finalized → queue_settled → retry_ready`の順序・件数・Identity・世代と、同じ公開結果のrequest／Project／節目、受入判断待ち、cleanup／回復要否／Process再起動／Effect状態を共同確認する。`verification_resources_finalized`は現在Consumer・耐久ACK・終了確定の完了後だけ通知する。旧global Inventoryの空値を参照せず、無関係な操作や取消対象の不存在へ転用しない。

Report revision 11の`completed`は、予定した検証結果を確認した意味であり、取消後の上位回復義務が解消した意味ではない。各公開結果にcleanup未確認・手動回復要・Process再起動要・Effect不明が残る場合は、Report上位にも保守的に保持する。取消は同Identityの完全なProvider清掃通知を必要とし、正常完了またはProcess Tree終了を許す。開始直後に親を強制終了する別試験は、旧親からの清掃通知を仮定せず、強制終了確認とfresh再入場・耐久ACK・現在終了確定で対象操作を確認する。試験用Processの成功を実Provider E2E成立へ昇格しない。

保存統合Bでは、検証したRepository Rootの`.crdd/coordinator/`へTask進行と技術実行を一体保存する。[単一保存Lifecycle](#unified-storage-lifecycle)を正本とし、旧Orchestratorの保存先・物理Envelope・Writerを並行運用しない。上表のRecordは論理責務として維持し、ファイル統合によって判断Authorityや仕事全体の一括確定を追加保証しない。旧E2E清掃・初期化の[歴史記録](../../../99_Roadmap/Changes/CHG-000082/Evidence/261005_project-runtime-phase2.md#29-repositoryの実切替結果)は、新方式の成立根拠へ流用しない。

| ファイル | 所有する内容・終了条件 |
|---|---|
| `state.json` | 現在のProject状態、Queue、進行中Attempt、採否待ち候補への参照、未確定の結果保存・採用後処理、判断待ち、未解決回復、履歴への未確定搬送。既存操作・参照・回復の処置と終了要約の保存を確認した項目は除く。 |
| `state.lock` | 保存中断を示す固定marker。実効排他はRepository Identityへ結合した既存OS Kernel Lockが所有する。ファイル存在、PID、時刻だけを排他成立・Owner死亡の根拠にしない。 |
| `state.pending.json` | 同じ排他Ownerが確定前に作る短命な保存候補。確定後に除き、中断残存は同じIdentityの再入場で処置する。 |
| `history.jsonl` | 時刻、終了Identity、結論、最初の失敗と後続の回収結果の要約。現在状態、Authority、採否待ち・未解決処置の正本にはしない。 |

大きな候補本体は`.crdd/candidates/`、再生成できる一時物は`.crdd/tmp/<operation-id>/work/`へ分離する。新しい`staging/`、`logs/`、`orchestrator/work/`は作らない。保護方法が異なる判断継続・秘密・署名鍵はこのJSONへ移さず、既存Platform境界を維持する。

| 境界 | 保存・再入場の設計条件 |
|---|---|
| 更新競合 | Snapshot全体の改訂番号とProject／Queueごとのgenerationを区別する。期待世代を再検査し、排他Ownerだけが保存候補を公開する。Queue選択から更新へ移る内部呼出しで自己再取得しない。 |
| 保存確定 | 正規Root、閉じたSchema、内容Hash、期待世代を検証する。同じDirectory内の置換、書込み確定、read-back、異常終了時の残存をWindows実境界で確認するまで、原子的・耐久的確定を実装済みとしない。 |
| 外部待機 | 短期保存排他をProvider待機中に保持しない。長期Operation Leaseとその終了確認は別責務として維持する。 |
| 結果保存・採用後処理 | integration Recordは候補の耐久公開、adoption Receiptは実適用結果、Queue.resultReferenceは既存の結果参照として維持する。保存成功を利用者の受領・既読へ読み替えず、取得・受領確認の新しいPortを追加しない。参照中・採否待ち・回復待ちは残し、適用後に記録が失敗した場合も適用済み事実と未確定保存を保持する。記録不存在を再適用許可にしない。 |
| 終了と履歴 | 終了要約をstateへ保持し、同じ終了Identityで履歴へ搬送・確認してから現在項目を除く。中断時は重複を識別して再入場する。履歴障害だけで無関係な新規仕事を永久停止させない。 |
| 履歴保持 | 通常履歴は直近30日を保持し、起動・更新時に30日より古い要約を除く。件数・合計Byteの削除上限は設けない。期限外の行も含めて全行を逐次検証し、途中行、未来時刻・時計逆行、循環失敗を処置する。履歴から仕事やAuthorityを再実行しない。 |
| 別Port間の中断 | State、Queue、結果、保護Decisionへの呼出しの間で停止できる。物理一体化だけで全更新のall-old／all-newを主張せず、同じ仕事Identityで未完了処置へ戻る。 |
| 旧形式からの切替 | 新形態へ刷新し、旧保存形式のRuntime内変換・Fallback・旧Writerを残さない。切替時はフロントAIが旧入口の停止、現在資源・参照の確認、必要成果物の保全と用途別Rootの清掃を行う。旧仕事を新Snapshotへ自動継承せず、新しい受付世代で初期化する。 |

新版の保存契約は閉じたSnapshot v3 Schema、Root・Binding結合、期待世代による競合拒否と現在の未解決処置の保全である。本番Reader／Writerはv3だけを受理し、Hashが正しい旧v1／v2 Envelopeでも読取り・再初期化を拒否して元bytesを保全する。旧形式の連続世代を永続互換契約として維持せず、旧不変条件IDをそのまま新版の成立根拠へ読み替えない。

新版Schema、実効排他とRootの結合、Windows保存確定、結果保存・採用後処理は本番Compositionへ接続する。終了Identityは履歴確定後に退役し、通常履歴は30日保持とする。Qualityには競合、中断、再送、参照中・未解決の結果の削除、採用後の記録失敗による重複適用、旧Writer再入場、履歴循環と終了後残存を反証対象として渡す。接続の存在を独立レビュー合格や実Provider E2E合格の代替にしない。

今回の変更は既存運用の保存統合であり、受領・既読管理の新機能を追加しない。保存後も利用者が結果を読んでいないという理由だけで、終了項目を現在状態へ残し続けない。

保存統合Bの保持設定は`.crdd/config/coordinator.json`、配布例は`template/.crdd/config/coordinator.example.json`、Schemaは`template/tools/schemas/coordinator-config-schema.json`とする。`schemaRevision: 1 / historyRetentionDays`の意味、不存在時だけ30日、不正時の整理停止、非秘密設定の明示Git allowlistを維持する。旧orchestrator設定の確認・値引継ぎ・清掃はフロントAIが行い、新Runtimeは旧名を探索しない。名前の切替だけで現在Snapshotを新受付世代へ無断コピーしない。

| 新版の論理区画 | 保持する既存の意味 |
|---|---|
| 保存情報 | 閉じたSchema、Repository結合、Snapshot改訂番号、内容Hash。各Recordのgenerationとは区別する。 |
| 受付 | 現在の受付世代と進行Queueの結合。新Request発行時の世代を搬送する。刷新前のRequestを新規仕事として再受付しない。 |
| Project・Queue | 既存State・Queueの全Property。Task、Attempt、判断待ち、回復義務、requestHash、ownerGeneration、resultReferenceを省略しない。 |
| Lease記録 | 取得Identity、Owner世代、取得・解放途中とOwner喪失の既存証拠。OS排他handle自体や保護されたDecisionは保存しない。 |
| 統合・採用記録 | kind、Identity、Repository／Project／Milestone／Queue結合、内容Hash、既存value。既存結果の意味を保存整理で変更しない。 |
| 未完了後処理 | 既存回復・終了確認・履歴への未確定搬送。完了状態名だけで削除しない。 |

新版Leaseは取得意図、取得確定、解放途中、Owner喪失回収をRepository・Project・Queue・Owner世代・Owner Processへ結合する。取得途中で停止した場合に架空の取得成功を追加せず、取得結果未確定と現在の回収完了を分ける。Fileの存在だけでOwnerの稼働を、解放証拠だけで現在の実資源不存在を推定しない。

切替時の旧記録整理はフロントAIの移行手順が所有する。旧Coordinator／Orchestrator／Docker処理を停止し、実資源、未採用候補、結果・判断の未完了参照を確認してから、検証済み用途別Rootの旧記録・一時物を回収する。認証、署名鍵、送信同意、保護された有効判断、候補本体と正式Evidenceを世代記録の清掃へ混ぜない。使用中・参照中・由来不明は一括削除せず、未処置を具体的に返す。Runtimeへ汎用移行・旧履歴再生の仕組みを追加しない。

保存統合と長期実行排他は責務を分ける。短期保存排他は固定`state.lock`とRepositoryへ結合したOS排他を使用する。長期Leaseの短命な実体は`.crdd/tmp/orchestrator-leases/`へ置き、取得意図を保存してから実体を作り、実体Identityと取得証拠を保存する。解放時も意図保存、物理解放の確認、終了証拠とQueueの確定を順序付ける。短期保存排他を保持したままProvider完了を待たない。旧`orchestrator/work/locks/`へ本番処理を戻さない。

`history.jsonl`はHeader行を持たず、各行に閉じた種別・UTC時刻・終了要約を持つ。Task、技術実行、修復の要約を区別し、自由記述の診断本文や秘密値は保存しない。全行を検証し、ちょうど30日前の行は残す。未受領配送・未解決義務・未搬送履歴が必要とする行は期限外でも保護し、その行の欠落を確認済みとして扱わない。参照終了後だけ通常の期限整理へ戻す。時計逆行・未来時刻・途中行を期限切れとして削除しない。

短命な`history.pending.jsonl`は同じDirectory内の置換候補であり、履歴世代を蓄積しない。同じRoot排他下で、現在の全体Hashが候補と一致すれば候補の回収だけを行い、変更前Hashと一致すれば同じ候補の保存を再開する。不一致・破損は上書きせず保持する。確定後はread-backと短命Fileの不存在を確認する。履歴確定後だけ終了記録を除く。

部分codecは検証専用であり、本番の`state.json`として使用しない。本番は全区画を持つv3 Schemaを検証する。ID重複、孤立Queue、不正State／Queue、Root・Binding差、Hash不一致、未知fieldと未知版を拒否する。入力と返却値にはUTF-8で16MiBの上限を適用する。

短期保存排他は、検証したRepository Identityから既存`crdd-coordinator-state-kernel-lock-v1`で導出した`CRDD.Coordinator.CurrentState`のNamed Pipe名前空間へ結合する。Task更新と技術更新は同じOwnerを借用する。既存Workerの取得・保持確認・解放を再利用し、Task実行Lease、Host／Home、Provider／Dockerの別寿命の名前空間は統合しない。`assertLive()`で保持を確認し、`release()`がfalseなら未確認として停止する。保存確認を電源断耐久性へ強めない。

#### 統合保存入口の接続

`writeCoordinatorSnapshot`は、部分codecとは別の統合保存契約を使用する。現在は判断区画とWorkspace区画を含む`crdd-coordinator/orchestrator-snapshot/v3`に固定し、v1／v2からの暗黙拡張や旧DirectoryへのFallbackを行わない。

| 区画 | 固定する値 |
|---|---|
| 保存情報 | schema、schemaRevision、repositoryRootHash、repositoryBindingId、snapshotRevision。 |
| 受付 | intakeEpochと、全QueueごとのintakeBindings（queueId／epoch）。既存Queueを現在世代へ付け替えない。 |
| 既存現在値 | projects、queueEntries。各RecordのgenerationとQueueのIdentityを維持する。 |
| 継続作業 | workspaces。QueueのworkspaceIdで参照し、Task終端・通常履歴整理だけで削除しない。処置中の固定入力と一次Git失敗を保持する。 |
| 実行権の記録 | leaseEvidence、leaseIntents。取得途中／物理排他取得後／解放未確定のphaseを分け、同Ownerに併存する途中記録を省略しない。 |
| 結果と終了処理 | results、historyPending。結果は既存kind・Identity・結合・内容Hashを検証し、終了要約は履歴と同じ値契約を使う。 |

保存Envelopeはpayload、contentHash、baseRevision、baseHashの閉集合とする。baseRevisionは候補のsnapshotRevisionの一つ前、baseHashは変更前File全体のHashである。初回はbaseRevision=0／baseHash=null。候補Hashは検証済みpendingの全bytesから導出する。`state.pending.json`と確定後の`state.json`は同じEnvelopeであり、短命File内の内容を変換せず置換する。

残存pendingがあれば新規更新より先に再検証する。現在値がbaseHash・baseRevisionと一致すれば同候補のFile確定を再要求して置換する。現在値が候補全bytes・候補改訂と一致すれば現在Fileの確定を再要求し、pendingだけを回収する。不一致、部分File、Root差は保全して停止する。新規保存は固定pendingの作成・fsync・読戻し、置換、現在値の読戻しとpending不存在確認の順とする。fsync要求の成功をWindows電源断時の耐久性保証へ読み替えない。

保存入口は、未解決Queue、Lease途中、参照中結果と未搬送要約の除去を拒否する。`maintainCoordinatorSnapshot`は、Task終了・回収、判断終了、採用後処理および実Lease不存在を確認し、同じ終了Identityの要約を履歴へ確定した後だけQueue・受付結合と不要な終了記録を除く。同じ更新で受付世代を切り替え、退役済み依頼の再実行を拒否する。最新Projectと参照中結果は保持する。適用後の記録失敗は回復・後処理状態を保持し、Record不存在から採用を再実行しない。未整理Queueが残るProjectのMilestone置換を拒否し、旧仕事を孤立させない。

`readCoordinatorSnapshot`は内部保存の読取り入口であり、利用者向け結果取得・受領機能ではない。取得済みRootと親Directoryを順に検証し、領域を作成せず真正不存在だけをnullとして返す。固定pendingが存在する場合は保全停止し、この入口から確定・回収しない。正規File、単一link、安定した上限付き読取り、UTF-8、全区画・Hash・Root・Bindingを確認する。破損・alias・途中消失・観測不能から旧形式へFallbackしない。短期排他の解放確認後だけ成功を返す。本番State読取りはこのv3入口へ接続する。

保存の内部処置は取得済みOwnerを受け取り、自ら排他を再取得・解放しない。外側の入口が取得と解放確認を担当し、読取り・操作固有更新・保存を同じOwnerへ接続する。OwnerはJSONや呼出し元指定Hashから復元しない。本番CompositionはState／Queue・Lease・結果・受入判断・判断回復の新版Portを一組で使用する。

Project状態更新は入力・上限・期待世代を取得前に検証し、同じOwner内で現在値の読取り、世代比較、受付結合の再検査、更新と保存を行う。Snapshot不存在から自動初期化しない。Project不在だけは期待世代0で追加し、既存Projectは現在世代一致時だけ置換する。他Project・Queue・受付結合・Lease・結果・未搬送履歴を保持する。未整理QueueがあるProjectのMilestone置換は拒否する。pendingは保全停止し、保存専用入口の再入場で処置する。

#### 独立採用の終了と参照保護

通常Queueの終了記録はProject・Milestone・Queueの結合で照合する。採用Leaseの固定名`canonical`を通常QueueのIDと同一視しない。一般保存と固定pending再入場にも同じ除去条件を適用し、現在値だけでなく保存候補が新しく追加する成果根拠の参照も保護する。

通常Queueを持たない成功採用は、完全なReceipt、未参照、未解決処置なし、終了証拠と現在の実Lease不存在を確認して整理する。同Projectの別Receiptが残る間は、共有する終了証拠を保持する。

採用Applicationが実際の採用呼出し前にRevision／Scope不一致を検出し、取得Leaseの解放まで確認した場合だけ、`adoption`結果を`status: rejected`として保存する。固定理由、実取得`ownerGeneration`、`effectIssued: false`、`cleanupConfirmed: true`を閉じた値として持ち、成功Receiptを作らない。結果IdentityはそのOwner世代へ結合する。保存停止・例外では正式な未確定結果を返し、証拠を保持する。

この拒否結果も、exact Ownerの取得・終了証拠、現在の実資源不存在、未参照を照合し、失敗の終了要約を履歴へ確定してから対応証拠だけを除く。採用発行後、未知Effect、解放未確認、別世代の証拠だけでは整理しない。Candidate本体、最新Project、署名・認証や保護された判断は変更しない。

#### 操作と保存の接続範囲

`createCoordinatorSnapshotPersistencePorts`はState／Queueの8操作とLeaseの4操作を新版保存へ接続する。構築だけで初期化・保存・旧形式Fallbackを行わず、Request発行時の受付世代と依頼結合を固定する。本番の内部操作は`createCurrentCoordinatorPersistencePorts`から検証済みv3世代を使い、外部Requestの世代を補完するために使わない。Operation回復は要求したProject／Queueへ結合し、Adoption回復はcanonical採用Leaseへ結合する。停止理由とexact回復参照を保持する。

受付世代の本番接続では、認証・Repository・Revisionを確認した既存の状態取得入口から世代を返し、新Requestの発行側が値を固定する。CLIとMCPの受信時には現在世代へ補完・付替えしない。Projectが不在でも有効な現在Snapshotがあれば世代を取得できるが、Snapshot不存在・未確定・破損・観測不能では値を生成せず、状態取得へ初期化Effectを加えない。Workbenchは現状Objective発行者ではなく、新しい発行機能をこの保存刷新へ追加しない。

最初のState作成前と、同じ短期Owner内の保存時に受付結合を照合する。新規Queueは現在世代一致、退役前の既存Queueは保存済み受付結合・依頼内容Hash・Project・Milestone等の一致、退役済みまたは不存在の旧Queueは旧世代拒否をそれぞれ処置する。検査後の世代変更も保存前に再照合する。本番Objective入口はRequestの`intakeEpoch`と依頼結合をFactoryへ渡し、受信時に現在世代を補完しない。受付世代を人間のAuthority、発行時刻の暗号的証明または悪意ある改変の防止とは扱わない。

| 操作群 | 統合先で維持する契約 | 現在の接続状態 |
|---|---|---|
| State／Queueの8操作 | 世代比較、同依頼再送、優先順位、使用中の割込み禁止、exact回復参照。 | 本番Objective・判断・受入・統合Compositionが新版Factoryを使用する。 |
| Leaseの4操作 | 取得途中の耐久記録、実排他、解放確認、Owner喪失の再観測。 | 本番Factoryが短期保存排他と長期実行Leaseを分離して使用する。 |
| integration／adoption結果の保存 | 同Identity・同内容再送、採用後保存失敗から再適用しない。 | 本番統合とWorkbench独立採用がv3結果Portを使用する。 |
| 受入判断の作成・読取り・比較交換 | preparedの第1世代とfinalizedの第2世代、作成一回限り、期待値の完全一致。 | 本番受入入口がv3判断Storeを使用する。旧二世代をRuntime内で移行しない。 |
| 判断回復の作成・読取り・比較交換 | exact回復Identity、期待値完全一致、途中状態保全。 | 本番判断入口がv3回復Storeを使用する。旧連鎖を再構築しない。 |
| 未搬送終了要約の履歴への搬送 | 全内容一致再送、履歴確定後だけ現在値から除去、30日保持。 | Objective・判断・受入・Workbench採用の終了処置が整理入口を使用する。 |

Lease解放後にQueueの所有解除だけが中断した場合、再入場は既存の終了確定操作へ接続する。観測した受付世代、Queue世代、Owner、exact終了証拠、未解決取得意図の不存在と実排他不存在を再照合し、統合待ち等の終了意図・結果参照を保持して所有だけを解除する。実行中のOwner喪失を`recovery_required`へ移す処置とは区別し、終了証拠欠落・結合不一致・観測不能では保存を保全して停止する。過去の解放要求発行や物理排他の不存在だけから正式終了を推定しない。

受入判断・判断回復・Workspace現在集合を持つ保存形式は`crdd-coordinator/orchestrator-snapshot/v3`として区別する。v1／v2の値に欄を暗黙追加せず、未知版、不正v3、未確定保存から旧DirectoryへFallbackしない。`acceptanceDecisions`は記録ごとに第1世代と、存在する場合だけ第2世代を保持し、第2世代単独を許さない。`decisionRecoveries`は記録ごとの現在値・保存世代を保持する。新形式の比較交換は同じ排他内の完全な期待値照合とSnapshot確定で行う。旧形式はフロントAIの切替手順で整理し、Runtime内で旧連鎖を再構築しない。

両欄はRepository内の非秘密の処理記録であり、保護された判断AuthorityやCapabilityを複製しない。履歴へ移す場合も、保護記録の参照、Project適用、Queue、回復と後処理が解消する前に除去しない。退役受付世代によって過去判断の作成や再適用が復活しないことを確認する。

新版Leaseの物理排他は`.crdd/tmp/orchestrator-leases/`の短命なDirectoryとして保持し、現在状態の正本は`state.json`のintentと証拠へ統合する。取得意図を確定して短期保存排他を解放した後に物理排他を取り、同Ownerの取得記録を再照合して取得証拠を確定する。解放も意図確定、物理解放、不存在確認、終了証拠確定の順とし、短期保存排他を実行中や外部待機へ持ち越さない。Directoryの実体Identityは取得後に照合し、別の実体へ置換された場合は処置しない。物理取得後・証拠保存前の不明な窓は成功へ丸めず、exactな未解決取得として保持する。JSON上のintent除去は終了証拠と現在の物理不存在を照合した専用終了処置に限り、一般保存で未解決義務を消さない。

v3の実体結合は取得したDirectoryのdevice、inode、birthtimeMsをJSON配列順でHash化した`physicalIdentity`とする。取得前のintentではnull、取得後・解放意図では照合済みHashを持つ。これはOSが返した属性に基づく置換検知であり、AuthorityやWindows電源断保証ではない。opaque Leaseの利用時は親Directoryも正規実体として再確認する。未終了の取得証拠には同Ownerの`lock_owned`意図を要求する。終了証拠なしにintentを除いた保存候補を受理せず、終了証拠がある場合も同じ物理排他の不存在を保存確定前・pending再入場時に確認する。

物理取得前には、取得意図を保存した時点のRepository実体を同じ属性とnative realpathで再確認し、親を確認してから子を作成する。意図保存の途中失敗や保存後のOwner解放未確認は、同じexact回復参照を返す。競合・入力拒否などEffect前の停止へ、存在しない回復義務を追加しない。解放意図の保存が未確認となったopaque Leaseは以後の実行に使用しない。

履歴搬送は実発行された同じOwnerを借用し、偽造値や解放済みOwnerを拒否する。借用本体は取得・解放せず、外側が全結果の解放確認を担当する。一回の搬送では評価時刻を固定し、要約IDと全内容を照合する。期限内の要約はexact行の保存とread-back、期限超過の要約は30日契約による期限処置を区別する。履歴確定後に現在状態の保存が失敗しても、同じ要約から再送し、二重行を増やさない。一般保存と固定pending再入場の双方で、未搬送要約の除去には同内容の履歴行または検証済み期限処置を要求する。これは終了要約の搬送だけであり、Queue、Project、結果、判断、回復義務、候補本体の退役・削除を許可しない。

新版Owner喪失処置は、同一取得意図・Queue・Repository実体を読み、短期排他を解放してから既存のProcess観測へ渡す。PIDとOwner世代が一致した`absent`だけを受理し、再取得後に対象の全内容とRoot実体を再照合する。無関係な区画の更新は保持し、観測の間に対象が変わった場合は処置しない。`recovery_pending`を確定してから、正規の親と同じ実体Identityを持つ空の排他Directoryだけを解放し、不存在を確認して終了証拠を保存する。回収意図の保存後、物理解放後、終了保存中断後も同じ回復参照から再入場する。

取得証拠がある場合は`recovered_after_owner_loss`へ結合する。取得証拠がない場合は`acquisition_unknown_closed`として過去の不明と現在の回収を分ける。取得前の同Owner内で実排他不存在を確認した唯一の`acquisition_reserved`があり、旧Ownerのexact不存在、現在の空の正規Directoryと同一実体を確認できる場合だけ、物理Identityを回復意図へ保存してから回収する。不明・非空・別取得との重複・実体差は停止する。取得成功やTask成功を捏造しない。Queue Ownerが結合済みなら`recovery_required / owner_loss`へ移し、未結合ならqueuedを保持する。採用Leaseの回収を再適用許可にしない。

## 4. 資源と終了条件

| ID | 所有者 | 範囲／保存境界 | 終了条件 |
|---|---|---|---|
| `RES-PROJECT-QUEUE` | `durable_operation_queue` | `—` | `terminal_record_retained_or_policy_deletion_observed` |
| `RES-PROJECT-OPERATION-LEASE` | `parent_coordinator` | `one_operation_per_repository_binding` | `all_child_tasks_reconciled_and_os_exclusion_release_observed` |
| `RES-PROJECT-STATE` | `project_state_store` | `—` | `expected_generation_atomic_replace_observed` |
| `RES-SCHEDULER-SLOT` | `project_scheduler` | `—` | `task_process_absent_and_cleanup_confirmed` |
| `RES-CONFLICT-RESERVATION` | `project_scheduler` | `—` | `effect_candidate_and_recovery_impact_reconciled` |
| `RES-SINGLE-TASK-BINDING` | `orchestrator` | `—` | `exact_operation_settled_to_result_cleanup_or_recovery` |
| `RES-INTEGRATION-WORKSPACE` | `integration_owner` | `—` | `candidate_adopted_or_discarded_and_workspace_cleanup_observed` |
| `RES-ADOPTION-LEASE` | `integration_owner` | `—` | `adoption_receipt_and_repository_revision_observed` |
| `RES-CANCELLATION-CONTROLLER` | `parent_coordinator` | `—` | `all_target_tasks_terminated_cleaned_and_projected` |
| `RES-PROJECT-RECOVERY-EVIDENCE` | `issuing_runtime` | `—` | `exact_recovery_completed_and_resource_absence_observed` |
| `RES-DOCKER-RECOVERY-ACKNOWLEDGEMENT` | `coordinator_unified_state_store` | `repository_local_coordinator_current_state/result_receipt` | `single_snapshot_receipt_and_matching_pending_delivery_removal_read_back` |
| `RES-PENDING-DECISION` | `human_decision_controller` | `—` | `accepted_stale_superseded_or_cancelled_record_durable` |
| `RES-DECISION-CONTINUATION` | `human_decision_controller_via_platform_adapter` | `os_managed_runtime_protected_root_outside_repository` | `hash_finalized_invalidated_expired_or_recovery_obligation_settled_and_raw_capability_absent_from_runtime_owned_surfaces` |
| `RES-DECISION-RECOVERY-INTENT` | `platform_adapter_recovery_store` | `separate_verified_runtime_owned_recovery_store` | `exact_recovery_join_settled_and_intent_settlement_read_back` |

## 5. Lock

| ID | 所有者 | 順序 | 入れ子可能 | 外部待機中の保持 |
|---|---|---:|---|---|
| `LOCK-QUEUE-MUTATION` | `durable_operation_queue` | 1 | — | `false` |
| `LOCK-PROJECT-OPERATION` | `parent_coordinator` | 2 | `LOCK-PROJECT-STATE`<br>`LOCK-ADOPTION` | `true` |
| `LOCK-PROJECT-STATE` | `project_state_store` | 3 | — | `false` |
| `LOCK-ADOPTION` | `integration_owner` | 4 | — | `false` |

## 6. Authority

| ID | 所有者 | 範囲／発行 | 終了条件 |
|---|---|---|---|
| `AUTH-MILESTONE` | `authenticated_human_via_parent_coordinator` | `one_project_one_repository_one_milestone_and_declared_limits` | `milestone_terminal_or_authority_revoked` |
| `AUTH-TASK` | `orchestrator` | `strict_subset_of_milestone_for_one_task_attempt`<br>`binding_derived_from_current_project_milestone_objective_task_attempt_and_repository_revision; durable_handoff_then_cancellation_and_current_authority_check_before_delegation; no_separate_signed_package_execution_authorization` | `attempt_settled_or_superseded_or_revoked` |
| `AUTH-SINGLE-TASK-OPERATION` | `single_task_adapter` | `one_exact_single_task_operation_and_candidate_boundary` | `operation_cleanup_or_exact_recovery_obligation_observed` |
| `AUTH-INTEGRATION` | `integration_owner` | `fixed_task_result_set_and_acceptance_criteria_without_canonical_write` | `integration_candidate_fixed_or_discarded` |
| `AUTH-ADOPTION` | `authenticated_human_via_parent_coordinator` | `fixed_candidate_fixed_paths_and_fresh_canonical_revision` | `adoption_receipt_or_no_effect_rejection_observed` |
| `AUTH-RECOVERY` | `issuing_runtime` | `exact_operation_resource_and_recovery_identity_only` | `exact_recovery_completed_or_human_transfer_recorded` |
| `AUTH-HUMAN-DECISION` | `parent_coordinator_verifying_selected_user_and_runtime_owned_continuation` | `exact_pending_decision_project_milestone_generation_revision_allowed_option_and_single_use_continuation` | `protected_finalized_or_exact_recovery_obligation_durable_or_runtime_owned_stale_superseded_cancelled_project_terminal_or_expired; invalid_input_preserves_existing_capability` |

## 7. Effect

| ID | 所有者 | Effect境界 | 成立観測 |
|---|---|---|---|
| `EFFECT-QUEUE-STATE` | `durable_operation_queue` | `repository_local_queue_record_mutation` | `generation_hash_and_atomic_replace_observed` |
| `EFFECT-PROJECT-STATE` | `project_state_store` | `repository_local_project_state_mutation` | `expected_generation_and_atomic_replace_observed` |
| `EFFECT-SINGLE-TASK` | `single_task_adapter` | `provider_process_container_and_candidate_operation` | `exact_operation_result_cleanup_or_recovery_identity` |
| `EFFECT-INTEGRATION-CANDIDATE` | `integration_owner` | `isolated_workspace_and_candidate_generation` | `candidate_hash_conflict_and_workspace_cleanup` |
| `EFFECT-CANONICAL-ADOPTION` | `integration_owner` | `canonical_repository_path_mutation` | `fresh_base_revision_changed_paths_receipt_and_post_revision` |
| `EFFECT-RECOVERY` | `issuing_runtime` | `exact_residual_resource_reconciliation` | `recovery_receipt_and_resource_absence` |
| `EFFECT-DECISION-STATE` | `human_decision_controller` | `one_repository_local_atomic_decision_and_milestone_project_state_generation_application` | `expected_generation atomic_replace and project_state_readback show decision_and_milestone_all_old_or_all_new` |
| `EFFECT-DECISION-CONTINUATION` | `platform_adapter_for_human_decision_controller` | `os_managed_runtime_protected_continuation_record_cas_mutation` | `selected_user_protection application_id expected_and_new_generation disposition and atomic_update_readback` |
| `EFFECT-DECISION-RECOVERY-INTENT` | `platform_adapter_recovery_store` | `separate_runtime_owned_exact_decision_recovery_intent_mutation` | `recovery_identity unknown_boundary last_confirmed_disposition and atomic_update_readback` |

## 8. 状態機械と遷移

状態名だけで完了、cleanup、Authority失効またはEffect不存在を推定しない。各遷移は対応する資源、不変条件および検証項目が成立した場合だけ有効とする。

### `SM-TASK`

- 状態: `planned`<br>`waiting_dependency`<br>`ready`<br>`starting`<br>`running`<br>`cleanup_pending`<br>`completed`<br>`failed`<br>`cancelled`<br>`recovery_required`<br>`superseded`
- 終端状態: `completed`<br>`cancelled`<br>`superseded`

| 遷移ID | From | To | 資源 | 不変条件 | 検証 |
|---|---|---|---|---|---|
| `TRANS-TASK-PLAN-WAIT` | `planned` | `waiting_dependency` | — | `INV-REVALIDATE-AFTER-WAIT` | `PR-N-03` |
| `TRANS-TASK-PLAN-READY` | `planned`<br>`waiting_dependency` | `ready` | — | `INV-REVALIDATE-AFTER-WAIT`<br>`INV-MAX-FIVE-CLEANUP-AWARE` | `PR-N-02`<br>`PR-N-03`<br>`PR-Q-01`<br>`PR-A-01` |
| `TRANS-TASK-READY-STARTING` | `ready` | `starting` | `RES-SCHEDULER-SLOT`<br>`RES-CONFLICT-RESERVATION`<br>`RES-SINGLE-TASK-BINDING` | `INV-DURABLE-BEFORE-TASK-EFFECT`<br>`INV-EXACT-RESULT-IDENTITY` | `PR-N-02`<br>`PR-A-02`<br>`PR-A-04` |
| `TRANS-TASK-STARTING-RUNNING` | `starting` | `running` | `RES-SINGLE-TASK-BINDING` | `INV-NARROWED-AUTHORITY`<br>`INV-REVALIDATE-AFTER-WAIT`<br>`INV-DURABLE-BEFORE-TASK-EFFECT` | `PR-N-01`<br>`PR-A-03`<br>`PR-A-04` |
| `TRANS-TASK-ACTIVE-CLEANUP` | `starting`<br>`running` | `cleanup_pending` | `RES-SCHEDULER-SLOT`<br>`RES-CONFLICT-RESERVATION`<br>`RES-SINGLE-TASK-BINDING` | `INV-MAX-FIVE-CLEANUP-AWARE`<br>`INV-UNKNOWN-PRESERVES-RECOVERY` | `PR-Q-04`<br>`PR-A-05` |
| `TRANS-TASK-CLEANUP-COMPLETED` | `cleanup_pending` | `completed` | `RES-SINGLE-TASK-BINDING` | `INV-TASK-COMPLETE-NOT-ACCEPTED`<br>`INV-EXACT-RESULT-IDENTITY` | `PR-N-01`<br>`PR-I-01` |
| `TRANS-TASK-ACTIVE-FAILED` | `starting`<br>`running`<br>`cleanup_pending` | `failed` | `RES-SINGLE-TASK-BINDING` | `INV-UNKNOWN-PRESERVES-RECOVERY` | `PR-Q-02`<br>`PR-A-03` |
| `TRANS-TASK-FAILED-SUPERSEDED` | `failed` | `superseded` | — | `INV-OLD-IDENTITY-IMMUTABLE` | `PR-Q-02` |
| `TRANS-TASK-ACTIVE-CANCELLED` | `planned`<br>`waiting_dependency`<br>`ready`<br>`starting`<br>`running`<br>`cleanup_pending`<br>`failed` | `cancelled` | `RES-CANCELLATION-CONTROLLER` | `INV-CANCEL-AFTER-CLEANUP` | `PR-Q-04` |
| `TRANS-TASK-ACTIVE-RECOVERY` | `starting`<br>`running`<br>`cleanup_pending`<br>`failed` | `recovery_required` | `RES-PROJECT-RECOVERY-EVIDENCE` | `INV-UNKNOWN-PRESERVES-RECOVERY` | `PR-A-04`<br>`PR-A-05` |
| `TRANS-TASK-RECOVERY-SETTLED` | `recovery_required` | `ready` | `RES-PROJECT-RECOVERY-EVIDENCE`<br>`RES-DOCKER-RECOVERY-ACKNOWLEDGEMENT` | `INV-RECOVERY-SETTLED-BEFORE-RESUME`<br>`INV-EXACT-RESULT-IDENTITY` | `PR-A-04`<br>`PR-A-05` |

### `SM-OBJECTIVE`

- 状態: `planned`<br>`executing`<br>`integration_pending`<br>`accepted`<br>`blocked`<br>`cancelled`
- 終端状態: `accepted`<br>`cancelled`

| 遷移ID | From | To | 資源 | 不変条件 | 検証 |
|---|---|---|---|---|---|
| `TRANS-OBJECTIVE-PLAN-EXECUTE` | `planned`<br>`blocked` | `executing` | — | `INV-NARROWED-AUTHORITY` | `PR-N-03`<br>`PR-Q-02` |
| `TRANS-OBJECTIVE-EXECUTE-INTEGRATE` | `executing` | `integration_pending` | `RES-INTEGRATION-WORKSPACE` | `INV-TASK-COMPLETE-NOT-ACCEPTED` | `PR-I-01` |
| `TRANS-OBJECTIVE-INTEGRATE-ACCEPT` | `integration_pending` | `accepted` | `RES-INTEGRATION-WORKSPACE` | `INV-INTEGRATE-BEFORE-ADOPTION` | `PR-I-02` |
| `TRANS-OBJECTIVE-ACTIVE-BLOCK` | `planned`<br>`executing`<br>`integration_pending` | `blocked` | — | `INV-NO-SUCCESS-FROM-UNKNOWN` | `PR-H-01`<br>`PR-I-01` |
| `TRANS-OBJECTIVE-ACTIVE-CANCEL` | `planned`<br>`executing`<br>`integration_pending`<br>`blocked` | `cancelled` | `RES-CANCELLATION-CONTROLLER` | `INV-CANCEL-AFTER-CLEANUP` | `PR-Q-04` |

### `SM-MILESTONE`

- 状態: `planned`<br>`executing`<br>`integrating`<br>`human_decision_required`<br>`recovery_required`<br>`accepted`<br>`cancelled`
- 終端状態: `accepted`<br>`cancelled`

| 遷移ID | From | To | 資源 | 不変条件 | 検証 |
|---|---|---|---|---|---|
| `TRANS-MILESTONE-PLAN-EXECUTE` | `planned` | `executing` | `RES-PROJECT-OPERATION-LEASE` | `INV-NARROWED-AUTHORITY`<br>`INV-EXACT-RESULT-IDENTITY`<br>`INV-PLATFORM-NO-FALLBACK`<br>`INV-TRANSPORT-NO-AUTHORITY` | `PR-N-01`<br>`PR-A-07` |
| `TRANS-MILESTONE-DECISION-ACCEPTED-EXECUTE` | `human_decision_required` | `executing` | `RES-PENDING-DECISION`<br>`RES-DECISION-CONTINUATION`<br>`RES-PROJECT-OPERATION-LEASE` | `INV-DECISION-BINDING-CURRENT`<br>`INV-DECISION-RECEIPT-BEFORE-RESUME`<br>`INV-DECISION-ATOMIC-APPLICATION`<br>`INV-REVALIDATE-AFTER-WAIT` | `PR-H-02`<br>`PR-Q-06` |
| `TRANS-MILESTONE-RECOVERY-SETTLED-EXECUTE` | `recovery_required` | `executing` | `RES-PROJECT-RECOVERY-EVIDENCE`<br>`RES-DOCKER-RECOVERY-ACKNOWLEDGEMENT`<br>`RES-PROJECT-OPERATION-LEASE` | `INV-RECOVERY-SETTLED-BEFORE-RESUME`<br>`INV-REVALIDATE-AFTER-WAIT` | `PR-A-04`<br>`PR-A-05`<br>`PR-A-06` |
| `TRANS-MILESTONE-EXECUTE-INTEGRATE` | `executing` | `integrating` | `RES-INTEGRATION-WORKSPACE` | `INV-TASK-COMPLETE-NOT-ACCEPTED` | `PR-I-01` |
| `TRANS-MILESTONE-INTEGRATE-ACCEPT` | `integrating` | `accepted` | `RES-INTEGRATION-WORKSPACE`<br>`RES-ADOPTION-LEASE` | `INV-INTEGRATE-BEFORE-ADOPTION`<br>`INV-CANONICAL-EFFECT-SERIALIZED`<br>`INV-LEASE-RELEASE-UNKNOWN-BLOCKS-REUSE` | `PR-I-02`<br>`PR-D-A-01` |
| `TRANS-MILESTONE-ACTIVE-HUMAN` | `executing`<br>`integrating` | `human_decision_required` | — | `INV-NO-SUCCESS-FROM-UNKNOWN` | `PR-H-01` |
| `TRANS-MILESTONE-ACTIVE-RECOVERY` | `executing`<br>`integrating`<br>`human_decision_required` | `recovery_required` | `RES-PROJECT-RECOVERY-EVIDENCE` | `INV-UNKNOWN-PRESERVES-RECOVERY` | `PR-A-04`<br>`PR-A-05` |
| `TRANS-MILESTONE-ACTIVE-CANCEL` | `planned`<br>`executing`<br>`integrating`<br>`human_decision_required`<br>`recovery_required` | `cancelled` | `RES-CANCELLATION-CONTROLLER` | `INV-CANCEL-AFTER-CLEANUP` | `PR-Q-04` |

### `SM-QUEUE`

- 状態: `queued`<br>`leased`<br>`running`<br>`waiting_foreground`<br>`integration_pending`<br>`replan_required`<br>`human_decision_required`<br>`recovery_required`<br>`completed`<br>`cancelled`
- 終端状態: `completed`<br>`cancelled`

| 遷移ID | From | To | 資源 | 不変条件 | 検証 |
|---|---|---|---|---|---|
| `TRANS-QUEUE-ENQUEUE-LEASE` | `queued` | `leased` | `RES-PROJECT-QUEUE`<br>`RES-PROJECT-OPERATION-LEASE` | `INV-DURABLE-BEFORE-TASK-EFFECT`<br>`INV-INTERACTIVE-PRIORITY-NO-PREEMPTION`<br>`INV-DURABLE-RECORD-CLOSED`<br>`INV-QUEUE-OWNER-IS-LIVE-LEASE`<br>`INV-LEASE-ACQUISITION-RECOVERABLE` | `PR-D-N-01`<br>`PR-D-Q-01`<br>`PR-Q-03`<br>`PR-Q-05`<br>`PR-A-04`<br>`PR-A-06` |
| `TRANS-QUEUE-DECISION-ACCEPTED-REPLAN` | `human_decision_required` | `replan_required` | `RES-PENDING-DECISION`<br>`RES-DECISION-CONTINUATION`<br>`RES-PROJECT-QUEUE` | `INV-DECISION-BINDING-CURRENT`<br>`INV-DECISION-RECEIPT-BEFORE-RESUME`<br>`INV-DECISION-APPLICATION-FINALIZED-BEFORE-QUEUE` | `PR-H-02`<br>`PR-Q-06` |
| `TRANS-QUEUE-REPLAN-QUEUED` | `replan_required` | `queued` | `RES-PROJECT-QUEUE` | `INV-REVALIDATE-AFTER-WAIT` | `PR-Q-02`<br>`PR-Q-06` |
| `TRANS-QUEUE-WAITING-QUEUED` | `waiting_foreground` | `queued` | `RES-PROJECT-QUEUE` | `INV-INTERACTIVE-PRIORITY-NO-PREEMPTION`<br>`INV-REVALIDATE-AFTER-WAIT` | `PR-Q-05` |
| `TRANS-QUEUE-RECOVERY-SETTLED-QUEUED` | `recovery_required` | `queued` | `RES-PROJECT-RECOVERY-EVIDENCE`<br>`RES-DOCKER-RECOVERY-ACKNOWLEDGEMENT` | `INV-RECOVERY-SETTLED-BEFORE-RESUME`<br>`INV-REVALIDATE-AFTER-WAIT` | `PR-A-04`<br>`PR-A-05`<br>`PR-A-06` |
| `TRANS-QUEUE-LEASE-RUN` | `leased` | `running` | `RES-PROJECT-OPERATION-LEASE` | `INV-REVALIDATE-AFTER-WAIT`<br>`INV-NO-LOCK-ACROSS-EXTERNAL-WAIT`<br>`INV-QUEUE-OWNER-IS-LIVE-LEASE`<br>`INV-LEASE-RELEASE-UNKNOWN-BLOCKS-REUSE` | `PR-D-Q-01`<br>`PR-D-A-01`<br>`PR-N-01`<br>`PR-A-06` |
| `TRANS-QUEUE-RUN-INTEGRATE` | `running` | `integration_pending` | `RES-INTEGRATION-WORKSPACE`<br>`RES-PROJECT-OPERATION-LEASE` | `INV-INTEGRATE-BEFORE-ADOPTION`<br>`INV-QUEUE-OWNER-CLEARED-AFTER-LEASE-SETTLEMENT` | `PR-I-01`<br>`PR-D-A-01` |
| `TRANS-QUEUE-INTEGRATE-COMPLETE` | `integration_pending` | `completed` | `RES-PROJECT-OPERATION-LEASE` | `INV-CANONICAL-EFFECT-SERIALIZED`<br>`INV-QUEUE-OWNER-CLEARED-AFTER-LEASE-SETTLEMENT` | `PR-I-02`<br>`PR-D-A-01` |
| `TRANS-QUEUE-QUEUED-FOREGROUND` | `queued` | `waiting_foreground` | `RES-PROJECT-QUEUE` | `INV-INTERACTIVE-PRIORITY-NO-PREEMPTION` | `PR-Q-05` |
| `TRANS-QUEUE-ACTIVE-REPLAN` | `leased`<br>`running`<br>`integration_pending` | `replan_required` | `RES-PROJECT-QUEUE` | `INV-NARROWED-AUTHORITY` | `PR-Q-02` |
| `TRANS-QUEUE-ACTIVE-HUMAN` | `leased`<br>`running`<br>`integration_pending`<br>`replan_required` | `human_decision_required` | `RES-PROJECT-QUEUE` | `INV-NO-SUCCESS-FROM-UNKNOWN` | `PR-H-01` |
| `TRANS-QUEUE-ACTIVE-RECOVERY` | `leased`<br>`running`<br>`integration_pending`<br>`replan_required`<br>`human_decision_required` | `recovery_required` | `RES-PROJECT-RECOVERY-EVIDENCE` | `INV-UNKNOWN-PRESERVES-RECOVERY` | `PR-A-04`<br>`PR-A-05`<br>`PR-A-06` |
| `TRANS-QUEUE-ACTIVE-CANCEL` | `queued`<br>`leased`<br>`running`<br>`waiting_foreground`<br>`integration_pending`<br>`replan_required`<br>`human_decision_required`<br>`recovery_required` | `cancelled` | `RES-CANCELLATION-CONTROLLER` | `INV-CANCEL-AFTER-CLEANUP` | `PR-Q-04` |

### `SM-DECISION`

- 状態: `pending`<br>`accepted`<br>`stale`<br>`superseded`<br>`cancelled`
- 終端状態: `accepted`<br>`stale`<br>`superseded`<br>`cancelled`

| 遷移ID | From | To | 資源 | 不変条件 | 検証 |
|---|---|---|---|---|---|
| `TRANS-DECISION-PENDING-ACCEPTED` | `pending` | `accepted` | `RES-PENDING-DECISION`<br>`RES-DECISION-CONTINUATION`<br>`RES-PROJECT-STATE` | `INV-DECISION-BINDING-CURRENT`<br>`INV-MCP-NO-HUMAN-AUTHORITY`<br>`INV-DECISION-ATOMIC-APPLICATION` | `PR-H-02`<br>`PR-Q-06` |
| `TRANS-DECISION-PENDING-STALE` | `pending` | `stale` | `RES-PENDING-DECISION`<br>`RES-DECISION-CONTINUATION` | `INV-DECISION-BINDING-CURRENT` | `PR-Q-06` |
| `TRANS-DECISION-PENDING-SUPERSEDED` | `pending` | `superseded` | `RES-PENDING-DECISION`<br>`RES-DECISION-CONTINUATION` | `INV-DECISION-BINDING-CURRENT` | `PR-Q-06` |
| `TRANS-DECISION-PENDING-CANCELLED` | `pending` | `cancelled` | `RES-PENDING-DECISION`<br>`RES-DECISION-CONTINUATION` | `INV-DECISION-BINDING-CURRENT` | `PR-Q-06` |

### `SM-DECISION-CONTINUATION`

- 状態: `absent`<br>`issued`<br>`prepared`<br>`finalized`<br>`recovery_required`<br>`invalidated`<br>`expired`
- 終端状態: `finalized`<br>`invalidated`<br>`expired`

| 遷移ID | From | To | 資源 | 不変条件 | 検証 |
|---|---|---|---|---|---|
| `TRANS-CONTINUATION-ABSENT-ISSUED` | `absent` | `issued` | `RES-DECISION-CONTINUATION` | `INV-DECISION-CONTINUATION-PROTOCOL`<br>`INV-DECISION-CAPABILITY-ISSUED-BEFORE-RETURN` | `PR-H-02`<br>`PR-Q-06` |
| `TRANS-CONTINUATION-ISSUED-PREPARED` | `issued` | `prepared` | `RES-DECISION-CONTINUATION` | `INV-DECISION-BINDING-CURRENT`<br>`INV-DECISION-CONTINUATION-PROTOCOL` | `PR-H-02`<br>`PR-Q-06` |
| `TRANS-CONTINUATION-PREPARED-FINALIZED` | `prepared` | `finalized` | `RES-DECISION-CONTINUATION`<br>`RES-PROJECT-STATE` | `INV-DECISION-CONTINUATION-PROTOCOL`<br>`INV-DECISION-ATOMIC-APPLICATION` | `PR-H-02`<br>`PR-Q-06` |
| `TRANS-CONTINUATION-PROJECT-UNKNOWN-RECOVERY` | `prepared` | `recovery_required` | `RES-DECISION-CONTINUATION`<br>`RES-PROJECT-STATE`<br>`RES-DECISION-RECOVERY-INTENT` | `INV-DECISION-CONTINUATION-PROTOCOL`<br>`INV-UNKNOWN-PRESERVES-RECOVERY`<br>`INV-DECISION-SEPARATE-RECOVERY-INTENT` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |
| `TRANS-CONTINUATION-ISSUED-INVALIDATED` | `issued` | `invalidated` | `RES-DECISION-CONTINUATION` | `INV-DECISION-CONTINUATION-PROTOCOL` | `PR-H-02`<br>`PR-Q-06` |
| `TRANS-CONTINUATION-PREPARED-UNAPPLIED-INVALIDATED` | `prepared` | `invalidated` | `RES-DECISION-CONTINUATION`<br>`RES-PROJECT-STATE` | `INV-DECISION-CONTINUATION-PROTOCOL`<br>`INV-DECISION-PREPARED-INVALIDATION-READBACK` | `PR-H-02`<br>`PR-Q-06` |
| `TRANS-CONTINUATION-RECOVERY-FINALIZED` | `recovery_required` | `finalized` | `RES-DECISION-CONTINUATION`<br>`RES-PROJECT-STATE`<br>`RES-PROJECT-RECOVERY-EVIDENCE` | `INV-DECISION-CONTINUATION-PROTOCOL`<br>`INV-DECISION-RECOVERY-SETTLEMENT` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |
| `TRANS-CONTINUATION-RECOVERY-INVALIDATED` | `recovery_required` | `invalidated` | `RES-DECISION-CONTINUATION`<br>`RES-PROJECT-STATE`<br>`RES-PROJECT-RECOVERY-EVIDENCE` | `INV-DECISION-CONTINUATION-PROTOCOL`<br>`INV-DECISION-RECOVERY-SETTLEMENT` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |
| `TRANS-CONTINUATION-PROTECTED-RECOVERY-ISSUED-INVALIDATED` | `issued` | `invalidated` | `RES-DECISION-CONTINUATION`<br>`RES-DECISION-RECOVERY-INTENT` | `INV-DECISION-CONTINUATION-PROTOCOL`<br>`INV-DECISION-SEPARATE-RECOVERY-INTENT` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |
| `TRANS-CONTINUATION-PROTECTED-RECOVERY-PREPARED-REQUIRED` | `prepared` | `recovery_required` | `RES-DECISION-CONTINUATION`<br>`RES-PROJECT-STATE`<br>`RES-DECISION-RECOVERY-INTENT` | `INV-DECISION-CONTINUATION-PROTOCOL`<br>`INV-DECISION-SEPARATE-RECOVERY-INTENT`<br>`INV-UNKNOWN-PRESERVES-RECOVERY` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |
| `TRANS-CONTINUATION-ISSUED-EXPIRED` | `issued` | `expired` | `RES-DECISION-CONTINUATION` | `INV-DECISION-CONTINUATION-PROTOCOL` | `PR-H-02`<br>`PR-Q-06` |

### `SM-DECISION-RECOVERY-INTENT`

- 状態: `absent`<br>`required`<br>`settled`
- 終端状態: `settled`

| 遷移ID | From | To | 資源 | 不変条件 | 検証 |
|---|---|---|---|---|---|
| `TRANS-DECISION-RECOVERY-ABSENT-REQUIRED` | `absent` | `required` | `RES-DECISION-RECOVERY-INTENT` | `INV-DECISION-SEPARATE-RECOVERY-INTENT`<br>`INV-UNKNOWN-PRESERVES-RECOVERY` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |
| `TRANS-DECISION-RECOVERY-REQUIRED-SETTLED` | `required` | `settled` | `RES-DECISION-RECOVERY-INTENT`<br>`RES-DECISION-CONTINUATION`<br>`RES-PROJECT-STATE` | `INV-DECISION-SEPARATE-RECOVERY-INTENT`<br>`INV-DECISION-RECOVERY-SETTLEMENT` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |

## 9. 遷移と保証の対応

| ID | 遷移 | Lock | Authority | Effect | 順序 | 検証 |
|---|---|---|---|---|---|---|
| `BIND-TASK-PLAN-WAIT` | `TRANS-TASK-PLAN-WAIT` | `LOCK-PROJECT-STATE` | `AUTH-TASK` | `EFFECT-PROJECT-STATE` | `expected generation state update` | `PR-N-03` |
| `BIND-TASK-PLAN-READY` | `TRANS-TASK-PLAN-READY` | `LOCK-PROJECT-STATE` | `AUTH-TASK` | `EFFECT-PROJECT-STATE` | `dependency conflict and capacity revalidation precede state update` | `PR-N-02`<br>`PR-N-03`<br>`PR-Q-01`<br>`PR-A-01` |
| `BIND-TASK-READY-STARTING` | `TRANS-TASK-READY-STARTING` | `LOCK-PROJECT-STATE` | `AUTH-TASK` | `EFFECT-PROJECT-STATE` | `slot conflict reservation and task intent become durable in one generation` | `PR-N-02`<br>`PR-A-02` |
| `BIND-TASK-STARTING-RUNNING` | `TRANS-TASK-STARTING-RUNNING` | `LOCK-PROJECT-OPERATION` | `AUTH-TASK`<br>`AUTH-SINGLE-TASK-OPERATION` | `EFFECT-SINGLE-TASK`<br>`EFFECT-PROJECT-STATE` | `project state lock is released and all identities are revalidated before single task effect` | `PR-N-01`<br>`PR-A-03` |
| `BIND-TASK-ACTIVE-CLEANUP` | `TRANS-TASK-ACTIVE-CLEANUP` | `LOCK-PROJECT-STATE` | `AUTH-TASK` | `EFFECT-PROJECT-STATE` | `task settlement observation precedes cleanup pending projection` | `PR-Q-04`<br>`PR-A-05` |
| `BIND-TASK-CLEANUP-COMPLETED` | `TRANS-TASK-CLEANUP-COMPLETED` | `LOCK-PROJECT-STATE` | `AUTH-TASK` | `EFFECT-PROJECT-STATE` | `exact cleanup observation precedes completed projection` | `PR-N-01`<br>`PR-I-01` |
| `BIND-TASK-ACTIVE-FAILED` | `TRANS-TASK-ACTIVE-FAILED` | `LOCK-PROJECT-STATE` | `AUTH-TASK` | `EFFECT-PROJECT-STATE` | `known failure and current generation precede failed projection` | `PR-Q-02`<br>`PR-A-03` |
| `BIND-TASK-FAILED-SUPERSEDED` | `TRANS-TASK-FAILED-SUPERSEDED` | `LOCK-PROJECT-STATE` | `AUTH-TASK` | `EFFECT-PROJECT-STATE` | `old identity remains immutable before successor linkage` | `PR-Q-02` |
| `BIND-TASK-ACTIVE-CANCELLED` | `TRANS-TASK-ACTIVE-CANCELLED` | `LOCK-PROJECT-OPERATION`<br>`LOCK-PROJECT-STATE` | `AUTH-TASK`<br>`AUTH-SINGLE-TASK-OPERATION` | `EFFECT-SINGLE-TASK`<br>`EFFECT-PROJECT-STATE` | `cancellation request precedes termination cleanup and final state projection` | `PR-Q-04` |
| `BIND-TASK-ACTIVE-RECOVERY` | `TRANS-TASK-ACTIVE-RECOVERY` | `LOCK-PROJECT-STATE` | `AUTH-RECOVERY` | `EFFECT-PROJECT-STATE` | `unknown settlement is durably projected without issuing recovery effect` | `PR-A-04`<br>`PR-A-05` |
| `BIND-TASK-RECOVERY-SETTLED` | `TRANS-TASK-RECOVERY-SETTLED` | `LOCK-PROJECT-STATE` | `AUTH-RECOVERY` | `EFFECT-PROJECT-STATE` | `技術終端・cleanup・実履歴確認の後、root受領本文・Task参照・該当配送待ち解除を同一Snapshot CASで確定し、readback・排他解放後にQueue整理とfresh retry条件を確認する` | `PR-A-04`<br>`PR-A-05` |
| `BIND-OBJECTIVE-PLAN-EXECUTE` | `TRANS-OBJECTIVE-PLAN-EXECUTE` | `LOCK-PROJECT-STATE` | `AUTH-MILESTONE` | `EFFECT-PROJECT-STATE` | `objective authority and current generation precede execution state` | `PR-N-03`<br>`PR-Q-02` |
| `BIND-OBJECTIVE-EXECUTE-INTEGRATE` | `TRANS-OBJECTIVE-EXECUTE-INTEGRATE` | `LOCK-PROJECT-OPERATION`<br>`LOCK-PROJECT-STATE` | `AUTH-MILESTONE`<br>`AUTH-INTEGRATION` | `EFFECT-INTEGRATION-CANDIDATE`<br>`EFFECT-PROJECT-STATE` | `all task cleanup precedes isolated integration and integration pending projection` | `PR-I-01` |
| `BIND-OBJECTIVE-INTEGRATE-ACCEPT` | `TRANS-OBJECTIVE-INTEGRATE-ACCEPT` | `LOCK-PROJECT-STATE` | `AUTH-INTEGRATION` | `EFFECT-PROJECT-STATE` | `acceptance evidence and fixed integration result precede accepted projection` | `PR-I-02` |
| `BIND-OBJECTIVE-ACTIVE-BLOCK` | `TRANS-OBJECTIVE-ACTIVE-BLOCK` | `LOCK-PROJECT-STATE` | `AUTH-MILESTONE` | `EFFECT-PROJECT-STATE` | `unknown or conflict remains explicit before blocked projection` | `PR-H-01`<br>`PR-I-01` |
| `BIND-OBJECTIVE-ACTIVE-CANCEL` | `TRANS-OBJECTIVE-ACTIVE-CANCEL` | `LOCK-PROJECT-OPERATION`<br>`LOCK-PROJECT-STATE` | `AUTH-MILESTONE`<br>`AUTH-SINGLE-TASK-OPERATION` | `EFFECT-SINGLE-TASK`<br>`EFFECT-PROJECT-STATE` | `all target task cancellation cleanup precedes objective cancellation projection` | `PR-Q-04` |
| `BIND-MILESTONE-PLAN-EXECUTE` | `TRANS-MILESTONE-PLAN-EXECUTE` | `LOCK-PROJECT-OPERATION`<br>`LOCK-PROJECT-STATE` | `AUTH-MILESTONE` | `EFFECT-PROJECT-STATE` | `platform binding revision and authority validation precede execution state` | `PR-N-01`<br>`PR-A-07` |
| `BIND-MILESTONE-DECISION-ACCEPTED-EXECUTE` | `TRANS-MILESTONE-DECISION-ACCEPTED-EXECUTE` | `LOCK-PROJECT-OPERATION`<br>`LOCK-PROJECT-STATE` | `AUTH-MILESTONE`<br>`AUTH-HUMAN-DECISION` | `EFFECT-DECISION-STATE` | `logical milestone projection in the same project state atomic replace as decision acceptance; standalone issue forbidden` | `PR-H-02`<br>`PR-Q-06` |
| `BIND-MILESTONE-RECOVERY-SETTLED-EXECUTE` | `TRANS-MILESTONE-RECOVERY-SETTLED-EXECUTE` | `LOCK-PROJECT-STATE` | `AUTH-MILESTONE`<br>`AUTH-RECOVERY` | `EFFECT-PROJECT-STATE` | `技術終端・cleanup・実履歴確認の後、root受領本文・Task参照・該当配送待ち解除を同一Snapshot CASで確定し、readback・排他解放後にQueue整理とfresh retry条件を確認する` | `PR-A-04`<br>`PR-A-05`<br>`PR-A-06` |
| `BIND-MILESTONE-EXECUTE-INTEGRATE` | `TRANS-MILESTONE-EXECUTE-INTEGRATE` | `LOCK-PROJECT-OPERATION`<br>`LOCK-PROJECT-STATE` | `AUTH-MILESTONE`<br>`AUTH-INTEGRATION` | `EFFECT-INTEGRATION-CANDIDATE`<br>`EFFECT-PROJECT-STATE` | `all objectives accepted before isolated milestone integration` | `PR-I-01` |
| `BIND-MILESTONE-INTEGRATE-ACCEPT` | `TRANS-MILESTONE-INTEGRATE-ACCEPT` | `LOCK-PROJECT-OPERATION`<br>`LOCK-ADOPTION`<br>`LOCK-PROJECT-STATE` | `AUTH-INTEGRATION`<br>`AUTH-ADOPTION`<br>`AUTH-MILESTONE` | `EFFECT-CANONICAL-ADOPTION`<br>`EFFECT-PROJECT-STATE` | `fixed candidate fresh canonical revision and adoption receipt precede accepted projection` | `PR-A-06`<br>`PR-I-02` |
| `BIND-MILESTONE-ACTIVE-HUMAN` | `TRANS-MILESTONE-ACTIVE-HUMAN` | `LOCK-PROJECT-STATE` | `AUTH-MILESTONE` | `EFFECT-PROJECT-STATE` | `decision need and impact are durable before human transfer` | `PR-H-01` |
| `BIND-MILESTONE-ACTIVE-RECOVERY` | `TRANS-MILESTONE-ACTIVE-RECOVERY` | `LOCK-PROJECT-STATE` | `AUTH-RECOVERY` | `EFFECT-PROJECT-STATE` | `unknown resource evidence is durable without normal resume` | `PR-A-04`<br>`PR-A-05` |
| `BIND-MILESTONE-ACTIVE-CANCEL` | `TRANS-MILESTONE-ACTIVE-CANCEL` | `LOCK-PROJECT-OPERATION`<br>`LOCK-PROJECT-STATE` | `AUTH-MILESTONE`<br>`AUTH-SINGLE-TASK-OPERATION` | `EFFECT-SINGLE-TASK`<br>`EFFECT-PROJECT-STATE` | `all task cancellation cleanup and recovery reconciliation precede milestone cancellation` | `PR-Q-04` |
| `BIND-QUEUE-ENQUEUE-LEASE` | `TRANS-QUEUE-ENQUEUE-LEASE` | `LOCK-QUEUE-MUTATION`<br>`LOCK-PROJECT-OPERATION` | `AUTH-MILESTONE` | `EFFECT-QUEUE-STATE` | `queue intent is durable before operation lease and locks are not held together` | `PR-D-N-01`<br>`PR-D-Q-01`<br>`PR-Q-03`<br>`PR-Q-05`<br>`PR-A-06` |
| `BIND-QUEUE-DECISION-ACCEPTED-REPLAN` | `TRANS-QUEUE-DECISION-ACCEPTED-REPLAN` | `LOCK-QUEUE-MUTATION` | `AUTH-MILESTONE` | `EFFECT-QUEUE-STATE` | `fresh read only protected finalized observation and matching project application generation precede the durable replan_required generation; no lease is issued on this transition` | `PR-H-02`<br>`PR-Q-06` |
| `BIND-QUEUE-REPLAN-QUEUED` | `TRANS-QUEUE-REPLAN-QUEUED` | `LOCK-QUEUE-MUTATION` | `AUTH-MILESTONE` | `EFFECT-QUEUE-STATE` | `bounded replanning is durably complete before the queue returns to queued for a fresh selection` | `PR-Q-02`<br>`PR-Q-06` |
| `BIND-QUEUE-WAITING-QUEUED` | `TRANS-QUEUE-WAITING-QUEUED` | `LOCK-QUEUE-MUTATION` | `AUTH-MILESTONE` | `EFFECT-QUEUE-STATE` | `a fresh binding-wide scan confirms no foreground owner before the scheduled queue returns to queued` | `PR-Q-05` |
| `BIND-QUEUE-RECOVERY-SETTLED-QUEUED` | `TRANS-QUEUE-RECOVERY-SETTLED-QUEUED` | `LOCK-QUEUE-MUTATION` | `AUTH-RECOVERY` | `EFFECT-RECOVERY`<br>`EFFECT-QUEUE-STATE` | `技術終端・cleanup・実履歴確認の後、root受領本文・Task参照・該当配送待ち解除を同一Snapshot CASで確定し、readback・排他解放後にQueue整理とfresh retry条件を確認する` | `PR-A-04`<br>`PR-A-05`<br>`PR-A-06` |
| `BIND-QUEUE-LEASE-RUN` | `TRANS-QUEUE-LEASE-RUN` | `LOCK-QUEUE-MUTATION`<br>`LOCK-PROJECT-OPERATION` | `AUTH-MILESTONE` | `EFFECT-QUEUE-STATE` | `lease identity is revalidated before running projection` | `PR-N-01`<br>`PR-A-06` |
| `BIND-QUEUE-RUN-INTEGRATE` | `TRANS-QUEUE-RUN-INTEGRATE` | `LOCK-QUEUE-MUTATION`<br>`LOCK-PROJECT-OPERATION` | `AUTH-INTEGRATION` | `EFFECT-INTEGRATION-CANDIDATE`<br>`EFFECT-QUEUE-STATE` | `all task cleanup precedes integration and queue projection` | `PR-I-01` |
| `BIND-QUEUE-INTEGRATE-COMPLETE` | `TRANS-QUEUE-INTEGRATE-COMPLETE` | `LOCK-QUEUE-MUTATION`<br>`LOCK-PROJECT-OPERATION` | `AUTH-MILESTONE` | `EFFECT-QUEUE-STATE` | `milestone terminal state and all resource release observations precede queue completion` | `PR-I-02` |
| `BIND-QUEUE-QUEUED-FOREGROUND` | `TRANS-QUEUE-QUEUED-FOREGROUND` | `LOCK-QUEUE-MUTATION` | `AUTH-MILESTONE` | `EFFECT-QUEUE-STATE` | `interactive priority delays only unstarted scheduled entry` | `PR-Q-05` |
| `BIND-QUEUE-ACTIVE-REPLAN` | `TRANS-QUEUE-ACTIVE-REPLAN` | `LOCK-QUEUE-MUTATION`<br>`LOCK-PROJECT-OPERATION` | `AUTH-MILESTONE` | `EFFECT-QUEUE-STATE` | `settled task impact and bounded replan need precede queue projection` | `PR-Q-02` |
| `BIND-QUEUE-ACTIVE-HUMAN` | `TRANS-QUEUE-ACTIVE-HUMAN` | `LOCK-QUEUE-MUTATION`<br>`LOCK-PROJECT-OPERATION` | `AUTH-MILESTONE` | `EFFECT-QUEUE-STATE` | `decision need is durable and operation remains owned` | `PR-H-01` |
| `BIND-QUEUE-ACTIVE-RECOVERY` | `TRANS-QUEUE-ACTIVE-RECOVERY` | `LOCK-QUEUE-MUTATION`<br>`LOCK-PROJECT-OPERATION` | `AUTH-RECOVERY` | `EFFECT-QUEUE-STATE` | `exact recovery evidence is durable without recovery effect or lease release` | `PR-A-04`<br>`PR-A-05`<br>`PR-A-06` |
| `BIND-QUEUE-ACTIVE-CANCEL` | `TRANS-QUEUE-ACTIVE-CANCEL` | `LOCK-QUEUE-MUTATION`<br>`LOCK-PROJECT-OPERATION` | `AUTH-MILESTONE`<br>`AUTH-SINGLE-TASK-OPERATION` | `EFFECT-SINGLE-TASK`<br>`EFFECT-QUEUE-STATE` | `all target cancellation cleanup and resource reconciliation precede queue cancellation` | `PR-Q-04` |
| `BIND-DECISION-PENDING-ACCEPTED` | `TRANS-DECISION-PENDING-ACCEPTED` | `LOCK-PROJECT-OPERATION`<br>`LOCK-PROJECT-STATE` | `AUTH-MILESTONE`<br>`AUTH-HUMAN-DECISION` | `EFFECT-DECISION-STATE` | `protected continuation consume intent precedes one expected generation atomic decision and milestone project state replace then readback; queue lease is a later idempotent transition` | `PR-H-02`<br>`PR-Q-06` |
| `BIND-DECISION-PENDING-STALE` | `TRANS-DECISION-PENDING-STALE` | `LOCK-PROJECT-STATE` | `AUTH-MILESTONE` | `EFFECT-DECISION-STATE` | `parent observed project generation change precedes runtime owned stale transition` | `PR-Q-06` |
| `BIND-DECISION-PENDING-SUPERSEDED` | `TRANS-DECISION-PENDING-SUPERSEDED` | `LOCK-PROJECT-STATE` | `AUTH-MILESTONE` | `EFFECT-DECISION-STATE` | `parent issued replacement decision before runtime owned superseded transition` | `PR-Q-06` |
| `BIND-DECISION-PENDING-CANCELLED` | `TRANS-DECISION-PENDING-CANCELLED` | `LOCK-PROJECT-STATE` | `AUTH-MILESTONE` | `EFFECT-DECISION-STATE` | `milestone cancellation precedes runtime owned decision cancellation` | `PR-Q-06` |
| `BIND-CONTINUATION-ABSENT-ISSUED` | `TRANS-CONTINUATION-ABSENT-ISSUED` | `LOCK-PROJECT-OPERATION` | `AUTH-MILESTONE` | `EFFECT-DECISION-CONTINUATION` | `unique pending decision or replacement request identity precedes protected create CAS and fresh readback; raw capability is returned to the client only after issued readback and duplicate request reuses the same issued record` | `PR-H-02`<br>`PR-Q-06` |
| `BIND-CONTINUATION-ISSUED-PREPARED` | `TRANS-CONTINUATION-ISSUED-PREPARED` | `LOCK-PROJECT-OPERATION` | `AUTH-HUMAN-DECISION` | `EFFECT-DECISION-CONTINUATION` | `validated exact submission precedes protected CAS from issued to prepared and protected readback precedes project state effect` | `PR-H-02`<br>`PR-Q-06` |
| `BIND-CONTINUATION-PREPARED-FINALIZED` | `TRANS-CONTINUATION-PREPARED-FINALIZED` | `LOCK-PROJECT-OPERATION` | `AUTH-HUMAN-DECISION` | `EFFECT-DECISION-CONTINUATION` | `fresh project state readback with matching application id and new generation precedes protected CAS from prepared to finalized and protected readback` | `PR-H-02`<br>`PR-Q-06` |
| `BIND-CONTINUATION-PROJECT-UNKNOWN-RECOVERY` | `TRANS-CONTINUATION-PROJECT-UNKNOWN-RECOVERY` | `LOCK-PROJECT-OPERATION` | `AUTH-RECOVERY` | `EFFECT-DECISION-CONTINUATION` | `when project observation alone is unknown a separate recovery intent required readback already exists before protected prepared to recovery_required CAS and readback; protected unknown never claims this transition` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |
| `BIND-CONTINUATION-ISSUED-INVALIDATED` | `TRANS-CONTINUATION-ISSUED-INVALIDATED` | `LOCK-PROJECT-OPERATION` | `AUTH-MILESTONE` | `EFFECT-DECISION-CONTINUATION` | `runtime owned stale superseded cancelled terminal or explicit replacement cause precedes issued record invalidation CAS and readback` | `PR-H-02`<br>`PR-Q-06` |
| `BIND-CONTINUATION-PREPARED-UNAPPLIED-INVALIDATED` | `TRANS-CONTINUATION-PREPARED-UNAPPLIED-INVALIDATED` | `LOCK-PROJECT-OPERATION` | `AUTH-MILESTONE` | `EFFECT-DECISION-CONTINUATION` | `fresh project state readback proves expected old generation and application absent before prepared record invalidation CAS and readback; matching new generation must finalize instead` | `PR-H-02`<br>`PR-Q-06` |
| `BIND-CONTINUATION-RECOVERY-FINALIZED` | `TRANS-CONTINUATION-RECOVERY-FINALIZED` | `LOCK-PROJECT-OPERATION` | `AUTH-RECOVERY` | `EFFECT-DECISION-CONTINUATION` | `exact recovery fresh readback proves matching new project generation and application id before protected recovery to finalized CAS and readback` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |
| `BIND-CONTINUATION-RECOVERY-INVALIDATED` | `TRANS-CONTINUATION-RECOVERY-INVALIDATED` | `LOCK-PROJECT-OPERATION` | `AUTH-RECOVERY` | `EFFECT-DECISION-CONTINUATION` | `exact recovery fresh readback proves expected old project generation and application absent before protected recovery to invalidated CAS and readback` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |
| `BIND-CONTINUATION-PROTECTED-RECOVERY-ISSUED-INVALIDATED` | `TRANS-CONTINUATION-PROTECTED-RECOVERY-ISSUED-INVALIDATED` | `LOCK-PROJECT-OPERATION` | `AUTH-RECOVERY` | `EFFECT-DECISION-CONTINUATION` | `independent recovery intent required readback and fresh issued observation with no project application precede protected issued to invalidated CAS and readback` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |
| `BIND-CONTINUATION-PROTECTED-RECOVERY-PREPARED-REQUIRED` | `TRANS-CONTINUATION-PROTECTED-RECOVERY-PREPARED-REQUIRED` | `LOCK-PROJECT-OPERATION` | `AUTH-RECOVERY` | `EFFECT-DECISION-CONTINUATION` | `independent recovery intent required readback and fresh prepared observation precede protected prepared to recovery_required CAS and readback; exact project reconciliation follows through recovery transitions` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |
| `BIND-CONTINUATION-ISSUED-EXPIRED` | `TRANS-CONTINUATION-ISSUED-EXPIRED` | `LOCK-PROJECT-OPERATION` | `AUTH-MILESTONE` | `EFFECT-DECISION-CONTINUATION` | `runtime observed finite expiry precedes protected expiry CAS and readback` | `PR-H-02`<br>`PR-Q-06` |
| `BIND-DECISION-RECOVERY-ABSENT-REQUIRED` | `TRANS-DECISION-RECOVERY-ABSENT-REQUIRED` | `LOCK-PROJECT-OPERATION` | `AUTH-RECOVERY` | `EFFECT-DECISION-RECOVERY-INTENT` | `project-only unknown or protected observation or CAS readback unknown first creates and reads back one exact independent recovery intent; protected unknown then stops without claiming a continuation transition; unavailable recovery store requires manual recovery effect unknown and process reuse forbidden` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |
| `BIND-DECISION-RECOVERY-REQUIRED-SETTLED` | `TRANS-DECISION-RECOVERY-REQUIRED-SETTLED` | `LOCK-PROJECT-OPERATION` | `AUTH-RECOVERY` | `EFFECT-DECISION-RECOVERY-INTENT` | `independent intent joins fresh protected and project observations; any required continuation transition settles and reads back first and intent settlement CAS and readback completes last` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |

## 10. 不変条件

| ID | 必須意味 |
|---|---|
| `INV-DURABLE-BEFORE-TASK-EFFECT` | `Task attempt and non-secret authority binding become reserved before operation creation; exact operation identity becomes handoff_prepared before Single Task effect; running is recorded only from the adapter start observation` |
| `INV-MAX-FIVE-CLEANUP-AWARE` | `Starting running and cleanup-unknown tasks occupy at most five capacity slots` |
| `INV-REVALIDATE-AFTER-WAIT` | `Generation identity authority cancellation and conflicts are revalidated after every wait` |
| `INV-NO-LOCK-ACROSS-EXTERNAL-WAIT` | `Queue state and adoption mutation locks are not held across provider process transport or human waits` |
| `INV-NARROWED-AUTHORITY` | `Orchestrator derives the task authority binding from the current project milestone revision objective task and retry generation; the coordinator adapter receives only the resulting task-scoped request and cannot supply or widen that binding` |
| `INV-TASK-COMPLETE-NOT-ACCEPTED` | `Task completion never implies objective or milestone acceptance` |
| `INV-CANONICAL-CANDIDATE-IDENTITY` | `Workspace操作が固定した正規Candidate IdentityはIntegration Record、公開結果、採用要求およびReceiptで欠落・短縮・再採番されず、ConsumerはCanonical Contractより狭い局所制限を課さない` |
| `INV-EXACT-RESULT-IDENTITY` | `Generation task attempt operation authority revision and storable recovery identities plus status effect cleanup recovery and process restart correlations must match before projection; runtime process recovery identity is issued only by the parent runtime and accepted only for its process instance task attempt and operation; known rejection before delegation replans with no effect, while unknown handoff after delegation or any non-settled result after observed effect start poisons the process, creates the bound runtime process obligation, and remains externally unresolved unless an exact external recovery closure exists` |
| `INV-INTEGRATE-BEFORE-ADOPTION` | `Objective and milestone evidence and cross-task integration precede canonical adoption` |
| `INV-UNKNOWN-PRESERVES-RECOVERY` | `Unknown cleanup or effect state preserves evidence and exact recovery identity` |
| `INV-NO-SUCCESS-FROM-UNKNOWN` | `Missing stale or conflicting evidence is not normalized to success` |
| `INV-CANCEL-AFTER-CLEANUP` | `Cancellation completes only after any freshly issued unused task authority is revoked and every target whose provider command received a successful OS spawn acknowledgement with valid process and stream ownership then emitted one durably accepted lifecycle notice for the exact objective role provider and globally unique operation terminates cleanup completes and project state is projected; handle return provider selection or controller start is not provider process-start evidence and uncertain acknowledgement notice delivery or revocation preserves failure or recovery` |
| `INV-OLD-IDENTITY-IMMUTABLE` | `Superseded task identity remains immutable and links to a new successor` |
| `INV-PLATFORM-NO-FALLBACK` | `Unknown or unsupported platform stops without fallback or effect` |
| `INV-TRANSPORT-NO-AUTHORITY` | `CLI MCP and future transports do not create project authority or success; Integration result fields recovery identities and correlations are validated by the Core-owned canonical contract rather than redefined by MCP; MCP emits only method-specific exact-contract recursively closed descriptor-safe DTOs and rejects nested unknown fields cross-method shapes outer-to-nested project or milestone mismatch status effect cleanup manual-recovery process-restart recovery-obligation correlation failures duplicate or invalid recovery identities unreachable milestone and objective or task count combinations and outer-objective contradictions with acceptance cancellation human-decision or recovery; resolved history is not promoted to current blockage and transport does not guess schedule versus wait without the task graph` |
| `INV-CANONICAL-EFFECT-SERIALIZED` | `Canonical repository adoption is serialized and fresh revision checked` |
| `INV-INTERACTIVE-PRIORITY-NO-PREEMPTION` | `Queue priority applies only to unowned entries; after the repository binding lease is acquired a fresh queue selection must still match before claim; a leased or running owner prevents every second operation lease, parks later scheduled work, and never erases active obligations` |
| `INV-DURABLE-RECORD-CLOSED` | `Durable state and queue records have an exact schema filename bound generation and contiguous immutable generation history` |
| `INV-QUEUE-OWNER-IS-LIVE-LEASE` | `Queue owner generation is derived only from a runtime issued live lease bound to the exact repository binding and queue; one binding has at most one operation owner` |
| `INV-LEASE-RELEASE-UNKNOWN-BLOCKS-REUSE` | `Every post-acquire exit attempts physical release; lease release intent is durable before lock removal and unresolved exact evidence blocks reacquisition` |
| `INV-LEASE-ACQUISITION-RECOVERABLE` | `An atomically published acquisition marker bound to lease kind source queue owner generation process and deterministic recovery identity precedes the physical lock; a second exact marker proves lock ownership; project operation and canonical adoption pre-owner failures reach fresh complete rollback, exact common recovery with all markers and lock absent, or unchanged manual recovery obligation` |
| `INV-QUEUE-OWNER-CLEARED-AFTER-LEASE-SETTLEMENT` | `Queue owner is cleared only after fresh lock absence exact released evidence and release-marker absence` |
| `INV-RECOVERY-SETTLED-BEFORE-RESUME` | 各Task義務のexact Identityをrequired／recovering／settledまで保持する。Docker結果は技術終端・cleanup・実履歴行の確認後に読み、Repository・Task・Attempt・Operation・回復参照・固定結果・Consumerを照合する。Task受領参照、単一受領事実、対応する内部配送待ちの解消と除去可能なOperationの終了は、一つのSnapshot CASで確定する。保存後応答喪失は同じ候補の再入場で一重確定し、別のACK更新や結果読取りから解除しない。保存と排他解放の確認前は完了を返さず、unknownと元参照は保持する。不存在やIDだけを受領・削除Authorityにしない。回復後に世代・Revision・競合を新しく確認する。 |
| `INV-DECISION-BINDING-CURRENT` | `Human decision applies only to the exact current decision project milestone generation revision and allowed option` |
| `INV-MCP-NO-HUMAN-AUTHORITY` | `MCP metadata session provider identity and comment never create Human Authority` |
| `INV-DECISION-RECEIPT-BEFORE-RESUME` | `Milestone and queue resume only once from an exact accepted decision receipt and fresh project generation` |
| `INV-DECISION-ATOMIC-APPLICATION` | `Protected continuation record is prepared before one atomic decision and milestone project state replace then reconciled and finalized without claiming cross root atomicity` |
| `INV-DECISION-APPLICATION-FINALIZED-BEFORE-QUEUE` | `Queue lease occurs only after fresh protected continuation finalized observation and matching project state application id and generation readback` |
| `INV-DECISION-CONTINUATION-PROTOCOL` | `Only Platform Adapter owned protected CAS creates issued and transitions issued to prepared and prepared to finalized; invalid input leaves the record unchanged; project-only unknown may enter protected recovery after independent intent readback while protected-root unknown records only independent recovery intent and claims no protected transition` |
| `INV-DECISION-CAPABILITY-ISSUED-BEFORE-RETURN` | `Raw capability is returned only after unique protected issued record create and fresh readback; duplicate issuance request reuses the same record and replacement first invalidates the old hash` |
| `INV-DECISION-PREPARED-INVALIDATION-READBACK` | `Prepared continuation invalidates only after fresh project state proves the expected old generation and application id absent; matching new generation finalizes and unknown recovers` |
| `INV-DECISION-RECOVERY-SETTLEMENT` | `Recovery settles matching new project generation to continuation finalized and verified old unapplied to continuation invalidated; exact absent with raw not returned or exact expired with project unapplied safely settles no-effect; unknown or conflict preserves the observable continuation state and keeps the independent recovery intent required` |
| `INV-DECISION-SEPARATE-RECOVERY-INTENT` | `Protected observation unknown never claims a protected transition and uses a separate verified recovery store; if that store is unknown manual recovery and process reuse prohibition remain` |

## 11. 失敗注入

| ID | 対象遷移 | 期待結果 | 検証 |
|---|---|---|---|
| `FAIL-QUEUE-WRITE` | `TRANS-QUEUE-ENQUEUE-LEASE` | `no_task_or_provider_effect_and_no_state_reset` | `PR-D-A-01`<br>`PR-A-06` |
| `FAIL-LEASE-ACQUISITION` | `TRANS-QUEUE-ENQUEUE-LEASE` | `marker_write_flush_rename_readback_lock_ownership_evidence_release_intent_and_pre_owner_failures_reach_fresh_total_absence_exact_common_recovery_or_unchanged_manual_recovery_with_deterministic_identity` | `PR-A-04`<br>`PR-D-A-01` |
| `FAIL-LEASE-OWNER-LOSS` | `TRANS-QUEUE-LEASE-RUN`<br>`TRANS-MILESTONE-ACTIVE-RECOVERY` | `reserved task returns ready with effect zero; handoff_prepared task requires exact matched recovery or explicit complete absence; running task requires exact matched recovery; all post-acquire exits attempt physical release and exact queue owner reconciliation or retain every typed recovery obligation` | `PR-A-04`<br>`PR-A-06` |
| `FAIL-STATE-GENERATION` | `TRANS-TASK-ACTIVE-FAILED` | `no_cross_task_projection` | `PR-A-03` |
| `FAIL-DUPLICATE-REQUEST` | `TRANS-QUEUE-ENQUEUE-LEASE` | `same_request_reuses_project_operation_distinct_tasks_may_run_and_same_task_attempt_effect_is_not_reissued` | `PR-D-Q-01`<br>`PR-Q-03` |
| `FAIL-CAPACITY-RACE` | `TRANS-TASK-READY-STARTING` | `sixth_task_effect_zero` | `PR-A-02` |
| `FAIL-TASK-RESULT-IDENTITY` | `TRANS-TASK-ACTIVE-FAILED` | `identity schema correlation unstorable recovery unknown recovery kind or flat-to-typed mismatch is not success; no synthetic recovery identity is minted; unresolved recovery and process restart are preserved in the project result` | `PR-A-03` |
| `FAIL-CANCEL-DURING-START` | `TRANS-TASK-ACTIVE-CANCELLED` | `synchronous_or_asynchronous_spawn_failure_emits_no_start_notice_and_closes_fail_closed_or_post_spawn_acknowledgement_exact_ordered_notice_write_receipt_termination_and_cleanup_are_tracked` | `PR-Q-04` |
| `FAIL-CLEANUP-UNKNOWN` | `TRANS-TASK-ACTIVE-RECOVERY` | `slot_and_conflict_not_released` | `PR-A-05` |
| `FAIL-INTEGRATION-CONFLICT` | `TRANS-OBJECTIVE-ACTIVE-BLOCK`<br>`TRANS-MILESTONE-ACTIVE-HUMAN` | `no_acceptance_and_candidate_isolated` | `PR-I-01` |
| `FAIL-ADOPTION-REVISION` | `TRANS-QUEUE-ACTIVE-REPLAN`<br>`TRANS-QUEUE-ACTIVE-HUMAN` | `canonical_effect_zero` | `PR-A-06` |
| `FAIL-TRANSPORT-DISCONNECT` | `TRANS-TASK-ACTIVE-CANCELLED` | `cancel_request_separate_from_durable_completion` | `PR-Q-04` |
| `FAIL-PLATFORM-UNAVAILABLE` | `TRANS-MILESTONE-PLAN-EXECUTE` | `no_fallback_and_effect_zero` | `PR-A-07` |
| `FAIL-DECISION-STALE` | `TRANS-DECISION-PENDING-ACCEPTED` | `invalid_submit_causes_no_decision_transition_project_change_task_effect_or_authority_generation` | `PR-Q-06`<br>`PR-H-02` |
| `FAIL-DECISION-ATOMIC-APPLICATION` | `TRANS-CONTINUATION-ISSUED-PREPARED`<br>`TRANS-DECISION-PENDING-ACCEPTED`<br>`TRANS-MILESTONE-DECISION-ACCEPTED-EXECUTE`<br>`TRANS-CONTINUATION-PREPARED-FINALIZED`<br>`TRANS-CONTINUATION-PROJECT-UNKNOWN-RECOVERY`<br>`TRANS-DECISION-RECOVERY-ABSENT-REQUIRED`<br>`TRANS-QUEUE-DECISION-ACCEPTED-REPLAN` | `protected issued_to_prepared CAS and readback precede project_write_flush_readback; matching application_id_and_generations precede prepared_to_finalized CAS and readback; project_only_unknown may update protected recovery after independent intent while protected_unknown records only independent recovery intent; decision_and_milestone all_old_or_all_new; queue fresh_observes_finalized and task_effect_at_most_once` | `PR-Q-06`<br>`PR-H-02` |
| `FAIL-DECISION-CONTINUATION` | `TRANS-CONTINUATION-ABSENT-ISSUED`<br>`TRANS-CONTINUATION-ISSUED-PREPARED`<br>`TRANS-CONTINUATION-PREPARED-FINALIZED`<br>`TRANS-CONTINUATION-PROJECT-UNKNOWN-RECOVERY`<br>`TRANS-CONTINUATION-ISSUED-INVALIDATED`<br>`TRANS-CONTINUATION-PREPARED-UNAPPLIED-INVALIDATED`<br>`TRANS-CONTINUATION-RECOVERY-FINALIZED`<br>`TRANS-CONTINUATION-RECOVERY-INVALIDATED`<br>`TRANS-CONTINUATION-PROTECTED-RECOVERY-ISSUED-INVALIDATED`<br>`TRANS-CONTINUATION-PROTECTED-RECOVERY-PREPARED-REQUIRED`<br>`TRANS-CONTINUATION-ISSUED-EXPIRED`<br>`TRANS-DECISION-RECOVERY-ABSENT-REQUIRED`<br>`TRANS-DECISION-RECOVERY-REQUIRED-SETTLED` | `protected_create_failure returns no raw capability; duplicate pending decision or replacement request reuses one issued record; response_loss does not auto_replace; invalid_submit_preserves_legitimate_capability; initial create unknown settles exact absent without effect or invalidates fresh issued; expiry unknown settles fresh expired or invalidates fresh issued; fresh prepared enters exact protected recovery; project_only_unknown persists independent intent then protected recovery; protected_unknown never claims unobserved transition and persists exact independent intent; recovery joins fresh roots then settles continuation before intent; unavailable intent store returns manual_recovery effect_unknown process_reuse_forbidden; no duplicate authority effect or raw capability persistence` | `PR-Q-06`<br>`PR-H-02` |

## 12. 実装・検証への接続

実装接続と検証接続は機械可読な設計対応で管理する。この表は現在の対応集合を人間が確認するための投影であり、Pathや試験の存在だけをCapability成立の根拠にしない。

### 実装接続

| ID | Interface | 状態 | 段階 | Path |
|---|---|---|---|---|
| `IMPL-PROJECT-STATE-CANDIDATE` | `IF-PROJECT-CORE`<br>`IF-SCHEDULER`<br>`IF-INTEGRATION` | `partial` | `responsibility_separation` | `40_Develop/coordinator/src/state/model.ts`<br>`40_Develop/coordinator/src/state/projection.ts`<br>`40_Develop/coordinator/src/task/scheduling.ts`<br>`40_Develop/coordinator/src/task/lifecycle.ts`<br>`40_Develop/coordinator/src/task/recovery-transitions.ts`<br>`40_Develop/coordinator/src/objective/replan-transitions.ts`<br>`40_Develop/coordinator/src/decision/transitions.ts`<br>`40_Develop/coordinator/tests/unit/state/transitions.contract.test.ts` |
| `IMPL-PUBLIC-OBJECTIVE-INTAKE-CANDIDATE` | `IF-PROJECT-CORE`<br>`IF-QUEUE`<br>`IF-TRANSPORT` | `partial` | `public_objective_intake` | `40_Develop/coordinator/src/objective/request.ts`<br>`40_Develop/coordinator/src/objective/plan.ts`<br>`40_Develop/coordinator/src/objective/execute.ts`<br>`40_Develop/coordinator/tests/unit/public-contract.contract.test.ts`<br>`40_Develop/coordinator/tests/unit/objective/plan.contract.test.ts`<br>`40_Develop/coordinator/bin/coordinator.ts`<br>`40_Develop/coordinator/src/objective/intake-dependencies.ts`<br>`40_Develop/coordinator/src/objective/public-operation.ts`<br>`40_Develop/coordinator/src/decision/public-operation.ts`<br>`40_Develop/coordinator/src/decision/public-acceptance.ts`<br>`40_Develop/coordinator/src/state/public-query.ts`<br>`40_Develop/coordinator/src/task/execution-diagnostics.ts`<br>`40_Develop/coordinator/src/operation-result-contract.ts`<br>`40_Develop/coordinator/src/execution/task.ts`<br>`40_Develop/coordinator/scripts/task-real-provider-contract.ts`<br>`40_Develop/coordinator/scripts/verify-task-real-providers.ts`<br>`40_Develop/coordinator/tests/integration/task-objective-intake.contract.test.ts`<br>`40_Develop/coordinator/tests/system/task-real-provider-verification-script.contract.test.ts` |
| `IMPL-MCP-ADAPTER-CANDIDATE` | `IF-TRANSPORT`<br>`IF-PROJECT-CORE`<br>`IF-DECISION` | `partial` | `responsibility_separation` | `40_Develop/coordinator/src/objective/request.ts`<br>`40_Develop/coordinator/src/decision/request.ts`<br>`40_Develop/coordinator/src/operation-result-contract.ts`<br>`40_Develop/coordinator/tests/unit/public-contract.contract.test.ts`<br>`40_Develop/mcp-server/src/index.ts`<br>`40_Develop/mcp-server/src/tools/task.ts`<br>`40_Develop/mcp-server/src/transport/stdio.ts`<br>`40_Develop/mcp-server/tests/unit/task-adapter.contract.test.ts`<br>`40_Develop/mcp-server/tests/system/stdio-transport.integration.test.ts` |
| `IMPL-RESPONSIBILITY-SEPARATION-CANDIDATE` | `IF-SINGLE-TASK`<br>`IF-PLATFORM`<br>`IF-INTEGRATION`<br>`IF-DECISION` | `partial` | `responsibility_separation` | `40_Develop/coordinator/src/decision/records.ts`<br>`40_Develop/coordinator/src/task/executor.ts`<br>`40_Develop/coordinator/src/task/observer.ts`<br>`40_Develop/coordinator/src/platform/contract.ts`<br>`40_Develop/coordinator/tests/unit/task/intelligence-adapter.contract.test.ts`<br>`40_Develop/coordinator/tests/unit/platform/contract.contract.test.ts`<br>`40_Develop/coordinator/tests/unit/public-contract.contract.test.ts`<br>`40_Develop/coordinator/src/workspace/operations.ts`<br>`40_Develop/coordinator/src/storage/protected-decision.ts`<br>`40_Develop/coordinator/src/platform/windows-adapter.ts`<br>`40_Develop/coordinator/src/task/execute-attempt.ts`<br>`40_Develop/coordinator/src/task/intelligence-adapter.ts`<br>`40_Develop/coordinator/tests/unit/task-windows-platform-adapter.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/repository-workspace-runtime.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/task-windows-decision-store.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/task-single-task-adapter.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/task-platform-independence.contract.test.ts` |
| `IMPL-DURABLE-FOUNDATION-CANDIDATE` | `IF-STATE-STORE`<br>`IF-QUEUE` | `partial` | `durable_foundation` | `40_Develop/coordinator/src/queue/types.ts`<br>`40_Develop/coordinator/src/lease/controller.ts`<br>`40_Develop/coordinator/src/operation-result.ts`<br>`40_Develop/coordinator/src/state/persistence.ts`<br>`40_Develop/coordinator/src/storage/current-state.ts`<br>`40_Develop/coordinator/tests/integration/task-durable-foundation.contract.test.ts` |
| `IMPL-PROJECT-EXECUTION-CANDIDATE` | `IF-PROJECT-CORE`<br>`IF-SCHEDULER`<br>`IF-INTEGRATION`<br>`IF-TRANSPORT` | `partial` | `responsibility_separation` | `40_Develop/coordinator/src/task/dispatch.ts`<br>`40_Develop/coordinator/src/identity/clock-and-hash.ts`<br>`40_Develop/coordinator/src/process/safety-contract.ts`<br>`40_Develop/coordinator/src/execution/process-safety-state.ts`<br>`40_Develop/coordinator/src/task/host-adapter.ts`<br>`40_Develop/coordinator/tests/unit/task-execution-host-adapter.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/task-execution.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/runtime-process-safety-state.contract.test.ts` |
| `IMPL-REPLANNING-CANDIDATE` | `IF-PROJECT-CORE`<br>`IF-SCHEDULER` | `partial` | `responsibility_separation` | `40_Develop/coordinator/src/objective/replan.ts`<br>`40_Develop/coordinator/src/state/persistence.ts`<br>`40_Develop/coordinator/src/storage/current-state.ts`<br>`40_Develop/coordinator/tests/integration/task-replanning-and-decision.contract.test.ts` |
| `IMPL-HUMAN-DECISION-CANDIDATE` | `IF-DECISION` | `partial` | `responsibility_separation` | `40_Develop/coordinator/src/decision/lifecycle.ts`<br>`40_Develop/coordinator/src/decision/request.ts`<br>`40_Develop/coordinator/src/decision/capability.ts`<br>`40_Develop/coordinator/src/decision/records.ts`<br>`40_Develop/coordinator/tests/unit/public-contract.contract.test.ts`<br>`40_Develop/coordinator/src/decision/capability-adapter.ts`<br>`40_Develop/coordinator/src/storage/protected-decision.ts`<br>`40_Develop/coordinator/src/storage/current-state.ts`<br>`40_Develop/coordinator/tests/unit/task-decision-capability-adapter.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/task-replanning-and-decision.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/task-windows-decision-store.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/task-decision-recovery-store.contract.test.ts` |
| `IMPL-INTEGRATION-CANDIDATE` | `IF-INTEGRATION`<br>`IF-PROJECT-CORE` | `partial` | `responsibility_separation` | `40_Develop/coordinator/src/storage/result-record.ts`<br>`40_Develop/coordinator/tests/unit/public-contract.contract.test.ts`<br>`40_Develop/coordinator/src/storage/current-state.ts`<br>`40_Develop/coordinator/src/workspace/operations.ts`<br>`40_Develop/coordinator/src/objective/public-operation.ts`<br>`40_Develop/coordinator/src/decision/public-operation.ts`<br>`40_Develop/coordinator/src/decision/public-acceptance.ts`<br>`40_Develop/coordinator/src/state/public-query.ts`<br>`40_Develop/coordinator/src/task/execution-diagnostics.ts`<br>`40_Develop/coordinator/src/operation-result-contract.ts`<br>`40_Develop/coordinator/tests/integration/task-integration-record-adapter.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/repository-workspace-runtime.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/public-operation.integration.test.ts`<br>`40_Develop/coordinator/tests/integration/task-full-flow.integration.test.ts` |

### 検証接続

| ID | 種別 | 状態 | 試験Path |
|---|---|---|---|
| `PR-D-N-01` | `normal` | `partial` | `40_Develop/coordinator/tests/integration/task-durable-foundation.contract.test.ts` |
| `PR-D-Q-01` | `quasi_normal` | `partial` | `40_Develop/coordinator/tests/integration/task-durable-foundation.contract.test.ts` |
| `PR-D-A-01` | `abnormal` | `partial` | `40_Develop/coordinator/tests/integration/task-durable-foundation.contract.test.ts` |
| `PR-N-01` | `normal` | `partial` | `40_Develop/mcp-server/tests/unit/task-adapter.contract.test.ts`<br>`40_Develop/mcp-server/tests/system/stdio-transport.integration.test.ts`<br>`40_Develop/coordinator/tests/integration/task-execution.contract.test.ts` |
| `PR-N-02` | `normal` | `partial` | `40_Develop/coordinator/tests/unit/state/transitions.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/task-execution.contract.test.ts` |
| `PR-N-03` | `normal` | `partial` | `40_Develop/coordinator/tests/unit/state/transitions.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/task-execution.contract.test.ts` |
| `PR-Q-01` | `quasi_normal` | `partial` | `40_Develop/coordinator/tests/unit/state/transitions.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/task-execution.contract.test.ts` |
| `PR-Q-02` | `quasi_normal` | `partial` | `40_Develop/coordinator/tests/integration/task-replanning-and-decision.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/task-full-flow.integration.test.ts` |
| `PR-Q-03` | `quasi_normal` | `partial` | `40_Develop/mcp-server/tests/unit/task-adapter.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/task-durable-foundation.contract.test.ts` |
| `PR-Q-04` | `quasi_normal` | `partial` | `40_Develop/mcp-server/tests/system/stdio-transport.integration.test.ts`<br>`40_Develop/coordinator/tests/integration/task-execution.contract.test.ts`<br>`40_Develop/coordinator/tests/system/task-real-provider-verification-script.contract.test.ts` |
| `PR-Q-05` | `quasi_normal` | `partial` | `40_Develop/coordinator/tests/integration/task-queue-priority.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/task-objective-intake.contract.test.ts` |
| `PR-Q-06` | `quasi_normal` | `partial` | `40_Develop/coordinator/tests/integration/task-replanning-and-decision.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/task-windows-decision-store.contract.test.ts`<br>`40_Develop/mcp-server/tests/unit/task-adapter.contract.test.ts` |
| `PR-H-01` | `human_decision` | `partial` | `40_Develop/coordinator/tests/unit/state/transitions.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/task-replanning-and-decision.contract.test.ts` |
| `PR-H-02` | `human_decision` | `partial` | `40_Develop/coordinator/tests/integration/task-replanning-and-decision.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/task-windows-decision-store.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/task-decision-recovery-store.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/task-full-flow.integration.test.ts` |
| `PR-A-01` | `abnormal` | `partial` | `40_Develop/coordinator/tests/unit/state/transitions.contract.test.ts` |
| `PR-A-02` | `abnormal` | `partial` | `40_Develop/coordinator/tests/unit/state/transitions.contract.test.ts` |
| `PR-A-03` | `abnormal` | `partial` | `40_Develop/coordinator/tests/unit/state/transitions.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/task-execution.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/runtime-process-safety-state.contract.test.ts` |
| `PR-A-04` | `abnormal` | `partial` | `40_Develop/coordinator/tests/integration/task-durable-foundation.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/task-execution.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/task-objective-intake.contract.test.ts`<br>`40_Develop/coordinator/tests/system/task-real-provider-verification-script.contract.test.ts`<br>`40_Develop/domain-model/tests/integration/committed-json.integration.test.ts`<br>`40_Develop/coordinator/tests/integration/docker-recovery-settlement.contract.test.ts`<br>`40_Develop/coordinator/tests/unit/state/transitions.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/coordinator-state-runtime.contract.test.ts`<br>`40_Develop/docker-isolation/tests/integration/resource-recovery.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/docker-recovery-runtime.contract.test.ts` |
| `PR-A-05` | `abnormal` | `partial` | `40_Develop/coordinator/tests/unit/state/transitions.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/task-execution.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/task-objective-intake.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/docker-recovery-runtime.contract.test.ts` |
| `PR-A-06` | `abnormal` | `partial` | `40_Develop/coordinator/tests/integration/task-durable-foundation.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/repository-workspace-runtime.contract.test.ts`<br>`40_Develop/mcp-server/tests/unit/task-adapter.contract.test.ts` |
| `PR-A-07` | `abnormal` | `partial` | `40_Develop/coordinator/tests/unit/platform/contract.contract.test.ts`<br>`40_Develop/coordinator/tests/unit/task-windows-platform-adapter.contract.test.ts` |
| `PR-I-01` | `integration` | `partial` | `40_Develop/coordinator/tests/unit/state/transitions.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/task-integration-record-adapter.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/repository-workspace-runtime.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/task-full-flow.integration.test.ts` |
| `PR-I-02` | `integration` | `partial` | `40_Develop/coordinator/tests/unit/state/transitions.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/repository-workspace-runtime.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/public-operation.integration.test.ts`<br>`40_Develop/coordinator/tests/integration/task-full-flow.integration.test.ts`<br>`40_Develop/mcp-server/tests/unit/task-adapter.contract.test.ts` |

## 13. 完了条件

- 上位アーキテクチャ、本書、機械対応、実装および試験のIDが相互に解決できる。
- Interface、Record、資源、Lock、Authority、Effect、状態遷移、不変条件および失敗注入点に孤立がない。
- 実装済み、部分接続、未実装を区別し、部分成立を上位Capability完成へ読み替えない。

## 14. 機械生成する意味要素

次の表はSemantic IR Pilotの入力である。表から抽出できない意味を生成器やAIが補完しない。Semantic Keyと種別はPilot用であり、[Semantic Coverage基盤](../semantic-coverage/02_Semantic_IR_and_Relation_Design.md)の評価後に固定する。

| Semantic Key | 種別 | 要求する意味 | Architecture定義 | 検証要否 | 根拠節 | N/A理由 |
|---|---|---|---|---|---|---|
| `orchestrator.objective-task-lifecycle` | `lifecycle` | ObjectiveをTaskへ分解し、依存、実行、統合、受入、取消、判断待ちおよび回復をProject-levelの状態として管理する。 | `ARCH-000004` | `Required` | `## 8. 状態機械と遷移` | — |
| `orchestrator.project-state-projection` | `projection` | Task、Queue、Decision、Recovery、ObjectiveおよびMilestoneの状態を、根拠と観測不能を保持したProject Stateへ投影する。 | `ARCH-000005` | `Required` | `## 10. 不変条件` | — |
| `orchestrator.acceptance-decision-authority` | `authority` | Objective／Milestoneの受入、差戻し、判断待ちをProject運営者の明示判断として記録し、下位完了やProjectionから受入Authorityを生成しない。 | `ARCH-000005` | `Required` | `## 6. Authority` | — |
| `orchestrator.task-authority-narrowing` | `authority` | Project／Milestone／Objective／Task／Attempt／Repository RevisionからTask Authorityを狭め、Coordinatorへ渡した後に拡大させない。 | `ARCH-000004` | `Required` | `## 6. Authority` | — |
| `orchestrator.durable-before-effect` | `persistence` | Task Effectまたは判断適用の前に、Intent、Authority結合、Operation Identityおよび必要なRecovery情報を耐久化する。 | `ARCH-000004` | `Required` | `## 3. 永続Record` | — |
| `orchestrator.queue-lease-lifecycle` | `resource` | Queue、Project Operation Lease、Scheduler Slotおよび競合予約のOwnerと終了条件を固定し、cleanup不明の資源を再利用しない。 | `ARCH-000004` | `Required` | `## 4. 資源と終了条件` | — |
| `orchestrator.recovery-obligation` | `recovery` | Effectまたはcleanupが不明なTask／Decisionをexact Recovery Identityへ結び、同じ義務の解消または人間移送まで保持する。 | `ARCH-000004` | `Required` | `## 11. 失敗注入` | — |
| `orchestrator.transport-neutral-application-contract` | `boundary` | CLI、MCPその他のTransportがProject Authorityや成功意味を新設せず、Core所有の公開Application Contractを同じ意味で提供する。 | `ARCH-000012` | `Required` | `## 2. Interface` | — |
| `orchestrator.execution-intelligence-read-model` | `projection` | Execution Intelligenceを読取り専用Portとして利用し、実行事実と評価候補をProjectのAuthorityや受入判断へ変換しない。 | `ARCH-000007` | `Required` | `## 2. Interface` | — |
| `orchestrator.candidate-adoption` | `authority` | Workspaceの現在状態とVersion Controlの固定Ref／Commitから同一候補を再観測し、明示採用Authority、Workspace／Candidate Identity、取込先HEAD、現在Revision／dirty Scopeを確認して二親Mergeと既存結果Writerへ接続する。処置前の拒否だけ正本Effect 0とし、発行後失敗は元Effect・HEAD／Indexの観測・結果・回復参照を保持する。settlement不明時は同じRecovery義務を保持し、候補固定と採用を同じ成功へ畳まず、Pushを伴わない。 | `ARCH-000004` | `Required` | `### 2.1. 既存候補の採用境界` | — |
- 正常・準正常・異常および実境界の検証が、対象CapabilityのLifecycleを閉じる。
- 現行設計の変更時は本書を更新し、旧版の別文書を現行Treeへ追加しない。

## Checklist

- [x] Task／ObjectiveのRecord・資源・遷移・回復不変条件を本書と機械対応へ接続した。保存統合BのSource接続・旧試験移行・外部AIなしの最終固定回帰は完了し、限定独立再確認済み。旧版の保存方式刷新②の結果を、B又は責務再編全体の完成へ流用しない。
- [x] 旧連続世代の保証と新版Snapshotの目標を区別し、旧不変条件の意味を変更していない。
- [x] 物理統合と仕事全体の一括確定を区別し、別Port間の中断、Leaseと保護Decisionの境界を維持した。
- [x] 保存、採用後処理、終了、履歴と移行の反証対象を明示した。
- [x] 新版Schema、Root結合、保存確定・再入場、退役後の旧受付拒否と公開初期化を実装・局所試験へ接続した。
- [x] 受付・終了整理・本番接続の追加反例とArchitecture／QualityのSource／Contract独立確認を完了し、旧実記録の清掃・新形式初期化を確認した。
- 保存方式刷新②は、本番切替・全Portable結果処置・試験前提是正後35件・Architecture／Quality最終独立レビューを完了した。全製品E2Eや品質項目全体の未完了は②と分離する。[完了根拠](../../../99_Roadmap/Changes/CHG-000082/Evidence/261005_project-runtime-phase2.md#36-②の完了判定)。
