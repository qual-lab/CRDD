# Project Runtime自己適用と限定有用性評価

関連変更: [CHG-000057](../CHG-000057_Minimum_AI_Native_Project_Runtime.md)

## 結論

CRDD v0.19の品質状態更新を、署名固定版Project Runtimeへ一つのMilestoneとして委譲した。Claude Codeが実装し、Codexが独立レビューした候補は、指定した1ファイルだけを変更し、Milestone受入と正本採用まで126.528秒で完了した。開始後の人間による追加入力、再試行、再計画、手動Recoveryは発生せず、cleanupも確認できた。

この結果は、限定された実務文書更新でProject Runtimeが人間によるAgent間の受渡しなしにAccepted Resultへ到達できたことを示す。一方、比較対象を同時実行しておらず、人間の実作業時間、AI処理時間およびProvider利用量も計測していないため、Direct実行より速い、安い、または高品質であるとは判定しない。

## 実行Profile

| 項目 | 観測結果 |
|---|---|
| 対象 | `07_Quality/01_Quality_Center.md`のv0.19品質状態更新 |
| 基準改訂版 | `0acc157a59ba7a967d280533452be6535eb5a6e3` |
| 実行Runtime | Source A `8cb1383`／署名Manifest carrier `d44ae1a` |
| Executor／Reviewer | Claude Code／Codex |
| Time to Accepted Result | 126.528秒 |
| Task／変更Path | 1件／1 Path |
| 開始後の人間入力 | なし |
| 再試行／再計画 | 0／0 |
| Milestone受入／正本採用 | 成立／成立 |
| cleanup／手動Recovery | 確認済み／不要 |
| Release Authority | 発行なし |

開始前には、送信先、読取り対象5ファイル、変更可能な1ファイルおよびSubscription利用範囲について人間の承認を得た。既存の初期外部送信許可が再利用され、Operation開始後の確認コードや署名鍵入力は要求されなかった。

## 有用性評価

- 成立: 一つの承認済み目標が、実装、独立レビュー、Milestone受入および正本採用まで自動継続した。
- 成立: 変更Pathは事前に許可した1件と一致し、正本Repository以外への採用Effectはなかった。
- 成立: ProviderをExecutorとReviewerへ分けても、再試行・再計画・人間移送なしで収束した。
- 未測定: 人間の実作業秒数、各Agentの処理時間、Token／Quota、Queue待機内訳、直接実行との比較値。
- 判定保留: 速度、費用、品質およびProvider分散についての総合的な優位。

## 限界

本結果は、既に根拠が揃った品質状態を一つの既存表へ反映する、単一Task・単一Path・低Riskの文書更新1件である。複数Task、競合、部分再計画、人間判断移送、実行中取消、異常Recovery、長期安定性、任意の実務Taskまたはv0.19 Releaseを意味しない。測定していない値を0として扱わず、比較Baselineなしに改善率を算出しない。

ローカル原記録は`.crdd/dogfooding/`および`.crdd/project-runtime/`に保持し、Repository管理対象へは判断に必要な閉じた要約だけを収載した。
