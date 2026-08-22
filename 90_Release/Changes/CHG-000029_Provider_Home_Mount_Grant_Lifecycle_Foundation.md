# 変更トレース: Provider Homeマウント許可ライフサイクル基盤（Provider Home Mount Grant Lifecycle Foundation）

- 変更ID: `CHG-000029`
- 状態: `In Review`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-22
- 対象: CRDD公式Repositoryのprivate Coordinatorにおける専用Provider Homeマウント許可の純粋Core
- 対象version: v0.18.0 Candidate
- 変更分類: `breaking`（privateなProvider Home contractをrevision 2、Provider Lifecycle contractをrevision 5、doctor reportをversion 6へ更新し、Mount Grantの構造・状態・遷移・使用候補を固定する）
- 移行要否: `migration_required: true`（新しい内部contractと試験を追加し、説明contract、doctor producer／exact test／README、固定source母集団を同時更新する。doctor version 5以前のalias／fallbackは設けない。supported production consumer、発行済みGrant、永続stateおよび実mountは0で、永続変換はない）
- 関連正本: [`16_Quality_Assurance.md`](../../16_Quality_Assurance.md)、[`19_Maintenance.md`](../../19_Maintenance.md#33-internal-typescript-runtime)、[`CHG-000022`](CHG-000022_Provider_Lifecycle_Foundation.md)、[`CHG-000026`](CHG-000026_Provider_Home_Protection_Foundation.md)、[`CHG-000028`](CHG-000028_Claude_Execution_Plan_Foundation.md)、[`実装残件台帳`](../../99_Roadmap/08_CRDD_v0_18_Implementation_Follow_Up_Registry.md)

## 結論と変更経路

専用Provider Homeマウント許可（Provider Home Mount Grant）の構造、状態整合、正規遷移および使用時bindingを、副作用のない非Authority候補Coreとして実装する。GrantはProvider・Profile・Operation・Provider Home Identity・Provider Home保護状態・selected local userへ結合し、最長5分、使用上限1回とする。状態は`prepared`、`issued`、`consumed`、`revoked`だけで、`prepared -> issued -> consumed -> revoked`または未使用の`issued -> revoked`以外を拒否する。

使用候補はProfile／Authority contextが選ぶGrant参照候補をrecordの`grantRef`へ、使用直前のProvider Home Identity／保護状態／selected local user観測Hash候補を発行時bindingへ完全一致させる。ただし、これはcaller supplied plain data間のpure比較であり、Runtime所有観測の成立ではない。本変更はProvider Home保護Effect、Runtime所有clock／atomic store／issuer、mount Adapterおよび終了時revocation Effectを実装しない。正しい候補もMount Authorization、Provider Home Mount、Filesystem Effect、Runtime AuthorityまたはOperation Capabilityを発行せず、token、Credential、session内容またはPathを返さない。したがって実Provider spawn、login、Network、subscription利用枠消費および課金Effectは発火しない。

変更はCredentialを含む永続Homeへの将来アクセス、Authority境界および複数private contract利用側へ影響する非自明なsecurity変更である。着手前整合ではProvider Lifecycle、Provider Home、Provider Isolation Profile、Authority verifier、QA、内部TypeScript境界および人間向け日本語表示を確認した。完成固定版ではAgent／Architecture／Security Review、Document Audit、Gap／Impact AuditおよびConformance Auditを同一改訂版へ実施する。公開CLI、採用Repository Schema、Communication、Discovery、管理対象依存および外部情報処理は変更しないため非該当である。

## 発火、非発火、境界および情報不足

- 発火例: exact Schema、canonical UTC、最長5分、使用上限1回、状態整合および全bindingを満たすplain objectは、非Authorityの構造候補になる。
- 非発火例: 説明contract取得、通常`doctor`、構造候補化、遷移候補化および使用候補化は、Filesystem、mount、Credential、Network、Provider processまたは課金Effectを発火しない。
- 境界例: 発行時刻（`issuedAt`）は使用可能区間に含め、有効期限（`expiresAt`）は含めない。`revoked` recordは観測時刻にかかわらず使用候補にならない。5分を1 ms超える寿命、二重消費、逆遷移、Grant参照またはbinding差、余分field、accessor、Proxyおよび非canonical時刻は固定`blocked` reasonへ閉じる。
- 判定情報不足例: canonical Runtime時刻、atomicなcurrent record、Provider Homeのstable Identity／保護観測またはselected local user bindingを確認できない場合は、構造が正しくても発行、使用、失効またはmount済みへ昇格しない。

概念の定義、発火条件、判定不能時の処置および結果を分離する。`candidate`はplain dataの構造・遷移・使用整合だけを表し、`issued`というrecord内状態もRuntimeによる発行事実ではない。`providerHomeMountGrantIssued:false`を含む全非Effect flagは結果から変えない。既知の契約母集団は新規Mount Grant Core、Provider Home、Provider Lifecycle、Provider Isolation Profile、Authority verifierおよびdoctor report version 6であり、利用側母集団は説明contract、Profileの参照検証、Authority Grant／prelaunch検証、doctor producer／exact test、coverage runner、Checker固定source数、README、脅威モデルおよび実装残件台帳である。

## 保持する意図と目指さないこと

保持する意図は、既存subscription OAuthだけを使い、API key、追加credit購入、Host Credential、token copy／injectionおよびPath開示を許可しない境界である。永続専用HomeはローカルOS user＋Provider単位でRepository間共有し、Operation終了時に削除しない。Operation終了時に失効させる将来対象は短命な許可、handleおよびmountであり、OAuth sessionのlogout／revoke／削除とは分ける。

本変更はOS既知フォルダー取得、selected-user binder、owner／DACL／non-reparse保護Effect、Provider settings分離、実login、Credential内容の観測、Grant IDの生成、永続store、clock、mount、unmountまたはrevocationを目指さない。構造Coreの実装を`FU-018-PROVIDER-HOME`の完了、実Provider readiness、Gate open、StableまたはReleaseへ読み替えない。

## 検証設計と現在品質状態

- 新規production sourceと直接依存`plain-data-snapshot.ts`のline、functionおよびbranch coverageを各100%にする。
- 正常4状態、正規4遷移、使用期間の内外、binding差、Schema／Identity／時刻／回数／状態矛盾、余分field、accessor、Proxyおよび時刻評価例外を直接試験する。
- Grant参照と使用直前の3観測Hash候補の一致、各差、形式不正、欠落、および`consumedAt`の半開区間を直接試験する。
- Provider Homeの固定coverage母集団、Coordinator strict typecheck／lint／format、全contract test、Checker package testおよびRepository全体checkerを別軸で確認する。
- 固定候補commitにAgent／Architecture／Security、Document、Gap／ImpactおよびConformanceの独立確認を行い、全結果を統合する。

基準Node.js `v24.19.0`で、Coordinator strict typecheck／Biome lint／formatはPass、全contract testは399／399、Checker package checkはPass、contract testは151／151だった。新規専用coverage commandではproduction source `provider-home-mount-grant.ts`と直接依存`plain-data-snapshot.ts`のline、functionおよびbranchが各100.00%となった。Provider Home coverageはexact 8 source／8 testで、lines 2,380／2,575、functions 94／101、branches 535／623、compact payload SHA-256 `66129c20cb14969cc00e97e7ed45534a7d289471b1017a0e0611bf1bc0401243`が連続2回一致した。未到達分岐は既存の理由、リスク、代替確認、ownerおよび再確認契機へ接続し、新規Mount Grant sourceには未到達分岐がない。

Repository全体checkerは536 files、340 Markdown、1,979 local links、575 anchorsを確認し、Error 0／Warning 0だった。既定shellのNode.js `v22.18.0`ではProvider Home coverage runnerが基準runtime未満として意図どおり停止し、基準Nodeへ切り替えた結果を正式結果とした。実Provider、Docker、Network、Filesystem、OAuth、mountまたは課金Effectは本確認で発火していない。最終独立確認結果は、是正版の対象改訂版を固定してから追記する。

## 初回独立確認と統合是正

固定commit `1d6de7dbfdedce0fb28a65fb00212be33947454b`／tree `5b14c32d9286b71408610ab8041c04898859ced9`への初回確認は、Agent／Architecture／Security ReviewがConditional、Document AuditがFail、Gap／Impact AuditおよびConformance AuditがFail／Not Eligibleだった。全観点の一次走査から、次の4是正単位へ統合した。

- 使用候補がProvider・Profile・Operationだけを照合し、Profile／Authorityが選択するGrant参照と、使用直前のProvider Home Identity／保護状態／selected local user観測Hash候補をrecordへ再結合できなかった。exact use schemaへ4 fieldを追加し、形式と完全一致を要求しつつ、caller supplied候補間のpure比較に限定した。
- 使用時刻は`expiresAt`未満なのに、`consumed`と消費済み`revoked` recordが`consumedAt == expiresAt`を許した。全構造・遷移・使用判定を半開区間へ統一し、発行時刻、期限直前、期限exactおよび期限後を直接試験した。
- Provider HomeとProvider Lifecycleのnested schemaを変更しながらdoctor `reportVersion:5`を保持していた。producerとexact testをversion 6へ更新し、READMEと本変更の移行母集団を揃え、version 5以前のalias／fallbackを設けなかった。
- 「失効時刻」が`expiresAt`と`revokedAt`のどちらか判別できなかった。有効期限の半開区間と、`revoked` recordが時刻にかかわらず使用不能であることを別々に表示した。

統合是正方針は修正開始前に3監査へ再提示し、全監査から整合を確認した。Path、SID、Credential、token、session内容、5分上限、使用1回、4状態、非Authority、全Effect false、Gate blocked、`FU-018-PROVIDER-HOME`の`In Progress`および非Releaseは変更していない。初回監査結果を修正版の合否へ流用せず、新しい固定commitへ同じ監査集合を再実行する。

## 未完了事項と人間判断

`FU-018-PROVIDER-HOME`は`In Progress`のまま維持する。次の変更ではselected local user binderとProvider Home保護Effectを先に完成させ、その観測をGrant bindingへ供給する。その後にRuntime所有issuer／atomic store／clock、mount Adapterおよび終了時revocation Effectを実装し、各Effectを独立観測する。Provider Home settings分離と実Provider Adapterも完了条件に残る。

現在、人間による判断は非Effectの構造Core実装には必要ない。実Provider Homeを作成・保護し、既存OAuth sessionを保持する変更へ進む前に、対象OS user、保護方式、復旧とlogout境界を固定する必要がある。本変更はv0.18 Candidate、v0.17 Released Baseline、Gate blocked、Authority／Capability非発行および非Releaseを維持する。
