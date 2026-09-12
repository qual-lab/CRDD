# CHG-000025 固定Fake取消検証 Evidence

- 対象Commit: `bf3b37a297d87aa84696aad930469a119c83957d`
- 対象Tree: `a84c77cef30e8e24fa9bc80ceeae62453386223d`
- Parent: `f4e3250d47c70d6b7b7195dbb52119dae0737b4c`
- 実行日: 2026-08-19
- 実行主体: Qual-Lab管理下のローカル検証環境
- Node.js: `v24.19.0`
- Docker接続: 固定Docker Desktop Linux Engine named pipe
- 対象: Repository所有の固定Fake／固定`SIGTERM`取消scenarioだけ

## 実行結果

固定candidateのclean worktreeから`tools/coordinator/scripts/verify-dynamic-fake-provider-cancellation.ts`を固定Node.jsで実行した。結果は次のとおりである。

| 項目 | 結果 |
| --- | --- |
| contract | `crdd-coordinator/dynamic-fake-provider-cancellation-verification` revision 1 |
| status／reason | `verified`／`dynamic_fake_provider_cancellation_verified` |
| signal | `SIGTERM` |
| ready／ack／終了 | すべて`true` |
| grace | 222 ms |
| Fake stdout／stderr | 128 byte／0 byte |
| exit／signal | 42／`null` |
| container不存在／Host cleanup | いずれも`true`、cleanup=`confirmed` |
| residual container／Operation directory | 0／0 |
| recovery／manual recovery | 不要／`false` |
| 診断Docker container／Filesystem Effect | `true`／`true` |
| Provider Network Effect | `false` |
| Runtime Authority／Operation Capability | `false`／`false` |
| 実Provider readiness | `false` |

正規化stdoutはcompact JSON UTF-8＋末尾LF exact 1件、704 byte、SHA-256 `C76A3DE9B86DE70784384636E8C4C809096BCCD5A7169F9321C009C014D3B195`、stderrは0 byteだった。raw stdout／stderr、Host Path、container ID、recovery token、CredentialまたはOAuth stateは本Evidenceへ保存しない。

実行後に所有labelでcontainer全数を照会し0件、OS一時領域の所有prefixを照会し0件であることを別に確認した。cleanup不明を成功扱いせず、実際に両方が0件である場合だけ本結果を記録した。

## 共通機械入力

- Coordinator strict typecheck／lint／format: Pass
- Coordinator contract tests: 377/377 Pass
- Checker package check: Pass
- tools naming contract: 5/5 Pass、所有source 130件をexact確認
- 動的Fake coverage: exact 10 source／7 test、lines 3857/5646、functions 150/197、branches 671/858、未到達187 branch
- coverage payload SHA-256: `A5F817CFAE3F6718A6E48120F93194C1EB35F9383909A3599CB375A6C54AFBD1`
- coverage stdout: 129,194 byte、SHA-256 `8DDB0B4148984772BBACCFDCB5C7941FC13714E88C36D34AB5D76036AF25CF33`、stderr 0 byte
- full checker: 509 files／321 Markdown／1928 links／568 anchors／26 Related／26 versioned／8 IDs／68 remediation、Error 0／Warning 0
- worktree: 実行開始時および完了時に対象candidateとの差分なし

## 主張しない範囲

本結果が検証したのは固定Fakeへの固定`SIGTERM`取消、固定ack、終了、同一containerの3軸不存在およびHost cleanupだけである。通常`doctor --isolation`の実行中取消、任意signal、実Codex／Claude、OAuth、専用Home、mount Grant、Egress、quota／billing、実Provider process tree、Host escape一般、cleanup失敗時の実回復またはOperation Capabilityを検証していない。API key、従量APIまたは追加購入経路は起動していない。

本Evidenceは変更候補の機械検証入力であり、独立監査、採用、統合、Gate open、StableまたはReleaseを意味しない。12 blocker、6 current-run evidence、Gate blocked、Authority／Capability非発行、v0.18 Candidate、v0.17 Released Baselineおよび非Releaseを維持する。
