# CHG-000022 現在のレビュー記録

- 固定対象Commit: `f11ac73ad22b1af6d0983c9f941600bef4be9755`
- 固定対象Tree: `49655ba56a3190b696afeaaa43f6e7308ada2c13`
- Parent: `3c3021a6769d9e0dd202950d5def4b70577333e4`
- 共通機械確認: Node.js `24.19.0`、Coordinator check Pass、Coordinator `362 / 362`、Provider lifecycle `15 / 15`、Provider Authority exact 4 source／7 test、lines `1038 / 1048`・functions `41 / 41`・branches `318 / 347`、未到達29 branchの全義務、platform-access TypeScript coverage Pass、Checker `151 / 151`、TypeScript closure production `62`／test `55`／Checker・template `5`／Rust `4`／unique `124`、full checker Error `0`／Warning `0`、diff／worktree clean
- Evidence追加前metrics: files `490`、Markdown `308/308`、local links `1900`、anchors `565`、Related `26`、versioned documents `26`、stable IDs `8`、remediation rows `68`
- Evidence追加後metrics: files `494`、Markdown `312/312`、local links `1904`、anchors `565`、Related `26`、versioned documents `26`、stable IDs `8`、remediation rows `68`、Error `0`、Warning `0`
- 現在状態: Agent／Architecture／Security、Document、Gap／ImpactおよびConformanceの4独立判定はすべて`Pass`／Finding `0`。subscription OAuth-only方針、非Authorityの合成Core、Profile／Registry／Authority／Prelaunchの専用Homeマウント許可参照結合、private doctor v3およびproduction前停止を検証済みとした。

| 確認 | 結果 | 固定記録 | SHA-256 |
|---|---|---|---|
| Agent／Architecture／Security Review | `Pass` | [`CHG-000022_Agent_Security_Review_f11ac73.md`](CHG-000022_Agent_Security_Review_f11ac73.md) | `EEEAFB1C1B08AD2C2C50C069A4F73D9308D074A8B083EC45EFC5942E35CF6B5A` |
| Document Audit | `Pass` | [`CHG-000022_Document_Audit_f11ac73.md`](CHG-000022_Document_Audit_f11ac73.md) | `1B08FC51B5CEAF830B279275EFDC242A19B8FE2C2F7D6EE7996F00BDE6AB8DBD` |
| Gap／Impact＋Conformance Audit | `Pass` | [`CHG-000022_Gap_Conformance_Audit_f11ac73.md`](CHG-000022_Gap_Conformance_Audit_f11ac73.md) | `4BF2C07361FF38C9E93E8A9BF2B46097EEBB1A31B30E36A69EE4F7B8E2CCD0FD` |

## 確認済み範囲

- Codexは既存ChatGPT plan、Claude Codeは既存subscription OAuthだけを許可し、API key、従量API fallback、追加credit購入および自動plan切替を禁止する。
- 専用Provider HomeはProviderとOS user単位の将来永続領域であり、Operation cleanup、Host既定Homeおよび他Providerから分離する。Operation単位の短期参照だけをProfile、Registry、AuthorityおよびPrelaunchへexact結合する。
- 合成Fake観測候補はcaller claim evaluatorに限り、Fake process実行、process不存在、Grant発行、Authority、CapabilityまたはEffectを成立させない。
- Provider Authority品質記録はexact 4 source／7 testと未到達29 branchの全処置を保持し、100%または実Provider readinessを主張しない。
- private doctorは`reportVersion:3`だけを生成し、revision 2 alias／fallback、production decoder／consumerまたは公開入力契約変更を持たない。
- 実Provider spawn、OAuth login、Provider Home作成／mount、Egressおよび課金処置は固定`blocked`で、12 blocker、6 current-run evidenceおよびGateを維持する。

## 未実装・未評価境界

- 実Codex／Claude OAuth login／logout、token refreshおよびremote revocation
- Provider Homeのowner／ACL／Identity、mount Grant binder／issuer／one-shot handle／失効
- 固定Provider image／CLI／license／auto-update防止、実Docker lifecycleおよびprocess-tree termination
- 実Egress allowlist、quota／billing signal、Telemetryおよび実Provider出力分類
- production Authority／Capability、Operation接続、統合および最終Release判断

## Current Decision Set

今回確定したのは、CRDD公式Repository内のsubscription OAuth-only方針、純粋Provider lifecycle候補、専用Homeマウント許可参照の多者結合、private doctor v3、品質根拠およびproduction前停止までである。監査対象範囲はConformance Auditで`Eligible`だが、CRDD全体の準拠表明を発行せず、採用、統合、Gate open、Stable化またはReleaseを成立させない。v0.18は`Candidate`、Released Baselineはv0.17.0のままである。現在、人間による追加判断は必要ない。
