# CRDD Product Roadmap

Status: Non-normative Open Work Registry
Owner: Qual-Lab
Last Updated: 2026-09-03
Related:
- [CRDD標準自身の課題探索・要求形成](../01_Discovery/01_CRDD_Product_Discovery.md)
- [05_Autonomous_Operation.md](../05_Autonomous_Operation.md)
- [21_Discovery.md](../21_Discovery.md)
- [CHG-000014](../90_Release/Changes/CHG-000014_V018_Architecture_Candidate_Integration.md)
- [CHG-000015](../90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md)
- [CHG-000055](../90_Release/Changes/CHG-000055_CRDD_Long_Term_Evolution_Roadmap.md)
- [CHG-000056](../90_Release/Changes/CHG-000056_Coordinator_Adoption_Interface_Correction.md)
- [CHG-000057](../90_Release/Changes/CHG-000057_Minimum_AI_Native_Project_Runtime.md)
- [CHG-000058](../90_Release/Changes/CHG-000058_Reasoning_Context_and_Design_Intent.md)
- [CHG-000059](../90_Release/Changes/CHG-000059_Dogfooding_Assurance_Route_and_Readability.md)
- [CHG-000060](../90_Release/Changes/CHG-000060_CRDD_Brand_Icon_Adoption.md)

---

> 本書は、現在も処置、判断または再評価が必要な作業だけを一覧する非規範の登録簿である。要求、設計、受入条件、変更履歴または完了根拠の正本ではない。意味と完了判定は各項目の情報源へ置き、完了した項目は結果を正本またはCHGへ反映して本書から除去する。

## 1. 現在の未完了作業

2026-09-01、v0.18.0を公開し、2026-09-02に採用入口とRuntime実行Identityを是正したv0.18.1を公開した。正式署名4経路E2E、回復経路、採用形態E2E、タグ、公開Releaseおよび不要ブランチ整理まで完了したため、v0.18の完了項目は根拠をCHG・品質記録・公式tagへ接続して本登録簿から除去した。v0.19のCommunication ClosureはCHG-000058の固定候補でChecker、独立レビュー、必要な監査、指摘是正および再確認を完了した。CHG-000059の後続一般化は、`008c583`後に追加した意味変換、状態表示、上位完成、相関不変条件および三値観測を含む新しい固定候補の確認中であり、全必須確認がPassするまで完了表示へ戻さない。v0.19全体のRelease GateはProject Runtimeの残る結合確認、固定候補監査、ブランド収載判断およびリリース判断が終わるまで成立しない。

| 作業 | 判断状態 | 対応状態 | 情報源 | 次の処置／再評価契機 |
|---|---|---|---|---|
| v0.19 Minimum AI-native Project Runtime | Adopted | In Progress | [Discoveryの採用境界](../01_Discovery/01_CRDD_Product_Discovery.md#v019-minimum-project-runtime)、[CHG-000057の現在状態と次Gate](../90_Release/Changes/CHG-000057_Minimum_AI_Native_Project_Runtime.md#8-現在状態と次のgate)、[正常縦断E2E](../90_Release/Changes/Evidence/CHG-000057_Project_Runtime_Real_Provider_E2E_d44ae1a.md)、[自己適用](../90_Release/Changes/Evidence/CHG-000057_Project_Runtime_Self_Application_0acc157.md)、[初回署名前検証](../07_Quality/Verification_Results/2026-09-03_Project_Runtime_Pre_Sign_Verification.md)、[確認済み回復の収束に関する署名前検証](../07_Quality/Verification_Results/2026-09-03_Project_Runtime_Acknowledgement_Closure_Pre_Sign_Verification.md) | 署名固定版の正常縦断2経路、うち1経路の正本採用、低Risk自己適用の正本採用、および技術候補`3125d9d`の決定論的Project全体確認が成立した。次は固定候補の独立確認・必要監査を先に収束させ、その後に認証済み公開MCP Clientからの実Provider経路、実Provider実行中取消、利用可能な実Docker資源のRecovery settlementを最終署名E2Eで確認する。Linux／macOSは実装せず、Project Runtime CoreとMCPのPlatform非依存を維持する |
| v0.20 実行知（Execution Intelligence） | Adopted | Planned | [Discoveryの採用境界](../01_Discovery/01_CRDD_Product_Discovery.md#v020-execution-intelligence) | AI WorkをProject／Milestone／Objective／Task／Attemptへ結合し、実行、成果物、人間受入、運用・事業結果を混同せず評価する。Git管理外の実行履歴、集約と正本昇格の分離、改善候補→人間判断→実験→採用のLoopをv0.20開始時に具体化する。v0.19の完成条件、実行記録の収集開始、巨大Dashboardまたは自動自己変更を意味しない。v0.20着手判断時にCurrent Stateと実行可能な差分を再確認してCHGを作成する |
| CRDD長期発展の上位方向と能力地平の表示枠組み | Adopted | Unscheduled | [長期発展方針](../01_Discovery/01_CRDD_Product_Discovery.md#7-crddの長期発展方針)、[CRDD版の発展](../01_Discovery/01_CRDD_Product_Discovery.md#79-crdd版の発展version-evolutionと責務分離) | 採用対象は人間可読な表示枠組みと根拠駆動の責務分離ループであり、具体的な将来能力は含めない。公開済みv0.18.0の結果と、第2段階で得た自己適用の根拠を再評価契機とする。専門能力はまずContextとRole／Skillで自己適用し、共有すべき正本情報または不変条件の不足がEvidenceで成立した場合だけ責務境界を再評価する |
| 採用済み3項目を除く第2段階の実行観測候補および第3～第6段階の個別研究候補 | Held | Unscheduled | [長期発展方針の研究候補](../01_Discovery/01_CRDD_Product_Discovery.md#78-研究候補と保持条件)、[将来能力地平](../01_Discovery/01_CRDD_Product_Discovery.md#79-crdd版の発展version-evolutionと責務分離) | 第1段階の完成固定版と第2段階の最初の自己適用結果を得た後、価値、成立性、費用、安全性および責務境界を人間が再評価する。将来Versionは能力地平であり、版予約、収載、期限、実装許可またはReleaseを意味しない。Linux常設、複数Repository、MCP／HTTP、Self-hosted ProviderおよびOrganization Runtimeの実装許可を本行から推定しない |
| 自律Operationの参照実証 | Exploring | Unscheduled | [参照Operation実証](../05_Autonomous_Operation.md#reference-operation-experiments)、[安全境界](../05_Autonomous_Operation.md#14-pocで確認する境界)、[将来互換性](../05_Autonomous_Operation.md#6-将来互換性の確認候補) | 週次プロダクトレビュー、Communication結果レビュー、Roadmap再評価、Repository Eventのうち判断を変え得る最小の実証を選ぶ。Runtime完成または明示的な人間判断を再評価契機とし、起動数ではなく判断価値、安全性、誤起動、収束、根拠および人間負荷で評価する |

長期研究候補のうち、[v0.19へ採用したProject Runtime境界](../01_Discovery/01_CRDD_Product_Discovery.md#v019-minimum-project-runtime)は上表の実行項目へ移した。[有用性・照合費用の改善候補](../01_Discovery/01_CRDD_Product_Discovery.md#runtime-utility-next-version-candidates)は、CHG-000057へ明示収載した観測だけをCurrent Scopeとし、残る候補は`Held / Unscheduled`を維持する。

## 2. v0.19の実行順序

v0.19は次の順序で収束させる。内部Taskの並列化は許すが、後段のGateを先行完了へ読み替えない。

1. 完了: 到達可能な署名固定版で、既存Docker Recoveryを正式な公開入口から収束させた。
2. 完了: 署名固定候補の正常縦断2経路、終了後資源の確認、および低RiskなCRDD品質文書更新1件の自己適用を完了した。限定有用性評価では測定値と未測定値を分け、総合的な優位は未確定とした。
3. 進行中: 決定論的Project全体確認を終えた固定候補へ独立確認と必要監査を一括し、指摘を署名前に収束させる。
4. 未着手: 監査後のRuntime実行Identityを固定し、認証済み公開MCP Clientからの実Provider経路、実Provider実行中取消および利用可能な実Docker資源のRecovery settlementを最終E2Eで確認する。その結果と各変更のRelease Gateからv0.19の収載内容を人間が確定する。

## 3. 境界

次版候補の既存追跡には、[限定分散と統合結果の評価](../01_Discovery/01_CRDD_Product_Discovery.md#bounded-distributed-execution-candidate)も含む。v0.19の能力像に向けた`Held / Unscheduled`の研究候補であり、採用済みv0.18作業の延期ではない。

- `Adopted`は作業意図の採用であり、実装完了、統合、リスク受容またはReleaseを意味しない。`Exploring`は候補の保持であり、着手、優先順位または実行許可を意味しない。CHG、保守契約または承認済み是正が実行根拠となる実行・参照項目には判断状態を適用せず、`—（非適用）`と表示して対応状態と実行根拠だけを保持する。
- `In Progress`、`Planned`および`Unscheduled`は作業の対応状態であり、判断状態と混同しない。
- 完了した実装部品、試験結果、監査結果および過去の固定改訂版を本書へ複製しない。現在の未完了境界に必要な最小の情報源だけを示す。
- 標準ProfileにおけるAPI key課金、従量APIへの自動fallback、追加credit購入、自動plan切替およびHost fallbackは禁止または非対応の境界であり、現在の残件ではない。将来扱う場合はユーザーの明示設定、対象Provider／Account、分離Credential、予算およびOperation Authorityを持つ別Profile／別Capabilityとして判断する。
- 一つの項目が恒久的な概念、要求、設計、検証または変更履歴へ育った場合、その責務を持つルート正本またはCHGへ移し、本書には未完了の次の処置だけを残す。
- 長期発展方針、完了した§7.3.1～§7.3.3の改善意図、および残る個別能力候補の採用を分ける。完了根拠はCHGへ残し、未採用の第2段階の実行観測候補と第3～第6段階は`Held / Unscheduled`を維持する。各段階の開始時に人間が再評価する。
