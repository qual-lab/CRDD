# CHG-000036 Minimum Trust Boundary実装・検証記録

- 対象変更: [`CHG-000036`](../CHG-000036_AppContainer_Provision_Worker_Candidate.md)
- 記録種別: `implementation_and_verification_run`
- 直前の記録: [`062294bb`記録](CHG-000036_Verification_Run_Record_062294bb.md)
- それ以前の履歴: [`0de33481`記録](CHG-000036_Verification_Run_Record_0de33481.md)、[`2a671485`記録](CHG-000036_Verification_Run_Record_2a671485.md)、[`87c35af6`記録](CHG-000036_Verification_Run_Record_87c35af6.md)
- 実行日: 2026-08-23（Asia/Tokyo）
- Git HEAD: `38f6a310ff6d00d9479674fe268985dbfc7dd443`
- tracked diff blob: `ec586890f73406c10c78fa47e3459e42575f96fd`
- 未追跡CHG SHA-256: `99c9c6c735f722050864fe10ad7b1bd96fd96e659b2167fd4ac203540b68bb96`
- 未追跡build.rs SHA-256: `70c236fa3fb6387d457bebb7fa55decf91447564f5bb546adae0b44007f9c8e5`
- 直前記録の履歴化SHA-256: `062294bb9b5b6601d6bb03c6b4757c5dfda9f148d806d04ebf172889456b35f3`
- 本記録自身を除くdirty／untracked 46 file manifest: UTF-8の`repository-relative-path<TAB>lowercase-sha256<LF>`をpath昇順で5,623 byte、SHA-256 `4bb174194b4f7a83fbf7fecb1cdc87e4023ec1ff90070eafd49a2e18bc967b62`。履歴Evidence 4件、CHG、build.rsを含み、Git-ignored fileと本記録自身は含めない。
- 状態: Coordinator Runtime 1.0の最小信頼境界（Minimum Trust Boundary）を正本、脅威モデル、契約、native supervisorへ反映した検証済みcomponent候補。採用、統合、Release、Gate openまたは実Provider起動の成立記録ではない。

## 採用内容

正常なOS、OS認証済みの選択ローカルユーザー、人間が真正性を確認して明示起動した公式署名済みCRDD Releaseをv1の信頼基盤（Trusted Computing Base）とした。同一ローカルユーザー、Administrator／SYSTEM、Kernel／OSまたはVerifier自体を改変できる攻撃者への完全なTamper Resistanceはv1対象外とし、将来のHardened／Managed Profileで再評価する。

この境界変更により、実行中Supervisorのmapped imageを同一プロセス自身が不可分に自己証明する専用blockerはproduction entrypointから除去した。旧`SUPERVISOR_IMAGE_BLOCKED`結果はrevision 2互換用に予約し、新しいproduction経路では発生させない。Manifest署名、成果物Hash、固定Publisher Authenticode、非reparse path chain、同一handle byte／Hash確認、worker binding、AppContainer、Network capability除去、Job、named pipe、timeout／cleanup、Authority、RevisionおよびFail Closedは維持した。

## 実行結果

- TypeScript契約試験: `npm.cmd run test`、436 passed、0 failed。PE fixtureのimport集合更新後にfixture SHA期待値を同期し、最終runで全件合格した。
- TypeScript型検査: `npm.cmd run typecheck`、合格。
- Biome lint: `npm.cmd run lint`、153 files、warning 0。
- Biome format: `npm.cmd run format:check`、152 files、差分なし。
- Rust format: `npm.cmd run platform-access:format:check`、合格。
- Rust試験: `npm.cmd run platform-access:test`、16 passed、0 failed。
- Rust native supervisor Clippy: `npm.cmd run platform-access:native-bootstrap-lint`、warning 0。
- Rust worker Clippy: `npm.cmd run platform-access:worker-lint`、warning 0。
- native build: `npm.cmd run platform-access:native-bootstrap-build`、固定Rust `1.94.1-x86_64-pc-windows-msvc`で合格。
- native PE: `npm.cmd run platform-access:native-bootstrap-pe`、2 build byte-identical。Supervisor SHA-256 `787ca34afc73be3e6863f7e7d70aaabd28615f8ddc7cf5f6bcce909be4795dfa`、91,136 byte。Worker SHA-256 `82e466bdd330ba9d111375aaf4b0e7fdcce443bdf055769c3f3a2b850a86dd95`、139,264 byte。x86-64 Console、ASLR／NX、固定6 DLL／固定import集合、delay／TLS／bound／CLR directory 0、Worker Hash binding、同一file実行前後Identity、直接Network import 0を確認した。
- Rust coverage: `npm.cmd run platform-access:coverage`、region 1,601／2,075（77.16%）、function 76／92（82.61%）、line 1,108／1,399（79.20%）。release-only `no_std/no_main` Supervisor entrypointは安定toolchainでinstrumentできないため対象外とし、release Clippy、strict PE、実成果物CLIおよびsource reviewで代替した。stable toolchainのbranch coverage capabilityは利用不可。
- TypeScript coverage: `npm.cmd run platform-access:ts-coverage`、line 7,576／8,520、function 268／292、branch 1,200／1,464。未到達分岐は既存のobligationへ理由、risk、代替検証、owner、再確認契機を保持した。
- `git diff --check`: error 0。改行変換予告だけで、whitespace errorはない。

PE検査の初回runは、既存Supervisorが使用するProcess／Job／Named Pipe API群と固定import allowlistの未同期を検出してfail closedになった。実PEのimport表とsource使用箇所を照合し、許可リストを実際に必要な34個の`KERNEL32.dll` symbolへ限定して同期した。未知DLL、動的import、Network APIまたは汎用的な許可は追加していない。修正後の再現buildと全契約試験で再確認した。

Evidence固定後のfull checkerは親エージェントの共通監査入力として一度実行し、本記録へ循環的に結果を書き戻さない。本記録またはdirty manifest、実装、試験、coverage script、脅威境界の意味が変わった場合、この実行結果を流用せず新しい改訂版を固定する。

## 安全状態と未完了

- v1 mapped supervisor自己結合: Minimum Trust Boundaryでは必須としない。未解決riskはHardened／Managed Profileへ保持。
- unsigned／非公式またはPublisher不一致のlocal buildによるworker spawn: 0。固定正式署名条件が成立しない限りfail closed。
- worker Process Effect: 検証runではfalse。
- operational Filesystem Effect: false。PE harness用temporary filesystemだけ使用。
- bootstrap processの実Network Effect: 未検証。静的PE direct Network importは0で、production network capability除去をsource／contractで保持。
- 正式Ed25519 manifest／Authenticode成果物を使った同一runのJob／tree／module／Network確認: 未完了。
- protected active pointer、Provider Home、Mount Grant issuer／store／clock／revoke、Claude公式配布・利用条件、egress、OAuth／quota、one-way probe: 未完了。
- normal Runtime Gate、Authority／Capability、Claude Code起動: blockedのまま。
- 検証用証明書のCurrentUser Root／TrustedPublisher登録、API key、従量API fallback、追加Credit購入、installer、commit、merge、Release: 実行していない。

正式署名材料または、目的・期間・追加／除去対象・残存riskを特定した別の人間承認なしにTrust Storeを変更しない。今回の採用はv1 Threat Boundaryの決定であり、保護対象変更の統合、Releaseまたは残存riskの最終受容を自動的に成立させない。
