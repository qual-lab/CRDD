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
| `FU-018-CLAUDE-DIST` | Claude配布Identityと利用条件 | In Progress | manifest署名、binary取得、固定image digest、exact argv互換性、binary配布条件と認証service条件の有効化 | [CHG-000038](../90_Release/Changes/CHG-000038_Claude_Subscription_OAuth_Vertical_Slice.md) | 署名manifest、Linux x64 binary Identity、固定Provider imageおよびexact request argvのtransient実測は完了した。Runtime-owned verifier／artifact storeと固定image配布を接続し、binary配布条件と認証service条件を別々に閉じる |
| `FU-018-PROVIDER-HOME` | Provider Home保護とMount Grant | In Progress | local OS user単位の専用Home、settings分離、opaqueな一回限りmount許可と失効 | [CHG-000029](../90_Release/Changes/CHG-000029_Provider_Home_Mount_Grant_Lifecycle_Foundation.md)、[CHG-000030](../90_Release/Changes/CHG-000030_Provider_Home_Mount_Grant_Runtime_Store.md)、[CHG-000031](../90_Release/Changes/CHG-000031_Runtime_Owned_Operation_Context_Capability.md)、[CHG-000032](../90_Release/Changes/CHG-000032_Current_Process_Principal_Observation.md)、[CHG-000033](../90_Release/Changes/CHG-000033_Pre_Active_Provisioning_One_Shot_Contract.md)、[CHG-000034](../90_Release/Changes/CHG-000034_Native_Direct_Provision_Supervisor_Entrypoint.md)、[CHG-000035](../90_Release/Changes/CHG-000035_Native_Provision_Bootstrap_Dependency_Reduction.md)、[CHG-000036](../90_Release/Changes/CHG-000036_AppContainer_Provision_Worker_Candidate.md)、[CHG-000039](../90_Release/Changes/CHG-000039_Runtime_Owned_Provider_Home_Observation.md)、[CHG-000040](../90_Release/Changes/CHG-000040_Runtime_Owned_Provider_Home_Mount_Grant.md)、[CHG-000044](../90_Release/Changes/CHG-000044_Runtime_Provider_Authority_Capability.md) | Known Folder由来`LOCALAPPDATA`、回復可能なone-shot Registry Effect、selected-user binder、ETW QA観測器、caller Pathを持たないRuntime所有Provider Home observer、process-local Mount Grant issue／consume／revoke、および静的Authority要求を現在のactive Grantへ起動直前に結合する5秒・一回限りのProvider Authority候補を実装した。次はproductionのactivated Authority source loaderとMount Authorizationを実Docker bind mount／unmount、終了時cleanupへ接続する。正式署名同時runはRuntime 1.0のsource固定後に一度実行する |
| `FU-018-EGRESS` | EgressとTelemetry制御 | In Progress | endpoint限定Proxy、親環境遮断、Telemetry判断と観測 | [CHG-000038](../90_Release/Changes/CHG-000038_Claude_Subscription_OAuth_Vertical_Slice.md) | internal Provider network、dual-network Proxy、direct egress拒否、hostname allowlistおよび実request cleanupのtransient実測は完了した。IANA snapshot、Proxy、Docker network、最小環境とcleanupをRuntime adapterへ接続する |
| `FU-018-CLAUDE-AUTH` | Claude OAuth lifecycleと実probe | In Progress | login、logout、refresh、quota観測、追加購入停止、実request、終了とcleanup | [CHG-000038](../90_Release/Changes/CHG-000038_Claude_Subscription_OAuth_Vertical_Slice.md) | 専用Provider HomeでClaude Max OAuthとbounded boolean fixed requestのtransient実測は完了した。Runtime-owned account binding、quota観測、利用条件、logout／refreshおよびMount Grant付き実行へ接続する |

## 境界

- `Completed`はCHG-000028の非実行候補の検証完了だけを表し、Effect、採用、統合または実Provider readinessを許可しない。`In Progress`は人間判断による設計blockerが解消して後続実装を開始した状態であり、component、operational one-shot、Gateまたは実Provider readinessの成立を意味しない。`Blocked`はSourceが示す停止条件の解消に人間判断または別変更が必要であることを表す。`Unscheduled`は後続CHGと実施時期が未設定であり、不要、終了または許可済みを意味しない。
- `FU-018-CLAUDE-DIST`はbinary配布物の条件と認証済みservice利用条件を別々に解決する。Pro／MaxまたはTeam／Enterpriseという提供形態候補だけから適用条件を確定しない。
- 標準ProfileのAPI key、Console API account、第三者API Provider、追加credit購入、自動plan切替およびHost fallbackは残件ではなく、原則禁止かつv1非対応の境界である。将来有料APIを扱う場合はSubscriptionのfallbackではなく、ユーザー明示設定、exact Provider／Account、分離Credential source、予算およびOperation Authorityを要求する別Profile／別Capabilityの固有CHGとして開始する。
- Codex Provider実装はClaude-firstの現在範囲外であり、別CHGがSourceを確立した時点で本台帳へ追加する。
