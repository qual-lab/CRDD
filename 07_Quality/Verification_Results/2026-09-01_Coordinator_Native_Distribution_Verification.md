# Coordinator Native配布物の再現確認

状態: 検証済み・未署名・未リリース
担当責任者: Qual-Lab
確認日: 2026-09-01

## 結論

`template/tools/coordinator/windows-x64/`へ配置した2つのWindows実行物は、固定したRust toolchainと現在のNativeソースから2回構築し、各回のbytesが一致した。Supervisor内のWorker結合値も同梱Workerと一致し、PE形式と配布時の署名前実行物プロファイルを満たした。

この結果は、ソースとGit同梱実行物の対応および再現性を示す。正式署名、Release Manifest、main統合後の最終Commit／Tree、配布Authorityまたはリリース判断は成立させない。main統合後に固定する最終版を別途署名し、その署名済み配布物でE2Eを行う。

## 対象

観測時点はCommit `c8cf2f0`。この結果記録を追加する変更では、下表のNativeソースと実行物bytesを変更しない。最終的な署名対象は、プルリクエストでmainへ統合した後に再固定する。

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

## 関連する機械確認

| 確認 | 結果 |
|---|---|
| Coordinator全試験 | 1,590 / 1,590成功。Windowsの実Process・取消経路を許可した本番同等のProcess境界で再実行 |
| 開発E2E | 286 / 286成功 |
| Checker契約試験 | 267 / 267成功 |
| Release関連の限定試験 | 66 / 66成功 |
| Rust試験 | 全件成功 |
| 型・Lint・Format・Traceability | `npm run check`成功 |
| 固定Commitの全体Checker | 文書・リンク・アンカー・固定履歴参照を確認し、エラー0、警告0 |

非権限環境で先に実行したProcess試験の失敗は合格へ含めていない。該当101件を本番同等のProcess権限で再実行して101 / 101成功を確認し、その後に全1,590件を同じ境界で確認した。

## 未確認範囲と後続

- この記録は正式署名と署名鍵の使用を含まない。
- Release Manifestはまだ存在せず、main統合後に固定したCommit／Treeへ対して一度だけ作成する。
- このbuild確認だけでは、全Provider実行、全Network failure、全出力failureまたは全Windows環境を網羅しない。これらを他の契約試験・署名E2Eの結果と混同しない。
- 依存ソース、linkerおよびOS toolchain全体の供給網Identityを検証済みとは主張しない。
- main統合後の最終固定版を正式署名し、署名済み4経路E2E、Recovery、cleanupおよび配布Manifestの一致を確認してからタグを付与する。
