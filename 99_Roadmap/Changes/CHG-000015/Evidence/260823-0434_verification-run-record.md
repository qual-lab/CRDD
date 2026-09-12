# CHG-000035 固定後検証実行記録（f678428）

状態（Status）: `Ready for Verification`

## 1. 宣言対象

- 変更トレース: `CHG-000035`
- Repository: Qual-Lab / CRDD公式リポジトリ
- 実装Commit OID: `f678428cc2b1e96756fb1df356dcd86e65510339`
- 実装Root Tree OID: `a226fc65c334548ca811bf6420a9e50cea5cac4a`
- 対象Path: 固定Commitの全Tree
- 実行日: 2026-08-23（Asia/Tokyo）
- 実行場所: `C:\project\CRDD`
- 記録境界: 本Evidence、旧Evidenceの状態変更およびCHGからの参照は実装固定後の記録限定差分であり、上記Commit／Treeへ自己参照させない。

外部検索、外部AI、API、MCPまたは生成サービスへRepository情報を送信していない。検証はローカルで完結した。

## 2. 固定実行環境

| 実体 | Version | byte長 | SHA-256 |
|---|---:|---:|---|
| `C:\Users\nakas\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe` | `v24.19.0` | 92825416 | `3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237` |
| `C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js` | npm `10.9.3` | 56 | `3ce7cba6f5128dd5f54c98b6a5036b0f850496878cc2e21044b675fe3c594e3e` |
| `C:\Users\nakas\.rustup\toolchains\1.94.1-x86_64-pc-windows-msvc\bin\cargo.exe` | `1.94.1-x86_64-pc-windows-msvc` | 30737408 | `43226f7efc5ea12b88c9156da97f8954b9af582673baadb3fb1a3ebec5d97348` |
| `C:\Users\nakas\.rustup\toolchains\1.94.1-x86_64-pc-windows-msvc\bin\rustc.exe` | `1.94.1-x86_64-pc-windows-msvc` | 111104 | `21256c9767416cbc70120e7987449c6cc5a66e3e9f843d05392ee4fd5e617261` |

Node.js 22へのfallbackは使用していない。npm commandは固定Nodeから上記`npm-cli.js`を直接起動した。

## 3. 実行commandと結果

通常suiteはPowerShellの同一processで次を実行し、script内の裸の`node`もNode.js 24固定実体へ解決させた。このPATHは検証childのためのものであり、production Runtimeの許可経路またはfallbackではない。PATHの残りの値、credential、tokenおよびproxy値は記録しない。

```powershell
$node = 'C:\Users\nakas\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$npm = 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js'
$env:PATH = "$(Split-Path -Parent $node);$env:PATH"
node --version # v24.19.0
```

| 対象 | Working directory | exact command／argv | 結果 |
|---|---|---|---|
| Coordinator `check` | `tools/coordinator` | `& $node $npm run check` | TypeScript typecheck、Biome Warning拒否、format確認成功（152 files） |
| Coordinator全試験 | `tools/coordinator` | `& $node $npm run test` | 435件成功、失敗0 |
| Checker `check` | `tools/checker` | `& $node $npm run check` | TypeScript typecheck、Biome Warning拒否、format確認成功（152 files） |
| Checker全試験 | `tools/checker` | `& $node $npm run test` | 151件成功、失敗0 |
| Rust format | `tools/coordinator` | `& $node $npm run platform-access:format:check` | 成功 |
| Rust lint | `tools/coordinator` | `& $node $npm run platform-access:lint` | workerとrelease-only native bootstrapのClippy Warning拒否で成功 |
| Rust試験 | `tools/coordinator` | `& $node $npm run platform-access:test` | unit 8件、worker CLI 1件、native Core 2件の計11件成功、失敗0 |
| Rust release build | `tools/coordinator` | `& $node $npm run platform-access:build` | workerとfeature付きnative bootstrapのfrozen release build成功 |
| TypeScript coverage | `tools/coordinator` | `& $node -e $driver scripts/check-platform-access-ts-coverage.ts ts` | 固定source 24、test 24、2回のpayload完全一致 |
| Rust coverage | `tools/coordinator` | `& $node -e $driver scripts/check-platform-access-coverage.ts rust` | instrument対象source 6、除外source 1、2回のJSON payload完全一致 |
| Native PE／実CLI確認 | `tools/coordinator` | `& $node -e $driver scripts/check-native-bootstrap-pe.ts pe` | 連続2runのstdout完全一致、各runの2 clean buildも一致 |
| Repository全体Checker | `.` | `& $node tools/checker/crdd-check.ts --json --summary` | Markdown 352、link 2030、anchor 581、error 0、warning 0 |

coverageとPEの2回測定は次の単一行UTF-8 JavaScriptを`$driver`の完全値として実行した。末尾改行を含まない975 bytes、SHA-256 `e9668667d2cf69a882d69960a2a052deed6c9289d7f4570fcafb7760617f85ba`である。`ts`と`rust`は親process環境を値非記録で継承する。`pe`だけは検証childのPATH先頭へ`path.dirname(process.execPath)`を加える。build helper自身はその後にchild環境をallowlistへ縮退し、固定Cargo／rustcを選択する。

```javascript
const c=require("node:crypto"),p=require("node:child_process"),q=require("node:path"),[s,k]=process.argv.slice(1),xs=[0,1].map(()=>{const r=p.spawnSync(process.execPath,[s],{cwd:process.cwd(),encoding:null,maxBuffer:52428800,env:k==="pe"?{...process.env,PATH:q.dirname(process.execPath)+";"+process.env.PATH}:process.env});if(r.status!==0){process.stderr.write(r.stderr||"");process.exit(r.status||1)}return r.stdout}),f=b=>{if(k!=="rust")return b;let i=b.indexOf(Buffer.from("\r\n{"));if(i>=0)return b.subarray(i+2);i=b.indexOf(Buffer.from("\n{"));return b.subarray(i<0?0:i+1)},ys=xs.map(f),h=b=>c.createHash("sha256").update(b).digest("hex");console.log(JSON.stringify({driverBytes:Buffer.byteLength(process.execArgv[1]),driverSha256:h(Buffer.from(process.execArgv[1])),runs:xs.map((b,i)=>({run:i+1,stdoutBytes:b.length,stdoutSha256:h(b),payloadBytes:ys[i].length,payloadSha256:h(ys[i])})),payloadByteIdentical:ys[0].equals(ys[1]),stdoutByteIdentical:xs[0].equals(xs[1])}))
```

Repository全体Checkerは`2026-08-22T19:31:30.724Z`に開始し566 msで終了した。Git-ignored fileは未確認範囲である。

## 4. Native bootstrap固定成果物とbuild境界

- SHA-256: `a1c2be0b2a70f6c1cbc2caf29d47ee360dee359174a82bab65952d28420ee281`
- byte長: 4608
- PE: x86-64 PE32+、Windows console、実行可能entrypoint、`DYNAMIC_BASE`、`NX_COMPAT`
- import: `KERNEL32.dll`の`ExitProcess`、`GetCommandLineW`、`GetStdHandle`、`WriteFile`だけ
- delay import、TLS、bound import、CLR runtime header: 0
- 連続2runのstdout: 各2583 bytes、SHA-256 `9d94fc224a93b882ebb588fce96d3c016d5663b1ee3749d9fa68313c43ce429a`、完全一致
- 各run内の2 clean build: byte長とSHA-256の完全一致
- 署名観測: PE検査とSHA-256を同じfd由来の同じ所有byte snapshotへ結合し、`entrypointContractRevision: 2`と一致

Cargo homeは`C:\Users\nakas\.cargo`、build cwdの全ancestorとCargo homeのCargo config存在数は0である。caller環境のRust／Cargo overrideは大小文字非依存で拒否した。依存sourceは既存local Cargo cacheであり、供給元真正性は未検証。MSVC linker Identityも`not_verified`である。したがってこれらを含むRelease供給網成立は主張せず、OwnerをQual-Lab、現在影響をRelease blockerとする。Release署名、配布artifact採用、toolchain／cache／dependency変更時に再確認し、人間が承認した供給元、Identityおよび再現根拠がそろうまで解除しない。

## 5. Effect証拠の分離

- 固定resultの正確なkey集合で、status／reason以外のEffect／Authority／Capability報告値はすべて`false`。
- static PEの直接Network import: 0。
- bootstrap実processのNetwork Effect: `not_verified`。
- build dependency Network: Cargo `--frozen`により禁止。
- 検証runner自身: Cargo／CLI childのProcess Effectとbuild／cleanupのFilesystem Effectを発行。

固定result内の`networkEffectIssued: false`を実processのNetwork非発火観測へ読み替えていない。

## 6. Coverageの二重再現性

### 6.1. TypeScript

2回ともstdout全体が単一JSON payloadであり、各回158060 bytes、SHA-256 `97c2a8d4e6467f6bd21f8941e46836203eb36333b00fbf7d639070dccf420a74`で完全一致した。

- line: 7438/8345（不足907）
- function: 267/291（不足24）
- branch: 1179/1445（不足266）

| Source | line | function | branch |
|---|---:|---:|---:|
| `scripts/build-native-bootstrap.ts` | 147/243 | 4/8 | 19/26 |
| `scripts/check-native-bootstrap-pe.ts` | 実PE runnerを二重実行 | 同左 | 同左 |
| `scripts/check-platform-access-ts-coverage.ts` | 580/645 | 28/30 | 105/131 |
| `src/security/bounded-file-snapshot.ts` | 118/118 | 3/3 | 22/27 |
| `src/security/native-bootstrap-pe-inspector.ts` | 388/389 | 19/20 | 104/116 |
| `src/security/native-provision-supervisor-release.ts` | 171/177 | 6/6 | 23/26 |
| `src/security/platform-provisioner-trust-core.ts` | 543/576 | 16/16 | 130/142 |

`check-native-bootstrap-pe.ts`はbuild、実行およびcleanupを行うrunnerであり、自己再帰させない。代替根拠は連続2runの完全一致、各runの2 clean build一致、実PE／CLIおよび同一byte署名観測である。未到達branchはsource、line、block、branchをIdentityにし、`Not Verified`、理由、risk、代替確認、Owner、人間判断および再確認契機をcoverage payloadに接続した。

### 6.2. Rust

Rust commandのstdoutには並列試験の非決定的な表示順が先行する。そのため抽出規則を「行頭が単独の`{`で始まる最初の行からEOFまで」と固定し、そのUTF-8 JSON byte列をcoverage payloadとした。

- run 1生stream: 4378 bytes、SHA-256 `88de4975e72f1cc95a94c54e13fc6df1fbd84869a0d46d5c37af5ea403aff72a`
- run 2生stream: 4378 bytes、SHA-256 `8e90592bbf615cd911d928455a45471c0c649a3a1c10672d23d92f37fc6caed3`
- 各抽出payload: 3238 bytes、SHA-256 `e631edc4abc808c95df3dbeaa5e1497ec03951a6f336386045ba8c44d47056e6`、完全一致
- region: 1289/1416（91.03%、不足127）
- function: 53/54（98.15%、不足1）
- line: 844/914（92.34%、不足70）
- branch: 0/0、`not_available_in_fixed_stable_toolchain`

| Source | region | function | line | branch |
|---|---:|---:|---:|---:|
| `src/native_bootstrap_core.rs` | 76/78 | 3/3 | 52/54 | 0/0 |
| `src/main.rs` | 16/27 | 1/2 | 10/27 | 0/0 |
| `src/protocol.rs` | 484/510 | 22/22 | 268/275 | 0/0 |
| `src/windows.rs` | 462/550 | 19/19 | 363/407 | 0/0 |
| `tests/cli.rs` | 218/218 | 5/5 | 112/112 | 0/0 |
| `tests/native_bootstrap_core.rs` | 33/33 | 3/3 | 39/39 | 0/0 |

`src/bin/coordinator.rs`は`Not Instrumented`である。release-only `no_std`／`no_main` entrypointの製品契約を変えずに安定版test coverage profileへlinkできない。riskはWin32 FFIのstdout failure、partial writeおよびpanic pathの未測定である。代替確認はfeature固有release Clippy、strict PE検査、実成果物CLI、source reviewおよびCore契約試験である。OwnerはQual-Lab、人間判断は現在`not_required`、entrypoint、Win32 import、link argv、output処理または安定版coverage能力変更時に再確認する。branch mapping非対応を100%へ換算しない。

## 7. 再監査指摘への処置

- Node.js 24.12以上のexact実体／path／hashを固定し、Node.js 22記録を`Superseded`とした。
- coverageを2回実行し、payloadの抽出規則、byte長、SHA-256、完全一致および全totalsを記録した。
- V2 entrypoint revision 1のGate試験で、正確なkey集合と全安全field falseを確認する。
- build override拒否を大小文字非依存の広いRust／Cargo母集団へ拡張し、Cargo config、Cargo／rustc Identity、cacheおよびlinkerの境界を記録した。外部override全排除やRelease供給網を主張しない。
- 共通bounded same-fd helperでpre-lstat、open／fstat、size、上限+1／EOF、after fstat／path／Identityを確認し、growth、truncate、leaf replacementおよびparent replacementの試験を追加した。production hookは追加していない。
- 固定result、static PE、実processおよびbuild dependencyのNetwork根拠を別軸にした。

上記は修正担当による`Applied`／`Self-checked`であり、`Resolved`判定ではない。本Evidence追加後の固定改訂版をAgent／Architecture／Security、Document、Gap／Impact／Conformanceの3系統へ旧合否不流用で再監査する。

## 8. 未評価範囲と現在状態

実Windowsのloaded image結合、leafと全rename可能parent handle、local volume、実行時module／DLL探索閉包、DLL side-loading不存在、Network API非発火、stdout NULL／closed handle、partial `WriteFile`、panic、token／Root直接観測、selected-user binder、Protection、active、Provider Home、実Claude Code、subscription OAuth、Egress、quotaおよび課金は未実装または未評価である。Cargo cache供給元真正性とMSVC linker Identityも未検証のRelease blockerである。

したがって、今回の結果は「安全なClaude Code実行」の完成を意味しない。固定blocked bootstrapの依存縮退、bounded same-fd検査および配布前静的検査が成立した段階であり、operational one-shot、Gate、準拠表明、Stable、Releaseまたは採用を成立させない。現在、追加の人間判断は不要である。
