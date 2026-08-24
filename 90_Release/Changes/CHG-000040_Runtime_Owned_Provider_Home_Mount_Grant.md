# 変更トレース: Runtime所有Provider Homeマウント許可（Runtime-owned Provider Home Mount Grant）

- 変更ID: `CHG-000040`
- 状態: `Implementation in Progress`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-24
- 対象: Coordinator Runtime 1.0のProvider Home Mount Grant issue／consume／revoke
- 対象version: v0.18.0 Candidate
- 変更分類: `breaking`（private Provider Home契約revision 3から4、Mount Grant Runtime契約revision 1を追加）
- 移行要否: `migration_required: true`（Repository内producer／consumerを同時更新し、旧revisionへのalias／fallbackを設けない。発行済みproduction Grantは0）
- 関連正本: [`19_Maintenance.md`](../../19_Maintenance.md#33-internal-typescript-runtime)、[`CHG-000029`](CHG-000029_Provider_Home_Mount_Grant_Lifecycle_Foundation.md)、[`CHG-000030`](CHG-000030_Provider_Home_Mount_Grant_Runtime_Store.md)、[`CHG-000031`](CHG-000031_Runtime_Owned_Operation_Context_Capability.md)、[`CHG-000039`](CHG-000039_Runtime_Owned_Provider_Home_Observation.md)

## 結論

CHG-000030で棄却したcaller由来bindingとfilesystem storeを復活させず、Runtime所有Operation management Capabilityと一回限りのProvider Home観測CapabilityだけをAuthority入力とするprocess-local Mount Grant lifecycle候補を追加した。callerはOperation ID、観測Hash、時計、Path、SID、ACLまたはCredentialを発行入力として渡せない。

Grantは`prepared → issued → consumed → revoked`、最長5分、使用上限1回へ固定する。Runtime所有の壁時計と単調時計を併用し、暗号学的乱数から18桁参照を生成する。control、use、mount authorizationを別々のopaque aliasとし、consume時はfresh観測のProviderとProvider Home Identity／保護／local user binding Hashを再結合する。revokeは全aliasとprocess-local recordを一括失効する。process restartでGrantを永続復元せずfail closedとする。

## 着手前整合と代表例

- 変更経路: Security／Runtime共有契約とprivate Provider Home schemaを変更する非自明な実装変更。Provider Home、Operation context、Docker、Provider lifecycle、QAおよびRoadmap利用側を再開する。
- 着手前整合結果: `着手可`。過去FindingのAuthority provenance、wall-clock-only、unstable file Identity、失効aliasおよびpartial Effect問題を、opaque capability、dual clock、process-local atomic state、別aliasおよび非Effect境界で先に解消する。
- 発火例: 同じRuntime-owned Operation世代のmanagement Capabilityと、直前に成立した一回限りのClaude Provider Home観測Capabilityを渡すと、Provider・Profile・Operation・三Hashに結合したGrantを発行する。freshな一致観測で一回だけconsumeし、mount authorization候補を得る。
- 非発火例: plain Operation ID／Hash、偽造object、別Operation capability、再利用済み観測、使用済みuse alias、unsupported Profile IDはGrant、mount、Filesystemまたはprocess Effectを発火しない。
- 境界例: 発行から5分ちょうど、wall clockまたはmonotonic clockのrollback、fresh観測の一Hash差、Provider差、別isolated storeのaliasはfail closedとする。
- 情報不足例: Operation世代、観測Capability、時計、乱数、Grant遷移または現在のHome bindingを確認できない場合は例外を外へ出さず固定blocked結果とする。

## 実装とSecurity invariant

- process-local `Map`と`WeakMap`を同期処理だけから更新し、Grantと全aliasを同じRuntime stateへ所有させる。filesystemへAuthority recordを書かない。
- 発行前にProfile IDをbounded grammarで検証し、その後opaque management Capabilityを既存Operation ownerで再検証する。caller supplied Operation IDは受理しない。
- Provider Home観測Capabilityをissueとconsumeで一回ずつ消費し、plainなProvider／Hash入力を公開APIで受理しない。
- Runtime所有wall／monotonic clockの双方が0以上かつ有限であることを要求し、使用時は双方とも5分未満とする。一方でもrollback、期限切れまたは判定不能なら使用しない。
- control、use、mount authorization aliasを分離する。consumeはuse aliasを削除し、revokeは残る全aliasとrecordを削除する。
- isolated test runtimeはproduction Authorityを持たず、そのaliasをproduction singletonは受理しない。
- 結果へProvider Home Path、SID、ACL、Credential、tokenまたはsession内容を含めない。Grantまたはmount authorization候補は一般Runtime Authority、Operation Capability、実mountまたはProvider spawnを成立させない。

## 探索・比較と収束

比較した案は、棄却済みfilesystem storeの修正、signed durable Grant、process-local atomic storeおよびMount Adapter内だけの暗黙許可である。durable storeはcrash後の回復を可能にする一方、stable record Identity、partial filesystem Effect、世代とalias失効を再びAuthority面へ持ち込む。暗黙許可はissue／consume／revokeの観測可能な境界を失う。Provider containerとOperation Filesystemは後続Docker／Host Recoveryが実状態を回復できるため、v1では短命Grantをprocess-localへ閉じ、restart時は全Grantを失う方が小さいTrust Boundaryになる。

この収束は実mount後のcontainer crash recoveryを不要にしない。Mount AuthorizationをDocker Adapterへ接続する次変更では、mount開始、active state、unmount確認、container／network不存在およびOperation終了時revokeを一つのcleanup契約へ結合する。

## 現在の検証結果と残件

- 基準Node.js v24.19.0でstrict source／test typecheck、Biome lint／format、Coordinator全contract test 457／457およびRepository全体checkerを確認した。checkerは600 files、373 Markdown、2,122 local links、582 anchors、Error 0／Warning 0だった。
- 正常issue／consume／inspect／revoke、issuedからの直接revoke、観測再利用、別Operation、全Provider／Hash差、期限、clock rollback、依存例外、参照衝突、別isolated storeおよびproduction入口の偽造拒否を確認した。
- 新Runtime sourceの直接coverageはline 98.43%、branch 93.46%、function 100%である。未到達は内部不変条件破壊、pure transition evaluator異常および後続mount-active状態の防御分岐であり、test-only Authority破壊口をproduction moduleへ追加して100%を装わない。mount開始状態を実装する次変更で該当分岐を再評価する。
- 実Provider Home mount／unmount、Docker container／network cleanup、Operation終了時の統合revoke、process tree recovery、正式署名同時run、Provider E2E、独立レビュー／監査およびPRは後続である。

現在、人間による追加判断は必要ない。保護対象の採用、統合、Releaseまたはリスク受容は行わない。
