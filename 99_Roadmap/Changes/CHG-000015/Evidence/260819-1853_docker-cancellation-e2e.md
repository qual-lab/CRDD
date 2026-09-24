# CHG-000025 最終固定Fake取消検証 Evidence

- 対象Commit: `9c013ceb3a26581b4fa48c4669cd58900aef8de7`
- 対象Tree: `18906495e7f76dc21aeada52554c6ea920160eb3`
- Parent: `f3ea04da1bdb3a7d4a00bd45f0c4ad508676256f`
- 実行日: 2026-08-19
- Node.js: `v24.19.0`
- Docker接続: 固定Docker Desktop Linux Engine named pipe
- 対象: handler登録後にreadyを発行するRepository所有固定Fakeと固定`SIGTERM`だけ

## 実行結果

最終固定candidateのclean worktreeから専用verificationを実行した。Fakeは`SIGTERM` handlerを登録した後にreadyを発行し、Hostはそのreadyを観測してから固定container IDへ取消を送った。

| 項目 | 結果 |
| --- | --- |
| status／reason | `verified`／`dynamic_fake_provider_cancellation_verified` |
| signal | `SIGTERM` |
| ready／ack／終了 | すべて`true` |
| grace | 221 ms |
| Fake stdout／stderr | 128 byte／0 byte |
| exit／signal | 42／`null` |
| container不存在／Host cleanup | いずれも`true`、cleanup=`confirmed` |
| residual container／Operation directory | 0／0 |
| 診断Docker container／Filesystem Effect | `true`／`true` |
| Provider Network Effect | `false` |
| Runtime Authority／Operation Capability／実Provider readiness | すべて`false` |

正規化stdoutはcompact JSON UTF-8＋末尾LF exact 1件、704 byte、SHA-256 `F269029A86751EA9DC21BFF21DE5878EF5C03D6C55205D7DBE2405613590B007`、stderrは0 byteだった。実行後に所有labelのcontainer 0件、所有prefixのOperation directory 0件を別照会で確認した。raw出力、Path、container ID、recovery token、CredentialおよびOAuth stateは保存しない。

## 共通機械入力

- Coordinator strict typecheck／lint／format: Pass
- Coordinator contract tests: 377/377 Pass
- tools naming contract: 5/5 Pass、所有source 130件
- 動的Fake coverage: exact 10 source／7 test、lines 3857/5646、functions 150/197、branches 671/858、未到達187 branch
- coverage payload SHA-256: `A5F817CFAE3F6718A6E48120F93194C1EB35F9383909A3599CB375A6C54AFBD1`
- coverage stdout: 129,194 byte、SHA-256 `8DDB0B4148984772BBACCFDCB5C7941FC13714E88C36D34AB5D76036AF25CF33`、stderr 0 byte
- full checker: Evidence追加前510 files／322 Markdown／1929 links／568 anchors／26 Related／26 versioned／8 IDs／68 remediation、Error 0／Warning 0
- worktree: 対象candidateとの差分なし

## 境界

本結果は固定Fake／固定`SIGTERM`の受領、終了、container不存在およびHost cleanupだけを検証する。通常診断、任意signal、実Provider、OAuth、専用Home、mount Grant、Egress、quota／billing、Host escape一般およびOperation取消は未検証または未実装である。API key、従量APIまたは追加購入経路は起動していない。

本Evidenceは変更候補の検証入力であり、独立監査、採用、統合、Gate open、StableまたはReleaseを意味しない。12 blocker、6 current-run evidence、Gate blocked、Authority／Capability非発行、v0.18 Candidate、v0.17 Released Baselineおよび非Releaseを維持する。
