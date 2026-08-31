# CHG-000015 Docker cleanup／Host recovery確認

- 対象Commit: `ef46cac379ac466b55fd144605cf3eb4dfbd45a9`
- 対象Tree: `588d1dede634034123263b0da1a4537e95ed44e5`
- 実行日時（UTC）: `2026-08-10T19:59:26Z`
- 実行状態: clean working tree
- Runtime: Node.js `v22.18.0` / Windows
- Engine: Docker Desktop local Linux engine named pipe
- Docker CLI SHA-256: `C8EAA01D1E78CAECD65D730E670CBFE4DFCE006E1C6F18167C003587CB4BB610`
- Probe image: `python@sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047`

## 実行条件

`doctor --isolation --json`を固定Commitのclean treeで一回実行した。Fake Provider containerはread-only root、全Capability削除、`no-new-privileges`、PID上限、非root user、`--network=none`、固定Digest、固定Docker Desktop Linux engineを使用した。mountはOperation専用の`workspace/`、`provider-home/`、`tmp/`だけであり、Runtime管理領域、通常Home、Credential StoreおよびDocker socketは含めていない。

Docker CLIは固定install root、実体Identityおよび承認Hashへ照合した。Host絶対Path、container ID、Dockerの生stdout／stderr、Credential値またはDocker設定内容は本Evidenceへ保存しない。

## 正規化結果

| 確認対象 | 結果 |
|---|---|
| Fake Provider Filesystem隔離 | `confirmed` |
| Fake Provider Credential path非公開 | `confirmed_for_fake_probe` |
| Fake Provider Network | `blocked`（`--network=none`） |
| container不存在 | 完全ID、完全名、完全ownership labelの3独立照会がすべて成功かつ0件 |
| Probe container残存 | 0 |
| Host Operation root残存 | 0 |
| 外部Host recovery marker残存 | 0 |
| 回復要求 | `false` |
| 全体Gate | `blocked` |

全体Gateが`blocked`なのは、Provider endpoint allowlist、Codex／Claude認証、Active Probe、自動更新／Telemetry、Session再開、timeout／cancelおよびprocess tree終了が未実装または未評価であり、Claude CLIも未検出だからである。Fake Probeの隔離結果を実Provider利用許可へ流用しない。

## 機械確認

- Coordinator局所試験: 24／24 Pass
- Checker試験: 143／143 Pass（既存共通結果を保持し、今回変更後の全体確認と分離）
- 全体Checker: 173 files、Markdown 124、links 1,672、anchors 555、Error 0、Warning 0
- `git diff --check`: clean

## 未評価

- 実Codex／Claude Providerの認証、起動、Session再開およびprocess lifecycle
- Provider endpoint限定Egress
- Docker daemonまたはHost管理者相当の敵対主体
- Docker image署名および供給網
- create要求のcontainer ID取得前timeout後における自動回復
- Protocol、Operation Store、Provider Adapter、Repository OperationおよびE2E
- 配布、採用、移行、準拠、Release

本記録はFake Provider隔離とcleanup／Host recoveryの固定実測であり、Runtime完成、実Operation許可、CRDD準拠、採用またはReleaseを意味しない。
