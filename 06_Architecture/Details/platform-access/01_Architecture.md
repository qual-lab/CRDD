# Windowsネイティブ部品の設計

成果物種別: Architecture詳細設計
詳細設計領域: platform-access
状態: Canonical

## 基本設計との関係

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000004](../../Definitions/ARCH-000004/architecture_definition.md) | Process／Job／Containerの開始、取消、終了とcleanupをExecution Adapterへ提供する。 | Partial |
| [ARCH-000008](../../Definitions/ARCH-000008/architecture_definition.md) | OS、Process API、Dockerの要求・受理・Effect・観測を分けた診断結果を返す。 | Covered |
| [ARCH-000011](../../Definitions/ARCH-000011/architecture_definition.md) | OS管理Runtime path、native resource、stale socketと修復記録のlifecycleを実装する。 | Partial |

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
| 更新 | Native成果物と初期取得用Hashを同じ候補で更新し、実結合試験後に正式署名する |

署名前検査からも利用するため、通常Runtimeの署名検証を逆参照する循環は作らない。固定Hashは初期取得部品の同一性だけを担い、Publisher Trustや実行許可の代替にはしない。

[Rust crate](../../../40_Develop/platform-access/Cargo.toml)から、固定成果物`crdd-platform-access.exe`を一つだけ生成する。v0.21の目標Pathは`40_Develop/platform-access/artifacts/windows-x64/`とし、`template/tools`へNative実行物を置かない。現行Pathからの移行は[CHG-000076](../../../99_Roadmap/Changes/CHG-000076/change.md)でManifest、署名、Promotion、RecoveryおよびE2EのConsumer Closureと同時に閉じる。

crateは`rust-toolchain.toml`、`Cargo.toml`および`Cargo.lock`でtoolchain、target、依存および版を固定する。通常Runtimeから`cargo run`、PATH上のCargo／Rust binaryまたは開発用`target/`成果物を起動しない。Release成果物は固定相対Path、target、protocol revision、Rust toolchain、byte長およびSHA-256を署名済みmanifestへ含める。言語・Buildの共通規則は[内部ツール・コーディング規約](../../99_Coding_Standards.md)、反復手順は[Coordinator RuntimeのWorkflow](../../../19_Workflows/01_Coordinator_Runtime.md)を参照する。

```text
Coordinatorの用途別Adapter
  → 署名manifest・配布Tree・成果物Hashを検証
  → 固定Pathのcrdd-platform-access.exe
    ├ Provider Home／Runtime Stateの観測
    ├ Candidate Store／Runtime Stateの限定初期化
    └ Docker Desktop最終復旧helper
  → nonce・応答・終了・実体同一性を再確認
  → 診断／Task／Recovery結果
```

署名manifest revision 5は、この成果物の固定相対Path、target、Rust toolchain、byte長、protocol revisionおよびSHA-256を、閉じたRuntime依存集合とSecurity Policyから算出するRuntime実行Identityへ結合する。CRDDのCommit／TreeはReleaseの出所を示すが、Runtime Authorityの同一性判定を兼ねない。削除済みの`coordinator.exe`、native bootstrap feature、別Supervisor artifact fieldおよび旧manifest revisionへのfallbackはない。

## 3. 操作ごとの境界

### 内部ブロックとOS接続

```text
Coordinatorの用途別Adapter（許可・耐久記録・全体結果の所有者）
  ↓ 固定binaryへの要求
受付・dispatch [main.rs]
  ├→ Root／Home／Store／State要求・応答 [protocol.rs]
  │     └→ 主体・保護・実体観測／限定初期化 [windows.rs]
  │                                         ↓
  │                                      Windows API
  └→ Docker操作 [docker_repair.rs]
        ├ 障害修復protocol
        ├ 検証付き再起動protocol（Source接続済み・実機未完了）
        │   └→ 公式停止CLI → 子Process・Job所有 [windows_owned_child.rs]
        ├ artifact固定・Process観測／限定操作
        ├→ 発行元署名検証 [docker_authenticode.rs] → Windows署名検証API
        └→ Known Folder・選択ユーザー情報 [windows.rs]
  ↓ 閉じた応答frameとProcess終了
Coordinator側で再検証 → 診断／回復結果
```

| 内部ブロック | Source群 | 所有範囲 |
|---|---|---|
| 受付・応答形式 | `src/main.rs`、`src/protocol.rs` | mode選択、要求形式、Root／Home系応答の符号化 |
| Windows観測 | `src/windows.rs` | OS主体、ACL、Known Folder、Filesystem実体と限定初期化 |
| Host保護の結合試験 | `tests/fixtures/windows_protection.rs` | `windows::protection_tests`の試験専用子module。自己生成対象の共有拒否・別Process観測だけを所有し、一般UTから分離する。ignored試験は既定実行しない。正式Node入口がfresh runとCargo返却の一意なtest実行物を固定し、親と子は同じrun・実行物・期限を再確認する |
| Docker操作 | `src/docker_repair.rs` | 用途別protocol、mutex、固定artifact、Process確認・限定操作 |
| 発行元検証 | `src/docker_authenticode.rs` | 開いたDocker artifactのWindows署名・発行元検証 |
| 停止CLIの子Process所有 | `src/windows_owned_child.rs` | 停止前生成、Jobへの割当、実行、有限待機、取消と終了観測 |

Host保護試験の反復入口は`40_Develop/coordinator/scripts/verify-native-protection.ts`とする。Repository Rootから起動し、Buildは`40_Develop/platform-access/target/`を共有し、検証済みRoot直下の`.crdd/tests/native-protection-<UUID>/`へ一時対象・結果だけを保存する。任意Path、実行物またはcommandを引数で受け付けず、旧診断実行物のsuffixや先頭Fileから対象を選ばない。親Case一件、閉じたNative結果、両Workerの役割別終了、明示handle終了、Source／実行物不変とfixture不存在の全条件を共同評価する。中断・未知・失敗は成功へ畳まずrunを保持する。旧残存の回収、OS固定保存場所、署名Runtime、本番回復と他Native試験の成立は対象外である。

再起動protocolのSourceが存在することは、署名済み配布物への収載、耐久記録との接続または実機E2E完了を意味しない。操作許可、Directory退避、Task復旧、再起動完了の総合判定はこのbinaryへ移さず、Coordinator側に保持する。Linux／macOSの実装経路はない。

| 経路 | 実装上の所有者 | 条件・効果・限界 |
|---|---|---|
| Provider Home観測 | `windows.rs`の`observe_provider_home` | Codex／Claudeの選択HomeをOS Known Folderから結合する。Credential本文は読まず、既存Homeを修復しない |
| Store／State初期化 | `initialize_runtime_owned_directory_if_missing` | 明示されたRuntime-owned directoryの最終Directoryだけを保護付きで作る。既存物を推測修復しない |
| Docker Desktop最終復旧 | `docker_repair.rs` | 固定Policy、artifact、mutex、対象Process確認、終了および固定Desktop起動を扱う。耐久記録、Directory rename、再開判断はTypeScript側が所有する |

RootやHomeの観測結果は、用途別Adapterが同じOperationのRepository、選択ユーザー、署名済み配布物およびRecovery状態と再結合して初めて利用できる。別Operationへ持ち回らない。

### 固定保存境界の私有観測

自己生成namespace試験の反復Ownerは`40_Develop/coordinator/scripts/verify-native-terminal-namespace.ts`、残る終端fixtureの反復Ownerは`verify-native-terminal-fixtures.ts`である。固定Root・旧実行物名への依存を持たず、今回Cargoのtest実行物と検証済み`.crdd/tests/native-terminal-<UUID>/`を結合する。Native側もRepository、run名、直接child、非reparse祖先と実行物位置を確認する。namespaceの19拒否、対象の164拒否、保存・容量・現在候補・cold・rename・公開・disposition・既知fileの個別Oracleとcloseを保持する。Node／Nativeの排他互換は現在NodeのHashと検証workerへ結合する。結果保存と清掃の許可は試験の成功判定から独立して再評価し、失敗・中断・観測不能は保持する。歴史専用の旧Root読戻し・変更拒否診断は現在候補・cold・rename・公開の自己生成試験へ能力を対応付け、当時の失敗はGit履歴で保持する。実残存を改変して過去の正常成立を主張しない。実行手順は[Coordinator Workflow](../../../19_Workflows/01_Coordinator_Runtime.md)を参照する。

**固定二childの実体と保護を読む部品であり、保存先の初期化や公開Recoveryではない。** 自己生成fixtureに加え、専用の確認入口とCoordinatorの用途限定AdapterをSource上で接続する。保護付き現在値の初回取得も実装したが、署名Runtimeへの有効化、回復Ownerからの実呼出しと記録保存は未接続である。

| 観点 | 私有部品の処置 | 不明時の処置 |
|---|---|---|
| 所在候補 | `GetTempPathW`のbounded返却から`crdd-coordinator-recovery-v1/terminal-v1`だけを解決する。 | 0、不足長、非終端、不正UTF-16、UNC／相対／特殊成分では停止する。fallback・mkdir・修復0。 |
| 独立した結合 | parent／recovery／terminalの五field・属性を保持handleから独立期待値へ照合する。三fieldの実体キーで相異を確認する。 | 現在値を期待値へ付け替えず、同実体、差替え、file／reparse・欠落を拒否する。 |
| 利用者と保護 | 同じ取得TokenでSID、既存required／forbidden flagsと利用者Hashを観測し、独立Hashを照合してTokenを明示closeする。recoveryとterminalのprotected二ACEは同じ保持handleで確認する。 | 利用者・ACL・観測不明では保存もRoot／marker処置も開始しない。Hashや環境PathをAuthorityにしない。 |
| 保持後 | `verify`でも三実体・二ACLをfreshに照合する。 | 後続の不一致を最初のopen成功で正常化しない。 |
| 失敗と終了 | 部分openの元理由、取得Token数／Directory数と各初回closeを共同保持する。全chainを逆順に閉じる。close不明はProcessの追加保存停止へ結ぶ。 | 元原因をclose失敗で消さず、Dropや空配列だけから全Process資源不存在を主張しない。 |

[GetTempPathWの仕様](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-gettemppathw)は、環境変数等から所在を返すだけで存在・アクセス権を確認しない。候補Pathはこの仕様に従い独立実体・保護へ再結合する。現私有入口は既存の一般利用者Token条件を維持しSYSTEM／serviceを受理しないため、SYSTEM専用所在への拡張は行わない。APIや環境設定を信頼済み保存先の宣言へ読み替えない。

**未観測／未接続:** 二位置のACL故障、位置別file／reparse、実OS API／close故障、後続verifyの故障刺激、namespace初期化、回復Ownerからの実呼出し、署名配布物・実OS親、旧三Rootと実RecoveryはOPEN。初回観測は自己生成fixtureで確認したが、Sourceの確認入口とfixtureの正常観測・拒否は、この母集団全体の合格ではない。

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

固定保存境界のguardから、parent直下のRoot、recovery直下のmarker、Root直下の固定六childを同期的に読む。namespace三実体と合わせ11実体の現在観測を作るが、原子的snapshot、空領域、未知child不存在、非使用、承認または清掃可能性の証明にはしない。専用Protocol、初回現在値の取得と用途限定AdapterはSource接続として扱い、初期化、回復Ownerの呼出しと実残存処置は別の未接続条件とする。

2026-10-04に設計対象へ追加した既知7バイトfileの条件は[Coordinatorの限定対象](../coordinator/01_Architecture.md#既知の7バイト試験ファイルを含む対象)が所有する。現行の十一実体Protocolはそのfileを観測・保存・処置していない。後段では十二実体の区別、同handleの通常file・非reparse・リンク数1・サイズ・全bytes／EOF、write／delete競合の拒否、個別closeおよび部分処置を搬送する必要がある。既存Protocolへのfileの暗黙追加、現在値からの独立期待値捏造、空クラスの成功からの新クラス成立は認めない。これは未接続設計であり、Nativeの実停止・削除許可ではない。

既知fileの私有読取りは、親workspaceと全祖先を保持・検証したOwnerから同期handleを借用する。`observe_terminal_known_file`はopen・close・削除を所有せず、同handleのdisk種別・五識別値と属性・リンク数1・実長7・二回の全bytes／EOF・固定Hash・前後一致を確認する。借用元は固定名・shareREAD、取得失敗と取得後の元失敗、初回close・親guard終了を保持する。専用十二実体Snapshotと観測ProtocolをSource上で接続し、自己生成対象で局所確認する。現行十一実体Protocolへfileを追加せず、保存・最終清掃への継続保持・公開Recoveryは未接続である。互換readerが残る場合の読取り成功を非使用証明にしない。

十二実体の専用観測は候補Protocol `CRDDKC03`（Current）、`CRDDKT03`（namespace-Known）、`CRDDKR03`（応答）をrevision 3で用いる。Current要求は44bytes、namespace-Known要求は148bytesのheaderと固定名だけである。namespace-Knownの独立期待値は三namespace実体と選択利用者だけであり、十二対象全体のKnown再照合ではない。要求contextと呼出し側もこの差を保持する。

保存前の十二対象Known照合は、同じ九対象handleを保持する私有観測Ownerで行う。独立期待値の十二Identity、選択利用者、marker Hash、file長・リンク数・Hashを全て比較してから対象handleを終了する。fileだけの期待値一致やnamespace-Known成功を全体Knownへ読み替えない。この私有Gateを実装・反証してから専用保存入口へ接続する。読戻しでは対象取得を意図して行わず、対象Root／file消失後も同参照の現在記録を照合できるようにする。これは保存・読戻し接続の着手前条件であり、現行の保存成功を新クラスの成功へ変更するものではない。

十二実体用の保存・読戻しは、専用mode `--host-terminal-known-file-save`／`--host-terminal-known-file-read`へ分離する。候補要求は`CRDDKS03`／`CRDDKL03`、候補応答は`CRDDKW03`／`CRDDKB03`としてrevision 3を固定する。要求headerは471bytesで、nonce・三名の長さ・本文長の47bytes、十二Identityの288bytes、利用者／marker Hashの各32bytes、file長／リンク数の各4bytes、file Hash／本文Hashの各32bytesを保持する。参照50bytes、UUIDv4 Root名60bytes、marker名74bytes、本文1〜8192bytesを続け、上限は8847bytesとする。UUIDとmarkerの対応・本文SchemaはCoordinatorが確認し、Nativeはopaque本文を解釈しない。

保存応答の52bytes headerと52bytes部分receipt、読戻し応答の55bytes headerと現在記録Identity／個別終了は旧契約と同じ意味を維持するが、内包する観測応答は専用`CRDDKR03`だけとする。保存は九対象handle・全十二Known照合、読戻しは対象未試行の取得0を保持し、応答上限2048bytesを維持する。共通の容量・非置換writer・現在readerを利用しても、新旧Schemaやfile情報を縮約・混用しない。Source接続、正常な実搬送、caller耐久記録、署名Runtime、最終清掃と公開Recoveryはそれぞれ別の成立条件として確認する。

応答は53bytesの共通header、理由と個別close列、成功時だけ392bytesのpayloadを持つ。payloadは十二位置の六u32（288bytes）、利用者Hash（32bytes）、marker Hash（32bytes）、file長（4bytes）、リンク数（4bytes）、file Hash（32bytes）を省略せず搬送する。位置0〜10は旧順、位置11は`workspace/fixture.txt`である。取得対象九handle、十二実体相異、file長7・リンク数1・固定Hash、全個別closeと外側guard終了が共同成立した場合だけ成功payloadを返す。既存最大1024bytesは維持する。

旧観測入口は八handle・位置0〜10・file無しのrevision 2契約を維持し、新旧magic、revisionおよびpayloadの混用を拒否する。共通frame検査は内部の閉じた二クラスだけに限定し、十二実体型から旧十一実体型への暗黙変換を作らない。Current／namespace-Known成功は原子的snapshot、他entry不存在、非使用、清掃Authorityまたは保存成功ではない。十二実体の保存・読戻し・部分再入場と最終清掃への伝播は別の未成立条件である。

| 観点 | 読取りの契約 | 不成立時 |
|---|---|---|
| 名前・位置 | Rootは`crdd-coordinator-doctor-`＋1〜96文字のASCII英数字・`_`・`-`、markerは`host-<小文字64桁Hash>.json`、六childは`workspace`、`provider-home`、`tmp`、`events`、`projection`、`management`の固定順。保持namespaceからのみPathを導出する。 | 新八handle取得前に拒否する。名前やHashから旧Token・Rootとの意味的対応を復元しない。 |
| 全実体 | 十一位置の五field・属性と、volume／file-index三fieldの相異を確認する。全取得後も保持handleを再照合し、namespace三実体・二ACLを再verifyする。 | 欠落、file／reparse、差替え、重複または不明で完全snapshotを返さない。部分初期化をゼロ補完しない。 |
| marker元bytes | 独立した私有受付上限は64KiB。1〜65536bytesを同handleから完全読取り・EOF・前後長／Identityへ照合し、末尾LFを含む元bytesをHash化する。intentの8KiBや正規JSON形式とは別である。 | 空、超過、サイズ不明、部分readまたは不一致を保持停止とする。本文を診断へ出さない。全legacy互換は本番接続前の別Gateであり、現旧loaderの無制限readを保証へ流用しない。 |
| 現在観測と再照合 | Currentは今回の値、Knownはcallerが独立保持した名前・全十一実体／属性・利用者・marker Hashとの再照合。 | Current自身の値を独立期待値へ付け替えない。属性を持たない既存intent codecへの変換は未接続であり、Schemaを拡張しない。 |
| 終了 | 新八handleを一意Ownerが逆順に全closeし、取得数、失敗位置、元理由と各初回closeを共同保持する。八件の終了確認後だけsnapshotを返す。 | close不明は追加保存停止。外側namespaceのToken／全chain／Process終端は別Ownerの義務であり、本snapshot成功から全資源不存在を主張しない。 |

既存marker producerは固定Schema、Root Identity、六childの十進文字列Identityと日時をJSON＋LFで保持するが、文字列長／全byte上限の正式契約は持たない。64KiBはこの読取り入口のboundedな受付値であり、Rootの意味的所有や`host_only`、六childとの対応を認定する値ではない。これらはCoordinatorの既存記録Ownerによる別の照合へ接続する必要がある。

### Host終端記録の内部保存部品

Host終端記録のSchema、参照、容量、Authority、再入場と清掃は[Coordinatorの候補契約](../coordinator/01_Architecture.md#終端記録の保存再入場の候補契約)が所有する。Nativeは検証済み非秘密bytesのOS保存・保護・非置換公開と現在記録の読取りを具体化する。`windows_terminal.rs`の私有部品を、専用dispatchとCoordinatorの用途限定AdapterへSource上で接続した。署名Runtimeへの有効化、正常な実搬送、実Recoveryと清掃の公開入口は未成立であり、任意Path受付や削除コマンドを公開しない。

| 保存段階 | Nativeの責務 | 不明・失敗時の処置 |
|---|---|---|
| 親の保持 | local fixed driveの全祖先を非reparseの同期handleで保持し、最終Directoryの五field Identity、現在利用者ownerとprotected二ACEを照合する。 | 相対Path、UNC、reparse、保護・実体・close不明は停止する。固定OS保存境界への接続はCoordinator／Native Adapterの後続条件であり、内部guardだけから許可範囲を作らない。 |
| stage作成 | 参照から単純leafを決定し、1〜8192bytesの受付判定後、CREATE_NEWと明示DACLで作成する。同期READ／WRITE／DELETE handleをshareREADで一意保持する。 | 作成後失敗は同じ参照と作成済みreceiptを保持し、stageを自動削除しない。DELETE accessは内部renameの前提だけで、公開削除Authorityではない。 |
| 内容の保存 | 部分writeと進捗0を処置し、同じhandleへ完全write、file flush、長さ・全bytes・EOF照合を行う。 | write／flush発行済みを未発行へ戻さず、未確認のまま公開やRoot処置へ進まない。file flushをDirectory耐久化・電源断保証にしない。 |
| 非置換公開 | 同じwriter handleへ`NtSetInformationFile`の`FileRenameInformation=10`、`ReplaceIfExists=false`を使用する。`RootDirectory=NULL`と同Directoryの単純leafだけを渡し、Ex／Bypass／POSIX／置換は使わない。 | 要求発行と最終NTSTATUSを別に保持し、Win32 last errorと混同しない。予期しないPendingではbuffer・IO_STATUS・handleを実終端まで保持する。待機不能では異常終了して成功を返さない。硬いOS-I/O期限は主張しない。 |
| 公開の照合 | 元writerを唯一の保護Ownerとして保持中、stageの直接不存在と公開名readerによる五field Identity・属性・ACL・全bytesを照合する。readerはshareREAD／WRITE／DELETEを指定してwriterへ互換とし、照合後に個別closeする。 | rename要求・実返却・stage不存在・public相関・reader closeを別receiptへ残す。不一致／不明では再rename、復元、別参照、清掃とRoot／marker処置0。不在は観測時点の事実であり、後続のstage新規作成を禁止した保証ではない。 |
| 終了 | 唯一のwriterの明示closeと、既知のreader close結果を保持する。どちらか不明なら総合終了を成功にしない。 | Drop、close通知、空slotを全終了成功へ昇格しない。stage不存在はrenameの別観測であり、closeによる削除にしない。失敗後の記録を自動削除しない。 |

同Directoryの名前解決と非置換指定は[MicrosoftのFILE_RENAME_INFORMATION契約](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/ntifs/ns-ntifs-_file_rename_information)、処理は[NtSetInformationFile契約](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/ntifs/nf-ntifs-ntsetinformationfile)、flushは[FlushFileBuffers契約](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-flushfilebuffers)へ照合する。SDKのclass10、offset・alignmentとstruct全体＋UTF-16 leafを含むzero初期化storageを使用する。

旧hardlink方式の追加公開名に対するDELETE access取得と、その追加guardによるr3是正は[変更履歴](../../../99_Roadmap/Changes/CHG-000082/Evidence/261002_host-orphan-recovery-design.md)へ保持する。旧二名cold caseを新rename方式へ自動移行・清掃せず、方式／producer版との整合を未成立として残す。新方式のpublish本体を通す局所検証・独立確認も旧結果とは別に行う。

#### 記録保存の共通排他

保存を行う一つのNative threadが、容量確認からstage作成・公開照合・writer終了までを同期区間として所有する。排他だけを容量適合、非使用または削除Authorityの証明にしない。

| 観点 | 固定する方式 | 拒否・終了条件 |
|---|---|---|
| 同じ保存先の識別 | `Global` Mutex名を、用途domain、OS取得の利用者SIDと、保持Directoryのvolume／file-index三fieldから決定する。日時と属性は名前に含めず、五fieldと属性は別途照合する。 | 名前の自由入力、sessionごとの分断、日時変更による別排他への逃避を許可しない。全親chainは取得前から終了まで保持する。 |
| 作成と観測 | 初期所有指定なしの`CreateMutexExW`。作成descriptorはowner＝利用者、protected・利用者／SYSTEMの二ACE・`MUTEX_ALL_ACCESS`。要求accessは`READ_CONTROL | SYNCHRONIZE | MUTEX_MODIFY_STATE`。 | 既存objectでも同handleから`SE_KERNEL_OBJECT`としてowner／DACLを再観測する。Fileの`FILE_ALL_ACCESS`を流用しない。不一致・別object・観測不能では保存0。 |
| 取得 | 同じthreadで最大2秒の一回wait。`WAIT_OBJECT_0`だけが親実体・保護の再照合へ進む。最後にProcessの終端不明を再検査するAtomic読取りを、同期処置の許可判定点とする。 | 判定前に終端不明なら保存0で、取得済みの所有をrelease／closeする。判定後の不明を、既許可処置の取消へ読み替えない。timeout／failed／不明は保存0。`WAIT_ABANDONED`も所有取得と保存拒否を区別する。2秒をFilesystem処理全体の期限にしない。 |
| 終了 | 同じthreadでreleaseを一回要求し、自己handleのcloseを別に確認する。通常失敗でも両段を試し、初回結果を保持する。unwindでは終了を試して元panicを再送する。 | release／close不明は後続closeやDropで成功化せず、当該Processの追加保存を停止する。Process喪失・abortは明示終了成功ではない。Global object不存在は主張しない。 |

取得／処置の固定失敗理由は、支配する終端不明理由と別fieldへ保持する。処置Errとrelease／close不明が同時に発生しても片方を消さない。これは内部の排他部品の契約である。全producerの容量計数・予約・公開への接続、固定namespaceと公開Adapterは未成立である。別Process競合・所有者喪失・保護不一致、同名別object、失敗保持を自己生成fixtureで反証してから接続する。実残存の処置は対象外である。

#### 同じ排他区間での容量計数と保存

私有保存Ownerは、列挙・容量判定からstage作成・公開照合・writer明示終了までを同じMutex内へ結ぶ。writerを結果や捕捉変数へ移出せず、結果には同じ参照と計数／記録／排他のreceiptだけを返す。自己生成領域での同Process保存・競合・拒否・再計数を局所確認したが、公開consumer未接続の候補である。静的確認やこの局所観測を全producerの成立にしない。

| 計数・保存の段階 | 処置 | 不明・失敗時 |
|---|---|---|
| 物理名の列挙 | `FindFirstFileW`の初回空集合と`FindNextFileW`の`ERROR_NO_MORE_FILES`を他errorから区別する。`.`／`..`以外はcanonicalな参照のstage/jsonだけ。同一leaf重複を拒否し、最大1024＋1名で停止する。 | 未知名、途中errorと観測不能を空集合へ畳まない。専用の`FindClose`初回結果を保持する。 |
| 同handleの計数 | 各fileを読取り・固定共有で開き、freshなnonreparse実体・保護・サイズを確認して明示closeする。stage0byteは一entry・bytes0。異なる二名が同実体でも二entryと数える。 | Directory、公開0byte、過大file、保護・共有・サイズ・close不明は新stage作成0。列挙時metadataを最終値にしない。 |
| 予約 | 完全列挙・全観測終了後、一文書1..8192byte、新規物理名＋1、総1024entry／8MiB以内をchecked加算で確認する。同参照の既存名は作成前に拒否する。 | 超過・overflowから削除、別参照または上限迂回を発行しない。Native renameの＋1をcaller hardlinkの＋2へ流用しない。 |
| 保存終端 | 既存CREATE_NEW／非置換公開を維持し、公開失敗でもwriter closeを試す。計数、記録の元理由とMutex終端理由を別に保持する。 | 各reader、列挙、writerの初回close不明はProcessの追加保存停止へ接続し、その後もMutex release／closeを試す。Dropや後続成功で初回不明を消さない。 |

容量値の有効性は、同じMutexへ参加するwriterの範囲に限る。Directory保持や二回観測から非参加producerの変更防止を宣言しない。計数は既存文書のSchema適合・回復可能性・非使用・削除Authorityを証明しない。全producer、固定namespace、公開Protocol／Adapter、Process/session間の成立、panic unwind実操作と実残存処置は未接続・未観測である。

#### 別Processからの現在読取り

私有読取り部品はcaller既知の参照、五field・属性Identityと期待bytesを入力とする。対象自身から期待Identityを作らず、過去の作成・flush・公開・close receiptを復元しない。

| 現在の形状 | 読取り結果 | 処置 |
|---|---|---|
| stageだけ | `Prepared` | 現在の完全性を照合してreaderを保持する。公開の継続は別Ownerの未接続責務。 |
| publicだけ | `Published` | 現在の完全性を照合してreaderを保持する。元Task成功や削除Authorityを発行しない。 |
| 二名／両不存在 | 固定拒否 | 同じ参照を保持し、移行・復元・清掃0。 |
| 不一致／観測不能 | 固定拒否 | 取得前拒否と取得後closeを分け、不明を不存在へ畳まない。 |

両名の直接観測後、唯一名を同期・非reparse・READ／READ_CONTROL・shareREADで保持し、実体・属性・owner／protected二ACE・全bytesを再照合する。他名の明示不存在、親chainと同じ実体を再確認する。これは観測時点の形状であり、後続の別名新規作成を禁止する保証ではない。失敗結果は同じ参照、今回open要求／取得と個別close確認だけを持つ。最初のclose結果は単調に保持し、Dropや二回目の呼出しで上書きしない。

自己生成fixtureの別Processで、準備済みreader保持中と公開済みwriter保持中に意図的終了を与える。親が期待exitとexact Process／Job終端を確認してからfresh読取りを行う。子の明示close、突然crash、rename途中、電源断、caller耐久接続または本番Recoveryの成立をこの検証へ含めない。Workerのwriter再取得はcfg(test)だけであり、本番の再公開APIではない。

#### 返却された実体情報がない場合の現在候補観測

過去の記録file Identityをcallerが保持していない場合は、既存strict readerへ対象自身から得たIdentityを期待値として渡さない。別の私有型`TerminalCurrentCandidate`で、caller-known参照と独立保持した全bytesを、現在の唯一名・実体・保護へ照合する。既知Identity照合と現在候補観測は明示した方針を持つ同じreader本体を使用し、既存strict readerの既知実体条件は維持する。

返すIdentityは今回の現在観測だけである。同じ内容の別実体を現在候補として観測できても、元fileとの連続性、過去のwrite／flush／rename／close、元producerのlineage、非使用、Authorityまたは清掃成功は成立しない。参照だけで独立した内容・対象bindingがなければ結合未確認として停止する。Nativeはboundedなopaque bytesの一致を所有し、完全intentの正規Schema・producer・対象bindingを上位Ownerが確認する。

候補は参照由来のexact二名だけを解決し、列挙、近似探索、自由Path、再公開、復元または清掃を行わない。唯一名の非reparse同期readerをshareREADで保持し、現在Identityの前後一致、保護、全bytes、他名不存在と親を再確認する。今回open・失敗・単調closeは同じ参照へ残す。専用読戻しProtocolとcaller耐久記録のSource接続は追加したが、正常な実搬送、署名Runtime、返却喪失後の実再入場およびfreshな処置Gateは未成立である。

**接続前OPEN:** 現在の固定OS保存境界、caller耐久参照、共有容量予約、初期化途中、本番Process喪失／再入場、全consumerと旧三領域は未成立。shareREADと二ACEだけから、WRITE_DAC／owner変更への連続防御、close後の不変性、別主体の防御または非使用を推定しない。私有部品の成立を公開Recovery完成へ昇格しない。

## 4. バイナリ境界

Root／Home／Store／Stateのbyte・flag定義は[protocol.rs](../../../40_Develop/platform-access/src/protocol.rs)、Docker復旧のcommand・応答は[docker_repair.rs](../../../40_Develop/platform-access/src/docker_repair.rs)を正本とする。

| protocol | 識別と長さ | 確認事項 |
|---|---|---|
| Root | revision 3、`CRDDPA03`／`CRDDPR03`、応答86 bytes | nonce、role、Path、期待実体、既知flag、終了状態 |
| Home／Store／State | revision 3、`CRDDPH02`／`CRDDHO02`、要求76・応答182 bytes | provider、nonce、主体・保護・安定Identity。初期化flagはStore／Stateだけ |
| Docker障害修復 | `CRDDDR05`、応答41 bytes | 現行公式成果物の署名・同一操作Identityを固定し、公式停止と残存Process終了を分離して返す |
| 検証付き再起動 | `CRDDDS01`、応答41 bytes | 現行公式成果物の署名・同一操作Identityを固定する別mode。`S`だけが公式停止を許可し、`N`未発行／`T`exit 0と子回収確認／`P`発行後不明を返す |
| Host対象の現在観測 | 専用`--host-terminal-observe`、`CRDDHT02`／`CRDDHR02`、revision 2。要求最大342、応答最大1024 bytes | nonceは要求相関専用。Root／marker単純名、namespace三実体の六u32と独立した選択利用者Hashを入力し、十一実体・元marker Hash・取得数と初回close列を返す。標準／AppContainer／Home modeへ混ぜない |
| Host対象の初回取得 | 同じ専用mode、要求`CRDDHC01` revision 1、最大238 bytes。応答は`CRDDHR02` revision 2 | Root／marker単純名とnonceだけを入力する。固定所在、三実体、選択利用者と二ACLを確認し、未知期待値をゼロや推測で補完しない |
| Host終端記録の保存 | 専用`--host-terminal-save`、`CRDDHS01`／`CRDDHW01` revision 1。要求最大8841、応答最大2048 bytes | 同参照、固定名、十一Known実体・利用者・marker Hash、1〜8192bytesの完全本文とHashを結合する。保存排他内のstage作成直前に対象全体を再照合し、部分receiptと個別終了を返す。削除・初期化・権限修復は行わない |
| Host終端記録の読戻し | 専用`--host-terminal-read`、要求`CRDDHL01` revision 1／応答`CRDDHB01` revision 2。要求最大8841、応答最大2048 bytes | callerの同参照・独立完全bytesを、現在の唯一名・保護・実体へ照合する。同じ旧世代のKernel排他をNative自身が取得し、記録Reader・外側guardの終了後に解放する。Root／marker／六childは取得しない。保存・再公開・削除は行わない |
| 既知fileを含むHost終端記録の保存 | 専用`--host-terminal-known-file-save`、`CRDDKS03`／`CRDDKW03` revision 3。要求最大8847、応答最大2048 bytes | 十二Known実体・file固定条件・同参照・完全本文を保持し、既存容量／非置換writerのstage前Gateへ接続する。型・上限と本文Hash差の取得前拒否を確認した。正常保存・Coordinator caller・署名Runtimeは未成立 |
| 既知fileを含むHost終端記録の読戻し | 専用`--host-terminal-known-file-read`、`CRDDKL03`／`CRDDKB03` revision 3。要求最大8847、応答最大2048 bytes | 独立本文と固定namespaceだけを現在Readerへ結合し、Root／marker／child／file取得0を保持する。本文Hash差の取得前拒否を確認した。正常読戻し・caller再入場・署名Runtimeは未成立 |

Host対象観測は、固定OS所在と保護namespaceを既存guardで確認し、対象八handleを取得・再照合した後、Token二件・対象八件・外側chainの全明示終了が確認できた場合だけ成功snapshotを搬送する。chainは最大64handleで、Path成分をToken／Directory取得前に確認し、超過を切り詰めない。応答は元phase／固定理由、部分取得数、各初回closeを保持し、観測成功＋外側close不明ではsnapshotを返さない。

初回取得用の`CRDDHC01` revision 1要求は44byteのheader（magic、revision、nonce、二名の長さ）とRoot／markerの単純名だけを持つ。最大238bytesで自由Path、ゼロで埋めた期待実体や利用者を受け付けない。同じ専用modeで、固定所在の全chainを取得し、同じTokenの選択利用者、三実体の型・相異、recovery／terminal双方の保護を確認してから現在値を返す。応答は`CRDDHR02`を共有する。guardの旧`namespace=None`を固定保存境界の成立へ読み替えず、初回取得も二保護と選択利用者の確認を必須とする。

Current結果を上位Ownerが保持した後、別のKnown要求で独立期待値として再照合する。初回取得を過去の連続性・非使用・Authorityにせず、保護初期化は独立した未成立条件として保持する。この入口は作成、保存、権限修復、削除、非使用認定、承認または清掃Authorityを発行しない。欠落または保護不適合なら修復せず停止する。Coordinatorは専用Adapterで要求種別、nonce、形式、field相関、子の終了／stdio終端と成果物前後一致を別に確認する。本番署名物への有効化と実三Root回復の成立は、このSource接続だけから宣言しない。

部分応答、余分なbyte、異なるnonce／role、不正flagまたは異常終了を正常候補へ補正しない。公開結果へPath、SID、ACL、Credentialまたはraw OS errorを戻さず、閉じた理由、flagおよびHashだけを返す。

専用保存は既存の固定namespace guard、共通容量Mutex、計数・予約・非置換renameを再利用する。完全本文のHashを保存場所取得前に照合し、十一Known実体と元marker Hashの不一致・観測不能・対象close未確認ではstage作成0とする。上位Schema、producerおよびcaller耐久性はCoordinatorの責務であり、Nativeが本文を解釈・補完しない。

保存応答は、同参照、保存の共同成立、保存・操作・記録・計数・計数元理由の五値、既存観測応答、固定52bytesの部分receiptを持つ。receiptは容量11bytes、計数26bytes、記録15bytesへ分け、未試行のOptionをfalseへ畳まない。最大形状1758bytesは2048bytes以内であり、処置後の切詰めをしない。外側Directory終了不明でも保存元理由と公開済みreceiptを保持する。保存結果、対象観測と最終共同成立は別に評価する。

Source上の専用入口とCoordinator Adapterは接続済みだが、署名配布物での正常保存、同参照のNative再入場、非使用・承認・限定処置は未成立である。timeout、stdout欠落・過大・不正、返却write失敗や成果物差は、callerが同参照と完全bytesを保持し、記録Effect不明として停止する。自動再保存・別参照発行・stage清掃を行わない。

読戻しは記録の再確認と対象のfresh確認を分離する。Rootや元markerの清掃後も同じ回復参照を追えるよう、必要な実体は固定namespace三件と現在の記録だけとし、要求内の対象Known値をRoot存在の前提にしない。上位Ownerは同じcaller文書のSchema、producer、bindingsと完全bytesを前後に確認する。読戻しの成功を過去の保存receipt、対象非使用、清掃許可または清掃完了へ変換しない。

読戻し応答revision 2の固定headerは55bytesで、nonce、状態、各長さ、現在実体の有無、open要求・取得、Reader終了、同世代排他の取得と解放を分離する。続く同参照、元理由・操作理由、既存の外側観測応答と任意の現在実体24bytesを含む最大形状1345bytesは2048bytes以内である。対象未試行を表す外側結果は`terminal_target_not_attempted`であり、明示不存在ではない。Reader、外側closeまたは排他解放が不明なら観測成功を返さず、確認できた現在状態・実体・元理由を保持する。Nodeはこれらの共同成立と実child終了を照合し、旧応答を新しい終了確認へ補完せず、不正搬送では同参照を保持して停止する。readは記録変更なし、saveの返却不明は記録Effect不明として区別する。

排他は既存HostOperationと同じ固定名のNamed Pipeを、`FILE_FLAG_FIRST_PIPE_INSTANCE`、一instance、remote client拒否、選択利用者とSYSTEMのみの非継承DACLで同期取得する。Connect／Read／Write待機を発行せず、所有handleの明示closeを返す。[WindowsのCreateNamedPipe契約](https://learn.microsoft.com/en-us/windows/win32/api/namedpipeapi/nf-namedpipeapi-createnamedpipew)に基づき、競合・取得不明では停止する。所有handleのclose確認だけから、他者のhandleを含む全instance不存在、当初Processの終了、対象非使用または清掃許可を推定しない。読戻し後の別操作へ排他保持を引き継いだとも表示しない。最終処置には処置Native内で連続した再取得・保持と独立の非使用根拠が必要である。

#### 限定清掃に用いるOS処置の候補

最終処置の候補は、最初から`DELETE` accessを持つ同じ同期handleへ通常`FileDispositionInfo`を指定する方式とする。再帰削除、Pathからの対象再取得、Ex／POSIX／強制削除へ置換しない。これは本番未接続の候補であり、固定自己生成対象によるAPI適用可能性だけを確認した。[MicrosoftのSetFileInformationByHandle仕様](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-setfileinformationbyhandle)が定めるaccessと、[全handle終了まで削除完了しない意味](https://learn.microsoft.com/en-us/windows/win32/fileio/closing-and-deleting-files)へ照合する。

| OSから得る結果 | 上位Ownerへ渡す意味 |
|---|---|
| disposition要求の成功 | 削除指定が受理された。対象不存在や全reader終端ではない。 |
| 所有handleの明示close | このhandleの終了結果。別の互換readerが残る場合は対象の消失を保証しない。 |
| freshな直接不存在 | 保持した親と同世代排他の区間で、対象が存在しないことを別に確認した。観測不明は不存在ではない。 |
| 非空Directoryの拒否 | 空クラスの処置は成立しない。再帰処置や未知entryの削除へ進まない。 |

本番への接続には、非使用・fresh承認・保護済み耐久記録と全対象の照合を先に成立させ、六childの限定処置、Root直接不存在、marker直接不存在、世代解放を共同終端へ接続する必要がある。自己生成試験での非空反例の片付けは、その試験が生成した既知fileだけの処置であり、非空の旧残存クラスを受理する根拠にしない。実API／close故障、部分処置後の同参照再入場、未知entryと本番の承認Ownerは未成立である。

## 5. 状態・資源・回復

観測は、要求検証、固定対象のopen、主体・保護・実体の観測、前後一致、応答の順で行う。Directory、token、security descriptor、Known Folderおよびhash handleは所有箇所で解放する。初期化後の失敗を「Effectなし」へ補正しない。

Docker復旧helperは固定mutexとartifact handleを保持し、検証済み対象だけを終了・再起動する。TypeScript側は子Processとstdioの終了を待ち、観測不能なら`cleanup_unknown`へ閉じる。helperの終了だけでDocker Engine復旧や退避Directory削除を宣言しない。

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

通常の観測・Docker helper自身は耐久Recovery recordを所有しない。Host終端記録の専用保存は上位Ownerが固定した非Authority bytesの保護付き保存だけを所有し、Task／回復の意味や清掃判断はCoordinatorに残す。呼出側はhelper終了を全体cleanupとみなさず、同じOperationの状態、資源、Effect receiptと再結合する。

| 子Process境界 | 保証・不明時の処置 |
|---|---|
| 起動 | `CREATE_SUSPENDED`で生成し、kill-on-close Jobへ割り当ててから再開する |
| 入出力 | 明示したNUL handleだけを継承する。CLI出力を応答protocolへ混入させない |
| 待機 | 外側35秒の有限待機。stdin EOF・予期しない追加入力・観測不能を取消として扱う |
| 回収 | 同一子handle終了とJob内Process不存在を確認。回収不明なら`P`後にhelperを異常終了し、後続の正常終了応答を禁止する |
| 全体成立 | `T`だけではDocker停止成立を主張しない。Coordinatorが管理Process、CLI、WSLとEngineを再観測する |

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
| 要求・応答とCLI | [Rust CLI試験](../../../40_Develop/platform-access/tests/cli.rs)、protocol内試験、[TS Adapter試験](../../../40_Develop/coordinator/tests/unit/platform-access-adapter.contract.test.ts) |
| 配布物・署名 | [成果物試験](../../../40_Develop/coordinator/tests/integration/platform-access-release.contract.test.ts)、[Trust Core試験](../../../40_Develop/coordinator/tests/unit/platform-provisioner-trust-core.contract.test.ts)、[Release Identity試験](../../../40_Develop/coordinator/tests/integration/platform-provisioner-release-identity.contract.test.ts) |
| Home／Store／State | windows.rs内試験、[Home観測試験](../../../40_Develop/coordinator/tests/unit/provider-home-observation.contract.test.ts)、[Store Adapter試験](../../../40_Develop/coordinator/tests/unit/candidate-store-windows-adapter.contract.test.ts) |
| Docker復旧 | docker_repair.rs内試験、[復旧Runtime試験](../../../40_Develop/coordinator/tests/integration/docker-desktop-runtime-repair.contract.test.ts) |

単体試験の合格から、本物のDocker Desktop復旧、署名済み配布物の実行または終了後資源0を推定しない。本番同等入口のE2Eと回復行列を別に実測する。

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
