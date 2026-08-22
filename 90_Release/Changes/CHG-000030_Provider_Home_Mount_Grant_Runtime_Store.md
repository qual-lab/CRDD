# 変更トレース: Provider Homeマウント許可Runtime Store（Provider Home Mount Grant Runtime Store）

- 変更ID: `CHG-000030`
- 状態: `In Progress`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-22
- 対象: CRDD公式Repositoryのprivate CoordinatorにおけるRuntime所有のMount Grant発行、atomic store、clock、一回消費および明示失効
- 対象version: v0.18.0 Candidate
- 変更分類: `non-breaking`（CHG-000029の非Authority Coreを保持し、未接続のRuntime Effectを別moduleとして追加する）
- 移行要否: `migration_required: false`（既存production consumer、永続Grantおよび実mountは0で、既存Schemaを変更しない）
- 関連正本: [`16_Quality_Assurance.md`](../../16_Quality_Assurance.md)、[`19_Maintenance.md`](../../19_Maintenance.md#33-internal-typescript-runtime)、[`CHG-000029`](CHG-000029_Provider_Home_Mount_Grant_Lifecycle_Foundation.md)、[`実装残件台帳`](../../99_Roadmap/08_CRDD_v0_18_Implementation_Follow_Up_Registry.md)

## 結論と変更経路

ローカルOperationのRuntime所有`management/`内だけにGrant recordをatomicに保存し、Runtime clockによる最長5分の発行、一回消費および明示失効を実装する。Provider Home保護、実mount、Operation終了時の自動失効、Credential、Network、Provider processおよび課金Effectは本変更で発火しない。

変更は一回限り認可とFilesystem Effectを追加する非自明なprivate security実装である。着手前整合ではCHG-000029、Provider Home、Operation所有Directory、QA、内部TypeScript境界および台帳を確認し、既存の非Authority Core、最長5分、半開区間、全binding、Path／Credential非表示および通常doctor非Effectを保持した。完成固定版ではAgent／Architecture／Security Review、Document Audit、Gap／Impact AuditおよびConformance Auditを同一改訂版へ実施する。公開CLI、採用Repository Schema、Communication、DiscoveryおよびUIは変更しないため非該当である。

## 発火、非発火、境界および情報不足

- 発火例: Runtime所有Operation mount Capability、exact binding、1〜300,000 msの寿命を明示的なEffect APIへ渡すと、Grant recordを作成するFilesystem Effectが発火する。
- 非発火例: source import、説明contract取得、通常`doctor`、`doctor --isolation`および既存Core評価はGrant recordを作らない。
- 境界例: 同じOperation／Profileの二重発行、二重消費、期限外使用、観測Hash差、余分fieldおよび無効Capabilityは`blocked`へ閉じる。
- 判定情報不足例: Runtime所有Operation identity、現在時刻、current recordまたは使用直前の三観測Hashを確認できない場合は発行、消費または失効しない。

## 保持する意図と目指さないこと

- Grant record、store Path、Provider Home PathおよびCredentialを報告しない。
- API key、追加credit、Host Credentialコピーまたは実Provider起動を許可しない。
- 本変更だけでmount済み、Provider Home保護済みまたはClaude実行可能へ昇格しない。
- 残るProvider Home保護、mount AdapterおよびOperation終了時自動失効は後続変更へ接続する。

## 検証設計と現在品質状態

- 発行、一回消費、二重消費拒否、明示失効、観測差、入力境界、重複storeおよび無効Capabilityを直接試験する。
- strict typecheck、Biome lint／format、Coordinator全試験、Provider Home専用coverage、Checker package試験およびRepository全体checkerを別軸で確認する。
- 固定候補commitに独立レビューと監査を実施する。

基準Node.js `v24.19.0`で、Coordinator strict typecheck／Biome lint／formatはPass、全contract testは402／402だった。Provider Home専用coverageは新規production sourceのline 359／380、function 16／16、branch 56／72を実測した。未到達はFilesystem fault、lock残留、内部不変条件および時刻競合の防御分岐であり、固定義務を`Not Verified`として保持する。固定候補へのRepository全体checkerと独立確認は未実施である。

現在は実装中であり、固定改訂版、監査結果および人間判断は未確定である。
