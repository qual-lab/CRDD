# CHG-000015 現在のレビュー記録

- 固定対象Commit: `f39958bbe1c9b71643238454f42651bf357596f8`
- 固定対象Tree: `8e004f29cbcc17d93bf0fb9f8d5644bb057868dc`
- Parent: `f8d464fc8cdf61da8aca6474f0a34e20f91452e6`
- 共通機械確認: Coordinator `216 / 216 Pass`、Checker `143 / 143 Pass`、full checker Error `0`／Warning `0`、diff／worktree clean
- Evidence追加前metrics: files `338`、Markdown `244/244`、local links `1794`、anchors `557`、related `26`、versioned documents `26`、stable IDs `8`、remediation rows `68`
- Evidence追加後metrics: files `342`、Markdown `248/248`、local links `1798`、anchors `557`、related `26`、versioned documents `26`、stable IDs `8`、remediation rows `68`、Error `0`、Warning `0`
- 現在状態: 承認済みenrollment方針は監査済み契約候補だが、実certificate、bundle、Network、keystore、Filesystem、AuthorityおよびCapabilityは未実装でGate `blocked`

| 確認 | 結果 | 固定記録 | SHA-256 |
|---|---|---|---|
| Agent／Architecture／Security Review | `Pass` | [`CHG-000015_Agent_Security_Review_f39958b.md`](CHG-000015_Agent_Security_Review_f39958b.md) | `69C272576D0CABB64F484A2D4D799073AF5B2FE8EEA02C53815C1CA2D7C614CF` |
| Document Audit | `Pass` | [`CHG-000015_Document_Audit_f39958b.md`](CHG-000015_Document_Audit_f39958b.md) | `3C5A073CE297DA6E26063980C90B5F2BEF24C46898E8BF032F8C9B73F9E0A4F4` |
| Gap／Impact＋Conformance Audit | `Pass` | [`CHG-000015_Gap_Conformance_Audit_f39958b.md`](CHG-000015_Gap_Conformance_Audit_f39958b.md) | `63174934B8431145235C455572D0432286B103F127CA55FA495B931D83F6BB0E` |

## 確認済み範囲

- JCS JSON／Ed25519／SPKI由来key ID、180日／30日／30日
- 3 OSの鍵保管優先候補と明示fallback、通常runの無操作／network不要目標
- online 4要素、署名済みoffline bundle 5要素、replay／cross-machine／cross-scope／expiry拒否
- 自動更新成功後の無操作、失敗／rollback／失効等のfail closed
- 既存3 blockerへの依存接続、12 blocker／6 evidence不変、非Effect／非Authority／非Capability

## 未解決・未評価

- certificate／bundle exact Schema、wire、domain、署名者／署名対象／署名充足
- proof-of-possession、challenge TTL、CA chain、replay ledger、CA Lifecycle
- 実CA／鍵、keystore、Network、Filesystem、保存／回復、platform adapter
- readiness十分値、Authority、Capability、Provider／Operation、採用、準拠、移行、Stable、Release、公開

## Current Decision Set

承認済み値と未決exact仕様を分離する。caller supplied certificate、bundle、鍵、時刻または署名らしい値をTrustへ昇格せず、Runtime所有検証が成立するまでGateを開かない。
