# 失敗・Effect・回復

| 観測 | 公開結果 | Effect | 次の行動 |
|---|---|---|---|
| 入力不正／権限不足 | blocked＋理由 | 0 | 入力またはAuthorityを修正 |
| 依存先未開始 | failed／blocked | 未発行 | 再確認または別経路 |
| 要求受理後に応答喪失 | effect unknown | 不明 | 同じIdentityで状態確認 |
| Effect成立・結果搬送失敗 | result unavailable | 発行済み | 結果再取得。処理を再実行しない |
| 回復処置終了・後状態未確認 | recovery required | 処置済み | 終了後を再観測 |
| 終了後確認済み | settled | 確定 | 義務解消 |

異常経路は、原因候補、観測事実、Effect状態、残存義務を分ける。
