# Windowsネイティブ部品の設計

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

Namespaceの存続試験は`tests/integration/host_namespace.rs`へ接続する。`host_namespace::tests`と`host_namespace_creation_tests`／`protection_tests`の既存ignored条件を維持し、専用記録の保存・容量・現在候補・Known処理は退役する。

PAから上位Packageを参照しない。開発観測の前後二回borrowとCapability判断は上位に残し、後確認が不成立なら発行しない。DI Policy Hashは上位が取得した用途固定入力であり、汎用raw argv／frame・任意実行物のAPIは公開しない。Rust側のWindows Publisher検証はCRDD署名の退役と別責務として維持する。

Native実行物の確認はPlatform Access内部へ閉じる。Root公開APIからArtifactのbegin／verifyを撤去し、内部の確認を別名の公開Handle・Registryへ置き換えない。上位が継続性を確認する場合は`observeNativeArtifact`の非Authority値を使う。固定順のRoot実体、実行Path、File実体（bigintの精度を維持）、内容Hashとbyte長を同一Snapshotから`identitySha256`へ結合する。元Hashを指定した再観測は同じ実体・内容だけを返し、観測不能・不一致はnull、正常だが固定Bootstrap不一致は`bootstrapVerified:false`で区別する。

最初の接続は`filesystem/root.ts`の`observeWindowsRuntimeState`／`observeWindowsProviderHome`とする。入力・nonceを含む要求構築→初回開発観測→Artifact・環境確認→固定Native→Helper結果→Artifact後確認→後開発観測→応答意味検査の順を維持する。開発観測は、上位が既存Contextをclosureに閉じた同期Readerを渡し、この一呼出し内だけで借用する。初回nullと期待Artifact欠落を区別し、後回の返却値から実行物を再選択しない。Reader例外を包括catchで隠さない。

二APIは非Windowsを明示拒否し、観測候補または固定失敗区分・Process発行・終了・Artifact前後確認を返す。token・raw frame・実行物Path・Capabilityを返さない。Root用途・Home選択、鮮度10秒、Capability発行・消費・失効は従来の上位Ownerが維持する。純粋Protocolは`filesystem/protection.ts`へ移し、通常利用側へwire構築・解釈の手順を要求しない。

`host-record/namespace.ts`の`initializeWindowsHostRecordNamespace`は、親の観測・期待Identity結合・保護付き初期化と固定Nativeの前後確認を所有する。上位は作成時点・失敗分類・清掃判断を所有する。観測と初期化の二要求、部分receiptとFilesystem Effectの不明値、個別終了・応答と終了値の相関を保持する。独立した観測APIや任意のwire入力は公開しない。純粋ProtocolとNative搬送の試験はPA、上位作成との結合試験はCoordinatorが所有し、別Packageの非公開Sourceを直接importしない。

Cargo rootとtarget位置を維持し、Buildは`src/native/build.rs`、実行入口は`src/native/main.rs`、CLI結合試験は`tests/integration/native_cli.rs`へ明示接続する。[現物・Consumer対応表と検証範囲](../../../99_Roadmap/Changes/CHG-000082/platform-access-source-structure.md)が移管結果と未実行範囲を所有する。

### TypeScript公開APIと所有者

公開入口は`src/index.ts`だけとし、bin入口は新設しない。Rust CLIは用途固定の内部Protocolであり、上位Packageへraw frameを要求しない。

| 責務Folder | 公開操作 | 返すもの・所有しない判断 |
|---|---|---|
| `artifact` | `observeNativeArtifact`、`observePlatformAccessArtifactCandidate` | 実体・内容の観測値。実行許可・Publisher真正性・tokenは返さない |
| `filesystem` | `observeSystemWindowsDirectory`、`observeWindowsLocalAppDataDirectory`、`observeWindowsFilesystemEntry` | OS所在・対象一件の観測。削除許可は返さない |
| `filesystem` | `observeWindowsRuntimeState`、`observeWindowsProviderHome`、`describeProviderHomeObservationContract` | 固定Nativeの技術観測と部分Effect。Capabilityの発行・鮮度判定は上位 |
| `host-record` | `initializeWindowsHostRecordNamespace` | 用途固定の親照合・初期化と部分receipt。作成時点・清掃判断は上位 |
| `docker-desktop` | `startDockerDesktopRepairHelper`、`startDockerDesktopRestartHelper` | 固定補助子・Protocol・stdio・終了処理。操作許可、Policy、Engine判断、CheckpointはDocker Isolation |
| `process` | `startWindowsChildTreeTermination` | 所有子の終了結果。Process番号だけで別対象を停止しない |
| `process` | `createChildProcessEnvironment`、`createWindowsHostTerminalHelperEnvironment`、`createWindowsPowerShellAuthenticodeEnvironment`、`deriveWindowsSystemDrive`、`describeWindowsChildEnvironmentContract` | 用途固定の環境値・契約。任意環境builderを公開しない |

固定target・Protocol・Toolchain・容量・環境契約の定数と、各操作の型もRootから明示exportする。正確なexport集合は公開契約試験で固定し、用途内のdecoder・wire・内部Artifact tokenは含めない。


## v0.22 Node境界の追加（移管候補）

### 通常Nativeの固定Bootstrap確認

固定Bootstrap確認は`artifact/identity.ts`内部のNative実行経路で維持する。上位の開発Sessionは`observeNativeArtifact`の`bootstrapVerified:true`を要求し、元実体Hashの前確認→新観測→元Hashの後確認→新Hashの最終確認を維持する。Hash不一致・観測不能を新baselineで上書きしない。固定bytes一致はGit改訂一致、Publisher真正性、実行Authorityを意味しない。一般Artifactの継続性だけを要求していた診断・Docker保持照合へBootstrap必須条件を追加しない。

### 同じ修復補助子の利用者相関

Hの`ownerBindingSha256`は選択利用者のprincipal identity hashである。認証Session等を含む既存Task・旧修復記録のtoken binding hash（`localUserBindingHash`）とは別計算であり、同値を要求しない。未リリースの修復Identityだけを新fieldへ統一し、旧keyの互換受理はしない。

Docker Isolationの保存前準備に必要な非秘密相関として、Repair Native Protocolを`CRDDDR06`へ更新する。既存の41byte（magic 8・status 1・payload 32）を維持し、固定`H`だけはstatus `H`と選択利用者Hash全32byteを返す。同じrunで一度捕捉した値から既存Mutex名のsuffixとH payloadを生成する。Root・利用者の選択引数や新しい排他は追加しない。Mutex／Artifact取得失敗ではHashを返さない。

通常の`V/I/S/K/L/Q`は既存Policy Hash照合を維持し、`I`のProcess一覧観測を変更しない。Restartは`CRDDDS01`のままHを拒否する。旧Repair05のfallbackはない。Nodeは初期R→V確認→H読取りを同じ子で直列実行し、一度取得した値を保持する。競合命令はwrite前に拒否し、異種・欠測・余分frame・timeout・stderr・終了不明では相関を返さず、既存の補助子終端へ収束する。Hashは相関値だけであり、Mutex現在所有、認可、Root／Writer Authority、実修復成功を保証しない。

### 単一entryのrawメタデータ観測（接続中）

`--filesystem-entry <path>`は有界なローカル絶対Path一件の読取り専用観測である。`filesystem/entry_observation.rs`はOPEN_REPARSE_POINT／BACKUP_SEMANTICSと属性読取り権だけで対象を開き、同じhandleから属性、tag、volume serial、file index、creation FILETIME、linkCountを取得する。内容、ACL、削除、排他またはScopeの許可は扱わない。相対・UNC・device・ADS・曖昧segmentを拒否し、処置対象の固定と現在Owner確認はDocker Isolationが所有する。

応答`CRDDFE01`は41bytes固定で、magic8、status1、attributes u32、tag u32、volume serial u32、file index u64、creation FILETIME u64、linkCount u32をlittle-endianで搬送する。statusはP（観測）またはA（明示不存在）で、Aの残り32bytesは0とする。不存在はFILE_NOT_FOUND／PATH_NOT_FOUNDだけである。その他の失敗はexit2・応答なし、出力失敗はexit3であり、不明をAへ補完しない。Pは非zero実体・linkCount、属性とtagの整合、handleの明示close成功を必要とする。kindや削除可否は返さず、利用側がraw値から判断する。

privateな同期関数だけがopen→query→close→write→flushを直列化する。本番の取得・照会closureは既存Win32入力と相関検査をそのまま使い、公開差替え、trait、共有状態は追加しない。取得成功ではquery失敗でもclose一回、close不明では出力0。取得不成立ではquery／closeを実行しない。write失敗では部分出力、flush失敗では完全frameがあり得るが、exit3を成功へ変更しない。この順序と故障分岐は`ERB-UT-039`のメモリ試験が所有し、現物の型・実体観測は既存ITが別に確認する。

一要求一Process・exact argv・完全frame・Artifact前後確認を`src/filesystem/entry.ts`で結合し、新nonceやRepair Session Protocol変更は追加しない。Native実体の単位をNode実体へ未実証で変換しない。Nodeのraw観測は未知tagも意味を保持して返し、削除可否はDIだけが判断する。2026-10-17の開発Buildでは自己生成AF_UNIXのhandleを閉じて残した端点のP応答・tag0x80000023を取得し、Node unlink後のA応答と専用Root不存在を確認した。子PowerShellを使う試験は環境の起動拒否で未到達だったため、この成功へ含めない。異常終了子の方式選択実測とは別の実測である。同期故障反証の限定レビュー後、既存固定配布Nativeとbootstrap Hashを`a85d46241ba5cb4d771d2b6c493254262492935e3a5e9d20fea2bd486acc9cc9`へ更新した。公開API経由のfile／Directory／hardlink／junction／不存在と旧Known Folder二用途は限定確認済み。Host専用試験は制限内のhardlink EPERMを成功へ丸めず別profileで実施し、自己生成物の清掃と不存在を確認する。既存保護API・Repair Protocol・過去の署名Manifestは不変更である。退役した署名Package方式は現在の完成条件にせず、歴史記録として保持する。現在のDI実回収・三用途終端と必要な実境界の成立は未完了である。

### 修復対象のLocalAppData所在観測

Docker修復の新しいMachineは、旧RuntimeState Rootを逆算してOS所在を得ない。`src/filesystem/local-app-data.ts`の引数なし`observeWindowsLocalAppDataDirectory()`が、固定Native mode `--local-app-data-directory`と既存Rustの`local_app_data_path()`を使い、現在Processの利用者のKnown Folderを観測する。任意GUID／利用者／Path、環境値fallback、Directory作成・ACL変更・Authorityを提供しない。

専用frameは`CRDDLA01`の8bytes、little-endian u32のUTF-16単位数、1〜32767単位の本文である。既存System Directoryの`CRDDWD01`とは混用しない。固定Artifact Hashと前後実体を確認し、空環境・固定cwd・shellなし・5秒・65548bytes上限で一回起動する。成功exit・stderr空・完全frame・fatal UTF-16・正規絶対Path、Directory／非link・realpath一致と前後実体一致を要求し、不明はnullとする。System Directoryの既存Protocolと返却条件は変えない。両読取り入口のbootstrap HashはArtifact観測Moduleの単一固定値を使う。

返却Pathは非Authorityの所在値だけで、意図した利用者との一致、ACL、Root Authority、排他やDocker修復完了を保証しない。利用側は実処置前に同じOwnerと対象実体・親・許可・取消を再確認する。既存署名Manifestは過去の記録として変更せず、新Native Hashと実読取り結果を新候補の根拠にする。全Machineと現在状態への接続が未完了の間は、読取り入口の成立だけを全体完成と表示しない。

2026-10-14の人間承認に従い、既存の本PackageへTypeScript公開入口と試験を追加する。当初の移管はRust本体・配布Nativeの固定Hash・Protocol・用途別権限を変えずに行った。上記LocalAppData所在観測の追加では、既存Known Folder処理の再利用に必要な固定modeと独立frameだけを追加してNativeを再Buildする。既存Protocolと用途別権限を変えず、別Package／Frameworkは作らない。CoordinatorにあったNative Artifact同一性観測とSystem Windows Directory観測は、このOwnerが所有する。

| 配置 | 所有する処理 | 公開／終了条件 |
|---|---|---|
| `src/artifact/identity.ts` | 固定NativeのRoot／file実体、同handleの有界Hash、前後再観測、Process内の非Authority Snapshot | Root公開は`observeNativeArtifact`／`observePlatformAccessArtifactCandidate`と必要定数。begin／verify・token・実体内部はPA内部。descriptorはfinallyでclose |
| `src/filesystem/system-directory.ts` | 固定Nativeの`--system-windows-directory`、CRDDWD01の有界・厳密decode | 固定Hashと前後同一性、閉じたargv・環境・cwd・待機上限を維持。不明・不正・非Windowsは取得不能。これは資源不存在の観測ではない |
| `src/filesystem/local-app-data.ts` | 固定Known Folderの`--local-app-data-directory`、CRDDLA01の厳密decodeと安定Directory確認 | 引数なし・非Authorityの所在観測。旧RuntimeState・環境fallbackなし。意図した利用者・Root Authority・処置許可は別確認 |
| `src/process/environment.ts` | OS由来Directory／Profile検証、中立環境、Console／Supervisor／Native／Host終端／固定PowerShell初期化環境、純粋Drive検査 | 既存用途固定の操作だけを公開。任意additions builderはprivate。親環境をAuthorityにせず、Host終端だけTMP／TEMPを導出する。Docker用Home・config・Hints・修復用Drive付与とPublisher判断は所有しない |
| Coordinator `src/execution/kernel-lock.ts`／`src/objective/execute.ts` | CoordinatorがNode.js標準APIを直接使用（PAの観測入口は撤去） | PIDだけをSignal 0で観測し、ESRCHだけabsent、EPERM等はunknown。不正PIDではOS照会0。世代結合・Lease入力・回復判断は上位。Platform familyは既存Windows対応だけを返し、未対応OSへfallbackしない |
| `src/lock/pipe.ts`、`lifecycle.ts`、`worker.ts`、`supervisor.ts` | `acquireNamedPipeKernelLock`、`acquireNamedPipeKernelLockOutcome`、`acquireNamedPipeSupervisorLock`と結果型 | 既存Windows用途のPipeだけを取得し、Worker／共有状態・Supervisor／IPCと終了を所有する。用途別Hash・namespace導出・取得順・上位状態判断は呼出しOwner。Supervisor環境はPA自身が構築し、任意環境は受け付けない |
| `src/process/child.ts` | PA内部の固定Worker・Supervisorの起動 | Package Rootへ汎用spawn／Worker factoryを公開しない。eval・shell拒否と固定execPathを維持する。Workerは無出力の既存Lock種別に限定し、親側stdout／stderrを閉じてunrefによる親終了を妨げない。Worker本体・共有状態・message・error／exitは維持し、stdio破棄を解放／終了成功へ換算しない。試験Toolの自己起動は所有しない |
| `src/process/termination.ts` | 所有ChildProcessを対象とする固定taskkillの開始、有界結果待機、補助子の終了とclose観測 | 生存元子だけを対象とし、観測後も未終了を再確認する。任意PID・実行物・引数・環境builderは公開しない。補助開始／終了値／closeと元子closeは別の事実。Consumerが一度発行と元子closeを所有する |
| `src/index.ts` | 上記の必要な意味操作を明示export | Coordinator／Docker Isolation等はRoot APIを使い、下位から上位import 0、旧Path／shim 0 |

固定tree終端は、要求直前に元子未終了と観測したPIDを対象とする。観測からOS受理までのPID再利用防止やOSのexact Process Identity保証は成立範囲に含めない。補助子成功だけでは元子終了を判定せず、Consumerが元子closeを別に確認する。未再現の可能性だけを理由に共有Registryや新しい管理機構を追加しない。

観測はFilesystem読取りとProcess内Snapshot保持を伴い、純粋関数ではない。変更・実行Authorityを発行せず、Hashを署名／Publisher真正性／実行許可へ昇格しない。旧`SigningObservation`は暗号署名ではなかったため、Artifact観測へ名称を訂正する。既存のreason／statusは維持する。署名Manifest結合の記述は通常Runtimeの保証へ移植しない。

Node／Rust両試験を既存Catalog・Verification Runnerの同じOwnerへ接続する。Nodeの静的検査・試験と既存Cargoの静的検査・試験を区別し、片系の欠落を成功扱いにしない。旧製品・Script・exact配布検査・型Project・Symbol・Catalog・coverage・fixtureの全利用側を同じ固定候補で切り替える。正常Nativeだけでなく欠落、改変、Root／file置換、偽token、Process／出力異常を確認する。移管・実測未完了をPackage全体完成へ拡張しない。

## 基本設計との関係

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000004](../../Definitions/ARCH-000004/architecture_definition.md) | Process／Job／Containerの開始、取消、終了とcleanupをExecution Adapterへ提供する。 | Partial |
| [ARCH-000008](../../Definitions/ARCH-000008/architecture_definition.md) | OS、Process API、Dockerの要求・受理・Effect・観測を分けた診断結果を返す。 | Covered |
| [ARCH-000011](../../Definitions/ARCH-000011/architecture_definition.md) | OS管理Runtime path、native resource、stale socketと修復記録のlifecycleを実装する。 | Partial |
| [ARCH-000014](../../Definitions/ARCH-000014/architecture_definition.md) | 必要Native Artifactの同一性を読取り観測する。通常実行許可・CRDD署名・Publisher真正性を発行しない。 | Partial |

Relation状態は、この領域が担当する責務断面に対する状態である。複数領域で同じARCH-IDを実現する場合、各領域の断面を合成して基本設計全体を閉じる。

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | Process、Job、Console、Docker修復のネイティブ操作を分ける。 | [§3](#3-操作ごとの境界) |
| Interface Model | Required | 呼出し元とNative helperの入力・結果・Authorityを分ける。 | [§6](#6-呼出し元との分担) |
| Data Flow | Required | exact IdentityとNative結果の往復を追跡する。 | [§3](#3-操作ごとの境界) |
| State Model | Required | 要求、受理、開始、完了、観測不能、回復待ちを分ける。 | [§5](#5-状態資源回復) |
| Sequence | Required | Capability取得後だけEffectを発行し、終了観測まで保持する。 | [§3](#3-操作ごとの境界) |
| Failure／Recovery | Required | 部分Effectと不明状態を同じRecovery Identityへ結ぶ。 | [§5](#5-状態資源回復) |
| Deployment | Required | Windows binary、Node利用側、Docker Desktopの境界を固定する。 | [§2](#2-成果物と依存) |
| Observability | Required | OS結果、Process終了、Engine ready、残存資源を実境界で観測する。 | [§7](#7-検証への接続) |
| Security Boundary | Required | 検証済みbinaryと用途限定Capabilityだけを実Effectへ接続する。 | [§4](#4-バイナリ境界) |
| Implementation Structure | Required | 設計責務を具象差、選択、状態依存、構成、資源Ownerおよび外部境界へ分解する。 | [§Implementation Structure](#implementation-structure) |

`N/A`は未検討を意味しない。対象外にできるArchitecture上の理由を記載する。

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS | 同じProcess／repair Identityへの操作を直列化する。 | [正本節](#5-状態資源回復) |
| Timing | PASS | 要求、Engine ready、終了、Socket再生成を別の有界観測にする。 | [正本節](#5-状態資源回復) |
| Resource Lifecycle | PASS | handle、Job、Socket、stale directory、repair記録をexact Identityへ結ぶ。 | [正本節](#5-状態資源回復) |
| External Boundary | PASS | Windows APIとDocker Desktopで要求受理を完了とみなさない。 | [正本節](#3-操作ごとの境界) |
| Failure／Recovery | PASS | 観測不能時はEffect不明と回復義務を保持する。 | [正本節](#5-状態資源回復) |
| State／Consistency | PASS | 要求、受理、開始、完了、観測不能、回復待ちを分ける。 | [§5](#5-状態資源回復) |
| Observability | PASS | OS結果、Process終了、Engine ready、残存資源を実境界で観測する。 | [§7](#7-検証への接続) |
| Security／Trust | PASS | 検証済みbinaryと用途限定Capabilityだけを実Effectへ接続する。 | [§4](#4-バイナリ境界) |

結果語彙は次の意味に限定する。

- `PASS`: 詳細設計上の処置と根拠節が揃った状態。実装済み・試験済みを意味しない。
- `N/A`: Architecture上、そのConcern自体が存在しない状態。未検討や後工程送りを意味しない。
- `OPEN`: 未解決の設計事項が残る状態。
- `FAIL`: 必須設計と矛盾する、または必要な設計が未充足の状態。

## Qualityへの引渡し

| 導出キー | 設計項目種別 | 対象 | 正常条件 | 反証する失敗 | 主な試験段階 | 外部境界の段階 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|---|---|---|
| `platform-access.process-boundary` | Interface／Lifecycle Ownership | exact process identity | 開始・終了を実観測 | handleだけ、PID再利用、取消競合 | IT／ST | Direct Boundary | native resultとphase | handle／job 0 | Windows実境界 |
| `platform-access.docker-repair` | Failure-Recovery／Lifecycle Ownership | repair identityとruntime paths | Engine ready後だけ完了 | stale socket、再起動不明 | IT／ST | System/E2E | repair stateとengine probe | stale残存0または義務 | Docker Desktop実境界 |

導出キーは本領域内でQualityが同じ設計項目を反復参照するための局所参照であり、CRDD全体の安定コンテキストIDではない。

## 現行実装との照合

現行Sourceと既存試験は本詳細設計の正式入力ではない。本設計候補を固定した後、成立済み能力を失わないよう`Covered`、`Partial`、`Missing`、`Legacy`または`Implementation Detail`へ分類する。

担当責任者: Qual-Lab
最終更新日: 2026-09-07

## 1. 役割と非目標

`platform-access`は、TypeScriptだけでは確認できないWindowsの主体、保護、Filesystem実体を観測し、Docker Desktopの明示的な最終復旧でだけ限定したOS操作を行う内部部品である。AIの方針、外部送信許可、一般Taskの順序、Authorityおよび最終結果は[Coordinator Runtime](../coordinator/01_Architecture.md)が所有する。native応答の`candidate`だけから実行許可を発行しない。

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
    ├ Provider Home／Runtime Stateの観測
    ├ Runtime Stateの限定初期化
    └ Docker Desktop最終復旧helper
  → nonce・応答・終了・実体同一性を再確認
  → 診断／Task／Recovery結果
```

退役方式の比較基準として、署名manifest revision 5は固定相対Path、target、Rust toolchain、byte長、protocol revisionおよびSHA-256を閉じたRuntime実行Identityへ結合していた。現在の通常実行にはこの結合・署名資格・旧Manifest Readerを復元しない。過去の署名・Hash・Evidenceは歴史として保持する。CRDDのCommit／TreeとArtifact Hashは追跡・同一性確認であり、Publisher真正性や実行Authorityを発行しない。削除済みの`coordinator.exe`、native bootstrap feature、別Supervisor artifact fieldおよび旧manifest revisionへのfallbackはない。

## 3. 操作ごとの境界

### 内部ブロックとOS接続

```text
Coordinator／Docker Isolation（許可・耐久記録・全体結果の所有者）
  ↓ 用途固定の公開API
Platform Access TypeScript（要求構築・搬送・応答・終了の技術Owner）
  ↓ 固定binaryへの要求
Rust受付・dispatch [src/native/main.rs]（以下のRust Pathはsrc/native基準）
  ├→ Provider Home／Runtime State要求・応答 [protocol/access.rs]
  │     └→ 固定Provider Home／Runtime State観測・限定初期化 [filesystem/windows/protected_root.rs]
  │          ├→ 主体・Token観測 [process/windows/principal.rs]
  │          └→ 保護・実体観測 [filesystem/windows/protection.rs]
  │                                         ↓
  │                                      Windows API
  ├→ Host Namespace要求 [protocol/host_namespace.rs]
  │     └→ 固定親・初期化 [host_record/windows/host_namespace.rs]
  │          └→ 保護・実体観測 [host_record/windows/protected_file.rs]
  └→ Docker操作 [docker_desktop/windows/repair.rs]
        ├ 障害修復protocol
        ├ 検証付き再起動protocol（Source接続済み・実機未完了）
        │   └→ 公式停止CLI → 子Process・Job所有 [process/windows/owned_child.rs]
        ├→ artifact固定・Process観測 [docker_desktop/windows/identity.rs]
        ├ 限定停止・起動操作
        ├→ 発行元署名検証 [docker_desktop/windows/publisher.rs] → Windows署名検証API
        └→ Known Folder [filesystem/windows/windows_directory.rs]・選択ユーザー情報 [process/windows/principal.rs]
  ↓ 閉じた応答frameとProcess終了
Platform Access側で技術相関を確認 → 上位の許可・診断／回復判断
```

| 内部ブロック | Source群 | 所有範囲 |
|---|---|---|
| 受付・応答形式 | `src/native/main.rs`、`src/native/protocol/access.rs` | mode選択、要求形式、Provider Home／Runtime State応答の符号化と不正入力拒否 |
| Windowsフォルダ観測 | `src/native/filesystem/windows/windows_directory.rs` | System Directoryと固定Known FolderのOS API観測 |
| Windows主体観測 | `src/native/process/windows/principal.rs` | Token／SID／認証Sessionと主体分類のOS観測 |
| Windows保護・実体観測 | `src/native/filesystem/windows/protection.rs` | Handle・Descriptor所有、Directory Identity、固定入力のopen、ACL AccessCheckとhash resourceの解放 |
| 固定Provider Home／Runtime State観測 | `src/native/filesystem/windows/protected_root.rs` | Provider Home／Runtime Stateの固定親、構成、Runtime Stateだけの限定初期化と主体・保護Bindingを照合する。旧Store値は現行Protocolで拒否する |
| 保護付きFile操作 | `src/native/host_record/windows/protected_file.rs` | Namespaceに必要な同期handleのopen・close、実体・ACL照合とDescriptor構成 |
| Host Namespace観測 | `src/native/host_record/windows/host_namespace.rs` | 固定NamespaceのIdentity型、実体値照合、対象名・一時親Path判定、保持Directory chainの取得・検証・個別終了、期待値付き固定child初期化と専用公開要求 |
| Host保護の結合試験 | `tests/fixtures/windows_protection.rs` | `host_record::host_namespace::protection_tests`の試験専用子module。自己生成対象の共有拒否・別Process観測だけを所有し、一般UTから分離する。ignored試験は既定実行しない。正式Node入口がfresh runとCargo返却の一意なtest実行物を固定し、親と子は同じrun・実行物・期限を再確認する |
| Docker実体検証 | `src/native/docker_desktop/windows/identity.rs` | 固定artifactの署名・ハッシュ・同一実体とProcess Path・作成時刻・scope観測。停止・起動を所有しない |
| Docker操作 | `src/native/docker_desktop/windows/repair.rs` | 用途別protocol、mutex、検証済みartifactとProcessを使う限定停止・開始・再起動 |
| 発行元検証 | `src/docker-desktop/publisher.rs` | 開いたDocker artifactのWindows署名・発行元検証 |
| 停止CLIの子Process所有 | `src/process/owned_child.rs` | 停止前生成、Jobへの割当、実行、有限待機、取消と終了観測 |

Host保護試験の反復入口は`40_Develop/coordinator/scripts/verify-native-protection.ts`とする。Repository Rootから起動し、Buildは`40_Develop/platform-access/target/`を共有し、検証済みRoot直下の`.crdd/tests/native-protection-<UUID>/`へ一時対象・結果だけを保存する。任意Path、実行物またはcommandを引数で受け付けず、旧診断実行物のsuffixや先頭Fileから対象を選ばない。親Case一件、閉じたNative結果、両Workerの役割別終了、明示handle終了、Source／実行物不変とfixture不存在の全条件を共同評価する。中断・未知・失敗は成功へ畳まずrunを保持する。旧残存の回収、OS固定保存場所、署名Runtime、本番回復と他Native試験の成立は対象外である。

再起動protocolのSourceが存在することは、署名済み配布物への収載、耐久記録との接続または実機E2E完了を意味しない。操作許可、Directory退避、Task復旧、再起動完了の総合判定はこのbinaryへ移さず、Coordinator側に保持する。Linux／macOSの実装経路はない。

| 経路 | 実装上の所有者 | 条件・効果・限界 |
|---|---|---|
| Provider Home観測 | `filesystem/protected_root.rs`の`observe_provider_home` | Codex／Claudeの選択HomeをOS Known Folderから結合する。Credential本文は読まず、既存Homeを修復しない |
| Runtime State初期化 | `initialize_runtime_owned_directory_if_missing` | 明示されたRuntime Stateの最終Directoryだけを保護付きで作る。既存物を推測修復しない |
| Docker Desktop最終復旧 | `docker-desktop/repair.rs` | 固定Policy、artifact、mutex、対象Process確認、終了および固定Desktop起動を扱う。耐久記録、Directory rename、再開判断はTypeScript側が所有する |

RootやHomeの観測結果は、用途別Adapterが同じOperationのRepository、選択ユーザー、署名済み配布物およびRecovery状態と再結合して初めて利用できる。別Operationへ持ち回らない。

### 固定保存境界の私有観測

Namespaceの親・固定二childの実体と保護確認だけを維持する。専用Host対象・終端記録のCurrent／Known観測、保存、読戻しとcaller Leaseは本番未接続のため退役した。旧形式の互換Reader、代替保存、過去保持物の移行・削除は提供しない。

### 共有管理フォルダの保護付き作成と限定移行

通常作成と既存権限の移行は別の処理である。通常作成は、明示不存在の場合だけ現在利用者とSYSTEMの非継承full-control二ACE、現在利用者owner、protected DACLを作成時に指定する。競合による既存化も、同じ保持chainから実体・型・fresh ACLを再確認する。既存不適合を修復せず停止し、失敗時に共有フォルダをrollbackで削除しない。

| 処理 | 対象と処置 | 停止条件 |
|---|---|---|
| 通常producerの共有作成 | 検証済み一時親の固定child `crdd-coordinator-recovery-v1`だけ。作成済み共有物は検証だけ行う。 | 存在不明、file／reparse、owner・保護不一致、実体差または取得・close不明。 |
| 終端保存先の初期化 | 保護確認済み共有フォルダの固定child `terminal-v1`だけ。通常Taskから暗黙作成しない。 | 共有フォルダの保護不適合、作成・再取得・fresh ACLまたはclose不明。 |
| 既存共有ACLの限定移行 | 独立保持した親・共有実体・利用者・変更前ACLに結合した明示操作。通常作成・観測・保存から呼ばない。 | 人間の実操作許可、全producerの開始抑止・終了、既存childへの影響と旧exact回復の維持を確認できない場合はEffect 0で停止。 |

発火例は固定childの明示不存在、非発火例は適合済み共有物の再利用、境界例は作成競合と既存不適合、情報不足例は存在・close・現在使用の不明である。通常作成は、新しい共有排他の存在だけで全producer停止を主張しない。限定移行はACL更新APIの継承波及を事前に確認し、childのIdentity・bytes・保護と旧回復の利用能力を変更前後で比較する。確認できない場合は移行を開始しない。部分Effectを保持し、自動rollback・再実行しない。

2026-10-04の承認は設計・実装・自己生成fixture試験の追加だけであり、実共有Directoryの作成・権限変更・Process停止・旧三件削除ではない。Native私有部品の試験から、通常producer、署名済み搬送、限定移行または公開Recovery全体の成立を推定しない。

私有の`open_bootstrap_parent`と`create_host_namespace_child`をSource上に実装し、自己生成fixtureで保護付き作成、無変更再利用、不適合ACL・同名fileの拒否、全取得guardの明示closeと自作r2の直接不存在を確認した。通常の`open_observed`は最終保護とnamespace検査を維持する。作成前guardをそのまま記録保存へ渡さず、通常の三実体・二ACL・利用者の検査へ再結合する。通常producer・専用Protocol・署名搬送のSourceを接続し、専用r3でNative本体と固定frameの局所確認を追加した。署名付き実OS初期化・既存ACL移行・作成競合・OS API／close故障の実測は残る。[観測範囲](../../../99_Roadmap/Changes/CHG-000082/Evidence/261002_host-orphan-recovery-design.md#通常作成入口と専用搬送の接続--2026-10-04)を参照する。

保護付き初期化の搬送は、親の読取り確認 `--host-recovery-namespace-observe` と、独立期待値付き作成 `--host-recovery-namespace-initialize` を分離する。候補要求はそれぞれ `CRDDNC01`（42bytes）と `CRDDNI01`（98bytes）、応答は `CRDDNR01`、revision 1とする。作成要求は親の六識別値と選択利用者Hashを必須とし、読取り要求には作成を指示するfieldを設けない。自由Path、SID、ACL mask、移行指定は受理しない。

応答は親・共有管理先・終端保存先の部分実体、二つの固定childそれぞれの作成発行・作成結果・handle取得・初回close、Tokenと祖先handleの個別closeを保持する。作成結果不明は未発行へ戻さず、終了不明では元理由を別に保持する。正常な初期化は三実体・現在利用者・二保護・全終了が共同成立した場合だけ返す。搬送失敗または応答相関不成立では、発行した初期化のEffectを不明として停止し、共有Directoryを自動削除しない。通常の記録保存入口は既存の三実体・二保護検証を引き続き必要とする。

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

Root／Homeは`protocol/access.rs`、Namespaceは`protocol/host_namespace.rs`、Docker環境操作は既存のDocker実装が正本である。

| protocol | 識別と長さ | 確認事項 |
|---|---|---|
| 不正要求 | 既存`CRDDPR03`の固定拒否応答86 bytes | 旧`CRDDPA03`Root要求とAppContainer受付は退役。Provider Home以外の標準入力を観測へ配送しない |
| Provider Home／Runtime State | revision 3、`CRDDPH02`／`CRDDHO02`、要求76・応答182 bytes | provider、nonce、主体・保護・安定Identity。初期化flagはRuntime Stateだけ。旧Store値は拒否する |
| Docker障害修復 | `CRDDDR05`、応答41 bytes | 現行公式成果物の署名・同一操作Identityを固定し、公式停止と残存Process終了を分離して返す |
| 検証付き再起動 | `CRDDDS01`、応答41 bytes | 現行公式成果物の署名・同一操作Identityを固定する別mode。`S`だけが公式停止を許可し、`N`未発行／`T`exit 0と子回収確認／`P`発行後不明を返す |
| Namespace | `--host-recovery-namespace-observe`／`--host-recovery-namespace-initialize`と既存CRDDNR01応答 | 親・固定childの実体、部分作成、保護と個別終了。専用記録の保存・読戻しは提供しない |

部分応答・nonce不一致・異常終了を成功へ補完せず、raw出力や秘密を公開しない。

## 5. 状態・資源・回復

観測は、要求検証、固定対象のopen、主体・保護・実体の観測、前後一致、応答の順で行う。Directory、token、security descriptor、Known Folderおよびhash handleは所有箇所で解放する。初期化後の失敗を「Effectなし」へ補正しない。

Docker復旧helperは固定mutexとartifact handleを保持し、検証済み対象だけを終了・再起動する。TypeScript側は子Processとstdioの終了を待ち、観測不能なら`cleanup_unknown`へ閉じる。helperの終了だけでDocker Engine復旧や退避Directory削除を宣言しない。

故障購読の`onFailureDetected`はlistenerを同期に発行し、解除関数を同期に返す登録操作である。通常発行・故障後の即時登録・取得結果不明の即時登録で、同期例外と誤って返されたPromiseの拒否を直接捕捉する。通知完了は待たず、故障の単調性、他listenerの同期順序、購読解除、元の終了・失効・cleanup結果を変えない。Promiseを処置完了や保存ACKへ昇格せず、独自の未完了一覧・再通知・待機期限を追加しない。

検証付き再起動の停止は、同一handleで署名・実体を固定した`resources/cli-plugins/docker-desktop.exe`へ`desktop stop --timeout 30`を渡す。`force`、`detach`および旧修復の`K`へのfallbackはない。旧修復protocolの`K`は変更しない。

### ブロック状態遷移

| 現在状態 | 契機／事前条件 | 処理と観測 | 次状態 | 終了後条件 |
|---|---|---|---|---|
| 要求待ち | 完全frameとmode | length、nonce、role、Path候補を検証 | 観測準備／拒否 | 拒否時はOS Effect 0 |
| 観測準備 | 固定対象をopen | 主体、ACL、実体、署名、前後Identityを確認 | 観測済み／不明 | 全handleを所有集合へ保持 |
| 観測済み | 観測mode | 閉じた応答を生成 | 応答後終了 | Path／Credential／raw error非公開 |
| Effect準備 | 操作modeと検証済みAuthority | mutex／Job／子Processを取得しintent後にEffect | Effect観測中／失敗 | 未割当子Processを実行しない |
| Effect観測中 | 完了、timeout、取消 | 子Process、Job、stdio、対象状態を再観測 | 応答後終了／不明 | `T`だけでDocker全体成立を主張しない |
| 不明 | helperまたはcleanup観測不能 | 正常応答を禁止して異常終了 | 呼出側Recovery | 呼出側がexact Operationと資源義務を保持 |

通常の観測・Docker helper自身は耐久Recovery recordを所有しない。通常HostRecoveryのNode保存と意味判断は既存Coordinatorに残る。helper終了を全体cleanupへ昇格しない。

| 子Process境界 | 保証・不明時の処置 |
|---|---|
| 起動 | `CREATE_SUSPENDED`で生成し、kill-on-close Jobへ割り当ててから再開する |
| 入出力 | 明示したNUL handleだけを継承する。CLI出力を応答protocolへ混入させない |
| 待機 | 外側35秒の有限待機。stdin EOF・予期しない追加入力・観測不能を取消として扱う |
| 回収 | 同一子handle終了とJob内Process不存在を確認。回収不明なら`P`後にhelperを異常終了し、後続の正常終了応答を禁止する |
| 全体成立 | `T`だけではDocker停止成立を主張しない。Docker Isolationが管理Process、CLI、WSLとEngineを再観測し、Coordinatorは同じTaskへの保存・結果受領を所有する |

## 6. 呼出し元との分担

| native側 | Coordinator側 |
|---|---|
| OS実体・主体・保護の観測 | Task、Provider、Repository、Revisionとの結合 |
| nonce、固定flag、Hash | 一回限りCapabilityの発行・消費・失効 |
| 限定初期化・Process操作 | 操作許可、耐久intent、停止、回復、結果公開 |
| native handleと子Processの後条件 | Docker、Mount、Host、候補をまたぐ全体cleanup |

正常OSと認証済みローカルユーザーを最小信頼境界に含める。Administrator、kernelまたはOS検証器を支配した攻撃者への完全耐性は主張しない。

## 7. 検証への接続

| 対象 | 確認先 |
|---|---|
| 要求・応答とCLI | [Rust CLI試験](../../../40_Develop/platform-access/tests/integration/native_cli.rs)、protocol内試験。旧PR03専用TS試験は未接続候補の撤去とともに退役し、現行Protocolの同値保証には使わない。契約説明の確認だけ[Root観測試験](../../../40_Develop/coordinator/tests/unit/execution/root-observation.contract.test.ts)へ移管する |
| 成果物同一性 | [成果物同一性試験](../../../40_Develop/platform-access/tests/integration/artifact-identity-observation.contract.test.ts)。固定Artifact／Bootstrapと実Filesystemの相関を確認する。Coordinator専用Trust Core／Release Identity試験は専用方式とともに退役し、この試験を配布元真正性・旧配布閉包保証の代替にしない |
| Provider Home／Runtime State | `filesystem/windows/protected_root.rs`／`protection.rs`内の共有Hash・SID試験、[Home／Runtime State観測試験](../../../40_Develop/platform-access/tests/unit/filesystem/protection.contract.test.ts)、[Runtime State Adapter試験](../../../40_Develop/coordinator/tests/unit/execution/protected-root.contract.test.ts) |
| Docker復旧 | docker-desktop/repair.rs内試験、[DI Machine・技術接続試験](../../../40_Develop/docker-isolation/tests/integration/repair-runtime.contract.test.ts)、[Coordinatorの現在Writer・履歴・保持／終了接続試験](../../../40_Develop/coordinator/tests/integration/runtime-repair-owner.contract.test.ts) |

単体試験の合格から、実Native・Docker Desktop復旧、配布元真正性または終了後資源0を推定しない。本番同等入口のE2Eと回復行列を別に実測する。退役した署名方式の実行を現在の通常完成条件へ戻さない。

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
