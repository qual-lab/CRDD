# Windowsネイティブ部品の設計

## 現在の残存範囲 — 2026-11-10

### Desktop Helperの退役

Desktop専用TS入口、IPC、Native Process列挙・強制終了・起動、専用Mutex・実行物群検証、専用Job Objectを撤去した。DIが既存Node.js処理と公式CLIを使用する。保証変更と基点を変更しない運用条件は[DI設計](../docker-isolation/01_Architecture.md#desktop-helperの退役と公式cliへの接続--2026-11-10)を正本とする。Provider Home・残存Filesystem Native処理は変更せず、PA全体の廃止完了とはしない。

### Runtime Stateの本番Native接続退役 — 2026-11-10

Runtime Stateの初期化・観測はCoordinatorの既存判断StoreへNode.js処理として統合した。PAの`observeWindowsRuntimeState`公開関数とCoordinator側のRoot Capability再包装を撤去し、Provider HomeのNative経路は維持する。Runtime専用のNative保護成立をNode成功へ読み替えない。現行の所在・実体検査、保証対象外、部分作成の保全は[Coordinator設計](../coordinator/01_Architecture.md#runtime-stateのnodejs初期化と実体照合--2026-11-10)を正本とする。

2026-11-11に旧Runtime値4、初期化専用Win32処理、TSの未使用要求生成・応答解析・固定Path記述を撤去した。旧Store値3／Runtime値4と非0の初期化予約byteは、Native入力解析でOS観測・Filesystem Effect前に拒否する。Provider Homeの値1／2、76bytes要求・182bytes応答、revision・magic・nonce／Hash位置は維持する。固定配布物とBootstrap Hashも同じSourceへ同期する。Provider HomeのSID／DACL／Token・祖先Handleと共用Known Folder・Filesystem観測は存続する。以下に残るRuntime Native保護の記載は移管前の仕様・検証履歴であり、現在のRuntime State保証ではない。

### Local AppData専用公開入口の退役 — 2026-11-10

本番利用のなくなった`observeWindowsLocalAppDataDirectory`、専用TS Source／試験、Rust専用CLI modeと`CRDDLA01`出力処理を撤去した。旧Host fixtureの許可／要求集合、公開一覧、Symbol・Test Catalogも追従する。共用`local_app_data_path()`は残存するProvider Home内部保護に必要なため維持する。専用入口の代替や互換modeは追加しない。Native Source・固定配布exe・Bootstrap Hashは同じ変更へ同期し、存続APIのProtocol・保護Policyは変更しない。

### Desktop所在の初期化設定への統合 — 2026-11-10

DIの修復・修復後Directory観測／回収は、上位が初期化した`desktop.userDataDirectory`を使い、`observeWindowsLocalAppDataDirectory`を呼ばない。Native Known Folderによる所在独立取得から上位設定信頼へ移るが、Directoryの実体・Scope・処置条件は維持する。PAの同API・Native modeは旧Host／Native試験に残るため、この単位では削除しない。PA自身の環境生成・Provider Home保護・Desktop Helper・Artifact・Protocolは変更しない。全体回帰と実境界成立は保留する。

### PA外の一般環境生成の終了 — 2026-11-10

Coordinatorの未使用な子環境診断口を撤去し、回復Matrixの固定Node子は既存Coordinator設定とNode.jsだけで限定環境を構築する。本番SourceでPAの`createChildProcessEnvironment`を使うのはPA自身のNative搬送だけとなる。PAのNative環境生成・Windows所在の独立観測・Provider Home保護は維持し、上位へのコピーやDIへの逆依存は作らない。Node子のWindows補完値は必要な空値だけで抑止し、汎用環境builderを別Packageへ再設置しない。全体回帰は後続整理後へ保留する。

### DIの明示設定への分離 — 2026-11-10

Docker Isolationが直接起動するDocker CLI・署名検査・固定WSL観測の環境はDIが所有し、`initializeIsolation`で上位確定の`windowsDirectory`／`userHomeDirectory`をオンメモリへ固定する。DIからPAの一般環境生成を呼ばず、Native APIによる独立した所在証明とNodeのPath確認の保証差を明示する。PA自身のNative搬送と、残るCoordinatorのNative用途は現在のPA処理を維持し、PAからDIへの逆依存は作らない。Provider Home・Local AppDataのNative保護、Desktop Job Object、保存形式・IPCは変更しない。

以下の2026-11-09節は、DI分離前の共通化時点の履歴である。DIへの現在の接続は上記と[DI詳細設計](../docker-isolation/01_Architecture.md)を参照する。

### 子Process環境の用途設定整理 — 2026-11-09

共通のOS選択・親環境中立化・検証済みProfile付与はPAの`createChildProcessEnvironment()`一入口に維持する。PA自身のNative搬送とDI、Coordinatorが共用するため、DIへ移して逆依存を作らず、利用側ごとのコピーや新しい共通Packageも追加しない。共通入口のPA外への最終配置は未完了である。

Dockerの署名確認専用PowerShell環境は、DIの既存`docker-cli/environment.ts`へ統合する。共通入口の検証済みWindows所在・Profileから固定五項目だけを投影し、親PATH・Proxy等は採用しない。OS所在・Profileの検査をDIで再実装しない。DI Rootの公開API、Docker操作、署名の判定・期限は不変更とする。

本番利用のない`createWindowsHostTerminalHelperEnvironment()`は、専用試験とPA Root exportを撤去する。通常回復NamespaceのNode経路やProvider Home保護の代替を新設しない。`deriveWindowsSystemDrive()`はDIとPAのDesktop Helperの双方で利用するため現配置を維持する。

環境整理時点ではProcessツリー停止はPAの一実装をDIと検証Scriptが共用していた。2026-11-09の通常CLI整理に続き、検証Scriptの故障注入もNode.js標準による元親だけの停止へ変更した。PAの固定taskkill入口・実装・専用試験は撤去済みである。子孫停止と同等の置換ではなく、親終了と残存資源の回復を別に評価する。BrowserとDesktop Job Objectの終了処理は変更しない。

技術排他は共通Lockへ接続し、PAにはPipe／Supervisor／Leaseの取得・監視・回復処理を残さない。OS判定とPID観測はNode.js標準を各Ownerが使用する。子Process環境は実在する用途差分だけを構築し、本番利用のない固定記述関数`describeWindowsChildEnvironmentContract`と専用2定数は撤去した。実際の環境生成・子での観測・外部Effect前の拒否検査は維持する。

| 残る機能と利用先 | Node.js標準だけへの置換で失うもの | 現在の処置 |
|---|---|---|
| Runtime State初期化：Coordinator | SID／DACL・祖先Handleの独立確認 | 本番は既存Node Storeへ移管済み。旧Native内部Protocolと初期化処理も削除済み |
| Provider Home観測：Coordinator | 選択利用者SID、protected DACL、祖先Handle・Token照合 | Native Policyを維持。Runtime Stateの判断を認証Homeへ流用しない |
| OS既定所在：Native自身の搬送 | System Windows API由来の独立観測 | PA自身に必要なSystem Windows観測は維持。DIの所在は上位確定設定へ移管し、Local AppData専用入口は退役済み |
| Entry観測：DIの修復Directory処置 | 特殊AF_UNIX候補のexact reparse tag・Native実体検査 | 通常File／Directory・不存在はDIのNode観測へ統一。特殊候補だけ既存Nativeに接続し、自動回収の必要性とNative撤去は別判断。実処置OwnerはDI |
| Desktop Helper：退役 | 独自Process不存在・Native Handle／Job等の保証 | 公式CLIと既存Node処理へ統合済み。同等保証とは扱わず、現行条件はDI設計を参照する |
| Desktop技術排他：DI | 旧SID Mutexの区分・Crash時自動解放 | 共通wxへ移行済み。同じ基点の運用・残存時のFail Closed・停止下明示回復とし、旧方式とは並走しない |
| Artifact照合：上記搬送の全利用側 | 固定配布物の前後同一性とProtocol相関 | Nativeが残る間は維持 |

現在維持するSourceはProvider Home、Filesystem entry、必要なSystem Windows／Native環境、Artifact搬送である。退役行を未使用Sourceの温存理由にしない。PA全廃には残る保護Policyと保証の判断が必要である。Desktopの現在結果は冒頭の退役節、wx移行の経緯は[変更記録§15](../../../99_Roadmap/Changes/CHG-000082/lock-boundary-design.md#15-file-lock群の共通化とpa残存機能の再評価--2026-11-07)を参照する。以下の日付付き節は各段階の判断履歴であり、旧Pipe・Helper記述を現行機能へ読み替えない。

<a id="namespaceの旧子撤去とnodejs統合の検討--2026-11-06"></a>

## Namespaceの旧子撤去（2026-11-06）とNode.js統合（2026-11-07）

旧終端記録用`terminal-v1`の作成・実体／ACL照合・専用観測を撤去した。既存の旧子は観測・移行・削除しない。通常回復用`crdd-coordinator-recovery-v1`の作成、選択利用者SID、protected DACL、祖先Handle保持、独立期待値と処置後照合、部分Receiptと初回closeは維持する。要求CRDDNC01／CRDDNI01は不変更。短命応答はCRDDNR02 revision 2の二実体・一Receiptへ縮小し、旧応答は受け付けない。通常HostRecovery保存DTOと公開関数の引数は変更しない。

### Node.js側への統合（承認済み）

人間の承認により通常回復NamespaceだけをNode中心へ変更した。Coordinatorの`operation.ts`の本番依存は既存`createOwnedOperationDirectories`へ直接接続し、Native先行初期化と私有Wrapperを撤去する。`ensureHostRecoveryDirectory()`の固定child、Path・非link・実体・EEXIST後の再照合、部分作成の回収と通常記録Writer／Readerは維持する。

撤去対象はPAのNamespace TS入口、Rust専用module・Protocol・二つのCLI modeと専用検証Toolである。旧modeは一般の不正要求として拒否する。退役するSID／DACL・祖先Handle・主体事前検査のOracleはNode成功へ読み替えない。Provider Home／Runtime、Desktop、Artifact、通常記録の保存形式・Token／Hash・処置許可と排他は変更しない。

この変更は保護Policyの明示的な変更であり、従来と同等のWindows保護を提供する整理ではない。service・restricted Token等のNative事前拒否もなくなるが、それらの実行形態が検証済みになったとは主張しない。PA全廃・Native全廃は未完了である。

Node経路が観測する`os.tmpdir()`の正規Path・実体は、その所在が利用者専用または他SIDから書込み不能である証明ではない。専用TEMPの保護を前提とするNode中心案は、実行時に強制する保証ではなく、採用時に人間が受容する運用前提である。共有・保護不明のTEMPをNodeだけで自動検出して拒否できるとは表示しない。実行時の主体／DACL不適合拒否を必要とする場合はNative等の観測を維持する。その技術能力を既存Ownerへ移管してPAだけ廃止する経路は別に成立し得るため、強い保護を残すこととPA Package存続を同一視しない。

| 外す保護 | 失う確認・影響 | Node.js側で維持できる範囲 |
|---|---|---|
| 選択利用者SID・Tokenの照合 | OS主体への結合を検証できず、Pathが同じだけでは意図した実行利用者を証明できない | os由来の所在、正規Path・実体・Root範囲の確認。SID照合と同値ではない |
| 所有者・厳密protected DACL | 選択利用者／SYSTEMに限定した保護を作成時から保証できない。親から継承したACLにより、他の主体の読取り・改変を許す可能性がある | OSユーザー専用の適切な保存場所、非link・Identity・作成結果確認。Windowsのmkdir mode 0700だけでは同値のACLにならない |
| 祖先DirectoryのHandle保持 | Native処理区間の祖先差替え防止を失い、Path確認と操作間の競合余地が増える | lstat／realpath・操作前後の実体再確認。ただし原子的な差替え排除ではない |

現行もHandle保持はNative呼出し内に限り、戻った後のNode処理全体を連続保護しているわけではない。Node化の影響を過大にも過小にも評価しない。通常回復記録は維持し、Provider認証Homeの保護Policyをこの判断へ混ぜない。

### Desktopの排他を共通Lockへ寄せる場合の境界

Nativeの`repair.rs`は、修復・再起動の双方で選択利用者Hashに結合した`Global` Mutexを取得する。名前はRepositoryに依存せず、Helperが保持するOS handleが終了時に閉じられる。共通wxは指定DirectoryのFileを保持し、Crash後は残存によって停止するため、単なる実装交換ではない。

| 比較する条件 | 現行Native Mutex | 共通wxへ寄せる場合に確定すること |
|---|---|---|
| 排他Scope | 同一選択利用者の修復／再起動。Repository・Windows Sessionを横断 | 両操作・全Repository・全対象Sessionが同一の既存管理領域／Identityへ到達すること |
| 利用者結合 | Nativeが選択利用者Hashを取得 | NodeのPID・home文字列を同じ利用者の証明へ補完せず、必要なScopeを再定義または既存値で確定すること |
| 保持区間 | 同じHelperの処置中にhandleを保持 | Node側の要求受付だけで解放せず、Helperの終了確認まで保持すること |
| 競合・正常終了 | 同名Objectがあれば停止。元handleを閉じる | EEXISTで停止し、元Generation・File実体を照合して一回解放すること |
| Crash後 | 最後のOS handleが閉じられるとObjectが解放される | File残存で停止する変更と、全利用者停止下の明示回復を人間が採用すること |
| ACL・切替 | OS Objectのアクセス条件と選択利用者Scope | 管理Directoryのアクセス前提を定め、新旧方式を同時稼働させないこと |

既存Host操作世代のLockはこのGlobal Scopeと同一とは限らない。重複だからという理由だけでMutexを削除しない。新しいRegistry・Store・自動回復は作らず、共通Lockの既存契約で成立するかを評価してから変更する。今回このPolicy・実装は変更しない。

## 本番未使用の端末・旧Root観測の退役 — 2026-11-06

端末・確認コード用の5 SourceとRustの旧Root観測を代替なしで撤去した。旧Readerの子起動登録、Root要求のparse／構成、AppContainer Pipe受付、未使用の公式停止Wrapperも撤去した。一般の不正要求には既存の固定拒否frameを返し、旧観測を別名で受け付けない。Provider Home、Namespace、共有Pipe、DIが使用する実際の停止能力は維持する。

旧Root試験に混在したProvider Home HashとSID反例は各実装Ownerへ移し、旧端末だけを目的とする試験・支援は退役した。以下の現行構成表を正本とし、過去CHGの端末・旧Root仕様を現在の公開Capabilityへ読み替えない。

## 未接続Host終端記録の退役 — 2026-11-06

本番未接続の専用記録とcaller Leaseは代替なしで退役する。Namespaceの初期化、SID／DACL・祖先handle、通常HostRecovery、共有Pipeと同期／非同期契約は今回変更しない。NamespaceのNode化・Windows保護Policy撤廃・共有排他の配置は別判断であり、PA全廃・Native全廃は未完了である。

成果物種別: Architecture詳細設計
詳細設計領域: platform-access
状態: Canonical

## PA廃止へ向けた標準APIと環境入口の整理 — 2026-11-06

OS判定はCoordinatorが`process.platform`を直接使う。PID観測は既存`observeLeaseOwner`が入力検査後に`process.kill(pid, 0)`を直接使い、ESRCHだけ不存在、権限不足・その他は不明とする。PAの二つの観測APIと専用Sourceは撤去し、PIDの反証試験はCoordinatorへ移管する。PIDの存在を同じProcess世代の証明へ昇格しない。

同値だったConsole・Node Reader・SupervisorとProfile差分だけのNative環境入口は`createChildProcessEnvironment({ platform?, userProfile? })`へ統合する。Windows固定の利用側は`platform: "win32"`を明示し、OS由来の検証済みUSERPROFILEが必要な呼出しだけ`userProfile: true`を指定する。任意Path・環境値の注入は受け付けない。Host終端のTMP／TEMP、PowerShellの固定五項目、Docker固有のHOME／config／Driveは実差分のOwnerに維持する。新しいLibrary・Environment Manager・互換入口は作らない。

この是正はPA全廃・Native全廃の完了ではない。NativeによるWindows所在の取得、中立環境、Profileの実体検査は現契約を維持する。これらを親環境や固定推測Pathへ置換する場合は信頼前提が変わるため、別の判断にする。共有排他の配置、SID／ACL検査、特殊reparse項目の自動回収、Jobによる親異常終了時の回収、Docker強制修復は引き続き評価対象である。DIの差分はPA呼出しの追従に限定し、保証・Protocol・保存形式・期限は変更しない。

## Source構造とNative接続の再編 — 2026-10-20

採用した目標は、利用側→Platform AccessのTypeScript公開API→Rust Native Helper→OS APIである。Coordinator／Docker Isolationに残る固定Protocol・起動・搬送・応答検査・補助子終了はPlatform Accessへ移す。上位の操作許可、Task／Repositoryとの結合、Capability発行・消費・失効、回復判断・Checkpoint・清掃許可は移さない。技術観測の成功を上位Authorityや回復完了にしない。

TypeScriptは機能別Folderへ配置し、Rustは`src/native/<責務>/windows/`へ実装をまとめ、責務の`mod.rs`が`#[cfg(windows)]`でビルド時に選択する。共通化するのは必要な操作・結果・終了保証であってOS APIそのものではない。Linux／macOSの空実装・Factory・Registryは作らず、現行の非Windows拒否を維持する。既存Protocol・保存形式・失敗理由・同じ回復参照・同期／非同期方式は構造変更から変更しない。

当時Namespaceの存続試験を`tests/integration/host_namespace.rs`へ接続したが、2026-11-07のNode中心Policy採用で専用Rust試験は退役した。現在の通常回復NamespaceはCoordinatorのNode実境界試験が所有し、旧保護試験の成立は引き継がない。

PAから上位Packageを参照しない。開発観測の前後二回borrowとCapability判断は上位に残し、後確認が不成立なら発行しない。DI Policy Hashは上位が取得した用途固定入力であり、汎用raw argv／frame・任意実行物のAPIは公開しない。Rust側のWindows Publisher検証はCRDD署名の退役と別責務として維持する。

Native実行物の確認はPlatform Access内部へ閉じる。Root公開APIからArtifactのbegin／verifyを撤去し、内部の確認を別名の公開Handle・Registryへ置き換えない。上位が継続性を確認する場合は`observeNativeArtifact`の非Authority値を使う。固定順のRoot実体、実行Path、File実体（bigintの精度を維持）、内容Hashとbyte長を同一Snapshotから`identitySha256`へ結合する。元Hashを指定した再観測は同じ実体・内容だけを返し、観測不能・不一致はnull、正常だが固定Bootstrap不一致は`bootstrapVerified:false`で区別する。

現行の接続は`filesystem/root.ts`の`observeWindowsProviderHome`である。入力・nonceを含む要求構築→初回開発観測→Artifact・環境確認→固定Native→Helper結果→Artifact後確認→後開発観測→応答意味検査の順を維持する。開発観測は、上位が既存Contextをclosureに閉じた同期Readerを渡し、この一呼出し内だけで借用する。初回nullと期待Artifact欠落を区別し、後回の返却値から実行物を再選択しない。Reader例外を包括catchで隠さない。

二APIは非Windowsを明示拒否し、観測候補または固定失敗区分・Process発行・終了・Artifact前後確認を返す。token・raw frame・実行物Path・Capabilityを返さない。Root用途・Home選択、鮮度10秒、Capability発行・消費・失効は従来の上位Ownerが維持する。純粋Protocolは`filesystem/protection.ts`へ移し、通常利用側へwire構築・解釈の手順を要求しない。

旧`host-record/namespace.ts`と`initializeWindowsHostRecordNamespace`は退役した。Namespaceの初期化はCoordinatorの既存Node処理へ直接接続し、PAへ代替API・互換Protocolを設けない。

Cargo rootとtarget位置を維持し、Buildは`src/native/build.rs`、実行入口は`src/native/main.rs`、CLI結合試験は`tests/integration/native_cli.rs`へ明示接続する。[現物・Consumer対応表と検証範囲](../../../99_Roadmap/Changes/CHG-000082/platform-access-source-structure.md)が移管結果と未実行範囲を所有する。

### TypeScript公開APIと所有者

公開入口は`src/index.ts`だけとし、bin入口は新設しない。Rust CLIは用途固定の内部Protocolであり、上位Packageへraw frameを要求しない。

| 責務Folder | 公開操作 | 返すもの・所有しない判断 |
|---|---|---|
| `artifact` | `observeNativeArtifact`、`observePlatformAccessArtifactCandidate` | 実体・内容の観測値。実行許可・Publisher真正性・tokenは返さない |
| `filesystem` | `observeSystemWindowsDirectory`、`observeWindowsFilesystemEntry` | OS所在・対象一件の観測。削除許可は返さない |
| `filesystem` | `observeWindowsProviderHome`、`describeProviderHomeObservationContract` | 固定Nativeの技術観測。Capabilityの発行・鮮度判定は上位 |
| `process` | `createChildProcessEnvironment`、`deriveWindowsSystemDrive` | 共通の中立環境とDrive導出。Docker署名確認用環境はDIが所有し、任意環境builderを公開しない |

固定target・Protocol・Toolchain・容量と、必要な環境provenance定数、各操作の型もRootから明示exportする。正確なexport集合は公開契約試験で固定し、用途内のdecoder・wire・内部Artifact tokenは含めない。未使用の環境契約記述と専用定数は含めない。


## v0.22 Node境界の追加（移管候補）

### 通常Nativeの固定Bootstrap確認

固定Bootstrap確認は`artifact/identity.ts`内部のNative実行経路で維持する。上位の開発Sessionは`observeNativeArtifact`の`bootstrapVerified:true`を要求し、元実体Hashの前確認→新観測→元Hashの後確認→新Hashの最終確認を維持する。Hash不一致・観測不能を新baselineで上書きしない。固定bytes一致はGit改訂一致、Publisher真正性、実行Authorityを意味しない。一般Artifactの継続性だけを要求していた診断・Docker保持照合へBootstrap必須条件を追加しない。

### 修復補助子の利用者相関（退役）

Repair/Restart専用Protocol、Hによる所有Hash、専用Mutex、TSの補助子入口は2026-11-10に撤去した。現行の停止・起動・排他・修復記録へ旧Protocolを復元しない。現在契約は[DIのDesktop接続](../docker-isolation/01_Architecture.md#desktop-helperの退役と公式cliへの接続--2026-11-10)を参照する。追加当時の設計はGit履歴に保持する。

### 単一entryのrawメタデータ観測（接続中）

`--filesystem-entry <path>`は有界なローカル絶対Path一件の読取り専用観測である。`filesystem/entry_observation.rs`はOPEN_REPARSE_POINT／BACKUP_SEMANTICSと属性読取り権だけで対象を開き、同じhandleから属性、tag、volume serial、file index、creation FILETIME、linkCountを取得する。内容、ACL、削除、排他またはScopeの許可は扱わない。相対・UNC・device・ADS・曖昧segmentを拒否し、処置対象の固定と現在Owner確認はDocker Isolationが所有する。

応答`CRDDFE01`は41bytes固定で、magic8、status1、attributes u32、tag u32、volume serial u32、file index u64、creation FILETIME u64、linkCount u32をlittle-endianで搬送する。statusはP（観測）またはA（明示不存在）で、Aの残り32bytesは0とする。不存在はFILE_NOT_FOUND／PATH_NOT_FOUNDだけである。その他の失敗はexit2・応答なし、出力失敗はexit3であり、不明をAへ補完しない。Pは非zero実体・linkCount、属性とtagの整合、handleの明示close成功を必要とする。kindや削除可否は返さず、利用側がraw値から判断する。

privateな同期関数だけがopen→query→close→write→flushを直列化する。本番の取得・照会closureは既存Win32入力と相関検査をそのまま使い、公開差替え、trait、共有状態は追加しない。取得成功ではquery失敗でもclose一回、close不明では出力0。取得不成立ではquery／closeを実行しない。write失敗では部分出力、flush失敗では完全frameがあり得るが、exit3を成功へ変更しない。この順序と故障分岐は`ERB-UT-039`のメモリ試験が所有し、現物の型・実体観測は既存ITが別に確認する。

一要求一Process・exact argv・完全frame・Artifact前後確認を`src/filesystem/entry.ts`で結合し、新nonceやRepair Session Protocol変更は追加しない。Native実体の単位をNode実体へ未実証で変換しない。Nodeのraw観測は未知tagも意味を保持して返し、削除可否はDIだけが判断する。2026-10-17の開発Buildでは自己生成AF_UNIXのhandleを閉じて残した端点のP応答・tag0x80000023を取得し、Node unlink後のA応答と専用Root不存在を確認した。子PowerShellを使う試験は環境の起動拒否で未到達だったため、この成功へ含めない。異常終了子の方式選択実測とは別の実測である。同期故障反証の限定レビュー後、既存固定配布Nativeとbootstrap Hashを`a85d46241ba5cb4d771d2b6c493254262492935e3a5e9d20fea2bd486acc9cc9`へ更新した。公開API経由のfile／Directory／hardlink／junction／不存在と旧Known Folder二用途は限定確認済み。Host専用試験は制限内のhardlink EPERMを成功へ丸めず別profileで実施し、自己生成物の清掃と不存在を確認する。既存保護API・Repair Protocol・過去の署名Manifestは不変更である。退役した署名Package方式は現在の完成条件にせず、歴史記録として保持する。現在のDI実回収・三用途終端と必要な実境界の成立は未完了である。

### 修復対象のLocalAppData所在観測（退役前の履歴）

以下は追加当時の設計記録である。2026-11-10の初期化設定統合後、本番利用がなくなった専用Source・公開API・CLI mode・frameは撤去した。共用Known Folder取得は存続するNative保護だけが使う。

Docker修復の新しいMachineは、旧RuntimeState Rootを逆算してOS所在を得ない。`src/filesystem/local-app-data.ts`の引数なし`observeWindowsLocalAppDataDirectory()`が、固定Native mode `--local-app-data-directory`と既存Rustの`local_app_data_path()`を使い、現在Processの利用者のKnown Folderを観測する。任意GUID／利用者／Path、環境値fallback、Directory作成・ACL変更・Authorityを提供しない。

専用frameは`CRDDLA01`の8bytes、little-endian u32のUTF-16単位数、1〜32767単位の本文である。既存System Directoryの`CRDDWD01`とは混用しない。固定Artifact Hashと前後実体を確認し、空環境・固定cwd・shellなし・5秒・65548bytes上限で一回起動する。成功exit・stderr空・完全frame・fatal UTF-16・正規絶対Path、Directory／非link・realpath一致と前後実体一致を要求し、不明はnullとする。System Directoryの既存Protocolと返却条件は変えない。両読取り入口のbootstrap HashはArtifact観測Moduleの単一固定値を使う。

返却Pathは非Authorityの所在値だけで、意図した利用者との一致、ACL、Root Authority、排他やDocker修復完了を保証しない。利用側は実処置前に同じOwnerと対象実体・親・許可・取消を再確認する。既存署名Manifestは過去の記録として変更せず、新Native Hashと実読取り結果を新候補の根拠にする。全Machineと現在状態への接続が未完了の間は、読取り入口の成立だけを全体完成と表示しない。

2026-10-14の人間承認に従い、既存の本PackageへTypeScript公開入口と試験を追加する。当初の移管はRust本体・配布Nativeの固定Hash・Protocol・用途別権限を変えずに行った。上記LocalAppData所在観測の追加では、既存Known Folder処理の再利用に必要な固定modeと独立frameだけを追加してNativeを再Buildする。既存Protocolと用途別権限を変えず、別Package／Frameworkは作らない。CoordinatorにあったNative Artifact同一性観測とSystem Windows Directory観測は、このOwnerが所有する。

| 配置 | 所有する処理 | 公開／終了条件 |
|---|---|---|
| `src/artifact/identity.ts` | 固定NativeのRoot／file実体、同handleの有界Hash、前後再観測、Process内の非Authority Snapshot | Root公開は`observeNativeArtifact`／`observePlatformAccessArtifactCandidate`と必要定数。begin／verify・token・実体内部はPA内部。descriptorはfinallyでclose |
| `src/filesystem/system-directory.ts` | 固定Nativeの`--system-windows-directory`、CRDDWD01の有界・厳密decode | 固定Hashと前後同一性、閉じたargv・環境・cwd・待機上限を維持。不明・不正・非Windowsは取得不能。これは資源不存在の観測ではない |
| `src/process/environment.ts` | OS由来Directory／Profile検証、中立環境、Console／Supervisor／Native／Host終端／固定PowerShell初期化環境、純粋Drive検査 | 既存用途固定の操作だけを公開。任意additions builderはprivate。親環境をAuthorityにせず、Host終端だけTMP／TEMPを導出する。Docker用Home・config・Hints・修復用Drive付与とPublisher判断は所有しない |
| Coordinator `src/execution/kernel-lock.ts`／`src/objective/execute.ts` | CoordinatorがNode.js標準APIを直接使用（PAの観測入口は撤去） | PIDだけをSignal 0で観測し、ESRCHだけabsent、EPERM等はunknown。不正PIDではOS照会0。世代結合・Lease入力・回復判断は上位。Platform familyは既存Windows対応だけを返し、未対応OSへfallbackしない |
| NodeのOS排他・固定Worker／Supervisor | [共通Lock](../lock/01_Architecture.md)へ移管 | PAからの旧再export・互換Wrapperは残さない。用途別Identity・取得順・Owner判断は利用側。中立環境の構築は既存PA APIをCoordinatorが使い、共通Lockへ確定値として渡す |
| `src/index.ts` | 上記の必要な意味操作を明示export | Coordinator／Docker Isolation等はRoot APIを使い、下位から上位import 0、旧Path／shim 0 |

PAはProcessツリー停止を提供しない。通常CLIと検証用の親Process停止は各既存OwnerがNode.js標準APIで行い、元親closeを確認する。親停止から子孫不存在やContainer清掃を推定せず、既存の回復Ownerが現在のLock・Receipt・資源を照合する。親の終了未確認時は再入場Processを開始しない。新しいRegistryや停止Managerは追加しない。

観測はFilesystem読取りとProcess内Snapshot保持を伴い、純粋関数ではない。変更・実行Authorityを発行せず、Hashを署名／Publisher真正性／実行許可へ昇格しない。旧`SigningObservation`は暗号署名ではなかったため、Artifact観測へ名称を訂正する。既存のreason／statusは維持する。署名Manifest結合の記述は通常Runtimeの保証へ移植しない。

Node／Rust両試験を既存Catalog・Verification Runnerの同じOwnerへ接続する。Nodeの静的検査・試験と既存Cargoの静的検査・試験を区別し、片系の欠落を成功扱いにしない。旧製品・Script・exact配布検査・型Project・Symbol・Catalog・coverage・fixtureの全利用側を同じ固定候補で切り替える。正常Nativeだけでなく欠落、改変、Root／file置換、偽token、Process／出力異常を確認する。移管・実測未完了をPackage全体完成へ拡張しない。

## 基本設計との関係

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000004](../../Definitions/ARCH-000004/architecture_definition.md) | 固定Native搬送の子Process終了とNative handle解放を確認する。Job／Container実行は提供しない。 | Partial |
| [ARCH-000008](../../Definitions/ARCH-000008/architecture_definition.md) | OS観測・固定Protocol・Process終了を分けた技術結果を返す。 | Covered |
| [ARCH-000011](../../Definitions/ARCH-000011/architecture_definition.md) | 固定Home・所在・単一entryの観測とNative resourceの解放を実装する。修復記録・Socket回復は所有しない。 | Partial |
| [ARCH-000014](../../Definitions/ARCH-000014/architecture_definition.md) | 必要Native Artifactの同一性を読取り観測する。通常実行許可・CRDD署名・Publisher真正性を発行しない。 | Partial |

Relation状態は、この領域が担当する責務断面に対する状態である。複数領域で同じARCH-IDを実現する場合、各領域の断面を合成して基本設計全体を閉じる。

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | Provider Home、所在、単一entryのNative観測を分ける。 | [§3](#3-操作ごとの境界) |
| Interface Model | Required | 呼出し元とNative helperの入力・結果・Authorityを分ける。 | [§6](#6-呼出し元との分担) |
| Data Flow | Required | exact IdentityとNative結果の往復を追跡する。 | [§3](#3-操作ごとの境界) |
| State Model | Required | 要求検証、観測、応答、Process終了、観測不能を分ける。 | [§5](#5-状態資源回復) |
| Sequence | Required | 固定要求検証からOS観測・応答・Process終了まで相関を保持する。 | [§3](#3-操作ごとの境界) |
| Failure／Recovery | Required | 不正入力・観測不能・搬送失敗を正常結果へ畳まない。 | [§5](#5-状態資源回復) |
| Deployment | Required | Windows binaryとNode利用側・固定配布Artifactの境界を固定する。 | [§2](#2-成果物と依存) |
| Observability | Required | OS結果、固定frame、Native実体とProcess終了を区別して観測する。 | [§7](#7-検証への接続) |
| Security Boundary | Required | 検証済み固定binaryと用途限定要求だけをOS観測へ接続する。 | [§4](#4-バイナリ境界) |
| Implementation Structure | Required | 設計責務を具象差、選択、状態依存、構成、資源Ownerおよび外部境界へ分解する。 | [§Implementation Structure](#implementation-structure) |

`N/A`は未検討を意味しない。対象外にできるArchitecture上の理由を記載する。

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS | 各観測が所有handleと相関値を保持し、上位のLock／許可を代替しない。 | [正本節](#5-状態資源回復) |
| Timing | PASS | 要求、応答、Process終了を有限待機し、期限超過を成功へ補完しない。 | [正本節](#5-状態資源回復) |
| Resource Lifecycle | PASS | Directory／Token／Descriptor／Hash handleを所有箇所で解放する。 | [正本節](#5-状態資源回復) |
| External Boundary | PASS | Windows APIの結果とNative搬送完了を区別する。 | [正本節](#3-操作ごとの境界) |
| Failure／Recovery | PASS | 観測不能時は候補を返さず、上位の回復判断へ結果を返す。 | [正本節](#5-状態資源回復) |
| State／Consistency | PASS | 要求検証、観測、応答、Process終了、観測不能を分ける。 | [§5](#5-状態資源回復) |
| Observability | PASS | OS結果、固定frame、Native実体とProcess終了を区別して観測する。 | [§7](#7-検証への接続) |
| Security／Trust | PASS | 検証済み固定binaryと用途限定要求だけをOS観測へ接続する。 | [§4](#4-バイナリ境界) |

結果語彙は次の意味に限定する。

- `PASS`: 詳細設計上の処置と根拠節が揃った状態。実装済み・試験済みを意味しない。
- `N/A`: Architecture上、そのConcern自体が存在しない状態。未検討や後工程送りを意味しない。
- `OPEN`: 未解決の設計事項が残る状態。
- `FAIL`: 必須設計と矛盾する、または必要な設計が未充足の状態。

## Qualityへの引渡し

| 導出キー | 設計項目種別 | 対象 | 正常条件 | 反証する失敗 | 主な試験段階 | 外部境界の段階 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|---|---|---|
| `platform-access.process-boundary` | Interface／Lifecycle Ownership | 固定Native実体と観測要求 | 完全応答とProcess終了を確認 | 欠落・改変・途中置換・応答異常 | UT／IT | Direct Boundary | Artifact・nonce・frame・終了結果 | 所有handle解放 | Provider Home実保護の全条件 |
| `platform-access.docker-repair` | 退役した導出キー | 旧Desktop Helper | 現行PAの完成条件へ使用しない | 旧処理の再導入 | N/A | N/A | 現行責務はDI設計参照 | PAはDocker操作を発行しない | 実Docker境界はDI側の別Gate |

導出キーは本領域内でQualityが同じ設計項目を反復参照するための局所参照であり、CRDD全体の安定コンテキストIDではない。

## 現行実装との照合

現行Sourceと既存試験は本詳細設計の正式入力ではない。本設計候補を固定した後、成立済み能力を失わないよう`Covered`、`Partial`、`Missing`、`Legacy`または`Implementation Detail`へ分類する。

担当責任者: Qual-Lab
最終更新日: 2026-09-07

## 1. 役割と非目標

`platform-access`は、TypeScriptだけでは確認できないProvider HomeのWindows主体・保護、Windows所在とFilesystem実体を観測する内部部品である。Runtime State初期化とDocker Desktop操作は提供しない。AIの方針、外部送信許可、一般Taskの順序、Authorityおよび最終結果は[Coordinator Runtime](../coordinator/01_Architecture.md)が所有する。native応答の`candidate`だけから実行許可を発行しない。

利用者がnative binaryを直接起動する通常手順は持たない。永続的なRuntime有効化、Platform Provisioning、AppContainer準備用Supervisorも持たない。

## 2. 成果物と依存

NativeのBuild指定と出力取得は[コーディング規約のNativeビルド契約](../../99_Coding_Standards.md#native-build-output)を参照する。対象環境付きの成果物を取得し、Cargo自身の無印補助出力とCRDDが利用する成果物を区別する。実行前確認は[Workflow](../../../19_Workflows/01_Coordinator_Runtime.md#native-build-output)が所有する。

### OSディレクトリの初期取得

Windows環境生成はNodeの診断レポートを使用せず、同梱Nativeの`--system-windows-directory`から`GetSystemWindowsDirectoryW()`の結果を取得する。これは読取り専用の初期取得であり、通常Task・RecoveryのAuthorityを発行しない。

| 境界 | 保持する条件 |
| --- | --- |
| 起動前 | 配布内の固定絶対Path、ソースに固定したNative SHA-256、ファイル実体の観測 |
| 起動環境 | 空の明示環境。親のSystemRoot・PATH・Proxyを信頼根拠にしない |
| 応答 | `CRDDWD01`、UTF-16 code unit数のLE u32、exact UTF-16LE本文。余剰・欠落・不正文字を拒否 |
| 終了 | 5秒以内の正常終了、stderrなし、実行前後の同一成果物確認 |
| 利用側 | 絶対Path・正規形・Filesystem実体を確認してから環境へ設定。失敗はnullで後続を停止 |
| 更新 | Native成果物と初期取得用Hashを同じ候補で更新し、同候補の実結合を確認する。通常更新に署名を必須化しない |

通常Bootstrapから任意の正式配布検証を逆参照する循環は作らない。固定Hashは初期取得部品の同一性だけを担い、Publisher Trustや実行許可の代替にはしない。

[Rust crate](../../../40_Develop/platform-access/Cargo.toml)から、固定成果物`crdd-platform-access.exe`を一つだけ生成する。v0.21の目標Pathは`40_Develop/platform-access/artifacts/windows-x64/`とし、`template/tools`へNative実行物を置かない。現行Pathからの移行は[CHG-000076](../../../99_Roadmap/Changes/CHG-000076/change.md)でManifest、署名、Promotion、RecoveryおよびE2EのConsumer Closureと同時に閉じる。

crateは`rust-toolchain.toml`、`Cargo.toml`および`Cargo.lock`でtoolchain、target、依存および版を固定する。通常Runtimeから`cargo run`、PATH上のCargo／Rust binaryまたは開発用`target/`成果物を起動しない。必要Artifactの固定相対Path、target、protocol revision、Rust toolchain、byte長およびSHA-256は追跡情報として保持する。正式配布物の署名は必要時の別契約であり、通常RuntimeのManifest必須Gateにはしない。言語・Buildの共通規則は[内部ツール・コーディング規約](../../99_Coding_Standards.md)、反復手順は[Coordinator RuntimeのWorkflow](../../../19_Workflows/01_Coordinator_Runtime.md)を参照する。

```text
用途別Adapter（Coordinator／Docker Isolation等）
  → Platform Accessの固定Artifact／Bootstrapで実体・Hashを観測
  → 固定Pathのcrdd-platform-access.exe
    ├ Provider Homeの保護・実体観測
    ├ System Directoryの観測
    └ 単一Filesystem entryの非追従観測
  → nonce・応答・終了・実体同一性を再確認
  → 診断／Task／Recovery結果
```

退役方式の比較基準として、署名manifest revision 5は固定相対Path、target、Rust toolchain、byte長、protocol revisionおよびSHA-256を閉じたRuntime実行Identityへ結合していた。現在の通常実行にはこの結合・署名資格・旧Manifest Readerを復元しない。過去の署名・Hash・Evidenceは歴史として保持する。CRDDのCommit／TreeとArtifact Hashは追跡・同一性確認であり、Publisher真正性や実行Authorityを発行しない。削除済みの`coordinator.exe`、native bootstrap feature、別Supervisor artifact fieldおよび旧manifest revisionへのfallbackはない。

## 3. 操作ごとの境界

### 内部ブロックとOS接続

```text
Coordinator／Docker Isolation
  ↓ 用途固定の公開API
Platform Access TypeScript（要求構築・搬送・応答・終了の技術Owner）
  ↓ 検証済み固定binary
Rust受付・dispatch [src/native/main.rs]
  ├→ Provider Home要求・応答 [protocol/access.rs]
  │     └→ 固定Provider Home観測 [filesystem/windows/protected_root.rs]
  │          ├→ 主体・Token観測 [process/windows/principal.rs]
  │          └→ 保護・実体観測 [filesystem/windows/protection.rs]
  ├→ System Directory／内部Known Folder観測 [filesystem/windows/windows_directory.rs]
  └→ 単一Filesystem entry非追従観測 [filesystem/windows/entry_observation.rs]
  ↓ 閉じた応答frameとProcess終了
Platform Access側で技術相関を確認 → 上位の許可・診断／回復判断
```

| 内部ブロック | Source群（Rustは`src/native/`基準） | 所有範囲 |
|---|---|---|
| 受付・応答形式 | `main.rs`、`protocol/access.rs` | 固定mode選択、Provider Home応答と不正要求拒否。旧Store値3／Runtime値4・初期化要求は拒否 |
| Windowsフォルダ観測 | `filesystem/windows/windows_directory.rs` | System Directory公開観測とProvider Home内部のKnown Folder取得 |
| Windows主体観測 | `process/windows/principal.rs` | Provider Home用Token／SID／認証Sessionと主体分類 |
| Windows保護・実体観測 | `filesystem/windows/protection.rs` | Handle・Descriptor所有、Directory Identity、ACL AccessCheckとhash resource解放 |
| 固定Provider Home観測 | `filesystem/windows/protected_root.rs` | Codex／Claudeの固定親と主体・保護Bindingを照合。Credential本文を読まず、既存Homeの作成・修復はしない |
| 単一entry観測 | `filesystem/windows/entry_observation.rs` | 非追従の属性・reparse tag・実体を観測。不在と観測不能を区別する |
| Artifactと搬送 | `src/artifact/identity.ts`、`src/filesystem/` | 固定配布物のHash・実体、要求／応答相関と子Process終了を確認する |

Runtime State初期化・保存はCoordinatorのNode Store、Docker Desktop操作はDIが所有する。削除したNative初期化・Desktop Helperの代替modeは設けない。Provider Homeの観測結果は既存の上位Ownerが同じ操作へ結合するものであり、Hashだけで許可やMount権限を発行しない。Linux／macOSのNative実装経路はない。

### 固定保存境界の私有観測

Namespaceの親・Recovery Directoryの固定child／Root範囲・非link・Path／実体確認と通常回復記録はCoordinatorに維持する。SID／DACL・祖先Handleの専用保護確認、専用Host終端記録とcaller Leaseは退役した。Provider Homeの保護Policyは変更しない。旧形式の互換Reader、代替保存、過去保持物の移行・削除は提供しない。

### 共有管理フォルダの保護付き作成と限定移行（退役仕様の履歴）

以下は基準版`53209fad7`までのNative仕様の履歴である。2026-11-07のNode中心Policy採用後は実装・試験入口として使用しない。現行のNamespace生成と運用前提は本書冒頭を正本とする。実共有DirectoryのACL変更・移行や過去保持物の処置は今回行わない。

通常作成と既存権限の移行は別の処理である。通常作成は、明示不存在の場合だけ現在利用者とSYSTEMの非継承full-control二ACE、現在利用者owner、protected DACLを作成時に指定する。競合による既存化も、同じ保持chainから実体・型・fresh ACLを再確認する。既存不適合を修復せず停止し、失敗時に共有フォルダをrollbackで削除しない。

| 処理 | 対象と処置 | 停止条件 |
|---|---|---|
| 通常producerの共有作成 | 検証済み一時親の固定child `crdd-coordinator-recovery-v1`だけ。作成済み共有物は検証だけ行う。 | 存在不明、file／reparse、owner・保護不一致、実体差または取得・close不明。 |
| 既存共有ACLの限定移行 | 独立保持した親・共有実体・利用者・変更前ACLに結合した明示操作。通常作成・観測・保存から呼ばない。 | 人間の実操作許可、全producerの開始抑止・終了、既存childへの影響と旧exact回復の維持を確認できない場合はEffect 0で停止。 |

発火例は固定childの明示不存在、非発火例は適合済み共有物の再利用、境界例は作成競合と既存不適合、情報不足例は存在・close・現在使用の不明である。通常作成は、新しい共有排他の存在だけで全producer停止を主張しない。限定移行はACL更新APIの継承波及を事前に確認し、childのIdentity・bytes・保護と旧回復の利用能力を変更前後で比較する。確認できない場合は移行を開始しない。部分Effectを保持し、自動rollback・再実行しない。

2026-10-04の承認は設計・実装・自己生成fixture試験の追加だけであり、実共有Directoryの作成・権限変更・Process停止・旧三件削除ではない。Native私有部品の試験から、通常producer、署名済み搬送、限定移行または公開Recovery全体の成立を推定しない。

私有の`open_bootstrap_parent`と`create_host_recovery_directory`は、親chainを保持してRecovery Directoryを保護付き作成・再利用し、fresh Identity／ACLと全取得handleの初回closeを確認する。旧終端子向け`open_observed`・固定namespaceのCurrent／Known経路は撤去した。新品fixtureで通常作成・reuse・不適合ACL／同名file拒否と旧子File／Directoryの無変更を確認する。実共有領域の初期化・既存ACL移行・OS API／close故障の実測は、この局所確認へ含めない。

保護付き初期化の搬送は、親の読取り確認 `--host-recovery-namespace-observe` と、独立期待値付き作成 `--host-recovery-namespace-initialize` を分離する。候補要求はそれぞれ `CRDDNC01`（42bytes）と `CRDDNI01`（98bytes）、応答は `CRDDNR02`、revision 2とする。作成要求は親の六識別値と選択利用者Hashを必須とし、読取り要求には作成を指示するfieldを設けない。自由Path、SID、ACL mask、移行指定は受理しない。

応答は親とRecovery Directoryの部分実体、一つの作成発行・作成結果・handle取得・初回close、Tokenと祖先handleの個別closeを保持する。作成結果不明を未発行へ戻さず、終了不明では元理由を保持する。初期化成功は二実体・現在利用者・Recoveryの保護・全終了の共同成立が必要である。搬送や相関不成立ではEffect不明として停止し、共有Directoryを自動削除しない。旧子の実体・存在・保護は成功条件にしない。

#### 対象一式の私有読取り接続

専用Host終端記録Capabilityとともに退役した。現行Namespace初期化・通常Recovery保存・共有Pipe排他の保証へ流用しない。旧仕様と検証履歴は改訂`7f41e8cf5`に残る。

### Host終端記録の内部保存部品

専用Host終端記録Capabilityとともに退役した。現行Namespace初期化・通常Recovery保存・共有Pipe排他の保証へ流用しない。旧仕様と検証履歴は改訂`7f41e8cf5`に残る。

#### 記録保存の共通排他

専用Host終端記録Capabilityとともに退役した。現行Namespace初期化・通常Recovery保存・共有Pipe排他の保証へ流用しない。旧仕様と検証履歴は改訂`7f41e8cf5`に残る。

#### 同じ排他区間での容量計数と保存

専用Host終端記録Capabilityとともに退役した。現行Namespace初期化・通常Recovery保存・共有Pipe排他の保証へ流用しない。旧仕様と検証履歴は改訂`7f41e8cf5`に残る。

#### 別Processからの現在読取り

専用Host終端記録Capabilityとともに退役した。現行Namespace初期化・通常Recovery保存・共有Pipe排他の保証へ流用しない。旧仕様と検証履歴は改訂`7f41e8cf5`に残る。

#### 返却された実体情報がない場合の現在候補観測

専用Host終端記録Capabilityとともに退役した。現行Namespace初期化・通常Recovery保存・共有Pipe排他の保証へ流用しない。旧仕様と検証履歴は改訂`7f41e8cf5`に残る。

## 4. バイナリ境界

存続するProvider Homeは`protocol/access.rs`、System Directoryと単一entryはそれぞれの固定出力実装が正本である。Namespace／Runtime State初期化はCoordinator、Docker環境操作はDIが所有する。

| Protocol | 識別と長さ | 確認事項 |
|---|---|---|
| 不正要求 | `CRDDPR03`、固定拒否応答86bytes | 旧Root・AppContainer・Namespace・Desktop専用modeは拒否。未知の標準入力を観測へ配送しない |
| Provider Home | revision 3、`CRDDPH02`／`CRDDHO02`、要求76・応答182bytes | 値1／2、nonce、主体・保護・安定Identity。byte11は予約0のみ。旧値3／4と非0の初期化指定はOS観測前に拒否する |
| System Directory | `CRDDWD01`と実装の固定長・UTF-16出力 | PA自身が必要とするWindows所在の独立観測 |
| Filesystem entry | `CRDDFE01`、41bytes | 通常実体・不在・観測不能、属性・tag・File Identityを区別する |

Provider Home入力prefixを持つ不正要求は、既存の182bytes拒否frameで返す。部分応答・nonce不一致・異常終了を成功へ補完せず、raw出力や秘密を公開しない。

## 5. 状態・資源・回復

Provider Home観測は、要求検証、固定対象open、主体・保護・実体観測、前後一致、応答の順で行う。Directory、Token、security descriptor、Known Folderおよびhash handleは所有箇所で解放する。Runtime StateのDirectory作成Effectは発行しない。

TypeScript搬送は固定binaryの同一性、完全frame、相関と子Process終了を確認し、不明を正常へ補完しない。Native観測自身は耐久Recovery record・Lock・操作許可を所有しない。Docker Desktopの停止・起動・Directory処置は[DI設計](../docker-isolation/01_Architecture.md#desktop-helperの退役と公式cliへの接続--2026-11-10)へ委譲し、旧Job／Mutex／Helperを再設置しない。

## 6. 呼出し元との分担

| Native／PA側 | 上位Owner側 |
|---|---|
| OS実体・主体・保護の観測 | Repository、Provider、同一操作との結合 |
| 固定入力、nonce・flag・Hash、完全応答とProcess終了 | 操作許可、実行・回復判断、耐久記録、結果公開 |
| Native handleの解放 | Docker、Mount、Host等をまたぐ全体Cleanup |

正常OSと認証済みローカルユーザーを最小信頼境界に含める。Administrator、kernelまたはOS検証器を支配した攻撃者への完全耐性は主張しない。Runtime StateのNode移管を、Provider Home Native保護と同等保証とは扱わない。

## 7. 検証への接続

| 対象 | 確認先 |
|---|---|
| 要求・応答とCLI | [Rust CLI試験](../../../40_Develop/platform-access/tests/integration/native_cli.rs)、protocol内試験。存続要求のframeと旧値3／4・初期化指定の拒否を確認 |
| 成果物同一性 | [成果物同一性試験](../../../40_Develop/platform-access/tests/integration/artifact-identity-observation.contract.test.ts)。固定Artifact／Bootstrapと実Filesystem相関を確認し、Publisher真正性や実行許可へ昇格しない |
| Provider Home | Native共有Hash・SID試験と[保護Protocol試験](../../../40_Develop/platform-access/tests/unit/filesystem/protection.contract.test.ts)、[公開搬送試験](../../../40_Develop/platform-access/tests/integration/root-observation.contract.test.ts) |
| System Directory／単一entry | [所在試験](../../../40_Develop/platform-access/tests/integration/system-directory.contract.test.ts)、[entry試験](../../../40_Develop/platform-access/tests/integration/entry-observation.contract.test.ts)、Native entry試験 |
| 移管済みRuntime State | [判断Store統合試験](../../../40_Develop/coordinator/tests/integration/task-windows-decision-store.contract.test.ts)。Nodeでの成立をNative保護成立へ読み替えない |
| 移管済みDocker操作 | [DI技術接続試験](../../../40_Develop/docker-isolation/tests/integration/repair-runtime.contract.test.ts)、[Coordinator Writer結合試験](../../../40_Develop/coordinator/tests/integration/runtime-repair-owner.contract.test.ts)。実Docker境界は別Gate |

単体・模擬搬送の合格から、実Home保護、配布元真正性、実Docker修復または終了後資源0を推定しない。実境界と全体回帰の実施状態を分け、退役方式の試験を現在の保証へ流用しない。

## Implementation Structure

| 観点 | 適用 | 判定理由 | 成立させる構造 | 局所責務・不変条件 | 失敗・変更時の影響 | Qualityへの導出キー |
|---|---|---|---|---|---|---|
| Variation | Required | この観点を成立させる構造と責務が存在するため。 | Qualityへの引渡しで責務差を別の設計項目として固定する。 | 具象差を一つの分岐へ畳まず、各導出キーの正常条件と反証条件を保つ。 | 新しい具象を追加した場合、対応する導出キーと利用側の再確認が必要になる。 | `platform-access.process-boundary`<br>`platform-access.docker-repair` |
| Common Contract | Required | この観点を成立させる構造と責務が存在するため。 | Windows／将来PlatformのProcess、Filesystem、Docker観測と限定操作を、要求・観測・結果・終了後状態の共通契約へ揃える。 | Platform具象は上位Authorityを作らず、OS固有結果を欠測や成功へ畳まない。 | Platform追加が上位CoreへOS型や固有Errorを漏らし、同じ保証を提供できない。 | `platform-access.process-boundary`<br>`platform-access.docker-repair` |
| Creation／Selection | N/A | 本領域は独立した具象生成・選択責務を持たず、上位から固定入力を受ける。 | 本領域は独立した具象生成・選択責務を持たず、上位から固定入力を受ける。 | 生成・選択判断を本領域へ追加しない。 | 将来生成・選択責務を追加する場合に再評価する。 | N/A |
| State-dependent Behavior | Required | この観点を成立させる構造と責務が存在するため。 | 入力・処理中・完了・失敗・観測不能を区別して振る舞いを決める。 | 状態を空値や成功へ畳まず、同じIdentityで終了条件まで追跡する。 | 状態追加・統合はRecoveryと観測契約へ波及する。 | `platform-access.process-boundary` |
| Composition／Recursion | Required | この観点を成立させる構造と責務が存在するため。 | 複数の局所責務を公開結果へ合成し、部分成立と全体成立を分ける。 | 各局所結果を保持し、必要な全要素が揃うまで上位完成を表示しない。 | 構成要素の追加時は完成条件と全Consumerを再確認する。 | `platform-access.process-boundary`<br>`platform-access.docker-repair` |
| Lifecycle Ownership | Required | この観点を成立させる構造と責務が存在するため。 | Process、Handle、一時物、秘密または公開SnapshotのOwnerと終了条件を固定する。 | 成功・失敗・取消の全経路で資源回収または同一Identityの回復義務を残す。 | Owner変更は取消、Recovery、終了後条件へ波及する。 | `platform-access.docker-repair` |
| External Boundary | Required | この観点を成立させる構造と責務が存在するため。 | 外部境界ごとに要求、受理、Effect、結果搬送および終了後状態を分ける。 | 境界の成功を要求発行だけから推定せず、段階に応じた観測を必須にする。 | 境界変更は直接境界からSystem／E2Eまでの検証範囲へ波及する。 | `platform-access.docker-repair` |

同じ責務へ二つ目の具象実装を追加する場合は、共通契約へ昇格するかを評価する。昇格しない場合は、同じ責務ではない、または局所分岐の方が単純で影響が小さい理由を記録する。特定のDesign Pattern名は必須にしない。

## 上流UI／SPEC Detailとの関係

| Detail Source | UI／SPEC Definition | この領域が担当するSCR／PRT／Interaction／BHV | Relation状態 | 未解決Gap／戻し先 |
|---|---|---|---|---|
| [UI／SPEC Detail Architecture Traceability](../../08_UI_SPEC_Detail_Traceability.md) | ARCH-000004、ARCH-000008、ARCH-000011のSource Definition | 同Traceability表で上記ARCH-IDへ接続された全Detail ID | Covered | Detailの意味変更はUI／SPECへ、配置責務の変更は該当ARCH定義へ戻す |

担当Interaction Relation: `PRT-000002.spec-000002`、`PRT-000002.spec-000003`、`PRT-000002.spec-000028`、`PRT-000002.spec-000029`、`PRT-000003.spec-000004`、`PRT-000003.spec-000005`、`PRT-000005.spec-000009`、`PRT-000011.spec-000005`、`PRT-000011.spec-000016`、`PRT-000012.spec-000017`

本領域は上記Relationの配置責務を局所所有する。Detailを新しい要求として解釈せず、対応ARCH-IDが所有する配置・境界・状態・観測の制約として実現する。

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
