# CHG-000015 Docker Fake Provider隔離Probe記録

## 固定対象

- 実装Commit: `06f1314c32b10b119fb6bddc742204cc7f70021b`
- 実装Tree: `35a82ee2856e9851087c80ef7215d071fc77dc9d`
- 実行時刻（UTC）: `2026-08-10T19:42:49Z`
- 実行時Working State: `clean`
- 実行方法: `coordinator doctor --isolation --json`

## 実行環境と固定Identity

- Backend: Windows上のDocker Desktop local Linux engine
- Engine endpoint種別: 固定local named pipe
- Server OS確認: `linux`
- Docker CLI Trust Anchor: 固定install root、Docker Incの有効なAuthenticode署名を確認して選択した実体、SHA-256 `C8EAA01D1E78CAECD65D730E670CBFE4DFCE006E1C6F18167C003587CB4BB610`
- Probe image: `python@sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047`
- image取得: `--pull=never`

Host絶対Path、Docker CLIの生出力、Credential値、Docker設定内容またはUser Homeは記録していない。

## 隔離条件

- Runtimeがfactory発行したOperation childだけをmount元とし、private CapabilityとFilesystem実体Identityをcreate前、start前および終了後に照合
- `workspace/`、`provider-home/`、`tmp/`の3領域だけをread-write bind mount
- Runtimeの`events/`、`projection/`、`management/`、通常Home、Credential StoreおよびDocker socketは非mount
- container root filesystemはread-only
- Linux Capability全削除、`no-new-privileges`、非root user、PID上限、`--network=none`
- `docker create`が返したcontainer IDと、name、label、image、command、mount、Network、Capability、Security、PIDおよびuserをinspectしてから起動
- cleanupは同じcontainer IDだけを対象とし、削除後のID不存在と同名／同label残留なしを確認

## 正規化結果

| 項目 | 結果 |
|---|---|
| 許可3領域への書込み | `confirmed` |
| Runtime管理領域の非公開 | `confirmed` |
| Credential環境名の非継承 | `confirmed` |
| Credential Pathの非mount | `confirmed_for_fake_probe` |
| 専用Home／tmp | `confirmed` |
| Fake Provider Network遮断 | `confirmed` |
| container cleanup／不存在 | `confirmed` |
| Host Operation領域cleanup | `confirmed` |
| 全体Gate | `blocked` |

全体Gateが`blocked`である主因は、Provider endpoint限定Egress、Claude Code CLI、Codex／Claude Codeの認証・Active Probe・自動更新・Telemetry・Session再開・timeout・cancel・process tree終了が未成立であるためである。Fake Probe合格を実Provider利用許可へ流用しない。

## 共通機械確認

- Coordinator局所試験: `21 / 21 Pass`
- Checker試験: `143 / 143 Pass`
- 全体Checker: 172 files、Markdown 123、links 1,671、anchors 555、Error 0、Warning 0
- `git diff --check`: clean
- Probe後のownership label対象container: 0件

## 未評価範囲

- Docker imageの署名・来歴を含む供給網検証
- Docker daemon／Host管理者と同等権限を持つ敵対主体
- 実Provider用endpoint限定Egress
- Codex／Claude Codeの専用image導入、認証およびActive Probe
- 自動更新、Telemetry、Session再開、timeout、cancelおよびprocess tree終了
- Protocol、Operation Store、Provider Adapter、Repository Adapterおよび実Operation
- Runtime配布、採用、移行、準拠およびRelease

本記録は上記固定実装のFake Provider隔離Probe根拠であり、Runtime完成、実Provider利用可能、CRDD準拠、採用またはReleaseを意味しない。
