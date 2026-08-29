# CRDD Product Roadmap

Status: Non-normative Open Work Registry
Owner: Qual-Lab
Last Updated: 2026-08-29
Related:
- [CRDD標準自身の課題探索・要求形成](../01_Discovery/01_CRDD_Product_Discovery.md)
- [05_Autonomous_Operation.md](../05_Autonomous_Operation.md)
- [21_Discovery.md](../21_Discovery.md)
- [CHG-000014](../90_Release/Changes/CHG-000014_V018_Architecture_Candidate_Integration.md)
- [CHG-000015](../90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md)
- [CHG-000055](../90_Release/Changes/CHG-000055_CRDD_Long_Term_Evolution_Roadmap.md)

---

> 本書は、現在も処置、判断または再評価が必要な作業だけを一覧する非規範の登録簿である。要求、設計、受入条件、変更履歴または完了根拠の正本ではない。意味と完了判定は各項目の情報源へ置き、完了した項目は結果を正本またはCHGへ反映して本書から除去する。

## 1. 現在の未完了作業

| 作業 | 判断状態 | 対応状態 | 情報源 | 次の処置／再評価契機 |
|---|---|---|---|---|
| Coordinator Runtime 1.0の完成固定 | —（非適用） | In Progress | [CHG-000015](../90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md) | 成功Vertical SliceをRuntime全体の完成へ読み替えず、署名入力なしの開発E2Eで4経路・一般Task・Recoveryを収束させる。全機械確認後に凍結した候補だけを正式署名E2Eへ一度通し、現行正本、残存リスクおよび完了条件を再計算する。必要な是正と固定版確認後、人間のPR／統合判断へ渡す |
| Front Claude Codeを含む逆方向経路の正式署名E2E | Adopted | In Progress | [エージェント組織](../04_Agent_Organization.md)、[CHG-000015](../90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md) | Coordinator仲介Authority Treeと4経路の完全一致Runnerは機械試験済み。最新署名配布物から`Front Claude Code → Codex Executor → Claude Code Independent Reviewer`を含む4経路を実測し、入口Identityは要求Profile、実Executor／Reviewerは観測結果として区別する。Provider同士の直接spawn、循環、API key、従量API、追加購入または有料fallbackは許可しない |
| v0.18とCoordinator Runtimeの利用者向け入口整理 | Adopted | In Progress | [公開入口](../README.md)、[Runtime実装入口](../tools/coordinator/README.md)、[CHG-000015](../90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md) | root READMEの採用者向け変化、Runtime README上部の現在Capability／起動条件／未成立範囲、Threat Modelと後続詳細のTrust／Provisioning／Recoveryへ三層化済み。正式署名実測と完成監査の結果を同期後、本項を正本へ移してRoadmapから除く |
| 上流工程エージェント、課題探索対話ループおよび工程接続の強化 | Adopted | Planned | [上流工程強化](../01_Discovery/01_CRDD_Product_Discovery.md)、[工程接続と意味網羅検証](../01_Discovery/01_CRDD_Product_Discovery.md#731-工程接続と意味網羅検証の強化候補)、[判断支援契約](../11_Skill.md#53-decision-support-contract)、[CHG-000055](../90_Release/Changes/CHG-000055_CRDD_Long_Term_Evolution_Roadmap.md) | 対象Releaseはv0.18.0 Candidate。Coordinator Runtimeの正式署名一般Task実行と完成固定版確認後、現行正本と影響を再確認して人間の着手判断を得る。このRuntimeを使い、課題探索から専門工程までの強化に加えて、振る舞い仕様→アーキテクチャ→検証設計→実装→検証を接続する。正常・準正常・異常・回復、Critical Journey、Single Owner、Property別のHuman／AI／Machine検証責務、成功母集団、`null / absent / unknown`、実Producer→Production Consumerおよびcleanup後条件を状態・遷移・資源・観測へ結合し、Design／Verification／System Journeyの三閉包をDogfoodingする。人間判断では、不要な質問の除外、要求種別、推奨と同粒度の代替案、影響・保留結果・回答形式、回答の正本反映、重複質問なしの自律再開までを一つのJourneyとして評価する。新しい固定工程、全対象への完全Runtime契約または全質問への長文Templateは前提にしない |
| Coordinator Reference Runtimeの根拠駆動リファクタリング | Adopted | Planned | [リファクタリング候補](../01_Discovery/01_CRDD_Product_Discovery.md#732-coordinator-reference-runtimeの根拠駆動リファクタリング候補)、[CHG-000055](../90_Release/Changes/CHG-000055_CRDD_Long_Term_Evolution_Roadmap.md) | 対象Releaseはv0.18.0 Candidate。Runtime 1.0の正式署名一般Taskと完成固定版の確認後、現行正本と影響を再確認して人間の着手判断を得る。第2段階のRuntime自己適用Evidenceから、反復Finding、変更頻度および責務集中に裏付けられた安定境界だけを抽出し、変更単位ごとの検証・監査を完了する。具体的な将来機構と利用先は研究候補（Held）のままとする |
| 既存・過去CHGを含む人間可読文書の意味構造改善 | Adopted | Planned | [人間可読文書の改善候補](../01_Discovery/01_CRDD_Product_Discovery.md#733-人間可読文書の意味構造改善候補)、[文書化](../03_Documentation.md#481-locale-first-display)、[CHG-000055](../90_Release/Changes/CHG-000055_CRDD_Long_Term_Evolution_Roadmap.md) | 対象Releaseはv0.18.0 Candidate。Runtime 1.0の正式署名一般Taskと完成固定版の確認後、現行正本と影響を再確認して人間の着手判断を得る。RuntimeをDogfoodingし、新規文書だけでなく現行系列の既存正本、README、監査文書およびReleasedを含む過去CHGを棚卸しして、人間／AI／機械可読性とGit差分の追跡可能性から優先順位を付ける。概要→現在状態→重要事項→詳細契約→根拠／履歴の段階的開示、平易な説明、一文一義、文書種別ごとの入口、変更トレースの現在状態と履歴の分離を評価する。公開済みtag、変更ID、判断、当時状態、Requirement、規範強度、Authority、Risk、Evidenceおよび時系列を変えず、意味差分確認と変更単位ごとの検証・監査を伴う情報欠落のないMarkdown再構成または補助投影として段階実施する |
| CRDD長期発展の上位方向と能力地平の表示枠組み | Adopted | Unscheduled | [長期発展方針](../01_Discovery/01_CRDD_Product_Discovery.md#7-crddの長期発展方針)、[CRDD版の発展](../01_Discovery/01_CRDD_Product_Discovery.md#79-crdd版の発展version-evolutionと責務分離) | 採用対象は人間可読な表示枠組みと根拠駆動の責務分離ループであり、具体的な将来能力は含めない。v0.18.0 Candidateの結果と、第2段階で最初に得た自己適用の根拠を再評価契機とする。専門能力はまずContextとRole／Skillで自己適用し、共有すべき正本情報または不変条件の不足がEvidenceで成立した場合だけ責務境界を再評価する |
| 採用済み3項目を除く第2段階の実行観測候補および第3～第6段階の個別研究候補 | Held | Unscheduled | [長期発展方針の研究候補](../01_Discovery/01_CRDD_Product_Discovery.md#78-研究候補と保持条件)、[将来能力地平](../01_Discovery/01_CRDD_Product_Discovery.md#79-crdd版の発展version-evolutionと責務分離) | 第1段階の完成固定版と第2段階の最初の自己適用結果を得た後、価値、成立性、費用、安全性および責務境界を人間が再評価する。将来Versionは能力地平であり、版予約、収載、期限、実装許可またはReleaseを意味しない。Linux常設、複数Repository、MCP／HTTP、Self-hosted ProviderおよびOrganization Runtimeの実装許可を本行から推定しない |
| 自律Operationの参照実証 | Exploring | Unscheduled | [参照Operation実証](../05_Autonomous_Operation.md#reference-operation-experiments)、[安全境界](../05_Autonomous_Operation.md#14-pocで確認する境界)、[将来互換性](../05_Autonomous_Operation.md#6-将来互換性の確認候補) | 週次プロダクトレビュー、Communication結果レビュー、Roadmap再評価、Repository Eventのうち判断を変え得る最小の実証を選ぶ。Runtime完成または明示的な人間判断を再評価契機とし、起動数ではなく判断価値、安全性、誤起動、収束、根拠および人間負荷で評価する |
| Issue #30の責務別再評価と終了判断 | Exploring | Unscheduled | [CHG-000013](../90_Release/Changes/CHG-000013_Communication_Market_and_Adoption_Exploration.md)、[Issue #30](https://github.com/qual-lab/CRDD/issues/30) | Communication／Discovery変更の内容収束後または判断を変え得る実運用根拠の発生時に、詳細論点を責務別に分類する。対応済みまたは不要なら理由を残してIssueを閉じ、採用する論点だけを独立した変更意図へ接続する |
| v0.18.0 Candidateの未終了CHG確認、最終固定、CHANGELOG、統合およびRelease判断 | —（非適用） | Planned | [19_Maintenance.md](../19_Maintenance.md)、[現行v0.18収載境界](../90_Release/Changes/CHG-000014_V018_Architecture_Candidate_Integration.md#9-追加されたv0180収載境界)、[収載判断と実行順序](../90_Release/Changes/CHG-000055_CRDD_Long_Term_Evolution_Roadmap.md#9-v0180-candidateへの収載判断による再開)、[過去の移管スナップショット](../90_Release/Changes/CHG-000014_V018_Architecture_Candidate_Integration.md#51-未終了変更トレースの移管スナップショット) | Runtime実証、§7.3.1～§7.3.3の工程接続強化、根拠駆動リファクタリングおよび文書意味構造改善、ならびに全未終了CHGを完成固定・監査する。Runtimeへ影響した場合は、改善後の最終Runtime IdentityでCHG-000015の完成条件、正式署名4経路E2E、失敗・取消・Recoveryおよび完成監査を再固定する。非影響の場合は依存閉包と理由付き非該当を記録する。いずれかを収載範囲から外す場合は人間の明示判断を記録し、その後にCHANGELOG、移行内容およびRelease Readinessを更新して人間の統合・Release判断へ渡す |

## 2. 境界

- `Adopted`は作業意図の採用であり、実装完了、統合、リスク受容またはReleaseを意味しない。`Exploring`は候補の保持であり、着手、優先順位または実行許可を意味しない。CHG、保守契約または承認済み是正が実行根拠となる実行・参照項目には判断状態を適用せず、`—（非適用）`と表示して対応状態と実行根拠だけを保持する。
- `In Progress`、`Planned`および`Unscheduled`は作業の対応状態であり、判断状態と混同しない。
- 完了した実装部品、試験結果、監査結果および過去の固定改訂版を本書へ複製しない。現在の未完了境界に必要な最小の情報源だけを示す。
- 標準ProfileにおけるAPI key課金、従量APIへの自動fallback、追加credit購入、自動plan切替およびHost fallbackは禁止または非対応の境界であり、現在の残件ではない。将来扱う場合はユーザーの明示設定、対象Provider／Account、分離Credential、予算およびOperation Authorityを持つ別Profile／別Capabilityとして判断する。
- 一つの項目が恒久的な概念、要求、設計、検証または変更履歴へ育った場合、その責務を持つルート正本またはCHGへ移し、本書には未完了の次の処置だけを残す。
- 長期発展方針、§7.3.1～§7.3.3の改善意図、および残る個別能力候補の採用を分ける。改善意図は`Adopted / Planned`、それらを除く第2段階の実行観測候補と第3～第6段階は`Held / Unscheduled`であり、各段階の開始時に人間が再評価する。
