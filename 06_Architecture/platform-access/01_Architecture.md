# Windowsネイティブ部品の設計

状態: Candidate（v0.20.0、正式実機検証未完了）
担当責任者: Qual-Lab
最終更新日: 2026-09-07

## 1. 役割と非目標

`platform-access`は、TypeScriptだけでは確認できないWindowsの主体、保護、Filesystem実体を観測し、Docker Desktopの明示的な最終復旧でだけ限定したOS操作を行う内部部品である。AIの方針、外部送信許可、一般Taskの順序、Authorityおよび最終結果は[Coordinator Runtime](../coordinator/01_Architecture.md)が所有する。native応答の`candidate`だけから実行許可を発行しない。

利用者がnative binaryを直接起動する通常手順は持たない。永続的なRuntime有効化、Platform Provisioning、AppContainer準備用Supervisorも持たない。

## 2. 成果物と依存

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

[Rust crate](../../40_Develop/platform-access/Cargo.toml)から、固定成果物`crdd-platform-access.exe`を一つだけ生成し、`template/tools/coordinator/windows-x64/`へ同梱する。

crateは`rust-toolchain.toml`、`Cargo.toml`および`Cargo.lock`でtoolchain、target、依存および版を固定する。通常Runtimeから`cargo run`、PATH上のCargo／Rust binaryまたは開発用`target/`成果物を起動しない。Release成果物は固定相対Path、target、protocol revision、Rust toolchain、byte長およびSHA-256を署名済みmanifestへ含める。言語・Buildの共通規則は[内部ツール・コーディング規約](../99_Coding_Standards.md)、反復手順は[Coordinator RuntimeのWorkflow](../../19_Workflows/01_Coordinator_Runtime.md)を参照する。

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
| Docker操作 | `src/docker_repair.rs` | 用途別protocol、mutex、固定artifact、Process確認・限定操作 |
| 発行元検証 | `src/docker_authenticode.rs` | 開いたDocker artifactのWindows署名・発行元検証 |
| 停止CLIの子Process所有 | `src/windows_owned_child.rs` | 停止前生成、Jobへの割当、実行、有限待機、取消と終了観測 |

再起動protocolのSourceが存在することは、署名済み配布物への収載、耐久記録との接続または実機E2E完了を意味しない。操作許可、Directory退避、Task復旧、再起動完了の総合判定はこのbinaryへ移さず、Coordinator側に保持する。Linux／macOSの実装経路はない。

| 経路 | 実装上の所有者 | 条件・効果・限界 |
|---|---|---|
| Provider Home観測 | `windows.rs`の`observe_provider_home` | Codex／Claudeの選択HomeをOS Known Folderから結合する。Credential本文は読まず、既存Homeを修復しない |
| Store／State初期化 | `initialize_runtime_owned_directory_if_missing` | 明示されたRuntime-owned directoryの最終Directoryだけを保護付きで作る。既存物を推測修復しない |
| Docker Desktop最終復旧 | `docker_repair.rs` | 固定Policy、artifact、mutex、対象Process確認、終了および固定Desktop起動を扱う。耐久記録、Directory rename、再開判断はTypeScript側が所有する |

RootやHomeの観測結果は、用途別Adapterが同じOperationのRepository、選択ユーザー、署名済み配布物およびRecovery状態と再結合して初めて利用できる。別Operationへ持ち回らない。

## 4. バイナリ境界

Root／Home／Store／Stateのbyte・flag定義は[protocol.rs](../../40_Develop/platform-access/src/protocol.rs)、Docker復旧のcommand・応答は[docker_repair.rs](../../40_Develop/platform-access/src/docker_repair.rs)を正本とする。

| protocol | 識別と長さ | 確認事項 |
|---|---|---|
| Root | revision 3、`CRDDPA03`／`CRDDPR03`、応答86 bytes | nonce、role、Path、期待実体、既知flag、終了状態 |
| Home／Store／State | revision 3、`CRDDPH02`／`CRDDHO02`、要求76・応答182 bytes | provider、nonce、主体・保護・安定Identity。初期化flagはStore／Stateだけ |
| Docker障害修復 | `CRDDDR05`、応答41 bytes | 現行公式成果物の署名・同一操作Identityを固定し、公式停止と残存Process終了を分離して返す |
| 検証付き再起動 | `CRDDDS01`、応答41 bytes | 現行公式成果物の署名・同一操作Identityを固定する別mode。`S`だけが公式停止を許可し、`N`未発行／`T`exit 0と子回収確認／`P`発行後不明を返す |

部分応答、余分なbyte、異なるnonce／role、不正flagまたは異常終了を正常候補へ補正しない。公開結果へPath、SID、ACL、Credentialまたはraw OS errorを戻さず、閉じた理由、flagおよびHashだけを返す。

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

native部品自身は耐久Recovery recordを所有しない。呼出側はhelper終了を全体cleanupとみなさず、同じOperationの状態、資源、Effect receiptと再結合する。

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
| 要求・応答とCLI | [Rust CLI試験](../../40_Develop/platform-access/tests/cli.rs)、protocol内試験、[TS Adapter試験](../../40_Develop/coordinator/tests/unit/platform-access-adapter.contract.test.ts) |
| 配布物・署名 | [成果物試験](../../40_Develop/coordinator/tests/integration/platform-access-release.contract.test.ts)、[Trust Core試験](../../40_Develop/coordinator/tests/unit/platform-provisioner-trust-core.contract.test.ts)、[Release Identity試験](../../40_Develop/coordinator/tests/integration/platform-provisioner-release-identity.contract.test.ts) |
| Home／Store／State | windows.rs内試験、[Home観測試験](../../40_Develop/coordinator/tests/unit/provider-home-observation.contract.test.ts)、[Store Adapter試験](../../40_Develop/coordinator/tests/unit/candidate-store-windows-adapter.contract.test.ts) |
| Docker復旧 | docker_repair.rs内試験、[復旧Runtime試験](../../40_Develop/coordinator/tests/integration/docker-desktop-runtime-repair.contract.test.ts) |

単体試験の合格から、本物のDocker Desktop復旧、署名済み配布物の実行または終了後資源0を推定しない。本番同等入口のE2Eと回復行列を別に実測する。
