# 変更トレース: Coordinator→Claude Probe Runtime Facade

- 変更ID: `CHG-000052`
- 状態: `Implementation in Progress`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-25
- 対象: Repository bindingからClaude boolean Resultと全cleanupまでを結ぶRuntime-owned facade
- 対象version: v0.18.0 Candidate
- 変更分類: `additive`（Coordinator Runtime revision 1、Docker Process Controller pre-effect cleanup結果追加）
- 移行要否: `migration_required: false`（発行済みproduction Coordinator Operationは0。永続Schemaを変更しない）
- 関連正本: [`CHG-000043`](CHG-000043_Docker_Process_Controller.md)、[`CHG-000049`](CHG-000049_Runtime_Docker_Effect_Executor.md)、[`CHG-000050`](CHG-000050_Local_Personal_Authority_and_Bounded_Eligibility.md)、[`CHG-000051`](CHG-000051_Runtime_Repository_Revision_Binding.md)

## 結論

Repository実体／Revision、説明可能なProvider／model選定、selected-user Provider Home二回観測、Mount Grant issue／consume、Local Personal Authority、固定Claude Docker plan、Process Controller、structured ResultおよびOperation root回収を一つのRuntime-owned入口へ接続した。

Facadeがcallerから受けるのはroot Operationの分類情報、Repository RootおよびRelease評価時刻だけである。Operation ID、親子関係、Capability、Provider Home Path、Authority、Docker argvまたはcleanup対象名はRuntimeが生成する。現在の縦断対象は既に実測済みのClaude Subscription boolean probeであり、一般タスクPrompt、Repository workspace write、Codex Effect Adapterまたは逆方向Executor完成を意味しない。

## 代表例と境界

- 発火例: Front Codexの具体化済み低リスク実装分類をClaudeへ理由付きで選び、固定`{status:true}` Resultを全cleanup後に返す。
- 非発火例: 動的getter／Proxy、余分・欠落分類、Repository不成立、Claude以外の選定、署名Release不成立、Provider Home差、Grant差またはAuthority差はEffect前に停止する。
- 境界例: 実行中取消はopaque Coordinator Capabilityからactive Process Controllerへだけ渡し、Provider Resultよりcleanup結果を優先する。
- 判定情報不足例: Process Controller起動失敗時にMount cleanupが確認できない場合、Operation rootを削除せずmanual Recoveryへ保持する。

## Security invariant

- Facadeは直接Provider spawnを行わず、Selection→Mount→Authority→Revision→Recovery→Effectの順序を短絡しない。
- Provider HomeをGrant前とconsume直前に別々に観測し、同一Identity／保護／selected-user bindingを要求する。
- pre-effect失敗では未使用Selection／Mount Grantの失効成功を確認した後だけOperation rootを削除する。
- Docker開始後はProcess Controllerによるprocess tree、container、network、Mount leaseおよびRecoveryの全cleanup確認後だけOperation rootを削除する。
- cleanup不明ではResultを公開せず、Operation rootとRecovery情報を保持してfail closedにする。

## 現在の検証結果と残件

縦断成功、取消、Mount consume失敗時の二Grant失効、Docker cleanup不明時のroot保持、起動失敗時のroot保持、動的入力拒否およびsource checkout production停止を契約試験へ追加した。

残件は署名配布物上の同Facade実Claude run、一般タスクPacket／隔離workspace、Codex Adapterと逆方向経路、独立レビュー／監査および最終統合判断である。

現在、人間による追加判断は必要ない。保護対象の採用、統合、Releaseまたはリスク受容は行わない。

## 2026-08-25 現在状態への接続

上記「現在の検証結果と残件」はboolean probe facadeを固定した時点の履歴であり、現在の残件表示ではない。一般Task Packet、隔離workspace、Candidate Revision、独立Reviewer、Codex／Claude両Adapterおよびcross-provider経路は後続変更でproduction候補へ接続済みである。Coordinator Runtime 1.0の現在状態と残件は[`CHG-000015`](CHG-000015_Coordinator_Runtime_1_0.md)および[`Roadmap 08`](../../99_Roadmap/08_CRDD_v0_18_Implementation_Follow_Up_Registry.md)を正本とする。本変更の順序、取消およびcleanup不明時のfail closed境界は維持する。
