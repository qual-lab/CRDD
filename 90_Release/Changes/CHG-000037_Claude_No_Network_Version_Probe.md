# 変更トレース: Claude無通信Version Probe（Claude No-Network Version Probe）

- 変更ID: `CHG-000037`
- 状態: `In Progress`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-24
- 対象: Claude Code 2.1.220の署名済み配布Identity確認と外部送信なしの実binary起動
- 対象version: v0.18.0 Candidate
- 変更分類: `breaking`（private Claude Execution Plan revision 2→3。実Provider requestは有効化しない）
- 移行要否: `migration_required: true`（発行済みProvider state、OAuth session、Mount Grantおよびproduction consumerは0。旧revisionへのalias／fallbackは設けず永続変換なし）
- 関連正本: [`CHG-000028`](CHG-000028_Claude_Execution_Plan_Foundation.md)、[`CHG-000036`](CHG-000036_AppContainer_Provision_Worker_Candidate.md)、[`実装残件台帳`](../../99_Roadmap/08_CRDD_v0_18_Implementation_Follow_Up_Registry.md)

## 結論と変更経路

Anthropic公式公開鍵のfingerprint、detached manifest署名、Linux x64 binaryのbyte長およびSHA-256を順に検証し、検証したexact binaryをDocker Desktop Linux Engine内で`--version`だけ起動した。固定base image digest、`--network=none`、read-only root、全Linux Capability削除、`no-new-privileges`、非root user、PID上限16およびread-only binary mountを使用し、Repository、専用Provider Home、Credential、OAuth sessionまたはworkspaceをmountしなかった。結果はexit 0、`2.1.220 (Claude Code)`で、終了後にcontainerと一時artifactを削除した。

この結果は、公式配布Identityへ結合した実Claude binaryが既存Docker隔離内で起動・終了できることだけを成立させる。モデルrequest、外部送信、認証、subscription利用枠消費、Telemetry、固定Provider image、最終argv、Provider Home、Mount Grant、Authority、CapabilityまたはGateを成立させない。

変更経路は管理対象依存、外部情報、Provider processおよび将来のNetwork Effectに関わるprivate security変更である。外部へ送信したのは公開URLと公開versionだけで、Repository内容、Path、Credential、利用者情報または実probe promptを送信していない。通常Runtimeや公開CLIを変更せず、Claude Execution Planの実測状態と残るblockerだけを更新する。

2026-08-24の全source命名検査で、実測結果を保持するmodule-local binding `NO_NETWORK_VERSION_PROBE`が動的な凍結objectのため真の定数分類ではなく一般bindingとして扱われる同期漏れを検出した。`noNetworkVersionProbe`へ意味不変renameし、公開property、値、契約revisionおよび利用側を変更せず、Checker全151試験と両private package `check`を再合格させた。

## 発火・非発火・境界・情報不足

- 発火例: 人間が明示した検証で、公式公開鍵fingerprint、manifest署名、binary byte長／Hash、固定Docker条件および`--version`だけが同じrunで成立する場合に限り、外部送信なしversion probeをexact 1回起動する。
- 非発火例: 通常`doctor`、Runtime Gate、Provider lifecycle、OAuth login、固定prompt probe、Repository処理、PATH lookup、Host Claude CLIまたはAPI keyからは発火しない。
- 境界例: `--version`はProvider requestを発生させない配布成立性確認であり、固定prompt probeのargv互換性、課金不存在または認証済み状態の証明へ流用しない。固定base imageとread-only artifact mountは最終固定Provider image digestの代替ではない。
- 判定情報不足例: fingerprint、detached署名、byte長、Hash、container設定、exit、出力、container不存在または一時artifact削除の一件でも確認不能なら、検証済みversion probeとして記録しない。

## 公式入力と実測

2026-08-24にAnthropic公式の[`Advanced setup`](https://code.claude.com/docs/en/getting-started)、[`CLI reference`](https://code.claude.com/docs/en/cli-usage)および[`Enterprise network configuration`](https://code.claude.com/docs/en/corporate-proxy)を確認した。公式setupはrelease signing key fingerprint `31DD DE24 DDFA B679 F42D 7BD2 BAA9 29FF 1A7E CACE`、detached manifest署名、platform checksum照合および`claude --version`による導入確認を示す。CLI referenceは固定prompt probeで後続確認する`--bare`、`--tools ""`、`--disallowedTools`、`--max-turns`、`--no-session-persistence`等の現行意味を示す。Network資料は認証と通常requestに必要なoriginが複数あることを示すため、version probe成功をEgress完成へ昇格しない。

実測の固定値と終了状態は[`Verification Run Record`](Evidence/CHG-000037_Claude_No_Network_Version_Probe_20260824.md)を正本とする。

## 未完了と処置

- manifest署名とbinary IdentityのRuntime-owned verifier／artifact storeへの接続
- 最終固定Provider image digestまたは同等の起動時artifact Identity固定
- 固定prompt argvのexact version実測、親環境完全置換およびsettings/customization遮断
- selected-user binderの署名済みend-to-end再検証は固定commit `cfb003c`で完了した。protected activeおよび専用Provider Home保護は未完了
- Mount Grant issuer／clock／atomic store／consume／revokeと実mount Adapter
- Provider endpoint限定Proxy、DNS／TLS／Telemetry制御および同一runのEgress観測
- 既存subscription OAuthの明示login、選択アカウント／適用条件／人間Authority、quota観測および追加購入停止
- timeout、cancel、process tree終了、結果構造化およびCoordinator統合

本変更はv0.18 Candidate、Gate blocked、Authority／Capability非発行および非Releaseを維持する。保護対象の採用・統合、利用条件の有効化、OAuth login、外部request、残存risk受容およびReleaseは人間の決定権限へ残す。
