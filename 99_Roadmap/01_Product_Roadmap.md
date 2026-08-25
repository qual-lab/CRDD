# CRDD Product Roadmap

Status: Non-normative Open Work Registry
Owner: Qual-Lab
Last Updated: 2026-08-25
Related:
- [CRDD標準自身の課題探索・要求形成](../01_Discovery/01_CRDD_Product_Discovery.md)
- [05_Autonomous_Operation.md](../05_Autonomous_Operation.md)
- [21_Discovery.md](../21_Discovery.md)
- [CHG-000014](../90_Release/Changes/CHG-000014_V018_Architecture_Candidate_Integration.md)
- [CHG-000015](../90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md)

---

> 本書は、現在も処置、判断または再評価が必要な作業だけを一覧する非規範の登録簿である。要求、設計、受入条件、変更履歴または完了根拠の正本ではない。意味と完了判定は各項目の情報源へ置き、完了した項目は結果を正本またはCHGへ反映して本書から除去する。

## 1. 現在の未完了作業

| 作業 | 判断状態 | 対応状態 | 情報源 | 次の処置／再評価契機 |
|---|---|---|---|---|
| Coordinator Runtime 1.0の正式署名一般Task実行 | Adopted | In Progress | [CHG-000015](../90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md)、[CHG-000038](../90_Release/Changes/CHG-000038_Claude_Subscription_OAuth_Vertical_Slice.md) | 正式署名配布物から、一般Task、両Provider経路、Provider Home、Mount Grant、限定Egress、終了、回復および残存0を同一runで確認する。人間だけが扱う署名鍵passphrase、必要なOAuth再認証または外部Provider送信が生じる時点で人間へ返す |
| 未リリース命名／文書Architecture是正の再検証 | Adopted | In Progress | [CHG-000017](../90_Release/Changes/CHG-000017_Tools_Coding_Standards.md)、[CHG-000054](../90_Release/Changes/CHG-000054_Agent_Organization_Document_Architecture.md) | 同じ未リリース変更意図で適用した命名母集団、規範／非規範境界、Roadmap／CHG責務および旧PoC移管を、新固定改訂版の全体Checker、契約試験、独立レビューおよび必須監査で再確認する。自己確認だけで終了扱いにしない |
| 上流工程AgentとDiscovery Elicitation Loopの強化 | Adopted | Planned | [CRDD標準自身の課題探索・要求形成](../01_Discovery/01_CRDD_Product_Discovery.md) | Coordinator Runtimeの正式署名一般Task実行と完成固定版確認後、現行正本と影響を再確認して人間の着手判断を得る。その後、このRuntimeを使って一つの主変更意図からCHG、専門探索、実装、独立レビューを行う |
| 自律Operationの参照実証 | Exploring | Unscheduled | [参照Operation実証](../08_Operation_Health_and_Human_Interface.md#reference-operation-experiments)、[安全境界](../07_Autonomous_Operation_Safety.md#14-pocで確認する境界)、[将来互換性](../09_Forward_Compatibility.md#6-将来互換性の確認候補) | 週次プロダクトレビュー、Communication結果レビュー、Roadmap再評価、Repository Eventのうち判断を変え得る最小の実証を選ぶ。Runtime完成または明示的な人間判断を再評価契機とし、起動数ではなく判断価値、安全性、誤起動、収束、根拠および人間負荷で評価する |
| Issue #30の責務別再評価と終了判断 | Exploring | Unscheduled | [CHG-000013](../90_Release/Changes/CHG-000013_Communication_Market_and_Adoption_Exploration.md)、[Issue #30](https://github.com/qual-lab/CRDD/issues/30) | Communication／Discovery変更の内容収束後または判断を変え得る実運用根拠の発生時に、詳細論点を責務別に分類する。対応済みまたは不要なら理由を残してIssueを閉じ、採用する論点だけを独立した変更意図へ接続する |
| v0.18.0 Candidateの未終了CHG確認、最終固定、CHANGELOG、統合およびRelease判断 | Adopted | Planned | [19_Maintenance.md](../19_Maintenance.md)、[CHG-000014の移管スナップショット](../90_Release/Changes/CHG-000014_V018_Architecture_Candidate_Integration.md#51-未終了変更トレースの移管スナップショット) | Runtime実証、上流工程強化および未終了CHGの処置を固定し、全体Checker、必要な独立レビュー／監査、CHANGELOG、移行内容およびRelease Readinessを更新して、人間の統合・Release判断へ渡す |

## 2. 境界

- `Adopted`は作業意図の採用であり、実装完了、統合、リスク受容またはReleaseを意味しない。`Exploring`は候補の保持であり、着手、優先順位または実行許可を意味しない。
- `In Progress`、`Planned`および`Unscheduled`は作業の対応状態であり、判断状態と混同しない。
- 完了した実装部品、試験結果、監査結果および過去の固定改訂版を本書へ複製しない。現在の未完了境界に必要な最小の情報源だけを示す。
- 標準ProfileにおけるAPI key課金、従量APIへの自動fallback、追加credit購入、自動plan切替およびHost fallbackは禁止または非対応の境界であり、現在の残件ではない。将来扱う場合はユーザーの明示設定、対象Provider／Account、分離Credential、予算およびOperation Authorityを持つ別Profile／別Capabilityとして判断する。
- 一つの項目が恒久的な概念、要求、設計、検証または変更履歴へ育った場合、その責務を持つルート正本またはCHGへ移し、本書には未完了の次の処置だけを残す。
