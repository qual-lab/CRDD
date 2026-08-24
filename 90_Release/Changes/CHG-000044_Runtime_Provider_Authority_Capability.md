# 変更トレース: Runtime Provider Authority Capability

- 変更ID: `CHG-000044`
- 状態: `Implementation in Progress`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-24
- 対象: 静的な署名済みProvider Authority要求と、実行直前の動的Mount Grantを結合する短命Runtime Capability
- 対象version: v0.18.0 Candidate
- 変更分類: `breaking_private_revision`（Provider Isolation ProfileとAuthority Registryをrevision 3へ更新し、動的Grant参照を署名済み静的成果物から除去）
- 移行要否: `migration_required: false`（productionで永続化済みのrevision 2 Profile／Registry、発行済みRuntime Authorityおよび実Provider Operationは0。旧revisionをaliasまたはfallbackで受理しない）
- 関連正本: [`CHG-000042`](CHG-000042_Provider_Neutral_Delegation_Selection_Grant.md)、[`CHG-000043`](CHG-000043_Docker_Process_Controller.md)、[`19_Maintenance.md`](../../19_Maintenance.md#33-internal-typescript-runtime)

## 結論

署名済みProvider Isolation ProfileとAuthority Registryは、実行ごとにランダム生成される`providerHomeMountGrantRef`を値として保持せず、対象Provider／Profile／Operationに対してRuntime所有の有効Mount Grantが必要であることだけを宣言する。実Grant参照は、起動直前のAuthority再検証とRuntime-owned active mount inspectionが一致した場合だけ、5秒・一回限りのopaque Provider Authority Capabilityへ結合する。

Claude Docker Adapterはactive mountとSelection Grantを検証した後にこのCapabilityを発行し、Process ControllerはRecoveryまたはDocker Effectより前に一回消費する。消費時に同じOperation、Provider、Profile、Scope、Mount Grant、Authority Registry、Grant、BundleおよびTrust Policyを再検証し、発行時から一つでも変化していればEffectを発生させない。公開結果へAuthority source、Path、CredentialまたはCapability内容を出さない。

productionの有効化済みAuthority source loaderはまだ未接続であり、production issuerは必ず`blocked`となる。現在成立しているのは隔離Runtimeによる契約とE2E候補であり、通常RuntimeのProvider Effect許可ではない。

## 原因と代替案

revision 2は署名済みの静的Profile／Registryへ、Operationごとに変わるMount Grant参照を埋め込んでいた。この構造では実行時のランダム参照と一致させるために、各OperationでAuthority Bundleを再署名する必要があり、静的Policyと動的Capabilityの責務が混在する。

- OperationごとにBundleを再署名する案は、Runtimeへ署名秘密鍵を持ち込み、静的Authority配布を実行時許可へ変質させるため採用しない。
- 予測可能なGrant参照を事前割当する案は、衝突、再利用および実Mountとの結合弱化を招くため採用しない。
- 静的成果物はRuntime-owned active Grantの要求だけを署名し、動的参照は短命Capabilityで結合する案を採用する。これによりRelease／Authority署名鍵をRuntimeから分離したまま、実行直前の現在状態へ結合できる。

## 代表例と境界

- 発火例: 同じOperation management Capabilityの有効Claude Mountを観測し、activated Profile／Bundleを再検証できた場合、5秒のcontrol／use aliasを発行する。Process Controllerが同じMountとAuthority Identityを再確認してuse aliasを一回消費した場合だけProvider Effect候補を返す。
- 非発火例: caller supplied Grant ID、別Operation／Provider／Profile、inactive Mount、失効済みGrant、旧revision、差し替わったBundle、再利用済みuse aliasまたはproductionの未接続loaderはCapabilityもEffectも発行しない。
- 境界例: 壁時計または単調時計の経過が5秒未満の場合だけfreshとし、5秒ちょうど、時計後退、非有限時計または乱数衝突はfail closedにする。
- 判定情報不足例: Authority source、active mount、Operation binding、現在時刻または再検証結果を安全に取得できない場合は推測せず`blocked`とする。

## Security invariant

- static Profile／Registryは`issuer: runtime_owned`、`requiredState: active`および`verification: runtime_capability_required`を保持し、動的Grant参照を保持しない。
- 発行時と消費時の両方でAuthority Bundleとactive mountを再検証する。発行時のIdentityと消費時のIdentityは完全一致を要求する。
- Capabilityはprocess-local `Map`／`WeakMap`に保持し、control／useを分離する。最大一回、5秒、process restartで全失効とする。
- Provider AuthorityはSelection Grant、Mount Grant、Operation management Capabilityまたは署名済みAuthorityの代替ではなく、それら全てが同じ現在状態へ結合したことを示す実行直前Capabilityに限る。
- front Agentだけで完了できる場合はProvider Authorityを発行しない。移譲が必要な場合も、異Providerを原則候補としつつ、独立レビュー等の説明可能な特性では同一Providerを選べる既存の経路選定を変更しない。

## 現在の検証結果と残件

Provider Isolation Profile revision 3、Authority Registry revision 3、Runtime Provider Authority revision 1、active mount inspection、Claude Adapter issuerおよびProcess Controller consumerを実装した。隔離E2EはSelection Grant、active Mount、Provider Authority発行、起動直前の一回消費／再検証、固定command、構造化Result、cleanup、Mount解放およびRecovery完了を一続きで通過する。

基準Node.js v24.19.0でCoordinator全521試験、strict source／test typecheck、Biome lint／formatおよびRepository全体Checkerを通過し、Checkerはerror 0／warning 0である。Provider Authority専用coverageはexact 5 source／8 testを2連続で再現し、合計line 1527／1551、function 67／68、branch 381／421を観測した。未到達箇所は防御的catch、乱数衝突および複合fail-closed短絡で、対象別の`Not Verified`義務、代替試験および再確認契機を専用runnerへ保持する。

残件はproductionのactivated Authority source loader、Provider eligibility／Profile resolver、検証済みDocker Effect executor、durable Recovery adapter、実Docker／Claude E2E、Codex Adapter、残る経路E2E、独立Architecture／Security review、Gap／Impact AuditおよびPRである。

現在、人間による追加判断は必要ない。保護対象の採用、統合、Releaseまたはリスク受容は行わない。
