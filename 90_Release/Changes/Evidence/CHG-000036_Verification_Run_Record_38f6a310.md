# CHG-000036 最小信頼境界（Minimum Trust Boundary）実装・検証記録（38f6a310）

- 対象変更: [`CHG-000036`](../CHG-000036_AppContainer_Provision_Worker_Candidate.md)
- 記録種別: `implementation_and_verification_run`
- 直前の記録: [`2ce29c02`記録](CHG-000036_Verification_Run_Record_2ce29c02.md)
- それ以前の履歴: [`76b90bcc`記録](CHG-000036_Verification_Run_Record_76b90bcc.md)、[`0ef4f73b`記録](CHG-000036_Verification_Run_Record_0ef4f73b.md)、[`216afd45`記録](CHG-000036_Verification_Run_Record_216afd45.md)、[`062294bb`記録](CHG-000036_Verification_Run_Record_062294bb.md)、[`0de33481`記録](CHG-000036_Verification_Run_Record_0de33481.md)、[`2a671485`記録](CHG-000036_Verification_Run_Record_2a671485.md)、[`87c35af6`記録](CHG-000036_Verification_Run_Record_87c35af6.md)
- 実行日: 2026-08-23（Asia/Tokyo）
- Git HEAD: `38f6a310ff6d00d9479674fe268985dbfc7dd443`
- tracked diff blob: `94820423a7f534200b6ddb00542ce2456b01523e`
- 未追跡CHG SHA-256: `1fabfaa8df8a5370b3cdade83400b176b4e056e530c1082df813f37c59a33f08`
- 未追跡build.rs SHA-256: `70c236fa3fb6387d457bebb7fa55decf91447564f5bb546adae0b44007f9c8e5`
- 直前記録の履歴化SHA-256: `2ce29c020398e555b59c8ee2d67b2f5473b8eba73d526e21c464a04a9a659720`
- 本記録自身を除くdirty／untracked 50 file manifest: UTF-8の`repository-relative-path<TAB>lowercase-sha256<LF>`をpath昇順で6,183 byte、SHA-256 `e2919a4e72e64588b9deea63f920c2d9e5fa74c532ce6ef11cba8d501a095a6a`。履歴Evidence 8件、CHG、build.rsを含み、Git-ignored fileと本記録自身は含めない。
- 状態: Coordinator Runtime 1.0の最小信頼境界を正本、脅威モデル、契約、native supervisorへ反映し、Repository基準Node.jsで検証したcomponent候補。統合、Release、Gate openまたは実Provider起動の成立記録ではない。

## 採用内容

正常なOS、OS認証済みの選択ローカルユーザー、人間が真正性を確認して明示起動した公式署名済みCRDD Releaseをv1の信頼計算基盤（Trusted Computing Base、TCB）とした。同一ローカルユーザー、Administrator／SYSTEM、Kernel／OSまたはVerifier自体を改変できる攻撃者への完全なTamper Resistanceはv1対象外とし、将来の強化／管理対象プロファイル（Hardened／Managed Profile）で再評価する。

実行中Supervisorのmapped imageを同一process自身が不可分に自己証明する専用blockerはproduction entrypointから除去した。旧`SUPERVISOR_IMAGE_BLOCKED`結果はrevision 2互換用に予約し、新しいproduction経路では発生させない。Manifest署名、成果物Hash、固定Publisher Authenticode、非reparse path chain、同一handle byte／Hash確認、worker binding、AppContainer、Network capability除去、Job、named pipe、timeout／cleanup、Authority、RevisionおよびFail Closedは維持した。

## 固定実行環境

全commandの作業directoryは`C:\project\CRDD\tools\coordinator`である。[Node.js v24.12.0公式archive](https://nodejs.org/download/release/v24.12.0/node-v24.12.0-win-x64.zip)を一時領域へ取得し、同版の公式[`SHASUMS256.txt`](https://nodejs.org/download/release/v24.12.0/SHASUMS256.txt)と照合した。2026-08-23T02:35:25.9997717Zから02:35:26.6675071Zまでのlive再確認でarchiveはHTTP 200、公式行とlocal算出値はともにSHA-256 `9c125f61ae947b52e779095830f9cac267846a043ef7192183c84016aaad2812  node-v24.12.0-win-x64.zip`で一致した。installer、system Node、Repository内容または環境の永続設定は変更していない。

| 実体 | version | byte | SHA-256 |
| --- | --- | ---: | --- |
| `C:\Users\nakas\AppData\Local\Temp\crdd-node-v24.12.0\portable-9c125f61\node-v24.12.0-win-x64\node.exe` | `v24.12.0` | 89,935,872 | `2ffe3acc0458fdde999f50d11809bbe7c9b7ef204dcf17094e325d26ace101d8` |
| `C:\Users\nakas\AppData\Local\Temp\crdd-node-v24.12.0\portable-9c125f61\node-v24.12.0-win-x64\node_modules\npm\bin\npm-cli.js` | `11.6.2` | 56 | `3ce7cba6f5128dd5f54c98b6a5036b0f850496878cc2e21044b675fe3c594e3e` |
| `C:\Users\nakas\.rustup\toolchains\1.94.1-x86_64-pc-windows-msvc\bin\rustc.exe` | `rustc 1.94.1 (e408947bf 2026-03-25)` | 111,104 | `21256c9767416cbc70120e7987449c6cc5a66e3e9f843d05392ee4fd5e617261` |
| `C:\Users\nakas\.rustup\toolchains\1.94.1-x86_64-pc-windows-msvc\bin\cargo.exe` | `cargo 1.94.1 (29ea6fb6a 2026-03-24)` | 30,737,408 | `43226f7efc5ea12b88c9156da97f8954b9af582673baadb3fb1a3ebec5d97348` |

各npm runはportable directoryを`PATH`先頭へ固定し、上記`node.exe`から上記`npm-cli.js`を直接起動した。確認値は`process.execPath`が同じportable `node.exe`、`process.version`が`v24.12.0`、child processの`PATH`先頭も同じportable directoryである。`package.json`の`engines.node >=24.12`、`.node-version`の`24.12.0`およびMaintenanceの基準と一致する。private doctor reportVersion 9も`24.12.0`以上だけを受理し、`22.18.0`、`24.11.99`および不正version表現を拒否する契約試験を追加した。

## suiteと成果物検証

2026-08-23T02:30:24.102Zから02:30:53.759Zまで、`<node.exe> <npm-cli.js> run <script>`の形で次のscriptを同じ固定版へ実行し、すべてexit 0とした。

- `test`: TypeScript契約試験437 passed、0 failed。
- `typecheck`: strict source／test TypeScript検査合格。
- `lint`: Biome、153 files、warning 0。
- `format:check`: Biome、152 files、差分なし。
- `platform-access:test`: Rust 16 passed、0 failed。
- `platform-access:format:check`: Rust format合格。
- `platform-access:native-bootstrap-lint`: release native supervisor Clippy、warning 0。
- `platform-access:worker-lint`: worker Clippy、warning 0。
- `platform-access:native-bootstrap-pe`: exit 0。下記の直接runでも同じ成果物Identityを再確認した。

2026-08-23T02:31:15.2145360Zから02:31:36.3423295Zまで、portable `node.exe scripts/check-native-bootstrap-pe.ts`を直接実行した。2 buildはbyte-identicalで、Supervisor SHA-256 `787ca34afc73be3e6863f7e7d70aaabd28615f8ddc7cf5f6bcce909be4795dfa`、91,136 byte、Worker SHA-256 `82e466bdd330ba9d111375aaf4b0e7fdcce443bdf055769c3f3a2b850a86dd95`、139,264 byteだった。x86-64 Console、ASLR／NX、固定6 DLL、固定34 `KERNEL32.dll` symbolを含むexact import集合、delay／TLS／bound／CLR directory 0、Worker Hash binding、同一file実行前後Identity、直接Network import 0を確認した。MSVC linker Identityと既存local Cargo cacheのsupply-chain Identityは未検証である。

PE検査の初回runは、既存Supervisorが使用するProcess／Job／Named Pipe API群と固定import allowlistの未同期を検出してfail closedになった。実PEのimport表とsource使用箇所を照合し、実際に必要なexact集合へ同期した。未知DLL、動的import、Network APIまたは汎用的な許可は追加していない。

## Authenticode軸の一時署名検証

2026-08-23T22:03:59+09:00までに、人間が目的、期間、対象Storeおよび同一run内rollbackを承認したCurrentUser限定検証を実行した。OSの永続Key Storage Providerを使わず、RSA 3072-bit秘密鍵とCode Signing EKU付き自己署名証明書をprocess memory内だけに生成した。公開証明書だけを`CurrentUser\Root`と`CurrentUser\TrustedPublisher`へ一時登録し、証明書DERのSHA-256 `0811341f4673bd2717506e327b67ed1a9b26d3ae1d19cfdc49348acaeddef0f0`をbuild時の固定publisher値としてSupervisorへ埋め込み、同じ秘密鍵でSHA-256 Authenticode署名した。

- 署名済みSupervisorは91,136 byteの署名前候補を基に生成し、署名後SHA-256は`b70a5894c0e80f67d7cbfddac199faacfee33787af6b10e7a3b95ad1119b5927`だった。
- `Set-AuthenticodeSignature`と`Get-AuthenticodeSignature`は信頼登録中にともに`Valid`を返した。signer certificateは存在し、検証結果のthumbprintは生成証明書と一致した。
- build時固定publisher SHA-256のASCII 64-byte列は署名済みPE内にexact 1件存在した。これは埋込み値の存在を示すが、正式Manifestと同じrunでnative `WinVerifyTrust`分岐へ到達した証明ではない。
- private keyは永続化せず、timestampおよびNetwork Effectは使用しなかった。検証終了時に`CurrentUser\Root`と`CurrentUser\TrustedPublisher`から同一thumbprintを削除し、`CurrentUser\My`を含む3 Storeの残存証明書数0を確認した。削除後もPE署名とsigner情報は残るが、信頼chainがないためPowerShell検査は期待どおり`UnknownError`へ戻った。
- 検証値を取得した後、一時署名PEをbuild cacheへ残さず、publisher未設定の通常buildで同じtargetを上書きした。最終開発成果物は`NotSigned`、91,136 byte、SHA-256 `787ca34afc73be3e6863f7e7d70aaabd28615f8ddc7cf5f6bcce909be4795dfa`へ戻り、全ゼロpublisherによるfail-closed既定値を保持する。
- 最初に試した`New-SelfSignedCertificate`の永続Key Storage経路は`ERROR_FILE_NOT_FOUND`で証明書生成前に失敗した。Trust Store変更および残存証明書は0だったため、永続鍵格納directory、installer、machine-wide Storeまたは管理者設定を追加せず、メモリ内鍵へ限定した。

この結果により、固定publisher fingerprintをbuildへ渡し、Authenticode署名をWindowsがCurrentUser trust下で`Valid`と判定し、検証材料をrollbackできる軸は実測済みとなった。固定Ed25519 Release秘密鍵が端末またはRepositoryに存在せず、現変更も未コミットでCommit／Treeが固定されていないため、正式Manifest生成、native entrypointでのPA03／PR03実往復、ReleaseまたはGateへは進めていない。検証用自己署名証明書を公式Publisherへ昇格せず、公開鍵または固定Release Trust Rootを差し替えていない。

## coverageの再取得性

Rust coverage生成器[`check-platform-access-coverage.ts`](../../../tools/coordinator/scripts/check-platform-access-coverage.ts)は9,368 byte、SHA-256 `99ce72a51d0510bf1d194839f3bcfcec6bb41cc4efbc9036c7f6f490e670e30c`である。exact argvはportable `node.exe scripts/check-platform-access-coverage.ts`。stdout最後の`{`＋LF＋2 space＋`"toolchain"`から最終`}`＋LFまでをUTF-8 payloadとして抽出した。

- run 1: 2026-08-23T02:31:12.4917951Zから02:31:22.8055035Z、exit 0、payload 3,250 byte、SHA-256 `7e7e1c22dcf1aeec54125b06d771f3bb7a0e262e9c67eaddaf86bfb3b643cd66`。
- run 2: 2026-08-23T02:31:22.8765824Zから02:31:31.8802922Z、exit 0、payload 3,250 byte、同じSHA-256。
- 2 payloadはbyte-identical。6 sourceと1 excluded sourceを全数含む。region 1,602／2,075（77.20%）、function 76／92（82.61%）、line 1,109／1,399（79.27%）、stable toolchainのbranch母集団0。
- release-only `no_std/no_main` Supervisor entrypointは安定toolchainでinstrumentできず、理由、risk、代替検証、owner、人間判断、再確認契機をpayloadへ保持する。release Clippy、strict PE、実成果物CLIおよびsource reviewで代替する。

TypeScript coverage生成器[`check-platform-access-ts-coverage.ts`](../../../tools/coordinator/scripts/check-platform-access-ts-coverage.ts)は26,050 byte、SHA-256 `c6a8ed5b8fe421df19cf272fc1dae303626f641d08d2586ca18cb9e4fb6b5066`である。exact argvはportable `node.exe scripts/check-platform-access-ts-coverage.ts`。compact JSON＋末尾LFをそのままUTF-8 payloadとした。

- run 1: 2026-08-23T02:31:11.4481787Zから02:31:16.4226845Z、exit 0、payload 160,747 byte、SHA-256 `100be254e34cf7f830f8d4cabdf2a3dc1cf3e4ed7cd0d3bed81f996d702b5047`。
- run 2: 2026-08-23T02:31:16.5747849Zから02:31:22.2277930Z、exit 0、payload 160,747 byte、同じSHA-256。
- 2 payloadはbyte-identical。24 sourceの各line／function／branch分子・分母と未到達branch 270件を全数含む。aggregateはline 7,595／8,539、function 269／293、branch 1,196／1,466。
- 各未到達branchはpayload内でsource、line、block、branchと、reason、risk、alternative verification、owner、human decision、recheckを持つ。固定生成器とpayload Identityにより全数を再生成・照合できる。

coverage値は履歴記録から流用せず、Repository基準Node.jsによる新しい固定版の実測値を記録した。生成器が専用temporary targetを使う以外にoperational Filesystem Effectはなく、正式署名、Trust Store、Network、ProviderまたはCredentialへ触れていない。

## 安全状態と未完了

- mapped supervisor imageの原子的自己結合: 未成立riskだが、最小信頼境界ではv1必須条件としない。方式成立またはVerified Imageを主張しない。
- production sourceの専用blocker: 除去済み。旧結果はrevision 2互換用の予約値だけを保持する。
- 今回の一時Authenticode検証run: worker spawn試行0、Process Effect false、operational Filesystem Effect false。Release staging、Manifest、ProviderまたはCredentialへ触れていない。
- bootstrap processの実Network Effect: 未検証。静的PE direct Network importは0で、production network capability除去をsource／contractで保持する。
- Authenticode軸の一時署名とWindows trust判定: 実測済み。ただし正式Ed25519 manifestと同じrunのPA03／PR03、Job／tree／module／Network確認は未完了。
- selected-user binder、protected active pointer、Provider Home、Mount Grant issuer／store／clock／revoke、Claude公式配布・利用条件、egress、OAuth／quota、one-way probe: 未完了。
- normal Runtime Gate、Authority／Capability、Claude Code起動: blockedのまま。
- 検証用証明書のCurrentUser Root／TrustedPublisher登録: 人間承認した一時runだけ実行し、同一runで削除、3 Store残存0。API key、従量API fallback、追加Credit購入、installer、commit、merge、Releaseは実行していない。

Evidence固定後のfull checkerは親エージェントの共通監査入力として一度実行し、本記録へ循環的に結果を書き戻さない。本記録またはdirty manifest、実装、試験、coverage生成器、脅威境界の意味が変わった場合、この実行結果を流用せず新しい改訂版を固定する。

今後も正式署名材料または、目的・期間・追加／除去対象・残存riskを特定した別の人間承認なしにTrust Storeを変更しない。今回の一時承認とrollback完了を、次run、公式Publisher、保護対象変更の統合、Releaseまたは残存riskの最終受容へ流用しない。
