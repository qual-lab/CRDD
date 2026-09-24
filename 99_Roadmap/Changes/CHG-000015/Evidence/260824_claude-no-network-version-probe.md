# CHG-000037 Claude無通信Version Probe実行記録

- 対象変更: [`CHG-000037`](../CHG-000037_Claude_No_Network_Version_Probe.md)
- 記録種別: `external_distribution_and_no_network_process_verification`
- 実行日: 2026-08-24（Asia/Tokyo）
- 状態: 実Claude Code binaryの外部送信なしversion probe成功。Provider request、認証、GateまたはReleaseの成立記録ではない。

## 配布Identity

| 観測 | 結果 |
| --- | --- |
| version | `2.1.220` |
| upstream commit | `4073f59596e272f39393db4f96abc5f4b10eff21` |
| target | `linux-x64` |
| release signing key fingerprint | `31DDDE24DDFAB679F42D7BD2BAA929FF1A7ECACE` |
| detached manifest signature | `Good signature` |
| binary bytes | `275012592`、manifest一致 |
| binary SHA-256 | `674f61f20ff306f3100cf9200e4c36c4b70278b5bef2884549819b942a89c863`、manifest一致 |

公開鍵は一時専用GnuPG homeへimportし、利用者の既存GnuPG stateへ追加しなかった。manifestと署名は`https://downloads.claude.ai/claude-code-releases/2.1.220/`、公開鍵は`https://downloads.claude.ai/keys/claude-code.asc`から取得した。

## 実process条件と結果

| 条件／観測 | 結果 |
| --- | --- |
| base image | `python@sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047` |
| entrypoint | `/opt/crdd/providers/claude/2.1.220/claude` |
| argv | `--version` |
| Docker network mode | `none` |
| root filesystem | read-only |
| Linux Capability | `ALL` dropped |
| privilege | `no-new-privileges`、user `65534:65534` |
| PID上限 | `16` |
| binary mount | read-only |
| Repository／workspace mount | 0 |
| Credential／Provider Home mount | 0 |
| process exit | `0` |
| stdout | `2.1.220 (Claude Code)` |
| 終了時running | `false` |

このrunは`--network=none`かつ`--version`だけであり、Prompt、Provider request、OAuth、subscription利用、API key、Telemetryまたは追加購入を発火していない。固定base imageとbind-mounted exact binaryでの成立性確認であり、最終固定Provider image digest、固定prompt argv互換性またはRuntime-owned artifact verificationを証明しない。

## 終了後状態

- probe container: ID／nameで残存0
- probe専用Docker network: 残存0（作成なし）
- 一時binary、manifest、署名、公開鍵および専用GnuPG home: 残存0
- Repository／Provider Home／Credential／Trust Store／Registry: Effect 0
- API key、Provider request、subscription利用、追加購入、merge、Release: Effect 0

## 残るblocker

専用Provider Home、Mount Grant、Runtime artifact verifier、最終固定Provider image、Egress Proxy、OAuth／アカウントAuthority、quota、固定prompt argv、timeout／cancel／tree終了およびstructured resultは未完了である。したがってnormal Runtime Gateと実Claude requestは`blocked`を維持する。
