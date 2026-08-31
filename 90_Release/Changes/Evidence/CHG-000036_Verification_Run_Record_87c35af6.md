# CHG-000036 検証実行記録

> 履歴状態: `Superseded`。これはtracked patch `87c35af6...`時点の過去記録であり、現状態の根拠には使用しない。現行記録は[`CHG-000036_Verification_Run_Record_current.md`](CHG-000036_Verification_Run_Record_current.md)である。

- 対象変更: [`CHG-000036`](../CHG-000036_AppContainer_Provision_Worker_Candidate.md)
- 対象固定識別: HEAD `38f6a310ff6d00d9479674fe268985dbfc7dd443` + tracked patch Git blob `87c35af61ecf0ee2ae8894b173ae98b5810c7253` + `tools/platform-access/build.rs` SHA-256 `70c236fa3fb6387d457bebb7fa55decf91447564f5bb546adae0b44007f9c8e5` + CHG-000036 SHA-256 `a5a749807615403ea6e6fef99873c17f6ad286d837e2e0085d1fba7565ff447f`
- 実行日: 2026-08-23
- 実行環境: Windows NT 10.0.26200.0、PowerShell 7.6.4、Node.js 24.19.0（全試験・TypeScript coverage）、Rust/Cargo 1.94.1 `x86_64-pc-windows-msvc`
- 実行Root: `C:\project\CRDD`、Coordinator commandは`C:\project\CRDD\tools\coordinator`
- 判定: 実装・静的検証・未署名fail-closedは合格。正式署名実run、実module集合およびNetwork非発火は未検証で、Release／Gateは停止を維持する。

## 実行結果

| 検証 | 結果 | 根拠 |
| --- | --- | --- |
| Coordinator全契約試験 | Pass | Node.js 24.19.0で436/436件合格 |
| TypeScript typecheck／Biome lint／format | Pass | `npm.cmd run check`、warning 0 |
| Rust試験 | Pass | `npm.cmd run platform-access:test`、unit 9件、CLI 1件、native core 5件の計15件合格 |
| Rust Clippy／format | Pass | workerとrelease supervisorの`-D warnings`、`cargo fmt --check`合格 |
| clean release build再現性 | Pass | 相互に独立したtarget Root 2件でsupervisorとworkerがそれぞれbyte一致 |
| native PE exact policy | Pass | x64/CUI、ASLR/NX、exact 6 DLL API集合、delay import/TLS/bound import/CLR 0、worker binding一致 |
| CRDD checker | Pass | 全Repository、355 Markdown、local link 2037、error 0、warning 0。独立監査開始直前に固定改訂版へ再実行する |
| AppContainer profile読取り | Pass | current local userでmoniker、表示名、SIDを読取り確認。作成・変更・削除なし |
| 正式署名PA03／PR03実往復 | Not Verified | 承認済みAuthenticode publisher証明書と正式Ed25519 manifest署名工程が作業環境にない。信頼ストア変更を迂回していない |
| 実run module集合／Network非発火 | Not Verified | 正式署名runが開始条件。static import 0や`networkEffectIssued:false`を実観測へ読み替えていない |

## 成果物Identity

- supervisor: 76,288 byte、SHA-256 `60d22824e66a96a0d1defab62de30d148fd80017048097d4188842255a3d3bf6`
- worker: 137,216 byte、SHA-256 `9c8027157dc388f12e18f6b816c42c6a29ca2df0c3fedfdbbb32ea31998fd9bb`
- supervisorの非実行・非書込みsectionにあるworker bindingはworker SHA-256と一致する。
- Cargo: 30,737,408 byte、SHA-256 `43226f7efc5ea12b88c9156da97f8954b9af582673baadb3fb1a3ebec5d97348`
- rustc: 111,104 byte、SHA-256 `21256c9767416cbc70120e7987449c6cc5a66e3e9f843d05392ee4fd5e617261`
- dependency sourceは既存local Cargo cacheで、supply-chain verificationは別に未確認である。MSVC linker Identityも未確認である。

## Coverage

- Rust instrument対象: region 1559/1807（86.28%）、function 69/78（88.46%）、line 1041/1171（88.90%）。固定stable toolchainのbranch分母は0であり率へ換算しない。
- release-only `src/bin/coordinator.rs`: `Not Instrumented`。`no_std`／`no_main` production contractを変えずstable test profileへlinkできないため、release Clippy、exact PE検査、real artifact CLI、再現buildおよび独立Security Reviewを代替確認にする。OwnerはQual-Lab、entrypoint、Win32 import、linker argv、署名・Job・pipe境界またはstable coverage能力変更時に再確認する。
- TypeScript対象: line 7582/8526、function 268/292、branch 1191/1462。未到達箇所はcoverage出力のSecurity Decision Obligationへ、理由、risk、代替確認、Owner、再確認契機を個別保持した。
- 100%未達を合格率で隠さない。特に正式署名runtime、Win32 failure全組合せ、実module、Network、panic／partial writeはcoverage測定済みとしない。

## Effectと回復

- build、試験およびprofile読取り以外にRuntime Authority、Capability、Provisioning Filesystem EffectまたはNetwork Effectを発行していない。
- clean buildは専用target Rootだけを使用した。正式署名staging、active state、DACLまたはprofileを変更していない。
- worker process生成前にJobを作成し、create-time Job list、active process上限1、kill-on-close、hard timeout終了および終了後active process 0を要求する実装候補である。回収不明は`manualRecoveryRequired:true`へ閉じるが、正式署名runでの実証は未完了である。

## 残存riskと再確認

- 正式署名実run、実module集合およびNetwork非発火: Owner Qual-Lab。承認済みRelease候補、publisher certificate、正式manifest、隔離観測手順が揃った時点で再確認する。
- Authenticode signer TrustまたはCurrentUser Root／TrustedPublisher変更: 人間の決定権限が必要。対象、目的、期間、除去、残存riskを承認せず自動実行しない。
- 既存AppContainer profile: Owner Qual-Lab。SID、moniker、current local user、ownerまたはcapability方針変更時に再評価する。Coordinatorによる作成・修復・削除は非対象である。
- Cargo cache supply chainとMSVC linker Identity: Owner Qual-Lab。正式Release build環境を固定するときに確認する。
- Release、Gate open、Claude Code実行、保護対象の採用・統合および残存risk受容は、この記録から許可されない。
