# CHG-000015 現在のレビュー記録

- 固定対象Commit: `710b274369f93548f7dadf027ef820d1fecfc6d8`
- 固定対象Tree: `6e1964bc05d11ad0bb623f8cd3ba7bccbbdba9db`
- Parent: `94d23244064b7676916ce87fadaa42c161686887`
- 共通機械確認: Coordinator `202 / 202 Pass`、Checker `143 / 143 Pass`、full checker Error `0`／Warning `0`、diff／worktree clean
- Evidence追加前metrics: files `313`、Markdown `224/224`、local links `1772`、anchors `555`、related `26`、versioned documents `26`、stable IDs `8`、remediation rows `68`
- Evidence追加後metrics: files `317`、Markdown `228/228`、local links `1776`、anchors `555`、related `26`、versioned documents `26`、stable IDs `8`、remediation rows `68`、Error `0`、Warning `0`
- 現在状態: Provisioning Record Trust／Selection方針の契約投影と全利用側伝播は完了したが、実Schema、署名、保存、resolver、Effect、Capabilityは未実装でGate `blocked`

| 確認 | 結果 | 固定記録 | SHA-256 |
|---|---|---|---|
| Agent／Architecture／Security Review | `Pass` | [`CHG-000015_Agent_Security_Review_710b274.md`](CHG-000015_Agent_Security_Review_710b274.md) | `90264B2BF58A7C1A44824EE2BAFC499333230FBA85F14C1BE22ECF00AD8FE4A3` |
| Document Audit | `Pass` | [`CHG-000015_Document_Audit_710b274.md`](CHG-000015_Document_Audit_710b274.md) | `C9308ED00E3D637C5A167BAF4A44013E25F6783DC86D6B0765D76A7C89768F8B` |
| Gap／Impact＋Conformance Audit | `Pass` | [`CHG-000015_Gap_Conformance_Audit_710b274.md`](CHG-000015_Gap_Conformance_Audit_710b274.md) | `A3BF1D38B0DFDD5BCE217A211603ACC6282514C753E24E1EF55A74F2A8FB03FF` |

## 確認済み範囲

- Provisioning RecordをPlatform scopeの中心成果物とする方針
- Provisioning Record固有6実装軸と、同じsnapshotから導出する2 Record blocker
- Platform Provisioner実体の検証と生成済みRecord署名検証の責務分離
- Provisioning Receipt／独立helper Manifestを別Runtime Authority成果物として要求しない境界
- LocatorはProvisioning Record Hashを参照する信用前hint、Authority File Bundle Manifestは別成果物
- 12 blocker、6 current-run evidence、二層ready、非Effect／非Authority／非Capability、Gate `blocked`

## 未解決・未評価

- canonical Record Schema、署名対象byte、暗号suite、鍵形式、key ID、失効Schema
- Recordの保存Path、revision／lifecycle、atomic replacement、backup／recovery
- CLI／環境／Locatorを含むresolverの厳密な優先状態機械
- Windows DACL、POSIX owner／mode／ACL、principal、persistent volume
- activation／locatorのatomic persistence、disable／reactivation、crash recovery
- readiness十分値、run-scoped Capability、Provider／Operation
- 採用、準拠、移行、Stable、Release、公開

## Current Decision Set

今回の方針投影と直接伝播に追加の人間判断はない。次の実装へ進むには、Provisioning Recordの署名対象byte・payload／envelope Schema・暗号suite・keyring／revocation Schemaを不可分の判断単位としてQual-Labが決定する必要がある。その決定までは新Schema、Verifier、Filesystem読取り、resolver、Authority、Capability、Provider／Operationを開始しない。
