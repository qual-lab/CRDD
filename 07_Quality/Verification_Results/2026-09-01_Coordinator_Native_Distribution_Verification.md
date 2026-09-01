# Coordinator Native配布物の再現確認

状態: 検証済み・未署名・未リリース
担当責任者: Qual-Lab
確認日: 2026-09-01

## 結論

`template/tools/coordinator/windows-x64/`へ配置した2つのWindows実行物は、固定したRust toolchainと現在のNativeソースから2回構築し、各回のbytesが一致した。Supervisor内のWorker結合値も同梱Workerと一致し、PE形式と配布時の署名前実行物プロファイルを満たした。

この結果は、ソースとGit同梱実行物の対応および再現性を示す。正式署名、Release Manifest、main統合後の最終Commit／Tree、配布Authorityまたはリリース判断は成立させない。main統合後に固定する最終版を別途署名し、その署名済み配布物でE2Eを行う。

## 対象

最初の観測時点はCommit `c8cf2f0`。記録追加後の固定Commit `9f133d810d439c8b401bcd8d7becb91649ae5677`、Tree `3508ef77a8071d6aa9c344b1e176999406553a2a`のclean worktreeから同じ確認を再実行し、下表のNativeソースと実行物bytesが変わっていないことを確認した。最終的な署名対象は、プルリクエストでmainへ統合した後に再固定する。

| 対象 | Git blob | SHA-256 | bytes |
|---|---|---|---:|
| `template/tools/coordinator/windows-x64/coordinator.exe` | `c3d629bad06138e160cbaf90a4b1d23d060af693` | `5556d6c9179092e234ac39492645821eddef2f6ca1463e1c0617fd8fb9b658a8` | 120,832 |
| `template/tools/coordinator/windows-x64/crdd-platform-access.exe` | `05ee8346787fb01bb7c0b259dabc10df6414aacb` | `0ca3426b337a008cdb64a18ceabc1851e24e8f872a62e790c8ee92f08079d3d1` | 212,992 |

配布Pathは`x86_64-pc-windows-msvc`向けの利用者表示として`windows-x64`を用いる。target triple、PEのmachine種別および実装上のplatform判定は変更していない。

## 構築環境と再現性

| 観測 | 結果 |
|---|---|
| Toolchain | `1.94.1-x86_64-pc-windows-msvc` |
| `cargo` SHA-256 | `43226f7efc5ea12b88c9156da97f8954b9af582673baadb3fb1a3ebec5d97348` |
| `rustc` SHA-256 | `21256c9767416cbc70120e7987449c6cc5a66e3e9f843d05392ee4fd5e617261` |
| 構築回数 | 同じ固定入力で2回 |
| 再現性 | Supervisor、Workerとも2回のbytesが一致 |
| PE確認 | 両実行物を受理。署名前候補としてmanifest-only Authenticode policyを確認 |
| Worker結合 | Supervisorが保持するWorker identityと同梱Workerが一致 |

構築には既存のlocal Cargo cacheを用いた。依存ソースの供給網IdentityとMSVC linker自体のIdentityは、この確認では独立に検証していない。

## 再実行可能な確認記録

確認は`C:\project\CRDD\.crdd\release-audit\9f133d8`を作業Directoryとし、次のコマンドで実行した。

```text
npm.cmd --prefix 40_Develop/coordinator run platform-access:native-bootstrap-pe
```

開始は`2026-09-01T04:11:55.1361003Z`、終了は`2026-09-01T04:12:13.9114958Z`、exit codeは`0`。実行前後の`git status --porcelain=v1 --untracked-files=all`はともに0件だった。runnerは、異なる一時出力先でSupervisorとWorkerを2回ずつ構築し、bytes一致、PE、CLIの固定拒否、実行前後のstable file identity、Worker結合および署名観測用stagingとの同一Hashを同じrunで確認した。一時出力はrunnerの終了処理で削除した。

Source入力集合は次のコマンドでGit treeから列挙した。これにはRust crate全体、build／PE runnerおよびrunnerが直接使う3つのsecurity moduleを含む。

```text
git ls-tree -r HEAD -- 40_Develop/platform-access 40_Develop/coordinator/scripts/build-native-bootstrap.ts 40_Develop/coordinator/scripts/check-native-bootstrap-pe.ts 40_Develop/coordinator/src/security/native-bootstrap-pe-inspector.ts 40_Develop/coordinator/src/security/native-provision-supervisor-release.ts 40_Develop/coordinator/src/security/bounded-file-snapshot.ts
```

列挙結果のSHA-256は`b68499d81b8b966930931f73eb5803a865b8ebf33e53d9be076c8cf506e42fc9`。完全出力はRepository-localの`.crdd/release-audit/logs/9f133d8-native/native-bootstrap-pe.log`へ保持し、SHA-256は`80282d7e8653ff04eacdd6af0b65cec182ed774cb8cbfc84b07890d40fdc91c0`。実行metadata、実行前後のGit状態およびSource入力一覧も同じDirectoryへ分離して保持した。この`.crdd`内記録は公開配布物ではなく、Release closureまでのlocal再識別用である。第三者は上記Commitとコマンドから同じ入力集合を再構成できる。

## 関連する機械確認

| 確認 | 結果 |
|---|---|
| Coordinator全試験 | 1,590 / 1,590成功。Windowsの実Process・取消経路を許可した本番同等のProcess境界で再実行 |
| 開発E2E | 286 / 286成功 |
| Checker契約試験 | 267 / 267成功 |
| Release関連の限定試験 | 66 / 66成功 |
| Rust試験 | `npm.cmd --prefix 40_Develop/coordinator run platform-access:test`。37成功、失敗0、ignored 2、exit 0。ignoredはCurrent User Registryを変更・復元する実試験と、実子Processからだけ呼ばれるprobe。後者を使う親試験は成功 |
| 型・Lint・Format・Traceability | `npm run check`成功 |
| 固定Commitの全体Checker | 文書・リンク・アンカー・固定履歴参照を確認し、エラー0、警告0 |

非権限環境で先に実行したProcess試験の失敗は合格へ含めていない。該当101件を本番同等のProcess権限で再実行して101 / 101成功を確認し、その後に全1,590件を同じ境界で確認した。

Rust試験は同じclean worktreeで`2026-09-01T04:12:30.4754766Z`から`2026-09-01T04:12:40.5895217Z`まで実行した。実行前後のGit状態は0件、完全出力は`.crdd/release-audit/logs/9f133d8-native/platform-access-test.log`、SHA-256は`9b15e5094720f0edb6b72646a9e5bcff99a786437f56acd3afa1640f1de5919d`である。実子Process内のprobeが出力する1件を上位test countへ重複加算せず、Cargoの各top-level resultから37成功・2 ignoredを算出した。

## 未確認範囲と後続

- この記録は正式署名と署名鍵の使用を含まない。
- Release Manifestはまだ存在せず、main統合後に固定したCommit／Treeへ対して一度だけ作成する。
- このbuild確認だけでは、全Provider実行、全Network failure、全出力failureまたは全Windows環境を網羅しない。これらを他の契約試験・署名E2Eの結果と混同しない。
- 依存ソース、linkerおよびOS toolchain全体の供給網Identityを検証済みとは主張しない。
- main統合後の最終固定版を正式署名し、署名済み4経路E2E、Recovery、cleanupおよび配布Manifestの一致を確認してからタグを付与する。
