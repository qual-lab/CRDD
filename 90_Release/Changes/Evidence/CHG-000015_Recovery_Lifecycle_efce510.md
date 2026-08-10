# CHG-000015 回復Lifecycle固定結果

## 固定対象

- 実装Commit: `efce510d44668bce763951b6491702c767ac4e6e`
- 実装Tree: `899d518d66bc615a856c315f68c9ab9014eaadd3`
- 実行時刻（UTC）: `2026-08-10T20:32:50Z`
- 実行時Working State: `clean`
- Node.js: `v22.18.0`
- 実行方法: `coordinator doctor --isolation --json`

## 実行基盤

- Backend: Windows上のDocker Desktop local Linux engine
- Engine endpoint種別: 固定local named pipe
- Server OS確認: `linux`
- Docker CLI Trust Anchor SHA-256: `C8EAA01D1E78CAECD65D730E670CBFE4DFCE006E1C6F18167C003587CB4BB610`
- Probe image: `python@sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047`
- image取得: `--pull=never`

Host絶対Path、生stdout／stderr、Credential値、marker本文、nonceおよび内部Capability値は記録しない。

## 回復Lifecycleの確認

- 受動診断はfactoryがprivateに固定した初期`host_only`記録Hashだけを照合し、現在markerからtokenを再生成しない。
- Docker送信後かつ不存在未確認ではDocker回復段階を維持し、Host cleanupへ縮退しない。
- 完全container ID、完全name、完全ownership labelの3軸不存在からだけmodule-private／one-shot Capabilityを生成する。
- Capabilityによる原子的Host marker更新後は更新後Host tokenだけをHost cleanupへ使用する。
- 明示Docker recoveryは既知6 childの部分集合と存在child Identityを確認し、container不存在なら既知childの部分欠落をHost recoveryへ引き継ぐ。
- container残存時だけmount 3件と`management/`の存在・Identityを必須化する。
- Host recovery Schema、Hash検証および状態遷移は共通所有実装を使用する。
- active isolationはHost cleanup完了または現在有効な回復ID付き`blocked`へ閉じる。

## 正規化結果

| 項目 | 結果 |
|---|---|
| Fake Provider Filesystem隔離 | `confirmed` |
| Credential Path非mount | `confirmed_for_fake_probe` |
| Fake Provider Network遮断 | `confirmed` |
| 3軸container不存在 | `confirmed` |
| Host Operation root cleanup | `confirmed` |
| 外部recovery marker cleanup | `confirmed` |
| 回復要求 | `false` |
| 全体Gate | `blocked` |

全体Gateが`blocked`である主因は、Provider endpoint限定Egress、Claude Code CLI、Codex／Claude Codeの認証、Active Probe、自動更新、Telemetry、Session再開、timeout、cancelおよびprocess tree終了が未成立であるためである。Fake Providerの結果を実Provider利用許可へ流用しない。

## 共通機械確認

- Coordinator局所試験: `31 / 31 Pass`
- Checker試験: `143 / 143 Pass`
- Evidence追加前の全体Checker: 176 files、Markdown 126、Links 1,674、Anchors 555、Error 0、Warning 0
- `git diff --check`: clean
- Probe後残留: container 0、Operation root 0、recovery marker 0

## 未評価範囲

- Docker daemonまたはHost管理者相当の敵対主体
- Docker image署名および供給網
- Provider endpoint限定Egress
- Codex／Claude Codeの専用image、認証、Active Probeおよびprocess lifecycle
- container ID取得前timeoutの自動回復
- Protocol、Operation Store、Provider Adapter、Repository Adapterおよび実Operation
- Runtime配布、採用、移行、CRDD準拠またはRelease

本記録は固定実装のFake Provider隔離と回復Lifecycleに限定した実測根拠である。Runtime完成、実Provider利用可能、CRDD準拠、採用、移行またはReleaseを意味しない。
