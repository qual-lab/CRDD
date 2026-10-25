# QA-000006 外部実行境界の検証定義

## 認証確認の一次失敗診断（ERB-IT-002）

認証出力の三値は診断であり実行許可ではない。非0終了では三値すべてを既存拒否とし、終了0でも未認証・不明なら本体開始前に停止する。次Commandへの診断残留、認証用途以外・応答なし・終了値欠測・未知三値の保存や実Provider検証Toolでの受理を反証する。正規の警告付き認証成功では従来の成功条件を維持し、一次失敗なしを確認する。現在状態・操作履歴と検証イベントの閉形式を揃え、欠測を否定へ補完せず、生出力を保存しない。取消・清掃・同じ回復参照の既存保証は変更しない。

Claudeの非0終了分類は既存`ERB-UT-032`と`ERB-IT-002`で確認する。明示的な実行失敗JSONだけを有界に読み、既存三subtype・既知stderrの優先、UTF-8の64KiB／8KiB一致と超過、説明の一〜128件と129件、個別／結合容量、NUL・重複key・深いJSON・未知形・通常回答の拒否を反証する。固定理由以外の本文・秘密値を結果へ出さず、Controllerの一次理由とcleanupを分離したまま搬送する。合成入力の分類成功を過去の実Claude失敗原因の確定、認証有効性、実Provider成功又は再送許可へ換算しない。

B3〜B5では、`ERB-UT-023`のDocker構成一致検査をDIの既存plan試験へ接続し、用途・順序・全argv差の拒否を維持する。助言のProvider Adapterと結果中継は一つへ統合し、既存の四つの一回実行／取消／cleanup不明／例外Oracleを統合後の受付から確認する。Profile・Catalog・Task／通信Hash・Repository非共有・元Host参照を維持し、編集Taskや追加Reviewerへ変換しない。既存Controller・Packet・Production Runtime試験と上位共通Task受付の結合を併用し、局所成功を実AI・実Docker・正式全項目Passへ読み替えない。

B2の排他移管では、`ERB-IT-003`のWorker／Supervisor故障・ready往復・解放・終了観測をPA内の`lock-lifecycle`結合試験へ移す。Coordinator側は用途別対象・世代・namespaceの検査と、本番Root APIを使った実排他・取得順・回復判断を維持する。入力拒否と技術lifecycleを別Oracleとして対応付け、試験用再exportや公開APIの追加で私有依存を迂回しない。項目の正式結果と歴史Evidenceは移管だけでは変更しない。


2026-10-23の人間承認により、Coordinator内の本番未接続の独立Trust評価と旧terminal codec／caller保存・再入場候補を廃止する。旧4 Sourceと専用試験3本は撤去し、製品処理の試験側コピーや代替Frameworkは作らない。通常実行、保存統合B、Platform AccessのNative部品・共有排他・現在の回復保証は維持する。過去Evidenceは当時の根拠として保持し、廃止をPassへ換算しない。 `PRL-UT-006`、`ERB-IT-001`〜`ERB-IT-003`とNative／Kernel等の共用検証項目は削除せず、旧codec・caller固有の断面だけを対象外にする。独立評価の`AIT-IT-001`／`AIT-IT-003`等の上流意図は残し、旧実装撤去後の代替未接続は未成立として扱う。

## 追加通信条件の純粋構成（2026-10-21）

接続確認では、`ERB-UT-023`の搬送設定再検査・Proxy引数への固定搬送・通信なしPython実Source確認、`EST-IT-004`の同意Hash差、既存Workbench／Orchestratorの公開受付を使う。画面期待Hashの欠落・不正・別Provider・設定変更、同意の非再利用、実行中Snapshotの不変性、ログインへの追加設定0を反証する。Provider／Docker要求0と、既存のFile読取り・操作準備を区別する。

明示Pythonを使う局所確認はTypeScriptとの正規形・Hash一致と不正設定時の起動拒否を確認し、未指定時は明示skipする。公開DNS24／32件の受理、33件拒否、一件でも非公開IPを含む拒否、全接続試行の単一15秒期限、失敗Socket closeと成功Socketの所有移譲も実Sourceへの有限代役で反証する。実通信は承認済みのProxy＋合成Client断面でnpm／pip取得、未許可Host・直接通信の拒否、取得後待機の取消・元ID回収を別々に観測する。認証を含む本番全体、実通信中の取消、実AIの成立へ拡張しない。個別実測結果は[変更記録](../../../99_Roadmap/Changes/CHG-000082/docker-isolation-source-structure.md)を正本とする。

`ERB-UT-023`の`network/policy.contract.test.ts`は、Provider別固定Hostと最大32追加Host、253文字・label63文字、ASCIIのみ、URL・port・IP・wildcard・末尾dot・正規化後重複の拒否を確認する。小文字化前のUnicodeも拒否し、getter・Proxy・hole・余分fieldから許可集合を作らない。順序・大小文字・固定Host重複が同じ実効集合ならHashを一致させ、返却Policyを深く固定する。用途・Provider・443 CONNECTもHashへ結合する。DNS実観測・Python Proxy・Image・本番同意はこの純粋試験の対象外である。

## Image実行定義とBuild入力の分離（2026-10-21）

`ERB-IT-004`の資産相関試験で、通常公開APIが取得Archive・Binary・Sigstore Hashを返さないことと、Build入力を明示的に読んだ場合に既存レシピ・Schema／設定期待値と一致することを分離して確認する。`ERB-IT-001`の既存bwrap取得・Seccomp条件、`ERB-UT-023`の助言Image・CLI位置・init条件、`ERB-IT-031`の版／内包Hashの観測Oracleは接続先だけを変更し、既存の期待値・拒否条件を維持する。実Image試験は明示許可時だけ実行し、通常回帰でDockerを起動しない。

Hostから渡すSeccompはImageの外なので、実行時の実体・容量・Hash照合と変異拒否を維持する。`--pull=never`、固定Image指定・構成読戻し・元ID回収の既存試験を保持し、禁止booleanやDigest文字列だけを実強制の証拠にしない。Build入力の期待値保持は署名検証の実行結果ではなく、通常試験の成功もImage取得・Build・実Provider・追加通信先の成立を証明しない。

## 読取り助言の実試験器（ERB-IT-021への直接接続）

読取り試験器も同じ終了条件へ接続する。実Tool本文の有限十二例で、受付前／受付不明の取消0、受付後の同ID取消最大一回、取消結果の回復参照保持後のcloseを確認する。HTTP期限とTask期限を分け、取消別ID・取消例外・副次失敗・close失敗で一次通信理由を上書きしない。Task期限のHTTP取消失敗後に追加Owner取消を発行しない。本文や秘密値を診断へ残さず、過去の通信原因の復元や保持中の資源回収成功は主張しない。

合成編集試験器の終了処置も`ERB-IT-021`の有限反例で確認する。受付前失敗・受付応答不明では別ID取消／Task再送0、受付後の観測失敗では同じIDの取消一回と結果受領後のServer closeを観測する。取消成功・未確認・例外・別ID・実行中返却・close失敗を分け、最初の通信失敗を保持する。通信診断は応答前／本文受信中、期限発火と清掃abort、既知／未知codeを区別し、秘密本文を出さない。有限代役の成功を実Provider再試行、今回残存の回収成立又は公開取消HTTPの実証へ拡張しない。

外部AIなしの有限Ownerと公開HTTPで、一Provider一回・固定入力・明示同意と引数拒否を確認する。標準Network ID差と構成差、既存Container／利用者Network変更、未知追加、重複、不正型、取得・parse・容量等の観測不能、cleanup不明を反証する。一次失敗＋close失敗を分離し、timeout後の完了競合でも成功にしない。比較成立だけでProvider結果・個別回収・全E2E成立へ換算しない。保存Lock Workerのstdio分離は`RFD-UT-006`と既存`ERB-IT-002`で、親listener不増に加え取得・競合・解放・error／exitの保持を確認する。

## Workspace方式の追加検証条件（2026-10-17）

Coordinator借用接続の追加断面は、`ERB-IT-006`の通常二役割・一回是正・範囲逸脱停止・取消、`RFD-IT-013`／`PRL-IT-013`の実GitでのDirect／Isolated入力搬送・開始dirty基準・二Task継続・元Tree／Branch保全、`ERB-UT-023`の三Mount計画と回収観測照合に割り当てる。旧Bundle準備／保存へ進まないこと、Reader拒否でfallbackしないこと、欠測を変更なしやTree保持済みへ補完しないことを確認する。局所代役の成功を実Provider・公開E2EのPassへ拡張しない。

独立レビューで検出した即時回収の期待値搬送不足は、`ERB-IT-004`の本番command-runtimeと有限Transportを通す五Mount正常／欠落／RW／Source差の反証で確認する。最終観測は`PRL-IT-005`／013でTaskAttemptから上位Task／Attempt／Operationへ搬送し、Direct変更あり／なし／欠測とIsolatedを区別する。`ERB-IT-006`ではHost意図／Receipt保存拒否の早期失敗も元理由と回復参照を保持し、変更なしへ丸めないことを確認する。metadata搬送を新しい耐久保存・採用・Tree現存証明とは扱わない。

現在のSecret区分は[DI共通方針](../../../06_Architecture/Details/docker-isolation/01_Architecture.md#workspace-isolation-policy)を正本とする。Direct／Candidateに同じ技術方針を適用し、開発用`.env`のdummy内容が読めること自体をFailにしない。`ERB-IT-001`〜004の追加条件は、Repository外・Git実管理領域・`.crdd`の書込み境界、Provider認証等の保護、用途別RW、取消／回収とする。本番SecretをGit・通常開発環境へ置かないこと、開発資格の本番権限なし・限定権限・期限は既存管理の構成・運用確認で評価し、模擬値やDIの成功を実Cloud権限検証へ流用しない。未確認は未評価として残し、自動Cloud検査や新しいRuntime Gateを捏造しない。旧隠蔽試験のFailは歴史として保持するが、新方針の不合格へ流用しない。Source共通化・新条件の実境界はNot Run。

[Workspace詳細](../../../06_Architecture/Details/coordinator/05_Workspace.md)の`docker-isolation.workspace-borrowing`（ARCH-000008）を追加する。`ERB-UT-023`は読取り助言／許可された変更依頼の分類と最小投影、`ERB-IT-001`〜004は新対象からの実Mount・Process開始／終了・取消・一次失敗とcleanup・観測不能を確認する。`ERB-ST-005`／030は通常公開Taskの結果と、実取消・親喪失後の同対象再入場を相関する。Git Worktreeの分離をSandboxとみなさず、未許可Repositoryへのアクセスと、共有Git管理情報への書込みを拒否する。Direct AI書込み／共有Gitの許可が未決なら新Effect前に停止し、継続Workspace・元変更・他Task成果の保全と実行資源の回収を別に観測する。基準DI完成は新方式の実Mount・全Provider経路の成功証拠にしない。

本節の新方式全体はNot Run。以下の限定実測だけを区別し、既存Local Itemの元結果・旧方式のEvidenceを新方式へ継承しない。詳細Schema・操作許可・dirty／Commit処理の未決は該当実装前の停止条件とする。条件区分は正常・境界・準正常・異常・回復を扱い、UTの値判定、ITの実保存／実Git／実Mount、公開ST、利用者UATを相互代替しない。

2026-10-17のDirect最小構成の合成実証は、`direct-mount-boundary.integration.test.ts`で`ERB-IT-001`／002の設計調査用の限定断面として実行した。通常編集・固定Pathの11観測後、hardlink別名による元dummy内容の読取りでFail停止し、二構成目・後続刺激はNot Run。Git書込み・秘密file別名読取り・全Directの失敗を実測したとは扱わない。Host不変と試験物回収を確認し、結果・限界は[変更の調査記録](../../../99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#承認済み一回の実証結果と終了2026-10-17)へ接続する。この限定反証は新方式Local Item全体の正式結果ではなく、上記Not Runや既存Evidenceを上書きしない。

その後の明示承認により、同じ試験器の目的を固定Path書込み境界へ限定して更新した。Directory型／ポインタfile型の二構成とも、Source書込み・開発dummy.env読取りの正常対照と、`.git`／`.crdd`の固定Path書込み・rename・unlink拒否、Host不変、自己資源回収が成立した。試験器の局所二件と実Docker一件が成功。詳細は[実行版Hashと限定結果](../../../99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#固定path書込み境界の承認済み限定結果2026-10-17)を参照する。前回のhardlink読取りFailを解消した試験ではなく、Secret完全隠蔽・全link経路・任意Repository・実Provider・新方式全体のPassは主張しない。

公式配置Imageの`ERB-IT-031`は、既存Host専用試験の独立Caseで通常entrypointの版表示と三実行物Hash取得を分離し、実Image IDで結合する。AI Adapterの固定配布Identityを期待正本とし、Image既定entrypoint／User／Workdirと各Containerのnone・非root・read-only・cap-drop・no-new-privileges・Host mountなしを実inspectで確認する。Warningは有界の元stderrを用途別に保持し、消去や空への正規化をしない。元ID・名前・Label・構成の再確認後だけ自己資源を回収し、ID／名前／Labelの不存在とRoot清掃後だけ完了を表示する。作成結果不明では名前だけで削除しない。通常Profileの純粋Oracleは誤版・各Hash差／欠測／余剰・別Image・出力／終了不明と一次／清掃失敗の三組合せを反証する。この配置物確認を再Build、取得元再検証、Code Mode Host機能、認証、助言・取消やProvider E2Eの成立に拡張しない。

Native検証Toolの通常構築は`native-tool-process.contract.test.ts`で、`ERB-IT-001`／`ERB-IT-002`の局所断面として確認する。三Toolの四Cargo helperの実本文から固定argv／optionsを照合し、三Toolのartifact選択は正常一件・0件・2件・nonfile・link・nlink差・realpath差を区別する。実spawn〜close断面は仮子・仮timerで構成を照合し、error／exitだけで未完了、close後の完了・timer解除・Signal listener解除を確認する。実Cargo／Native／OS資源を生成せず、実Build、Tool全体、実Native終了・回収、Docker・Provider・E2Eの成立は主張しない。旧Source graphの任意改変拒否を再実装しない。

旧配布試験から分離した`typescript-child-entrypoints.contract.test.ts`は、`ERB-IT-002`のうち子Process／Workerの生成前入力拒否だけを確認する。実Wrapperへ不明role、kind違い、shell、evalの六反例を渡し固定理由を照合する。開始後の搬送、取消、handle回収や実Native／Dockerの成立へ拡張しない。DIのPackage境界試験は必要な実Root APIに加えて内部資源回収・子生成Primitive五件の非公開を確認する。

隔離Packageの依存配置は`package-boundary.contract.test.ts`で現行src全数と同じ判定による反例を確認する。既知Node builtin、同Package src、Platform AccessのRoot公開入口だけを許可し、type-only／再export／literal dynamic importの上位依存・PA内部参照・未知moduleを拒否する。非literal dynamicは未検査のまま通さず拒否する。この限定静的検査と実Rootの必要API存在は`ERB-IT-004`の前提配置だけであり、完全なTypeScript構文解析、敵対Sourceの安全性、実Effectの拒否や隔離成立は主張しない。

現行資産の相関試験はREQ-000016由来の構成前提として、既存`ERB-IT-004`のunknown gate試験へ接続する。`runtime-assets.contract.test.ts`の三Caseは、DockerfileのCOPY／ENTRYPOINT、AI Adapterの版・実行Path・設定Hash、助言Image準備の実本体による三入力搬送だけを確認する。未知状態での次Effect拒否自体は既存の実行境界試験が所有し、この三CaseをLocal Item全体のPass、公式実行物のHash検証、実Build、Image検証、Provider／Docker実境界またはE2Eの成立根拠にはしない。旧署名配布の収集・graph検査はQA-000010の退役対象と区別する。

Sessionの署名配布依存撤去では同じ`ERB-IT-004`で、旧三入力fieldの拒否、期待Source Hash差、旧配布API呼出し0、元admission tokenの欠測／初回失効／再確認失効、新token最終失効、同Artifact内容の別実体とborrow時だけの失効／例外を確認する。cleanup初回も元Identityへ結合し、失効を新しい観測で上書きしない。各確認を省く実本文変異、元tokenと新tokenの個別照合順、実観測由来のScope／期待Hashの結果搬送を確認する。これらの局所結合から実Native・Provider・Dockerの実境界成立を推定しない。

開発実測のSource入力は既存`ERB-IT-004`で、固定Scopeの内容Hashと実体Hashの分離、必須Source欠落・空・link／hardlink・途中差・各上限を確認する。列挙は上限内の逐次読取りと同handle回収を確認し、Fixtureは既存のRepository検証済みRootと同handle清掃を使う。既存実測Toolの読取り専用入口は、RuntimeRoot／packet／Task準備より前の分岐、同じ期待Hash、余剰引数拒否、非Authority、実体Hash非公開と生成0を確認する。Windows junctionの実反例はHost Profile、それ以外は通常Profileで選択できるよう、Owner script・固定母集団・Catalogを同期する。これらの読取り試験を、Session全体・実Bootstrap借用・Provider発行・Docker回収・E2E成立へ拡張しない。

通常Nativeの確認は固定Bootstrap Hashと実体観測へ接続する。既存`ERB-IT-001`はPA実Filesystemの固定実物／同長差／Root差／欠落を、`ERB-IT-003`はnamespaceの固定実行Path・二mode・環境・nonce・親実体・同token四時点・部分receiptを、`ERB-IT-004`は通常Home／保護Rootの本番分岐と開始／前後確認省略の同本体Oracleを確認する。HostのCurrent／KnownはArtifact全6 field・同方式・Revision `null`と既存の対象全fieldを共同照合し、二呼出し間のRoot／File継続同一性は主張しない。HEAD差でも採用済み固定Hashは通常確認でき、Git由来APIは同じ状態を拒否することを分離する。旧配布graphの未成立を通常試験成功で置換せず、正式Local Itemの実境界／E2E結果は別に評価する。

成果物種別: Quality定義
Quality ID: `QA-000006`
検証目標: OS、Process、Container、外部CLIおよびAI Runtimeの意味を推測せず、要求から終了後状態までを段階別に確認する
主な試験段階: Unit／Integration／System
状態: Canonical
維持責任者: Qual-Lab

## 修復退避物の後続処置（検証未完了）

残存包装の集約では既存`ERB-UT-023`で24構成の九argv全文Hashを移管前へ照合し、Proxyの固定包装だけからの投影、二env欠測／重複／順序差、別purpose・包装外decoy・payload追加と不正認証環境名を反証する。合法な別profileは上位`ERB-IT-004`で元Provider相関へ接続して要求前拒否する。Seccomp実物の等価移管は同ITで、同一Pathの実読取りとfile／link／realpath／容量／Hash／読取り前後Identity差／例外のnullを確認する。上位のMount返却・Authority0／Docker0は既存準備義務を維持し、値・実体照合の成功を実Container隔離の完成へ拡張しない。

Task回復の固定技術組立は既存`ERB-IT-004`で、構築時のCLI／環境取得0、要求ごとの環境→Owner／CLI→config→最終Owner→spawn、二生成・close後も同じsnapshot、初回observe失敗後の未設定と再検証失敗時の非fallback、二つの既存拒否理由と余剰getter未評価を確認する。元executor／closeの参照と既存回収順は変更しない。上位の`ERB-IT-014`ではfactory入力のexact二key（借用所在・同期Owner確認）と実config清掃・現在状態保存の接続を確認し、VMの純粋組立確認を実Docker／再起動の成立へ拡張しない。

Probeの本番固定binding移管は既存`ERB-IT-004`で、platform→CLI観測→同期management読取り一回→固定環境領域生成の順序と複合拒否理由を確認する。読取り拒否・Promise・不正所在では領域生成0、各要求直前は同snapshotを再検証し、全Callerは同bindingと同じHost相関を維持する。Image／Name／Label／Engineの保存用記述は全六profileの実作成計画と照合する。上位四投影Suiteの二保存・rollback・私有参照消費・Host世代排他のOracleを下位単体試験で代替しない。製品から外したAttach三故障のready／overflow／終端要求一回／closeは下位`ERB-IT-002`の実Node子で確認し、上位ST・実Docker取消の成立へ拡張しない。

Probe回復記録の既存Host記録Ownerへの集約は`ERB-IT-003`で確認する。実Writer→Readerの初回null ID／確定ID再保存を独立期待の全文・末尾改行・時刻・nonce Hash・token Hashへ照合し、旧tokenとHost／Probe混同を拒否する。token四軸・別Root・記録／Root／子の実体差・種別差・link・未知子・観測例外、分類での部分欠測とmountでの必須四用途拒否を分ける。本番Callerの前後二保存とfresh回復順は引き続き`ERB-IT-004`で確認する。記録保存や読取り成功を実Docker不存在・回復成立へ昇格しない。

実行loop移管は既存`ERB-IT-002`／`ERB-IT-004`へ接続する。DI Session返却前hook0、固定九purposeの順序、同期保存／受理Gateのfalse・throw・Promiseと再入取消による次要求0、全五CREATEの取消中Receipt先行を確認する。Process開始失敗は通知0、開始保存はReporter→Taskの既存順とし、false／throw、技術completion前後、永久保留中の取消／自然終了／期限でDI清掃一回が確認Promiseに依存しないことを反証する。Provider待機300秒はDI開始観測直後から起算し、旧上位await後起算と区別する。上位の最終成功は確認settle前に公開せず、遅い結果から再発行しない。取消と失敗の競合でHandle終端一回、清掃中／終端後の取消で元技術失敗を上書きしないこと、元清掃結果・元Runtime・元計画・両Owner一致とコピー拒否、終了後のcallback／登録参照0を確認する。既存Windows Process Gateは新Ownerへ接続し、Candidateの非本番表示を実Effect0や実Docker成立へ読み替えない。

保持Callerの`ERB-IT-014`では、初回DI読取りと固定7日receipt、専用保存拒否、取消後の既発生事実保存、履歴未確認／終了途中／除去済みのexact再入場、Reader前後期限差と旧receipt欠測の拒否を確認する。保存済みreceipt再入場で読取り・日時生成0を確認し、実Root試験では一行履歴・対象外本文・pending／marker不存在・操作除去と同一期限を照合する。CLIの`PRL-ST-001`は入力ID一致・閉じた期限field・正規UTC・相関不正・解除不明のexit2を確認し、再観測していない技術flagを補完しない。

保持引渡しの終了候補は`ERB-UT-036`で、receipt付き第三形だけの除去、未確認履歴と旧receipt欠測の拒否、期限前／同時／後で同じ終了資格を確認する。専用Readerは`ERB-IT-014`で実履歴出版から対象除去前後の同一期限、破損期限・欠測receipt・現在履歴との対象差・履歴欠測の拒否を確認する。blockedおよび通常二形へ期限を補完せず、Path・用途別実体を出力へ追加しない。Caller・CLIの引渡し成功は別の接続条件として維持する。

保持引渡しの専用Writerは`ERB-IT-014`で、通常保存、用途偽装、codec合法なcheckpoint一軸差、rename前切断の同一候補再開、確定後marker清掃を確認する。本文・receipt・改訂・previous Hash・戻り値status・排他解放を共同照合し、既保存receiptの同値再保存を拒否する。期限保護は`ERB-UT-036`で、通常1日設定と7日期限の直前／同時／直後、未終了操作の確認済み／未確認行、欠測拒否、操作除去後の通常整理復帰を確認する。期限から物理削除・completionの成立を推定しない。

`ERB-UT-039`は単一entry観測のprivateな同期終端順序を検査する。openのFILE_NOT_FOUND／PATH_NOT_FOUNDだけをA応答へ分類し、access denied／sharing violation／その他を2・出力0とする。取得成功ではquery成否によらず同handleをclose一回、queryとcloseがともに成功した後だけP応答を出す。write即時失敗・部分write後失敗・flush失敗は3を維持し、部分／完全frameが存在しても成功へ変更しない。固定イベント列・全文／部分bytes・一回のhandle搬送を独立期待で検査する。実Win32の故障、OS全handle不存在、DI処置許可・物理回収の証明とは分ける。

単一entry観測は`ERB-IT-001`／`ERB-IT-002`へ接続する。Nodeでは実観測本文の固定Artifact・argv・環境・期限・出力上限・正常終了・完全frame・凍結値を確認し、正常file／Directory／AF_UNIX／未知tagのraw値と明示不存在を区別する。未知tagのraw観測成功は削除許可ではない。短縮・余剰・別magic・未知状態・不存在payload汚染・属性tag矛盾・zero実体／linkCount・Process異常・Artifact前後差はnullを要求する。Native CLIは既存file／Directoryと不存在・不正Pathの実観測を確認する。AF_UNIXのNode lstat失敗をNative実体へ補完せず、本Native入口の実測でtag・実体を確認する。同期失敗分岐の注入は`ERB-UT-039`が所有する。bootstrap固定配布Artifactから公開APIへ接続したHost試験では、通常file／Directory、同実体・linkCount2のhardlink、tag0xA0000003で別実体のjunction、不存在と内容保全を確認する。制限内とHost実行を分離し、清掃前の所有Root／親実体再確認と自己生成物不存在を要求する。この限定接続から、正式Manifest全体、DI Driverや物理回収の成立を推定しない。

専用Writerの検証は、通常／Session用途からの回収候補偽装と、外側だけ／Kernel内だけのguard省略を区別する。三用途の一用途更新、保存前rename拒否と出版後marker除去拒否からの同ID再入場、分類用途・候補bytes・改訂・元結果保全を確認する。同値進捗では既存Readerを使い、物理Writer／Context未生成・変更API 0を確認する。Readerの部分成立、raw由来Hashと本文の差、Owner失効・例外・Promise、pending／marker／未知entryを成功へ補完しない。実体差替え・Kernel解放不明の実境界は、Readerの既存検証と今回の接続検証のどちらが所有するかを分け、VMだけから実Kernel終了を主張しない。

現在状態への純粋な接続も`ERB-UT-036`で検査する。未出版の判断待ちだけからdiscard判断とDI初期値を生成し、明示保持・既出版・不正時刻・別ID・非正規本文を拒否する。以後は一用途進捗のみ許可し、通常遷移からの判断／進捗偽装、元結果／技術checkpoint／判断時刻の変更を拒否する。同値進捗は未出版時だけ元版bytes・改訂・元版Hashを維持する。回収途中の要約・履歴確定を拒否し、全三用途の不存在確認後だけdiscard要約へ判断時刻・checkpointを投影する。要約確定後の進捗変更は同値も拒否し、履歴確認前のcompletionと明示保持のcompletionを拒否する。非discardの要約bytesは維持する。旧形式の回収途中かつ既出版の状態を拒否し、自動移行しない。これは純粋値の根拠であり、専用Writer・保存途中再入場・物理回収の根拠とは分ける。

回収進捗の純粋契約は既存`ERB-UT-036`へ接続する。各用途の18tuple候補と合法10形の100前後組を三用途で検査し、独立固定行列によって初回意図飛越し・要求不明消去・不存在確認後の追加発行・他用途変更を拒否する。余剰／欠測／継承／Accessor／Proxy／未知値の拒否、trap 0、全層の凍結・独立コピーと入力不変を確認する。三用途の一つでも確認欠測なら値上未終端とし、unknown要求を残した終端を許す。過去観測unknownからの値上進行と、現在fresh確認不成立なら実要求0というDriver義務を分け、純粋試験から後者の成立を推定しない。旧九処置checkpointへの混入拒否と既存回帰を維持する。

退避物なしの修復終了→fresh Taskの接続は、既存正常Owner1回のHost Caseで`ERB-IT-014`と`ERB-IT-003`へ接続する。Host／Home生成前に実修復API・DI Machine・現在Writer・履歴・completionを通し、同Rootのstateを再初期化せず後続Taskへ引き渡す。Native／Docker技術境界だけを代役とする。修復中に捕捉した実state bytesを入力とする純粋Task追加候補がnullとなることを確認し、修復中の実Writer／begin拒否の証明にはしない。終了後は改訂と元版Hashの連続、Task各段階で元修復履歴行のbyte・Hash・時刻不変、既存Taskの実Host／Home回収と対象除去を確認する。修復未終端なら試験Rootを削除せず、Host清掃とmock復元を試行して元失敗を保持する。2回Caseの元の意味は維持し、この結合から保持物回収・保持引渡し・実Docker／Nativeを推定しない。

[限定回収設計](../../../06_Architecture/Details/docker-isolation/01_Architecture.md#修復後の退避物回収採用済み実装未完了)を既存`ERB-IT-001`／`ERB-IT-014`へ接続する。三用途それぞれの正常回収と、別ID・別Scope・同名別実体・親差替え・source同実体・非使用不明・未許可型・観測不能の削除0を確認する。実体型の許可集合とOS削除意味の確認前に実回収を開始しない。通常成功、保持引渡し未成立、境界不一致、部分回収／確定保存失敗の四群を反証し、実対象の不存在と兄弟・現在sourceの保全を別々に観測する。

既存修復Owner試験では、前意図の実保存・読戻し・解放、物理処置後の保存切断とfresh同ID再入場、元checkpoint・一次失敗の全文不変、取消／Owner／Root／CAS失効、一般Writer偽装拒否を確認する。回収済み対象への再削除0と、未観測・観測不能の非成功を要求する。通常discardは既存修復要約・履歴一行だけへ判断時刻と三用途全tupleを正確に投影し、独立期待全文と合法な一軸差の負対照で検査する。回収途中の出版、旧partial既出版状態、同IDの二重追記を拒否する。出版途中の同exact再入場、初回時刻・本文／行Hash固定、未確認行の期間整理からの保護、確認後だけのcompletion、操作除去後Readerの同条件認識を確認する。別種別・別行・別Writerを追加しない。

調査用保持の7日は判断時刻から固定し、期限欠測・時計不明／逆行・期限到来から自動削除や完了を導かない。保持判断保存、期限付き責任引渡し、現在操作除去、同Rootでのfresh Task開始は別に確認する。通常回収と期限付き引渡しの両経路が利用側まで成立するまで未完了を維持する。試験件数・合成結果だけから実Docker、実AF_UNIX回収、Package全体完成を主張しない。

上位の純粋引渡し候補は`ERB-UT-036`へ接続する。現保持Callerを維持したまま、未出版の判断待ちだけから条件付きretentionを一改訂で導入する。正規UTC／exact604800000ms、三用途の元checkpoint/action相関、expected非nullの保持不要、present→null・用途交換・別実体・既保持／既出版の拒否を確認する。一般更新からのreceipt導入／変更を拒否し、専用完全再導出だけを受理する。新handoffだけにreceiptを含む要約全bytesを独立期待で照合し、旧非handoff要約bytesは維持する。履歴時刻はdecidedAtに固定し、不一致の状態・行を拒否する。純粋履歴候補からWriter接続・期限前保護・completion・引渡し完了を推定しない。未完了操作・未確認行保護は期限と独立して維持し、引渡し終了後の期限後receiptは通常の履歴整理へ戻す。無期限の再特定保証や追加管理Protocolは導入しない。

保持照合の固定読取りも`ERB-IT-001`／`ERB-IT-002`へ接続する。三用途の元retainedとfresh二読取り、対応action tuple、元Scope・Artifact・KnownFolder、各読取り前後の同期Owner・取消を共同確認する。明示保持だけにNode実体の非秘密metadata投影を認め、生Path・処置Authorityを含めない。元presentの消失を用途内nullへ丸めず、観測不成立は結果全体nullとする。expected非null／retained absent／not_requiredの継続世代と、新live sourceが存在する保持先一致は正例とし、過剰拒否の変異も検出する。用途写像差・交換、実体一軸差、二読取り間変化、三用途途中失敗、Promise／例外／失効、凍結・独立コピー・入力不変を反証する。読取りの成立から上位receipt保存・履歴期限前保護・引渡し完了・fresh Taskを推定しない。

## v0.22通常Runtimeの署名境界訂正

固定payloadの単一所有は`ERB-IT-004`へ接続する。移管前版から独立に固定した六payloadのSHA-256と作成全argvを期待値とし、実作成・純粋planner・構成期待の選択が一致することを確認する。現行Callerは私有Identityへprofileを必ず登録し、旧record採用一箇所だけが明示legacyを登録する。欠測・空・未知profileの拒否と、別合法profile・legacy候補の欠落／追加による照合差を反証する。上位の試験用三中継は撤去済みとし、固定argvはDI planner、本番のprofile・Probe ID・三Path・binding搬送は既存上位Caller試験で確認する。履歴的EvidenceのHashや旧recordを改名・書換えせず、構成投影を実Docker観測の証拠にしない。

固定Probeの取消・残存開始移管は`ERB-IT-004`へ接続する。上位二保存の後だけ同じ実ID・Probe名・三Pathを下位へ搬送し、三地点の所有読取りの失敗／Path差／不正返値、構成不明、ready／completion期限、SIGTERM失敗、overflow、join不明／例外と遅延通知を反証する。実終端要求数とjoin呼出し数は区別する。元失敗→join不明→上位cleanupの理由優先順、部分候補・post確認欠測・attach終端欠測・Host清掃欠測の公開非成功、私有absenceの同対象相関を実本文で確認する。稼働残存はstart一回10秒と前後観測、失敗後の再開始0・成功時の回収0を確認する。取消出力・猶予・終了値の純粋分類は`ERB-UT-038`へ接続し、合成試験を実Docker取消・実回収の成立へ拡張しない。

旧Verification Tool群の全Source集合・AST・body SHA一致は明示任意の比較検査とし、通常Runtimeの完成Gateから分ける。対象は固定したLegacy一Caseで、候補昇格のargv／cwd／結果搬送、coverage Tool引数、未知scripts追加、旧Orchestrator検証loader／結果置換を含む全体保証が任意側へ移る。通常側にはprivate import・Process所有・未知本番入口・実行Artifact出所等の個別反証を残す。混在File全体を任意化せず、Windows専用試験の有無によらず通常Runnerは同一Legacy一Caseだけを除外する。任意検査の不合格と通常回帰の状態は別に評価し、一方の成功で他方を補完しない。

旧署名Matrixからの移行では、`cleanup_withheld / parent_terminated`を既存`ERB-IT-003 / PRL-IT-013`へ接続する。実Writerの保存三確認と実Reader、Host開始、五資源未要求を確認した子が、清掃観測・finalizeを行わず終了値0で終了する形と、同期packet後に生存している子を外部親が既存Platform Accessで終端する形を分ける。親はfinally未実行だけでなく耐久state・実Host／markerの残存を確認し、別Processの現在Consumerによる同exact IDの回収、履歴一件、対象除去と兄弟本文／実体保全まで確認する。外部親終端では補助結果・closeと元子close／stdio終了を個別に確認し、負例専用fallbackを正例へ数えない。これらは実cleanup I/O故障や稼働Containerの回収試験ではなく、旧Matrixの稼働Container回収能力は別途検証する。

Probe inspect移管では既存`ERB-IT-004`へ、固定構成とpayload候補の各一軸差、三mountの欠落・重複・余分・別実体、実Repository-local Directoryのrealpath照合と読取り例外、DI falseと私有Container参照取下げ時の追加Docker要求0を接続する。上位の単一候補／既存集合の選択と三Pathだけの搬送を実本文で確認する。観測・回収群では、削除直前のfresh構成照合、完全実ID削除、実ID・名前・Labelの三軸要求の対象と順序、各応答の失敗・残存、削除しない不存在観測、Running falseの非昇格を確認する。Probe名は既存plannerの構文へ一致させ、dot・65文字・underscoreを三APIで要求前拒否し、64文字を正常対照にする。三軸の別合法値への搬送変異は全argv Oracleで拒否する。上位の下位拒否・例外・理由不正では私有参照登録／Host遷移0、成功相関はコピー・別対象・別Host／Root／CLIを拒否してexact参照だけ一回消費する。Host世代Ownerの実失効は別検証とし、純粋分類の`ERB-UT-038`へFilesystem境界を追加せず、実DockerやHost保存は別の検証義務に維持する。

診断Probeの技術結果分類は、`ARCH-000008`とDocker隔離詳細の作成ID・三軸不存在・完了応答契約から`ERB-UT-038`へ導出する。AI結果処理の`ERB-UT-023`は流用しない。正常ID、不正／欠測、UTF-8容量境界、三軸各々の残存・非0・error、完了JSONと余分field・Signal・stderr容量・時間不正・期限／容量理由の優先順を反証し、条件の等価移管だけを確認する。値分類の成功を実Process終端、実Docker回収、Host保存または実回復の証明にしない。

実Process消失の移行試験は既存`ERB-IT-003 / PRL-IT-013`へ接続する。実保存確定・Writer解放直後とHost開始確定直後を別刺激にし、同期通知・強制終了・finally未実行・親のProcess終端・Home排他再取得・実marker状態を個別に確認する。fresh子が同じexact IDを回復し、対象だけの物理除去、兄弟Host実体／本文保全、履歴一回と短命物不存在を要求する。初期切断の例外はmodel再導出の全文比較で限定し、五用途の要求状態・各field、実行評価、pending／token／物理状態差、対象参照・配送を個別反証する。実Process停止試験は実Dockerの作成・回収試験とは区別する。清掃pending前後の切断・失効／保存故障の追加確認と独立レビューが残る間は、この移行単位を完了扱いにしない。

2026-10-14の人間判断は[Coordinatorの三分離](../../../06_Architecture/Details/coordinator/01_Architecture.md#9-通常実行追跡正式配布の分離)へ接続する。CRDD独自署名・Manifest・署名Capabilityを通常実行の必須Gateから外し、署名E2E未実施だけを新経路の未成立理由にしない。通常Task・CLI・Workbench助言／候補・OrchestratorのSourceは旧署名Gateの引数・発行・消費を撤去済みである。専用静的検査・Coordinator固有署名Toolは物理撤去済みである。撤去後の全体回帰、本番の実Provider境界と全体E2Eは未成立として維持する。

| 既存Local Item | 維持する検証義務と訂正 |
|---|---|
| `ERB-IT-001`〜`ERB-IT-004`、`ERB-ST-005`、`ERB-ST-030` | 要求・開始・Effect・取消・清掃・unknown・同じRecovery IDを維持。署名拒否で終わっていたCaseを本来の拒否条件まで到達させる。未署名通常入口から実隔離・結果帰還まで新しい実測が必要 |
| `ERB-UT-023` | 許可と結果分類を維持。署名／Hash一致だけでは送信・Repository／Home利用を許可しない |
| `ERB-ST-009`、`ERB-IT-014` | 既存修復の安全な運用介入・現在実資源観測を維持。旧署名版・Release chainによる再入場は旧方式比較基準であり、Commit／Hashへ置換しない。旧記録はフロントAI移行完了まで現在制御へ採用しない |

反証は、①未署名でも現在認可・固定入口・用途・Home・隔離条件が成立すれば実行へ到達、②署名成功／Hash一致だけでは実行許可0、③必要Artifactの差は同一性不成立として停止しPublisher偽装とは混同しない、④Root／入口／必要Hash観測不能は新Effect0、⑤既発行Effect・清掃不明・元Recovery IDを保持、⑥任意配布署名の失敗と通常Runtimeが独立、を用いる。通常Consumerの旧Gate撤去と、その取消・回収条件は現行Source・試験で確認する。専用静的検査・Coordinator固有署名Toolは退役済み、旧回復fixtureは未移行であり、過去成功・Case数・署名結果から新経路全体のPassを推定しない。新Local Itemを機械的に増やさず、Source切替時に既存項目の導出・Test・Evidence接続を再照合する。

旧署名資格の発行・消費・失効と一回消費／5秒寿命状態は退役した。旧資格の専用二Caseは退役し、旧Moduleを含む固定十八Pathの明示不存在と、現在の入口・Task・Native Sourceの旧依存不存在を確認する。Process poison／drainの入力読取り0は現在のTask入口でget・ownKeys・descriptorを確認し、External Send・Runner・fresh Processの既存義務を維持する。旧資格試験の撤去によってQA Local Itemの成立数を増減せず、撤去後の全体回帰や実境界の未成立を隠さない。

明示保持のCLI接続は`PRL-IT-012`／`PRL-ST-001`で確認する。現在修復IDだけの単独操作を受理し、欠測・不正・重複・全doctor操作との両順序混在を拒否する。実parserと本番router本文、CLI関数本文が同Root・Signal・exact ID・必須`retain`を既存APIへ一回渡すことを照合し、目的欠測・通常修復化・ID差替え変異を同じOracleで拒否する。保持の開始前取消はRoot／API 0、保存後取消は既存保持事実を巻き戻さない。表示前解除、解除不明・表示失敗後の再実行0、保持／履歴true・completion false・exit 2を確認する。不正／混在は実binでも引数処理で拒否し、子Process要求counterを観測する。これはCLI搬送と既存実Writer・保持／保存後取消試験の共同根拠であり、退避物実体の引渡し・新Task資源不存在・全Filesystem Effect 0を主張しない。

## 修復の九処置Machineに対する限定確認

現在の公開回復入口も、本文不正・元版相関が不一致のpending・未知entry・binding項目破損を、技術回収前に拒否しなければならない。注入直後を基準に拒否直後の領域全文／実体と両Host実体を比較し、同exact ID、cleanup／history／completion非成立、保存・出版入口とHost回収0を個別に確認する。安全なRepository借用や読取りの到達を処置と同一視しない。fixture復元後だけ同じ正常回復へ進み、実WriterとHost回収の正到達をspy結合の肯定対照とする。旧journal／pointer形式の互換性や、正規foreign Repositoryの受理保証はこの確認の対象外である。

Host初期化の生成失敗・同期I/O不明・初期化前後の実Process喪失・rename後successor ID・同bytes別Identity・cached ID拒否は、既存Host記録試験をOwnerとする。Repository-localの明示親へ固定し、PRL-IT-013とERB-IT-003の接続を維持する。既定OS一時領域を選ぶ本番Callerの保証は明示親試験から推定せず、未置換の既定親Caseを保持する。

論理故障確認では、現在本文と私有beforeの両Bufferを、実行結果ではなく故障段階から実modelで再導出した期待全文・改訂・元版Hash・本文Hashへ照合する。同じcleanup値の追加版とcodec合法な元版Hash差も同じOracleで拒否する。正常二形・故障24形の限定確認は独立レビュー残指摘0であり、下記の実Process拒否とは別に論理故障Gateを閉じる。実Writer内部・Kernel／Filesystemの故障成立や実Dockerを証明したものではない。

Host清掃Ownerの故障反応は、実初期Snapshot・実modelと、本番のOwner確認／checkpoint／初期切断判定／不存在確認／Host清掃の五関数を同一realmで評価する。下位Reader／Writer／世代・排他観測／Host返却だけを代役とし、正常二形と段階別故障を分離する。処置前失効はHost0、pending保存後不明は反映済み候補を保持してHost0、清掃要求後不明はHost要求1・confirmed保存0、confirmed保存後不明は既反映候補を保持して追加要求0とする。故障一回・到達・非対象全文・現在本文と私有beforeの差、sticky flagが実際に立った場合だけの反復停止を観測する。削除直前Readerは成功させ、その後のOwner guardだけを省略した一意なメモリ変異がHost0 Oracleを破ることを要求する。これは上位の論理Source境界の反証であり、実Writer／Kernel／Filesystemの内部故障注入や、実Dockerの成立根拠にしない。

初期Taskの清掃二切断は既存`ERB-IT-003 / PRL-IT-013`で、pending保存の三確認後と、物理Host回収後・confirmed Writer本体呼出前を実子Process強制終了に接続する。各子の終端後に親が元Root／markerの実体または両不存在、同exact ID、Home排他再取得、finally非実行、Writer到達数、非対象本文／Host実体保全を観測する。既存resource-cleanup同値保存による改訂更新を含め、実model候補の全文・改訂・元版Hashを要求し、状態名や固定版数だけで代替しない。pending保存前の要求拒否では実Writer本体とHost処置0、清掃済みからのfresh confirmed保存拒否では実Writer本体0・Host再処置0・元版と両不存在維持を確認する。公開operationRetained=nullから保持を推定せず、親がexact対象の現在本文残存を観測する。最後の正常fresh子だけが履歴一回・対象除去を確定する。同呼出し内の清掃後保存故障、Owner・Root失効、読戻し・排他解放不明と清掃故障は上記の論理反証で別に確認し、実Processの部分拒否から推定しない。

修復の現在状態終了は既存`ERB-IT-014`で、同じ本番呼出しの結果保存→履歴確認→退避物なしの対象だけ除去→marker清掃→fresh不存在までを確認する。保存前後・marker削除後の実切断から同IDで再入場し、技術再取得0、対象外操作・回復参照・配送と履歴の全文保全を観測する。履歴行が欠測している場合は再追加せず、終了確認をfalseにして現在操作を保持する。履歴・outcomeの先行確認を、後続の保存・清掃・解放不明で取り消さない。除去済み再確認では技術checkpoint／Native詳細を履歴から復元しない。値候補・物理保存・本番composition・CLI・実Dockerを別の確認範囲として扱う。

公開CLIの既存`PRL-ST-001`関連試験では、実parserとdoctor分岐が現行の修復／保持／再起動／Task回復と通常doctorをそれぞれのcompositionへ渡すことを確認する。旧close／adopt／after-repairと署名Root引数は、旧仕様で合法だった完全形と順序違いもUsage拒否し、Root・Writer・Process処置0を確認する。分類を無効化する変異を同じ呼出し列Oracleが拒否する。新規取消の下位signal搬送とEffect前停止、取消済みexact metadata再確認の成功を分け、解除失敗で一次理由を上書きしない。公開結果は終了済み・保持済み・保持判断待ち・停止の共同fieldとexitCode、getter／Proxy拒否・内部値非公開を確認する。この限定配線試験を実Dockerの修復・全体E2E成立へ昇格しない。

固定本番組立てでは、入力／開始前取消／fresh拒否時の全下位観測0、配布Root・Artifact捕捉一回、同descriptor→Native→同SHA→Scope、同Session／H／nonce／KnownFolder／内部signalの搬送順を照合する。KnownFolder欠測／例外、factory拒否、Artifact／Scope不一致、準備中取消／許可喪失は準備通知・Machine・技術Effect0と同子abort／joinを確認する。実Operations→実Machineの既存正常／継続回数Oracleへ接続し、nonce差替えと準備Artifact検査省略のメモリ変異を拒否する。import境界を差替えた組立て試験だけを実Native一体確認または真正Writer／CLI完成とは扱わない。

上位修復Ownerでは、Identity→初checkpoint保存を実Root・Kernel排他・Writerの二版で観測し、同exact再入場、Scope差、pending拒否と返却後の保存0を確認する。Identity・初checkpoint・join後cleanup・outcomeの各保存へ拒否／確認不明／解放不明／例外を注入し、注入到達と後続要求0、保存段階別の返却field、既知本文の保持を確認する。cleanupと不可逆primaryは同版、outcomeは次版である。技術完了後の外部取消、後着Native故障、取消とNative喪失の両順序、回収不明・protocol失敗、既存primary、未承認保持物、incompleteを区別する。メモリ境界の実Source／DI／保存model試験と、実物理Writer試験の根拠を分離し、CLI接続・履歴・終了整理・実Docker成功へ拡張しない。

実技術接続では、`repair-operations`と実Machine・実Runtimeを通し、通常起動と初回timeout後の継続について同じNative子・三対象の実体・発行回数・保存順序を確認する。固定Repair06の公式停止能力不存在だけを明示不要とし、Nativeの未発行不明／部分発行／結果不明を不要へ丸めない。片側lock不明、新旧同世代、旧退避差、意図保存後Artifact／Scope／許可喪失、発行後取消、待機中取消と観測cleanup不明を反証する。Engine待機の購読は終了後0。最下位境界を模擬するこの試験は、実Directory factoryのFilesystem試験、実Native protocol試験、既存180秒待機の期限試験と組み合わせるが、真正上位Owner／Writerや実Docker修復の成立は別に確認する。

`ERB-IT-014`では、初回timeout＋限定継続値が成立した場合だけ両世代の固定観測へ到達し、failed／auxiliaryの同一候補保存→停止意図→発行の順序を確認する。片側欠測・alias・primary変更・engine変更・通常観測での暗黙固定・保存拒否・観測／保存後取消またはOwner喪失では追加Effect0とする。観測省略・保存省略のメモリ変異を同じ肯定Oracleで拒否する。保存済み両世代と追加四処置の確定後5切断点から同exactで新Sessionへ再入場し、残る接尾処置だけを一度実行する。再起動確定済みはHost処置0、未ready時だけ継続待機、既ready時は待機0とする。待機ready後のProcess・run・保持実体・Engine・Artifact・Scope・現在許可を再照合し、欠測・不明・差替え・取消ではreadyを確定しない。新run二回観測のIdentity比較省略変異も同じ拒否Oracleで検出する。これは内部接続の根拠であり、真正上位Writer／CLI・実Dockerの成立と混同しない。

準備返却時点の観測cleanup不明は、通常返却・返却直前取消の双方で準備通知／Machine／保存通知／Effect0、同子abort1・release0、理由保持、checkpoint null・最終保存falseを確認する。Reader捕捉を準備拒否判定後へ移すメモリ変異を同Oracleで拒否し、準備中の不明を取消で消さない。

Engine観測はRuntime・明示構成付き修復・内部no-config Desktop修復の三用途を固定要求・環境・出所前後・容量・期限・pipe回収まで照合する。観測回収不明の集約は、既保存理由優先、観測cleanup、Native cleanup／protocolの固定順位とunknownのORを確認する。発行前と発行後の不明、Native回収の成功／protocol失敗／cleanup不明を組み合わせ、一次Effect失敗の保全、不明後の通知最大1回、同子abort／join、最終候補未保存、fresh取得0を反証する。上位現在状態も同じ追加理由を保存し、cleanup成功主張を拒否する。実Adapterが観測不明を検出し停止する処理はDI内部固定wrapperへ接続済みで、最下位を模擬する接続試験と各技術境界の個別根拠で確認した。真正上位Owner／Writer／CLIと実Docker E2Eの成立は未確認である。

段階付きEngine待機は、初回起動後と継続再起動後を現在checkpoint付きで呼ぶことを確認する。元のstartup_timeoutと非永続の継続可否を分け、transientをknownへ偽装しない。非timeout＋継続値、初回起動または元退避未確認、継続再起動後の継続値では追加発行・回復成功を認めない。Directory固定操作は同じScopeから導いた三対象の全要求、三用途の実rename一回、先既存の初回／継続分類差、Scope差後のrename0を模擬Filesystemで観測する。実Adapterの両lock・Process・Engine・世代全条件と停止後静止確認はDI内部固定wrapperへ接続済みで、最下位を模擬する接続試験と各技術境界の個別根拠で確認した。部分継続の独立確認、真正上位Owner／Writer／CLI、実Docker E2Eは未完了である。

三用途のlock肯定観測は、既知open拒否、同対象のentry前後2回・実体前後2回、open1・変更0と、factoryが返す期待Identityを共同確認する。下位観測を実行した後に結果をnullへ捨てるメモリ変異を、同じIdentity返却Oracleで拒否する。

準備と実Machineの内部接続では、初回の全処置・実体が未観測であること、cleanなfreshだけcleanupをpendingへ進めること、取得前拒否、実H／Scope差、準備・保存確認中の取消／Native喪失、厳密true以外の通知拒否を確認する。拒否後Machineの観測・保存通知0、取得済み同子abort1とjoin、成功時の全通知が実validatorを通ることを観測する。最終cleanup候補は未保存、最後の通知値はpendingのままを個別に断言する。模擬Scope／技術境界と実Machineの接続から、真正H／Scope・実Adapter・上位Root／Revision／Writer・CLI成立を推定しない。

肯定対照では通常一slotをproceedとして模擬execute confirmed 1へ搬送し、意図・発行・確認の三段保存列を実validatorで確認する。全不要化した技術境界と準備通知二重化のメモリ変異を同Oracleで拒否する。準備後の処置許可単独喪失では、prepared事実・保存済みpending・Machine／Effect0・abort1・join後の未保存cleanup候補を相関して確認する。拒否通知は通常関数1、async／関数Proxyの本体0を必須断言する。

Native生涯の内部所有も`ERB-IT-014`で確認する。開始前取消は取得0、取得待ち取消では遅れて取得した同じ子のabort完了まで返却しない。取消とNative喪失は最初の停止理由を保持し、後着通知・回収結果で上書きしない。正常release／失敗・取消・明示abortを個別回数で断言し、合法なcleanup unknown・protocol failedと一次値の分離を確認する。購読登録・解除と終了後の内部signal不変を観測し、終了gateを無効化するメモリ変異を同Oracleで拒否する。これは模擬Nativeの局所検証で、Scope・準備保存・実Machine／Adapter・CLI結合と実修復は未成立である。

Scope準備も`ERB-IT-014`で確認する。固定domain／実UTF-8 byte長／field順を独立期待値へ照合し、文字数を使ったメモリ変異を拒否する。nonce／H／Artifact／Local Path・実体の各単独差、canonical Pathのcase・prefix、Local親の差替え・link・file・観測不能、不正値・Proxy／getterを反証する。Filesystem読取りはLocal親だけで、可変Docker親不存在がScopeを不成立にしないことを確認する。32桁Directory IDの決定性・nonce差と、同じ凍結targetsの固定basename／同親を照合する。合成Scopeの成功から実H・KnownFolderの真正性、同じNative Session、実Adapter接続や実修復を推定しない。

保存故障のCaseは、対象slot・意図／発行／結果段階・注入一回と到達位置を必ず断言する。注入未到達時にOracleを省略しない。issued通知を省略する本番本文のメモリ変異を同じ到達Oracleで拒否する。不正なEffect観測（復号失敗、action／cleanup変更、実体遷移違反、例外）では、保存Owner生存時だけunknown通知1、喪失時0を確認し、最後の耐久元版からの合法遷移と一次失敗を保持する。初期Engine readyでも通常五処置の前提を省略せず、初回起動後readyならHost安全性未確認でも追加四処置を発行しない。後者の回復成功はHost安全性の確認まで主張しない。

`ERB-IT-014`へ、DI内部Machineの通常五処置・起動失敗後追加四処置、各slotの意図／発行／結果保存の拒否と例外、意図直後・発行直後の取消、保存Owner喪失、fresh呼出しの三切断窓を接続する。freshの保存済み意図・未確定発行・unknownでは観測・通知・再発行が0であることを個別counterで確認する。同期true以外、Promise／thenable／関数Proxyは許可せず、then getter・Proxy applyの実行0を確認する。不要・未発行失敗・発行不明を区別し、Engineの五分類から追加処置の可否を反証する。全通知を実技術validatorへ通し、発行後保存失敗は最後の耐久元版から合法なunknownとして返す。これは合成技術境界の順序検査であり、実Native取得・join、実Writer、CLI本番接続、修復完了や旧実装置換の根拠にはしない。

## 現在Host記録の所在解決に対する限定確認

履歴の物理接続では、`ERB-IT-014`にcheckpoint前後、history rename前後、confirmed保存前後の六故障点からの別Process再入場を接続する。正常・結果欠測と従来Host清掃A／B／Cも維持する。通常Readerは短命材料を拒否し、専用Readerだけが元版・固定候補全文・行Hash・File実体・設定を照合する。改変したpending／canonical履歴、余分File、保持設定差は処置0で拒否し、元本文を保持する。Host出版と履歴出版のmarker取り違え、同Owner失敗後再発行、時刻再採番、行重複、他操作変更、残存短命物を反証する。旧live結果を合成せず、履歴確認から配送成立を推定しない。

公開Consumerの再入場では、準備が受理した履歴出版途中を退役確認が通常Readerで自己拒否しないことも同項目で確認する。通常Readerの解放確認付き拒否・Host両不存在・Host清掃出版なし・completionなしだけでCurrent History Readerへ一回接続し、元版全文・exact ID・fresh Ownerと既退役を要求する。専用読取りの拒否／値欠測／本文差／解放不明／例外、読取り後Owner喪失、未退役、Host残存、別出版では処置0とする。実保存途中から同IDの正式Consumerで履歴一件・元失敗／実行事実／結果保全・対象だけ除去・短命物不存在を確認し、内部Readerの成功だけで公開再入場成立とはしない。

配送登録の同項目では、保存済み利用側によりOrchestratorだけexact一件を登録し、CLI／Workbenchの登録書込み0と操作保持を確認する。登録pending前後・marker回収前の故障から別Processで再開し、結果ID・元結果・一次失敗・履歴・非対象操作不変と短命物0を観測する。登録前の結果参照拒否、登録後のexact参照、同一登録再入場のWriter0、偽Owner・Host再出現・未解放・保存失敗／例外／排他不明後の同Owner再発行0を反証する。登録だけを耐久ACK・操作整理・利用者への返却成功・全体完成と扱わない。

現在Root専用の技術回収組立ても`ERB-IT-014`で確認する。開始前取消・不正入力、準備拒否、各下位停止／例外、解放false／例外、段階間の六つの取消点、既Host不存在・Host出版途中を反証し、取得後解放一回・失敗後の次段0・元理由と解放理由の独立保持を観測する。実Host／Kernel排他・Writerを使う未要求資源の肯定経路で、同じ結果・一次失敗・非対象操作・履歴を保持し再入場の追加保存0を確認する。この模擬／実Host境界は、実Docker要求中の取消や本番CLI／Workbench返却の証明ではない。

組立ての取消入力にはProxy trap 0を含める。準備／各Writerの観測済み解放不明と例外を分離し、保存確認済みの履歴・配送事実を後続失敗で消さないことを全返却fieldとexact呼出し列で照合する。実Host再入場ではstate／history／pending／lockに加えて、初回前にexact操作へ結合したHost root／markerへの書込み・再作成・削除も0とする。同本文の再保存とsynthetic marker再作成・削除の正対照で観測器の検出を確認し、実再入場前に正対照を清掃して観測列を消去する。

保存markerだけの限定清掃も既存`ERB-IT-014`で確認する。通常出版直後と終了操作除去後、marker不存在、初回current不存在、不正current／foreign・改変marker、link／hardlink、pending／未知File、同bytes別実体、取得false／throw、実unlink後throw、解放false／throwを分ける。marker不存在は書込み0、処置対象はexact Repo markerだけ、state／history・非対象操作保全を観測する。処置・保全・排他の確認からTask完了・受領・Docker資源回収を推定しない。32形の固定primitive反証と実Repository／Kernelを含む2試験が成功し、両独立最終再確認の残指摘0をもって保存marker限定清掃だけを局所Passと評価する。この局所結果はTask／ACK／Docker／AuthorityやLocal Item全体の成立証明ではない。

現在回収の履歴値契約は、固定時刻の維持、初回候補・exact pending・canonical行ありの再導出、同ID異内容・重複・余分行・欠落・不正本文の拒否、保持設定変更によるpending全文差の拒否を既存`PRL-UT-006`と関連`ERB-IT-014`へ接続する。純粋関数の成功は候補の一致だけを表し、実出版・保存読戻し・fresh Process再入場の証明ではない。`ERB-IT-014`では、この候補をRoot／File実体・元版・現在Ownerへ結合するReader／Writerと、保存途中各段の故障注入を別に確認する。

終了保存の追加反証では、解放直後の実Root再出現による拒否、除去後のfresh exact Owner再入場、Writer確認途中のRoot／marker present・unknown・観測例外を確認する。再起動checkpointは要求4値×清掃4値×結果3値を照合し、記録なし・再起動不要・結果確定済みの閉集合以外は候補生成／物理Writer 0とする。`confirmed / confirmed / result=null`の拒否を外す変異が誤成功することを検出し、元結果・一次失敗と再起動記録の保持を確認する。

同じ`ERB-IT-014`で、公開再起動組立ての現在checkpoint確定から、別Processの通常CLI回収へ接続する。DI再起動だけを代役にし、実Root／Host／Kernel排他／Writerを使う。発行前保存、受付通知、終端通知、全解放後確定を実modelの全文・改訂・元版Hashへ照合し、同一要求の二度目は下位到達0・保存本文不変とする。子の終了だけを排他解放の根拠にせず全Scopeを再取得・解放する。旧after flagを使わない実CLIが同じIDで履歴一件・対象除去・Host両不存在まで完了し、元一次失敗と結果、兄弟操作・Host実体／本文を保全することを確認する。このCase単独では、auth作成unknownの限定終了、実Native再起動、旧経路全体の置換を証明しない。後続auth接続と既存資源回収の共同根拠による専用入口の退役判断は後述する。

後続のauth作成unknown接続も同項目へ置く。親が実resource Writerでauthだけ`intent_saved→unknown`を保存し、他四資源未要求・未実行・Owner退役・workspace再利用禁止を保つ。再起動結果だけを代役にした現在checkpointの確定後、別Processが固定Process spyを登録してから旧flagなしの実binを実行する。実DIの発見二要求はnull、名／名＋Labelの二系統×二roundは明示不存在とし、全六読取りのexact argv・全消費、専用config実体／空性／清掃、再起動0・削除0を分離観測する。専用Writerの実委譲一回と返却三確認、直後の実Reader・本文全文を照合し、authの`unknown/null/null`を維持したまま専用absenceだけを保存する。以後の実Host／履歴／終了まで到達し、元失敗・結果と兄弟操作／Host実体を保持する。履歴は既存の最小要約契約を用い、資源配列を新設しない。未確定再起動・各round不明・専用Writer故障は既存反証と共同確認する。このCase単独の接続は模擬Docker観測の本番組立てであり、実Daemon停止・遅延create無害化・実Docker不存在・汎用unknown終了・旧経路全体の置換は証明しない。

`ERB-IT-014`の通常回収終端では、同じOwnerの全排他を逆順に解放し、false・例外・過去不明では終端Writerを発行しないことを確認する。五資源の既知終了、Host両不存在・清掃confirmed、遷移解消、旧Effect無効と元版一致が揃った場合だけ、既存結果のstatus／reasonを保持し清掃確認を更新する。結果欠測は既存の`blocked / docker_process_controller_execution_failed_closed`へ固定し、一次失敗はnullを含め保持する。成功・取消への変換、一次診断の合成、同Owner再保存、未解放での保存、unknown資源の終端化を反証する。実Host／Kernel／状態Writerで全文・改訂・他操作保全と短命材料不存在を観測し、模擬本文試験は前提拒否と一回性の確認として区別する。終了保存後のsettlingを履歴・配送完成とみなさず、Orchestratorの耐久ACKとCLI／Workbenchの用途別返却は別に確認する。

fresh回収Ownerと途中Writerの局所確認は`ERB-IT-003`／`ERB-IT-014`へ接続する。実現在状態と既存排他で、稼働Host／Homeの拒否、元Owner失効後のexact取得、対象だけの保存・全他操作保全、コピー・別種Owner・二度目使用拒否、解放後の同参照再取得を確認する。部分取得・marker差・保持失効・元本文競合・保存解放不明は実準備本文の故障注入で全逆順解放と追加Writer停止を反証する。排他取得が不明な場合は回収確認trueへ畳まない。途中OwnerでHost清掃確認、Lease解放や新しい完了結果を保存できないことを拒否例とする。これらはmarker存続中の接続だけであり、DI実回収、marker削除後の真正終端、fresh回復全体とE2Eを成立済みとしない。

`ERB-IT-003`では、元Ownerまたは現在Repositoryの単一操作が保持するexact RootをHost／Probe Readerへ渡すことを確認する。tokenだけのOS tmp探索は行わない。実CLI・現在Schemaの二操作・実Reader／既存Kernel排他で、単一Host／Probeの搬送、0件・複数・旧token・別Repository・非Probeの処置0を反証する。処置境界はspyとし、実Docker清掃と区別する。読取り欠測・解放不明・例外は実private本文の局所故障注入でnull拒否を確認し、その成功を実Kernel終了の根拠にしない。Host記録専用試験は、Root削除後の同親marker読取り、Hash／Root名差・link拒否、実Owner保持中の回復拒否とOwner終了後のHost領域不存在を別に確認する。Local Item全体のPassへ昇格せず、fresh Recovery Writerと実Docker回収は未確認として残す。

旧記録後専用入口の退役は`ERB-IT-014`とCLI契約の`PRL-IT-012`へ接続する。旧flagは実parser／binで`doctor_arguments_invalid`・exit 64となり、同期Process要求0とRoot解決・回収・修復の分岐前での拒否順を確認する。全Process APIや全Filesystem Effectの一般的な不存在証明へ拡張しない。現在の通常入口・exact ID・元失敗／兄弟保全は既存CLI二形、identified／unknownと発見ID保存後処置は現在資源回収・実Writerの既存対照を共同根拠とする。旧chain本文VM一件を退役するが、旧形式専用Caseは対応する旧APIとともに退役し、現在の開始／終了Capability・入力拒否は残す。実再ログオン・実Daemon・初期publication等は未確認Gateとして保持し、旧Case撤去をその成立へ換算しない。旧入口退役時点では配布検査の当該Consumerだけを外していたが、後続の専用署名方式退役により残る本番Manifest Gateも撤去した。v0.21比較と正式配布の歴史記録は維持し、現在の実行Gateへ戻さない。通常五入口と回収Sourceへの旧専用API再導入を反証する。

## 移管前の署名版回復Oracle（比較専用・現在実行禁止）

以下は変更前の検証設計の比較記録であり、現在の期待結果ではない。旧記録のRuntime採用、旧Reader、adoption、Release chainへの追記を新設しない。現在の検証は各Local Itemの現在Schema・fresh観測・元exact ID・一次Effect再発行0・unknown保持へ接続する。過去正式Evidenceは変更しない。

```text
| `ERB-ST-009` | 回復 | ST | Docker Repair／Recovery | 修復Identity→既知Runtime領域の段階退避→Docker restart→Engine readiness | System/E2E | exact Repair ID、`Docker/run`と`docker-secrets-engine`の既知2領域、停止中またはハングしたDocker、初回起動失敗、Engine readiness Observer、単一Probe Timeout、全体起動期限、署名版更新 | 同じRepair IDで各領域を順序付きに退避し、再起動・確認を継続する。初回起動が期限超過し、既知2領域のlockとProcess集合を確認できる場合は、単一Probe Timeoutを停止済みと誤認せず、同じInvocation内でContinuationへ移る | Repair ID、領域別Identity、各Effectの意図と結果、再起動試行、Engine readiness、継続Gateの条件別理由、同一実行内で計測できた起動所要時間の参考値、再入場回数を記録する | 未完了Effectを再発行せず、個別socketを削除しない。期限満了後に既知2領域のexact lockとProcess集合が揃う場合は、Process停止を一回だけ行い、その後にEngine既知停止とProcess不在をfresh確認してから段階修復する。2領域の退避と新世代確認が揃いEngine readyになった後だけ完了する | ERB-ST-009、Repair ID、領域別Identity Hash、追記記録chain、Effect確認、Engine readiness、継続Gateの条件別理由、起動所要時間または未計測、同一Invocation継続または再入場の結果、残る回復義務を保存する | native helper残存0。停止後もEngineまたはProcessが未確認、部分退避、観測不能、intent後中断では自動継続せず同じRepair IDの回復義務を保持する | Hybrid |
| `ERB-ST-011` | 回復 | ST | Docker Session Handoff／Recovery | repair・restart→handoff chain→別Session／Runtime→closure | System/E2E | repair／restart／handoff Identity、Source／Destination Session Identity、Runtime Execution Identity、origin・adoption・tip・closure、Host資源観測、引継ぎ前Sessionが作成したContinuationと、同一SessionでのRelease更新、別Session混入・Identity不一致・循環・分岐・番号飛び・上限超過・記録欠落・chain外Continuation・現在境界未結合・旧Effect再発行要求 | 正常chain、同一SessionのRelease更新と各反例で別Runtimeへの継続を要求し、旧Continuationを現在Releaseから読取り・追記する | chain全要素と順序、各Identity、現在の検証済み実行境界、Continuationの発行元と追記元、Effect件数、Engine／Host資源、exact回復義務、拒否理由を記録する | 正常時だけ検証済みchain内の旧Continuationを受理し、同一Sessionの更新では検証済み現在Releaseを末尾Authorityとして次段階を追記する。不正chain、chain外tuple、現在境界未結合はEffect 0、旧Host Effectを再発行せず、不明時は同じIdentityで回復義務を保持する | ERB-ST-011、chain、Continuation Identity、現在Release、追記境界、Effect件数、Engine／Host状態、回復義務、拒否理由、Oracleを保存する | 不正・不明時Host Effect 0。正常完了時は旧Session所有資源0 | Hybrid |
| 6. 版更新・再入場 | 旧署名の原記録を変更せず、現在Releaseへexactに結合した追記記録で同じRepair IDを継続し、回復済み表示とcloseの両方で全記録を再検証する | 旧記録の上書き、別Release記録の受理、改変・部分記録でのclose、現在Authorityへの流用、intent済みEffectの二重発行 |
各段階の局所試験がPassしても次段階の成立を推定しない。局所契約試験では、最初のEffect前からDockerが稼働している場合、一領域退避後にDockerが再出現する場合、Secrets Engineの新世代が欠ける場合、旧stale Evidenceが不存在・元Operationとexact一致・別Identity・観測不能である場合、追記記録が改変・部分成立・別Release結合である場合も反証する。現行署名版が新規作成した修復と旧署名版から採用した修復の双方について、初回起動失敗後に同じRepair IDの段階処置へ入ることを局所契約試験で確認する。実機STでは、初回起動失敗から版更新、2領域退避、一回の再起動、終了後観測、保持済み旧stale Evidenceを削除しない明示close、新しいRepair IDによる現世代修復および再入場までを一つのlifecycleとして確認する。
| `ERB-IT-012` | 回復 | IT | Docker Repair Handoff | Coordinator→Repair Record→Platform Adapter | Related 2 Blocks | exact Repair Identity、旧Effect記録、署名検証済みorigin／adoption／handoff chain、同一Sessionで更新した現在Release、旧Continuation、fresh観測、手組みOperation、chain外tuple、現在境界未結合、別Session反例 | Record Storeが検証したchainと現在実行境界から旧Continuationの発行元を導出し、既存Repairを現在境界で継続可能なPlatform要求へ変換する | Repair Identity、Authority順序、同一SessionでのRelease更新、Continuationの発行元と追記元、fresh状態、Effect要求、拒否理由を記録する | Record Storeの検証結果だけをAuthorityとし、同一SessionのRelease更新では検証済み現在境界を末尾Authorityに加える。旧Effectを再発行せず同じRepair義務を現在境界から追記し、手組み・chain外・未結合はEffect 0で拒否する | Identity、chain、現在Release、Continuation sequence、追記tuple、状態、要求、Effect件数、判定 | 重複Effect 0、別Repair 0、未検証Authority 0 | Automated |
```

検証Toolとして登録する三script（`verify-native-protection.ts`、`verify-native-terminal-namespace.ts`、`verify-native-terminal-fixtures.ts`）と判定部品`native-terminal-oracles.ts`の局所保全は、既存`ERB-IT-001`／002／003の対応断面だけを扱う。検証Toolへの試験関係は本番Sourceの実装関係・意味Coverageへ加算せず、局所試験の成功を実Native／OS／Task／Dockerの成立やLocal Item全体の正式Passへ換算しない。元の実境界検証義務は維持する。

## 1. 情報源と網羅条件

| Source ID | Obligation Key | 導出元 | 保持する固有条件 | 試験段階 | 対応Local Item |
|---|---|---|---|---|
| [REQ-000002](../../../01_Discovery/Definitions/REQ-000002/requirement.md) | `req-000002.qa-000006` | Requirement Definition（成立条件・失敗・検証意図） | 外部作用（Effect）の前に範囲、送信許可、実行者と確認者が確定する。成功、失敗、取消の各終了経路で候補、プロセス、Docker等の資源状態を追跡できる。残存資源または回復義務を正常終了へ畳まず同じ実行識別情報で再入場できる。正常完了、外部送信拒否、実行途中取消、確認失敗、清掃不能を通し、各段階の決定権限、結果、残存、回復対象の識別情報を観測する | IT | `ERB-IT-004`、`ERB-IT-003` |
| [REQ-000005](../../../01_Discovery/Definitions/REQ-000005/requirement.md) | `req-000005.qa-000006` | Requirement Definition（成立条件・失敗・検証意図） | プロジェクト管理、実行編成、通信方式、観測、Platform境界の責任者を一意に説明できる。仕事管理から実行編成への依存は公開入口に限定し、下位から上位の実装への逆依存を持たない。各部品の公開入口以外を利用側が参照せず、単独利用時の契約を確認できる。依存Graph、公開import、package単独試験、代表利用側を確認し、内部パス参照や逆向き依存を反証する | IT／ST | `ERB-IT-001`、`ERB-ST-005` |
| [REQ-000016](../../../01_Discovery/Definitions/REQ-000016/requirement.md) | `req-000016.qa-000006` | Requirement Definition（成立条件・失敗・検証意図） | モデル、設定内容、役割割当、CLI配置をSchemaと接続部対応で検証する。登録、Host可用、認証、処理許可を別々に判定する。構成変更後も既存接続部の起動、取消、結果意味が変わらない。既存モデル追加、設定内容変更、CLI移動、未知モデル、Host不可、認証不足を与え、外部変更の前の選択と拒否を観測する | IT | `ERB-IT-001`、`ERB-IT-004`、`ERB-IT-006` |
| [REQ-000023](../../../01_Discovery/Definitions/REQ-000023/requirement.md) | `req-000023.qa-000006` | Requirement Definition（成立条件・失敗・検証意図） | 新実行基盤と既存接続部の認証、起動、取消、結果、回復Semanticsを比較する。差がある場合は設定Aliasでなく専用接続部と機能 契約を持つ。実環境で開始から終了後清掃までを段階的に検証する。既存接続部互換と非互換実行基盤を用意し、構成受理、接続部選択、取消、結果、回復、清掃を観測する | IT／ST | `ERB-ST-005`、`ERB-IT-001` |
| [REQ-000030](../../../01_Discovery/Definitions/REQ-000030/requirement.md) | `req-000030.qa-000006` | Requirement Definition（成立条件・失敗・検証意図） | 各試験段階の責務と重複しない完成主張を定義する。外部境界は正常系から取消、清掃、回復まで実環境で観測する。変更意味から成立済み機能と回帰対象を選び、最終E2Eを最初の結合にしない。局所、外部単体、一連の状態変化、隣接1～2 Block、公開入口の順に故障を注入し、発見段階と診断可能性を観測する | IT | `ERB-IT-004`、`ERB-IT-002` |
| [UX-000008](../../../02_UX/Definitions/UX-000008/ux_definition.md) | `ux-000008.qa-000006` | UX Definition（利用者成果・重要場面・重要な失敗） | AI実行環境の認証・起動・取消・結果取得・回復のどこに違いがあり、故障時に何が利用可能かを理解できる。重要場面「一つの失敗を全体障害と判断する直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。認証・起動・取消・結果取得・回復の違いを同じ失敗へ畳む表示と、利用可能な機能まで停止する判断を反証する | IT／ST／UAT | `ERB-IT-001`、`ERB-ST-005`、`ERB-UAT-007` |
| [UX-000018](../../../02_UX/Definitions/UX-000018/ux_definition.md) | `ux-000018.qa-000006` | UX Definition（利用者成果・重要場面・重要な失敗） | 新しいモデルへ追随するとき、コード改修を待たず検証済み構成を更新し、実効選択と再選定理由を理解できる。重要場面「AI提供元で実行する前のモデル確定」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。未知設定の黙示代替、非対応モデルの実行可能表示および無説明選択を反証する | IT／ST／UAT | `ERB-ST-005`、`ERB-IT-004`、`ERB-IT-006`、`ERB-UAT-007` |
| [IA-000003](../../../03_IA/Definitions/IA-000003/ia_definition.md) | `ia-000003.qa-000006` | IA Definition（情報・関係・状態・見つけ方） | 失敗後に再接続、再試行、回復、清掃を取り違えず、二重作用を避ける。UX-000003: 開始可能（ready）／実行中（running）／入力・判断待ち（waiting）／停止（blocked）／完了（completed）／失敗（failed）。UX-000004: 失敗後の作用なし／作用済み／不明、回復要／不要。UX-000021: 進行中（active）／切断（disconnected）／結果取得可能（result_available）／回復必要（recovery_required）／確定済み（settled）。UX-000022: 存在（present）／不存在（absent）／不明（unknown）、回復可能（recoverable）／清掃可能（cleanup_eligible） | IT | `ERB-IT-004`、`ERB-IT-001`、`ERB-IT-002` |
| [IA-000013](../../../03_IA/Definitions/IA-000013/ia_definition.md) | `ia-000013.qa-000006` | IA Definition（情報・関係・状態・見つけ方） | コード改修なしに検証済み構成を更新し、実効選択と理由を理解する。UX-000018: 有効（valid）／無効（invalid）／利用可能（available）／利用不能（unavailable）／選択済み（selected） | IT／ST | `ERB-IT-004`、`ERB-ST-005`、`ERB-IT-006` |
| [IA-000020](../../../03_IA/Definitions/IA-000020/ia_definition.md) | `ia-000020.qa-000006` | IA Definition（情報・関係・状態・見つけ方） | 実行基盤の一部が故障したとき、故障した境界と影響を受ける能力を見分け、利用できる範囲まで一律に停止しない。UX-000008: 各境界の利用可能（available）／停止（blocked）／不明（unknown）。全体停止と分ける | IT | `ERB-IT-004`、`ERB-IT-002` |
| [UI-000005](../../../04_UI/Definitions/UI-000005/ui_definition.md) | `ui-000005.qa-000006` | UI Definition（認識・操作・Feedback・失敗表示） | 実際に起きたことと故障箇所を根拠から切り分けられる。UX-000006: 実行事実を出所と観測時点付きで比較する: 記録済み／未記録／記録結果不明を含む実行事実の取得: 出所・時点・観測状態と記録状態を保持する: 未観測や記録結果不明を0、正常または未記録へ畳む。UX-000008: 故障した境界と影響する能力を特定する: 一つの失敗を全体障害と判断する直前: 失敗した場所・影響範囲・利用可能性を分ける: 一律の失敗表示で無関係な能力まで停止する。UX-000006／IA-000004: 記録済み（recorded）／未記録（not_recorded）／記録結果不明（unknown）、観測済み（observed）／未観測（not_observed）／不明（unknown）。評価は事実と別: 実行→記録状態→観測→根拠→評価→改善候補。UX-000008／IA-000020: 各境界の利用可能（available）／停止（blocked）／不明（unknown）。全体停止と分ける: 故障→境界→影響する能力→継続可能範囲→回復 | IT／ST | `ERB-IT-004`、`ERB-ST-005` |
| [UI-000010](../../../04_UI/Definitions/UI-000010/ui_definition.md) | `ui-000010.qa-000006` | UI Definition（認識・操作・Feedback・失敗表示） | 仕事に合うToolとAIモデルを根拠付きで選び、安全に変更できる。UX-000016: 固定Commitに対応するツール／実行基盤と利用可能性を知る: 発見したツール／実行基盤を起動する直前: Commit・配布集合・Manifest・実行基盤の対応を検証する: 版不一致・欠落実行基盤・改ざんManifestを対応版と誤認する。UX-000018: AIモデル選択を検証可能な構成として更新する: AI提供元で実行する前のモデル確定: 構成変更を検証し実効選択を観測可能にする: 未知または非対応のモデルを実行可能と表示する。UX-000016／IA-000011: 利用可能（available）／利用不能（unavailable）／未確認（unverified）／停止（blocked）: 仕事→必要能力→登録Tool→配布根拠→起動。UX-000018／IA-000013: 有効（valid）／無効（invalid）／利用可能（available）／利用不能（unavailable）／選択済み（selected）: 設定→検証→利用可能候補→選択→理由・再選定条件 | IT | `ERB-IT-004`、`ERB-IT-001`、`ERB-IT-006` |
| [SPEC-000009](../../../05_SPEC/Definitions/SPEC-000009/spec_definition.md) | `spec-000009.qa-000006` | SPEC Definition（正常・境界・失敗・観測不能・副作用） | 正常: 原因未確定と確定済みを分け、Providerごとの差を保持する。境界: 診断対象内／対象外、原因確定／未確定を分け、診断から修復Effectを発行しない。失敗: 一つの失敗から全機能停止や原因を断定しない。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「許可された小規模Probeだけを実行し、Provider仕事や修復Effectを発行しない」と矛盾する結果を返さない。失敗: 一つの失敗から全機能停止や原因を断定しない。副作用: 許可された小規模Probeだけを実行し、Provider仕事や修復Effectを発行しない。本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す | IT／ST | `ERB-IT-004`、`ERB-ST-005` |
| [SPEC-000015](../../../05_SPEC/Definitions/SPEC-000015/spec_definition.md) | `spec-000015.qa-000006` | SPEC Definition（正常・境界・失敗・観測不能・副作用） | 正常: コード変更なしで構成を更新でき、選択理由と適用範囲を確認できる。境界: 許可値／未知値、利用可能／利用不能を分け、不正構成を暗黙fallbackしない。失敗: 未知モデルや不正構成を暗黙fallbackせず、構成変更を実行許可にしない。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「採用時だけ構成を保存する。選択はProvider実行Effectを発行しない」と矛盾する結果を返さない。失敗: 未知モデルや不正構成を暗黙fallbackせず、構成変更を実行許可にしない。副作用: 採用時だけ構成を保存する。選択はProvider実行Effectを発行しない。本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す | IT／ST | `ERB-IT-004`、`ERB-ST-005`、`ERB-IT-006` |
| [ARCH-000008](../../../06_Architecture/Definitions/ARCH-000008/architecture_definition.md) | `arch-000008.qa-000006` | Architecture Definition（責務・境界・状態・故障） | 境界ごとのavailable／blocked／unknownと相関IDを返し、診断成功をTask成功へ読み替えない。観測手段に許可された最小Probeだけを使う。所有する責務: 外部境界ごとの到達、受理、開始、結果搬送、終了状態の観測。所有しない責務: Provider Task、Docker修復、再起動、結果採用。主な外部境界: OS Process、Docker、Network、外部CLI。SPEC-000009: 一つの失敗から全機能停止や原因を断定しない。Effect: 許可された小規模Probeだけを実行し、Provider仕事や修復Effectを発行しない。入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める | UT／IT／ST | `ERB-UT-038`、`ERB-IT-004`、`ERB-IT-001`、`ERB-ST-005`、`ERB-UT-034`、`ERB-UT-035`、`ERB-UT-036`、`ERB-UT-037`、`ERB-UT-039` |
| [ARCH-000010](../../../06_Architecture/Definitions/ARCH-000010/architecture_definition.md) | `arch-000010.qa-000006` | Architecture Definition（責務・境界・状態・故障） | Toolのavailable／unavailable／unverified／blockedと、モデル構成のvalid／invalid／selectedを分ける。コード埋込みのモデル一覧ではなく検証済み外部構成から選ぶ。所有する責務: Repositoryに適合するTool能力の発見、AIモデル構成の検証・選択理由。所有しない責務: Tool実行、Provider利用可能性の捏造、Repository Binding。主な外部境界: Repository設定、Tool Package、Provider Preflight。SPEC-000014: Tool一覧の閲覧だけで実行Authorityを発行しない。Effect: 読取り専用で候補を返し、Toolまたは配布物を実行・変更しない。SPEC-000015: 未知モデルや不正構成を暗黙fallbackせず、構成変更を実行許可にしない。Effect: 採用時だけ構成を保存する。選択はProvider実行Effectを発行しない。入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める | UT／IT／ST | `ERB-UT-016`、`ERB-IT-017`、`ERB-IT-004`、`ERB-ST-005`、`ERB-IT-003`、`ERB-IT-006`、`ERB-UT-033` |
| [ARCH-000004](../../../06_Architecture/Definitions/ARCH-000004/architecture_definition.md) | `arch-000004.qa-000006` | Architecture Definition／詳細設計（Provider結果境界） | Provider固有出力の解釈をAI Adapterへ分離し、正規化だけをTask・実行・回収の完成へ昇格しない | UT／IT | `ERB-UT-032`、`ERB-IT-001`、`ERB-IT-002` |
| [ARCH-000015](../../../06_Architecture/Definitions/ARCH-000015/architecture_definition.md) | `arch-000015.qa-000006` | Architecture Definition／詳細設計（結果と公開境界） | 曖昧な構造化結果を拒否し、生Provider出力を公開しない。共通結果判定とProvider固有解析を分ける | UT | `ERB-UT-032` |

### Architecture詳細設計入力

`ARCH-000008`とDocker Isolation詳細設計の環境観測・unknown保持から、`ERB-UT-034`へbackend一覧の純粋分類を導出する。旧WSL試験の`PRL-UT-006`はTask状態／Authority義務であり、この分類へ流用しない。関連する上位義務は`ERB-IT-014`／`ERB-ST-009`であり、UT成功は実環境観測・停止・回復・Authorityの成立を代替しない。

Engine観測移管では既存`ERB-IT-014`／`ERB-IT-001`へ、再起動と修復の固定構成差、Publisher前後変化、明示pipe不存在と観測不能、close不明を接続する。回収不明は同一操作の初回・待機再観測で共有し、以後の観測0、最終blocked、元のexact IDとNative固有cleanup値保持を確認する。移管した三Caseの判定内容は維持し、合成境界の成功を実Publisher・実pipe・再起動完了へ拡張しない。新Local Itemは追加しない。

Provider差の純粋検証は、`ARCH-000004`／`ARCH-000015`の結果変換と`ARCH-000010`のProfile構成境界を、AI Adapter詳細設計§7の公開契約へ具体化して導出する。`ERB-UT-032`は既存ITの実CLI終了を、`ERB-UT-033`は実課金防止を証明しない。課金方針はCoordinator詳細設計§7のAPI key fallback／追加購入非対応を引き継ぎ、未実装の有料APIを新機能として採用しない。

| 詳細設計領域 | 受け取る成立条件 |
|---|---|
| [coordinator](../../../06_Architecture/Details/coordinator/01_Architecture.md) | 実行編成、Authority、外部Effect、候補、回収・回復。7.5.1の未改造公式CLI・Docker隔離は`ERB-IT-031`で配布と公開起動を確認する。通知と最終結果は`ERB-UT-023`、同11節を含む公開CLIの取消・親Process喪失は`ERB-ST-030`で確認する。旧内部改造の024～029は現行の要求集合から外す。 |
| [ai-adapter](../../../06_Architecture/Details/ai-adapter/01_Architecture.md) | Provider構造化結果の純粋解析・正規化／拒否を`ERB-UT-032`、Subscription限定の方針記述を`ERB-UT-033`へ接続する。実CLI、課金、Process、取消、cleanupは別の義務である。 |
| [cros](../../../06_Architecture/Details/cros/01_Architecture.md) | Repository横断解決、Grant、投影、外部接続、候補処置 |
| [platform-access](../../../06_Architecture/Details/platform-access/01_Architecture.md) | OS資源、Process Effect、観測、cleanup、回復 |
| [docker-isolation](../../../06_Architecture/Details/docker-isolation/01_Architecture.md) | Docker技術処理・環境依存の下位集約、環境共通API、技術結果／通知の相関。上位の許可・正本状態・Task進行は所有しない。現行Windows実装の保持と未対応環境の新Effect前停止を区別する。Probe作成ID・三軸応答の純粋分類は`ERB-UT-038`が所有する。 |
| [verification-runner](../../../06_Architecture/Details/verification-runner/01_Architecture.md) | 外部境界試験の段階適用、子Process結果および観測不能時の停止 |
| [visual-preview](../../../06_Architecture/Details/visual-preview/01_Architecture.md) | Repository内Visual Root、localhost HTTP、読取り専用配信およびListener清掃 |
| [workbench-server](../../../06_Architecture/Details/workbench-server/01_Architecture.md) | Production localhost Server、Browser UI、公式ロゴ、実Visual Profileおよび終了後資源 |

## 2. Lifecycle全体

```text
[入力／構成]
      ↓
[要求] ≠ [受理]
      ↓
[開始] ≠ [完了通知]
      ↓
[外部Effect] ≠ [結果搬送／観測]
      ↓
[子Process・Container・handle・Mountの終了]
```

## 3. 試験段階と外部境界の適用

| 試験段階 | 適用 | 確認する範囲 | 外部境界の到達範囲 | 判断理由 |
| --- | --- | --- | --- | --- |
| UT | Required | 状態遷移、理由分類、相関とbackend一覧の純粋規則 | N/A | 定義済みの純粋分類を外部Effectなしで独立して反証する必要がある |
| IT | Required | Adapterと実CLI／Process／Containerの直接境界から関連2 blockまで | Related 2 Blocks | 起動だけでなく搬送、取消、回収、終了後を局所化するため |
| ST | Required | 公開入口から実Runtime結果と全資源終了まで | System/E2E | 局所境界の成功を利用者経路全体へ一般化しないため |
| UAT | Conditional | 外部Runtime停止・回復を利用者が判断する場面 | User Acceptance | 人間判断が公開操作に含まれる場合に必要 |

### 条件区分の適用

本表は、旧比較用の項目を含むCanonical検証項目の分類閉包を示す。分類への掲載は現在のRuntimeでの実行要求や適用結果を意味しない。旧`ERB-ST-011`／`ERB-IT-012`は旧handoff比較専用として保持し、現在のRuntimeのRequired実行集合には含めない。ID・元Oracle・過去Evidence・正式Not Runを別の意味へ転用しない。

| 条件区分 | 適用 | 対応Local Item | 判断理由 |
|---|---|---|---|
| 正常 | Required | ERB-IT-001、ERB-UT-016、ERB-IT-031、ERB-UT-033 | 通常の成立経路と固定課金方針の記述を独立して確認する。 |
| 境界 | Required | ERB-IT-006、ERB-UAT-007、ERB-IT-008、ERB-IT-010、ERB-ST-015、ERB-IT-018、ERB-ST-019、ERB-IT-020、ERB-IT-021、ERB-ST-022、ERB-UT-023、ERB-UT-034、ERB-UT-035、ERB-UT-036、ERB-UT-037、ERB-UT-038、ERB-UT-039 | 値、Authority、情報、責務、localhost配信範囲、Browser lifecycle、Workbench Production Shell、AI依頼種別、公式助言のDocker隔離、実Browser観測、固定Native応答の値境界または利用者判断の境界を確認する。故障注入ERB-IT-002は異常へ分類する。 |
| 準正常 | Required | ERB-IT-004、ERB-ST-005 | 継続可能な分岐、保留、観測不能または診断状態を成功へ畳まない。 |
| 異常 | Required | ERB-IT-002、ERB-UT-032 | 起動・搬送・終了の失敗と不正Provider構造化入力の拒否を区別して確認する。親Process喪失は回復項目ERB-ST-030でも独立scenarioとして処置する。 |
| 回復 | Required | ERB-IT-003、ERB-ST-009、ERB-ST-011、ERB-IT-012、ERB-ST-013、ERB-IT-014、ERB-IT-017、ERB-ST-030 | 失敗・取消後に同じIdentityと義務で安全に再入場できることを確認する。旧二項目の現在Runtimeへの非適用は上記の区分に従い、分類の保持から再実行を要求しない。 |

公式CLI移行では、旧内部改造に対する`ERB-IT-024`～`ERB-IT-029`を現行の必須集合から除外する。旧6項目の詳細は基準Commit `823cb32deaa0e21a28aad73942ab5a05a9aa0950`の本定義で追跡し、現行の検証項目表には残さない。IDを別の意味に再利用せず、過去の成功を新方式の成功へ流用しない。公式CLI内部のTool登録禁止とJS能力不存在は現行CRDDの保証対象ではない。

新方式の公開配布・起動は`ERB-IT-031`、有限な通知分類と唯一の最終結果は既存`ERB-UT-023`、取消・喪失と終了後資源は既存`ERB-ST-030`が所有する。未署名の新しい通常実行経路、必要な実Provider E2E、実取消・終了後観測が未成立の間は全体Passを表示しない。任意配布署名は別適用範囲で評価する。

2026-10-14のDocker Isolation責務分離では、`ERB-UT-023`のExecution Plan構築断面に固定Docker構成の純粋反証を接続する。九purpose、固定隔離flag、Workspaceなし／読取り／書込み、Init／対話の組合せ、不正所在・資源・Proxy・payloadの拒否と計画の不変性を確認する。Task Router、送信許可、結果正規化の全義務をこの断面だけで満たしたとは扱わない。実Processの開始・搬送・取消・終端は`ERB-IT-002`、観測不能・Effect前停止は`ERB-IT-004`、親喪失と資源終端は`ERB-ST-030`へ保持し、移管後の本番Ownerで再確認する。設計正本は[Docker隔離詳細](../../../06_Architecture/Details/docker-isolation/01_Architecture.md)、抽出中の状態と限定結果は[CHGの現在計画](../../../99_Roadmap/Changes/CHG-000082/second-stage-plan.md#順序9の抽出進捗--2026-10-14)を参照する。

### Docker技術Owner・環境共通境界への追加導出 — 2026-10-14

人間の追加指示とDocker隔離詳細設計§4／§6から、既存Local Itemの対象断面を次へ接続する。新しいLocal Itemや通知基盤を機械的に追加しない。先行候補の通常隔離・実Docker成功を、Desktop実処理の移管や上位のOS知識除去の成立へ流用しない。現在は設計・試験接続の更新中であり、以下の追加断面は未検証として保持する。

| 導出元 | 対応Local Item | 追加して反証する条件 | 到達範囲・終了後条件 |
|---|---|---|---|
| 下位技術Owner・環境共通API | `ERB-IT-001`、`ERB-ST-005` | Coordinator／OrchestratorのDocker制御にOS選択・Desktop型・コマンド・Path・WSL知識が残る、旧Desktop record／phaseを現在判断へ流用、下位から上位import、上位callbackがDocker実処理を代行する反例 | Source／公開契約と本番利用側。汎用Platform Access・配布Trust・履歴・診断表示は別母集団で判定し、未対応Linuxを成立済みにしない。旧形式の移行はフロントAIが行い、Runtimeの二重Schemaを作らない |
| 通知と返却結果の相関 | `ERB-UT-023`、`ERB-IT-002`、`ERB-IT-004` | 要求・受理・開始・完了の混同、コピー／別Operationの結果、遅延・重複通知、callback例外・Promise／不正戻り値・部分更新後throw、OS固有reasonによる上位再試行 | 純粋相関と関連Blockの実接続。同期・直列、例外後／最終返却後のcallback 0、登録参照0を観測。一次失敗・cleanup・配送不成立・未確定保存を別に保持し、二重Effectと完了状態の巻戻し0 |
| 取消・親喪失・同ID再入場 | `ERB-IT-003`、`ERB-ST-030` | 通知未着だけから不存在を推定、古いHandle再利用、正本記録との相関欠落、通知購読解除だけで終了、Consumer保存待ちでDocker清掃を未完了扱い | 実Process・現在Docker資源観測と公開利用側。不存在または同じexact回復参照の保持を確認する |
| 許可済み運用介入の下位実処理 | `ERB-ST-009`、`ERB-IT-014` | 旧Nativeの真正性・Job所有・終了保証を落とす、未許可再起動、部分Effect／不明を成功化、旧fence／IDを別操作へ流用 | 既存Windows／Docker境界。介入の実行許可は別に確認し、Source移管の許可を再起動許可へ読み替えない。旧`ERB-ST-011`／`ERB-IT-012`は移行元保証の比較だけに使用し、新義務を付けない |

## 4. 検証項目

| Local ID | 条件区分 | 試験段階 | 試験種別 | 対象／境界 | 外部境界の段階 | 事前状態／入力 | 操作／刺激 | 観測 | Oracle | Evidence | 終了後条件 | 実行形態 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `ERB-UT-039` | 境界 | UT | Native単一entry／同期終端順序 | `ARCH-000008`・Platform Access単一entry観測の取得・照会・解放・応答確定 | N/A | 正常payload、二つの不存在、他open失敗、query／close不明、write／部分write／flush拒否 | private同期処理へ固定closureとメモリwriterを渡す | 全イベント列、同handle搬送、exitと全文／部分出力bytes | open不成立ではquery／close0。成功取得ではquery成否によらずclose一回。close不明では応答0。二つの不存在以外をAへしない。出力失敗は3 | 独立固定行列の順序・値assertion。実Win32と固定配布は別IT | OS Process／Filesystem／Docker Effect 0 | Automated |
| `ERB-UT-038` | 境界 | UT | 診断Probe／純粋結果分類 | `ARCH-000008`・作成ID、実ID／名前／Labelの三軸応答、固定完了JSONと実行事実 | N/A | 完全ID、不正・欠測、UTF-8 64KiB境界、各軸の残存・非0・error、完了JSON・Signal・stderr容量・時間境界 | 作成・三軸不存在・完了の分類へ固定観測値を渡す | status、ID、固定reason、byte数、経過時間、終了値、入力不変 | 作成・不存在・完了の各成功条件を独立評価し、欠測を成功へ補完しない。隔離結果の肯定をSignal／計測値のlifecycle肯定へ転用しない。移管前と同じ条件を保持 | 独立期待値と三軸省略変異、理由優先順と完了条件の反証。実起動・回収は別IT／ST | Process／Filesystem／Docker Effect 0 | Automated |
| `ERB-UT-037` | 境界 | UT | 修復Native相関／純粋frame | `ARCH-000008`・同利用者Mutex名と固定H応答 | N/A | 固定32byte Hash、空出力容量、flush拒否 | 同じ捕捉値からMutex名と41byte H応答を生成する | 旧Mutex prefix、Hash全byte、magic／status／payload、書込み結果 | 同じHashを使い、write／flush失敗を成功にしない。相関値を認可やMutex現在所有へ昇格しない | 純粋入力と全byte assertion。実利用者・Native取得は別IT | Process／Filesystem／Docker Effect 0 | Automated |
| `ERB-UT-036` | 境界 | UT | 実行環境修復／現在値と純粋遷移 | `ARCH-000008`・DI技術checkpoint／Coordinator修復variant | N/A | 初期値、固定九処置、三用途実体、Task／修復の混在、発行・確認・回収と保持判断の境界値 | 復号・前後遷移と固定対象の次版候補をメモリ内で検査する | exact ID・元版・対象外全文、意図／発行／結果、一次失敗と回収失敗、実体・保持判断と終端の相関 | 意図前発行、unknown再発行・既知結果巻戻し、順序飛越、実体置換、偽Task値・kind混用・旧Schemaを拒否する。ready単独やcodec成功を全体完了へ昇格しない。他操作を変更しない | 固定入力区分と前後assertion。DI技術値、Coordinator相関、Task回帰を別々に評価する | Process／Filesystem／Docker Effect 0。実Writer・排他・fresh再入場・実修復はIT／STで別確認 | Automated |
| `ERB-UT-035` | 境界 | UT | 固定Native所在応答／純粋frame分類 | `ARCH-000008`・Platform Accessの固定所在応答encoder | N/A | 空、NUL、不正UTF-16、32767／32768 code unit、書込み拒否とflush拒否のメモリwriter | 固定magicとUTF-16値を応答encoderへ渡す | 終了分類、出力byte数、用途magicと完全長 | 正常上限32767は0・65546bytes。不正入力は2・出力0。writeまたはflush失敗は3であり成功へ畳まない | 入力区分、戻り値、出力形状のassertion。実OS所在・利用者Identityの証明にはしない | 外部Process／Filesystem／Docker／Provider Effect 0 | Automated |
| `ERB-UT-034` | 境界 | UT | Docker backend一覧／純粋状態分類 | `ARCH-000008`・Docker Isolationの環境観測→固定Process結果の分類 | N/A | UTF-8／UTF-16正常一覧、失敗exit・signal・error・stderr・容量超過、不正encoding／文法、登録欠落・重複・稼働集合不整合 | 登録と稼働の固定一覧結果を分類する | stopped／running／unknownと入力差分を記録する | 成功した整合一覧だけを分類し、不明を空成功やstoppedへ畳まない。一時点の分類をEngine停止・Process不存在・再起動完了・Authorityへ昇格しない | 固定入力分類、結果とOracle判定。生環境一覧・秘密値・Host Pathは保存しない | Process／Filesystem／Docker／Provider Effect 0 | Automated |
| `ERB-UT-032` | 異常 | UT | Provider構造化結果／純粋変換 | 未信頼JSON・Codex／Claude Envelope→AI Adapter | N/A | 単一正常結果、重複key・末尾データ・不足Envelope、Codexの16KiB直前・一致・超過、およびTurn／cost上限の反例 | Provider正規化と共通JSON解析を固定値で実行する | 入力UTF-8 bytes、正規化値、blocked分類、固定契約field、生出力非公開を観測する | 唯一のexact結果だけを受理し、不正入力を部分公開せず、生出力を返さない。Codexは16KiB以下だけを受理する。固定上限を実課金・Process終了保証へ昇格しない | 固定入力分類、返却値、拒否と契約fieldの判定。生Provider出力・秘密値は保存しない | 実Provider／Filesystem Effect 0、Process起動0 | Automated |
| `ERB-UT-033` | 正常 | UT | Subscription課金方針／純粋記述 | AI Adapter課金方針公開操作→固定記述 | N/A | 既存Subscription限定方針と未実装有料APIの前提条件 | 方針記述を取得してfieldと条件を照合する | 暗黙fallback・追加購入・設定単独Authorityの否定と未実装条件を観測する | Subscription限定、API key fallbackと追加購入非対応を維持し、利用者設定だけで実行Authorityを発行しない。将来条件は未実装の記述である | 固定field・条件、非発行と判定。実課金防止の証明にはしない | 実Provider／課金／Filesystem Effect 0 | Automated |
| `ERB-IT-031` | 正常 | IT | 公式配布／公開起動 | Coordinator固定配布→Docker→公式Codex CLI／Host | Related 2 Blocks | 検証済み公式CLI・同版Host・既存bwrap、固定DockerfileとImage、認証情報なし | 配置用Imageを作成し、network none・非root・read-onlyのコンテナで版表示と実行物Hashを確認する | 公式版、三実行物Hash、実Image Digest、終了コード、起動Warning、コンテナ終了後状態 | 未改造公式0.159.2と固定Hashが一致する。CLI Source BuildとPatchを必要とせず起動する。Warningを消去せず、実助言・取消・署名成立とは区別する | 固定配布Identity、版、Hash、局所起動と終了後判定の要約。実行ごとの大きな書庫を作らない | Provider依頼0、認証情報使用0、試験コンテナ不存在を確認する | Automated |
| `ERB-ST-030` | 回復 | ST | 公開CLI取消／親Process喪失 | 本番同等CLI入口→固定Host→Process Tree／Container／Network | System/E2E | 詳細設計7.5.1・11、本番同等の搬送・権限・環境、実行中Cell、対象の外にあるObserver、exact資源Identity | 公開取消とCLI親Process喪失を別scenarioで実行する | 取消伝播、公開結果、Host終了、全所有資源の閉包、必要時のexact回復参照 | 両scenarioを個別評価する。清掃完了と観測不能による停止・回復義務保持を分け、安全な停止を清掃完了やCapability完成へ読み替えない | scenario別の実行Identity、公開結果、資源観測、exact回復義務、固定配布・環境・入力Hash | 全所有資源0または同じexact回復義務保持。新Provider要求・永続Dockerデータ削除0 | Automated |
| `ERB-IT-001` | 正常 | IT | External Contract／Lifecycle | Adapter→実CLI・Process・Container | Direct Boundary | 固定CLI・Process・Container、相関ID、終了後資源Observer | 外部実行を開始し完了まで観測する | ERB-IT-001として、「外部実行を開始し完了まで観測する」前後のAdapter→実CLI・Process・Containerについて、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 構成、要求、受理、開始、結果、完了を同じrunで相関 | ERB-IT-001、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「構成、要求、受理、開始、結果、完了を同じrunで相関」および終了後条件「すべての所有資源の終了を独立観測」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | すべての所有資源の終了を独立観測 | Automated |
| `ERB-IT-002` | 異常 | IT | Fault Injection／Lifecycle | Controller→stdio・signal・close→資源Observer | Adjacent 1 Block | 起動・搬送・取消・closeの各境界へ故障を注入できる固定Task | handle取得後、write後、kill要求後にそれぞれ失敗させる | ERB-IT-002として、「handle取得後、write後、kill要求後にそれぞれ失敗させる」前後のController→stdio・signal・close→資源Observerについて、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 前段階の成功を後段階の成功にせず、原因段階を返す | ERB-IT-002、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「前段階の成功を後段階の成功にせず、原因段階を返す」および終了後条件「終了不明をcleanup成功にしない」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 終了不明をcleanup成功にしない | Automated |
| `ERB-IT-003` | 回復 | IT | Cancellation／Recovery | Task Runtime→Controller→外部Runtime→Recovery | Related 2 Blocks | 実行中Task、取消Authority、重複・遅延通知と部分結果の注入点 | timeout、cancel、重複通知、遅延close、部分結果を順に発生させる | ERB-IT-003として、「timeout、cancel、重複通知、遅延close、部分結果を順に発生させる」前後のTask Runtime→Controller→外部Runtime→Recoveryについて、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 状態遷移、結果搬送、Effect、回収を独立に評価 | ERB-IT-003、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「状態遷移、結果搬送、Effect、回収を独立に評価」および終了後条件「残存する場合は回復義務を保持」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 残存する場合は回復義務を保持 | Automated |
| `ERB-IT-004` | 準正常 | IT | Unknown State／Safety | Observer→Effect Gate | Direct Boundary | 実行可能性、現存Processまたは終了後不存在を観測できない環境 | 観測不能なまま状態判定と次のEffectを要求する | ERB-IT-004として、「観測不能なまま状態判定と次のEffectを要求する」前後のObserver→Effect Gateについて、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | available／absent／doneへ丸めず、安全な停止と診断情報を返す | ERB-IT-004、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「available／absent／doneへ丸めず、安全な停止と診断情報を返す」および終了後条件「追加外部Effect 0」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 追加外部Effect 0 | Automated |
| `ERB-ST-005` | 準正常 | ST | Observability／Scenario | 公開入口→外部Runtime→結果・終了後診断 | System/E2E | 同一固定Taskの正常例と各故障例、機密を除く相関ログ契約 | 全例を実行し、段階別診断を収集する | ERB-ST-005として、「全例を実行し、段階別診断を収集する」前後の公開入口→外部Runtime→結果・終了後診断について、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 入力／構成から終了後までの段階、理由、相関を記録 | ERB-ST-005、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「入力／構成から終了後までの段階、理由、相関を記録」および終了後条件「Path、Credential、Secret、生Provider出力を含まない」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | Path、Credential、Secret、生Provider出力を含まない | Automated |
| `ERB-IT-006` | 境界 | IT | Configuration／Selection | AIモデル構成→Schema検証→利用可能性確認→選択結果 | Related 2 Blocks | 許可値、未知値、Schema違反、利用不能モデル、採用前候補、採用済み構成を含む固定入力 | 構成を検証し、選択と採用を別操作として要求する | 構成Revision、Schema判定、Provider利用可能性、実効モデル、選択理由、再選定条件、構成保存回数、Provider Effect回数を入力別に記録する | 未知・不正・利用不能を暗黙fallbackせず、実効モデル、選択理由、再選定条件を返す | ERB-IT-006、構成Revision、Schema判定、Provider利用可能性、実効モデル、選択理由、再選定条件、保存回数、Provider Effect回数およびOracle判定を保存する。Secret、生Provider出力および絶対Pathは保存しない | 採用時だけ構成を一回保存し、選択だけではProvider Effect 0 | Automated |
| `ERB-UAT-007` | 境界 | UAT | Acceptance／Diagnosis | 外部Runtimeの状態・構成・影響範囲→利用者判断 | User Acceptance | 正常、部分故障、利用不能、未知構成を含む診断結果 | 利用者が継続、再選択、停止または回復を判断する | 表示された状態、選択理由、不完全性および利用者判断を記録する | 故障境界と影響範囲を理解し、未知状態を正常として継続せず、AIモデル構成を根拠付きで選べる | ERB-UAT-007の診断結果、利用者判断、選択根拠および終了後状態 | 判断前に新しいProvider Effect 0 | Manual |
| `ERB-IT-008` | 境界 | IT | Provider Home／Preflight | Provider Home設定→Directory検証→Process Gate | Direct Boundary | 正常Home、欠落、file、link／reparse、別Repository、権限不足の各fixture | Provider起動前にHomeを検証する | 入力Home分類、解決結果、検証理由、Provider Process Effect回数を記録する | 正常な所有Directoryだけを受理し、不正・不明時は理由付きで停止する | ERB-IT-008、Home分類、検証結果・理由、Provider Process Effect回数およびOracle判定を保存する。絶対Pathは保存しない | 不正・不明時のProvider Process Effect 0 | Automated |
| `ERB-ST-009` | 回復 | ST | Docker Repair／Recovery | 修復Identity→既知Runtime領域の段階退避→Docker restart→Engine readiness | System/E2E | exact Repair ID、`Docker/run`と`docker-secrets-engine`の既知2領域、停止中またはハングしたDocker、初回起動失敗、Engine readiness Observer、単一Probe Timeout、全体起動期限、現在Schemaで開始した操作の再入場 | 同じRepair IDで各領域を順序付きに退避し、再起動・確認を継続する。初回起動が期限超過し、既知2領域のlockとProcess集合を確認できる場合は、単一Probe Timeoutを停止済みと誤認せず、同じInvocation内でContinuationへ移る | Repair ID、領域別Identity、各Effectの意図と結果、再起動試行、Engine readiness、継続Gateの条件別理由、同一実行内で計測できた起動所要時間の参考値、再入場回数を記録する | 未完了Effectを再発行せず、個別socketを削除しない。期限満了後に既知2領域のexact lockとProcess集合が揃う場合は、Process停止を一回だけ行い、その後にEngine既知停止とProcess不在をfresh確認してから段階修復する。2領域の退避と新世代確認が揃いEngine readyになった後だけ完了する | ERB-ST-009、Repair ID、領域別Identity Hash、現在Schemaの処置順と元Identity、Effect確認、Engine readiness、継続Gateの条件別理由、起動所要時間または未計測、同一Invocation継続または再入場の結果、残る回復義務を保存する | native helper残存0。停止後もEngineまたはProcessが未確認、部分退避、観測不能、intent後中断では自動継続せず同じRepair IDの回復義務を保持する | Hybrid |
| `ERB-IT-010` | 境界 | IT | CROS Handoff／Continuation | Source Runtime→Handoff記録→Destination Runtime | Related 2 Blocks | 正常Contextに加え、Task／Project Identity不一致、Revision不一致、必須Context欠落、Authority追加、再構成不能Contextの各固定入力 | 各ContextでHandoffを発行し別Runtimeから再入場する | Handoff Identity、Task／Project Identity、Revision、必須Context充足、Authority差分、Effect件数、拒否理由、再入場結果を両Runtimeで相関する | 正常時はIdentityとRevisionを保持する。不完全・不一致・Authority拡大時は推測補完も完了扱いもせず、同じHandoff Identityで不足を返す | ERB-IT-010、両Runtimeの相関Identity、Revision、必須Context判定、Authority差分、Effect件数、拒否理由、再入場結果を保存する | 正常時は送信元の所有資源0・重複Effect 0。拒否時はDestination Effect 0 | Automated |
| `ERB-ST-011` | 回復 | ST | 旧Docker Session Handoff／Recoveryの比較専用項目 | 旧handoff／chain接続（現Runtime非適用） | System/E2E | 旧入力とOracleは比較専用節で保全 | 現Runtimeで旧Reader・adoption・旧記録追記を実行しない | 旧専用項目と現在適用範囲の区別 | このIDへ別意味の現在回復義務を付けない。現在義務は既存ERB-IT-003／004／014、ERB-ST-030へ接続 | 旧Oracle・旧Evidenceを保持し、新経路の根拠にしない | 旧項目の非適用を旧義務成立やPassへ変換しない | Hybrid |

### ERB-ST-009の段階的な外部境界確認

| 段階 | 確認対象 | 主な反証 |
|---|---|---|
| 1. 領域単体 | `Docker/run`と`docker-secrets-engine`を別々に観測し、exact Identityと既知lockを確認する | 一方だけ確認、再帰探索、未知error、観測中の内容変化 |
| 2. Effect単体 | 期限超過時にProcessが残る場合は停止意図を先に耐久化して一回だけ停止する。停止後にEngine既知停止とProcess不在をfresh確認する。各退避の意図も先に耐久化し、Effect直前にsource／lock Identity、target不存在およびHost静止状態を再確認してから同一親へrenameし、結果を記録する | 単一Probe Timeoutの停止済み扱い、停止intent後中断、停止部分成功、rename後settlement前中断、個別socket削除、別Directory退避、観測後のDocker再起動、Identity差替え |
| 3. 領域間結合 | 失敗起動世代とSecrets Engineを同じRepair IDで順序付きに退避し、各Effect前に先行退避結果とHost停止状態を再確認する | 一領域の成功を全体成功へ昇格、別Repair IDへの逃避、旧Effect再発行、一領域退避後のProcess再出現 |
| 4. 再起動結合 | 両領域の退避後に再起動を一回だけ発行する。confirmed後の既知未起動と単一Probe Timeoutは180秒の全体期限内で読取り再観測する | 起動結果不明時の再発行、片側未完了での起動、単一Probe Timeoutでの即時停止、取消・Trust変化・一般エラーの再試行 |
| 5. 回復全体 | Engine、Process、新しい2領域、退避2領域、3 Effectのconfirmed settlementおよびnative helper終了を確認し、同一実行内で計測できた起動所要時間を参考値として保存する | Engineだけの成功、いずれかの新旧世代欠落、部分回復、全体期限超過、未確認Effect、資源残存、再入場時の起動時間推測 |
| 6. 版更新・再入場 | 現在Schemaの同Repair IDと現在実資源をfreshに確認して再入場する。旧記録・旧世代はフロントAI移行確認まで新Effect 0、元unknownとexact義務を保持する | 旧署名／chainのRuntime採用、旧Reader／adoption／旧記録追記、旧Effect再発行、観測不能の完了化 |

各段階の局所試験がPassしても次段階の成立を推定しない。現在Schemaで開始した操作について、初回起動失敗、既知2領域のIdentity／lock／Process、fresh観測、同じRepair IDでの再入場、一次Effect再発行0、取消と終了後状態を確認する。旧記録・旧世代の反例はフロントAI移行確認まで新Effect 0、既発行Effectのunknownと同じexact義務保持を期待する。旧署名版の採用・chain追記は現在STの成功Oracleへ含めない。未署名固定入口・必要Artifact・現在許可から実境界へ到達する新しい根拠が必要である。

| `ERB-IT-012` | 回復 | IT | 旧Docker Repair Handoffの比較専用項目 | 旧handoff／chain接続（現Runtime非適用） | Related 2 Blocks | 旧入力とOracleは比較専用節で保全 | 現Runtimeで旧Reader・adoption・旧記録追記を実行しない | 旧専用項目と現在適用範囲の区別 | このIDへ別意味の現在回復義務を付けない。現在義務は既存ERB-IT-003／004／014、ERB-ST-030へ接続 | 旧Oracle・旧Evidenceを保持し、新経路の根拠にしない | 旧項目の非適用を旧義務成立やPassへ変換しない | Automated |
| `ERB-ST-013` | 回復 | ST | CROS Handoff Scenario | Source Runtime→Handoff→Destination Runtime | System/E2E | 同じContext Identity／Revision、切断、Destination拒否、Authority差 | SourceからDestinationへContextを移送し再開する | 両Runtime状態、Identity、Revision、Authority差、結果を記録する | 未確認Context補完やAuthority昇格なしに同じIdentityで再開する | Source／Destination状態、結果、判定 | Source二重実行0 | Automated |
| `ERB-IT-014` | 回復 | IT | Docker Repair／Restart Boundary | 現在Snapshot・準備Owner→DI固定操作・Engine Observer | Related 2 Blocks | stale socket、Engine停止、restart受理、ready未確認、複数Recovery、Scope追加・欠落・置換、Host／Home競合、Reader／Writer解放不明、要求前・受付・終端保存不明 | 修復または検証付き再起動を要求し、現在Rootとexact操作、全Host／Home／Runtime排他を固定して同じcheckpointとDI公開入力へ結合する | 元版・Scope・Lock順、要求前保存、実受付、Engine観測、一次／cleanupと配送、対象Recoveryの終了状態を観測する | fresh Scope／元版・保存読戻し・更新Lock解放の確認前は要求0。過去unknownを未発行や成功へ戻さず、再起動後Task回復は選択したexact対象だけとする | 入力、元版・Scope差、Lock順、保存結果、要求・実受付、技術結果、対象別終了状態、判定 | 未確認時は同じ回復義務保持、他操作・元Task結果変更0、全解放を逆順に試行する | Automated |
| `ERB-ST-015` | 境界 | ST | Boundary Progression | 局所Gate→直接境界→Lifecycle→公開入口 | System/E2E | 段階別結果と下位未Pass／未実行反例 | 下位Gate成立時だけ次の境界を実行する | 各段階の開始条件、結果、未開始理由を記録する | 下位未成立のまま上位境界を開始せず公開入口まで順序を保つ | 段階結果、実行順、判定 | 禁止上位Effect 0 | Automated |
| `ERB-UT-016` | 正常 | UT | Authentication／Lifecycle Contract | Claude再認証Plan→Provider Home排他→耐久Intent／Command世代→認証Probe→exact cleanup | N/A | 固定Provider Home Identity、正常・途中失敗・観測不能・競合・既存Intentの各固定入力 | 再認証Lifecycleを依存差替え境界で実行する | mount、実行順、秘密入力非表示案内、内部Proxy alias／port、Probe、資源不存在、`idle`／`in_flight`、回復Identity、後発Effect件数を記録する | Repository／Workspace／API keyを接続せず、秘密入力をCRDDが反響せず非表示・一回入力を事前案内し、内部Proxy接続が実装の固定待受port `8080`と一致し、Probeと全資源不存在が揃った場合だけ完了する。不存在時の空stdoutと`[]`は明示stderrとの組合せだけ受理する。別port、任意stdout、競合、観測不能、旧Command in-flightでは追加Effect 0または安全な失敗として同じ回復Identityを保持する | ERB-UT-016、固定入力、実行順、固定Proxy port、結果理由、Command世代、回復Identity、Effect件数および終了後資源状態を保存する。Path、Credential、Secret、生Provider出力は保存しない | 正常時は所有資源不存在かつ耐久記録settled。未確認時は同じ回復Identityを保持 | Automated |
| `ERB-IT-017` | 回復 | IT | Authentication／Durable Recovery | 子Process→Provider Home Kernel Lock→耐久Intent／Command世代→fresh Process再入場 | Direct Boundary | 固定Provider Home Identity、active Intent、`idle`または`in_flight`、所有資源、不意のProcess終了 | Lockとactive Intentを持つProcessを終了し、fresh Processで同じ再認証を開始する | Process終了、Lock再取得、Recovery ID、Command世代、資源所有権、Intent状態、後続Effect順序を記録する | `idle`では所有資源不存在の確認後だけ再入場してsettledへ閉じる。`in_flight`では旧Command終了を推定せずDocker Effect 0で同じRecovery IDを保持する | ERB-IT-017、固定Identity、子終了、Lock再取得、Intent／Command世代遷移、Docker Effect列、Oracleおよび終了後状態を保存する。Path、Credential、Secret、生Provider出力は保存しない | idle回復後は所有Docker資源0、耐久記録settled、Kernel Lock解放確認。in-flightではactive記録と手動回復義務を保持 | Automated |
| `ERB-IT-018` | 境界 | IT | Local HTTP／Read-only Preview | Repository内Visual Root→localhost HTTP Listener→Browser相当Consumer | Direct Boundary | LinkでないRepository相対Root、HTML／CSS、Directory、Traversal、Encode済みSeparator、Junction、不許可Methodおよびclose | Previewを一時Portで開始し、GET／HEAD／Healthと拒否入力を要求して終了する | Bind Address、Status、Header、本文、拒否結果、Health、close後Connectionを記録する | `127.0.0.1`だけへBindし、通常FileのGET／HEADだけを返す。Path越境、Link、Directory、書込みMethodを拒否し、内部Absolute Pathを公開しない | ERB-IT-018、固定Fixture分類、Request分類、Status、Security Header、read-only判定、close後Connection拒否およびOracle判定を保存する。Absolute PathとFile内容全量は保存しない | Repository書込み0、Listener 0、Connection 0 | Automated |
| `ERB-ST-019` | 境界 | ST | Actual Browser Zoom／Visual Gate | Repository内Visual成果物→localhost Preview→専用Chrome Profile→Rendered DOM観測 | System/E2E | SHA-256で固定した公開CLIから検証器までの実行閉包、全HTML・CSS・画像、Browser版、100%／200%／400%、1280×960 Window、文字12px下限、操作対象32px下限、画像読込、横OverflowおよびFocus順 | 条件ごとに専用ProfileでChromeを起動し、実Zoom反映後のRendered DOMと終了後資源を観測する | 指定倍率、DPR、実効Viewport、Scroll幅、最小文字、最小操作対象、正の`tabindex`、画像総数・成功・失敗、正常終了受理、実終了経路（normal／sigterm／sigkill／unknown）、Process Tree、DevTools、Profile、Preview Listenerを記録する | 全画面・全倍率で実Zoomと画像読込が成立し、表示不適合が0件である。Listenerは接続拒否だけを不存在とし、timeout・分類不能・資源残存または終了経路unknownをPassにしない | ERB-ST-019、観測時HEAD、入力Manifest、Browser版、対象一覧、倍率、Window寸法、集約測定値、Oracleおよび資源別終了後状態を保存する。DOM本文、Absolute Path、Profile Path、PIDおよびDevTools Endpointは保存しない | Browser Process Tree 0、DevTools Listener 0、専用Profile 0、Preview Listener 0、Repository書込み0 | Hybrid |
| `ERB-IT-020` | 境界 | IT | Browser Lifecycle Observation | localhost Listener／所有Browser Process→終了後観測 | Direct Boundary | 応答しないが接続を受理するListener、close後の接続拒否、不正Port、遅延正常終了するProcess、Signalまで残るProcess、親終了後も残る子Process、同じPIDと異なる世代Identity、未検証Identity、順不同の親・子・孫、および前段cleanup失敗 | TCP接続状態と所有Process終了を局所境界で観測する。終了要求直前にTreeを再取得し、正常終了期限後だけexactな世代Identityを再確認してGraphの深い順にFallback Signalを発行する。cleanup段へ失敗を注入する | present／absent／unknown、normal／sigterm／sigkill／unknown、子孫Fallback有無、Signal順、Tree不存在、cleanup実行順および集約Errorを相互に区別して記録する | 接続拒否だけを不存在とし、timeout・分類不能をunknownへ保つ。親終了後に残る子Processへ限定Fallbackを実発行して最終0件を確認する。同じPIDでも世代Identity不一致または安全なIdentity未確認ならSignal Effect 0とする。残存Processは孫→子→親の順に処置し、一段のcleanup失敗後も後続清掃を各一回試行して全Errorを集約する | ERB-IT-020、Listener三値反例、遅延正常終了、SIGTERM fallback、残存子Process fallback、世代Identity不一致／未検証Effect 0、深度順、cleanup失敗後の後続段実行、Error集約、Oracleおよび終了後状態を保存する。Port、PIDおよび実行Pathは保存しない | Test Listener 0、所有Child Process 0 | Automated |
| `ERB-IT-021` | 境界 | IT | Workbench Production Shell | Repository／Remote CROS→Workbench Server→Browser相当Consumer | Direct Boundary | 検証済みRepository Root、公式Logo、固定Route、許可済みPortfolio、明示選択Repository、Project検索・状態・Cursor、Topic／Meeting Query・Relation・昇格入力、Repository Tree／Diff Query、Orchestrator現在状態、Execution Event、Remote Credential／Exposure、AI Profile、AI依頼種別、根拠参照付きAI結果、変更候補の安全な確認MetadataとCandidate ID、採用／破棄／保留、確認有無、HEAD、Allowlist外Path、不許可Methodおよびclose | Workbenchを一時Portで開始し、Shell、CSS、Logo、Health、Portfolio検索・状態絞込み・継続読込・Project Detail、Repository未選択時のTopic／Meeting非表示、選択RepositoryのRemote Topic／Meeting一覧・Detail・更新・Owner Repository付きRelation遷移、Repository単体のTopic／Meeting絞込み・実在CHGへのTopic昇格、Repository Tree遅延展開・File Diff、Runtime Activity継続読込、AI依頼の読取り助言／変更候補と項目別根拠参照、変更候補の確認・採用・破棄・保留、別Candidate IDと確認なしの拒否、Remote接続・失効および拒否入力を要求して終了する | Bind Address、Status、Header、Brand Asset、Shell内状態、Portfolio表示Project・Source状態・Query拘束Cursor・Source別五場面・欠測表示、選択Repository、Topic／Meeting Query保持・Detail Revision・Relation存在状態・Owner Repository・遷移先・更新先・昇格後状態、Tree Directory・Cursor・変更区分・Prepared／Working Patch・切詰め、Project限定Event順序・Cursor、AI Applicationへ渡したProfile ID・依頼種別・結果区分・根拠参照表示、変更候補のCandidate ID・確認Metadata・選択Action・確認有無・採否結果、Remote Readerへ渡したRepository集合、失効後表示、拒否結果、Healthおよびclose後Connectionを記録する | `127.0.0.1`だけへBindし、Direction A Shellと承認済み公式Logoを固定Routeで返す。Portfolioは許可済みProjectだけを安定順序で検索・状態絞込みし、検索条件へ拘束したCursorで最大20件ずつ読む。別条件Cursorを拒否し、選択ProjectはRepository Sourceごとの五場面を表示してmissingを完全状態へ畳まない。Topic／MeetingはQuery条件に一致するCanonical Recordだけを安定順序とQuery拘束Cursorで表示し、Detailは同じRevisionのCanonical Markdownへ戻れる。Remoteでは現在PortfolioのRepositoryを明示選択するまでTopic／Meetingを表示せず、選択RepositoryだけをMCPへ渡す。Grant外ID、取得失敗または未選択をLocal Repositoryの結果で補完せず、別RepositoryのRelationはMCPが返したOwner Repositoryへ明示切替する。Repository単体では実在Topic／Meeting／CHGだけを固定Routeへ接続し、欠落Relationをリンク化せず、任意Pathを受けない。Topic昇格は実在CHGと期待改訂を確認し、状態・Relation・終了表を一つの次版へ更新する。Repository TreeはDirectory単位で遅延展開し、選択FileのPrepared／Working差分を分離する。越境Path、別Directory Cursorおよび未追跡File内容の暗黙読取りを拒否する。Runtime EventはProject限定・上限付き・新しい順で読み、観測不能を0件へ畳まない。AI依頼はProfile IDと読取り助言／変更候補をApplicationへexactに渡し、各結果項目の本文と一件以上の根拠参照を同じ区分へ表示する。読取り助言を変更候補へ読み替えない。変更候補はStoreから再読取りした同じCandidate IDと安全な確認Metadataだけを表示し、採用・破棄ごとの明示確認を必須にする。別Candidate ID、確認なし、競合RevisionまたはScope不一致を拒否し、保留ではEffect 0とする。採用操作はCommit／Pushを発行しない。RemoteではGrant外RepositoryをReaderへ渡さず、失効後に直前の現在状態またはEventを表示しない。任意Repository Pathと書込みMethodを拒否する | ERB-IT-021、固定Route分類、Status、Security Header、Brand Asset読込、Portfolio Query・Cursor・Project Detail・Source欠測、選択Repository、Topic／Meeting Query・Detail・更新先・Relation Owner・遷移先・Topic昇格、Repository Tree／Diff、Runtime Event Page、AI Profile ID・依頼種別・結果区分・根拠参照表示、変更候補のCandidate ID・確認Metadata・Action・確認有無・採否結果、Remote Grant、Local fallback 0、未接続／観測不能表示、拒否結果、close後Connection拒否およびOracle判定を保存する。Prompt、AI結果本文、Candidate本文、Absolute Path、File内容全量、Logo bytes、Tokenおよび生Event内容は保存しない | 未選択／Grant外Repository Effect 0、Local fallback 0、Listener 0、Connection 0、Credential永続保持0、確認前AI候補採用0、Commit 0、Push 0 | Automated |
| `ERB-ST-022` | 境界 | ST | Workbench Actual Browser／Visual Gate | Workbench Production Server→専用Browser Profile→Rendered DOM観測 | System/E2E | 固定したProduction Source、公式Logo、Desktop／Tablet／Mobile、100%／200%／400%、文字下限、操作対象下限、画像読込、Overflow、Focus順、Browser正常終了猶予および所有子Process残存 | Production Serverを起動し、各Profileと倍率で主要Screenを実Browser表示する。必須画面TargetのReact commit後に画像集合を取得して確定を有限時間待ち、終了時は終了直前Tree取得、正常終了、exactな世代Identity限定Fallback、最終不存在確認を順に行う | Browser版、Profile、倍率、実効Viewport、Scroll幅、最小文字、最小操作対象、画像成功・失敗、Focus順、未接続状態、終了経路、子Process fallback有無、終了処理・Tree観測所要時間および全資源終了を記録する | 公式LogoとDirection Aの情報階層がReactで表示され、Server Shell、未接続、描画途中または画像読込み途中を成功扱いせず、評価した不適合を隠さない。PIDだけで別Processを終了せず、正常終了猶予後も残る同一世代Identityだけを限定処置し、最終不存在を確認する。人間が許容したProfile不適合は理由と範囲をEvidenceへ残す | ERB-ST-022、固定Revision、対象Profile、倍率、集約測定値、Brand Asset結果、許容判断、終了経路、fallback有無、終了所要時間、Oracleおよび資源別終了後状態を保存する。DOM本文、Absolute Path、PIDおよびProfile Pathは保存しない | Browser Process Tree 0、専用Profile 0、Workbench Listener 0、Repository書込み0 | Hybrid |
| `ERB-UT-023` | 境界 | UT | AI Request Mode Router／Advice Task／Send Dispatch／Result Parser | Workbench AI Application入力→一依頼の外部送信確認→内容Hash付き許可済み読取り投影→Coordinator Mode Router→専用Dispatch→依頼種別別Executor→許可済み参照へ拘束した結果正規化 | N/A | 読取り助言、変更候補、既定CatalogのRevision 0、負数・小数の不正Revision、不正種別、余分なKey、送信未確認、Effect前取消、Effect後取消競合、Provider例外、cleanup不明、未知Request ID、投影Hash不一致、秘密Prompt、越境参照、Repository Operation結合不能、Mount Grant発行時観測と消費直前fresh観測、再観測不能、初回Selection失効失敗、不正な再Selection、Selection意味差、根拠参照なし・投影外参照・重複Key・複数JSON・過大値を含む不正入力／結果 | 固定投影、検証済みProfile、Catalog Revision、Fake Provider Adapter、Fake Executorおよび生結果文字列を注入し、Execution Plan、Task Packet生成、Repository Operation結合、Authority消費、初回Selection、Mount Grant発行、Provider Home再観測、Grant消費、旧Selection失効、Effect直前Selection再発行、Packet発行、Recovery登録、Process開始、観測、取消、Grant失効、Operation cleanup、単一JSON正規化および不正結果の帰還を要求する。Repository StoreからConsumerまでのRevision 0搬送は`RCM-IT-005`で補完する | 選択Executor、Profile ID、Provider、Catalog Revision、依頼種別、送信確認、投影Hash、Task Hash、許可済み参照、Request ID、Repository結合、発行用観測Capabilityと消費用fresh観測Capabilityの分離、Grant失効件数、Grant消費件数、初回／再発行Selection、Packet／Recovery／Processの発行件数、Effect件数、cleanup件数、Process poison件数、状態、理由、結果区分、項目別根拠参照および生出力非公開を記録する | Revision 0は検証済み既定Catalogの初期Snapshotとしてexactに保持し、負数・小数は実行計画前に拒否する。読取り助言Operationを元Repository Identityへ結合できなければSelectionを発行しない。この結合からProvider Mount、Path搬送または任意読取りAuthorityを生成しない。初回SelectionをProvider／ProfileのMount照合前に発行し、Mount Grant消費後に失効する。同じ入力からEffect直前に再発行し、Provider、Profile、Model、推論強度、速度および選定理由が初回と完全一致する場合だけPacketへ進む。発行済みSelectionは意味検証前からcleanup対象として保持する。不正な再Selectionまたは意味差では新旧Selectionを失効し、Packet／Process／Provider Effectを0、Operation cleanupを1とする。初回Selection失効が再試行後も不成立なら、Operation cleanup成功だけを全体cleanup成功へ畳まずProcessをpoisonする。Mount Grant発行に使った一回限りの観測Capabilityを消費時に再利用しない。fresh再観測が不成立なら、未消費Mount Grantと初回Selectionを各1回失効し、Grant消費、Packet、Recovery、ProcessおよびProvider Effectを0、Operation cleanupを1、Process poisonを0にする。送信確認は同じTask Hash、Catalog Revision、Profile ID、Providerへ結合して一回だけ消費し、未確認・Effect前取消ではProvider Effect 0、Effect後取消・Provider例外・cleanup不明では自動再送0かつunknownとする。読取り助言と変更候補を別Executorへ一回だけ配送し、取消後の遅延完了でcancelledを上書きせず、未知Identityへ架空ProfileまたはModeを返さない。各結果項目は本文と一件以上の許可済み根拠参照を持ち、曖昧JSONや不正結果を部分公開しない | ERB-UT-023、固定入力分類、Catalog Revision境界、投影完全性、Task Packet、Repository Operation結合、Authority Scope、Grant発行用観測と消費用fresh観測、初回／再発行Selection、選択Executor、公開Snapshot、不正結果分類、許可済み参照集合、Grant失効・消費、Packet、Recovery、Process、Provider Effect、cleanupおよびProcess poisonの件数とOracle判定を保存する。Prompt、投影本文、Repository Path、AI結果本文および生Provider出力は保存しない | Fake Provider以外の外部Effect 0、Repository結合不能時のSelection 0、再観測不能時の未消費Mount Grant失効1、初回Selection失効1、Grant消費0、Packet発行0、Recovery登録0、Process開始0、Provider Effect 0、Operation cleanup 1、Process poison 0、不正再Selection時の新旧Selection失効2、初回Selection失効継続失敗時のcleanup未確認とProcess poison、Filesystem Effect 0、候補生成0、候補採用0、自動再送0、取消後状態上書き0、不正結果の部分表示0、生Provider出力公開0 | Automated |

`ERB-IT-004`の本番隔離入口は、上位からのCLI・環境・OS指定、未知field、Proxy、Accessorをgetter／観測前に拒否する。公開Factory実本文から実Candidateへ接続し、最下位だけの模擬で正常要求列、初回CLI観測失敗、同snapshot再確認失敗、環境不明と短期cleanup時の再確認を検証する。CLI二理由を区別し、環境例外を同じ例外のまま保持、不明時の新Process0と取得済みconfigの回収を確認する。CLI／Engine／最小環境／Process終端方式は独立した固定期待で照合する。この局所接続を実Docker・Host全体の成立へ昇格しない。

`ERB-UT-023`のDocker技術計画断面は、既存命名の全文、二namespace、小文字64hex Identity、suffixとlabel、63／64文字境界、乱数Bufferの7／8／9・31／32／33byteと取得例外の同一性を確認する。旧上位UT一件をDIの既存Suiteへ移し、新Local Itemは作らない。上位`PRL-UT-014`では両Providerの実準備→消費から取得列`[8,32]`、五名・labelと九commandの搬送を照合する。最初の不正Bufferでも二度目取得を維持し、取得例外以後は取得しない。不成立時は取得済みMount返却1・Authority発行0・Docker要求0を確認し、Mount取得前へ処理順を変えない。純粋計画の成功は実Docker成立を意味しない。

`ERB-UT-023`では、Workbenchの明示AI実行をSelection不要の`none`へ畳まない。`beneficial`／`explicit_user_delegation`、明示Provider／Profile、Coordinator役割およびOperation Identityを要求fieldとして検査する。Productionが生成した初回・再発行要求を実Selection Runtimeへ直接渡し、旧Grant失効、新Grant消費およびProvider準備境界まで確認する。Mockが発行済み結果を返すことだけをProduction契約成立の根拠にしない。

`ERB-UT-023`の助言初期化失敗では、下位作成境界の清掃確認true／false、分類のない例外および取得済み参照あり／なしを分ける。Operation未返却だけで清掃未確認へ読み替えず、既知trueは維持、false／未知は停止とする。初回Runtime結果の私有分類、元結果Objectへの結合、copy後の非結合、公開JSONへの参照非漏えい、Provider開始0およびpoison要否を観測する。これは現在Process内の初回結果までの契約であり、後段投影・Request Owner・fresh Process再入場、実資源不存在または実清掃成功の証明にはしない。

`ERB-IT-021`のNode実行閉包ケースでは、Workbench CLI入口とRuntime value import／re-export／literal dynamic import Graphを固定入力とし、type-only参照を実行依存へ数えず再帰走査する。到達Source、外部module specifier、`.tsx`および`client/`到達を観測し、Serverへ到達する一方でBrowser描画Module、`.tsx`、`client/`および`react`／`react/*`への到達が0であることをOracleとする。Evidenceには固定Tree、入口、到達Source集合Hash、外部module集合、除外したtype-only宣言数、禁止到達件数およびOracle判定を保存し、Source本文と絶対Pathは保存しない。

`ERB-IT-021`のBrowser Bundle配布閉包ケースでは、再編後の`40_Develop/workbench-server/dist/client/assets/workbench-client.js`を固定Pathとし、次の段階を分けて確認する。BundleはWorkbench配布物の入力であり、Coordinatorの署名実行閉包へ無条件に含めない。以下は新配置に対する検証計画である。旧配置でのBuild成功は過去の根拠として保持するが、新配置の成功へ流用しない。

| 段階 | 条件・操作 | 観測 | Oracle | 現在状態 |
|---|---|---|---|---|
| 1. Build／Git追跡 | Vite Buildを実行し、固定Pathの生成物とGit追跡集合を確認する | Build結果、固定Pathの存在、`git ls-files`の収載、追跡Bundle差分 | Build成功、固定Pathが通常Fileとして存在し、同じPathがGit追跡対象であり、再Build後に意図しない差分がない | OPEN — 新配置への移管後に確認 |
| 2. Source Commit収載 | 固定候補CommitのTreeを確認する | Commit、Tree、固定PathのBlob | 固定Pathが配布元のSource Commitへ収載されている | OPEN — 移管Commit後に確認 |
| 3. Workbench配布物収載 | 固定Source Commitから提供するWorkbench配布集合を確認する | Source Commit、固定Path、Asset Hash、配布集合 | 配布集合にSource Commitと同一の固定Bundleが存在し、起動時Buildや未追跡追加を必要としない | OPEN — 新配布集合で確認 |
| 4. 配布Runtime直接起動 | Build Toolchainを持ち込まず、Workbench配布入口を起動する | Runtime import Graph、HTTP起動、Shell／Asset応答、終了後Listener | Node RuntimeがReact／Viteへ依存せず、固定Bundleを配信して直接起動でき、終了後Listenerが残らない | OPEN — 新配布入口の直接起動で確認 |

Evidenceには各段階のCommit／Tree、固定Path、Asset Hash、Git追跡判定、Runtime外部module集合、HTTP応答、終了後状態およびOracle判定を保存する。Source本文、絶対PathおよびBundle本文全量は保存しない。前段Passから後段成立を推定せず、旧署名候補を新しい配布閉包の根拠へ流用しない。

初回起動期限後にDocker Processが残存する実環境反例では、`ERB-ST-009`は停止前のEngine Probe TimeoutをEngine停止と同一視せず、既知2領域のexact lockとProcess集合を継続入口で確認する。同じRepair ID内で停止意図を耐久化し、停止Effectを一回だけ発行して、Engine既知停止とProcess不存在をfreshに確認した後にだけ二領域退避へ進む。既に不存在なら停止Effectは`not_issued`で閉じる。Engine状態不明、部分停止、観測不能、取消またはIdentity不一致ではrenameと再起動を0件にし、条件別理由と同じ回復義務を保持する。旧形式の3 Effect継続記録は、成立済み段階を再発行せず現行の4 Effectモデルへ読取り投影できることも検証する。

`ERB-ST-022`の機械観測部分は、[Phase 5 Workbench実Browser Visual Gate](../../../99_Roadmap/Changes/CHG-000082/Evidence/260928-1028_phase5-workbench-actual-browser-visual.md)で15画面、3表示Profile、3 Zoomの27条件を不適合0・許容例外0で完了し、[純粋CSR移行](../../../99_Roadmap/Changes/CHG-000082/Evidence/260928-1745_phase5-workbench-pure-csr.md)で全画面DOMのBrowser React所有への移行後も同じ27条件を再観測した。人間UAT、実Provider E2EまたはShared Server配置の成立へは読み替えない。

公式CLI移行では内部改造024～029の成立を現行保証として要求しない。公開配布と起動は031、通知分類は023、公開取消・親喪失と終了後資源は030で確認する。公式設定だけを操作不存在の証明にせず、Docker境界の観測と実Provider E2Eを別々に保持する。

`ERB-UT-016`の状態確認は、両Providerの終了0／1とAI Adapterが認識する正規未ログイン出力を組み合わせて、`completed / unconfirmed / authenticationConfirmed:false`を返すことを確認する。Codexのstderr通知と既存の固定read-only警告、ClaudeのJSON否定と空stderrを同じ結果へ変換する。終了1の肯定出力・未知stderr、他の終了値、終了欠測、不正・曖昧・混在出力、起動失敗、Signalは確認不能として拒否する。取消・Process終了不明・回収不明は確認完了にせず、既存回復参照を保持する。loginの非0とTask実行許可にはこの受理条件を適用しない。生Provider出力・資格値・認証期限の推測を結果へ追加しない。

`ERB-IT-002`のClaude助言Turn数拒否では、項目欠落、null・boolean・文字列・配列・Object、0・3・小数を与え、固定理由とcleanupを維持したまま`turnCountDiagnostic`の型名と数値表記だけが一次失敗へ残ることを確認する。`ERB-IT-003`では既存状態の実Validatorと履歴JSON往復へ接続し、用途・段階・理由・終了0との相関、閉じた型名、正規化済み最大32文字の数値表記を照合する。検証Toolの既存Process観測試験でも同じ正常値と不正反例を搬送し、生出力・任意文字列・余分field・有効範囲1〜2・不正相関を拒否する。受理条件、取消・回収、実AI未実施の境界は維持する。

## Semantic Coverage Pilot

この表はQuality Local Itemが検証する設計上の意味だけを正方向で宣言する。逆方向の一覧は生成し、本文の類似表現から推測しない。

| Local ID | Semantic Key |
|---|---|
| `ERB-ST-005` | `coordinator.external-boundary-diagnostics` |
| `ERB-IT-006` | `coordinator.provider-selection-boundary` |

## 5. 段階的結合と評価

固定Fakeによる状態遷移、実CLI／Processとの直接境界、関連1〜2 block、必要な公開入口STの順で確認する。低い層のPassを実AI Provider、実Network、課金、公開Capabilityの成立に流用しない。

旧General Task検証の取消・終了義務はWorkspace方式へ移す。既存`EST-ST-003`と`PRL-ST-001/003`における取消ACKとcompletionの分離、遅延・重複Signal、join不明、Source前後照合、元回復参照は維持する。上位Toolの作成済みUUIDは、開始throw・結果欠測・Workspace結果欠測でも未作成扱いにしない。Task終端・cleanup・未解決回復なし・元対象一致を確認できない場合、Worktreeを保持して回収未完了を返す。Task一次失敗とWorktree終了失敗は別に観測する。

共有Native／Kernel Lockの`ERB-IT-003/004`は保持する。Store専用の保護Root種別3・受付・専用排他だけを撤去し、Provider Homeの種別1/2とRuntime Stateの種別4、共通Worker、Host／Console／Provider／Stateの取得・解放・親Process喪失を確認する。旧値3は実CLIでも初期化前に拒否する。旧Store専用試験の退役を成功件数へ加算せず、実Docker・実AI E2Eは今回の局所確認と分ける。

PT／LTは人間が明示した上限と停止／cleanup条件をrunnerが強制できる場合だけ実行する。

## 追加試験種別の適用

| 種別 | 適用 | 確認する範囲 | 実行許可 | 未実行時の扱い |
|---|---|---|---|---|
| RT | Required | 変更した意味と利用側から、再実行する既存Local Itemを選ぶ | Changeの通常検証範囲 | 未選択の範囲を明示し、選択した回帰の結果で評価する |
| PT | Conditional | 対象、負荷上限、費用／Credit上限、中止条件および清掃条件を事前に固定した場合だけ設計する | Human Explicit Authorization | 未実行をPassへ読み替えず、明示的なRelease条件でない限り通常監査を停止しない |
| LT | Conditional | 対象、継続時間、資源／費用上限、中止条件および清掃条件を事前に固定した場合だけ設計する | Human Explicit Authorization | 未実行をPassへ読み替えず、明示的なRelease条件でない限り通常監査を停止しない |


## UI／SPEC Detailからの観測条件

Source Definition由来の検証義務を維持し、Detailは具体的な観測境界として同じ検証目標へ統合する。

| Detail Source | Source Definition | 追加する観測条件 | 処置 |
|---|---|---|---|
| [SCR-000005／PRT-000005](../../../04_UI/Details/Areas/operation/SCR-000005/screen.md) | UI-000005 | 情報、操作、Feedback、状態、失敗、Unknownおよび回復をScreen／Part境界で観測する | Mapped |
| [SCR-000010／PRT-000010](../../../04_UI/Details/Areas/configuration-trust/SCR-000010/screen.md) | UI-000010 | 情報、操作、Feedback、状態、失敗、Unknownおよび回復をScreen／Part境界で観測する | Mapped |
| [BHV-000009](../../../05_SPEC/Details/BHV-000009/behavior.md) | SPEC-000009 | Trigger、Authority、Validation、State、Effect、Result、FailureおよびRecoveryをBehavior境界で観測する | Mapped |
| [BHV-000015](../../../05_SPEC/Details/BHV-000015/behavior.md) | SPEC-000015 | Trigger、Authority、Validation、State、Effect、Result、FailureおよびRecoveryをBehavior境界で観測する | Mapped |

担当Interaction Relation: `PRT-000005.spec-000009`、`PRT-000010.spec-000015`

全数Coverageと試験段階の扱いは[UI／SPEC DetailのQuality分析](../../Analysis/Detail/quality_analysis.md)を中央統合投影とし、本定義は上記Relationの検証責務を局所所有する。

## Host残存の限定回復に追加する観測条件

[Coordinator詳細設計§11](../../../06_Architecture/Details/coordinator/01_Architecture.md#元の回復参照を確定できないhost残存の保守候補)の限定経路は未完成である。内部PolicyのUTとは分け、次の既存検証義務に観測条件を追加する。記載だけでは実施済みまたはCoveredとしない。

| Local Item | 追加する反証・観測 | 終了後条件／現在状態 |
|---|---|---|
| `ERB-IT-001` | 選択ユーザー・Root・marker・全六childのexact結合、処置前のfresh再確認、限定削除と直接不存在観測。 | 全対象の明示不存在と全handle／observer／Lock解放を別々に確認する。OPEN: 実処置未接続。 |
| `ERB-IT-002` | Identity差替え、非空child、未知child、別状態、Docker結合、使用中、初期化中および承認不一致。 | 処置前の拒否ではFilesystem／Provider Effect 0。OPEN: 実境界の拒否未観測。 |
| `ERB-IT-003` | 部分清掃後のProcess喪失と同一対象への再入場。新しいfresh承認と保護済みlineageを検証し、既に処置済みの対象を別物へ置換しない。 | 発行済みEffect、残存対象、回復義務を保持する。OPEN: 保護済み再入場未接続。 |
| `ERB-IT-004` | 旧形式のproducer／consumer観測が不完全、Lockだけ取得可能、markerだけ存在、非使用・不存在観測不能。 | unknownを非使用・不存在へ畳まず、追加Effect 0で停止する。OPEN: 実観測未接続。 |
| `ERB-ST-030` | 将来の正式入口で、同じ実残存クラスを安全なfixtureとして発生させ、対象提示→承認→fresh確認→処置→最終観測を相関する。 | 新Provider依頼とDocker永続データ削除0。全資源不存在またはexactな回復義務を保持する。OPEN: 公開入口未接続。 |
| `ERB-UAT-007` | 元Taskの回復権限と新しい限定保守承認の違い、実在対象と対象外、拒否時の理由を利用者が理解できるか確認する。 | 承認だけを実行・清掃完了へ表示しない。OPEN: 利用者確認未実施。 |

Coordinator所有範囲で終了・排他・清掃を閉じる設計では、上表の既存Local Itemへ次を追加する。Windows再起動やDockerの空一覧を合格条件の代替にしない。

| Local Item | 所有範囲方式の追加観測／反証 |
|---|---|
| `ERB-IT-001` | 作成前の利用抑止から、所有処理の実終了、同じ対象の排他、処置と不存在確認、全Lock／handle解放までの順序を観測する。現在は未接続。 |
| `ERB-IT-002` | 初期化中、診断・通常回収の競合、取消後の遅延取得、所有子Process残存、対象外Processの巻込みを別に反証する。処置前に拒否し、既存の他Operationへ停止・削除を発行しない。 |
| `ERB-IT-003` | 親Process喪失、利用抑止または排他喪失、部分処置後の再入場を確認する。前回の非使用結果を再入場時のfresh観測に流用しない。 |
| `ERB-IT-004` | 新しいLock導入後も旧形式を使える旧版／複製Runtime／別入口の未確認があれば停止する。Process名・件数0、空Root、Docker資源なしまたはhandle取得だけを非使用根拠としない。 |
| `ERB-ST-030` | 公開入口へ接続する段階で、上記の取得・診断・通常回収・保守の母集団が同じ所有境界へ接続しているか確認する。OS全体の再起動や全Docker処理停止を暗黙に要求しない。 |
| `ERB-UAT-007` | Coordinator所有の対象だけを提示し、元Taskとの対応が不明でも出所不明の任意フォルダと混同させない。実停止や削除には別の対象・影響確認が必要と理解できるか確認する。 |

### 終端記録の保存・再入場で追加する反証

対象一式の私有Readerは[Platformの読取り契約](../../../06_Architecture/Details/platform-access/01_Architecture.md#対象一式の私有読取り接続)に従う。`ERB-IT-001`でnamespace三実体＋Root／marker／固定六childの十一実体、元marker全bytes／EOF／前後長とHash、独立Known照合、新八handleの逆順終了を確認する。`ERB-IT-002`で全位置の各五field・属性、全pair重複、種別／reparse、名前と利用者・Hash差、八取得位置の欠落、markerの0／65536／65537bytesを反証する。`ERB-IT-003`で途中取得・読取失敗とclose不明の併発、元理由・位置・取得数・個別終了保持、追加保存停止を確認する。実OS刺激と合成終了モデル、現在観測と独立期待値、対象Reader終了と外側guard／Process終了を分ける。既存8KiB記録Readerへの影響は同じ改訂版の実保存回帰で確認する。現在観測は原子的Snapshot、空状態・未知child不存在、非使用、`host_only`意味、正式承認または清掃成功を保証しない。Local Item数・全体観測数・品質状態は維持し、属性なしcodec、初期化、全legacy互換、公開Protocolと実残存処置は別の未成立条件として追跡する。

固定保存境界の私有観測では、`ERB-IT-001`にOS所在候補と独立fixture親の一致、三実体・二ACL・選択利用者の結合、保持後verifyと個別終了を接続する。`ERB-IT-002`で三位置の各五field、重複実体、利用者Hash、recovery／terminalそれぞれの欠落・file／reparse・ACL、返却長とUTF-16を反証する。`ERB-IT-003`ではToken部分取得、途中openとclose不明の併発、元理由・各個別終了の単調保持と追加保存停止を確認する。純値検査、実体試験、実OS故障は別に記録し、未観測の位置を合格へ畳まない。一般利用者Profileが必要な実体試験は制限Token環境で受理条件を弱めず、固定Ownerの通常利用者実行と分ける。Local Item数・観測済み件数・全体品質状態は変更しない。

[Coordinator詳細設計の候補契約](../../../06_Architecture/Details/coordinator/01_Architecture.md#終端記録の保存再入場の候補契約)について、通常清掃と元参照不明の限定保守を別producerとして確認する。次は検証設計の追加であり、実施済み結果ではない。

Nativeの共通排他では、`ERB-IT-001`の同threadでの取得・fresh保護・同期区間・release／close、`ERB-IT-002`の再帰取得、別thread／別Process競合、属性・日時差による別排他への逃避、descriptor不一致・同名別object・有限timeout、`ERB-IT-003`のabandoned所有取得と保存拒否・終了不明の単調保持を分けて観測する。実OS反証と注入した失敗は区別する。これらの排他区間だけでは容量計数・全producer・公開入口・旧対象の非使用は成立しない。Local Item数と観測済み件数は変更しない。

処置許可直前のAtomic判定について、判定前に別threadが終端不明を確定した場合はcallback0と取得済み所有のrelease／closeを確認する。判定後の不明は既許可処置の取消にしない。取得／処置Errとrelease／close不明の同時発生では、元の固定理由・終端理由・発行receiptを共同保持する。cfg(test)の順序制御と合成終端失敗を、実OS故障発生の証明へ昇格しない。

容量と保存の一体接続では、`ERB-IT-001`でMutex内の列挙→完全計数／全観測終了→予約→stage→公開照合→writer終了→Mutex終了の順序と正常終端後の再計数を確認する。`ERB-IT-002`で同参照既存、未知名、Directory／reparse、公開0byte、過大file、保護・共有拒否、途中列挙不明、上限・overflowを反証する。0byte stageと同実体の併存二名は物理名別に計数する。`ERB-IT-003`では各終了不明と公開失敗の組合せ、同参照・部分receipt・元原因の共同保持、追加保存停止を確認する。純境界Helperを実保存本体でも使い、少数の実列挙・保存と1024entry／8MiBの純判定を分ける。大規模物理列挙、合成close故障、unwind、非参加producer・別session・公開consumerの未観測を合格へ畳まず、Local Item数・観測数は変更しない。

| Local Item | 刺激・観測 | Oracle／終了後条件 |
|---|---|---|
| `ERB-IT-001` | 固定保存境界、Windows所有者／アクセス制御、処理中の差替え防止、完全書込み・flush・no-replace公開・両名の同一実体／bytes確認を実境界で観測する。 | 呼出し成功やmode値を保護・確定の代替にしない。stageを直接不存在へ収束してからRoot処置へ進む。未確認は追加Root／marker処置0。 |
| `ERB-IT-002` | 公開先EEXIST、保護不明、別Identity／bytes、未知entry、8KiB・1024entry・8MiBの各境界、stage二名の計数と並行受付を別に与える。 | 既存対象上書き0、別参照再発行0、容量超過0。既存参照読取りは可能だが、新記録を要する回復Effectは上限を迂回しない。候補値は実装固定前に再確認する。 |
| `ERB-IT-003` | 最初の記録Effect前、stage途中、flush後、公開直後、read-back後、stage除去後、Root部分処置後、marker消失後、lease終端不明でProcess喪失／取消を与える。 | callerの耐久接続から同じ参照へ再入場できる。stageのみ／同一実体二名／公開先のみ／不一致を区別し、fresh権限・対象・非使用・排他なしには追加処置しない。Power lossをこの結果へ含めない。 |
| `ERB-IT-004` | 通常producerの元exact関係と、保守producerのsnapshot／保守選択Identityを取り違える。旧Token／旧nonce復元、別leaseだけによる非使用主張を反証する。 | 記録からAuthority発行0、元Task再開0。元参照不明を新しい自動回復許可へ畳まない。 |
| `ERB-IT-003` | Root・marker・leaseの共同終端後に、Evidence引渡し失敗、Receipt不一致、参照中、記録清掃の部分成功／観測不能を与える。 | 引渡し先の実bytes・Identity確認前は原記録削除0。清掃不明は同じ管理対象へ残し、元Task再開や清掃記録の再帰生成0。原記録／stageの直接不存在と管理用資源の終端を確認する。 |
| `ERB-ST-030` | 全利用側移行後、公開入口の失敗結果から耐久参照、再入場、共同終端、Evidence引渡しへ追跡する。 | marker消失後も許可された利用側へ同じ非Authority参照を返す。境界外には対象の存在・参照を開示しない。内部試験だけで公開経路の成立を宣言しない。 |

現在は全行OPENである。実装上の発生点と観測手段を固定してから実境界へ接続する。局所のSchema／順序試験は`PRL-UT-006`が所有し、ここで求める保護・Filesystem・Process喪失・公開入口の成立を代替しない。




`PRL-UT-006`の保存搬送Caseは、十一Known値・本文・nonce・同参照の要求形状、応答の完全性と上限、計数・公開・Mutex／writer／外側closeの共同成立、および部分保存receiptの保持を合成入力で確認する。Native保存区間の実target差替え、実close故障、返却喪失、正常保存と同参照再入場は接続確認で別に観測する。Source接続や拒否試験を全RecoveryのPassにしない。

同じLocal Itemの読戻し搬送Caseは、Prepared／Publishedの現在観測、同bytesの別実体を過去Identityへ昇格しないこと、対象未試行、nonce・同参照・完全形状の拒否、およびReader／外側close不明時の部分結果保持を合成入力で確認する。`ERB-IT-001`の専用CLI拒否Caseは不正要求・保存mode混用・余分argvを実childで拒否し、記録取得・対象取得・変更なしを観測する。caller結合Caseは完全文書・独立bindings・前後再確認と未検証実行Contextの拒否を確認する。正常なNative読戻し、Root消失後の実再入場、非使用・承認・限定清掃は経路全体の実境界確認へ残し、これらの局所結果から観測済み件数や全Recoveryの合格を更新しない。

`windows::terminal::tests::terminal_publication_fixture`は、[Native内部保存部品](../../../06_Architecture/Details/platform-access/01_Architecture.md#host終端記録の内部保存部品)の現在のpublish本体を自己生成したRepository-local対象で通す限定ITである。`ERB-IT-001`の完全write／flush、同writer保持中の非置換rename、stage直接不存在、public実体・ACL・全bytesと個別close、`ERB-IT-002`の既存先衝突・前後不変、重複要求拒否、8192／8193bytesと保持中変更拒否を対象にする。通常のcargo testからはignoredとし、専用Ownerが固定cwd、入力とbinary Hash、freshなfixture不存在を確認して一回だけ実行する。新run・新閉packetへ部分receiptと個別closeを搬送し、自己生成三fileと空Directoryの非再帰清掃・直接不存在を別に確認する。途中失敗では追加清掃せず保持して停止する。

このfixtureはNativeのopaqueな非秘密bytesの保存を検証し、上位Schema、元Task Authority、非使用、caller耐久性、容量、固定OS namespace、Process喪失／再入場、旧二名の移行、close後不変性または署名Runtime／公開入口を検証したことにはしない。stage不存在は観測時点の事実であり、後続の新規作成禁止にしない。旧r1／r2／r3のhardlink結果は履歴として保持し、新rename結果へ付け替えない。未観測は保持し、この登録からLocal Item全体やQuality件数を観測済みへ更新しない。

初回の保存・公開fixtureは失敗し、全Oracleは未成立である。専用の読取り診断は残った三fileの現在Identity・ACL・全bytesと明示closeだけを確認した。続く第一stageの保持診断は、write-open、DELETE-open、removeと非置換renameの四要求がerror32で拒否されたこと、および診断handleの明示closeを確認した。公開名側の保持中拒否、既存先衝突、過大入力の作成前拒否、四file清掃と初回失敗原因はこの診断から推定しない。結果は[限定保守の検証記録](../../../99_Roadmap/Changes/CHG-000082/Evidence/261002_host-orphan-recovery-design.md#保存試験r1の停止と診断)に接続し、全保存・公開fixtureをOPENのまま保持する。

構造化したr2の全局所試験では、公開名のDELETE access取得を拒否できない反例を検出した。予想外handleは明示closeされ、削除・改名・清掃は未発行だった。失敗段階、個別close、清掃発行数、現在の残存を保持し、総合closeを成功へ補完していない。公開名の保護を是正・実証するまで、保存部品全体のPass、既存三Rootの清掃および実Task再開へ進めない。

公開名の追加read guardで是正したr3は、同一Processの自己生成対象で両名の四拒否、既存先非置換、入力境界、個別closeと限定清掃後の直接不存在を局所確認した。r3の実行時は自己確認結果として記録した。同じ固定候補の限定独立確認結果は検証記録に接続し、Local Item全義務の成立とは区別する。guard取得前の候補公開を連続した名前保護へ昇格せず、取得不能・差替え・消失は同じreceiptに残してRoot／marker処置0とする。別Process、取得前の競合、caller再入場、stageの連続保護付き除去および本番接続はこの結果に含めない。Local Item全義務と品質件数は未観測を維持する。

既存三件に対する実処置承認は未取得であり、試験fixtureを理由にその領域を削除しない。Local Item数と観測済み件数はこの設計追加では変更しない。

`windows::terminal::tests::terminal_cold_observation_fixture`は、準備済みreaderと公開済みwriterを持つ別Workerの意図的Process終了後、親が同じ既知参照・五field／属性・ACL・全bytesをfreshに照合する限定ITである。期待exit 71／72とexact Process／Job終端を共同条件にし、timeout後の回収成功を期待終了へ読み替えない。二名、両不存在、内容・Identity不一致とDirectoryを拒否し、reader保持中のwrite／delete／remove／rename拒否、今回checked-closeと自己生成四file・二Directoryの非再帰清掃後不存在を別観測にする。

このfixtureは`ERB-IT-001`／`ERB-IT-002`と、`ERB-IT-003`の「意図的終了後の既知完全記録の再読取り」という限定区間だけを扱う。cfg(test)のwriter再取得は本番APIではない。metadata不明とclose結果の単調保持は、実readerが使う局所判定関数への合成入力で確認し、実OS故障とは別fieldにする。ACL異常、reparse、OS metadata失敗、実CloseHandle失敗、突然crash、rename途中、caller耐久再入場、初期化途中、署名Runtime／公開入口と実残存三件は未観測のまま保持する。Local Item全体、品質件数と停止Gateは更新しない。

`windows::terminal::tests::terminal_current_candidate_fixture`は、新しい自己生成対象で私有の現在候補readerを通す限定ITである。`ERB-IT-001`のprepared／publicの現在照合・保持中変更拒否・今回close、`ERB-IT-002`の二名／両不存在／内容／Directory／参照／byte容量拒否、`ERB-IT-003`の「同bytesの別実体を過去の元実体にしない」という区間だけを扱う。同じfixture名を再利用せず、固定Ownerがcwd・実入力・新binary Hash・fresh不存在を確認して一回実行する。

現在候補は旧Identityを入力しない。試験では独立した作成時IdentityをOracleだけに使い、同bytesの新実体を現在候補で観測しても、旧Identityのstrict readerが拒否することを確認する。意図した自己生成fileの改名・再作成は刺激として個別記録し、保持中の予想外変更と区別する。全Oracle・全closeの後だけfreshに照合した自作六fileと空二Directoryを非再帰清掃し、直接不存在を確認する。失敗／不明では追加清掃しない。

これは同一Processの現在観測とopaque bytes相関だけである。正規Schema／producer／対象binding、元file連続性、過去receipt、caller耐久再入場、別Process、ACL異常／reparse／OS観測故障／実close失敗、容量予約、Authority、実残存三件または全Recoveryを検証済みにしない。Local Item数・観測件数・停止Gateは維持する。File Relationの既存001／002／003と新Case／HelperのTrace和集合を別に照合する。

`ERB-IT-001`のNative CLI確認へ、専用`--host-terminal-observe`の不正要求、余分argv、標準modeとの混用拒否を接続する。専用不正入力は実exit 2・phase 1・取得0・stderrなしを観測する。この拒否試験は、正常な十一実体観測、署名配布物、回復Ownerの実呼出し、清掃または全Recoveryを証明しない。

`windows::terminal::tests::terminal_generation_exclusion_and_release`は、`ERB-IT-001`の実Windows排他境界を限定確認する。freshな自己生成UUIDだけを使い、同世代の重複取得拒否、別世代の独立取得、同handleの選択利用者／SYSTEM二ACE保護と解放後の再取得、全所有handleの明示closeを観測する。Filesystem、実残存、DockerとProviderへ接続しない。既存Node／Supervisorとの相互運用は次の専用Caseへ分離する。当初Processの終了、旧領域の非使用、最終処置の連続排他、署名Runtimeと回復経路全体は別の未成立条件であり、この局所確認からLocal Item全体やQuality集計を完了にしない。

`windows::terminal::tests::terminal_generation_node_interoperation`は、`ERB-IT-001`のNativeと同期Node Worker／非同期Supervisorの相互運用を確認する。Nodeの既存production Lockを[専用fixture](../../../40_Develop/coordinator/tests/fixtures/host-terminal-generation-worker.ts)から呼び、両経路でNative保持中のNode拒否、Native解放後のNode取得・解放、Node保持中のNative拒否、Nodeの明示解放・実Process終了後のNative再取得を順に観測する。Supervisorは本番の取得関数・往復確認・exit確認付き解放を使い、独自の代替Lockへ切り替えない。固定Node実行物のHash、通常のfile起動、最小環境、fresh UUIDと固定応答を使い、未知応答・終了失敗・解放不明を成功へ補完しない。fixtureはNative試験の支援資源であり、Node runnerの独立した検証項目へ数えない。

この試験はSupervisorの異常終了・IPC故障、旧版consumerの再入場抑止、親Process喪失、実close故障、OS保存namespace、旧三件の非使用、最終処置の連続保持および公開Recoveryを検証したことにはしない。Local Item数・全体の観測済み件数・停止Gateは維持する。

`windows::terminal::tests::terminal_disposition_fixture`は、`ERB-IT-001`／`ERB-IT-002`のOS意味を実測するcfg(test)の限定試験である。固定Repository-localの自己生成親・Root・六child・markerだけを使い、親guardとfreshな同世代排他を保持して、通常`FileDispositionInfo`の要求受理、対象handle明示close、直接不存在を区別する。非空childの拒否と、互換readerが残るmarkerを不存在にしない反例を含む。Root不存在→marker不存在→世代解放の順を確認し、成功時だけ自作の空親を非再帰清掃する。途中失敗では取得handleの終了を試し、自作物を保持する。通常cargo testからはignoredとし、固定cwd・run指定・fresh不存在を確認したOwnerだけが実行する。

この実測はAPIの適用可能性の確認であり、本番の最終処置、未知child全数照合、旧三件の非使用・削除、固定OS namespace初期化、承認Owner、署名Runtimeまたは公開Recoveryを成立済みにしない。必要なLocal Item数、品質集計と停止Gateは維持する。

### 既知7バイトfileの同handle観測（移管前の局所記録）

この小節と直前のterminal fixture群は移管前の局所観測・未観測範囲を記録する比較基準である。「署名Runtime未成立」は当時の方式についてのみ述べ、現在の通常Runtimeの停止条件にはしない。現在の検証では、未署名固定入口・必要Nativeの同一性、用途別許可、実搬送、元の保存／読戻し・排他・取消・終了後不存在を独立に観測する。過去の成功や署名拒否をその新経路の根拠へ流用しない。

`ERB-IT-001`で、検証・保持したworkspaceと祖先から固定`fixture.txt`をshareREADで開き、同handleのdisk種別・非Directory／非reparse・リンク数1・7bytes・全bytes／EOF・固定Hash・前後Identityを確認する。Known再照合、観測失敗後の初回close、親guard終了と自作対象の直接不存在を別々に観測する。`ERB-IT-002`で欠落、Known実体差、7bytes内の異内容、6／8bytes、hardlink、既存write／delete handleとの共有競合、Directoryとreparseへの代替を反証する。reparse作成不能の場合は理由と未観測を残し、拒否済みにしない。

`windows::terminal::tests::terminal_known_file_fixture`は固定cwd・run・freshなRepository-local自己生成対象に限定した局所ITである。通常のcargo testではignoredとし、明示Ownerが一回実行する。互換readerが存在しても観測が成功する反例を含め、その成功を非使用証明にしない。保持fileのReaderを終了した後の値は、将来の清掃まで連続保持した根拠ではない。十二実体共同観測と専用Protocolは次の対象一式のCaseで別に確認し、保存・読戻し、旧三Rootの非使用、fresh承認、最終処置・公開Recoveryの義務は未成立のまま残す。

`windows::terminal::tests::terminal_target_fixture`の既知file区間で、九対象handleの同時保持、十二実体Current／namespace-Knownの専用応答、独立した全十二対象Knownの共同照合と個別closeを観測する。十二位置の六field、選択利用者、marker Hash、file長・リンク数・Hashの77差替えは、位置・元理由・九対象closeを保持して拒否する。file内容差と欠落も位置11で拒否する。Knownの比較は対象handle終了前に行い、読取り成功・全closeを未知entry不存在、非使用、保存済み、最終清掃の連続保持へ昇格しない。対象一式の自作物だけを清掃し、現在不存在を別に確認する。通常cargo testでのignoredと、固定Ownerによる実行を区別する。正常なCoordinator→Native搬送、R3保存／読戻し／caller接続、実残存回収と署名RuntimeはこのCaseの対象外である。

`ERB-IT-001`の専用CLI拒否Caseでは、十二実体の保存／読戻しmodeへ旧frame、欠落frame、逆modeおよび余分argvを実Processで渡す。正形状でも独立本文Hashが不一致なら、OS namespace取得前に同参照・nonceを保持して停止し、保存receiptなし・全資源取得0を返す。新しい`CRDDKW03`／`CRDDKB03`と内包`CRDDKR03`、実exit・child joinを確認する。これは拒否経路の実搬送であり、正常な固定OS保存、Root／file消失後の正常読戻し、caller再入場、署名Runtimeまたは全Recoveryの成立根拠ではない。



実境界の保存場所確認では、本番と同じ固定環境でWindows一時領域を解決し、元対象の親実体と同じ境界へ結合できることを要求する。親Processの通常環境で成功しても、本番用環境での解決成功へ読み替えない。環境値の空指定、別場所への解決、取得不能、固定子Directory欠落を拒否例に含め、書込み・ACL修復・別場所へのfallbackを発行しない。OS保存場所の作成・変更は、exact Root、用途、所有者、保持・回復と人間承認を別に確定してから実行する。

今回の実所在確認では、同じ固定Native・frameを通常環境、旧一般Native環境、新Host専用環境で読み取り専用に比較する。所在取得、取得したToken／Directory／対象handleと個別終了を共同で評価し、診断の停止理由を正常保存の結果へ読み替えない。新環境が通常環境と同じ親へ達しても、保存子Directory欠落、旧対象の非使用、初期化許可と正常Native保存は別の未成立事項として保持する。未署名の開発実行物による診断を署名Runtimeの検証へ昇格しない。

共有管理先の保護付き作成は`ERB-IT-003`の限定観測へ含める。作成前に同Tokenの選択利用者・独立親実体・全非reparse chainを確認し、固定Recovery／Terminalだけを作成時からprotected二ACEで作る。適合済み再利用は追加作成0、不適合ACL・同名fileは修復0で拒否する。作成競合後のfresh照合、部分作成・型／ACL拒否とchild close失敗の共同保持、親guard終了を観測する。既存ACL移行は通常作成と別に、開始抑止・終了・変更前後のchild Identity／bytes／保護・旧exact回復の維持を検証する。新Mutexや作成成功だけを非使用または移行許可にしない。

`windows::terminal::host_namespace_creation_tests::host_namespace_creation_fixture`は、固定Repository-localの自己生成r2だけで新規作成、無変更再利用、既存不適合と同名fileの拒否、明示closeと終了後不存在を確認する専用実Windows Caseである。通常cargo testではignoredとし、固定cwd・run・通常選択利用者・先行静的検査を確認したOwnerが直接起動する。制限環境の選択利用者不明は拒否のまま保持し、保護条件を緩めない。作成競合・OS API／close故障刺激、通常producer、署名搬送、既存共有ACL移行と全Recoveryは別の未観測条件である。局所成功をLocal Item全体のPassへ自動昇格しない。[今回の範囲と原記録](../../../99_Roadmap/Changes/CHG-000082/Evidence/261002_host-orphan-recovery-design.md#保護付き作成部品の局所確認--2026-10-04)へ接続する。

移管前producerの保護付き作成は、旧署名Nativeの親観測→独立期待値付き初期化→Root／marker生成の順序を処置した。`ERB-IT-003`の旧局所Caseは、`host-recovery-namespace.integration.test.ts`による署名拒否・mode相関・部分処置・transport不明・通常入口の順序と、Native専用r3による作成・再利用・親／利用者差・不適合拒否と個別終了の比較記録である。専用CLI不正要求の取得前拒否もその対象に限る。現在のOracleは、必要Native同一性確認→親実観測→独立期待値付き初期化→Root／marker生成とし、署名拒否で本来の負例を代替しない。未署名通常入口からの正常搬送・保存、ACL移行、作成競合とAPI／close故障、全Recoveryは未観測のままとする。[当時の接続と限界](../../../99_Roadmap/Changes/CHG-000082/Evidence/261002_host-orphan-recovery-design.md#通常作成入口と専用搬送の接続--2026-10-04)は保持し、Local Itemの全体Passや件数を変更しない。


## Docker回復・現在状態縮小の検証補強

### 切替前の検証義務と現在設計の区別

旧修復本体・二Store・hardlink出版の4 Suiteは現行Sourceと試験登録から撤去した。`ERB-IT-012`は歴史的な非適用IDとして保持し、削除した旧Suiteを現在の自動検証根拠にしない。`ERB-ST-011`の旧Session handoff比較Suite・workerと記録3 Sourceも撤去済みであり、現在の自動回帰根拠にはしない。現在の一般回復保証は資源回収・Host遷移・Owner再入場・現在Writer／ACKのSuiteへ対応させる。正式ID・意味・当時のEvidence・設計項目総数は変更しない。現在の修復技術値はDocker Isolation、保存／履歴／終了／保持は現在Writer・Callerの試験へ対応させ、未確認の実境界や項目全体Passを補完しない。

Coordinator詳細の[旧方式の処置表](../../../06_Architecture/Details/coordinator/01_Architecture.md#正常復帰後の検証付き再起動)に従い、旧Release間の引継ぎ専用`ERB-ST-011`／`ERB-IT-012`は移行元の検証履歴として扱う。上の基準項目表はSource切替前の対応を識別するため保持しているが、新Runtimeで同じhandoff chainを再実装・再検証する義務ではない。段階5の撤去前に、以下の現在方式へ実接続と全利用側を対応させ、現行集合・統合表・生成物を一括確定する。旧項目を別の意味へ再利用しない。

| 維持する保証 | 現在方式のLocal Item | 固定候補で確認する反証 |
|---|---|---|
| 同じ操作・回復Identityでの保存と再入場、一次失敗と清掃の分離 | `ERB-IT-003`、`ERB-IT-004` | 別Attempt、元版喪失、観測不能、結果未受理、後続失敗による一次失敗の上書き |
| 必要な人間介入に限定したDocker再起動 | `ERB-IT-014` | 終了済みClaude参照と未解決Codex参照の混在、別の稼働Owner、対象追加・置換、排他不能、要求結果不明、起動未確認 |
| 明示的に選択したHost障害修復の安全条件 | `ERB-ST-009`、`ERB-IT-014` | Task回復からの暗黙修復、個別socket削除、観測不能、未確定Effect再発行。旧Releaseへの引継ぎ成功は現在方式のOracleにしない。 |
| 公開入口から回収・限定終了・新しい試行へ到達 | `ERB-ST-030` | 旧Workspace再利用、Provider開始後／送信不明への限定終了適用、遅延Create、親Process喪失、終了後残存、再送・採用・Commit／Pushの暗黙発行 |

実行形態、結果とEvidenceは各項目の契約を維持する。履歴の退避だけ、旧Reader削除だけ、新規正常実行だけを移行完了またはRecovery成功としない。現在Sourceに旧方式が残るため、上の二項目を現行集計から除外する処置はSource・全Consumer・実証の対応が固定された後に行う。これは旧互換を新Runtimeへ残す指示ではない。

本節は[Coordinatorの現在状態Snapshot](../../../06_Architecture/Details/coordinator/01_Architecture.md#現在状態snapshotの構造)から既存Local Itemへ導出する。新しい試験IDを目的なく増やさず、以下のscenarioを同じ検証義務の中で個別に判定する。設計の追加を試験合格や本番接続済みと表示しない。

保存再入場の純粋な分類は、[QA-000003](../QA-000003/quality_definition.md)の`PRL-UT-006`で、元版／次版のexact bytes Hash、Repository結合、初回Root条件、明示不存在／観測不能、previous相関、非安全整数・overflowを確認する。返却は非Authorityの処置候補であり、全Snapshot検証、File保存・回収、Root観測、Docker回復の成立は以下の結合・総合義務で別に確認する。

| Local Item | 入力・反証scenario | 観測・Oracle | 終了後条件 |
|---|---|---|---|
| `ERB-IT-003` | Coordinator設定不存在、正の期間指定、0・負数・小数・overflow、不正Schema、読取り不能、期間前後の通常履歴と未解決参照、終了要約の保存失敗・読戻し失敗。 | 不存在だけ既定30日。期間整理は通常履歴に限り、不正設定・観測不能では削除0。必要な要約の保存確認前にstateを除去しない。 | 未解決義務・未受理結果・Candidate・認証情報・正式Evidenceの削除0。要約再確認によるProvider再実行0。 |
| `ERB-IT-003` | 正常終了、取消中清掃、一次失敗後の清掃失敗、Process終了後の結果未受理。 | 一次失敗が不変で、cleanupと最終結果を別に保持する。結果受理前にoperationを除去しない。 | 未受理なら同じ結果を保持。清掃不明なら同じexact回復義務を保持。 |
| `ERB-IT-003` | 元版pending、次版exact一致、同版別内容、元内容Hash差、別Owner、置換後のread-back失敗、初回previous null、正規Snapshot不存在かつprevious非null。 | 許可された同一更新だけ再入場し、既成立の更新は追加更新0。不一致・未知は上書き0。 | pending解決または同じ参照で停止。履歴からAuthority／state復元0。 |
| `ERB-IT-003` | 結果保存後／Consumer受理前、ack保存後／元記録削除前、最終清掃失敗。 | 結果IdentityとConsumerが一致し、重複受理でも旧Task・Provider依頼を再活性化しない。 | 受理済み項目だけ回収。未解決義務はhistory整理から除外。 |
| `ERB-IT-003` | 要求前保存拒否、Effect後保存失敗、保存成功／排他解放失敗、外部応答待機中の別Writer、回収観測後のrevision競合、fresh Processでの同一pending再入場。 | 要求前はEffect 0。既発行Effectを未発行へ巻き戻さない。保存排他中にHost／Home／Runtime排他・通知・上位保存・外部応答を待たない。現在Rootと元版を再照合し、旧Process Capabilityを復元しない。 | 短期排他の解放を独立観測。未確定なら同じ回復参照保持、無条件再送0、別操作の記録更新0。 |
| `ERB-IT-004` | 回復参照先不存在、別Attempt、Identity差、重複参照、複製Repository、移動Root。 | Snapshotを操作Authorityとして受理せず、現在のRoot／Owner／資源へ再結合できなければ拒否する。 | 外部Effect 0、別対象削除0、既知参照保持。 |
| `ERB-IT-014` | 清掃済み旧参照＋未解決参照、対象追加・欠落・置換、現在稼働Owner、排他取得不能。 | 終了済み参照と現在の稼働を別に扱う。現在対象の閉集合・非稼働・全排他を確認する前に再起動しない。 | 競合時は再起動Effect 0。未選択Recovery変更0。 |
| `ERB-IT-003`／`ERB-IT-014` | 認証Probe create unknown、遅延create、旧Ownerの遅延start、現在不存在、観測不能、共有書込みMount。 | 限定終了の全条件を個別に確認する。未知を不存在にせず、Provider開始後や送信不明へ一般化しない。 | 成立時も過去unknown維持・旧領域再利用0。未成立なら同じ参照で停止。 |
| `ERB-ST-030` | 公開Task／Workbench助言の通常終了、取消、親Process喪失と新しい試行。 | 本番同等の保存・結果搬送・資源観測を組み合わせ、正常な新試行が旧Workspaceを利用しないことを確認する。 | 全所有資源不存在またはexact義務保持。再送・採用・Commit・Pushの暗黙発行0。 |
| `ERB-UAT-007` | 自動回収成功と、再認証／Docker再起動が必要な停止。 | 普段意識しない内部File承認を要求せず、必要な具体操作と影響だけを説明する。 | 人間判断前の新Provider Effect 0。安全な拒否を全体完成へ表示しない。 |

機械確認はSnapshotのshape、参照整合、revision／内容相関と固定purposeを扱う。意味上の限定終了、遅延要求と旧Owner停止の実保証はArchitecture／Qualityの独立確認および実境界の観測で扱う。Mockの返値だけでは実資源不存在や遅延create無害化を証明しない。

PT／LT適用判断: 専用の大規模負荷実行はN/A。今回の変更は容量・履歴が増えても現在の受付や回復へ干渉しないことを結合試験で確認する。Snapshot本文の有限上限はArchitectureへ具体化したが、本番受付制限と履歴設定は未接続なので最終容量境界はOPENであり、接続後に再評価する。専用PT／LTの実行は人間指定なしに開始しない。

OPEN: 新SnapshotへのSource接続、限定終了の実境界反証、各scenarioの実行とEvidenceは未実施。本節の追加だけでLocal ItemをPassへ変更しない。

### 利用形態別の受領条件と資源回収

失敗・取消の修復履歴は既存`ERB-UT-036`／`ERB-IT-014`で成功履歴と区別する。settling・outcome／checkpointあり・cleanup confirmedまたはunknown・保持判断未決なしの肯定に対し、未確定outcome、checkpoint欠測、回収pending／not_requested、理由／一次失敗の不一致、取消への一次失敗混入、処置順序不正と未決判断を拒否する。九処置の各unknownと全有限失敗理由を実codecで確認し、履歴の読戻し後も元理由・cleanup・Hash・初回時刻を保持する。履歴確認は成功・Native回収・状態除去の根拠にしない。mainでは二段出版の拒否／例外／解放不明／Owner失効／発行後不明、取消済みexact再入場と重複出版0、Native再取得0、completion 0を確認する。実Hostでは履歴五切断形からの再入場、確認済み欠測の再追加0、失敗履歴だけ残った操作欠落を除去済み成功へ補完しないことを確認する。保持判断待ちの失敗は現在状態で保全し、履歴固定前に判断を解決する後続接続をOPENとして保持する。

修復の保持判断は既存`ERB-UT-036`／`ERB-IT-014`で確認する。exact対象・保持待ち・recoveredと技術共同終端の肯定に対し、別ID、保持待ち以外、blocked／cancelled、一次失敗、cleanup／Host不明、未終端slotを拒否する。保持候補の変更はphase／dispositionだけとし、元版・他操作・参照・配送を全文比較する。Repair phaseの許可辺を全組合せで確認し、保持待ちから配送待ちへの飛越しを拒否する。値候補の成功を物理保存・人間引渡し・履歴保存・操作除去の成立へ流用しない。明示入口接続では処置前取消・Owner失効時の保存0、保存後取消で巻戻し0、Native／Docker再操作0を追加確認する。

phaseとdispositionの反証を分離し、codec合法な「phaseだけsettling・判断はpending」の次版を拒否する。判断条件だけを省略するメモリ変異を同じ拒否Oracleで検出し、通常checkpointからrepairing／settlingへ保持済みを混入させる候補も拒否する。保持保存のrename前切断後は、当該呼出しのexact出版完了と通常Readerの共同終端確認によって保持確認を返し、追加Writer・技術取得0、currentは旧pending全文、短命File不存在を実Windowsで確認する。no_pending既保持、出版拒否・確認不明・解放不明、Reader不明・別ID・Owner失効から保持確認を返さない。

修復履歴は`ERB-UT-036`で、専用summaryの全field・九slotの合法終端と各単独不正、schema／IDのTask交差、未知schema・重複・破損行、Directory／Path／Owner等の余分fieldを反証する。既存`PRL-UT-006`のTask要約・行byte／Hashを固定比較し、混在履歴の30日期間境界、期限外未確認行の保全、確認済み欠測の再追加0を確認する。初回true・時刻再採番・Hash差・飛び版・confirmed巻戻し、非空の他操作／参照／配送の変更を拒否する。純粋候補の成功を物理保存や保持物引渡しの根拠にしない。専用物理接続は`ERB-IT-014`で、通常Writerの外側／排他内の拒否、各保存切断のfresh再入場・設定／実体差・読戻し／解放不明と技術処置0を別途確認する。未接続はOPENを維持する。

再起動結果の一次失敗／片付け失敗分離は既存`ERB-IT-014`で確認する。一次正常・保存拒否・境界拒否・取消・未知例外と、片付け正常・false・throwの直積を観測する。一次成功＋片付け失敗では一次理由null、両失敗では元一次理由不変と片付け理由を別保持し、最終status・reason・再起動完成の既存安全判定を維持する。片付け成功後のsettled保存／境界再確認失敗、外側helper／Lock解放不明・throw、取得時cleanup不明、Context再使用と開始前拒否を含める。未実施cleanupへ失敗を捏造せず、生例外非公開、失敗後の新Effect 0、回収回数と待機完了を確認する。この局所反証は実Docker再起動・旧保存方式・Package全体の成立を証明しない。

修復の結果保存だけが未完了の場合も、既存`ERB-IT-014`で確認する。同exact ID・現在Root／Revision・通常Readerの解放確認を前提とし、`phase=repairing`、outcomeなし、一次失敗が`stage=repair／reason=runtime_repair_effect_unknown`、checkpointのcleanupがconfirmedまたはunknownの場合だけ、技術処置なしにblocked結果を確定する。DI入口・Native取得・Docker Effectが0、変更がphaseとoutcomeだけであることを確認する。cleanup unknownを回収成功へ変えない。対象外理由・欠測・別ID・終了済み・pending・Owner失効では保存0、保存拒否・確認不明・解放不明・例外では成功0と元版保持を確認する。一次失敗なしはこの終了経路へ入らず、既存の技術再観測へ進む対照を持つ。これはpending再確定や実資源回収の成立根拠ではない。

取消済みsignalでも、保存Ownerが有効な上記の記録限定確定は許可する。cleanup二状態の取消済み肯定、Owner失効併発と対象外でのWriter／DI入口0、および共通入口へ取消拒否を戻す変異を同じ結果確認Oracleで拒否する。通常の技術Sessionへ進む前には取消を拒否し、新しい技術処置を発行しない。

修復Ownerから既存出版marker清掃への接続も`ERB-IT-014`で確認する。status・本文確認・marker不存在・排他解放の各単独不成立、例外、清掃直後のOwner失効では通常Reader・DI・Writerへ進まない。除去後不明は既知の除去事実を診断へ保持し、fresh再入場でのみ再観測する。実Writerのoutcome出版後にmarker unlinkを一回拒否した状態から、取消済み同IDでmarkerだけを除去し、出版済み本文全文不変・再保存0・技術再取得0・不存在を確認する。marker既不存在では清掃書込み0、pending・不正marker・未知File・実体差の拒否は既存清掃試験へ接続する。未出版pendingの確定や修復全体の完成へ拡張しない。

未出版修復の保存確定は`ERB-UT-036`／`ERB-IT-014`へ接続する。純粋分類は初回単一空Repair、既存currentへの初期Identity追加、通常checkpoint、新Session候補、既出版同値を区別し、canonical全文を元モデルから再導出する。初回のcheckpoint／結果／参照混入、別ID・Identity・元版Hash差、飛び版、非対象変更、非canonical、同版異内容は拒否する。物理保存は正規marker、固定File集合、Root／Revision／現在Owner、領域と各Fileの実体・全文を読取り排他とWriter排他の両方で確認し、読取りからWriterまでの同bytes別実体も拒否する。通常初期化の新品条件を維持し、初回専用出版だけ物理historyなし・pendingとmarkerの二Fileへ限定する。実WriterのIdentity／checkpoint／outcome保存切断、既出版同値、旧Writerの後着要求、各段の保存／解放不明、取消、出版後のH／Scope不一致を反証する。出版後は通常Readerを通し、旧cleanup pending／unknownや未確定処置からNative実行許可を作らない。未実施の観点は実施済みと表示しない。

再起動要求の縮小では、既存`ERB-IT-003`／`ERB-IT-014`へ次を接続する。単一現在記録の形状・Hash再計算・元版相関と、実Host停止・起動・回収を分けて評価し、モデルだけから実処置成功を主張しない。

| 反証 | 必要な観測と判定 |
|---|---|
| 初回保存失敗、発行前unknown保存失敗、保存後のOwner喪失 | Host要求0、または同じ要求を再発行せずexact不明結果を保持。未発行へ戻さない。更新Writerの排他解放と、操作終端まで保持するHost-wide排他を分けて観測する。 |
| 受付後保存失敗、遅延通知、取消、完了後回収不明 | 元要求の受付／完了、現在許可、回収と結果を個別に確認。取消後に新しい停止・起動Effectを発行しない。 |
| 別要求ID・Scope・Repository・外側操作、同時要求 | Hashを再計算し、元結合を保持。既存Host排他・fresh Scopeなしでは要求0、未選択操作変更0。 |
| terminal後の要求置換、二度目の要求、結果書換え | 一操作一要求と結果不変を確認。旧phaseや署名から現在許可を復元しない。 |
| request／cleanup／resultの不正組合せ、blocked後の回収進行 | 正本の許容表から全組合せを列挙して拒否を確認。blocked後のpending→confirmed／unknownだけを結果不変で許可し、両confirmedだけでcompletedへ変換しない。 |
| Writer更新排他の解放直後の競合、Host-wide排他喪失、別Task／別Repository | Host排他は同じexact Identityで全Effectとcleanup終端まで保持。喪失・差・観測不能なら固定下位の後続Effect 0とする。 |
| fresh再入場時のEngine readyと過去unknown | 要求再発行0、過去成功への変換0。現在の実資源不存在に基づくTask終了は別の既存条件で評価する。 |

`completed`は同じ要求の確認と回収確認が両方成立した場合だけとする。元Taskの一次失敗・結果は別に保持する。公開入口と実環境の確認は既存STへ接続し、上位に生Session・OS別phase・任意技術callbackが残る候補を完成としない。現在は移管先の検証義務であり、新Schema・本番入口・実環境が成立済みとは扱わない。

2026-10-08の採用判断に基づき、`ERB-IT-003`の結果受理前の除去拒否は、固定本番利用形態に必要な受領条件へ適用する。全利用側に耐久Storeを要求しない。過去の実行結果とLocal Item件数は変更せず、次を現在の検証義務として扱う。

| 刺激・状態 | 必要な観測とOracle |
|---|---|
| CLI／Workbenchの通常返却と未閲覧 | 同じ結果を既存返却境界へ引き渡し、UI閲覧や任意保存を待たず資源回収を完了する。候補保全は別に確認する。 |
| Orchestratorの耐久ACK欠落 | cleanup確認は保持するが配送完了にせず、同じ結果のpendingを保持する。Provider再実行・資源復元0。 |
| Orchestratorのtransient降格、Consumer登録欠落 | 本番の固定利用形態と一致せず拒否する。空集合だけを単体利用の根拠にしない。 |
| 別Consumer／操作／結果ACK、任意Hash | 受理を反映せず元相関を保持する。保存Owner内部の確認を任意入力で代替しない。 |
| 一時返却失敗、返却後のProcess喪失 | 返却成功や回答再取得を推定せず、Provider再実行0。真正cleanupとCandidate／一次失敗の保全を維持する。 |
| 中断後回復でCLI／Workbenchの一時回答が消失 | genuine技術Ownerの資源・Host・Lease終端と必要成果物・履歴保全を確認後、対象pending配送0の既存transient条件で操作を閉じる。元回答の再表示・代理受領・新endpointを要求しない。 |
| transient終了整理後の診断render／write失敗 | CLI I/O失敗は区別するが、除去済み操作・回復義務を復元せず、Provider再実行0。診断喪失を耐久配送へ昇格しない。 |
| 終了整理保存不明と診断出力成功 | 出力成功で保存結果を補完しない。元状態・既知の片付け事実と同じ回復参照を保持する。 |
| transient終了の同Owner再試行・偽Owner・Root／Host再出現 | 終了Writer0または同じ試行の停止。借用callbackは保存試行後に失効し、別consumer・durable ACKへ転用しない。 |
| 終了Readerの排他解放不明と正常読取り後のOwner失効 | Readerの解放不明だけを上位cleanupUnknownへ保持する。Reader正常後のOwner／候補不一致は固定拒否とし、成功理由を流用しない。いずれも終了Writer0。 |
| 通常CLIの現在回復接続 | binding不成立・Root不正はDriver0。技術結果の一項目欠落、固定consumerと配送方式の不一致は終了処置0。正常transientは表示前整理、durableはACK待ちで保持する。 |
| Desktop修復の技術観測移管 | Directoryは安定した親実体・64件以内のentry・既知拒否だけをロック根拠とし、nullを不存在へ畳まない。Engine待機は180秒／1秒・unknown即停止・取消後観測0を維持する。DI直接試験とRootの固定FS接続を照合し、上位のcleanup不明stickyと記録順序を保持する。sleep timer自体の取消完了は保証しない。 |
| Desktop修復のHost操作移管 | `ERB-IT-001`／`ERB-IT-014`で公式停止の既存session一回・結果分類、固定backend停止の全引数／環境／上限／pid分類、三用途の固定退避先、Proxy／Accessor拒否、元実体・退避先・親の直前／直後観測を確認する。初回とContinuationで退避先既存時の意味を分ける。上位の保存失敗・取消・境界不一致で下位処置0、結果不明後の後続0と二退避の順序を維持する。模擬境界の成功を実停止・実rename・全Machine完成にしない。 |
| LocalAppData所在観測 | `ERB-IT-001`／`ERB-IT-002`で固定NativeのArtifact前後・要求全列・専用frame・UTF-16・Process失敗・Directory前後とrealpathを確認する。合成異常反証と配布Nativeの実読取りを分け、既存System Directoryも新Hashで再実行する。Rustのframe値境界は`ERB-UT-035`、CLIの固定modeと余分argv拒否は`ERB-IT-001`へ接続する。所在値から意図した利用者、ACL、Root Authority、排他や修復完了を推定しない。 |
| Orchestratorの現在回復接続 | 同じ必須signalでDocker回復をawaitし、exact IDと固定awaiting_deliveryの共同条件を要求する。旧recovered＋IDなしやtransient結果をDockerへ流用しない。待機中の取消・Queue／状態世代／対象義務差でsettled保存・ACK0。同じ回復参照を保持する。 |
| 現在Repositoryの回復相関解決 | recoveryCorrelationIdだけを要求集合へ全数対応し、内部Operation IDへfallbackしない。明示不存在と読取／排他不明・重複・別consumer・pendingを区別する。不明からabsenceを返さない。 |
| CLI listener解放不明・表示失敗 | 一次理由と技術事実を保持し、CLI清掃結果を別に返す。終了整理済み操作の復元・再実行0。公開診断へ内部キー・Root・候補・本文・未知fieldを出さない。 |
| transient終了のexact pending／foreign pending／除去後marker | exact候補だけfresh技術Ownerで出版し、元本文やforeign pendingは拒否・保全する。対象除去後は保存marker清掃だけで、元Task成功・受領を推定しない。 |
| Candidate公開不明、資源終端不明 | transientを理由に保全や回復義務を解除しない。現在不明を同じ相関で保持する。 |
| 耐久配送待ちで履歴期限到達 | 通常履歴保持とpending配送を分け、未受領結果を期限だけで消さない。既確認の資源を復元しない。 |

助言の初回回復参照は`ERB-UT-023`・`RCM-IT-005`・`PRL-IT-013`で搬送を確認する。Controllerの検証済み引渡しから、同期例外・取消・完了失敗・回収不明・finalize失敗を通じて元Docker参照が失われないこと、不正引渡し後の再捕捉と二重引渡しによる上書きを拒否することを反証する。Host清掃だけをDocker回収完了にしない。実Task SessionとWriterではHost／Docker参照が初回終端へ保存され、同参照は維持できる一方、後付けの別参照・操作差替えは既存guardで拒否されることを確認する。合成代役と実保存の成立を、実AI、実Container作成・回収または保持中の過去試験の終了証明へ一般化しない。

通常CLI接続のSource候補は、追加flagのない入口から現在Rootの技術回収・固定consumer・用途別終了へ接続した。binding不成立・開始前取消・Root拒否、技術共同条件の欠測、policy／配送差、終了保存の欠測、unbind不明、完了後取消、render／write例外、内部field非出力を局所試験する。旧flagは従来入口へ残し、新経路失敗から自動転送しない。固定診断はown data descriptorだけで分岐し、継承getterも実行せず、blocked／完了／耐久受領待ちの相関を検査する。

通常CLI・中断後transient終了の限定範囲は、修正版の局所／CLI33件と実Host24件が成功し、契約／品質の独立再確認は残指摘0。上位Orchestratorの現在回復・非同期待機接続は次の候補として区別する。待機中の取消・拒否・状態改訂・Queue取消と、settled直後取消によるACK0／settled保持、acknowledged直後取消によるfinalize0／耐久ACK保持の実保存反証を追加した。各ACK前ガードの無効化は本番blockの抽出実行と配置照合による限定負対照であり、Production全文の変異試験ではない。

Orchestratorの現在回復接続の修正版関連4File回帰は47/47・失敗／取消／skip0・exit0、自己生成Root残存0。契約／品質の限定最終再確認は全重大度残指摘0。処理・assertion・ID不変のHeader是正後も同じ実測を適用する。

OPEN: 旧入口／署名依存撤去、限定unknown終了Class、実Dockerと全体E2Eは未完了。全試験型の旧契約18件も残る。通常live返却の既存契約は維持し、Local Item全体をPassへ変更しない。

ERB-IT-010／ERB-ST-013は5CのOrchestrator／Coordinator大改修に依存するOPENとして保持する。旧CROS Handoffのpure prototypeと専用値試験は撤去し、sourceActive:false／destinationEffectIssued:trueを実Owner終了、Effect発行、重複消費防止の観測へ流用しない。QA ID・検証義務・正式Not Run・v0.22対象は変えない。[固定Git履歴と処置](../../../99_Roadmap/Changes/CHG-000082/second-stage-plan.md#旧cros試作品の撤去--2026-10-13)を参照する。

読取り助言の試験器では、Hash対象fieldの欠落・異型と正常null、標準Network ID差、利用者資源の追加・消失、前後のpaused／restartingを反証する。Root検証先行、試験器自身の前後照合でのGit子Process未使用、親GIT_DIRでRevision観測先が変わらないこと、対象文書・Revisionのみの不変主張と全Repository不変非主張を確認する。既存Workbenchの安全なGit読取りは変更しない。合成Ownerと実loopback HTTPによる局所成功を実Provider再試験へ流用しない。

## Checklist

- [x] Quality ID、検証目標およびSource固有条件を自己完結して示した
- [x] 各Local ItemをRequired Verification Obligationの局所参照と導出元へ接続した
- [x] UT／IT／ST／UATの適用または理由付きN/Aを記録した
- [x] 外部境界の直接、隣接1 block、関連2 blocks、System／E2Eおよび利用者受入を適用判定した
- [x] 正常、境界、準正常、異常および回復をLocal Itemで処置した
- [x] 各Local Itemで観測とOracleを分けた
- [x] 各Local ItemのEvidence要件を示した
- [x] 事前条件、刺激、終了後条件、cleanupおよびRecoveryを必要な範囲で示した
- [x] RT／PT／LTの適用または理由付きN/Aを記録し、PT／LTは人間の明示指定なしに実行しない
- [x] 自動化、手動確認および人間判断の境界を示した
- [x] 現行Source、TestおよびEvidenceとの照合をReality Auditへ分離した
