# Docker隔離の詳細設計

## 退避Root単位のNode削除 — 2026-11-11

固定退避Directoryは中身を選別せず、保存済みRoot実体・親・現在source・廃棄許可と既存の非使用条件を確認して、Node.js標準の再帰削除で回収する。PA単一entryのNative観測・特殊Socket識別・子ごとの実体照合は撤去する。公開IFと保存Schemaは不変で、削除開始後の取消は処理の完了・失敗を待ってunknownを返す。Root不存在を後観測できた場合だけ回収確認とする。個別取消・件数／深さ上限・全子の事前拒否は現行保証から外す。保証差・局所実測・未実施範囲は[今回の変更記録](../../../99_Roadmap/Changes/CHG-000082/platform-access-source-structure.md#退避root全体の標準削除と単一entry-native退役--2026-11-11)を参照する。

## Desktop Helperの退役と公式CLIへの接続 — 2026-11-10

Desktop再起動・修復は、PAの専用Native Helperを使用せず、既存のCLI検証・子Process所有処理と公式`docker desktop`操作へ接続する。Rootの公開関数は増減しない。停止は同期`stop --timeout 30`の正常終了と`status --format json`の停止状態を別に確認する。起動は`start --detach`の受理後に既存Engine待機へ進む。停止のCLI待機35秒、状態観測5秒、元CLI終了確認5秒、既存Engine待機期限を有限に保つ。未対応CLI・非0・取消・観測不能を成功へ補完しない。

検査した固定Desktop Pluginを直接起動し、ユーザー設定のPlugin探索に実行先を委ねない。Engine CLIと同じ署名・内容Hash・操作内実体検査を共用するが、そのHashを修復記録へ追加しない。全Desktop／Backend Processの不存在、全Directoryアクセス終了、Nativeの実行物群・deny-share Handle・Job Object・SID Mutexと同等の保証は主張しない。Backend停止は既存のWSL登録実体の稼働一覧観測であり、Process不存在やAPI接続失敗ではない。初回・失敗起動後とも、Directory処置の直前にEngine・Desktop status・WSL Backendを必要条件として再確認する。独自の強制終了fallbackは設けない。

Directoryは既存の固定対象、Link拒否、元実体・退避先実体の前後照合、元Path再出現の拒否を維持する。部分処置・不明・終了未確認は既存checkpointへ保持する。修復記録からNative所有Hash・Helper実行物Hash・重複Scope Hashを除き、Identity v2はnonce・Operation ID・Repository binding・consumerと既存の内容完全性Hashで相関する。nonce由来の固定退避名は維持する。旧Identity v1や旧9処置を自動読替え・移行せず保全する。

Desktop排他は共通wx処理を用い、設定済み`desktop.userDataDirectory`直下の`.crdd-docker-desktop.lock`、Identity `docker-desktop:shared`とする。上位のstate排他→Desktop排他の順で取得する。CLI終了不明ではLock Fileを保全し、取得descriptorだけを閉じる。これはcleanup成功ではない。Crash残存は自動回復せず、全利用Process停止下で対象を確認する既存の手順へ戻す。

運用条件: 同じDesktopを扱う全Consumerは同じ基点を使用し、未完了修復・未処置の退避物がある間は起動設定の基点を変更しない。別基点への変更検出用の記録・Hash・Registryは追加しない。旧Native方式とwx方式を並走させない。実Dockerの停止・起動・退避と対象CLI版での検証は別Gateであり、有限代役の試験成功から実境界の成立を主張しない。

## 共通設定と任意Desktop管理設定 — 2026-11-10

`IsolationSettings`は共通の`windowsDirectory`／`userHomeDirectory`と、任意の`desktop: { userDataDirectory }`を持つ。`userDataDirectory`はユーザー単位のアプリデータ基点で、現在のWindowsでは上位が確定したLocal AppDataを渡す。Docker固有の相対配置・Scope導出はDIが所有する。他OSで同じ相対配置が成立するとは仮定しない。

`initializeIsolation`は指定された所在だけを実体確認し、入れ子もコピー・凍結する。Desktop設定省略時も通常設定は成立する。明示した不正Desktop設定は初期化全体を拒否し、無言で省略しない。`desktop`を渡しただけで起動・再起動・修復しない。再起動・修復は設定欠測を固定例外`docker_desktop_settings_unavailable`で通知・Artifact観測・Native取得より前に拒否する。Engine／backendの既存読取りは維持する。

修復・修復後のDirectory観測・回収は、既存公開入口のsettingsから同じ基点を搬送する。PAのKnown Folder再取得は行わない。単独観測は設定不成立時null、回収はnot_issued／unknownを維持する。実体・Scope・元checkpoint・保存通知・取消・終了と回収条件は維持する。上位所在設定を信頼する変更であり、Native Known Folderの独立取得と同等とは扱わない。PA自身のNative保護・Protocolは変更しない。

選択は上位、選択された環境の技術処理はDIが所有する。通常実行にDesktop管理設定を必須化しないが、現在のWindows専用初期化・固定Engine接続は維持する。Linux／macOS、Engine単独接続・起動／修復は今回実装せず、未対応とする。新しいruntimeフラグ・Manager・Store・公開関数／型は追加しない。

DI内部関数は技術責務の短い名前で扱う。環境観測はobserveBackendState／observeDockerEngine、再起動はrestartDesktop、修復はrunRepairSession→executeRepairSteps、修復DirectoryはobserveRepairDirectories／cleanupRepairDirectory、実行物検証はEngine CLIと固定Desktop Pluginの共通Trust処理とする。純粋な検証はdecodeRepairCheckpoint／validateRepairCheckpointTransition等とし、同名だったDomain保存検証の宣言とは区別する。DIを使う試験のSource切出し・VM注入も同じ宣言名へ接続する。RootのinspectDockerEnvironment／restartDockerEnvironment等とinitializeIsolationの8公開関数を提供し、内部関数・依存差替え入口は追加公開しない。改名に伴って保存形式・IPC識別子・固定TrustのHash入力・処理順序・期限・取消・回収条件を変更しない。

WorkingDirは、要求で明示したパスを優先し、未指定時だけImage既定値を使う。取得済みImage構成でWorkingDir項目が省略されている場合は空文字既定として扱う。Container側のWorkingDir欠測・null・undefined・不正型を空へ補完せず、文字列の完全一致を要求する。Image側の明示undefined・null・不正型も、既定値として利用する場合は拒否する。非空パスの大小文字・末尾区切り・別パスを同一視せず、起動設定・Timeout・回収条件・公開IFは変更しない。

Commandは実行意味で照合する。要求argvが空でImage既定Cmdも省略・null・空配列の場合に限り、Container Cmdのnull・空配列を同じ「追加引数なし」と扱う。Container側のCmd欠測・undefinedや不正型は空へ補完しない。非空のImage既定Cmd又は明示argvは、文字列配列の全値・順序・長さの一致を要求し、明示argvをImage既定値より優先する。Entrypoint・Image・起動設定・Timeout・回収条件は変更しない。ImageのCommandを追加／変更して照合を通す方式は採らない。

Tmpfsを要求していない場合、取得に成功したHostConfig内のTmpfs項目の省略、null、空Objectを未設定表現として扱う。Docker APIのomitemptyに対応するものであり、Tmpfsを追加して実行する変更ではない。HostConfig全体の欠測・取得失敗は拒否し、Tmpfs要求ありの場合の項目省略・null・空設定、要求していないTmpfsの追加も拒否する。認証確認ContainerのtmpfsBytes:nullと--tmpfsを付けない構成、Timeout及び回収条件は維持する。

実行前の完全構成照合は、一致ならnull、拒否なら最初に拒否した項目の固定理由を返す。Image、User、TTY／stdin、RO root、特権、Capability、Device、SecurityOpt、Init、Entrypoint／Command／WorkingDir、環境、Network、Mount及びTmpfsを区別する。Mount元は確認不能と実体不一致を分離する。観測不能を一致と扱わず、既存の検査順・条件・Timeout・回収照合は変更しない。理由は既存IsolationExecutionResult.failure.reasonからExecutorのisolationFailure.reasonへ搬送し、新しい公開関数・型・通知は追加しない。固定理由に期待値・実値・Path・環境値・例外本文を埋め込まない。

作成応答の完全64桁実IDを同じSnapshotへ保持した後、onCreatedを実体・構成検査より前に待機通知する。これは作成Receiptであり、構成検査成功や現在存在の証明ではない。応答後取消でも通知を省略せず、通知後に取消又は検査拒否なら後続実行を止める。通知拒否でも内部の元IDを失わず、既存の条件で回収する。実行前のIdentity・Image・構成検査、必要通知の待機、Process終了確認及び全Timeoutは変更しない。回収時の再発見を表すonResourceIdentifiedは、この作成Receiptの代用にしない。

## 技術入口への収束と現在の移管範囲

乱数のBuffer／exact長検査、Providerに対応する資源名の生成、認証Home環境の構成はExecutorの準備責務へ移す。DIでは三関数と戻り値専用型を撤去し、Rootへ公開しない。DIのRequest捕捉・資源Identity文法・固定Image・Mount・Processの技術検査は維持し、上位が生成した値を無検査で信頼しない。固定資産とDIの一般的な入力検査はDIに維持する。CRDD固有の五資源名・Label・Digestの開始前検査は、生成OwnerのExecutorが所有する。用途固有のinit条件はExecutorへ移し、既存の適用条件を維持する。

共通通知はonObserved(step, result: IsolationCommandResult)で元観測・elapsedMs・errorCode・classification・exitClassを一つの不変結果Objectとして渡す。onCompletedも同じ包絡を使用し、その時点では元観測が非nullである。DIが同じ元観測から一度だけ生成し、上位は再分類しない。観測通知と完了通知の時点差・同期void契約は維持する。分類の優先順、Receipt更新→同期通知→Process終了確認→技術失敗判定の順序は維持する。nullはdeadline、出力超過はSignalより優先し、終了値分類はSignalを数値終了より優先する。固定エラー分類はこれらとは別軸で、相互に書き換えない。分類二関数のRoot公開は撤去するが、内部の純粋判定と有限試験は維持する。 例外分類もDI内部に限定する。有効Preparedの開始時再検証はCompletion内のEffect前に行い、失敗を同じIsolationExecutionResult.failureで搬送する。一回使用のtakeとforeign Preparedの拒否は同期で維持し、二重使用を未開始成功へ変換しない。

回収・照合の低位10値と、外部製品利用のない関連14型はRootから除去する。回収configのIdentity・CLI・取消・実体照合・出力上限の正本は内部に維持し、共通入口から同じ実装へ接続する。createDockerResourceRecoveryExecutorは製品で使わない無処置guard付きFactoryだったためtests/support/cleanup.tsへ移す。共有createRecoveryExecutorはOperation Factoryの本番経路が使い続け、Rootへは公開しない。検証は同じ低位実装へ明示接続し、mock登録後に必要なModuleを読み込む順序を維持する。

環境操作の公開はinspectDockerEnvironment／restartDockerEnvironmentへ集約する。CLI環境三構築、出所・実体観測／Trust記述四操作、Directory Identity、backend観測、低位restart／repair組立て、Engine二観測・待機と待機定数、Directory Lock観測の合計16項目は内部実装とする。本番利用の認証環境構築はこの単位で削除しない。技術処理のコピー・新Wrapper・新subpathは作らず、有限検証だけを元Ownerへ明示接続する。戻り値に必要な既存型は一括削除しない。

完成条件は用途別Lifecycleの撤去であり、公開関数の数だけではない。認証・Attempt・ProbeはExecutorが用途固有条件をIsolationRequestへ投影し、DIは同じprepareIsolation→executeIsolation→runIsolationを使用する。DIの実行分岐はcontainer／network／directory、interactive／captured／detached、create／connect／run等の技術条件に限定する。Executorは必要なシナリオ順序を指定し、DIは依存参照・要求順序の妥当性、固定argv、Intent／Receipt、終了と回収を所有する。今回、要求列の自動並替え・用途推定・安全制約の開放は追加しない。

環境二操作はdocker-desktop/operations.tsが所有する。inspectDockerEnvironmentはbackend→Engineの同期逐次観測、restartDockerEnvironmentは明示modeだけで既存restart／repairへ接続する。元input・Signal・通知・Promise・技術結果／例外を再構築せず、新しい待機、観測、状態、暗黙修復を追加しない。DockerEnvironmentRequest／Status／Resultは同じ責務のtypes.tsを正本とし、ExecutorはDIの関数を直接再exportする。

静的構成はimage/assets.tsのdescribeIsolationConfiguration(provider)が所有する。固定Assets・Image内配置・Proxyの固定ImageとPortだけを返し、追加Hostや完成Policyを返さない。引数なしでは既存の固定Probe基盤metadataを返す。Filesystem・Engine・Image存在・認証・実行許可は観測しない。値契約はimage/types.tsで明示する。root configuration.tsは撤去し、中継Wrapperや新しい初期化・Cacheは置かない。

環境操作の内部型はdocker-desktopの責務名に揃える。BackendState／EngineState／EngineObservation、RestartInput／RestartResult／RestartObservation／RestartCallbacks、RepairInput／RepairResult／RepairCallbacks／RepairCheckpoint／RepairDisposalCheckpoint／RepairRetentionTargets／RepairMachineResult、DirectoryInspectionInput／DirectoryCleanupResult／RepairDisposalInputを使用する。Directoryの実体識別は既存DirectoryIdentityを共有し、同形の局所型を撤去する。型名だけの整理であり、公開環境契約・保存field・IPC名・reason・期限・照合条件・状態順序は維持する。Domainの保存型・decoderは別Ownerであり、この改名を適用しない。

旧Assets／配置／Proxy記述とprepareDockerNetworkPolicyの四入口はRootから撤去した。内部の固定値・正規化正本と低位反例は維持し、製品Sourceと検証ScriptはCatalogへ接続する。旧九Command Compilerと逆投影・比較は有限試験supportへ限定し、製品は固定Requestから共通Compilerを通る。残件1〜5では構築・固定metadata・分類・純粋検査・公開型のOwnerを整理した。実行入力Policy解析は必要な純粋契約として維持し、保存済みCheckpoint判定は既存Domainへ接続する。有限回帰と実境界の成立を区別する。

## 共通実行Owner（2026-11-02）

単一Containerの観測順序と限定接続はcleanup/container.tsが所有し、inspectIsolation／cleanupIsolationの技術種別overloadから呼ぶ。ExecutorにDocker不存在→inspectの合成やCLI接続構築を残さない。内部のContainer構成型はDI cleanup/types.tsが正本で、公開はResourceTarget<"container">／ResourceInspection<"container">を使用する。Executorも同じ型を再利用し、個別型の公開を重ねない。旧Container低位四関数はDI Rootから撤去し、内部と検証supportに限定する。

固定Directoryも同じ公開二入口から既存repair-sessionのScope・Artifact・Checkpoint・取消・現在確認へ接続する。Directory入力型はDIが所有し、観測は同期、回収は元Promiseを包み直さず搬送する。任意Path削除へ拡張しない。既存Directory二関数のRoot公開は撤去する。認証要求の意味変換はExecutorに残し、DIへ認証kindを追加しない。

資源集合の同期観測は公開inspectIsolationからcleanup/resources.tsの一実装へ接続する。同じIsolationCleanupRequestのSnapshot・明示探索候補を受け、Operation／Recovery ID・用途別投影・保存先を受け取らない。ResourceInspectionは資源key・実ID・存在三値・実測Snapshotとconfig終了を返す。入力の予定構成を実測としてコピーしない。旧inspectDockerResources／cleanupDockerResourcesと用途投影型のRoot公開は撤去する。

既知IDは共通inspectIdentityで実ID・名前・所有Labelだけを照合する。Image・Command・Mount差は拒否条件へ戻さない。ID欠測時は元の作成Intentを持つSnapshotの予定名・所有Labelで二経路探索し、両方が同じ一意実IDを返す場合だけ、実体の種別・実ID・名前・所有Labelを再照合する。実行構成は対象識別の条件にせず、発見実IDの必須通知が完了するまでは削除しない。別途の構成候補やUser・Init・Tmpfsの回収専用保存は要求しない。不存在は二回の名前／Label観測と既知ID側の明示不存在を区別し、unknownをabsentへ補完しない。stopOnUnknownAbsenceは最初の不存在不明で止める技術条件で、用途は解釈しない。取消は各要求の前後と固定接続のspawn直前に確認し、config終了失敗は全体blockedにする。Directory・単一同期Containerも同じ公開観測・回収入口へ接続する。ただし技術種別に応じた同期性・固定Scope・不存在条件は個別に維持する。

旧Probeの低位実行・attach fixture・結果分類は製品Sourceから撤去し、tests/support/probe-plan.ts・probe-process.ts・probe-result.tsへ移管する。固定Image・Engine・profileは引数なしdescribeIsolationConfigurationが所有する。名前・Labelは上位の実行Owner又は既存保存Schemaへ投影し、観測型はExecutorのIsolationProbeFactsを再利用する。旧記述関数とRuntime／Sessionの試験用型は試験supportだけに置き、DI Rootへ公開しない。

自作configは非recursive削除後にlstatで不存在を確認する。ENOENTだけを不存在とし、同Pathの再出現、EACCES・EPERM・EIO等の観測不能はconfig終了未確認とする。Docker資源の不存在とFilesystem終了を相互に補完しない。

`execution/types.ts`は閉じたContainer／Network構成とcreate・connect・runの有限技術列を定義する。用途名、Task・保存・許可を受け取らず、分岐・再送・任意Docker flagを公開しない。`execution/preparation.ts`は通常data捕捉、参照と技術構成の検査、固定引数生成、実行前の完全構成検査を所有する。`execution/operations.ts`の元準備と一回の実行Contextが、通知・所有Process・取消・受領ID・補償回収・config終了・Completionを一つにする。

| 接続 | 現在の状態 |
|---|---|
| 固定Probe | 共通prepareIsolation／executeIsolationへ接続。固定payloadと出力解釈はExecutorへ移管 |
| 認証の通常実行 | 共通prepareIsolation／executeIsolationへ接続。認証三値の解釈はExecutor |
| 通常Attempt | 共通prepareIsolation／executeIsolationへ五資源・九操作を接続。Provider固有の構成・解釈とHome排他はExecutor |
| 単独Cleanup | 資源集合はcleanupIsolationから通常と同じ実行Context・資源照合・回収へ接続。単一Container・固定Directoryも同じ公開入口を使うが、固有の同期処置・元Promiseと既存条件を維持する。新規実行Stepは発行しない |
| 旧入口・検証接続 | 認証専用実行・旧固定九操作Runtime／Sessionを製品Sourceと公開Rootから撤去。旧有限試験だけtests/supportへ分離 |

準備は元CLI・借用Directoryを捕捉し、実行開始前と各要求前に再確認する。managementDirectoryはcanonicalなDirectoryを必須とし、資源操作を既定Docker configへfallbackしない。constructor自身で入力を捕捉し、prototypeを固定する。短命準備はコピー・JSON保存から実行を再構成せず、内部の秘密構成を列挙可能なfieldへ出さない。ResourceSnapshotは準備時に未要求、実際の要求直前に不明、所有Processの取得後に発行済みとして更新する。受領IDを通知前に保持する。inspectだけで発行済みを推測せず、単独inspectの発行状態はunknownとする。

runのdeadlineOriginは「起動要求時（request）」又は「開始観測時（started）」を明示する。Probe・認証・通常setupは起動要求時、通常Provider本体は開始観測時という既存の起算点を維持する。起動要求時の期限を、started観測後に再起算しない。開始通知は起算点とは別に、実際の開始観測が得られた場合に一回発行する。要求起算では開始観測を並行し、command終了後の後着通知は発行しない。終了確認猶予は実行期限と分離する。

認証にも上位確定の管理領域を渡す変更は人間承認済みである。Executorの認証Factoryは値の構成だけを行い、上位のRecovery受付・管理領域取得後、startから同じprepareIsolation／executeIsolationへ接続する。Provider HomeへのDocker設定作成、既定configへのfallback、新Storeや自動回復は追加しない。認証のexisting_idle回収でも、管理所在のexclusive取得を回収前に行う。通常Attemptと認証の単独回収は共通入口へ接続する。

期限・対話／捕捉方式は確定した技術入力で維持する。同期の結果解釈通知と待機する必須通知を区別し、誤Promise・Rejectを捕捉する。取消は同じ所有Handleへ一回配送し、終了未確認時の新規処置・削除を止める。回収中の取消は記録するが同じ回収を再開始しない。一次停止点をCleanup失敗で上書きしない。既存認証のID欠測時の正規不存在観測と、ProbeのLabel不存在確認は、用途名を持たない技術条件として保持する。新しい永続State・Manager・Registry・Store・待機Gateは設けない。

## 共通技術IFの移行と回収照合（2026-11-02）

三用途の技術実行と単独Cleanupは共通入口を使用する。実AI・実Dockerの再成立は別の検証義務であり、今回の有限代役試験から推定しない。回収の意味を次のように分離する。

| 対象 | 現在の照合条件 |
|---|---|
| 元Receiptの完全実IDがあるContainer／Network | fresh inspectの資源種別・完全実ID・正確な名前・所有Label。Image・Command・環境・Mount・Init等の構成差は削除拒否理由にしない |
| 実ID欠測からの発見 | 元Intent・予定名と名／所有Labelによる一意実IDの一致・実体Identity再照合・発見実IDの必須通知を要求する。Image・Mount・Network・User・Init・Tmpfsは対象識別の条件にしない |
| 実行前検査・構成診断 | 従来の完全構成検査を維持 |
| Directory | 既存の用途固定・廃棄許可・元実体確認を維持 |

削除要求成功と不存在確認を区別し、元IDが消えていても同名の別IDが残れば回収完了にしない。Process終了未確認・必要通知失敗では前進を止める。認証の実IDは通知前に技術Ownerへ保持する。通知失敗後の補償でも、処置前通知とProcess終了確認を省略しない。固定Named Pipeは接続先の指定でありDaemon世代の証明ではない。

`ResourceSnapshot`は識別情報と非秘密構成を分離した不変投影であり、保存指示・実行許可・削除権限ではない。単一Containerのinspectは同じ観測からSnapshotを返す。Image Digest・Mount元／先・読取り専用条件・Network名等を返し、Command値は伏せ、環境値は返さず名前だけを返す。構成欠測はnullであり空集合へ補完しない。上位に全構成の永続保存を要求しない。資源集合のinspectは同じ読取りから観測できた構成のSnapshotを返し、通常Attempt・認証のCompletionと単独Cleanupも同じSnapshot型を搬送する。観測不能な構成は捏造せず、資源別のunknownと区別して扱う。

## 明示依頼の回収と取消（2026-11-02）

Task回収接続と単一Container回収は、上位Ownerの再照会ではなく、呼出し側の排他保持と任意のAbortSignalを契約とする。閉じた接続・取消済みでは後続処置を止め、自作configのcloseは取消後も実体照合して一回だけ行う。CLI、Parent／config実体、元ID・名前・所有Labelと不存在の検査は維持する。上位状態の途中失効の自動検知は、この契約の保証に含めない。認証の通常／単独回収もexecution/operations.tsの同じ技術回収を共用する。元計画の資源列をcleanup/validation.tsで技術入力として検査し、通知前に保持した元実IDを回収へ利用できる。ただし処置前の必要通知とProcess終了確認は省略しない。実ID欠測では名前だけで削除せず、不存在観測とunknownを区別する。Directoryは既存の用途固定APIを共用し、廃棄許可・実体確認を変更しない。このSource統合は実Dockerや全体QAの成立を意味しない。

同期Containerの固定接続はcleanup/container.tsのcreateDockerContainerBindingで構築する。元管理DirectoryとCLIを確認し、既存docker-config／docker-homeを取得するため、Effectなしの値構築とは扱わない。領域の最終終了は従来の上位Host清掃が所有する。旧Probeの作成・実行・取消・意図的残存生成とpayload選択は検証supportへ移管し、通常製品は共通実行入口だけを使用する。純粋な必要資源metadataは既存Ownerへ維持する。

## Container観測・回収の共通化（2026-11-01）

Probe専用のcontainer.ts／configuration.tsをcleanup配下のContainer技術処理へ統合する。既存の構成投影をID・名前・所有Label・Image・User・Entrypoint・完全Command候補・Mountの技術値へ整理し、観測と削除はProbe ID・故障Profile・Host保存を解釈しない。これは保存モデルや汎用管理機構の新設ではない。固定作成構成の選択は既存plannerに維持し、任意の照合関数や検査省略条件は公開しない。

通常／単独の資源集合回収はcleanup/operations.ts、単一Container回収はcleanup/container.tsが技術処置を所有する。双方とも有界inspect・元実ID／名前／所有Label照合・実ID限定rm・現在不存在確認を要求する。同期Container処置を形式統一のために非同期へ変更しない。通常回収の実ID／名前二軸と、単一Containerの実ID／名前／Label三軸の不存在確認をそれぞれ維持し、一方の成功から他方の保証を推測しない。単一Containerのinspect上限64KiBと削除直前の明示取消確認を維持する。Root読取り専用・非特権・能力剥奪・Device追加禁止・完全Command一致・Mount元fresh realpathは実行前／構成診断の条件であり、既知Receiptの削除条件にはしない。既存reason文字列は意味が同じ範囲で維持し、認証のresourceIdentityConfirmedとidentity_unconfirmedは構成判定と区別する。

## 助言Command往復の廃止（2026-11-01）

上位へ助言Commandを返して専用Hashで再照合する経路を廃止する。DIのAdviceCommand型・bindAdviceCommand・hashAdviceCommandは撤去し、用途別Image選択と構成相関はExecutorが所有する。認証Probeと追加Allowlistの分離、Mount・Network・Process・回収の安全条件、完全Docker Commandの構成照合は維持する。この変更を実AI・実Dockerで再検証済みとは扱わない。

## 固定合成Probeの非同期実行（2026-11-01）

Executorが既存createExecutorの合成Probe要求を受け、DIの固定作成・構成照合・実ID限定回収を利用する。runDockerProbeAsyncは既存の所有attach Handleで実行し、固定Profileの期限と64KiB出力境界を維持する。非同期出力超過はENOBUFS、期限超過はETIMEDOUTと同じ既存分類へ搬送し、計測区間はStart発行から結果観測までとする。上位保存待ち・補償join時間を実行時間へ混ぜない。

取消は同じHandleの終端へ伝え、元結果・取消・closeを分けて返す。ListenerとTimerを解除し、完了・例外・取消のいずれでも取得Handleをjoinする。close不明を資源不存在へ昇格しない。DockerProbeExecutionFactsは既存の同期分類と共通の明示型とし、Hostの保存・保持・最終成功は所有しない。故障注入と意図的稼働残存は検証専用であり、製品Requestには公開しない。

## 認証と通常実行の共通技術境界（2026-11-01）

認証の固定計画・元Command所属、実ID／Label／構成照合、削除許可と不存在確認は既存authenticationとcleanupの技術正本へ置く。認証と通常実行は既存process/start.tsを使い、短期操作と認証の終了要求・確認をfinishOwnedProcessへ統合する。元Handle、5秒終端猶予、元結果とcloseの分離、必要な認証だけの終了後読取りを維持する。認証の操作間保存・Home Lock・Historyは持たず、CoordinatorはExecutor経由で利用する。通常と認証の期限・対話・Mount・Network差は消さず、任意構成の汎用Container APIへ拡張しない。

## 固定Directory処置と修復の上位窓口（2026-11-01）

既存のrunRepairSession、observeRepairDirectories、cleanupRepairDirectoryは内部の技術正本として維持し、Coordinatorの本番callをExecutorの修復API／共通資源APIへ切り替える。Directory kindはDI共通入口で技術種別として判別し、内部の閉field検査には元inputだけを渡す。nonce・Scope・固定用途・Filesystem実体・現在許可・取消・二読取り・不存在再確認の条件は変更しない。保持期限・業務判断・保存・新しいStateは所有しない。返却値・Schema・技術順序は変更しない。

## 環境観測・再起動の上位接続（2026-11-01）

backendとEngine観測、固定再起動の具体的なOS・CLI・Native処理は引き続きDocker Isolationが所有する。上位向けの薄い技術窓口はExecutorの[環境API](../executor/01_Architecture.md#host実行環境の窓口)に置き、Coordinatorの本番再起動はそのAPIへ接続する。既存の現在境界確認、Effect前同期通知、取消、補助資源join、一次失敗・cleanup・deliveryの分離は変えない。公開結果はDockerEnvironmentResult<"restart">で参照する。内部の観測とdeliveryの交差構造を再利用し、返却値やSchemaは変えない。

## Process／Thread数の独自上限撤廃 — 2026-10-29

人間判断により、CRDDはAI実行・助言・認証確認／login・Proxy・診断用Containerへ`--pids-limit`を指定しない。従来の32／64固定値を別値や`-1`へ置換せず、用途別設定、自動算定、監視・回復機構も追加しない。実行時構成照合と回収判定は`HostConfig.PidsLimit`をCRDDの必要条件として解釈しない。Docker／Host側の独立した設定は変更せず、CRDDの指定撤廃を実環境全体の無制限保証とは扱わない。

Model／CLIのThread数変化や通常のBuild・Testを独自固定値で妨げないことを優先し、Process大量生成による実行環境の資源圧迫リスクを受容する。非root・read-only root・capability削減・no-new-privileges・seccomp・Mount／通信制限・元資源Identity照合・取消と回収は維持する。過去Evidenceの当時のpids値は書き換えず、保持中資源の操作・既存Containerの設定変更はこの撤廃に含めない。設定撤廃だけで過去の編集失敗の原因確定や解消を主張しない。

## Provider CLI更新 — 2026-10-25

### ExecutorとのCommand境界

Task／Advice／Probeの用途相関、固定Image選択、RoleとWorkspace権限、認証環境とSeccomp選択はExecutorの既存構築関数が所有する。旧`execution/binding.ts`と`bindProviderCommand`の公開は撤去する。DIは静的Catalogと技術Compilerを所有し、ModelやTaskの判断、Task状態・Operation・Authority・Recoveryを受け取らない。新しい状態・Lock・Registryは持たない。

助言用のCommand wrapperと専用Hashは廃止し、Executorが上位の確定入力から固定Image・通信Policy・非共有条件を結合する。Commandを上位へ往復させず、実行許可・同意判断は上位に残す。Executorは固定済みIsolationRequestを一度構築し、DIの共通Compilerだけが本番argvを生成する。旧九操作のCompiler・Proxy逆投影・argv診断・全Command比較は本番SourceとRootから撤去し、過去の有限Oracleとしてtests/support/execution-plan.tsへ限定する。Image変更・Docker実行・保存形式の変更は行わない。観測・回収は共通Snapshotと技術入口へ接続済みであり、Rootは初期化を含む8関数・16型を提供する。有限試験による接続確認と、実Docker・実AIの未実施範囲は区別する。

今回採用する公式の固定版はCodex 0.164.0、Claude Code 2.1.310である。新しいTask・助言Imageは既存Dockerfileで作成し、実測したImage Digestだけを`image/assets.ts`へ固定する。実行時のPull禁止・自動更新禁止、非root、read-only root、Mount・通信制限とexact資源回収は維持し、旧Imageは削除しない。新Imageが作られたことは実AI・認証・全体E2Eの成功を意味しない。

Codex Taskにも同じ公式配布版のCode Mode Hostを含め、助言のbwrapを旧Task Imageから取り込む依存は廃止する。CLI・Host・bwrapの公式Archive Hashと展開実行物のSigstore署名、Claudeの公式Manifestによるサイズ・SHA-256をBuild前に確認する。実行時の同一性はImage Digestを利用し、内包BinaryのHash検査をTaskごとに再実装しない。三実行物の由来は`build-inputs.json`の共通`codex.identity`へ集約し、用途別レシピだけを分ける。既存準備入口を`prepare-codex-image.ts`へ改名し、三入力と用途別レシピを実体・サイズ・Hashで検査する。助言は四File、Taskは改行をLFへ正規化しHash照合した固定Schema三件を加えた七FileのContextを作る。認証Home、Repository本文、Source ArchiveをImageへ含めない。

配置変更は新しい処理に適用し、旧exact回復参照と保持物を更新版のIdentityで書き換えない。公式取得物・試験ContextはRepository-local tmpの短命生成物であり、正式文書には取得元・検証結果・Image同一性・未確認範囲だけを要約する。新しいBuild Runner・Registry・回復機構は作らない。

## 上位接続の名前付き型契約 — 2026-10-30

`execution/types.ts`は共通実行と元Receiptの技術型を所有する。`execution/operations.ts`が元準備・一回実行・取消・必要通知・Process終端・資源回収・config終了を所有する。旧`execution/execute.ts`と`execution/session.ts`の固定九操作候補は製品Sourceから撤去し、過去の有限反例を保全する試験supportだけへ移す。製品の実行順序を旧候補で代替せず、共通入口の契約試験とExecutorの接続試験を別に実施する。

`docker-cli/config.ts`の`observeDockerDirectoryIdentity`を通常RuntimeとProbeで共用する。canonicalな非Link Directoryのdevice／inode／birthtimeを観測し、元実体との不一致・欠測・観測不能を後続CLI前に拒否する。通常Sessionは最初のawait前に使用Directoryを捕捉し、既存Context内だけに保持する。ProbeはFactoryのEffectなし観測と、Bindingの各要求前観測を同じprimitiveへ接続する。Path文字列の一致を実体確認の代用にしない。新しい監視・Registry・Storeは設けない。通常CleanupのReceipt引数は必須の明示値又はnullで、上位へのinspectReceipts fallbackは撤去する。Receiptも既存Contextもない場合に回収のためのconfigを新設しない。

`execution/result.ts`は終了値とコマンド結果の分類型を所有し、期限超過時のbyte項目不在を維持する。Factoryと分類関数へ明示返却型を付け、上位はこれらの名前付き型を再利用する。Rootへの追加は型だけで、実行時公開、拒否条件、Process・資源の生涯、期限や理由を変更しない。これは当該接続契約の明示化であり、Package全体の型整理完了を意味しない。

## B3の構成照合境界 — 2026-10-21

旧dockerIsolationCommandsMatchの再生成・全argv照合はtests/support/execution-plan.tsの有限Oracleだけが所有する。製品の公開検査ではなく、現在の実行はExecutorが固定したRequestをDIの共通準備・Compilerへ一度渡す。元準備・Capability・通知・Receipt・回収の保証はその実接続と有限技術境界で検証し、旧Oracleの成功から推定しない。

## Image同一性と取得・Build情報の分離 — 2026-10-21

通常実行の固定Image、版、実行Pathは`src/image/assets.ts`を単一正本とする。`images/build-inputs.json`は取得・Build時のArchive／Binary・Sigstore・内包Schema／設定の期待値を所有し、通常実行から読み取らない。版・実行Path・Image Digestを同JSONへ重複定義せず、Build・資産検証では同じ実行定義と組み合わせる。取得元の真正性と取得物の完全性を検証する義務は維持し、期待値があるだけで検証済みとは扱わない。

内部正本の`describeDockerProviderAssets`は実行用のImage・配置と外部Seccomp照合材料だけを返し、取得Archive・署名Bundle・Image内Binary／Schemaの個別Hashは公開しない。取得・Build情報のfieldを参照した試験はBuild入力へ接続する。Providerの実行仕様はAI Adapter、Image内容・配置はDocker Isolationが所有する。新しいBuild Runner、Registry、署名Frameworkは作らない。

Providerの作成計画は固定Image指定と`--pull=never`を維持する。Host上のSeccompを起動時に渡す場合はImage Digestの保護外なので、実物のIdentity・容量・Hash照合を維持する。Repository設定やMount内容もImage Digestだけでは保証しない。現行Imageの重複定義を除去する一方、未解決の旧exact Recoveryを識別する過去Digestは現在の正本と区別して保持する。Image IDとRegistry manifest digestを同義として新しい取得方式へ切り替えない。

本改訂は情報の配置・公開範囲を整理するもので、既存ImageやHash値、Provider版、Pull条件、資源回収の保証は変更しない。限定Image検証やAllowlistの新Imageは別の検証対象であり、このSource変更だけから成立を主張しない。

## 追加通信条件の純粋構成 — 2026-10-21

`network/policy.ts`内部の`prepareDockerNetworkPolicy(provider, additionalHosts)`は、検証済み設定の追加Hostを技術境界で再検査し、Provider固定集合と合成した不変Policyまたはblockedを返す。外部公開はせず、prepareIsolationがRequestの追加Hostを捕捉する時に呼び出す。現在のPolicy値の型は`DockerNetworkPolicy`／`DockerNetworkPolicyResult`。最大32追加、各253文字・label63文字、ASCII DNS名を小文字化し、URL・port・IP literal・wildcard・末尾dot・重複を拒否する。Provider固定Hostとの重複は集合として一つへ統合する。単一labelやpunycodeを名前だけで禁止せず、実DNSの公開IP確認は既存Proxyが所有する。

実効Hashは契約版・用途`repository_ai_execution`・Provider・整列Host集合・443／CONNECTへ結合する。設定の順序・大小文字や既定／明示同値でHashを変えない。DomainやRepository Pathを参照せず、外部Effect・Authorityを発行しない。

この内部処理はRepository内の編集・助言・レビューで共用し、認証には追加集合を渡さない。CoordinatorとExecutorはTask開始時に凍結した追加Hostだけを搬送する。DIが固定Hostとの合成・Policy Hash・Proxy／Client環境を生成する。内部のparseDockerNetworkPolicyはProxy等の技術搬送を検査し、上位の公開APIへ戻さない。

内部正本の`describeDockerProxyTopology(provider)`は固定Image、port、Provider固定Hostと二Network構成を返す。Image定義は`image/assets.ts`の単一正本を参照する。Repository追加HostはTopologyへ保存せず一回の実効Policyへ渡す。過去のProbe成功・取得用Hash・署名情報をRuntimeの成立証明として返さない。Coordinatorの試験専用CIDR／CONNECT参照モデルは`tests/support/`へ限定し、実Pythonの強制と混同しない。

ProxyはDNS応答の重複を除いた最大32アドレスを検査し、一つでも非公開・loopback等があれば拒否する。接続は検証したexact IPへ443で行い、候補ごとに期限を再開始せず、全接続試行を単調時刻の共通15秒期限内へ収める。失敗時の理由は固定分類だけを診断へ含め、生例外・任意IP・秘密値を複製しない。設定不正時に固定集合へfallbackしない。

構成記述と実測結果は別である。限定npm／pip、拒否・取得後待機取消・回収の結果は[変更の実測記録](../../../99_Roadmap/Changes/CHG-000082/docker-isolation-source-structure.md)を参照し、認証を含む全体E2E・実AI・取得中取消へ拡張しない。

## Source責務別配置 — 2026-10-20

### Docker固有記録の所有者

Docker IsolationはDomain Modelへ依存せず、永続記録の保存・読戻し・上位の再開判断を所有しない。修復Machineが受け取り通知する技術状態は`docker-desktop/types.ts`、その純粋検査・技術遷移は`docker-desktop/validation.ts`が所有する。Docker Task回復IDの技術入力解析は`cleanup/resource.ts`に閉じる。Domainは従来の保存Schema・保存受理遷移を独立して保持し、どちらの公開Rootも相手Packageをロードせず開始できる。正常通知・異常値・遷移の一致は非AI契約試験で固定し、保存状態を二重保持しない。

`onPrepared`／`onCheckpoint`等の通知の時点・回数・同期完了順序を維持し、保存成功のBoolean ACKを要求しない。上位は通知値を保存側の検査へ通して確定し、拒否又は例外では下位の追加Effectを止める。技術DTOの成立を保存成功・資源不存在・実行許可へ読み替えない。新しいStore・Registry・Lock・保存用Portは追加しない。

Probe記録は唯一の製品利用側であるCoordinatorの`state/probe-record.ts`へ移した。上位の記録OwnerはDI公開の固定資源記述を参照するが、DIは記録Writer／Readerを呼ばず再公開もしない。詳細は[Coordinatorの保存境界](../coordinator/01_Architecture.md#probe記録の保存owner)を参照する。記録Schema、token形式、保存Path、Hash、nonce、読戻し・差替え拒否と書込み順序は維持し、旧Fileの互換入口は残さない。

| 公開操作 | 境界 |
|---|---|
| `（削除済みのTask回復ID解析）` | 固定三成分の解析またはnull。解析だけで実行／回収資格を発行しない |
| 修復checkpointのdecode・settled判定 | 受け取った技術値だけを検査し、保存記録を探索・読戻ししない |
| Probe記録のtoken・Writer／Reader・Root／子照合・型 | DI公開から撤去。Coordinatorの記録Ownerが既存契約を維持する |

CoordinatorはDI Rootへ接続し、DIはCoordinatorをimportしない。Host終端記録、再起動要求とRepositoryの相関、現在状態のWriterと配送は上位Ownerに残す。汎用JSON確定Journalを名前だけでDocker責務へ移さず、新しいLock・Recovery機構は追加しない。

`execution/`が三用途の共通技術実行を所有する。認証・Probeの用途固有条件はExecutorが構築し、DI内の旧専用Runtimeはtests/supportへ分離する。Docker CLIの信頼・設定・環境は`docker-cli/`、所有子Processは`process/`、固定Image・Probe資源記述は`image/`、実資源の回収は`cleanup/`、Desktop・Engine観測と既存修復は`docker-desktop/`が所有する。標準公開入口は`src/index.ts`一つ。Native技術処理はPlatform Accessへの既存委譲を維持する。

UTは同じ責務Folderへ追従し、ITは既存の操作・結合シナリオを維持する。移動・全利用側と検証結果は[再編対応表](../../../99_Roadmap/Changes/CHG-000082/docker-isolation-source-structure.md)を参照する。固定材料も責務別に配置する。配置等価性、追加通信の接続、本番全体の成立を別々に評価する。

## Provider実行物の配置所有 — 2026-10-19

`image/assets.ts`は、Codex／Claudeの固定Image、版・実行Pathと外部Seccompの実行時照合材料を所有する。取得・Build用の収録済みHashは`images/build-inputs.json`が所有する。AI Adapterの旧`distribution.ts`から移し、過去の署名・認証・送信の「検証済み」定数は引き取らない。返却値は現在の構成記述であり、実Imageの存在・同一性・認証・実行許可の証明ではない。

| 公開API | 入出力と境界 |
|---|---|
| `describeIsolationConfiguration(provider)` | 固定Assets・Image内配置・Proxy固定設定を純粋に記述する。各既存正本を再利用し、Image取得・起動・環境観測・Authority生成は行わない |

Executorが同じCatalog配置でCLI計画を準備時とEffect直前に再生成し、既存Image・Seccompへ結合する。上位は要求・選定・同意の意味相関を所有し、Commandを組み立てない。Image・非共有条件はDI技術構成であり、AI AdapterのCLI契約には含めない。AI AdapterからDIへの逆依存、新Registry、永続State、Lock、配布Frameworkは追加しない。設定・Schema本文、実Image・バイナリ・Hash、認証Homeと既存回復参照は変更しない。

今回の移管はSourceと構成結合の回帰対象であり、実Docker／実AIの再実行や保持中の②試験物の処置は含まない。

新Workspace方式への接続は[借用・終了契約](../coordinator/05_Workspace.md#5-状態競合終了条件)を目標とする。DIは上位が検証・許可した作業対象だけを借用し、実行資源を回収する。継続Workspace／Branchを削除・resetせず、上位Task・採否を知らない。Direct／Candidateの共通方針は本書の採用済み契約に従うが、具体的Mount・書込み保護の本番接続は未完了で、現完成範囲には含めない。以下の実装・検証完了は基準のDI技術分離に限り、新方式の実Mount／取消／成果保全はNot Run。

成果物種別: Architecture詳細設計
詳細設計領域: docker-isolation
状態: 実装・検証完了（本Package範囲。v0.22全体の完成・採用判断とは別）
担当責任者: Qual-Lab
最終更新日: 2026-10-17

## 基本設計との関係

### Repository追加通信先の接続目標（実装・実通信確認中）

既存の内部Networkとegress Network、HTTPS CONNECT Proxyを利用する。上位が検証済みRepositoryから一回読み取った不変の通信設定を注入し、ProxyはProvider・固定Host・追加Host・443／CONNECT・意味Hashを起動時に再照合する。設定不正は起動拒否とし、固定Hostへの暗黙fallbackを行わない。ログインは追加設定を渡さずProvider固定Hostだけを使用する。

既存の要求・Receipt・取消・回収経路を維持し、Proxyの元create引数に追加した同じ非秘密設定を実構成照合にも用いる。新しいState、Registry、Lock、Recovery経路は作らない。ImageはBuild時の入力検証と固定Digestで識別し、古いProxy Imageを追加通信先対応済みと扱わない。

承認済み限定試験はProxy＋Providerの通信断面だけを対象とし、npmとpipを順次実行する。同時最大2 Container・専用2 Networkを守り、取得成功、未許可Host拒否、直接egress拒否、取消後のexact資源不存在を別々に確認する。認証Containerを含む本番全体のE2E、TLS本文検査、任意Repositoryへの一般化を主張しない。失敗時は再試行せず今回の資源だけ安全に回収し、確認不能は保持する。

| Architecture定義 | 担当する責務断面 | Relation状態 |
|---|---|---|
| [ARCH-000004](../../Definitions/ARCH-000004/architecture_definition.md) | 許可済み実行の隔離環境開始、待機、取消、終了、所有資源回収 | Partial |
| [ARCH-000008](../../Definitions/ARCH-000008/architecture_definition.md) | 要求、開始、Process結果、一次失敗、資源観測、清掃後条件の区別 | Partial |

新Workspace方式の実Mount／取消／成果保全、実Provider全経路、残る上位Consumerは未完了である。既存の局所実装・検証を基本設計全体のCoveredへ読み替えない。

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | DIと上位Owner、Platform Access、Docker Engineの責務を分離する | [§1](#1-責務と変更境界) |
| Interface Model | Required | 許可済み入力、固定command、技術結果と上位通知を分ける | [§2](#2-入力と公開api) |
| Data Flow | Required | 元操作相関、要求、実ID、結果、清掃観測を同じ流れで保持する | [§2](#2-入力と公開api) |
| State Model | Required | pending、実行中、結果不明、清掃不明、終了を区別する | [§3](#3-状態順序失敗) |
| Sequence | Required | 許可、保存、要求、観測、通知、回収の順を保持する | [§6](#6-通知と上位状態の接続) |
| Failure／Recovery | Required | 一次失敗、清掃失敗、親Process喪失、再入場を分ける | [§3](#3-状態順序失敗) |
| Deployment | Required | Host、Container、Network、固定Mount、認証Homeを区別する | [§4](#4-配置保存実行環境) |
| Observability | Required | 実ID、Handle、Process終端、資源不存在を別々に観測する | [§5](#5-qualityへの引渡しと完成条件) |
| Security Boundary | Required | Repository外、Git、内部状態、認証、秘密の境界を保持する | [共通隔離方針](#workspace-isolation-policy) |
| Implementation Structure | Required | 下表で共通契約と具象差を評価する | [Implementation Structure](#implementation-structure) |

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | OPEN | Lock、所有Process、同一回復Identityは既存契約にあるが、新Workspace方式の並行借用・終了は本番未接続 | [§3](#3-状態順序失敗) |
| Timing | OPEN | 取消、遅延通知、Process終端を区別するが、新方式の全待機境界は未実証 | [§6](#6-通知と上位状態の接続) |
| Resource Lifecycle | OPEN | 実ID回収と不存在観測は局所成立したが、新Mountと全Consumerの終了後条件は未完了 | [§5](#5-qualityへの引渡しと完成条件) |
| External Boundary | OPEN | Docker／Process境界は実測済みだが、実Provider全体と新Workspace本番接続は未評価 | [現在の接続状況](#現在の接続状況) |
| State／Consistency | OPEN | 既知状態と観測不能を分けるが、上位Workspace状態との全相関は接続中 | [§3](#3-状態順序失敗) |
| Failure／Recovery | OPEN | 一次失敗保持、清掃不明、親喪失を扱うが、追加二領域の実障害Continuationは未実証 | [現在の接続状況](#現在の接続状況) |
| Observability | OPEN | 実ID・名前・Labelと終了後不存在を観測するが、全本番Consumerの観測閉包は未完了 | [§5](#5-qualityへの引渡しと完成条件) |
| Security／Trust | OPEN | 共通隔離方針と固定Path保護は採用済みだが、新方式の実Mountと秘密境界は本番未接続 | [共通隔離方針](#workspace-isolation-policy) |

`PASS`: 詳細設計上、必須条件と反証が閉じている。`N/A`: Architecture上、そのConcern自体が存在しない。`OPEN`: 未解決の設計事項を保持する。`FAIL`: 必須設計と矛盾する。

## Qualityへの引渡し

| 導出キー | 設計項目種別 | 対象 | 正常条件 | 反証する失敗 | 主な試験段階 | 外部境界の段階 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|---|---|---|
| `docker-isolation.lifecycle` | Resource／Lifecycle | 許可済みDocker／Processと所有資源 | 元操作相関、固定構成、実ID、終端を同じ操作で確認する | 要求受理＝Effect成立、取消要求＝終了、名前だけで削除、観測不能＝不存在 | IT／ST | Direct Boundary／System/E2E | Process、Container、Network、Mount、Label、Imageの実観測 | 所有Handle終端と実ID・名前の不存在 | 新Workspace方式の実Mount／取消／成果保全、全Provider経路 |
| `docker-isolation.failure-recovery` | Failure／Recovery | 結果不明、清掃不明、親Process喪失、再入場 | 一次失敗と清掃結果を分離し同じexact回復Identityで再観測する | 不明の成功化、別Identity生成、他Owner資源の削除、履歴値だけの不存在推定 | IT／ST | Direct Boundary／System/E2E | 保存済み相関、現在資源、一次・二次結果 | 未解決参照保持または正式回収完了 | 追加二領域の実障害Continuation |
| `docker-isolation.security-boundary` | Security／Trust | 作業Tree、Git、内部状態、認証Home、秘密 | 許可対象だけをMountし保護対象をROまたは非公開にする | Repository外書込み、保護Path変更、秘密の明示複製、別名経路の未検査許可 | IT／ST／UAT | System/E2E／User Acceptance | 実Mount、Path実体、書込み結果、Host側不変 | 試験物回収、保護対象不変 | 新方式の本番Mount、実Provider、利用者確認 |

## 現行実装との照合

Docker Isolation Packageの既存技術境界、実ID回収、限定故障・回復、公開CLI取消等は局所実装・実測済みである。一方、新Workspace方式の実Mount／取消／成果保全、全Provider経路と全Consumer閉包は未完了であるため、上表のRelationとConcernは`Partial`／`OPEN`を維持する。過去署名Evidenceや単一runの結果を現行全体の成立へ流用しない。

## Implementation Structure

| 観点 | 適用 | 判定理由 | 成立させる構造 | 局所責務・不変条件 | 失敗・変更時の影響 | Qualityへの導出キー |
|---|---|---|---|---|---|---|
| Variation | Required | DirectとCandidate、複数Provider形状がある | 共通隔離方針＋用途別計画 | 方式差で保護境界を弱めない | 別方式だけの越境 | `docker-isolation.security-boundary` |
| Common Contract | Required | 全入口で同じ資源・失敗・回収意味を使う | Package Rootの技術契約 | 上位がDocker argvを再定義しない | Consumer間の終了差 | `docker-isolation.lifecycle` |
| Creation／Selection | Required | 許可済み対象・構成だけを開始する | 固定入力検査と計画 | 入力不正・開始前取消でEffect 0 | 誤対象・余剰資源 | `docker-isolation.lifecycle` |
| State-dependent Behavior | Required | pending／実行／不明／清掃を区別する | 技術状態と回復Identity | 観測不能を成功・不存在へ畳まない | 二重要求・誤回収 | `docker-isolation.failure-recovery` |
| Composition／Recursion | Required | Coordinator／Orchestratorと下位技術境界を合成する | 通知と用途限定projection | 下位は上位判断を所有しない | Authority逆流 | `docker-isolation.lifecycle` |
| Lifecycle Ownership | Required | Process・stream・Container等にOwnerがある | 所有Handleと実IDの追跡 | 他Owner資源を削除しない | Leak・誤削除 | `docker-isolation.failure-recovery` |
| External Boundary | OPEN | Docker／OS／Provider実境界を使う | 固定CLI・実Process・実資源観測 | 全Providerと新Workspace方式は未完了 | 局所成功の全体化 | `docker-isolation.security-boundary` |

<a id="workspace-isolation-policy"></a>

## Workspace方式の共通隔離方針（採用済み・借用実行接続中）

DirectとCandidateは同じDocker隔離方針（Docker Isolation Policy）を使う。作業対象が現在Treeか独立Worktreeかという差を、別の秘密管理・隔離Frameworkへ分岐させない。助言等の読取り専用と変更実行のRW条件は、用途に従って区別する。

| 対象 | 採用した扱い・責任境界 |
|---|---|
| ローカル開発用`.env` | 配置を許容し、Coding AIが読める可能性を人間が受容する。AIが読んだ内容がProviderへ送られ得る残存リスクもある。公開情報への分類変更や、CRDDが値をPrompt・Task Packet・通常logへ明示複製する許可ではない |
| 本番Secret | Gitおよび通常のローカル開発環境に置かず、GitHub・GCP・AWSの既存Secret管理を使う。Git管理外に置くだけで満たしたとしない。Cloud接続・秘密取得・AIへの自動投入機能は今回追加しない |
| 開発用Credential | 本番アクセス権を与えず、被害を限定できる権限と有効期限を既存の資格管理側で設定する。具体的な権限・期限は環境の運用責任者が確認する前提。DIが値からCloud権限・期限を自動検証／強制したとはしない |
| 残す技術境界 | 未許可Repository外のHost書込み、`.git`と実Git管理領域への書込み、`.crdd`内部状態への書込みを禁止する。Provider専用認証Home・Access Managementの鍵は開発用`.env`とは別区分で、既存保護と現在認可を維持する |
| 共通化するもの | 両方式のHost／Git／内部状態／認証境界と資源の開始・終了・取消・清掃。共通方針の採用を共通実装・全Consumer接続済みの証拠にしない |
| 追加しないもの | CRDD独自Secret Manager、ファイル単位ACL、動的Mount許可Framework。開発用`.env`を隠すための個別Mount列挙は新方式の必須条件にしない |

`.env`という名前だけで内容を開発専用・安全と判定しない。本番資格やProvider認証用秘密を開発用`.env`へ混ぜることは許容範囲外である。情報分類と既存の外部送信同意は維持し、「AIが読める可能性の受容」を無関係な送信先への包括同意にしない。CRDDによる既知秘密の明示収集・出力防止と、Coding AIが共有Treeから開発情報を読む可能性を分ける。

Candidateへローカル`.env`や資格を自動複製／注入しない。共通方針は同じファイル集合・書込み権限を要求せず、固定Baseからclean Worktreeを作る既存の採用判断を維持する。ファイルの別名から開発情報が読めること自体を新たなFail条件にしない一方、別名経由のGit／内部状態書込み等の必要境界は未実証のまま保持する。

本節は2026-10-17の人間判断を正本化した目標契約である。以前の一律秘密隠蔽案と合成試験は[変更計画の履歴](../../../99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#9-開発情報と共通隔離方針の変更2026-10-17)として維持する。Sourceの既知秘密拒否・候補投影・Provider保護は、採用した区分と利用側を照合してから切り替え、文書変更だけで撤去しない。新方針の実装・実境界はNot Run。

### 固定Path書込み境界の限定確認

本番の借用入口でも、作業Tree、空のGit placeholder、空の内部状態placeholderの三本を計画する。Reviewerだけ作業TreeをROとし、保護二本は両役割ROで固定する。実行前・構成診断およびID欠測時の発見では元placeholder Sourceを照合し、Mount欠落・余剰・RW化・Source差では構成一致としない。元Receiptの完全実IDがある回収では構成差を削除拒否理由にしない。新しいMount台帳・Lock・回復方式は追加しない。実Providerの新方式E2Eの結果は該当変更記録で別途追跡する。

2026-10-17の承認済み合成試験では、作業TreeのRW bindと、`.git`の型に合う空placeholder・`.crdd`空DirectoryのRO bindという三Mountで、Directory型とポインタfile型の固定Path書込み境界が成立した。通常Sourceの書込みと開発dummy.envの読取りを確認し、保護Pathの書込み・rename・unlinkは拒否、Host保護対象不変と試験物回収を確認した。[実行版・条件・限界](../../../99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#固定path書込み境界の承認済み限定結果2026-10-17)を参照する。

これは共通構成の採用候補であり、製品Sourceは未対応である。Secret完全隠蔽、あらゆるlink経路、任意Repositoryの保護や実Provider全体の成立を保証しない。実Git管理領域が別名で露出する場合や、保護Path不存在時の扱いを今回の成功から補完せず、本番接続前の適用条件とする。新しいACL・動的Mount管理・Recovery機構は追加しない。

### 現在の接続状況

2026-10-17の完成監査では、Task・Workbench助言・診断・修復・再起動・CLI回復は本PackageのRoot APIへ接続し、旧Coordinatorの`docker-desktop`／`docker-execution`／`runtime`は撤去済み。通常実行のCRDD署名前提も撤去済みであり、過去の署名Evidenceは新経路の証明に使わない。再認証の技術構築と上位の旧Docker環境profileは同監査で是正し、Source限定再レビューは両観点指摘0。§5の検査と実境界を現在計画へ照合し、本Packageの実装・検証を完了した。

上位の真正Owner／Writer／CLI、保持receipt・履歴保護・終了整理とfresh Taskへの接続は実装・局所検証済み。各技術部品の検証と実境界の成立は区別し、現在の判定は本節と§5の完成条件で行う。実境界で未実証の条件を完了へ読み替えない。

| 実境界 | 現在の根拠と限界 |
|---|---|
| 隔離・実ID回収 | 五資源の構成、実IDでの回収と不存在を確認。全Provider経路の成功ではない |
| 限定作成不明 | 認証確認用createの故障注入から同IDの正式終了を確認。汎用unknownへ一般化しない |
| 修復と退避物 | 新世代起動・Engine readyを確認。Windows自動disposalは拒否され、承認済みWSL保守後に同IDを正式終了。追加二領域の実障害Continuationは未実証 |
| 公開CLI取消 | executor実開始・稼働後の実Ctrl+C、回収・cancelled履歴・現在待ち0を確認 |
| 公開CLI親喪失 | executor完了後のreviewer準備中に親CLIだけを終了。Receipt保存再入場と両元IDの正式回収・現在待ち0を確認。executor実行中の親喪失とは区別する |
| 公式CLI実物 | 固定Image通常入口の版・三Hashと隔離・回収を確認。再Build・Host機能・全E2Eの証明ではない |

最新Sourceの通常全回帰は1,926件中1,912成功・9失敗・対象外5で終了した。失敗は試験VMの本番predicate接続漏れであり、試験一Fileだけの是正後24件成功・静的検査成功・両独立レビュー指摘0。未変更母集団と対象再検証を対応付けた現行評価は1,921成功・対象外5・未解消失敗0で、単一run全件成功とは扱わない。DI通常337件、実Host Process7件、認証隣接30件、状態回収の実Windows42件と上表の実境界を§5へ照合した。実測の詳細・元失敗・適用限界は[現在計画](../../../99_Roadmap/Changes/CHG-000082/second-stage-plan.md)を正本とする。

## 1. 責務と変更境界

<a id="ui-spec-detail-placement"></a>

### UI／SPEC Detailの配置分担

中央の[UI／SPEC Detail Architecture Traceability](../../08_UI_SPEC_Detail_Traceability.md)に対し、本領域はARCH-000004／ARCH-000008の次の8関係の技術担当だけを持つ。ARCH-ID・Owner Mode・UI／BHVの意味・QA義務は変更しない。

担当Interaction Relation: `PRT-000002.spec-000002`、`PRT-000002.spec-000003`、`PRT-000002.spec-000028`、`PRT-000003.spec-000004`、`PRT-000003.spec-000005`、`PRT-000005.spec-000009`、`PRT-000011.spec-000005`、`PRT-000012.spec-000017`

| 関係 | DIの技術担当 | 上位に残す責務・禁止する読み替え |
|---|---|---|
| PRT-000002.spec-000002／BHV-000002 | 受理後の別状態から呼ばれる隔離実行 | 受理自体はTask作成のみ。受理からProvider Effectを発行しない |
| PRT-000002.spec-000003／BHV-000003 | 既存の技術観測・通知を状態の根拠として返す | 状態照会は読取り。照会ごとに新Probeを発行しない |
| PRT-000002.spec-000028／BHV-000028 | 検証済み対象の技術取消、Process／Container終端、所有資源の回収・不存在／不明の観測 | Task／試行／世代／Authority検査、取消一回の編成、状態・Recovery保存、競合結果と利用者結果は上位へ残す |
| PRT-000003.spec-000004／BHV-000004 | 次行動分類に使う既存の実行・回復観測 | 分類判断は上位。分類から回復Effectを発行しない |
| PRT-000003.spec-000005／BHV-000005 | 許可されたDocker／Processの回収・終了後観測 | 対象・Authority・保存・保持判断は上位。一般Filesystem清掃を引き取らない |
| PRT-000005.spec-000009／BHV-000009 | 許可済み技術Probe・故障境界観測 | 診断許可から修復／再起動Authorityを生成しない |
| PRT-000011.spec-000005／BHV-000005 | 共同清掃のDocker／Process担当と終了後観測 | 実行時データの保持・削除判断と保存OwnerはARCH-000011側に残す |
| PRT-000012.spec-000017／BHV-000017 | 同じTaskに相関する実行通知・終了／回収事実 | 引継ぎ・現在Grant・結果取得・再発行は上位。結果再取得時のDocker操作を必須にしない |

対応するSCR／PRTは000002・000003・000005・000011・000012、BHVは000002・000003・000004・000005・000009・000017・000028。SCR-000011自体の保存意味は移さず、共同Relationだけへ参加する。取消28では技術取消・終端・所有資源観測だけを担当し、判断返却29は判断記録と再開可能通知まででProvider作用を開始しないため担当外である。この表は配置対応であり実境界の成立証拠ではない。以降の技術契約はこの担当範囲で適用する。

現行Sourceの依存方向は、同Packageのsrc、Node組込みModuleとPlatform AccessのRoot公開入口に限定する。上位Packageへのtype-only参照も逆依存として扱い、PA内部へのdeep importを置かない。通常の配置回帰は`tests/integration/package-boundary.contract.test.ts`が現src全数と反例で確認し、必要な技術入口四件は実Root exportへ接続する。これは署名・実行許可の検査ではない。試験の限定構文や未評価範囲はQA-000006を正本とし、旧署名graphの完全解析を再実装しない。

ProxyとProvider Homeの用途別構成はExecutorがIsolationRequestへ確定し、DIのexecution/preparation.tsとexecution/operations.tsが技術検査とDocker argv生成を所有する。旧九操作の構築・22引数のprivate包装・保存済みProxy包装の逆解析はtests/support/execution-plan.tsの有限Oracleに限定し、製品経路では使用しない。Providerとの意味相関はExecutorが検査し、上位へCommandや専用Hashを往復させない。

五資源名・所有Label・二Image digestの文法と五名の重複は、Executorが計画生成・開始前に検査する。保存IdentityはDomainの既存候補生成で検査し、CoordinatorはJSON変換前の文字列型確認を維持したうえでNative Home観測より前に候補を確定する。DIは一般Requestの技術検査を所有する。旧validatorはtests/supportの有限Oracleだけに残し、本番公開・共用しない。Task・Provider・Home・Authority・Packetの意味相関、既存回復の再入場・Receipt照合・清掃・配送条件は維持し、文法成功を所有権・存在・削除許可へ昇格しない。

固定Seccomp Artifactの実体照合は既存`execution/plan.ts`の非公開Resolverが所有する。上位は適用要否とProvider metadataの期待Hash／bytesだけを渡し、固定Host Pathを取得・搬送しない。DIは同じ固定実物のfile・非link・native realpath・容量・読取り前後dev／ino／size／mtime・本文Hashを照合し、Docker optionを構築する。例外・不一致・欠測と旧Path入力は計画不成立とし、nullを適用外へ補完しない。初回計画・発行前の再計画は固定実物を再観測し、import時の先行観測・Cache・新しいAuthorityは追加しない。開始済みの元Contextの清掃は同じplan identityとOwnerを照合し、Seccompの再読取りを清掃条件にしない。

資源回収の本番技術組立は既存`cleanup/execute.ts`の`createTrustedDockerRecoveryExecutor`が所有する。Executor経由で既存管理領域と任意の明示取消Signalを受け、低位入力を明示構築して固定CLI検証・最小環境を結合する。CLI snapshotはmodule共有の元寿命を維持し、初回観測成功後は別Executor・close後も同実体を再確認する。構築時には短命configの既存Filesystem処置だけを行い、環境は各要求時、CLIはその後に取得・再確認する。環境不明とCLI不明の理由を分け、再検証失敗から再観測へfallbackしない。低位factoryはDIの直接技術試験に維持するが、上位はそのCLI／環境注入を使用しない。明示取消・config再照合・元executor／closeの順序と回収結果は変更しない。

固定実行基盤のImage・Engine識別と非秘密profileはdescribeIsolationConfiguration()から投影する。Probeの名前・LabelはExecutorと既存保存SchemaのOwnerが同じ規則で構成する。DIには用途相関から名前を生成する関数を公開しない。記録Schema・保存field・Hash／Token形式は変更しない。metadataの取得は実資源の存在や実行・回収の許可ではない。

Attach試験用の三シナリオと観測待機は製品Coordinatorから撤去し、既存DIの実Process試験が直接所有する。ready・overflow・終端要求一回・元closeのOracleを維持し、上位のSTや実Docker取消の成立へ昇格しない。

Probeの本番接続はExecutorの`lifecycle/probe.ts`からDIの共通実行Ownerへ渡す。上位確定の管理所在を値で受け取り、同期Readerへの逆照会を保持しない。準備時と各要求直前のCLI／所在確認、Process終了・通知・回収条件は共通Ownerが維持する。旧固定bindingを使う反例は`tests/support/probe.ts`だけに残し、回復時のHost相関と最終公開は上位が所有する。

Probeのinspect構成と三つのbind mountの実体照合は、DIの`cleanup/configuration.ts`が所有する。既存の作成構成を実ID・名前・所有Label・Image・User・Entrypoint・完全Command候補とMountへ投影し、共通照合はProbe IDやprofileを解釈しない。旧試験supportのprofileは一候補、同supportで保持する旧record採用一箇所の明示`legacy_recovery`だけ固定六候補を選ぶ。この六候補選択を現製品の共通回収条件へ追加しない。欠測・空・未知profileへ候補集合を補完しない。構成判定は投影済み候補へのmembershipを照合し、上位の6領域全体、Host能力、保存Ownerを受け取らない。固定Image／Name／Label、三RW mount等の現行条件を維持する。Filesystemは各mountで観測側→期待側の順に各一回realpathを読み、例外はfalse、Windowsはen-US小文字、他OSは完全一致とする。これは実資源の包括的な安全性や新しいAuthorityを与える処理ではない。

旧診断Probeの作成IDと三軸（実ID・名前・Label）の不存在応答の純粋分類は、有限試験専用の`tests/support/probe-result.ts`へ移管する。分類条件は変更しない。現在の製品回収は共通Ownerと`cleanup/container.ts`の実体観測を使用し、旧分類を製品入口として公開しない。上位が利用する観測型は`execution/result.ts`に維持する。

単一Containerの現在構成観測と限定回収は`cleanup/container.ts`が所有する。構成一致時はRunningの肯定事実と非秘密ResourceSnapshotを返し、falseを停止・不存在と解釈しない。元Receiptの回収は過去の観測を再利用せず、同じ呼出しで実ID・名前・所有Labelの再確認→完全実IDの削除→実ID・名前・Labelの三軸不存在を順次確認する。不存在だけの観測は削除を発行しない。上位は私有Container参照を照合し、成功時だけ元のCLI・Host・Root・実IDに結合した私有不存在参照を登録する。下位の戻り値を外部から再投入する入口や新しいAuthority管理機構は設けない。作成・start・attach・取消全体と旧回復記録の移行は、この観測・回収単位の完成とは別に確認する。

停止前拒否の診断は、既存Machineが実際に得た判定から固定の`stopFailure`を返す。初回の信頼確認、公式Desktop状態、backend、Engine、Container不存在、境界失効、停止要求、停止待機、最終停止観測、例外を区別する。追加の観測や再試行は発行せず、既存の短絡順序・期限・要求数を維持する。停止成功・停止未実施・起動側失敗ではnullとし、次のstop開始時に前回値を破棄する。Runtime返却とsettled通知へ同じ値を搬送し、cleanup不明でも停止失敗の詳細を消さない。これは非Authorityの診断であり、既存reason／primaryFailure、耐久checkpoint、回復可否、終了条件は変更しない。Sourceと反証の完了前は実装済みと扱わない。

修復Identity v2はNative所有Hashを保持しない。nonce・Operation ID・Repository binding・consumerを内容Hashと回復IDへ結合する保存相関は上位Ownerの責務であり、DIはその値から処置許可を導出しない。

Docker Isolationは、Docker資源、所有子ProcessとDocker実行環境の技術Ownerである。通常隔離に加え、診断と、上位が許可した実行環境の停止・開始・限定修復の実処理を所有する。Containerを復元して継続するのではなく、所有資源の終端状態を確認し、上位が新しい実行を開始できる状態へ戻す。独立Server、CLI、履歴Store、共有Registry、Lock Frameworkは設けない。

助言Imageの通常準備のinit条件はExecutorの`lifecycle/attempt.ts`、回復時の旧期待値再構築は`lifecycle/cleanup.ts`が暫定所有する。回復ではworkbench_adviceと現行Image及び保持対象の旧exact二Digestだけを受理する。通常準備ではFactoryで検査済みのCodex助言方式から設定し、同じ条件を維持する。通常Task、Claude、未知・空・欠測Digestへ適用を拡張しない。DIは渡されたinit条件と実構成を技術検査するが、用途判定関数を公開しない。返却値だけではInitの実観測、Process終端や回収成功を意味しない。

### 起動失敗の診断

起動側は固定`startFailure`で、停止未確認、起動前の初回信頼・Client Process・Desktop Process・Engine・backend・最終信頼、境界失効、起動要求拒否、Ready信頼拒否、既存待機期限、例外を区別する。各startで初期化し、成功・起動未実施はnullとする。停止済み再観測の順・短絡・回数と既存期限は変えず、診断用の追加観測や再試行を行わない。Runtime返却・settled通知・上位の結果・手動試験器へ同じ非秘密値を搬送する。`stopFailure`、一次失敗、Effect不明、資源回収、処置許可を上書きしない。詳細位置は耐久checkpointへ追加せず、既存の再起動失敗理由の履歴保全と区別する。起動前拒否または評価例外は起動要求未発行のままで、起動要求直前以降の例外はEffect不明を維持する。

### 旧Probe試験supportの起動・取消保持契約

本節全体はtests/support/probe.ts・probe-plan.ts・probe-result.tsへ移した過去の有限反例の保持契約であり、現在の製品APIではない。以下の起動・取消・段階表はこの試験supportだけを指す。現在の製品の実行・取消・回収Ownerは、先頭の「共通実行Owner」を正本とする。

固定六profileのpayloadと期限はExecutorの`lifecycle/probe.ts`が所有する。現行の技術入力は共通DI plannerへ渡し、保存済み旧recordの採用条件はCoordinatorの既存Ownerへ残す。旧有限試験の固定構成は`tests/support/probe.ts`と`probe-plan.ts`へ分離し、製品の構成正本やAuthorityとして利用しない。profile欠測・空・未知をlegacyやnormalへ補完せず、永続recordのSchemaは変更しない。

旧試験supportの固定取消は`tests/support/probe.ts`の`runDockerProbeCancellation`が、保存後のattach前、ready後、候補成立後の三地点で同期の三Path読取りと固定構成inspectを行う。各読取りは初回Pathと一致させ、欠測・Promise・accessor・Proxy・差替えは前進停止とする。readyとcompletionの待機、SIGTERM要求は各5秒、猶予計測にはtimeout／overflow時の必要なjoin時間を含める。期限後の遅延肯定で結果を巻き戻さない。一次失敗、最終理由、post構成確認、attach終端観測と実終端要求数を分離して返す。joinの例外・不明は最終技術理由を上書きするが、上位の既知Container補償回収を妨げない。上位は二保存・同ID・Host清掃を維持し、候補・post確認・attach終端・Host清掃がすべて成立した場合だけ公開verifiedにする。稼働残存開始は同じ技術群でfresh構成→固定start一回10秒→fresh構成かつRunning肯定を行い、成功時の自動回収はしない。これらは一般の外部取消APIではなく固定診断の移管であり、実Container取消と実稼働回収の成立は別に検証する。

旧固定診断のCLI要求・profile別期限・実時計測と純粋分類は、`tests/support/probe.ts`と`tests/support/probe-result.ts`で過去の有限反例を保持する。現在の固定ProbeはExecutorの用途固有構成・結果解釈からDI共通実行Ownerへ接続する。旧分類の成功は、現行の実取消・実回収・DI集約全体の完成ではない。

旧固定診断のEngine確認、作成、作成後の実行と取消はtests/support/probe.tsの有限技術群として保持する。製品の技術群や公開wrapperとして復活させず、上位の前後二保存を跨ぐ自動pipelineを追加しない。

| 旧試験の段階 | tests/support/probe.tsの保持対象 | 上位結合試験で保持する責務 |
|---|---|---|
| 実行前 | 既存version要求とerrorなし・終了値0・trim後linuxの判定 | 拒否時にHost submission／createを開始しない |
| 作成前 | 固定profileとpayload・timeoutの閉じた対応 | Host submissionと実ID未確定の回復記録を保存する |
| 作成 | 固定構成のcreate一回と完全実IDの応答分類 | unknownを同じ回復参照へ保持し、推測ID・再create・startを行わない |
| 作成後 | ID保存前にstartを自動発行しない | exact IDを相関し、ID入り記録の保存を確認する |
| 実行 | fresh構成確認、完了まで待つ実行または意図的な残存開始、技術結果・実時計測 | profile選択、既存公開lifecycleの解釈、保存とHost相関 |
| 取消 | attach取得からready・Running肯定・SIGTERM・完了・必要な終端joinまでを所有する。固定三所在とBindingの元Directory／CLI実体を照合する | 呼出前に対象・所在利用許可を確認し、処置終了まで排他を保持する |
| 回収 | 既知exact資源の限定回収と観測結果 | 私有相関、Host清掃、公開結果と耐久保存 |

検証専用のrunDockerProbeCancellation／startDockerProbeResidueも確定した三Pathをown-dataとして捕捉し、上位を逆照会しない。Bindingはmanagementと三Mountの元Directory実体を保持する。ready後・SIGTERM前・終了後の固定構成inspectと、元Directory／CLI確認を維持する。Writer、Store、Host token、任意処置を下位へ渡さない。確認不能または例外後は新たなstart・SIGTERM等の前進Effectを発行しないが、取得済みの同じ所有handleの終端・joinや、既知exact Containerの補償回収は継続する。close不明を正常完了にしない。技術返却値では元実行失敗と回収結果を分離し、公開reasonの現行優先順は移管を理由に変更しない。

旧回復記録がprofileを保持しない場合の固定payload全候補は、tests/support/probe.tsに保持する旧回復反例に限定して照合する。通常経路へ任意source／timeoutを公開しない。実行中残存の作成は成功時に自動回収せず、旧回復経路はcreate・start・attachを行わない。実取消・実行中Container回収の成立は合成試験だけから主張しない。実装、上位の二保存と要求列の反証、必要な実境界が成立するまでは、この契約を実装済みとして扱わない。

| 基本設計 | 具体化する断面 |
|---|---|
| [ARCH-000004](../../Definitions/ARCH-000004/architecture_definition.md) | 隔離環境の開始・待機・取消・終了と所有資源の回収 |
| [ARCH-000008](../../Definitions/ARCH-000008/architecture_definition.md) | 要求、開始、Process結果、一次失敗、資源観測を区別した診断 |

| Owner | 所有する内容 | 下位へ渡す内容 |
|---|---|---|
| Coordinator | Task／助言、選定、送信許可、Provider Home利用許可、回復記録との相関 | 検証済み技術計画、既存Ownerに結合した所在・環境・資源Receipt |
| AI Adapter | 公式CLIの起動記述とProvider出力の解釈 | コマンド・stdinの記述。モデル／役割の意味は渡さない |
| Docker Isolation | Dockerコマンドの実発行、所有Process、Container／Network構成の観測と回収 | 開始・終了・出力制限・清掃の観測事実 |
| Orchestrator | Task／Attempt、Queue、耐久受領、再試行・採否判断 | Coordinatorの公開APIを利用。下位資源Stateは複製しない |

実行環境への運用介入を許可する判断と、その正本状態・相関は上位に残す。Docker Desktop／WSL等の実処理と技術観測は下位内部へ移し、Coordinator／OrchestratorはOSやDocker配置形態を選択・判定しない。公開Surfaceのユーザー資格、Role、ExposureはAccess Managementへ残す。

## 2. 入力と公開API

認証はExecutorがLogin／Statusの構成と結果解釈を所有し、DIのprepareIsolation／executeIsolationへ技術入力だけを渡す。旧createDockerAuthenticationRuntimeFactoryと認証専用Runtimeは製品Source／Rootから撤去する。元CLI、最小環境、System32、対話非捕捉、Process終了、Receipt保持と補償回収は共通Ownerが検査する。旧有限反例だけをtests/support/authenticationへ保持し、新入口の成立根拠にはしない。

### Desktop修復の内部Host操作

保存前の技術準備は固定Desktop Pluginの検証・共通wx取得・固定Directory対象の捕捉とする。既存の同期void通知を完了してから処置へ進み、Native補助子・H取得・Scope Hashを使わない。現在の詳細は後述の「修復Machineの本番接続契約」に従う。

技術checkpointの値契約と局所遷移はDIの`docker-desktop/types.ts`／`validation.ts`が所有し、Domain Modelは保存境界で同じ意味を独立に検査する。DIからDomain Modelへ依存しない。固定8処置を意図保存・発行・結果に分け、三用途の期待実体とsource／retainedの状態を保持する。前処置不明で後続意図を受理せず、一次失敗・cleanup・最初のcleanup失敗を混同しない。値検査の成功だけから実Writer・OS処置・修復成功を主張しない。

Desktop技術排他は共通wxの`.crdd-docker-desktop.lock`へ統合した。同じDesktopを扱う全Consumerが同じ設定基点を使用する運用前提で、取得した同じLockを最後の処置・結果候補まで保持する。元CLI終了不明ではFileを保全してdescriptorだけを閉じる。手動Docker／WSL操作や非協調Process、異なる基点の旧方式との並走を排除する保証ではない。新しいLock Framework・自動回復・監視は設けない。

公式停止・状態・起動受付はDI内部`docker-desktop/command.ts`、固定Backend停止は`backend.ts`、Directory退避は`directory.ts`が所有する。判断・Intent／結果保存は上位に維持する。個別Host操作・内部差替え入口をRootへ公開せず、WSL停止だけの公開APIも新設しない。

初回run退避はlocalAppData・操作ID・期待Identity、Continuation退避はさらに`failed_launch_run`／`secrets_engine`の固定用途だけを受ける。下位が固定source／targetを導出し、任意Path間の移動や削除を提供しない。Windows・正規絶対Path・32桁操作ID・三値Identityを確認し、Proxy／Accessor・余分keyを実行前に拒否する。元実体一致と退避先不存在をrename直前に再確認し、親実体の保持、rename後の退避先一致と元の明示不存在を要求する。同じ利用者の敵対的なPath差替えを原子的に排除する保証は追加しない。

初回runでは元実体一致を先に要求し、同Identityの退避先既存だけを未発行retainedと分類する。Continuationでは同Identityの退避先既存でもunknownを保持する。観測不能・rename例外を不存在や成功へ丸めない。公式停止のコマンド終了とbackend停止のProcess結果はEngine停止・資源不存在・保存確定や修復完了を意味しない。退避操作自体は削除しない。後続回収は次節の別契約とし、旧署名／履歴Storeを下位へ移植しない。

<a id="修復後の退避物回収採用済み実装未完了"></a>

### 修復後の退避物回収

通常は修復成功後の不要な退避物を使い捨てる。Docker Isolationは固定三用途の物理回収を所有し、Coordinatorは同じ修復操作への意図・観測保存と終了整理を所有する。Image・Volume・Provider Home・認証領域、任意Hostフォルダ、新しい再起動は対象外である。新Store・Registry・Lock・汎用回収Frameworkを追加しない。

元の修復checkpointは退避した事実の正本として保持する。後から削除しても、確定した退避実体・8処置・`stale=retained`・一次失敗を上書きしない。既存`cleanup`は元CLIと観測資源の回収であり、退避物の削除確認へ読み替えない。後続処置の保存・履歴・引渡しは[Coordinator詳細](../coordinator/01_Architecture.md#repair-directory-disposition)に従う。

| 境界 | 必要な確認・処置 |
|---|---|
| 対象固定 | 確定した基点と同じ修復nonceから既存三退避先だけを導出する。生Path・任意basenameを公開入力にしない。期待実体は元checkpointを参照し、別の正本へ複製しない。 |
| 発行前 | 元修復の成功・技術終端、現在Owner、確定した基点・固定対象の現在実体を照合する。用途別の回収意図が保存・読戻し・排他解放まで確認されてから物理処置へ進む。 |
| 非使用と対象実体 | 旧世代の停止、現在sourceの別実体、固定Scopeと退避先の期待実体を共同確認する。Engine ready・rename成功・lock観測のnullだけから非使用を推定しない。OS全handle不存在や敵対的な同利用者の差替え排除を追加保証にしない。 |
| 削除対象 | 保存済み実体と一致する固定退避Root全体。子のSocket種別・個別Identity・hardlink数による選別はしない。Root自体の明示Link・別正規Path・別実体は要求0で拒否。通常Link先の内容・存在の保全は新品Windows試験で確認し、全外側metadata不変や敵対的差替えの原子的防止は保証しない。 |
| 処置と終端 | 対象・親の直前実体を再確認し、対象だけを回収する。fresh観測で対象の明示不存在、親と現在sourceの保全を確認する。不明・部分成功は用途別に残し、成功へ畳まない。 |
| 中断再入場 | 同じexact ID・保存意図・固定対象で再観測する。不在なら不存在確認だけを進め、過去の削除発行を捏造しない。同名別実体や観測不能では削除せず、取消・Owner喪失後の追加処置を止める。 |

固定targetがNodeのlstatでENOENTとなる場合は、削除要求を発行せず、親のNode実体・正規Pathと現在Ownerを前後確認して現在不存在だけを返す。この無処置経路は別Pathの現在sourceを観測せず、source保全や削除成功を主張しない。targetが存在する場合のsource正規Path・実体・非alias・処置前後保全条件は維持する。権限エラー、その他の観測不能、親差、Owner不明は不存在へ補完しない。

| 代表例 | 期待する結果 |
|---|---|
| 通常回収の条件がすべて成立 | 意図保存→対象回収→不存在確認→後続結果確定→上位終了整理。元修復結果は不変。 |
| 調査用保持を判断したが引渡し未成立 | 削除しない。保持判断だけでは終了整理・fresh Taskを許可しない。 |
| 実体不一致・別Scope・非使用または観測情報不足 | 削除0で停止する。不明を不存在や非該当へ変換しない。 |
| 一部回収後の失敗、または削除後の保存失敗 | 確認済み事実を保持し、同IDで残対象と保存を再確認する。別実体の削除・完了済み処置の再発行は禁止する。 |

調査用の明示保持は既定7日とし、期限は判断時刻から算出する。期限到来は削除・延長の判断時点であり、自動削除許可ではない。対象・期限・利用者管理責任の引渡し成立を、保持判断だけから推定しない。通常回収と期限付き引渡しは既存上位Ownerへ接続し、実境界でのWindows自動回収未成立と区別する。

明示保持の照合情報は、追加Hashではなく既存Node実体の`dev/ino/birthtimeNs`を用途別に直接比較する。`observeRepairDirectories`は元nonce、終端checkpoint、取消と同期の現在確認に加えて初期化済みsettingsを受け、ユーザーデータ基点と固定対象実体を照合して三退避先を二読取りする。元retained presentは対応処置がsaved／issued／confirmedで、expected・元retained・fresh二回の実体が一致する場合だけ実体の独立コピーを返す。元retained absentは対応処置がnot_issued／not_requiredで、fresh二回もabsentの場合だけ用途内nullを返す。この場合expectedは元source実体を表し得るためnullに限定しない。新しいlive sourceの存在は保持先との照合を妨げない。

返却全体のnullは観測不成立、三用途内のnullは正規に保持対象なしという別の意味である。各読取り前後のOwner・取消・対象実体不明、元保持物の消失、別実体、用途交換、不完全な三用途は全体拒否とする。Desktop操作の取得・保存・削除・再起動を行わず、結果は削除Authorityではない。明示保持に限り、この非秘密metadataを既存一行履歴へ投影する例外を認める。生Path・Ownerは投影しない。後日は上位が確定したユーザーデータ基点とnonceから下位で固定先を導出し、実体を直接再照合する。照合不能は元対象の不存在を意味しない。

上位の保持receiptは判断時刻・exact7日後の再判断期限・三用途照合情報を同じ操作と履歴一行へ固定する。receiptの存在は明示CLIによる利用者管理への引渡し意思を表し、追加の責任者Registryを作らない。履歴は少なくとも期限前の期間整理から保護し、保存・読戻し・排他解放・履歴確認・終了整理の共同成立後だけRuntimeの追跡を終える。旧既出版値へreceiptを補完しない。この読取りから上位receipt保存・CLI説明・履歴保護・終了・fresh Taskへの接続は実装・局所確認済みである。

#### Windows実体観測と回収の分担

内部回収Driverは親・現在source・保存済みRoot実体と許可を削除直前に再照合し、Nodeのrm APIへrecursive=true、force=false、maxRetries=0で一回要求する。独自の子列挙・個別照合・256件／深さ8制限と一件ごとの取消は撤去する。開始前の取消は要求0、開始後の取消はrmをjoinしてunknownとし、処理中に先行して返却しない。削除成功後もRootのENOENT・親とsourceの実体・許可を確認し、部分失敗・後観測不明・再出現を成功へ補完しない。

内部composition `cleanupRepairDirectory`（公開はcleanupIsolationのDirectory overload）は、元checkpointの8処置終端、Engine ready、Host safe、操作cleanup confirmedと退避ありを確認する。元nonce・初期化済みsettingsから既存の固定対象を捕捉し、期待実体を直接照合する。Desktop操作・Helper Artifact・保存Scopeの取得／再構築はしない。現在Owner／保存意図と固定対象の同期確認をDriverの待機後・処置前にも適用し、委譲前拒否は未発行、委譲後例外は要求不明とする。PAの単一entry Native観測は利用0となり撤去する。

この入口は今回の要求事実と現在不存在を返すだけで、上位Writerの保存や終了整理を確定しない。用途別意図の保存・読戻し・排他解放は現在確認callbackの前提であり、保存代役の成功を真正保存の成立根拠にはしない。上位は進捗保存失敗後に次用途へ進まず、過去のrequest unknownを現在のissued／not_issuedで置換しない。

退避Rootを丸ごと廃棄するため、子の種類・実体を厳密に識別してから選択削除する契約は撤去する。子のLinkもNode標準の削除意味で扱い、確認不能な特殊物だから何でも独自unlinkするfallbackは作らない。標準処理が失敗したらissued／unknownとして元進捗を保持し、同じ回復IDで再入場する。rm API一回は単一syscallや原子的な全削除を意味せず、途中失敗で一部が消え得る。

maxRetries=0はアプリの追加再試行を禁止する指定であり、Node内部のWindows EPERM補正（chmod等）まで禁止するものではない。Hardlinkでは属性を共有するため、全外側metadata不変を一般保証しない。新品のread-only hardlinkは通常削除で外側内容・存在・modeが不変、削除側aliasを開いた場合はEBUSY・Root残存かつ外側mode不変を局所観測したが、全Filesystem／失敗条件の保証には拡張しない。

Socket自動回収を独立Capabilityとして維持するのではなく、固定退避RootのNode標準削除へ統合する。Node標準処理が回収できれば通常完了し、失敗は既存の廃棄進捗へ残す。既存保持引渡しは廃棄開始後に自動切替しない。特殊Socket実物・実Dockerでの再帰削除成立は未実施Gateとして残す。以下のNative観測実測は移管前の履歴であり、現行方式の成立根拠へ流用しない。

2026-10-17の自己生成Host試験では、異常終了した試験子のAF_UNIX端点が残り、raw tag `0x80000023`、Node Direntのlink=true、lstatのEACCESを観測した。Node unlink後の明示不存在と専用試験Root不存在を確認した。正常closeでは端点自体が消え、sandbox内のbindは拒否されたため、これらを残存端点の削除成功とは数えない。この実測は方式選択の根拠に限り、製品Driver・保存前後・三用途全体・実Docker修復の成立根拠ではない。

回収進捗の純粋値は、元修復とは別の`DockerRuntimeRepairDisposalCheckpoint`とし、Domain Modelの`attempt/repair-validation.ts`が局所遷移を所有する。DI Rootは既存の型・decoder・値上終端predicateを維持し、MachineはDomain Rootの一用途遷移検査へ直接接続する。保存先や新しい管理機構を追加しない。

| 固定三用途それぞれのfield | 値と意味 |
|---|---|
| `intent` | `not_saved / saved`。回収意図の保存段階。値だけで実保存を証明しない。 |
| `request` | `not_issued / issued / unknown`。過去の要求履歴。`issued`と`unknown`は相互変換・未発行への巻戻しをしない。 |
| `absence` | `unobserved / confirmed_absent / unknown`。不存在の観測。unknownからfresh確認へ進めるが、未観測へ戻さない。 |

合法tupleは未保存・未発行・未観測の1形と、保存済みの9形の計10形である。初回意図保存は`saved / not_issued / unobserved`だけへ進み、発行や不存在確認と飛び越して同時確定しない。validatorは更新用途を明示し、他二用途を全文保持する。不存在確認後はその用途のtuple全体を固定する。完全同値は値検査で許すが、専用Writerではno-op／Effect 0とし改訂を増やさない。

値上終端は三用途すべての`saved / confirmed_absent`を要求し、requestのunknownは残す。過去の`absence=unknown`だけで将来の要求を永久に拒否しない。一方、実Driverは要求前のfreshなexact実体・Scope・非使用・Owner確認を必須とし、現在確認が不明なら要求0とする。実観測、保存・読戻し・解放確認と物理処置は本番接続済みだが、純粋値の成立だけを回収完成やTask入場許可へ変換しない。

<a id="修復machineの本番接続契約実装未完了"></a>

### 修復Machineの本番接続契約

現行の技術接続は`runRepairSession(value, settings)`が所有する。閉じた入力を捕捉し、確定した取消Signalを`acquireDesktopOperations`へ渡す。固定Desktop Pluginの署名・内容・実体を既存CLI検査で確認し、共通wxを取得する。Native補助子・H・Helper Artifact・修復Scope Hashは使わない。取消・不正入力・設定欠測は処置前に拒否し、取得途中の不明を未取得の成功清掃へ変換しない。

`observeRepairDirectoryTargets`は、初期化済みユーザーデータ基点のlstat／realpath／再lstatによる安定実体と、nonce由来の固定三対象を捕捉する。Directory名用の32桁IDは既存domain `crdd/docker-desktop-repair-directory/v1`、NUL、UTF-8 payloadのbyte長UInt32LE、固定field順JSONから導出する。このIDは退避名の相関であり所有・処置許可ではない。可変run／Docker親／退避先の実体は各処置で確認し、基点・対象の再観測結果で元targetsを差し替えない。基点変更は冒頭の運用条件に従い、検出用の記録や代替Hashは追加しない。

| 境界 | 必要な保証 |
|---|---|
| 準備・初回保存 | DIが初期checkpointまたは合法な再入場候補を作り、`onPrepared`へ一回通知する。同期voidの完了前に修復Effectを発行しない。上位が現在Owner・保存・状態Lock解放を確認し、失敗時はthrowする。 |
| 処置 | 通常四処置はDesktop同期停止、必要なBackend停止、元run退避、Desktop起動受付。限定継続四処置は失敗起動後のDesktop停止、失敗run退避、secrets退避、再起動受付である。全8slotは固定集合で、旧強制終了slotは受理しない。 |
| 意図・発行・確認 | `intent=saved`の通知完了後にだけ処置し、発行を試みた事実と完了を分けて保存候補へ返す。発行後の取消・失敗・通知拒否でも既発行事実を未発行へ戻さない。 |
| 停止・起動 | 同期stop正常終了と公式status停止を別に確認する。Engine／WSL Backendも別に観測し、失敗起動後のDirectory処置前にも現在のBackend停止を要求する。startの受付は既存Engine待機の成功ではない。 |
| 終了 | 元CLIの終了・wx解放とEngine観測資源の終了を区別する。CLI終了不明ではdescriptorを閉じLock Fileを保全し、cleanup=falseを維持する。一次失敗・観測回収不明を後続close成功で消さない。 |
| 結果・保存 | DIの最終候補と上位の耐久保存確認を分離する。任意のPath・argv・保存能力・SessionをRootへ公開しない。試験依存差替えは内部入口に限定する。 |

開始済みの現在呼出しでは、未保存・未発行・未観測のslotだけを進める。発行後の不正な観測や通知拒否では、合法なunknown候補と同じexact相関を保ち、通知成功・未発行・明示不要へ補完しない。freshの未確定意図、未確定issued、unknown、cleanup pending／unknown、cleanup失敗では新Effectを発行しない。

cleanな未終端修復のfresh再入場だけは、保存済みconfirmedからpendingへ移す準備候補を使う。8処置・三実体・観測・一次失敗を全文保持し、候補の保存拒否では取得した操作をcloseして返す。新しい永続Session世代や履歴Storeは作らない。元checkpointの退避事実は、後の廃棄・保持判断で書き換えない。

Engine待機は`awaitEngine(stage, checkpoint)`で初回起動後と限定継続再起動後を区別する。`startup_timeout`単独では追加処置へ進まない。初回退避・起動の確認、旧退避実体との一致、新run／secretsの別実体・lock、公式Desktop状態、現在Engineのknown／transient観測などが同じ呼出しで成立した場合だけ、非永続のcontinuationを返す。transientをknownへ変更せず、保存Engineのunknownを保つ。追加停止後はEngine known・公式status stopped・Backend stoppedと各対象実体をfresh確認する。継続再起動後の待機ではcontinuation非nullを拒否する。

失敗起動世代の固定は`observe(checkpoint, phase)`の`current`／`failed_launch`で分離する。通常観測はfailed／auxiliaryの期待実体を新規設定しない。限定継続が成立し、追加四処置が未発行のときだけ、両sourceのpresent、両retainedのabsent、旧primaryを含む三実体の相互分離を一候補へ固定する。実codec・遷移検査・同期保存完了を停止意図と追加Effectに先行させ、欠測・別世代・取消・Owner喪失では新Effectを止める。

### 同exact修復の部分継続契約

部分継続は同じcheckpointの確定済みprefixを再発行しない再入場であり、新しい回復機構ではない。failed／auxiliaryは両方未固定または両方固定だけを認める。固定時は三実体の相互分離、通常四処置の終端、初回退避・起動confirmed、primaryの退避実体一致と現在の安全条件を必要とする。追加四処置は確定済みの連続prefixと未保存・未発行・未観測のsuffixに限り、gap・片側固定・未確定意図・unknownでは停止する。

freshでは保存済み期待実体をcurrent観測で同じ固定対象へ再照合する。未退避は元一致・先不存在、退避confirmed後は先一致と、次Effectが残る間の元Path明示不存在を要求する。再起動confirmed後の同名新世代を保存済み三実体へ上書きせず、Host処置を再発行しない。必要なら継続再起動後のEngine待機だけを進める。初回起動confirmed・pair未固定の再入場では初回待機へ戻り、同呼出しのfresh条件成立後だけ新pairを固定する。

`repair-operations.ts`は捕捉済みDesktop操作・Directory Access・Signal・現在許可を固定し、実行直前にも操作固有の前提を確認する。観測資源の終了不明はstickyに保持し、旧元不存在の保存事実から現在Path不存在を推定しない。同期OS要求は有界であって即時取消可能ではない。Source・有限代役・実Writerの限定検証と、未実施の実Docker境界・全体成立は区別する。

### 隔離用の静的資産

`images/`はClaude／Codex／Codex助言／通信プロキシのDockerfileと、収録済み取得・Build入力の期待値`build-inputs.json`を所有する。同JSONは全Imageの完全Build manifestではない。Codex seccompは`src/execution/`、プロキシ実装は`src/network/`、Provider固定設定はAI Adapterの`src/claude/`、結果Schemaは同`src/codex/`へ置く。固定Task検証textはCoordinatorの`tests/fixtures/`に属し、通常実行の配布集合へ試験Directory全体を追加しない。配布・Buildは実際に必要な固定Pathを明示し、任意Directoryを探索・採用しない。

Dockerfileの所在はビルドcontextを意味しない。ビルド時は検証済み公式CLIと各Ownerの設定を、Dockerfileが宣言するbasename・mode・Container内Pathを維持して明示的に組み合わせる。Codexは`codex`・`bwrap`と3結果Schema、Claudeは`claude`と2設定、助言は`codex`・`codex-code-mode-host`、通信プロキシは`src/network/`のPython実装を入力とする。Image内のProvider版・実行PathはDIの実行定義、取得検証材料は同PackageのBuild入力が所有する。配置変更だけでImage digestや資産Hashを更新しない。seccompの物理取得と実体・容量・Hash照合はDIの既存単一Resolverへ閉じる。助言Imageの三入力Context準備は既存Scriptで確認するが、他三Imageの実Build context自動準備と全Imageの実Buildは本配置変更で成立済みとしない。

Desktop修復の読取り技術処理は、`docker-desktop/directory.ts`と既存`docker-desktop/engine.ts`が所有する。上位修復は検証済み境界のDirectoryだけを渡して固定FS観測を呼び、前後の親実体と64件以内のentry集合が一致し、既知のopen拒否が少なくとも一つある場合だけロック識別子を受ける。非Windowsは下位入口でFS操作0のまま拒否する。open後のclose失敗は既知の拒否コードであっても観測不能とし、再closeしない。`null`は不存在・解放済みを意味しない。依存差替え入口はPackage内部試験に閉じ、本番FS接続も内部に置き、公開環境操作は共通二入口へ集約する。

内部のEngine待機は既定180秒・間隔1秒に固定し、読取り観測・取消判定・取消通知だけを受ける。`ready`・`unknown`は直ちに返し、既知の未起動・起動途中だけ再観測する。取消後の追加観測は行わないが、競合させたsleep timer自体の取消完了までは保証しない。時計・sleep・期限差替えはPackage内部試験用とする。上位が持つ観測cleanup不明のsticky保持、一次理由、記録順序は変更しない。WSL停止は単独公開せず、後続の修復Machine移管まで既存private処理を維持する。

Desktop修復のEngine読取りは内部`observeDockerDesktopRepairEngine()`へ固定する。旧RuntimeState／AppDataの構成領域を要求せず、既存のno-config環境・固定Linux endpoint・出所前後検査を用い、修復用途の4KiB／5秒・Timeout分類を維持する。明示構成付き修復の既存入口とは共通の固定観測処理を使い、Runtime用途の16KiB分類を変更しない。内部prepareには同じNative生涯のsignalと現在確認closureを渡す。発行前の現在確認は新Effectだけを止め、発行後の取得済み結果やunknownの単調記録を捨てない。

固定五資源からの旧回復期待値の再構築はExecutorの`lifecycle/cleanup.ts`に暫定的に残る。DIの共通回収はSnapshotのIdentityと要求状態を使用し、実行構成候補を要求しない。元Snapshotの新保存・再入場接続後に、この旧再構築を撤去する。Builderや個別predicateはRootへ再公開しない。

通常実行とAttempt／認証の単独回収はexecution/operations.tsの共通ContextとcleanupResourceIdentityへ接続する。既知実IDはID・名前・所有Label、ID欠測時は元Intentに基づくexact名／名＋所有Labelの同一一意ID、fresh Identity照合、必須発見ID通知、通知後の同ID再照合を要求する。単独回収で過去不存在が反証されたら残り資源の操作を止める。単独回収の資源終了通知は自作config終了前、最終Cleanup通知はconfig終了後とする。通常Attemptの上位資源終了通知は従来どおりDI config終了後・Home解放前に行う。通常・単独とも自作短命configを所有するが、単独取消後もProcess終了済みなら元実体・空を確認してconfig終了を試みる。同期Container単独操作は従来の同期性・三軸不存在・既不存在時の扱いを維持する例外であり、全操作が同じOwner／Requestになったとは主張しない。

Package Rootの`src/index.ts`から必要な操作と型だけを明示exportする。Capability内barrel、上位Packageへのimport、Provider専用入口は作らない。

現在操作用の回収接続は借用管理Directory内へ`docker-recovery-config-`接頭辞の一意短命子を作り、既存三資源操作とcloseだけを提供する。作成直前の明示取消、親と自作子の実体、空状態を照合する。既存同接頭辞の残存はfile／linkも含め96件まで数えるが、採用・変更・削除しない。自作Identityを取得できなかった途中失敗は清掃不明として同じHost Rootへ残す。closeはOwner失効後も捕捉済み親・子実体だけを再確認し、空の自作子を非再帰で削除して明示不存在を確認する。別試行や隣接物へ削除を広げず、二度目closeは追加Effect 0。同一Local Userを信頼する既存境界の現在観測であり、敵対的な同一UserによるPath使用中の差替えを原子的に排除する保証は追加しない。

技術入力は、操作相関、Container／Network名、実Image digest、期待構成、限定stdinと検証済みProvider起動記述とする。Docker argv全体・任意環境・任意Mountは公開入力にしない。閉じたpurposeから、Network、read-only、cap-drop、no-new-privileges、User、Mount modeと出力上限を下位Ownerが構築・再検査する。Provider argv／環境の記述は上限付きpayloadとしてContainer内へ搬送するだけで、モデル・役割等の値が含まれても、その意味や許可を下位が所有・判定しない。

Task Packet、モデル選定、送信同意、User Credential、業務結果は所有しない。上位は同じ生涯の計画を検証し、下位も資源名・構成・コマンド所属・入力上限をEffect前に照合する。単なる文字列Pathを所有許可へ昇格しない。

固定資源名と乱数値の検査は既存`execution/plan.ts`が所有する。実行namespaceは`codex`／`claude`の既存閉集合とし、上位で照合した不透明な64桁小文字hex Identityとsuffixから五資源名・labelを生成する。通常suffixは8byteのhexであり、単独helperの63文字防御境界は維持するが、長いsuffixをDocker commandの許可形へ拡張しない。乱数源と8byte→32byteの呼出順は上位Ownerに残し、DIは同じcallbackのBuffer型・長さ検査とhex化だけを担当する。新しい乱数源、Provider選択、所有証明または削除許可は作らない。

既存Ownerから借用するcallbackは、①専門Ownerが所有する実行能力のfresh観測、②検証済みoperation workspace／Host・Home leaseの借用と生存観測、③既存保存Ownerが検査済みの再入場projection、④既存結果／Receiptの用途限定照合、の閉集合へ限定する。Docker固有の実行物・環境・OS構成の観測は下位内部へ集約する。任意処理、上位State／Store／Repository参照、Lock acquire／release、Task／Authority操作は下位へ渡さない。観測callback自体はDocker Effectを発行せず、下位が各実処理直前の呼出し順序を所有する。例外・観測不能では新Effect前に停止し、既に発行済みなら一次失敗と残存観測を保持する。下位から上位への事実通知は§6の別方向の接続であり、保存・許可の委譲callbackと混同しない。

| 操作 | 結果と意味 |
|---|---|
| 開始 | 所有Handleを返す。Handle取得はDocker作成成立・Provider開始ではない |
| 開始観測・待機 | 有界待機。開始通知、終了Status、出力超過と観測不能を区別する |
| 取消・終了待機 | 所有Process treeと終了補助Processのcloseを確認する。取消要求だけを終了にしない |
| 診断attach | 入力は構成確認済みの実Container IDと固定ready prefix。下位が固定Engineのstart --attachを組み立て、ready・一次失敗・元子close・終端補助子closeを分ける。64KiB出力上限と共通Process Ownerを使用する |
| 通常Docker CLIの停止 | Node.js標準の`child.kill("SIGKILL")`で所有元子だけへ一回停止要求し、同じ猶予内で元子のcloseを待つ。killのtrue・false・例外を終了確認へ読み替えない。Host子孫停止は提供せず、Container内の処理は既存のContainer停止・削除・不存在確認で扱う |
| 同期診断 | version、固定Python Probeのcreate、実IDのinspect／start／SIGTERM／remove、ID／固定名／Labelの不存在照合を閉じた用途から構築する。固定Probeの技術選択とDocker観測結果の技術分類は下位。回復記録・3Mountの利用許可・診断実施の業務判断は上位に維持し、共通結果を元Operationの業務状態へ相関する。新しい任意Script／argv Executorは公開しない |
| 対話stdio | 対話許可は上位で判断する。下位のinherit方式は出力を捕捉せず、非対話callback／stdin搬送と同時指定しない。対話結果の意味・認証Authorityを下位へ移さない |
| 認証用技術計画 | 上位が公式CLI・専用Home・固定Imageと操作を指定する。statusは通信なし・Home読取り専用のProbe一資源、loginだけがProxyと二Networkを含む既存五資源。status入力にProxy・token・login引数を含めない。Workspaceは受け取らず、HOME／Proxy等の隔離設定の上書き、getter／Proxy入力と暗黙文字列変換を拒否する。生成Commandの元object相関は技術照合であり、Home利用Authorityや認証成功を生成しない |
| 認証Process | 元Commandだけを固定Engineへ発行する。上位の許可生存を開始前・実行中に観測し、喪失・非対話期限・出力超過で共通の元CLI停止へ接続する。一次理由とprocessCompletionConfirmedを分け、未確認なら上位がin_flightを保持し後続操作・完了記録・Home解放を拒否する。新しい下位回復Stateは作らない |
| 認証作成Receipt | create stdoutの実IDと直後の単一inspectを結合し、同digest Imageの既定Entrypoint／Cmd／Env／WorkingDirを含む認証構成を照合する。NetworkはDriver／Scope／Internal、Containerは実ID・名前・Label・Image・User・隔離条件・Network・Home bind・tmpfsを評価する。Proxy秘密値は耐久化せず固定形式と一意keyを検査する。結果が不明ならReceiptを返さず、上位の既存in_flight記録を保持する |
| 認証資源清掃 | 操作別の元Receiptを同じ元Planへ結合し、実ID指定inspectで実ID・名前・所有Labelを確認後だけ元removal操作を一回実行する。ID欠測Receiptは名前の不存在だけを観測し、発見した資源を削除しない。ID不存在だけから同名資源の不存在を推定せず、事後に実IDと名前を確認する。Proxyの接続形状とtoken形式等の構成条件は作成Receipt・診断で検査し、既知元IDの削除条件にしない。別操作の資源集合を相互代用しない |

診断・認証のDocker CLIと実行方式は下位内部で選ぶ。汎用の実行能力検証が必要な場合は、下位が選んだ同じ候補を既存専門Ownerへfresh照合し、その同一候補だけを実行する。上位の業務Adapterが候補Path・Engine・作業場所を組み立てたり、別のexecutable fieldと検証対象を組み合わせたりしない。認証Runtimeは生成時の元Planへ結合し、別Planの元Commandも拒否する。相関は同Processの元objectだけで行い、公開IDや永続Registryを作らない。認証清掃の観測・削除・不存在確認も、上位の既存exact Recovery記録で各開始前in_flight、Process終了確認後idleとする。清掃の終了不明／例外では後続0・完了保存0・Home解放0を維持し、fresh再入場で未終了操作を再発行しない。三用途は共通実行入口と資源集合／認証Snapshotへ接続済みである。有限試験の接続成立と、未実施の実Docker・実AIの全経路検証は区別する。
| 資源観測・清掃 | 元Receipt既知IDは実ID・名前・所有Labelを照合する。ID欠測では元Intent、二経路の同一一意実ID、fresh Identity照合、必須発見通知後の同ID再照合を要求し、実行構成差を回収拒否にしない。処置後は実IDと名前の不存在を確認する |
| 清掃結果照合 | 同じRuntime・操作・計画が返した結果だけを終端根拠にする。コピーした成功値は受理しない |
| 再入場 | fresh ProcessではCoordinatorが既存保存・Lock・exact回復Identityを検査した用途限定projectionを受け、現在実資源を再観測する。同Processの元結果照合とは分離し、下位で新しい回復記録や処置Authorityを発行しない |

## 3. 状態・順序・失敗

検証済み入力 → 要求発行 → Process開始観測 → 結果／一次失敗 → 所有Process終端 → exact資源回収 → 清掃観測 → 利用側へ返却、の順序を基本とする。完了・取消の競合では、元のProcess完了と清掃観測を待つ。遅延通知で処置を再発行しない。

| 条件 | 必須処置 |
|---|---|
| 入力不正・開始前取消 | 新しいDocker／Provider Effectを発行しない |
| 作成要求の結果不明 | 同じ操作相関と既存回復Identityを保持。不存在・成功へ補完しない |
| 結果正常・清掃不明 | 正常結果と清掃不明を別に返し、資源回収済みと表示しない |
| 一次失敗・清掃失敗 | 一次失敗を上書きせず、清掃結果を別の事実として保持する |
| 親Process喪失 | 元Processのobject参照は再利用しない。既存耐久recordを上位が検証し、同じexact回復Identityに結合した技術projectionで現在資源を再観測する。履歴値だけで不存在・削除許可を生成せず、下位はrecordを読書きしない |
| 他Owner資源・構成不一致 | 削除しない。名前・Labelだけを削除根拠にしない |
| 現在観測不能 | 不明として停止。空集合やfalseへ畳んで安全を主張しない |

Consumerの表示・任意保存は資源回収の終了条件に入れない。Candidateと必要な失敗根拠の保存は各Ownerが担当する。Orchestratorの耐久ACKもDocker資源回収とは独立する。

修復の短命な操作所有は`docker-desktop/repair-session.ts`へ置く。確定済みSignal、同じCLI操作とwx、固定Directory対象を最後の処置・結果候補まで保持し、取得後の拒否・取消でもcloseを待つ。技術依存差替えと個別Host処置は非公開とし、上位保存や実Docker成立をこの内部接続だけから主張しない。詳細は「修復Machineの本番接続契約」に従う。

同Moduleは初回／fresh入力を捕捉・復号し、freshのcleanup未確認・失敗・unknown・未確定意図を取得前に拒否する。取得後は同じ操作・取消・現在許可と固定対象を準備・通知の前後で確認する。onPreparedの同期void完了前にはMachineを開始しない。Machineの一次結果を後続closeで書き換えず、技術終了を反映した最終候補はfinalCheckpointConfirmed=falseとして返す。Root・Revision・耐久保存・Owner確認は上位の責務であり、Hashや下位結果から補完しない。有限代役の内部試験、実Writer結合、未実施の実Docker E2Eを分ける。

## 4. 配置・保存・実行環境

### 通常RuntimeからCRDD署名を分離する

2026-10-14の人間判断により、CRDD独自署名Manifest・署名Runtime Capability・巨大な配布閉包を隔離実行の必須条件にしない。現在の境界は[Coordinatorの三分離](../coordinator/01_Architecture.md#9-通常実行追跡正式配布の分離)を使用する。下位は署名から実行許可を発行せず、Commit／Hashも相関・同一性確認に限定する。必要なCLI・Image・設定の検査、固定操作、現在の用途限定binding、取消・実ID清掃・観測不能時の停止は維持する。Docker CLIの既存Publisher／Authenticode確認は別の出所確認であり、CRDD独自署名撤去をその一括撤去へ広げない。

通常Sourceと起動GuardのCRDD署名前提は撤去済み。必要なArtifactの観測は専門Owner、任意の正式配布検査はRelease／QA Ownerへ分け、旧署名検査から通常実行Capabilityを発行する接続を残さない。過去の署名E2Eは移管前の比較基準であり、未署名の新実行経路の証明ではない。

### 環境依存を上位へ公開しない

上位の発行前checkpointにある`unknown`は耐久保存した要求意図であり、下位のHost要求発行とは別の事実である。下位観測の`request`は補助資源取得中の失敗・取消では`not_issued`を維持し、実Native停止／起動要求の試行直前にだけ`unknown`、実受付後に`issued`、完了後に`confirmed`へ進む。下位の未発行観測だけで上位の保存済み意図を巻き戻さない。入力はProxy・Accessor・閉集合外FieldをEffect前に拒否し、own data propertyから一回だけ捕捉する。

内部の固定再起動入口`restartDesktop`は要求ID、取消、現在許可の同期boolean確認、発行前unknownの保存・読戻し確認と同期通知だけを受ける。保存確認後にだけ補助資源を取得し、固定停止・開始と回収を同じ操作で閉じる。補助Processの準備完了を要求受理へ読み替えず、Nativeの停止受理または開始受理が観測された時だけ一回の`request_accepted`通知を発行する。終端通知は最終技術観測と同じ不変値を持ち、配送評価だけを返却で別に保持する。既知async関数は確認・通知へ使用せず、非boolean確認、非undefined通知、Promise・thenable、throwでは新処置を止める。restartDockerEnvironment経由のRoot公開接続とfresh Writer接続を完成条件に含め、途中のprivate Source参照を完成形へ固定しない。

再起動結果は、一次失敗（`primaryFailure`）と片付け失敗（`cleanupFailure`）を別に保持する。両fieldは固定理由またはnullであり、一次成功後の片付け失敗に架空の一次失敗を付けない。片付け未実施を片付け失敗へ変換せず、Context再使用や開始前拒否は一次理由だけを返す。両方が失敗した場合、既存の最終`reason`は片付け理由のまま、最初の一次理由を消さない。片付け成功後の結果確定失敗は一次理由へ記録し、片付け失敗と混同しない。helperや排他の後続解放も、保持済みの失敗分類を消さない。任意例外本文や接頭辞だけが一致する文字列は公開せず、未知の失敗を固定分類へ変換する。

Desktop停止・起動・待機・補助Process回収は、取得からreleaseまで一つの下位固定操作へ閉じる。Coordinatorは[再起動要求の現在状態契約](../coordinator/01_Architecture.md#再起動要求の現在状態と下位の短命状態)に従い、既存exact操作の単一要求記録と現在の許可／Scope確認だけを所有する。下位は生Session、停止／起動の個別phase、任意argvやOS処置callbackを上位へ公開しない。要求発行直前の耐久checkpointが不成立ならHost要求0とし、同じ稼働Ownerの受付／完了通知、取消と補助資源回収を区別する。fresh再入場は過去の要求を再発行せず、現在観測を過去成功へ変換しない。この契約は移管先の完成条件であり、上位Caller／Writerは接続済みだが、接続だけを実境界・Package完成の根拠にしない。

Engine観測の実処理は`docker-desktop/engine.ts`へ置く。公開環境診断はinspectDockerEnvironmentへ統合し、これらの低位観測をRootへ公開しない。内部の固定観測は再起動用途の`observeDockerEngine(settings)`と、上位が検証した構成領域を受ける修復用途の`observeDockerRepairEngine(configurationRoot, settings)`だけとする。前者はconfigなし・16,384 bytes、後者は同一Rootのconfig／Home・4,096 bytesを固定し、5秒の観測期限、Publisher・前後同一性、既存の状態分類を維持する。修復用途のTimeoutは一時的な未起動として保持し、pipe不存在と観測不能・close不明を区別する。公開結果は共通状態と観測資源のcleanupだけで、生出力・Process・pipe・Pathを返さない。上位は操作ごとのclosureでcleanup不明を保持し、以後の観測0と最終blockedを保証する。元のexact IDとNative helper固有cleanup値は変更しない。再試行・待機は既存運用の責務であり、観測だけから修復や再起動の完了を主張しない。旧修復判定seamは既存試験依存の整理対象で、新しい本番観測の根拠にしない。

Docker実行物の固定Trust条件は既存`docker-cli/trust.ts`へ集約する。`describeDockerArtifactTrustContract()`は固定条件と既存Native ProtocolのPolicy Hashだけを返し、実体検証成功・実行許可・CRDD署名資格を発行しない。上位の記録が保持するHashは操作の相関値であり、上位でDocker出所条件を再定義しない。操作をまたぐDocker更新は許容し、操作中のPublisher・Identity・Hash固定は維持する。

`docker-desktop/backend.ts`はWindows／WSLの固定一覧操作と厳密分類を内部所有する。内部観測の`observeBackendState()`は入力を取らず、`stopped`／`running`／`unknown`だけを返す。公開利用側はinspectDockerEnvironmentの同じ診断結果を使う。未対応・観測不能はunknownとし、一時点の一覧からEngine全停止、Process不存在、再起動完了を推定しない。Quality導出キー`docker-isolation.backend-state`の純粋分類は`ERB-UT-034`、実取得と上位運用は既存IT／STへ接続する。

Coordinator／Orchestratorは、実行・取消・回収・診断・許可済み運用介入を環境共通の固定APIで依頼する。Linux／Windows／Docker Desktopの選択、固定CLI所在、Engine endpoint、System32、WSL、Process treeの終了手段、Host socketの技術判定は下位内部で所有する。上位の入力型・結果型・通知型に、OS選択field、Desktop専用phase、Windows実行物Pathを要求しない。環境別の実処理を上位callbackへ逆流させない。

下位は環境を判別し、検証済みの内部実装だけを使用する。現時点の成立済み実環境はWindows／Docker Desktopであり、APIを中立化したことをLinux対応の成立根拠にしない。未対応環境は共通の未対応結果で新Effect前に停止し、未知のbackendや未検証コマンドへfallbackしない。新しいPlugin／Adapter Frameworkを作らず、実在する実装と必要な内部選択だけに限定する。

子Process環境の固定PolicyはDocker Isolationが所有する。利用開始時に`initializeIsolation({ windowsDirectory, userHomeDirectory })`を呼び、Node.jsのPath・実体検査を経た`IsolationSettings`をコピー・凍結して受け取る。`windowsDirectory`はWindows配置先、`userHomeDirectory`はHostのOSユーザーHomeであり、Provider Homeではない。DIは環境変数やOSユーザー情報への暗黙fallbackを持たず、設定をグローバル登録・永続化しない。初期化は読取りだけでNative・PowerShell・Dockerを起動しない。

`prepareIsolation(request, settings)`、`inspectIsolation(target, settings, options?)`、`cleanupIsolation(target, settings, callbacks?)`、`inspectDockerEnvironment(settings)`、`restartDockerEnvironment(request, settings)`へ同じ設定を明示する。`executeIsolation(prepared, callbacks?)`は準備に捕捉した環境を使用する。個別の管理領域・一時Home・Provider Homeは要求側に残し、設定から推測しない。Docker CLIの固定実体・前後Identity／Hash・Docker Inc Publisherと既存の実行・取消・回収条件は維持する。親PATH・Proxy・Node設定は継承せず、固定PowerShell環境も同じ設定から投影する。

Windows所在は呼出し元の設定を信頼する。Native APIによる独立した所在証明からNode.jsの基本的なPath・Link確認への保証変更であり、SID／DACL・祖先Handleの保護と同等とは主張しない。PA自身のNative Helper起動環境は現在の独立保護を維持し、PAからDIへの逆依存は作らない。新しいManager・Store・汎用環境Frameworkは設けない。

通常実行はprepareIsolationとexecuteIsolationから開始し、上位確定の技術入力をown dataとして固定する。CLI・Directory元実体、環境、config、Process、受領ID、回収と終了は共通Ownerが所有する。上位の所在／Receipt Reader、任意Processの注入、旧固定九操作Runtimeへのfallbackを持たない。旧RuntimeとSessionは製品Source／Rootから撤去し、試験supportだけへ移管する。

必要なNative成果物の同一性確認、Host Root認可は既存専門Ownerに維持する。任意の正式配布署名はReleaseの責務であり、通常実行のCapabilityにしない。下位が借用する検査はその用途限定・環境中立の接続とし、CoordinatorがDockerのPublisher、pipe、WSL名等を解釈する接続にはしない。診断詳細として環境名や人間向けの具体的介入案内を返せるが、上位の制御分岐は共通の結果区分と許可済み操作だけを使用する。

上位が保存・chain・fence・Authority・履歴の正本Ownerであることと、Desktop固有の旧Schemaを現在の制御へ残すことは同義ではない。現在の入力・結果・通知・状態判断は環境中立のprojectionだけを用い、Docker固有phaseの技術解釈は下位へ閉じる。旧Desktop Schema／namespaceは移行元の根拠に限定し、現在phaseや実行許可へ流用しない。既存の人間指示に従い、旧形式の移行・清掃はフロントAIが確認して行い、Runtimeへ互換Reader・二重Schema・移行Frameworkを追加しない。過去の正式Evidence・署名・Hashは変更しない。未移行・相関不明の現状態は新Effect前に停止し、新Schemaの具体化・利用側・exact Identity・移行入力と停止条件を固定候補前に照合する。

実装は[40_Develop/docker-isolation](../../../40_Develop/docker-isolation)へ置く。既存のWindows Docker CLIの信頼観測、固定Engine、最小環境、shell禁止、出力上限と元Processのclose確認を維持する。2026-11-09の通常CLI整理ではHost子孫までの停止から元CLIだけの停止へ範囲を限定した。同等のツリー停止保証とは扱わない。対象は専用configと`--pull=never`を使う組込Container／Network／version操作であり、Plugin・Build・SSH Transport・任意Host子孫生成を追加する場合は停止契約を再評価する。固定Path・Authenticode・同一実体Identityと環境は各spawn直前に既存Ownerへ再照合し、観測後の差替え・不明ではEffect前停止とする。初回のboolean／Hash／raw Pathを以後の実行許可へ流用しない。未検証OSへ自動fallbackしない。

Package自身は永続State、Repository-local一時Root、新しいLock Frameworkを設けない。上位Coordinatorが既存Ownerで検査／借用した用途限定projection・workspace binding・生存観測・元結果だけを§2の閉じたcallbackで受ける。下位は現在State／回復recordを読書きせず、上位のRepository／Home保存Lockを取得／解放せず、借用元Capabilityから新しいAuthorityを生成しない。Desktop技術排他は上記の共通wx契約に従う。既存の検証済みbinding配下にある実行専用Docker CLI configの作成・実体照合・回収は技術Ownerの対象とし、Root作成・上位記録操作とは区別する。意味のあるEvidenceと通常診断の保持Ownerは変更しない。任意正式配布の署名を行う場合だけ、その配布対象と新Packageの対応を照合する。旧Source位置に依存する固定検査は必要Artifact観測・任意配布・旧比較へ分け、通常Runtimeの署名閉包を維持する理由にしない。

## 5. Qualityへの引渡しと完成条件

純粋な修復checkpointの終端判定は、厳格復号後に8処置の結果がすべて確認済み／明示不要であることだけを判定する。Engine・現在安全性・清掃・人間判断の総合判定や実操作の許可ではない。清掃は未要求→保留／確認／不明、保留→確認／不明、不明→確認だけの前進を許し、確認後は固定する。最初の清掃失敗は不明または後着確認と併存し、清掃未要求へ戻して消さない。

既存のCoordinator隔離・取消・回復義務を移管後の実Ownerへ接続する。移管を理由にLocal Itemを重複新設せず、既存義務、Test Symbol、実観測の対応を更新する。

| 検証面 | 観測と終了後条件 |
|---|---|
| 正常・入力境界 | 開始前拒否、固定引数、限定入力、正常終了。対象外Effect 0 |
| Process境界 | 実子Process開始・取消・出力超過・spawn失敗・補助Process終了。所有Handle／stream終端 |
| Docker境界 | 実Container／Network作成・構成・実ID回収・不存在。外部AI依頼なし |
| 失敗・回復 | 作成結果不明、部分Receipt、清掃不明、親喪失、同じIdentity再入場。一次失敗保持・不明の維持 |
| 本番利用側 | Coordinator Task、Workbench助言、CLI回復、診断、配布閉包から新Ownerへ到達。旧重複Ownerなし |

静的検査、移管先回帰、影響Consumer結合、実Docker局所確認、固定候補の技術・品質独立レビューが成立してからPackage完了を判定する。局所移管・モック試験・安全な拒否だけでは完成としない。実Provider全E2Eと後続のCoordinator／Orchestrator再編は別の未完了範囲として維持する。

追加の完成条件は、Coordinator／OrchestratorのDocker制御経路にOS／Desktop別の分岐・専用型・コマンド・Path・実処理が残らず、全本番利用側が下位Rootの共通契約に接続していることである。上位の正本保存、AI許可、Task／Attempt判断を下位へ移して行数だけを減らさない。§6の通知・結果と実観測の相関、必要な上位状態更新・伝播までを確認する。

## 6. 通知と上位状態の接続

### 九目的の実行単位と上位確認の分離

同じRuntimeの一回限りの実行単位（Session）が、固定九purpose、raw Handle、開始観測、待機、取消、終端と清掃を所有する。開始APIは不透明な`cancel`と`completion`を先に返し、実処理は返却後のmicrotaskで開始する。生成中のhook発火は0とする。終了後の取消・重複取消で新しい要求を発行せず、同じHandleのterminate/joinと清掃を各一回へまとめる。新しいStore、Registry、Lock、通知Queueは作らない。

| 同期接続 | 上位が判断・保存する内容 | 下位の扱い |
|---|---|---|
| command許可 | 現在の実行制約 | 明示trueだけで続行。再入取消を再確認 |
| CREATE前保存 | 元回復相関の要求予定 | 保存拒否後の要求0 |
| 未発行保存 | 保存後・発行前取消の事実 | 保存結果を保持し次要求0 |
| 実行要求前保存 | AI本体の要求予定 | 保存拒否後の起動0 |
| Receipt保存 | CREATEが返したexact ID | CREATE中取消でも成功Receiptを先に保存 |
| 完了観測受理 | 認証・AI出力の意味 | 拒否後の残purpose 0。意味・業務理由は上位所有 |

同期接続のfalse、throw、Promise返却は区別して閉じる。受理Gateは下位にAuthorityを発行する機構ではなく、上位の拒否を伝える有限接続である。下位の技術失敗・hook名・受理結果と、上位の業務理由を分離する。

最初の技術失敗は清掃前に同期の失敗通知で上位へ渡し、上位開始保存の遅い失敗や後続清掃で上書きしない。開始通知と失敗通知は保存Promiseを待つ接続ではない。通知の例外・非同期返却は配送未確認として保持し、その後の通知を再発行せず、技術資源の終端・清掃を継続する。

Providerの元waitは開始観測成功直後の同じ同期stackで一回登録し、成功・拒否を即時に閉じたsettlementへ結合する。通知破損時はSessionの終端確認がtrueなら同じwait終端を消費する。終端false／例外なら300秒waitを追加で待たず既存清掃へ進み、未解決観測は元RuntimeのHandle所有へ残す。後着settlementから通知・保存・結果更新・再終端を発行せず、未解決を不存在や清掃成功へ補完しない。Sessionの直接終端一回と、既存Runtime清掃による同Handleの終端再確認を区別する。

Process開始factの通知は同期であり、上位のReporter／Task開始保存Promiseを返さない。DIはその保存確認を待たず、Process完了・取消・清掃を継続する。Provider待機300秒はDIが`started=true`を確認した直後から起算する。旧実装の「上位開始確認await後に300秒」とは異なり、等価移管とは扱わない。setup待機10秒、開始観測／取消猶予5秒の数値は維持する。

上位開始保存が永久保留しても、DI側の期限・取消・自然終了と清掃は進む。上位の最終公開は保存確認のsettleも待つため、技術資源が終了しても公開結果が保留する場合がある。上位保存へ暗黙の新期限を追加しない。遅いfalse／throwは同じ不透明cancelへ一度だけ接続し、DI終了後なら新Effect 0で返す。清掃結果は同Runtimeの元結果と照合済み観測をそのまま上位へ搬送し、上位で成功形を再構成しない。

試験用Candidateは`productionAuthority:false`を固定し、本番FactoryのCLI／Process／Filesystem primitiveを差替え可能にしない。Candidate表示だけから注入primitiveのEffect 0や本番の清掃真正性を推定しない。上位の元Runtime／元計画／両Ownerの照合は維持する。

旧九Command診断Oracleはtests/support/execution-plan.tsだけに保持する。全descriptor取得前のcommands上限9、create argv上限427はその有限Oracleの条件であり、製品の共通Requestや汎用Docker parserの上限ではない。427は固定包装171（最大64環境変数・全optional構成）と旧payload上限256から導く。包装の分離値が欠けた形や次optionを値にした形は拒否し、image以後のpayloadへ適用しない。descriptor集合の必須keyと各valueはown propertyで確認し、継承値を採用しない。

同OracleのprojectDockerExecutionBoundaryはexactなcreate_provider一件の包装だけを解析し、payload内の同名flagや同digestを外側の設定へ数えない。製品の構成診断はこの逆解析を使用せず、Executorが固定RequestとDIの技術契約から予定設定だけを投影する。不正shape・欠測を成功へ補完せず、設定値を隔離成立・処置許可の証明にしない。生argvを通知・ログ・永続値へ追加しない。

下位は技術的な実行状態を持ち、上位はAI実行またはTask／Attemptの意味上の状態を持つ。Coordinatorは用途限定の通知callbackを登録し、元Operationへ相関して自身の正本状態を更新する。必要な事実だけを自身の公開契約でOrchestratorへ伝播する。下位は受信者のPackage、Task構造、正本Store、上位のイベント名を知らない。

| 方向・段階 | 搬送する内容 | 搬送・推定しない内容 |
|---|---|---|
| 上位→開始前 | 許可された技術操作、元操作相関、検査済み用途限定binding、取消 | 未検査の任意argv、OS選択、上位Store操作、Taskの採否判断 |
| 下位→要求／開始 | 元操作相関、要求発行・受理・Process開始等の実観測、観測された実資源ID | Handle取得からの作成成立推定、AIの業務開始・成功、次Taskの開始許可 |
| 下位→結果／失敗 | 同じ操作の技術結果、一次失敗、観測不能、出力制限、所有Process終端 | Provider生出力の業務解釈、秘密値、上位の承認・再試行指示 |
| 下位→清掃終了 | 構成照合、実IDと名前の現在不存在、清掃未確認、同じ回復相関 | 取消要求だけからの終了、過去unknownの成功化、Consumer保存済みの推定 |
| Coordinator→Orchestrator | 許可された元Task／Attemptに相関した共通の事実・結果 | Docker生操作、OS別手順、下位callbackへの直接接続 |

通知とawait返却を独立した二つの正本にしない。同じ不変の技術観測を通知と最終結果へ接続し、操作相関と実際の発生順を保持する。特に終端観測は通知と最終結果の元Operation・順序・内容を一致させる。途中通知をすべて最終結果へ複製する新履歴は作らない。観測時刻は観測した段階の値であり、時刻だけで完了・所有・因果を推定しない。遅延・重複通知は上位の完了状態を戻したり処置を再発行したりしない。取消後も実資源の終端・清掃結果を保持し、購読解除だけをProcess終了と扱わない。

実行SessionのonCommandSubmitting／onCommandNotIssued／onExecutionSubmitting／onResourceCreatedは直列に呼び、Promise<void>の完了を待つ。その他の通知（実開始・故障・Command観測・内容・修復・再起動）は同期voidとしPromiseを受け付けない。同期通知の非undefined返却と、待機可能な通知の非undefined解決値／例外は通知不成立として反証する。例外または不正戻り値の後は以後のcallback呼出しを止めるが、所有資源の終端・清掃と最終技術結果の確定は継続する。一次失敗や清掃事実を配送失敗で上書きしない。必要な通知の終了と技術清掃を確認して最終結果を一度返し、その前に登録参照を破棄する。返却後のcallback呼出しは0とする。

配送の確認／不明は技術結果・cleanupと別に返す。同期voidの完了はcallback呼出し完了だけを意味し、上位の耐久保存やOrchestrator受領成立を証明しない。callbackが上位状態を部分更新してからthrowした場合も既知Effectを巻き戻さず、上位は未確定保存と配送不成立を区別して自身の進行を止め、元相関を保持する。Consumerの任意保存・表示・耐久ACKをDocker cleanup完了条件へ含めない。新しいevent bus、永続通知Queue、Store、Lock、再送・配送Recovery Frameworkは追加しない。

Process喪失では通知が欠け得るため、通知受領だけを回復の唯一の根拠にしない。Effect前の上位exact相関と既存保存、同じIDでのfreshな下位資源観測を使用する。現在の実資源不存在を確認できない場合は不明を保持し、履歴のphaseや未着通知から不存在を補完しない。

| 代表例 | 必須処置・反証 |
|---|---|
| 発火 | 許可済みの実行／取消／清掃／診断／運用介入で下位が技術処理し、観測を通知する |
| 非発火 | AI選定・人間承認・Task進行・正本保存・上位通知の選択は下位が行わない |
| 境界 | 現在許可・bindingの生存を技術Effect前に照合。上位は通知を元Identityへ結合してから状態更新する |
| 不明 | 要求受理後のProcess喪失、観測不能、callback例外、未対応環境では成功・不存在を捏造しない |

検証は開始前拒否、部分Effect、取消、遅延・重複、callback例外・不正戻り値、通知欠測、親喪失、同ID再入場、清掃後不存在と上位の進行停止を対象にする。同時callback 0、例外後callback 0、最終返却後callback 0、登録参照0、部分更新後throwでも一次結果・cleanup不変を観測する。通知購読の存在や内部モックだけで、公開利用側まで成立したと判定しない。

## Docker関連の通知・操作・借用観測の境界（2026-10-31）

Docker Isolationは保存成功・Task判断・Provider内容受理のACKを取得しない。ExecutorはProviderの認証・内容・結果分類、Coordinatorは同Ownerの記録保存とTask進行を所有する。通知ハンドラーはinterfaceで明示し、戻り値はvoid又は許可された段階だけPromise<void>とする。任意通知の未登録は非購読、登録済み通知の例外は失敗として区別する。

| 接続 | 現在の責務と順序 |
|---|---|
| 実行Session | DockerExecutionCallbacksの発行予定・未発行・実ID通知は完了を待つ。完了観測・内容通知・実開始・故障通知は同期void。allowCommandは撤去し、診断初期化は既存のonCommandSubmittingへ統合する |
| Command観測・内容 | ExecutorがAI Adapterの検査を使用する。認証不成立・内容不正はハンドラーがthrowし、下位は以後の要求を止めて同じ資源を回収する。Boolean受理結果を返さない |
| 修復 | onPrepared／onCheckpointは同期void。canRecordCheckpointは撤去し、上位ハンドラーがOwner・Scopeと保存結果を検査する。取消後の既発生事実の記録は新Effect許可と区別する |
| 再起動 | beforeRequestはonRequestingへ変更し、発行予定を同期voidで通知する。上位の保存失敗はthrow。onEventと同様に保存結果を下位へ返さない |
| 借用元の生存 | 環境修復のcanIssueEffect／verifyBoundary、disposeのboundary／DirectoryのcanIssueは、借用元の失効・Scope・取消をEffect直前に再観測する用途に限定して維持する。保存や新Authorityを発行しない |
| 所在・既存Receipt | 通常Attemptは固定paths、Probeは固定mountsを捕捉し、上位を逆照会しない。通常回収はSession内Receiptを明示し、欠測は未確認。旧読取りfallbackは持たない |
| 技術代役 | DockerCommandSessionOperations等は同じ責務の実在技術境界だけで利用する。上位の業務操作を注入しない |

修復MachineのcheckpointNotificationCompletedは通知の同期完了だけを表し、耐久保存を証明しない。上位の最終保存確定はCoordinatorが判断する。通知例外・取消でも元Receipt、exact回復参照、一次結果、cleanup不明を保持する。通知待ち中の取消では次要求を発行せず、最終返却後は通知参照を残さない。Timeout・Image・Mount・Home排他・実資源の安全条件は変更しない。

実行SessionのnotificationDeliveryConfirmedは、実際の通知試行がない場合null、全登録通知の完了時true、通知の例外・不正返却時falseとする。falseは同操作中に戻さず、失敗後のonFailureを含む通知を止める。Command自体の失敗をonFailureへ正常通知できた場合は、技術失敗と通知成功を区別する。どの値も耐久保存を保証しない。

低位Processの`observeStdout`は同期voidの出力観測であり、任意の非同期通知へ変更しない。同期例外とundefined以外の返却は既存の観測失敗として扱い、後者のPromise拒否を捕捉してから既存の出力失敗flag・元Processの終端要求へ接続する。即時成功Promiseも同期完了ではないため受理しない。後着拒否は消費だけとし、追加終端や結果更新を行わない。probe内部の`observeFixtureOutput`は不正返却を隠さず外側へ返し、そのchunkから新たなreadyを成立させない。既に観測済みのreadyは巻き戻さず、元CLIのcloseを確認し、停止要求だけを終了成立へ換算しない。


## 共通入口整理の残件1〜5の確定境界（2026-11-02）

DIの公開値は共通技術操作6件、固定構成照会1件と明示初期化1件の8入口に限定する。補助検査を減らすためだけの検査用APIや実環境観測は追加しない。

| 契約 | 正本・利用側 |
|---|---|
| prepareIsolation / executeIsolation / inspectIsolation / cleanupIsolation | DIの共通技術Lifecycle。用途別の実行・回収入口を再公開しない |
| inspectDockerEnvironment / restartDockerEnvironment | DIの環境技術操作。実施判断・保存はCoordinator |
| describeIsolationConfiguration | Provider配置と、引数なしで得る固定実行基盤metadata。Image存在や稼働状態の観測ではない |

### 用途固有の構築と保存判断

- 固定五資源の旧回復期待値構築はExecutorの`lifecycle/cleanup.ts`に暫定残存する。通常のinit構成は`lifecycle/attempt.ts`が所有する。DI回収は元Intent・二経路の同一一意ID・fresh Identity照合・必須発見通知・同ID限定削除・不存在確認へ接続し、Image・User・Init・Tmpfs等を識別条件へ加えない。実行前の構成検査は維持する。
- 認証資源のReceipt列捕捉はExecutorの`lifecycle/authentication.ts`が所有する。Proxy・accessor・順序差・名前差・不正実IDの拒否は維持する。
- Probe用の名前・Label投影は実行Owner又は既存保存SchemaのOwnerが所有する。DIのCatalogは固定Image・Engine・非秘密profileだけを返す。既存記録の文字列・Schemaは変更しない。
- Coordinatorの保存済み修復Checkpoint終端判定は既存Domain Modelを使用する。DI内部は技術境界の独立検査を維持し、Domainへの依存は追加しない。

### 型の所有

旧九操作CommandとSessionの型、五用途Receipt、Home Lease、認証結果・通知は実装OwnerであるExecutorへ移す。argv付き旧Commandと旧SessionのHandle・操作代役は試験supportだけに残す。製品側の用途識別子は既存PURPOSESから導出し、Command全体を再定義しない。

DIは共通Request・Execution・技術Callback、ResourceSnapshot・観測・構成期待値、環境操作とProcessの技術分類型を所有する。外部製品が必要な型だけRootから公開し、試験専用型を含めない。

### 保持する保証と検証範囲

実ID・名前・所有Label、ID欠測時の元Intent・二経路一意ID・必須通知、Directoryの固定用途、Receipt通知失敗、Process終了未確認、config終了未確認、取消、元相関とunknownの条件を変えない。有限代役試験と型検査はこれらの配線・値契約を確認するもので、実Docker・実AIの成立を代替しない。


## 公開型の最小境界（2026-11-03）

公開型は35個から19個へ整理する。環境操作はmode対応のDockerEnvironmentRequest／Resultを、資源操作はResourceTarget／Inspection／CleanupResultを使用する。各Mappingは既存Ownerの型を参照し、新しい資源モデルや実行機構を作らない。

| 共通型 | 保持する相関 |
|---|---|
| DockerEnvironmentRequest<M>／Result<M> | restartとrepairの元入力・結果。省略はUnionであり、modeとinputの交差混入を許さない |
| ResourceTarget<K,A> | snapshot／container／directoryとinspect／cleanupに必要な必須入力。Directoryの観測と廃棄を混ぜない |
| ResourceInspection<K> | 種別固有の現在観測。Directoryの全体null、Containerの三値とRunning肯定を維持 |
| ResourceCleanupResult<K> | 回収の最終技術結果。Snapshot回収で返すIsolationExecution Handleとは区別する |

Containerの同期結果、Directoryの元Promise、Snapshotの取消可能なHandleを共通async関数へ変えない。内部の個別型は既存の技術Ownerに残し、Rootからの便利な再公開を撤去する。Coordinatorの保存Checkpoint型はDomainの正本を利用する。

実行通知はIsolationCommandResultの結果包絡を公開し、元観測・終了分類・実行分類はその既存Property型から参照する。環境通知に必要なDockerEnvironmentRestartEventは公開を維持する。期待値predicateはDI内部だけで維持する。CLIとFilesystemの実体観測を伴うprepareIsolationは純粋な入力検査の代替ではなく、公開数のために検査用API・分類表コピー・追加実観測を設けない。DockerResourceExpectationの個別Root公開は不要とし、ExecutorはResourceTargetのdiscovery入力から同じ構成型を再利用する。

### 用途非依存の資源照合と固定Image制約

DIの実行・観測・回収はOperationのpurposeでは分岐しない。Executorは既存保存投影から技術期待値を構築し、DIは不透明なkeyでSnapshot・探索候補・通知を相関する。探索候補はkey・種別・予定名・所有Labelの一致を要求する。固定五資源の選択・構築はExecutorが所有し、DIのcleanup/types.tsとcleanup/validation.tsは技術構成だけを扱う。旧形式の互換Readerや保存Schema変更は追加しない。

| 条件 | 照合・拒否 |
|---|---|
| 元実IDあり | 元実ID・名前・期待された所有Labelのキーと値を照合する。ImageやMountを新しい削除必須条件にしない |
| 元実ID欠測 | 元Intentに基づきexact名／名＋Labelの同一一意IDを発見し、fresh Identity照合、必須識別通知、通知後の同ID照合とID限定削除、不存在確認を行う |
| 名前・Label | 安全なcrdd名前とcrdd.名前空間のLabel文法に限定し、要求値との完全一致を別に確認する。用途名の閉じた一覧は持たない |
| Mount・Network | 期待集合・読書き・伝播・指定時のsourceを照合する。source未指定は旧契約どおりsource非比較であり、存在不要の意味ではない |
| Directory | 既存の固定用途・実体・廃棄条件を維持する |

固定ImageのUser・Entrypoint・外部Network可否はimage/assets.tsの静的Catalogを正本とし、共通準備が読む。未知Imageや許可外の構成を拒否し、任意Imageへ開放しない。Catalogはprimary／alternateの技術配置を返し、Task／Adviceの選択はExecutorが行う。Catalog内のalternateIdentityはRuntime配置名であり、Build入力JSONの既存fieldを改名しない。Rootは初期化を含む8関数・16型とするが、discovery期待値の構造とCatalogの入れ子fieldは利用側も追従する契約変更である。

新用途の安全Label・相関keyによる共通実行と回収、構成field単独不一致、別Labelキー、別key探索候補、未知Image・User・Entrypoint・外部接続の負例を有限試験へ接続する。実Docker・実AIの成立はこの有限試験から推定しない。

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
