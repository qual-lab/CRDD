# 変更トレース: 最小RustプラットフォームアクセスCore

- 変更ID: `CHG-000019`
- 状態: `Draft`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-17
- 対象: CRDD公式Repositoryの内部Coordinatorと`tools/platform-access/**`
- 対象version: v0.18.0 Candidate
- 変更分類: `breaking`
- 移行要否: `migration_required: true`（CRDD公式Repositoryの開発・build環境だけ。採用Repositoryと公開CLIは対象外）
- 関連正本: [`19_Maintenance.md`](../../19_Maintenance.md#33-internal-typescript-runtime)、[`tools/coding-standards.md`](../../tools/coding-standards.md)、[`CHG-000016`](CHG-000016_Internal_TypeScript_Migration.md)、[`CHG-000017`](CHG-000017_Tools_Coding_Standards.md)

## 人間判断と変更境界

Qual-Labの人間の決定権限者は、CRDD本体、CLI、Policy、契約および制御をTypeScriptに保持し、TypeScriptだけでは閉じないOS APIへの読み取り専用接続だけを最小Rust componentへ限定する方針を承認した。局所BAT、CMD、PowerShellまたはShell Scriptを追加せず、CRDD公式Repositoryの内部実装はTypeScriptとRustの2言語で構成する。

この判断は、過去のTypeScript完全移行を、OS固有の最小プラットフォームアクセス部に限って後続置換する。Coordinator本体とCheckerのTypeScript移行、native TypeScript実行、Biome、命名規則および公開CLIは維持する。Rustを採用Repositoryの依存、独立製品、公開CLIまたは単独配布packageにしない。

## 実装

`tools/platform-access/`へ非公開の実行crate `crdd-platform-access`を追加した。固定条件は次のとおりである。

- Rust toolchain `1.94.1`、target `x86_64-pc-windows-msvc`、edition 2024を固定する。
- `windows-sys` `0.61.2`だけを直接依存とし、`Cargo.lock`を追跡する。依存はMITまたはApache-2.0で提供されるWindows API bindingであり、版、sourceおよびlicenseの再評価は依存更新時に行う。
- 固定上限付きbinary protocol revision 1で、root role、random nonce、期待するWindows file IdentityおよびPathを入力する。出力は候補状態、固定reason、nonce、roleおよびaccess bitだけで、Path、SID、ACL、token、descriptorまたはraw OS errorを返さない。
- Windows側は既存non-link directoryを読み取り専用handleで開き、同じhandleのIdentityを前後で照合する。現在process tokenをimpersonation tokenへ複製し、Windows `AccessCheck`にread／traverse、add、metadata write、deleteおよびDACL／owner変更accessを個別評価させる。
- caller supplied SID、PowerShell ACE集計、handle open失敗またはRust componentの存在だけから実効権限、Root保護、Authority、CapabilityまたはEffectを成立させない。
- 観測処理はhandleのopen／close以外の書込み、削除、DACL変更、Root作成、state更新またはNetwork処理を持たない。POSIX Adapterは未実装である。

TypeScript側は固定responseをstrictに再検証するprivate Adapter contractを追加した。ただし生成binaryの固定配置、target、Hash、protocol revision、build provenanceおよび署名済みRelease Identityへの結合は未実装である。本番入口はhelper process起動、Path解決またはFilesystem観測より前に`platform_access_release_binary_binding_not_implemented`で`blocked`となる。通常Runtimeから`cargo run`、PATH上のCargo／Rust binaryまたは開発用`target/`成果物を起動しない。

Rust componentの状態はRoot observation、Runtime Root Path IdentityおよびPlatform Provisioner Windows DACL contractへ同じprivate contract snapshotから投影する。既存のWindows Adapter、DACL適用、Provision Effect、Runtime reader、POSIX観測、activationおよびProtection Hash結合は未実装のままであり、12 blocker、6 current-run evidence、Gate `blocked`、Authority／Capability／Effect非発行を維持する。

## 移行

CRDD公式Repositoryの開発・build環境には、固定`rust-toolchain.toml`を解決できるRustup／CargoとMSVC targetが必要になる。開発確認はCoordinator packageの次の責務別入口を使用する。

- `npm run platform-access:format:check --prefix tools/coordinator`
- `npm run platform-access:lint --prefix tools/coordinator`
- `npm run platform-access:test --prefix tools/coordinator`
- `npm run platform-access:build --prefix tools/coordinator`

いずれも開発時の直接Cargo commandであり、通常Runtimeまたは採用Repositoryの実行入口ではない。Rust環境を用意できない場合はv0.17.0 Released Baselineへ戻し、Rust成果物を未検証のままReleaseへ含めない。採用Repositoryの`tools/crdd-check.ts`、公開Checker CLI、JSON Schema、Coordinator CLI、端末状態および利用者操作には移行を要求しない。

## Self-checkと残る境界

Node.js `24.19.0`、Rust／Cargo `1.94.1`およびtarget `x86_64-pc-windows-msvc`を用いたSelf-checkで、次を確認した。

- Rustは`rustfmt --check`、Clippy Warning拒否、locked target buildに合格し、unit testは4件中4件に合格した。
- Coordinatorはproduction／testの型検査、Biome Lint／Formatterに合格し、試験は335件中335件に合格した。
- Checkerは型検査、Biome Lint／Formatterに合格し、試験は151件中151件に合格した。命名検査はTypeScript 3 projectの119 sourceとRust source 3件を別の母集団として閉じた。
- 公式Repository入口とChecker package入口の全体確認は、いずれも469 files、293 Markdown、1875 local links、562 anchors、26 Related、26 versioned documents、8 Stable Context IDs、68 remediation rows、Error 0、Warning 0で一致した。
- `git diff --check`に異常はなかった。固定Commit／Treeとclean worktreeは、変更をcommitした後の独立確認入力で確定する。

本変更はRust Coreのcomponent候補までである。Release binary Identity binding、production process管理、bounded stdin／stdout／timeoutの実接続、Windows全tree／writer排他確認、Protection Hash、DACL mutation、Platform Provisioner Effect、Runtime reader、POSIX、initial Trust、activationおよびRelease artifact組込みは未実装・未評価である。これらが成立する前は本番利用を有効化しない。

本処置は`Applied`かつ`Self-checked`であり、同一固定Commit／Treeに対するAgent／Architecture／Security Review、Document Audit、Gap / Impact AuditおよびConformance Auditが完了するまでは`Resolved`ではない。確認完了は採用、統合、準拠、Stable化またはRelease判断を代替しない。v0.18は`Candidate`、Released Baselineはv0.17.0のままである。
