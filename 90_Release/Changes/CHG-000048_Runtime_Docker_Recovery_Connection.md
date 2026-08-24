# 変更トレース: Runtime Docker Recovery接続

- 変更ID: `CHG-000048`
- 状態: `Implementation in Progress`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-25
- 対象: Docker Effect前後のHost Recovery record遷移をProcess Controllerへ接続するRuntime-owned Recovery adapter
- 対象version: v0.18.0 Candidate
- 変更分類: `additive`（Docker Recovery Runtime revision 1とProcess Controller revision 4）
- 移行要否: `migration_required: false`（発行済みproduction OperationとDocker Effectは0。既存Host Recovery schemaを変更しない）
- 関連正本: [`CHG-000043`](CHG-000043_Docker_Process_Controller.md)、[`CHG-000015`](CHG-000015_Coordinator_Runtime_1_0.md)

## 結論

既存のRuntime-owned Host Recovery recordを再利用し、同じOperation management Capabilityが結合された`host_only`状態だけをDocker Effect前の`docker_submission_started`へ遷移させる。所有process tree、containerおよびnetworkの不存在とMount lease解放をProcess Controllerが確認した後だけ、opaqueな一回限りのRecovery Capabilityで`host_only`へ戻す。

新しい永続store、caller supplied tokenまたは汎用Recovery APIは追加しない。Production Process Controllerにはprepared plan consume、Provider Authority consume、Mount lease完了およびdurable Recoveryを接続したが、Docker CLI Effect executorはまだ未接続である。このため通常入口はRecovery記録やDocker commandより前に`blocked`を維持する。

## 代表例と境界

- 発火例: activeなOperation management Capabilityと同じOperation IDを持つprepared planだけが、現行Host Recovery Hashを`docker_submission_started`へ更新する。
- 非発火例: plain copy、別Operation、未知Capability、古いrecord Hash、`host_only`以外からの開始および重複完了は遷移しない。
- 境界例: Provider requestが成功しても所有resource不存在、Mount lease解放またはRecovery完了のどれかが不成立ならResultを公開せずmanual Recoveryへ止める。
- 判定情報不足例: management binding、Host Recovery state、Filesystem Identityまたは現行Hashを確認できなければDocker Effectを開始しない。

## Security invariant

- RecoveryはOperation root、nonce、現行record Hashおよびprocess-local management Capabilityへ結合する。
- Recovery IDは内部Host Recovery token parserを通過したRuntime生成値だけを受理し、Provider、callerまたはprepared plain dataから取得しない。
- Recovery完了Capabilityはprocess-local、一回限り、同じmanagement Capability専用である。
- Recovery開始が成立する前にDocker Effectを発火せず、cleanup不明時に`host_only`へ戻さない。
- Provider Home Path、Credential、Docker argvまたはHost Recovery tokenをProvider Resultへ含めない。

## 現在の検証結果と残件

Docker Recovery Runtimeの隔離契約試験とProduction Host Recovery遷移試験を追加した。基準Node.js v24.19.0でRecovery 5試験、Process Controllerを含む対象22試験およびstrict source／test typecheckを通過した。新Recovery Runtimeの単独coverageはline 98.86%、branch 96.30%、function 100%であり、未到達lineはProduction dependencyがRecovery開始後に例外化した場合の防御catchである。実Docker Effectは未接続なので発火していない。

残件は実cleanup／timeout／cancel異常系、Provider eligibility実観測、有効化済みAuthority source loader、Codex Adapter、実Provider E2E、独立レビュー／監査およびPRである。固定Docker CLI Effect executorは`CHG-000049`で接続済みである。

現在、人間による追加判断は必要ない。保護対象の採用、統合、Releaseまたはリスク受容は行わない。
