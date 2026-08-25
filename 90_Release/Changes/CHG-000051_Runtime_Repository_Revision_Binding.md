# 変更トレース: Runtime Repository／Revision結合

- 変更ID: `CHG-000051`
- 状態: `Implementation in Progress`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-25
- 対象: Operation対象Repository実体と開始RevisionをProvider Effect前後へ固定するRuntime binding
- 対象version: v0.18.0 Candidate
- 変更分類: `additive`（Repository Operation Runtime revision 1、Docker Process Controller revision 5）
- 移行要否: `migration_required: false`（発行済みproduction OperationとProvider Effectは0。永続Schemaを変更しない）
- 関連正本: [`CHG-000015`](CHG-000015_Coordinator_Runtime_1_0.md)、[`CHG-000043`](CHG-000043_Docker_Process_Controller.md)、[`CHG-000049`](CHG-000049_Runtime_Docker_Effect_Executor.md)

## 結論

Runtime-owned Operation management Capabilityへ、対象worktree、common Git metadataおよび開始時HEAD Object IDを結合する。Logical Repository Identityはcommon Git directoryのFilesystem Identity、Repository Instance Identityはworktree rootのFilesystem Identityからdomain-separated SHA-256として再構成し、caller supplied Repository IdentityまたはRevisionを受理しない。

Docker Process Controllerはprepared planをconsumeした後かつAuthority／Recovery／Docker Effectより前と、Provider終了・全cleanup後かつResult公開より前に同じbindingを再観測する。開始前に不一致ならEffectを開始せずMount leaseを返し、終了時に不一致なら正規化ResultとHashを破棄する。

## 代表例と境界

- 発火例: 通常worktree、限定gitfile worktreeまたはlinked worktreeの同一実体で、loose ref、packed refまたはdetached HEADのObject IDが開始時から一致する。
- 非発火例: relative Path、偽造management Capability、二重binding、不正ref、Repository実体差替えまたは開始後のHEAD変更は受理しない。
- 境界例: Provider自身がRepositoryを変更できない隔離構成でも、同時Human／別Operationによる対象Revision変更を結果公開前に検出する。
- 判定情報不足例: Git metadata、ref、Filesystem Identityまたは安定同一file読取りを確認できなければProvider Effectを開始しない。

## Security invariant

- Path、Filesystem Identity、Repository IdentityまたはRevision capabilityの内部値をProviderへ渡さず、公開結果にはPathを含めない。
- HEAD、loose refおよびpacked-refsは上限付きで同一handleから読み、読取り前後のIdentity／size／時刻とPath実体を再確認する。
- heads／tags以外のref、Object ID以外のdetached HEAD、曖昧なpacked refまたはsymbolic linkを拒否する。
- binding capabilityはprocess-local opaque objectで、同じmanagement Capability以外へ流用できない。
- Revision不一致時もDocker cleanup、Mount releaseおよびRecovery完了を省略しない。

## 現在の検証結果と残件

Repository実体／Revision binding、opaque capability、二重発行拒否、loose／packed／detached解決、開始前不一致停止および終了時Result破棄の契約試験を追加した。Repositoryへのcanonical Effectは追加せず、Providerは隔離されたlocal candidateだけを扱う境界を維持する。

残件はCoordinator facade、実Claude production-like E2E、Codex adapter／逆方向経路、独立レビュー／監査および最終統合判断である。

現在、人間による追加判断は必要ない。保護対象の採用、統合、Releaseまたはリスク受容は行わない。

## 2026-08-25 現在状態への接続

上記「現在の検証結果と残件」は本変更を固定した時点の履歴であり、現在の残件表示ではない。Coordinator一般Task facade、Codex／Claude両Adapterおよびcross-provider経路は後続変更でproduction候補へ接続済みである。Coordinator Runtime 1.0の現在状態と残件は[`CHG-000015`](CHG-000015_Coordinator_Runtime_1_0.md)および[`Roadmap 08`](../../99_Roadmap/01_Product_Roadmap.md)を正本とする。本変更のRepository／Revision bindingと結果公開前再照合は維持する。
