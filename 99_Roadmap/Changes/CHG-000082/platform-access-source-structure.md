# Platform Accessの構造・Native接続再編

## 旧Runtime State Native処理の撤去 — 2026-11-11

変更分類: 承認済みNode移管後の旧実装退役。基準版`4d8b1990e`で残ったRust値4・初期化分岐、TSの未使用要求生成・応答解析・契約表示を削除する。Coordinatorの既存Node初期化、保存Schema、wx、Provider Homeの保護Policy、DI／Executor／AI Adapterは変更しない。新しい代替・互換処理、記録移行は追加しない。

着手前の独立確認で、初期化専用Win32処理とProvider Home共用ACL／Token／SID／Known Folder／祖先Handleを分離した。旧Store値3／Runtime値4、Provider Homeの非0予約byteは入力解析で拒否し、OS観測・Directory作成へ進めない。存続する値1／2、要求76bytes・応答182bytes、revision・magic・nonce／Hash位置は不変とする。技術・利用側・文書の独立レビューを実施し、準拠基準・権限・リリースを変更しないため準拠／リリース監査は実施しない。

固定toolchainでSourceから配布実行物を再Buildし、165,376bytes、SHA256 `981d8078cf2b77418115160a489d2e09a03f2f94c600cf7bdab65b2e2daa2b53`へBootstrap／有限fixtureを同期した。PA全廃ではなく、Provider HomeとFilesystem観測用Nativeは存続する。

限定検証: Rust単体8件・実CLI6件、PAのProtocol・公開搬送・配布Artifact・実entry観測13件、Coordinatorの開発Native・出所・退役・coverage関連82件、公開境界・台帳関連11件が成功。配布release実行物自身も退役要求・非0予約byteの14組を拒否し、完全拒否frame・正常観測情報の非発行を確認した。PA／Coordinator製品・試験の3型検査、Rust書式・Clippy、変更TSの書式・warning禁止Lint、台帳426件valid、差分空白検査も成功。

独立レビューで、PA設計の現行図・wire・責務表に旧Runtime初期化とDesktop Helperの説明が残っていたため是正し、存続機能と退役履歴を分離した。最終再レビューの必須残指摘0件。Commit前の追加確認でも残存Source参照なし、配布物・Build結果・固定Hash一致、Native14件・PA13件の再成功、台帳426件validと差分空白検査を確認し、追加是正は不要と判断した。新品試験領域は各fixtureの清掃を用い、過去保持物は操作していない。全体回帰・実AI・実Dockerは未実施で、PA全廃・Release成立とは表示しない。ユーザーが許可したCommit／Pushへ進む。

## 最終漏れ確認とCommit／Push準備 — 2026-11-11

同じ未Commit候補を再確認し、検証器の旧Session代役2箇所・設定搬送、PA／DI設計本文の旧Helper・Mutex・Scope Hash・9処置の説明、未整形4ファイルと未使用2箇所を是正した。製品ロジックは変更せず、8処置のヘッダー、試験・文書の現行契約への追従だけを行った。基点の読取り範囲検査は削らず再接続し、不正入力のFilesystem要求0と固定退避IDの既存encodingを確認した。

Coordinator製品／試験、DI、PA、Domain Model、VC、Workbench、MCP本体／配布入口の9型検査が成功。変更106 TS／JSONの書式、warning禁止Lint、差分空白検査が成功し、情報レベル40件は別区分として保持する。今回是正を含むCoordinator関連74件、台帳・境界・Directory・checkpoint・Artifact関連36件が通過し、台帳426件valid、配布物／Bootstrap Hash一致を確認した。先行の限定回帰・実Writer・Native検証を全体回帰へ読み替えない。独立再レビューの必須残指摘は0件。全体回帰・実AI・実Docker・過去保持物の操作は行わず、PA全廃・実修復・Release成立は未完了のまま、ユーザーが許可したCommit／Pushへ進む。

## Desktop Helperの公式CLI統合 — 2026-11-10

状態: 実装・利用側・保存契約・試験・管理情報・文書の追従、限定回帰、独立再レビューを完了。全体回帰・実Docker・実AI・過去保持物の操作は行っていない。

人間が承認した停止契約への変更として、PA Desktop Helperを退役し、DIの既存Process処理・CLI検証・共通wxへ統合する。独自Process不存在保証、Native所有Hash・Helper実行物Hash・重複Scope Hashを撤去する。基点変更は運用注意とし、代替記録・自動移行・自動回復を追加しない。正本はDI／PA詳細設計、利用側はCoordinator修復・DM Identity v2、試験と管理台帳へ伝播する。技術・資源終了・保存相関・文書の独立レビューを行う。準拠基準・権限・リリースを変更しないため、準拠／リリース監査は実施しない。

基準版のHelperが担った停止・起動・排他・Directory処置を、新しいCLI／wx／既存Directory実装へ対応付ける。独立確認で取消Signal再読取り、失敗起動後Backend再観測、CLI起動受付とready待機、終了不明時のLock descriptor終了を是正する。残るCLI版・実停止／退避境界の確認は未実施Gateとして維持する。

検証: 関連回帰299件、PAの残存契約10件、Rust単体8件・CLI6件、型検査4構成、変更範囲の書式・warning禁止Lint、Rust書式・Clippy、台帳426件valid、差分空白検査が成功した。実Writer全fileでは旧Scope差用oracleの残存1系統だけが失敗し、その不要な期待を撤去して同じ親試験4項目を再実行し全件成功した。他の必要なexact本文・実体差・遅延Writer・nonce／Operation相関は維持し、独立再確認の必須残指摘はない。試験が作ったRepository-local領域は各fixtureの境界確認後に回収した。

配布Nativeを同じSourceから再buildし、Desktop専用実装・依存feature・不要になった所在取得関数を撤去した167,936bytesの実行物へ同期した。Bootstrapと有限fixtureのHashは`dd8e9fa705d9e6ab0bf5fa487cb74fc80a11b7e539fe5d783bd8c2636100f909`で一致する。これは残存するProvider Home／Filesystem用途の配布物更新であり、Desktop修復の実境界成立・PA全体の廃止・リリースを意味しない。

## Runtime StateのNode.js接続と祖先Handle保持の削減 — 2026-11-10

状態: 実装・限定回帰・独立再レビューを完了。全体回帰は保留。

人間が承認したRuntime StateのNode.js化を、要求主体分離後の保存先へ接続する。変更分類は保護方式を変更する実装保守であり、Coordinator／PAの詳細設計、保存Consumer、Native接続試験、台帳へ伝播する。着手前の独立確認で、Native由来HashはDecision Envelopeに保存されず、Root再照合にのみ使用されること、Runtime用Lockのbinding引数は固定共有Scopeを変えないことを確認した。Provider Home・DI・Executor・AD・保存Schemaは対象外。技術・品質・文書の独立レビューと影響追跡を実施し、準拠基準・決定権限・リリースを変更しないため準拠監査／リリース監査は実施しない。新たな人間判断は必要ない。

StoreのRoot情報をPathとNode実体Identityへ限定し、既存wx Lockと世代・Hash連続性・CASは維持する。Native Runtime観測の上位API、PA公開入口、Capability WeakMap、保護Hash再包装、未使用Contextを削除する。Provider HomeのNative搬送・故障検証は残し、Runtime専用試験は実Filesystem境界を使う既存Storeの統合試験へ移管する。未使用のRuntime Lock binding引数も利用側と同時に削除し、固定共有LockのScopeは変えない。

SID／DACL／Token・固定Volumeの独立検証を保証対象から外す。祖先Handleは新たな管理層へ移植せず、Drive Rootからの各段の非リンク・所在・実体確認とLock後再照合へ整理する。既存NativeもFILE_SHARE_DELETEを許可しており、Handle保持だけからPath差替え防止を主張しない。Nodeの確認後の非協調Processによる差替えは原子的に防止しない。従来より上位祖先のJunctionも拒否するため、同じ入力受理条件とは主張しない。途中作成段は失敗時も保全し、自動修復・削除・旧記録移行はしない。旧Runtime Native内部Protocol／固定配布物は後続のPA整理として残り、PA全廃とは表示しない。

限定回帰は11ファイル155件が成功した。PA公開搬送・Artifact、Provider開発Native結合、開発Session、Docker Recoveryが100件。Node Store・共有Lock、公開操作、人間判断、Host境界の45件から重複するPA搬送1件を除き44件。公開Owner境界11件を加えた。失敗後の再実行や同じ試験の再実行は重複計上していない。Node Storeの7追加ケースを含め、試験物は新品Repository-local領域だけに作成し、各試験の清掃で回収した。

広めに確認した既存Host試験2件は、既存DIの固定`DOCKER_CLI_HINTS=false`に期待値が追従していなかった。HEADの製品処理とNode子の実観測を照合し、試験の完全一致期待と子の固定値検査だけを是正した。残る任意環境の中立化検査、製品Source、期限は変更せず、当該12件の再実行が成功した。最初の実行環境付加という仮説は、空envのNode子による反証で棄却した。Docker自体は実行していない。

Coordinator製品・試験とPAの3構成で型検査が成功した。変更対象の書式・Lintと差分空白を確認し、既存の情報レベル指摘は是正対象を広げず維持した。独立レビューで未使用Context、部分mkdir失敗の反証、旧試験分岐、台帳、保証説明・ヘッダーを是正し、固定差分の最終再レビューは追加指摘0件。全体回帰、実AI・Docker、過去保持物操作、旧記録移行、Native配布物の再Buildは行っていない。

## Gitメールによる要求主体と明示CLI搬送 — 2026-11-10

状態: 実装・限定回帰・独立再レビューを完了。全体回帰は保留。

人間がGitユーザーメールをローカル要求主体に用い、VC APIとフロントAI用binを提供し、Coordinatorは自動取得せず明示入力だけを使う方針を承認した。VCにreadGitUser／GitUserResultと読取り専用bin、DMに値検査・ローカルメールID構築を追加し、Project／Task CLIは--principal-idを必須とした。Workbench／MCP単体入口と検証ScriptはVCを呼び、AM入口は既存ユーザーIDを維持する。

local.email.予約prefixはメール検査より前に識別し、不正時に旧opaque ID検査へfallbackしない。既存の一般ID検査は緩めず、Decision／SingleTask／Objective／MCPのPrincipal検査だけを同じ正本へ接続する。Git Root・Linked管理Directory・既存の設定形式拒否・shell非使用・期限・出力上限は維持し、user.name/email以外や生stderrを返さない。未設定はGit読取りではnull、主体構築では停止とする。

メールは認証証明ではなく、ローカル構成上の帰属である。名前は表示用、メールの大小文字は保持する。メール変更は別主体となり、旧Native ID・固定入口ラベルからの自動移行・再帰属は行わない。新Store・共通Context型・AM必須依存・OS主体の追加観測はない。NativeのRuntime保護・Home保護・wx排他は不変更。下の先行54件は先行版の根拠であり、本版の根拠は別に記録する。実AI・Docker・過去保持物は操作しない。

本版の限定回帰は10ファイル78件が成功した。内訳はVCの実Git・bin 4件、公開Owner境界11件、Coordinatorの公開操作・判断・保存21件、Workbench／MCPの定義6件、Workbench検証接続17件、CLI構文・起動契約19件である。修正後の再実行を重複計上していない。VC試験の未対応設定形式に関する仮定、検証用mockの新API欠測、旧CLI引数の2試験を是正し、既存Root検査は緩めず該当試験を再実行した。

VC、DM、Coordinator製品・試験、Workbench、MCP製品・起動部の7構成で型検査が成功した。変更36ファイルの書式検査、警告・エラー検査、差分空白検査も成功した。既存の情報レベル指摘7件は対象外として維持する。独立レビューの文書・CLI利用側、契約改訂、import配置の指摘を是正し、最終再レビューは追加指摘0件。試験Rootの範囲確認を追加した最終差分も独立確認済みである。試験物は各試験の清掃で回収した。実AI・Docker・過去保持物は操作せず、全体回帰は人間の指示どおり保留した。

## 要求主体とOS実行主体の分離方針 — 2026-11-10

状態: 責務分離の方針を採用。ローカル要求主体IDの設定・欠測時の運用は人間判断待ちで、製品Sourceはこの段階で変更しない。

人間が要求主体とOS実行主体の区別、入口での主体確定、Coordinatorによる伝播、CLIへのAM依存を追加しない方針を承認した。現在のOS由来ID・入口固定ラベルを独立したローカル要求主体の正本とみなさない。既存設定に独立した正本がないことをSourceと読み取り専用確認で照合した。OSからの自動生成は再結合、新しい永続プロフィールは仕組みの追加になるため先行実装しない。

推奨は既存の起動設定による明示IDである。可読な`local.alice`等を各入口へ伝播し、未設定時は停止、変更時は別主体とする運用の採否を確認する。AMユーザーと別のID空間を使用し、IDの文字列を本人認証の証拠としない。現行の保存分離・既存記録の主体照合・Nativeの技術保護・wx排他は維持する。実AI・Docker・過去保持物は操作せず、前段の54件成功を新しい主体方式の検証成功へ読み替えない。[責務と未決事項](../../../06_Architecture/Details/coordinator/01_Architecture.md#要求主体とos実行主体の分離--2026-11-10)を参照する。

## 操作主体とRuntime State保存先の分離 — 2026-11-10

状態: 実装・限定回帰・独立再レビューを完了。全体回帰は保留。

基準は`43b64b96c`。ユーザーの「分離して」に基づき、操作主体を保存処理から取得する経路を撤去する。Decision Storeの戻り値は利用可否とStoreに限定し、Objective／Decision／State／受入判断は上位が確定した`authenticationContext.principalId`を使う。受入判断のStore由来認証Callbackは廃止する。`observeClientPrincipal()`は配布MCPが実際に使用するため公開IFを維持し、保存先を開かない既存Native観測へ接続してauthorityへ移管する。AMへの新規依存、新認証方式、Node.jsによる主体生成、保存Schema・旧記録の移行、Runtime／Provider HomeのNative保護、既存wx排他は変更しない。

主体欠測・不正はCoreのStore初期化前に拒否する。Project CLIは入力検査・採用拒否・取消binding成立の確認後、既存Nativeで同値のローカル主体を上位から明示搬送する。配布MCPの単体Automationも従来と同じローカルOS主体を使い、固定`local-mcp-user`を本人確認済みとして流用しない。Task CLI・ローカルWorkbench／MCP内容操作の既存固定主体は別契約で、全入口のAM認証統一は主張しない。既存記録の主体を新IDへ読み替えたり、保存内容から本人を復元したりしない。

着手前確認と配布利用側の再照合で、保存先の利用可否と本人認証を分離しつつ既存ローカル入口のCapabilityを維持する方針へ具体化した。独立レビューで別主体の期限切れ記録をCASできる既存の処置順序を検出し、主体照合を期限処置より前へ移した。確認対象は、上位IDの保存、欠測・形式不正のEffect前拒否、要求と上位主体の不一致拒否、他主体の期限切れ記録のCAS 0・元記録不変、Store非依存のローカル主体観測、CLI搬送・配布MCP型検査、既存保存世代・受入判断・Worktree結合である。実AI・Docker・過去保持物は操作しない。

既存5ファイルの回帰40件、是正後の公開操作・人間判断19件、追加入口回帰11件、MCP定義3件が全成功した。同じ公開操作10件・入口9件の再実行を重複計上せず、異なる検証項目は7ファイル54件（Coordinator51・MCP3）。型検査はCoordinator製品／試験、Workbench、MCP本体／配布入口の5構成が成功。書式・警告検査も成功し、既存の情報レベル指摘6件は今回変更外のため維持した。独立レビューでCLIの不正Root時にNative観測が先行する点も是正し、Root拒否の元理由とNative 0／実行0を確認した。最終再レビューの追加指摘は0件。試験物は各試験のcleanupで回収し、実Nativeの保護観測・認証、実AI・Docker、過去保持物の操作と全体回帰は行っていない。

## Local AppData専用入口退役とMatrix失敗時の終了確認 — 2026-11-10

状態: 実装・局所検証・独立レビューを完了。全体回帰は人間の指示で保留する。

変更分類は未使用専用APIの退役と検証Toolの失敗時資源終了。基準は`2cbbfd271`と先行未Commitの環境・Desktop設定差分。ユーザーが残件1・2の実装を承認した。実AI・Docker、過去保持物、Provider Home／Runtimeの保護Policy、存続Native Protocol、既存の各期限、共通Lock、保存Schemaは変更しない。Source／利用側・配布・QAを独立レビューへ渡し、標準準拠基準やRelease・外部公開判断の全面監査は発火しない。

| 変更対象 | 処置と維持する境界 | 局所検証 |
|---|---|---|
| Local AppData専用取得 | TS入口・Source／専用試験、Rust専用argv分岐・dispatch・frame出力を撤去。共用`local_app_data_path()`は保護／Helper内部で維持 | 退役mode拒否と、存続System Directory／frame出力試験 |
| 公開・管理情報・旧Host代役 | Root export、Symbol、Test Catalog、Checker期待値、旧mode許可／要求列を追従。互換入口・代替なし | 公開一覧、成果物関係、固定代役Source境界 |
| Matrixの両固定子 | spawn直後から元closeを観測。ready前失敗・契約拒否でも未要求の停止を一回だけ出し、既存10秒枠でcloseを確認 | timeout、不正JSON／契約、早期exit／close、error、停止拒否／throw、close欠落、ID取得後例外と購読解除 |
| 失敗結果 | 一次理由と取得済exact IDを保持し、停止失敗とclose事実を別fieldで返す。子発行後失敗は手動確認要。終了未確認でRecoveryを発行しない | Script技術契約revision 3。通常Task Schema・保存・IPCは不変更 |

着手前の独立読取りで、清掃不明子にもfinallyがなく、従来のexit待機ではcloseを証明しないこと、共用Known Folder取得を残すこと、Native配布物の同期義務を照合して反映した。ready待機のtimer・data／error／exit／close購読とclose待機timerは終端で解除する。明示停止後に既に待機した結果を使い、同じ停止を自動再試行しない。close確認をDocker資源回収成立へ読み替えない。ready前にexact IDが届かなかった場合はIDを捏造せず、手動確認要と未確認を返す。

Nativeは明示targetのrelease Buildで再生成した。配布更新前に同名Native Processが存在しないことを読取り確認し、固定配布先へ同一成果物を配置、Bootstrap定数と合成fixtureを同期した。新SHA-256は`0cc503a6dd5ea63e813f3b92e43efff51c7259b47a8d2f98cc20987bcb229a6f`、byte長238080。公開Artifact観測でbootstrapVerified:trueを確認した。通常Runtimeをtarget実行へ向けず、過去の署名Manifest・Evidence・保持物は変更しない。Cargo cacheは既存Build領域を使い、過去のcacheを清掃しない。

固定候補のSource・利用側・管理情報・配布・設計の独立レビューは必須残指摘0件。実行物のHash・サイズと定数の一致も読取り確認された。共用保護Sourceの維持を、変更後Nativeの保護／修復の実境界成功とは表示しない。全体回帰・実Matrix・実AI／Docker・Native保護／修復実境界は未実施で、先行試験の成功を流用しない。

局所結果はRustの退役CLI拒否1件とSystem Directory単体2件、PAの公開／System Directory／環境3件、Checkerの公開Module・成果物関係2件、CoordinatorのMatrix境界4件・Script契約4件・Host代役／Shell搬送の静的2件が成功した。Matrix境界には、固定Node実子2つを不正JSONで拒否し、SIGKILLと実close・購読解除を確認する試験を含む。実Matrix・Docker・Native修復／保護操作は実行せず、単なるMock成功へ実境界全体を読み替えない。途中候補の失敗は新fieldの試験期待と先行DI初期化公開ModuleのChecker追従漏れを是正した。PA／Coordinatorの型検査、変更TSの整形・Warning検査、Rust Clippy／書式を確認した。Checker既存Lint Info 1件はWarning／Errorではない。PA公開試験の合成Artifactは既存finallyで当該Rootを回収する。全体回帰・PA全廃・実Docker／AI E2Eは未成立のままである。

## 任意Desktop管理設定の分離 — 2026-11-10

状態: 実装・局所検証・独立レビューを完了。全体回帰は人間指示で他の残件整理後へ保留する。

基準は`2cbbfd271`と先行未CommitのPA外環境整理差分。変更分類はDI設定契約・所在取得境界とCoordinatorの搬送変更。DIを変更する理由は、PAの既定所在再取得を減らし、Desktop管理を通常実行の必須設定から分離するため。ユーザーは上位確定所在への信頼変更を採用した。Windows専用の通常実行・固定Engine接続は変更せず、Linux／macOS・Engine単独対応、Native保護撤去、保存／IPC・Timeout・実AI／Docker・過去保持物操作は対象外とする。

既存の`IsolationSettings`へ任意の`desktop: { userDataDirectory }`を追加し、新しい公開関数・型・runtimeフラグは作らない。基点の意味はユーザー単位のアプリデータで、現在WindowsではLOCALAPPDATAを上位の既存起動Ownerが一度だけ渡す。欠測時はdesktop自体を省略し、通常初期化を止めない。明示した不正設定は初期化全体を拒否する。入れ子もdata propertyだけをコピー・凍結し、getter・Proxy・未知field・不正Pathを拒否する。設定だけではDesktopを起動しない。

| 既存の機能・境界 | 変更後の接続 | 維持する条件と局所反証 |
|---|---|---|
| 通常CLI・Container実行 | 共通二所在。Desktop設定なしも成立 | 既存の環境投影・固定CLI・Path・資源検査は維持 |
| Desktop再起動・修復 | settings.desktop必須。欠測は固定例外で発行前拒否 | 意図通知・Artifact観測・Native取得0。元Helper・取消・join・期限は維持 |
| 修復Directory観測／回収 | 既存公開settingsを同内部入口へ搬送 | 元Scope・checkpoint・固定Path・実体確認とunknown/nullを維持。新Native Sessionなし |
| Windows既定所在の証明 | Native再取得でなく上位設定を信頼 | 同等保証とは主張しない。初期化と各処置の実体照合は維持 |

着手前の独立した読取り照合で、単独Directory二入口のsettings未搬送と、LOCALAPPDATA欠測時に共通初期化を止めない条件を確認して反映した。Source／利用側・設計の独立レビューは動作上の必須残指摘0件。所在の保証起源を表すコメントと重複した説明節を追従した。標準準拠基準や外部公開・Release判断は変更しないため、それらの全面監査は発火しない。PAの旧Local AppData APIとNative modeは旧試験が使うため今回残す。Artifact／Job Object等の存廃判断と全体回帰は別の残件である。

局所検証はDIの設定・公開境界・修復組立て／単独回収24件、既存再起動／修復Lifecycle44件、Executorの薄い接続・共通Lifecycle9件、Coordinatorの起動設定／Matrix対象3件とメモリ内修復結果26件が成功した。DI・ExecutorとCoordinator本番／試験の型検査、変更Sourceの書式・警告検査が成功。修復試験の旧Known Folder呼出し故障注入は撤去し、明示設定欠測／不正・入れ子変更・再入場搬送の試験へ追従した。実Process確認は既存の固定Node環境要約だけで、Filesystem試験物・Native／実AI／Docker資源は作成していない。全体回帰・実Windows Desktop境界の成立とは区別する。

## PA外の子環境と旧診断口の整理 — 2026-11-10

状態: 実装・局所検証・独立レビューを完了。人間の指示により全体回帰は他の残件整理後へ保留する。

基準版は`2cbbfd271`。変更分類は未使用の技術操作撤去と検証Scriptの依存整理。`deriveChildEnvironment`の本番呼出しはなく、実利用はPlatform試験だけだった。関数・専用結果型・二ProfileとWindows操作groupを撤去し、`process_cancellation`の分類と必要保証は維持する。必須操作集合は空集合とし、既存resolverの「空集合は常に解決不能」を使う。閉じた操作集合の技術契約改訂は2へ更新するが、保存Schema・IPC・旧失敗reasonは変更しない。

回復Matrixの固定Node子がPA一般環境生成の最後の外部本番利用だった。既存のCoordinator設定OwnerからWindows所在を取得し、Script自身がSystemRoot／WINDIR、現行と同じ検査済みTEMP／TMPを搬送する。Node 24の組込みchild_process Sourceで親coverage設定の補充を確認し、`NODE_V8_COVERAGE: ""`を維持する。Windows／Node 24.19の固定Node子を局所観測すると、env省略ではHOMEDRIVE／HOMEPATH／LOGONSERVER／PATH／SYSTEMDRIVE／USERDOMAIN／USERNAME／USERPROFILEも補完されたため、この8項目も空文字で中立化する。これは旧PA環境と同じ空値を必要分だけ維持する処置で、親値の継承を許可しない。固定process.execPath・shell:false、親Proxy・任意Node設定の不継承を維持する。PA自身のNative環境・SID／DACL・Provider Home・Desktop保護には触らない。

読取り専用確認者が利用側、操作集合の空判定、技術契約改訂、Nodeの実行意味と試験を照合した。局所契約・型・書式・警告検査、Source／文書の独立レビューを行う。実Matrix、全体回帰、実AI・Docker・旧保持物操作は実施しない。標準準拠基準、リリース・外部公開判断は変えず、それらの監査は発火しない。ready前失敗時の終了確認は別残件とし、この環境整理の完成へ混同しない。

局所結果はPlatform契約13件、Windows Adapterの対象3件、回復Matrix環境・終了確認の対象2件、Source境界1件の計19件成功。実子の確認は固定Nodeの非秘密な環境要約だけで、Matrix本体・Native・実AI・Dockerを起動していない。Coordinator本番・試験の型検査、変更Sourceの整形・警告検査、実行／Task設計対応検査、差分空白検査が成功した。途中候補で判明したWindowsの環境補完は8空値を明示して是正した。独立レビューは必須残指摘0件で、環境補完の説明コメント1箇所を追従した。PA外の製品Source／Scriptから一般環境生成への参照はなく、旧Host／Native試験とPA自身の利用は残る。今回の試験でFilesystem試験物は作成していない。全体回帰・Host実境界・実Matrixの成功やPA全廃は主張しない。

## DIの明示初期化と子Process環境 — 2026-11-10

状態: DIの明示初期化・利用側追従・限定回帰と独立再レビューを完了。実AI・実Docker・全体QAの成立を含めない。

変更分類はDIの技術設定契約と利用側の接続変更。基準Commitは`197af14b6`。DIの環境PolicyをPAの一般環境生成から分離し、既存Executor／Coordinatorの起動Ownerへ設定の取得を限定する。PA自身のNative起動、SID／DACL、Job Object、Lock、保存形式、Timeout、Dockerの資源照合は変更対象外。外部AI・実Docker・過去保持物を操作しない。文書整合と利用側横断の影響を確認し、独立Sourceレビューを行う。標準準拠基準・公開／リリース判断は変えないため、それらの監査は発火しない。

| 成立済みの機能 | 今回の所有者と接続 | 維持条件・検証 |
|---|---|---|
| Docker CLI／署名検査の限定環境 | DI `docker-cli/environment.ts`。`initializeIsolation`で二所在をコピー・凍結 | 親PATH・Proxy・Node設定は継承せず、同じ準備は同じ設定。合成Filesystemと子Process fixtureで反証 |
| 通常実行・認証・Probe | 各Executor OptionsがDI設定を明示搬送 | 意図・Receipt通知、取消、Process終了、Cleanup、Home解放は既存契約を維持 |
| 単独観測・回収／Desktop操作 | 既存入口のsettings引数で同じ設定を搬送 | 元Snapshotと保存順序を維持。可変値・getterと初期化不能を試験 |
| Native Helper自身の環境 | PAに維持 | DIへの逆依存を作らない。Native環境全廃とは表示しない |

`windowsDirectory`はWindowsの配置先、`userHomeDirectory`はHost OSユーザーHomeであり、Provider Homeではない。グローバルsetterや永続設定は追加せず、設定をSnapshot／Domain記録へ保存しない。Node標準のPath・Link・実体確認を使うが、Native APIによる独立したWindows所在証明と同等保証とは主張しない。この保証範囲の変更は人間が採用済み。グローバル登録案と操作ごとのambient再取得は、既存実行の設定を変えてしまうため採用しない。

着手前の読取り確認で、署名・WSL・Engine・Desktop非同期処理、三用途Options、単独回収と試験注入までを閉包対象とした。最初の独立レビューで設定の可変参照、getter、`os.userInfo`の失敗範囲とimport配置を指摘し、是正後の再レビューは要修正指摘0件。DI本番Sourceに環境変数・OSユーザー情報・PA一般環境生成への暗黙接続が残っていないことも確認した。

最終固定候補ではDI通常412項目中407成功・5対象外（19,108ms）、Executor114成功（80,849ms）、Coordinatorの認証・資源記録・Recovery・再起動・修復結果の限定8 Fileで99成功（10,124ms）。DI／Executor／Coordinator本番・試験の型検査、変更74 Fileと新規設定Sourceの整形・警告検査、既存二つの実行／Task設計対応検査、差分空白確認が成功した。Lintの既存Info12件はWarning／Errorではない。途中候補の失敗は、試験側の新引数未搬送、VM依存未注入、入れ子ScriptでのPath文字列escape、直接Constructor負例の旧引数に是正し、検査・期限を緩めなかった。実AI・実Docker、Host限定実境界、Coordinator全体回帰は実施しておらず、限定結果をそれらへ流用しない。

### 今回の失敗試験の自己生成物

途中候補の設定引数渡し忘れで、有限DI代役のNode試験子がassertion終了し、4 Rootの清掃末尾へ到達しなかった。各Rootは2026-11-09 15:20 UTCの今回の失敗実行に相関する。全Bookは`recovery_opened`／`recovery_handoff`だけで、試験の固定Operation・64桁dの合成Home Bindingとexact Path Hashが一致する。二つは失敗出力のexact回復IDとも一致し、他二つも同じ最初のnormal形の記録と試験順序に対応する。外部Process境界は有限代役であり、実AI・Docker・Native要求はない。未知の旧保持物を日時・prefixだけで選定しない。

親は`C:\project\CRDD\.crdd\tests`、devは`1687905628`。全子のFile Identity・通常File／Directory・Linkなし・nlink1・全量Hashを捕捉した。読取り専用の独立確認後、全試験子の終了と同じ実体・全量Hash・未知の追加0を再確認し、Fileの個別unlinkと空Directoryのrmdirだけで回収した。専用TEMP `di-initialization-20261110-1`は今回exclusive作成した空Directory（ino `14073748836120688`、birthtimeNs `1794236884577908600`）だけを対象とした。16 File・15 Directoryを回収し、全5 RootでENOENTを確認した。旧保持物は対象外のまま維持した。

| 今回の試験Root | ino | birthtimeNs | File/Directory | 全量SHA-256 |
|---|---|---|---:|---|
| `executor-host-contract-8kR48D` | `75153818783853652` | `1794237616968406200` | 4/4 | `d959367bf0ec7e5f3019398a75838a218eb1a8f4e6a7180dadc8cdf6226b58cc` |
| `executor-host-contract-CGkzba` | `134263563893371413` | `1794237651909818800` | 4/4 | `bf5765d6153ab057152340df3c8399fd8c59c88b87ea5b139b3f0ab614c9986d` |
| `executor-real-claude-fixture-7fce05ff-35f5-40a6-8151-774542307281` | `136796838683680094` | `1794237623649032600` | 4/3 | `ebf3836a7db77c295588eee947773605c0bd18f9bcf94ebde4d3589d49909fab` |
| `executor-real-codex-fixture-bd9279de-ed4a-4cf9-9471-48b0dcd155fe` | `58828270133232293` | `1794237623068245600` | 4/3 | `aad88180288f617affc82b8f1adfb7a03f903e27a334fadece82920da51cbc4b` |

## 承認済み保持物の限定回収 — 2026-11-09

人間が「安全にすぐ回収できる以前の再現調査4領域と古い保持物」の回収を承認した。これは以前の不操作指示に対する、確認成立した対象だけの新しい許可であり、未知の残存物全体への削除許可ではない。変更分類は保持物の退役と記録の更新で、製品Source・保護Policy・期限は変更しない。実AI／Docker・再試験は実施せず、Root外期待値・実体・参照と停止下Lock処置の専門観点を着手前に照合した。独立した読取り確認は残Must-fix 0件。準拠／Release監査と製品回帰は、契約・実装を変更しないため追加しない。

今回すぐ回収する対象は下表の7 Rootだけ。親は `C:\project\CRDD\.crdd\tests`、devは `1687905628`。再現調査4 Rootの元Identityは下記「失敗4件の限定再確認」節の保持記録と一致し、8管理Root／48子Directoryの記録Identityと7保存OperationのHost Path内包を確認した。これらは固定Workerの未要求切断を再現した自己生成試験物であり、実AI／Dockerの保持資源ではない。原因と結果は本変更記録へ移し、物理的な保存義務を終了する。

中断回帰 `pa-portable-verification-20261109-1` は、外部記録に固定した元Identityとrun／outcome／TAPの3 File Hashが一致し、Namespaceは空。runはowner PID27432、子PID36708、Source 1,133 FileのHash一致、60分枠のETIMEDOUTで最終集計なしという結果を維持する。後続120分回帰の成功でこの中断を成功へ書き換えない。Workspace旧2 Rootも当時の120秒中断として記録済みであり、現在はFile0・空Namespaceのみ。名前や時刻だけではなく、今回採取した下表の実Identityと全量Hashを外部記録へ固定してから空Directoryだけを除去する。

| 回収対象Root | ino | birthtimeNs | File/Directory数 | tree SHA-256 |
|---|---|---|---:|---|
| `abandon-owner-JOJj2Z` | `141863388263344720` | `1794229146523878100` | 28/33 | `9710752979c0cf60c94c4fceb1cebd2feb8587a8af2fb892a509482d7d0d52a3` |
| `abandon-owner-NY0tmb` | `23080948090552893` | `1794229150252646500` | 29/33 | `f8a25b93aabd17a4ab40d5e570e97f6cb07e7514e4c5e440f3428266ea42a39b` |
| `abandon-owner-6P7XUi` | `11258999070745980` | `1794229155974243400` | 29/33 | `72fba25222b3000f9fa0d259958aacffb60a250e30023d344f87fa27a7c75359` |
| `abandon-owner-YoSz0u` | `22236523162936768` | `1794229166475201000` | 29/33 | `f14269100c2a2994db42f3bd40f0db3ea1fc47f6562a51481a3b2cf2277aaa75` |
| `pa-portable-verification-20261109-1` | `23925373020587809` | `1794216399907425300` | 3/2 | `2c621c2a7cd10dd393803bbad163d63d4fbaef8fb5dd83657c541fce5b734984` |
| `auth-closure-workspace-regression-20261107-1` | `64457769668830052` | `1794038365681913200` | 0/2 | `4998b386b9ae283f05a3ffccabbfc138d31d65fa1cd5fa14e2d1d9885ac0e7df` |
| `auth-closure-workspace-regression-20261107-2` | `17732923534863761` | `1794038607218579500` | 0/2 | `83e817a6fd2616d913ada12f69064ca4391f3b495eaf66eeefa30559f852d4b9` |

全treeの照合方式は本書の既存節と同じ相対Path・種別・ino・birthtimeNs・File SHA-256のJSON配列。全entryの非link・canonical Path、通常File・単一link、Namespace空、記録と全量Hashの一致を直前再確認する。元Lock所有者PID43376／24552／1904と既知試験PID系列、固定Worker／Workspace試験、7 Root参照Processの停止も確認する。条件成立後、既知Fileの個別unlinkと空Directory除去、各RootのENOENT確認だけを実施する。不一致・稼働・観測不能なら保持する。

古いHost6 Root、Docker影響未確認の45 Root、さらに由来未確定の13 Root等は今回処置しない。経過時間・名前・PID不在だけで削除せず、技術影響・参照の確認を先に必要とする。今回はDockerの起動・観測・回収を許可へ含めない。

削除直前の関連Process照会は一致0で、全7 Rootの元Identity／全量Hashと各entry条件を再照合した。118 Fileを個別unlinkし、138 Directoryを空確認後に除去し、全7 Rootで`lstat`の`ENOENT`を確認した。過去の4失敗や60分／120秒中断は成功へ書き換えず、結果と今回の照合値は本記録へ残す。以下の各節にある当時の保持記述は履歴であり、この7 Rootの現在状態は回収済みである。製品Sourceは変更していない。回収後の独立実読でも全7 Rootの不存在と集計・不明分保持を確認し、参照位置と履歴表示の軽微な追従を是正した。回収の残指摘は0件、差分空白検査も成功した。

## taskkill接続の完全撤去と親だけの故障注入 — 2026-11-09

人間承認により、残るMCP検証の故障注入を親ProcessだけのSIGKILLへ変更する。全参照を調べ、回復記録ITの単一Node Workerと署名付き回復Matrixの生taskkill呼出も同じ範囲へ含めた。PAの`src/process/termination.ts`、専用fixture・IT、Rootの関数／型exportとSymbol／Catalog・利用側の旧参照は撤去する。Native binary・Protocol・製品の保存Schema・Owner／Lock／Receipt照合、BrowserとDesktop Job Objectは変更しない。

変更分類は検証の故障注入契約変更と未使用の技術入口撤去。親停止は一回要求し、killのtrue・false・例外、exit、元親close／stdioを区別する。親の終了未確認、EOF混入、期限、搬送・Protocol・出力異常では新たな再入場Processを起動しない。未実施の再入場はnullとして報告し、空の成功観測を捏造しない。親停止を子孫不存在やDocker回収へ換算せず、既存の再入場APIの拒否・不明を維持する。回復Matrixの停止失敗・close欠測は取得済みの元Recovery IDを保持する。未知のLockをPIDや時刻で清掃しない。

着手前の独立した読取り確認で、未joinでも無条件に再入場していた経路と、専用入口以外の生taskkill呼出を追加処置へ統合した。検証は型・書式・Lint、PA公開境界、Script本体の局所反証・実Node親停止、Checkerの公開入口期待値を対象とする。実AI・実Docker、Native再Build、過去保持物、他OS・実回復E2Eは対象外。新しいManager・Registry・代替ツリー監視は作らない。

MCP検証契約は43試験成功、回復ITの親停止局所反証は1成功。PA回帰71試験、関連Script検証5試験、Checkerの公開Module整合1試験も成功した。Coordinator／Checker型検査とPAの書式・型・Lint、変更したScriptの書式・Lint、差分空白検査は成功。親終了Gateと回復Matrixは合成本体を実行し、不明時の再入場／回復呼出0を確認した。局所反証のVMに`AggregateError`を明示してrealm差による誤判定を是正した。独立レビューで検出したTimeout後の遅い開始通知による二回killは、短命な`killRequested`を共用して是正した。反証試験は固定sleepではなく実際の合成kill観測を待ち、後着通知後も一回配送と結果不変を確認する。これらを実AI／実Dockerでの親喪失後の回復完走へ昇格しない。

独立レビューの製品・再入場・削除追従の残Must-fixは0件。なお回復Matrixのready取得前の失敗時finallyは、従来どおり停止要求後のclose確認を持たない。今回確認したready後の故障注入・回復前Gateとは別の未完了範囲であり、準備失敗時の清掃完了を主張しない。この経路の一次失敗を保持した有界終了確認は保守担当の残件とし、次の回復Matrix整理・実境界検証の前に再評価する。失敗時に正の回復完了を返さない現行動作と、元IDが取得済みの場合の保持は維持する。

### 今回の試験絞込み誤り — 試験失敗は未解決・7領域は回収済み

試験名指定を対象Fileの後ろへ置いたため、予定外のHost試験も開始した。Host側の失敗表示を検出してsession `52131`を打ち切った。少なくともproducer／state_saved／host_started／cleanup_withheldの失敗表示があり、最終集計・詳細原因は未回収である。完走・失敗0とは扱わず、同じ全Host試験を再試行しない。以後の局所確認ではOptionを全File引数の前へ置いた。以下の保全記述は回収承認前の時点を示し、現在の物理回収結果は直下の節に記録する。

今回新規の7 Rootを下表のexact Identityで保全した。Rootはすべて通常Directory・非link・各2 entry、共通devは`1687905628`。既知試験親PID `17144`の直下および下記exact Root名参照のNodeに限定したWin32 Process照会は一致0だったが、OS全体・全子孫不存在やRoot回収可能性の証明にはしない。古い保持物は不操作、今回Rootも削除していない。担当は本変更の保守担当、再評価期限は2026-11-10。詳細原因、全参照と実体、回収条件を確認して明示的に回収し、不明時の自動削除はしない。

すべて`C:\project\CRDD\.crdd\tests\`直下。

| Root名 | ino | birthtimeNs |
|---|---|---|
| `abandon-owner-30enco` | `134545038868703570` | `1794228010908024000` |
| `abandon-owner-Kta0Yi` | `20829148279371454` | `1794228029435705400` |
| `abandon-owner-lUWnnS` | `12947848931009852` | `1794228020257709300` |
| `abandon-owner-NJZd00` | `27021597766367600` | `1794228014492834600` |
| `abandon-owner-vTogdS` | `21392098232805721` | `1794228039131827700` |
| `auth-create-failure-42TgaC` | `17169973582146789` | `1794228048624111600` |
| `auth-create-failure-T9kNpn` | `38843546786209662` | `1794228061953371800` |

#### 承認された7領域の回収確認 — 2026-11-09

人間が試験指定の是正後に今回7領域の回収試行を承認した。変更分類は自己生成試験物の退役と結果記録であり、製品契約・安全判定は変更しない。保守正本・試験producer・保持記録を着手前に照合し、Filesystemと停止下Lock回収の観点を独立確認へ渡した。準拠・Release監査と実Host再試験は、この限定処置では実施しない。

元RootのIdentityと非link・canonical Path、全entryの通常実体、各Fileの単一linkを確認した。14管理Rootと84子Directoryはhost recordのIdentityに一致し、13件の保存OperationのhostPathsは各試験Root内に閉じている。今回の認証試験は`auth_create_failure`の固定Docker代役で、実CLIを呼ぶ`auth_create_unknown`ではない。保存状態の`docker_submission_started`や`ownerEffect=active`を実Docker／AIの稼働証拠にはしない。関連する固定worker／test runnerと既知PID系列の読取り照会は一致0、元session 52131は中断終端済み。再実行・再入場は行わず、今回Rootの全利用者である固定試験Processの停止下で退役する。

下表は削除前に捕捉した全treeの照合値。各entryの相対Path・種別・ino・birthtimeNs、File本文SHA-256を名前順のJSON配列へ並べたSHA-256であり、Git fixtureを含む。直前に同じ値と関連Processの停止を再確認し、個別File削除と空Directory除去だけを行う。不一致・未知entry・稼働・観測不能なら保持する。独立確認の残Must-fixは0件。これは試験物の回収条件の確認であって、失敗したHost試験の原因解消やDocker Cleanup成立ではない。

| Root名 | File数 | Directory数（Root含む） | tree SHA-256 |
|---|---:|---:|---|
| `abandon-owner-30enco` | 28 | 33 | `688b41eac2832a730717ba9695938e3d5114e8209fa560e9257dba02c0f6be04` |
| `abandon-owner-Kta0Yi` | 29 | 33 | `1d3c89a0b21ff58fb4d1602b056b2a79685cd2a58591f11db4e4089df87aa8c8` |
| `abandon-owner-lUWnnS` | 29 | 33 | `5ce14eabb472bc0d370c04ca2dce1551a7685b1651dece53dc99a89bd6d2442f` |
| `abandon-owner-NJZd00` | 29 | 33 | `c9e211d0d4593ec6989b7da92e5695197884b1b175dd00317dfaaa9a80b83a59` |
| `abandon-owner-vTogdS` | 29 | 33 | `9db2115593925aacdcfbcc299f8a0c1ff7d7e56a82abf3eef584d900ed0d1634` |
| `auth-create-failure-42TgaC` | 29 | 34 | `2ac7828fa778fbf26b661a438f9a410338475f9e1ca8c3d807a4b5c4df6ba08a` |
| `auth-create-failure-T9kNpn` | 29 | 34 | `49973f62ae2cb51b208f0e67703911ba7b3ad19d55297c5a688bb2c7ba062431` |

直前照会で元Node PID `7412`と同じ番号の`svchost.exe`を検出したが、生成時刻は試験後の2026-11-09T21:55:18+09:00であり、元試験Nodeではない。PID番号だけを所有者の現在性へ読み替えず、種類・生成時刻・固定worker／test引数・7 Root参照を区別して再照合した。関連Process一致0と全tree同値を確認したうえで、上記7 Rootだけの202 Fileを個別削除し、233 Directoryを空確認後に除去した。全7 Rootは`lstat`が`ENOENT`を返し、回収完了を確認した。過去保持物・実AI・実Dockerは操作していない。今回の回収は失敗したHost試験を成功へ変更せず、元の詳細原因と回復Matrixのready前失敗時の終了確認は引き続き残件である。

回収後の独立確認でも全7 Rootの`ENOENT`、記録照合値と集計、現在地への追従、試験失敗との区別を確認し、残Must-fixは0件だった。差分空白検査も成功した。

#### 失敗4件の限定再確認 — 2026-11-09

人間の依頼で、`Owner終了境界(producer|state_saved|host_started|cleanup_withheld)から別Processの本番回復へ結合する`の4登録だけを、全OptionをFile引数前へ置き、直列・一度で再確認した。parent_terminatedと認証create群は非選択。着手前の独立確認で、選択範囲と固定Workerの実AI／実Docker不使用を照合した。対象test runner PIDは23928、sessionは37565。30,084.7912msで終了し、4試験・成功0・失敗4・取消0・skip0、exit=1。親枠打切りではない。製品・試験Source、保護Policy、既存保持物は変更していない。

| 対象 | 再現した直接の失敗 | 原因の照合状況と最小対応候補 |
|---|---|---|
| producer | workerの`abandonRuntimeOwnedDockerRecovery()`がfalse（期待true） | 現行APIは解放を実施せず、Executorから記録済みの`homeLeaseReleased`を返す。fixtureは旧放棄契約を期待している。通知済みの実解放と未取得を分け、現在のOwner境界へ試験を追従させる候補。製品の解放条件を緩めない。 |
| state_saved | 故障反証用設定の`confirmRuntimeOwnedDockerTaskHostAbsence()`がfalse（期待true） | 初期記録は`resources=null`・`outcome=null`。現行の資源終了判定はこの組合せを拒否する一方、その後の未要求初期切断特例は初期操作とのexact一致を要求する。試験設定へblocked outcomeを足すだけでは後者との一致が壊れる。独立確認で製品側の特例と手前の終了判定の契約不整合候補を検出した。未要求・未開始の厳密な成立条件と判定順序を整合させる案を検討し、単なる試験追従や検査緩和で通さない。 |
| host_started／cleanup_withheld | Provider Home Lockの取得が`acquired`でない | 同じ通常実行権限で共有ProviderHomesのlstatが`EPERM`となることを読取り確認。現行Lockは親Directory観測不能を拒否するため、権限境界が直接の有力原因。取得理由を出していない既存assertのため、実返却reasonは未取得。wx残存だけが原因とは断定しない。Repository-localの固定Home代役で検証可能な範囲と実共有Home試験を分ける候補。保護Policyは変更しない。 |

今回の新規4 Rootは下表だけであり、旧7 Root回収済みの記録とは別runである。すべて`C:\project\CRDD\.crdd\tests\`直下、devは`1687905628`。失敗時の既存finallyにより保全された。担当は本変更の保守担当、再評価期限は2026-11-10。対象固定worker／test runnerと既知PIDの終了後読取り照会は一致0だったが、清掃成立とはしない。由来・参照・元Identity・停止下処置を照合するまで自動削除せず、追加再試行もしない。

| 新規Root | ino | birthtimeNs |
|---|---|---|
| `abandon-owner-JOJj2Z` | `141863388263344720` | `1794229146523878100` |
| `abandon-owner-NY0tmb` | `23080948090552893` | `1794229150252646500` |
| `abandon-owner-6P7XUi` | `11258999070745980` | `1794229155974243400` |
| `abandon-owner-YoSz0u` | `22236523162936768` | `1794229166475201000` |

#### 4失敗と後続経路の修正方針 — 調査確定・未実装

人間の依頼は原因調査・整理と修正方法の確定であり、本節では製品／試験Sourceを編集せず、試験再実行も行わない。現在Source、旧API変更履歴（`ab58b98b7`）、共通Lock設計と既存の停止下再入場試験、Domainの現在保存Writerを照合した。最初の失敗だけを修正しても、旧Home取得hook、Supervisor許可、Crash後の自動解放期待、Host不存在後の再入場、最終保存で停止するため、それらを同じ原因の影響先へ含める。

| 修正対象 | 確定した最小方針 | 変更しない意味 |
|---|---|---|
| producerの放棄期待 | `beginRuntimeOwnedDockerRecovery()`はHome Lockを取得せず、`abandonRuntimeOwnedDockerRecovery()`は実解放せず記録を参照する。未取得のfixtureはfalse・解放要求0を検証し、同じHomeの耐久競合拒否・偽Capability拒否・保存／Host不変を維持する。実Home解放の保証は既存Executor側試験で確認する。 | trueを得るための解放記録の捏造、Coordinatorへの実Lock解放の逆移管は行わない。 |
| 取得後hookの旧前提 | 呼ばれなくなった`afterHomeAcquire`とLock模擬は撤去する。Root失効の反証は、現存する読取り後・保存前境界へ接続し、保存／Host Effectが発行されないことを確認する。 | Root再検証や競合検出を削らない。単に到達assertを外して通さない。 |
| 未要求資源と最終結果の混同 | Domain正本`coordinatorTaskResourcesAreSettled()`の`resources=null`枝へ、復号済み新形式で「settling・Lease held・Owner disabled・Provider未開始・外部送信／共有書込み未発行・outcome／一次失敗／summary／historyなし・再起動未解決なし」の厳密な技術未発行形を追加する。既存のblocked終端形は維持する。 | `resources=null`だけで受理しない。欠測・旧形式の補完はしない。Host不存在、Lease解放、全体Cleanup成功とは同一視しない。 |
| Host判定と再入場 | 上記Domain判定を資源回復・Host遷移・Host清掃・Host不存在後の準備・最終Writerで一貫して使う。既存の`isUnsubmittedInitialTaskHost()`によるhost_onlyのtoken／初期全文一致、submission後のlineage照合、現在Owner・CAS・実体観測は維持する。 | Coordinatorの判定順序だけ変えて最終Writerで再停止する修正は採らない。outcome.cleanupConfirmedを物理清掃前に保存しない。 |
| Home／Runtime所在 | 親試験と固定Workerの候補所在だけを、同じ新品Repository-local試験Root内の固定Directoryへ投影する。既存Module mockを利用し、実wxと実Scope Hashを共用する。Home競合・取得／解放を実Fileで検証する。 | 実ユーザーHome・保護Policy・製品の所在解決は変更しない。LOCALAPPDATA全体を書き換えず、Lock成功の代役にも置換しない。 |
| Crash後の再入場 | 子の元close、保持したLock参照、Identity／Owner／Generation／File Identity／本文を照合する。残存による拒否を先に確認し、有限なfixtureの全利用者停止・再起動抑止下で、そのLockだけを明示回収してからfresh Workerを起動する。既存Lock試験の手順を再利用する。 | Process終了をLock解放へ換算せず、自動Recoveryや新しい製品Recovery APIを追加しない。PIDだけでは削除しない。不明なら保持する。 |
| 旧Supervisor経路 | 固定Workerの旧Supervisor Path／Pipe許可と呼出し分類を撤去し、現在必要な固定Native・読取りGit等の許可集合へ追従する。実Docker／AI要求の拒否は維持する。 | 許可集合を広げて旧試験を通さない。 |

主要な実装対象はDomainの`attempt/validation.ts`、Coordinatorの当該ITと固定Worker。Domainの`state/crud.ts`／`state/validation.ts`／`storage/runtime-store.ts`、Coordinatorの`execution/recovery.ts`にある資源終了判定の製品参照20箇所を回帰対象として照合する。既存契約の再利用であり、新しい型・公開関数・保存Schema・Package・Manager／Store、DI／AI Adapter／Lock製品Sourceの変更は不要。

受入条件は、厳密な未発行形だけが技術回復へ進み、20参照先でOwner・Host・Lease・outcome・履歴・配送の独立した条件が維持されること。各必須fieldの単独不一致、resources欠測、実要求・unknown、未確定再起動、別token／世代、現在版差、保存失敗・清掃未確認は停止させる。初期切断、Host submission後、pending保存後、物理除去後から最終保存までを同じexact Recovery IDで確認する。Host未回収・Lease未解放・outcome未確定から履歴／配送／Task除去／品質表示を成功にしない。実Homeを使わない有限なNode／Git／wx試験とDomain契約・Coordinator結合回帰で確認し、実AI／実Docker E2Eと混同しない。

方針の独立レビューは残Must-fix 0件。特にDomain最終Writerの先行終了判定と、旧Supervisor／Crash自動解放の後続停止要因を調査へ追加した。これは修正方法の確認であり、未実装・未試験の修正成功を主張しない。今回新規4領域を含む保持物は本調査で操作していない。

#### 4失敗の是正と関連回帰 — 2026-11-09

人間の実装依頼により、上記方針を実装した。製品変更はDomainの既存資源終了判定の厳密な未発行枝だけであり、Coordinator製品Source、Executor／DI／AI Adapter／Lock製品Source、公開API、保存Schema、保護Policyは変更していない。試験は実wxを使用し、Home／Runtime所在だけを新品Rootへ固定した。旧Home取得hookとCoordinator解放期待、旧Supervisor許可を撤去し、読取り後失効、保存不変、停止下の元Lock照合へ追従した。認証実Docker専用modeの元所在とpacketは維持し、実行していない。

修正途中の結果は履歴として分離する。候補1は二重Module mock登録で4失敗（14,684.4834ms）、候補2はproducer成功・3失敗（76,712.0606ms）で、不要な資源Writer件数の期待と差替え前namespace参照を是正した。Writerは件数だけでなくlifecycle／hostの順序と実搬送を確認する。候補3の元4件は4成功・失敗／取消／skip0、153,362.6513msで完走した。共有Workerの追加6形は認証代役5成功・親停止1失敗であり、SIGKILLなのにsignal=null／status=1を期待する旧assertを是正し、親停止だけの確認は1成功・失敗／取消／skip0、37,826.0816msで完走した。親のcloseとSIGKILLを確認してから停止下処置へ進み、通常終了へ正規化していない。

| 検証範囲 | 最終結果 | 限界 |
|---|---|---|
| Domain Model全回帰 | 484成功・失敗／取消／skip0、349,200.5293ms | Coordinator全体回帰ではない |
| 元Host失敗4件 | 4成功 | 固定Plan・Docker要求0。実AI／Docker E2Eではない |
| 共有Workerの認証通常例外5形・親停止 | 5成功＋修正後の親停止1成功 | 実認証、実create_unknownは未実施 |
| Coordinator周辺3 Fileの非Host回帰 | 26成功・失敗／取消／skip0 | 実行時TEMP／TMPを新品Repository-local Rootへ固定 |
| ExecutorのHome境界 | 2成功 | 観測・Lockの代役と元Request。実Homeは不操作 |
| 共通Lockの実Process／File回帰 | 14成功 | 単一Host・協調Processの有限試験 |
| 親停止／停止下回収の局所反証 | 2成功（回収は正常＋14故障形） | 実Filesystemの故障発生とは区別 |

周辺回帰の初回には、別の既存ITの既定OS TempにあるHost marker作成がEPERMで失敗した。専用Operation Root作成より前の準備拒否であり、検査を緩めず、起動TEMP／TMPを下記新品Rootへ固定した条件で26件を確認した。既定OS領域の過去記録を調査・清掃対象へ拡張していない。新しい製品Configや互換経路を追加しない。

今回の候補途中失敗で新規作成した8 Rootだけを回収する。以前の再確認4 Root（JOJj2Z／NY0tmb／6P7XUi／YoSz0u）と他の過去保持物は対象外。すべて現在Repositoryの `.crdd/tests/` 直下、devは `1687905628`。下表の元Root Identity、非link・canonical Path、全tree照合値（前節と同じJSON配列方式）と関連固定Workerの停止を直前確認し、既知Fileのunlinkと空Directory除去だけを行う。不一致・観測不能なら保持する。回収前の独立確認は、14管理Root／84子Directory、保存Host Pathの範囲と各実体の一致を確認した。追加親停止Rootと新品TEMPも別に確認する。

| 今回Root | ino | birthtimeNs | File/Directory数 | tree SHA-256 |
|---|---|---|---:|---|
| `abandon-owner-D7F0d1` | `22517998139649650` | `1794230933280349300` | 28/35 | `e25f7d752587f382b6747c34815232b76c22c1fefcef4e9dbe427d20ebade3eb` |
| `abandon-owner-VCjE43` | `76279718691408017` | `1794230940451026100` | 28/35 | `4a6f9d3ad613ecb8ea5d5ff7e434cd82a633330132d220cb2b3b1ef9ed7b9752` |
| `abandon-owner-gEsazO` | `14636698791752062` | `1794230936892410700` | 28/35 | `99fa9f2fa2051e63e4f57a3b467f9243171ef67153d939a6da6b3b2dc4d88885` |
| `abandon-owner-ylzVG8` | `80783318316556375` | `1794230929844487500` | 28/35 | `f7e8d24c5df318c91f605f51604578c97920c86e5b86a11c14c8f4bf8905888b` |
| `abandon-owner-MwwVgC` | `89509042594133585` | `1794231039200072200` | 28/35 | `a881f4c7a942b80fd116d3c11228abe7dcf7acb974f0fe2d96489220782fdc08` |
| `abandon-owner-Z0ZGeo` | `11540474047971916` | `1794231058875268500` | 28/35 | `e77923eb0294273d894789f90d24cbb0fc7b8d121896316e1dd5a661ef3b22d6` |
| `abandon-owner-eh9Jud` | `30680772464290568` | `1794231048790943600` | 28/35 | `9b6d0553d2d87aee298ad07b40a0f50bdbe1f34b00a9b2b2a04cd71527ded8cc` |
| `abandon-owner-XFgL1h` | `25614222883466485` | `1794231427853537600` | 29/35 | `9b00ad25db026b425f4511daafa0d16d6505c309804289c04ee55eaf007148f3` |

起動時の新品TEMP `owner-reentry-regression-20261109` は元ino `24206847997300397`、birthtimeNs `1794231411625558000`。終了後は空の非link Directory `crdd-coordinator-recovery-v1` だけであり、Rootとその子の実体・空性を再照合して非再帰で除去する。今回以外のNamespaceへ処置を広げない。

全関連固定Worker／元Lock所有者／今回9 Root参照Processの削除直前照会は一致0だった。元Identityと全量Hashを再照合し、今回8試験Rootの225 Fileを個別削除、280 Directoryを空確認後に除去した。新品TEMPも空NamespaceとRootの2 Directoryだけを除去し、全9 Rootの`ENOENT`を確認した。以前の4 Rootは元ino／birthtimeNsが維持されていることを読取り確認しただけで、清掃していない。実AI・実Docker、過去保持物の操作は行っていない。

最終のDomain／Coordinator型検査、変更4 Sourceの書式・Lint、差分空白検査は成功した。既存Lint Info 3件は警告・エラーと区別する。実装・設計／QA追従と停止下処置Gateの独立確認は残Must-fix 0件。Coordinator全体回帰・実AI／Docker E2E、回復Matrixのready前失敗時の終了確認は今回の完了に含めない。

## 通常Docker CLIの単一Process停止 — 2026-11-09

人間の指示により通常CLIの停止経路だけを整理する。着手前の読取り専用確認で、固定Engine・専用config・shell非使用・組込Container／Network／version操作、Container作成の`--pull=never`と`DOCKER_CLI_HINTS=false`を照合した。この用途はHost子孫の起動を要求しておらず、Container内のProviderはHost CLIの子孫停止では回収しない。通常経路へのPlugin・Build・SSH Transport・任意Host子孫生成の追加は再評価条件とする。

DIの`process/start.ts`からPAのtaskkill補助接続を撤去し、元ChildProcessの`kill("SIGKILL")`を一回だけ発行する。元子closeの有界待機、開始失敗・stream error・出力超過の一次結果、終了未確認時の後続Effect拒否を維持する。killのtrue・false・例外は終了証明ではなく、同じ5秒猶予内のcloseだけを終了根拠とする。Host子孫までの停止保証は撤去した範囲であり、同等置換と表示しない。

通常DIとCoordinator取消試験の人工的な親子Workerは単一Workerへ変更し、元PID・close・不存在を確認する。PID用の旧二要素形状とtree生成、試験Directory作成・清掃の不要処理を撤去する。PAのツリー停止入口・公開MCP検証Script、Browser、DesktopのJob Object・Global Mutex、Container Cleanup・保護Policy・公開API・保存Schemaは変更しない。検証専用の実行説明は単一Process停止へ更新する。

変更分類は技術実行契約の限定と不要中継撤去。必要な確認はProcess／取消の実装レビュー、DI・Coordinator・Executorの型検査、局所・結合回帰、設計／試験記録の直接伝播。着手前確認は不足するProcess観点を読取り専用確認者へ委譲して統合した。独立レビューでは停止の一回性、開始前／終了後・kill失敗・遅延close、後続Effect停止とContainer処置の分離を確認する。実Docker・実AI・過去保持物の操作、他OS対応、Native再Build、準拠・Release監査は対象外。

結果は、DI通常回帰406成功・失敗／取消0・skip5（約20.9秒）、停止／attach直接46成功（実Node Workerを含む）、Coordinatorの関連二ファイル通常回帰122成功、Host単一Worker取消二形と技術説明確認3成功。DIの書式・型検査・LintとCoordinator／Executorの型検査、変更Sourceの書式・Lint・差分空白検査は成功した。Lintの既存Infoは警告・エラーと区別する。独立レビューのMust-fixは0件、指摘された旧補助子コメントを単一元子へ追従した。局所実Nodeは同じHandleのcloseを確認し、人工孫・試験Directoryは作成しない。実Docker・実AI・他OS検証およびCoordinator全体回帰は未実施。過去の120分回帰をこの変更後の全体根拠へ流用しない。

## 子Process環境の用途設定整理 — 2026-11-09

変更分類は実装責務の整理と未使用入口の撤去。事前照合ではPA自身のNative搬送、DI、Coordinatorの共通子環境利用を確認した。全体をDIへ移すとPAからDIへの逆依存になるため、共通中立化・OS所在／Profile検査は一入口に維持し、DI専用のPowerShell五項目投影を既存`docker-cli/environment.ts`へ統合する。未使用のHost終端環境入口と専用試験は代替なしで撤去する。PA外への共通部分の最終移管は未完了であり、新Package・コピー・互換Wrapperを追加しない。

変更しない範囲は保護Policy、Native成果物・Protocol、Process停止、Docker操作・公開API・期限、既存保持物。DI変更の理由は署名確認環境のOwner統一のみ。局所試験は合成の共通環境から実構築関数へ接続し、五項目の同値性・凍結・余分なkeyの非搬送・観測不能時nullと実Native／Docker要求0を確認する。PA公開集合と共通OS選択試験、関連型検査・書式・Lintを確認し、独立レビューで依存方向・同値性と追従を確認する。実境界の変更がないため実AI・実Docker試験、保護Policy採用・準拠監査は実施しない。

局所関連七ファイルの12試験は成功・失敗／取消／skip 0。PAとDIの`check`、Coordinatorの製品／試験型検査、変更したCoordinator試験の書式・Lintが成功した。DIのLintは既存Info 10件を表示するが警告・エラーはない。PA Rootの旧二環境入口非公開と共通入口存続も、実Process操作なしのimport確認で成立した。共通関数抽出の試験が末尾行コメントを巻き込む問題は試験側の改行で是正した。実Native・実PowerShell・実AI・実Dockerと全体回帰は今回は未実施であり、既存の全体回帰成功を変更後の全体成立へ流用しない。今回の局所試験はメモリ・終了したNode fixtureだけを使用し、保持物を作成・操作しない。

独立再レビューは残Must-fix 0件。旧入口削除、共通入口再利用、PAからDIへの逆依存非導入、固定五項目と欠測時拒否、利用側・試験・設計公開表の追従を確認した。PA廃止全体・実OS検証の完了は主張しない。

## Host限定fixture是正の途中停止 — 2026-11-07

### 認証終了の保存順序是正（現在）

#### 2026-11-09の検証再開

前回の通常回帰セッションは再開時に参照不能となり、最終集計を回収できなかった。既知PID・起動日と試験引数に一致するNodeの読取り照会では該当0件だったが、正常完走や全Process不存在の証明にはしない。11月7日時点の局所成功・Host28形成功は保持し、通常全体回帰は結果不明とする。以下の「継続中」は当時の経過であり、現在の稼働主張ではない。

既存Workspace試験一ファイルを通常権限・並行負荷なしで一度確認する。新品の`C:\project\CRDD\.crdd\tests\pa-workspace-verification-20261109-1`へTEMP／TMPと標準TAP結果を固定し、Source Hash・Root実体Identity・開始／終了結果を同領域へ記録する。親の集約枠は1800秒とし、製品・試験内部のTimeoutや安全条件は変えない。異常・時間切れ時は自動再試行せず、子終了や清掃を確認できないものを保持する。成功時もWorkspace限定の根拠であり、通常全体回帰・実AI／実Docker E2Eの成功へ昇格しない。既存の保持物は操作しない。再開時のCoordinator型検査と変更四Sourceの書式・lint確認は成功した。実行条件の独立確認に残指摘はない。

この一回は22成功・失敗／取消／skip 0、164303.5411msで完走した。`status=0`、`signal=null`、`error=null`、`sourceUnchanged=true`であり、Source SHA-256は`2e1584f5f5a905746d053e4a595e819f1b8276288cd4b9383855ad31c8bd2d37`、TAP SHA-256は`4b154184cdf02b32822cd2ea76532051366e371a915fd08b4e4f6304be718f68`。開始は2026-11-09T09:20:16.912Z、終了は同日09:23:01.304Z、runner PIDは33728、子PIDは42120である。旧120秒枠を超える正常完走を確認し、製品失敗ではなく親集約枠が先行していたことを切り分けた。限定結果の独立確認は残指摘0件。

成功Rootは、元Identity（dev `1687905628`、ino `13792273861626177`、birthtimeNs `1794216016905090200`）、非link・正規Path、既知三結果ファイルのhashと空Namespace、対象runner／子とexact Root参照Processの稼働なしを直前再照合してから、この新品Rootだけを回収する。Gate不成立なら保持する。以前のWorkspace二RootとHost六Rootはこの清掃に含めない。通常回帰の再実行はこの清掃後に非並行で一度行い、前回の結果不明を遡及して成功へ変えない。

このGateは全て成立し、新品Workspace Rootの回収・`ENOENT`を確認した。対象PID／試験Source／exact Root参照の照会一致は0件だったが、OS全体のProcess不存在には一般化しない。結果三ファイルのhashを直前照合し、非再帰の既知ファイル削除と空Directory除去だけを行った。旧保持物は不操作。

通常回帰は`pa-portable-verification-20261109-1`の新品Repository-local TEMPで開始した。既存`test:portable`と同じ母集団・Host Windows／Windows Process Gate除外・直列実行を通常権限で一度行い、標準TAPと終了結果を領域内へ記録する。親集約枠は3600秒、内部Timeout・検査は不変。Git管理下の実装・試験等1,133ファイルの開始Hashは`0cd268d8aaddb5942fe00ee8562809a3f02e024592359337aeae5d5def864466`で、終了後の不変性も照合する。開始は2026-11-09T09:26:41.224Z、runner PIDは27432。開始後の経過と終了判定は直下の記録に示し、前回結果不明とは別runとして扱う。

実行中に[既存の通常回帰実績](lock-boundary-design.md#17-設計品質登録とchecker差分の閉包--2026-11-07)の約74.3分を再確認し、今回の親60分枠は先行し得る設定と分かった。着手前にこの時間実績を照合できていなかった点は今回の実行計画の不備であり、製品不具合とは区別する。安全な公開接続で実行中の集約枠を延長する経路はなく、Source・OS保護や内部Timeoutを変えず、この一回の結果を観測する。親枠timeoutなら全体結果不成立とし、捕捉TAPは最終集計でなく観測prefixとして扱う。既知PID系列・exact Root・試験引数に一致する子孫を終了後に読取り照合し、不明・残存時はRoot保持。自動再実行は行わない。この扱いの独立確認に残指摘はない。

この一回は2026-11-09T10:26:41.235Zに親枠で中断した。`status=null`、`signal=SIGTERM`、`error=ETIMEDOUT`、子runner PIDは36708、`sourceUnchanged=true`。通常回帰の最終集計は存在せず、全体結果は不成立である。捕捉TAPは228,094 bytes・SHA-256 `d6c46311d7a79f96a26080e3e2e13bac90d9cf7c369a9862feb0af5ce79e5320`、完結した結果行900・`not ok`行0だったが、これを900件成功や全体失敗0へ換算しない。最後の結果行はHost分類の実test登録だけを数える検査、最後の完全な物理行は`  ...`であった。終了後の実ファイルHashは捕捉時Hashと一致した。

記録runner・子runnerからのPID系列とexact Root参照をWin32 Processの読取りで照合し、一致0件を確認した。観測対象外も含む全Process不存在や正常完走には一般化しない。新品`pa-portable-verification-20261109-1`は`run.json`／`outcome.json`／`result.tap`とNamespaceを保全し、回収済みとはしない。保持理由は中断結果・未完了範囲の再確認であり、本作業の保守担当が2026-11-10までに再評価する。それ以降の保持延長は人間の判断へ戻し、期限だけで自動削除しない。次の全体回帰は既存74.3分の実績を上回る集約枠での新しい一回として判断し、今回は自動再実行しない。Workspace22件成功・専用領域回収、先行Host28形成功は独立した結果のまま保持する。実AI・実Docker・過去保持物は操作していない。

この保全Rootの外部照合基準は、元実体Identity `dev=1687905628`／`ino=23925373020587809`／`birthtimeNs=1794216399907425300`である。top-levelの閉集合は下表の三ファイルと空の非link Directory `crdd-coordinator-recovery-v1`だけであり、終了後の再読でも一致した。再評価・清掃ではexact Rootの正規Path、ここに記録したIdentity、全entryの非link・閉集合・ファイルHash、Namespace空、対象参照Processの稼働なしを同時照合する。不一致・観測不能なら削除しない。Root内の`run.json`だけを外部期待値の代わりにしない。

| 保全ファイル | bytes | SHA-256 |
| --- | ---: | --- |
| `run.json` | 463 | `48767adeede9db842efbbf24e175e4611f5af42534616568c12d1c190197d8c2` |
| `outcome.json` | 252 | `0a74eb9352a25abcf7a8f2c0a1627d3d60ea3085235be36e8e3d716097ae9743` |
| `result.tap` | 228094 | `d6c46311d7a79f96a26080e3e2e13bac90d9cf7c369a9862feb0af5ce79e5320` |

保全条件の独立再レビューは指摘解消・残Must-fix 0となった。これは結果記録・再評価条件の限定確認であり、通常全体回帰の完走やPA全廃の完成を示さない。

#### 承認済み120分枠の一回確認

人間が通常回帰を120分の親集約枠で一度だけ実行し、結果確認と今回作成物の回収まで進めることを承認した。製品の安全判定・内部Timeout、実AI・Docker、過去保持物は変更・操作しない。開始前の対象回帰／Workspace試験に一致するNode読取り照会は0件で、非並行実行とした。

2026-11-09T10:34:13.188Zに新品`C:\project\CRDD\.crdd\tests\pa-portable-verification-20261109-2`で開始した。元Identityは`dev=1687905628`／`ino=92886742314878812`／`birthtimeNs=1794220453188951400`、runner PIDは24364、Nodeはv24.19.0。Source1,133ファイルの開始Hashが前回と同じ`0cd268d8aaddb5942fe00ee8562809a3f02e024592359337aeae5d5def864466`であることを開始前にassertした。同じPortable母集団・Host除外・直列・Git中立環境・新品TEMP／TMP・通常権限で、変更は親集約枠7200000msだけである。標準TAP・開始記録・終了結果を領域内へ残し、終了後にSource不変性を照合する。異常時は再試行せず、不明な領域を回収済みにしない。開始条件の独立確認は追加指摘0件。終了結果と今回Rootの回収条件を直下に記録する。

この一回は2026-11-09T11:42:59.828Zに完走した。正式TAP集計は1,736件中1,731成功・失敗0・取消0・skip5、4126543.1621ms（約68.8分）。`status=0`、`signal=null`、`error=null`、子runner PIDは21612、`sourceUnchanged=true`であり、開始前後の1,133ファイルHashは一致した。Host Windows／Windows Process Gateを除くCoordinator通常回帰の結果であって、実AI・実Docker、全Package一括回帰、全体QA又はPA全廃の完成へは昇格しない。前の60分中断runと結果不明runも成功へ書き換えない。

結果をこのOwner文書へ転記した後、今回の`-2` Rootだけを回収する。元Identity三値、canonical exact、top-level閉集合（下表三ファイル＋空の非link Directory `crdd-coordinator-recovery-v1`）、全entryの非link、各Hash、Namespace空を直前再照合する。記録runner／子runnerのPID系列・exact Root参照も読取り確認し、不一致・残存・観測不能なら削除せず保持する。旧`-1`、以前のWorkspace二Root、Host六Root等はこの清掃に含めない。

| 今回回収する結果ファイル | bytes | SHA-256 |
| --- | ---: | --- |
| `run.json` | 463 | `e3a2ef8de900af702ad17fe97a16425233c3955f7ff714582ad7dcf5206486ff` |
| `outcome.json` | 237 | `db75d2258386b1a300a3f90f3d228812e1c100755648f8fcdf836c05aee98987` |
| `result.tap` | 391989 | `c9f015e9a1095c1c61723bc0d0ad9a6db9fe851b73e4d02a5b2fc02a23a229ba` |

結果・回収条件の独立再レビューは文言2点を是正して残Must-fix 0となった。削除直前に記録PID系列・exact Root参照の一致0、元Root Identity・canonical・4-entry閉集合・全entry非link・三Hash／size・空Namespaceを再確認した。同じShell内で今回Rootの既知三ファイルと空Directoryだけを非再帰で除去し、Rootの`ENOENT`を確認した。今回作成した専用領域の回収は完了であり、過去保持物は対象外のままである。製品Source・安全判定・内部期限は追加変更せず、実AI・Dockerも操作していない。

#### 11月7日時点の修正と検証

人間の追加承認により、Coordinatorの`onResourcesClosed`で認証限定終了の適格判定を一般cleanup保存より先に行う最小修正を適用した。成立時は既存の専用inspect一呼出し・不存在二組・専用Writerへ進む。不成立時は一般保存を維持し、保存後のfresh再読で適格化した場合だけ専用経路へ進む。Domainの一般Writer拒否、Owner・CAS・再起動条件、DI／Executorの製品Sourceは変更しない。

実callbackを抽出するメモリ試験へ、一般保存後の適格化、観測不明、保存・読戻し失敗、段階別Owner失効を接続した。関連12試験・Domainの一般Writer拒否1試験・Coordinator型検査と変更TSのlintが成功し、独立再レビューのSource必須残指摘は0件。Architectureへ保存順序とfresh再読を追従した。

認証Host一例は、専用保存・履歴確定・操作除去・Host回収まで進んだが、親の改訂数期待値が旧15更新のため実14更新と不一致で停止した。一般cleanup保存を重ねなくなった一回分の差であり、期待値を14へ追従し、認証fixtureには一般cleanup保存0回の明示検査も追加した。子の終了とHost・marker・排他不存在は確認済みで、親Rootは既存finallyのIdentity照合付き回収を通った。追従後の認証一例は成功し、専用保存1回・inspect一呼出し／不存在二組・元失敗保持・履歴一行・操作除去・新品領域回収を確認した。追加試験差分の独立再レビューも残指摘0件。関連回帰62件は成功し、Host確認結果は直下に示し、通常回帰は継続中である。今回保持中の六Rootと過去保持物は操作していない。実Docker・実AI・全体回帰の成功は主張しない。

修正候補のHost確認は認証1形・後続24形・基本3形の全28形が成功し、各成功形の新品Rootを既存のIdentity照合付き清掃で回収・不存在確認した。通常Writerの経路も同じ候補で再確認しており、先行候補との無条件合算ではない。実Docker／AI E2Eではない。

通常回帰では制限環境のrename／junction作成拒否が露出した。同一のNamespace／coverage三試験・Repository六試験・tmp親alias一試験は通常権限下で成功し、専用TEMPを使った後二集合は回収・不存在まで確認した。診断で残った`node-namespace-KL9O1C`も、exact Rootの正規Pathと非link・唯一の空child・前後の実体Identityを確認して回収した。Workspaceの全fileと二Task除外fileの同条件確認はいずれも親120秒で終了し、`auth-closure-workspace-regression-20261107-1`／`auth-closure-workspace-regression-20261107-2`を保全した。該当試験Source名と記録PIDに限定するCIM読取りではNode子0件だったが、成功や全Process不存在の証明にはしない。二つの時間切れから用途差や製品失敗は推定しない。通常回帰は実処理を続けており、完走集計前に全体成功へ換算しない。

### Process境界の是正候補（先行経緯）

現在は、親Git準備と全Node子のProcess境界を閉じた候補で確認している。親Gitは固定init／空Commit、空templateと明示info/exclude、GIT設定・Hook・署名・fsmonitor遮断、有界の実行へ固定した。メモリ内の境界・診断・反例11試験、型・書式・lintと限定独立レビューは成功している。製品Source・製品Timeout・公開APIへの追加変更はない。

この最終境界でnone／driver／通常CLIは、Operation・履歴・Host清掃と新品Root不存在まで成功した。通常CLIの旧60秒枠では期限直前まで保存が進んだが最終退役前に停止したため、通常CLI三形だけを既存restart形と同じ子120秒／外側180秒の試験枠へ揃えた。他の試験期限と製品期限は維持する。修正後通常CLIはstatus 0で終了し、当該例の処理完了後handle待ちも反証した。

認証restartは`docker_task_recovery_execution_unconfirmed`で不合格停止し、非同期側の固定診断を補って一例だけ再試験した。元Session・引数・Completionを置き換えず、技術結果とcheckpoint結果の非秘密fieldだけを観測した。既存5 keyと3観測値・重複を検査し、観測要素も閉fieldへ新配列投影する。診断再試験も不合格で停止し、後続24形を発行していない。以下の先行成功は親Git固定前の時点を区別し、同じ完成主張へ無条件合算しない。

診断ではasync五応答と全模擬子のspawn／exit／close各一回、Process終了・資源回収・config回収を確認した。一方、`onResourcesClosed` が認証unknownのabsenceを通常checkpoint Writerへ先に保存しようとして、Domain Storeの `coordinator_state_authentication_closure_owner_required` で拒否された。専用の二回観測と認証終了Writerは呼ばれていない。DI結果や試験の期待値を緩める問題ではなく、Coordinatorの通知handlerが適切な保存Ownerへ渡す順序の不整合である。純粋モデルの候補作成成功は、通常Writerの保存権限を意味しない。

最小是正候補は、既存の認証終了適格判定が成立する対象だけを通常cleanup保存へ通さず、既存の専用二回観測・専用Writerへ接続することである。Domainの拒否条件、再起動Scope・元ID／Receipt・Owner・CASと他の通常回収は変更しない。現在は試験／fixtureの是正範囲として進めてきたため、Coordinator製品Sourceの追加修正は行わず、人間へ対象範囲の確認を返す。全体回帰・回収完了を主張しない。

現在保持する今回分は、A二失敗の `current-host-transition-18648-vPWiGa`／`current-host-transition-32032-2kskZp`、制御停止した `current-host-transition-2680-NXXmZE`、通常CLI旧枠の `current-host-transition-21368-o0Mlyz`、認証の `current-host-transition-40348-106cgU`／`current-host-transition-18656-ruvX4P`。制御停止Rootの親PID・exact回復IDに限定するCIM読取りは該当Node 0件だったが、OS全体の不存在とはしない。過去45 RootのDocker影響未確認とは別管理であり、どちらも現時点では回収未完了である。

製品Sourceを変更せず、Worker本体・通常CLI子・認証CLI子へ、Process入口の既定拒否を接続した。同期／非同期は呼出入口から明示し、実Nativeへ渡すのは所在読取り二形と固定optionsだけとする。再入場Node子は固定本文と対象IDを照合する。直接Driverと通常CLIは同じ保存済み不存在の四応答を使い、未知要求を実Dockerへfallbackしない。終了時は模擬子のclose・stream終端と全入口の復元を確認する。

メモリ内の境界・反例七試験とCoordinatorのstrict型・書式・lint検査が成功した。独立レビューで不要なGit許可を撤去し、Node子三正例と原始AssertionErrorの遮断を追加した。拒否診断はchannel・要求番号・生成Sourceの数値位置だけとし、元の引数・環境値・例外本文を搬送しない。

最初の修正版Host代表四例（driver／通常CLI／identified／認証再起動CLI）は全て不合格で停止した。実Dockerへのfallbackはなく、合成応答の検査不一致を記録した。製品のWindows環境はProxy名を空文字で中立固定するが、試験がundefinedを期待していた不整合を確認し、試験だけを追従した。再レビューは必須指摘0で、identified代表一例がHost保存・回収・新品Root不存在まで成功した。残る27形は一例ずつ実行し、不合格が一つでも出たら以後を発行しない。

新たな四Root `current-host-transition-19024-20OwBn`／`current-host-transition-19024-GFYpfi`／`current-host-transition-19024-tt8VdQ`／`current-host-transition-19024-NilYz9` は試験親19024の今回領域として保全する。修正後代表一例の新品Rootは試験内で回収・不存在確認済みであり、先行保持物の回収とは区別する。

当該四例の親Node 19024はexit 1で終了し、各同期子はerrorなし・signalなし・status 1を返した。閉じた子入口の実OS要求は同期Native所在読取り二形と同期Node子だけで、Docker応答は合成である。OS全体のProcess不存在はCIM権限不足で未確認だが、今回発行した同期子の終了結果とは区別する。独立確認は、直前のexact Identity・祖先非reparse・全manifest・自己完結Git・固定fixtureを照合し、一件でも不一致なら以後停止する条件で、この四Rootだけの回収を妥当とした。

回収前manifest（Root親は `C:\project\CRDD\.crdd\tests`、各58 entries）:

| Root名 | manifest SHA-256 |
| --- | --- |
| `current-host-transition-19024-20OwBn` | `b667394f8d69f5dfc66c467fa047dbfacd649147342a63ac15df5a380837fb3e` |
| `current-host-transition-19024-GFYpfi` | `80b5c702e9620f5427469ddb8335a65ae278348521a8f99c6721750e1fbf82c3` |
| `current-host-transition-19024-tt8VdQ` | `01ebbf62cead81bd3b14e1a6016b0aa20d0019ef6ec727cafd23b797318cfad1` |
| `current-host-transition-19024-NilYz9` | `28256d931f160eda33d133664db5f549a79582693c45d80adfd5369a847c8156` |

上記四Rootは、同一Shell内の直前照合で元bigint Identity・祖先と全entryの非link・manifest完全一致・自己完結Gitを確認し、個別のLiteralPath削除と不存在確認を完了した。元45 Root・過去13 Rootは触れていない。

後続の逐次試験はnone／null_outcomeが各成功・新品Root回収済みとなり、Aで停止した。Aの再入場子が故障名を資源BookとしてJSON解析していた搬送漏れを確認した。通常入口のBookはargv[4]、cleanup／history／delivery再入場のBookはargv[5]へ固定し、子発行前に現在stateの同ID Bookとの完全一致も検査する。次の一回は、async回収APIをawaitせずstatus判定していた旧前提で停止した。待機と現行Signal引数へ訂正し、Ownerの早期拒否理由と下位Effect呼出0も確認する。await省略・下位Effect発行を反例へ追加したメモリ八試験、型・書式・lint、独立再レビューが成功した。

修正後Aは成功し、新品Root回収・不存在まで確認した。残る24形を一例ずつ失敗時停止で実行中で、未実行分は合格に含めない。旧A Root `current-host-transition-18648-vPWiGa` と `current-host-transition-32032-2kskZp` はこの二失敗の今回領域として保持している。

これらの結果は過去のDocker Effect 0や資源不存在を証明しない。既存の今回試験物は保全し、回収未完了を維持する。以下は先行試験の停止経緯であり、「是正未適用」は当時の状態を示す。

### 許可された読取り確認の結果

人間が今回の合成資源名・所有Labelに限定したDocker読取りを追加許可した。固定fixture記録・内部Host Path・remoteなし・元実体と照合した今回45 Rootから89個の所有Labelを抽出し、固定ローカルEngine `npipe:////./pipe/dockerDesktopLinuxEngine`へ、試験専用の空configを指定して最初のContainer一覧一件を要求した。exit 1・signalなしで、指定Pipeの不存在により接続できなかった。残りのContainer／Network要求は発行していない。

結果は観測不能であり、対象資源の現在不存在・過去Effect 0・Docker資源回収完了は主張しない。Dockerの起動・再起動・Image更新・資源削除は行っていない。設定用の自作空Directoryは元実体・空性の確認後に非再帰回収し、不存在を確認した。現在のDocker資源影響の確認と試験物の回収は引き続き未完了である。Engine起動は今回の許可範囲外のため実行せず、非同期入口の代役是正・非Process反証・独立確認も未完了のままHost試験を停止する。以下の読取り未許可という記述は、この追加許可以前の停止経緯である。

人間の追加承認により、既存Host限定試験の不整合を試験・fixtureだけで是正し、回帰・独立レビュー・今回試験物の回収まで進める範囲へ再開した。製品Source・公開API・保存Schema・Safetyは追加変更しない。実AI・Docker・過去保持物は操作禁止である。

各新品fixture内へLOCALAPPDATAの共有Home／RuntimeState親を明示準備した。通常形は元のcommand_wait失敗・Create応答Receipt欠測・Host清掃未確認を維持し、既存Writerのsubmission→後続identified→合成absent保存で技術資源の終端とHost清掃を分離した。各保存の改訂・元版Hash・別Operation不変を確認し、通常none形は実Host遷移・清掃まで成功した。特殊形ではReceiptと実体観測の混同、発見APIの旧引数、DIへ渡す合成資源名の不適合を試験側で是正中である。型検査は成功したが、特殊形と全体回帰は未合格である。

追加の境界診断で、旧fixtureが同期spawnSyncだけを代役にし、DI共通Lifecycleの非同期spawnを覆っていないことを確認した。先行する特殊形・全件試験で実Docker CLIが発行された可能性を否定できないため、全件試験の親Node 19604と子25976を、その相関を確認して停止した。CIMでその二Processの残存0を確認したが、これはDocker資源不存在・過去Effect 0の証拠ではない。実AI送信、Docker再起動、Image更新は要求していない。Dockerの現在一覧取得も人間の禁止範囲に含めて行っておらず、実資源への影響は未確認である。

着手前の独立確認では、両Process入口の同時差替え・閉じた引数検査・非同期の実Process fallback禁止・両方の復元・模擬子の正規終了・未登録入口の発行前拒否を再試験前のGateとした。この是正と非Process反証は未適用で、Host試験の再実行は停止している。実Dockerの読取り専用確認を追加許可するか、確認せず保全を続けるかは人間の判断待ちとする。不明資源の処置や削除は今回許可へ含めない。

今回の試験領域は`.crdd/tests/host-fixture-3701ffb508b646e09aa0e1de005bc4f5`、先行のNamespace run領域と、その28形＋再確認1形に対応する29個の自己生成Git候補である。候補は実行範囲・固定fixture記録・内部Host Path・remoteなし・捕捉済みbigint実体と結合したが、現在の実資源影響が未確認のため回収しない。新たな失敗Rootはpid付きのexact Pathを試験結果へ保持した。これらより前の13個の同prefix領域は対象外であり、内容の読取り・変更・削除を行っていない。今回分の回収も全体回帰・独立レビューも未完了で、Sourceの先行限定Passへ換算しない。

## Namespace初期化のNode統合 — 2026-11-07

人間がNode中心案Aの保証範囲を承認した。通常回復Namespaceの専用SID／protected DACL・祖先Handle・主体事前検査を外し、Coordinatorの本番作成を既存`createOwnedOperationDirectories`へ直接接続した。専用TEMPの保護はOS設定・運用の前提であり、Nodeが共有・保護不明TEMPを検出拒否する保証はない。Provider Home／Runtime、Desktop、保存形式・Token／Hash、処置許可・Lockは変更しない。

変更分類は限定的な保護Policy変更と専用処理の撤去である。着手前整合確認ではNodeの実体確認とNative保護を区別し、現行Capabilityと過去Evidence、配布Nativeの全利用側を照合した。実装・利用側の独立レビュー、文書・横断影響確認を実施対象とする。準拠基準・Releaseを変更しないため、全準拠／Release監査は追加しない。実AI・Docker・過去保持物は対象外である。

PA専用5 Source、専用検証7 File、Root export・CLI mode・module登録を撤去した。旧modeはCRDDPR03で拒否する。残る共用principal・filesystem保護・Artifactは維持し、PA製品SourceはTS11・Rust16となる。台帳から退役7試験を除き、CoordinatorのNode結合試験を通常実行へ移した。退役Oracleは廃止として記録し、Nodeの成功へ換算しない。

最終Sourceの固定target出力一件から配布Nativeを更新し、239,616 bytes・SHA-256 `163dc20df916a484901f7d41ebe9a820f6f2ce23cf68358a3aa57322ad297df0`をbootstrapと合成fixtureへ反映した。置換前の既知Runtime Ownerの限定観測は0件で、実行中Sessionや既存記録の期待値は変更していない。既知入口の観測を任意の埋込みProcess全体の不存在証明とはしない。先行BuildからはPE timestamp等24bytesが変化したため、反復Buildの同Hash・再現可能Buildは主張せず、今回採用した一出力へ結合する。

最終候補の局所結果はPA通常73件、Coordinatorの記録・Operation生成・Host再入場等42件、Checker20件、VC13件成功。Rust30件成功・実環境向け9件未実施、DI通常402件成功・5件対象外、Executor通常114件成功である。配布実物でも退役mode3形の拒否、所在2形・新品File Entryの正常読取りの計6検査が成功した。型・書式・Rust Clippy（全target）とCatalog431件整合を確認した。全体Checkerは既存3,787件の失敗を返し、今回の対象Namespace／PA設計に対応する新規指摘はない。正式QA全体、実AI／Docker、POSIX実境界、service等の新しい利用形態は未成立。

独立レビューで、退役Symbolを参照するChecker代表二件、POSIX linkの回収API、Source固定前Buildと配布の結合、試験Headerを指摘され是正した。退役代表の意味を別IDへ付替えず、存続する一般検証は維持した。Source・文書の限定独立再レビューは完了し、今回対象の残る必須指摘は0件である。全体QA・Host限定fixture残件の完了へは拡張しない。

#### 追加回帰で露出した既存Host試験の不整合

`current-host-transition.integration.test.ts`のHost限定28形は、新品LOCALAPPDATAにProviderHomes／RuntimeStateの親Directoryを準備していない条件で、回復準備等が停止した。自作の親二領域を明示準備してnone一形を再確認すると準備は通ったが、`confirmRuntimeOwnedDockerTaskHostAbsence`のtrue期待で失敗した。fixtureはphaseをsettlingへ進めても資源記録はnull、outcome.cleanupConfirmedはfalseとし、現Domainの`coordinatorTaskResourcesAreSettled`が要求する成立条件を満たしていない。初期の「executingのまま」という原因候補は、この値構成の照合により訂正した。該当製品三関数の構文抽出本文は基準`53209fad7`と完全一致し、子fixture全体もNative mode許可配列以外は一致した。Nativeモード許可の差分は別のidentified分岐だけで、このnone形には到達しない。

製品の安全判定を緩めて通さず、Host限定fixtureの新保存契約への追従を残件とする。失敗した今回の自己生成Repositoryは試験の保全条件に従い保持し、実Docker資源の作成・消失や清掃完了を推定しない。既存保持物は操作していない。担当は本作業の実行者、保持上限は次のHost fixture是正判断までとし、追加のHost反復前に根拠とexact対象の特定、参照・非使用・元実体確認を行う。確認不能なら回収せず人間判断へ戻す。したがって全体回帰・全試験物清掃完了は主張しない。

以下の計画・Evidenceは当時の判断履歴であり、現在の採用範囲を上書きしない。

## PA廃止に向けた処置計画 — 2026-11-07

状態: 調査・方針候補。基準Commitは`53209fad7`。人間の継続指示はPA廃止に向けた整理であり、ここでは製品Source・保護Policy・保存形式・配置・公開APIを変更しない。実AI・Docker・過去保持物の操作、NativeのBuild／配布、新Packageや代替監視は対象外とする。

### 今回の調査判断

PAの残存SourceはTypeScript 12・Rust 20で、未使用だから即時削除できるファイルは今回確認していない。ただし、利用中であることは各保証を永久に残す理由ではない。必要な利用者成果と失敗影響から、既存Ownerへ戻す処理、Node.js標準へ簡素化する処理、保護条件の変更判断を分ける。

着手前にPA詳細、Coordinatorの通常Operation生成、DIの環境／修復／実体処置と既存試験を照合した。変更分類は廃止候補の影響分析と設計候補の訂正であり、現行保護を撤廃する採用判断ではない。読取り専用の独立確認で境界と不足を確認し、記録後に限定的な文書・影響レビューを行う。実装や規範・Releaseを変えないため、それらの全面回帰・準拠／Release監査は追加しない。

先行の「Namespace二段を先に統合する」という推奨は修正する。NativeはWindows保護を、Nodeは処置後の実体を確認しており、同じ検査の重複ではなかった。編成や名前をまとめるだけではPA依存・Native処理が減らず、不要なWrapperへ置換する作業は行わない。技術条件と外した場合の影響は[PA詳細](../../../06_Architecture/Details/platform-access/01_Architecture.md#nodejs側への統合承認済み)を正本とする。

### 残存機能の処置と順序

| 順序・対象 | 利用先／意味のOwner | 廃止へ向けた処置候補 | まだ決めないこと・必要な判断 |
|---|---|---|---|
| 1. Namespace初期化 | Coordinatorの通常Operation作成 | 既存NodeのDirectory初期化を正本とし、厳密なWindows保護を不要と判断できた範囲だけNative初期化・専用Protocolを撤去 | SID／DACL／祖先Handleの必要性を別々に判断。通常回復記録・Root／Path／実体確認は削らない。単なる入口結合を先行しない |
| 2. Runtime State／Provider Home | Coordinatorの所在・Capability・Home使用 | 必要なPath・実体・同時利用条件をOwnerに残し、独立したNative観測を減らせるか評価 | 認証Homeは秘密情報を含み得るためNamespaceの判断を流用しない。OS主体・他利用者からの保護を外す影響は別判断 |
| 3. OS既定所在・子環境 | Coordinator／DI／存続するNative搬送 | Nodeで取得できる値と、必要なコマンド差分だけをOwnerへ統合 | System Windows API／Known Folder値を環境変数や推測Pathと同値とはしない。全Callerの所在・環境契約を揃えてから共用搬送を撤去 |
| 4. Entry観測・tree終端 | DI、終了確認を行う検証Tool | 実体処置・Processの既存Ownerへ技術責務を集約。taskkill等の必要なOS差分は薄く残す | raw reparse tag・Native File Identity、子孫終了をlstatやchild.killだけで確認済みにしない。DIを変更する場合はPA依存の解消に必要な理由と差分を事前表示 |
| 5. Desktop HelperとGlobal Mutex | DIの修復／再起動 | OS固有の実処置は最後に残す。Mutexは[比較条件](../../../06_Architecture/Details/platform-access/01_Architecture.md#desktopの排他を共通lockへ寄せる場合の境界)を満たすなら共通Lockへ寄せる候補 | Repository／Session横断Scope・利用者結合・Helper保持区間・Crash残存の変更を確定前に採用しない。Job・Publisher照合の存廃も別々に評価 |
| 6. Artifact照合・共通Protocol・Build／配布 | すべての存続Native利用側 | 最後のNative利用側が消えた場合にまとめて撤去。Nativeが残るならその技術Ownerへの最小配置を別途確定 | PAを消すためだけに各OwnerへArtifact確認をコピーしたり、第二の共用Packageを作ったりしない |

OS固有処理が必要と判断された場合も、それがPAという独立Packageを必須にするとは限らない。ただし、この段階でCoordinator／DIへ分割コピーした最終構成を固定しない。必要と採用された技術機能が残った時点で単一の実装Ownerを確定し、配布物・Build・Consumerを一括で追従する。移動だけをNode化・Native撤去と表示しない。

### 次に具体化する最小範囲

Namespaceだけを対象に、通常回復記録に必要な保護と、既存の厳密SID／protected DACL／祖先Handleの追加保証を分ける。比較案は次の二つとする。

- Node中心案: 利用者専用の適切な所在、固定child、非link・正規Path・元実体、EEXIST後のfresh検証、初期化失敗の部分Effectと回復参照を維持し、厳密なWindows主体／ACL／Handle照合を撤去する候補。Nodeのmode 0700をWindows DACLの代替とは表示しない。
- 現Policy維持案: Native先行→Node fresh再検証の順を維持する。追加Wrapperは作らず、PA廃止の残件としてNative初期化を明示する。Node中心案の保証変更を採用しない限り、Namespace Nativeを不要とは扱わない。

推奨は、ローカル単一利用者の想定と共有Hostの実利用を分け、Namespaceに必要な最小保護を先に確定すること。現時点ではどちらのPolicyも新規採用していない。Rootを変更する案が必要になれば、既存回復記録の所在・再入場・旧領域保全を別途設計し、自動移動や清掃を追加しない。

次の表は現契約の観測事実と、これから判断するアクセス条件を分けた材料であり、新しい許可・禁止の採用ではない。Coordinator実行主体と選択利用者は、Path文字列だけから同一と推定しない。

| 主体 | 現契約の事実・根拠 | 必要／禁止アクセスとして判断すること | Node中心案の限界・不明時の扱い |
|---|---|---|---|
| Coordinatorの実行主体 | Nativeがprimary tokenと複製したimpersonation tokenを観測し、選択利用者の条件へ結合する。`principal.rs`／`host_namespace.rs` | 初期化・通常記録・再入場を誰の権限で行うか。service／restricted／AppContainer等の現在の拒否を残す必要があるか | os.userInfoやPathだけでは現在のToken条件を同等に証明できない。必要と採用する条件を観測できなければNodeだけの案は成立としない |
| 選択利用者 | 現Nativeは利用者SIDをownerとし、protected DACLの利用者／SYSTEM二ACEを照合する。`protected_file.rs` | 自己の回復記録を読み、保存・訂正・許可済み再入場を行える範囲。別利用者の記録への横断アクセスを許すか | NodeのPath・非link・実体確認は可能だが、厳密なSID／二ACE検査の代替ではない。保存場所の既定保護に依存するなら、その前提を明示して採否 |
| SYSTEM | 現DACLにアクセスACEがある。これはSYSTEMを選択利用者として起動できる意味ではない | SYSTEMによる記録アクセスが必要か、OS運用上のアクセスを許容するだけか。現在の二ACEを自動的に必須要件にしない | Nodeだけで同じACE構成を確認したとは扱わない。必要性を判断してから厳密検査の存廃を決める |
| 他のlocal user／別SID | 現行の固定DACLは追加主体へのallow ACEを受け付けない。管理者特権全般からの保護を証明するものではない | 内容の非開示、記録の改変防止、他者による回復妨害を、それぞれどの利用形態で必要とするか | 共有親の継承ACL次第で読取り・改変を許す可能性がある。必要条件が不明なら保護を外して実行しない |
| 別Windows Sessionの同一SID | 同一SIDはDACL上別主体にならない。非zero Session等のToken条件だけでSession間の遮断を保証しない | 同じ利用者による複数Sessionの共有・再入場を許すか。禁止するなら現方式もその保証を持つか確認が必要 | 新しいSession隔離を今回追加しない。共有を許す場合も排他Scopeと回復の全利用者停止条件を別途確認 |

Namespaceについて、機密性（誰に読まれてよいか）、完全性（誰が書換えてよいか）、回復可能性（誰が同じ記録へ再入場できるか）を別々に採否する。記録を読めることを削除・再実行許可へ昇格しない。現在のToken／SID／DACLの検査成功を、これらの業務上の許可と同一視しない。未確定の間は現Policyを維持する。

### Namespaceの具体的なNode化案 — 2026-11-07（提案時の記録、現在は上記Aを採用）

Sourceの静的照合を追加した。通常Host回復記録のSchemaには、状態、生成Root名、Root／子の実体識別情報、作成時刻があり、Prompt・認証値のfieldはない。ただし内部の相関値であり、公開可能や完全性不要という判断にはならない。改変は回復拒否・妨害にもつながる。参照Tokenのnonce・recordHashは同一記録への相関であり、MACや処置許可ではない。

`operation.ts`のNode Writerは固定childへwx保存・sync・読戻し・元実体照合を行う。`recovery.ts`のReaderは期待Root、親境界、非link、記録Hashと読取り前後の実体を照合する。現在のNative初期化後も、通常Node Readerが毎回SID／DACLを再証明しているわけではない。処置許可・排他・回収対象の照合は別Ownerが維持する。

| 区分 | 最小の変更案 | 変えないもの |
|---|---|---|
| 本番作成 | 私有`createProtectedRuntimeOwnedOperationDirectories()`を撤去し、既存のproduction Dependencies.createDirectoriesを`createOwnedOperationDirectories`へ直接接続 | Nodeの固定child・Root範囲・実体・EEXIST後のfresh検査、記録の初期化失敗と回復参照、上位の実行認可 |
| PA専用処理 | TS `host-record/namespace.ts`と、Rust `host_record/mod.rs`・`host_record/windows/host_namespace.rs`・`host_record/windows/protected_file.rs`・`protocol/host_namespace.rs`を撤去候補とする | Home／Runtime観測にも使う共有principal・filesystem保護・Artifactは残す。PA全体が消える段階とは扱わない |
| 入口・保存 | PAのNamespace exportとNativeの専用observe／initialize mode、module／dispatch登録を撤去し、旧modeは一般の不正要求として拒否 | Coordinatorの公開Request／Result shape、既存保存Path・Schema・Token／Hash相関。旧Readerや自動データ移動は作らない |

新しい関数・Adapter・設定スイッチ・Storeは不要である。NodeでのFilesystem失敗は既存分類へ接続する一方、廃止したNative初期化固有の拒否理由が新規発行されなくなる点は挙動変更として扱う。service・restricted Token等をNative入口で先に拒否する条件も外れるため、その利用形態の対応成立まで確認済みとは主張しない。

#### 採否が必要な保証変更

| 案 | 保証・前提 | 利用者への影響と採否条件 |
|---|---|---|
| A. Node中心 | 通常回復Namespaceについて、専用TEMPの保護をOS設定・運用へ委ね、厳密なSID／protected DACL・祖先Handle照合を外す。同一OS利用者・同SID別Session・管理者による非協調改変をこの追加防御の対象にしない | 最も処理を削減できる。ただし専用TEMPの保護は観測済み事実ではなく、受容する運用前提である。共有・保護不明TEMPを自動検出して停止できず、他SIDの読取り・改変を排除できない環境では秘密でない記録でも漏えい・回復妨害のRiskが残る。この限定を受容する人間判断が必要 |
| B. 主体／ACLの実行時確認を維持 | 現Native先行→Node再検証を維持し、保護不適合を実行時に停止する | 強い確認を継続できるがNative処理は減らない。現配置ならPA依存が残る。必要能力を既存の単一Ownerへ移管してPAだけ廃止することは別途可能であり、強い保証の採用自体はPA存続を意味しない |

Aはローカルの協調運用を前提に処理を減らす候補であり、共有Host全般の安全性・実行時のACL検査との同等性は主張しない。Bは単に「従来存在したから必須」とせず、実際に他主体から守る必要があるかを上記のアクセス表で判断する。Provider Homeの認証情報保護は、どちらの採用にも含めない。現時点ではA／Bの新規採用を行わず、製品実装を停止する。

#### Nodeが検出できること・できないこと

次はSourceから導いた条件であり、今回新たに実OSのACLを変更・実測した結果ではない。

| 条件 | 既存Node経路が確認すること | 確認できないこと／変更時の反証 |
|---|---|---|
| 環境変数等でTEMPが変更される | os.tmpdir由来の所在を正規化し、実Directory・固定child・元実体を確認 | 所在がOS利用者専用とは証明しない。環境値をACLの根拠にしない |
| 別SIDが書込み可能なTEMP／child | 正規Path・非linkでもNodeの型／実体条件は成立し得る | 他SIDの書込み可能性をNodeだけで検出拒否できない。これを拒否必須とするならAは採用不可 |
| Nativeが以前作った保護済みchild | 同じPath・実体を再利用し、既存記録を通常形式で読める | 保護を再認定・修復しない。今回既存領域を観測・移動・清掃しない |
| Nodeが新規childを作成する | mkdir・EEXIST競合後のfresh検証と部分失敗分類を行う | mode 0700はWindowsの厳密DACL保証ではない。継承・既定ACLを人間の運用前提と明示する |

#### 実装を承認した場合の追従単位

- 製品5 Sourceの削除だけでなく、`native/main.rs`、`native/protocol/mod.rs`、PA Root exportとCoordinatorの本番接続を同時に追従する。
- PAのNamespace TS／Rust試験、`host_namespace_creation.rs`、`windows_protection.rs`の該当部、`native_cli.rs`、Artifact／公開集合試験を分類する。退役するSID／DACL・専用ProtocolのOracleは廃止として記録し、Node成功へ偽装しない。
- Coordinatorの`host-recovery-namespace.integration.test.ts`・`native-tool-process.contract.test.ts`、Operation生成・保存・再入場試験へ、Nodeの正常・Path／link拒否・実体差・EEXIST競合・部分作成・rollback複合故障・記録改変拒否の反例を維持する。未接続のOrphan Recovery候補を本番化しない。
- `verify-native-protection.ts`、`check-platform-access-coverage.ts`、PA／CoordinatorのSymbol、Test Catalog、Architecture／QAを追従する。存続するHome・Runtime・Desktopの検査は削らない。
- 最後に必要なNativeを固定targetで再Buildし、専用mode撤去を配布物自身で確認する。Artifact／bootstrap期待値・固定配布物・利用側fixtureを同じ版へ追従し、古い実行中Sessionの期待値を新baselineへ黙って更新しない。実AI・Docker・既存領域の操作は別許可とする。

この具体案の独立レビューでは、専用TEMP保護を運用前提と明示する点、強い保証とPA存続を分離する点、撤去対象の試験／登録／配布までの閉包を補完し、再レビューは今回の調査案に限定してPass・残必須指摘0となった。Source・Policyは未変更。文書差分の空白検査は成功し、Checkerは既存3,787件・exit1で直前版と指摘集合が完全一致、対象文書の新規指摘0だった。現在の人間判断はNamespaceに限るA／Bの採否一件であり、Home等の保護変更や実運用領域の処置を含まない。

### 既存根拠と変更時の確認

| 境界 | 基準版の既存根拠 | 次の修正で反証すること |
|---|---|---|
| NamespaceとOperation生成 | PAの`host-record-namespace.contract.test.ts`、Rust `host_namespace.rs`、Coordinatorの`host-recovery-namespace.integration.test.ts`／`operation-creation.contract.test.ts` | Native拒否・部分作成・close不明、Native成功後のNode実体差、mkdir競合、Root生成失敗とrollback複合故障。合成値だけで保護済みとしない |
| Home／Runtime観測 | PAの`root-observation.contract.test.ts`／`filesystem/protection.contract.test.ts`、Coordinatorのauthority利用側 | 主体・元実体の不一致、不明、後発置換、Home排他Scope。Namespaceの許可を流用しない |
| 所在・Entry・終了 | PAのSystem Directory／LocalAppData／Entry／child-tree既存試験、DIの処置Caller | 不明と不存在、環境差、reparse・別実体、元子closeと子孫終了の区別 |
| Desktop／Artifact | PAの`desktop-helper.contract.test.ts`／`artifact-identity-observation.contract.test.ts`、DIの修復／再起動回帰 | Mutexの全Scope・Crash後意味、Helper生存中の保持、Job終了、Publisher／Artifact前後差、取消・終了不明。実修復は別許可 |

各段で公開入口と全Consumer、試験／Script、Symbol・台帳・Architecture、Build・配布を同じ意味で切り替える。撤去前に旧呼出し0、削除した責務・型・状態、正常／拒否／部分Effect／終了不明と終了後条件の対応を確認する。実境界未実施を成功に数えず、Nodeへの移動だけで同等保証やPA全廃を宣言しない。

PA廃止の最終Gateは次のとおりとする。Native全廃と、必要なNativeを既存技術Ownerへ移管してPAだけ廃止する結果は別に表示する。

- Nativeが不要と判断された経路は、最後のPA Native利用側を切り替えてから共用搬送を撤去する。存続を採用したNativeがある経路は、先に単一Owner、実境界の検証、Build・Artifact・全Consumerの移管を確定し、PAへの依存を閉じる。
- PAのnpm／workspace／Cargo manifest上の依存、import、Script、Test Catalog、Symbol、試験登録に現行参照が残らない。過去Evidenceの参照は固定版へ結び、現行入口として復活させない。
- PAのCargo／build.rs、固定配布binary、追跡済みBuild入力、bootstrap Hash期待値、配布Manifest・生成手順の現行参照が残らない。必要な技術Ownerへ移管したものは、PA名の旧資産との二重正本にしない。
- PA由来の入口・Artifact・Build・Consumerの参照0を確認してPackage Rootを削除し、削除後に型検査、構造Checker、必要なBuildと利用側の正常／拒否／異常回帰を確認する。既存の別件Checker指摘は切り分けるが、新しい未解決依存を許容して廃止完了とはしない。

今回の結果はSourceの静的調査と文書整理だけである。基準版の回帰結果は[Lock整理の記録](lock-boundary-design.md#16-整理後候補の全体回帰--2026-11-07)に保持し、今回の未実装候補の検証成功へ流用しない。

独立レビューで不足していた主体別アクセスの判断材料とPA最終撤去Gateを補い、再レビューは今回の計画差分に限定してPass・残必須指摘0となった。文書3件だけの差分で製品Sourceは不変更、差分空白検査も成功。整理中のRepository Checkerは既存3,787件・exit1で、基準と指摘集合SHA-256が一致し、対象文書の指摘と追加指摘は0だった。実装回帰・実AI・Docker・過去保持物を今回新たに試験した結果ではない。

## 現在の位置 — 2026-11-07

共通Lockはwx方式の3 Sourceとなり、CurrentState・共有Home・Runtime状態・Host操作に続いてEI／Topic／Meeting／一時Operationも同じ取得・所有確認・解放へ接続した。PAのPipe／Supervisor／Leaseは残さない。PAの未使用環境契約記述と2定数も撤去した。現在の接続、独立是正と検証限界は[Lock変更記録§15](lock-boundary-design.md#15-file-lock群の共通化とpa残存機能の再評価--2026-11-07)を参照する。

PA全廃は未完了である。残るNative保護・OS観測・Desktop技術処理の利用先と外した場合の影響は[PA設計](../../../06_Architecture/Details/platform-access/01_Architecture.md#現在の残存範囲--2026-11-07)を正本とする。以下は段階ごとの調査・判断履歴であり、候補を現行Sourceへ読み替えない。

## 共通Lockのwx化候補 — 2026-11-07

§13時点の記録: 信頼境界も人間が採用し、[変更記録§13](lock-boundary-design.md#13-wxの実装と汎用storeの限定切替--2026-11-07)で共通wx処理とDomain汎用Store／AMの切替を進めていた。旧PID不存在Proof・オンライン回復API・自動回復後再取得を撤去。不要になったendpoint取得APIとWorker 2 Sourceも撤去した。当時はCurrentState・共有Home・Host操作等の全Scope切替は未完了であり、当時の8 Sourceを最終構成とはしなかった。以下は判断・調査履歴として保持する。

更新: A案（wx統一・残存時Fail Closed・全利用Process停止下の明示Recovery）は人間が採用した。ただし通常解放の最終照合→unlink間に非協調の置換が入る反証を確認し、[変更記録§12](lock-boundary-design.md#12-wx方式の採用と通常解放の境界--2026-11-07)の信頼境界だけを判断待ちとしている。製品方式変更はまだ開始していない。以下は採用前の候補整理として保持する。

現行9 SourceはOS方式のOwner移管であり、wx統一は未実装。Caller・保持区間・回復条件・既存試験を再照合し、[変更記録§11](lock-boundary-design.md#11-wxへ寄せる範囲の再評価--2026-11-07)に候補を具体化した。短期保存が先行候補だが、Reader・回復・検証Scriptも同じScopeで切り替える必要がある。共有Homeの所在とHost世代の終了契約、Crash残存時に停止する運用は実装前の判断事項である。

wxだけへ移せればWorker／Supervisor／固定子起動・監視を消し、3 Source程度へ縮小できる可能性がある。既存の即再取得保証を守るためだけの新監視や自動Recoveryは作らない。今回は設計調査のみで、製品方式・実AI・Docker・過去保持物は変更・操作していない。

## 取得後ID生成例外の確認 — 2026-11-07

[限定故障注入の結果](lock-boundary-design.md#9-取得後id生成例外の限定確認--2026-11-07)では、Domain／EIともUUID生成例外でopen descriptorと空Lock Fileが残ることを再現した。Domainは同scopeの再取得も拒否。EI保存本文の有限接続ではblockedの一方で清掃済み・残存なしへ誤分類する経路があった。自然発生頻度や公開保存API全体のE2Eは未評価である。

上記は修正前の確認である。その後、ID生成を最初の資源Effect前へ移す最小是正を実施した。公開API・保存Schema・回復条件は変更していない。修正後の限定検証と、共通Lockがwx統一ではなく既存OS方式のOwner移管であることは[変更記録§10](lock-boundary-design.md#10-id生成の最小是正とlock構成の確認--2026-11-07)を現在値とする。実AI・Docker・過去保持物は操作していない。

## File Lock群の移管評価 — 2026-11-07

[利用側・回復・既存試験の対応](lock-boundary-design.md#file-lock-migration-assessment)を整理した。4系統はNode実装済みでPA廃止の直接障害ではなく、Domainの下位OS Guardも共通化済み。File型の公開APIを今すぐ増やす推奨は取り下げ、保存・回復プロトコルは各Ownerへ維持する。Topic／MeetingとEIの取得・終了処理は技術候補だが、現段階で単純移動の利点は小さい。

一時OperationのLifecycle Lockは現在の製品srcに外部利用を確認できず、公開APIと試験が中心。共通Capabilityへの拡張や削除は行わない。Domain／EIの取得後ID生成が清掃try外にある区間、一時OperationのPID不明分類、最終照合→削除の交差を局所確認候補として記録した。今回は文書の静的照合のみで、製品・試験・回復方式・保持物は変更・操作していない。

## Node OS排他の共通Lock移管 — 2026-11-07

PAのPipe・非同期Worker／Supervisor・固定子起動と、DomainのFilesystem endpoint取得を`40_Develop/lock`へ移管した。旧PA再export・互換Wrapperは撤去し、利用側・Source Hash／コピーfixture・台帳・QA・Architectureを追従した。公開4入口と必要な7型は[共通Lock設計](../../../06_Architecture/Details/lock/01_Architecture.md)、保持区間・移管外・検証経過は[変更記録§7](lock-boundary-design.md#7-node-os排他の実装移管--2026-11-07)に置く。

対象回帰はLock23・Coordinator198・Domain17・Checker11・PA75・Executor10件成功。独立レビュー後のコメント清掃も追加指摘なし。新品試験領域は回収・不存在確認済み。新Lockの標準npm testはオフラインの依存未取得で未実施だが、同じ静的3軸と試験本体は既存固定ツールで確認した。実AI・Docker・過去保持物は操作せず、File型・Domain回復・長期Lease・Native Mutexは残した。PA全廃・全OS・Repository全体E2Eの完成ではない。

## 共通LockのPhase 1・2 — 2026-11-06、設計候補

新規`lock`Packageと、異なる保護対象へ一貫した排他契約を提供する人間方針を受け、[全Consumer棚卸し・契約候補・回復案と移行Gate](lock-boundary-design.md)を整理した。PA共有PipeだけでなくDomain固有Worker／wx、Access Managementの回復利用、Coordinator長期Lease、ExecutorのRepository横断Home、EI履歴、Nativeのユーザー別修復Mutexを区別する。旧Owner再開時のLock削除・保存上書きを合成反例で確認し、製品Primitiveを取り去らずに比較区間から最終処置までの保証を検証する必要を記録した。

今回は設計調査と新品の限定モデル実測だけで、製品Source・保存形式・PA依存・配布Nativeを変更しない。試験物は回収済み。実AI・Docker・過去保持物は操作しない。Phase 2の収束・新Package実装・Cross-platform成立・PA廃止は未完了であり、Consumer移行Gateは閉じている。

続く[保持区間と既存試験の照合](lock-boundary-design.md#6-利用側の保持区間と移管範囲--2026-11-06追補)では、Topic／Meeting独自File Lockの棚卸し漏れと長期Leaseの排他Directoryの説明不足を是正した。第一候補は現行endpointを維持したNode OS排他の技術移管であり、Home用の新共有Directoryは不要。File型は次段階、業務回復・長期Lease・Native Mutexは現Ownerに残す。今回追補は静的照合だけで、製品試験の再実行や移管成立を主張しない。

## Namespace旧子の撤去・Node統合案 — 2026-11-06

承認範囲は旧`terminal-v1`の新規作成・実体／ACL検査の撤去と、通常回復Directory初期化のNode統合案の整理である。保護Policy、通常HostRecovery保存DTO、既存保持物は変更しない。旧子用の固定再観測・専用fixture／Toolも退役し、親＋Recoveryの二実体・一Receiptへ縮小した。要求はCRDDNC01／CRDDNI01のまま、短命応答だけCRDDNR02 revision 2へ切り替え、旧応答fallbackはない。

着手前の独立確認と実装照合では、親の独立Identity・selected SID、Recoveryの作成時protected DACL・fresh実体・処置後照合、祖先Handleの保持・全取得資源の初回close、部分Effect／元理由の保持を不変条件とした。変更分類は限定的な技術Refactorであり、利用側・台帳・Architecture・Workflowと対象回帰・独立レビューを実施する。標準規範・Release・保存Schemaを変更しないため全体準拠／Release監査は追加しない。

新品run `9bc133a8a493cc0918fcf915abd2bde7`の既存Creation fixtureで保護付き作成・無変更reuse・不適合ACL／同名File拒否・旧子File／Directoryの同一性／内容不変を確認し、自作物を非再帰回収して不存在を確認した。制限環境の先行runはSID判定でDirectory作成前に停止し、条件は緩めていない。既存旧子、実共有領域、外部AI、Dockerは操作しない。旧子linkの実作成は行わず、Native本体に旧子名・探索／観測経路が存在しないことを静的反証で確認する。

PA通常96・Coordinator8・Checker35・VC13件成功、Namespace純粋／Protocol4件成功（3既存ignored）、Catalog439件valid、対象の型・書式・Rust全target確認成功。固定targetのrelease buildから配布Nativeを更新し、261,120 bytes・SHA-256 `6df45144263f041c2adf98279ae28440a7b4c0b5861560100c5e33d10736ffb6`をbootstrapと合成fixtureへ反映した。配布物自身の二mode不正要求も取得前拒否・revision 2・実体なし／未試行Receiptとして確認した。正式QA全体・実AI／Docker E2Eの成立ではない。独立レビューの旧Protocol説明指摘は親＋Recovery／revision 2へ是正し、再レビューに未解消の確定指摘はない。コミット・プッシュは未実施。

Node統合案と、SID／DACL・祖先Handle保護を外した場合の影響は[PA詳細設計](../../../06_Architecture/Details/platform-access/01_Architecture.md#namespaceの旧子撤去とnodejs統合の検討--2026-11-06)に置く。Policy維持ならNodeの既存初期化OwnerからWindowsの保護付き作成を先に完了し、Nodeによる通常mkdir先行は行わない。Policy撤廃ならNode標準へ一本化できるが、Windowsのmode 0700は厳密DACLの代替ではない。現在の許可はこのPolicy変更を含まない。

## 本番未使用の端末・旧Root観測の撤去 — 2026-11-06

人間承認により6 Sourceと部分削除候補を撤去した。確認コード・端末の5 File、旧Rust Root観測、Reader起動登録、旧Root Request／構成検査・AppContainer Pipe受付、未使用公式停止Wrapperが対象。代替・互換Reader・新Packageを作らない。現存37 Sourceは、本番利用中の共有Pipe、Home／Namespace、Native実体、環境差分、Docker補助Process等に限定する。PA全廃は未完了。

着手前の独立確認により、旧Root内のHome Hash・SID反例2件を存続Ownerへ移した。専用端末の試験・支援と旧Root専用Caseは退役し、共通入力上限・拒否書込み失敗と旧Root／AppContainer拒否を確認する。Provider Homeの要求・応答、共有Directory保護、Pipeの同期／非同期とHome Lease、DI内部の実停止処理は変更しない。型・試験・Symbol／Catalog・Architectureの直接伝播を確認する技術責務Refactorで、規範・Release監査は対象外とする。

限定回帰はPA96、Coordinator24（制限下23成功・リンク作成EPERM 1件を通常権限で再確認）、Executor7、Checker35、VC13件が成功した。PA／Coordinator／Executor／Checkerの型検査、PAの書式・LintとRust全targetコンパイルも成功。Rust通常試験は28成功・12既存ignored、退役CLI拒否は2成功。Catalog439件validは静的整合であり、正式QA全体や実AI／Docker E2Eの成功ではない。外部AI・Dockerコマンド・過去保持物は操作しない。独立レビューで見つかったDI設計の旧Wrapper説明とWorkflowの旧起動手順を是正し、再レビューの未解消指摘は0件。コミット・プッシュは未実施。

通常Runtimeに旧受付を残さないため、固定toolchain 1.94.1・固定依存・`--target x86_64-pc-windows-msvc --release --frozen --offline`の今回Cargo出力一件を取得し、既存固定配布Pathとbootstrap期待値へ反映した。実配布物は265,216 bytes、SHA-256 `5ef70c6702203df63c6d9c68c3c38cac855e9da79fee331848e5de1619b9cdea`。配布物自身のbootstrap照合、旧七mode拒否、旧Root／一般不正／入力上限の三拒否を実Processで確認した。Provider Home／Namespace初期化・Docker操作へ接続しない負例であり、バージョン／Release確定ではない。対象環境明示のRust通常試験28成功・12ignoredとCLI拒否2成功も再確認した。以前の無印cacheによる確認だけを配布物の根拠にしない。

配布更新後にもPA通常96件を再実行して全成功。固定配布物・bootstrap・合成fixtureのHash一致と現行接続の最終独立確認に追加指摘はなかった。DIは説明文だけの追従で、本番Source・公開API・停止条件は変更しない。新しい認可や回復管理、代替端末、旧入口の別名受付は追加していない。

## 未接続Host終端記録・専用Leaseの退役 — 2026-11-06

本番Consumerと削除履歴を照合し、旧Host終端記録の公開12操作、専用caller Lease、対応するRust受付・保存処理・専用検証Toolを代替なしで撤去した。通常のCoordinator回復記録はNode.jsの既存実装に残し、保存形式の移行や過去保持物の操作は行わない。Namespaceが共有していた保護・handle処理と診断fixtureは保持し、Namespace所有へ接続し直した。

技術責務のRefactorとして利用側、台帳、Architecture、試験を追従した。NamespaceのSID／DACL・祖先handle保護、共有PipeのWorker／同期・非同期契約は変更しない。実AI・Docker・保持物は対象外。規範・Releaseを変更しないため全体準拠・Release監査は追加しない。

限定回帰はPA 108、Coordinator 25、VC 13、Checker 35件成功。Rustは全targetコンパイル成功、Namespace関連4件成功・実環境診断4件ignored、旧六mode拒否1件成功。Checkerのリンク試験は制限環境でEPERMとなり、通常権限で35件全成功を確認した。Catalogは444件validであり、正式QA全体のPassや実Windows保護・実Docker成立を示さない。

固定差分の独立レビューで試験代役二箇所の旧Native mode許可と説明二箇所の追従漏れを検出し、旧六modeだけを除去した。存続四modeと旧mode不存在を既存Caseへ接続し、Coordinatorの追加有限4件と型検査は成功。再レビューの未解消確定指摘は0件。過去の実境界Evidenceを削除せず、現在のNamespace試験と退役Capabilityの履歴を区別した。コミット・プッシュは未実施。

残る判断は次のとおり。

| 対象 | 現在のOwner・次候補 | 変更しない保証／未確定事項 |
|---|---|---|
| Namespace作成・Path管理 | Node.js標準への移管候補 | Windows専用保護を撤廃するとSID／DACLの厳密照合・祖先差替え防止は失われる。OSユーザー専用領域と基本的なPath確認は別途維持する。今回は変更しない |
| 共有Pipe | CoordinatorのKernel／Authority、ExecutorのHome Lease、Domain Storageが直接利用 | Executorも直接取得しているためDomainへ単純移動できない。新Package・実装複製・逆依存は追加せず、配置は未確定 |
| 同期取得 | Domain等の同期保存に接続 | 同一threadの同期待機中にも取得を進めるWorkerが必要。非同期化は保存順序への影響を別途評価する |
| Native全体 | Docker Desktop Helper・Provider Home等が残る | 今回の退役だけでRust／PA全体の撤去完了とはしない |

現在のChecker責務は[責務境界整理](checker-responsibility-boundary.md)へ更新した。以下の全Source命名・Header検査と450件Catalogは先行候補の履歴であり、現在のChecker機能や全Source是正完了を示さない。

## 承認済みWorkspace値検査の接続完了 — 2026-11-06

人間承認により、QA-000007へ`RFD-UT-030`を一件追加した。既存のARCH-000009とWorkspace詳細のDomain所有DTOから、保存候補の閉形式・Workspace相関・Commit形式・表示名・関連CHG・選択内容の純粋検査を導出し、ARCH／DetailのQuality分析、検証設計、Quality CenterとDomainの既存二Case・Symbol Manifestを追従した。新しい製品機構や試験、規約・Checkerの免除は追加しない。無関係な公開集合RCM-UT-014／実Git RFD-IT-029の接続はこのSuiteだけから撤去し、他Suiteと過去Evidenceは維持する。

対象11Suiteに限定して同じChecker関数をメモリ内で実行した台帳・段階・全Header照合は成功した。これは製品Checkerの対象除外ではなく、原因層の限定確認である。Domainの既存二Caseを再実行し2／2成功、format／type／lint成功、Catalog450件valid・testExecution not_started、diffの空白検査も成功した。先行段階の関連107試験成功はその対象改訂版の局所結果として維持し、新義務の正式Passへ遡及転記しない。

11Suiteの分類不一致は是正済み。全体Header検査では別の既存DI integration/probe-asyncのpackageDocumentation不足に到達し、命名・コメントの全体課題も未是正である。直下の「10Suite是正・1Suite判断待ち」は承認前の履歴として読む。実AI・Docker・過去保持物は操作せず、コミット・プッシュは行わない。

## 試験段階の是正とChecker要求の評価 — 2026-11-06

今回の実装範囲は既存11Suiteの段階・QA接続と、その直接参照・Headerの是正。製品Source、公開API、規範、保存形式、試験のassertionは変更しない。技術・品質の独立確認、対象回帰と直接伝播確認を行い、規範・Release不変更のため準拠・Release監査は追加しない。

### 是正した10Suite

| 試験 | 維持する段階・接続先 | 根拠 |
|---|---|---|
| Executor lifecycle／probe／review-delivery／observation／controller／plan／attempt/validation | UT、ERB-UT-023 | 型・純粋値・有限DI／Command代役による入力、取消、通知、結果解釈。実DI・実Provider成立ではない |
| Coordinator execution/attempt-preparation | UT、PRL-UT-014とERB-UT-023 | 模擬Storeの準備相関・一回消費・二時計と用途別入力 |
| Coordinator execution/eligibility-observation | UT、ERB-UT-023 | 選定前の五軸分類。実認証・利用可能性のIT成立ではない |
| DI integration/isolation-lifecycle | IT、ERB-IT-004 | 本番Executor・DIの準備／実行／回収を有限CLI・Process・Directoryへ接続。実Dockerではない |

### 残る1Suiteと独立確認による是正

Domainのworkspace-technical-contractは保存候補の閉形式、Workspace相関、表示名・OID・選択の純粋検査でありUTが妥当。しかし既存のRCM-UT-014は公開export/import集合、RCM-UT-016はDomain共通Outcomeの専用義務であり、このSuiteの観測と一致しない。親が一度行ったRCM-UT-016への付替えは独立確認で否定され、撤回した。元のRCM-UT-014／RFD-IT-029の接続も適合済みとはしない。

QA-000007の既存UT-006はIdentity／Revision Policy、UT-028は管理状態の専用Schemaであり、Workspace候補の純粋値検査をそのまま充足する項目は確認できない。推奨はQA-000007に対象限定のUT義務を一件定義し、既存Suiteを接続すること。新しい製品機構・試験は不要だが、検証設計の追加になるため、今回その項目を無断追加せず判断待ちとする。IT-029の実Git義務と既存結果は維持する。

### Checker要求の評価（規則変更は未実施）

先の4,328件は、是正前候補の検出件数であり、固有識別子数ではない。内訳は責務コメント・参照2,770、命名1,557、型分類不能1。命名のみ4,328という旧説明は訂正する。複数tag不足は同じ宣言に重複計上される。

| 対象 | 現在の根拠・評価 | 推奨する次の処置 |
|---|---|---|
| File／Symbolの責務と設計参照 | Coding Standards §4.3の明示要求。Git実行Sourceの一行複数ARCH参照などは現行の一tag一ID形式と不一致。Checker独自要求とはいえない | 参照と責務を維持し、形式不一致と説明不足を別集計する |
| 局所Helperの全固定tagと非該当理由 | 規約は短い局所処理の簡潔さも求めるが、同時に全tag・非該当理由を要求。型検査専用Helperにも終了・清掃・境界の反復を生む。現在のCheckerは全tag側を実装している | 小さな純粋HelperはSummary／責務を基本とし、Effect・資源・外部境界を持つものだけ詳細化する案を規約側で評価する。現時点で免除しない |
| Type AliasのShape／Invariant／Security／Compatibility等 | 規約の型契約Headerに対応するため、Checkerだけが過剰とは断定しない。一つの既存型を再利用する局所型にも同じ記述量を要求する費用がある | 公開・共有契約と局所型の必要記述を区別する案を評価。型や保証を削るのではなく重複説明を減らす |
| Boolean接頭辞・配列複数形・固定定数分類 | §4の明示規則に対応。固定集合・型分類・escape解析等の複雑さはCheckerが独自導入したものではなく規約にも存在する | 外部契約名を保持し、文脈上明確な内部名まで改名する価値と、分類器維持費を比較する。全件改名はまだ行わない |
| 単独名の一律拒否 | §5の禁止集合に対応する一方、同節は関数・Methodの単独動詞を呼出し文脈で評価するとも定める。§3.2との適用境界は要整理 | 値の曖昧名と、対象の明確な操作名を分ける。文脈判断が必要なものを機械的に全て不合格にするべきか先に規約判断する |
| 型分類不能一件 | 型取得できないことは名前が悪い証明ではない。ただし現規約は分類不能を成功扱いしない | 型解決の故障か入力型の問題かを切り分け、分類不能と命名違反の表示を区別する |

規約の採用範囲や例外を今回変更せず、Checkerの検査を弱めて合格にする処置も行わない。Sourceの全Header自動生成や、命名の機械的一括置換を次の既定作業にはしない。

### 検証と限界

対象11Suiteの実行は107件成功（Executor20・Coordinator12・Domain2・DI73）。四Packageのformat／type／lintとCoordinator追跡検査は成功。Catalog450件validは静的結果であり正式Passではない。独立確認では上記Domain接続一件を検出し、誤った新接続を撤回した。全体のHeader検査は別の既存DI integration/probe-asyncのpackageDocumentation不足に到達し未合格。今回10Suite是正を横断Checker全体や11Suite全完了へ昇格しない。補助的な実行token列比較は検査Scriptのメモリ不足で未成立であり、回帰成功の根拠に含めない。実AI・Docker・過去保持物は操作せず、コミット・プッシュは行わない。

## 横断Checkerの既存失敗の是正 — 2026-11-06、未完了

今回の対象は、前節のPA整理で残った横断構造試験4失敗の最小是正である。Rust試験3ファイルをsnake_caseへ改名しCargo・参照・台帳を追従した。実際のRoot再export集合へCheckerの4Package期待値を合わせ、未登録の自動試験27Suiteと検証Tool4件を既存QA義務へ接続した。人間操作の未実施UATは自動試験として登録しない。試験のHeader不足も補い、実行処理・検査の免除は追加しない。types.tsで発見した回復開始stage定数は、値・順序を変えず既存validation.tsへ移管した。

- Rust全targetのoffline compile-checkは成功した。Native実試験や実修復の成功ではない。
- 関連試験はCoordinator9、DI22、Executor58、Domain13、VC実Git2、Workbench25が全件成功した。Workbenchの制限下20成功・5失敗は通常条件で25成功へ再確認し、外部AI・Dockerは使わない。
- Coordinatorの型・書式・Lint・追跡検査とCatalog450件の静的検査は成功した。CatalogのtestExecutionはnot_startedであり、正式なQA項目のPassへ換算しない。
- 当初の先行エラーを解消した全件走査で、全Packageにまたがる識別子命名違反4,328件と、既存登録済み11SuiteのUT／ITとQA Local Item段階の不一致が露出した。これらは未是正であり、横断Checker全体は未合格。命名の一括置換、規則の緩和、QA IDの機械的付替えは行わない。
- 読取り専用の独立確認は現在差分に追加の確定不整合を検出せず、上記広域課題を最小是正へ無断で拡張しない停止判断を支持した。4,328件と11Suiteの全件再導出を独立確認が実施したという意味ではない。

次の判断は、公開名・保存値・外部契約を保ちながら命名規則をどの対象へ適用するかと、11Suiteの実観測に対応する検証段階の確定である。条件付きのコミット・プッシュは未実施とし、現在差分を保持する。実AI・Docker・過去保持物の操作は行わない。

## 標準API直結と子環境の重複撤去 — 2026-11-06

利用者はPA廃止を第一候補とし、現行の強い保証を一律必須としない方針を採用した。今回はOS／PIDの標準API直結と同値環境入口の統合を実装する。親の着手前照合と読取り専用の独立確認では、Windows固定と現在OS選択、Profile付与の実差分、PID三値・入力拒否を保持条件とした。技術責務のRefactorとして、利用側・試験・台帳・Architecture・QAの追従と限定独立レビューを行う。規範・Release不変更のため全体準拠監査は実施しない。

PAのOS・PID観測二APIと専用Sourceを撤去し、Coordinatorは`process.platform`と、既存Ownerの入力検査後の`process.kill(pid, 0)`を直接使用する。ESRCHだけ不存在、他の失敗は不明。不正PIDではOS照会0、PID存在を同一世代と見なさない条件を維持し、反証試験を既存Coordinator試験へ移管する。CatalogとSymbolの旧試験・旧Source接続は撤去して新Ownerへ追従する。

環境はConsole／Node Reader／Supervisor／Nativeの四入口から`createChildProcessEnvironment({ platform?, userProfile? })`一入口へ統合する。任意envや任意Pathを受け付けるbuilderは作らず、実OS差とOS由来Profileの付与要否だけを選ぶ。Windows固定Consumerは明示optionを使い、Profileは必要な呼出しだけ付与する。Host記録TMP／TEMP・PowerShell五項目・Docker固有設定は実差分として維持する。DIの変更理由はPA利用API追従だけであり、Dockerの実行・回収・信頼検査・保存・期限は変更しない。

### 残機能の評価（未実装・判断候補）

| 機能 | 残す必要と推奨案 | 現方式を外す場合の影響 |
|---|---|---|
| 共有Pipe排他 | 保存Writer・Home・操作排他は現在も必要。Node実装を前提に、同期／非同期Consumerと保持寿命を照合して配置を決める | 全てCoordinatorへ移すと逆依存、各Ownerへ一式コピーすると重複。PA全廃の配置判断は未確定 |
| Runtime／Homeの厳密Token・ACL | 秘密・保存先の境界は必要。対話ログオン限定や固定ACL形状は必須と決めず、通常OS利用者境界で足りるか評価 | 独自の権限不備検出やService等の拒否が減る。Nodeのchmodだけで同等とは扱わない |
| OS所在のNative取得・中立環境 | 今回は維持。標準の起動環境を信頼してよいかを先に判断する | 親環境を根拠にできない現条件が変わる。C:\\Windows等の固定推測へは置換しない |
| Host終端の未接続記録・専用Lease | 本番接続を確認できない退役候補。旧Callerは既に廃止済みだが、PA私有技術契約維持の旧判断は別途更新が必要 | 通常Recovery記録は既存Node保存に残す。未接続の専用保護・保存能力を失う |
| Host Namespace初期化 | Coordinatorの本番接続あり。通常保存先初期化と特別ACLを分けて評価 | 無条件撤去では本番初期化が壊れる。特別ACL廃止には保護条件の再判断が必要 |
| Docker強制修復 | 公式停止・起動を第一候補とし、失敗時は人間へ戻す案を推奨 | 強制終了による自動復旧範囲が狭くなる。公式CLIをNodeから呼ぶことと組込みAPIだけの処理は区別 |
| 特殊reparse残存物 | 不明項目を自動削除せず保持・手動対応にする案を評価 | 自動回収能力が減るが、不明を安全へ読み替える必要はない |
| Jobによる親異常終了時の回収 | 通常取消・実終了観測は残す。補助子の子孫・親異常終了保証が本当に必要かを個別評価 | kill要求受付ではJobの子孫回収保証を代替できない。孤児残存の可能性と再入場を評価 |
| Native Artifact・Protocol | Nativeが最後まで不要になった後にBuild・配布・照合も撤去 | Native利用中は先に削除しない。外部Docker実行物の信頼確認とは別 |

保証変更を伴う残件を今回の名称統合に混ぜず、PA全廃／Native全廃の成立は主張しない。実AI・Docker・過去保持物は操作しない。

### 検証結果と未成立範囲

- PA通常全回帰143／143成功。DI通常回帰は制限環境で401成功・junction作成EPERM 1失敗・既存対象外5、その後製品・検査不変更で通常権限にて402成功・失敗0・既存対象外5。実Docker項目は未実行のまま維持する。
- CoordinatorのPlatform／Lease・Native読取り判定29／29、環境・Profile／所在故障の限定5／5、Task純粋閉包とNode直結の6／6成功。専用PID試験の2反証は既存Owner試験へ移し、Node標準のOS値を返すだけの旧試験は撤去した。新環境入口はWindows／非Windows・明示Windows固定・Profile付与／欠測を模擬し、実Native操作とは分けた。
- PA／DI／Coordinatorの型・書式・LintとCoordinator二追跡Checkerが成功。三PackageのSymbol Manifestはcomplete・issues 0、Catalogは450件valid・試験未開始という静的結果。Catalog成功を試験成功へ換算しない。
- 独立確認で旧Source必須の試験2箇所とCoordinator Architecture2箇所を検出し、Node直結のOwnerへ追従した。横断確認で露出した基準版由来のSource未分類2件は技術実行へ分類し、VC配置試験の同一verifies二重登録は1要素へ統合した。対象集合の免除や製品Sourceの追加変更は行わない。
- 横断Checkerの構造試験は通常権限で19成功・4失敗。残りは既存Rust試験File名`host-record.rs`、DIの廃止済configurationを要求する期待値（2試験）、既存authentication-management試験のSymbol不足であり、今回PAのNode直結へ伴う失敗とは分ける。全体Checker／QAを合格とはしない。実修復・Native Build・実AI／Docker・過去保持物操作は実施しない。
- 是正後のSource・利用側・管理情報・文書を固定した読取り専用の最終独立再レビューは、追加必須指摘なし。今回の限定結果をPA廃止や実環境の全保証成立へ拡張しない。

対象: CRDD v0.22 / CHG-000082 第二段階
基準Commit: `3e5bd9135`
状態: 既存TypeScript配置の移管・限定回帰・独立レビュー完了。Native接続抽出・Rust再配置は後続単位
決定権限: Qual-Lab

## 1. 採用方針と実行境界

人間の添付MDと追加合意を設計入力とする。Platform Accessは独立Packageを維持し、上位はTypeScript公開APIを呼び、その内部でRust Native Helperへ接続する。Rustは機能別のWindows実装を責務Folderの`mod.rs`から`#[cfg(windows)]`でビルド時に選択する。Linux／macOSの実装・空Stub・Driver Registry・Factoryは追加しない。

変更分類は、既存Capabilityの責務移管と構造Refactor。Architecture・Quality・Coding Standards・Source・公開API・Build・試験・Symbol・Catalog・既知Consumerを同じ単位で追従する。通常保存・Authority・Binary Protocol・失敗理由・回復参照の意味は変えない。現在Repositoryだけを書込みRootとする。実Docker操作・外部AI・②保持物削除・過去Evidence更新・Releaseは対象外。

親の照合と読取り専用確認者により、技術搬送と上位判断の分離、前後の開発観測確認、部分Effect・終了不明の保持、Cargo入口と検査母集団の追従を着手前に確認した。追加の人間判断は現時点で不要。技術・品質の独立レビュー、文書と直接伝播の確認を各固定単位で行う。標準工程・準拠表明・Release条件は変えないため準拠監査・Release監査は追加しない。実境界の操作が必要な場合は、その対象とEffectを別に提示する。

## 2. 移管対応表

| 現在の所有者・処理 | Platform Accessへ移す責務 | 上位へ残す責務 |
|---|---|---|
| Coordinator `platform-access/adapter.ts`・`protected-root-protocol.ts` | それぞれの固定要求・応答・nonce・長さ・版の技術契約 | 上位判断と用途。異なるProtocolを似たbyte処理だけで統合しない |
| Coordinator `platform-access/protected-root-windows-adapter.ts` | 固定Nativeの起動、Artifact前後確認、Root観測の搬送 | Root用途・初期化許可・WeakMap Capability発行／消費 |
| Coordinator `provider/home-windows-adapter.ts` | Home観測要求・応答検査・Native搬送 | Provider選択・10秒鮮度・Mount Capability発行／消費／失効 |
| Coordinator `host-execution/terminal-windows-adapter.ts` | 記録保存・読取り・対象観測の用途固定搬送と相関 | 終端記録の意味・Recovery判断・同じ回復参照・再入場と清掃許可 |
| Coordinator `host-execution/recovery-namespace-windows-adapter.ts` | 親観測・期待Identity結合・初期化の技術処理 | 用途・作成時点・処置判断 |
| DI `desktop/native-process.ts`・`native-process-lifecycle.ts` | 補助子取得、専用環境、固定Protocol、EOF／release／abort、子とstdioの終了 | 修復／再起動の承認・対象操作・回数・Engine再観測・Checkpoint |
| DI `desktop/runtime-directory.ts`・`repair-directory-disposal.ts` | OS実体・アクセス・Identityの技術観測 | Operation・退避・継続・保持・削除の判断とCheckpoint |
| Orchestrator `storage/protected-decision.ts`・`platform/windows-adapter.ts` | 新しい技術観測Ownerへの接続を照合 | 既存の上位Capability利用を技術APIと混同しない |

開発用Native観測のborrowは上位に残し、現在の前後二回確認を維持する。Native実行後の再確認に失敗したらCapabilityを発行しない。PAからCoordinator・DIへimportしない。DIの既存Policy Hashは上位が取得し、用途固定のPA操作へ値として渡す。任意argv・raw frame・任意実行物を受け付ける公開APIは作らない。

Native応答、Protocol完了、子Process終了、全stdio終了、cleanup成立は別の観測として維持する。初期化・保存の発行後失敗で部分receiptや`filesystemEffectIssued: null`を未発行へ畳まない。同期／非同期の方式変更、再送・timeout延長を移管へ混ぜない。

## 3. 目標配置

追加の人間判断により、Native実行物確認をPA内部へ閉じ、上位のArtifact token公開・管理を減らす。Root／Home、Host記録、Docker補助子、開発Session、出所診断の全Consumerを移管した後に公開begin／verifyを撤去する。単なるHandleへの改名・新Registryは行わない。通常操作の起動前後確認・固定Artifact・失敗時の発行事実は維持する。

```text
platform-access/
├ src/
│  ├ index.ts                         意味操作を明示公開
│  ├ artifact/identity.ts              Native成果物の同一性観測
│  ├ filesystem/                       entry・system-directory・local-app-data
│  ├ process/                          environment・termination
│  ├ host-record/                      既存の記録・namespace技術接続を移管
│  ├ docker-desktop/                   既存の補助子・固定Protocol・終了処理を移管
│  └ native/
│     ├ build.rs                       Cargoコンパイル前の準備
│     ├ main.rs                        固定CLI受付
│     ├ protocol/                      access・host_namespace・host_record
│     ├ filesystem/
│     │  ├ mod.rs                      cfgによる実装選択
│     │  └ windows/                    entry・root・保護・Known Folder
│     ├ process/
│     │  ├ mod.rs
│     │  └ windows/                    child・principal
│     ├ host_record/
│     │  ├ mod.rs
│     │  └ windows/                    対象・namespace・記録File・保存と既存排他
│     └ docker_desktop/
│        ├ mod.rs
│        └ windows/                    identity・publisher・repair
├ tests/                               TS・Rust試験を責務別に配置
│  ├ integration/native-cli.rs          固定Native CLIの結合試験
│  ├ integration/windows-entry-diagnostic.rs  明示限定のWindows診断
│  └ fixtures/                         Rust・TSの試験入力
├ Cargo.toml / Cargo.lock
├ rust-toolchain.toml
└ package.json / tsconfig.json
```

OS別Folderへ移しても同じ保証を他OSへ継承しない。非Windowsの現行拒否を維持し、実装時だけLinux／macOSを追加する。Host Record内部は依存を照合し、保存と不可分な容量予約を機械的に別責務へ切らない。既存排他を分離する場合は保存責務の`storage/lock.rs`へ置き、Lockを新設しない。単一の巨大`windows.rs`、転送だけのTS APIは作らない。

Cargo rootと`target/<target>/{debug,release}`を維持する。`[[bin]].path`、`package.build`、`[[test]]`を新配置へ明示接続し、Cargo Workspaceは作らない。Source／testsの移動と同じ単位でFixture相対Path、Rust実体の閉集合、Symbol、Catalog、coverage、Build／配布検査を切り替える。CRDD署名方式の退役とWindows Publisher検証は別能力であり、後者を削除しない。

## 4. 実行単位と検証

1. 既存PAのTS実装を機能別へ移す。公開名・型・戻り値・処理本文を維持し、直接Source読取り・動的import・`import.meta.url`のRoot導出を照合する。
2. Coordinator／DIに残るNative接続を用途別に抽出し、本番Consumerと試験を接続する。上位Capabilityと開発観測は残す。
3. Rustをnativeへ移し、責務別Windows配置へ接続する。Host Recordの実装と試験を責務で整理する。
4. Root API・Header・Coding Standards・Catalog・Symbol・利用側・Buildを全数再照合し、局所・回帰・独立レビューを行う。

基準版ではTSの静的14Fileと通常試験10件が成功した。Host専用試験・Rust・Docker復旧・全体QAはこの基準確認に含めない。

移管で確認する反証は、欠落／改変Artifact、前後Root・File差、偽token、Protocolの旧版・異種・欠測・余分frame、nonce不一致、起動前拒否、開始後取消、EOF・timeout・Process／stdio終了不明、発行後の保存部分Effect、同じ回復参照、未対応OSの明示拒否である。既存の固定形式と失敗条件を維持し、試験数から不存在や回収成功を推定しない。

物理移管や局所試験の成功だけでPA全体完成とは表示しない。実Nativeの再BuildはHashが変わり得るため、Build成功と固定配布成果物の有効化を分ける。古い配布成果物へ新しい実装成立を推定せず、必要な実境界確認と採用条件を別に満たす。

## 5. 最初のTS配置単位の結果

既存6実体を`artifact/identity.ts`、`filesystem/{entry,system-directory,local-app-data}.ts`、`process/{environment,termination}.ts`へ移し、Root入口と直接Consumerを接続した。基準Commit本文との比較は、必要な相対import変更・改行正規化後に6／6一致。Root公開名・型・戻り値、配布Root導出の深さ、固定Native Path・Hash・Protocol・終了処理は不変。Symbol・Catalog・coverage・公開allowlistと直接Source試験を追従した。

| 確認 | 結果 |
|---|---|
| PA通常`npm test` | 静的14File成功、10／10成功 |
| Coordinator／DI利用側 | 型検査成功。DI静的72File成功（既存Info 1、Warningなし） |
| DI Package境界 | 3／3成功 |
| Coordinator Host記録 | 30／30成功 |
| Domain試験台帳 | 25／25成功、実在371件の台帳検査valid |
| Header・公開入口・QA接続 | 3／3成功 |
| 本文・参照・空白 | 本文6／6一致、現行対象の旧TS Path参照0、差分空白検査成功 |
| 限定独立レビュー | Source・Consumer・文書・QAの残指摘0 |

台帳検査で前単位のWorkbench Query試験1件の未登録を検出し、既存試験を最小登録して是正した。検査義務・期待条件は弱めていない。Checker全体checkは未変更の`domain-model/tests/integration/storage-consumer-closure.integration.test.ts`の既存整形1箇所で停止し、全体成功とは扱わない。今回のPath短縮に伴った整形2箇所は是正した。

次は§2のNative接続抽出を行い、技術搬送の型付きAPIと上位Capabilityを分離する。Rust配置・Host Record分割・実Native再Build・必要な実境界・全体QAは未完了。Docker・外部AI・保持物は操作していない。今回の自己生成試験物は各試験の終了処理で回収した。

## 6. Root／Provider Homeの本番接続

`observeWindowsRuntimeState`と`observeWindowsProviderHome`をPA Root APIへ接続し、固定要求・応答・Artifact前後確認・閉じた環境・固定Nativeの同期起動をPAへ移した。純粋Protocolは`filesystem/protection.ts`、技術実行は`filesystem/root.ts`が所有する。上位二Adapterからspawn、Artifact比較、begin／verifyとNative token管理を撤去した。上位のRoot／Provider選択・鮮度10秒・Capability発行／消費／失効は維持した。

開発観測は上位の既存borrowを同期Readerへ投影し、要求構築後とArtifact後確認後だけに呼ぶ。nonce失敗はReader前、初回nullは開発Context拒否、期待Artifact欠落はBootstrap取得不能、後Reader拒否は応答不正より先とする。Readerを保存せず、例外も新しいcatchで別理由へ変えない。

返却結果は平坦な型付き観測と失敗区分で、Process発行、Filesystem要求発行、Helper終了、Artifact前後確認を別fieldで保持する。初期化を要求したNative起動後の失敗ではFilesystem要求発行を残す。上位へtoken・raw frame・実行物Pathを返さず、上位自身が保持する用途別Capabilityとは区別する。

旧Coordinatorの通常Bootstrap省略検出は、新しいPA試験へ移管した。同じ本文に対するBootstrap・前後確認・shell・argvの変異検出を維持し、Root／Home二用途、nonce・Readerの競合、未知応答とEffect保持を追加した。元の本番Session結合は新PA実装と私有Artifact依存へ接続し直し、実行順・取消・失効・前後Source差の期待条件を維持した。

現時点の確認: PA静的17File・通常11件、上位Root／Protocol8件、Session結合120件、通常の開発観測回帰128件、Windows Host限定1件、利用側・coverage契約14件が成功した。Windows Host初回のHardlink EPERMは実行環境制限として保持し、必要権限で同じ限定1件を確認して成功した。外部AI・Docker操作は行っていない。最終通常回帰128件と限定独立レビューを確認した。ただし、後続の着手前照合で純粋Protocol試験のPackage私有参照を検出し、前レビューの指摘0をこの点について訂正した。§7の試験移管で是正し、PA全体完成とはしない。

検査で発見した先行の残りは、Workbench Query試験の不足boundary説明3箇所と不要な局所Lint抑止2行、Domain試験の改行1箇所だけを是正した。処理本文・検査規則・期待条件を変えず、全体静的検査は成功（既存Info62、Warning0）、Header／公開／QA接続3件も成功した。先行記録の全体整形停止はこの是正前の結果として区別する。

残る公開token利用はHost記録の読取り・保存、DI補助子、開発Session、出所診断等である。これらの移管前にroot公開begin／verifyを削除せず、全Consumerが移行した後に撤去する。内部WeakMapを別名の公開Handle／Registryで代替しない。合意した最終API一覧のHost記録・Docker部分、Rust OS別配置は未実装を維持する。

## 7. Host記録保存先の初期化と試験Owner

`host-execution/recovery-namespace-windows-adapter.ts`の技術処理をPAの`host-record/namespace.ts`へ移し、`initializeWindowsHostRecordNamespace`を公開した。上位の通常作成入口がこのAPIを呼び、初期化する時点・失敗分類・Root作成・清掃判断は従来どおり上位に残る。追加の中継、token、Registry、Lockは作っていない。

親観測→期待Identity・利用者Hash結合→初期化、二要求のArtifact前後照合、固定argv・5秒・有界出力・部分receipt・不明Effectと終了値相関は維持した。同じFolder深さのため配布Root導出は不変。独立した観測操作は利用側がないため公開しない。

純wireとNative搬送の反証をPAへ実移動し、Coordinatorには上位作成との結合だけを残した。Root／Homeの先行試験でも私有Protocol importをPA側へ移した。公開APIを試験のためだけに拡張せず、失敗反証も削除していない。直接子Process利用元一覧は実際のPA Root／Namespace Ownerへ追従した。

確認結果: PA静的20 Fileと通常17／17、Coordinator型検査と上位結合2／2、子Process利用元1／1、Header・公開・QA接続3／3、台帳374件valid、全体静的検査成功（既存Info62、Warning0）。試験台帳は実行結果ではなく登録整合の確認として扱う。後続の§8是正を含む独立再確認は残指摘0。実Nativeの再Build・Docker・外部AI・保持中の②試験物は操作していない。

## 8. Session結合試験の公開境界への是正

先行Session試験に残ったPA私有Moduleのmockと動的importを撤去した。上位は公開APIの固定結果と同期Readerの投影だけを代替し、Artifact照合・wire・spawnの検出手順を再実装しない。PA実本体の反証と上位処置の反証は別試験として成立させ、単一試験で実Sessionから実PA内部まで通したとは表示しない。

旧30条件×四対象の対応は次のとおり。PA側の確認先は`root-observation.contract.test.ts`の二用途と既存五変異、上位側は`development-native-observation.integration.test.ts`の同名Caseである。

| 旧条件 | PAの検出義務と確認先 | 上位Session／Adapterの処置義務 |
|---|---|---|
| normal、checkout-normal | normal／development | 正常結果からだけCapability発行。前後Readerと公開API一回配送 |
| pre-artifact、checkout-artifact-mismatch | artifact-before | 固定拒否結果でCapability非発行・Effectなし |
| post-artifact、checkout-post-artifact-mismatch | artifact-after | 拒否・終了確認・発行済みEffectを保持 |
| environment | environment | 起動前拒否結果を伝播 |
| checkout-bootstrap-missing | bootstrap | Bootstrap取得不能を伝播 |
| checkout-pre-token、checkout-post-token | verify-before／verify-after、前後確認省略変異 | 段階に応じて未発行と発行後拒否を区別 |
| post-source、post-native、post-repository | PAは技術正常結果だけ | 観測後に変更されたSource／Native／Repositoryを次のProvider境界で拒否 |
| native-null、native-throw | borrow-first | 実Sessionの観測取得不成立をReaderから拒否 |
| unknown-context | borrow-first | 偽ContextからCapabilityを発行しない |
| cancel、expiry | borrow-first | 実Sessionの取消・期限切れを拒否 |
| cleanup-cancel、cleanup-expiry | borrow-first／development | 読取り清掃Contextと初期化要求を区別 |
| admission-source-hash、source-hash-mismatch | PA検出の対象外 | 受付時／再観測時のSource期待差を実Sessionで拒否 |
| old-token-stale、old-token-throw、old-token-second | borrow-first | 元観測の前後失効・例外をfresh観測で上書きしない |
| new-token-final | borrow-first | fresh観測の最終確認不成立を拒否 |
| borrow-token-stale、borrow-token-throw | borrow-first | 借用中の元観測失効・例外を拒否 |
| post-borrow-token | borrow-after | 後Reader拒否で上位Capabilityを発行せず、発行済みEffectを保持 |
| cleanup-old-token-stale | borrow-first | 清掃Contextでも失効観測を再利用しない |

模擬`nativeEffectObservations`は公開結果のEffect通過数であり、実Process開始・不存在の観測ではない。別に公開API配送数とReaderの0／1／2回をassertする。checkoutのPA内部Bootstrap回数・Artifact回数は上位試験から外し、PA実本体の厳密イベント順と変異検出へ移した。上位Sessionの観測回数0と公開API配送一回は引き続き確認する。受付で拒否するCaseは公開API・Readerとも0である。

Host補助子環境の純値試験もPAの`tests/unit/process/environment.contract.test.ts`へ実移動し、上位からPA非公開Sourceを読む依存を撤去した。新しい公開API・Fixture Facade・例外規約は追加していない。

最終確認: PAの静的21 File・通常18／18、Coordinatorの型検査・Host記録と上位接続31／31・通常開発観測128／128（50.4902秒）、Header／公開／QA接続3／3、台帳375件valid、全体静的検査（既存Info62・Warning0）が成功した。独立再レビューは残指摘0。今回のSource試験用`development-source-*`領域は終了後に残存なしを確認した。実Native再Build・Rust配置・Docker補助子移管と必要な実境界は引き続き未完了であり、PA全体の完成とは扱わない。

## 9. Rust配置の変更

人間の配置判断に従い、Rust実装は`src/native/`、Rust試験は既存の`tests/`へ統合する。Cargoの`build.rs`は`src/native/build.rs`へ置き、別の`native/`親フォルダは保持しない。Cargo入口、Fixture相対参照、Symbol台帳、検査対象、ArchitectureとCoding Standardsを同じ配置へ追従させる。過去Evidenceは変更しない。

配置後の固定Toolchainによる`cargo check --frozen --all-features --target x86_64-pc-windows-msvc`と、Rust単体・CLI試験の`--no-run`ビルドは成功した。これは試験実行・配布更新・Docker実境界の成功を意味しない。HostのHardlink非対応によるビルドキャッシュのCopy fallback警告は残る。①〜⑤全体は引き続き作業中である。

## 10. 配置追従とHost記録の接続確認

`build.rs`を`src/native/build.rs`、Rust CLI試験を`tests/integration/native-cli.rs`へ移動した。CLI試験からWindows退避領域の診断を`tests/integration/windows-entry-diagnostic.rs`へ分離し、明示実行限定のignored条件を維持する。Cargo Target、Symbol、Test Catalog、検査対象とcoverage入力を追従し、coverageの期待Source 14件がすべて実在することを確認した。

Host記録の技術搬送はPAの`src/host-record/record.ts`へ移管し、上位は意味検査済み本文と同じencode結果から技術期待値を投影する。上位の実Session・caller保存・Recovery判断はCoordinatorに残す。技術単体17件とNative実本文反証1件はPAへ配置し、上位の意味検査12件と実Filesystem caller結合8件を維持する。試験側の実投影関数注入も新境界へ追従し、異なるRealmのobjectを本番入力の代わりに渡さない。

現時点の確認結果はPA通常86件成功、Docker Isolation通常293件成功・実Docker試験1件未実行、Host caller結合8件成功、上位開発Sessionの通常127件成功である。制限環境でHardlink作成が拒否されたHost専用1件は通常権限で個別確認し成功した。PAの型・lint・format、公開入口・Source Header・Quality接続を含む構造検査5件も成功した。退避領域の実診断、Docker操作、外部AI依頼、固定Native配布物の更新は行っていない。

この単位時点では、上位Artifact token公開の縮小、利用側・設計・検証対応の全体照合と全体独立レビューを未完了として保持した。以後の処置は次節を現在値とする。

## 11. ①〜⑤の最終照合

状態: 今回の①〜⑤のSource構造・公開API・利用側移管を完了。通常回帰と限定独立レビューは残指摘0。実Docker操作・配布更新・外部AI E2Eの完成を含めない。

| 項目 | 現在の所有者・処置 | 維持する境界 |
|---|---|---|
| ① Host記録の技術実行 | PA `host-record/record.ts`／`namespace.ts`。通常の六u32型もPAに統一 | intentの意味、producer、処置順、caller保存、Recovery判断はCoordinator |
| ② Docker Desktop補助子 | PA `docker-desktop/helper.ts`／`protocol.ts`。DIの本番Callerと試験をRoot APIへ接続 | Policy選択、承認、Checkpoint、Engine判断、再起動・回復の可否はDI |
| ③ Artifact公開tokenの縮小 | Rootからbegin／verifyを撤去。`observeNativeArtifact`の実体・内容Hashで前後比較 | 内部の同Handle照合を維持。元失敗を新baselineで上書きせず、Bootstrap要求用途を維持 |
| ④ Rust配置・試験分離 | `src/native/<責務>/windows/`とcfg選択。Host記録の試験本体は`tests/integration/host-record.rs` | 私有moduleへのcfg接続・試験項目・ignored条件を維持し、完全修飾名は新moduleへ追従。容量予約と保存の不可分な所有を切らない |
| ⑤ 設計・公開入口・利用側・試験 | Architecture、Coding Standards、Quality、Catalog、Symbol、coverage、Cargo・npm入口を追従 | 新Framework・State・Lock・Authorityは追加しない。過去Evidenceを改名しない |

`observeNativeArtifact`は一回の既存Snapshotから、Root実体、実行Path、File実体のbigint値、内容Hashとbyte長を固定順でHash化する。任意の元Hashは非Authorityの比較条件であり、観測不能・元Hash不一致はnull、固定Bootstrap不一致は正常観測のfalseとして区別する。Source／Gitの意味と上位Capability判断は移管しない。

同一bytesの別Fileへの置換、本文・期待値の不一致、対象実体alias、既知FileのDirectory／Reparse属性、元実体の前後失効、最後の再観測拒否を試験する。Native環境欠測の検出はPA、公開失敗を受けた上位のCapability非発行はCoordinatorで確認する。移動した試験を元Ownerのconsumer一覧に残さず、新Ownerの実在試験と本番利用側へ接続する。

最終確認（2026-10-20）: PA通常88件、Docker Isolation通常293件、上位Session127件、関連境界・台帳70件、Host実Filesystem9件が成功した。Docker Isolationの明示Docker試験1件は未実行。通常Rustは47単体＋8CLI成功、23件は明示ignoredを維持した。固定Toolchainの書式・Clippy、PA静的検査、全体の書式・型・warning禁止Lint、Header・公開API・QA接続3件、台帳378件valid、差分空白検査が成功した。Lintの既存Info62件は残る。RustのHostキャッシュHardlinkは環境制約によりCopy fallbackとなる。

Source・安全境界と設計・配置を分離して独立確認し、指摘を統合して改名記述2箇所・新Pathの追跡・不要な抑制コメントを是正した。処理・試験条件・過去Evidenceは変更せず、最終候補の再確認は残指摘0。完全出力は端末で確認し、既存の再実行可能な試験へ接続する。実行単位のEvidence書庫は増やさない。

これは固定配布Nativeの更新・実Docker修復・外部AI E2Eの成功ではない。全Repository文書Checkerは不合格（3,520件）であり、過去Evidenceの旧参照等と既存Quality整合の負債を含む。今回の構造整理からRepository全体の品質PassまたはRelease可能とは主張しない。保持中②の試験物、Docker再起動、外部AIの再試行は対象外を維持する。
