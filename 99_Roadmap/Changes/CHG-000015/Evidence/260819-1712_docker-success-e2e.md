# CHG-000023 実Docker正常scenario Evidence

## 結論

固定Docker Desktop Linux Engine上で動的Fake Providerの正常scenarioを実行し、Fake限定ライフサイクル、結果正規化、container／process tree不存在およびHost cleanupを同じrunで確認した。実行後の所有containerとOperation一時Directoryは0、回復は不要だった。これは実Provider、OAuth、Egress、Operation AuthorityまたはCapabilityの成立を示さない。

## 対象と実行条件

- Repository: CRDD公式Repository
- Git Object Format: `sha1`
- Observed HEAD: `63e33e727c37d2003dc300d6282b6658eb309b2a`
- Root Tree: `83e239f6cd72aefddb799e03778dea1d2a1acc8a`
- 実行直前の状態: index差分0、worktree差分0、未追跡0
- 実行時刻（UTC）: 2026-08-19T08:08:39.1706761Zから2026-08-19T08:08:41.1105853Z
- cwd: Repository root
- command: 固定Node.js `v24.19.0`で`tools/coordinator/bin/coordinator.ts doctor --isolation --json`
- Docker CLI: `C:\Program Files\Docker\Docker\resources\bin\docker.exe`
- Docker CLI SHA-256: `C8EAA01D1E78CAECD65D730E670CBFE4DFCE006E1C6F18167C003587CB4BB610`
- Authenticode: `Valid`、署名主体 Docker Inc
- Docker client／server: `28.1.1`／`28.1.1`
- Engine: Linux `amd64`、WSL2 kernel `6.6.87.1-microsoft-standard-WSL2`
- image: `python@sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047`
- image ID: `sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047`
- network: `none`

## 結果

| 項目 | 結果 |
|---|---|
| command exit | `2`。全体Gateが既存blockerにより`blocked`であるためで、Fake正常scenarioの失敗ではない |
| private doctor | `reportVersion:4`、全体`status:blocked` |
| `execution.filesystem` | `confirmed`／`docker_fake_provider_isolation_confirmed` |
| 動的Fake lifecycle | `verified`／`dynamic_fake_provider_result_observed` |
| Fake process | 実行済み |
| 結果正規化 | 確認済み |
| elapsed | 475 ms |
| Fake stdout／stderr | 234 byte／0 byte |
| Fake exit／signal／timeout | 0／null／false |
| container不存在 | 確認済み |
| container内process tree不存在 | 確認済み |
| Host cleanup | 確認済み |
| 診断Docker container Effect | `true` |
| 診断Filesystem Effect | `true` |
| Provider Network Effect | `false` |
| Runtime Authority／Operation Capability | `false`／`false` |
| 実Provider readiness | `false` |
| recovery required | `false` |
| 実行後の所有container | 0 |
| 実行後のOperation一時Directory | 0 |

stdoutは116465 UTF-8 byte、SHA-256は`C497F7AE272DA9B2D1D27625F559D4C93B7096821AF1427D375F6522FC19EF9B`、stderrは0 byteだった。raw stdoutはHost情報を含む大きなprivate doctor出力であり、情報最小化のためRepositoryへ保存しない。上表の安全な正規化結果、対象Identity、実行方法、byte数およびHashにより再識別する。

## 未評価と再確認条件

- 意図的timeout、出力超過、不正結果、非0終了、signal、残存またはcleanup失敗の実Docker scenario
- `spawnSync`実行中の取消
- 実Codex／Claude、OAuth、固定Provider image／CLI、Provider endpoint限定Egress、quota／billing、Telemetryおよび実Operation接続

これらは`Not Verified`または未実装で、OwnerはQual-Labである。専用failure verification、非同期lifecycle、固定image／Docker CLI変更または実Provider Adapter着手時に再確認する。12 blocker、6 current-run evidence、Gate blocked、Authority／Capability非発行、v0.18 Candidate、v0.17 Released Baselineおよび非Releaseを維持する。
