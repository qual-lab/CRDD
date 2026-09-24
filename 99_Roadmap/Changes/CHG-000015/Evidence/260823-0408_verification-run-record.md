# CHG-000035 固定後検証実行記録（1d7bac2）

状態（Status）: `Superseded`

Node.js `v22.18.0`は後続で固定した検証基準（Node.js 24.12以上）を満たさないため、本記録を現行の合否根拠に使用しない。現行記録は[`f678428固定後検証実行記録`](CHG-000035_Verification_Run_Record_f678428.md)である。本ファイルは履歴として保持する。

## 1. 宣言対象

- 変更トレース: `CHG-000035`
- Repository: Qual-Lab / CRDD公式リポジトリ
- Commit OID: `1d7bac2982981771cd013bc6a23274c71a9af9ce`
- Root Tree OID: `d7b6cc05a031e93172a4e9d171debc85ab82de93`
- 対象Path: 固定Commitの全Tree
- 実行日: 2026-08-23（Asia/Tokyo）
- 実行場所: `C:\project\CRDD`
- Runtime: Node.js `v22.18.0`、npm `10.9.3`、Rust `1.94.1-x86_64-pc-windows-msvc`、LLVM `21.1.8`
- 記録境界: 本EvidenceとCHGからの参照は固定対象外で生成した記録限定差分であり、上記Commit／Treeへ自己参照させない。

外部検索、外部AI、API、MCPまたは生成サービスへRepository情報を送信していない。検証はローカルで完結した。

## 2. 実行commandと結果

| 対象 | Working directory | 実行command | 結果 |
|---|---|---|---|
| Coordinator静的確認 | `tools/coordinator` | `npm.cmd run check` | TypeScript typecheck、Biome Warning拒否、format確認成功 |
| Coordinator全試験 | `tools/coordinator` | `npm.cmd test` | 430件成功、失敗0 |
| Checker静的確認 | `tools/checker` | `npm.cmd run check` | TypeScript typecheck、Biome Warning拒否、format確認成功 |
| Checker全試験 | `tools/checker` | `npm.cmd test` | 151件成功、失敗0 |
| Rust format | `tools/coordinator` | `npm.cmd run platform-access:format:check` | 成功 |
| Rust lint | `tools/coordinator` | `npm.cmd run platform-access:lint` | workerとrelease-only native bootstrapのClippy Warning拒否で成功 |
| Rust試験 | `tools/coordinator` | `npm.cmd run platform-access:test` | unit 8件、worker CLI 1件、native Core 2件の計11件成功、失敗0 |
| Rust release build | `tools/coordinator` | `npm.cmd run platform-access:build` | workerとfeature付きnative bootstrapのfrozen release build成功 |
| TypeScript coverage | `tools/coordinator` | `npm.cmd run platform-access:ts-coverage` | 固定source 23、test 22、検証義務付きで成功 |
| Rust coverage | `tools/coordinator` | `npm.cmd run platform-access:coverage` | instrument対象source 6、除外source 1、検証義務付きで成功 |
| Native PE／実CLI確認1 | `tools/coordinator` | `npm.cmd run platform-access:native-bootstrap-pe` | 2 clean build一致、PE accepted、実CLIと署名観測成功 |
| Native PE／実CLI確認2 | `tools/coordinator` | `npm.cmd run platform-access:native-bootstrap-pe` | 1回目と同じHash、byte長、PE、CLIおよび署名観測 |
| Repository全体Checker | `.` | `node tools/checker/crdd-check.ts --json --summary` | Markdown 351、link 2029、anchor 581、error 0、warning 0 |

Repository全体Checkerは`2026-08-22T19:04:55.686Z`に開始し、581 msで終了した。Git-ignored fileは未確認範囲である。

## 3. Native bootstrap固定成果物

連続2回の検証runは、各runで空白を含む異なる2つのclean target directoryへbuildした。計4つのbuild観測はすべて次と一致した。

- toolchain: `1.94.1-x86_64-pc-windows-msvc`
- target: `x86_64-pc-windows-msvc`
- SHA-256: `a1c2be0b2a70f6c1cbc2caf29d47ee360dee359174a82bab65952d28420ee281`
- byte長: 4608
- build: `--frozen`、固定toolchain／target／feature／link argv、外部Rust override拒否、`/Brepro`
- PE: x86-64 PE32+、Windows console、実行可能entrypoint、`DYNAMIC_BASE`、`NX_COMPAT`
- import: `KERNEL32.dll`の`ExitProcess`、`GetCommandLineW`、`GetStdHandle`、`WriteFile`だけ
- 不在を確認したdirectory: delay import、TLS、bound import、CLR runtime header
- 署名観測: PE検査とSHA-256を同じfd由来の所有byte snapshotへ結合し、`entrypointContractRevision: 2`と一致

実成果物のexact `provision`は終了2、stderr 0 byte、固定blocked stdoutを返した。引数なし、`doctor`、quoted `"provision"`、余分token、大文字差の5ケースは固定arguments-invalidへ閉じた。実行前後のfile Identity／Hashは一致し、bootstrap自身についてworker spawn 0、helper process 0、Filesystem／Network Effect false、Runtime Authority／Capability falseだった。

検証runner自身はCargo／CLI childのProcess Effectとbuild／cleanupのFilesystem Effectを発行した。dependency Networkは`--frozen`で禁止した。このrunner Effectを検査対象bootstrapの全Effect falseへ混入していない。

## 4. Coverage

### 4.1. TypeScript

- line: 7285/8131（89.60%、不足846）
- function: 263/283（92.93%、不足20）
- branch: 1165/1420（82.04%、不足255）

CHG-000035の主要変更sourceの実測値を示す。値は順にline、function、branchである。

| Source | line | function | branch |
|---|---:|---:|---:|
| `scripts/build-native-bootstrap.ts` | 66/91 | 1/1 | 5/10 |
| `scripts/check-native-bootstrap-pe.ts` | 主要処理を実PE runnerで直接確認 | 同左 | 同左 |
| `scripts/check-platform-access-ts-coverage.ts` | 571/636 | 28/30 | 105/131 |
| `src/security/native-bootstrap-pe-inspector.ts` | 388/389 | 19/20 | 104/116 |
| `src/security/native-provision-supervisor-release.ts` | 226/242 | 8/8 | 34/41 |
| `src/security/platform-provisioner-trust-core.ts` | 543/576 | 16/16 | 130/142 |

`check-native-bootstrap-pe.ts`は対象成果物のbuild、実行およびcleanupを行う検証runnerであり、同じcoverage母集団へ再帰的に実行していない。代わりに連続2回の実runner成功、2 clean build一致、実PE、実CLIおよび同一byte署名観測を直接記録した。

未到達branchはsource、line、block、branchを完全Identityとし、各Identityへ状態`Not Verified`、理由、risk、代替確認、Owner、人間判断および再確認契機を接続した。主な不足は実Cargo failure、全Filesystem race、coverage main guard、署名commandの本番固定鍵成功経路および既存blocked分岐である。利用者への影響は未到達経路を安全成立へ換算せず、operational one-shotを引き続き開かないことである。OwnerはQual-Lab、人間判断は現在`not_required`、toolchain、PE policy、署名domain、OS API、coverage Runtimeまたは固定母集団変更時に再確認する。

### 4.2. Rust

- region: 1288/1416（90.96%、不足128）
- function: 53/54（98.15%、不足1）
- line: 843/914（92.23%、不足71）
- branch: 0/0、`not_available_in_fixed_stable_toolchain`

| Source | region | function | line | branch |
|---|---:|---:|---:|---:|
| `src/native_bootstrap_core.rs` | 76/78 | 3/3 | 52/54 | 0/0 |
| `src/main.rs` | 16/27 | 1/2 | 10/27 | 0/0 |
| `src/protocol.rs` | 484/510 | 22/22 | 268/275 | 0/0 |
| `src/windows.rs` | 461/550 | 19/19 | 362/407 | 0/0 |
| `tests/cli.rs` | 218/218 | 5/5 | 112/112 | 0/0 |
| `tests/native_bootstrap_core.rs` | 33/33 | 3/3 | 39/39 | 0/0 |

`src/bin/coordinator.rs`は`Not Instrumented`である。release-only `no_std`／`no_main` entrypointを安定版test coverage profileへlinkすると製品契約が変わるため除外した。riskはWin32 FFIのstdout failure、partial writeおよびpanic pathをcoverage測定できないことである。代替確認はfeature固有release Clippy、strict PE検査、実成果物CLI、source reviewおよび同じCoreの契約試験である。OwnerはQual-Lab、人間判断は現在`not_required`、entrypoint、Win32 import、link argv、output処理または安定版coverage能力変更時に再確認する。

branch mapping非対応を100%へ換算しない。

## 5. 初回監査指摘への処置

- PE parserはraw 7-bit ASCII、全範囲／加算上限、section間非重複、一意RVA、descriptor／thunk／文字列上限、OFT／FT exact、terminator後zero padding、bound import 0を要求し、high-bit aliasと構造負例を追加した。
- 署名対象HashとPE検査は同じfdから所有copyした同じbyte snapshotへ結合した。既存のleaf／Root identity、realpathおよび前後差確認も保持した。
- 独立署名検証が成功するV2 entrypoint revision 1を、現Verifierとpackage gateがEffect前に拒否する試験を追加した。
- native feature binaryをrelease Clippyとbuildへ追加し、coverage不能entrypointを理由・risk・代替確認・Owner・人間判断・再確認契機付きで明示した。
- 検証runnerのProcess／Filesystem Effectと、検査対象bootstrapの全Effect falseを別軸にした。

これらは修正担当による適用と自己確認であり、`Resolved`判定ではない。本Evidence追加後の固定改訂版を、Agent／Architecture／Security、Document、Gap／Impact／Conformanceの3系統へ旧合否不流用で再監査する。

## 6. 未評価範囲と現在状態

実Windowsのloaded image結合、leafと全rename可能 parent handle、local volume、実行時module／DLL探索閉包、DLL side-loading不存在、Network API非発火、stdout NULL／closed handle、partial `WriteFile`、panic、token／Root直接観測、selected-user binder、Protection、active、Provider Home、実Claude Code、subscription OAuth、Egress、quotaおよび課金は未実装または未評価である。

したがって、今回の結果は「安全なClaude Code実行」の完成を意味しない。固定blocked bootstrapの依存縮退と配布前静的検査が成立した段階であり、operational one-shot、Gate、準拠表明、Stable、Releaseまたは採用を成立させない。現在、追加の人間判断は不要である。
