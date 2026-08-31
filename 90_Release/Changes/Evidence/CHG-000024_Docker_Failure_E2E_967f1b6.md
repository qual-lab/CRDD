# CHG-000024 実Docker失敗scenario Evidence

## 結論

固定Docker Desktop Linux Engine上で、Repository所有のtimeout、出力上限超過、不正結果およびnonzero exitを同じFake Provider隔離・回収経路により実行した。4件はすべて期待する固定reasonの`blocked`へ閉じ、Host cleanupは全件`confirmed`、実行後の所有containerとOperation一時Directoryはともに0だった。実Provider、OAuth、Egress、課金、Operation AuthorityまたはCapabilityは発火していない。

## 対象と実行条件

- Repository: CRDD公式Repository
- Git Object Format: `sha1`
- Observed HEAD: `967f1b625c5075b06ab29d7d411f15b69dd56db5`
- Root Tree: `4aabd464cad5ec3b66adc551fc18b4e1b912742a`
- Parent: `95ce472c12d0836dcb5e354e785b0cc0cd09706d`
- 実行直前の状態: index差分0、worktree差分0、未追跡0
- 実行時刻（UTC）: 2026-08-19T08:54:30.0108232Zから2026-08-19T08:54:36.7242307Z
- cwd: `tools/coordinator`
- command: 固定Node.js `v24.19.0`で`scripts/verify-dynamic-fake-provider-failures.ts`
- Docker CLI: `C:\Program Files\Docker\Docker\resources\bin\docker.exe`
- Docker CLI SHA-256: `C8EAA01D1E78CAECD65D730E670CBFE4DFCE006E1C6F18167C003587CB4BB610`
- Authenticode: `Valid`、署名主体 Docker Inc
- Docker client／server: `28.1.1`／`28.1.1`
- Engine: Linux `x86_64`、WSL2 kernel `6.6.87.1-microsoft-standard-WSL2`
- image: `python@sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047`
- image ID: `sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047`
- network: `none`

## 結果

| scenario | status | reason | cleanup | container／Filesystem Effect | Network／Authority／Capability／readiness |
| --- | --- | --- | --- | --- | --- |
| timeout | `blocked` | `docker_isolation_probe_timeout` | `confirmed` | `true`／`true` | すべて`false` |
| output limit | `blocked` | `docker_isolation_probe_output_too_large` | `confirmed` | `true`／`true` | すべて`false` |
| invalid output | `blocked` | `docker_isolation_probe_invalid_output` | `confirmed` | `true`／`true` | すべて`false` |
| nonzero exit | `blocked` | `docker_isolation_probe_failed` | `confirmed` | `true`／`true` | すべて`false` |

- command exit: `0`。4件がそれぞれ期待する安全停止と回収完了へ一致したことを表す
- contract: `crdd-coordinator/dynamic-fake-provider-failure-verification` revision 1
- scenario count: 4
- recovery required: 全件`false`
- manual recovery required: 全件`false`
- 実行後の所有container: 0
- 実行後のOperation一時Directory: 0

stdoutは1,486 UTF-8 byte、SHA-256は`0F001FA4A79667F1A805FBF8094A964AFB35EF51563E2C004F78A1843D74F804`、stderrは0 byteだった。stdoutはPath、container ID、Credential、OAuth stateまたはraw Provider出力を含まない安全な正規化要約だが、Repositoryには上表と再識別用のbyte数／Hashだけを保持する。

## 未評価と再確認条件

- signal、`spawnSync`実行中の取消、意図的cleanup失敗および残存containerの実Docker scenario
- 実Codex／Claude、OAuth、固定Provider image／CLI、Provider endpoint限定Egress、quota／billing、Telemetryおよび実Operation接続

これらは`Not Verified`または未実装で、OwnerはQual-Labである。非同期lifecycle、cleanup／recovery契約変更、固定image／Docker CLI変更または実Provider Adapter着手時に再確認する。12 blocker、6 current-run evidence、Gate blocked、Authority／Capability非発行、v0.18 Candidate、v0.17 Released Baselineおよび非Releaseを維持する。
