# CHG-000036 最小信頼境界（Minimum Trust Boundary）実装・検証記録

- 対象変更: [`CHG-000036`](../CHG-000036_AppContainer_Provision_Worker_Candidate.md)
- 記録種別: `implementation_and_verification_run`
- 直前の記録: [`216afd45`記録](CHG-000036_Verification_Run_Record_216afd45.md)
- それ以前の履歴: [`062294bb`記録](CHG-000036_Verification_Run_Record_062294bb.md)、[`0de33481`記録](CHG-000036_Verification_Run_Record_0de33481.md)、[`2a671485`記録](CHG-000036_Verification_Run_Record_2a671485.md)、[`87c35af6`記録](CHG-000036_Verification_Run_Record_87c35af6.md)
- 実行日: 2026-08-23（Asia/Tokyo）
- Git HEAD: `38f6a310ff6d00d9479674fe268985dbfc7dd443`
- tracked diff blob: `092dfde20675bb07b9cd467cd4a2f30f6f07eed8`
- 未追跡CHG SHA-256: `a240fc025e90d10e66927063e426b9f0d06e101e3bf0022ed94adc82935c5173`
- 未追跡build.rs SHA-256: `70c236fa3fb6387d457bebb7fa55decf91447564f5bb546adae0b44007f9c8e5`
- 直前記録の履歴化SHA-256: `216afd4520b42170a663fbfa6e3bc83e9e7b9b51c4011b3949109331ba26eaed`
- 本記録自身を除くdirty／untracked 47 file manifest: UTF-8の`repository-relative-path<TAB>lowercase-sha256<LF>`をpath昇順で5,763 byte、SHA-256 `9b2f91e4faff8887a4b08132cafc3b3fa48db8ec7e5a9d914ac7cb4f34f4dac8`。履歴Evidence 5件、CHG、build.rsを含み、Git-ignored fileと本記録自身は含めない。
- 状態: Coordinator Runtime 1.0の最小信頼境界を正本、脅威モデル、契約、native supervisorへ反映した検証済みcomponent候補。統合、Release、Gate openまたは実Provider起動の成立記録ではない。

## 採用内容

正常なOS、OS認証済みの選択ローカルユーザー、人間が真正性を確認して明示起動した公式署名済みCRDD Releaseをv1の信頼計算基盤（Trusted Computing Base、TCB）とした。同一ローカルユーザー、Administrator／SYSTEM、Kernel／OSまたはVerifier自体を改変できる攻撃者への完全なTamper Resistanceはv1対象外とし、将来の強化／管理対象プロファイル（Hardened／Managed Profile）で再評価する。

この境界変更により、実行中Supervisorのmapped imageを同一process自身が不可分に自己証明する専用blockerはproduction entrypointから除去した。旧`SUPERVISOR_IMAGE_BLOCKED`結果はrevision 2互換用に予約し、新しいproduction経路では発生させない。Manifest署名、成果物Hash、固定Publisher Authenticode、非reparse path chain、同一handle byte／Hash確認、worker binding、AppContainer、Network capability除去、Job、named pipe、timeout／cleanup、Authority、RevisionおよびFail Closedは維持した。

## 固定実行環境

全commandの作業directoryは`C:\project\CRDD\tools\coordinator`である。`package.json`は3,480 byte、SHA-256 `e60d794ea37e84575ede5d8c9b1232511f1cb7bf64890e42c9f0cbba5d69166e`。

| 実体 | version | byte | SHA-256 |
| --- | --- | ---: | --- |
| `C:\Program Files\nodejs\node.exe` | `v22.18.0` | 85,202,416 | `c22d1c59a1f767a1ed0178445a027f2257d318c55430fc819d48f269586822b7` |
| `C:\Program Files\nodejs\npm.cmd` | `10.9.3` | 538 | `21b46c69ad6e2f231f02a9e120f4ba6c8e75fef5a45637103002eab99f888ab8` |
| `C:\Users\nakas\.rustup\toolchains\1.94.1-x86_64-pc-windows-msvc\bin\rustc.exe` | `rustc 1.94.1 (e408947bf 2026-03-25)` | 111,104 | `21256c9767416cbc70120e7987449c6cc5a66e3e9f843d05392ee4fd5e617261` |
| `C:\Users\nakas\.rustup\toolchains\1.94.1-x86_64-pc-windows-msvc\bin\cargo.exe` | `cargo 1.94.1 (29ea6fb6a 2026-03-24)` | 30,737,408 | `43226f7efc5ea12b88c9156da97f8954b9af582673baadb3fb1a3ebec5d97348` |

## suiteと成果物検証

2026-08-23T02:21:01.701Zから02:21:14.102Zまで、次のexact argvを同じ固定版で実行し、すべてexit 0とした。

- `npm.cmd run test`: TypeScript契約試験436 passed、0 failed。
- `npm.cmd run typecheck`: strict source／test TypeScript検査合格。
- `npm.cmd run lint`: Biome、153 files、warning 0。
- `npm.cmd run format:check`: Biome、152 files、差分なし。
- `npm.cmd run platform-access:test`: Rust 16 passed、0 failed。
- `npm.cmd run platform-access:format:check`: Rust format合格。
- `npm.cmd run platform-access:native-bootstrap-lint`: release native supervisor Clippy、warning 0。
- `npm.cmd run platform-access:worker-lint`: worker Clippy、warning 0。

2026-08-23T02:21:18.177Zから02:21:34.492Zまで`npm.cmd run platform-access:native-bootstrap-pe`を実行しexit 0とした。固定Rust `1.94.1-x86_64-pc-windows-msvc`による2 buildはbyte-identicalで、Supervisor SHA-256 `787ca34afc73be3e6863f7e7d70aaabd28615f8ddc7cf5f6bcce909be4795dfa`、91,136 byte、Worker SHA-256 `82e466bdd330ba9d111375aaf4b0e7fdcce443bdf055769c3f3a2b850a86dd95`、139,264 byteだった。x86-64 Console、ASLR／NX、固定6 DLL／固定import集合、delay／TLS／bound／CLR directory 0、Worker Hash binding、同一file実行前後Identity、直接Network import 0を確認した。MSVC linker Identityと既存local Cargo cacheのsupply-chain Identityは未検証である。

PE検査の初回runは、既存Supervisorが使用するProcess／Job／Named Pipe API群と固定import allowlistの未同期を検出してfail closedになった。実PEのimport表とsource使用箇所を照合し、許可リストを実際に必要な34個の`KERNEL32.dll` symbolへ限定して同期した。未知DLL、動的import、Network APIまたは汎用的な許可は追加していない。修正後の再現buildと全契約試験で再確認した。

## coverageの再取得性

Rust coverage生成器[`check-platform-access-coverage.ts`](../../../tools/coordinator/scripts/check-platform-access-coverage.ts)は9,368 byte、SHA-256 `99ce72a51d0510bf1d194839f3bcfcec6bb41cc4efbc9036c7f6f490e670e30c`である。exact argvは`node.exe scripts/check-platform-access-coverage.ts`。stdoutの最後にある`{`＋LF＋2 space＋`"toolchain"`から最終`}`＋LFまでをUTF-8 payloadとして抽出した。

- run 1: 2026-08-23T02:20:35.5552246Zから02:20:43.5292633Z、exit 0、payload 3,250 byte、SHA-256 `7e7e1c22dcf1aeec54125b06d771f3bb7a0e262e9c67eaddaf86bfb3b643cd66`。
- run 2: 2026-08-23T02:20:43.5869198Zから02:20:52.4258559Z、exit 0、payload 3,250 byte、同じSHA-256。
- 2 payloadはbyte-identical。6 sourceと1 excluded sourceを全数含む。region 1,602／2,075（77.20%）、function 76／92（82.61%）、line 1,109／1,399（79.27%）、stable toolchainのbranch母集団0。
- release-only `no_std/no_main` Supervisor entrypointは安定toolchainでinstrumentできず、理由、risk、代替検証、owner、人間判断、再確認契機をpayloadのexcluded sourceへ保持する。release Clippy、strict PE、実成果物CLIおよびsource reviewで代替する。

TypeScript coverage生成器[`check-platform-access-ts-coverage.ts`](../../../tools/coordinator/scripts/check-platform-access-ts-coverage.ts)は26,050 byte、SHA-256 `c6a8ed5b8fe421df19cf272fc1dae303626f641d08d2586ca18cb9e4fb6b5066`である。exact argvは`node.exe scripts/check-platform-access-ts-coverage.ts`。生成器自身のcompact JSON＋末尾LFをそのままUTF-8 payloadとした。

- run 1: 2026-08-23T02:20:02.8234731Zから02:20:07.5949147Z、exit 0、payload 161,285 byte、SHA-256 `416a60b926e9ec6251d44a2204bd279145e94970fd32b7f59a1da3e5953031a1`。
- run 2: 2026-08-23T02:20:07.6941206Zから02:20:11.9244286Z、exit 0、payload 161,285 byte、同じSHA-256。
- 2 payloadはbyte-identical。24 sourceの各line／function／branch分子・分母と未到達branch 271件を全数含む。aggregateはline 7,588／8,532、function 268／292、branch 1,191／1,462。
- 各未到達branchはpayload内でsource、line、block、branchと、reason、risk、alternative verification、owner、human decision、recheckを持つ。固定生成器とpayload Identityにより全数を再生成・照合できる。

coverage値は直前記録から流用せず、新しい固定版の実測値を記録した。生成器が専用temporary targetを使う以外にoperational Filesystem Effectはなく、正式署名、Trust Store、Network、ProviderまたはCredentialへ触れていない。

## 安全状態と未完了

- mapped supervisor imageの原子的自己結合: 未成立riskだが、最小信頼境界ではv1必須条件としない。方式成立またはVerified Imageを主張しない。
- production sourceの専用blocker: 除去済み。旧結果はrevision 2互換用の予約値だけを保持する。
- 今回の正式署名条件が成立しない検証run: worker spawn試行0、Process Effect false、operational Filesystem Effect false。
- bootstrap processの実Network Effect: 未検証。静的PE direct Network importは0で、production network capability除去をsource／contractで保持する。
- 正式Ed25519 manifest／Authenticode成果物を使った同一runのPA03／PR03、Job／tree／module／Network確認: 未完了。
- selected-user binder、protected active pointer、Provider Home、Mount Grant issuer／store／clock／revoke、Claude公式配布・利用条件、egress、OAuth／quota、one-way probe: 未完了。
- normal Runtime Gate、Authority／Capability、Claude Code起動: blockedのまま。
- 検証用証明書のCurrentUser Root／TrustedPublisher登録、API key、従量API fallback、追加Credit購入、installer、commit、merge、Release: 実行していない。

Evidence固定後のfull checkerは親エージェントの共通監査入力として一度実行し、本記録へ循環的に結果を書き戻さない。本記録またはdirty manifest、実装、試験、coverage生成器、脅威境界の意味が変わった場合、この実行結果を流用せず新しい改訂版を固定する。

正式署名材料または、目的・期間・追加／除去対象・残存riskを特定した別の人間承認なしにTrust Storeを変更しない。今回の採用はv1 Threat Boundaryの決定であり、保護対象変更の統合、Releaseまたは残存riskの最終受容を自動的に成立させない。
