# CRDD Product Roadmap

Status: Non-normative Open Work Registry
Owner: Qual-Lab
Last Updated: 2026-08-26
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
| Coordinator Runtime 1.0の正式署名Vertical Slice Evidence監査 | —（非適用） | In Progress | [CHG-000015](../90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md) | 固定1 Pathの`Codex Front → Claude Code Executor → Codex Independent Reviewer`成功経路、Candidate破棄、cleanupおよび残存0の実runは完了した。現在状態の正本伝播と固定Evidenceへの全必須監査を完了し、全て`Pass`なら本項目を主要表示から除去する |
| Coordinator Runtime 1.0の完成固定 | —（非適用） | In Progress | [CHG-000015](../90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md) | 成功Vertical SliceをRuntime全体の完成へ読み替えず、未評価の正式署名E2E、現行正本、残存リスクおよび完了条件を再計算する。必要な是正と固定版確認後、人間のPR／統合判断へ渡す |
| Front Claude Codeを含む逆方向経路の正式署名E2E | Adopted | Planned | [エージェント組織](../04_Agent_Organization.md)、[CHG-000015](../90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md)、[CHG-000042](../90_Release/Changes/CHG-000042_Provider_Neutral_Delegation_Selection_Grant.md) | Coordinator仲介Authority Treeを維持し、`Front Claude Code → Codex Executor → Claude Code Independent Reviewer`を固定・限定Taskで実測する。Provider同士の直接spawn、循環、API key、従量API、追加購入または有料fallbackは許可しない |
| 上流工程エージェントと課題探索対話ループの強化 | Adopted | Planned | [CRDD標準自身の課題探索・要求形成](../01_Discovery/01_CRDD_Product_Discovery.md) | Coordinator Runtimeの正式署名一般Task実行と完成固定版確認後、現行正本と影響を再確認して人間の着手判断を得る。その後、このRuntimeを使って一つの主変更意図からCHG、専門探索、実装および独立レビューを行う |
| CRDD長期発展の上位方向 | Adopted | Unscheduled | [長期発展方針](../01_Discovery/01_CRDD_Product_Discovery.md#7-crddの長期発展方針) | 第1段階の完成固定版と、第2段階で最初に得た自己適用の根拠を再評価契機とする。段階の順序や個別能力から実装許可を推定しない |
| 第2～第6段階の個別研究候補 | Held | Unscheduled | [長期発展方針の研究候補](../01_Discovery/01_CRDD_Product_Discovery.md#78-研究候補と保持条件) | 第1段階の完成固定版と第2段階の最初の自己適用結果を得た後、価値、成立性、費用、安全性および責務境界を人間が再評価する |
| 自律Operationの参照実証 | Exploring | Unscheduled | [参照Operation実証](../05_Autonomous_Operation.md#reference-operation-experiments)、[安全境界](../05_Autonomous_Operation.md#14-pocで確認する境界)、[将来互換性](../05_Autonomous_Operation.md#6-将来互換性の確認候補) | 週次プロダクトレビュー、Communication結果レビュー、Roadmap再評価、Repository Eventのうち判断を変え得る最小の実証を選ぶ。Runtime完成または明示的な人間判断を再評価契機とし、起動数ではなく判断価値、安全性、誤起動、収束、根拠および人間負荷で評価する |
| Issue #30の責務別再評価と終了判断 | Exploring | Unscheduled | [CHG-000013](../90_Release/Changes/CHG-000013_Communication_Market_and_Adoption_Exploration.md)、[Issue #30](https://github.com/qual-lab/CRDD/issues/30) | Communication／Discovery変更の内容収束後または判断を変え得る実運用根拠の発生時に、詳細論点を責務別に分類する。対応済みまたは不要なら理由を残してIssueを閉じ、採用する論点だけを独立した変更意図へ接続する |
| v0.18.0 Candidateの未終了CHG確認、最終固定、CHANGELOG、統合およびRelease判断 | —（非適用） | Planned | [19_Maintenance.md](../19_Maintenance.md)、[CHG-000014の移管スナップショット](../90_Release/Changes/CHG-000014_V018_Architecture_Candidate_Integration.md#51-未終了変更トレースの移管スナップショット) | Runtime実証、上流工程強化および未終了CHGの処置を固定し、全体Checker、必要な独立レビュー／監査、CHANGELOG、移行内容およびRelease Readinessを更新して、人間の統合・Release判断へ渡す |

## 2. 境界

- `Adopted`は作業意図の採用であり、実装完了、統合、リスク受容またはReleaseを意味しない。`Exploring`は候補の保持であり、着手、優先順位または実行許可を意味しない。CHG、保守契約または承認済み是正が実行根拠となる実行・参照項目には判断状態を適用せず、`—（非適用）`と表示して対応状態と実行根拠だけを保持する。
- `In Progress`、`Planned`および`Unscheduled`は作業の対応状態であり、判断状態と混同しない。
- 完了した実装部品、試験結果、監査結果および過去の固定改訂版を本書へ複製しない。現在の未完了境界に必要な最小の情報源だけを示す。
- 標準ProfileにおけるAPI key課金、従量APIへの自動fallback、追加credit購入、自動plan切替およびHost fallbackは禁止または非対応の境界であり、現在の残件ではない。将来扱う場合はユーザーの明示設定、対象Provider／Account、分離Credential、予算およびOperation Authorityを持つ別Profile／別Capabilityとして判断する。
- 一つの項目が恒久的な概念、要求、設計、検証または変更履歴へ育った場合、その責務を持つルート正本またはCHGへ移し、本書には未完了の次の処置だけを残す。
- 長期発展方針の採用と、第2～第6段階に記録した個別能力候補の採用を分ける。後者は保持中の研究候補であり、各段階の開始時に人間が再評価する。
