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

公開結果はProvider outputのbyte数とSHA-256だけを返し、生stdout／stderr、Docker argv、Provider Home PathまたはProxy credentialを返さない。structured result parserは次の接続単位であり、HashだけをHuman Resultへ使用しない。

## 代表例とSecurity invariant

- 発火例: 9個の固定commandを順に実行し、最後のProvider attach出力を上限内で受け、全所有resource不存在、Mount lease解放およびRecovery完了後だけ`completed`とする。
- 非発火例: Effect executor未接続、偽造prepared Capability、不正plan、Recovery開始失敗はDocker commandを開始しない。
- 境界例: 300秒timeoutまたは取消ではactive processへ終了要求を出し、その後も同じcleanup Gateを通す。
- 判定情報不足例: cleanup、process tree、container、network、MountまたはRecoveryのいずれかを確認できなければ`manualRecoveryRequired`と回復IDを返してfail closedにする。
- cancellation controlはprocess-local opaque Capabilityとしてmanagement Capabilityへ結合し、重複または別Operationからの取消を拒否する。
- stdout 1 MiB、stderr 256 KiB、setup 10秒、Provider 300秒、取消猶予5秒を固定する。
- cleanup不成立時はresult Hashとbyte数も公開せず、成功したProvider requestとrun全体の成功を分ける。

## 現在状態と残件

隔離componentとcontract test 6／6を追加した。productionの検証済みDocker CLI Effect executor、durable Recovery adapterおよびClaude Adapter production consumerは未接続であり、本番入口はEffect前に`blocked`である。次はこの三接続、structured result、実Docker異常系および実Claude vertical sliceを閉じる。

現在、人間による追加判断は必要ない。保護対象の採用、統合、Releaseまたはリスク受容は行わない。
