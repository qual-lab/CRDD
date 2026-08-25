# CRDD v0.18.0 Architecture Candidate — 実装残件台帳

Status: Non-normative Follow-up Index
Owner: Qual-Lab
Related: [PoC計画](03_CRDD_v0_18_PoC_Plan.md), [Agent & Provider Orchestration](07_CRDD_v0_18_Agent_and_Provider_Orchestration.md), [CHG-000028](../90_Release/Changes/CHG-000028_Claude_Execution_Plan_Foundation.md)

> 本書は未完了事項を発見し、次の変更へ接続するための非規範indexである。要求、意味、受入条件または完了判定の正本ではない。各項目の意味はSourceを正本とし、実装変更ごとに固有のCHG、固定改訂版、検証、独立レビューおよび人間の決定権限へ接続する。

## 取得と更新

v0.18.0 Candidateの実装残件は、PoC計画の`Related`から本書を取得する。作業開始時は`Work State`だけで着手可否を推定せず、Sourceに示した現在のCHGと正本を読む。完了時は、完了を確認したCHGまたはEvidenceへSourceを差し替える。保留時は次回評価契機を維持し、報告への記載だけで項目を削除しない。

## 現在の残件

2026-08-25の現行Coordinator Runtime 1.0縦結合では、固定Docker image、最小環境、限定Egress、Subscription OAuth preflight、両Provider Adapter、Provider Home四Hash、Mount Grantおよび一般Task E2Eをproduction経路へ接続済みである。現在の残件は[`CHG-000015`第十一次是正](../90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md)を正本とする。作成時RuntimeState bindingの耐久結合、全mutation前のfresh再結合、Recovery ID＋作成時bindingへ限定したRoot journal再開、別Task anchor不変、Evidence 0件拒否、全同期資源の解放確認、production facadeとpackage `exports` allowlist、および固定coverage下限は実装済みである。独立2 processのsame Home拒否／別Home非競合、Task A／B、cleanup-only、receiptからexact Docker削除・Host回復・残存0、release false／throw、およびCLIの単一／複数inventory・第三状態・成功投影を重点Gateへ接続し、全719試験、journal重点27試験、production回復／CLI重点25試験、private package checkおよび固定coverage下限を通過した。残るGateは同じ新固定版への独立Agent／Architecture／Security再レビューとDocument／Gap／Impact＋Conformance再監査、およびPass後の正式署名一般Task実runである。下表はそれらの完了前に`Completed`へ昇格しない。

| ID | 件名 | Work State | Scope / Target | Source | Next action / Re-evaluation trigger |
| --- | --- | --- | --- | --- | --- |
| `FU-018-028` | Claude実行計画基盤 | Completed | 非実行の固定Claude probe契約 | [CHG-000028 全体](../90_Release/Changes/CHG-000028_Claude_Execution_Plan_Foundation.md) | 固定版`01a92ba5d8597baebf52265c6c733747451e44ad`の検証完了。契約変更時に再評価する |
| `FU-018-CLAUDE-DIST` | Claude配布Identityと利用条件 | In Progress | manifest署名、binary取得、固定image digest、exact argv互換性、binary配布条件と認証service条件の有効化 | [CHG-000038](../90_Release/Changes/CHG-000038_Claude_Subscription_OAuth_Vertical_Slice.md) | 署名manifest、Linux x64 binary Identity、固定Provider image、exact request argv、Runtime-owned verifierおよび固定image配布は接続済み。現固定版の独立再レビュー／再監査後、正式署名一般Task実runで配布条件と認証service条件を同時確認する |
| `FU-018-PROVIDER-HOME` | Provider Home保護とMount Grant | In Progress | local OS user単位の専用Home、settings分離、opaqueな一回限りmount許可と失効 | [CHG-000029](../90_Release/Changes/CHG-000029_Provider_Home_Mount_Grant_Lifecycle_Foundation.md)、[CHG-000030](../90_Release/Changes/CHG-000030_Provider_Home_Mount_Grant_Runtime_Store.md)、[CHG-000031](../90_Release/Changes/CHG-000031_Runtime_Owned_Operation_Context_Capability.md)、[CHG-000032](../90_Release/Changes/CHG-000032_Current_Process_Principal_Observation.md)、[CHG-000033](../90_Release/Changes/CHG-000033_Pre_Active_Provisioning_One_Shot_Contract.md)、[CHG-000034](../90_Release/Changes/CHG-000034_Native_Direct_Provision_Supervisor_Entrypoint.md)、[CHG-000035](../90_Release/Changes/CHG-000035_Native_Provision_Bootstrap_Dependency_Reduction.md)、[CHG-000036](../90_Release/Changes/CHG-000036_AppContainer_Provision_Worker_Candidate.md)、[CHG-000039](../90_Release/Changes/CHG-000039_Runtime_Owned_Provider_Home_Observation.md)、[CHG-000040](../90_Release/Changes/CHG-000040_Runtime_Owned_Provider_Home_Mount_Grant.md)、[CHG-000044](../90_Release/Changes/CHG-000044_Runtime_Provider_Authority_Capability.md) | selected-user observerの四Hash、Grant issue／consume／owner限定complete／revoke、実Docker bind mount、logical Home／Host Operation kernel lock、active pointer、Task回復記録およびcleanup WALはproduction経路へ接続済み。現固定版の独立再レビュー／再監査と正式署名一般Task実runで閉じる |
| `FU-018-EGRESS` | EgressとTelemetry制御 | In Progress | endpoint限定Proxy、親環境遮断、Telemetry判断と観測 | [CHG-000038](../90_Release/Changes/CHG-000038_Claude_Subscription_OAuth_Vertical_Slice.md) | IANA snapshot、限定Proxy、固定Docker network、親環境を継承しない最小環境およびcleanupはRuntime adapterへ接続済み。現固定版の独立再レビュー／再監査と正式署名一般Task実runで閉じる |
| `FU-018-CLAUDE-AUTH` | Claude OAuth lifecycleと実probe | In Progress | login、logout、refresh、quota観測、追加購入停止、実request、終了とcleanup | [CHG-000038](../90_Release/Changes/CHG-000038_Claude_Subscription_OAuth_Vertical_Slice.md) | 専用Provider Home、Claude Max OAuth、読取り専用Subscription preflight、bounded request、追加購入／API fallback禁止およびMount Grant付き実行は接続済み。logout／再loginは別Lifecycleとし、現固定版の正式署名一般Task実runを残す |

## 境界

- `Completed`はCHG-000028の非実行候補の検証完了だけを表し、Effect、採用、統合または実Provider readinessを許可しない。`In Progress`は人間判断による設計blockerが解消して後続実装を開始した状態であり、component、operational one-shot、Gateまたは実Provider readinessの成立を意味しない。`Blocked`はSourceが示す停止条件の解消に人間判断または別変更が必要であることを表す。`Unscheduled`は後続CHGと実施時期が未設定であり、不要、終了または許可済みを意味しない。
- `FU-018-CLAUDE-DIST`はbinary配布物の条件と認証済みservice利用条件を別々に解決する。Pro／MaxまたはTeam／Enterpriseという提供形態候補だけから適用条件を確定しない。
- 標準ProfileのAPI key、Console API account、第三者API Provider、追加credit購入、自動plan切替およびHost fallbackは残件ではなく、原則禁止かつv1非対応の境界である。将来有料APIを扱う場合はSubscriptionのfallbackではなく、ユーザー明示設定、exact Provider／Account、分離Credential source、予算およびOperation Authorityを要求する別Profile／別Capabilityの固有CHGとして開始する。
- Codex／Claude Codeの両Provider Adapterは一般Task経路へ接続済みである。両経路とも現固定版の独立再レビュー／再監査と正式署名一般Task実run前は`Completed`へ昇格しない。
