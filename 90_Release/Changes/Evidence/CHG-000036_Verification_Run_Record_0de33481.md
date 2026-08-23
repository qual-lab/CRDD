# CHG-000036 検証実行記録

- 対象変更: [`CHG-000036`](../CHG-000036_AppContainer_Provision_Worker_Candidate.md)
- 置換関係: [`2a671485`記録](CHG-000036_Verification_Run_Record_2a671485.md)を履歴化し、本記録をcurrentとする。`2a671485`記録は、その前の[`87c35af6`記録](CHG-000036_Verification_Run_Record_87c35af6.md)との置換関係を保持する。
- 実行日: 2026-08-23（Asia/Tokyo）
- 作業Directory: `C:\project\CRDD`（Coordinator commandは`C:\project\CRDD\tools\coordinator`）
- Git HEAD: `38f6a310ff6d00d9479674fe268985dbfc7dd443`
- tracked diff blob: `4c5d0f5ee4b9461fe4b5e633b7e33fb074c0a56f`
- 未追跡CHG SHA-256: `7a97fd61a567ebaf8dc03cd739a7ee1b34d82014342d3825cae7e9dee721dc33`
- 未追跡build.rs SHA-256: `70c236fa3fb6387d457bebb7fa55decf91447564f5bb546adae0b44007f9c8e5`
- 本記録自身を除くdirty／untracked 42 file manifest: UTF-8の`repository-relative-path<TAB>lowercase-sha256<LF>`をpath昇順で5,074 byte、SHA-256 `bbd9ed071367d5f0de5f3842152608ef820cd0bc8cd802e78ffe72d89de098eb`。旧Evidence 2件、CHG、build.rsを含み、Git-ignored fileと本記録自身は含めない。
- 状態: 検証済みcomponent候補。採用、統合、Release、Gate openまたはoperational one-shotの成立記録ではない。

## 実行結果

| 確認 | exact command | 結果 |
|---|---|---|
| TypeScript全契約試験 | `C:\Users\nakas\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe --test ./tests/*.test.ts` | cwd Coordinator、2026-08-23T01:22:07.548Z～01:22:17.483Z、exit 0、436 passed、0 failed |
| TypeScript静的確認 | `& 'C:\Program Files\nodejs\npm.cmd' run check` | cwd Coordinator、2026-08-23T01:22:26.106Z～01:22:33.398Z、exit 0、strict／test typecheck、Biome lint 153 files、format 152 files |
| Rust format | `cargo fmt --manifest-path ..\platform-access\Cargo.toml --all -- --check` | cwd Coordinator、2026-08-23T01:22:33.398Z～01:22:36.355Z、exit 0 |
| Rust試験 | `& 'C:\Program Files\nodejs\npm.cmd' run platform-access:test` | cwd Coordinator、2026-08-23T01:22:36.355Z～01:22:40.363Z、exit 0、supervisor manifest 1、worker unit 8、CLI 1、native core 6、計16 passed |
| Rust lint | `& 'C:\Program Files\nodejs\npm.cmd' run platform-access:lint` | cwd Coordinator、2026-08-23T01:22:40.364Z～01:22:45.680Z、exit 0、worker／release supervisorともClippy warning 0 |
| native PE／再現build | `& 'C:\Program Files\nodejs\npm.cmd' run platform-access:native-bootstrap-pe` | cwd Coordinator、2026-08-23T01:24:20.692Z～01:24:39.056Z、exit 0、clean build 2件byte一致、PE accepted |
| TypeScript coverage | `C:\Users\nakas\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe C:\project\CRDD\tools\coordinator\scripts\check-platform-access-ts-coverage.ts` | cwd Coordinator、2 run exit 0、line 7573/8517、function 268/292、branch 1191/1462。時刻・payloadはCoverage節 |
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

TypeScript runは2026-08-23T01:23:47.0162318Z～01:23:49.4528161Zと01:23:49.6582419Z～01:23:52.0025149Z。stdout全体をpayloadとし、各161,285 byte、SHA-256 `6210806a18fe92c01923c5a0d5b89939d5b87f27f8b1a207c0da46387e89d8a5`で完全一致、stderr 0 byteだった。payloadはsource別line／function／branch、全未到達`source:line:block:branch` Identity、および各Security Decision Obligationのstatus、reason、risk、alternative verification、Owner、human decision、recheckを含む。payloadは固定scriptと対象sourceから同Hashへ再生成でき、同Hashにならないrunを本結果へ流用しない。履歴`2a671485`記録は同じpayload Hashに対するTypeScript line／branch集計値を誤記していたため、本記録ではpayloadの`totals`を再読取りした7573/8517 line、1191/1462 branchへ訂正した。履歴record自体は書き換えない。

Rust runは2026-08-23T01:23:52.0519815Z～01:24:00.4294473Zと01:24:00.4594434Z～01:24:08.7951646Z。stdoutの最初の`{`からEOFまでをcoverage JSON payloadとして抽出し、各3,250 byte、SHA-256 `7e7e1c22dcf1aeec54125b06d771f3bb7a0e262e9c67eaddaf86bfb3b643cd66`で完全一致した。各runの先行test出力は1,407 byte、stderrは1,408 byteで、一時coverage Rootを含む非payloadである。source別では`main.rs` 46/81 line、`native_bootstrap_core.rs` 232/420、`protocol.rs` 181/204、`windows.rs` 363/407、`tests/cli.rs` 112/112、`tests/native_bootstrap_core.rs` 175/175。`src/bin/coordinator.rs`はrelease-only本体としてcoverage分母から除外するが、同じproduction `exact_manifest_payload`をall-features bin testで直接実行し、固定clockのnot-before、expiry直前、exact expiry、calendar、extra fieldおよびartifact size差を検査した。残るWin32経路は`Not Instrumented`としてrelease Clippy、strict PE、実成果物CLIおよび独立source reviewへ分離する。stable toolchainのbranch分母0は100%へ換算しない。

Git-ignored file、Cargo cache、MSVC linker供給網、正式署名材料およびTrust Storeは固定対象外である。checkerもGit-ignored fileを未確認として返す。dirty manifestは本記録自身を自己参照Hashへ含めず、Evidence固定後のchecker結果と3独立監査の共通入力でrecord-only追加を確認する。

## 未完了

- 公開Win32内の自己検査では安全なmapped supervisor image／署名済みfile object結合を成立させられないと確認した。OS実行制御または既存信頼境界所有のout-of-process launcherの選択は人間判断と後続変更を要する
- 正式Ed25519 manifestと承認済みAuthenticode署名成果物によるPA03／PR03実往復
- 同じrunのJob／子孫禁止／終了後tree、実module集合およびNetwork非発火確認
- 人間の決定権限者による採用、統合、残存risk受容およびRelease判断

検証用証明書をCurrentUser Root／TrustedPublisherへ登録する処置は実行していない。正式署名材料または、目的・期間・追加／除去対象・残存riskを特定した別の人間承認なしにTrust Storeを変更しない。
