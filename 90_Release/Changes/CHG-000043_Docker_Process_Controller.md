# 変更トレース: Docker Process Controller

- 変更ID: `CHG-000043`
- 状態: `Implementation in Progress`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-24
- 対象: Claude Docker Runtime Adapterのprepared planからtimeout、cancel、終了、cleanupおよびRecoveryを所有するProcess Controller
- 対象version: v0.18.0 Candidate
- 変更分類: `additive`
- 移行要否: `migration_required: false`（production Effect executorは未接続で実Operationは0）
- 関連正本: [`CHG-000042`](CHG-000042_Provider_Neutral_Delegation_Selection_Grant.md)、[`19_Maintenance.md`](../../19_Maintenance.md#33-internal-typescript-runtime)

## 結論

Runtime-owned Adapterのopaque prepared Capabilityを一回だけconsumeし、Docker command列、Provider request、timeout、取消、所有container／network cleanup、Mount lease解放およびRecovery完了を一つの状態機械へ接続するcomponent候補を追加した。Recovery記録がDocker Effect前に成立しない場合はprepared planを実行せずMount leaseを返す。Docker Effect開始後は、process tree、container、network、Mount leaseおよびRecovery recordの全終了を確認できなければProvider結果を成功へ昇格させない。

Claude CLIのJSON Envelope normalizerを追加し、単一JSON document、重複keyなし、`type: result`、`subtype: success`、`is_error: false`、1〜2 turns、有限かつ`$0.10`以下のAPI相当cost、およびexact `{status: true}`の`structured_output`だけを受理する。成功時も生stdout／stderr、Docker argv、Provider Home Path、session ID、usageまたはProxy credentialを返さず、全cleanup後に正規化Result、byte数およびSHA-256だけを返す。Envelope仕様はAnthropicの[headless CLI](https://code.claude.com/docs/en/headless)と[Agent SDK Result型](https://code.claude.com/docs/en/agent-sdk/typescript)を設計入力とし、実run Evidenceのboolean Result、2 turnsおよび`$0.04699`観測と照合した。

## 代表例とSecurity invariant

- 発火例: 9個の固定commandを順に実行し、最後のProvider attach出力を上限内で受け、全所有resource不存在、Mount lease解放およびRecovery完了後だけ`completed`とする。
- 非発火例: Effect executor未接続、偽造prepared Capability、不正plan、Recovery開始失敗はDocker commandを開始しない。Providerがexit 0でもEnvelope失敗、重複key、turn／budget超過、`status: false`または余分なStructured Output keyは結果を発行しない。
- 境界例: 300秒timeoutまたは取消ではactive processへ終了要求を出し、その後も同じcleanup Gateを通す。
- 判定情報不足例: cleanup、process tree、container、network、MountまたはRecoveryのいずれかを確認できなければ`manualRecoveryRequired`と回復IDを返してfail closedにする。
- cancellation controlはprocess-local opaque Capabilityとしてmanagement Capabilityへ結合し、重複または別Operationからの取消を拒否する。
- stdout 1 MiB、stderr 256 KiB、setup 10秒、Provider 300秒、取消猶予5秒を固定する。
- cleanup不成立時はresult Hashとbyte数も公開せず、成功したProvider requestとrun全体の成功を分ける。

## 現在状態と残件

Claude Result normalizer、Process Controller revision 2および隔離integrationを追加した。対象試験16／16で、Selection Grant→Claude Adapter→9 command Process Controller→exact `{status: true}`→全cleanup→Mount lease解放→Recovery完了を一続きで確認した。Result不正、timeout、取消、cleanup不明およびRecovery開始失敗も同じ状態機械でfail closedになる。新normalizerの実測coverageはline 97.27%、branch 94.50%、function 100%であり、未到達lineは先行字句走査後の`JSON.parse`が例外化した場合に備える防御catchと、loop末端の防御returnである。

productionの検証済みDocker CLI Effect executor、durable Recovery adapter、Provider eligibility／Profile resolverおよびProvider Authorityは未接続であり、本番入口はEffect前に`blocked`である。次はこれらを任意Docker command APIへ一般化せず、exact prepared planとAuthorityへ結合した狭いproduction Effect adapterとして接続し、実Docker異常系と実Claude vertical sliceを閉じる。

現在、人間による追加判断は必要ない。保護対象の採用、統合、Releaseまたはリスク受容は行わない。
