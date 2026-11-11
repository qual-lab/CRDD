# プロセス間排他の棚卸しと共通Lock契約候補

状態: Phase 1・2の調査／設計履歴とNode OS排他の移管記録。現在の実装・検証状態は§7。
基準: `codex/feature/v0.22`、`8640aff42`。
担当責任者: Qual-Lab
確認日: 2026-11-06

## 1. 目的・許可・成立条件

人間が採用した方針は、PAを責務ごとに解体し、共通技術Package `lock`を設けること。ただし、統一するのは排他の契約であり、異なる保護対象へ同一Primitiveを強制することではない。`fs.open("wx")`は候補であって、既存の回復・再入場・終了保証を置換済みとする根拠ではない。

今回の変更は、共有実行境界の設計調査と移行計画の具体化である。製品Source、保存Schema、Lock方式、PA依存、配布物は変更しない。実AI・Docker・過去保持物も操作しない。技術・品質の着手前照合と独立レビュー、文書の直接参照・影響確認を行い、標準規範・Release・準拠表明は変更しないため全体準拠／Release監査は追加しない。

この文書は変更計画と設計候補を所有する。現行の正本は[Domain保存設計](../../../06_Architecture/Details/domain-model/05_Runtime_Domain.md)、[Coordinator設計](../../../06_Architecture/Details/coordinator/01_Architecture.md)、[PA設計](../../../06_Architecture/Details/platform-access/01_Architecture.md)であり、以下の候補を現在の公開契約として扱わない。新PackageのArchitecture ID、公開Symbol、Source分割は未確定である。

保持する意図は、同じ資源の競合防止、別資源の独立利用、旧Ownerによる新OwnerのLock削除・遅延書込みの防止、部分Effect・終了不明・同じ回復参照の保持である。業務の実行可否・保存内容・Task再実行をLockへ移管しない。新しいManager／Registry／Storeは作らない。

## 2. 現行の母集団とOwner

製品SourceのLock取得・解放・回復の呼出し、公開入口、補助子入口を確認した。単なる`wx`の使用数をLock数にしない。試験・Scriptの接続は移行対象の検証義務として区別する。

| 保護対象 | 現在の入口・利用者 | Identity／物理機構・寿命 | 今回の処置／移行条件 |
|---|---|---|---|
| Domainの汎用Filesystem Store | [root-and-lock.ts](../../../40_Develop/domain-model/src/storage/root-and-lock.ts)、[ai-selection.ts](../../../40_Develop/domain-model/src/storage/ai-selection.ts) | 検証済みRoot＋canonicalなLock相対Path。Windows Pipe／Linux abstract socketの専用Workerと`wx` Record、Recovery Obligation。同期操作・解放・回復を接続 | 取得・初期化失敗・通常解放・自己清掃再入場・他Process回復を分けて対応。現行方式を維持 |
| Access Managementの状態保存 | [storage/lock.ts](../../../40_Develop/access-management/src/storage/lock.ts) | 上記Domain APIを使用。Owner不存在等の既存Proofによる回復後、取得を一回だけ再試行 | 独立Primitiveではない。出版結果、解放不明、同じRecovery IDと現在の再試行方針を利用側へ対応。汎用Lockへ暗黙自動回復を入れない |
| Topic／Meetingの記録更新 | Domain [topic-meeting-store.ts](../../../40_Develop/domain-model/src/storage/topic-meeting-store.ts)の`withRecordLock` | 記録種別のRoot＋IDごとの`.ID.lock`をwx取得。同期の作成／改訂比較／公開・読戻し／削除を保持しclose→unlink | 前回棚卸しの漏れを今回追加。世代Record・自動回復はない。記録の業務検査は移さず、技術的な取得・終了だけが移管候補 |
| Coordinatorの現在状態保存 | Domainの[runtime-lock.ts](../../../40_Develop/domain-model/src/storage/runtime-lock.ts)、[runtime-kernel-lock.ts](../../../40_Develop/domain-model/src/storage/runtime-kernel-lock.ts)、[runtime-store.ts](../../../40_Develop/domain-model/src/storage/runtime-store.ts) | Repository Root Hashから`CurrentState` Pipe。短期同期保存Owner、Root再照合・`assertLive()`・Revision比較・固定／pending記録 | Lockの技術契約とSnapshot保存契約を分離。比較から最終公開までの保持を置換できるまで移行しない |
| Coordinatorの長期Lease | [execution/lease.ts](../../../40_Develop/coordinator/src/execution/lease.ts)、Domain `reserveCoordinatorLeaseAcquisition`等 | 排他Directoryの実IdentityとQueue／Lease／Owner世代、保存された取得意図・確認・解放意図・結果。短期保存Lockの前後で物理操作を行う | 単なる長寿命File／Pipeではない。Directoryと予約・確認・Task進行・未完了Effectは今回は上位に残す。全体を技術Lockへ移さない |
| Provider Home | Coordinator [kernel-lock.ts](../../../40_Develop/coordinator/src/execution/kernel-lock.ts)の論理Home取得とExecutor [attempt.ts](../../../40_Develop/executor/src/lifecycle/attempt.ts)の`acquireHomeLease` | 両者は同じ`crdd-logical-provider-home-kernel-lock-v1`＋論理Home Binding Hashを使用。Repository横断の同じPipe。利用中から用途別の終了・解放まで | Attempt ID／Repository Rootを追加して分裂させない。Pipe維持なら新しい共有Directoryは不要。File化する場合だけ共有Rootを別途確定する。保持終了条件は§6で用途別に区別 |
| Docker Runtime State | CoordinatorのKernel Lock・Recovery | Runtime State Binding Hashから`DockerRuntimeState` Pipe。状態／回復処置の区間 | Homeと別Identity。回収中の保持範囲と他処置との取得順を維持。Docker実行は今回行わない |
| Host Operation世代 | Coordinator [operation.ts](../../../40_Develop/coordinator/src/execution/operation.ts)・Recovery | Root名＋nonce由来の世代。同期Pipeと非同期Supervisorによる保持・喪失・解放／子終了確認 | File存在確認だけへ縮約しない。Owner死亡と子Process／技術資源の終端を分ける |
| Execution Intelligence履歴 | [storage/lock.ts](../../../40_Develop/execution-intelligence/src/storage/lock.ts)、[store.ts](../../../40_Develop/execution-intelligence/src/storage/store.ts) | 検証済みStoreの`history.lock`を`wx`作成。取得UUIDを記録し、同一更新のfinallyで解放。現在は200回×10msの取得待機、Stale自動奪取なし | File型移管の候補。ただし解放時の内容確認→unlink、初期化失敗時の同Path清掃、待機回数とCleanup不明の搬送を先に評価。既存wxを完成した共通実装とは扱わない |
| Docker Desktop修復のNative Mutex | PA [repair.rs](../../../40_Develop/platform-access/src/native/docker_desktop/windows/repair.rs) | `Global\CRDD.Coordinator.DockerDesktopRepair.<userHash>`。同じ利用者のRepair／Restart補助子が処置中保持 | CoordinatorのDocker状態Pipeとは別境界。今回の調査へ含めるが、File Lockで置換済みとはしない。DI固有のNative責務整理と接続して別評価 |

補助子はPAの`lock/worker.ts`／`supervisor.ts`と、Domainの`storage/kernel-lock-worker.ts`に存在する。これらはRustではない。Domainの汎用StoreはWindows／Linuxを分岐し、それ以外を観測不能へ閉じる一方、PAの対象PipeはWindows固定である。現在のSource分岐からmacOS対応を推定しない。

### 2.1. 新Packageへ無条件に移さないもの

- `history.pending.jsonl`、一時Snapshot、Recovery Record、保存用anchorを`wx`作成する処理は、排他ではなく保存・出版の技術処理である。各保存Ownerへ維持する。
- Git自身のIndex／Ref LockはVC／Gitの技術契約であり、共通Lockへ置換しない。
- Coordinatorの`acquireRuntimeOwnedProjectStateKernelLock`と対話Console用入口は、現行製品srcに外部呼出しが見つからない。試験・Script・公開面を確定して削除候補とする。新Packageの新規Capabilityとして復活させない。
- PAの非同期Kernel LockはExecutorのHome検証Scriptからも利用される。本番と検証入口を一括して「未使用」と判定しない。
- Domain `storage/temporary-operation.ts`のLifecycle Lockも残置する。stagingからhard linkで公開し、Owner PID／状態、最大3回の取得と終了時更新・削除を持つ固有のFile型プロトコルである。共通Recoveryや汎用StoreのProofと同等とは扱わない。PID観測はEPERM以外の例外をfalseにする現行実装であり、「ESRCHだけ死亡・その他は不明」という保証は確認できていない。File型の後段評価へ記録し、今回の製品変更へ自動拡張しない。
- 認証・Namespace・Windows実体観測・子Process終了・Native署名検証はLockの責務にしない。PA廃止の別Owner移管として継続する。

### 2.2. 物理配置で守る相関

| Scope | 同一Identityを共有すべき範囲 | 未決条件 |
|---|---|---|
| Repository／Store | 同じ実Storeを使う全Writer。Main／LinkedやPath Aliasから別Lockを作らない | Canonical Rootと実体の定義、Rootの差替え・移行時の扱い |
| Provider Home | 異なるRepositoryからも同じ論理Homeを使うCoordinator／Executor／検証入口 | Pipe維持では現行endpointが共通Scope。File化する場合だけ既存ユーザー／Host管理Rootが必要であり、今回新設しない |
| Host／ユーザー資源 | 同じRuntime Stateまたは同じユーザーのHost処置。Operation IDだけでは共有資源を区別できない | Docker状態PipeとNative Mutexを一つにしてよいかは未確定 |

## 3. 最小共通契約の候補

まず確定させるのは意味であり、以下の関数名・結果型・公開数は未実装の候補である。

| 操作候補 | 保証する範囲 | 保証しない範囲 |
|---|---|---|
| `acquireLock({ root, key })` | Rootとkeyの検証、安定した技術Identity、排他取得・必要な初期化完了後だけHandleを返す。競合・拒否・観測不能・取得後清掃不明を区別 | Task認可、保存済み、Owner不在、未完了Effectなし |
| `handle.assertLive()` | 自分の取得世代と技術的保持をその時点で確認。不明は処置継続を許可しない | 確認後の任意の書込みを原子的に保護したこと、他者の業務Ownerでないこと |
| `handle.release()` | 同じ取得世代だけを終端化。他世代を消さない。初回終了と解放不明を保持 | 解放直後のPathが永久に不存在であること。他Ownerの正当な再取得を禁止したこと |
| `inspectLock({ root, key })` | 読取り時点の不存在・存在・Record破損・観測不能、取得できた世代情報。変更はしない | 削除許可、実行Authority、PIDだけによる正確なOS Process世代確認 |

初期の公開入口候補は取得と観測の二つ、解放はHandle自身へ置く。`withLock()`は実Consumerの同期／非同期・一次失敗と解放失敗の扱いが確定した場合だけ追加し、API数を増やすために用意しない。`recoverLock()`は成立まで公開しない。

Lock Fileが存在するだけなら「競合」を返せるが、Ownerが稼働しているとは断定しない。`busy`を稼働中の意味で使う場合は、その成立根拠を別に要求する。PID照会のESRCHと権限不足等は区別し、取得UUIDはOS Processの生存証明や単調増加するFencing Tokenへ昇格させない。

Recordは技術的な取得世代・keyへの結合と、回復に必要と確認できた情報に限定する。Task／Queue／保存Revision・業務Recoveryの状態を混ぜない。時刻からの自動Stale判定、すべてのLockへの新しいRecovery Registry／業務Recordは追加しない。初期化前Crashで世代情報が欠ける場合は、不明を保持し、再構築して削除可能へ補完しない。

Handleは実取得時の内部資源・世代を操作する短命な値とする。JSONや同形Objectから再構成しない。ただし、単なる参照原本証明だけを目的とする多重のWeakMap／Capability管理は新設しない。Root／keyの業務選定と保存の現在性は各Ownerが所有し、問い合わせCallbackとしてLockへ逆流させない。

同期Storageがあるため、全Consumerの非同期化や、非同期releaseを同期成功に見せる置換は行わない。File型とProcess寿命型で結果確定の方法が違う場合は、その違いを隠す前に最小契約の可否を評価する。差替え用Port／Adapter Frameworkを先行実装しない。

## 4. 旧Ownerの更新拒否とRecovery

### 4.1. 現行保存の根拠と未確認範囲

Domainの現在状態保存には`isLiveCoordinatorStorageOwner`／`assertLive()`、Repository再照合、`expectedRevision`と次Revision、Snapshot遷移の検査がある。Coordinator LeaseにもQueue世代・Owner世代を用いた取得予約・確認・解放・回復の記録がある。しかし、これらの名前・fieldがあるだけで、OS Guardを除いた後も原子的な更新拒否が成立するとは判断しない。比較から最終rename／公開まで同じ有効な排他区間であるかをConsumer別に固定する必要がある。

Domainの汎用Storeには、死亡Processの回復だけでなく、同一Process内で登録した清掃不明Scopeの再入場を「Owner Absence Proof」の経路へ接続する処理がある。名前だけを根拠にすべてを死亡Ownerの自動回復へ変換しない。通常解放のやり直しと、他Ownerの資源回復を分けて設計する。

EIの履歴出版はLockをfinallyまで保持するが、初期化失敗の清掃・通常解放のPath照合と削除は別の評価点である。現行の未完了pending保全・出版済み事実・Cleanup不明を汎用Lockの成功Booleanへ畳まない。

### 4.2. 回復案の比較

| 案 | 成立に必要な条件 | 解けること／残ること | 評価 |
|---|---|---|---|
| 共通契約の下で必要な既存OS Guardを維持 | Scope・世代・保持・解放の同値性と、新旧Consumerが同じ排他に参加すること | 共通APIへの段階移管候補。wx一律化・Worker／Pipe全廃は達成しない | 最新の「異なる対象へ一貫契約」という原則に合う第一候補。ただし移管実装はまだ行わない |
| wx主体＋停止下の明示Recovery | 旧Owner・子Process・待機中I/O・保存Effectが完了／停止し、同Scopeへの新規開始も止まっていることを確定できる既存入口 | オンラインの回復者選出を避けられる。人間の宣言やPID不存在だけでは停止条件を強制できない。初期化中Crashも扱う必要あり | 代替候補。既存の停止・起動管理で保証できるか未確認 |
| wx主体＋オンラインRecovery用Guard | 照合・回収・再取得・公開の競合を排除し、Guard自身のCrashも安全に処理すること | オンライン回復が可能になり得るが、別のFileをwxで作るだけではそのStale問題が再帰する | 必要性が示されるまで新設しない |
| wx＋PID／世代の再確認だけ | checkからunlink／公開まで新世代が介入しないこと | 下記反例を防げない | 移行案として不採用 |

実際に旧Processが死亡していても、子Processや発行済みI/O・外部Effectが終端しているとは限らない。停止下回復でも、この確認を省略しない。逆に全Effectの終端と開始抑止が成立する対象へ、将来の一般性だけを理由に新しいFencing Storeを追加しない。

### 4.3. 小規模な反例実測

2026-11-06、今回だけの`.crdd/tests/lock-design-4d1fc8134f67ee9fe35e0d96230d9588`に合成Recordを作り、五つの独立Node子ProcessをIPCの明示Barrierで進めた。待ち時間や確率に依存するRace探索ではない。終了後は全子をjoinし、自作既知Fileだけを非再帰回収してRoot不存在を確認した。実製品Lock、業務Record、実AI、Docker、過去保持物は使用しない。

| 反例 | 固定した順序 | 観測 |
|---|---|---|
| 遅れた回復者による新世代削除 | OwnerがAをwx作成後に実終了 → 回復者CがAを読んで待機 → 別の回復者がAを除去しBをwx取得・保持 → Cが照合済みPathをunlink | BのProcessが待機中でもBのFileが消失した |
| 先行Revision比較だけの旧Writer | 旧WriterがRevision 0を読んで待機 → 新WriterがRevision 1を公開・終了 → 旧Writerが事前確認に基づくRevision 1をrename公開 | 新Writerの内容が旧Writerの内容へ上書きされた |

これはGuardを取り去った単純モデルへの反証であり、現行製品の不具合再現・現行Recoveryの試験成功ではない。今回のWindows作業領域でのみ実測した。Filesystem種別、Linux／macOS、NFS／SMB、実製品の全経路は未評価である。

## 5. Consumer別の移行Gateと検証義務

| 対象 | 移行前に固定する正常・境界・異常 | 必要な検証／現在状態 |
|---|---|---|
| Store／履歴の短期更新 | 同一実体への競合、別Storeの独立、File生成・部分書込み・sync・close失敗、同一世代解放、初期化清掃の差替え | 実Processの取得・解放・Crashと故障反証。既存試験は基準版Evidenceであり、新契約のPassへ継承しない |
| 現在状態・長期Lease | 保存Owner取得→Revision比較→最終公開→解放、予約後Crash、Owner世代差、再入場、旧Writer再開 | 旧Ownerを途中で止め、新Ownerの取得／出版と旧処理再開をBarrierで交差させる。現在は未検証 |
| Home／Host資源 | 別Repositoryの同Home競合、別Home独立、Process死亡・子残存、実行中／Cleanup中の保持、初回解放結果 | 合成Processと既存非AI試験を先行し、必要な実境界は別途許可・実施。今回AI／Dockerを起動しない |
| 回復 | 生存・死亡・不明、同一Process清掃、Record欠測／破損、二回復者、解放中／回復中Crash、再取得、旧世代の遅延処理 | 同じ有効Guardで最終処置を閉じるか、強制された停止条件を提示する。未確定のため移行Gateは閉じている |
| 新旧併存 | 同じScopeに旧PipeだけのProcessと新FileだけのProcessが並ばない | 起動抑止・旧Consumer停止・未解決義務・配置／Aliasの対応と切替後検証を先に確定。暗黙fallbackなし |
| OS／Filesystem | Windows・Linux・macOSと通常ローカル／非対応Filesystemの違い | 現在は新Package未実装。Cross-platform対応済みとはしない |

### 5.1. 次の作業と停止位置

1. 上記Scopeごとに、公開・削除を含む保持区間と既存試験の対応を固定する。特にHome共有Root、Host Mutexと状態Pipe、非同期Supervisorの終了条件を詰める。
2. 第一候補と停止下回復案をConsumer別に比較し、置換できる保証・残す保証・検証できない箇所を人間へ提示する。全対象へ新しい単一回復機構を先行実装しない。
3. 同期／非同期と結果・残存参照の契約を確定し、その後で最小index・必要な型・Source配置を提示する。File数や全Export数から先に実装を決めない。
4. 各Consumerの移行Gateが成立するまで、その既存Primitiveと回復経路を維持する。

現時点では調査母集団と最小契約・有力な代替を具体化した段階であり、Phase 2収束・実装移行可能とはしない。人間による新しいリスク受容や方式選択を今すぐ要求するのではなく、上記の未確認条件を既存実装と必要な反証へ接続することが次の作業である。

固定候補の独立レビューでは、対応Sourceと責務・Scope・未確定条件を照合した。設計上の必須是正はなく、Native Mutex名の表記をSourceへ一致させた。直接参照16件に欠落はない。レビューは静的な限定確認であり、反例実測の再実行、製品回帰、正式QA全体の成立を示すものではない。

## 6. 利用側の保持区間と移管範囲 — 2026-11-06追補

### 6.1. 確認方法と変更境界

今回も製品変更ではなく、既存Source・試験本文・過去の検証記録を照合する設計調査である。複数Packageの排他・保存・終了境界を扱うため、初回編集前の独立整合確認と、固定文書の技術／品質独立レビュー、直接参照確認を行う。規範・公開API・保存形式・Releaseを変更しないため、全体準拠／Release監査は追加しない。現在、新たな人間のリスク受容は求めない。

以下の「既存試験」は現行本文で確認できた観測範囲であり、今回の再実行成功ではない。既存Evidenceも改訂版・環境・実施範囲を越えて新Packageの根拠へ流用しない。特に[過去のWorker構築・競合確認](second-stage-plan.md)には、全体回帰のready待ち失敗と単独確認成功、有限代役と実Workerの区別が記録されている。単独成功で全体失敗を取り消さない。

### 6.2. 取得から最終処置までの対応

| 利用側／実装上の保持区間 | 照合した既存試験と観測範囲 | 共通Lockへ移す候補 | 現Ownerに残すもの／未確認 |
|---|---|---|---|
| Domain汎用Store：`withFilesystemStoreLock`はOS Guard取得→既存義務確認→wx Record作成・sync→同期operation→descriptor close→回復義務保存→Guard解放。その後、清掃Guard再取得・照合・解放→最終再照合・Record／義務削除 | [root-and-lock試験](https://github.com/qual-lab/CRDD/blob/8640aff422042042fbe5adf71b8c192e167b11b0/40_Develop/domain-model/tests/unit/storage/root-and-lock.contract.test.ts)：`通常Operation後の解放不明を同じIDでcleanup再入場する`、`旧Ownerは差し替わった別世代Lockを削除しない`、`別Processの終了確認後だけ残存Lockを回復する`、`Path aliasを別ProcessのKernel Lock迂回に使えない`、`二回復者と後続OwnerをKernel Lockで直列化する`。世代差替え、実子終了、複数Process、相関IDを確認する本文がある | 最初は既存OS Guard取得・保持・解放とWorkerの技術部分だけ。wx Record／義務／Proof全体を一度に置換しない | Rootと用途Pathの選定、同期operation、現行回復契約をDomainへ維持。清掃ではGuardを解放してから最終unlinkへ進む区間があるため「全削除まで連続Guard」と説明しない。既存競合試験もこの最終check→unlinkの全割込み点を決定的に固定してはいない。共通Recoveryの成立は未確認 |
| AI選択保存：上記operationの中で現在本文・CAS比較→pending作成／sync→公開→読戻し・一時物清掃。Lock自身の清掃はoperation外 | [ai-selection試験](../../../40_Develop/domain-model/tests/integration/ai-selection-store.contract.test.ts)：`初回保存・内容CAS・再保存は正本一件へ確定する`、`保存・公開・回収の故障を成功や不存在へ畳まない`、`temp回収不明とLock終了失敗が重なっても先行参照を失わない` | Domain汎用Storeと同じ技術取得へ追従するConsumer。独自Lockを追加しない | 選択Schema・認可・CAS・出版結果・一時FileのIdentityと回復参照。CAS前だけのLockへ短縮しない |
| Access Management：`locked`が同期operation全体をDomain Lockへ渡す。回復必要時だけ既存Proof→回復→取得を一回再試行 | [AM保存試験](../../../40_Develop/access-management/tests/integration/storage/store.contract.test.ts)：`通常保存・読戻し・改訂競合`、`実子Process喪失後にbase/nextとLockを再観測する`、`主失敗をLock清掃失敗で上書きしない`、`通常鍵変更の二Process競合は一採用だけに閉じる`。後者は実子結果・保存Revision・生成0・残存一覧を観測 | Domainの技術取得移管へ追従。AMの回復後再試行を共通Lockの自動方針にしない | 許可判断、Secret生成、base／next、出版済み事実、一次／清掃理由の相関。業務operationを再実行してよいかはAMが決める |
| Topic／Meeting：`withRecordLock`のwx取得→存在／Revision比較→公開・同一読戻し、又はRelation・削除確認→対象削除→descriptor close→Lock unlink | [記録Repository試験](../../../40_Develop/domain-model/tests/integration/topic-meeting-repository.contract.test.ts)：`TopicとMeetingの協調Writer競合とLock解放後の再利用を実Processで確認する`、`保存とcleanupの失敗を上書きせず実改訂と照合する`、`登録・更新はLock内の同一読戻しを確認し保存後失敗を隠さない`。実Process試験は協調取得順であり、異常死・親差替え等は対象外と明記 | 記録ごとのwx取得とclose／unlink終了処理は候補。ただし共通の世代Recordを足すのではなく、現行の単純な競合拒否・清掃例外を先に対応付ける | 種別／IDからのPath、Revision、Project結合、Relation、削除理由・人間確認はDomain。現行Lockには世代Record・Crash回復・明示的なunlink後不存在確認がない。それらを既存保証として主張せず、新たに保証するなら別の設計判断と試験が必要 |
| Coordinator現在状態：短期保存Owner取得→同Ownerの借用→Snapshot読取り・Revision／遷移比較→pending／現在File公開・読戻し→Owner解放。借用先では再取得しない | [Snapshot排他試験](../../../40_Develop/domain-model/tests/integration/runtime-snapshot-lock.contract.test.ts)はcase差／配下起動、別Root独立、Owner終了後再取得。[Kernel試験](../../../40_Develop/domain-model/tests/integration/runtime-kernel-lock.contract.test.ts)は同時取得・二重release・実Owner強制終了後再取得。[Task保存結合試験](../../../40_Develop/coordinator/tests/integration/task-durable-foundation.contract.test.ts)は改訂・Lease・未確定記録と保存失敗を観測 | `runtime-kernel-lock.ts`→PAのPipe取得・生存・解放。保持中の同endpointは維持する | `runtime-lock.ts`のRepository結合・保存Owner借用、`runtime-store.ts`の比較・公開・結果はDomain。実Processで旧Writerを比較後に止め、新Owner公開後に旧Writerを再開する全保存境界の試験は今回確認できていない。既存Revision検査だけをFencing成立としない |
| Coordinator長期Lease：取得意図を短期保存→排他Directory作成・実Identity取得→取得確認を保存→業務処理。解放は解放意図保存→同Directory再照合・rmdir・不存在確認→終了結果保存 | 上記[Task保存結合試験](../../../40_Develop/coordinator/tests/integration/task-durable-foundation.contract.test.ts)：`統合Leaseは取得・解放途中の記録を保全する`、`Lease終了保存失敗は回復参照を保全して再取得を拒否する`、`reconciles an exited lease owner without starting new work`、`keeps pre-publication contention effect-free and recovers only after owner loss`。同期故障注入と実Process競合を区別する | 前後の短期保存で利用する技術Pipeのみ。長期Directoryを新Lock方式へ置換する作業は今回分離 | 排他Directory、取得世代・実Identity、Queue予約・確認・解放Intent、再入場をCoordinator／Domainへ残す。短期保存Lockを長期処理や外部待機中ずっと保持する変更はしない |
| AttemptのHome：Start検証後に同HomeのPipe取得→DI実行・必須通知→Process終端、Cleanup、Container／Network不存在の全確認→資源終了通知→Home release→最終清掃通知。未確認では通常経路で保持。明示abandonは元参照とLifecycle終了を条件に別処置 | [Attempt共通試験](../../../40_Develop/executor/tests/unit/attempt-common.contract.test.ts)：`DIの未確認結果はHomeを保持し準備拒否と要求時例外を区別する`、`資源終了通知とHome解放と最終通知の三段順序を維持する`。有限DI／Home代役でrelease回数と元ID・結果を観測。実Homeの競合成立をこのUTだけから推定しない | 同じ論理Home Binding Hashから導く既存Pipe取得・保持・解放。ExecutorがDomainへ依存しない共通技術処理にできる | 取得時機、DI技術結果の解釈、必要通知、元Controlとabandon条件、`homeLeaseReleased`はExecutor。`finished`／Completionだけを資源回収やHome解放の根拠にしない。実OS排他と全用途を跨ぐ合成結合は移管後に必要 |
| 認証のHome：Coordinator `authority.ts`が認証Plan／初回Intentより前にPipe取得→Executor Completion→Snapshot清掃記録・管理領域終了・回復完了記録→解放。現行の解放呼出しはProcess終了確認を条件とし、Cleanup失敗時でも呼び得る。Process終了不明時は呼ばない | [認証回復試験](../../../40_Develop/coordinator/tests/integration/provider-authentication-recovery.integration.test.ts)：active／settled、同じIntentとReceipt、初回Intent前とCommand中の実Process喪失。これは認証結果保存の再入場を観測し、今回新Lockで再実行していない | Attemptと同じPipe技術処理。認証用の新しいLock種別を増やさない | `authority.ts`の終了条件と記録・Home解放結果、Executorの認証解釈。Attemptの全資源閉鎖条件と同一だと説明しない。二用途の現行方針差をLock移管で変更しない |
| RecoveryのHost／Home／Runtime：対象世代・現在Scopeを決定→Host世代→Home→Runtime State取得→元版／Owner照合・Checkpoint保存・技術処置・結果保存→逆順解放。現在Scopeは複数対象を決定的順序で取得 | [再起動準備順序試験](../../../40_Develop/coordinator/tests/integration/docker-restart-preparation-order.contract.test.ts)：`現在Scopeの複数Ownerは決定的順序で取得し逆順解放する`、`後段取得失敗は成功済み排他だけを逆順に全解放する`、元版変化後のrelease false／throw。有限技術代役による順序・一次失敗・保存0を観測。[Kernel結合試験](../../../40_Develop/coordinator/tests/integration/kernel-lock.contract.test.ts)には実Pipeのawait中保持と解放後失効がある | 同期Pipe、Host世代の非同期Supervisorの技術取得・保持・終了。共有Scopeごとのendpointを変えない | 対象選定・決定的取得順・逆順解放・現在Scope／版検査・保存・DI呼出しはCoordinator。技術Lockが業務処置を許可するCallbackを要求する形にはしない |
| Host世代Supervisor：取得応答→ready往復→保持→release-ready→解放確定の往復→IPC／補助子終了。失敗時は終了要求と終了不明を分離 | `40_Develop/lock/tests/integration/lock-lifecycle.contract.test.ts`（退役した作業中候補。現行の根拠は§15〜16）：同期timeout後の本番Worker終了と再取得は実子Process、Supervisorの送信例外・遅延通知・終了未確認は有限代役、entrypointのexact argv／IPC違反・親切断は実子を含む。`released`イベント一つを全終了の証拠にしない。[Host取得試験](../../../40_Develop/coordinator/tests/unit/host-operation-lock-activation.contract.test.ts)は後着取得再検証と新取得Lockだけの回収 | PA `pipe.ts`／`worker.ts`／`supervisor.ts`の技術lifecycle。同期Workerと非同期Supervisorを無理に一つの実装へ畳まない | Host marker／nonceと業務世代はCoordinator。Workerの解放ACK、親側exit／stdio監視撤去、Supervisor終了を区別。同期呼出しから親event loopのexit処理を同期的に待つ設計を新設しない |
| EI履歴：wx取得→pending未解決確認→設定・既存履歴読取り→保持対象選定→pending write／sync／読戻し→rename公開・完成bytes確認→finallyでpending清掃→Lock解放 | [EI Store試験](../../../40_Develop/execution-intelligence/tests/integration/execution-intelligence-store.contract.test.ts)：`並行Processの同一Eventは冪等で、異なる内容は上書きしない`、初期化失敗／初期化と回収失敗／解放不明の3Case、`所有不明の残存Lockを自動奪取しない`。実Processとfs故障注入を区別する | wx取得・待機・同世代終了は移管候補。200×10msの現在の待機契約を勝手に全Consumerへ適用しない | 履歴保持Policy、Event相関、pending・完成bytes、出版成立とLock終了不明の別結果はEI。初期化例外時の無条件unlinkと通常解放のcheck→unlinkは別評価点。現在ない自動Recoveryを追加しない |
| NativeのDocker Desktop Mutex：`repair.rs`の`run`／`run_restart`で取得→Artifact検証・ready→command loop全体→return時にOwnedHandle close | 同Fileの純粋試験`repair_owner_binding_frame_uses_the_mutex_identity`は名と応答結合であり実Mutex競合の試験ではない | 今回は移さない。NodeのPipe API移管と別枠 | Windows Native処置中の寿命と同ユーザーScopeを維持。Node親にだけ移すとNative子の生存区間とずれる可能性がある。実境界・親子異常終了の同値性が未確認であり、今回Dockerを動かして調べない |

### 6.3. 共通化の具体的な順序

1. **最初の移管候補は既存Node OS排他**。PAの同期Pipe・非同期SupervisorとDomainの専用Workerを、同じendpoint・取得失敗／解放不明・初回結果・終了観測を保ったまま共通Packageの技術責務へ移せる。これは設計上の移管候補であり、移管後試験済みではない。二実装の共通箇所は整理するが、異なる同期／終了保証のために必要な処理は残す。Rootや業務Ownerの正本は移さない。
2. **File型はTopic／MeetingとEIを次の候補にする**。wx取得自体と操作後終了は共通化できるが、現行のRecordなし／UUID Recordあり、待機なし／有限待機、例外／構造化結果を同一の成功Booleanへ畳まない。既存の必要な差分だけを内部条件にする。共通化のためだけの世代Storeや自動回復は作らない。
3. **Domainの回復プロトコルとCoordinator長期Leaseは現Ownerへ残す**。技術取得を共通化しても、回復義務・取得／解放Intent・Revision・Queue・Directoryを一括移管しない。前回の合成反例と§6.2の未固定割込み点が解消するまで共通Recoveryへ進まない。
4. **Native Mutexは維持する**。PA廃止のNative責務移管と、Lock APIの共通化を同じ作業へ広げない。OSが解放する資源であっても、子Processが生きる間の保持を親ProcessのFile存在へ読み替えない。

従って、現時点で新しいHome共有Directory、汎用Lock Registry、永続Fencing Token、全Consumer一律のRecovery APIは不要である。§3の`{ root, key }`はFile型の候補表現であり、OS排他まで新しいFilesystem Rootへ強制する完成IFではない。OS型では現行の技術Identityとendpointを使う。最終Public型の確定はこの差分を反映して行う。

### 6.4. 移管時に必要な追加確認と今回の結果

| 追加確認 | 必要な理由／現在の扱い |
|---|---|
| 同一endpointへ旧Consumerと共通Lock Consumerが競合し、別Identityは独立する | Hash名の変更だけで排他が分裂し得る。特にCoordinatorとExecutorの同Home、検証Script、新旧Processを含める。移管後の新品試験が必要 |
| 比較→公開→読戻しの間、同じ保持が続く／喪失時には公開を止める | 複数の既存試験を並べても旧Writer遅延再開の全境界成立にはならない。Consumerの業務書込み保証として個別確認 |
| File初期化例外、通常解放、回復でのcheck→unlink交差 | EI・Topic／Meeting・Domainで契約が違う。世代UUID追加だけで解決しない。現行で禁止される第三者削除を前提にした反例と、協調Consumerで到達する経路を分ける |
| Worker／Supervisorの取得遅延・timeout・切断・初回解放・親終了 | 取得応答や解放ACKだけで補助子終了・監視撤去を証明しない。既存技術試験を新配置へ接続し、実境界確認も行う |
| 保持すべきHomeと解放してよいHomeの結果搬送 | Attemptと認証の現行条件差・保存失敗・Process不明を同じLock結果で誤上書きしない。用途別既存回帰と実Pipeの合成結合が必要 |

今回の照合ではTopic／Meeting独自Lockの棚卸し漏れと、長期Leaseの物理Directoryの説明不足を是正した。製品Source・公開API・保存形式・既存試験は変更せず、再実行もしていない。実AI・Docker・過去保持物への操作、新しい試験物の作成はない。共通Lockの製品移管・共通Recovery成立・PA廃止を完了とは表示しない。

追補の固定候補を独立レビューし、対応Sourceと試験本文の静的照合に保証の過大主張・設計上の必須是正はなかった。EIを「最初の候補」とした旧一覧の説明を、今回の順序と整合する「File型移管の候補」へ訂正した。直接参照33件に欠落はなく、書式差分検査も成功した。製品移管の検証義務は未実施のまま保持する。

## 7. Node OS排他の実装移管 — 2026-11-07

人間が最小IF確定・Node技術処理移管・利用側追従・新品限定試験を一括承認した。設計調査から技術Refactorへ移行し、初回編集前に環境、固定子登録、出力と終了観測、配布Source閉包を独立照合した。技術・品質の独立レビューと直接伝播確認を行い、規範・Release・準拠表明を変えない全体監査は追加しない。

### 7.1. 実装とOwner

公開契約とSource責務の現在正本は[共通Lock設計](../../../06_Architecture/Details/lock/01_Architecture.md)。公開関数は`acquireLock`、`acquireLockAsync`、`acquireSupervisorLock`、`acquireEndpointLock`の4入口で、異なる既存の同期結果・非同期終了保証を維持する。将来用のinspect／recover APIは作らない。

- PAのlock実装4 Sourceと固定子起動、対応技術試験を`40_Develop/lock`へ移した。PA Rootの旧再export・互換Wrapperは撤去。
- DomainのFilesystem endpoint Workerと取得・解放だけを移管した。Root／Hash／canonical key、wx Record・回復義務・Proof・回復手順はDomainに残した。
- Coordinator、Executor、検証Scriptと関連試験は共通Lockへ接続した。DIは試験の依存Owner追従だけで、本番Source・公開API・技術条件を変更しない。AI Adapter、Native配布物、長期Lease、File Lockは変更しない。
- Supervisorの中立環境はCoordinatorが既存PA APIで確定して渡す。Lockは環境・待機値をコピーして固定する。空環境のWindows Workerと従来環境のFilesystem Worker、destroy／resumeの差は維持する。
- Source Hash対象、新品の配布Sourceコピー、Checkerの公開Module一覧、Test Catalog／Symbol、QAの現行Owner記述を追従した。廃止済み署名機構は復活させない。

### 7.2. 検証経過と限界

限定試験は実AI・Docker・過去保持物を使わない。新品の共通Packageコピーは旧PA／Domain Workerなしで起動し、実Owner強制終了後の再取得と同じendpointの競合を観測する。Sourceコピー試験の初回失敗は、試験子の`--input-type=module`がWorkerへ継承されたことによる。製品を変更せず通常File起動へ直した後、2件成功した。既存技術21件も成功している。

Domainの限定17件は制限下16成功・リンク作成EPERM 1件で、同じSourceの当該1件を通常権限で成功確認した。Checkerの11件も台帳追従後10成功・リンクEPERM 1件となり、当該1件は通常権限で成功した。全体回帰の単一Passへ合算しない。

PA通常75件、Executorの有限DI／Home／CLI結合10件が成功。Coordinator／Domain／Executor／PA／DI／Checkerの静的確認と、既存ローカルの固定ツールによる新Lockの書式・型・Lint確認は成功している。新Packageの依存取得はオフラインcache不足で失敗したため、ネットワーク取得やRuntime依存の追加は行わない。製品RuntimeはNode標準だけを使用する。

Coordinator結合の初回確認では、Source追加に対する合成File数・上限境界と、以前の改名後に残った試験内の型名参照を是正した。型名の不整合は基準HEADにも存在し、今回は現行Sourceへの接続を修正した。代表3件は成功。環境不成立fixtureのNode mockも、新Ownerが参照するspawnを起動禁止の代役へ接続した。固定候補の結合再確認・独立レビューの最終結果はこの節へ追記する。

新Lockへの移管を、File Lock／Native Mutex移管、共通Recovery、全OS対応、PA廃止または実AI／Docker E2Eの完成とは扱わない。

### 7.3. 最終限定結果

是正後の固定実装で、Lock 23件、Coordinatorの4 Suite 198件、Domainの3 Suite 17件、Checker公開・台帳11件、PA通常75件、Executorの有限結合10件が成功した（計334件、各実施範囲内の結果）。Domain／Checkerは通常権限で全対象を再実行しており、先行EPERMを含む結果を消さず、最終実施と区別する。正式なRepository全回帰、Linux／macOS、実AI／Docker E2Eは未実施である。

固定候補の技術・品質・直接伝播の独立レビューに必須指摘はなかった。型移管で残った宣言のないコメントを除き、型正本へ必要な説明を寄せた後の再確認も追加指摘なし。新Lockの標準`npm test`は依存未取得のため実行していないが、既存の固定ローカルツールで同じ書式・型・Lint軸と全23試験を別々に実行し成功した。依存Lockfileは既存の同版devDependencyとintegrityを再利用して追加し、Runtime依存はない。

今回の新品領域`C:\project\CRDD\.crdd\tests\lock-migration-20261106-7d9f21a4`は、全試験Process終了後に、exact Root・非link・既知のNode compile cacheだけであることを確認して回収し、不存在を確認した。新品Sourceコピーも試験自身が所有子のclose後に回収・不存在確認している。実AI・Docker・過去保持物の操作はない。Native配布物・保存形式・IPC名は不変更。現在、新たな人間の判断は必要ない。コミット・プッシュは未実施である。

<a id="file-lock-migration-assessment"></a>

## 8. File Lock群の利用・回復・移管範囲 — 2026-11-07調査

### 8.1. 結論と調査境界

4系統のFile Lock本体は既にNode.jsで実装されており、PA廃止のために新しいFile Lock APIへ移す必要はない。Domain汎用Storeの下位OS Guardは§7で共通Lockへ移管済みである。残るFile Recordと回復手順まで同時に共通化するのではなく、現Ownerへ残す案を第一候補にする。§6.3で次の移管候補としたTopic／Meeting・EIについても、今回の利用・契約照合を経て、直ちに移管するという推奨は取り下げる。

今回は設計調査と変更候補の具体化で、製品・公開API・保存形式・既存試験は変更しない。保持物の読取り・移行・回収、新規試験物、実AI・Docker操作はない。複数Ownerの保存・回復を扱うため、着手前の独立整合確認、固定文書の技術／品質独立レビューと直接参照確認を行う。規範・準拠表明・Releaseを変更しない全体監査は追加しない。§7の334件成功をFile回復全体の成立へ拡張せず、今回の試験再実行成功とも扱わない。

対象は以下の4系統とその直接利用側。Coordinatorの長期Lease Directory、Git自身のLock、保存用pending／一時File一般は、新たなFile Lockとして数えない。利用調査は現在のRepository Sourceの参照であり、Repository外のConsumer不存在は証明しない。

### 8.2. 利用側・保持・回復の違い

| 系統・現在の利用側 | 保持しているもの／通常終了 | 回復条件・現在の結果 | Ownerへの残置と技術移管候補 |
|---|---|---|---|
| Domain汎用Store：`storage/root-and-lock.ts`。直接利用はDomain `storage/ai-selection.ts`とAccess Management `storage/lock.ts` | 共通LockのOS Guard＋wx Fileの`recoveryId/ownerPid`。descriptorは同期operation後にclose。回復義務を保存してGuard解放、清掃Guardで照合・解放した後に最終照合・削除する | 同じRoot／canonical key／Recovery IDを検査。PID照会はESRCHとその他を区別。同一Processの登録済み清掃Scopeによる再入場もある。Proof取得と回復は別の呼出しで、回復時に再取得・再照合する。operation完了／失敗と清掃不明を別々に返す | Root選定、Record／義務／Proof、自己清掃と他Process回復、結果相関をDomainに残す。下位OS取得は既に共通化済み。File部分をさらに移す緊急性は低く、汎用Recovery APIを新設しない |
| 上記の利用方針：AI選択保存／AM状態保存 | AI選択はLock内で本文・期待Identity比較、認可・境界再確認、pending公開・読戻し。AMも保存operation全体を保持する | AI選択は回復必要等を利用側へ返す。AMは回復必要時だけ既存Proofで回復し、取得を一回だけ再試行。出版済み事実・改訂・一次失敗・清掃不明・同じ回復IDを保持 | 認可、CAS、Secret生成、保存、再試行判断は各Owner。AMの一回再試行を共通Lockの自動方針にしない。Lockの取得成功を保存成功へ読み替えない |
| Topic／Meeting：Domain `storage/topic-meeting-store.ts`。`topic/create-operations.ts`／`meeting/create-operations.ts`から接続 | 記録種別RootとIDごとの`.ID.lock`をwx作成。世代Recordなし。descriptorを存在／改訂比較・公開／読戻し、又はRelation確認・削除まで保持。終了時にcloseとunlinkを両方試す | EEXISTは即拒否で、保存側では改訂競合へ分類。自動回復はなく、Crash残存のOwnerを識別する記録もない。close／unlink故障は元operation失敗をcauseにしたAggregateError。unlink後の明示不存在確認はない | 現在のNode取得・終了は技術的に抽出可能だが、1利用Blockの局所処理であり、移すだけでは責務削減が小さい。Root／ID／Project／Revision／Relation／削除理由・確認はDomain。共通化のためだけのUUID、PID Record、回復経路は追加しない |
| EI履歴：`storage/lock.ts`を`storage/store.ts`のWriterが利用 | `history.lock`をwx作成、UUIDと固定contractをsyncしてdescriptorを初期化中にclose。File存在を処理期間の排他として使用。履歴公開・pending清掃後に型／非link／nlink／contract／UUIDを照合してunlink・不存在確認 | EEXISTで200回×10msの現在の待機。期限後は取得不能。残存の自動奪取・PID回復はない。初期化失敗のunlinkと通常releaseは別経路。出版成立／不明、pending残存、Lock終了不明が共同で結果を決める | 有限待機と世代付きFile取得・解放は技術候補。ただしTopicとのdescriptor寿命・Record・結果が違い、現段階でオプション集合やAdapterを作る利点は確認できない。履歴保持、Event同一性、pending、出版結果と回復参照はEI |
| Domain一時Operation：`storage/temporary-operation.ts`。現在の製品src参照は宣言元とRoot再exportのみで、外部呼出しは試験・fixtureに見つかった | `.staging`のFileをwx作成→書込み／sync／close→canonicalへhard link→同じidentity/PID/stateを読戻し→staging清掃。再入場／終了処置の区間で取得し、作業期間全体を連続保持するものではない。終了はactive照合→releasedをrename公開→削除・不存在確認 | 既存stagingが不正なら削除、有効ならPID観測。canonicalがactiveかつOwner生存なら拒否し、それ以外は除去後に最大3回取得。業務文書のpreparing／active／recovery_required、元identity・generation、nextIdentityを別に検査する。清掃失敗は同じ回復参照を保持 | staging公開・File世代・Operation文書・根拠昇格・再入場が結合している。現行本番未接続の処理を共通Lockの新Capabilityとして広げない。現Ownerへ残し、採用済みCapability／過去Evidenceを確認してから接続・退役を別判断する。未接続だけを削除許可にしない |

Fileを開いたdescriptorを持つこと、Pathが存在すること、業務Ownerの現在性は同じではない。特にEI／一時Operationは取得Record公開後にdescriptorを閉じ、Topicはoperation後まで保持する。単一の`release(): boolean`へ畳んでも、これらの寿命・保存結果は統一されない。

### 8.3. 既存試験との対応と不足

| 対象 | 現行試験本文で確認できた観測 | 共通化の根拠として不足するもの |
|---|---|---|
| Domain汎用Store | [root-and-lock試験](https://github.com/qual-lab/CRDD/blob/8640aff422042042fbe5adf71b8c192e167b11b0/40_Develop/domain-model/tests/unit/storage/root-and-lock.contract.test.ts)の同じIDの自己清掃再入場、別Root拒否、既存Record差替え、実子終了、Path alias、二回復者と後続Owner。結果・File内容・実Process終了を区別している | 最終check→unlinkの全割込み点を決定的に固定しているわけではない。PIDはOS Process生成世代の証明ではない。新OS Guard試験成功だけからFile回復の安全性全体を推定しない |
| AI選択／AM | [AI選択保存](../../../40_Develop/domain-model/tests/integration/ai-selection-store.contract.test.ts)の内容CAS・認可失効・公開／清掃故障、[AM保存](../../../40_Develop/access-management/tests/integration/storage/store.contract.test.ts)の実子喪失後base／next再観測、二Process一採用、主失敗とLock終了不明 | 通知・結果の成功だけでは比較から公開までの保持を置換できない。新Lockへ移した後の同じ保存結果・回復IDの結合確認が別途必要 |
| Topic／Meeting | [Repository試験](../../../40_Develop/domain-model/tests/integration/topic-meeting-repository.contract.test.ts)の実協調Writer、解放後再利用、close／unlink失敗、Lock内の同一読戻し、実保存Revision | 実Process試験は取得順を固定した協調競合で、異常死・同時open勝者・親差替え等は対象外と明記。最終unlink直前の別世代差替えやCrash後の回復を確認したとは言えない |
| EI | [Store試験](../../../40_Develop/execution-intelligence/tests/integration/execution-intelligence-store.contract.test.ts)の並行Processによる同一Event冪等性／別内容拒否、所有不明のLock非奪取、初期化故障・初期化と清掃の複合故障、出版成立後の解放不明。完成bytesと残存IDを観測 | 初期化例外時のunlinkと通常解放check→unlinkは別に評価する。残存Lockを自動回復しない現行契約を、新しいPID判断だけでオンライン回復可能へ変えない |
| 一時Operation | [Lifecycle試験](../../../40_Develop/domain-model/tests/integration/temporary-operation-lifecycle.integration.test.ts)の実子exitを挟むstaging作成・書込み・hard link・canonical公開・次世代公開前後、released Lock残存からの再入場、使用済み旧参照拒否。[清掃System試験](../../../40_Develop/domain-model/tests/system/temporary-operation-cleanup.contract.test.ts)は公開APIで終了理由別の物理不存在・別Operation保持・exact再入場を観測 | Systemという分類だけでOS異常死や旧Owner遅延処置まで証明しない。二回復者の最終除去競合、未知PID観測、staging差替えの全交差は今回確認できていない。一般的な共通Recoveryの根拠ではない |

既存試験の題名だけでなく、本文の刺激・観測・対象外を照合した。上表は今回の静的確認であり、試験を再実行した結果ではない。

### 8.4. 移管前に切り分ける是正候補

| 候補 | Sourceから分かること | 最小の次対応と変更しないもの |
|---|---|---|
| Domain／EIの取得後ID生成 | いずれもwx open成功後、`randomUUID()`が初期化try／清掃範囲の前にある。この呼出しが例外を投げた場合のclose・終了／残存搬送は、その後のcatchに入らない。現実の障害発生を今回再現したものではない | 各Ownerの限定故障注入で、取得後からID確定までの終了経路と結果を確認し、必要なら局所是正する。未取得IDを推測で補完せず、新Store／共通Recoveryを追加しない。既存の初期化write／flush故障試験の成功をこの区間の確認へ代用しない |
| 一時OperationのPID分類 | `processIsAlive`は成功とEPERMをtrue、それ以外の例外をfalseとする。Domain汎用StoreのESRCH／その他不明の区別とは異なる | 本番接続・到達条件と、未知例外をOwner不在にしてよいかを限定検証する。PID分類の一本化や回復許可の緩和は今回実装しない |
| 最終照合から削除までの交差 | Domain清掃のGuard解放後の処置、EIのRecord照合後unlink、一時Operationのreleased公開→削除に、それぞれ別の交差点がある | 協調Consumerで到達する順序と、非協調の第三者差替えを分ける。必要な反証だけを新品領域で設計し、旧Ownerによる新世代処置が防げる根拠を確認する。§4.3の単純モデルを現行製品の不具合再現とは扱わない |

### 8.5. 選択肢と推奨する処置

| 選択肢 | 得られること／費用・残る問題 | 推奨 |
|---|---|---|
| 共通Lockは既存OS排他に留め、Fileプロトコルは現Ownerへ維持 | PA依存削減を妨げず、既存保存・回復契約を変更しない。一方、共通化による修正箇所の集約効果は得られず、重複する小処理は残る | 現在の第一候補。公開IFは§7の4入口を維持し、追加API・型・Sourceを作らない |
| Topic／MeetingとEIのFile取得・終了だけを共通化 | 同じ障害処置を共有できる可能性はある。ただし待機・Record・descriptor寿命・初期化清掃・結果搬送を先に揃える必要があり、現状は単純な移動では済まない | §8.4の局所確認後、実際に共有できる契約が残る場合だけ再評価。任意Path削除API、用途別Adapter、巨大なoptional設定を先に用意しない |
| 全File Record・回復を汎用Lockへ移管 | APIの外見は統一できるが、保存・Operation世代・根拠昇格・回復判断まで下位へ取り込むか、同じ業務機構を引数やPortで再現することになる | 現在は推奨しない。PA廃止に不要で、余計な管理構造を増やす |

本調査で共通化可能と判断できるのは、検証済み対象に対する技術取得・初期化失敗処置・同じ取得の終了という責務の範囲までであり、現行4実装をそのまま安全な共通実装として切り出せるという結論ではない。次に進むなら、まずDomain／EIのID生成前後の終了経路を各Ownerで限定確認する。一時Operationは接続実績と採用済み意図を再確認し、現行本番未接続を理由に共通Packageへ移さない。現在の調査完了に新たな人間のリスク受容は不要である。

固定候補の独立レビューでは、Sourceとの対応、回復条件・未確認範囲、今回の非実行と過去Evidenceの区別に必須指摘はなかった。直接リンクの実体と書式差分を確認した。今回の変更は本節と構造案の要約だけであり、先行する未コミットの製品移管差分へ追加変更していない。

## 9. 取得後ID生成例外の限定確認 — 2026-11-07

### 9.1. 対象・手順・実測範囲

人間の確認依頼により、§8.4のDomain／EIだけを新品領域`.crdd/tests/lock-id-failure-20261107-582a6d13`で確認した。製品修正ではない。着手前の独立整合確認では、exact Pathのwx成功fd、ID生成への注入到達、File残存とfd残存、製品と診断側の清掃、子終了と技術endpoint再取得を別々に観測する方針を照合した。変更分類は局所診断と結果記録であり、限定的な技術／品質独立レビュー・直接参照確認を行う。規範・公開API・Releaseを変えない全体監査は追加しない。

各Caseは独立したNode子Processで、`node:test`のModule mockを設定後に実製品Moduleを動的importした。`randomUUID()`を固定例外にし、注入呼出しが1回、exact Lock Pathのwx成功が1回であることをassertした。`fstat(fd)`と`lstat(path)`で通常File・0 byte・観測時のdev／ino一致を確認した。これを将来のPath同一性や原子的Fencingの証明には使わない。

| Case | 実行した境界 | 観測 |
|---|---|---|
| Domain | 実`createFilesystemStoreRoot`→実`withFilesystemStoreLock` | 固定例外を送出。業務operationは0回。open descriptorと0 byteのLock Fileが残り、回復義務Fileは未作成。同scopeの2回目の実取得は`acquired:false / filesystem_store_lock_unavailable` |
| EI Lock | 実`acquireMutationLock` | 固定例外を送出。open descriptorと0 byteのLock Fileが残る。通常の初期化catchへ入らず、解放handleは返らない |
| EI保存側 | 実`writeExecutionIntelligenceEventWithRuntimeDataArea`の宣言本文を型除去して有限環境へ接続。入口のEvent検査とLayout解決だけを代役にし、Lock取得と`blockedPublication`は実製品処理 | 例外をcatchして`status:blocked / execution_event_store_unavailable`。しかし`cleanupConfirmed:true`、残存ID空、回復参照null、release呼出し0回となり、同時にfdと空Fileは残った。公開保存API全体のE2Eではなく、選択したcatch／finally経路の確認である |

診断子は上記観測後に自分が記録したfdを明示closeし、結果搬送後に明示exitした。このcloseは製品の清掃成功ではない。親は子の終了後、Domainと同じHashドメイン・Root・canonical keyから導いた技術endpointを実取得・解放できた。これはOS Guardの技術的な再取得であり、残った空Fileを含むDomain保存APIの通常再開ではない。

最初のDomain診断は自然終了待ちが25秒の試験期限に達し、試験の終了処置でSIGTERMとなった。取得後の残存と、診断Loader等を含むProcess終了待ちを混同しないため、観測後に明示exitする方式へ修正した。期限到達の原因を製品Workerだけに断定していない。先行子の同じ技術endpointも別途取得・解放できたことを確認した。

### 9.2. 原因と最小是正案（確認時点では未実装）

- Domainはwx成功後、`recoveryId`用の`randomUUID()`を、その後のwrite／operation捕捉・fd close・OS Guard解放より前で呼ぶ。この例外が後段へ到達しないことを実測した。
- EIもwx成功後、初期化tryの前でUUIDを生成するため、初期化catchのunlinkへ到達しない。保存側では取得関数が値を返す前の例外なので`lock`はnullのまま、残存情報も付かず、catch／finallyが清掃済みへ分類する経路を確認した。保存そのものは成功と表示せずblockedである。
- 最小案は、DomainのID生成をDirectory作成・OS Guard取得・File作成より前へ、EIのID生成を取得loopの最初のFile作成より前へ移すこと。ID生成の失敗を資源取得前に閉じる。新しい管理状態・Recovery IDの補完・公開型・保存Schemaは不要で、既存のID書式・回復判定・待機値も変えない。
- 是正時は、同じUUID故障でFile／descriptor／Guard取得0、業務処理0になることと、通常取得・競合・既存のwrite／sync／close・清掃故障結果を確認する。今回の依頼は確認までなので、製品Source・既存試験は修正していない。

自然発生頻度や全ての初期化例外を確認した結果ではない。注入した「取得後UUID例外」の未清掃経路は再現済みである。一般的なFile回復やPA全廃の成立には拡張しない。

実測した作業TreeのSHA-256（基準HEADだけでなく、先行未コミットのNode移管を含む）:

| Source | SHA-256 |
|---|---|
| Domain `storage/root-and-lock.ts` | `0f1c30675015231102a6b1b5a6267307938effef8eb5a23146842334815c64fd` |
| EI `storage/lock.ts` | `1a419f4a6cb9cb34d568dcc86ff32e178cf58eb329a6eda527672388cafabc5a` |
| EI `storage/store.ts` | `644fb15eb1af41511c54ec757346c62e71862f392eb0ef7ae17879f11b15c203` |

一時診断ScriptのHashは`9d6d041121b4aa4076d722d08985054ca8dc1663878a02601ca0d8ca1bc9b43e`。恒久的な診断機構は追加せず、結果・注入条件・実装参照を本節へ残す。

限定独立レビューに必須指摘はなかった。診断後に、先行SIGTERM分も含む子終了と両Domain endpointの取得・解放を確認し、exact Root／canonical所在／非link、既知4 Directory内の各1件だけの通常File・nlink 1・0 byteを検査した。一時Scriptと自己生成4 File・Directoryを非再帰回収し、試験Root不存在を確認した。これは診断所有物の手動清掃であり、製品の回復処理による成立とは扱わない。実AI・Docker・過去保持物の操作はなく、製品Source・公開API・既存試験は未変更である。

## 10. ID生成の最小是正とLock構成の確認 — 2026-11-07

人間の継続指示により、DomainはRoot／相対Path検証後、Directory作成・OS Guard・wx取得前に回復IDを生成し、EIはwx取得loop前にUUIDを生成する形へ是正した。追加の管理状態や互換処理はない。公開型・ID書式・保存Schema・待機値・回復判定は維持する。ただし、競合や未対応OSとUUID故障が同時に起きる場合、UUID例外が先になる。取得できない呼出しでも未使用UUIDが生成され得る。

新品領域`.crdd/tests/uuid-preacquire-20261107-37c6e89a`で実Moduleを独立子Processへ読み込み、UUID例外を注入した。Domain／EIともUUID呼出し1、Filesystem変更要求0、Worker生成0、業務処理0、対象Directory空を確認した。Root検証等の読取りまで0という意味ではない。結果搬送後の子終了を確認した。恒久試験は既存2ファイルへ追加し、実宣言本文を有限環境で検証する。EI保存結果の相関確認は選択した本文経路であり、公開保存API全体の故障E2Eとは扱わない。

DomainのLock／AI選択25件、EI Store49件が成功した。両Packageの書式・型・lint検査も成功した。Domain初回実行の1件はModule mock有効化オプション不足で失敗し、Package宣言と同じ有効化条件で25件を確認し直した。検査条件は緩めていない。

共通Lockのsrcは現在9ファイルである。これは§7のPipe／Worker／SupervisorのOwner移管であり、`fs.open("wx")`への機構統一ではない。Fileプロトコルは§8の各Ownerへ残っている。固定2入口に対する`process.ts`の役割登録・検索構造と、`endpoint.ts`の取得処理には既存入口への統合余地がある。一方、WorkerやSupervisorは別実行単位なので、単に親Moduleへ移動すれば不要になるものではない。ファイル統合とwxへの方式変更は分け、今回はLock Sourceを変更していない。wxだけに置換する場合は、Crash後の残存・取得世代・回復と各利用側の保持区間を再設計する必要があり、統一済みとは表示しない。

限定最終レビューは必須指摘なし。新品試験Rootは残存が空の`domain`／`ei` Directoryだけであることと非linkを確認し、非再帰で回収してRoot不存在を確認した。これは今回所有する試験物のみの処置である。実AI・Docker・過去保持物は操作していない。

## 11. wxへ寄せる範囲の再評価 — 2026-11-07

### 11.1. 今回の範囲と判断基準

人間の継続指示を受け、§10のファイル数に関する疑問から、既存Callerの保持区間と試験本文を再照合した。今回は設計調査と既存変更記録の更新であり、製品Source・排他方式・保存Schema・試験期待値は変更しない。着手前に複数Packageの保存・回復・共有Homeの観点を読取り専用で独立確認し、固定候補を限定技術／品質レビューへ渡す。標準規範・公開API・Releaseを変えないため、全体準拠・Release監査は追加しない。

評価するのは、既存全保証を必須として9ファイルを保存することではなく、必要な競合防止を簡単なFile取得・解放で成立させられるかである。Crash後の即再取得を捨て、残存時は停止して人間判断へ返す選択肢も比較する。Fileを自動削除するためだけの新Supervisor・Heartbeat・Registry・汎用Recoveryは作らない。

### 11.2. 利用側ごとの具体的な境界

| 対象とSource | 現在の保持区間・終了条件 | wx化の候補範囲と残す責務 |
|---|---|---|
| Domain汎用Store／AM。`domain-model/storage/root-and-lock.ts`、`access-management/storage/lock.ts` | 通常操作は既存OS Guardとwx Recordを重ねる。Proof発行・回復処理もOS Guardを取得して対象世代の読取り・回収を直列化する | 既にFile取得はある。OS Guardだけを消すと既存のオンライン回復条件まで変わる。保存のCAS・認可・回復IDはOwnerに残し、オンライン回復を継続するか、停止下の明示処置へ変えるかを先に固定する |
| CurrentState。`domain-model/storage/runtime-lock.ts`／`runtime-store.ts` | 短期の同期Reader・Writer、借用Owner、修復観測が同じ`CurrentState`に参加。Root再観測・Revision比較・公開・読戻しを保持する | Repository内のwxへ寄せる第一候補。ただしWriterだけではなく全Reader・借用・回復入口を同時切替する。既存`state.lock`は保存途中を示すmarkerなので、そのまま新しい取得世代Lockとして流用しない。保存marker・pending・履歴の解釈はDomainに残す |
| Decision Store／Docker状態回復。`coordinator/decision/store.ts`、`execution/recovery.ts` | Decision Storeは取得→Root再観測→同期操作→解放。RecoveryはHost世代→Home→DockerRuntimeStateの順に取得し、観測・処置・保存後に解放 | 短期保存の取得・解放は候補。Recovery側も同じScopeのFileへ切り替える必要がある。現行Decision取得キーは`stableLogicalHomeBindingHash`であり、今回Repository Hashへ改変しない。同じHashでもHomeとDockerRuntimeStateは別namespaceで、同じLockへまとめる理由にはならない |
| Provider Home。Coordinator `execution/authority.ts`／`recovery.ts`、Executor `lifecycle/attempt.ts`、`scripts/verify-provider-home.ts` | 同じHashドメインをRepository横断で共有。Attemptは技術終了・資源回収を確認して解放する。認証はProcess終了未確認なら解放せず、Process終了確認後に解放する一方、別の清掃失敗は結果へ保持する。両者を同一終了条件へ読み替えない | File取得自体は候補だが、Repository-localでは同じHomeを排他できない。上位が確定した同じユーザー／Home Scopeの既存管理Rootと固定Pathを全Callerへ渡す必要がある。Lock PackageにHome探索・保存・業務判断は持たせない。今回共有Directoryは作成・確定していない |
| Host Operation世代。Coordinator `execution/operation.ts`／`recovery.ts` | 非同期Supervisorの取得・ready再確認後に元世代へ結合し、喪失時は資格を失効。解放・子終了不明を保持する。Recoveryは同じ世代の同期入口も使う | wx化は可能性の評価まで。Supervisorを残すこと自体は完成条件ではないが、削除するならready／喪失／子終了を返す旧契約とCallerの処置も整理する。親Process終了とDocker／外部子終了を同一視しない。Lock残存で新操作を止める案はあるが、既存Ownerの停止・失効処理を置換済みとは扱わない |
| Topic／Meeting、EI | 既にwx。記録更新／Event公開のfinallyで終了し、所有不明の残存は自動奪取しない | 新たな方式変更は不要。共通取得・同世代解放を利用できるかは、待機・descriptor寿命・初期化失敗・解放不明の結果を対応付けて判断。Record内容と結果分類は各Ownerへ残す |

CoordinatorのProjectState入口と対話Console入口には、今回の全src参照走査でも外部本番Callerを確認できなかった。対話Consoleには実fixture・試験が残り、非同期取得自体はHome検証Scriptに利用される。未使用入口の削除と非同期取得の全削除を混同しない。長期Lease Directory、Domain一時Operation、Native Mutexは§8の別契約であり、wx化対象へ自動追加しない。

### 11.3. 必要な保証と、変更できる保証

| 保つこと | 理由／失うと起こること |
|---|---|
| 同じ資源を全Callerが同じLock所在で取得する | RepositoryごとのFileで共有Homeを排他すると、別Repositoryから同時利用できてしまう |
| 取得失敗・初期化途中・解放不明を成功にしない | Record未確定・部分書込み・close不明も残り得る。UUIDやPIDが読めないものを「Ownerなし」に補完しない |
| 元取得だけを解放し、稼働中に残存を奪取しない | UUID照合→unlinkだけでは、その間の別世代差替えを原子的に防げない。停止下処置を選ぶ場合も、旧Ownerの遅延処置・Writer・回復者が残っていないことが前提 |
| 保存CAS・必要なEffect前記録・技術終了確認は各Ownerに残す | Lock取得は保存成立・子終了・Cleanup成立そのものではない |

一方、既存OS方式の「Owner終了後はLock Fileの清掃なしで直ちに再取得できる」性質は、変更不可と固定しない。wxではFileが残れば次の取得は失敗する。停止して人間判断へ返す運用を選べば、新しい自動回復機構は不要だが、Crash後の可用性と復旧負担は変わる。この差は方式採用時の人間判断事項であり、今回採用済みとはしない。

代表例は、正常解放後の再取得、同じScopeの二重取得拒否、UUID／Record初期化途中の失敗、Process終了・File所在・世代を確認できない残存である。最後のケースは待機時間やPIDだけで自動削除せず停止する。停止下回復を選んでも、停止を単一PIDの不存在だけで証明できるとはしない。

### 11.4. 実装へ進む順序とSource削減

1. 短期保存を先行候補とし、Crash残存時は停止する方針を採るか、既存オンライン回復を残すかを固定する。
2. Root・Identityは既存Ownerが確定し、LockはFile取得・保持・同取得の解放だけを担当する。Home共有RootとHost世代の終了契約を先に決める。新しいRoot探索APIや保存Storeは追加しない。
3. 切替対象の全Process・Scriptを停止した状態で一括切替する。旧Pipeと新Fileは互いに競合しないので、混在したまま安全に移行したとは表示しない。旧方式fallbackや二重実装で通さない。
4. 同じScopeの二Process競合、別Scopeの独立取得、同世代解放、旧取得の遅延解放、初期化途中Crash、解放失敗、Reader／Writerと回復者の交差を新品領域で確認する。OS方式のCrash即再取得試験は単に削除せず、採用した停止・残存・再入場契約に対応する試験へ置き換える。

全利用側でwxだけが成立する場合、`index.ts`・`types.ts`・`operations.ts`程度を構成候補にできる。別実行単位がなくなるため、`worker.ts`・`endpoint-worker.ts`・`supervisor.ts`と固定子起動`process.ts`、その終了監視専用部分は撤去候補となる。これは単に9→3ファイルへ内容を詰め直す案ではなく、不要になる実行資源と契約を消す案である。部分移行中はOS方式を使うCallerが残るので、先にファイル数だけを合わせない。

今回の検証はSource・既存試験本文・呼出し参照の静的照合であり、試験再実行・wx置換実測・実AI・Docker操作はしていない。§10の74件成功を新方式のEvidenceへ流用しない。

追記2箇所の限定最終レビューは必須指摘なし。書式差分検査も成功した。人間の方式採用・製品実装・新方式の実境界検証は未実施である。

## 12. wx方式の採用と通常解放の境界 — 2026-11-07

### 12.1. 人間が採用した方針

A案として`fs.open("wx")`への統一、EEXIST時のFail Closed、Crash残存時の停止下明示Recoveryを採用した。自動奪取・PID／時刻によるStale判定・自動Recovery・代替監視は追加しない。Coordinator・Workbench・MCP・Worker・Provider子等、対象資源へ到達する全利用Processの停止確認と、Path・実体・世代照合が必要で、未知の残存は保全する。共有HomeのRepository横断Scopeを保ち、旧Pipe／Supervisor方式との並走を認めず、同じ保護対象のReader・Writer・Recoveryを一括切替する。通常解放でも所有確認とFile置換競合を検証する。Crash後に自動復旧できないことはv0.22の意図的な運用制約であり、停止・対象確認手順と理由表示を実装対象に含める。

これは§11の未採用状態を更新する。ただし、次項の強い保証をwx単独で成立済みと扱う承認ではない。製品初回編集前の独立整合確認で、通常解放に関する信頼境界の不足を検出した。

### 12.2. 最小反証と不足している判断

新品領域`.crdd/tests/wx-release-boundary-20261107-c6946d02`で、提案する照合→unlink方式だけの設計反証をNode.jsで実行した。現行製品の故障試験ではない。元Fileをwx作成してdescriptorを保持し、dev／inoと内容上の取得世代を照合した。同じProcessの介入を、非協調の置換処理が入り得る順序の決定的な代役にした。外部AI・Dockerは使用していない。

| 介入順序 | 実測結果 |
|---|---|
| 元Fileを別名へ移動し、同Pathへ別世代を作成してから照合 | 所有照合falseとなりunlinkせず、別世代Fileを保全した |
| 元Fileの照合成功後、unlink直前に上記置換を実施 | 既に得た一致結果はtrueのままで、Path指定unlinkが別世代Fileを削除した |

`lstat`／`fstat`／UUID内容の照合と、その後のPath指定`unlink`は一つの条件付き削除ではない。照合回数を増やしても最後の照合後という区間は残る。単なるrenameや別名への退避も、同じPath対象を無条件に処置するだけならこの保証を埋めない。

全Callerがwx取得だけを使い、保持中のFileを奪取せず、Recoveryを全利用Process停止下に限定すれば、通常解放前に別の協調Callerが同Pathを置換する正当な経路はない。一方、同権限の非協調Processや清掃Toolが最後の照合後に置換する場合まで、異物を絶対に削除しない保証はNode標準のこの方式では成立しない。

人間へ戻す判断は、「Lock所在は正規プロトコルだけが変更する信頼境界とし、観測した不一致・不明は削除しないが、非協調の最終照合後置換への原子的保護は保証対象外」としてよいか、の一点である。採用する場合は書込み可能な利用側・検証Script・外部清掃も同じ境界へ含める。採用しない場合はwx単独・追加Guardなしという方式と要求が両立しないため、旧方式へ無断fallbackせず方式判断へ戻す。

この判断前に旧経路撤去や製品方式変更は行わない。今回の反証は主張範囲を確認するための限定実測であり、wx共通実装・回帰・移行の完了ではない。

一時反証ScriptのSHA-256は`a3739649464a077ba9fb82cad64585328720f60a9705cd3bb4e6ae86a70243d5`。各Caseの既知2 Fileとdescriptorはfinallyで回収し、Script撤去後にexact Root・非link・空Directoryを検査して非再帰回収し、Root不存在を確認した。過去保持物は操作していない。

## 13. wxの実装と汎用Storeの限定切替 — 2026-11-07

### 13.1. 採用した範囲と実装

人間は§12の信頼境界を採用した。全Consumer・Recovery・清掃は協調し、通常解放ではIdentity・Owner・Generation・File Identityを照合する。不明・不一致は削除しない。非協調Processの最終確認後置換は保証対象外だが、正規プロトコル内の稼働中置換を保証外へ追い出してはならない。単一Host・ローカルFilesystemに限定し、共有Filesystem／複数Hostを将来対応と推定しない。

着手前に排他・Filesystem・保存利用側の独立整合確認を実施し、初期化前の取得参照、fd終了不明、親Directory、旧回復Callerの撤去までを照合した。今回の完結単位は共通wx処理と汎用Storeの保護対象一括切替であり、全Lock Scopeの移行ではない。製品稼働の有効化は行わず、既存Process・保持物には操作していない。

| Owner | 今回の処置 |
|---|---|
| Lock `src/file.ts`／`types.ts` | 既存Directory・固定名・技術Identityを受けてwx取得。取得前のOwner／Generationと、取得後のFile／親Directory実体を参照へ保持。EEXIST非削除。初期化失敗はFile残存とfd終了確認を区別。通常解放は照合→close→再照合→固定Fileの`rmSync`（非再帰・forceなし）→元実体不存在の確認。正当な次世代は削除しない |
| Domain `storage/root-and-lock.ts` | Root／Path検証は維持し、汎用Storeを共通wxへ直接接続。Kernel／Proof／回復義務生成・オンライン回復の旧体系を撤去。旧清掃義務が残る場合は読取り拒否だけで保全。親Directoryは実CallerのStore Ownerが準備済みであることを要求し、Lock取得からDirectory作成を撤去 |
| Domain公開入口 | `observeFilesystemStoreLockOwnerAbsence`、`recoverFilesystemStoreLock`、Proof型を撤去。空・旧形式・未知Recordを新形式に変換・回収しない |
| Access Management | 全Reader／Writerが使用する`locked()`の自動回復・再取得を撤去。元の保存結果・一次失敗と解放不明、取得参照の相関を維持 |
| 旧endpoint | 本番Callerがなくなった2 Sourceと取得API・型を撤去。独立Sourceコピーの実Process試験をwxへ接続 |

実CallerはAMとAI設定の2箇所で、いずれも既存専用Root直下のLockを使う。未準備の下位親を勝手に作らない。Directoryなしの入力は変更前に拒否し、取得UUID故障では実ModuleでDirectory作成・wx取得・業務処理0を確認する。Process UUID／Generationは相関値であり、生存証明やFencing Tokenではない。

### 13.2. 試験の置換と維持する観測

旧OS Guard／PID Proofを前提にした汎用Storeのオンライン回復試験とWorker構築試験は、新方式の保証へ転用しない。Root／Path／偽Root拒否、通常操作、元例外、未知・空・旧Recordの停止、旧義務のみの停止、世代置換の保全、解放不明の結果相関は現行試験へ接続した。正規Process間の競合・Crash・停止下再入場はLock ITが所有し、AI設定とAMの保存ITで利用側を結合する。過去の試験Evidenceは当時の保証の履歴であり、削除した処理の成立済み表示を現在へ残さない。

AMの試験は故障注入を実際の固定File削除へ接続し、復元後も残存で停止することを先に確認する。明示再入場の処置は既存の試験fixtureへ集約し、自己生成Root、Record、既知の親／子PID、Generation、File実体を検査してから行う。子ProcessのCaseはjoin済み、親の同期保存もreturn済みで、その他の利用者はいない有限試験である。PID不存在による製品の自動回復や、新しい本番Adapterではない。初回設定・通常認証・鍵交換・Readerにも同じ停止契約を適用する。

Windowsで保持中親DirectoryのrenameがOSからEPERM／EACCESで拒否されたCaseは、差替え成立とは表示せず、拒否と元取得の保持・正常解放を確認する。別Fileへの置換成立とIdentity不一致による非削除は別Caseで観測する。

### 13.3. 未完了の切替範囲

CurrentState、CoordinatorのDocker状態／Decision、共有Home、Host世代と検証Scriptはまだ旧OS契約を使う。EI／Topic／Meetingの既存wxも共通処理への全面接続とは別に追跡する。残るScopeごとにReader・Writer・Recovery・清掃を同時切替し、共有Homeの共通所在とHostの失効・終了契約を上位へ対応付ける。旧・新Processを実資源で並走させない。未使用の旧入口は本番・検証Callerの確認後に撤去し、全Consumer接続後に旧Worker／Supervisor・起動／終了監視を撤去して最終3 Sourceへ収束させる。現行8 Sourceは移行中の構成である。

手動回復と有効化の手順・表示理由は[Runtime Workflow](../../../19_Workflows/01_Coordinator_Runtime.md#wx-lock-stopped-recovery)、現在のAPIと信頼境界は[Lock設計](../../../06_Architecture/Details/lock/01_Architecture.md)を正本とする。実AI・Docker・過去保持物は操作していない。

### 13.4. 限定段階の確認結果

| 検証 | 結果と主張範囲 |
|---|---|
| Lock全4 Suite | 35件成功。wx所有照合・初期化故障・通常解放・Crash残存・停止下再入場・Sourceコピーと、未切替OS契約の既存回帰を含む。全35件が新wxの試験という意味ではない |
| Domain汎用Store／公開境界／AI設定 | 32件成功。Directory未準備の拒否、実Module UUID故障時の変更0、旧公開API不存在、既存の保存・公開・清掃故障を確認。Domain全試験の再実行ではない |
| Access Management通常入口 `npm test` | 書式・型・warning禁止lintと173件が成功。初回設定、通常認証、Reader、通常管理、鍵交換等の全通常Suiteを含む。実Hostの認証情報や本番保持物は使用しない |
| 静的確認 | Domain／AMのcheck成功。Lockは既存固定PA開発Toolと同版のformat・型・warning禁止lintを個別実行し成功。Lockの標準npm入口で依存取得をしたとは表示しない。台帳JSON読取りと差分空白検査成功 |

初回回帰では、旧削除Primitiveへの故障注入と、Crash後のオンライン回復を期待する試験が失敗した。実削除に注入し、残存での停止を確認したうえで有限試験の停止下処置へ置換した。Nodeの書込み専用wx descriptorを読もうとした初期実装も局所試験で拒否され、保持fdの実体とPath／Record照合に是正した。WindowsのLink権限不足は検査を緩めず、新品領域だけを使う通常権限の再実行で確認した。最終候補で前表の結果を得ており、先行失敗を成功へ読み替えていない。

限定独立レビューでは、公開境界試験の旧API期待と、UUID故障前のDirectory変更0の継承に指摘があった。期待集合を追従し、Lockからmkdirを撤去して実Callerと実Module故障注入を再照合し、再レビューは必須指摘なし。追加のAM fixture追従、固定FileのrmSync、旧endpoint撤去とSourceコピーも限定再レビューで必須指摘なし。全Scope・全体QAの完了とはしない。

今回の専用一時Root`.crdd/tests/wx-phase1-20261107-71bc2f08`は、全試験終了後にNode compile cacheだけが残ること、exact Rootの包含・非link・全配下の非linkを確認して回収し、Root不存在を確認した。各Suiteの自己生成Rootも自身の終了処置で不存在をassertする。既存保持物の名前走査・一括削除はしていない。

実Filesystemと実Module子を使用する新Store Suiteは`tests/integration/filesystem-store-lock.contract.test.ts`へ配置し、`RFD-IT-021`・台帳・Symbol・設計を追従した。旧UT Pathへ残して分類だけを偽装しない。既存`RFD-UT-006`の純粋なRoot Policy試験をこの移動で廃止したとは扱わない。移動後も同じDomain32件を再確認して成功した。

配置・台帳・現在主張の限定最終レビューも必須指摘なし。試験のModule mock記法は既存のNode下限向け記法へ揃え、該当8件も再確認した。今回の完了は汎用Store切替単位であり、§13.3の残Scopeを含む全Lock移行完了ではない。


## 14. 残るOS排他のwx切替と3 Source化 — 2026-11-07（検証継続中）

### 実装した範囲

CurrentState Reader／Writer／Recovery、共有Provider Home、共有Runtime状態／Decision、Host操作世代と検証Scriptを共通`acquireLock`へ接続した。旧Pipe／Worker／Supervisor取得・監視・ready往復・喪失通知と専用Process Sourceを撤去した。Lockの現行Sourceは`index.ts`、`types.ts`、`operations.ts`の3ファイル。旧方式fallbackや監視用の未完了Promiseは作らない。

共有Homeは既存ProviderHomes親Directoryと元64hex BindingでRepository横断の同じFileを使う。RuntimeStateは共有所在内の固定`docker-state.lock`であり、RepositoryとHome別のキーで分割しない。Host世代は対象Rootの親Directoryに置き、子Root清掃後まで同じ取得を保持する。通常の外部取消、DI Completion、保存順序と現在Ownerの照合は維持する。Crash時はFileが残り、停止下の明示処置なしに再入場しない。

### 是正と確認

| 対象 | 確認結果 |
|---|---|
| 共通Lock | 13件成功。通常解放、世代・Owner・実体差替え拒否、実子Process競合、Crash残存、停止下再入場、初期化／解放故障、独立Sourceコピー |
| CurrentState | 新2件成功。同じScopeの競合と、Crash後の残存による拒否を確認 |
| Coordinator限定 | 共有Home・共有Runtime状態・Host世代4件成功。Host清掃前保持検査と共有Directory初期化・診断回復の局所反証も成功 |
| Executor／DI試験 | Home事前確認2件、単独Host接続1件、CLI有限下位接続2件、DI有限技術清掃15件成功。実AI・Docker・実認証Homeは使用しない |
| 静的確認 | Lock型検査・lint成功、Domain／Executor／Coordinatorの型検査成功、Runtime／Task Traceability確認成功、差分空白検査成功 |
| 広い回帰 | 完了待ちまたは是正中。Executor初回113件中3失敗は旧Lock代役の返値形式で、代役追従後に該当3件を再確認して成功。Coordinatorの旧能動喪失通知待機は新契約へ置換。Task結合とHost局所161件は通常実行159成功・2失敗、リンク作成許可のある再確認では160成功・SHA-256理由分類1失敗が残る。Domain全回帰も別途失敗切り分け中 |

独立確認は、共有Runtime状態のキー不一致とHost破壊的清掃前の保持確認欠落を検出した。固定Fileへの統一と既存の通常世代確認へ是正し、限定再レビューで追加不備なし。失効検出後はRootを削除せず、元回復記録を保全する。旧Supervisorだけの試験を新保証の成功根拠へ流用しない。

### 未完了と完成主張の境界

- nullableな取得橋渡しは取得結果へ置換した。CurrentState、共有Home、共有Runtime状態、Host操作の利用側は競合・初期化残存・descriptor終了不明を区別し、既存の停止／手動回復表示へ投影する。CurrentStateは既知の取得世代だけを非Authority参照にし、秘密Pathや部分Recordからの世代推測は公開しない。marker清掃も元理由を保持する。
- Domain全回帰とCoordinator全回帰の失敗・未実行範囲を閉じ、利用側の停止／再入場試験と文書を最終確認する。
- EI／Topic／Meeting／短命操作の既存File Lockを、すべて共通実装へ統合済みとは扱わない。
- 現在は全移行完了・全体QA Passではない。実稼働の切替、実AI、Docker、過去保持物への操作、Commit／Pushは実施していない。

現行契約の正本は[Lock設計](../../../06_Architecture/Details/lock/01_Architecture.md)、停止下手順は[Runtime Workflow](../../../19_Workflows/01_Coordinator_Runtime.md#wx-lock-stopped-recovery)。以前の§13は当時の限定段階の検証履歴として保持する。

追加確認では、Lock Ownerを試験台帳の探索・実行Profile・結合経路へ登録し、旧UT→ITの参照と旧Windows専用Profileを追従して台帳26件が成功した。CurrentStateの旧「Crash後直ちに再取得」試験は停止下のexact File処置へ置換し、Readerはwx所在だけを準備してDomain状態を初期化しない契約との対照2件が成功した。共通Lock13件、CoordinatorのScope・共有初期化・清掃前拒否20件も再確認して成功した。Domain全回帰は失敗しており、全体Passではない。Coordinator全回帰は旧通知待機を検出して中断し、撤去後の限定回帰へ切り替えた。失敗搬送と残る回帰の終了までは完成を表示しない。

今回専用の`.crdd/tests/wx-final-20261107-cd1095b7`は、関連する試験の終了・中断後、元exact Path、非link、子が既知の空Directory二件のみでFileなしであることを確認し、非再帰で回収してRoot不存在を確認した。過去保持物の一括走査・削除は行っていない。各Suiteの今回生成物は、そのSuite自身の終了処置と未解決状態に従う。この専用Rootの不存在を、Repository内のすべての試験残存0という主張へ拡張しない。

### 失敗情報搬送の是正と再確認

CurrentStateの取得結果を既存StoreResultへ投影し、一般CRUD、履歴、marker処置まで固定理由と既知の非Authority回復参照を保持した。共有Home／Runtime状態／Host操作とExecutorも競合・初期化残存・descriptor終了不明を区別する。取得失敗では業務処理を開始せず、同Scopeの再取得を残存Fileで拒否する。WB／MCP全体を終了する新機構は追加しない。Coordinatorの既存poison判断はOwnerに残す。未知fdの再close・File削除・自動再取得を追加せず、明示回復は取得元を含む全関係Process停止下に限定する。

新しいwx自身のfsyncへ保存故障を誤注入していたCaseは、元の保存marker成立後へ注入点を限定した。取得後の親実体差で解放できないCaseは、未開始blockedではなくpublication未発行のunknownを期待する。検査を緩めず、旧nullable代役、削除済み関数のSource抽出、Domain状態とwx所在の混同だけを追従した。

再確認でLock13件、Domain通常434件、Executor通常114件、DI有限清掃15件、PA観測の合成結合128件、台帳26件が成功した。Domainの追加Host保存対照2件も個別成功した。型検査、変更Sourceの書式・警告禁止lint、Runtime／Task Traceabilityも成功。リンク作成を含む試験は今回のRepository-local新品fixtureだけを対象に権限を分けて確認し、EPERMを検査免除へ変えなかった。実Docker・実AI・既存認証Homeの試験ではない。

独立再レビューではmarker理由喪失と、Supervisor撤去後の古い現行契約説明を指摘された。元理由保持と同期wx／実体照合の説明へ是正し、局所再確認は必須指摘なし。Coordinatorの広い通常回帰は別途集計中であり、全体Passではない。SHA-256の専用事前拒否理由は、VCのRoot取得が先に未対応形式を拒否するため到達しない既存問題を確認した。実SHA-256 Repositoryでも同じ拒否となり、wxとは独立する。VC本番Sourceや検査を変更せず、試験の模擬値だけで成功にしない。

### 通常回帰終了と最終候補の境界

Coordinator通常回帰は1,732件で終了し、初回は成功1,593・失敗134・skip5・取消0、約99.4分であった。実Provider等の明示Gateを有効にした試験ではない。実行中・終了後に是正した試験を含む初回結果なので、この集計を最終候補の成功集計へ書き換えない。

失敗のうち、旧所在関数のSource抽出121件は現行関数へ接続し、該当Suite全128件の再実行で成功した。さらにProbeのCatalog依存不足、旧Reader注入名、Home取得代役の旧返値、cancel／abandon代役の旧引数、Runtime用fixtureの全Network誤定義、清掃throw時の肯定観測補完、旧Host Gateの分類、Native環境拒否fixtureの抽出名を是正した。本番の検査・期限・公開APIを変更せず、元のHome未解放・Container不存在未確認のassertionを維持した。影響6 SuiteのPortable再実行128件と、Native環境拒否ST1件が成功した。初回失敗の130件をこれらの再実行で確認し、全体の再実行成功とは表示しない。

旧Kernel試験はPortable wxの4件になっており、Host専用入口からだけ除外した。旧7件Gateを除いた現行Host閉集合は87件で、分類対照4件と台帳の関連2件が成功した。限定独立再確認では試験脱落・検査緩和なし。後続のSource抽出・代役・Identity照合の試験専用差分も独立確認で必須指摘なし。

追加で固定Node親子の取消2件を限定確認した。通常権限の先行実行では5秒以内の終了観測が不成立であり、成功に数えない。必要権限の再確認では終了・close・観測PID不存在が成立した。旧観測配列の期待は現行key／observationとSnapshotのname／dockerId／ownershipLabel照合へ移し、2件とも成功した。Dockerは模擬値で、実AI・Dockerは使わない。87件のHost Profile全体を検証済みとしない。

| 通常回帰に残る項目 | 現在の原因・影響 | Owner・再評価契機 |
|---|---|---|
| SHA-256専用事前診断2件 | VC Root取得が先に拒否し、専用の未対応形式理由まで到達しない。操作は停止するが診断が不足。VC本番Sourceは変更していない | VC／Coordinatorの診断境界。VCを再度整理する時、または全体回帰Passを求める前に評価 |
| 本番doctor／本番Operation生成2件 | 実Native Namespaceの選択利用者・descriptor前提が不成立。`terminal_selected_user_unknown`／`terminal_descriptor_mismatch`で拒否。helper終了確認あり、Filesystem Effectなし。成功代役へ置換しない | Platform Access／実行環境Owner。Namespace保護Policyの次の判断または専用実環境試験の前提確定時に評価 |

この4件はwxの安全条件を緩めて閉じない。Native保護PolicyやVC契約の変更は今回に含めず、全体QA Pass・公開準備完了は主張しない。今回の移行対象外であるEI／Topic／Meeting等の既存File Lockの全面統合も未実施である。

今回専用Root`.crdd/tests/wx-closure-20261107-68195a30`は関連試験終了後、元exact Path・非link・File0・空Directory階層3件・既知runner直下の子0を確認し、葉から非再帰回収してRoot不存在を確認した。各Suiteの自作物は各Suiteの終了処置に従い、Repository全体の残存0へ拡張しない。過去保持物は操作していない。Commit／Pushも実施していない。

### 別残件4件の最小是正 — 2026-11-07

上記4件を追加承認の範囲で是正した。前節の初回集計は履歴として維持する。

| 対象 | 原因と是正 | 維持した境界 |
|---|---|---|
| SHA-256事前診断2件 | 操作用Rootの拒否後にCapability経由で形式を読むため診断も失われていた。VCの既存読取り専用形式観測を再利用し、`getRepository` のblocked結果へ未対応形式理由を返し、Coordinatorへ接続した | SHA-1限定は不変更。SHA-256ではCapabilityはnull。config・Revision幅等が不整合なら一般拒否。新公開関数なし |
| doctor／Operation生成2件 | UTが制限Tokenや既存TEMPの保護状態に依存する実Native処理を呼んでいた。元assertionをHost Windows ITへ移し、適格ユーザー・今回専用のRepository-local TEMP・固定Native配布物で実行した | SID／DACL・祖先Handle・Native出所検査は不変更。既存Namespaceの修復・削除なし。正常系の代役化なし |

Host Runnerの閉集合は2件追加して89件となる。Portableでは実Native正常系を実行せず、搬送順序・失敗停止と試験自身の保全条件を確認する。台帳とSymbolを同じOwnerへ追従した。既存正常系2件は、元の結果assertionを維持したまま実Windows境界で成功した。

関連6 Suiteは、保全条件の有限反証追加後の最終実行で177件成功し、VCの実Git回帰は8件成功した。制限付き実行ではJunction作成とMSYS子Processの権限拒否が発生したため、試験物を新規Repository-local対象に限定し、必要な実行権限で再確認した。検査の削除・期待値緩和では閉じていない。Coordinator本番／試験とVCの型検査も成功した。

独立確認で、試験の子Process失敗後にも専用Rootを削除する点と、電子署名を観測していないのに「署名Native」と記載する点を指摘された。失敗・終了不明・未知物は削除せず保持し、正常終了後の既知空Directoryだけを非再帰回収する形へ是正した。名称は「検証済み固定Native配布物」へ修正した。保全条件の有限反証を追加した。

今回の実Native試験領域は、子Process正常終了、Rootの実体同一性、既知Namespace内の空、最後のRoot不存在を確認して回収した。過去保持物、実AI、Dockerは操作していない。Native製品Source、保護Policy、Timeoutは不変更。Coordinator全体の最終一括回帰や89件Host全件のPassは主張しない。Commit／Pushはこの追加作業では実施しない。

最終確認では試験台帳が438 Fileでvalid、台帳の契約回帰28件が成功した。Host／Portableの両Profile登録漏れも是正済み。Runtime／Task Traceability、型検査、対象Sourceの整形・警告禁止lint、差分空白検査が成功した。独立再レビューで製品・試験・分類・記録に追加指摘なし。これらは当初の4件を閉じる根拠であり、未実行の全体回帰や実AI・Docker E2Eの代替根拠にはしない。

## 15. File Lock群の共通化とPA残存機能の再評価 — 2026-11-07

### 範囲・判断・保持条件

人間の指示により、全体回帰の前に残るFile排他とPA残存機能を整理する。§8の「各File排他を当面残置」は今回の範囲について更新する。新しいRecovery、Store、Manager、監視、互換Readerは追加しない。実AI・Docker・過去保持物の操作、保護Policyの変更、Commit／Push、全体回帰は含めない。

変更は実装上の責務整理と、採用済みwx停止条件への追従である。Lock／Domain／EI／PAの設計を正本とし、型・試験・台帳と直接利用側を追従する。着手前に利用側の保持区間・回復・過去試験を読取り専用確認者と照合し、固定候補で独立技術レビューを行う。標準の準拠基準、Release、外部向け主張は変えないため、それらの全面監査は追加しない。

### Capabilityと新しい接続

| 既存の責務・根拠 | 現在の実装Owner | 維持・置換した検証 |
|---|---|---|
| EI Writerの競合排他、同一Event冪等、保存後不明・pending終了処置 | 共通Lockが取得・所有照合・解放、EIがScope・保持区間・保存結果を所有 | 旧200回待機を撤去。EEXISTは未発行で停止、retryAllowed=false。全Writer終了後に試験Callerが別要求を出す対照で冪等と異内容拒否を確認 |
| Topic／Meetingの改訂確認から保存・読戻し／削除までの排他 | 共通LockとDomainの既存withRecordLock | 既存`.ID.lock`の所在を維持。固定単一basenameとして大文字・先頭dot・既存最大ID長を許すが、区切り文字・`..`・Root外・実体不一致は拒否。一次例外を解放不明で上書きしない |
| 一時Operationの短い作成／再入場／終端更新、世代・根拠昇格 | Lock取得・保持・解放だけ共通Lock。業務文書・世代・Capability・根拠昇格はDomain | Lock専用active/released文書・staging・hardlink公開とPID不在の自動削除を撤去。業務文書の初回staging公開は維持。旧Lock工程だけの三Crash試験は、共通Lockのwrite/sync/close故障と残存・一回解放、Owner保持中処置0、停止下明示処置へ対応付け |
| PAのOS／PID・子環境とNative搬送 | OS／PIDは既存Node Owner、必要なOS差分はPA | 本番利用のないdescribeWindowsChildEnvironmentContractと2定数を実削除。固定記述のdeepEqualだけを退役し、実子環境・拒否時Effect0・Artifact前後照合を維持 |

旧Lock Recordは自動変換・自動削除しない。同じLock Pathに残ればEEXISTで停止する。新旧Processの実運用切替は、採用済みの全利用者停止下のGateを維持する。処理中のPID観測だけでLockを回復可能と判定しない。

### 独立指摘と是正

独立確認で、一時Operationの再入場staging処置が取得前、終端清掃が解放後にあった点を検出した。最初の変更前に取得し、Directory・業務文書・staging清掃と観測の後まで保持する。実子Processの清掃直前再入場はbusyとなり、文書bytes不変と最終不存在を確認する。既存Lockを保持した初回staging再入場も、staging bytes不変・canonical未作成を確認する。

追加で、staging清掃成功とLock解放不明の合成、取得初期化残存の搬送を是正した。清掃確認は必要な処置と解放確認のANDとし、一次理由と同じOperation参照を保持する。Lockのwrite/fsync故障では業務文書を変更せず同Scopeを停止する。資源と業務文書の清掃後にLock解放だけが失敗した場合、それらを再生成せず、既知のLock残存を明示処置して不存在を確認する。

### PAで残す必要がある範囲

残る各Sourceには本番または内部利用があり、未使用ファイルとして削除しない。SID／protected DACL／祖先Handle・Token、OS API由来所在、reparse tag、Job Object・Publisher照合はNode標準への同等置換ではない。機能別の利用先・外した場合の影響は[PA設計の現在範囲](../../../06_Architecture/Details/platform-access/01_Architecture.md#現在の残存範囲--2026-11-07)を正本とする。単なるSource移動や定数コピーでPA廃止を表示しない。これらを削るには別の人間判断が必要であり、今回は保護を保持する。

### 局所検証と限界

共通Lock14件、EI保存49件、Domainの関連5 Suite44件が成功した後、複合故障追加後の一時Operation24件を再確認して成功した（Domainの関連集合は45件）。PA Artifact／子環境8件とCoordinatorの実子環境・PowerShell・環境拒否5件が成功した。必要権限の新規Repository-local Git／link fixtureだけを使用し、実AI・Docker・旧保持物は使用しない。関連Packageと利用側の型検査、警告禁止lintを確認した。過去の全体回帰結果を、この最終候補の全体Passへ更新しない。

EI試験の初回故障注入がrmのoptionsを搬送せず、同runの自己生成Root二つの終了処置に失敗した。注入を現Primitiveへ追従し即時復元へ是正した。両exact Root（crdd-execution-store-I0R1uq／SZodY3）は今回の作成結果とRepository-local親・非linkを照合して回収し、不存在を確認した。過去保持物の走査・削除は行わない。

最終のSource独立再レビューは必須指摘なし。文書・PA利用境界の独立確認で見つかった公開API表の旧記述2箇所も是正した。台帳にLock→Domain／EI／Coordinator／Executorの利用側静的検査と契約試験を追加し、438 Fileでvalid、台帳回帰28件成功を確認した。旧Lock工程を模した試験代役名も実際の共通取得境界へ追従した。全体回帰はまだ実施せず、PA全廃・Native保護の撤廃・Release完了を主張しない。

## 16. 整理後候補の全体回帰 — 2026-11-07

人間の継続指示により、§15の整理後候補で通常全回帰を開始した。Coordinatorは既存Portable入口と同じNode引数・直列実行・Host Windows／Windows Process Gate除外を使用する。その他13 Package（Lock、Domain、EI、AI Adapter、Executor、DI、VC、PA、AM、MCP、Visual Preview、Workbench、Checker）は各既存test:runを順に実行する。Domainの既存通常入口にはHost Windows名のローカル保存試験も含まれ、そのまま確認した。実AI・実Docker・明示的な追加Host Gate・PT／LT・Nativeの新規Build／配布は有効化しない。PAの保護Policyと過去保持物は変更・操作しない。

開始前の全体静的確認は、40_Developの整形1,028 File、警告禁止Lint1,029 File、全Packageと追加設定の型検査、Coordinator Runtime／Task Traceability、差分空白検査が成功した。Lintの111件はinfoであり、warning／errorではない。Workbenchは共通typeRoots上書きではvite/clientを解決できなかったため、Package既存の型設定で再確認して成功した。型解決のためにSourceや検査条件は変更していない。

試験は今回新規のRepository-local一時領域へTEMP／TMP等を限定し、各Suiteの自己生成物と既存の終了処置を使用する。進行中・一部Package成功を全体Passへ集約せず、失敗・未実施・終了後不明を区別して結果を追記する。Commit／Pushはこの指示から推定して実施しない。

### 先行13 Packageの初回結果と最小是正

| Package | 成功 | 失敗 | skip |
|---|---:|---:|---:|
| Lock | 14 | 0 | 0 |
| Domain Model | 480 | 3 | 0 |
| Execution Intelligence | 85 | 0 | 0 |
| AI Adapter | 45 | 0 | 0 |
| Executor | 114 | 0 | 0 |
| Docker Isolation | 393 | 9 | 5 |
| Version Control | 84 | 0 | 0 |
| Platform Access | 75 | 0 | 0 |
| Access Management | 173 | 0 | 0 |
| MCP Server | 104 | 1 | 0 |
| Visual Preview | 12 | 0 | 0 |
| Workbench Server | 112 | 1 | 0 |
| Checker | 429 | 2 | 1 |

失敗数には親Suiteの失敗も含む。原因は7系統であり、初回結果を再実行の成功へ書き換えない。Domainの履歴故障注入をexact pending fd／renameへ限定し、同値保存の無変更試験はexact技術Lockの取得・解放と業務保存の変更を区別する。DIは試験用Lock代役の返値だけ現契約へ追従する。MCPは出版済みでもLock解放不明なら次要求401で停止し、元bytesと残存集合を保持する。Checkerの旧endpoint期待と、Host Suiteに対応しないQA関連を修正する。Workbenchは現Sourceから固定Bundleを再生成し、その1件をIndexへ反映して一致試験1件が成功した。製品Source・公開API・保護Policyはこの是正で変更しない。

独立レビューで、無変更試験の書込みopen禁止と、MCPの残存集合検査の補完を指摘され、追加した。関連回帰はDomain 41件、DI 73件、MCP 7件、Checker 11件が成功した。独立指摘後の最終Caseを含む再確認はDomain 29件とMCP 7件が成功し、読取り専用の独立再レビューで残指摘なし。型検査、対象の整形、差分空白検査も成功。今回専用の二つの再試験Rootは終了後にexact Path・親境界・非linkを確認して回収し、不存在を確認した。

Coordinator通常回帰は1,731件で終了し、成功1,726・失敗0・skip5・取消0、約74.3分、exit0であった。専用Rootの終了処置も成功した。今回の各Package初回結果と是正後の関連再実行は別runであり、全Packageを最終候補で一括再実行した結果へ合算しない。Sourceの安全判定・期限・保護Policyは変えていない。実AI・Docker・過去保持物は操作しておらず、実運用の全Process停止下切替を実施した根拠でもない。

Repository全体Checkerも別途実行したが、3,804件で不合格。内訳はリンク切れ3,787、アンカー切れ7、設計・品質集合等の不整合10。今回追加したLock詳細の登録・構造不足と変更トレース内の削除済み試験へのリンク3件も含む。この結果を通常試験の成功で相殺せず、既存全体の問題と今回追加分の是正を分ける。現時点で全体QA Pass・Release準備完了を主張しない。

## 17. 設計・品質登録とChecker差分の閉包 — 2026-11-07

### 対象と経路

§16の残件を人間の継続指示で処置する。基準はCommit `8640aff422042042fbe5adf71b8c192e167b11b0`、変更は採用済みwx契約の設計・品質接続、履歴参照と結果投影の追従である。実装の振る舞い、公開API、保護Policy、新ID／新Local Item、実運用の有効化、実AI・Docker・過去保持物操作、Commit／Pushは対象外とする。

着手前に各ARCH責務・QA-000006・詳細設計と台帳Parserを照合し、読取り専用の確認者へOwner境界の不足観点を渡した。固定候補で文書監査と不足／影響監査を行う。準拠基準・Release判断は変えないため準拠・Release全面監査を追加しない。

### 基準版との比較

今回専用のRepository-local新品領域へ基準Commitのローカルコピーを作り、現在と同じChecker実装・引数で検査した。外部通信・実AI・Dockerは使わず、比較用コピーはexact親境界・非linkを確認して終了後に回収し、不存在を確認した。過去保持物は操作していない。

| 判定単位 | 基準Commit | 是正前候補 | 今回の処置 |
|---|---:|---:|---|
| リンク切れ | 3,773 | 3,787 | 増加14件。退役した試験への履歴リンクを固定Commitへ接続。未Commitの作業中候補1参照は退役履歴のコード表記へ変更し、現行根拠を§15〜16へ示す |
| アンカー切れ | 7 | 7 | 今回差分ではない。未是正として保持 |
| 設計・品質集合等 | 7 | 10 | 増加3件。Lock領域の登録、詳細設計契約、Quality領域接続を追従 |
| 合計 | 3,787 | 3,804 | 指摘code・Path・messageの比較で追加17・解消0を確認してから是正 |

是正後のCheckerは3,787件で、今回追加した設計／品質接続と退役Path参照の指摘は0。残る指摘の内訳は基準と同じである。基準以前のリンク3,773・アンカー7に加え、既存Qualityの詳細領域→Goal、Goal→Local Item、Local Item集合、件数2箇所、Source条件、外部境界段階の計7指摘が残る。これらを本作業の成功や単体試験で解消済みにしない。

### 編集対応と保持した意味

| 項目 | 正本・追従先 | 処置・変更しない範囲 |
|---|---|---|
| Lockの技術責務 | Lock詳細、詳細設計Map | 既存ARCH-000004／006／008／011／013／018の技術断面へ接続。Root発見・認可・保存CAS・Recovery判断は各Ownerに維持 |
| Quality導出 | Lock詳細、QA-000006、Quality Integration | `lock.cooperative-file-lifecycle`を既存ERB-IT-003へ明示接続。各OwnerのScope・業務結果は元の検証項目に維持し、新義務や全体Passを追加しない |
| Source管理情報 | Lock Symbolとoperations Header | 実装と無関係なARCH-000015を上記6断面へ追従。実行本文・公開集合は不変更 |
| 履歴参照 | CHG-000001等の退役試験リンク、当変更記録 | 基準Commitに実在するSourceを固定参照。当時の結果・採用判断・試験名を現版へ書き換えない |
| 最新結果 | §16、PROJECT_CONTEXT | Coordinator完走と関連再試験を区別して投影。全体QA未合格・未実施範囲を保持 |

### 再確認・独立監査と残件

共通Lock14件、Architecture本文9件、Quality Definition3件、横断Symbol／台帳11件の計37件が成功した。全体整形1,028 File、変更Headerの警告禁止lint、Lock型検査、差分空白検査も成功。これらは文書・管理情報への追従確認であり、§16の各Package回帰と重複して全体成功件数へ加算しない。今回専用の再試験Rootは終了後にexact Path・親境界・非linkを確認して回収し、不存在を確認した。

別の新品比較Rootで基準Commitと最終候補を同じCheckerへ通し、code・Path・messageの全出現を整列した指摘集合のSHA-256が双方`72F4E8C7A270C73F8BDB38CB042BC26FF01B04E7F664A8AB69174C244D7B73C3`で一致した。双方3,787指摘、exit1であり、追加0・基準との差分0である。比較Rootも同じ範囲検査後に回収し、不存在を確認した。

残るリンク指摘は主に過去CHGの当時のSourceへの参照である。例としてCHG-000017は231、CHG-000001／002／004／005／007／010は各228件。現行UI参照にも退役した送信同意・端末Sourceへの参照が残る。アンカー7件はQuality Centerの旧退役節2件、CHG-000057の旧UI／SPEC／検証／Workflow節5件である。既存Quality7指摘と合わせ、現在の正本と履歴固定参照を分ける後続の文書整理対象とする。コードやChecker条件を緩める対象ではない。

固定候補の文書監査・不足／影響監査で、Lock行が表から分離していた2箇所、QA-000006閉包の入力元一覧、現在地から最新根拠への参照を指摘された。全監査結果を統合し、意味・Local Item・件数を変えない修正案を両監査へ再提示して整合確認後に是正した。Scope・Policy・実装の振る舞い・公開APIは変更していない。

空行だけを指定した初回の機械適用はMap先頭へ誤適用され、独立再監査と隣接行assertで未解消を検出した。先頭空行を復元し、Workbench／Lock両行を一意な編集キーとして再適用し、両MapのLock行exact1件・直前行との表列数一致・QA入力元を読戻し確認した。新しいChecker規則は作らず、既存の編集一次キーと適用後照合の規律で是正する。

補助の通常権限再試験ではJunction作成がEPERMとなり、11件中1件不合格だった。このrunを成功へ書き換えない。自己生成Rootは試験終了処置後にexact Pathの不存在を確認した。TEMP等を新品Repository-local領域へ限定し、既存の必要権限で別runを行い11件成功、専用Rootも境界・非link確認後に回収して不存在を確認した。検査やPolicyは緩めておらず、通常権限での成功とは表示しない。

全是正後のChecker再実行も3,787件・exit1で、上記の基準指摘集合SHA-256と一致し追加0だった。この結果を共通入力として、文書監査と不足／影響監査は今回の差分に限定してPass、残指摘0と判定した。現在、この範囲で追加の人間判断は必要ない。既存3,787件、全体QA、実運用切替、Releaseの合格は意味しない。Commit／Pushは実施していない。

<a id="long-lease-common-lock-change"></a>

## 長期Leaseの物理排他統合 — 2026-11-11

状態: 実装と限定回帰・独立再レビューを確認。人間承認によりCoordinatorの既存回復経路を維持し、mkdir取得・保持・通常解放だけを既存共通Lockへ寄せる。業務LeaseのIntent・Owner世代・Queue CAS・証拠はCoordinator／Domainの現Ownerへ残す。上段の先行段階にある長期Directoryの対象外記述は当時の範囲である。全体回帰・実運用切替・Releaseの成立は主張しない。

着手前に基準ad6b9f975の取得・解放・Owner喪失回復、PRL-IT-005／012／013の実Process・故障試験、Domain候補処理と共通Lockを照合し、独立の読取り専用整合確認を行った。変更分類は技術排他の置換と回復競合の局所是正。利用側・試験・Architecture・QAへの伝播、限定回帰、Source／保存境界の独立レビューを行う。準拠基準・Releaseを変更しないため、その全面監査は対象外。全体回帰・実AI・Docker・過去保持物を操作しない。

| 基準Capability | 新接続と保持条件 |
|---|---|
| 取得Intent→物理取得→取得確認 | 同じ所在・Identityのwx取得へ置換。取得失敗・confirm失敗では同じ回復IDを保持し、取得descriptorを閉じFileを保全 |
| 保持・通常解放 | 元共通LockのassertLive／releaseを利用。解放Intent・不存在・終了証拠の保存順は維持 |
| Owner喪失回復 | reserve後、settleの既存短期保存Lock内でfresh Root／Queue／Intent／世代／終了証拠を全照合し候補構築。その後Coordinatorの固定同期回収→明示不存在→同じOwnerで保存。外側の先行削除は撤去 |
| 取得途中の回復 | 取得予約時の不存在確認、唯一のacquisition_reserved、同じOwner／世代／回復ID、明示Owner不在を一体の協調根拠とする。正規固定親のbounded通常単一Link Fileをcaptureし、同じ保存Lock内でstat＋内容Hashを削除直前に再照合。任意残存の一般adoption・旧Directoryのfallbackは行わない |
| 保存失敗・再入場 | 元Intent／回復参照を保全し、新取得を拒否。二回復者の後発はfresh不一致で物理処置0。非協調Processの最終照合後置換は既存と同じく保証対象外 |

回復は共通Lock自体の機能へ追加せず、Coordinatorの既存プロトコルとDomainの短期保存排他で成立させる。新Manager／Registry／Store／監視機構は作らない。旧方式との並走を実運用で許可せず、今回の実装・新品fixture検証を既存保持物の移行許可へ拡張しない。

### 限定検証と是正結果

| 観点 | 観測・処置・限界 |
|---|---|
| 取得・保持・通常解放 | 共通wx／assertLive／releaseへ接続。confirm例外を含む失敗では元Fileを保全してdescriptor終了を試行し、同じ回復IDへ接続。終了確認不能は不明として保持 |
| 独立レビュー4指摘 | 初回保持拒否／Root例外時のdescriptor終了、2KiB観測の実上限、従来の合法な長ID／連続dotの受理、新契約の明示Tuple化を是正。Sourceと契約・試験・文書の再レビューは必須残指摘0 |
| 共通Lockの最小追加変更 | API・3ファイル構成は不変。単一ASCII名255文字まで、先頭二連dot・区切り文字・固定親逸脱は拒否。途中dotをTraversalと誤認せず旧Leaseの有効IDを維持。最終再確認の共通Lock14試験成功（先行集計の15件を訂正） |
| 初回の既存限定回帰 | Coordinator保存・LeaseとDomain候補の49件は46成功・3失敗（約24分）。このrunを成功へ書換えない。失敗は親移動をWindowsが拒否したfixtureと、旧Kernel向けの解放故障注入2箇所であり、現実境界へ試験を追従 |
| 失敗3件の再確認 | aliasケースは元実体不変・正常解放を確認し、OS拒否でalias未成立と明示。旧解放注入は保存markerのstate.lockでなく、実際の `.crdd/current-state.<64hex>.lock`へ固定親付きで実施。最新版のOwner喪失／取得解放2ケースとaliasケースは成功。関連する取得直後停止・読戻し故障・清掃失敗3ケースも成功 |
| 新規反証5ケース | 遅延Bの処置0と新Owner保全、同期処置／不存在不明、長IDの通常解放・実子Process終了後回復、解放前拒否のEBADFとexact回復参照、opened前照合と2049B bounded読取りを確認。試験組立ての初期不整合・広すぎるread注入も是正後に成功。複数runでの確認であり、単一runの全件緑としない |
| その他の限定確認 | Domain候補8、Domain保存Root4、Coordinator Core独立6は成功。台帳409 valid。書式・Lint・Domain／Coordinator strict・tests／Workbench／MCP型検査を確認。Lockは既存Coordinator依存のtypeRootsで型検査し、依存再取得を行わない |
| 別の既存失敗 | Domain公開境界13試験のうち12成功・1失敗。未変更のindex.tsにあるcreateLocalPrincipalIdと、未変更の公開集合試験の期待値が不一致。今回のLease変更によるExport増減ではなく、無関係な公開面の採否を本変更で決めない |
| 終了後条件 | 各fixtureがexact Rootを回収。全実行終了後、今回日のcrdd-project-durable-* Root残存0を確認。過去の残存は読替え・移行・削除しない。実AI・Docker・全体回帰は未実施 |

失敗Leaseはdescriptor終了を試行して元Fileと参照を保全し、同じinstanceの再利用でなく既存Owner喪失回復へ接続する。回復の成立条件自体をPID不在だけへ緩めない。全Consumerの実運用移行・停止下切替・他領域の既存QA不整合は別Gateとして残す。

### 公開集合試験の追従是正 — 2026-11-11

上記で区別したDomain公開集合試験の既存失敗を、人間の指示で追加是正した。既存の主体分離で公開済みの`createLocalPrincipalId`と`isPrincipalId`が、実行時集合・型を含むSource集合の期待値から漏れていた。Coordinator詳細設計の主体契約とWorkbench入口／Coordinator判断処理の本番利用を確認し、両期待値へ2関数を明示追加した。製品Source、公開API、保存形式、集合の完全一致検査は変更しない。公開境界13試験とCoordinatorのローカル主体1試験は成功し、書式・警告禁止Lint・差分空白検査も成功した。読取り専用の独立レビューは指摘0で、既存契約への追従と完全一致検査の維持を確認した。初回の既存失敗記録は保持し、今回の成功で全体回帰の成立を主張しない。

Commit前の再確認では共通Lock14・Domain Lease候補8・Domain公開境界13の計35試験が全件成功し、DomainおよびCoordinatorのstrict／tests型検査、差分空白検査も成功した。Coordinator型検査の初回指定は存在しないtsconfig.jsonのため起動不成立となり、既存の正式設定2件へ訂正して確認した。回復確定入口の全利用元と差分全15ファイルを再照合し、追加のコード是正は不要だった。全体回帰・実AI・Docker・過去保持物の操作は行っていない。
