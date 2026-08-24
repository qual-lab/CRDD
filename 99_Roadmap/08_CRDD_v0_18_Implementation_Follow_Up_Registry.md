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
| `FU-018-CLAUDE-DIST` | Claude配布Identityと利用条件 | In Progress | manifest署名、binary取得、固定image digest、exact argv互換性、binary配布条件と認証service条件の有効化 | [CHG-000028「管理対象依存」](../90_Release/Changes/CHG-000028_Claude_Execution_Plan_Foundation.md#管理対象依存と外部情報境界)、[CHG-000037](../90_Release/Changes/CHG-000037_Claude_No_Network_Version_Probe.md) | 公式署名manifestとLinux x64 binary Identityを検証し、外部送信なし`--version`起動まで完了した。Runtime-owned verifier／artifact store、最終固定Provider image、exact request argv、binary配布条件と認証service条件を順に閉じる |
| `FU-018-PROVIDER-HOME` | Provider Home保護とMount Grant | In Progress | local OS user単位の専用Home、settings分離、opaqueな一回限りmount許可と失効 | [CHG-000029](../90_Release/Changes/CHG-000029_Provider_Home_Mount_Grant_Lifecycle_Foundation.md)、[CHG-000030](../90_Release/Changes/CHG-000030_Provider_Home_Mount_Grant_Runtime_Store.md)、[CHG-000031](../90_Release/Changes/CHG-000031_Runtime_Owned_Operation_Context_Capability.md)、[CHG-000032](../90_Release/Changes/CHG-000032_Current_Process_Principal_Observation.md)、[CHG-000033](../90_Release/Changes/CHG-000033_Pre_Active_Provisioning_One_Shot_Contract.md)、[CHG-000034](../90_Release/Changes/CHG-000034_Native_Direct_Provision_Supervisor_Entrypoint.md)、[CHG-000035](../90_Release/Changes/CHG-000035_Native_Provision_Bootstrap_Dependency_Reduction.md)、[CHG-000036](../90_Release/Changes/CHG-000036_AppContainer_Provision_Worker_Candidate.md) | Known Folder由来`LOCALAPPDATA`、回復可能なone-shot Registry Effect、selected-user binderおよびETW QA観測器を実装した。binderを含む正式署名往復と、別の未署名Worker単体runでSystem32限定11 module／対象Network event 0／loopback陽性対照28 event／lost 0を確認済み。次は観測器を同じ正式署名AppContainer runへ結合し、その後protected active／Provider Home保護→issuer／store／clock→mount／失効→bounded Provider lifecycleの順で縦に接続する |
| `FU-018-EGRESS` | EgressとTelemetry制御 | Unscheduled | endpoint限定Proxy、親環境遮断、Telemetry判断と観測 | [CHG-000028「固定probe計画と課金境界」](../90_Release/Changes/CHG-000028_Claude_Execution_Plan_Foundation.md#固定probe計画と課金境界)、[CHG-000037](../90_Release/Changes/CHG-000037_Claude_No_Network_Version_Probe.md) | 無通信version probeは完了した。公式Network要件を固定Proxy／DNS／TLS／Telemetry policyへ変換し、外部送信を伴う実request変更へ着手するとき |
| `FU-018-CLAUDE-AUTH` | Claude OAuth lifecycleと実probe | Unscheduled | login、logout、refresh、quota観測、追加購入停止、実request、終了とcleanup | [CHG-000028「品質義務と未完了事項」](../90_Release/Changes/CHG-000028_Claude_Execution_Plan_Foundation.md#品質義務と未完了事項)、[CHG-000037](../90_Release/Changes/CHG-000037_Claude_No_Network_Version_Probe.md) | 実binaryの無通信起動は完了した。選択アカウント、適用条件、自動subscription利用許可、Provider Home、Egressの前提が揃った後にOAuthとfixed requestを実測する |

## 境界

- `Completed`はCHG-000028の非実行候補の検証完了だけを表し、Effect、採用、統合または実Provider readinessを許可しない。`In Progress`は人間判断による設計blockerが解消して後続実装を開始した状態であり、component、operational one-shot、Gateまたは実Provider readinessの成立を意味しない。`Blocked`はSourceが示す停止条件の解消に人間判断または別変更が必要であることを表す。`Unscheduled`は後続CHGと実施時期が未設定であり、不要、終了または許可済みを意味しない。
- `FU-018-CLAUDE-DIST`はbinary配布物の条件と認証済みservice利用条件を別々に解決する。Pro／MaxまたはTeam／Enterpriseという提供形態候補だけから適用条件を確定しない。
- API key、Console API account、第三者API Provider、追加credit購入、自動plan切替およびHost fallbackは残件ではなく、現在の不採用境界である。
- Codex Provider実装はClaude-firstの現在範囲外であり、別CHGがSourceを確立した時点で本台帳へ追加する。
