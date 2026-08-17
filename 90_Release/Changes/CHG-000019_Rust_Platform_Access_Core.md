# 変更トレース: 最小RustプラットフォームアクセスCore

- 変更ID: `CHG-000019`
- 状態: `Ready for Verification`
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

## 専門探索と収束

OS権限観測の実装候補として、TypeScript単独、Python、BAT／CMD／PowerShell／Shell Scriptおよび最小Rustを比較した。TypeScript単独はCRDD本体との一貫性に優れるが、Windows token、security descriptorおよび`AccessCheck`へ型安全に直接接続する境界を閉じられない。Pythonはbuild不要だが、配布先Interpreterとnative bindingへ依存し、CRDDと一体で閉じる要望に対して配布境界が増える。OS Shellは導入しやすい反面、文字列command、出力parse、権限文脈およびOSごとの差をSecurity Authorityへ接続できず、過去に不採用としたACE集計経路を再導入する。Rustはbuild toolchainを増やす短所がある一方、配布時Interpreterを要求せず、所有権と型を保った最小binaryとしてOS APIへ直接接続できる。

このため、CRDDのPolicy、契約、CLIおよび制御をTypeScriptへ残し、読み取り専用のOS API観測だけをRustへ限定する案へ収束した。保持条件は、通常RuntimeからCargo／PATH／開発`target`成果物を起動しないこと、署名済みRelease Identityへbinaryを結合するまでproduction入口を停止すること、Shell wrapperを追加しないこと、POSIXを未確認のまま推定しないことである。build時間、Rust toolchain供給、Windows API差、Release artifact結合および他OS Adapterは残存不確実性である。Release Identity結合へ着手するとき、対応OSを増やすとき、固定Rust toolchainで必要なSecurity検証を測定できなくなったとき、またはTypeScriptが同じOS API境界を直接かつ安全に所有できるようになったときに言語選択を再評価する。

## 実装

`tools/platform-access/`へ非公開の実行crate `crdd-platform-access`を追加した。固定条件は次のとおりである。

- Rust toolchain `1.94.1`、target `x86_64-pc-windows-msvc`、edition 2024および開発時coverage用の公式`llvm-tools-preview` componentを固定する。
- `windows-sys` `0.61.2`だけを直接依存とし、`Cargo.lock`を追跡する。依存はMITまたはApache-2.0で提供されるWindows API bindingであり、版、sourceおよびlicenseの再評価は依存更新時に行う。
- 固定上限付きbinary protocol revision 1で、root role、random nonce、期待するWindows file IdentityおよびPathを入力する。出力は候補状態、固定reason、nonce、roleおよびaccess bitだけで、Path、SID、ACL、token、descriptorまたはraw OS errorを返さない。
- Windows側は既存non-link directoryを読み取り専用handleで開き、同じhandleのIdentityを前後で照合する。現在process tokenをimpersonation tokenへ複製し、Windows `AccessCheck`にread／traverse、add、metadata write、deleteおよびDACL／owner変更accessを個別評価させる。
- caller supplied SID、PowerShell ACE集計、handle open失敗またはRust componentの存在だけから実効権限、Root保護、Authority、CapabilityまたはEffectを成立させない。
- `deleteOnRootObject`はRoot自身のsecurity descriptor上の`DELETE`だけを表す。親Directoryの`FILE_DELETE_CHILD`経由のRoot削除可否は未観測であり、falseから削除不能、writer排他またはProtection成立を推定しない。
- 観測処理はhandleのopen／close以外の書込み、削除、DACL変更、Root作成、state更新またはNetwork処理を持たない。POSIX Adapterは未実装である。

TypeScript側は固定responseをstrictに再検証するprivate Adapter contractを追加した。ただし生成binaryの固定配置、target、Hash、protocol revision、build provenanceおよび署名済みRelease Identityへの結合は未実装である。本番入口はhelper process起動、Path解決またはFilesystem観測より前に`platform_access_release_binary_binding_not_implemented`で`blocked`となる。通常Runtimeから`cargo run`、PATH上のCargo／Rust binaryまたは開発用`target/`成果物を起動しない。

Rust componentの状態はRoot observation、Runtime Root Path IdentityおよびPlatform Provisioner Windows DACL contractへ同じprivate contract snapshotから投影する。既存のWindows Adapter、DACL適用、Provision Effect、Runtime reader、POSIX観測、activationおよびProtection Hash結合は未実装のままであり、12 blocker、6 current-run evidence、Gate `blocked`、Authority／Capability／Effect非発行を維持する。

## 移行

CRDD公式Repositoryの開発・build環境には、固定`rust-toolchain.toml`を解決できるRustup／CargoとMSVC targetが必要になる。開発確認はCoordinator packageの次の責務別入口を使用する。

- `npm run platform-access:format:check --prefix tools/coordinator`
- `npm run platform-access:lint --prefix tools/coordinator`
- `npm run platform-access:test --prefix tools/coordinator`
- `npm run platform-access:build --prefix tools/coordinator`
- `npm run platform-access:coverage --prefix tools/coordinator`

いずれも開発時の直接Cargo commandであり、通常Runtimeまたは採用Repositoryの実行入口ではない。Rust環境を用意できない場合はv0.17.0 Released Baselineへ戻し、Rust成果物を未検証のままReleaseへ含めない。採用Repositoryの`tools/crdd-check.ts`、公開Checker CLI、JSON Schema、Coordinator CLI、端末状態および利用者操作には移行を要求しない。

## Self-checkと残る境界

Node.js `24.19.0`、Rust／Cargo `1.94.1`およびtarget `x86_64-pc-windows-msvc`を用いたSelf-checkで、次を確認した。

- Rustは`rustfmt --check`、Clippy Warning拒否、locked target buildに合格した。unit test 6件とbinary integration test 1件はすべて合格し、正常候補、Identity不一致、通常file、欠落Root、blocked／invalid response、固定stdin／stdoutおよびexit 0／2を確認した。
- TypeScript response試験は全9 access bitを一対一で検査し、第7 bitを`deleteOnRootObject`としてRoot object上の`DELETE`だけへ限定した。
- Coordinator試験336件、Checker試験151件、TypeScript owned source 120件、Rust source 4件はすべて合格または完全一致した。両private packageのtypecheck、Biome Lint／Formatterも合格した。
- 公式入口とChecker package入口の全体Checkerは同じ471 files／293 Markdown／1875 local links／562 anchors／26 Related／26 versioned documents／8 Stable IDs／68 remediation rows、Error 0／Warning 0を返した。
- `git diff --check`に異常はなかった。固定Commit／Treeとclean worktreeは、変更をcommitした後の独立確認入力で確定する。

### Rust coverageと検証義務

固定`llvm-tools-preview`をRust `1.94.1`へ含め、Repository内TypeScript runnerから`-C instrument-coverage`、固定targetおよびtracked `Cargo.lock`でRust source 4件を測定した。第三者coverage crateとnightly toolchainは使用しない。

| source | regions | functions | lines | branches |
|---|---:|---:|---:|---:|
| `src/main.rs` | 16 / 26 (61.54%) | 1 / 2 (50.00%) | 10 / 25 (40.00%) | 0 / 0 |
| `src/protocol.rs` | 260 / 284 (91.55%) | 14 / 14 (100.00%) | 139 / 146 (95.21%) | 0 / 0 |
| `src/windows.rs` | 278 / 332 (83.73%) | 12 / 12 (100.00%) | 239 / 268 (89.18%) | 0 / 0 |
| `tests/cli.rs` | 162 / 162 (100.00%) | 4 / 4 (100.00%) | 92 / 92 (100.00%) | 0 / 0 |
| 合計 | 716 / 804 (89.05%) | 31 / 32 (96.88%) | 480 / 531 (90.40%) | 0 / 0 |

固定stable rustcは対象全fileでbranch mappingを生成せず、LLVM結果は分母0、到達0である。この`0 / 0`を100%または達成率へ換算せず、branch coverageは`Not Available`とする。region／function／line実測と次のSecurity decision obligationは別の代替確認であり、compiler branch coverageを代替達成したとは表明しない。

| 検証義務 | 状態 | 根拠または未到達経路 | 残存risk／再確認 |
|---|---|---|---|
| protocol framing、上限、canonical Path、blocked response | `Verified` | unit testの正負／境界例 | revisionまたは上限変更時に再確認 |
| Root正常候補、欠落、通常file、Identity不一致 | `Verified` | Windows unit test | 他Filesystem／他Windows版はRelease binding時に再確認 |
| binary stdin／stdout、candidate／blocked／invalid、exit 0／2 | `Verified` | binary integration test | stdout write失敗とexit 3は未到達 |
| 9 access bitのRust responseからTypeScript限定名への写像 | `Verified` | Rust encodeとTypeScript全bit contract test | wire revision変更時に再確認 |
| reparse拒否、security descriptor取得失敗、token取得失敗 | `Not Verified` | 決定論的fixtureを現scopeで作らず、静的fail-closed分岐とClippyを代替確認 | 誤ったcandidate化の残存risk。OwnerはQual-Lab。Release binding着手時に実環境negative fixtureを追加 |
| `AccessCheck`失敗、insufficient-buffer再試行、最終Identity／attribute race | `Not Verified` | OS API failure／競合を固定testで発火していない | fail-closed実装の見落としrisk。OwnerはQual-Lab。Release bindingまたはcoverage toolchain変更時にfault injectionを再判断 |
| stdout write失敗とexit 3 | `Not Verified` | bounded outputは固定だがpipe failureを発火していない | process manager実装時にbroken-pipe試験を追加。OwnerはQual-Lab |

未到達義務をcomponent候補の完全Security成立へ昇格しない。Release binding前のproduction入口はprocess／Path／Filesystemへ触れる前に停止するため、残存verification riskを本番Authority、CapabilityまたはEffectへ流用しない。

### `cc52011`独立監査集合

固定Commit `cc52011d37394ac0cbd2883fc6a1172935a5fc07`、Tree `6052a644c251930fe1700211a48a514005bb0ff5`、Parent `3e9b20b59c7b75f245f4ae3da1555709b71c4fdd`では、Agent／Architecture／Security ReviewがMajor 2件、Document AuditがMajor 2件、Gap / Impact AuditがMajor 3件＋Minor 1件、Conformance Auditが`Fail`を返した。集合全体は`Invalidated`であり、現在の合否または是正後の解消根拠へ流用しない。

指摘は、Root object上の`DELETE`と親経由削除の混同、`target`除外のsymbolic boundary、Rust命名正本の矛盾、CHG状態、README伝播、検証義務／coverageおよび専門探索記録に関するものだった。統合処置は`Applied`／`Self-checked`であり、新固定版の全機械確認と同じAgent／Architecture／Security Review、Document Audit、Gap / Impact AuditおよびConformance Auditが完了するまでは`Resolved`ではない。

本変更はRust Coreのcomponent候補までである。Release binary Identity binding、production process管理、bounded stdin／stdout／timeoutの実接続、Windows全tree／writer排他確認、Protection Hash、DACL mutation、Platform Provisioner Effect、Runtime reader、POSIX、initial Trust、activationおよびRelease artifact組込みは未実装・未評価である。これらが成立する前は本番利用を有効化しない。

本処置は`Applied`かつ`Self-checked`であり、同一固定Commit／Treeに対するAgent／Architecture／Security Review、Document Audit、Gap / Impact AuditおよびConformance Auditが完了するまでは`Resolved`ではない。確認完了は採用、統合、準拠、Stable化またはRelease判断を代替しない。v0.18は`Candidate`、Released Baselineはv0.17.0のままである。
