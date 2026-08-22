# 変更トレース: Runtime所有Operation Context Capability（Runtime-owned Operation Context Capability）

- 変更ID: `CHG-000031`
- 状態: `In Progress`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-23
- 対象: CRDD公式Repositoryのprivate CoordinatorにおけるOperation IDのRuntime生成、opaque Capabilityへの結合および終了時失効
- 対象version: v0.18.0 Candidate
- 変更分類: `non-breaking`（既存のprivate実行環境へ未接続のCapability発行・検証APIを追加する）
- 移行要否: `migration_required: false`（production consumer、永続state、実mount、Provider processおよび公開Schema変更は0）
- 関連正本: [`16_Quality_Assurance.md`](../../16_Quality_Assurance.md)、[`19_Maintenance.md`](../../19_Maintenance.md#33-internal-typescript-runtime)、[`CHG-000029`](CHG-000029_Provider_Home_Mount_Grant_Lifecycle_Foundation.md)、[`CHG-000030`](CHG-000030_Provider_Home_Mount_Grant_Runtime_Store.md)、[`実装残件台帳`](../../99_Roadmap/08_CRDD_v0_18_Implementation_Follow_Up_Registry.md)

## 結論と変更経路

Runtimeが所有するOperation directoryの生成時にOperation IDを内部生成し、同じ所有Identity、生成時刻および全childのstable Filesystem Identityを確認できる間だけopaqueなOperation context Capabilityを発行する。plain objectの複製、caller supplied Operation ID、置換されたchildおよびOperation終了後の全Capability aliasは拒否する。

この変更はCHG-000030で確認したAuthority provenance欠陥への先行是正であり、Runtime store、Grant issuer、Provider Home保護、mount、Claude process、Credential、Networkまたは課金Effectを発火しない。後続storeはplainなOperation IDをAuthority入力として受けず、このCapabilityの検証結果からだけOperation bindingを取得する。

変更はCredential Homeの将来mount Authorityへ接続する非自明なsecurity変更である。着手前整合では実行環境、Provider Home、Mount Grant、QA、内部TypeScript境界およびCHG-000030の却下理由を確認した。完成固定版ではAgent／Architecture／Security Review、Document Audit、Gap／Impact AuditおよびConformance Auditを同じ改訂版へ実施する。公開CLI、採用Repository Schema、Communication、Discovery、管理対象依存および外部情報処理は変更しないため非該当である。

## 発火、非発火、境界および情報不足

- 発火例: Runtimeが生成し所有中のOperation objectから、置換されていない全childを確認できる場合だけopaque Capabilityを発行し、検証時に同一のRuntime生成Operation IDと生成時刻を返す。
- 非発火例: caller suppliedのOperation ID、plain object、Capabilityのspread copyおよび未知objectはCapabilityとして受理しない。Capability発行と検証はProvider Home、mount、Credential、Network、Provider processまたは課金Effectを発火しない。
- 境界例: 同じOperationへ複数aliasを発行しても同一Operation IDへ結合し、正常cleanupがOperation rootを削除した時点で全aliasを不可逆に失効する。cleanupが安全確認前に停止した場合は、存在するOperationを終了済みと誤認しない。
- 判定情報不足例: Runtime所有Identity、child集合またはstable Filesystem Identityを確認できない場合は、Pathが存在してもCapabilityを発行・検証しない。

## 保持する意図と目指さないこと

既存subscription OAuthだけを使い、API key、追加credit購入、Host Credential、token copy／injectionおよびPath開示を許可しない境界を保持する。ローカルOS user単位、Provider単位の専用Home、最長5分・1回限りのMount GrantおよびOperation終了時失効という後続要件も変更しない。

本変更はselected local user binder、Provider Home owner／DACL／non-reparse保護Effect、Provider settings分離、Grant store／clock／issuer、mount Adapter、実login、実Provider AdapterまたはGate openを目指さない。Operation context Capabilityの成立をProvider Home保護済み、Grant発行済み、実Provider readiness、StableまたはReleaseへ読み替えない。

## 検証設計と現在品質状態

- Runtime生成IDの形式、同一Operationのbinding、opaque表示、複製・偽造拒否、child置換拒否およびcleanup後の全alias失効を直接試験する。
- Coordinator strict typecheck／lint／format、全contract test、Checker package testおよびRepository全体checkerを確認する。
- 完成候補commitとtreeを固定して必須監査集合を実施し、指摘を一括統合してから是正する。

現在は実装中であり、固定改訂版の検証・監査結果は未取得である。実Provider、Docker、Network、OAuth、Provider Home保護／mountまたは課金Effectは本変更で発火しない。contract testは所有する一時Operation directoryと外部回復recordを作成・cleanupする試験Filesystem Effectを含む。

## 未完了事項と人間判断

`FU-018-PROVIDER-HOME`は`In Progress`のまま維持する。次にselected local user binderとProvider Home保護観測を成立させ、両Capabilityからだけ新しいRuntime store／clock／issuerを実装する。その後にmount／失効Effect、settings分離およびClaude Adapterへ接続する。

現在、人間による追加判断は必要ない。保護対象の採用、リスク受容、統合またはReleaseは行わない。
