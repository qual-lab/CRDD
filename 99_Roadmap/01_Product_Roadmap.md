# CRDD Product Roadmap

Status: Non-normative Open Work Registry
Owner: Qual-Lab
Last Updated: 2026-09-01
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

Runtime完成固定と内部Tool是正の現在の作業は、[完成確認記録](../07_Quality/Verification_Results/2026-09-01_Coordinator_Completion_Review.md)を参照する。未到達評価・追加試験の限定再確認と変更後の正式実測は完了し、結果記録の限定確認も完了した。担当責任者Qual-Labが全体完成評価へ進む。統合・リリースは未判定である。

| 作業 | 判断状態 | 対応状態 | 情報源 | 次の処置／再評価契機 |
|---|---|---|---|---|
| Coordinator Runtime 1.0の完成固定 | —（非適用） | In Progress | [CHG-000015](../90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md)、[有用性評価](../01_Discovery/01_CRDD_Product_Discovery.md#runtime-utility-evaluation) | [未到達評価・追加試験と独立確認](../07_Quality/Verification_Results/2026-09-01_Coordinator_Completion_Review.md)と変更後の正式署名実測を接続し、限定確認済みの結果から全体完成判断を行う。現在の義務を将来へ移さず、人間のPR／統合判断へ渡す。有用性の未測定・未実証範囲は情報源を参照する |
| v0.18とCoordinator Runtimeの利用者向け入口整理 | Adopted | In Progress | [公開入口](../README.md)、[Runtimeの振る舞い仕様](../05_SPEC/01_Behavior_Specification.md)、[CHG-000015](../90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md) | SPEC・Quality Centerへ同期した最新署名実測と、参照で追従するREADMEの限定確認は完了。全体完成評価で現在案内を確定した後に本項を除く |
| 上流工程エージェント、課題探索対話ループおよび工程接続の強化 | Adopted | In Progress | [上流工程強化](../01_Discovery/01_CRDD_Product_Discovery.md)、[工程接続と意味網羅検証](../01_Discovery/01_CRDD_Product_Discovery.md#731-工程接続と意味網羅検証の強化候補)、[判断支援契約](../11_Skill.md#53-decision-support-contract)、[CHG-000055](../90_Release/Changes/CHG-000055_CRDD_Long_Term_Evolution_Roadmap.md) | 自己適用で得た是正、利用側への伝播、未確認範囲を全体Checker・対象試験とともにv0.18最終固定版の一括監査へ渡し、残る指摘を処置する |
| Coordinator Reference Runtimeの根拠駆動リファクタリング | Adopted | In Progress | [リファクタリング候補](../01_Discovery/01_CRDD_Product_Discovery.md#732-coordinator-reference-runtimeの根拠駆動リファクタリング候補)、[CHG-000055](../90_Release/Changes/CHG-000055_CRDD_Long_Term_Evolution_Roadmap.md) | v0.18.0 Candidate対象の実装と実測限界（CHG-000055 §24・§26）を、最新固定候補のE2Eと一括監査で確認する。性能優位は未実証であり、具体的な将来機構と利用先は研究候補（Held）のままとする |
| v0.18内部Tool命名Baselineの収束 | —（非適用） | In Progress | [CHG-000017](../90_Release/Changes/CHG-000017_Tools_Coding_Standards.md)、[内部Tool規約](../06_Architecture/99_Coding_Standards.md) | 最新固定改訂版の対象集合・命名検査と未確認範囲を共通入力にし、独立レビュー・必要監査を完了して結果をCHG-000017へ反映する |
| 既存・過去CHGを含む人間可読文書の意味構造改善 | Adopted | In Progress | [人間可読文書の改善候補](../01_Discovery/01_CRDD_Product_Discovery.md#733-人間可読文書の意味構造改善候補)、[文書化](../03_Documentation.md#481-locale-first-display)、[CHG-000055](../90_Release/Changes/CHG-000055_CRDD_Long_Term_Evolution_Roadmap.md) | CHG-000055 §25の対象と未確認範囲について、最新固定版の本文・条件論理・日本語の参照案内、および公開済みCHG・固定Evidenceの保持を最終監査で確認する |
| CRDD長期発展の上位方向と能力地平の表示枠組み | Adopted | Unscheduled | [長期発展方針](../01_Discovery/01_CRDD_Product_Discovery.md#7-crddの長期発展方針)、[CRDD版の発展](../01_Discovery/01_CRDD_Product_Discovery.md#79-crdd版の発展version-evolutionと責務分離) | 採用対象は人間可読な表示枠組みと根拠駆動の責務分離ループであり、具体的な将来能力は含めない。v0.18.0 Candidateの結果と、第2段階で最初に得た自己適用の根拠を再評価契機とする。専門能力はまずContextとRole／Skillで自己適用し、共有すべき正本情報または不変条件の不足がEvidenceで成立した場合だけ責務境界を再評価する |
| 採用済み3項目を除く第2段階の実行観測候補および第3～第6段階の個別研究候補 | Held | Unscheduled | [長期発展方針の研究候補](../01_Discovery/01_CRDD_Product_Discovery.md#78-研究候補と保持条件)、[将来能力地平](../01_Discovery/01_CRDD_Product_Discovery.md#79-crdd版の発展version-evolutionと責務分離) | 第1段階の完成固定版と第2段階の最初の自己適用結果を得た後、価値、成立性、費用、安全性および責務境界を人間が再評価する。将来Versionは能力地平であり、版予約、収載、期限、実装許可またはReleaseを意味しない。Linux常設、複数Repository、MCP／HTTP、Self-hosted ProviderおよびOrganization Runtimeの実装許可を本行から推定しない |
| 自律Operationの参照実証 | Exploring | Unscheduled | [参照Operation実証](../05_Autonomous_Operation.md#reference-operation-experiments)、[安全境界](../05_Autonomous_Operation.md#14-pocで確認する境界)、[将来互換性](../05_Autonomous_Operation.md#6-将来互換性の確認候補) | 週次プロダクトレビュー、Communication結果レビュー、Roadmap再評価、Repository Eventのうち判断を変え得る最小の実証を選ぶ。Runtime完成または明示的な人間判断を再評価契機とし、起動数ではなく判断価値、安全性、誤起動、収束、根拠および人間負荷で評価する |
| Issue #30の責務別再評価と終了判断 | Exploring | Unscheduled | [CHG-000013](../90_Release/Changes/CHG-000013_Communication_Market_and_Adoption_Exploration.md)、[Issue #30](https://github.com/qual-lab/CRDD/issues/30) | Communication／Discovery変更の内容収束後または判断を変え得る実運用根拠の発生時に、詳細論点を責務別に分類する。対応済みまたは不要なら理由を残してIssueを閉じ、採用する論点だけを独立した変更意図へ接続する |
| v0.18.0 Candidateの未終了CHG確認、最終固定、CHANGELOG、統合およびRelease判断 | —（非適用） | Planned | [19_Maintenance.md](../19_Maintenance.md)、[現行v0.18収載境界](../90_Release/Changes/CHG-000014_V018_Architecture_Candidate_Integration.md#9-追加されたv0180収載境界)、[収載判断と実行順序](../90_Release/Changes/CHG-000055_CRDD_Long_Term_Evolution_Roadmap.md#9-v0180-candidateへの収載判断による再開)、[過去の移管スナップショット](../90_Release/Changes/CHG-000014_V018_Architecture_Candidate_Integration.md#51-未終了変更トレースの移管スナップショット) | Runtime実証、§7.3.1～§7.3.3の工程接続強化、根拠駆動リファクタリングおよび文書意味構造改善、ならびに全未終了CHGを完成固定・監査する。Runtimeへ影響した場合は、改善後の最終Runtime IdentityでCHG-000015の完成条件、正式署名4経路E2E、失敗・取消・Recoveryおよび完成監査を再固定する。非影響の場合は依存閉包と理由付き非該当を記録する。いずれかを収載範囲から外す場合は人間の明示判断を記録し、その後にCHANGELOG、移行内容およびRelease Readinessを更新して人間の統合・Release判断へ渡す |

既存のRuntime完成固定・根拠駆動リファクタリング項目から、[次版へ引き継ぐ有用性・照合費用の改善候補](../01_Discovery/01_CRDD_Product_Discovery.md#runtime-utility-next-version-candidates)も追跡する。候補は`Held / Unscheduled`、版番号・収載は未決。親Coordinatorが現行Runtimeの完成固定と実務自己適用の収束後に再評価へ戻し、人間の決定権限者が採否を決める。現行v0.18の必須条件・不具合是正を次版へ移すものではなく、現在の安全判断を変える根拠が出た場合は先に現行是正へ戻す。

<a id="tool-development-layout-follow-up"></a>

### Tool開発構成の標準化を検討する順番

担当責任者はQual-Lab。[工程別配置](../01_Discovery/01_CRDD_Product_Discovery.md#tool-development-layout-candidate)は`Adopted / In Progress`。未評価範囲と現在の検証義務を照合し、Runtime全体完成監査の指摘を是正・再確認する。配置・利用者設計の結果は[CHG-000017 §9](../90_Release/Changes/CHG-000017_Tools_Coding_Standards.md#9-内部ツールの工程別配置への移行)、現在の是正は[完成確認記録](../07_Quality/Verification_Results/2026-09-01_Coordinator_Completion_Review.md)を参照する。旧署名Evidenceを現行版の合格へ流用せず、配布テンプレート、生成物の非追跡、過去固定Evidenceを維持する。新しい配布・自動取得方式は追加しない。

Issue #30は2026-08-31に本文・コメント・状態を再確認した。`open`、コメント0件であり、詳細なセグメント比較、調査倫理、ダークパターン、商業性、調査手法、採用後価値モデルの候補を保持している。各候補の採用CHGまたは人間による理由付き終了への接続は未成立なので、対応済みとして閉じない。担当・再評価契機は上表を維持する。Issue本文の旧CHG-000012は、現在のCHG-000013への再採番前の参照であり、候補内容の完了根拠ではない。

## 2. 境界

次版候補の既存追跡には、[限定分散と統合結果の評価](../01_Discovery/01_CRDD_Product_Discovery.md#bounded-distributed-execution-candidate)も含む。v0.19の能力像に向けた`Held / Unscheduled`の研究候補であり、採用済みv0.18作業の延期ではない。

- `Adopted`は作業意図の採用であり、実装完了、統合、リスク受容またはReleaseを意味しない。`Exploring`は候補の保持であり、着手、優先順位または実行許可を意味しない。CHG、保守契約または承認済み是正が実行根拠となる実行・参照項目には判断状態を適用せず、`—（非適用）`と表示して対応状態と実行根拠だけを保持する。
- `In Progress`、`Planned`および`Unscheduled`は作業の対応状態であり、判断状態と混同しない。
- 完了した実装部品、試験結果、監査結果および過去の固定改訂版を本書へ複製しない。現在の未完了境界に必要な最小の情報源だけを示す。
- 標準ProfileにおけるAPI key課金、従量APIへの自動fallback、追加credit購入、自動plan切替およびHost fallbackは禁止または非対応の境界であり、現在の残件ではない。将来扱う場合はユーザーの明示設定、対象Provider／Account、分離Credential、予算およびOperation Authorityを持つ別Profile／別Capabilityとして判断する。
- 一つの項目が恒久的な概念、要求、設計、検証または変更履歴へ育った場合、その責務を持つルート正本またはCHGへ移し、本書には未完了の次の処置だけを残す。
- 長期発展方針、§7.3.1～§7.3.3の改善意図、および残る個別能力候補の採用を分ける。改善意図は項目別に`Adopted / In Progress`または`Adopted / Planned`、それらを除く第2段階の実行観測候補と第3～第6段階は`Held / Unscheduled`であり、各段階の開始時に人間が再評価する。
