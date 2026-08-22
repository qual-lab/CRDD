# CRDD v0.18.0 Architecture Candidate — 実装残件台帳

Status: Non-normative Follow-up Index
Owner: Qual-Lab
Related: [PoC計画](03_CRDD_v0_18_PoC_Plan.md), [Agent & Provider Orchestration](07_CRDD_v0_18_Agent_and_Provider_Orchestration.md), [CHG-000028](../90_Release/Changes/CHG-000028_Claude_Execution_Plan_Foundation.md)

> 本書は未完了事項を発見し、次の変更へ接続するための非規範indexである。要求、意味、受入条件または完了判定の正本ではない。各項目の意味はSourceを正本とし、実装変更ごとに固有のCHG、固定改訂版、検証、独立レビューおよび人間の決定権限へ接続する。

## 取得と更新

v0.18.0 Candidateの実装残件は、PoC計画の`Related`から本書を取得する。作業開始時は`Work State`だけで着手可否を推定せず、Sourceに示した現在のCHGと正本を読む。完了時は、完了を確認したCHGまたはEvidenceへSourceを差し替える。保留時は次回評価契機を維持し、報告への記載だけで項目を削除しない。

## 現在の残件

| ID | 件名 | Work State | Scope / Target | Source | Next action / Re-evaluation trigger |
| --- | --- | --- | --- | --- | --- |
| `FU-018-028` | Claude実行計画基盤 | Completed | 非実行の固定Claude probe契約 | [CHG-000028 全体](../90_Release/Changes/CHG-000028_Claude_Execution_Plan_Foundation.md) | 固定版`01a92ba5d8597baebf52265c6c733747451e44ad`の検証完了。契約変更時に再評価する |
| `FU-018-CLAUDE-DIST` | Claude配布Identityと利用条件 | Unscheduled | manifest署名、binary取得、固定image digest、exact argv互換性、binary配布条件と認証service条件の有効化 | [CHG-000028「管理対象依存」](../90_Release/Changes/CHG-000028_Claude_Execution_Plan_Foundation.md#管理対象依存と外部情報境界) | 配布物をimageへ格納する変更の着手前。選択アカウントと適用条件を観測し、権限者が利用を承認できる状態にする |
| `FU-018-PROVIDER-HOME` | Provider Home保護とMount Grant | In Progress | local OS user単位の専用Home、settings分離、opaqueな一回限りmount許可と失効 | [CHG-000029](../90_Release/Changes/CHG-000029_Provider_Home_Mount_Grant_Lifecycle_Foundation.md)、[CHG-000030](../90_Release/Changes/CHG-000030_Provider_Home_Mount_Grant_Runtime_Store.md)、[CHG-000031](../90_Release/Changes/CHG-000031_Runtime_Owned_Operation_Context_Capability.md) | 構造・遷移・使用候補Coreは実装済み。CHG-000030の先行store候補はAuthority provenance不足により不採用。Runtime所有Operation context Capabilityは実装候補を固定し監査中。次はselected-user binderとProvider Home保護観測を成立させ、その真正CapabilityからだけRuntime所有issuer／atomic store／clock、mount／失効Effectを発行する |
| `FU-018-EGRESS` | EgressとTelemetry制御 | Unscheduled | endpoint限定Proxy、親環境遮断、Telemetry判断と観測 | [CHG-000028「固定probe計画と課金境界」](../90_Release/Changes/CHG-000028_Claude_Execution_Plan_Foundation.md#固定probe計画と課金境界) | Network Effectを持つ実Provider probeへ着手するとき |
| `FU-018-CLAUDE-AUTH` | Claude OAuth lifecycleと実probe | Unscheduled | login、logout、refresh、quota観測、追加購入停止、実request、終了とcleanup | [CHG-000028「品質義務と未完了事項」](../90_Release/Changes/CHG-000028_Claude_Execution_Plan_Foundation.md#品質義務と未完了事項) | 選択アカウント、適用条件、自動利用許可、Provider Home、Egressの前提が揃った後 |

## 境界

- `Completed`はCHG-000028の非実行候補の検証完了だけを表し、Effect、採用、統合または実Provider readinessを許可しない。`Unscheduled`は後続CHGと実施時期が未設定であり、不要、終了または許可済みを意味しない。
- `FU-018-CLAUDE-DIST`はbinary配布物の条件と認証済みservice利用条件を別々に解決する。Pro／MaxまたはTeam／Enterpriseという提供形態候補だけから適用条件を確定しない。
- API key、Console API account、第三者API Provider、追加credit購入、自動plan切替およびHost fallbackは残件ではなく、現在の不採用境界である。
- Codex Provider実装はClaude-firstの現在範囲外であり、別CHGがSourceを確立した時点で本台帳へ追加する。
