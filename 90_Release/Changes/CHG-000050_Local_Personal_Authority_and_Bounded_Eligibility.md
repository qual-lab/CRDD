# 変更トレース: Local Personal Authorityと上限付きProvider適格性

- 変更ID: `CHG-000050`
- 状態: `Implementation in Progress`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-25
- 対象: 署名済みCRDD Releaseへ結合したLocal Personal Authority sourceとSubscription request適格性
- 対象version: v0.18.0 Candidate
- 変更分類: `additive`（Local Personal Authority Runtime revision 1、Provider Authority Runtime revision 2、Provider Eligibility Runtime revision 2）
- 移行要否: `migration_required: false`（発行済みproduction Authority／Selection Grant／Provider Effectは0。永続Schemaを変更しない）
- 関連正本: [`CHG-000044`](CHG-000044_Runtime_Provider_Authority_Capability.md)、[`CHG-000046`](CHG-000046_Runtime_Provider_Eligibility_Observation.md)、[`CHG-000047`](CHG-000047_Runtime_Provider_Model_Profile_Resolution.md)

## 結論

Local Personal Profileでは外部Authority Rootの導入を必須にせず、公式署名済みCRDD配布物の検証成功をTrust Rootとして、固定4 ProfileのAuthority Registry、Trust Policyおよび短命GrantをRuntime内で構成する。source checkout、署名不成立、未知Profile、Provider不一致または時計不成立ではAuthority sourceを返さない。

Subscription認証状態とquotaは、別の有料probeを発火せず、同じ許可済みProvider Operationの上限付きrequestで確認する。`bounded_request_check`は`unknown`の推測fallbackではなく、必要Capability、公式配布物およびPolicyが確認済みで、認証／quotaを同じrequest内で判定する明示状態である。標準ProfileからAPI key、従量API、追加credit購入またはHost fallbackへ移らない。

## 代表例と境界

- 発火例: 署名済みRelease、固定Profile、同じOperation、30秒以内のsourceおよび5分以内のGrantをProvider Authority Runtimeが再検証する。
- 非発火例: source checkout、caller supplied Bundle、未知Profile、別Provider、期限切れ、clock rollbackまたはplain CapabilityはAuthorityを発行しない。
- 境界例: Claudeは実request自体を認証／quotaの上限付き確認として候補化できるが、CodexのEffect adapterが未接続ならCodex routeを候補化しない。
- 判定情報不足例: 明示`unknown`は`observation_unavailable`として停止し、同一Providerまたは有料APIへのfallback理由にしない。

## Security invariant

- Local Personal Authorityは正常OS、認証済みlocal user、公式署名CRDD Releaseおよび公式ProviderというT1～T2境界に限定する。
- BundleはProvider Home、Credential、API keyまたは外部Authority Rootを読み取らない。
- sourceは最大30秒、Grantは最大5分で、起動直前に同じOperation／Profile／Mountへ再結合する。
- Eligibility観測だけでProvider Effectを許可せず、Selection、Mount、Authority、Repository RevisionおよびProcess Controller Gateを維持する。
- `unknown`、明示不成立またはrequest失敗を別の課金経路へ変換しない。

## 現在の検証結果と残件

署名Release結合、source再生成、未知Profile／Provider差／不正時計拒否、source checkout停止、Authority consumeおよび上限付きrequest適格性の契約試験を追加した。固定4 Profileと通常速度、選定理由、Subscription-only境界を維持する。

残件はRepository／Revision bindingを含むCoordinator facade、実Claude production-like E2E、Codex adapter／逆方向経路、独立レビュー／監査および最終統合判断である。

現在、人間による追加判断は必要ない。保護対象の採用、統合、Releaseまたはリスク受容は行わない。

## 2026-08-25 現在状態への接続

上記「現在の検証結果と残件」は本変更を固定した時点の履歴であり、現在の残件表示ではない。Repository／Revision binding、Coordinator一般Task facade、Codex／Claude両Adapterおよびcross-provider経路は後続変更でproduction候補へ接続済みである。Coordinator Runtime 1.0の現在状態と残件は[`CHG-000015`](CHG-000015_Coordinator_Runtime_1_0.md)および[`Product Roadmap`](../../99_Roadmap/01_Product_Roadmap.md)を正本とする。本変更のAuthority／Eligibility判断とSubscription-only境界は維持する。
