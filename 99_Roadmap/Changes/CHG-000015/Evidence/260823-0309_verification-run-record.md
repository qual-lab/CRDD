# CHG-000034 固定後検証実行記録（c411738）

状態（Status）: `Ready for Verification`

## 1. 宣言対象

- 変更トレース: `CHG-000034`
- Repository: Qual-Lab / CRDD公式リポジトリ
- Commit OID: `c41173880ccf743ec86ecd2b39e82df811947d3c`
- Root Tree OID: `88e427b5c81d43bfa9ba0b5941328db1cb4e273a`
- 対象Path: 固定Commitの全Tree
- 実行日: 2026-08-23（Asia/Tokyo）
- 実行場所: `C:\project\CRDD`
- Runtime: Node.js `v24.19.0`、Rust `1.94.1-x86_64-pc-windows-msvc`
- 記録境界: 本EvidenceとCHGからの参照は固定対象外で生成した記録限定差分であり、上記Commit／Treeへ自己参照させない。

## 2. 実行commandと結果

Node.jsは`C:\Users\nakas\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`をPATH先頭へ固定した。

| 対象 | Working directory（Repository相対／実行時絶対Path） | 実行command | 結果 |
|---|---|---|---|
| Coordinator静的確認 | `tools/coordinator`／`C:\project\CRDD\tools\coordinator` | `npm.cmd run check` | typecheck、lint Warning拒否、format確認成功 |
| Coordinator全試験 | `tools/coordinator`／`C:\project\CRDD\tools\coordinator` | `npm.cmd test` | 419件成功、失敗0 |
| Checker静的確認 | `tools/checker`／`C:\project\CRDD\tools\checker` | `npm.cmd run check` | typecheck、lint Warning拒否、format確認成功 |
| Checker全試験 | `tools/checker`／`C:\project\CRDD\tools\checker` | `npm.cmd test` | 151件成功、失敗0 |
| Rust format | `tools/coordinator`／`C:\project\CRDD\tools\coordinator` | `npm.cmd run platform-access:format:check` | 成功 |
| Rust lint | `tools/coordinator`／`C:\project\CRDD\tools\coordinator` | `npm.cmd run platform-access:lint` | Clippy Warning拒否で成功 |
| Rust試験 | `tools/coordinator`／`C:\project\CRDD\tools\coordinator` | `npm.cmd run platform-access:test` | unit 9件、CLI 2件の計11件成功、失敗0 |
| Rust release build | `tools/coordinator`／`C:\project\CRDD\tools\coordinator` | `npm.cmd run platform-access:build` | locked `x86_64-pc-windows-msvc` release build成功 |
| TypeScript coverage | `tools/coordinator`／`C:\project\CRDD\tools\coordinator` | `node scripts/check-platform-access-ts-coverage.ts` | 固定source 21、test 20、検証義務付きで成功 |
| Rust coverage | `tools/coordinator`／`C:\project\CRDD\tools\coordinator` | `node scripts/check-platform-access-coverage.ts` | 固定source 5、test executable 3、検証義務付きで成功 |
| Repository全体Checker | `.`／`C:\project\CRDD` | `node tools/checker/crdd-check.ts --json --summary` | Markdown 349、link 2022、anchor 580、error 0、warning 0 |

Repository全体Checkerは`2026-08-22T18:08:10.056Z`に開始し、616 msで終了した。Git-ignored fileは未確認範囲である。

## 3. Coverage固定payload

### 3.1. TypeScript

`check-platform-access-ts-coverage.ts`のstdout JSONをUTF-8 byteのままSHA-256へ入力した。2回の連続実行でbyte長、Hashおよび全分子／分母が一致した。

- byte長: 144793
- SHA-256: `c2bb0d2c091586b766464b8a8151422d8aa6d1015000063e869f4c7cb96b0410`
- line: 6803/7625（89.22%、不足822）
- function: 243/262（92.75%、不足19）
- branch: 1043/1290（80.85%、不足247）

CHG-000034で変更したcoverage対象sourceの実測値を示す。値は順にline、function、branchである。

| Source | line | function | branch |
|---|---:|---:|---:|
| `scripts/check-platform-access-ts-coverage.ts` | 554/619 | 28/30 | 105/131 |
| `scripts/release-staging-manifest.ts` | 343/362 | 10/11 | 44/54 |
| `scripts/sign-release-manifest.ts` | 198/356 | 5/9 | 6/24 |
| `src/core/doctor.ts` | 665/710 | 24/25 | 115/173 |
| `src/security/native-provision-supervisor-release.ts` | 215/233 | 8/8 | 32/40 |
| `src/security/platform-provisioner-effect.ts` | 54/54 | 3/3 | 4/4 |
| `src/security/platform-provisioner-package-filesystem.ts` | 531/737 | 22/26 | 84/113 |
| `src/security/platform-provisioner-pre-active-one-shot.ts` | 68/68 | 3/3 | 4/4 |
| `src/security/platform-provisioner-release-identity.ts` | 368/398 | 15/15 | 48/69 |
| `src/security/platform-provisioner-trust-core.ts` | 543/576 | 16/16 | 130/142 |
| `src/security/runtime-activation-record.ts` | 1148/1156 | 24/25 | 81/91 |

payload内の`uncoveredBranches`はsource、line、block、branchを完全Identityとし、`uncoveredBranchObligations`は各Identityへ状態、理由、risk、代替確認、Owner、人間判断および再確認契機を接続する。完全一覧は上記Hashと同じcommandで再取得できる。主な不足は、署名commandの実固定鍵成功経路、Filesystem／Git／OS raceとI/O failure、doctor／activationの既存blocked分岐、coverage集計器自身の全不正入力、未実装native DACL／Root写像である。

利用者への影響は、現段階でoperational one-shotを利用できない状態が継続し、未到達経路を安全成立へ換算しないことである。代替確認はexact Schema、署名valid確認後の旧V1／不正V2拒否、成果物単独欠落／改変、Root／parent差替え、全Effect／Authority／Capability falseの契約試験である。安全策は条件不明時の観測前`blocked`である。OwnerはQual-Lab、人間判断は現在`not_required`、Schema、署名domain、coverage Runtime、OS Adapterまたは対象source/test母集団変更時に再確認する。

### 3.2. Rust

Rust runner stdoutの末尾JSONを抽出し、前後空白を除いたUTF-8 byteをSHA-256へ入力した。2回の連続実行でbyte長、Hashおよび全分子／分母が一致した。

- byte長: 2199
- SHA-256: `153f3e8d5b75ef88c094329afaa6438fe83f87a1fa28338c57ad02cee5e8ea65`
- region: 1249/1386（90.12%、不足137）
- function: 53/55（96.36%、不足2）
- line: 802/878（91.34%、不足76）
- branch: 0/0、`not_available_in_fixed_stable_toolchain`

| Source | region | function | line | branch |
|---|---:|---:|---:|---:|
| `src/bin/coordinator.rs` | 39/51 | 5/6 | 27/35 | 0/0 |
| `src/main.rs` | 16/27 | 1/2 | 10/27 | 0/0 |
| `src/protocol.rs` | 484/510 | 22/22 | 268/275 | 0/0 |
| `src/windows.rs` | 462/550 | 19/19 | 363/407 | 0/0 |
| `tests/cli.rs` | 248/248 | 6/6 | 134/134 | 0/0 |

branch mapping非対応を100%へ換算しない。不足はtop-level出力failure、main guard、Windows API failure、全Filesystem／token edgeおよび未実装native観測である。利用者影響はnative入口が固定blockedのままであること、代替確認はexact argv／byte／exit／stderr、protocol全field、Windows負例および全非発火試験、安全策は観測候補を発行しないことである。OwnerはQual-Lab、人間判断は現在`not_required`、toolchain、target、Rust source/test、Windows APIまたはbranch mapping能力変更時に再確認する。

### 3.3. Hash再現規則

TypeScriptとRustのcoverageは、いずれも`tools/coordinator`（実行時`C:\project\CRDD\tools\coordinator`）をworking directoryにする。TypeScriptは固定Nodeでscriptをchild process実行し、成功時の`stdout`全byteをHashする。Rustは同様に実行し、`stdout`の最後の改行直後から始まるJSONを抽出して`trim()`したbyteをHashする。いずれも`node:crypto`の`createHash("sha256")`を使用する。stderr、Cargo一時Path、試験表示順およびdurationはHash対象外である。

## 4. 監査指摘への直接確認

- 旧V1一成果物manifestは旧V1 domainで署名し、独立署名検証が`true`であることを確認後、現Verifierがaliasなしで拒否した。
- V2は各artifact fieldの単独欠落とnative artifact全field／extra field差をmutation後にV2 domainで再署名し、独立署名検証が`true`であることを確認後に拒否した。
- 正常V2は二成果物の全fieldをexact投影し、Runtime Authority、Capability、Filesystem／Network Effectをfalseに維持した。
- Release stagingはplatform-accessだけ欠落、native supervisorだけ欠落の各条件で、欠落していない側を正常配置してsession開始を拒否した。
- production Trust Core、V2 domain／Schema、spawn上限0および全非発火境界は変更していない。

## 5. 未評価範囲と現在状態

実Windowsのloaded image、leafと全rename可能parent、local volume、PE import／delay-import、DLL side-loading、Network API非発火、token／Root直接観測、selected-user binder、Protection、active、Provider Home、実Provider、OAuth、Egress、quotaおよび課金は未実装または未評価である。したがってoperational one-shot、Gate、準拠表明、Stable、Releaseまたは採用を成立させない。

本記録は実装・試験固定Commitの再取得可能な品質証拠である。Evidence追加後の新CommitへRepository全体Checkerを再実行し、そのCommitを3系統の独立再監査へ渡す。監査完了までは`Ready for Verification`に留める。
