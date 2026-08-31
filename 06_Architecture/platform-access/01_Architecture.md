# Windowsネイティブ部品の設計

状態: 現行実装から再構成・独立確認待ち
担当責任者: Qual-Lab
最終更新日: 2026-08-31

## 1. 役割と非目標

platform-accessは、TypeScript側だけでは確認できないWindowsの主体・保護・実体を観測し、明示された専用経路では限定したOS操作を行う部品である。全体を「読取り専用」とは呼ばない。AIの方針、外部送信許可、一般Taskの順序は[Coordinator](../coordinator/01_Architecture.md)が所有し、この部品の`candidate`応答を実行許可へ昇格しない。

独立した利用者画面は持たない。利用者は診断、依頼、候補管理、専用復旧を通じて結果を受け取る。native binaryを直接起動する通常利用手順は追加しない。

## 2. 成果物と依存

[同一Rust crate](../../40_Develop/platform-access/Cargo.toml)から異なる二つの実行物を作る。

| 成果物 | 役割 | 配布先 |
|---|---|---|
| `crdd-platform-access.exe` | 通常の観測、限定初期化、別modeのDocker修復helper、AppContainer Worker | `90_Release/platform-access/x86_64-pc-windows-msvc/` |
| `coordinator.exe` | `native-bootstrap-release` featureで作る準備処理用Supervisor | `90_Release/coordinator/x86_64-pc-windows-msvc/` |

後者はTypeScriptのCoordinator CLIではない。SupervisorからWorkerへ依存し、WorkerのHashを固定する。TypeScript Adapterは署名manifest、固定Path、成果物の前後同一性、最小環境、nonceと応答を確認する。Rustはその内側のOS実体を確認する。片方の確認をもう片方の代用にしない。

```text
Coordinatorの用途別Adapter
  → 配布物・引数・最小環境を確認
  → 固定native実行物
    ├ Root／Provider Homeの観測
    ├ CandidateStore／RuntimeStateの限定初期化・観測
    ├ Docker修復helper（別mode）
    └ 準備Supervisor → AppContainer Worker（別実行物）
  → 応答と終了状態・成果物を再確認
  → 呼出し元の診断／Task／Recovery結果
```

## 3. 操作ごとの境界

| 経路 | 実装上の所有者 | 条件・効果・限界 |
|---|---|---|
| Runtime／Authority Root観測 | [main.rs](../../40_Develop/platform-access/src/main.rs)の`execute_bytes`、[windows.rs](../../40_Develop/platform-access/src/windows.rs)の`observe` | Path、期待実体、nonce、RootRoleを検査し、handle・reparse・AccessCheck・tokenを観測。保護済み有効世代へのTS接続は未実装で、観測候補だけで有効化しない |
| Provider Home観測 | `observe_provider_home` | Codex／Claude selectorからOS Known Folder配下を選ぶ。Credential本文は読まない。Home作成・ACL修復はしない |
| Store／State初期化 | `initialize_runtime_owned_directory_if_missing` | CandidateStore／RuntimeStateの明示初期化時だけ、固定最終Directoryをprotected DACL付きで作成。既存物を勝手に修復しない |
| Docker Desktop修復helper | [docker_repair.rs](../../40_Develop/platform-access/src/docker_repair.rs)の`run` | 固定Policy・artifact・mutexを保持し、検証済みProcess終了と固定Desktop起動を行う。Directory rename、耐久記録、再開判断はTS側 |
| 準備Supervisor | [coordinator.rs](../../40_Develop/platform-access/src/bin/coordinator.rs)の`launch_worker` | 明示provisionの範囲で、AppContainer・create-time Job・mitigation付きWorkerを最大一回起動。通常TaskごとのRegistry変更ではない |

Root観測候補やHardened／Managed準備経路が未完成であることを、Local Personal一般TaskのProvider Home／State観測が未接続という意味にしない。配布元とTaskのAuthorityは用途ごとに別に照合する。

## 4. バイナリ境界

Root／Home／Store／Stateのbyte・flag定義は[protocol.rs](../../40_Develop/platform-access/src/protocol.rs)、Docker修復のcommand・応答定義は[docker_repair.rs](../../40_Develop/platform-access/src/docker_repair.rs)を正本とする。別のSchemaを複製しない。

| protocol | 識別と長さ | 確認事項 |
|---|---|---|
| Root | revision 3、`CRDDPA03`／`CRDDPR03`、応答86 bytes | nonce、role、長さ、既知flags、終了状態 |
| Home／Store／State | revision 3、magicは`CRDDPH02`／`CRDDHO02`、要求76・応答182 bytes | magic末尾を改訂番号とみなさない。初期化flagはStore／Stateだけ |
| Docker修復 | `CRDDDR04`、応答41 bytes | 別mode。statusとPolicy Hashを同じhelperへ結合 |

通常stdioとAppContainerのnamed pipeでは入力の区切り方が異なる。部分応答、余分なbyte、異なるnonce／role、不正flag、異常終了は正常候補へ補正しない。公開結果へPath、SID、ACL、Credential、raw OS errorを戻さず、閉じた理由とflags／Hashだけを用途別Adapterへ返す。

## 5. 状態・資源・回復

### 観測と限定初期化

要求検証→固定対象のopen→主体・保護・実体の観測→前後一致→応答、が基本となる。Directory／token handle、security descriptor、Known Folder領域、hash handleはそれぞれの所有型で解放する。前後不一致は候補拒否。初期化後の失敗は「作成していない」とは扱わず、TSの結果投影が生成可能性を保持する。

### 修復helper

固定mutexとartifact handleを保持した状態で`V/I/K/L/Q`を受け付ける。`K`は対象Processの確認と終了、`L`は固定Desktopの起動を担う。処置前の再照合を省略しない。TypeScriptは子の終了とstdioの終了を待ち、不明時は`cleanup_unknown`へ閉じる。helperの終了だけでDocker Engineの復旧や退避Directoryの削除完了を宣言しない。

### AppContainer準備

署名・主体・Worker結合の確認→必要な一時Registry処置→Worker起動→応答検証→Job空の確認→Registry復元、の全体を閉じる。`terminate_and_confirm_empty`、`exact_platform_access_response`、`LowBoxRegistryEffect::restore`が具体的な接続点である。

`LowBoxConsoleEnabled`の一時変更は、固定排他、変更前状態、耐久回復記録、現在値とkey last-writeの所有確認、復元後読戻しを伴う。Registryに強いCASがあるとは主張しない。外部変更・復元不明では上書きせず手動回復へ渡し、復元前に成功responseを公開しない。親環境は継承せず、検証したOS Known Folder由来`LOCALAPPDATA`をWorkerへ渡す。

## 6. 呼出し元との分担

| native側 | Coordinator側 |
|---|---|
| OS実体・主体・保護の観測 | どのTask・Provider・Revisionのために使うか |
| 応答flags・Hash・nonce | 一回限りの観測Capabilityの発行・消費・失効 |
| 指定された限定初期化・Process操作 | 操作の許可、耐久intent、全体の停止・復旧・結果公開 |
| 子・Job・native handle・Registryの後条件 | Docker／Mount／Host／候補をまたぐ回収の完了 |

正常OS・認証済みLocal Userの信頼境界を維持する。全native unsafe経路や同一ユーザーによる改ざんへの完全耐性は、この再構成文書では証明しない。

## 7. 検証への接続

| 対象 | 正常・拒否・中断の確認先 |
|---|---|
| 要求・応答とCLI | [Rust CLI試験](../../40_Develop/platform-access/tests/cli.rs)、protocol内試験、[TS Adapter試験](../../40_Develop/coordinator/tests/platform-access-adapter.contract.test.ts) |
| 配布物・署名・Worker結合 | [bootstrap Core試験](../../40_Develop/platform-access/tests/native_bootstrap_core.rs)、[配布試験](../../40_Develop/coordinator/tests/platform-access-release.contract.test.ts) |
| Home／Store／State | windows.rs内試験、[Home観測](../../40_Develop/coordinator/tests/provider-home-observation.contract.test.ts)、[Store Adapter](../../40_Develop/coordinator/tests/candidate-store-windows-adapter.contract.test.ts) |
| Supervisor・Registry | supervisor内試験、[Supervisor配布接続](../../40_Develop/coordinator/tests/native-provision-supervisor-release.contract.test.ts) |
| Docker修復・終了・環境 | docker_repair.rs内試験、[修復Runtime試験](../../40_Develop/coordinator/tests/docker-desktop-runtime-repair.contract.test.ts) |

`lowbox_registry_effect_restores_exact_prestate`はRegistry変更を伴うignored試験であり、通常試験合格から実Registry復元済みとしない。試験用子Processの環境一致、本物のDocker復旧、署名済みWorkerの実測も別の根拠である。最新の実行結果と未確認範囲は品質記録へ接続する。
