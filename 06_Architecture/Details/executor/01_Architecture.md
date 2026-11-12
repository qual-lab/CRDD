# Provider単段Executorの詳細設計

## 計測表示・検証診断の残存制限撤去 — 2026-11-12

Task要約の計測表示は2,048byteで非表示にせず、正常な本文を全量表示する。制御文字・秘密値・Host Path・役割・実行順序・元結果保全・回収確認という表示条件は維持する。実E2E検証ToolのCommand／File開始件数も4,096を超えたことだけで欠測化しない。非負の安全整数・固定field・結果相関は維持する。Bootstrap、実Process出力、イベントFile清掃の別契約は今回変更しない。限定回帰は模擬結果のみであり、実AI／Dockerや全体回帰を実施したとは扱わない。

## Provider入力の独自容量制限撤去 — 2026-11-12

Task／Adviceで確定済みの`providerInput`を128KiBという量だけで再拒否しない。型・非空・用途と選定の相関・完全Plan照合は維持し、stdinをargv／環境へ移さない。Bootstrap構成payloadの上限は別契約であり、Process出力・Timeout・取消・Cleanup・Home Leaseは変更しない。旧境界超の基本検査と完全Plan検査を模擬依存で確認し、実Provider／Dockerの成立とは区別する。

## DI環境の明示設定 — 2026-11-10

三用途のOptionsは、上位が`initializeIsolation({ windowsDirectory, userHomeDirectory })`で取得したDI正本の`IsolationSettings`を`settings`に受け取る。認証・通常AttemptはFactoryで値を捕捉し、Probeは準備で固定する。ExecutorはHostの環境変数やユーザー所在を再取得せず、Provider Home・管理領域・一時領域をこの設定から推測しない。`inspectResources(target, settings, options?)`／`cleanupResources(target, settings, callbacks?)`と環境操作にも同じ明示設定を渡す。設定をResourceSnapshot・保存投影へ追加しない。

作成Receipt通知は、DIが成功応答の完全実IDを保持した後、実行前の実体・構成検査より前に上位へ搬送する。上位は既存のreceiptイベントで同じOperationへ保存し、存在観測・構成検査成功・AI実行開始へ昇格しない。構成拒否でも元IDは回収と最終Snapshotへ残す。通知拒否では後続実行を停止する。Receipt通知完了後にreceiptRecordedを更新し、通知拒否を保存済みと表示しない。応答後取消でも既知IDの通知は省略しない。

PrimaryFailureDiagnosticの任意isolationFailureはDIの元failure型を再利用し、reason・stage・notification・kind・例外分類・要求／応答観測を保持する。既存の上位reasonとstageは利用側の分岐のため維持し、技術診断の集約で元停止点を消さない。後着のCleanup／通知失敗で一次技術診断を上書きしない。生例外・inspect本文・認証値は返さない。検証ToolのJSON受入れも同じ項目へ追従し、公開関数・Root Export・Domain保存Schemaは増減しない。

現行Sourceはindex.tsとlifecycle/{types,execute,attempt,authentication,probe,cleanup}.tsの7Fileへ統合した。汎用LifecycleOperation／executeLifecycleは廃止し、Controlと用途別処理へ整理する。製品の旧Recovery再構築は撤去し、cleanup.tsはDI正本のSnapshot観測・回収へ直接接続する。旧試験群の移行と固定候補の回帰・独立レビューが終わるまで全体完成としない。新保存形式の採用は人間承認済み。PreparedIsolation拡張とUser・Init・Tmpfsの追加保存は取り下げた。DIの欠測ID回収は元Intent・一意実ID・名前・所有Labelを確認する方式へ変更済みであり、Snapshot・key別checkpoint・元回収方針の耐久保存と再入場を接続した。旧認証・Recovery試験Adapter二ファイルと製品参照は撤去した。実Host／Windows Process Gateと実AI・Dockerの再成立は今回の非AI試験とは分けて未実施として扱う。
五資源名・所有Label・固定Digestの文法と資源名の重複検査は、Executorの生成時と開始時の入力検査へ統合する。 開始前の構成では用途別prefix・Label・Digest・boolean相関・保護Pathを検査する。回収では保存済みDI Snapshotを使用し、用途から期待構成を再構築しない。固定生成のpurpose・kind・Network候補は構築実装の不変条件として試験し、DIの検査関数を公開して生成後に呼び直さない。未要求・限定観測・選択外資源でも入力全体を先に検査する。技術排他の取得前に拒否し、DIの個別validatorを公開して上位へ往復させない。Coordinatorの保存形式の検査はDomainの既存Snapshot候補生成が所有し、資源名の重複も保存前に拒否する。通常のDI Request検査・元実ID照合・回収条件は維持する。

Attempt準備のcreateRandomHex／createResourceNames／createAuthenticationEnvironmentはlifecycle/attempt.ts内だけのローカル関数とする。乱数8／32byteの各一回取得とBuffer検査、二Providerの既存prefix・Hash先頭16桁・63文字境界・所有Label、予約環境名の拒否と固定/provider-homeを維持する。資源名の一関数専用型は増やさず、戻り値六項目を署名へ明示する。これらの構成値を資源存在・実行許可・回収成立の証明に使わない。

DIのonObservedから受けた実行分類を同じ参照のまま上位通知へ搬送し、同じ終了値分類をAttempt最終結果へ使用する。Executorで分類関数を再呼出ししない。既存の元観測・経過時間・固定エラー分類・同期性を維持する。DIの開始時再検証失敗は既存の型付きfailureで受け取る。Executor自身又は試験代役からの未知例外はunclassified_exception固定とし、DI分類関数の再呼出し・分類表の複製を行わない。

低位回収Factory・照合関数・出力上限と、製品で直接使わない内部型はDI Rootへ要求しない。Executorの回収は共通inspectIsolation／cleanupIsolationを使い、試験Scriptだけが内部の技術型を元Ownerから参照する。通常実行の構成補助・結果分類と公開Callbackに必要な既存型は別途整理する対象として維持する。

環境診断・再起動／修復はDIの共通二関数をそのまま利用し、CLI構築・出所照合・Engine／backend低位操作を組み立てない。DI低位16項目の内部限定化ではExecutorの本番呼出し・認証構築・入力／結果／通知・取消の契約を変更しない。

## 構築前の静的Catalog接続

Attemptと認証の構築前metadataはDIのdescribeIsolationConfigurationから取得する。固定Assets・Image内配置・ProxyはDI正本、ProviderのCLI仕様と結果解釈はAI Adapter、用途に応じたImage／配置の選択はExecutorが所有する。Codexの既存別Imageにはalternate配置を用い、Claudeには存在しない別配置を要求しない。認証は追加Hostを渡さず、Provider固定通信だけを維持する。Catalog取得はFilesystem・Engine・認証の観測や新しい実行許可を発行しない。

旧Assets／配置／Proxy記述のRoot公開は撤去し、検証ScriptもCatalogへ接続する。旧低位試験の比較OracleだけはDI内部の正本を明示参照し、製品APIとして復活させない。旧Commandと共通技術Requestの二重表現は製品から撤去し、同じ固定RequestへのSource接続を完了した。現在の候補で回帰・独立確認を行う。全資源の観測・回収は共通DIへ接続済みである。固定候補の回帰・独立レビューと、実Host・実AI・Dockerの再成立は区別して評価する。

## 共通DI実行入口（2026-11-02）

資源集合の観測・回収はDI正本のResourceTargetと元Snapshotを受け取り、inspectIsolation／cleanupIsolationへ直接渡す。Executorで旧Projection・ReceiptからSnapshotを再構築しない。上位のOperation／Recovery相関、保持・許可・保存判断はCoordinatorに維持する。単独回収の取消とCompletionは元DI Sessionのまま返す。

認証資源だけを限定指定した観測では、欠測IDを追加探索せず、stopOnUnknownAbsenceを指定する。集合全体の観測ではこの条件を適用しない。未要求だけならDI要求・config作成0を維持し、観測できていない入力Snapshotを実測結果へ補完しない。単一Container・固定DirectoryはDI共通公開入口の技術種別overloadへ接続する。技術入力・観測型もDI正本を再利用する。認証単独回収も保存済みSnapshotと元回収方針を使用し、認証要求から資源を再生成しない。

AttemptのCompletionResultは信頼した上位へ非秘密ResourceSnapshotを返す。SnapshotにMount元Pathが含まれる場合、hostPathReportedはtrueとなり、結果全体にPathが無いとは表示しない。Snapshotを持たないStartResultはfalseを維持する。Coordinatorの保存・外向けDTOはSnapshotをそのまま転送せず、選択した非秘密fieldだけを投影する。Core保存Schema・外部公開Validatorをtrue許容へ緩めない。

固定Probeは用途固有の構成と結果解釈を`lifecycle/probe.ts`で所有する。`lifecycle/probe.ts`は同じDI元準備を一回実行し、技術操作を順に組み立てず、DI CompletionのProcess終了・回収・非秘密ResourceSnapshotを結果へ搬送する。開始前取消、必要通知の同期性、通知失敗後の前進停止、任意完了通知の失敗捕捉を維持する。結果観測後の取消で既存の失敗理由を取消成功へ上書きしない。

認証の通常実行も共通DI入口へ接続する。公開Factoryは認証要求とAuthenticationOptionsのmanagementDirectoryとsettingsを受け、Factoryでは固定値・投影だけを構成する。上位が記録を受け付け管理領域を用意した後のstartで、DIの元実体準備と一回実行へ接続する。statusはHome読取り専用・Networkなし、loginは従来のProxy・Home書込み・TTYを維持し、WorkspaceをMountしない。非対話30秒・対話無期限を変更しない。Completionは認証三値、Process終了、回収、非秘密ResourceSnapshotを分離して返す。終了1を受理するのはstatusかつ正規未ログインの場合だけで、終了1と認証済み出力の矛盾を成功にしない。

通常Attemptは同じprepareIsolation／executeIsolationへ五資源・九操作を接続する。認証単独Cleanupと資源集合の再入場はcleanupIsolationへ接続し、通常実行と同じDIの資源照合・回収・Process終了・config終了を利用する。Commandの再実行や上位への所在／Receipt逆照会は行わない。通常AttemptのCompletionもDI正本のResourceSnapshotを搬送する。旧固定Runtime／認証専用実行は製品から撤去し、旧有限試験の候補だけ試験側に隔離する。既存の実AI成功記録は保持し、新しい共通入口の実AI再成立の根拠にはしない。

通常実行の取消後は補償Cleanupを継続する。単独Cleanupの取消後は次の観測・削除を発行せず、所有Processの終了を待って自作configだけを元実体・空条件で終了する。Home排他は通常Attemptが所有し、技術Process終了・資源不存在・config終了を含むCleanup成立後にだけ解放する。Home排他名と元結果の相関条件は変更しない。

旧認証Lifecycle Adapterと旧Recovery試験Adapterは撤去した。認証と単独回収の試験は実Executor→共通DIを有限CLI・Process端へ接続する。旧Session形式を使用する既存の低位有限Oracleはscriptsの試験専用契約であり、製品API・保存形式・実境界の正本ではない。その移行中も、要求後のID欠測を未発行へ読み替えない。

## DI共通IFへの段階的接続（2026-11-02）

単一Containerの観測結果はDIの`ResourceSnapshot`をそのまま搬送し、Executorで構成を再定義しない。不存在・観測不能ではsnapshotはnullとする。Snapshotと回収照合を分離し、元実ID・名前・所有Labelの一致で対象を確認する。完全構成検査は実行前・診断へ残し、実ID欠測時も元Intent・二経路の一意実ID・名前・所有Labelを確認し、発見実IDの必須通知後にだけ回収する。Directory条件は変更しない。

認証では受領した元実IDを必要通知より前に保持する。通知例外で後続の実行を停止し、保存の不成立を正常終了へ変換しない。Process終了不明では回収を発行せず、補償回収でも必要な処置前通知に失敗した場合は削除しない。三用途のSourceは共通DI実行入口へ接続済みである。新入口での実AI・実Dockerの再成立は未検証であり、非AIのSource接続確認と区別する。

成果物種別: Architecture詳細設計
詳細設計領域: executor
状態: Candidate（非AI検証対象）
維持責任者: Qual-Lab

## 基本設計との関係

`scripts/task-summary-observation.ts`は合成診断だけのModule観測であり、製品公開APIではない。専用新品Node Processでconsumer import前に元normalizerを包み、同じ引数・同じreturn object／例外を維持する。最初のCodex executorのsummary候補一件だけをメモリで保持し、外側の単一Task終了・段階順序・資源回収結果を照合後、人間承認した端末へ一回表示する。元関数にはTask／Attempt IDがないため、観測seam単独のexact identity証明とはしない。表示前の制御文字・Path・認識済みSecret検査の不成立は非表示へ閉じ、元結果と採否・回収を変更しない。本文はLog／File／APIに保存せず、端末scrollback残存は人間の限定受容を必要とする。復元はmock解除だけでなく専用Process終了まで確認する。計測付きの結果を通常Source無計測E2E成立へ算入しない。

表示前には結果記録成功と試験物の処置結果の相関も確認する。Task・実行資源の回収と試験フォルダの物理削除は区別し、既存Gateが故障証拠を保持する場合も、その保持判断を変更しない。

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000008](../../Definitions/ARCH-000008/architecture_definition.md) | Provider単段のProcess・取消・終了と元回復証拠 | Covered |
| [ARCH-000015](../../Definitions/ARCH-000015/architecture_definition.md) | 準備一回消費・結果正規化。Taskの順序判断は上位へ残す | Covered |

## Host実行環境の窓口

通常Attemptの構成入力は`{ paths: { tmp, management } }`とする。Coordinatorが既存準備内で所在と利用許可を確認し、Executor／DIは値を独立捕捉する。DIはprepareIsolationで使用Directoryの元実体を捕捉し、同じ共通実行Contextで開始・短期Command・回収前に照合する。通常Cleanupは共通実行Context内のReceiptを使用し、上位記録の再照会や旧fallbackを行わない。Receipt欠測は未要求・不存在へ補完せず、回収未確認として保持する。元Control照合、Home排他、必須保存通知、Process終了不明の扱いは維持する。


### DI正本の共通回収と上位判断の境界（2026-11-02）

通常実行・単独回収・認証の資源APIは、上位へのassertOwner Queryを受け取らず、任意のAbortSignalで処置の停止を受ける。上位は呼出し前に対象・許可を確定し、呼出し終了まで既存排他を保持する。上位の途中失効を下位が自動検知する保証は持たず、停止は明示取消で伝える。Coordinatorの保存通知内の版・記録確認と、呼出し前後の境界確認は上位に維持する。DIのID・Label・構成・管理Directory実体の確認は撤去しない。

Executor固有の接続型はlifecycle/types.ts、DI資源投影・対象・Snapshot・回収通知はDIのcleanup/types.tsを正本とする。通常実行とAttempt／認証の単独回収はDIの共通実行Contextへ接続し、元Receiptと同じ回収手順を使用する。単独Recoveryの資源終了通知は自作config終了前、最終Cleanup通知は終了後に接続する。通常Attemptの上位資源終了通知は従来どおりDIのconfig終了後、Home解放前に行う。通常Cleanup後の再回収は行わない。同期Container単独処置は既存の同期性・三軸不存在を維持する例外、Directoryは既存用途固定処置を維持する。下位へOwner・所在・Receiptを逆照会させず、異なる削除条件を緩いOptional集合へ押し込まない。

### 共通Lifecycleの実行制御

事前取消は内部Signal又は対応用途の外部Signalから判定する。startの取消拒否は重複開始と区別した既存の用途別取消理由を返す。外部Signalは共通取消へlistenerで接続し、登録直後にも中断を再確認する。外部・明示・内部停止は同じ取消印と配送Promiseを使い、Handler未登録なら要求を保持し、後接続で一回だけ配送する。外部中断後の明示取消はduplicate、終端後はinvalid。finishは購読を解除し、後着中断では処置しない。Attemptへ新しい外部Signal入力は追加しない。

ProbeのCallback検査とcaptureMountsによる初回読取りは開始前のEffectなし準備とし、失敗はdocker_probe_preparation_failedの開始拒否・終端とする。DIのBinding生成はmanagement内のdocker-config／docker-homeを作成するため、純粋準備ではなくDIの共通実行内に置く。第一／第二Directory作成又は環境構築が失敗しても、Container回収成功を補完しない。部分Host領域は既存の上位Host清掃へ接続し、Executorが任意Directory削除を追加しない。DI結果の解釈と同じ同期処理のfinallyで共通Controlをfinishし、結果確定後の取消受付窓を置かない。結果構築例外でも同じ同期finallyでfinishする。

公開要求はkindを必須とし、attempt／authentication／isolation_probeだけを受け付ける。欠測・未知・accessorやaction／purposeとの用途矛盾は準備前に拒否し、他用途へ暗黙Fallbackしない。これはSource APIの切替であり、保存Schemaや旧Evidenceを変更しない。

| Owner | 保証・残す差分 |
|---|---|
| lifecycle/execute.ts | 一回開始、取消要求印・一回配送、Signal、終端後拒否。各Operationにstarted／finished／取消Booleanを再保持しない |
| lifecycle/execute.ts | DI Sessionへの取消一回配送、外部Signal、開始・終端だけを管理する。汎用Runner・Cleanup Hookを所有しない |
| lifecycle/attempt.ts | Controlとmanagementの照合後だけ共通取消を呼ぶ。Home Lease、元回復参照、Provider接続と結果解釈を保持する |
| lifecycle/authentication.ts | Login／StatusとHome条件、stickyなProcess終了不明を判定し、終了不明ではCleanupしない |
| lifecycle/probe.ts | 固定合成構成、固定所在の元Directory実体確認、実ID照合、Process終了確認後の回収とProbe結果解釈 |

Attemptの開始通知拒否による内部停止も同じ共通取消へ接続する。取消配送のReject／保留で印を解除・再配送せず、元completionが終了と回収を確認する。認証／Probeは開始前取消があればstartを拒否して終端化し、同じExecutorを再利用しない。Attemptは有効な開始Controlなしの取消を拒否する。Cleanup中は取消可能とし、結果固定後の受動通知からの再入取消は拒否する。終端は技術成功の意味ではなく、unknownや回収未確認もそのまま結果に残る。

通知は共通CompletionCallbacksと各用途のinterfaceを合成し、ExecutorCallbacksの型対応表で選ぶ。非該当Propertyをneverで削除しない。Intent／Receipt等の必須通知は現行の同期性・待機と失敗後の停止を維持する。onCompletedは結果固定後の任意通知で、同期例外・非同期Rejectを捕捉するが完了を待たない。Coordinatorは元completionを待ち、必要な終端保存を自分の通常処理で行う。

### 合成隔離Probeの既存入口

`createExecutor({ kind: "isolation_probe", probeId }, { mounts })`は、固定合成Containerの技術試験を一回だけ開始する。Providerへ送信する`purpose: "probe"`とは別の要求であり、Provider・Model・認証・送信許可を架空に生成しない。公開関数は追加しない。実行・保存・安全条件は維持し、通常Attemptの要求形式も必須kindへ切り替える。

`lifecycle/probe.ts`はCreate、実ID通知、fresh構成確認、非同期attach、取消・closeのjoin、実ID限定回収と三軸不存在をDIへ接続する。`lifecycle/types.ts`は要求・固定所在・技術結果と固有の同期void通知interfaceを所有する。上位は`onCommandSubmitting`と`onResourceCreated`で必要な耐久保存を完了してからreturnする。通知失敗でも既知実IDは保持して補償回収し、作成不明では再Createや名前だけの削除を行わない。

`mounts`は上位で利用許可を確認した固定四所在であり、Executorはown-dataの値と元Directory実体をFactoryで捕捉する。入力Objectの後発変更は採用せず、開始前の実体差・欠測・Link・観測不能では開始を拒否する。DIのBindingは同じ所在と元実体を保持し、各CLI要求前に照合する。上位のOwnerや保存状態を逆照会しない。取消は同じ所有attachへ届き、終了不明を回収成功にしない。completionは技術回収まで待つが、Host清掃・保存確定・最終Fake判定はCoordinatorの責務である。故障Profileは製品Requestに公開せず、検証Scriptだけが内部の同じ実装へ固定Profileを渡す。永続Store・新しいLock・Registryは追加しない。

### AIツール認証の技術生涯

DIの認証isActiveは同じ実行の明示取消Signalだけを確認する。DIが返すdocker_execution_permit_lostをHome Lock喪失へ変換せず、Executorは既存provider_authentication_cancelledへ分類する。作成時の取消でReceiptが得られない場合も、IDや不存在を補完せず必要なCommand終了通知を経て取消理由を返す。既知Receiptの通知・採用条件は維持し、通知保存失敗やProcess終了未確認を取消成功にしない。実際のHome Lock確認とその拒否理由は上位が所有する。

試験専用attempt-recovery-test.tsは現行の非同期cleanupObservedを備える有限DI代役だけを受ける。欠測を読取り専用recoverObservedへfallbackせず、処置未確認へ閉じる。製品Rootや技術処置の新しい差替えAPIは追加しない。

認証はcreateExecutor({kind: "authentication", ...request}, {managementDirectory, settings})から構成する。上位が既存Home LockとRecovery記録を確定し、管理領域をexclusive取得した後にstartへ進む。Factoryでは値だけ、startで共通DI準備・実行へ接続し、completionは認証三値・Process終了・Cleanup・非秘密Snapshotを分離する。認証情報本文・Repository・Workspace・任意CLIを入力に要求しない。同じProvider Imageを用途ごとのMount・通信・対話条件で使用する。

上位はHome選定・既存Home Lock、Recovery受付、Intent／Receipt／idle／settledの保存を所有する。Executorの同期void通知は各Commandの前、作成Receipt、終了後に発行し、上位は必要保存を完了してからreturnする。throw又は誤Promiseでは次Effectを止める。生出力を通知へ流さず、AI Adapterの正本Parserで認証三値へ変換する。ExecutorはOwnerや保存状態を逆照会しない。通常実行は元DI Planの固定資源列と通知完了済みReceiptを内部に保持し、単独回収は上位が読んだ同じ資源情報を値として受け取る。DIは元計画との順序・名前・種類・実IDを検査し、accessor・Proxy・欠測を拒否する。

各認証は同じ共通DI実行OwnerでProcess終了とCleanupまで確定し、終了不明をstickyに保持する。同じContainerや旧認証Runtimeの再利用は行わない。回収の必要通知は資源単位の処置前・資源終了・最終Cleanupに接続する。既知実IDの照合は実ID・名前・所有Label、ID欠測は正規不存在観測又はunknownとする。statusの正規未ログインだけを確認完了とし、login・未知出力・Process故障を同じ結果にしない。Home Lock解放・保存確定・操作全体の成功はCoordinatorが判断する。

認証と通常短期CLIはDIの共通Ownerが同じ所有Processを開始・待機・取消・終了確認する。認証固有の対話方式・30秒の非対話期限と通常の短期10秒期限は入力条件として維持し、新しいProcess Managerを作らない。準備の読取り失敗はEffect前に止め、未発行をProcess終了不明へ変換しない。

単段Attemptとは独立した環境診断・再起動・修復はDocker Isolationの`docker-desktop/operations.ts`が所有し、環境契約は同じ責務のtypes.tsへ置く。Executorは同じ関数と型を公開入口で直接再exportし、独自のmode判定・観測集約・Wrapperを持たない。新しい管理State・Store・Factoryは追加しない。Coordinatorは実施判断・現在Owner・必要な排他・Effect前の耐久Intent・Checkpoint・結果確定を所有する。

| 公開関数 | 契約 |
|---|---|
| `inspectDockerEnvironment(settings): DockerEnvironmentStatus` | backendとEngineの既存の有界読取りを逐次実行する。backendのunknown、Engineのknown_unavailable／unknownとcleanup未確認を保持する。起動・再起動・修復・Container作成を発行しない |
| `restartDockerEnvironment({mode: "restart", input: request}, settings): Promise<DockerEnvironmentResult<"restart">>` | 入力object・Signal・現在境界確認・同期通知と元Promiseを既存DIへ無変換で委譲する。DI正本の入力・結果・通知型を再利用し、deliveryを落とさない |
| `restartDockerEnvironment({mode: "repair", input: request}, settings): Promise<DockerEnvironmentResult<"repair">>` | 既存の固定修復Sessionへ無変換で委譲する。判断・保存・保持期限は上位へ残す |

診断結果はatomicなSnapshotでも再起動許可でも全資源停止の証明でもない。診断の先行実行を再起動の条件にせず、既存DIの各Effect直前確認と通知待ちを維持する。Coordinatorの再起動本番接続はこの窓口を使用する。既存doctorの合成Container Probeは別Capabilityであり、環境読取りをdoctorへ自動追加しない。認証は上記の認証窓口へ接続済みである。合成隔離Probeの通常経路は上記の既存Executor入口へ接続する。実Docker境界の成立は今回の非AI検証から推測しない。修復・固定Directoryの観測／処置は以下の共通入口へ接続する。既存Runtime State LockはRepository単位であり、Host全体・別Repositoryの排他保証をこの移管で新設又は証明したとは扱わない。

## 単一Containerの既存資源API接続（2026-11-01）

inspectResources／cleanupResourcesの既存入口で、元作成構成を持つResourceTarget<"container">も扱う。新しいProbe Recovery関数・Factory・Store・Lockは作らない。Executorは同じ管理所在・構成・任意の取消Signalを既存DIへ接続し、present／absent／unknownとRunning肯定を分けて返す。回収は先行inspectを要求せず、内部で同じ構成をfresh照合する。Host回収・保存・保持判断は上位に残す。通常Probe実行の清掃と旧固定Probe回復は同じDI観測・回収処理を使用する。

## 共通資源の観測・回収API（2026-11-01）

公開名はinspectResources／cleanupResourcesへ統一し、旧Attempt専用名の互換exportを残さない。実装はnon-asyncのoverloadであり、対象種別と入力・返却型を明示する。

| 対象 | 入力・返却・同期性 |
|---|---|
| ResourceTarget<"container"> | kindはcontainer。元作成構成・借用管理所在・任意の取消Signal。ResourceInspection<"container">とconfirmed／reasonの回収結果を返す |
| ResourceTarget<"attempt"> | kindはresource_set。既存の技術投影・Receipt・元IDを維持し、取消は任意のSignalで受ける。観測は同期ResourceInspection、回収はPromise<ResourceCleanupResult>を返す |
| ResourceTarget<"directory", "inspect"> | kindはdocker_runtime_directory、inputはDI正本のDockerRuntimeDirectoryInspectionInput。同じinputを既存固定三用途の二読取りへ渡し、実体照合集合又は全体nullを同期返却する |
| ResourceTarget<"directory", "cleanup"> | 同じDirectory kind、inputはDI正本のDockerRuntimeRepairDisposalInput。同じinput・Signal・canIssueEffectを既存処置へ渡し、元Promiseと要求／不存在結果を返す |

kindはAPI分岐だけに使い保存Schemaへ追加しない。未知kindからDirectory処置へ進まない。任意Path・任意資源の混合集約・再試行・新Owner・新Lockは追加しない。DirectoryへAttempt用purpose／Docker ID通知やHome終了の架空値を作らず、既存の現在性Queryと結果返却を利用する。保持の意味・期限・廃棄判断・用途Intent・保存はCoordinatorに残す。Executorは「退避物」という業務分類やHistoryを所有しない。

環境修復はrestartDockerEnvironment({mode: "repair", input: request})から既存DI Sessionへ無変換で委譲する。外側結果と内部Machineの型はDI正本に明示名を付け、一次失敗・Native終了・観測資源終了・最終checkpoint候補を保持する。finalCheckpointConfirmed:falseを保存成功へ補完しない。修復処理とRecovery管理簡素化は分離し、後者は今回は変更しない。

ExecutorはAttempt単位の技術診断・回収を受け持つ。lifecycle/cleanup.tsと公開入口index.tsはinspectResources／cleanupResourcesを維持する。保存済み五資源の投影・Receiptを解釈する処理はlifecycle/cleanup.ts、元Operation／Recovery IDを持つResourceTarget・ResourceInspection・ResourceCleanupResultとAttemptRecordProjectionはlifecycle/types.tsが所有する。Coordinatorの本番資源回収は同じ二操作へ接続し、Domain保存・Host清掃・Lease解放を下位へ移さない。

| 契約 | 入力・結果の具体化方針 |
|---|---|
| ResourceTarget<"container"> | kindはcontainer。元作成構成・借用管理所在・任意の取消Signal。ResourceInspection<"container">とconfirmed／reasonの回収結果を返す |
| ResourceTarget<"attempt"> | 同じrecoveryId／operationId、検査済みAttemptRecordProjectionと保護Mount投影、Executorが所有するDockerResourceReceipts、用途限定で借用した管理領域、任意の取消Signal。Domain OperationやidentityJson、保存先・Writerは渡さない |
| inspectResources | 診断のみ。実ID・名前・Label・構成と、必要な認証資源の二回の不存在観測を返す。削除・Task再実行・保存状態更新はしない |
| cleanupResources | inspectの先行実行を要求せず、内部でfreshな技術再観測・照合・回収を行う。元参照、資源別観測、技術cleanupと短命configのclose結果を区別して返す |
| ResourceInspection／ResourceCleanupResult | Executorが元Operation／Recovery相関を付ける。DIの実測Snapshot・存在三値・config終了を再利用し、未要求・Receipt欠測・実体不明・不存在を区別する。cleanupのtrueから資源別結果を再構成しない |

共通のResourceCleanupCallbacksをExecutorCallbacksが継承し、Attempt資源の回収APIも同じ通知名を使用する。onResourceInspectingとonResourceIdentifiedは同期voidであり、Attempt資源の回収APIではonResourcesClosedとonCleanupCompletedも同期完了を要求する。通常実行の後二通知は既存どおりPromise<void>を許容し、完了を待つ。観測開始、発見したpurpose／実ID、資源別cleanup観測だけを同期通知し、通知先は必要処置を完了してvoidで戻る。保存方法や許可を返すACKは設けず、Promise誤返却・throwで次Effectを止める。Directory・環境修復の固有の現在性確認は今回維持する。通常／単独の資源集合・Container・認証は逆照会せず、上位の排他保持と任意のSignalを使用する。認証unknownの閉鎖可否は上位が決め、下位は不存在の読取り結果だけを返す。共通通知interface以外の専用Interface・Factory・Manager・Store・Registry・Lock・永続状態は追加しない。

onResourcesClosedは技術資源の終了観測を上位へ渡す段階であり、通常実行ではHome解放より前にMount返却へ接続する。onCleanupCompletedはHome解放後の最終技術観測である。二段階を重複として統合しない。通常実行のonResourcesClosedは全終了確認後だけ発行するが、回収APIではunknownを含む五用途の観測集合を渡す場合がある。通知発行自体を不存在・Home解放・回収成功へ昇格せず、payloadと最終結果を参照する。onCleanupCompletedも処理の最終段階通知であって成功保証ではない。回収APIでは前者の通知中に上位の認証unknown閉鎖判定が診断APIを呼ぶ場合がある。診断用configを独立に取得・closeしてから専用Writerへ戻り、外側回収configは通知終了後にcloseする。二つのclose結果を全体結果へ反映する。認証用途の不存在診断は第一読取り不明で停止し、二回の不存在が揃うまで閉鎖根拠を返さない。

依存はCoordinator→Executor→Docker Isolationとし、ExecutorからDomain Modelへの依存は追加しない。単発実行の既存準備・開始・取消・清掃Lifecycle、Provider選択、Docker Desktop修復、Domain SchemaとHistoryは今回変更しない。診断・回収中の失敗でも取得済みconfigのcloseを行い、保存失敗と技術資源の回収不明を混同しない。既知実IDの診断は名前不存在だけでabsentにせず、削除なしのexact ID照合と明示取消の確認を行う。presentはallowAlreadyAbsent:falseで検証し、不存在を許す確認結果をpresentへ流用しない。

共有する内部型RuntimeStateと実行記録型はlifecycle/types.tsに置く。旧IsolationRuntime・Session・Cleanup包装は製品Sourceから撤去し、既存有限Oracleの変換だけをscripts/executor-test.tsに限定する。index.tsの公開型は増やさない。単一Owner内の入力容量定数や検査用Setはその実装内へ残し、複数Sourceで共有する固定語彙はconstants.tsに置く。

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | 上位調停と単段実行を分離する | [§1](#1-責務と依存) |
| Interface Model | Required | 開始・取消・元証拠の有限操作を固定する | [§2](#2-sourceと公開入口) |
| Data Flow | Required | 準備から元結果・上位保存へ相関を保つ | [§3](#3-生涯と証拠) |
| State Model | Required | 準備・開始・取消中・終了を混同しない | [§3](#3-生涯と証拠) |
| Sequence | Required | 回復引渡しをEffect前に確定する | [§3](#3-生涯と証拠) |
| Failure／Recovery | Required | unknownと元Identityを保持する | [§3](#3-生涯と証拠) |
| Deployment | Required | Libraryだけで、Serverや保存Rootを追加しない | [§1](#1-責務と依存) |
| Observability | Required | 同期通知と元結果を別々に照合する | [§3](#3-生涯と証拠) |
| Security Boundary | Required | 固定DI・既存Owner・同期保存を維持する | [§3](#3-生涯と証拠) |
| Implementation Structure | Required | 元Ownerと利用側の一実体を保つ | [実装構造](#implementation-structure) |

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS | Controlと準備は同じRuntimeの私有状態、別Ownerは拒否 | [§3](#3-生涯と証拠) |
| Timing | PASS | 既存Setup／Provider期限・取消猶予を変更せずjoinまで扱う | [§2](#2-sourceと公開入口) |
| Resource Lifecycle | PASS | 技術終了と上位Host清掃を分ける | [§3](#3-生涯と証拠) |
| External Boundary | PASS | 固定DIと元Hostの用途固定操作へ限定する | [§1](#1-責務と依存) |
| Failure／Recovery | PASS | 一次故障・回収と元exact参照を分離保持する | [§3](#3-生涯と証拠) |
| State／Consistency | PASS | 準備消費と操作・回復参照の相関を保つ | [§3](#3-生涯と証拠) |
| Observability | PASS | 同期保存・終端結果・閉形式診断を分ける | [§3](#3-生涯と証拠) |
| Security／Trust | PASS | 本番Factoryに任意CLI／Process実装を注入しない | [§2](#2-sourceと公開入口) |

- `PASS`: 詳細設計上の処置が定義された状態。実装・実境界の成功ではない。
- `N/A`: Architecture上、そのConcern自体が存在しない状態。未検討を意味しない。
- `OPEN`: 未解決の設計事項が残る状態。
- `FAIL`: 必須設計と矛盾する又は必要な処置が未充足の状態。

## Qualityへの引渡し

| 導出キー | 設計項目種別 | 対象 | 正常条件 | 反証する失敗 | 主な試験段階 | 外部境界の段階 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|---|---|---|
| `executor.single-provider-attempt` | Boundary／Resource Lifecycle | 一段のProvider試行と上位への証拠搬送 | 元準備一回消費、同期保存、同Controlのjoin、元結果照合 | 別Owner・コピー・失効・開始失敗・取消・終了不明・保存拒否 | IT | Direct Boundary／Adjacent 1 Block | 元参照・呼出し数・閉形式結果・exact回復参照。要求・受理・開始・終了・回収を分離 | 資源終了の実観測又は未解決義務。Task完了と同一視しない | 新Packageの実Docker／実AIは未実施 |

## Implementation Structure

| 観点 | 適用 | 判定理由 | 成立させる構造 | 局所責務・不変条件 | 失敗・変更時の影響 | Qualityへの導出キー |
|---|---|---|---|---|---|---|
| Variation | Required | Codex／Claudeの既存差を吸収する | Provider差はAI Adapter、共通試行は同じExecutor | Provider差を固定構成へ反映する | 両Provider反例を維持 | `executor.single-provider-attempt` |
| Common Contract | Required | Taskと助言が同じ開始・取消・終了を利用する | 公開Rootの有限操作 | Task順序を含めない | 全利用側へ同時追従 | `executor.single-provider-attempt` |
| Creation／Selection | Required | 本番と試験のAuthorityを区別する | 固定本番Factoryと隔離候補 | 候補を本番へ昇格しない | 不正開始はEffect前拒否 | `executor.single-provider-attempt` |
| State-dependent Behavior | Required | 開始後だけ取消・終端を同じControlへ結合する | 私有Control Map | コピー・再使用拒否 | 遅延通知と取消を反証 | `executor.single-provider-attempt` |
| Composition／Recursion | N/A | Taskの再帰計画・Queueを持たない | 一段の閉包だけ | 調停はCoordinator | 計画要求は上位へ | `executor.single-provider-attempt` |
| Lifecycle Ownership | Required | 終了前に結果を確定しない | DI Completionのjoinと既存操作記録 | 同期保存・exact回収 | 不明は義務を保持 | `executor.single-provider-attempt` |
| External Boundary | Required | Provider／DI／Host保存の境界がある | 元参照と用途固定callback | 先行boolean化禁止 | 生出力非保存・相関保全 | `executor.single-provider-attempt` |

## 1. 責務と依存

ExecutorはProvider一段を一試行として、開始、取消、終了待ち、結果正規化、Docker技術資源の回収とHome技術排他の取得・解放を所有する。選定・送信範囲・準備候補の一回消費、編集→レビュー→限定是正→再レビューの順序、Task／Queue、Workspace、耐久的な現在状態と配送は上位が所有する。Docker Isolationを実行時に呼び出す所有者はExecutorに限定する。上位は戻り値等の型を参照できるが、Dockerの構築・操作・清掃手順、OS別手順、資源命名を所有しない。これは採用済みの境界であり、後述の残存接続は未完了として追跡する。

| 所有者 | 担当 | 接続先 |
|---|---|---|
| Domain Model | 定義・局所CRUD・共通保存 | Executor／Coordinatorへ依存しない |
| Coordinator | 選定・Repository送信Policy・Task進行・Host保存と回復 | DomainとExecutorの公開Root |
| Executor | 一回のProvider試行・取消・終了証拠 | AI Adapterの計画／結果変換、Docker Isolationの固定実行 |
| Docker Isolation | Docker CLI・資源・Process・回収の技術処置 | 既存Platform Access |

単独Core利用ではCoordinatorもExecutorもロード不要。Executorはbin・Server・Queue・保存正本・追加Lockを持たない。Hostの有限保存操作は既存の相関・Authorityを使用し、新しい管理機構へ一般化しない。

### 単発実行への入力境界整理（進行中、2026-10-30）

上位のOperation正本の作成時刻、選定正本の速度設定、助言PacketのTask／Projection Hashは、Executorで参照しないため搬送対象から除く。上位の発行・消費・Hash照合は維持し、型の削除だけでなくcallbackの返却値を明示投影する。操作領域の全6PathはCoordinatorの`execution/operation.ts`が所有し、Coordinatorの`AttemptBinding.mounts`はworkspace／tmpの借用値だけとし、単独の`AttemptPaths`型とRoot exportは廃止する。Docker Isolationが借用するtmp／managementは別の既存接続で維持する。

準備候補の二WeakMapと期限・取消・一回消費の実装はCoordinatorの既存`execution/preparation.ts`へ移管した。通常実行のHome排他取得はDocker Isolationの固定RuntimeからExecutorへ渡し、Executorの既存Control記録がHandleを所有する。CoordinatorのDurableRecordはHandleではなく受領した解放事実だけを保持する。重複していた解放用WeakSet／WeakMapは撤去した。

正常終了は、Docker／Processの終了・資源不存在確認→Grant借用終了の通知→ExecutorによるHome実解放→Coordinatorへの観測保存通知→同一最終結果の通知とする。`completeMount`はDocker unmountではなく上位Grantの借用終了である。保存失敗で技術解放を止めず、逆に保存成功から解放を推定しない。`cleanupConfirmed`はProcess・Container・Network・Grant借用終了・Home実解放の共同成立であり、耐久受理は`recoveryCompleted`で区別する。上位Taskの成功は両方を要する。保存未確定では同じexact回復参照とmanualRecoveryRequiredを維持する。

開始拒否ではExecutorが取得したLeaseを一回解放し、原拒否理由・結果参照を保持する。清掃不明では既存Control記録を元回復参照へ結合して保持し、上位が試行Ownerの終了を明示した場合だけExecutorの`abandon`が未試行の実解放を行う。進行中・別Owner・別参照・取消Tokenとの混同・二重解放を拒否する。技術Ownerの終了はContainer／Network回収完了ではなく、元の失敗結果を書き換えない。

2026-10-31の追加承認により、小さな統合候補を除く単発入力境界の整理を実施する。上位準備入力・一回消費・選定とPacket相関はCoordinatorへ集約し、Executorには確定済みの技術入力だけを渡す。認証・診断・修復の新設や全面移管は対象外。既知のHome解放条件は今回変更せず、別件として保持する。

全27宣言の処置先は次のとおり。これは移管後の責務割当であり、現行実装の配置完了を示さない。

| 現行宣言 | 移管後の所有者・処置 | 保持する保証 |
|---|---|---|
| `ExecutorCallbacks` | 共通完了通知と用途別interfaceを選ぶ型対応。設定は所有元の`DockerIsolationRuntimeOptions`を直接再利用する | 同じ実行への取消・通知・終了待ちの結合 |
| `AttemptPreparation`・`PreparationResult`・`PreparationFailure`・`PreparationCancellationResult` | Coordinatorの既存準備Ownerへ集約。下位の旧`AttemptPreparationResult`は撤去 | 準備失敗はEffect前拒否、取消・失効・二時計期限 |
| `AttemptBinding` | mounts内へworkspace／tmpを直接定義。`AttemptPaths`は削除済み。全操作領域の正本・検証はCoordinator | 同じ操作に結合したworkspace／tmpと保護対象 |
| `MountGrant`・`PreparedAuthority` | Coordinatorの既存Authority Ownerへ移管 | 元Grant・Provider・Operationの相関、発行／消費／失効の区別 |
| `ProviderDockerPreparationState`・`PreparationHost`・`PreparedAttempt` | Coordinatorの既存準備Ownerへ移管。二WeakMapを移し、重複生成しない | 元Owner・一回消費・期限・準備中のMount解放 |
| `PreparedAttemptPlan`・`PreparedPlan`・`ProviderAttemptPlan` | 技術入力と上位の受付・選定・保存Contextへ分解。Executorには一試行の技術構成だけを残す | 元九Commandの正規構成照合、実行前の相関検査、同じ回復参照 |
| `ConsumedTaskPacket`・`TaskPacket`・`AdvicePacket`・`ModelSelection` | 発行・消費・送信範囲・選定の意味をCoordinatorへ移管。本文・許可参照・解決済みModel等の必要値だけExecutorへ渡す | Packet差替え拒否、選定・用途・役割との一致、本文非保存 |
| `AttemptSelection`（削除済み） | AI Adapterの`ModelSelection`を直接参照。ロールの相関はCoordinatorの準備Ownerが検査する | Provider・Model・識別種別・Effort・用途と実行Roleの整合 |
| `AttemptInput` | 上位で解決済みの一試行入力へ整理。管理操作・Packetの生Capabilityを直接解釈しない | plain-data捕捉、欠測・余剰・Proxy・accessor拒否 |
| 旧`Command`・`CommandHandle` | 製品は既存PURPOSESから導出するAttemptCommandPurposeとDI所有の実行・取消・Completion契約を使用。argv付き旧CommandとHandle代役はDI試験supportだけへ限定 | 固定九用途、Command正規性、Process開始と完了・終了観測の区別 |
| `Recovery`・`BlockedRecovery` | 上位が確定した受付結果を受け取るcallback契約として整理。永続回復状態の判断は上位 | 最初の失敗から同じexact参照、不明を不存在へ変換しない |
| `RuntimeDependencies` | 固定隔離接続と一試行callbackへ整理。上位保存の判断・Grant意味解釈を撤去 | submission先行記録、同期拒否、取消join、清掃後の結果通知 |

移管の完了判定は型の所在だけでは行わない。準備一回消費、AuthorityとRevisionの再確認、Effect前の回復引渡し、取消中のjoin、元の終端結果への結合、実Home解放と耐久保存の不一致を、移管後のOwnerと本番利用側まで接続して確認する。実解放が確認されても上位の保存が不成立なら、CoordinatorはTask成功へ昇格させない。

## 2. Sourceと公開入口

### 用途横断の公開IF

Executor／ExecutorRequest／StartInput／StartResult／CompletionResult／ExecutorCallbacks／CancelArgumentsの型引数を省略した場合は、三用途のUnionとする。これは複数用途の受渡し用であり、任意用途の入力を未絞込みExecutorへ実行できる意味ではない。実行OwnerとFactoryの各overloadは用途を明示し、CoordinatorのAttempt経路も<"attempt">へ固定する。kindで絞ってから、対応する開始入力・結果・取消を扱う。

取消引数はAttemptだけ一つのAttemptCancelInputを必須とし、元Control／managementを既存どおり照合する。認証／固定Probeはcancel()とし、空Objectを渡さない。共通の一回配送と許可条件は変更しない。RecordProjectionは公開利用を維持し、ProjectionKindをattempt／authenticationだけに限定する。既定はその二投影のUnionであり、Probeにneverや架空投影を割り当てない。

環境操作の型正本はDIに維持し、公開DockerEnvironmentRequest<M>／Result<M>から入力と結果を参照する。用途別Runtime入力・結果の個別再exportは撤去する。通知で利用中のDockerEnvironmentRestartEventは維持する。資源観測・回収の公開型はResourceTarget<K, A>／ResourceInspection<K>／ResourceCleanupResult<K>へ統一する。Kはattempt・authentication・container・directory、Aはinspect・cleanupで、既存Owner型への対応だけを定義する。認証のinspectは存在せず、Directoryの観測と廃棄の入力制約、Containerの同期性は維持する。新しい構造・Runtime・保存Schemaは追加しない。

通常Attempt、AIツール認証、固定隔離Probeは共通のExecutor<K>を返し、Kで用途と入出力を結び付ける。公開構成要求はExecutorRequest<K>、開始はstart(StartInput<K>)、取消はcancel(...CancelArguments<K>)、開始／終了結果はStartResult<K>／CompletionResult<K>を使う。型の正本はlifecycle/types.tsで、用途別の内容・技術観測は既存のOwner型を再利用する。結果のkindはattempt／authentication／isolation_probeを区別し、他用途のProvider・Home・Mount結果を架空のtrue・nullで埋めない。

| 用途 | 開始入力の必須情報 | 開始後の追加情報 |
|---|---|---|
| attempt | managementCapability、元reference、任意callbacks | 元Control・completion・同じ回復ID。記録投影はRecordProjection<attempt>の既存技術値 |
| authentication | 現在Owner確認、現Receipt照会、任意Signal／callbacks | completionで認証三値・Process終了・清掃結果を保持。記録投影はRecordProjection<authentication> |
| isolation_probe | 任意callbacksを持つObject | completionで作成要求・実ID・隔離事実・取消・終了／清掃を保持。架空の記録投影は追加しない |

StartResultはstartedの場合だけcompletionを持ち、blockedは当該開始要求の拒否として返す。重複開始の拒否から、先行した実行の終了・資源不存在を推測しない。開始受付をProvider実行やDocker要求の発行成立へ昇格しない。cancelは全用途でPromise<CancelResult>を返すが、認証／Probeの取消Signal発行だけでprocessTerminationObservedをtrueにしない。元completionの終了・回収観測を別に待つ。Attemptの取消では元Controlとmanagementを引き続き必須とする。Attempt専用abandonは元回復参照・管理参照から未処置の技術Home解放を一回だけ行い、認証／Probeへ空実装を追加しない。

通知はExecutorCallbacks<K>に統合する。ResourceCleanupCallbacksは既存の回収APIと共有する。用途に存在しない通知は型で登録を拒否し、認証／Probeの要求前・Receipt・終了通知は同期voidを維持する。Attemptの必要通知は従来どおりPromise<void>を待つ。onCompletedは同じ型付きCompletionResultを渡す受動通知であり、同期例外／非同期Rejectを捕捉して確定結果を変更しない。

Rootの公開関数は5つを維持し、公開型は31個とする。用途別Executor・通知interfaceの独立再公開、用途別開始／完了結果と構成要求・記録投影の重複した公開名を撤去し、共通名から既存Owner型へ結び付ける。中間Plan、Factory、Dispatcher、永続状態、Registry、Lock、互換読取りは追加しない。保存Schema、既存失敗理由の意味、現在Owner、Intent／Receiptの保存順序、終了不明時の停止とexact回復IDは維持する。

共通化するのは実行・清掃・結果の終了待ちであり、三用途へ同じDocker手順を強制しない。認証の同期保存通知、Attemptの非同期通知、Probeの実ID保存はそれぞれ既存の順序を保つ。認証の単独回収はcleanupResourcesのauthentication対象へ接続し、旧実行が終了不明の場合は上位が回収へ進めない。通常認証は同じRuntimeで実行から清掃まで完了し、その後にCoordinatorが記録を確定して上位Home Lockを解放する。

環境変更はrestartDockerEnvironmentのmodeを必須とし、restartは停止・起動、repairは既存の固定Directory退避を含む修復へ接続する。modeの欠測・未知値・accessorは操作前に拒否する。失敗を理由に別modeへ切り替えず、元input・Signal・通知・結果・Promiseをそのまま既存DIへ渡す。独立したrepairDockerEnvironmentは公開しない。自動起動・自動修復・再試行は今回追加しない。

```text
executor/src/
├ index.ts                    主要5公開入口
└ lifecycle/
  ├ types.ts                  共通契約・用途別入出力と通知の型対応
  ├ execute.ts                開始一回・取消一回配送・Signal・終端
  ├ attempt.ts                Provider構成・結果解釈・Home解放と必要通知
  ├ authentication.ts         Login／Status構成・認証結果の解釈
  ├ probe.ts                  固定診断構成・診断結果の解釈
  └ cleanup.ts                元Snapshotの明示観測・単独回収をDIへ直接接続
```

環境二操作はindex.tsからDIの同じ関数を直接再exportする。Executor内に環境用の独立実行Ownerや型定義を重複させない。

助言CommandはcreateExecutorへ渡された確定入力から内部構築する。上位へCommandを公開せず、専用の事前構築API・PreparedAdviceCommand・Command Hash往復は廃止する。Advice要求は共通のtarget／selectionと本文・許可参照・Network Policyだけを受ける。選定の識別種別・用途・Provider・Model・推論強度、本文長と参照、PolicyのProvider・正規Hashを既存Ownerで検査する。Policyは通常dataへ捕捉して固定し、後発変更を採用しない。上位Commandを含む旧要求は互換受理しない。

結果検査の配置：開始・終了結果の再検査`projectAttemptStartResult`／`projectAttemptResult`は製品Sourceから撤去し、`tests/support/result-validation.ts`を既存の試験入口だけへ接続する。Executorの型付き結果を同Processの利用側へ再検査させる公開APIは作らない。Codex固有の観測検査はAI Adapter内に閉じ、通常Rootに公開しない。Executorは公開Parserが返す検査済み観測をCompletionResultの型でそのまま搬送し、Coordinatorも同Processの結果を再検査しない。JSONを読む検証ツールだけが既存の検証専用入口を使用する。回復開始応答のexact ID／Home・理由・診断検査はCoordinatorの既存validationが所有し、一次故障のJSON検査は既存./testingへ閉じる。Executorの製品Sourceには固定用途・技術理由・局所値の検査だけを残す。一次故障のターン数診断は、不正な報告値（safe integerかつ1以上ではない値）のみを受理し、実行結果を上限2と比較しない。Domainの保存済み旧診断の読取り契約は今回変更しない。

`ExecutorCallbacks`は通知専用interfaceとし、引数は既存の責務型を再利用する。通知の戻り値は`void`又は`Promise<void>`であり、上位の保存結果・許可・回復参照を返さない。固定構成は所有元の`DockerIsolationRuntimeOptions`を直接使用し、単純別名の`ExecutorOptions`は宣言・再公開しない。通常AttemptはDIの元Completionを直接解釈し、`ExecutionServices`・`RuntimeDependencies`の汎用操作束を製品Sourceに置かない。

準備Ownerの宣言と`PreparationInput`・`ModelSelection`・`TaskPacket`・`AdvicePacket`・`AttemptBinding`・`MountGrant`はCoordinatorの`execution/types.ts`へ配置する。既存の二WeakMap、二時計期限、取消・一回消費を維持し、consumeからExecutor開始までawaitを挟まない。Executorの`AttemptPreparationResult`・`prepareAttempt`／`consumePreparedPlan` callbackは撤去する。消費後の開始拒否では、未消費Authorityのexact control失効と未完了Mount借用の終了を上位が確認する。Authority消費済みや技術清掃中の責務を上位へ戻さず、Home解放条件は変更しない。

Executor内のAttempt実行型は`lifecycle/types.ts`、通知interfaceは各用途の`types.ts`と共通の`lifecycle/types.ts`、資源回収の対象・結果は`lifecycle/types.ts`、ResourceCleanupCallbacksは`lifecycle/types.ts`へ置く。準備の取消・期限・一回消費だけが使う型はCoordinatorの準備Owner内へ置き、共有する準備型は同Packageの`execution/types.ts`へ置く。上位の`RecoveryPlan`は既存記録に必要な完全選定・Packet・利用側相関を保持し、`PreparedAttemptPlan<P>`が発行済みAuthorityと二時計・表示情報を結合する。新しいMap・Registry・保存単位は追加しない。

builderは乱数供給と、一つの`AttemptRequest`を受け取る。Request内に実行対象の`target`、AI Adapterの五項目`selection`、Probe／Task／Adviceの排他的な実行内容をまとめ、独立した`AttemptTarget`型は撤去する。上位はBindingとGrantの同一操作・Provider対応、選定ID／Hash・試行番号・Packet参照／Hash・stdin搬送・roleと用途・助言四非共有条件を検査する。下位は五項目選定・本文・Command・Image・Mountの技術的一致を維持する。利用側名、試行番号、選定記録ID、Packet相関をExecutorのPlanへ含めない。

`AttemptPlan`はFactory内部の技術構成であり、Taskの計画・順序を表さずRootから公開しない。Model／EffortはAI Adapterの`ModelSelection`だけから取得する。Coordinatorは対象・選定・用途別内容をRequestへ明示投影し、完全なCommandやProvider本文を受け戻さない。元の上位準備記録が試行専用ExecutorとAuthorityを保持し、別Owner・期限切れ・二重消費を既存の二WeakMapで拒否する。Executorの通知とcompletionは同じ技術CompletionResultを返す。CoordinatorはMount・保存の成立を加えたTask結果を一度組み立て、同じ上位結果を保存と上位completionへ渡す。保存失敗によって確認済みHome解放を未解放へ戻さない。

共通の公開`Executor<K>`は`lifecycle/types.ts`、Attempt固有型は`lifecycle/types.ts`でstart／cancelの引数・callback・結果を明示し、`createExecutor(request, options, random?): Executor | null`を型検査する。FactoryのReturnTypeで公開契約を代用しない。選択三項目は全存在又は全不存在のUnionとし、部分集合を許容しない。取消結果は要求理由と終了観測のtrue／falseを対応させる。Command制約・Authority・保存成立の判断は上位の既存操作で行う。Executorの通知は任意メソッドのvoid又はPromise<void>であり、戻り値で許可や保存成功を受け取らない。

本番入口は`createExecutor(request, options, random?)`とする。Factoryが`AttemptRequest`から一試行の完全な技術構成を作り、閉包内に保持する。通常Attemptの返却値は試行専用の`Executor`又はnullであり、`kind`・`recordProjection`・`start({managementCapability, reference, callbacks?})`・`cancel`・`abandon`だけを持つ。公開prepareとPlanの受渡しは廃止する。記録用投影は五資源名・所有label・Image Digest・購読種別・実行／Mount modeだけで、Command・Provider本文・Authorityは含めない。上位は既存準備記録を一回消費し、Authorityと耐久受付を確定してからstartする。Home取得とDocker要求はstart以後だけで、同じExecutorのstartは一回に限る。

Coordinatorの`execution/provider-executor.ts`は本番Executorを一度だけ生成する固定接続部。旧Controllerには単段Controller実装を残さない。要求前保存は固定Host callbackへ直接接続し、終端材料は既存の操作記録へ渡す。Domainの既存終了保存Contextはその記録を読み取り、Executorへ逆照会しない。初期化中の相互参照は関数宣言の束縛だけとし、構築中に実行せず、追加Loaderや遅延Registryを置かない。

### 内部整理の境界

各TypeScript Fileの宣言順序は[コーディング規約](../../99_Coding_Standards.md#32-sourceの責務別配置と公開境界)に従う。静的import・再export、型宣言、Module直下の値、関数・実装を区別し、初期化やModule評価の順序は変更しない。検証Script `verify-provider-real.ts`は、Coordinator依存を拒否する`registerHooks`を登録してから動的importする実行境界を持つ。この登録と読込みは初期化を所有する処理として順序を維持し、宣言順序を揃える目的で静的importへ置換しない。

`index.ts`のcreateExecutorは用途別の確定入力をoperationsへ結合する。`lifecycle/attempt.ts`のprepareAttemptは一試行の技術構成を内部に保持する。準備候補の一回消費はCoordinatorの既存Ownerが行う。`lifecycle/execute.ts`の共通Controlが開始・取消・終端を所有する。用途別SourceはDI Completionを直接解釈し、必要な終了処理後に同期finishする。各用途のoperationsは固有の技術条件・結果解釈だけを適用する。AttemptはDI Completionの技術回収確認後、Grant借用終了を通知し、Homeを実解放してから上位へ観測保存を通知する。正常実行のDI技術回収を二重実行しない。純粋準備拒否は未発行として終端し、DI実行要求後の不明はHomeと同じ回復参照を保持する。

Task／Adviceとも同じstartとcompletionを使い、`CompletionResult`の`normalizedResult`を型付き`AttemptContent`として返す。実行時の編集・レビュー内容はAI Adapterの`provider/task-result.ts`、助言の内容モデル・Schema・許可参照検査は`provider/advice-result.ts`が唯一所有する。Domainにあった旧実体・公開APIは撤去し、保存Schema・Writer・遷移は変更しない。AI Adapterの公開`parseProviderResult`は用途別内容検査まで完了し、内容・非秘密観測・内部搬送用所見を区別して返す。Executorの`lifecycle/attempt.ts`の`parseAttemptOutput`がこの一入口と成功時の内容Hash計算をまとめる。`lifecycle/attempt.ts`は解析のタイミング・結果受理・失敗の確定を所有し、Provider固有の解析や作業量判定を組み立てない。`lifecycle/attempt.ts`は`createStartResult`で開始成功・拒否結果、`createCompletionResult`で清掃後の終了結果を組み立てる。制御Handleとcompletion Promiseの生成・管理は実行Ownerが行い、開始Factoryは渡された同じ参照と既存の準備・選択metadataを結果へ組み立てる。`StartResult`／`CompletionResult`は`lifecycle/types.ts`が明示する公開結果契約とし、両Factoryは対応する型を明示して返す。両Factoryは名前付きObject一つを引数とし、開始入力はstatus別の必要値と準備失敗表示・選択三値、終了入力は操作ID・回復IDと技術観測を受ける。選定記録IDは上位の元記録だけが保持する。`StartResultDetails`、返却型のジェネリクス・Extract・型アサーションは使わない。準備内部のCapability／Grant／Home／Effect／Authority項目は開始結果へ展開せず、準備Ownerの内部診断にだけ保持する。入力の許可参照集合は準備時に複製・固定し、試行Identityへ含める。結果の用途別内容は保ち、同じfieldへ無理に平坦化しない。

限定是正証拠の発行・一回消費はCoordinatorの`execution/preparation.ts`だけが所有する。Executorは検査済み所見を`CompletionResult.reviewFindings`で返す。所見はAI Adapterの`TaskReviewFinding`をそのまま使用し、別名型・再export・専用callback・是正許可fieldをExecutorへ追加しない。正常完了・清掃確認・未取消・是正要求・非空所見の場合だけ配列を返し、それ以外はnull。二回目レビューも内容として所見を返せるが、それから次の是正を許可するかは上位の判断である。Coordinatorは取消確認後、既存handoff・元終端結果・Home解放・操作／選定・初回レビューを照合し、同じ同期区間で既存の限定是正許可を発行する。本文はProcess内の一時結果として扱い、state／history・公開DTO・通常ログへ投影しない。新しいMapや許可FrameworkをExecutorへ作らない。

Docker Commandの構築はExecutor内部のAdapter仕様取得・用途構成とDIの技術Compilerへ接続する。不要になったDIのAdviceCommand wrapper・bindAdviceCommand・hashAdviceCommandも撤去する。Codex助言用Image Digestと非共有のMount・Tool・Session条件は維持する。専用Command Hashはなくすが、旧検証Scriptの完全Command相関は残る。公開・共有結果型は`lifecycle/types.ts`から明示し、未使用の結果文字列検査は保持しない。内容のbyte上限と文字列条件はAI Adapterの内容検査Ownerが持つ。barrelや互換転送ファイルは追加しない。

Provider固有のEnvelope抽出・内容検査・非0終了分類は、解決済み`ExecutionPlan`と実行観測をAI Adapterの`parseProviderResult()`へ渡して一回で完了する。許可参照・固定Schema・環境・構成診断は`planExecution()`が送信前に解決し、Executorは個別検査を再構成しない。共通化のためだけのNormalizer入口や汎用変換Frameworkは追加しない。

Executorの製品Sourceと公開RootはDomain Modelを参照しない。選定設定・Catalog世代・選定理由を含む完全選定の検査とHash算出は上位が所有する。下位へ渡す選定はProvider、Model識別子、識別種別、推論強度、用途の五項目だけに限定する。`selectionHash`と選定記録IDは上位の元Ownerが保持・照合する。Coordinatorの準備時に完全選定・Packet相関を検査し、Executorの開始時には技術五項目・Command・Mountを検査する。下位の試行Identityへは技術値だけを含め、完全選定Hashは上位の元Ownerで照合する。このIdentityを保存Schemaの変更や過去記録の移行として扱わない。

`lifecycle/attempt.ts`は上記五項目を固定し、Proxy、accessor、特殊prototype、余剰、欠測を拒否する。開始参照はown dataだけを取得する。許可参照の配列・疎配列検査はAI Adapterの`parseAdviceReferences`が所有する。汎用の公開Snapshot APIは作らない。技術完了理由の発行集合は`lifecycle/attempt.ts`が所有し、Domainの保存受理集合とは独立した契約としてexact一致を試験する。理由・保存形式は変えない。試験Harnessが合成記録を上位Ownerとして保存することと、Executor製品自身の永続化を区別する。

Probeも同じAI Adapter解析入口を使用し、ExecutorへCodex／Claudeの解析分岐を持たせない。認証解析は同じCommand観測から一回行い、後続の認証Gateはその確認結果を使用する。Offeringの正本はAI Adapterの認証記述であり、ExecutorにProvider別の定数判断を複製しない。


### 上位記録と取消の相関

回復参照の発行・保存・再入場はCoordinatorが所有する。Executor内部の`AttemptReference`はexact IDと不透明参照を借用する搬送契約であり、Rootの独立公開型ではない。上位の既存`durableRecords`は保存成功後に試行専用Executorを保持し、開始成功後だけ元Controlの寿命aliasを結合する。取消検索は元Control・管理Owner・初期化済み・同じExecutorを照合する。通常の回復検索は従来どおり元Capabilityとのobject一致を要求し、Control alias・そのコピーを回復Authorityへ昇格させない。終端成功／拒否の両方でControl aliasを除き、実Home解放済みならExecutor接続も除く。解放未確認時のabandonは元回復Capabilityから同じExecutorへだけ配送し、既知の解放条件は変更しない。新しいMap・Registry・保存領域は作らない。

### 入力検査と理由分類の所有者

`lifecycle/attempt.ts`の`parseModelSelection`は、exact五項目を動的Propertyなしでコピーし、AI Adapterの既存`resolveModelSelection`へ四項目だけを明示投影する。返却値と元五項目の一致を検査し、Catalog Identityを含めない新しい凍結値を返す。Provider・Model・推論強度の独自列挙は持たない。privateな`copyPlainDataRecord`はこの入力コピーの補助であり、保存記録やRegistryではない。

助言の許可参照はAI Adapterが内容条件と不変コピーを所有する。Executorは準備時のconfirmed配列を保持するだけで、独自の件数・文字数上限を持たない。非空・周辺空白なし・重複なしと、sparse・symbol・accessor・Proxyの拒否は維持する。拒否時は乱数・Home取得・隔離Runtime構築前に停止する。

`readOwnDataProperty`は開始参照からown data propertyを読む局所補助であり、`lifecycle/attempt.ts`に置く。結果の検査・保存成立・Authority判断は行わず、Rootへ公開しない。Setup用途の判定は一箇所の失敗理由Map参照に統合し、own keyだけを採用する。`isAttemptFailureReason`は試行結果・試験用診断で共有する固定理由の照合として`lifecycle/attempt.ts`へ残す。成功・取消はFactoryが固定値を生成するため同種の動的理由検査を作らない。

### 単発実行の呼出し順序

内部関数はcancel、abandon、createExecutor、prepareAttemptの順で配置する。abandonは取消処理に隣接させ、元参照の所属・終了状態・一回解放・不成立を明記する。既知のHome解放条件は変更しない。診断2箇所はonDiagnosticを直接呼び、同期例外と非同期拒否をそれぞれ任意診断内へ閉じる。reportPassiveBoundaryDiagnosticという包装関数は設けない。

技術構成の組立ては`lifecycle/attempt.ts`の`prepareAttempt`が所有し、製品からは`createExecutor`だけが呼ぶ。有限検証からの内部参照を除き利用側は直接呼ばず、Rootから公開しない。`preparation.ts`や互換転送は残さない。入力は乱数供給と`AttemptRequest`で、Taskの計画・Authority発行・Home取得・永続化は行わない。構成の不成立はFactoryで拒否し、開始時の完全な技術照合も維持する。

回復開始の診断型・段階語彙・失敗通知はCoordinatorの`execution/types.ts`／`observation.ts`が所有する。Executorの通知は開始Process、技術構成、技術終了と一次故障だけを表す。回復開始失敗は上位が既存Reporterへ直接報告し、ExecutorCallbacksへ再注入しない。検証ツールはCoordinatorの検査正本へ接続する。Executorの有限合成Hostに必要な回復処理はprivateな試験処理に限定し、他Packageへ正本として公開しない。

DIの`onExecutionStarted`は同期voidの技術signalであり、Executorの公開非同期通知とは区別する。Executorは公開onStartedをjoinする。保留中も開始済みProcessのwait・期限・終了・回収を進めるが、Provider内容受理とcompletion公開は通知成功後に限る。既に通知成功済みならその時点で内容を検査し、既知失敗を遅延取消で上書きしない。通知保留中に別のCommandや別試行を開始しない。

`index.ts` → `createExecutor` → `start` → 内部`executeAttempt` → Docker Isolationによる実行・通知 → 資源回収・Home解放 → 技術CompletionResult、の順に進む。`start`はControlとcompletionを返し、Task全体の計画や順序を決定しない。`executeAttempt`は一試行の継続処理であり、上位の計画を実行計画として再管理するものではない。

公開構築Factoryは`index.ts`の`createExecutor`一つとし、Requestごとの準備・開始・取消を同じ試行専用Executorへまとめる。旧`createExecutionRuntime`／`createProviderAttemptRuntime`の中継を撤去する。有限試験の組立ては既存scriptsへ閉じ、製品と同じ内部start／cancel／abandonを使う。`describeExecutorContract`による説明文字列APIは撤去し、技術期限はDocker Isolation、準備候補の期限はCoordinatorが所有する。非秘密の構成診断は`lifecycle/attempt.ts`の`createConfigurationNotice`が組み立て、通知は`execute.ts`の発生箇所から直接呼ぶ。通知型は`types.ts`へ置き、`observation.ts`は置かない。

上位が先に回復記録を確定し、Executorはそのexact参照でHome排他を取得する。競合時は同じIDの未開始試行として拒否し、清掃完了やHome解放を捏造しない。旧abandonのHome解放条件に関する既知指摘は別件として保持し、本構造整理では変更しない。

### 正規構築と開始直前照合

Factoryは管理・一時所在を先に捕捉し、一時所在と要求の一致を確認する。`resolveProviderExecution`でAI Adapterの正規計画を一度取得し、用途別Image・RoleとWorkspace権限・PolicyのProvider一致・認証環境・Seccomp選択を`resolveIsolationCommandInput`へ結合する。旧payloadのargv最大256件、環境最大64件、JSON最大128KiB、予約環境名・絶対Path／禁止文字の拒否は同じ構成Ownerで維持する。Requestへ加えるHOME・Proxy変数までこの上限へ混ぜない。

生成Tokenと用途構成からIsolationRequestを一度だけ構築し、可変参照を複製して深く固定する。AttemptPlanは旧Command配列を持たず、開始・診断・未開始回収が同じRequestを使う。HomeLease取得後に`prepareIsolation`がCLI・Directory・固定Seccomp実物を確認し、DIの共通Compilerがargvを生成する。Seccomp実物異常の検出は旧Factoryのnullから開始後・Effect前の準備拒否へ移る。異常構成でDocker要求を発行しない条件は維持し、Factoryを実体成立の証明と扱わない。

構成診断は同じRequestのProvider argv・user・workdirとDIの固定read-only-root契約へ投影し、旧Docker argv逆解析を行わない。これは予定設定であり実隔離成立ではない。Token・環境値・Host Pathは診断へ渡さない。DIの旧bindProviderCommandと専用型・Source、旧九Command Compilerと逆投影のRoot公開は撤去する。旧Commandの比較とplanIdentityは有限試験・試験Hostだけに限定し、本番の保存Schema、Home排他Hash、Capability、通知・取消・回収条件は変更しない。観測・回収のSource接続は共通DIへ収束した。実境界の再成立は別途評価する。

既存乱数Ownerが一回生成したProxy TokenはRequest内部に閉じ、開始時に旧Commandから復元しない。Token欠測・不正値は構築時に拒否する。構成関数は乱数、Registry又は保存を所有しない。DIへ渡すのは有限技術Requestと限定stdinだけで、Operation・Packet・Authority・Recoveryの業務判断を渡さない。

Home取得前は`lifecycle/attempt.ts`の`isAttemptPlanValid`で選定・用途・Mount・資源Identity・Home四Hash・入力byte上限・固定stepの基本条件を確認する。固定構成はFactoryで一回構築し、開始時に再構築・全argv比較をしない。元Planの閉包・元管理参照・一回消費と、DIの固定Request検査・元準備の一回使用を別の保証として維持する。旧resolveValidatedPlanとplanIdentityは試験Scriptだけに限定する。Revision／Authority再確認・Recovery引渡し・submission先行保存・取消join・清掃後公開は維持する。

lifecycle/attempt.tsは固定Requestを共通DIの元準備へ渡し、同じ一回の実行・取消・元結果へ結合する。旧Runtime／固定Sessionの開始と単一Command接続は製品Sourceから撤去し、既存の有限試験supportだけが保持する。試験HostのplanIdentityのfield・直列化順は試験側で維持し、本番では同じ呼出しのPlan・Recovery・管理参照と元DI Completionの相関を維持する。Home解放は技術Process終了・資源不存在・config終了を含む既存Cleanup条件で元Leaseへ一回委譲する。旧試験用候補の成功を現在の製品接続の証明へ流用せず、先頭の共通DI結合試験を使用する。

回復開始理由はHost境界を所有するCoordinatorの有限投影へ移管する。現行の開始・在庫・Lock解放契約が使う7理由だけを対象にし、未知理由は既存unavailableへ閉じる。Domainは保存合法性を所有し、Executorは上位のraw理由を分類しない。元結果・exact回復参照・manual条件は変更しない。

`consumer`の既存値は表示の振分けではなく、選定・回復・終了証拠のIdentityへ結合されるため維持する。通知原本の照会API三つは撤去する。開始・取消・下位清掃検証、拒否理由と結果fieldの意味は維持する。助言結果には形式識別名・版番号を要求せず、呼出し用途と内容Schemaで検査する。製品コードへ旧照会APIや旧形式IDの互換層を置かない。

| 公開API群 | 所有者 | 役割 |
|---|---|---|
| `createExecutor` | index.ts → lifecycleの用途別Source | Requestと固定隔離設定を受け、内部構成を保持した一試行の開始・取消・終了を提供 |
| `createExecutor`（認証要求） | index.ts → lifecycle/authentication.ts | 認証と同じRuntimeの清掃を一回のcompletionへ結合する。Home選定・保存・操作判断は上位 |
| `inspectResources`、`cleanupResources` | lifecycle/cleanup.ts、lifecycle/cleanup.ts | 公開受付はLifecycle、保存済み五資源の投影・相関と共通Snapshot構築はAttempt Owner。DIのinspectIsolation／cleanupIsolationへ技術情報だけを渡す。相関付き対象・結果はlifecycle/types.ts、DIの純技術観測はDI cleanup/types.tsが正本。通知の同期性・既存interfaceは維持する |
| `inspectDockerEnvironment`、`restartDockerEnvironment` | DI docker-desktop/operations.tsの直接再export | Attemptとは独立した環境操作。判断・保存は上位、技術集約・具体操作はDI |
| `Executor<K>`、`StartInput<K>`、`StartResult<K>`、`CompletionResult<K>`、`CancelArguments<K>`、`CancelResult` | lifecycle/types.ts | 用途と共通開始・取消・結果を結び、用途固有情報は既存Owner型を再利用する |
| `AttemptCancelInput` | lifecycle/types.ts | 元Controlとmanagementの取消照合入力。認証／Probeでは引数を要求しない |
| `ProcessStartedNotice`、`AttemptDiagnosticNotice` | lifecycle/types.ts | 実Process開始と非秘密診断 |
| `ExecutorRequest<K>`、`RecordProjection<K>` | lifecycle/types.ts → 用途別types.ts | 解決済み要求と実在する記録投影。固定Probeへ架空の投影は追加しない |
| `Executor.start` | lifecycle/attempt.ts → lifecycle/execute.ts | 保存後の上位参照と通知を受ける。Planは引数に取らず内部構成だけを開始する |
| 通常Rootの関数 | index.ts | 上記5関数に限定する。prepareAttempt・検査・結果組立て・試験代役を独立公開しない |

TaskResultとAdviceResultの正本はAI Adapterであり、Executor Rootから再公開しない。CompletionResult<"attempt">.normalizedResultはその用途別内容だけを保持する。providerExecutionObservation、providerTurnObservation、reviewFindingsは固定nullableの外側fieldとする。正常完了・清掃確認・内容ありの共同成立時だけ保持し、それ以外はnullへ戻す。Executorの結果は是正許可や選定記録IDを含めず、上位の既存操作記録と原結果objectの相関で管理する。

onCompletedとonDiagnosticは受動通知であり、同期throw・非同期拒否は技術結果へ伝播しない。要求前・Receipt・清掃観測の通知は完了を待ち、throw・拒否なら次のEffectを停止して既存清掃へ進む。開始通知は同じ試行にjoinするが、その待機で技術Processの清掃を妨げない。上位の必須終端保存は受動onCompletedへ置かず、completion後に上位Ownerが待機する。

#### 形式名と内部公開の境界

- `ADVICE_INPUT_CONTRACT`／`ADVICE_RESULT_CONTRACT`とそれぞれの版番号定数はRoot非公開とし、Executor内の形式タグを廃止する。AdvicePacketは同じ操作・選定・Prompt・Hash・非共有条件を保持するが、contract／contractRevisionを要求しない。Coordinatorが私有PacketのHash形式として保持する識別情報はCoordinatorだけが所有し、Executorの実行条件にしない。
- 助言結果はstatusと四区分・本文・根拠参照を検査する。AIに形式名・版番号を応答させず、必要な形は`planExecution()`が内部固定し、許可参照と同じ計画に結合する。余分field・重複Key・曖昧JSON・容量超過・許可参照外・空参照の拒否は維持する。Taskへ形式タグ検査を追加して対称化しない。
- 旧タグ付き応答を新Schemaとして互換受理する層は追加しない。新しい実行のPromptとSchemaを同時に切り替え、過去の結果・Evidence・保持物は書換えない。実AIの再送は別承認とする。
- `ATTEMPT_OBSERVATION_KEYS`、内部Command・内部準備型・`readOwnDataProperty`・完全計画検査はRoot非公開。検査の項目集合はvalidationの私有値とし、利用側へは必要な検査関数と結果型を渡す。
- `TaskPacket`／`AdvicePacket`はCoordinatorの内部搬送型であり、Executor Root／私有Moduleのどちらにも定義しない。Executorへ渡すのは`AttemptRequest`である。`AdviceResultItem`はAI Adapter所有の内容項目型であり、Executorから再公開しない。内容型はAI Adapterから直接参照し、Executorに別定義を作らない。
- `normalizeTaskResult`、`normalizeAdviceResult`、`describeAdviceResultSchema`、`consumeTaskRemediation`、`hashAdviceCommand`、`bindAdviceCommand`はExecutor Rootから公開しない。内容SchemaはAI Adapterの解決済み計画内だけで使用し、利用側が取得・組立てしない。Docker構成はExecutorがDocker Isolationと結合し、上位へ個々のDocker操作を転送するAPIは作らない。
- 通常Rootと分離した`./testing`には`createExecutorTestCandidate`、`bindLegacyTestIsolation`、`describeIsolationContract`等、既存の有限検証用接続を置く。準備失敗Factoryは移管先のCoordinatorだけが所有する。本番Authorityや自由な本番Process注入を許可しない。

製品CLIは追加しない。scriptsは有限検証専用で、ライブラリのRoot APIを置き換えない。

## 3. 生涯と証拠

1. Coordinatorが選定・送信範囲・入力・実行対象を確定し、既存Ownerで準備候補を一回消費する。技術入力と同じ記録に結合したcallbackだけをExecutorへ渡す。
2. CoordinatorのstartHostAttemptが現在のRevisionと上位記録を照合し、Provider Authorityを消費する。耐久記録とexact回復参照の引渡しを確定してから、試行専用Executorのstartへ元参照と通知を渡す。
3. Executorが内部Planと借用参照を照合し、技術Home排他を取得して下位要求を発行する。受理・開始・応答・終了を区別する。過去Effectのunknownを成功又は不存在へ補完しない。
4. 要求前は通知を待ち、Coordinatorの登録ハンドラーが既存保存・制約操作を行う。上位操作の拒否はハンドラーの例外として次のEffectを止める。未発行確定は同じ操作Ownerと用途を渡し、Domainの専用Writerが短期排他内で`intent_saved`を再確認する。
5. 取消・遅延応答を同じControlへ結合し、終了待ちと元資源の回収を行う。一次故障を清掃結果で上書きしない。
6. ExecutorがHomeの実解放を確認し、清掃観測を通知する。一回組み立てた同じCompletionResultを受動onCompletedとcompletionへ渡す。CoordinatorはMount借用終了・記録保存の結果を加えたTask結果を一回組み立て、上位completionで必須の終端保存を待つ。保存失敗をTask成功へ補完せず、技術的なHome解放・回収事実は改ざんしない。

通知の原本・コピー・失効を管理するMapと照会APIは持たない。外部の任意値を内部通知として受ける公開入口も設けない。本番Host型はsubmission・notIssued・terminalの三callbackを必須とする。Controlと準備の一回消費、下位清掃結果の実体検証は別責務として維持する。生保存OwnerをRootへ公開せず、Domain→Executor依存を作らない。生Provider出力・認証値は保存せず、既存の閉じた診断だけを搬送する。

試験用の組立は製品Hostとは区別する。`scripts/verify-provider-attempt.ts`は明示呼出し時だけ非AI検証を開始し、既存ITも同じ関数を使う。試験の新品Repository-local Rootに限る排他と、Domainの既存確定JSON保存・読戻しを接続し、要求前の同期保存Gate、元Owner、終端callbackの相関を確認する。生成物は全子Process終了後に確認して回収し、確認不能ならexact Rootを報告する。これは試験fixture専用排他とイベントcommitであり、本番共有Home／Host排他、認証、Runtime state Writer又はRecovery保存の成立ではない。製品用Hostや保存Frameworkを新設せず、必要な有限試験構成をscripts／tests内に置ける。

実Homeの事前確認は別の明示入口`scripts/verify-provider-home.ts <provider> <run-id>`とする。固定Provider一値の既存Home metadataをPlatform Accessで観測し、既存と同じProviderHome Pipe名を使って共有排他を一回取得する。保持中の再観測と四Hash一致を要求し、元Lockの解放・終了を確認する。Native・取得・解放の未知は別に保持し、試験checkpointだけを残して停止する。checkpointへHome Path・Hash・SID・ACL・認証内容は保存しない。通常の単独非AI入口からは呼ばず、実行は用途限定の別承認を必要とする。これは事前観測であり、認証状態、AI実行許可、試行全体を覆うHome保持又は本番Host回復の成立ではない。

単段実試験の組立補助`scripts/provider-attempt-host.ts`は、検証済みRequestと新品試験Rootを受け、公開createExecutorへ渡す。Home Leaseの取得・生存確認・解放は製品Executorが所有する。Tool Hostは取得後の最初のcreate前にNative Homeを再観測し、同じRootで提出前Intent／Receipt・元Snapshot・清掃と解放の観測・元Completion受領を確定JSONへ保存する。Tool自身が別Leaseを取得したり元Leaseを解放したりしない。失敗時のretry・強制清掃・別回復参照は作らない。技術清掃とHome解放の確認は子Process最終exitの証明とは区別し、呼出し側が子closeと残存時のRoot保持を管理する。補助は試験Root作成や実行同意を代行せず、製品の永続StoreやHost喪失後の回復機能を提供しない。

### DI結果の直接接続と実行後処理（2026-11-05）

通常AttemptはprepareIsolationで元Requestを準備し、executeIsolationの同じCompletionを一回だけ待つ。DIのResourceSnapshot・Process終了・回収観測・一次失敗を直接解釈し、旧Session結果への変換やCleanup結果原本のWeakMap照合を行わない。Control Capabilityの同一実行照合とHome技術排他は維持する。

| 段階 | Owner・条件 |
|---|---|
| 技術実行・回収 | DI。通常終了後にExecutorから再回収しない |
| 共通終了順序 | 共通Controlが一回開始・取消・終端を所有。用途別Sourceが元DI Completionを待ち、結果構築と同じ同期処理でfinishしてから受動通知 |
| Attemptのfinalize | DI結果受領後に開始通知をjoin、資源終了通知、Home解放、最終通知。未知の技術結果ではHomeを保持 |
| Authentication | 共通ControlへDI Sessionを結合し元Completionを直接待ち、認証結果を解釈。元例外のrejectを維持 |
| Probe | 共通ControlへDI Sessionを結合する。空のCleanup／Finalize Hookを置かない |
| 純粋準備拒否 | DI実行要求前だけ未発行として終了。実行要求時例外・結果不明とは区別 |
| 単独回収 | 保存済み現行投影・ReceiptからDI契約へ変換。保存Schemaを変えず、通常結果の再変換には使わない |

開始通知の非同期完了をDIの同期onStartedへ返さず、DI回収後に待つ。Receipt通知へ届かなかった場合も元SnapshotのProvider実IDによる作成観測を保持する。作成事実・Process終了・回収成功は別の事実であり、欠測を不存在へ補完しない。

## 4. 検証と未実施境界

単段試験の合成指示は、解決済みPlan／Command内の固定Schemaとexact許可参照集合を使用する。Codex助言はCLIのSchema引数ではなくPromptで結果契約を伝えるためであり、手書きの別Schemaを正本にしない。表示Prompt・Hash・Packet・実stdinは同じ値へ結合する。技術completedと元終端保存が成立した後に内容検査だけが拒否された場合、既存Normalizerの固定理由を結果reasonへ残す。実行失敗又は元終端保存失敗は内容理由で上書きせず、Envelope欠測は既存の未確認理由へ閉じる。生出力は保存しない。

単段試験HostのReceiptは、本番Coordinatorと同じくDocker stdoutを`trim()`してから64桁の小文字16進IDとして検査・保存する。複数ID・途中改行・不正文字は拒否し、正常な行末を作成失敗へ読み替えない。生応答は保存しない。

試験所有`tmp/`の清掃は、Providerの生成物名やFile内容に依存させない。元Root・確定イベント・実行終了・資源回収・Home解放・子Process終了が共同成立した場合だけ、今回Rootの`tmp/`内の通常FileとDirectoryを対象にする。Fileは非link・単一link、Directoryも非link、全対象はlexical Pathとrealpathが一致することを要求する。本文やHashは取得せず、全treeの実体・Fileのsize／mtime／mode・各Directoryの子一覧を削除前に棚卸しする。メモリ使用を有限にするため逐次列挙でFile／Directory合計10,000 entry以内とし、超過は削除前に停止する。File容量・階層・名前の独自制限は追加しない。

tmpは内側から通常unlink／rmdirで回収し、各削除直前に元Root、tmp、全祖先の実体・残るべき子一覧と対象metadataを再照合する。tmp全体の清掃が終わるまで作業領域・確定イベント・managementは削除しない。初回棚卸し不成立では削除零、開始後の同時変更・Filesystem故障ではその対象の処置前に停止し、先行したtmp削除を取り消さず、残存Rootと結果を保持して未完了を返す。OS上の任意の同時改変に対する原子的削除保証は主張しない。新Lock・監視・Recovery・再帰force削除は追加せず、製品領域、OS tmp、過去保持Rootには適用しない。work・management・確定記録の既存の限定契約は維持する。

単段試験Hostの作成前記録はpurpose・既存計画の予定資源名・所有labelを持つ。これは予定の相関であり、Docker受理・実在・削除許可ではない。正常時の試験Root清掃は、五用途各一件・単一label・終了資源観測との予定名完全一致も要求する。既存の境界終了通知から、同じ操作・Provider・回復参照に一致する一次故障と固定終了boolだけを受け取り、試験結果IPCの`diagnostic`へ載せる。排他解放成功後だけ同じ投影を確定JSONへ保存し、解放拒否・不明後は書かずメモリから搬送する。診断保存失敗で実行結果を変更せず、生本文・例外本文・Home情報は保存しない。通知の受領をWorker exit・子close・清掃成功の証明にしない。

単段実試験CLIは`scripts/verify-provider-real.ts --describe <provider>`と`--run <provider> <run-id>`を分ける。前者は固定合成Context・Model／medium・Image Digestと非共有境界の純粋表示だけを行う。後者は会話等で用途・送信内容・モデル・回数・回収範囲について事前の人間承認を取得した実行者が明示的に呼び出す。端末の有無や確認コード入力は要求せず、nonce結合したIPC子一件を開始する。承認の永続台帳・自動判定・別の確認Frameworkは追加しない。子はRoot確定の親確認後、既存Home二観測・同期排他・固定助言計画・試験Hostへ接続する。Repository／Workspaceはmountせず、tools／session無効・API Key fallbackなし・Provider一回だけとする。取消・親切断は同Controlへ伝えcompletionをjoinし、親は一つの相関結果と子closeを共同確認する。既存単段期限から導いた試験監督上限を超えた場合は取消し、終了不明・Root保持とし、実行期限を緩和したり強制成功へ変更しない。

親は子close前に試験Rootを清掃・更新しない。Effect前に子が元回復参照を親へ渡し、親の受領確認後だけ開始する。結果搬送を失っても同じ参照を保持する。監督上限では同Controlへ一回取消し、既存取消猶予内でcloseを待つ。close未観測ではRootを更新せず、そのexact Pathと既知参照を報告する。元終端保存・exact回復参照・同期解放・技術清掃・正常closeの共同成立後、初回Root Identity、連番の確定JSONと既知Schema、非link・nlink、tmpの所有範囲とwork／managementの個別条件を確認して既存削除へ接続する。期待と異なる終端・tmp外の未知名・partial・内容不整合等では清掃せず、closeを観測した場合だけ当該Rootに非秘密の結果と七日後の再評価時刻を保存する。期限だけで削除しない。子stdout／stderrはdrainするが本文を保存・表示しない。固定Imageの存在・Engineの使用可否と外部送信は別途承認された読取り確認・一回試験で検証し、このCLI実装や代役試験から成立としない。

既存ERB-IT-002／004の反例を維持し、Provider両方の準備一回性、候補Owner交差、固定callback接続、元結果の相関、正常・取消・開始失敗・清掃不明・Owner喪失を非AIで確認する。Task段階順序はCoordinatorの既存有限試験で確認する。

独立ロードはCoordinator解決を拒否する子Processで実施し、不正開始のEffect零を検査する。これを正常な実Docker／実AI実行の証明にしない。実境界のL3／L5、人間操作、実データ移行は別途許可・検証であり、今回のSource移管から完了としない。結果と適用範囲は[移管計画](../../../99_Roadmap/Changes/CHG-000082/runtime-responsibility-realignment-plan.md)へ記録する。

局所候補Oracleは独立子Processで合成Plan・有限CommandHandle・試験callbackだけを接続する。正常、取消とjoin、清掃不明、保存通知例外を候補内で反証するが、製品Factory・Home排他・共通DIへの配線を証明するものではない。旧DI Sessionを介して本番Factoryを再現する専用分岐は撤去した。

実AI用の単段検証Toolは、確定したExecutorRequestを公開createExecutorへ渡す。Home排他の取得・生存確認・解放とDIの準備・実行・回収は製品Executorが所有し、Tool Hostは記録・取得後のNative Home再観測・元Completion受領を所有する。非AI結合試験も同じ公開入口と共通DI Lifecycleを通し、CLI／Process／Directory及びNative観測の外端だけを有限代役化する。旧候補Sessionを用いる局所Oracleは製品配線の成立根拠に使わない。実Process／Container不存在とHost喪失回復の実境界は別途検証する。

## 現行実装との照合

### 単段編集・レビュー・取消の検証候補

検証CLIの有限modeは`advice`（省略時）、`edit`、`review`、`cancel`である。製品APIとTaskの順序管理は変更しない。既存の一子監督・同期Home排他・提出前記録・Receipt・元回復参照・終了保存・close後の限定清掃を共有し、合成Taskの記述・構築・物理検査だけを`tests/support/task-trial.ts`へ置く。このfixture内の保護用空DirectoryはRuntime保存領域ではない。検証CLIの実際の試験領域はDomain Modelの名前付き`tests`領域APIで取得し、回収時は読取り専用の観測APIで確認する。実試験は製品Executorを使用し、模擬Executorや他の試験Runtimeへ接続しない。試験結果契約はv2とし、内容確認は`contentConfirmed`へ統一する。過去v1の記録を読む互換Readerや保持物移行は追加しない。

編集は新品Root内の`work/source.txt`だけを`BASE`から`EDITED_OK`（各末尾LF）へ変更する。保護用の空`.git`・`.crdd`は既存の三Mount構成で読取り専用とする。レビューは同じ検査済みbytesと差分を固定の読取り投影として標準入力で受け、ファイル読取り・ツール利用を指示しない。各試行は新品Rootを使うため、これは内容Hashで相関する単段確認であり、物理Workspaceの引渡し又はCoordinatorの順序制御の検証ではない。

取消は同じ操作・Provider・役割の開始通知を受け、同じControlへ一回要求しcompletionをjoinする。開始観測・取消要求の受理と終了観測・`cancelled`終端・元回復参照・清掃・Home解放・保存・子closeを共同確認する。`completed`を取消成功に読み替えない。取消後のFileが既知の二値以外、未知File／Directory、link、nlink差、実体変更、部分保存又は観測不能なら保持する。正常時も親の子close後に、元RootとDirectoryの実体・既知Fileの内容と単一linkを再照合し、通常unlinkと内側からの空Directory削除だけを行う。

人間の判断によりCodex GPT-6.1 Sol reviewerの暫定拒否を撤去し、通常のAI Adapter／Executor APIへ接続する。検証用Source置換ローダーとその専用試験は廃止する。既存のProvider・mode・Model・Effort・Packet・Mount相関、nonce・spec Hash・一回消費・回復参照・終了確認を維持し、不正な入力・余剰引数は開始前停止する。

元回復参照の発行前に準備が拒否された場合も、有限の理由と終了結果をIPCで保持する。これは回復参照null・blocked・fixture未確定・実行結果／終端／技術清掃未成立の閉条件に限定する。回復ACKを既に発行・受領した操作へ適用せず、同じexact参照の一致は引き続き必須とする。準備拒否を回収完了へ変換せず、子close後に既知記録を保持して個別に処置する。

Code Modeの全Tool不使用又は全ファイル非読取りの証明は追加の完成条件にしない。観測できるCommand／FileChange件数は診断情報であり、件数だけで実行を拒否・成功化しない。レビュー用workのbytes／Identity不変、正規レビュー結果、元終了保存・清掃・解放を共同確認する。既存のread-only Mount／sandboxと認証領域の保護・通信制御・隔離を維持し、許可Mount内の読取りをDockerが禁止するとは扱わない。新しいRunner、Queue、Registry、Lock又は永続許可台帳は設けない。

元の単段実装を上記Sourceへ移管した。計画・入力・取消・失敗結果の意味を変えず、Coordinatorの順序管理と保存を用途固定接続へ残す。非AI回帰と独立確認の結果は[移管計画](../../../99_Roadmap/Changes/CHG-000082/runtime-responsibility-realignment-plan.md)を正本とし、本書の設計評価とは区別する。実AI／Docker成立、実データ移行、全体QA／Releaseは本書から主張しない。

## Docker通知の受信と意味判断（2026-10-31）

ExecutorはDIのIsolationCallbacksで発行予定・元資源ID・Command観測・完了・実開始を受ける。通知はvoid又は指定された非同期段階のPromise<void>であり、保存成功のBooleanを返さない。allowCommandを撤去し、診断初期化はonCommandSubmittingへ統合する。Commandの技術分類と例外分類表はDIが所有し、Executorは元の型付き結果を再利用する。DIの開始時再検証失敗も同じ結果へ搬送する。Executor自身又は試験代役から漏れた未知例外はunclassified_exceptionとし、DIの例外分類関数を呼び直したり分類表を複製したりしない。AI Adapterによる認証確認とProvider内容の用途別解釈はExecutorが所有し、不成立は通知ハンドラーからthrowして後続要求を停止する。Docker Isolationは技術回収を継続し、上位の記録保存はExecutorCallbacksの利用側が所有する。既存の開始通知join、元結果・回復参照・Home解放条件は変更しない。


## DI共通入口への構成接続（2026-11-02）

通常Attemptの中間構成・九操作の技術通知・Home Lease・五用途ReceiptはExecutorが所有する。認証資源のReceipt捕捉とCleanup通知も認証Ownerに置く。DIの共通技術型を再定義しない。

回収入力は上位が保存したDI Snapshotと回収方針を使用し、旧固定五資源や助言Image条件から回復期待値を再構築しない。認証結果の解釈はlifecycle/authentication.tsに置き、DIに用途別の捕捉APIを残さない。Probeは引数なしCatalogの固定Imageを使い、自分の名前・Labelを構成する。

技術資源の観測・回収は引き続きDIへ委譲する。永続化・Task判断・保持期限・廃棄判断をExecutorへ追加しない。公開型は外部利用がある完了結果・通知と技術投影だけに限定する。

### DIへの技術期待値の構築責務

`inspectResources`／`cleanupResources`はDI正本のSnapshot要求を直接受け付ける。観測は元の読取りオプション、回収は元の通知をそのままDIへ渡す。Snapshot回収ではDIの元Sessionを返し、取消とCompletionを別々に扱う。元結果・資源・取消状態を旧Attempt結果へ再変換しない。`lifecycle/cleanup.ts`の旧固定五資源再構成と旧保存形式のReaderは撤去した。DIの回収入力はSnapshotと回収順序・既存の観測条件に限定し、別途のImage・User・Network・Mount・Init・Tmpfs照合候補は渡さない。元DI Snapshotを作成Intent／Receiptと同時に上位が耐久保存し、再入場で同じ値を使用する。旧形式互換Readerは追加しない。

ProviderのTask／Adviceに応じた実行物選択はExecutorに残し、DI Catalogのprimary／alternate技術配置を選択する。DIの固定Image制約を複製せず、DI共通準備・回収へ接続する。通常・再入場の削除アルゴリズムを二重実装しない。


## 資源記録とOperation Identityの分離（2026-11-05）

資源の実ID・名前・種別・所有Label・非秘密の現在構成はDIのResourceSnapshotを正本とする。DomainはSnapshot、key別のIntent／Receipt／観測checkpoint、元の回収方針を同じOperationへ保存する。初期未受領nullと、明示未発行・不存在・不明は区別する。最初のSnapshotと最初のIntentは同じ改訂で確定し、Receipt又は発見IDの保存失敗後に後続Effectを進めない。

Operation Identity v3は旧resources／imagesのコピーを持たない。Operation・Repository・選定・Home・Hostの相関を維持し、Host復帰時の資源名集合は保存Snapshotと元Planのkey・件数・名前で完全一致を確認する。null／欠測集合を空集合成功にせず、観測Image差を回収又はHost復帰の拒否条件へ戻さない。認証unknown不存在の限定証拠も元Snapshotのcontainer・名前へ結合し、現在設定から対象名を再生成しない。

この変更は新形式のみの契約変更であり、旧Identity又は旧資源配列の互換Reader、自動移行、新しい管理機構は追加しない。過去Evidenceと保持中の物理資源は変更しない。
### 単段Tool・利用側・管理情報の追従（2026-11-05）

- Attemptの外部入力は最初に自身のdata propertyとして捕捉する。target／選定／保護対象の欠測、accessor、Proxyは評価せず、乱数・DI・Nativeより前に拒否する。
- Toolは最初のHome観測後にRequestだけを構成する。製品が既存Home排他を取得した後、最初のcreate前通知内で同じHomeを再観測する。Toolによる別Leaseの取得は行わない。
- 製品Executorは同じ内部Home Leaseを、作成前通知及びProvider送信前通知の待機後に生存確認する。欠測・false・例外では後続Effectを停止するが、元資源のDI回収は妨げない。
- Tool Hostの未発行通知は、作成Intentに対応するkeyだけをDomainへ保存する。run／connectの未発行取消を資源keyとして誤登録しない。
- Taskの合成結果、再起動・認証回収の子本文もIdentity v3と資源Bookを使う。要求・実IDはSnapshot、Intent・Receipt由来・不存在証拠はcheckpointから読む。旧配列・旧Identityからの補完は行わない。
- Symbol管理情報は現在のSource所有者を参照する。識別子を単に削除して検査を回避せず、移管後のSourceと試験へ接続する。

この整理は新形式の実AI／実Docker再成立、Native Host Gate、過去保存物の移行・回収の完了を意味しない。実施結果と未実施範囲は移管計画を正本とする。

### 最終診断と取消の境界（2026-11-05）

Attemptの取消受付は最後の同期診断呼出しを含めCompletion構築直前まで有効とする。最終取消再判定を診断呼出しの後へ置き、その後にawaitや外部callbackを挟まない。正常結果への取消はcancelledとし内容・Hash・bytes・所見を公開しない。先行blocked理由と技術回収の事実は保持する。finish後の任意onCompletedからの取消は拒否する。診断Promiseは待機せずRejectを捕捉する。

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
