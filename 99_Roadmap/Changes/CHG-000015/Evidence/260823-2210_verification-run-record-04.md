# CHG-000036 検証実行記録

- 対象変更: [`CHG-000036`](../CHG-000036_AppContainer_Provision_Worker_Candidate.md)
- 置換関係: [`87c35af6`記録](CHG-000036_Verification_Run_Record_87c35af6.md)を履歴化し、本記録をcurrentとする。
- 実行日: 2026-08-23（Asia/Tokyo）
- 作業Directory: `C:\project\CRDD`（Coordinator commandは`C:\project\CRDD\tools\coordinator`）
- Git HEAD: `38f6a310ff6d00d9479674fe268985dbfc7dd443`
- tracked diff blob: `86bd6ebe5b3c7706708d447b6f6688a2fd721237`
- 未追跡CHG SHA-256: `91294243d654d2d9a17fb25f6b750ca6fe0e3a661fc307ca408458ad9f06b3c0`
- 未追跡build.rs SHA-256: `70c236fa3fb6387d457bebb7fa55decf91447564f5bb546adae0b44007f9c8e5`
- 本記録自身を除くdirty／untracked 41 file manifest: UTF-8の`repository-relative-path<TAB>lowercase-sha256<LF>`をpath昇順で4,934 byte、SHA-256 `b0dd148cf3aed461f496a940356d843c7daa9518753f2c322ca16004a7b0829d`。旧Evidence、CHG、build.rsを含み、Git-ignored fileと本記録自身は含めない。
- 状態: 検証済みcomponent候補。採用、統合、Release、Gate openまたはoperational one-shotの成立記録ではない。

## 実行結果

| 確認 | exact command | 結果 |
|---|---|---|
| TypeScript全契約試験 | `C:\Users\nakas\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe --test ./tests/*.test.ts` | cwd Coordinator、2026-08-22T23:49:42.9922261Z～23:49:50.3058288Z、exit 0、436 passed、0 failed |
| TypeScript静的確認 | `C:\Program Files\nodejs\npm.cmd run check` | cwd Coordinator、2026-08-22T23:49:57.0827170Z～23:50:02.0024938Z、exit 0、strict／test typecheck、Biome lint 153 files、format 152 files |
| Rust format | `cargo fmt --manifest-path ..\platform-access\Cargo.toml --all -- --check` | cwd Coordinator、Rust試験直前、exit 0 |
| Rust試験 | `C:\Program Files\nodejs\npm.cmd run platform-access:test` | cwd Coordinator、2026-08-22T23:51:25.3200203Z～23:51:27.1656794Z、exit 0、supervisor manifest 1、worker unit 8、CLI 1、native core 6、計16 passed |
| Rust lint | `C:\Program Files\nodejs\npm.cmd run platform-access:lint` | cwd Coordinator、2026-08-22T23:51:32.5602599Z～23:51:36.5284080Z、exit 0、worker／release supervisorともClippy warning 0 |
| native PE／再現build | `C:\Program Files\nodejs\npm.cmd run platform-access:native-bootstrap-pe` | cwd Coordinator、2026-08-22T23:51:41.7653917Z～23:51:57.6972280Z、exit 0、clean build 2件byte一致、PE accepted |
| TypeScript coverage | `C:\Users\nakas\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe C:\project\CRDD\tools\coordinator\scripts\check-platform-access-ts-coverage.ts` | cwd Coordinator、2 run exit 0、line 7571/8515、function 268/292、branch 1193/1464。時刻・payloadはCoverage節 |
| Rust coverage | `C:\Users\nakas\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe C:\project\CRDD\tools\coordinator\scripts\check-platform-access-coverage.ts` | cwd Coordinator、2 run exit 0、line 1109/1399、function 76/92、region 1602/2075、branch分母なし。時刻・payloadはCoverage節 |

callerが設定した追加環境差分はなく、各script自身の固定環境縮小とCargo `--frozen`を使用した。`npm.cmd`はSHA-256 `21b46c69ad6e2f231f02a9e120f4ba6c8e75fef5a45637103002eab99f888ab8`、Node 24.19.0は`3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237`である。stdout／stderr全量は一時coverage Rootや経過時間を含むためRepositoryへ複製せず、coverageの決定論的payloadだけを抽出規則・byte長・SHA-256・2 run一致で再識別する。Evidence固定後のfinal checkerは親エージェントの共通入力として別途渡し、本記録自身へ循環的なchecker結果を書き戻さない。

## 成果物Identityと安全状態

- supervisor: 86,528 byte、SHA-256 `ce5b6d025a566d4fdf7d8257e8fdd26e692cd8ba919a110826a6a3641e48de73`
- worker: 139,264 byte、SHA-256 `eaeea51c119206653454b74384c2f3353ea58b6e95e52b0f9d84d489c6fa17c4`
- cargo: 30,737,408 byte、SHA-256 `43226f7efc5ea12b88c9156da97f8954b9af582673baadb3fb1a3ebec5d97348`
- rustc: 111,104 byte、SHA-256 `21256c9767416cbc70120e7987449c6cc5a66e3e9f843d05392ee4fd5e617261`
- PE検査上の直接Network import: 0
- worker Process Effect: false
- operational Filesystem Effect: false
- mapped supervisor image結合: `blocked_before_worker_spawn`

現PEは、mapped supervisor imageと署名manifest成果物の同一file objectを証明できないため、worker spawn attempt 0で停止する。したがってPA03／PR03、create-time Job、子孫不存在、終了後tree、実module集合および実Network非発火は未実行であり、static import 0やsource候補から実行成立を推定しない。

## Coverageの扱い

TypeScript runは2026-08-22T23:52:07.8792666Z～23:52:10.4069230Zと23:52:10.4503008Z～23:52:12.9663550Z。stdout全体をpayloadとし、各161,285 byte、SHA-256 `6210806a18fe92c01923c5a0d5b89939d5b87f27f8b1a207c0da46387e89d8a5`で完全一致、stderr 0 byteだった。payloadはsource別line／function／branch、全未到達`source:line:block:branch` Identity、および各Security Decision Obligationのstatus、reason、risk、alternative verification、Owner、human decision、recheckを含む。payloadは固定scriptと対象sourceから同Hashへ再生成でき、同Hashにならないrunを本結果へ流用しない。

Rust runは2026-08-22T23:52:23.6370619Z～23:52:31.6141308Zと23:52:31.6890824Z～23:52:39.6145721Z。stdoutの最初の`{`からEOFまでをcoverage JSON payloadとして抽出し、各3,250 byte、SHA-256 `7e7e1c22dcf1aeec54125b06d771f3bb7a0e262e9c67eaddaf86bfb3b643cd66`で完全一致した。先行test出力1,407 byteとstderr 1,408 byteは一時coverage Rootを含む非payloadである。source別では`main.rs` 46/81 line、`native_bootstrap_core.rs` 232/420、`protocol.rs` 181/204、`windows.rs` 363/407、`tests/cli.rs` 112/112、`tests/native_bootstrap_core.rs` 175/175。`src/bin/coordinator.rs`はrelease-only本体としてcoverage分母から除外するが、同じproduction `exact_manifest_payload`をall-features bin testで直接実行し、固定clockのnot-before、expiry直前、exact expiry、calendar、extra fieldおよびartifact size差を検査した。残るWin32経路は`Not Instrumented`としてrelease Clippy、strict PE、実成果物CLIおよび独立source reviewへ分離する。stable toolchainのbranch分母0は100%へ換算しない。

Git-ignored file、Cargo cache、MSVC linker供給網、正式署名材料およびTrust Storeは固定対象外である。checkerもGit-ignored fileを未確認として返す。dirty manifestは本記録自身を自己参照Hashへ含めず、Evidence固定後のchecker結果と3独立監査の共通入力でrecord-only追加を確認する。

## 未完了

- 安全なmapped supervisor image／署名済みfile object結合方式の決定、実装および検証
- 正式Ed25519 manifestと承認済みAuthenticode署名成果物によるPA03／PR03実往復
- 同じrunのJob／子孫禁止／終了後tree、実module集合およびNetwork非発火確認
- 人間の決定権限者による採用、統合、残存risk受容およびRelease判断

検証用証明書をCurrentUser Root／TrustedPublisherへ登録する処置は実行していない。正式署名材料または、目的・期間・追加／除去対象・残存riskを特定した別の人間承認なしにTrust Storeを変更しない。
