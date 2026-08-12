# CHG-000015 現在のレビュー記録

- 固定対象Commit: `d03be5ba59634dd060562f090e4740daf79ca831`
- 固定対象Tree: `0780b43c090ba3f0ac3acc56d2cfe195ae84e9a5`
- Parent: `5be85702e9b443e941e010e209f621b293babe75`
- 共通機械確認: Coordinator `216 / 216 Pass`、Checker `143 / 143 Pass`、full checker Error `0`／Warning `0`、diff／worktree clean
- Evidence追加前metrics: files `330`、Markdown `236/236`、local links `1786`、anchors `557`、related `26`、versioned documents `26`、stable IDs `8`、remediation rows `68`
- Evidence追加後metrics: files `334`、Markdown `240/240`、local links `1790`、anchors `557`、related `26`、versioned documents `26`、stable IDs `8`、remediation rows `68`、Error `0`、Warning `0`
- 現在状態: Provisioning Record pure Coreのrevision 1 schema／domain／key ID／aggregate暗号条件は監査済み候補だが、Runtime所有Trust、Filesystem、AuthorityおよびCapabilityは未実装でGate `blocked`

| 確認 | 結果 | 固定記録 | SHA-256 |
|---|---|---|---|
| Agent／Architecture／Security Review | `Pass` | [`CHG-000015_Agent_Security_Review_d03be5b.md`](CHG-000015_Agent_Security_Review_d03be5b.md) | `02C0E37DD194E812110985A17CF02875CCF64F8D9AE2B695EBCCF9BB7E314195` |
| Document Audit | `Pass` | [`CHG-000015_Document_Audit_d03be5b.md`](CHG-000015_Document_Audit_d03be5b.md) | `700E896A008EB45E62F35A0A36C0F51537615BEDDCA743B34ABA15EB233BD17C` |
| Gap／Impact＋Conformance Audit | `Pass` | [`CHG-000015_Gap_Conformance_Audit_d03be5b.md`](CHG-000015_Gap_Conformance_Audit_d03be5b.md) | `4467FAFDD177FC342B2274686C2B56F8BB302AFE22BAB89872DC3707FF7AAB9E` |

## 確認済み範囲

- revision 1の準備記録、署名包絡、信頼起点鍵集合および失効一覧のexact pure codec
- fixed ASCII domain、JCS payload byte長のuint64be framing、exact SPKI DER SHA-256 key ID
- coercion-free scalar、標準配列、owned domain Buffer、SPKI事前上限、canonical raw decoder
- 全署名entryの既知／非失効／期間内／暗号一致と、一件でも不正な場合のfallbackなし全体拒否
- `issuedAt < expiresAt`、最大180日、`issuedAt <= evaluationTime < expiresAt`
- 失効一覧へ列挙された署名鍵の過去／現在／未来を問わない拒否
- 12 blocker、6 current-run evidence、非Effect／非Authority／非Capability、Gate `blocked`

## 未解決・未評価

- 実installation key、Qual-Lab enrollment、実keyset／revocation配布
- Runtime所有のTrust選択、rollback-resistant Trust floor、Runtime時計
- Authority Root内のRecord保存、Filesystem read／write、resolver、OS別Root保護
- activation／locatorのatomic persistence、disable／reactivation、crash recovery
- readiness十分値、run-scoped Capability、Provider／Operation
- 採用、準拠、移行、Stable、Release、公開

## Current Decision Set

domain、key ID、revision 1 schema、180日、fail-closed aggregate、保存／resolver／OS保護／activation／Capabilityの目標値は人間承認済みである。次の実装で必要なinstallation keyの生成、Qual-Lab Provisioning CA enrollment、実鍵／Trust配布およびrollback-resistant floorの実体値・運用接続は未実装であり、これらをcaller supplied artifactから推定しない。Runtime所有Trustが成立するまではFilesystem、Authority、Capability、Provider／OperationまたはReleaseを開始しない。
