# Windowsネイティブ部品の設計

状態: Stable（v0.18.1）
担当責任者: Qual-Lab
最終更新日: 2026-09-01

## 1. 役割と非目標

`platform-access`は、TypeScriptだけでは確認できないWindowsの主体、保護、Filesystem実体を観測し、Docker Desktopの明示的な最終復旧でだけ限定したOS操作を行う内部部品である。AIの方針、外部送信許可、一般Taskの順序、Authorityおよび最終結果は[Coordinator Runtime](../coordinator/01_Architecture.md)が所有する。native応答の`candidate`だけから実行許可を発行しない。

利用者がnative binaryを直接起動する通常手順は持たない。永続的なRuntime有効化、Platform Provisioning、AppContainer準備用Supervisorも持たない。

## 2. 成果物と依存

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
| Docker復旧 | `CRDDDR04`、応答41 bytes | 固定mode、状態、Policy Hash、子Process結果 |

部分応答、余分なbyte、異なるnonce／role、不正flagまたは異常終了を正常候補へ補正しない。公開結果へPath、SID、ACL、Credentialまたはraw OS errorを戻さず、閉じた理由、flagおよびHashだけを返す。

## 5. 状態・資源・回復

観測は、要求検証、固定対象のopen、主体・保護・実体の観測、前後一致、応答の順で行う。Directory、token、security descriptor、Known Folderおよびhash handleは所有箇所で解放する。初期化後の失敗を「Effectなし」へ補正しない。

Docker復旧helperは固定mutexとartifact handleを保持し、検証済み対象だけを終了・再起動する。TypeScript側は子Processとstdioの終了を待ち、観測不能なら`cleanup_unknown`へ閉じる。helperの終了だけでDocker Engine復旧や退避Directory削除を宣言しない。

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
