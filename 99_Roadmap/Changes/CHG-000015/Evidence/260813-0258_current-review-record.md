# CHG-000015 現在のレビュー記録

- 固定対象Commit: `7839da46723850427770e7f65607dba657b70ca3`
- 固定対象Tree: `72a9e93b4b28c2637f96ce6ecc36ec82f265559c`
- Parent: `01736ca0f2ce64e174c862c243a2292d907a4265`
- 共通機械確認: Coordinator `216 / 216 Pass`、Checker `143 / 143 Pass`、full checker Error `0`／Warning `0`、diff／worktree clean
- Evidence追加前metrics: files `350`、Markdown `256/256`、local links `1806`、anchors `557`、Related `26`、versioned documents `26`、stable IDs `8`、remediation rows `68`
- Evidence追加後metrics: files `354`、Markdown `260/260`、local links `1810`、anchors `557`、Related `26`、versioned documents `26`、stable IDs `8`、remediation rows `68`、Error `0`、Warning `0`
- 現在状態: 3独立監査はすべて`Pass`／Finding `0`。TTL 30分と登録要求bindingのcontract候補は監査済みだが、exact codec、時計、消費台帳およびNetwork Effectは未実装で、Gate `blocked`

| 確認 | 結果 | 固定記録 | SHA-256 |
|---|---|---|---|
| Agent／Architecture／Security Review | `Pass` | [`CHG-000015_Agent_Security_Review_7839da4.md`](CHG-000015_Agent_Security_Review_7839da4.md) | `C2F10BEDFF28881A85C782DABE1085A9A02BAF276BCF980FDE3D3DEE40BE9D9F` |
| Document Audit | `Pass` | [`CHG-000015_Document_Audit_7839da4.md`](CHG-000015_Document_Audit_7839da4.md) | `39E80D60B7AE59D5417AD9920825FCDF6AED0EE1BD331BE4AE19F2D2617B7B9F` |
| Gap／Impact＋Conformance Audit | `Pass` | [`CHG-000015_Gap_Conformance_Audit_7839da4.md`](CHG-000015_Gap_Conformance_Audit_7839da4.md) | `F72C8E049F9E8B7061254D422F15FB4CC932689577AC893D2646DC999A3167D0` |

## 確認済み範囲

- オンライン登録challengeは発行時から30分有効とし、利用者への細切れの指示または通常runのNetwork発火を意味しない。
- required inputsはchallenge、nonce、Platform scope、installation public keyおよびSchema非依存の登録要求bindingの5件である。
- 最初の検証試行が成功でも失敗でもchallengeを消費し、期限切れ後も再利用しない。期限切れは`blocked`としてfresh challengeを要求し、offlineへ自動fallbackしない。
- 現行人間可読説明は「登録要求（enrollment request）」を初出とし、以後「登録要求」へ統一する。機械値`enrollment_request_binding`は維持する。
- 固定人間決定Oracleに反する旧Document／Gap修正案は、監査結果を履歴保持したまま不採用とする。
- 12 blocker、6 current-run evidence、Authority／Capability／Effect非発行、Gate `blocked`および非Releaseを維持する。

## 未実装・未評価

- challenge／requestのexact Schema、wire encoding、署名messageおよびcodec
- Runtime所有clock、サーバ側一回消費台帳、fresh challenge再発行およびNetwork Effect
- 実CA、keystore、Filesystem、rollback floorおよびOS Protection Adapter
- readiness十分値、Authority、Capability、Provider／Operation、採用、準拠、移行、Stable、Releaseおよび公開判断

## Current Decision Set

TTL 30分と上記のreplay防止境界を現在の決定として使用する。exact wire、時計、消費台帳およびNetwork実装がRuntime所有経路で成立するまでは、contract投影をAuthorityまたはCapabilityへ昇格せずGateを開かない。
